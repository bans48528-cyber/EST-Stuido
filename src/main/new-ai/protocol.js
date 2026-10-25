import {EventEmitter} from 'events';
import {StringDecoder} from 'string_decoder';

export class NewAiError extends Error {
    constructor (code) {
        super(code);
        this.code = code;
    }
}
const numeric = value => {
    if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
};
const text = value => (typeof value === 'string' ? value.slice(0, 120) : null);
export const NEW_RESOURCE_VERSION = 321;
export const NEW_PROGRAM_LIMIT = 32768;
export const NEW_COMMAND = Object.freeze({FILE: 0xDA,
    DATA: 0xAA,
    SAVE: 0xBB,
    SAVE_RUN: 0xBC,
    STOP_TOGGLE: 0xB9,
    ACK: 0xFD,
    ERROR: 0xFE});
const HEADER = Buffer.from([0x5A, 0x97, 0x98]);
export const newAiFrame = (command, payload = []) => {
    const bytes = Buffer.from(payload);
    if (!Number.isInteger(command) || command < 0 || command > 255 || bytes.length > 255) {
        throw new NewAiError('NEW_FRAME_INVALID');
    }
    const frame = Buffer.alloc(bytes.length + 7);
    HEADER.copy(frame); frame[3] = bytes.length; frame[4] = command; bytes.copy(frame, 5);
    frame[frame.length - 2] = frame.subarray(0, -2).reduce((sum, value) => (sum + value) & 255, 0);
    frame[frame.length - 1] = 0xA5;
    return frame;
};
export const validateNewAiBytecode = bytes => {
    if (!Buffer.isBuffer(bytes) || bytes.length < 17 || bytes.length >= NEW_PROGRAM_LIMIT) {
        throw new NewAiError('NEW_PROGRAM_SIZE');
    }
    if (!bytes.subarray(0, 4).equals(Buffer.from([15, 112, 121, 111])) ||
        bytes.readUInt32LE(4) !== bytes.length - 8) throw new NewAiError('NEW_BYTECODE_INVALID');
    const instructions = bytes.readUInt32LE(8);
    if (instructions % 4 || instructions + 16 >= bytes.length) throw new NewAiError('NEW_BYTECODE_INVALID');
    const constants = bytes.readUInt32LE(12 + instructions);
    if (16 + instructions + constants !== bytes.length || bytes[16 + instructions] !== 0 ||
        bytes[bytes.length - 1] !== 0) throw new NewAiError('NEW_BYTECODE_INVALID');
    return {size: bytes.length, instructions, constants};
};
export const newAiDownloadFrames = (bytes, slot, run = false, chunk = 248) => {
    if (![128, 248].includes(chunk)) throw new NewAiError('NEW_REQUEST_INVALID');
    if (typeof run !== 'boolean') throw new NewAiError('NEW_REQUEST_INVALID');
    if (!Number.isInteger(slot) || slot < 0 || slot > 19) throw new NewAiError('NEW_SLOT_INVALID');
    validateNewAiBytecode(bytes);
    const frames = [{command: NEW_COMMAND.FILE, payload: Buffer.from(`${slot}.o`, 'ascii'), bytes: 0}];
    for (let offset = 0; offset < bytes.length; offset += chunk) {
        const payload = bytes.subarray(offset, offset + chunk);
        frames.push({command: offset + payload.length === bytes.length ?
            (run ? NEW_COMMAND.SAVE_RUN : NEW_COMMAND.SAVE) : NEW_COMMAND.DATA,
        payload,
        bytes: offset + payload.length});
    }
    return frames;
};
const SENSOR_TYPES = ['big_motor', 'small_motor', 'color', 'ultrasion', 'touch', 'gray', 'gray_v2',
    'nfc', 'camera', 'ir_remote', 'elect_sensor', 'dev null'];
const cameraTargets = values => (Array.isArray(values) ? values.slice(0, 16)
    .filter(value => value && typeof value === 'object' && !Array.isArray(value))
    .map(value => {
        const target = Object.fromEntries(['id', 'x', 'y', 'w', 'h', 'conf']
            .filter(key => Object.prototype.hasOwnProperty.call(value, key) && numeric(value[key]) !== null)
            .map(key => [key, numeric(value[key])]));
        if (typeof value.name === 'string') target.name = value.name.slice(0, 250);
        const learned = typeof value.learned === 'boolean' ? Number(value.learned) : numeric(value.learned);
        if (learned === 0 || learned === 1) target.learned = learned;
        return target;
    }) : []);
// Captured from the user's 214 device. This fingerprint permits identification/upgrading only.
// The legacy report has no trustworthy program running/stopped flag or battery percentage.
export const normalizeNewAiLegacyMonitor = (message, timestamp = Date.now()) => {
    if (!message || !Array.isArray(message.deviceList) || message.deviceList.length !== 8 ||
        !message.versionlist || message.versionlist.ver !== 214 ||
        !message.estlist || typeof message.estlist.est !== 'string' ||
        !message.gyrolist || !message.adclist || !message.flashlist || !message.remotelist ||
        'NewAiState' in message || 'WillAiState' in message) return null;
    const indices = message.deviceList.map(item => item && numeric(item.port));
    if (indices.some(port => !Number.isInteger(port) || port < 0 || port > 7) ||
        new Set(indices).size !== 8) return null;
    return {version: 214,
        timestamp,
        legacyProtocol: true,
        running: null,
        battery: null,
        ports: indices.sort((a, b) => a - b).map(port => ({port,
            label: 'ABCDEFGH'[port],
            type: 'unknown',
            values: {}})),
        imu: {yaw: numeric(message.gyrolist.yaw),
            pitch: numeric(message.gyrolist.pitch),
            roll: numeric(message.gyrolist.roll)}};
};
export const normalizeNewAiMonitor = (message, timestamp = Date.now()) => {
    if (!message || !Array.isArray(message.deviceList) || message.deviceList.length !== 8 ||
        !['run', 'stop'].includes(message.NewAiState) || 'WillAiState' in message) return null;
    const version = numeric(message.version);
    if (!Number.isInteger(version) || version < 0 || version > 65535) return null;
    const seen = new Set();
    const ports = [];
    for (const item of message.deviceList) {
        if (!item || !Number.isInteger(item.port) || item.port < 0 || item.port > 7 || seen.has(item.port)) return null;
        seen.add(item.port);
        const type = SENSOR_TYPES.find(key => item[key] && typeof item[key] === 'object' &&
            !Array.isArray(item[key])) || 'none';
        const values = Object.fromEntries(Object.entries(item[type] || {}).slice(0, 64)
            .filter(([key, value]) => !['__proto__', 'constructor', 'prototype'].includes(key) &&
                ['number', 'string', 'boolean'].includes(typeof value))
            .map(([key, value]) => [key.slice(0, 80), typeof value === 'string' ? value.slice(0, 120) : value]));
        if (type === 'camera' && Array.isArray(item.camera.configs)) {
            values.configs = cameraTargets(item.camera.configs);
            values.targetCount = item.camera.configs.length;
        }
        ports.push({port: item.port, label: 'ABCDEFGH'[item.port], type, values});
    }
    const battery = numeric(message.bat);
    return {version,
        timestamp,
        running: message.NewAiState === 'run',
        ports: ports.sort((a, b) => a.port - b.port),
        battery: battery !== null && battery >= 0 && battery <= 100 ? battery : null,
        flash: {total: text(message.flash && message.flash.total), free: text(message.flash && message.flash.free)},
        imu: {yaw: numeric(message.mem && message.mem.yaw),
            pitch: numeric(message.mem && message.mem.pitch),
            roll: numeric(message.mem && message.mem.roll)},
        heap: numeric(message.heap),
        sound: numeric(message.voic)};
};

// The APP automatically streams one JSON object per CRLF. No query/control frame is required.
export class NewAiMonitorParser extends EventEmitter {
    constructor ({recoverBleMonitor = false} = {}) {
        super();
        this.recoverBleMonitor = recoverBleMonitor;
        this.decoder = new StringDecoder('utf8');
        this.pending = '';
        this.discarding = false;
    }
    report (line) {
        try {
            const message = JSON.parse(line);
            const monitor = normalizeNewAiMonitor(message) || normalizeNewAiLegacyMonitor(message);
            if (monitor) {
                this.emit('monitor', monitor); return true;
            } else if (message && Array.isArray(message.deviceList) && message.deviceList.length === 4 &&
                ['run', 'stop'].includes(message.WillAiState)) {
                this.emit('other-device'); return true;
            }
        } catch (error) { /* Debug output and incomplete objects are not device state. */ }
        return false;
    }
    pushBle (bytes) {
        this.pending += this.decoder.write(Buffer.from(bytes));
        if (this.pending.length > 16384) this.pending = this.pending.slice(-16384);
        while (this.pending.length) {
            const start = this.pending.indexOf('{');
            if (start < 0) {
                this.pending = ''; return;
            }
            this.pending = this.pending.slice(start);
            let depth = 0; let quoted = false; let escaped = false; let end = -1;
            for (let index = 0; index < this.pending.length; index++) {
                const char = this.pending[index];
                if (quoted) {
                    if (escaped) escaped = false;
                    else if (char === '\\') escaped = true;
                    else if (char === '"') quoted = false;
                } else if (char === '"') quoted = true;
                else if (char === '{') depth++;
                else if (char === '}' && --depth === 0) {
                    end = index + 1; break;
                }
            }
            if (end < 0) {
                // A lost BLE fragment may contain the tail/newline. Only restart at a new full envelope.
                const next = this.pending.slice(1).search(/\{\s*"deviceList"\s*:/);
                if (next < 0) return;
                this.pending = this.pending.slice(next + 1); continue;
            }
            if (!this.report(this.pending.slice(0, end))) {
                const next = this.pending.slice(1).search(/\{\s*"deviceList"\s*:/);
                if (next >= 0) {
                    this.pending = this.pending.slice(next + 1); continue;
                }
            }
            this.pending = this.pending.slice(end);
        }
    }
    push (bytes) {
        if (!bytes || !bytes.length) return;
        if (bytes.length > 65536) {
            this.pending = '';
            this.decoder = new StringDecoder('utf8');
            this.discarding = true;
            return;
        }
        if (this.recoverBleMonitor) {
            this.pushBle(bytes); return;
        }
        const chunks = this.decoder.write(Buffer.from(bytes)).split('\n');
        chunks.forEach((chunk, index) => {
            if (!this.discarding) this.pending += chunk;
            if (this.pending.length > 16384) {
                this.pending = '';
                this.discarding = true;
            }
            if (index === chunks.length - 1) return;
            const line = this.pending;
            this.pending = '';
            if (this.discarding) {
                this.discarding = false;
                return;
            }
            const start = line.indexOf('{');
            if (start < 0) return;
            this.report(line.slice(start).trim());
        });
    }
}

// Boot1 replies reverse the source/destination addresses: 5A 98 97 (outgoing remains 5A 97 98).
const RESPONSE_HEADER = Buffer.from([0x5A, 0x98, 0x97]);
const HEADERS = [HEADER, RESPONSE_HEADER];
// Demultiplex USB binary ACKs and JSON before decoding text; binary payloads may contain LF or '{'.
export class NewAiStreamParser extends NewAiMonitorParser {
    constructor (options) {
        super(options); this.buffer = Buffer.alloc(0);
    }
    push (bytes) {
        if (!bytes || !bytes.length) return;
        if (bytes.length > 65536) {
            this.buffer = Buffer.alloc(0); this.pending = ''; this.discarding = true;
            this.emit('fault', new NewAiError('NEW_FRAME_INVALID')); return;
        }
        this.buffer = Buffer.concat([this.buffer, Buffer.from(bytes)]);
        while (this.buffer.length) {
            if (this.buffer.length < 3 && HEADERS.some(h =>
                this.buffer.equals(h.subarray(0, this.buffer.length)))) return;
            if (HEADERS.some(h => this.buffer.subarray(0, 3).equals(h))) {
                if (this.buffer.length < 4) return;
                const size = this.buffer[3] + 7;
                if (this.buffer.length < size) return;
                const frame = this.buffer.subarray(0, size);
                const checksum = frame.subarray(0, -2).reduce((sum, value) => (sum + value) & 255, 0);
                if (frame[size - 1] !== 0xA5 || frame[size - 2] !== checksum) {
                    this.emit('fault', new NewAiError('NEW_FRAME_INVALID'));
                    this.buffer = this.buffer.subarray(1); continue;
                }
                this.buffer = this.buffer.subarray(size);
                this.emit('frame', {command: frame[4], payload: Buffer.from(frame.subarray(5, -2))});
                continue;
            }
            const positions = HEADERS.map(h => this.buffer.indexOf(h)).filter(index => index >= 0);
            const header = positions.length ? Math.min(...positions) : -1;
            let size = header >= 0 ? header : this.buffer.length;
            if (header < 0) {
                for (const tail of [2, 1]) {
                    if (this.buffer.length >= tail && HEADERS.some(h =>
                        this.buffer.subarray(-tail).equals(h.subarray(0, tail)))) {
                        size -= tail; break;
                    }
                }
            }
            if (!size) return;
            super.push(this.buffer.subarray(0, size));
            this.buffer = this.buffer.subarray(size);
        }
    }
}
