/* eslint-disable global-require */
// Explicit destructive hardware test; without both consent flags, only inspect local resources.
const fs = require('fs');
const path = require('path');
const Module = require('module');
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
const {NewAiFirmwareUpdateService} = require('../src/main/new-ai/firmware-update-service');
const release = require('../src/main/new-ai/firmware-release.json');
(async () => {
    const device = new NewAiDeviceService();
    const updater = new NewAiFirmwareUpdateService({device});
    try {
        const report = await updater.inspect();
        console.log(JSON.stringify({releaseId: report.releaseId,
            valid: report.valid,
            version: report.version,
            files: report.files.length,
            bytes: report.totalBytes}));
        if (!process.argv.includes('--confirm-erase')) return;
        const recovery = process.argv.includes('--recovery');
        const portIndex = process.argv.indexOf('--port');
        const port = portIndex >= 0 ? process.argv[portIndex + 1] : null;
        if (!port) throw new Error('Select --port explicitly.');
        if (!recovery && !process.argv.includes('--confirm-legacy-idle')) {
            throw new Error('Confirm the device program is stopped with --confirm-legacy-idle.');
        }
        if (recovery && !process.argv.includes('--confirm-recovery-device')) {
            throw new Error('Confirm this is a NEW AI recovery device with --confirm-recovery-device.');
        }
        if (recovery) await device.listDevices();
        else {
            const state = await device.connect({path: port});
            console.log(JSON.stringify({port: state.port,
                version: state.status.version,
                legacy: Boolean(state.status.legacyProtocol),
                running: state.status.running}));
        }
        let previous = '';
        device.on('state', state => {
            const fw = state.firmware;
            if (!fw) return;
            const percent = Math.floor(fw.bytes * 10 / fw.total) * 10;
            const key = `${fw.phase}:${percent}`;
            if (previous === key) return;
            previous = key;
            console.log(JSON.stringify({phase: fw.phase,
                percent,
                bytes: fw.bytes,
                file: fw.file,
                error: fw.error,
                result: fw.result}));
        });
        const result = await updater.start({releaseId: release.id,
            confirmedErase: true,
            recovery,
            path: port,
            confirmedLegacyIdle: process.argv.includes('--confirm-legacy-idle'),
            confirmedRecoveryDevice: process.argv.includes('--confirm-recovery-device')});
        console.log(JSON.stringify(result));
    } finally {
        if (updater.done) await updater.done.catch(() => {});
        await device.shutdown();
    }
})().catch(error => {
    console.error(error.message); process.exitCode = 1;
});
