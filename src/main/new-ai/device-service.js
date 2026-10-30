import {EventEmitter} from 'events';
import {createHash} from 'crypto';
import {NewAiError, NewAiStreamParser, NEW_RESOURCE_VERSION, NEW_COMMAND,
    newAiFrame, newAiDownloadFrames, validateNewAiBytecode} from './protocol';
import {isNewAiUsbCandidate, newAiPortIdentity, listNewAiPorts, NewAiSerialTransport} from './serial-transport';
import {NewAiCompiler} from './compiler';
import {normalizeNewAiConnectionPreferences} from './connection-preferences';
import {NEW_AI_BLE_CHUNK} from '../../common/new-ai-ble';

const bounded = (promise, ms, code) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new NewAiError(code)), ms);
    Promise.resolve(promise).then(value => {
        clearTimeout(timer); resolve(value);
    }, error => {
        clearTimeout(timer); reject(error);
    });
});
export class NewAiDeviceService extends EventEmitter {
    constructor ({listPorts = listNewAiPorts, createTransport = port => new NewAiSerialTransport(port),
        compiler = new NewAiCompiler(), preferences = null, createBleTransport, reconnectBleDevice,
        getBleIdentity, isBleReady = () => false, timeouts = {}} = {}) {
        super();
        this.listPorts = listPorts;
        this.createTransport = createTransport;
        this.compiler = compiler;
        this.preferences = preferences;
        Object.assign(this, {createBleTransport, reconnectBleDevice, getBleIdentity, isBleReady});
        this.timeouts = {open: 3000,
            identify: 2500,
            stale: 3000,
            scan: 2000,
            retry: 10000,
            close: 2000,
            ack: 5000,
            write: 5000,
            fresh: 1000,
            start: 3500,
            stop: 5000,
            bleOpen: 15000,
            bleIdentify: 10000,
            bleClose: 6000,
            bleStale: 6000,
            bleFresh: 2500,
            ...timeouts};
        this.phase = 'disconnected';
        this.epoch = 0;
        this.discoveryEpoch = 0;
        let saved;
        try {
            saved = normalizeNewAiConnectionPreferences(preferences ? preferences.read() : {});
        } catch (error) {
            saved = normalizeNewAiConnectionPreferences();
        }
        this.saved = saved;
        this.connectionMode = saved.mode;
        this.bleDevice = saved.bleDevice;
        this.autoEnabled = saved[this.connectionMode === 'ble' ? 'bleAuto' : 'usbAuto'];
        this.previousDevice = saved.lastDevice;
        this.ports = [];
        this.failures = new Map();
        this.monitorSequence = 0;
        this.runGeneration = 0;
    }
    get pythonProgramActive () {
        return Boolean(this.connected && this.monitor && this.monitor.running);
    }
    get busy () {
        return Boolean(this.firmwareLease || (this.peripheralUpdate && this.peripheralUpdate.active) ||
            this.connecting || this.disconnecting || this.operation ||
            this.bleReconnecting);
    }
    getState () {
        return {state: this.firmwareLease ? 'firmware-updating' : this.phase,
            connected: Boolean(this.connected),
            busy: this.busy,
            identityVerified: Boolean(this.connected && this.monitor),
            programSupported: Boolean(this.connected && this.monitor && this.monitor.version === NEW_RESOURCE_VERSION),
            stopAttemptPending: Boolean(this.monitor && this.monitor.running &&
                this.stopAttemptGeneration === this.runGeneration),
            compilerSupported: Boolean(this.compiler.supported),
            downloadSupported: Boolean(this.connected && this.monitor &&
                this.monitor.version === NEW_RESOURCE_VERSION && this.compiler.supported),
            operation: this.operation ? {...this.operation.progress} : null,
            firmware: this.firmwareState || null,
            peripheralUpdate: this.peripheralUpdate || null,
            connectionRevision: this.epoch,
            result: this.result || null,
            warning: this.downloadInterrupted ? 'NEW_DOWNLOAD_INCOMPLETE' : null,
            port: this.port || null,
            connectionMode: this.connectionMode,
            bleDevice: this.bleDevice,
            reconnecting: Boolean(this.bleReconnecting),
            status: this.monitor || null,
            stale: Boolean(this.monitor && Date.now() - this.monitor.timestamp >
                (this.connectionMode === 'ble' ? this.timeouts.bleStale : this.timeouts.stale)),
            error: this.error || null,
            memoryError: this.memoryError || null,
            discovery: {enabled: this.autoEnabled,
                active: Boolean(this.discoveryActive),
                status: this.discoveryStatus || 'inactive',
                ports: this.ports}};
    }
    saveConnectionPreferences () {
        this.saved = normalizeNewAiConnectionPreferences({...this.saved,
            mode: this.connectionMode,
            [this.connectionMode === 'ble' ? 'bleAuto' : 'usbAuto']: this.autoEnabled,
            lastDevice: this.previousDevice,
            bleDevice: this.bleDevice});
        if (!this.preferences) return;
        try {
            this.preferences.write(this.saved);
            this.memoryError = null;
        } catch (error) {
            // Failure to persist must not interrupt a verified, usable USB connection.
            this.memoryError = 'NEW_CONNECTION_MEMORY_FAILED';
        }
    }
    async setConnectionMode (mode) {
        if (!['usb', 'ble'].includes(mode)) throw new NewAiError('NEW_REQUEST_INVALID');
        if (mode === this.connectionMode) return this.getState();
        if (this.busy || this.shuttingDown) throw new NewAiError('NEW_BUSY');
        if (this.pythonProgramActive) throw new NewAiError('NEW_RUNNING');
        await this.disconnect({pauseAuto: false});
        this.connectionMode = mode;
        this.autoEnabled = this.saved[mode === 'ble' ? 'bleAuto' : 'usbAuto'];
        this.error = null;
        this.failures.clear();
        this.saveConnectionPreferences();
        this.setDiscoveryActive(this.discoveryActive, true);
        return this.getState();
    }
    forgetBleDevice () {
        if (this.busy || this.connected) throw new NewAiError('NEW_BUSY');
        this.bleDevice = null;
        this.failures.clear();
        this.saveConnectionPreferences();
        this.publish();
        return this.getState();
    }
    publish (immediate = true) {
        if (this.shuttingDown) return;
        if (this.publishTimer && !immediate) return;
        clearTimeout(this.publishTimer);
        this.publishTimer = null;
        if (immediate) this.emit('state', this.getState());
        else {
            this.publishTimer = setTimeout(() => {
                this.publishTimer = null;
                this.emit('state', this.getState());
            }, 100);
        }
    }
    listDevices () {
        if (!this.scanPromise) {
            this.scanPromise = bounded(Promise.resolve().then(() => this.listPorts()),
                this.timeouts.open, 'NEW_SCAN_ERROR').then(ports => {
                const candidates = ports.filter(isNewAiUsbCandidate);
                if (JSON.stringify(candidates) !== JSON.stringify(this.ports)) {
                    this.ports = candidates;
                    const present = new Set(candidates.map(port => newAiPortIdentity(port) || port.path));
                    for (const key of this.failures.keys()) if (!present.has(key)) this.failures.delete(key);
                    this.publish();
                }
                return candidates;
            })
                .finally(() => {
                    this.scanPromise = null;
                });
        }
        return this.scanPromise;
    }
    setDiscoveryActive (active, force = false) {
        if (this.discoveryActive === active && !force) return;
        this.discoveryActive = active;
        this.discoveryEpoch++;
        clearTimeout(this.discoveryTimer);
        if (!active || !this.autoEnabled) this.emit('cancel-ble-scan');
        if ((!active || !this.autoEnabled) && this.cancelHandshake) this.cancelHandshake();
        this.discoveryStatus = active ? (this.recoveryRequired ? 'recovery' : (this.connected ? 'connected' :
            (this.autoEnabled ? 'waiting' : 'paused'))) : 'inactive';
        this.publish();
        if (active) this.scheduleDiscovery(0);
    }
    setAutoConnect (enabled) {
        if (typeof enabled !== 'boolean') throw new NewAiError('NEW_REQUEST_INVALID');
        if (this.operation || this.firmwareLease) throw new NewAiError('NEW_BUSY');
        if (enabled && this.recoveryRequired) throw new NewAiError('NEW_FW_RECOVERY');
        if (enabled === this.autoEnabled) return this.getState();
        this.autoEnabled = enabled;
        this.saveConnectionPreferences();
        this.setDiscoveryActive(this.discoveryActive, true);
        return this.getState();
    }
    scheduleDiscovery (delay = this.timeouts.scan) {
        clearTimeout(this.discoveryTimer);
        if (!this.discoveryActive || this.shuttingDown || this.firmwareLease || this.recoveryRequired) return;
        this.discoveryTimer = setTimeout(() => {
            this.autoConnectPromise = this.discover().finally(() => {
                this.autoConnectPromise = null;
                this.scheduleDiscovery();
            });
        }, delay);
    }
    async discover () {
        if (!this.autoEnabled || this.busy || this.connected || this.recoveryRequired) return;
        const revision = this.discoveryEpoch;
        const current = () => revision === this.discoveryEpoch && this.discoveryActive && !this.shuttingDown;
        try {
            if (this.connectionMode === 'ble') {
                if (!this.bleDevice || !this.reconnectBleDevice || !this.isBleReady()) return;
                const key = `ble:${this.bleDevice.id}`;
                if ((this.failures.get(key) || 0) > Date.now()) return;
                this.bleReconnecting = true;
                this.discoveryStatus = 'connecting';
                this.publish();
                try {
                    const id = await this.reconnectBleDevice(this.bleDevice);
                    if (!current()) throw new NewAiError('NEW_CANCELLED');
                    await this.connect({type: 'ble', id}, {current, automatic: true});
                    this.failures.delete(key);
                } catch (error) {
                    if (current()) {
                        this.error = error.code || 'NEW_BLE_CONNECT';
                        this.failures.set(key, Date.now() + this.timeouts.retry);
                        this.discoveryStatus = 'retrying';
                    }
                } finally {
                    this.emit('cancel-ble-scan');
                    this.bleReconnecting = false;
                    this.publish();
                }
                return;
            }
            const ports = await this.listDevices();
            if (!current() || this.busy || this.connected) return;
            const identity = newAiPortIdentity(this.previousDevice);
            const candidates = this.previousDevice ? ports.filter(port => identity &&
                newAiPortIdentity(port) === identity) : ports;
            this.discoveryStatus = candidates.length > 1 ? 'choose' : 'waiting';
            if (candidates.length === 1) {
                const port = candidates[0];
                const key = newAiPortIdentity(port) || port.path;
                if ((this.failures.get(key) || 0) <= Date.now()) {
                    try {
                        await this.connect({path: port.path}, {current});
                        this.failures.delete(key);
                    } catch (error) {
                        if (!current()) return;
                        this.failures.set(key, Date.now() + this.timeouts.retry);
                        this.discoveryStatus = 'retrying';
                    }
                } else this.discoveryStatus = 'retrying';
            }
            this.publish();
        } catch (error) {
            if (current()) {
                this.discoveryStatus = 'scan-error';
                this.error = 'NEW_SCAN_ERROR';
                this.publish();
            }
        }
    }
    async connect ({path, type = this.connectionMode, id} = {},
        {current = () => true, firmware = false, automatic = false} = {}) {
        if (!['usb', 'ble'].includes(type) || type !== this.connectionMode) {
            throw new NewAiError('NEW_REQUEST_INVALID');
        }
        const ble = type === 'ble';
        if (ble) path = id;
        if (typeof path !== 'string' || !path || path.length > 512) throw new NewAiError('NEW_REQUEST_INVALID');
        if ((!firmware && this.firmwareLease) || this.connecting || this.disconnecting || this.operation ||
            this.connected || this.shuttingDown || (this.bleReconnecting && !automatic)) {
            throw new NewAiError('NEW_BUSY');
        }
        this.connecting = true;
        this.error = null;
        this.result = null;
        this.runConfirmation = null;
        this.phase = 'verifying';
        this.publish();
        const epoch = ++this.epoch;
        let transport;
        let parser;
        let data;
        let closed;
        let fault;
        let timer;
        try {
            const ports = ble ? [] : await this.listDevices();
            if (!current() || epoch !== this.epoch) throw new NewAiError('NEW_CANCELLED');
            const device = ble ? this.getBleIdentity && this.getBleIdentity(id) :
                ports.find(port => port.path === path);
            if (!device) throw new NewAiError(ble ? 'NEW_BLE_DEVICE_INVALID' : 'NEW_PORT_MISSING');
            transport = ble ? this.createBleTransport(id) : this.createTransport(path);
            this.transport = transport;
            this.port = path;
            parser = new NewAiStreamParser({recoverBleMonitor: ble});
            let resolveIdentity;
            let rejectIdentity;
            const identity = new Promise((resolve, reject) => {
                resolveIdentity = resolve;
                rejectIdentity = reject;
            });
            // Attach a handler before open(), which may fail or emit synchronously.
            identity.catch(() => {});
            this.cancelHandshake = () => rejectIdentity(new NewAiError('NEW_CANCELLED'));
            data = bytes => {
                if (this.epoch === epoch) parser.push(bytes);
            };
            closed = () => {
                rejectIdentity(new NewAiError('NEW_DISCONNECTED'));
                if (this.epoch === epoch && this.connected && !this.firmwareLease) {
                    this.lostConnection('NEW_DISCONNECTED');
                }
            };
            fault = error => {
                const code = ble ? (error && error.code) || 'NEW_BLE_CONNECT' : 'NEW_SERIAL_ERROR';
                rejectIdentity(new NewAiError(code));
                if (this.epoch === epoch && this.connected && !this.firmwareLease) {
                    this.lostConnection(code);
                }
            };
            this.removeTransportListeners = () => {
                transport.removeListener('data', data);
                transport.removeListener('closed', closed);
                transport.removeListener('fault', fault);
                parser.removeAllListeners();
            };
            parser.on('monitor', monitor => {
                if (this.epoch !== epoch || (!this.connected && !current())) return;
                if (monitor.running && (!this.monitor || !this.monitor.running)) this.runGeneration++;
                this.monitor = monitor;
                this.monitorSequence++;
                const operation = this.operation;
                if (operation && typeof operation.runBoundary === 'number' &&
                    this.monitorSequence > operation.runBoundary && monitor.running) operation.runObserved = true;
                const confirmation = this.runConfirmation;
                if (confirmation && confirmation.epoch === this.epoch && this.result === confirmation.result &&
                    monitor.running && this.monitorSequence > confirmation.after && !this.result.runObserved) {
                    this.result = {...this.result, runObserved: true};
                    if (this.error === 'NEW_START_WAIT_CANCELLED') this.error = null;
                    this.runConfirmation = null;
                }
                resolveIdentity();
                this.emit('monitor', monitor, this.monitorSequence);
                if (this.connected) this.publish(false);
            });
            parser.on('other-device', () => rejectIdentity(new NewAiError('NEW_WRONG_DEVICE')));
            parser.on('fault', error => {
                if (this.pending) this.pending.reject(error);
            });
            parser.on('frame', ({command, payload}) => {
                if (!this.pending) return;
                if (command === NEW_COMMAND.ERROR) this.pending.reject(new NewAiError('NEW_DEVICE_ERROR'));
                else if (command === NEW_COMMAND.ACK) {
                    if (payload.length === 1 && payload[0] === 1) this.pending.resolve();
                    else this.pending.reject(new NewAiError('NEW_ACK_INVALID'));
                }
            });
            transport.on('data', data);
            transport.on('closed', closed);
            transport.on('fault', fault);
            await bounded(transport.open(), ble ? this.timeouts.bleOpen : this.timeouts.open,
                ble ? 'NEW_BLE_TIMEOUT' : 'NEW_OPEN_TIMEOUT');
            if (!current()) throw new NewAiError('NEW_CANCELLED');
            timer = setTimeout(() => rejectIdentity(new NewAiError('NEW_IDENTITY_TIMEOUT')),
                ble ? this.timeouts.bleIdentify : this.timeouts.identify);
            await identity;
            if (!current() || epoch !== this.epoch) throw new NewAiError('NEW_CANCELLED');
            this.connected = true;
            if (ble) this.bleDevice = device;
            else this.previousDevice = device;
            this.saveConnectionPreferences();
            this.recoveryRequired = false;
            if (!this.firmwareLease && this.firmwareState) {
                this.firmwareState = {...this.firmwareState, recoveryRequired: false};
            }
            this.phase = 'connected';
            this.discoveryStatus = 'connected';
            this.lastStale = false;
            this.healthTimer = setInterval(() => {
                const stale = this.getState().stale;
                if (this.lastStale !== stale) {
                    this.lastStale = stale;
                    this.publish();
                }
            }, Math.min(500, this.timeouts.stale));
            return {...this.getState(), busy: false};
        } catch (error) {
            this.epoch++;
            this.connected = false;
            this.monitor = null;
            if (this.removeTransportListeners) this.removeTransportListeners();
            if (transport) {
                await bounded(transport.close(), ble ? this.timeouts.bleClose : this.timeouts.close,
                    ble ? 'NEW_BLE_TIMEOUT' : 'NEW_CLOSE_TIMEOUT').catch(() => {});
            }
            this.transport = null;
            this.port = null;
            this.phase = 'disconnected';
            this.error = error.code && error.code.startsWith('NEW_') ? error.code :
                (ble ? 'NEW_BLE_CONNECT' : 'NEW_SERIAL_ERROR');
            throw new NewAiError(this.error);
        } finally {
            clearTimeout(timer);
            this.cancelHandshake = null;
            this.connecting = false;
            this.publish();
        }
    }
    lostConnection (error) {
        this.error = error;
        if (this.pending) this.pending.reject(new NewAiError(error));
        if (this.operation) this.operation.controller.abort();
        this.emit('connection-lost', new NewAiError(error));
        this.disconnect({pauseAuto: false, allowBusy: true}).catch(() => {});
    }
    async disconnect ({pauseAuto = true, allowBusy = false} = {}) {
        if ((this.operation || this.firmwareLease || (this.peripheralUpdate && this.peripheralUpdate.active)) &&
            !allowBusy) throw new NewAiError('NEW_BUSY');
        if (pauseAuto) {
            this.autoEnabled = false;
            this.saveConnectionPreferences();
        }
        this.emit('cancel-ble-scan');
        if (this.cancelHandshake) this.cancelHandshake();
        this.epoch++;
        this.disconnecting = true;
        this.connected = false;
        this.monitor = null;
        this.emit('connection-lost', new NewAiError('NEW_DISCONNECTED'));
        clearInterval(this.healthTimer);
        clearTimeout(this.publishTimer);
        if (this.removeTransportListeners) this.removeTransportListeners();
        const transport = this.transport;
        this.transport = null;
        this.port = null;
        try {
            if (transport) {
                await bounded(transport.close(),
                    this.connectionMode === 'ble' ? this.timeouts.bleClose : this.timeouts.close,
                    this.connectionMode === 'ble' ? 'NEW_BLE_TIMEOUT' : 'NEW_CLOSE_TIMEOUT');
            }
        } finally {
            this.phase = 'disconnected';
            this.disconnecting = false;
            this.discoveryStatus = this.discoveryActive ? (this.autoEnabled ? 'waiting' : 'paused') : 'inactive';
            this.publish();
            this.scheduleDiscovery();
        }
        return this.getState();
    }
    async shutdown () {
        if (this.firmwareLease || (this.peripheralUpdate && this.peripheralUpdate.active)) {
            throw new NewAiError('NEW_BUSY');
        }
        this.shuttingDown = true;
        this.setDiscoveryActive(false);
        if (this.autoConnectPromise) await this.autoConnectPromise;
        this.cancel();
        if (this.jobPromise) await this.jobPromise.catch(() => {});
        await this.disconnect({pauseAuto: false, allowBusy: true});
        clearTimeout(this.publishTimer);
    }
    takeFirmwareTransport () {
        if (!this.firmwareLease || !this.transport) throw new NewAiError('NEW_DISCONNECTED');
        const transport = this.transport;
        this.epoch++;
        clearInterval(this.healthTimer);
        clearTimeout(this.publishTimer);
        if (this.removeTransportListeners) this.removeTransportListeners();
        this.removeTransportListeners = null;
        this.transport = null;
        this.port = null;
        this.monitor = null;
        this.connected = false;
        this.phase = 'disconnected';
        this.emit('connection-lost', new NewAiError('NEW_DISCONNECTED'));
        this.publish();
        // Ownership passes to the updater; do not toggle DTR or close a live boot channel.
        return transport;
    }
    reserveFirmwareUpdate () {
        if (this.busy || this.shuttingDown) throw new NewAiError('NEW_BUSY');
        this.firmwareLease = true;
        this.discoveryEpoch++;
        clearTimeout(this.discoveryTimer);
        this.result = null;
        this.runConfirmation = null;
        this.publish();
    }
    releaseFirmwareUpdate ({recoveryRequired = false} = {}) {
        this.firmwareLease = false;
        this.recoveryRequired = recoveryRequired;
        if (recoveryRequired) {
            this.phase = 'firmware-recovery';
            this.error = 'NEW_FW_RECOVERY';
            this.monitor = null;
        }
        this.discoveryStatus = recoveryRequired ? 'recovery' :
            (this.connected ? 'connected' : (this.autoEnabled ? 'waiting' : 'paused'));
        this.publish();
        this.scheduleDiscovery();
    }
    cancel () {
        if (this.pending) this.pending.reject(new NewAiError('NEW_CANCELLED'));
        if (this.operation) this.operation.controller.abort();
    }
    requireDownloadReady () {
        this.requireControlReady();
        if (this.monitor.running) throw new NewAiError('NEW_RUNNING');
    }
    requireControlReady () {
        if (!this.connected || !this.transport || !this.monitor) throw new NewAiError('NEW_DISCONNECTED');
        if (this.getState().stale) throw new NewAiError('NEW_STATUS_STALE');
        if (this.monitor.version !== NEW_RESOURCE_VERSION) throw new NewAiError('NEW_VERSION_UNSUPPORTED');
    }
    compileProgram ({source} = {}) {
        return this.startJob({source}, false);
    }
    downloadProgram (request = {}) {
        return this.startJob(request, true, false);
    }
    runProgram (request = {}) {
        return this.startJob(request, true, true);
    }
    startJob (request, download, run = false) {
        if (this.busy || this.shuttingDown) return Promise.reject(new NewAiError('NEW_BUSY'));
        if (download) {
            if (!Number.isInteger(request.slot) || request.slot < 0 || request.slot > 19) {
                return Promise.reject(new NewAiError('NEW_SLOT_INVALID'));
            }
            try {
                this.requireDownloadReady();
            } catch (error) {
                return Promise.reject(error);
            }
        }
        const context = {controller: new AbortController(),
            epoch: this.epoch,
            sent: false,
            runRequested: run,
            runBoundary: null,
            runObserved: false,
            saved: false,
            progress: {phase: 'compiling', bytes: 0, total: 0, slot: download ? request.slot : null}};
        this.operation = context;
        this.result = null;
        this.runConfirmation = null;
        this.error = null;
        this.publish();
        this.jobPromise = this.performJob(request, download, context).finally(() => {
            this.operation = null;
            this.jobPromise = null;
            this.publish();
        });
        return this.jobPromise;
    }
    async performJob ({source, slot}, download, context) {
        try {
            const bytes = await this.compiler.compile(source, {signal: context.controller.signal});
            validateNewAiBytecode(bytes);
            if (context.controller.signal.aborted) throw new NewAiError('NEW_CANCELLED');
            const result = {compiled: true,
                size: bytes.length,
                sha256: createHash('sha256').update(bytes)
                    .digest('hex')};
            if (download) {
                if (context.epoch !== this.epoch) throw new NewAiError('NEW_DISCONNECTED');
                this.requireDownloadReady();
                context.progress = {...context.progress, phase: 'downloading', total: bytes.length};
                this.publish();
                for (const frame of newAiDownloadFrames(bytes, slot, context.runRequested,
                    this.connectionMode === 'ble' ? NEW_AI_BLE_CHUNK : 248)) {
                    if (context.controller.signal.aborted) throw new NewAiError('NEW_CANCELLED');
                    if (this.monitor && this.monitor.running) throw new NewAiError('NEW_RUNNING');
                    context.sent = true;
                    if (frame.command === NEW_COMMAND.SAVE_RUN) context.runBoundary = this.monitorSequence;
                    await this.sendDownloadFrame(frame, context.controller.signal);
                    context.progress = {...context.progress, bytes: frame.bytes};
                    this.publish(false);
                }
                Object.assign(result, {downloaded: true, slot});
                context.saved = true;
                this.downloadInterrupted = false;
                if (context.runRequested) {
                    Object.assign(result, {startRequested: true, runObserved: context.runObserved});
                    this.runConfirmation = {epoch: this.epoch, after: context.runBoundary, result};
                    context.progress = {...context.progress, phase: 'starting'};
                    this.publish();
                    if (!context.runObserved) {
                        try {
                            await this.waitForMonitor(monitor => monitor.running, {
                                after: context.runBoundary,
                                signal: context.controller.signal,
                                timeout: this.timeouts.start,
                                timeoutCode: 'NEW_START_UNCONFIRMED'
                            });
                        } catch (error) {
                            if (error.code !== 'NEW_START_UNCONFIRMED') {
                                result.runObserved = context.runObserved;
                                this.result = result;
                                throw error;
                            }
                        }
                    }
                    result.runObserved = context.runObserved;
                }
            }
            this.result = result;
            return result;
        } catch (error) {
            if (context.sent && !context.saved) {
                this.downloadInterrupted = true;
                if (this.transport) await this.disconnect({pauseAuto: false, allowBusy: true}).catch(() => {});
            }
            let code = error.code && error.code.startsWith('NEW_') ? error.code : 'NEW_COMPILE_FAILED';
            if (code === 'NEW_CANCELLED' && context.saved && context.runRequested) code = 'NEW_START_WAIT_CANCELLED';
            if (code === 'NEW_DEVICE_ERROR' && context.runBoundary !== null) code = 'NEW_RUN_SAVE_FAILED';
            this.error = code;
            throw new NewAiError(code);
        }
    }
    waitForMonitor (predicate, {after = this.monitorSequence, count = 1,
        timeout = this.connectionMode === 'ble' ? this.timeouts.bleFresh : this.timeouts.fresh,
        timeoutCode = 'NEW_STATUS_STALE', signal} = {}) {
        return new Promise((resolve, reject) => {
            let consecutive = 0;
            const wait = {};
            const finish = (error, value) => {
                if (wait.done) return;
                wait.done = true;
                clearTimeout(wait.timer);
                this.removeListener('monitor', wait.monitor);
                this.removeListener('connection-lost', wait.lost);
                if (signal) signal.removeEventListener('abort', wait.abort);
                if (error) reject(error); else resolve(value);
            };
            wait.monitor = (monitor, sequence) => {
                if (sequence <= after) return;
                consecutive = predicate(monitor) ? consecutive + 1 : 0;
                if (consecutive >= count) finish(null, {monitor, sequence});
            };
            wait.lost = error => finish(error);
            wait.abort = () => finish(new NewAiError('NEW_CANCELLED'));
            wait.timer = setTimeout(() => finish(new NewAiError(timeoutCode)), timeout);
            this.on('monitor', wait.monitor);
            this.on('connection-lost', wait.lost);
            if (signal) {
                signal.addEventListener('abort', wait.abort, {once: true});
                if (signal.aborted) wait.abort();
            }
            if (!this.connected) finish(new NewAiError('NEW_DISCONNECTED'));
        });
    }
    stopCurrentProgram () {
        if (this.busy || this.shuttingDown) return Promise.reject(new NewAiError('NEW_BUSY'));
        try {
            this.requireControlReady();
        } catch (error) {
            return Promise.reject(error);
        }
        const context = {controller: new AbortController(),
            epoch: this.epoch,
            progress: {phase: 'stopping', total: 0, bytes: 0}};
        this.operation = context;
        this.result = null;
        this.runConfirmation = null;
        this.error = null;
        this.publish();
        this.jobPromise = this.performStop(context).catch(error => {
            const code = error.code === 'NEW_CANCELLED' && context.commandSent ?
                'NEW_STOP_WAIT_CANCELLED' : (error.code || 'NEW_STOP_UNCONFIRMED');
            this.error = code;
            throw new NewAiError(code);
        })
            .finally(() => {
                this.operation = null;
                this.jobPromise = null;
                this.publish();
            });
        return this.jobPromise;
    }
    async performStop (context) {
        const signal = context.controller.signal;
        const fresh = await this.waitForMonitor(() => true, {signal});
        if (!fresh.monitor.running) {
            this.result = {stopObserved: true, alreadyStopped: true};
            return this.result;
        }
        const second = await this.waitForMonitor(() => true, {after: fresh.sequence, signal});
        if (!second.monitor.running) {
            this.result = {stopObserved: true, alreadyStopped: true};
            return this.result;
        }
        this.requireControlReady();
        if (this.stopAttemptGeneration === this.runGeneration) throw new NewAiError('NEW_STOP_UNCONFIRMED');
        const boundary = this.monitorSequence;
        const stopped = this.waitForMonitor(monitor => !monitor.running, {after: boundary,
            count: 2,
            signal,
            timeout: this.timeouts.stop,
            timeoutCode: 'NEW_STOP_UNCONFIRMED'});
        stopped.catch(() => {});
        try {
            await bounded(Promise.resolve().then(() => {
                if (signal.aborted) throw new NewAiError('NEW_CANCELLED');
                this.requireControlReady();
                if (!this.monitor.running) return;
                if (context.epoch !== this.epoch) throw new NewAiError('NEW_DISCONNECTED');
                // B9 toggles state. A fresh observation reduces the race but cannot make it atomic.
                this.stopAttemptGeneration = this.runGeneration;
                context.commandSent = true;
                return this.transport.write(newAiFrame(NEW_COMMAND.STOP_TOGGLE, [1]));
            }), this.timeouts.write, 'NEW_WRITE_TIMEOUT');
            await stopped;
            if (this.monitor && this.monitor.running) throw new NewAiError('NEW_STOP_UNCONFIRMED');
            this.result = {stopObserved: true};
            return this.result;
        } catch (error) {
            context.controller.abort();
            throw error;
        }
    }
    async sendDownloadFrame ({command, payload}, signal) {
        if (!this.connected || !this.transport) throw new NewAiError('NEW_DISCONNECTED');
        if (this.pending) throw new NewAiError('NEW_BUSY');
        let pending;
        const acknowledgement = new Promise((resolve, reject) => {
            const wait = {};
            const finish = error => {
                if (this.pending !== pending) return;
                clearTimeout(wait.timer);
                signal.removeEventListener('abort', wait.abort);
                this.pending = null;
                if (error) reject(error); else resolve();
            };
            wait.abort = () => finish(new NewAiError('NEW_CANCELLED'));
            wait.timer = setTimeout(() => finish(new NewAiError('NEW_ACK_TIMEOUT')), this.timeouts.ack);
            pending = {resolve: () => finish(), reject: finish};
            this.pending = pending;
            signal.addEventListener('abort', wait.abort, {once: true});
            if (signal.aborted) wait.abort();
        });
        const transport = this.transport;
        try {
            await Promise.all([acknowledgement, bounded(Promise.resolve().then(() => {
                if (signal.aborted) throw new NewAiError('NEW_CANCELLED');
                return transport.write(newAiFrame(command, payload));
            }), this.timeouts.write, 'NEW_WRITE_TIMEOUT')]);
        } catch (error) {
            if (this.pending === pending) pending.reject(error);
            throw error;
        }
    }
}
