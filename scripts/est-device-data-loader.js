/**
 * EST Studio has one fixed HID device and does not use OpenBlock's local
 * resource server or generic device library. Initialise that Redux list as
 * empty so mounting the GUI never requests 127.0.0.1:20112/devices/*.json.
 * @param {string} source - OpenBlock vm-listener HOC source.
 * @returns {string} transformed HOC source.
 */
module.exports = function (source) {
    const deviceLibraryImport = "import {makeDeviceLibrary} from '../lib/libraries/devices/index.jsx';\n";
    const deviceListRequestPattern = new RegExp([
        ' {12}// Update device list\r?\n',
        ' {12}this\\.props\\.vm\\.extensionManager\\.getDeviceList\\(\\)\\.then\\(data => \\{\r?\n',
        ' {16}this\\.props\\.onSetDeviceData\\(makeDeviceLibrary\\(data\\)\\);\r?\n',
        ' {12}\\}\\)\r?\n',
        ' {16}\\.catch\\(\\(\\) => \\{\r?\n',
        ' {20}this\\.props\\.onSetDeviceData\\(makeDeviceLibrary\\(\\)\\);\r?\n',
        ' {16}\\}\\);\r?\n'
    ].join(''));

    if (!source.includes(deviceLibraryImport)) {
        throw new Error('Unable to locate the OpenBlock generic device-library import.');
    }
    if (!deviceListRequestPattern.test(source)) {
        throw new Error('Unable to locate the OpenBlock local device-list request.');
    }

    return source
        .replace(deviceLibraryImport, '')
        .replace(deviceListRequestPattern, '            this.props.onSetDeviceData([]);\n');
};
