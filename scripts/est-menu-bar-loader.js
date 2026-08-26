/**
 * Keep only the EST connection status in the hardware area. EST Studio uses a
 * upload mode, so hardware selection and mode switching are hidden.
 * Keeping this as a build-time transform avoids editing the installed dependency.
 * @param {string} source - OpenBlock menu-bar component source.
 * @returns {string} transformed component source.
 */
module.exports = function (source) {
    const deviceSelectionPattern = new RegExp([
        ' {20}<Divider className=\\{classNames\\(styles\\.divider\\)\\} \\/>\\r?\\n',
        ' {20}<div\\r?\\n',
        ' {24}className=\\{classNames\\(styles\\.menuBarItem, styles\\.hoverable\\)\\}\\r?\\n',
        ' {24}onMouseUp=\\{this\\.handleSelectDeviceMouseUp\\}\\r?\\n',
        ' {20}>[\\s\\S]*?\\r?\\n',
        ' {20}<\\/div>\\r?\\n'
    ].join(''));
    const connectionButtonPattern = new RegExp([
        ' {20}<div\\r?\\n',
        ' {24}className=\\{classNames\\(styles\\.menuBarItem, styles\\.hoverable\\)\\}\\r?\\n',
        ' {24}onMouseUp=\\{this\\.handleConnectionMouseUp\\}\\r?\\n',
        ' {20}>[\\s\\S]*?\\r?\\n',
        ' {20}<\\/div>(?=\\r?\\n {20}\\{\\/\\* <div)'
    ].join(''));
    const programModePattern = new RegExp([
        ' {20}<Divider className=\\{classNames\\(styles\\.divider\\)\\} \\/>\\r?\\n',
        ' {20}<div className=\\{classNames\\(styles\\.menuBarItem, styles\\.programModeGroup\\)\\}>',
        '[\\s\\S]*?\\r?\\n',
        ' {20}<\\/div>\\r?\\n'
    ].join(''));

    if (!deviceSelectionPattern.test(source)) {
        throw new Error('Unable to locate the OpenBlock hardware selection menu item.');
    }

    if (!connectionButtonPattern.test(source)) {
        throw new Error('Unable to locate the OpenBlock connection menu item for EST replacement.');
    }

    if (!programModePattern.test(source)) {
        throw new Error('Unable to locate the OpenBlock program mode switch.');
    }

    const transformedSource = source
        .replace(deviceSelectionPattern, '')
        .replace(connectionButtonPattern, '                    <EstStatusPanel />')
        .replace(programModePattern, '')
        .replace("import Switch from 'react-switch';\n\n", '')
        .replace("import deviceIcon from './icon--device.svg';\n", '');

    return `import EstStatusPanel from 'est-status-panel';\n${transformedSource}`;
};
