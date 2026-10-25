import {ipcRenderer} from 'electron';

export const EMPTY_NEW_AI_STATE = Object.freeze({state: 'disconnected',
    connectionMode: 'usb',
    bleDevice: null,
    reconnecting: false,
    connected: false,
    busy: false,
    status: null,
    discovery: {enabled: true, ports: [], status: 'waiting'}});
const listeners = new Set();
let latest = null;
let generation = 0;
let updates = 0;
const receive = (event, state) => {
    updates++;
    latest = state || EMPTY_NEW_AI_STATE;
    listeners.forEach(listener => listener(latest));
};
export const subscribeNewAiState = callback => {
    const first = listeners.size === 0;
    listeners.add(callback);
    if (latest) callback(latest);
    if (first) {
        const revision = ++generation;
        const beforeRequest = updates;
        ipcRenderer.on('new-ai-state-change', receive);
        ipcRenderer.invoke('new-ai-state').then(state => {
            if (revision === generation && updates === beforeRequest) receive(null, state);
        })
            .catch(() => {
                if (revision === generation && updates === beforeRequest) receive(null, EMPTY_NEW_AI_STATE);
            });
    }
    return () => {
        listeners.delete(callback);
        if (listeners.size) return;
        generation++;
        latest = null;
        ipcRenderer.removeListener('new-ai-state-change', receive);
    };
};
