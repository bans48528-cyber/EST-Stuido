const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const babel = require('@babel/core');
const root = path.resolve(__dirname, '..');
const original = Module._extensions['.js'];
Module._extensions['.js'] = (module, filename) => {
    if (!filename.startsWith(path.join(root, 'src'))) return original(module, filename);
    const result = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
        babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs']
    });
    module._compile(result.code, filename);
};
const {hardwarePorts, hardwareReadingState, portWirePath} = require('../src/renderer/hardware/status-model');
const {hardwareStatusText, HARDWARE_STATUS_MESSAGE_IDS} = require('../src/renderer/hardware/status-messages');
const state = {connected: true,
    status: {battery: 80,
        ports: [
            {port: 0, label: 'A', type: 'big_motor', values: {angle: 0, speed: 0}},
            {port: 1, label: 'B', type: 'color', values: {r: 255, g: 0, b: 0, lux: 0}},
            {port: 2, label: 'C', type: 'ultrasion', values: {cm: 0}},
            {port: 3, label: 'D', type: 'none', values: {}}
        ]}};
for (const locale of ['zh-cn', 'en', 'pt-br', 'zh-tw', 'ru']) {
    for (const key of HARDWARE_STATUS_MESSAGE_IDS) assert.notEqual(hardwareStatusText(key, locale), key);
    const ports = hardwarePorts('new-ai', state, locale);
    assert.equal(ports.length, 8);
    assert.equal(ports[0].reading, '0°');
    assert.equal(ports[1].colour, 'rgb(255,0,0)');
    assert.equal(ports[2].reading, '0 cm');
    assert.deepStrictEqual(ports.map(port => port.attached), [true, true, true, false, false, false, false, false]);
    for (const patch of [{connected: false}, {stale: true}, {busy: true}, {firmware: {active: true}}]) {
        const unavailable = hardwarePorts('new-ai', {...state, ...patch}, locale);
        assert.ok(unavailable.every(port => !port.attached && port.reading === '—' && !port.colour));
    }
    assert.ok(hardwarePorts('new-ai', state, locale, true).every(port => port.reading === '—'));
    const spark = hardwarePorts('spark-ai', state, locale);
    assert.ok(spark.slice(4).every(port => !port.attached && port.note && port.reading === '—'));
    assert.equal(spark[1].colour, null, 'Spark grayscale reports are not RGB colour detections');
    const est = hardwarePorts('est', {connected: true,
        status: {
            motors: [{tachoCount: 0, powerPercent: 0}],
            sensors: [{sensorType: 30, state: 2, mode: 0, valueValid: true, value: 0}]
        }}, locale);
    assert.equal(est.map(port => port.label).join(''), '1234ABCD');
    assert.equal(est[0].reading, '0 cm');
    assert.equal(est[4].reading, '0°');
    assert.equal(est[4].attached, false, 'an EST output register does not prove attachment');
    assert.equal(hardwareReadingState({connected: true, monitoring: false}), 'paused');
}
assert.equal(hardwarePorts('new-ai', {connected: true, status: {ports: []}}, 'en')[0].reading, '—');
const invalid = {...state, status: {ports: [{port: 0, type: 'color', values: {r: NaN, g: 0, b: 300}}]}};
assert.equal(hardwarePorts('new-ai', invalid, 'en')[0].colour, null);
const busyColour = {...state,
    status: {ports: [{port: 0,
        type: 'color',
        values: {r: 255, g: 0, b: 0, Not_Run: 0}}]}};
assert.equal(hardwarePorts('new-ai', busyColour, 'en')[0].colour, null);
assert.equal(hardwarePorts('new-ai', busyColour, 'en')[0].reading, '—');
const stage = {left: 0, top: 0, width: 360, height: 226};
const row = {left: 0, right: 96, top: 10, height: 38};
const hub = {left: 113, top: 8, width: 134, height: 210};
const wire = portWirePath(stage, row, hub, 0);
assert.match(wire, /^M 94 29 H /);
assert.notEqual(wire, portWirePath(stage, row, {...hub, width: 100}, 0));
assert.equal(portWirePath({...stage, width: 0}, row, hub, 0), '');
const topRow = {left: 0, right: 84, top: 6, height: 44};
const bottomRow = {...topRow, top: 308};
const verticalHub = {...hub, top: 74};
assert.match(portWirePath(stage, topRow, verticalHub, 0, 'vertical'), /^M 42 48 V /);
assert.match(portWirePath(stage, bottomRow, verticalHub, 4, 'vertical'), /^M 42 310 V /);
assert.ok(portWirePath(stage, topRow, verticalHub, 0, 'vertical').endsWith('V 80.3'));
assert.ok(portWirePath(stage, bottomRow, verticalHub, 4, 'vertical').endsWith('V 277.7'));
// Check the rendered orthogonal paths themselves: separate SVG paths may still overlap or cross.
const segments = wirePath => {
    const [x, y, bend, endX, endY] = wirePath.match(/-?\d+(?:\.\d+)?/g).map(Number);
    return [[[x, y], [x, bend]], [[x, bend], [endX, bend]], [[endX, bend], [endX, endY]]];
};
const intersects = (one, two) => [0, 1].every(axis =>
    Math.max(Math.min(one[0][axis], one[1][axis]), Math.min(two[0][axis], two[1][axis])) <=
    Math.min(Math.max(one[0][axis], one[1][axis]), Math.max(two[0][axis], two[1][axis])));
for (const width of [280, 314, 338, 360]) {
    const cell = (width - 24) / 4;
    const sizedHub = {...verticalHub, left: (width - verticalHub.width) / 2};
    for (const offset of [0, 4]) {
        const wires = Array.from({length: 4}, (unused, index) => segments(portWirePath(
            {...stage, width},
            {...(offset ? bottomRow : topRow), left: index * (cell + 8), right: index * (cell + 8) + cell},
            sizedHub, index + offset, 'vertical')));
        for (let i = 0; i < wires.length; i++) {
            for (let j = i + 1; j < wires.length; j++) {
                assert.ok(!wires[i].some(one => wires[j].some(two => intersects(one, two))),
                    `EST wires ${i + offset}/${j + offset} must not cross or overlap at width ${width}`);
            }
        }
    }
}
console.log('Hardware status model passed: five languages, real port mappings, zero values, ' +
    'no invented attachment or stale readings, resize geometry.');
