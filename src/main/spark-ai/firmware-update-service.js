import fs from 'fs-extra';
import path from 'path';
import {createHash} from 'crypto';
import release from './firmware-release.json';
import {SparkError, validateSparkBytecode, sparkFrame} from './protocol';
import {sparkFirmwareBlockers} from '../../common/spark-firmware';
import {sparkPortIdentity, isSparkUsbCandidate} from './discovery';
import {SparkFirmwareLink, firmwareDelay, firmwareBounded} from './firmware-link';

export const getSparkFirmwareRoot = () => {
    const roots = [
        typeof process.resourcesPath === 'string' ?
            path.join(process.resourcesPath, 'spark-ai/firmware', release.id) : null,
        path.resolve(process.cwd(), 'resources/spark-ai/firmware', release.id),
        path.resolve(__dirname, '../../resources/spark-ai/firmware', release.id)
    ];
    return roots.find(root => root && fs.existsSync(root));
};

const checkFile = async (root, file, retainData = false) => {
    if (!root) return {...file, valid: false, error: 'SPARK_FW_FILE_MISSING'};
    let handle;
    try {
        const fullPath = path.join(root, file.path);
        // Do not follow resource symlinks/junctions outside the selected bundle.
        const actualRoot = await fs.realpath(root);
        const actualFile = await fs.realpath(fullPath);
        const relative = path.relative(actualRoot, actualFile);
        if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Invalid resource path');
        const stat = await fs.lstat(fullPath);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== file.bytes) {
            throw new Error('Invalid resource size');
        }
        handle = await fs.open(fullPath, 'r');
        const opened = await fs.fstat(handle);
        if (!opened.isFile() || opened.size !== file.bytes) throw new Error('Invalid opened resource');
        // Fixed-size reads bound memory even if a resource changes during validation.
        const data = Buffer.alloc(file.bytes);
        let offset = 0;
        while (offset < data.length) {
            const result = await fs.read(handle, data, offset, data.length - offset, offset);
            if (!result.bytesRead) throw new Error('Truncated resource');
            offset += result.bytesRead;
        }
        if (createHash('sha256').update(data)
            .digest('hex') !== file.sha256) throw new Error('Invalid SHA-256');
        if (file.path === 'app/app.bin' &&
            (data.readUInt32LE(0) !== 0x2001F980 || data.readUInt32LE(4) !== 0x0801031D)) {
            throw new Error('Invalid APP vector');
        }
        if (file.path.endsWith('.o')) validateSparkBytecode(data);
        if (file.path === 'version/version.txt' && data.toString('ascii') !== String(release.version)) {
            throw new Error('Invalid resource version');
        }
        if (file.path === 'app/updata.txt' && data.toString('ascii') !== 'OK') throw new Error('Invalid marker');
        return {...file, valid: true, error: null, ...(retainData ? {data} : {})};
    } catch (error) {
        return {...file,
            valid: false,
            error: error.code === 'ENOENT' ? 'SPARK_FW_FILE_MISSING' : 'SPARK_FW_FILE_INVALID'};
    } finally {
        if (typeof handle === 'number') await fs.close(handle);
    }
};

export class SparkFirmwareUpdateService {
    constructor ({device, getRoot = getSparkFirmwareRoot, timeouts = {}} = {}) {
        this.device = device;
        this.getRoot = getRoot;
        this.busy = false;
        this.timeouts = {bootDelay: 5000, boot: 25000, application: 45000, poll: 250, ...timeouts};
        this.state = {active: false,
            phase: 'idle',
            bytes: 0,
            total: release.files.reduce((total, file) => total + file.bytes, 0),
            error: null,
            result: null};
    }
    update (patch, immediate = false) {
        this.state = {...this.state, ...patch};
        if (this.device) {
            this.device.firmwareState = {...this.state};
            this.device.publish(immediate);
        }
    }
    async inspect (device = this.device ? this.device.getState() : {}) {
        if (!this.inspection) {
            this.inspection = this.checkResources().finally(() => {
                this.inspection = null;
            });
        }
        const report = await this.inspection;
        const blockers = sparkFirmwareBlockers(device, report);
        return {...report, canUpdate: blockers.length === 0, blockers};
    }
    async loadResources (retainData = false) {
        const root = this.getRoot();
        const files = [];
        for (const file of release.files) files.push(await checkFile(root, file, retainData));
        const report = {releaseId: release.id,
            hardwareId: release.hardwareId,
            version: release.version,
            source: release.source,
            totalBytes: release.files.reduce((total, file) => total + file.bytes, 0),
            valid: files.every(file => file.valid),
            files: files.map(file => ({path: file.path,
                bytes: file.bytes,
                sha256: file.sha256,
                valid: file.valid,
                error: file.error}))};
        return {report, files};
    }
    async checkResources () {
        return (await this.loadResources()).report;
    }
    start (request = {}) {
        if (!request || request.confirmedErase !== true) throw new SparkError('SPARK_FW_ERASE_CONFIRM');
        if (request.releaseId !== release.id || typeof request.recovery !== 'boolean') {
            throw new SparkError('SPARK_FW_RESOURCE_INVALID');
        }
        if (!this.device) throw new SparkError('SPARK_DISCONNECTED');
        if (this.busy) throw new SparkError('SPARK_BUSY');
        this.device.reserveFirmwareUpdate();
        this.busy = true;
        this.update({active: true,
            phase: 'checking',
            bytes: 0,
            file: null,
            transferComplete: false,
            recoveryRequired: false,
            error: null,
            result: null}, true);
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
            const {report, files} = await this.loadResources(true);
            const deviceState = {...this.device.getState(), busy: false};
            const blockers = sparkFirmwareBlockers(deviceState, report, request);
            if (blockers.length) throw new SparkError(blockers[0]);
            const ports = await firmwareBounded(this.device.listPorts(), 3000, 'SPARK_FW_BOOT_TIMEOUT');
            const port = ports.find(item => item.path === (request.recovery ? request.path : deviceState.port));
            if (!port || !isSparkUsbCandidate(port) || !sparkPortIdentity(port)) {
                throw new SparkError('SPARK_FW_SELECT_PORT');
            }
            const identity = sparkPortIdentity(port);
            if (!request.recovery) {
                if (identity !== sparkPortIdentity(this.device.lastDevice)) {
                    throw new SparkError('SPARK_FW_DEVICE_CHANGED');
                }
                this.update({phase: 'resetting'}, true);
                const transport = this.device.takeFirmwareTransport();
                link = new SparkFirmwareLink(transport, this.timeouts);
                link.portPath = port.path;
                await link.open({alreadyOpen: true});
                // No ACK is defined for 6F. A USB close while writing can be the requested reset.
                touched = true;
                await firmwareBounded(transport.write(sparkFrame(0x6F,
                    Buffer.from('RESET_FWLIB', 'ascii'))), 5000, 'SPARK_WRITE_TIMEOUT').catch(error => {
                    this.device.addLog(error.message);
                });
            }
            this.update({phase: 'waitingBoot'}, true);
            if (!request.recovery) {
                await firmwareDelay(this.timeouts.bootDelay);
                if (link.failure) {
                    await link.close(); link = null;
                } else link.prepareBootTransfer();
            }
            if (!link) {
                await this.device.closeTransport();
                this.device.monitor = null;
                link = await this.openMatching(identity, Date.now() + this.timeouts.boot);
            }
            if (link.monitor) throw new SparkError('SPARK_FW_BOOT_REQUIRED');
            this.update({phase: 'transferring'}, true);
            // The Bootloader starts burning after ~1 s idle. Preload all files and
            // write the OK marker last; there are no disk reads or user pauses in this loop.
            const ordered = [...files.filter(file => file.path !== 'app/updata.txt'),
                files.find(file => file.path === 'app/updata.txt')];
            let bytes = 0;
            for (const file of ordered) {
                this.update({file: file.path});
                touched = true;
                await link.send(file.path.startsWith('version/') ? 0xDD : 0xDA,
                    Buffer.from(path.posix.basename(file.path), 'ascii'));
                for (let offset = 0; offset < file.data.length; offset += 248) {
                    const chunk = file.data.subarray(offset, offset + 248);
                    await link.send(offset + chunk.length === file.data.length ? 0xBB : 0xAA, chunk);
                    bytes += chunk.length;
                    this.update({bytes});
                }
            }
            link.monitor = null;
            this.update({phase: 'restarting', transferComplete: true, file: null}, true);
            const deadline = Date.now() + this.timeouts.application;
            let monitor;
            let applicationPort;
            let wrongVersion = false;
            const applicationReady = sample => {
                if (sample.version !== release.version) {
                    wrongVersion = true; return false;
                }
                return true;
            };
            while (Date.now() < deadline) {
                try {
                    monitor = await link.waitForMonitor(Math.min(500, Math.max(1, deadline - Date.now())),
                        applicationReady);
                } catch (error) {
                    if (error.code !== 'SPARK_MONITOR_TIMEOUT') {
                        await link.close(); link = null;
                        link = await this.openMatching(identity, deadline, 'SPARK_FW_RECONNECT_TIMEOUT');
                    }
                }
                if (monitor) {
                    if (monitor.version !== release.version) throw new SparkError('SPARK_FW_VERSION_MISMATCH');
                    applicationPort = link.portPath;
                    break;
                }
            }
            if (!monitor) {
                throw new SparkError(wrongVersion ? 'SPARK_FW_VERSION_MISMATCH' : 'SPARK_FW_RECONNECT_TIMEOUT');
            }
            this.update({phase: 'reconnecting'}, true);
            await link.close(); link = null;
            await this.device.openConnection(applicationPort);
            if (!this.device.monitor || this.device.monitor.version !== release.version) {
                throw new SparkError('SPARK_FW_VERSION_MISMATCH');
            }
            const result = {transferComplete: true,
                reconnected: true,
                versionMatched: true,
                version: this.device.monitor.version,
                imageVerified: false,
                releaseId: release.id};
            this.update({active: false, phase: 'complete', result, recoveryRequired: false}, true);
            this.device.releaseFirmwareUpdate();
            return result;
        } catch (error) {
            if (link) await link.close();
            if (touched) await this.device.closeTransport();
            this.update({active: false,
                phase: 'error',
                error: error.code || 'SPARK_SERIAL_ERROR',
                recoveryRequired: touched || previousRecovery}, true);
            this.device.releaseFirmwareUpdate({recoveryRequired: touched || previousRecovery});
            throw error;
        }
    }
    async openMatching (identity, deadline, timeoutCode = 'SPARK_FW_BOOT_TIMEOUT') {
        while (Date.now() < deadline) {
            let ports;
            try {
                ports = (await firmwareBounded(this.device.listPorts(),
                    Math.min(3000, Math.max(1, deadline - Date.now())), timeoutCode))
                    .filter(port => isSparkUsbCandidate(port) && sparkPortIdentity(port) === identity);
            } catch (error) {
                await firmwareDelay(this.timeouts.poll); continue;
            }
            if (ports.length > 1) throw new SparkError('SPARK_FW_DEVICE_CHANGED');
            if (ports.length === 1) {
                const link = new SparkFirmwareLink(this.device.createTransport(ports[0].path), this.timeouts);
                link.portPath = ports[0].path;
                try {
                    await link.open(); return link;
                } catch (error) {
                    await link.close();
                }
            }
            await firmwareDelay(this.timeouts.poll);
        }
        throw new SparkError(timeoutCode);
    }
}
