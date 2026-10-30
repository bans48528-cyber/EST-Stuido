/* eslint-disable global-require, no-underscore-dangle */
const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const path = require('path');
const babel = require('@babel/core');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');

// Exercise the real component and its click handlers without starting hardware or Electron services.
const sourceRoot = path.resolve(__dirname, '../src');
const originalLoad = Module._load;
const originalJsLoader = Module._extensions['.js'];
const originalJsxLoader = Module._extensions['.jsx'];
const compileSource = (module, filename) => {
    if (!filename.startsWith(sourceRoot)) return originalJsLoader(module, filename);
    const transformed = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
        babelrc: false,
        presets: ['@babel/preset-react'],
        plugins: ['@babel/plugin-transform-modules-commonjs']
    });
    module._compile(transformed.code, filename);
};
Module._extensions['.js'] = compileSource;
Module._extensions['.jsx'] = compileSource;
Module._load = function (request, parent, isMain) {
    if (request === 'electron') return {ipcRenderer: {send: () => {}}};
    if (request.endsWith('/est-home-block-previews')) return {__esModule: true, default: () => Promise.resolve({})};
    if (/\.(png|jpg|svg)$/.test(request)) return request;
    if (request.endsWith('.css')) {
        return {__esModule: true, default: new Proxy({}, {get: (target, name) => name})};
    }
    return originalLoad.call(this, request, parent, isMain);
};

let getHomeContent;
let EstHome;
let getProductBlockGuideIds;
let getProductBlockGuideCategories;
let sparkCatalog;
let newCatalog;
try {
    EstHome = require('../src/renderer/EstHome.jsx').default;
    ({getHomeContent} = require('../src/common/home-content'));
    ({getProductBlockGuideIds, getProductBlockGuideCategories} =
        require('../src/renderer/est-home-product-block-guide'));
    sparkCatalog = require('../src/renderer/spark-ai/catalog.json');
    newCatalog = require('../src/renderer/new-ai/catalog.json');
} finally {
    Module._load = originalLoad;
    Module._extensions['.js'] = originalJsLoader;
    if (originalJsxLoader) Module._extensions['.jsx'] = originalJsxLoader;
    else delete Module._extensions['.jsx'];
}

const nodes = (tree, predicate) => {
    if (Array.isArray(tree)) return tree.reduce((result, child) => result.concat(nodes(child, predicate)), []);
    if (!React.isValidElement(tree)) return [];
    return (predicate(tree) ? [tree] : []).concat(nodes(tree.props.children, predicate));
};
const textContent = tree => {
    if (Array.isArray(tree)) return tree.map(textContent).join(' ');
    if (React.isValidElement(tree)) return textContent(tree.props.children);
    return typeof tree === 'string' || typeof tree === 'number' ? String(tree) : '';
};
const buttonWithKey = (tree, key) => {
    const matches = nodes(tree, node => node.type === 'button' && node.key === key);
    assert.strictEqual(matches.length, 1, `expected one button for ${key}`);
    assert.strictEqual(matches[0].props.type, 'button');
    return matches[0];
};
const guideDirectory = home => {
    const matches = nodes(home.renderMore(), node => node.props.id === 'est-home-product-guides');
    assert.strictEqual(matches.length, 1);
    return matches[0];
};
const closeDialog = home => {
    const close = nodes(home.renderDialog(), node =>
        node.type === 'button' && node.props['aria-label'] === home.text('home.close'));
    assert.strictEqual(close.length, 1);
    close[0].props.onClick();
    assert.strictEqual(home.renderDialog(), null);
};
const newHome = locale => {
    const home = new EstHome({onOpenVision: () => {}, visible: true, homeHardwareId: 'est', projectHardwareId: 'est'});
    home.setState = (update, callback) => {
        const next = typeof update === 'function' ? update(home.state, home.props) : update;
        home.state = {...home.state, ...next};
        if (callback) callback();
    };
    home.state.locale = locale;
    home.previewRequests = 0;
    home.loadBlockPreviews = () => {
        home.previewRequests++;
    };
    return home;
};

const guideIds = ['hardware', 'interaction', 'sensors', 'blocks', 'ai', 'firmware'];
const products = [
    {id: 'est',
        name: 'EST',
        imageAlt: 'home.dialog.est.prototype.estImageAlt',
        imageFile: 'est.png',
        expected: {
            hardware: ['home.dialog.hardware.controllerTitle', 'home.dialog.hardware.hostHomeTitle'],
            interaction: ['home.dialog.interaction.connectTitle'],
            sensors: ['home.dialog.hardware.outputTitle', 'home.dialog.hardware.sensorTitle'],
            ai: ['home.dialog.est.smartTitle', 'home.dialog.ai.setupTitle'],
            firmware: ['home.dialog.hardware.firmwareTitle']
        }},
    {id: 'spark-ai',
        name: 'Spark AI',
        imageAlt: 'home.dialog.est.prototype.sparkImageAlt',
        imageFile: 'spark-ai.png',
        expected: {
            hardware: [
                'home.dialog.est.prototype.sparkHostTitle',
                'home.dialog.est.prototype.sparkDeviceTitle'
            ],
            interaction: ['home.dialog.est.prototype.sparkProgramTitle'],
            sensors: ['home.dialog.est.prototype.sparkMotorTitle', 'home.dialog.est.prototype.sparkSensorTitle'],
            blocks: ['category.motor', 'home.blockGuide.category.matrix'],
            ai: ['home.dialog.est.prototype.sparkAiTitle', 'home.dialog.ai.setupTitle'],
            firmware: ['home.dialog.est.prototype.sparkFirmwareTitle']
        }},
    {id: 'new-ai',
        name: 'NEW AI',
        imageAlt: 'home.dialog.est.prototype.newAiImageAlt',
        imageFile: 'new-ai.png',
        expected: {
            hardware: [
                'home.dialog.est.prototype.newAiHostTitle',
                'home.dialog.est.prototype.newAiDeviceTitle'
            ],
            interaction: ['home.dialog.est.prototype.newAiProgramTitle'],
            sensors: ['home.dialog.est.prototype.newAiMotorTitle', 'home.dialog.est.prototype.newAiSensorTitle'],
            blocks: ['category.motor', 'home.blockGuide.category.camera', 'home.blockGuide.category.grayv2'],
            ai: ['home.dialog.est.prototype.newAiAiTitle', 'home.dialog.est.prototype.newAiVisionTitle',
                'home.dialog.ai.setupTitle'],
            firmware: ['home.dialog.est.prototype.newAiFirmwareTitle']
        }}
];

for (const [productId, catalog] of [['spark-ai', sparkCatalog], ['new-ai', newCatalog]]) {
    const guideIdsForProduct = getProductBlockGuideIds(productId, 'zh-cn');
    assert.strictEqual(guideIdsForProduct.length, catalog.blocks.length,
        `${productId}: every catalog block must appear in the product guide`);
    assert.strictEqual(new Set(guideIdsForProduct).size, catalog.blocks.length,
        `${productId}: product guide block ids must be unique`);
    for (const locale of ['zh-cn', 'en']) {
        const entries = getProductBlockGuideCategories(productId, locale)
            .reduce((all, category) => all.concat(category.items), []);
        assert.ok(entries.every(entry => entry.description && entry.description.length > 12),
            `${productId}/${locale}: every block needs a specific explanation`);
        assert.strictEqual(new Set(entries.map(entry => entry.description)).size, entries.length,
            `${productId}/${locale}: descriptions must not fall back to repeated block-shape text`);
    }
}

for (const locale of ['zh-cn', 'zh-tw', 'en', 'pt-br', 'ru']) {
    const home = newHome(locale);
    assert.strictEqual(nodes(home.renderHardwarePicker(), node => node.props.id === 'atc-home-hardware').length, 1);
    assert.strictEqual(nodes(home.renderMore(), node => node.type === 'select').length, 1,
        'the only select inside More is the shared language setting');
    for (const product of products) {
        home.props = {...home.props, homeHardwareId: product.id};
        const directory = guideDirectory(home);
        assert.deepStrictEqual(nodes(directory, node => node.type === 'button').map(node => node.key),
            product.id === 'est' ? [...guideIds, 'vision'] : guideIds);
        assert.ok(textContent(directory).includes(product.name));
        for (const guideId of guideIds) {
            const previewRequests = home.previewRequests;
            buttonWithKey(guideDirectory(home), guideId).props.onClick();
            assert.strictEqual(home.state.dialogId, guideId);
            assert.strictEqual(home.props.homeHardwareId, product.id);
            const dialogTree = home.renderDialog();
            const dialog = nodes(dialogTree, node => node.props.role === 'dialog');
            assert.strictEqual(dialog.length, 1);
            assert.strictEqual(dialog[0].props['aria-modal'], 'true');
            const title = nodes(dialogTree, node => node.props.id === 'est-home-dialog-title')[0];
            assert.ok(textContent(title).includes(product.name), `${product.id}/${guideId}: product title`);
            for (const messageId of product.expected[guideId] || []) {
                assert.ok(textContent(dialogTree).includes(home.text(messageId)),
                    `${locale} ${product.id}/${guideId}: missing expected section ${messageId}`);
            }
            const markup = renderToStaticMarkup(dialogTree);
            assert.doesNotMatch(markup, /home\.(dialog|more)\.[A-Za-z]/, 'all guide labels must be translated');
            if (guideId === 'hardware') {
                const visuals = nodes(dialogTree, node => node.type === 'figure' &&
                    node.props.className === 'hardwareGuideVisual');
                assert.strictEqual(visuals.length, 1, `${product.id}: hardware guide needs one product image`);
                const productImages = nodes(visuals[0], node => node.type === 'img');
                assert.strictEqual(productImages.length, 1);
                assert.strictEqual(productImages[0].props.alt, home.text(product.imageAlt));
                assert.ok(productImages[0].props.src.endsWith(product.imageFile));
            }
            if (guideId === 'blocks') {
                assert.ok(markup.includes('blockGuideEntries'),
                    `${product.id}: product block reference must render`);
                assert.strictEqual(home.previewRequests - previewRequests, 1,
                    `${product.id}: product block previews must be requested`);
            }
            closeDialog(home);
            assert.strictEqual(home.props.homeHardwareId, product.id, 'closing keeps the chosen directory');
        }
    }

    for (const commonId of ['software', 'about']) {
        const button = nodes(home.renderMore(), node => node.type === 'button' &&
            textContent(node).includes(home.text(`home.more.${commonId}`)))[0];
        assert.ok(button, `missing common entry ${commonId}`);
        button.props.onClick();
        assert.strictEqual(home.state.dialogId, commonId);
        assert.ok(!getHomeContent(home.props.homeHardwareId).guides.includes(commonId));
        assert.ok(textContent(home.renderDialog()).includes(home.text(`home.dialog.${commonId}.title`)));
        closeDialog(home);
        assert.strictEqual(home.props.homeHardwareId, 'new-ai');
    }

    buttonWithKey(guideDirectory(home), 'blocks').props.onClick();
    const previewRequests = home.previewRequests;
    home.handleLocaleChanged({detail: {locale: locale === 'en' ? 'zh-cn' : 'en'}});
    assert.strictEqual(home.previewRequests, previewRequests + 1,
        'changing locale must reload block images for the selected product');
    home.handleWindowKeyDown({key: 'Escape'});
    assert.strictEqual(home.renderDialog(), null);
    assert.strictEqual(home.props.homeHardwareId, 'new-ai');
    buttonWithKey(guideDirectory(home), 'hardware').props.onClick();
    const backdrop = home.renderDialog();
    backdrop.props.onMouseDown({target: {}, currentTarget: {}});
    assert.ok(home.renderDialog(), 'clicking inside the dialog must not close it');
    const backdropTarget = {};
    backdrop.props.onMouseDown({target: backdropTarget, currentTarget: backdropTarget});
    assert.strictEqual(home.renderDialog(), null);
    assert.strictEqual(home.props.homeHardwareId, 'new-ai');
}

console.log('Home guide behavior passed: all product guides in five languages, one controlled selection and shared dialogs.');
