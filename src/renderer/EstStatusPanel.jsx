import {ipcRenderer} from 'electron';
import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';

import {
    EST_CONNECTION_STATUS_EVENT,
    EST_LEGACY_PROGRAM_MAX_BYTES,
    EST_PROGRAM_ACTIVITY_EVENT
} from './est-connection-status';
import {getEstText} from './est-i18n';
import styles from './est-status-panel.css';
import {dialog, getCurrentWindow} from '@electron/remote';
import {createFirmwareVersionNotifier} from './hardware/firmware-version-notifier';
import firmwareVersionMessages from './hardware/firmware-version-messages.json';

const INITIAL_REFRESH_DELAY_MS = 1000;
const NORMAL_REFRESH_INTERVAL_MS = 3000;
const RUNNING_REFRESH_INTERVAL_MS = 10000;
const ACTIVE_PROGRAM_STATES = new Set([3, 4]);

const isProgramStatusActive = status => (
    status &&
    status.programStatus &&
    ACTIVE_PROGRAM_STATES.has(Number(status.programStatus.state))
);

class EstStatusPanel extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            isCompatible: false,
            isConnected: false
        };
        this.refreshTimer = null;
        this.refreshInFlight = false;
        this.programRunning = false;
        this.unmounted = false;
        this.notifyVersion = createFirmwareVersionNotifier(({version, locale}) =>
            dialog.showMessageBox(getCurrentWindow(), {type: 'warning',
                title: 'EST',
                message: (firmwareVersionMessages[locale] || firmwareVersionMessages.en)
                    .replace('{device}', 'EST').replace('{version}', String(version))}));
        this.handleProgramActivity = this.handleProgramActivity.bind(this);
        this.handleAutoConnectPause = event => {
            this.autoConnectPaused = Boolean(event.detail);
            this.clearRefreshTimer();
            if (!this.autoConnectPaused) this.scheduleRefresh(0);
        };
    }

    componentDidMount () {
        // Let the main editor paint before opening the native HID handle.
        window.addEventListener(EST_PROGRAM_ACTIVITY_EVENT, this.handleProgramActivity);
        window.addEventListener('est-auto-connect-paused', this.handleAutoConnectPause);
        this.scheduleRefresh(INITIAL_REFRESH_DELAY_MS);
    }

    componentWillUnmount () {
        this.unmounted = true;
        window.removeEventListener(EST_PROGRAM_ACTIVITY_EVENT, this.handleProgramActivity);
        window.removeEventListener('est-auto-connect-paused', this.handleAutoConnectPause);
        this.clearRefreshTimer();
    }

    handleProgramActivity (event) {
        this.programRunning = Boolean(event && event.detail && event.detail.isRunning);
        this.scheduleRefresh(this.programRunning ? RUNNING_REFRESH_INTERVAL_MS : 0);
    }

    clearRefreshTimer () {
        if (!this.refreshTimer) {
            return;
        }
        clearTimeout(this.refreshTimer);
        this.refreshTimer = null;
    }

    scheduleRefresh (delay = (this.programRunning ? RUNNING_REFRESH_INTERVAL_MS : NORMAL_REFRESH_INTERVAL_MS)) {
        this.clearRefreshTimer();
        if (this.unmounted || this.autoConnectPaused) {
            return;
        }
        this.refreshTimer = setTimeout(() => this.refresh(), delay);
    }

    async refresh () {
        if (this.autoConnectPaused) return;
        if (this.refreshInFlight) {
            this.scheduleRefresh();
            return;
        }
        this.refreshInFlight = true;
        try {
            const result = await ipcRenderer.invoke('est-auto-connect', {reuseConnection: true});
            if (this.unmounted || this.autoConnectPaused) return;
            const isConnected = result.state === 'connected';
            const isCompatible = isConnected && result.compatible === true;
            this.notifyVersion({connected: isConnected,
                compatible: isCompatible &&
                !(result.status && result.status.compatibility &&
                    result.status.compatibility.programCompatible === false) && result.programCompatible !== false,
                identity: result.device && result.device.path,
                version: result.firmwareVersion,
                locale: this.props.locale});
            this.programRunning = isProgramStatusActive(result.status);
            this.setState({
                isCompatible,
                isConnected
            });
            const reportedLimit = Number(result.status && result.status.maxProgramBytes);
            const maxProgramBytes = Number.isInteger(reportedLimit) && reportedLimit > 0 ?
                reportedLimit : EST_LEGACY_PROGRAM_MAX_BYTES;
            window.dispatchEvent(new CustomEvent(EST_CONNECTION_STATUS_EVENT, {
                detail: {isCompatible, isConnected, maxProgramBytes}
            }));
        } catch (error) {
            if (this.unmounted || this.autoConnectPaused) return;
            this.programRunning = false;
            this.setState({isCompatible: false, isConnected: false});
            window.dispatchEvent(new CustomEvent(EST_CONNECTION_STATUS_EVENT, {
                detail: {
                    isCompatible: false,
                    isConnected: false,
                    maxProgramBytes: EST_LEGACY_PROGRAM_MAX_BYTES
                }
            }));
        } finally {
            this.refreshInFlight = false;
            this.scheduleRefresh();
        }
    }

    render () {
        if (this.props.hidden) return null;
        const {locale} = this.props;
        const {isCompatible, isConnected} = this.state;
        let statusClass = styles.disconnected;
        let statusText = getEstText('status.disconnected', locale);
        if (isConnected && isCompatible) {
            statusClass = styles.connected;
            statusText = getEstText('status.connected', locale);
        } else if (isConnected) {
            statusClass = styles.upgradeRequired;
            statusText = getEstText('status.upgradeRequired', locale);
        }
        return (
            <div
                className={styles.statusBarItem}
                title={statusText}
                aria-label={statusText}
                role="status"
            >
                <span className={styles.statusText}>{statusText}</span>
                <span
                    aria-hidden="true"
                    className={`${styles.indicator} ${statusClass}`}
                />
            </div>
        );
    }
}

EstStatusPanel.propTypes = {
    locale: PropTypes.string.isRequired,
    hidden: PropTypes.bool
};

const mapStateToProps = state => ({
    locale: state.locales.locale
});

export {EstStatusPanel};

export default connect(mapStateToProps)(EstStatusPanel);
