import {
    CAPABILITY_COOPERATIVE_MULTITASK,
    CAPABILITY_DISPLAY_FONT_STYLES,
    CAPABILITY_FIRMWARE_UPDATE,
    CAPABILITY_FROZEN_EST_RUNTIME,
    CAPABILITY_BATTERY,
    CAPABILITY_DRIVE_RUN,
    CAPABILITY_DRIVE_STEER,
    CAPABILITY_DRIVE_STEER_FOR,
    CAPABILITY_DRIVE_STRAIGHT,
    CAPABILITY_HOLD_POSITION_CONTROL,
    CAPABILITY_INPUT_SENSOR,
    CAPABILITY_KEYS,
    CAPABILITY_MICROPYTHON,
    CAPABILITY_MOTOR_CONTROL,
    CAPABILITY_MOTOR_PAIR_POSITION,
    CAPABILITY_MOTOR_PAIR_SPEED,
    CAPABILITY_MOTOR_POSITION,
    CAPABILITY_MOTOR_STALL_DETECTION,
    CAPABILITY_MOTOR_TACHO,
    CAPABILITY_MOTOR_TYPE,
    CAPABILITY_PERSISTENT_PROGRAM,
    CAPABILITY_PYTHON_PROGRAM,
    CAPABILITY_RUNTIME_BASIC_EVENT_HATS,
    CAPABILITY_TEMPERATURE_SENSOR,
    CAPABILITY_UNLIMITED_PYTHON_RUN,
    CAPABILITY_ZERO_SPEED_MOTOR_CONTROL,
    COMMAND_PERSISTENT_PROGRAM,
    COMMAND_PYTHON_PROGRAM,
    DEVICE_DIRECTION,
    EST_ALLOW_ALL_FIRMWARE_VERSIONS,
    EST_MIN_PROTOCOL_MINOR,
    EST_PROGRAM_COMPATIBILITY_TABLE,
    EST_PROTOCOL_MAJOR,
    EST_USB_PID,
    EST_USB_VID,
    FRAME_END,
    FRAME_START,
    HIGH_SPEED_REPORT_DATA_SIZE,
    LEGACY_REPORT_SIZE,
    MAX_PAYLOAD,
    HOST_DIRECTION,
    PERSISTENT_PROGRAM_ACTION_CLEAR,
    PERSISTENT_PROGRAM_ACTION_LOAD,
    PERSISTENT_PROGRAM_ACTION_SAVE,
    PERSISTENT_PROGRAM_ACTION_STATUS,
    PERSISTENT_PROGRAM_NAME_MAX_BYTES,
    PERSISTENT_PROGRAM_SLOT_COUNT,
    PYTHON_PROGRAM_ACTION_BEGIN,
    PYTHON_PROGRAM_ACTION_CHUNK,
    PYTHON_PROGRAM_ACTION_CLEAR,
    PYTHON_PROGRAM_ACTION_RUN,
    PYTHON_PROGRAM_ACTION_STATUS,
    PYTHON_PROGRAM_ACTION_STOP,
    PYTHON_PROGRAM_CHUNK_SIZE,
    PYTHON_PROGRAM_MAX_SIZE,
    PYTHON_PROGRAM_MAX_TIMEOUT_MS,
    PYTHON_PROGRAM_MIN_TIMEOUT_MS,
    PYTHON_PROGRAM_NO_TIMEOUT_MS
} from './constants';

export const checksum = bytes => Array.from(bytes).reduce((sum, value) => sum + value, 0) & 0xff;

export const buildFrame = (command, payload = new Uint8Array()) => {
    if (!Number.isInteger(command) || command < 0 || command > 0xff) {
        throw new RangeError('EST command must fit uint8');
    }
    if (payload.length > MAX_PAYLOAD) {
        throw new RangeError(`EST payload must be at most ${MAX_PAYLOAD} bytes`);
    }
    const frame = new Uint8Array(7 + payload.length);
    frame[0] = FRAME_START;
    frame[1] = HOST_DIRECTION;
    frame[2] = command;
    frame[3] = payload.length & 0xff;
    frame[4] = (payload.length >> 8) & 0xff;
    frame.set(payload, 5);
    frame[5 + payload.length] = checksum(frame.slice(0, 5 + payload.length));
    frame[6 + payload.length] = FRAME_END;
    return frame;
};

export const splitReports = (frame, reportDataSize = LEGACY_REPORT_SIZE) => {
    if (!Number.isInteger(reportDataSize) || reportDataSize <= 0) {
        throw new RangeError('EST report data size must be a positive integer');
    }
    const reports = [];
    for (let offset = 0; offset < frame.length; offset += reportDataSize) {
        const report = new Uint8Array(reportDataSize);
        report.set(frame.slice(offset, offset + reportDataSize));
        reports.push(report);
    }
    return reports;
};

const normalizeReport = report => {
    const bytes = Uint8Array.from(report);
    // Windows HID reports may include a leading report ID byte.
    if (bytes.length === HIGH_SPEED_REPORT_DATA_SIZE + 1 && bytes[0] === 0) {
        return bytes.slice(1);
    }
    return bytes;
};

export const parseFrame = (report, expectedCommand = null) => {
    const bytes = normalizeReport(report);
    if (bytes.length < 7 || bytes[0] !== FRAME_START || bytes[1] !== DEVICE_DIRECTION) {
        return null;
    }
    if (expectedCommand !== null && bytes[2] !== expectedCommand) {
        return null;
    }
    const payloadLength = bytes[3] | (bytes[4] << 8);
    const checksumIndex = 5 + payloadLength;
    const endIndex = checksumIndex + 1;
    if (endIndex >= bytes.length || bytes[endIndex] !== FRAME_END) {
        return null;
    }
    if (checksum(bytes.slice(0, checksumIndex)) !== bytes[checksumIndex]) {
        return null;
    }
    return {
        command: bytes[2],
        payload: bytes.slice(5, checksumIndex),
        frame: bytes.slice(0, endIndex + 1)
    };
};

export const buildHeartbeatFrame = () => buildFrame(0x01);

const assertUint32 = (value, label) => {
    if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
        throw new RangeError(`${label} must fit uint32`);
    }
};

const writeUint16LE = (bytes, offset, value) => {
    bytes[offset] = value & 0xff;
    bytes[offset + 1] = (value >>> 8) & 0xff;
};

const writeUint32LE = (bytes, offset, value) => {
    bytes[offset] = value & 0xff;
    bytes[offset + 1] = (value >>> 8) & 0xff;
    bytes[offset + 2] = (value >>> 16) & 0xff;
    bytes[offset + 3] = (value >>> 24) & 0xff;
};

const readUint16LE = (bytes, offset) => bytes[offset] | (bytes[offset + 1] << 8);
const readUint32LE = (bytes, offset) => (
    (bytes[offset] |
        (bytes[offset + 1] << 8) |
        (bytes[offset + 2] << 16) |
        (bytes[offset + 3] << 24)) >>> 0
);
const readInt32LE = (bytes, offset) => readUint32LE(bytes, offset) | 0;

const EST_PROGRAM_REQUIRED_PROTOCOL_MINOR = EST_PROGRAM_COMPATIBILITY_TABLE['M1.12A'].protocolMinor;
const EST_PROGRAM_TEMPERATURE_PROTOCOL_MINOR = EST_PROGRAM_COMPATIBILITY_TABLE['M1.14A'].protocolMinor;
const EST_PROGRAM_COOPERATIVE_PROTOCOL_MINOR = 25;
const EST_PROGRAM_BASIC_EVENT_HATS_PROTOCOL_MINOR = 25;
const EST_PROGRAM_MOTOR_STALL_PROTOCOL_MINOR = 26;
export const EST_PROGRAM_RUNTIME_API_MIN_FIRMWARE_VERSION = 'M1.22E';
const EST_PROGRAM_REQUIRED_CAPABILITIES = (
    CAPABILITY_FROZEN_EST_RUNTIME |
    CAPABILITY_UNLIMITED_PYTHON_RUN |
    CAPABILITY_DISPLAY_FONT_STYLES |
    CAPABILITY_ZERO_SPEED_MOTOR_CONTROL
) >>> 0;
const EST_PROGRAM_CAPABILITY_PROTOCOL_MINOR_REQUIREMENTS = Object.freeze([
    [CAPABILITY_TEMPERATURE_SENSOR, EST_PROGRAM_TEMPERATURE_PROTOCOL_MINOR],
    [CAPABILITY_COOPERATIVE_MULTITASK, EST_PROGRAM_COOPERATIVE_PROTOCOL_MINOR],
    [CAPABILITY_RUNTIME_BASIC_EVENT_HATS, EST_PROGRAM_BASIC_EVENT_HATS_PROTOCOL_MINOR],
    [CAPABILITY_MOTOR_STALL_DETECTION, EST_PROGRAM_MOTOR_STALL_PROTOCOL_MINOR]
]);
export const EST_CAPABILITY_NAMES = Object.freeze([
    [CAPABILITY_FIRMWARE_UPDATE, 'firmware-update'],
    [CAPABILITY_MOTOR_CONTROL, 'motor-control'],
    [CAPABILITY_MOTOR_TACHO, 'motor-tacho'],
    [CAPABILITY_INPUT_SENSOR, 'input-sensor'],
    [CAPABILITY_BATTERY, 'battery'],
    [CAPABILITY_KEYS, 'keys'],
    [CAPABILITY_MOTOR_TYPE, 'motor-type'],
    [CAPABILITY_MOTOR_POSITION, 'motor-position'],
    [CAPABILITY_MOTOR_PAIR_POSITION, 'motor-pair-position'],
    [CAPABILITY_MOTOR_PAIR_SPEED, 'motor-pair-speed'],
    [CAPABILITY_DRIVE_STRAIGHT, 'drive-straight'],
    [CAPABILITY_DRIVE_RUN, 'drive-run'],
    [CAPABILITY_DRIVE_STEER, 'drive-steer'],
    [CAPABILITY_DRIVE_STEER_FOR, 'drive-steer-for'],
    [CAPABILITY_MICROPYTHON, 'micropython'],
    [CAPABILITY_PYTHON_PROGRAM, 'python-program'],
    [CAPABILITY_PERSISTENT_PROGRAM, 'persistent-program'],
    [CAPABILITY_FROZEN_EST_RUNTIME, 'frozen-est-runtime'],
    [CAPABILITY_UNLIMITED_PYTHON_RUN, 'unlimited-python-run'],
    [CAPABILITY_DISPLAY_FONT_STYLES, 'display-font-styles'],
    [CAPABILITY_ZERO_SPEED_MOTOR_CONTROL, 'zero-speed-motor-control'],
    [CAPABILITY_HOLD_POSITION_CONTROL, 'hold-position-control'],
    [CAPABILITY_TEMPERATURE_SENSOR, 'runtime-temperature'],
    [CAPABILITY_COOPERATIVE_MULTITASK, 'cooperative-multitask'],
    [CAPABILITY_RUNTIME_BASIC_EVENT_HATS, 'runtime-basic-event-hats'],
    [CAPABILITY_MOTOR_STALL_DETECTION, 'motor-stall-detection']
]);

export const capabilityNamesFor = capabilities => EST_CAPABILITY_NAMES
    .filter(([flag]) => (capabilities & flag) !== 0)
    .map(([, name]) => name);

const protocolMinorForCapabilities = requiredProgramCapabilities => (
    EST_PROGRAM_CAPABILITY_PROTOCOL_MINOR_REQUIREMENTS.reduce((minimum, [capability, protocolMinor]) => (
        (requiredProgramCapabilities & capability) === 0 ? minimum : Math.max(minimum, protocolMinor)
    ), EST_PROGRAM_REQUIRED_PROTOCOL_MINOR)
);

const firmwareSuffixRank = suffix => {
    const normalized = String(suffix || '').toUpperCase();
    let rank = 0;
    for (const char of normalized) {
        const code = char.charCodeAt(0);
        if (code >= 65 && code <= 90) {
            rank = (rank * 26) + (code - 64);
        } else {
            return null;
        }
    }
    return rank;
};

export const parseEstFirmwareVersion = version => {
    const match = String(version || '')
        .trim()
        .match(/^([A-Za-z]+)(\d+)\.(\d+)([A-Za-z]*)$/);
    if (!match) return null;
    const suffixRank = firmwareSuffixRank(match[4]);
    if (suffixRank === null) return null;
    return {
        family: match[1].toUpperCase(),
        major: Number(match[2]),
        minor: Number(match[3]),
        suffix: match[4].toUpperCase(),
        suffixRank
    };
};

export const compareEstFirmwareVersions = (left, right) => {
    const leftVersion = parseEstFirmwareVersion(left);
    const rightVersion = parseEstFirmwareVersion(right);
    if (!leftVersion || !rightVersion || leftVersion.family !== rightVersion.family) return null;
    if (leftVersion.major !== rightVersion.major) return leftVersion.major - rightVersion.major;
    if (leftVersion.minor !== rightVersion.minor) return leftVersion.minor - rightVersion.minor;
    return leftVersion.suffixRank - rightVersion.suffixRank;
};

export const isEstFirmwareVersionAtLeast = (version, minimumVersion) => {
    const comparison = compareEstFirmwareVersions(version, minimumVersion);
    return comparison !== null && comparison >= 0;
};

export const programRequiredCapabilitiesForSource = source => {
    const text = typeof source === 'string' ? source : Buffer.from(source || '').toString('utf8');
    let capabilities = 0;
    if (/\brt\.temperature\s*\(/.test(text)) {
        capabilities |= CAPABILITY_TEMPERATURE_SENSOR;
    }
    if (/\brt\.motor_stalled\s*\(/.test(text)) {
        capabilities |= CAPABILITY_MOTOR_STALL_DETECTION;
    }
    if (/^@rt\.on_(?:brick_button|condition|timer_gt)\b/gm.test(text)) {
        capabilities |= CAPABILITY_RUNTIME_BASIC_EVENT_HATS;
    }
    const startHandlerCount = (text.match(/^@rt\.on_start\b/gm) || []).length;
    if (
        startHandlerCount > 1 ||
        /\basync\s+def\s+stack_\d+\s*\(/.test(text) ||
        /\bawait\s+rt\.(?:yield_once|sleep|wait_until|motor_run_for|drive_move_for|drive_steer_for)\s*\(/.test(text) ||
        /\bawait\s+rt\.(?:display_image_for|wait_[a-z_]+)\s*\(/.test(text) ||
        /\brt\.stop\s*\(/.test(text) ||
        /\brt\.stop_other_stacks\s*\(/.test(text)
    ) {
        capabilities |= CAPABILITY_COOPERATIVE_MULTITASK;
    }
    return capabilities >>> 0;
};

export const programMinimumFirmwareVersionForSource = source => {
    const text = typeof source === 'string' ? source : Buffer.from(source || '').toString('utf8');
    if (
        /\brt\.motor_start_(?:speed|power)\s*\(/.test(text) ||
        /\best\.display\.text_line\s*\(/.test(text)
    ) {
        return EST_PROGRAM_RUNTIME_API_MIN_FIRMWARE_VERSION;
    }
    return null;
};

export const crc32 = bytes => {
    let value = 0xffffffff;
    for (const byte of Uint8Array.from(bytes)) {
        value ^= byte;
        for (let bit = 0; bit < 8; bit++) {
            value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
        }
    }
    return (value ^ 0xffffffff) >>> 0;
};

export const buildPythonProgramStatusFrame = () => buildFrame(
    COMMAND_PYTHON_PROGRAM,
    Uint8Array.from([PYTHON_PROGRAM_ACTION_STATUS])
);

export const buildPythonProgramBeginFrame = (length, sourceCrc32) => {
    if (!Number.isInteger(length) || length < 1 || length > PYTHON_PROGRAM_MAX_SIZE) {
        throw new RangeError(`Python program length must be 1..${PYTHON_PROGRAM_MAX_SIZE} bytes`);
    }
    assertUint32(sourceCrc32, 'Python program CRC32');
    const payload = new Uint8Array(7);
    payload[0] = PYTHON_PROGRAM_ACTION_BEGIN;
    writeUint16LE(payload, 1, length);
    writeUint32LE(payload, 3, sourceCrc32);
    return buildFrame(COMMAND_PYTHON_PROGRAM, payload);
};

export const buildPythonProgramChunkFrame = (offset, chunk) => {
    const chunkBytes = Uint8Array.from(chunk);
    if (!Number.isInteger(offset) || offset < 0 || offset >= PYTHON_PROGRAM_MAX_SIZE) {
        throw new RangeError(`Python program offset must be 0..${PYTHON_PROGRAM_MAX_SIZE - 1}`);
    }
    if (chunkBytes.length < 1 || chunkBytes.length > PYTHON_PROGRAM_CHUNK_SIZE) {
        throw new RangeError(`Python program chunk must be 1..${PYTHON_PROGRAM_CHUNK_SIZE} bytes`);
    }
    if (offset + chunkBytes.length > PYTHON_PROGRAM_MAX_SIZE) {
        throw new RangeError(`Python program chunk exceeds ${PYTHON_PROGRAM_MAX_SIZE} bytes`);
    }
    const payload = new Uint8Array(3 + chunkBytes.length);
    payload[0] = PYTHON_PROGRAM_ACTION_CHUNK;
    writeUint16LE(payload, 1, offset);
    payload.set(chunkBytes, 3);
    return buildFrame(COMMAND_PYTHON_PROGRAM, payload);
};

export const buildPythonProgramRunFrame = timeoutMs => {
    if (!Number.isInteger(timeoutMs) ||
        (timeoutMs !== PYTHON_PROGRAM_NO_TIMEOUT_MS &&
            (timeoutMs < PYTHON_PROGRAM_MIN_TIMEOUT_MS || timeoutMs > PYTHON_PROGRAM_MAX_TIMEOUT_MS))) {
        throw new RangeError(
            `Python program timeout must be ${PYTHON_PROGRAM_NO_TIMEOUT_MS} or ` +
            `${PYTHON_PROGRAM_MIN_TIMEOUT_MS}..${PYTHON_PROGRAM_MAX_TIMEOUT_MS} ms`
        );
    }
    const payload = new Uint8Array(5);
    payload[0] = PYTHON_PROGRAM_ACTION_RUN;
    writeUint32LE(payload, 1, timeoutMs);
    return buildFrame(COMMAND_PYTHON_PROGRAM, payload);
};

export const buildPythonProgramStopFrame = () => buildFrame(
    COMMAND_PYTHON_PROGRAM,
    Uint8Array.from([PYTHON_PROGRAM_ACTION_STOP])
);

export const buildPythonProgramClearFrame = () => buildFrame(
    COMMAND_PYTHON_PROGRAM,
    Uint8Array.from([PYTHON_PROGRAM_ACTION_CLEAR])
);

const validatePersistentProgramSlot = slot => {
    if (!Number.isInteger(slot) || slot < 0 || slot >= PERSISTENT_PROGRAM_SLOT_COUNT) {
        throw new RangeError(`Persistent program slot must be 0..${PERSISTENT_PROGRAM_SLOT_COUNT - 1}`);
    }
};

export const buildPersistentProgramStatusFrame = (slot = 0) => {
    validatePersistentProgramSlot(slot);
    return buildFrame(
        COMMAND_PERSISTENT_PROGRAM,
        slot === 0 ?
            Uint8Array.from([PERSISTENT_PROGRAM_ACTION_STATUS]) :
            Uint8Array.from([PERSISTENT_PROGRAM_ACTION_STATUS, slot])
    );
};

export const buildPersistentProgramSaveFrame = (slot = 0, programName = null) => {
    validatePersistentProgramSlot(slot);
    if (programName === null || typeof programName === 'undefined') {
        if (slot !== 0) {
            throw new RangeError('A program name is required outside slot 0');
        }
        return buildFrame(
            COMMAND_PERSISTENT_PROGRAM,
            Uint8Array.from([PERSISTENT_PROGRAM_ACTION_SAVE])
        );
    }
    const encodedName = Uint8Array.from(Buffer.from(String(programName), 'utf8'));
    if (encodedName.length < 1 || encodedName.length > PERSISTENT_PROGRAM_NAME_MAX_BYTES) {
        throw new RangeError(
            `Persistent program name must be 1..${PERSISTENT_PROGRAM_NAME_MAX_BYTES} UTF-8 bytes`
        );
    }
    if (encodedName.includes(0)) {
        throw new RangeError('Persistent program name must not contain NUL bytes');
    }
    const payload = new Uint8Array(3 + encodedName.length);
    payload.set([PERSISTENT_PROGRAM_ACTION_SAVE, slot, encodedName.length], 0);
    payload.set(encodedName, 3);
    return buildFrame(COMMAND_PERSISTENT_PROGRAM, payload);
};

export const buildPersistentProgramLoadFrame = (slot = 0) => {
    validatePersistentProgramSlot(slot);
    return buildFrame(
        COMMAND_PERSISTENT_PROGRAM,
        slot === 0 ?
            Uint8Array.from([PERSISTENT_PROGRAM_ACTION_LOAD]) :
            Uint8Array.from([PERSISTENT_PROGRAM_ACTION_LOAD, slot])
    );
};

export const buildPersistentProgramClearFrame = (slot = 0) => {
    validatePersistentProgramSlot(slot);
    return buildFrame(
        COMMAND_PERSISTENT_PROGRAM,
        slot === 0 ?
            Uint8Array.from([PERSISTENT_PROGRAM_ACTION_CLEAR]) :
            Uint8Array.from([PERSISTENT_PROGRAM_ACTION_CLEAR, slot])
    );
};

export const parsePythonProgramResponse = report => {
    const parsed = parseFrame(report, COMMAND_PYTHON_PROGRAM);
    if (!parsed || parsed.payload.length !== 32) {
        return null;
    }
    const payload = parsed.payload;
    return {
        schemaVersion: payload[0],
        result: payload[1],
        state: payload[2],
        error: payload[3],
        flags: payload[4],
        expectedLength: readUint16LE(payload, 6),
        receivedLength: readUint16LE(payload, 8),
        runCount: readUint16LE(payload, 10),
        expectedCrc32: readUint32LE(payload, 12),
        actualCrc32: readUint32LE(payload, 16),
        durationMs: readUint32LE(payload, 20),
        timeoutMs: readUint32LE(payload, 24),
        resultValue: readInt32LE(payload, 28)
    };
};

export const parsePersistentProgramResponse = report => {
    const parsed = parseFrame(report, COMMAND_PERSISTENT_PROGRAM);
    if (!parsed || ![28, 40, 76].includes(parsed.payload.length)) {
        return null;
    }
    const payload = parsed.payload;
    if (payload.length === 76) {
        const nameLength = Math.min(payload[14], PERSISTENT_PROGRAM_NAME_MAX_BYTES);
        return {
            schemaVersion: payload[0],
            result: payload[1],
            state: payload[2],
            flags: payload[3],
            programSlotId: payload[4],
            programSlotCount: payload[5],
            activeSlot: payload[6],
            recordType: payload[7],
            generation: readUint32LE(payload, 8),
            sourceLength: readUint16LE(payload, 12),
            programName: Buffer.from(payload.slice(41, 41 + nameLength)).toString('utf8'),
            lastError: payload[15],
            sourceCrc32: readUint32LE(payload, 16),
            regionStart: readUint32LE(payload, 20),
            regionSize: readUint32LE(payload, 24),
            slotSize: readUint32LE(payload, 28),
            flashSize: readUint32LE(payload, 32),
            jedecId: Array.from(payload.slice(36, 39)),
            erasedSectorMask: payload[39],
            occupiedSectorMask: payload[40],
            slotCount: payload[72],
            sectorsPerSlot: payload[73]
        };
    }
    return {
        schemaVersion: payload[0],
        result: payload[1],
        state: payload[2],
        flags: payload[3],
        erasedSectorMask: payload[4],
        occupiedSectorMask: payload[5],
        slotCount: payload[6],
        sectorsPerSlot: payload[7],
        regionStart: readUint32LE(payload, 8),
        regionSize: readUint32LE(payload, 12),
        slotSize: readUint32LE(payload, 16),
        flashSize: readUint32LE(payload, 20),
        jedecId: Array.from(payload.slice(24, 27)),
        activeSlot: payload.length === 40 ? payload[27] : 0xff,
        generation: payload.length === 40 ? readUint32LE(payload, 28) : 0,
        sourceLength: payload.length === 40 ? readUint16LE(payload, 32) : 0,
        recordType: payload.length === 40 ? payload[34] : 0,
        lastError: payload.length === 40 ? payload[35] : 0,
        sourceCrc32: payload.length === 40 ? readUint32LE(payload, 36) : 0,
        programSlotId: 0,
        programSlotCount: 1,
        programName: ''
    };
};

export const parseHeartbeatResponse = report => {
    const parsed = parseFrame(report, 0x01);
    if (!parsed || parsed.payload.length !== 6) {
        return null;
    }
    return String.fromCharCode(...parsed.payload);
};

export const parseDeviceStatusResponse = report => {
    const parsed = parseFrame(report, 0x19);
    if (!parsed || parsed.payload.length !== 72) {
        return null;
    }
    const payload = parsed.payload;
    const readUint16 = offset => payload[offset] | (payload[offset + 1] << 8);
    const readUint32 = offset => (
        (payload[offset] |
            (payload[offset + 1] << 8) |
            (payload[offset + 2] << 16) |
            (payload[offset + 3] << 24)) >>> 0
    );
    const readInt8 = offset => (payload[offset] > 0x7f ? payload[offset] - 0x100 : payload[offset]);
    const readInt32 = offset => readUint32(offset) | 0;

    const motors = [];
    for (let index = 0; index < 4; index++) {
        const offset = 24 + (index * 6);
        motors.push({
            outputState: payload[offset],
            powerPercent: readInt8(offset + 1),
            tachoCount: readInt32(offset + 2)
        });
    }

    const sensors = [];
    for (let index = 0; index < 4; index++) {
        const offset = 48 + (index * 6);
        sensors.push({
            state: payload[offset],
            sensorType: payload[offset + 1],
            mode: payload[offset + 2],
            valueValid: payload[offset + 3] === 1,
            value: readUint16(offset + 4)
        });
    }

    return {
        protocolMajor: payload[0],
        protocolMinor: payload[1],
        firmwareVersion: String.fromCharCode(...payload.slice(2, 8)),
        motorPortCount: payload[8],
        sensorPortCount: payload[9],
        keyMask: payload[10] & 0x3f,
        batteryLevel: payload[11],
        batteryAdcRaw: readUint16(12),
        batterySampleMv: readUint16(14),
        capabilities: readUint32(16),
        uptimeMs: readUint32(20),
        motors,
        sensors
    };
};

export const checkDeviceCompatibility = (status, requiredCapabilities = 0) => {
    const required = Number(requiredCapabilities) >>> 0;
    const available = Number(status && status.capabilities) >>> 0;
    const missingCapabilities = (required & ~available) >>> 0;
    const issues = [];

    if (!status || !Number.isInteger(status.protocolMajor) || !Number.isInteger(status.protocolMinor)) {
        issues.push('EST device status does not contain a valid protocol version');
    } else if (status.protocolMajor !== EST_PROTOCOL_MAJOR) {
        issues.push(
            `EST protocol major ${status.protocolMajor} is not supported; expected ${EST_PROTOCOL_MAJOR}`
        );
    } else if (status.protocolMinor < EST_MIN_PROTOCOL_MINOR) {
        issues.push(
            `EST protocol ${status.protocolMajor}.${status.protocolMinor} is too old; ` +
            `requires ${EST_PROTOCOL_MAJOR}.${EST_MIN_PROTOCOL_MINOR} or newer`
        );
    }

    if (missingCapabilities !== 0) {
        issues.push(`EST firmware is missing required capabilities 0x${missingCapabilities.toString(16)}`);
    }

    return {
        compatible: issues.length === 0,
        expectedProtocolMajor: EST_PROTOCOL_MAJOR,
        minimumProtocolMinor: EST_MIN_PROTOCOL_MINOR,
        requiredCapabilities: required,
        missingCapabilities,
        message: issues.join('; ')
    };
};

export const checkProgramFirmwareCompatibility = (
    status,
    additionalProgramCapabilities = 0,
    minimumFirmwareVersion = null
) => {
    const firmwareVersion = String((status && status.firmwareVersion) || '');
    const tableEntry = EST_PROGRAM_COMPATIBILITY_TABLE[firmwareVersion] || null;
    const protocolMajor = Number(status && status.protocolMajor);
    const protocolMinor = Number(status && status.protocolMinor);
    const availableCapabilities = Number(status && status.capabilities) >>> 0;
    const requiredProgramCapabilities = (
        EST_PROGRAM_REQUIRED_CAPABILITIES |
        (Number(additionalProgramCapabilities) >>> 0)
    ) >>> 0;
    const requiredProgramProtocolMinor = protocolMinorForCapabilities(requiredProgramCapabilities);
    const missingProgramCapabilities = (requiredProgramCapabilities & ~availableCapabilities) >>> 0;
    const missingProgramCapabilityNames = capabilityNamesFor(missingProgramCapabilities);
    const hasProtocolVersion = Number.isInteger(protocolMajor) && Number.isInteger(protocolMinor);
    const protocolMatches = Boolean(tableEntry) && hasProtocolVersion &&
        protocolMajor === tableEntry.protocolMajor && protocolMinor === tableEntry.protocolMinor;
    const programProtocolCompatible = hasProtocolVersion &&
        protocolMajor === EST_PROTOCOL_MAJOR &&
        protocolMinor >= requiredProgramProtocolMinor;
    const requiredProgramMinimumFirmwareVersion = minimumFirmwareVersion ?
        String(minimumFirmwareVersion) :
        null;
    const firmwareVersionComparison = requiredProgramMinimumFirmwareVersion ?
        compareEstFirmwareVersions(firmwareVersion, requiredProgramMinimumFirmwareVersion) :
        null;
    const programFirmwareVersionCompatible = !requiredProgramMinimumFirmwareVersion ||
        (firmwareVersionComparison !== null && firmwareVersionComparison >= 0);
    const programIssues = [];
    const verified = Boolean(tableEntry) && protocolMatches;
    let message = '';

    if (!tableEntry) {
        message = firmwareVersion ?
            `EST firmware ${firmwareVersion} is not in the verified program compatibility table` :
            'EST firmware version is unavailable';
    } else if (!hasProtocolVersion) {
        message = `EST firmware ${firmwareVersion} did not report a protocol version`;
    } else if (!protocolMatches) {
        message = `EST firmware ${firmwareVersion} reported protocol ${protocolMajor}.${protocolMinor}; ` +
            `expected ${tableEntry.protocolMajor}.${tableEntry.protocolMinor}`;
    }

    if (!hasProtocolVersion) {
        programIssues.push('无法读取 EST 固件协议版本');
    } else if (protocolMajor !== EST_PROTOCOL_MAJOR) {
        programIssues.push(`当前协议 ${protocolMajor}.${protocolMinor} 不支持；需要 ` +
            `${EST_PROTOCOL_MAJOR}.${requiredProgramProtocolMinor} 或更新版本`);
    } else if (protocolMinor < requiredProgramProtocolMinor) {
        programIssues.push(`当前协议 ${protocolMajor}.${protocolMinor} 不支持；需要 ` +
            `${EST_PROTOCOL_MAJOR}.${requiredProgramProtocolMinor} 或更新版本`);
    }
    if (missingProgramCapabilities !== 0) {
        programIssues.push(`缺少能力: ${missingProgramCapabilityNames.join(', ')}`);
    }
    if (!programFirmwareVersionCompatible) {
        if (!firmwareVersion) {
            programIssues.push(`无法读取 EST 固件版本；需要 ${requiredProgramMinimumFirmwareVersion} 或更新版本`);
        } else if (firmwareVersionComparison === null) {
            programIssues.push(
                `当前固件 ${firmwareVersion} 无法与 ${requiredProgramMinimumFirmwareVersion} 做版本比较`
            );
        } else {
            programIssues.push(
                `当前固件 ${firmwareVersion} 不支持该程序使用的新运行时 API；需要 ` +
                `${requiredProgramMinimumFirmwareVersion} 或更新版本`
            );
        }
    }

    const programCompatible = programIssues.length === 0;

    return {
        compatible: EST_ALLOW_ALL_FIRMWARE_VERSIONS || (verified && programCompatible),
        enforcementEnabled: !EST_ALLOW_ALL_FIRMWARE_VERSIONS,
        firmwareVersion,
        knownFirmware: Boolean(tableEntry),
        programCompatible,
        programMessage: programIssues.join('; '),
        programProtocolCompatible,
        programFirmwareVersionCompatible,
        requiredProgramProtocolMajor: EST_PROTOCOL_MAJOR,
        requiredProgramProtocolMinor,
        requiredProgramCapabilities,
        requiredProgramMinimumFirmwareVersion,
        firmwareVersionComparison,
        missingProgramCapabilities,
        missingProgramCapabilityNames,
        verified,
        expectedProtocolMajor: tableEntry ? tableEntry.protocolMajor : null,
        expectedProtocolMinor: tableEntry ? tableEntry.protocolMinor : null,
        message
    };
};

export const isEstDevice = device => (
    Number(device && device.vendorId) === EST_USB_VID && Number(device && device.productId) === EST_USB_PID
);

export const defaultReportDataSize = device => (
    Number(device && device.maxInputReportSize) >= HIGH_SPEED_REPORT_DATA_SIZE ||
        /HS Mode/i.test(String(device && device.product)) ?
        HIGH_SPEED_REPORT_DATA_SIZE : LEGACY_REPORT_SIZE
);
