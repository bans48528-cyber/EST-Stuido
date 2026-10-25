import {DEFAULT_HARDWARE_ID, getHardwareProfile} from '../../common/hardware-profiles';

export const HARDWARE_CHANGED_EVENT = 'est-hardware-changed';
let hardwareId = DEFAULT_HARDWARE_ID;
let busy = false;
let generation = 0;

export const getHardwareContext = () => ({profile: getHardwareProfile(hardwareId), busy, generation});

export const setHardwareContext = (id, loading = false) => {
    getHardwareProfile(id);
    hardwareId = id;
    busy = loading;
    generation++;
    if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
        window.dispatchEvent(new CustomEvent(HARDWARE_CHANGED_EVENT, {detail: getHardwareContext()}));
    }
};

export const isEstHardwareActive = () => !busy && getHardwareProfile(hardwareId).adapter === 'est-hid';

export const isAiHardwareActive = () => !busy && ['est', 'spark-ai', 'new-ai'].includes(hardwareId);
