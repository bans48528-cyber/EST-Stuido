/* eslint-disable max-len */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

module.exports = async ({evaluate, pause, window, output, setNew, setSpark, bleScan, requests, captureEnabled = true}) => {
    const wait = async predicate => {
        for (let count = 0; count < 100; count++) {
            if (await evaluate(predicate)) return;
            await pause(60);
        }
        throw Error(`Connection UI did not settle: ${predicate}`);
    };
    const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    const select = async hardware => {
        await click('#est-hardware-select');
        await click(`input[name="hardware-choice"][value="${hardware}"]`);
        await click('[aria-labelledby="hardware-choice-title"] footer button:last-child');
        await wait('!document.querySelector("input[name=hardware-choice]")');
        const prefix = hardware === 'spark-ai' ? 'spark' : hardware;
        await wait(`Boolean(document.querySelector('#${prefix}-connection'))`);
    };
    const moreConnection = async () => {
        await click('[data-action="more"]');
        await click('[role="menu"] [data-action="connection"]');
    };
    const ensureConnection = async prefix => {
        if (!await evaluate(`Boolean(document.querySelector('#${prefix}-hardware-panel'))`)) {
            await click(`#${prefix}-connection`);
        }
        if (!await evaluate('Boolean(document.querySelector("[data-connection-settings]"))')) await moreConnection();
        await wait('Boolean(document.querySelector("[data-connection-settings]"))');
    };
    const capture = async name => {
        if (!captureEnabled) return;
        await pause(120);
        fs.writeFileSync(path.join(output, name), (await window.webContents.capturePage()).toPNG());
    };
    const fits = async () => {
        const result = await evaluate(`(() => {const form=document.querySelector('[data-connection-settings]');
            const panel=form.closest('[id$="-hardware-panel"]'), r=panel.getBoundingClientRect();
            const button=form.querySelector('[data-action="connect"], [data-action="disconnect"], [data-action="bluetooth"]');
            return {fits:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&
                form.scrollWidth<=form.clientWidth&&panel.scrollWidth<=panel.clientWidth,
                radius:getComputedStyle(button).borderRadius, height:button.getBoundingClientRect().height,
                text:form.innerText};})()`);
        assert.ok(result.fits, result.text);
        assert.equal(result.radius, '8px');
        assert.ok(result.height >= 36);
        assert.ok(!/\b(?:SPARK_[A-Z_]+|NEW_[A-Z_]+|noUsbDevices|connectionMethod)\b|undefined/.test(result.text), result.text);
        return result;
    };
    const cases = [];
    for (const id of ['spark-ai', 'new-ai']) {
        await select(id);
        const prefix = id === 'spark-ai' ? 'spark' : id;
        const update = id === 'spark-ai' ? setSpark : setNew;
        update({connectionMode: 'usb',
            connected: false,
            busy: false,
            stale: false,
            status: null,
            error: null,
            firmware: null,
            bleDevice: null,
            reconnecting: false});
        await click(`#${prefix}-connection`);
        await moreConnection();
        await wait(`Boolean(document.querySelector('[data-connection-settings="${id}"]'))`);
        for (const locale of ['zh-cn', 'zh-tw', 'en', 'pt-br', 'ru']) {
            await evaluate(`window.dispatchEvent(new CustomEvent('est-home-set-locale',{detail:{locale:${JSON.stringify(locale)}}}))`);
            await pause(450);
            await ensureConnection(prefix);
            for (const width of [1280, 800, 390]) {
                window.setSize(width, 800);
                await pause(80);
                await ensureConnection(prefix);
                await fits();
                if (locale === 'zh-cn' && width === 1280) await capture(`${prefix}-connection-unified.png`);
                if (locale === 'ru' && width === 390) await capture(`${prefix}-connection-ru-390.png`);
            }
        }
        window.setSize(1280, 860);
        await evaluate("window.dispatchEvent(new CustomEvent('est-home-set-locale',{detail:{locale:'zh-cn'}}))");
        await pause(450);
        await ensureConnection(prefix);
        await click(`#${prefix}-usb-connect`);
        await wait(`document.querySelector('#${prefix}-usb-connect').dataset.action==='disconnect'`);
        await fits();
        await click(`#${prefix}-usb-connect`);
        await wait(`document.querySelector('#${prefix}-usb-connect').dataset.action==='connect'`);
        const automatic = await evaluate(`document.querySelector('#${prefix}-auto-connect').checked`);
        await click(`#${prefix}-auto-connect`);
        await pause(100);
        assert.equal(await evaluate(`document.querySelector('#${prefix}-auto-connect').checked`), !automatic);
        await click(`#${prefix}-mode-ble`);
        await wait(`Boolean(document.querySelector('#${prefix}-ble-search'))`);
        update({bleDevice: {name: 'Controller With A Long Remembered Device Name', id: '11:22:33:44:55:66'}});
        bleScan(prefix, {scanning: true,
            devices: [
                {name: 'Controller With A Long Bluetooth Name', id: '11:22:33:44:55:66'},
                {name: 'Second Controller', id: 'AA:BB:CC:DD:EE:FF'}]});
        await pause(150);
        await fits();
        await capture(`${prefix}-bluetooth-unified.png`);
        window.setSize(390, 800);
        await pause(100);
        await fits();
        await capture(`${prefix}-bluetooth-390.png`);
        bleScan(prefix, {scanning: false, devices: []});
        await pause(100);
        await click(`#${prefix}-ble-forget`);
        await pause(100);
        assert.equal(await evaluate(`Boolean(document.querySelector('#${prefix}-ble-forget'))`), false);
        await click('[data-action="close"]');
        window.setSize(1280, 860);
        cases.push(`${id}: shared form, USB connect/disconnect, automatic preference, Bluetooth/remembered device, five locales, 1280/800/390`);
    }
    await select('est');
    assert.equal(await evaluate('document.querySelectorAll("#est-connection").length'), 1);
    assert.equal(await evaluate('Boolean(document.querySelector("[class*=est-status-panel_statusBarItem]"))'), false,
        'EST exposes one connection entry, matching the other products');
    await evaluate(`document.querySelector('button[title="硬件状态"]').click()`);
    await moreConnection();
    await wait('Boolean(document.querySelector("[data-connection-settings=est]"))');
    assert.equal(await evaluate('document.querySelectorAll("[data-connection-settings=est] [aria-pressed]").length'), 1,
        'EST offers only its supported USB transport');
    await wait('document.querySelector("#est-usb-connect").dataset.action==="disconnect"');
    await fits();
    await capture('est-connection-unified.png');
    await click('#est-usb-connect');
    await wait('document.querySelector("#est-usb-connect").dataset.action==="connect"');
    assert.ok(requests().est.includes('disconnect'));
    await click('#est-usb-connect');
    await wait('document.querySelector("#est-usb-connect").dataset.action==="disconnect"');
    for (const locale of ['zh-cn', 'zh-tw', 'en', 'pt-br', 'ru']) {
        await evaluate(`window.dispatchEvent(new CustomEvent('est-home-set-locale',{detail:{locale:${JSON.stringify(locale)}}}))`);
        window.setSize(390, 800);
        await pause(120);
        await ensureConnection('est');
        await fits();
        if (locale === 'ru') await capture('est-connection-ru-390.png');
    }
    await evaluate("window.dispatchEvent(new CustomEvent('est-home-set-locale',{detail:{locale:'zh-cn'}}))");
    await pause(450);
    await ensureConnection('est');
    window.setSize(1280, 860);
    await click('[data-action="back"]');
    await capture('est-controller-updated.png');
    cases.push('est: same layout, USB HID only, real connect/disconnect callbacks, new transparent image, five locales');
    fs.writeFileSync(path.join(output, 'connection-settings-validation.json'), JSON.stringify({passed: true,
        cases,
        widths: [1280, 800, 390],
        realHardwareCommands: 0}, null, 2));
    console.log(`Unified connection UI passed: ${output}`);
};
