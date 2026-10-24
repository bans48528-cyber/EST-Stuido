/* eslint-disable react/jsx-no-bind, max-len */
import React from 'react';
import PropTypes from 'prop-types';
import {createPortal} from 'react-dom';
import {ipcRenderer, clipboard} from 'electron';
import {dialog, getCurrentWindow} from '@electron/remote';
import {getEstText} from '../est-i18n';
import {subscribeSparkState, EMPTY_SPARK_STATE} from './runtime-client';
import {sparkRuntimeText, sparkRuntimeError} from './runtime-messages';
import {chooseSparkBluetooth} from './ble-client';
import SparkFirmwarePanel from './SparkFirmwarePanel.jsx';
import styles from './SparkRuntime.css';

export default class SparkConnection extends React.Component {
    constructor (props) {
        super(props);
        this.state = {device: EMPTY_SPARK_STATE,
            open: false,
            ports: [],
            selected: '',
            loading: false,
            error: '',
            bleScan: {scanning: false, devices: []}};
        this.latest = EMPTY_SPARK_STATE;
        this.trigger = React.createRef();
        this.panel = React.createRef();
        this.keydown = event => {
            event.stopPropagation();
            if (event.key === 'Escape') {
                event.preventDefault(); this.close();
            }
            if (event.key !== 'Tab' || !this.panel.current) return;
            const items = [...this.panel.current.querySelectorAll('button:not(:disabled), select:not(:disabled), input:not(:disabled), textarea')];
            const index = items.indexOf(document.activeElement);
            if (event.shiftKey && index <= 0) {
                event.preventDefault(); items[items.length - 1].focus();
            } else if (!event.shiftKey && index === items.length - 1) {
                event.preventDefault(); items[0].focus();
            }
        };
    }
    componentDidMount () {
        this.bleScanListener = (event, bleScan) => this.setState({bleScan});
        ipcRenderer.on('spark-ble-scan-state', this.bleScanListener);
        this.unsubscribe = subscribeSparkState(device => {
            const previous = this.latest;
            this.latest = device;
            const discoveryChanged = (previous.discovery && previous.discovery.revision) !==
                (device.discovery && device.discovery.revision);
            if (this.state.open || discoveryChanged ||
                ['connected', 'compatible', 'state', 'busy', 'stale', 'error', 'warning', 'connectionMode'].some(key => previous[key] !== device[key])) {
                const ports = device.discovery ? device.discovery.ports : this.state.ports;
                const selected = device.connected && device.port ? device.port :
                    (ports.some(port => port.path === this.state.selected) ? this.state.selected :
                        ((ports[0] && ports[0].path) || ''));
                this.setState({device, ports, selected});
            }
        });
    }
    componentWillUnmount () {
        this.unmounted = true;
        this.unsubscribe();
        ipcRenderer.removeListener('spark-ble-scan-state', this.bleScanListener);
        ipcRenderer.invoke('spark-ble-cancel-scan').catch(() => {});
        document.removeEventListener('keydown', this.keydown, true);
    }
    async scan () {
        this.setState({loading: true, error: ''});
        try {
            const ports = await ipcRenderer.invoke('spark-list-devices');
            if (this.unmounted) return;
            const selected = ports.some(port => port.path === this.state.selected) ?
                this.state.selected : ((ports[0] && ports[0].path) || '');
            this.setState({ports, selected});
        } catch (error) {
            if (!this.unmounted) this.setState({error: sparkRuntimeError(error, this.props.locale)});
        } finally {
            if (!this.unmounted) this.setState({loading: false});
        }
    }
    open () {
        this.setState({open: true, device: this.latest, error: ''}, () => {
            document.addEventListener('keydown', this.keydown, true);
            this.panel.current.querySelector('button').focus();
        });
        if (this.latest.connectionMode !== 'ble') this.scan();
    }
    close () {
        ipcRenderer.invoke('spark-ble-cancel-scan').catch(() => {});
        document.removeEventListener('keydown', this.keydown, true);
        this.setState({open: false}, () => {
            if (this.trigger.current) this.trigger.current.focus();
        });
    }
    async command (channel, request) {
        this.setState({loading: true, error: ''});
        try {
            if (channel === 'spark-disconnect' && this.latest.status && this.latest.status.running) {
                const result = await dialog.showMessageBox(getCurrentWindow(), {type: 'warning',
                    message: sparkRuntimeText('disconnectWarning', this.props.locale),
                    buttons: [getEstText('hardwareChoice.confirm', this.props.locale),
                        getEstText('hardwareChoice.cancel', this.props.locale)],
                    defaultId: 1,
                    cancelId: 1});
                if (result.response !== 0) return;
                request = {confirmRunning: true};
            }
            if (channel === 'choose-ble') await chooseSparkBluetooth();
            else await ipcRenderer.invoke(channel, request);
        } catch (error) {
            if (!this.unmounted) this.setState({error: sparkRuntimeError(error, this.props.locale)});
        } finally {
            if (!this.unmounted) this.setState({loading: false});
        }
    }
    render () {
        const {locale} = this.props;
        const t = (id, values) => sparkRuntimeText(id, locale, values);
        const {device, open, ports, selected, loading, error, bleScan} = this.state;
        const ble = device.connectionMode === 'ble';
        const status = device.status;
        const connected = device.connected;
        const healthy = connected && device.compatible && !device.stale;
        const discovery = device.discovery;
        const label = device.firmware && device.firmware.active ? t('firmwareUpdate') :
            t(['opening', 'disconnecting'].includes(device.state) ? device.state : (connected ? 'connected' :
                (device.reconnecting ? 'bleReconnecting' :
                    (!ble && discovery && discovery.status === 'waiting' ? 'autoWaiting' : 'disconnected'))));
        const unknown = t('unknown');
        const busy = loading || device.busy;
        const log = (device.logs || []).map(line => `${new Date(line.time).toLocaleTimeString(locale)}  ${line.text}`).join('\n');
        return (<React.Fragment>
            <button
                id="spark-connection"
                type="button"
                ref={this.trigger}
                className={styles.connection}
                title={t('status')}
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={() => this.open()}
            >
                <span className={styles.connectionLabel}>{label}</span>
                <span className={`${styles.dot} ${healthy ? styles.connected : (connected ? styles.warning : '')}`} />
            </button>
            {open ? createPortal(<div
                className={styles.backdrop}
                onMouseDown={event => {
                    if (event.target === event.currentTarget) this.close();
                }}
            >
                <section
                    id="spark-hardware-panel"
                    className={styles.panel}
                    ref={this.panel}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="spark-hardware-title"
                >
                    <header className={styles.header}>
                        <h2 id="spark-hardware-title">Spark AI · {ble ? t('bluetooth') : 'USB'}</h2>
                        <button
                            type="button"
                            className={styles.iconButton}
                            onClick={() => this.close()}
                            aria-label={getEstText('hardwareChoice.close', locale)}
                            title={getEstText('hardwareChoice.close', locale)}
                        >&times;</button>
                    </header>
                    <div
                        className={styles.transportModes}
                        role="group"
                        aria-label={t('connectionMode')}
                    >
                        {['usb', 'ble'].map(mode => (<button
                            key={mode}
                            id={`spark-mode-${mode}`}
                            type="button"
                            className={styles.command}
                            aria-pressed={(ble ? 'ble' : 'usb') === mode}
                            disabled={busy || bleScan.scanning || Boolean(status && status.running)}
                            onClick={() => this.command('spark-connection-mode', mode)}
                        >{mode === 'usb' ? 'USB' : t('bluetooth')}</button>))}
                    </div>
                    {ble ? <div className={styles.bleSection}>
                        <div className={styles.serialRow}>
                            <button
                                id="spark-ble-search"
                                type="button"
                                className={styles.command}
                                disabled={(device.busy && !device.reconnecting) || (loading && !bleScan.scanning)}
                                onClick={() => {
                                    if (device.reconnecting) this.command('spark-set-auto-connect', false);
                                    else if (bleScan.scanning) ipcRenderer.invoke('spark-ble-cancel-scan').catch(() => {});
                                    else this.command(connected ? 'spark-disconnect' : 'choose-ble');
                                }}
                            >{t(device.reconnecting ? 'pauseReconnect' :
                                    (connected ? 'disconnect' : (bleScan.scanning ? 'cancelSearch' : 'searchBluetooth')))}</button>
                            <span role="status">{t(device.reconnecting ? 'bleReconnecting' :
                                (['opening', 'disconnecting'].includes(device.state) ? device.state :
                                    (bleScan.scanning ? 'searchingBluetooth' :
                                        (connected ? 'connected' : 'bleManualReconnect'))))}</span>
                        </div>
                        {device.bleDevice ? <div className={styles.rememberedDevice}>
                            <span>{t('rememberedDevice')}: {device.bleDevice.name}<small>{device.bleDevice.id}</small></span>
                            <button
                                id="spark-ble-forget"
                                type="button"
                                className={styles.command}
                                disabled={busy || connected}
                                onClick={() => this.command('spark-ble-forget')}
                            >{t('forgetDevice')}</button>
                        </div> : null}
                        {bleScan.scanning && !device.reconnecting ? <ul className={styles.bleDevices}>
                            {bleScan.devices.length ? bleScan.devices.map(item => (<li key={item.id}>
                                <span>{item.name}<small>{item.id}</small></span>
                                <button
                                    type="button"
                                    className={styles.command}
                                    onClick={() => ipcRenderer.invoke('spark-ble-select', item.id).catch(caught =>
                                        this.setState({error: sparkRuntimeError(caught, locale)}))}
                                >{t('connect')}</button>
                            </li>)) : <li>{t('noBluetoothDevices')}</li>}
                        </ul> : null}
                    </div> : <div className={styles.serialRow}>
                        <label htmlFor="spark-serial-port">{t('serial')}</label>
                        <select
                            id="spark-serial-port"
                            value={selected}
                            disabled={busy || connected}
                            onChange={event => this.setState({selected: event.target.value})}
                        >
                            {ports.length ? null : <option value="">{t('noPorts')}</option>}
                            {ports.map(port => (<option
                                key={port.path}
                                value={port.path}
                            >
                                {port.path}{port.friendlyName || port.manufacturer ? ` · ${port.friendlyName || port.manufacturer}` : ''}
                            </option>))}
                        </select>
                        <button
                            type="button"
                            className={styles.iconButton}
                            disabled={busy || connected}
                            onClick={() => this.scan()}
                            title={t('refresh')}
                            aria-label={t('refresh')}
                        >↻</button>
                        <button
                            type="button"
                            className={styles.command}
                            disabled={busy || (!connected && !selected)}
                            id="spark-usb-connect"
                            onClick={() => (connected ? this.command('spark-disconnect') :
                                this.command('spark-connect', {path: selected}))}
                        >
                            {t(connected ? 'disconnect' : (busy ? 'opening' : 'connect'))}
                        </button>
                    </div>}
                    {discovery ? <div className={styles.autoRow}>
                        <label htmlFor="spark-auto-connect">
                            <input
                                id="spark-auto-connect"
                                type="checkbox"
                                checked={discovery.enabled}
                                disabled={loading || (device.busy && !device.reconnecting)}
                                onChange={event => this.command('spark-set-auto-connect', event.target.checked)}
                            />{t(ble ? 'bleAutoConnect' : 'autoConnect')}
                        </label>
                        <span role="status">{t(device.firmware && device.firmware.recoveryRequired ?
                            'SPARK_FW_RECOVERY' : (ble && !device.bleDevice ? 'bleChooseFirst' :
                                `auto.${discovery.status}`))}</span>
                    </div> : null}
                    {error || device.error ? <div
                        className={styles.error}
                        role="alert"
                    >
                        {error || t(device.error)}
                    </div> : null}
                    {device.warning ? <div
                        className={styles.notice}
                        role="status"
                    >{t(device.warning)}</div> : null}
                    <dl className={styles.summary}>
                        <div><dt>{t('firmware')}</dt><dd>{status ? status.version : unknown}</dd></div>
                        <div><dt>{t('battery')}</dt><dd>{status && status.battery !== null ? `${status.battery}%` : unknown}</dd></div>
                        <div><dt>{t('flash')}</dt><dd>{status ? `${status.flash.free || unknown} / ${status.flash.total || unknown}` : unknown}</dd></div>
                        <div><dt>{t('heap')}</dt><dd>{status && status.heap !== null ? status.heap : unknown}</dd></div>
                        <div><dt>{t('programState')}</dt><dd>{status ? t(status.running ? 'running' : 'idle') : unknown}</dd></div>
                    </dl>
                    <SparkFirmwarePanel
                        locale={locale}
                        device={device}
                    />
                    <div className={styles.monitorRow}>
                        <label><input
                            type="checkbox"
                            checked={device.monitoring !== false}
                            disabled={!connected || busy || Boolean(status && status.running)}
                            onChange={event => this.command('spark-set-monitoring', event.target.checked)}
                        />{t('monitoring')}</label>
                        {device.stale || !device.monitoring ? <span>{t(device.monitoring ? 'stale' : 'paused')}</span> : null}
                    </div>
                    <div className={styles.ports}>
                        {Array.from({length: 4}, (unused, index) => {
                            const port = status && status.ports.find(item => item.port === index);
                            return (<div
                                className={styles.port}
                                key={index}
                            >
                                <strong>{'ABCD'[index]}</strong><span>{port ? t(port.type) : unknown}</span>
                                <div className={styles.portValues}>{port ? Object.entries(port.values).map(([key, value]) =>
                                    <span key={key}>{t(key)}: {value === null ? unknown : value}</span>) : null}</div>
                            </div>);
                        })}
                    </div>
                    <div className={styles.logHeader}><h3>{t('logs')}</h3>
                        <button
                            type="button"
                            className={styles.iconButton}
                            title={t('copy')}
                            aria-label={t('copy')}
                            disabled={!log}
                            onClick={() => clipboard.writeText(log)}
                        >⧉</button>
                        <button
                            type="button"
                            className={styles.iconButton}
                            title={t('clear')}
                            aria-label={t('clear')}
                            disabled={!log || busy}
                            onClick={() => this.command('spark-clear-logs')}
                        >×</button>
                    </div>
                    <textarea
                        className={styles.logs}
                        readOnly
                        value={log}
                        aria-label={t('logs')}
                    />
                </section>
            </div>, document.body) : null}
        </React.Fragment>);
    }
}
SparkConnection.propTypes = {locale: PropTypes.string.isRequired};
