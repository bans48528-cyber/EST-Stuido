import {installEstPythonNameSanitizer} from './python-names';

const registeredGenerators = new WeakSet();

const EVENT_HAT_IDS = new Set([
    'event_program_start',
    'event_brick_button',
    'event_condition',
    'event_timer'
]);

const COLOR_IDS = {
    none: 0,
    black: 1,
    blue: 2,
    green: 3,
    yellow: 4,
    red: 5,
    white: 6,
    brown: 7
};

const STATUS_LIGHT_CONSTANTS = {
    off: 'est.led.OFF',
    red: 'est.led.RED',
    blue: 'est.led.BLUE'
};

const BRICK_BUTTON_CONSTANTS = {
    none: 'est.buttons.NONE',
    back: 'est.buttons.BACK',
    left: 'est.buttons.LEFT',
    center: 'est.buttons.CONFIRM',
    confirm: 'est.buttons.CONFIRM',
    right: 'est.buttons.RIGHT',
    up: 'est.buttons.UP',
    down: 'est.buttons.DOWN'
};

const ASYNC_RUNTIME_STATEMENT_RE =
    /^(\s*)(?!await\b)(rt\.(?:yield_once|sleep|wait_until|motor_run_for|drive_move_for|drive_steer_for|drive_dual_speed_for|display_image_for|wait_[a-z_]+)\s*\()/gm;
const STACK_STOP_STATEMENT_RE = /\brt\.(?:stop|stop_other_stacks)\s*\(/;

const ensureDictionary = (generator, name) => {
    if (!generator[name]) generator[name] = Object.create(null);
    return generator[name];
};

const ensureRuntimeImport = generator => {
    ensureDictionary(generator, 'imports_').estRuntime = 'import est_runtime as rt';
};

const ensureHardwareImport = generator => {
    ensureDictionary(generator, 'imports_').estHardware = 'import est';
};

const orderOf = (generator, name, fallback = 99) => (
    typeof generator[name] === 'number' ? generator[name] : fallback
);

const quote = (generator, value) => generator.quote_(String(value));

const doubleQuote = value => `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

const fieldValue = (block, name, fallback) => {
    const value = block.getFieldValue(name);
    return value === null || typeof value === 'undefined' || value === '' ? fallback : value;
};

const quoteField = (generator, block, name, fallback) => quote(
    generator,
    fieldValue(block, name, fallback)
);

const normalizeBrickButtonName = value => (value === 'center' ? 'confirm' : value);

const quoteBrickButtonField = (generator, block, name, fallback = 'confirm') => quote(
    generator,
    normalizeBrickButtonName(fieldValue(block, name, fallback))
);

const normalizeStopScope = value => {
    if (value === 'exit_program') return 'all';
    if (value === 'other_stacks') return 'other_stacks';
    if (value === 'this_stack') return 'this_stack';
    return 'all';
};

const numberField = (block, name, fallback = '0') => String(fieldValue(block, name, fallback));
const infraredRemoteChannel = () => '1';

const valueOr = (generator, block, name, fallback) => (
    generator.valueToCode(block, name, orderOf(generator, 'ORDER_NONE')) || fallback
);

const doubleQuotedMotorPortLiteral = code => {
    const match = String(code).match(/^['"]([ABCD])['"]$/);
    return match ? doubleQuote(match[1]) : code;
};

const statementOrPass = (generator, block, name) => {
    const code = typeof generator.statementToCode === 'function' ?
        generator.statementToCode(block, name) :
        ((block.statements && block.statements[name]) || '');
    return code || `${generator.INDENT}pass\n`;
};

const functionCall = (generator, code) => [
    code,
    orderOf(generator, 'ORDER_FUNCTION_CALL', orderOf(generator, 'ORDER_ATOMIC', 0))
];

const initialiseStackNumbers = (generator, workspace) => {
    generator.estStackNumbers_ = Object.create(null);
    generator.estNextStackNumber_ = 1;
    generator.estProgramStartCount_ = 0;
    if (!workspace || typeof workspace.getTopBlocks !== 'function') return;

    const topBlocks = workspace.getTopBlocks(true);
    generator.estProgramStartCount_ = topBlocks
        .filter(block => block.type === 'event_program_start')
        .length;
    topBlocks
        .filter(block => EVENT_HAT_IDS.has(block.type))
        .forEach(block => {
            generator.estStackNumbers_[block.id] = generator.estNextStackNumber_++;
        });
};

const stackNameForBlock = (block, generator) => {
    if (!generator) return 'stack_1';
    if (!generator.estStackNumbers_) initialiseStackNumbers(generator);
    if (!generator.estStackNumbers_[block.id]) {
        generator.estStackNumbers_[block.id] = generator.estNextStackNumber_++;
    }
    return `stack_${generator.estStackNumbers_[block.id]}`;
};

const globalVariableNames = generator => Object.keys(generator.variables_ || {})
    .map(key => generator.variables_[key].split('=')[0].trim())
    .filter(Boolean);

const hasAsyncRuntimeStatement = code => {
    ASYNC_RUNTIME_STATEMENT_RE.lastIndex = 0;
    return ASYNC_RUNTIME_STATEMENT_RE.test(code);
};

const stackNeedsCooperativeRuntime = (generator, block, code) => (
    EVENT_HAT_IDS.has(block.type) &&
    (
        (block.type === 'event_program_start' && (generator.estProgramStartCount_ || 0) > 1) ||
        STACK_STOP_STATEMENT_RE.test(code) ||
        /\bawait\s+rt\./.test(code) ||
        hasAsyncRuntimeStatement(code)
    )
);

const asyncifyStackCode = code => {
    ASYNC_RUNTIME_STATEMENT_RE.lastIndex = 0;
    return code.replace(ASYNC_RUNTIME_STATEMENT_RE, '$1await $2');
};

const registerEventHat = (generator, block, decorator) => {
    ensureRuntimeImport(generator);
    const stackName = stackNameForBlock(block, generator);
    const nextBlock = block.nextConnection && block.nextConnection.targetBlock();
    let code = `${decorator}\ndef ${stackName}():\n`;
    const variables = globalVariableNames(generator);

    if (variables.length > 0) {
        code += `${generator.INDENT}global ${variables.join(', ')}\n`;
    }
    if (nextBlock) {
        code = generator.scrub_(block, code);
    } else {
        code += `${generator.INDENT}pass\n`;
    }

    if (stackNeedsCooperativeRuntime(generator, block, code)) {
        code = code.replace(`\ndef ${stackName}():`, `\nasync def ${stackName}():`);
        code = asyncifyStackCode(code);
    }

    ensureDictionary(generator, 'libraries_')[`est_${stackName}`] = code;
    ensureDictionary(generator, 'setups_').estRun = 'rt.run()';
    return null;
};

const registerLifecycle = (ScratchBlocks, generator) => {
    const originalInit = generator.init;
    if (typeof originalInit === 'function') {
        generator.init = function (workspace) {
            installEstPythonNameSanitizer(ScratchBlocks, this);
            if (this.variableDB_ && typeof this.variableDB_.reset === 'function') {
                this.variableDB_.reset();
            }
            originalInit.call(this, workspace);
            installEstPythonNameSanitizer(ScratchBlocks, this);
            initialiseStackNumbers(this, workspace);
        };
    } else {
        installEstPythonNameSanitizer(ScratchBlocks, generator);
        initialiseStackNumbers(generator);
    }
};

const registerSupportGenerators = generator => {
    generator.operator_random = block => {
        ensureRuntimeImport(generator);
        const first = valueOr(generator, block, 'FROM', '0');
        const last = valueOr(generator, block, 'TO', '0');
        return functionCall(generator, `rt.random_int(${first}, ${last})`);
    };
    generator.est_steering_picker = block => [
        numberField(block, 'NUM'),
        orderOf(generator, 'ORDER_ATOMIC', 0)
    ];
    const portPicker = block => [
        quoteField(generator, block, 'PORT', 'A'),
        orderOf(generator, 'ORDER_ATOMIC', 0)
    ];
    generator.est_motor_port_picker = portPicker;
    generator.est_drive_port_picker = portPicker;
    generator.est_sensor_port_picker = block => [
        quoteField(generator, block, 'PORT', '1'),
        orderOf(generator, 'ORDER_ATOMIC', 0)
    ];
};

const registerMotorGenerators = generator => {
    generator.motor_run_for = block => {
        ensureRuntimeImport(generator);
        const port = valueOr(generator, block, 'PORT', quote(generator, 'A'));
        const direction = quoteField(generator, block, 'DIRECTION', 'clockwise');
        const amount = valueOr(generator, block, 'AMOUNT', '0');
        const unit = quoteField(generator, block, 'UNIT', 'rotations');
        return `rt.motor_run_for(${port}, ${direction}, ${amount}, ${unit})\n`;
    };
    generator.motor_start = block => {
        ensureRuntimeImport(generator);
        const port = valueOr(generator, block, 'PORT', quote(generator, 'A'));
        const direction = quoteField(generator, block, 'DIRECTION', 'clockwise');
        return `rt.motor_start(${port}, ${direction})\n`;
    };
    generator.motor_stop = block => {
        ensureRuntimeImport(generator);
        const port = valueOr(generator, block, 'PORT', quote(generator, 'A'));
        return `rt.motor_stop(${port})\n`;
    };
    generator.motor_set_speed = block => {
        ensureRuntimeImport(generator);
        const port = valueOr(generator, block, 'PORT', quote(generator, 'A'));
        const speed = valueOr(generator, block, 'SPEED', '0');
        return `rt.motor_set_speed(${port}, ${speed})\n`;
    };
    generator.motor_set_stop_action = block => {
        ensureRuntimeImport(generator);
        const port = valueOr(generator, block, 'PORT', quote(generator, 'A'));
        const action = quoteField(generator, block, 'STOP_ACTION', 'hold');
        return `rt.motor_set_stop_action(${port}, ${action})\n`;
    };
    generator.motor_run_for_speed = block => {
        ensureRuntimeImport(generator);
        const port = valueOr(generator, block, 'PORT', quote(generator, 'A'));
        const speed = valueOr(generator, block, 'SPEED', '0');
        const amount = valueOr(generator, block, 'AMOUNT', '0');
        const unit = quoteField(generator, block, 'UNIT', 'rotations');
        return `rt.motor_run_for(${port}, None, ${amount}, ${unit}, speed=${speed})\n`;
    };
    generator.motor_start_speed = block => {
        ensureRuntimeImport(generator);
        const port = valueOr(generator, block, 'PORT', quote(generator, 'A'));
        const speed = valueOr(generator, block, 'SPEED', '0');
        return `rt.motor_start_speed(${port}, ${speed})\n`;
    };
    generator.motor_start_power = block => {
        ensureRuntimeImport(generator);
        const port = valueOr(generator, block, 'PORT', quote(generator, 'A'));
        const power = valueOr(generator, block, 'POWER', '0');
        return `rt.motor_start_power(${port}, ${power})\n`;
    };
    generator.motor_reset_degrees = block => {
        ensureRuntimeImport(generator);
        const port = valueOr(generator, block, 'PORT', quote(generator, 'A'));
        return `rt.motor(${port}).reset_angle()\n`;
    };
    generator.motor_degrees = block => {
        ensureRuntimeImport(generator);
        const port = valueOr(generator, block, 'PORT', quote(generator, 'A'));
        return functionCall(generator, `rt.motor(${port}).angle()`);
    };
    generator.motor_speed = block => {
        ensureRuntimeImport(generator);
        const port = valueOr(generator, block, 'PORT', quote(generator, 'A'));
        return functionCall(generator, `rt.motor(${port}).speed()`);
    };
    generator.motor_stalled = block => {
        ensureRuntimeImport(generator);
        const port = doubleQuotedMotorPortLiteral(valueOr(generator, block, 'PORT', doubleQuote('A')));
        return functionCall(generator, `rt.motor_stalled(${port})`);
    };
};

const registerMovementGenerators = generator => {
    generator.drive_move_for = block => {
        ensureRuntimeImport(generator);
        const direction = quoteField(generator, block, 'DIRECTION', 'forward');
        const amount = valueOr(generator, block, 'AMOUNT', '0');
        const unit = quoteField(generator, block, 'UNIT', 'rotations');
        return `rt.drive_move_for(${direction}, ${amount}, ${unit})\n`;
    };
    generator.drive_steer_for = block => {
        ensureRuntimeImport(generator);
        const steering = valueOr(generator, block, 'STEERING', '0');
        const amount = valueOr(generator, block, 'AMOUNT', '0');
        const unit = quoteField(generator, block, 'UNIT', 'rotations');
        return `rt.drive_steer_for(${steering}, ${amount}, ${unit})\n`;
    };
    generator.drive_start_steer = block => {
        ensureRuntimeImport(generator);
        const steering = valueOr(generator, block, 'STEERING', '0');
        return `rt.drive_start_steer(${steering})\n`;
    };
    generator.drive_stop = () => {
        ensureRuntimeImport(generator);
        return 'rt.drive_stop()\n';
    };
    generator.drive_set_speed = block => {
        ensureRuntimeImport(generator);
        const speed = valueOr(generator, block, 'SPEED', '0');
        return `rt.drive_set_speed(${speed})\n`;
    };
    generator.drive_set_pair = block => {
        ensureRuntimeImport(generator);
        const leftPort = valueOr(generator, block, 'LEFT_PORT', quote(generator, 'B'));
        const rightPort = valueOr(generator, block, 'RIGHT_PORT', quote(generator, 'C'));
        return `rt.drive_set_pair(${leftPort}, ${rightPort})\n`;
    };
    generator.drive_set_stop_action = block => {
        ensureRuntimeImport(generator);
        const action = quoteField(generator, block, 'STOP_ACTION', 'hold');
        return `rt.drive_set_stop_action(${action})\n`;
    };
    generator.drive_steer_for_speed = block => {
        ensureRuntimeImport(generator);
        const steering = valueOr(generator, block, 'STEERING', '0');
        const amount = valueOr(generator, block, 'AMOUNT', '0');
        const unit = quoteField(generator, block, 'UNIT', 'rotations');
        const speed = valueOr(generator, block, 'SPEED', '0');
        return `rt.drive_steer_for(${steering}, ${amount}, ${unit}, speed=${speed})\n`;
    };
    generator.drive_dual_speed_for = block => {
        ensureRuntimeImport(generator);
        const leftSpeed = valueOr(generator, block, 'LEFT_SPEED', '0');
        const rightSpeed = valueOr(generator, block, 'RIGHT_SPEED', '0');
        const amount = valueOr(generator, block, 'AMOUNT', '0');
        const unit = quoteField(generator, block, 'UNIT', 'rotations');
        return `rt.drive_dual_speed_for(${leftSpeed}, ${rightSpeed}, ${amount}, ${unit})\n`;
    };
    generator.drive_start_steer_speed = block => {
        ensureRuntimeImport(generator);
        const steering = valueOr(generator, block, 'STEERING', '0');
        const speed = valueOr(generator, block, 'SPEED', '0');
        return `rt.drive_start_steer(${steering}, speed=${speed})\n`;
    };
    generator.drive_start_dual_speed = block => {
        ensureRuntimeImport(generator);
        const leftSpeed = valueOr(generator, block, 'LEFT_SPEED', '0');
        const rightSpeed = valueOr(generator, block, 'RIGHT_SPEED', '0');
        return `rt.drive_start_dual_speed(${leftSpeed}, ${rightSpeed})\n`;
    };
};

const registerDisplayGenerators = generator => {
    generator.display_image_for = block => {
        ensureRuntimeImport(generator);
        const image = quoteField(generator, block, 'IMAGE', 'Eyes/Neutral');
        const seconds = valueOr(generator, block, 'SECONDS', '0');
        return `rt.display_image_for(${image}, ${seconds})\n`;
    };
    generator.display_image = block => {
        ensureHardwareImport(generator);
        return `est.display.image(${quoteField(generator, block, 'IMAGE', 'Eyes/Neutral')})\n` +
            'est.display.refresh()\n';
    };
    generator.display_text_line = block => {
        ensureRuntimeImport(generator);
        const line = valueOr(generator, block, 'LINE', '1');
        const content = valueOr(generator, block, 'TEXT', quote(generator, ''));
        return `rt.display_text_line(${line}, ${content})\n`;
    };
    generator.display_text_xy = block => {
        ensureRuntimeImport(generator);
        const x = valueOr(generator, block, 'X', '0');
        const y = valueOr(generator, block, 'Y', '0');
        const content = valueOr(generator, block, 'TEXT', quote(generator, ''));
        const font = quoteField(generator, block, 'FONT', 'large_white');
        return `rt.display_text(${x}, ${y}, ${content}, font=${font})\n`;
    };
    generator.display_clear = () => {
        ensureHardwareImport(generator);
        return 'est.display.clear()\nest.display.refresh()\n';
    };
    generator.display_status_light = block => {
        ensureHardwareImport(generator);
        const modeName = fieldValue(block, 'STATUS_MODE', 'off');
        const mode = STATUS_LIGHT_CONSTANTS[modeName] || STATUS_LIGHT_CONSTANTS.off;
        return `est.led.set(${mode})\n`;
    };
};

const registerSoundGenerators = generator => {
    generator.sound_play_wait = block => {
        ensureHardwareImport(generator);
        const sound = quoteField(generator, block, 'SOUND', 'communication_hello');
        return `est.audio.play(${sound}, wait=True)\n`;
    };
    generator.sound_play = block => {
        ensureHardwareImport(generator);
        const sound = quoteField(generator, block, 'SOUND', 'communication_hello');
        return `est.audio.play(${sound}, wait=False)\n`;
    };
    generator.sound_beep_for = block => {
        ensureHardwareImport(generator);
        ensureRuntimeImport(generator);
        const note = valueOr(generator, block, 'NOTE', '60');
        const seconds = valueOr(generator, block, 'SECONDS', '0');
        return `est.audio.tone(${note}, rt.seconds_to_ms(${seconds}), wait=True)\n`;
    };
    generator.sound_beep = block => {
        ensureHardwareImport(generator);
        const note = valueOr(generator, block, 'NOTE', '60');
        return `est.audio.tone(${note})\n`;
    };
    generator.sound_stop_all = () => {
        ensureHardwareImport(generator);
        return 'est.audio.stop()\n';
    };
    generator.sound_set_volume = block => {
        ensureHardwareImport(generator);
        const volume = valueOr(generator, block, 'VOLUME', '100');
        return `est.audio.set_volume(${volume})\n`;
    };
};

const registerEventGenerators = generator => {
    generator.event_program_start = block => registerEventHat(generator, block, '@rt.on_start');
    generator.event_brick_button = block => {
        const button = quoteBrickButtonField(generator, block, 'BUTTON');
        const event = quoteField(generator, block, 'BUTTON_EVENT', 'pressed');
        return registerEventHat(generator, block, `@rt.on_brick_button(${button}, ${event})`);
    };
    generator.event_condition = block => {
        const condition = valueOr(generator, block, 'CONDITION', 'False');
        return registerEventHat(generator, block, `@rt.on_condition(lambda: ${condition})`);
    };
    generator.event_broadcast = block => {
        ensureRuntimeImport(generator);
        const message = quoteField(generator, block, 'MESSAGE', 'message_1');
        return `rt.broadcast(${message}, wait=False)\n`;
    };
    generator.event_broadcast_wait = block => {
        ensureRuntimeImport(generator);
        const message = quoteField(generator, block, 'MESSAGE', 'message_1');
        return `rt.broadcast(${message}, wait=True)\n`;
    };
    generator.event_timer = block => {
        const seconds = valueOr(generator, block, 'SECONDS', '10');
        return registerEventHat(generator, block, `@rt.on_timer_gt(${seconds})`);
    };
};

const registerControlGenerators = generator => {
    generator.control_wait_seconds = block => {
        ensureRuntimeImport(generator);
        return `rt.sleep(${valueOr(generator, block, 'SECONDS', '0')})\n`;
    };
    generator.control_wait_until = block => {
        ensureRuntimeImport(generator);
        const condition = valueOr(generator, block, 'CONDITION', 'False');
        return `rt.wait_until(lambda: ${condition})\n`;
    };
    generator.control_repeat = block => {
        ensureRuntimeImport(generator);
        const count = valueOr(generator, block, 'TIMES', '0');
        const body = statementOrPass(generator, block, 'SUBSTACK');
        return `for _ in range(rt.repeat_count(${count})):\n${body}${generator.INDENT}rt.yield_once()\n`;
    };
    generator.control_forever = block => {
        ensureRuntimeImport(generator);
        const body = statementOrPass(generator, block, 'SUBSTACK');
        return `while True:\n${body}${generator.INDENT}rt.yield_once()\n`;
    };
    generator.control_repeat_until = block => {
        ensureRuntimeImport(generator);
        const condition = valueOr(generator, block, 'CONDITION', 'False');
        const body = statementOrPass(generator, block, 'SUBSTACK');
        return `while not rt.boolean(${condition}):\n${body}${generator.INDENT}rt.yield_once()\n`;
    };
    generator.control_if = block => {
        ensureRuntimeImport(generator);
        const condition = valueOr(generator, block, 'CONDITION', 'False');
        return `if rt.boolean(${condition}):\n${statementOrPass(generator, block, 'SUBSTACK')}`;
    };
    generator.control_if_else = block => {
        ensureRuntimeImport(generator);
        const condition = valueOr(generator, block, 'CONDITION', 'False');
        const thenBody = statementOrPass(generator, block, 'SUBSTACK');
        const elseBody = statementOrPass(generator, block, 'SUBSTACK2');
        return `if rt.boolean(${condition}):\n${thenBody}else:\n${elseBody}`;
    };
    generator.control_stop_other_stacks = () => {
        ensureRuntimeImport(generator);
        return 'rt.stop_other_stacks()\n';
    };
    generator.control_stop = block => {
        ensureRuntimeImport(generator);
        const scope = normalizeStopScope(fieldValue(block, 'STOP_SCOPE', 'all'));
        if (scope === 'other_stacks') {
            return 'rt.stop_other_stacks()\n';
        }
        return `rt.stop(${quote(generator, scope)})\n`;
    };
};

const registerSensorGenerators = generator => {
    const sensorPort = (block, fallback) => valueOr(generator, block, 'PORT', quote(generator, fallback));
    const compareValue = block => valueOr(generator, block, 'VALUE', '0');
    const comparator = block => quoteField(generator, block, 'COMPARATOR', 'less');

    generator.sensor_brick_button_value = () => {
        ensureHardwareImport(generator);
        return functionCall(generator, 'est.buttons.value()');
    };
    generator.sensor_brick_button_pressed = block => {
        ensureHardwareImport(generator);
        const buttonName = normalizeBrickButtonName(fieldValue(block, 'BUTTON', 'confirm'));
        const button = BRICK_BUTTON_CONSTANTS[buttonName] || BRICK_BUTTON_CONSTANTS.confirm;
        if (buttonName === 'none') {
            return [
                `est.buttons.value() == ${button}`,
                orderOf(generator, 'ORDER_RELATIONAL', 11)
            ];
        }
        return functionCall(generator, `est.buttons.pressed(${button})`);
    };
    generator.sensor_wait_brick_button = block => {
        ensureRuntimeImport(generator);
        const button = quoteBrickButtonField(generator, block, 'BUTTON');
        const event = quoteField(generator, block, 'BUTTON_EVENT', 'pressed');
        return `rt.wait_brick_button(${button}, ${event})\n`;
    };
    generator.sensor_color_calibrate_reflection = block => {
        ensureRuntimeImport(generator);
        const option = quoteField(generator, block, 'CALIBRATION', 'minimum');
        return `rt.color_calibrate(${option}, ${compareValue(block)})\n`;
    };
    generator.sensor_color_reset_calibration = () => {
        ensureRuntimeImport(generator);
        return 'rt.color_reset_calibration()\n';
    };
    generator.sensor_color_reflection = block => {
        ensureRuntimeImport(generator);
        return functionCall(generator, `rt.color(${sensorPort(block, '3')}).reflection()`);
    };
    generator.sensor_color_reflection_compare = block => {
        ensureRuntimeImport(generator);
        const reading = `rt.color(${sensorPort(block, '3')}).reflection()`;
        return functionCall(generator, `rt.compare(${reading}, ${comparator(block)}, ${compareValue(block)})`);
    };
    generator.sensor_color_ambient = block => {
        ensureRuntimeImport(generator);
        return functionCall(generator, `rt.color(${sensorPort(block, '3')}).ambient()`);
    };
    generator.sensor_color_ambient_compare = block => {
        ensureRuntimeImport(generator);
        const reading = `rt.color(${sensorPort(block, '3')}).ambient()`;
        return functionCall(generator, `rt.compare(${reading}, ${comparator(block)}, ${compareValue(block)})`);
    };
    generator.sensor_color_value = block => {
        ensureRuntimeImport(generator);
        return functionCall(generator, `rt.color(${sensorPort(block, '3')}).color()`);
    };
    generator.sensor_color_is = block => {
        ensureRuntimeImport(generator);
        const color = fieldValue(block, 'COLOR', 'red');
        const colorId = Object.prototype.hasOwnProperty.call(COLOR_IDS, color) ? COLOR_IDS[color] : 0;
        const code = `rt.color(${sensorPort(block, '3')}).color() == ${colorId}`;
        return [code, orderOf(generator, 'ORDER_RELATIONAL', 11)];
    };
    generator.sensor_wait_color = block => {
        ensureRuntimeImport(generator);
        const event = quoteField(generator, block, 'COLOR_EVENT', 'red');
        return `rt.wait_color(${sensorPort(block, '3')}, ${event})\n`;
    };
    generator.sensor_temperature = block => {
        ensureRuntimeImport(generator);
        const unit = fieldValue(block, 'UNIT', 'celsius') === 'fahrenheit' ? 'fahrenheit' : 'celsius';
        return functionCall(generator, `rt.temperature(${sensorPort(block, '3')}).${unit}()`);
    };
    generator.sensor_touch_pressed = block => {
        ensureRuntimeImport(generator);
        return functionCall(generator, `rt.touch(${sensorPort(block, '1')}).pressed()`);
    };
    generator.sensor_wait_touch = block => {
        ensureRuntimeImport(generator);
        const event = quoteField(generator, block, 'TOUCH_EVENT', 'pressed');
        return `rt.wait_touch(${sensorPort(block, '1')}, ${event})\n`;
    };
    generator.sensor_ultrasonic_distance = block => {
        ensureRuntimeImport(generator);
        const unit = quoteField(generator, block, 'UNIT', 'centimeters');
        return functionCall(generator, `rt.ultrasonic(${sensorPort(block, '4')}).distance(${unit})`);
    };
    generator.sensor_ultrasonic_compare = block => {
        ensureRuntimeImport(generator);
        const unit = quoteField(generator, block, 'UNIT', 'centimeters');
        const reading = `rt.ultrasonic(${sensorPort(block, '4')}).distance(${unit})`;
        return functionCall(generator, `rt.compare(${reading}, ${comparator(block)}, ${compareValue(block)})`);
    };
    generator.sensor_wait_ultrasonic = block => {
        ensureRuntimeImport(generator);
        const unit = quoteField(generator, block, 'UNIT', 'centimeters');
        return `rt.wait_ultrasonic(${sensorPort(block, '4')}, ${comparator(block)}, ` +
            `${compareValue(block)}, ${unit})\n`;
    };
    generator.sensor_ir_proximity = block => {
        ensureRuntimeImport(generator);
        return functionCall(generator, `rt.infrared(${sensorPort(block, '4')}).proximity()`);
    };
    generator.sensor_ir_proximity_compare = block => {
        ensureRuntimeImport(generator);
        const reading = `rt.infrared(${sensorPort(block, '4')}).proximity()`;
        return functionCall(generator, `rt.compare(${reading}, ${comparator(block)}, ${compareValue(block)})`);
    };
    generator.sensor_wait_ir_proximity = block => {
        ensureRuntimeImport(generator);
        return `rt.wait_ir_proximity(${sensorPort(block, '4')}, ${comparator(block)}, ` +
            `${compareValue(block)})\n`;
    };
    generator.sensor_ir_beacon_heading = block => {
        ensureRuntimeImport(generator);
        const channel = infraredRemoteChannel();
        return functionCall(
            generator,
            `rt.infrared(${sensorPort(block, '4')}).beacon_heading(${channel})`
        );
    };
    generator.sensor_ir_beacon_proximity = block => {
        ensureRuntimeImport(generator);
        const channel = infraredRemoteChannel();
        return functionCall(
            generator,
            `rt.infrared(${sensorPort(block, '4')}).beacon_proximity(${channel})`
        );
    };
    generator.sensor_ir_beacon_buttons = block => {
        ensureRuntimeImport(generator);
        const channel = infraredRemoteChannel();
        return functionCall(
            generator,
            `rt.infrared(${sensorPort(block, '4')}).beacon_buttons(${channel})`
        );
    };
    generator.sensor_ir_beacon_button_pressed = block => {
        ensureRuntimeImport(generator);
        const channel = infraredRemoteChannel();
        const button = quoteField(generator, block, 'BEACON_BUTTON', 'none');
        return functionCall(
            generator,
            `rt.infrared(${sensorPort(block, '4')}).beacon_button_pressed(${channel}, ${button})`
        );
    };
    generator.sensor_wait_ir_beacon_button = block => {
        ensureRuntimeImport(generator);
        const channel = infraredRemoteChannel();
        const event = quoteField(generator, block, 'BEACON_EVENT', 'top_left_pressed');
        return `rt.wait_ir_beacon_button(${sensorPort(block, '4')}, ${channel}, ${event})\n`;
    };
    generator.sensor_ir_beacon_active = block => {
        ensureRuntimeImport(generator);
        const channel = infraredRemoteChannel();
        return functionCall(
            generator,
            `rt.infrared(${sensorPort(block, '4')}).beacon_active(${channel})`
        );
    };
    generator.sensor_ir_beacon_active_compare = block => {
        ensureRuntimeImport(generator);
        const channel = infraredRemoteChannel();
        const property = quoteField(generator, block, 'PROPERTY', 'heading');
        const code = `rt.ir_beacon_compare(${sensorPort(block, '4')}, ${channel}, ` +
            `${property}, ${comparator(block)}, ${compareValue(block)})`;
        return functionCall(generator, code);
    };
    generator.sensor_gyro_angle = block => {
        ensureRuntimeImport(generator);
        return functionCall(generator, `rt.gyro(${sensorPort(block, '2')}).angle()`);
    };
    generator.sensor_gyro_rate = block => {
        ensureRuntimeImport(generator);
        return functionCall(generator, `rt.gyro(${sensorPort(block, '2')}).speed()`);
    };
    generator.sensor_gyro_reset = block => {
        ensureRuntimeImport(generator);
        return `rt.gyro(${sensorPort(block, '2')}).reset_angle()\n`;
    };
    generator.sensor_gyro_compare = block => {
        ensureRuntimeImport(generator);
        const reading = `rt.gyro(${sensorPort(block, '2')}).angle()`;
        return functionCall(generator, `rt.compare(${reading}, ${comparator(block)}, ${compareValue(block)})`);
    };
    generator.sensor_wait_gyro = block => {
        ensureRuntimeImport(generator);
        return `rt.wait_gyro(${sensorPort(block, '2')}, ${comparator(block)}, ${compareValue(block)})\n`;
    };
    generator.sensor_timer = () => {
        ensureRuntimeImport(generator);
        return functionCall(generator, 'rt.timer_seconds()');
    };
    generator.sensor_timer_reset = () => {
        ensureRuntimeImport(generator);
        return 'rt.reset_timer()\n';
    };
};

export const registerEstPythonGenerator = ScratchBlocks => {
    if (!ScratchBlocks || !ScratchBlocks.Python) {
        throw new Error('OpenBlock Python generator is unavailable for EST registration.');
    }

    const generator = ScratchBlocks.Python;
    if (registeredGenerators.has(generator)) return;

    installEstPythonNameSanitizer(ScratchBlocks, generator);
    registerLifecycle(ScratchBlocks, generator);
    registerSupportGenerators(generator);
    registerMotorGenerators(generator);
    registerMovementGenerators(generator);
    registerDisplayGenerators(generator);
    registerSoundGenerators(generator);
    registerEventGenerators(generator);
    registerControlGenerators(generator);
    registerSensorGenerators(generator);
    registeredGenerators.add(generator);
};

export {stackNameForBlock};
