export class EstTransport {
    open () {
        return Promise.reject(new Error('EST transport open() is not implemented'));
    }

    listDevices () {
        return Promise.reject(new Error('EST transport listDevices() is not implemented'));
    }

    write () {
        return Promise.reject(new Error('EST transport write() is not implemented'));
    }

    read () {
        return Promise.reject(new Error('EST transport read() is not implemented'));
    }

    async close () {
        // Optional for transports that do not hold a native handle.
    }
}

export class UnavailableEstTransport extends EstTransport {
    constructor (reason) {
        super();
        this.reason = reason;
    }

    listDevices () {
        return Promise.resolve([]);
    }
}

export const createUnavailableEstTransportFactory = reason => ({
    listDevices: () => Promise.resolve([]),
    open: () => Promise.reject(new Error(reason))
});
