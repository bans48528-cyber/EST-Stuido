const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const Module = require('module');
const path = require('path');
const babel = require('@babel/core');

const estBlocksRoot = path.resolve(__dirname, '..', 'src', 'renderer', 'est-blocks');
const estRendererRoot = path.resolve(__dirname, '..', 'src', 'renderer');
const originalLoader = Module._extensions['.js'];
const originalSvgLoader = Module._extensions['.svg'];

Module._extensions['.svg'] = (module, filename) => {
    module.exports = filename;
};
Module._extensions['.js'] = (module, filename) => {
    if (!filename.startsWith(estRendererRoot)) return originalLoader(module, filename);
    const source = fs.readFileSync(filename, 'utf8');
    const transformed = babel.transformSync(source, {
        babelrc: false,
        plugins: ['@babel/plugin-transform-modules-commonjs']
    });
    module._compile(transformed.code, filename);
};

const {
    ALL_EST_BLOCK_IDS,
    EST_SUPPORT_BLOCK_IDS,
    registerEstBlocks
} = require(path.join(estBlocksRoot, 'definitions.js'));
const {
    registerEstPythonGenerator
} = require(path.join(estBlocksRoot, 'python-generator.js'));
const {
    isValidEstPythonIdentifier,
    toEstPythonIdentifier
} = require(path.join(estBlocksRoot, 'python-names.js'));

const nativeOperatorIds = [
    'operator_add',
    'operator_subtract',
    'operator_multiply',
    'operator_divide',
    'operator_random',
    'operator_gt',
    'operator_lt',
    'operator_equals',
    'operator_and',
    'operator_or',
    'operator_not',
    'operator_join',
    'operator_letter_of',
    'operator_length',
    'operator_contains',
    'operator_mod',
    'operator_round',
    'operator_mathop'
];

const nativeDataIds = [
    'data_variable',
    'data_setvariableto',
    'data_changevariableby',
    'data_showvariable',
    'data_hidevariable',
    'data_listcontents',
    'data_addtolist',
    'data_deleteoflist',
    'data_deletealloflist',
    'data_insertatlist',
    'data_replaceitemoflist',
    'data_itemoflist',
    'data_itemnumoflist',
    'data_lengthoflist',
    'data_listcontainsitem',
    'data_showlist',
    'data_hidelist'
];

const pythonKeywords = new Set([
    'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def',
    'del', 'elif', 'else', 'except', 'False', 'finally', 'for', 'from', 'global',
    'if', 'import', 'in', 'is', 'lambda', 'None', 'nonlocal', 'not', 'or', 'pass',
    'raise', 'return', 'True', 'try', 'while', 'with', 'yield'
]);

const safePythonName = value => {
    let name = String(value || 'unnamed')
        .trim()
        .replace(/[^A-Za-z0-9_]/g, '_');
    if (!name) name = 'unnamed';
    if (/^[0-9]/.test(name)) name = `_${name}`;
    if (pythonKeywords.has(name)) name = `${name}_value`;
    return name;
};

const quotePython = value => `'${String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\\n')
    .replace(/%/g, '\\%')
    .replace(/'/g, "\\'")}'`;

const generator = {
    INDENT: '  ',
    ORDER_ATOMIC: 0,
    ORDER_FUNCTION_CALL: 2.2,
    ORDER_MEMBER: 2.1,
    ORDER_UNARY_SIGN: 3,
    ORDER_UNARY_PREFIX: 4,
    ORDER_UNARY_POSTFIX: 4,
    ORDER_MULTIPLICATIVE: 5,
    ORDER_ADDITIVE: 6,
    ORDER_RELATIONAL: 11,
    ORDER_LOGICAL_NOT: 12,
    ORDER_LOGICAL_AND: 13,
    ORDER_LOGICAL_OR: 14,
    ORDER_NONE: 99,
    variableDB_: {
        getName: safePythonName
    },
    init () {
        this.imports_ = Object.create(null);
        this.libraries_ = Object.create(null);
        this.setups_ = Object.create(null);
        this.customFunctions_ = Object.create(null);
        this.customFunctionsArgName_ = Object.create(null);
        this.variables_ = {
            speed: 'speed = 0',
            items: 'items = []'
        };
    },
    quote_: quotePython,
    valueToCode: (block, name) => (block.values && block.values[name]) || '',
    statementToCode: (block, name) => (block.statements && block.statements[name]) || '',
    scrub_: (block, code) => `${code}${block.nextCode || ''}`,
    blockToCode: block => block.generatedCode || ['0', 0]
};

global.goog = {
    provide: () => {},
    require: () => {}
};
global.Blockly = {
    Python: generator,
    Variables: {NAME_TYPE: 'variable'},
    Procedures: {NAME_TYPE: 'procedure'},
    INPUT_VALUE: 1
};

require('openblock-blocks/generators/python/operator.js');
require('openblock-blocks/generators/python/data.js');
require('openblock-blocks/generators/python/procedures.js');
registerEstPythonGenerator({Python: generator});

const registeredDefinitions = [];
const FakeFieldTextInput = function () {};
FakeFieldTextInput.htmlInput_ = null;
const FakeFieldAngle = function () {};
FakeFieldAngle.ROUND = 1;
FakeFieldAngle.HALF = 50;
FakeFieldAngle.CLOCKWISE = false;
FakeFieldAngle.OFFSET = 0;
FakeFieldAngle.WRAP = 180;
FakeFieldAngle.RADIUS = 47;
FakeFieldAngle.prototype = {};
const fakeScratchBlocks = {
    Blocks: {},
    Colours: {textField: '#FFFFFF'},
    FieldTextInput: FakeFieldTextInput,
    FieldAngle: FakeFieldAngle,
    fieldRegistry: {
        register: () => {}
    },
    defineBlocksWithJsonArray: definitions => {
        registeredDefinitions.push(...definitions);
    }
};
registerEstBlocks(fakeScratchBlocks);

const definitionById = new Map(registeredDefinitions.map(definition => [definition.type, definition]));
const allEstGeneratorIds = EST_SUPPORT_BLOCK_IDS.concat(ALL_EST_BLOCK_IDS);
assert.strictEqual(new Set(allEstGeneratorIds).size, allEstGeneratorIds.length);
allEstGeneratorIds.forEach(blockId => {
    assert.ok(definitionById.has(blockId), `Missing EST definition: ${blockId}`);
    assert.strictEqual(typeof generator[blockId], 'function', `Missing EST generator: ${blockId}`);
});

const fixtureValue = name => {
    if (name === 'CONDITION') return 'True';
    if (name === 'TEXT') return quotePython('EST 测试');
    if (name.includes('PORT')) return quotePython(name === 'RIGHT_PORT' ? 'C' : 'B');
    return '2';
};

const fieldFixture = argument => {
    if (argument.type === 'field_dropdown' && Array.isArray(argument.options) && argument.options.length) {
        return argument.options[0][1];
    }
    if (Object.prototype.hasOwnProperty.call(argument, 'value')) return argument.value;
    return null;
};

const definitionArguments = definition => Object.keys(definition)
    .filter(key => /^args\d+$/.test(key))
    .sort()
    .reduce((argumentsList, key) => argumentsList.concat(definition[key] || []), []);

const makeBlockFromDefinition = (definition, idSuffix = 'syntax') => {
    const fields = Object.create(null);
    const values = Object.create(null);
    const statements = Object.create(null);

    definitionArguments(definition).forEach(argument => {
        if (!argument || !argument.name) return;
        if (argument.type === 'input_value') values[argument.name] = fixtureValue(argument.name);
        if (argument.type === 'input_statement') statements[argument.name] = '  rt.yield_once()\n';
        const field = fieldFixture(argument);
        if (field !== null) fields[argument.name] = field;
    });

    const isHat = definition.extensions && definition.extensions.includes('shape_hat');
    return {
        type: definition.type,
        id: `${definition.type}-${idSuffix}`,
        values,
        statements,
        nextCode: isHat ? '  rt.yield_once()\n' : '',
        getFieldValue: name => fields[name],
        nextConnection: {
            targetBlock: () => (isHat ? {type: 'generated_statement'} : null)
        }
    };
};

const resetGenerator = (topBlocks = []) => generator.init({getTopBlocks: () => topBlocks});
const dictionaryCode = dictionary => Object.keys(dictionary || {})
    .sort()
    .map(key => dictionary[key])
    .join('\n');
const indentCode = code => code.trimEnd()
    .split('\n')
    .map(line => `  ${line}`)
    .join('\n');
const programPreamble = () => [
    dictionaryCode(generator.imports_),
    dictionaryCode(generator.variables_)
].filter(Boolean).join('\n');
const assertAsciiIdentifier = name => {
    assert.strictEqual(isValidEstPythonIdentifier(name), true, name);
    assert.doesNotMatch(name, /_E[0-9A-F]{2}/i, name);
};

assert.strictEqual(toEstPythonIdentifier('速度'), 'su_du');
assert.strictEqual(toEstPythonIdentifier('电机速度'), 'dian_ji_su_du');
assert.strictEqual(toEstPythonIdentifier('数据列表'), 'shu_ju_lie_biao');
assert.strictEqual(toEstPythonIdentifier('设置电机速度'), 'she_zhi_dian_ji_su_du');
assert.strictEqual(toEstPythonIdentifier('我不喜欢'), 'wo_bu_xi_huan');
assert.strictEqual(toEstPythonIdentifier('不是吧'), 'bu_shi_ba');
assert.strictEqual(toEstPythonIdentifier('晚上'), 'wan_shang');
assert.strictEqual(toEstPythonIdentifier('张乱搞'), 'zhang_luan_gao');
assert.strictEqual(toEstPythonIdentifier('东西'), 'dong_xi');
assert.strictEqual(toEstPythonIdentifier('1速度'), 'value_1_su_du');
assert.strictEqual(toEstPythonIdentifier('for'), 'for_value');
assert.strictEqual(toEstPythonIdentifier('est'), 'est_value');
assert.strictEqual(toEstPythonIdentifier('龘'), 'da');
assert.match(toEstPythonIdentifier('!!!'), /^name_[a-z0-9]+$/);

const generatedNameSequence = () => {
    resetGenerator();
    const type = global.Blockly.Variables.NAME_TYPE;
    return [
        generator.variableDB_.getName('速度', type),
        generator.variableDB_.getName('速 度', type),
        generator.variableDB_.getName('速-度', type),
        generator.variableDB_.getName('速度', type),
        generator.variableDB_.getName('for', type),
        generator.variableDB_.getName('est', type),
        generator.variableDB_.getName('1速度', type),
        generator.variableDB_.getName('!!!', type)
    ];
};
const firstGeneratedNameSequence = generatedNameSequence();
const secondGeneratedNameSequence = generatedNameSequence();
assert.deepStrictEqual(firstGeneratedNameSequence, [
    'su_du',
    'su_du_2',
    'su_du_3',
    'su_du',
    'for_value',
    'est_value',
    'value_1_su_du',
    toEstPythonIdentifier('!!!')
]);
assert.deepStrictEqual(secondGeneratedNameSequence, firstGeneratedNameSequence);
firstGeneratedNameSequence.forEach(assertAsciiIdentifier);

resetGenerator();
const variableMap = {
    getVariableById: id => ({
        variableSpeed: {name: '速度'},
        listData: {name: '数据列表'},
        duplicateSpeed: {name: '速 度'},
        dislike: {name: '我不喜欢'}
    }[id] || null)
};
generator.variableDB_.setVariableMap(variableMap);
const pythonVariableName = generator.variableDB_.getName('variableSpeed', global.Blockly.Variables.NAME_TYPE);
const pythonListName = generator.variableDB_.getName('listData', global.Blockly.Variables.NAME_TYPE);
const pythonDuplicateVariableName = generator.variableDB_.getName(
    'duplicateSpeed',
    global.Blockly.Variables.NAME_TYPE
);
const pythonDislikeVariableName = generator.variableDB_.getName('dislike', global.Blockly.Variables.NAME_TYPE);
generator.variables_ = {
    0: `${pythonVariableName} = 0`,
    1: `${pythonListName} = []`,
    2: `${pythonDuplicateVariableName} = 0`,
    3: `${pythonDislikeVariableName} = 0`
};
assert.strictEqual(pythonVariableName, 'su_du');
assert.strictEqual(pythonListName, 'shu_ju_lie_biao');
assert.strictEqual(pythonDuplicateVariableName, 'su_du_2');
assert.strictEqual(pythonDislikeVariableName, 'wo_bu_xi_huan');
[
    pythonVariableName,
    pythonListName,
    pythonDuplicateVariableName,
    pythonDislikeVariableName
].forEach(assertAsciiIdentifier);
assert.deepStrictEqual(generator.data_variable({
    getFieldValue: () => 'variableSpeed'
}), ['su_du', 0]);
assert.strictEqual(generator.data_setvariableto({
    values: {VALUE: '5'},
    getFieldValue: () => 'variableSpeed'
}), 'su_du = 5\n');
assert.strictEqual(generator.data_changevariableby({
    values: {VALUE: '1'},
    getFieldValue: () => 'variableSpeed'
}), 'su_du += 1\n');
assert.strictEqual(generator.data_setvariableto({
    values: {VALUE: '0'},
    getFieldValue: () => 'dislike'
}), 'wo_bu_xi_huan = 0\n');
assert.deepStrictEqual(generator.data_listcontents({
    getFieldValue: () => 'listData'
}), ['shu_ju_lie_biao', 0]);
assert.strictEqual(generator.data_addtolist({
    values: {ITEM: quotePython('EST')},
    getFieldValue: () => 'listData'
}), "shu_ju_lie_biao.append('EST')\n");

const chineseEventBlock = {
    type: 'event_program_start',
    id: 'chinese-variable-global',
    nextCode: `${generator.INDENT}su_du += 1\n`,
    nextConnection: {targetBlock: () => ({type: 'data_changevariableby'})}
};
assert.strictEqual(generator.event_program_start(chineseEventBlock), null);
assert.match(
    generator.libraries_.est_stack_1,
    /global su_du, shu_ju_lie_biao, su_du_2, wo_bu_xi_huan/
);
assert.doesNotMatch(generator.libraries_.est_stack_1, /[\u3400-\u9fff]|_E[0-9A-F]{2}/i);

resetGenerator();
const screenshotVariableMap = {
    getVariableById: id => ({
        night: {name: '晚上'},
        messList: {name: '张乱搞'}
    }[id] || null)
};
generator.variableDB_.setVariableMap(screenshotVariableMap);
const screenshotVariableName = generator.variableDB_.getName('night', global.Blockly.Variables.NAME_TYPE);
const screenshotListName = generator.variableDB_.getName('messList', global.Blockly.Variables.NAME_TYPE);
assert.strictEqual(screenshotVariableName, 'wan_shang');
assert.strictEqual(screenshotListName, 'zhang_luan_gao');
assert.strictEqual(generator.data_setvariableto({
    values: {VALUE: '0'},
    getFieldValue: () => 'night'
}), 'wan_shang = 0\n');
assert.strictEqual(generator.data_addtolist({
    values: {ITEM: quotePython('东西')},
    getFieldValue: () => 'messList'
}), "zhang_luan_gao.append('东西')\n");
[
    screenshotVariableName,
    screenshotListName
].forEach(assertAsciiIdentifier);

resetGenerator();
const screenshotProcedureHead = generator.procedures_prototype({
    displayNames_: [],
    getProcCode: () => '不是吧'
});
assert.strictEqual(screenshotProcedureHead, 'def bu_shi_ba()');
assertAsciiIdentifier('bu_shi_ba');

resetGenerator();
const procedurePrototypeBlock = {
    displayNames_: ['速度', '数据列表', '1参数'],
    getProcCode: () => '设置电机速度 %n %s %b'
};
const procedureDefinitionHead = generator.procedures_prototype(procedurePrototypeBlock);
assert.strictEqual(
    procedureDefinitionHead,
    'def she_zhi_dian_ji_su_du_n_s_b(su_du, shu_ju_lie_biao, value_1_can_shu)'
);
assert.deepStrictEqual(generator.argument_reporter_number({
    getFieldValue: () => '速度'
}), ['su_du', 0]);
assert.deepStrictEqual(generator.argument_reporter_string({
    getFieldValue: () => '数据列表'
}), ['shu_ju_lie_biao', 0]);
assert.deepStrictEqual(generator.argument_reporter_boolean({
    getFieldValue: () => '1参数'
}), ['value_1_can_shu', 0]);
const chineseProcedureCall = generator.procedures_call({
    getProcCode: () => '设置电机速度 %n %s %b',
    inputList: [
        {type: global.Blockly.INPUT_VALUE, connection: {targetBlock: () => ({generatedCode: ['su_du', 0]})}},
        {type: global.Blockly.INPUT_VALUE, connection: {targetBlock: () => ({generatedCode: [quotePython('A'), 0]})}},
        {type: global.Blockly.INPUT_VALUE, connection: {targetBlock: () => ({generatedCode: ['True', 0]})}}
    ]
});
assert.strictEqual(chineseProcedureCall, "she_zhi_dian_ji_su_du_n_s_b(su_du, 'A', True);\n");
generator.variables_ = {0: 'su_du = 0'};
const chineseProcedureDefinitionBlock = {
    id: 'chinese-procedure-definition',
    statements: {custom_block: `${generator.INDENT}${procedureDefinitionHead}`},
    nextCode: `${generator.INDENT}return su_du\n`,
    nextConnection: {targetBlock: () => ({type: 'argument_reporter_number'})}
};
assert.strictEqual(generator.procedures_definition(chineseProcedureDefinitionBlock), null);
assert.match(
    dictionaryCode(generator.customFunctions_),
    /def she_zhi_dian_ji_su_du_n_s_b\(su_du, shu_ju_lie_biao, value_1_can_shu\):/
);
[
    'she_zhi_dian_ji_su_du_n_s_b',
    'su_du',
    'shu_ju_lie_biao',
    'value_1_can_shu'
].forEach(assertAsciiIdentifier);

const syntaxCases = [];
const addSyntaxCase = (name, source) => {
    syntaxCases.push({name, source: `${source.trim()}\n`});
};

allEstGeneratorIds.forEach(blockId => {
    const definition = definitionById.get(blockId);
    const block = makeBlockFromDefinition(definition);
    resetGenerator([block]);
    const output = generator[blockId](block);
    const preamble = programPreamble();

    if (Array.isArray(output)) {
        addSyntaxCase(blockId, `${preamble}\nresult = ${output[0]}`);
    } else if (output === null) {
        addSyntaxCase(blockId, [
            preamble,
            dictionaryCode(generator.libraries_),
            dictionaryCode(generator.setups_)
        ].filter(Boolean).join('\n'));
    } else {
        assert.strictEqual(typeof output, 'string', blockId);
        addSyntaxCase(blockId, [
            preamble,
            dictionaryCode(generator.libraries_),
            `def generated_statement():\n${indentCode(output || 'pass')}`
        ].filter(Boolean).join('\n'));
    }
});

const nativeOperatorValues = {
    NUM1: '6',
    NUM2: '2',
    FROM: '1',
    TO: '10',
    OPERAND1: 'True',
    OPERAND2: 'False',
    OPERAND: 'True',
    STRING1: quotePython('EST'),
    STRING2: quotePython('Studio'),
    STRING: quotePython('EST'),
    LETTER: '1',
    NUM: '9'
};
nativeOperatorIds.forEach(blockId => {
    resetGenerator();
    const output = generator[blockId]({
        type: blockId,
        values: nativeOperatorValues,
        getFieldValue: name => (name === 'OPERATOR' ? 'sqrt' : null)
    });
    assert.ok(Array.isArray(output), blockId);
    addSyntaxCase(blockId, `${programPreamble()}\nresult = ${output[0]}`);
});

resetGenerator();
assert.deepStrictEqual(generator.operator_random({
    values: {FROM: 'lower_value', TO: 'upper_value'}
}), ['rt.random_int(lower_value, upper_value)', generator.ORDER_FUNCTION_CALL]);
assert.strictEqual(generator.imports_.estRuntime, 'import est_runtime as rt');
assert.doesNotMatch(generator.operator_random.toString(), /random\.randint/);

nativeDataIds.forEach(blockId => {
    resetGenerator();
    const output = generator[blockId]({
        type: blockId,
        values: {VALUE: '2', ITEM: quotePython('EST'), INDEX: '1'},
        getFieldValue: name => (name === 'LIST' ? 'items' : 'speed')
    });
    if (Array.isArray(output)) {
        addSyntaxCase(blockId, `${programPreamble()}\nresult = ${output[0]}`);
    } else {
        addSyntaxCase(blockId, `${programPreamble()}\ndef generated_data():\n${indentCode(output || 'pass')}`);
    }
});

resetGenerator();
const procedureDefinitionBlock = {
    id: 'procedure-definition-syntax',
    statements: {custom_block: '  def custom_module(value)'},
    nextCode: '',
    nextConnection: {targetBlock: () => null}
};
assert.strictEqual(generator.procedures_definition(procedureDefinitionBlock), null);
addSyntaxCase('procedures_definition', dictionaryCode(generator.customFunctions_));

const procedurePrototype = generator.procedures_prototype({
    displayNames_: ['value'],
    getProcCode: () => 'custom module %n'
});
addSyntaxCase('procedures_prototype', `${procedurePrototype}:\n  pass`);

const procedureCall = generator.procedures_call({
    getProcCode: () => 'custom module %n',
    inputList: [{
        type: global.Blockly.INPUT_VALUE,
        connection: {targetBlock: () => ({generatedCode: ['2', 0]})}
    }]
});
addSyntaxCase('procedures_call', `def custom_module_N(value):\n  pass\n${procedureCall}`);

['argument_reporter_boolean', 'argument_reporter_number', 'argument_reporter_string']
    .forEach(blockId => {
        generator.customFunctionsArgName_.value = 'value';
        const output = generator[blockId]({getFieldValue: () => 'value'});
        addSyntaxCase(blockId, `value = 1\nresult = ${output[0]}`);
    });

resetGenerator();
const quotedMessage = generator.event_broadcast({
    getFieldValue: () => "孩子的'消息\\路径\n下一行",
    values: {}
});
addSyntaxCase('quoted_unicode_message', `${programPreamble()}\n${quotedMessage}`);

resetGenerator();
const displayImageWithSpace = generator.display_image({
    values: {},
    getFieldValue: name => (name === 'IMAGE' ? 'Expressions/Big smile' : null)
});
assert.strictEqual(
    displayImageWithSpace,
    "est.display.image('Expressions/Big smile')\nest.display.refresh()\n"
);
assert.strictEqual((displayImageWithSpace.match(/refresh/g) || []).length, 1);
addSyntaxCase('display_image_with_space', `${programPreamble()}\ndef generated_statement():\n${
    indentCode(displayImageWithSpace)
}`);

resetGenerator();
const displayImageDefault = generator.display_image({
    values: {},
    getFieldValue: () => null
});
assert.strictEqual(
    displayImageDefault,
    "est.display.image('Eyes/Neutral')\nest.display.refresh()\n"
);

resetGenerator();
const displayImageForWithSpace = generator.display_image_for({
    values: {SECONDS: '2'},
    getFieldValue: name => (name === 'IMAGE' ? 'Expressions/Big smile' : null)
});
assert.strictEqual(displayImageForWithSpace, "rt.display_image_for('Expressions/Big smile', 2)\n");
assert.doesNotMatch(displayImageForWithSpace, /refresh/);
addSyntaxCase('display_image_for_with_space', `${programPreamble()}\ndef generated_statement():\n${
    indentCode(displayImageForWithSpace)
}`);

resetGenerator();
const displayImageForDefault = generator.display_image_for({
    values: {SECONDS: '2'},
    getFieldValue: () => null
});
assert.strictEqual(displayImageForDefault, "rt.display_image_for('Eyes/Neutral', 2)\n");

const singleAsyncStart = {
    type: 'event_program_start',
    id: 'single-async-start',
    nextCode:
        '  rt.sleep(0.1)\n' +
        '  rt.wait_until(lambda: ready)\n' +
        '  while True:\n' +
        '    rt.yield_once()\n',
    getFieldValue: () => null,
    nextConnection: {targetBlock: () => ({type: 'control_forever'})}
};
resetGenerator([singleAsyncStart]);
assert.strictEqual(generator.event_program_start(singleAsyncStart), null);
assert.match(generator.libraries_.est_stack_1, /@rt\.on_start\nasync def stack_1\(\):/);
assert.match(generator.libraries_.est_stack_1, /await rt\.sleep\(0\.1\)/);
assert.match(generator.libraries_.est_stack_1, /await rt\.wait_until\(lambda: ready\)/);
assert.match(generator.libraries_.est_stack_1, /await rt\.yield_once\(\)/);
addSyntaxCase('cooperative_single_start_wait_and_loop', [
    programPreamble(),
    dictionaryCode(generator.libraries_),
    dictionaryCode(generator.setups_)
].filter(Boolean).join('\n'));

const sensorWaitAsyncStart = {
    type: 'event_program_start',
    id: 'sensor-wait-async-start',
    nextCode:
        "  rt.wait_brick_button('confirm', 'pressed')\n" +
        "  rt.wait_color(3, 'red')\n" +
        "  rt.wait_touch(1, 'pressed')\n" +
        "  rt.wait_ultrasonic(4, 'less', 15, 'centimeters')\n" +
        "  rt.wait_ir_proximity(4, 'greater', 50)\n" +
        "  rt.wait_ir_beacon_button(4, 1, 'active')\n" +
        "  rt.wait_gyro(2, 'greater', 45)\n",
    getFieldValue: () => null,
    nextConnection: {targetBlock: () => ({type: 'sensor_wait_brick_button'})}
};
resetGenerator([sensorWaitAsyncStart]);
assert.strictEqual(generator.event_program_start(sensorWaitAsyncStart), null);
[
    'wait_brick_button', 'wait_color', 'wait_touch', 'wait_ultrasonic',
    'wait_ir_proximity', 'wait_ir_beacon_button', 'wait_gyro'
].forEach(name => {
    assert.match(generator.libraries_.est_stack_1, new RegExp(`await rt\\.${name}\\(`));
});
addSyntaxCase('cooperative_sensor_waits', [
    programPreamble(),
    dictionaryCode(generator.libraries_),
    dictionaryCode(generator.setups_)
].filter(Boolean).join('\n'));

const cooperativeStartA = {
    type: 'event_program_start',
    id: 'cooperative-start-a',
    nextCode:
        '  rt.sleep(0.1)\n' +
        '  for _ in range(rt.repeat_count(2)):\n' +
        '    rt.yield_once()\n',
    getFieldValue: () => null,
    nextConnection: {targetBlock: () => ({type: 'control_repeat'})}
};
const cooperativeStartB = {
    type: 'event_program_start',
    id: 'cooperative-start-b',
    nextCode:
        "  rt.drive_move_for('forward', 1, 'rotations')\n" +
        '  rt.stop_other_stacks()\n',
    getFieldValue: () => null,
    nextConnection: {targetBlock: () => ({type: 'drive_move_for'})}
};
resetGenerator([cooperativeStartA, cooperativeStartB]);
assert.strictEqual(generator.event_program_start(cooperativeStartA), null);
assert.strictEqual(generator.event_program_start(cooperativeStartB), null);
assert.match(generator.libraries_.est_stack_1, /async def stack_1\(\):/);
assert.match(generator.libraries_.est_stack_1, /await rt\.sleep\(0\.1\)/);
assert.match(generator.libraries_.est_stack_1, /await rt\.yield_once\(\)/);
assert.match(generator.libraries_.est_stack_2, /async def stack_2\(\):/);
assert.match(generator.libraries_.est_stack_2, /await rt\.drive_move_for\('forward', 1, 'rotations'\)/);
assert.match(generator.libraries_.est_stack_2, /rt\.stop_other_stacks\(\)/);
const cooperativeProgram = [
    programPreamble(),
    dictionaryCode(generator.libraries_),
    dictionaryCode(generator.setups_)
].filter(Boolean).join('\n');
assert.strictEqual((cooperativeProgram.match(/\brt\.run\(\)/g) || []).length, 1);
addSyntaxCase('cooperative_multi_start', cooperativeProgram);

resetGenerator();
const zeroLeftDualSpeed = generator.drive_start_dual_speed({
    values: {LEFT_SPEED: '0', RIGHT_SPEED: '50'},
    getFieldValue: () => null
});
assert.strictEqual(zeroLeftDualSpeed, 'rt.drive_start_dual_speed(0, 50)\n');
const zeroRightDualSpeed = generator.drive_start_dual_speed({
    values: {LEFT_SPEED: '50', RIGHT_SPEED: '0'},
    getFieldValue: () => null
});
assert.strictEqual(zeroRightDualSpeed, 'rt.drive_start_dual_speed(50, 0)\n');
const zeroBothDualSpeed = generator.drive_start_dual_speed({
    values: {LEFT_SPEED: '0', RIGHT_SPEED: '0'},
    getFieldValue: () => null
});
assert.strictEqual(zeroBothDualSpeed, 'rt.drive_start_dual_speed(0, 0)\n');
assert.strictEqual(Object.prototype.hasOwnProperty.call(generator.libraries_, 'estSpeedHelpers'), false);

resetGenerator();
const directSpeedOutputs = [
    generator.motor_set_speed({
        values: {PORT: quotePython('A'), SPEED: 'speed + 1'},
        getFieldValue: () => null
    }),
    generator.motor_run_for_speed({
        values: {PORT: quotePython('A'), SPEED: 'speed - 1', AMOUNT: '2'},
        getFieldValue: name => (name === 'UNIT' ? 'rotations' : null)
    }),
    generator.motor_start_speed({
        values: {PORT: quotePython('A'), SPEED: 'speed'},
        getFieldValue: () => null
    }),
    generator.motor_start_power({
        values: {PORT: quotePython('A'), POWER: 'power'},
        getFieldValue: () => null
    }),
    generator.drive_set_speed({
        values: {SPEED: 'speed + 2'},
        getFieldValue: () => null
    }),
    generator.drive_start_steer_speed({
        values: {STEERING: 'turn', SPEED: 'speed - 3'},
        getFieldValue: () => null
    }),
    generator.drive_dual_speed_for({
        values: {LEFT_SPEED: 'left_speed', RIGHT_SPEED: 'right_speed', AMOUNT: '3'},
        getFieldValue: name => (name === 'UNIT' ? 'seconds' : null)
    })
].join('');
assert.match(directSpeedOutputs, /rt\.motor_set_speed\('A', speed \+ 1\)/);
assert.match(directSpeedOutputs, /rt\.motor_run_for\('A', None, 2, 'rotations', speed=speed - 1\)/);
assert.match(directSpeedOutputs, /rt\.motor_start_speed\('A', speed\)/);
assert.match(directSpeedOutputs, /rt\.motor_start_power\('A', power\)/);
assert.match(directSpeedOutputs, /rt\.drive_set_speed\(speed \+ 2\)/);
assert.match(directSpeedOutputs, /rt\.drive_start_steer\(turn, speed=speed - 3\)/);
assert.match(directSpeedOutputs, /rt\.drive_dual_speed_for\(left_speed, right_speed, 3, 'seconds'\)/);
assert.doesNotMatch(directSpeedOutputs, /_est_speed/);
assert.strictEqual(Object.prototype.hasOwnProperty.call(generator.libraries_, 'estSpeedHelpers'), false);

[
    'regular_black',
    'bold_black',
    'large_black',
    'regular_white',
    'bold_white',
    'large_white'
].forEach(font => {
    resetGenerator();
    const displayTextXY = generator.display_text_xy({
        values: {X: '10', Y: '20', TEXT: quotePython('EST')},
        getFieldValue: name => (name === 'FONT' ? font : null)
    });
    assert.strictEqual(
        displayTextXY,
        `rt.display_text(10, 20, 'EST', font='${font}')\n`
    );
});

resetGenerator();
assert.strictEqual(generator.display_text_xy({
    values: {X: 'x_value', Y: 'y_value', TEXT: 'sensor_value'},
    getFieldValue: name => (name === 'FONT' ? 'regular_black' : null)
}), "rt.display_text(x_value, y_value, sensor_value, font='regular_black')\n");
assert.strictEqual(generator.imports_.estRuntime, 'import est_runtime as rt');
assert.strictEqual(generator.imports_.estHardware, undefined);
assert.deepStrictEqual(Object.keys(generator.libraries_), []);

resetGenerator();
assert.strictEqual(generator.display_text_line({
    values: {LINE: 'line_number', TEXT: 'sensor_value'},
    getFieldValue: () => null
}), 'rt.display_text_line(line_number, sensor_value)\n');
assert.strictEqual(generator.imports_.estRuntime, 'import est_runtime as rt');
assert.strictEqual(generator.imports_.estHardware, undefined);
assert.deepStrictEqual(Object.keys(generator.libraries_), []);

const sensorPortBlock = ({values = {}, fields = {}} = {}) => ({
    values: {PORT: 'port_var', ...values},
    getFieldValue: name => fields[name]
});
[
    ['sensor_color_reflection', {}, 'rt.color(port_var).reflection()'],
    ['sensor_color_reflection_compare', {
        values: {VALUE: '50'},
        fields: {COMPARATOR: 'less'}
    }, "rt.compare(rt.color(port_var).reflection(), 'less', 50)"],
    ['sensor_temperature', {
        fields: {UNIT: 'celsius'}
    }, 'rt.temperature(port_var).celsius()'],
    ['sensor_temperature', {
        fields: {UNIT: 'fahrenheit'}
    }, 'rt.temperature(port_var).fahrenheit()'],
    ['sensor_touch_pressed', {}, 'rt.touch(port_var).pressed()'],
    ['sensor_ultrasonic_distance', {
        fields: {UNIT: 'centimeters'}
    }, "rt.ultrasonic(port_var).distance('centimeters')"],
    ['sensor_ir_proximity', {}, 'rt.infrared(port_var).proximity()'],
    ['sensor_ir_beacon_heading', {
        fields: {CHANNEL: '4'}
    }, 'rt.infrared(port_var).beacon_heading(1)'],
    ['sensor_ir_beacon_active_compare', {
        values: {VALUE: '0'},
        fields: {CHANNEL: '3', PROPERTY: 'heading', COMPARATOR: 'less'}
    }, "rt.ir_beacon_compare(port_var, 1, 'heading', 'less', 0)"],
    ['sensor_gyro_angle', {}, 'rt.gyro(port_var).angle()'],
    ['sensor_gyro_reset', {}, 'rt.gyro(port_var).reset_angle()\n']
].forEach(([blockId, blockOptions, expectedCode]) => {
    resetGenerator();
    const output = generator[blockId](sensorPortBlock(blockOptions));
    const code = Array.isArray(output) ? output[0] : output;
    assert.strictEqual(code, expectedCode, `${blockId} variable port`);
});

const sensorDefaultPortBlock = ({values = {}, fields = {}} = {}) => ({
    values,
    getFieldValue: name => fields[name]
});
[
    ['sensor_color_reflection', {}, "rt.color('3').reflection()"],
    ['sensor_temperature', {}, "rt.temperature('3').celsius()"],
    ['sensor_touch_pressed', {}, "rt.touch('1').pressed()"],
    ['sensor_ultrasonic_distance', {
        fields: {UNIT: 'centimeters'}
    }, "rt.ultrasonic('4').distance('centimeters')"],
    ['sensor_ir_proximity', {}, "rt.infrared('4').proximity()"],
    ['sensor_gyro_angle', {}, "rt.gyro('2').angle()"]
].forEach(([blockId, blockOptions, expectedCode]) => {
    resetGenerator();
    const output = generator[blockId](sensorDefaultPortBlock(blockOptions));
    const code = Array.isArray(output) ? output[0] : output;
    assert.strictEqual(code, expectedCode, `${blockId} default port`);
});

const combinedBlocks = allEstGeneratorIds.map(blockId => (
    makeBlockFromDefinition(definitionById.get(blockId), 'combined')
));
resetGenerator(combinedBlocks);
const combinedStatements = [];
const combinedExpressions = [];
combinedBlocks.forEach(block => {
    const output = generator[block.type](block);
    if (Array.isArray(output)) combinedExpressions.push({id: block.type, code: output[0]});
    else if (typeof output === 'string' && output) combinedStatements.push({id: block.type, code: output});
});
const combinedProgram = [
    '# Generated EST syntax regression program',
    programPreamble(),
    dictionaryCode(generator.libraries_),
    'def generated_statements():',
    combinedStatements.length ? combinedStatements.map(item => (
        `  # ${item.id}\n${indentCode(item.code)}`
    )).join('\n') : '  pass',
    'def generated_expressions():',
    '  return [',
    combinedExpressions.map(item => `    ${item.code},  # ${item.id}`).join('\n'),
    '  ]',
    dictionaryCode(generator.setups_)
].filter(Boolean).join('\n');
addSyntaxCase('all_est_blocks_combined', combinedProgram);

const pythonChecker = path.resolve(__dirname, 'check-python-syntax.py');
const pythonCandidates = process.env.PYTHON ?
    [{command: process.env.PYTHON, args: []}] :
    [
        {command: 'python', args: []},
        {command: 'python3', args: []},
        {command: 'py', args: ['-3']}
    ];
const python = pythonCandidates.find(candidate => {
    const result = childProcess.spawnSync(candidate.command, candidate.args.concat('--version'), {
        encoding: 'utf8',
        windowsHide: true
    });
    return !result.error && result.status === 0;
});
assert.ok(python, 'Python 3 is required to run generated-code syntax tests.');

const syntaxResult = childProcess.spawnSync(
    python.command,
    python.args.concat(pythonChecker),
    {
        encoding: 'utf8',
        env: {
            ...process.env,
            PYTHONIOENCODING: 'utf-8',
            PYTHONUTF8: '1'
        },
        input: Buffer.from(JSON.stringify({cases: syntaxCases}), 'utf8'),
        maxBuffer: 4 * 1024 * 1024,
        windowsHide: true
    }
);
if (syntaxResult.status !== 0) {
    throw new Error(`Generated Python syntax validation failed:\n${syntaxResult.stdout}${syntaxResult.stderr}`);
}
const syntaxSummary = JSON.parse(syntaxResult.stdout);
assert.strictEqual(syntaxSummary.checked, syntaxCases.length);

console.log(
    `${syntaxCases.length} generated Python programs passed Python AST syntax validation ` +
    `(${ALL_EST_BLOCK_IDS.length} visible EST blocks plus native data/operator/procedure coverage)`
);

if (originalSvgLoader) Module._extensions['.svg'] = originalSvgLoader;
else delete Module._extensions['.svg'];
Module._extensions['.js'] = originalLoader;
