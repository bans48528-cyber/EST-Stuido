const fs = require('fs');
const path = require('path');
const {createHash} = require('crypto');
const release = require('../src/main/new-ai/firmware-release.json');
const source = path.resolve(process.argv[2] || 'E:/NEW AI 2.2.29/resources/LB_FWLIB');
const destination = path.resolve(__dirname, '../resources/new-ai/firmware', release.id);
const matches = (data, file) => data.length === file.bytes &&
    createHash('sha256').update(data)
        .digest('hex') === file.sha256;
// Validate the whole original bundle and all existing destinations before any copy.
const inputs = release.files.map(file => {
    const data = fs.readFileSync(path.join(source, file.path));
    if (!matches(data, file)) throw new Error(`Unverified original NEW AI resource: ${file.path}`);
    const target = path.join(destination, file.path);
    const exists = fs.existsSync(target);
    if (exists && !matches(fs.readFileSync(target), file)) throw new Error(`Existing resource differs: ${target}`);
    return {data, target, exists};
});
for (const {data, target, exists} of inputs) {
    if (exists) continue;
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, data, {flag: 'wx'});
}
console.log(`Imported ${release.files.length} verified NEW AI firmware resources, version ${release.version}.`);
