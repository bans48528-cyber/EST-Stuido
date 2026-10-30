/* eslint-env browser */
import assert from 'assert';
import {ipcRenderer} from 'electron';
import {Simulate} from 'react-dom/test-utils';
import ScratchBlocks from 'openblock-blocks';
import {defineSparkBlocksWithLocale} from '../../src/renderer/spark-ai/blocks';
import {registerSparkPythonGenerator} from '../../src/renderer/spark-ai/python-generator';
import {SPARK_AI_SAMPLE_IR} from '../../src/renderer/spark-ai/ai-spec';
import {setHardwareContext} from '../../src/renderer/hardware/context';
import {importEstBlockIrToWorkspace} from '../../src/renderer/est-ai/est-ai-workspace';
import {makeSparkCoverageCases, makeSparkNativeProgram} from './spark-fixture';
import {makePikaOperatorsCase, toSparkProgram} from './pika-operators-fixture';
import {makeNewStatisticsProgram, makeNewListBoundariesProgram} from './new-statistics-fixture';

const delay = () => new Promise(resolve => setTimeout(resolve, 100));
const clear = workspace => {
    workspace.clear();
    workspace.getAllVariables().forEach(variable => workspace.deleteVariableById(variable.getId()));
};

export const runSparkAiUiTests = async ({workspace, panel, until}) => {
    defineSparkBlocksWithLocale(ScratchBlocks, 'zh-cn');
    registerSparkPythonGenerator(ScratchBlocks);
    clear(workspace);
    setHardwareContext('spark-ai');
    const aiButton = document.querySelector('.est-menu-bar-ai-button');
    await until(() => !aiButton.hidden && panel.state.messages.length === 0);
    aiButton.click();
    await until(() => panel.composer.current);
    assert.ok(panel.getCopy().suggestionPrompt.includes('Spark AI'));
    assert.ok(!panel.getCopy().suggestionPrompt.includes('B、C'));
    assert.equal(JSON.parse(panel.state.debugSource).hardwareId, 'spark-ai');
    await ipcRenderer.invoke('test-reply', JSON.stringify({message: '已生成 Spark AI 点阵程序。', ir: SPARK_AI_SAMPLE_IR}));
    Simulate.change(panel.composer.current, {target: {value: '显示 HELLO，等待一秒后清空点阵'}});
    await panel.handleSend();
    await until(() => panel.state.messages.length === 2 && !panel.state.busy);
    const proposal = panel.state.messages[1];
    assert.ok(!proposal.error && !proposal.previewError, JSON.stringify(proposal));
    assert.equal(proposal.ir.hardwareId, 'spark-ai');
    assert.ok(proposal.previews[0].image.startsWith('data:image/svg+xml'));
    assert.equal(workspace.getAllBlocks(false).length, 0, 'Generating Spark proposals must not apply them');
    await ipcRenderer.invoke('test-resize', 1280, 860);
    await delay();
    await ipcRenderer.invoke('test-capture', 'spark-ai-assistant-preview');
    await ipcRenderer.invoke('test-resize', 600, 480);
    await delay();
    const compact = panel.panel.current.getBoundingClientRect();
    assert.ok(compact.right <= innerWidth && compact.bottom <= innerHeight);
    await ipcRenderer.invoke('test-capture', 'spark-ai-assistant-compact');
    await ipcRenderer.invoke('test-resize', 1280, 860);
    await panel.handleApply(proposal, 'insert');
    await delay();
    assert.equal(workspace.getTopBlocks(false)[0].type, 'spark_event_whenflagclicked');
    const source = ScratchBlocks.SparkPython.workspaceToCode(workspace);
    assert.ok(source.includes("_matrix.show_roll(str('HELLO'))"), source);
    assert.ok(source.includes('_os.sleep_s(1)'), source);
    assert.ok(!source.includes('import est'), source);
    await ipcRenderer.invoke('test-python', 'spark-ai-assistant-sample', source, 'spark-ai');
    workspace.undo(false);
    await delay();
    assert.equal(workspace.getAllBlocks(false).length, 0, 'Spark insertion undoes in one step');
    workspace.undo(true);
    await delay();
    assert.equal(workspace.getTopBlocks(false).length, 1);
    await panel.handleApply(proposal, 'replace');
    await delay();
    assert.equal(workspace.getTopBlocks(false).length, 1);
    workspace.undo(false);
    await delay();
    assert.equal(ScratchBlocks.SparkPython.workspaceToCode(workspace), source);
    const programs = [];
    for (const {type, ir} of makeSparkCoverageCases()) {
        clear(workspace);
        importEstBlockIrToWorkspace({ScratchBlocks, workspace, ir});
        assert.ok(workspace.getAllBlocks(false).some(block => block.type === type), type);
        const code = ScratchBlocks.SparkPython.workspaceToCode(workspace);
        assert.ok(code.trim() || type === 'spark_event_whenflagclicked', type);
        programs.push(`# ${type}\n${code}`);
    }
    await ipcRenderer.invoke('test-python', 'spark-ai-assistant-all-blocks', programs.join('\n'), 'spark-ai');
    clear(workspace);
    importEstBlockIrToWorkspace({ScratchBlocks, workspace, ir: makeSparkNativeProgram()});
    const nativeSource = ScratchBlocks.SparkPython.workspaceToCode(workspace);
    assert.ok(nativeSource.includes('PikaStdData.List()') && /def record\w*\(/.test(nativeSource), nativeSource);
    await ipcRenderer.invoke('test-python', 'spark-ai-assistant-native-symbols', nativeSource, 'spark-ai');
    const operatorCase = makePikaOperatorsCase('spark-ai');
    const semanticPrograms = [];
    for (const [name, ir, expected] of [
        ['spark-ai-statistics', toSparkProgram(makeNewStatisticsProgram())],
        ['spark-ai-list-boundaries', toSparkProgram(makeNewListBoundariesProgram())],
        ['spark-ai-operators', operatorCase.ir, operatorCase.expected]
    ]) {
        clear(workspace);
        importEstBlockIrToWorkspace({ScratchBlocks, workspace, ir});
        const semanticSource = ScratchBlocks.SparkPython.workspaceToCode(workspace);
        semanticPrograms.push({name, source: semanticSource});
        await ipcRenderer.invoke('test-pika-execute', name, semanticSource, expected);
    }
    await ipcRenderer.invoke('test-spark-ai-compile', semanticPrograms);
    clear(workspace);
    await ipcRenderer.invoke('test-reply', JSON.stringify({message: 'late', ir: SPARK_AI_SAMPLE_IR}), {hold: true});
    Simulate.change(panel.composer.current, {target: {value: '再生成一个点阵程序'}});
    const pending = panel.handleSend();
    await until(() => panel.state.busy);
    await delay();
    setHardwareContext('est');
    await ipcRenderer.invoke('test-release-reply');
    await pending;
    assert.equal(panel.state.messages.length, 0, 'Hardware changes discard stale replies and conversation');
    assert.equal(panel.state.busy, false);
    assert.throws(() => importEstBlockIrToWorkspace({ScratchBlocks, workspace, ir: proposal.ir}));
    assert.equal(workspace.getAllBlocks(false).length, 0);
    setHardwareContext('new-ai');
    await until(() => !aiButton.hidden && JSON.parse(panel.state.debugSource).hardwareId === 'new-ai');
    setHardwareContext('est');
    await until(() => !aiButton.hidden);
    console.log('Spark assistant UI passed: real previews, 66-block Python syntax, ' +
        'insert/replace undo, hardware switch cancellation.');
};
