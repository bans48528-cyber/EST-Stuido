import React from 'react';
import PropTypes from 'prop-types';
import {ipcRenderer} from 'electron';
import {MenuItem, MenuSection} from 'openblock-gui/src/components/menu/menu.jsx';
import messages from '../common/input-compatibility-messages.json';
import {normalizeEstLocale} from './est-i18n';
import styles from './EstInputCompatibilityMenu.css';

class EstInputCompatibilityMenu extends React.Component {
    constructor (props) {
        super(props);
        this.state = {status: null, busy: false, error: false};
        this.handleToggle = this.handleToggle.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
    }

    componentDidMount () {
        this.mounted = true;
        ipcRenderer.invoke('est-input-compatibility-get').then(status => {
            if (this.mounted) this.setState({status});
        })
            .catch(() => {});
    }

    componentWillUnmount () {
        this.mounted = false;
    }

    async handleToggle () {
        if (!this.state.status || this.state.busy) return;
        this.setState({busy: true, error: false});
        try {
            const status = await ipcRenderer.invoke('est-input-compatibility-set', {
                enabled: !this.state.status.savedEnabled, locale: this.props.locale, notify: true
            });
            if (this.mounted) this.setState({status, busy: false});
            this.props.onRequestClose();
        } catch (error) {
            if (this.mounted) this.setState({busy: false, error: true});
        }
    }

    handleKeyDown (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        this.handleToggle();
    }

    render () {
        const {status, busy, error} = this.state;
        if (!status || !status.available) return null;
        const copy = messages[normalizeEstLocale(this.props.locale)] || messages.en;
        return (
            <MenuSection>
                <MenuItem onClick={this.handleToggle}>
                    <span
                        className={styles.option}
                        role="menuitemcheckbox"
                        aria-checked={status.savedEnabled}
                        aria-disabled={busy}
                        tabIndex={0}
                        title={copy.hint}
                        onKeyDown={this.handleKeyDown}
                        data-est-input-compatibility
                    >
                        <span aria-hidden="true">{status.savedEnabled ? '✓ ' : '　'}</span>
                        {copy.label}{status.requiresRestart ? ` (${copy.restart})` : ''}
                    </span>
                </MenuItem>
                {error && <li role="alert"><span className={styles.option}>{copy.error}</span></li>}
            </MenuSection>
        );
    }
}

EstInputCompatibilityMenu.propTypes = {
    locale: PropTypes.string.isRequired,
    onRequestClose: PropTypes.func.isRequired
};

export default EstInputCompatibilityMenu;
