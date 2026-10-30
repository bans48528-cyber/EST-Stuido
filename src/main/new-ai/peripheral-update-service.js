import {NewAiError, newAiFrame, NEW_RESOURCE_VERSION} from './protocol';
import {newAiFirmwareBounded as bounded} from './firmware-link';
import {newAiPeripheralMismatches, newAiPeripheralPayload, newAiPeripheralVersions}
from '../../common/new-ai-peripherals';

const snapshot = targets => targets.map(({port, type, current, target}) => ({port, type, current, target}));
const matches = (monitor, target) => {
    const port = monitor.ports.find(item => item.port === target.port);
    const versions = newAiPeripheralVersions(port);
    return port && port.type === target.type && versions.current === target.target && versions.target === target.target;
};

export class NewAiPeripheralUpdateService {
    constructor ({device, timeout = 180000} = {}) {
        this.device = device;
        this.timeout = timeout;
    }
    get busy () {
        return Boolean(this.device.peripheralUpdate && this.device.peripheralUpdate.active);
    }
    update (patch) {
        this.device.peripheralUpdate = {...this.device.peripheralUpdate, ...patch};
        this.device.publish();
    }
    ready (request) {
        const device = this.device;
        device.requireDownloadReady();
        if (device.monitor.legacyProtocol || device.monitor.version !== NEW_RESOURCE_VERSION) {
            throw new NewAiError('NEW_VERSION_UNSUPPORTED');
        }
        if (request.connectionRevision !== device.epoch) throw new NewAiError('NEW_PERIPHERAL_CHANGED');
        const targets = newAiPeripheralMismatches(device.monitor);
        if (!targets.length) throw new NewAiError('NEW_PERIPHERAL_NO_TARGETS');
        if (JSON.stringify(snapshot(targets)) !== JSON.stringify(snapshot(request.targets))) {
            throw new NewAiError('NEW_PERIPHERAL_CHANGED');
        }
        return targets;
    }
    start (request = {}) {
        const device = this.device;
        if (device.busy || device.shuttingDown) throw new NewAiError('NEW_BUSY');
        if (!request || request.confirmed !== true || !Array.isArray(request.targets) || request.targets.length > 8 ||
            request.targets.some(item => !item || typeof item !== 'object')) {
            throw new NewAiError('NEW_REQUEST_INVALID');
        }
        const targets = this.ready(request);
        device.peripheralUpdate = {active: true,
            phase: 'checking',
            targets,
            completed: 0,
            commandSent: false,
            error: null};
        device.publish();
        this.promise = this.run(request).finally(() => {
            this.update({active: false});
            this.promise = null;
        });
        return this.promise;
    }
    async run (request) {
        const device = this.device;
        const controller = new AbortController();
        let observe;
        try {
            // Recheck live identity, types and requested versions before the one irreversible request.
            await device.waitForMonitor(() => true, {count: 2});
            const targets = this.ready(request);
            const verified = monitor => monitor.version === NEW_RESOURCE_VERSION && !monitor.legacyProtocol &&
                targets.every(target => matches(monitor, target));
            observe = monitor => {
                const completed = targets.filter(target => matches(monitor, target)).length;
                if (completed !== device.peripheralUpdate.completed) this.update({completed});
            };
            device.on('monitor', observe);
            const finished = device.waitForMonitor(verified, {count: 3,
                timeout: this.timeout,
                timeoutCode: 'NEW_PERIPHERAL_UNCONFIRMED',
                signal: controller.signal});
            finished.catch(() => {});
            this.update({phase: 'updating'});
            // No ACK/retry: 0x32 hands the entire operation to the host, including the image copy.
            await bounded(Promise.resolve().then(() => {
                this.ready(request);
                this.update({commandSent: true});
                return device.transport.write(newAiFrame(0x32, newAiPeripheralPayload(targets)));
            }), device.timeouts.write, 'NEW_WRITE_TIMEOUT');
            await finished;
            const result = {versionMatched: true, ports: targets.map(item => item.label)};
            this.update({phase: 'complete', completed: targets.length, result});
            return result;
        } catch (error) {
            const code = error.code || 'NEW_PERIPHERAL_UNCONFIRMED';
            this.update({phase: 'error', error: code});
            throw new NewAiError(code);
        } finally {
            controller.abort();
            if (observe) device.removeListener('monitor', observe);
        }
    }
}
