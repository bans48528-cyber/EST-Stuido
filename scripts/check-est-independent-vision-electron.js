const {app, BrowserWindow, ipcMain} = require('electron');
const path = require('path');
const fs = require('fs');
const babel = require('@babel/core');
const {pathToFileURL} = require('url');
const guided = process.argv.includes('--guided');
const visible = guided || process.argv.includes('--visible');
const genericImage = process.argv.includes('--image');
const referenceIndex = process.argv.indexOf(genericImage ? '--image' : '--reference');
const referenceUrl = referenceIndex >= 0 ? pathToFileURL(path.resolve(process.argv[referenceIndex + 1])).href : null;

app.setPath('userData', path.join(app.getPath('temp'), 'est-independent-vision-smoke'));
let timeout = setTimeout(() => {
    console.error('Independent vision test timed out');
    app.exit(1);
}, guided ? 240000 : 120000);

app.whenReady().then(async () => {
    const window = new BrowserWindow({show: visible, width: 1160, height: 820, webPreferences: {
        nodeIntegration: true, contextIsolation: false, backgroundThrottling: false
    }});
    ipcMain.on('est-vision-test-ready', event => {
        if (event.sender === window.webContents && guided) clearTimeout(timeout);
    });
    ipcMain.on('est-vision-test-started', event => {
        if (event.sender !== window.webContents || !guided) return;
        timeout = setTimeout(() => { console.error('Camera sampling timed out'); app.exit(1); }, 120000);
    });
    window.webContents.on('console-message', (event, level, message) => {
        if (level >= 3) console.error(message);
    });
    await window.loadFile(path.join(__dirname, visible ? 'vision-guided.html' : 'holistic-smoke.html'));
    const source = babel.transformSync(fs.readFileSync(path.join(
        __dirname, '../src/renderer/est-vision/independent-vision.js'
    ), 'utf8'), {babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs']}).code;
    const baseUrl = pathToFileURL(path.resolve(__dirname, '../dist/renderer/static')).href + '/';
    const recognitionSources = {};
    for (const name of ['holistic-recognition', 'hand-results']) {
        recognitionSources['./' + name] = babel.transformSync(fs.readFileSync(path.join(
            __dirname, '../src/renderer/est-vision', name + '.js'
        ), 'utf8'), {babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs']}).code;
    }
    const result = await window.webContents.executeJavaScript(`(async () => {
        const sources = ${JSON.stringify(recognitionSources)};
        const cache = {};
        const loadRecognition = name => {
            if (!cache[name]) {
                const loaded = {exports: {}};
                new Function('exports', 'module', 'require', sources[name])(
                    loaded.exports, loaded, loadRecognition);
                cache[name] = loaded.exports;
            }
            return cache[name];
        };
        const {separateHands, createHandStabilizer} = loadRecognition('./hand-results');
        const module = {exports: {}};
        new Function('exports', 'module', ${JSON.stringify(source)})(module.exports, module);
        const model = new module.exports.IndependentVision({baseUrl: ${JSON.stringify(baseUrl)}});
        const start = performance.now();
        await model.initialize();
        const initializationMs = Math.round(performance.now() - start);
        let stream;
        let video;
        let frameRequest;
        let resolveFrame;
        const nextFrame = () => new Promise(resolve => { resolveFrame = resolve; });
        try {
            const image = document.createElement('canvas');
            image.width = 640; image.height = 480;
            if (${JSON.stringify(referenceUrl)}) {
                const reference = new Image();
                reference.src = ${JSON.stringify(referenceUrl)};
                await reference.decode();
                // Regions in the user-supplied 1622x932 Studio screenshot. No image is saved.
                if (!${JSON.stringify(genericImage)} && (reference.width !== 1622 || reference.height !== 932)) {
                    throw new Error('Reference dimensions changed');
                }
                const reports = [];
                const scenes = ${JSON.stringify(genericImage)} ? ['test-image', 'hands-departed'] :
                    ['hand-only', 'face-covered', 'two-hands', 'mirrored-hand-pair', 'hands-departed'];
                for (const scene of scenes) {
                    const context = image.getContext('2d');
                    context.fillStyle = '#dddddd'; context.fillRect(0, 0, 640, 480);
                    if (scene === 'test-image') {
                        const scale = Math.min(640 / reference.width, 480 / reference.height);
                        context.drawImage(reference, (640 - reference.width * scale) / 2,
                            (480 - reference.height * scale) / 2, reference.width * scale, reference.height * scale);
                    }
                    if (scene === 'hand-only') context.drawImage(reference, 350, 250, 470, 650, 145, 0, 347, 480);
                    if (scene === 'mirrored-hand-pair') {
                        context.drawImage(reference, 350, 250, 470, 650, 30, 40, 270, 373);
                        context.save(); context.translate(640, 0); context.scale(-1, 1);
                        context.drawImage(reference, 350, 250, 470, 650, 30, 40, 270, 373);
                        context.restore();
                    }
                    if (scene === 'face-covered' || scene === 'two-hands') {
                        context.drawImage(reference, 26, 181, 958, 719, 0, 0, 640, 480);
                        if (scene === 'face-covered') context.fillRect(0, 0, 205, 480);
                    }
                    let handFrames = 0, twoHands = 0, faceFrames = 0, poseFrames = 0;
                    const sides = new Set();
                    for (let i = 0; i < 15; i++) {
                        let frame;
                        if (${JSON.stringify(process.argv.includes('--hands-only'))}) {
                            frame = {hands: {}, pose: {}, face: {}};
                            model.models.hands.onResults(value => { frame.hands = value; });
                            await model.models.hands.send({image});
                        } else {
                            frame = await model.process(image);
                        }
                        const hands = frame.hands.multiHandLandmarks || [];
                        handFrames += Number(hands.length > 0);
                        twoHands += Number(hands.length === 2);
                        faceFrames += Number((frame.face.multiFaceLandmarks || []).length > 0);
                        poseFrames += Number(Boolean(frame.pose.poseLandmarks));
                        (frame.hands.multiHandedness || []).forEach(item => sides.add(item.label));
                    }
                    reports.push({scene, frames: 15, handFrames, twoHands, faceFrames, poseFrames, modelSides: [...sides]});
                }
                return {initializationMs, testType: 'still image replay, not live camera', reports};
            }
            if (${JSON.stringify(process.argv.includes('--camera') || guided)}) {
                stream = await navigator.mediaDevices.getUserMedia({audio: false, video: {
                    width: {ideal: 640}, height: {ideal: 480}, frameRate: {ideal: 30}
                }});
                video = document.getElementById('video') || document.createElement('video');
                video.muted = true; video.srcObject = stream;
                await video.play();
                const pump = (timestamp, metadata) => {
                    frameRequest = video.requestVideoFrameCallback(pump);
                    const resolve = resolveFrame;
                    resolveFrame = null;
                    if (resolve) resolve(metadata);
                };
                frameRequest = video.requestVideoFrameCallback(pump);
            }
            if (${JSON.stringify(guided)}) {
                const stage = document.getElementById('stage');
                const live = document.getElementById('live');
                const button = document.getElementById('begin');
                const output = document.getElementById('results');
                const overlay = document.getElementById('overlay');
                overlay.width = 640; overlay.height = 480;
                stage.textContent = '准备好后，点击“开始四项测试”';
                button.disabled = false;
                require('electron').ipcRenderer.send('est-vision-test-ready');
                await new Promise(resolve => { button.onclick = resolve; });
                require('electron').ipcRenderer.send('est-vision-test-started');
                button.disabled = true;
                const reports = [];
                const stabilizer = createHandStabilizer();
                const removed = document.getElementById('removed');
                for (const scene of ['仅手掌入镜：脸和身体移出画面', '遮住人脸：保持一只手掌可见',
                    '双手入镜：同时展开左右手', '手离开画面：移走两只手']) {
                    const sceneStart = performance.now();
                    const trace = [];
                    let removedAtMs = null;
                    removed.disabled = !scene.startsWith('手离开');
                    removed.onclick = () => {
                        removedAtMs = performance.now() - sceneStart;
                        removed.disabled = true;
                    };
                    const prepEnd = performance.now() + 7000;
                    const end = prepEnd + 7000;
                    let frames = 0, handFrames = 0, twoHands = 0, faceFrames = 0, poseFrames = 0;
                    let leftFrames = 0, rightFrames = 0, palmFrames = 0, elapsedMs = 0;
                    let captureFrames = 0, firstCapture = null;
                    while (performance.now() < end) {
                        const metadata = await nextFrame();
                        const now = performance.now();
                        const measuring = now >= prepEnd;
                        stage.textContent = scene + (measuring ? ' ｜统计中 ' : ' ｜准备 ') +
                            Math.max(0, Math.ceil(((measuring ? end : prepEnd) - now) / 1000)) + ' 秒';
                        image.getContext('2d').drawImage(video, 0, 0, 640, 480);
                        const frame = await model.process(image);
                        const raw = separateHands(frame.hands);
                        const stable = stabilizer.push(raw);
                        const atMs = Math.round(performance.now() - sceneStart);
                        trace.push({atMs, measuring, inferenceMs: Math.round(performance.now() - now),
                            rawCount: (frame.hands.multiHandLandmarks || []).length,
                            hands: ['left', 'right'].map(side => ({side, detected: raw[side].detected,
                                rawGesture: raw[side].label, stableGesture: stable[side].label,
                                handednessScore: raw[side].handednessScore}))});
                        const hands = frame.hands.multiHandLandmarks || [];
                        const sides = (frame.hands.multiHandedness || []).map(item => item.label === 'Left' ? '右手' : '左手');
                        live.textContent = ['left', 'right'].map(side =>
                            (side === 'left' ? '左手：' : '右手：') + stable[side].label +
                            (raw[side].detected ? '（左右分类分数 ' + raw[side].handednessScore.toFixed(2) + '）' : '')
                        ).join('；');
                        const context = overlay.getContext('2d');
                        context.clearRect(0, 0, 640, 480);
                        context.fillStyle = '#00db8d';
                        hands.forEach(points => points.forEach(point => {
                            context.beginPath(); context.arc(point.x * 640, point.y * 480, 3, 0, Math.PI * 2); context.fill();
                        }));
                        if (measuring) {
                            frames++;
                            handFrames += Number(hands.length > 0);
                            twoHands += Number(hands.length === 2);
                            leftFrames += Number(sides.includes('左手'));
                            rightFrames += Number(sides.includes('右手'));
                            palmFrames += Number(['left', 'right'].some(side => raw[side].label === '张开手掌'));
                            faceFrames += Number((frame.face.multiFaceLandmarks || []).length > 0);
                            poseFrames += Number(Boolean(frame.pose.poseLandmarks));
                            if (firstCapture === null) firstCapture = metadata.presentedFrames;
                            captureFrames = metadata.presentedFrames - firstCapture;
                            elapsedMs = performance.now() - prepEnd;
                        }
                    }
                    reports.push({scene, frames, fps: Math.round(frames * 10000 / elapsedMs) / 10,
                        captureFps: Math.round(captureFrames * 10000 / elapsedMs) / 10,
                        handFrames, twoHands, leftFrames, rightFrames, palmFrames, faceFrames, poseFrames,
                        removedAtMs, trace});
                    output.textContent = reports.map(item => item.scene.split('：')[0] + ': ' + item.fps +
                        ' FPS，手 ' + item.handFrames + '/' + item.frames).join('\\n');
                }
                stage.textContent = '四项采样完成，正在生成报告';
                return {initializationMs, traceVersion: 2,
                    departureNote: 'removedAtMs is a user marker, not a measured physical departure time; traces include preparation.',
                    reports};
            }
            const count = video ? 150 : 3;
            if (document.getElementById('stage')) document.getElementById('stage').textContent = '自动帧率采样中…';
            const timings = [];
            const observed = {hands: 0, twoHands: 0, pose: 0, face: 0};
            let firstPresented = null;
            let lastPresented = null;
            const measured = performance.now();
            for (let i = 0; i < count; i++) {
                if (video) {
                    const meta = await nextFrame();
                    if (firstPresented === null) firstPresented = meta.presentedFrames;
                    lastPresented = meta.presentedFrames;
                }
                const tick = performance.now();
                if (video && !${JSON.stringify(process.argv.includes('--capture-only'))}) {
                    image.getContext('2d').drawImage(video, 0, 0, 640, 480);
                }
                const frame = ${JSON.stringify(process.argv.includes('--capture-only'))} ?
                    {hands: {}, pose: {}, face: {}, timings: {hands: 0, pose: 0, face: 0}} :
                    await model.process(image);
                timings.push({total: performance.now() - tick, ...frame.timings});
                observed.hands += Number((frame.hands.multiHandLandmarks || []).length > 0);
                observed.twoHands += Number((frame.hands.multiHandLandmarks || []).length === 2);
                observed.pose += Number(Boolean(frame.pose.poseLandmarks));
                observed.face += Number((frame.face.multiFaceLandmarks || []).length > 0);
            }
            const elapsed = performance.now() - measured;
            const mean = key => Math.round(timings.reduce((sum, value) => sum + value[key], 0) / count);
            let reopenPassed = null;
            if (${JSON.stringify(process.argv.includes('--reopen'))}) {
                await model.close();
                const reopened = new module.exports.IndependentVision({baseUrl: ${JSON.stringify(baseUrl)}});
                try {
                    await reopened.initialize();
                    const frame = await reopened.process(image);
                    reopenPassed = Boolean(frame && frame.hands && frame.pose && frame.face);
                    if (!reopenPassed) throw new Error('No results after reopening models');
                } finally {
                    await reopened.close();
                }
            }
            return {initializationMs, cameraSettings: stream && stream.getVideoTracks()[0].getSettings(),
                reopenPassed,
                captureOnly: ${JSON.stringify(process.argv.includes('--capture-only'))},
                presentedFps: Math.round((lastPresented - firstPresented) * 10000 / elapsed) / 10,
                frames: count, fps: Math.round(count * 10000 / elapsed) / 10,
                meanMs: {total: mean('total'), hands: mean('hands'), pose: mean('pose'), face: mean('face')}, observed};
        } finally {
            if (video && frameRequest) video.cancelVideoFrameCallback(frameRequest);
            if (stream) stream.getTracks().forEach(track => track.stop());
            await model.close();
        }
    })()`);
    console.log(JSON.stringify(result, null, 2));
    if (guided) fs.writeFileSync(path.join(__dirname, '../dist/vision-guided-results.json'), JSON.stringify(result, null, 2));
    clearTimeout(timeout);
    app.exit(0);
}).catch(error => {
    console.error(error);
    clearTimeout(timeout);
    app.exit(1);
});
