/* eslint-disable react/jsx-no-bind */
import React from 'react';
import PropTypes from 'prop-types';
import {createPortal} from 'react-dom';
import {ipcRenderer} from 'electron';
import {newAiPeripheralMismatches, newAiPeripheralPromptKey} from '../../common/new-ai-peripherals';
import {NEW_FIRMWARE_VERSION} from '../../common/new-ai-firmware';
import {newAiText, newAiErrorText} from './runtime-messages';
import styles from '../spark-ai/SparkRuntime.css';
import layout from './NewAiPeripheralPanel.css';

export default class NewAiPeripheralPanel extends React.Component {
    constructor (props) {
        super(props);
        this.state = {open: false, starting: false, attempted: false, targets: [], error: null};
        this.prompted = new Set();
        this.panel = React.createRef();
        this.keydown = event => {
            if (!this.state.open) return;
            event.stopPropagation();
            if (event.key === 'Escape') {
                event.preventDefault(); this.close();
            }
            if (event.key !== 'Tab' || !this.panel.current) return;
            const buttons = [...this.panel.current.querySelectorAll('button:not(:disabled)')];
            const index = buttons.indexOf(document.activeElement);
            if (!buttons.length) event.preventDefault();
            else if (event.shiftKey && index <= 0) {
                event.preventDefault(); buttons[buttons.length - 1].focus();
            } else if (!event.shiftKey && (index < 0 || index === buttons.length - 1)) {
                event.preventDefault(); buttons[0].focus();
            }
        };
    }
    componentDidMount () {
        document.addEventListener('keydown', this.keydown, true);
        this.maybePrompt();
    }
    componentDidUpdate (previous, before) {
        if (previous.device.connectionRevision !== this.props.device.connectionRevision) this.prompted.clear();
        this.maybePrompt();
        if (!before.open && this.state.open && this.panel.current) {
            const button = this.panel.current.querySelector('button:not(:disabled)');
            (button || this.panel.current).focus({preventScroll: true});
        }
    }
    componentWillUnmount () {
        this.unmounted = true;
        document.removeEventListener('keydown', this.keydown, true);
    }
    active () {
        const update = this.props.device.peripheralUpdate;
        return this.state.starting || Boolean(update && update.active);
    }
    maybePrompt () {
        const key = newAiPeripheralPromptKey(this.props.device);
        if (!key || this.prompted.has(key) || this.state.open ||
            document.querySelector('#new-ai-firmware-panel')) return;
        this.open();
    }
    open () {
        if (this.state.open) return;
        const device = this.props.device;
        const key = newAiPeripheralPromptKey(device);
        if (key) this.prompted.add(key);
        this.previousFocus = document.activeElement;
        this.setState({open: true,
            starting: false,
            attempted: this.active(),
            error: null,
            targets: newAiPeripheralMismatches(device.status),
            connectionRevision: device.connectionRevision});
        if (this.props.onOpen) this.props.onOpen();
    }
    close () {
        if (this.active()) return;
        const key = newAiPeripheralPromptKey(this.props.device);
        if (key) this.prompted.add(key);
        this.setState({open: false}, () => {
            if (this.previousFocus && this.previousFocus.isConnected) this.previousFocus.focus({preventScroll: true});
        });
    }
    async start () {
        if (this.startPending || this.active() || this.props.device.busy) return;
        this.startPending = true;
        this.setState({starting: true, attempted: true, error: null});
        try {
            await ipcRenderer.invoke('new-ai-peripheral-update', {confirmed: true,
                connectionRevision: this.state.connectionRevision,
                targets: this.state.targets});
        } catch (error) {
            if (!this.unmounted) this.setState({error});
        } finally {
            this.startPending = false;
            if (!this.unmounted) this.setState({starting: false});
        }
    }
    render () {
        if (!this.state.open) return null;
        const {device, locale} = this.props;
        const {targets, attempted, error} = this.state;
        const t = (key, values) => newAiText(key, locale, values);
        const update = attempted ? device.peripheralUpdate : null;
        const active = this.active();
        const complete = !error && !active && update && update.phase === 'complete';
        const failure = error || (update && update.phase === 'error' && update.error);
        const unavailable = device.connected ? (device.stale ? 'NEW_STATUS_STALE' :
            (!device.status || device.status.legacyProtocol || device.status.version !== NEW_FIRMWARE_VERSION ?
                'NEW_VERSION_UNSUPPORTED' : (device.status.running ? 'NEW_RUNNING' : null))) : 'NEW_DISCONNECTED';
        return createPortal(<div className={styles.backdrop}>
            <section
                id="new-ai-peripheral-panel"
                className={styles.firmwareDialog}
                role="dialog"
                aria-modal="true"
                aria-labelledby="new-ai-peripheral-title"
                aria-describedby="new-ai-peripheral-notice"
                aria-busy={active}
                tabIndex={-1}
                ref={this.panel}
            >
                <h2 id="new-ai-peripheral-title">{t('peripheralUpdate')}</h2>
                {attempted ? null : <p>{t(targets.length ? 'peripheralMismatch' : 'peripheralNone')}</p>}
                {targets.length ? <table className={layout.targets}>
                    <thead><tr><th>{t('peripheralDevice')}</th><th>{t('peripheralCurrent')}</th>
                        <th>{t('peripheralTarget')}</th></tr></thead>
                    <tbody>{targets.map(target => (<tr key={target.port}>
                        <td>{target.label} · {t(target.type)}</td>
                        <td>{complete ? target.target : target.current}</td><td>{target.target}</td>
                    </tr>))}</tbody>
                </table> : null}
                <p id="new-ai-peripheral-notice">{targets.length ? t('peripheralNotice') : ''}</p>
                {active || complete ? <p
                    role="status"
                    aria-live="polite"
                >
                    {t(complete ? 'peripheralDone' :
                        (!update || update.phase === 'checking' ? 'peripheralChecking' : 'peripheralUpdating'),
                    {completed: (update && update.completed) || 0, total: targets.length})}
                </p> : null}
                {failure || (!active && unavailable) ? <p
                    className={styles.error}
                    role="alert"
                >
                    {newAiErrorText(failure || unavailable, locale)}</p> : null}
                <div className={styles.firmwareActions}>
                    <button
                        id="new-ai-peripheral-close"
                        className={styles.command}
                        type="button"
                        disabled={active}
                        onClick={() => this.close()}
                    >{t(attempted || !targets.length ? 'firmwareClose' : 'peripheralLater')}</button>
                    {targets.length && !complete && !attempted ? <button
                        id="new-ai-peripheral-start"
                        type="button"
                        className={`${styles.command} ${styles.firmwarePrimary}`}
                        disabled={active || device.busy || Boolean(unavailable)}
                        onClick={() => this.start()}
                    >{t('peripheralStart')}</button> : null}
                </div>
            </section>
        </div>, document.body);
    }
}
NewAiPeripheralPanel.propTypes = {device: PropTypes.shape({
    connected: PropTypes.bool,
    stale: PropTypes.bool,
    busy: PropTypes.bool,
    connectionRevision: PropTypes.number,
    peripheralUpdate: PropTypes.shape({active: PropTypes.bool,
        phase: PropTypes.string,
        completed: PropTypes.number,
        error: PropTypes.string}),
    status: PropTypes.shape({version: PropTypes.number, legacyProtocol: PropTypes.bool, running: PropTypes.bool})
}).isRequired,
locale: PropTypes.string.isRequired,
onOpen: PropTypes.func};
