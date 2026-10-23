/* eslint-env browser */
import assert from 'assert';
import {ipcRenderer} from 'electron';
import React from 'react';
import ReactDOM from 'react-dom';
import {Simulate} from 'react-dom/test-utils';
import ScratchBlocks from 'openblock-blocks';
import EstAiPanel from '../../src/renderer/EstAiPanel';
import EstMenuBarLayout from '../../src/renderer/EstMenuBarLayout';
import {registerEstBlocks} from '../../src/renderer/est-blocks/definitions';
import {SAMPLE_IR} from '../../src/renderer/est-ai/est-ai-chat';
import {compileEstBlockIrToXml} from '../../src/renderer/est-ai/est-block-compiler';
import {createEstProgramStackPreviews} from '../../src/renderer/est-ai/est-program-preview';
import {EST_AI_IMPORT_REQUEST_EVENT, importEstBlockIrToWorkspace} from '../../src/renderer/est-ai/est-ai-workspace';
import styles from '../../src/renderer/EstAiPanel.css';
import mascotStyles from '../../src/renderer/EstAiMascot.css';
import {runCoverageUiTests} from './coverage-ui';

const delay = () => new Promise(resolve => setTimeout(resolve, 40));
const settlePaint = () => new Promise(resolve => setTimeout(resolve, 220));
const captureRectangle = (element, padding = 10) => {
    const bounds = element.getBoundingClientRect();
    const left = Math.max(0, Math.floor(bounds.left - padding));
    const top = Math.max(0, Math.floor(bounds.top - padding));
    return {
        x: left,
        y: top,
        width: Math.min(innerWidth - left, Math.ceil(bounds.right + padding) - left),
        height: Math.min(innerHeight - top, Math.ceil(bounds.bottom + padding) - top)
    };
};
const until = async predicate => {
    for (let attempt = 0; attempt < 100; attempt++) {
        if (predicate()) return;
        await delay();
    }
    throw new Error('UI condition timed out');
};
let panel;
let homeVisible = false;
window.estCurrentLocale = 'zh-cn';
registerEstBlocks(ScratchBlocks);
const workspace = ScratchBlocks.inject(document.getElementById('workspace'), {
    sounds: false, scrollbars: true, trashcan: false
});
window.addEventListener(EST_AI_IMPORT_REQUEST_EVENT, event => {
    event.detail.handled = true;
    try {
        event.detail.resolve(importEstBlockIrToWorkspace({
            ScratchBlocks, workspace, ir: event.detail.ir, mode: event.detail.mode
        }));
    } catch (error) {
        event.detail.reject(error);
    }
});
const renderApp = () => ReactDOM.render(React.createElement(
    React.Fragment,
    null,
    React.createElement(EstMenuBarLayout),
    React.createElement(EstAiPanel, {visible: !homeVisible,
        ref: value => {
            panel = value;
        }})
), document.getElementById('root'));
renderApp();

window.runEstAiUiTests = async () => {
    const mainWorkspace = ScratchBlocks.mainWorkspace;
    const button = label => document.querySelector(`button[aria-label="${label}"]`);
    const setInput = (element, value) => Simulate.change(element, {target: {value}});
    await until(() => document.querySelector('.est-menu-bar-ai-button'));
    const aiButton = document.querySelector('.est-menu-bar-ai-button');
    assert.strictEqual(document.querySelectorAll('.est-menu-bar-ai-button').length, 1);
    assert.strictEqual(document.querySelectorAll('.est-menu-bar-ai-button-icon').length, 0, 'Old star is removed');
    const compactMascot = aiButton.querySelector('[data-est-mascot]');
    assert.ok(compactMascot && compactMascot.dataset.compact === 'true');
    assert.strictEqual(aiButton.getAttribute('aria-pressed'), 'false');
    assert.ok(aiButton.getBoundingClientRect().width >= 150 && aiButton.getBoundingClientRect().width <= 166);
    const extraMenu = document.createElement('span');
    Object.assign(extraMenu.style, {width: '650px', height: '20px', flexShrink: '0'});
    document.querySelector('.menu-bar_main-menu_fixture').appendChild(extraMenu);
    await until(() => aiButton.classList.contains('est-menu-bar-ai-compact'));
    assert.ok(aiButton.getBoundingClientRect().width <= 42, 'Available space also collapses the label on wide screens');
    extraMenu.remove();
    await until(() => !aiButton.classList.contains('est-menu-bar-ai-compact'));
    assert.ok(document.getElementById('menu').contains(aiButton), 'AI entry must live in the menu bar');
    const aiBounds = aiButton.getBoundingClientRect();
    const runBounds = document.getElementById('run-controls').getBoundingClientRect();
    assert.ok(aiBounds.bottom <= runBounds.top, 'AI entry must not cover the bottom run controls');
    aiButton.click();
    await until(() => panel.state.isOpen);
    assert.strictEqual(aiButton.getAttribute('aria-pressed'), 'true');
    const mascot = () => panel.panel.current.querySelector('[data-est-mascot]');
    const body = () => mascot().querySelector(`.${mascotStyles.body}`);
    window.dispatchEvent(new Event('focus'));
    await until(() => mascot().dataset.animated === 'true');
    assert.strictEqual(mascot().dataset.state, 'idle');
    const mascotBox = mascot().getBoundingClientRect();
    for (const label of ['API 设置', '新建对话', '关闭']) {
        const bounds = button(label).getBoundingClientRect();
        assert.ok(mascotBox.right < bounds.left, `Mascot must not overlap ${label}`);
        assert.ok(button(label).contains(document.elementFromPoint(bounds.x + (bounds.width / 2),
            bounds.y + (bounds.height / 2))), `${label} remains clickable`);
    }
    assert.strictEqual(getComputedStyle(mascot()).pointerEvents, 'none');
    const svgIds = [...document.querySelectorAll('[data-est-mascot] [id]')].map(element => element.id);
    assert.strictEqual(new Set(svgIds).size, svgIds.length, 'Menu and panel gradients must have unique IDs');
    window.dispatchEvent(new Event('blur'));
    await until(() => mascot().dataset.animated === 'false' && compactMascot.dataset.animated === 'false');
    assert.strictEqual(getComputedStyle(body()).animationPlayState, 'paused');
    window.dispatchEvent(new Event('focus'));
    await until(() => mascot().dataset.animated === 'true');
    mascot().style.display = 'none';
    await until(() => mascot().dataset.animated === 'false');
    mascot().style.display = '';
    await until(() => mascot().dataset.animated === 'true');
    await ipcRenderer.invoke('test-motion', true);
    await until(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
    assert.strictEqual(getComputedStyle(body()).animationName, 'none');
    assert.strictEqual(getComputedStyle(compactMascot.querySelector(`.${mascotStyles.body}`)).animationName, 'none');
    await ipcRenderer.invoke('test-motion', false);
    assert.strictEqual(panel.panel.current.parentElement, document.body, 'Float must escape the app stacking context');
    await settlePaint();
    await ipcRenderer.invoke('test-capture', 'welcome', captureRectangle(panel.panel.current));
    button('API 设置').click();
    await until(() => panel.state.settingsOpen);
    assert.strictEqual(mascot().dataset.animated, 'false', 'Covered header pauses while settings are open');
    setInput(document.getElementById('est-ai-provider'), 'openai');
    assert.strictEqual(panel.state.draftConfig.baseUrl, 'https://api.openai.com/v1');
    setInput(document.getElementById('est-ai-provider'), 'deepseek');
    assert.strictEqual(panel.state.draftConfig.model, 'deepseek-v4-flash');
    setInput(document.getElementById('est-ai-provider'), '');
    setInput(document.getElementById('est-ai-url'), 'https://example.com/v1/chat/completions');
    setInput(document.getElementById('est-ai-model'), 'test-model');
    setInput(document.getElementById('est-ai-key'), 'test-key-not-real');
    await settlePaint();
    await ipcRenderer.invoke('test-capture', 'settings', captureRectangle(panel.panel.current));
    Simulate.submit(panel.settings.current);
    await until(() => !panel.state.settingsOpen);
    assert.strictEqual(panel.state.apiKey, '');
    const persisted = await ipcRenderer.invoke('test-storage');
    assert.strictEqual(persisted.config.baseUrl, 'https://example.com/v1');
    button('API 设置').click();
    await until(() => panel.state.settingsOpen);
    assert.strictEqual(document.getElementById('est-ai-key').value, '');
    assert.strictEqual(document.getElementById('est-ai-model').value, 'test-model');
    setInput(document.getElementById('est-ai-model'), 'temporary-model');
    Simulate.submit(panel.settings.current);
    await until(() => !panel.state.settingsOpen);
    assert.strictEqual((await ipcRenderer.invoke('test-storage')).config.model, 'temporary-model');
    button('API 设置').click();
    await until(() => panel.state.settingsOpen);
    setInput(document.getElementById('est-ai-url'), 'https://another.example/v1');
    assert.ok(panel.settings.current.querySelector('button[type="submit"]').disabled);
    Simulate.submit(panel.settings.current);
    await until(() => panel.state.keyError);
    assert.match(panel.state.keyError, /不会沿用/);
    setInput(document.getElementById('est-ai-url'), 'https://example.com/v1');
    setInput(document.getElementById('est-ai-model'), 'test-model');
    Simulate.submit(panel.settings.current);
    await until(() => !panel.state.settingsOpen);
    await ipcRenderer.invoke('test-reply', JSON.stringify({
        message: '已经搭好了。程序启动后，B、C 电机前进一圈，等待一秒，然后停止。你可以先查看积木，再应用到工作区。',
        ir: SAMPLE_IR
    }), {hold: true});
    const businessStates = [];
    const setState = panel.setState.bind(panel);
    panel.setState = (update, callback) => {
        if (update.mascotState) businessStates.push(update.mascotState);
        return setState(update, callback);
    };
    setInput(panel.composer.current, '让机器人前进一圈，等一秒，然后停止。');
    Simulate.keyDown(panel.composer.current, {key: 'Enter', keyCode: 229, nativeEvent: {isComposing: true}});
    assert.strictEqual(panel.state.messages.length, 0, 'IME must not submit');
    button('发送').click();
    await until(() => mascot().dataset.state === 'thinking');
    await settlePaint();
    await ipcRenderer.invoke('test-capture', 'thinking');
    await ipcRenderer.invoke('test-release-reply');
    await until(() => panel.state.messages.length === 2 && !panel.state.busy);
    assert.ok(businessStates.includes('replying'), 'Reply processing/preview enters replying state');
    assert.strictEqual(mascot().dataset.state, 'success');
    await ipcRenderer.invoke('test-capture', 'success');
    await until(() => mascot().dataset.state === 'idle');
    assert.ok(!panel.state.messages[1].previewError, 'Real Blockly SVG must render');
    const image = document.querySelector(`.${styles.programImages} img`);
    await until(() => image && image.complete && image.naturalWidth > 0);
    assert.ok(image.naturalHeight > 150);
    assert.strictEqual(workspace.getAllBlocks().length, 0, 'Preview must preserve workspace');
    assert.strictEqual(ScratchBlocks.mainWorkspace, mainWorkspace, 'Preview must preserve mainWorkspace');
    await settlePaint();
    await ipcRenderer.invoke('test-capture', 'conversation', captureRectangle(panel.panel.current));
    await ipcRenderer.invoke('test-capture', 'mascot-wide');
    const generated = panel.state.messages[1];
    await panel.handleApply(generated, 'insert');
    assert.strictEqual(mascot().dataset.state, 'success');
    await delay();
    assert.strictEqual(workspace.getTopBlocks().length, 1);
    workspace.undo(false);
    await delay();
    assert.strictEqual(workspace.getTopBlocks().length, 0, 'Inserted program must undo in one step');
    workspace.undo(true);
    await delay();
    assert.strictEqual(workspace.getTopBlocks().length, 1);
    const workspaceXml = ScratchBlocks.Xml.domToText(ScratchBlocks.Xml.workspaceToDom(workspace));
    await panel.handleApply(generated, 'replace');
    await delay();
    assert.strictEqual(workspace.getTopBlocks().length, 1);
    workspace.undo(false);
    await delay();
    assert.strictEqual(ScratchBlocks.Xml.domToText(ScratchBlocks.Xml.workspaceToDom(workspace)), workspaceXml);
    const multi = {...SAMPLE_IR,
        stacks: [
            SAMPLE_IR.stacks[0],
            {event: {type: 'event_program_start'},
                body: [{
                    type: 'control_repeat',
                    inputs: {TIMES: 3},
                    body: JSON.parse(JSON.stringify(SAMPLE_IR.stacks[0].body))
                }]}
        ]};
    const previews = await createEstProgramStackPreviews(compileEstBlockIrToXml(multi).xml);
    assert.strictEqual(previews.length, 2);
    assert.ok(previews[1].height > previews[0].height);
    assert.strictEqual(ScratchBlocks.mainWorkspace, mainWorkspace);
    const domToBlock = ScratchBlocks.Xml.domToBlock;
    ScratchBlocks.Xml.domToBlock = () => {
        throw new Error('Preview rendering test failure');
    };
    await panel.handleLocalPreview();
    ScratchBlocks.Xml.domToBlock = domToBlock; // eslint-disable-line require-atomic-updates
    assert.strictEqual(mascot().dataset.state, 'error');
    await ipcRenderer.invoke('test-capture', 'preview-error');
    await until(() => mascot().dataset.state === 'idle');
    const rect = panel.panel.current.getBoundingClientRect();
    const dragTarget = document.elementFromPoint(rect.left + 20, rect.top + 20);
    assert.ok(panel.panel.current.querySelector('header').contains(dragTarget));
    dragTarget.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, button: 0, clientX: rect.left + 20, clientY: rect.top + 20
    }));
    document.dispatchEvent(new PointerEvent('pointermove', {bubbles: true, clientX: 400, clientY: 30}));
    document.dispatchEvent(new PointerEvent('pointerup', {bubbles: true}));
    await delay();
    const dragged = panel.panel.current.getBoundingClientRect();
    const menuBottom = document.getElementById('menu').getBoundingClientRect().bottom;
    assert.ok(dragged.top >= menuBottom + 7, 'Float must remain below the menu bar');
    button('API 设置').click();
    await delay();
    const focusables = Array.from(panel.settings.current.querySelectorAll('button,input,select,summary'))
        .filter(element => !element.disabled && element.getClientRects().length);
    const last = focusables[focusables.length - 1];
    last.focus();
    Simulate.keyDown(last, {key: 'Tab', shiftKey: false, preventDefault () {}, stopPropagation () {}});
    assert.strictEqual(document.activeElement, focusables[0], 'Settings focus must be trapped');
    Simulate.keyDown(document.activeElement, {key: 'Escape'});
    await delay();
    await ipcRenderer.invoke('test-resize', 600, 480);
    await delay();
    const compact = panel.panel.current.getBoundingClientRect();
    assert.ok(compact.right <= innerWidth && compact.bottom <= innerHeight);
    assert.ok(panel.composer.current.getBoundingClientRect().bottom <= innerHeight);
    assert.ok(mascot().getBoundingClientRect().right < button('API 设置').getBoundingClientRect().left);
    assert.strictEqual(getComputedStyle(aiButton.querySelector('.est-menu-bar-ai-button-label')).display, 'none');
    assert.ok(aiButton.getBoundingClientRect().width <= 42);
    const mainBounds = document.querySelector('.menu-bar_main-menu_fixture').getBoundingClientRect();
    assert.ok(mainBounds.right < aiButton.getBoundingClientRect().left, 'Compact entry preserves other menu items');
    assert.ok(document.documentElement.scrollWidth <= innerWidth, 'Menu does not create horizontal overflow');
    assert.strictEqual(document.querySelectorAll('.est-menu-bar-ai-button').length, 1);
    assert.strictEqual(document.getElementById('menu').getBoundingClientRect().height, 65);
    await settlePaint();
    await ipcRenderer.invoke('test-capture', 'compact', captureRectangle(panel.panel.current));
    await ipcRenderer.invoke('test-capture', 'mascot-narrow');
    button('关闭').click();
    await delay();
    assert.strictEqual(panel.state.messages.length, 2);
    assert.strictEqual(document.querySelectorAll('[data-est-mascot="true"]').length, 1,
        'Closing unmounts the full-size animated mascot');
    assert.strictEqual(aiButton.getAttribute('aria-pressed'), 'false');
    aiButton.focus();
    await ipcRenderer.invoke('test-key', 'Enter');
    await until(() => panel.state.isOpen);
    assert.strictEqual(document.activeElement, panel.composer.current, 'Keyboard entry focuses the composer');
    aiButton.focus();
    assert.ok(aiButton.matches(':focus-visible'), 'Keyboard focus is visibly indicated');
    assert.strictEqual(getComputedStyle(aiButton).outlineStyle, 'solid');
    aiButton.click();
    assert.strictEqual(document.activeElement, panel.composer.current,
        'An open panel is focused without duplicating it');
    homeVisible = true;
    renderApp();
    await until(() => aiButton.hidden);
    assert.strictEqual(document.querySelector('[role="dialog"]'), null);
    assert.strictEqual(compactMascot.dataset.animated, 'false', 'Home overlay pauses menu mascot');
    homeVisible = false;
    renderApp();
    await until(() => !aiButton.hidden && panel.panel.current);
    window.dispatchEvent(new Event('focus'));
    button('新建对话').click();
    assert.strictEqual(panel.state.messages.length, 0);
    for (const failure of ['api', 'json']) {
        await ipcRenderer.invoke('test-reply', '{}', failure === 'api' ? {error: 'API test failure'} : {});
        setInput(panel.composer.current, '生成程序');
        button('发送').click();
        await until(() => mascot().dataset.state === 'error');
        assert.ok(panel.state.messages[panel.state.messages.length - 1].error);
        await until(() => mascot().dataset.state === 'idle');
    }
    await runCoverageUiTests({workspace, panel, until});
    ReactDOM.unmountComponentAtNode(document.getElementById('root'));
    workspace.dispose();
    return 'EST AI UI passed: real SVG previews, insert/replace undo, menu layering, focus, IME, drag and resize';
};
