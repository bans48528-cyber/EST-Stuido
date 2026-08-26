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

export const EST_PROTOCOL_MAJOR = 1;
export const EST_MIN_PROTOCOL_MINOR = 5;

export const CAPABILITY_FIRMWARE_UPDATE = 1 << 0;
export const CAPABILITY_MOTOR_CONTROL = 1 << 1;
export const CAPABILITY_MOTOR_TACHO = 1 << 2;
export const CAPABILITY_INPUT_SENSOR = 1 << 3;
export const CAPABILITY_BATTERY = 1 << 4;
export const CAPABILITY_KEYS = 1 << 5;
export const CAPABILITY_MOTOR_TYPE = 1 << 6;
export const CAPABILITY_MOTOR_POSITION = 1 << 7;
export const CAPABILITY_MOTOR_PAIR_POSITION = 1 << 8;

export const LEGACY_REPORT_SIZE = 64;
export const HIGH_SPEED_REPORT_DATA_SIZE = 1024;
export const HIGH_SPEED_REPORT_SIZE = HIGH_SPEED_REPORT_DATA_SIZE + 1;
export const MAX_PAYLOAD = 1010;
export const HID_READ_TIMEOUT_MS = 250;
