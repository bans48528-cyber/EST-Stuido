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
    if (device.connected && (!device.status || device.stale || device.monitoring === false)) {
        blockers.push('SPARK_FW_STATUS_REQUIRED');
    }
    if (device.status && device.status.running) blockers.push('SPARK_STOP_FIRST');
    if (device.connected && device.status && !device.compatible) blockers.push('SPARK_FW_DEVICE_UNVERIFIED');
    if (device.error === 'SPARK_FW_RECOVERY' ||
        (device.discovery && device.discovery.status === 'recovery')) blockers.push('SPARK_FW_RECOVERY');
    if (device.firmware && device.firmware.recoveryRequired) blockers.push('SPARK_FW_RECOVERY');
    return blockers;
};
