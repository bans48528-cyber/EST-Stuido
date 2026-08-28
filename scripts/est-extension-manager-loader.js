/**
 * Remove OpenBlock's unrelated built-in extensions and generic development
 * boards, and provide extension cards from the local EST registry instead of
 * the removed resource server on port 20112.
 * @param {string} source - OpenBlock VM extension manager source.
 * @returns {string} transformed extension manager source.
 */
module.exports = function (source) {
    const builtinsPattern = new RegExp([
        'const builtinExtensions = \\{',
        '[\\s\\S]*?',
        '\\n\\};\\r?\\n\\r?\\n',
        'const builtinDevices = \\{',
        '[\\s\\S]*?',
        '\\n\\};'
    ].join(''));
    const deviceExtensionListPattern = new RegExp([
        '    getDeviceExtensionsList \\(\\) \\{',
        '[\\s\\S]*?',
        '    \\}\\r?\\n\\r?\\n',
        '(?=    /\\*\\*\\r?\\n',
        '     \\* Check whether an device extension is loaded\\.)'
    ].join(''));

    if (!builtinsPattern.test(source)) {
        throw new Error('Unable to locate the OpenBlock built-in extension registries.');
    }
    if (!deviceExtensionListPattern.test(source)) {
        throw new Error('Unable to locate the OpenBlock device extension list loader.');
    }

    return source
        .replace(builtinsPattern, [
            "const estExtensionLibrary = require('est-extension-library').default;",
            '',
            'const builtinExtensions = {};',
            'const builtinDevices = {};'
        ].join('\n'))
        .replace(deviceExtensionListPattern, [
            '    getDeviceExtensionsList () {',
            '        this._deviceExtensionsList = estExtensionLibrary.map(extension => Object.assign({}, extension, {',
            '            isLoaded: this.isDeviceExtensionLoaded(extension.extensionId)',
            '        }));',
            '        return Promise.resolve(this._deviceExtensionsList);',
            '    }',
            ''
        ].join('\n'));
};
