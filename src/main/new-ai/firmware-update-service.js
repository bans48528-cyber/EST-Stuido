import fs from 'fs-extra';
import path from 'path';
import {createHash} from 'crypto';
import release from './firmware-release.json';
import {NewAiError, newAiFrame} from './protocol';
import {newAiPortIdentity, isNewAiUsbCandidate} from './serial-transport';
import {newAiFirmwareBlockers} from '../../common/new-ai-firmware';
import {NewAiFirmwareLink, newAiFirmwareBounded as bounded, newAiFirmwareDelay as delay} from './firmware-link';

const DIRECTORY_COMMANDS = Object.freeze({app: 0xDA, boot: 0xDB, config: 0xDC, version: 0xDD, music: 0xEC});
export const getNewAiFirmwareRoot = () => [
    typeof process.resourcesPath === 'string' ? path.join(process.resourcesPath, 'new-ai/firmware', release.id) : null,
    path.resolve(process.cwd(), 'resources/new-ai/firmware', release.id),
    path.resolve(__dirname, '../../resources/new-ai/firmware', release.id)
].find(root => root && fs.existsSync(root));

const checkFile = async (root, file, retainData) => {
    let handle;
    try {
        if (!root) return {...file, valid: false, error: 'NEW_FW_FILE_MISSING'};
        const parts = file.path.split('/');
        if (parts.length !== 2 || !DIRECTORY_COMMANDS[parts[0]] || !/^[\x20-\x7e]{1,80}$/.test(parts[1]) ||
            ['.', '..'].includes(parts[1]) || parts[1].includes('\\')) throw new Error('Invalid resource path');
        const target = path.join(root, file.path);
        const actualRoot = await fs.realpath(root);
        const relative = path.relative(actualRoot, await fs.realpath(target));
        if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Resource escaped bundle');
        const stat = await fs.lstat(target);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== file.bytes) throw new Error('Invalid size');
        handle = await fs.open(target, 'r');
        const opened = await fs.fstat(handle);
        if (!opened.isFile() || opened.size !== file.bytes) throw new Error('Invalid opened resource');
        const data = Buffer.alloc(file.bytes);
        let offset = 0;
        while (offset < data.length) {
            const result = await fs.read(handle, data, offset, data.length - offset, offset);
            if (!result.bytesRead) throw new Error('Truncated resource');
            offset += result.bytesRead;
        }
        if (createHash('sha256').update(data)
            .digest('hex') !== file.sha256) throw new Error('Invalid SHA-256');
        if (file.path === 'boot/registryApp.txt' && data.toString('ascii') !== 'LB_Boot2.bin') {
            throw new Error('Invalid startup registry');
        }
        if (file.path === 'version/Version.txt' && data.toString('ascii') !== String(release.version)) {
            throw new Error('Invalid version');
        }
        if (file.path === 'app/LB_Boot2.bin' &&
            (data.readUInt32LE(0) !== 0x2401B190 || data.readUInt32LE(4) !== 0x240002E1)) {
            throw new Error('Invalid RAM Boot2');
        }
        if (file.path === 'app/pikaNewAi.bin' &&
            (data.readUInt32LE(0) !== 0x2404DDC0 || data.readUInt32LE(4) !== 0x08020BA9)) {
            throw new Error('Invalid H7 application');
        }
        return {...file, valid: true, error: null, ...(retainData ? {data} : {})};
    } catch (error) {
        return {...file,
            valid: false,
            error: error.code === 'ENOENT' ? 'NEW_FW_FILE_MISSING' : 'NEW_FW_FILE_INVALID'};
    } finally {
        if (typeof handle === 'number') await fs.close(handle);
    }
};

export class NewAiFirmwareUpdateService {
    constructor ({device, getRoot = getNewAiFirmwareRoot, timeouts = {}} = {}) {
        this.device = device;
        this.getRoot = getRoot;
        this.timeouts = {bootDelay: 3000, boot: 30000, application: 60000, poll: 250, quiet: 200, ...timeouts};
        this.busy = false;
        this.state = {active: false,
            phase: 'idle',
            bytes: 0,
            total: release.files.reduce((sum, file) => sum + file.bytes, 0)};
    }
    update (patch, immediate = false) {
        this.state = {...this.state, ...patch};
        if (this.device) {
            this.device.firmwareState = {...this.state};
            this.device.publish(immediate);
        }
    }
    async loadResources (retainData = false) {
        const root = this.getRoot();
        const files = [];
        for (const file of release.files) files.push(await checkFile(root, file, retainData));
        const report = {releaseId: release.id,
            hardwareId: release.hardwareId,
            version: release.version,
            source: release.source,
            totalBytes: this.state.total,
            valid: files.every(file => file.valid),
            files: files.map(file => ({path: file.path,
                bytes: file.bytes,
                sha256: file.sha256,
                valid: file.valid,
                error: file.error}))};
        return {report, files};
    }
    async inspect () {
        if (!this.inspection) {
            this.inspection = this.loadResources().then(({report}) => report)
                .finally(() => {
                    this.inspection = null;
                });
        }
        const report = await this.inspection;
        const blockers = newAiFirmwareBlockers(this.device ? this.device.getState() : {}, report);
        return {...report, blockers, canUpdate: blockers.length === 0};
    }
    start (request = {}) {
        if (this.device && this.device.connectionMode === 'ble') throw new NewAiError('NEW_FW_USB_ONLY');
        if (!request || request.confirmedErase !== true) throw new NewAiError('NEW_FW_ERASE_CONFIRM');
        if (request.releaseId !== release.id || typeof request.recovery !== 'boolean') {
            throw new NewAiError('NEW_FW_RESOURCE_INVALID');
        }
        if (!this.device) throw new NewAiError('NEW_DISCONNECTED');
        if (this.busy) throw new NewAiError('NEW_BUSY');
        this.device.reserveFirmwareUpdate();
        this.busy = true;
        this.update({active: true,
            phase: 'checking',
            bytes: 0,
            file: null,
            error: null,
            result: null,
            transferComplete: false,
            recoveryRequired: false}, true);
        this.done = this.run(request).finally(() => {
            this.busy = false;
        });
        return this.done;
    }
    async run (request) {
        const previousRecovery = Boolean(this.device.recoveryRequired);
        let touched = false;
        let link;
        try {
            // All resources are pinned, fully checked and loaded before the destructive reset.
            const {report, files} = await this.loadResources(true);
            const state = {...this.device.getState(), busy: false};
            const blockers = newAiFirmwareBlockers(state, report, request);
            if (blockers.length) throw new NewAiError(blockers[0]);
            const ports = await bounded(this.device.listDevices(), 3000, 'NEW_SCAN_ERROR');
            const port = ports.find(item => item.path === (request.recovery ? request.path : state.port));
            const identity = newAiPortIdentity(port);
            if (!port || !isNewAiUsbCandidate(port) || !identity) throw new NewAiError('NEW_FW_SELECT_PORT');
            if (!request.recovery) {
                if (identity !== newAiPortIdentity(this.device.previousDevice)) {
                    throw new NewAiError('NEW_FW_DEVICE_CHANGED');
                }
                this.update({phase: 'resetting'}, true);
                const transport = this.device.takeFirmwareTransport();
                link = new NewAiFirmwareLink(transport, this.timeouts);
                link.portPath = port.path;
                await link.open({alreadyOpen: true});
                touched = true;
                // 6F formats external storage. It defines no ACK; a disappearing USB port is expected.
                await bounded(transport.write(newAiFrame(0x6F, Buffer.from('RESET_FWLIB', 'ascii'))),
                    5000, 'NEW_WRITE_TIMEOUT').catch(() => {
                    this.update({resetWriteUncertain: true});
                });
            }
            this.update({phase: 'waitingBoot'}, true);
            if (!request.recovery) {
                // Match the original software: retain the USB handle and start SOURCE after 3 seconds.
                await delay(this.timeouts.bootDelay);
                if (link.failure) {
                    await link.close(); link = null;
                } else link.prepareBootTransfer();
            }
            if (!link) {
                await this.device.disconnect({pauseAuto: false, allowBusy: true});
                link = await this.openMatching(identity, Date.now() + this.timeouts.boot, true);
            }
            this.update({phase: 'transferring'}, true);
            // Boot1 loads Boot2 after a 500ms gap, even without registryApp.txt (fallback name).
            // Send the RAM Boot2 last, after all application, music and registry/version resources.
            const ordered = [...files.filter(file => file.path !== release.activationFile),
                files.find(file => file.path === release.activationFile)];
            let bytes = 0;
            for (const file of ordered) {
                this.update({file: file.path});
                touched = true;
                await link.send(DIRECTORY_COMMANDS[file.path.split('/')[0]],
                    Buffer.from(path.posix.basename(file.path), 'ascii'));
                for (let offset = 0; offset < file.data.length; offset += 248) {
                    const chunk = file.data.subarray(offset, offset + 248);
                    await link.send(offset + chunk.length === file.data.length ? 0xBB : 0xAA, chunk);
                    bytes += chunk.length;
                    this.update({bytes});
                }
            }
            this.update({phase: 'restarting', file: null, transferComplete: true}, true);
            const deadline = Date.now() + this.timeouts.application;
            let monitor;
            let wrongVersion = false;
            const applicationReady = sample => {
                // A legacy report cached while copying resources is not the restarted application.
                if (sample.legacyProtocol) return false;
                if (sample.version !== release.version) {
                    wrongVersion = true; return false;
                }
                return true;
            };
            while (Date.now() < deadline) {
                try {
                    monitor = await link.waitForMonitor(Math.min(500, Math.max(1, deadline - Date.now())),
                        applicationReady);
                    if (monitor) break;
                } catch (error) {
                    if (error.code !== 'NEW_MONITOR_TIMEOUT') {
                        await link.close(); link = null;
                        link = await this.openMatching(identity, deadline, false);
                    }
                }
            }
            if (!monitor) throw new NewAiError(wrongVersion ? 'NEW_FW_VERSION_MISMATCH' : 'NEW_FW_RECONNECT_TIMEOUT');
            if (monitor.legacyProtocol || monitor.version !== release.version) {
                throw new NewAiError('NEW_FW_VERSION_MISMATCH');
            }
            const applicationPort = link.portPath;
            this.update({phase: 'reconnecting'}, true);
            await link.close(); link = null;
            await this.device.connect({path: applicationPort}, {firmware: true});
            if (!this.device.monitor || this.device.monitor.legacyProtocol ||
                this.device.monitor.version !== release.version) throw new NewAiError('NEW_FW_VERSION_MISMATCH');
            const result = {transferComplete: true,
                reconnected: true,
                versionMatched: true,
                version: this.device.monitor.version,
                imageVerified: false,
                releaseId: release.id};
            this.update({active: false, phase: 'complete', error: null, result, recoveryRequired: false}, true);
            this.device.releaseFirmwareUpdate();
            return result;
        } catch (error) {
            if (link) await link.close();
            if (touched) await this.device.disconnect({pauseAuto: false, allowBusy: true}).catch(() => {});
            this.update({active: false,
                phase: 'error',
                error: error.code || 'NEW_SERIAL_ERROR',
                recoveryRequired: touched || previousRecovery}, true);
            this.device.releaseFirmwareUpdate({recoveryRequired: touched || previousRecovery});
            throw error;
        }
    }
    async openMatching (identity, deadline, boot) {
        while (Date.now() < deadline) {
            const ports = await bounded(this.device.listDevices(), Math.max(1, Math.min(3000, deadline - Date.now())),
                'NEW_SCAN_ERROR').catch(() => []);
            const matches = ports.filter(port => isNewAiUsbCandidate(port) && newAiPortIdentity(port) === identity);
            if (matches.length > 1) throw new NewAiError('NEW_FW_DEVICE_CHANGED');
            if (matches.length === 1) {
                const link = new NewAiFirmwareLink(this.device.createTransport(matches[0].path), this.timeouts);
                link.portPath = matches[0].path;
                try {
                    await link.open();
                    if (boot) await delay(this.timeouts.quiet);
                    if (link.failure) throw link.failure;
                    if (boot && link.monitor && !link.monitor.legacyProtocol) {
                        throw new NewAiError('NEW_FW_BOOT_REQUIRED');
                    }
                    return link;
                } catch (error) {
                    await link.close();
                    if (error.code === 'NEW_WRONG_DEVICE') throw error;
                }
            }
            await delay(this.timeouts.poll);
        }
        throw new NewAiError(boot ? 'NEW_FW_BOOT_TIMEOUT' : 'NEW_FW_RECONNECT_TIMEOUT');
    }
}
