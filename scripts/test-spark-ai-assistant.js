const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const babel = require('@babel/core');
const root = path.resolve(__dirname, '..');
const originalLoader = Module._extensions['.js'];
const originalSvg = Module._extensions['.svg'];
const originalPng = Module._extensions['.png'];
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
const {generateEstAiReply, buildEstAiSystemPrompt, selectEstAiRuleCategories} =
    require('../src/renderer/est-ai/est-ai-chat');
const {SPARK_AI_SAMPLE_IR} = require('../src/renderer/spark-ai/ai-spec');
const {createSparkAiHardwareContext} = require('../src/renderer/est-ai/est-ai-hardware-context');
const {importEstBlockIrToWorkspace} = require('../src/renderer/est-ai/est-ai-workspace');
const {setHardwareContext, isAiHardwareActive} = require('../src/renderer/hardware/context');
const {makeSparkCoverageCases, makeProgram, makeSparkNativeProgram} = require('./ai-ui-test/spark-fixture');

(async () => {
    const options = {hardwareId: 'spark-ai'};
    const cases = makeSparkCoverageCases();
    assert.equal(cases.length, 66);
    for (const {type, ir} of cases) {
        const result = compileEstBlockIrToXml(ir, options);
        assert.ok(result.xml.includes(`type="${type}"`), type);
        assert.equal(result.normalized.hardwareId, 'spark-ai');
    }
    assert.ok(compileEstBlockIrToXml(makeSparkNativeProgram(), options).xml.includes('procedures_prototype'));
    const invalid = (body, code) => assert.ok(validateEstBlockIr(makeProgram(body), options).errors
        .some(error => error.code === code), code);
    invalid([{type: 'spark_motor_stop', inputs: {PORT: 'A'}}], 'INVALID_ENUM_INPUT');
    for (const pair of ['E+E', 'E+?']) {
        invalid([{type: 'spark_combined_motor_starting', fields: {STATUS: '3'}, inputs: {PORT: pair}}],
            'INVALID_ENUM_INPUT');
    }
    invalid([{type: 'spark_matrix_lamp', fields: {lamp: '1'.repeat(36)}}], 'INVALID_MATRIX');
    invalid([{type: 'spark_control_break'}], 'BREAK_OUTSIDE_LOOP');
    invalid([{type: 'spark_control_wait', inputs: {DURATION: -1}}], 'NUMBER_TOO_SMALL');
    invalid([{type: 'motor_stop', inputs: {PORT: 'A'}}], 'UNKNOWN_BLOCK');
    assert.throws(() => compileEstBlockIrToXml(SPARK_AI_SAMPLE_IR), /硬件/);
    assert.throws(() => compileEstBlockIrToXml({...SPARK_AI_SAMPLE_IR, hardwareId: 'est'}, options), /硬件/);
    assert.throws(() => compileEstBlockIrToXml(SPARK_AI_SAMPLE_IR, {hardwareId: 'new-ai'}));
    for (const locale of ['zh-cn', 'zh-tw', 'en', 'pt-br', 'ru']) {
        const prompt = buildEstAiSystemPrompt(locale, ['event', 'movement', 'sensing', 'display'], null, 'spark-ai');
        assert.ok(prompt.includes('spark_event_whenflagclicked'));
        assert.ok(prompt.includes('first=left'));
        assert.ok(prompt.includes('top 1=Y'));
        assert.ok(!prompt.includes('"type":"event_program_start"'));
        assert.ok(!prompt.includes('180x128'));
    }
    const portuguese = selectEstAiRuleCategories([
        {role: 'user', text: 'Mostrar HELLO na matriz, esperar um segundo e limpar.'}
    ], 'spark-ai');
    assert.ok(portuguese.includes('display') && portuguese.includes('control'));
    assert.equal(createSparkAiHardwareContext({connected: false}), null);
    const snapshot = createSparkAiHardwareContext({connected: true, status: {ports: [{port: 1, type: 'touch'}]}});
    assert.equal(snapshot.sensorPorts[1].port, 'B');
    assert.equal(snapshot.sensorPorts[1].type, 'touch');
    assert.equal(snapshot.motorPorts[0].port, 'E');
    let calls = 0;
    const reply = await generateEstAiReply({id: 'spark-test',
        hardwareId: 'spark-ai',
        locale: 'zh-cn',
        messages: [{role: 'user', text: '显示 HELLO，等待一秒后清空点阵'}],
        invoke: (channel, payload) => {
            assert.equal(channel, 'est-ai-generate');
            assert.ok(payload.messages[0].content.includes('spark_matrix_lamp_text'));
            calls++;
            return Promise.resolve({ok: true,
                data: {content: JSON.stringify({message: '候选程序',
                    ir: calls === 1 ?
                        makeProgram([{type: 'motor_stop', inputs: {PORT: 'A'}}]) : SPARK_AI_SAMPLE_IR})}});
        }});
    assert.equal(calls, 2, 'EST blocks must trigger repair instead of entering a Spark workspace');
    assert.equal(reply.ir.hardwareId, 'spark-ai');
    setHardwareContext('spark-ai');
    assert.ok(isAiHardwareActive());
    let clears = 0;
    const workspace = {clear: () => clears++};
    assert.throws(() => importEstBlockIrToWorkspace({workspace, ir: {...SPARK_AI_SAMPLE_IR, hardwareId: 'est'}}));
    assert.equal(clears, 0);
    setHardwareContext('new-ai');
    assert.ok(isAiHardwareActive());
    assert.throws(() => importEstBlockIrToWorkspace({workspace, ir: SPARK_AI_SAMPLE_IR}));
    setHardwareContext('est');
    console.log('Spark AI assistant passed: 66 blocks, model-specific ports/pairs/matrix, ' +
        'prompt repair, snapshots and hardware isolation.');
})().catch(error => {
    console.error(error); process.exitCode = 1;
})
    .finally(() => {
        Module._extensions['.js'] = originalLoader;
        Module._extensions['.svg'] = originalSvg;
        Module._extensions['.png'] = originalPng;
    });
