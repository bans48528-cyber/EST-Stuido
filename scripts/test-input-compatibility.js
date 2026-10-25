const assert = require('assert');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const Module = require('module');
const babel = require('@babel/core');
const transformMenu = require('./est-menu-bar-loader');
const messages = require('../src/common/input-compatibility-messages.json');

const root = path.resolve(__dirname, '..');
const sourceFile = path.join(root, 'src/main/input-compatibility.js');
const transformed = babel.transformFileSync(sourceFile, {
    babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs']
});
const loaded = new Module(sourceFile, module);
loaded.filename = sourceFile;
loaded.paths = Module._nodeModulePaths(path.dirname(sourceFile));
loaded._compile(transformed.code, sourceFile);
const {InputCompatibility} = loaded.exports;
const commandLine = (...initial) => {
    const switches = new Set(initial);
    return {hasSwitch: name => switches.has(name),
        appendSwitch: name => switches.add(name),
        removeSwitch: name => switches.delete(name)};
};

(async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'est-input-preferences-'));
    try {
        const filename = path.join(directory, 'user-a', 'input.json');
        const make = (options = {}) => new InputCompatibility({filename,
            platform: 'win32',
            commandLine: commandLine(),
            ...options});
        const initialFlags = commandLine();
        const first = make({commandLine: initialFlags});
        assert.strictEqual(first.getStatus().active, false, 'New users retain accessibility');
        assert.strictEqual(initialFlags.hasSwitch('disable-renderer-accessibility'), false);
        assert.strictEqual((await first.setEnabled(true)).requiresRestart, true);
        assert.strictEqual(first.getStatus().active, false, 'Changing a preference must not alter a live session');
        assert.strictEqual(initialFlags.hasSwitch('disable-renderer-accessibility'), false);

        const restartFlags = commandLine();
        const restarted = make({commandLine: restartFlags});
        assert.strictEqual(restarted.getStatus().active, true);
        assert.strictEqual(restarted.getStatus().requiresRestart, false);
        assert.strictEqual(restartFlags.hasSwitch('disable-renderer-accessibility'), true);
        assert.strictEqual(make({filename: path.join(directory, 'user-b.json')}).active, false);
        assert.strictEqual(make({platform: 'linux'}).active, false);
        assert.strictEqual(make({platform: 'darwin'}).getStatus().available, false);
        await assert.rejects(make({platform: 'darwin'}).setEnabled(true), /INVALID/);

        for (const override of ['est-screen-reader', 'force-renderer-accessibility']) {
            const flags = commandLine(override, 'disable-renderer-accessibility');
            const accessible = make({commandLine: flags});
            assert.strictEqual(accessible.active, false);
            assert.strictEqual(accessible.savedEnabled, true, 'An override does not rewrite user preferences');
            assert.strictEqual(flags.hasSwitch('disable-renderer-accessibility'), false);
        }
        await assert.rejects(restarted.setEnabled('true'), /INVALID/);
        assert.strictEqual(restarted.savedEnabled, true);
        await restarted.setEnabled(false);
        assert.strictEqual(restarted.getStatus().requiresRestart, true);
        assert.strictEqual(make().active, false, 'Disabling must restore normal launch after a restart');
        assert.strictEqual(make({commandLine: commandLine('est-input-compatibility')}).active, true);
        assert.strictEqual(make().savedEnabled, false, 'A one-time CLI test must not persist');

        fs.writeFileSync(filename, '{broken');
        assert.strictEqual(make().savedEnabled, false);
        fs.writeJsonSync(filename, {version: 2, enabled: true});
        assert.strictEqual(make().savedEnabled, false);
        fs.writeJsonSync(filename, {version: 1, enabled: 'true'});
        assert.strictEqual(make().savedEnabled, false);
        fs.writeFileSync(filename, ' '.repeat(4097));
        assert.strictEqual(make().savedEnabled, false);
        const queued = make();
        await Promise.all([queued.setEnabled(true), queued.setEnabled(false)]);
        assert.strictEqual(make().savedEnabled, false, 'Concurrent saves must keep request order');
        assert.deepStrictEqual(fs.readdirSync(path.dirname(filename)), ['input.json']);

        const blockedParent = path.join(directory, 'blocked');
        fs.writeFileSync(blockedParent, 'file');
        const failed = make({filename: path.join(blockedParent, 'input.json')});
        await assert.rejects(failed.setEnabled(true));
        assert.strictEqual(failed.savedEnabled, false, 'A failed write must not claim persistence');

        const menuSource = fs.readFileSync(path.join(root,
            'node_modules/openblock-gui/src/components/menu-bar/menu-bar.jsx'), 'utf8');
        const menu = transformMenu(menuSource);
        assert.strictEqual((menu.match(/<EstInputCompatibilityMenu\b/g) || []).length, 1);
        babel.transformSync(menu, {babelrc: false, presets: ['@babel/preset-react']});
        for (const locale of ['zh-cn', 'zh-tw', 'en', 'pt-br', 'ru']) {
            for (const key of ['label', 'hint', 'saved', 'restart', 'error', 'ok']) {
                assert.ok(messages[locale][key], `${locale}.${key}`);
            }
        }
        console.log('Input compatibility passed: opt-in persistence, restart, screen-reader override, ' +
            'per-user/platform isolation, atomic saves, failures, menu insertion and five locales.');
    } finally {
        fs.removeSync(directory);
    }
})().catch(error => {
    console.error(error); process.exitCode = 1;
});
