import classNames from 'classnames';
import locales from 'openblock-l10n';
import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';

import MenuBarMenu from 'openblock-gui/src/components/menu-bar/menu-bar-menu.jsx';
import {MenuItem} from 'openblock-gui/src/components/menu/menu.jsx';
import {selectLocale} from 'openblock-gui/src/reducers/locales';
import {closeLanguageMenu} from 'openblock-gui/src/reducers/menus';

import {
    getEstLocaleOptions,
    setCurrentEstLocale
} from './est-i18n';
import styles from './EstLanguageMenu.css';

const getLocaleOptions = messagesByLocale => getEstLocaleOptions(messagesByLocale)
    .filter(locale => locales[locale.value] || locale.value === 'pt-br');

class EstLanguageMenu extends React.Component {
    constructor (props) {
        super(props);
        this.handleLocaleClick = this.handleLocaleClick.bind(this);
    }

    componentDidMount () {
        setCurrentEstLocale(this.props.currentLocale, {silent: true});
    }

    componentDidUpdate (prevProps) {
        if (prevProps.currentLocale !== this.props.currentLocale) {
            setCurrentEstLocale(this.props.currentLocale);
        }
    }

    handleLocaleClick (locale) {
        return event => {
            event.stopPropagation();
            setCurrentEstLocale(locale);
            this.props.onChangeLanguage(locale);
        };
    }

    render () {
        const {
            currentLocale,
            isRtl,
            messagesByLocale,
            onChangeLanguage, // eslint-disable-line no-unused-vars
            onRequestClose,
            open
        } = this.props;
        const localeOptions = getLocaleOptions(messagesByLocale);

        return (
            <MenuBarMenu
                className={styles.menuBarMenu}
                menuClassName={styles.languageMenu}
                open={open}
                place={isRtl ? 'left' : 'right'}
                onRequestClose={onRequestClose}
            >
                {localeOptions.map(locale => (
                    <MenuItem
                        className={classNames(
                            styles.languageMenuItem,
                            currentLocale === locale.value && styles.selected
                        )}
                        key={locale.value}
                        onClick={this.handleLocaleClick(locale.value)}
                    >
                        <span className={styles.languageMenuText}>
                            {locale.label}
                        </span>
                    </MenuItem>
                ))}
            </MenuBarMenu>
        );
    }
}

EstLanguageMenu.propTypes = {
    currentLocale: PropTypes.string.isRequired,
    isRtl: PropTypes.bool,
    messagesByLocale: PropTypes.object, // eslint-disable-line react/forbid-prop-types
    onChangeLanguage: PropTypes.func.isRequired,
    onRequestClose: PropTypes.func.isRequired,
    open: PropTypes.bool
};

const mapStateToProps = state => ({
    currentLocale: state.locales.locale,
    isRtl: state.locales.isRtl,
    messagesByLocale: state.locales.messagesByLocale
});

const mapDispatchToProps = dispatch => ({
    onChangeLanguage: locale => {
        dispatch(selectLocale(locale));
        dispatch(closeLanguageMenu());
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(EstLanguageMenu);
