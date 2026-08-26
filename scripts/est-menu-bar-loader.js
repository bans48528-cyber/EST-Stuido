/**
 * Replace OpenBlock's generic connection button with the EST connection status.
 * Keeping this as a build-time transform avoids editing the installed dependency.
 * @param {string} source - OpenBlock menu-bar component source.
 * @returns {string} transformed component source.
 */
module.exports = function (source) {
    const connectionButtonPattern = new RegExp([
        ' {20}<div\\r?\\n',
        ' {24}className=\\{classNames\\(styles\\.menuBarItem, styles\\.hoverable\\)\\}\\r?\\n',
        ' {24}onMouseUp=\\{this\\.handleConnectionMouseUp\\}\\r?\\n',
        ' {20}>[\\s\\S]*?\\r?\\n',
        ' {20}<\\/div>(?=\\r?\\n {20}\\{\\/\\* <div)'
    ].join(''));

    if (!connectionButtonPattern.test(source)) {
        throw new Error('Unable to locate the OpenBlock connection menu item for EST replacement.');
    }

    const transformedSource = source.replace(
        connectionButtonPattern,
        '                    <EstStatusPanel />'
    );

    return `import EstStatusPanel from 'est-status-panel';\n${transformedSource}`;
};
