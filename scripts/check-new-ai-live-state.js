// Development acceptance: cached NEW AI status only. No scan/connect/program/firmware commands are exposed.
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const WebSocket = require('webpack-dev-server/node_modules/ws');
const version = require('../package.json').version;
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const argument = (key, fallback) => (args.includes(key) ? args[args.indexOf(key) + 1] : fallback);
const seconds = Number(argument('--seconds', '15'));
assert.ok(Number.isInteger(seconds) && seconds >= 1 && seconds <= 30);
const mode = argument('--mode', 'ble');
assert.ok(['usb', 'ble'].includes(mode));
const discover = () => new Promise((resolve, reject) => {
    const request = http.get('http://127.0.0.1:5858/json/list', response => {
        let text = '';
        response.on('data', bytes => {
            text += bytes;
        });
        response.on('end', () => {
            try {
                const target = JSON.parse(text).find(item => item.type === 'node');
                assert.ok(target && target.webSocketDebuggerUrl.startsWith('ws://127.0.0.1:5858/'));
                resolve(target.webSocketDebuggerUrl);
            } catch (error) {
                reject(error);
            }
        });
    });
    request.on('error', reject);
    request.setTimeout(3000, () => request.destroy(new Error('Local development inspector unavailable')));
});
const expression = `(async () => {
    if(process.cwd().toLowerCase()!==${JSON.stringify(root.toLowerCase())}) {
        throw new Error('Unexpected workspace');
    }
    const windows=process.mainModule.require('electron').BrowserWindow.getAllWindows()
        .filter(w=>w.getTitle()===${JSON.stringify(`EST Studio ${version}`)});
    if(windows.length!==1)throw new Error('Expected one current development window');
    const window=windows[0], started=Date.now(), samples=[];
    while(Date.now()-started<${seconds * 1000}) {
        const request="require('electron').ipcRenderer.invoke('new-ai-state')";
        const state=await window.webContents.executeJavaScript(request);
        const status=state.status;
        samples.push({elapsedMs:Date.now()-started,connected:state.connected,mode:state.connectionMode,
            verified:state.identityVerified,stale:state.stale,error:state.error,
            timestamp:status&&status.timestamp,version:status&&status.version,running:status&&status.running,
            device:state.bleDevice,ports:status&&status.ports,imu:status&&status.imu});
        await new Promise(resolve=>setTimeout(resolve,100));
    }
    return {version:${JSON.stringify(version)},elapsedMs:Date.now()-started,
        readOnly:true,ipcChannel:'new-ai-state',deviceCommandsSent:0,samples};
})()`;
(async () => {
    const url = await discover();
    const report = await new Promise((resolve, reject) => {
        const socket = new WebSocket(url);
        const timer = setTimeout(() => {
            socket.close(); reject(new Error('Status acceptance timed out'));
        },
        (seconds + 15) * 1000);
        socket.on('error', error => {
            clearTimeout(timer); reject(error);
        });
        socket.on('open', () => socket.send(JSON.stringify({id: 1,
            method: 'Runtime.evaluate',
            params: {expression, awaitPromise: true, returnByValue: true}})));
        socket.on('message', bytes => {
            const message = JSON.parse(String(bytes));
            if (message.id !== 1) return;
            clearTimeout(timer); socket.close();
            if (message.error || !message.result || message.result.exceptionDetails) {
                reject(new Error('Read-only status acceptance failed')); return;
            }
            resolve(message.result.result.value);
        });
    });
    const bad = report.samples.filter(sample => !sample.connected || !sample.verified || sample.stale ||
        sample.mode !== mode || sample.version !== 321 || sample.running !== false);
    report.observedStatusUpdates = new Set(report.samples.map(sample => sample.timestamp)).size;
    report.invalidSamples = bad.length;
    report.passed = bad.length === 0 && report.samples.length >= seconds && report.observedStatusUpdates >= seconds;
    report.note = '100 ms cached-state samples; observed updates are not the raw radio frame rate.';
    const output = argument('--output', null);
    if (output) fs.writeFileSync(path.resolve(output), JSON.stringify(report, null, 2), {flag: 'wx'});
    console.log(JSON.stringify({passed: report.passed,
        elapsedMs: report.elapsedMs,
        samples: report.samples.length,
        observedStatusUpdates: report.observedStatusUpdates,
        deviceCommandsSent: 0,
        first: report.samples[0],
        last: report.samples.at(-1)}));
    assert.equal(report.passed, true, 'Every sampled state must stay connected, fresh, verified and stopped');
    assert.ok(report.observedStatusUpdates >= seconds, 'Status must continue refreshing');
})().catch(error => {
    console.error(error.message); process.exitCode = 1;
});
