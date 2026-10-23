const {app, BrowserWindow} = require('electron');
const path = require('path');
const {pathToFileURL} = require('url');

app.setPath('userData', path.join(app.getPath('temp'), 'est-holistic-smoke'));
const timeout = setTimeout(() => {
    console.error('Holistic first-frame test timed out');
    app.exit(1);
}, 90000);

app.whenReady().then(async () => {
    const window = new BrowserWindow({
        show: false,
        webPreferences: {nodeIntegration: true, contextIsolation: false, backgroundThrottling: false}
    });
    const base = pathToFileURL(path.resolve(__dirname, '../dist/renderer/static/mediapipe-holistic/')).href + '/';
    await window.loadFile(path.join(__dirname, 'holistic-smoke.html'));
    const result = await window.webContents.executeJavaScript(`(async () => {
        const base = ${JSON.stringify(base)};
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = base + 'holistic.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
        const model = new window.Holistic({locateFile: file => base + file});
        model.setOptions({modelComplexity: 0, refineFaceLandmarks: false, enableSegmentation: false});
        let frames = 0;
        model.onResults(() => { frames++; });
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const started = performance.now();
        await model.initialize();
        const initialized = performance.now();
        await model.send({image: canvas});
        const firstFrame = performance.now();
        await model.send({image: canvas});
        const secondFrame = performance.now();
        let cameraStats = null;
        if (${JSON.stringify(process.argv.includes('--camera'))}) {
            const stream = await navigator.mediaDevices.getUserMedia({video: {
                width: {ideal: 640}, height: {ideal: 480}, frameRate: {ideal: 30}
            }, audio: false});
            try {
                const video = document.createElement('video');
                video.muted = true;
                video.srcObject = stream;
                await video.play();
                const timings = [];
                const cameraStarted = performance.now();
                for (let i = 0; i < 90; i++) {
                    await new Promise(resolve => video.requestVideoFrameCallback(resolve));
                    const before = performance.now();
                    await model.send({image: video});
                    timings.push(performance.now() - before);
                }
                const steady = timings.slice(10).sort((a, b) => a - b);
                cameraStats = {
                    frames: timings.length,
                    fps: Math.round(900000 / (performance.now() - cameraStarted)) / 10,
                    meanMs: Math.round(steady.reduce((sum, ms) => sum + ms, 0) / steady.length),
                    p95Ms: Math.round(steady[Math.floor(steady.length * 0.95)]),
                    cameraFrameRate: stream.getVideoTracks()[0].getSettings().frameRate
                };
            } finally {
                stream.getTracks().forEach(track => track.stop());
            }
        }
        await model.close();
        return {
            frames, cameraStats,
            initializationMs: Math.round(initialized - started),
            firstFrameMs: Math.round(firstFrame - initialized),
            secondFrameMs: Math.round(secondFrame - firstFrame)
        };
    })()`);
    if (result.frames !== (process.argv.includes('--camera') ? 92 : 2)) {
        throw new Error(`Unexpected completed frames: ${JSON.stringify(result)}`);
    }
    console.log('Electron Holistic offline first-frame test passed:', result);
    clearTimeout(timeout);
    app.exit(0);
}).catch(error => {
    console.error(error);
    clearTimeout(timeout);
    app.exit(1);
});
