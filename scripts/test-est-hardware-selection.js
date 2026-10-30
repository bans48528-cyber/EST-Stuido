const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
const babel = require('@babel/core');

const root = path.resolve(__dirname, '..');
const originalLoader = Module._extensions['.js'];
const originalRequire = Module._load;
const invoke = {handler: null};
const confirm = {response: 1, messages: [], responses: []};
Module._extensions['.js'] = (module, filename) => {
    if (!filename.startsWith(path.join(root, 'src'))) return originalLoader(module, filename);
    module._compile(babel.transformSync(fs.readFileSync(filename, 'utf8'), {
        babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs']
    }).code, filename);
};
Module._load = function (name, parent, main) {
    if (name === 'electron') return {ipcRenderer: {invoke: (...args) => invoke.handler(...args)}};
    if (name === '@electron/remote') return {dialog: {showMessageBox: async (parent, options) => {
        confirm.messages.push(options);
        return {response: confirm.responses.length ? confirm.responses.shift() : confirm.response};
    }}, getCurrentWindow: () => null};
    return originalRequire.call(this, name, parent, main);
};

const {HARDWARE_PROFILES, getHardwareProfile, readProjectHardware, serializeHardwareProject} =
    require('../src/common/hardware-profiles');
const {HardwareSession} = require('../src/main/hardware/session');
const {HardwareDraftStore} = require('../src/main/hardware/drafts');
const {HardwareSelectionPreferences} = require('../src/main/hardware/selection-preferences');
const {getHardwareContext, setHardwareContext} = require('../src/renderer/hardware/context');
const {loadHardwareProject, switchHardwareWorkspace} = require('../src/renderer/hardware/project');
const {initializeHardwareSelection} = require('../src/renderer/hardware/startup');
const {createEstDefaultProjectData} = require('../src/renderer/est-project/default-project');
const messages = require('../src/common/hardware-messages.json');
const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return {promise, resolve};
};

const fakeService = () => ({
    commandQueue: Promise.resolve(), pythonProgramActive: false, pauses: 0, disconnects: 0, stops: 0,
    suspendVision () { this.pauses++; }, resumeVision () { this.pauses--; },
    async disconnect () { this.disconnects++; },
    async stopCurrentProgram () { this.stops++; this.pythonProgramActive = false; }
});

(async () => {
    console.log('Checking hardware profiles...');
    assert.deepStrictEqual(HARDWARE_PROFILES.map(item => item.name), ['EST', 'Spark AI', 'New AI']);
    assert.equal(readProjectHardware({}).id, 'est', 'legacy EST files migrate');
    assert.throws(() => readProjectHardware({device: {deviceId: 'foreign-board'}}), /HARDWARE_UNKNOWN/);
    assert.throws(() => getHardwareProfile('../est'), /HARDWARE_UNKNOWN/);
    assert.throws(() => readProjectHardware({meta: {estStudio: {version: 2, hardwareId: 'est'}}}), /VERSION/);
    for (const id of ['spark-ai', 'new-ai']) {
        const profile = getHardwareProfile(id);
        assert.equal(profile.adapter, id === 'spark-ai' ? 'spark-usb' : 'new-usb',
            'other hardware must not inherit EST protocol');
        assert.equal(profile.compiler, id === 'spark-ai' ? 'spark-python' : 'new-python');
        assert.equal(profile.programSlots, id === 'spark-ai' ? 10 : 20);
        assert.equal(readProjectHardware(createEstDefaultProjectData(id)).id, id);
        const blocks = createEstDefaultProjectData(id).targets[1].blocks;
        if (id === 'spark-ai') assert.equal(Object.values(blocks)[0].opcode, 'spark_event_whenflagclicked');
        else assert.equal(Object.values(blocks)[0].opcode, 'new_event_whenflagclicked');
    }
    for (const dictionary of Object.values(messages)) {
        assert.deepStrictEqual(Object.keys(dictionary).sort(), Object.keys(messages.en).sort());
        Object.values(dictionary).forEach(message => assert.ok(message.trim()));
    }

    const service = fakeService();
    const sparkService = fakeService();
    sparkService.setDiscoveryActive = active => { sparkService.discoveryActive = active; };
    const newService = fakeService();
    newService.setDiscoveryActive = active => { newService.discoveryActive = active; };
    console.log('Checking hardware sessions...');
    let firmwareBusy = false;
    let sourceStops = 0;
    let remembered = 'est';
    const writes = [];
    const session = new HardwareSession({service, adapters: {'spark-usb': sparkService, 'new-usb': newService},
        preferences: {read: () => remembered, write: id => { writes.push(id); remembered = id; }},
        stopSources: () => { sourceStops++; },
        isFirmwareBusy: () => firmwareBusy});
    firmwareBusy = true;
    await assert.rejects(session.select({hardwareId: 'new-ai'}), /BUSY/);
    firmwareBusy = false;
    const gate = deferred();
    const operation = session.operation(() => gate.promise);
    await assert.rejects(session.select({hardwareId: 'new-ai'}), /BUSY/);
    gate.resolve(); await operation;
    service.pythonProgramActive = true;
    await assert.rejects(session.select({hardwareId: 'spark-ai'}), /RUNNING/);
    assert.equal(service.disconnects, 0);
    assert.equal(sourceStops, 0, 'declining stop preserves the old source');
    assert.equal(service.pauses, 0);
    assert.deepStrictEqual(writes, [], 'busy/cancelled selections must not overwrite preferences');
    const switched = await session.select({hardwareId: 'spark-ai', confirmStop: true});
    assert.equal(switched.busy, false);
    assert.equal(remembered, 'spark-ai');
    assert.equal(sparkService.discoveryActive, true, 'Spark selection activates USB discovery');
    assert.equal(service.stops, 1);
    assert.equal(sourceStops, 1);
    await assert.rejects(session.operation(() => { throw new Error('must not run'); }), /NOT_READY/);
    sparkService.pythonProgramActive = true;
    assert.equal(session.getState().running, true);
    await assert.rejects(session.select({hardwareId: 'est'}), /RUNNING/);
    assert.equal(remembered, 'spark-ai', 'declining the stop confirmation preserves the saved hardware');
    assert.equal(sparkService.discoveryActive, true, 'declining switch restores discovery lifecycle');
    const estStops = service.stops;
    await session.select({hardwareId: 'est', confirmStop: true});
    assert.equal(sparkService.stops, 1);
    assert.equal(sparkService.disconnects, 1);
    assert.equal(sparkService.discoveryActive, false, 'switching away stops Spark discovery');
    assert.equal(service.stops, estStops, 'Spark switch must not send EST stop commands');
    await assert.rejects(session.operation(() => {}, 'spark-usb'), /NOT_READY/);
    const readGate = deferred();
    let lateFinished = false;
    const background = session.background(async () => { await readGate.promise; lateFinished = true; });
    const changing = session.select({hardwareId: 'new-ai'});
    assert.throws(() => session.background(() => null), /BUSY/);
    const beforeDisconnect = service.disconnects;
    await Promise.resolve();
    assert.equal(service.disconnects, beforeDisconnect, 'switch waits for old discovery/status work');
    readGate.resolve(); await background; await changing;
    assert.ok(lateFinished);
    assert.equal(session.hardwareId, 'new-ai');
    assert.equal(newService.discoveryActive, true, 'NEW AI selection activates its isolated USB discovery');
    assert.throws(() => session.requireAdapter('spark-usb'), /NOT_READY/);
    session.requireAdapter('new-usb');
    assert.equal(service.disconnects, beforeDisconnect + 1);
    await session.select({hardwareId: 'est'});
    assert.equal(newService.discoveryActive, false);
    assert.equal(newService.disconnects, 1, 'switching from NEW AI releases its USB handle');
    assert.equal(newService.stops, 0, 'read-only NEW AI selection never sends program control');
    service.pythonProgramActive = true;
    const stop = service.stopCurrentProgram;
    service.stopCurrentProgram = async () => { throw new Error('STOP failed'); };
    const writesBeforeStopError = writes.length;
    await assert.rejects(session.select({hardwareId: 'new-ai', confirmStop: true}), /STOP failed/);
    assert.equal(session.hardwareId, 'est', 'failed STOP must not change the active hardware');
    assert.equal(session.switching, false);
    assert.equal(service.pauses, 0);
    assert.equal(writes.length, writesBeforeStopError, 'failed STOP must not persist a new selection');
    service.stopCurrentProgram = stop;

    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'est-hardware-drafts-'));
    console.log('Checking hardware draft storage...');
    const store = new HardwareDraftStore(directory);
    try {
        console.log('Checking persistent hardware selection...');
        const filename = path.join(directory, 'selection.json');
        const preferences = new HardwareSelectionPreferences(filename);
        assert.equal(preferences.read(), 'est', 'first install defaults to EST');
        for (const hardwareId of ['spark-ai', 'new-ai', 'est']) {
            preferences.write(hardwareId);
            const restarted = new HardwareSession({service: fakeService(),
                adapters: {'spark-usb': fakeService()}, stopSources: () => {}, isFirmwareBusy: () => false,
                preferences: new HardwareSelectionPreferences(filename)});
            assert.equal(restarted.getState().hardwareId, hardwareId, 'a new process restores the saved hardware');
            assert.deepStrictEqual(JSON.parse(fs.readFileSync(filename, 'utf8')), {version: 1, hardwareId});
            invoke.handler = async channel => {
                assert.equal(channel, 'hardware-state', 'bootstrap must not switch or send device commands');
                return restarted.getState();
            };
            assert.equal(await initializeHardwareSelection(), hardwareId);
            assert.equal(getHardwareContext().profile.id, hardwareId);
            const initial = createEstDefaultProjectData();
            assert.equal(readProjectHardware(initial).id, hardwareId);
            const blocks = Object.values(initial.targets[1].blocks);
            assert.equal(blocks.length, 1);
            if (blocks.length) assert.equal(blocks[0].opcode,
                ({'spark-ai': 'spark_event_whenflagclicked', 'new-ai': 'new_event_whenflagclicked',
                    est: 'event_program_start'})[hardwareId]);
        }
        preferences.write('spark-ai');
        const restoredSpark = fakeService();
        restoredSpark.setDiscoveryActive = active => { restoredSpark.discoveryActive = active; };
        const restoredSession = new HardwareSession({service: fakeService(), adapters: {'spark-usb': restoredSpark},
            stopSources: () => {}, isFirmwareBusy: () => false,
            preferences: new HardwareSelectionPreferences(filename)});
        await restoredSession.select({hardwareId: 'spark-ai'});
        assert.equal(restoredSpark.discoveryActive, true, 'restored Spark selection must activate its discovery');
        assert.equal(restoredSpark.disconnects, 0, 'startup must not disconnect the restored hardware');
        await assert.rejects(restoredSession.select({hardwareId: 'unknown'}), /UNKNOWN/);
        assert.equal(preferences.read(), 'spark-ai');
        for (const corrupt of ['not json', 'null', '{"version":1,"hardwareId":"unknown"}',
            '{"version":2,"hardwareId":"spark-ai"}', ' '.repeat(4097)]) {
            fs.writeFileSync(filename, corrupt);
            assert.equal(new HardwareSelectionPreferences(filename).read(), 'est',
                'invalid saved settings must fall back safely');
        }
        preferences.write('spark-ai');
        assert.throws(() => preferences.write('../escape'), /UNKNOWN/);
        assert.equal(preferences.read(), 'spark-ai');
        assert.ok(!fs.readdirSync(directory).some(name => name.endsWith('.tmp')),
            'atomic persistence must not leave temporary files');
        const failingSession = new HardwareSession({service: fakeService(),
            preferences: {read: () => 'est', write: () => { throw new Error('Disk full'); }},
            stopSources: () => {}, isFirmwareBusy: () => false});
        await assert.rejects(failingSession.select({hardwareId: 'new-ai'}), /Disk full/);
        assert.equal(failingSession.hardwareId, 'est', 'a settings write failure must not commit a new hardware ID');
        assert.equal(failingSession.getState().busy, false);
        setHardwareContext('spark-ai');
        invoke.handler = async () => { throw new Error('IPC failed'); };
        await assert.rejects(initializeHardwareSelection(), /IPC failed/);
        assert.equal(getHardwareContext().profile.id, 'spark-ai', 'failed bootstrap must not silently choose EST');
        invoke.handler = async () => ({hardwareId: 'unknown'});
        await assert.rejects(initializeHardwareSelection(), /UNKNOWN/);
        assert.equal(getHardwareContext().profile.id, 'spark-ai');
        setHardwareContext('est');
        assert.equal(await store.read('est'), null);
        await store.write({hardwareId: 'est', title: 'original', data: new Uint8Array([1, 2])});
        await store.write({hardwareId: 'est', title: 'edited', data: new Uint8Array([3, 4])});
        const reopened = await new HardwareDraftStore(directory).read('est');
        assert.equal(reopened.title, 'edited');
        assert.deepStrictEqual(Array.from(reopened.data), [3, 4]);
        await assert.rejects(store.write({hardwareId: '../escape', data: new Uint8Array([1])}), /UNKNOWN/);
        await assert.rejects(store.write({hardwareId: 'est', data: new Uint8Array()}), /INVALID/);
        const savedFile = path.join(directory, 'user-project.sb3');
        fs.writeFileSync(savedFile, 'saved project');
        for (const item of HARDWARE_PROFILES) {
            await store.write({hardwareId: item.id, data: new Uint8Array([1])});
        }
        await store.clear();
        await store.clear();
        for (const item of HARDWARE_PROFILES) assert.equal(await store.read(item.id), null);
        assert.equal(fs.readFileSync(savedFile, 'utf8'), 'saved project', 'clearing drafts cannot remove saved projects');
    } finally { fs.rmSync(directory, {recursive: true, force: true}); }

    const drafts = new Map([['est', {title: 'old EST'}], ['spark-ai', {title: 'old Spark'}]]);
    const requests = [];
    console.log('Checking confirmed draft discard...');
    const rendererService = fakeService();
    let rendererPreference = 'est';
    const rendererSession = new HardwareSession({service: rendererService, stopSources: () => {}, isFirmwareBusy: () => false,
        preferences: {read: () => rendererPreference, write: id => { rendererPreference = id; }}});
    invoke.handler = async (channel, argument) => {
        requests.push(channel);
        if (channel === 'hardware-state') return rendererSession.getState();
        if (channel === 'hardware-select') return rendererSession.select(argument);
        if (channel === 'hardware-drafts-clear') { drafts.clear(); return; }
        throw new Error('Unexpected draft access: ' + channel);
    };
    setHardwareContext('est');
    let project = createEstDefaultProjectData('est');
    project.targets[0].variables.original = ['original', 123];
    const vm = {runtime: {estStudioHardwareId: 'est'},
        toJSON: () => JSON.stringify(serializeHardwareProject(project, vm.runtime)),
        saveProjectSb3: async () => ({arrayBuffer: async () => Buffer.from(vm.toJSON())}),
        loadProject: async input => {
            const parsed = JSON.parse(typeof input === 'string' ? input : Buffer.from(input).toString());
            await loadHardwareProject(vm, parsed, async () => { project = parsed; });
        }};
    let title = 'Original EST';
    const switchTo = hardwareId => switchHardwareWorkspace({vm, hardwareId, title, setTitle: next => { title = next; }});
    const original = vm.toJSON();
    confirm.response = 1;
    const promptCount = confirm.messages.length;
    await switchTo('est');
    assert.equal(confirm.messages.length, promptCount, 'same hardware does not prompt');
    await assert.rejects(switchTo('spark-ai'), /CANCELLED/);
    assert.equal(vm.toJSON(), original);
    assert.equal(title, 'Original EST');
    assert.equal(drafts.size, 2, 'cancel leaves old drafts intact');
    assert.ok(!requests.includes('hardware-drafts-clear'));
    assert.equal(rendererPreference, 'est');

    confirm.response = 0;
    await switchTo('spark-ai');
    assert.equal(vm.runtime.estStudioHardwareId, 'spark-ai');
    assert.equal(drafts.size, 0);
    assert.equal(project.targets[0].variables.original, undefined);
    project.targets[0].variables.spark = ['spark', 321];
    title = 'Spark draft';
    await switchTo('new-ai');
    await switchTo('spark-ai');
    assert.equal(project.targets[0].variables.spark, undefined, 'switching back must open a fresh project');
    assert.notEqual(title, 'Spark draft');
    await switchTo('est');
    assert.equal(project.targets[0].variables.original, undefined, 'old EST content must never reappear');
    assert.ok(!requests.includes('hardware-draft-read') && !requests.includes('hardware-draft-write'),
        'switching never reads or creates persistent device drafts');

    const before = vm.toJSON();
    await assert.rejects(loadHardwareProject(vm, {meta: {estStudio: {version: 1, hardwareId: 'unknown'}}},
        () => { throw new Error('must not clear'); }), /UNKNOWN/);
    assert.equal(vm.toJSON(), before);
    const invalid = createEstDefaultProjectData('spark-ai');
    invalid.deviceExtensions = ['vision'];
    await assert.rejects(loadHardwareProject(vm, invalid, () => { throw new Error('must not clear'); }), /EXTENSION/);
    rendererService.pythonProgramActive = true;
    confirm.responses = [0, 1];
    const clearCount = requests.filter(channel => channel === 'hardware-drafts-clear').length;
    await assert.rejects(switchTo('new-ai'), /CANCELLED/);
    assert.equal(vm.toJSON(), before);
    assert.equal(rendererPreference, 'est');
    assert.equal(requests.filter(channel => channel === 'hardware-drafts-clear').length, clearCount,
        'declining the device stop also preserves drafts');
    confirm.response = 0;
    await switchTo('new-ai');
    assert.equal(rendererService.stops, 1);

    const snapshotGate = deferred();
    const realSave = vm.saveProjectSb3;
    vm.saveProjectSb3 = async () => { await snapshotGate.promise; return realSave(); };
    const pendingSwitch = switchTo('spark-ai');
    await assert.rejects(loadHardwareProject(vm, createEstDefaultProjectData('est'),
        () => { throw new Error('must not replace workspace during confirmation/snapshot'); }), /BUSY/);
    snapshotGate.resolve(); await pendingSwitch;
    vm.saveProjectSb3 = realSave;
    const realInvoke = invoke.handler;
    const beforeClearError = vm.toJSON();
    const titleBeforeError = title;
    invoke.handler = async (channel, argument) => {
        if (channel === 'hardware-drafts-clear') throw new Error('HARDWARE_DRAFT_CLEAR');
        return realInvoke(channel, argument);
    };
    await assert.rejects(switchTo('est'), /HARDWARE_DRAFT_CLEAR/);
    assert.equal(vm.toJSON(), beforeClearError, 'clear failure restores the previous workspace');
    assert.equal(title, titleBeforeError);
    assert.equal(rendererPreference, 'spark-ai');
    invoke.handler = realInvoke;
    await switchTo('est');
    await assert.rejects(loadHardwareProject(vm, createEstDefaultProjectData('spark-ai'),
        () => { throw new Error('Corrupt project'); }), /Corrupt project/);
    assert.equal(rendererSession.hardwareId, 'est');
    assert.equal(rendererPreference, 'est');

    const fileProject = createEstDefaultProjectData('spark-ai');
    fileProject.targets[0].variables.fileOnly = ['fileOnly', 777];
    const savedFile = JSON.stringify(fileProject);
    await vm.loadProject(savedFile);
    assert.equal(project.targets[0].variables.fileOnly[1], 777);
    await switchTo('new-ai');
    await switchTo('spark-ai');
    assert.equal(project.targets[0].variables.fileOnly, undefined, 'file content is not retained as a device draft');
    await vm.loadProject(savedFile);
    assert.equal(project.targets[0].variables.fileOnly[1], 777, 'the explicitly saved project can still be reopened');
    assert.equal(JSON.stringify(fileProject), savedFile);
    const beforeBusy = confirm.messages.length;
    rendererSession.operations++;
    await assert.rejects(switchTo('est'), /BUSY/);
    rendererSession.operations--;
    assert.equal(confirm.messages.length, beforeBusy, 'busy operation does not show a discard dialog');

    // Manual Python drafts use the same explicit discard boundary.
    const {attachHardwareCodeDrafts} = require('../src/renderer/hardware/code-drafts');
    const {HARDWARE_DRAFTS_DISCARDED_EVENT} = require('../src/renderer/hardware/context');
    const previousWindow = global.window;
    const previousCustomEvent = global.CustomEvent;
    global.window = new EventTarget();
    global.CustomEvent = class extends Event { constructor (type, options = {}) { super(type); this.detail = options.detail; } };
    try {
        setHardwareContext('est');
        const editor = {props: {isCodeEditorLocked: false, codeEditorValue: 'old handwritten EST'},
            workspaceToCode: () => 'generated ' + getHardwareContext().profile.id};
        editor.props.onToggleHardwareCodeLock = () => { editor.props.isCodeEditorLocked = !editor.props.isCodeEditorLocked; };
        editor.props.onSetCodeEditorValue = value => { editor.props.codeEditorValue = value; };
        const detach = attachHardwareCodeDrafts(editor);
        setHardwareContext('est', true); setHardwareContext('spark-ai');
        editor.props.isCodeEditorLocked = false;
        editor.props.codeEditorValue = 'old handwritten Spark';
        setHardwareContext('spark-ai', true); setHardwareContext('est');
        assert.equal(editor.props.codeEditorValue, 'old handwritten EST');
        window.dispatchEvent(new CustomEvent(HARDWARE_DRAFTS_DISCARDED_EVENT));
        assert.equal(editor.props.isCodeEditorLocked, true);
        assert.equal(editor.props.codeEditorValue, 'generated est');
        setHardwareContext('est', true); setHardwareContext('spark-ai');
        assert.equal(editor.props.isCodeEditorLocked, true);
        assert.equal(editor.props.codeEditorValue, 'generated spark-ai', 'discard clears handwritten drafts for every device');
        detach();
    } finally {
        global.window = previousWindow;
        global.CustomEvent = previousCustomEvent;
    }
    console.log('Hardware selection passed: confirmation/cancel, empty target workspaces, no legacy draft restoration, draft-only cleanup, manual Python reset, rollback and saved project reopening.');
})().catch(error => { console.error(error); process.exitCode = 1; });
