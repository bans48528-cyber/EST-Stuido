import {EventEmitter} from 'events';

// The main process owns the protocol; the renderer owns Chromium's GATT objects.
export class HardwareBleBridge {
    constructor ({allowed, channelPrefix, errorPrefix, ErrorType, scanTimeout = 30000, requestTimeout = 15000}) {
        this.channelPrefix = channelPrefix;
        this.errorPrefix = errorPrefix;
        this.ErrorType = ErrorType;
        this.allowed = allowed;
        this.scanTimeout = scanTimeout;
        this.requestTimeout = requestTimeout;
        this.sequence = 0;
        this.pending = new Map();
        this.devices = new Map();
    }
    code (suffix) {
        return `${this.errorPrefix}${suffix}`;
    }
    channel (suffix) {
        return `${this.channelPrefix}-ble-${suffix}`;
    }
    attach (contents) {
        this.contents = contents;
        contents.on('select-bluetooth-device', (event, devices, callback) => {
            if (!this.allowed()) return;
            event.preventDefault();
            if (!this.scanning || !this.allowed()) {
                callback(''); return;
            }
            this.selection = callback;
            for (const device of devices) {
                this.devices.set(device.deviceId, {id: device.deviceId, name: device.deviceName || device.deviceId});
            }
            if (this.autoTarget && this.devices.has(this.autoTarget)) {
                this.select(this.autoTarget); return;
            }
            this.publishScan();
        });
        contents.on('render-process-gone', () => this.reset());
        contents.on('destroyed', () => this.reset());
        contents.on('did-start-navigation', (event, url, inPlace, mainFrame) => {
            if (mainFrame && !inPlace) this.reset();
        });
    }
    send (channel, value) {
        if (this.contents && !this.contents.isDestroyed()) this.contents.send(channel, value);
    }
    publishScan () {
        this.send(this.channel('scan-state'), {scanning: Boolean(this.scanning),
            cancelled: !this.scanning && !this.authorized,
            devices: [...this.devices.values()]});
    }
    beginScan (autoTarget = null) {
        if (!this.allowed() || this.active) throw new this.ErrorType(this.code('BUSY'));
        // Do not publish a cancellation for the new request: IPC events can be
        // delivered after invoke() resolves and would cancel the new chooser.
        this.cancelScan(false);
        this.authorized = null;
        this.devices.clear();
        this.autoTarget = autoTarget;
        this.scanning = true;
        this.scanTimer = setTimeout(() => this.cancelScan(), autoTarget ? Math.min(this.scanTimeout, 10000) :
            this.scanTimeout);
        this.publishScan();
    }
    select (id) {
        if (!this.allowed() || !this.scanning || !this.selection || !this.devices.has(id) ||
            (this.autoTarget && this.autoTarget !== id)) {
            throw new this.ErrorType(this.code('BLE_DEVICE_INVALID'));
        }
        const callback = this.selection;
        this.authorized = this.devices.get(id);
        this.selection = null;
        this.scanning = false;
        clearTimeout(this.scanTimer);
        this.publishScan();
        callback(id);
    }
    cancelScan (publish = true) {
        const callback = this.selection;
        this.selection = null;
        this.scanning = false;
        this.authorized = null;
        this.autoTarget = null;
        clearTimeout(this.scanTimer);
        for (const [id, pending] of this.pending) {
            if (pending.session !== 0) continue;
            clearTimeout(pending.timer);
            this.pending.delete(id);
            pending.reject(new this.ErrorType(this.code('CANCELLED')));
        }
        if (callback) callback('');
        if (publish) this.publishScan();
    }
    bindDevice (id) {
        // Chromium exposes an opaque id, distinct from Electron's chooser (MAC) id.
        if (!this.allowed() || !this.authorized || this.scanning || this.active ||
            typeof id !== 'string' || !id.length || id.length > 256) {
            throw new this.ErrorType(this.code('BLE_DEVICE_INVALID'));
        }
        this.authorized.gattId = id;
    }
    getIdentity (id) {
        return this.authorized && this.authorized.gattId === id ?
            {id: this.authorized.id, name: this.authorized.name} : null;
    }
    async reconnectDevice (identity) {
        if (!this.ready) throw new this.ErrorType(this.code('BLE_UNAVAILABLE'));
        this.beginScan(identity.id);
        const id = await this.request(0, 'choose');
        this.bindDevice(id);
        // Windows can briefly report a localized "unknown device" name while
        // restoring the same address. Keep the last user-selected display name.
        this.authorized.name = identity.name;
        return id;
    }
    request (session, action, data) {
        const id = ++this.sequence;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                // Never allow a timed-out GATT write to continue in the background.
                if (this.active && this.active.session === session) {
                    const active = this.active;
                    this.release(active);
                    active.emit('fault', new this.ErrorType(this.code('BLE_TIMEOUT')));
                }
                reject(new this.ErrorType(this.code('BLE_TIMEOUT')));
            }, Math.min(this.requestTimeout, action === 'write' ? 4000 : (action === 'close' ? 5000 : 15000)));
            this.pending.set(id, {session, resolve, reject, timer});
            const message = {id, session, action, data};
            if (action === 'choose') {
                // The remembered, user-selected device is re-authorized by a fresh
                // chooser event. Electron 15 cannot persist Web Bluetooth grants.
                this.contents.executeJavaScript(`window.dispatchEvent(new CustomEvent('${this.channel('choose')}',
                    {detail: ${JSON.stringify(message)}}))`, true)
                    .catch(() => this.reply({...message, error: this.code('BLE_UNAVAILABLE')}));
            } else this.send(this.channel('request'), message);
        });
    }
    reply (message) {
        if (!message) return;
        const pending = this.pending.get(message.id);
        if (!pending || pending.session !== message.session) return;
        this.pending.delete(message.id);
        clearTimeout(pending.timer);
        if (message.error) {
            const code = [this.code('BLE_UNAVAILABLE'), this.code('BLE_SERVICE'), this.code('BLE_CONNECT'),
                this.code('BLE_WRITE'), this.code('DISCONNECTED'), this.code('CANCELLED')].includes(message.error) ?
                message.error : this.code('BLE_CONNECT');
            pending.reject(new this.ErrorType(code));
        } else pending.resolve(message.data);
    }
    receive (message) {
        const active = this.active;
        if (!message || !active || message.session !== active.session) return;
        if (message.closed) {
            this.release(active);
            active.emit('closed');
        } else if (message.bytes instanceof Uint8Array && message.bytes.length <= 4096) {
            active.emit('data', Buffer.from(message.bytes));
        }
    }
    release (transport) {
        if (this.active === transport) this.active = null;
        for (const [id, pending] of this.pending) {
            if (pending.session !== transport.session) continue;
            clearTimeout(pending.timer);
            this.pending.delete(id);
            pending.reject(new this.ErrorType(this.code('DISCONNECTED')));
        }
        this.send(this.channel('abort'), {session: transport.session});
    }
    createTransport (id) {
        if (!this.allowed() || !this.authorized || this.authorized.gattId !== id || this.active) {
            throw new this.ErrorType(this.code('BLE_DEVICE_INVALID'));
        }
        const transport = new EventEmitter();
        transport.session = ++this.sequence;
        const request = (action, data) => {
            if (this.active !== transport) return Promise.reject(new this.ErrorType(this.code('DISCONNECTED')));
            return this.request(transport.session, action, data);
        };
        transport.open = () => request('open', {id});
        transport.write = bytes => request('write', new Uint8Array(bytes));
        transport.close = () => {
            this.release(transport);
            return this.request(transport.session, 'close');
        };
        this.active = transport;
        return transport;
    }
    reset () {
        this.ready = false;
        this.cancelScan();
        this.authorized = null;
        if (this.active) {
            const active = this.active;
            this.release(active);
            active.emit('closed');
        }
    }
}
