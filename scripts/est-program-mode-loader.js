/**
 * Lock OpenBlock's GUI state to upload mode. The action creators remain
 * available for upstream compatibility, but realtime-mode and switch-support
 * actions cannot change the EST Studio mode.
 * @param {string} source - OpenBlock program-mode reducer source.
 * @returns {string} transformed reducer source.
 */
module.exports = function (source) {
    const initialRealtimeState = '    isRealtimeMode: true,';
    const realtimeActionState = '            isRealtimeMode: true';
    const switchState = '            isSupportSwitchMode: action.state';

    if (!source.includes(initialRealtimeState)) {
        throw new Error('Unable to locate the OpenBlock initial program mode.');
    }
    if (!source.includes(realtimeActionState)) {
        throw new Error('Unable to locate the OpenBlock realtime-mode reducer state.');
    }
    if (!source.includes(switchState)) {
        throw new Error('Unable to locate the OpenBlock mode-switch reducer state.');
    }

    return source
        .replace(initialRealtimeState, '    isRealtimeMode: false,')
        .replace(realtimeActionState, '            isRealtimeMode: false')
        .replace(switchState, '            isSupportSwitchMode: false');
};
