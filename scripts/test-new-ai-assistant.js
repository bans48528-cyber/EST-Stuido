/* eslint-disable global-require */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const babel = require('@babel/core');
const root = path.resolve(__dirname, '..');
const originalLoader = Module._extensions['.js'];
Module._extensions['.svg'] = (module, filename) => {
    module.exports = filename;
};
Module._extensions['.png'] = (module, filename) => {
    module.exports = filename;
};
Module._extensions['.js'] = (module, filename) => {
    if (!filename.startsWith(path.join(root, 'src'))) return originalLoader(module, filename);
    module._compile(babel.transformSync(fs.readFileSync(filename, 'utf8'), {
        babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs']
    }).code, filename);
};
const {compileEstBlockIrToXml} = require('../src/renderer/est-ai/est-block-compiler');
const {validateEstBlockIr} = require('../src/renderer/est-ai/est-block-validator');
const {buildEstAiSystemPrompt, generateEstAiReply, selectEstAiRuleCategories, getAiSampleIr} =
    require('../src/renderer/est-ai/est-ai-chat');
const {NEW_AI_BLOCK_SPEC, NEW_AI_SAMPLE_IR} = require('../src/renderer/new-ai/ai-spec');
const {createNewAiHardwareContext} = require('../src/renderer/est-ai/est-ai-hardware-context');
const {setHardwareContext, isAiHardwareActive} = require('../src/renderer/hardware/context');
const {importEstBlockIrToWorkspace} = require('../src/renderer/est-ai/est-ai-workspace');
const {makeProgram, makeNewCoverageCases, makeNewNativeProgram} = require('./ai-ui-test/new-fixture');
(async () => {
    const options = {hardwareId: 'new-ai'};
    const cases = makeNewCoverageCases();
    assert.equal(cases.length, 107);
    for (const {type, ir} of cases) {
        const compiled = compileEstBlockIrToXml(ir, options);
        assert.ok(compiled.xml.includes(`type="${type}"`), type);
        assert.equal(compiled.normalized.hardwareId, 'new-ai');
    }
    assert.ok(compileEstBlockIrToXml(makeNewNativeProgram(), options).xml.includes('procedures_prototype'));
    const invalid = (body, code) => assert.ok(validateEstBlockIr(makeProgram(body), options).errors
        .some(error => error.code === code), code);
    invalid([{type: 'new_motor_stop', inputs: {PORT: 'I'}}], 'INVALID_ENUM_INPUT');
    for (const pair of ['A+A', 'A+?', 'A+B+C']) {
        invalid([{type: 'new_combined_motor_starting', inputs: {PORT: pair}}], 'INVALID_ENUM_INPUT');
    }
    invalid([{type: 'new_matrix_lamp', fields: {lamp: '1'.repeat(35)}, inputs: {COLOR: '#00aaff'}}], 'INVALID_MATRIX');
    invalid([{type: 'new_matrix_lamp', fields: {lamp: '1'.repeat(63)}, inputs: {COLOR: 'red'}}], 'INVALID_COLOUR');
    invalid([{type: 'new_matrix_lamp_single', inputs: {x: '9', y: '0', brightness: 50}}], 'INVALID_ENUM_INPUT');
    invalid([{type: 'new_control_break'}], 'BREAK_OUTSIDE_LOOP');
    invalid([{type: 'new_control_wait', inputs: {DURATION: -1}}], 'NUMBER_TOO_SMALL');
    for (const matrixText of ['总和99', 'sum=99', 'SUM:99', 'SUM 99', 'A'.repeat(32),
        {type: 'new_operator_join', inputs: {STRING1: 'SUM', STRING2: ':99'}}]) {
        invalid([{type: 'new_matrix_lamp_text', inputs: {matrix_text: matrixText}}], 'INVALID_MATRIX_TEXT');
    }
    assert.ok(validateEstBlockIr(makeProgram([{type: 'new_matrix_lamp_text',
        inputs: {matrix_text: 'A'.repeat(31)}}]), options).valid);
    assert.ok(validateEstBlockIr(makeProgram([{type: 'new_matrix_lamp_text',
        inputs: {matrix_text: {type: 'new_operator_join', inputs: {STRING1: 'SUM=', STRING2: 99}}}}]), options).valid);
    invalid([{type: 'new_sound_play', inputs: {SOUND_MENU: 'arbitrary"code'}}], 'INVALID_ENUM_INPUT');
    invalid([{type: 'spark_motor_stop', inputs: {PORT: 'E'}}], 'UNKNOWN_BLOCK');
    invalid([{type: 'motor_stop', inputs: {PORT: 'A'}}], 'UNKNOWN_BLOCK');
    invalid([{type: 'new_control_stop', fields: {STOP_OPTION: 'single'}},
        {type: 'new_matrix_lamp_stop'}], 'TERMINAL_BLOCK_HAS_NEXT');
    assert.ok(validateEstBlockIr(makeProgram([{type: 'new_control_stop', fields: {STOP_OPTION: 'other'}},
        {type: 'new_matrix_lamp_stop'}]), options).valid);
    for (const hardwareId of ['est', 'spark-ai', null]) {
        assert.throws(() => compileEstBlockIrToXml({...NEW_AI_SAMPLE_IR, hardwareId}, options), /硬件/);
    }
    const missingHardware = {...NEW_AI_SAMPLE_IR}; delete missingHardware.hardwareId;
    assert.throws(() => compileEstBlockIrToXml(missingHardware, options), /硬件/);
    assert.equal(NEW_AI_BLOCK_SPEC.new_matrix_lamp.fields.lamp.length, 63);
    assert.equal(getAiSampleIr('new-ai').hardwareId, 'new-ai');
    for (const locale of ['zh-cn', 'en', 'pt-br', 'zh-tw', 'ru']) {
        const prompt = buildEstAiSystemPrompt(locale,
            ['event', 'movement', 'motor', 'display', 'sound', 'control', 'sensing', 'vision', 'operators'],
            null, 'new-ai');
        assert.ok(prompt.includes('new_event_whenflagclicked') && prompt.includes('63 binary digits'));
        assert.ok(prompt.includes('descriptor.shadow is UI metadata, never an IR node'));
        assert.ok(prompt.includes('"inputs":{"matrix_text":"HELLO"}'));
        assert.ok(prompt.length <= 100000, 'full NEW AI rules fit the existing AI IPC message limit');
        assert.ok(prompt.includes('A-H') && prompt.includes('first=left'));
        assert.ok(!prompt.includes('"type":"spark_motor_stop"') && !prompt.includes('"type":"motor_stop"'));
        assert.ok(prompt.includes('physical NEW AI camera') &&
            prompt.includes('PC webcam vision input is not supported'));
        assert.ok(prompt.includes('uppercase English display labels') && prompt.includes('31 characters'));
        assert.ok(prompt.includes('do not subtract 1 in the blocks'));
    }
    for (const text of ['摄像头人脸识别', 'physical camera face recognition', 'câmera', 'камера']) {
        assert.ok(selectEstAiRuleCategories([{role: 'user', text}], 'new-ai').includes('vision'));
    }
    assert.ok(selectEstAiRuleCategories([{role: 'user', text: 'Mostrar HELLO na matriz e esperar um segundo'}],
        'new-ai').includes('display'));
    const state = {connected: true,
        stale: false,
        status: {version: 321,
            ports: [
                {port: 0, type: 'big_motor'}, {port: 1, type: 'color'}, {port: 2, type: 'ultrasion'}
            ]}};
    assert.equal(createNewAiHardwareContext({...state, stale: true}), null);
    assert.equal(createNewAiHardwareContext({...state, connected: false}), null);
    assert.equal(createNewAiHardwareContext({...state, status: {...state.status, version: 214}}), null);
    const snapshot = createNewAiHardwareContext(state);
    assert.deepStrictEqual(snapshot.motorPorts, [{port: 'A', type: 'big_motor'}]);
    assert.equal(snapshot.sensorPorts[0].port, 'B'); assert.equal(snapshot.ports.length, 8);
    let calls = 0;
    const reply = await generateEstAiReply({id: 'new-ai-test',
        hardwareId: 'new-ai',
        locale: 'zh-cn',
        messages: [{role: 'user', text: '显示 HELLO，等待一秒后清空点阵'}],
        hardwareContext: snapshot,
        invoke: (channel, payload) => {
            calls++;
            assert.equal(channel, 'est-ai-generate');
            assert.ok(payload.messages[0].content.includes('new_matrix_lamp_text'));
            assert.ok(payload.messages[0].content.includes('NEW AI live snapshot'));
            return Promise.resolve({ok: true,
                data: {content: JSON.stringify({message: 'NEW AI 候选程序',
                    ir: calls === 1 ? {...NEW_AI_SAMPLE_IR, hardwareId: 'spark-ai'} : NEW_AI_SAMPLE_IR})}});
        }});
    assert.equal(calls, 2); assert.equal(reply.ir.hardwareId, 'new-ai');
    let displayRepairs = 0;
    const repairedDisplay = await generateEstAiReply({id: 'new-ai-display-repair',
        hardwareId: 'new-ai',
        locale: 'zh-cn',
        messages: [{role: 'user', text: '显示总和99'}],
        invoke: (channel, request) => {
            displayRepairs++;
            if (displayRepairs > 1) assert.ok(request.messages.at(-1).content.includes('点阵'));
            return Promise.resolve({ok: true,
                data: {content: JSON.stringify({message: '显示统计结果',
                    ir: makeProgram([{type: 'new_matrix_lamp_text',
                        inputs: {
                            matrix_text: displayRepairs === 1 ? '总和:99' : 'SUM=99'
                        }}])})}});
        }});
    assert.equal(displayRepairs, 2);
    assert.ok(repairedDisplay.compiled.xml.includes('SUM=99'));
    setHardwareContext('new-ai'); assert.ok(isAiHardwareActive());
    setHardwareContext('new-ai', true); assert.ok(!isAiHardwareActive());
    setHardwareContext('spark-ai');
    let clears = 0;
    assert.throws(() => importEstBlockIrToWorkspace({workspace: {clear: () => clears++}, ir: NEW_AI_SAMPLE_IR}));
    assert.equal(clears, 0); setHardwareContext('est');
    console.log('NEW AI assistant passed: 107 blocks, A-H ports, 63-bit RGB matrix, colours, ' +
        'sound whitelist, loop/stop validation, prompts, repair, snapshots and hardware isolation.');
})().catch(error => {
    console.error(error); process.exitCode = 1;
});
