import fs from 'fs-extra';
import path from 'path';
import {DEFAULT_HARDWARE_ID, getHardwareProfile} from '../../common/hardware-profiles';

export class HardwareSelectionPreferences {
    constructor (filename) {
        this.filename = filename;
    }

    read () {
        try {
            if (fs.statSync(this.filename).size > 4096) return DEFAULT_HARDWARE_ID;
            const saved = fs.readJsonSync(this.filename);
            if (!saved || saved.version !== 1) return DEFAULT_HARDWARE_ID;
            return getHardwareProfile(saved.hardwareId).id;
        } catch (error) {
            return DEFAULT_HARDWARE_ID;
        }
    }

    write (hardwareId) {
        const id = getHardwareProfile(hardwareId).id;
        fs.ensureDirSync(path.dirname(this.filename));
        const temporary = `${this.filename}.${process.pid}.tmp`;
        try {
            fs.writeJsonSync(temporary, {version: 1, hardwareId: id}, {spaces: 2});
            fs.renameSync(temporary, this.filename);
        } finally {
            fs.removeSync(temporary);
        }
    }
}
