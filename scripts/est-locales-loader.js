/**
 * Override EST Studio-specific interface copy without editing openblock-l10n.
 * @param {string} source - OpenBlock editor locale messages source.
 * @returns {string} transformed source with EST message overrides.
 */
module.exports = function (source) {
    const upstreamMessage =
        '    "gui.sharedMessages.loadFromComputerTitle": "从电脑中上传",';
    const estMessage =
        '    "gui.sharedMessages.loadFromComputerTitle": "从电脑打开",';

    if (!source.includes(upstreamMessage)) {
        throw new Error('Unable to locate the OpenBlock zh-cn load-from-computer message.');
    }

    return source.replace(upstreamMessage, estMessage);
};
