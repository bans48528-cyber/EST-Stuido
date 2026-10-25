export const newAiFirmwareBlockers = (device = {}, report, request = {}) => {
    const blockers = [];
    if (device.connectionMode === 'ble') blockers.push('NEW_FW_USB_ONLY');
    if (!report) blockers.push('NEW_FW_CHECK_FIRST');
    else if (!report.valid) blockers.push('NEW_FW_RESOURCE_INVALID');
    if (device.busy) blockers.push('NEW_BUSY');
    if (request.recovery) {
        if (device.connected) blockers.push('NEW_FW_DISCONNECT_FIRST');
        if (!request.confirmedRecoveryDevice) blockers.push('NEW_FW_CONFIRM_DEVICE');
        if (!((device.discovery && device.discovery.ports) || []).some(port => port.path === request.path)) {
            blockers.push('NEW_FW_SELECT_PORT');
        }
        return blockers;
    }
    if (!device.connected) blockers.push('NEW_DISCONNECTED');
    if (device.connected && (!device.identityVerified || !device.status || device.stale)) {
        blockers.push('NEW_FW_STATUS_REQUIRED');
    }
    if (device.status && device.status.legacyProtocol) {
        if (!request.confirmedLegacyIdle) blockers.push('NEW_FW_LEGACY_IDLE');
    } else if (device.status && device.status.running !== false) blockers.push('NEW_FW_STOP_FIRST');
    if (device.firmware && device.firmware.recoveryRequired) blockers.push('NEW_FW_RECOVERY');
    return blockers;
};
