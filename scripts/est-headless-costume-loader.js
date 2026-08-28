/**
 * OpenBlock logs every costume as an error when no Scratch stage renderer is
 * attached. EST Studio is intentionally headless, so costume metadata is kept
 * for project compatibility without reporting a renderer failure.
 * @param {string} source - OpenBlock VM costume loader source.
 * @returns {string} costume loader with the expected headless case silenced.
 */
module.exports = function (source) {
    const headlessRendererPattern = new RegExp([
        ' {4}if \\(!renderer\\) \\{\\r?\\n',
        " {8}log\\.error\\('No rendering module present; cannot load costume: ', costume\\.name\\);\\r?\\n",
        ' {8}return Promise\\.resolve\\(costume\\);\\r?\\n',
        ' {4}\\}'
    ].join(''));

    if (!headlessRendererPattern.test(source)) {
        throw new Error('Unable to locate the OpenBlock headless costume warning.');
    }

    return source.replace(headlessRendererPattern, [
        '    if (!renderer) {',
        '        // EST Studio intentionally runs without a stage renderer.',
        '        return Promise.resolve(costume);',
        '    }'
    ].join('\n'));
};
