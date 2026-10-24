/* eslint-disable react/jsx-no-bind */
import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {ipcRenderer} from 'electron';
import {dialog, getCurrentWindow} from '@electron/remote';
import {getEstText} from '../est-i18n';
import {withSparkHardware} from '../hardware/HardwareGate.jsx';
import {subscribeSparkState, EMPTY_SPARK_STATE} from './runtime-client';
import {sparkRuntimeText, sparkRuntimeError, sparkErrorCode} from './runtime-messages';
import controls from '../EstProgramControls.css';
import styles from './SparkRuntime.css';
import {SPARK_MOTOR_PAIR_INCOMPLETE} from './combined-motor-field';

const SLOTS = Array.from({length: 10}, (value, index) => index);
const STORAGE = 'estStudio.sparkProgramSlot';
const initialSlot = () => {
    try {
        const slot = Number(window.localStorage.getItem(STORAGE));
        return SLOTS.includes(slot) ? slot : 0;
    } catch (error) {
        return 0;
    }
};

class SparkProgramControls extends React.Component {
    constructor (props) {
        super(props);
        this.state = {device: EMPTY_SPARK_STATE, slot: initialSlot(), menu: false, action: null};
        this.outside = event => {
            if (this.container && !this.container.contains(event.target)) this.setState({menu: false});
        };
    }
    componentDidMount () {
        this.unsubscribe = subscribeSparkState(device => {
            const previous = this.state.device;
            const fields = ['connected', 'compatible', 'busy', 'stale', 'state', 'error',
                'compilerSupported', 'firmware', 'warning'];
            if (fields.some(field => previous[field] !== device[field]) ||
                previous.operation !== device.operation || previous.result !== device.result) this.setState({device});
        });
        document.addEventListener('mousedown', this.outside);
    }
    componentWillUnmount () {
        this.unmounted = true;
        this.unsubscribe();
        document.removeEventListener('mousedown', this.outside);
    }
    selectSlot (slot) {
        if (!SLOTS.includes(slot)) return;
        try {
            window.localStorage.setItem(STORAGE, String(slot));
        } catch (error) { /* Selection still works. */ }
        this.setState({slot, menu: false});
    }
    async action (action) {
        if (this.state.action || this.state.device.busy) return;
        this.setState({action, menu: false});
        try {
            if (action === 'stop') await ipcRenderer.invoke('spark-stop-program');
            else {
                const {code, locked, vm} = this.props;
                if (locked && vm && !vm.runtime.targets.some(target => Object.values(target.blocks._blocks)
                    .some(block => block.opcode === 'spark_event_whenflagclicked' &&
                        block.topLevel && !block.disabled))) {
                    throw new Error('SPARK_NO_START');
                }
                if (!code.trim()) throw new Error('SPARK_SOURCE_INVALID');
                if (locked && code.includes(`# ${SPARK_MOTOR_PAIR_INCOMPLETE}\n`)) {
                    throw new Error(SPARK_MOTOR_PAIR_INCOMPLETE);
                }
                await ipcRenderer.invoke(action === 'run' ? 'spark-run-program' : 'spark-download-program',
                    {source: code, slot: this.state.slot});
            }
        } catch (error) {
            if (!['SPARK_CANCELLED', 'SPARK_DOWNLOAD_INCOMPLETE'].includes(sparkErrorCode(error))) {
                await dialog.showMessageBox(getCurrentWindow(), {type: 'error',
                    title: 'Spark AI',
                    message: sparkRuntimeError(error, this.props.locale),
                    detail: String(error.message || error)
                        .replace(/^Error invoking remote method '[^']+': Error:\s*/, '')
                        .slice(0, 4096)});
            }
        } finally {
            if (!this.unmounted) this.setState({action: null});
        }
    }
    render () {
        const {locale} = this.props;
        const t = (id, values) => sparkRuntimeText(id, locale, values);
        const common = (id, values) => getEstText(`programControls.${id}`, locale, values);
        const {device, action, slot, menu} = this.state;
        const busy = Boolean(action || device.busy);
        const allowed = device.connected && device.compatible && device.compilerSupported &&
            (!device.stale || !device.monitoring);
        const operation = device.operation;
        let message = device.error ? t(device.error) : (device.warning ? t(device.warning) : '');
        if (device.firmware && device.firmware.active) {
            message = t(`fw.${device.firmware.phase}`);
        } else if (operation) {
            message = t(({run: 'compiling', download: 'compiling', stop: 'stopping'})[operation.phase] ||
            operation.phase, {percent: operation.total ?
                Math.floor(operation.bytes * 100 / operation.total) : 0});
        } else if (!message && device.result) {
            const result = device.result;
            message = t(result.stopObserved ? 'stopped' : (result.startRequested ?
                (result.runObserved ? 'runObserved' : 'runUnconfirmed') : 'downloaded'), {slot: result.slot});
        }
        return (<div
            className={`${controls.controls} ${styles.programControls}`}
            id="spark-program-controls"
            ref={element => {
                this.container = element;
            }}
            role="group"
            aria-label="Spark AI"
        >
            {message ? <div
                className={`${controls.operationMessage} ${styles.operationMessage}`}
                role="status"
                aria-live="polite"
            >
                <span>{message}</span>
                {operation && operation.total > 0 ? <progress
                    max={operation.total}
                    value={operation.bytes}
                /> : null}
                {busy && operation ? <button
                    type="button"
                    className={styles.iconButton}
                    title={getEstText('hardwareChoice.cancel', locale)}
                    aria-label={getEstText('hardwareChoice.cancel', locale)}
                    onClick={() => ipcRenderer.invoke('spark-cancel').catch(() => {})}
                >&times;</button> : null}
            </div> : null}
            <div className={controls.slotSelector}>
                <button
                    type="button"
                    className={controls.slotArrow}
                    disabled={busy || slot === 0}
                    title={common('previousSlot')}
                    aria-label={common('previousSlot')}
                    onClick={() => this.selectSlot(slot - 1)}
                >‹</button>
                <div className={controls.slotPicker}>
                    {menu ? <div
                        className={controls.slotMenu}
                        role="group"
                        aria-label={common('selectSlot')}
                    >
                        {SLOTS.map(number => (<button
                            key={number}
                            type="button"
                            data-slot={number}
                            className={`${controls.slotOption} ${slot === number ? controls.slotOptionSelected : ''}`}
                            aria-label={common('selectSlotNumber', {slot: number})}
                            onClick={() => this.selectSlot(number)}
                        >{number}</button>))}
                    </div> : null}
                    <button
                        type="button"
                        className={controls.slotDisplay}
                        disabled={busy}
                        aria-expanded={menu}
                        aria-label={common('currentSlot', {slot})}
                        title={common('selectSlot')}
                        onClick={() => this.setState({menu: !menu})}
                    >
                        <span className={controls.slotLabel}>{common('slotLabel')}</span>
                        <span className={controls.slotNumber}>{slot}</span>
                    </button>
                </div>
                <button
                    type="button"
                    className={controls.slotArrow}
                    disabled={busy || slot === 9}
                    title={common('nextSlot')}
                    aria-label={common('nextSlot')}
                    onClick={() => this.selectSlot(slot + 1)}
                >›</button>
            </div>
            <div className={controls.actionButtons}>
                <button
                    type="button"
                    data-action="stop"
                    aria-label={common('stopProgram')}
                    title={common('stopProgram')}
                    className={`${controls.controlButton} ${controls.stopButton}`}
                    disabled={busy || !device.connected}
                    onClick={() => this.action('stop')}
                ><span className={controls.stopIcon} /></button>
                <button
                    type="button"
                    data-action="run"
                    aria-label={common('runProgram')}
                    title={common('runProgram')}
                    className={`${controls.controlButton} ${controls.runButton}`}
                    disabled={busy || !allowed}
                    onClick={() => this.action('run')}
                >
                    <svg
                        aria-hidden="true"
                        className={controls.playIcon}
                        viewBox="0 0 24 24"
                    >
                        <path
                            d={'M7 4.8v14.4c0 1.2 1.3 1.9 2.3 1.2l10.2-7.2' +
                            'c.8-.6.8-1.8 0-2.4L9.3 3.6C8.3 2.9 7 3.6 7 4.8z'}
                        />
                    </svg>
                </button>
                <button
                    type="button"
                    data-action="download"
                    aria-label={common('downloadProgram')}
                    title={common('downloadProgram')}
                    disabled={busy || !allowed}
                    className={`${controls.controlButton} ${controls.downloadButton}`}
                    onClick={() => this.action('download')}
                >
                    <svg
                        aria-hidden="true"
                        className={controls.downloadIcon}
                        viewBox="0 0 24 24"
                    >
                        <path d="M10 3h4v9h4.5L12 19l-6.5-7H10V3zm-4 18h12v2H6v-2z" />
                    </svg>
                </button>
            </div>
        </div>);
    }
}
SparkProgramControls.propTypes = {code: PropTypes.string.isRequired,
    locale: PropTypes.string.isRequired,
    locked: PropTypes.bool,
    vm: PropTypes.shape({runtime: PropTypes.shape({targets: PropTypes.arrayOf(PropTypes.shape({}))})})};
export default withSparkHardware(connect(state => ({code: state.scratchGui.code.codeEditorValue,
    locale: state.locales.locale,
    locked: state.scratchGui.code.isCodeEditorLocked,
    vm: state.scratchGui.vm}))(SparkProgramControls));
