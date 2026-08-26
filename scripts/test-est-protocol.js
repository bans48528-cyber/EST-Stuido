const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const path = require('path');
const babel = require('@babel/core');

const estRoots = [
    path.resolve(__dirname, '..', 'src', 'main', 'est'),
    path.resolve(__dirname, '..', 'src', 'renderer', 'est-blocks')
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

const {
    buildFrame,
    checkDeviceCompatibility,
    checksum,
    isEstDevice,
    parseDeviceStatusResponse,
    parseFrame,
    parseHeartbeatResponse,
    splitReports
} = require(path.join(estRoot, 'protocol.js'));
const {
    CAPABILITY_MOTOR_CONTROL,
    CAPABILITY_MOTOR_PAIR_POSITION,
    COMMAND_DEVICE_STATUS
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
    EST_SUPPORT_BLOCK_IDS,
    MOTOR_COLOURS,
    isSteeringDialMarkVisible,
    registerEstBlocks
} = require(path.join(estBlocksRoot, 'definitions.js'));
const getEstToolboxCategories = require(path.join(estBlocksRoot, 'toolbox.js')).default;
const EstMotorBlocks = require(path.join(estBlocksRoot, 'runtime.js'));

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
assert.match(oldProtocolCompatibility.message, /requires 1\.5 or newer/);

const supportedStatus = {...deviceStatus, protocolMinor: 6};
assert.strictEqual(checkDeviceCompatibility(supportedStatus).compatible, true);
assert.strictEqual(
    checkDeviceCompatibility(supportedStatus, CAPABILITY_MOTOR_CONTROL).compatible,
    true
);
const missingPairControl = checkDeviceCompatibility(supportedStatus, CAPABILITY_MOTOR_PAIR_POSITION);
assert.strictEqual(missingPairControl.compatible, false);
assert.strictEqual(missingPairControl.missingCapabilities, CAPABILITY_MOTOR_PAIR_POSITION);

const registeredBlockDefinitions = [];
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
    Blocks: {},
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
            fakeScratchBlocks.Blocks[definition.type] = definition;
        });
    }
};
registerEstBlocks(fakeScratchBlocks);
registerEstBlocks(fakeScratchBlocks);
const expectedCategoryCounts = {
    motor: 11,
    movement: 11,
    display: 6,
    sound: 6,
    event: 13,
    control: 9,
    sensing: 34,
    operators: 16
};
assert.deepStrictEqual(
    Object.fromEntries(Object.entries(CATEGORY_BLOCK_IDS).map(([categoryId, blockIds]) => [
        categoryId,
        blockIds.length
    ])),
    expectedCategoryCounts
);
assert.strictEqual(registeredBlockDefinitions.length, 110);
assert.strictEqual(new Set(ALL_EST_BLOCK_IDS).size, 106);
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
['电机', '移动', '显示', '声音', '事件', '控制', '传感器', '运算']
    .forEach(categoryName => {
        assert.match(estToolboxCategories, new RegExp(`<category[^>]*name="${categoryName}"`, 's'));
    });
assert.strictEqual((estToolboxCategories.match(/<category/g) || []).length, 8);
ALL_EST_BLOCK_IDS.forEach(blockId => {
    assert.ok(estToolboxCategories.includes(`<block type="${blockId}"`));
});
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

const blocksLoader = require('./est-blocks-loader');
const transformedBlocks = blocksLoader('before\n    return ScratchBlocks;\nafter');
assert.ok(transformedBlocks.indexOf('registerEstBlocks(ScratchBlocks);') <
    transformedBlocks.indexOf('return ScratchBlocks;'));
const toolboxLoader = require('./est-toolbox-loader');
const transformedToolbox = toolboxLoader(
    "before\n    return everything.join('\\n');\nafter"
);
assert.match(transformedToolbox, /getEstToolboxCategories\(\), gap, variablesXML, gap, myBlocksXML/);
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
return <PromptComponent
                defaultValue={this.props.defaultValue}
/>;`
);
assert.match(transformedPromptContainer, /inputValue: props\.defaultValue \|\| ''/);
assert.match(transformedPromptContainer, /value=\{this\.state\.inputValue\}/);
const transformedCustomProcedures = transformNativeEditor(
    '/node_modules/openblock-gui/src/components/custom-procedures/custom-procedures.jsx',
    `const CustomProcedures = props => (
    <Modal
        className={styles.modalContent}
    />
);`
);
assert.match(transformedCustomProcedures, /id="customProcedures"/);
const transformedNativeCallbacks = transformNativeEditor(
    '/node_modules/openblock-gui/src/containers/blocks.jsx',
    `before
        toolboxWorkspace.registerButtonCallback('MAKE_A_VARIABLE', varListButtonCallback(''));
        toolboxWorkspace.registerButtonCallback('MAKE_A_LIST', varListButtonCallback('list'));
        toolboxWorkspace.registerButtonCallback('MAKE_A_PROCEDURE', procButtonCallback);
after`
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
    "before\n    scratch3_procedures: require('../blocks/scratch3_procedures')\nafter"
);
assert.ok(transformedRuntime.indexOf("scratch3_procedures: require('../blocks/scratch3_procedures')") <
    transformedRuntime.indexOf("est: require('est-vm-blocks')"));

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
    assert.throws(
        () => primitives.operator_add({A: 1, B: 2}),
        /operator_add is not connected to device execution yet/
    );
    assert.deepStrictEqual(invokedChannels, ['est-auto-connect']);

    const disconnectedBlocks = new EstMotorBlocks(null, {
        invoke: () => Promise.resolve({state: 'not-found'})
    });
    await assert.rejects(disconnectedBlocks.motorDegrees({PORT: 'A'}), /EST is not connected/);
    await assert.rejects(motorBlocks.motorDegrees({PORT: 'Z'}), /Invalid EST motor port/);
};

testCommandQueue()
    .then(() => testBuiltInMotorBlock())
    .then(() => console.log('EST protocol, queue, 106 EST blocks, and native data/procedure tests passed'))
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    });

if (originalSvgLoader) {
    Module._extensions['.svg'] = originalSvgLoader;
} else {
    delete Module._extensions['.svg'];
}
