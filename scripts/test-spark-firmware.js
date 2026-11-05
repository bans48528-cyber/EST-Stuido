/* eslint-disable global-require, max-len, require-await, func-style, require-jsdoc */
const assert = require('assert');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const Module = require('module');
const {spawnSync} = require('child_process');
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
const release = require('../src/main/spark-ai/firmware-release.json');
const {SparkFirmwareUpdateService, getSparkFirmwareRoot} = require('../src/main/spark-ai/firmware-update-service');
const {sparkFirmwareBlockers, sparkFirmwareMismatchKey} = require('../src/common/spark-firmware');
const {sparkRuntimeText} = require('../src/renderer/spark-ai/runtime-messages');
const {HardwareSession} = require('../src/main/hardware/session');
const {SparkDeviceService} = require('../src/main/spark-ai/device-service');
const {sparkFrame} = require('../src/main/spark-ai/protocol');
const {SparkFirmwareLink} = require('../src/main/spark-ai/firmware-link');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const portFor = name => ({path: name, vendorId: '0483', productId: '5740', serialNumber: 'SPARK_TEST'});
const request = {confirmedErase: true, recovery: false, releaseId: release.id};
const monitor = version => ({deviceList: [0, 1, 2, 3].map(port => ({port})),
    version,
    WillAiState: 'stop',
    adc: {bat: '95%'},
    flash: {free: '500 kb', total: '960 kb'}});

class MockFirmwareTransport extends EventEmitter {
    constructor (hardware, port) {
        super(); this.hardware = hardware; this.path = port;
    }
    async open () {
        this.hardware.opens = (this.hardware.opens || 0) + 1;
        if (this.hardware.retainUsb && this.hardware.mode === 'boot') {
            throw Error('The existing boot handle must not be closed');
        }
        this.hardware.active = this;
        if (this.hardware.mode === 'app') setImmediate(() => this.report());
    }
    report () {
        if (!this.closed) {
            this.emit('data', Buffer.from(`${JSON.stringify({...monitor(this.hardware.version),
                WillAiState: this.hardware.running ? 'run' : 'stop'})}\r\n`));
        }
    }
    async close () {
        if (this.closed) return;
        this.closed = true; this.emit('closed');
    }
    async write (bytes) {
        const h = this.hardware;
        h.writes.push(Buffer.from(bytes));
        const command = bytes[4];
        const data = bytes.subarray(5, -2);
        assert.equal(bytes[3], data.length);
        assert.equal(bytes[bytes.length - 2], bytes.subarray(0, -2).reduce((sum, byte) => (sum + byte) & 255, 0));
        if (h.mode === 'app') {
            if (command === 0xBA) this.report();
            else if (command === 0x6F) {
                assert.equal(data.toString(), 'RESET_FWLIB');
                if (h.retainUsb) this.report();
                h.mode = 'boot'; h.running = false; h.files.clear();
                if (!h.retainUsb) await this.close();
            } else throw new Error(`Unexpected APP write ${command}`);
            return;
        }
        h.frames++;
        if (h.failAt === h.frames) {
            this.emit('data', sparkFrame(0xF4, [0xF4])); return;
        }
        if (h.disconnectAt === h.frames) {
            await this.close(); return;
        }
        if (h.timeoutAt === h.frames) return;
        if (command === 0xDA || command === 0xDD) {
            h.file = data.toString('ascii'); h.names.push({command, name: h.file});
            h.files.set(h.file, Buffer.alloc(0));
        } else {
            assert.ok([0xAA, 0xBB].includes(command), 'firmware must never use BC');
            assert.ok(data.length <= 248 && data.length > 0);
            assert.ok(h.file);
            h.files.set(h.file, Buffer.concat([h.files.get(h.file), data]));
            if (command === 0xBB) h.file = null;
        }
        const ack = h.badAckAt === h.frames ? sparkFrame(0xFD, [0]) : sparkFrame(0xFD, [1]);
        this.emit('data', ack.subarray(0, 3));
        await new Promise(resolve => setImmediate(resolve));
        this.emit('data', ack.subarray(3));
        if (command === 0xBB && h.files.has('updata.txt') && !h.file && !h.noApplication) {
            assert.equal(h.files.size, 5, 'commit marker must be the last complete file');
            if (h.lateOldReport) setTimeout(() => this.report(), 2);
            h.timer = setTimeout(() => {
                h.mode = 'app'; h.version = h.nextVersion || release.version;
                this.close();
            }, 8);
        }
    }
}
const fixture = (options = {}) => {
    const hardware = {mode: 'app', version: release.version, writes: [], names: [], files: new Map(), frames: 0, ...options};
    const device = new SparkDeviceService({
        listPorts: async () => [portFor(hardware.mode === 'boot' && !hardware.retainUsb ? 'COM_BOOT' : 'COM_APP')],
        createTransport: port => new MockFirmwareTransport(hardware, port),
        timeouts: {connect: 150, monitor: 5000}
    });
    const updater = new SparkFirmwareUpdateService({device,
        timeouts: {bootDelay: 1, boot: 120, application: 180, poll: 2, ack: 100, write: 100, gap: 500}});
    return {hardware,
        device,
        updater,
        cleanup: async () => {
            if (updater.done) await updater.done.catch(() => {});
            clearTimeout(hardware.timer); await device.shutdown();
        }};
};

async function updateIntegrationTests () {
    const good = fixture();
    try {
        await good.device.connect({path: 'COM_APP'});
        const progress = [];
        good.device.on('state', state => {
            if (state.firmware) progress.push(state.firmware.phase);
        });
        const updating = good.updater.start(request);
        await assert.rejects(good.device.downloadProgram({source: 'print(1)', slot: 0}), /SPARK_BUSY/);
        await assert.rejects(good.device.disconnect(), /SPARK_BUSY/);
        await assert.rejects(good.device.setConnectionMode('ble'), /SPARK_BUSY/);
        await assert.rejects(good.device.setMonitoring(false), /SPARK_BUSY/);
        assert.throws(() => good.updater.start(request), /SPARK_BUSY/);
        const result = await updating;
        assert.equal(result.reconnected, true);
        assert.equal(result.version, release.version);
        assert.equal(result.imageVerified, false, 'version report is not a flash-content hash');
        assert.equal(good.device.busy, false);
        assert.equal(good.device.connected, true);
        assert.equal(good.device.portPath, 'COM_APP');
        assert.equal(good.hardware.frames, 837);
        assert.deepStrictEqual(good.hardware.names, [
            {command: 0xDA, name: 'app.bin'}, {command: 0xDA, name: 'calibrate.o'},
            {command: 0xDA, name: 'remote.o'}, {command: 0xDD, name: 'version.txt'},
            {command: 0xDA, name: 'updata.txt'}
        ]);
        for (const file of release.files) {
            assert.ok(good.hardware.files.get(path.posix.basename(file.path))
                .equals(fs.readFileSync(path.join(getSparkFirmwareRoot(), file.path))), file.path);
        }
        assert.ok(progress.includes('waitingBoot') && progress.includes('restarting') && progress.includes('complete'));
        assert.equal(good.updater.state.bytes, 205466);
        const commands = good.hardware.writes.map(bytes => bytes[4]);
        assert.equal(commands.filter(command => command === 0x6F).length, 1);
        assert.ok(!commands.includes(0xBC) && !commands.includes(0xB9));
    } finally {
        await good.cleanup();
    }

    for (const {version, retainUsb, lateOldReport} of [{version: 110}, {version: 112},
        {version: 109, retainUsb: true}, {version: 109, lateOldReport: true}]) {
        const mismatch = fixture({version, running: true, retainUsb, lateOldReport});
        try {
            await mismatch.device.connect({path: 'COM_APP'});
            assert.equal(mismatch.device.getState().compatible, false);
            assert.equal(mismatch.device.getState().status.running, true);
            const result = await mismatch.updater.start(request);
            assert.equal(result.version, release.version, 'older and newer application versions can be updated');
            assert.equal(mismatch.device.getState().status.running, false, 'entering update mode ends the old program');
            assert.equal(mismatch.hardware.writes.filter(bytes => bytes[4] === 0x6F).length, 1,
                'one confirmation automatically sends RESET_FWLIB and enters update mode');
            if (retainUsb) assert.equal(mismatch.hardware.opens, 3, 'APP open and final APP verification only');
        } finally {
            await mismatch.cleanup();
        }
    }

    for (const options of [{failAt: 20}, {disconnectAt: 20}, {timeoutAt: 20}, {badAckAt: 20}]) {
        const test = fixture(options);
        try {
            await test.device.connect({path: 'COM_APP'});
            await assert.rejects(test.updater.start(request), /SPARK_/);
            assert.equal(test.hardware.frames, 20, 'stop at first failure without resending a frame');
            assert.equal(test.updater.state.recoveryRequired, true);
            assert.equal(test.device.recoveryRequired, true);
            assert.equal(test.device.busy, false);
            assert.equal(test.device.connected, false);
            assert.equal(Boolean(test.device.canDiscover()), false);
        } finally {
            await test.cleanup();
        }
    }
    const recovery = fixture({mode: 'boot'});
    try {
        await recovery.device.listDevices();
        const result = await recovery.updater.start({...request, recovery: true, path: 'COM_BOOT'});
        assert.equal(result.reconnected, true);
        assert.ok(recovery.hardware.writes.every(bytes => bytes[4] !== 0x6F));
    } finally {
        await recovery.cleanup();
    }

    for (const options of [{nextVersion: 112}, {noApplication: true}]) {
        const test = fixture(options);
        try {
            await test.device.connect({path: 'COM_APP'});
            await assert.rejects(test.updater.start(request), /SPARK_FW_(VERSION_MISMATCH|RECONNECT_TIMEOUT)/);
            assert.equal(test.updater.state.transferComplete, true);
            assert.equal(test.updater.state.result, null, 'files sent must not be reported as update completion');
            assert.equal(test.device.busy, false);
        } finally {
            await test.cleanup();
        }
    }
    const changed = fixture();
    try {
        await changed.device.connect({path: 'COM_APP'});
        changed.device.lastDevice = {...portFor('COM_APP'), serialNumber: 'OTHER'};
        const before = changed.hardware.writes.length;
        const watchdog = changed.device.watchdog;
        await assert.rejects(changed.updater.start(request), /SPARK_FW_DEVICE_CHANGED/);
        assert.equal(changed.hardware.writes.length, before, 'identity failure must not send reset');
        assert.equal(changed.device.watchdog, watchdog, 'preflight rejection preserves monitoring');
        assert.equal(changed.device.connected, true);
    } finally {
        await changed.cleanup();
    }
    const invalid = fixture();
    try {
        await invalid.device.connect({path: 'COM_APP'});
        invalid.updater.getRoot = () => null;
        const before = invalid.hardware.writes.length;
        await assert.rejects(invalid.updater.start(request), /SPARK_FW_RESOURCE_INVALID/);
        assert.equal(invalid.hardware.writes.length, before, 'invalid bundle must not reset the device');
        assert.equal(invalid.device.busy, false);
        assert.equal(invalid.device.connected, true);
    } finally {
        await invalid.cleanup();
    }
    const recoveryInvalid = fixture({mode: 'boot'});
    try {
        await recoveryInvalid.device.listDevices();
        recoveryInvalid.device.recoveryRequired = true;
        recoveryInvalid.updater.getRoot = () => null;
        await assert.rejects(recoveryInvalid.updater.start({...request, recovery: true, path: 'COM_BOOT'}),
            /SPARK_FW_RESOURCE_INVALID/);
        assert.equal(recoveryInvalid.device.recoveryRequired, true,
            'a failed preflight must retain an existing recovery latch');
        assert.equal(recoveryInvalid.updater.state.recoveryRequired, true);
        assert.equal(recoveryInvalid.hardware.writes.length, 0);
    } finally {
        await recoveryInvalid.cleanup();
    }
    const quiet = new EventEmitter();
    let writes = 0;
    quiet.open = async () => {};
    quiet.close = async () => {};
    quiet.write = async () => {
        writes++; quiet.emit('data', sparkFrame(0xFD, [1]));
    };
    const link = new SparkFirmwareLink(quiet, {gap: 5});
    await link.open();
    await link.send(0xDA, Buffer.from('app.bin'));
    await pause(12);
    await assert.rejects(link.send(0xAA, Buffer.from([1])), /SPARK_FW_GAP/);
    assert.equal(writes, 1, 'never send another fragment after the Bootloader idle window');
    await link.close();
    assert.equal(quiet.listenerCount('data'), 0);
}

(async () => {
    const healthy = {connected: true,
        connectionMode: 'usb',
        busy: false,
        stale: false,
        compatible: true,
        status: {version: release.version, running: false}};
    const service = new SparkFirmwareUpdateService();
    const report = await service.inspect(healthy);
    assert.ok(report.valid, JSON.stringify(report));
    assert.equal(report.files.length, 5);
    assert.equal(report.totalBytes, 205466);
    assert.equal(report.version, release.version);
    assert.equal(release.version, 111);
    assert.equal(release.source, 'Spark AI 1.1.10 / LB_FWLIB');
    assert.equal(service.state.total, report.totalBytes, 'initial progress uses the current release size');
    assert.equal(report.files[0].bytes, 202496);
    assert.equal(report.files[0].sha256, 'c05bcd35163a5c71eb47b939ebc2da357f379221bfd2489ef344e5b95b83cc0a');
    assert.equal(report.canUpdate, true);
    assert.deepStrictEqual(report.blockers, []);
    assert.deepStrictEqual(sparkFirmwareBlockers({...healthy, warning: 'SPARK_DOWNLOAD_INCOMPLETE'}, report), [],
        'ordinary download warnings must not become firmware recovery locks');
    assert.ok(report.files.every(file => file.valid && /^[a-f0-9]{64}$/.test(file.sha256)));
    const blocked = [
        [{connectionMode: 'ble'}, 'SPARK_FW_USB_ONLY'],
        [{connected: false}, 'SPARK_DISCONNECTED'],
        [{busy: true}, 'SPARK_BUSY'],
        [{discovery: {status: 'recovery'}}, 'SPARK_FW_RECOVERY']
    ];
    for (const [change, reason] of blocked) {
        assert.ok(sparkFirmwareBlockers({...healthy, ...change}, report).includes(reason));
    }
    for (const change of [{stale: true}, {monitoring: false}, {status: null},
        {status: {version: release.version, running: true}}, {compatible: false, status: {version: 109}},
        {compatible: false, status: {version: 111}}]) {
        assert.deepStrictEqual(sparkFirmwareBlockers({...healthy, ...change}, report), [],
            'status/version checks must not add manual steps to an update');
    }
    assert.equal(sparkFirmwareMismatchKey(healthy), null);
    const old = {...healthy, port: 'COM_APP', compatible: false, status: {version: 109}};
    assert.equal(sparkFirmwareMismatchKey(old), 'COM_APP:109');
    assert.equal(sparkFirmwareMismatchKey({...old, busy: true}), null);
    assert.equal(sparkFirmwareMismatchKey({...old, stale: true}), null);
    assert.equal(sparkFirmwareMismatchKey({...old, connectionMode: 'ble'}), null);
    assert.ok(sparkFirmwareBlockers(healthy).includes('SPARK_FW_CHECK_FIRST'));
    assert.ok(sparkFirmwareBlockers(healthy, {valid: false}).includes('SPARK_FW_RESOURCE_INVALID'));
    const allCodes = new Set([...blocked.map(item => item[1]), ...report.blockers,
        'SPARK_FW_FILE_MISSING', 'SPARK_FW_FILE_INVALID', 'SPARK_FW_CHECK_FIRST', 'SPARK_FW_RESOURCE_INVALID']);
    for (const locale of ['zh-cn', 'zh-tw', 'en', 'pt-br', 'ru']) {
        for (const code of allCodes) assert.notEqual(sparkRuntimeText(code, locale), code, `${locale}: ${code}`);
    }

    let reads = 0;
    const shared = new SparkFirmwareUpdateService({getRoot: () => {
        reads++; return getSparkFirmwareRoot();
    }});
    const one = shared.inspect(healthy);
    const two = shared.inspect({...healthy, connectionMode: 'ble'});
    assert.ok((await one).valid);
    assert.ok((await two).blockers.includes('SPARK_FW_USB_ONLY'));
    assert.equal(reads, 1, 'concurrent checks share resource IO, but not device state');
    await shared.inspect(healthy);
    assert.equal(reads, 2, 'explicit recheck must not use cached integrity results');

    const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'est-spark-firmware-'));
    try {
        const sourceRoot = getSparkFirmwareRoot();
        const bundle = path.join(temp, 'bundle');
        await fs.copy(sourceRoot, bundle);
        const altered = new SparkFirmwareUpdateService({getRoot: () => bundle});
        for (const file of release.files) {
            const filename = path.join(bundle, file.path);
            const original = await fs.readFile(filename);
            const changed = Buffer.from(original);
            changed[0] ^= 1;
            await fs.writeFile(filename, changed);
            let result = await altered.inspect(healthy);
            assert.equal(result.valid, false, `reject modified ${file.path}`);
            assert.equal(result.files.find(item => item.path === file.path).error, 'SPARK_FW_FILE_INVALID');
            await fs.writeFile(filename, original.subarray(1));
            result = await altered.inspect(healthy);
            assert.equal(result.valid, false, `reject truncated ${file.path}`);
            await fs.unlink(filename);
            result = await altered.inspect(healthy);
            assert.equal(result.files.find(item => item.path === file.path).error, 'SPARK_FW_FILE_MISSING');
            await fs.writeFile(filename, original);
        }
        assert.ok((await altered.inspect(healthy)).valid);
        const missing = await new SparkFirmwareUpdateService({getRoot: () => null}).inspect(healthy);
        assert.equal(missing.valid, false);
        assert.ok(missing.files.every(file => file.error === 'SPARK_FW_FILE_MISSING'));

        // Directory junctions must not smuggle a different resource location into the bundle.
        await fs.rename(path.join(bundle, 'app'), path.join(temp, 'outside-app'));
        await fs.symlink(path.join(temp, 'outside-app'), path.join(bundle, 'app'), 'junction');
        const outside = await altered.inspect(healthy);
        assert.equal(outside.valid, false);
        assert.equal(outside.files[0].error, 'SPARK_FW_FILE_INVALID');
        await fs.unlink(path.join(bundle, 'app'));
        await fs.rename(path.join(temp, 'outside-app'), path.join(bundle, 'app'));

        const importResult = spawnSync(process.execPath, [path.join(__dirname, 'import-spark-firmware.js'), bundle],
            {encoding: 'utf8', windowsHide: true});
        assert.equal(importResult.status, 0, importResult.stderr);
        await fs.writeFile(path.join(bundle, 'version/version.txt'), '112');
        const invalidImport = spawnSync(process.execPath, [path.join(__dirname, 'import-spark-firmware.js'), bundle],
            {encoding: 'utf8', windowsHide: true});
        assert.notEqual(invalidImport.status, 0, 'reject unknown release even with a plausible version');
        assert.ok((await service.inspect(healthy)).valid, 'invalid import must not change bundled resources');
    } finally {
        const relative = path.relative(os.tmpdir(), temp);
        assert.ok(/^est-spark-firmware-[^\\/]+$/.test(relative));
        await fs.remove(temp);
    }

    for (const args of [[], [{force: true, confirmed: true}], [{root: '../est-firmware', bootloaderVerified: true}]]) {
        assert.throws(() => service.start(...args), /SPARK_FW_ERASE_CONFIRM/);
    }
    const hardware = new HardwareSession({service: {},
        adapters: {'spark-usb': {}},
        isFirmwareBusy: () => false,
        stopSources: () => {}});
    for (const id of ['est', 'new-ai']) {
        hardware.hardwareId = id;
        await assert.rejects(hardware.operation(() => service.inspect(healthy), 'spark-usb'), /HARDWARE_NOT_READY/);
    }
    hardware.hardwareId = 'spark-ai';
    const checking = hardware.operation(() => service.inspect(healthy), 'spark-usb');
    await assert.rejects(hardware.select({hardwareId: 'est'}), /HARDWARE_BUSY/);
    await checking;
    await assert.rejects(hardware.operation(() => service.start(), 'spark-usb'), /SPARK_FW_ERASE_CONFIRM/);
    assert.equal(hardware.operations, 0, 'blocked update must release the operation guard');
    const main = fs.readFileSync(path.join(root, 'src/main/index.js'), 'utf8');
    assert.ok(main.includes("ipcMain.handle('spark-firmware-inspect', event => sparkOperation(event,"));
    assert.ok(main.includes("ipcMain.handle('spark-firmware-update', (event, request) => sparkOperation(event,"));
    await updateIntegrationTests();
    console.log('Spark firmware passed: pinned resources, integrity failures, 837-frame USB transfer, COM changes, strict ACK/error/timeout/disconnect handling, recovery, exclusive ownership and post-update version verification. No real hardware accessed.');
})().catch(error => {
    console.error(error); process.exitCode = 1;
});
