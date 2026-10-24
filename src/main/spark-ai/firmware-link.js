/* eslint-disable no-use-before-define */
import {EventEmitter} from 'events';
import {SparkError, SparkStreamParser, sparkFrame, SPARK_COMMAND} from './protocol';

export const firmwareDelay = ms => new Promise(resolve => setTimeout(resolve, ms));
export const firmwareBounded = (promise, ms, code) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new SparkError(code)), ms);
    Promise.resolve(promise).then(value => {
        clearTimeout(timer); resolve(value);
    }, error => {
        clearTimeout(timer); reject(error);
    });
});

// The Bootloader has no request IDs or resend support. One write and one ACK at a time.
export class SparkFirmwareLink extends EventEmitter {
    constructor (transport, {ack = 800, write = 800, open = 6000, close = 2500, gap = 800} = {}) {
        super();
        this.transport = transport;
        this.timeouts = {ack, write, open, close, gap};
        this.parser = new SparkStreamParser();
        this.data = bytes => {
            if (!this.closed) this.parser.push(bytes);
        };
        this.fault = error => {
            this.failure = error || new SparkError('SPARK_DISCONNECTED');
            if (this.pending) this.pending.reject(this.failure);
            this.emit('lost', this.failure);
        };
        this.disconnected = () => this.fault(new SparkError('SPARK_DISCONNECTED'));
        transport.on('data', this.data);
        transport.on('fault', this.fault);
        transport.on('closed', this.disconnected);
        this.parser.on('monitor', monitor => {
            this.monitor = monitor; this.emit('monitor', monitor);
        });
        this.parser.on('frame', ({command, payload}) => {
            if (!this.pending) return;
            if (command === SPARK_COMMAND.ACK) {
                if (payload.length === 1 && payload[0] === 1) {
                    this.lastAck = Date.now(); this.pending.resolve();
                } else this.pending.reject(new SparkError('SPARK_ACK_INVALID'));
            } else if (payload.length === 1 && payload[0] === command &&
                (command <= 20 || [0xF3, 0xF4, 0xFF].includes(command))) {
                this.pending.reject(new SparkError('SPARK_DEVICE_ERROR', `0x${command.toString(16)}`));
            }
        });
        this.parser.on('fault', error => {
            if (this.pending) this.pending.reject(error);
        });
    }
    async open () {
        await firmwareBounded(this.transport.open(), this.timeouts.open, 'SPARK_CONNECT_TIMEOUT');
        if (this.failure) throw this.failure;
    }
    async send (command, payload) {
        if (this.closed || this.failure) throw this.failure || new SparkError('SPARK_DISCONNECTED');
        if (this.monitor) throw new SparkError('SPARK_FW_BOOT_REQUIRED');
        if (this.pending) throw new SparkError('SPARK_BUSY');
        if (this.lastAck && Date.now() - this.lastAck > this.timeouts.gap) {
            throw new SparkError('SPARK_FW_GAP');
        }
        let pending;
        const ack = new Promise((resolve, reject) => {
            const finish = error => {
                if (this.pending !== pending) return;
                clearTimeout(timer);
                this.pending = null;
                if (error) reject(error); else resolve();
            };
            const timer = setTimeout(() => finish(new SparkError('SPARK_ACK_TIMEOUT')), this.timeouts.ack);
            pending = {resolve: () => finish(), reject: finish};
            this.pending = pending;
        });
        try {
            await Promise.all([
                firmwareBounded(Promise.resolve().then(() => this.transport.write(sparkFrame(command, payload))),
                    this.timeouts.write, 'SPARK_WRITE_TIMEOUT'), ack
            ]);
        } catch (error) {
            if (this.pending === pending) pending.reject(error);
            throw error;
        }
    }
    waitForMonitor (timeout) {
        if (this.monitor) return Promise.resolve(this.monitor);
        if (this.failure || this.closed) return Promise.reject(this.failure || new SparkError('SPARK_DISCONNECTED'));
        return new Promise((resolve, reject) => {
            const finish = (error, value) => {
                clearTimeout(timer);
                this.removeListener('monitor', monitor);
                this.removeListener('lost', lost);
                if (error) reject(error); else resolve(value);
            };
            const monitor = value => finish(null, value);
            const lost = error => finish(error);
            const timer = setTimeout(() => finish(new SparkError('SPARK_MONITOR_TIMEOUT')), timeout);
            this.on('monitor', monitor);
            this.on('lost', lost);
        });
    }
    async close () {
        if (this.closed) return;
        this.closed = true;
        this.fault(new SparkError('SPARK_DISCONNECTED'));
        this.transport.removeListener('data', this.data);
        this.transport.removeListener('fault', this.fault);
        this.transport.removeListener('closed', this.disconnected);
        this.parser.removeAllListeners();
        await firmwareBounded(this.transport.close(), this.timeouts.close, 'SPARK_DISCONNECTED').catch(() => {});
    }
}
