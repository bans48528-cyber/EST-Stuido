import {
    COMMAND_DEVICE_STATUS,
    HID_READ_TIMEOUT_MS,
    LEGACY_REPORT_SIZE
} from './constants';
import {
    buildFrame,
    checkDeviceCompatibility,
    defaultReportDataSize,
    isEstDevice,
    parseDeviceStatusResponse,
    parseFrame,
    parseHeartbeatResponse,
    splitReports
} from './protocol';

export class EstDeviceService {
    constructor ({transportFactory, requestTimeoutMs = 2000} = {}) {
        this.transportFactory = transportFactory;
        this.requestTimeoutMs = requestTimeoutMs;
        this.transport = null;
        this.device = null;
        this.commandQueue = Promise.resolve();
        this.autoConnectPromise = null;
        this.shuttingDown = false;
    }

    async listDevices () {
        if (!this.transportFactory || typeof this.transportFactory.listDevices !== 'function') {
            return [];
        }
        const devices = await this.transportFactory.listDevices();
        return devices.filter(isEstDevice);
    }

    connect (device) {
        if (!isEstDevice(device)) {
            return Promise.reject(new Error('The selected device is not an EST USB device'));
        }
        return this._enqueueCommand(async () => {
            await this._disconnectNow();
            if (!this.transportFactory || typeof this.transportFactory.open !== 'function') {
                throw new Error('EST HID transport is not installed yet');
            }
            this.transport = await this.transportFactory.open(device);
            this.device = device;
            try {
                const firmwareVersion = await this._requestNow(0x01);
                return {device: this.device, firmwareVersion};
            } catch (error) {
                await this._disconnectNow();
                throw error;
            }
        });
    }

    disconnect () {
        return this._enqueueCommand(() => this._disconnectNow());
    }

    async _disconnectNow () {
        if (this.transport && typeof this.transport.close === 'function') {
            await this.transport.close();
        }
        this.transport = null;
        this.device = null;
    }

    getStatus () {
        return this._enqueueCommand(async () => {
            const response = await this._requestNow(COMMAND_DEVICE_STATUS);
            const status = parseDeviceStatusResponse(response);
            if (!status) {
                throw new Error('EST returned an invalid device status snapshot');
            }
            return {
                ...status,
                compatibility: checkDeviceCompatibility(status)
            };
        });
    }

    async autoConnect () {
        if (this.shuttingDown) {
            return {state: 'shutting-down'};
        }
        if (this.autoConnectPromise) {
            return this.autoConnectPromise;
        }
        this.autoConnectPromise = this._autoConnect();
        try {
            return await this.autoConnectPromise;
        } finally {
            this.autoConnectPromise = null;
        }
    }

    async _autoConnect () {
        try {
            const devices = await this.listDevices();
            if (devices.length === 0) {
                await this.disconnect();
                return {state: 'not-found'};
            }
            if (devices.length > 1) {
                await this.disconnect();
                return {state: 'multiple', count: devices.length};
            }

            const device = devices[0];
            if (!this.device || this.device.path !== device.path) {
                await this.connect(device);
            }
            const status = await this.getStatus();
            return {
                state: 'connected',
                device,
                firmwareVersion: status ? status.firmwareVersion : null,
                compatible: status.compatibility.compatible,
                status
            };
        } catch (error) {
            await this.disconnect();
            return {state: 'error', message: error.message};
        }
    }

    async shutdown () {
        this.shuttingDown = true;
        if (this.autoConnectPromise) {
            await this.autoConnectPromise;
        }
        await this.disconnect();
    }

    request (command, payload = new Uint8Array()) {
        const queuedPayload = Uint8Array.from(payload);
        return this._enqueueCommand(() => this._requestNow(command, queuedPayload));
    }

    _enqueueCommand (operation) {
        const queuedOperation = this.commandQueue.then(operation);
        this.commandQueue = queuedOperation.catch(() => null);
        return queuedOperation;
    }

    async _requestNow (command, payload = new Uint8Array()) {
        if (!this.transport) {
            throw new Error('No EST device is connected');
        }
        const reportDataSize = defaultReportDataSize(this.device) || LEGACY_REPORT_SIZE;
        const frame = buildFrame(command, payload);
        for (const report of splitReports(frame, reportDataSize)) {
            await this.transport.write(report);
        }

        const deadline = Date.now() + this.requestTimeoutMs;
        while (Date.now() < deadline) {
            const report = await this.transport.read(Math.min(HID_READ_TIMEOUT_MS, deadline - Date.now()));
            const parsed = parseFrame(report, command);
            if (parsed) {
                if (command === 0x01) {
                    return parseHeartbeatResponse(report);
                }
                if (command === COMMAND_DEVICE_STATUS) {
                    return report;
                }
                return parsed.payload;
            }
        }
        throw new Error(`Timed out waiting for EST command 0x${command.toString(16)}`);
    }
}
