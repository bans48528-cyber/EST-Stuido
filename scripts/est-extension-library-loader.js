/**
 * Redirect OpenBlock's built-in Scratch extension cards to the EST-owned
 * extension registry. This keeps the native extension library UI while
 * removing unrelated Music, Pen, Translate and other Scratch entries.
 * @param {string} source - OpenBlock extension library source.
 * @returns {string} the EST extension registry bridge.
 */
module.exports = function (source) {
    if (!source.includes("extensionId: 'music'") ||
        !source.includes("extensionId: 'makeymakey'")) {
        throw new Error('Unable to locate the OpenBlock extension library.');
    }

    return "export {default} from 'est-extension-library';\n";
};
