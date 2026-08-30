import {ipcRenderer} from 'electron';
import React from 'react';

import {
    EST_CONNECTION_STATUS_EVENT,
    EST_PROGRAM_ACTIVITY_EVENT
} from './est-connection-status';
import styles from './est-status-panel.css';

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
        this.handleProgramActivity = this.handleProgramActivity.bind(this);
    }

    componentDidMount () {
        // Let the main editor paint before opening the native HID handle.
        window.addEventListener(EST_PROGRAM_ACTIVITY_EVENT, this.handleProgramActivity);
        this.scheduleRefresh(INITIAL_REFRESH_DELAY_MS);
    }

    componentWillUnmount () {
        this.unmounted = true;
        window.removeEventListener(EST_PROGRAM_ACTIVITY_EVENT, this.handleProgramActivity);
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
        if (this.unmounted) {
            return;
        }
        this.refreshTimer = setTimeout(() => this.refresh(), delay);
    }

    async refresh () {
        if (this.refreshInFlight) {
            this.scheduleRefresh();
            return;
        }
        this.refreshInFlight = true;
        try {
            const result = await ipcRenderer.invoke('est-auto-connect');
            const isConnected = result.state === 'connected';
            const isCompatible = isConnected && result.compatible === true;
            this.programRunning = isProgramStatusActive(result.status);
            this.setState({
                isCompatible,
                isConnected
            });
            window.dispatchEvent(new CustomEvent(EST_CONNECTION_STATUS_EVENT, {
                detail: {isCompatible, isConnected}
            }));
        } catch (error) {
            this.programRunning = false;
            this.setState({isCompatible: false, isConnected: false});
            window.dispatchEvent(new CustomEvent(EST_CONNECTION_STATUS_EVENT, {
                detail: {isCompatible: false, isConnected: false}
            }));
        } finally {
            this.refreshInFlight = false;
            this.scheduleRefresh();
        }
    }

    render () {
        const {isCompatible, isConnected} = this.state;
        let statusClass = styles.disconnected;
        let statusText = 'EST 未连接';
        if (isConnected && isCompatible) {
            statusClass = styles.connected;
            statusText = 'EST 已连接';
        } else if (isConnected) {
            statusClass = styles.upgradeRequired;
            statusText = 'EST 需升级';
        }
        return (
            <div className={styles.statusBarItem}>
                <span>{statusText}</span>
                <span className={`${styles.indicator} ${statusClass}`} />
            </div>
        );
    }
}

export default EstStatusPanel;
