/**
 * Add EST primitives to the VM's built-in block packages.
 * @param {string} source - OpenBlock VM runtime source.
 * @returns {string} transformed source.
 */
module.exports = function (source) {
    const finalCorePackage = "    scratch3_procedures: require('../blocks/scratch3_procedures')";
    const initialRealtimeMode = '        this._isRealtimeMode = true;';
    const setRealtimeModePattern = new RegExp([
        ' {4}setRealtimeMode \\(sta\\) \\{\\r?\\n',
        '[\\s\\S]*?',
        '\\r?\\n {4}\\}'
    ].join(''));
    if (!source.includes(finalCorePackage)) {
        throw new Error('Unable to locate the final OpenBlock VM core package.');
    }
    if (!source.includes(initialRealtimeMode)) {
        throw new Error('Unable to locate the OpenBlock VM initial program mode.');
    }
    if (!setRealtimeModePattern.test(source)) {
        throw new Error('Unable to locate the OpenBlock VM program mode setter.');
    }

    return source
        .replace(initialRealtimeMode, '        this._isRealtimeMode = false;')
        .replace(
            finalCorePackage,
            `${finalCorePackage},\n    est: require('est-vm-blocks')`
        )
        .replace(
            setRealtimeModePattern,
            `    setRealtimeMode () {
        if (this._isRealtimeMode) {
            this._isRealtimeMode = false;
            this.emit(Runtime.PROGRAM_MODE_UPDATE, {isRealtimeMode: false});
        }
    }`
        );
};
