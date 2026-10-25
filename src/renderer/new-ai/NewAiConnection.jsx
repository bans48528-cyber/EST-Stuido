/* eslint-disable react/jsx-no-bind */
import React from 'react';
import PropTypes from 'prop-types';
import {createPortal} from 'react-dom';
import {ipcRenderer} from 'electron';
import {dialog, getCurrentWindow} from '@electron/remote';
import {EMPTY_NEW_AI_STATE, subscribeNewAiState} from './runtime-client';
import {newAiText, newAiErrorText} from './runtime-messages';
import NewAiFirmwarePanel from './NewAiFirmwarePanel.jsx';
import NewAiTelemetry from './NewAiTelemetry.jsx';
import {newAiConnectionChanged} from './telemetry';
import {chooseNewAiBluetooth} from './ble-client';
import styles from '../spark-ai/SparkRuntime.css';

export default class NewAiConnection extends React.Component {
    constructor (props) {
        super(props);
        this.state = {device: EMPTY_NEW_AI_STATE,
            open: false,
            selected: '',
            loading: false,
            error: '',
            bleScan: {scanning: false, devices: []}};
        this.latest = EMPTY_NEW_AI_STATE;
        this.trigger = React.createRef();
        this.panel = React.createRef();
        this.keydown = event => {
            event.stopPropagation();
            if (event.key === 'Escape') {
                event.preventDefault(); this.close();
            }
            if (event.key !== 'Tab' || !this.panel.current) return;
            const items = [...this.panel.current.querySelectorAll(
                'button:not(:disabled),select:not(:disabled),input:not(:disabled),summary')];
            const index = items.indexOf(document.activeElement);
            if (event.shiftKey && index <= 0) {
                event.preventDefault(); items[items.length - 1].focus();
            } else if (!event.shiftKey && index === items.length - 1) {
                event.preventDefault(); items[0].focus();
            }
        };
    }
    componentDidMount () {
        this.bleScanListener = (event, bleScan) => {
            if (!this.unmounted) this.setState({bleScan});
        };
        ipcRenderer.on('new-ai-ble-scan-state', this.bleScanListener);
        this.unsubscribe = subscribeNewAiState(device => {
            const previous = this.latest;
            this.latest = device;
            // Numeric readings update their own mounted subscriber, not this dialog and firmware UI.
            if (newAiConnectionChanged(previous, device, this.state.open)) {
                const ports = device.discovery.ports;
                const selected = ports.some(port => port.path === this.state.selected) ? this.state.selected :
                    (device.port || (ports[0] && ports[0].path) || '');
                this.setState({device, selected});
            }
        });
    }
    componentWillUnmount () {
        this.unmounted = true;
        this.unsubscribe();
        ipcRenderer.removeListener('new-ai-ble-scan-state', this.bleScanListener);
        ipcRenderer.invoke('new-ai-ble-cancel-scan').catch(() => {});
        document.removeEventListener('keydown', this.keydown, true);
    }
    open () {
        this.setState({open: true, device: this.latest, error: ''}, () => {
            document.addEventListener('keydown', this.keydown, true);
            this.panel.current.querySelector('button').focus();
        });
        if (this.latest.connectionMode !== 'ble') this.command('new-ai-list-devices');
    }
    close () {
        ipcRenderer.invoke('new-ai-ble-cancel-scan').catch(() => {});
        document.removeEventListener('keydown', this.keydown, true);
        this.setState({open: false}, () => {
            if (this.trigger.current) this.trigger.current.focus();
        });
    }
    async command (channel, request) {
        this.setState({loading: true, error: ''});
        try {
            if (channel === 'new-ai-disconnect' && this.latest.status && this.latest.status.running) {
                const result = await dialog.showMessageBox(getCurrentWindow(), {type: 'warning',
                    message: newAiText('disconnectRunning', this.props.locale),
                    buttons: [newAiText('disconnect', this.props.locale),
                        newAiText('cancelTransfer', this.props.locale)],
                    defaultId: 1,
                    cancelId: 1});
                if (result.response !== 0) return;
                request = {confirmRunning: true};
            }
            if (channel === 'choose-ble') await chooseNewAiBluetooth();
            else await ipcRenderer.invoke(channel, request);
        } catch (error) {
            if (!this.unmounted) this.setState({error: newAiErrorText(error, this.props.locale)});
        } finally {
            if (!this.unmounted) this.setState({loading: false});
        }
    }
    render () {
        const t = key => newAiText(key, this.props.locale);
        const {device, open, selected, loading, error, bleScan} = this.state;
        const ble = device.connectionMode === 'ble';
        const {discovery, status} = device;
        const busy = loading || device.busy;
        const healthy = device.connected && !device.stale;
        const updating = Boolean(device.firmware && device.firmware.active);
        const label = updating ? 'firmwareUpdate' : (device.connected ? 'connected' :
            (device.state === 'verifying' ? 'verifying' :
                (discovery.enabled ? (ble ? 'waitingBle' : 'waiting') : 'disconnected')));
        return (<React.Fragment>
            <button
                id="new-ai-connection"
                type="button"
                ref={this.trigger}
                className={styles.connection}
                title={t('title')}
                aria-label={t('title')}
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={() => this.open()}
            >
                <span className={styles.connectionLabel}>{t(label)}</span>
                <span
                    className={`${styles.dot} ${healthy ? styles.connected :
                        (device.connected ? styles.warning : '')}`}
                />
            </button>
            {open ? createPortal(<div
                className={styles.backdrop}
                onMouseDown={event => {
                    if (event.target === event.currentTarget) this.close();
                }}
            >
                <section
                    id="new-ai-hardware-panel"
                    className={styles.panel}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="new-ai-panel-title"
                    ref={this.panel}
                >
                    <header className={styles.header}>
                        <h2 id="new-ai-panel-title">{t('title')}</h2>
                        <button
                            type="button"
                            className={styles.iconButton}
                            aria-label={t('close')}
                            onClick={() => this.close()}
                        >×</button>
                    </header>
                    <div
                        className={styles.transportModes}
                        role="group"
                        aria-label={t('connectionMode')}
                    >
                        {['usb', 'ble'].map(mode => (<button
                            key={mode}
                            id={`new-ai-mode-${mode}`}
                            type="button"
                            className={styles.command}
                            aria-pressed={(ble ? 'ble' : 'usb') === mode}
                            disabled={busy || bleScan.scanning || Boolean(status && status.running)}
                            onClick={() => this.command('new-ai-connection-mode', mode)}
                        >{mode === 'usb' ? 'USB' : t('bluetooth')}</button>))}
                    </div>
                    {ble ? <div className={styles.bleSection}>
                        <div className={styles.serialRow}>
                            <button
                                id="new-ai-ble-search"
                                type="button"
                                className={styles.command}
                                disabled={(device.busy && !device.reconnecting) || (loading && !bleScan.scanning)}
                                onClick={() => {
                                    if (device.reconnecting) this.command('new-ai-set-auto-connect', false);
                                    else if (bleScan.scanning) {
                                        ipcRenderer.invoke('new-ai-ble-cancel-scan').catch(() => {});
                                    } else this.command(device.connected ? 'new-ai-disconnect' : 'choose-ble');
                                }}
                            >{t(device.reconnecting ? 'pauseReconnect' :
                                    (device.connected ? 'disconnect' :
                                        (bleScan.scanning ? 'cancelSearch' : 'searchBluetooth')))}</button>
                            <span role="status">{t(device.reconnecting ? 'bleReconnecting' :
                                (device.state === 'verifying' ? 'verifying' :
                                    (device.connected ? 'connected' :
                                        (bleScan.scanning ? 'searchingBluetooth' : 'bleHint'))))}</span>
                        </div>
                        {device.bleDevice ? <div className={styles.rememberedDevice}>
                            <span>{t('rememberedDevice')}: {device.bleDevice.name}
                                <small>{device.bleDevice.id}</small></span>
                            <button
                                id="new-ai-ble-forget"
                                type="button"
                                className={styles.command}
                                disabled={busy || device.connected}
                                onClick={() => this.command('new-ai-ble-forget')}
                            >{t('forgetDevice')}</button>
                        </div> : null}
                        {bleScan.scanning && !device.reconnecting ? <ul className={styles.bleDevices}>
                            {bleScan.devices.length ? bleScan.devices.map(item => (<li key={item.id}>
                                <span>{item.name}<small>{item.id}</small></span>
                                <button
                                    type="button"
                                    className={styles.command}
                                    onClick={() => this.command('new-ai-ble-select', item.id)}
                                >{t('connect')}</button>
                            </li>)) : <li>{t('noBluetoothDevices')}</li>}
                        </ul> : null}
                    </div> : <div className={styles.serialRow}>
                        <select
                            aria-label={t('select')}
                            value={selected}
                            disabled={busy || device.connected}
                            onChange={event => this.setState({selected: event.target.value})}
                        >
                            {discovery.ports.length ? null : <option value="">{t('noPorts')}</option>}
                            {discovery.ports.map(port => (<option
                                key={port.path}
                                value={port.path}
                            >
                                {port.friendlyName || port.path}</option>))}
                        </select>
                        <button
                            type="button"
                            className={styles.command}
                            data-action="refresh"
                            disabled={busy}
                            onClick={() => this.command('new-ai-list-devices')}
                        >{t('refresh')}</button>
                        <button
                            type="button"
                            className={styles.command}
                            data-action="connect"
                            disabled={busy || !selected || device.connected}
                            onClick={() => this.command('new-ai-connect', {path: selected})}
                        >{t('connect')}</button>
                        <button
                            type="button"
                            className={styles.command}
                            data-action="disconnect"
                            disabled={busy || !device.connected}
                            onClick={() => this.command('new-ai-disconnect')}
                        >{t('disconnect')}</button>
                    </div>}
                    <div className={styles.autoRow}>
                        <label>
                            <input
                                type="checkbox"
                                checked={discovery.enabled}
                                disabled={busy}
                                onChange={event => this.command('new-ai-set-auto-connect', event.target.checked)}
                            />
                            {t('automatic')}
                        </label>
                        {discovery.status === 'choose' ? <span>{t('choose')}</span> : null}
                    </div>
                    <p
                        id="new-ai-connection-memory"
                        className={styles.notice}
                        role={device.memoryError ? 'status' : null}
                    >{device.memoryError ? newAiErrorText(device.memoryError, this.props.locale) :
                            t('connectionMemoryHint')}</p>
                    {error || device.error ? <div
                        role="alert"
                        className={styles.error}
                    >
                        {error || newAiErrorText(device.error, this.props.locale)}</div> : null}
                    {device.stale ? <p
                        role="status"
                        className={styles.notice}
                    >{t('stale')}</p> : null}
                    {status && status.legacyProtocol ? <p className={styles.notice}>{t('legacyProtocol')}</p> : null}
                    {ble ? <p className={styles.notice}>{t('NEW_FW_USB_ONLY')}</p> : <NewAiFirmwarePanel
                        device={device}
                        locale={this.props.locale}
                    />}
                    <NewAiTelemetry
                        device={device}
                        locale={this.props.locale}
                    />
                    <p className={styles.notice}>{t('pending')}</p>
                </section>
            </div>, document.body) : null}
        </React.Fragment>);
    }
}
NewAiConnection.propTypes = {locale: PropTypes.string.isRequired};
