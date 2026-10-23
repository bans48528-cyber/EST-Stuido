/* eslint-disable global-require */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');
const {spawnSync} = require('child_process');
const babel = require('@babel/core');
const root = path.resolve(__dirname, '..');
const originalLoader = Module._extensions['.js'];
Module._extensions['.js'] = (module, filename) => {
    if (!filename.startsWith(path.join(root, 'src'))) return originalLoader(module, filename);
    module._compile(babel.transformSync(fs.readFileSync(filename, 'utf8'), {
        babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs']
    }).code, filename);
};
const catalog = require('../src/renderer/spark-ai/catalog.json');
const fixtures = require('./spark-ai-source-fixtures.json');
const {defineSparkBlocksWithLocale, getSparkToolboxCategories, sparkBlockXml} =
    require('../src/renderer/spark-ai/blocks');
const {registerSparkPythonGenerator} = require('../src/renderer/spark-ai/python-generator');
const {registerSparkMatrixField} = require('../src/renderer/spark-ai/matrix-field');
const B = {INPUT_VALUE: 1,
    Variables: {NAME_TYPE: 'variable'},
    Procedures: {NAME_TYPE: 'procedure'},
    Blocks: {},
    ScratchMsgs: {locales: {}}};
const goog = {provide () {},
    require () {},
    isArray: Array.isArray,
    isString: value => typeof value === 'string',
    isNumber: value => typeof value === 'number',
    asserts: {
        assert: (value, message) => assert.ok(value, message),
        assertFunction: value => assert.equal(typeof value, 'function'),
        assertArray: value => assert.ok(Array.isArray(value)),
        assertString: value => assert.equal(typeof value, 'string'),
        fail: message => {
            throw new Error(message);
        }
    }};
// Run the repository's actual Blockly traversal/precedence engine without a browser.
vm.runInNewContext(fs.readFileSync(require.resolve('openblock-blocks/core/generator.js'), 'utf8'), {Blockly: B, goog});
B.Python = new B.Generator('Python');
Object.assign(B.Python, {ORDER_ATOMIC: 0,
    ORDER_COLLECTION: 1,
    ORDER_STRING_CONVERSION: 1,
    ORDER_MEMBER: 2.1,
    ORDER_FUNCTION_CALL: 2.2,
    ORDER_EXPONENTIATION: 3,
    ORDER_UNARY_SIGN: 4,
    ORDER_BITWISE_NOT: 4,
    ORDER_MULTIPLICATIVE: 5,
    ORDER_ADDITIVE: 6,
    ORDER_BITWISE_SHIFT: 7,
    ORDER_BITWISE_AND: 8,
    ORDER_BITWISE_XOR: 9,
    ORDER_BITWISE_OR: 10,
    ORDER_RELATIONAL: 11,
    ORDER_LOGICAL_NOT: 12,
    ORDER_LOGICAL_AND: 13,
    ORDER_LOGICAL_OR: 14,
    ORDER_CONDITIONAL: 15,
    ORDER_LAMBDA: 16,
    ORDER_NONE: 99,
    ORDER_UNARY_PREFIX: 4,
    ORDER_UNARY_POSTFIX: 4});
registerSparkPythonGenerator(B);
const g = B.SparkPython;
const variableModels = [
    {name: 'score', type: '', getId: () => 'v'}, {name: 'items', type: 'list', getId: () => 'l'}
];
const workspace = {getVariableMap: () => ({getVariableById: id => variableModels.find(v => v.getId() === id)}),
    getAllVariables: () => variableModels};
const rootBlock = {type: 'spark_event_whenflagclicked', getSurroundParent: () => null};
const makeBlock = (type, fields = {}, children = {}, parent = rootBlock) => ({
    id: type,
    type,
    disabled: false,
    fields,
    children,
    outputConnection: type.includes('operator_') ? {} : null,
    inputList: Object.keys(children).map(name => ({name, type: 1})),
    getFieldValue: name => fields[name],
    getInputTargetBlock: name => children[name] || null,
    getRootBlock: () => rootBlock,
    getSurroundParent: () => parent,
    getCommentText: () => '',
    getNextBlock: () => null
});
const makeRow = row => {
    const children = {};
    row.inputs.forEach(input => {
        children[input.name] = makeBlock(`spark_${input.type}`, {...input.fields});
        children[input.name].outputConnection = {};
    });
    const block = makeBlock(`spark_${row.id}`, {...row.fields}, children);
    block.outputConnection = (row.definition.extensions || []).some(ext => ext.startsWith('output_')) ? {} : null;
    return block;
};
const programs = [];
const normalized = code => String(code).replace(/\s+/g, '')
    .replace(/"/g, "'");
const adjusted = new Set(['event_whenflagclicked', 'control_break', 'control_repeat', 'control_forever',
    'control_if', 'control_if_else', 'control_repeat_until', 'control_wait_until', 'operator_not']);
for (const row of catalog.blocks) {
    g.init(workspace);
    const block = makeRow(row);
    const result = g[block.type](block);
    const code = Array.isArray(result) ? result[0] : result;
    const fixture = fixtures.find(item => item.sourceId === row.id);
    if (!adjusted.has(row.id)) assert.equal(normalized(code), normalized(fixture.python), row.id);
    if (row.id !== 'control_break') {
        programs.push({id: row.id, code: Array.isArray(result) ? `result = ${code}\n` : code});
    }
    for (const variant of fixture.variants) {
        if (!block.fields || !Object.prototype.hasOwnProperty.call(block.fields, variant.field)) continue;
        Object.assign(block.fields, row.fields, {[variant.field]: variant.value});
        const output = g[block.type](block);
        assert.equal(normalized(Array.isArray(output) ? output[0] : output), normalized(variant.code),
            `${row.id}.${variant.field}=${variant.value}`);
    }
}
assert.equal(catalog.blocks.length, 66);
assert.equal(new Set(catalog.blocks.map(row => row.id)).size, 66);
for (const locale of ['zh-cn', 'zh-tw', 'en', 'pt-br', 'ru']) {
    B.ScratchMsgs.locales[locale] = require(`openblock-l10n/editor/blocks/${locale}.json`);
    defineSparkBlocksWithLocale(B, locale);
    const xml = getSparkToolboxCategories(locale);
    assert.equal((xml.match(/<block /g) || []).length, 66);
    assert.equal((xml.match(/<category /g) || []).length, 8);
    catalog.blocks.forEach(row => {
        let definition;
        B.Blocks[`spark_${row.id}`].init.call({jsonInit: json => {
            definition = json;
        }});
        assert.ok(definition.message0, row.id);
        if (locale === 'en' || locale === 'pt-br' || locale === 'ru') {
            assert.ok(!/[\u4e00-\u9fff]/.test(definition.message0), `${locale} ${row.id}`);
        }
    });
    assert.ok(!xml.includes('type="motor_stop"'), 'Spark IDs must not overwrite EST IDs');
}
const registry = {};
const MatrixNative = function (value, width, height) {
    this.setValue(value);
    this.width_ = width;
    this.height_ = height;
    this.zeros_ = '0'.repeat(width * height);
};
MatrixNative.MATRIX_NODE_SIZE = 26;
MatrixNative.MATRIX_NODE_PAD = 7;
MatrixNative.prototype.setValue = function (value) {
    this.matrix_ = value; this.updateMatrix_();
};
MatrixNative.prototype.updateMatrix_ = () => {};
const MatrixBlocks = {Field: {fromJson: () => new MatrixNative('', 5, 7),
    register: (name, Field) => {
        registry[name] = Field;
    }}};
global.document = {};
try {
    registerSparkMatrixField(MatrixBlocks);
    const field = registry.field_spark_matrix.fromJson({matrix: '1'.repeat(35)});
    field.matrixStage_ = {getBoundingClientRect: () =>
        ({left: 100, right: 186, top: 50, bottom: 169, width: 86, height: 119})};
    for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 5; col++) {
            const hit = field.checkForLED_({clientX: 100 + (((col * 33) + 20) / 2),
                clientY: 50 + (((row * 33) + 20) / 2)});
            assert.equal(hit, (row * 5) + col, `matrix row ${row}, column ${col}`);
        }
    }
    assert.equal(field.checkForLED_({clientX: 300, clientY: 100}), -1);
    assert.equal(field.checkForLED_({clientX: 120, clientY: 300}), -1);
    field.setValue('1bad');
    assert.equal(field.matrix_, `1${'0'.repeat(34)}`);
} finally {
    delete global.document;
}

g.init(workspace);
const motor = makeRow(catalog.blocks[0]);
motor.children.POWER.fields.NUM = '0';
assert.ok(g[motor.type](motor).includes(', 0,'), 'an explicit zero must not fall back to 50 percent power');
assert.equal(g.sensing_port_to_number('sensorPort'), 'sensorPort', 'preserve dynamic port expressions');
assert.equal(g.sensing_port_to_number('0'), '0');
assert.equal(g.sensing_port_to_number('"D"'), 3);
delete motor.children.POWER;
assert.ok(g[motor.type](motor).includes(', 50,'), 'missing argument uses documented default');
const matrix = makeRow(catalog.blocks.find(row => row.id === 'matrix_lamp'));
matrix.fields.lamp = `10000${'00000'.repeat(6)}`;
assert.equal(g[matrix.type](matrix), '_matrix.show(0x01,0x00,0x00,0x00,0x00,0x00,0x00)\n');
const nested = makeRow(catalog.blocks.find(row => row.id === 'control_repeat'));
const condition = makeRow(catalog.blocks.find(row => row.id === 'control_if_else'));
condition.children.SUBSTACK = makeRow(catalog.blocks.find(row => row.id === 'motor_stop'));
condition.children.SUBSTACK2 = makeRow(catalog.blocks.find(row => row.id === 'control_wait'));
nested.children.SUBSTACK = condition;
programs.push({id: 'nested-control', code: g[nested.type](nested)});
const multiply = makeRow(catalog.blocks.find(row => row.id === 'operator_multiply'));
const add = makeRow(catalog.blocks.find(row => row.id === 'operator_add'));
add.children.NUM1.fields.NUM = '2'; add.children.NUM2.fields.NUM = '3';
multiply.children.NUM1 = add; multiply.children.NUM2.fields.NUM = '4';
assert.equal(g[multiply.type](multiply)[0], '(2 + 3) * 4', 'nested expression precedence');
rootBlock.disabled = true;
assert.equal(g.blockToCode(nested), '', 'disabled startup stack must not generate statements');
rootBlock.disabled = false;

// All 13 dynamic mappings, including procedure definitions/arguments from native editors.
const dynamicInputs = {VALUE: makeBlock('text', {TEXT: '1'}),
    ITEM: makeBlock('text', {TEXT: 'thing'}),
    INDEX: makeBlock('math_number', {NUM: '1'})};
Object.values(dynamicInputs).forEach(block => {
    block.outputConnection = {};
});
fixtures.slice(66, 78).forEach(fixture => {
    const block = makeBlock(fixture.sourceId, {VARIABLE: 'v', LIST: 'l'}, dynamicInputs);
    const output = g[block.type](block);
    assert.ok(output, fixture.sourceId);
    programs.push({id: fixture.sourceId, code: Array.isArray(output) ? `result = ${output[0]}\n` : output});
});
const prototype = {displayNames_: ['amount', 'flag'], getProcCode: () => 'move %s %b'};
const call = makeBlock('procedures_call', {}, {a: dynamicInputs.VALUE, b: null});
call.getProcCode = prototype.getProcCode;
const definition = makeBlock('procedures_definition', {}, {custom_block: prototype});
definition.nextConnection = {targetBlock: () => motor};
g.procedures_definition(definition);
programs.push({id: 'procedure', code: g.finish(g.procedures_call(call))});
const syntax = spawnSync('python', ['-c',
    'import ast,json,sys\nfor p in json.load(sys.stdin):\n' +
    ' try: ast.parse(p["code"] or "pass", filename=p["id"])\n' +
    ' except Exception as e: print(p); raise\nprint("Python syntax passed")'],
{input: JSON.stringify(programs), encoding: 'utf8', windowsHide: true});
assert.equal(syntax.status, 0, syntax.stdout + syntax.stderr);
assert.ok(!programs.some(program => /est_runtime|rt\.|import est\b/.test(program.code)));
assert.ok(sparkBlockXml(catalog.blocks[0]).includes('spark_motor_box'));
console.log('Spark AI passed: 66 fixed mappings, dropdown variants, 13 dynamic mappings, 5 locales, ' +
    'matrix encoding, nested control and Python syntax.');
