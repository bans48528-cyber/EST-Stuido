/* eslint-disable global-require */
// Passive real-device acceptance. Outgoing writes are blocked, including during connection.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const {performance} = require('perf_hooks');
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
const {NewAiSerialTransport} = require('../src/main/new-ai/serial-transport');
const {NewAiConnectionPreferences} = require('../src/main/new-ai/connection-preferences');
(async () => {
    const args = process.argv.slice(2);
    const argument = (key, fallback) => (args.includes(key) ? args[args.indexOf(key) + 1] : fallback);
    const port = argument('--port', 'COM13');
    const seconds = Number(argument('--seconds', '5'));
    const preferencesFile = argument('--preferences', null);
    const automatic = args.includes('--auto');
    assert.ok(Number.isFinite(seconds) && seconds >= 1 && seconds <= 30);
    const report = {softwareVersion: require('../package.json').version,
        port,
        writes: 0,
        rawReports: 0,
        publishedStates: 0,
        timerTicks: 0,
        maxTimerGapMs: 0,
        devices: [],
        reportsPerSecond: [],
        fields: {},
        connectionEvents: [],
        wireSamples: []};
    const started = performance.now();
    const elapsed = () => Math.round(performance.now() - started);
    const observed = new Set();
    const service = new NewAiDeviceService({
        preferences: preferencesFile ? new NewAiConnectionPreferences(preferencesFile) : null,
        createTransport: devicePort => {
            const transport = new NewAiSerialTransport(devicePort);
            let pending = '';
            transport.on('data', bytes => {
                pending += bytes.toString('utf8');
                const lines = pending.split('\n');
                pending = lines.pop().slice(-16384);
                for (const line of lines) {
                    try {
                        const value = JSON.parse(line.slice(line.indexOf('{')).trim());
                        if (value.NewAiState && Array.isArray(value.deviceList)) {
                            report.wireSamples.push({elapsedMs: elapsed(), value});
                            if (report.wireSamples.length > 3) report.wireSamples.splice(1, 1);
                        }
                    } catch (error) { /* Partial/debug lines are not monitor samples. */ }
                }
            });
            transport.on('fault', error => report.connectionEvents.push({elapsedMs: elapsed(), error: error.code}));
            transport.on('closed', () => report.connectionEvents.push({elapsedMs: elapsed(), transport: 'closed'}));
            transport.write = () => {
                report.writes++; throw new Error('Passive monitoring cannot write to the device.');
            };
            return transport;
        }});
    const measure = {active: false};
    service.on('monitor', monitor => {
        report.lastMonitor = monitor;
        if (!measure.active) return;
        report.rawReports++;
        const second = Math.floor((performance.now() - measure.started) / 1000);
        report.reportsPerSecond[second] = (report.reportsPerSecond[second] || 0) + 1;
        monitor.ports.filter(item => item.type !== 'none').forEach(item => {
            observed.add(`${item.label}:${item.type}`);
            Object.entries(item.values).forEach(([name, value]) => {
                if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') return;
                const number = Number(value);
                if (!Number.isFinite(number)) return;
                const key = `${item.label}:${item.type}:${name}`;
                const field = report.fields[key];
                if (field) {
                    field.min = Math.min(field.min, number); field.max = Math.max(field.max, number);
                    if (field.last !== number) field.changes++;
                    field.last = number; field.samples++;
                } else {
                    report.fields[key] = {min: number,
                        max: number,
                        first: number,
                        last: number,
                        samples: 1,
                        changes: 0};
                }
            });
        });
    });
    let lastConnection;
    service.on('state', state => {
        if (measure.active) report.publishedStates++;
        const connection = {state: state.state, connected: state.connected, stale: state.stale, error: state.error};
        if (JSON.stringify(connection) !== lastConnection) {
            report.connectionEvents.push({elapsedMs: elapsed(), ...connection});
            lastConnection = JSON.stringify(connection);
        }
    });
    let timer;
    try {
        let connected;
        if (automatic) {
            assert.ok(preferencesFile && service.previousDevice, 'automatic test needs a remembered identity');
            assert.ok(service.autoEnabled, 'automatic test must not override a paused preference');
            service.setDiscoveryActive(true);
            const deadline = Date.now() + 6000;
            while (!service.connected && Date.now() < deadline) {
                await new Promise(resolve => setTimeout(resolve, 20));
            }
            connected = service.getState();
            assert.ok(connected.connected, `automatic connection failed: ${connected.error}`);
            service.setDiscoveryActive(false);
        } else connected = await service.connect({path: port});
        if (preferencesFile) assert.equal(connected.memoryError, null, 'connection identity must be persisted');
        Object.assign(report, {automatic, preferencesFile, connectedPort: connected.port});
        assert.equal(connected.status.version, 321);
        Object.assign(report, {initial: connected.status});
        Object.assign(measure, {started: performance.now(), active: true});
        let previous = measure.started;
        timer = setInterval(() => {
            const now = performance.now(); report.timerTicks++;
            report.maxTimerGapMs = Math.max(report.maxTimerGapMs, now - previous); previous = now;
        }, 20);
        await new Promise(resolve => setTimeout(resolve, seconds * 1000));
        Object.assign(measure, {active: false});
        clearInterval(timer);
        const state = service.getState();
        Object.assign(report, {elapsedMs: Math.round(performance.now() - measure.started),
            final: state.status,
            finalConnection: {state: state.state, connected: state.connected, error: state.error},
            stale: state.stale,
            devices: [...observed],
            checkedAt: new Date().toISOString()});
        assert.equal(state.connected, true, `device disconnected: ${state.error}`);
        assert.equal(state.stale, false, 'monitor stream became stale');
        assert.equal(report.writes, 0, 'passive monitoring must not write');
        assert.ok(report.rawReports > 0 && report.publishedStates > 0);
        assert.ok(report.publishedStates <= Math.ceil(report.elapsedMs / 100) + 2, 'IPC updates are coalesced');
        assert.ok(report.timerTicks >= seconds * 5, 'monitoring must leave the event loop responsive');
        Object.assign(report, {passed: true});
    } catch (error) {
        Object.assign(report, {passed: false, error: error.message});
        throw error;
    } finally {
        clearInterval(timer);
        measure.active = false;
        await service.shutdown();
        const output = argument('--output', null);
        if (output) {
            fs.mkdirSync(path.dirname(path.resolve(output)), {recursive: true});
            fs.writeFileSync(output, JSON.stringify(report, null, 2), {flag: 'wx'});
        }
        console.log(JSON.stringify({passed: report.passed,
            port,
            writes: report.writes,
            rawReports: report.rawReports,
            publishedStates: report.publishedStates,
            elapsedMs: report.elapsedMs,
            timerTicks: report.timerTicks,
            maxTimerGapMs: Math.round(report.maxTimerGapMs),
            devices: report.devices,
            error: report.error}));
    }
})().catch(error => {
    console.error(error.message); process.exitCode = 1;
});
