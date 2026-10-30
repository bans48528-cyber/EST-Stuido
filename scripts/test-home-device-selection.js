/* eslint-disable max-len, global-require, no-underscore-dangle */
const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');
const Module = require('module');
const babel = require('@babel/core');
const JSZip = require('jszip');
const React = require('react');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const sourceRoot = path.join(root, 'src');
const originalLoad = Module._load;
const originalJs = Module._extensions['.js'];
const compile = (module, filename) => {
    if (!filename.startsWith(sourceRoot)) return originalJs(module, filename);
    module._compile(babel.transformSync(fs.readFileSync(filename, 'utf8'), {
        babelrc: false, presets: ['@babel/preset-react'], plugins: ['@babel/plugin-transform-modules-commonjs']
    }).code, filename);
};
const calls = [];
let invoke = async () => [];
Module._extensions['.js'] = compile;
Module._extensions['.jsx'] = compile;
Module._load = function (name, parent, main) {
    if (name === 'electron') return {ipcRenderer: {invoke: (channel, argument) => {
        calls.push({channel, argument}); return invoke(channel, argument);
    }, send: () => {}}};
    if (name.endsWith('/est-home-block-previews')) return {createHardwareBlockPreviews: () => Promise.resolve({})};
    if (/\.(png|jpg|svg)$/.test(name)) return name;
    if (name.endsWith('.css')) return {__esModule: true, default: new Proxy({}, {get: (target, key) => key})};
    return originalLoad.call(this, name, parent, main);
};
const {HomeRecentProjects} = require('../src/main/home/recent-projects');
const {HardwareSelectionPreferences} = require('../src/main/hardware/selection-preferences');
const {readProjectFileHardware} = require('../src/main/hardware/project-info');
const {getHomeContent, requireHomeBuildLibrary} = require('../src/common/home-content');
const {EstHome} = require('../src/renderer/EstHome.jsx');
const translations = require('../src/renderer/home-messages.json');
const {getEstText} = require('../src/renderer/est-i18n');
Module._load = originalLoad;
const defer = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return {promise, resolve}; };
const nodes = tree => !tree ? [] : Array.isArray(tree) ? tree.flatMap(nodes) :
    React.isValidElement(tree) ? [tree, ...nodes(tree.props.children)] : [];
const home = hardwareId => {
    const component = new EstHome({homeHardwareId: hardwareId, projectHardwareId: 'est',
        onOpenVision: () => {}, onHomeHardwareChange: () => {}, homeSelectionReady: true});
    component.setState = (update, callback) => {
        component.state = {...component.state, ...(typeof update === 'function' ? update(component.state) : update)};
        if (callback) callback();
    };
    return component;
};
(async () => {
    const directory = await fs.mkdtemp(path.join(root, 'tmp', 'home-device-test-'));
    const preferencePath = path.join(directory, 'selection.json');
    const runtime = new HardwareSelectionPreferences(preferencePath);
    const browsing = new HardwareSelectionPreferences(preferencePath, 'homeHardwareId');
    runtime.write('new-ai'); browsing.write('spark-ai');
    assert.equal(new HardwareSelectionPreferences(preferencePath).read(), 'new-ai');
    assert.equal(new HardwareSelectionPreferences(preferencePath, 'homeHardwareId').read(), 'spark-ai');
    runtime.write('est'); assert.equal(browsing.read(), 'spark-ai');
    browsing.write('new-ai'); assert.equal(runtime.read(), 'est');
    console.log('Independent browsing/runtime preferences and cold reads passed.');

    const files = [];
    for (const id of ['est', 'spark-ai', 'new-ai', 'unknown']) {
        const filename = path.join(directory, `${id}.atc`);
        const zip = new JSZip();
        zip.file('project.json', JSON.stringify({meta: {estStudio: {version: 1, hardwareId: id}}}));
        await fs.writeFile(filename, await zip.generateAsync({type: 'nodebuffer'}));
        const hardware = await readProjectFileHardware(filename);
        assert.equal(hardware && hardware.id, id === 'unknown' ? null : id);
        files.push({path: filename, hardwareId: hardware && hardware.id});
    }
    const legacy = path.join(directory, 'legacy.atc');
    const zip = new JSZip(); zip.file('project.json', '{}');
    await fs.writeFile(legacy, await zip.generateAsync({type: 'nodebuffer'}));
    assert.equal((await readProjectFileHardware(legacy)).id, 'est', 'existing metadata compatibility remains');
    let paths = [];
    const records = new Map();
    const index = new HomeRecentProjects({readPaths: async () => paths.slice(),
        writePaths: async values => { paths = values.slice(); }, readInfo: async value => records.get(value),
        pathKey: value => value.toLowerCase()});
    const requests = [];
    for (const record of files) for (let number = 0; number < 19; number++) {
        const item = {...record, path: `${record.path}-${number}`}; records.set(item.path, item);
        requests.push(index.remember(item.path));
    }
    await Promise.all(requests);
    let list = await index.list();
    assert.equal(list.length, 64);
    for (const record of files) assert.equal(list.filter(item => item.hardwareId === record.hardwareId).length, 16);
    const keep = list.filter(item => item.hardwareId === 'new-ai').map(item => item.path);
    const removed = list.find(item => item.hardwareId === 'spark-ai');
    await index.remove(removed.path);
    assert.deepEqual((await index.list()).filter(item => item.hardwareId === 'new-ai').map(item => item.path), keep);
    assert.equal(paths.length, 63, 'removing one filtered entry preserves the full other-device index');
    console.log('Real archive metadata and concurrent per-device 16-record retention passed.');

    for (const locale of Object.keys(translations)) for (const [key, text] of Object.entries(translations[locale])) {
        assert.equal(getEstText(key, locale), text);
        assert.deepEqual(Object.keys(translations[locale]).sort(), Object.keys(translations.en).sort());
    }
    for (const id of ['spark-ai', 'new-ai']) {
        assert.deepEqual(getHomeContent(id).bundledBuildIds, []);
        assert.throws(() => requireHomeBuildLibrary({hardwareId: id}), /UNAVAILABLE/);
    }
    assert.throws(() => requireHomeBuildLibrary({}), /UNKNOWN/);
    assert.throws(() => requireHomeBuildLibrary({hardwareId: '../est'}), /UNKNOWN/);
    const component = home('est'); component.state.recentFiles = files;
    for (const id of ['est', 'spark-ai', 'new-ai']) {
        component.props = {...component.props, homeHardwareId: id};
        const fileCards = nodes(component.renderFiles()).filter(node => node.type === 'article');
        assert.equal(fileCards.length, 1);
        assert.equal(fileCards[0].key, files.find(item => item.hardwareId === id).path);
        assert.equal(nodes(component.renderMore()).filter(node => node.type === 'select').length, 1);
        assert.equal(nodes(component.renderHardwarePicker()).filter(node => node.props.id === 'atc-home-hardware').length, 1);
        if (id !== 'est') assert.equal(nodes(component.renderBuild()).filter(node => node.props.className === 'buildTile').length, 0);
    }
    component.state.showUnknownFiles = true;
    assert.equal(nodes(component.renderFiles()).filter(node => node.type === 'article')[0].key, files[3].path);
    assert.equal(component.state.recentFiles.length, 4);

    // Slow responses, including switching back to the same id, must not win against newer requests.
    const pending = [];
    invoke = (channel, argument) => {
        const gate = defer(); pending.push({channel, argument, ...gate}); return gate.promise;
    };
    component.props = {...component.props, homeHardwareId: 'est'};
    const first = component.loadBuildLibrary();
    component.props = {...component.props, homeHardwareId: 'new-ai'};
    const second = component.loadBuildLibrary();
    pending[1].resolve({hardwareId: 'new-ai', items: [], totalItemCount: 0}); await second;
    pending[0].resolve({hardwareId: 'est', items: [{id: 'old-est'}]}); await first;
    assert.deepEqual(component.state.buildItems, []);
    component.handleBuildDownloadProgress(null, {hardwareId: 'est', phase: 'downloading', percent: 80});
    assert.equal(component.state.buildDownloadActive, false);
    component.props = {...component.props, homeHardwareId: 'est'};
    const third = component.loadBuildLibrary();
    pending[2].resolve({hardwareId: 'est', items: [], downloadActive: true,
        downloadProgress: {hardwareId: 'est', phase: 'downloading', percent: 40}}); await third;
    assert.equal(component.state.buildDownloadActive, true);
    assert.equal(component.state.buildDownloadProgress.percent, 40);
    const stale = component.loadRecentFiles();
    const fresh = component.loadRecentFiles();
    pending[4].resolve([files[2]]); await fresh;
    pending[3].resolve(files); await stale;
    assert.deepEqual(component.state.recentFiles, [files[2]]);
    assert.ok(calls.every(call => !/^hardware-|^(spark|new-ai|est)-(connect|stop|run)/.test(call.channel)));
    console.log('Home filtering, empty guides, stale responses and progress isolation passed in five locales.');

    // Exercise the actual main-process download IPC handlers with the real ownership validator.
    const main = fs.readFileSync(path.join(root, 'src/main/index.js'), 'utf8');
    const handlers = {};
    const transfer = defer(); let installs = 0; const sent = [];
    const context = {ipcMain: {handle: (name, action) => { handlers[name] = action; }},
        requireHomeBuildLibrary, getHomeBuildThumbnails: async () => ({}), getHomeBuildLibraryState: async () => ({}),
        getEstBuildLibraryService: () => ({install: publish => { installs++; publish({phase: 'downloading', percent: 20}); return transfer.promise; }}),
        EstBuildLibraryOperation: class { snapshot () { return {}; } }, EstBuildLibraryCancelledError: class extends Error {},
        serializeInstalledBuildLibrary: async value => ({hardwareId: 'est', ...value}), openHomeBuildGuide: async () => true,
        Date, Promise};
    const begin = main.indexOf("ipcMain.handle('est-home-get-build-thumbnails'");
    const end = main.indexOf('\nconst firmwareUpdateConnectionState', begin);
    vm.runInNewContext('let estBuildLibraryInstallPromise=null, estBuildLibraryInstallHardwareId=null, estBuildLibraryInstallOperation=null, estBuildLibraryLastProgress=null, estBuildLibraryProgressPublisher=null;\n'+main.slice(begin, end), context);
    const sender = {isDestroyed: () => false, send: (channel, data) => sent.push(data)};
    assert.throws(() => handlers['est-home-download-build-library']({sender}, {hardwareId: 'new-ai'}), /UNAVAILABLE/);
    const a = handlers['est-home-download-build-library']({sender}, {hardwareId: 'est'});
    const b = handlers['est-home-download-build-library']({sender}, {hardwareId: 'est'});
    assert.equal(a, b); assert.equal(installs, 1); assert.equal(sent[0].hardwareId, 'est');
    assert.throws(() => handlers['est-home-cancel-build-library-download']({sender}, {hardwareId: 'spark-ai'}), /UNAVAILABLE/);
    transfer.resolve({installed: true}); assert.equal((await a).hardwareId, 'est');
    console.log('Main IPC rejects cross-device build requests and shares one fixed-owner download.');
    console.log('Homepage device selection tests passed. Test fixtures: '+directory);
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
