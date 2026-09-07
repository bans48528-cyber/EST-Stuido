const MOTOR_PORTS = ['A', 'B', 'C', 'D'];
const SENSOR_PORTS = ['1', '2', '3', '4'];

const MOTOR_TYPE_NAMES = {
    0: 'none',
    4: 'large-motor',
    5: 'medium-motor',
    0xff: 'unknown'
};

const SENSOR_STATE_NAMES = {
    0: 'off',
    1: 'syncing',
    2: 'streaming',
    3: 'stale'
};

const SENSOR_TYPE_NAMES = {
    0: 'none',
    0x03: 'NXT-sound',
    0x06: 'EST-temperature',
    0x10: 'EST/EV3-touch',
    0x1d: 'EST/EV3-color',
    0x1e: 'EST/EV3-ultrasonic',
    0x20: 'EST/EV3-gyro',
    0x21: 'EST/EV3-infrared'
};

const nameForCode = (names, value) => (
    Object.prototype.hasOwnProperty.call(names, value) ? names[value] : `unknown-${Number(value)}`
);

export const createEstAiHardwareContext = connection => {
    if (!connection || connection.state !== 'connected' || !connection.status) return null;
    const status = connection.status;
    const motorTypes = status.motorTypes && Array.isArray(status.motorTypes.motors) ?
        status.motorTypes.motors : [];
    const sensors = Array.isArray(status.sensors) ? status.sensors : [];
    return {
        source: 'EST USB live snapshot',
        motorPorts: MOTOR_PORTS.map((port, index) => ({
            port,
            type: motorTypes[index] ? nameForCode(MOTOR_TYPE_NAMES, motorTypes[index].motorType) : 'unavailable'
        })),
        sensorPorts: SENSOR_PORTS.map((port, index) => ({
            port,
            type: sensors[index] ? nameForCode(SENSOR_TYPE_NAMES, sensors[index].sensorType) : 'unavailable',
            state: sensors[index] ? nameForCode(SENSOR_STATE_NAMES, sensors[index].state) : 'unavailable'
        }))
    };
};
