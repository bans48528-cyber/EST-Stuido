/**
 * Remove alerts used exclusively by Scratch's server project lifecycle and
 * cloud-variable connection. EST upload, import and code-editor alerts remain.
 * @param {string} source - OpenBlock alert catalogue source.
 * @returns {string} alert catalogue containing only locally reachable alerts.
 */
module.exports = function (source) {
    const arrayStartMarker = 'const alerts = [';
    const firstLocalAlertPattern = / {4}\{\r?\n {8}alertId: 'importingAsset',/;
    const onlineAlertIds = [
        'createSuccess',
        'createCopySuccess',
        'createRemixSuccess',
        'creating',
        'creatingCopy',
        'creatingRemix',
        'creatingError',
        'savingError',
        'saveSuccess',
        'saving',
        'cloudInfo'
    ];
    const arrayStart = source.indexOf(arrayStartMarker);
    const firstLocalAlert = source.search(firstLocalAlertPattern);

    if (arrayStart < 0 || firstLocalAlert < 0 || firstLocalAlert <= arrayStart ||
        !onlineAlertIds.every(alertId => (
            source.slice(arrayStart, firstLocalAlert).includes(`alertId: '${alertId}'`)
        ))) {
        throw new Error('Unable to locate the OpenBlock online-only alerts.');
    }

    return `${source.slice(0, arrayStart + arrayStartMarker.length)}\n${source.slice(firstLocalAlert)}`;
};
