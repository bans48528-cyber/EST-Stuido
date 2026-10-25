import {EventEmitter} from 'events';
import {NewAiError} from './protocol';

const serialPort = () => require('serialport').SerialPort; // eslint-disable-line global-require
const usbId = value => String(value || '').toLowerCase()
    .replace(/^0x/, '')
    .padStart(4, '0');
export const isNewAiUsbCandidate = port => usbId(port.vendorId) === '0483' &&
    usbId(port.productId) === '5740' && !/^BTH/i.test(port.pnpId || '');
export const newAiPortIdentity = port => port && (port.serialNumber ?
    `${usbId(port.vendorId)}:${usbId(port.productId)}:${port.serialNumber}` :
    (/^USB\\/i.test(port.pnpId || '') ? port.pnpId.toUpperCase() : null));
export const listNewAiPorts = async () => (await serialPort().list()).filter(isNewAiUsbCandidate)
    .map(port => Object.fromEntries(['path', 'friendlyName', 'manufacturer', 'vendorId', 'productId',
        'serialNumber', 'pnpId'].map(key => [key, String(port[key] || '').slice(0, 512)])))
    .sort((a, b) => a.path.localeCompare(b.path, 'en', {numeric: true}));

// USB transport is shared by passive identification and serialized program download.
export class NewAiSerialTransport extends EventEmitter {
    constructor (path) {
        super();
        const SerialPort = serialPort();
        this.port = new SerialPort({path, baudRate: 115200, autoOpen: false});
        this.port.on('data', bytes => this.emit('data', bytes));
        this.port.on('error', () => this.emit('fault', new NewAiError('NEW_SERIAL_ERROR')));
        this.port.on('close', () => this.emit('closed'));
    }
    open () {
        this.opening = new Promise((resolve, reject) => this.port.open(error => {
            if (error) return reject(new NewAiError('NEW_SERIAL_ERROR'));
            if (this.closed) return this.port.close(() => reject(new NewAiError('NEW_CANCELLED')));
            resolve();
        }));
        return this.opening;
    }
    write (bytes) {
        if (this.closed || !this.port.isOpen) return Promise.reject(new NewAiError('NEW_DISCONNECTED'));
        return new Promise((resolve, reject) => this.port.write(bytes, error => {
            if (error) {
                reject(new NewAiError('NEW_SERIAL_ERROR')); return;
            }
            this.port.drain(failure => (failure ? reject(new NewAiError('NEW_SERIAL_ERROR')) : resolve()));
        }));
    }
    async close () {
        this.closed = true;
        if (this.opening) await this.opening.catch(() => {});
        if (this.port.isOpen) await new Promise(resolve => this.port.close(() => resolve()));
    }
}
