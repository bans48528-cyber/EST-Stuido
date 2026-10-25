/* eslint-disable react/jsx-no-bind */
import PropTypes from 'prop-types';
import React from 'react';
import {createPortal} from 'react-dom';
import {connect} from 'react-redux';
import {HARDWARE_PROFILES} from '../../common/hardware-profiles';
import {getEstText} from '../est-i18n';
import EstStatusPanel from '../EstStatusPanel.jsx';
import EstHardwareStatusButton from '../EstHardwareStatusButton.jsx';
import SparkConnection from '../spark-ai/SparkConnection.jsx';
import NewAiConnection from '../new-ai/NewAiConnection.jsx';
import {HARDWARE_CHANGED_EVENT, getHardwareContext} from './context';
import {hardwareErrorText, requestHardwareSwitch} from './project';
import deviceIcon from 'openblock-gui/src/components/menu-bar/icon--device.svg';
import styles from './HardwareMenu.css';

const profileStatusKey = item => {
    const readyKeys = {ready: 'ready', 'program-ready': 'programReady', 'download-ready': 'downloadReady'};
    return `hardwareChoice.${readyKeys[item.status] ||
        (item.adapter ? 'connectionReady' : (item.compiler ? 'blocksReady' : 'pending'))}`;
};

class HardwareMenu extends React.Component {
    constructor (props) {
        super(props);
        this.state = {...getHardwareContext(), open: false, selection: getHardwareContext().profile.id,
            submitting: false, error: ''};
        this.dialogRef = React.createRef();
        this.triggerRef = React.createRef();
        this.update = () => this.setState(getHardwareContext());
        this.keydown = this.keydown.bind(this);
    }

    componentDidMount () { window.addEventListener(HARDWARE_CHANGED_EVENT, this.update); }
    componentWillUnmount () {
        this.unmounted = true;
        window.removeEventListener(HARDWARE_CHANGED_EVENT, this.update);
        document.removeEventListener('keydown', this.keydown, true);
    }

    open () {
        if (this.state.busy) return;
        this.setState({open: true, selection: this.state.profile.id, error: ''}, () => {
            document.addEventListener('keydown', this.keydown, true);
            const checked = this.dialogRef.current.querySelector('input:checked');
            if (checked) checked.focus();
        });
    }

    close () {
        if (this.state.submitting) return;
        document.removeEventListener('keydown', this.keydown, true);
        this.setState({open: false}, () => { if (this.triggerRef.current) this.triggerRef.current.focus(); });
    }

    keydown (event) {
        event.stopPropagation();
        if (event.key === 'Escape') { event.preventDefault(); this.close(); }
        if (event.key !== 'Tab' || !this.dialogRef.current) return;
        const items = [...this.dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled)')];
        const index = items.indexOf(document.activeElement);
        if (event.shiftKey && index <= 0) { event.preventDefault(); items[items.length - 1].focus(); }
        else if (!event.shiftKey && index === items.length - 1) { event.preventDefault(); items[0].focus(); }
    }

    async confirm () {
        if (this.state.submitting) return;
        if (this.state.selection === this.state.profile.id) { this.close(); return; }
        this.setState({submitting: true, error: ''});
        try {
            await requestHardwareSwitch(this.state.selection);
            if (!this.unmounted) this.setState({submitting: false}, () => this.close());
        } catch (error) {
            if (!this.unmounted) this.setState({submitting: false,
                error: String(error.message).includes('HARDWARE_CANCELLED') ? '' : hardwareErrorText(error)});
        }
    }

    render () {
        const {locale} = this.props;
        const t = key => getEstText(key, locale);
        const {profile, busy, open, selection, submitting, error} = this.state;
        return (
            <React.Fragment>
                <button
                    id="est-hardware-select" type="button" className={styles.trigger} ref={this.triggerRef}
                    title={t('hardwareChoice.select')} aria-label={`${t('hardwareChoice.select')}: ${profile.name}`}
                    aria-haspopup="dialog" aria-expanded={open} disabled={busy} onClick={() => this.open()}
                >
                    <img src={deviceIcon} alt="" draggable={false} />
                    <span>{profile.name}</span><span className={styles.chevron} aria-hidden="true" />
                </button>
                {!busy && profile.adapter === 'est-hid' ? <React.Fragment>
                    <EstStatusPanel /><EstHardwareStatusButton />
                </React.Fragment> : (!busy && profile.adapter === 'spark-usb' ? <SparkConnection locale={locale} /> :
                    (!busy && profile.adapter === 'new-usb' ? <NewAiConnection locale={locale} /> :
                    <span className={styles.pending} role="status">
                    {t(busy ? 'hardwareChoice.switching' :
                        (profile.compiler ? 'hardwareChoice.blocksReady' : 'hardwareChoice.pending'))}
                    </span>))}
                {open ? createPortal(
                    <div className={styles.backdrop} onMouseDown={event => {
                        if (event.target === event.currentTarget) this.close();
                    }}>
                        <section className={styles.dialog} role="dialog" aria-modal="true"
                            aria-labelledby="hardware-choice-title" ref={this.dialogRef}>
                            <header className={styles.header}>
                                <h2 id="hardware-choice-title">{t('hardwareChoice.select')}</h2>
                                <button className={styles.close} type="button" aria-label={t('hardwareChoice.close')}
                                    disabled={submitting} onClick={() => this.close()}>&times;</button>
                            </header>
                            <div className={styles.products} role="radiogroup" aria-label={t('hardwareChoice.select')}>
                                {HARDWARE_PROFILES.map(item => <label key={item.id}
                                    className={`${styles.product} ${selection === item.id ? styles.selected : ''}`}>
                                    <input type="radio" name="hardware-choice" value={item.id}
                                        checked={selection === item.id} disabled={submitting}
                                        onChange={() => this.setState({selection: item.id})} />
                                    <img src={deviceIcon} className={styles.productIcon} alt="" draggable={false} />
                                    <strong>{item.name}</strong>
                                    <span className={styles.productStatus}>
                                        {t(profileStatusKey(item))}
                                    </span>
                                    {profile.id === item.id ? <span className={styles.current}>
                                        {t('hardwareChoice.current')}
                                    </span> : null}
                                </label>)}
                            </div>
                            {error ? <p className={styles.error} role="alert">{error}</p> : null}
                            <footer className={styles.footer}>
                                {submitting ? <span role="status">{t('hardwareChoice.switching')}</span> : null}
                                <button type="button" disabled={submitting} onClick={() => this.close()}>{t('hardwareChoice.cancel')}</button>
                                <button type="button" className={styles.confirm} disabled={submitting}
                                    onClick={() => this.confirm()}>{t('hardwareChoice.confirm')}</button>
                            </footer>
                        </section>
                    </div>, document.body
                ) : null}
            </React.Fragment>
        );
    }
}
HardwareMenu.propTypes = {locale: PropTypes.string.isRequired};
export {HardwareMenu};
export default connect(state => ({locale: state.locales.locale}))(HardwareMenu);
