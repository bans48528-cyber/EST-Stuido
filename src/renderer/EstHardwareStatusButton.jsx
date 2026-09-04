import {dialog} from '@electron/remote';
import * as remote from '@electron/remote/renderer';
import classNames from 'classnames';
import {ipcRenderer} from 'electron';
import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';

import {EST_CONNECTION_STATUS_EVENT} from './est-connection-status';
import {getEstText} from './est-i18n';
import styles from './EstHardwareStatusButton.css';

const REFRESH_INTERVAL_MS = 3000;
const PANEL_MARGIN = 12;
const PANEL_DEFAULT_WIDTH = 600;
const PANEL_DEFAULT_HEIGHT = 420;
const MOTOR_PORTS = ['A', 'B', 'C', 'D'];
const SENSOR_PORTS = ['1', '2', '3', '4'];
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

class EstHardwareStatusButton extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            connection: null,
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
        ipcRenderer.on('est-firmware-update-progress', this.handleFirmwareUpdateProgress);
    }

    componentDidUpdate () {
        this.updateProgramStatusTimer();
    }

    componentWillUnmount () {
        window.removeEventListener(EST_CONNECTION_STATUS_EVENT, this.handleConnectionStatus);
        window.removeEventListener('resize', this.handleWindowResize);
        ipcRenderer.removeListener('est-firmware-update-progress', this.handleFirmwareUpdateProgress);
        this.handlePanelDragEnd();
        this.stopProgramStatusTimer();
    }

    handleConnectionStatus (event) {
        const detail = event && event.detail;
        if (!detail || detail.isConnected) {
            return;
        }
        this.setState({
            connection: {state: 'not-found'},
            errorMessage: null,
            status: null
        });
    }

    handleToggle () {
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
        const shouldPoll = this.state.isOpen && isProgramRunning(this.state.status);
        if (shouldPoll && !this.programStatusTimer) {
            this.programStatusTimer = window.setInterval(() => {
                if (this.state.isOpen && isProgramRunning(this.state.status)) {
                    this.refreshStatus({silent: true});
                }
            }, REFRESH_INTERVAL_MS);
        } else if (!shouldPoll && this.programStatusTimer) {
            this.stopProgramStatusTimer();
        }
    }

    stopProgramStatusTimer () {
        if (!this.programStatusTimer) {
            return;
        }
        window.clearInterval(this.programStatusTimer);
        this.programStatusTimer = null;
    }

    async refreshStatus ({silent = false} = {}) {
        if (this.refreshInFlight) {
            return;
        }
        this.refreshInFlight = true;
        if (!silent) {
            this.setState({isLoading: true, errorMessage: null});
        }
        try {
            const connection = await ipcRenderer.invoke('est-auto-connect', {
                includeProgramStatus: true
            });
            const isConnected = connection && connection.state === 'connected';
            this.setState({
                connection,
                errorMessage: isConnected || !(connection && connection.message) ?
                    null :
                    formatStatusError(connection.message, this.props.locale),
                status: isConnected ? connection.status : null
            });
        } catch (error) {
            this.setState({
                connection: {state: 'error'},
                errorMessage: formatStatusError(error, this.props.locale),
                status: null
            });
        } finally {
            this.refreshInFlight = false;
            if (!silent) {
                this.setState({isLoading: false});
            }
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

    renderPanel () {
        const {locale} = this.props;
        const {
            errorMessage,
            firmwareUpdateBusy,
            firmwareUpdateMenuOpen,
            firmwareUpdateMessage,
            isLoading,
            status
        } = this.state;
        const programRunning = isProgramRunning(status);
        const pollingError = status && status.statusPollingError ?
            formatStatusError(status.statusPollingError, this.props.locale) : null;
        const panelStyle = this.state.panelPosition ? {
            left: `${this.state.panelPosition.left}px`,
            top: `${this.state.panelPosition.top}px`
        } : null;
        return (
            <div className={styles.overlay}>
                <aside
                    aria-label={getEstText('hardware.title', locale)}
                    className={styles.panel}
                    ref={this.panelRef}
                    role="dialog"
                    style={panelStyle}
                >
                    <div
                        className={styles.panelHeader}
                        onMouseDown={this.handlePanelDragStart}
                    >
                        <div>
                            <h2>{getEstText('hardware.title', locale)}</h2>
                            <p>{isLoading ?
                                getEstText('hardware.refreshing', locale) :
                                getEstText('hardware.subtitle', locale)}</p>
                        </div>
                        <div className={styles.panelActions}>
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
                                className={styles.refreshButton}
                                disabled={isLoading}
                                type="button"
                                onClick={this.handleManualRefresh}
                            >
                                {getEstText('hardware.manualRefresh', locale)}
                            </button>
                            <button
                                aria-label={getEstText('hardware.close', locale)}
                                className={styles.closeButton}
                                type="button"
                                onClick={this.handleClose}
                            >
                                ×
                            </button>
                        </div>
                    </div>
                    {programRunning && (
                        <div className={styles.notice}>
                            {getEstText('hardware.runningNotice', locale)}
                        </div>
                    )}
                    {firmwareUpdateMessage && (
                        <div className={styles.notice}>
                            {firmwareUpdateMessage}
                        </div>
                    )}
                    {errorMessage && (
                        <div className={styles.errorBox}>
                            {errorMessage}
                        </div>
                    )}
                    {pollingError && (
                        <div className={styles.errorBox}>
                            {pollingError}
                        </div>
                    )}
                    {status ? (
                        <React.Fragment>
                            {this.renderPortsOverview()}
                            {this.renderConnectionAndBattery()}
                        </React.Fragment>
                    ) : (
                        <p className={styles.emptyState}>{getEstText('hardware.notConnected', locale)}</p>
                    )}
                </aside>
            </div>
        );
    }

    render () {
        const {locale} = this.props;
        const {isOpen} = this.state;
        return (
            <div className={styles.container}>
                <button
                    aria-expanded={isOpen}
                    aria-label={getEstText('hardware.title', locale)}
                    className={classNames(
                        styles.menuButton,
                        isOpen && styles.menuButtonOpen
                    )}
                    ref={this.buttonRef}
                    title={getEstText('hardware.title', locale)}
                    type="button"
                    onClick={this.handleToggle}
                >
                    <span className={styles.menuText}>{getEstText('menu.hardwareStatus', locale)}</span>
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
