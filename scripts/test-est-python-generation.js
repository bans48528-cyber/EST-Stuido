const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const Module = require('module');
const path = require('path');
const babel = require('@babel/core');

const estBlocksRoot = path.resolve(__dirname, '..', 'src', 'renderer', 'est-blocks');
const originalLoader = Module._extensions['.js'];
const originalSvgLoader = Module._extensions['.svg'];

Module._extensions['.svg'] = (module, filename) => {
    module.exports = filename;
};
Module._extensions['.js'] = (module, filename) => {
    if (!filename.startsWith(estBlocksRoot)) return originalLoader(module, filename);
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
const {registerEstPythonGenerator} = require(path.join(estBlocksRoot, 'python-generator.js'));

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
        addSyntaxCase(blockId, `${preamble}\ndef generated_statement():\n${indentCode(output || 'pass')}`);
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
