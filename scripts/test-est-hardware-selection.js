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
const confirm = {response: 1};
Module._extensions['.js'] = (module, filename) => {
    if (!filename.startsWith(path.join(root, 'src'))) return originalLoader(module, filename);
    module._compile(babel.transformSync(fs.readFileSync(filename, 'utf8'), {
        babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs']
    }).code, filename);
};
Module._load = function (name, parent, main) {
    if (name === 'electron') return {ipcRenderer: {invoke: (...args) => invoke.handler(...args)}};
    if (name === '@electron/remote') return {dialog: {showMessageBox: async () => confirm}, getCurrentWindow: () => null};
    return originalRequire.call(this, name, parent, main);
};

const {HARDWARE_PROFILES, getHardwareProfile, readProjectHardware, serializeHardwareProject} =
    require('../src/common/hardware-profiles');
const {HardwareSession} = require('../src/main/hardware/session');
const {HardwareDraftStore} = require('../src/main/hardware/drafts');
const {getHardwareContext, setHardwareContext} = require('../src/renderer/hardware/context');
const {loadHardwareProject, switchHardwareWorkspace} = require('../src/renderer/hardware/project');
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
        assert.equal(profile.adapter, null, 'pending hardware must not inherit EST protocol');
        assert.equal(profile.compiler, id === 'spark-ai' ? 'spark-python' : null);
        assert.equal(profile.programSlots, 0);
        assert.equal(readProjectHardware(createEstDefaultProjectData(id)).id, id);
        const blocks = createEstDefaultProjectData(id).targets[1].blocks;
        if (id === 'spark-ai') assert.equal(Object.values(blocks)[0].opcode, 'spark_event_whenflagclicked');
        else assert.deepStrictEqual(blocks, {});
    }
    for (const dictionary of Object.values(messages)) {
        assert.deepStrictEqual(Object.keys(dictionary).sort(), Object.keys(messages.en).sort());
        Object.values(dictionary).forEach(message => assert.ok(message.trim()));
    }

    const service = fakeService();
    console.log('Checking hardware sessions...');
    let firmwareBusy = false;
    let sourceStops = 0;
    const session = new HardwareSession({service, stopSources: () => { sourceStops++; },
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
    const switched = await session.select({hardwareId: 'spark-ai', confirmStop: true});
    assert.equal(switched.busy, false);
    assert.equal(service.stops, 1);
    assert.equal(sourceStops, 1);
    await assert.rejects(session.operation(() => { throw new Error('must not run'); }), /NOT_READY/);
    await session.select({hardwareId: 'est'});
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
    assert.equal(service.disconnects, beforeDisconnect + 1);
    await session.select({hardwareId: 'est'});
    service.pythonProgramActive = true;
    const stop = service.stopCurrentProgram;
    service.stopCurrentProgram = async () => { throw new Error('STOP failed'); };
    await assert.rejects(session.select({hardwareId: 'new-ai', confirmStop: true}), /STOP failed/);
    assert.equal(session.hardwareId, 'est', 'failed STOP must not change the active hardware');
    assert.equal(session.switching, false);
    assert.equal(service.pauses, 0);
    service.stopCurrentProgram = stop;

    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'est-hardware-drafts-'));
    console.log('Checking hardware draft storage...');
    const store = new HardwareDraftStore(directory);
    try {
        assert.equal(await store.read('est'), null);
        await store.write({hardwareId: 'est', title: 'original', data: new Uint8Array([1, 2])});
        await store.write({hardwareId: 'est', title: 'edited', data: new Uint8Array([3, 4])});
        const reopened = await new HardwareDraftStore(directory).read('est');
        assert.equal(reopened.title, 'edited');
        assert.deepStrictEqual(Array.from(reopened.data), [3, 4]);
        await assert.rejects(store.write({hardwareId: '../escape', data: new Uint8Array([1])}), /UNKNOWN/);
        await assert.rejects(store.write({hardwareId: 'est', data: new Uint8Array()}), /INVALID/);
    } finally { fs.rmSync(directory, {recursive: true, force: true}); }

    const drafts = new Map();
    console.log('Checking workspace switching...');
    const rendererService = fakeService();
    const rendererSession = new HardwareSession({service: rendererService, stopSources: () => {}, isFirmwareBusy: () => false});
    invoke.handler = async (channel, argument) => {
        if (channel === 'hardware-select') return rendererSession.select(argument);
        if (channel === 'hardware-draft-read') return drafts.get(argument) || null;
        if (channel === 'hardware-draft-write') { drafts.set(argument.hardwareId, argument); return; }
        throw new Error(channel);
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
    await switchTo('spark-ai');
    assert.equal(vm.runtime.estStudioHardwareId, 'spark-ai');
    project.targets[0].variables.spark = ['spark', 321];
    title = 'Spark draft';
    await switchTo('new-ai');
    await switchTo('spark-ai');
    assert.equal(project.targets[0].variables.spark[1], 321);
    assert.equal(title, 'Spark draft');
    await switchTo('est');
    assert.equal(project.targets[0].variables.original[1], 123);
    assert.equal(title, 'Original EST');
    const before = vm.toJSON();
    await assert.rejects(loadHardwareProject(vm, {meta: {estStudio: {version: 1, hardwareId: 'unknown'}}},
        () => { throw new Error('must not clear'); }), /UNKNOWN/);
    assert.equal(vm.toJSON(), before);
    const invalid = createEstDefaultProjectData('spark-ai');
    invalid.deviceExtensions = ['vision'];
    await assert.rejects(loadHardwareProject(vm, invalid, () => { throw new Error('must not clear'); }), /EXTENSION/);
    rendererService.pythonProgramActive = true;
    confirm.response = 1;
    await assert.rejects(switchTo('new-ai'), /CANCELLED/);
    assert.equal(vm.toJSON(), before);
    assert.equal(getHardwareContext().profile.id, 'est');
    confirm.response = 0;
    await switchTo('new-ai');
    assert.equal(rendererService.stops, 1);
    assert.equal(getHardwareContext().busy, false);
    const diskGate = deferred();
    const realInvoke = invoke.handler;
    invoke.handler = async (channel, argument) => {
        if (channel === 'hardware-draft-read') await diskGate.promise;
        return realInvoke(channel, argument);
    };
    const diskSwitch = switchTo('spark-ai');
    await assert.rejects(loadHardwareProject(vm, createEstDefaultProjectData('est'),
        () => { throw new Error('must not replace workspace during draft IO'); }), /BUSY/);
    diskGate.resolve(); await diskSwitch;
    invoke.handler = realInvoke;
    const beforeDiskError = vm.toJSON();
    invoke.handler = async (channel, argument) => {
        if (channel === 'hardware-draft-write') throw new Error('Disk full');
        return realInvoke(channel, argument);
    };
    await assert.rejects(switchTo('est'), /Disk full/);
    assert.equal(vm.toJSON(), beforeDiskError);
    invoke.handler = realInvoke;
    await switchTo('est');
    console.log('Hardware selection passed: legacy migration, target isolation, draft recovery, busy transfers, confirmed stop and stale background requests.');
})().catch(error => { console.error(error); process.exitCode = 1; });
