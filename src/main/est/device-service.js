import {
    CAPABILITY_PERSISTENT_PROGRAM,
    CAPABILITY_PYTHON_PROGRAM,
    COMMAND_PERSISTENT_PROGRAM,
    COMMAND_PYTHON_PROGRAM,
    COMMAND_DEVICE_STATUS,
    FRAGMENT_WRITE_DELAY_MS,
    HID_READ_TIMEOUT_MS,
    LEGACY_REPORT_SIZE,
    PERSISTENT_PROGRAM_REQUEST_TIMEOUT_MS,
    PROGRAM_REQUEST_TIMEOUT_MS,
    PROGRAM_STATUS_POLL_INTERVAL_MS,
    PYTHON_PROGRAM_CHUNK_SIZE,
    PYTHON_PROGRAM_FLAG_TIMEOUT_ARMED,
    PYTHON_PROGRAM_MAX_SIZE,
    PYTHON_PROGRAM_MAX_TIMEOUT_MS,
    PYTHON_PROGRAM_STATE_COMPLETED,
    PYTHON_PROGRAM_STATE_EXCEPTION,
    PYTHON_PROGRAM_STATE_INVALID,
    PYTHON_PROGRAM_STATE_QUEUED,
    PYTHON_PROGRAM_STATE_READY,
    PYTHON_PROGRAM_STATE_RUNNING,
    PYTHON_PROGRAM_STATE_STOPPED,
    PYTHON_PROGRAM_STATE_TIMED_OUT
} from './constants';
import {
    buildPersistentProgramLoadFrame,
    buildPersistentProgramSaveFrame,
    buildPythonProgramBeginFrame,
    buildPythonProgramChunkFrame,
    buildPythonProgramRunFrame,
    buildPythonProgramStatusFrame,
    buildPythonProgramStopFrame,
    buildFrame,
    checkDeviceCompatibility,
    crc32,
    defaultReportDataSize,
    isEstDevice,
    parseDeviceStatusResponse,
    parseFrame,
    parseHeartbeatResponse,
    parsePersistentProgramResponse,
    parsePythonProgramResponse,
    splitReports
} from './protocol';

const REQUIRED_PROGRAM_CAPABILITIES = CAPABILITY_PYTHON_PROGRAM | CAPABILITY_PERSISTENT_PROGRAM;

export class EstDeviceService {
    constructor ({
        transportFactory,
        requestTimeoutMs = PROGRAM_REQUEST_TIMEOUT_MS,
        fragmentWriteDelayMs = FRAGMENT_WRITE_DELAY_MS,
        programStatusPollIntervalMs = PROGRAM_STATUS_POLL_INTERVAL_MS
    } = {}) {
        this.transportFactory = transportFactory;
        this.requestTimeoutMs = requestTimeoutMs;
        this.fragmentWriteDelayMs = fragmentWriteDelayMs;
        this.programStatusPollIntervalMs = programStatusPollIntervalMs;
        this.transport = null;
        this.device = null;
        this.commandQueue = Promise.resolve();
        this.autoConnectPromise = null;
        this.lastDeviceStatus = null;
        this.pythonProgramActive = false;
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
        this.lastDeviceStatus = null;
        this.pythonProgramActive = false;
    }

    getStatus () {
        return this._enqueueCommand(() => this._getStatusNow());
    }

    async _getStatusNow () {
        try {
            const response = await this._requestNow(COMMAND_DEVICE_STATUS);
            const status = parseDeviceStatusResponse(response);
            if (!status) {
                throw new Error('EST returned an invalid device status snapshot');
            }
            this.lastDeviceStatus = {
                ...status,
                compatibility: checkDeviceCompatibility(status, REQUIRED_PROGRAM_CAPABILITIES)
            };
            if (this.pythonProgramActive) {
                try {
                    const programStatus = await this._pythonProgramActionNow(buildPythonProgramStatusFrame());
                    this._updatePythonProgramActivity(programStatus);
                    return {...this.lastDeviceStatus, programStatus};
                } catch (programStatusError) {
                    // Keep the active marker until STOP or a later status check confirms a terminal state.
                }
            }
            return this.lastDeviceStatus;
        } catch (error) {
            if (!this.pythonProgramActive || !this.transport) {
                throw error;
            }
            let programStatus = null;
            try {
                programStatus = await this._pythonProgramActionNow(buildPythonProgramStatusFrame());
                this._updatePythonProgramActivity(programStatus);
            } catch (programStatusError) {
                // Preserve the existing HID transport so the stop command can still use it.
            }
            if (!this.lastDeviceStatus) {
                throw error;
            }
            return {
                ...this.lastDeviceStatus,
                programStatus,
                statusPollingDeferred: true,
                statusPollingError: error.message
            };
        }
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
                if (this.pythonProgramActive && this.transport) {
                    return this._programConnectionFallback('EST device enumeration is unavailable while program runs');
                }
                await this.disconnect();
                return {state: 'not-found'};
            }
            if (devices.length > 1) {
                if (this.pythonProgramActive && this.transport) {
                    return this._programConnectionFallback('Multiple EST devices reported while program runs');
                }
                await this.disconnect();
                return {state: 'multiple', count: devices.length};
            }

            const device = devices[0];
            if (!this.device || this.device.path !== device.path) {
                if (this.pythonProgramActive && this.transport) {
                    return this._programConnectionFallback('EST device path changed while program runs');
                }
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
            if (this.pythonProgramActive && this.transport) {
                return this._programConnectionFallback(error.message);
            }
            await this.disconnect();
            return {state: 'error', message: error.message};
        }
    }

    _programConnectionFallback (message) {
        return {
            state: 'connected',
            device: this.device,
            firmwareVersion: this.lastDeviceStatus ? this.lastDeviceStatus.firmwareVersion : null,
            compatible: this.lastDeviceStatus ? this.lastDeviceStatus.compatibility.compatible : null,
            status: this.lastDeviceStatus,
            statusPollingDeferred: true,
            message
        };
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

    uploadPython (source) {
        return this._enqueueCommand(() => this._uploadPythonNow(source));
    }

    saveProgramToSlot (source, slot, programName = `Program ${slot}`) {
        return this._enqueueCommand(() => this._saveProgramToSlotNow(source, slot, programName));
    }

    downloadProgram ({source, slot, programName = `Program ${slot}`} = {}) {
        return this._enqueueCommand(() => this._saveProgramToSlotNow(source, slot, programName));
    }

    loadAndRunProgram (slot, timeoutMs = PYTHON_PROGRAM_MAX_TIMEOUT_MS) {
        return this._enqueueCommand(() => this._loadAndRunProgramNow(slot, timeoutMs));
    }

    runProgram ({
        source,
        slot,
        programName = `Program ${slot}`,
        timeoutMs = PYTHON_PROGRAM_MAX_TIMEOUT_MS
    } = {}) {
        return this._enqueueCommand(async () => {
            const download = await this._saveProgramToSlotNow(source, slot, programName);
            const run = await this._loadAndRunProgramNow(slot, timeoutMs);
            return {...download, run};
        });
    }

    stopCurrentProgram () {
        return this._enqueueCommand(() => this._stopCurrentProgramNow());
    }

    _enqueueCommand (operation) {
        const queuedOperation = this.commandQueue.then(operation);
        this.commandQueue = queuedOperation.catch(() => null);
        return queuedOperation;
    }

    _normalizePythonSource (source) {
        let sourceBytes;
        if (typeof source === 'string') {
            sourceBytes = Uint8Array.from(Buffer.from(source, 'utf8'));
        } else if (source instanceof Uint8Array || Buffer.isBuffer(source)) {
            sourceBytes = Uint8Array.from(source);
        } else {
            throw new TypeError('Python program source must be a string or byte array');
        }
        if (sourceBytes.length < 1) {
            throw new RangeError('Python program must not be empty');
        }
        if (sourceBytes.length > PYTHON_PROGRAM_MAX_SIZE) {
            throw new RangeError(`Python program must be at most ${PYTHON_PROGRAM_MAX_SIZE} UTF-8 bytes`);
        }
        if (sourceBytes.includes(0)) {
            throw new RangeError('Python program must not contain NUL bytes');
        }
        return sourceBytes;
    }

    async _uploadPythonNow (source) {
        const sourceBytes = this._normalizePythonSource(source);
        await this._stopCurrentProgramNow();
        const sourceCrc32 = crc32(sourceBytes);
        let status = await this._pythonProgramActionNow(
            buildPythonProgramBeginFrame(sourceBytes.length, sourceCrc32)
        );
        this._requirePythonProgramSuccess(status, 'begin upload');
        for (let offset = 0; offset < sourceBytes.length; offset += PYTHON_PROGRAM_CHUNK_SIZE) {
            const chunk = sourceBytes.slice(offset, offset + PYTHON_PROGRAM_CHUNK_SIZE);
            status = await this._pythonProgramActionNow(buildPythonProgramChunkFrame(offset, chunk));
            this._requirePythonProgramSuccess(status, 'upload chunk');
        }
        if (status.state !== PYTHON_PROGRAM_STATE_READY || status.receivedLength !== sourceBytes.length) {
            throw new Error('EST did not mark the uploaded Python program as ready');
        }
        if (status.actualCrc32 !== sourceCrc32) {
            throw new Error('EST returned a different CRC32 for the uploaded Python program');
        }
        return {
            sourceBytes: sourceBytes.length,
            sourceCrc32,
            status
        };
    }

    async _saveProgramToSlotNow (source, slot, programName) {
        const saveFrame = buildPersistentProgramSaveFrame(slot, programName);
        const upload = await this._uploadPythonNow(source);
        const savedStatus = await this._persistentProgramActionNow(saveFrame);
        this._requirePersistentProgramSuccess(savedStatus, 'save program');
        return {
            slot,
            programName,
            upload,
            savedStatus
        };
    }

    async _loadAndRunProgramNow (slot, timeoutMs) {
        const loadFrame = buildPersistentProgramLoadFrame(slot);
        const runFrame = buildPythonProgramRunFrame(timeoutMs);
        const loadedStatus = await this._persistentProgramActionNow(loadFrame);
        this._requirePersistentProgramSuccess(loadedStatus, 'load program');
        const runStatus = await this._pythonProgramActionNow(runFrame);
        this._requirePythonProgramSuccess(runStatus, 'start program');
        this._updatePythonProgramActivity(runStatus);
        return {
            slot,
            loadedStatus,
            runStatus
        };
    }

    async _stopCurrentProgramNow () {
        let status = await this._pythonProgramActionNow(buildPythonProgramStatusFrame());
        this._requirePythonProgramSuccess(status, 'read program status');
        this._updatePythonProgramActivity(status);
        if (!this._pythonProgramActive(status)) {
            return status;
        }
        if (status.state === PYTHON_PROGRAM_STATE_QUEUED || status.state === PYTHON_PROGRAM_STATE_RUNNING) {
            status = await this._pythonProgramActionNow(buildPythonProgramStopFrame());
            this._requirePythonProgramSuccess(status, 'stop program');
        }
        const deadline = Date.now() + this.requestTimeoutMs;
        while (this._pythonProgramActive(status) && Date.now() < deadline) {
            await this._delay(this.programStatusPollIntervalMs);
            status = await this._pythonProgramActionNow(buildPythonProgramStatusFrame());
            this._requirePythonProgramSuccess(status, 'read stop status');
            this._updatePythonProgramActivity(status);
        }
        if (this._pythonProgramActive(status)) {
            throw new Error('EST Python program did not finish its stop cleanup');
        }
        this._updatePythonProgramActivity(status);
        return status;
    }

    _updatePythonProgramActivity (status) {
        this.pythonProgramActive = this._pythonProgramActive(status);
    }

    async _pythonProgramActionNow (frame) {
        const report = await this._requestFrameNow(
            frame,
            COMMAND_PYTHON_PROGRAM,
            this.requestTimeoutMs
        );
        const status = parsePythonProgramResponse(report);
        if (!status) {
            throw new Error('EST returned an invalid RAM Python program status');
        }
        return status;
    }

    async _persistentProgramActionNow (frame) {
        const report = await this._requestFrameNow(
            frame,
            COMMAND_PERSISTENT_PROGRAM,
            PERSISTENT_PROGRAM_REQUEST_TIMEOUT_MS
        );
        const status = parsePersistentProgramResponse(report);
        if (!status) {
            throw new Error('EST returned an invalid persistent program status');
        }
        return status;
    }

    _requirePythonProgramSuccess (status, operation) {
        if (status.result === 2) {
            throw new Error(`EST RAM Python program is busy: ${operation}`);
        }
        if (status.result !== 1) {
            throw new Error(`EST rejected RAM Python operation: ${operation}; error=${status.error}`);
        }
    }

    _requirePersistentProgramSuccess (status, operation) {
        if (status.result === 2) {
            throw new Error(`EST persistent program storage is busy: ${operation}`);
        }
        if (status.result !== 1) {
            throw new Error(`EST rejected persistent program operation: ${operation}; error=${status.lastError}`);
        }
    }

    _pythonProgramFinished (status) {
        if (status.state === PYTHON_PROGRAM_STATE_STOPPED) {
            return (status.flags & PYTHON_PROGRAM_FLAG_TIMEOUT_ARMED) === 0;
        }
        return [
            PYTHON_PROGRAM_STATE_COMPLETED,
            PYTHON_PROGRAM_STATE_EXCEPTION,
            PYTHON_PROGRAM_STATE_TIMED_OUT,
            PYTHON_PROGRAM_STATE_INVALID
        ].includes(status.state);
    }

    _pythonProgramActive (status) {
        return status.state === PYTHON_PROGRAM_STATE_QUEUED ||
            status.state === PYTHON_PROGRAM_STATE_RUNNING ||
            (status.state === PYTHON_PROGRAM_STATE_STOPPED &&
                (status.flags & PYTHON_PROGRAM_FLAG_TIMEOUT_ARMED) !== 0);
    }

    _delay (milliseconds) {
        if (milliseconds <= 0) {
            return Promise.resolve();
        }
        return new Promise(resolve => setTimeout(resolve, milliseconds));
    }

    async _requestNow (command, payload = new Uint8Array()) {
        const report = await this._requestFrameNow(buildFrame(command, payload), command, this.requestTimeoutMs);
        const parsed = parseFrame(report, command);
        if (command === 0x01) {
            return parseHeartbeatResponse(report);
        }
        if (command === COMMAND_DEVICE_STATUS) {
            return report;
        }
        return parsed.payload;
    }

    async _requestFrameNow (frame, command, timeoutMs) {
        if (!this.transport) {
            throw new Error('No EST device is connected');
        }
        const reportDataSize = defaultReportDataSize(this.device) || LEGACY_REPORT_SIZE;
        const reports = splitReports(frame, reportDataSize);
        for (let index = 0; index < reports.length; index++) {
            await this.transport.write(reports[index]);
            if (index < reports.length - 1) {
                await this._delay(this.fragmentWriteDelayMs);
            }
        }

        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            const remainingMs = Math.max(1, deadline - Date.now());
            const report = await this.transport.read(Math.min(HID_READ_TIMEOUT_MS, remainingMs));
            const parsed = parseFrame(report, command);
            if (parsed) {
                return report;
            }
        }
        throw new Error(`Timed out waiting for EST command 0x${command.toString(16)}`);
    }
}
