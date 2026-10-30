/* eslint-disable max-len */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

module.exports = async ({evaluate, pause, window, output, defaultStatus, setSpark, requests, resource}) => {
    const wait = async predicate => {
        for (let count = 0; count < 100; count++) {
            if (await evaluate(predicate)) return;
            await pause(60);
        }
        throw new Error(`UI did not settle: ${predicate}`);
    };
    const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    const exists = selector => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
    const updates = () => requests().filter(item => item.action === 'firmware');
    const capture = async name => {
        await pause(100);
        fs.writeFileSync(path.join(output, name), (await window.webContents.capturePage()).toPNG());
    };
    const manual = async () => {
        if (!await exists('#spark-hardware-panel')) await click('#spark-connection');
        await click('[data-action="more"]');
        await click('[role="menu"] [data-action="info"]');
        await click('#spark-firmware-toggle');
        await wait('Boolean(document.querySelector("#spark-firmware-panel"))');
    };
    if (!await exists('#spark-connection')) {
        await click('#est-hardware-select');
        await click('input[name="hardware-choice"][value="spark-ai"]');
        await click('[aria-labelledby="hardware-choice-title"] footer button:last-child');
        await wait('Boolean(document.querySelector("#spark-connection"))');
    }
    if (await exists('#spark-hardware-panel')) await click('[data-action="close"]');
    await evaluate("window.dispatchEvent(new CustomEvent('est-home-set-locale',{detail:{locale:'zh-cn'}}))");
    await pause(150);
    const normal = {connectionMode: 'usb',
        connected: true,
        port: 'COM_TEST',
        compatible: true,
        busy: false,
        stale: false,
        monitoring: true,
        error: null,
        firmware: null,
        status: defaultStatus};
    setSpark({...normal, compatible: false, status: {...defaultStatus, version: 109}});
    await wait('Boolean(document.querySelector("#spark-firmware-panel"))');
    assert.equal(await exists('#spark-hardware-panel'), false, 'auto prompt must not require the device inspector');
    const text = await evaluate('document.querySelector("#spark-firmware-panel").textContent');
    assert.ok(text.includes('109') && text.includes('110'));
    assert.equal(await evaluate('document.querySelectorAll("#spark-firmware-panel input, #spark-firmware-panel select, #spark-firmware-panel table").length'), 0);
    const before = updates().length;
    await capture('spark-firmware-auto.png');
    await click('#spark-firmware-cancel');
    for (let count = 0; count < 4; count++) {
        setSpark({status: {...defaultStatus, version: 109, timestamp: Date.now()}});
        await pause(70);
    }
    assert.equal(await exists('#spark-firmware-panel'), false, 'cancel does not re-prompt on telemetry');
    assert.equal(updates().length, before, 'cancel never updates');

    await manual();
    assert.ok((await evaluate('document.querySelector("#spark-firmware-panel").textContent')).includes('110'));
    await evaluate('document.querySelector("#spark-firmware-start").click(); document.querySelector("#spark-firmware-start").click()');
    await wait('Boolean(document.querySelector("#spark-firmware-panel progress"))');
    assert.equal(updates().length, before + 1, 'one click is enough; duplicate clicks are ignored');
    assert.equal(updates().slice(-1)[0].confirmedErase, true);
    assert.equal(updates().slice(-1)[0].recovery, false, 'normal connection automatically enters update mode');
    assert.equal(await evaluate('document.querySelector("#spark-firmware-cancel").disabled'), true);
    await capture('spark-firmware-progress.png');
    await wait('!document.querySelector("#spark-firmware-start")');
    await capture('spark-firmware-complete.png');
    await click('#spark-firmware-cancel');
    await pause(100);
    assert.equal(await exists('#spark-firmware-panel'), false, 'matching version does not prompt');

    // A real disconnect and reconnect permits a fresh mismatch prompt.
    setSpark({connected: false, status: null, firmware: null});
    await pause(100);
    setSpark({...normal, compatible: false, status: {...defaultStatus, version: 111}});
    await wait('Boolean(document.querySelector("#spark-firmware-panel"))');
    await click('#spark-firmware-cancel');
    setSpark(normal);
    await pause(100);

    for (const locale of ['zh-cn', 'zh-tw', 'pt-br', 'ru', 'en']) {
        await evaluate(`window.dispatchEvent(new CustomEvent('est-home-set-locale',{detail:{locale:${JSON.stringify(locale)}}}))`);
        await pause(200);
        await manual();
        const result = await evaluate(`(() => {const p=document.querySelector('#spark-firmware-panel');
            const r=p.getBoundingClientRect();return {text:p.textContent, fits:r.left>=0&&r.right<=innerWidth&&
                r.top>=0&&r.bottom<=innerHeight&&p.scrollWidth<=p.clientWidth,
                focused:p.contains(document.activeElement)};})()`);
        assert.ok(result.fits && result.focused, `${locale}: dialog fits and owns keyboard focus`);
        assert.ok(!/SPARK_|\bfirmware(?:Mismatch|Question|Start|Cancel|Close)\b|undefined/.test(result.text), result.text);
        await capture(`spark-firmware-${locale}.png`);
        if (locale === 'ru') {
            window.setSize(390, 720);
            await pause(150);
            assert.ok(await evaluate(`(() => {const p=document.querySelector('#spark-firmware-panel');
                const r=p.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&p.scrollWidth<=p.clientWidth;})()`));
            await capture('spark-firmware-ru-390.png');
            window.setSize(1280, 860);
        }
        await click('#spark-firmware-cancel');
    }
    await evaluate("window.dispatchEvent(new CustomEvent('est-home-set-locale',{detail:{locale:'zh-cn'}}))");
    await pause(200);

    resource(false);
    await manual();
    await click('#spark-firmware-start');
    await wait('Boolean(document.querySelector("#spark-firmware-panel [role=alert]"))');
    assert.equal(updates().length, before + 1, 'invalid resources never reach update IPC');
    await capture('spark-firmware-error.png');
    resource(true);
    await click('#spark-firmware-start');
    await wait('!document.querySelector("#spark-firmware-start")');
    assert.equal(updates().length, before + 2, 'error can be retried with one button');
    await click('#spark-firmware-cancel');

    resource(true, 200);
    await manual();
    await click('#spark-firmware-start');
    setSpark({connected: false, status: null});
    await wait('Boolean(document.querySelector("#spark-firmware-panel [role=alert]"))');
    assert.equal(updates().length, before + 2, 'disconnect during file validation cannot update a different device');
    await click('#spark-firmware-cancel');
    resource(true);

    // An interrupted update selects its sole known USB recovery port without a mode checkbox.
    setSpark({...normal,
        connected: false,
        status: null,
        error: 'SPARK_FW_RECOVERY',
        firmware: {active: false, phase: 'error', recoveryRequired: true},
        discovery: {status: 'recovery', ports: [{path: 'COM_TEST', vendorId: '0483', productId: '5740'}]}});
    await pause(100);
    await manual();
    await click('#spark-firmware-start');
    await wait('!document.querySelector("#spark-firmware-start")');
    assert.equal(updates().slice(-1)[0].recovery, true);
    assert.equal(updates().slice(-1)[0].path, 'COM_TEST');
    await click('#spark-firmware-cancel');

    setSpark({...normal, connectionMode: 'ble'});
    await pause(100);
    await manual();
    await click('#spark-firmware-start');
    await wait('Boolean(document.querySelector("#spark-firmware-panel [role=alert]"))');
    assert.ok((await evaluate('document.querySelector("#spark-firmware-panel [role=alert]").textContent')).includes('USB'));
    await click('#spark-firmware-cancel');
    assert.equal(updates().length, before + 3, 'BLE must not receive firmware frames');
    assert.ok(requests().every(item => !['run', 'download', 'stop'].includes(item.action)));
    setSpark(normal);
    await pause(100);
    await click('#spark-connection');
    await click('[data-action="more"]');
    await click('[role="menu"] [data-action="connection"]');
    fs.writeFileSync(path.join(output, 'spark-firmware-validation.json'), JSON.stringify({passed: true,
        mockUpdateRequests: updates().length - before,
        realHardwareCommands: 0,
        cases: ['auto mismatch', 'cancel deduplication', 'single confirmation', 'automatic bootloader request',
            'double click', 'progress', 'five locales', '390px', 'retry', 'device changed', 'automatic recovery', 'USB only']}, null, 2));
    console.log(`Spark firmware UI passed: ${output}`);
};
