/**
 * EST Studio has one built-in MicroPython target and does not use OpenBlock's
 * generic device picker. Make the code editor select Python when deviceType is
 * intentionally empty.
 * @param {string} source - OpenBlock code-generator or device helper source.
 * @returns {string} transformed source.
 */
module.exports = function (source) {
    const resourcePath = (this.resourcePath || '').replace(/\\/g, '/');
    const nullReturn = "    return 'null';";

    if (!source.includes(nullReturn)) {
        throw new Error(`Unable to locate the OpenBlock default language in ${resourcePath}.`);
    }

    if (resourcePath.endsWith('/lib/code-generator.js')) {
        const targetReturn =
            "    if (getHardwareContext().profile.compiler === 'spark-python') return 'SparkPython';\n" +
            "    if (getHardwareContext().profile.compiler === 'new-python') return 'NewPython';\n" +
            "    return 'Python';";
        return `import {getHardwareContext} from 'est-hardware-context';\n${source.replace(nullReturn, targetReturn)}`;
    }
    if (resourcePath.endsWith('/lib/device.js')) {
        return source.replace(nullReturn, "    return 'python';");
    }

    throw new Error(`Unexpected EST code-generator loader target: ${resourcePath}`);
};
