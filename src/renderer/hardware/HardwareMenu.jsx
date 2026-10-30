/* eslint-disable react/jsx-no-bind */
import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';
import {getEstText} from '../est-i18n';
import EstStatusPanel from '../EstStatusPanel.jsx';
import EstHardwareStatusButton from '../EstHardwareStatusButton.jsx';
import SparkConnection from '../spark-ai/SparkConnection.jsx';
import NewAiConnection from '../new-ai/NewAiConnection.jsx';
import {HARDWARE_CHANGED_EVENT, getHardwareContext} from './context';
import estImage from './assets/est.png';
import sparkImage from './assets/spark-ai.png';
import newAiImage from './assets/new-ai.png';
import styles from './HardwareMenu.css';

const productImages = Object.freeze({'est': estImage, 'spark-ai': sparkImage, 'new-ai': newAiImage});

class HardwareMenu extends React.Component {
    constructor (props) {
        super(props);
        this.state = getHardwareContext();
        this.update = () => this.setState(getHardwareContext());
    }
    componentDidMount () {
        window.addEventListener(HARDWARE_CHANGED_EVENT, this.update);
    }
    componentWillUnmount () {
        window.removeEventListener(HARDWARE_CHANGED_EVENT, this.update);
    }

    render () {
        const {locale} = this.props;
        const t = key => getEstText(key, locale);
        const {profile, busy} = this.state;
        let connection = (<span
            className={styles.pending}
            role="status"
        >
            {t(busy ? 'hardwareChoice.switching' : 'hardwareChoice.pending')}
        </span>);
        if (!busy) {
            if (profile.adapter === 'est-hid') {
                connection = (<React.Fragment>
                    <EstStatusPanel hidden /><EstHardwareStatusButton />
                </React.Fragment>);
            } else if (profile.adapter === 'spark-usb') connection = <SparkConnection locale={locale} />;
            else if (profile.adapter === 'new-usb') connection = <NewAiConnection locale={locale} />;
        }
        return (
            <React.Fragment>
                <span
                    id="est-hardware-current"
                    className={styles.trigger}
                >
                    <img
                        src={productImages[profile.id]}
                        alt=""
                        draggable={false}
                    />
                    <span>{profile.name}</span>
                </span>
                {connection}

            </React.Fragment>
        );
    }
}
HardwareMenu.propTypes = {locale: PropTypes.string.isRequired};
export {HardwareMenu};
export default connect(state => ({locale: state.locales.locale}))(HardwareMenu);
