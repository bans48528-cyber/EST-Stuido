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
import {getEstText} from './est-i18n';
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
const formatProgramOperationError = (error, locale) => {
    const rawMessage = error && error.message ? error.message : String(error);
    const message = rawMessage.replace(
        /^Error invoking remote method '[^']+': (?:Error|TypeError):\s*/,
        ''
    );
    if (/cannot write to hid device|cannot read from hid device/i.test(message)) {
        return getEstText('programControls.usbDisconnected', locale);
    }
    if (/当前 EST 固件不支持这个程序使用的功能/.test(message)) {
        const detail = message.replace(/^当前 EST 固件不支持这个程序使用的功能。请升级到支持相应 EST Studio 功能的固件后再运行。\s*/, '');
        return `${getEstText('programControls.firmwareUpgradeRequired', locale)} ${detail}`.trim();
    }
    return message || getEstText('programControls.unknownError', locale);
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
        const {locale} = this.props;
        const slot = this.state.selectedSlot;
        const operationMessages = {
            download: [
                getEstText('programControls.downloadStart', locale, {slot}),
                getEstText('programControls.downloadDone', locale, {slot})
            ],
            run: [
                getEstText('programControls.runStart', locale, {slot}),
                getEstText('programControls.runDone', locale, {slot})
            ],
            stop: [
                getEstText('programControls.stopStart', locale),
                getEstText('programControls.stopDone', locale)
            ]
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
            this.showTemporaryStatus(getEstText('programControls.failed', locale));
            const detail = formatProgramOperationError(error, locale);
            await dialog.showMessageBox(remote.getCurrentWindow(), {
                type: 'error',
                title: getEstText('programControls.errorTitle', locale),
                message: getEstText('programControls.errorMessage', locale),
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
        const {locale} = this.props;
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
                aria-label={getEstText('programControls.group', locale)}
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
                        aria-label={getEstText('programControls.previousSlot', locale)}
                        className={styles.slotArrow}
                        disabled={controlsBusy || selectedSlot === SLOT_OPTIONS[0]}
                        title={getEstText('programControls.previousSlot', locale)}
                        type="button"
                        onClick={this.handlePreviousSlot}
                    >
                        ‹
                    </button>
                    <div className={styles.slotPicker}>
                        {isSlotMenuOpen && (
                            <div
                                aria-label={getEstText('programControls.selectSlot', locale)}
                                className={styles.slotMenu}
                                role="group"
                            >
                                {SLOT_OPTIONS.map(slot => (
                                    <button
                                        aria-label={getEstText('programControls.selectSlotNumber', locale, {slot})}
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
                            aria-label={getEstText('programControls.currentSlot', locale, {slot: selectedSlot})}
                            className={styles.slotDisplay}
                            disabled={controlsBusy}
                            title={getEstText('programControls.selectSlot', locale)}
                            type="button"
                            onClick={this.handleToggleSlotMenu}
                        >
                            <span className={styles.slotLabel}>SLOT</span>
                            <span className={styles.slotNumber}>{selectedSlot}</span>
                        </button>
                    </div>
                    <button
                        aria-label={getEstText('programControls.nextSlot', locale)}
                        className={styles.slotArrow}
                        disabled={controlsBusy || selectedSlot === SLOT_OPTIONS[SLOT_OPTIONS.length - 1]}
                        title={getEstText('programControls.nextSlot', locale)}
                        type="button"
                        onClick={this.handleNextSlot}
                    >
                        ›
                    </button>
                </div>
                <div className={styles.actionButtons}>
                    <button
                        aria-label={getEstText('programControls.stopProgram', locale)}
                        aria-busy={busyAction === 'stop'}
                        className={`${styles.controlButton} ${styles.stopButton}`}
                        data-action="stop"
                        disabled={controlsBusy}
                        title={getEstText('programControls.stopProgram', locale)}
                        type="button"
                        onClick={this.handleAction}
                    >
                        <span className={styles.stopIcon} />
                    </button>
                    <button
                        aria-label={getEstText('programControls.runProgram', locale)}
                        aria-busy={busyAction === 'run'}
                        className={`${styles.controlButton} ${styles.runButton}`}
                        data-action="run"
                        disabled={controlsBusy || !programActionsAllowed}
                        title={programActionsAllowed ?
                            getEstText('programControls.runProgram', locale) :
                            getEstText('programControls.runNeedsFirmware', locale)}
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
                        aria-label={getEstText('programControls.downloadProgram', locale)}
                        aria-busy={busyAction === 'download'}
                        className={`${styles.controlButton} ${styles.downloadButton}`}
                        data-action="download"
                        disabled={controlsBusy || !programActionsAllowed}
                        title={programActionsAllowed ?
                            getEstText('programControls.downloadProgram', locale) :
                            getEstText('programControls.downloadNeedsFirmware', locale)}
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
    locale: PropTypes.string.isRequired,
    projectTitle: PropTypes.string
};

const mapStateToProps = state => ({
    codeEditorValue: state.scratchGui.code.codeEditorValue,
    locale: state.locales.locale,
    projectTitle: state.scratchGui.projectTitle
});

export {
    formatProgramOperationError,
    PROGRAM_ACTION_CHANNELS,
    PROGRAM_SLOT_CHANGE_EVENT,
    SLOT_OPTIONS
};

export default connect(mapStateToProps)(EstProgramControls);
