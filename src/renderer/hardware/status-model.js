import {newAiTelemetryFields, newAiNumber} from '../new-ai/telemetry';
import {newAiText} from '../new-ai/runtime-messages';
import {sparkRuntimeText} from '../spark-ai/runtime-messages';
import {getEstText} from '../est-i18n';
import {hardwareStatusText} from './status-messages';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const number = (value, locale, unit = '') => (finite(value) ? `${newAiNumber(value, locale)}${unit}` : '—');
const estTypes = {3: 'NXT-sound',
    6: 'EST-temperature',
    16: 'EST/EV3-touch',
    29: 'EST/EV3-color',
    30: 'EST/EV3-ultrasonic',
    32: 'EST/EV3-gyro',
    33: 'EST/EV3-infrared'};
const estColours = [null, '#17191c', '#2055e5', '#20a855', '#e4c520', '#e32d35', '#eeeeee', '#794c2e'];

export const hardwareReadingState = (device, paused = false) => {
    if (!device.connected) return 'disconnected';
    if (device.busy || (device.firmware && device.firmware.active)) return 'busy';
    if (device.stale) return 'stale';
    if (paused || device.monitoring === false) return 'paused';
    return device.status ? 'live' : 'unknown';
};

// A readable output register is not proof that a motor is physically attached.
export const hardwarePorts = (hardwareId, device, locale, paused = false) => {
    const t = key => hardwareStatusText(key, locale);
    const live = hardwareReadingState(device, paused) === 'live';
    const status = live ? device.status : null;
    const labels = hardwareId === 'est' ? '1234ABCD' : 'ABCDEFGH';
    return [...labels].map((label, index) => {
        const result = {label,
            attached: false,
            name: t('unknown'),
            reading: '—',
            fields: [],
            colour: null,
            kind: 'unknown',
            note: null};
        if (hardwareId === 'spark-ai' && index >= 4) {
            return {...result, name: t('motor'), note: t('noFeedback')};
        }
        if (hardwareId === 'est' && index >= 4) {
            const motor = status && (status.motors || [])[index - 4];
            return {...result,
                name: t('motor'),
                kind: 'motor',
                note: t('outputOnly'),
                reading: number(motor && motor.tachoCount, locale, '°'),
                fields: motor ? [
                    {key: 'angle',
                        label: getEstText('hardware.angle', locale),
                        value: number(motor.tachoCount, locale, '°')},
                    {key: 'power',
                        label: getEstText('hardware.power', locale),
                        value: number(motor.powerPercent, locale, '%')}
                ] : []};
        }
        if (!status) return result;
        if (hardwareId === 'est') {
            const sensor = (status.sensors || [])[index];
            if (!sensor) return result;
            const attached = Number(sensor.sensorType) > 0 && Number(sensor.state) > 0;
            const unit = sensor.sensorType === 30 && sensor.mode === 0 ? ' cm' :
                (sensor.sensorType === 32 && sensor.mode === 0 ? '°' : '');
            return {...result,
                attached,
                name: attached ? (estTypes[sensor.sensorType] || t('unknown')) :
                    t('noPeripheral'),
                kind: sensor.sensorType === 29 ? 'colour' : 'sensor',
                reading: attached && sensor.valueValid ? number(sensor.value, locale, unit) : '—',
                colour: attached && sensor.valueValid && sensor.sensorType === 29 && sensor.mode === 2 ?
                    estColours[sensor.value] || null : null,
                fields: attached && sensor.valueValid ? [{key: 'value',
                    label: getEstText('hardware.value', locale),
                    value: number(sensor.value, locale, unit)}] : []};
        }
        const port = (status.ports || []).find(item => item.label === label || item.port === index);
        if (!port) return result;
        const attached = Boolean(port.type && !['none', 'unknown', 'empty'].includes(port.type));
        const local = hardwareId === 'new-ai' ? key => newAiText(key, locale) :
            key => sparkRuntimeText(key, locale);
        if (!attached) return {...result, name: local(port.type || 'unknown')};
        const values = port.values || {};
        let fields;
        if (hardwareId === 'new-ai') {
            const details = newAiTelemetryFields(port, locale);
            fields = details.fields;
            if (details.unavailable) result.note = local(details.unavailable);
        } else {
            fields = Object.entries(values).filter(([, value]) => finite(value))
                .map(([key, value]) => ({
                    key, label: local(key), value: number(value, locale, key === 'cm' ? ' cm' : '')
                }));
        }
        const primary = ['cm', 'angle', 'lux', 'state', 'id', 'mode']
            .map(key => fields.find(field => field.key === key)).find(Boolean) || fields[0];
        const rgb = ['r', 'g', 'b'].map(key => values[key]);
        const colour = port.type === 'color' && hardwareId === 'new-ai' &&
            !('Not_Run' in values) && rgb.every(value => finite(value) && value >= 0 && value <= 255) ?
            `rgb(${rgb.join(',')})` : null;
        return {...result,
            attached,
            name: local(port.type),
            kind: colour ? 'colour' :
                (port.type.includes('motor') ? 'motor' : 'sensor'),
            colour,
            fields,
            reading: primary ? primary.value : '—',
            raw: port};
    });
};

// Geometry alone decides wire paths; status decides colour, never the port's nominal function.
export const portWirePath = (stage, row, hub, index, layout = 'sides') => {
    if (!stage.width || !stage.height || !hub.width || !hub.height) return '';
    const n = value => Number(value.toFixed(2));
    if (layout === 'vertical') {
        const top = index < 4;
        const x = row.left - stage.left + ((row.right - row.left) / 2);
        const y = (top ? row.top + row.height - 2 : row.top + 2) - stage.top;
        const endX = hub.left - stage.left + (hub.width * (0.2 + ((index % 4) * 0.2)));
        const endY = hub.top - stage.top + (hub.height * (top ? 0.03 : 0.97));
        // Outer wires turn nearer the controller; inner wires turn nearer their labels.
        // Keeping these two lanes separate also avoids crossings at the inner label stems.
        const lane = (index % 4 === 0 || index % 4 === 3) ? 0.74 : 0.26;
        const elbow = y + ((endY - y) * lane);
        return `M ${n(x)} ${n(y)} V ${n(elbow)} H ${n(endX)} V ${n(endY)}`;
    }
    const left = index < 4;
    const bodyLeft = hub.left - stage.left + (hub.width * (20 / 256));
    const bodyRight = hub.left - stage.left + (hub.width * (236 / 256));
    const x = (left ? row.right - 2 : row.left + 2) - stage.left;
    const y = row.top - stage.top + (row.height / 2);
    const endX = left ? bodyLeft : bodyRight;
    const endY = hub.top - stage.top + (hub.height * (24 / 400)) +
        (hub.height * (340 / 400) * (0.2 + ((index % 4) * 0.2)));
    const elbow = (x + endX) / 2;
    return `M ${n(x)} ${n(y)} H ${n(elbow)} V ${n(endY)} H ${n(endX)}`;
};
