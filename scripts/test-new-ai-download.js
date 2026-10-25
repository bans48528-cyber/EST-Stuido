/* eslint-disable global-require, require-await */
const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const Module = require('module');
const {spawnSync} = require('child_process');
const {EventEmitter} = require('events');
const babel = require('@babel/core');
const electronProbe = process.argv.includes('--electron-compile');
const programs = electronProbe ? [] : require('./test-new-ai-blocks').programs;
const root = path.resolve(__dirname, '..');
const original = Module._extensions['.js'];
Module._extensions['.js'] = (module, filename) => {
    if (!filename.startsWith(path.join(root, 'src'))) return original(module, filename);
    module._compile(babel.transformSync(fs.readFileSync(filename, 'utf8'), {
        babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs']
    }).code, filename);
};
const {NewAiCompiler} = require('../src/main/new-ai/compiler');
const {NewAiDeviceService} = require('../src/main/new-ai/device-service');
const {NewAiStreamParser, newAiFrame, newAiDownloadFrames, validateNewAiBytecode,
    NEW_COMMAND: C} = require('../src/main/new-ai/protocol');
const samples = require('./new-ai-compiler-fixtures.json');
const port = {path: 'COM_NEW', vendorId: '0483', productId: '5740', serialNumber: 'DOWNLOAD_TEST'};
const monitor = (running = false, version = 321) => ({version,
    NewAiState: running ? 'run' : 'stop',
    deviceList: Array.from({length: 8}, (_, index) => ({port: index}))});
const bytecode = size => {
    const result = Buffer.alloc(size);
    Buffer.from([15, 112, 121, 111]).copy(result);
    result.writeUInt32LE(size - 8, 4); result.writeUInt32LE(4, 8); result.writeUInt32LE(size - 20, 16);
    return result;
};
class Transport extends EventEmitter {
    constructor () {
        super(); this.frames = []; this.version = 321;
    }
    async open () {
        this.report();
    }
    report (running = false) {
        this.emit('data', Buffer.from(`${JSON.stringify(monitor(running, this.version))}\r\n`));
    }
    async write (frame) {
        this.frames.push(frame);
        if (this.onWrite && this.onWrite(frame) === false) return;
        this.report();
        const ack = newAiFrame(C.ACK, [1]);
        this.emit('data', ack.subarray(0, 2));
        this.emit('data', ack.subarray(2));
    }
    async close () {
        this.closed = true; this.emit('closed');
    }
}
const create = async (options = {}) => {
    const transport = new Transport();
    if (options.version) transport.version = options.version;
    const compiler = options.compiler || {supported: true, compile: async () => bytecode(600)};
    const service = new NewAiDeviceService({compiler,
        listPorts: async () => [port],
        createTransport: () => transport,
        timeouts: {ack: 40, write: 40, stale: 5000, ...options.timeouts}});
    await service.connect({path: port.path});
    return {service, transport};
};
(async () => {
    const compiler = new NewAiCompiler({root: path.join(root, 'resources/new-ai')});
    if (electronProbe) {
        for (const sample of samples) {
            assert.equal((await compiler.compile(sample.source)).toString('hex'),
                sample.bytecodeHex);
        }
        require('electron').app.exit(0);
        return;
    }
    assert.equal(newAiFrame(C.FILE, Buffer.from('0.o')).toString('hex'), '5a979803da302e6f33a5');
    assert.equal(newAiFrame(C.SAVE, [0, 1, 2, 3]).toString('hex'), '5a979804bb000102034ea5');
    for (const slot of [0, 19]) {
        const frames = newAiDownloadFrames(bytecode(600), slot);
        assert.deepStrictEqual(frames.map(frame => frame.command), [C.FILE, C.DATA, C.DATA, C.SAVE]);
        assert.deepStrictEqual(frames.slice(1).map(frame => frame.payload.length), [248, 248, 104]);
        assert.equal(frames[0].payload.toString(), `${slot}.o`);
    }
    assert.deepStrictEqual(newAiDownloadFrames(bytecode(496), 0).slice(1)
        .map(frame => frame.command), [C.DATA, C.SAVE]);
    for (const slot of [-1, 20, '0', 0.5]) assert.throws(() => newAiDownloadFrames(bytecode(100), slot));
    for (const data of [Buffer.alloc(0), Buffer.alloc(32768), Buffer.alloc(32)]) {
        assert.throws(() => validateNewAiBytecode(data));
    }
    const wire = Buffer.concat([Buffer.from('log\r\n'), newAiFrame(C.ACK, [1]),
        Buffer.from(`${JSON.stringify(monitor())}\r\n`), newAiFrame(C.ERROR, [1])]);
    for (let split = 0; split <= wire.length; split++) {
        const parser = new NewAiStreamParser(); const frames = []; const states = [];
        parser.on('frame', frame => frames.push(frame)); parser.on('monitor', state => states.push(state));
        parser.push(wire.subarray(0, split)); parser.push(wire.subarray(split));
        assert.deepStrictEqual(frames.map(frame => frame.command), [C.ACK, C.ERROR], `split ${split}`);
        assert.equal(states.length, 1);
    }
    {
        const parser = new NewAiStreamParser(); const frames = []; const states = [];
        parser.on('frame', frame => frames.push(frame)); parser.on('monitor', state => states.push(state));
        const json = Buffer.from(`${JSON.stringify(monitor())}\r\n`);
        parser.push(Buffer.concat([json.subarray(0, 30), newAiFrame(C.ACK, [1]), json.subarray(30)]));
        assert.equal(states.length, 1, 'binary ACKs between JSON fragments must not corrupt telemetry');
        assert.equal(frames.length, 1);
    }
    {
        const {service, transport} = await create();
        const result = await service.downloadProgram({source: 'print(1)', slot: 19});
        assert.equal(result.downloaded, true); assert.equal(result.slot, 19);
        assert.equal(service.getState().operation, null);
        assert.equal(service.getState().result.downloaded, true);
        assert.deepStrictEqual(transport.frames.map(frame => frame[4]), [C.FILE, C.DATA, C.DATA, C.SAVE]);
        assert.equal(service.monitor.running, false, 'download must not run a program');
        await service.shutdown();
    }
    for (const reply of [newAiFrame(C.ERROR, [1]), newAiFrame(C.ACK, [0]),
        Buffer.from('5a979801fd018800', 'hex'), newAiFrame(0x01, [1]), null]) {
        const {service, transport} = await create();
        transport.onWrite = () => {
            if (reply) transport.emit('data', reply);
            return false;
        };
        await assert.rejects(service.downloadProgram({source: 'print(1)', slot: 0}));
        assert.equal(transport.frames.length, 1, 'invalid/missing ACK must never advance a data chunk');
        assert.equal(service.getState().result, null);
        assert.equal(service.getState().warning, 'NEW_DOWNLOAD_INCOMPLETE');
        assert.ok(transport.closed);
        await service.shutdown();
    }
    {
        const {service, transport} = await create();
        transport.onWrite = () => {
            service.cancel(); return false;
        };
        await assert.rejects(service.downloadProgram({source: 'print(1)', slot: 0}), /NEW_CANCELLED/);
        assert.equal(transport.frames.length, 1);
        await service.shutdown();
    }
    {
        const {service, transport} = await create();
        transport.onWrite = () => {
            transport.emit('closed'); return false;
        };
        await assert.rejects(service.downloadProgram({source: 'print(1)', slot: 0}));
        assert.equal(transport.frames.length, 1);
        await service.shutdown();
    }
    {
        const {service, transport} = await create();
        transport.report(true);
        await assert.rejects(service.downloadProgram({source: 'print(1)', slot: 0}), /NEW_RUNNING/);
        assert.equal(transport.frames.length, 0);
        transport.report(false); service.monitor.timestamp = 0;
        await assert.rejects(service.downloadProgram({source: 'print(1)', slot: 0}), /NEW_STATUS_STALE/);
        await service.shutdown();
    }
    {
        const {service, transport} = await create({version: 320});
        assert.equal(service.getState().downloadSupported, false);
        await assert.rejects(service.downloadProgram({source: 'print(1)', slot: 0}), /NEW_VERSION_UNSUPPORTED/);
        assert.equal(transport.frames.length, 0);
        await service.shutdown();
    }
    {
        let release;
        const {service, transport} = await create({compiler: {supported: true,
            compile: () => new Promise(resolve => {
                release = resolve;
            })}});
        const job = service.downloadProgram({source: 'print(1)', slot: 0});
        await assert.rejects(service.compileProgram({source: 'print(2)'}), /NEW_BUSY/);
        await assert.rejects(service.disconnect(), /NEW_BUSY/);
        transport.report(true); release(bytecode(100));
        await assert.rejects(job, /NEW_RUNNING/);
        assert.equal(transport.frames.length, 0, 'recheck fresh device state after compilation');
        await service.shutdown();
    }
    if (compiler.supported) {
        for (const sample of samples) {
            const bytes = await compiler.compile(sample.source);
            assert.equal(bytes.toString('hex'), sample.bytecodeHex, 'original sample byte-exact');
        }
        for (const program of programs) await compiler.compile(program.source.trim() ? program.source : 'pass');
        await assert.rejects(compiler.compile('print(\n'), /NEW_COMPILE_SYNTAX/);
        await assert.rejects(compiler.compile(`print('${'x'.repeat(35000)}')`), /NEW_PROGRAM_SIZE/);
        await assert.rejects(compiler.compile('x\0'), /NEW_SOURCE_INVALID/);
        const concurrent = await Promise.all(samples.map(sample => compiler.compile(sample.source)));
        assert.ok(concurrent.every((value, index) => value.toString('hex') === samples[index].bytecodeHex));
        const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'new-ai-compiler-test-'));
        try {
            const unicode = new NewAiCompiler({root: compiler.root, tempRoot: path.join(temporary, '中文 路径')});
            await unicode.compile("print('中国')");
            assert.deepStrictEqual(await fs.readdir(unicode.tempRoot), []);
            const fake = new NewAiCompiler({root: compiler.root,
                tempRoot: temporary,
                timeoutMs: 10,
                spawnProcess: (executable, args, options) => {
                    assert.equal(options.shell, false); assert.equal(options.windowsHide, true);
                    assert.deepStrictEqual(args, ['-c', 'program.py', '-o', 'program.py.o']);
                    const child = new EventEmitter();
                    child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
                    child.kill = () => {
                        queueMicrotask(() => child.emit('close', 1));
                    };
                    return child;
                }});
            await assert.rejects(fake.compile('print(1)'), /NEW_COMPILE_TIMEOUT/);
            const controller = new AbortController();
            const cancelled = fake.compile('print(1)', {signal: controller.signal});
            controller.abort();
            await assert.rejects(cancelled, /NEW_CANCELLED/);
            await fs.copy(compiler.root, path.join(temporary, 'tampered'));
            await fs.appendFile(path.join(temporary, 'tampered/win32/pika-python.exe'), 'bad');
            const tampered = new NewAiCompiler({root: path.join(temporary, 'tampered')});
            await assert.rejects(tampered.compile('print(1)'), /NEW_COMPILER_INVALID/);
        } finally {
            const relative = path.relative(path.resolve(os.tmpdir()), path.resolve(temporary));
            assert.match(relative, /^new-ai-compiler-test-[^\\/]+$/);
            await fs.remove(temporary);
        }
        const electron = spawnSync(require('electron'), [__filename, '--electron-compile'], {
            windowsHide: true, encoding: 'utf8', timeout: 30000, env: {...process.env, NODE_OPTIONS: ''}
        });
        assert.equal(electron.status, 0, electron.stdout + electron.stderr);
        console.log(`NEW AI original compiler: 2 byte-exact fixtures, ${programs.length} generated programs, ` +
            'Node/Electron, Unicode paths, concurrency, syntax/size/integrity, timeout and cancellation passed.');
    }
    console.log('NEW AI download passed: slots 0-19, USB 248-byte chunks, strict ACK/error/tail/checksum, ' +
        'split/interleaved frames, no run commands, stale/running/version guards, cancellation and disconnect.');
})().catch(error => {
    console.error(error);
    if (process.versions.electron) require('electron').app.exit(1);
    else process.exitCode = 1;
});
