/**
 * Keep OpenBlock's VM lifecycle while omitting Scratch's desktop audio engine.
 * EST sound blocks generate Python for the device and do not play through the
 * computer. Project sound metadata remains supported by the VM schema.
 * @param {string} source - OpenBlock GUI VM manager source.
 * @returns {string} VM manager without desktop audio initialization.
 */
module.exports = function (source) {
    const audioImportPattern = /import AudioEngine from 'scratch-audio';\r?\n/;
    const audioInitializationPattern = new RegExp([
        ' {16}this\\.audioEngine = new AudioEngine\\(\\);\\r?\\n',
        ' {16}this\\.props\\.vm\\.attachAudioEngine\\(this\\.audioEngine\\);\\r?\\n'
    ].join(''));

    if (!audioImportPattern.test(source) || !audioInitializationPattern.test(source)) {
        throw new Error('Unable to locate the OpenBlock desktop audio initialization.');
    }

    return source
        .replace(audioImportPattern, '')
        .replace(audioInitializationPattern, [
            '                // EST sound blocks run on the device; no desktop audio engine is needed.',
            ''
        ].join('\n'));
};
