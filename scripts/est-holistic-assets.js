const path = require('path');

// Electron exposes both window and process. These browser assets must use URL loading.
module.exports = (content, filename) => {
    const name = path.basename(filename);
    const markers = {
        'holistic_solution_packed_assets_loader.js': "typeof process === 'object' && typeof process.versions === 'object' && typeof process.versions.node === 'string'",
        'holistic_solution_simd_wasm_bin.js': 'typeof process=="object"&&typeof process.versions=="object"&&typeof process.versions.node=="string"',
        'holistic_solution_wasm_bin.js': 'typeof process=="object"&&typeof process.versions=="object"&&typeof process.versions.node=="string"'
    };
    const marker = markers[name];
    if (!marker) return content;
    const source = content.toString('utf8');
    if (!source.includes(marker)) throw new Error(`MediaPipe environment detection changed: ${name}`);
    return Buffer.from(source.replace(marker, `typeof window === 'undefined' && (${marker})`));
};
