import HID from 'node-hid';

import {EstTransport} from './transport';
import {HidDiscovery} from './hid-discovery';

export class NodeHidEstTransport extends EstTransport {
    constructor (handle, reportId = 0) {
        super();
        this.handle = handle;
        this.reportId = reportId;
        this.nativeReadPending = false;
        this.readWaiter = null;
        this.bufferedReport = null;
        this.readError = null;
    }

    write (report) {
        this.handle.write([this.reportId, ...Array.from(report)]);
        return Promise.resolve();
    }

    read (timeoutMs) {
        if (!this.handle) return Promise.reject(new Error('HID device is disconnected'));
        if (this.readError) return Promise.reject(this.readError);
        if (this.readWaiter) return Promise.reject(new Error('EST HID read already in progress'));
        if (this.bufferedReport) {
            const report = this.bufferedReport;
            this.bufferedReport = null;
            return Promise.resolve(report);
        }
        return new Promise((resolve, reject) => {
            let timer = null;
            const settle = (error, report = new Uint8Array()) => {
                clearTimeout(timer);
                this.readWaiter = null;
                if (error) reject(error);
                else resolve(report);
            };
            timer = setTimeout(() => settle(null), Math.max(1, timeoutMs));
            this.readWaiter = settle;
            // A JS timeout cannot cancel a native read. Reuse that one read on the next
            // request instead of accumulating callbacks or losing a late response.
            if (!this.nativeReadPending) {
                this.nativeReadPending = true;
                const onRead = (error, data) => {
                    this.nativeReadPending = false;
                    if (!this.handle) return;
                    const report = Uint8Array.from(data || []);
                    if (error) this.readError = error;
                    if (this.readWaiter) this.readWaiter(error, report);
                    else if (!error && report.length) this.bufferedReport = report;
                };
                try {
                    this.handle.read(onRead);
                } catch (error) {
                    onRead(error);
                }
            }
        });
    }

    close () {
        if (this.handle) {
            const handle = this.handle;
            this.handle = null;
            if (this.readWaiter) this.readWaiter(new Error('HID device is disconnected'));
            this.bufferedReport = null;
            handle.close();
        }
        return Promise.resolve();
    }
}

export const createNodeHidEstTransportFactory = () => {
    const discovery = new HidDiscovery();
    return {
        listDevices: () => discovery.listDevices(),
        open: device => Promise.resolve(new NodeHidEstTransport(new HID.HID(device.path))),
        dispose: () => discovery.close()
    };
};
