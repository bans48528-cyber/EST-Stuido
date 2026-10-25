import React from 'react';
import PropTypes from 'prop-types';
import {newAiText} from './runtime-messages';
import {newAiNumber, newAiTelemetryFields} from './telemetry';
import styles from '../spark-ai/SparkRuntime.css';
import layout from './NewAiTelemetry.css';

const scalar = PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.bool]);
export default class PortReadings extends React.Component {
    shouldComponentUpdate (next) {
        return next.locale !== this.props.locale || JSON.stringify(next.port) !== JSON.stringify(this.props.port);
    }
    render () {
        const {port, locale} = this.props;
        const t = key => newAiText(key, locale);
        const {fields, unavailable} = newAiTelemetryFields(port, locale);
        const targets = port.type === 'camera' && port.values && Array.isArray(port.values.configs) ?
            port.values.configs : null;
        const count = targets && Number.isInteger(port.values.targetCount) &&
            port.values.targetCount >= targets.length ? port.values.targetCount : (targets ? targets.length : 0);
        return (<div
            className={`${styles.port} ${layout.port}`}
            data-port={port.label}
        >
            <strong>{port.label}</strong>
            <span>{t(port.type)}</span>
            <div className={layout.readings}>
                <dl className={layout.values}>
                    {fields.map(field => (<div
                        key={field.key}
                        data-field={field.key}
                    >
                        <dt>{field.label}</dt><dd>{field.value}</dd>
                    </div>))}
                </dl>
                {unavailable ? <span className={layout.muted}>{t(unavailable)}</span> : null}
                {targets && !('Not_Run' in port.values) ? <div className={layout.targets}>
                    <span>{t('targets')}: {count}
                        {count > targets.length ? ` · ${t('displayedCount')} ${targets.length}` : ''}</span>
                    {targets.length ? targets.map((target, index) => (<div
                        key={index}
                        className={layout.target}
                        data-target={index}
                    >
                        <strong>ID {newAiNumber(target.id, locale)}</strong>
                        {target.name ? <span title={target.name}>{t('targetName')}: {target.name}</span> : null}
                        <span>X {newAiNumber(target.x, locale)} · Y {newAiNumber(target.y, locale)} ·
                            {t('targetWidth')} {newAiNumber(target.w, locale)} ·
                            {t('targetHeight')} {newAiNumber(target.h, locale)}</span>
                        <span>{t('confidence')}: {typeof target.conf === 'number' &&
                            target.conf >= 0 && target.conf <= 100 ? `${newAiNumber(target.conf, locale)}%` :
                            t('unknown')}</span>
                        {target.learned === 1 ? <span>{t('learned')}</span> : null}
                    </div>)) : <span className={layout.muted}>{t('noTargets')}</span>}
                </div> : null}
                {port.type === 'elect_sensor' && fields.length ?
                    <small className={layout.muted}>{t('commandFeedbackHint')}</small> : null}
            </div>
        </div>);
    }
}
PortReadings.propTypes = {locale: PropTypes.string.isRequired,
    port: PropTypes.shape({
        label: PropTypes.string,
        type: PropTypes.string,
        values: PropTypes.shape({targetCount: PropTypes.number,
            configs: PropTypes.arrayOf(
                PropTypes.shape({id: scalar,
                    name: PropTypes.string,
                    x: scalar,
                    y: scalar,
                    w: scalar,
                    h: scalar,
                    conf: scalar,
                    learned: scalar}))})}).isRequired};
