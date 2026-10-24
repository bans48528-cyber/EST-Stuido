const fs = require('fs');
const path = require('path');
const {createHash} = require('crypto');
const expected = '902f43061019656d118f27e2856ec6a04116bdf161a62d5d84d587b2cc85e2f5';
const source = process.argv[2] ||
    'E:/Spark AI 1.1.9/Spark-AI/resources/app.asar.unpacked/node_modules/' +
    'pika-bytecode-gen-napi/build/Release/pika_bytecode_gen.node';
const output = path.resolve(__dirname, '../resources/spark-ai');
const bytes = fs.readFileSync(source);
const sha256 = createHash('sha256').update(bytes)
    .digest('hex');
if (sha256 !== expected) throw new Error('Unexpected Spark compiler binary');
fs.mkdirSync(path.join(output, 'win32-x64'), {recursive: true});
fs.copyFileSync(source, path.join(output, 'win32-x64/pika_bytecode_gen.node'));
fs.writeFileSync(path.join(output, 'compiler-manifest.json'), `${JSON.stringify({
    compiler: 'PikaPython',
    version: '1.13.4',
    source: 'Spark AI 1.1.9',
    platform: 'win32',
    arch: 'x64',
    sha256,
    bytes: bytes.length,
    firmwareVersion: 110,
    firmwareCommit: '561b7a112f9df923fbf98e468f475e61137d1c0a'
}, null, 2)}\n`);
console.log(`Imported Spark compiler: ${bytes.length} bytes, SHA-256 ${sha256}`);
const samples = process.argv[3] || path.resolve(__dirname,
    '../../artifacts/spark-ai-extraction-2026-10-23/pipeline/compiler/samples');
const fixtures = [0, 1].map(slot => ({slot,
    source: fs.readFileSync(path.join(samples, `${slot}.py`), 'utf8'),
    bytecodeHex: fs.readFileSync(path.join(samples, `${slot}.py.o`)).toString('hex')}));
fs.writeFileSync(path.join(__dirname, 'spark-ai-compiler-fixtures.json'), `${JSON.stringify(fixtures, null, 2)}\n`);
