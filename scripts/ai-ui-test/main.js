/* eslint-disable no-underscore-dangle, global-require */
const {app, BrowserWindow, ipcMain, safeStorage} = require('electron');
const assert = require('assert');
const Module = require('module');
const babel = require('@babel/core');
const fs = require('fs');
const path = require('path');

const output = process.argv[2];
const onlineNewAi = process.argv.includes('--online-new-ai');
const typingOnly = process.argv.includes('--typing-only');
const useRunningAi = process.argv.includes('--via-running-app');
assert.ok(!useRunningAi || onlineNewAi, 'The running-app bridge requires explicit online mode');
const guideCaptureDirectory = process.env.EST_AI_GUIDE_CAPTURE_DIR ?
    path.resolve(process.env.EST_AI_GUIDE_CAPTURE_DIR) : null;
const userData = path.join(output, 'electron-data');
fs.mkdirSync(userData, {recursive: true});
app.setPath('userData', userData);
const originalLoader = Module._extensions['.js'];
const sourceRoot = path.resolve(__dirname, '../../src');
Module._extensions['.js'] = (module, filename) => {
    if (!filename.startsWith(sourceRoot)) return originalLoader(module, filename);
    module._compile(babel.transformSync(fs.readFileSync(filename, 'utf8'), {
        babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs']
    }).code, filename);
};
const {registerEstAiIpc, createEstAiService} = require('../../src/main/est/ai-service');
const {createEstAiKeyStore, getEstAiSettingsPath} = require('../../src/main/est/ai-key-store');
const {NewAiCompiler} = require('../../src/main/new-ai/compiler');
Module._extensions['.js'] = originalLoader;
let window;
ipcMain.handle('test-typing-report', (event, report) => {
    assert.equal(event.sender, window.webContents);
    fs.writeFileSync(path.join(output, 'typing-performance.json'), JSON.stringify(report, null, 2));
    console.log(`Typing performance: ${JSON.stringify(report)}; output: ${output}`);
});
let reply = '';
let replyError = '';
let releaseReply = null;
let holdReply = false;
// A file occupying the old dev data-directory path reproduces the user's failure.
const oldDataPath = path.join(output, 'Electron');
fs.writeFileSync(oldDataPath, 'existing file - must be preserved');
const configPath = getEstAiSettingsPath({getPath: () => output});
const store = createEstAiKeyStore({
    safeStorage,
    fs,
    getPath: () => configPath,
    getLegacyPath: () => path.join(oldDataPath, 'est-ai-key.bin')
});
const timeout = setTimeout(() => {
    console.error('EST AI UI test timed out');
    app.exit(1);
}, onlineNewAi ? 420000 : 180000);
registerEstAiIpc({
    ipcMain,
    isAllowedSender: event => window && event.sender === window.webContents,
    keyStore: store,
    transport: request => {
        assert.strictEqual(request.config.baseUrl, 'https://example.com/v1');
        assert.strictEqual(request.config.model, 'test-model');
        return new Promise((resolve, reject) => {
            const finish = () => (replyError ? reject(new Error(replyError)) : resolve(reply));
            if (holdReply) releaseReply = finish;
            else finish();
        });
    }
});
const hardwareRequests = {est: 0, newAi: 0};
ipcMain.handle('est-auto-connect', () => {
    hardwareRequests.est++; return {state: 'not-found', status: null};
});
ipcMain.handle('spark-state', () => ({connected: false}));
ipcMain.handle('new-ai-state', () => {
    hardwareRequests.newAi++;
    return {connected: true,
        stale: false,
        status: {version: 321,
            ports: [
                {port: 0, type: 'big_motor'}, {port: 1, type: 'color'}, {port: 2, type: 'ultrasion'}
            ]}};
});
ipcMain.handle('test-hardware-requests', () => ({...hardwareRequests}));
let onlineService;
let onlineCalls = 0;
if (onlineNewAi) {
    const productionStore = createEstAiKeyStore({safeStorage,
        fs,
        getPath: () => getEstAiSettingsPath(app)});
    onlineService = createEstAiService({keyStore: {read: () => productionStore.read(),
        write: () => {
            throw new Error('Online validation must not change saved settings');
        }}});
    if (useRunningAi) onlineService = require('./running-ai-client');
    ipcMain.handle('test-online-status', () => onlineService.status());
    ipcMain.handle('est-ai-online-generate', async (event, request) => {
        assert.equal(event.sender, window.webContents);
        assert.ok(onlineCalls < 9, 'limit online validation to nine completions including repairs');
        const call = ++onlineCalls;
        const started = Date.now();
        const timer = setTimeout(() => onlineService.cancel(request.id), 90000);
        try {
            const status = await onlineService.status();
            assert.equal(new URL(status.config.baseUrl).origin, 'https://faroapi.com', 'only the approved endpoint');
            assert.equal(status.config.model, 'deepseek-v4.1-flash', 'only the approved model');
            const data = await onlineService.generate(request);
            fs.writeFileSync(path.join(output, `new-ai-online-response-${call}.txt`), data.content);
            console.log(JSON.stringify({onlineCall: call,
                elapsedMs: Date.now() - started,
                responseCharacters: data.content.length}));
            return {ok: true, data};
        } catch (error) {
            return {ok: false, error: error.message, errorCode: error.code};
        } finally {
            clearTimeout(timer);
        }
    });
    ipcMain.handle('test-online-record', (event, record) => {
        assert.equal(event.sender, window.webContents);
        const report = {softwareVersion: require('../../package.json').version,
            ...record,
            onlineCalls,
            hardwareAccessed: false,
            settingsChanged: false,
            checkedAt: new Date().toISOString()};
        fs.writeFileSync(path.join(output, 'new-ai-online-result.json'), JSON.stringify(report, null, 2));
        console.log(JSON.stringify({onlineCase: record.cases.at(-1) && record.cases.at(-1).id,
            casesPassed: record.cases.length,
            error: record.error,
            output}));
    });
}
ipcMain.handle('test-new-ai-compile', async (event, cases) => {
    const compiler = new NewAiCompiler();
    for (const item of cases) {
        fs.writeFileSync(path.join(output, `${item.name}.py`), item.source);
        const result = await compiler.compile(item.source);
        assert.ok(result.length > 16, item.name);
    }
    console.log(`NEW AI assistant native Pika compilation passed: ${cases.length} programs.`);
});
ipcMain.handle('test-storage', () => {
    const encrypted = fs.readFileSync(configPath);
    assert.ok(!encrypted.toString('utf8').includes('test-key-not-real'));
    const decrypted = JSON.parse(store.read());
    assert.strictEqual(decrypted.apiKey, 'test-key-not-real');
    assert.strictEqual(fs.readFileSync(oldDataPath, 'utf8'), 'existing file - must be preserved');
    const freshStore = createEstAiKeyStore({safeStorage, fs, getPath: () => configPath});
    const freshService = createEstAiService({keyStore: freshStore});
    const status = freshService.status();
    assert.ok(status.configured && status.hasKey);
    assert.ok(!JSON.stringify(status).includes('test-key-not-real'));
    return status;
});
ipcMain.handle('test-reply', (event, content, options = {}) => {
    reply = content;
    holdReply = Boolean(options.hold);
    replyError = options.error || '';
});
ipcMain.handle('test-release-reply', () => {
    if (releaseReply) releaseReply();
    releaseReply = null;
});
ipcMain.handle('test-motion', async (event, reduced) => {
    if (!window.webContents.debugger.isAttached()) window.webContents.debugger.attach('1.3');
    await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
        features: [{name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference'}]
    });
});
ipcMain.handle('test-key', async (event, key) => {
    if (!window.webContents.debugger.isAttached()) window.webContents.debugger.attach('1.3');
    await window.webContents.debugger.sendCommand('Emulation.setFocusEmulationEnabled', {enabled: true});
    await window.webContents.executeJavaScript('document.querySelector(".est-menu-bar-ai-button").focus()');
    const keys = {'Enter': 13, 'Tab': 9, ' ': 32};
    await window.webContents.debugger.sendCommand('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key,
        code: key,
        windowsVirtualKeyCode: keys[key],
        text: key === 'Enter' ? '\r' : ''
    });
    await window.webContents.debugger.sendCommand('Input.dispatchKeyEvent', {
        type: 'keyUp', key, windowsVirtualKeyCode: keys[key]
    });
});
ipcMain.handle('test-capture', async (event, name, rectangle) => {
    // A hidden BrowserWindow can return the previous compositor frame on its first capture.
    await window.webContents.capturePage(rectangle);
    const screenshot = await window.webContents.capturePage(rectangle);
    const destination = path.join(output, `${name}.png`);
    fs.writeFileSync(destination, screenshot.toPNG());
    console.log(`Screenshot: ${destination}`);
    if (guideCaptureDirectory && ['welcome', 'settings', 'conversation'].includes(name)) {
        fs.mkdirSync(guideCaptureDirectory, {recursive: true});
        const guideDestination = path.join(guideCaptureDirectory, `home-guide-ai-${name}.png`);
        fs.writeFileSync(guideDestination, screenshot.toPNG());
        console.log(`Guide screenshot: ${guideDestination}`);
    }
});
ipcMain.handle('test-resize', (event, width, height) => window.setContentSize(width, height));
ipcMain.handle('test-python', (event, name, source, hardwareId = 'est') => {
    const {spawnSync} = require('child_process');
    const candidates = process.env.PYTHON ? [{command: process.env.PYTHON, args: []}] :
        [{command: 'python', args: []}, {command: 'python3', args: []}, {command: 'py', args: ['-3']}];
    const python = candidates.find(candidate => spawnSync(candidate.command, candidate.args.concat('--version'),
        {windowsHide: true, timeout: 5000}).status === 0);
    assert.ok(python, 'Python 3 is required for real generated-code syntax validation');
    fs.writeFileSync(path.join(output, `${name}.py`), source);
    const result = spawnSync(python.command, python.args.concat(path.resolve(__dirname, '../check-python-syntax.py')), {
        input: JSON.stringify({cases: [{name, source}]}),
        encoding: 'utf8',
        windowsHide: true,
        timeout: 10000,
        env: {...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1'}
    });
    assert.strictEqual(result.status, 0, result.stdout + result.stderr);
    console.log(`Real Blockly Python syntax passed: ${name}`);
    if (hardwareId === 'spark-ai') return;
    const simulationScript = path.join(__dirname, 'check-generated-program.py');
    const simulated = spawnSync(python.command, python.args.concat(simulationScript), {
        input: JSON.stringify({name, source}),
        encoding: 'utf8',
        windowsHide: true,
        timeout: 10000,
        env: {...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1'}
    });
    assert.strictEqual(simulated.status, 0, simulated.stdout + simulated.stderr);
    console.log(`Simulated Python execution passed: ${simulated.stdout.trim()}`);
});
app.whenReady().then(async () => {
    window = new BrowserWindow({
        show: false,
        width: 1280,
        height: 860,
        useContentSize: true,
        webPreferences: {nodeIntegration: true, contextIsolation: false, backgroundThrottling: false}
    });
    window.webContents.on('console-message', (event, level, message) => {
        if (level >= 2) console.log(`Renderer: ${message}`);
    });
    try {
        const blockedStore = createEstAiKeyStore({
            safeStorage, fs, getPath: () => path.join(oldDataPath, 'est-ai-key.bin')
        });
        assert.throws(() => blockedStore.write('test-key-not-real'), /EEXIST|ENOTDIR/);
        await window.loadFile(path.join(output, 'index.html'));
        const result = await window.webContents.executeJavaScript(typingOnly ?
            `window.runAiTypingPerformance(${process.argv.includes('--strict-typing')})` : (onlineNewAi ?
                'window.runNewAiOnlineTests()' : 'window.runEstAiUiTests()'));
        console.log(result);
        clearTimeout(timeout);
        app.exit(0);
    } catch (error) {
        console.error(error);
        clearTimeout(timeout);
        app.exit(1);
    }
});
