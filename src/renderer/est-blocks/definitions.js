import steeringArrowIcon from './steering-arrow.svg';

const CATEGORY_COLOURS = {
    motor: {primary: '#0090F5', secondary: '#0078CC', tertiary: '#005FA0'},
    movement: {primary: '#fb59ce', secondary: '#d8009b', tertiary: '#a9007a'},
    display: {primary: '#935DF5', secondary: '#691FF0', tertiary: '#4A00D0'},
    sound: {primary: '#BF70E7', secondary: '#A239D8', tertiary: '#763696'},
    event: {primary: '#F5C400', secondary: '#D9B100', tertiary: '#B89A00'},
    control: {primary: '#FFB515', secondary: '#E39B00', tertiary: '#C18401'},
    sensing: {primary: '#1DCCF0', secondary: '#00A8C9', tertiary: '#008AA6'},
    operators: {primary: '#00B94D', secondary: '#00963E', tertiary: '#00722F'}
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
        'motor_speed'
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
        'drive_start_dual_speed'
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
        'event_color',
        'event_touch',
        'event_ultrasonic',
        'event_ir_proximity',
        'event_ir_beacon_button',
        'event_gyro_angle',
        'event_brick_button',
        'event_condition',
        'event_broadcast_received',
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
    ],
    operators: [
        'operator_random',
        'operator_add',
        'operator_subtract',
        'operator_multiply',
        'operator_divide',
        'operator_less_than',
        'operator_equals',
        'operator_greater_than',
        'operator_and',
        'operator_or',
        'operator_not',
        'operator_join',
        'operator_length',
        'operator_mod',
        'operator_round',
        'operator_math'
    ]
};

const ALL_EST_BLOCK_IDS = Object.values(CATEGORY_BLOCK_IDS).reduce(
    (allIds, categoryIds) => allIds.concat(categoryIds),
    []
);
const EST_STEERING_PICKER_ID = 'est_steering_picker';
const EST_STEERING_FIELD_TYPE = 'field_est_steering';
const EST_STEERING_LIMIT = 100;
const EST_MOTOR_PORT_PICKER_ID = 'est_motor_port_picker';
const EST_DRIVE_PORT_PICKER_ID = 'est_drive_port_picker';
const EST_EVENT_SENSOR_PORT_PICKER_ID = 'est_event_sensor_port_picker';
const EST_SUPPORT_BLOCK_IDS = [
    EST_STEERING_PICKER_ID,
    EST_MOTOR_PORT_PICKER_ID,
    EST_DRIVE_PORT_PICKER_ID,
    EST_EVENT_SENSOR_PORT_PICKER_ID
];
const EST_STEERING_DIAL_COLOURS = {
    fill: CATEGORY_COLOURS.movement.secondary,
    stroke: CATEGORY_COLOURS.movement.tertiary,
    detail: '#FFFFFF'
};

const MOTOR_PORT_OPTIONS = [['A', 'A'], ['B', 'B'], ['C', 'C'], ['D', 'D']];
const SENSOR_PORT_OPTIONS = [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']];
const MOTOR_DIRECTION_OPTIONS = [['顺时针', 'clockwise'], ['逆时针', 'counterclockwise']];
const DRIVE_DIRECTION_OPTIONS = [['前', 'forward'], ['后', 'backward']];
const MOTOR_UNIT_OPTIONS = [['圈', 'rotations'], ['度', 'degrees'], ['秒', 'seconds']];
const MOTOR_STOP_ACTION_OPTIONS = [['保持位置', 'hold'], ['惯性滑行', 'float']];
const IMAGE_OPTIONS = [['Eyes / Neutral', 'eyes_neutral']];
const FONT_OPTIONS = [
    ['常规黑色', 'regular_black'],
    ['粗体黑色', 'bold_black'],
    ['大号黑色', 'large_black'],
    ['常规白色', 'regular_white'],
    ['粗体白色', 'bold_white'],
    ['大号白色', 'large_white']
];
const STATUS_LIGHT_OPTIONS = [
    ['关闭', 'off'],
    ['绿色', 'green'],
    ['红色', 'red'],
    ['橙色', 'orange'],
    ['绿色闪烁', 'green_flash'],
    ['红色闪烁', 'red_flash'],
    ['橙色闪烁', 'orange_flash']
];
const SOUND_OPTIONS = [['Communication / Hello', 'communication_hello']];
const TOUCH_EVENT_OPTIONS = [['被按压', 'pressed'], ['被松开', 'released']];
const COMPARATOR_OPTIONS = [
    ['小于 (<)', 'less'],
    ['大于 (>)', 'greater'],
    ['等于 (=)', 'equal'],
    ['变化超过', 'changed']
];
const COLOR_OPTIONS = [
    ['无色', 'none'],
    ['黑色', 'black'],
    ['蓝色', 'blue'],
    ['绿色', 'green'],
    ['黄色', 'yellow'],
    ['红色', 'red'],
    ['白色', 'white'],
    ['棕色', 'brown']
];
const COLOR_EVENT_OPTIONS = COLOR_OPTIONS.concat([['已改变', 'changed']]);
const BEACON_EVENT_OPTIONS = [
    ['左上按钮被按压', 'top_left_pressed'],
    ['左下按钮被按压', 'bottom_left_pressed'],
    ['未按压左按钮', 'left_released'],
    ['右上按钮被按压', 'top_right_pressed'],
    ['右下按钮被按压', 'bottom_right_pressed'],
    ['未按压右按钮', 'right_released'],
    ['信标处于活动状态', 'active']
];
const BEACON_BUTTON_OPTIONS = [
    ['无按钮', 'none'],
    ['左上按钮', 'top_left'],
    ['左下按钮', 'bottom_left'],
    ['右上按钮', 'top_right'],
    ['右下按钮', 'bottom_right'],
    ['信标按钮', 'beacon']
];
const BEACON_CHANNEL_OPTIONS = [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']];
const BRICK_BUTTON_OPTIONS = [
    ['无', 'none'],
    ['左', 'left'],
    ['中', 'center'],
    ['右', 'right'],
    ['上', 'up'],
    ['下', 'down']
];
const DISTANCE_UNIT_OPTIONS = [['厘米', 'centimeters'], ['英寸', 'inches']];
const BEACON_PROPERTY_OPTIONS = [['朝向', 'heading'], ['近程', 'proximity']];
const CALIBRATION_OPTIONS = [['最小值', 'minimum'], ['最大值', 'maximum']];
const MESSAGE_OPTIONS = [['消息1', 'message_1']];
const STOP_SCOPE_OPTIONS = [
    ['所有程序堆', 'all'],
    ['此程序堆', 'this_stack'],
    ['其它程序堆', 'other_stacks'],
    ['并退出程序', 'exit_program']
];
const MATH_OPERATION_OPTIONS = [
    ['绝对值', 'abs'],
    ['向下取整', 'floor'],
    ['向上取整', 'ceiling'],
    ['平方根', 'sqrt'],
    ['sin', 'sin'],
    ['cos', 'cos'],
    ['tan', 'tan'],
    ['asin', 'asin'],
    ['acos', 'acos'],
    ['atan', 'atan'],
    ['ln', 'ln'],
    ['log', 'log'],
    ['e ^', 'e_power'],
    ['10 ^', 'ten_power']
];
const dropdown = (name, options) => ({type: 'field_dropdown', name, options});
const valueInput = (name, check) => {
    const input = {type: 'input_value', name};
    if (check) input.check = check;
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
        sensing: 'sensing',
        operators: 'operators'
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

const reporter = (ScratchBlocks, style, type, message0, args0 = [], output = 'Number') => styled(style, {
    type,
    message0,
    args0,
    inputsInline: true,
    output,
    outputShape: ScratchBlocks.OUTPUT_SHAPE_ROUND
});

const booleanReporter = (ScratchBlocks, style, type, message0, args0 = []) => styled(style, {
    type,
    message0,
    args0,
    inputsInline: true,
    output: 'Boolean',
    outputShape: ScratchBlocks.OUTPUT_SHAPE_HEXAGONAL
});

const hat = (style, type, message0, args0 = []) => styled(style, {
    type,
    message0,
    args0,
    inputsInline: true,
    extensions: ['shape_hat']
});

const clampSteering = value => Math.max(
    -EST_STEERING_LIMIT,
    Math.min(EST_STEERING_LIMIT, value)
);
const isSteeringDialMarkVisible = angle => angle === 0 || angle >= 180;

const registerEstSteeringField = ScratchBlocks => {
    if (!ScratchBlocks.Field || !ScratchBlocks.FieldAngle || !ScratchBlocks.FieldTextInput) return;

    const EstSteeringField = function (value) {
        ScratchBlocks.FieldAngle.call(this, value);
    };
    EstSteeringField.prototype = Object.create(ScratchBlocks.FieldAngle.prototype);
    EstSteeringField.prototype.constructor = EstSteeringField;
    EstSteeringField.fromJson = options => new EstSteeringField(options.value);

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

const makeEventSensorPortPickerDefinition = ScratchBlocks => ({
    ...reporter(ScratchBlocks, 'event', EST_EVENT_SENSOR_PORT_PICKER_ID, '%1', [
        dropdown('PORT', SENSOR_PORT_OPTIONS)
    ], 'String'),
    colour: CATEGORY_COLOURS.event.secondary,
    colourSecondary: CATEGORY_COLOURS.event.secondary,
    colourTertiary: CATEGORY_COLOURS.event.tertiary
});

const makeMotorDefinitions = ScratchBlocks => [
    command('motor', 'motor_run_for', '%1 %2 运行 %3 %4', [
        valueInput('PORT'),
        dropdown('DIRECTION', MOTOR_DIRECTION_OPTIONS),
        valueInput('AMOUNT', 'Number'),
        dropdown('UNIT', MOTOR_UNIT_OPTIONS)
    ]),
    command('motor', 'motor_start', '%1 %2 启动电机', [
        valueInput('PORT'),
        dropdown('DIRECTION', MOTOR_DIRECTION_OPTIONS)
    ]),
    command('motor', 'motor_stop', '%1 停止电机', [valueInput('PORT')]),
    command('motor', 'motor_set_speed', '%1 将速度设置为 %2 %%', [
        valueInput('PORT'),
        valueInput('SPEED', 'Number')
    ]),
    command('motor', 'motor_set_stop_action', '%1 将电机设置为在停止处 %2', [
        valueInput('PORT'),
        dropdown('STOP_ACTION', MOTOR_STOP_ACTION_OPTIONS)
    ]),
    command('motor', 'motor_run_for_speed', '%1 以 %2 %% 的速度运行 %3 %4', [
        valueInput('PORT'),
        valueInput('SPEED', 'Number'),
        valueInput('AMOUNT', 'Number'),
        dropdown('UNIT', MOTOR_UNIT_OPTIONS)
    ]),
    command('motor', 'motor_start_speed', '%1 以 %2 %% 的速度启动电机', [
        valueInput('PORT'),
        valueInput('SPEED', 'Number')
    ]),
    command('motor', 'motor_start_power', '%1 以 %2 %% 的功率启动电机', [
        valueInput('PORT'),
        valueInput('POWER', 'Number')
    ]),
    command('motor', 'motor_reset_degrees', '%1 重置运转度数', [valueInput('PORT')]),
    reporter(ScratchBlocks, 'motor', 'motor_degrees', '%1 运转度数', [valueInput('PORT')]),
    reporter(ScratchBlocks, 'motor', 'motor_speed', '%1 速度', [valueInput('PORT')])
];

const makeMovementDefinitions = () => [
    command('movement', 'drive_move_for', '向 %1 移动 %2 %3', [
        dropdown('DIRECTION', DRIVE_DIRECTION_OPTIONS),
        valueInput('AMOUNT', 'Number'),
        dropdown('UNIT', MOTOR_UNIT_OPTIONS)
    ]),
    command('movement', 'drive_steer_for', '向 前:%1 移动 %2 %3', [
        valueInput('STEERING', 'Number'),
        valueInput('AMOUNT', 'Number'),
        dropdown('UNIT', MOTOR_UNIT_OPTIONS)
    ]),
    command('movement', 'drive_start_steer', '开始向 前:%1 移动', [valueInput('STEERING', 'Number')]),
    command('movement', 'drive_stop', '停止运动'),
    command('movement', 'drive_set_speed', '将移动速度设置为 %1 %%', [valueInput('SPEED', 'Number')]),
    command('movement', 'drive_set_pair', '将运转电机设置为 %1 和 %2', [
        valueInput('LEFT_PORT'),
        valueInput('RIGHT_PORT')
    ]),
    command('movement', 'drive_set_stop_action', '将运转电机设置为停止时 %1', [
        dropdown('STOP_ACTION', MOTOR_STOP_ACTION_OPTIONS)
    ]),
    command('movement', 'drive_steer_for_speed', '以 %1 %% 的速度向 前:%2 移动 %3 %4', [
        valueInput('SPEED', 'Number'),
        valueInput('STEERING', 'Number'),
        valueInput('AMOUNT', 'Number'),
        dropdown('UNIT', MOTOR_UNIT_OPTIONS)
    ]),
    command('movement', 'drive_dual_speed_for', '以 %1 %2 %% 的速度移动 %3 %4', [
        valueInput('LEFT_SPEED', 'Number'),
        valueInput('RIGHT_SPEED', 'Number'),
        valueInput('AMOUNT', 'Number'),
        dropdown('UNIT', MOTOR_UNIT_OPTIONS)
    ]),
    command('movement', 'drive_start_steer_speed', '以 %1 %% 的速度开始向 前:%2 移动', [
        valueInput('SPEED', 'Number'),
        valueInput('STEERING', 'Number')
    ]),
    command('movement', 'drive_start_dual_speed', '以 %1 %2 %% 的速度开始移动', [
        valueInput('LEFT_SPEED', 'Number'),
        valueInput('RIGHT_SPEED', 'Number')
    ])
];

const makeDisplayDefinitions = () => [
    command('display', 'display_image_for', '显示 %1 %2 秒', [
        dropdown('IMAGE', IMAGE_OPTIONS),
        valueInput('SECONDS', 'Number')
    ]),
    command('display', 'display_image', '显示 %1', [dropdown('IMAGE', IMAGE_OPTIONS)]),
    command('display', 'display_text_line', '在第 %1 行写入 %2', [
        valueInput('LINE', 'Number'),
        valueInput('TEXT')
    ]),
    command('display', 'display_text_xy', '使用字体 %1 在 %2 , %3 处写入 %4', [
        dropdown('FONT', FONT_OPTIONS),
        valueInput('X', 'Number'),
        valueInput('Y', 'Number'),
        valueInput('TEXT')
    ]),
    command('display', 'display_clear', '清除显示'),
    command('display', 'display_status_light', '将状态灯设置为 %1', [
        dropdown('STATUS_MODE', STATUS_LIGHT_OPTIONS)
    ])
];

const makeSoundDefinitions = () => [
    command('sound', 'sound_play_wait', '播放声音 %1 直到完成', [dropdown('SOUND', SOUND_OPTIONS)]),
    command('sound', 'sound_play', '开始播放声音 %1', [dropdown('SOUND', SOUND_OPTIONS)]),
    command('sound', 'sound_beep_for', '播放警笛声 %1 %2 秒', [
        valueInput('NOTE', 'Number'),
        valueInput('SECONDS', 'Number')
    ]),
    command('sound', 'sound_beep', '开始播放警笛声 %1', [valueInput('NOTE', 'Number')]),
    command('sound', 'sound_stop_all', '停止所有声音'),
    command('sound', 'sound_set_volume', '将音量设置为 %1 %%', [valueInput('VOLUME', 'Number')])
];

const makeEventDefinitions = () => [
    hat('event', 'event_program_start', '当程序启动时'),
    hat('event', 'event_color', '%1 当颜色为 %2', [
        valueInput('PORT'),
        dropdown('COLOR_EVENT', COLOR_EVENT_OPTIONS)
    ]),
    hat('event', 'event_touch', '%1 当 %2', [
        valueInput('PORT'),
        dropdown('TOUCH_EVENT', TOUCH_EVENT_OPTIONS)
    ]),
    hat('event', 'event_ultrasonic', '%1 当距离 %2 %3 %4', [
        valueInput('PORT'),
        dropdown('COMPARATOR', COMPARATOR_OPTIONS),
        valueInput('VALUE', 'Number'),
        dropdown('UNIT', DISTANCE_UNIT_OPTIONS)
    ]),
    hat('event', 'event_ir_proximity', '%1 当近程 %2 %3 %%', [
        valueInput('PORT'),
        dropdown('COMPARATOR', COMPARATOR_OPTIONS),
        valueInput('VALUE', 'Number')
    ]),
    hat('event', 'event_ir_beacon_button', '%1 当信标 %2 %3 时', [
        valueInput('PORT'),
        dropdown('CHANNEL', BEACON_CHANNEL_OPTIONS),
        dropdown('BEACON_EVENT', BEACON_EVENT_OPTIONS)
    ]),
    hat('event', 'event_gyro_angle', '%1 当角度 %2 %3° 时', [
        valueInput('PORT'),
        dropdown('COMPARATOR', COMPARATOR_OPTIONS),
        valueInput('VALUE', 'Number')
    ]),
    hat('event', 'event_brick_button', '当 %1 按钮 %2', [
        dropdown('BUTTON', BRICK_BUTTON_OPTIONS),
        dropdown('BUTTON_EVENT', TOUCH_EVENT_OPTIONS)
    ]),
    hat('event', 'event_condition', '当 %1', [valueInput('CONDITION', 'Boolean')]),
    hat('event', 'event_broadcast_received', '当接收到 %1', [dropdown('MESSAGE', MESSAGE_OPTIONS)]),
    command('event', 'event_broadcast', '广播 %1', [dropdown('MESSAGE', MESSAGE_OPTIONS)]),
    command('event', 'event_broadcast_wait', '广播 %1 并等待', [dropdown('MESSAGE', MESSAGE_OPTIONS)]),
    hat('event', 'event_timer', '当计时器 > %1', [valueInput('SECONDS', 'Number')])
];

const makeControlDefinitions = () => [
    command('control', 'control_wait_seconds', '等待 %1 秒', [valueInput('SECONDS', 'Number')]),
    command('control', 'control_wait_until', '等待 %1', [valueInput('CONDITION', 'Boolean')]),
    styled('control', {
        type: 'control_repeat',
        message0: '重复执行 %1 次',
        args0: [valueInput('TIMES', 'Number')],
        message1: '%1',
        args1: [statementInput('SUBSTACK')],
        previousStatement: null,
        nextStatement: null
    }),
    styled('control', {
        type: 'control_forever',
        message0: '重复执行',
        message1: '%1',
        args1: [statementInput('SUBSTACK')],
        previousStatement: null
    }),
    styled('control', {
        type: 'control_repeat_until',
        message0: '重复执行直到 %1',
        args0: [valueInput('CONDITION', 'Boolean')],
        message1: '%1',
        args1: [statementInput('SUBSTACK')],
        previousStatement: null,
        nextStatement: null
    }),
    styled('control', {
        type: 'control_if',
        message0: '如果 %1 那么',
        args0: [valueInput('CONDITION', 'Boolean')],
        message1: '%1',
        args1: [statementInput('SUBSTACK')],
        previousStatement: null,
        nextStatement: null
    }),
    styled('control', {
        type: 'control_if_else',
        message0: '如果 %1 那么',
        args0: [valueInput('CONDITION', 'Boolean')],
        message1: '%1',
        args1: [statementInput('SUBSTACK')],
        message2: '否则',
        message3: '%1',
        args3: [statementInput('SUBSTACK2')],
        previousStatement: null,
        nextStatement: null
    }),
    command('control', 'control_stop_other_stacks', '停止其它程序堆'),
    endCommand('control', 'control_stop', '停止 %1', [dropdown('STOP_SCOPE', STOP_SCOPE_OPTIONS)])
];

const makeSensorDefinitions = ScratchBlocks => [
    reporter(ScratchBlocks, 'sensing', 'sensor_brick_button_value', '按钮'),
    booleanReporter(ScratchBlocks, 'sensing', 'sensor_brick_button_pressed', '%1 按钮是否被按压？', [
        dropdown('BUTTON', BRICK_BUTTON_OPTIONS)
    ]),
    command('sensing', 'sensor_wait_brick_button', '等待直到 %1 按钮 %2', [
        dropdown('BUTTON', BRICK_BUTTON_OPTIONS),
        dropdown('BUTTON_EVENT', TOUCH_EVENT_OPTIONS)
    ]),
    command('sensing', 'sensor_color_calibrate_reflection', '将反射光线强度从 %1 校准至 %2', [
        dropdown('CALIBRATION', CALIBRATION_OPTIONS),
        valueInput('VALUE', 'Number')
    ]),
    command('sensing', 'sensor_color_reset_calibration', '重置反射光线强度校准'),
    reporter(ScratchBlocks, 'sensing', 'sensor_color_reflection', '%1 反射光线强度', [
        dropdown('PORT', SENSOR_PORT_OPTIONS)
    ]),
    booleanReporter(ScratchBlocks, 'sensing', 'sensor_color_reflection_compare',
        '%1 反射光线强度是否 %2 %3 %%？', [
            dropdown('PORT', SENSOR_PORT_OPTIONS),
            dropdown('COMPARATOR', COMPARATOR_OPTIONS),
            valueInput('VALUE', 'Number')
        ]),
    reporter(ScratchBlocks, 'sensing', 'sensor_color_ambient', '%1 环境光强度', [
        dropdown('PORT', SENSOR_PORT_OPTIONS)
    ]),
    booleanReporter(ScratchBlocks, 'sensing', 'sensor_color_ambient_compare',
        '%1 环境光强度是否 %2 %3 %%？', [
            dropdown('PORT', SENSOR_PORT_OPTIONS),
            dropdown('COMPARATOR', COMPARATOR_OPTIONS),
            valueInput('VALUE', 'Number')
        ]),
    reporter(ScratchBlocks, 'sensing', 'sensor_color_value', '%1 颜色', [
        dropdown('PORT', SENSOR_PORT_OPTIONS)
    ]),
    booleanReporter(ScratchBlocks, 'sensing', 'sensor_color_is', '%1 颜色是否为 %2？', [
        dropdown('PORT', SENSOR_PORT_OPTIONS),
        dropdown('COLOR', COLOR_OPTIONS)
    ]),
    command('sensing', 'sensor_wait_color', '%1 等待直到颜色为 %2', [
        dropdown('PORT', SENSOR_PORT_OPTIONS),
        dropdown('COLOR_EVENT', COLOR_EVENT_OPTIONS)
    ]),
    booleanReporter(ScratchBlocks, 'sensing', 'sensor_touch_pressed', '%1 是否被按压？', [
        dropdown('PORT', SENSOR_PORT_OPTIONS)
    ]),
    command('sensing', 'sensor_wait_touch', '%1 等待直到 %2', [
        dropdown('PORT', SENSOR_PORT_OPTIONS),
        dropdown('TOUCH_EVENT', TOUCH_EVENT_OPTIONS)
    ]),
    reporter(ScratchBlocks, 'sensing', 'sensor_ultrasonic_distance', '%1 距离，单位为 %2', [
        dropdown('PORT', SENSOR_PORT_OPTIONS),
        dropdown('UNIT', DISTANCE_UNIT_OPTIONS)
    ]),
    booleanReporter(ScratchBlocks, 'sensing', 'sensor_ultrasonic_compare', '%1 距离是否 %2 %3 %4？', [
        dropdown('PORT', SENSOR_PORT_OPTIONS),
        dropdown('COMPARATOR', COMPARATOR_OPTIONS),
        valueInput('VALUE', 'Number'),
        dropdown('UNIT', DISTANCE_UNIT_OPTIONS)
    ]),
    command('sensing', 'sensor_wait_ultrasonic', '%1 等待直到距离 %2 %3 %4', [
        dropdown('PORT', SENSOR_PORT_OPTIONS),
        dropdown('COMPARATOR', COMPARATOR_OPTIONS),
        valueInput('VALUE', 'Number'),
        dropdown('UNIT', DISTANCE_UNIT_OPTIONS)
    ]),
    reporter(ScratchBlocks, 'sensing', 'sensor_ir_proximity', '%1 近程', [
        dropdown('PORT', SENSOR_PORT_OPTIONS)
    ]),
    booleanReporter(ScratchBlocks, 'sensing', 'sensor_ir_proximity_compare', '%1 近程是否 %2 %3 %%？', [
        dropdown('PORT', SENSOR_PORT_OPTIONS),
        dropdown('COMPARATOR', COMPARATOR_OPTIONS),
        valueInput('VALUE', 'Number')
    ]),
    command('sensing', 'sensor_wait_ir_proximity', '%1 等待直到近程 %2 %3 %%', [
        dropdown('PORT', SENSOR_PORT_OPTIONS),
        dropdown('COMPARATOR', COMPARATOR_OPTIONS),
        valueInput('VALUE', 'Number')
    ]),
    reporter(ScratchBlocks, 'sensing', 'sensor_ir_beacon_heading', '%1 前往信标 %2', [
        dropdown('PORT', SENSOR_PORT_OPTIONS),
        dropdown('CHANNEL', BEACON_CHANNEL_OPTIONS)
    ]),
    reporter(ScratchBlocks, 'sensing', 'sensor_ir_beacon_proximity', '%1 信标 %2 近程', [
        dropdown('PORT', SENSOR_PORT_OPTIONS),
        dropdown('CHANNEL', BEACON_CHANNEL_OPTIONS)
    ]),
    reporter(ScratchBlocks, 'sensing', 'sensor_ir_beacon_buttons', '%1 按压信标 %2 按钮', [
        dropdown('PORT', SENSOR_PORT_OPTIONS),
        dropdown('CHANNEL', BEACON_CHANNEL_OPTIONS)
    ]),
    booleanReporter(ScratchBlocks, 'sensing', 'sensor_ir_beacon_button_pressed',
        '%1 信标 %2 %3 是否被按压？', [
            dropdown('PORT', SENSOR_PORT_OPTIONS),
            dropdown('CHANNEL', BEACON_CHANNEL_OPTIONS),
            dropdown('BEACON_BUTTON', BEACON_BUTTON_OPTIONS)
        ]),
    command('sensing', 'sensor_wait_ir_beacon_button', '%1 等待直到信标 %2 %3', [
        dropdown('PORT', SENSOR_PORT_OPTIONS),
        dropdown('CHANNEL', BEACON_CHANNEL_OPTIONS),
        dropdown('BEACON_EVENT', BEACON_EVENT_OPTIONS)
    ]),
    booleanReporter(ScratchBlocks, 'sensing', 'sensor_ir_beacon_active',
        '%1 信标 %2 是否处于活动状态？', [
            dropdown('PORT', SENSOR_PORT_OPTIONS),
            dropdown('CHANNEL', BEACON_CHANNEL_OPTIONS)
        ]),
    booleanReporter(ScratchBlocks, 'sensing', 'sensor_ir_beacon_active_compare',
        '%1 信标 %2 是否 %3 %4 %5？', [
            dropdown('PORT', SENSOR_PORT_OPTIONS),
            dropdown('CHANNEL', BEACON_CHANNEL_OPTIONS),
            dropdown('PROPERTY', BEACON_PROPERTY_OPTIONS),
            dropdown('COMPARATOR', COMPARATOR_OPTIONS),
            valueInput('VALUE', 'Number')
        ]),
    reporter(ScratchBlocks, 'sensing', 'sensor_gyro_angle', '%1 角度', [
        dropdown('PORT', SENSOR_PORT_OPTIONS)
    ]),
    reporter(ScratchBlocks, 'sensing', 'sensor_gyro_rate', '%1 角速度', [
        dropdown('PORT', SENSOR_PORT_OPTIONS)
    ]),
    command('sensing', 'sensor_gyro_reset', '%1 重置角度', [dropdown('PORT', SENSOR_PORT_OPTIONS)]),
    booleanReporter(ScratchBlocks, 'sensing', 'sensor_gyro_compare', '%1 角度是否 %2 %3°？', [
        dropdown('PORT', SENSOR_PORT_OPTIONS),
        dropdown('COMPARATOR', COMPARATOR_OPTIONS),
        valueInput('VALUE', 'Number')
    ]),
    command('sensing', 'sensor_wait_gyro', '%1 等待直到角度 %2 %3°', [
        dropdown('PORT', SENSOR_PORT_OPTIONS),
        dropdown('COMPARATOR', COMPARATOR_OPTIONS),
        valueInput('VALUE', 'Number')
    ]),
    reporter(ScratchBlocks, 'sensing', 'sensor_timer', '计时器'),
    command('sensing', 'sensor_timer_reset', '重置计数器')
];

const makeOperatorDefinitions = ScratchBlocks => [
    reporter(ScratchBlocks, 'operators', 'operator_random', '在 %1 和 %2 之间取随机数', [
        valueInput('FROM'),
        valueInput('TO')
    ]),
    reporter(ScratchBlocks, 'operators', 'operator_add', '%1 + %2', [valueInput('A'), valueInput('B')]),
    reporter(ScratchBlocks, 'operators', 'operator_subtract', '%1 - %2', [valueInput('A'), valueInput('B')]),
    reporter(ScratchBlocks, 'operators', 'operator_multiply', '%1 * %2', [valueInput('A'), valueInput('B')]),
    reporter(ScratchBlocks, 'operators', 'operator_divide', '%1 / %2', [valueInput('A'), valueInput('B')]),
    booleanReporter(ScratchBlocks, 'operators', 'operator_less_than', '%1 < %2', [
        valueInput('A'),
        valueInput('B')
    ]),
    booleanReporter(ScratchBlocks, 'operators', 'operator_equals', '%1 = %2', [
        valueInput('A'),
        valueInput('B')
    ]),
    booleanReporter(ScratchBlocks, 'operators', 'operator_greater_than', '%1 > %2', [
        valueInput('A'),
        valueInput('B')
    ]),
    booleanReporter(ScratchBlocks, 'operators', 'operator_and', '%1 与 %2', [
        valueInput('A', 'Boolean'),
        valueInput('B', 'Boolean')
    ]),
    booleanReporter(ScratchBlocks, 'operators', 'operator_or', '%1 或 %2', [
        valueInput('A', 'Boolean'),
        valueInput('B', 'Boolean')
    ]),
    booleanReporter(ScratchBlocks, 'operators', 'operator_not', '%1 不成立', [
        valueInput('VALUE', 'Boolean')
    ]),
    reporter(ScratchBlocks, 'operators', 'operator_join', '连接 %1 和 %2', [
        valueInput('A'),
        valueInput('B')
    ], 'String'),
    reporter(ScratchBlocks, 'operators', 'operator_length', '%1 的字符数', [valueInput('VALUE')]),
    reporter(ScratchBlocks, 'operators', 'operator_mod', '%1 除以 %2 的余数', [
        valueInput('A'),
        valueInput('B')
    ]),
    reporter(ScratchBlocks, 'operators', 'operator_round', '四舍五入 %1', [valueInput('VALUE')]),
    reporter(ScratchBlocks, 'operators', 'operator_math', '%1 %2', [
        dropdown('OPERATION', MATH_OPERATION_OPTIONS),
        valueInput('VALUE')
    ])
];

const makeEstBlockDefinitions = ScratchBlocks => [
    makeSteeringPickerDefinition(ScratchBlocks),
    makeMotorPortPickerDefinition(ScratchBlocks, 'motor', EST_MOTOR_PORT_PICKER_ID),
    makeMotorPortPickerDefinition(ScratchBlocks, 'movement', EST_DRIVE_PORT_PICKER_ID),
    makeEventSensorPortPickerDefinition(ScratchBlocks),
    ...makeMotorDefinitions(ScratchBlocks),
    ...makeMovementDefinitions(),
    ...makeDisplayDefinitions(),
    ...makeSoundDefinitions(),
    ...makeEventDefinitions(),
    ...makeControlDefinitions(),
    ...makeSensorDefinitions(ScratchBlocks),
    ...makeOperatorDefinitions(ScratchBlocks)
];

const registeredTargets = new WeakSet();

export const registerEstBlocks = ScratchBlocks => {
    if (registeredTargets.has(ScratchBlocks)) return;
    registerEstSteeringField(ScratchBlocks);
    ScratchBlocks.defineBlocksWithJsonArray(makeEstBlockDefinitions(ScratchBlocks));
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
    EST_STEERING_DIAL_COLOURS,
    EST_STEERING_LIMIT,
    EST_STEERING_PICKER_ID,
    EST_DRIVE_PORT_PICKER_ID,
    EST_EVENT_SENSOR_PORT_PICKER_ID,
    EST_MOTOR_PORT_PICKER_ID,
    EST_SUPPORT_BLOCK_IDS,
    MOTOR_BLOCK_IDS,
    MOTOR_COLOURS,
    MOTOR_DIRECTION_OPTIONS,
    MOTOR_PORT_OPTIONS,
    MOTOR_STOP_ACTION_OPTIONS,
    MOTOR_UNIT_OPTIONS,
    SENSOR_PORT_OPTIONS,
    isSteeringDialMarkVisible
};
