/**
 * Remove the Scratch/OpenBlock tutorial deck payload from EST Studio builds.
 * Tutorial entry points and render surfaces are already removed from the EST
 * interface, but OpenBlock reducers still import this module while starting.
 * Returning an empty deck collection keeps those reducers valid without
 * bundling the unreachable tutorial images and videos.
 * @param {string} source - OpenBlock tutorial deck module source.
 * @returns {string} an empty, API-compatible tutorial deck module.
 */
module.exports = function (source) {
    const firstTutorialAsset = "import libraryIntro from './thumbnails/getting-started.jpg';";
    if (!source.includes(firstTutorialAsset) || !source.includes('export default {')) {
        throw new Error('Unable to locate the OpenBlock tutorial deck module.');
    }

    return 'export default {};\n';
};
