const usbId = value => String(value || '').toLowerCase()
    .replace(/^0x/, '')
    .padStart(4, '0');

export const sparkPortIdentity = port => {
    if (!port) return null;
    const vendor = usbId(port.vendorId);
    const product = usbId(port.productId);
    if (port.serialNumber) return `${vendor}:${product}:${port.serialNumber}`;
    return port.pnpId && /^USB\\/i.test(port.pnpId) ? port.pnpId.toUpperCase() : null;
};

// This VID/PID is shared by STM32 CDC devices. It is a candidate, not proof of a Spark device.
export const isSparkUsbCandidate = port => usbId(port.vendorId) === '0483' &&
    usbId(port.productId) === '5740' && !/^BTH/i.test(port.pnpId || '');

export const chooseSparkPort = (ports, previous) => {
    const identity = sparkPortIdentity(previous);
    const candidates = previous ? ports.filter(port => identity && sparkPortIdentity(port) === identity) :
        ports.filter(isSparkUsbCandidate);
    if (previous && !identity) return {status: 'choose'};
    if (candidates.length !== 1) return {status: candidates.length > 1 ? 'choose' : 'waiting'};
    return {port: candidates[0], status: 'connecting'};
};

export const sortSparkPorts = ports => [...ports].sort((a, b) =>
    Number(isSparkUsbCandidate(b)) - Number(isSparkUsbCandidate(a)) ||
    a.path.localeCompare(b.path, 'en', {numeric: true}));
