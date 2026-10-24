import {DEFAULT_HARDWARE_ID, getHardwareProfile} from '../../common/hardware-profiles';

export class HardwareSession {
    constructor ({service, stopSources, isFirmwareBusy, adapters = {}, preferences}) {
        this.service = service;
        this.adapters = {'est-hid': service, ...adapters};
        this.stopSources = stopSources;
        this.isFirmwareBusy = isFirmwareBusy;
        this.preferences = preferences;
        this.hardwareId = preferences ? preferences.read() : DEFAULT_HARDWARE_ID;
        this.switching = false;
        this.operations = 0;
        this.revision = 0;
        this.backgroundRequests = new Set();
    }

    get activeService () {
        return this.adapters[getHardwareProfile(this.hardwareId).adapter] || null;
    }

    getState () {
        return {hardwareId: this.hardwareId,
            revision: this.revision,
            busy: this.switching ||
            this.operations > 0 || this.isFirmwareBusy(),
            running: Boolean(this.activeService && this.activeService.pythonProgramActive)};
    }

    requireAdapter (adapter = 'est-hid') {
        if (this.switching) throw new Error('HARDWARE_BUSY');
        if (getHardwareProfile(this.hardwareId).adapter !== adapter) throw new Error('HARDWARE_NOT_READY');
    }

    async operation (action, adapter = 'est-hid') {
        this.requireAdapter(adapter);
        this.operations++;
        try {
            return await action();
        } finally {
            this.operations--;
        }
    }

    background (action, adapter = 'est-hid') {
        this.requireAdapter(adapter);
        const request = Promise.resolve().then(action);
        this.backgroundRequests.add(request);
        return request.finally(() => this.backgroundRequests.delete(request));
    }

    async select ({hardwareId, confirmStop = false} = {}) {
        getHardwareProfile(hardwareId);
        if (this.switching) throw new Error('HARDWARE_BUSY');
        if (hardwareId === this.hardwareId) {
            if (this.activeService && this.activeService.setDiscoveryActive) {
                this.activeService.setDiscoveryActive(true);
            }
            return this.getState();
        }
        const active = this.activeService;
        if (this.operations || this.isFirmwareBusy() || (active && active.busy)) throw new Error('HARDWARE_BUSY');
        this.switching = true;
        if (active && active.setDiscoveryActive) active.setDiscoveryActive(false);
        this.service.suspendVision();
        try {
            // Let an already started enumeration/status request finish, then
            // disconnect. New IPC calls are refused while switching is true.
            await Promise.allSettled([...this.backgroundRequests]);
            if (active && active.autoConnectPromise) await active.autoConnectPromise;
            if (active) await active.commandQueue;
            if (active && active.pythonProgramActive && !confirmStop) throw new Error('HARDWARE_RUNNING');
            if (active && active.pythonProgramActive) await active.stopCurrentProgram();
            this.stopSources();
            if (active) await active.disconnect({pauseAuto: false});
            if (this.preferences) this.preferences.write(hardwareId);
            this.hardwareId = hardwareId;
            this.revision++;
            return {...this.getState(), busy: false};
        } finally {
            this.switching = false;
            this.service.resumeVision();
            if (this.activeService && this.activeService.setDiscoveryActive) {
                this.activeService.setDiscoveryActive(true);
            }
        }
    }
}
