/* eslint-disable global-require */
const assert = require('assert');
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
const {normalizeNewAiMonitor, NewAiStreamParser} = require('../src/main/new-ai/protocol');
const {newAiTelemetryFields, newAiNumber, newAiConnectionChanged} = require('../src/renderer/new-ai/telemetry');
const {newAiText} = require('../src/renderer/new-ai/runtime-messages');
const fixture = require('./new-ai-telemetry-fixture.json');
const clone = value => JSON.parse(JSON.stringify(value));
const status = normalizeNewAiMonitor(fixture, 123);
assert.equal(status.heap, 227240); assert.equal(status.sound, 0.14); assert.equal(status.imu.pitch, 0);
assert.equal(status.ports[6].values.configs.length, 2);
assert.equal(status.ports[6].values.targetCount, 2);
assert.equal(status.ports[6].values.configs[1].id, 0);
assert.equal(status.ports[5].values.t7, 720);
assert.equal(status.ports[4].values.Softwareversion, 105);
for (const locale of ['zh-cn', 'en', 'pt-br', 'zh-tw', 'ru']) {
    status.ports.forEach(port => {
        const {fields} = newAiTelemetryFields(port, locale);
        assert.ok(fields.length, `${port.type} has readable fields`);
        assert.ok(fields.every(field => field.label && field.value));
    });
    const motor = newAiTelemetryFields(status.ports[0], locale).fields;
    assert.equal(motor.find(field => field.key === 'speed').value, '0');
    assert.equal(motor.find(field => field.key === 'angle').value, '0°');
    assert.equal(motor.find(field => field.key === 'circly').value, '0');
    assert.equal(newAiTelemetryFields(status.ports[1], locale).fields[0].value, newAiText('released', locale));
    const gray = newAiTelemetryFields(status.ports[5], locale).fields;
    assert.equal(gray.filter(field => field.key.startsWith('channel')).length, 7);
    assert.ok(gray.find(field => field.key === 'channel7').value.includes('720'));
    for (const bad of [null, false, '', 'NaN', Infinity, {}, []]) {
        assert.equal(newAiNumber(bad, locale), newAiText('unknown', locale));
    }
}
assert.equal(newAiNumber('1234.5', 'pt-br'), '1.234,5');
assert.equal(newAiTelemetryFields({type: 'nfc', values: {id: 12345678}}, 'en').fields[0].value, '12345678');
assert.equal(newAiTelemetryFields({type: 'nfc', values: {id: '000012'}}, 'en').fields[0].value, '000012');
assert.equal(newAiTelemetryFields({type: 'small_motor', values: {speed: -12, angle: -30}}, 'en')
    .fields.find(field => field.key === 'angle').value, '-30°');
assert.equal(newAiTelemetryFields({type: 'touch', values: {state: true}}, 'en').fields[0].value, 'Pressed');
assert.equal(newAiTelemetryFields({type: 'color', values: {r: 10, Not_Run: 0}}, 'en').unavailable, 'dataBusy');
assert.equal(newAiTelemetryFields({type: 'dev null', values: {}}, 'en').unavailable, 'dataUnavailable');
assert.equal(newAiTelemetryFields({type: 'ir_remote', values: {state: 2}}, 'en').fields[0].value, 'Green');
assert.equal(newAiTelemetryFields({type: 'elect_sensor', values: {state: 0}}, 'en').fields[0].value, 'Release');

const malformed = clone(fixture);
malformed.deviceList[6].camera.configs = Array.from({length: 30}, () => ({id: '0',
    x: false,
    conf: '99',
    learned: '1',
    name: '<img src=x>'.repeat(100),
    extra: {x: 1}}));
const bounded = normalizeNewAiMonitor(malformed).ports[6].values.configs;
assert.equal(bounded.length, 16); assert.equal(bounded[0].id, 0); assert.equal(bounded[0].conf, 99);
assert.equal(bounded[0].learned, 1); assert.equal(bounded[0].name.length, 250);
assert.equal(normalizeNewAiMonitor(malformed).ports[6].values.targetCount, 30);
assert.ok(!Object.prototype.hasOwnProperty.call(bounded[0], 'x'));
assert.ok(!Object.prototype.hasOwnProperty.call(bounded[0], 'extra'));
delete malformed.deviceList[6].camera.configs;
assert.ok(!('configs' in normalizeNewAiMonitor(malformed).ports[6].values),
    'missing targets are not a zero-target report');

const raw = Buffer.from(`${JSON.stringify(fixture)}\r\n`);
for (const split of [0, 1, 7, 248, raw.length - 1, raw.length]) {
    const parser = new NewAiStreamParser(); const monitors = [];
    parser.on('monitor', value => monitors.push(value));
    parser.push(raw.subarray(0, split)); parser.push(raw.subarray(split));
    assert.equal(monitors.length, 1); assert.equal(monitors[0].ports[6].values.configs[0].name, 'target');
}
const before = {connected: true,
    state: 'connected',
    port: 'COM_NEW',
    stale: false,
    status,
    discovery: {enabled: true, ports: []},
    firmware: {active: false}};
for (let index = 0; index < 500; index++) {
    const after = {...before,
        status: {...status,
            timestamp: index,
            imu: {yaw: index},
            ports: status.ports.map(port => ({...port, values: {...port.values, speed: index}}))}};
    assert.equal(newAiConnectionChanged(before, after, true), false, 'readings never rerender surrounding dialog');
    assert.equal(newAiConnectionChanged(before, after, false), false, 'closed dialog ignores readings');
}
assert.equal(newAiConnectionChanged(before, {...before, status: {...status, running: true}}, true), true);
assert.equal(newAiConnectionChanged(before, {...before, stale: true}, false), true);
assert.equal(newAiConnectionChanged(before, {...before, memoryError: 'NEW_CONNECTION_MEMORY_FAILED'}, true), true);
assert.equal(newAiConnectionChanged(before, {...before, connected: false}, false), true);
assert.equal(newAiConnectionChanged(before, {...before, firmware: {active: true}}, true), true);
const updating = {...before, firmware: {active: true, phase: 'resetting', bytes: 0}};
assert.equal(newAiConnectionChanged(updating, {...updating,
    firmware: {active: true, phase: 'waitingBoot', bytes: 0}}, false), true);
assert.equal(newAiConnectionChanged(updating, {...updating,
    firmware: {active: true, phase: 'restarting', transferComplete: true}}, false), true);
console.log('NEW AI telemetry passed: all sensor types, zero/negative/invalid values, 7 line channels, ' +
    'bounded camera targets, report splits, five locales and dialog/telemetry update isolation.');
