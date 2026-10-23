const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const path = require('path');
const babel = require('@babel/core');
const root = path.resolve(__dirname, '../src/renderer/est-vision');
const originalLoader = Module._extensions['.js'];
Module._extensions['.js'] = (module, filename) => {
    if (!filename.startsWith(root + path.sep)) return originalLoader(module, filename);
    module._compile(babel.transformSync(fs.readFileSync(filename, 'utf8'), {
        babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs']
    }).code, filename);
};
const {separateHands, summarizeIndependentResults, createHandStabilizer} = require(path.join(root, 'hand-results'));
const {IndependentVision} = require(path.join(root, 'independent-vision'));
const {mapGestureSample} = require(path.join(root, 'gesture-sample'));
const {mapVisualFrame, mapVisualSample} = require(path.join(root, 'visual-sample'));
const {FACE_ACTIONS, POSE_ACTIONS} = require(path.join(root, 'visual-classes'));
const cameraModule = {exports: {}};
new Function('exports', 'module', babel.transformSync(fs.readFileSync(path.resolve(
    __dirname, '../src/main/est/vision-camera-source.js'), 'utf8'), {
    babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs']
}).code)(cameraModule.exports, cameraModule);
const {VisionCameraSource} = cameraModule.exports;
const box = Array.from({length: 21}, (_, i) => ({x: i % 2 ? 0.4 : 0.2, y: i % 2 ? 0.55 : 0.25}));
const gestureNames = ['张开手掌', '握拳', '点赞', '食指指向', '胜利手势', '其他手势'];
for (const side of ['left', 'right']) {
    gestureNames.forEach((label, index) => {
        const sample = mapGestureSample({[side]: {detected: true, landmarks: box, label}}, side, 100, 200);
        assert.strictEqual(sample.classId, (side === 'left' ? 1101 : 1201) + index);
        assert.deepStrictEqual([sample.centerX, sample.centerY, sample.width, sample.height], [7000, 4000, 2000, 3000]);
        assert.strictEqual(sample.confidencePermille, 0);
    });
}
assert.strictEqual(mapGestureSample({}, 'right', 0, 201), null);
assert.strictEqual(mapGestureSample({}, 'right', 100, 50), null);
assert.strictEqual(mapGestureSample({left: {detected: true, landmarks: box}}, 'right', 0, 0), null);
for (const landmarks of [box.map(() => ({x: 0, y: 0})), box.map(() => ({x: NaN, y: 0}))]) {
    assert.strictEqual(mapGestureSample({right: {detected: true, landmarks}}, 'right', 0, 0), null);
}
let publisherState = {connected: true, supported: true, paused: false};
const facePoints = Array.from({length: 468}, (_, i) => ({...box[i % box.length]}));
const posePoints = Array.from({length: 33}, (_, i) => ({...box[i % box.length], visibility: 1}));
for (let mask = 0; mask < 8; mask++) {
    const face = mask === 0 ? ['自然'] : FACE_ACTIONS.filter(action => action.mask & mask).map(action => action.label);
    const sample = mapVisualSample({face}, {face: facePoints}, 'face', 100, 200);
    assert.strictEqual(sample.classId, 2100 + mask);
    assert.strictEqual(sample.confidencePermille, 0);
    assert.deepStrictEqual([sample.centerX, sample.centerY, sample.width, sample.height], [7000, 4000, 2000, 3000]);
}
POSE_ACTIONS.forEach(action => {
    assert.strictEqual(mapVisualSample({pose: {label: action.label}}, {pose: posePoints},
        'pose', 100, 200).classId, action.classId);
});
assert.strictEqual(mapVisualSample({face: ['未检测']}, {face: facePoints}, 'face', 100, 200), null);
assert.strictEqual(mapVisualSample({face: ['微笑']}, {}, 'face', 100, 200), null);
assert.strictEqual(mapVisualSample({face: ['微笑']}, {face: facePoints}, 'face', 100, 301), null);
assert.strictEqual(mapVisualSample({face: ['微笑']}, {face: facePoints}, 'face', 100, 99), null);
assert.strictEqual(mapVisualSample({pose: {label: '未检测'}}, {pose: posePoints}, 'pose', 100, 200), null);
assert.strictEqual(mapVisualSample({pose: {label: '站立'}}, {pose: posePoints.map(point =>
    ({...point, visibility: 0.1}))}, 'pose', 100, 200), null);
assert.strictEqual(mapVisualSample({face: ['自然']}, {face: facePoints.map(point =>
    ({...point, x: NaN}))}, 'face', 100, 200), null);
assert.throws(() => mapVisualSample({}, {}, 'invalid', 100, 200), /Invalid vision target/);
const mappedFrame = mapVisualFrame({
    hands: {
        left: {detected: true, landmarks: box, label: '张开手掌'},
        right: {detected: true, landmarks: box, label: '握拳'}
    },
    face: ['自然'],
    pose: {label: '站立'}
}, {face: facePoints, pose: posePoints}, {
    left: true, right: true, pose: true, face: true
}, 100, 200);
assert.deepStrictEqual(Object.keys(mappedFrame.targets), ['left', 'right', 'pose', 'face']);
assert.deepStrictEqual([
    mappedFrame.targets.left.classId,
    mappedFrame.targets.right.classId,
    mappedFrame.targets.pose.classId,
    mappedFrame.targets.face.classId
], [1101, 1202, 3101, 2100]);
assert.deepStrictEqual(mappedFrame.enabled, {left: true, right: true, pose: true, face: true});
const cameraCalls = [];
const cameraSource = new VisionCameraSource({
    getVisionPublisherState: () => publisherState,
    clearVision: reason => cameraCalls.push(['clear', reason]),
    updateVisionSample: sample => cameraCalls.push(['sample', sample]),
    updateVisionFrame: frame => cameraCalls.push(['frame', frame])
}, {stop: () => cameraCalls.push(['simulator-stop'])});
assert.throws(() => cameraSource.start(7, {targets: ['left', 'right']}), /1\.31/);
const token = cameraSource.start(7);
assert.throws(() => cameraSource.requireAvailable());
assert.throws(() => cameraSource.frame(8, token, {}));
cameraSource.frame(7, token, null);
assert.deepStrictEqual(cameraCalls.slice(0, 3), [['simulator-stop'], ['clear', 0], ['clear', 1]]);
cameraSource.stop(8, token);
assert.strictEqual(cameraSource.owner, 7);
publisherState = {...publisherState, paused: true};
const beforePause = cameraCalls.length;
cameraSource.frame(7, token, {classId: 1201});
cameraSource.frame(7, token, {classId: 1203});
assert.strictEqual(cameraSource.owner, 7);
assert.deepStrictEqual(cameraCalls.slice(beforePause), [['clear', 2]]);
publisherState = {...publisherState, paused: false};
cameraSource.frame(7, token, {classId: 1202});
assert.deepStrictEqual(cameraCalls[cameraCalls.length - 1], ['sample', {classId: 1202}]);
publisherState = {...publisherState, connected: false};
assert.throws(() => cameraSource.frame(7, token, {}));
assert.strictEqual(cameraSource.owner, null);
cameraSource.requireAvailable();
assert.throws(() => cameraSource.frame(7, token, {}));
assert.throws(() => cameraSource.start(7));

const multiCalls = [];
const multiSource = new VisionCameraSource({
    getVisionPublisherState: () => ({connected: true, supported: true, multiSupported: true, paused: false}),
    clearVision: reason => multiCalls.push(['clear', reason]),
    updateVisionFrame: frame => multiCalls.push(['frame', frame])
}, {stop: () => multiCalls.push(['simulator-stop'])});
const multiToken = multiSource.start(9, {targets: ['left', 'right', 'pose', 'face']});
multiSource.frame(9, multiToken, mappedFrame);
assert.deepStrictEqual(multiCalls[2], ['frame', mappedFrame]);
multiSource.stop(9, multiToken);

const palm = Array.from({length: 21}, () => ({x: 0.5, y: 0.7}));
palm[0] = {x: 0.5, y: 0.9};
[8, 12, 16, 20].forEach(index => { palm[index] = {x: 0.5, y: 0.2}; });
const handOnly = {multiHandLandmarks: [palm], multiHandedness: [{label: 'Right', score: 0.95}]};
assert.strictEqual(separateHands(handOnly).left.label, '张开手掌');
assert.strictEqual(separateHands(handOnly, true).right.label, '张开手掌');
const summary = summarizeIndependentResults({hands: handOnly, pose: {}, face: {}});
assert.strictEqual(summary.hands.left.detected, true);
assert.strictEqual(summary.pose.label, '未检测');
assert.deepStrictEqual(summary.face, ['未检测']);
const both = separateHands({
    multiHandLandmarks: [palm, palm],
    multiHandedness: [{label: 'Right', score: 0.95}, {label: 'Left', score: 0.94}]
});
assert.ok(both.left.detected && both.right.detected);
const stabilize = createHandStabilizer();
for (let i = 0; i < 5; i++) stabilize.push(both);
const gone = stabilize.push(separateHands(handOnly));
assert.strictEqual(gone.right.detected, false);
assert.strictEqual(gone.right.label, '未检测');
assert.strictEqual(gone.left.label, '张开手掌');
assert.strictEqual(stabilize.push(separateHands()).left.detected, false);
const other = Object.assign({}, both.right, {label: '其他手势'});
const independent = createHandStabilizer();
for (let i = 0; i < 5; i++) independent.push({left: both.left, right: other});
const independentlyStable = independent.push(both);
assert.strictEqual(independentlyStable.left.label, '张开手掌');
assert.strictEqual(independentlyStable.right.label, '其他手势');
assert.strictEqual(independent.push(separateHands()).right.detected, false);
assert.strictEqual(independent.push(both).right.label, '张开手掌', 'departure clears old gesture votes');
assert.strictEqual(separateHands({multiHandLandmarks: [palm]}).left.detected, false);
assert.strictEqual(separateHands({multiHandLandmarks: [palm],
    multiHandedness: [{label: 'Right', score: 0.3}]}).left.detected, false);
const assetTransform = require('./est-vision-assets');
for (const kind of ['hands', 'pose', 'face_mesh']) {
    const directory = path.resolve(__dirname, '../node_modules/@mediapipe', kind);
    for (const name of fs.readdirSync(directory).filter(file => file.endsWith('.js'))) {
        const source = assetTransform(fs.readFileSync(path.join(directory, name)), name).toString();
        assert.ok(!source.includes('createMediapipeSolutions'), `${name}: factory must be isolated`);
        if (name.endsWith('_loader.js') || name.endsWith('_bin.js')) {
            assert.ok(source.includes("typeof window === 'undefined' &&"), `${name}: Electron URL loading`);
        }
    }
}

global.document = {createElement: () => ({}), baseURI: 'file:///test/index.html'};
global.window = {};
const calls = [];
let blockNext = false;
let release;
const pipeline = new IndependentVision({createModel: spec => {
    let listener;
    return {
        setOptions: () => {},
        onResults: callback => { listener = callback; },
        initialize: async () => {},
        send: async () => {
            calls.push(spec.kind);
            if (blockNext) {
                blockNext = false;
                await new Promise(resolve => { release = resolve; });
            }
            listener(spec.kind === 'hands' ? handOnly : {});
        },
        close: async () => { calls.push(`close:${spec.kind}`); }
    };
}});
(async () => {
    const savedModule = {exports: {}};
    const savedCode = babel.transformSync(fs.readFileSync(path.resolve(__dirname,
        '../src/main/est/vision-saved-test.js'), 'utf8'), {
        babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs']
    }).code;
    new Function('exports', 'module', 'require', savedCode)(savedModule.exports, savedModule,
        name => name === './protocol' ? {buildPersistentProgramStatusFrame: slot => slot, crc32: () => 123} :
            {PERSISTENT_PROGRAM_SLOT_COUNT: 8, PYTHON_PROGRAM_NO_TIMEOUT_MS: 0});
    const storageCalls = [];
    const slotStates = Array.from({length: 8}, (_, slot) => ({programSlotId: slot,
        state: slot === 6 ? 2 : 3, flags: slot === 6 ? 0x10 : 0x30, sourceLength: slot === 6 ? 0 : 12}));
    const storage = {
        _persistentProgramActionNow: async slot => slotStates[slot],
        _requirePersistentProgramSuccess: () => {},
        _saveProgramToSlotNow: async (source, slot) => { storageCalls.push(['save', slot]); },
        _loadAndRunProgramNow: async slot => { storageCalls.push(['load-run', slot]); return {}; }
    };
    assert.strictEqual((await savedModule.exports.runSavedVisionTest(storage, 'test')).slot, 6);
    assert.deepStrictEqual(storageCalls, [['save', 6], ['load-run', 6]]);
    slotStates[6] = {...slotStates[6], state: 3, flags: 0x30, sourceLength: 4,
        programName: 'EST Vision USB Test', sourceCrc32: 123};
    storageCalls.length = 0;
    assert.strictEqual((await savedModule.exports.runSavedVisionTest(storage, 'test')).reused, true);
    assert.deepStrictEqual(storageCalls, [['load-run', 6]]);
    slotStates[6].sourceCrc32 = 124;
    storageCalls.length = 0;
    await assert.rejects(() => savedModule.exports.runSavedVisionTest(storage, 'test'), /没有可用空槽/);
    assert.deepStrictEqual(storageCalls, []);
    assert.strictEqual((await savedModule.exports.runSavedVisionTest(storage, 'test', 6)).slot, 6);
    assert.deepStrictEqual(storageCalls, [['save', 6], ['load-run', 6]]);
    await assert.rejects(() => savedModule.exports.runSavedVisionTest(storage, 'test', 8), /无效/);
    const labSource = fs.readFileSync(path.resolve(__dirname, '../src/renderer/EstVisionLab.jsx'), 'utf8');
    assert.ok(!labSource.includes('startReadbackTest'));
    assert.ok(!labSource.includes('offlineTest'));
    publisherState = {connected: true, supported: true, paused: false};
    const nextToken = cameraSource.start(7);
    assert.notStrictEqual(nextToken, token);
    assert.throws(() => cameraSource.frame(7, token, {}));
    cameraSource.frame(7, nextToken, null);
    const countBeforeEmpty = cameraCalls.length;
    cameraSource.frame(7, nextToken, null);
    assert.strictEqual(cameraCalls.length, countBeforeEmpty, 'unchanged no-target must not flood CLEAR');
    await new Promise(resolve => setTimeout(resolve, 350));
    assert.strictEqual(cameraSource.owner, null, 'lost renderer releases the camera lease');
    assert.deepStrictEqual(cameraCalls[cameraCalls.length - 1], ['clear', 2]);
    await pipeline.initialize();
    calls.length = 0;
    const result = await pipeline.process({});
    assert.deepStrictEqual(calls, ['hands', 'pose', 'face_mesh']);
    assert.strictEqual(result.hands.multiHandLandmarks.length, 1);
    calls.length = 0;
    const handsOnly = await pipeline.process({}, {hands: true, pose: false, face: false});
    assert.deepStrictEqual(calls, ['hands'], 'two hand switches share one hand inference');
    assert.deepStrictEqual(handsOnly.pose, {});
    assert.deepStrictEqual(handsOnly.face, {});
    calls.length = 0;
    const noHands = await pipeline.process({}, {hands: false, pose: true, face: true});
    assert.deepStrictEqual(calls, ['pose', 'face_mesh']);
    assert.deepStrictEqual(noHands.hands, {});
    calls.length = 0;
    const disabled = await pipeline.process({}, {hands: false, pose: false, face: false});
    assert.deepStrictEqual(calls, [], 'disabled recognition cannot keep running inference');
    assert.deepStrictEqual(disabled, {hands: {}, pose: {}, face: {}, timings: {}});
    blockNext = true;
    const pending = pipeline.process({});
    await Promise.resolve();
    assert.strictEqual(await pipeline.process({}), null, 'busy frames must be dropped, not queued');
    const closing = pipeline.close();
    release();
    assert.strictEqual(await pending, null, 'closing invalidates in-flight results');
    await closing;
    assert.strictEqual(calls.filter(value => value.startsWith('close:')).length, 3);
    assert.strictEqual(await pipeline.process({}), null);
    const selectedCalls = [], progress = [];
    const selected = new IndependentVision({onProgress: event => progress.push(event), createModel: spec => {
        selectedCalls.push(spec.kind);
        return {setOptions: () => {}, onResults: () => {}, initialize: async () => {},
            send: async () => {}, close: async () => {}};
    }});
    await selected.initialize({hands: true, pose: false, face: false});
    assert.deepStrictEqual(selectedCalls, ['hands'], 'only selected model is loaded and warmed');
    assert.deepStrictEqual(progress.map(event => event.stage), ['load', 'initialize', 'warmup']);
    await selected.initialize({hands: true, pose: false, face: false});
    assert.strictEqual(selectedCalls.length, 1, 'restarting within the window reuses prepared model');
    await selected.initialize({hands: true, pose: true, face: false});
    assert.deepStrictEqual(selectedCalls, ['hands', 'pose'], 'later selection loads only missing model');
    await selected.close();
    console.log('Independent vision tests passed: hand-only, no face, two hands, departure, no backlog, close.');
})().catch(error => { console.error(error); process.exitCode = 1; });
