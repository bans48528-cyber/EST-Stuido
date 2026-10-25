/* eslint-disable global-require */
// Explicit passive USB probe. Does not download, run, stop or update anything.
const fs = require('fs');
const path = require('path');
const Module = require('module');
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
(async () => {
    const service = new NewAiDeviceService();
    try {
        const ports = await service.listDevices();
        const requested = process.argv[2];
        const selected = requested ? ports.find(port => port.path === requested) : (ports.length === 1 && ports[0]);
        if (!selected) {
            throw new Error(ports.length > 1 ? 'Select a USB port argument.' : 'No candidate NEW AI USB port.');
        }
        const state = await service.connect({path: selected.path});
        console.log(JSON.stringify({port: state.port,
            verified: state.identityVerified,
            version: state.status.version,
            running: state.status.running,
            ports: state.status.ports.map(port => ({label: port.label, type: port.type}))}));
    } finally {
        await service.shutdown();
    }
})().catch(error => {
    console.error(error.message); process.exitCode = 1;
});
