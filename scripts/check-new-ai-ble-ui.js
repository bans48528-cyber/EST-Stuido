/* eslint-disable max-len */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Runs only inside the isolated renderer harness. The Bluetooth API is replaced before search is clicked.
module.exports = async ({evaluate, pause, window, output, newAiRequests, setNewAiTestState}) => {
    const originalSize = window.getSize();
    setNewAiTestState({connectionMode: 'usb',
        bleDevice: null,
        reconnecting: false,
        busy: false,
        connected: false,
        firmware: null,
        status: null,
        error: null,
        port: null});
    await evaluate(`(() => {
        if (!document.querySelector('#new-ai-hardware-panel')) document.querySelector('#new-ai-connection').click();
        window.newAiOriginalRequestDevice = navigator.bluetooth.requestDevice;
        navigator.bluetooth.requestDevice = options => {
            window.newAiBluetoothOptions = options;
            return new Promise(resolve => {
                window.finishNewAiBleChoice = () => resolve({id:'opaque-new-ai-test'});
            });
        };
    })()`);
    try {
        await evaluate('document.querySelector("#new-ai-mode-ble").click()'); await pause(120);
        assert.equal(await evaluate('document.querySelector("#new-ai-mode-ble").getAttribute("aria-pressed")'), 'true');
        assert.ok(await evaluate('!document.querySelector("#new-ai-firmware-toggle")'));
        await evaluate('document.querySelector("#new-ai-ble-search").click()'); await pause(100);
        assert.ok(await evaluate('document.querySelector("#new-ai-hardware-panel").textContent.includes("(mock)")'));
        const start = newAiRequests.length;
        await evaluate('document.querySelector("#new-ai-ble-search").click()'); await pause(100);
        assert.ok(newAiRequests.slice(start).some(request => request.action === 'ble-cancel'));
        assert.ok(!newAiRequests.slice(start).some(request => request.action === 'connect'));
        await evaluate('document.querySelector("#new-ai-ble-search").click()'); await pause(100);
        await evaluate('document.querySelector("#new-ai-hardware-panel ul button").click()'); await pause(40);
        assert.ok(await evaluate('document.querySelector("#new-ai-mode-usb").disabled'));
        await pause(180);
        assert.ok(newAiRequests.some(request => request.action === 'ble-bind' && request.id === 'opaque-new-ai-test'));
        assert.ok(newAiRequests.some(request => request.action === 'connect' && request.type === 'ble'));
        assert.equal(await evaluate('document.querySelector("#new-ai-telemetry [data-metric=bluetooth] dd").textContent'),
            'EST_BLUE NEW AI (mock)');
        assert.ok(await evaluate('document.querySelector("#new-ai-ble-forget").disabled'));
        for (const [locale, search, forget, error] of [
            ['zh-cn', '断开', '忘记设备', '所需的蓝牙服务'],
            ['en', 'Disconnect', 'Forget device', 'required Bluetooth service'],
            ['pt-br', 'Desconectar', 'Esquecer dispositivo', 'serviço Bluetooth necessário'],
            ['zh-tw', '中斷連線', '忘記裝置', '所需的藍牙服務'],
            ['ru', 'Отключить', 'Забыть устройство', 'нужную службу Bluetooth']]) {
            await evaluate(`window.dispatchEvent(new CustomEvent('est-home-set-locale',
                {detail:{locale:${JSON.stringify(locale)}}}))`); await pause(220);
            await evaluate(`(() => {
                if (!document.querySelector('#new-ai-hardware-panel')) {
                    document.querySelector('#new-ai-connection').click();
                }
            })()`); await pause(100);
            assert.equal(await evaluate('document.querySelector("#new-ai-ble-search").textContent'), search);
            assert.equal(await evaluate('document.querySelector("#new-ai-ble-forget").textContent'), forget);
            setNewAiTestState({error: 'NEW_BLE_SERVICE'}); await pause(50);
            assert.ok(await evaluate(
                `document.querySelector('#new-ai-hardware-panel [role=alert]').textContent.includes(${JSON.stringify(error)})`));
            setNewAiTestState({error: null});
        }
        await evaluate(`window.dispatchEvent(new CustomEvent('est-home-set-locale', {detail:{locale:'zh-cn'}}))`);
        await pause(220);
        await evaluate(`(() => {
            if (!document.querySelector('#new-ai-hardware-panel')) document.querySelector('#new-ai-connection').click();
        })()`); await pause(100);
        for (const width of [800, 1280]) {
            window.setSize(width, 780); await pause(120);
            const box = await evaluate(`(() => {
                const panel=document.querySelector('#new-ai-hardware-panel'), rect=panel.getBoundingClientRect();
                return {left:rect.left,right:rect.right,width:innerWidth,scroll:panel.scrollWidth,client:panel.clientWidth};
            })()`);
            assert.ok(box.left >= 0 && box.right <= box.width + 1 && box.scroll <= box.client + 1,
                JSON.stringify(box));
            fs.writeFileSync(path.join(output, `new-ai-bluetooth-${width}.png`),
                (await window.webContents.capturePage()).toPNG());
        }
        setNewAiTestState({status: {version: 321, running: true, ports: []}}); await pause(80);
        assert.ok(await evaluate('document.querySelector("#new-ai-mode-usb").disabled'));
        setNewAiTestState({status: {version: 321, running: false, ports: []}}); await pause(80);
        await evaluate('document.querySelector("#new-ai-ble-search").click()'); await pause(100);
        assert.equal(newAiRequests.at(-1).action, 'disconnect');
        await evaluate('document.querySelector("#new-ai-ble-forget").click()'); await pause(80);
        assert.equal(newAiRequests.at(-1).action, 'ble-forget');
        assert.ok(await evaluate('!document.querySelector("#new-ai-ble-forget")'));
        setNewAiTestState({busy: true, reconnecting: true}); await pause(80);
        assert.equal(await evaluate('document.querySelector("#new-ai-ble-search").textContent'), '暂停重连');
        await evaluate('document.querySelector("#new-ai-ble-search").click()'); await pause(80);
        assert.deepStrictEqual(newAiRequests.at(-1), {action: 'automatic', enabled: false});
        setNewAiTestState({busy: false, reconnecting: false}); await pause(80);
        await evaluate('document.querySelector("#new-ai-mode-usb").click()'); await pause(100);
        assert.ok(await evaluate('Boolean(document.querySelector("#new-ai-firmware-toggle"))'));
        await evaluate('document.querySelector("#new-ai-hardware-panel header button").click()');
        console.log('NEW AI BLE UI passed: mode/search/cancel/selection, identification wait, remembered device/forget, ' +
            'pause reconnect, five languages, USB-only firmware, running guard and 800/1280 layouts. No radio used.');
    } finally {
        await evaluate('void (navigator.bluetooth.requestDevice = window.newAiOriginalRequestDevice)');
        window.setSize(...originalSize);
        await pause(250);
    }
};
