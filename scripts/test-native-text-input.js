// Isolated Electron/Windows input benchmark. No app project, network, AI or device access.
const {app, BrowserWindow} = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const {performance} = require('perf_hooks');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'est-native-input-'));
app.setPath('userData', path.join(output, 'profile'));
app.on('window-all-closed', () => {});
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const p95 = values => [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1];
const run = async ({accessibility, spellcheck, autocomplete = true}) => {
    app.setAccessibilitySupportEnabled(accessibility);
    const window = new BrowserWindow({show: true,
        width: 640,
        height: 240,
        title: 'EST 输入诊断 · 自动测试后关闭',
        webPreferences: {backgroundThrottling: false, spellcheck, contextIsolation: true}});
    const contents = window.webContents;
    try {
        await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(
            `<html><body><p>EST 输入诊断：正在自动比较输入模式，请稍候。</p><input id="field" ${
                autocomplete ? '' : 'autocomplete="off" '
            }><textarea></textarea></body></html>`)}`);
        contents.debugger.attach('1.3');
        await contents.debugger.sendCommand('Emulation.setFocusEmulationEnabled', {enabled: true});
        await contents.executeJavaScript('document.querySelector("input").focus()');
        await pause(200);
        const samples = [];
        for (let index = 0; index < 24; index++) {
            const start = performance.now();
            await contents.debugger.sendCommand('Input.dispatchKeyEvent', {
                type: 'keyDown', key: 'a', code: 'KeyA', text: 'a', unmodifiedText: 'a', windowsVirtualKeyCode: 65
            });
            await contents.debugger.sendCommand('Input.dispatchKeyEvent', {
                type: 'keyUp', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65
            });
            samples.push(performance.now() - start);
            await pause(20);
        }
        assert.equal(await contents.executeJavaScript('document.querySelector("input").value.length'), 24);
        const result = {accessibility,
            spellcheck,
            autocomplete,
            samples: samples.length,
            p95Ms: p95(samples),
            maxMs: Math.max(...samples)};
        console.log(JSON.stringify(result));
        return result;
    } finally {
        if (!contents.isDestroyed() && contents.debugger.isAttached()) contents.debugger.detach();
        if (!window.isDestroyed()) window.destroy();
    }
};
app.whenReady().then(async () => {
    try {
        const results = [];
        for (const options of [
            {accessibility: true, spellcheck: true},
            {accessibility: true, spellcheck: false},
            {accessibility: true, spellcheck: false, autocomplete: false},
            {accessibility: false, spellcheck: false}
        ]) results.push(await run(options));
        fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(results, null, 2));
        console.log(`Native input benchmark: ${output}`);
        app.exit(0);
    } catch (error) {
        console.error(error); app.exit(1);
    }
});
