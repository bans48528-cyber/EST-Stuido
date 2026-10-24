import {ipcRenderer} from 'electron';

export const EMPTY_SPARK_STATE = Object.freeze({state: 'disconnected',
    connected: false,
    compatible: false,
    busy: false,
    compilerSupported: false,
    logs: []});
const listeners = new Set();
let latest = null;
let generation = 0;
let updates = 0;
const receive = (event, state) => {
    updates++;
    latest = state || EMPTY_SPARK_STATE;
    listeners.forEach(listener => listener(latest));
};
export const subscribeSparkState = callback => {
    const first = listeners.size === 0;
    listeners.add(callback);
    if (latest) callback(latest);
    if (first) {
        const revision = ++generation;
        const beforeRequest = updates;
        ipcRenderer.on('spark-state-change', receive);
        ipcRenderer.invoke('spark-state').then(state => {
            if (revision === generation && updates === beforeRequest) receive(null, state);
        })
            .catch(() => {
                if (revision === generation && updates === beforeRequest) receive(null, EMPTY_SPARK_STATE);
            });
    }
    return () => {
        listeners.delete(callback);
        if (listeners.size) return;
        generation++;
        latest = null;
        ipcRenderer.removeListener('spark-state-change', receive);
    };
};
