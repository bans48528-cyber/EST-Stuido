import {newAiText} from './runtime-messages';

const numeric = value => {
    if (typeof value !== 'number' && typeof value !== 'string') return null;
    if (String(value).trim() === '') return null;
    const result = Number(value);
    return Number.isFinite(result) ? result : null;
};
const formats = new Map();
export const newAiNumber = (value, locale) => {
    const number = numeric(value);
    if (number === null) return newAiText('unknown', locale);
    if (!formats.has(locale)) formats.set(locale, new Intl.NumberFormat(locale, {maximumFractionDigits: 2}));
    return formats.get(locale).format(number);
};
export const newAiTelemetryFields = (port, locale) => {
    const t = key => newAiText(key, locale);
    const values = port.values || {};
    const fields = [];
    const add = (label, key, unit = '', choices = null) => {
        if (!Object.prototype.hasOwnProperty.call(values, key)) return;
        const number = choices && typeof values[key] === 'boolean' ? Number(values[key]) : numeric(values[key]);
        const choice = choices && choices[number];
        fields.push({key,
            label: t(label),
            value: choice ? t(choice) :
                `${newAiNumber(values[key], locale)}${number === null ? '' : unit}`});
    };
    if ('Not_Run' in values) return {fields, unavailable: 'dataBusy'};
    if (['big_motor', 'small_motor'].includes(port.type)) {
        add('speed', 'speed'); add('angle', 'angle', '°'); add('revolutions', 'circly');
    } else if (port.type === 'ultrasion') add('distance', 'cm', ' cm');
    else if (port.type === 'touch') add('touchState', 'state', '', {0: 'released', 1: 'pressed'});
    else if (port.type === 'color') {
        ['r', 'g', 'b'].forEach(key => {
            if (Object.prototype.hasOwnProperty.call(values, key)) {
                fields.push({key, label: key.toUpperCase(), value: newAiNumber(values[key], locale)});
            }
        });
        add('brightness', 'lux');
    } else if (['gray', 'gray_v2'].includes(port.type)) {
        const count = port.type === 'gray' ? 4 : 7;
        for (let channel = 1; channel <= count; channel++) {
            const entries = [];
            for (const [prefix, label] of [['', 'value'], ['b', 'sensorState'], ['t', 'threshold']]) {
                const key = `${prefix}${channel}`;
                if (Object.prototype.hasOwnProperty.call(values, key)) {
                    entries.push(`${t(label)} ${newAiNumber(values[key], locale)}`);
                }
            }
            if (entries.length) {
                fields.push({key: `channel${channel}`,
                    label: `${t('channel')} ${channel}`,
                    value: entries.join(' · ')});
            }
        }
    } else if (port.type === 'nfc' && Object.prototype.hasOwnProperty.call(values, 'id')) {
        const valid = (typeof values.id === 'string' && values.id.trim()) ||
            (typeof values.id === 'number' && Number.isFinite(values.id));
        fields.push({key: 'id', label: t('cardId'), value: valid ? String(values.id).slice(0, 120) : t('unknown')});
    } else if (port.type === 'camera') add('cameraMode', 'mode');
    else if (port.type === 'ir_remote') {
        add('infraredState', 'state', '', {0: 'off', 1: 'red', 2: 'green', 3: 'blue'});
    } else if (port.type === 'elect_sensor') {
        add('commandState', 'state', '', {0: 'deenergize', 1: 'energize'});
    }
    add('deviceVersion', 'version');
    add('bundledVersion', 'SoftwareVersion' in values ? 'SoftwareVersion' : 'Softwareversion');
    return {fields, unavailable: fields.length || port.type === 'none' ? null : 'dataUnavailable'};
};

// Only control metadata can rerender the surrounding dialog. Telemetry has its own mounted subscriber.
export const newAiConnectionChanged = (previous, next, open) => {
    if (['state', 'connected', 'stale', 'busy', 'error', 'warning', 'port', 'memoryError',
        'connectionMode', 'reconnecting']
        .some(key => previous[key] !== next[key])) return true;
    if (JSON.stringify(previous.discovery) !== JSON.stringify(next.discovery)) return true;
    if (JSON.stringify(previous.bleDevice) !== JSON.stringify(next.bleDevice)) return true;
    if (open && JSON.stringify(previous.firmware) !== JSON.stringify(next.firmware)) return true;
    const before = previous.status || {}; const after = next.status || {};
    return ['running', 'version', 'legacyProtocol'].some(key => before[key] !== after[key]);
};
