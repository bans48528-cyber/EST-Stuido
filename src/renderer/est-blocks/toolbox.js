/* eslint-disable max-len -- Compact block declarations keep defaults beside their block IDs. */
import {CATEGORY_COLOURS} from './definitions';

const numberShadow = (name, value) => `
            <value name="${name}">
                <shadow type="math_number">
                    <field name="NUM">${value}</field>
                </shadow>
            </value>`;

const steeringShadow = (name, value) => `
            <value name="${name}">
                <shadow type="est_steering_picker">
                    <field name="NUM">${value}</field>
                </shadow>
            </value>`;

const motorPortShadow = (name, value) => `
            <value name="${name}">
                <shadow type="est_motor_port_picker">
                    <field name="PORT">${value}</field>
                </shadow>
            </value>`;

const drivePortShadow = (name, value) => `
            <value name="${name}">
                <shadow type="est_drive_port_picker">
                    <field name="PORT">${value}</field>
                </shadow>
            </value>`;

const eventSensorPortShadow = (name, value) => `
            <value name="${name}">
                <shadow type="est_event_sensor_port_picker">
                    <field name="PORT">${value}</field>
                </shadow>
            </value>`;

const textShadow = (name, value) => `
            <value name="${name}">
                <shadow type="text">
                    <field name="TEXT">${value}</field>
                </shadow>
            </value>`;

const field = (name, value) => `<field name="${name}">${value}</field>`;
const block = (type, contents = '') => `<block type="${type}">${contents}</block>`;
const separator = '<sep gap="36"/>';

const category = (name, id, style, blocks) => {
    const colours = CATEGORY_COLOURS[style];
    return `
    <category
        name="${name}"
        id="${id}"
        colour="${colours.primary}"
        secondaryColour="${colours.secondary}"
        tertiaryColour="${colours.tertiary}"
    >
        ${blocks.join('\n        ')}
    </category>`;
};

const motorCategory = () => category('电机', 'motor', 'motor', [
    block('motor_run_for', `${motorPortShadow('PORT', 'A')}${field('DIRECTION', 'clockwise')}${numberShadow('AMOUNT', 1)}${field('UNIT', 'rotations')}`),
    block('motor_start', `${motorPortShadow('PORT', 'A')}${field('DIRECTION', 'clockwise')}`),
    block('motor_stop', motorPortShadow('PORT', 'A')),
    separator,
    block('motor_set_speed', `${motorPortShadow('PORT', 'A')}${numberShadow('SPEED', 75)}`),
    block('motor_set_stop_action', `${motorPortShadow('PORT', 'A')}${field('STOP_ACTION', 'hold')}`),
    separator,
    block('motor_run_for_speed', `${motorPortShadow('PORT', 'A')}${numberShadow('SPEED', 75)}${numberShadow('AMOUNT', 1)}${field('UNIT', 'rotations')}`),
    block('motor_start_speed', `${motorPortShadow('PORT', 'A')}${numberShadow('SPEED', 75)}`),
    block('motor_start_power', `${motorPortShadow('PORT', 'A')}${numberShadow('POWER', 100)}`),
    separator,
    block('motor_reset_degrees', motorPortShadow('PORT', 'A')),
    block('motor_degrees', motorPortShadow('PORT', 'A')),
    block('motor_speed', motorPortShadow('PORT', 'A'))
]);

const movementCategory = () => category('移动', 'movement', 'movement', [
    block('drive_move_for', `${field('DIRECTION', 'forward')}${numberShadow('AMOUNT', 1)}${field('UNIT', 'rotations')}`),
    block('drive_steer_for', `${steeringShadow('STEERING', 0)}${numberShadow('AMOUNT', 1)}${field('UNIT', 'rotations')}`),
    block('drive_start_steer', steeringShadow('STEERING', 0)),
    block('drive_stop'),
    separator,
    block('drive_set_speed', numberShadow('SPEED', 50)),
    block('drive_set_pair', `${drivePortShadow('LEFT_PORT', 'B')}${drivePortShadow('RIGHT_PORT', 'C')}`),
    block('drive_set_stop_action', field('STOP_ACTION', 'hold')),
    separator,
    block('drive_steer_for_speed', `${numberShadow('SPEED', 50)}${numberShadow('STEERING', 0)}${numberShadow('AMOUNT', 1)}${field('UNIT', 'rotations')}`),
    block('drive_dual_speed_for', `${numberShadow('LEFT_SPEED', 50)}${numberShadow('RIGHT_SPEED', 50)}${numberShadow('AMOUNT', 1)}${field('UNIT', 'rotations')}`),
    block('drive_start_steer_speed', `${numberShadow('SPEED', 50)}${numberShadow('STEERING', 0)}`),
    block('drive_start_dual_speed', `${numberShadow('LEFT_SPEED', 50)}${numberShadow('RIGHT_SPEED', 50)}`)
]);

const displayCategory = () => category('显示', 'display', 'display', [
    block('display_image_for', `${field('IMAGE', 'eyes_neutral')}${numberShadow('SECONDS', 2)}`),
    block('display_image', field('IMAGE', 'eyes_neutral')),
    block('display_text_line', `${numberShadow('LINE', 1)}${textShadow('TEXT', 'EST')}`),
    block('display_text_xy', `${field('FONT', 'regular_black')}${numberShadow('X', 1)}${numberShadow('Y', 1)}${textShadow('TEXT', 'EST')}`),
    block('display_clear'),
    block('display_status_light', field('STATUS_MODE', 'green'))
]);

const soundCategory = () => category('声音', 'estSound', 'sound', [
    block('sound_play_wait', field('SOUND', 'communication_hello')),
    block('sound_play', field('SOUND', 'communication_hello')),
    block('sound_beep_for', `${numberShadow('NOTE', 60)}${numberShadow('SECONDS', 0.2)}`),
    block('sound_beep', numberShadow('NOTE', 60)),
    block('sound_stop_all'),
    block('sound_set_volume', numberShadow('VOLUME', 100))
]);

const eventCategory = () => category('事件', 'estEvents', 'event', [
    block('event_program_start'),
    block('event_color', `${eventSensorPortShadow('PORT', '3')}${field('COLOR_EVENT', 'red')}`),
    block('event_touch', `${eventSensorPortShadow('PORT', '1')}${field('TOUCH_EVENT', 'pressed')}`),
    block('event_ultrasonic', `${eventSensorPortShadow('PORT', '4')}${field('COMPARATOR', 'less')}${numberShadow('VALUE', 15)}${field('UNIT', 'centimeters')}`),
    block('event_ir_proximity', `${eventSensorPortShadow('PORT', '4')}${field('COMPARATOR', 'less')}${numberShadow('VALUE', 15)}`),
    block('event_ir_beacon_button', `${eventSensorPortShadow('PORT', '4')}${field('CHANNEL', '1')}${field('BEACON_EVENT', 'top_left_pressed')}`),
    block('event_gyro_angle', `${eventSensorPortShadow('PORT', '2')}${field('COMPARATOR', 'less')}${numberShadow('VALUE', 45)}`),
    block('event_brick_button', `${field('BUTTON', 'center')}${field('BUTTON_EVENT', 'pressed')}`),
    block('event_condition'),
    block('event_broadcast_received', field('MESSAGE', 'message_1')),
    block('event_broadcast', field('MESSAGE', 'message_1')),
    block('event_broadcast_wait', field('MESSAGE', 'message_1')),
    block('event_timer', numberShadow('SECONDS', 10))
]);

const controlCategory = () => category('控制', 'estControl', 'control', [
    block('control_wait_seconds', numberShadow('SECONDS', 1)),
    block('control_wait_until'),
    block('control_repeat', numberShadow('TIMES', 10)),
    block('control_forever'),
    block('control_repeat_until'),
    block('control_if'),
    block('control_if_else'),
    block('control_stop_other_stacks'),
    block('control_stop', field('STOP_SCOPE', 'exit_program'))
]);

const sensorCategory = () => category('传感器', 'sensors', 'sensing', [
    block('sensor_brick_button_value'),
    block('sensor_brick_button_pressed', field('BUTTON', 'center')),
    block('sensor_wait_brick_button', `${field('BUTTON', 'center')}${field('BUTTON_EVENT', 'pressed')}`),
    separator,
    block('sensor_color_calibrate_reflection', `${field('CALIBRATION', 'minimum')}${numberShadow('VALUE', 0)}`),
    block('sensor_color_reset_calibration'),
    block('sensor_color_reflection', field('PORT', '3')),
    block('sensor_color_reflection_compare', `${field('PORT', '3')}${field('COMPARATOR', 'less')}${numberShadow('VALUE', 50)}`),
    block('sensor_color_ambient', field('PORT', '3')),
    block('sensor_color_ambient_compare', `${field('PORT', '3')}${field('COMPARATOR', 'less')}${numberShadow('VALUE', 50)}`),
    block('sensor_color_value', field('PORT', '3')),
    block('sensor_color_is', `${field('PORT', '3')}${field('COLOR', 'red')}`),
    block('sensor_wait_color', `${field('PORT', '3')}${field('COLOR_EVENT', 'red')}`),
    separator,
    block('sensor_touch_pressed', field('PORT', '1')),
    block('sensor_wait_touch', `${field('PORT', '1')}${field('TOUCH_EVENT', 'pressed')}`),
    separator,
    block('sensor_ultrasonic_distance', `${field('PORT', '4')}${field('UNIT', 'centimeters')}`),
    block('sensor_ultrasonic_compare', `${field('PORT', '4')}${field('COMPARATOR', 'less')}${numberShadow('VALUE', 15)}${field('UNIT', 'centimeters')}`),
    block('sensor_wait_ultrasonic', `${field('PORT', '4')}${field('COMPARATOR', 'less')}${numberShadow('VALUE', 15)}${field('UNIT', 'centimeters')}`),
    separator,
    block('sensor_ir_proximity', field('PORT', '4')),
    block('sensor_ir_proximity_compare', `${field('PORT', '4')}${field('COMPARATOR', 'less')}${numberShadow('VALUE', 15)}`),
    block('sensor_wait_ir_proximity', `${field('PORT', '4')}${field('COMPARATOR', 'less')}${numberShadow('VALUE', 15)}`),
    block('sensor_ir_beacon_heading', `${field('PORT', '4')}${field('CHANNEL', '1')}`),
    block('sensor_ir_beacon_proximity', `${field('PORT', '4')}${field('CHANNEL', '1')}`),
    block('sensor_ir_beacon_buttons', `${field('PORT', '4')}${field('CHANNEL', '1')}`),
    block('sensor_ir_beacon_button_pressed', `${field('PORT', '4')}${field('CHANNEL', '1')}${field('BEACON_BUTTON', 'top_left')}`),
    block('sensor_wait_ir_beacon_button', `${field('PORT', '4')}${field('CHANNEL', '1')}${field('BEACON_EVENT', 'top_left_pressed')}`),
    block('sensor_ir_beacon_active', `${field('PORT', '4')}${field('CHANNEL', '1')}`),
    block('sensor_ir_beacon_active_compare', `${field('PORT', '4')}${field('CHANNEL', '1')}${field('PROPERTY', 'heading')}${field('COMPARATOR', 'less')}${numberShadow('VALUE', 0)}`),
    separator,
    block('sensor_gyro_angle', field('PORT', '2')),
    block('sensor_gyro_rate', field('PORT', '2')),
    block('sensor_gyro_reset', field('PORT', '2')),
    block('sensor_gyro_compare', `${field('PORT', '2')}${field('COMPARATOR', 'less')}${numberShadow('VALUE', 45)}`),
    block('sensor_wait_gyro', `${field('PORT', '2')}${field('COMPARATOR', 'less')}${numberShadow('VALUE', 45)}`),
    separator,
    block('sensor_timer'),
    block('sensor_timer_reset')
]);

const operatorCategory = () => category('运算', 'estOperators', 'operators', [
    block('operator_random', `${numberShadow('FROM', 1)}${numberShadow('TO', 10)}`),
    block('operator_add', `${numberShadow('A', 0)}${numberShadow('B', 0)}`),
    block('operator_subtract', `${numberShadow('A', 0)}${numberShadow('B', 0)}`),
    block('operator_multiply', `${numberShadow('A', 0)}${numberShadow('B', 0)}`),
    block('operator_divide', `${numberShadow('A', 0)}${numberShadow('B', 0)}`),
    block('operator_less_than', `${numberShadow('A', 0)}${numberShadow('B', 100)}`),
    block('operator_equals', `${numberShadow('A', 0)}${numberShadow('B', 100)}`),
    block('operator_greater_than', `${numberShadow('A', 0)}${numberShadow('B', 100)}`),
    block('operator_and'),
    block('operator_or'),
    block('operator_not'),
    block('operator_join', `${textShadow('A', 'apple')}${textShadow('B', 'banana')}`),
    block('operator_length', textShadow('VALUE', 'apple')),
    block('operator_mod', `${numberShadow('A', 0)}${numberShadow('B', 0)}`),
    block('operator_round', numberShadow('VALUE', 0)),
    block('operator_math', `${field('OPERATION', 'abs')}${numberShadow('VALUE', 0)}`)
]);

export const getEstToolboxCategories = () => [
    motorCategory(),
    movementCategory(),
    displayCategory(),
    soundCategory(),
    eventCategory(),
    controlCategory(),
    sensorCategory(),
    operatorCategory()
].join('\n');

export default getEstToolboxCategories;
