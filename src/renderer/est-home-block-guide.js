const EST_HOME_BLOCK_GUIDE_CATEGORIES = [
    {
        id: 'motor',
        title: 'category.motor',
        modes: [
            'home.blockGuide.mode.motor.ports',
            'home.blockGuide.mode.motor.direction',
            'home.blockGuide.mode.motor.amount',
            'home.blockGuide.mode.motor.speedPower',
            'home.blockGuide.mode.motor.stop',
            'home.blockGuide.mode.motor.feedback'
        ],
        items: [
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
        ]
    },
    {
        id: 'movement',
        title: 'category.movement',
        modes: [
            'home.blockGuide.mode.movement.pair',
            'home.blockGuide.mode.movement.direction',
            'home.blockGuide.mode.movement.steering',
            'home.blockGuide.mode.movement.amount',
            'home.blockGuide.mode.movement.speed',
            'home.blockGuide.mode.movement.stop',
            'home.blockGuide.mode.movement.lineFollow'
        ],
        items: [
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
        ]
    },
    {
        id: 'display',
        title: 'category.display',
        modes: [
            'home.blockGuide.mode.display.image',
            'home.blockGuide.mode.display.text',
            'home.blockGuide.mode.display.font',
            'home.blockGuide.mode.display.light'
        ],
        items: [
            'display_image_for',
            'display_image',
            'display_draw',
            'display_text_line',
            'display_text_xy',
            'display_clear',
            'display_status_light'
        ]
    },
    {
        id: 'sound',
        title: 'category.sound',
        modes: [
            'home.blockGuide.mode.sound.playback',
            'home.blockGuide.mode.sound.note',
            'home.blockGuide.mode.sound.volume'
        ],
        items: [
            'sound_play_wait',
            'sound_play',
            'sound_beep_for',
            'sound_beep',
            'sound_stop_all',
            'sound_set_volume'
        ]
    },
    {
        id: 'event',
        title: 'category.event',
        modes: [
            'home.blockGuide.mode.event.start',
            'home.blockGuide.mode.event.button',
            'home.blockGuide.mode.event.broadcast',
            'home.blockGuide.mode.event.timer'
        ],
        items: [
            'event_program_start',
            'event_brick_button',
            'event_condition',
            'event_broadcast_received',
            'event_broadcast',
            'event_broadcast_wait',
            'event_timer'
        ]
    },
    {
        id: 'control',
        title: 'category.control',
        modes: [
            'home.blockGuide.mode.control.wait',
            'home.blockGuide.mode.control.loop',
            'home.blockGuide.mode.control.branch',
            'home.blockGuide.mode.control.stop'
        ],
        items: [
            'control_wait_seconds',
            'control_wait_until',
            'control_repeat',
            'control_forever',
            'control_repeat_until',
            'control_if',
            'control_if_else',
            'control_stop_other_stacks',
            'control_stop'
        ]
    },
    {
        id: 'sensing',
        title: 'category.sensing',
        modes: [
            'home.blockGuide.mode.sensing.ports',
            'home.blockGuide.mode.sensing.button',
            'home.blockGuide.mode.sensing.colorLight',
            'home.blockGuide.mode.sensing.color',
            'home.blockGuide.mode.sensing.compare',
            'home.blockGuide.mode.sensing.temperature',
            'home.blockGuide.mode.sensing.touch',
            'home.blockGuide.mode.sensing.ultrasonic',
            'home.blockGuide.mode.sensing.infrared',
            'home.blockGuide.mode.sensing.beacon',
            'home.blockGuide.mode.sensing.gyro',
            'home.blockGuide.mode.sensing.timer'
        ],
        items: [
            'sensor_brick_button_value',
            'sensor_brick_button_pressed',
            'sensor_wait_brick_button',
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
            'sensor_wait_ir_beacon_button',
            'sensor_gyro_angle',
            'sensor_gyro_rate',
            'sensor_gyro_reset',
            'sensor_gyro_compare',
            'sensor_wait_gyro',
            'sensor_timer',
            'sensor_timer_reset'
        ]
    },
    {
        id: 'vision',
        title: 'category.vision',
        modes: ['home.blockGuide.mode.vision.target'],
        items: ['vision_valid', 'vision_gesture',
            'vision_class', 'vision_position', 'vision_wait_state', 'vision_wait_gesture',
            'vision_face_detected', 'vision_face_action', 'vision_wait_face',
            'vision_pose_detected', 'vision_pose_action', 'vision_wait_pose']
    },
    {
        id: 'operators',
        title: 'home.blockGuide.category.operators',
        modes: [
            'home.blockGuide.mode.operators.arithmetic',
            'home.blockGuide.mode.operators.logic',
            'home.blockGuide.mode.operators.text'
        ],
        items: [
            'operator_add',
            'operator_subtract',
            'operator_multiply',
            'operator_divide',
            'operator_random',
            'operator_gt',
            'operator_lt',
            'operator_equals',
            'operator_and',
            'operator_or',
            'operator_not',
            'operator_join',
            'operator_letter_of',
            'operator_length',
            'operator_contains',
            'operator_mod',
            'operator_round',
            'operator_mathop'
        ]
    },
    {
        id: 'variables',
        title: 'home.blockGuide.category.variables',
        modes: [
            'home.blockGuide.mode.variables.scalar',
            'home.blockGuide.mode.variables.list'
        ],
        items: [
            'data_variable',
            'data_setvariableto',
            'data_changevariableby',
            'data_listcontents',
            'data_addtolist',
            'data_deleteoflist',
            'data_deletealloflist',
            'data_insertatlist',
            'data_replaceitemoflist',
            'data_itemoflist',
            'data_itemnumoflist',
            'data_lengthoflist',
            'data_listcontainsitem'
        ]
    },
    {
        id: 'myBlocks',
        title: 'home.blockGuide.category.myBlocks',
        modes: [
            'home.blockGuide.mode.myBlocks.definition',
            'home.blockGuide.mode.myBlocks.call'
        ],
        items: [
            'procedures_definition',
            'procedures_call'
        ]
    }
];

const EST_HOME_CUSTOM_BLOCK_IDS = EST_HOME_BLOCK_GUIDE_CATEGORIES
    .filter(category => !['operators', 'variables', 'myBlocks'].includes(category.id))
    .reduce((ids, category) => ids.concat(category.items), []);

export {
    EST_HOME_BLOCK_GUIDE_CATEGORIES,
    EST_HOME_CUSTOM_BLOCK_IDS
};

export default EST_HOME_BLOCK_GUIDE_CATEGORIES;
