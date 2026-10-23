const portugueseBlockMessages = require('openblock-l10n/editor/blocks/pt-br.json');

/**
 * Include the upstream Portuguese block messages omitted by the generated locale bundle.
 * @param {string} source - OpenBlock block locale messages source.
 * @returns {string} transformed source with Brazilian Portuguese messages.
 */
module.exports = function (source) {
    const exportStart = 'export default {';
    const exportEndPattern = /\n\};\s*$/;

    if (!source.includes(exportStart) || !exportEndPattern.test(source)) {
        throw new Error('Unable to locate the OpenBlock block locale export.');
    }

    return source
        .replace(exportStart, 'const openBlockBlockMessages = {')
        .replace(exportEndPattern, [
            '\n};',
            `openBlockBlockMessages['pt-br'] = ${JSON.stringify(portugueseBlockMessages, null, 4)};`,
            '',
            'export default openBlockBlockMessages;'
        ].join('\n'));
};
