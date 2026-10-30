/* eslint-disable max-len */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

module.exports = async ({evaluate, pause, window, output, defaultStatus, requests, setSpark, finish}) => {
    const wait = async predicate => {
        for (let attempt = 0; attempt < 100; attempt++) {
            if (await evaluate(predicate)) return;
            await pause(60);
        }
        throw Error(`Firmware dismissal did not settle: ${predicate}`);
    };
    const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    const visible = 'Boolean(document.querySelector("#spark-firmware-panel"))';
    const disabled = 'document.querySelector("#spark-firmware-cancel").disabled';
    const escape = () => evaluate('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));void 0');
    await wait('Boolean(document.querySelector("#spark-connection"))');
    setSpark({connected: true,
        connectionMode: 'usb',
        port: 'COM_TEST',
        busy: false,
        stale: false,
        firmware: null,
        status: {...defaultStatus, version: 109}});
    await wait(visible);
    await click('#spark-firmware-start');
    await wait('Boolean(document.querySelector("#spark-firmware-panel progress"))');
    assert.equal(await evaluate(disabled), true);
    await escape();
    assert.ok(await evaluate(visible), 'transfer remains protected until all files are sent');
    setSpark({connected: false,
        status: null,
        busy: true,
        firmware: {active: true, phase: 'restarting', transferComplete: true, bytes: 202906, total: 202906}});
    await wait(`!${disabled}`);
    assert.equal(await evaluate('document.querySelector("#spark-firmware-cancel").textContent'), '关闭');
    assert.ok(await evaluate('document.querySelector("#spark-firmware-panel").textContent.includes("后台")'));
    window.setSize(1281, 860);
    await pause(80);
    window.setSize(1280, 860);
    window.webContents.invalidate();
    await pause(250);
    fs.writeFileSync(path.join(output, 'spark-firmware-restart-phase.png'), (await window.webContents.capturePage()).toPNG());
    await click('#spark-firmware-cancel');
    await wait(`!${visible}`);
    // Telemetry continues while the firmware IPC is still pending; it cannot reopen the modal.
    setSpark({firmware: {active: true, phase: 'reconnecting', transferComplete: true}});
    await pause(150);
    assert.equal(await evaluate(visible), false);
    await evaluate(`(() => {
        for(const element of document.querySelectorAll('button')) {
            let fiber=element[Object.keys(element).find(key=>key.startsWith('__reactInternalInstance'))];
            for(;fiber;fiber=fiber.return) {
                const instance=fiber.stateNode;
                const controller=instance&&instance.firmware&&instance.firmware.current;
                if(controller&&typeof controller.waitingForRestart==='function') {controller.open();return;}
            }
        }
        throw Error('Missing firmware controller');
    })()`);
    await wait(visible);
    assert.equal(await evaluate(disabled), false, 'reconnecting can also be dismissed');
    await escape();
    await wait(`!${visible}`);
    finish();
    await pause(300);
    assert.equal(await evaluate(visible), false, 'background completion keeps the dismissed modal closed');
    assert.equal(requests().filter(request => request.action === 'firmware').length, 1);
    assert.ok(requests().every(request => request.action === 'firmware'), 'dismiss never sends cancel or device commands');
    fs.writeFileSync(path.join(output, 'spark-firmware-dismiss-validation.json'), JSON.stringify({passed: true,
        cases: ['transfer protected', 'close while update IPC pending', 'hidden during reconnect',
            'Escape during reconnect', 'background completion stays hidden'],
        realHardwareCommands: 0}, null, 2));
    console.log(`Spark firmware dismissal UI passed: ${output}`);
};
