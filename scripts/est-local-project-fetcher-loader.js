/**
 * Constrain OpenBlock's project fetcher to EST Studio's cached starter project.
 * Local .ob files are loaded by the desktop file uploader and never need the
 * Scratch project or asset servers.
 * @param {string} source - OpenBlock project fetcher source.
 * @returns {string} project fetcher without online host defaults.
 */
module.exports = function (source) {
    const fetchMarker = `        fetchProject (projectId, loadingState) {
            return storage`;
    const renderPropsMarker = `                intl,
                isLoadingProject: isLoadingProjectProp,`;
    const hostDefaultsPattern = new RegExp([
        ' {4}ProjectFetcherComponent\\.defaultProps = \\{\\r?\\n',
        " {8}assetHost: 'https://assets\\.scratch\\.mit\\.edu',\\r?\\n",
        " {8}projectHost: 'https://projects\\.scratch\\.mit\\.edu'\\r?\\n",
        ' {4}\\};'
    ].join(''));

    const normalizedSource = source.replace(/\r\n/g, '\n');
    if (!normalizedSource.includes(fetchMarker) ||
        !normalizedSource.includes(renderPropsMarker) ||
        !hostDefaultsPattern.test(source)) {
        throw new Error('Unable to locate the OpenBlock online project fetcher defaults.');
    }

    return source
        .replace(/ {8}fetchProject \(projectId, loadingState\) \{\r?\n {12}return storage/, [
            '        fetchProject (projectId, loadingState) {',
            "            if (String(projectId) !== '0') {",
            "                const error = new Error('EST Studio only opens project files from this computer.');",
            '                this.props.onError(error);',
            '                return Promise.resolve();',
            '            }',
            '            return storage'
        ].join('\n'))
        .replace(/ {16}intl,\r?\n {16}isLoadingProject: isLoadingProjectProp,/, [
            '                intl,',
            '                isCreatingNew,',
            '                isLoadingProject: isLoadingProjectProp,'
        ].join('\n'))
        .replace(hostDefaultsPattern, [
            '    ProjectFetcherComponent.defaultProps = {',
            '        assetHost: null,',
            '        projectHost: null',
            '    };'
        ].join('\n'));
};
