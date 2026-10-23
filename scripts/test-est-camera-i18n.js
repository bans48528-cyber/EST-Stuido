const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const path = require('path');
const babel = require('@babel/core');
const root = path.resolve(__dirname, '../src/renderer');
const originalLoader = Module._extensions['.js'];
Module._extensions['.js'] = (module, filename) => {
    if (!filename.startsWith(root + path.sep)) return originalLoader(module, filename);
    module._compile(babel.transformSync(fs.readFileSync(filename, 'utf8'), {
        babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs']
    }).code, filename);
};
const messages = require('../src/common/est-camera-messages.json');
const {getEstText, EST_LOCALE_NAMES, EST_MESSAGES} = require('../src/renderer/est-i18n');
const guideMessages = require('../src/renderer/est-vision/guide-messages.json');
const guideKeys = Object.keys(EST_MESSAGES.en).filter(key => key.startsWith('home.dialog.vision.') ||
    key.startsWith('home.more.vision'));
for (const [locale, dictionary] of Object.entries(guideMessages)) {
    for (const key of guideKeys) {
        assert.ok(dictionary[key], `${locale}: missing camera guide ${key}`);
        assert.strictEqual(getEstText(key, locale), dictionary[key]);
    }
}
const {CAMERA_RESULT_KEYS, cameraResultText, cameraProgressText, cameraErrorKey} =
    require('../src/renderer/est-vision/camera-i18n');
assert.deepStrictEqual(Object.keys(messages).sort(), Object.keys(EST_LOCALE_NAMES).sort());
for (const [locale, dictionary] of Object.entries(messages)) {
    assert.deepStrictEqual(Object.keys(dictionary).sort(), Object.keys(messages.en).sort());
    for (const [key, text] of Object.entries(dictionary)) {
        assert.ok(text.trim(), `${locale}: empty ${key}`);
        assert.strictEqual(getEstText(key, locale), text);
        assert.deepStrictEqual((text.match(/\{[^}]+\}/g) || []).sort(),
            (messages.en[key].match(/\{[^}]+\}/g) || []).sort(), `${locale}: placeholders for ${key}`);
    }
    for (const [label, key] of Object.entries(CAMERA_RESULT_KEYS)) {
        assert.strictEqual(cameraResultText(label, locale), dictionary[key]);
    }
    const suffix = locale === 'zh-cn' ? '' : `-${locale}`;
    assert.ok(fs.statSync(path.join(root, `est-home-assets/home-guide-vision-camera${suffix}.png`)).size > 0);
    assert.strictEqual(cameraResultText('unexpected result', locale), dictionary['camera.unknown']);
    for (const kind of ['hands', 'pose', 'face_mesh']) {
        for (const stage of ['load', 'initialize', 'warmup']) {
            const text = cameraProgressText({kind, stage}, locale);
            assert.ok(!text.includes('{') && !text.includes('camera.'));
        }
    }
}
for (const name of ['NotAllowedError', 'SecurityError', 'NotFoundError', 'NotReadableError', 'OverconstrainedError']) {
    assert.ok(messages.en[cameraErrorKey({name})]);
}
for (const [message, key] of [
    ['需要连接支持 vision-input 的协议 1.30 EST', 'camera.status.unsupported'],
    ['多项识别需要支持 vision-input-multi 的协议 1.31 EST 固件', 'camera.status.multi'],
    ['EST firmware update is in progress', 'camera.status.paused'],
    ['摄像头发送已被占用', 'camera.error.occupied'],
    ['摄像头发送已停止，请重新启用', 'camera.error.stopped'],
    ['设备已断开或视觉发送已暂停', 'camera.error.connection'],
    ['无法加载视觉模型脚本: file://test', 'camera.error.model'],
    ['unknown native error', 'camera.error.send']
]) assert.strictEqual(cameraErrorKey(new Error(message)), key);
const source = fs.readFileSync(path.join(root, 'EstVisionLab.jsx'), 'utf8');
assert.ok(!/[\u3400-\u9fff]/.test(source.slice(source.indexOf('    render ()'))), 'render must not hard-code Chinese');
const recognition = fs.readFileSync(path.join(root, 'est-vision/holistic-recognition.js'), 'utf8');
for (const match of recognition.matchAll(/(?:label: |actions.push\()'([^']+)'/g)) {
    assert.ok(CAMERA_RESULT_KEYS[match[1]], `untranslated recognition label: ${match[1]}`);
}
console.log(`Camera localization passed: ${Object.keys(messages).length} locales, ` +
    `${Object.keys(messages.en).length} keys, all recognition labels and error fallbacks.`);
