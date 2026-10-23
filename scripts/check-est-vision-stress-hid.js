#!/usr/bin/env node

/* eslint-disable global-require */

const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const path = require('path');
const {spawnSync} = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const electronPath = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
const stressSeconds = Math.max(10, Number(process.env.EST_VISION_STRESS_SECONDS) || 300);

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

const startProducer = (service, options = {}) => {
    const intervalMs = options.intervalMs || 33;
    let generatedFrames = 0;
    const send = () => {
        const phase = generatedFrames % 200;
        service.updateVisionSample({
            classId: options.classId || 9,
            confidencePermille: options.confidencePermille || 850,
            ttlMs: options.ttlMs || 500,
            centerX: 3000 + (phase * 20),
            centerY: 5000,
            width: 2400,
            height: 3600
        });
        generatedFrames++;
    };
    send();
    const timer = setInterval(send, intervalMs);
    return {
        count: () => generatedFrames,
        stop: () => clearInterval(timer)
    };
};

const runChild = async () => {
    const {ensureElectronNativeArch} = require('./ensure-electron-native-arch');
    ensureElectronNativeArch();
    registerEstBabelLoader();

    const constants = require(path.join(projectRoot, 'src', 'main', 'est', 'constants'));
    const {EstDeviceService} = require(path.join(projectRoot, 'src', 'main', 'est', 'device-service'));
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
    const visionActions = [];
    const originalVisionAction = service._visionActionNow.bind(service);
    service._visionActionNow = async frame => {
        visionActions.push({action: frame[5], at: Date.now()});
        const response = await originalVisionAction(frame);
        return response;
    };

    let producer = null;
    try {
        const connection = await service.autoConnect({includeProgramStatus: true});
        assert.strictEqual(connection.state, 'connected', 'exactly one EST must be connected');
        assert.ok(connection.status.protocolMinor >= 30, 'EST protocol 1.30 or newer is required');
        assert.ok(connection.status.capabilityNames.includes('vision-input'));

        const iterations = Math.ceil(stressSeconds * 20);
        const stressSource = [
            'import est_runtime as rt',
            'import est',
            '',
            'last_sequence = -1',
            'received = 0',
            `for _ in range(${iterations}):`,
            '    sample = rt.vision_snapshot()',
            '    if sample[0] and sample[7] != last_sequence:',
            '        last_sequence = sample[7]',
            '        received += 1',
            '    rt.sleep(0.05)',
            'est._program_result(received)',
            ''
        ].join('\n');

        await service.uploadPython(stressSource);
        producer = startProducer(service);
        await wait(100);
        let programStatus = await service._withVisionSuspended(
            () => service._runReadyProgramNow(constants.PYTHON_PROGRAM_NO_TIMEOUT_MS)
        );
        assert.ok(service._pythonProgramActive(programStatus));

        const stressStartedAt = Date.now();
        const stressDeadline = stressStartedAt + (stressSeconds * 1000) + 15000;
        let nextProgressAt = stressStartedAt + 30000;
        while (Date.now() < stressDeadline && service._pythonProgramActive(programStatus)) {
            await wait(1000);
            const snapshot = await service.getStatus({includeProgramStatus: true});
            programStatus = snapshot.programStatus;
            if (Date.now() >= nextProgressAt) {
                console.log(JSON.stringify({
                    phase: 'stress',
                    elapsedSeconds: Math.round((Date.now() - stressStartedAt) / 1000),
                    generatedFrames: producer.count(),
                    sentSequence: service.getVisionPublisherState().sequence,
                    programState: programStatus.state
                }));
                nextProgressAt += 30000;
            }
        }
        const stressGeneratedFrames = producer.count();
        producer.stop();
        producer = null;
        assert.strictEqual(programStatus.state, constants.PYTHON_PROGRAM_STATE_COMPLETED);
        assert.strictEqual(programStatus.error, 0);
        assert.ok(
            programStatus.resultValue >= stressSeconds * 7,
            `runtime observed only ${programStatus.resultValue} unique visual updates`
        );
        const stressUpdates = visionActions.filter(entry => (
            entry.action === constants.VISION_SENSOR_ACTION_UPDATE &&
            entry.at >= stressStartedAt
        )).length;
        assert.ok(stressUpdates <= (stressSeconds * 10) + 15, 'publisher exceeded the 10 Hz limit');
        assert.ok(stressUpdates < stressGeneratedFrames / 2, 'latest-frame publisher did not collapse 30 FPS input');

        await service._tryClearVisionOnDeviceNow(constants.VISION_SENSOR_CLEAR_REASON_PROGRAM_STOPPED);

        const endlessSource = [
            'import est_runtime as rt',
            'while True:',
            '    rt.sleep(0.05)',
            ''
        ].join('\n');
        await service.uploadPython(endlessSource);
        producer = startProducer(service);
        await wait(100);
        await service._withVisionSuspended(
            () => service._runReadyProgramNow(constants.PYTHON_PROGRAM_NO_TIMEOUT_MS)
        );
        await wait(1000);
        const stopStartedAt = Date.now();
        const stopped = await service.stopCurrentProgram();
        const stopElapsedMs = Date.now() - stopStartedAt;
        producer.stop();
        producer = null;
        assert.strictEqual(stopped.state, constants.PYTHON_PROGRAM_STATE_STOPPED);
        assert.ok(stopElapsedMs < 1500, `STOP took ${stopElapsedMs} ms`);
        const afterStopVision = await service.getVisionStatus();
        assert.strictEqual(afterStopVision.state, constants.VISION_SENSOR_STATE_EMPTY);

        await service.uploadPython(endlessSource);
        producer = startProducer(service);
        await wait(100);
        await service._withVisionSuspended(
            () => service._runReadyProgramNow(constants.PYTHON_PROGRAM_NO_TIMEOUT_MS)
        );
        await wait(1000);
        const downloadStartedAt = Date.now();
        const replacementSource = 'import est\nest._program_result(130)\n';
        const upload = await service.uploadPython(replacementSource);
        const downloadFinishedAt = Date.now();
        const updatesDuringDownload = visionActions.filter(entry => (
            entry.action === constants.VISION_SENSOR_ACTION_UPDATE &&
            entry.at >= downloadStartedAt &&
            entry.at <= downloadFinishedAt
        ));
        const clearsDuringDownload = visionActions.filter(entry => (
            entry.action === constants.VISION_SENSOR_ACTION_CLEAR &&
            entry.at >= downloadStartedAt &&
            entry.at <= downloadFinishedAt
        ));
        producer.stop();
        producer = null;
        assert.strictEqual(upload.status.state, constants.PYTHON_PROGRAM_STATE_READY);
        assert.strictEqual(updatesDuringDownload.length, 0, 'vision UPDATE entered the upload window');
        assert.ok(clearsDuringDownload.length >= 1, 'program transition did not clear vision state');

        console.log(JSON.stringify({
            firmwareVersion: connection.firmwareVersion,
            protocol: `${connection.status.protocolMajor}.${connection.status.protocolMinor}`,
            stressSeconds,
            sourceTargetFramesPerSecond: 30,
            sourceGeneratedFrames: stressGeneratedFrames,
            hidUpdates: stressUpdates,
            runtimeUniqueUpdates: programStatus.resultValue,
            stopElapsedMs,
            updatesDuringDownload: updatesDuringDownload.length,
            clearsDuringDownload: clearsDuringDownload.length
        }, null, 2));
    } finally {
        if (producer) {
            producer.stop();
        }
        if (service.transport) {
            if (service.pythonProgramActive) {
                await service.stopCurrentProgram().catch(() => null);
            }
            await service._withVisionSuspended(async () => {
                const status = await service._pythonProgramActionNow(buildPythonProgramClearFrame());
                service._requirePythonProgramSuccess(status, 'clear RAM stress program');
            }).catch(() => null);
            await service.disconnect();
        }
    }
};

if (process.env.EST_VISION_STRESS_CHILD === '1') {
    runChild().catch(error => {
        console.error(error && error.stack ? error.stack : error);
        process.exit(1);
    });
} else {
    const result = spawnSync(electronPath, [__filename], {
        cwd: projectRoot,
        env: {
            ...process.env,
            ELECTRON_RUN_AS_NODE: '1',
            EST_VISION_STRESS_CHILD: '1'
        },
        stdio: 'inherit',
        windowsHide: true
    });
    if (result.error) {
        throw result.error;
    }
    process.exit(result.status === null ? 1 : result.status);
}
