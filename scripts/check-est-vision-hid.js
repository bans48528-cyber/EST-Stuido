#!/usr/bin/env node

/* eslint-disable global-require */

const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const path = require('path');
const {spawnSync} = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const electronPath = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
const gestureCheck = process.argv.includes('--gesture');
const multiCheck = process.argv.includes('--multi');

const registerEstBabelLoader = () => {
    const babel = require('@babel/core');
    const estRoot = path.join(projectRoot, 'src', 'main', 'est');
    const originalLoader = Module._extensions['.js'];
    Module._extensions['.js'] = (module, filename) => {
        if (!filename.startsWith(estRoot)) {
            return originalLoader(module, filename);
        }
        const transformed = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
            babelrc: false,
            plugins: ['@babel/plugin-transform-modules-commonjs']
        });
        module._compile(transformed.code, filename);
    };
};

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

const runChild = async () => {
    const {ensureElectronNativeArch} = require('./ensure-electron-native-arch');
    ensureElectronNativeArch();
    registerEstBabelLoader();

    const constants = require(path.join(projectRoot, 'src', 'main', 'est', 'constants'));
    const {EstDeviceService} = require(path.join(projectRoot, 'src', 'main', 'est', 'device-service'));
    const {EstVisionSimulator} = require(path.join(projectRoot, 'src', 'main', 'est', 'vision-simulator'));
    const {
        buildPythonProgramClearFrame
    } = require(path.join(projectRoot, 'src', 'main', 'est', 'protocol'));
    const {
        createNodeHidEstTransportFactory
    } = require(path.join(projectRoot, 'src', 'main', 'est', 'transports', 'node-hid'));

    const service = new EstDeviceService({
        requestTimeoutMs: 2000,
        programStatusRequestTimeoutMs: 500,
        programStatusPollIntervalMs: 50,
        visionRequestTimeoutMs: 500,
        visionSendIntervalMs: 100,
        transportFactory: createNodeHidEstTransportFactory()
    });
    const simulator = new EstVisionSimulator(service);
    let programActive = false;

    try {
        const connection = await service.autoConnect({includeProgramStatus: true});
        assert.strictEqual(connection.state, 'connected', 'exactly one EST must be connected');
        assert.strictEqual(connection.status.protocolMajor, 1);
        assert.ok(connection.status.protocolMinor >= 30, 'EST protocol 1.30 or newer is required');
        assert.ok(
            connection.status.capabilityNames.includes('vision-input'),
            'EST firmware must report vision-input'
        );
        if (multiCheck) {
            assert.ok(connection.status.protocolMinor >= 31, 'EST protocol 1.31 or newer is required');
            assert.ok(connection.status.capabilityNames.includes('vision-input-multi'),
                'EST firmware must report vision-input-multi');
        }

        const initial = await service.getVisionStatus();
        if (multiCheck) assert.strictEqual(initial.validMask, 0);
        else assert.strictEqual(initial.state, constants.VISION_SENSOR_STATE_EMPTY);

        const source = multiCheck ? [
            'import est_runtime as rt',
            'import est',
            '',
            'seen = -1',
            'for _ in range(100):',
            "    values = (rt.vision_class_id('left'), rt.vision_class_id('right'),",
            "              rt.vision_class_id('pose'), rt.vision_class_id('face'))",
            '    if min(values) >= 0:',
            '        seen = sum(values)',
            '    rt.sleep(0.05)',
            'est._program_result(seen)',
            ''
        ].join('\n') : gestureCheck ?
            fs.readFileSync(path.join(__dirname, 'vision-gesture-device-test.py'), 'utf8') : [
            'import est_runtime as rt',
            'import est',
            '',
            'seen = -1',
            'for _ in range(100):',
            '    sample = rt.vision_snapshot()',
            '    if sample[0]:',
            '        seen = sample[1] * 1000 + int(sample[2] * 10)',
            '    rt.sleep(0.05)',
            'est._program_result(seen)',
            ''
        ].join('\n');

        await service.uploadPython(source);
        const multiFrame = {
            ttlMs: 500,
            enabled: {left: true, right: true, pose: true, face: true},
            targets: {
                left: {classId: 1101, confidencePermille: 0, centerX: 2500, centerY: 5000,
                    width: 2000, height: 5000},
                right: {classId: 1202, confidencePermille: 0, centerX: 7500, centerY: 5000,
                    width: 2000, height: 5000},
                pose: {classId: 3104, confidencePermille: 0, centerX: 5000, centerY: 5000,
                    width: 6000, height: 9000},
                face: {classId: 2101, confidencePermille: 0, centerX: 5000, centerY: 3000,
                    width: 2500, height: 3000}
            }
        };
        if (multiCheck) service.updateVisionFrame(multiFrame);
        else {
            simulator.start({
                classId: gestureCheck ? 1201 : 7,
                confidencePermille: gestureCheck ? 0 : 923,
                ttlMs: 500,
                intervalMs: 100
            });
        }
        await wait(150);
        const runStatus = await service._withVisionSuspended(
            () => service._runReadyProgramNow(constants.PYTHON_PROGRAM_NO_TIMEOUT_MS)
        );
        programActive = service._pythonProgramActive(runStatus);
        assert.ok(programActive, 'RAM Python program did not start');

        await wait(250);
        const valid = await service.getVisionStatus();
        if (multiCheck) assert.strictEqual(valid.validMask, 0x0f);
        else assert.strictEqual(valid.state, constants.VISION_SENSOR_STATE_VALID);
        assert.strictEqual(valid.ttlMs, 500);

        let partial = null;
        if (multiCheck) {
            const targets = {...multiFrame.targets};
            delete targets.right;
            service.updateVisionFrame({...multiFrame, targets});
            await wait(250);
            partial = await service.getVisionStatus();
            assert.strictEqual(partial.enabledMask, 0x0f);
            assert.strictEqual(partial.validMask, 0x0d,
                'a missing right hand must not clear left hand, pose, or face');
        }

        if (!multiCheck) simulator.stop({clear: false});
        await wait(650);
        const expired = await service.getVisionStatus();
        if (multiCheck) assert.strictEqual(expired.validMask, 0);
        else assert.strictEqual(expired.state, constants.VISION_SENSOR_STATE_EXPIRED);

        if (multiCheck) service.updateVisionFrame(multiFrame);
        else {
            simulator.start({
                classId: gestureCheck ? 1201 : 7,
                confidencePermille: gestureCheck ? 0 : 923,
                ttlMs: 500,
                intervalMs: 100
            });
        }
        await wait(250);
        const recovered = await service.getVisionStatus();
        if (multiCheck) assert.strictEqual(recovered.validMask, 0x0f);
        else assert.strictEqual(recovered.state, constants.VISION_SENSOR_STATE_VALID);

        if (multiCheck) service.clearVision(constants.VISION_SENSOR_CLEAR_REASON_NO_TARGET);
        else simulator.noTarget();
        await wait(250);
        const cleared = await service.getVisionStatus();
        if (multiCheck) assert.strictEqual(cleared.validMask, 0);
        else assert.strictEqual(cleared.state, constants.VISION_SENSOR_STATE_EMPTY);

        let finalStatus = runStatus;
        const deadline = Date.now() + 6000;
        while (Date.now() < deadline && service._pythonProgramActive(finalStatus)) {
            await wait(100);
            const snapshot = await service.getStatus({includeProgramStatus: true});
            finalStatus = snapshot.programStatus;
        }
        programActive = service._pythonProgramActive(finalStatus);
        assert.strictEqual(finalStatus.state, constants.PYTHON_PROGRAM_STATE_COMPLETED);
        assert.strictEqual(finalStatus.error, 0);
        assert.strictEqual(finalStatus.resultValue, multiCheck ? 7508 : gestureCheck ? 31 : 7923);

        console.log(JSON.stringify({
            firmwareVersion: connection.firmwareVersion,
            testSource: multiCheck ? 'schema-2 four-target frame' :
                gestureCheck ? 'synthetic gesture payload, not live camera' : 'simulator',
            protocol: `${connection.status.protocolMajor}.${connection.status.protocolMinor}`,
            capability: multiCheck ? 'vision-input + vision-input-multi' : 'vision-input',
            initialState: multiCheck ? initial.validMask : initial.state,
            validState: multiCheck ? valid.validMask : valid.state,
            partialState: multiCheck ? partial.validMask : null,
            expiredState: multiCheck ? expired.validMask : expired.state,
            recoveredState: multiCheck ? recovered.validMask : recovered.state,
            clearedState: multiCheck ? cleared.validMask : cleared.state,
            pythonResult: finalStatus.resultValue,
            pythonDurationMs: finalStatus.durationMs,
            generatedFrames: simulator.getState().generatedFrames
        }, null, 2));
    } finally {
        simulator.stop({clear: false});
        if (service.transport) {
            if (programActive) {
                await service.stopCurrentProgram().catch(() => null);
            }
            await service._withVisionSuspended(async () => {
                const status = await service._pythonProgramActionNow(buildPythonProgramClearFrame());
                service._requirePythonProgramSuccess(status, 'clear RAM test program');
            }).catch(() => null);
            await service.disconnect();
        }
    }
};

if (process.env.EST_VISION_HID_CHECK_CHILD === '1') {
    runChild().catch(error => {
        console.error(error && error.stack ? error.stack : error);
        process.exit(1);
    });
} else {
    const result = spawnSync(electronPath, [__filename, ...process.argv.slice(2)], {
        cwd: projectRoot,
        env: {
            ...process.env,
            ELECTRON_RUN_AS_NODE: '1',
            EST_VISION_HID_CHECK_CHILD: '1'
        },
        stdio: 'inherit',
        windowsHide: true
    });
    if (result.error) {
        throw result.error;
    }
    process.exit(result.status === null ? 1 : result.status);
}
