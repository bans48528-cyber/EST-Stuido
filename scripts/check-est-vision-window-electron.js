// Isolated native-window regression. Synthetic video and a fake EST replace physical devices.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

if (!process.versions.electron) {
    const result = require('child_process').spawnSync(require('electron'), [__filename], {
        windowsHide: true, stdio: 'inherit', env: {...process.env, NODE_OPTIONS: ''}
    });
    process.exitCode = result.status === null ? 1 : result.status;
} else {
    const {app, BrowserWindow, ipcMain} = require('electron');
    const load = filename => {
        const target = {exports: {}};
        const code = require('@babel/core').transformSync(fs.readFileSync(path.resolve(__dirname, filename), 'utf8'), {
            babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs']
        }).code;
        new Function('exports', 'module', 'require', code)(target.exports, target,
            request => require(path.resolve(__dirname, path.dirname(filename), request)));
        return target.exports;
    };
    const {VisionWindowManager} = load('../src/main/est/vision-window.js');
    const {VisionCameraSource} = load('../src/main/est/vision-camera-source.js');
    const output = fs.mkdtempSync(path.join(os.tmpdir(), 'est-vision-window-'));
    const guideCaptureDirectory = process.env.EST_VISION_GUIDE_CAPTURE_DIR ?
        path.resolve(process.env.EST_VISION_GUIDE_CAPTURE_DIR) : null;
    app.setPath('userData', path.join(output, 'profile'));
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    const capture = async (window, name) => {
        await window.webContents.capturePage();
        const image = await window.webContents.capturePage();
        fs.writeFileSync(path.join(output, `${name}.png`), image.toPNG());
        if (guideCaptureDirectory && name.startsWith('camera-running-') && !name.endsWith('zh-cn')) {
            fs.mkdirSync(guideCaptureDirectory, {recursive: true});
            const locale = name.slice('camera-running-'.length);
            const target = path.join(guideCaptureDirectory, `home-guide-vision-camera-${locale}.png`);
            fs.writeFileSync(target, image.toPNG());
            console.log(`Vision guide screenshot: ${target}`);
        }
    };
    const until = async predicate => {
        for (let i = 0; i < 100; i++) {
            if (await predicate()) return;
            await pause(50);
        }
        throw new Error('Timed out waiting for camera state');
    };
    let state = {connected: true, supported: true, paused: false, programRunning: true};
    const samples = [], frames = [], clears = [];
    const source = new VisionCameraSource({
        getVisionPublisherState: () => state,
        clearVision: reason => { clears.push(reason); return state; },
        updateVisionSample: sample => { samples.push(sample); return state; },
        updateVisionFrame: frame => { frames.push(frame); return state; }
    }, {stop: () => {}});
    let starts = 0;
    const manager = new VisionWindowManager({createWindow: options => {
        const {search, ...browserOptions} = options;
        const window = new BrowserWindow({...browserOptions, show: false,
            webPreferences: {...options.webPreferences, offscreen: true}});
        window.webContents.session.setPermissionRequestHandler((contents, permission, callback) => callback(permission === 'media'));
        window.loadFile(path.resolve(__dirname, '../dist/renderer/index.html'), {search})
            .then(() => console.log('Vision route loaded:', window.webContents.getURL()))
            .catch(error => console.error('Vision route failed:', error));
        // The production manager shows on ready; this test deliberately stays offscreen.
        window.show = () => {};
        window.webContents.on('console-message', (event, level, message) => {
            if (level >= 3) console.error(message);
        });
        return window;
    }, stopSource: owner => source.stop(owner)});
    ipcMain.handle('est-vision-window-close', event => { if (manager.owns(event.sender)) manager.close(); });
    ipcMain.on('est-vision-window-ready', event => { if (manager.owns(event.sender)) manager.setLocale(); });
    ipcMain.handle('est-vision-camera-state', () => state);
    ipcMain.handle('est-vision-camera-start', (event, options) => {
        starts++;
        return source.start(event.sender.id, options);
    });
    ipcMain.handle('est-vision-camera-frame', (event, token, sample) => source.frame(event.sender.id, token, sample));
    ipcMain.handle('est-vision-camera-stop', (event, token) => source.stop(event.sender.id, token));
    const timeout = setTimeout(() => app.exit(1), 60000);
    app.whenReady().then(async () => {
        let main;
        try {
            main = new BrowserWindow({show: false, width: 400, height: 600, x: 20, y: 40});
            await main.loadURL('about:blank');
            const open = async () => {
                console.log('Opening independent window');
                manager.open('zh-cn');
                const window = manager.window;
                await until(() => window.webContents.executeJavaScript(`Boolean(document.querySelector('section[aria-label^="MediaPipe"]'))`));
                console.log('Vision component mounted');
                const evaluate = code => window.webContents.executeJavaScript(code);
                await evaluate(`window.lab = (() => {
                    const el = document.querySelector('section[aria-label^="MediaPipe"]');
                    let f = el[Object.keys(el).find(key => key.startsWith('__reactInternalInstance'))];
                    for (; f; f = f.return) if (f.stateNode && f.stateNode.startCamera) return f.stateNode;
                })(); undefined;`);
                return {window, evaluate};
            };
            const installVideo = evaluate => evaluate(`(() => {
                window.mediaRequests = 0; window.requestedModels = [];
                window.lab.vision = {
                    initialize: options => {
                        requestedModels.push(options);
                        lab.setState({modelProgress: {kind: 'hands', stage: 'warmup'}});
                        return new Promise(resolve => setTimeout(resolve, 600));
                    },
                    connections: {hands: [], pose: [], face: []},
                    process: async () => {
                        const palm = Array.from({length: 21}, (_, i) => ({x: i % 2 ? 0.4 : 0.6, y: 0.7}));
                        palm[0] = {x: 0.5, y: 0.9};
                        [8,12,16,20].forEach(i => {palm[i] = {x: 0.5, y: 0.2};});
                        return {hands: {multiHandLandmarks: [palm], multiHandedness: [{label: 'Right', score: 0.95}]},
                            face: {}, pose: {}, timings: {hands: 1}};
                    }, close: async () => {}
                };
                navigator.mediaDevices.getUserMedia = async () => {
                    mediaRequests++;
                    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480;
                    const context = canvas.getContext('2d'); let frame = 0;
                    window.videoTimer = setInterval(() => {
                        context.fillStyle = '#e8f4f9'; context.fillRect(0, 0, 640, 480);
                        context.fillStyle = '#159fd6'; context.fillRect((frame++ * 4) % 500, 180, 100, 100);
                    }, 33);
                    window.testStream = canvas.captureStream(30);
                    return testStream;
                };
            })()`);
            let {window, evaluate} = await open();
            const firstId = window.webContents.id;
            manager.open();
            assert.strictEqual(manager.window.webContents.id, firstId, 'duplicate clicks reuse one native window');
            assert.strictEqual(window.getParentWindow(), null);
            window.setPosition(450, 50);
            assert.ok(window.getBounds().x > main.getBounds().x + main.getBounds().width,
                'camera is not clipped to main window bounds');
            assert.strictEqual(await evaluate(`Boolean(lab.vision)`), false, 'opening never initializes models');
            assert.strictEqual(await evaluate(`document.querySelectorAll('details, .blocklySvg').length`), 0);
            assert.strictEqual(await evaluate(`document.body.textContent.includes('拔线测试')`), false);
            const messages = require('../src/common/est-camera-messages.json');
            const setLocale = async locale => {
                manager.setLocale(locale);
                await until(() => evaluate(`lab.state.locale === ${JSON.stringify(locale)}`));
                assert.strictEqual(window.getTitle(), 'EST Studio - ' + messages[locale]['camera.title']);
            };
            for (const locale of Object.keys(messages)) {
                await setLocale(locale);
                await evaluate(`lab.setState({loading: true, modelLoading: true,
                    modelProgress: {kind: 'hands', stage: 'warmup'}, publisher: 'camera.status.multi',
                    error: 'camera.error.denied',
                    result: {hands: {left: {label: '点赞'}, right: {label: '张开手掌'}},
                        pose: {label: '举起双手'}, face: ['微笑', '眨眼', '张嘴']}})`);
                for (const size of [[500, 660], [380, 480], [800, 700]]) {
                    window.setSize(...size);
                    await pause(100);
                    const layout = await evaluate(`(() => {
                        const body = document.querySelector('[class*="body"]');
                        return {width: body.clientWidth, scroll: body.scrollWidth,
                            text: document.body.innerText,
                            switches: Array.from(document.querySelectorAll('input[role="switch"]'))
                                .map(input => input.getAttribute('aria-label'))};
                    })()`);
                    assert.ok(layout.scroll <= layout.width + 1, `${locale} ${size}: horizontal overflow`);
                    for (const key of ['camera.title', 'camera.loading', 'camera.wait', 'camera.error.denied',
                        'vision.thumb', 'vision.palm', 'vision.pose.bothUp', 'vision.face.smile', 'camera.status.multi']) {
                        assert.ok(layout.text.includes(messages[locale][key]), `${locale}: missing ${key}`);
                    }
                    if (['en', 'pt-br', 'ru'].includes(locale)) assert.ok(!/[\u3400-\u9fff]/.test(layout.text));
                    assert.ok(layout.switches.every(label => !label.includes('{')));
                    await capture(window, `localized-${locale}-${size[0]}`);
                }
            }
            await setLocale('zh-cn');
            window.setSize(500, 660);
            await evaluate(`lab.setState({loading: false, modelLoading: false, modelProgress: '', error: '', publisher: ''})`);
            await installVideo(evaluate);
            await evaluate(`for (const kind of ['right','pose','face']) document.querySelector('input[data-target="'+kind+'"]').click();
                document.querySelector('[class*="toolbar"] button').click();`);
            await pause(150);
            assert.ok(await evaluate(`document.querySelector('[class*="loadingStatus"]').textContent.includes('预热')`));
            assert.strictEqual(await evaluate('mediaRequests'), 0, 'models prepare before acquiring camera');
            assert.strictEqual(await main.webContents.executeJavaScript('1 + 1'), 2, 'main window stays responsive during warmup');
            await capture(window, 'model-loading');
            await until(() => samples.some(sample => sample.classId === 1101));
            assert.deepStrictEqual(await evaluate('requestedModels[0]'), {hands: true, pose: false, face: false});
            assert.strictEqual(starts, 1, 'start recognition automatically acquires the EST publisher');
            state = {...state, paused: true};
            const beforePaused = samples.length;
            await pause(350);
            assert.strictEqual(samples.length, beforePaused, 'download pause drops vision frames');
            state = {...state, paused: false};
            await until(() => samples.length > beforePaused);
            await capture(window, 'camera-running');
            const tokenBeforeLocale = source.generation;
            const sampleCount = samples.length;
            for (const locale of ['pt-br', 'ru', 'zh-tw', 'en', 'zh-cn']) {
                await setLocale(locale);
                await pause(550);
                await capture(window, `camera-running-${locale}`);
            }
            await until(() => samples.length > sampleCount);
            assert.strictEqual(starts, 1, 'language changes must not restart recognition or acquire another publisher');
            assert.strictEqual(source.generation, tokenBeforeLocale, 'language changes preserve the publisher lease');
            await evaluate(`document.querySelector('[class*="toolbar"] button').click()`);
            await until(() => source.owner === null);
            assert.strictEqual(await evaluate(`testStream.getTracks().every(track => track.readyState === 'ended')`), true);
            await evaluate(`clearInterval(videoTimer); document.querySelector('input[aria-label="识别右手"]').click();
                document.querySelector('[class*="toolbar"] button').click();`);
            await until(() => evaluate('lab.state.running'));
            await pause(350);
            assert.strictEqual(starts, 1, 'multi-selection must not overwrite the legacy single slot');
            assert.strictEqual(await evaluate('lab.state.publisher'), 'camera.status.multi');
            state = {...state, multiSupported: true};
            await until(() => source.owner !== null && frames.length > 0);
            assert.strictEqual(starts, 2, 'schema-2 firmware accepts the multi-target publisher');
            assert.deepStrictEqual(frames[frames.length - 1].enabled,
                {left: true, right: true, pose: false, face: false});
            await evaluate(`document.querySelector('[class*="toolbar"] button').click(); clearInterval(videoTimer);
                document.querySelector('input[aria-label="识别右手"]').click();
                document.querySelector('[class*="toolbar"] button').click();`);
            await until(() => source.owner !== null);
            window.close();
            await until(() => manager.window === null);
            assert.strictEqual(source.owner, null, 'native close clears the publisher immediately');
            assert.strictEqual(clears[clears.length - 1], 2);
            ({window, evaluate} = await open());
            assert.notStrictEqual(window.webContents.id, firstId);
            assert.strictEqual(await evaluate('lab.state.running'), false, 'reopening never resumes capture');
            await installVideo(evaluate);
            await evaluate(`document.querySelector('[class*="toolbar"] button').click()`);
            await pause(100);
            window.close();
            await until(() => manager.window === null);
            assert.strictEqual(source.owner, null, 'closing during warmup cannot later start a publisher');
            console.log('Independent camera window, model prompt, auto-send, pause, multi-target gate and native close passed.');
            console.log('Screenshots: ' + output);
            clearTimeout(timeout);
            main.destroy();
            app.exit(0);
        } catch (error) {
            console.error(error);
            manager.close();
            if (main && !main.isDestroyed()) main.destroy();
            clearTimeout(timeout);
            app.exit(1);
        }
    });
}
