/* eslint-disable react/jsx-no-bind */
import {dialog} from '@electron/remote';
import * as remote from '@electron/remote/renderer';
import classNames from 'classnames';
import {ipcRenderer} from 'electron';
import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';

import {EST_CONNECTION_STATUS_EVENT} from './est-connection-status';
import {getEstText} from './est-i18n';
import HardwareStatusPopover from './hardware/HardwareStatusPopover.jsx';
import HardwareConnectionSettings from './hardware/HardwareConnectionSettings.jsx';
import {hardwareStatusText} from './hardware/status-messages';
import styles from './EstHardwareStatusButton.css';
import connectionStyles from './spark-ai/SparkRuntime.css';
import {getHardwareProfile} from '../common/hardware-profiles';

const REFRESH_INTERVAL_MS = 250;
const RETRY_INTERVAL_MS = 3000;
const PANEL_MARGIN = 12;
const PANEL_DEFAULT_WIDTH = 600;
const PANEL_DEFAULT_HEIGHT = 420;
const MOTOR_PORTS = getHardwareProfile('est').motorPorts;
const SENSOR_PORTS = getHardwareProfile('est').sensorPorts;
const MOTOR_OUTPUT_NAMES = {
    0: 'coast',
    1: 'drive',
    2: 'brake'
};
const SENSOR_STATE_NAMES = {
    0: 'off',
    1: 'syncing',
    2: 'streaming',
    3: 'stale'
};
const SENSOR_MODEL_NAMES = {
    0x03: 'NXT-sound',
    0x06: 'EST-temperature',
    0x10: 'EST/EV3-touch',
    0x1D: 'EST/EV3-color',
    0x1E: 'EST/EV3-ultrasonic',
    0x20: 'EST/EV3-gyro',
    0x21: 'EST/EV3-infrared'
};
const SENSOR_MODE_NAMES = {
    default: {
        0: 'reflect',
        1: 'ambient',
        2: 'color'
    },
    0x03: {
        0: 'db'
    },
    0x06: {
        0: 'celsius',
        1: 'fahrenheit'
    },
    0x1E: {
        0: 'cm',
        1: 'inch',
        2: 'presence'
    },
    0x20: {
        0: 'angle',
        1: 'rate'
    },
    0x21: {
        0: 'proximity',
        1: 'beacon',
        2: 'remote'
    }
};
const ACTIVE_PROGRAM_STATES = new Set([3, 4]);
const FIRMWARE_UPDATE_ACTIONS = {
    upgrade: 'latest-os',
    downgrade: 'legacy-est'
};

const stripRemoteErrorPrefix = message => String(message || '').replace(
    /^Error invoking remote method '[^']+': (?:Error|TypeError):\s*/,
    ''
);

const formatStatusError = (error, locale) => {
    const message = stripRemoteErrorPrefix(error && error.message ? error.message : error);
    if (/cannot write to hid device|cannot read from hid device|hid device is disconnected|device not open/i
        .test(message)) {
        return getEstText('programControls.usbDisconnected', locale);
    }
    return message || getEstText('hardware.readError', locale);
};

const isProgramRunning = status => (
    status &&
    status.programStatus &&
    ACTIVE_PROGRAM_STATES.has(Number(status.programStatus.state))
);

const valueOrDash = value => (
    value === 0 || value ? String(value) : '-'
);

const batteryPercentText = status => (
    status && Number.isInteger(status.batteryPercent) ? `${status.batteryPercent}%` : '-'
);

const hexByte = value => {
    const numberValue = Number(value);
    if (!Number.isInteger(numberValue)) return '-';
    return `0x${numberValue
        .toString(16)
        .toUpperCase()
        .padStart(2, '0')}`;
};

const motorOutputName = (value, locale) => (
    MOTOR_OUTPUT_NAMES[value] || getEstText('hardware.unknown', locale, {value: hexByte(value)})
);
const sensorStateName = (value, locale) => (
    SENSOR_STATE_NAMES[value] || getEstText('hardware.unknown', locale, {value: hexByte(value)})
);

const sensorModelName = (value, locale) => {
    if (!Number(value)) return getEstText('hardware.none', locale);
    return SENSOR_MODEL_NAMES[value] || getEstText('hardware.unknown', locale, {value: hexByte(value)});
};

const sensorModeName = (sensorType, mode, locale) => {
    const names = SENSOR_MODE_NAMES[sensorType] || SENSOR_MODE_NAMES.default;
    return names[mode] || getEstText('hardware.unknown', locale, {value: hexByte(mode)});
};

// Uptime and program timing change on every report but are not displayed here.
const visibleSnapshotKey = ({connection, errorMessage, status}) => JSON.stringify([
    connection && connection.state, errorMessage,
    status && [status.firmwareVersion, status.protocolMajor, status.protocolMinor,
        status.batteryPercent, status.batteryAdcRaw, status.batterySampleMv,
        status.compatibility && status.compatibility.programCompatible,
        status.motors, status.sensors, isProgramRunning(status),
        status.statusPollingDeferred, status.statusPollingError]
]);

class EstHardwareStatusButton extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            connection: null,
            connectionOnline: false,
            connectionHealthy: false,
            errorMessage: null,
            firmwareUpdateBusy: null,
            firmwareUpdateMenuOpen: false,
            firmwareUpdateMessage: null,
            isLoading: false,
            isOpen: false,
            panelPosition: null,
            status: null
        };
        this.buttonRef = React.createRef();
        this.panelRef = React.createRef();
        this.dragOffset = null;
        this.refreshInFlight = false;
        this.programStatusTimer = null;
        this.unmounted = false;
        this.refreshGeneration = 0;
        this.handleVisibilityChange = () => {
            this.stopProgramStatusTimer();
            if (!document.hidden && this.state.isOpen) this.refreshStatus({silent: true});
        };
        this.handleConnectionStatus = this.handleConnectionStatus.bind(this);
        this.handlePanelDragEnd = this.handlePanelDragEnd.bind(this);
        this.handlePanelDragMove = this.handlePanelDragMove.bind(this);
        this.handlePanelDragStart = this.handlePanelDragStart.bind(this);
        this.handleWindowResize = this.handleWindowResize.bind(this);
        this.handleFirmwareUpdateProgress = this.handleFirmwareUpdateProgress.bind(this);
        this.handleFirmwareUpdateOption = this.handleFirmwareUpdateOption.bind(this);
        this.handleFirmwareUpdateToggle = this.handleFirmwareUpdateToggle.bind(this);
        this.handleManualRefresh = this.handleManualRefresh.bind(this);
        this.handleToggle = this.handleToggle.bind(this);
        this.handleClose = this.handleClose.bind(this);
    }

    componentDidMount () {
        window.addEventListener(EST_CONNECTION_STATUS_EVENT, this.handleConnectionStatus);
        window.addEventListener('resize', this.handleWindowResize);
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        ipcRenderer.on('est-firmware-update-progress', this.handleFirmwareUpdateProgress);
    }

    componentDidUpdate () {
        this.updateProgramStatusTimer();
    }

    componentWillUnmount () {
        this.unmounted = true;
        this.refreshGeneration++;
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        window.removeEventListener(EST_CONNECTION_STATUS_EVENT, this.handleConnectionStatus);
        window.removeEventListener('resize', this.handleWindowResize);
        ipcRenderer.removeListener('est-firmware-update-progress', this.handleFirmwareUpdateProgress);
        this.handlePanelDragEnd();
        this.stopProgramStatusTimer();
    }

    handleConnectionStatus (event) {
        const detail = event && event.detail;
        if (!detail) return;
        this.setState(state => (
            state.connectionOnline === Boolean(detail.isConnected) &&
            state.connectionHealthy === Boolean(detail.isCompatible) ? null :
                {connectionOnline: Boolean(detail.isConnected), connectionHealthy: Boolean(detail.isCompatible)}
        ));
        if (detail.isConnected) {
            if (this.state.isOpen && (!this.state.connection || this.state.connection.state !== 'connected')) {
                this.refreshStatus({silent: true});
            }
            return;
        }
        this.refreshGeneration++;
        this.setState({
            connection: {state: 'not-found'},
            errorMessage: null,
            status: null
        });
    }

    handleToggle () {
        this.refreshGeneration++;
        this.setState(state => {
            const isOpen = !state.isOpen;
            return {
                firmwareUpdateMenuOpen: false,
                isOpen,
                panelPosition: isOpen ?
                    (state.panelPosition ?
                        this.constrainPanelPosition(state.panelPosition) :
                        this.getDefaultPanelPosition()) :
                    state.panelPosition
            };
        }, () => {
            if (this.state.isOpen) {
                this.refreshStatus();
            } else {
                this.stopProgramStatusTimer();
            }
        });
    }

    handleClose () {
        this.refreshGeneration++;
        this.setState({
            firmwareUpdateMenuOpen: false,
            isOpen: false
        }, () => this.stopProgramStatusTimer());
    }

    handleManualRefresh () {
        this.setState({firmwareUpdateMenuOpen: false});
        this.refreshStatus();
    }

    handleFirmwareUpdateToggle () {
        if (this.state.firmwareUpdateBusy) {
            return;
        }
        this.setState(state => ({
            firmwareUpdateMenuOpen: !state.firmwareUpdateMenuOpen
        }));
    }

    handleFirmwareUpdateProgress (event, progress) {
        if (!this.state.firmwareUpdateBusy || !progress) {
            return;
        }
        if (progress.stage === 'audio-resources') {
            this.setState({
                firmwareUpdateMessage: getEstText('firmware.audioSyncRunning', this.props.locale)
            });
        }
    }

    async handleFirmwareUpdateOption (event) {
        const target = event.currentTarget.dataset.firmwareTarget;
        if (this.state.firmwareUpdateBusy || !target) {
            return;
        }
        const {locale} = this.props;
        const isUpgrade = target === FIRMWARE_UPDATE_ACTIONS.upgrade;
        const confirmation = await dialog.showMessageBox(remote.getCurrentWindow(), {
            type: 'warning',
            buttons: [
                getEstText('firmware.confirmAction', locale),
                getEstText('firmware.cancelAction', locale)
            ],
            cancelId: 1,
            defaultId: 1,
            title: getEstText('firmware.confirmTitle', locale),
            message: getEstText(
                isUpgrade ? 'firmware.upgradeConfirmMessage' : 'firmware.downgradeConfirmMessage',
                locale
            ),
            detail: getEstText(
                isUpgrade ? 'firmware.upgradeConfirmDetail' : 'firmware.downgradeConfirmDetail',
                locale
            )
        });
        if (!confirmation || confirmation.response !== 0) {
            this.setState({firmwareUpdateMenuOpen: false});
            return;
        }
        this.setState({
            firmwareUpdateBusy: target,
            firmwareUpdateMenuOpen: false,
            firmwareUpdateMessage: getEstText('firmware.updateRunning', locale)
        });
        try {
            const result = await ipcRenderer.invoke('est-flash-firmware', {target});
            const targetVersion = result && result.targetVersion ? result.targetVersion : '-';
            const audioResourcesSynced = Boolean(result && result.audioResourcesSynced);
            this.setState({
                firmwareUpdateMessage: getEstText(
                    audioResourcesSynced ? 'firmware.updateWithAudioDone' : 'firmware.updateDone',
                    locale,
                    {version: targetVersion}
                )
            });
            await dialog.showMessageBox(remote.getCurrentWindow(), {
                type: 'info',
                title: getEstText(
                    audioResourcesSynced ? 'firmware.successWithAudioTitle' : 'firmware.successTitle',
                    locale
                ),
                message: getEstText(
                    audioResourcesSynced ? 'firmware.successWithAudioMessage' : 'firmware.successMessage',
                    locale,
                    {version: targetVersion}
                ),
                detail: getEstText('firmware.successDetail', locale, {
                    path: result && result.packagePath ? result.packagePath : '-',
                    sha256: result && result.sha256 ? result.sha256 : '-'
                })
            });
            this.refreshStatus();
        } catch (error) {
            const detail = formatStatusError(error, locale);
            this.setState({firmwareUpdateMessage: detail});
            await dialog.showMessageBox(remote.getCurrentWindow(), {
                type: 'error',
                title: getEstText('firmware.errorTitle', locale),
                message: getEstText('firmware.errorMessage', locale),
                detail
            });
        } finally {
            this.setState({firmwareUpdateBusy: null});
        }
    }

    handlePanelDragStart (event) {
        if (event.button !== 0 || (event.target.closest && event.target.closest('button'))) {
            return;
        }
        const panel = this.panelRef.current;
        if (!panel) {
            return;
        }
        const rect = panel.getBoundingClientRect();
        this.dragOffset = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
        window.addEventListener('mousemove', this.handlePanelDragMove);
        window.addEventListener('mouseup', this.handlePanelDragEnd);
        event.preventDefault();
    }

    handlePanelDragMove (event) {
        if (!this.dragOffset) {
            return;
        }
        this.setState({
            panelPosition: this.constrainPanelPosition({
                left: event.clientX - this.dragOffset.x,
                top: event.clientY - this.dragOffset.y
            })
        });
    }

    handlePanelDragEnd () {
        if (!this.dragOffset) {
            return;
        }
        this.dragOffset = null;
        window.removeEventListener('mousemove', this.handlePanelDragMove);
        window.removeEventListener('mouseup', this.handlePanelDragEnd);
    }

    handleWindowResize () {
        this.setState(state => (
            state.panelPosition ?
                {panelPosition: this.constrainPanelPosition(state.panelPosition)} :
                null
        ));
    }

    getDefaultPanelPosition () {
        const viewportWidth = window.innerWidth || PANEL_DEFAULT_WIDTH;
        const panelWidth = Math.min(
            PANEL_DEFAULT_WIDTH,
            Math.max(280, viewportWidth - (PANEL_MARGIN * 2))
        );
        const buttonRect = this.buttonRef.current && this.buttonRef.current.getBoundingClientRect();
        return this.constrainPanelPosition({
            left: Math.round((viewportWidth - panelWidth) / 2),
            top: Math.round((buttonRect ? buttonRect.bottom : 48) + PANEL_MARGIN)
        }, panelWidth);
    }

    getPanelSize (fallbackWidth = PANEL_DEFAULT_WIDTH) {
        const panel = this.panelRef.current;
        if (panel) {
            return {
                height: panel.offsetHeight,
                width: panel.offsetWidth
            };
        }
        return {
            height: PANEL_DEFAULT_HEIGHT,
            width: Math.min(
                fallbackWidth,
                Math.max(280, window.innerWidth - (PANEL_MARGIN * 2))
            )
        };
    }

    constrainPanelPosition (position, fallbackWidth) {
        const panelSize = this.getPanelSize(fallbackWidth);
        const maxLeft = Math.max(PANEL_MARGIN, window.innerWidth - panelSize.width - PANEL_MARGIN);
        const maxTop = Math.max(PANEL_MARGIN, window.innerHeight - panelSize.height - PANEL_MARGIN);
        return {
            left: Math.round(Math.min(Math.max(PANEL_MARGIN, position.left), maxLeft)),
            top: Math.round(Math.min(Math.max(PANEL_MARGIN, position.top), maxTop))
        };
    }

    updateProgramStatusTimer () {
        const shouldPoll = !this.unmounted && this.state.isOpen && !document.hidden && !this.state.firmwareUpdateBusy;
        if (!shouldPoll) {
            this.stopProgramStatusTimer();
        } else if (!this.refreshInFlight && !this.programStatusTimer) {
            this.programStatusTimer = window.setTimeout(() => {
                this.programStatusTimer = null;
                this.refreshStatus({silent: true});
            }, this.state.errorMessage ? RETRY_INTERVAL_MS : REFRESH_INTERVAL_MS);
        }
    }

    stopProgramStatusTimer () {
        if (!this.programStatusTimer) {
            return;
        }
        window.clearTimeout(this.programStatusTimer);
        this.programStatusTimer = null;
    }

    async refreshStatus ({silent = false} = {}) {
        if (this.unmounted || !this.state.isOpen || this.state.firmwareUpdateBusy) return;
        if (silent && (document.hidden || this.dragOffset)) {
            this.updateProgramStatusTimer();
            return;
        }
        if (this.refreshInFlight) return;
        this.stopProgramStatusTimer();
        const generation = this.refreshGeneration;
        this.refreshInFlight = true;
        if (!silent) {
            this.setState({isLoading: true, errorMessage: null});
        }
        try {
            const connection = await ipcRenderer.invoke('est-hardware-status');
            if (this.unmounted || generation !== this.refreshGeneration || !this.state.isOpen) return;
            if (connection && connection.state === 'busy') return;
            const isConnected = connection && connection.state === 'connected';
            const compatibility = connection && connection.status && connection.status.compatibility;
            const next = {
                connection,
                connectionOnline: Boolean(isConnected),
                connectionHealthy: Boolean(isConnected && (typeof connection.compatible === 'boolean' ?
                    connection.compatible : (compatibility ?
                        compatibility.programCompatible : this.state.connectionHealthy))),
                errorMessage: isConnected || !(connection && connection.message) ?
                    null :
                    formatStatusError(connection.message, this.props.locale),
                status: isConnected ? connection.status : null
            };
            this.setState(state => (
                visibleSnapshotKey(state) === visibleSnapshotKey(next) ? null : next
            ));
        } catch (error) {
            if (this.unmounted || generation !== this.refreshGeneration || !this.state.isOpen) return;
            this.setState({
                connection: {state: 'error'},
                connectionOnline: false,
                connectionHealthy: false,
                errorMessage: formatStatusError(error, this.props.locale),
                status: null
            });
        } finally {
            this.refreshInFlight = false;
            if (!this.unmounted && !silent) {
                this.setState({isLoading: false});
            }
            this.updateProgramStatusTimer();
        }
    }

    renderConnectionAndBattery () {
        const {locale} = this.props;
        const {connection, status} = this.state;
        const connected = connection && connection.state === 'connected';
        const compatibility = status && status.compatibility;
        return (
            <section className={classNames(styles.section, styles.summarySection)}>
                <h3 className={styles.sectionTitle}>{getEstText('hardware.connectionBattery', locale)}</h3>
                <div className={styles.summaryGrid}>
                    <span>{getEstText('hardware.connectionStatus', locale)}</span>
                    <strong>{connected ?
                        getEstText('hardware.connected', locale) :
                        getEstText('hardware.disconnected', locale)}</strong>
                    <span>{getEstText('hardware.firmwareVersion', locale)}</span>
                    <strong>{status ? status.firmwareVersion : '-'}</strong>
                    <span>{getEstText('hardware.protocolVersion', locale)}</span>
                    <strong>{status ? `${status.protocolMajor}.${status.protocolMinor}` : '-'}</strong>
                    <span>{getEstText('hardware.compatibility', locale)}</span>
                    <strong>{compatibility && compatibility.programCompatible ?
                        getEstText('hardware.programCompatible', locale) :
                        '-'}</strong>
                    <span>{getEstText('hardware.battery', locale)}</span>
                    <strong>
                        {batteryPercentText(status)}
                    </strong>
                    <span>{getEstText('hardware.adc', locale)}</span>
                    <strong>{status ? valueOrDash(status.batteryAdcRaw) : '-'}</strong>
                    <span>{getEstText('hardware.sampleVoltage', locale)}</span>
                    <strong>{status ? `${status.batterySampleMv} mV` : '-'}</strong>
                </div>
            </section>
        );
    }

    renderMotors () {
        const {locale} = this.props;
        const motors = (this.state.status && this.state.status.motors) || [];
        return (
            <section className={classNames(styles.section, styles.portSection)}>
                <h3 className={styles.sectionTitle}>{getEstText('hardware.motors', locale)}</h3>
                <div className={styles.portList}>
                    {MOTOR_PORTS.map((port, index) => {
                        const motor = motors[index];
                        return (
                            <div
                                className={styles.portRow}
                                key={port}
                            >
                                <strong className={styles.portName}>{port}</strong>
                                <span>
                                    {getEstText('hardware.connectionStatus', locale)}:
                                    {motor ?
                                        getEstText('hardware.connectedReadable', locale) :
                                        getEstText('hardware.noData', locale)}
                                </span>
                                <span>{getEstText('hardware.type', locale)}:
                                    {getEstText('hardware.typeUnavailable', locale)}</span>
                                <span>{getEstText('hardware.output', locale)}:
                                    {motor ? motorOutputName(motor.outputState, locale) : '-'}</span>
                                <span>{getEstText('hardware.power', locale)}:
                                    {motor ? motor.powerPercent : '-'}</span>
                                <span>{getEstText('hardware.angle', locale)}:
                                    {motor ? motor.tachoCount : '-'}</span>
                            </div>
                        );
                    })}
                </div>
            </section>
        );
    }

    renderSensors () {
        const {locale} = this.props;
        const sensors = (this.state.status && this.state.status.sensors) || [];
        return (
            <section className={classNames(styles.section, styles.portSection)}>
                <h3 className={styles.sectionTitle}>{getEstText('hardware.sensors', locale)}</h3>
                <div className={styles.portList}>
                    {SENSOR_PORTS.map((port, index) => {
                        const sensor = sensors[index];
                        return (
                            <div
                                className={styles.portRow}
                                key={port}
                            >
                                <strong className={styles.portName}>{port}</strong>
                                <span>{getEstText('hardware.state', locale)}:
                                    {sensor ? sensorStateName(sensor.state, locale) : '-'}</span>
                                <span>{getEstText('hardware.type', locale)}:
                                    {sensor ? sensorModelName(sensor.sensorType, locale) : '-'}</span>
                                <span>{getEstText('hardware.mode', locale)}:
                                    {sensor ? sensorModeName(sensor.sensorType, sensor.mode, locale) : '-'}</span>
                                <span>{getEstText('hardware.valid', locale)}:
                                    {sensor ?
                                        (sensor.valueValid ?
                                            getEstText('hardware.yes', locale) :
                                            getEstText('hardware.no', locale)) :
                                        '-'}</span>
                                <span>{getEstText('hardware.value', locale)}:
                                    {sensor && sensor.valueValid ? sensor.value : '-'}</span>
                            </div>
                        );
                    })}
                </div>
            </section>
        );
    }

    renderPortsOverview () {
        return (
            <div className={styles.portsOverview}>
                {this.renderMotors()}
                {this.renderSensors()}
            </div>
        );
    }

    async connectHardware () {
        if (this.connectionPending) return;
        this.connectionPending = true;
        this.setState({isLoading: true, errorMessage: null});
        try {
            window.dispatchEvent(new CustomEvent('est-auto-connect-paused', {detail: false}));
            await ipcRenderer.invoke('est-auto-connect', {reuseConnection: true});
            await this.refreshStatus();
        } catch (error) {
            if (!this.unmounted) this.setState({errorMessage: formatStatusError(error, this.props.locale)});
        } finally {
            this.connectionPending = false;
            if (!this.unmounted) this.setState({isLoading: false});
        }
    }

    async disconnectHardware () {
        if (this.connectionPending) return;
        const t = key => hardwareStatusText(key, this.props.locale);
        if (isProgramRunning(this.state.status)) {
            const confirmation = await dialog.showMessageBox(remote.getCurrentWindow(), {
                type: 'warning',
                message: t('disconnectRunning'),
                buttons: [t('disconnect'), t('back')],
                defaultId: 1,
                cancelId: 1
            });
            if (confirmation.response !== 0) return;
        }
        this.connectionPending = true;
        this.setState({isLoading: true, errorMessage: null});
        try {
            window.dispatchEvent(new CustomEvent('est-auto-connect-paused', {detail: true}));
            await ipcRenderer.invoke('est-disconnect');
            window.dispatchEvent(new CustomEvent(EST_CONNECTION_STATUS_EVENT,
                {detail: {isConnected: false, isCompatible: false}}));
        } catch (error) {
            window.dispatchEvent(new CustomEvent('est-auto-connect-paused', {detail: false}));
            if (!this.unmounted) this.setState({errorMessage: formatStatusError(error, this.props.locale)});
        } finally {
            this.connectionPending = false;
            if (!this.unmounted) this.setState({isLoading: false});
        }
    }

    renderPanel () {
        const {locale} = this.props;
        const {connection, status, errorMessage, firmwareUpdateBusy, firmwareUpdateMenuOpen,
            firmwareUpdateMessage, isLoading} = this.state;
        const device = {connected: Boolean(connection && connection.state === 'connected'),
            busy: Boolean(firmwareUpdateBusy),
            status,
            connectionMode: 'usb',
            stale: Boolean(status && (status.statusPollingError || status.statusPollingDeferred))};
        return (<HardwareStatusPopover
            hardwareId="est"
            device={device}
            locale={locale}
            triggerRef={this.buttonRef}
            onClose={this.handleClose}
            disabled={Boolean(firmwareUpdateBusy)}
            notice={errorMessage || firmwareUpdateMessage}
            onDisconnect={() => this.disconnectHardware()}
            connectionContent={<HardwareConnectionSettings
                hardwareId="est"
                locale={locale}
                device={device}
                busy={isLoading || Boolean(firmwareUpdateBusy)}
                connecting={isLoading && !device.connected}
                onRefresh={this.handleManualRefresh}
                onConnect={() => this.connectHardware()}
                onDisconnect={() => this.disconnectHardware()}
            />}
            infoContent={<React.Fragment>
                {this.renderConnectionAndBattery()}
                <div className={styles.firmwareUpdateWrap}>
                    <button
                        aria-expanded={firmwareUpdateMenuOpen}
                        aria-haspopup="menu"
                        className={styles.firmwareUpdateButton}
                        disabled={Boolean(firmwareUpdateBusy)}
                        type="button"
                        onClick={this.handleFirmwareUpdateToggle}
                    >
                        {firmwareUpdateBusy ?
                            getEstText('firmware.busy', locale) :
                            getEstText('firmware.updateButton', locale)}
                    </button>
                    {firmwareUpdateMenuOpen && (
                        <div
                            aria-label={getEstText('firmware.menuAria', locale)}
                            className={styles.firmwareUpdateMenu}
                            role="menu"
                        >
                            <button
                                className={styles.firmwareUpdateOption}
                                data-firmware-target={FIRMWARE_UPDATE_ACTIONS.upgrade}
                                role="menuitem"
                                type="button"
                                onClick={this.handleFirmwareUpdateOption}
                            >
                                {getEstText('firmware.upgradeEstOs', locale)}
                            </button>
                            <button
                                className={styles.firmwareUpdateOption}
                                data-firmware-target={FIRMWARE_UPDATE_ACTIONS.downgrade}
                                role="menuitem"
                                type="button"
                                onClick={this.handleFirmwareUpdateOption}
                            >
                                {getEstText('firmware.downgradeLegacyEst', locale)}
                            </button>
                        </div>
                    )}
                </div>

                <button
                    type="button"
                    className={styles.refreshButton}
                    disabled={isLoading || Boolean(firmwareUpdateBusy)}
                    onClick={this.handleManualRefresh}
                >
                    {getEstText('hardware.manualRefresh', locale)}</button>
                {this.renderPortsOverview()}
            </React.Fragment>}
        />);
    }

    render () {
        const {locale} = this.props;
        const {isOpen, connectionOnline, connectionHealthy, firmwareUpdateBusy} = this.state;
        return (
            <div className={styles.container}>
                <button
                    id="est-connection"
                    aria-expanded={isOpen}
                    aria-haspopup="dialog"
                    aria-label={getEstText('hardware.title', locale)}
                    className={connectionStyles.connection}
                    ref={this.buttonRef}
                    title={getEstText('hardware.title', locale)}
                    type="button"
                    onClick={this.handleToggle}
                >
                    <span className={connectionStyles.connectionLabel}>{firmwareUpdateBusy ?
                        getEstText('firmware.updateButton', locale) : hardwareStatusText(
                            connectionOnline ? 'connected' : 'disconnected', locale)}</span>
                    <span
                        className={`${connectionStyles.dot} ${connectionOnline ?
                            (connectionHealthy ? connectionStyles.connected : connectionStyles.warning) : ''}`}
                    />
                </button>
                {isOpen ? this.renderPanel() : null}
            </div>
        );
    }
}

EstHardwareStatusButton.propTypes = {
    locale: PropTypes.string.isRequired
};

const mapStateToProps = state => ({
    locale: state.locales.locale
});

export {
    formatStatusError,
    isProgramRunning
};

export {EstHardwareStatusButton};

export default connect(mapStateToProps)(EstHardwareStatusButton);
