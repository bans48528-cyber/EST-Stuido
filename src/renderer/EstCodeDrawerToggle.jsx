import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';

import {
    EST_CODE_DRAWER_REQUEST_STATE_EVENT,
    EST_CODE_DRAWER_STATE_EVENT,
    EST_CODE_DRAWER_TOGGLE_EVENT
} from './est-code-drawer-events';
import {getEstText} from './est-i18n';
import codeIcon from './file-code-fill.svg';
import styles from './EstCodeDrawerToggle.css';

class EstCodeDrawerToggle extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            isOpen: false
        };
        this.handleClick = this.handleClick.bind(this);
        this.handleDrawerState = this.handleDrawerState.bind(this);
    }

    componentDidMount () {
        window.addEventListener(EST_CODE_DRAWER_STATE_EVENT, this.handleDrawerState);
        window.dispatchEvent(new Event(EST_CODE_DRAWER_REQUEST_STATE_EVENT));
    }

    componentWillUnmount () {
        window.removeEventListener(EST_CODE_DRAWER_STATE_EVENT, this.handleDrawerState);
    }

    handleClick () {
        window.dispatchEvent(new Event(EST_CODE_DRAWER_TOGGLE_EVENT));
    }

    handleDrawerState (event) {
        const detail = event && event.detail;
        if (!detail || typeof detail.isOpen !== 'boolean') {
            return;
        }
        this.setState({isOpen: detail.isOpen});
    }

    render () {
        const {locale} = this.props;
        const {isOpen} = this.state;
        const label = getEstText(isOpen ? 'codeDrawer.collapse' : 'codeDrawer.expand', locale);
        return (
            <button
                aria-expanded={isOpen}
                aria-label={label}
                className={classNames(
                    styles.toggleButton,
                    isOpen && styles.toggleButtonOpen
                )}
                title={label}
                type="button"
                onClick={this.handleClick}
            >
                <img
                    alt=""
                    className={styles.toggleIcon}
                    draggable={false}
                    src={codeIcon}
                />
            </button>
        );
    }
}

EstCodeDrawerToggle.propTypes = {
    locale: PropTypes.string.isRequired
};

const mapStateToProps = state => ({
    locale: state.locales.locale
});

export {EstCodeDrawerToggle};

export default connect(mapStateToProps)(EstCodeDrawerToggle);
