/* eslint-disable react/jsx-no-bind */
import React from 'react';
import PropTypes from 'prop-types';
import {hardwareStatusText} from './status-messages';
import styles from './HardwareConnectionSettings.css';

const TransportIcon = ({bluetooth = false}) => (<svg
    viewBox="0 0 24 24"
    aria-hidden="true"
>
    {bluetooth ? <path d="m7 7 10 10-5 4V3l5 4L7 17" /> : <React.Fragment>
        <rect
            x="6"
            y="8"
            width="12"
            height="9"
            rx="2"
        />
        <path d="M9 8V4m6 4V4m-3 13v4" />
    </React.Fragment>}
</svg>);
TransportIcon.propTypes = {bluetooth: PropTypes.bool};

// One layout for all adapters; callbacks retain each device's existing transport commands.
const HardwareConnectionSettings = ({hardwareId, locale, device, busy, connecting, ports = [], selected = '',
    scanning = false, bluetoothDevices = [], onMode, onSelectPort, onRefresh, onConnect, onDisconnect,
    onSearch, onCancelSearch, onSelectBluetooth, onForget, onPauseReconnect, onAutoChange,
    autoStatus, memoryError}) => {
    const t = key => hardwareStatusText(key, locale);
    const prefix = hardwareId === 'spark-ai' ? 'spark' : hardwareId;
    const hid = hardwareId === 'est';
    const ble = !hid && device.connectionMode === 'ble';
    const connected = Boolean(device.connected);
    const reconnecting = Boolean(device.reconnecting);
    const remembered = device.bleDevice;
    const modeLocked = busy || scanning || Boolean(device.status && device.status.running);
    const discovery = device.discovery;
    const bluetoothAction = () => {
        if (reconnecting) onPauseReconnect();
        else if (connected) onDisconnect();
        else if (scanning) onCancelSearch();
        else onSearch();
    };
    return (<section
        className={styles.form}
        data-connection-settings={hardwareId}
        aria-label={t('connection')}
    >
        <h3>{t('connection')}</h3>
        <div
            className={styles.modes}
            role="group"
            aria-label={t('connectionMethod')}
        >
            {(hid ? ['usb'] : ['usb', 'ble']).map(mode => (<button
                id={`${prefix}-mode-${mode}`}
                key={mode}
                type="button"
                aria-pressed={(ble ? 'ble' : 'usb') === mode}
                disabled={modeLocked}
                onClick={() => {
                    if (onMode) onMode(mode);
                }}
            ><TransportIcon bluetooth={mode === 'ble'} />{mode === 'usb' ? 'USB' : t('bluetooth')}</button>))}
        </div>
        <div
            className={styles.state}
            role="status"
            data-connected={connected}
        >
            <span className={styles.dot} />
            <span>{t(connected ? 'connected' : (reconnecting || connecting ? 'connecting' : 'disconnected'))}</span>
            {connected ? <span className={styles.address}>{ble ? remembered && remembered.name :
                (hid ? 'EST · USB' : device.port)}</span> : null}
        </div>
        {ble ? <React.Fragment>
            <p className={styles.hint}>{t(scanning ? 'searching' : 'bluetoothHint')}</p>
            {remembered ? <div className={styles.remembered}>
                <div><span>{t('rememberedDevice')}</span><strong>{remembered.name}</strong>
                    <small>{remembered.id}</small></div>
                <button
                    id={`${prefix}-ble-forget`}
                    type="button"
                    disabled={busy || connected}
                    onClick={onForget}
                >{t('forgetDevice')}</button>
            </div> : null}
            <button
                id={`${prefix}-ble-search`}
                data-action="bluetooth"
                className={connected || scanning || reconnecting ? styles.secondary : styles.primary}
                type="button"
                disabled={busy && !reconnecting && !scanning}
                onClick={bluetoothAction}
            >{t(reconnecting ? 'pauseReconnect' :
                    (connected ? 'disconnect' : (scanning ? 'cancelSearch' : 'searchBluetooth')))}</button>
            {scanning && !reconnecting ? <ul className={styles.devices}>
                {bluetoothDevices.length ? bluetoothDevices.map(item => (<li key={item.id}>
                    <div><strong>{item.name}</strong><small>{item.id}</small></div>
                    <button
                        type="button"
                        data-action="ble-select"
                        onClick={() => onSelectBluetooth(item.id)}
                    >
                        {t('connect')}</button>
                </li>)) : <li className={styles.hint}>{t('noBluetoothDevices')}</li>}
            </ul> : null}
        </React.Fragment> : <React.Fragment>
            <div className={styles.usbField}>
                <label htmlFor={`${prefix}-serial-port`}>{t('usbDevice')}</label>
                <div className={styles.usbRow}>
                    {hid ? <input
                        id={`${prefix}-serial-port`}
                        className={styles.hidDevice}
                        value="EST · USB"
                        readOnly
                    /> : <select
                        id={`${prefix}-serial-port`}
                        aria-label={t('usbDevice')}
                        value={selected}
                        disabled={busy || connected}
                        onChange={event => onSelectPort(event.target.value)}
                    >
                        {ports.length ? null : <option value="">{t('noUsbDevices')}</option>}
                        {ports.map(port => (<option
                            key={port.path}
                            value={port.path}
                        >
                            {port.path}{port.friendlyName || port.manufacturer ?
                                ` · ${port.friendlyName || port.manufacturer}` : ''}
                        </option>))}
                    </select>}
                    <button
                        id={`${prefix}-usb-refresh`}
                        type="button"
                        data-action="refresh"
                        disabled={busy}
                        onClick={onRefresh}
                    >{t('retry')}</button>
                </div>
            </div>
            <button
                id={`${prefix}-usb-connect`}
                data-action={connected ? 'disconnect' : 'connect'}
                type="button"
                className={connected ? styles.secondary : styles.primary}
                disabled={busy || (!connected && !hid && !selected)}
                onClick={connected ? onDisconnect : onConnect}
            >{t(connected ? 'disconnect' : (connecting ? 'connecting' : 'connect'))}</button>
            <p className={styles.hint}>{t(hid ? 'hidHint' : 'usbHint')}</p>
        </React.Fragment>}
        {discovery && onAutoChange ? <div className={styles.automatic}>
            <label htmlFor={`${prefix}-auto-connect`}>
                <input
                    id={`${prefix}-auto-connect`}
                    type="checkbox"
                    checked={Boolean(discovery.enabled)}
                    disabled={busy && !reconnecting}
                    onChange={event => onAutoChange(event.target.checked)}
                />{t(ble ? 'autoReconnect' : 'autoConnect')}
            </label>
            {autoStatus ? <p role="status">{autoStatus}</p> : null}
        </div> : null}
        {memoryError ? <p
            className={styles.error}
            role="alert"
        >{memoryError}</p> : null}
    </section>);
};
HardwareConnectionSettings.propTypes = {
    hardwareId: PropTypes.oneOf(['est', 'spark-ai', 'new-ai']).isRequired,
    locale: PropTypes.string.isRequired,
    device: PropTypes.shape({connected: PropTypes.bool,
        connectionMode: PropTypes.string,
        reconnecting: PropTypes.bool,
        port: PropTypes.string,
        bleDevice: PropTypes.shape({name: PropTypes.string,
            id: PropTypes.string}),
        status: PropTypes.shape({running: PropTypes.bool}),
        discovery: PropTypes.shape({enabled: PropTypes.bool})}).isRequired,
    busy: PropTypes.bool,
    connecting: PropTypes.bool,
    ports: PropTypes.arrayOf(PropTypes.shape({path: PropTypes.string})),
    selected: PropTypes.string,
    scanning: PropTypes.bool,
    bluetoothDevices: PropTypes.arrayOf(PropTypes.shape({id: PropTypes.string, name: PropTypes.string})),
    onMode: PropTypes.func,
    onSelectPort: PropTypes.func,
    onRefresh: PropTypes.func.isRequired,
    onConnect: PropTypes.func.isRequired,
    onDisconnect: PropTypes.func.isRequired,
    onSearch: PropTypes.func,
    onCancelSearch: PropTypes.func,
    onSelectBluetooth: PropTypes.func,
    onForget: PropTypes.func,
    onPauseReconnect: PropTypes.func,
    onAutoChange: PropTypes.func,
    autoStatus: PropTypes.string,
    memoryError: PropTypes.string
};
export default HardwareConnectionSettings;
