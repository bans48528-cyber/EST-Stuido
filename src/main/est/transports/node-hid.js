import HID from 'node-hid';

import {EstTransport} from './transport';

class NodeHidEstTransport extends EstTransport {
    constructor (handle, reportId = 0) {
        super();
        this.handle = handle;
        this.reportId = reportId;
    }

    write (report) {
        this.handle.write([this.reportId, ...Array.from(report)]);
        return Promise.resolve();
    }

    read (timeoutMs) {
        const data = this.handle.readTimeout(timeoutMs);
        return Promise.resolve(Uint8Array.from(data || []));
    }

    close () {
        if (this.handle) {
            this.handle.close();
            this.handle = null;
        }
        return Promise.resolve();
    }
}

export const createNodeHidEstTransportFactory = () => ({
    listDevices: () => Promise.resolve(HID.devices()),
    open: device => Promise.resolve(new NodeHidEstTransport(new HID.HID(device.path)))
});
