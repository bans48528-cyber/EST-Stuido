/* eslint-disable global-require, func-style, require-jsdoc, require-await, max-len, no-undefined, require-atomic-updates */
const assert = require('assert');
const fs = require('fs');
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
const {SparkBleBridge} = require('../src/main/spark-ai/ble-bridge');
const {SparkBleDriver} = require('../src/renderer/spark-ai/ble-driver');
const {SparkDeviceService} = require('../src/main/spark-ai/device-service');
const {SparkConnectionPreferences, normalizeSparkPreferences} = require('../src/main/spark-ai/connection-preferences');
const {sparkFrame, SparkStreamParser, SPARK_COMMAND: C} = require('../src/main/spark-ai/protocol');
const {SPARK_BLE_SERVICE, SPARK_BLE_CHARACTERISTIC} = require('../src/common/spark-ble');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
class Target extends EventEmitter {
    addEventListener (name, fn) {
        this.on(name, fn);
    }
    removeEventListener (name, fn) {
        this.removeListener(name, fn);
    }
}
const fakeBluetooth = () => {
    const characteristic = new Target();
    characteristic.properties = {notify: true, writeWithoutResponse: true};
    characteristic.startNotifications = async () => {};
    const writes = [];
    characteristic.writeValueWithoutResponse = async bytes => {
        writes.push(Buffer.from(bytes));
        if (characteristic.onWrite) await characteristic.onWrite(bytes);
    };
    const device = new Target();
    device.id = 'spark-test';
    device.gatt = {connect: async () => device.gatt,
        disconnect: () => {
            device.disconnects = (device.disconnects || 0) + 1;
        },
        getPrimaryService: async uuid => {
            assert.equal(uuid, SPARK_BLE_SERVICE);
            return {getCharacteristic: async id => {
                assert.equal(id, SPARK_BLE_CHARACTERISTIC); return characteristic;
            }};
        }};
    let requestOptions;
    const bluetooth = {requestDevice: async options => {
        requestOptions = options; return device;
    }};
    return {characteristic, device, bluetooth, writes, getOptions: () => requestOptions};
};
function monitorRecoveryTests () {
    const text = JSON.stringify({deviceList: [0, 1, 2, 3].map(port => ({port})),
        version: 110,
        WillAiState: 'stop'});
    const stream = Buffer.concat([Buffer.from(text.slice(0, -2)), sparkFrame(C.ACK, [1]), Buffer.from(text)]);
    for (let split = 0; split <= stream.length; split++) {
        const parser = new SparkStreamParser({recoverBleMonitor: true});
        const states = []; const frames = [];
        parser.on('monitor', state => states.push(state)); parser.on('frame', frame => frames.push(frame));
        parser.push(stream.subarray(0, split)); parser.push(stream.subarray(split));
        assert.equal(states.length, 1, `truncated tail + valid envelope split ${split}`);
        assert.equal(frames.length, 1);
    }
    const parser = new SparkStreamParser({recoverBleMonitor: true});
    let states = 0; parser.on('monitor', () => {
        states++;
    });
    for (let i = 0; i < 100; i++) parser.push(Buffer.from(text.slice(0, -1)));
    assert.equal(states, 0, 'truncated states must not refresh watchdog');
    assert.ok(parser.line.length < 1024);
    parser.push(Buffer.from(`${text}\r\n`)); assert.equal(states, 1);
    console.log('BLE monitor resync: all packet split points, missing tails/newlines, interleaved ACKs, bounded buffers and strict JSON validation passed.');
}
async function driverTests () {
    const fake = fakeBluetooth(); const messages = [];
    const driver = new SparkBleDriver({bluetooth: fake.bluetooth, emit: message => messages.push(message)});
    assert.equal(await driver.choose(), fake.device.id);
    assert.ok(fake.getOptions().filters.some(filter => filter.services));
    await driver.open(1, fake.device.id);
    const bytes = new Uint8Array(135).map((v, i) => i);
    await driver.write(1, bytes);
    assert.deepStrictEqual(fake.writes.map(piece => piece.length), [20, 20, 20, 20, 20, 20, 15]);
    assert.deepStrictEqual(Buffer.concat(fake.writes), Buffer.from(bytes));
    const backing = new Uint8Array([8, 1, 2, 3, 9]);
    fake.characteristic.emit('characteristicvaluechanged', {target: {value: new DataView(backing.buffer, 1, 3)}});
    assert.deepStrictEqual([...messages[0].bytes], [1, 2, 3]);
    fake.device.emit('gattserverdisconnected');
    assert.equal(messages[1].closed, true);
    assert.equal(fake.characteristic.listenerCount('characteristicvaluechanged'), 0);
    assert.equal(fake.device.listenerCount('gattserverdisconnected'), 0);
    await assert.rejects(driver.write(1, bytes), /DISCONNECTED/);
    await driver.open(2, fake.device.id);
    const before = fake.writes.length;
    fake.characteristic.onWrite = async () => driver.close(2);
    await assert.rejects(driver.write(2, bytes), /BLE_WRITE/);
    assert.equal(fake.writes.length, before + 1, 'cancel must stop remaining fragments');
    delete fake.characteristic.onWrite;
    fake.characteristic.properties = {notify: true, write: true};
    fake.characteristic.writeValueWithResponse = fake.characteristic.writeValueWithoutResponse;
    await driver.open(3, fake.device.id);
    await driver.write(3, new Uint8Array([1]));
    driver.close();
    fake.characteristic.properties = {notify: false, write: true};
    await assert.rejects(driver.open(4, fake.device.id), /BLE_SERVICE/);
    let finish;
    fake.device.gatt.connect = () => new Promise(resolve => {
        finish = resolve;
    });
    const opening = driver.open(5, fake.device.id);
    await pause(0);
    driver.close(5);
    finish(fake.device.gatt);
    await assert.rejects(opening, /DISCONNECTED/);
    await assert.rejects(new SparkBleDriver({emit: () => {}}).choose(), /BLE_UNAVAILABLE/);
    let finishChoice;
    const pendingDriver = new SparkBleDriver({bluetooth: {requestDevice: () => new Promise(resolve => {
        finishChoice = resolve;
    })},
    emit: () => {}});
    const choosing = pendingDriver.choose();
    pendingDriver.cancelChoice();
    await assert.rejects(choosing, /CANCELLED/);
    finishChoice(fake.device); await pause(0);
    assert.equal(pendingDriver.device, undefined, 'late chooser result must not reconnect after cancellation');
    const delayed = fakeBluetooth();
    delayed.device.gatt.connect = async () => {
        delayed.device.gatt.connected = true; return delayed.device.gatt;
    };
    delayed.device.gatt.disconnect = () => {
        if (!delayed.device.gatt.connected) return;
        delayed.device.gatt.connected = false;
        setTimeout(() => delayed.device.emit('gattserverdisconnected'), 20);
    };
    const reconnect = new SparkBleDriver({bluetooth: delayed.bluetooth, emit: () => {}});
    await reconnect.choose(); await reconnect.open(10, delayed.device.id);
    const closing = reconnect.close(10);
    await reconnect.open(11, delayed.device.id); await closing; await pause(30);
    assert.equal(reconnect.context.session, 11, 'late disconnect must not kill the next connection');
    await reconnect.close(11);
    console.log('BLE driver: UUIDs, offset notifications, 20-byte ordered writes, write-with-response fallback, disconnect, mid-frame cancellation and late-open cleanup passed.');
}
const createBridge = (options = {}) => {
    const bridge = new SparkBleBridge({allowed: () => true, scanTimeout: 30, requestTimeout: 30, ...options});
    const contents = new EventEmitter();
    contents.sent = [];
    contents.isDestroyed = () => false;
    contents.send = (channel, value) => contents.sent.push({channel, value});
    bridge.attach(contents);
    const select = () => {
        bridge.beginScan(); let selected; let prevented = false;
        contents.emit('select-bluetooth-device', {preventDefault: () => {
            prevented = true;
        }},
        [{deviceId: 'spark-test', deviceName: 'Spark_AI'}], id => {
            selected = id;
        });
        assert.equal(prevented, true);
        assert.throws(() => bridge.select('not-seen'), /DEVICE_INVALID/);
        bridge.select('spark-test'); assert.equal(selected, 'spark-test');
        bridge.bindDevice('opaque-gatt-id');
    };
    return {bridge, contents, select};
};
async function bridgeTests () {
    const {bridge, contents, select} = createBridge();
    assert.throws(() => bridge.createTransport('unapproved'), /DEVICE_INVALID/);
    bridge.beginScan(); let cancelled;
    assert.deepStrictEqual(contents.sent.map(message => message.value.scanning), [true],
        'starting a scan must not emit a late cancellation for its own request');
    contents.emit('select-bluetooth-device', {preventDefault: () => {}}, [], id => {
        cancelled = id;
    });
    await pause(45); assert.equal(cancelled, '');
    select();
    assert.throws(() => bridge.createTransport('spark-test'), /DEVICE_INVALID/);
    const transport = bridge.createTransport('opaque-gatt-id');
    let received; transport.on('data', data => {
        received = data;
    });
    const open = transport.open();
    const request = contents.sent.at(-1).value;
    bridge.reply({...request, session: -1});
    assert.equal(bridge.pending.size, 1);
    bridge.reply(request); await open;
    bridge.receive({session: -1, bytes: new Uint8Array([1])}); assert.equal(received, undefined);
    bridge.receive({session: transport.session, bytes: new Uint8Array([2])}); assert.equal(received[0], 2);
    let fault; transport.on('fault', error => {
        fault = error.code;
    });
    await assert.rejects(transport.write(new Uint8Array([1])), /BLE_TIMEOUT/);
    assert.equal(fault, 'SPARK_BLE_TIMEOUT');
    assert.equal(contents.sent.at(-1).channel, 'spark-ble-abort');
    assert.equal(bridge.active, null);
    select();
    const reconnected = bridge.createTransport('opaque-gatt-id');
    let closed = false; reconnected.on('closed', () => {
        closed = true;
    });
    contents.emit('render-process-gone');
    assert.equal(closed, true); assert.equal(bridge.active, null); assert.equal(bridge.pending.size, 0);
    bridge.reset();
    console.log('BLE bridge: explicit selection, scan cancellation/timeout, authorization, session isolation, request timeout and renderer crash cleanup passed.');
}
async function integrationTests () {
    const fake = fakeBluetooth();
    const {bridge, contents, select} = createBridge({requestTimeout: 500});
    const driver = new SparkBleDriver({bluetooth: fake.bluetooth, emit: message => bridge.receive(message)});
    contents.send = (channel, request) => {
        if (channel === 'spark-ble-abort') driver.close(request.session);
        if (channel !== 'spark-ble-request') return;
        Promise.resolve().then(() => (request.action === 'open' ? driver.open(request.session, request.data.id) :
            (request.action === 'close' ? driver.close(request.session) : driver.write(request.session, request.data))))
            .then(() => bridge.reply(request),
                error => bridge.reply({...request, error: error.message}));
    };
    select(); await driver.choose(); bridge.bindDevice(fake.device.id);
    const notify = bytes => fake.characteristic.emit('characteristicvaluechanged', {target: {
        value: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    }});
    const report = running => notify(Buffer.from(`${JSON.stringify({version: 110,
        WillAiState: running ? 'run' : 'stop',
        deviceList: [0, 1, 2, 3].map(port => ({port})),
        adc: {bat: '80%'}})}\r\n`));
    const frames = [];
    const parser = new SparkStreamParser();
    parser.on('frame', frame => {
        frames.push(frame);
        if ([C.MONITOR_ON, C.STOP].includes(frame.command)) report(false);
        else {
            if (frame.command === C.RUN) report(true);
            notify(sparkFrame(C.ACK, [1]));
        }
    });
    fake.characteristic.onWrite = bytes => parser.push(bytes);
    const bytes = Buffer.alloc(512);
    Buffer.from([0x0F, 0x70, 0x79, 0x6F]).copy(bytes);
    bytes.writeUInt32LE(504, 4); bytes.writeUInt32LE(4, 8); bytes.writeUInt32LE(492, 16);
    let usbScans = 0;
    const service = new SparkDeviceService({compiler: {compile: async () => bytes},
        listPorts: async () => {
            usbScans++; return [];
        },
        createBleTransport: id => bridge.createTransport(id),
        timeouts: {connect: 80, start: 80, settle: 1, ack: 80, stop: 80}});
    try {
        await service.setConnectionMode('ble'); service.setDiscoveryActive(true);
        await service.discover(); assert.equal(usbScans, 0);
        await service.connect({type: 'ble', id: fake.device.id});
        assert.equal(service.getState().compatible, true);
        await service.downloadProgram({source: 'pass', slot: 9, run: false});
        assert.deepStrictEqual(frames.slice(2).map(frame => frame.payload.length), [128, 128, 128, 128]);
        assert.equal(frames.at(-1).command, C.SAVE);
        const run = await service.downloadProgram({source: 'pass', slot: 9, run: true});
        assert.equal(run.runObserved, true);
        await assert.rejects(service.setConnectionMode('usb'), /STOP_FIRST/);
        await service.stopCurrentProgram();
        assert.equal(service.getState().status.running, false);
        fake.characteristic.onWrite = () => fake.device.emit('gattserverdisconnected');
        await assert.rejects(service.downloadProgram({source: 'pass', slot: 9}), /DOWNLOAD_INCOMPLETE/);
        assert.equal(service.getState().connected, false);
        assert.equal(service.recoveryRequired, false);
        assert.equal(service.getState().warning, 'SPARK_DOWNLOAD_INCOMPLETE');
        fake.characteristic.onWrite = fragment => parser.push(fragment);
        await service.connect({type: 'ble', id: fake.device.id});
        assert.equal((await service.downloadProgram({source: 'pass', slot: 9})).downloaded, true);
        assert.equal(service.getState().warning, null);
    } finally {
        await service.shutdown(); bridge.reset();
    }
    console.log('BLE end-to-end mock: GATT fragments -> firmware frames -> FD/01 -> service; 128-byte download/save/run/stop, USB suppression, running guard and interrupted-transfer recovery passed.');
}
async function reconnectTests () {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'spark-ble-memory-'));
    const filename = path.join(folder, 'spark-connection.json');
    const preferences = new SparkConnectionPreferences(filename);
    const identity = {id: 'EC:B2:A5:02:21:2A', name: 'Spark_AI'};
    assert.equal(preferences.read().mode, 'usb');
    assert.equal(normalizeSparkPreferences({bleDevice: {id: '\n', name: 'bad'}}).bleDevice, null);
    assert.equal(normalizeSparkPreferences(null).mode, 'usb');
    preferences.write({mode: 'ble', bleDevice: {...identity, gattId: 'never-persist'}});
    assert.ok(!fs.readFileSync(filename, 'utf8').includes('never-persist'));
    let choices = 0; const frames = []; let fail = false; let interruptFile = true;
    const create = () => new SparkDeviceService({preferences,
        reconnectBleDevice: async device => {
            assert.deepStrictEqual(device, identity);
            choices++;
            if (fail) throw new Error('SPARK_BLE_CONNECT');
            return `fresh-opaque-${choices}`;
        },
        getBleIdentity: () => identity,
        createBleTransport: () => {
            const transport = new EventEmitter();
            transport.open = async () => {};
            transport.close = async () => transport.emit('closed');
            transport.write = async bytes => {
                frames.push(bytes[4]);
                if (bytes[4] === C.FILE && interruptFile) throw new Error('simulated interrupted file');
                if ([C.FILE, C.DATA, C.SAVE, C.RUN].includes(bytes[4])) {
                    transport.emit('data', sparkFrame(C.ACK, [1])); return;
                }
                transport.emit('data', Buffer.from(`${JSON.stringify({version: 110,
                    deviceList: [0, 1, 2, 3].map(port => ({port})),
                    WillAiState: 'stop'})}\r\n`));
            };
            return transport;
        },
        compiler: {compile: async () => {
            const bytes = Buffer.alloc(32); bytes.set([0x0F, 0x70, 0x79, 0x6F]);
            bytes.writeUInt32LE(24, 4); bytes.writeUInt32LE(4, 8); bytes.writeUInt32LE(12, 16);
            return bytes;
        }},
        timeouts: {discovery: 100000, retry: 10000, connect: 30, ack: 30}});
    let service = create();
    try {
        service.discoveryActive = true;
        await service.discover();
        assert.equal(service.connected, true);
        assert.deepStrictEqual(frames, [C.MONITOR_ON], 'reconnect must never download, run or stop');
        assert.equal(service.portPath, 'fresh-opaque-1');
        service.transport.emit('closed');
        assert.equal(service.connected, false);
        await service.discover();
        assert.equal(service.portPath, 'fresh-opaque-2');
        await assert.rejects(Promise.resolve().then(() => service.forgetBleDevice()), /SPARK_BUSY/);
        await service.disconnect();
        const paused = choices;
        await service.discover(); assert.equal(choices, paused);
        await service.shutdown();
        service = create(); service.discoveryActive = true;
        assert.equal(service.connectionMode, 'ble');
        assert.equal(service.discovery.enabled, false, 'manual disconnect preference survives restart');
        assert.deepStrictEqual(service.getState().bleDevice, identity);
        service.setAutoConnect(true); await service.discover();
        assert.equal(service.connected, true, 'restart restores exact identity with a fresh opaque id');
        await service.disconnect({pauseAuto: false});
        fail = true;
        await service.discover(); const failed = choices;
        await service.discover(); assert.equal(choices, failed, 'failed reconnect uses bounded backoff');
        assert.equal(service.discovery.status, 'retrying');
        fail = false; service.discoveryFailures.clear();
        await service.discover();
        service.firmwareLease = true; assert.equal(service.canDiscover(), false); service.firmwareLease = false;
        service.setDiscoveryActive(false); assert.equal(service.canDiscover(), false);
        service.discoveryActive = true;
        await assert.rejects(service.downloadProgram({slot: 9, source: 'pass'}), /DOWNLOAD_INCOMPLETE/);
        assert.equal(service.recoveryRequired, false);
        assert.equal(preferences.read().downloadInterrupted, true);
        await service.shutdown(); service = create(); service.discoveryActive = true;
        assert.equal(service.canDiscover(), true, 'interrupted download must not block reconnect across app restarts');
        assert.equal(service.getState().warning, 'SPARK_DOWNLOAD_INCOMPLETE');
        const beforeReconnect = frames.length;
        await service.discover();
        assert.deepStrictEqual(frames.slice(beforeReconnect), [C.MONITOR_ON], 'reconnect never resumes or restarts the file');
        interruptFile = false;
        assert.equal((await service.downloadProgram({slot: 9, source: 'pass'})).downloaded, true);
        assert.equal(service.getState().warning, null);
        assert.equal(preferences.read().downloadInterrupted, false);
        await service.disconnect({pauseAuto: false});
        service.forgetBleDevice(); assert.equal(preferences.read().bleDevice, null);
        await service.shutdown();
        fs.writeFileSync(filename, JSON.stringify({version: 1,
            mode: 'ble',
            bleDevice: identity,
            recoveryRequired: true}));
        let resolveChoice;
        service = create(); service.discoveryActive = true;
        assert.equal(service.canDiscover(), true, 'legacy persisted download locks migrate to warnings');
        assert.equal(service.getState().warning, 'SPARK_DOWNLOAD_INCOMPLETE');
        assert.equal(service.recoveryRequired, false);
        service.reconnectBleDevice = () => new Promise(resolve => {
            resolveChoice = resolve;
        });
        const pending = service.discover();
        assert.equal(service.busy, true);
        service.setAutoConnect(false); resolveChoice('late-device'); await pending;
        assert.ok(!fs.readFileSync(filename, 'utf8').includes('recoveryRequired'));
        assert.equal(Boolean(service.connected), false, 'pause during discovery rejects late selection');
        assert.equal(service.discovery.status, 'paused');
    } finally {
        await service.shutdown();
        fs.rmSync(folder, {recursive: true, force: true});
    }
    const {bridge, contents} = createBridge({scanTimeout: 200});
    bridge.ready = true;
    let script;
    contents.executeJavaScript = async (code, gesture) => {
        assert.equal(gesture, true); script = code;
    };
    const restoring = bridge.reconnectDevice(identity);
    assert.ok(script.includes('spark-ble-choose'));
    let selected;
    const event = {preventDefault: () => {}};
    contents.emit('select-bluetooth-device', event, [{deviceId: 'other', deviceName: 'Spark_AI'}], id => {
        selected = id;
    });
    assert.equal(selected, undefined, 'same name cannot authorize a different device');
    assert.throws(() => bridge.select('other'), /DEVICE_INVALID/);
    contents.emit('select-bluetooth-device', event, [{deviceId: identity.id, deviceName: 'Unknown device'}], id => {
        selected = id;
    });
    assert.equal(selected, identity.id);
    const id = [...bridge.pending.keys()][0];
    bridge.reply({id, session: 0, data: 'new-origin-gatt-id'});
    assert.equal(await restoring, 'new-origin-gatt-id');
    assert.deepStrictEqual(bridge.getIdentity('new-origin-gatt-id'), identity);
    assert.equal(bridge.getIdentity('unapproved'), null);
    bridge.cancelScan();
    const cancelled = bridge.reconnectDevice(identity);
    contents.emit('render-process-gone');
    await assert.rejects(cancelled, /CANCELLED/);
    assert.equal(bridge.pending.size, 0); assert.equal(bridge.ready, false);
    console.log('BLE memory/reconnect: identity, pause/restart, backoff, cancellation, firmware guards, legacy lock migration and nonblocking interrupted-download retry passed.');
}
(async () => {
    monitorRecoveryTests(); await driverTests(); await bridgeTests(); await integrationTests(); await reconnectTests();
})().catch(error => {
    console.error(error); process.exitCode = 1;
});
