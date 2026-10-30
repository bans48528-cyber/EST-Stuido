// NEW AI's 0x32 command selects onboard images; it does not upload a PC image.
import {NEW_FIRMWARE_VERSION} from './new-ai-firmware';

const TYPES = Object.freeze({big_motor: 0xA1, small_motor: 0xA6, color: 0xA2, gray: 0xA9, gray_v2: 0xB0});
const version = value => {
    if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') return null;
    const number = Number(value);
    return Number.isInteger(number) && number >= 0 && number <= 65535 ? number : null;
};
export const newAiPeripheralVersions = port => {
    const values = (port && port.values) || {};
    return {current: version(values.version),
        target: version('SoftwareVersion' in values ? values.SoftwareVersion : values.Softwareversion)};
};
export const newAiPeripheralMismatches = status => {
    if (!status || status.legacyProtocol || !Array.isArray(status.ports)) return [];
    return status.ports.filter(port => port && Object.prototype.hasOwnProperty.call(TYPES, port.type) &&
        Number.isInteger(port.port) && port.port >= 0 && port.port < 8 &&
        !(port.values && 'Not_Run' in port.values))
        .map(port => ({port: port.port,
            label: 'ABCDEFGH'[port.port],
            type: port.type,
            ...newAiPeripheralVersions(port)}))
        .filter(item => item.current !== null && item.target > 0 && item.current !== item.target)
        .sort((a, b) => a.port - b.port);
};
export const newAiPeripheralPayload = targets => {
    const payload = Array(8).fill(0xFF);
    for (const item of targets) payload[item.port] = TYPES[item.type];
    return payload;
};
export const newAiPeripheralSignature = status => JSON.stringify(newAiPeripheralMismatches(status));
export const newAiPeripheralPromptKey = device => {
    if (!device.connected || device.stale || device.busy || !device.status || device.status.running ||
        device.status.version !== NEW_FIRMWARE_VERSION || (device.firmware && device.firmware.active)) return null;
    const targets = newAiPeripheralMismatches(device.status);
    return targets.length ?
        JSON.stringify([device.connectionRevision, device.connectionMode, device.port, targets]) : null;
};
