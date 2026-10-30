/* eslint-disable react/jsx-no-bind */
import React from 'react';
import PropTypes from 'prop-types';
import {createPortal} from 'react-dom';
import {ipcRenderer} from 'electron';
import {NEW_FIRMWARE_VERSION, newAiFirmwareMismatchKey, newAiFirmwareRecoveryPort,
    newAiFirmwareBlockers} from '../../common/new-ai-firmware';
import {newAiText, newAiErrorText} from './runtime-messages';
import styles from '../spark-ai/SparkRuntime.css';

// Mounted beside the connection button so version prompts also work with the inspector closed.
export default class NewAiFirmwarePanel extends React.Component {
    constructor (props) {
        super(props);
        this.state = {open: Boolean(props.device.firmware && props.device.firmware.active),
            starting: false,
            attempted: Boolean(props.device.firmware && props.device.firmware.active),
            error: '',
            mismatch: false};
        this.panel = React.createRef();
        this.connectionEpoch = 0;
        this.keydown = event => {
            if (!this.state.open) return;
            event.stopPropagation();
            if (event.key === 'Escape') {
                event.preventDefault(); this.close();
            }
            if (event.key !== 'Tab' || !this.panel.current) return;
            const items = [...this.panel.current.querySelectorAll('button:not(:disabled)')];
            if (!items.length) {
                event.preventDefault(); return;
            }
            const index = items.indexOf(document.activeElement);
            if (event.shiftKey && index <= 0) {
                event.preventDefault(); items[items.length - 1].focus();
            } else if (!event.shiftKey && (index < 0 || index === items.length - 1)) {
                event.preventDefault(); items[0].focus();
            }
        };
    }
    componentDidMount () {
        document.addEventListener('keydown', this.keydown, true);
        this.maybePrompt();
    }
    componentDidUpdate (previous, state) {
        const before = previous.device;
        const after = this.props.device;
        if (before.connected !== after.connected || before.port !== after.port ||
            before.connectionMode !== after.connectionMode) {
            this.connectionEpoch++;
            if (!after.connected && !this.active()) this.prompted = null;
        }
        this.maybePrompt();
        if (!state.open && this.state.open && this.panel.current) {
            const button = this.panel.current.querySelector('button:not(:disabled)');
            (button || this.panel.current).focus({preventScroll: true});
        }
    }
    componentWillUnmount () {
        this.unmounted = true;
        document.removeEventListener('keydown', this.keydown, true);
    }
    active () {
        return this.state.starting || Boolean(this.props.device.firmware && this.props.device.firmware.active);
    }
    waitingForRestart () {
        const firmware = this.props.device.firmware;
        return Boolean(firmware && firmware.active && firmware.transferComplete &&
            ['restarting', 'reconnecting'].includes(firmware.phase));
    }
    maybePrompt () {
        const key = newAiFirmwareMismatchKey(this.props.device);
        if (!key || this.prompted === key || this.state.open) return;
        this.prompted = key;
        this.open(true);
    }
    open (mismatch = false) {
        if (this.state.open) return;
        this.previousFocus = document.activeElement;
        this.prompted = newAiFirmwareMismatchKey(this.props.device) || this.prompted;
        this.setState({open: true, error: '', attempted: this.active(), mismatch});
        if (this.props.onOpen) this.props.onOpen();
    }
    close () {
        if (this.active() && !this.waitingForRestart()) return;
        this.setState({open: false}, () => {
            if (this.previousFocus && this.previousFocus.isConnected) this.previousFocus.focus({preventScroll: true});
            if (this.props.onClose) this.props.onClose();
        });
    }
    async start () {
        if (this.startPending || this.active() || this.props.device.busy) return;
        this.startPending = true;
        const epoch = this.connectionEpoch;
        this.setState({starting: true, attempted: true, error: ''});
        try {
            // File validation is automatic. The dialog's Update button is the sole user confirmation.
            const report = await ipcRenderer.invoke('new-ai-firmware-inspect');
            if (this.unmounted) return;
            if (epoch !== this.connectionEpoch) throw new Error('NEW_FW_DEVICE_CHANGED');
            const device = this.props.device;
            const recovery = !device.connected && Boolean((device.firmware && device.firmware.recoveryRequired) ||
                device.error === 'NEW_FW_RECOVERY' || (device.discovery && device.discovery.status === 'recovery'));
            const ports = ((device.discovery && device.discovery.ports) || []).filter(newAiFirmwareRecoveryPort);
            const path = recovery && ports.length === 1 ? ports[0].path : null;
            const blockers = newAiFirmwareBlockers(device, report, {recovery, path});
            if (blockers.length) throw new Error(blockers[0]);
            await ipcRenderer.invoke('new-ai-firmware-update', {releaseId: report.releaseId,
                confirmedErase: true,
                recovery,
                path});
        } catch (error) {
            if (!this.unmounted) this.setState({error});
        } finally {
            this.startPending = false;
            if (!this.unmounted) this.setState({starting: false});
        }
    }
    render () {
        if (!this.state.open) return null;
        const {locale, device} = this.props;
        const {starting, attempted, error, mismatch} = this.state;
        const t = (id, values) => newAiText(id, locale, values);
        const firmware = attempted ? device.firmware : null;
        const active = this.active();
        const dismissible = this.waitingForRestart();
        const complete = !error && !active && firmware && firmware.phase === 'complete';
        const failure = error || (!active && firmware && firmware.phase === 'error' && firmware.error);
        const phase = starting && (!firmware || !firmware.active) ? 'checking' : (firmware && firmware.phase);
        return createPortal(<div className={styles.backdrop}>
            <section
                id="new-ai-firmware-panel"
                className={styles.firmwareDialog}
                role="dialog"
                aria-modal="true"
                aria-labelledby="new-ai-firmware-title"
                aria-describedby="new-ai-firmware-notice"
                aria-busy={active}
                tabIndex={-1}
                ref={this.panel}
            >
                <h2 id="new-ai-firmware-title">{t(complete ? 'firmwareDone' : 'firmwareUpdate')}</h2>
                {attempted ? null : <p>{mismatch ? t('firmwareMismatch',
                    {current: device.status && device.status.version, version: NEW_FIRMWARE_VERSION}) :
                    t('firmwareQuestion', {version: NEW_FIRMWARE_VERSION})}</p>}
                <p id="new-ai-firmware-notice">{t('firmwareEraseNotice')}</p>
                {dismissible ? <p>{t('firmwareBackgroundHint')}</p> : null}
                {active || complete ? <div
                    className={styles.firmwareProgress}
                    role="status"
                >
                    <strong>{t(`fw.${complete ? 'complete' : phase || 'checking'}`,
                        {version: firmware && firmware.result && firmware.result.version})}</strong>
                    {active && phase === 'transferring' && firmware ? <React.Fragment>
                        <progress
                            max={firmware.total}
                            value={firmware.bytes}
                        />
                        <span>{Math.floor(firmware.bytes * 100 / firmware.total)}%</span>
                    </React.Fragment> : null}
                </div> : null}
                {failure ? <p
                    className={styles.error}
                    role="alert"
                >{newAiErrorText(failure, locale)}</p> : null}
                <div className={styles.firmwareActions}>
                    <button
                        id="new-ai-firmware-cancel"
                        type="button"
                        className={styles.command}
                        disabled={active && !dismissible}
                        onClick={() => this.close()}
                    >{t(dismissible || complete || failure ? 'firmwareClose' : 'firmwareCancel')}</button>
                    {complete ? null : <button
                        id="new-ai-firmware-start"
                        type="button"
                        className={`${styles.command} ${styles.firmwarePrimary}`}
                        disabled={active || device.busy}
                        onClick={() => this.start()}
                    >{t(active ? 'firmwareUpdating' : (failure ? 'firmwareRetry' : 'firmwareStart'))}</button>}
                </div>
            </section>
        </div>, document.body);
    }
}
NewAiFirmwarePanel.propTypes = {
    locale: PropTypes.string.isRequired,
    onOpen: PropTypes.func,
    onClose: PropTypes.func,
    device: PropTypes.shape({
        connected: PropTypes.bool,
        port: PropTypes.string,
        connectionMode: PropTypes.string,
        busy: PropTypes.bool,
        error: PropTypes.string,
        firmware: PropTypes.shape({active: PropTypes.bool,
            transferComplete: PropTypes.bool,
            recoveryRequired: PropTypes.bool,
            phase: PropTypes.string,
            total: PropTypes.number,
            bytes: PropTypes.number,
            error: PropTypes.string,
            result: PropTypes.shape({version: PropTypes.number})}),
        discovery: PropTypes.shape({status: PropTypes.string, ports: PropTypes.arrayOf(PropTypes.shape({}))}),
        status: PropTypes.shape({version: PropTypes.number})
    }).isRequired
};
