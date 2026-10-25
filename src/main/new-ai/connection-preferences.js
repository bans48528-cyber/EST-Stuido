import fs from 'fs-extra';
import path from 'path';
import {isNewAiUsbCandidate} from './serial-transport';

const validText = value => typeof value === 'string' && value.length > 0 && value.length <= 512 &&
    !/[\x00-\x1f\x7f]/.test(value); // eslint-disable-line no-control-regex
const deviceIdentity = device => {
    if (!device || !isNewAiUsbCandidate(device)) return null;
    const usb = {vendorId: '0483', productId: '5740'};
    if (validText(device.serialNumber)) return {...usb, serialNumber: device.serialNumber};
    if (validText(device.pnpId) && /^USB\\VID_0483&PID_5740\\/i.test(device.pnpId)) {
        return {...usb, pnpId: device.pnpId.toUpperCase()};
    }
    return null;
};
export const normalizeNewAiConnectionPreferences = (value = {}) => {
    const settings = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const ble = settings.bleDevice;
    return {version: 2,
        mode: settings.mode === 'ble' ? 'ble' : 'usb',
        usbAuto: settings.usbAuto !== false,
        bleAuto: settings.bleAuto !== false,
        lastDevice: deviceIdentity(settings.lastDevice),
        bleDevice: ble && validText(ble.id) && ble.id.length <= 256 && validText(ble.name) ?
            {id: ble.id, name: ble.name.slice(0, 256)} : null};
};

let sequence = 0;
export class NewAiConnectionPreferences {
    constructor (filename) {
        this.filename = filename;
    }
    read () {
        try {
            if (fs.statSync(this.filename).size > 8192) throw new Error('Preferences too large');
            const saved = fs.readJsonSync(this.filename);
            return normalizeNewAiConnectionPreferences(saved && [1, 2].includes(saved.version) ? saved : {});
        } catch (error) {
            return normalizeNewAiConnectionPreferences();
        }
    }
    write (value) {
        const saved = normalizeNewAiConnectionPreferences(value);
        fs.ensureDirSync(path.dirname(this.filename));
        const temporary = `${this.filename}.${process.pid}.${++sequence}.tmp`;
        let created = false;
        try {
            fs.writeFileSync(temporary, JSON.stringify(saved, null, 2), {flag: 'wx'});
            created = true;
            fs.renameSync(temporary, this.filename);
        } finally {
            if (created && fs.existsSync(temporary)) fs.unlinkSync(temporary);
        }
    }
}
