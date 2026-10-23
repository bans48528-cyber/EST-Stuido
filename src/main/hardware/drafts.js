import fs from 'fs-extra';
import path from 'path';
import {getHardwareProfile} from '../../common/hardware-profiles';

const MAX_DRAFT_BYTES = 32 * 1024 * 1024;

export class HardwareDraftStore {
    constructor (directory) {
        this.directory = directory;
        this.sequence = 0;
    }

    file (hardwareId) {
        getHardwareProfile(hardwareId);
        return path.join(this.directory, `${hardwareId}.json`);
    }

    async write ({hardwareId, title, data}) {
        const file = this.file(hardwareId);
        if (!(data instanceof Uint8Array) || !data.byteLength || data.byteLength > MAX_DRAFT_BYTES) {
            throw new Error('HARDWARE_DRAFT_INVALID');
        }
        const draft = {hardwareId,
            title: String(title || '').slice(0, 256),
            data: Buffer.from(data).toString('base64')};
        await fs.ensureDir(this.directory);
        const temporary = `${file}.${process.pid}.${++this.sequence}.tmp`;
        try {
            await fs.writeJson(temporary, draft);
            await fs.rename(temporary, file);
        } finally {
            await fs.remove(temporary);
        }
    }

    async read (hardwareId) {
        const file = this.file(hardwareId);
        try {
            const stat = await fs.stat(file);
            if (stat.size > MAX_DRAFT_BYTES * 1.4) throw new Error('HARDWARE_DRAFT_INVALID');
            const draft = await fs.readJson(file);
            if (draft.hardwareId !== hardwareId || typeof draft.data !== 'string') {
                throw new Error('HARDWARE_DRAFT_INVALID');
            }
            return {hardwareId, title: String(draft.title || ''), data: Buffer.from(draft.data, 'base64')};
        } catch (error) {
            if (error.code === 'ENOENT') return null;
            throw error;
        }
    }
}
