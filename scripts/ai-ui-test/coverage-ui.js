/* eslint-env browser */
import assert from 'assert';
import {ipcRenderer} from 'electron';
import {Simulate} from 'react-dom/test-utils';
import ScratchBlocks from 'openblock-blocks';
import 'openblock-blocks/arduino_compressed';
import 'openblock-blocks/python_compressed';
import {registerEstPythonGenerator} from '../../src/renderer/est-blocks/python-generator';
import {EST_AI_NATIVE_SPECS} from '../../src/renderer/est-ai/est-native-spec';
import {compileEstBlockIrToXml} from '../../src/renderer/est-ai/est-block-compiler';
import {importEstBlockIrToWorkspace} from '../../src/renderer/est-ai/est-ai-workspace';
import {createEstProgramStackPreviews} from '../../src/renderer/est-ai/est-program-preview';
import {makeCoverageIr} from './coverage-fixture';
import {setCurrentEstLocale} from '../../src/renderer/est-i18n';

const delay = () => new Promise(resolve => setTimeout(resolve, 100));
const snapshot = workspace => {
    const dom = ScratchBlocks.Xml.workspaceToDom(workspace);
    // Variable creation order can reverse on undo; identities and content must remain identical.
    const variables = dom.querySelector('variables');
    if (variables) {
        Array.from(variables.children).sort((a, b) => a.getAttribute('id').localeCompare(b.getAttribute('id')))
            .forEach(variable => variables.appendChild(variable));
    }
    return ScratchBlocks.Xml.domToText(dom);
};
const types = workspace => workspace.getAllBlocks(false).map(block => block.type);

export const runCoverageUiTests = async ({workspace, panel, until}) => {
    registerEstPythonGenerator(ScratchBlocks);
    ScratchBlocks.ScratchMsgs.setLocale('zh-cn');
    setCurrentEstLocale('zh-cn');
    workspace.clear();
    await delay();
    workspace.clearUndo();
    const ir = makeCoverageIr();
    await ipcRenderer.invoke('test-resize', 1280, 860);
    panel.handleNewChat();
    await ipcRenderer.invoke('test-reply', JSON.stringify({message: '已生成变量、列表、自定义积木与爱心绘图。', ir}));
    Simulate.change(panel.composer.current, {target: {value: '生成随机计数并存入列表，用带参数的自定义积木显示，再画爱心。'}});
    document.querySelector('button[aria-label=发送]').click();
    await until(() => !panel.state.busy && panel.state.messages.length === 2);
    const message = panel.state.messages[1];
    assert.ok(!message.error && !message.previewError, JSON.stringify(message));
    assert.strictEqual(message.previews.length, 2, 'Definition stack also has a real SVG preview');
    assert.strictEqual(workspace.getAllVariables().length, 0, 'Previews must not create editor variables');
    assert.strictEqual(workspace.getAllBlocks(false).length, 0);
    await delay();
    await ipcRenderer.invoke('test-capture', 'full-coverage-preview');
    await panel.handleApply(message, 'insert');
    await delay();
    assert.strictEqual(workspace.getAllVariables().length, 2);
    assert.strictEqual(workspace.getTopBlocks(false).length, 2);
    const blocks = workspace.getAllBlocks(false);
    const call = blocks.find(block => block.type === 'procedures_call');
    const prototype = blocks.find(block => block.type === 'procedures_prototype');
    assert.strictEqual(call.getProcCode(), '显示记录 %n %s %b');
    assert.strictEqual(call.getProcCode(), prototype.getProcCode());
    const inputs = call.inputList.filter(input => input.connection);
    assert.strictEqual(inputs.length, 3);
    assert.ok(inputs.every(input => input.connection.targetBlock()), 'Every call argument is connected');
    assert.ok(inputs.every(input => prototype.getInput(input.name)), 'Call/definition argument IDs agree');
    assert.notStrictEqual(blocks.find(block => block.type === 'display_draw').getFieldValue('BITMAP'), 'v1:');
    const first = snapshot(workspace);
    const code = ScratchBlocks.Python.workspaceToCode(workspace);
    assert.doesNotMatch(code, /undefined|NaN/);
    assert.match(code, /def /);
    assert.match(code, /\.append\(/);
    await ipcRenderer.invoke('test-python', 'ai-complete-program', code);
    workspace.undo(false);
    await delay();
    assert.strictEqual(workspace.getAllVariables().length, 0, 'One undo removes declarations and blocks');
    assert.strictEqual(workspace.getAllBlocks(false).length, 0);
    workspace.undo(true);
    await delay();
    assert.strictEqual(snapshot(workspace), first, 'Redo restores identities, arguments and bitmap');

    importEstBlockIrToWorkspace({ScratchBlocks, workspace, ir});
    await delay();
    assert.strictEqual(workspace.getAllVariables().length, 4, 'Repeated insert has independent variables');
    assert.ok(workspace.getAllVariables().some(variable => variable.name === '计数 (2)'));
    assert.ok(workspace.getAllBlocks(false).some(block =>
        block.type === 'procedures_call' && block.getProcCode() === '显示记录 (2) %n %s %b'));
    workspace.undo(false);
    await delay();
    assert.strictEqual(snapshot(workspace), first, 'Collision-safe insert undoes without touching old content');
    workspace.undo(true);
    await delay();
    const beforeReplace = snapshot(workspace);
    importEstBlockIrToWorkspace({ScratchBlocks, workspace, ir, mode: 'replace'});
    await delay();
    assert.strictEqual(workspace.getAllVariables().length, 2);
    workspace.undo(false);
    await delay();
    assert.strictEqual(snapshot(workspace), beforeReplace, 'Replace undo restores both prior symbol sets');

    // Every newly exposed native opcode also renders with a real block and generates Python.
    const all = makeCoverageIr();
    Object.values(EST_AI_NATIVE_SPECS).filter(spec => spec.category !== 'procedures')
        .forEach(spec => {
            const node = {type: spec.type};
            if (Object.keys(spec.fields).length) {
                node.fields = Object.fromEntries(Object.entries(spec.fields)
                    .map(([name, field]) => [name, field.values ? field.values[0] :
                        (field.variableType === 'list' ? '记录' : '计数')]));
            }
            if (Object.keys(spec.inputs).length) {
                node.inputs = Object.fromEntries(Object.entries(spec.inputs)
                    .map(([name, input]) => [name, input.kind === 'text' ? 'EST' : 1]));
            }
            all.stacks[0].body.push(spec.kind === 'statement' ? node : spec.kind === 'boolean' ?
                {type: 'control_if', inputs: {CONDITION: node}, body: []} :
                {type: 'display_text_line', inputs: {LINE: 1, TEXT: node}});
        });
    EST_AI_NATIVE_SPECS.operator_mathop.fields.OPERATOR.values.forEach(value => {
        all.stacks[0].body.push({type: 'display_text_line',
            inputs: {LINE: 1,
                TEXT: {
                    type: 'operator_mathop', fields: {OPERATOR: value}, inputs: {NUM: value === 'acos' ? 0.5 : 1}
                }}});
    });
    all.procedures.push({name: '无参数', arguments: [], warp: true});
    all.stacks.push({event: {type: 'procedures_definition', fields: {PROCEDURE: '无参数'}}, body: []});
    all.stacks[0].body.push({type: 'procedures_call', fields: {PROCEDURE: '无参数'}});
    all.stacks[0].body.push({type: 'procedures_call',
        fields: {PROCEDURE: '显示记录'},
        inputs: {
            序号: 0, 前缀: '', 可见: {type: 'operator_equals', inputs: {OPERAND1: 0, OPERAND2: 1}}
        }});
    const allPreviews = await createEstProgramStackPreviews(compileEstBlockIrToXml(all).xml);
    assert.strictEqual(allPreviews.length, 3);
    importEstBlockIrToWorkspace({ScratchBlocks, workspace, ir: all, mode: 'replace'});
    Object.keys(EST_AI_NATIVE_SPECS).forEach(type => assert.ok(types(workspace).includes(type), `Missing ${type}`));
    await ipcRenderer.invoke('test-python', 'ai-all-native-blocks', ScratchBlocks.Python.workspaceToCode(workspace));
    const saved = snapshot(workspace);
    workspace.clear();
    ScratchBlocks.Xml.domToWorkspace(ScratchBlocks.Xml.textToDom(saved), workspace);
    assert.strictEqual(snapshot(workspace), saved, 'Native XML save/load preserves the full program');
    // Reporter removal must restore the input, including after saving and reloading XML.
    const shadowIr = {version: 1,
        mode: 'replace',
        stacks: [{
            event: {type: 'event_program_start'},
            body: [{type: 'display_text_line',
                inputs: {
                    LINE: 1,
                    TEXT: {type: 'operator_mathop',
                        fields: {OPERATOR: 'abs'},
                        inputs: {
                            NUM: {type: 'operator_subtract', inputs: {NUM1: 10, NUM2: 20}}
                        }}
                }}]
        }]};
    importEstBlockIrToWorkspace({ScratchBlocks, workspace, ir: shadowIr, mode: 'replace'});
    const shadowSaved = snapshot(workspace);
    workspace.clear();
    ScratchBlocks.Xml.domToWorkspace(ScratchBlocks.Xml.textToDom(shadowSaved), workspace);
    const absolute = workspace.getAllBlocks(false).find(block => block.type === 'operator_mathop');
    const subtraction = absolute.getInputTargetBlock('NUM');
    subtraction.unplug();
    await delay();
    const restoredNumber = absolute.getInputTargetBlock('NUM');
    assert.ok(restoredNumber && restoredNumber.isShadow(), 'Unplugging restores numeric shadow');
    assert.strictEqual(restoredNumber.type, 'math_number');
    restoredNumber.setFieldValue('42', 'NUM');
    assert.strictEqual(Number(restoredNumber.getFieldValue('NUM')), 42, 'Restored input is editable');
    absolute.getInput('NUM').connection.connect(subtraction.outputConnection);
    assert.strictEqual(absolute.getInputTargetBlock('NUM'), subtraction, 'Reporter reconnects normally');
    const display = workspace.getAllBlocks(false).find(block => block.type === 'display_text_line');
    absolute.unplug();
    await delay();
    assert.strictEqual(display.getInputTargetBlock('TEXT').type, 'text', 'Text shadow also restores');
    assert.ok(display.getInputTargetBlock('TEXT').isShadow());
    console.log('AI coverage UI passed: declarations, arguments, bitmap, collision-safe insert, undo/redo and Python');
};
