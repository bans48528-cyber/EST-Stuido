import React from 'react';
import PropTypes from 'prop-types';
import {EMPTY_NEW_AI_STATE, subscribeNewAiState} from './runtime-client';
import {newAiText} from './runtime-messages';
import {newAiNumber} from './telemetry';
import styles from '../spark-ai/SparkRuntime.css';
import layout from './NewAiTelemetry.css';
import PortReadings from './NewAiPortReadings.jsx';

export default class NewAiTelemetry extends React.PureComponent {
    constructor (props) {
        super(props);
        this.state = {device: props.device || EMPTY_NEW_AI_STATE};
    }
    componentDidMount () {
        this.unsubscribe = subscribeNewAiState(device => {
            const previous = this.state.device;
            if (previous.status !== device.status || previous.connected !== device.connected ||
                previous.stale !== device.stale || previous.port !== device.port ||
                previous.connectionMode !== device.connectionMode || previous.bleDevice !== device.bleDevice) {
                this.setState({device});
            }
        });
    }
    componentWillUnmount () {
        this.unsubscribe();
    }
    render () {
        const {device} = this.state;
        const {locale} = this.props;
        const t = key => newAiText(key, locale);
        const unknown = t('unknown');
        // Stale/disconnected data are cleared, never displayed as live measurements.
        const status = device.connected && !device.stale ? device.status : null;
        const number = (value, unit = '') => {
            const formatted = newAiNumber(value, locale);
            return formatted === unknown ? unknown : `${formatted}${unit}`;
        };
        const flash = status && status.flash;
        const fields = [
            ['version', status ? status.version : unknown],
            [device.connectionMode === 'ble' ? 'bluetooth' : 'usb',
                device.connectionMode === 'ble' ? (device.bleDevice && device.bleDevice.name) || unknown :
                    device.port || unknown],
            ['battery', number(status && status.battery, '%')],
            ['program', status && typeof status.running === 'boolean' ?
                t(status.running ? 'running' : 'stopped') : unknown],
            ['flash', flash ? `${flash.free || unknown} / ${flash.total || unknown}` : unknown],
            ['heap', number(status && status.heap, ' B')],
            ['microphone', number(status && status.sound, ' V')],
            ...['yaw', 'pitch', 'roll'].map(axis => [axis, number(status && status.imu && status.imu[axis], '°')])
        ];
        const ports = status ? status.ports : 'ABCDEFGH'.split('').map(label => ({label, type: 'unknown'}));
        return (<section
            id="new-ai-telemetry"
            aria-label={t('telemetry')}
        >
            <dl className={`${styles.summary} ${layout.summary}`}>
                {fields.map(([key, value]) => (<div
                    key={key}
                    data-metric={key}
                >
                    <dt>{t(key)}</dt><dd>{value}</dd>
                </div>))}
            </dl>
            <div className={layout.heading}>
                <h3>{t('ports')}</h3><span className={layout.muted}>{t('telemetryHint')}</span>
            </div>
            <div
                className={styles.ports}
                aria-label={t('ports')}
            >
                {ports.map(port => (<PortReadings
                    key={port.label}
                    port={port}
                    locale={locale}
                />))}
            </div>
        </section>);
    }
}
NewAiTelemetry.propTypes = {locale: PropTypes.string.isRequired, device: PropTypes.shape({})};
