export const EST_USB_VID = 0x0483;
export const EST_USB_PID = 0x5750;

export const FRAME_START = 0x68;
export const FRAME_END = 0x16;
export const HOST_DIRECTION = 0x11;
export const DEVICE_DIRECTION = 0x21;

export const COMMAND_HEARTBEAT = 0x01;
export const COMMAND_MOTOR_CONTROL = 0x17;
export const COMMAND_INPUT_SENSOR = 0x18;
export const COMMAND_DEVICE_STATUS = 0x19;
export const COMMAND_MOTOR_TYPE = 0x1A;
export const COMMAND_MOTOR_POSITION = 0x1B;
export const COMMAND_MOTOR_SPEED = 0x1C;
export const COMMAND_MOTOR_PAIR_POSITION = 0x1D;
export const COMMAND_PYTHON_PROGRAM = 0x24;
export const COMMAND_PERSISTENT_PROGRAM = 0x25;

export const EST_PROTOCOL_MAJOR = 1;
export const EST_MIN_PROTOCOL_MINOR = 20;

// Development policy: accept every EST firmware until compatibility is
// tightened for release. Keep the verified table below for diagnostics.
export const EST_ALLOW_ALL_FIRMWARE_VERSIONS = true;

export const EST_PROGRAM_COMPATIBILITY_TABLE = Object.freeze({
    'M1.10A': Object.freeze({protocolMajor: 1, protocolMinor: 20}),
    'M1.10B': Object.freeze({protocolMajor: 1, protocolMinor: 20}),
    'M1.10C': Object.freeze({protocolMajor: 1, protocolMinor: 20}),
    'M1.12A': Object.freeze({protocolMajor: 1, protocolMinor: 21}),
    'M1.13A': Object.freeze({protocolMajor: 1, protocolMinor: 22}),
    'M1.14A': Object.freeze({protocolMajor: 1, protocolMinor: 24}),
    'M1.21A': Object.freeze({protocolMajor: 1, protocolMinor: 26}),
    'M1.22D': Object.freeze({protocolMajor: 1, protocolMinor: 26}),
    'M1.22E': Object.freeze({protocolMajor: 1, protocolMinor: 26}),
    'M1.22H': Object.freeze({protocolMajor: 1, protocolMinor: 26})
});

export const CAPABILITY_FIRMWARE_UPDATE = 1 << 0;
export const CAPABILITY_MOTOR_CONTROL = 1 << 1;
export const CAPABILITY_MOTOR_TACHO = 1 << 2;
export const CAPABILITY_INPUT_SENSOR = 1 << 3;
export const CAPABILITY_BATTERY = 1 << 4;
export const CAPABILITY_KEYS = 1 << 5;
export const CAPABILITY_MOTOR_TYPE = 1 << 6;
export const CAPABILITY_MOTOR_POSITION = 1 << 7;
export const CAPABILITY_MOTOR_PAIR_POSITION = 1 << 8;
export const CAPABILITY_MOTOR_PAIR_SPEED = 1 << 9;
export const CAPABILITY_DRIVE_STRAIGHT = 1 << 10;
export const CAPABILITY_DRIVE_RUN = 1 << 11;
export const CAPABILITY_DRIVE_STEER = 1 << 12;
export const CAPABILITY_DRIVE_STEER_FOR = 1 << 13;
export const CAPABILITY_MICROPYTHON = 1 << 14;
export const CAPABILITY_PYTHON_PROGRAM = 1 << 15;
export const CAPABILITY_PERSISTENT_PROGRAM = 1 << 16;
export const CAPABILITY_FROZEN_EST_RUNTIME = 1 << 17;
export const CAPABILITY_UNLIMITED_PYTHON_RUN = 1 << 18;
export const CAPABILITY_DISPLAY_FONT_STYLES = 1 << 19;
export const CAPABILITY_ZERO_SPEED_MOTOR_CONTROL = 1 << 20;
export const CAPABILITY_HOLD_POSITION_CONTROL = 1 << 21;
export const CAPABILITY_TEMPERATURE_SENSOR = 1 << 22;
export const CAPABILITY_COOPERATIVE_MULTITASK = 1 << 23;
export const CAPABILITY_RUNTIME_BASIC_EVENT_HATS = 1 << 24;
export const CAPABILITY_MOTOR_STALL_DETECTION = 1 << 25;

export const PYTHON_PROGRAM_ACTION_STATUS = 0x00;
export const PYTHON_PROGRAM_ACTION_BEGIN = 0x01;
export const PYTHON_PROGRAM_ACTION_CHUNK = 0x02;
export const PYTHON_PROGRAM_ACTION_RUN = 0x03;
export const PYTHON_PROGRAM_ACTION_STOP = 0x04;
export const PYTHON_PROGRAM_ACTION_CLEAR = 0x05;

export const PERSISTENT_PROGRAM_ACTION_STATUS = 0x00;
export const PERSISTENT_PROGRAM_ACTION_SAVE = 0x01;
export const PERSISTENT_PROGRAM_ACTION_LOAD = 0x02;
export const PERSISTENT_PROGRAM_ACTION_CLEAR = 0x03;

export const PYTHON_PROGRAM_STATE_EMPTY = 0;
export const PYTHON_PROGRAM_STATE_RECEIVING = 1;
export const PYTHON_PROGRAM_STATE_READY = 2;
export const PYTHON_PROGRAM_STATE_QUEUED = 3;
export const PYTHON_PROGRAM_STATE_RUNNING = 4;
export const PYTHON_PROGRAM_STATE_COMPLETED = 5;
export const PYTHON_PROGRAM_STATE_EXCEPTION = 6;
export const PYTHON_PROGRAM_STATE_STOPPED = 7;
export const PYTHON_PROGRAM_STATE_TIMED_OUT = 8;
export const PYTHON_PROGRAM_STATE_INVALID = 9;
export const PYTHON_PROGRAM_FLAG_TIMEOUT_ARMED = 0x08;

export const PYTHON_PROGRAM_MAX_SIZE = 8192;
export const PYTHON_PROGRAM_CHUNK_SIZE = 1000;
export const PYTHON_PROGRAM_NO_TIMEOUT_MS = 0;
export const PYTHON_PROGRAM_MIN_TIMEOUT_MS = 100;
export const PYTHON_PROGRAM_MAX_TIMEOUT_MS = 10000;
export const PERSISTENT_PROGRAM_SLOT_COUNT = 8;
export const PERSISTENT_PROGRAM_NAME_MAX_BYTES = 31;

export const LEGACY_REPORT_SIZE = 64;
export const HIGH_SPEED_REPORT_DATA_SIZE = 1024;
export const HIGH_SPEED_REPORT_SIZE = HIGH_SPEED_REPORT_DATA_SIZE + 1;
export const MAX_PAYLOAD = 1010;
export const HID_READ_TIMEOUT_MS = 250;
export const PROGRAM_REQUEST_TIMEOUT_MS = 2000;
export const PERSISTENT_PROGRAM_REQUEST_TIMEOUT_MS = 15000;
export const PROGRAM_STATUS_REQUEST_TIMEOUT_MS = 500;
export const PROGRAM_STATUS_POLL_INTERVAL_MS = 20;
export const FRAGMENT_WRITE_DELAY_MS = 3;
