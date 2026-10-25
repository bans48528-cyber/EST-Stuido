import fs from 'fs-extra';
import path from 'path';

// Opt-in, per-user workaround for native Windows accessibility/message stalls.
// Read once before app.ready; never disable accessibility globally for all users.
export class InputCompatibility {
    constructor ({filename, commandLine, platform = process.platform}) {
        this.filename = filename;
        this.available = platform === 'win32';
        this.savedEnabled = this.read();
        this.saveQueue = Promise.resolve();
        this.screenReaderOverride = commandLine.hasSwitch('est-screen-reader') ||
            commandLine.hasSwitch('force-renderer-accessibility');
        this.active = this.available && !this.screenReaderOverride && (this.savedEnabled ||
            commandLine.hasSwitch('est-input-compatibility') ||
            commandLine.hasSwitch('disable-renderer-accessibility'));
        if (this.available && this.screenReaderOverride) {
            // A standard Chromium screen-reader switch also overrides the saved workaround.
            commandLine.removeSwitch('disable-renderer-accessibility');
        } else if (this.active) {
            commandLine.appendSwitch('disable-renderer-accessibility');
        }
    }

    read () {
        try {
            if (fs.statSync(this.filename).size > 4096) return false;
            const saved = fs.readJsonSync(this.filename);
            return Boolean(saved && saved.version === 1 && saved.enabled === true);
        } catch (error) {
            return false;
        }
    }

    getStatus () {
        return {available: this.available,
            savedEnabled: this.savedEnabled,
            active: this.active,
            requiresRestart: this.available && this.savedEnabled !== this.active,
            screenReaderOverride: this.screenReaderOverride};
    }

    setEnabled (enabled) {
        if (!this.available || typeof enabled !== 'boolean') {
            return Promise.reject(new Error('INPUT_COMPATIBILITY_INVALID'));
        }
        const save = async () => {
            await fs.ensureDir(path.dirname(this.filename));
            const temporary = `${this.filename}.${process.pid}.tmp`;
            try {
                await fs.writeJson(temporary, {version: 1, enabled}, {flag: 'wx'});
                await fs.rename(temporary, this.filename);
                this.savedEnabled = enabled;
            } finally {
                await fs.remove(temporary);
            }
            return this.getStatus();
        };
        this.saveQueue = this.saveQueue.catch(() => {}).then(save);
        return this.saveQueue;
    }
}
