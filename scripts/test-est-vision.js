/* eslint-disable object-property-newline, require-await */
const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const path = require('path');
const babel = require('@babel/core');

const estRoot = path.resolve(__dirname, '..', 'src', 'main', 'est');
const originalLoader = Module._extensions['.js'];
Module._extensions['.js'] = (module, filename) => {
    if (!filename.startsWith(estRoot)) return originalLoader(module, filename);
    const transformed = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
        babelrc: false,
        plugins: ['@babel/plugin-transform-modules-commonjs']
    });
    module._compile(transformed.code, filename);
};

const constants = require(path.join(estRoot, 'constants'));
const protocol = require(path.join(estRoot, 'protocol'));
const {EstDeviceService} = require(path.join(estRoot, 'device-service'));
const {EstVisionSimulator} = require(path.join(estRoot, 'vision-simulator'));

const responseFrame = (action, sequence, state = constants.VISION_SENSOR_STATE_VALID) => {
    const payload = new Uint8Array(16);
    payload.set([1, 1, state, 0, 0, action, 0, 0]);
    payload[8] = sequence & 0xff;
    payload[9] = (sequence >>> 8) & 0xff;
    payload[10] = (sequence >>> 16) & 0xff;
    payload[11] = (sequence >>> 24) & 0xff;
    payload[14] = 0xf4;
    payload[15] = 0x01;
    const frame = protocol.buildFrame(constants.COMMAND_VISION_SENSOR, payload);
    frame[1] = constants.DEVICE_DIRECTION;
    frame[frame.length - 2] = protocol.checksum(frame.slice(0, frame.length - 2));
    return frame;
};

const multiResponseFrame = (action, sequence, enabledMask = 0x0f, validMask = enabledMask) => {
    const payload = new Uint8Array(24);
    payload.set([
        constants.VISION_SENSOR_MULTI_SCHEMA_VERSION,
        1,
        0,
        action,
        constants.VISION_SENSOR_TARGET_MASK_ALL,
        enabledMask,
        validMask,
        0
    ]);
    payload[8] = sequence & 0xff;
    payload[9] = (sequence >>> 8) & 0xff;
    payload[10] = (sequence >>> 16) & 0xff;
    payload[11] = (sequence >>> 24) & 0xff;
    payload[12] = 0xf4;
    payload[13] = 0x01;
    for (let offset = 14; offset <= 20; offset += 2) {
        payload[offset] = validMask & (1 << ((offset - 14) / 2)) ? 0xf4 : 0;
        payload[offset + 1] = validMask & (1 << ((offset - 14) / 2)) ? 0x01 : 0;
    }
    const frame = protocol.buildFrame(constants.COMMAND_VISION_SENSOR, payload);
    frame[1] = constants.DEVICE_DIRECTION;
    frame[frame.length - 2] = protocol.checksum(frame.slice(0, frame.length - 2));
    return frame;
};

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

const main = async () => {
    const visionSource = 'import est_runtime as rt\nprint(rt.vision_snapshot())\n';
    const required = protocol.programRequiredCapabilitiesForSource(visionSource);
    assert.strictEqual(required, constants.CAPABILITY_VISION_INPUT);
    assert.strictEqual(protocol.programRequiredCapabilitiesForSource('print(1)\n'), 0);
    assert.strictEqual(protocol.programRequiredCapabilitiesForSource('rt.vision_valid()'), required);
    assert.strictEqual(protocol.programRequiredCapabilitiesForSource('est.vision.snapshot()'), required);
    const multiRequired = (
        constants.CAPABILITY_VISION_INPUT |
        constants.CAPABILITY_VISION_INPUT_MULTI
    ) >>> 0;
    for (const source of [
        'rt.vision_snapshot("left")',
        'rt.vision_valid(target)',
        'rt.vision_enabled("face")',
        'rt.vision_multi_status()',
        'est.vision.snapshot(0)',
        'est.vision.status()'
    ]) assert.strictEqual(protocol.programRequiredCapabilitiesForSource(source), multiRequired);
    for (const source of [
        '# rt.vision_valid()\nprint(1)',
        'print("rt.vision_snapshot()")',
        "print('rt.vision_class_id()')",
        'print("""example:\nrt.vision_position()\n""")'
    ]) assert.strictEqual(protocol.programRequiredCapabilitiesForSource(source), 0);
    const baseCapabilities = protocol.checkProgramFirmwareCompatibility(null).requiredProgramCapabilities;
    const compatibleStatus = {
        firmwareVersion: 'M1.27B', protocolMajor: 1, protocolMinor: 30,
        capabilities: baseCapabilities | required
    };
    assert.strictEqual(protocol.checkProgramFirmwareCompatibility(compatibleStatus, required).programCompatible, true);
    assert.strictEqual(protocol.checkProgramFirmwareCompatibility({
        ...compatibleStatus, protocolMinor: 29
    }, required).programCompatible, false);
    const missingVision = {...compatibleStatus, capabilities: baseCapabilities};
    assert.strictEqual(protocol.checkProgramFirmwareCompatibility(missingVision, required).programCompatible, false);
    assert.strictEqual(protocol.checkProgramFirmwareCompatibility(missingVision, 0).programCompatible, true);
    const eventSource = '@rt.on_condition(lambda: rt.vision_valid())\nasync def stack_1():\n' +
        '    await rt.wait_until(lambda: not rt.vision_valid())\n';
    const eventRequired = protocol.programRequiredCapabilitiesForSource(eventSource);
    assert.ok(eventRequired & constants.CAPABILITY_VISION_INPUT);
    assert.ok(eventRequired & constants.CAPABILITY_RUNTIME_BASIC_EVENT_HATS);
    assert.ok(eventRequired & constants.CAPABILITY_COOPERATIVE_MULTITASK);
    assert.strictEqual(protocol.checkProgramFirmwareCompatibility(compatibleStatus, eventRequired).programCompatible, false);
    assert.strictEqual(protocol.checkProgramFirmwareCompatibility({
        ...compatibleStatus, capabilities: baseCapabilities | eventRequired
    }, eventRequired).programCompatible, true);
    const update = protocol.buildVisionSensorUpdateFrame({
        sequence: 7,
        ttlMs: 500,
        classId: 12,
        confidencePermille: 925,
        centerX: 4000,
        centerY: 5000,
        width: 2000,
        height: 3000
    });
    assert.strictEqual(update[2], 0x28);
    assert.strictEqual(update[3] | (update[4] << 8), 22);
    assert.strictEqual(update[5], constants.VISION_SENSOR_ACTION_UPDATE);
    assert.strictEqual(update[15] | (update[16] << 8), 12);
    for (const classId of [...Array.from({length: 8}, (_, i) => 2100 + i),
        ...Array.from({length: 7}, (_, i) => 3101 + i)]) {
        const visualFrame = protocol.buildVisionSensorUpdateFrame({sequence: 8, ttlMs: 500,
            classId, confidencePermille: 0, centerX: 5000, centerY: 5000, width: 3000, height: 5000});
        assert.strictEqual(visualFrame[2], 0x28);
        assert.strictEqual(visualFrame[3], 22);
        assert.strictEqual(visualFrame[15] | (visualFrame[16] << 8), classId);
    }
    assert.strictEqual(protocol.buildVisionSensorStatusFrame()[3], 4);
    assert.strictEqual(protocol.buildVisionSensorClearFrame({reason: 1, sequence: 8})[3], 8);
    assert.throws(
        () => protocol.buildVisionSensorClearFrame({reason: 6, sequence: 8}),
        /0\.\.5/
    );
    assert.throws(() => protocol.buildVisionSensorUpdateFrame({
        sequence: 1, ttlMs: 10, classId: 0, confidencePermille: 1,
        centerX: 0, centerY: 0, width: 0, height: 0
    }), /TTL/);
    assert.ok(protocol.capabilityNamesFor(constants.CAPABILITY_VISION_INPUT).includes('vision-input'));
    assert.ok(protocol.capabilityNamesFor(constants.CAPABILITY_VISION_INPUT_MULTI).includes('vision-input-multi'));
    const targetSamples = {
        left: {classId: 1101, confidencePermille: 0, centerX: 1000, centerY: 2000,
            width: 3000, height: 4000},
        right: {classId: 1202, confidencePermille: 850, centerX: 5000, centerY: 6000,
            width: 2000, height: 3000},
        pose: {classId: 3104, confidencePermille: 0, centerX: 4000, centerY: 5000,
            width: 6000, height: 9000},
        face: {classId: 2101, confidencePermille: 0, centerX: 7000, centerY: 3000,
            width: 1000, height: 2000}
    };
    const multiUpdate = protocol.buildVisionSensorMultiUpdateFrame({
        sequence: 42,
        ttlMs: 500,
        enabledMask: 0x0f,
        validMask: 0x0f,
        targets: targetSamples
    });
    assert.strictEqual(multiUpdate.length, 64);
    assert.strictEqual(multiUpdate[5], constants.VISION_SENSOR_ACTION_UPDATE_FRAME);
    assert.strictEqual(multiUpdate[6], constants.VISION_SENSOR_MULTI_SCHEMA_VERSION);
    assert.strictEqual(multiUpdate[7], 0xff);
    assert.strictEqual(multiUpdate[8] | (multiUpdate[9] << 8), 42);
    assert.strictEqual(multiUpdate[14] | (multiUpdate[15] << 8), 1101);
    assert.strictEqual(multiUpdate[26] | (multiUpdate[27] << 8), 1202);
    assert.strictEqual(multiUpdate[38] | (multiUpdate[39] << 8), 3104);
    assert.strictEqual(multiUpdate[50] | (multiUpdate[51] << 8), 2101);
    assert.strictEqual(protocol.buildVisionSensorMultiStatusFrame()[5],
        constants.VISION_SENSOR_ACTION_MULTI_STATUS);
    const multiClear = protocol.buildVisionSensorMultiClearFrame({reason: 2, sequence: 43, targetMask: 0x02});
    assert.strictEqual(multiClear[5], constants.VISION_SENSOR_ACTION_MULTI_CLEAR);
    assert.strictEqual(multiClear[7], 0x02);
    const parsedMulti = protocol.parseVisionSensorMultiResponse(
        multiResponseFrame(constants.VISION_SENSOR_ACTION_UPDATE_FRAME, 42, 0x0f, 0x0d)
    );
    assert.strictEqual(parsedMulti.sequence, 42);
    assert.strictEqual(parsedMulti.enabledMask, 0x0f);
    assert.strictEqual(parsedMulti.validMask, 0x0d);
    assert.deepStrictEqual(parsedMulti.remainingMs, [500, 0, 500, 500]);
    assert.throws(() => protocol.buildVisionSensorMultiUpdateFrame({
        sequence: 1, ttlMs: 500, enabledMask: 1, validMask: 2, targets: targetSamples
    }), /subset/);

    let pendingResponse = null;
    const actions = [];
    const transport = {
        write: async report => {
            const bytes = Uint8Array.from(report);
            const action = bytes[5];
            const sequence = bytes[9] | (bytes[10] << 8) | (bytes[11] << 16) | (bytes[12] << 24);
            actions.push({action, classId: bytes[15] | (bytes[16] << 8)});
            pendingResponse = responseFrame(action, sequence >>> 0,
                action === constants.VISION_SENSOR_ACTION_CLEAR ? constants.VISION_SENSOR_STATE_EMPTY :
                    constants.VISION_SENSOR_STATE_VALID);
        },
        read: async () => pendingResponse,
        close: async () => {}
    };
    const service = new EstDeviceService({visionSendIntervalMs: 0, visionRequestTimeoutMs: 50});
    service.transport = transport;
    service.device = {vendorId: constants.EST_USB_VID, productId: constants.EST_USB_PID};
    service.lastDeviceStatus = {
        protocolMajor: 1,
        protocolMinor: 30,
        capabilities: constants.CAPABILITY_VISION_INPUT
    };
    service.pythonProgramActive = true;
    const status = await service.getVisionStatus();
    assert.strictEqual(status.acceptedAction, constants.VISION_SENSOR_ACTION_STATUS);
    assert.strictEqual(status.state, constants.VISION_SENSOR_STATE_VALID);
    actions.length = 0;
    for (let classId = 1; classId <= 20; classId++) {
        service.updateVisionSample({
            classId, confidencePermille: 900, ttlMs: 500,
            centerX: 5000, centerY: 5000, width: 2000, height: 3000
        });
    }
    await wait(30);
    assert.deepStrictEqual(actions, [{action: constants.VISION_SENSOR_ACTION_UPDATE, classId: 20}],
        'publisher must collapse queued samples to the latest frame');

    service.suspendVision();
    service.updateVisionSample({
        classId: 21, confidencePermille: 900, ttlMs: 500,
        centerX: 5000, centerY: 5000, width: 2000, height: 3000
    });
    await wait(10);
    assert.strictEqual(actions.length, 1);
    service.resumeVision();
    await wait(30);
    assert.strictEqual(actions[1].classId, 21);
    service.clearVision(constants.VISION_SENSOR_CLEAR_REASON_NO_TARGET);
    await wait(30);
    assert.strictEqual(actions[2].action, constants.VISION_SENSOR_ACTION_CLEAR);
    await service.disconnect();
    assert.strictEqual(actions[3].action, constants.VISION_SENSOR_ACTION_CLEAR);

    let pendingMultiResponse = null;
    const multiActions = [];
    const multiTransport = {
        write: async report => {
            const bytes = Uint8Array.from(report);
            const action = bytes[5];
            const sequenceOffset = action === constants.VISION_SENSOR_ACTION_UPDATE_FRAME ? 8 :
                action === constants.VISION_SENSOR_ACTION_MULTI_CLEAR ? 9 : -1;
            const sequence = sequenceOffset < 0 ? 0 : (
                bytes[sequenceOffset] |
                (bytes[sequenceOffset + 1] << 8) |
                (bytes[sequenceOffset + 2] << 16) |
                (bytes[sequenceOffset + 3] << 24)
            ) >>> 0;
            const packedMasks = action === constants.VISION_SENSOR_ACTION_UPDATE_FRAME ? bytes[7] : 0;
            multiActions.push({action, bytes});
            pendingMultiResponse = multiResponseFrame(
                action,
                sequence,
                packedMasks & 0x0f,
                packedMasks >>> 4
            );
        },
        read: async () => pendingMultiResponse,
        close: async () => {}
    };
    const multiService = new EstDeviceService({visionSendIntervalMs: 0, visionRequestTimeoutMs: 50});
    multiService.transport = multiTransport;
    multiService.device = {vendorId: constants.EST_USB_VID, productId: constants.EST_USB_PID};
    multiService.lastDeviceStatus = {
        protocolMajor: 1,
        protocolMinor: 31,
        capabilities: (constants.CAPABILITY_VISION_INPUT | constants.CAPABILITY_VISION_INPUT_MULTI) >>> 0
    };
    multiService.pythonProgramActive = true;
    assert.strictEqual(multiService.getVisionPublisherState().multiSupported, true);
    const multiStatus = await multiService.getVisionStatus();
    assert.strictEqual(multiStatus.acceptedAction, constants.VISION_SENSOR_ACTION_MULTI_STATUS);
    multiActions.length = 0;
    multiService.updateVisionFrame({
        ttlMs: 500,
        enabled: {left: true, right: true, pose: true, face: true},
        targets: targetSamples
    });
    await wait(30);
    assert.strictEqual(multiActions.length, 1);
    assert.strictEqual(multiActions[0].action, constants.VISION_SENSOR_ACTION_UPDATE_FRAME);
    assert.strictEqual(multiActions[0].bytes[7], 0xff);
    multiService.updateVisionFrame({
        ttlMs: 500,
        enabled: {left: true, right: true, pose: true, face: true},
        targets: {left: targetSamples.left, pose: targetSamples.pose, face: targetSamples.face}
    });
    await wait(30);
    assert.strictEqual(multiActions[1].bytes[7], 0xdf,
        'a missing right hand must clear only the right valid bit');
    multiService.clearVision(constants.VISION_SENSOR_CLEAR_REASON_NO_TARGET, 0x02);
    await wait(30);
    assert.strictEqual(multiActions[2].action, constants.VISION_SENSOR_ACTION_MULTI_CLEAR);
    assert.strictEqual(multiActions[2].bytes[7], 0x02);

    const runOrder = [];
    const runService = new EstDeviceService();
    runService._tryClearVisionOnDeviceNow = async () => runOrder.push('clear');
    runService._pythonProgramActionNow = async () => {
        runOrder.push('run');
        return {result: 1, error: 0, state: constants.PYTHON_PROGRAM_STATE_RUNNING};
    };
    await runService._runReadyProgramNow(0);
    assert.deepStrictEqual(runOrder, ['clear', 'run']);

    const reconnectService = new EstDeviceService();
    reconnectService.lastDeviceStatus = {
        protocolMajor: 1,
        protocolMinor: 30,
        capabilities: constants.CAPABILITY_VISION_INPUT
    };
    reconnectService.visionConnectionNeedsClear = true;
    let reconnectClearReason = null;
    reconnectService._tryClearVisionOnDeviceNow = async reason => {
        reconnectClearReason = reason;
        return {};
    };
    await reconnectService._clearVisionAfterConnectNow();
    assert.strictEqual(reconnectClearReason, constants.VISION_SENSOR_CLEAR_REASON_INITIALIZE);
    assert.strictEqual(reconnectService.visionConnectionNeedsClear, false);

    const connectionService = new EstDeviceService({
        transportFactory: {open: async () => transport}
    });
    connectionService.visionSequence = 27;
    connectionService._requestNow = async command => {
        assert.strictEqual(command, 0x01);
        return 'M1.27A';
    };
    await connectionService.connect({
        vendorId: constants.EST_USB_VID,
        productId: constants.EST_USB_PID,
        path: 'vision-test'
    });
    assert.strictEqual(connectionService.visionSequence, 0);
    assert.strictEqual(connectionService.visionConnectionNeedsClear, true);
    await connectionService._disconnectNow(false);

    const samples = [];
    const simulator = new EstVisionSimulator({
        updateVisionSample: sample => samples.push(sample),
        clearVision: reason => samples.push({reason}),
        getVisionPublisherState: () => ({})
    });
    simulator.start({classId: 4, intervalMs: 100});
    await wait(5);
    simulator.noTarget();
    assert.strictEqual(samples[0].classId, 4);
    assert.strictEqual(samples[1].reason, constants.VISION_SENSOR_CLEAR_REASON_NO_TARGET);

    console.log('EST vision protocol and latest-frame publisher tests passed.');
};

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
