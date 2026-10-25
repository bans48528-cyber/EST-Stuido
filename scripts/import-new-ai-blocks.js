/* eslint-disable global-require */
// Mechanical import of the supplied, audited NEW AI 2.2.29 definitions and generators.
const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');
const t = require('@babel/types');
const root = path.resolve(__dirname, '..');
const extraction = path.resolve(process.argv[2] || path.join(root, '../artifacts/new-ai-extraction-2026-10-23'));
const media = path.resolve(process.argv[3] || 'E:/NEW AI 2.2.29/resources/app.asar.unpacked/static/blocks-media');
const source = JSON.parse(fs.readFileSync(path.join(extraction, 'visible-blocks/blocks.json'), 'utf8'));
if (source.static_count !== 107 || source.conditional_count !== 13) throw new Error('Unexpected NEW AI catalog');
const output = path.join(root, 'src/renderer/new-ai');
const fixed = source.rows.filter(row => row.visibility === 'always');
if (fixed.length !== 107 || new Set(fixed.map(row => row.type)).size !== 107) throw new Error('Invalid fixed catalog');
const scoped = new Set([...fixed.map(row => row.type), ...Object.keys(source.input_shadow_definitions)]);
const scope = id => (scoped.has(id) ? `new_${id}` : id);
const assets = value => {
    if (value === '[RANDOM_HEX_COLOUR]') return '#00aaff';
    if (Array.isArray(value)) return value.map(assets);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => {
        if (key === 'src' && typeof item === 'string' && item.startsWith('media/')) {
            const file = path.resolve(media, item.slice(6));
            if (!file.startsWith(media + path.sep) || path.extname(file) !== '.svg') {
                throw new Error('Invalid media path');
            }
            return [key, `data:image/svg+xml;base64,${fs.readFileSync(file).toString('base64')}`];
        }
        return [key, assets(item)];
    }));
};
const catalog = {source: {software: source.software, extraction: source.extraction_date, fixed: 107, conditional: 13},
    blocks: fixed.map(row => ({id: row.type,
        category: row.category_id,
        definition: assets(row.block_definition),
        fields: assets(row.default_fields),
        inputs: row.inputs.filter(input => input.shadow).map(input => ({
            name: input.name, type: input.shadow.type, fields: assets(input.shadow.fields)
        }))})),
    shadows: Object.entries(source.input_shadow_definitions).map(([id, item]) => ({
        id, definition: assets(item.definition.json)
    }))};
const generatorRoot = path.join(extraction, 'source/node_modules/scratch-blocks/generators');
const property = node => (node.computed ? node.property.value : node.property.name);
const pythonAssignment = node => t.isExpressionStatement(node) && t.isAssignmentExpression(node.expression) &&
    t.isMemberExpression(node.expression.left) && t.isMemberExpression(node.expression.left.object) &&
    t.isIdentifier(node.expression.left.object.object, {name: 'Blockly'}) &&
    property(node.expression.left.object) === 'Python';
const readAst = file => babel.parseSync(fs.readFileSync(path.join(generatorRoot, file), 'utf8'),
    {babelrc: false, configFile: false}).program.body;
const core = readAst('python.js').filter(node => pythonAssignment(node) || t.isVariableDeclaration(node) ||
    (t.isExpressionStatement(node) && t.isCallExpression(node.expression) &&
        t.isMemberExpression(node.expression.callee) && property(node.expression.callee) === 'addReservedWords'));
const helperNames = new Set(['combined_letter_to_number', 'sensing_port_to_number',
    'cameraRecognition_port_to_number', 'grayvTo_port_to_number']);
const helpers = ['combined_motor', 'sensing', 'cameraRecognition', 'grayvTo'].flatMap(file =>
    readAst(`python/${file}.js`).filter(node => pythonAssignment(node) &&
        helperNames.has(property(node.expression.left))));
if (helpers.length !== 4) throw new Error('Missing NEW AI port helpers');
const dataHelpers = readAst('python/data.js').filter(node => t.isVariableDeclaration(node) &&
    node.declarations.some(declaration => declaration.id.name === 'normalizeQuotedNumberLiteral'));
if (dataHelpers.length !== 1) throw new Error('Missing NEW AI list normalization');
const procedures = readAst('python/procedures.js').filter(pythonAssignment);
const assignments = [...source.rows.map(row => [row.type, row.generator_js]),
    ...Object.entries(source.input_shadow_definitions).map(([id, item]) => [id, item.generator_js])]
    .map(([id, fn]) => `Blockly.Python[${JSON.stringify(scope(id))}] = ${fn};`).join('\n');
const ast = t.file(t.program([...core, ...helpers, ...dataHelpers, ...procedures,
    ...babel.parseSync(assignments, {babelrc: false, configFile: false}).program.body]));
const generated = babel.transformFromAstSync(ast, '', {babelrc: false,
    configFile: false,
    plugins: [() => ({visitor: {
        StringLiteral (p) {
            if (scoped.has(p.node.value)) p.node.value = scope(p.node.value);
        },
        ObjectProperty (p) {
            if (!p.node.computed && t.isIdentifier(p.node.key) && scoped.has(p.node.key.name)) {
                p.node.key = t.identifier(scope(p.node.key.name));
            }
        },
        // The original finisher emits "while :" when only message hats exist.
        VariableDeclaration (p) {
            if (!p.node.declarations.some(declaration => declaration.id.name === 'whileEnd')) return;
            const fallback = t.assignmentExpression('=', t.identifier('taskFinishedStr'), t.stringLiteral('True'));
            p.insertBefore(t.ifStatement(t.unaryExpression('!', t.identifier('taskFinishedStr')),
                t.expressionStatement(fallback)));
        }
    }})]}).code;
fs.mkdirSync(output, {recursive: true});
fs.writeFileSync(path.join(output, 'catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`);
fs.writeFileSync(path.join(output, 'source-generators.js'),
    `${'// Generated by scripts/import-new-ai-blocks.js from the supplied NEW AI 2.2.29 extraction.\n' +
    '// Source core copyright 2021 openblock.cc, Apache-2.0; see NOTICE.\n' +
    '/* eslint-disable */\nexport default function installNewSourceGenerators (Blockly) {\n'}${generated}\n}\n`);
const fixtures = source.rows.map(row => ({
    id: scope(row.type), sourceId: row.type, python: row.python, variants: row.variants, notes: row.notes
}));
fs.writeFileSync(path.join(root, 'scripts/new-ai-source-fixtures.json'), `${JSON.stringify(fixtures, null, 2)}\n`);
console.log(`Imported ${catalog.blocks.length} NEW AI blocks, ` +
    `${catalog.shadows.length} shadows and original task core.`);
