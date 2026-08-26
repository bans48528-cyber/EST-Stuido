import {ipcRenderer} from 'electron';
import React from 'react';

import styles from './est-status-panel.css';

class EstStatusPanel extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            isConnected: false
        };
        this.refreshTimer = null;
        this.initialRefreshTimer = null;
        this.refreshInFlight = false;
    }

    componentDidMount () {
        // Let the main editor paint before opening the native HID handle.
        this.initialRefreshTimer = setTimeout(() => this.refresh(), 1000);
        this.refreshTimer = setInterval(() => this.refresh(), 3000);
    }

    componentWillUnmount () {
        if (this.initialRefreshTimer) {
            clearTimeout(this.initialRefreshTimer);
        }
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
        }
    }

    async refresh () {
        if (this.refreshInFlight) {
            return;
        }
        this.refreshInFlight = true;
        try {
            const result = await ipcRenderer.invoke('est-auto-connect');
            this.setState({
                isConnected: result.state === 'connected'
            });
        } catch (error) {
            this.setState({isConnected: false});
        } finally {
            this.refreshInFlight = false;
        }
    }

    render () {
        const statusClass = this.state.isConnected ? styles.connected : styles.disconnected;
        const statusText = this.state.isConnected ? 'EST 已连接' : 'EST 未连接';
        return (
            <div className={styles.statusBarItem}>
                <span>{statusText}</span>
                <span className={`${styles.indicator} ${statusClass}`} />
            </div>
        );
    }
}

export default EstStatusPanel;
