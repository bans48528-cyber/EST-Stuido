/* eslint-disable no-use-before-define */
// Cleanup callbacks refer to timers and listeners installed before events can fire.
import {EventEmitter} from 'events';
import {SparkCompiler} from './compiler';
import {listSparkSerialPorts, SparkSerialTransport} from './serial-transport';
import {chooseSparkPort, sparkPortIdentity, sortSparkPorts} from './discovery';
import {SPARK_BLE_CHUNK} from '../../common/spark-ble';
import {normalizeSparkPreferences} from './connection-preferences';
import {SparkError, SparkStreamParser, SPARK_COMMAND, SPARK_VERIFIED_FIRMWARE,
    sparkFrame, sparkDownloadFrames, validateSparkBytecode} from './protocol';

const sleep = (ms, signal) => new Promise((resolve, reject) => {
    const abort = () => {
        clearTimeout(timer); reject(new SparkError('SPARK_CANCELLED'));
    };
    const timer = setTimeout(() => {
        if (signal) signal.removeEventListener('abort', abort); resolve();
    }, ms);
    if (signal) {
        signal.addEventListener('abort', abort, {once: true});
        if (signal.aborted) abort();
    }
});
const bounded = (promise, ms, code) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new SparkError(code)), ms);
    Promise.resolve(promise).then(value => {
        clearTimeout(timer); resolve(value);
    }, error => {
        clearTimeout(timer); reject(error);
    });
});

export class SparkDeviceService extends EventEmitter {
    constructor ({compiler = new SparkCompiler(), listPorts = listSparkSerialPorts,
        createTransport = port => new SparkSerialTransport(port), createBleTransport,
        preferences, reconnectBleDevice, getBleIdentity, isBleReady = () => true, timeouts = {}} = {}) {
        super();
        this.compiler = compiler;
        this.listPorts = listPorts;
        this.createTransport = createTransport;
        this.createBleTransport = createBleTransport;
        this.preferences = preferences;
        this.saved = normalizeSparkPreferences(preferences ? preferences.read() : {});
        this.connectionMode = this.saved.mode;
        this.recoveryRequired = false; // Reserved for firmware-update recovery, not program downloads.
        this.downloadInterrupted = this.saved.downloadInterrupted;
        this.reconnectBleDevice = reconnectBleDevice;
        this.getBleIdentity = getBleIdentity;
        this.isBleReady = isBleReady;
        this.timeouts = {connect: 6000,
            ack: 5000,
            write: 5000,
            monitor: 5000,
            start: 3500,
            stop: 5000,
            settle: 2000,
            discovery: 2000,
            retry: 10000,
            maxRetry: 30000,
            ...timeouts};
        this.phase = 'disconnected';
        this.epoch = 0;
        this.sequence = 0;
        this.lastRunSequence = -1;
        this.logs = [];
        this.monitorEnabled = true;
        this.logId = 0;
        this.discovery = {enabled: this.saved[this.connectionMode === 'ble' ? 'bleAuto' : 'usbAuto'],
            status: 'inactive',
            ports: [],
            revision: 0};
        this.discoveryRevision = 0;
        this.discoveryFailures = new Map();
    }
    get pythonProgramActive () {
        return Boolean(this.connected && this.monitor && this.monitor.running);
    }
    get busy () {
        return Boolean(this.firmwareLease || this.connecting || this.disconnecting ||
            this.opening || this.operation || this.changingMonitor);
    }
    getState () {
        return {state: this.firmwareLease ? 'firmware-updating' : this.phase,
            connected: Boolean(this.transport && this.connected),
            busy: this.busy,
            compatible: Boolean(this.monitor && this.monitor.version === SPARK_VERIFIED_FIRMWARE),
            compilerSupported: process.platform === 'win32' && process.arch === 'x64',
            port: this.portPath || null,
            connectionMode: this.connectionMode,
            bleDevice: this.saved.bleDevice,
            reconnecting: Boolean(this.bleReconnecting),
            status: this.monitor || null,
            stale: Boolean(this.monitor && Date.now() - this.monitor.timestamp > this.timeouts.monitor),
            monitoring: this.monitorEnabled,
            operation: this.operation ? {...this.operation.progress} : null,
            result: this.result || null,
            error: this.firmwareLease ? null : (this.error || this.preferenceError || null),
            warning: this.downloadInterrupted ? 'SPARK_DOWNLOAD_INCOMPLETE' : null,
            firmware: this.firmwareState || null,
            discovery: this.discovery,
            logs: this.logs.slice(-40)};
    }
    publish (immediate = false) {
        if (this.shuttingDown) return;
        if (this.publishTimer) {
            if (!immediate) return;
            clearTimeout(this.publishTimer);
            this.publishTimer = null;
        }
        if (immediate) {
            this.emit('state', this.getState()); return;
        }
        this.publishTimer = setTimeout(() => {
            this.publishTimer = null;
            this.emit('state', this.getState());
        }, 100);
    }
    addLog (message) {
        // eslint-disable-next-line no-control-regex
        const line = String(message).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
            .slice(0, 500);
        this.logs.push({id: ++this.logId, time: Date.now(), text: line});
        if (this.logs.length > 200) this.logs.shift();
        this.publish();
    }
    clearLogs () {
        this.logs = []; this.publish(true);
    }
    updateDiscovery (patch) {
        if (Object.keys(patch).every(key => this.discovery[key] === patch[key])) return;
        this.discovery = {...this.discovery, ...patch, revision: this.discovery.revision + 1};
        this.publish();
    }
    savePreferences (patch) {
        const next = normalizeSparkPreferences({...this.saved, ...patch});
        try {
            if (this.preferences) this.preferences.write(next);
            this.preferenceError = null;
        } catch (error) {
            this.preferenceError = 'SPARK_PREFERENCES_SAVE';
            console.error('Spark connection preferences:', error.message);
        }
        this.saved = next;
    }
    forgetBleDevice () {
        if (this.busy || this.connected) throw new SparkError('SPARK_BUSY');
        this.savePreferences({bleDevice: null});
        this.discoveryFailures.clear();
        this.publish(true);
        return this.getState();
    }
    listDevices () {
        if (!this.scanPromise) {
            this.scanPromise = Promise.resolve().then(() => this.listPorts())
                .then(ports => {
                    const sorted = sortSparkPorts(ports);
                    if (JSON.stringify(sorted) !== JSON.stringify(this.discovery.ports)) {
                        this.updateDiscovery({ports: sorted});
                    }
                    return sorted;
                })
                .finally(() => {
                    this.scanPromise = null;
                });
        }
        return this.scanPromise;
    }
    setDiscoveryActive (active) {
        if (this.discoveryActive === active) return;
        this.discoveryActive = active;
        if (!active) this.emit('cancel-ble-scan');
        this.discoveryRevision++;
        clearTimeout(this.discoveryTimer);
        this.discoveryTimer = null;
        this.updateDiscovery({status: active ?
            (this.recoveryRequired ? 'recovery' : (this.connected ? 'connected' :
                (this.discovery.enabled ? 'waiting' : 'paused'))) : 'inactive'});
        if (active) this.scheduleDiscovery(0);
    }
    setAutoConnect (enabled) {
        if (typeof enabled !== 'boolean') throw new SparkError('SPARK_SOURCE_INVALID');
        if (this.busy && !(this.bleReconnecting && !enabled)) throw new SparkError('SPARK_BUSY');
        if (enabled && this.recoveryRequired) throw new SparkError('SPARK_FW_RECOVERY');
        this.discoveryRevision++;
        clearTimeout(this.discoveryTimer);
        this.discoveryTimer = null;
        this.discoveryFailures.clear();
        if (!enabled) this.emit('cancel-ble-scan');
        this.savePreferences({[this.connectionMode === 'ble' ? 'bleAuto' : 'usbAuto']: enabled});
        this.updateDiscovery({enabled, status: this.connected ? 'connected' : (enabled ? 'waiting' : 'paused')});
        if (enabled) this.scheduleDiscovery(0);
        return this.getState();
    }
    canDiscover () {
        return this.discoveryActive && this.discovery.enabled &&
            !this.shuttingDown && !this.recoveryRequired && !this.firmwareLease &&
            (this.connectionMode === 'usb' ||
                Boolean(this.saved.bleDevice && this.reconnectBleDevice && this.isBleReady()));
    }
    async setConnectionMode (mode) {
        if (!['usb', 'ble'].includes(mode)) throw new SparkError('SPARK_SOURCE_INVALID');
        if (mode === this.connectionMode) return this.getState();
        if (this.busy) throw new SparkError('SPARK_BUSY');
        if (this.pythonProgramActive) throw new SparkError('SPARK_STOP_FIRST');
        this.discoveryRevision++;
        clearTimeout(this.discoveryTimer);
        this.discoveryTimer = null;
        this.emit('cancel-ble-scan');
        await this.disconnect({pauseAuto: false});
        this.connectionMode = mode;
        this.savePreferences({mode});
        const enabled = this.saved[mode === 'ble' ? 'bleAuto' : 'usbAuto'];
        this.updateDiscovery({enabled, status: enabled ? 'waiting' : 'paused'});
        this.publish(true);
        this.scheduleDiscovery(0);
        return this.getState();
    }
    scheduleDiscovery (delay = this.timeouts.discovery) {
        if (!this.canDiscover() || this.connected || this.discoveryTimer || this.autoConnectPromise) return;
        this.discoveryTimer = setTimeout(() => {
            this.discoveryTimer = null;
            this.autoConnectPromise = this.discover().finally(() => {
                this.autoConnectPromise = null;
                this.scheduleDiscovery();
            });
        }, delay);
    }
    async discover () {
        if (!this.canDiscover() || this.busy || this.connected) return;
        const revision = this.discoveryRevision;
        const current = () => revision === this.discoveryRevision && this.canDiscover();
        if (this.connectionMode === 'ble') return this.discoverBle(current);
        try {
            const ports = await this.listDevices();
            if (!current() || this.busy || this.connected) return;
            const keys = new Set(ports.map(port => sparkPortIdentity(port) || port.path));
            for (const key of this.discoveryFailures.keys()) {
                if (!keys.has(key)) this.discoveryFailures.delete(key);
            }
            const {port, status} = chooseSparkPort(ports, this.lastDevice);
            this.updateDiscovery({status});
            if (!port) return;
            const key = sparkPortIdentity(port) || port.path;
            const failure = this.discoveryFailures.get(key);
            if (failure && Date.now() < failure.until) {
                this.updateDiscovery({status: 'retrying'}); return;
            }
            try {
                await this.connect({path: port.path}, {automatic: true, current});
                this.discoveryFailures.delete(key);
            } catch (error) {
                if (!current()) return;
                const attempts = (failure ? failure.attempts : 0) + 1;
                this.discoveryFailures.set(key, {attempts,
                    until: Date.now() +
                    Math.min(this.timeouts.maxRetry, this.timeouts.retry * Math.pow(2, attempts - 1))});
                this.updateDiscovery({status: 'retrying'});
            }
        } catch (error) {
            if (current()) this.updateDiscovery({status: 'scan-error'});
        }
    }
    async discoverBle (current) {
        const identity = this.saved.bleDevice;
        const failure = this.discoveryFailures.get(identity.id);
        if (failure && Date.now() < failure.until) {
            this.updateDiscovery({status: 'retrying'}); return;
        }
        this.bleReconnecting = true;
        this.connecting = true;
        this.updateDiscovery({status: 'connecting'});
        this.publish(true);
        try {
            const id = await this.reconnectBleDevice(identity);
            if (!current()) throw new SparkError('SPARK_CANCELLED');
            await this.openConnection(id, {type: 'ble', automatic: true, current});
            this.discoveryFailures.delete(identity.id);
        } catch (error) {
            if (!current()) return;
            const attempts = (failure ? failure.attempts : 0) + 1;
            this.discoveryFailures.set(identity.id, {attempts,
                until: Date.now() +
                Math.min(this.timeouts.maxRetry, this.timeouts.retry * Math.pow(2, attempts - 1))});
            this.error = error.code || 'SPARK_BLE_CONNECT';
            this.updateDiscovery({status: 'retrying'});
        } finally {
            this.emit('cancel-ble-scan');
            this.bleReconnecting = false;
            this.connecting = false;
            this.publish(true);
        }
    }
    async connect ({path: portPath, type = 'usb', id} = {}, options = {}) {
        if (this.shuttingDown) throw new SparkError('SPARK_DISCONNECTED');
        if (this.busy) throw new SparkError('SPARK_BUSY');
        if (type !== this.connectionMode || !['usb', 'ble'].includes(type)) throw new SparkError('SPARK_PORT_INVALID');
        this.connecting = true;
        try {
            await this.openConnection(type === 'ble' ? id : portPath, {...options, type});
        } finally {
            this.connecting = false;
            this.publish(true);
            this.scheduleDiscovery();
        }
        return this.getState();
    }
    async openConnection (portPath, {automatic = false, current: isCurrent = () => true, type = 'usb'} = {}) {
        const ble = type === 'ble';
        const ports = ble ? [{path: portPath}] : await this.listDevices();
        const port = ports.find(item => item.path === portPath);
        if (typeof portPath !== 'string' || !port) {
            throw new SparkError('SPARK_PORT_INVALID');
        }
        if (this.shuttingDown || !isCurrent()) throw new SparkError('SPARK_DISCONNECTED');
        if (automatic && !ble) {
            const selected = chooseSparkPort(ports, this.lastDevice).port;
            if (!selected || selected.path !== portPath) throw new SparkError('SPARK_PORT_INVALID');
        }
        if (this.pythonProgramActive) throw new SparkError('SPARK_STOP_FIRST');
        await this.closeTransport();
        if (this.shuttingDown || !isCurrent()) throw new SparkError('SPARK_DISCONNECTED');
        this.opening = true;
        this.phase = 'opening';
        this.error = null;
        this.result = null;
        this.monitor = null;
        this.sequence = 0;
        this.lastRunSequence = -1;
        this.monitorEnabled = true;
        const epoch = ++this.epoch;
        const parser = new SparkStreamParser({recoverBleMonitor: ble});
        let transport;
        try {
            transport = ble ? this.createBleTransport(portPath) : this.createTransport(portPath);
        } catch (error) {
            this.opening = false;
            this.phase = 'error';
            this.error = ble ? 'SPARK_BLE_CONNECT' : 'SPARK_SERIAL_ERROR';
            this.publish(true);
            throw new SparkError(this.error, error.message);
        }
        this.transport = transport;
        this.portPath = portPath;
        const current = callback => value => {
            if (epoch === this.epoch) callback(value);
        };
        transport.on('data', current(bytes => parser.push(bytes)));
        transport.on('fault', current(error => this.connectionLost(error)));
        transport.on('closed', current(() => this.connectionLost(new SparkError('SPARK_DISCONNECTED'))));
        parser.on('monitor', current(monitor => {
            this.monitor = monitor;
            if (this.error === 'SPARK_MONITOR_STALE') this.error = null;
            this.sequence++;
            if (monitor.running) this.lastRunSequence = this.sequence;
            if (!this.operation && !this.opening && !this.firmwareLease) {
                this.phase = monitor.running ? 'running' : 'ready';
            }
            this.emit('monitor', monitor);
            this.publish();
        }));
        parser.on('log', current(line => this.addLog(line)));
        parser.on('frame', current(frame => this.receiveFrame(frame)));
        parser.on('fault', current(error => {
            this.addLog(error.message);
            if (this.pendingAck) this.pendingAck.reject(error);
        }));
        this.publish(true);
        try {
            await bounded(transport.open(), ble ? 15000 : this.timeouts.connect, 'SPARK_CONNECT_TIMEOUT');
            if (epoch !== this.epoch || this.shuttingDown || !isCurrent()) throw new SparkError('SPARK_DISCONNECTED');
            this.connected = true;
            const trusted = sparkPortIdentity(port) && sparkPortIdentity(port) === sparkPortIdentity(this.lastDevice);
            // A shared STM32 VID/PID must never authorize writing to an unknown device.
            if (automatic && !ble && !trusted) await this.waitForMonitor(() => true, this.timeouts.connect);
            if (epoch !== this.epoch || this.shuttingDown || !isCurrent()) throw new SparkError('SPARK_DISCONNECTED');
            // BA is monitor-on in the audited firmware, not a legacy handshake.
            await this.writeControl(SPARK_COMMAND.MONITOR_ON);
            await this.waitForMonitor(() => true, this.timeouts.connect);
            if (epoch !== this.epoch || !isCurrent()) throw new SparkError('SPARK_DISCONNECTED');
            if (!ble) this.lastDevice = port;
            if (ble && this.getBleIdentity && this.monitor.version === SPARK_VERIFIED_FIRMWARE) {
                const identity = this.getBleIdentity(portPath);
                if (identity) this.savePreferences({bleDevice: identity});
            }
            this.recoveryRequired = false;
            if (!this.firmwareLease && this.firmwareState) {
                this.firmwareState = {...this.firmwareState, recoveryRequired: false};
            }
            this.updateDiscovery({status: 'connected'});
            this.phase = this.monitor.running ? 'running' : 'ready';
            if (this.monitor.version !== SPARK_VERIFIED_FIRMWARE) this.error = 'SPARK_FIRMWARE_UNVERIFIED';
            this.watchdog = setInterval(() => {
                if (!this.operation && !this.firmwareLease && this.monitorEnabled && this.monitor &&
                    Date.now() > (this.monitorGrace || 0) &&
                    Date.now() - this.monitor.timestamp > this.timeouts.monitor && this.phase !== 'monitor-stale') {
                    this.phase = 'monitor-stale';
                    this.error = 'SPARK_MONITOR_STALE';
                    this.publish(true);
                }
            }, 500);
            return this.getState();
        } catch (error) {
            await this.closeTransport();
            this.phase = 'error';
            this.error = error.code || 'SPARK_SERIAL_ERROR';
            throw error;
        } finally {
            this.opening = false;
            this.publish(true);
        }
    }
    connectionLost (error) {
        this.connected = false;
        this.error = error.code || 'SPARK_DISCONNECTED';
        this.phase = 'disconnected';
        if (this.fileActive) {
            this.downloadInterrupted = true;
            this.savePreferences({downloadInterrupted: true});
        }
        this.updateDiscovery({status: this.recoveryRequired ? 'recovery' :
            (this.discovery.enabled ? 'waiting' : 'paused')});
        this.emit('lost', error);
        if (this.pendingAck) this.pendingAck.reject(error);
        if (this.operation) {
            this.operation.failure = error; this.operation.controller.abort();
        }
        clearInterval(this.watchdog);
        this.publish(true);
        this.scheduleDiscovery();
    }
    async closeTransport () {
        const transport = this.transport;
        this.epoch++;
        this.transport = null;
        this.connected = false;
        clearInterval(this.watchdog);
        this.emit('lost', new SparkError('SPARK_DISCONNECTED'));
        if (this.pendingAck) this.pendingAck.reject(new SparkError('SPARK_DISCONNECTED'));
        if (transport) {
            await bounded(transport.close(), this.connectionMode === 'ble' ? 5500 : 2500,
                'SPARK_DISCONNECTED').catch(() => {});
        }
    }
    async disconnect ({pauseAuto = true} = {}) {
        if (this.busy) throw new SparkError('SPARK_BUSY');
        if (pauseAuto) this.setAutoConnect(false);
        this.disconnecting = true;
        this.phase = 'disconnecting';
        this.publish(true);
        try {
            await this.closeTransport();
            this.monitor = null;
            this.portPath = null;
            this.phase = this.recoveryRequired ? 'firmware-recovery' : 'disconnected';
            this.error = this.recoveryRequired ? 'SPARK_FW_RECOVERY' : null;
            this.result = null;
            this.updateDiscovery({status: this.discoveryActive ?
                (this.recoveryRequired ? 'recovery' : (this.discovery.enabled ? 'waiting' : 'paused')) : 'inactive'});
        } finally {
            this.disconnecting = false;
            this.publish(true);
        }
        return this.getState();
    }
    waitForMonitor (predicate, timeout, {after = -1, signal} = {}) {
        if (signal && signal.aborted) return Promise.reject(new SparkError('SPARK_CANCELLED'));
        if (this.connected && this.monitor && this.sequence > after && predicate(this.monitor)) {
            return Promise.resolve(this.monitor);
        }
        return new Promise((resolve, reject) => {
            const finish = (error, value) => {
                clearTimeout(timer);
                this.removeListener('monitor', monitor);
                this.removeListener('lost', lost);
                if (signal) signal.removeEventListener('abort', abort);
                if (error) reject(error); else resolve(value);
            };
            const monitor = value => {
                if (this.sequence > after && predicate(value)) finish(null, value);
            };
            const lost = error => finish(error);
            const abort = () => finish(new SparkError('SPARK_CANCELLED'));
            const timer = setTimeout(() => finish(new SparkError('SPARK_MONITOR_TIMEOUT')), timeout);
            this.on('monitor', monitor);
            this.on('lost', lost);
            if (signal) {
                signal.addEventListener('abort', abort, {once: true});
                if (signal.aborted) abort();
            }
            if (!this.connected) lost(new SparkError('SPARK_DISCONNECTED'));
        });
    }
    async writeControl (command) {
        if (!this.transport || !this.connected) throw new SparkError('SPARK_DISCONNECTED');
        await bounded(this.transport.write(sparkFrame(command, Buffer.from([1]))),
            this.timeouts.write, 'SPARK_WRITE_TIMEOUT');
    }
    requireReady ({allowStale = false} = {}) {
        if (!this.connected || !this.transport || !this.monitor) throw new SparkError('SPARK_DISCONNECTED');
        if (this.monitor.version !== SPARK_VERIFIED_FIRMWARE) throw new SparkError('SPARK_FIRMWARE_UNVERIFIED');
        if (!allowStale && Date.now() - this.monitor.timestamp > this.timeouts.monitor) {
            throw new SparkError('SPARK_MONITOR_STALE');
        }
    }
    async setMonitoring (enabled) {
        if (typeof enabled !== 'boolean') throw new SparkError('SPARK_SOURCE_INVALID');
        if (this.busy || this.pythonProgramActive) throw new SparkError('SPARK_BUSY');
        this.changingMonitor = true;
        this.publish(true);
        try {
            await this.writeControl(enabled ? SPARK_COMMAND.MONITOR_ON : SPARK_COMMAND.MONITOR_OFF);
            this.monitorEnabled = enabled;
            if (enabled) this.monitorGrace = Date.now() + this.timeouts.monitor;
        } finally {
            this.changingMonitor = false; this.publish(true);
        }
        return this.getState();
    }
    receiveFrame ({command, payload}) {
        const pending = this.pendingAck;
        if (!pending) return;
        if (command === SPARK_COMMAND.ACK) {
            if (payload.length === 1 && payload[0] === 1) pending.resolve();
            else pending.reject(new SparkError('SPARK_ACK_INVALID'));
        } else if (payload.length === 1 && payload[0] === command &&
            (command <= 20 || [0xF3, 0xF4, 0xFF].includes(command))) {
            pending.reject(new SparkError('SPARK_DEVICE_ERROR', `0x${command.toString(16).toUpperCase()}`));
        }
    }
    async sendFileFrame (command, payload, signal) {
        if (signal.aborted) throw new SparkError('SPARK_CANCELLED');
        if (this.pendingAck || !this.transport || !this.connected) throw new SparkError('SPARK_DISCONNECTED');
        let pending;
        const ack = new Promise((resolve, reject) => {
            const finish = error => {
                clearTimeout(timer);
                signal.removeEventListener('abort', abort);
                if (this.pendingAck === pending) this.pendingAck = null;
                if (error) reject(error); else resolve();
            };
            const abort = () => finish(new SparkError('SPARK_CANCELLED'));
            const timer = setTimeout(() => finish(new SparkError('SPARK_ACK_TIMEOUT')), this.timeouts.ack);
            pending = {resolve: () => finish(), reject: finish};
            this.pendingAck = pending;
            signal.addEventListener('abort', abort, {once: true});
        });
        // Register the waiter before writing: fast USB ACKs may arrive in the write callback.
        try {
            const transport = this.transport;
            await Promise.all([bounded(Promise.resolve().then(() => transport.write(sparkFrame(command, payload))),
                this.timeouts.write, 'SPARK_WRITE_TIMEOUT'), ack]);
        } catch (error) {
            pending.reject(error);
            throw error;
        }
    }
    updateProgress (phase, values = {}) {
        this.phase = phase;
        this.operation.progress = {...this.operation.progress, phase, ...values};
        this.publish();
    }
    async stopInside (signal) {
        this.updateProgress('stopping');
        if (!this.monitorEnabled) {
            await this.writeControl(SPARK_COMMAND.MONITOR_ON);
            this.monitorEnabled = true;
        }
        const after = this.sequence;
        await this.writeControl(SPARK_COMMAND.STOP);
        await this.waitForMonitor(status => !status.running, this.timeouts.stop, {after, signal});
        // WillAiState clears before motor/VM cleanup. Keep the audited settling delay.
        await sleep(this.timeouts.settle, signal);
        return {requested: true, stopObserved: true, cleanupConfirmed: false};
    }
    async withOperation (action, callback) {
        if (this.busy) throw new SparkError('SPARK_BUSY');
        if (action === 'stop') {
            if (!this.connected || !this.transport) throw new SparkError('SPARK_DISCONNECTED');
        } else this.requireReady({allowStale: !this.monitorEnabled});
        const controller = new AbortController();
        let finishOperation;
        this.operationDone = new Promise(resolve => {
            finishOperation = resolve;
        });
        this.operation = {controller, progress: {action, phase: action, bytes: 0, total: 0}};
        this.error = null;
        this.result = null;
        this.publish(true);
        try {
            const result = await callback(controller.signal);
            this.result = result;
            return result;
        } catch (caught) {
            const error = this.operation.failure || caught;
            const interrupted = this.fileActive;
            if (interrupted) {
                this.downloadInterrupted = true;
                this.savePreferences({downloadInterrupted: true});
                this.updateDiscovery({status: this.discovery.enabled ? 'waiting' : 'paused'});
            }
            // Stop any in-flight fragments, then allow normal reconnection.
            if (interrupted) await this.closeTransport();
            else if (this.operation.startRequested && error.code === 'SPARK_CANCELLED' && this.connected) {
                await this.writeControl(SPARK_COMMAND.STOP).catch(() => {});
            }
            this.phase = this.connected ? (error.code === 'SPARK_CANCELLED' ? 'cancelled' : 'error') : 'disconnected';
            this.error = interrupted ? null : (error.code || 'SPARK_SERIAL_ERROR');
            this.addLog(error.message);
            throw interrupted ? new SparkError('SPARK_DOWNLOAD_INCOMPLETE', error.message) : error;
        } finally {
            this.fileActive = false;
            this.operation = null;
            finishOperation();
            this.publish(true);
            this.scheduleDiscovery();
        }
    }
    async downloadProgram ({source, slot, run = false} = {}) { // eslint-disable-line require-await
        if (typeof run !== 'boolean' || !Number.isInteger(slot) || slot < 0 || slot > 9) {
            throw new SparkError('SPARK_SLOT_INVALID');
        }
        return this.withOperation(run ? 'run' : 'download', async signal => {
            this.updateProgress('compiling', {slot});
            const bytes = await this.compiler.compile(source, {signal});
            validateSparkBytecode(bytes);
            if (signal.aborted) throw new SparkError('SPARK_CANCELLED');
            if (!this.monitorEnabled) {
                const after = this.sequence;
                await this.writeControl(SPARK_COMMAND.MONITOR_ON);
                this.monitorEnabled = true;
                await this.waitForMonitor(() => true, this.timeouts.monitor, {after, signal});
            }
            this.requireReady();
            if (this.pythonProgramActive) await this.stopInside(signal);
            this.requireReady();
            const frames = sparkDownloadFrames(bytes, slot, run, this.connectionMode === 'ble' ? SPARK_BLE_CHUNK : 248);
            let startAfter = this.sequence;
            this.updateProgress('downloading', {total: bytes.length});
            // A crash during a transfer leaves a reminder, never a connection lock.
            this.savePreferences({downloadInterrupted: true});
            this.fileActive = true;
            for (const frame of frames) {
                if (frame.command === SPARK_COMMAND.RUN) {
                    startAfter = this.sequence;
                    this.operation.startRequested = true;
                }
                await this.sendFileFrame(frame.command, frame.payload, signal);
                this.updateProgress('downloading', {bytes: frame.bytes});
            }
            this.fileActive = false;
            this.downloadInterrupted = false;
            this.savePreferences({downloadInterrupted: false});
            this.monitorGrace = Date.now() + this.timeouts.monitor;
            if (!run) {
                this.phase = 'downloaded'; return {downloaded: true, slot, size: bytes.length};
            }
            this.updateProgress('starting');
            let runObserved = this.lastRunSequence > startAfter;
            if (!runObserved) {
                try {
                    await this.waitForMonitor(status => status.running, this.timeouts.start,
                        {after: startAfter, signal});
                    runObserved = true;
                } catch (error) {
                    if (error.code !== 'SPARK_MONITOR_TIMEOUT') throw error;
                }
            }
            this.phase = runObserved ? (this.pythonProgramActive ? 'running' : 'ready') : 'start-unconfirmed';
            return {downloaded: true, startRequested: true, runObserved, slot, size: bytes.length};
        });
    }
    stopCurrentProgram () {
        return this.withOperation('stop', async signal => {
            const result = await this.stopInside(signal);
            this.phase = 'stopped';
            return result;
        });
    }
    cancel () {
        if (this.operation) this.operation.controller.abort();
    }
    reserveFirmwareUpdate () {
        if (this.busy) throw new SparkError('SPARK_BUSY');
        if (this.shuttingDown) throw new SparkError('SPARK_DISCONNECTED');
        if (this.connectionMode !== 'usb') throw new SparkError('SPARK_FW_USB_ONLY');
        this.firmwareLease = true;
        this.discoveryRevision++;
        clearTimeout(this.discoveryTimer);
        this.discoveryTimer = null;
        this.emit('cancel-ble-scan');
        this.result = null;
        this.publish(true);
    }
    releaseFirmwareUpdate ({recoveryRequired = false} = {}) {
        this.firmwareLease = false;
        this.recoveryRequired = recoveryRequired;
        if (recoveryRequired) {
            this.phase = 'firmware-recovery';
            this.error = 'SPARK_FW_RECOVERY';
            this.monitor = null;
        }
        this.updateDiscovery({status: recoveryRequired ? 'recovery' :
            (this.connected ? 'connected' : (this.discovery.enabled ? 'waiting' : 'paused'))});
        this.publish(true);
        this.scheduleDiscovery();
    }
    async shutdown () {
        this.shuttingDown = true;
        this.setDiscoveryActive(false);
        this.cancel();
        if (this.connected && this.pythonProgramActive && !this.fileActive) {
            await this.writeControl(SPARK_COMMAND.STOP).catch(() => {});
        }
        await this.closeTransport();
        if (this.autoConnectPromise) await this.autoConnectPromise;
        if (this.operationDone) await this.operationDone;
        clearTimeout(this.publishTimer);
        this.publishTimer = null;
    }
}
