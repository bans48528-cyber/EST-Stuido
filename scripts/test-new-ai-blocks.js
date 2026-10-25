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
const catalog = require('../src/renderer/new-ai/catalog.json');
const fixtures = require('./new-ai-source-fixtures.json');
const {registerNewPythonGenerator} = require('../src/renderer/new-ai/python-generator');
const {defineNewBlocksWithLocale, getNewToolboxCategories} = require('../src/renderer/new-ai/blocks');
const B = {INPUT_VALUE: 1,
    LIST_VARIABLE_TYPE: 'list',
    Blocks: {motor_stop: {sentinel: true}},
    ScratchMsgs: {locales: {en: {}}},
    Variables: {NAME_TYPE: 'variable', allVariables: workspace => workspace.getAllVariables()},
    Procedures: {NAME_TYPE: 'procedure'}};
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
vm.runInNewContext(fs.readFileSync(require.resolve('openblock-blocks/core/generator.js'), 'utf8'), {Blockly: B, goog});
B.Python = new B.Generator('Python');
const before = B.Python;
registerNewPythonGenerator(B);
assert.strictEqual(B.Python, before, 'NEW AI must not overwrite EST Python');
const g = B.NewPython;
const workspace = {blockDB_: {}, getVariableMap: () => ({getVariableById: () => null}), getAllVariables: () => []};
const hat = {type: 'new_event_whenflagclicked',
    previousConnection: null,
    disabled: false,
    getSurroundParent: () => null};
const makeBlock = (type, fields = {}, parent = hat, output = false) => ({
    id: type,
    type,
    fields,
    parent,
    children: {},
    outputConnection: output ? {} : null,
    previousConnection: type.includes('event_when') ? null : {},
    next: null,
    inputList: [],
    workspace,
    nextConnection: {targetBlock () {
        return this.owner.next;
    }},
    getFieldValue (name) {
        return this.fields[name];
    },
    getInputTargetBlock (name) {
        return this.children[name] || null;
    },
    getSurroundParent () {
        return this.outputConnection ? this.parent : null;
    },
    getRootBlock: () => hat,
    getTopStackBlock: () => hat,
    getOutputShape: () => null,
    getCommentText: () => '',
    getDescendants: () => [],
    getNextBlock () {
        return this.next;
    }
});
const makeRow = row => {
    const output = (row.definition.extensions || []).some(extension => extension.startsWith('output_'));
    const block = makeBlock(`new_${row.id}`, {...row.fields}, hat, output);
    block.nextConnection.owner = block;
    row.inputs.forEach(input => {
        const child = makeBlock(`new_${input.type}`, {...input.fields}, block, true);
        child.nextConnection.owner = child;
        block.children[input.name] = child;
        block.inputList.push({type: 1, connection: {targetBlock: () => child}});
    });
    return block;
};
const normalize = value => (value === null || typeof value === 'undefined' ? '' : String(value))
    .replace(/\s+/g, '').replace(/"/g, "'");
const programs = [];
for (const row of catalog.blocks) {
    g.init(workspace);
    const block = makeRow(row);
    const result = g[block.type](block);
    const source = Array.isArray(result) ? result[0] : result;
    const fixture = fixtures.find(item => item.sourceId === row.id);
    if (!['control_break', 'operator_not'].includes(row.id)) {
        const expected = fixture.python.replace(/\[RANDOM_HEX_COLOUR\]/g, '0xaa00ff');
        assert.equal(normalize(source), normalize(expected), row.id);
    }
    if (!row.id.startsWith('event_when') && row.id !== 'control_break') {
        programs.push({name: row.id, source: Array.isArray(result) ? `result = ${source}\n` : source || ''});
    }
    for (const variant of fixture.variants || []) {
        if (!Object.prototype.hasOwnProperty.call(block.fields, variant.field)) continue;
        Object.assign(block.fields, row.fields, {[variant.field]: variant.value});
        const value = g[block.type](block);
        assert.equal(normalize(Array.isArray(value) ? value[0] : value), normalize(variant.code),
            `${row.id}.${variant.field}=${variant.value}`);
    }
}
const catalogBeforeLocales = JSON.stringify(catalog);
const chinese = /[\u3400-\u9fff]/;
const placeholders = message => (message.match(/%\d+/g) || []).sort();
const fieldValues = definition => Object.entries(definition).filter(([key]) => /^args\d+$/.test(key))
    .flatMap(([, args]) => args.filter(arg => Array.isArray(arg.options))
        .map(arg => [arg.name, arg.options.map(([, value]) => value)]));
const originalValues = new Map();
for (const locale of ['zh-cn', 'zh-tw', 'en', 'pt-br', 'ru']) {
    B.ScratchMsgs.locales[locale] = require(`openblock-l10n/editor/blocks/${locale}.json`);
    defineNewBlocksWithLocale(B, locale);
    const xml = getNewToolboxCategories(locale);
    assert.equal((xml.match(/<block /g) || []).length, 107);
    assert.equal((xml.match(/<category /g) || []).length, 10);
    assert.ok(xml.includes('new_cameraRecognition') && xml.includes('new_grayv2'));
    assert.ok(!xml.includes('spark_'));
    if (['en', 'pt-br', 'ru'].includes(locale)) assert.ok(!chinese.test(xml), `category text: ${locale}`);
    for (const row of [...catalog.blocks, ...catalog.shadows]) {
        let definition;
        B.Blocks[`new_${row.id}`].init.call({jsonInit: value => {
            definition = value;
        },
        getField: () => ({setValidator () {}})});
        assert.ok(definition.message0 &&
            !definition.extensions.some(extension => extension.startsWith('colours_')), row.id);
        for (const [key, message] of Object.entries(definition).filter(([name]) => /^message\d+$/.test(name))) {
            assert.deepStrictEqual(placeholders(message), placeholders(row.definition[key]),
                `preserve argument placeholders: ${locale} ${row.id}.${key}`);
            if (['en', 'pt-br', 'ru'].includes(locale)) {
                assert.ok(!chinese.test(message), `untranslated block: ${locale} ${row.id}.${key}`);
            }
        }
        if (locale === 'zh-cn') originalValues.set(row.id, fieldValues(definition));
        else {
            assert.deepStrictEqual(fieldValues(definition), originalValues.get(row.id),
                `preserve option values and order: ${locale} ${row.id}`);
        }
        for (const args of Object.entries(definition).filter(([key]) => /^args\d+$/.test(key))
            .map(([, a]) => a)) {
            for (const arg of args) {
                if (!Array.isArray(arg.options)) continue;
                for (const [label] of arg.options) {
                    const text = typeof label === 'string' ? label : label.alt;
                    assert.ok(text && typeof text === 'string', `${locale} ${row.id}: nonempty option label`);
                    if (['en', 'pt-br', 'ru'].includes(locale)) {
                        assert.ok(!chinese.test(text), `untranslated option: ${locale} ${row.id} ${text}`);
                    }
                }
            }
        }
    }
    assert.ok(B.Blocks.motor_stop.sentinel);
}
assert.equal(JSON.stringify(catalog), catalogBeforeLocales, 'localization must not mutate the source catalog');
// Real Blockly traversal and the source task finisher must remove C-style task markers.
for (const count of [1, 2]) {
    const hats = Array.from({length: count}, () => {
        const start = makeRow(catalog.blocks.find(row => row.id === 'event_whenflagclicked'));
        start.next = makeRow(catalog.blocks.find(row => row.id === 'matrix_lamp_text'));
        return start;
    });
    const source = g.workspaceToCode({...workspace, getTopBlocks: () => hats});
    assert.ok(source.includes('_thread.start_new_thread(task0, ())'));
    assert.ok(!source.includes('/* Start */') && !source.includes('while :'));
    assert.equal((source.match(/_matrix.show_roll/g) || []).length, count, source);
    programs.push({name: `start-stacks-${count}`, source});
}
const message = makeRow(catalog.blocks.find(row => row.id === 'event_whenbroadcastreceived'));
const messageOnly = g.workspaceToCode({...workspace, getTopBlocks: () => [message]});
assert.ok(messageOnly.includes('while True:') && !messageOnly.includes('while :'));
programs.push({name: 'message-only', source: messageOnly});
// Native variable/list opcodes are supplied by the existing Scratch editors.
for (const fixture of fixtures.slice(107).filter(item => item.sourceId !== 'procedures_call')) {
    g.init(workspace);
    const block = makeBlock(fixture.sourceId, {VARIABLE: 'v', LIST: 'l'});
    block.nextConnection.owner = block;
    for (const [name, type, field, value] of [['VALUE', 'text', 'TEXT', '1'], ['ITEM', 'text', 'TEXT', 'item'],
        ['INDEX', 'math_number', 'NUM', '1']]) {
        const child = makeBlock(type, {[field]: value}, block, true);
        child.nextConnection.owner = child;
        block.children[name] = child;
        block.inputList.push({name, type: B.INPUT_VALUE, connection: {targetBlock: () => child}});
    }
    const result = g[fixture.sourceId](block);
    programs.push({name: fixture.sourceId, source: Array.isArray(result) ? `result = ${result[0]}\n` : result});
}
assert.equal(g.stringToHex('1'.repeat(63)).length, 9);
for (const port of 'ABCDEFGH') {
    assert.equal(Number(g.cameraRecognition_port_to_number(port)), 'ABCDEFGH'.indexOf(port));
    assert.equal(Number(g.grayvTo_port_to_number(port)), 'ABCDEFGH'.indexOf(port));
}
const python = ['python', 'python3', 'py'].find(command => spawnSync(command, ['--version'],
    {windowsHide: true, timeout: 5000}).status === 0);
assert.ok(python, 'Python is required for NEW AI syntax validation');
const result = spawnSync(python, [path.join(__dirname, 'check-python-syntax.py')], {
    input: JSON.stringify({cases: programs}),
    encoding: 'utf8',
    windowsHide: true,
    timeout: 20000,
    env: {...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1'}
});
assert.equal(result.status, 0, result.stdout + result.stderr);
Module._extensions['.js'] = originalLoader;
module.exports = {programs};
console.log('NEW AI passed: 107 mappings, five block/dropdown locales with stable argument and option values, ' +
    '63 pixels, hardware isolation ' +
    `and ${programs.length} Python AST cases.`);
