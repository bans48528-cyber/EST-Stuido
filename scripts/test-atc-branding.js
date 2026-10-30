/* eslint-disable global-require */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const babel = require('@babel/core');
const yaml = require('js-yaml');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const loader = require('./est-project-file-loader');
const transform = file => loader.call({resourcePath: file}, read(`node_modules/openblock-gui/src/${file}`));
const parse = source => babel.parseSync(source, {babelrc: false,
    configFile: false,
    sourceType: 'module',
    parserOpts: {plugins: ['jsx']}});
const find = (node, predicate) => {
    if (!node || typeof node !== 'object') return null;
    if (predicate(node)) return node;
    for (const value of Object.values(node)) {
        if (Array.isArray(value)) {
            for (const child of value) {
                const found = find(child, predicate); if (found) return found;
            }
        } else if (value && typeof value === 'object') {
            const found = find(value, predicate); if (found) return found;
        }
    }
    return null;
};
const extract = (source, predicate) => {
    const node = find(parse(source), predicate);
    assert.ok(node, 'source contract must exist');
    return source.slice(node.start, node.end);
};

const pkg = JSON.parse(read('package.json'));
const builder = yaml.load(read('electron-builder.yaml'));
assert.equal(pkg.name, 'atc-codestudio');
assert.equal(pkg.productName, 'ATC CodeStudio');
assert.equal(builder.productName, pkg.productName);
assert.equal(builder.appId, 'com.atc.codestudio');
assert.equal(builder.fileAssociations.ext, 'atc');
assert.equal(builder.fileAssociations.name, 'ATC CodeStudio project file');
assert.ok(read('buildResources/installer.nsh').includes('Software\\Classes\\.atc'));
for (const file of ['src/icon/OpenBlockDesktop.ico', 'buildResources/OpenBlockFile.ico']) {
    const bytes = fs.readFileSync(path.join(root, file));
    assert.equal(bytes.readUInt16LE(2), 1, 'Windows ICO header');
    const frames = bytes.readUInt16LE(4);
    const sizes = Array.from({length: frames}, (_, index) => bytes[6 + (index * 16)] || 256);
    for (const size of [16, 20, 24, 32, 48, 64, 128, 256]) assert.ok(sizes.includes(size));
}
assert.ok(fs.readFileSync(path.join(root, 'src/icon/OpenBlockDesktop.ico'))
    .equals(fs.readFileSync(path.join(root, 'buildResources/OpenBlockDesktop.ico'))));
assert.ok(fs.readFileSync(path.join(root, 'src/icon/ATCProject.png'))
    .equals(fs.readFileSync(path.join(root, 'buildResources/OpenBlockFile.png'))));

const downloader = transform('containers/sb3-downloader.jsx');
const filenameFunction = extract(downloader, node => node.type === 'VariableDeclarator' &&
    node.id.name === 'getProjectFilename');
const getFilename = vm.runInNewContext(`(${filenameFunction.slice(filenameFunction.indexOf('=') + 1)})`);
assert.equal(getFilename('测试程序', ''), '测试程序.atc');
assert.equal(getFilename('', ''), 'ATC CodeStudio Project.atc');
assert.ok(downloader.includes("type: 'application/x.atc.project'"));
const uploader = transform('lib/sb-file-uploader-hoc.jsx');
const hoc = extract(uploader, node => node.type === 'VariableDeclaration' &&
    node.declarations.some(declaration => declaration.id.name === 'SBFileUploaderHOC'));
const hocCode = babel.transformSync(`${hoc}\nmodule.exports = SBFileUploaderHOC;`, {
    babelrc: false, configFile: false, presets: ['@babel/preset-react']
}).code;
const context = {module: {exports: null},
    React: require('react'),
    PropTypes: require('prop-types'),
    bindAll: require('lodash.bindall'),
    LoadingStates: [],
    intlShape: require('prop-types').object,
    injectIntl: value => value,
    connect: () => value => value,
    MessageBoxType: {alert: 'alert', confirm: 'confirm'},
    sharedMessages: {replaceProjectWarning: {}},
    document: {body: {removeChild: () => {}}}};
vm.runInNewContext(hocCode, context);
const Upload = context.module.exports(() => null);
for (const name of ['example.atc', '大写.ATC', 'old.ests', 'old.ob', 'old.sb3', 'pretend.atc.exe']) {
    const calls = [];
    const instance = new Upload({intl: {formatMessage: message => message.defaultMessage},
        projectChanged: false,
        userOwnsProject: false,
        onShowMessageBox: (type, message) => calls.push({type, message}),
        requestProjectUpload: () => calls.push('upload'),
        closeFileMenu: () => {}});
    instance.handleChange({target: {files: [{name}]}});
    if (/\.atc$/i.test(name)) {
        assert.deepEqual(calls, ['upload']);
        assert.equal(instance.getProjectTitleFromFilename(name), name.slice(0, -4));
    } else {
        assert.equal(calls.length, 1); assert.equal(calls[0].type, 'alert');
        assert.ok(calls[0].message.includes('.atc')); assert.equal(instance.fileToUpload, null);
    }
}

// Execute the real native save callback with a fake dialog and filesystem.
const main = read('src/main/index.js');
const isSaveDeclaration = extract(main, node => node.type === 'VariableDeclaration' &&
    node.declarations.some(declaration => declaration.id.name === 'getIsProjectSave'));
const saveCallback = extract(main, node => node.type === 'CallExpression' &&
    node.arguments[0] && node.arguments[0].value === 'will-download');
const callbackNode = find(parse(`${saveCallback};`), node => node.type === 'CallExpression' &&
    node.arguments[0] && node.arguments[0].value === 'will-download').arguments[1];
const callbackSource = saveCallback.slice(callbackNode.start, callbackNode.end);
const runSave = async (selected, mime = 'application/x.atc.project', filename = 'test.atc') => {
    const result = {moves: [], remembered: [], sent: [], cancelled: false};
    let completed;
    const sandbox = {path,
        window: {},
        app: {getPath: () => 'C:\\Temp'},
        dialog: {showSaveDialogSync: (parent, options) => {
            result.options = options; return selected;
        }},
        fs: {move: (from, to) => Promise.resolve(result.moves.push(to))},
        getFilterForExtension: extension => ({extensions: [extension]}),
        rememberRecentProject: file => Promise.resolve(result.remembered.push(file)),
        captureProjectThumbnail: async () => {},
        webContents: {send: (channel, data) => result.sent.push(data)},
        formatMessage: message => message.default};
    vm.runInNewContext(`${isSaveDeclaration}\nthis.save = (${callbackSource});`, sandbox);
    sandbox.save(null, {getMimeType: () => mime,
        getFilename: () => filename,
        setSavePath: file => {
            result.temp = file;
        },
        on: (event, callback) => {
            completed = callback;
        },
        cancel: () => {
            result.cancelled = true;
        }});
    if (completed) await completed(null, 'completed');
    return result;
};
(async () => {
    for (const selected of ['C:\\Projects\\测试', 'C:\\Projects\\测试.atc', 'C:\\Projects\\测试.ATC']) {
        const result = await runSave(selected);
        const expected = /\.atc$/i.test(selected) ? selected : `${selected}.atc`;
        assert.equal(result.moves[0], expected); assert.equal(result.remembered[0], expected);
        assert.equal(result.sent[0].title, '测试');
        assert.equal(result.options.filters[0].extensions[0], 'atc');
    }
    assert.equal((await runSave(null)).cancelled, true);
    const image = await runSave('C:\\Projects\\image.png', 'image/png', 'image.png');
    assert.equal(image.moves[0], 'C:\\Projects\\image.png'); assert.equal(image.remembered.length, 0);
    for (const file of ['src/main/est-desktop-message-overrides.json',
        'src/renderer/est-editor-message-overrides.json']) {
        for (const locale of Object.values(JSON.parse(read(file)))) {
            assert.ok(Object.values(locale).some(message => message.includes('(.atc)') || message.includes('（.atc）')));
            assert.ok(Object.values(locale).every(message => !/EST Studio|OpenBlock/.test(message)));
        }
    }
    console.log('ATC branding passed: icons, package association, .atc save/cancel, legacy rejection, translations.');
})().catch(error => {
    console.error(error); process.exitCode = 1;
});
