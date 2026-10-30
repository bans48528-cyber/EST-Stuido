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
const {NewAiMonitorParser, normalizeNewAiMonitor} = require('../src/main/new-ai/protocol');
const {NewAiDeviceService} = require('../src/main/new-ai/device-service');
const {newAiPortIdentity, isNewAiUsbCandidate} = require('../src/main/new-ai/serial-transport');
const {NEW_AI_MESSAGE_IDS, newAiText, newAiErrorText} = require('../src/renderer/new-ai/runtime-messages');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const until = async predicate => {
    for (let attempt = 0; attempt < 150; attempt++) {
        if (predicate()) return;
        await pause(5);
    }
    assert.fail('timed out waiting for service state');
};
const monitor = (overrides = {}) => ({deviceList: Array.from({length: 8}, (_, port) => ({port,
    ...(port === 7 ? {gray_v2: {1: 100, b1: 1, Softwareversion: 321}} : {}),
    ...(port === 0 ? {big_motor: {speed: '12', angle: '0', note: '中文'}} : {})})),
version: 321,
bat: '86.5',
mem: {yaw: '1.2', pitch: '0', roll: '0'},
heap: '3000',
flash: {total: '32 mb', free: '24 mb'},
NewAiState: 'stop',
...overrides});
const port = {path: 'COM_TEST', vendorId: '0483', productId: '5740', serialNumber: 'NEW-TEST'};
class Transport extends EventEmitter {
    constructor (onOpen) {
        super(); this.onOpen = onOpen;
    }
    async open () {
        if (this.onOpen) await this.onOpen(this);
    }
    async close () {
        this.closed = true; this.emit('closed');
    }
    report (data = monitor()) {
        this.emit('data', Buffer.from(`${JSON.stringify(data)}\r\n`));
    }
}
const fixture = (options = {}) => {
    const transport = new Transport(options.onOpen);
    const service = new NewAiDeviceService({listPorts: async () => [port],
        createTransport: () => transport,
        timeouts: {open: 70, identify: 40, stale: 1000, scan: 10, retry: 45, close: 70, ...options.timeouts}});
    return {service, transport};
};
(async () => {
    for (const version of [0, 1, 193, 214, 320, 322, 65535]) {
        const {service} = fixture({onOpen: transport => transport.report(monitor({version}))});
        try {
            await service.connect({path: port.path});
            assert.equal(service.getState().connected, true);
            assert.equal(service.getState().programSupported, false);
            assert.throws(() => service.requireControlReady(), /NEW_VERSION_UNSUPPORTED/);
        } finally { await service.shutdown(); }
    }
    const status = normalizeNewAiMonitor(monitor(), 123);
    assert.equal(status.version, 321);
    assert.equal(status.timestamp, 123);
    assert.equal(status.battery, 86.5);
    assert.equal(status.ports[7].label, 'H');
    assert.equal(status.ports[7].values.Softwareversion, 321);
    assert.equal(normalizeNewAiMonitor(monitor({version: '321'})).version, 321);
    assert.equal(normalizeNewAiMonitor(monitor({bat: 'bad'})).battery, null);
    for (const bad of [monitor({version: ''}), monitor({version: false}), monitor({NewAiState: 'other'}),
        monitor({WillAiState: 'stop'}), monitor({deviceList: [{port: 0}]}),
        monitor({deviceList: Array.from({length: 8}, () => ({port: 0}))})]) {
        assert.equal(normalizeNewAiMonitor(bad), null);
    }
    const raw = Buffer.from(`debug line\r\n${JSON.stringify(monitor())}\r\n`);
    for (let split = 0; split <= raw.length; split++) {
        const parser = new NewAiMonitorParser();
        const received = [];
        parser.on('monitor', value => received.push(value));
        parser.push(raw.subarray(0, split)); parser.push(raw.subarray(split));
        assert.equal(received.length, 1, `serial split at ${split}`);
        assert.equal(received[0].ports[0].values.note, '中文');
    }
    const parser = new NewAiMonitorParser();
    let count = 0;
    let other = 0;
    parser.on('monitor', () => count++);
    parser.on('other-device', () => other++);
    parser.push(Buffer.alloc(18000, 65));
    parser.push(Buffer.from(`\n${JSON.stringify(monitor())}\n${JSON.stringify(monitor())}\n`));
    assert.equal(count, 2);
    parser.push(Buffer.from(`${JSON.stringify({deviceList: Array.from({length: 4}, (_, i) => ({port: i})),
        version: 110,
        WillAiState: 'stop'})}\n`));
    assert.equal(other, 1);
    assert.ok(isNewAiUsbCandidate(port));
    assert.ok(!isNewAiUsbCandidate({...port, pnpId: 'BTHENUM'}));
    assert.equal(newAiPortIdentity(port), newAiPortIdentity({...port, path: 'COM_OTHER'}));
    for (const locale of ['zh-cn', 'en', 'pt-br', 'zh-tw', 'ru']) {
        NEW_AI_MESSAGE_IDS.forEach(id => assert.ok(newAiText(id, locale).trim()));
        assert.equal(newAiErrorText(new Error('invoke failed: NEW_WRONG_DEVICE'), locale),
            newAiText('NEW_WRONG_DEVICE', locale));
    }
    {
        const {service, transport} = fixture();
        const connecting = service.connect({path: port.path});
        await until(() => transport.listenerCount('data') > 0);
        assert.equal(service.getState().connected, false, 'opening a port does not establish product identity');
        assert.equal(service.getState().state, 'verifying');
        await assert.rejects(service.connect({path: port.path}), /NEW_BUSY/);
        transport.report(); await connecting;
        assert.equal(service.getState().connected, true);
        assert.equal(service.getState().programSupported, true);
        assert.equal(typeof transport.write, 'undefined', 'phase-2 transport has no control/write API');
        let events = 0;
        service.on('state', () => events++);
        for (let i = 0; i < 200; i++) transport.report(monitor({version: 400 + i}));
        await pause(120);
        assert.ok(events <= 2, 'telemetry must coalesce renderer IPC');
        assert.equal(service.getState().status.version, 599);
        service.setAutoConnect(false);
        transport.report(monitor({version: 321}));
        assert.equal(service.getState().status.version, 321, 'toggling reconnect must not disable live monitoring');
        await service.shutdown();
        assert.equal(transport.listenerCount('data'), 0);
        transport.report();
        assert.equal(service.getState().status, null, 'late reports must not revive a closed connection');
    }
    for (const [onOpen, expected] of [
        [transport => transport.report({deviceList: [{}, {}, {}, {}], WillAiState: 'stop'}), 'NEW_WRONG_DEVICE'],
        [null, 'NEW_IDENTITY_TIMEOUT'],
        [() => new Promise(() => {}), 'NEW_OPEN_TIMEOUT']
    ]) {
        const {service, transport} = fixture({onOpen});
        await assert.rejects(service.connect({path: port.path}), error => error.code === expected);
        assert.equal(service.getState().status, null);
        assert.ok(transport.closed);
        assert.equal(transport.listenerCount('data'), 0);
        await service.shutdown();
    }
    {
        const {service, transport} = fixture({onOpen: t => t.report(), timeouts: {stale: 25}});
        await service.connect({path: port.path});
        await pause(60);
        assert.equal(service.getState().stale, true);
        transport.report();
        assert.equal(service.getState().stale, false);
        await service.shutdown();
    }
    {
        let ports = [port];
        const transports = [];
        const service = new NewAiDeviceService({listPorts: async () => ports,
            createTransport: () => {
                const transport = new Transport(t => t.report());
                transports.push(transport);
                return transport;
            },
            timeouts: {scan: 8, retry: 30}});
        service.setDiscoveryActive(true);
        await until(() => service.connected);
        assert.equal(transports.length, 1);
        ports = [{...port, path: 'COM_MOVED'}];
        transports[0].emit('closed');
        await until(() => service.connected && service.port === 'COM_MOVED');
        assert.equal(transports.length, 2, 'USB identity survives a COM port change');
        await service.disconnect();
        await pause(45);
        assert.equal(transports.length, 2, 'manual disconnect pauses automatic reconnect');
        service.setAutoConnect(true);
        await until(() => service.connected);
        await service.shutdown();
        assert.ok(transports.every(t => t.closed));
    }
    {
        let openings = 0;
        const service = new NewAiDeviceService({
            listPorts: async () => [port, {...port, path: 'COM_2', serialNumber: '2'}],
            createTransport: () => {
                openings++; return new Transport();
            },
            timeouts: {scan: 8}});
        service.setDiscoveryActive(true);
        await until(() => service.discoveryStatus === 'choose');
        assert.equal(openings, 0, 'ambiguous candidates must require selection');
        await service.shutdown();
    }
    {
        const {service, transport} = fixture();
        service.setDiscoveryActive(true);
        await until(() => Boolean(service.cancelHandshake));
        service.setDiscoveryActive(true);
        transport.report();
        await service.autoConnectPromise;
        assert.equal(service.connected, true, 'repeated selection of the same hardware must not cancel discovery');
        await service.shutdown();
    }
    {
        let attempts = 0;
        const service = new NewAiDeviceService({listPorts: async () => [port],
            createTransport: () => {
                attempts++;
                return new Transport(t => t.report({deviceList: [{}, {}, {}, {}], WillAiState: 'stop'}));
            },
            timeouts: {scan: 6, retry: 100}});
        service.setDiscoveryActive(true);
        await until(() => service.discoveryStatus === 'retrying');
        await pause(30);
        assert.equal(attempts, 1, 'wrong hardware must not be reopened on every scan tick');
        await service.shutdown();
    }
    {
        const {service, transport} = fixture();
        service.setDiscoveryActive(true);
        await until(() => Boolean(service.cancelHandshake));
        service.setDiscoveryActive(false);
        await service.autoConnectPromise;
        assert.equal(service.connected, false);
        assert.ok(transport.closed, 'switching away during verification closes the old USB handle');
        await service.shutdown();
    }
    // Multiple renderer subscribers share one IPC listener and cannot restore stale state after a switch.
    const ipc = new EventEmitter();
    const reads = [];
    ipc.invoke = channel => {
        assert.equal(channel, 'new-ai-state');
        return new Promise(resolve => reads.push(resolve));
    };
    const originalLoad = Module._load;
    let subscribeNewAiState;
    try {
        Module._load = (request, parent, isMain) => (request === 'electron' ? {ipcRenderer: ipc} :
            originalLoad(request, parent, isMain));
        ({subscribeNewAiState} = require('../src/renderer/new-ai/runtime-client'));
    } finally {
        Module._load = originalLoad;
    }
    const received = [];
    const unsubscribe1 = subscribeNewAiState(state => received.push(state));
    const unsubscribe2 = subscribeNewAiState(() => {});
    assert.equal(reads.length, 1);
    assert.equal(ipc.listenerCount('new-ai-state-change'), 1);
    ipc.emit('new-ai-state-change', null, {connected: true});
    reads.shift()({connected: false});
    await pause(0);
    assert.equal(received.at(-1).connected, true, 'late initial read cannot overwrite a newer event');
    unsubscribe1(); unsubscribe2();
    assert.equal(ipc.listenerCount('new-ai-state-change'), 0);
    const after = [];
    const unsubscribe3 = subscribeNewAiState(state => after.push(state));
    assert.equal(after.length, 0, 're-entry must not show a cached connected state');
    unsubscribe3();
    reads.shift()({connected: true});
    await pause(0);
    assert.equal(after.length, 0, 'late request after unmount must not reach the old subscriber');
    console.log('NEW AI runtime passed: product identity, all serial/UTF-8 splits, bounded buffers, ' +
        'version/8 ports, no writes, throttling, stale data, failures, USB reconnect, lifecycle and renderer IPC.');
})().catch(error => {
    console.error(error); process.exitCode = 1;
});
