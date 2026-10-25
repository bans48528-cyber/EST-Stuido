export class HardwareBleDriver {
    constructor ({bluetooth, emit, service, characteristic, namePrefixes, errorPrefix, disconnectSettleMs = 0}) {
        this.service = service;
        this.characteristic = characteristic;
        this.namePrefixes = namePrefixes;
        this.errorPrefix = errorPrefix;
        this.bluetooth = bluetooth;
        this.emit = emit;
        this.disconnectSettleMs = disconnectSettleMs;
    }
    code (suffix) {
        return `${this.errorPrefix}${suffix}`;
    }
    async choose () {
        if (!this.bluetooth) throw new Error(this.code('BLE_UNAVAILABLE'));
        this.cancelChoice();
        const choice = {};
        const cancellation = new Promise((resolve, reject) => {
            choice.cancel = () => reject(new Error(this.code('CANCELLED')));
        });
        this.choice = choice;
        try {
            // Service filtering also supports renamed devices; names cover older advertisements.
            const device = await Promise.race([cancellation, this.bluetooth.requestDevice({filters: [
                {services: [this.service]}, ...this.namePrefixes.map(namePrefix => ({namePrefix}))
            ],
            optionalServices: [this.service]})]);
            if (this.choice !== choice) throw new Error(this.code('CANCELLED'));
            this.device = device;
            return this.device.id;
        } catch (error) {
            throw new Error(error.name === 'NotFoundError' || error.message === this.code('CANCELLED') ?
                this.code('CANCELLED') : this.code('BLE_UNAVAILABLE'));
        } finally {
            if (this.choice === choice) this.choice = null;
        }
    }
    cancelChoice () {
        if (this.choice) this.choice.cancel();
        this.choice = null;
    }
    assertCurrent (context) {
        if (this.context !== context || context.closed) throw new Error(this.code('DISCONNECTED'));
    }
    close (session) {
        const context = this.context;
        if (!context || (session && context.session !== session)) return this.closing || Promise.resolve();
        context.closed = true;
        this.context = null;
        if (context.characteristic) {
            context.characteristic.removeEventListener('characteristicvaluechanged', context.notify);
        }
        context.device.removeEventListener('gattserverdisconnected', context.lost);
        // Windows may deliver disconnection after disconnect() returns. Wait
        // before reusing the same BluetoothDevice, or that event kills the new session.
        this.closing = new Promise(resolve => {
            let timer;
            const done = () => {
                clearTimeout(timer);
                context.device.removeEventListener('gattserverdisconnected', done);
                resolve();
            };
            if (context.device.gatt.connected) {
                context.device.addEventListener('gattserverdisconnected', done);
                timer = setTimeout(done, 1800);
            }
            context.device.gatt.disconnect();
            if (!timer) done();
        });
        // Windows can acknowledge the local disconnect before the radio link
        // releases (observed ~3s). Avoid reconnecting to that cached connection.
        if (this.disconnectSettleMs) {
            this.closing = Promise.all([this.closing,
                new Promise(resolve => setTimeout(resolve, this.disconnectSettleMs))]);
        }
        return this.closing;
    }
    async open (session, id) {
        if (!this.device || this.device.id !== id) throw new Error(this.code('BLE_CONNECT'));
        await this.close();
        const context = {session, device: this.device};
        this.context = context;
        context.lost = () => {
            // A cached Windows device may dispatch an old disconnect while a
            // new connect() is pending. That promise owns connection failure.
            if (this.context !== context || !context.connected) return;
            this.close(session);
            this.emit({session, closed: true});
        };
        context.notify = event => {
            if (this.context !== context) return;
            const value = event.target.value;
            this.emit({session, bytes: new Uint8Array(value.buffer, value.byteOffset, value.byteLength).slice()});
        };
        context.device.addEventListener('gattserverdisconnected', context.lost);
        try {
            const server = await context.device.gatt.connect();
            if (context.closed) {
                server.disconnect(); throw new Error(this.code('DISCONNECTED'));
            }
            this.assertCurrent(context);
            context.connected = true;
            const service = await server.getPrimaryService(this.service);
            this.assertCurrent(context);
            const characteristic = await service.getCharacteristic(this.characteristic);
            this.assertCurrent(context);
            if (!characteristic.properties.notify ||
                (!characteristic.properties.writeWithoutResponse && !characteristic.properties.write)) {
                throw new Error(this.code('BLE_SERVICE'));
            }
            context.characteristic = characteristic;
            characteristic.addEventListener('characteristicvaluechanged', context.notify);
            await characteristic.startNotifications();
            this.assertCurrent(context);
        } catch (error) {
            this.close(session);
            throw new Error(error.name === 'NotFoundError' ? this.code('BLE_SERVICE') :
                (error.message.startsWith(this.errorPrefix) ? error.message : this.code('BLE_CONNECT')));
        }
    }
    async write (session, bytes) {
        const context = this.context;
        if (!context || context.session !== session || !context.characteristic) {
            throw new Error(this.code('DISCONNECTED'));
        }
        if (context.writing || !(bytes instanceof Uint8Array) || !bytes.length || bytes.length > 255) {
            throw new Error(this.code('BLE_WRITE'));
        }
        context.writing = true;
        try {
            const characteristic = context.characteristic;
            for (let offset = 0; offset < bytes.length; offset += 20) {
                this.assertCurrent(context);
                const piece = bytes.slice(offset, offset + 20);
                if (characteristic.properties.writeWithoutResponse) {
                    await characteristic.writeValueWithoutResponse(piece);
                } else await characteristic.writeValueWithResponse(piece);
            }
            this.assertCurrent(context);
        } catch (error) {
            this.close(session);
            this.emit({session, closed: true});
            throw new Error(this.code('BLE_WRITE'));
        } finally {
            context.writing = false;
        }
    }
}
