const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const path = require('path');
const babel = require('@babel/core');
const validateProject = require('scratch-parser');

const estRoots = [
    path.resolve(__dirname, '..', 'src', 'main', 'est'),
    path.resolve(__dirname, '..', 'src', 'renderer', 'est-blocks'),
    path.resolve(__dirname, '..', 'src', 'renderer', 'est-project')
];
const originalLoader = Module._extensions['.js'];
const originalSvgLoader = Module._extensions['.svg'];
Module._extensions['.svg'] = (module, filename) => {
    module.exports = filename;
};
Module._extensions['.js'] = (module, filename) => {
    if (!estRoots.some(estRoot => filename.startsWith(estRoot))) {
        return originalLoader(module, filename);
    }
    const source = fs.readFileSync(filename, 'utf8');
    const transformed = babel.transformSync(source, {
        babelrc: false,
        plugins: ['@babel/plugin-transform-modules-commonjs']
    });
    module._compile(transformed.code, filename);
};

const estRoot = estRoots[0];
const estBlocksRoot = estRoots[1];
const estProjectRoot = estRoots[2];

const {
    buildPersistentProgramLoadFrame,
    buildPersistentProgramSaveFrame,
    buildPersistentProgramStatusFrame,
    buildPythonProgramBeginFrame,
    buildPythonProgramChunkFrame,
    buildPythonProgramClearFrame,
    buildPythonProgramRunFrame,
    buildPythonProgramStatusFrame,
    buildPythonProgramStopFrame,
    buildFrame,
    checkDeviceCompatibility,
    checksum,
    crc32,
    isEstDevice,
    parseDeviceStatusResponse,
    parseFrame,
    parseHeartbeatResponse,
    parsePersistentProgramResponse,
    parsePythonProgramResponse,
    splitReports
} = require(path.join(estRoot, 'protocol.js'));
const {
    CAPABILITY_MOTOR_CONTROL,
    CAPABILITY_MOTOR_PAIR_POSITION,
    COMMAND_DEVICE_STATUS,
    COMMAND_PERSISTENT_PROGRAM,
    COMMAND_PYTHON_PROGRAM
} = require(path.join(estRoot, 'constants.js'));
const {EstDeviceService} = require(path.join(estRoot, 'device-service.js'));
const {
    ALL_EST_BLOCK_IDS,
    CATEGORY_BLOCK_IDS,
    CATEGORY_COLOURS,
    DRIVE_COLOURS,
    EST_STEERING_DIAL_COLOURS,
    EST_STEERING_FIELD_TYPE,
    EST_STEERING_LIMIT,
    EST_STEERING_PICKER_ID,
    EST_DRIVE_PORT_PICKER_ID,
    EST_EVENT_SENSOR_PORT_PICKER_ID,
    EST_MOTOR_PORT_PICKER_ID,
    EST_REPLACED_OPENBLOCK_BLOCK_IDS,
    EST_SUPPORT_BLOCK_IDS,
    MOTOR_COLOURS,
    configureEstWorkspaceControls,
    isSteeringDialMarkVisible,
    registerEstBlocks
} = require(path.join(estBlocksRoot, 'definitions.js'));
const getEstToolboxCategories = require(path.join(estBlocksRoot, 'toolbox.js')).default;
const EstMotorBlocks = require(path.join(estBlocksRoot, 'runtime.js'));
const {
    createEstDefaultProjectData,
    EMPTY_COSTUME_ASSET_ID,
    default: createEstDefaultProjectAssets
} = require(path.join(estProjectRoot, 'default-project.js'));
const {
    registerEstPythonGenerator,
    stackNameForBlock
} = require(path.join(estBlocksRoot, 'python-generator.js'));

const OPENBLOCK_NATIVE_OPERATOR_IDS = [
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
];

const heartbeatRequest = buildFrame(0x01);
assert.deepStrictEqual(Array.from(heartbeatRequest), [0x68, 0x11, 0x01, 0x00, 0x00, 0x7a, 0x16]);

const heartbeatPayload = Buffer.from('M0.72A', 'ascii');
const heartbeatResponse = new Uint8Array(13);
heartbeatResponse.set([0x68, 0x21, 0x01, 0x06, 0x00], 0);
heartbeatResponse.set(heartbeatPayload, 5);
heartbeatResponse[11] = checksum(heartbeatResponse.slice(0, 11));
heartbeatResponse[12] = 0x16;
assert.strictEqual(parseHeartbeatResponse(heartbeatResponse), 'M0.72A');
assert.strictEqual(parseFrame(heartbeatResponse, 0x19), null);

// Golden vector copied from EST重构/tools/est_hid_sender/tests/test_protocol.py.
// Keeping this byte-for-byte vector in both projects prevents the JS and Python
// protocol implementations from silently drifting apart.
const deviceStatusResponse = Uint8Array.from(Buffer.from(
    '682119480001004d302e35324104041204f00aac063f00000040e2010000000c000000' +
    '01285901000001e238feffff020015030000021d0201050002100001010002060001eb' +
    '000000000000005916',
    'hex'
));
const deviceStatus = parseDeviceStatusResponse(deviceStatusResponse);
assert.ok(deviceStatus);
assert.deepStrictEqual(Array.from(buildFrame(COMMAND_DEVICE_STATUS)), [0x68, 0x11, 0x19, 0, 0, 0x92, 0x16]);
assert.strictEqual(deviceStatus.firmwareVersion, 'M0.52A');
assert.deepStrictEqual([deviceStatus.protocolMajor, deviceStatus.protocolMinor], [1, 0]);
assert.deepStrictEqual([deviceStatus.motorPortCount, deviceStatus.sensorPortCount], [4, 4]);
assert.strictEqual(deviceStatus.keyMask, 0x12);
assert.deepStrictEqual(
    [deviceStatus.batteryLevel, deviceStatus.batteryAdcRaw, deviceStatus.batterySampleMv],
    [4, 2800, 1708]
);
assert.strictEqual(deviceStatus.capabilities, 0x3f);
assert.strictEqual(deviceStatus.uptimeMs, 123456);
assert.deepStrictEqual(deviceStatus.motors[1], {outputState: 1, powerPercent: 40, tachoCount: 345});
assert.deepStrictEqual(deviceStatus.motors[2], {outputState: 1, powerPercent: -30, tachoCount: -456});
assert.deepStrictEqual(deviceStatus.sensors[0], {
    state: 2,
    sensorType: 0x1d,
    mode: 2,
    valueValid: true,
    value: 5
});
assert.strictEqual(deviceStatus.sensors[2].value, 235);

const damagedStatusResponse = Uint8Array.from(deviceStatusResponse);
damagedStatusResponse[77] ^= 0xff;
assert.strictEqual(parseDeviceStatusResponse(damagedStatusResponse), null);

const oldProtocolCompatibility = checkDeviceCompatibility(deviceStatus);
assert.strictEqual(oldProtocolCompatibility.compatible, false);
assert.match(oldProtocolCompatibility.message, /requires 1\.19 or newer/);

const supportedStatus = {...deviceStatus, protocolMinor: 19};
assert.strictEqual(checkDeviceCompatibility(supportedStatus).compatible, true);
assert.strictEqual(
    checkDeviceCompatibility(supportedStatus, CAPABILITY_MOTOR_CONTROL).compatible,
    true
);
const missingPairControl = checkDeviceCompatibility(supportedStatus, CAPABILITY_MOTOR_PAIR_POSITION);
assert.strictEqual(missingPairControl.compatible, false);
assert.strictEqual(missingPairControl.missingCapabilities, CAPABILITY_MOTOR_PAIR_POSITION);

const pythonSource = Buffer.from('import est\nest._program_result(12345)\n', 'utf8');
const pythonSourceCrc32 = crc32(pythonSource);
assert.strictEqual(pythonSourceCrc32, 0xd93ce997);
assert.deepStrictEqual(
    Array.from(buildPythonProgramBeginFrame(pythonSource.length, pythonSourceCrc32)),
    Array.from(buildFrame(COMMAND_PYTHON_PROGRAM, Uint8Array.from([
        1,
        pythonSource.length & 0xff,
        pythonSource.length >> 8,
        pythonSourceCrc32 & 0xff,
        (pythonSourceCrc32 >>> 8) & 0xff,
        (pythonSourceCrc32 >>> 16) & 0xff,
        (pythonSourceCrc32 >>> 24) & 0xff
    ])))
);
assert.deepStrictEqual(
    Array.from(buildPythonProgramChunkFrame(0, pythonSource)),
    Array.from(buildFrame(
        COMMAND_PYTHON_PROGRAM,
        Uint8Array.from([2, 0, 0, ...pythonSource])
    ))
);
assert.deepStrictEqual(
    Array.from(buildPythonProgramRunFrame(2000)),
    Array.from(buildFrame(COMMAND_PYTHON_PROGRAM, Uint8Array.from([3, 0xd0, 0x07, 0, 0])))
);
assert.deepStrictEqual(
    Array.from(buildPythonProgramStatusFrame()),
    Array.from(buildFrame(COMMAND_PYTHON_PROGRAM, Uint8Array.from([0])))
);
assert.deepStrictEqual(
    Array.from(buildPythonProgramStopFrame()),
    Array.from(buildFrame(COMMAND_PYTHON_PROGRAM, Uint8Array.from([4])))
);
assert.deepStrictEqual(
    Array.from(buildPythonProgramClearFrame()),
    Array.from(buildFrame(COMMAND_PYTHON_PROGRAM, Uint8Array.from([5])))
);
assert.deepStrictEqual(
    Array.from(buildPersistentProgramStatusFrame(3)),
    Array.from(buildFrame(COMMAND_PERSISTENT_PROGRAM, Uint8Array.from([0, 3])))
);
assert.deepStrictEqual(
    Array.from(buildPersistentProgramSaveFrame(3, '巡线')),
    Array.from(buildFrame(
        COMMAND_PERSISTENT_PROGRAM,
        Uint8Array.from([1, 3, 6, ...Buffer.from('巡线', 'utf8')])
    ))
);
assert.deepStrictEqual(
    Array.from(buildPersistentProgramLoadFrame(3)),
    Array.from(buildFrame(COMMAND_PERSISTENT_PROGRAM, Uint8Array.from([2, 3])))
);
assert.throws(() => buildPersistentProgramStatusFrame(8), /0\.\.7/);
assert.throws(() => buildPersistentProgramSaveFrame(0, 'x'.repeat(32)), /1\.\.31/);

const registeredBlockDefinitions = [];
const definitionsPresentBeforeEstRegistration = [];
const registeredFields = {};
const FakeFieldTextInput = function () {};
FakeFieldTextInput.htmlInput_ = null;
const FakeFieldAngle = function (value) {
    this.value = value;
};
FakeFieldAngle.HALF = 60;
FakeFieldAngle.OFFSET = 90;
FakeFieldAngle.RADIUS = 47;
FakeFieldAngle.CLOCKWISE = true;
FakeFieldAngle.prototype = {};
const fakeScratchBlocks = {
    Blocks: Object.fromEntries(EST_REPLACED_OPENBLOCK_BLOCK_IDS.map(blockId => [
        blockId,
        {legacyOpenBlockDefinition: true}
    ])),
    Colours: {
        textField: '#FFFFFF'
    },
    Field: {
        register: (type, fieldClass) => {
            registeredFields[type] = fieldClass;
        }
    },
    FieldAngle: FakeFieldAngle,
    FieldTextInput: FakeFieldTextInput,
    OUTPUT_SHAPE_HEXAGONAL: 1,
    OUTPUT_SHAPE_ROUND: 2,
    defineBlocksWithJsonArray: definitions => {
        registeredBlockDefinitions.push(...definitions);
        definitions.forEach(definition => {
            if (Object.prototype.hasOwnProperty.call(fakeScratchBlocks.Blocks, definition.type)) {
                definitionsPresentBeforeEstRegistration.push(definition.type);
            }
            fakeScratchBlocks.Blocks[definition.type] = definition;
        });
    }
};
registerEstBlocks(fakeScratchBlocks);
registerEstBlocks(fakeScratchBlocks);
let openBlockZoomPositionCalls = 0;
let openBlockZoomCreateDomCalls = 0;
let touchIdentifierClearCalls = 0;
const historyActions = [];
const makeFakeSvgControl = attributes => ({
    attributes: {...attributes},
    getAttribute: name => attributes[name],
    setAttribute: (name, value) => {
        attributes[name] = value;
    },
    setAttributeNS: (namespace, name, value) => {
        attributes[name] = value;
    }
});
let zoomTransform = '';
const fakeZoomGroup = {
    controls: [],
    querySelectorAll: selector => (selector === 'image' ? fakeZoomGroup.controls : []),
    setAttribute: (name, value) => {
        if (name === 'transform') {
            zoomTransform = value;
        }
    }
};
const FakeZoomControls = function () {};
FakeZoomControls.prototype.WIDTH_ = 36;
FakeZoomControls.prototype.HEIGHT_ = 124;
FakeZoomControls.prototype.MARGIN_BETWEEN_ = 8;
FakeZoomControls.prototype.createDom = function () {
    openBlockZoomCreateDomCalls += 1;
    this.svgGroup_ = fakeZoomGroup;
    fakeZoomGroup.controls = [44, 0, 88].map(y => makeFakeSvgControl({y}));
    return this.svgGroup_;
};
FakeZoomControls.prototype.position = function () {
    openBlockZoomPositionCalls += 1;
    this.left_ = 800;
};
const fakeZoomScratchBlocks = {
    bindEventWithChecks_: (control, eventName, thisObject, handler) => {
        control[eventName] = handler;
    },
    Touch: {
        clearTouchIdentifier: () => {
            touchIdentifierClearCalls += 1;
        }
    },
    TOOLBOX_AT_BOTTOM: 3,
    ZoomControls: FakeZoomControls,
    utils: {
        createSvgElement: (tagName, attributes, parent) => {
            const control = makeFakeSvgControl(attributes);
            parent.controls.push(control);
            return control;
        }
    }
};
configureEstWorkspaceControls(fakeZoomScratchBlocks);
configureEstWorkspaceControls(fakeZoomScratchBlocks);
const fakeZoomControls = new FakeZoomControls();
fakeZoomControls.workspace_ = {
    markFocused: () => {},
    getMetrics: () => ({
        absoluteTop: 20,
        flyoutHeight: 0,
        toolboxPosition: 1,
        viewHeight: 600
    }),
    undo: redo => historyActions.push(redo)
};
const configuredZoomGroup = fakeZoomControls.createDom();
assert.strictEqual(openBlockZoomCreateDomCalls, 1);
assert.strictEqual(configuredZoomGroup.controls.length, 5);
assert.deepStrictEqual(
    configuredZoomGroup.controls.map(control => Number(control.getAttribute('y'))).sort((a, b) => a - b),
    [0, 44, 88, 132, 176]
);
const stopPropagation = () => {};
const preventDefault = () => {};
configuredZoomGroup.controls[3].mousedown({stopPropagation, preventDefault});
configuredZoomGroup.controls[4].mousedown({stopPropagation, preventDefault});
assert.deepStrictEqual(historyActions, [false, true]);
assert.strictEqual(touchIdentifierClearCalls, 2);
fakeZoomControls.position();
assert.strictEqual(openBlockZoomPositionCalls, 1);
assert.strictEqual(fakeZoomControls.HEIGHT_, 212);
assert.strictEqual(fakeZoomControls.top_, 214);
assert.strictEqual(zoomTransform, 'translate(800,214)');
const expectedCategoryCounts = {
    motor: 11,
    movement: 11,
    display: 6,
    sound: 6,
    event: 13,
    control: 9,
    sensing: 34
};
assert.deepStrictEqual(
    Object.fromEntries(Object.entries(CATEGORY_BLOCK_IDS).map(([categoryId, blockIds]) => [
        categoryId,
        blockIds.length
    ])),
    expectedCategoryCounts
);
assert.strictEqual(registeredBlockDefinitions.length, 94);
assert.strictEqual(new Set(ALL_EST_BLOCK_IDS).size, 90);
assert.deepStrictEqual(EST_REPLACED_OPENBLOCK_BLOCK_IDS, [
    'sound_play',
    'event_broadcast',
    'control_wait_until',
    'control_repeat',
    'control_forever',
    'control_repeat_until',
    'control_if',
    'control_if_else',
    'control_stop'
]);
assert.deepStrictEqual(definitionsPresentBeforeEstRegistration, []);
EST_REPLACED_OPENBLOCK_BLOCK_IDS.forEach(blockId => {
    assert.ok(!Object.prototype.hasOwnProperty.call(
        fakeScratchBlocks.Blocks[blockId],
        'legacyOpenBlockDefinition'
    ));
});
assert.deepStrictEqual(
    registeredBlockDefinitions.slice(EST_SUPPORT_BLOCK_IDS.length).map(definition => definition.type),
    ALL_EST_BLOCK_IDS
);
assert.strictEqual(registeredBlockDefinitions[0].type, EST_STEERING_PICKER_ID);
assert.strictEqual(registeredBlockDefinitions[0].args0[0].type, EST_STEERING_FIELD_TYPE);
assert.strictEqual(registeredBlockDefinitions[0].colour, '#FFFFFF');
assert.strictEqual(registeredBlockDefinitions[0].colourSecondary, '#FFFFFF');
assert.strictEqual(registeredBlockDefinitions[0].colourTertiary, '#FFFFFF');
assert.deepStrictEqual(EST_SUPPORT_BLOCK_IDS, [
    EST_STEERING_PICKER_ID,
    EST_MOTOR_PORT_PICKER_ID,
    EST_DRIVE_PORT_PICKER_ID,
    EST_EVENT_SENSOR_PORT_PICKER_ID
]);
const motorPortPickerDefinition = registeredBlockDefinitions.find(
    definition => definition.type === EST_MOTOR_PORT_PICKER_ID
);
const drivePortPickerDefinition = registeredBlockDefinitions.find(
    definition => definition.type === EST_DRIVE_PORT_PICKER_ID
);
assert.strictEqual(motorPortPickerDefinition.colour, MOTOR_COLOURS.secondary);
assert.strictEqual(drivePortPickerDefinition.colour, DRIVE_COLOURS.secondary);
assert.deepStrictEqual(
    motorPortPickerDefinition.args0[0].options.map(option => option[1]),
    ['A', 'B', 'C', 'D']
);
const eventSensorPortPickerDefinition = registeredBlockDefinitions.find(
    definition => definition.type === EST_EVENT_SENSOR_PORT_PICKER_ID
);
assert.strictEqual(eventSensorPortPickerDefinition.colour, CATEGORY_COLOURS.event.secondary);
assert.strictEqual(eventSensorPortPickerDefinition.colourSecondary, CATEGORY_COLOURS.event.secondary);
assert.strictEqual(eventSensorPortPickerDefinition.colourTertiary, CATEGORY_COLOURS.event.tertiary);
assert.deepStrictEqual(
    eventSensorPortPickerDefinition.args0[0].options.map(option => option[1]),
    ['1', '2', '3', '4']
);
assert.strictEqual(EST_STEERING_LIMIT, 100);
assert.deepStrictEqual(EST_STEERING_DIAL_COLOURS, {
    fill: '#d8009b',
    stroke: '#a9007a',
    detail: '#FFFFFF'
});
assert.strictEqual(isSteeringDialMarkVisible(0), true);
assert.strictEqual(isSteeringDialMarkVisible(90), false);
assert.strictEqual(isSteeringDialMarkVisible(165), false);
assert.strictEqual(isSteeringDialMarkVisible(180), true);
assert.strictEqual(isSteeringDialMarkVisible(270), true);
assert.strictEqual(isSteeringDialMarkVisible(345), true);
assert.strictEqual(typeof registeredFields[EST_STEERING_FIELD_TYPE], 'function');
const steeringField = new registeredFields[EST_STEERING_FIELD_TYPE](0);
assert.strictEqual(steeringField.classValidator('-120'), '-100');
assert.strictEqual(steeringField.classValidator('43.6'), '44');
assert.strictEqual(steeringField.classValidator('150'), '100');
assert.strictEqual(steeringField.classValidator('not-a-number'), null);
const styleForBlock = blockId => Object.entries(CATEGORY_BLOCK_IDS)
    .find(([, blockIds]) => blockIds.includes(blockId))[0];
registeredBlockDefinitions.slice(EST_SUPPORT_BLOCK_IDS.length).forEach(definition => {
    const style = styleForBlock(definition.type);
    assert.strictEqual(definition.colour, CATEGORY_COLOURS[style].primary);
    assert.strictEqual(definition.colourSecondary, CATEGORY_COLOURS[style].secondary);
    assert.strictEqual(definition.colourTertiary, CATEGORY_COLOURS[style].tertiary);
});
assert.deepStrictEqual(MOTOR_COLOURS, {
    primary: '#0090F5',
    secondary: '#0078CC',
    tertiary: '#005FA0'
});
assert.deepStrictEqual(DRIVE_COLOURS, {
    primary: '#fb59ce',
    secondary: '#d8009b',
    tertiary: '#a9007a'
});
const motorRunForDefinition = registeredBlockDefinitions.find(
    definition => definition.type === 'motor_run_for'
);
assert.strictEqual(motorRunForDefinition.args0[0].type, 'input_value');
assert.deepStrictEqual(
    motorRunForDefinition.args0[1].options.map(option => option[1]),
    ['clockwise', 'counterclockwise']
);
assert.deepStrictEqual(
    motorRunForDefinition.args0[3].options.map(option => option[1]),
    ['rotations', 'degrees', 'seconds']
);
const driveMoveForDefinition = registeredBlockDefinitions.find(
    definition => definition.type === 'drive_move_for'
);
assert.deepStrictEqual(
    driveMoveForDefinition.args0[0].options.map(option => option[1]),
    ['forward', 'backward']
);
assert.deepStrictEqual(
    driveMoveForDefinition.args0[2].options.map(option => option[1]),
    ['rotations', 'degrees', 'seconds']
);
const driveSetPairDefinition = registeredBlockDefinitions.find(
    definition => definition.type === 'drive_set_pair'
);
driveSetPairDefinition.args0.forEach(portArgument => {
    assert.strictEqual(portArgument.type, 'input_value');
});
[
    'event_color',
    'event_touch',
    'event_ultrasonic',
    'event_ir_proximity',
    'event_ir_beacon_button',
    'event_gyro_angle'
].forEach(blockId => {
    const definition = registeredBlockDefinitions.find(item => item.type === blockId);
    assert.strictEqual(definition.args0[0].type, 'input_value');
});
const eventColorDefinition = registeredBlockDefinitions.find(item => item.type === 'event_color');
assert.strictEqual(eventColorDefinition.args0[1].type, 'field_dropdown');
const eventUltrasonicDefinition = registeredBlockDefinitions.find(
    item => item.type === 'event_ultrasonic'
);
assert.strictEqual(eventUltrasonicDefinition.args0[1].type, 'field_dropdown');
assert.strictEqual(eventUltrasonicDefinition.args0[2].type, 'input_value');
assert.strictEqual(eventUltrasonicDefinition.args0[3].type, 'field_dropdown');
const eventBrickButtonDefinition = registeredBlockDefinitions.find(
    item => item.type === 'event_brick_button'
);
eventBrickButtonDefinition.args0.forEach(argument => {
    assert.strictEqual(argument.type, 'field_dropdown');
});
['event_broadcast_received', 'event_broadcast', 'event_broadcast_wait'].forEach(blockId => {
    const definition = registeredBlockDefinitions.find(item => item.type === blockId);
    assert.strictEqual(definition.args0[0].type, 'field_dropdown');
});
const estToolboxCategories = getEstToolboxCategories();
['电机', '移动', '显示', '声音', '事件', '控制', '传感器']
    .forEach(categoryName => {
        assert.match(estToolboxCategories, new RegExp(`<category[^>]*name="${categoryName}"`, 's'));
    });
assert.match(estToolboxCategories, /<category[^>]*name="%\{BKY_CATEGORY_OPERATORS\}"/s);
assert.strictEqual((estToolboxCategories.match(/<category/g) || []).length, 8);
ALL_EST_BLOCK_IDS.forEach(blockId => {
    assert.ok(estToolboxCategories.includes(`<block type="${blockId}"`));
});
OPENBLOCK_NATIVE_OPERATOR_IDS.forEach(blockId => {
    assert.ok(estToolboxCategories.includes(`<block type="${blockId}"`), blockId);
});
['operator_less_than', 'operator_greater_than', 'operator_math'].forEach(blockId => {
    assert.ok(!estToolboxCategories.includes(`<block type="${blockId}"`), blockId);
});
assert.match(
    estToolboxCategories,
    /<category[^>]*id="operators"[^>]*colour="#40BF4A"[^>]*secondaryColour="#389438"/s
);
assert.match(
    estToolboxCategories,
    /<block type="operator_add">[\s\S]*?<value name="NUM1">[\s\S]*?<value name="NUM2">/
);
assert.match(
    estToolboxCategories,
    /<block type="operator_gt">[\s\S]*?<value name="OPERAND1">[\s\S]*?<value name="OPERAND2">/
);
assert.match(
    estToolboxCategories,
    /<block type="operator_join">[\s\S]*?<value name="STRING1">[\s\S]*?<value name="STRING2">/
);
assert.match(
    estToolboxCategories,
    /<block type="operator_letter_of">[\s\S]*?<shadow type="math_whole_number">/
);
assert.match(estToolboxCategories, /<field name="NUM">75<\/field>/);
assert.match(estToolboxCategories, /<field name="NUM">100<\/field>/);
assert.match(estToolboxCategories, /<field name="NUM">50<\/field>/);
assert.match(estToolboxCategories, /<value name="LEFT_PORT">[\s\S]*?<field name="PORT">B<\/field>/);
assert.match(estToolboxCategories, /<value name="RIGHT_PORT">[\s\S]*?<field name="PORT">C<\/field>/);
assert.match(estToolboxCategories, /<field name="PORT">3<\/field>/);
assert.match(estToolboxCategories, /<field name="PORT">4<\/field>/);
assert.match(estToolboxCategories, /<field name="TEXT">EST<\/field>/);
assert.match(
    estToolboxCategories,
    /<block type="drive_steer_for">[\s\S]*?<shadow type="est_steering_picker">/
);
assert.match(
    estToolboxCategories,
    /<block type="drive_start_steer">[\s\S]*?<shadow type="est_steering_picker">/
);
assert.strictEqual((estToolboxCategories.match(/<shadow type="est_motor_port_picker">/g) || []).length, 11);
assert.strictEqual((estToolboxCategories.match(/<shadow type="est_drive_port_picker">/g) || []).length, 2);
assert.strictEqual((estToolboxCategories.match(/<shadow type="est_event_sensor_port_picker">/g) || []).length, 6);
assert.strictEqual((estToolboxCategories.match(/<shadow type="est_event_/g) || []).length, 6);
assert.ok(!estToolboxCategories.includes('data_variable'));
assert.ok(!estToolboxCategories.includes('procedure_definition'));
assert.strictEqual(typeof fakeScratchBlocks.Blocks.data_variable, 'undefined');
assert.strictEqual(typeof fakeScratchBlocks.Blocks.procedure_definition, 'undefined');

const nativeDataVariableGenerator = () => ['speed', 0];
const nativeListGenerator = () => ['items', 0];
const nativeProcedureGenerator = () => 'run_module()\n';
const nativeOperatorGenerators = Object.fromEntries(OPENBLOCK_NATIVE_OPERATOR_IDS.map(blockId => [
    blockId,
    () => [blockId, 0]
]));
const fakePythonGenerator = {
    INDENT: '  ',
    ORDER_ATOMIC: 0,
    ORDER_FUNCTION_CALL: 2.2,
    ORDER_MULTIPLICATIVE: 5,
    ORDER_ADDITIVE: 6,
    ORDER_RELATIONAL: 11,
    ORDER_LOGICAL_NOT: 12,
    ORDER_LOGICAL_AND: 13,
    ORDER_LOGICAL_OR: 14,
    ORDER_NONE: 99,
    data_variable: nativeDataVariableGenerator,
    data_listcontents: nativeListGenerator,
    procedures_call: nativeProcedureGenerator,
    init () {
        this.imports_ = {};
        this.libraries_ = {};
        this.setups_ = {};
        this.variables_ = {0: 'speed = 0'};
    },
    quote_: value => `'${String(value)}'`,
    valueToCode: (blockValue, name) => (blockValue.values && blockValue.values[name]) || '',
    statementToCode: (blockValue, name) => (
        (blockValue.statements && blockValue.statements[name]) || ''
    ),
    scrub_: (blockValue, code) => `${code}${blockValue.nextCode || ''}`
};
Object.assign(fakePythonGenerator, nativeOperatorGenerators);
const fakeGeneratorScratchBlocks = {Python: fakePythonGenerator};
registerEstPythonGenerator(fakeGeneratorScratchBlocks);
registerEstPythonGenerator(fakeGeneratorScratchBlocks);
assert.strictEqual(fakePythonGenerator.data_variable, nativeDataVariableGenerator);
assert.strictEqual(fakePythonGenerator.data_listcontents, nativeListGenerator);
assert.strictEqual(fakePythonGenerator.procedures_call, nativeProcedureGenerator);
OPENBLOCK_NATIVE_OPERATOR_IDS.forEach(blockId => {
    assert.strictEqual(fakePythonGenerator[blockId], nativeOperatorGenerators[blockId], blockId);
});

const makeFakeBlock = (type, options = {}) => ({
    type,
    id: options.id || `${type}-test`,
    values: options.values || {},
    statements: options.statements || {},
    nextCode: options.nextCode || '',
    getFieldValue: name => (options.fields || {})[name],
    nextConnection: {
        targetBlock: () => options.nextBlock || null
    }
});

fakePythonGenerator.init({getTopBlocks: () => []});
ALL_EST_BLOCK_IDS.forEach((blockId, index) => {
    assert.strictEqual(typeof fakePythonGenerator[blockId], 'function', blockId);
    const definition = registeredBlockDefinitions.find(item => item.type === blockId);
    const output = fakePythonGenerator[blockId](makeFakeBlock(blockId, {
        id: `${blockId}-${index}`
    }));
    if (definition.output) {
        assert.ok(Array.isArray(output), `${blockId} must generate a Python expression`);
    } else if (definition.extensions && definition.extensions.includes('shape_hat')) {
        assert.strictEqual(output, null, `${blockId} must register a Python event function`);
    } else {
        assert.strictEqual(typeof output, 'string', `${blockId} must generate a Python statement`);
    }
});
EST_SUPPORT_BLOCK_IDS.forEach(blockId => {
    assert.strictEqual(typeof fakePythonGenerator[blockId], 'function', blockId);
});

assert.deepStrictEqual(fakePythonGenerator.est_motor_port_picker({
    getFieldValue: () => 'C'
}), ["'C'", 0]);

const programStartBlock = makeFakeBlock('event_program_start', {
    id: 'start$1',
    nextBlock: {type: 'motor_run_for'}
});
const timerBlock = makeFakeBlock('event_timer', {
    id: 'timer$1',
    values: {SECONDS: '10'}
});
fakePythonGenerator.init({getTopBlocks: () => [programStartBlock, timerBlock]});

const motorRunPython = fakePythonGenerator.motor_run_for(makeFakeBlock('motor_run_for', {
    values: {PORT: "'B'", AMOUNT: '2'},
    fields: {DIRECTION: 'clockwise', UNIT: 'rotations'}
}));
const motorStopPython = fakePythonGenerator.motor_stop(makeFakeBlock('motor_stop', {
    values: {PORT: "'B'"}
}));
assert.strictEqual(
    motorRunPython,
    "rt.motor_run_for('B', 'clockwise', 2, 'rotations')\n"
);
assert.strictEqual(motorStopPython, "rt.motor_stop('B')\n");

programStartBlock.nextCode = `${fakePythonGenerator.INDENT}${motorRunPython}` +
    `${fakePythonGenerator.INDENT}${motorStopPython}`;
assert.strictEqual(stackNameForBlock(programStartBlock, fakePythonGenerator), 'stack_1');
assert.strictEqual(fakePythonGenerator.event_program_start(programStartBlock), null);
assert.strictEqual(fakePythonGenerator.event_timer(timerBlock), null);
assert.strictEqual(fakePythonGenerator.imports_.estRuntime, 'import est_runtime as rt');
assert.strictEqual(fakePythonGenerator.setups_.estRun, 'rt.run()');
assert.strictEqual(
    fakePythonGenerator.libraries_.est_stack_1,
    `@rt.on_start\ndef stack_1():\n` +
        `  global speed\n` +
        `  rt.motor_run_for('B', 'clockwise', 2, 'rotations')\n` +
        `  rt.motor_stop('B')\n`
);
assert.strictEqual(
    fakePythonGenerator.libraries_.est_stack_2,
    `@rt.on_timer_gt(10)\ndef stack_2():\n` +
        `  global speed\n` +
        `  pass\n`
);

assert.strictEqual(fakePythonGenerator.drive_dual_speed_for(makeFakeBlock('drive_dual_speed_for', {
    values: {LEFT_SPEED: '30', RIGHT_SPEED: '40', AMOUNT: '2'},
    fields: {UNIT: 'seconds'}
})), "rt.drive_dual_speed_for(30, 40, 2, 'seconds')\n");
assert.strictEqual(fakePythonGenerator.display_text_line(makeFakeBlock('display_text_line', {
    values: {LINE: '2', TEXT: "'EST'"}
})), "est.display.text_line(2, 'EST')\n");
assert.strictEqual(fakePythonGenerator.sound_beep_for(makeFakeBlock('sound_beep_for', {
    values: {NOTE: '60', SECONDS: '1'}
})), 'est.audio.tone(60, rt.seconds_to_ms(1), wait=True)\n');
const estDefaultProjectData = createEstDefaultProjectData();
assert.strictEqual(estDefaultProjectData.targets.length, 2);
assert.strictEqual(estDefaultProjectData.targets[0].isStage, true);
assert.strictEqual(estDefaultProjectData.targets[1].isStage, false);
for (const target of estDefaultProjectData.targets) {
    assert.strictEqual(target.costumes.length, 1);
    assert.strictEqual(target.costumes[0].assetId, EMPTY_COSTUME_ASSET_ID);
    assert.deepStrictEqual(target.sounds, []);
}
const estDefaultProjectAssets = createEstDefaultProjectAssets();
assert.strictEqual(estDefaultProjectAssets.length, 2);
assert.deepStrictEqual(JSON.parse(estDefaultProjectAssets[0].data), estDefaultProjectData);
assert.strictEqual(estDefaultProjectAssets[1].id, EMPTY_COSTUME_ASSET_ID);
assert.strictEqual(fakePythonGenerator.control_if(makeFakeBlock('control_if', {
    values: {CONDITION: 'ready'},
    statements: {SUBSTACK: '  rt.drive_stop()\n'}
})), 'if rt.boolean(ready):\n  rt.drive_stop()\n');
assert.deepStrictEqual(fakePythonGenerator.sensor_ultrasonic_compare(
    makeFakeBlock('sensor_ultrasonic_compare', {
        values: {VALUE: '15'},
        fields: {PORT: '4', COMPARATOR: 'less', UNIT: 'centimeters'}
    })
), ["rt.compare(rt.ultrasonic('4').distance('centimeters'), 'less', 15)", 2.2]);
const blocksLoader = require('./est-blocks-loader');
const transformedBlocks = blocksLoader('before\n    return ScratchBlocks;\nafter');
assert.ok(transformedBlocks.indexOf('registerEstBlocks(ScratchBlocks);') <
    transformedBlocks.indexOf('return ScratchBlocks;'));
assert.ok(transformedBlocks.indexOf('registerEstPythonGenerator(ScratchBlocks);') <
    transformedBlocks.indexOf('return ScratchBlocks;'));
assert.match(transformedBlocks, /from 'est-python-generator'/);
const toolboxLoader = require('./est-toolbox-loader');
const transformedToolbox = toolboxLoader(
    "import {eventBlock} from './libraries/devices/index.jsx';\n" +
    "before\n    return everything.join('\\n');\nafter"
);
assert.match(transformedToolbox, /getEstToolboxCategories\(\), gap, variablesXML, gap, myBlocksXML/);
assert.ok(!transformedToolbox.includes('eventBlock'));
const codeGeneratorLoader = require('./est-code-generator-loader');
const defaultLanguageSource = "before\n    return 'null';\nafter";
const transformedCodeGenerator = codeGeneratorLoader.call({
    resourcePath: '/node_modules/openblock-gui/src/lib/code-generator.js'
}, defaultLanguageSource);
const transformedDeviceLanguage = codeGeneratorLoader.call({
    resourcePath: '/node_modules/openblock-gui/src/lib/device.js'
}, defaultLanguageSource);
assert.match(transformedCodeGenerator, /return 'Python'/);
assert.match(transformedDeviceLanguage, /return 'python'/);
const pythonGeneratorHeaderLoader = require('./est-python-generator-header-loader');
const pythonGeneratorWithHeader = 'before var output="# generated by OpenBlock\\n"; after';
const pythonGeneratorWithoutHeader = pythonGeneratorHeaderLoader(pythonGeneratorWithHeader);
assert.ok(!pythonGeneratorWithoutHeader.includes('# generated by OpenBlock'));
assert.strictEqual(pythonGeneratorWithoutHeader, 'before var output=""; after');
const menuBarLoader = require('./est-menu-bar-loader');
const menuBarSource = `import CommunityButton from './community-button.jsx'; // eslint-disable-line no-unused-vars
    handleClickOpenCommunity () {
        window.open('https://community.openblock.cc');
    }
before
                    <div
                        className={classNames(styles.menuBarItem,
                            this.props.isRealtimeMode ? styles.hoverable : styles.disabled,
                            {[styles.active]: this.props.editMenuOpen
                            })}
                    >
                        <span>Edit</span>
                    </div>
                    <Divider className={classNames(styles.divider)} />
                    <div
                        className={classNames(styles.menuBarItem, styles.hoverable)}
                        onMouseUp={this.handleSelectDeviceMouseUp}
                    >
                        <span>No device selected</span>
                    </div>
                    <Divider className={classNames(styles.divider)} />
                    <div
                        className={classNames(styles.menuBarItem, styles.hoverable)}
                        onMouseUp={this.handleConnectionMouseUp}
                    >
                        connection
                    </div>
                    {/* <div legacy /> */}
                    <div
                        aria-label={this.props.intl.formatMessage(ariaMessages.wiki)}
                    >
                        wiki
                    </div>
                    <div onClick={this.props.onOpenTipLibrary}>
                        tutorials
                    </div>
                    <div onMouseUp={this.handleScreenshot}>
                        screenshot
                    </div>
                    <div onMouseUp={this.handleUploadFirmware}>
                        firmware
                    </div>
                    <Divider className={classNames(styles.divider)} />
                    <div className={classNames(styles.menuBarItem, styles.programModeGroup)}>
                        <Switch />
                    </div>
                                <MenuSection>
                                    <MenuItem onClick={this.handleCheckUpdate}>
                                        check update
                                    </MenuItem>
                                    <MenuItem
                                        isRtl={this.props.isRtl}
                                        onClick={this.handleClearCache}
                                    >
                                        clear cache
                                    </MenuItem>
                                </MenuSection>
                                <MenuSection>
                                    <MenuItem
                                        isRtl={this.props.isRtl}
                                        onClick={this.props.onClickInstallDriver}
                                    >
                                        install driver
                                    </MenuItem>
                                </MenuSection>
after
                title: PropTypes.string, // text for the menu item`;
const transformedMenuBar = menuBarLoader(menuBarSource);
assert.ok(!transformedMenuBar.includes('handleSelectDeviceMouseUp'));
assert.ok(!transformedMenuBar.includes('styles.programModeGroup'));
assert.ok(!transformedMenuBar.includes('this.props.editMenuOpen'));
assert.ok(!transformedMenuBar.includes('ariaMessages.wiki'));
assert.ok(!transformedMenuBar.includes('this.props.onOpenTipLibrary'));
assert.ok(!transformedMenuBar.includes('this.handleScreenshot'));
assert.ok(!transformedMenuBar.includes('this.handleUploadFirmware'));
assert.ok(!transformedMenuBar.includes('this.handleClearCache'));
assert.ok(!transformedMenuBar.includes('this.props.onClickInstallDriver'));
assert.ok(!transformedMenuBar.includes('CommunityButton'));
assert.ok(!transformedMenuBar.includes('community.openblock.cc'));
assert.ok(transformedMenuBar.includes('this.handleCheckUpdate'));
assert.match(transformedMenuBar, /<EstStatusPanel \/>/);
assert.match(transformedMenuBar, /title: PropTypes\.node, \/\/ rendered menu label/);
const openBlockMenuBarSource = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'node_modules',
    'openblock-gui',
    'src',
    'components',
    'menu-bar',
    'menu-bar.jsx'
), 'utf8');
const transformedFullMenuBar = menuBarLoader(openBlockMenuBarSource);
babel.transformSync(transformedFullMenuBar, {
    babelrc: false,
    presets: ['@babel/preset-react']
});
for (const removedOnlineToken of [
    'ShareButton',
    'SaveStatus',
    'ProjectWatcher',
    'AuthorInfo',
    'AccountNav',
    'LoginDropdown',
    'collectMetadata',
    'autoUpdateProject',
    'manualUpdateProject',
    'remixProject',
    'saveProjectAsCopy',
    'onProjectTelemetryEvent'
]) {
    assert.ok(!transformedFullMenuBar.includes(removedOnlineToken));
}
for (const removedHardwareMenuToken of [
    'saveSvgAsPng',
    'handleConnectionMouseUp',
    'handleSelectDeviceMouseUp',
    'handleProgramModeSwitchOnChange',
    'handleProgramModeUpdate',
    'handleUploadFirmware',
    'handleScreenshot',
    'PERIPHERAL_DISCONNECTED',
    'PROGRAM_MODE_UPDATE',
    'openConnectionModal',
    'openDeviceLibrary',
    'setRealtimeMode',
    'setRealtimeConnection',
    'uploadFirmwareIcon'
]) {
    assert.ok(!transformedFullMenuBar.includes(removedHardwareMenuToken));
}
for (const removedObsoleteMenuToken of [
    'accountMenuOpen',
    'authorId',
    'authorThumbnailUrl',
    'authorUsername',
    'canCreateCopy',
    'canEditTitle',
    'canRemix',
    'canShare',
    'enableCommunity',
    'isShared',
    'renderLogin',
    'showComingSoon',
    'onClickAccount',
    'onClickClearCache',
    'onClickInstallDriver',
    'onLogOut',
    'onOpenRegistration',
    'onSeeCommunity',
    'onShare',
    'onToggleLoginOpen'
]) {
    assert.ok(!transformedFullMenuBar.includes(removedObsoleteMenuToken));
}
assert.match(transformedFullMenuBar, /<ProjectTitleInput/);
assert.match(transformedFullMenuBar, /<SB3Downloader>/);
assert.match(transformedFullMenuBar, /requestNewProject/);
assert.match(transformedFullMenuBar, /<EstStatusPanel \/>/);
assert.match(transformedFullMenuBar, /handleCheckUpdate/);
const hardwareWorkspaceLoader = require('./est-hardware-workspace-loader');
const openBlockHardwareSource = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'node_modules',
    'openblock-gui',
    'src',
    'components',
    'hardware',
    'hardware.jsx'
), 'utf8');
const transformedHardwareWorkspace = hardwareWorkspaceLoader(openBlockHardwareSource);
assert.strictEqual(transformedHardwareWorkspace, "export {default} from 'est-code-drawer';\n");
const estCodeDrawerSource = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'src',
    'renderer',
    'EstCodeDrawer.jsx'
), 'utf8');
assert.match(estCodeDrawerSource, /handleToggle/);
assert.match(estCodeDrawerSource, /handleResizeStart/);
assert.match(estCodeDrawerSource, /handleResizeMove/);
assert.match(estCodeDrawerSource, /estStudio\.pythonCodeDrawerWidth/);
assert.match(estCodeDrawerSource, /isOpen: false/);
assert.ok(!estCodeDrawerSource.includes('pythonCodeDrawerOpen'));
assert.match(estCodeDrawerSource, /<CodeEditor/);
assert.ok(!estCodeDrawerSource.includes('HardwareConsole'));
const guiCleanupLoader = require('./est-gui-cleanup-loader');
const openBlockGuiSource = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'node_modules',
    'openblock-gui',
    'src',
    'components',
    'gui',
    'gui.jsx'
), 'utf8');
const transformedGui = guiCleanupLoader(openBlockGuiSource);
babel.transformSync(transformedGui, {
    babelrc: false,
    presets: ['@babel/preset-react']
});
assert.match(transformedGui, /<Blocks/);
assert.match(transformedGui, /<Hardware/);
assert.ok(!transformedGui.includes('<HardwareHeader'));
assert.match(transformedGui, /<UploadProgress/);
assert.match(transformedGui, /import EstProgramControls from 'est-program-controls'/);
assert.match(transformedGui, /<EstProgramControls \/>/);
const estProgramControlsSource = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'src',
    'renderer',
    'EstProgramControls.jsx'
), 'utf8');
assert.match(estProgramControlsSource, /SLOT_OPTIONS = \[0, 1, 2, 3, 4, 5, 6, 7\]/);
assert.match(estProgramControlsSource, /download: 'est-download-program'/);
assert.match(estProgramControlsSource, /run: 'est-run-program'/);
assert.match(estProgramControlsSource, /stop: 'est-stop-program'/);
assert.match(estProgramControlsSource, /state\.scratchGui\.code\.codeEditorValue/);
assert.match(estProgramControlsSource, /data-action="stop"/);
assert.ok(!estProgramControlsSource.includes('data-action="pause"'));
assert.match(estProgramControlsSource, /PROGRAM_SLOT_CHANGE_EVENT/);
const estProgramMainSource = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'src',
    'main',
    'index.js'
), 'utf8');
assert.match(estProgramMainSource, /ipcMain\.handle\('est-download-program'/);
assert.match(estProgramMainSource, /ipcMain\.handle\('est-run-program'/);
assert.match(estProgramMainSource, /ipcMain\.handle\('est-stop-program'/);
assert.ok(!transformedGui.includes('<CostumeTab'));
assert.ok(!transformedGui.includes('<SoundTab'));
assert.ok(!transformedGui.includes('<StageWrapper'));
assert.ok(!transformedGui.includes('<TargetPane'));
assert.ok(transformedGui.includes('styles.extensionButtonContainer'));
assert.ok(transformedGui.includes('onClick={onExtensionButtonClick}'));
assert.ok(transformedGui.includes('src={addExtensionIcon}'));
assert.ok(!transformedGui.includes('<TipsLibrary'));
assert.ok(!transformedGui.includes('<Cards'));
assert.ok(!transformedGui.includes('<ConnectionModal'));
assert.ok(!transformedGui.includes('<TelemetryModal'));
assert.ok(!transformedGui.includes('<CostumeLibrary'));
assert.ok(!transformedGui.includes('<BackdropLibrary'));
assert.ok(!transformedGui.includes('onProjectTelemetryEvent={onProjectTelemetryEvent}'));
for (const removedMenuPassThrough of [
    'accountNavOpen',
    'authorId',
    'authorThumbnailUrl',
    'authorUsername',
    'canCreateCopy',
    'canEditTitle',
    'canRemix',
    'canShare',
    'enableCommunity',
    'isShared',
    'renderLogin',
    'showComingSoon',
    'onClickAccountNav',
    'onCloseAccountNav',
    'onLogOut',
    'onOpenRegistration',
    'onSeeCommunity',
    'onShare',
    'onToggleLoginOpen',
    'onClickClearCache',
    'onClickInstallDriver'
]) {
    assert.ok(!transformedGui.includes(`${removedMenuPassThrough}={${removedMenuPassThrough}}`));
}
const guiContainerLoader = require('./est-gui-container-loader');
const openBlockGuiContainerSource = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'node_modules',
    'openblock-gui',
    'src',
    'containers',
    'gui.jsx'
), 'utf8');
const transformedGuiContainer = guiContainerLoader(openBlockGuiContainerSource);
babel.transformSync(transformedGuiContainer, {
    babelrc: false,
    presets: ['@babel/preset-react']
});
assert.ok(!transformedGuiContainer.includes('ProjectSaverHOC'));
assert.ok(!transformedGuiContainer.includes('cloudManagerHOC'));
assert.ok(!transformedGuiContainer.includes('QueryParserHOC'));
for (const removedGuiContainerToken of [
    'COSTUMES_TAB_INDEX',
    'SOUNDS_TAB_INDEX',
    'closeBackdropLibrary',
    'closeCostumeLibrary',
    'closeTelemetryModal',
    'backdropLibraryVisible',
    'cardsVisible',
    'connectionModalVisible',
    'costumeLibraryVisible',
    'costumesTabVisible',
    'isPlayerOnly',
    'soundsTabVisible',
    'targetIsStage',
    'telemetryModalVisible',
    'tipsLibraryVisible'
]) {
    assert.ok(!transformedGuiContainer.includes(removedGuiContainerToken));
}
assert.match(transformedGuiContainer, /ProjectFetcherHOC/);
assert.match(transformedGuiContainer, /SBFileUploaderHOC/);
assert.match(transformedGuiContainer, /openExtensionLibrary/);
const desktopGuiHocSource = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'src',
    'renderer',
    'ScratchDesktopGUIHOC.jsx'
), 'utf8');
assert.ok(!desktopGuiHocSource.includes('onShowPrivacyPolicy={showPrivacyPolicy}'));
assert.ok(!desktopGuiHocSource.includes('\n                canEditTitle\n'));
const appStateLoader = require('./est-app-state-loader');
const openBlockAppStateSource = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'node_modules',
    'openblock-gui',
    'src',
    'lib',
    'app-state-hoc.jsx'
), 'utf8');
const transformedAppState = appStateLoader(openBlockAppStateSource);
babel.transformSync(transformedAppState, {
    babelrc: false,
    presets: ['@babel/preset-react']
});
assert.ok(!transformedAppState.includes("require('scratch-paint')"));
assert.ok(!transformedAppState.includes('scratchPaint: ScratchPaintReducer'));
assert.ok(!transformedAppState.includes('componentDidUpdate (prevProps)'));
assert.match(transformedAppState, /scratchGui: guiReducer/);
const estRendererAppSource = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'src',
    'renderer',
    'app.jsx'
), 'utf8');
assert.match(estRendererAppSource, /openblock-gui\/src\/containers\/gui\.jsx/);
assert.ok(!estRendererAppSource.includes('openblock-gui/src/index'));
const localProjectFetcherLoader = require('./est-local-project-fetcher-loader');
const openBlockProjectFetcherSource = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'node_modules',
    'openblock-gui',
    'src',
    'lib',
    'project-fetcher-hoc.jsx'
), 'utf8');
const transformedProjectFetcher = localProjectFetcherLoader(openBlockProjectFetcherSource);
assert.ok(!transformedProjectFetcher.includes('assets.scratch.mit.edu'));
assert.ok(!transformedProjectFetcher.includes('projects.scratch.mit.edu'));
assert.match(transformedProjectFetcher, /String\(projectId\) !== '0'/);
assert.match(transformedProjectFetcher, /return storage/);
assert.match(transformedProjectFetcher, /intl,\n {16}isCreatingNew,\n {16}isLoadingProject/);
const projectFileLoader = require('./est-project-file-loader');
const projectFileSources = {
    downloader: path.resolve(
        __dirname,
        '..',
        'node_modules',
        'openblock-gui',
        'src',
        'containers',
        'sb3-downloader.jsx'
    ),
    titled: path.resolve(
        __dirname,
        '..',
        'node_modules',
        'openblock-gui',
        'src',
        'lib',
        'titled-hoc.jsx'
    ),
    uploader: path.resolve(
        __dirname,
        '..',
        'node_modules',
        'openblock-gui',
        'src',
        'lib',
        'sb-file-uploader-hoc.jsx'
    )
};
const transformedProjectFileSources = Object.fromEntries(
    Object.entries(projectFileSources).map(([sourceId, sourcePath]) => [
        sourceId,
        projectFileLoader.call({resourcePath: sourcePath}, fs.readFileSync(sourcePath, 'utf8'))
    ])
);
for (const transformedProjectFileSource of Object.values(transformedProjectFileSources)) {
    babel.transformSync(transformedProjectFileSource, {
        babelrc: false,
        presets: ['@babel/preset-react']
    });
}
assert.match(transformedProjectFileSources.downloader, /\.ests`/);
assert.match(transformedProjectFileSources.downloader, /defaultTitle \|\| 'EST Studio Project'/);
assert.ok(!transformedProjectFileSources.downloader.includes('.ob`;'));
assert.match(transformedProjectFileSources.uploader, /accept = '\.ests'/);
assert.match(transformedProjectFileSources.uploader, /\/\^\(\.\*\)\\\.ests\$\/i/);
assert.ok(!transformedProjectFileSources.uploader.includes("accept = '.ob,.sb,.sb2,.sb3'"));
assert.match(transformedProjectFileSources.titled, /DEFAULT_PROJECT_TITLE = 'EST Studio Project'/);
assert.match(transformedProjectFileSources.titled, /newTitle = DEFAULT_PROJECT_TITLE/);
assert.ok(!transformedProjectFileSources.titled.includes('EST作品'));
assert.ok(!transformedProjectFileSources.titled.includes('EST專案'));
assert.strictEqual('示例工程.ests'.match(/^(.*)\.ests$/i)[1], '示例工程');
const fileFiltersSource = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'src',
    'main',
    'FileFilters.js'
), 'utf8');
assert.match(fileFiltersSource, /name: 'EST Studio Project'/);
assert.match(fileFiltersSource, /extensions: \['ests'\]/);
const electronBuilderSource = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'electron-builder.yaml'
), 'utf8');
assert.match(electronBuilderSource, /fileAssociations:\r?\n {2}ext: ests/);
const alertsLoader = require('./est-alerts-loader');
const openBlockAlertsSource = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'node_modules',
    'openblock-gui',
    'src',
    'lib',
    'alerts',
    'index.jsx'
), 'utf8');
const transformedAlerts = alertsLoader(openBlockAlertsSource);
for (const removedAlertId of [
    'createSuccess',
    'createCopySuccess',
    'createRemixSuccess',
    'creating',
    'creatingCopy',
    'creatingRemix',
    'creatingError',
    'savingError',
    'saveSuccess',
    'saving',
    'cloudInfo'
]) {
    assert.ok(!transformedAlerts.includes(`alertId: '${removedAlertId}'`));
}
for (const retainedAlertId of [
    'importingAsset',
    'uploadError',
    'uploadSuccess',
    'codeEditorIsLocked',
    'codeEditorIsUnlocked'
]) {
    assert.ok(transformedAlerts.includes(`alertId: '${retainedAlertId}'`));
}
const tutorialDecksLoader = require('./est-tutorial-decks-loader');
const tutorialDecksSource = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'node_modules',
    'openblock-gui',
    'src',
    'lib',
    'libraries',
    'decks',
    'index.jsx'
), 'utf8');
assert.strictEqual(tutorialDecksLoader(tutorialDecksSource), 'export default {};\n');
const extensionLibraryLoader = require('./est-extension-library-loader');
const openBlockExtensionLibrarySource = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'node_modules',
    'openblock-gui',
    'src',
    'lib',
    'libraries',
    'extensions',
    'index.jsx'
), 'utf8');
assert.strictEqual(
    extensionLibraryLoader(openBlockExtensionLibrarySource),
    "export {default} from 'est-extension-library';\n"
);
const defaultProjectLoader = require('./est-default-project-loader');
const openBlockDefaultProjectSource = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'node_modules',
    'openblock-gui',
    'src',
    'lib',
    'default-project',
    'index.js'
), 'utf8');
assert.strictEqual(
    defaultProjectLoader(openBlockDefaultProjectSource),
    "export {default} from 'est-default-project';\n"
);
const extensionManagerLoader = require('./est-extension-manager-loader');
const openBlockExtensionManagerSource = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'node_modules',
    'openblock-vm',
    'src',
    'extension-support',
    'extension-manager.js'
), 'utf8');
const transformedExtensionManager = extensionManagerLoader(openBlockExtensionManagerSource);
assert.match(transformedExtensionManager, /const builtinExtensions = \{\};/);
assert.match(transformedExtensionManager, /const builtinDevices = \{\};/);
assert.match(transformedExtensionManager, /estExtensionLibrary\.map/);
assert.doesNotMatch(transformedExtensionManager, /fetch\(`\$\{localResourcesServerUrl\}extensions\//);
assert.ok(!transformedExtensionManager.includes('scratch3_music'));
assert.ok(!transformedExtensionManager.includes('devices/arduinoUno'));
const headlessCostumeLoader = require('./est-headless-costume-loader');
const openBlockLoadCostumeSource = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'node_modules',
    'openblock-vm',
    'src',
    'import',
    'load-costume.js'
), 'utf8');
const transformedLoadCostume = headlessCostumeLoader(openBlockLoadCostumeSource);
assert.ok(!transformedLoadCostume.includes("log.error('No rendering module present; cannot load costume: '"));
assert.match(transformedLoadCostume, /EST Studio intentionally runs without a stage renderer/);
const vmProjectCompatLoader = require('./est-vm-project-compat-loader');
const openBlockVirtualMachineSource = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'node_modules',
    'openblock-vm',
    'src',
    'virtual-machine.js'
), 'utf8');
const transformedVirtualMachine = vmProjectCompatLoader(openBlockVirtualMachineSource);
assert.ok(!transformedVirtualMachine.includes("require('text-encoding')"));
assert.ok(!transformedVirtualMachine.includes("require('scratch-sb1-converter')"));
assert.match(transformedVirtualMachine, /const _TextEncoder = TextEncoder;/);
assert.match(transformedVirtualMachine, /const validate = require\('scratch-parser'\);/);
assert.match(transformedVirtualMachine, /this\.deserializeProject\(validatedInput\[0\], validatedInput\[1\]\)/);
const vmManagerLoader = require('./est-vm-manager-loader');
const openBlockVmManagerSource = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'node_modules',
    'openblock-gui',
    'src',
    'lib',
    'vm-manager-hoc.jsx'
), 'utf8');
const transformedVmManager = vmManagerLoader(openBlockVmManagerSource);
assert.ok(!transformedVmManager.includes("from 'scratch-audio'"));
assert.ok(!transformedVmManager.includes('new AudioEngine()'));
assert.ok(!transformedVmManager.includes('attachAudioEngine'));
assert.match(transformedVmManager, /this\.props\.vm\.setCompatibilityMode\(true\)/);
assert.match(transformedVmManager, /this\.props\.vm\.setLocale/);
assert.match(transformedVmManager, /this\.props\.vm\.start\(\)/);
const desktopGuiSource = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'src',
    'renderer',
    'ScratchDesktopGUIHOC.jsx'
), 'utf8');
assert.ok(!desktopGuiSource.includes('getDeviceList'));
assert.ok(!desktopGuiSource.includes('makeDeviceLibrary'));
assert.ok(!desktopGuiSource.includes('dataSettings'));
assert.ok(!desktopGuiSource.includes('initialAnalytics'));
assert.ok(!desktopGuiSource.includes('ElectronStorageHelper'));
assert.match(desktopGuiSource, /onStorageInit=\{ignoreStorageInit\}/);
const rendererAppSource = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'renderer', 'app.jsx'), 'utf8');
assert.ok(!rendererAppSource.includes('ScratchDesktopAppStateHOC'));
const mainProcessSource = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'main', 'index.js'), 'utf8');
assert.ok(!mainProcessSource.includes('OpenblockDesktopTelemetry'));
assert.ok(!mainProcessSource.includes("send('setUserId'"));
assert.ok(!mainProcessSource.includes("ipcMain.on('clearCache'"));
assert.ok(!mainProcessSource.includes("ipcMain.on('installDriver'"));
assert.ok(!mainProcessSource.includes('DesktopLink'));
assert.ok(!mainProcessSource.includes('desktopLink'));
assert.ok(!mainProcessSource.includes('host-resolver-rules'));
assert.ok(!mainProcessSource.includes('device-manager.scratch.mit.edu'));
assert.ok(!fs.existsSync(path.resolve(
    __dirname,
    '..',
    'src',
    'main',
    'OpenblockDesktopLink.js'
)));
const packageConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'));
assert.strictEqual(typeof packageConfig.dependencies['openblock-link'], 'undefined');
assert.strictEqual(typeof packageConfig.scripts['fetch:firmwares'], 'undefined');
assert.strictEqual(typeof packageConfig.scripts['fetch:tools'], 'undefined');
assert.strictEqual(typeof packageConfig.scripts['fetch:static'], 'undefined');
assert.strictEqual(typeof packageConfig.scripts['fetch:all'], 'undefined');
assert.ok(!packageConfig.scripts.clean.includes('tools'));
assert.ok(!packageConfig.scripts.clean.includes('firmwares'));
assert.ok(!packageConfig.scripts.clean.includes('static'));
assert.ok(!packageConfig.scripts.dist.includes('fetch:all'));
assert.ok(!packageConfig.scripts.publish.includes('fetch:all'));
const electronBuilderConfig = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'electron-builder.yaml'
), 'utf8');
assert.match(
    electronBuilderConfig,
    /extraFiles: \['LICENSE', 'LICENSE\.ScratchFoundation', 'TRADEMARK'\]/
);
assert.ok(!electronBuilderConfig.includes('"tools"'));
assert.ok(!electronBuilderConfig.includes("'firmwares'"));
assert.ok(!electronBuilderConfig.includes('from: static'));
const rendererWebpackConfig = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'webpack.renderer.js'
), 'utf8');
assert.ok(!rendererWebpackConfig.includes("to: 'static/libraries'"));
const sharedWebpackConfig = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'webpack.makeConfig.js'
), 'utf8');
assert.match(sharedWebpackConfig, /languages: \['python'\]/);
assert.ok(!sharedWebpackConfig.includes("languages: ['c', 'cpp', 'python', 'lua', 'javascript']"));
assert.ok(!fs.existsSync(path.resolve(__dirname, 'fetchMediaLibraryAssets.js')));
assert.ok(!fs.existsSync(path.resolve(__dirname, 'lib', 'libraries.js')));
assert.ok(!fs.existsSync(path.resolve(__dirname, '..', 'src', 'common', 'ElectronStorageHelper.js')));
assert.strictEqual(typeof packageConfig.devDependencies.async, 'undefined');
assert.strictEqual(typeof packageConfig.devDependencies['@aws-sdk/client-s3'], 'undefined');
assert.strictEqual(typeof packageConfig.devDependencies['download-github-release'], 'undefined');
assert.strictEqual(typeof packageConfig.devDependencies.nets, 'undefined');
assert.strictEqual(typeof packageConfig.devDependencies['node-abort-controller'], 'undefined');
assert.strictEqual(typeof packageConfig.devDependencies['sudo-prompt'], 'undefined');
const deviceDataLoader = require('./est-device-data-loader');
const vmListenerSource = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'node_modules',
    'openblock-gui',
    'src',
    'lib',
    'vm-listener-hoc.jsx'
), 'utf8');
const transformedVmListener = deviceDataLoader(vmListenerSource);
assert.ok(!transformedVmListener.includes('makeDeviceLibrary'));
assert.ok(!transformedVmListener.includes('extensionManager.getDeviceList()'));
assert.match(transformedVmListener, /this\.props\.onSetDeviceData\(\[\]\);/);
const updaterSource = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'src',
    'main',
    'OpenblockDesktopUpdater.js'
), 'utf8');
assert.ok(!updaterSource.includes('_resourceServer'));
assert.ok(!updaterSource.includes('resourceUpdating'));
assert.match(updaterSource, /autoUpdater\.checkForUpdates\(\)/);
const programModeLoader = require('./est-program-mode-loader');
const transformedProgramMode = programModeLoader(`const initialState = {
    isRealtimeMode: true,
    isSupportSwitchMode: false
};
case SET_UPLOAD_MODE:
        return Object.assign({}, state, {
            isRealtimeMode: false
        });
case SET_REALTIME_MODE:
        return Object.assign({}, state, {
            isRealtimeMode: true
        });
case SET_SUPPORT_SWITCH_MODE:
        return Object.assign({}, state, {
            isSupportSwitchMode: action.state
        });`);
assert.ok(!transformedProgramMode.includes('isRealtimeMode: true'));
assert.match(transformedProgramMode, /const initialState = \{\s*isRealtimeMode: false,/);
assert.ok(!transformedProgramMode.includes('isSupportSwitchMode: action.state'));
const nativeEditorsLoader = require('./openblock-native-editors-loader');
const transformNativeEditor = (resourcePath, source) => nativeEditorsLoader.call({resourcePath}, source);
const transformedPromptComponent = transformNativeEditor(
    '/node_modules/openblock-gui/src/components/prompt/prompt.jsx',
    `const PromptComponent = props => (
    <Modal
        className={styles.modalContent}
    >
        <input
                    defaultValue={props.defaultValue}
        />
    </Modal>
);
PromptComponent.propTypes = {
    defaultValue: PropTypes.string,
};`
);
assert.match(transformedPromptComponent, /id="variablePrompt"/);
assert.match(transformedPromptComponent, /value=\{props\.value\}/);
assert.match(transformedPromptComponent, /value: PropTypes\.string\.isRequired/);
const transformedPromptContainer = transformNativeEditor(
    '/node_modules/openblock-gui/src/containers/prompt.jsx',
    `this.state = {
            inputValue: '',
};
this.props.onOk(this.state.inputValue, {
            scope: this.state.globalSelected ? 'global' : 'local',
            isCloud: this.state.cloudSelected
});
return <PromptComponent
                defaultValue={this.props.defaultValue}
                showVariableOptions={this.props.showVariableOptions}
/>;`
);
assert.match(transformedPromptContainer, /inputValue: props\.defaultValue \|\| ''/);
assert.match(transformedPromptContainer, /value=\{this\.state\.inputValue\}/);
assert.match(transformedPromptContainer, /showVariableOptions=\{false\}/);
assert.match(transformedPromptContainer, /scope: 'global'/);
assert.match(transformedPromptContainer, /isCloud: false/);
assert.doesNotMatch(transformedPromptContainer, /scope: this\.state\.globalSelected/);
const transformedCustomProcedures = transformNativeEditor(
    '/node_modules/openblock-gui/src/components/custom-procedures/custom-procedures.jsx',
    `const CustomProcedures = props => (
    <Modal
        className={styles.modalContent}
    >
                <div
                    className={styles.optionCard}
                    role="button"
                    tabIndex="0"
                    onClick={props.onAddNumber}
                >number</div>
                <div
                    className={styles.optionCard}
                    role="button"
                    tabIndex="0"
                    onClick={props.onAddText}
                >text</div>
                <div
                    className={styles.optionCard}
                    role="button"
                    tabIndex="0"
                    onClick={props.onAddBoolean}
                >boolean</div>
                <div
                    className={styles.optionCard}
                    role="button"
                    tabIndex="0"
                    onClick={props.onAddLabel}
                >label</div>
            <div className={styles.checkboxRow}>
                <input
                    checked={props.warp}
                    type="checkbox"
                    onChange={props.onToggleWarp}
                />
            </div>
            <Box className={styles.buttonRow}>buttons</Box>
    </Modal>
);`
);
assert.match(transformedCustomProcedures, /id="customProcedures"/);
assert.match(transformedCustomProcedures, /onClick=\{props\.onAddNumber\}/);
assert.doesNotMatch(transformedCustomProcedures, /onClick=\{props\.onAddText\}/);
assert.match(transformedCustomProcedures, /onClick=\{props\.onAddBoolean\}/);
assert.match(transformedCustomProcedures, /onClick=\{props\.onAddLabel\}/);
assert.doesNotMatch(transformedCustomProcedures, /styles\.checkboxRow/);
assert.doesNotMatch(transformedCustomProcedures, /props\.onToggleWarp/);
assert.match(transformedCustomProcedures, /styles\.buttonRow/);
const transformedNativeCallbacks = transformNativeEditor(
    '/node_modules/openblock-gui/src/containers/blocks.jsx',
    `import DeviceLibrary from './device-library.jsx';
import {closeExtensionLibrary, openSoundRecorder, openConnectionModal, closeDeviceLibrary} from '../reducers/modals';
before
    handleOpenSoundRecorder () {
        this.props.onOpenSoundRecorder();
    }

    handlePromptCallback (input, variableOptions) {
        this.state.prompt.callback(
            input,
            this.props.vm.runtime.getAllVarNamesOfType(this.state.prompt.varType),
            variableOptions);
        this.handlePromptClose();
    }

    handleCustomProceduresClose (data) {
        this.props.onRequestCloseCustomProcedures(data);
        const ws = this.workspace;
        ws.refreshToolboxSelection_();
        ws.toolbox_.scrollToCategoryById('myBlocks');
    }

        toolboxWorkspace.registerButtonCallback('MAKE_A_VARIABLE', varListButtonCallback(''));
        toolboxWorkspace.registerButtonCallback('MAKE_A_LIST', varListButtonCallback('list'));
        toolboxWorkspace.registerButtonCallback('MAKE_A_PROCEDURE', procButtonCallback);
            deviceLibraryVisible,
            onRequestCloseDeviceLibrary,
                {deviceLibraryVisible ? (
                    <DeviceLibrary
                        vm={vm}
                        onDeviceSelected={this.handleDeviceSelected}
                        onRequestClose={onRequestCloseDeviceLibrary}
                    />
                ) : null}
    deviceLibraryVisible: PropTypes.bool,
    onRequestCloseDeviceLibrary: PropTypes.func,
    deviceLibraryVisible: state.scratchGui.modals.deviceLibrary,
    onRequestCloseDeviceLibrary: () => {
        dispatch(closeDeviceLibrary());
    },
            onSetBaudrate,
            toolboxXML,
after`
);
assert.match(transformedNativeCallbacks, /refreshNativeToolboxCategory \(categoryId\)/);
assert.match(transformedNativeCallbacks, /this\.refreshNativeToolboxCategory\('variables'\)/);
assert.match(transformedNativeCallbacks, /this\.refreshNativeToolboxCategory\('myBlocks'\)/);
assert.doesNotMatch(transformedNativeCallbacks, /const ws = this\.workspace/);
assert.doesNotMatch(transformedNativeCallbacks, /DeviceLibrary/);
assert.doesNotMatch(transformedNativeCallbacks, /deviceLibraryVisible/);
assert.doesNotMatch(transformedNativeCallbacks, /onRequestCloseDeviceLibrary/);
assert.doesNotMatch(transformedNativeCallbacks, /closeDeviceLibrary/);
assert.match(
    transformedNativeCallbacks,
    /onSetBaudrate,\s+onShowMessageBox,\s+toolboxXML,/
);
[
    'CREATE_VARIABLE',
    'CREATE_LIST',
    'CREATE_PROCEDURE',
    'MAKE_A_VARIABLE',
    'MAKE_A_LIST',
    'MAKE_A_PROCEDURE'
].forEach(callbackKey => {
    assert.match(
        transformedNativeCallbacks,
        new RegExp(`registerButtonCallback\\s*\\(\\s*'${callbackKey}'`)
    );
});
const runtimeLoader = require('./est-vm-runtime-loader');
const transformedRuntime = runtimeLoader(
    `before
        this._isRealtimeMode = true;
    scratch3_procedures: require('../blocks/scratch3_procedures')
    setRealtimeMode (sta) {
        if (this._isRealtimeMode !== sta){
            this._isRealtimeMode = sta;
            this.emit(Runtime.PROGRAM_MODE_UPDATE, {isRealtimeMode: this._isRealtimeMode});
        }
    }
after`
);
assert.ok(transformedRuntime.indexOf("scratch3_procedures: require('../blocks/scratch3_procedures')") <
    transformedRuntime.indexOf("est: require('est-vm-blocks')"));
assert.ok(!transformedRuntime.includes('this._isRealtimeMode = sta'));
assert.ok(!transformedRuntime.includes('this._isRealtimeMode = true'));
assert.match(transformedRuntime, /isRealtimeMode: false/);

const reports = splitReports(new Uint8Array(1025), 1024);
assert.strictEqual(reports.length, 2);
assert.strictEqual(reports[0].length, 1024);
assert.strictEqual(reports[1].length, 1024);
assert.strictEqual(isEstDevice({vendorId: 0x0483, productId: 0x5750}), true);
assert.strictEqual(isEstDevice({vendorId: 0x1234, productId: 0x5750}), false);

const buildDeviceResponse = (command, payload = new Uint8Array()) => {
    const frame = new Uint8Array(7 + payload.length);
    frame.set([0x68, 0x21, command, payload.length & 0xff, (payload.length >> 8) & 0xff]);
    frame.set(payload, 5);
    frame[5 + payload.length] = checksum(frame.slice(0, 5 + payload.length));
    frame[6 + payload.length] = 0x16;
    return frame;
};

const writeUint16LE = (bytes, offset, value) => {
    bytes[offset] = value & 0xff;
    bytes[offset + 1] = (value >>> 8) & 0xff;
};

const writeUint32LE = (bytes, offset, value) => {
    bytes[offset] = value & 0xff;
    bytes[offset + 1] = (value >>> 8) & 0xff;
    bytes[offset + 2] = (value >>> 16) & 0xff;
    bytes[offset + 3] = (value >>> 24) & 0xff;
};

class ProgramTestTransport {
    constructor () {
        this.actions = [];
        this.closed = false;
        this.closeCount = 0;
        this.python = {
            actualCrc32: 0,
            error: 0,
            expectedCrc32: 0,
            expectedLength: 0,
            flags: 0,
            received: Buffer.alloc(0),
            runCount: 0,
            state: 0,
            stopPending: false,
            timeoutMs: 0
        };
        this.responses = [];
        this.slots = Array.from({length: 8}, () => ({
            generation: 0,
            name: '',
            source: Buffer.alloc(0)
        }));
    }

    write (report) {
        const command = report[2];
        const action = report[5];
        this.actions.push(`${command}:${action}`);
        if (command === COMMAND_PYTHON_PROGRAM) {
            this.handlePython(report, action);
        } else if (command === COMMAND_PERSISTENT_PROGRAM) {
            this.handlePersistent(report, action);
        }
        return Promise.resolve();
    }

    read () {
        return Promise.resolve(this.responses.shift() || new Uint8Array());
    }

    close () {
        this.closeCount += 1;
        this.closed = true;
        return Promise.resolve();
    }

    handlePython (report, action) {
        const payloadLength = report[3] | (report[4] << 8);
        if (action === 0 && this.python.stopPending) {
            this.python.flags &= ~0x08;
            this.python.runCount += 1;
            this.python.stopPending = false;
        } else if (action === 1) {
            this.python.expectedLength = report[6] | (report[7] << 8);
            this.python.expectedCrc32 = (
                report[8] | (report[9] << 8) | (report[10] << 16) | (report[11] << 24)
            ) >>> 0;
            this.python.actualCrc32 = 0;
            this.python.received = Buffer.alloc(0);
            this.python.state = 1;
            this.python.flags = 0;
        } else if (action === 2) {
            const offset = report[6] | (report[7] << 8);
            const chunk = Buffer.from(report.slice(8, 5 + payloadLength));
            assert.strictEqual(offset, this.python.received.length);
            this.python.received = Buffer.concat([this.python.received, chunk]);
            if (this.python.received.length === this.python.expectedLength) {
                this.python.actualCrc32 = crc32(this.python.received);
                this.python.state = 2;
            }
        } else if (action === 3) {
            this.python.timeoutMs = (
                report[6] | (report[7] << 8) | (report[8] << 16) | (report[9] << 24)
            ) >>> 0;
            this.python.state = 3;
            this.python.flags = 0x09;
        } else if (action === 4) {
            this.python.state = 7;
            this.python.error = 4;
            this.python.flags |= 0x0c;
            this.python.stopPending = true;
        }
        this.responses.push(this.buildPythonResponse());
    }

    handlePersistent (report, action) {
        const payloadLength = report[3] | (report[4] << 8);
        const slot = payloadLength >= 2 ? report[6] : 0;
        if (action === 1) {
            const nameLength = payloadLength >= 3 ? report[7] : 0;
            const programName = nameLength ? Buffer.from(report.slice(8, 8 + nameLength)).toString('utf8') :
                `Program ${slot}`;
            this.slots[slot] = {
                generation: this.slots[slot].generation + 1,
                name: programName,
                source: Buffer.from(this.python.received)
            };
        } else if (action === 2) {
            const saved = this.slots[slot];
            this.python.received = Buffer.from(saved.source);
            this.python.expectedLength = saved.source.length;
            this.python.expectedCrc32 = crc32(saved.source);
            this.python.actualCrc32 = this.python.expectedCrc32;
            this.python.error = 0;
            this.python.flags = 1;
            this.python.state = 2;
        }
        this.responses.push(this.buildPersistentResponse(slot));
    }

    buildPythonResponse () {
        const payload = new Uint8Array(32);
        payload.set([1, 1, this.python.state, this.python.error, this.python.flags], 0);
        writeUint16LE(payload, 6, this.python.expectedLength);
        writeUint16LE(payload, 8, this.python.received.length);
        writeUint16LE(payload, 10, this.python.runCount);
        writeUint32LE(payload, 12, this.python.expectedCrc32);
        writeUint32LE(payload, 16, this.python.actualCrc32);
        writeUint32LE(payload, 24, this.python.timeoutMs);
        return buildDeviceResponse(COMMAND_PYTHON_PROGRAM, payload);
    }

    buildPersistentResponse (slot) {
        const saved = this.slots[slot];
        const name = Buffer.from(saved.name, 'utf8');
        const payload = new Uint8Array(76);
        payload.set([3, 1, saved.source.length ? 3 : 2, 0x17, slot, 8, 0xff,
            saved.source.length ? 1 : 0], 0);
        writeUint32LE(payload, 8, saved.generation);
        writeUint16LE(payload, 12, saved.source.length);
        payload[14] = name.length;
        writeUint32LE(payload, 16, saved.source.length ? crc32(saved.source) : 0);
        writeUint32LE(payload, 20, 0x01fe8000);
        writeUint32LE(payload, 24, 0x18000);
        writeUint32LE(payload, 28, 12288);
        writeUint32LE(payload, 32, 0x2000000);
        payload.set([0xef, 0x40, 0x19, 0x3f, saved.source.length ? 1 : 0], 36);
        payload.set(name, 41);
        payload[72] = 2;
        payload[73] = 3;
        return buildDeviceResponse(COMMAND_PERSISTENT_PROGRAM, payload);
    }
}

const createDeferred = () => {
    let resolve;
    const promise = new Promise(resolvePromise => {
        resolve = resolvePromise;
    });
    return {promise, resolve};
};

class QueueTestTransport {
    constructor () {
        this.events = [];
        this.writeGates = new Map();
        this.failedCommands = new Set();
        this.currentCommand = null;
        this.closed = false;
    }

    write (report) {
        const command = report[2];
        this.currentCommand = command;
        this.events.push(`write:${command}`);
        if (this.failedCommands.has(command)) {
            return Promise.reject(new Error(`forced write failure for ${command}`));
        }
        return this.writeGates.get(command) || Promise.resolve();
    }

    read () {
        this.events.push(`read:${this.currentCommand}`);
        return Promise.resolve(buildDeviceResponse(this.currentCommand, Uint8Array.from([this.currentCommand])));
    }

    close () {
        this.events.push('close');
        this.closed = true;
        return Promise.resolve();
    }
}

const testCommandQueue = async () => {
    const transport = new QueueTestTransport();
    const firstWrite = createDeferred();
    transport.writeGates.set(0x20, firstWrite.promise);

    const service = new EstDeviceService({requestTimeoutMs: 50});
    service.transport = transport;
    service.device = {vendorId: 0x0483, productId: 0x5750, maxInputReportSize: 64};

    const firstRequest = service.request(0x20);
    const secondRequest = service.request(0x21);
    await Promise.resolve();
    assert.deepStrictEqual(transport.events, ['write:32']);

    firstWrite.resolve();
    const responses = await Promise.all([firstRequest, secondRequest]);
    assert.deepStrictEqual(responses.map(response => Array.from(response)), [[0x20], [0x21]]);
    assert.deepStrictEqual(transport.events, ['write:32', 'read:32', 'write:33', 'read:33']);

    transport.failedCommands.add(0x22);
    await assert.rejects(service.request(0x22), /forced write failure/);
    assert.deepStrictEqual(Array.from(await service.request(0x23)), [0x23]);

    const finalWrite = createDeferred();
    transport.writeGates.set(0x24, finalWrite.promise);
    const finalRequest = service.request(0x24);
    const disconnect = service.disconnect();
    await Promise.resolve();
    assert.strictEqual(transport.closed, false);
    finalWrite.resolve();
    await finalRequest;
    await disconnect;
    assert.strictEqual(transport.closed, true);
    assert.deepStrictEqual(transport.events.slice(-3), ['write:36', 'read:36', 'close']);
};

const testProgramDownloadRunAndStop = async () => {
    const transport = new ProgramTestTransport();
    const service = new EstDeviceService({
        fragmentWriteDelayMs: 0,
        programStatusPollIntervalMs: 0,
        requestTimeoutMs: 100
    });
    service.transport = transport;
    service.device = {
        maxInputReportSize: 1024,
        productId: 0x5750,
        product: 'EST HID Device (HS Mode)',
        vendorId: 0x0483
    };

    const longSource = `message = '${'x'.repeat(1100)}'\n`;
    const downloaded = await service.downloadProgram({
        programName: '巡线',
        slot: 3,
        source: longSource
    });
    assert.strictEqual(downloaded.slot, 3);
    assert.strictEqual(downloaded.programName, '巡线');
    assert.strictEqual(downloaded.upload.sourceBytes, Buffer.byteLength(longSource, 'utf8'));
    assert.strictEqual(downloaded.savedStatus.programSlotId, 3);
    assert.strictEqual(downloaded.savedStatus.programName, '巡线');
    assert.strictEqual(downloaded.savedStatus.sourceLength, Buffer.byteLength(longSource, 'utf8'));
    assert.strictEqual(parsePythonProgramResponse(transport.buildPythonResponse()).state, 2);
    assert.strictEqual(parsePersistentProgramResponse(transport.buildPersistentResponse(3)).programName, '巡线');
    assert.deepStrictEqual(transport.actions, [
        '36:0',
        '36:1',
        '36:2',
        '36:2',
        '37:1'
    ]);

    const runSource = 'import est\nest._program_result(7)\n';
    const running = await service.runProgram({source: runSource, slot: 5});
    assert.strictEqual(running.slot, 5);
    assert.strictEqual(running.savedStatus.programSlotId, 5);
    assert.strictEqual(running.run.loadedStatus.programSlotId, 5);
    assert.strictEqual(running.run.runStatus.state, 3);
    assert.strictEqual(transport.slots[5].source.toString('utf8'), runSource);
    assert.deepStrictEqual(transport.actions.slice(-6), [
        '36:0',
        '36:1',
        '36:2',
        '37:1',
        '37:2',
        '36:3'
    ]);

    const stopped = await service.stopCurrentProgram();
    assert.strictEqual(stopped.state, 7);
    assert.strictEqual(stopped.flags & 0x08, 0);
    assert.deepStrictEqual(transport.actions.slice(-3), ['36:0', '36:4', '36:0']);

    await assert.rejects(
        service.downloadProgram({source: '', slot: 0}),
        /must not be empty/
    );
    await assert.rejects(
        service.downloadProgram({source: 'x = 1\n', slot: 8}),
        /0\.\.7/
    );
};

const testProgramStatusTimeoutPreservesStopTransport = async () => {
    const transport = new ProgramTestTransport();
    const device = {
        maxInputReportSize: 1024,
        path: 'test-est-device',
        productId: 0x5750,
        product: 'EST HID Device (HS Mode)',
        vendorId: 0x0483
    };
    const service = new EstDeviceService({
        fragmentWriteDelayMs: 0,
        programStatusPollIntervalMs: 0,
        requestTimeoutMs: 5,
        transportFactory: {
            listDevices: () => Promise.resolve([device])
        }
    });
    service.transport = transport;
    service.device = device;
    service.lastDeviceStatus = {
        compatibility: {compatible: true},
        firmwareVersion: 'M1.09A'
    };

    await service.runProgram({source: 'while True:\n    pass\n', slot: 7});
    assert.strictEqual(service.pythonProgramActive, true);

    const status = await service.getStatus();
    assert.strictEqual(status.statusPollingDeferred, true);
    assert.match(status.statusPollingError, /0x19/);
    assert.strictEqual(transport.closeCount, 0);
    assert.strictEqual(service.transport, transport);

    const connection = await service.autoConnect();
    assert.strictEqual(connection.state, 'connected');
    assert.strictEqual(connection.status.statusPollingDeferred, true);
    assert.strictEqual(transport.closeCount, 0);
    assert.strictEqual(service.transport, transport);

    const stopped = await service.stopCurrentProgram();
    assert.strictEqual(stopped.state, 7);
    assert.strictEqual(service.pythonProgramActive, false);
    assert.strictEqual(transport.closeCount, 0);
    assert.strictEqual(service.transport, transport);
    assert.deepStrictEqual(transport.actions.slice(-3), ['36:0', '36:4', '36:0']);

    const connectionAfterStop = await service.autoConnect();
    assert.strictEqual(connectionAfterStop.state, 'error');
    assert.strictEqual(transport.closeCount, 1);
    assert.strictEqual(service.transport, null);
};

const testBuiltInMotorBlock = async () => {
    const invokedChannels = [];
    const motorBlocks = new EstMotorBlocks(null, {
        invoke: channel => {
            invokedChannels.push(channel);
            return Promise.resolve({
                state: 'connected',
                status: {
                    motors: [
                        {tachoCount: 10},
                        {tachoCount: 20},
                        {tachoCount: 30},
                        {tachoCount: -40}
                    ]
                }
            });
        }
    });
    const primitives = motorBlocks.getPrimitives();
    assert.deepStrictEqual(
        Object.keys(primitives).sort(),
        [...ALL_EST_BLOCK_IDS, ...EST_SUPPORT_BLOCK_IDS].sort()
    );
    assert.strictEqual(primitives[EST_MOTOR_PORT_PICKER_ID]({PORT: 'c'}), 'C');
    assert.strictEqual(primitives[EST_DRIVE_PORT_PICKER_ID]({PORT: 'B'}), 'B');
    assert.strictEqual(primitives[EST_STEERING_PICKER_ID]({NUM: '39'}), 39);
    assert.strictEqual(primitives[EST_EVENT_SENSOR_PORT_PICKER_ID]({PORT: '3'}), '3');
    assert.strictEqual(await motorBlocks.motorDegrees({PORT: 'D'}), -40);
    assert.deepStrictEqual(invokedChannels, ['est-auto-connect']);
    assert.throws(
        () => primitives.motor_start({PORT: 'A', DIRECTION: 'clockwise'}),
        /motor_start is not connected to device execution yet/
    );
    assert.throws(
        () => primitives.drive_start_steer({STEERING: 0}),
        /drive_start_steer is not connected to device execution yet/
    );
    assert.throws(
        () => primitives.display_clear(),
        /display_clear is not connected to device execution yet/
    );
    assert.deepStrictEqual(invokedChannels, ['est-auto-connect']);

    const disconnectedBlocks = new EstMotorBlocks(null, {
        invoke: () => Promise.resolve({state: 'not-found'})
    });
    await assert.rejects(disconnectedBlocks.motorDegrees({PORT: 'A'}), /EST is not connected/);
    await assert.rejects(motorBlocks.motorDegrees({PORT: 'Z'}), /Invalid EST motor port/);
};

const validateEstDefaultProject = () => new Promise((resolve, reject) => {
    validateProject(estDefaultProjectAssets[0].data, false, (error, result) => {
        if (error) {
            reject(error);
            return;
        }
        assert.strictEqual(result[0].targets.length, 2);
        resolve();
    });
});

validateEstDefaultProject()
    .then(() => testCommandQueue())
    .then(() => testProgramDownloadRunAndStop())
    .then(() => testProgramStatusTimeoutPreservesStopTransport())
    .then(() => testBuiltInMotorBlock())
    .then(() => console.log(
        'EST protocol, queue, 90 EST blocks, and native operator/data/procedure tests passed'
    ))
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    });

if (originalSvgLoader) {
    Module._extensions['.svg'] = originalSvgLoader;
} else {
    delete Module._extensions['.svg'];
}
