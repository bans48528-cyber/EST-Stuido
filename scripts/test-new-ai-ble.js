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
const {NewAiDeviceService} = require('../src/main/new-ai/device-service');
const {NewAiBleBridge} = require('../src/main/new-ai/ble-bridge');
const {SparkBleBridge} = require('../src/main/spark-ai/ble-bridge');
const {NewAiBleDriver} = require('../src/renderer/new-ai/ble-driver');
const {NewAiConnectionPreferences} = require('../src/main/new-ai/connection-preferences');
const {NewAiStreamParser, newAiFrame, newAiDownloadFrames, NEW_COMMAND: C} = require('../src/main/new-ai/protocol');
const {NewAiFirmwareUpdateService} = require('../src/main/new-ai/firmware-update-service');
const {newAiFirmwareBlockers} = require('../src/common/new-ai-firmware');
const {newAiText} = require('../src/renderer/new-ai/runtime-messages');
const bleMessages = require('../src/renderer/new-ai/ble-messages').default;
const {NEW_AI_BLE_SERVICE, NEW_AI_BLE_CHARACTERISTIC} = require('../src/common/new-ai-ble');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const until = async predicate => {
    for (let i = 0; i < 300; i++) {
        if (predicate()) return; await pause(5);
    }
    assert.fail('NEW AI BLE test timed out');
};
const monitor = (running = false) => ({deviceList: Array.from({length: 8}, (_, port) => ({port})),
    version: 321,
    NewAiState: running ? 'run' : 'stop',
    MAC: '00:11:22:33:44:55'});
const bytecode = Buffer.alloc(600);
Buffer.from([15, 112, 121, 111]).copy(bytecode);
bytecode.writeUInt32LE(592, 4); bytecode.writeUInt32LE(4, 8); bytecode.writeUInt32LE(580, 16);
class Target extends EventEmitter {
    addEventListener (name, fn) {
        this.on(name, fn);
    }
    removeEventListener (name, fn) {
        this.removeListener(name, fn);
    }
}
const fixtures = [];
let fixtureNumber = 0;
const create = (preferences, options = {}) => {
    const chooserId = '00:11:22:33:44:55';
    const opaqueId = `origin-specific-${++fixtureNumber}`;
    const contents = new EventEmitter();
    contents.isDestroyed = () => false;
    let running = false; let timer;
    let target = true; let activeHardware = true;
    const frames = []; const pieces = []; const sent = []; const context = {};
    const bridge = new NewAiBleBridge({allowed: () => activeHardware && context.service.connectionMode === 'ble',
        scanTimeout: 50,
        requestTimeout: 250});
    // Both bridges attach to the real main window: the inactive bridge must never cancel the other's chooser.
    const spark = new SparkBleBridge({allowed: () => false});
    spark.attach(contents); bridge.attach(contents); bridge.ready = true;
    const characteristic = new Target();
    characteristic.properties = {notify: true, writeWithoutResponse: true};
    const notify = bytes => {
        for (let offset = 0; offset < bytes.length; offset += 20) {
            const piece = bytes.subarray(offset, offset + 20);
            const padded = Buffer.concat([Buffer.from([0xFF]), piece]);
            characteristic.emit('characteristicvaluechanged',
                {target: {value: new DataView(padded.buffer, padded.byteOffset + 1, piece.length)}});
        }
    };
    const report = () => notify(Buffer.from(JSON.stringify(options.report || monitor(running))));
    const receiver = new NewAiStreamParser();
    receiver.on('frame', frame => {
        frames.push(frame);
        if (options.dropAck) return;
        notify(newAiFrame(C.ACK, [1]));
        if (frame.command === C.SAVE_RUN) running = true;
        if (frame.command === C.STOP_TOGGLE) running = !running;
        report();
    });
    characteristic.writeValueWithoutResponse = async piece => {
        pieces.push(Buffer.from(piece));
        if (options.failWrite) throw new Error('radio failure');
        receiver.push(piece);
    };
    characteristic.startNotifications = async () => {
        report(); timer = setInterval(report, 8);
    };
    const device = new Target(); device.id = opaqueId;
    device.gatt = {connected: false,
        connect: async () => {
            device.gatt.connected = true; return device.gatt;
        },
        disconnect: () => {
            clearInterval(timer); device.gatt.connected = false; device.emit('gattserverdisconnected');
        },
        getPrimaryService: async uuid => {
            assert.equal(uuid, NEW_AI_BLE_SERVICE);
            return {getCharacteristic: async id => {
                assert.equal(id, NEW_AI_BLE_CHARACTERISTIC); return characteristic;
            }};
        }};
    const bluetooth = {requestDevice: request => new Promise((resolve, reject) => {
        assert.deepStrictEqual(request.filters, [{services: [NEW_AI_BLE_SERVICE]}, {namePrefix: 'EST_BLUE'}]);
        assert.deepStrictEqual(request.optionalServices, [NEW_AI_BLE_SERVICE]);
        const devices = [{deviceId: 'OTHER', deviceName: 'EST_BLUE'}];
        if (target) devices.push({deviceId: chooserId, deviceName: 'EST_BLUE NEW AI'});
        contents.emit('select-bluetooth-device', {preventDefault () {}}, devices, id => {
            if (id === chooserId) resolve(device);
            else reject(Object.assign(new Error('not selected'), {name: 'NotFoundError'}));
        });
    })};
    const driver = new NewAiBleDriver({bluetooth, emit: message => bridge.receive(message)});
    const handle = async message => {
        const {id, session, action, data} = message;
        try {
            let result;
            if (action === 'choose') result = await driver.choose();
            else if (action === 'open') await driver.open(session, data.id);
            else if (action === 'write') await driver.write(session, data);
            else if (action === 'close') await driver.close(session);
            bridge.reply({id, session, data: result});
        } catch (error) {
            bridge.reply({id, session, error: error.message});
        }
    };
    contents.send = (channel, message) => {
        sent.push(channel);
        if (channel === 'new-ai-ble-request') handle(message);
        if (channel === 'new-ai-ble-abort') driver.close(message.session);
        if (channel === 'new-ai-ble-scan-state' && message.cancelled) driver.cancelChoice();
    };
    contents.executeJavaScript = async source => {
        assert.ok(source.includes("CustomEvent('new-ai-ble-choose'"));
        const json = /\{detail: (.+)\}\)\)/.exec(source);
        assert.ok(json, source); await handle(JSON.parse(json[1]));
    };
    const service = new NewAiDeviceService({preferences,
        listPorts: async () => {
            assert.fail('BLE must not enumerate or open USB');
        },
        createTransport: () => {
            assert.fail('BLE must not use USB transport');
        },
        createBleTransport: id => bridge.createTransport(id),
        reconnectBleDevice: identity => bridge.reconnectDevice(identity),
        getBleIdentity: id => bridge.getIdentity(id),
        isBleReady: () => bridge.ready,
        compiler: {supported: true, compile: async () => bytecode},
        timeouts: {bleIdentify: 80,
            bleOpen: 200,
            bleClose: 200,
            bleFresh: 100,
            scan: 10,
            retry: 100,
            ack: 60,
            write: 100,
            start: 100,
            stop: 100}});
    context.service = service;
    service.on('cancel-ble-scan', () => bridge.cancelScan());
    const fixture = {service,
        bridge,
        driver,
        device,
        characteristic,
        frames,
        pieces,
        sent,
        chooserId,
        get running () {
            return running;
        },
        report,
        setTarget: present => {
            target = present;
        },
        deactivate: () => {
            activeHardware = false; service.setDiscoveryActive(false);
        },
        connect: async () => {
            bridge.beginScan(); const choice = driver.choose(); bridge.select(chooserId);
            const id = await choice; bridge.bindDevice(id); return service.connect({type: 'ble', id});
        },
        close: async () => {
            await service.shutdown(); bridge.reset(); spark.reset(); clearInterval(timer);
        }};
    fixtures.push(fixture); return fixture;
};

const parserTests = () => {
    const json = JSON.stringify({...monitor(),
        deviceList: monitor().deviceList.map(item => (item.port === 0 ?
            {...item, camera: {configs: [{name: '中文 } { " 目标', id: 1}]}} : item))});
    const stream = Buffer.concat([Buffer.from(json), newAiFrame(C.ACK, [1]), Buffer.from(json)]);
    for (let split = 0; split <= stream.length; split++) {
        const parser = new NewAiStreamParser({recoverBleMonitor: true}); const states = []; const frames = [];
        parser.on('monitor', value => states.push(value)); parser.on('frame', value => frames.push(value));
        parser.push(stream.subarray(0, split)); parser.push(stream.subarray(split));
        assert.equal(states.length, 2, `coalesced reports/UTF-8/ACK split ${split}`);
        assert.equal(frames.length, 1);
    }
    for (const end of [20, json.length - 3, json.indexOf('中文') + 1]) {
        const parser = new NewAiStreamParser({recoverBleMonitor: true}); const states = [];
        parser.on('monitor', state => states.push(state));
        parser.push(Buffer.from(json.slice(0, end))); parser.push(Buffer.from(json));
        assert.equal(states.length, 1, `recover only complete new envelope after lost fragment ${end}`);
    }
    const parser = new NewAiStreamParser({recoverBleMonitor: true});
    parser.push(Buffer.alloc(20000, 0x61)); assert.ok(parser.pending.length <= 16384);
    for (const chunk of [128, 248]) {
        const frames = newAiDownloadFrames(bytecode, 19, true, chunk);
        assert.ok(frames.slice(1).every(frame => frame.payload.length <= chunk));
        assert.equal(frames.at(-1).command, C.SAVE_RUN);
        assert.ok(Buffer.concat(frames.slice(1).map(frame => frame.payload)).equals(bytecode));
    }
    assert.throws(() => newAiDownloadFrames(bytecode, 0, false, 20), /NEW_REQUEST_INVALID/);
};

(async () => {
    parserTests();
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'est-new-ble-'));
    const preferences = new NewAiConnectionPreferences(path.join(directory, 'connection.json'));
    preferences.write({mode: 'ble', lastDevice: {vendorId: '0483', productId: '5740', serialNumber: 'USB-KEEP'}});
    const first = create(preferences);
    await first.connect();
    assert.equal(first.service.getState().identityVerified, true);
    assert.equal(preferences.read().bleDevice.id, first.chooserId, 'persist chooser identity, never opaque GATT id');
    assert.equal(preferences.read().lastDevice.serialNumber, 'USB-KEEP');
    const download = await first.service.downloadProgram({source: 'pass\n', slot: 9});
    assert.equal(download.downloaded, true);
    assert.ok(first.frames.filter(frame => frame.command === C.DATA).every(frame => frame.payload.length === 128));
    assert.equal(first.frames.at(-1).command, C.SAVE);
    assert.ok(first.pieces.every(piece => piece.length <= 20));
    const run = await first.service.runProgram({source: 'pass\n', slot: 9});
    assert.equal(run.runObserved, true);
    await assert.rejects(first.service.setConnectionMode('usb'), /NEW_RUNNING/);
    await first.service.stopCurrentProgram();
    assert.equal(first.running, false);
    const toggles = first.frames.filter(frame => frame.command === C.STOP_TOGGLE).length;
    await first.service.stopCurrentProgram();
    assert.equal(first.frames.filter(frame => frame.command === C.STOP_TOGGLE).length, toggles);
    assert.equal(toggles, 1);
    assert.ok(newAiFirmwareBlockers(first.service.getState(), {valid: true}).includes('NEW_FW_USB_ONLY'));
    assert.throws(() => new NewAiFirmwareUpdateService({device: first.service}).start({confirmedErase: true}),
        /NEW_FW_USB_ONLY/);
    const framesBefore = first.frames.length;
    await first.service.disconnect();
    assert.equal(first.frames.length, framesBefore, 'disconnect must not send program or firmware commands');
    assert.equal(preferences.read().bleAuto, false);
    await first.close();

    const restarted = create(new NewAiConnectionPreferences(preferences.filename));
    restarted.service.setDiscoveryActive(true); await pause(35);
    assert.equal(restarted.sent.filter(channel => channel === 'new-ai-ble-request').length, 0);
    restarted.service.setAutoConnect(true);
    await until(() => restarted.service.connected);
    assert.equal(restarted.service.getState().bleDevice.id, first.chooserId);
    restarted.deactivate();
    await restarted.service.disconnect({pauseAuto: false});
    assert.equal(preferences.read().bleAuto, true, 'hardware switching/exit preserves automatic connection');
    await restarted.close();

    const missing = create(preferences); missing.setTarget(false);
    missing.service.setDiscoveryActive(true);
    await until(() => missing.service.getState().discovery.status === 'retrying');
    assert.equal(missing.device.gatt.connected, false, 'never substitute another device advertising EST_BLUE');
    missing.service.setAutoConnect(false); await until(() => !missing.service.bleReconnecting);
    assert.equal(missing.service.getState().connected, false); await missing.close();

    const before = fs.readFileSync(preferences.filename, 'utf8');
    const wrong = create(preferences, {report: {deviceList: [0, 1, 2, 3].map(port => ({port})),
        version: 110,
        WillAiState: 'stop'}});
    await assert.rejects(wrong.connect(), /NEW_WRONG_DEVICE/);
    assert.equal(fs.readFileSync(preferences.filename, 'utf8'), before);
    await wrong.close();
    const failed = create(preferences, {failWrite: true});
    await failed.connect();
    await assert.rejects(failed.service.downloadProgram({source: 'pass\n', slot: 9}), /NEW_BLE_WRITE|NEW_DISCONNECTED/);
    assert.equal(failed.service.connected, false);
    assert.equal(failed.pieces.length, 1, 'uncertain BLE write must stop all later fragments');
    await failed.close();

    for (const locale of ['zh-cn', 'en', 'pt-br', 'zh-tw', 'ru']) {
        for (const key of Object.keys(bleMessages)) assert.ok(newAiText(key, locale), `${locale} ${key}`);
    }
    console.log('NEW AI BLE passed: isolated chooser/GATT sessions, exact UUIDs, all JSON/ACK/UTF-8 splits, ' +
        'lost tails, 128-byte save/run, 20-byte writes, fresh-state stop without duplicate toggle, ' +
        'USB suppression, firmware guard, persistent identity/pause/restart, missing/wrong device and write failure.');
})().catch(error => {
    console.error(error); process.exitCode = 1;
})
    .finally(async () => {
        for (const fixture of fixtures) await fixture.close();
    });
