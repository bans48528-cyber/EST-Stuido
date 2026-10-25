/* eslint-disable global-require */
// Explicit acceptance test. Default: generate/compile only. --execute writes the selected hardware slot.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');
const {StringDecoder} = require('string_decoder');
const babel = require('@babel/core');
const root = path.resolve(__dirname, '..');
const loader = Module._extensions['.js'];
Module._extensions['.js'] = (module, filename) => {
    if (!filename.startsWith(path.join(root, 'src'))) return loader(module, filename);
    module._compile(babel.transformSync(fs.readFileSync(filename, 'utf8'), {
        babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs']
    }).code, filename);
};
const {registerNewPythonGenerator} = require('../src/renderer/new-ai/python-generator');
const {NewAiCompiler} = require('../src/main/new-ai/compiler');
const {NewAiDeviceService} = require('../src/main/new-ai/device-service');
const {NewAiSerialTransport, newAiPortIdentity} = require('../src/main/new-ai/serial-transport');
const catalog = require('../src/renderer/new-ai/catalog.json');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

// Use the production generator and its real Blockly traversal/task finisher, with headless block containers.
const makeProgram = (seconds, colour) => {
    const B = {INPUT_VALUE: 1,
        LIST_VARIABLE_TYPE: 'list',
        Variables: {NAME_TYPE: 'variable', allVariables: workspace => workspace.getAllVariables()},
        Procedures: {NAME_TYPE: 'procedure'}};
    const goog = {provide () {},
        require () {},
        isArray: Array.isArray,
        isString: value => typeof value === 'string',
        isNumber: value => typeof value === 'number',
        asserts: {assert: assert.ok,
            assertFunction: value => assert.equal(typeof value, 'function'),
            assertArray: value => assert.ok(Array.isArray(value)),
            assertString: value => assert.equal(typeof value, 'string'),
            fail: assert.fail}};
    vm.runInNewContext(fs.readFileSync(require.resolve('openblock-blocks/core/generator.js'), 'utf8'),
        {Blockly: B, goog});
    B.Python = new B.Generator('Python');
    registerNewPythonGenerator(B);
    const graph = {hat: null};
    const workspace = {blockDB_: {},
        getVariableMap: () => ({getVariableById: () => null}),
        getAllVariables: () => [],
        getTopBlocks: () => [graph.hat]};
    let nextId = 0;
    const make = (type, fields = {}, output = false, parent = null) => {
        const block = {id: `new-usb-${nextId++}`,
            type: `new_${type}`,
            fields,
            parent,
            children: {},
            disabled: false,
            outputConnection: output ? {} : null,
            previousConnection: type === 'event_whenflagclicked' ? null : {},
            next: null,
            inputList: [],
            workspace,
            getFieldValue (key) {
                return this.fields[key];
            },
            getInputTargetBlock (key) {
                return this.children[key] || null;
            },
            getSurroundParent () {
                return this.outputConnection ? this.parent : null;
            },
            getRootBlock: () => graph.hat,
            getTopStackBlock: () => graph.hat,
            getOutputShape: () => null,
            getCommentText: () => '',
            getDescendants: () => [],
            getNextBlock () {
                return this.next;
            }};
        block.nextConnection = {targetBlock: () => block.next};
        workspace.blockDB_[block.id] = block;
        return block;
    };
    const row = (id, fields = {}) => {
        const definition = catalog.blocks.find(item => item.id === id);
        const block = make(id, {...definition.fields, ...fields});
        definition.inputs.forEach(input => {
            const child = make(input.type, input.fields, true, block);
            block.children[input.name] = child;
            block.inputList.push({name: input.name, type: 1, connection: {targetBlock: () => child}});
        });
        return block;
    };
    const hat = row('event_whenflagclicked');
    graph.hat = hat;
    const image = ['0011100', '0100010', '1000001', '1010101', '1000001',
        '1010101', '1001001', '0100010', '0011100'].join('');
    const display = row('matrix_lamp', {lamp: image});
    display.children.COLOR.fields = {COLOUR: colour};
    const wait = row('control_wait');
    wait.children.DURATION.fields = {NUM: String(seconds)};
    const clear = row('matrix_lamp_stop');
    hat.next = display; display.next = wait; wait.next = clear;
    const source = B.NewPython.workspaceToCode(workspace);
    assert.ok(source.includes('_thread.start_new_thread(task0, ())'));
    assert.ok(source.includes('_matrix.show(') && source.includes('_matrix.clear()'));
    assert.ok(source.includes(`_os.sleep_s(${seconds})`));
    assert.ok(!/\b_(motor|music|mem|color|ultrasion|touch|key|gray|nfc|camer|grayv2)\b/.test(source));
    const allowedCalls = new Set(['_matrix.show', '_matrix.clear', '_os.sleep_s',
        '_os.clear_thread', '_thread.start_new_thread']);
    for (const call of source.matchAll(/\b([a-zA-Z_][\w.]*)\s*\(/g)) {
        assert.ok(allowedCalls.has(call[1]) || call[1] === 'task0', `unexpected fixture call ${call[1]}`);
    }
    return source;
};

(async () => {
    const args = process.argv.slice(2);
    const argument = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
    const port = argument('--port', 'COM13');
    const slot = Number(argument('--slot', '19'));
    assert.ok(Number.isInteger(slot) && slot >= 0 && slot < 20);
    const output = argument('--output', null);
    const sources = {long: makeProgram(60, '#004000'), short: makeProgram(2, '#000040')};
    const compiler = new NewAiCompiler();
    const compiled = {};
    for (const [name, source] of Object.entries(sources)) {
        const bytes = await compiler.compile(source);
        compiled[name] = {bytes: bytes.length};
    }
    if (output) {
        fs.mkdirSync(output, {recursive: true});
        for (const [name, source] of Object.entries(sources)) {
            fs.writeFileSync(path.join(output, `${name}.py`), source, {flag: 'wx'});
        }
    }
    console.log(JSON.stringify({phase: 'compiled', compiled, motorCalls: 0, slot}));
    if (!args.includes('--execute')) return;
    const start = Date.now();
    const report = {softwareVersion: require('../package.json').version,
        port,
        slot,
        motorCalls: 0,
        compiled,
        phases: [],
        transitions: [],
        writes: {},
        runtimeErrors: []};
    const record = (phase, details = {}) => {
        const item = {phase, elapsedMs: Date.now() - start, ...details};
        report.phases.push(item); console.log(JSON.stringify(item));
    };
    const debug = [];
    let testRunMayBeActive = false;
    const device = new NewAiDeviceService({createTransport: devicePort => {
        const transport = new NewAiSerialTransport(devicePort); const decoder = new StringDecoder('utf8');
        let pending = '';
        transport.on('data', bytes => {
            pending += decoder.write(bytes);
            let end;
            while ((end = pending.indexOf('\n')) >= 0) {
                const line = pending.slice(0, end); pending = pending.slice(end + 1);
                if (/Traceback|(?:Syntax|Name|Runtime|Attribute|Type|Assertion)Error|Error:/i.test(line)) {
                    if (debug.length < 30) debug.push(line.slice(0, 1000));
                }
            }
            pending = pending.slice(-16384);
        });
        const write = transport.write.bind(transport);
        transport.write = frame => {
            const command = frame[4].toString(16);
            report.writes[command] = (report.writes[command] || 0) + 1;
            assert.ok([0xDA, 0xAA, 0xBB, 0xBC, 0xB9].includes(frame[4]), 'unexpected hardware command');
            if (frame[4] === 0xBC) testRunMayBeActive = true;
            return write(frame);
        };
        return transport;
    }});
    let previousRunning;
    device.on('monitor', monitor => {
        if (monitor.running === previousRunning) return;
        previousRunning = monitor.running;
        report.transitions.push({running: monitor.running, elapsedMs: Date.now() - start});
    });
    try {
        const state = await device.connect({path: port});
        assert.equal(state.status.version, 321); assert.equal(state.status.running, false);
        assert.equal(Boolean(state.status.legacyProtocol), false);
        const identity = newAiPortIdentity(device.previousDevice);
        record('connected', {version: state.status.version, ports: state.status.ports.length});
        const baseline = report.transitions.length;
        const saved = await device.downloadProgram({source: sources.long, slot});
        assert.equal(saved.downloaded, true); assert.ok(!saved.startRequested);
        await pause(1000);
        assert.equal(device.monitor.running, false);
        assert.ok(!report.transitions.slice(baseline).some(event => event.running));
        assert.equal(report.writes.bc || 0, 0);
        record('download-only-confirmed', {bytes: saved.size, running: false});
        const running = await device.runProgram({source: sources.long, slot});
        assert.equal(running.runObserved, true);
        await pause(1200);
        assert.equal(device.monitor.running, true, 'long program must still be running before explicit stop');
        record('run-confirmed', {bytes: running.size});
        const stopStart = Date.now();
        const stopped = await device.stopCurrentProgram();
        assert.equal(stopped.stopObserved, true); assert.ok(!stopped.alreadyStopped);
        const stopMs = Date.now() - stopStart;
        assert.equal(report.writes.b9, 1);
        await pause(700);
        assert.equal(device.monitor.running, false);
        assert.equal((await device.stopCurrentProgram()).alreadyStopped, true);
        assert.equal(report.writes.b9, 1, 'idle stop must not toggle the device on');
        testRunMayBeActive = false;
        record('stop-confirmed', {stopMs, idleStopSentNoCommand: true});
        const short = await device.runProgram({source: sources.short, slot});
        assert.equal(short.runObserved, true);
        await device.waitForMonitor(monitor => !monitor.running, {count: 2, timeout: 8000});
        testRunMayBeActive = false;
        assert.equal(report.writes.b9, 1, 'natural completion must not send a stop toggle');
        record('natural-completion-confirmed');
        await device.downloadProgram({source: sources.long, slot});
        await device.disconnect({pauseAuto: false});
        const ports = await device.listDevices();
        const selected = ports.filter(candidate => newAiPortIdentity(candidate) === identity);
        assert.equal(selected.length, 1);
        const reopened = await device.connect({path: selected[0].path});
        assert.equal(reopened.status.version, 321); assert.equal(reopened.status.running, false);
        assert.deepStrictEqual(debug, [], 'runtime errors must not be hidden by RUN status');
        record('reconnect-confirmed', {port: selected[0].path,
            version: 321,
            running: false,
            retainedTestSlot: slot,
            retainedTestSeconds: 60});
        Object.assign(report, {passed: true});
    } catch (error) {
        Object.assign(report, {passed: false, error: error.message});
        if (testRunMayBeActive && device.connected && device.monitor && device.monitor.running &&
            !device.getState().stopAttemptPending) {
            await device.stopCurrentProgram().catch(stopError => {
                report.cleanupStopError = stopError.message;
            });
        }
        throw error;
    } finally {
        Object.assign(report, {runtimeErrors: debug, checkedAt: new Date().toISOString()});
        if (output) fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(report, null, 2), {flag: 'wx'});
        await device.shutdown();
    }
})().catch(error => {
    console.error(error.stack || error.message); process.exitCode = 1;
});
