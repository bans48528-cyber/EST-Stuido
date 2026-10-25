/* eslint-disable global-require, require-await */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
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
const {NewAiConnectionPreferences, normalizeNewAiConnectionPreferences: normalize} =
    require('../src/main/new-ai/connection-preferences');
const {NewAiDeviceService} = require('../src/main/new-ai/device-service');
const {newAiPortIdentity} = require('../src/main/new-ai/serial-transport');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const until = async predicate => {
    for (let index = 0; index < 200; index++) {
        if (predicate()) return;
        await pause(5);
    }
    assert.fail('connection preference test timed out');
};
const port = {path: 'COM_OLD', vendorId: '0483', productId: '5740', serialNumber: 'NEW-AI-TEST'};
const monitor = {version: 321, NewAiState: 'stop', deviceList: Array.from({length: 8}, (_, index) => ({port: index}))};
class Transport extends EventEmitter {
    constructor (report = monitor) {
        super(); this.report = report;
    }
    async open () {
        if (this.report) this.emit('data', Buffer.from(`${JSON.stringify(this.report)}\r\n`));
    }
    async close () {
        this.emit('closed');
    }
    async write () {
        assert.fail('connection discovery and preferences must not send commands');
    }
}
const services = [];
const makeService = (preferences, ports, options = {}) => {
    const opened = [];
    const service = new NewAiDeviceService({preferences,
        listPorts: async () => ports,
        createTransport: devicePort => {
            opened.push(devicePort); return new Transport(options.report);
        },
        timeouts: {scan: 10, identify: 40, retry: 100, ...options.timeouts}});
    services.push(service);
    return {service, opened};
};

(async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'est-new-ai-connection-'));
    const preferences = new NewAiConnectionPreferences(path.join(directory, 'new-connection.json'));
    assert.deepStrictEqual(preferences.read(), {version: 2,
        mode: 'usb',
        usbAuto: true,
        bleAuto: true,
        bleDevice: null,
        lastDevice: null});
    fs.writeFileSync(preferences.filename, JSON.stringify({version: 1, usbAuto: false, lastDevice: port}));
    assert.equal(preferences.read().usbAuto, false, 'migrate version 1 without changing manual pause');
    assert.equal(preferences.read().lastDevice.serialNumber, port.serialNumber);
    preferences.write({usbAuto: true});
    for (const value of [null, [], false, 'bad']) assert.equal(normalize(value).usbAuto, true);
    for (const bad of [{...port, vendorId: '1234'}, {...port, pnpId: 'BTHENUM\\test'},
        {...port, serialNumber: 'bad\nserial'}, {...port, serialNumber: '', pnpId: 'COM13'}]) {
        assert.equal(normalize({lastDevice: bad}).lastDevice, null);
    }
    const pnp = {vendorId: '0483', productId: '5740', pnpId: 'USB\\VID_0483&PID_5740\\NO-SERIAL'};
    assert.equal(newAiPortIdentity(normalize({lastDevice: pnp}).lastDevice), newAiPortIdentity(pnp));

    const first = makeService(preferences, [port]);
    const firstState = await first.service.connect({path: port.path});
    assert.equal(firstState.memoryError, null, 'test directory must allow atomic preference writes');
    assert.equal(preferences.read().lastDevice.serialNumber, port.serialNumber);
    assert.ok(!('path' in preferences.read().lastDevice), 'do not remember a stale COM number');
    await first.service.shutdown();
    assert.equal(preferences.read().usbAuto, true, 'normal exit preserves automatic discovery');

    const moved = {...port, path: 'COM_NEW'};
    const other = {...port, path: 'COM_OTHER', serialNumber: 'OTHER-DEVICE'};
    const restarted = makeService(new NewAiConnectionPreferences(preferences.filename), [other, moved]);
    restarted.service.setDiscoveryActive(true);
    await until(() => restarted.service.connected);
    assert.deepStrictEqual(restarted.opened, ['COM_NEW'], 'restart selects the verified identity after COM changes');
    await restarted.service.disconnect();
    assert.equal(preferences.read().usbAuto, false, 'manual disconnect persists paused discovery');
    await restarted.service.shutdown();

    const paused = makeService(preferences, [moved]);
    paused.service.setDiscoveryActive(true); await pause(40);
    assert.equal(paused.service.discoveryStatus, 'paused'); assert.equal(paused.opened.length, 0);
    paused.service.setAutoConnect(true);
    await until(() => paused.service.connected);
    assert.equal(preferences.read().usbAuto, true);
    paused.service.setDiscoveryActive(false);
    await paused.service.disconnect({pauseAuto: false});
    assert.equal(preferences.read().usbAuto, true, 'hardware switching preserves reconnect preference');
    await paused.service.shutdown();

    const missing = makeService(preferences, [other]);
    missing.service.setDiscoveryActive(true); await pause(40);
    assert.equal(missing.opened.length, 0, 'never substitute another device when remembered identity is missing');
    await missing.service.connect({path: other.path});
    assert.equal(preferences.read().lastDevice.serialNumber, other.serialNumber,
        'explicit verified selection can replace the remembered device');
    await missing.service.shutdown();

    const before = fs.readFileSync(preferences.filename, 'utf8');
    const wrong = makeService(preferences, [port], {report: {deviceList: [{}, {}, {}, {}], WillAiState: 'stop'}});
    await assert.rejects(wrong.service.connect({path: port.path}), /NEW_WRONG_DEVICE/);
    assert.equal(fs.readFileSync(preferences.filename, 'utf8'), before, 'rejected hardware must not be remembered');
    await wrong.service.shutdown();
    const cancelled = makeService(preferences, [port], {report: null});
    const connecting = cancelled.service.connect({path: port.path});
    await until(() => Boolean(cancelled.service.cancelHandshake));
    cancelled.service.cancelHandshake();
    await assert.rejects(connecting, /NEW_CANCELLED/);
    assert.equal(fs.readFileSync(preferences.filename, 'utf8'), before, 'cancelled handshake must not be remembered');
    await cancelled.service.shutdown();

    const failure = {read: () => ({usbAuto: true}),
        write: () => {
            throw new Error('EACCES');
        }};
    const usable = makeService(failure, [port]);
    const connected = await usable.service.connect({path: port.path});
    assert.equal(connected.connected, true);
    assert.equal(connected.memoryError, 'NEW_CONNECTION_MEMORY_FAILED');
    usable.service.setAutoConnect(false);
    assert.equal(usable.service.autoEnabled, false, 'current choice still works when persistence fails');
    failure.write = () => {};
    usable.service.setAutoConnect(true);
    assert.equal(usable.service.getState().memoryError, null);
    await usable.service.shutdown();

    const invalidFiles = ['{bad', JSON.stringify({version: 200, usbAuto: false, lastDevice: port}), ' '.repeat(8193)];
    for (const invalid of invalidFiles) {
        fs.writeFileSync(preferences.filename, invalid);
        assert.deepStrictEqual(preferences.read(), {version: 2,
            mode: 'usb',
            usbAuto: true,
            bleAuto: true,
            bleDevice: null,
            lastDevice: null});
    }
    preferences.write({usbAuto: true, lastDevice: port});
    assert.equal(fs.readdirSync(directory).filter(name => name.endsWith('.tmp')).length, 0);
    console.log('NEW AI connection memory passed: verified USB identity, COM changes, restart, manual pause, ' +
        'explicit replacement, wrong-device/cancel rejection, write failure recovery and bounded atomic storage.');
})().catch(error => {
    console.error(error); process.exitCode = 1;
})
    .finally(async () => {
        for (const service of services) await service.shutdown();
    });
