/* eslint-disable global-require, require-await */
const assert = require('assert');
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
const {createFirmwareVersionNotifier} = require('../src/renderer/hardware/firmware-version-notifier');
const {EstDeviceService} = require('../src/main/est/device-service');
const {EST_USB_VID, EST_USB_PID} = require('../src/main/est/constants');
const {normalizeNewAiLegacyMonitor} = require('../src/main/new-ai/protocol');
const legacy = require('./new-ai-legacy-monitor-fixture.json');
(async () => {
    for (const version of [0, 1, 193, 214, 215, 321, 65535]) {
        const state = normalizeNewAiLegacyMonitor({...legacy, versionlist: {ver: version}});
        assert.equal(state.version, version);
        assert.equal(state.running, null, 'missing run state must never be guessed');
    }
    assert.equal(normalizeNewAiLegacyMonitor({...legacy, versionlist: {ver: -1}}), null);
    for (const version of ['M1.00A', 'M1.09A', 'M9.99A']) {
        const device = {path: 'est-test', vendorId: EST_USB_VID, productId: EST_USB_PID};
        const service = new EstDeviceService({transportFactory: {listDevices: async () => [device]}});
        service.device = device; service.transport = {}; service.firmwareVersion = version;
        service.getStatus = async () => {
            throw Error('older firmware has no status command');
        };
        let disconnected = false;
        service.disconnect = async () => {
            disconnected = true;
        };
        const result = await service.autoConnect();
        assert.equal(result.state, 'connected');
        assert.equal(result.firmwareVersion, version);
        assert.equal(disconnected, false);
    }
    const prompts = [];
    const notify = createFirmwareVersionNotifier(message => prompts.push(message));
    const state = {connected: false, compatible: false, identity: 'COM6', version: 193, locale: 'zh-cn'};
    notify(state); await Promise.resolve(); assert.equal(prompts.length, 0);
    notify({...state, connected: true, busy: true}); await Promise.resolve(); assert.equal(prompts.length, 0);
    for (let i = 0; i < 100; i++) notify({...state, connected: true});
    await Promise.resolve(); assert.equal(prompts.length, 1, 'polling must not repeat the dialog');
    notify({...state, connected: true, compatible: true}); await Promise.resolve(); assert.equal(prompts.length, 1);
    notify(state); notify({...state, connected: true}); await Promise.resolve(); assert.equal(prompts.length, 2);
    console.log('Connect-first passed: legacy versions, EST status fallback, post-connect prompt deduplication.');
})().catch(error => {
    console.error(error); process.exitCode = 1;
});
