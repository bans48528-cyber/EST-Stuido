const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const path = require('path');
const babel = require('@babel/core');

const root = path.resolve(__dirname, '..');
const rendererRoot = path.join(root, 'src', 'renderer');
const originalJsLoader = Module._extensions['.js'];
const originalSvgLoader = Module._extensions['.svg'];
Module._extensions['.png'] = (module, filename) => { module.exports = filename; };

Module._extensions['.svg'] = (module, filename) => {
    module.exports = filename;
};
Module._extensions['.js'] = (module, filename) => {
    if (!filename.startsWith(path.join(root, 'src'))) return originalJsLoader(module, filename);
    const transformed = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
        babelrc: false,
        plugins: ['@babel/plugin-transform-modules-commonjs']
    });
    module._compile(transformed.code, filename);
};

const aiRoot = path.join(rendererRoot, 'est-ai');
const {ALL_EST_BLOCK_IDS} = require(path.join(rendererRoot, 'est-blocks', 'definitions.js'));
const {
    EST_AI_ALLOWED_BLOCK_IDS,
    EST_AI_BLOCK_SPEC,
    EST_AI_IR_VERSION,
    EST_AI_RULE_CATEGORIES
} = require(path.join(aiRoot, 'est-block-spec.js'));
const {
    EstBlockIrValidationError,
    validateEstBlockIr
} = require(path.join(aiRoot, 'est-block-validator.js'));
const {compileEstBlockIrToXml} = require(path.join(aiRoot, 'est-block-compiler.js'));
const {importEstBlockIrToWorkspace} = require(path.join(aiRoot, 'est-ai-workspace.js'));
const {makeCoverageIr} = require('./ai-ui-test/coverage-fixture');
const {EST_HOME_BLOCK_GUIDE_CATEGORIES} = require(path.join(rendererRoot, 'est-home-block-guide.js'));
const {normalizeEstAiBitmap} = require(path.join(aiRoot, 'est-ai-bitmap.js'));
const {decodeEstDisplayBitmap, getEstDisplayBitmapPixel} =
    require(path.join(rendererRoot, 'est-blocks/display-bitmap.js'));

EST_HOME_BLOCK_GUIDE_CATEGORIES.forEach(category => category.items.forEach(type => {
    assert.ok(EST_AI_BLOCK_SPEC[type], `Visible block is not covered: ${type}`);
}));

ALL_EST_BLOCK_IDS.forEach(blockId => {
    assert.ok(EST_AI_BLOCK_SPEC[blockId], `missing EST AI block spec: ${blockId}`);
});
assert.strictEqual(ALL_EST_BLOCK_IDS.length, 93);
assert.ok(ALL_EST_BLOCK_IDS.every(id => !id.startsWith('event_vision_')));
assert.ok(EST_AI_ALLOWED_BLOCK_IDS.includes('operator_add'));
assert.ok(EST_AI_ALLOWED_BLOCK_IDS.includes('operator_and'));
const categorizedBlockIds = Object.values(EST_AI_RULE_CATEGORIES).reduce(
    (blockIds, categoryBlockIds) => blockIds.concat(categoryBlockIds),
    []
);
assert.strictEqual(categorizedBlockIds.length, EST_AI_ALLOWED_BLOCK_IDS.length);
assert.deepStrictEqual(new Set(categorizedBlockIds), new Set(EST_AI_ALLOWED_BLOCK_IDS));

const makeValidNode = type => {
    const spec = EST_AI_BLOCK_SPEC[type];
    const node = {type};
    const fieldNames = Object.keys(spec.fields);
    if (fieldNames.length) {
        node.fields = fieldNames.reduce((fields, name) => {
            const descriptor = spec.fields[name];
            fields[name] = descriptor.values ? descriptor.values[0] :
                ({bitmap: 'v1:',
                    variable: descriptor.variableType === 'list' ? 'items' : 'value',
                    procedure: 'helper',
                    argument: 'value'}[descriptor.kind]);
            return fields;
        }, {});
    }
    const inputNames = Object.keys(spec.inputs);
    if (inputNames.length) {
        node.inputs = inputNames.reduce((inputs, name) => {
            const descriptor = spec.inputs[name];
            if (descriptor.kind === 'boolean') {
                inputs[name] = {type: 'sensor_touch_pressed', inputs: {PORT: '1'}};
            } else if (descriptor.kind === 'enum') {
                inputs[name] = type === 'drive_set_pair' && name === 'RIGHT_PORT' ?
                    descriptor.values[1] : descriptor.values[0];
            } else if (descriptor.kind === 'text') {
                inputs[name] = 'EST';
            } else if (descriptor.kind === 'any') {
                inputs[name] = 1;
            } else {
                inputs[name] = typeof descriptor.min === 'number' ? descriptor.min : 1;
            }
            return inputs;
        }, {});
    }
    if (spec.branches.SUBSTACK) node.body = [];
    if (spec.branches.SUBSTACK2) node.elseBody = [];
    return node;
};

EST_AI_ALLOWED_BLOCK_IDS.forEach(blockId => {
    const spec = EST_AI_BLOCK_SPEC[blockId];
    const node = makeValidNode(blockId);
    const stack = {event: {type: 'event_program_start'}, body: []};
    if (spec.kind === 'hat') {
        stack.event = node;
    } else if (spec.kind === 'statement') {
        stack.body = [node];
    } else if (spec.kind === 'boolean') {
        stack.body = [{type: 'control_if', inputs: {CONDITION: node}, body: []}];
    } else {
        stack.body = [{type: 'display_text_line', inputs: {LINE: 1, TEXT: node}}];
    }
    const ir = {version: 1,
        mode: 'insert',
        stacks: [stack],
        variables: [{name: 'value', type: ''}, {name: 'items', type: 'list'}]};
    if (spec.category === 'procedures') {
        const argument = blockId.startsWith('argument_reporter_') ?
            [{name: 'value', type: spec.fields.VALUE.argumentType}] : [];
        ir.procedures = [{name: 'helper', arguments: argument}];
        const definition = {type: 'procedures_definition', fields: {PROCEDURE: 'helper'}};
        if (blockId === 'procedures_call') ir.stacks.push({event: definition, body: []});
        else stack.event = definition;
    }
    const result = compileEstBlockIrToXml(ir);
    assert.match(result.xml, new RegExp(`type="${blockId}"`), `failed to compile ${blockId}`);
});

const coverage = makeCoverageIr();
const fullCompiled = compileEstBlockIrToXml(coverage);
assert.match(fullCompiled.xml, /<variables><variable type="" id="est-ai-v0">计数/);
assert.match(fullCompiled.xml, /variabletype="list">记录/);
assert.match(fullCompiled.xml, /<mutation proccode="显示记录 %n %s %b"/);
assert.match(fullCompiled.xml, /<value name="est-ai-p0-a0">/);
assert.match(fullCompiled.xml, /<shadow type="procedures_prototype">/);
assert.deepStrictEqual(compileEstBlockIrToXml(fullCompiled.normalized).normalized, fullCompiled.normalized);
const bitmap = fullCompiled.normalized.stacks[0].body[4].fields.BITMAP;
assert.ok(getEstDisplayBitmapPixel(decodeEstDisplayBitmap(bitmap), 66, 40));
assert.ok(!getEstDisplayBitmapPixel(decodeEstDisplayBitmap(bitmap), 58, 40));
assert.strictEqual(normalizeEstAiBitmap(bitmap), bitmap);
for (const invalid of ['v1:!!!!', 'https://example.com/image.png', {rows: ['01', '1']},
    {rows: ['2']}, {rows: ['1'], x: 180}, {rows: ['1'], scale: 17}, {rows: ['1'], script: 'alert(1)'}]) {
    assert.throws(() => normalizeEstAiBitmap(invalid));
}
const rejectsCoverage = (edit, code) => {
    const ir = makeCoverageIr();
    edit(ir);
    const result = validateEstBlockIr(ir);
    assert.ok(!result.valid && result.errors.some(error => error.code === code), JSON.stringify(result.errors));
};
rejectsCoverage(ir => {
    ir.variables = [];
}, 'UNKNOWN_VARIABLE');
rejectsCoverage(ir => {
    ir.variables[1].type = '';
}, 'UNKNOWN_VARIABLE');
rejectsCoverage(ir => {
    ir.variables.push({name: '计数', type: ''});
}, 'DUPLICATE_NAME');
rejectsCoverage(ir => {
    ir.variables[0].name = '__proto__';
}, 'INVALID_NAME');
rejectsCoverage(ir => {
    ir.procedures = [];
}, 'UNKNOWN_PROCEDURE');
rejectsCoverage(ir => {
    ir.stacks.pop();
}, 'INVALID_PROCEDURE_DEFINITION');
rejectsCoverage(ir => {
    ir.stacks.push(JSON.parse(JSON.stringify(ir.stacks[1])));
}, 'INVALID_PROCEDURE_DEFINITION');
rejectsCoverage(ir => {
    delete ir.stacks[0].body[3].inputs.序号;
}, 'MISSING_INPUT');
rejectsCoverage(ir => {
    ir.stacks[0].body[3].inputs.extra = 1;
}, 'UNKNOWN_INPUT');
rejectsCoverage(ir => {
    ir.stacks[0].body[3].inputs.可见 = 1;
}, 'INVALID_INPUT');
rejectsCoverage(ir => {
    ir.stacks[0].body[0].inputs.VALUE = {type: 'argument_reporter_number', fields: {VALUE: '序号'}};
}, 'INVALID_ARGUMENT_SCOPE');
rejectsCoverage(ir => {
    ir.procedures[0].arguments[0].type = 'boolean';
}, 'INVALID_ARGUMENT_SCOPE');
rejectsCoverage(ir => {
    ir.procedures[0].arguments.push({name: '序号', type: 'text'});
}, 'DUPLICATE_ARGUMENT');
rejectsCoverage(ir => {
    ir.procedures[0].name = 'bad %n';
}, 'INVALID_NAME');
rejectsCoverage(ir => {
    ir.stacks[0].body[4].fields.BITMAP = 'v1:bad';
}, 'INVALID_BITMAP');

rejectsCoverage(ir => {
    ir.procedures[0].warp = 'false';
}, 'INVALID_WARP');
rejectsCoverage(ir => {
    ir.procedures[0].arguments = new Array(17).fill({name: 'n', type: 'number'});
},
'INVALID_ARGUMENTS');
rejectsCoverage(ir => {
    ir.variables = new Array(65).fill({name: 'n', type: ''});
}, 'INVALID_DECLARATIONS');
rejectsCoverage(ir => {
    ir.stacks[0].body[0].fields.VARIABLE = {toString: null};
}, 'INVALID_FIELD_VALUE');
const escaped = {version: 1,
    mode: 'insert',
    variables: [{name: 'A<&"', type: ''}],
    stacks: [{event: {type: 'event_program_start'},
        body: [
            {type: 'data_setvariableto', fields: {VARIABLE: 'A<&"'}, inputs: {VALUE: '<script>'}}
        ]}]};
assert.match(compileEstBlockIrToXml(escaped).xml, /A&lt;&amp;&quot;/);
assert.doesNotMatch(compileEstBlockIrToXml(escaped).xml, /<script>/);

const sampleIr = {
    version: EST_AI_IR_VERSION,
    mode: 'insert',
    stacks: [{
        x: 420,
        y: 180,
        event: {type: 'event_program_start'},
        body: [
            {
                type: 'drive_set_pair',
                inputs: {LEFT_PORT: 'B', RIGHT_PORT: 'C'}
            },
            {
                type: 'control_repeat',
                inputs: {TIMES: 3},
                body: [{
                    type: 'drive_move_for',
                    fields: {DIRECTION: 'forward', UNIT: 'rotations'},
                    inputs: {AMOUNT: 1}
                }]
            },
            {
                type: 'control_if_else',
                inputs: {
                    CONDITION: {
                        type: 'sensor_touch_pressed',
                        inputs: {PORT: '1'}
                    }
                },
                body: [{type: 'drive_stop'}],
                elseBody: [{
                    type: 'control_wait_seconds',
                    inputs: {SECONDS: 0.2}
                }]
            }
        ]
    }]
};

const validation = validateEstBlockIr(sampleIr);
assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors, null, 2));
assert.strictEqual(validation.errors.length, 0);
assert.strictEqual(validation.warnings.length, 0);
assert.strictEqual(validation.blockCount, 8);

const compiled = compileEstBlockIrToXml(sampleIr);
assert.strictEqual(compiled.mode, 'insert');
assert.strictEqual(compiled.blockCount, 8);
assert.match(compiled.xml, /^<xml xmlns="https:\/\/developers\.google\.com\/blockly\/xml">/);
assert.match(compiled.xml, /<block type="event_program_start" x="420" y="180">/);
assert.match(compiled.xml, /<next><block type="drive_set_pair">/);
assert.match(compiled.xml, /<shadow type="est_drive_port_picker"><field name="PORT">B<\/field><\/shadow>/);
assert.match(compiled.xml, /<statement name="SUBSTACK"><block type="drive_move_for">/);
assert.match(compiled.xml, /<statement name="SUBSTACK2"><block type="control_wait_seconds">/);
assert.match(compiled.xml, /<value name="CONDITION"><block type="sensor_touch_pressed">/);

const escapedTextIr = {
    version: 1,
    mode: 'replace',
    stacks: [{
        event: {type: 'event_program_start'},
        body: [{
            type: 'display_text_line',
            inputs: {LINE: 1, TEXT: '<EST & AI>'}
        }]
    }]
};
assert.match(compileEstBlockIrToXml(escapedTextIr).xml, /&lt;EST &amp; AI&gt;/);

const invalidPort = JSON.parse(JSON.stringify(sampleIr));
invalidPort.stacks[0].body[0].inputs.RIGHT_PORT = 'Z';
const invalidPortResult = validateEstBlockIr(invalidPort);
assert.strictEqual(invalidPortResult.valid, false);
assert.ok(invalidPortResult.errors.some(error => error.code === 'INVALID_ENUM_INPUT'));

const duplicatePort = JSON.parse(JSON.stringify(sampleIr));
duplicatePort.stacks[0].body[0].inputs.RIGHT_PORT = 'B';
assert.ok(validateEstBlockIr(duplicatePort).errors.some(error => error.code === 'DUPLICATE_DRIVE_PORT'));

const invalidField = JSON.parse(JSON.stringify(sampleIr));
invalidField.stacks[0].body[1].body[0].fields.DIRECTION = 'sideways';
assert.ok(validateEstBlockIr(invalidField).errors.some(error => error.code === 'INVALID_FIELD_VALUE'));

const unexpectedCode = JSON.parse(JSON.stringify(sampleIr));
unexpectedCode.stacks[0].body[0].javascript = 'runDevice()';
assert.ok(validateEstBlockIr(unexpectedCode).errors.some(error => error.code === 'UNKNOWN_PROPERTY'));

const invalidTerminalChain = JSON.parse(JSON.stringify(sampleIr));
invalidTerminalChain.stacks[0].body = [
    {type: 'control_forever', body: []},
    {type: 'drive_stop'}
];
assert.ok(
    validateEstBlockIr(invalidTerminalChain).errors.some(error => error.code === 'TERMINAL_BLOCK_HAS_NEXT')
);

const cyclicForever = {
    type: 'control_forever',
    body: []
};
cyclicForever.body.push(cyclicForever);
const cyclicResult = validateEstBlockIr({
    version: 1,
    mode: 'insert',
    stacks: [{event: {type: 'event_program_start'}, body: [cyclicForever]}]
});
assert.ok(cyclicResult.errors.some(error => error.code === 'CYCLIC_IR'));

const unsafeResult = validateEstBlockIr({
    version: 1,
    mode: 'insert',
    stacks: [{
        event: {type: 'event_program_start'},
        body: [{
            type: 'control_forever',
            body: [{type: 'drive_start_steer', inputs: {STEERING: 0}}]
        }]
    }]
});
assert.strictEqual(unsafeResult.valid, true);
assert.ok(unsafeResult.warnings.some(warning => warning.code === 'CONTINUOUS_MOTION_IN_FOREVER'));

assert.throws(
    () => compileEstBlockIrToXml(invalidPort),
    error => error instanceof EstBlockIrValidationError && error.errors.length > 0
);

const workspaceCalls = [];
const fakeWorkspace = {
    clear: () => workspaceCalls.push('clear')
};
const fakeScratchBlocks = {
    Events: {
        group: null,
        getGroup () {
            return this.group;
        },
        setGroup (value) {
            workspaceCalls.push(`group:${value}`);
            this.group = value === false ? null : 'est-ai-test-group';
        }
    },
    Xml: {
        textToDom: xml => ({xml}),
        domToWorkspace: (dom, workspace) => {
            assert.strictEqual(workspace, fakeWorkspace);
            assert.match(dom.xml, /event_program_start/);
            workspaceCalls.push('replace-import');
            return ['replace-id'];
        },
        appendDomToWorkspace: (dom, workspace) => {
            assert.strictEqual(workspace, fakeWorkspace);
            assert.match(dom.xml, /event_program_start/);
            workspaceCalls.push('append-import');
            return ['append-id'];
        }
    }
};
let codeUpdateCount = 0;
const fakeVm = {runtime: {requestCodeUpdate: () => codeUpdateCount++}};

const insertResult = importEstBlockIrToWorkspace({
    ScratchBlocks: fakeScratchBlocks,
    workspace: fakeWorkspace,
    vm: fakeVm,
    ir: sampleIr
});
assert.deepStrictEqual(insertResult.blockIds, ['append-id']);
assert.deepStrictEqual(workspaceCalls, ['group:true', 'append-import', 'group:false']);
assert.strictEqual(codeUpdateCount, 1);

workspaceCalls.length = 0;
const replaceResult = importEstBlockIrToWorkspace({
    ScratchBlocks: fakeScratchBlocks,
    workspace: fakeWorkspace,
    vm: fakeVm,
    ir: sampleIr,
    mode: 'replace'
});
assert.deepStrictEqual(replaceResult.blockIds, ['replace-id']);
assert.deepStrictEqual(workspaceCalls, ['group:true', 'clear', 'replace-import', 'group:false']);
assert.strictEqual(codeUpdateCount, 2);

const blocksSource = fs.readFileSync(
    path.join(root, 'node_modules', 'openblock-gui', 'src', 'containers', 'blocks.jsx'),
    'utf8'
);
const nativeEditorsLoader = require(path.join(root, 'scripts', 'openblock-native-editors-loader.js'));
const patchedBlocksSource = nativeEditorsLoader.call({
    resourcePath: path.join(root, 'node_modules', 'openblock-gui', 'src', 'containers', 'blocks.jsx')
}, blocksSource);
assert.match(patchedBlocksSource, /EST_AI_IMPORT_REQUEST_EVENT/);
assert.match(patchedBlocksSource, /handleEstAiImportRequest/);
assert.match(patchedBlocksSource, /importEstBlockIrToWorkspace/);
assert.match(patchedBlocksSource, /window\.removeEventListener\(EST_AI_IMPORT_REQUEST_EVENT/);

const webpackSource = fs.readFileSync(path.join(root, 'webpack.makeConfig.js'), 'utf8');
assert.match(webpackSource, /'est-ai-workspace\$': EST_AI_WORKSPACE/);

const appSource = fs.readFileSync(path.join(rendererRoot, 'app.jsx'), 'utf8');
const aiPanelSource = fs.readFileSync(path.join(rendererRoot, 'EstAiPanel.jsx'), 'utf8');
const aiPanelStyles = fs.readFileSync(path.join(rendererRoot, 'EstAiPanel.css'), 'utf8');
const menuLayoutSource = fs.readFileSync(path.join(rendererRoot, 'EstMenuBarLayout.jsx'), 'utf8');
assert.match(appSource, /<EstAiPanel visible=\{!this\.state\.homeMounted\} \/>/);
assert.match(aiPanelSource, /requestEstAiBlockImport/);
assert.match(aiPanelSource, /createEstProgramStackPreviews/);
assert.match(aiPanelSource, /replaceConfirm/);
assert.doesNotMatch(aiPanelSource, /styles\.trigger/);
assert.doesNotMatch(aiPanelSource, /dangerouslySetInnerHTML/);
assert.match(aiPanelStyles, /z-index: 9000/);
assert.match(menuLayoutSource, /est-menu-bar-ai-button/);
assert.match(menuLayoutSource, /dispatchEstAiOpenRequest/);

const stackPreviewSource = fs.readFileSync(
    path.join(aiRoot, 'est-program-preview.js'),
    'utf8'
);
assert.match(stackPreviewSource, /new ScratchBlocks\.WorkspaceSvg/);
assert.match(stackPreviewSource, /workspace\.getBlocksBoundingBox/);
assert.match(stackPreviewSource, /computedStyleToInlineStyle/);

Module._extensions['.js'] = originalJsLoader;
Module._extensions['.svg'] = originalSvgLoader;

console.log(
    `EST AI IR tests passed and every allowed block compiled (${ALL_EST_BLOCK_IDS.length} EST blocks, ` +
    `${EST_AI_ALLOWED_BLOCK_IDS.length - ALL_EST_BLOCK_IDS.length} native operators/data/procedure blocks)`
);
