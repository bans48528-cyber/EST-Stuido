/* eslint-disable react/jsx-no-bind */
import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {ipcRenderer} from 'electron';
import {withNewAiHardware} from '../hardware/HardwareGate.jsx';
import {getEstText} from '../est-i18n';
import {newAiText, newAiErrorText} from './runtime-messages';
import {EMPTY_NEW_AI_STATE, subscribeNewAiState} from './runtime-client';
import controls from '../EstProgramControls.css';
import styles from '../spark-ai/SparkRuntime.css';
import layout from './NewAiProgramControls.css';

const STORAGE = 'estStudio.newAiProgramSlot';
const initialSlot = () => {
    try {
        const slot = Number(window.localStorage.getItem(STORAGE));
        return Number.isInteger(slot) && slot >= 0 && slot < 20 ? slot : 0;
    } catch (error) {
        return 0;
    }
};
class NewAiProgramControls extends React.Component {
    constructor (props) {
        super(props);
        this.state = {device: EMPTY_NEW_AI_STATE, slot: initialSlot(), menu: false, action: false, error: ''};
        this.outside = event => {
            if (this.container && !this.container.contains(event.target)) this.setState({menu: false});
        };
    }
    componentDidMount () {
        this.unsubscribe = subscribeNewAiState(device => {
            const previous = this.state.device;
            const fields = ['connected', 'downloadSupported', 'programSupported', 'stopAttemptPending',
                'compilerSupported', 'busy', 'stale', 'error', 'warning'];
            const resultChanged = JSON.stringify(previous.result) !== JSON.stringify(device.result);
            if (fields
                .some(key => previous[key] !== device[key]) ||
                Boolean(previous.status && previous.status.running) !==
                    Boolean(device.status && device.status.running) ||
                JSON.stringify(previous.operation) !== JSON.stringify(device.operation) ||
                JSON.stringify(previous.firmware) !== JSON.stringify(device.firmware) ||
                resultChanged) {
                this.setState({device,
                    ...(resultChanged && device.result && !device.error ? {error: ''} : {})});
            }
        });
        document.addEventListener('mousedown', this.outside);
    }
    componentWillUnmount () {
        this.unmounted = true;
        this.unsubscribe();
        document.removeEventListener('mousedown', this.outside);
    }
    selectSlot (slot) {
        if (!Number.isInteger(slot) || slot < 0 || slot > 19) return;
        try {
            window.localStorage.setItem(STORAGE, String(slot));
        } catch (error) { /* Selection still works. */ }
        this.setState({slot, menu: false});
    }
    async action (kind) {
        if (this.state.action || this.state.device.busy) return;
        this.setState({action: true, error: '', menu: false});
        try {
            if (kind === 'stop') {
                await ipcRenderer.invoke('new-ai-stop-program');
                return;
            }
            const isStart = block => String(block.opcode || '').startsWith('new_event_when') &&
                block.topLevel && !block.disabled;
            if (this.props.locked && !this.props.vm.runtime.targets.some(target =>
                Object.values(target.blocks._blocks).some(isStart))) throw new Error('NEW_NO_START');
            if (this.props.locked && this.props.code.includes('# NEW_MOTOR_PAIR_INCOMPLETE')) {
                throw new Error('NEW_MOTOR_PAIR_INCOMPLETE');
            }
            const channel = {compile: 'new-ai-compile-program',
                download: 'new-ai-download-program',
                run: 'new-ai-run-program'}[kind];
            await ipcRenderer.invoke(channel, {source: this.props.code,
                ...(kind === 'compile' ? {} : {slot: this.state.slot})});
        } catch (error) {
            if (!this.unmounted) this.setState({error: newAiErrorText(error, this.props.locale)});
        } finally {
            if (!this.unmounted) this.setState({action: false});
        }
    }
    render () {
        const {device, slot, menu, action, error} = this.state;
        const {locale} = this.props;
        const t = key => newAiText(key, locale);
        const common = (key, values) => getEstText(`programControls.${key}`, locale, values);
        const busy = action || device.busy;
        const blocked = [[device.connected, 'NEW_DISCONNECTED'],
            [device.compilerSupported, 'NEW_COMPILER_UNSUPPORTED'],
            [device.downloadSupported, 'NEW_VERSION_UNSUPPORTED'],
            [!device.stale, 'NEW_STATUS_STALE'],
            [!(device.status && device.status.running), 'NEW_RUNNING']].find(([ready]) => !ready);
        const downloadReason = blocked ? blocked[1] : null;
        const firmware = device.firmware;
        const updating = Boolean(firmware && firmware.active);
        const operation = updating ? {...firmware, phase: `fw.${firmware.phase}`} : device.operation;
        let resultText = '';
        if (device.result) {
            const result = device.result;
            if (result.stopObserved) resultText = t('stopObserved');
            else if (result.startRequested) {
                resultText = `${t(result.runObserved ? 'runObserved' : 'runUnconfirmed')} ${result.slot}`;
            } else {
                resultText = result.downloaded ? `${t('downloaded')} ${result.slot}` :
                    `${t('compiled')} ${result.size} B`;
            }
        }
        const message = error || (operation ? t(operation.phase) :
            (device.error ? newAiErrorText(device.error, locale) :
                (device.warning ? t(device.warning) : resultText)));
        return (<div
            id="new-ai-program-controls"
            className={`${controls.controls} ${styles.programControls} ${layout.programControls}`}
            ref={element => {
                this.container = element;
            }}
            role="group"
            aria-label="NEW AI"
        >
            {message ? <div
                className={`${controls.operationMessage} ${styles.operationMessage} ${layout.operationMessage}`}
                role="status"
                aria-live="polite"
            >
                <span>{message}</span>
                {operation && operation.total > 0 ? <progress
                    max={operation.total}
                    value={operation.bytes}
                /> : null}
                {operation && !updating ? <button
                    type="button"
                    data-action="cancel"
                    className={styles.iconButton}
                    aria-label={getEstText('hardwareChoice.cancel', locale)}
                    title={t(['starting', 'stopping'].includes(operation.phase) ? 'cancelWait' : 'cancelTransfer')}
                    onClick={() => ipcRenderer.invoke('new-ai-cancel').catch(() => {})}
                >×</button> : null}
            </div> : null}
            <div className={`${controls.slotSelector} ${layout.slotSelector}`}>
                <button
                    type="button"
                    className={`${controls.slotArrow} ${layout.slotArrow}`}
                    disabled={busy || slot === 0}
                    aria-label={common('previousSlot')}
                    onClick={() => this.selectSlot(slot - 1)}
                >‹</button>
                <div className={controls.slotPicker}>
                    {menu ? <div
                        className={controls.slotMenu}
                        role="group"
                        aria-label={common('selectSlot')}
                    >
                        {Array.from({length: 20}, (_, number) => (<button
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
                        className={`${controls.slotDisplay} ${layout.slotDisplay}`}
                        disabled={busy}
                        aria-expanded={menu}
                        aria-label={common('currentSlot', {slot})}
                        onClick={() => this.setState({menu: !menu})}
                    >
                        <span className={controls.slotLabel}>{common('slotLabel')}</span>
                        <span className={controls.slotNumber}>{slot}</span>
                    </button>
                </div>
                <button
                    type="button"
                    className={`${controls.slotArrow} ${layout.slotArrow}`}
                    disabled={busy || slot === 19}
                    aria-label={common('nextSlot')}
                    onClick={() => this.selectSlot(slot + 1)}
                >›</button>
            </div>
            <div className={`${controls.actionButtons} ${layout.actions}`}>
                <button
                    type="button"
                    className={`${styles.command} ${layout.compileButton}`}
                    data-action="compile"
                    aria-label={t('checkCompile')}
                    title={device.compilerSupported ? t('checkCompile') : t('NEW_COMPILER_UNSUPPORTED')}
                    disabled={busy || !device.compilerSupported}
                    onClick={() => this.action('compile')}
                >
                    <svg
                        aria-hidden="true"
                        className={layout.compileIcon}
                        viewBox="0 0 24 24"
                    >
                        <path
                            d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8L14 2Zm0 0v6h6M8 15l3 3 5-6"
                        />
                    </svg>
                    <span className={layout.compileLabel}>{t('checkCompile')}</span>
                </button>
                <button
                    type="button"
                    data-action="stop"
                    aria-label={t('stopProgram')}
                    title={t('stopProgram')}
                    className={`${controls.controlButton} ${controls.stopButton} ${layout.controlButton}`}
                    disabled={busy || !device.programSupported || device.stale || device.stopAttemptPending}
                    onClick={() => this.action('stop')}
                >
                    <span
                        aria-hidden="true"
                        className={controls.stopIcon}
                    />
                </button>
                <button
                    type="button"
                    data-action="run"
                    aria-label={t('runProgram')}
                    title={downloadReason ? t(downloadReason) : t('runProgram')}
                    className={`${controls.controlButton} ${controls.runButton} ${layout.controlButton}`}
                    disabled={busy || !device.downloadSupported || device.stale ||
                        Boolean(device.status && device.status.running)}
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
                    title={downloadReason ? t(downloadReason) : common('downloadProgram')}
                    className={`${controls.controlButton} ${controls.downloadButton} ${layout.controlButton}`}
                    disabled={busy || !device.downloadSupported || device.stale ||
                        Boolean(device.status && device.status.running)}
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
NewAiProgramControls.propTypes = {code: PropTypes.string.isRequired,
    locale: PropTypes.string.isRequired,
    locked: PropTypes.bool,
    vm: PropTypes.shape({runtime: PropTypes.shape({targets: PropTypes.arrayOf(PropTypes.shape({}))})})};
export default withNewAiHardware(connect(state => ({code: state.scratchGui.code.codeEditorValue,
    locale: state.locales.locale,
    locked: state.scratchGui.code.isCodeEditorLocked,
    vm: state.scratchGui.vm}))(NewAiProgramControls));
