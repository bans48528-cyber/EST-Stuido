/* eslint-disable global-require, require-await */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
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
const {NewAiPeripheralUpdateService} = require('../src/main/new-ai/peripheral-update-service');
const {normalizeNewAiMonitor, newAiFrame} = require('../src/main/new-ai/protocol');
const {newAiPeripheralMismatches, newAiPeripheralPromptKey} = require('../src/common/new-ai-peripherals');
const {newAiConnectionChanged} = require('../src/renderer/new-ai/telemetry');
const {newAiText} = require('../src/renderer/new-ai/runtime-messages');
const messages = require('../src/renderer/new-ai/peripheral-messages').default;
const clone = value => JSON.parse(JSON.stringify(value));
const envelope = () => ({version: 321,
    NewAiState: 'stop',
    deviceList: [
        {port: 0, big_motor: {version: '141', SoftwareVersion: '142'}},
        {port: 1, small_motor: {version: 140, SoftwareVersion: 141}},
        {port: 2, color: {version: 138, SoftwareVersion: 139}},
        {port: 3, gray: {version: 104, Softwareversion: 105}},
        {port: 4, gray_v2: {version: 110, Softwareversion: 111}},
        {port: 5, elect_sensor: {version: 1, SoftwareVersion: 2}},
        {port: 6, nfc: {version: 1, SoftwareVersion: 2}},
        {port: 7, touch: {state: 0}}
    ]});
class Transport extends EventEmitter {
    constructor (mode = 'success') {
        super(); this.mode = mode; this.message = envelope(); this.writes = [];
    }
    report () {
        this.emit('data', Buffer.from(`${JSON.stringify(this.message)}\r\n`));
    }
    async open () {
        this.report(); this.timer = setInterval(() => this.report(), 4);
    }
    async close () {
        clearInterval(this.timer); clearTimeout(this.finishTimer); this.emit('closed');
    }
    async write (frame) {
        this.writes.push(frame);
        assert.equal(frame[4], 0x32, 'no format, motor control, run, stop or file write');
        if (this.mode === 'write-error') throw Error('write failed');
        if (this.mode === 'disconnect') {
            await this.close(); return;
        }
        if (this.mode === 'ack-only') {
            this.emit('data', newAiFrame(0xFD, [1])); return;
        }
        if (this.mode === 'partial') {
            this.message.deviceList[0].big_motor.version = 142; return;
        }
        this.finishTimer = setTimeout(() => {
            for (const item of this.message.deviceList.slice(0, 5)) {
                const values = item[Object.keys(item).find(key => key !== 'port')];
                values.version = values.SoftwareVersion || values.Softwareversion;
            }
        }, 12);
    }
}
const create = async (mode, connectionMode = 'usb') => {
    const transport = new Transport(mode);
    const device = new NewAiDeviceService({compiler: {supported: true},
        listPorts: async () => [{path: 'COM_TEST', vendorId: '0483', productId: '5740'}],
        createTransport: () => transport,
        createBleTransport: () => transport,
        getBleIdentity: () => ({id: 'BLE_TEST', name: 'NEW_AI'}),
        timeouts: {fresh: 100, bleFresh: 100, write: 40}});
    device.connectionMode = connectionMode;
    await device.connect(connectionMode === 'ble' ? {type: 'ble', id: 'BLE_TEST'} : {path: 'COM_TEST'});
    const service = new NewAiPeripheralUpdateService({device, timeout: 65});
    const request = () => ({confirmed: true,
        connectionRevision: device.epoch,
        targets: newAiPeripheralMismatches(device.monitor)});
    return {device, transport, service, request};
};
(async () => {
    const status = normalizeNewAiMonitor(envelope());
    const targets = newAiPeripheralMismatches(status);
    assert.equal(targets.length, 5, 'only types with an original, bundled image');
    assert.deepEqual(targets.map(item => item.port), [0, 1, 2, 3, 4]);
    for (const bad of [null, '', false, 'invalid', -1, 1.5]) {
        const invalid = clone(status); invalid.ports[0].values.SoftwareVersion = bad;
        assert.ok(!newAiPeripheralMismatches(invalid).some(item => item.port === 0));
    }
    const equal = clone(status); equal.ports[0].values.version = 142;
    assert.equal(newAiPeripheralMismatches(equal).length, 4);
    const zero = clone(status); zero.ports[0].values.version = 0;
    assert.equal(newAiPeripheralMismatches(zero).length, 5);
    const state = {connected: true,
        stale: false,
        busy: false,
        connectionRevision: 1,
        status,
        connectionMode: 'usb',
        port: 'COM_TEST',
        discovery: {ports: []}};
    assert.ok(newAiPeripheralPromptKey(state));
    for (const patch of [{connected: false}, {stale: true}, {busy: true},
        {status: {...status, running: true}}, {status: {...status, version: 193}},
        {firmware: {active: true}}]) assert.equal(newAiPeripheralPromptKey({...state, ...patch}), null);
    assert.equal(newAiConnectionChanged(state, {...state, status: equal}, false), true,
        'version mismatches update the closed inspector');
    for (let index = 0; index < 500; index++) {
        const readings = clone(status); readings.ports[0].values.speed = index;
        assert.equal(newAiConnectionChanged(state, {...state, status: readings}, false), false,
            'numeric telemetry does not rerender the parent');
    }
    for (const locale of ['zh-cn', 'en', 'pt-br', 'zh-tw', 'ru']) {
        Object.keys(messages).forEach(key => assert.ok(newAiText(key, locale).trim().length));
        assert.ok(!/[{}]/.test(newAiText('peripheralUpdating', locale, {completed: 2, total: 5})));
    }
    for (const connection of ['usb', 'ble']) {
        const {device, transport, service, request} = await create('success', connection);
        try {
            const result = service.start(request());
            assert.throws(() => service.start(request()), /NEW_BUSY/);
            await assert.rejects(device.runProgram({source: 'print(1)', slot: 0}), /NEW_BUSY/);
            await assert.rejects(device.disconnect(), /NEW_BUSY/);
            assert.throws(() => device.reserveFirmwareUpdate(), /NEW_BUSY/);
            assert.deepEqual((await result).ports, ['A', 'B', 'C', 'D', 'E']);
            assert.equal(transport.writes.length, 1);
            assert.ok(transport.writes[0].equals(newAiFrame(0x32, [0xA1, 0xA6, 0xA2, 0xA9, 0xB0, 255, 255, 255])));
            assert.equal(device.getState().peripheralUpdate.phase, 'complete');
            assert.equal(device.getState().busy, false);
            assert.equal(device.listenerCount('monitor'), 0);
        } finally {
            await device.shutdown();
        }
    }
    for (const mode of ['ack-only', 'partial', 'disconnect', 'write-error']) {
        const {device, transport, service, request} = await create(mode);
        try {
            await assert.rejects(service.start(request()), /NEW_/);
            assert.equal(transport.writes.length, 1, 'no automatic retry');
            assert.equal(device.peripheralUpdate.phase, 'error');
            assert.equal(device.peripheralUpdate.active, false);
            assert.ok(!device.peripheralUpdate.result, 'sending or ACKs cannot mean upgrade success');
            assert.equal(device.listenerCount('monitor'), 0);
        } finally {
            await device.shutdown();
        }
    }
    {
        const {device, transport, service, request} = await create('success');
        try {
            assert.throws(() => service.start(null), /NEW_REQUEST_INVALID/);
            assert.throws(() => service.start({...request(), confirmed: false}), /NEW_REQUEST_INVALID/);
            assert.throws(() => service.start({...request(), connectionRevision: -1}), /NEW_PERIPHERAL_CHANGED/);
            const stale = request(); stale.targets[0].target++;
            assert.throws(() => service.start(stale), /NEW_PERIPHERAL_CHANGED/);
            const pending = service.start(request());
            transport.message.deviceList[0] = {port: 0, color: {version: 138, SoftwareVersion: 139}};
            await assert.rejects(pending, /NEW_PERIPHERAL_CHANGED/);
            assert.equal(transport.writes.length, 0, 'hot swap before sending must not flash the replacement');
            transport.message.NewAiState = 'run'; transport.report();
            assert.throws(() => service.start(request()), /NEW_RUNNING/);
        } finally {
            await device.shutdown();
        }
    }
    console.log('NEW AI peripheral updates passed: USB/BLE, five types, multi-port, versions, faults and no retries.');
})().catch(error => {
    console.error(error); process.exitCode = 1;
});
