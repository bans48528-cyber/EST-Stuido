import {createRequire} from 'module';
import path from 'path';
import {Worker} from 'worker_threads';
import {EST_USB_VID, EST_USB_PID} from '../constants';

// Keep this worker self-contained: the native add-on is unpacked beside app.asar,
// so it also works when Node workers do not inherit Electron's ASAR JS loader.
const WORKER_SOURCE = `
const {parentPort,workerData}=require('worker_threads');
const hid=require(workerData.nativePath);
parentPort.on('message',message=>{
    try {
        const devices=hid.devices(workerData.vendorId,workerData.productId);
        parentPort.postMessage({id:message.id,devices});
    } catch(error) {
        parentPort.postMessage({id:message.id,error:String(error.message||error).slice(0,1000)});
    }
});
`;

export const resolveHidNativePath = () => {
    const nativeRequire = createRequire(process.mainModule.filename);
    const moduleRoot = path.dirname(nativeRequire.resolve('node-hid'));
    const nativePath = nativeRequire('bindings')({
        bindings: process.platform === 'linux' ? 'HID_hidraw.node' : 'HID.node',
        module_root: moduleRoot,
        path: true
    });
    return nativePath.replace(/\.asar([\\/])/g, '.asar.unpacked$1');
};

export class HidDiscovery {
    constructor ({nativePath, timeoutMs = 3000, WorkerClass = Worker} = {}) {
        this.nativePath = nativePath;
        this.timeoutMs = timeoutMs;
        this.WorkerClass = WorkerClass;
        this.sequence = 0;
        this.pending = null;
        this.worker = null;
        this.closed = false;
    }

    createWorker () {
        if (this.worker) return this.worker;
        const worker = new this.WorkerClass(WORKER_SOURCE, {
            eval: true,
            workerData: {nativePath: this.nativePath || resolveHidNativePath(),
                vendorId: EST_USB_VID,
                productId: EST_USB_PID}
        });
        this.worker = worker;
        worker.on('message', message => {
            const pending = this.pending;
            if (this.worker !== worker || !pending || message.id !== pending.id) return;
            this.pending = null;
            clearTimeout(pending.timer);
            worker.unref();
            if (message.error) pending.reject(new Error(message.error));
            else if (Array.isArray(message.devices)) pending.resolve(message.devices);
            else pending.reject(new Error('Invalid HID discovery response'));
        });
        const failed = error => {
            if (this.worker !== worker) return;
            this.worker = null;
            const pending = this.pending;
            this.pending = null;
            if (pending) {
                clearTimeout(pending.timer);
                pending.reject(error);
            }
            worker.unref();
        };
        worker.on('error', failed);
        worker.on('exit', code => failed(new Error(`HID discovery worker exited (${code})`)));
        worker.unref();
        return worker;
    }

    listDevices () {
        if (this.closed) return Promise.reject(new Error('HID discovery is closed'));
        if (this.pending) return this.pending.promise;
        let worker;
        try {
            worker = this.createWorker();
        } catch (error) {
            return Promise.reject(error);
        }
        const pending = {id: ++this.sequence};
        pending.promise = new Promise((resolve, reject) => {
            Object.assign(pending, {resolve, reject});
        });
        this.pending = pending;
        pending.timer = setTimeout(() => {
            // A timeout cannot cancel a native scan. Keep its slot until it finishes,
            // and share this rejected promise instead of queueing more native scans.
            pending.reject(new Error('HID device discovery timed out'));
            worker.unref();
        }, this.timeoutMs);
        worker.ref();
        try {
            worker.postMessage({id: pending.id});
        } catch (error) {
            this.pending = null;
            clearTimeout(pending.timer);
            pending.reject(error);
            worker.unref();
        }
        return pending.promise;
    }

    close () {
        this.closed = true;
        if (this.pending) {
            clearTimeout(this.pending.timer);
            this.pending.reject(new Error('HID discovery is closed'));
            this.pending = null;
        }
        const worker = this.worker;
        this.worker = null;
        if (worker) {
            worker.unref();
            // Never keep application shutdown waiting for a stalled USB driver.
            worker.terminate().catch(() => {});
        }
    }
}
