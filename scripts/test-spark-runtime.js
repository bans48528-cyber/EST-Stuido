/* eslint-disable global-require, require-await, func-style, require-jsdoc, max-len, no-undefined, require-atomic-updates */
const assert = require('assert');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const Module = require('module');
const {EventEmitter} = require('events');
const {spawnSync} = require('child_process');
const babel = require('@babel/core');
const root = path.resolve(__dirname, '..');
const loader = Module._extensions['.js'];
Module._extensions['.js'] = (module, filename) => {
    if (!filename.startsWith(path.join(root, 'src'))) return loader(module, filename);
    module._compile(babel.transformSync(fs.readFileSync(filename, 'utf8'), {
        babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs']
    }).code, filename);
};
const {sparkFrame, sparkDownloadFrames, validateSparkBytecode, normalizeSparkMonitor,
    SparkStreamParser, SparkError, SPARK_COMMAND: C} = require('../src/main/spark-ai/protocol');
const {SparkDeviceService} = require('../src/main/spark-ai/device-service');
const {SparkCompiler} = require('../src/main/spark-ai/compiler');
const {chooseSparkPort, sparkPortIdentity, sortSparkPorts} = require('../src/main/spark-ai/discovery');
const {SPARK_RUNTIME_MESSAGE_IDS, sparkRuntimeText} = require('../src/renderer/spark-ai/runtime-messages');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const ack = sparkFrame(C.ACK, [1]);
const monitor = (running = false, version = 110) => ({deviceList: [
    {port: 0, color: {lux: '100', state: '1', min: '10', max: '900', threadValue: '455'}},
    {port: 1, touch: {state: 1}}, {port: 2, ultrasion: {cm: '25'}}, {port: 3, ir_remote: {state: 2}}
],
flash: {total: '1024 kb', free: '512 kb'},
adc: {bat: '85%'},
version,
heap: '12',
WillAiState: running ? 'run' : 'stop'});
const bytecode = (size = 110) => {
    const data = Buffer.alloc(size);
    Buffer.from([0x0F, 0x70, 0x79, 0x6F]).copy(data);
    data.writeUInt32LE(size - 8, 4);
    data.writeUInt32LE(4, 8);
    data.writeUInt32LE(size - 20, 16);
    return data;
};
class FakeTransport extends EventEmitter {
    constructor () {
        super(); this.frames = []; this.closed = false; this.onWrite = null; this.version = 110;
    }
    async open () {
        this.opened = true;
    }
    async close () {
        this.closed = true; this.emit('closed');
    }
    report (running = false) {
        this.emit('data', Buffer.from(`${JSON.stringify(monitor(running, this.version))}\r\n`));
    }
    async write (bytes) {
        const command = bytes[4];
        this.frames.push(Buffer.from(bytes));
        if (this.onWrite && await this.onWrite(command, bytes) === false) return;
        if (command === C.MONITOR_ON || command === C.STOP) this.report();
        else if ([C.FILE, C.DATA, C.SAVE, C.RUN].includes(command)) {
            if (command === C.RUN) this.report(true);
            // Deliberately split an ACK across serial callbacks.
            this.emit('data', ack.subarray(0, 3)); this.emit('data', ack.subarray(3));
        }
    }
}
const createService = (options = {}) => {
    const transport = options.transport || new FakeTransport();
    const service = new SparkDeviceService({compiler: options.compiler || {compile: async () => bytecode()},
        listPorts: async () => [{path: 'COM_TEST'}],
        createTransport: () => transport,
        timeouts: {connect: 120,
            ack: 50,
            write: 120,
            monitor: 5000,
            stop: 120,
            start: 40,
            settle: 8,
            ...options.timeouts}});
    return {transport, service};
};
const withService = async (callback, options) => {
    const fixture = createService(options);
    try {
        await fixture.service.connect({path: 'COM_TEST'}); await callback(fixture);
    } finally {
        await fixture.service.shutdown();
    }
};
const fileCommands = transport => transport.frames.map(frame => frame[4]).filter(cmd =>
    [C.FILE, C.DATA, C.SAVE, C.RUN].includes(cmd));

async function protocolTests () {
    assert.equal(ack.toString('hex'), '5a979801fd0188a5');
    assert.equal(sparkFrame(C.STOP, [1]).toString('hex'), '5a979801b90144a5');
    assert.throws(() => sparkFrame(256), /FRAME_INVALID/);
    assert.throws(() => sparkFrame(1, Buffer.alloc(256)), /FRAME_INVALID/);
    for (const size of [1, 248, 249, 496, 497, 32767]) {
        for (const run of [false, true]) {
            const data = Buffer.alloc(size, 0x32);
            const frames = sparkDownloadFrames(data, 9, run);
            assert.equal(frames[0].payload.toString(), '9.o');
            assert.equal(frames.at(-1).command, run ? C.RUN : C.SAVE);
            assert.ok(frames.slice(1).every(frame => frame.payload.length > 0 && frame.payload.length <= 248));
            assert.deepStrictEqual(Buffer.concat(frames.slice(1).map(frame => frame.payload)), data);
            assert.equal(frames.at(-1).bytes, size);
        }
    }
    for (const slot of [-1, 10, 0.5, '0']) assert.throws(() => sparkDownloadFrames(Buffer.from([1]), slot), /SLOT_INVALID/);
    assert.throws(() => sparkDownloadFrames(Buffer.alloc(32768), 0), /PROGRAM_SIZE/);
    assert.deepStrictEqual(validateSparkBytecode(bytecode()), {size: 110, instructions: 4, constants: 90});
    for (const mutate of [b => {
        b[0] = 0;
    }, b => {
        b[4]++;
    }, b => {
        b[8] = 0xFF;
    },
    b => {
        b[16]++;
    }, b => {
        b[20] = 1;
    }, b => {
        b[b.length - 1] = 1;
    }]) {
        const data = bytecode(); mutate(data); assert.throws(() => validateSparkBytecode(data), /BYTECODE_INVALID/);
    }
    assert.equal(normalizeSparkMonitor(monitor()).battery, 85);
    assert.equal(normalizeSparkMonitor(monitor()).ports[3].type, 'ir_remote');
    const duplicate = monitor(); duplicate.deviceList[3].port = 0;
    assert.equal(normalizeSparkMonitor(duplicate), null);
    assert.equal(normalizeSparkMonitor({deviceList: [], version: 110, WillAiState: 'stop'}), null);
    const badNumber = monitor(); badNumber.adc.bat = '150%'; badNumber.deviceList[2].ultrasion.cm = 'NaN';
    assert.equal(normalizeSparkMonitor(badNumber).battery, null);
    assert.equal(normalizeSparkMonitor(badNumber).ports[2].values.cm, null);
    const stream = Buffer.concat([Buffer.from('日志一\r\n'), ack,
        Buffer.from(`${JSON.stringify(monitor())}\r\n`), ack, Buffer.from('tail\n')]);
    for (let split = 0; split <= stream.length; split++) {
        const parser = new SparkStreamParser(); const frames = []; const logs = []; const states = [];
        parser.on('frame', frame => frames.push(frame)); parser.on('log', line => logs.push(line));
        parser.on('monitor', status => states.push(status));
        parser.push(stream.subarray(0, split)); parser.push(stream.subarray(split));
        assert.equal(frames.length, 2, `split ${split}`); assert.equal(states.length, 1);
        assert.deepStrictEqual(logs, ['日志一', 'tail']);
    }
    const parser = new SparkStreamParser();
    let received = 0; let faults = 0;
    parser.on('frame', () => {
        received++;
    }); parser.on('fault', () => {
        faults++;
    });
    for (const index of [6, 7]) {
        const bad = Buffer.from(ack); bad[index] ^= 1; parser.push(bad);
    }
    for (const byte of ack) parser.push(Buffer.from([byte]));
    assert.equal(received, 1); assert.equal(faults, 2);
    for (let i = 0; i < 100; i++) parser.push(Buffer.alloc(1024, 65));
    assert.ok(parser.buffer.length <= 262 && parser.line.length <= 16384);
    parser.push(Buffer.alloc(65537)); assert.equal(faults, 3);
    for (const locale of ['zh-cn', 'en', 'pt-br', 'zh-tw', 'ru']) {
        for (const id of SPARK_RUNTIME_MESSAGE_IDS) assert.notEqual(sparkRuntimeText(id, locale), id);
    }
    console.log('Spark protocol: exact frames, 248-byte chunks, strict ACKs, bytecode validation, all stream split points and five locales passed.');
}

async function serviceTests () {
    await withService(async ({service, transport}) => {
        assert.equal(service.getState().compatible, true);
        const result = await service.downloadProgram({source: 'print(1)', slot: 9});
        assert.equal(result.downloaded, true); assert.equal(result.startRequested, undefined);
        assert.deepStrictEqual(fileCommands(transport), [C.FILE, C.SAVE]);
        assert.equal(transport.frames.find(frame => frame[4] === C.FILE).subarray(5, -2)
            .toString(), '9.o');
        const run = await service.downloadProgram({source: 'print(1)', slot: 0, run: true});
        assert.equal(run.runObserved, true, 'run indication before final ACK is retained');
        const beforeStop = Date.now();
        assert.equal((await service.stopCurrentProgram()).stopObserved, true);
        assert.ok(Date.now() - beforeStop >= 7, 'retain settling time after a fresh stop indication');
        assert.ok(!transport.frames.some(frame => frame[4] === 0xB6), 'never run a device-selected UI item');
        transport.report(true);
        const start = transport.frames.length;
        await service.downloadProgram({source: 'print(1)', slot: 0});
        assert.deepStrictEqual(transport.frames.slice(start).map(frame => frame[4]), [C.STOP, C.FILE, C.SAVE]);
        await service.setMonitoring(false); assert.equal(service.getState().monitoring, false);
        service.monitor.timestamp = 0;
        await service.downloadProgram({source: 'print(1)', slot: 0});
        assert.equal(service.monitorEnabled, true, 'program upload resumes monitor and waits for fresh JSON');
    });
    await withService(async ({service, transport}) => {
        transport.onWrite = command => {
            if (command === C.RUN) {
                transport.emit('data', ack); return false;
            }
        };
        const result = await service.downloadProgram({source: 'print(1)', slot: 1, run: true});
        assert.equal(result.runObserved, false);
        assert.equal(service.phase, 'start-unconfirmed');
        assert.equal(fileCommands(transport).filter(cmd => cmd === C.RUN).length, 1);
    });
    for (const reply of ['timeout', 'partial', 'wrong-ack', 'checksum', 'tail', 'write-error', 'unrelated']) {
        await withService(async ({service, transport}) => {
            transport.onWrite = command => {
                if (command !== C.FILE) return;
                let response;
                if (reply === 'partial') response = ack.subarray(0, 5);
                if (reply === 'wrong-ack') response = sparkFrame(C.ACK, [0]);
                if (reply === 'write-error') response = sparkFrame(0xF4, [0xF4]);
                if (reply === 'unrelated') response = sparkFrame(0xC3, [1]);
                if (reply === 'checksum' || reply === 'tail') {
                    response = Buffer.from(ack); response[reply === 'tail' ? 7 : 6] ^= 1;
                }
                if (response) transport.emit('data', response);
                return false;
            };
            await assert.rejects(service.downloadProgram({source: 'print(1)', slot: 0}), /DOWNLOAD_INCOMPLETE/);
            assert.deepStrictEqual(fileCommands(transport), [C.FILE], `${reply}: no retry or next frame`);
            assert.equal(transport.closed, true); assert.equal(service.connected, false);
            assert.equal(service.phase, 'disconnected');
            assert.equal(service.recoveryRequired, false);
            assert.equal(service.getState().warning, 'SPARK_DOWNLOAD_INCOMPLETE');
        });
    }
    await withService(async ({service, transport}) => {
        const collected = [];
        transport.onWrite = async (command, frame) => {
            if ([C.FILE, C.DATA, C.SAVE].includes(command)) {
                await pause(35); collected.push(frame); transport.emit('data', ack); return false;
            }
        };
        const result = await service.downloadProgram({source: 'print(1)', slot: 2});
        assert.equal(result.size, 5200);
        assert.deepStrictEqual(fileCommands(transport), [C.FILE, ...Array(20).fill(C.DATA), C.SAVE]);
        assert.deepStrictEqual(Buffer.concat(collected.slice(1).map(frame => frame.subarray(5, -2))), bytecode(5200));
        assert.equal(service.connected, true, 'legitimate monitor pause during transfer must not disconnect');
    }, {compiler: {compile: async () => bytecode(5200)}, timeouts: {monitor: 80, ack: 100}});
    await withService(async ({service, transport}) => {
        const writes = transport.frames.length;
        await assert.rejects(service.downloadProgram({source: 'bad', slot: 0}), /COMPILE_SYNTAX/);
        assert.equal(transport.frames.length, writes, 'compiler failure sends no hardware command');
    }, {compiler: {compile: async () => {
        throw new SparkError('SPARK_COMPILE_SYNTAX');
    }}});
    await withService(async ({service, transport}) => {
        transport.onWrite = command => {
            if (command === C.FILE) {
                service.cancel(); return false;
            }
        };
        await assert.rejects(service.downloadProgram({source: 'print(1)', slot: 0}), /DOWNLOAD_INCOMPLETE/);
        assert.equal(transport.closed, true);
    });
    await withService(async ({service, transport}) => {
        let release;
        service.compiler = {compile: async () => {
            await new Promise(resolve => {
                release = resolve;
            }); return bytecode();
        }};
        const job = service.downloadProgram({source: 'print(1)', slot: 0});
        await assert.rejects(service.downloadProgram({source: 'print(2)', slot: 1}), /BUSY/);
        service.cancel(); release();
        await assert.rejects(job, /CANCELLED/);
        assert.deepStrictEqual(fileCommands(transport), []); assert.equal(service.connected, true);
    });
    await withService(async ({service, transport}) => {
        transport.onWrite = command => {
            if (command === C.FILE) {
                transport.emit('closed'); return false;
            }
        };
        await assert.rejects(service.downloadProgram({source: 'print(1)', slot: 0}), /DOWNLOAD_INCOMPLETE/);
        const lastMonitor = service.monitor;
        transport.report(true);
        assert.strictEqual(service.monitor, lastMonitor, 'old transport callbacks cannot change a closed session');
        assert.equal(service.pythonProgramActive, false);
    });
    await withService(async ({service}) => {
        service.monitor.timestamp = 0;
        await assert.rejects(service.downloadProgram({source: 'print(1)', slot: 0}), /MONITOR_STALE/);
        assert.equal((await service.stopCurrentProgram()).stopObserved, true, 'stale monitor must not disable stop');
        service.monitor.version = 111;
        await assert.rejects(service.downloadProgram({source: 'print(1)', slot: 0}), /FIRMWARE_UNVERIFIED/);
        assert.equal((await service.stopCurrentProgram()).stopObserved, true, 'stop remains available on unverified firmware');
    });
    const {service} = createService();
    const first = service.connect({path: 'COM_TEST'});
    await assert.rejects(service.connect({path: 'COM_TEST'}), /BUSY/);
    assert.equal((await first).busy, false);
    await service.shutdown();
    assert.equal(service.publishTimer, null);
    assert.equal(service.listenerCount('monitor'), 0);
    assert.equal(service.listenerCount('lost'), 0);
    console.log('Spark service: download/run/stop, early run indication, unconfirmed quick programs, pause/resume, cancellation, corrupt ACKs, unplug, concurrency and recovery passed.');
}

async function discoveryTests () {
    const usb = {path: 'COM3', vendorId: '0483', productId: '5740', serialNumber: 'spark-one'};
    const other = {...usb, path: 'COM4', serialNumber: 'spark-two'};
    const bluetooth = {path: 'COM8', pnpId: 'BTHENUM\\something'};
    assert.equal(sortSparkPorts([bluetooth, usb])[0].path, 'COM3');
    assert.equal(chooseSparkPort([bluetooth]).status, 'waiting');
    assert.equal(chooseSparkPort([usb, other]).status, 'choose');
    assert.equal(chooseSparkPort([other], usb).status, 'waiting', 'do not substitute another board');
    assert.equal(chooseSparkPort([{...usb, path: 'COM12'}], usb).port.path, 'COM12');
    assert.equal(chooseSparkPort([usb], {path: 'COM3'}).status, 'choose', 'no identity means no silent replacement');
    assert.equal(sparkPortIdentity({...usb, vendorId: '0x0483'}), sparkPortIdentity(usb));
    const fixture = () => {
        const f = {ports: [usb], transports: [], lists: 0, passive: true};
        f.service = new SparkDeviceService({compiler: {compile: async () => bytecode()},
            listPorts: async () => {
                f.lists++; return f.ports;
            },
            createTransport: port => {
                const transport = new FakeTransport();
                transport.path = port;
                transport.open = async () => {
                    transport.opened = true;
                    if (f.passive) {
                        setTimeout(() => {
                            transport.writesBeforeMonitor = transport.frames.length;
                            transport.report();
                        }, 0);
                    }
                };
                f.transports.push(transport); return transport;
            },
            timeouts: {connect: 80, discovery: 60000, retry: 100, maxRetry: 400, ack: 50, settle: 1}});
        // Drive most passes explicitly, without timing-dependent polling.
        f.service.discoveryActive = true;
        return f;
    };
    const run = async callback => {
        const f = fixture();
        try {
            await callback(f);
        } finally {
            await f.service.shutdown();
        }
        assert.equal(f.service.discoveryTimer, null);
    };
    await run(async f => {
        f.ports = [bluetooth]; await f.service.discover();
        assert.equal(f.transports.length, 0, 'never probe Bluetooth or unrelated serial ports');
        f.ports = [usb, other]; await f.service.discover();
        assert.equal(f.transports.length, 0, 'multiple candidates require user choice');
        f.ports = [usb]; await f.service.discover();
        assert.equal(f.service.connected, true);
        assert.equal(f.transports[0].writesBeforeMonitor, 0, 'new candidates must prove protocol before any write');
        assert.deepStrictEqual(f.transports[0].frames.map(b => b[4]), [C.MONITOR_ON]);
        const lists = f.lists;
        await f.service.discover(); assert.equal(f.lists, lists, 'no enumeration on a healthy connection');
        f.transports[0].emit('closed');
        f.ports = [other]; await f.service.discover();
        assert.equal(f.transports.length, 1, 'do not reconnect to a different device');
        f.ports = [{...usb, path: 'COM12'}, other];
        f.passive = false;
        await f.service.discover();
        assert.equal(f.transports[1].path, 'COM12', 'verified serial identity survives a COM change');
        assert.deepStrictEqual(f.transports[1].frames.map(b => b[4]), [C.MONITOR_ON],
            'reconnect never downloads, runs, or stops a program');
        await f.service.disconnect();
        assert.equal(f.service.discovery.enabled, false);
        assert.equal(f.service.discovery.status, 'paused');
        await f.service.discover(); assert.equal(f.transports.length, 2, 'manual disconnect is respected');
        f.service.setAutoConnect(true); await f.service.discover();
        assert.equal(f.transports.length, 3, 'user can resume automatic connection');
    });
    await run(async f => {
        f.passive = false;
        await f.service.discover();
        assert.equal(f.service.connected, false);
        assert.equal(f.transports[0].closed, true);
        assert.equal(f.transports[0].frames.length, 0, 'foreign STM32 device receives no protocol command');
        assert.equal(f.service.discovery.status, 'retrying');
        await f.service.discover(); assert.equal(f.transports.length, 1, 'failed candidate has backoff');
        f.ports = []; await f.service.discover();
        f.ports = [usb]; f.passive = true; await f.service.discover();
        assert.equal(f.service.connected, true, 'replug clears a stale discovery backoff');
    });
    await run(async f => {
        f.service.lastDevice = usb;
        f.service.listPorts = async () => (++f.lists === 1 ? [usb] : [{...other, path: usb.path}]);
        await f.service.discover();
        assert.equal(f.transports.length, 0, 'revalidate identity if the same COM port changed during enumeration');
    });
    for (const failure of ['cancel', 'unplug', 'ack']) {
        await run(async f => {
            await f.service.discover();
            f.transports[0].onWrite = command => {
                if (command !== C.FILE) return;
                if (failure === 'cancel') f.service.cancel();
                if (failure === 'unplug') f.transports[0].emit('closed');
                return false;
            };
            await assert.rejects(f.service.downloadProgram({source: 'print(1)', slot: 0}), /DOWNLOAD_INCOMPLETE/);
            assert.equal(f.service.discovery.status, 'waiting');
            assert.equal(f.service.recoveryRequired, false, `${failure} must not lock reconnect`);
            assert.equal(f.service.getState().warning, 'SPARK_DOWNLOAD_INCOMPLETE');
            assert.doesNotThrow(() => f.service.setAutoConnect(true));
            await f.service.discover(); assert.equal(f.transports.length, 2);
            assert.equal(f.service.connected, true);
            assert.deepStrictEqual(fileCommands(f.transports[1]), [], 'reconnection must not resume the file');
            await f.service.downloadProgram({source: 'print(1)', slot: 0});
            assert.deepStrictEqual(fileCommands(f.transports[1]), [C.FILE, C.SAVE], 'user can immediately start a full download');
            assert.equal(f.service.getState().warning, null);
        });
    }
    await run(async f => {
        let release;
        f.service.listPorts = () => {
            f.lists++; return new Promise(resolve => {
                release = resolve;
            });
        };
        const automatic = f.service.discover();
        const manualList = f.service.listDevices();
        await pause(0);
        assert.equal(f.lists, 1, 'manual refresh and automatic scanning share one enumeration');
        f.service.setDiscoveryActive(false);
        release([usb]); await automatic; await manualList;
        assert.equal(f.transports.length, 0, 'late enumeration after hardware switch cannot open a port');
    });
    await run(async f => {
        f.service.operation = {};
        await f.service.discover(); assert.equal(f.lists, 0, 'no scan during a program transaction');
        f.service.operation = null;
        f.service.listPorts = async () => {
            throw new Error('enumeration failed');
        };
        await f.service.discover(); assert.equal(f.service.discovery.status, 'scan-error');
    });
    await run(async f => {
        f.service.setDiscoveryActive(false);
        await f.service.discover(); assert.equal(f.lists, 0);
        f.service.setDiscoveryActive(true);
        for (let i = 0; i < 100 && !f.service.monitor; i++) await pause(5);
        if (f.service.autoConnectPromise) await f.service.autoConnectPromise;
        assert.equal(f.service.connected, true, 'activation starts the background scheduler');
        f.service.setDiscoveryActive(false);
        const count = f.lists; await pause(25);
        assert.equal(f.lists, count);
        assert.equal(f.service.discoveryTimer, null);
    });
    await run(async f => {
        const create = f.service.createTransport;
        f.service.createTransport = port => {
            const transport = create(port);
            transport.open = async () => {
                await pause(30); transport.opened = true;
            };
            return transport;
        };
        f.service.setDiscoveryActive(false);
        f.service.setDiscoveryActive(true);
        for (let i = 0; i < 100 && !f.transports.length; i++) await pause(2);
        assert.equal(f.transports.length, 1);
        await f.service.shutdown();
        assert.equal(f.transports[0].closed, true);
        assert.equal(f.transports[0].frames.length, 0, 'late open after shutdown must not send BA');
        assert.equal(f.service.connected, false);
    });
    console.log('Spark discovery: passive verification, USB filtering, identity matching, backoff, manual pause, shared scans, nonblocking interrupted-download warnings and lifecycle passed.');
}

async function compilerTests () {
    if (process.platform !== 'win32' || process.arch !== 'x64') {
        console.log('SKIP native compiler: Windows x64 asset only.'); return;
    }
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'spark-runtime-test-'));
    try {
        const tempRoot = path.join(directory, '中文 编译路径');
        const samples = require('./spark-ai-compiler-fixtures.json');
        const executables = [process.execPath, require('electron')];
        for (const executable of executables) {
            const compiler = new SparkCompiler({executable, tempRoot});
            for (const sample of samples) {
                const bytes = await compiler.compile(sample.source);
                assert.deepStrictEqual(bytes, Buffer.from(sample.bytecodeHex, 'hex'),
                    `${path.basename(executable)}: original sample ${sample.slot} must match byte-for-byte`);
            }
            await assert.rejects(compiler.compile('if :\n @@@'), /COMPILE_/);
            await assert.rejects(compiler.compile(''), /SOURCE_INVALID/);
            validateSparkBytecode(await compiler.compile('pass'));
            const controller = new AbortController(); controller.abort();
            await assert.rejects(compiler.compile('print(1)', {signal: controller.signal}), /CANCELLED/);
            const results = await Promise.all([compiler.compile('print(1)'), compiler.compile('print(2)')]);
            assert.ok(!results[0].equals(results[1]), 'parallel jobs do not share old output');
            assert.deepStrictEqual(fs.readdirSync(tempRoot), [], 'temporary jobs are removed');
        }
        const timeoutCompiler = new SparkCompiler({tempRoot, timeoutMs: 1});
        await assert.rejects(timeoutCompiler.compile('print(1)'), /COMPILE_TIMEOUT/);
        assert.deepStrictEqual(fs.readdirSync(tempRoot), []);
        const controller = new AbortController();
        const cancelled = new SparkCompiler({tempRoot}).compile('print(1)', {signal: controller.signal});
        setTimeout(() => controller.abort(), 10);
        await assert.rejects(cancelled, /CANCELLED/);
        assert.deepStrictEqual(fs.readdirSync(tempRoot), []);
        const serialProbe = spawnSync(require('electron'), ['-e',
            'require("serialport").SerialPort.list().then(p=>console.log(JSON.stringify({ok:true,count:p.length}))).catch(e=>{console.error(e);process.exitCode=1})'],
        {cwd: root,
            windowsHide: true,
            timeout: 20000,
            encoding: 'utf8',
            env: {...process.env, ELECTRON_RUN_AS_NODE: '1', NODE_OPTIONS: ''}});
        assert.equal(serialProbe.status, 0, serialProbe.stderr);
        assert.ok(serialProbe.stdout.includes('"ok":true'), serialProbe.stdout);
        console.log('Spark native: Node and actual Electron compile samples byte-identically, Unicode paths, concurrent jobs, syntax errors, timeout/abort cleanup, and Electron serial driver enumeration passed.');
    } finally {
        fs.removeSync(directory);
    }
}

async function clientTests () {
    const originalRequire = Module._load;
    const ipc = new EventEmitter();
    const requests = [];
    ipc.invoke = () => new Promise(resolve => requests.push(resolve));
    Module._load = function (name, parent, main) {
        return name === 'electron' ? {ipcRenderer: ipc} : originalRequire.call(this, name, parent, main);
    };
    let subscribe;
    try {
        subscribe = require('../src/renderer/spark-ai/runtime-client').subscribeSparkState;
    } finally {
        Module._load = originalRequire;
    }
    const states = [];
    const offA = subscribe(state => states.push(state));
    const offB = subscribe(() => {});
    assert.equal(requests.length, 1, 'one initial state IPC shared by both widgets');
    assert.equal(ipc.listenerCount('spark-state-change'), 1);
    ipc.emit('spark-state-change', null, {connected: true});
    requests[0]({connected: false}); await pause(0);
    assert.equal(states.at(-1).connected, true, 'late initial reply cannot overwrite a newer event');
    offA(); offB();
    assert.equal(ipc.listenerCount('spark-state-change'), 0, 'hardware switch removes state listeners');
    const nextStates = [];
    const offC = subscribe(state => nextStates.push(state));
    assert.equal(nextStates.length, 0, 'remount cannot display a stale connected cache');
    requests[1]({connected: false}); await pause(0);
    assert.equal(nextStates.at(-1).connected, false);
    offC();
    console.log('Spark renderer subscription: shared IPC, no late-state overwrite, no stale connected cache or retained listeners passed.');
}

(async () => {
    await protocolTests(); await serviceTests(); await discoveryTests(); await compilerTests(); await clientTests();
})()
    .catch(error => {
        console.error(error); process.exitCode = 1;
    });
