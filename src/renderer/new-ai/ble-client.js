import {ipcRenderer} from 'electron';
import {NewAiBleDriver} from './ble-driver';

const driver = new NewAiBleDriver({bluetooth: navigator.bluetooth,
    disconnectSettleMs: process.platform === 'win32' ? 3500 : 0,
    emit: message => ipcRenderer.send('new-ai-ble-data', message)});
const handleRequest = async request => {
    const {id, session, action, data} = request;
    let error;
    let result;
    try {
        if (action === 'choose') result = await driver.choose();
        else if (action === 'open') await driver.open(session, data.id);
        else if (action === 'write') await driver.write(session, data);
        else if (action === 'close') await driver.close(session);
        else throw new Error('NEW_BLE_CONNECT');
    } catch (caught) {
        error = caught.message;
    }
    ipcRenderer.send('new-ai-ble-reply', {id, session, error, data: result});
};
ipcRenderer.on('new-ai-ble-request', (event, request) => handleRequest(request));
window.addEventListener('new-ai-ble-choose', event => handleRequest(event.detail));
ipcRenderer.on('new-ai-ble-abort', (event, {session}) => driver.close(session));
ipcRenderer.on('new-ai-ble-scan-state', (event, state) => {
    if (state.cancelled) driver.cancelChoice();
});
window.addEventListener('beforeunload', () => driver.close());
ipcRenderer.send('new-ai-ble-ready');

export const chooseNewAiBluetooth = async () => {
    await ipcRenderer.invoke('new-ai-ble-scan');
    try {
        const id = await driver.choose();
        await ipcRenderer.invoke('new-ai-ble-bind', id);
        await ipcRenderer.invoke('new-ai-connect', {type: 'ble', id});
    } finally {
        await ipcRenderer.invoke('new-ai-ble-cancel-scan').catch(() => {});
    }
};
