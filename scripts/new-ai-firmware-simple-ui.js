/* eslint-disable max-len */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
module.exports = async ({evaluate, pause, window, output, defaultStatus, setDevice, requests, finish}) => {
    const wait = async predicate => {
        for (let i = 0; i < 120; i++) {
            if (await evaluate(predicate)) return;
            await pause(60);
        }
        throw Error(`NEW AI firmware UI did not settle: ${predicate}`);
    };
    const visible = 'Boolean(document.querySelector("#new-ai-firmware-panel"))';
    const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    setDevice({connected: true,
        busy: false,
        stale: false,
        port: 'COM_NEW',
        connectionMode: 'usb',
        status: {...defaultStatus, version: 193, legacyProtocol: true},
        firmware: null});
    await wait(visible);
    assert.equal(await evaluate('document.querySelectorAll("#new-ai-firmware-panel input").length'), 0);
    assert.ok(await evaluate('document.querySelector("#new-ai-firmware-panel").textContent.includes("193")'));
    assert.ok(await evaluate('document.querySelector("#new-ai-firmware-notice").textContent.includes("程序")'));
    assert.equal(requests().filter(item => item.action === 'firmware').length, 0);
    window.setSize(1281, 860); await pause(80); window.setSize(1280, 860);
    window.webContents.invalidate(); await pause(200);
    fs.writeFileSync(path.join(output, 'new-ai-firmware-confirm.png'), (await window.webContents.capturePage()).toPNG());
    await click('#new-ai-firmware-cancel');
    await wait(`!${visible}`);
    setDevice({status: {...defaultStatus, version: 193, legacyProtocol: true}});
    await pause(150); assert.equal(await evaluate(visible), false, 'dismissed prompt does not repeat');
    await evaluate(`window.findNewFirmware=()=>{for(const el of document.querySelectorAll('div,button')){let f=el[Object.keys(el).find(k=>k.startsWith('__reactInternalInstance'))];for(;f;f=f.return){const i=f.stateNode;if(i&&i.firmwarePanel&&i.firmwarePanel.current)return i.firmwarePanel.current;}}};findNewFirmware().open();`);
    await wait(visible);
    await click('#new-ai-firmware-start');
    await wait('Boolean(document.querySelector("#new-ai-firmware-panel progress"))');
    assert.equal(requests().filter(item => item.action === 'firmware').length, 1);
    const request = requests().find(item => item.action === 'firmware');
    assert.equal(request.confirmedErase, true);
    assert.equal('confirmedLegacyIdle' in request, false);
    assert.equal(await evaluate('document.querySelector("#new-ai-firmware-cancel").disabled'), true);
    setDevice({connected: false,
        status: null,
        busy: true,
        firmware: {active: true, phase: 'restarting', transferComplete: true, bytes: 2116990, total: 2116990}});
    await wait('!document.querySelector("#new-ai-firmware-cancel").disabled');
    await click('#new-ai-firmware-cancel');
    await wait(`!${visible}`);
    finish(); await pause(250);
    assert.equal(await evaluate(visible), false, 'background completion does not reopen the modal');
    assert.equal(requests().filter(item => item.action === 'firmware').length, 1);
    fs.writeFileSync(path.join(output, 'new-ai-firmware-simple-validation.json'), JSON.stringify({passed: true,
        singleConfirmation: true,
        noCheckboxes: true,
        backgroundRestart: true,
        realHardwareCommands: 0}, null, 2));
    console.log(`NEW AI simplified firmware UI passed: ${output}`);
};
