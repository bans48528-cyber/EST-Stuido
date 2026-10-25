// Isolated compiled-renderer test: fixture data only, no physical hardware access.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const raw = require('./new-ai-telemetry-fixture.json');
const fixture = {version: raw.version,
    running: false,
    battery: Number(raw.bat),
    flash: raw.flash,
    heap: Number(raw.heap),
    sound: Number(raw.voic),
    imu: raw.mem,
    ports: raw.deviceList.map(item => {
        const type = Object.keys(item).find(key => key !== 'port');
        return {port: item.port, label: 'ABCDEFGH'[item.port], type, values: item[type]};
    })};
fixture.ports[6].values.configs[0].name = '<tag>target</tag>'.repeat(18);
module.exports = async ({evaluate, pause, window, output, setNewAiTestState}) => {
    const push = (patch = {}) => setNewAiTestState({connected: true,
        stale: false,
        port: 'COM_NEW',
        status: fixture,
        ...patch});
    push(); await pause(120);
    const reading = (selector, parent = '#new-ai-telemetry') => evaluate(
        `document.querySelector(${JSON.stringify(`${parent} ${selector}`)}).textContent`);
    assert.equal(await reading('[data-port=A] [data-field=speed] dd'), '0');
    assert.equal(await reading('[data-port=A] [data-field=angle] dd'), '0°');
    assert.equal(await reading('[data-port=B] [data-field=state] dd'), '松开');
    assert.equal(await reading('[data-metric=microphone] dd'), '0.14 V');
    assert.equal(await reading('[data-metric=pitch] dd'), '0°');
    assert.ok((await reading('[data-port=F] [data-field=channel7] dd')).includes('720'));
    assert.ok((await reading('[data-port=G] [data-target="0"]')).includes('92%'));
    assert.ok(await evaluate('!document.querySelector("#new-ai-telemetry tag")'), 'names render as text');
    await evaluate(`(() => {
        const find = (element, predicate) => {
            let fiber = element[Object.keys(element).find(key => key.startsWith('__reactInternalInstance'))];
            for (; fiber; fiber = fiber.return) {
                if (fiber.stateNode && predicate(fiber.stateNode)) return fiber.stateNode;
            }
            throw new Error('component not found');
        };
        window.telemetryRenderCounts = {dialog:0, firmware:0, telemetry:0, editor:0, ticks:0, maxGap:0};
        window.telemetryWrapped = [];
        const wrap = (instance, key) => {
            const original = instance.render;
            instance.render = function () { telemetryRenderCounts[key]++; return original.call(this); };
            telemetryWrapped.push({instance, original});
        };
        wrap(find(document.querySelector('#new-ai-connection'), instance => Boolean(instance.panel)), 'dialog');
        wrap(find(document.querySelector('#new-ai-firmware-toggle'), instance =>
            instance.state && 'confirmedErase' in instance.state), 'firmware');
        wrap(find(document.querySelector('#new-ai-telemetry'), instance =>
            instance.state && instance.state.device && !instance.panel), 'telemetry');
        wrap(findLocaleTestBlocks(), 'editor');
        let previous = performance.now();
        window.telemetryTickTimer = setInterval(() => {
            const now = performance.now(); telemetryRenderCounts.ticks++;
            telemetryRenderCounts.maxGap = Math.max(telemetryRenderCounts.maxGap, now - previous); previous = now;
        }, 16);
    })()`);
    try {
        for (let index = 1; index <= 10; index++) {
            const changed = JSON.parse(JSON.stringify(fixture));
            changed.imu.yaw = index;
            changed.ports[0].values.speed = index;
            push({status: changed}); await pause(100);
        }
        assert.equal(await reading('[data-port=A] [data-field=speed] dd'), '10');
        assert.equal(await reading('[data-metric=yaw] dd'), '10°');
        const counts = await evaluate('({...telemetryRenderCounts})');
        assert.equal(counts.dialog, 0, 'numeric updates must not render connection controls');
        assert.equal(counts.firmware, 0, 'numeric updates must not render firmware UI');
        assert.equal(counts.editor, 0, 'numeric updates must not render the Blockly container');
        assert.ok(counts.telemetry >= 1); assert.ok(counts.ticks >= 15, 'renderer event loop continues ticking');
        assert.ok(await evaluate('require("electron").ipcRenderer.listenerCount("new-ai-state-change") === 1'));
        const unavailable = JSON.parse(JSON.stringify(fixture));
        unavailable.ports[0].values = {Not_Run: 1, speed: 999};
        unavailable.ports[1] = {port: 1, label: 'B', type: 'none', values: {}};
        unavailable.ports[6].values.configs = [];
        unavailable.ports[6].values.targetCount = 0;
        push({status: unavailable}); await pause(80);
        assert.ok(await evaluate('!document.querySelector("#new-ai-telemetry [data-port=A] [data-field=speed]")'));
        assert.ok(await evaluate('!document.querySelector("#new-ai-telemetry [data-port=B] [data-field=state]")'));
        assert.ok(await evaluate('!document.querySelector("#new-ai-telemetry [data-port=G] [data-target]")'));
        push({stale: true}); await pause(80);
        assert.equal(await reading('[data-metric=yaw] dd'), '未知');
        assert.ok(await evaluate('!document.querySelector("#new-ai-telemetry [data-field=speed]")'));
        push({connected: false, status: null, port: null}); await pause(80);
        assert.equal(await reading('[data-metric=microphone] dd'), '未知');
        push(); await pause(80);
        assert.equal(await reading('[data-port=C] [data-field=cm] dd'), '25.5 cm');
        await evaluate('document.querySelector("#new-ai-hardware-panel header button").click()');
        await pause(80);
        const before = await evaluate('({...telemetryRenderCounts})');
        const changed = JSON.parse(JSON.stringify(fixture)); changed.imu.yaw = 55;
        for (let index = 0; index < 10; index++) {
            push({status: changed}); await pause(30);
        }
        const after = await evaluate('({...telemetryRenderCounts})');
        assert.equal(after.dialog, before.dialog); assert.equal(after.telemetry, before.telemetry);
        assert.equal(after.editor, before.editor);
        assert.ok(await evaluate('!document.querySelector("#new-ai-telemetry")'));
        await evaluate('document.querySelector("#new-ai-connection").click()'); await pause(100);
        assert.equal(await reading('[data-metric=yaw] dd'), '55°', 'reopen receives latest cached data');
        push(); await pause(80);
        window.webContents.invalidate();
        fs.writeFileSync(path.join(output, 'new-ai-telemetry.png'), (await window.webContents.capturePage()).toPNG());
        console.log(`NEW AI telemetry UI passed: live sensor fields, stale/disconnect clearing, shared IPC, ` +
            `no dialog/firmware/editor renders during 10Hz updates; ${counts.ticks} timer ticks, ` +
            `max gap ${Math.round(counts.maxGap)}ms.`);
        // Optional replay uses actual captured reports in this isolated UI, without opening any serial port.
        const captureArgument = process.argv.indexOf('--new-ai-telemetry-capture');
        if (captureArgument !== -1) {
            const capture = JSON.parse(fs.readFileSync(process.argv[captureArgument + 1], 'utf8'));
            const samples = [capture.initial, capture.final || capture.lastMonitor].filter(Boolean);
            assert.ok(samples.length, 'capture contains normalized monitor data');
            const units = {speed: '', angle: '°', circly: '', r: '', g: '', b: '', lux: '', cm: ' cm'};
            for (const locale of ['zh-cn', 'en', 'pt-br', 'zh-tw', 'ru']) {
                await evaluate(`window.dispatchEvent(new CustomEvent('est-home-set-locale',
                    {detail:{locale:${JSON.stringify(locale)}}}))`);
                await pause(150);
                await evaluate(`(() => {
                    if (!document.querySelector('#new-ai-hardware-panel')) {
                        document.querySelector('#new-ai-connection').click();
                    }
                })()`);
                await pause(100);
                const format = new Intl.NumberFormat(locale, {maximumFractionDigits: 2});
                for (const sample of samples) {
                    push({status: sample}); await pause(100);
                    for (const port of sample.ports) {
                        for (const [key, unit] of Object.entries(units)) {
                            if (!Object.prototype.hasOwnProperty.call(port.values, key)) continue;
                            const expected = `${format.format(Number(port.values[key]))}${unit}`;
                            const selector = `#new-ai-telemetry [data-port=${port.label}] [data-field=${key}] dd`;
                            const actual = await evaluate(`(() => {
                                const element = document.querySelector(${JSON.stringify(selector)});
                                return element ? element.textContent : null;
                            })()`);
                            assert.equal(actual, expected, `captured ${port.label}:${key} in ${locale}`);
                        }
                    }
                }
                if (locale === 'zh-cn') {
                    window.webContents.invalidate();
                    fs.writeFileSync(path.join(output, 'new-ai-peripherals-captured.png'),
                        (await window.webContents.capturePage()).toPNG());
                }
            }
            await evaluate(`window.dispatchEvent(new CustomEvent('est-home-set-locale', {detail:{locale:'zh-cn'}}))`);
            await pause(100); push(); await pause(100);
            console.log(`NEW AI captured peripheral UI passed: ${samples.length} real reports, five locales; ` +
                `source ${process.argv[captureArgument + 1]}. Screenshots: ${output}`);
        }
    } finally {
        await evaluate(`(() => {
            clearInterval(window.telemetryTickTimer);
            telemetryWrapped.forEach(({instance,original}) => { instance.render = original; });
            delete window.telemetryWrapped;
        })()`);
    }
};
