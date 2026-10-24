import {ipcRenderer} from 'electron';
import {SparkBleDriver} from './ble-driver';

const driver = new SparkBleDriver({bluetooth: navigator.bluetooth,
    disconnectSettleMs: process.platform === 'win32' ? 3500 : 0,
    emit: message => ipcRenderer.send('spark-ble-data', message)});
const handleRequest = async request => {
    const {id, session, action, data} = request;
    let error;
    let result;
    try {
        if (action === 'choose') result = await driver.choose();
        else if (action === 'open') await driver.open(session, data.id);
        else if (action === 'write') await driver.write(session, data);
        else if (action === 'close') await driver.close(session);
        else throw new Error('SPARK_BLE_CONNECT');
    } catch (caught) {
        error = caught.message;
    }
    ipcRenderer.send('spark-ble-reply', {id, session, error, data: result});
};
ipcRenderer.on('spark-ble-request', (event, request) => handleRequest(request));
window.addEventListener('spark-ble-choose', event => handleRequest(event.detail));
ipcRenderer.on('spark-ble-abort', (event, {session}) => driver.close(session));
ipcRenderer.on('spark-ble-scan-state', (event, state) => {
    if (state.cancelled) driver.cancelChoice();
});
window.addEventListener('beforeunload', () => driver.close());
ipcRenderer.send('spark-ble-ready');

export const chooseSparkBluetooth = async () => {
    await ipcRenderer.invoke('spark-ble-scan');
    try {
        const id = await driver.choose();
        await ipcRenderer.invoke('spark-ble-bind', id);
        await ipcRenderer.invoke('spark-connect', {type: 'ble', id});
    } finally {
        await ipcRenderer.invoke('spark-ble-cancel-scan').catch(() => {});
    }
};
