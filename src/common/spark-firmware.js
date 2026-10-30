import release from '../main/spark-ai/firmware-release.json';

export const SPARK_FIRMWARE_VERSION = release.version;

export const sparkFirmwareRecoveryPort = port => port &&
    /^0483$/i.test(String(port.vendorId || '')) && /^5740$/i.test(String(port.productId || '')) &&
    !/^BTH/i.test(port.pnpId || '');

export const sparkFirmwareBlockers = (device = {}, report = null, {recovery = false, path} = {}) => {
    const blockers = [];
    if (!report) blockers.push('SPARK_FW_CHECK_FIRST');
    else if (!report.valid) blockers.push('SPARK_FW_RESOURCE_INVALID');
    if (device.connectionMode === 'ble') blockers.push('SPARK_FW_USB_ONLY');
    if (device.busy) blockers.push('SPARK_BUSY');
    if (recovery) {
        if (device.connected) blockers.push('SPARK_FW_DISCONNECT_FIRST');
        if (!((device.discovery && device.discovery.ports) || []).some(port =>
            sparkFirmwareRecoveryPort(port) && port.path === path)) blockers.push('SPARK_FW_SELECT_PORT');
        return blockers;
    }
    if (!device.connected) blockers.push('SPARK_DISCONNECTED');
    // RESET_FWLIB enters the bootloader directly, including from older firmware or a
    // running program. Telemetry freshness and the application version are not update prerequisites.
    if (device.error === 'SPARK_FW_RECOVERY' ||
        (device.discovery && device.discovery.status === 'recovery')) blockers.push('SPARK_FW_RECOVERY');
    if (device.firmware && device.firmware.recoveryRequired) blockers.push('SPARK_FW_RECOVERY');
    return blockers;
};
// A cancelled prompt stays dismissed until the connection or reported version changes.
export const sparkFirmwareMismatchKey = (device = {}) => {
    const version = device.status && device.status.version;
    if (!device.connected || device.connectionMode === 'ble' || device.busy || device.stale ||
        (device.firmware && device.firmware.active) || !Number.isInteger(version) || version <= 0 ||
        version === SPARK_FIRMWARE_VERSION) return null;
    return `${device.port || ''}:${version}`;
};
