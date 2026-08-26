/**
 * Replace OpenBlock's Scratch categories with the built-in EST catalog while
 * preserving OpenBlock's native dynamic variable/list and procedure categories.
 * @param {string} source - OpenBlock toolbox builder source.
 * @returns {string} transformed source.
 */
module.exports = function (source) {
    const returnStatement = "    return everything.join('\\n');";
    if (!source.includes(returnStatement)) {
        throw new Error('Unable to locate the OpenBlock toolbox return point.');
    }

    const transformedSource = source.replace(
        returnStatement,
        "    return [xmlOpen, getEstToolboxCategories(), gap, variablesXML, gap, myBlocksXML, xmlClose].join('\\n');"
    );
    return `import getEstToolboxCategories from 'est-toolbox';\n${transformedSource}`;
};
