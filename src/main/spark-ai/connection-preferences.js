import fs from 'fs-extra';
import path from 'path';

const validText = value => typeof value === 'string' && value.length > 0 && value.length <= 256 &&
    // eslint-disable-next-line no-control-regex
    !/[\x00-\x1F\x7F]/.test(value);

export const normalizeSparkPreferences = (value = {}) => {
    value = value && typeof value === 'object' ? value : {};
    const device = value.bleDevice;
    return {version: 2,
        mode: value.mode === 'ble' ? 'ble' : 'usb',
        usbAuto: value.usbAuto !== false,
        bleAuto: value.bleAuto !== false,
        bleDevice: device && validText(device.id) && validText(device.name) ?
            {id: device.id, name: device.name} : null,
        // Version 1 only persisted this flag for ordinary program downloads.
        downloadInterrupted: value.downloadInterrupted === true || value.recoveryRequired === true};
};

// Persist the chooser identity, never Chromium's origin-specific opaque GATT id.
export class SparkConnectionPreferences {
    constructor (filename) {
        this.filename = filename;
    }
    read () {
        try {
            return normalizeSparkPreferences(fs.readJsonSync(this.filename));
        } catch (error) {
            return normalizeSparkPreferences();
        }
    }
    write (value) {
        const normalized = normalizeSparkPreferences(value);
        fs.ensureDirSync(path.dirname(this.filename));
        const temporary = `${this.filename}.tmp`;
        fs.writeJsonSync(temporary, normalized, {spaces: 2});
        fs.renameSync(temporary, this.filename);
    }
}
