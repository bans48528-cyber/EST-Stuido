/* eslint-disable react/jsx-no-bind */
import React from 'react';
import PropTypes from 'prop-types';
import {createPortal} from 'react-dom';
import {ipcRenderer} from 'electron';
import {SPARK_FIRMWARE_VERSION, sparkFirmwareMismatchKey, sparkFirmwareRecoveryPort,
    sparkFirmwareBlockers} from '../../common/spark-firmware';
import {sparkRuntimeText, sparkRuntimeError} from './runtime-messages';
import styles from './SparkRuntime.css';

// Mounted beside the connection button so version prompts also work with the inspector closed.
export default class SparkFirmwarePanel extends React.Component {
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
        const key = sparkFirmwareMismatchKey(this.props.device);
        if (!key || this.prompted === key || this.state.open) return;
        this.prompted = key;
        this.open(true);
    }
    open (mismatch = false) {
        if (this.state.open) return;
        this.previousFocus = document.activeElement;
        this.prompted = sparkFirmwareMismatchKey(this.props.device) || this.prompted;
        this.setState({open: true, error: '', attempted: this.active(), mismatch});
        if (this.props.onOpen) this.props.onOpen();
    }
    close () {
        if (this.active() && !this.waitingForRestart()) return;
        this.setState({open: false}, () => {
            if (this.previousFocus && this.previousFocus.isConnected) this.previousFocus.focus({preventScroll: true});
        });
    }
    async start () {
        if (this.startPending || this.active() || this.props.device.busy) return;
        this.startPending = true;
        const epoch = this.connectionEpoch;
        this.setState({starting: true, attempted: true, error: ''});
        try {
            // File validation is automatic. The dialog's Update button is the sole user confirmation.
            const report = await ipcRenderer.invoke('spark-firmware-inspect');
            if (this.unmounted) return;
            if (epoch !== this.connectionEpoch) throw new Error('SPARK_FW_DEVICE_CHANGED');
            const device = this.props.device;
            const recovery = !device.connected && Boolean((device.firmware && device.firmware.recoveryRequired) ||
                device.error === 'SPARK_FW_RECOVERY' || (device.discovery && device.discovery.status === 'recovery'));
            const ports = ((device.discovery && device.discovery.ports) || []).filter(sparkFirmwareRecoveryPort);
            const path = recovery && ports.length === 1 ? ports[0].path : null;
            const blockers = sparkFirmwareBlockers(device, report, {recovery, path});
            if (blockers.length) throw new Error(blockers[0]);
            await ipcRenderer.invoke('spark-firmware-update', {releaseId: report.releaseId,
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
        const t = (id, values) => sparkRuntimeText(id, locale, values);
        const firmware = attempted ? device.firmware : null;
        const active = this.active();
        const dismissible = this.waitingForRestart();
        const complete = !error && !active && firmware && firmware.phase === 'complete';
        const failure = error || (!active && firmware && firmware.phase === 'error' && firmware.error);
        const phase = starting && (!firmware || !firmware.active) ? 'checking' : (firmware && firmware.phase);
        return createPortal(<div className={styles.backdrop}>
            <section
                id="spark-firmware-panel"
                className={styles.firmwareDialog}
                role="dialog"
                aria-modal="true"
                aria-labelledby="spark-firmware-title"
                aria-describedby="spark-firmware-notice"
                aria-busy={active}
                tabIndex={-1}
                ref={this.panel}
            >
                <h2 id="spark-firmware-title">{t(complete ? 'firmwareDone' : 'firmwareUpdate')}</h2>
                {attempted ? null : <p>{mismatch ? t('firmwareMismatch',
                    {current: device.status && device.status.version, version: SPARK_FIRMWARE_VERSION}) :
                    t('firmwareQuestion', {version: SPARK_FIRMWARE_VERSION})}</p>}
                <p id="spark-firmware-notice">{t('firmwareEraseNotice')}</p>
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
                >{sparkRuntimeError(failure, locale)}</p> : null}
                <div className={styles.firmwareActions}>
                    <button
                        id="spark-firmware-cancel"
                        type="button"
                        className={styles.command}
                        disabled={active && !dismissible}
                        onClick={() => this.close()}
                    >{t(dismissible || complete || failure ? 'firmwareClose' : 'firmwareCancel')}</button>
                    {complete ? null : <button
                        id="spark-firmware-start"
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
SparkFirmwarePanel.propTypes = {
    locale: PropTypes.string.isRequired,
    onOpen: PropTypes.func,
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
