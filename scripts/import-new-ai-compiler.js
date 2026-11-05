const fs = require('fs');
const path = require('path');
const {createHash} = require('crypto');
const output = path.resolve(__dirname, '../resources/new-ai');
const destination = path.join(output, 'win32/pika-python.exe');
const source = process.argv[2] || destination;
const fixtures = process.argv[3] ? [0, 8].map(slot => ({slot,
    source: fs.readFileSync(path.join(process.argv[3], `${slot}.py`), 'utf8'),
    bytecodeHex: fs.readFileSync(path.join(process.argv[3], `${slot}.py.o`)).toString('hex')})) :
    require('./new-ai-compiler-fixtures.json');
const binary = fs.readFileSync(source);
const sha256 = createHash('sha256').update(binary)
    .digest('hex');
if (sha256 !== '2f3f8a1eb2461ffc60fb3a1cba6fefd5c688626fa58b057e9ed6a734e70b4e59') {
    throw new Error('Unexpected NEW AI compiler binary');
}
fs.mkdirSync(path.join(output, 'win32'), {recursive: true});
if (path.resolve(source) !== destination) fs.copyFileSync(source, destination);
fs.writeFileSync(path.join(output, 'compiler-manifest.json'), `${JSON.stringify({
    source: 'NEW AI 2.2.29, compiler-only executable from the supplied 2026-10-23 extraction',
    version: '1.13.4',
    bytes: binary.length,
    sha256,
    targetResourceVersion: 321
}, null, 2)}\n`);
fs.writeFileSync(path.join(__dirname, 'new-ai-compiler-fixtures.json'), `${JSON.stringify(fixtures, null, 2)}\n`);
console.log(`Imported NEW AI compiler: ${binary.length} bytes, SHA-256 ${sha256}`);
