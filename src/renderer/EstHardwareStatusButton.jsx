import classNames from 'classnames';
import {ipcRenderer} from 'electron';
import React from 'react';

import {EST_CONNECTION_STATUS_EVENT} from './est-connection-status';
import styles from './EstHardwareStatusButton.css';

const REFRESH_INTERVAL_MS = 3000;
const EST_USB_DISCONNECTED_MESSAGE = 'EST USB 连接已断开，请重新连接 EST 后重试。';
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

const stripRemoteErrorPrefix = message => String(message || '').replace(
    /^Error invoking remote method '[^']+': (?:Error|TypeError):\s*/,
    ''
);

const formatStatusError = error => {
    const message = stripRemoteErrorPrefix(error && error.message ? error.message : error);
    if (/cannot write to hid device|cannot read from hid device|hid device is disconnected|device not open/i
        .test(message)) {
        return EST_USB_DISCONNECTED_MESSAGE;
    }
    return message || '无法读取硬件状态';
};

const isProgramRunning = status => (
    status &&
    status.programStatus &&
    ACTIVE_PROGRAM_STATES.has(Number(status.programStatus.state))
);

const valueOrDash = value => (
    value === 0 || value ? String(value) : '-'
);

const hexByte = value => (
    Number.isInteger(Number(value)) ?
        `0x${Number(value).toString(16).toUpperCase().padStart(2, '0')}` :
        '-'
);

const motorOutputName = value => MOTOR_OUTPUT_NAMES[value] || `unknown (${hexByte(value)})`;
const sensorStateName = value => SENSOR_STATE_NAMES[value] || `unknown (${hexByte(value)})`;

const sensorModelName = value => {
    if (!Number(value)) return 'none';
    return SENSOR_MODEL_NAMES[value] || `unknown (${hexByte(value)})`;
};

const sensorModeName = (sensorType, mode) => {
    const names = SENSOR_MODE_NAMES[sensorType] || SENSOR_MODE_NAMES.default;
    return names[mode] || `unknown (${hexByte(mode)})`;
};

class EstHardwareStatusButton extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            connection: null,
            errorMessage: null,
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
        this.handleManualRefresh = this.handleManualRefresh.bind(this);
        this.handleToggle = this.handleToggle.bind(this);
        this.handleClose = this.handleClose.bind(this);
    }

    componentDidMount () {
        window.addEventListener(EST_CONNECTION_STATUS_EVENT, this.handleConnectionStatus);
        window.addEventListener('resize', this.handleWindowResize);
    }

    componentDidUpdate () {
        this.updateProgramStatusTimer();
    }

    componentWillUnmount () {
        window.removeEventListener(EST_CONNECTION_STATUS_EVENT, this.handleConnectionStatus);
        window.removeEventListener('resize', this.handleWindowResize);
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
        this.setState(state => ({
            isOpen: !state.isOpen,
            panelPosition: !state.isOpen ?
                (state.panelPosition ?
                    this.constrainPanelPosition(state.panelPosition) :
                    this.getDefaultPanelPosition()) :
                state.panelPosition
        }), () => {
            if (this.state.isOpen) {
                this.refreshStatus();
            } else {
                this.stopProgramStatusTimer();
            }
        });
    }

    handleClose () {
        this.setState({isOpen: false}, () => this.stopProgramStatusTimer());
    }

    handleManualRefresh () {
        this.refreshStatus();
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
                    formatStatusError(connection.message),
                status: isConnected ? connection.status : null
            });
        } catch (error) {
            this.setState({
                connection: {state: 'error'},
                errorMessage: formatStatusError(error),
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
        const {connection, status} = this.state;
        const connected = connection && connection.state === 'connected';
        const compatibility = status && status.compatibility;
        return (
            <section className={classNames(styles.section, styles.summarySection)}>
                <h3 className={styles.sectionTitle}>连接与电池</h3>
                <div className={styles.summaryGrid}>
                    <span>连接状态</span>
                    <strong>{connected ? '已连接' : '未连接'}</strong>
                    <span>固件版本</span>
                    <strong>{status ? status.firmwareVersion : '-'}</strong>
                    <span>协议版本</span>
                    <strong>{status ? `${status.protocolMajor}.${status.protocolMinor}` : '-'}</strong>
                    <span>兼容状态</span>
                    <strong>{compatibility && compatibility.programCompatible ? '可运行当前程序' : '-'}</strong>
                    <span>电量</span>
                    <strong>
                        {status ? `${status.batteryLevel}/4 (${Math.min(status.batteryLevel, 4) * 25}%)` : '-'}
                    </strong>
                    <span>ADC</span>
                    <strong>{status ? valueOrDash(status.batteryAdcRaw) : '-'}</strong>
                    <span>采样电压</span>
                    <strong>{status ? `${status.batterySampleMv} mV` : '-'}</strong>
                </div>
            </section>
        );
    }

    renderMotors () {
        const motors = (this.state.status && this.state.status.motors) || [];
        return (
            <section className={classNames(styles.section, styles.portSection)}>
                <h3 className={styles.sectionTitle}>电机</h3>
                <div className={styles.portList}>
                    {MOTOR_PORTS.map((port, index) => {
                        const motor = motors[index];
                        return (
                            <div
                                className={styles.portRow}
                                key={port}
                            >
                                <strong className={styles.portName}>{port}</strong>
                                <span>连接：{motor ? '状态可读' : '无数据'}</span>
                                <span>类型：未提供</span>
                                <span>输出：{motor ? motorOutputName(motor.outputState) : '-'}</span>
                                <span>功率：{motor ? motor.powerPercent : '-'}</span>
                                <span>角度：{motor ? motor.tachoCount : '-'}</span>
                            </div>
                        );
                    })}
                </div>
            </section>
        );
    }

    renderSensors () {
        const sensors = (this.state.status && this.state.status.sensors) || [];
        return (
            <section className={classNames(styles.section, styles.portSection)}>
                <h3 className={styles.sectionTitle}>传感器</h3>
                <div className={styles.portList}>
                    {SENSOR_PORTS.map((port, index) => {
                        const sensor = sensors[index];
                        return (
                            <div
                                className={styles.portRow}
                                key={port}
                            >
                                <strong className={styles.portName}>{port}</strong>
                                <span>状态：{sensor ? sensorStateName(sensor.state) : '-'}</span>
                                <span>类型：{sensor ? sensorModelName(sensor.sensorType) : '-'}</span>
                                <span>模式：{sensor ? sensorModeName(sensor.sensorType, sensor.mode) : '-'}</span>
                                <span>有效：{sensor ? (sensor.valueValid ? '是' : '否') : '-'}</span>
                                <span>当前值：{sensor && sensor.valueValid ? sensor.value : '-'}</span>
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
        const {
            errorMessage,
            isLoading,
            status
        } = this.state;
        const programRunning = isProgramRunning(status);
        const pollingError = status && status.statusPollingError ?
            formatStatusError(status.statusPollingError) : null;
        const panelStyle = this.state.panelPosition ? {
            left: `${this.state.panelPosition.left}px`,
            top: `${this.state.panelPosition.top}px`
        } : null;
        return (
            <div className={styles.overlay}>
                <aside
                    aria-label="硬件状态"
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
                            <h2>硬件状态</h2>
                            <p>{isLoading ? '正在刷新…' : 'EST 主机与外设信息'}</p>
                        </div>
                        <div className={styles.panelActions}>
                            <button
                                className={styles.refreshButton}
                                disabled={isLoading}
                                type="button"
                                onClick={this.handleManualRefresh}
                            >
                                手动刷新
                            </button>
                            <button
                                aria-label="关闭硬件状态"
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
                            程序运行中，外设详情暂停刷新
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
                        <p className={styles.emptyState}>EST 未连接</p>
                    )}
                </aside>
            </div>
        );
    }

    render () {
        const {isOpen} = this.state;
        return (
            <div className={styles.container}>
                <button
                    aria-expanded={isOpen}
                    aria-label="硬件状态"
                    className={classNames(
                        styles.menuButton,
                        isOpen && styles.menuButtonOpen
                    )}
                    ref={this.buttonRef}
                    title="硬件状态"
                    type="button"
                    onClick={this.handleToggle}
                >
                    <svg
                        aria-hidden="true"
                        className={styles.menuIcon}
                        viewBox="0 0 24 24"
                    >
                        <path
                            d="M8 3h8v3h3v12h-3v3H8v-3H5V6h3V3zm2 2v3H7v8h3v3h4v-3h3V8h-3V5h-4zm0 5h4v4h-4v-4z"
                        />
                    </svg>
                    <span className={styles.menuText}>硬件状态</span>
                </button>
                {isOpen ? this.renderPanel() : null}
            </div>
        );
    }
}

export {
    formatStatusError,
    isProgramRunning
};

export default EstHardwareStatusButton;
