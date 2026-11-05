const fs = require('fs');
const path = require('path');
const {createHash} = require('crypto');
const expected = '2a71476cf3449252d209d5c6002edf63ea04f052b4d87baef8abe8040fc01d76';
const output = path.resolve(__dirname, '../resources/spark-ai');
const destination = path.join(output, 'win32-x64/pika_bytecode_gen.node');
const source = process.argv[2] || destination;
// Existing verified fixtures are part of the repository; research folders are optional.
const fixtures = process.argv[3] ? [0, 1].map(slot => ({slot,
    source: fs.readFileSync(path.join(process.argv[3], `${slot}.py`), 'utf8'),
    bytecodeHex: fs.readFileSync(path.join(process.argv[3], `${slot}.py.o`)).toString('hex')})) :
    require('./spark-ai-compiler-fixtures.json');
const bytes = fs.readFileSync(source);
const sha256 = createHash('sha256').update(bytes)
    .digest('hex');
if (sha256 !== expected) throw new Error('Unexpected Spark compiler binary');
fs.mkdirSync(path.join(output, 'win32-x64'), {recursive: true});
if (path.resolve(source) !== destination) fs.copyFileSync(source, destination);
fs.writeFileSync(path.join(output, 'compiler-manifest.json'), `${JSON.stringify({
    compiler: 'PikaPython',
    version: '1.13.4',
    source: 'Spark AI 1.1.10',
    platform: 'win32',
    arch: 'x64',
    sha256,
    bytes: bytes.length,
    firmwareVersion: 111
}, null, 2)}\n`);
console.log(`Imported Spark compiler: ${bytes.length} bytes, SHA-256 ${sha256}`);
fs.writeFileSync(path.join(__dirname, 'spark-ai-compiler-fixtures.json'), `${JSON.stringify(fixtures, null, 2)}\n`);
