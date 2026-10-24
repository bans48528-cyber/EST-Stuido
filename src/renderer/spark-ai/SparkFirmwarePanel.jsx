/* eslint-disable react/jsx-no-bind */
import React from 'react';
import PropTypes from 'prop-types';
import {ipcRenderer} from 'electron';
import {sparkFirmwareBlockers, sparkFirmwareRecoveryPort} from '../../common/spark-firmware';
import {sparkRuntimeText, sparkRuntimeError} from './runtime-messages';
import styles from './SparkRuntime.css';

export default class SparkFirmwarePanel extends React.Component {
    constructor (props) {
        super(props);
        this.state = {open: Boolean(props.device.firmware && props.device.firmware.active),
            checking: false,
            starting: false,
            report: null,
            error: '',
            confirmed: false,
            recovery: false,
            path: ''};
    }
    componentDidMount () {
        if (this.state.open) this.inspect();
    }
    componentWillUnmount () {
        this.unmounted = true;
    }
    async inspect () {
        if (this.inspectPending) return;
        this.inspectPending = true;
        this.setState({checking: true, error: ''});
        try {
            const report = await ipcRenderer.invoke('spark-firmware-inspect');
            if (!this.unmounted) this.setState({report});
        } catch (error) {
            if (!this.unmounted) this.setState({report: null, error});
        } finally {
            this.inspectPending = false;
            if (!this.unmounted) this.setState({checking: false});
        }
    }
    async start () {
        if (this.startPending) return;
        this.startPending = true;
        this.setState({starting: true, error: ''});
        const {report, recovery, path, confirmed} = this.state;
        try {
            await ipcRenderer.invoke('spark-firmware-update', {releaseId: report && report.releaseId,
                confirmedErase: confirmed,
                recovery: recovery && !this.props.device.connected,
                path});
        } catch (error) {
            if (!this.unmounted) this.setState({error});
        } finally {
            this.startPending = false;
            if (!this.unmounted) this.setState({starting: false, confirmed: false});
        }
    }
    render () {
        const {locale, device} = this.props;
        const {open, checking, starting, report, error, confirmed, recovery: requestedRecovery, path} = this.state;
        const recovery = requestedRecovery && !device.connected;
        const t = (id, values) => sparkRuntimeText(id, locale, values);
        const firmware = device.firmware;
        const active = starting || Boolean(firmware && firmware.active);
        const blockers = sparkFirmwareBlockers(device, report, {recovery, path});
        const ports = ((device.discovery && device.discovery.ports) || []).filter(sparkFirmwareRecoveryPort);
        return (<section className={styles.firmwareSection}>
            <button
                type="button"
                id="spark-firmware-toggle"
                className={styles.command}
                aria-expanded={open}
                aria-controls="spark-firmware-panel"
                onClick={() => this.setState({open: !open}, () => {
                    if (!open) this.inspect();
                })}
            >{t('firmwareUpdate')}</button>
            {open ? <div
                id="spark-firmware-panel"
                aria-busy={checking}
            >
                <h3>{t('firmwareResources')}</h3>
                <p className={styles.firmwareNotice}>{t('firmwareEraseNotice')}</p>
                {report ? <React.Fragment>
                    <dl className={styles.summary}>
                        <div><dt>{t('firmwareBundleVersion')}</dt><dd>{report.version}</dd></div>
                        <div><dt>{t('firmwareSource')}</dt><dd>{report.source}</dd></div>
                    </dl>
                    <p role="status">{t(report.valid ? 'firmwareIntegrityPassed' : 'SPARK_FW_RESOURCE_INVALID')}</p>
                    <table className={styles.firmwareFiles}>
                        <thead><tr><th>{t('firmwareFile')}</th><th>{t('firmwareSize')}</th>
                            <th>{t('firmwareCheck')}</th></tr></thead>
                        <tbody>{report.files.map(file => (<tr key={file.path}>
                            <td>{file.path}</td><td>{file.bytes.toLocaleString(locale)} B</td>
                            <td>{t(file.valid ? 'firmwareFilePassed' : file.error)}</td>
                        </tr>))}</tbody>
                    </table>
                </React.Fragment> : null}
                {error ? <p
                    className={styles.error}
                    role="alert"
                >{sparkRuntimeError(error, locale)}</p> : null}
                {firmware && firmware.phase !== 'idle' ? <div
                    className={styles.firmwareProgress}
                    role="status"
                >
                    <strong>{t(`fw.${firmware.phase}`, {version: firmware.result && firmware.result.version})}</strong>
                    {firmware.active && firmware.phase === 'transferring' ? <React.Fragment>
                        <progress
                            max={firmware.total}
                            value={firmware.bytes}
                        />
                        <span>{firmware.file} · {Math.floor(firmware.bytes * 100 / firmware.total)}%</span>
                    </React.Fragment> : null}
                    {firmware.error && !error ? <span>{t(firmware.error)}</span> : null}
                </div> : null}
                {!device.connected && !active ? <div className={styles.firmwareRecovery}>
                    <label><input
                        id="spark-firmware-recovery"
                        type="checkbox"
                        checked={recovery}
                        onChange={event => this.setState({recovery: event.target.checked,
                            confirmed: false,
                            path: ports.length === 1 ? ports[0].path : path})}
                    />{t('firmwareRecovery')}</label>
                    {recovery ? <React.Fragment>
                        <p>{t('firmwareRecoveryHelp')}</p>
                        <select
                            id="spark-firmware-recovery-port"
                            value={path}
                            aria-label={t('serial')}
                            onChange={event => this.setState({path: event.target.value, confirmed: false})}
                        >
                            <option value="">{t('SPARK_FW_SELECT_PORT')}</option>
                            {ports.map(port => (<option
                                key={port.path}
                                value={port.path}
                            >{port.path}</option>))}
                        </select>
                    </React.Fragment> : null}
                </div> : null}
                <ul
                    id="spark-firmware-blockers"
                    className={styles.firmwareBlockers}
                >
                    {active ? null : blockers.map(code => <li key={code}>{t(code)}</li>)}
                </ul>
                <label className={styles.firmwareConfirm}><input
                    id="spark-firmware-confirm"
                    type="checkbox"
                    checked={confirmed}
                    disabled={active}
                    onChange={event => this.setState({confirmed: event.target.checked})}
                />{t('firmwareEraseConfirm')}</label>
                <div className={styles.firmwareActions}>
                    <button
                        type="button"
                        id="spark-firmware-check"
                        className={styles.command}
                        disabled={checking || active}
                        onClick={() => this.inspect()}
                    >{t(checking ? 'firmwareChecking' : 'firmwareRecheck')}</button>
                    <button
                        type="button"
                        id="spark-firmware-start"
                        className={styles.command}
                        disabled={checking || active || !confirmed || blockers.length > 0}
                        aria-describedby="spark-firmware-blockers"
                        onClick={() => this.start()}
                    >{t('firmwareStart')}</button>
                </div>
            </div> : null}
        </section>);
    }
}
SparkFirmwarePanel.propTypes = {
    locale: PropTypes.string.isRequired,
    device: PropTypes.shape({
        connected: PropTypes.bool,
        connectionMode: PropTypes.string,
        compatible: PropTypes.bool,
        busy: PropTypes.bool,
        stale: PropTypes.bool,
        monitoring: PropTypes.bool,
        error: PropTypes.string,
        firmware: PropTypes.shape({active: PropTypes.bool,
            phase: PropTypes.string,
            total: PropTypes.number,
            bytes: PropTypes.number,
            file: PropTypes.string,
            error: PropTypes.string,
            result: PropTypes.shape({version: PropTypes.number})}),
        discovery: PropTypes.shape({status: PropTypes.string, ports: PropTypes.arrayOf(PropTypes.shape({}))}),
        status: PropTypes.shape({version: PropTypes.number, running: PropTypes.bool})
    }).isRequired
};
