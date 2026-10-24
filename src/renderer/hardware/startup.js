import {ipcRenderer} from 'electron';
import {setHardwareContext} from './context';

// Restore before importing the app: its VM and default project use this context.
export const initializeHardwareSelection = async () => {
    const state = await ipcRenderer.invoke('hardware-state');
    setHardwareContext(state && state.hardwareId);
    return state.hardwareId;
};
