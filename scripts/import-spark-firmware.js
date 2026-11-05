const fs = require('fs');
const path = require('path');
const {createHash} = require('crypto');
const release = require('../src/main/spark-ai/firmware-release.json');
const source = path.resolve(process.argv[2] || 'D:/Spark AI/resources/LB_FWLIB');
const output = path.resolve(__dirname, '../resources/spark-ai/firmware', release.id);
const matches = (data, file) => data.length === file.bytes &&
    createHash('sha256').update(data)
        .digest('hex') === file.sha256;

// Validate the complete source and all existing destinations before copying anything.
const inputs = release.files.map(file => {
    const data = fs.readFileSync(path.join(source, file.path));
    if (!matches(data, file)) throw new Error(`Unverified Spark resource: ${file.path}`);
    const destination = path.join(output, file.path);
    const exists = fs.existsSync(destination);
    if (exists && !matches(fs.readFileSync(destination), file)) {
        throw new Error(`Existing resource differs; not overwriting: ${destination}`);
    }
    return {file, data, destination, exists};
});
for (const {data, destination, exists} of inputs) {
    if (exists) continue;
    fs.mkdirSync(path.dirname(destination), {recursive: true});
    fs.writeFileSync(destination, data, {flag: 'wx'});
}
console.log(`Imported ${release.files.length} verified Spark AI resources (${release.version}).`);
