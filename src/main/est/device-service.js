import {
    CAPABILITY_MOTOR_TYPE,
    CAPABILITY_LARGE_PYTHON_PROGRAM,
    CAPABILITY_VISION_INPUT,
    CAPABILITY_VISION_INPUT_MULTI,
    COMMAND_PERSISTENT_PROGRAM,
    COMMAND_PYTHON_PROGRAM,
    COMMAND_DEVICE_STATUS,
    COMMAND_MOTOR_TYPE,
    COMMAND_VISION_SENSOR,
    EST_PROTOCOL_MAJOR,
    EST_VISION_MULTI_PROTOCOL_MINOR,
    EST_VISION_PROTOCOL_MINOR,
    FRAGMENT_WRITE_DELAY_MS,
    HID_READ_TIMEOUT_MS,
    LEGACY_REPORT_SIZE,
    PERSISTENT_PROGRAM_REQUEST_TIMEOUT_MS,
    PROGRAM_REQUEST_TIMEOUT_MS,
    PROGRAM_STATUS_REQUEST_TIMEOUT_MS,
    PROGRAM_STATUS_POLL_INTERVAL_MS,
    PYTHON_PROGRAM_CHUNK_SIZE,
    PYTHON_PROGRAM_FLAG_TIMEOUT_ARMED,
    PYTHON_PROGRAM_LEGACY_MAX_SIZE,
    PYTHON_PROGRAM_PROTOCOL_MAX_SIZE,
    PYTHON_PROGRAM_NO_TIMEOUT_MS,
    PYTHON_PROGRAM_STATE_COMPLETED,
    PYTHON_PROGRAM_STATE_EXCEPTION,
    PYTHON_PROGRAM_STATE_INVALID,
    PYTHON_PROGRAM_STATE_QUEUED,
    PYTHON_PROGRAM_STATE_READY,
    PYTHON_PROGRAM_STATE_RUNNING,
    PYTHON_PROGRAM_STATE_STOPPED,
    PYTHON_PROGRAM_STATE_TIMED_OUT,
    VISION_SENSOR_CLEAR_REASON_DISCONNECT,
    VISION_SENSOR_CLEAR_REASON_INITIALIZE,
    VISION_SENSOR_CLEAR_REASON_NO_TARGET,
    VISION_SENSOR_CLEAR_REASON_PROGRAM_STOPPED,
    VISION_SENSOR_CLEAR_REASON_PROGRAM_TRANSITION,
    VISION_SENSOR_DEFAULT_ID,
    VISION_SENSOR_DEFAULT_TTL_MS,
    VISION_SENSOR_REQUEST_TIMEOUT_MS,
    VISION_SENSOR_SEND_INTERVAL_MS,
    VISION_SENSOR_TARGET_MASK_ALL
} from './constants';
import {validateMicroPythonSourceSyntax} from './python-syntax-service';
import {
    buildMotorTypeFrame,
    buildPersistentProgramLoadFrame,
    buildPersistentProgramSaveFrame,
    buildPythonProgramBeginFrame,
    buildPythonProgramChunkFrame,
    buildPythonProgramRunFrame,
    buildPythonProgramStatusFrame,
    buildPythonProgramStopFrame,
    buildVisionSensorClearFrame,
    buildVisionSensorMultiClearFrame,
    buildVisionSensorMultiStatusFrame,
    buildVisionSensorMultiUpdateFrame,
    buildVisionSensorStatusFrame,
    buildVisionSensorUpdateFrame,
    buildFrame,
    capabilityNamesFor,
    checkProgramFirmwareCompatibility,
    crc32,
    defaultReportDataSize,
    isEstDevice,
    parseDeviceStatusResponse,
    parseFrame,
    parseHeartbeatResponse,
    parseMotorTypeResponse,
    parsePersistentProgramResponse,
    parsePythonProgramResponse,
    parseVisionSensorResponse,
    programMinimumFirmwareVersionForSource,
    programRequiredCapabilitiesForSource,
    programUnsupportedRuntimeFeaturesForSource,
    splitReports
} from './protocol';

const PROGRAM_FIRMWARE_UPGRADE_MESSAGE =
    '当前 EST 固件不支持这个程序使用的功能。请升级到支持相应 ATC CodeStudio 功能的固件后再运行。';
const EST_USB_DISCONNECTED_MESSAGE = 'EST USB 连接已断开，请重新连接 EST 后重试。';
const PROGRAM_UNSUPPORTED_RUNTIME_MESSAGE =
    '当前 EST 固件尚未实现这个程序使用的积木接口，已阻止下载。请删除或替换这些积木，等待后续固件开放对应能力。';
const PROGRAM_LARGE_SOURCE_MIN_FIRMWARE_VERSION = 'M1.26A';
const VISION_TARGET_BITS = Object.freeze({left: 1, right: 2, pose: 4, face: 8});

const normalizeVisionResult = sample => ({
    classId: sample.classId,
    confidencePermille: sample.confidencePermille,
    centerX: sample.centerX,
    centerY: sample.centerY,
    width: sample.width,
    height: sample.height
});

const normalizeVisionFrame = (frame = {}) => {
    const enabled = frame.enabled || {};
    const sourceTargets = frame.targets || {};
    let enabledMask = Number.isInteger(frame.enabledMask) ? frame.enabledMask : 0;
    let validMask = Number.isInteger(frame.validMask) ? frame.validMask : 0;
    const targets = {};
    for (const [target, [name, bit]] of Object.entries(VISION_TARGET_BITS).entries()) {
        if (!Number.isInteger(frame.enabledMask) && enabled[name]) enabledMask |= bit;
        const sample = sourceTargets[name] || sourceTargets[target];
        if (!Number.isInteger(frame.validMask) && sample) validMask |= bit;
        if (sample) targets[name] = normalizeVisionResult(sample);
    }
    const normalized = {
        ttlMs: typeof frame.ttlMs === 'undefined' ? VISION_SENSOR_DEFAULT_TTL_MS : frame.ttlMs,
        enabledMask,
        validMask,
        targets
    };
    buildVisionSensorMultiUpdateFrame({...normalized, sequence: 0});
    return normalized;
};

const isEstCommandTimeoutError = error =>
    Boolean(error && /^Timed out waiting for EST command /.test(String(error.message || error)));

const normalizeStatusOptions = options => ({
    includeProgramStatus: Boolean(options && options.includeProgramStatus),
    includePortInfo: Boolean(options && options.includePortInfo),
    reuseConnection: Boolean(options && options.reuseConnection)
});

const programFirmwareUpgradeError = compatibility => {
    const detail = compatibility && compatibility.programMessage ? ` ${compatibility.programMessage}` : '';
    return new Error(`${PROGRAM_FIRMWARE_UPGRADE_MESSAGE}${detail}`);
};

const programUnsupportedRuntimeError = features => {
    const names = features.map(feature => feature.label || feature.id).join('、');
    const ids = features.map(feature => feature.id).join(', ');
    return new Error(`${PROGRAM_UNSUPPORTED_RUNTIME_MESSAGE} 未支持: ${names} (${ids})`);
};

const isTransportDisconnectError = error => {
    const message = String(error && error.message ? error.message : error);
    return /cannot write to hid device|cannot read from hid device|hid device is disconnected|device not open/i
        .test(message);
};

export class EstDeviceService {
    constructor ({
        transportFactory,
        requestTimeoutMs = PROGRAM_REQUEST_TIMEOUT_MS,
        fragmentWriteDelayMs = FRAGMENT_WRITE_DELAY_MS,
        programStatusRequestTimeoutMs = PROGRAM_STATUS_REQUEST_TIMEOUT_MS,
        programStatusPollIntervalMs = PROGRAM_STATUS_POLL_INTERVAL_MS,
        visionRequestTimeoutMs = VISION_SENSOR_REQUEST_TIMEOUT_MS,
        visionSendIntervalMs = VISION_SENSOR_SEND_INTERVAL_MS,
        syntaxChecker = validateMicroPythonSourceSyntax
    } = {}) {
        this.transportFactory = transportFactory;
        this.requestTimeoutMs = requestTimeoutMs;
        this.fragmentWriteDelayMs = fragmentWriteDelayMs;
        this.programStatusRequestTimeoutMs = programStatusRequestTimeoutMs;
        this.programStatusPollIntervalMs = programStatusPollIntervalMs;
        this.visionRequestTimeoutMs = visionRequestTimeoutMs;
        this.visionSendIntervalMs = visionSendIntervalMs;
        this.syntaxChecker = syntaxChecker;
        this.transport = null;
        this.device = null;
        this.firmwareVersion = null;
        this.commandQueue = Promise.resolve();
        this.pendingCommands = 0;
        this.hardwareStatusPromise = null;
        this.autoConnectPromise = null;
        this.lastDeviceStatus = null;
        this.pythonProgramActive = false;
        this.shuttingDown = false;
        this.visionLatest = null;
        this.visionRevision = 0;
        this.visionLastSentRevision = 0;
        this.visionSequence = 0;
        this.visionDispatchQueued = false;
        this.visionInFlight = false;
        this.visionPauseDepth = 0;
        this.visionTimer = null;
        this.visionNextSendAt = 0;
        this.visionLastResponse = null;
        this.visionLastError = null;
        this.visionConnectionNeedsClear = false;
    }

    async listDevices () {
        if (!this.transportFactory || typeof this.transportFactory.listDevices !== 'function') {
            return [];
        }
        const devices = await this.transportFactory.listDevices();
        return devices.filter(isEstDevice);
    }

    getVisionPublisherState () {
        return {
            supported: this._visionSupported(),
            multiSupported: this._visionMultiSupported(),
            connected: Boolean(this.transport && this.device),
            programRunning: this.pythonProgramActive,
            paused: this.visionPauseDepth > 0,
            pending: Boolean(
                this.visionLatest && this.visionLatest.revision > this.visionLastSentRevision
            ),
            inFlight: this.visionInFlight,
            sequence: this.visionSequence,
            lastResponse: this.visionLastResponse,
            lastError: this.visionLastError
        };
    }

    updateVisionSample (sample = {}) {
        const normalized = {
            sensorId: typeof sample.sensorId === 'undefined' ? VISION_SENSOR_DEFAULT_ID : sample.sensorId,
            ttlMs: typeof sample.ttlMs === 'undefined' ? VISION_SENSOR_DEFAULT_TTL_MS : sample.ttlMs,
            classId: sample.classId,
            confidencePermille: sample.confidencePermille,
            centerX: sample.centerX,
            centerY: sample.centerY,
            width: sample.width,
            height: sample.height
        };
        buildVisionSensorUpdateFrame({...normalized, sequence: 0});
        this.visionRevision++;
        this.visionLatest = {
            kind: 'update',
            revision: this.visionRevision,
            storedAt: Date.now(),
            sample: normalized
        };
        this._scheduleVisionDispatch();
        return this.getVisionPublisherState();
    }

    updateVisionFrame (frame = {}) {
        const normalized = normalizeVisionFrame(frame);
        this.visionRevision++;
        this.visionLatest = {
            kind: 'multi-update',
            revision: this.visionRevision,
            storedAt: Date.now(),
            sample: normalized
        };
        this._scheduleVisionDispatch();
        return this.getVisionPublisherState();
    }

    clearVision (reason = VISION_SENSOR_CLEAR_REASON_NO_TARGET,
        targetMask = VISION_SENSOR_TARGET_MASK_ALL) {
        buildVisionSensorClearFrame({reason, sequence: 0});
        buildVisionSensorMultiClearFrame({reason, sequence: 0, targetMask});
        this.visionRevision++;
        this.visionLatest = {
            kind: 'clear',
            reason,
            targetMask,
            revision: this.visionRevision,
            storedAt: Date.now()
        };
        this._scheduleVisionDispatch();
        return this.getVisionPublisherState();
    }

    getVisionStatus () {
        return this._enqueueCommand(async () => {
            await this._requireVisionSupportNow();
            return this._visionActionNow(this._visionMultiSupported() ?
                buildVisionSensorMultiStatusFrame() : buildVisionSensorStatusFrame());
        });
    }

    suspendVision () {
        this.visionPauseDepth++;
        this._cancelVisionTimer();
        return this.getVisionPublisherState();
    }

    resumeVision () {
        if (this.visionPauseDepth > 0) {
            this.visionPauseDepth--;
        }
        this._scheduleVisionDispatch();
        return this.getVisionPublisherState();
    }

    _visionSupported () {
        const status = this.lastDeviceStatus;
        return Boolean(
            status &&
            status.protocolMajor === EST_PROTOCOL_MAJOR &&
            status.protocolMinor >= EST_VISION_PROTOCOL_MINOR &&
            (status.capabilities & CAPABILITY_VISION_INPUT) !== 0
        );
    }

    _visionMultiSupported () {
        const status = this.lastDeviceStatus;
        return Boolean(
            status &&
            status.protocolMajor === EST_PROTOCOL_MAJOR &&
            status.protocolMinor >= EST_VISION_MULTI_PROTOCOL_MINOR &&
            (status.capabilities & CAPABILITY_VISION_INPUT_MULTI) !== 0
        );
    }

    async _requireVisionSupportNow () {
        if (!this.lastDeviceStatus && !this.pythonProgramActive) {
            await this._getStatusNow();
        }
        if (!this._visionSupported()) {
            throw new Error(
                `EST firmware does not support vision input; protocol ${EST_PROTOCOL_MAJOR}.` +
                `${EST_VISION_PROTOCOL_MINOR} and capability vision-input are required`
            );
        }
    }

    async _clearVisionAfterConnectNow () {
        if (!this.visionConnectionNeedsClear) {
            return null;
        }
        if (!this._visionSupported()) {
            this.visionConnectionNeedsClear = false;
            return null;
        }
        const cleared = await this._tryClearVisionOnDeviceNow(
            VISION_SENSOR_CLEAR_REASON_INITIALIZE
        );
        if (cleared) {
            this.visionConnectionNeedsClear = false;
        }
        return cleared;
    }

    _cancelVisionTimer () {
        if (this.visionTimer) {
            clearTimeout(this.visionTimer);
            this.visionTimer = null;
        }
    }

    _scheduleVisionDispatch () {
        if (
            this.visionTimer ||
            this.visionDispatchQueued ||
            this.visionPauseDepth > 0 ||
            !this.pythonProgramActive ||
            !this.transport ||
            !this._visionSupported() ||
            !this.visionLatest ||
            this.visionLatest.revision <= this.visionLastSentRevision
        ) {
            return;
        }
        const delayMs = Math.max(0, this.visionNextSendAt - Date.now());
        this.visionTimer = setTimeout(() => {
            this.visionTimer = null;
            if (this.visionPauseDepth > 0 || !this.pythonProgramActive || !this.transport) {
                return;
            }
            this.visionDispatchQueued = true;
            this._enqueueCommand(() => this._dispatchLatestVisionNow())
                .catch(error => {
                    this.visionLastError = error.message;
                })
                .finally(() => {
                    this.visionDispatchQueued = false;
                    this._scheduleVisionDispatch();
                });
        }, delayMs);
    }

    _nextVisionSequence () {
        this.visionSequence = (this.visionSequence + 1) >>> 0;
        if (this.visionSequence === 0) {
            this.visionSequence = 1;
        }
        return this.visionSequence;
    }

    async _dispatchLatestVisionNow () {
        if (
            this.visionPauseDepth > 0 ||
            !this.pythonProgramActive ||
            !this.transport ||
            !this._visionSupported()
        ) {
            return null;
        }
        const latest = this.visionLatest;
        if (!latest || latest.revision <= this.visionLastSentRevision) {
            return null;
        }
        if ((latest.kind === 'update' || latest.kind === 'multi-update') &&
            Date.now() - latest.storedAt >= latest.sample.ttlMs) {
            this.visionLastSentRevision = latest.revision;
            return null;
        }
        const sequence = this._nextVisionSequence();
        let frame;
        if (latest.kind === 'multi-update') {
            if (!this._visionMultiSupported()) {
                throw new Error(
                    `EST firmware does not support multi-target vision; protocol ${EST_PROTOCOL_MAJOR}.` +
                    `${EST_VISION_MULTI_PROTOCOL_MINOR} and capability vision-input-multi are required`
                );
            }
            frame = buildVisionSensorMultiUpdateFrame({...latest.sample, sequence});
        } else if (latest.kind === 'update') {
            frame = buildVisionSensorUpdateFrame({...latest.sample, sequence});
        } else {
            frame = this._visionMultiSupported() ?
                buildVisionSensorMultiClearFrame({
                    reason: latest.reason,
                    sequence,
                    targetMask: latest.targetMask
                }) :
                buildVisionSensorClearFrame({reason: latest.reason, sequence});
        }
        try {
            const response = await this._visionActionNow(frame);
            if (response.sequence !== sequence) {
                throw new Error(
                    `EST vision response sequence ${response.sequence} does not match ${sequence}`
                );
            }
            this.visionLastResponse = response;
            this.visionLastError = null;
            return response;
        } finally {
            this.visionLastSentRevision = latest.revision;
            this.visionNextSendAt = Date.now() + this.visionSendIntervalMs;
        }
    }

    async _visionActionNow (frame) {
        this.visionInFlight = true;
        try {
            const report = await this._requestFrameNow(
                frame,
                COMMAND_VISION_SENSOR,
                this.visionRequestTimeoutMs
            );
            const response = parseVisionSensorResponse(report);
            if (!response) {
                throw new Error('EST returned an invalid vision sensor status');
            }
            if (response.result !== 1) {
                throw new Error(
                    `EST rejected vision sensor action ${response.acceptedAction}; error=${response.error}`
                );
            }
            return response;
        } finally {
            this.visionInFlight = false;
        }
    }

    async _clearVisionOnDeviceNow (reason) {
        if (!this.transport || !this._visionSupported()) {
            return null;
        }
        const sequence = this._nextVisionSequence();
        const response = await this._visionActionNow(this._visionMultiSupported() ?
            buildVisionSensorMultiClearFrame({reason, sequence}) :
            buildVisionSensorClearFrame({reason, sequence}));
        if (response.sequence !== sequence) {
            throw new Error(`EST vision CLEAR response sequence does not match ${sequence}`);
        }
        this.visionLastResponse = response;
        this.visionLastError = null;
        return response;
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
            this.visionSequence = 0;
            this.visionConnectionNeedsClear = true;
            try {
                const firmwareVersion = await this._requestNow(0x01);
                this.firmwareVersion = firmwareVersion;
                return {device: this.device, firmwareVersion};
            } catch (error) {
                await this._disconnectNow();
                throw error;
            }
        });
    }

    disconnect () {
        return this._withVisionSuspended(() => this._disconnectNow());
    }

    async _disconnectNow (clearVision = true) {
        const transport = this.transport;
        if (clearVision) {
            await this._tryClearVisionOnDeviceNow(VISION_SENSOR_CLEAR_REASON_DISCONNECT);
        }
        this.transport = null;
        this.device = null;
        this.firmwareVersion = null;
        this.lastDeviceStatus = null;
        this.pythonProgramActive = false;
        this.visionConnectionNeedsClear = false;
        this._cancelVisionTimer();
        this.visionLatest = null;
        this.visionLastSentRevision = this.visionRevision;
        if (transport && typeof transport.close === 'function') {
            try {
                await transport.close();
            } catch (error) {
                // The HID handle may already be gone after a USB unplug.
            }
        }
    }

    getStatus (options = {}) {
        const statusOptions = normalizeStatusOptions(options);
        return this._enqueueCommand(() => this._getStatusNow(statusOptions));
    }

    getHardwareStatus () {
        if (this.hardwareStatusPromise) return this.hardwareStatusPromise;
        if (this.shuttingDown || this.visionPauseDepth || this.pendingCommands) {
            return Promise.resolve({state: 'busy'});
        }
        if (!this.transport || !this.device) return Promise.resolve({state: 'not-found'});
        this.hardwareStatusPromise = this._enqueueCommand(async () => {
            const status = await this._getStatusNow({includeProgramStatus: true, hardwareMonitor: true});
            return {state: 'connected', status};
        }).finally(() => { this.hardwareStatusPromise = null; });
        return this.hardwareStatusPromise;
    }

    _decorateDeviceStatus (status) {
        return {
            ...status,
            capabilityNames: capabilityNamesFor(status.capabilities),
            compatibility: checkProgramFirmwareCompatibility(status)
        };
    }

    async _getStatusNow (options = {}) {
        const {includeProgramStatus, includePortInfo} = normalizeStatusOptions(options);
        const monitor = Boolean(options.hardwareMonitor);
        const livePorts = monitor && this.lastDeviceStatus && this.lastDeviceStatus.protocolMajor === 1 &&
            this.lastDeviceStatus.protocolMinor >= 31;
        if (this.pythonProgramActive && this.transport && !livePorts) {
            return this._getProgramStatusSnapshotNow();
        }
        try {
            const response = monitor ? (await this._requestFrameNow(
                buildFrame(COMMAND_DEVICE_STATUS), COMMAND_DEVICE_STATUS, 300
            )) : await this._requestNow(COMMAND_DEVICE_STATUS);
            const status = parseDeviceStatusResponse(response);
            if (!status) {
                throw new Error('EST returned an invalid device status snapshot');
            }
            this.lastDeviceStatus = this._decorateDeviceStatus(status);
            await this._clearVisionAfterConnectNow();
            if (includePortInfo && (status.capabilities & CAPABILITY_MOTOR_TYPE) !== 0) {
                try {
                    const motorTypeReport = await this._requestFrameNow(
                        buildMotorTypeFrame(),
                        COMMAND_MOTOR_TYPE,
                        this.requestTimeoutMs
                    );
                    const motorTypes = parseMotorTypeResponse(motorTypeReport);
                    if (motorTypes) {
                        this.lastDeviceStatus = {...this.lastDeviceStatus, motorTypes};
                    }
                } catch (error) {
                    // Port information is optional context and must not make the normal status request fail.
                }
            }
            this.firmwareVersion = status.firmwareVersion;
            if (this.pythonProgramActive || includeProgramStatus) {
                try {
                    const programStatus = await this._pythonProgramActionNow(
                        buildPythonProgramStatusFrame(),
                        monitor ? Math.min(300, this.programStatusRequestTimeoutMs) : this.programStatusRequestTimeoutMs
                    );
                    this._updatePythonProgramActivity(programStatus);
                    return {...this.lastDeviceStatus, programStatus};
                } catch (programStatusError) {
                    if (this.pythonProgramActive) {
                        // Keep the active marker until STOP or a later status check confirms a terminal state.
                    } else {
                        return {
                            ...this.lastDeviceStatus,
                            programStatus: null,
                            programStatusError: programStatusError.message
                        };
                    }
                }
            }
            return this.lastDeviceStatus;
        } catch (error) {
            if (!this.pythonProgramActive || !this.transport) {
                throw error;
            }
            return this._getProgramStatusSnapshotNow(error.message);
        }
    }

    async _getProgramStatusSnapshotNow (statusPollingError = null) {
        let programStatus = null;
        try {
            programStatus = await this._pythonProgramActionNow(
                buildPythonProgramStatusFrame(),
                this.programStatusRequestTimeoutMs
            );
            this._updatePythonProgramActivity(programStatus);
        } catch (programStatusError) {
            if (!this.transport) {
                throw programStatusError;
            }
            // Preserve the existing HID transport so the stop command can still use it.
            if (!this.lastDeviceStatus) {
                throw programStatusError;
            }
            return {
                ...this.lastDeviceStatus,
                programStatus,
                statusPollingDeferred: true,
                statusPollingError: programStatusError.message
            };
        }

        const snapshot = this.lastDeviceStatus || {
            compatibility: checkProgramFirmwareCompatibility({
                firmwareVersion: this.firmwareVersion
            }),
            firmwareVersion: this.firmwareVersion
        };
        const deferredStatus = {
            ...snapshot,
            programStatus,
            statusPollingDeferred: true
        };
        if (statusPollingError) {
            deferredStatus.statusPollingError = statusPollingError;
        }
        return deferredStatus;
    }

    async autoConnect (options = {}) {
        const statusOptions = normalizeStatusOptions(options);
        if (this.shuttingDown) {
            return {state: 'shutting-down'};
        }
        if (statusOptions.includeProgramStatus || statusOptions.includePortInfo) {
            return this._autoConnect(statusOptions);
        }
        if (this.autoConnectPromise) {
            return this.autoConnectPromise;
        }
        this.autoConnectPromise = this._autoConnect(statusOptions);
        try {
            return await this.autoConnectPromise;
        } finally {
            this.autoConnectPromise = null;
        }
    }

    async _autoConnect (options = {}) {
        try {
            if (options.reuseConnection && this.transport && this.device) {
                return await this._getActiveProgramConnectionNow(options);
            }
            if (this.pythonProgramActive && this.transport && this.device) {
                return await this._getActiveProgramConnectionNow(options);
            }
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
            const status = await this.getStatus(options);
            return {
                state: 'connected',
                device,
                firmwareVersion: status ? status.firmwareVersion : this.firmwareVersion,
                compatible: status.compatibility.compatible,
                status
            };
        } catch (error) {
            if (this.pythonProgramActive && this.transport) {
                return this._programConnectionFallback(error.message);
            }
            if (this.transport && this.device && this.firmwareVersion) {
                const compatibility = checkProgramFirmwareCompatibility({
                    firmwareVersion: this.firmwareVersion
                });
                if (this.firmwareVersion) {
                    return {
                        state: 'connected',
                        device: this.device,
                        firmwareVersion: this.firmwareVersion,
                        compatible: compatibility.compatible,
                        programCompatible: compatibility.programCompatible,
                        status: null,
                        message: error.message
                    };
                }
            }
            await this.disconnect();
            return {state: 'error', message: error.message};
        }
    }

    async _getActiveProgramConnectionNow (options = {}) {
        const status = await this.getStatus(options);
        return {
            state: 'connected',
            device: this.device,
            firmwareVersion: status ? status.firmwareVersion : this.firmwareVersion,
            compatible: status && status.compatibility ? status.compatibility.compatible : null,
            status
        };
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
        if (this.transportFactory && typeof this.transportFactory.dispose === 'function') {
            await this.transportFactory.dispose();
        }
    }

    request (command, payload = new Uint8Array()) {
        const queuedPayload = Uint8Array.from(payload);
        return this._enqueueCommand(() => this._requestNow(command, queuedPayload));
    }

    uploadPython (source) {
        return this._withVisionSuspended(() => this._uploadPythonNow(source));
    }

    saveProgramToSlot (source, slot, programName = `Program ${slot}`) {
        return this._withVisionSuspended(() => this._saveProgramToSlotNow(source, slot, programName));
    }

    downloadProgram ({source, slot, programName = `Program ${slot}`} = {}) {
        return this._withVisionSuspended(() => this._saveProgramToSlotNow(source, slot, programName));
    }

    loadAndRunProgram (slot, timeoutMs = PYTHON_PROGRAM_NO_TIMEOUT_MS) {
        return this._withVisionSuspended(() => this._loadAndRunProgramNow(slot, timeoutMs));
    }

    runProgram ({
        source,
        slot,
        programName = `Program ${slot}`,
        timeoutMs = PYTHON_PROGRAM_NO_TIMEOUT_MS
    } = {}) {
        return this._withVisionSuspended(async () => {
            const download = await this._saveProgramToSlotNow(source, slot, programName);
            // SAVE verifies the persistent copy and leaves the same source valid in RAM.
            // Run that copy directly instead of reading the slot back from flash.
            const run = {
                runStatus: await this._runReadyProgramNow(timeoutMs)
            };
            return {...download, run};
        });
    }

    stopCurrentProgram () {
        return this._withVisionSuspended(async () => {
            const status = await this._stopCurrentProgramNow();
            await this._tryClearVisionOnDeviceNow(VISION_SENSOR_CLEAR_REASON_PROGRAM_STOPPED);
            return status;
        });
    }

    _withVisionSuspended (operation) {
        this.suspendVision();
        const queuedOperation = this._enqueueCommand(operation);
        return queuedOperation.finally(() => this.resumeVision());
    }

    _enqueueCommand (operation) {
        this.pendingCommands++;
        const queuedOperation = this.commandQueue.then(operation).finally(() => { this.pendingCommands--; });
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
        if (sourceBytes.length > PYTHON_PROGRAM_PROTOCOL_MAX_SIZE) {
            throw new RangeError(
                `Python program exceeds the ${PYTHON_PROGRAM_PROTOCOL_MAX_SIZE}-byte protocol limit`
            );
        }
        if (sourceBytes.includes(0)) {
            throw new RangeError('Python program must not contain NUL bytes');
        }
        return sourceBytes;
    }

    async _uploadPythonNow (source) {
        const sourceBytes = this._normalizePythonSource(source);
        this.syntaxChecker(sourceBytes);
        const unsupportedRuntimeFeatures = programUnsupportedRuntimeFeaturesForSource(sourceBytes);
        if (unsupportedRuntimeFeatures.length > 0) {
            throw programUnsupportedRuntimeError(unsupportedRuntimeFeatures);
        }
        const requiredCapabilities = programRequiredCapabilitiesForSource(sourceBytes);
        const minimumFirmwareVersion = programMinimumFirmwareVersionForSource(sourceBytes);
        const deviceStatus = await this._requireProgramCompatibilityNow(
            requiredCapabilities,
            minimumFirmwareVersion
        );
        const reportedLimit = Number(deviceStatus && deviceStatus.maxProgramBytes);
        const deviceLimit = Number.isInteger(reportedLimit) && reportedLimit > 0 ?
            Math.min(reportedLimit, PYTHON_PROGRAM_PROTOCOL_MAX_SIZE) :
            PYTHON_PROGRAM_LEGACY_MAX_SIZE;
        if (sourceBytes.length > deviceLimit) {
            throw new RangeError(
                `程序大小 ${sourceBytes.length} 字节，超过设备上限 ${deviceLimit} 字节`
            );
        }
        if (sourceBytes.length > PYTHON_PROGRAM_LEGACY_MAX_SIZE) {
            await this._requireProgramCompatibilityNow(
                requiredCapabilities | CAPABILITY_LARGE_PYTHON_PROGRAM,
                PROGRAM_LARGE_SOURCE_MIN_FIRMWARE_VERSION
            );
        }
        await this._stopCurrentProgramNow();
        await this._tryClearVisionOnDeviceNow(VISION_SENSOR_CLEAR_REASON_PROGRAM_TRANSITION);
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

    async _requireProgramCompatibilityNow (additionalProgramCapabilities = 0, minimumFirmwareVersion = null) {
        const additionalCapabilities = Number(additionalProgramCapabilities) >>> 0;
        const requiredMinimumFirmwareVersion = minimumFirmwareVersion ? String(minimumFirmwareVersion) : null;
        let status = this.lastDeviceStatus;
        let compatibility = status && status.compatibility;
        if (status && (additionalCapabilities !== 0 || requiredMinimumFirmwareVersion)) {
            compatibility = checkProgramFirmwareCompatibility(
                status,
                additionalCapabilities,
                requiredMinimumFirmwareVersion
            );
        }
        if (!status || !compatibility || typeof compatibility.programCompatible !== 'boolean') {
            try {
                status = await this._getStatusNow();
                compatibility = status && status.compatibility;
                if (status && (additionalCapabilities !== 0 || requiredMinimumFirmwareVersion)) {
                    compatibility = checkProgramFirmwareCompatibility(
                        status,
                        additionalCapabilities,
                        requiredMinimumFirmwareVersion
                    );
                }
            } catch (error) {
                if (!this.transport) {
                    throw error;
                }
                throw programFirmwareUpgradeError(checkProgramFirmwareCompatibility({
                    firmwareVersion: this.firmwareVersion
                }, additionalCapabilities, requiredMinimumFirmwareVersion));
            }
        }
        if (!compatibility || !compatibility.programCompatible) {
            throw programFirmwareUpgradeError(compatibility);
        }
        return status;
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
        await this._requireProgramCompatibilityNow();
        const loadFrame = buildPersistentProgramLoadFrame(slot);
        const loadedStatus = await this._persistentProgramActionNow(loadFrame);
        this._requirePersistentProgramSuccess(loadedStatus, 'load program');
        // Allow the persistent-status IN transfer to retire before sending 0x24.
        // Without this gap the device can execute RUN while its first reply is busy.
        await this._delay(500);
        const runStatus = await this._runReadyProgramNow(timeoutMs);
        return {
            slot,
            loadedStatus,
            runStatus
        };
    }

    async _runReadyProgramNow (timeoutMs) {
        await this._tryClearVisionOnDeviceNow(VISION_SENSOR_CLEAR_REASON_PROGRAM_TRANSITION);
        const runFrame = buildPythonProgramRunFrame(timeoutMs);
        let runStatus;
        try {
            runStatus = await this._pythonProgramActionNow(runFrame);
        } catch (error) {
            if (!isEstCommandTimeoutError(error)) {
                throw error;
            }
            let statusError = error;
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    runStatus = await this._pythonProgramActionNow(buildPythonProgramStatusFrame());
                    break;
                } catch (retryError) {
                    statusError = retryError;
                    if (!isEstCommandTimeoutError(retryError) || attempt === 2) {
                        throw retryError;
                    }
                    await this._delay(50);
                }
            }
            if (!runStatus) {
                throw statusError;
            }
            if (runStatus.state === PYTHON_PROGRAM_STATE_READY) {
                await this._delay(50);
                runStatus = await this._pythonProgramActionNow(runFrame);
            } else if (!this._pythonProgramActive(runStatus) && !this._pythonProgramFinished(runStatus)) {
                throw error;
            }
        }
        this._requirePythonProgramSuccess(runStatus, 'start program');
        this._updatePythonProgramActivity(runStatus);
        return runStatus;
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
        if (this.pythonProgramActive) {
            this._scheduleVisionDispatch();
        } else {
            this._cancelVisionTimer();
        }
    }

    async _tryClearVisionOnDeviceNow (reason) {
        try {
            return await this._clearVisionOnDeviceNow(reason);
        } catch (error) {
            this.visionLastError = error.message;
            return null;
        }
    }

    async _pythonProgramActionNow (frame, timeoutMs = this.requestTimeoutMs) {
        const report = await this._requestFrameNow(
            frame,
            COMMAND_PYTHON_PROGRAM,
            timeoutMs
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
            if (status.error === 7) {
                throw new Error(`EST 拒绝程序：源码超过设备容量 (${operation})`);
            }
            if (status.error === 8) {
                throw new Error(`EST MicroPython 编译内存不足 (${operation})`);
            }
            if (status.error === 9) {
                throw new Error(`EST 拒绝程序：Python 语法错误 (${operation})`);
            }
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
        try {
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
        } catch (error) {
            if (isTransportDisconnectError(error)) {
                await this._disconnectNow(false);
                throw new Error(EST_USB_DISCONNECTED_MESSAGE);
            }
            throw error;
        }
    }
}
