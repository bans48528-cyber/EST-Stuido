/**
 * Register EST block shapes while OpenBlock connects ScratchBlocks to its VM.
 * This keeps EST blocks on the built-in path instead of the extension manager.
 * @param {string} source - OpenBlock blocks adapter source.
 * @returns {string} transformed source.
 */
module.exports = function (source) {
    const returnStatement = '    return ScratchBlocks;';
    if (!source.includes(returnStatement)) {
        throw new Error('Unable to locate the OpenBlock block registration exit point.');
    }

    const transformedSource = source.replace(
        returnStatement,
        `    registerEstBlocks(ScratchBlocks);\n\n${returnStatement}`
    );
    return `import {registerEstBlocks} from 'est-block-definitions';\n${transformedSource}`;
};
