import classNames from 'classnames';
import React from 'react';

import styles from './EstProgramControls.css';

const PROGRAM_CONTROL_EVENT = 'est-program-control-request';
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

const requestProgramAction = (action, slot) => {
    window.dispatchEvent(new CustomEvent(PROGRAM_CONTROL_EVENT, {
        detail: {action, slot}
    }));
};

class EstProgramControls extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            isSlotMenuOpen: false,
            selectedSlot: readStoredSlot()
        };
        this.handleAction = this.handleAction.bind(this);
        this.handleContainerRef = this.handleContainerRef.bind(this);
        this.handleDocumentMouseDown = this.handleDocumentMouseDown.bind(this);
        this.handleNextSlot = this.handleNextSlot.bind(this);
        this.handlePreviousSlot = this.handlePreviousSlot.bind(this);
        this.handleSlotOption = this.handleSlotOption.bind(this);
        this.handleToggleSlotMenu = this.handleToggleSlotMenu.bind(this);
    }

    componentDidMount () {
        document.addEventListener('mousedown', this.handleDocumentMouseDown);
    }

    componentWillUnmount () {
        document.removeEventListener('mousedown', this.handleDocumentMouseDown);
    }

    handleContainerRef (element) {
        this.containerElement = element;
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

    handleAction (event) {
        requestProgramAction(event.currentTarget.dataset.action, this.state.selectedSlot);
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
        const {isSlotMenuOpen, selectedSlot} = this.state;
        return (
            <div
                aria-label="EST program controls"
                className={styles.controls}
                ref={this.handleContainerRef}
                role="group"
            >
                <div className={styles.slotSelector}>
                    <button
                        aria-label="Previous program slot"
                        className={styles.slotArrow}
                        disabled={selectedSlot === SLOT_OPTIONS[0]}
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
                        disabled={selectedSlot === SLOT_OPTIONS[SLOT_OPTIONS.length - 1]}
                        title="下一个槽位"
                        type="button"
                        onClick={this.handleNextSlot}
                    >
                        ›
                    </button>
                </div>
                <div className={styles.actionButtons}>
                    <button
                        aria-label="Pause program"
                        className={`${styles.controlButton} ${styles.pauseButton}`}
                        data-action="pause"
                        title="暂停程序"
                        type="button"
                        onClick={this.handleAction}
                    >
                        <span className={styles.pauseIcon} />
                    </button>
                    <button
                        aria-label="Run program"
                        className={`${styles.controlButton} ${styles.runButton}`}
                        data-action="run"
                        title="运行程序"
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
                        className={`${styles.controlButton} ${styles.downloadButton}`}
                        data-action="download"
                        title="下载程序"
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

export {
    PROGRAM_CONTROL_EVENT,
    PROGRAM_SLOT_CHANGE_EVENT,
    SLOT_OPTIONS,
    requestProgramAction
};

export default EstProgramControls;
