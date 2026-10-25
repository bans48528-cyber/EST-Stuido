// Offline export lookup for system DLL instruction-pointer samples. No symbol downloads or target memory reads.
const fs = require('fs');
const path = require('path');
const report = JSON.parse(fs.readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, ''));
const exportsFor = name => {
    const bytes = fs.readFileSync(path.join(process.env.SystemRoot, 'System32', name));
    const nt = bytes.readUInt32LE(0x3c), optional = nt + 24;
    const count = bytes.readUInt16LE(nt + 6), sectionStart = optional + bytes.readUInt16LE(nt + 20);
    const sections = Array.from({length: count}, (_, index) => {
        const offset = sectionStart + index * 40;
        return {rva: bytes.readUInt32LE(offset + 12), size: Math.max(bytes.readUInt32LE(offset + 8),
            bytes.readUInt32LE(offset + 16)), file: bytes.readUInt32LE(offset + 20)};
    });
    const fileOffset = rva => {
        const section = sections.find(s => rva >= s.rva && rva < s.rva + s.size);
        if (!section) throw Error('Unmapped PE RVA');
        return section.file + rva - section.rva;
    };
    const directory = optional + (bytes.readUInt16LE(optional) === 0x20b ? 112 : 96);
    const table = fileOffset(bytes.readUInt32LE(directory));
    const names = fileOffset(bytes.readUInt32LE(table + 32));
    const ordinals = fileOffset(bytes.readUInt32LE(table + 36));
    const functions = fileOffset(bytes.readUInt32LE(table + 28));
    return Array.from({length: bytes.readUInt32LE(table + 24)}, (_, index) => {
        const offset = fileOffset(bytes.readUInt32LE(names + index * 4));
        return {name: bytes.toString('utf8', offset, bytes.indexOf(0, offset)),
            rva: bytes.readUInt32LE(functions + bytes.readUInt16LE(ordinals + index * 2) * 4)};
    }).sort((a, b) => b.rva - a.rva);
};
const cache = new Map();
for (const hit of report.Hits) {
    const match = /^(\w+\.dll)\+0x([a-f0-9]+)$/i.exec(hit.Location);
    if (!match) continue;
    const name = match[1].toLowerCase(), rva = parseInt(match[2], 16);
    if (!cache.has(name)) cache.set(name, exportsFor(name));
    const symbol = cache.get(name).find(s => s.rva <= rva);
    if (symbol) hit.NearestExport = `${symbol.name}+0x${(rva - symbol.rva).toString(16)}`;
}
console.log(JSON.stringify(report, null, 2));
