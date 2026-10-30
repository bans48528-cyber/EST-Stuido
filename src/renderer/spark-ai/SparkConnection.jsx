/* eslint-disable react/jsx-no-bind, max-len */
import React from 'react';
import PropTypes from 'prop-types';
import HardwareStatusPopover from '../hardware/HardwareStatusPopover.jsx';
import HardwareConnectionSettings from '../hardware/HardwareConnectionSettings.jsx';
import {hardwareStatusText} from '../hardware/status-messages';
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
        this.firmware = React.createRef();
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
            const firmwareChanged = ['active', 'phase', 'bytes', 'error', 'recoveryRequired'].some(key =>
                (previous.firmware && previous.firmware[key]) !== (device.firmware && device.firmware[key]));
            const versionChanged = (previous.status && previous.status.version) !== (device.status && device.status.version);
            if (this.state.open || discoveryChanged || firmwareChanged || versionChanged || previous.port !== device.port ||
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
        if (this.state.open) {
            this.close(); return;
        }
        this.setState({open: true, device: this.latest, error: ''}, () => {
            // The non-modal popover manages its own focus and Escape key.
        });
        if (this.latest.connectionMode !== 'ble') this.scan();
    }
    close (restoreFocus = true) {
        ipcRenderer.invoke('spark-ble-cancel-scan').catch(() => {});
        document.removeEventListener('keydown', this.keydown, true);
        this.setState({open: false}, () => {
            if (restoreFocus && this.trigger.current) this.trigger.current.focus();
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
        const status = device.connected && !device.stale ? device.status : null;
        const connected = device.connected;
        const healthy = connected && device.compatible && !device.stale;
        const discovery = device.discovery;
        const label = device.firmware && device.firmware.active ? t('firmwareUpdate') :
            hardwareStatusText(connected ? 'connected' :
                (['opening', 'disconnecting'].includes(device.state) || device.reconnecting ?
                    'connecting' : 'disconnected'), locale);
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
            {open ? <HardwareStatusPopover
                hardwareId="spark-ai"
                device={device}
                locale={this.props.locale}
                triggerRef={this.trigger}
                onClose={() => this.close()}
                disabled={busy}
                notice={error || (device.error && sparkRuntimeError(device.error, locale)) || (device.warning && t(device.warning))}
                onDisconnect={() => this.command('spark-disconnect')}
                connectionContent={<HardwareConnectionSettings
                    hardwareId="spark-ai"
                    locale={locale}
                    device={device}
                    busy={Boolean(busy)}
                    connecting={['opening', 'disconnecting'].includes(device.state)}
                    ports={ports}
                    selected={selected}
                    scanning={bleScan.scanning}
                    bluetoothDevices={bleScan.devices}
                    onMode={mode => this.command('spark-connection-mode', mode)}
                    onSelectPort={value => this.setState({selected: value})}
                    onRefresh={() => this.scan()}
                    onConnect={() => this.command('spark-connect', {path: selected})}
                    onDisconnect={() => this.command('spark-disconnect')}
                    onSearch={() => this.command('choose-ble')}
                    onCancelSearch={() => ipcRenderer.invoke('spark-ble-cancel-scan').catch(() => {})}
                    onSelectBluetooth={id => ipcRenderer.invoke('spark-ble-select', id).catch(caught =>
                        this.setState({error: sparkRuntimeError(caught, locale)}))}
                    onForget={() => this.command('spark-ble-forget')}
                    onPauseReconnect={() => this.command('spark-set-auto-connect', false)}
                    onAutoChange={value => this.command('spark-set-auto-connect', value)}
                    autoStatus={discovery && !device.error ? t(ble && !device.bleDevice ?
                        'bleChooseFirst' : `auto.${discovery.status}`) : ''}
                />}
                infoContent={<React.Fragment>
                    <dl className={styles.summary}>
                        <div><dt>{t('firmware')}</dt><dd>{status ? status.version : unknown}</dd></div>
                        <div><dt>{t('battery')}</dt><dd>{status && Number.isFinite(status.battery) ? `${status.battery}%` : unknown}</dd></div>
                        <div><dt>{t('flash')}</dt><dd>{status ? `${status.flash.free || unknown} / ${status.flash.total || unknown}` : unknown}</dd></div>
                        <div><dt>{t('heap')}</dt><dd>{status && Number.isFinite(status.heap) ? status.heap : unknown}</dd></div>
                        <div><dt>{t('programState')}</dt><dd>{status ? t(status.running ? 'running' : 'idle') : unknown}</dd></div>
                    </dl>
                    <section className={styles.firmwareSection}>
                        <button
                            id="spark-firmware-toggle"
                            type="button"
                            className={styles.command}
                            disabled={busy}
                            onClick={() => this.firmware.current.open()}
                        >{t('firmwareUpdate')}</button>
                    </section>
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
                </React.Fragment>}
            /> : null}
            <SparkFirmwarePanel
                ref={this.firmware}
                locale={locale}
                device={device}
                onOpen={() => this.close(false)}
            />
        </React.Fragment>);
    }
}
SparkConnection.propTypes = {locale: PropTypes.string.isRequired};
