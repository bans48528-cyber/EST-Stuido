import {
    DEVICE_DIRECTION,
    EST_MIN_PROTOCOL_MINOR,
    EST_PROTOCOL_MAJOR,
    EST_USB_PID,
    EST_USB_VID,
    FRAME_END,
    FRAME_START,
    HIGH_SPEED_REPORT_DATA_SIZE,
    LEGACY_REPORT_SIZE,
    MAX_PAYLOAD,
    HOST_DIRECTION
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

export const isEstDevice = device => (
    Number(device && device.vendorId) === EST_USB_VID && Number(device && device.productId) === EST_USB_PID
);

export const defaultReportDataSize = device => (
    Number(device && device.maxInputReportSize) >= HIGH_SPEED_REPORT_DATA_SIZE ||
        /HS Mode/i.test(String(device && device.product)) ?
        HIGH_SPEED_REPORT_DATA_SIZE : LEGACY_REPORT_SIZE
);
