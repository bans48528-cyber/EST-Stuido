const path = require('path');

module.exports = (content, filename) => {
    const name = path.basename(filename);
    if (!name.endsWith('.js')) return content;
    const kind = /^(hands|pose|face_mesh)(?:\.|_)/.exec(name);
    if (!kind) throw new Error(`Unexpected MediaPipe asset: ${name}`);
    let source = content.toString('utf8');
    // Each legacy Solution otherwise overwrites the other Solutions' global WASM factories.
    source = source.replace(/createMediapipeSolutions(Wasm|PackedAssets)/g, `createEst_${kind[1]}_$1`);
    if (name.endsWith('_packed_assets_loader.js')) {
        source = source.replace(/\bModule\b/g, `Est_${kind[1]}_Module`);
    }
    if (/_solution_(?:simd_)?wasm_bin\.js$|_packed_assets_loader\.js$/.test(name)) {
        const nodeDetection = /typeof process\s*===?\s*['"]object['"]\s*&&\s*typeof process\.versions\s*===?\s*['"]object['"]\s*&&\s*typeof process\.versions\.node\s*===?\s*['"]string['"]/;
        if (!nodeDetection.test(source)) throw new Error(`MediaPipe environment detection changed: ${name}`);
        source = source.replace(nodeDetection, match => `typeof window === 'undefined' && (${match})`);
    }
    return Buffer.from(source);
};
