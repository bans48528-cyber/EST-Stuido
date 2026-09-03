import displayBlockIcon from './est-display-icon.svg';
import displayImageThumbnails from './display-image-thumbnails';
import driveBlockIcon from './est-drive-icon.svg';
import eventHatBlockIcon from './est-event-hat-icon.svg';
import eventHostBlockIcon from './est-event-host-icon.svg';
import motorBlockIcon from './est-motor-icon.svg';
import motorBlockIconCentered from './est-motor-icon-centered.svg';
import musicBlockIcon from './est-music-icon.svg';
import sensorButtonBlockIcon from './est-sensor-button-icon.svg';
import sensorButtonBlockIconCentered from './est-sensor-button-icon-centered.svg';
import sensorColorBlockIcon from './est-sensor-color-icon.svg';
import sensorColorBlockIconCentered from './est-sensor-color-icon-centered.svg';
import sensorGyroBlockIcon from './est-sensor-gyro-icon.svg';
import sensorGyroBlockIconCentered from './est-sensor-gyro-icon-centered.svg';
import sensorHostBlockIcon from './est-sensor-host-icon.svg';
import sensorHostBlockIconCentered from './est-sensor-host-icon-centered.svg';
import sensorIrBlockIcon from './est-sensor-ir-icon.svg';
import sensorIrBlockIconCentered from './est-sensor-ir-icon-centered.svg';
import sensorTemperatureBlockIcon from './est-sensor-temperature-icon.svg';
import sensorTemperatureBlockIconCentered from './est-sensor-temperature-icon-centered.svg';
import sensorUltrasonicBlockIcon from './est-sensor-ultrasonic-icon.svg';
import sensorUltrasonicBlockIconCentered from './est-sensor-ultrasonic-icon-centered.svg';
import steeringArrowIcon from './steering-arrow.svg';
import workspaceRedoIcon from './workspace-redo.svg';
import workspaceUndoIcon from './workspace-undo.svg';
import {
    EST_DEFAULT_LOCALE,
    EST_LOCALE_CHANGED_EVENT,
    formatEstSteeringDisplayText,
    getCurrentEstLocale,
    getEstImageOptions,
    getEstLocalizedOptions,
    getEstSoundOptions,
    getEstText
} from '../est-i18n';

const CATEGORY_COLOURS = {
    motor: {primary: '#0090F5', secondary: '#0078CC', tertiary: '#005FA0'},
    movement: {primary: '#fb59ce', secondary: '#d8009b', tertiary: '#a9007a'},
    display: {primary: '#935DF5', secondary: '#691FF0', tertiary: '#4A00D0'},
    sound: {primary: '#BF70E7', secondary: '#A239D8', tertiary: '#763696'},
    event: {primary: '#F5C400', secondary: '#D9B100', tertiary: '#B89A00'},
    control: {primary: '#FFB515', secondary: '#E39B00', tertiary: '#C18401'},
    sensing: {primary: '#1DCCF0', secondary: '#00A8C9', tertiary: '#008AA6'}
};

const CATEGORY_BLOCK_IDS = {
    motor: [
        'motor_run_for',
        'motor_start',
        'motor_stop',
        'motor_set_speed',
        'motor_set_stop_action',
        'motor_run_for_speed',
        'motor_start_speed',
        'motor_start_power',
        'motor_reset_degrees',
        'motor_degrees',
        'motor_speed',
        'motor_stalled'
    ],
    movement: [
        'drive_move_for',
        'drive_steer_for',
        'drive_start_steer',
        'drive_stop',
        'drive_set_speed',
        'drive_set_pair',
        'drive_set_stop_action',
        'drive_steer_for_speed',
        'drive_dual_speed_for',
        'drive_start_steer_speed',
        'drive_start_dual_speed',
        'drive_line_follow_init',
        'drive_line_follow_dual_step'
    ],
    display: [
        'display_image_for',
        'display_image',
        'display_text_line',
        'display_text_xy',
        'display_clear',
        'display_status_light'
    ],
    sound: [
        'sound_play_wait',
        'sound_play',
        'sound_beep_for',
        'sound_beep',
        'sound_stop_all',
        'sound_set_volume'
    ],
    event: [
        'event_program_start',
        'event_brick_button',
        'event_condition',
        'event_broadcast',
        'event_broadcast_wait',
        'event_timer'
    ],
    control: [
        'control_wait_seconds',
        'control_wait_until',
        'control_repeat',
        'control_forever',
        'control_repeat_until',
        'control_if',
        'control_if_else',
        'control_stop_other_stacks',
        'control_stop'
    ],
    sensing: [
        'sensor_brick_button_value',
        'sensor_brick_button_pressed',
        'sensor_wait_brick_button',
        'sensor_color_calibrate_reflection',
        'sensor_color_reset_calibration',
        'sensor_color_reflection',
        'sensor_color_reflection_compare',
        'sensor_color_ambient',
        'sensor_color_ambient_compare',
        'sensor_color_value',
        'sensor_color_is',
        'sensor_wait_color',
        'sensor_temperature',
        'sensor_touch_pressed',
        'sensor_wait_touch',
        'sensor_ultrasonic_distance',
        'sensor_ultrasonic_compare',
        'sensor_wait_ultrasonic',
        'sensor_ir_proximity',
        'sensor_ir_proximity_compare',
        'sensor_wait_ir_proximity',
        'sensor_ir_beacon_heading',
        'sensor_ir_beacon_proximity',
        'sensor_ir_beacon_buttons',
        'sensor_ir_beacon_button_pressed',
        'sensor_wait_ir_beacon_button',
        'sensor_ir_beacon_active',
        'sensor_ir_beacon_active_compare',
        'sensor_gyro_angle',
        'sensor_gyro_rate',
        'sensor_gyro_reset',
        'sensor_gyro_compare',
        'sensor_wait_gyro',
        'sensor_timer',
        'sensor_timer_reset'
    ]
};

const ALL_EST_BLOCK_IDS = Object.values(CATEGORY_BLOCK_IDS).reduce(
    (allIds, categoryIds) => allIds.concat(categoryIds),
    []
);
const EST_REPLACED_OPENBLOCK_BLOCK_IDS = [
    'sound_play',
    'event_broadcast',
    'control_wait_until',
    'control_repeat',
    'control_forever',
    'control_repeat_until',
    'control_if',
    'control_if_else',
    'control_stop'
];
const EST_STEERING_PICKER_ID = 'est_steering_picker';
const EST_STEERING_FIELD_TYPE = 'field_est_steering';
const EST_STEERING_LIMIT = 100;
const EST_MOTOR_PORT_PICKER_ID = 'est_motor_port_picker';
const EST_DRIVE_PORT_PICKER_ID = 'est_drive_port_picker';
const EST_SENSOR_PORT_PICKER_ID = 'est_sensor_port_picker';
const EST_SUPPORT_BLOCK_IDS = [
    EST_STEERING_PICKER_ID,
    EST_MOTOR_PORT_PICKER_ID,
    EST_DRIVE_PORT_PICKER_ID,
    EST_SENSOR_PORT_PICKER_ID
];
const EST_STEERING_DIAL_COLOURS = {
    fill: CATEGORY_COLOURS.movement.secondary,
    stroke: CATEGORY_COLOURS.movement.tertiary,
    detail: '#FFFFFF'
};

const MOTOR_PORT_VALUES = ['A', 'B', 'C', 'D'];
const SENSOR_PORT_VALUES = ['1', '2', '3', '4'];
const MOTOR_DIRECTION_VALUES = ['clockwise', 'counterclockwise'];
const DRIVE_DIRECTION_VALUES = ['forward', 'backward'];
const MOTOR_UNIT_VALUES = ['rotations', 'degrees', 'seconds'];
const MOTOR_STOP_ACTION_VALUES = ['hold', 'float'];
const FONT_VALUES = [
    'regular_black',
    'bold_black',
    'large_black',
    'regular_white',
    'bold_white',
    'large_white'
];
const STATUS_LIGHT_VALUES = ['off', 'red', 'blue'];
const SOUND_VALUES = [
    'Piano/C4', 'Piano/Cs4', 'Piano/D4', 'Piano/Ds4',
    'Piano/E4', 'Piano/F4', 'Piano/Fs4', 'Piano/G4',
    'Piano/Gs4', 'Piano/A4', 'Piano/As4', 'Piano/B4',
    'Piano/C5', 'Piano/Cs5', 'Piano/D5', 'Piano/Ds5',
    'Piano/E5', 'Piano/F5', 'Piano/Fs5', 'Piano/G5',
    'Piano/Gs5', 'Piano/A5', 'Piano/As5', 'Piano/B5',
    'Piano/C6', 'Piano/Cs6', 'Piano/D6', 'Piano/Ds6',
    'Piano/E6', 'Piano/F6', 'Piano/Fs6', 'Piano/G6',
    'Piano/Gs6', 'Piano/A6', 'Piano/As6', 'Piano/B6',
    'Piano/C7'
];
const TOUCH_EVENT_VALUES = ['pressed', 'released'];
const COMPARATOR_VALUES = ['less', 'greater', 'equal'];
const COLOR_VALUES = ['none', 'black', 'blue', 'green', 'yellow', 'red', 'white', 'brown'];
const TEMPERATURE_UNIT_VALUES = ['celsius', 'fahrenheit'];
const BEACON_EVENT_VALUES = [
    'top_left_pressed',
    'bottom_left_pressed',
    'left_released',
    'top_right_pressed',
    'bottom_right_pressed',
    'right_released',
    'active'
];
const BEACON_BUTTON_VALUES = ['none', 'top_left', 'bottom_left', 'top_right', 'bottom_right', 'beacon'];
const FIXED_IR_REMOTE_CHANNEL = '1';
const BEACON_CHANNEL_VALUES = [FIXED_IR_REMOTE_CHANNEL];
const BRICK_BUTTON_VALUES = ['none', 'back', 'left', 'confirm', 'right', 'up', 'down'];
const WAIT_BUTTON_VALUES = ['left', 'confirm', 'right', 'up', 'down'];
const DISTANCE_UNIT_VALUES = ['centimeters', 'inches'];
const BEACON_PROPERTY_VALUES = ['heading', 'proximity'];
const CALIBRATION_VALUES = ['minimum', 'maximum'];
const MESSAGE_VALUES = ['message_1'];
const STOP_SCOPE_VALUES = ['this_stack', 'all'];
const literalOptions = values => values.map(value => [value, value]);
const optionsFor = (group, values, locale) => getEstLocalizedOptions(group, values, locale);
const colorEventOptionsFor = locale => optionsFor('color', COLOR_VALUES, locale).concat([
    [getEstText('option.colorEvent.changed', locale), 'changed']
]);

const MOTOR_PORT_OPTIONS = literalOptions(MOTOR_PORT_VALUES);
const SENSOR_PORT_OPTIONS = literalOptions(SENSOR_PORT_VALUES);
const MOTOR_DIRECTION_OPTIONS = optionsFor('motorDirection', MOTOR_DIRECTION_VALUES, EST_DEFAULT_LOCALE);
const DRIVE_DIRECTION_OPTIONS = optionsFor('driveDirection', DRIVE_DIRECTION_VALUES, EST_DEFAULT_LOCALE);
const MOTOR_UNIT_OPTIONS = optionsFor('motorUnit', MOTOR_UNIT_VALUES, EST_DEFAULT_LOCALE);
const MOTOR_STOP_ACTION_OPTIONS = optionsFor('stopAction', MOTOR_STOP_ACTION_VALUES, EST_DEFAULT_LOCALE);
const DISPLAY_IMAGE_IDS = [
    'Expressions/Big smile',
    'Expressions/Heart large',
    'Expressions/Heart small',
    'Expressions/Mouth 1 open',
    'Expressions/Mouth 1 shut',
    'Expressions/Mouth 2 open',
    'Expressions/Mouth 2 shut',
    'Expressions/Sad',
    'Expressions/Sick',
    'Expressions/Smile',
    'Expressions/Swearing',
    'Expressions/Talking',
    'Expressions/Wink',
    'Expressions/ZZZ',
    'Eyes/Angry',
    'Eyes/Awake',
    'Eyes/Black eye',
    'Eyes/Bottom left',
    'Eyes/Bottom right',
    'Eyes/Crazy 1',
    'Eyes/Crazy 2',
    'Eyes/Disappointed',
    'Eyes/Dizzy',
    'Eyes/Down',
    'Eyes/Evil',
    'Eyes/Hurt',
    'Eyes/Knocked out',
    'Eyes/Love',
    'Eyes/Middle left',
    'Eyes/Middle right',
    'Eyes/Neutral',
    'Eyes/Nuclear',
    'Eyes/Pinch left',
    'Eyes/Pinch middle',
    'Eyes/Pinch right',
    'Eyes/Tear',
    'Eyes/Tired left',
    'Eyes/Tired middle',
    'Eyes/Tired right',
    'Eyes/Toxic',
    'Eyes/Up',
    'Eyes/Winking'
];
const IMAGE_OPTIONS = getEstImageOptions(DISPLAY_IMAGE_IDS);
const DISPLAY_IMAGE_OPTION_IDS_BY_LABEL = new Map(IMAGE_OPTIONS.map(([label, value]) => [label, value]));
const DISPLAY_IMAGE_DROPDOWN_BLOCK_IDS = new Set(['display_image_for', 'display_image']);
const FONT_OPTIONS = optionsFor('font', FONT_VALUES, EST_DEFAULT_LOCALE);
const STATUS_LIGHT_OPTIONS = optionsFor('statusLight', STATUS_LIGHT_VALUES, EST_DEFAULT_LOCALE);
const SOUND_OPTIONS = getEstSoundOptions(SOUND_VALUES, EST_DEFAULT_LOCALE);
const TOUCH_EVENT_OPTIONS = optionsFor('touchEvent', TOUCH_EVENT_VALUES, EST_DEFAULT_LOCALE);
const COMPARATOR_OPTIONS = optionsFor('comparator', COMPARATOR_VALUES, EST_DEFAULT_LOCALE);
const COLOR_OPTIONS = optionsFor('color', COLOR_VALUES, EST_DEFAULT_LOCALE);
const COLOR_EVENT_OPTIONS = colorEventOptionsFor(EST_DEFAULT_LOCALE);
const TEMPERATURE_UNIT_OPTIONS = optionsFor('temperatureUnit', TEMPERATURE_UNIT_VALUES, EST_DEFAULT_LOCALE);
const BEACON_EVENT_OPTIONS = optionsFor('beaconEvent', BEACON_EVENT_VALUES, EST_DEFAULT_LOCALE);
const BEACON_BUTTON_OPTIONS = optionsFor('beaconButton', BEACON_BUTTON_VALUES, EST_DEFAULT_LOCALE);
const BEACON_CHANNEL_OPTIONS = literalOptions(BEACON_CHANNEL_VALUES);
const BRICK_BUTTON_OPTIONS = optionsFor('brickButton', BRICK_BUTTON_VALUES, EST_DEFAULT_LOCALE);
const DISTANCE_UNIT_OPTIONS = optionsFor('distanceUnit', DISTANCE_UNIT_VALUES, EST_DEFAULT_LOCALE);
const BEACON_PROPERTY_OPTIONS = optionsFor('beaconProperty', BEACON_PROPERTY_VALUES, EST_DEFAULT_LOCALE);
const CALIBRATION_OPTIONS = optionsFor('calibration', CALIBRATION_VALUES, EST_DEFAULT_LOCALE);
const MESSAGE_OPTIONS = optionsFor('message', MESSAGE_VALUES, EST_DEFAULT_LOCALE);
const STOP_SCOPE_OPTIONS = optionsFor('stopScope', STOP_SCOPE_VALUES, EST_DEFAULT_LOCALE);
const EST_BLOCK_ICON_SIZE = 38;
const EST_LARGE_BLOCK_ICON_SIZE = 46;
const EST_ICON_DIVIDER_WIDTH = 10;
const EST_ICON_DIVIDER_LENGTH = Number((EST_BLOCK_ICON_SIZE * 0.52 * 1.3).toFixed(2));
const EST_IR_FIXED_CHANNEL_EXTENSION = 'est_ir_fixed_channel';
const EST_IR_CHANNEL_MIGRATION_EVENT = 'est-ir-channel-migrated';
const IR_CHANNEL_BLOCK_IDS = new Set([
    'sensor_ir_beacon_heading',
    'sensor_ir_beacon_proximity',
    'sensor_ir_beacon_buttons',
    'sensor_ir_beacon_button_pressed',
    'sensor_wait_ir_beacon_button',
    'sensor_ir_beacon_active',
    'sensor_ir_beacon_active_compare'
]);
let infraredChannelMigrationNoticeShown = false;
const svgDataUri = source => `data:image/svg+xml;utf8,${encodeURIComponent(source)}`;
const blockIcon = (name, src, altMessageId, options = {}) => ({centered = false} = {}) => {
    const size = options.size || EST_BLOCK_ICON_SIZE;
    const iconSource = centered && options.centeredSrc ? options.centeredSrc : src;
    return {
        type: 'field_image',
        name,
        src: iconSource,
        width: size,
        height: size,
        alt: getEstText(altMessageId),
        flip_rtl: true
    };
};
const iconDivider = (style, height) => {
    const lineTop = Number(((height - EST_ICON_DIVIDER_LENGTH) / 2).toFixed(2));
    const lineBottom = Number((lineTop + EST_ICON_DIVIDER_LENGTH).toFixed(2));
    return {
        type: 'field_image',
        name: 'EST_ICON_DIVIDER',
        src: svgDataUri(
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${EST_ICON_DIVIDER_WIDTH} ${height}">` +
            `<path d="M5 ${lineTop}V${lineBottom}" stroke="${CATEGORY_COLOURS[style].tertiary}" ` +
            'stroke-width="1.2" stroke-linecap="round"/></svg>'
        ),
        width: EST_ICON_DIVIDER_WIDTH,
        height,
        alt: getEstText('icon.divider'),
        flip_rtl: true
    };
};
const motorIcon = blockIcon('EST_MOTOR_ICON', motorBlockIcon, 'icon.motor', {
    centeredSrc: motorBlockIconCentered
});
const driveIcon = blockIcon('EST_DRIVE_ICON', driveBlockIcon, 'icon.drive');
const displayIcon = blockIcon('EST_DISPLAY_ICON', displayBlockIcon, 'icon.display');
const musicIcon = blockIcon('EST_MUSIC_ICON', musicBlockIcon, 'icon.music');
const eventHatIcon = blockIcon('EST_EVENT_HAT_ICON', eventHatBlockIcon, 'icon.event');
const eventHostIcon = blockIcon('EST_EVENT_HOST_ICON', eventHostBlockIcon, 'icon.host');
const sensorHostIcon = blockIcon('EST_SENSOR_HOST_ICON', sensorHostBlockIcon, 'icon.host', {
    centeredSrc: sensorHostBlockIconCentered
});
const sensorButtonIcon = blockIcon('EST_SENSOR_BUTTON_ICON', sensorButtonBlockIcon, 'icon.button', {
    centeredSrc: sensorButtonBlockIconCentered
});
const sensorColorIcon = blockIcon('EST_SENSOR_COLOR_ICON', sensorColorBlockIcon, 'icon.color', {
    centeredSrc: sensorColorBlockIconCentered
});
const sensorTemperatureIcon = blockIcon('EST_SENSOR_TEMPERATURE_ICON', sensorTemperatureBlockIcon, 'icon.temperature', {
    centeredSrc: sensorTemperatureBlockIconCentered
});
const sensorUltrasonicIcon = blockIcon('EST_SENSOR_ULTRASONIC_ICON', sensorUltrasonicBlockIcon, 'icon.ultrasonic', {
    centeredSrc: sensorUltrasonicBlockIconCentered,
    size: EST_LARGE_BLOCK_ICON_SIZE
});
const sensorIrIcon = blockIcon('EST_SENSOR_IR_ICON', sensorIrBlockIcon, 'icon.ir', {
    centeredSrc: sensorIrBlockIconCentered,
    size: EST_LARGE_BLOCK_ICON_SIZE
});
const sensorGyroIcon = blockIcon('EST_SENSOR_GYRO_ICON', sensorGyroBlockIcon, 'icon.gyro', {
    centeredSrc: sensorGyroBlockIconCentered
});
const dropdown = (name, options) => ({type: 'field_dropdown', name, options});
const valueInput = (name, check) => {
    const input = {type: 'input_value', name};
    // OpenBlock variables report String, so EST numeric inputs stay untyped at
    // the connection layer while keeping numeric shadows in the toolbox.
    if (check && check !== 'Number') input.check = check;
    return input;
};
const statementInput = name => ({type: 'input_statement', name});

const categoryForStyle = style => {
    const categories = {
        motor: 'motor',
        movement: 'movement',
        display: 'display',
        sound: 'sounds',
        event: 'events',
        control: 'control',
        sensing: 'sensing'
    };
    return categories[style];
};

const styled = (style, definition) => ({
    ...definition,
    category: categoryForStyle(style),
    colour: CATEGORY_COLOURS[style].primary,
    colourSecondary: CATEGORY_COLOURS[style].secondary,
    colourTertiary: CATEGORY_COLOURS[style].tertiary
});

const command = (style, type, message0, args0 = []) => styled(style, {
    type,
    message0,
    args0,
    inputsInline: true,
    previousStatement: null,
    nextStatement: null
});

const endCommand = (style, type, message0, args0 = []) => styled(style, {
    type,
    message0,
    args0,
    inputsInline: true,
    previousStatement: null
});

const shiftPlaceholders = (message, offset = 1) => (
    message.replace(/%(\d+)/g, (match, index) => `%${Number(index) + offset}`)
);
const withLeadingIcon = (style, message0, args0, iconFactory, iconOptions = {}) => {
    const icon = iconFactory(iconOptions);
    return {
        message0: `%1 %2 ${shiftPlaceholders(message0, 2)}`,
        args0: [icon, iconDivider(style, icon.height)].concat(args0)
    };
};
const commandWithIcon = (style, type, iconFactory, message0, args0 = []) => {
    const definition = withLeadingIcon(style, message0, args0, iconFactory);
    return command(style, type, definition.message0, definition.args0);
};

const reporter = (ScratchBlocks, style, type, message0, args0 = [], output = 'Number') => styled(style, {
    type,
    message0,
    args0,
    inputsInline: true,
    output,
    outputShape: ScratchBlocks.OUTPUT_SHAPE_ROUND
});

const reporterWithIcon = (ScratchBlocks, style, type, iconFactory, message0, args0 = [], output = 'Number') => {
    const definition = withLeadingIcon(style, message0, args0, iconFactory, {centered: true});
    return reporter(ScratchBlocks, style, type, definition.message0, definition.args0, output);
};

const booleanReporter = (ScratchBlocks, style, type, message0, args0 = []) => styled(style, {
    type,
    message0,
    args0,
    inputsInline: true,
    output: 'Boolean',
    outputShape: ScratchBlocks.OUTPUT_SHAPE_HEXAGONAL
});

const booleanReporterWithIcon = (ScratchBlocks, style, type, iconFactory, message0, args0 = []) => {
    const definition = withLeadingIcon(style, message0, args0, iconFactory, {centered: true});
    return booleanReporter(ScratchBlocks, style, type, definition.message0, definition.args0);
};

const hat = (style, type, message0, args0 = []) => styled(style, {
    type,
    message0,
    args0,
    inputsInline: true,
    extensions: ['shape_hat']
});

const hatWithIcon = (style, type, iconFactory, message0, args0 = []) => {
    const definition = withLeadingIcon(style, message0, args0, iconFactory);
    return hat(style, type, definition.message0, definition.args0);
};

const withFixedInfraredChannelMigration = definition => ({
    ...definition,
    extensions: (definition.extensions || []).concat([EST_IR_FIXED_CHANNEL_EXTENSION])
});

const migrateInfraredChannelBlock = block => {
    if (!block || !IR_CHANNEL_BLOCK_IDS.has(block.type) ||
        typeof block.getFieldValue !== 'function' ||
        typeof block.setFieldValue !== 'function') {
        return false;
    }
    const channel = block.getFieldValue('CHANNEL');
    if (channel === null || typeof channel === 'undefined' || String(channel) === FIXED_IR_REMOTE_CHANNEL) {
        return false;
    }
    block.setFieldValue(FIXED_IR_REMOTE_CHANNEL, 'CHANNEL');
    return true;
};

const notifyInfraredChannelMigration = () => {
    if (infraredChannelMigrationNoticeShown || typeof window === 'undefined') {
        return;
    }
    infraredChannelMigrationNoticeShown = true;
    const message = getEstText('migration.irChannelFixed', getCurrentEstLocale());
    if (typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
        window.dispatchEvent(new CustomEvent(EST_IR_CHANNEL_MIGRATION_EVENT, {
            detail: {message}
        }));
    }
    if (typeof window.alert === 'function') {
        window.alert(message);
    }
};

const registerEstInfraredChannelMigrationExtension = ScratchBlocks => {
    if (!ScratchBlocks.Extensions || typeof ScratchBlocks.Extensions.register !== 'function') {
        return;
    }
    const registry = ScratchBlocks.Extensions.ALL_ || ScratchBlocks.Extensions.all_;
    if (registry && Object.prototype.hasOwnProperty.call(registry, EST_IR_FIXED_CHANNEL_EXTENSION)) {
        return;
    }
    ScratchBlocks.Extensions.register(EST_IR_FIXED_CHANNEL_EXTENSION, function () {
        const block = this;
        const migrate = () => {
            if (migrateInfraredChannelBlock(block)) {
                notifyInfraredChannelMigration();
            }
        };
        const originalOnchange = block.onchange;
        block.onchange = function estFixedInfraredChannelOnChange (event) {
            if (typeof originalOnchange === 'function') {
                originalOnchange.call(this, event);
            }
            migrate();
        };
        if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
            window.setTimeout(migrate, 0);
        } else {
            migrate();
        }
    });
};

const clampSteering = value => Math.max(
    -EST_STEERING_LIMIT,
    Math.min(EST_STEERING_LIMIT, value)
);
const isSteeringDialMarkVisible = angle => angle === 0 || angle >= 180;
const formatSteeringDisplayText = (value, locale = getCurrentEstLocale()) => (
    formatEstSteeringDisplayText(clampSteering(Math.round(Number(value) || 0)), locale)
);

const registerEstSteeringField = ScratchBlocks => {
    if (!ScratchBlocks.Field || !ScratchBlocks.FieldAngle || !ScratchBlocks.FieldTextInput) return;

    const EstSteeringField = function (value) {
        ScratchBlocks.FieldAngle.call(this, value);
    };
    EstSteeringField.prototype = Object.create(ScratchBlocks.FieldAngle.prototype);
    EstSteeringField.prototype.constructor = EstSteeringField;
    EstSteeringField.fromJson = options => new EstSteeringField(options.value);

    EstSteeringField.prototype.getDisplayText_ = function () {
        const nbsp = (ScratchBlocks.Field && ScratchBlocks.Field.NBSP) || '\u00A0';
        return formatSteeringDisplayText(this.getText()).replace(/\s/g, nbsp);
    };

    EstSteeringField.prototype.classValidator = function (text) {
        if (text === null) return null;
        const value = Number(text);
        if (!Number.isFinite(value)) return null;
        return String(Math.round(clampSteering(value)));
    };

    const showAngleEditor = ScratchBlocks.FieldAngle.prototype.showEditor_;
    EstSteeringField.prototype.showEditor_ = function () {
        showAngleEditor.call(this);
        const dial = this.gauge_.ownerSVGElement;
        const circle = dial.querySelector('.blocklyAngleCircle');
        const centre = dial.querySelector('.blocklyAngleCenterPoint');
        const handle = dial.querySelector('.blocklyAngleDragHandle');
        const marks = dial.querySelectorAll('.blocklyAngleMarks');
        const lines = dial.querySelectorAll('.blocklyAngleLine');

        circle.style.fill = EST_STEERING_DIAL_COLOURS.fill;
        circle.style.stroke = EST_STEERING_DIAL_COLOURS.stroke;
        this.gauge_.style.fill = EST_STEERING_DIAL_COLOURS.detail;
        centre.style.fill = EST_STEERING_DIAL_COLOURS.detail;
        centre.style.stroke = EST_STEERING_DIAL_COLOURS.detail;
        handle.style.fill = EST_STEERING_DIAL_COLOURS.detail;
        handle.style.stroke = EST_STEERING_DIAL_COLOURS.detail;
        marks.forEach((mark, index) => {
            mark.style.stroke = EST_STEERING_DIAL_COLOURS.detail;
            mark.style.display = isSteeringDialMarkVisible(index * 15) ? '' : 'none';
        });
        lines.forEach(line => {
            line.style.stroke = EST_STEERING_DIAL_COLOURS.detail;
        });
        this.arrowSvg_.setAttributeNS(
            'http://www.w3.org/1999/xlink',
            'xlink:href',
            steeringArrowIcon
        );
    };

    EstSteeringField.prototype.onMouseMove = function (event) {
        event.preventDefault();
        const bounds = this.gauge_.ownerSVGElement.getBoundingClientRect();
        const half = ScratchBlocks.FieldAngle.HALF;
        const deltaX = event.clientX - bounds.left - half;
        const deltaY = event.clientY - bounds.top - half;
        const heading = Math.atan2(deltaX, -deltaY) * (180 / Math.PI);
        const steering = Math.round(clampSteering((heading / 90) * EST_STEERING_LIMIT));
        const validatedSteering = this.callValidator(steering);
        if (validatedSteering === null) return;
        if (ScratchBlocks.FieldTextInput.htmlInput_) {
            ScratchBlocks.FieldTextInput.htmlInput_.value = validatedSteering;
        }
        this.setValue(validatedSteering);
        this.validate_();
        this.resizeEditor_();
    };

    EstSteeringField.prototype.updateGraph_ = function () {
        if (!this.gauge_) return;

        const FieldAngle = ScratchBlocks.FieldAngle;
        const steering = clampSteering(Number(this.getText()) || 0);
        const renderedAngle = steering * 0.9;
        const offsetRadians = Math.PI * FieldAngle.OFFSET / 180;
        let angleRadians = Math.PI * (renderedAngle + FieldAngle.OFFSET) / 180;
        const firstX = Math.cos(offsetRadians) * FieldAngle.RADIUS;
        const firstY = Math.sin(offsetRadians) * -FieldAngle.RADIUS;
        if (FieldAngle.CLOCKWISE) {
            angleRadians = (2 * offsetRadians) - angleRadians;
        }
        const secondX = FieldAngle.HALF + (Math.cos(angleRadians) * FieldAngle.RADIUS);
        const secondY = FieldAngle.HALF - (Math.sin(angleRadians) * FieldAngle.RADIUS);
        const sweepFlag = renderedAngle < 0 ? 0 : 1;
        const path = [
            'M ', FieldAngle.HALF, ',', FieldAngle.HALF,
            ' l ', firstX, ',', firstY,
            ' A ', FieldAngle.RADIUS, ',', FieldAngle.RADIUS,
            ' 0 0 ', sweepFlag, ' ', secondX, ',', secondY, ' z'
        ];
        const imageRotation = renderedAngle + (3 * FieldAngle.OFFSET);

        this.gauge_.setAttribute('d', path.join(''));
        this.line_.setAttribute('x2', secondX);
        this.line_.setAttribute('y2', secondY);
        this.handle_.setAttribute('transform', `translate(${secondX},${secondY})`);
        this.arrowSvg_.setAttribute('transform', `rotate(${imageRotation})`);
    };

    ScratchBlocks.Field.register(EST_STEERING_FIELD_TYPE, EstSteeringField);
};

const makeSteeringPickerDefinition = ScratchBlocks => {
    const colour = (ScratchBlocks.Colours && ScratchBlocks.Colours.textField) || '#FFFFFF';
    return {
        type: EST_STEERING_PICKER_ID,
        message0: '%1',
        args0: [{
            type: EST_STEERING_FIELD_TYPE,
            name: 'NUM',
            value: 0
        }],
        output: 'Number',
        outputShape: ScratchBlocks.OUTPUT_SHAPE_ROUND,
        colour,
        colourSecondary: colour,
        colourTertiary: colour
    };
};

const makeMotorPortPickerDefinition = (ScratchBlocks, style, type) => ({
    ...reporter(ScratchBlocks, style, type, '%1', [
        dropdown('PORT', MOTOR_PORT_OPTIONS)
    ], 'String'),
    colour: CATEGORY_COLOURS[style].secondary,
    colourSecondary: CATEGORY_COLOURS[style].secondary,
    colourTertiary: CATEGORY_COLOURS[style].tertiary
});

const makeSensorPortPickerDefinition = ScratchBlocks => ({
    ...reporter(ScratchBlocks, 'sensing', EST_SENSOR_PORT_PICKER_ID, '%1', [
        dropdown('PORT', SENSOR_PORT_OPTIONS)
    ], 'String'),
    colour: CATEGORY_COLOURS.sensing.secondary,
    colourSecondary: CATEGORY_COLOURS.sensing.secondary,
    colourTertiary: CATEGORY_COLOURS.sensing.tertiary
});

const makeMotorDefinitions = (ScratchBlocks, locale = getCurrentEstLocale()) => {
    const motorDirectionOptions = optionsFor('motorDirection', MOTOR_DIRECTION_VALUES, locale);
    const motorUnitOptions = optionsFor('motorUnit', MOTOR_UNIT_VALUES, locale);
    const stopActionOptions = optionsFor('stopAction', MOTOR_STOP_ACTION_VALUES, locale);
    return [
        commandWithIcon('motor', 'motor_run_for', motorIcon, getEstText('block.motor.runFor', locale), [
            valueInput('PORT'),
            dropdown('DIRECTION', motorDirectionOptions),
            valueInput('AMOUNT', 'Number'),
            dropdown('UNIT', motorUnitOptions)
        ]),
        commandWithIcon('motor', 'motor_start', motorIcon, getEstText('block.motor.start', locale), [
            valueInput('PORT'),
            dropdown('DIRECTION', motorDirectionOptions)
        ]),
        commandWithIcon('motor', 'motor_stop', motorIcon, getEstText('block.motor.stop', locale), [valueInput('PORT')]),
        commandWithIcon('motor', 'motor_set_speed', motorIcon, getEstText('block.motor.setSpeed', locale), [
            valueInput('PORT'),
            valueInput('SPEED', 'Number')
        ]),
        commandWithIcon('motor', 'motor_set_stop_action', motorIcon, getEstText('block.motor.setStopAction', locale), [
            valueInput('PORT'),
            dropdown('STOP_ACTION', stopActionOptions)
        ]),
        commandWithIcon('motor', 'motor_run_for_speed', motorIcon, getEstText('block.motor.runForSpeed', locale), [
            valueInput('PORT'),
            valueInput('SPEED', 'Number'),
            valueInput('AMOUNT', 'Number'),
            dropdown('UNIT', motorUnitOptions)
        ]),
        commandWithIcon('motor', 'motor_start_speed', motorIcon, getEstText('block.motor.startSpeed', locale), [
            valueInput('PORT'),
            valueInput('SPEED', 'Number')
        ]),
        commandWithIcon('motor', 'motor_start_power', motorIcon, getEstText('block.motor.startPower', locale), [
            valueInput('PORT'),
            valueInput('POWER', 'Number')
        ]),
        commandWithIcon('motor', 'motor_reset_degrees', motorIcon, getEstText('block.motor.resetDegrees', locale), [
            valueInput('PORT')
        ]),
        reporterWithIcon(ScratchBlocks, 'motor', 'motor_degrees', motorIcon, getEstText('block.motor.degrees', locale), [
            valueInput('PORT')
        ]),
        reporterWithIcon(ScratchBlocks, 'motor', 'motor_speed', motorIcon, getEstText('block.motor.speed', locale), [
            valueInput('PORT')
        ]),
        booleanReporterWithIcon(ScratchBlocks, 'motor', 'motor_stalled', motorIcon, getEstText('block.motor.stalled', locale), [
            valueInput('PORT')
        ])
    ];
};

const makeMovementDefinitions = (locale = getCurrentEstLocale()) => {
    const driveDirectionOptions = optionsFor('driveDirection', DRIVE_DIRECTION_VALUES, locale);
    const motorUnitOptions = optionsFor('motorUnit', MOTOR_UNIT_VALUES, locale);
    const stopActionOptions = optionsFor('stopAction', MOTOR_STOP_ACTION_VALUES, locale);
    return [
        commandWithIcon('movement', 'drive_move_for', driveIcon, getEstText('block.movement.moveFor', locale), [
            dropdown('DIRECTION', driveDirectionOptions),
            valueInput('AMOUNT', 'Number'),
            dropdown('UNIT', motorUnitOptions)
        ]),
        commandWithIcon('movement', 'drive_steer_for', driveIcon, getEstText('block.movement.steerFor', locale), [
            valueInput('STEERING', 'Number'),
            valueInput('AMOUNT', 'Number'),
            dropdown('UNIT', motorUnitOptions)
        ]),
        commandWithIcon('movement', 'drive_start_steer', driveIcon, getEstText('block.movement.startSteer', locale), [
            valueInput('STEERING', 'Number')
        ]),
        commandWithIcon('movement', 'drive_stop', driveIcon, getEstText('block.movement.stop', locale)),
        commandWithIcon('movement', 'drive_set_speed', driveIcon, getEstText('block.movement.setSpeed', locale), [
            valueInput('SPEED', 'Number')
        ]),
        commandWithIcon('movement', 'drive_set_pair', driveIcon, getEstText('block.movement.setPair', locale), [
            valueInput('LEFT_PORT'),
            valueInput('RIGHT_PORT')
        ]),
        commandWithIcon('movement', 'drive_set_stop_action', driveIcon, getEstText('block.movement.setStopAction', locale), [
            dropdown('STOP_ACTION', stopActionOptions)
        ]),
        commandWithIcon(
            'movement',
            'drive_steer_for_speed',
            driveIcon,
            getEstText('block.movement.steerForSpeed', locale),
            [
                valueInput('SPEED', 'Number'),
                valueInput('STEERING', 'Number'),
                valueInput('AMOUNT', 'Number'),
                dropdown('UNIT', motorUnitOptions)
            ]
        ),
        commandWithIcon(
            'movement',
            'drive_dual_speed_for',
            driveIcon,
            getEstText('block.movement.dualSpeedFor', locale),
            [
                valueInput('LEFT_SPEED', 'Number'),
                valueInput('RIGHT_SPEED', 'Number'),
                valueInput('AMOUNT', 'Number'),
                dropdown('UNIT', motorUnitOptions)
            ]
        ),
        commandWithIcon(
            'movement',
            'drive_start_steer_speed',
            driveIcon,
            getEstText('block.movement.startSteerSpeed', locale),
            [
                valueInput('SPEED', 'Number'),
                valueInput('STEERING', 'Number')
            ]
        ),
        commandWithIcon(
            'movement',
            'drive_start_dual_speed',
            driveIcon,
            getEstText('block.movement.startDualSpeed', locale),
            [
                valueInput('LEFT_SPEED', 'Number'),
                valueInput('RIGHT_SPEED', 'Number')
            ]
        ),
        commandWithIcon(
            'movement',
            'drive_line_follow_init',
            driveIcon,
            getEstText('block.movement.lineFollowInit', locale)
        ),
        commandWithIcon(
            'movement',
            'drive_line_follow_dual_step',
            driveIcon,
            getEstText('block.movement.lineFollowDualStep', locale),
            [
                valueInput('LEFT_INPUT', 'Number'),
                valueInput('RIGHT_INPUT', 'Number'),
                valueInput('LEFT_BASE_POWER', 'Number'),
                valueInput('RIGHT_BASE_POWER', 'Number'),
                valueInput('KP', 'Number'),
                valueInput('KD', 'Number')
            ]
        )
    ];
};

const makeDisplayDefinitions = (locale = getCurrentEstLocale()) => {
    const fontOptions = optionsFor('font', FONT_VALUES, locale);
    const statusLightOptions = optionsFor('statusLight', STATUS_LIGHT_VALUES, locale);
    return [
        commandWithIcon('display', 'display_image_for', displayIcon, getEstText('block.display.imageFor', locale), [
            dropdown('IMAGE', IMAGE_OPTIONS),
            valueInput('SECONDS', 'Number')
        ]),
        commandWithIcon('display', 'display_image', displayIcon, getEstText('block.display.image', locale), [
            dropdown('IMAGE', IMAGE_OPTIONS)
        ]),
        commandWithIcon('display', 'display_text_line', displayIcon, getEstText('block.display.textLine', locale), [
            valueInput('LINE', 'Number'),
            valueInput('TEXT')
        ]),
        commandWithIcon('display', 'display_text_xy', displayIcon, getEstText('block.display.textXY', locale), [
            dropdown('FONT', fontOptions),
            valueInput('X', 'Number'),
            valueInput('Y', 'Number'),
            valueInput('TEXT')
        ]),
        commandWithIcon('display', 'display_clear', displayIcon, getEstText('block.display.clear', locale)),
        commandWithIcon('display', 'display_status_light', displayIcon, getEstText('block.display.statusLight', locale), [
            dropdown('STATUS_MODE', statusLightOptions)
        ])
    ];
};

const makeSoundDefinitions = (locale = getCurrentEstLocale()) => {
    const soundOptions = getEstSoundOptions(SOUND_VALUES, locale);
    return [
        commandWithIcon('sound', 'sound_play_wait', musicIcon, getEstText('block.sound.playWait', locale), [
            dropdown('SOUND', soundOptions)
        ]),
        commandWithIcon('sound', 'sound_play', musicIcon, getEstText('block.sound.play', locale), [
            dropdown('SOUND', soundOptions)
        ]),
        commandWithIcon('sound', 'sound_beep_for', musicIcon, getEstText('block.sound.beepFor', locale), [
            valueInput('NOTE', 'Number'),
            valueInput('SECONDS', 'Number')
        ]),
        commandWithIcon('sound', 'sound_beep', musicIcon, getEstText('block.sound.beep', locale), [
            valueInput('NOTE', 'Number')
        ]),
        commandWithIcon('sound', 'sound_stop_all', musicIcon, getEstText('block.sound.stopAll', locale)),
        commandWithIcon('sound', 'sound_set_volume', musicIcon, getEstText('block.sound.setVolume', locale), [
            valueInput('VOLUME', 'Number')
        ])
    ];
};

const makeEventDefinitions = (locale = getCurrentEstLocale()) => {
    const touchEventOptions = optionsFor('touchEvent', TOUCH_EVENT_VALUES, locale);
    const brickButtonOptions = optionsFor('brickButton', BRICK_BUTTON_VALUES, locale);
    const messageOptions = optionsFor('message', MESSAGE_VALUES, locale);
    return [
        hatWithIcon('event', 'event_program_start', eventHatIcon, getEstText('block.event.programStart', locale)),
        hatWithIcon('event', 'event_brick_button', eventHatIcon, getEstText('block.event.brickButton', locale), [
            dropdown('BUTTON', brickButtonOptions),
            dropdown('BUTTON_EVENT', touchEventOptions)
        ]),
        hatWithIcon('event', 'event_condition', eventHatIcon, getEstText('block.event.condition', locale), [
            valueInput('CONDITION', 'Boolean')
        ]),
        commandWithIcon('event', 'event_broadcast', eventHostIcon, getEstText('block.event.broadcast', locale), [
            dropdown('MESSAGE', messageOptions)
        ]),
        commandWithIcon('event', 'event_broadcast_wait', eventHostIcon, getEstText('block.event.broadcastWait', locale), [
            dropdown('MESSAGE', messageOptions)
        ]),
        hatWithIcon('event', 'event_timer', eventHatIcon, getEstText('block.event.timer', locale), [
            valueInput('SECONDS', 'Number')
        ])
    ];
};

const makeControlDefinitions = (locale = getCurrentEstLocale()) => {
    const stopScopeOptions = optionsFor('stopScope', STOP_SCOPE_VALUES, locale);
    return [
        command('control', 'control_wait_seconds', getEstText('block.control.waitSeconds', locale), [
            valueInput('SECONDS', 'Number')
        ]),
        command('control', 'control_wait_until', getEstText('block.control.waitUntil', locale), [
            valueInput('CONDITION', 'Boolean')
        ]),
        styled('control', {
            type: 'control_repeat',
            message0: getEstText('block.control.repeat', locale),
            args0: [valueInput('TIMES', 'Number')],
            message1: '%1',
            args1: [statementInput('SUBSTACK')],
            previousStatement: null,
            nextStatement: null
        }),
        styled('control', {
            type: 'control_forever',
            message0: getEstText('block.control.forever', locale),
            message1: '%1',
            args1: [statementInput('SUBSTACK')],
            previousStatement: null
        }),
        styled('control', {
            type: 'control_repeat_until',
            message0: getEstText('block.control.repeatUntil', locale),
            args0: [valueInput('CONDITION', 'Boolean')],
            message1: '%1',
            args1: [statementInput('SUBSTACK')],
            previousStatement: null,
            nextStatement: null
        }),
        styled('control', {
            type: 'control_if',
            message0: getEstText('block.control.if', locale),
            args0: [valueInput('CONDITION', 'Boolean')],
            message1: '%1',
            args1: [statementInput('SUBSTACK')],
            previousStatement: null,
            nextStatement: null
        }),
        styled('control', {
            type: 'control_if_else',
            message0: getEstText('block.control.if', locale),
            args0: [valueInput('CONDITION', 'Boolean')],
            message1: '%1',
            args1: [statementInput('SUBSTACK')],
            message2: getEstText('block.control.else', locale),
            message3: '%1',
            args3: [statementInput('SUBSTACK2')],
            previousStatement: null,
            nextStatement: null
        }),
        command('control', 'control_stop_other_stacks', getEstText('block.control.stopOtherStacks', locale)),
        endCommand('control', 'control_stop', getEstText('block.control.stop', locale), [
            dropdown('STOP_SCOPE', stopScopeOptions)
        ])
    ];
};

const makeSensorDefinitions = (ScratchBlocks, locale = getCurrentEstLocale()) => {
    const brickButtonOptions = optionsFor('brickButton', BRICK_BUTTON_VALUES, locale);
    const waitButtonOptions = optionsFor('brickButton', WAIT_BUTTON_VALUES, locale);
    const touchEventOptions = optionsFor('touchEvent', TOUCH_EVENT_VALUES, locale);
    const calibrationOptions = optionsFor('calibration', CALIBRATION_VALUES, locale);
    const comparatorOptions = optionsFor('comparator', COMPARATOR_VALUES, locale);
    const colorOptions = optionsFor('color', COLOR_VALUES, locale);
    const colorEventOptions = colorEventOptionsFor(locale);
    const temperatureUnitOptions = optionsFor('temperatureUnit', TEMPERATURE_UNIT_VALUES, locale);
    const distanceUnitOptions = optionsFor('distanceUnit', DISTANCE_UNIT_VALUES, locale);
    const beaconButtonOptions = optionsFor('beaconButton', BEACON_BUTTON_VALUES, locale);
    const beaconEventOptions = optionsFor('beaconEvent', BEACON_EVENT_VALUES, locale);
    const beaconPropertyOptions = optionsFor('beaconProperty', BEACON_PROPERTY_VALUES, locale);
    return [
        reporterWithIcon(ScratchBlocks, 'sensing', 'sensor_brick_button_value', sensorButtonIcon,
            getEstText('block.sensing.buttonValue', locale)),
        booleanReporterWithIcon(
            ScratchBlocks,
            'sensing',
            'sensor_brick_button_pressed',
            sensorButtonIcon,
            getEstText('block.sensing.buttonPressed', locale),
            [dropdown('BUTTON', brickButtonOptions)]
        ),
        commandWithIcon('sensing', 'sensor_wait_brick_button', sensorButtonIcon,
            getEstText('block.sensing.waitButton', locale), [
                dropdown('BUTTON', waitButtonOptions),
                dropdown('BUTTON_EVENT', touchEventOptions)
            ]),
        commandWithIcon(
            'sensing',
            'sensor_color_calibrate_reflection',
            sensorColorIcon,
            getEstText('block.sensing.calibrateReflection', locale),
            [
                dropdown('CALIBRATION', calibrationOptions),
                valueInput('VALUE', 'Number')
            ]
        ),
        commandWithIcon('sensing', 'sensor_color_reset_calibration', sensorColorIcon,
            getEstText('block.sensing.resetReflectionCalibration', locale)),
        reporterWithIcon(ScratchBlocks, 'sensing', 'sensor_color_reflection', sensorColorIcon,
            getEstText('block.sensing.reflection', locale), [
                valueInput('PORT')
            ]),
        booleanReporterWithIcon(ScratchBlocks, 'sensing', 'sensor_color_reflection_compare', sensorColorIcon,
            getEstText('block.sensing.reflectionCompare', locale), [
                valueInput('PORT'),
                dropdown('COMPARATOR', comparatorOptions),
                valueInput('VALUE', 'Number')
            ]),
        reporterWithIcon(ScratchBlocks, 'sensing', 'sensor_color_ambient', sensorColorIcon,
            getEstText('block.sensing.ambient', locale), [
                valueInput('PORT')
            ]),
        booleanReporterWithIcon(ScratchBlocks, 'sensing', 'sensor_color_ambient_compare', sensorColorIcon,
            getEstText('block.sensing.ambientCompare', locale), [
                valueInput('PORT'),
                dropdown('COMPARATOR', comparatorOptions),
                valueInput('VALUE', 'Number')
            ]),
        reporterWithIcon(ScratchBlocks, 'sensing', 'sensor_color_value', sensorColorIcon,
            getEstText('block.sensing.colorValue', locale), [
                valueInput('PORT')
            ]),
        booleanReporterWithIcon(ScratchBlocks, 'sensing', 'sensor_color_is', sensorColorIcon,
            getEstText('block.sensing.colorIs', locale), [
                valueInput('PORT'),
                dropdown('COLOR', colorOptions)
            ]),
        commandWithIcon('sensing', 'sensor_wait_color', sensorColorIcon,
            getEstText('block.sensing.waitColor', locale), [
                valueInput('PORT'),
                dropdown('COLOR_EVENT', colorEventOptions)
            ]),
        reporterWithIcon(ScratchBlocks, 'sensing', 'sensor_temperature', sensorTemperatureIcon,
            getEstText('block.sensing.temperature', locale), [
                valueInput('PORT'),
                dropdown('UNIT', temperatureUnitOptions)
            ]),
        booleanReporterWithIcon(ScratchBlocks, 'sensing', 'sensor_touch_pressed', sensorButtonIcon,
            getEstText('block.sensing.touchPressed', locale), [
                valueInput('PORT')
            ]),
        commandWithIcon('sensing', 'sensor_wait_touch', sensorButtonIcon,
            getEstText('block.sensing.waitTouch', locale), [
                valueInput('PORT'),
                dropdown('TOUCH_EVENT', touchEventOptions)
            ]),
        reporterWithIcon(
            ScratchBlocks,
            'sensing',
            'sensor_ultrasonic_distance',
            sensorUltrasonicIcon,
            getEstText('block.sensing.ultrasonicDistance', locale),
            [
                valueInput('PORT'),
                dropdown('UNIT', distanceUnitOptions)
            ]
        ),
        booleanReporterWithIcon(
            ScratchBlocks,
            'sensing',
            'sensor_ultrasonic_compare',
            sensorUltrasonicIcon,
            getEstText('block.sensing.ultrasonicCompare', locale),
            [
                valueInput('PORT'),
                dropdown('COMPARATOR', comparatorOptions),
                valueInput('VALUE', 'Number'),
                dropdown('UNIT', distanceUnitOptions)
            ]
        ),
        commandWithIcon('sensing', 'sensor_wait_ultrasonic', sensorUltrasonicIcon,
            getEstText('block.sensing.waitUltrasonic', locale), [
                valueInput('PORT'),
                dropdown('COMPARATOR', comparatorOptions),
                valueInput('VALUE', 'Number'),
                dropdown('UNIT', distanceUnitOptions)
            ]),
        reporterWithIcon(ScratchBlocks, 'sensing', 'sensor_ir_proximity', sensorIrIcon,
            getEstText('block.sensing.irProximity', locale), [
                valueInput('PORT')
            ]),
        booleanReporterWithIcon(ScratchBlocks, 'sensing', 'sensor_ir_proximity_compare', sensorIrIcon,
            getEstText('block.sensing.irProximityCompare', locale), [
                valueInput('PORT'),
                dropdown('COMPARATOR', comparatorOptions),
                valueInput('VALUE', 'Number')
            ]),
        commandWithIcon('sensing', 'sensor_wait_ir_proximity', sensorIrIcon,
            getEstText('block.sensing.waitIrProximity', locale), [
                valueInput('PORT'),
                dropdown('COMPARATOR', comparatorOptions),
                valueInput('VALUE', 'Number')
            ]),
        withFixedInfraredChannelMigration(reporterWithIcon(ScratchBlocks, 'sensing', 'sensor_ir_beacon_heading', sensorIrIcon,
            getEstText('block.sensing.irBeaconHeading', locale), [
                valueInput('PORT'),
                dropdown('CHANNEL', BEACON_CHANNEL_OPTIONS)
            ])),
        withFixedInfraredChannelMigration(reporterWithIcon(ScratchBlocks, 'sensing', 'sensor_ir_beacon_proximity', sensorIrIcon,
            getEstText('block.sensing.irBeaconProximity', locale), [
                valueInput('PORT'),
                dropdown('CHANNEL', BEACON_CHANNEL_OPTIONS)
            ])),
        withFixedInfraredChannelMigration(reporterWithIcon(ScratchBlocks, 'sensing', 'sensor_ir_beacon_buttons', sensorIrIcon,
            getEstText('block.sensing.irBeaconButtons', locale), [
                valueInput('PORT'),
                dropdown('CHANNEL', BEACON_CHANNEL_OPTIONS)
            ])),
        withFixedInfraredChannelMigration(booleanReporterWithIcon(ScratchBlocks, 'sensing', 'sensor_ir_beacon_button_pressed', sensorIrIcon,
            getEstText('block.sensing.irBeaconButtonPressed', locale), [
                valueInput('PORT'),
                dropdown('CHANNEL', BEACON_CHANNEL_OPTIONS),
                dropdown('BEACON_BUTTON', beaconButtonOptions)
            ])),
        withFixedInfraredChannelMigration(commandWithIcon('sensing', 'sensor_wait_ir_beacon_button', sensorIrIcon,
            getEstText('block.sensing.waitIrBeaconButton', locale), [
                valueInput('PORT'),
                dropdown('CHANNEL', BEACON_CHANNEL_OPTIONS),
                dropdown('BEACON_EVENT', beaconEventOptions)
            ])),
        withFixedInfraredChannelMigration(booleanReporterWithIcon(ScratchBlocks, 'sensing', 'sensor_ir_beacon_active', sensorIrIcon,
            getEstText('block.sensing.irBeaconActive', locale), [
                valueInput('PORT'),
                dropdown('CHANNEL', BEACON_CHANNEL_OPTIONS)
            ])),
        withFixedInfraredChannelMigration(booleanReporterWithIcon(ScratchBlocks, 'sensing', 'sensor_ir_beacon_active_compare', sensorIrIcon,
            getEstText('block.sensing.irBeaconActiveCompare', locale), [
                valueInput('PORT'),
                dropdown('CHANNEL', BEACON_CHANNEL_OPTIONS),
                dropdown('PROPERTY', beaconPropertyOptions),
                dropdown('COMPARATOR', comparatorOptions),
                valueInput('VALUE', 'Number')
            ])),
        reporterWithIcon(ScratchBlocks, 'sensing', 'sensor_gyro_angle', sensorGyroIcon,
            getEstText('block.sensing.gyroAngle', locale), [
                valueInput('PORT')
            ]),
        reporterWithIcon(ScratchBlocks, 'sensing', 'sensor_gyro_rate', sensorGyroIcon,
            getEstText('block.sensing.gyroRate', locale), [
                valueInput('PORT')
            ]),
        commandWithIcon('sensing', 'sensor_gyro_reset', sensorGyroIcon,
            getEstText('block.sensing.gyroReset', locale), [valueInput('PORT')]),
        booleanReporterWithIcon(ScratchBlocks, 'sensing', 'sensor_gyro_compare', sensorGyroIcon,
            getEstText('block.sensing.gyroCompare', locale), [
                valueInput('PORT'),
                dropdown('COMPARATOR', comparatorOptions),
                valueInput('VALUE', 'Number')
            ]),
        commandWithIcon('sensing', 'sensor_wait_gyro', sensorGyroIcon,
            getEstText('block.sensing.waitGyro', locale), [
                valueInput('PORT'),
                dropdown('COMPARATOR', comparatorOptions),
                valueInput('VALUE', 'Number')
            ]),
        reporterWithIcon(ScratchBlocks, 'sensing', 'sensor_timer', sensorHostIcon,
            getEstText('block.sensing.timer', locale)),
        commandWithIcon('sensing', 'sensor_timer_reset', sensorHostIcon,
            getEstText('block.sensing.timerReset', locale))
    ];
};

const makeEstBlockDefinitions = (ScratchBlocks, locale = getCurrentEstLocale()) => [
    makeSteeringPickerDefinition(ScratchBlocks),
    makeMotorPortPickerDefinition(ScratchBlocks, 'motor', EST_MOTOR_PORT_PICKER_ID),
    makeMotorPortPickerDefinition(ScratchBlocks, 'movement', EST_DRIVE_PORT_PICKER_ID),
    makeSensorPortPickerDefinition(ScratchBlocks),
    ...makeMotorDefinitions(ScratchBlocks, locale),
    ...makeMovementDefinitions(locale),
    ...makeDisplayDefinitions(locale),
    ...makeSoundDefinitions(locale),
    ...makeEventDefinitions(locale),
    ...makeControlDefinitions(locale),
    ...makeSensorDefinitions(ScratchBlocks, locale)
];

const registeredTargets = new WeakSet();
const registeredLocaleListeners = new WeakSet();
const configuredZoomControlTypes = new WeakSet();
const configuredDisplayImageDropdownTypes = new WeakSet();
const EST_HISTORY_CONTROL_COUNT = 2;
const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink';

const isDisplayImageDropdownField = field => (
    field &&
    field.name === 'IMAGE' &&
    field.sourceBlock_ &&
    DISPLAY_IMAGE_DROPDOWN_BLOCK_IDS.has(field.sourceBlock_.type)
);

const decorateDisplayImageDropdownItems = () => {
    if (typeof document === 'undefined') {
        return;
    }
    const menu = document.querySelector('.blocklyDropDownDiv .blocklyDropdownMenu');
    if (!menu) {
        return;
    }
    menu.classList.add('est-display-image-dropdown-menu');
    const items = menu.querySelectorAll('.goog-menuitem');
    Array.prototype.forEach.call(items, item => {
        if (item.getAttribute('data-est-display-image-thumbnail') === 'true') {
            return;
        }
        const content = item.querySelector('.goog-menuitem-content') || item;
        const label = String(content.textContent || '').trim();
        const imageId = DISPLAY_IMAGE_OPTION_IDS_BY_LABEL.get(label);
        const thumbnail = displayImageThumbnails[imageId];
        if (!thumbnail) {
            return;
        }
        const labelElement = document.createElement('span');
        labelElement.className = 'est-display-image-dropdown-label';
        while (content.firstChild) {
            labelElement.appendChild(content.firstChild);
        }
        const thumbnailElement = document.createElement('img');
        thumbnailElement.className = 'est-display-image-dropdown-thumbnail';
        thumbnailElement.src = thumbnail;
        thumbnailElement.alt = imageId;
        content.appendChild(labelElement);
        content.appendChild(thumbnailElement);
        item.setAttribute('data-est-display-image-thumbnail', 'true');
        item.setAttribute('data-est-display-image-id', imageId);
    });
};

const configureDisplayImageDropdownThumbnails = ScratchBlocks => {
    const FieldDropdown = ScratchBlocks && ScratchBlocks.FieldDropdown;
    if (!FieldDropdown || !FieldDropdown.prototype ||
        typeof FieldDropdown.prototype.showEditor_ !== 'function' ||
        configuredDisplayImageDropdownTypes.has(FieldDropdown)) {
        return;
    }
    const openEditor = FieldDropdown.prototype.showEditor_;
    FieldDropdown.prototype.showEditor_ = function estDisplayImageDropdownShowEditor () {
        const result = openEditor.apply(this, arguments);
        if (isDisplayImageDropdownField(this) && typeof window !== 'undefined') {
            window.setTimeout(decorateDisplayImageDropdownItems, 0);
        }
        return result;
    };
    configuredDisplayImageDropdownTypes.add(FieldDropdown);
};

const createEstHistoryControl = (ScratchBlocks, zoomControls, icon, index, redo, label) => {
    const workspace = zoomControls.workspace_;
    const control = ScratchBlocks.utils.createSvgElement('image', {
        'width': zoomControls.WIDTH_,
        'height': zoomControls.WIDTH_,
        'y': index * (zoomControls.WIDTH_ + zoomControls.MARGIN_BETWEEN_),
        'role': 'button',
        'aria-label': label
    }, zoomControls.svgGroup_);
    control.setAttributeNS(XLINK_NAMESPACE, 'xlink:href', icon);
    ScratchBlocks.bindEventWithChecks_(control, 'mousedown', null, event => {
        workspace.markFocused();
        workspace.undo(redo);
        ScratchBlocks.Touch.clearTouchIdentifier();
        event.stopPropagation();
        event.preventDefault();
    });
};

const configureEstWorkspaceControls = ScratchBlocks => {
    const ZoomControls = ScratchBlocks && ScratchBlocks.ZoomControls;
    if (!ZoomControls || !ZoomControls.prototype ||
        typeof ZoomControls.prototype.createDom !== 'function' ||
        typeof ZoomControls.prototype.position !== 'function' ||
        configuredZoomControlTypes.has(ZoomControls)) {
        return;
    }

    const openBlockCreateDom = ZoomControls.prototype.createDom;
    const openBlockPosition = ZoomControls.prototype.position;
    const historyControlsOffset = EST_HISTORY_CONTROL_COUNT *
        (ZoomControls.prototype.WIDTH_ + ZoomControls.prototype.MARGIN_BETWEEN_);
    ZoomControls.prototype.HEIGHT_ += historyControlsOffset;
    ZoomControls.prototype.createDom = function estCreateWorkspaceControls () {
        const group = openBlockCreateDom.call(this);
        const openBlockControls = group.querySelectorAll('image');
        Array.prototype.forEach.call(openBlockControls, control => {
            const originalY = Number(control.getAttribute('y'));
            control.setAttribute('y', originalY + historyControlsOffset);
        });
        createEstHistoryControl(
            ScratchBlocks,
            this,
            workspaceUndoIcon,
            0,
            false,
            getEstText('history.undo', getCurrentEstLocale())
        );
        createEstHistoryControl(
            ScratchBlocks,
            this,
            workspaceRedoIcon,
            1,
            true,
            getEstText('history.redo', getCurrentEstLocale())
        );
        return group;
    };
    ZoomControls.prototype.position = function estPositionZoomControls () {
        openBlockPosition.call(this);
        const metrics = this.workspace_ && this.workspace_.getMetrics();
        if (!metrics || !this.svgGroup_) {
            return;
        }
        const toolboxHeight = metrics.toolboxPosition === ScratchBlocks.TOOLBOX_AT_BOTTOM ?
            metrics.flyoutHeight : 0;
        const availableHeight = metrics.viewHeight - toolboxHeight;
        this.top_ = metrics.absoluteTop + Math.max(0, (availableHeight - this.HEIGHT_) / 2);
        this.svgGroup_.setAttribute('transform', `translate(${this.left_},${this.top_})`);
    };
    configuredZoomControlTypes.add(ZoomControls);
};

const defineEstBlocksWithLocale = (ScratchBlocks, locale = getCurrentEstLocale()) => {
    const definitions = makeEstBlockDefinitions(ScratchBlocks, locale);
    EST_REPLACED_OPENBLOCK_BLOCK_IDS.forEach(blockId => {
        if (ScratchBlocks.Blocks &&
            Object.prototype.hasOwnProperty.call(ScratchBlocks.Blocks, blockId)) {
            delete ScratchBlocks.Blocks[blockId];
        }
    });
    ScratchBlocks.defineBlocksWithJsonArray(definitions);
};

const refreshEstWorkspaceForLocale = ScratchBlocks => {
    if (!ScratchBlocks || typeof ScratchBlocks.getMainWorkspace !== 'function') {
        return;
    }
    const workspace = ScratchBlocks.getMainWorkspace();
    if (!workspace) {
        return;
    }
    if (typeof workspace.refreshToolboxSelection_ === 'function') {
        workspace.refreshToolboxSelection_();
    }
    if (workspace.rendered && typeof workspace.render === 'function') {
        workspace.render();
    }
    if (typeof ScratchBlocks.svgResize === 'function') {
        ScratchBlocks.svgResize(workspace);
    }
};

const registerEstLocaleListener = ScratchBlocks => {
    if (registeredLocaleListeners.has(ScratchBlocks) ||
        typeof window === 'undefined' ||
        typeof window.addEventListener !== 'function') {
        return;
    }
    window.addEventListener(EST_LOCALE_CHANGED_EVENT, event => {
        const locale = event && event.detail && event.detail.locale;
        defineEstBlocksWithLocale(ScratchBlocks, locale);
        refreshEstWorkspaceForLocale(ScratchBlocks);
    });
    registeredLocaleListeners.add(ScratchBlocks);
};

export const registerEstBlocks = ScratchBlocks => {
    configureEstWorkspaceControls(ScratchBlocks);
    configureDisplayImageDropdownThumbnails(ScratchBlocks);
    if (registeredTargets.has(ScratchBlocks)) return;
    registerEstSteeringField(ScratchBlocks);
    registerEstInfraredChannelMigrationExtension(ScratchBlocks);
    defineEstBlocksWithLocale(ScratchBlocks);
    registerEstLocaleListener(ScratchBlocks);
    registeredTargets.add(ScratchBlocks);
};

const MOTOR_BLOCK_IDS = CATEGORY_BLOCK_IDS.motor;
const DRIVE_BLOCK_IDS = CATEGORY_BLOCK_IDS.movement;
const MOTOR_COLOURS = CATEGORY_COLOURS.motor;
const DRIVE_COLOURS = CATEGORY_COLOURS.movement;

export {
    ALL_EST_BLOCK_IDS,
    CATEGORY_BLOCK_IDS,
    CATEGORY_COLOURS,
    COMPARATOR_OPTIONS,
    DRIVE_BLOCK_IDS,
    DRIVE_COLOURS,
    DRIVE_DIRECTION_OPTIONS,
    EST_STEERING_FIELD_TYPE,
    displayImageThumbnails as DISPLAY_IMAGE_THUMBNAILS,
    EST_STEERING_DIAL_COLOURS,
    EST_STEERING_LIMIT,
    EST_STEERING_PICKER_ID,
    EST_DRIVE_PORT_PICKER_ID,
    EST_IR_CHANNEL_MIGRATION_EVENT,
    EST_IR_FIXED_CHANNEL_EXTENSION,
    FIXED_IR_REMOTE_CHANNEL,
    EST_MOTOR_PORT_PICKER_ID,
    EST_SENSOR_PORT_PICKER_ID,
    EST_REPLACED_OPENBLOCK_BLOCK_IDS,
    EST_SUPPORT_BLOCK_IDS,
    MOTOR_BLOCK_IDS,
    MOTOR_COLOURS,
    MOTOR_DIRECTION_OPTIONS,
    MOTOR_PORT_OPTIONS,
    MOTOR_STOP_ACTION_OPTIONS,
    MOTOR_UNIT_OPTIONS,
    SENSOR_PORT_OPTIONS,
    TEMPERATURE_UNIT_OPTIONS,
    configureEstWorkspaceControls,
    formatSteeringDisplayText,
    isSteeringDialMarkVisible,
    makeEstBlockDefinitions
};
