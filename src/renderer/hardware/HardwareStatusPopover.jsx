/* eslint-disable react/jsx-no-bind */
import React from 'react';
import PropTypes from 'prop-types';
import {createPortal} from 'react-dom';
import {subscribeNewAiState} from '../new-ai/runtime-client';
import {subscribeSparkState} from '../spark-ai/runtime-client';
import {hardwarePorts, hardwareReadingState, portWirePath} from './status-model';
import {hardwareStatusText} from './status-messages';
import newAiController from './assets/new-ai-controller.svg';
import sparkController from './assets/spark-ai-controller.svg';
import estController from './assets/est-controller.png';
import styles from './HardwareStatusPopover.css';

const images = {'new-ai': newAiController, 'spark-ai': sparkController, 'est': estController};
const names = {'new-ai': 'NEW AI', 'spark-ai': 'Spark AI', 'est': 'EST'};
const Icon = ({name}) => (<svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
>
    {name === 'close' ? <path d="m6 6 12 12M6 18 18 6" /> :
        (name === 'back' ? <path d="M20 12H4m6-6-6 6 6 6" /> :
            (name === 'more' ? <React.Fragment>
                <circle
                    cx="5"
                    cy="12"
                    r="1"
                /><circle
                    cx="12"
                    cy="12"
                    r="1"
                />
                <circle
                    cx="19"
                    cy="12"
                    r="1"
                />
            </React.Fragment> : (name === 'motor' ? <React.Fragment>
                <rect
                    x="4"
                    y="4"
                    width="16"
                    height="16"
                    rx="5"
                /><circle
                    cx="12"
                    cy="12"
                    r="3"
                />
            </React.Fragment> : <React.Fragment>
                <rect
                    x="3"
                    y="6"
                    width="18"
                    height="12"
                    rx="4"
                />
                <circle
                    cx="8"
                    cy="12"
                    r="2"
                /><circle
                    cx="16"
                    cy="12"
                    r="2"
                />
            </React.Fragment>)))}
</svg>);
Icon.propTypes = {name: PropTypes.string.isRequired};

export default class HardwareStatusPopover extends React.Component {
    constructor (props) {
        super(props);
        this.latestDevice = props.device;
        this.state = {device: props.device,
            view: 'overview',
            selected: null,
            menu: false,
            paused: false,
            paths: [],
            position: null};
        this.root = React.createRef();
        this.stage = React.createRef();
        this.image = React.createRef();
        this.menuButton = React.createRef();
        this.draw = this.draw.bind(this);
        this.resize = () => {
            if (this.state.position) {
                const box = this.root.current.getBoundingClientRect();
                this.setState({position: {
                    left: Math.max(12, Math.min(box.left, innerWidth - box.width - 12)),
                    top: Math.max(12, Math.min(box.top, innerHeight - Math.min(box.height, innerHeight - 24) - 12))
                }});
            }
            this.draw();
        };
        this.keydown = this.keydown.bind(this);
        this.outside = event => {
            const trigger = this.props.triggerRef && this.props.triggerRef.current;
            if (!this.root.current.contains(event.target) && !(trigger && trigger.contains(event.target))) {
                this.props.onClose();
            } else if (this.state.menu && !event.target.closest('[role="menu"]') &&
                !this.menuButton.current.contains(event.target)) {
                this.setState({menu: false});
            }
        };
    }
    componentDidMount () {
        this.observer = new ResizeObserver(this.draw);
        this.observer.observe(this.root.current);
        this.draw();
        const subscribe = this.props.hardwareId === 'new-ai' ? subscribeNewAiState :
            (this.props.hardwareId === 'spark-ai' ? subscribeSparkState : null);
        if (subscribe) {
            this.unsubscribe = subscribe(device => {
                this.latestDevice = device;
                // No renderer polling. Reuse the single existing IPC subscription per adapter.
                this.setState(previous => {
                    if (previous.paused && previous.device.connected === device.connected &&
                    previous.device.stale === device.stale && previous.device.busy === device.busy) return null;
                    return {device};
                });
            });
        }
        document.addEventListener('keydown', this.keydown, true);
        document.addEventListener('mousedown', this.outside);
        window.addEventListener('resize', this.resize);
        this.root.current.querySelector('button').focus({preventScroll: true});
    }
    componentDidUpdate (previous, state) {
        if (previous.hardwareId !== this.props.hardwareId) {
            this.props.onClose();
            return;
        }
        if (state.view !== this.state.view) {
            this.draw();
            const back = this.root.current.querySelector('[data-action="back"]');
            if (back) back.focus({preventScroll: true});
        }
    }
    componentWillUnmount () {
        if (this.unsubscribe) this.unsubscribe();
        this.observer.disconnect();
        document.removeEventListener('keydown', this.keydown, true);
        document.removeEventListener('mousedown', this.outside);
        window.removeEventListener('resize', this.resize);
        this.endDrag();
    }
    keydown (event) {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        if (this.state.menu) this.setState({menu: false}, () => this.menuButton.current.focus());
        else if (this.state.view === 'overview') this.props.onClose();
        else this.setState({view: 'overview'});
    }
    draw () {
        if (!this.stage.current || !this.image.current || !this.image.current.complete) return;
        const stage = this.stage.current.getBoundingClientRect();
        const hub = (this.props.hardwareId === 'est' ? this.image.current.parentElement :
            this.image.current).getBoundingClientRect();
        const paths = [...this.stage.current.querySelectorAll('[data-port]')].map((row, index) =>
            portWirePath(stage, row.getBoundingClientRect(), hub, index,
                this.props.hardwareId === 'est' ? 'vertical' : 'sides'));
        if (JSON.stringify(paths) !== JSON.stringify(this.state.paths)) this.setState({paths});
    }
    startDrag (event) {
        if (event.button !== 0 || event.target.closest('button')) return;
        const box = this.root.current.getBoundingClientRect();
        const x = event.clientX - box.left;
        const y = event.clientY - box.top;
        this.dragMove = move => {
            const bounds = this.root.current.getBoundingClientRect();
            this.setState({position: {
                left: Math.max(12, Math.min(move.clientX - x, innerWidth - bounds.width - 12)),
                top: Math.max(12, Math.min(move.clientY - y, innerHeight - bounds.height - 12))
            }});
        };
        this.dragEnd = () => this.endDrag();
        window.addEventListener('mousemove', this.dragMove);
        window.addEventListener('mouseup', this.dragEnd);
        event.preventDefault();
    }
    endDrag () {
        window.removeEventListener('mousemove', this.dragMove);
        window.removeEventListener('mouseup', this.dragEnd);
    }
    changeView (view) {
        this.setState({view, menu: false});
    }
    resumeReadings () {
        this.setState({paused: false,
            menu: false,
            view: 'overview',
            device: this.props.hardwareId === 'est' ? this.props.device : this.latestDevice});
        if (this.state.device.monitoring === false && this.props.onResume) this.props.onResume();
    }
    renderOverview () {
        const {hardwareId, locale} = this.props;
        const t = key => hardwareStatusText(key, locale);
        const device = hardwareId === 'est' ? this.props.device : this.state.device;
        const ports = hardwarePorts(hardwareId, device, locale, this.state.paused);
        const displayPorts = hardwareId === 'est' ? [...ports.slice(4), ...ports.slice(0, 4)] : ports;
        const selected = ports.find(port => port.label === this.state.selected);
        const row = port => (<button
            key={port.label}
            type="button"
            data-port={port.label}
            className={`${styles.port} ${port.attached ? '' : styles.empty}`}
            title={`${port.label} · ${port.name} · ${port.reading}`}
            aria-label={`${t('port')} ${port.label}, ${port.name}, ${port.reading}`}
            aria-pressed={this.state.selected === port.label}
            onClick={() => this.setState({selected: this.state.selected === port.label ? null : port.label})}
        >
            <span className={styles.portName}>
                <span className={styles.letter}>{port.label}</span>
                {port.colour ? <i
                    className={styles.colourDot}
                    style={{background: port.colour}}
                /> :
                    (port.attached ? <span className={styles.sensorIcon}><Icon name={port.kind} /></span> : null)}
            </span>
            <span className={styles.reading}>{port.reading}</span>
        </button>);
        return (<React.Fragment>
            <div
                className={`${styles.stage} ${hardwareId === 'est' ? styles.estStage : ''}`}
                ref={this.stage}
                aria-label={t('mapping')}
            >
                <svg
                    className={styles.wires}
                    aria-hidden="true"
                    focusable="false"
                >
                    {displayPorts.map((port, index) => (<path
                        key={port.label}
                        data-wire={port.label}
                        data-attached={port.attached}
                        data-selected={port.label === this.state.selected}
                        d={this.state.paths[index] || ''}
                    />))}
                </svg>
                <div className={styles.column}>{displayPorts.slice(0, 4).map(row)}</div>
                <div className={`${styles.hub} ${hardwareId === 'est' ? styles.estHub : ''}`}>
                    <img
                        src={images[hardwareId]}
                        alt={names[hardwareId]}
                        draggable={false}
                        ref={this.image}
                        onLoad={() => this.draw()}
                    />
                </div>
                <div className={styles.column}>{displayPorts.slice(4).map(row)}</div>
            </div>
            {selected ? <section
                className={styles.detail}
                data-port-detail={selected.label}
            >
                <span className={styles.detailLabel}>{selected.label} · {selected.name}</span>
                {selected.colour ? <i
                    className={styles.swatch}
                    style={{background: selected.colour}}
                /> : null}
                <div className={styles.detailValues}>
                    {selected.fields.map(field => (<span
                        key={field.key}
                        data-field={field.key}
                    >
                        <small>{field.label}</small> <strong>{field.value}</strong>
                    </span>))}
                    {selected.note ? <span className={styles.note}>{selected.note}</span> :
                        (selected.fields.length ? null : <span className={styles.note}>
                            {selected.attached ? t('unknown') :
                                (hardwareReadingState(device, this.state.paused) === 'live' ?
                                    t('noPeripheral') : '—')}
                        </span>)}
                </div>
            </section> : null}
        </React.Fragment>);
    }
    render () {
        const {hardwareId, locale, connectionContent, infoContent, onClose, onDisconnect,
            disabled, notice} = this.props;
        const {view, menu, paused, position} = this.state;
        const device = hardwareId === 'est' ? this.props.device : this.state.device;
        const t = key => hardwareStatusText(key, locale);
        const readingState = hardwareReadingState(device, paused);
        const battery = device.connected && !device.stale && device.status &&
            (hardwareId === 'est' ? device.status.batteryPercent : device.status.battery);
        const summary = device.connected ? `${device.connectionMode === 'ble' ? t('bluetooth') : 'USB'}${
            typeof battery === 'number' && battery >= 0 && battery <= 100 ? ` · ${Math.round(battery)}%` : ''}` :
            t('disconnected');
        return createPortal(<aside
            ref={this.root}
            id={`${hardwareId === 'spark-ai' ? 'spark' : hardwareId}-hardware-panel`}
            className={styles.panel}
            role="dialog"
            aria-label={`${names[hardwareId]} · ${t('title')}`}
            style={position ? {left: position.left, top: position.top, right: 'auto'} : null}
        >
            <header
                className={styles.header}
                onMouseDown={event => this.startDrag(event)}
            >
                <h2>{names[hardwareId]}</h2>
                <button
                    type="button"
                    data-action="connection-summary"
                    className={styles.summary}
                    title={t('connection')}
                    onClick={() => this.changeView(view === 'connection' ? 'overview' : 'connection')}
                >{summary}</button>
                <button
                    type="button"
                    ref={this.menuButton}
                    className={styles.iconButton}
                    aria-label={t('more')}
                    aria-haspopup="menu"
                    aria-expanded={menu}
                    data-action="more"
                    onClick={() => this.setState({menu: !menu})}
                    onKeyDown={event => {
                        if (event.key === 'ArrowDown') {
                            event.preventDefault(); this.setState({menu: true}, () =>
                                this.root.current.querySelector('[role="menuitem"]').focus());
                        }
                    }}
                ><Icon name="more" /></button>
                <button
                    type="button"
                    className={styles.iconButton}
                    aria-label={t('close')}
                    data-action="close"
                    onClick={onClose}
                ><Icon name="close" /></button>
            </header>
            {menu ? <div
                className={styles.menu}
                role="menu"
                aria-label={t('more')}
                onKeyDown={event => {
                    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
                    event.preventDefault();
                    const items = [...event.currentTarget.querySelectorAll('button:not(:disabled)')];
                    const index = items.indexOf(document.activeElement);
                    items[event.key === 'Home' ? 0 : (event.key === 'End' ? items.length - 1 :
                        (index + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length)].focus();
                }}
            >
                <button
                    type="button"
                    role="menuitem"
                    data-action="connection"
                    onClick={() => this.changeView('connection')}
                >{t('connection')}</button>
                <button
                    type="button"
                    role="menuitem"
                    data-action="info"
                    onClick={() => this.changeView('info')}
                >{t('info')}</button>
                {onDisconnect ? <button
                    type="button"
                    role="menuitem"
                    data-action="disconnect"
                    disabled={!device.connected || disabled}
                    onClick={() => {
                        this.setState({menu: false}); onDisconnect();
                    }}
                >{t('disconnect')}</button> : null}
            </div> : null}
            <div className={styles.content}>
                {notice ? <div
                    className={styles.notice}
                    role="status"
                >{notice}</div> : null}
                {readingState !== 'live' && readingState !== 'disconnected' ?
                    <div
                        className={styles.notice}
                        role="status"
                    >{t(readingState)}
                        {paused || device.monitoring === false ? <button
                            type="button"
                            onClick={() => this.resumeReadings()}
                        >
                            {t('resume')}</button> : null}
                    </div> : null}
                {view === 'overview' ? this.renderOverview() : <React.Fragment>
                    <button
                        type="button"
                        className={styles.back}
                        data-action="back"
                        onClick={() => this.changeView('overview')}
                    ><Icon name="back" />{t('back')}</button>
                    <div className={styles.legacyContent}>
                        {view === 'connection' ? connectionContent : infoContent}
                    </div>
                </React.Fragment>}
            </div>
        </aside>, document.body);
    }
}
HardwareStatusPopover.propTypes = {
    hardwareId: PropTypes.oneOf(['est', 'spark-ai', 'new-ai']).isRequired,
    device: PropTypes.shape({}).isRequired,
    locale: PropTypes.string.isRequired,
    triggerRef: PropTypes.shape({current: PropTypes.shape({contains: PropTypes.func})}),
    onClose: PropTypes.func.isRequired,
    onDisconnect: PropTypes.func,
    onResume: PropTypes.func,
    disabled: PropTypes.bool,
    notice: PropTypes.node,
    connectionContent: PropTypes.node,
    infoContent: PropTypes.node
};
