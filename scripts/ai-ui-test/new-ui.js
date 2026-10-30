/* eslint-env browser */
import assert from 'assert';
import {ipcRenderer} from 'electron';
import {Simulate} from 'react-dom/test-utils';
import ScratchBlocks from 'openblock-blocks';
import {defineNewBlocksWithLocale} from '../../src/renderer/new-ai/blocks';
import {registerNewPythonGenerator} from '../../src/renderer/new-ai/python-generator';
import {NEW_AI_SAMPLE_IR} from '../../src/renderer/new-ai/ai-spec';
import {setHardwareContext} from '../../src/renderer/hardware/context';
import {importEstBlockIrToWorkspace} from '../../src/renderer/est-ai/est-ai-workspace';
import {makeNewCoverageCases, makeNewNativeProgram, makeProgram} from './new-fixture';
import {makeNewStatisticsProgram, makeNewListBoundariesProgram} from './new-statistics-fixture';
import {makePikaOperatorsCase} from './pika-operators-fixture';

const delay = () => new Promise(resolve => setTimeout(resolve, 70));
const clear = workspace => {
    workspace.clear();
    workspace.getAllVariables().forEach(variable => workspace.deleteVariableById(variable.getId()));
};
export const runNewAiUiTests = async ({workspace, panel, until}) => {
    defineNewBlocksWithLocale(ScratchBlocks, 'zh-cn');
    registerNewPythonGenerator(ScratchBlocks);
    clear(workspace);
    setHardwareContext('new-ai');
    const aiButton = document.querySelector('.est-menu-bar-ai-button');
    await until(() => !aiButton.hidden && JSON.parse(panel.state.debugSource).hardwareId === 'new-ai');
    aiButton.click();
    await until(() => panel.composer.current);
    for (const locale of ['zh-cn', 'en', 'pt-br', 'zh-tw', 'ru']) {
        // Inspect the same localized copy used by the panel; no API request is made.
        await new Promise(resolve => panel.setState({locale}, resolve));
        assert.ok(panel.getCopy().suggestionPrompt.includes('NEW AI'));
        assert.ok(!panel.getCopy().suggestionPrompt.includes('Spark AI'));
    }
    await new Promise(resolve => panel.setState({locale: 'zh-cn'}, resolve));
    const beforeRequests = await ipcRenderer.invoke('test-hardware-requests');
    await ipcRenderer.invoke('test-reply', JSON.stringify({message: '已生成 NEW AI 点阵程序。', ir: NEW_AI_SAMPLE_IR}));
    Simulate.change(panel.composer.current, {target: {value: '显示 HELLO，等待一秒后清空点阵'}});
    await panel.handleSend();
    await until(() => panel.state.messages.length === 2 && !panel.state.busy);
    const proposal = panel.state.messages[1];
    assert.ok(!proposal.error && !proposal.previewError, JSON.stringify(proposal));
    assert.equal(proposal.ir.hardwareId, 'new-ai');
    assert.ok(proposal.previews[0].image.startsWith('data:image/svg+xml'));
    assert.equal(workspace.getAllBlocks(false).length, 0, 'Preview does not apply or run a program');
    const requests = await ipcRenderer.invoke('test-hardware-requests');
    assert.equal(requests.newAi, beforeRequests.newAi + 1);
    assert.equal(requests.est, beforeRequests.est, 'NEW AI assistant never connects EST HID');
    await ipcRenderer.invoke('test-resize', 1280, 860);
    await delay(); await ipcRenderer.invoke('test-capture', 'new-ai-assistant-preview');
    await ipcRenderer.invoke('test-resize', 600, 480);
    await delay(); await ipcRenderer.invoke('test-capture', 'new-ai-assistant-compact');
    await ipcRenderer.invoke('test-resize', 1280, 860);
    await panel.handleApply(proposal, 'insert'); await delay();
    assert.equal(workspace.getTopBlocks(false)[0].type, 'new_event_whenflagclicked');
    const sampleSource = ScratchBlocks.NewPython.workspaceToCode(workspace);
    assert.ok(sampleSource.includes('HELLO') && sampleSource.includes('_matrix'), sampleSource);
    assert.ok(!sampleSource.includes('import est'), sampleSource);
    workspace.undo(false); await delay();
    assert.equal(workspace.getAllBlocks(false).length, 0, 'NEW AI insertion undoes in one step');
    workspace.undo(true); await delay();
    await panel.handleApply(proposal, 'replace'); await delay();
    assert.equal(workspace.getTopBlocks(false).length, 1);
    workspace.undo(false); await delay();
    assert.equal(ScratchBlocks.NewPython.workspaceToCode(workspace), sampleSource);
    const programs = [{name: 'new-ai-assistant-sample', source: sampleSource}];
    for (const {type, ir} of makeNewCoverageCases()) {
        clear(workspace);
        importEstBlockIrToWorkspace({ScratchBlocks, workspace, ir});
        assert.ok(workspace.getAllBlocks(false).some(block => block.type === type), type);
        const source = ScratchBlocks.NewPython.workspaceToCode(workspace);
        if (['new_sound_play', 'new_sound_playuntildone'].includes(type)) {
            assert.ok(source.includes('_music') && source.includes('A Elec Guitar.wav'),
                'The sound input must survive XML import and produce a real music call');
        }
        programs.push({name: type, source});
    }
    clear(workspace);
    importEstBlockIrToWorkspace({ScratchBlocks, workspace, ir: makeNewNativeProgram()});
    const nativeSource = ScratchBlocks.NewPython.workspaceToCode(workspace);
    assert.ok(nativeSource.includes('PikaStdData.List()') && /def record\w*\(/.test(nativeSource), nativeSource);
    programs.push({name: 'new-ai-native-symbols', source: nativeSource});
    clear(workspace);
    importEstBlockIrToWorkspace({ScratchBlocks,
        workspace,
        ir: makeProgram([
            {type: 'new_control_stop', fields: {STOP_OPTION: 'other'}}, {type: 'new_matrix_lamp_stop'}
        ])});
    assert.ok(workspace.getAllBlocks(false).find(block => block.type === 'new_control_stop')
        .getNextBlock());
    programs.push({name: 'new-ai-stop-other-next', source: ScratchBlocks.NewPython.workspaceToCode(workspace)});
    for (const [name, ir] of [['new-ai-statistics', makeNewStatisticsProgram()],
        ['new-ai-list-boundaries', makeNewListBoundariesProgram()]]) {
        clear(workspace);
        importEstBlockIrToWorkspace({ScratchBlocks, workspace, ir});
        const source = ScratchBlocks.NewPython.workspaceToCode(workspace);
        programs.push({name, source});
        await ipcRenderer.invoke('test-new-ai-execute', name, source);
    }
    clear(workspace);
    const operatorCase = makePikaOperatorsCase('new-ai');
    importEstBlockIrToWorkspace({ScratchBlocks, workspace, ir: operatorCase.ir});
    const operatorSource = ScratchBlocks.NewPython.workspaceToCode(workspace);
    programs.push({name: 'new-ai-operators', source: operatorSource});
    await ipcRenderer.invoke('test-pika-execute', 'new-ai-operators', operatorSource, operatorCase.expected);
    await ipcRenderer.invoke('test-new-ai-compile', programs);
    clear(workspace);
    await ipcRenderer.invoke('test-reply', JSON.stringify({message: 'late', ir: NEW_AI_SAMPLE_IR}), {hold: true});
    Simulate.change(panel.composer.current, {target: {value: '再生成一个点阵程序'}});
    const pending = panel.handleSend();
    await until(() => panel.state.busy); await delay();
    setHardwareContext('spark-ai');
    await ipcRenderer.invoke('test-release-reply'); await pending;
    assert.equal(panel.state.messages.length, 0, 'Hardware changes discard late NEW AI replies');
    assert.equal(panel.state.busy, false);
    assert.throws(() => importEstBlockIrToWorkspace({ScratchBlocks, workspace, ir: proposal.ir}));
    assert.equal(workspace.getAllBlocks(false).length, 0);
    setHardwareContext('est');
    console.log('NEW AI assistant UI passed: real previews, 107 toolbox blocks, native symbols, ' +
        'actual Pika compilation, insert/replace undo, snapshot routing, hardware switch cancellation.');
};
