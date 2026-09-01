const {ipcRenderer} = require('electron');
const {
    ALL_EST_BLOCK_IDS,
    EST_DRIVE_PORT_PICKER_ID,
    EST_MOTOR_PORT_PICKER_ID,
    EST_SENSOR_PORT_PICKER_ID,
    EST_STEERING_PICKER_ID
} = require('./definitions');

const MOTOR_PORT_INDEX = {
    A: 0,
    B: 1,
    C: 2,
    D: 3
};

class EstBlocks {
    constructor (runtime, ipc = ipcRenderer) {
        this.runtime = runtime;
        this.ipc = ipc;
    }

    getPrimitives () {
        const primitives = {};
        ALL_EST_BLOCK_IDS.forEach(blockId => {
            primitives[blockId] = () => this.unsupportedBlock(blockId);
        });
        primitives.motor_degrees = this.motorDegrees;
        primitives[EST_MOTOR_PORT_PICKER_ID] = this.portMenu;
        primitives[EST_DRIVE_PORT_PICKER_ID] = this.portMenu;
        primitives[EST_STEERING_PICKER_ID] = this.steeringMenu;
        primitives[EST_SENSOR_PORT_PICKER_ID] = this.sensorPortMenu;
        return primitives;
    }

    portMenu (args) {
        return String(args.PORT || 'A').toUpperCase();
    }

    steeringMenu (args) {
        const steering = Number(args.NUM);
        return Number.isFinite(steering) ? steering : 0;
    }

    sensorPortMenu (args) {
        return String(args.PORT || '1');
    }

    unsupportedBlock (blockId) {
        throw new Error(`EST block ${blockId} is not connected to device execution yet`);
    }

    async motorDegrees (args) {
        const port = String(args.PORT || 'A').toUpperCase();
        const portIndex = MOTOR_PORT_INDEX[port];
        if (!Number.isInteger(portIndex)) {
            throw new Error(`Invalid EST motor port: ${port}`);
        }
        if (!this.ipc || typeof this.ipc.invoke !== 'function') {
            throw new Error('EST IPC bridge is unavailable');
        }

        const connection = await this.ipc.invoke('est-auto-connect');
        if (!connection || connection.state !== 'connected' || !connection.status) {
            throw new Error('EST is not connected');
        }
        const motor = connection.status.motors && connection.status.motors[portIndex];
        if (!motor || !Number.isFinite(motor.tachoCount)) {
            throw new Error(`EST motor ${port} status is unavailable`);
        }
        return motor.tachoCount;
    }
}

module.exports = EstBlocks;
