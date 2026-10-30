/* eslint-disable max-len */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
module.exports = async ({evaluate, pause, window, output, defaultStatus, setDevice, requests, finish}) => {
    const wait = async predicate => {
        for (let i = 0; i < 140; i++) {
            if (await evaluate(predicate)) return;
            await pause(60);
        }
        throw Error(`Peripheral UI did not settle: ${predicate}`);
    };
    const visible = 'Boolean(document.querySelector("#new-ai-peripheral-panel"))';
    const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    const mismatch = {...defaultStatus,
        ports: defaultStatus.ports.map((port, index) => ({...port,
            type: ['big_motor', 'color', 'gray_v2'][index] || 'none',
            values: index < 3 ? {version: 100, [index === 2 ? 'Softwareversion' : 'SoftwareVersion']: 142} : {}}))};
    setDevice({connected: true,
        busy: false,
        stale: false,
        connectionMode: 'usb',
        port: 'COM_NEW',
        connectionRevision: 1,
        status: mismatch,
        peripheralUpdate: null});
    await wait(visible);
    assert.equal(await evaluate('Boolean(document.querySelector("#new-ai-hardware-panel"))'), false,
        'auto prompt works with inspector closed');
    assert.equal(await evaluate('document.querySelectorAll("#new-ai-peripheral-panel tbody tr").length'), 3);
    assert.equal(requests().length, 0, 'prompting never sends an upgrade');
    await click('#new-ai-peripheral-close');
    setDevice({status: JSON.parse(JSON.stringify(mismatch))});
    await pause(150); assert.equal(await evaluate(visible), false, 'dismissed reminder does not repeat');
    await click('#new-ai-connection');
    await wait('Boolean(document.querySelector("[data-action=more]"))');
    await click('[data-action=more]');
    await click('[data-action=info]');
    await wait('Boolean(document.querySelector("#new-ai-peripheral-toggle"))');
    await click('#new-ai-peripheral-toggle');
    await wait(visible);
    const localeTitles = {'zh-cn': '外设更新',
        'en': 'Peripheral update',
        'pt-br': 'Atualização de periféricos',
        'zh-tw': '周邊裝置更新',
        'ru': 'Обновление периферии'};
    for (const [locale, title] of Object.entries(localeTitles)) {
        await evaluate(`window.estCurrentLocale=${JSON.stringify(locale)};
            document.documentElement.lang=${JSON.stringify(locale)};
            window.dispatchEvent(new CustomEvent('est-locale-changed',{detail:{locale:${JSON.stringify(locale)}}}));
            window.dispatchEvent(new CustomEvent('est-home-set-locale',{detail:{locale:${JSON.stringify(locale)}}}));`);
        await wait(`document.querySelector('#new-ai-peripheral-title').textContent===${JSON.stringify(title)}`);
        for (const width of [800, 1280]) {
            window.setSize(width, 760); await pause(120);
            const fits = await evaluate(`(()=>{const p=document.querySelector('#new-ai-peripheral-panel');
                const r=p.getBoundingClientRect();return p.scrollWidth<=p.clientWidth&&r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;})()`);
            assert.ok(fits, `${locale} must fit at ${width}`);
        }
        fs.writeFileSync(path.join(output, `new-ai-peripherals-${locale}.png`), (await window.webContents.capturePage()).toPNG());
    }
    await click('#new-ai-peripheral-start');
    await wait('document.querySelector("#new-ai-peripheral-panel").getAttribute("aria-busy")==="true"');
    assert.equal(await evaluate('document.querySelector("#new-ai-peripheral-close").disabled'), true);
    assert.equal(requests().filter(item => item.action === 'peripheral').length, 1);
    assert.equal(requests()[0].connectionRevision, 1);
    finish(false);
    await wait('!document.querySelector("#new-ai-peripheral-close").disabled');
    assert.equal(await evaluate('Boolean(document.querySelector("#new-ai-peripheral-start"))'), false);
    assert.equal(await evaluate('document.querySelector("#new-ai-peripheral-panel tbody tr td:nth-child(2)").textContent'), '142');
    await click('#new-ai-peripheral-close');
    setDevice({connected: false, status: null, connectionRevision: 2}); await pause(100);
    setDevice({connected: true, status: mismatch, connectionRevision: 3});
    await wait(visible);
    await click('#new-ai-peripheral-start');
    await wait('document.querySelector("#new-ai-peripheral-close").disabled');
    finish(true);
    await wait('Boolean(document.querySelector("#new-ai-peripheral-panel [role=alert]"))');
    assert.equal(requests().filter(item => item.action === 'peripheral').length, 2);
    await pause(150);
    assert.equal(requests().filter(item => item.action === 'peripheral').length, 2, 'failure never resends');
    assert.ok(!/NEW_|\{completed\}/.test(await evaluate('document.querySelector("#new-ai-peripheral-panel").textContent')));
    await click('#new-ai-peripheral-close');
    await pause(100);
    assert.equal(await evaluate(visible), false, 'failure does not trigger a popup loop');
    fs.writeFileSync(path.join(output, 'new-ai-peripheral-validation.json'), JSON.stringify({passed: true,
        autoPrompt: true,
        cancelDedup: true,
        reconnectReminder: true,
        multiPort: true,
        locales: Object.keys(localeTitles),
        noAutomaticRetry: true,
        realHardwareWrites: 0}, null, 2));
    console.log(`NEW AI peripheral UI passed: ${output}`);
};
