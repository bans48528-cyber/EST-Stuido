import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';

import {getEstText} from './est-i18n';
import {EST_VISION_OPEN_EVENT} from './est-vision/menu-events';
import cameraIcon from './camera-fill.svg';
import styles from './EstCodeDrawerToggle.css';
import {withEstHardware} from './hardware/HardwareGate.jsx';

const openCameraPanel = () => window.dispatchEvent(new Event(EST_VISION_OPEN_EVENT));

const EstCameraButton = ({locale}) => {
    const label = getEstText('vision.settings', locale);
    return (
        <button
            id="est-vision-open"
            type="button"
            className={styles.toggleButton}
            title={label}
            aria-label={label}
            onClick={openCameraPanel}
        >
            <img alt="" className={styles.toggleIcon} draggable={false} src={cameraIcon} />
        </button>
    );
};

EstCameraButton.propTypes = {locale: PropTypes.string.isRequired};

export default withEstHardware(connect(state => ({locale: state.locales.locale}))(EstCameraButton));
