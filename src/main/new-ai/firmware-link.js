import {EventEmitter} from 'events';
import {NewAiError, NewAiStreamParser, newAiFrame} from './protocol';

export const newAiFirmwareDelay = ms => new Promise(resolve => setTimeout(resolve, ms));
export const newAiFirmwareBounded = (promise, ms, code) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new NewAiError(code)), ms);
    Promise.resolve(promise).then(value => {
        clearTimeout(timer); resolve(value);
    }, error => {
        clearTimeout(timer); reject(error);
    });
});

// Boot1 is a distinct receiver, with reversed response addresses and a 500 ms inter-file boot timer.
// There are no offsets/request IDs: never retry a frame after an uncertain acknowledgement.
export class NewAiFirmwareLink extends EventEmitter {
    constructor (transport, {ack = 5000, write = 5000, open = 6000, close = 2500, gap = 400} = {}) {
        super();
        this.transport = transport;
        this.timeouts = {ack, write, open, close, gap};
        this.parser = new NewAiStreamParser();
        this.data = bytes => {
            if (!this.closed) this.parser.push(bytes);
        };
        this.fail = error => {
            this.failure = error || new NewAiError('NEW_DISCONNECTED');
            if (this.pending) this.pending.reject(this.failure);
            this.emit('lost', this.failure);
        };
        this.lost = () => this.fail(new NewAiError('NEW_DISCONNECTED'));
        transport.on('data', this.data);
        transport.on('fault', this.fail);
        transport.on('closed', this.lost);
        this.parser.on('monitor', monitor => {
            this.monitor = monitor; this.emit('monitor', monitor);
        });
        this.parser.on('other-device', () => this.fail(new NewAiError('NEW_WRONG_DEVICE')));
        this.parser.on('fault', error => this.fail(error));
        this.parser.on('frame', ({command, payload}) => {
            if (!this.pending) return;
            if (command === 0xFE) this.pending.reject(new NewAiError('NEW_DEVICE_ERROR'));
            else if (command === 0xFD) {
                if (payload.length !== 1 || payload[0] !== 1) {
                    this.pending.reject(new NewAiError('NEW_ACK_INVALID'));
                } else {
                    this.lastAck = Date.now(); this.pending.resolve();
                }
            }
        });
    }
    async open ({alreadyOpen = false} = {}) {
        if (!alreadyOpen) {
            await newAiFirmwareBounded(this.transport.open(), this.timeouts.open, 'NEW_OPEN_TIMEOUT');
        }
        if (this.failure) throw this.failure;
    }
    prepareBootTransfer () {
        // The last APP report can precede RESET_FWLIB on an unchanged USB handle.
        // Only discard that cached report after the original application's boot delay.
        this.monitor = null;
        this.parser.pending = '';
        this.parser.buffer = Buffer.alloc(0);
    }
    async send (command, payload) {
        if (this.closed || this.failure) throw this.failure || new NewAiError('NEW_DISCONNECTED');
        // Legacy firmware can keep streaming its device envelope during resource reception.
        // The original updater advances by file ACKs, not by disappearance of that envelope.
        if (this.monitor && !this.monitor.legacyProtocol) throw new NewAiError('NEW_FW_BOOT_REQUIRED');
        if (this.pending) throw new NewAiError('NEW_BUSY');
        if (this.lastCommand === 0xBB && Date.now() - this.lastAck > this.timeouts.gap) {
            throw new NewAiError('NEW_FW_GAP');
        }
        let pending;
        const acknowledgement = new Promise((resolve, reject) => {
            const wait = {};
            const finish = error => {
                if (this.pending !== pending) return;
                clearTimeout(wait.timer); this.pending = null;
                if (error) reject(error); else resolve();
            };
            wait.timer = setTimeout(() => finish(new NewAiError('NEW_ACK_TIMEOUT')), this.timeouts.ack);
            pending = {resolve: () => finish(), reject: finish};
            this.pending = pending;
        });
        try {
            await Promise.all([acknowledgement, newAiFirmwareBounded(Promise.resolve().then(() => {
                if (this.failure || this.closed) throw this.failure || new NewAiError('NEW_DISCONNECTED');
                if (this.monitor && !this.monitor.legacyProtocol) throw new NewAiError('NEW_FW_BOOT_REQUIRED');
                return this.transport.write(newAiFrame(command, payload));
            }), this.timeouts.write, 'NEW_WRITE_TIMEOUT')]);
            this.lastCommand = command;
        } catch (error) {
            if (this.pending === pending) pending.reject(error);
            throw error;
        }
    }
    waitForMonitor (timeout, accept = () => true) {
        if (this.monitor && accept(this.monitor)) return Promise.resolve(this.monitor);
        if (this.failure || this.closed) return Promise.reject(this.failure || new NewAiError('NEW_DISCONNECTED'));
        return new Promise((resolve, reject) => {
            const wait = {};
            const finish = (error, value) => {
                clearTimeout(wait.timer);
                this.removeListener('monitor', wait.monitor); this.removeListener('lost', wait.lost);
                if (error) reject(error); else resolve(value);
            };
            wait.monitor = value => {
                if (accept(value)) finish(null, value);
            };
            wait.lost = error => finish(error);
            wait.timer = setTimeout(() => finish(new NewAiError('NEW_MONITOR_TIMEOUT')), timeout);
            this.on('monitor', wait.monitor); this.on('lost', wait.lost);
        });
    }
    async close () {
        if (this.closed) return;
        this.closed = true;
        this.fail(new NewAiError('NEW_DISCONNECTED'));
        this.transport.removeListener('data', this.data);
        this.transport.removeListener('fault', this.fail);
        this.transport.removeListener('closed', this.lost);
        this.parser.removeAllListeners();
        await newAiFirmwareBounded(this.transport.close(), this.timeouts.close, 'NEW_CLOSE_TIMEOUT').catch(() => {});
    }
}
