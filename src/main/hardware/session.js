import {DEFAULT_HARDWARE_ID, getHardwareProfile} from '../../common/hardware-profiles';

export class HardwareSession {
    constructor ({service, stopSources, isFirmwareBusy}) {
        this.service = service;
        this.stopSources = stopSources;
        this.isFirmwareBusy = isFirmwareBusy;
        this.hardwareId = DEFAULT_HARDWARE_ID;
        this.switching = false;
        this.operations = 0;
        this.revision = 0;
        this.backgroundRequests = new Set();
    }

    getState () {
        return {hardwareId: this.hardwareId,
            revision: this.revision,
            busy: this.switching ||
            this.operations > 0 || this.isFirmwareBusy(),
            running: this.service.pythonProgramActive};
    }

    requireAdapter () {
        if (this.switching) throw new Error('HARDWARE_BUSY');
        if (getHardwareProfile(this.hardwareId).adapter !== 'est-hid') throw new Error('HARDWARE_NOT_READY');
    }

    async operation (action) {
        this.requireAdapter();
        this.operations++;
        try {
            return await action();
        } finally {
            this.operations--;
        }
    }

    background (action) {
        this.requireAdapter();
        const request = Promise.resolve().then(action);
        this.backgroundRequests.add(request);
        return request.finally(() => this.backgroundRequests.delete(request));
    }

    async select ({hardwareId, confirmStop = false} = {}) {
        getHardwareProfile(hardwareId);
        if (this.switching) throw new Error('HARDWARE_BUSY');
        if (hardwareId === this.hardwareId) return this.getState();
        if (this.operations || this.isFirmwareBusy()) throw new Error('HARDWARE_BUSY');
        this.switching = true;
        this.service.suspendVision();
        try {
            // Let an already started enumeration/status request finish, then
            // disconnect. New IPC calls are refused while switching is true.
            await Promise.allSettled([...this.backgroundRequests]);
            if (this.service.autoConnectPromise) await this.service.autoConnectPromise;
            await this.service.commandQueue;
            if (this.service.pythonProgramActive && !confirmStop) throw new Error('HARDWARE_RUNNING');
            if (this.service.pythonProgramActive) await this.service.stopCurrentProgram();
            this.stopSources();
            await this.service.disconnect();
            this.hardwareId = hardwareId;
            this.revision++;
            return {...this.getState(), busy: false};
        } finally {
            this.switching = false;
            this.service.resumeVision();
        }
    }
}
