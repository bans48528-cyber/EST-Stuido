/* eslint-env browser */
// Explicit online acceptance using saved production credentials, never a hardware transport.
import assert from 'assert';
import {ipcRenderer} from 'electron';
import ScratchBlocks from 'openblock-blocks';
import {defineNewBlocksWithLocale} from '../../src/renderer/new-ai/blocks';
import {registerNewPythonGenerator} from '../../src/renderer/new-ai/python-generator';
import {setHardwareContext} from '../../src/renderer/hardware/context';
import {generateEstAiReply} from '../../src/renderer/est-ai/est-ai-chat';
import {importEstBlockIrToWorkspace} from '../../src/renderer/est-ai/est-ai-workspace';
import {createEstProgramStackPreviews} from '../../src/renderer/est-ai/est-program-preview';

const flatten = ir => {
    const result = [];
    const visit = node => {
        result.push(node);
        Object.values(node.inputs || {}).filter(value => value && typeof value === 'object')
            .forEach(visit);
        (node.body || []).forEach(visit); (node.elseBody || []).forEach(visit);
    };
    ir.stacks.forEach(stack => {
        visit(stack.event); stack.body.forEach(visit);
    });
    return result;
};
export const runNewAiOnlineTests = async ({workspace, panel, until}) => {
    const report = {cases: [], passed: false};
    try {
        const status = await ipcRenderer.invoke('test-online-status');
        assert.ok(status.configured, 'Configure an AI endpoint in ATC CodeStudio before online validation');
        report.endpointOrigin = new URL(status.config.baseUrl).origin;
        report.model = status.config.model;
        console.log(`Online NEW AI endpoint: ${report.endpointOrigin}; model: ${report.model}`);
        defineNewBlocksWithLocale(ScratchBlocks, 'zh-cn');
        registerNewPythonGenerator(ScratchBlocks);
        setHardwareContext('new-ai');
        await until(() => JSON.parse(panel.state.debugSource).hardwareId === 'new-ai');
        document.querySelector('.est-menu-bar-ai-button').click();
        await until(() => panel.composer.current);
        await new Promise(resolve => panel.setState({configured: true,
            savedConfig: status.config,
            hasSavedKey: status.hasKey}, resolve));
        document.querySelector('.menu-bar_tail-menu_fixture span').textContent = 'NEW AI 在线生成验证';
        const fixture = {source: 'Explicit test fixture, not a live device',
            ports: [{port: 'A', type: 'big_motor'}, {port: 'B', type: 'color'}, {port: 'C', type: 'ultrasion'}],
            motorPorts: [{port: 'A', type: 'big_motor'}],
            sensorPorts: [{port: 'B', type: 'color'}, {port: 'C', type: 'ultrasion'}]};
        const cases = [{id: 'hello',
            text: '用 NEW AI 点阵显示 HELLO，等待1秒后清空点阵。只显示，不操作电机。'},
        {id: 'follow-up',
            text: '保持刚才程序结构不变，把 HELLO 改为 EST，把等待时间改为2秒。',
            followUp: true},
        {id: 'ultrasonic',
            text: '测试配置：NEW AI 的C口接超声波。程序启动后一直判断：距离小于20厘米时，点阵全部亮红色；' +
                '否则全部亮蓝色。每轮等待0.1秒。不要操作电机。'}];
        let history = [];
        for (const item of cases) {
            const messages = (item.followUp ? history : []).concat({role: 'user', text: item.text});
            const started = performance.now();
            let attempts = 0;
            const reply = await generateEstAiReply({id: `new-ai-online-${item.id}-${Date.now()}`,
                locale: 'zh-cn',
                hardwareId: 'new-ai',
                hardwareContext: fixture,
                messages,
                invoke: (channel, request) => {
                    assert.equal(channel, 'est-ai-generate'); attempts++;
                    return ipcRenderer.invoke('est-ai-online-generate', request);
                }});
            assert.ok(reply.ir, `${item.id}: model must return a program, not a clarification`);
            const nodes = flatten(reply.ir);
            assert.ok(!nodes.some(node => /^new_(motor_|combined_|grayv2_power)/.test(node.type)),
                'Read-only examples must not contain motor actuation');
            if (item.id === 'ultrasonic') {
                assert.ok(nodes.some(node => node.type.includes('sensing_ultrasonic') && node.inputs.PORT === 'C'));
                assert.ok(nodes.some(node => node.type === 'new_control_forever'));
                assert.ok(nodes.some(node => node.type === 'new_control_if_else'));
                const colors = nodes.filter(node => node.type === 'new_matrix_lamp')
                    .map(node => node.inputs.COLOR.toLowerCase());
                assert.ok(colors.includes('#ff0000') && colors.includes('#0000ff'), 'both RGB branches are required');
            } else {
                const expected = item.id === 'hello' ? 'HELLO' : 'EST';
                const duration = item.id === 'hello' ? 1 : 2;
                assert.ok(nodes.some(node => node.type === 'new_matrix_lamp_text' &&
                    node.inputs.matrix_text === expected));
                assert.ok(nodes.some(node => node.type === 'new_control_wait' && node.inputs.DURATION === duration));
                assert.ok(nodes.some(node => node.type === 'new_matrix_lamp_stop'));
            }
            const previews = await createEstProgramStackPreviews(reply.compiled.xml);
            assert.ok(previews.length && previews.every(preview => preview.image.startsWith('data:image/svg+xml')));
            workspace.clear();
            workspace.getAllVariables().forEach(variable => workspace.deleteVariableById(variable.getId()));
            importEstBlockIrToWorkspace({ScratchBlocks, workspace, ir: reply.ir, mode: 'replace'});
            const source = ScratchBlocks.NewPython.workspaceToCode(workspace);
            await ipcRenderer.invoke('test-new-ai-compile', [{name: `new-ai-online-${item.id}`, source}]);
            await new Promise(resolve => panel.setState({messages: [
                {id: `${item.id}-user`, role: 'user', text: item.text},
                {id: item.id, role: 'assistant', text: reply.message, ir: reply.ir, previews}
            ]}, resolve));
            await new Promise(resolve => setTimeout(resolve, 150));
            await ipcRenderer.invoke('test-capture', `new-ai-online-${item.id}`);
            report.cases.push({id: item.id,
                request: item.text,
                elapsedMs: Math.round(performance.now() - started),
                attempts,
                message: reply.message,
                ir: reply.ir,
                pythonCompiled: true,
                previewed: true});
            await ipcRenderer.invoke('test-online-record', report);
            history = messages.concat({role: 'assistant', text: reply.message, ir: reply.ir});
        }
        report.passed = true;
        await ipcRenderer.invoke('test-online-record', report);
        return 'NEW AI online acceptance passed: real model replies, follow-up edits, ultrasonic RGB branches, ' +
            'previews, import and Pika compilation. No hardware used.';
    } catch (error) {
        report.error = error.message;
        await ipcRenderer.invoke('test-online-record', report);
        throw error;
    }
};
