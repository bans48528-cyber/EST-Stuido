/**
 * Add EST primitives to the VM's built-in block packages.
 * @param {string} source - OpenBlock VM runtime source.
 * @returns {string} transformed source.
 */
module.exports = function (source) {
    const finalCorePackage = "    scratch3_procedures: require('../blocks/scratch3_procedures')";
    if (!source.includes(finalCorePackage)) {
        throw new Error('Unable to locate the final OpenBlock VM core package.');
    }
    return source.replace(
        finalCorePackage,
        `${finalCorePackage},\n    est: require('est-vm-blocks')`
    );
};
