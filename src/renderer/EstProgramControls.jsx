import {dialog} from '@electron/remote';
import * as remote from '@electron/remote/renderer';
import classNames from 'classnames';
import {ipcRenderer} from 'electron';
import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';

import {
    EST_CONNECTION_STATUS_EVENT,
    EST_PROGRAM_ACTIVITY_EVENT
} from './est-connection-status';
import {buildEstProgramRequest} from './est-program-name';
import styles from './EstProgramControls.css';

const PROGRAM_SLOT_CHANGE_EVENT = 'est-program-slot-change';
const SLOT_STORAGE_KEY = 'estStudio.programSlot';
const SLOT_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7];
const PLAY_ICON_PATH = 'M7 4.8v14.4c0 1.2 1.3 1.9 2.3 1.2l10.2-7.2' +
    'c.8-.6.8-1.8 0-2.4L9.3 3.6C8.3 2.9 7 3.6 7 4.8z';

const readStoredSlot = () => {
    try {
        const slot = Number(window.localStorage.getItem(SLOT_STORAGE_KEY));
        return SLOT_OPTIONS.includes(slot) ? slot : 0;
    } catch (e) {
        return 0;
    }
};

const PROGRAM_ACTION_CHANNELS = {
    download: 'est-download-program',
    run: 'est-run-program',
    stop: 'est-stop-program'
};
const EST_USB_DISCONNECTED_MESSAGE = 'EST USB 连接已断开，请重新连接 EST 后重试。';

const formatProgramOperationError = error => {
    const rawMessage = error && error.message ? error.message : String(error);
    const message = rawMessage.replace(
        /^Error invoking remote method '[^']+': (?:Error|TypeError):\s*/,
        ''
    );
    if (/cannot write to hid device|cannot read from hid device/i.test(message)) {
        return EST_USB_DISCONNECTED_MESSAGE;
    }
    return message || '未知错误';
};

class EstProgramControls extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            busyAction: null,
            isSlotMenuOpen: false,
            operationMessage: null,
            programActionsAllowed: false,
            selectedSlot: readStoredSlot()
        };
        this.handleAction = this.handleAction.bind(this);
        this.handleContainerRef = this.handleContainerRef.bind(this);
        this.handleConnectionStatus = this.handleConnectionStatus.bind(this);
        this.handleDocumentMouseDown = this.handleDocumentMouseDown.bind(this);
        this.handleNextSlot = this.handleNextSlot.bind(this);
        this.handlePreviousSlot = this.handlePreviousSlot.bind(this);
        this.handleSlotOption = this.handleSlotOption.bind(this);
        this.handleToggleSlotMenu = this.handleToggleSlotMenu.bind(this);
    }

    componentDidMount () {
        document.addEventListener('mousedown', this.handleDocumentMouseDown);
        window.addEventListener(EST_CONNECTION_STATUS_EVENT, this.handleConnectionStatus);
    }

    componentWillUnmount () {
        document.removeEventListener('mousedown', this.handleDocumentMouseDown);
        window.removeEventListener(EST_CONNECTION_STATUS_EVENT, this.handleConnectionStatus);
        if (this.statusTimer) {
            window.clearTimeout(this.statusTimer);
        }
    }

    handleContainerRef (element) {
        this.containerElement = element;
    }

    handleConnectionStatus (event) {
        const status = event && event.detail;
        this.setState({
            programActionsAllowed: Boolean(status && status.isConnected && status.isCompatible)
        });
    }

    handleDocumentMouseDown (event) {
        if (this.state.isSlotMenuOpen && this.containerElement &&
            !this.containerElement.contains(event.target)) {
            this.setState({isSlotMenuOpen: false});
        }
    }

    handlePreviousSlot () {
        this.selectSlot(this.state.selectedSlot - 1);
    }

    handleNextSlot () {
        this.selectSlot(this.state.selectedSlot + 1);
    }

    handleToggleSlotMenu () {
        this.setState(state => ({isSlotMenuOpen: !state.isSlotMenuOpen}));
    }

    handleSlotOption (event) {
        this.selectSlot(Number(event.currentTarget.dataset.slot));
    }

    async handleAction (event) {
        const action = event.currentTarget.dataset.action;
        if (this.state.busyAction || !PROGRAM_ACTION_CHANNELS[action] ||
            (action !== 'stop' && !this.state.programActionsAllowed)) {
            return;
        }
        const slot = this.state.selectedSlot;
        const operationMessages = {
            download: [`正在下载到槽位 ${slot}…`, `已下载到槽位 ${slot}`],
            run: [`正在下载并启动槽位 ${slot}…`, `槽位 ${slot} 的程序已启动`],
            stop: ['正在停止程序…', '程序已停止']
        };
        this.setState({
            busyAction: action,
            isSlotMenuOpen: false,
            operationMessage: operationMessages[action][0]
        });
        try {
            if (action === 'stop') {
                await ipcRenderer.invoke(PROGRAM_ACTION_CHANNELS[action]);
            } else {
                await ipcRenderer.invoke(PROGRAM_ACTION_CHANNELS[action], buildEstProgramRequest({
                    source: this.props.codeEditorValue,
                    slot,
                    projectTitle: this.props.projectTitle
                }));
            }
            if (action === 'run' || action === 'stop') {
                window.dispatchEvent(new CustomEvent(EST_PROGRAM_ACTIVITY_EVENT, {
                    detail: {isRunning: action === 'run'}
                }));
            }
            this.showTemporaryStatus(operationMessages[action][1]);
        } catch (error) {
            this.showTemporaryStatus('操作失败');
            const detail = formatProgramOperationError(error);
            await dialog.showMessageBox(remote.getCurrentWindow(), {
                type: 'error',
                title: 'EST 程序操作失败',
                message: '无法完成程序操作。',
                detail
            });
        } finally {
            this.setState({busyAction: null});
        }
    }

    showTemporaryStatus (operationMessage) {
        if (this.statusTimer) {
            window.clearTimeout(this.statusTimer);
        }
        this.setState({operationMessage});
        this.statusTimer = window.setTimeout(() => {
            this.statusTimer = null;
            this.setState({operationMessage: null});
        }, 2500);
    }

    selectSlot (slot) {
        if (!SLOT_OPTIONS.includes(slot)) {
            return;
        }
        try {
            window.localStorage.setItem(SLOT_STORAGE_KEY, String(slot));
        } catch (e) {
            // Slot persistence is optional when storage is unavailable.
        }
        this.setState({
            isSlotMenuOpen: false,
            selectedSlot: slot
        });
        window.dispatchEvent(new CustomEvent(PROGRAM_SLOT_CHANGE_EVENT, {
            detail: {slot}
        }));
    }

    render () {
        const {
            busyAction,
            isSlotMenuOpen,
            operationMessage,
            programActionsAllowed,
            selectedSlot
        } = this.state;
        const controlsBusy = Boolean(busyAction);
        return (
            <div
                aria-label="EST program controls"
                className={styles.controls}
                ref={this.handleContainerRef}
                role="group"
            >
                {operationMessage && (
                    <div
                        aria-live="polite"
                        className={styles.operationMessage}
                        role="status"
                    >
                        {operationMessage}
                    </div>
                )}
                <div className={styles.slotSelector}>
                    <button
                        aria-label="Previous program slot"
                        className={styles.slotArrow}
                        disabled={controlsBusy || selectedSlot === SLOT_OPTIONS[0]}
                        title="上一个槽位"
                        type="button"
                        onClick={this.handlePreviousSlot}
                    >
                        ‹
                    </button>
                    <div className={styles.slotPicker}>
                        {isSlotMenuOpen && (
                            <div
                                aria-label="Select program slot"
                                className={styles.slotMenu}
                                role="group"
                            >
                                {SLOT_OPTIONS.map(slot => (
                                    <button
                                        aria-label={`Select slot ${slot}`}
                                        className={classNames(
                                            styles.slotOption,
                                            slot === selectedSlot && styles.slotOptionSelected
                                        )}
                                        data-slot={slot}
                                        key={slot}
                                        type="button"
                                        onClick={this.handleSlotOption}
                                    >
                                        {slot}
                                    </button>
                                ))}
                            </div>
                        )}
                        <button
                            aria-expanded={isSlotMenuOpen}
                            aria-label={`Current program slot ${selectedSlot}`}
                            className={styles.slotDisplay}
                            disabled={controlsBusy}
                            title="选择程序槽位"
                            type="button"
                            onClick={this.handleToggleSlotMenu}
                        >
                            <span className={styles.slotLabel}>SLOT</span>
                            <span className={styles.slotNumber}>{selectedSlot}</span>
                        </button>
                    </div>
                    <button
                        aria-label="Next program slot"
                        className={styles.slotArrow}
                        disabled={controlsBusy || selectedSlot === SLOT_OPTIONS[SLOT_OPTIONS.length - 1]}
                        title="下一个槽位"
                        type="button"
                        onClick={this.handleNextSlot}
                    >
                        ›
                    </button>
                </div>
                <div className={styles.actionButtons}>
                    <button
                        aria-label="Stop program"
                        aria-busy={busyAction === 'stop'}
                        className={`${styles.controlButton} ${styles.stopButton}`}
                        data-action="stop"
                        disabled={controlsBusy}
                        title="停止程序"
                        type="button"
                        onClick={this.handleAction}
                    >
                        <span className={styles.stopIcon} />
                    </button>
                    <button
                        aria-label="Run program"
                        aria-busy={busyAction === 'run'}
                        className={`${styles.controlButton} ${styles.runButton}`}
                        data-action="run"
                        disabled={controlsBusy || !programActionsAllowed}
                        title={programActionsAllowed ? '运行程序' : '连接兼容固件后运行程序'}
                        type="button"
                        onClick={this.handleAction}
                    >
                        <svg
                            aria-hidden="true"
                            className={styles.playIcon}
                            viewBox="0 0 24 24"
                        >
                            <path d={PLAY_ICON_PATH} />
                        </svg>
                    </button>
                    <button
                        aria-label="Download program"
                        aria-busy={busyAction === 'download'}
                        className={`${styles.controlButton} ${styles.downloadButton}`}
                        data-action="download"
                        disabled={controlsBusy || !programActionsAllowed}
                        title={programActionsAllowed ? '下载程序' : '连接兼容固件后下载程序'}
                        type="button"
                        onClick={this.handleAction}
                    >
                        <svg
                            aria-hidden="true"
                            className={styles.downloadIcon}
                            viewBox="0 0 24 24"
                        >
                            <path d="M10 3h4v9h4.5L12 19l-6.5-7H10V3zm-4 18h12v2H6v-2z" />
                        </svg>
                    </button>
                </div>
            </div>
        );
    }
}

EstProgramControls.propTypes = {
    codeEditorValue: PropTypes.string.isRequired,
    projectTitle: PropTypes.string
};

const mapStateToProps = state => ({
    codeEditorValue: state.scratchGui.code.codeEditorValue,
    projectTitle: state.scratchGui.projectTitle
});

export {
    PROGRAM_ACTION_CHANNELS,
    PROGRAM_SLOT_CHANGE_EVENT,
    SLOT_OPTIONS
};

export default connect(mapStateToProps)(EstProgramControls);
