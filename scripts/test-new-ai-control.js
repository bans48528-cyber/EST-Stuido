/* eslint-disable global-require, require-await */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const {EventEmitter} = require('events');
const babel = require('@babel/core');
const root = path.resolve(__dirname, '..');
const original = Module._extensions['.js'];
Module._extensions['.js'] = (module, filename) => {
    if (!filename.startsWith(path.join(root, 'src'))) return original(module, filename);
    module._compile(babel.transformSync(fs.readFileSync(filename, 'utf8'), {
        babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs']
    }).code, filename);
};
const {NewAiDeviceService} = require('../src/main/new-ai/device-service');
const {HardwareSession} = require('../src/main/hardware/session');
const {newAiFrame, NEW_COMMAND: C} = require('../src/main/new-ai/protocol');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
// Use an original compiler fixture as the fake compiler output, not fabricated executable instructions.
const bytes = Buffer.from(require('./new-ai-compiler-fixtures.json')[1].bytecodeHex, 'hex');
class Transport extends EventEmitter {
    constructor (options) {
        super(); this.options = options; this.running = Boolean(options.running); this.frames = [];
    }
    async open () {
        this.report();
        if (!this.options.silent) this.timer = setInterval(() => this.report(), 3);
    }
    report (running = this.running) {
        this.running = running;
        const monitor = {version: 321,
            NewAiState: running ? 'run' : 'stop',
            deviceList: Array.from({length: 8}, (_, port) => ({port}))};
        this.emit('data', Buffer.from(`${JSON.stringify(monitor)}\r\n`));
    }
    async write (frame) {
        this.frames.push(frame);
        if (this.options.onWrite && this.options.onWrite(this, frame) === false) return;
        if (frame[4] === C.STOP_TOGGLE) {
            if (!this.options.ignoreStop) {
                this.report(false); this.report(false);
            }
            return;
        }
        if (frame[4] === C.SAVE_RUN && !this.options.noStart) {
            this.report(true);
            if (this.options.shortRun) this.report(false);
        }
        this.emit('data', newAiFrame(C.ACK, [1]));
    }
    async close () {
        clearInterval(this.timer); this.closed = true; this.emit('closed');
    }
}
const create = async (options = {}) => {
    const transport = new Transport(options);
    const service = new NewAiDeviceService({compiler: {supported: true, compile: async () => bytes},
        listPorts: async () => [{path: 'COM_CONTROL', vendorId: '0483', productId: '5740'}],
        createTransport: () => transport,
        timeouts: {fresh: 50, start: 40, stop: 50, ack: 40, write: 40, ...options.timeouts}});
    await service.connect({path: 'COM_CONTROL'});
    return {service, transport};
};
(async () => {
    for (const shortRun of [false, true]) {
        const {service, transport} = await create({shortRun});
        try {
            const result = await service.runProgram({source: 'print(1)', slot: 19});
            assert.equal(result.downloaded, true); assert.equal(result.startRequested, true);
            assert.equal(result.runObserved, true, 'RUN before the final ACK must be captured');
            assert.equal(transport.frames.at(-1)[4], C.SAVE_RUN);
            assert.ok(!transport.frames.some(frame => frame[4] === C.STOP_TOGGLE || frame[4] === 0xB6));
            assert.equal(service.pythonProgramActive, !shortRun);
        } finally {
            await service.shutdown();
        }
    }
    {
        const {service, transport} = await create({noStart: true});
        try {
            const result = await service.runProgram({source: 'print(1)', slot: 0});
            assert.equal(result.downloaded, true); assert.equal(result.runObserved, false);
            assert.equal(service.getState().warning, null, 'missing RUN is not a failed file save');
            const frames = transport.frames.length;
            await pause(25);
            assert.equal(transport.frames.length, frames, 'a start timeout must not resend anything');
            transport.report(true);
            assert.equal(service.getState().result.runObserved, true, 'late RUN reconciles the result');
        } finally {
            await service.shutdown();
        }
    }
    {
        const {service, transport} = await create({onWrite: (t, frame) => {
            if (frame[4] === C.SAVE_RUN) {
                t.emit('data', newAiFrame(C.ACK, [1]));
                setTimeout(() => t.report(true), 5);
                return false;
            }
        }});
        try {
            assert.equal((await service.runProgram({source: 'print(1)', slot: 0})).runObserved, true);
            assert.equal(transport.frames.filter(frame => frame[4] === C.SAVE_RUN).length, 1);
        } finally {
            await service.shutdown();
        }
    }
    {
        const {service, transport} = await create({noStart: true});
        try {
            const starting = service.runProgram({source: 'print(1)', slot: 0});
            const rejected = assert.rejects(starting, /NEW_START_WAIT_CANCELLED/);
            for (let i = 0; i < 50 && service.operation.progress.phase !== 'starting'; i++) await pause(1);
            service.cancel();
            await rejected;
            assert.equal(service.getState().result.downloaded, true);
            assert.equal(service.getState().warning, null);
            assert.equal(transport.frames.at(-1)[4], C.SAVE_RUN);
            transport.report(true);
            assert.equal(service.getState().result.runObserved, true);
        } finally {
            await service.shutdown();
        }
    }
    {
        const {service, transport} = await create({running: true});
        try {
            const stopping = service.stopCurrentProgram();
            await assert.rejects(service.stopCurrentProgram(), /NEW_BUSY/);
            assert.equal((await stopping).stopObserved, true);
            assert.equal(transport.frames.length, 1);
            assert.equal(transport.frames[0].toString('hex'), '5a979801b90144a5');
            await service.stopCurrentProgram();
            assert.equal(transport.frames.length, 1, 'stopping an idle device must never toggle it on');
        } finally {
            await service.shutdown();
        }
    }
    {
        const {service, transport} = await create({running: true, ignoreStop: true});
        try {
            await assert.rejects(service.stopCurrentProgram(), /NEW_STOP_UNCONFIRMED/);
            assert.equal(service.getState().stopAttemptPending, true);
            await assert.rejects(service.stopCurrentProgram(), /NEW_STOP_UNCONFIRMED/);
            assert.equal(transport.frames.length, 1, 'a stop timeout must not resend a toggle');
            transport.report(false); transport.report(true);
            transport.options.ignoreStop = false;
            await service.stopCurrentProgram();
            assert.equal(transport.frames.length, 2, 'a new observed run generation can be stopped');
        } finally {
            await service.shutdown();
        }
    }
    {
        const {service, transport} = await create({running: true, silent: true});
        try {
            await assert.rejects(service.stopCurrentProgram(), /NEW_STATUS_STALE/);
            assert.equal(transport.frames.length, 0, 'a cached RUN cannot authorize a toggle');
        } finally {
            await service.shutdown();
        }
    }
    {
        const {service, transport} = await create({running: true, silent: true});
        try {
            const stopping = service.stopCurrentProgram();
            transport.report(true);
            await pause(0);
            transport.report(false);
            const result = await stopping;
            assert.equal(result.alreadyStopped, true);
            assert.equal(transport.frames.length, 0, 'natural completion during preflight never sends stop');
        } finally {
            await service.shutdown();
        }
    }
    {
        const {service, transport} = await create({running: true, silent: true});
        try {
            const stopping = service.stopCurrentProgram();
            const rejected = assert.rejects(stopping, /NEW_CANCELLED/);
            transport.report(true);
            await pause(0);
            transport.report(true);
            service.cancel();
            await rejected;
            assert.equal(transport.frames.length, 0, 'cancelled preflight must not send a toggle');
            assert.equal(service.listenerCount('monitor'), 0);
            assert.equal(service.listenerCount('connection-lost'), 0);
        } finally {
            await service.shutdown();
        }
    }
    for (const cancel of [true, false]) {
        const {service, transport} = await create({running: true, ignoreStop: true});
        try {
            const stopping = service.stopCurrentProgram();
            const rejected = assert.rejects(stopping, cancel ? /NEW_STOP_WAIT_CANCELLED/ : /NEW_/);
            for (let i = 0; i < 50 && !transport.frames.length; i++) await pause(2);
            if (cancel) service.cancel(); else transport.emit('closed');
            await rejected;
            assert.equal(transport.frames.length, 1);
            assert.equal(service.listenerCount('monitor'), 0);
            assert.equal(service.listenerCount('connection-lost'), 0);
        } finally {
            await service.shutdown();
        }
    }
    {
        const {service} = await create({onWrite: (t, frame) => {
            if (frame[4] === C.SAVE_RUN) {
                t.emit('data', newAiFrame(C.ERROR, [1])); return false;
            }
        }});
        try {
            await assert.rejects(service.runProgram({source: 'print(1)', slot: 0}), /NEW_RUN_SAVE_FAILED/);
            assert.equal(service.getState().result, null);
            assert.equal(service.getState().warning, 'NEW_DOWNLOAD_INCOMPLETE');
        } finally {
            await service.shutdown();
        }
    }
    {
        const {service, transport} = await create({running: true});
        try {
            const base = {suspendVision () {}, resumeVision () {}, disconnect: async () => {}};
            const session = new HardwareSession({service: base,
                adapters: {'new-usb': service},
                preferences: {read: () => 'new-ai', write () {}},
                stopSources () {},
                isFirmwareBusy: () => false});
            await assert.rejects(session.select({hardwareId: 'est'}), /HARDWARE_RUNNING/);
            const state = await session.select({hardwareId: 'est', confirmStop: true});
            assert.equal(state.hardwareId, 'est');
            assert.equal(transport.frames.filter(frame => frame[4] === C.STOP_TOGGLE).length, 1);
            assert.ok(transport.closed);
        } finally {
            await service.shutdown();
        }
    }
    console.log('NEW AI control passed: BC start, early/short/late RUN, unconfirmed save/run distinction, ' +
        'fresh-state B9 stop, no duplicate toggles, timeout/cancel/disconnect, native completion and hardware switch.');
})().catch(error => {
    console.error(error); process.exitCode = 1;
});
