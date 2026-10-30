/* eslint-disable global-require, require-await, max-len */
const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const Module = require('module');
const {EventEmitter} = require('events');
const babel = require('@babel/core');
const root = path.resolve(__dirname, '..');
const loader = Module._extensions['.js'];
Module._extensions['.js'] = (module, filename) => {
    if (!filename.startsWith(path.join(root, 'src'))) return loader(module, filename);
    module._compile(babel.transformSync(fs.readFileSync(filename, 'utf8'), {
        babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs']
    }).code, filename);
};
const {NewAiDeviceService} = require('../src/main/new-ai/device-service');
const {NewAiFirmwareUpdateService, getNewAiFirmwareRoot} = require('../src/main/new-ai/firmware-update-service');
const {NewAiFirmwareLink} = require('../src/main/new-ai/firmware-link');
const {newAiFirmwareBlockers} = require('../src/common/new-ai-firmware');
const {NewAiStreamParser, normalizeNewAiLegacyMonitor} = require('../src/main/new-ai/protocol');
const {HardwareSession} = require('../src/main/hardware/session');
const release = require('../src/main/new-ai/firmware-release.json');
const legacy = require('./new-ai-legacy-monitor-fixture.json');
const ACK = Buffer.from('5a989701fd0188a5', 'hex'); // Boot1 SendCOMdata(): reversed response addresses.
const ERROR = Buffer.from('5a989700fe87a5', 'hex'); // strlen("\0") yields a zero-length FE error.
const request = {releaseId: release.id, confirmedErase: true, recovery: false};
const monitor = version => ({version, NewAiState: 'stop', deviceList: Array.from({length: 8}, (_, port) => ({port}))});
const commands = {218: 'app', 219: 'boot', 220: 'config', 221: 'version', 236: 'music'};
class Transport extends EventEmitter {
    constructor (hardware) {
        super(); this.h = hardware;
    }
    async open () {
        this.h.opens = (this.h.opens || 0) + 1;
        if (this.h.retainUsb && this.h.mode === 'boot') throw Error('Existing boot handle must be retained');
        if (this.h.mode === 'app') {
            this.report(); this.timer = setInterval(() => this.report(), 5);
        }
    }
    report () {
        if (this.closed) return;
        const m = this.h.wrongProduct ? {version: 110, WillAiState: 'stop', deviceList: [{}, {}, {}, {}]} :
            (this.h.legacy ? legacy : {...monitor(this.h.version), NewAiState: this.h.running ? 'run' : 'stop'});
        this.emit('data', Buffer.from(`${JSON.stringify(m)}\r\n`));
    }
    async close () {
        if (this.closed) return;
        clearInterval(this.timer); this.closed = true; this.emit('closed');
    }
    async write (frame) {
        const h = this.h; const command = frame[4]; const payload = frame.subarray(5, -2);
        assert.equal(frame.subarray(0, 3).toString('hex'), '5a9798');
        assert.equal(frame[3], payload.length);
        assert.equal(frame.at(-1), 0xA5);
        assert.equal(frame.at(-2), frame.subarray(0, -2).reduce((s, b) => (s + b) & 255, 0));
        h.writes.push(Buffer.from(frame));
        if (h.mode === 'app') {
            assert.equal(command, 0x6F);
            assert.equal(payload.toString('ascii'), 'RESET_FWLIB');
            if (h.retainUsb) {
                this.report(); // A final APP report must not be mistaken for the new boot session.
                clearInterval(this.timer);
            }
            h.mode = 'boot'; h.files.clear();
            if (!h.retainUsb) await this.close();
            return;
        }
        h.frames++;
        if (h.failAt === h.frames) {
            this.emit('data', ERROR); return;
        }
        if (h.disconnectAt === h.frames) {
            await this.close(); return;
        }
        if (h.timeoutAt === h.frames) return;
        if (commands[command]) {
            h.current = `${commands[command]}/${payload.toString('ascii')}`;
            h.names.push(h.current); h.files.set(h.current, Buffer.alloc(0));
        } else {
            assert.ok([0xAA, 0xBB].includes(command), 'never BC or a program control in Boot mode');
            assert.ok(payload.length > 0 && payload.length <= 248);
            assert.ok(h.current);
            h.files.set(h.current, Buffer.concat([h.files.get(h.current), payload]));
        }
        const ack = h.badAckAt === h.frames ? Buffer.from('5a989701fd0087a5', 'hex') : ACK;
        if (h.corruptAt === h.frames) {
            const bad = Buffer.from(ack); bad[6] ^= 1; this.emit('data', bad); return;
        }
        this.emit('data', ack.subarray(0, 2));
        await new Promise(resolve => setImmediate(resolve));
        this.emit('data', ack.subarray(2));
        if (h.monitorDuringBoot && command === 0xBB) this.report();
        if (command === 0xBB) {
            const last = h.current;
            h.current = null;
            if (last === release.activationFile && !h.noApplication) {
                assert.equal(h.files.size, release.files.length, 'Boot2 may activate only after the whole bundle');
                h.timer = setTimeout(() => {
                    h.mode = 'app'; h.legacy = false; h.version = h.nextVersion || 321; this.close();
                }, 4);
            }
        }
    }
}
const fixture = (options = {}) => {
    const h = {mode: 'app', version: 321, writes: [], files: new Map(), names: [], frames: 0, serial: 'NEW_TEST', ...options};
    const device = new NewAiDeviceService({
        listPorts: async () => [{path: h.mode === 'app' || h.retainUsb ? 'COM_APP' : 'COM_BOOT',
            vendorId: '0483',
            productId: '5740',
            serialNumber: h.serial}],
        createTransport: () => new Transport(h),
        timeouts: {identify: 60, open: 100, close: 100, fresh: 80}});
    const updater = new NewAiFirmwareUpdateService({device,
        getRoot: options.getRoot,
        timeouts: {bootDelay: 1, quiet: 2, boot: 180, application: 200, poll: 2, ack: 70, write: 70, gap: 450}});
    return {h,
        device,
        updater,
        cleanup: async () => {
            if (updater.done) await updater.done.catch(() => {});
            clearTimeout(h.timer); await device.shutdown();
        }};
};
(async () => {
    const status = normalizeNewAiLegacyMonitor(legacy, 123);
    assert.equal(status.version, 214); assert.equal(status.running, null); assert.equal(status.battery, null);
    assert.equal(status.ports.length, 8);
    for (const version of [0, 1, 193, 214, 215, 320, 321, 65535]) {
        assert.equal(normalizeNewAiLegacyMonitor({...legacy, versionlist: {ver: version}}).version, version);
    }
    for (const bad of [{...legacy, versionlist: {ver: 'invalid'}}, {...legacy, NewAiState: 'stop'},
        {...legacy, deviceList: Array(8).fill({port: '0'})}, {...legacy, estlist: null}]) {
        assert.equal(normalizeNewAiLegacyMonitor(bad), null);
    }
    for (const raw of [ACK, ERROR, Buffer.concat([ACK, ACK]), Buffer.from(`${JSON.stringify(legacy)}\r\n`)]) {
        for (let split = 0; split <= raw.length; split++) {
            const parser = new NewAiStreamParser(); const frames = []; const monitors = [];
            parser.on('frame', f => frames.push(f)); parser.on('monitor', m => monitors.push(m));
            parser.push(raw.subarray(0, split)); parser.push(raw.subarray(split));
            if (raw[0] === 0x5A) assert.equal(frames.length, raw.length === 16 ? 2 : 1);
            else assert.equal(monitors[0].version, 214);
        }
    }
    for (const {legacy: legacyMode, running, retainUsb, monitorDuringBoot} of [{legacy: false}, {legacy: true},
        {legacy: false, running: true}, {legacy: true, retainUsb: true, monitorDuringBoot: true}]) {
        const f = fixture({legacy: legacyMode, running, retainUsb, monitorDuringBoot});
        try {
            f.device.result = {stopObserved: true};
            await f.device.connect({path: 'COM_APP'});
            assert.equal(f.device.getState().result, null, 'old stop confirmation cannot survive a new connection');
            if (legacyMode) {
                assert.equal(f.device.getState().programSupported, false);
                assert.equal(f.h.writes.length, 0);
            }
            const report = await f.updater.inspect();
            assert.equal(report.valid, true); assert.equal(report.files.length, 109);
            assert.equal(report.totalBytes, 2116990);
            assert.throws(() => f.updater.start({...request, confirmedErase: false}), /NEW_FW_ERASE_CONFIRM/);
            const updating = f.updater.start({...request, confirmedLegacyIdle: legacyMode});
            await assert.rejects(f.device.compileProgram({source: 'print(1)'}), /NEW_BUSY/);
            await assert.rejects(f.device.disconnect(), /NEW_BUSY/);
            await assert.rejects(f.device.shutdown(), /NEW_BUSY/);
            assert.throws(() => f.device.setAutoConnect(false), /NEW_BUSY/);
            const session = new HardwareSession({service: {},
                adapters: {'new-usb': f.device},
                preferences: {read: () => 'new-ai'},
                isFirmwareBusy: () => f.updater.busy,
                stopSources () {}});
            await assert.rejects(session.select({hardwareId: 'est'}), /HARDWARE_BUSY/);
            const result = await updating;
            assert.equal(result.versionMatched, true); assert.equal(result.imageVerified, false);
            assert.equal(f.device.getState().programSupported, true);
            assert.equal(f.h.names.at(-1), 'app/LB_Boot2.bin');
            for (const file of release.files) {
                assert.deepStrictEqual(f.h.files.get(file.path), fs.readFileSync(path.join(getNewAiFirmwareRoot(), file.path)));
            }
            assert.ok(f.h.frames > 8500);
            if (retainUsb) assert.equal(f.h.opens, 3, 'APP identification and final APP verification/reconnect only');
        } finally {
            await f.cleanup();
        }
    }
    for (const [option, code] of [['failAt', 'NEW_DEVICE_ERROR'], ['badAckAt', 'NEW_ACK_INVALID'],
        ['corruptAt', 'NEW_FRAME_INVALID'], ['disconnectAt', 'NEW_DISCONNECTED'], ['timeoutAt', 'NEW_ACK_TIMEOUT']]) {
        const f = fixture({[option]: 2});
        try {
            await f.device.connect({path: 'COM_APP'});
            await assert.rejects(f.updater.start(request), new RegExp(code));
            assert.equal(f.h.frames, 2, 'failed frames must never be retried');
            assert.equal(f.device.getState().firmware.recoveryRequired, true);
            assert.equal(f.device.connected, false);
            assert.throws(() => f.device.setAutoConnect(true), /NEW_FW_RECOVERY/);
        } finally {
            await f.cleanup();
        }
    }
    const recoveryFixture = fixture({mode: 'boot'});
    try {
        await recoveryFixture.device.listDevices();
        await assert.rejects(recoveryFixture.updater.start({...request, recovery: true, path: 'COM_MISSING'}), /NEW_FW_SELECT_PORT/);
        assert.equal(recoveryFixture.h.writes.length, 0);
        await recoveryFixture.updater.start({...request, recovery: true, path: 'COM_BOOT', confirmedRecoveryDevice: true});
        assert.ok(!recoveryFixture.h.writes.some(frame => frame[4] === 0x6F));
    } finally {
        await recoveryFixture.cleanup();
    }
    for (const options of [{nextVersion: 320}, {noApplication: true}]) {
        const f = fixture(options);
        try {
            await f.device.connect({path: 'COM_APP'});
            await assert.rejects(f.updater.start(request), /NEW_FW_(VERSION_MISMATCH|RECONNECT_TIMEOUT)/);
            assert.equal(f.updater.state.transferComplete, true);
            assert.equal(f.updater.state.result, null);
        } finally {
            await f.cleanup();
        }
    }
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'new-ai-firmware-'));
    try {
        await fs.copy(getNewAiFirmwareRoot(), temp);
        await fs.writeFile(path.join(temp, 'version/Version.txt'), '000');
        const f = fixture({getRoot: () => temp});
        try {
            await f.device.connect({path: 'COM_APP'});
            await assert.rejects(f.updater.start(request), /NEW_FW_RESOURCE_INVALID/);
            assert.equal(f.h.writes.length, 0); assert.equal(f.device.connected, true);
        } finally {
            await f.cleanup();
        }
    } finally {
        assert.equal(path.dirname(path.resolve(temp)), path.resolve(os.tmpdir()));
        await fs.remove(temp);
    }
    const wrong = fixture({wrongProduct: true});
    try {
        await wrong.device.listDevices();
        await assert.rejects(wrong.updater.start({...request,
            recovery: true,
            path: 'COM_APP',
            confirmedRecoveryDevice: true}), /NEW_WRONG_DEVICE/);
        assert.equal(wrong.h.writes.length, 0);
    } finally {
        await wrong.cleanup();
    }
    const transport = new EventEmitter();
    transport.open = async () => {}; transport.close = async () => {}; transport.write = async () => {};
    const link = new NewAiFirmwareLink(transport, {gap: 1});
    try {
        link.lastAck = Date.now() - 10; link.lastCommand = 0xBB;
        await assert.rejects(link.send(0xDA, Buffer.from('app.bin')), /NEW_FW_GAP/);
    } finally {
        await link.close();
    }
    assert.ok(newAiFirmwareBlockers({}, null).includes('NEW_FW_CHECK_FIRST'));
    console.log('NEW AI firmware passed: 109 pinned files, 214 recognition, reversed Boot ACK splits/errors, complete USB transfer, Boot2 last, COM identity, exclusive ownership, recovery, corrupt resources, failures and version confirmation. No real hardware accessed.');
})().catch(error => {
    console.error(error); process.exitCode = 1;
});
