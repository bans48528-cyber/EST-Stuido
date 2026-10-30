/* eslint-disable react/jsx-no-bind */
import React from 'react';
import PropTypes from 'prop-types';
import HardwareStatusPopover from '../hardware/HardwareStatusPopover.jsx';
import HardwareConnectionSettings from '../hardware/HardwareConnectionSettings.jsx';
import {hardwareStatusText} from '../hardware/status-messages';
import {ipcRenderer} from 'electron';
import {dialog, getCurrentWindow} from '@electron/remote';
import {EMPTY_NEW_AI_STATE, subscribeNewAiState} from './runtime-client';
import {newAiText, newAiErrorText} from './runtime-messages';
import NewAiFirmwarePanel from './NewAiFirmwarePanel.jsx';
import NewAiPeripheralPanel from './NewAiPeripheralPanel.jsx';
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
        this.firmwarePanel = React.createRef();
        this.peripheralPanel = React.createRef();
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
        if (this.state.open) {
            this.close(); return;
        }
        this.setState({open: true, device: this.latest, error: ''}, () => {
            // The non-modal popover manages its own focus and Escape key.
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
        const {discovery} = device;
        const busy = loading || device.busy;
        const healthy = device.connected && !device.stale;
        const updating = Boolean(device.firmware && device.firmware.active);
        const label = updating ? t('firmwareUpdate') : hardwareStatusText(device.connected ? 'connected' :
            (device.state === 'verifying' || device.reconnecting ? 'connecting' : 'disconnected'), this.props.locale);
        return (<React.Fragment>
            <NewAiFirmwarePanel
                ref={this.firmwarePanel}
                device={device}
                locale={this.props.locale}
                onOpen={() => this.close()}
                onClose={() => this.peripheralPanel.current.maybePrompt()}
            />
            <NewAiPeripheralPanel
                ref={this.peripheralPanel}
                device={device}
                locale={this.props.locale}
                onOpen={() => this.close()}
            />
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
                <span className={styles.connectionLabel}>{label}</span>
                <span
                    className={`${styles.dot} ${healthy ? styles.connected :
                        (device.connected ? styles.warning : '')}`}
                />
            </button>
            {open ? <HardwareStatusPopover
                hardwareId="new-ai"
                device={device}
                locale={this.props.locale}
                triggerRef={this.trigger}
                onClose={() => this.close()}
                disabled={busy}
                notice={error || (device.error && newAiErrorText(device.error, this.props.locale))}
                onDisconnect={() => this.command('new-ai-disconnect')}
                connectionContent={<HardwareConnectionSettings
                    hardwareId="new-ai"
                    locale={this.props.locale}
                    device={device}
                    busy={Boolean(busy)}
                    connecting={device.state === 'verifying'}
                    ports={discovery.ports}
                    selected={selected}
                    scanning={bleScan.scanning}
                    bluetoothDevices={bleScan.devices}
                    onMode={mode => this.command('new-ai-connection-mode', mode)}
                    onSelectPort={value => this.setState({selected: value})}
                    onRefresh={() => this.command('new-ai-list-devices')}
                    onConnect={() => this.command('new-ai-connect', {path: selected})}
                    onDisconnect={() => this.command('new-ai-disconnect')}
                    onSearch={() => this.command('choose-ble')}
                    onCancelSearch={() => ipcRenderer.invoke('new-ai-ble-cancel-scan').catch(() => {})}
                    onSelectBluetooth={id => this.command('new-ai-ble-select', id)}
                    onForget={() => this.command('new-ai-ble-forget')}
                    onPauseReconnect={() => this.command('new-ai-set-auto-connect', false)}
                    onAutoChange={value => this.command('new-ai-set-auto-connect', value)}
                    autoStatus={discovery.status === 'choose' ? t('choose') : ''}
                    memoryError={device.memoryError ? newAiErrorText(device.memoryError, this.props.locale) : ''}
                />}
                infoContent={<React.Fragment>
                    <button
                        type="button"
                        id="new-ai-firmware-toggle"
                        className={styles.command}
                        disabled={busy}
                        onClick={() => this.firmwarePanel.current.open()}
                    >{t('firmwareUpdate')}</button>
                    <button
                        type="button"
                        id="new-ai-peripheral-toggle"
                        className={styles.command}
                        disabled={busy || !healthy}
                        onClick={() => this.peripheralPanel.current.open()}
                    >{t('peripheralUpdate')}</button>
                    <NewAiTelemetry
                        device={device}
                        locale={this.props.locale}
                    />
                    <p className={styles.notice}>{t('pending')}</p>
                </React.Fragment>}
            /> : null}
        </React.Fragment>);
    }
}
NewAiConnection.propTypes = {locale: PropTypes.string.isRequired};
