import {EventEmitter} from 'events';

export const SPARK_COMMAND = Object.freeze({FILE: 0xDA,
    DATA: 0xAA,
    SAVE: 0xBB,
    RUN: 0xBC,
    STOP: 0xB9,
    MONITOR_ON: 0xBA,
    MONITOR_OFF: 0xBE,
    ACK: 0xFD});
export const SPARK_PROGRAM_LIMIT = 32768;
export const SPARK_USB_CHUNK = 248;
export const SPARK_VERIFIED_FIRMWARE = 111;
const HEADER = Buffer.from([0x5A, 0x97, 0x98]);
const MAX_TEXT = 16384;

export class SparkError extends Error {
    constructor (code, detail = '') {
        super(detail ? `${code}: ${detail}` : code);
        this.code = code;
    }
}

export const sparkFrame = (command, payload = Buffer.alloc(0)) => {
    const data = Buffer.from(payload);
    if (!Number.isInteger(command) || command < 0 || command > 255 || data.length > 255) {
        throw new SparkError('SPARK_FRAME_INVALID');
    }
    const frame = Buffer.alloc(data.length + 7);
    HEADER.copy(frame);
    frame[3] = data.length;
    frame[4] = command;
    data.copy(frame, 5);
    frame[frame.length - 2] = frame.subarray(0, -2).reduce((sum, byte) => (sum + byte) & 255, 0);
    frame[frame.length - 1] = 0xA5;
    return frame;
};

export const sparkDownloadFrames = (bytes, slot, run = false, chunkSize = SPARK_USB_CHUNK) => {
    if (!Number.isInteger(slot) || slot < 0 || slot > 9) throw new SparkError('SPARK_SLOT_INVALID');
    if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length >= SPARK_PROGRAM_LIMIT ||
        !Number.isInteger(chunkSize) || chunkSize < 1 || chunkSize > SPARK_USB_CHUNK) {
        throw new SparkError('SPARK_PROGRAM_SIZE');
    }
    const frames = [{command: SPARK_COMMAND.FILE, payload: Buffer.from(`${slot}.o`, 'ascii'), bytes: 0}];
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        const payload = bytes.subarray(offset, offset + chunkSize);
        const last = offset + payload.length === bytes.length;
        frames.push({command: last ? (run ? SPARK_COMMAND.RUN : SPARK_COMMAND.SAVE) : SPARK_COMMAND.DATA,
            payload,
            bytes: offset + payload.length});
    }
    return frames;
};

export const validateSparkBytecode = bytes => {
    if (!Buffer.isBuffer(bytes) || bytes.length < 17 || bytes.length >= SPARK_PROGRAM_LIMIT) {
        throw new SparkError('SPARK_PROGRAM_SIZE');
    }
    if (!bytes.subarray(0, 4).equals(Buffer.from([0x0F, 0x70, 0x79, 0x6F])) ||
        bytes.readUInt32LE(4) !== bytes.length - 8) throw new SparkError('SPARK_BYTECODE_INVALID');
    const instructions = bytes.readUInt32LE(8);
    if (instructions % 4 || instructions + 16 >= bytes.length) {
        throw new SparkError('SPARK_BYTECODE_INVALID');
    }
    const constants = bytes.readUInt32LE(12 + instructions);
    if (16 + instructions + constants !== bytes.length || bytes[16 + instructions] !== 0 ||
        bytes[bytes.length - 1] !== 0) throw new SparkError('SPARK_BYTECODE_INVALID');
    return {size: bytes.length, instructions, constants};
};

const number = value => {
    if ((typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};
const text = value => (typeof value === 'string' ? value.slice(0, 80) : null);
export const normalizeSparkMonitor = (message, timestamp = Date.now()) => {
    if (!message || typeof message !== 'object' || !Array.isArray(message.deviceList) ||
        message.deviceList.length !== 4 || !Number.isInteger(message.version) ||
        message.version < 0 || message.version > 65535 || !['run', 'stop'].includes(message.WillAiState)) return null;
    const seen = new Set();
    const ports = [];
    for (const item of message.deviceList) {
        if (!item || !Number.isInteger(item.port) || item.port < 0 || item.port > 3 || seen.has(item.port)) return null;
        seen.add(item.port);
        const port = {port: item.port, label: 'ABCD'[item.port], type: 'none', values: {}};
        for (const [type, fields] of Object.entries({color: ['lux', 'state', 'min', 'max', 'threadValue'],
            touch: ['state'],
            ultrasion: ['cm'],
            ir_remote: ['state']})) {
            if (!item[type] || typeof item[type] !== 'object' || Array.isArray(item[type])) continue;
            port.type = type;
            fields.forEach(field => {
                port.values[field] = number(item[type][field]);
            });
            break;
        }
        ports.push(port);
    }
    const battery = message.adc && message.adc.bat;
    const percentage = typeof battery === 'string' && /^\d+(?:\.\d+)?%$/.test(battery.trim()) ?
        Number(battery.trim().slice(0, -1)) : number(battery);
    return {ports: ports.sort((a, b) => a.port - b.port),
        version: message.version,
        running: message.WillAiState === 'run',
        timestamp,
        battery: percentage !== null && percentage >= 0 && percentage <= 100 ? percentage : null,
        flash: {total: text(message.flash && message.flash.total), free: text(message.flash && message.flash.free)},
        heap: number(message.heap)};
};

// Serial callbacks can split any frame or combine ACKs, JSON and script logs.
export class SparkStreamParser extends EventEmitter {
    constructor ({recoverBleMonitor = false} = {}) {
        super();
        this.recoverBleMonitor = recoverBleMonitor;
        this.buffer = Buffer.alloc(0);
        this.line = Buffer.alloc(0);
    }
    appendText (bytes, complete = false) {
        this.line = Buffer.concat([this.line, bytes]);
        if (this.recoverBleMonitor) this.recoverMonitor();
        if (this.line.length > MAX_TEXT) {
            this.emit('log', this.line.subarray(0, MAX_TEXT).toString('utf8'));
            this.line = Buffer.alloc(0);
        }
        if (!complete) return;
        const line = this.line.toString('utf8').replace(/\r$/, '')
            .replace(/\0/g, '')
            .trim();
        this.line = Buffer.alloc(0);
        if (!line) return;
        try {
            const monitor = normalizeSparkMonitor(JSON.parse(line));
            if (monitor) {
                this.emit('monitor', monitor); return;
            }
        } catch (error) { /* Ordinary script output is not a protocol error. */ }
        this.emit('log', line);
    }
    recoverMonitor () {
        // BLE can lose a notification containing the JSON tail/newline. Re-sync
        // only at a new monitor envelope; never invent missing fields or ACKs.
        const start = this.line.lastIndexOf('{"deviceList":');
        if (start < 0) return;
        if (start > 0) {
            const skipped = this.line.subarray(0, start).toString('utf8')
                .trim();
            if (skipped) this.emit('log', skipped);
            this.line = this.line.subarray(start);
        }
        const end = this.line.lastIndexOf(0x7D);
        if (end < 0) return;
        try {
            const monitor = normalizeSparkMonitor(JSON.parse(this.line.subarray(0, end + 1).toString('utf8')));
            if (monitor) {
                this.line = this.line.subarray(end + 1);
                this.emit('monitor', monitor);
            }
        } catch (error) { /* Wait for the rest of this object or the next envelope. */ }
    }
    push (bytes) {
        if (!bytes || !bytes.length) return;
        if (bytes.length > 65536) {
            this.emit('fault', new SparkError('SPARK_FRAME_INVALID', 'receive buffer limit'));
            this.buffer = Buffer.alloc(0);
            this.line = Buffer.alloc(0);
            return;
        }
        this.buffer = Buffer.concat([this.buffer, Buffer.from(bytes)]);
        while (this.buffer.length) {
            if (this.buffer.length < 3 && this.buffer.equals(HEADER.subarray(0, this.buffer.length))) return;
            if (this.buffer.subarray(0, 3).equals(HEADER)) {
                if (this.buffer.length < 4) return;
                const size = this.buffer[3] + 7;
                if (this.buffer.length < size) return;
                const frame = this.buffer.subarray(0, size);
                const sum = frame.subarray(0, -2).reduce((value, byte) => (value + byte) & 255, 0);
                if (frame[size - 1] !== 0xA5 || frame[size - 2] !== sum) {
                    this.emit('fault', new SparkError('SPARK_FRAME_INVALID', 'checksum or tail'));
                    this.buffer = this.buffer.subarray(1);
                    continue;
                }
                this.buffer = this.buffer.subarray(size);
                this.emit('frame', {command: frame[4], payload: Buffer.from(frame.subarray(5, -2))});
                continue;
            }
            const header = this.buffer.indexOf(HEADER);
            const newline = this.buffer.indexOf(10);
            if (newline >= 0 && (header < 0 || newline < header)) {
                this.appendText(this.buffer.subarray(0, newline), true);
                this.buffer = this.buffer.subarray(newline + 1);
            } else if (header > 0) {
                this.appendText(this.buffer.subarray(0, header));
                this.buffer = this.buffer.subarray(header);
            } else {
                let keep = 0;
                for (const count of [1, 2]) {
                    if (this.buffer.subarray(-count).equals(HEADER.subarray(0, count))) keep = count;
                }
                this.appendText(this.buffer.subarray(0, this.buffer.length - keep));
                this.buffer = keep ? this.buffer.subarray(-keep) : Buffer.alloc(0);
                return;
            }
        }
    }
}
