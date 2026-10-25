/* eslint-disable global-require */
// Explicit A-port big-motor maintenance. Default only verifies the original local release.
// --execute sends exactly one original 0x32 request; the host copies its onboard motor image.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Module = require('module');
const {StringDecoder} = require('string_decoder');
const babel = require('@babel/core');
const root = path.resolve(__dirname, '..');
const loader = Module._extensions['.js'];
Module._extensions['.js'] = (module, filename) => {
    if (!filename.startsWith(path.join(root, 'src'))) return loader(module, filename);
    module._compile(babel.transformSync(fs.readFileSync(filename, 'utf8'), {
        babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs']
    }).code, filename);
};
const {newAiFrame} = require('../src/main/new-ai/protocol');
const {NewAiDeviceService} = require('../src/main/new-ai/device-service');
const {NewAiSerialTransport, newAiPortIdentity} = require('../src/main/new-ai/serial-transport');
const {newAiFirmwareBounded} = require('../src/main/new-ai/firmware-link');
const release = require('../src/main/new-ai/firmware-release.json');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const TARGET_VERSION = 142;
const payload = Buffer.from([0xA1, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]);
const command = newAiFrame(0x32, payload);
const motor = status => status && status.ports.find(port => port.port === 0);
const ready = status => status && status.version === 321 && status.running === false &&
    motor(status).type === 'big_motor' && Number(motor(status).values.SoftwareVersion) === TARGET_VERSION;
const upgraded = status => ready(status) && Number(motor(status).values.version) === TARGET_VERSION;

(async () => {
    const args = process.argv.slice(2);
    const argument = key => (args.includes(key) ? args[args.indexOf(key) + 1] : null);
    const execute = args.includes('--execute');
    const output = argument('--output');
    const report = {softwareVersion: require('../package.json').version,
        targetPort: 'A',
        targetType: 'big_motor',
        targetVersion: TARGET_VERSION,
        releaseId: release.id,
        requestHex: command.toString('hex'),
        writes: 0,
        reportsAfterRequest: 0,
        debugLines: [],
        events: [],
        executed: false,
        imageVerifiedOnDevice: false};
    let device;
    let lease = false;
    let recordCreated = false;
    let lastProgress = 0;
    let pending = '';
    const decoder = new StringDecoder('utf8');
    try {
        const directory = path.join(root, 'resources/new-ai/firmware', release.id);
        for (const relative of ['app/motor.bin', 'version/BigMotorVersion.txt']) {
            const file = release.files.find(item => item.path === relative);
            assert.ok(file, `release contains ${relative}`);
            const bytes = fs.readFileSync(path.join(directory, relative));
            assert.equal(bytes.length, file.bytes);
            assert.equal(crypto.createHash('sha256').update(bytes)
                .digest('hex'), file.sha256);
        }
        assert.equal(Number(fs.readFileSync(path.join(directory, 'version/BigMotorVersion.txt'), 'utf8').trim()),
            TARGET_VERSION);
        assert.equal(command.toString('hex'), '5a97980832a1ffffffffffffff5da5');
        report.localResourcesVerified = true;
        if (!execute) {
            console.log(JSON.stringify(report)); return;
        }
        const port = argument('--port');
        const serial = argument('--serial');
        assert.ok(port && serial && output, 'explicit --port, --serial and --output are required');
        assert.ok(!fs.existsSync(output), 'never overwrite an earlier maintenance record');
        fs.mkdirSync(path.dirname(path.resolve(output)), {recursive: true});
        fs.writeFileSync(output, JSON.stringify(report, null, 2), {flag: 'wx'});
        recordCreated = true;
        device = new NewAiDeviceService({createTransport: devicePort => {
            const transport = new NewAiSerialTransport(devicePort);
            const write = transport.write.bind(transport);
            transport.write = bytes => {
                assert.ok(report.executed && lease, 'maintenance must hold the device lease');
                assert.equal(report.writes, 0, 'never resend the upgrade request');
                assert.ok(Buffer.from(bytes).equals(command), 'only the A-port motor update command is permitted');
                assert.ok(ready(device.getState().status) && !device.getState().stale,
                    'idle fresh version-321 host with the expected motor is required');
                report.writes++;
                return write(bytes);
            };
            transport.on('data', bytes => {
                const lines = (pending + decoder.write(bytes)).split('\n');
                pending = lines.pop().slice(-16384);
                for (const line of lines) {
                    if (!line.trim() || line.includes('"deviceList"')) continue;
                    report.debugLines.push({time: Date.now(), line: line.slice(0, 1000)});
                    if (report.debugLines.length > 150) report.debugLines.shift();
                    if (report.executed && Date.now() - lastProgress >= 1000) {
                        console.log(JSON.stringify({deviceMessage: line.slice(0, 200)}));
                        lastProgress = Date.now();
                    }
                }
            });
            return transport;
        }});
        device.on('connection-lost', error => report.events.push({time: Date.now(), error: error.code}));
        device.on('monitor', status => {
            if (report.executed) report.reportsAfterRequest++;
            report.lastMonitor = status;
        });
        const candidates = await device.listDevices();
        const selected = candidates.find(item => item.path === port && item.serialNumber === serial);
        assert.ok(selected, 'USB port must match the previously verified NEW AI serial number');
        Object.assign(report, {identity: newAiPortIdentity(selected)});
        await device.connect({path: selected.path});
        const fresh = await device.waitForMonitor(ready, {count: 3, timeout: 3000});
        Object.assign(report, {before: fresh.monitor});
        if (upgraded(fresh.monitor)) {
            Object.assign(report, {alreadyTargetVersion: true, versionConfirmed: true});
        } else {
            device.reserveFirmwareUpdate(); lease = true;
            Object.assign(report, {executed: true, requestedAt: new Date().toISOString()});
            // No download, stop/run toggle, formatting command or automatic retry is allowed.
            const transport = device.transport;
            console.log(JSON.stringify({phase: 'updating-motor',
                port,
                targetPort: 'A',
                targetVersion: TARGET_VERSION}));
            await newAiFirmwareBounded(transport.write(command), 5000, 'NEW_WRITE_TIMEOUT');
            const result = await device.waitForMonitor(upgraded, {count: 20, timeout: 120000});
            Object.assign(report, {after: result.monitor, versionConfirmed: true});
        }
        await pause(3000);
        const final = device.getState();
        assert.ok(final.connected && !final.stale && upgraded(final.status), 'updated motor must remain online');
        Object.assign(report, {final: final.status});
        report.otherPortsRetained = report.before.ports.slice(1).every((item, index) =>
            item.type === final.status.ports[index + 1].type);
        const values = motor(final.status).values;
        report.readings = {speed: Number(values.speed),
            angle: Number(values.angle),
            revolutions: Number(values.circly)};
        report.previousSpeedAnomalyCleared = values.speed !== '842084144' &&
            Number.isFinite(report.readings.speed);
        report.completedAt = new Date().toISOString();
        report.elapsedMs = report.requestedAt ? Date.now() - Date.parse(report.requestedAt) : 0;
        assert.ok(report.otherPortsRetained, 'other peripheral types must remain unchanged');
        assert.ok(report.previousSpeedAnomalyCleared, 'the previous invalid speed must not persist');
        report.passed = true;
    } catch (error) {
        report.passed = false;
        report.error = error.message;
        console.error(error.message);
        Object.assign(process, {exitCode: 1});
    } finally {
        if (device) {
            if (lease) device.releaseFirmwareUpdate();
            await device.shutdown();
        }
        if (recordCreated) {
            fs.writeFileSync(output, JSON.stringify(report, null, 2));
            console.log(JSON.stringify({passed: report.passed,
                executed: report.executed,
                writes: report.writes,
                versionConfirmed: report.versionConfirmed,
                elapsedMs: report.elapsedMs,
                readings: report.readings,
                otherPortsRetained: report.otherPortsRetained,
                error: report.error,
                output}));
        }
    }
})().catch(error => {
    console.error(error.message); process.exitCode = 1;
});
