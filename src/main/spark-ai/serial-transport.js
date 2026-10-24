import {EventEmitter} from 'events';
import {SparkError} from './protocol';
import {sortSparkPorts} from './discovery';
// Loading another hardware adapter must not load serial drivers into EST's HID path.
const serialPort = () => require('serialport').SerialPort; // eslint-disable-line global-require

export const listSparkSerialPorts = async () => sortSparkPorts((await serialPort().list()).map(port => ({
    path: String(port.path).slice(0, 256),
    manufacturer: String(port.manufacturer || '').slice(0, 100),
    friendlyName: String(port.friendlyName || '').slice(0, 100),
    vendorId: String(port.vendorId || '').slice(0, 4),
    productId: String(port.productId || '').slice(0, 4),
    serialNumber: String(port.serialNumber || '').slice(0, 256),
    pnpId: String(port.pnpId || '').slice(0, 512)
})));

export class SparkSerialTransport extends EventEmitter {
    constructor (portPath) {
        super();
        const SerialPort = serialPort();
        this.port = new SerialPort({path: portPath, baudRate: 115200, autoOpen: false});
        this.port.on('data', bytes => this.emit('data', bytes));
        this.port.on('error', error => this.emit('fault', new SparkError('SPARK_SERIAL_ERROR', error.message)));
        this.port.on('close', () => this.emit('closed'));
    }
    open () {
        this.opening = new Promise((resolve, reject) => this.port.open(error => {
            if (error) {
                reject(new SparkError('SPARK_SERIAL_ERROR', error.message)); return;
            }
            if (this.closed) {
                this.port.close(() => reject(new SparkError('SPARK_DISCONNECTED')));
            } else resolve();
        }));
        return this.opening;
    }
    write (bytes) {
        if (!this.port.isOpen) return Promise.reject(new SparkError('SPARK_DISCONNECTED'));
        return new Promise((resolve, reject) => this.port.write(bytes, error => {
            if (error) {
                reject(new SparkError('SPARK_SERIAL_ERROR', error.message)); return;
            }
            this.port.drain(drainError => (drainError ?
                reject(new SparkError('SPARK_SERIAL_ERROR', drainError.message)) : resolve()));
        }));
    }
    async close () {
        this.closed = true;
        if (this.opening) await this.opening.catch(() => {});
        if (!this.port.isOpen) return;
        await new Promise(resolve => this.port.close(() => resolve()));
    }
}
