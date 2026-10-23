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
        `    ScratchBlocks.ScratchMsgs.locales['pt-br'] = estPortugueseBlockMessages;\n` +
        `    registerEstBlocks(ScratchBlocks);\n    registerEstPythonGenerator(ScratchBlocks);\n` +
        `    defineSparkBlocksWithLocale(ScratchBlocks);\n` +
        `    registerSparkPythonGenerator(ScratchBlocks);\n\n${returnStatement}`
    );
    return `import {registerEstBlocks} from 'est-block-definitions';\n` +
        `import {defineSparkBlocksWithLocale} from 'spark-ai-blocks';\n` +
        `import {registerSparkPythonGenerator} from 'spark-ai-python-generator';\n` +
        `import estPortugueseBlockMessages from 'openblock-l10n/editor/blocks/pt-br.json';\n` +
        `import {registerEstPythonGenerator} from 'est-python-generator';\n${transformedSource}`;
};
