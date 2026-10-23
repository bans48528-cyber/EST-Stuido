const estEditorMessageOverrides = require('../src/renderer/est-editor-message-overrides.json');
const portugueseEditorMessages = require('openblock-l10n/editor/interface/pt-br.json');

/**
 * Override EST Studio-specific interface copy without editing openblock-l10n.
 * @param {string} source - OpenBlock editor locale messages source.
 * @returns {string} transformed source with EST message overrides.
 */
module.exports = function (source) {
    const exportStart = 'export default {';
    const exportEndPattern = /\n\};\s*$/;

    if (!source.includes(exportStart) || !exportEndPattern.test(source)) {
        throw new Error('Unable to locate the OpenBlock editor locale export.');
    }

    const overridesSource = JSON.stringify(estEditorMessageOverrides, null, 4);
    const portugueseSource = JSON.stringify(portugueseEditorMessages, null, 4);

    return source
        .replace(exportStart, 'const openBlockEditorMessages = {')
        .replace(exportEndPattern, [
            '\n};',
            `const estPortugueseEditorMessages = ${portugueseSource};`,
            `const estEditorMessageOverrides = ${overridesSource};`,
            "const estEditorMessages = Object.assign({}, openBlockEditorMessages, {'pt-br': estPortugueseEditorMessages});",
            'const estMergedEditorMessages = Object.keys(estEditorMessageOverrides).reduce((messages, locale) => {',
            '    const baseMessages = messages[locale] || messages.en || {};',
            '    messages[locale] = Object.assign({}, baseMessages, estEditorMessageOverrides[locale]);',
            '    return messages;',
            '}, estEditorMessages);',
            '',
            'export default estMergedEditorMessages;'
        ].join('\n'));
};
