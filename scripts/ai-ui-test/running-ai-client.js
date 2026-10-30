// Development-only bridge to the running app's normal AI IPC. Credentials stay in that app.
const http = require('http');
const path = require('path');
const WebSocket = require('webpack-dev-server/node_modules/ws');
const version = require('../../package.json').version;
const root = path.resolve(__dirname, '../..');
const discover = () => new Promise((resolve, reject) => {
    const request = http.get('http://127.0.0.1:5858/json/list', response => {
        let source = '';
        response.on('data', bytes => {
            source += bytes;
        });
        response.on('end', () => {
            try {
                const target = JSON.parse(source).find(item => item.type === 'node');
                if (!target || !target.webSocketDebuggerUrl.startsWith('ws://127.0.0.1:5858/')) {
                    throw new Error('Expected a local development main process');
                }
                resolve(target.webSocketDebuggerUrl);
            } catch (error) {
                reject(error);
            }
        });
    });
    request.on('error', reject);
    request.setTimeout(3000, () => request.destroy(new Error('Development app inspector unavailable')));
});
const invoke = (channel, payload) => {
    if (!['est-ai-status', 'est-ai-generate', 'est-ai-cancel'].includes(channel)) {
        throw new Error('Only AI status, generation and cancellation are permitted');
    }
    const script = `require('electron').ipcRenderer.invoke(${JSON.stringify(channel)},${JSON.stringify(payload)})`;
    const expression = `(async () => {
        if (process.cwd().toLowerCase() !== ${JSON.stringify(root.toLowerCase())}) {
            throw new Error('Unexpected application workspace');
        }
        const windows = process.mainModule.require('electron').BrowserWindow.getAllWindows()
            .filter(window => window.getTitle() === ${JSON.stringify(`ATC CodeStudio ${version}`)});
        if (windows.length !== 1) throw new Error('Expected exactly one current development window');
        return windows[0].webContents.executeJavaScript(${JSON.stringify(script)});
    })()`;
    return new Promise((resolve, reject) => {
        let socket;
        let timer;
        const finish = (error, value) => {
            clearTimeout(timer);
            if (socket) socket.close();
            if (error) reject(error); else resolve(value);
        };
        discover().then(url => {
            socket = new WebSocket(url);
            timer = setTimeout(() => finish(new Error('Development AI IPC timeout')), 100000);
            socket.on('error', error => finish(error));
            socket.on('open', () => socket.send(JSON.stringify({id: 1,
                method: 'Runtime.evaluate',
                params: {expression, awaitPromise: true, returnByValue: true}})));
            socket.on('message', bytes => {
                const message = JSON.parse(String(bytes));
                if (message.id !== 1) return;
                const result = message.result;
                if (message.error || !result || result.exceptionDetails) {
                    finish(new Error('Running application AI IPC failed')); return;
                }
                const response = result.result.value;
                if (!response || !response.ok) {
                    finish(Object.assign(new Error((response && response.error) || 'AI IPC returned no result'),
                        {code: response && response.errorCode})); return;
                }
                finish(null, response.data);
            });
        }, reject);
    });
};
module.exports = {
    status: () => invoke('est-ai-status', null),
    generate: request => invoke('est-ai-generate', request),
    cancel: id => invoke('est-ai-cancel', id).catch(() => {})
};
