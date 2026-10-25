/* eslint-disable global-require */
// Exercise the compiled renderer with an isolated profile and no hardware connection.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

if (!process.versions.electron) {
    const result = require('child_process').spawnSync(require('electron'), [__filename, ...process.argv.slice(2)], {
        windowsHide: true, stdio: 'inherit', env: {...process.env, NODE_OPTIONS: ''}
    });
    process.exitCode = result.status === null ? 1 : result.status;
} else {
    const {app, BrowserWindow, ipcMain, dialog} = require('electron');
    const nativeMessages = [];
    dialog.showMessageBox = (parent, options) => {
        nativeMessages.push(options || parent);
        return Promise.resolve({response: 0});
    };
    const remote = require('@electron/remote/main');
    const output = fs.mkdtempSync(path.join(os.tmpdir(), 'est-locale-test-'));
    app.setPath('userData', path.join(output, 'profile'));
    remote.initialize();
    let cameraOpenRequests = 0;
    let cameraLocale;
    let openedCameraLocale;
    let hardwareRequests = 0;
    let hardwareActive = 0;
    let hardwareMaxActive = 0;
    let hardwareMockEnabled = false;
    let selectedHardware = 'est';
    let startupProjectData = null;
    const sparkPorts = [{path: 'COM_TEST', friendlyName: 'Spark AI USB (mock)',
        vendorId: '0483', productId: '5740', serialNumber: 'SPARK_TEST'}];
    let sparkState = {state: 'disconnected', connected: false, busy: false, compatible: false,
        compilerSupported: true, stale: false, monitoring: true, status: null, operation: null, logs: [],
        discovery: {enabled: true, status: 'waiting', ports: sparkPorts, revision: 0}};
    const sparkRequests = [];
    const newAiRequests = [];
    const newAiFirmwareRelease = require('../src/main/new-ai/firmware-release.json');
    const newAiPorts = [{path: 'COM_NEW', friendlyName: 'NEW AI USB (mock)', vendorId: '0483', productId: '5740'}];
    const newAiStatus = {version: 321, battery: 86.5, running: false,
        ports: Array.from({length: 8}, (_, port) => ({port, label: 'ABCDEFGH'[port], type: port ? 'none' : 'big_motor'}))};
    let newAiState = {state: 'disconnected', connected: false, busy: false, status: null,
        connectionMode: 'usb', bleDevice: null, reconnecting: false,
        compilerSupported: true, downloadSupported: false, programSupported: false,
        discovery: {enabled: true, active: true, status: 'waiting', ports: newAiPorts}};
    const newAiAuto = {usb: true, ble: true};
    let newAiBleScanning = false;
    const mockNewAiCompile = async (event, request, download = false, run = false) => {
        assert.equal(selectedHardware, 'new-ai');
        newAiRequests.push({action: run ? 'run' : (download ? 'download' : 'compile'), ...request});
        if (download) assert.ok(Number.isInteger(request.slot) && request.slot >= 0 && request.slot < 20);
        newAiState = {...newAiState, busy: true, result: null,
            operation: {phase: 'compiling', bytes: 0, total: 0}};
        event.sender.send('new-ai-state-change', newAiState);
        await new Promise(resolve => setTimeout(resolve, 60));
        if (download) {
            newAiState = {...newAiState, operation: {phase: 'downloading', bytes: 20, total: 100}};
            event.sender.send('new-ai-state-change', newAiState);
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        if (run) {
            newAiState = {...newAiState, operation: {phase: 'starting', bytes: 100, total: 100}};
            event.sender.send('new-ai-state-change', newAiState);
            await new Promise(resolve => setTimeout(resolve, 120));
        }
        const result = {compiled: true, size: 100, ...(download ? {downloaded: true, slot: request.slot} : {}),
            ...(run ? {startRequested: true, runObserved: true} : {})};
        newAiState = {...newAiState, busy: false, operation: null, result,
            ...(run ? {status: {...newAiStatus, running: true}} : {})};
        event.sender.send('new-ai-state-change', newAiState);
        return result;
    };
    let interruptSparkDownload = false;
    let firmwareChecks = 0;
    const firmwareRelease = require('../src/main/spark-ai/firmware-release.json');
    const sparkStatus = {version: 110, battery: 85, heap: 12, running: false,
        flash: {total: '1024 kb', free: '512 kb'}, ports: [
            {port: 0, type: 'color', values: {lux: 100, state: 1, min: 10, max: 900, threadValue: 455}},
            {port: 1, type: 'touch', values: {state: 1}}, {port: 2, type: 'ultrasion', values: {cm: 25}},
            {port: 3, type: 'ir_remote', values: {state: 2}}
        ]};
    const sendSpark = event => event.sender.send('spark-state-change', sparkState);
    const mockSparkProgram = async (event, request, action) => {
        sparkRequests.push({action, ...request});
        sparkState = {...sparkState, busy: true, result: null,
            operation: {phase: action === 'stop' ? 'stopping' : 'downloading', bytes: 80, total: 110}};
        sendSpark(event);
        await new Promise(resolve => setTimeout(resolve, 160));
        if (interruptSparkDownload && action === 'download') {
            interruptSparkDownload = false;
            sparkState = {...sparkState, busy: false, operation: null, result: null, error: null,
                warning: 'SPARK_DOWNLOAD_INCOMPLETE'};
            sendSpark(event);
            throw new Error('SPARK_DOWNLOAD_INCOMPLETE');
        }
        const result = action === 'stop' ? {stopObserved: true} :
            {downloaded: true, slot: request.slot, startRequested: action === 'run', runObserved: action === 'run'};
        sparkState = {...sparkState, busy: false, operation: null, result,
            warning: action === 'stop' ? sparkState.warning : null,
            status: {...sparkStatus, running: action === 'run'}};
        sendSpark(event);
        return result;
    };
    const hardwareDrafts = new Map();
    for (const [name, handler] of Object.entries({
        'get-initial-project-data': () => startupProjectData,
        'est-home-get-startup-state': () => ({hasInitialProject: true}),
        'est-home-list-recent-projects': () => [],
        'est-home-get-build-library-state': () => ({}),
        'hardware-state': () => ({hardwareId: selectedHardware, busy: false, running: false}),
        'hardware-select': (event, {hardwareId}) => {
            if (!['est', 'spark-ai', 'new-ai'].includes(hardwareId)) throw new Error('HARDWARE_UNKNOWN');
            selectedHardware = hardwareId;
            return {hardwareId, busy: false};
        },
        'hardware-draft-write': (event, draft) => { hardwareDrafts.set(draft.hardwareId, draft); },
        'hardware-draft-read': (event, hardwareId) => hardwareDrafts.get(hardwareId) || null,
        'spark-state': () => sparkState,
        'new-ai-state': () => newAiState,
        'new-ai-list-devices': () => newAiPorts,
        'new-ai-connection-mode': (event, mode) => {
            assert.ok(['usb', 'ble'].includes(mode));
            newAiAuto[newAiState.connectionMode] = newAiState.discovery.enabled;
            newAiRequests.push({action: 'mode', mode});
            newAiState = {...newAiState, connectionMode: mode, state: 'disconnected', connected: false,
                busy: false, port: null, status: null, identityVerified: false, downloadSupported: false,
                discovery: {...newAiState.discovery, enabled: newAiAuto[mode]}};
            event.sender.send('new-ai-state-change', newAiState);
            return newAiState;
        },
        'new-ai-ble-scan': event => {
            assert.equal(newAiState.connectionMode, 'ble');
            newAiRequests.push({action: 'ble-scan'}); newAiBleScanning = true;
            event.sender.send('new-ai-ble-scan-state', {scanning: true, devices: [
                {id: '11:22:33:44:55:66', name: 'EST_BLUE NEW AI (mock)'}]});
        },
        'new-ai-ble-select': (event, id) => {
            assert.equal(id, '11:22:33:44:55:66');
            newAiRequests.push({action: 'ble-select', id}); newAiBleScanning = false;
            event.sender.send('new-ai-ble-scan-state', {scanning: false, devices: []});
            return event.sender.executeJavaScript('window.finishNewAiBleChoice()');
        },
        'new-ai-ble-bind': (event, id) => {
            assert.equal(id, 'opaque-new-ai-test'); newAiRequests.push({action: 'ble-bind', id});
        },
        'new-ai-ble-cancel-scan': event => {
            if (!newAiBleScanning) return;
            newAiBleScanning = false;
            newAiRequests.push({action: 'ble-cancel'});
            event.sender.send('new-ai-ble-scan-state', {scanning: false, cancelled: true, devices: []});
        },
        'new-ai-ble-forget': event => {
            newAiRequests.push({action: 'ble-forget'}); newAiState = {...newAiState, bleDevice: null};
            event.sender.send('new-ai-state-change', newAiState);
        },
        'new-ai-connect': async (event, request) => {
            assert.equal(selectedHardware, 'new-ai');
            newAiRequests.push({action: 'connect', ...request});
            newAiState = {...newAiState, state: 'verifying', busy: true};
            event.sender.send('new-ai-state-change', newAiState);
            await new Promise(resolve => setTimeout(resolve, 120));
            newAiState = {...newAiState, state: 'connected', busy: false, connected: true,
                port: request.path || request.id, status: newAiStatus, identityVerified: true,
                ...(request.type === 'ble' ? {bleDevice: {id: '11:22:33:44:55:66',
                    name: 'EST_BLUE NEW AI (mock)'}} : {}),
                downloadSupported: true, programSupported: true};
            event.sender.send('new-ai-state-change', newAiState);
            return newAiState;
        },
        'new-ai-disconnect': event => {
            newAiRequests.push({action: 'disconnect'});
            newAiState = {...newAiState, state: 'disconnected', connected: false, port: null, status: null,
                downloadSupported: false, programSupported: false,
                discovery: {...newAiState.discovery, enabled: false}};
            event.sender.send('new-ai-state-change', newAiState);
        },
        'new-ai-set-auto-connect': (event, enabled) => {
            newAiRequests.push({action: 'automatic', enabled});
            newAiState = {...newAiState, discovery: {...newAiState.discovery, enabled}};
            event.sender.send('new-ai-state-change', newAiState);
        },
        'new-ai-compile-program': (event, request) => mockNewAiCompile(event, request),
        'new-ai-download-program': (event, request) => mockNewAiCompile(event, request, true),
        'new-ai-run-program': (event, request) => mockNewAiCompile(event, request, true, true),
        'new-ai-stop-program': async event => {
            assert.equal(selectedHardware, 'new-ai');
            newAiRequests.push({action: 'stop'});
            newAiState = {...newAiState, busy: true, result: null,
                operation: {phase: 'stopping', bytes: 0, total: 0}};
            event.sender.send('new-ai-state-change', newAiState);
            await new Promise(resolve => setTimeout(resolve, 120));
            const result = {stopObserved: true};
            newAiState = {...newAiState, busy: false, operation: null, result,
                status: {...newAiStatus, running: false}};
            event.sender.send('new-ai-state-change', newAiState);
            return result;
        },
        'new-ai-firmware-inspect': () => ({...newAiFirmwareRelease, releaseId: newAiFirmwareRelease.id,
            valid: true, files: newAiFirmwareRelease.files.map(file => ({...file, valid: true, error: null}))}),
        'new-ai-firmware-update': async (event, request) => {
            assert.equal(selectedHardware, 'new-ai');
            assert.equal(request.confirmedErase, true);
            if (newAiState.status && newAiState.status.legacyProtocol) assert.equal(request.confirmedLegacyIdle, true);
            newAiRequests.push({action: 'firmware', ...request});
            newAiState = {...newAiState, busy: true, result: null, downloadSupported: false, programSupported: false,
                firmware: {active: true, phase: 'checking', bytes: 0, total: 2116990}};
            event.sender.send('new-ai-state-change', newAiState);
            await new Promise(resolve => setTimeout(resolve, 80));
            newAiState = {...newAiState, connected: false, port: null, status: null,
                firmware: {active: true, phase: 'transferring', bytes: 100000, total: 2116990, file: 'app/pikaNewAi.bin'}};
            event.sender.send('new-ai-state-change', newAiState);
            await new Promise(resolve => setTimeout(resolve, 300));
            const result = {transferComplete: true, reconnected: true, versionMatched: true, version: 321};
            newAiState = {...newAiState, busy: false, connected: true, port: 'COM_NEW', status: newAiStatus,
                downloadSupported: true, programSupported: true,
                firmware: {active: false, phase: 'complete', bytes: 2116990, total: 2116990, result}};
            event.sender.send('new-ai-state-change', newAiState);
            return result;
        },
        'spark-firmware-inspect': () => {
            firmwareChecks++;
            return {...firmwareRelease, releaseId: firmwareRelease.id, valid: true, canUpdate: true,
                files: firmwareRelease.files.map(file => ({...file, valid: true, error: null}))};
        },
        'spark-firmware-update': async (event, request) => {
            if (!request.confirmedErase) throw new Error('SPARK_FW_ERASE_CONFIRM');
            sparkRequests.push({action: 'firmware', ...request});
            sparkState = {...sparkState, busy: true,
                firmware: {active: true, phase: 'transferring', bytes: 100000, total: 202906, file: 'app/app.bin'}};
            sendSpark(event);
            await new Promise(resolve => setTimeout(resolve, 350));
            const result = {transferComplete: true, reconnected: true, versionMatched: true, version: 110};
            sparkState = {...sparkState, busy: false, connected: true, compatible: true, status: sparkStatus,
                firmware: {active: false, phase: 'complete', bytes: 202906, total: 202906, result}};
            sendSpark(event); return result;
        },
        'spark-list-devices': () => sparkPorts,
        'spark-ble-cancel-scan': () => {},
        'spark-ble-forget': event => {
            sparkState = {...sparkState, bleDevice: null}; sendSpark(event); return sparkState;
        },
        'spark-connection-mode': (event, connectionMode) => {
            sparkState = {...sparkState, connectionMode, connected: false, compatible: false, status: null};
            sendSpark(event);
        },
        'spark-set-auto-connect': (event, enabled) => {
            sparkState = {...sparkState, discovery: {...sparkState.discovery, enabled,
                status: sparkState.connected ? 'connected' : (enabled ? 'waiting' : 'paused'),
                revision: sparkState.discovery.revision + 1}};
            sendSpark(event); return sparkState;
        },
        'spark-connect': (event, request) => {
            sparkRequests.push({action: 'connect', ...request});
            sparkState = {...sparkState, connected: true, compatible: true, status: sparkStatus,
                port: request.path,
                discovery: {...sparkState.discovery, status: 'connected', revision: sparkState.discovery.revision + 1},
                state: 'ready', logs: [{id: 1, time: Date.now(), text: 'mock serial output'}]};
            sendSpark(event); return sparkState;
        },
        'spark-disconnect': event => {
            sparkState = {...sparkState, connected: false, status: null, state: 'disconnected',
                discovery: {...sparkState.discovery, enabled: false, status: 'paused',
                    revision: sparkState.discovery.revision + 1}};
            sendSpark(event); return sparkState;
        },
        'spark-download-program': (event, request) => mockSparkProgram(event, request, 'download'),
        'spark-run-program': (event, request) => mockSparkProgram(event, request, 'run'),
        'spark-stop-program': event => mockSparkProgram(event, {}, 'stop'),
        'spark-set-monitoring': (event, enabled) => {
            sparkState = {...sparkState, monitoring: enabled}; sendSpark(event); return sparkState;
        },
        'spark-cancel': event => {
            sparkRequests.push({action: 'cancel'});
            sparkState = {...sparkState, busy: false, operation: null}; sendSpark(event);
        },
        'spark-clear-logs': event => { sparkState = {...sparkState, logs: []}; sendSpark(event); },
        'est-auto-connect': () => (hardwareMockEnabled ?
            {state: 'connected', compatible: true, status: {programStatus: {state: 0}}} : {state: 'not-found'}),
        'est-vision-window-open': (event, locale) => { cameraOpenRequests++; openedCameraLocale = locale; },
        'est-vision-window-locale': (event, locale) => { cameraLocale = locale; },
        'est-hardware-status': async () => {
            hardwareRequests++;
            hardwareActive++;
            hardwareMaxActive = Math.max(hardwareMaxActive, hardwareActive);
            await new Promise(resolve => setTimeout(resolve, 200));
            hardwareActive--;
            return {state: 'connected', status: {firmwareVersion: 'M1.28H', protocolMajor: 1, protocolMinor: 31,
                batteryPercent: 85, batterySampleMv: 2000, batteryAdcRaw: 3200,
                motors: [{outputState: 0, powerPercent: 0, tachoCount: hardwareRequests}], sensors: [],
                programStatus: {state: 0}}};
        },
        'est-ai-status': () => ({ok: true, data: {configured: false, hasKey: false, config: {}}})
    })) ipcMain.handle(name, handler);
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    const timeout = setTimeout(() => app.exit(1), 180000);
    app.whenReady().then(async () => {
        const comparisonIndex = process.argv.indexOf('--perf-renderer');
        const comparisonDirectory = comparisonIndex < 0 ? null : path.resolve(process.argv[comparisonIndex + 1]);
        const rendererRootIndex = process.argv.indexOf('--renderer-root');
        const rendererRoot = rendererRootIndex < 0 ? path.resolve(__dirname, '../dist/renderer') :
            path.resolve(process.argv[rendererRootIndex + 1]);
        const window = new BrowserWindow({
            show: false,
            width: 1280,
            height: 860,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                backgroundThrottling: false,
                offscreen: !comparisonDirectory
            }
        });
        const setNewAiTestState = patch => {
            newAiState = {...newAiState, ...patch};
            window.webContents.send('new-ai-state-change', newAiState);
        };
        remote.enable(window.webContents);
        const unhandledRejections = [];
        window.webContents.on('console-message', (event, level, message, line, source) => {
            if (level >= 3) console.error(`Renderer: ${message} (${source}:${line})`);
            if (message.startsWith('Unhandled rejection stack:')) unhandledRejections.push(message);
        });
        window.webContents.on('dom-ready', () => {
            window.webContents.executeJavaScript(`window.addEventListener('unhandledrejection', event => {
                console.error('Unhandled rejection stack: ' + (event.reason && event.reason.stack || event.reason));
            });`).catch(error => console.error(error));
        });
        const evaluate = async source => {
            const result = await window.webContents.executeJavaScript(`(async () => {
                try { return {value: await eval(${JSON.stringify(source)})}; }
                catch (error) { return {error: error.stack}; }
            })()`);
            if (result.error) throw new Error(result.error);
            return result.value;
        };
        try {
            if (comparisonDirectory) {
                // Only the test host is used: no product main process, serial ports, HID or AI transport.
                window.webContents.session.webRequest.onBeforeRequest((details, callback) =>
                    callback({cancel: /^https?:|^wss?:/.test(details.url)}));
                await window.loadFile(path.join(comparisonDirectory, 'index.html'));
                window.setTitle(`${path.basename(comparisonDirectory)} · OpenBlock 性能对照 · 自动测试`);
                window.show(); window.focus();
                await require('./perf-ui-comparison/measure')({window, evaluate, pause,
                    output: comparisonDirectory, label: path.basename(comparisonDirectory)});
                clearTimeout(timeout); app.exit(0); return;
            }
            await window.loadFile(path.join(rendererRoot, 'index.html'));
            let ready = false;
            for (let i = 0; i < 150 && !ready; i++) {
                ready = await evaluate(`(() => {
                    window.findLocaleTestBlocks = () => {
                    for (const element of document.querySelectorAll('div')) {
                        let fiber = element[Object.keys(element).find(key => key.startsWith('__reactInternalInstance'))];
                        for (; fiber; fiber = fiber.return) {
                            const instance = fiber.stateNode;
                            if (instance && instance.ScratchBlocks && instance.workspace &&
                                typeof instance.setLocale === 'function' && instance.workspace.getFlyout()) {
                                window.localeTestBlocks = instance;
                                return instance;
                            }
                        }
                    }
                    return null;
                    };
                    return Boolean(window.findLocaleTestBlocks());
                })()`);
                await pause(100);
            }
            assert.ok(ready, 'editor must mount');
            await pause(1000);
            assert.equal(await evaluate('window.findLocaleTestBlocks().props.locale'), 'zh-cn',
                'a fresh installation must start in Simplified Chinese');
            assert.equal(await evaluate('document.documentElement.lang'), 'zh-cn');
            assert.equal(await evaluate("localStorage.getItem('est-studio-locale')"), 'zh-cn');
            console.log('Fresh-profile startup: Simplified Chinese selected and saved without manual language switching.');
            const loadedExtensions = () => evaluate('window.findLocaleTestBlocks().props.vm.runtime.getLoadedDeviceExtension()');
            assert.deepStrictEqual(await loadedExtensions(), [], 'new projects must not load vision');
            assert.strictEqual(await evaluate(`window.findLocaleTestBlocks().workspace.getFlyout().getWorkspace()
                .getAllBlocks().filter(b => /^(vision_|event_vision_)/.test(b.type)).length`), 0);
            await evaluate(`(async () => { window.blankVisionProject = await window.findLocaleTestBlocks().props.vm.saveProjectSb3(); })()`);
            const selectVision = async () => {
                await evaluate(`document.querySelector('button[class*="extension-button"]').click()`);
                await pause(400);
                assert.ok(await evaluate('Boolean(document.querySelector("[class*=library-item-extension]"))'),
                    'native extension library must contain the vision card');
                const icon = await evaluate(`(() => {
                    const img = document.querySelector('[class*="library-item-extension"] img');
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
                    const context = canvas.getContext('2d');
                    context.drawImage(img, 0, 0);
                    const rect = img.getBoundingClientRect();
                    return {source: img.src, loaded: img.complete && img.naturalWidth > 0,
                        width: rect.width, height: rect.height,
                        cornerAlpha: context.getImageData(0, 0, 1, 1).data[3],
                        centerAlpha: context.getImageData(canvas.width >> 1, canvas.height >> 1, 1, 1).data[3]};
                })()`);
                assert.ok(icon.loaded && icon.source.endsWith('.png'), 'generated PNG must render');
                assert.strictEqual(icon.cornerAlpha, 0, 'background must have real alpha transparency');
                assert.ok(icon.centerAlpha > 200, 'camera icon must be visible');
                assert.strictEqual(icon.width, 136);
                assert.strictEqual(icon.height, 136);
                window.webContents.invalidate();
                await pause(150);
                fs.writeFileSync(path.join(output, 'vision-extension-library.png'),
                    (await window.webContents.capturePage()).toPNG());
                await evaluate(`document.querySelector('[class*="library-item-extension"]').click()`);
                await pause(600);
                assert.strictEqual(await evaluate('Boolean(document.querySelector("[class*=library-item-extension]"))'),
                    false, 'native library must close after selection');
                assert.deepStrictEqual(await loadedExtensions(), ['vision']);
                assert.strictEqual(await evaluate(`window.findLocaleTestBlocks().workspace.toolbox_.getSelectedCategoryId()`),
                    'vision', 'native category-selection callback must select vision');
                assert.strictEqual(await evaluate(`window.findLocaleTestBlocks().workspace.getFlyout().getWorkspace()
                    .getAllBlocks().filter(b => /^(vision_|event_vision_)/.test(b.type)).length`), 12);
                assert.strictEqual(await evaluate(`window.findLocaleTestBlocks().workspace.getFlyout().getWorkspace()
                    .getAllBlocks().some(b => b.type.startsWith('event_vision_'))`), false);
            };
            await selectVision();
            await selectVision();
            await evaluate(`(async () => { const vm = window.findLocaleTestBlocks().props.vm;
                const saved = await vm.saveProjectSb3();
                await vm.loadProject(await saved.arrayBuffer()); })()`);
            await pause(700);
            assert.deepStrictEqual(await loadedExtensions(), ['vision'], 'unused selected extension must survive save/reopen');
            assert.ok(await evaluate(`Boolean(document.getElementById('est-vision-open'))`),
                'fresh editor must expose camera entry without first visiting home');
            for (const [width, height] of [[1000, 720], [1280, 860], [1620, 940]]) {
                window.setSize(width, height);
                await pause(350);
                const menu = await evaluate(`(() => {
                    const camera = document.getElementById('est-vision-open');
                    const ai = document.querySelector('.est-menu-bar-ai-button');
                    const code = camera.nextElementSibling;
                    const a = ai.getBoundingClientRect(), c = camera.getBoundingClientRect();
                    const d = code.getBoundingClientRect();
                    return {count: document.querySelectorAll('#est-vision-open').length,
                        inMenu: Boolean(camera.closest('[class*="menu-bar_tail-menu_"]')),
                        dock: Boolean(document.querySelector('[class*="visionDock"]')),
                        icon: camera.querySelector('img').naturalWidth > 0,
                        label: camera.getAttribute('aria-label'), text: camera.textContent.trim(),
                        sameStyle: camera.className === code.className,
                        fits: a.right <= c.left && c.right <= d.left && d.right <= innerWidth,
                        aligned: c.top === d.top && c.height === d.height && c.width === d.width,
                        x: c.x + c.width / 2, y: c.y + c.height / 2};
                })()`);
                assert.strictEqual(menu.count, 1);
                assert.ok(menu.inMenu && !menu.dock && menu.icon && menu.label && menu.sameStyle,
                    JSON.stringify(menu));
                assert.ok(menu.fits && menu.aligned, 'menu geometry at ' + width + ': ' + JSON.stringify(menu));
                assert.strictEqual(menu.text, '');
                window.webContents.sendInputEvent({type: 'mouseMove', x: Math.round(menu.x), y: Math.round(menu.y)});
                await pause(100);
                assert.notStrictEqual(await evaluate(`getComputedStyle(document.getElementById('est-vision-open')).backgroundColor`),
                    'rgba(0, 0, 0, 0)', 'camera hover highlight');
                fs.writeFileSync(path.join(output, 'camera-menu-' + width + '.png'),
                    (await window.webContents.capturePage()).toPNG());
                window.webContents.sendInputEvent({type: 'mouseMove', x: 400, y: 300});
            }
            window.setSize(1280, 860);
            await evaluate(`document.getElementById('est-vision-open').nextElementSibling.click()`);
            await pause(200);
            assert.strictEqual(await evaluate(`document.getElementById('est-vision-open').nextElementSibling
                .getAttribute('aria-expanded')`), 'true', 'adjacent code button still opens drawer');
            await evaluate(`document.getElementById('est-vision-open').nextElementSibling.click()`);
            await evaluate(`window.cameraRequests = 0;
                navigator.mediaDevices.getUserMedia = () => {
                    window.cameraRequests++;
                    return Promise.reject(new Error('Main editor must never start the camera'));
                };
                document.getElementById('est-vision-open').click()`);
            await pause(100);
            assert.strictEqual(cameraOpenRequests, 1, 'camera entry requests an independent window');
            assert.strictEqual(await evaluate(`Boolean(document.querySelector('section[aria-label^="MediaPipe"]'))`),
                false, 'main renderer must not mount camera models or a camera overlay');
            await evaluate(`(() => {
                const {ScratchBlocks: B, workspace: ws} = window.findLocaleTestBlocks();
                const xml = B.Xml.textToDom('<xml><block type="operator_random" id="locale-native" x="350" y="180">' +
                    '<value name="FROM"><shadow type="math_number"><field name="NUM">7</field></shadow></value>' +
                    '<value name="TO"><shadow type="math_number"><field name="NUM">29</field></shadow></value>' +
                    '</block><block type="vision_gesture" id="locale-est" x="350" y="260">' +
                    '<field name="SIDE">left</field><field name="GESTURE">3</field></block>' +
                    '<block type="vision_wait_state" id="locale-vision-state" x="350" y="340">' +
                    '<field name="STATE">valid</field><next>' +
                    '<block type="vision_wait_gesture"><field name="SIDE">left</field>' +
                    '<field name="GESTURE">1</field></block></next></block></xml>');
                B.Xml.domToWorkspace(xml, ws);
                const visualXml = '<xml>' + ['face', 'pose'].map((kind, index) =>
                    '<block type="vision_wait_' + kind + '" id="locale-' + kind + '" x="650" y="' + (180 + index * 100) + '">' +
                    '<field name="ACTION">' + (kind === 'face' ? 'smile' : 'bothUp') + '</field>' +
                    '<next><block type="vision_wait_' + kind + '"><field name="ACTION">' +
                    (kind === 'face' ? 'mouth' : 'standing') + '</field></block></next></block>').join('') + '</xml>';
                B.Xml.domToWorkspace(B.Xml.textToDom(visualXml), ws);
            })()`);
            await pause(250);
            const snapshot = `(() => {
                const {ScratchBlocks: B, workspace: ws} = window.findLocaleTestBlocks();
                return B.Xml.domToText(B.Xml.workspaceToDom(ws));
            })()`;
            const original = await evaluate(snapshot);
            for (const locale of ['zh-cn', 'pt-br', 'en', 'zh-cn', 'pt-br']) {
                await evaluate(`window.estCurrentLocale = ${JSON.stringify(locale)};
                    document.documentElement.lang = ${JSON.stringify(locale)};
                    window.dispatchEvent(new CustomEvent('est-locale-changed',
                        {detail: {locale: ${JSON.stringify(locale)}}}));
                    window.dispatchEvent(new CustomEvent('est-home-set-locale',
                    {detail: {locale: ${JSON.stringify(locale)}}}));`);
                await pause(900);
                const result = await evaluate(`(() => {
                    const b = window.findLocaleTestBlocks();
                    const flyout = b.workspace.getFlyout().getWorkspace();
                    const text = (ws, id) => ws.getBlockById(id).toString();
                    return {locale: b.props.locale,
                        visible: b.props.isVisible,
                        randomMessage: b.ScratchBlocks.Msg.OPERATORS_RANDOM,
                        native: text(b.workspace, 'locale-native'),
                        est: text(b.workspace, 'locale-est'),
                        face: text(b.workspace, 'locale-face'),
                        pose: text(b.workspace, 'locale-pose'),
                        flyoutFace: flyout.getAllBlocks().find(b => b.type === 'vision_face_action').toString(),
                        flyoutPose: flyout.getAllBlocks().find(b => b.type === 'vision_pose_action').toString(),
                        flyoutNative: flyout.getAllBlocks().find(b => b.type === 'operator_random').toString(),
                        flyoutEst: flyout.getAllBlocks().find(b => b.type === 'vision_gesture').toString(),
                        visionWaits: ['vision_wait_state', 'vision_wait_gesture']
                            .map(type => flyout.getAllBlocks().find(b => b.type === type).toString()),
                        categories: Array.from(document.querySelectorAll('.scratchCategoryMenuItemLabel')).map(el => el.textContent)};
                })()`);
                assert.strictEqual(result.locale, locale);
                assert.strictEqual(cameraLocale, locale, 'main editor must propagate locale to camera window');
                await evaluate(`document.getElementById('est-vision-open').click()`);
                await pause(50);
                assert.strictEqual(openedCameraLocale, locale, 'camera opens in the current editor language');
                assert.ok(result.face.includes(locale === 'zh-cn' ? '微笑' : locale === 'pt-br' ? 'sorriso' : 'smile'));
                assert.ok(result.pose.includes(locale === 'zh-cn' ? '举起双手' : locale === 'pt-br' ? 'duas mãos' : 'both hands'));
                assert.ok(result.flyoutFace.includes(locale === 'zh-cn' ? '人脸' : locale === 'pt-br' ? 'facial' : 'face'));
                assert.ok(result.flyoutPose.includes(locale === 'zh-cn' ? '人体' : locale === 'pt-br' ? 'postura' : 'pose'));
                assert.strictEqual(result.visionWaits.length, 2);
                assert.ok(result.visionWaits.every(text => text.includes(locale === 'zh-cn' ? '视觉' :
                    locale === 'pt-br' ? 'vis' : 'vision')), JSON.stringify(result.visionWaits));
                assert.strictEqual(await evaluate("document.getElementById('est-vision-open').getAttribute('aria-label')"),
                    locale === 'zh-cn' ? '查看摄像头' : locale === 'pt-br' ? 'Ver câmera' : 'View camera');
                const expected = require('openblock-l10n/editor/blocks/' + locale + '.json');
                assert.strictEqual(result.randomMessage, expected.OPERATORS_RANDOM);
                for (const key of ['CATEGORY_OPERATORS', 'CATEGORY_VARIABLES', 'CATEGORY_MYBLOCKS']) {
                    assert.ok(result.categories.includes(expected[key]), 'category must follow locale: ' + key);
                }
                const nativeWord = locale === 'zh-cn' ? '随机' : locale === 'pt-br' ? 'aleatório' : 'random';
                const estWord = locale === 'zh-cn' ? '点赞' : locale === 'pt-br' ? 'polegar' : 'thumb';
                for (const key of ['native', 'flyoutNative']) assert.ok(result[key].includes(nativeWord), JSON.stringify(result));
                assert.ok(result.est.includes(estWord), JSON.stringify(result));
                assert.ok(result.flyoutEst.includes(locale === 'zh-cn' ? '手掌' :
                    locale === 'pt-br' ? 'palma' : 'palm'), JSON.stringify(result));
                assert.strictEqual(await evaluate(snapshot), original, 'language switching must preserve project XML');
                console.log(JSON.stringify(result));
            }
            await window.setSize(1000, 720);
            await pause(200);
            const screenshot = path.join(output, 'locale-portuguese.png');
            fs.writeFileSync(screenshot, (await window.webContents.capturePage()).toPNG());
            console.log('Locale UI regression passed. Screenshot: ' + screenshot);
            await evaluate(`(async () => { const vm = window.findLocaleTestBlocks().props.vm;
                window.visionProject = await vm.saveProjectSb3();
                await vm.loadProject(await window.blankVisionProject.arrayBuffer()); })()`);
            await pause(700);
            assert.deepStrictEqual(await loadedExtensions(), [], 'fresh project must not inherit vision');
            await evaluate(`(async () => { await window.findLocaleTestBlocks().props.vm.loadProject(await window.visionProject.arrayBuffer()); })()`);
            await pause(700);
            assert.deepStrictEqual(await loadedExtensions(), ['vision']);
            assert.ok(await evaluate(`Boolean(window.findLocaleTestBlocks().workspace.getBlockById('locale-est'))`));
            await evaluate(`(async () => { const vm = window.findLocaleTestBlocks().props.vm;
                const legacy = JSON.parse(vm.toJSON());
                delete legacy.deviceExtensions;
                await vm.loadProject(JSON.stringify(legacy)); })()`);
            await pause(700);
            assert.deepStrictEqual(await loadedExtensions(), ['vision'], 'older vision blocks restore their category');
            assert.strictEqual(await evaluate('window.cameraRequests'), 0, 'adding/reopening vision never starts camera');
            const beforeRejectedProject = await evaluate(snapshot);
            const rejected = await evaluate(`(async () => {
                const vm = window.findLocaleTestBlocks().props.vm;
                const oldProject = JSON.parse(vm.toJSON());
                oldProject.targets[0].blocks.retiredHat = {opcode: 'event_vision_face', next: null,
                    parent: null, inputs: {}, fields: {ACTION: ['smile', null]}, shadow: false,
                    topLevel: true, x: 50, y: 50};
                try { await vm.loadProject(JSON.stringify(oldProject)); return ''; }
                catch (error) { return error.message; }
            })()`);
            assert.ok(rejected.includes('removidos'), 'old vision hats must be explicitly rejected');
            assert.strictEqual(await evaluate(snapshot), beforeRejectedProject, 'rejection must preserve current workspace');
            console.log('Native vision extension selection, duplicate selection, save/reopen and legacy project tests passed.');
            hardwareMockEnabled = true;
            await evaluate(`(() => {
                for (const element of document.querySelectorAll('button')) {
                    let fiber = element[Object.keys(element).find(key => key.startsWith('__reactInternalInstance'))];
                    for (; fiber; fiber = fiber.return) {
                        const c = fiber.stateNode;
                        if (c && c.refreshStatus && c.renderPortsOverview) { window.hardwarePanel = c; break; }
                    }
                }
                if (!window.hardwarePanel) throw new Error('Hardware panel not found');
                // Offscreen test windows are hidden by design, unlike the visible app.
                Object.defineProperty(document, 'hidden', {configurable: true, value: false});
                window.hardwareTicks = 0;
                window.hardwareTimer = setInterval(() => {
                    hardwareTicks++;
                    const block = window.findLocaleTestBlocks().workspace.getBlockById('locale-est');
                    if (block) block.moveBy(hardwareTicks % 2 ? 1 : -1, 0);
                }, 20);
                hardwarePanel.handleToggle();
            })()`);
            await pause(2400);
            assert.ok(hardwareRequests >= 4, 'idle port values must refresh at the faster cadence');
            assert.equal(hardwareMaxActive, 1, 'no overlapping status requests');
            assert.ok(await evaluate('hardwareTicks >= 20'), 'editor must remain responsive during polling');
            assert.ok(await evaluate('hardwarePanel.state.status.motors[0].tachoCount >= 2'));
            await evaluate('hardwarePanel.handleClose(); clearInterval(hardwareTimer)');
            await pause(300);
            const closedCount = hardwareRequests;
            await pause(950);
            assert.equal(hardwareRequests, closedCount, 'closing panel must stop polling');
            console.log('Hardware panel auto-refresh and editor responsiveness regression passed.');
            const hardwareButton = '#est-hardware-select';
            const chooseHardware = async id => {
                await evaluate(`document.querySelector('${hardwareButton}').click()`);
                await pause(80);
                assert.equal(await evaluate('document.querySelectorAll("input[name=hardware-choice]").length'), 3);
                await evaluate(`document.querySelector('input[name="hardware-choice"][value="${id}"]').click();
                    document.querySelector('[role="dialog"] footer button:last-child').click()`);
                for (let i = 0; i < 80; i++) {
                    if (!await evaluate('Boolean(document.querySelector("input[name=hardware-choice]"))')) break;
                    await pause(100);
                }
                assert.ok(!await evaluate('Boolean(document.querySelector("input[name=hardware-choice]"))'),
                    'hardware switch must finish without an error dialog');
                await pause(450);
                assert.equal(selectedHardware, id);
                assert.equal(await evaluate('JSON.parse(window.findLocaleTestBlocks().props.vm.toJSON()).meta.estStudio.hardwareId'), id);
            };
            if (process.argv.includes('--new-colour-only')) {
                await require('./check-new-ai-colour-ui')({evaluate, pause, window, output, chooseHardware});
                assert.deepStrictEqual(unhandledRejections, []);
                clearTimeout(timeout);
                app.exit(0);
                return;
            }
            if (process.argv.includes('--new-ai-only')) {
                await require('./check-new-ai-ui')({evaluate, pause, window, output, chooseHardware, newAiRequests,
                    setNewAiTestState});
                assert.deepStrictEqual(unhandledRejections, []);
                clearTimeout(timeout);
                app.exit(0);
                return;
            }
            await evaluate('window.beforeHardwareSwitch = window.findLocaleTestBlocks().props.vm.toJSON()');
            await chooseHardware('spark-ai');
            const pendingCategories = await evaluate(`Array.from(document.querySelectorAll('.scratchCategoryMenuItemLabel'))
                .map(element => element.textContent.trim())`);
            assert.ok(pendingCategories.includes('Motor'));
            assert.equal(pendingCategories.length, 10, 'Spark has eight fixed and two native dynamic categories');
            assert.ok(!await evaluate('Boolean(document.querySelector("#est-vision-open"))'));
            assert.ok(!/est_runtime|rt\./.test(await evaluate('window.findLocaleTestBlocks().workspaceToCode()')));
            assert.ok(!await evaluate('document.querySelector(".est-menu-bar-ai-button").hidden'));
            const assistant = await evaluate(`(async () => {
                document.querySelector('.est-menu-bar-ai-button').click();
                let panel;
                for (const element of document.querySelectorAll('div')) {
                    let fiber = element[Object.keys(element).find(key => key.startsWith('__reactInternalInstance'))];
                    for (; fiber; fiber = fiber.return) {
                        if (fiber.stateNode && typeof fiber.stateNode.handleLocalPreview === 'function') {
                            panel = fiber.stateNode; break;
                        }
                    }
                    if (panel) break;
                }
                if (!panel) throw new Error('Spark assistant did not mount');
                const before = findLocaleTestBlocks().props.vm.toJSON();
                await panel.handleLocalPreview();
                const message = panel.state.messages[0];
                const result = {hardwareId: panel.hardwareId, irHardware: message && message.ir.hardwareId,
                    previews: message && message.previews.length, error: panel.state.debugError,
                    unchanged: before === findLocaleTestBlocks().props.vm.toJSON()};
                panel.handleClose();
                return result;
            })()`);
            assert.deepStrictEqual(assistant, {hardwareId: 'spark-ai', irHardware: 'spark-ai',
                previews: 1, error: '', unchanged: true});
            const sparkCatalog = require('../src/renderer/spark-ai/catalog.json');
            const sparkUi = await evaluate(`(() => {
                const editor = window.findLocaleTestBlocks(), B = editor.ScratchBlocks;
                const rows = ${JSON.stringify(sparkCatalog.blocks)};
                const xml = document.createElement('xml');
                for (const row of rows) {
                    const block = document.createElement('block'); block.setAttribute('type', 'spark_' + row.id);
                    for (const [name, value] of Object.entries(row.fields || {})) {
                        const field = document.createElement('field'); field.setAttribute('name', name);
                        field.textContent = value; block.appendChild(field);
                    }
                    for (const input of row.inputs) {
                        const value = document.createElement('value'); value.setAttribute('name', input.name);
                        const shadow = document.createElement('shadow'); shadow.setAttribute('type', 'spark_' + input.type);
                        for (const [name, value] of Object.entries(input.fields || {})) {
                            const field = document.createElement('field'); field.setAttribute('name', name);
                            field.textContent = value; shadow.appendChild(field);
                        }
                        value.appendChild(shadow); block.appendChild(value);
                    }
                    xml.appendChild(block);
                }
                const test = new B.Workspace();
                window.sparkUiFixtureXml = xml;
                try {
                    B.Xml.domToWorkspace(xml, test);
                    B.SparkPython.init(test);
                    const errors = [];
                    for (const row of rows) {
                        const block = test.getAllBlocks().find(b => b.type === 'spark_' + row.id);
                        try { B.SparkPython[block.type](block); } catch (error) { errors.push(row.id + ': ' + error.message); }
                    }
                    editor.workspace.toolbox_.scrollToCategoryById('spark_matrix');
                    return {fixed: test.getTopBlocks().length, errors,
                        ports: test.getAllBlocks().find(b => b.type === 'spark_motor_box').getFieldValue('MOTOR')};
                } finally { test.dispose(); }
            })()`);
            assert.equal(sparkUi.fixed, 66);
            assert.deepStrictEqual(sparkUi.errors, []);
            assert.equal(sparkUi.ports, 'E');
            await pause(200);
            const shadowContrast = await evaluate(`(() => {
                const blocks = window.findLocaleTestBlocks().workspace.getFlyout().getWorkspace().getAllBlocks();
                return blocks.filter(b => ['spark_matrix_x', 'spark_matrix_y', 'spark_piano'].includes(b.type))
                    .map(block => ({type: block.type, colour: block.getColour(), text: block.toString()}));
            })()`);
            assert.equal(shadowContrast.length, 3);
            assert.ok(shadowContrast.every(block => block.colour.toLowerCase() !== '#ffffff'));
            const matrixUi = await evaluate(`(() => {
                const editor = window.findLocaleTestBlocks();
                const matrix = editor.workspace.getFlyout().getWorkspace().getAllBlocks()
                    .find(b => b.type === 'spark_matrix_lamp').getField('lamp');
                matrix.showEditor_();
                const nodes = matrix.ledButtons_;
                const lastRect = nodes[34].getBoundingClientRect();
                matrix.onMouseDown({clientX: lastRect.x + lastRect.width / 2,
                    clientY: lastRect.y + lastRect.height / 2, button: 0,
                    preventDefault() {}, stopPropagation() {}});
                matrix.onMouseUp();
                const code = editor.ScratchBlocks.SparkPython.spark_matrix_lamp(matrix.sourceBlock_);
                const value = matrix.getValue();
                return {nodes: nodes.length, width: matrix.width_, height: matrix.height_, value, code};
            })()`);
            assert.equal(matrixUi.nodes, 35);
            assert.equal(matrixUi.width, 5); assert.equal(matrixUi.height, 7);
            assert.ok(matrixUi.code.endsWith('0x0F)\n'),
                'bottom-right cell must be bit 4 of row 6: ' + JSON.stringify(matrixUi));
            window.webContents.invalidate(); await pause(100);
            fs.writeFileSync(path.join(output, 'spark-matrix-editor.png'),
                (await window.webContents.capturePage()).toPNG());
            await evaluate('window.findLocaleTestBlocks().ScratchBlocks.DropDownDiv.hideWithoutAnimation()');
            console.log('Spark UI: 66 real block instances and native 5-column, 7-row matrix editor passed.');
            const portColours = await evaluate(`(() => {
                const editor = window.findLocaleTestBlocks(), B = editor.ScratchBlocks;
                const xml = document.createElement('xml');
                const types = ['motor_specifiedunit', 'combined_motor_starting',
                    'sensing_key_judgment', 'sensing_ultrasonic_judgment', 'sensing_isHandling'];
                types.forEach((type, index) => {
                    const source = Array.from(sparkUiFixtureXml.children).find(node =>
                        node.getAttribute('type') === 'spark_' + type).cloneNode(true);
                    source.setAttribute('x', '60'); source.setAttribute('y', String(60 + index * 90));
                    xml.appendChild(source);
                });
                window.sparkPortColourSnapshot = B.Xml.workspaceToDom(editor.workspace);
                editor.workspace.clear(); B.Xml.domToWorkspace(xml, editor.workspace);
                const references = ['est_motor_port_picker', 'est_drive_port_picker',
                    'est_sensor_port_picker', 'est_sensor_port_picker', 'est_sensor_port_picker'];
                const test = new B.Workspace();
                const palette = block => [block.getColour(), block.getColourSecondary(),
                    block.getColourTertiary()].map(value => value.toLowerCase());
                try {
                    return types.map((type, index) => {
                        const parent = editor.workspace.getAllBlocks().find(b => b.type === 'spark_' + type);
                        const port = parent.getInputTargetBlock('PORT');
                        const reference = test.newBlock(references[index]);
                        return {type, actual: palette(port), expected: palette(reference),
                            fill: port.svgPath_.getAttribute('fill').toLowerCase(),
                            stroke: port.svgPath_.getAttribute('stroke').toLowerCase(),
                            value: port.getFieldValue('MOTOR') || port.getFieldValue('TOUCHING_MENU') ||
                                port.getFieldValue('SENSING_MENU') || port.getFieldValue('HAND_SHANK'),
                            options: type === 'sensing_isHandling' ?
                                port.getField('HAND_SHANK').getOptions().map(option => option[1]) : null};
                    });
                } finally { test.dispose(); }
            })()`);
            for (const port of portColours) {
                assert.deepStrictEqual(port.actual, port.expected, port.type + ': EST port palette');
                assert.equal(port.fill, port.expected[0], port.type + ': rendered fill');
                assert.equal(port.stroke, port.expected[2], port.type + ': rendered outline');
            }
            const gamepadPicker = portColours.find(port => port.type === 'sensing_isHandling');
            assert.equal(gamepadPicker.value, 'up');
            assert.deepStrictEqual(gamepadPicker.options, ['up', 'down', 'left', 'right', 'Y', 'A', 'B', 'X', 'L1', 'R1']);
            window.webContents.invalidate(); await pause(100);
            fs.writeFileSync(path.join(output, 'spark-port-colours.png'),
                (await window.webContents.capturePage()).toPNG());
            console.log('Spark picker UI: motor, paired motor, touch, sensor and gamepad fills/outlines match EST; all gamepad options preserved.');
            await evaluate(`(() => {
                const editor = window.findLocaleTestBlocks();
                window.gamepadUiField = editor.workspace.getAllBlocks()
                    .find(block => block.type === 'spark_handShank_menu').getField('HAND_SHANK');
                gamepadUiField.showEditor_();
            })()`);
            const gamepadImage = await evaluate(`(async () => {
                const image = document.querySelector('.spark-gamepad-stage img');
                await image.decode();
                return {width: image.naturalWidth, height: image.naturalHeight};
            })()`);
            assert.deepStrictEqual(gamepadImage, {width: 3300, height: 2550});
            window.webContents.invalidate(); await pause(300);
            const gamepadScreen = await window.webContents.capturePage();
            fs.writeFileSync(path.join(output, 'spark-gamepad-initial.png'), gamepadScreen.toPNG());
            const gamepadPixel = await evaluate(`(() => {
                const box = document.querySelector('.spark-gamepad-stage').getBoundingClientRect();
                return {x: box.x + box.width / 2, y: box.y + box.height / 2, width: innerWidth};
            })()`);
            const screenSize = gamepadScreen.getSize();
            const screenScale = screenSize.width / gamepadPixel.width;
            const pixelOffset = ((Math.floor(gamepadPixel.y * screenScale) * screenSize.width) +
                Math.floor(gamepadPixel.x * screenScale)) * 4;
            const gamepadBitmap = gamepadScreen.getBitmap();
            assert.ok([0, 1, 2].every(channel => gamepadBitmap[pixelOffset + channel] > 100),
                'the rendered controller body must be visible, not only a decoded image');
            for (const width of [800, 1000, 1280]) {
                window.setSize(width, 860); await pause(120);
                const geometry = await evaluate(`(() => {
                    gamepadUiField.showEditor_();
                    const panel = document.querySelector('.spark-gamepad-selector');
                    const stage = panel.querySelector('.spark-gamepad-stage').getBoundingClientRect();
                    const bounds = panel.getBoundingClientRect();
                    const buttons = Array.from(panel.querySelectorAll('[data-gamepad-key]'));
                    return {fits: bounds.left >= 0 && bounds.top >= 0 &&
                        bounds.right <= innerWidth && bounds.bottom <= innerHeight,
                        keys: buttons.map(button => button.dataset.gamepadKey),
                        inside: buttons.every(button => {
                            const box = button.getBoundingClientRect();
                            return box.left >= stage.left && box.top >= stage.top &&
                                box.right <= stage.right && box.bottom <= stage.bottom;
                        }),
                        hitTests: buttons.every(button => {
                            const box = button.getBoundingClientRect();
                            return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
                                .closest('[data-gamepad-key]') === button;
                        })};
                })()`);
                assert.equal(geometry.fits, true, 'gamepad popup fits at ' + width);
                assert.equal(geometry.inside, true, 'all hotspots fit inside the rendered controller');
                assert.equal(geometry.hitTests, true, 'no overlapped hit targets');
                assert.deepStrictEqual(geometry.keys, gamepadPicker.options);
            }
            for (const key of gamepadPicker.options) {
                const faceLabels = {Y: '1', X: '2', A: '3', B: '4'};
                const result = await evaluate(`(() => {
                    gamepadUiField.showEditor_();
                    const button = document.querySelector('[data-gamepad-key="${key}"]');
                    button.dispatchEvent(new MouseEvent('mouseleave'));
                    const initial = button.style.background;
                    button.dispatchEvent(new MouseEvent('mouseenter'));
                    const hover = initial !== button.style.background;
                    const label = {text: button.textContent, title: button.title,
                        accessible: button.getAttribute('aria-label')};
                    button.click();
                    const editor = window.findLocaleTestBlocks();
                    return {value: gamepadUiField.getValue(), hover, closed: !gamepadUiField.controllerEditor_,
                        label, display: gamepadUiField.getText(),
                        code: editor.ScratchBlocks.SparkPython.spark_sensing_isHandling(
                            gamepadUiField.sourceBlock_.getParent())[0]};
                })()`);
                assert.equal(result.value, key);
                assert.equal(result.hover, true);
                assert.equal(result.closed, true);
                if (faceLabels[key]) {
                    assert.deepStrictEqual(result.label, {text: faceLabels[key],
                        title: faceLabels[key], accessible: faceLabels[key]});
                    assert.equal(result.display, faceLabels[key], 'the block must also display its number');
                    const caption = await evaluate(`(() => {
                        gamepadUiField.showEditor_();
                        return gamepadUiField.controllerCaption_.textContent;
                    })()`);
                    assert.ok(caption.endsWith(': ' + faceLabels[key]), 'popup caption must use its number');
                    await evaluate('window.findLocaleTestBlocks().ScratchBlocks.DropDownDiv.hideWithoutAnimation()');
                }
                assert.equal(result.code, '_key.key_remote("' + key + '","press")');
                await pause(40);
            }
            await evaluate(`(() => {
                const editor = window.findLocaleTestBlocks();
                editor.workspace.clearUndo(); gamepadUiField.setValue('up');
            })()`);
            await pause(100);
            await evaluate("gamepadUiField.setValue('A')");
            await pause(100);
            await evaluate('window.findLocaleTestBlocks().workspace.undo(false)');
            assert.equal(await evaluate('gamepadUiField.getValue()'), 'up');
            await evaluate('window.findLocaleTestBlocks().workspace.undo(true)');
            assert.equal(await evaluate('gamepadUiField.getValue()'), 'A');
            assert.equal(await evaluate('gamepadUiField.getText()'), '3');
            const gamepadSaved = await evaluate(`(() => {
                const B = window.findLocaleTestBlocks().ScratchBlocks;
                const values = gamepadUiField.getOptions().map(option => option[1]);
                return values.map(value => {
                    gamepadUiField.setValue(value);
                    const xml = B.Xml.blockToDom(gamepadUiField.sourceBlock_.getParent());
                    const workspace = new B.Workspace();
                    try {
                        B.Xml.domToBlock(xml, workspace);
                        const field = workspace.getAllBlocks().find(block => block.type === 'spark_handShank_menu')
                            .getField('HAND_SHANK');
                        return {value: field.getValue(), text: field.getText()};
                    } finally { workspace.dispose(); }
                });
            })()`);
            assert.deepStrictEqual(gamepadSaved.map(field => field.value), gamepadPicker.options);
            for (const [value, text] of Object.entries({Y: '1', X: '2', A: '3', B: '4'})) {
                assert.equal(gamepadSaved.find(field => field.value === value).text, text,
                    'legacy letter values must reopen with numeric labels');
            }
            for (const locale of ['zh-cn', 'zh-tw', 'en', 'ru', 'pt-br']) {
                await evaluate(`window.dispatchEvent(new CustomEvent('est-home-set-locale',
                    {detail:{locale:${JSON.stringify(locale)}}}))`);
                await pause(500);
                const localized = await evaluate(`(() => {
                    const editor = window.findLocaleTestBlocks();
                    window.gamepadUiField = editor.workspace.getAllBlocks()
                        .find(block => block.type === 'spark_handShank_menu').getField('HAND_SHANK');
                    gamepadUiField.showEditor_();
                    return {value: gamepadUiField.getValue(),
                        label: document.querySelector('.spark-gamepad-selector').getAttribute('aria-label'),
                        selected: document.querySelector('[data-gamepad-key][aria-pressed=true]').dataset.gamepadKey};
                })()`);
                assert.equal(localized.value, 'R1');
                assert.equal(localized.selected, 'R1');
                assert.equal(localized.label, {'zh-cn': '手柄按键', 'zh-tw': '手柄按鍵',
                    en: 'Controller button', ru: 'Кнопка геймпада', 'pt-br': 'Botão do controle'}[locale]);
                window.webContents.invalidate(); await pause(180);
                fs.writeFileSync(path.join(output, 'spark-gamepad-' + locale + '.png'),
                    (await window.webContents.capturePage()).toPNG());
            }
            await evaluate(`(() => {
                const editor = window.findLocaleTestBlocks(), field = gamepadUiField;
                const panel = field.controllerEditor_;
                panel.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowLeft', bubbles: true}));
                const keyboardFocus = document.activeElement.dataset.gamepadKey;
                if (!keyboardFocus) throw new Error('Keyboard focus left the gamepad');
                panel.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
                if (field.controllerEditor_) throw new Error('Escape did not close the gamepad');
                field.showEditor_();
                field.sourceBlock_.getParent().dispose(false);
                if (field.controllerEditor_ || editor.ScratchBlocks.DropDownDiv.owner_ === field) {
                    throw new Error('Disposed gamepad retained its editor');
                }
                delete window.gamepadUiField;
            })()`);
            console.log('Spark graphical gamepad: supplied render loaded; all 10 button hotspots, hover/selection, Python mapping, undo/redo, save/reopen, keyboard, disposal, 5 locales and 800/1000/1280 layouts passed.');
            const pairInitial = await evaluate(`(() => {
                const editor = window.findLocaleTestBlocks();
                const pair = editor.workspace.getAllBlocks().find(b => b.type === 'spark_combined_motor_box');
                const field = pair.getField('MOTOR');
                pair.getParent().getField('STATUS').showEditor_();
                const nativePopup = getComputedStyle(editor.ScratchBlocks.DropDownDiv.getContentDiv().parentNode);
                const nativeColours = {background: nativePopup.backgroundColor, border: nativePopup.borderTopColor};
                window.sparkPairTestField = field;
                editor.workspace.clearUndo();
                field.showEditor_();
                const panel = document.querySelector('.spark-combined-motor-selector');
                const bounds = panel.getBoundingClientRect();
                const popup = getComputedStyle(panel.parentNode.parentNode);
                return {value: field.getValue(), options: field.getOptions().map(option => option[1]),
                    selected: Array.from(panel.querySelectorAll('[aria-pressed=true]')).map(b => b.textContent),
                    nativeColours, colours: {background: popup.backgroundColor, border: popup.borderTopColor},
                    textColour: getComputedStyle(panel).color,
                    fits: bounds.left >= 0 && bounds.top >= 0 && bounds.right <= innerWidth &&
                        bounds.bottom <= innerHeight};
            })()`);
            assert.equal(pairInitial.value, 'E+F');
            assert.deepStrictEqual(pairInitial.options, ['E', 'F', 'G', 'H']);
            assert.deepStrictEqual(pairInitial.selected, ['E', 'F']);
            assert.deepStrictEqual(pairInitial.colours, pairInitial.nativeColours,
                'custom pair popup must use the same category background and border as a native dropdown');
            assert.equal(pairInitial.textColour, 'rgb(255, 255, 255)');
            assert.equal(pairInitial.fits, true);
            const pairClick = async port => {
                await evaluate(`document.querySelector('.spark-combined-motor-selector [data-motor-port="${port}"]').click()`);
                await pause(100);
                return evaluate(`(() => {
                    const panel = document.querySelector('.spark-combined-motor-selector');
                    return {value: sparkPairTestField.getValue(), text: sparkPairTestField.getText(),
                        selected: Array.from(panel.querySelectorAll('[aria-pressed=true]')).map(b => b.textContent),
                        left: panel.querySelector('[data-motor-side=left]').textContent,
                        right: panel.querySelector('[data-motor-side=right]').textContent};
                })()`);
            };
            const pairPending = await pairClick('G');
            assert.equal(pairPending.value, 'G');
            assert.equal(pairPending.text, 'G+?');
            assert.equal(await evaluate(`(() => {
                const project = JSON.parse(window.findLocaleTestBlocks().props.vm.toJSON());
                return project.targets.flatMap(target => Object.values(target.blocks))
                    .find(block => block.opcode === 'spark_combined_motor_box').fields.MOTOR[0];
            })()`), 'G', 'pending motor selection must reach the saved project');
            assert.deepStrictEqual(pairPending.selected, ['G']);
            assert.ok(pairPending.left.endsWith(': G'));
            assert.ok(!pairPending.right.endsWith(': F'), 'old right selection must be cleared');
            assert.equal((await pairClick('G')).value, 'G', 'no duplicate port selection');
            assert.equal((await pairClick('H')).value, 'G+H');
            await evaluate('window.findLocaleTestBlocks().workspace.undo(false)');
            await pause(100);
            assert.equal(await evaluate('sparkPairTestField.getValue()'), 'G');
            await evaluate('window.findLocaleTestBlocks().workspace.undo(true)');
            await pause(100);
            assert.equal(await evaluate('sparkPairTestField.getValue()'), 'G+H');
            await evaluate('window.findLocaleTestBlocks().ScratchBlocks.DropDownDiv.hideWithoutAnimation()');
            const pairRoundTrip = await evaluate(`(() => {
                const B = window.findLocaleTestBlocks().ScratchBlocks;
                const results = [];
                for (const value of ['H+E', 'F', 'E+E']) {
                    sparkPairTestField.setValue(value);
                    const xml = B.Xml.blockToDom(sparkPairTestField.sourceBlock_.getParent());
                    const scratch = new B.Workspace();
                    try {
                        B.Xml.domToBlock(xml, scratch);
                        const field = scratch.getAllBlocks().find(b => b.type === 'spark_combined_motor_box')
                            .getField('MOTOR');
                        results.push({value: field.getValue(), text: field.getText()});
                    } finally { scratch.dispose(); }
                }
                sparkPairTestField.showEditor_();
                return results;
            })()`);
            assert.deepStrictEqual(pairRoundTrip.map(result => result.value), ['H+E', 'F', 'E']);
            assert.equal(pairRoundTrip[1].text, 'F+?');
            assert.equal((await pairClick('H')).value, 'E+H');
            assert.equal((await pairClick('F')).value, 'F', 'third selection resets even after reopening');
            assert.equal((await pairClick('E')).value, 'F+E', 'selection order must not be sorted');
            for (const width of [800, 1000, 1280]) {
                window.setSize(width, 860);
                await pause(100);
                const layout = await evaluate(`(() => {
                    sparkPairTestField.showEditor_();
                    const panel = document.querySelector('.spark-combined-motor-selector');
                    const bounds = panel.getBoundingClientRect();
                    return {fits: bounds.left >= 0 && bounds.top >= 0 &&
                        bounds.right <= innerWidth && bounds.bottom <= innerHeight,
                        noScroll: panel.scrollWidth <= panel.clientWidth &&
                            panel.scrollHeight <= panel.clientHeight,
                        buttons: panel.querySelectorAll('button').length};
                })()`);
                assert.deepStrictEqual(layout, {fits: true, noScroll: true, buttons: 4},
                    'paired motor popup must fit at ' + width + ' px');
            }
            window.webContents.invalidate(); await pause(100);
            fs.writeFileSync(path.join(output, 'spark-paired-motors.png'),
                (await window.webContents.capturePage()).toPNG());
            await evaluate('window.findLocaleTestBlocks().ScratchBlocks.DropDownDiv.hideWithoutAnimation()');
            const pairCleanup = await evaluate(`(() => {
                sparkPairTestField.showEditor_();
                const field = sparkPairTestField;
                field.sourceBlock_.getParent().dispose(false);
                delete window.sparkPairTestField;
                return {closed: !field.portEditor_,
                    ownerCleared: window.findLocaleTestBlocks().ScratchBlocks.DropDownDiv.owner_ !== field};
            })()`);
            assert.deepStrictEqual(pairCleanup, {closed: true, ownerCleared: true});
            console.log('Spark paired motors: E/F/G/H ordered double-selection, third-click reset, no duplicates, undo/redo, save/reopen and popup disposal passed.');
            await evaluate(`(() => {
                const editor = window.findLocaleTestBlocks();
                editor.workspace.clear();
                editor.ScratchBlocks.Xml.domToWorkspace(window.sparkPortColourSnapshot, editor.workspace);
                delete window.sparkPortColourSnapshot;
            })()`);
            await evaluate(`(() => {
                const editor = window.findLocaleTestBlocks(), B = editor.ScratchBlocks;
                let tail = editor.workspace.getAllBlocks().find(b => b.type === 'spark_event_whenflagclicked');
                for (const type of ['motor_specifiedunit', 'matrix_lamp', 'control_wait', 'motor_stop']) {
                    const xml = Array.from(sparkUiFixtureXml.children).find(node =>
                        node.getAttribute('type') === 'spark_' + type).cloneNode(true);
                    const block = B.Xml.domToBlock(xml, editor.workspace);
                    block.initSvg(); block.render();
                    tail.nextConnection.connect(block.previousConnection); tail = block;
                }
            })()`);
            await pause(400);
            const sparkProgram = await evaluate('window.findLocaleTestBlocks().workspaceToCode()');
            assert.ok(sparkProgram.includes('_motor.run_for_power_seconds(4, 50, 1)'));
            assert.ok(sparkProgram.includes('_matrix.show('));
            assert.ok(sparkProgram.includes('_motor.stop(4)'));
            assert.ok(await evaluate('Boolean(document.querySelector("#spark-program-controls"))'));
            assert.ok(!await evaluate('Boolean(document.querySelector("#est-program-controls"))'));
            assert.equal(await evaluate('document.querySelector("#spark-program-controls [data-action=run]").disabled'), true);
            await evaluate('document.querySelector("#spark-connection").click()');
            await pause(150);
            assert.equal(await evaluate('document.querySelector("#spark-auto-connect").checked'), true);
            await evaluate('document.querySelector("#spark-auto-connect").click()');
            await pause(150);
            assert.equal(sparkState.discovery.enabled, false, 'auto-connect toggle reaches main IPC');
            await evaluate('document.querySelector("#spark-auto-connect").click()');
            await pause(150);
            assert.equal(sparkState.discovery.enabled, true);
            await pause(120);
            assert.equal(sparkRequests.length, 0, 'scanning must not automatically open serial ports');
            await evaluate('document.querySelector("#spark-usb-connect").click()');
            await pause(180);
            assert.deepStrictEqual(sparkRequests[0], {action: 'connect', path: 'COM_TEST'});
            const pairedBlock = await evaluate(`(() => {
                const editor = window.findLocaleTestBlocks(), B = editor.ScratchBlocks;
                const xml = Array.from(sparkUiFixtureXml.children).find(node =>
                    node.getAttribute('type') === 'spark_combined_motor_starting').cloneNode(true);
                const pair = B.Xml.domToBlock(xml, editor.workspace);
                const start = editor.workspace.getAllBlocks().find(b => b.type === 'spark_event_whenflagclicked');
                const next = start.nextConnection.targetConnection;
                if (next) start.nextConnection.disconnect();
                start.nextConnection.connect(pair.previousConnection);
                if (next) pair.nextConnection.connect(next);
                pair.getInputTargetBlock('PORT').setFieldValue('G', 'MOTOR');
                return pair.id;
            })()`);
            await pause(400);
            const requestsBeforeIncomplete = sparkRequests.length;
            for (const action of ['download', 'run']) {
                await evaluate(`document.querySelector('#spark-program-controls [data-action=${action}]').click()`);
                await pause(180);
                assert.equal(sparkRequests.length, requestsBeforeIncomplete, 'incomplete pair must not reach hardware');
                assert.ok(nativeMessages.pop().detail.includes('SPARK_MOTOR_PAIR_INCOMPLETE'));
            }
            await evaluate(`(() => {
                const editor = window.findLocaleTestBlocks();
                editor.workspace.getBlockById(${JSON.stringify(pairedBlock)}).getInputTargetBlock('PORT')
                    .setFieldValue('H+G', 'MOTOR');
            })()`);
            await pause(400);
            assert.ok((await evaluate('window.findLocaleTestBlocks().workspaceToCode()')).includes('_motor.pair(7,6,'));
            console.log('Spark paired motor validation: pending right motor blocks download/run; completed pair generates left/right arguments in click order.');
            await evaluate(`(() => {
                const editor = window.findLocaleTestBlocks();
                const pair = editor.workspace.getBlockById(${JSON.stringify(pairedBlock)});
                const previous = pair.previousConnection.targetConnection;
                const next = pair.nextConnection.targetConnection;
                pair.previousConnection.disconnect();
                if (next) pair.nextConnection.disconnect();
                if (previous && next) previous.connect(next);
                pair.dispose(false);
            })()`);
            await pause(400);
            assert.equal(await evaluate('document.querySelector("#spark-program-controls [data-action=run]").disabled'), false);
            for (const locale of ['zh-cn', 'zh-tw', 'pt-br', 'ru', 'en']) {
                await evaluate(`window.dispatchEvent(new CustomEvent('est-home-set-locale',
                    {detail:{locale:${JSON.stringify(locale)}}}))`);
                await pause(500);
                if (!await evaluate('Boolean(document.querySelector("#spark-hardware-panel"))')) {
                    await evaluate('document.querySelector("#spark-connection").click()');
                    await pause(120);
                }
                const geometry = await evaluate(`(() => {
                    const panel = document.querySelector('#spark-hardware-panel');
                    const rect = panel.getBoundingClientRect();
                    return {fits: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
                        overflow: panel.scrollWidth > panel.clientWidth,
                        text: panel.textContent, rows: panel.querySelectorAll('[class*=SparkRuntime_port_]').length};
                })()`);
                assert.ok(geometry.fits && !geometry.overflow, locale + ': Spark panel must fit');
                assert.equal(geometry.rows, 4);
                assert.ok(!/SPARK_|threadValue|ultrasion/.test(geometry.text), geometry.text);
            }
            for (const width of [800, 1000, 1280]) {
                window.setSize(width, 760); await pause(180);
                assert.ok(await evaluate(`(() => { const p = document.querySelector('#spark-hardware-panel');
                    const r = p.getBoundingClientRect(); return p.scrollWidth <= p.clientWidth &&
                    r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; })()`));
                fs.writeFileSync(path.join(output, 'spark-usb-panel-' + width + '.png'),
                    (await window.webContents.capturePage()).toPNG());
            }
            window.setSize(1280, 860);
            for (const locale of ['zh-cn', 'zh-tw', 'pt-br', 'ru', 'en']) {
                await evaluate(`window.dispatchEvent(new CustomEvent('est-home-set-locale',
                    {detail:{locale:${JSON.stringify(locale)}}}))`);
                await pause(350);
                if (!await evaluate('Boolean(document.querySelector("#spark-hardware-panel"))')) {
                    await evaluate('document.querySelector("#spark-connection").click()');
                }
                if (!await evaluate('Boolean(document.querySelector("#spark-firmware-panel"))')) {
                    await evaluate('document.querySelector("#spark-firmware-toggle").click()');
                }
                await pause(150);
                assert.equal(await evaluate('document.querySelectorAll("#spark-firmware-panel tbody tr").length'), 5);
                assert.equal(await evaluate('document.querySelector("#spark-firmware-start").disabled'), true);
                const text = await evaluate('document.querySelector("#spark-firmware-panel").textContent');
                assert.ok(!/SPARK_|firmware[A-Z]/.test(text), text);
                assert.ok(!text.includes('SPARK_FW_BOOT_UNVERIFIED'), text);
                await evaluate('document.querySelector("#spark-firmware-confirm").click()');
                await pause(60);
                assert.equal(await evaluate('document.querySelector("#spark-firmware-start").disabled'), false);
                await evaluate('document.querySelector("#spark-firmware-start").click()');
                await pause(80);
                assert.equal(await evaluate('document.querySelector("#spark-program-controls [data-action=run]").disabled'), true);
                assert.equal(await evaluate('document.querySelector("#spark-firmware-check").disabled'), true);
                assert.ok(await evaluate('Boolean(document.querySelector("#spark-firmware-panel progress"))'));
                if (locale === 'zh-cn') {
                    await evaluate('document.querySelector("#spark-hardware-panel header button").click()');
                    await evaluate('document.querySelector("#spark-connection").click()');
                    await pause(50);
                    assert.ok(await evaluate('Boolean(document.querySelector("#spark-firmware-panel progress"))'),
                        'reopening the panel must show the active update');
                }
                await pause(350);
                assert.equal(sparkState.firmware.phase, 'complete');
                assert.equal(sparkRequests[sparkRequests.length - 1].action, 'firmware');
                assert.equal(sparkRequests[sparkRequests.length - 1].confirmedErase, true);
                const before = firmwareChecks;
                await evaluate('document.querySelector("#spark-firmware-check").click()');
                await pause(150);
                assert.equal(firmwareChecks, before + 1);
                for (const width of [800, 1280]) {
                    window.setSize(width, 760); await pause(150);
                    assert.ok(await evaluate(`(() => { const p = document.querySelector('#spark-hardware-panel');
                        const r = p.getBoundingClientRect(); return p.scrollWidth <= p.clientWidth &&
                        r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; })()`));
                    await evaluate('document.querySelector("#spark-firmware-toggle").scrollIntoView({block:"start"})');
                    assert.ok(await evaluate(`(() => {
                        const close = document.querySelector('#spark-hardware-panel header button');
                        const r = close.getBoundingClientRect();
                        return r.top >= 0 && r.bottom <= innerHeight &&
                            close.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
                    })()`), 'close button remains visible and clickable after scrolling');
                    fs.writeFileSync(path.join(output, `spark-firmware-${locale}-${width}.png`),
                        (await window.webContents.capturePage()).toPNG());
                }
            }
            await evaluate('document.querySelector("#spark-usb-connect").click()');
            await pause(100);
            await evaluate('document.querySelector("#spark-firmware-recovery").click()');
            await evaluate('document.querySelector("#spark-firmware-confirm").click()');
            await pause(50);
            assert.equal(await evaluate('document.querySelector("#spark-firmware-start").disabled'), false);
            await evaluate('document.querySelector("#spark-firmware-start").click()');
            await pause(450);
            assert.equal(sparkRequests[sparkRequests.length - 1].recovery, true);
            assert.equal(sparkRequests[sparkRequests.length - 1].path, 'COM_TEST');
            await evaluate('document.querySelector("#spark-firmware-toggle").click()');
            window.setSize(1280, 860);
            console.log('Spark firmware UI: erase confirmation, progress, busy controls, reopen, recovery, recheck and five locales at 800/1280 passed.');
            await evaluate('document.querySelector("#spark-mode-ble").click()');
            await pause(150);
            assert.equal(sparkState.connectionMode, 'ble');
            sparkState = {...sparkState, bleDevice: {id: 'AA:BB:CC:DD:EE:FF', name: 'Spark_AI'}};
            window.webContents.send('spark-state-change', sparkState);
            await pause(100);
            assert.ok(await evaluate('Boolean(document.querySelector("#spark-ble-forget"))'));
            assert.ok(await evaluate('Boolean(document.querySelector("#spark-auto-connect"))'));
            for (const locale of ['zh-cn', 'zh-tw', 'pt-br', 'ru', 'en']) {
                await evaluate(`window.dispatchEvent(new CustomEvent('est-home-set-locale',
                    {detail:{locale:${JSON.stringify(locale)}}}))`);
                await pause(350);
                if (!await evaluate('Boolean(document.querySelector("#spark-hardware-panel"))')) {
                    await evaluate('document.querySelector("#spark-connection").click()');
                }
                window.webContents.send('spark-ble-scan-state', {scanning: true, devices: [
                    {id: 'AA:BB:CC:DD:EE:FF', name: 'Spark_AI'},
                    {id: '00:11:22:33:44:55', name: 'Spark_AI_Second_Device_With_A_Long_Name'}
                ]});
                await pause(100);
                for (const width of [800, 1280]) {
                    window.setSize(width, 760); await pause(120);
                    const geometry = await evaluate(`(() => { const p = document.querySelector('#spark-hardware-panel');
                        const r = p.getBoundingClientRect(); return {fits: p.scrollWidth <= p.clientWidth &&
                            r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight,
                            text: p.innerText, devices: p.querySelectorAll('li').length}; })()`);
                    assert.ok(geometry.fits, locale + ': BLE layout fits');
                    assert.equal(geometry.devices, 2);
                    assert.ok(!/SPARK_|searchBluetooth|noBluetoothDevices/.test(geometry.text));
                    fs.writeFileSync(path.join(output, `spark-ble-${locale}-${width}.png`),
                        (await window.webContents.capturePage()).toPNG());
                }
            }
            window.webContents.send('spark-ble-scan-state', {scanning: false, devices: []});
            await pause(100);
            sparkState = {...sparkState, busy: true, reconnecting: true};
            window.webContents.send('spark-state-change', sparkState); await pause(100);
            assert.equal(await evaluate('document.querySelector("#spark-auto-connect").disabled'), false);
            assert.equal(await evaluate('document.querySelector("#spark-ble-forget").disabled'), true);
            sparkState = {...sparkState, busy: false, reconnecting: false};
            window.webContents.send('spark-state-change', sparkState); await pause(100);
            await evaluate('document.querySelector("#spark-ble-forget").click()'); await pause(100);
            assert.equal(sparkState.bleDevice, null);
            await evaluate('document.querySelector("#spark-mode-usb").click()');
            await pause(100);
            await evaluate('document.querySelector("#spark-usb-connect").click()');
            await pause(150);
            window.setSize(1280, 860);
            await evaluate('document.querySelector("#spark-hardware-panel header button").click()');
            await evaluate('document.querySelector("#spark-program-controls [class*=slot-display]").click()');
            assert.equal(await evaluate('document.querySelectorAll("#spark-program-controls [data-slot]").length'), 10);
            await evaluate(`document.querySelector('#spark-program-controls [data-slot="9"]').click()`);
            for (const action of ['download', 'run', 'stop']) {
                await evaluate(`document.querySelector('#spark-program-controls [data-action=${action}]').click()`);
                await pause(50);
                assert.equal(await evaluate('document.querySelector("#spark-program-controls [data-action=run]").disabled'), true);
                await pause(250);
                assert.equal(sparkRequests.at(-1).action, action);
                if (action !== 'stop') {
                    assert.equal(sparkRequests.at(-1).slot, 9);
                    assert.equal(sparkRequests.at(-1).source, sparkProgram);
                }
            }
            interruptSparkDownload = true;
            await evaluate('document.querySelector("#spark-program-controls [data-action=download]").click()');
            await pause(350);
            assert.equal(sparkState.warning, 'SPARK_DOWNLOAD_INCOMPLETE');
            for (const action of ['download', 'run', 'stop']) {
                assert.equal(await evaluate(`document.querySelector('#spark-program-controls [data-action=${action}]').disabled`),
                    false, 'interrupted download warning must not disable ' + action);
            }
            for (const [locale, text] of [['zh-cn', '下载未完成'], ['zh-tw', '下載未完成'],
                ['pt-br', 'Transferência incompleta'], ['ru', 'Загрузка не завершена'], ['en', 'Download incomplete']]) {
                await evaluate(`window.dispatchEvent(new CustomEvent('est-home-set-locale',
                    {detail:{locale:${JSON.stringify(locale)}}}))`);
                await pause(300);
                assert.ok(await evaluate(`document.querySelector('#spark-program-controls [role=status]').textContent.includes(${JSON.stringify(text)})`));
            }
            await evaluate('document.querySelector("#spark-program-controls [data-action=download]").click()');
            await pause(350);
            assert.equal(sparkState.warning, null);
            assert.equal(sparkState.result.downloaded, true);
            console.log('Spark download interruption UI: nonblocking five-locale warning, enabled run/download/stop and immediate full retry passed.');
            sparkState = {...sparkState, busy: true, operation: {phase: 'downloading', bytes: 20, total: 110}};
            window.webContents.send('spark-state-change', sparkState); await pause(100);
            await evaluate('document.querySelector("#spark-program-controls [class*=SparkRuntime_icon-button]").click()');
            await pause(100); assert.equal(sparkRequests.at(-1).action, 'cancel');
            console.log('Spark runtime UI: explicit USB connection, four real port types, five locales, 800/1000/1280 layouts, slots 0-9, routed download/run/stop and cancellation passed.');
            assert.ok(await evaluate('Boolean(document.querySelector("[class*=EstCodeDrawerToggle_toggle-button]"))'));
            await evaluate('document.querySelector("[class*=EstCodeDrawerToggle_toggle-button]").click()');
            await pause(250);
            window.webContents.invalidate();
            fs.writeFileSync(path.join(output, 'spark-blocks-code-preview.png'),
                (await window.webContents.capturePage()).toPNG());
            await evaluate('window.findLocaleTestBlocks().props.onToggleHardwareCodeLock()');
            await pause(50);
            await evaluate(`window.findLocaleTestBlocks().props.onSetCodeEditorValue('print("spark manual draft")')`);
            await evaluate(`(() => { const vm = window.findLocaleTestBlocks().props.vm;
                const stage = vm.runtime.getTargetForStage();
                stage.createVariable('spark-value', 'Spark value', '');
                stage.variables['spark-value'].value = 123;
                vm.runtime.emitProjectChanged();
                vm.emitWorkspaceUpdate();
            })()`);
            await pause(150);
            const savedSparkProgram = await evaluate('window.findLocaleTestBlocks().workspaceToCode()');
            await evaluate('(async () => { window.savedSparkHardwareProject = await window.findLocaleTestBlocks().props.vm.saveProjectSb3(); })()');
            await chooseHardware('new-ai');
            assert.ok(!await evaluate('Boolean(window.findLocaleTestBlocks().props.vm.runtime.getTargetForStage().variables["spark-value"])'));
            await chooseHardware('spark-ai');
            assert.equal(await evaluate('window.findLocaleTestBlocks().props.vm.runtime.getTargetForStage().variables["spark-value"].value'), 123);
            assert.equal(await evaluate('window.findLocaleTestBlocks().workspaceToCode()'), savedSparkProgram);
            assert.equal(await evaluate('window.findLocaleTestBlocks().props.isCodeEditorLocked'), false);
            assert.equal(await evaluate('window.findLocaleTestBlocks().props.codeEditorValue'), 'print("spark manual draft")');
            await chooseHardware('est');
            assert.ok(await evaluate('Boolean(window.findLocaleTestBlocks().workspace.getBlockById("locale-est"))'),
                'returning to EST must restore its original blocks');
            await evaluate('(async () => { await window.findLocaleTestBlocks().props.vm.loadProject(await savedSparkHardwareProject.arrayBuffer()); })()');
            await pause(500);
            assert.ok((await evaluate(`document.querySelector('${hardwareButton}').textContent`)).includes('Spark AI'));
            assert.equal(await evaluate('window.findLocaleTestBlocks().props.vm.runtime.getTargetForStage().variables["spark-value"].value'), 123);
            const beforeUnknown = await evaluate('window.findLocaleTestBlocks().props.vm.toJSON()');
            const unknownError = await evaluate(`(async () => { const vm = window.findLocaleTestBlocks().props.vm;
                const project = JSON.parse(vm.toJSON()); project.meta.estStudio.hardwareId = 'unknown';
                try { await vm.loadProject(JSON.stringify(project)); return ''; } catch (error) { return error.message; }
            })()`);
            assert.ok(unknownError.includes('HARDWARE_UNKNOWN'));
            assert.equal(await evaluate('window.findLocaleTestBlocks().props.vm.toJSON()'), beforeUnknown);
            await chooseHardware('est');
            await evaluate(`(() => {
                window.legacyHardwareProject = JSON.parse(window.findLocaleTestBlocks().props.vm.toJSON());
                delete legacyHardwareProject.meta.estStudio;
            })()`);
            await chooseHardware('new-ai');
            await evaluate('(async () => { await window.findLocaleTestBlocks().props.vm.loadProject(JSON.stringify(legacyHardwareProject)); })()');
            await pause(500);
            assert.equal(selectedHardware, 'est', 'opening an old EST project restores EST automatically');
            for (const width of [1280, 1000, 800]) {
                window.setSize(width, 760);
                await evaluate(`document.querySelector('${hardwareButton}').click()`);
                await pause(200);
                const bounds = await evaluate(`(() => {
                    const dialog = document.querySelector('input[name="hardware-choice"]').closest('[role="dialog"]');
                    const rect = dialog.getBoundingClientRect();
                    return {left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
                        width: innerWidth, height: innerHeight, overflow: dialog.scrollWidth > dialog.clientWidth};
                })()`);
                assert.ok(bounds.left >= 0 && bounds.right <= bounds.width && bounds.top >= 0 && bounds.bottom <= bounds.height);
                assert.equal(bounds.overflow, false);
                if (width >= 1000) {
                    const titleWidth = await evaluate(`document.querySelector('[class*="project-title-input_title-field_"]')
                        .getBoundingClientRect().width`);
                    assert.ok(titleWidth >= 100, `hardware selector must leave a usable project title field (${width}: ${titleWidth})`);
                }
                window.webContents.invalidate();
                fs.writeFileSync(path.join(output, `hardware-choice-${width}.png`),
                    (await window.webContents.capturePage()).toPNG());
                await evaluate('document.querySelector("[role=dialog] header button").click()');
            }
            console.log('Hardware selector UI passed: three products, isolated drafts, saved project reopen, legacy migration and 1280/1000/800 px layouts. Screenshots: ' + output);
            await require('./check-new-ai-ui')({evaluate, pause, window, output, chooseHardware, newAiRequests,
                setNewAiTestState});
            const startupSparkData = await evaluate('(async () => Array.from(new Uint8Array(await savedSparkHardwareProject.arrayBuffer())))()');
            const reloadHardwareEditor = async () => {
                await evaluate('window.onbeforeunload = null; undefined');
                await window.loadFile(path.join(rendererRoot, 'index.html'));
                let mounted = false;
                for (let attempt = 0; attempt < 150 && !mounted; attempt++) {
                    mounted = await evaluate(`(() => {
                        window.findLocaleTestBlocks = () => {
                            for (const element of document.querySelectorAll('div')) {
                                let fiber = element[Object.keys(element).find(key =>
                                    key.startsWith('__reactInternalInstance'))];
                                for (; fiber; fiber = fiber.return) {
                                    const instance = fiber.stateNode;
                                    if (instance && instance.ScratchBlocks && instance.workspace &&
                                        typeof instance.setLocale === 'function' && instance.workspace.getFlyout()) {
                                        return instance;
                                    }
                                }
                            }
                            return null;
                        };
                        const editor = findLocaleTestBlocks();
                        return Boolean(editor && editor.props.vm.runtime.targets.length);
                    })()`);
                    await pause(100);
                }
                assert.ok(mounted, 'editor must mount after a cold renderer start');
                await pause(700);
                return evaluate(`(() => {
                    const editor = findLocaleTestBlocks(), vm = editor.props.vm;
                    return {menu: document.querySelector('#est-hardware-select').textContent.trim(),
                        hardwareId: vm.runtime.estStudioHardwareId,
                        projectHardwareId: JSON.parse(vm.toJSON()).meta.estStudio.hardwareId,
                        blocks: editor.workspace.getAllBlocks().map(block => block.type),
                        estControls: Boolean(document.querySelector('[class*="EstProgramControls_controls"]:not(#spark-program-controls):not(#new-ai-program-controls)')),
                        sparkControls: Boolean(document.querySelector('#spark-program-controls')),
                        newControls: Boolean(document.querySelector('#new-ai-program-controls'))};
                })()`);
            };
            window.setSize(1280, 860);
            for (const [id, name, blocks] of [
                ['spark-ai', 'Spark AI', ['spark_event_whenflagclicked']],
                ['new-ai', 'New AI', ['new_event_whenflagclicked']],
                ['est', 'EST', ['event_program_start']]
            ]) {
                await chooseHardware(id);
                console.log('Checking remembered hardware startup: ' + id);
                const cold = await reloadHardwareEditor();
                assert.equal(selectedHardware, id, 'startup must not reset the main-process selection to EST');
                assert.equal(cold.hardwareId, id);
                assert.equal(cold.projectHardwareId, id);
                assert.ok(cold.menu.includes(name));
                assert.deepStrictEqual(cold.blocks, blocks, 'default blocks must match the remembered hardware');
                assert.equal(cold.estControls, id === 'est');
                assert.equal(cold.sparkControls, id === 'spark-ai');
                assert.equal(cold.newControls, id === 'new-ai');
            }
            await chooseHardware('new-ai');
            startupProjectData = Uint8Array.from(startupSparkData);
            console.log('Checking explicitly opened hardware project on startup');
            const explicitProject = await reloadHardwareEditor();
            assert.equal(selectedHardware, 'spark-ai', 'an explicitly opened project overrides the saved hardware');
            assert.equal(explicitProject.hardwareId, 'spark-ai');
            assert.ok(explicitProject.menu.includes('Spark AI'));
            assert.equal(await evaluate('findLocaleTestBlocks().props.vm.runtime.getTargetForStage().variables["spark-value"].value'), 123);
            startupProjectData = null;
            assert.deepStrictEqual(unhandledRejections, [], 'hardware startup must not leave unhandled rejections');
            console.log('Hardware startup UI passed: remembered EST/Spark AI/New AI initialize matching menus, blocks and controls; an explicit project overrides the saved choice.');
            clearTimeout(timeout);
            app.exit(0);
        } catch (error) {
            console.error(error);
            clearTimeout(timeout);
            app.exit(1);
        }
    });
}
