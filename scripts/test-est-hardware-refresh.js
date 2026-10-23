const assert = require('assert');
const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');
const root = path.resolve(__dirname, '..');
const load = (file, overrides = {}) => {
    const filename = path.resolve(root, file);
    const code = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
        babelrc: false, presets: ['@babel/preset-react'], plugins: ['@babel/plugin-transform-modules-commonjs']
    }).code;
    const module = {exports: {}};
    new Function('require', 'module', 'exports', code)(name => {
        if (Object.prototype.hasOwnProperty.call(overrides, name)) return overrides[name];
        if (name.endsWith('.css')) return {};
        if (name.startsWith('.')) return load(path.resolve(path.dirname(filename), name + '.js'), overrides);
        return require(name);
    }, module, module.exports);
    return module.exports;
};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return {promise, resolve};
};

(async () => {
    const {NodeHidEstTransport} = load('src/main/est/transports/node-hid.js', {'node-hid': {}});
    let nativeReads = 0;
    let onRead;
    let closed = false;
    const transport = new NodeHidEstTransport({
        read: callback => { nativeReads++; onRead = callback; },
        readTimeout: () => { throw new Error('Synchronous HID reads must never run'); },
        close: () => { closed = true; }
    });
    let ticks = 0;
    const timer = setInterval(() => { ticks++; }, 5);
    for (let i = 0; i < 4; i++) assert.equal((await transport.read(30)).length, 0);
    clearInterval(timer);
    assert.ok(ticks >= 5, 'event loop must continue while HID replies are missing');
    assert.equal(nativeReads, 1, 'timeouts must not create overlapping native reads');
    onRead(null, [1, 2, 3]);
    assert.deepStrictEqual(Array.from(await transport.read(30)), [1, 2, 3], 'late reply is preserved');
    const next = transport.read(30);
    onRead(null, [4]);
    assert.deepStrictEqual(Array.from(await next), [4]);
    const pending = transport.read(100);
    const rejected = assert.rejects(pending, /disconnected/);
    await transport.close();
    await rejected;
    assert.ok(closed);
    onRead(null, [5]);
    await assert.rejects(transport.read(10), /disconnected/);

    let calls = 0;
    let reply = {state: 'connected', status: {motors: [{angle: 1}], programStatus: {state: 0}}};
    let gate = null;
    const timers = new Map();
    let id = 0;
    global.window = {innerWidth: 1280, innerHeight: 800,
        addEventListener: () => {}, removeEventListener: () => {},
        setTimeout: (callback, delay) => { timers.set(++id, {callback, delay}); return id; },
        clearTimeout: key => timers.delete(key)};
    global.document = {hidden: false, addEventListener: () => {}, removeEventListener: () => {}};
    const {EstHardwareStatusButton} = load('src/renderer/EstHardwareStatusButton.jsx', {
        '@electron/remote': {}, '@electron/remote/renderer': {},
        'react-redux': {connect: () => component => component},
        './est-i18n': {getEstText: key => key},
        electron: {ipcRenderer: {on: () => {}, removeListener: () => {}, invoke: async name => {
            assert.equal(name, 'est-hardware-status'); calls++;
            return gate ? gate.promise : reply;
        }}}
    });
    const panel = new EstHardwareStatusButton({locale: 'zh-cn'});
    let renders = 0;
    panel.setState = (update, callback) => {
        const patch = typeof update === 'function' ? update(panel.state) : update;
        if (patch) { panel.state = {...panel.state, ...patch}; renders++; panel.componentDidUpdate(); }
        if (callback) callback();
    };
    panel.state.isOpen = true;
    await panel.refreshStatus({silent: true});
    assert.equal(timers.size, 1, 'idle program must keep polling');
    assert.equal([...timers.values()][0].delay, 250);
    const rendered = renders;
    reply = {...reply, status: {...reply.status, uptimeMs: 1000}};
    await panel.refreshStatus({silent: true});
    assert.equal(renders, rendered, 'unchanged snapshots must not render');
    reply = {state: 'busy'};
    await panel.refreshStatus({silent: true});
    assert.equal(panel.state.status.motors[0].angle, 1, 'download keeps last snapshot');
    gate = deferred();
    const inFlight = panel.refreshStatus({silent: true});
    const started = calls;
    await panel.refreshStatus({silent: true});
    assert.equal(calls, started, 'only one IPC request can be pending');
    panel.handleClose();
    gate.resolve({state: 'connected', status: {motors: [{angle: 999}]}});
    await inFlight;
    assert.equal(timers.size, 0);
    assert.equal(panel.state.status.motors[0].angle, 1, 'closed panel ignores stale response');
    gate = null;
    panel.state.isOpen = true;
    document.hidden = true;
    await panel.refreshStatus({silent: true});
    assert.equal(calls, started, 'hidden window does not poll');
    document.hidden = false;
    panel.state.firmwareUpdateBusy = 'latest-os';
    await panel.refreshStatus({silent: true});
    assert.equal(calls, started, 'firmware update does not poll');
    panel.state.firmwareUpdateBusy = null;
    panel.componentWillUnmount();
    assert.equal(timers.size, 0);
    await pause(1);
    console.log(`Hardware refresh passed: ${ticks} event-loop ticks during 120 ms HID wait; no overlapping reads, stale replies, repeated renders or hidden polling.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
