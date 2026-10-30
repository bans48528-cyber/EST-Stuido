/**
 * Keep ATC CodeStudio project import/export while dropping compatibility code that
 * only serves Scratch 1.0 files and browsers without a native TextEncoder.
 * Electron 15 provides TextEncoder, and ATC CodeStudio projects use the current
 * OpenBlock/Scratch 3 archive format.
 * @param {string} source - OpenBlock VM virtual-machine source.
 * @returns {string} virtual-machine source without legacy-only dependencies.
 */
module.exports = function (source) {
    const normalizedSource = source.replace(/\r\n/g, '\n');
    const textEncoderFallback = `let _TextEncoder;
if (typeof TextEncoder === 'undefined') {
    _TextEncoder = require('text-encoding').TextEncoder;
} else {
    /* global TextEncoder */
    _TextEncoder = TextEncoder;
}`;
    const sb1FallbackStart = `
            .catch(error => {
                const {SB1File, ValidationError} = require('scratch-sb1-converter');`;
    const sb1FallbackEnd = `
            });

        return validationPromise`;

    if (!normalizedSource.includes(textEncoderFallback)) {
        throw new Error('Unable to locate the OpenBlock TextEncoder fallback.');
    }

    const sb1StartIndex = normalizedSource.indexOf(sb1FallbackStart);
    const sb1EndIndex = normalizedSource.indexOf(sb1FallbackEnd, sb1StartIndex);
    if (sb1StartIndex < 0 || sb1EndIndex < 0) {
        throw new Error('Unable to locate the OpenBlock Scratch 1 project fallback.');
    }

    const withoutTextEncoding = normalizedSource.replace(
        textEncoderFallback,
        '/* global TextEncoder */\nconst _TextEncoder = TextEncoder;'
    );
    const transformedSb1StartIndex = withoutTextEncoding.indexOf(sb1FallbackStart);
    const transformedSb1EndIndex = withoutTextEncoding.indexOf(
        sb1FallbackEnd,
        transformedSb1StartIndex
    );

    const transformed = `${withoutTextEncoding.slice(0, transformedSb1StartIndex)};${withoutTextEncoding.slice(
        transformedSb1EndIndex + '\n            });'.length
    )}`;
    return transformed
        .replace('return StringUtil.stringify(sb3.serialize(this.runtime));',
            `return StringUtil.stringify(require('est-hardware-project').serializeHardwareProject(
            sb3.serialize(this.runtime), this.runtime));`)
        .replace('    deserializeProject (projectJSON, zip) {',
            `    deserializeProject (projectJSON, zip) {
        projectJSON = require('est-extension-library').restoreVisionExtension(projectJSON);
        return require('est-hardware-project').loadHardwareProject(this, projectJSON,
            () => this.deserializeHardwareProject(projectJSON, zip));
    }

    deserializeHardwareProject (projectJSON, zip) {
        this.extensionManager.clearDeviceExtension();`);
};
