/* eslint-env browser */
import assert from 'assert';
import {Simulate} from 'react-dom/test-utils';
import {ipcRenderer} from 'electron';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const paint = () => new Promise(resolve => requestAnimationFrame(() => resolve()));
const percentile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];

// Uses local fixture text only. Does not contact an AI service or a device.
export const runTypingPerformance = async ({panel, until, workspace, strict = false}) => {
    const wasOpen = panel.state.isOpen;
    panel.handleOpen();
    await until(() => panel.composer.current);
    workspace.clear();
    for (let index = 0; index < 100; index++) {
        const block = workspace.newBlock('operator_add');
        block.initSvg(); block.render(); block.moveBy(10 + ((index % 5) * 75), Math.floor(index / 5) * 40);
    }
    const messages = Array.from({length: 8}, (_, index) => ({id: `typing-${index}`,
        role: index % 2 ? 'assistant' : 'user',
        text: '本地输入性能测试。'.repeat(10)}));
    await new Promise(resolve => panel.setState({messages, input: '', busy: false}, resolve));
    // Blockly queues SVG/scrollbar housekeeping after block creation. Let that setup finish
    // before measuring input, rather than counting fixture initialization as a keystroke.
    await pause(700);
    await paint();
    let panelRenders = 0; let messageRenders = 0; let heightWrites = 0;
    const render = panel.render; const renderMessage = panel.renderMessage;
    panel.render = function (...args) {
        panelRenders++; return render.apply(this, args);
    };
    panel.renderMessage = function (...args) {
        messageRenders++; return renderMessage.apply(this, args);
    };
    const observer = new MutationObserver(records => {
        heightWrites += records.length;
    });
    const input = panel.composer.current;
    observer.observe(input, {attributes: true, attributeFilter: ['style']});
    const times = []; const syncTimes = [];
    try {
        let value = '';
        for (const char of '用 NEW AI 显示你好，等待一秒后清屏。'.repeat(5)) {
            const start = performance.now();
            value += char;
            Simulate.change(input, {target: {value}});
            syncTimes.push(performance.now() - start);
            await paint();
            times.push(performance.now() - start);
        }
        assert.equal(input.value, value, 'Chinese/Latin typing must preserve every character');
        panel.history.current.scrollTop = 0;
        input.focus(); input.setSelectionRange(2, 2);
        await new Promise(resolve => panel.setState({mascotState: 'idle'}, resolve));
        assert.equal(input.selectionStart, 2, 'Unrelated updates preserve the caret');
        assert.equal(panel.history.current.scrollTop, 0, 'Typing must not jump conversation history to the bottom');
        // Input must also shrink after multiline text, without moving the caret on rerenders.
        Simulate.change(input, {target: {value: '第一行\n第二行\n第三行\n第四行\n第五行\n第六行'}});
        await paint(); await paint();
        assert.ok(input.clientHeight >= 100 && input.clientHeight <= 112, 'Multiline input remains bounded');
        Simulate.change(input, {target: {value: '中文'}});
        await paint(); await paint();
        assert.ok(input.clientHeight <= 40, 'Deleting text shrinks the input');
        Simulate.keyDown(input, {key: 'Enter', keyCode: 229, nativeEvent: {isComposing: true}});
        assert.equal(panel.state.messages, messages, 'IME confirmation must not send a request');
        const report = {characters: times.length,
            messageCount: messages.length,
            workspaceBlocks: 100,
            panelRenders,
            messageRenders,
            heightWrites,
            syncP95Ms: percentile(syncTimes, 0.95),
            syncMaxMs: Math.max(...syncTimes),
            paintP95Ms: percentile(times, 0.95),
            paintMaxMs: Math.max(...times),
            slowInputs: times.map((ms, index) => ({index, ms})).filter(sample => sample.ms > 50),
            modelRequests: 0,
            deviceCommands: 0};
        if (strict) assert.equal(messageRenders, 0, 'Typing must not render unchanged conversation messages');
        if (strict) assert.ok(heightWrites < 20, 'Input height changes only when wrapping changes');
        await ipcRenderer.invoke('test-typing-report', report);
        return report;
    } finally {
        observer.disconnect();
        // This test owns the instrumentation; no other code writes these methods.
        Object.assign(panel, {render, renderMessage});
        workspace.clear();
        await new Promise(resolve => panel.setState({messages: [], input: ''}, resolve));
        if (!wasOpen) panel.handleClose();
    }
};
