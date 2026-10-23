const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const path = require('path');
const babel = require('@babel/core');

const recognitionPath = path.resolve(
    __dirname,
    '..',
    'src',
    'renderer',
    'est-vision',
    'holistic-recognition.js'
);
const originalLoader = Module._extensions['.js'];
Module._extensions['.js'] = (module, filename) => {
    if (filename !== recognitionPath) return originalLoader(module, filename);
    const transformed = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
        babelrc: false,
        plugins: ['@babel/plugin-transform-modules-commonjs']
    });
    module._compile(transformed.code, filename);
};

const {
    createHolisticResultStabilizer,
    recognizeFaceActions,
    recognizeHandGesture,
    recognizePose,
    summarizeHolisticResults
} = require(recognitionPath);

const points = count => Array.from({length: count}, () => ({x: 0.5, y: 0.5, visibility: 1}));
const openHand = points(21);
openHand[0] = {x: 0.5, y: 0.9};
[[6, 0.66], [8, 0.4], [10, 0.67], [12, 0.36], [14, 0.68], [16, 0.38], [18, 0.7], [20, 0.42]]
    .forEach(([index, y]) => {
        openHand[index] = {x: 0.5, y};
    });
assert.strictEqual(recognizeHandGesture(openHand).label, '张开手掌');

const pose = points(33);
pose[11] = {x: 0.42, y: 0.45, visibility: 1};
pose[12] = {x: 0.58, y: 0.45, visibility: 1};
pose[15] = {x: 0.4, y: 0.2, visibility: 1};
pose[16] = {x: 0.6, y: 0.2, visibility: 1};
pose[23] = {x: 0.45, y: 0.68, visibility: 1};
pose[24] = {x: 0.55, y: 0.68, visibility: 1};
pose[25] = {x: 0.45, y: 0.8, visibility: 1};
pose[26] = {x: 0.55, y: 0.8, visibility: 1};
pose[27] = {x: 0.45, y: 0.95, visibility: 1};
pose[28] = {x: 0.55, y: 0.95, visibility: 1};
assert.strictEqual(recognizePose(pose).label, '举起双手');
const hiddenBody = pose.map(point => ({...point, visibility: 0}));
assert.strictEqual(recognizePose(hiddenBody).label, '未检测');
const upperBody = pose.map((point, index) => ({...point, visibility: index >= 25 ? 0 : point.visibility}));
assert.strictEqual(recognizePose(upperBody).label, '举起双手');
upperBody[15].y = upperBody[16].y = 0.8;
assert.strictEqual(recognizePose(upperBody).label, '未检测', 'hidden legs cannot establish standing or squatting');
assert.deepStrictEqual(recognizeFaceActions(null), []);
assert.strictEqual(summarizeHolisticResults({poseLandmarks: pose}).pose.label, '举起双手');
assert.deepStrictEqual(summarizeHolisticResults({}).face, ['未检测']);

const stabilizer = createHolisticResultStabilizer();
const standing = {face: ['自然'], gesture: {label: '张开手掌', confidence: 0.8}, pose: {label: '站立', confidence: 0.7}};
const raised = {face: ['微笑'], gesture: {label: '胜利手势', confidence: 0.9}, pose: {label: '举起双手', confidence: 0.9}};
stabilizer.push(standing);
stabilizer.push(raised);
assert.strictEqual(stabilizer.push(raised).pose.label, '站立');
assert.strictEqual(stabilizer.push(raised).pose.label, '举起双手');
assert.deepStrictEqual(stabilizer.push(raised).face, ['微笑']);
stabilizer.reset();
assert.strictEqual(stabilizer.push(standing).pose.label, '站立');
for (let index = 0; index < 5; index++) stabilizer.push(standing);
assert.strictEqual(stabilizer.push(raised).gesture.label, '张开手掌');
const missing = summarizeHolisticResults({});
for (let index = 0; index < 5; index++) stabilizer.push(missing);
assert.deepStrictEqual(stabilizer.push(missing).face, ['未检测']);
assert.strictEqual(stabilizer.push(missing).pose.confidence, 0);

console.log('EST MediaPipe Holistic recognition rule tests passed.');
