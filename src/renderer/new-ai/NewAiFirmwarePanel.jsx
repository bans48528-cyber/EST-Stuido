/* eslint-disable react/jsx-no-bind */
import React from 'react';
import PropTypes from 'prop-types';
import {ipcRenderer} from 'electron';
import {newAiFirmwareBlockers} from '../../common/new-ai-firmware';
import {newAiText, newAiErrorText} from './runtime-messages';
import styles from '../spark-ai/SparkRuntime.css';
import layout from './NewAiFirmwarePanel.css';

export default class NewAiFirmwarePanel extends React.Component {
    constructor (props) {
        super(props);
        this.state = {open: Boolean(props.device.firmware && props.device.firmware.active),
            checking: false,
            starting: false,
            report: null,
            error: null,
            confirmedErase: false,
            confirmedLegacyIdle: false,
            recovery: false,
            confirmedRecoveryDevice: false,
            path: ''};
    }
    componentDidMount () {
        if (this.state.open) this.inspect();
    }
    componentDidUpdate (previous) {
        if (!this.props.device.busy && previous.device.port !== this.props.device.port) {
            // Consent must not carry over to a different USB connection.
            // eslint-disable-next-line react/no-did-update-set-state
            this.setState({confirmedErase: false, confirmedLegacyIdle: false, confirmedRecoveryDevice: false});
        }
    }
    componentWillUnmount () {
        this.unmounted = true;
    }
    async inspect () {
        if (this.checking) return;
        this.checking = true;
        this.setState({checking: true, error: null});
        try {
            const report = await ipcRenderer.invoke('new-ai-firmware-inspect');
            if (!this.unmounted) this.setState({report});
        } catch (error) {
            if (!this.unmounted) this.setState({error, report: null});
        } finally {
            this.checking = false;
            if (!this.unmounted) this.setState({checking: false});
        }
    }
    request () {
        const {report, confirmedErase, recovery, path, confirmedRecoveryDevice, confirmedLegacyIdle} = this.state;
        return {releaseId: report && report.releaseId,
            confirmedErase,
            path,
            confirmedRecoveryDevice,
            confirmedLegacyIdle,
            recovery: recovery && !this.props.device.connected};
    }
    async start () {
        if (this.starting) return;
        this.starting = true;
        this.setState({starting: true, error: null});
        try {
            await ipcRenderer.invoke('new-ai-firmware-update', this.request());
        } catch (error) {
            if (!this.unmounted) this.setState({error});
        } finally {
            this.starting = false;
            if (!this.unmounted) this.setState({starting: false, confirmedErase: false, confirmedLegacyIdle: false});
        }
    }
    render () {
        const {device, locale} = this.props;
        const {open, checking, starting, report, error, confirmedErase, confirmedLegacyIdle,
            confirmedRecoveryDevice, path} = this.state;
        const t = key => newAiText(key, locale);
        const firmware = device.firmware;
        const active = starting || Boolean(firmware && firmware.active);
        const request = this.request();
        const blockers = newAiFirmwareBlockers(device, report, request);
        const ports = (device.discovery && device.discovery.ports) || [];
        return (<section className={styles.firmwareSection}>
            <button
                type="button"
                id="new-ai-firmware-toggle"
                className={styles.command}
                aria-expanded={open}
                aria-controls="new-ai-firmware-panel"
                onClick={() => this.setState({open: !open}, () => {
                    if (!open) this.inspect();
                })}
            >{t('firmwareUpdate')}</button>
            {open ? <div
                id="new-ai-firmware-panel"
                aria-busy={checking}
            >
                <p className={styles.firmwareNotice}>{t('firmwareErase')}</p>
                {report ? <React.Fragment>
                    <dl className={styles.summary}>
                        <div><dt>{t('firmwareVersion')}</dt><dd>{report.version}</dd></div>
                        <div><dt>{t('firmwareSource')}</dt><dd>{report.source}</dd></div>
                    </dl>
                    <p role="status">{t(report.valid ? 'firmwarePassed' : 'NEW_FW_RESOURCE_INVALID')}</p>
                    <details>
                        <summary>{t('firmwareResources')} ({report.files.length})</summary>
                        <div className={layout.files}>
                            <table className={styles.firmwareFiles}>
                                <tbody>{report.files.map(file => (<tr key={file.path}>
                                    <th scope="row">{file.path}</th>
                                    <td>{file.bytes.toLocaleString(locale)} B</td>
                                    <td>{t(file.valid ? 'firmwarePassed' : file.error)}</td>
                                </tr>))}</tbody>
                            </table>
                        </div>
                    </details>
                </React.Fragment> : null}
                {error ? <p
                    className={styles.error}
                    role="alert"
                >{newAiErrorText(error, locale)}</p> : null}
                {firmware && firmware.phase !== 'idle' ? <div
                    className={styles.firmwareProgress}
                    role="status"
                >
                    <strong>{t(`fw.${firmware.phase}`)}</strong>
                    {firmware.active && firmware.total > 0 ? <progress
                        max={firmware.total}
                        value={firmware.bytes}
                    /> : null}
                    {firmware.file ? <span>
                        {firmware.file} · {Math.floor(100 * firmware.bytes / firmware.total)}%
                    </span> : null}
                    {firmware.result ? <span>{firmware.result.version}</span> : null}
                    {firmware.error && !error ? <span>{newAiErrorText(firmware.error, locale)}</span> : null}
                </div> : null}
                {!device.connected && !active ? <div className={styles.firmwareRecovery}>
                    <label><input
                        id="new-ai-firmware-recovery"
                        type="checkbox"
                        checked={request.recovery}
                        onChange={event => this.setState({recovery: event.target.checked,
                            confirmedErase: false,
                            confirmedRecoveryDevice: false,
                            path: ports.length === 1 ? ports[0].path : path})}
                    />{t('firmwareRecovery')}</label>
                    {request.recovery ? <React.Fragment>
                        <p>{t('firmwareRecoveryHelp')}</p>
                        <select
                            id="new-ai-firmware-recovery-port"
                            value={path}
                            aria-label={t('usb')}
                            onChange={event => this.setState({path: event.target.value,
                                confirmedErase: false,
                                confirmedRecoveryDevice: false})}
                        >
                            <option value="">{t('NEW_FW_SELECT_PORT')}</option>
                            {ports.map(port => (<option
                                key={port.path}
                                value={port.path}
                            >{port.path}</option>))}
                        </select>
                        <label className={styles.firmwareConfirm}><input
                            id="new-ai-firmware-confirm-device"
                            type="checkbox"
                            checked={confirmedRecoveryDevice}
                            onChange={event => this.setState({confirmedRecoveryDevice: event.target.checked})}
                        />{t('firmwareConfirmDevice')}</label>
                    </React.Fragment> : null}
                </div> : null}
                {device.connected && device.status && device.status.legacyProtocol ?
                    <label className={styles.firmwareConfirm}>
                        <input
                            id="new-ai-firmware-legacy-idle"
                            type="checkbox"
                            disabled={active}
                            checked={confirmedLegacyIdle}
                            onChange={event => this.setState({confirmedLegacyIdle: event.target.checked})}
                        />{t('legacyIdleConfirm')}
                    </label> : null}
                <ul
                    id="new-ai-firmware-blockers"
                    className={styles.firmwareBlockers}
                >
                    {active ? null : blockers.map(code => <li key={code}>{t(code)}</li>)}
                </ul>
                <label className={styles.firmwareConfirm}><input
                    id="new-ai-firmware-confirm"
                    type="checkbox"
                    checked={confirmedErase}
                    disabled={active}
                    onChange={event => this.setState({confirmedErase: event.target.checked})}
                />{t('firmwareEraseConfirm')}</label>
                <div className={styles.firmwareActions}>
                    <button
                        type="button"
                        id="new-ai-firmware-check"
                        className={styles.command}
                        disabled={checking || active}
                        onClick={() => this.inspect()}
                    >{t(checking ? 'firmwareChecking' : 'firmwareCheck')}</button>
                    <button
                        type="button"
                        id="new-ai-firmware-start"
                        className={styles.command}
                        disabled={checking || active || !confirmedErase || blockers.length > 0}
                        aria-describedby="new-ai-firmware-blockers"
                        onClick={() => this.start()}
                    >{t('firmwareStart')}</button>
                </div>
            </div> : null}
        </section>);
    }
}
NewAiFirmwarePanel.propTypes = {locale: PropTypes.string.isRequired,
    device: PropTypes.shape({
        busy: PropTypes.bool,
        connected: PropTypes.bool,
        port: PropTypes.string,
        firmware: PropTypes.shape({active: PropTypes.bool,
            phase: PropTypes.string,
            total: PropTypes.number,
            bytes: PropTypes.number,
            file: PropTypes.string,
            error: PropTypes.string,
            result: PropTypes.shape({version: PropTypes.number})}),
        status: PropTypes.shape({legacyProtocol: PropTypes.bool}),
        discovery: PropTypes.shape({ports: PropTypes.arrayOf(PropTypes.shape({path: PropTypes.string}))})
    }).isRequired};
