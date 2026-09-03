const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const os = require('os');
const path = require('path');
const babel = require('@babel/core');
const validateProject = require('scratch-parser');

const estRoots = [
    path.resolve(__dirname, '..', 'src', 'main', 'est'),
    path.resolve(__dirname, '..', 'src', 'renderer', 'est-blocks'),
    path.resolve(__dirname, '..', 'src', 'renderer', 'est-project'),
    path.resolve(__dirname, '..', 'src', 'renderer')
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
const estRendererRoot = estRoots[3];
const estBlockAssetsRoot = path.join(estBlocksRoot);

const {
    buildPersistentProgramLoadFrame,
    buildPersistentProgramSaveFrame,
    buildPersistentProgramStatusFrame,
    batteryPercentFromSampleMv,
    buildPythonProgramBeginFrame,
    buildPythonProgramChunkFrame,
    buildPythonProgramClearFrame,
    buildPythonProgramRunFrame,
    buildPythonProgramStatusFrame,
    buildPythonProgramStopFrame,
    buildFrame,
    capabilityNamesFor,
    checkDeviceCompatibility,
    checkProgramFirmwareCompatibility,
    compareEstFirmwareVersions,
    checksum,
    crc32,
    EST_PROGRAM_AUDIO_API_MIN_FIRMWARE_VERSION,
    EST_PROGRAM_DUAL_SPEED_API_MIN_FIRMWARE_VERSION,
    EST_PROGRAM_DISPLAY_TEXT_API_MIN_FIRMWARE_VERSION,
    EST_PROGRAM_LINE_FOLLOW_API_MIN_FIRMWARE_VERSION,
    EST_PROGRAM_RUNTIME_API_MIN_FIRMWARE_VERSION,
    EST_PROGRAM_SENSOR_WAIT_API_MIN_FIRMWARE_VERSION,
    isEstFirmwareVersionAtLeast,
    isEstDevice,
    parseEstFirmwareVersion,
    parseDeviceStatusResponse,
    parseFrame,
    parseHeartbeatResponse,
    parsePersistentProgramResponse,
    parsePythonProgramResponse,
    programMinimumFirmwareVersionForSource,
    programRequiredCapabilitiesForSource,
    programUnsupportedRuntimeFeaturesForSource,
    splitReports
} = require(path.join(estRoot, 'protocol.js'));
const {
    buildFlashCommandArgs,
    EST_FIRMWARE_UPDATE_TARGETS,
    resolveFirmwareUpdatePackage,
    resolveLatestEstOsPackage,
    resolveLegacyEstPackage
} = require(path.join(estRoot, 'firmware-update-service.js'));
const {
    CAPABILITY_AUDIO_RESOURCE_FLASH,
    CAPABILITY_AUDIO_PLAYBACK,
    CAPABILITY_COOPERATIVE_MULTITASK,
    CAPABILITY_DISPLAY_FONT_STYLES,
    CAPABILITY_FROZEN_EST_RUNTIME,
    CAPABILITY_HOLD_POSITION_CONTROL,
    CAPABILITY_MOTOR_CONTROL,
    CAPABILITY_MOTOR_PAIR_POSITION,
    CAPABILITY_MOTOR_STALL_DETECTION,
    CAPABILITY_RUNTIME_BASIC_EVENT_HATS,
    CAPABILITY_TEMPERATURE_SENSOR,
    CAPABILITY_UNLIMITED_PYTHON_RUN,
    CAPABILITY_ZERO_SPEED_MOTOR_CONTROL,
    COMMAND_DEVICE_STATUS,
    COMMAND_PERSISTENT_PROGRAM,
    COMMAND_PYTHON_PROGRAM,
    EST_ALLOW_ALL_FIRMWARE_VERSIONS,
    EST_PROGRAM_COMPATIBILITY_TABLE,
    PYTHON_PROGRAM_NO_TIMEOUT_MS
} = require(path.join(estRoot, 'constants.js'));
const {EstDeviceService} = require(path.join(estRoot, 'device-service.js'));
const {
    ALL_EST_BLOCK_IDS,
    CATEGORY_BLOCK_IDS,
    CATEGORY_COLOURS,
    DISPLAY_IMAGE_THUMBNAILS,
    DRIVE_COLOURS,
    EST_STEERING_DIAL_COLOURS,
    EST_STEERING_FIELD_TYPE,
    EST_STEERING_LIMIT,
    EST_STEERING_PICKER_ID,
    EST_DRIVE_PORT_PICKER_ID,
    EST_IR_FIXED_CHANNEL_EXTENSION,
    EST_MOTOR_PORT_PICKER_ID,
    EST_REPLACED_OPENBLOCK_BLOCK_IDS,
    EST_SENSOR_PORT_PICKER_ID,
    EST_SUPPORT_BLOCK_IDS,
    FIXED_IR_REMOTE_CHANNEL,
    MOTOR_COLOURS,
    configureEstWorkspaceControls,
    formatSteeringDisplayText,
    isSteeringDialMarkVisible,
    makeEstBlockDefinitions,
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
    EST_PROGRAM_NAME_MAX_BYTES,
    buildEstProgramRequest,
    normalizeEstProgramName,
    utf8ByteLength
} = require(path.join(estRendererRoot, 'est-program-name.js'));
const {
    EST_EDITOR_MESSAGE_OVERRIDES,
    EST_LOCALE_CHANGED_EVENT,
    EST_LOCALE_NAMES,
    getEstLocaleOptions,
    getEstLocalizedOptions,
    getEstText,
    normalizeEstLocale,
    setCurrentEstLocale
} = require(path.join(estRendererRoot, 'est-i18n.js'));
const {
    registerEstPythonGenerator,
    stackNameForBlock
} = require(path.join(estBlocksRoot, 'python-generator.js'));

const EST_PROGRAM_REQUIRED_CAPABILITIES = (
    CAPABILITY_FROZEN_EST_RUNTIME |
    CAPABILITY_UNLIMITED_PYTHON_RUN |
    CAPABILITY_DISPLAY_FONT_STYLES |
    CAPABILITY_ZERO_SPEED_MOTOR_CONTROL
) >>> 0;
const EST_TEMPERATURE_PROGRAM_REQUIRED_CAPABILITIES = (
    EST_PROGRAM_REQUIRED_CAPABILITIES |
    CAPABILITY_TEMPERATURE_SENSOR
) >>> 0;
const EST_COOPERATIVE_PROGRAM_REQUIRED_CAPABILITIES = (
    EST_PROGRAM_REQUIRED_CAPABILITIES |
    CAPABILITY_COOPERATIVE_MULTITASK
) >>> 0;
const EST_BASIC_EVENT_HATS_PROGRAM_REQUIRED_CAPABILITIES = (
    EST_PROGRAM_REQUIRED_CAPABILITIES |
    CAPABILITY_RUNTIME_BASIC_EVENT_HATS
) >>> 0;
const EST_MOTOR_STALL_PROGRAM_REQUIRED_CAPABILITIES = (
    EST_PROGRAM_REQUIRED_CAPABILITIES |
    CAPABILITY_MOTOR_STALL_DETECTION
) >>> 0;

assert.strictEqual(EST_PROGRAM_NAME_MAX_BYTES, 31);
const englishProgramRequest = buildEstProgramRequest({
    projectTitle: 'Line Follower.ests',
    slot: 2,
    source: 'import est_runtime as rt\n'
});
assert.deepStrictEqual(englishProgramRequest, {
    programName: 'Line Follower',
    slot: 2,
    source: 'import est_runtime as rt\n'
});
const runProgramRequest = buildEstProgramRequest({
    projectTitle: 'RunProject',
    slot: 5,
    source: 'rt.run()\n'
});
assert.strictEqual(runProgramRequest.programName, 'RunProject');
assert.strictEqual(normalizeEstProgramName('巡线项目', 0), '巡线项目');
assert.ok(utf8ByteLength(normalizeEstProgramName('巡线项目', 0)) <= EST_PROGRAM_NAME_MAX_BYTES);
const truncatedChineseName = normalizeEstProgramName('一二三四五六七八九十十一', 4);
assert.strictEqual(truncatedChineseName, '一二三四五六七八九十');
assert.ok(utf8ByteLength(truncatedChineseName) <= EST_PROGRAM_NAME_MAX_BYTES);
const truncatedEmojiName = normalizeEstProgramName('😀😀😀😀😀😀😀😀', 7);
assert.strictEqual(truncatedEmojiName, '😀😀😀😀😀😀😀');
assert.ok(utf8ByteLength(truncatedEmojiName) <= EST_PROGRAM_NAME_MAX_BYTES);
assert.ok(!truncatedEmojiName.includes('\uFFFD'));
assert.strictEqual(normalizeEstProgramName('   .ests  ', 6), 'Program 6');
assert.strictEqual(normalizeEstProgramName('C:\\Users\\EST\\机器狗.ESTS', 1), '机器狗');
assert.strictEqual(normalizeEstProgramName('A\0B.ests', 3), 'AB');

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
assert.deepStrictEqual(
    Object.keys(DISPLAY_IMAGE_THUMBNAILS).sort(),
    DISPLAY_IMAGE_IDS.slice().sort()
);
assert.ok(DISPLAY_IMAGE_THUMBNAILS['Eyes/Neutral'].startsWith('data:image/bmp;base64,'));
assert.ok(DISPLAY_IMAGE_THUMBNAILS['Expressions/Big smile'].startsWith('data:image/bmp;base64,'));

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
assert.strictEqual(deviceStatus.batteryPercent, 7);
assert.strictEqual(batteryPercentFromSampleMv(0), 0);
assert.strictEqual(batteryPercentFromSampleMv(1500), 0);
assert.strictEqual(batteryPercentFromSampleMv(2047), 87);
assert.strictEqual(batteryPercentFromSampleMv(2100), 100);
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
assert.match(oldProtocolCompatibility.message, /requires 1\.20 or newer/);

const supportedStatus = {...deviceStatus, protocolMinor: 20};
assert.strictEqual(checkDeviceCompatibility(supportedStatus).compatible, true);
assert.strictEqual(
    checkDeviceCompatibility(supportedStatus, CAPABILITY_MOTOR_CONTROL).compatible,
    true
);
const missingPairControl = checkDeviceCompatibility(supportedStatus, CAPABILITY_MOTOR_PAIR_POSITION);
assert.strictEqual(missingPairControl.compatible, false);
assert.strictEqual(missingPairControl.missingCapabilities, CAPABILITY_MOTOR_PAIR_POSITION);
const m110AStatus = {
    ...supportedStatus,
    capabilities: 0,
    firmwareVersion: 'M1.10A'
};
assert.strictEqual(EST_ALLOW_ALL_FIRMWARE_VERSIONS, true);
assert.deepStrictEqual(Object.keys(EST_PROGRAM_COMPATIBILITY_TABLE), [
    'M1.10A',
    'M1.10B',
    'M1.10C',
    'M1.12A',
    'M1.13A',
    'M1.14A',
    'M1.21A',
    'M1.22D',
    'M1.22E',
    'M1.22H',
    'M1.22I',
    'M1.22J',
    'M1.22K',
    'M1.22L',
    'M1.22M',
    'M1.22U',
    'M1.22V',
    'M1.23D',
    'M1.23E',
    'M1.23F',
    'M1.23G',
    'M1.23H',
    'M1.23I',
    'M1.23J',
    'M1.23K',
    'M1.23L',
    'M1.23M',
    'M1.24A'
]);
assert.deepStrictEqual(EST_PROGRAM_COMPATIBILITY_TABLE['M1.22H'], {protocolMajor: 1, protocolMinor: 26});
assert.deepStrictEqual(EST_PROGRAM_COMPATIBILITY_TABLE['M1.22I'], {protocolMajor: 1, protocolMinor: 26});
assert.deepStrictEqual(EST_PROGRAM_COMPATIBILITY_TABLE['M1.24A'], {protocolMajor: 1, protocolMinor: 27});
assert.deepStrictEqual(parseEstFirmwareVersion('M1.22E'), {
    family: 'M',
    major: 1,
    minor: 22,
    suffix: 'E',
    suffixRank: 5
});
assert.deepStrictEqual(parseEstFirmwareVersion('M1.22D'), {
    family: 'M',
    major: 1,
    minor: 22,
    suffix: 'D',
    suffixRank: 4
});
assert.deepStrictEqual(parseEstFirmwareVersion('M1.22H'), {
    family: 'M',
    major: 1,
    minor: 22,
    suffix: 'H',
    suffixRank: 8
});
assert.strictEqual(compareEstFirmwareVersions('M1.22E', 'M1.22D') > 0, true);
assert.strictEqual(compareEstFirmwareVersions('M1.22D', 'M1.22E') < 0, true);
assert.strictEqual(compareEstFirmwareVersions('M1.22H', 'M1.22E') > 0, true);
assert.strictEqual(compareEstFirmwareVersions('M1.22I', 'M1.22H') > 0, true);
assert.strictEqual(compareEstFirmwareVersions('M1.23A', 'M1.22E') > 0, true);
assert.strictEqual(compareEstFirmwareVersions('X1.22E', 'M1.22E'), null);
assert.strictEqual(isEstFirmwareVersionAtLeast('M1.22E', 'M1.22E'), true);
assert.strictEqual(isEstFirmwareVersionAtLeast('M1.22D', 'M1.22E'), false);
assert.strictEqual(isEstFirmwareVersionAtLeast('M1.22H', 'M1.22E'), true);

const firmwareFixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'est-firmware-packages-'));
try {
    const releasePackageDir = path.join(firmwareFixtureRoot, 'firmware', 'releases', 'M1.22A');
    const buildPackageDir = path.join(
        firmwareFixtureRoot,
        'firmware',
        'minimal_upgrade_app',
        'build',
        'm122y_pair_pi_candidate'
    );
    const legacyPackageDir = path.join(firmwareFixtureRoot, 'firmware', 'official_est3_app', 'build');
    fs.mkdirSync(releasePackageDir, {recursive: true});
    fs.mkdirSync(buildPackageDir, {recursive: true});
    fs.mkdirSync(legacyPackageDir, {recursive: true});
    fs.writeFileSync(path.join(releasePackageDir, 'est_minimal_upgrade_app_m122a.manifest.json'), JSON.stringify({
        sha256: 'release-sha',
        version: 'M1.22A'
    }));
    fs.writeFileSync(path.join(releasePackageDir, 'est_minimal_upgrade_app_m122a.upgrade.bin'), 'release');
    fs.writeFileSync(path.join(buildPackageDir, 'est_minimal_upgrade_app.manifest.json'), JSON.stringify({
        sha256: 'latest-sha',
        version: 'M1.22Y'
    }));
    fs.writeFileSync(path.join(buildPackageDir, 'est_minimal_upgrade_app.upgrade.bin'), 'latest');
    fs.writeFileSync(path.join(legacyPackageDir, 'EST_Main_V3_official.manifest.json'), JSON.stringify({
        sha256: 'legacy-sha',
        version: '03.02A'
    }));
    fs.writeFileSync(path.join(legacyPackageDir, 'EST_Main_V3_official.upgrade.bin'), 'legacy');

    const latestPackage = resolveLatestEstOsPackage([firmwareFixtureRoot]);
    assert.strictEqual(latestPackage.targetVersion, 'M1.22Y');
    assert.strictEqual(latestPackage.sha256, 'latest-sha');
    assert.ok(latestPackage.packagePath.endsWith('est_minimal_upgrade_app.upgrade.bin'));
    const legacyPackage = resolveLegacyEstPackage([firmwareFixtureRoot]);
    assert.strictEqual(legacyPackage.targetVersion, '03.02A');
    assert.strictEqual(legacyPackage.sha256, 'legacy-sha');
    assert.strictEqual(
        resolveFirmwareUpdatePackage(EST_FIRMWARE_UPDATE_TARGETS.LATEST_OS, {
            firmwareRoot: firmwareFixtureRoot
        }).targetVersion,
        'M1.22Y'
    );
    assert.strictEqual(
        resolveFirmwareUpdatePackage(EST_FIRMWARE_UPDATE_TARGETS.LEGACY_EST, {
            firmwareRoot: firmwareFixtureRoot
        }).targetVersion,
        '03.02A'
    );
    const upgradeArgs = buildFlashCommandArgs(
        {args: []},
        latestPackage,
        EST_FIRMWARE_UPDATE_TARGETS.LATEST_OS
    );
    assert.ok(upgradeArgs.includes('--force'));
    const downgradeArgs = buildFlashCommandArgs(
        {args: ['-3']},
        legacyPackage,
        EST_FIRMWARE_UPDATE_TARGETS.LEGACY_EST
    );
    assert.ok(downgradeArgs.includes('--force'));
} finally {
    fs.rmSync(firmwareFixtureRoot, {recursive: true, force: true});
}
assert.deepStrictEqual(
    {
        compatible: checkProgramFirmwareCompatibility(m110AStatus).compatible,
        enforcementEnabled: checkProgramFirmwareCompatibility(m110AStatus).enforcementEnabled,
        programCompatible: checkProgramFirmwareCompatibility(m110AStatus).programCompatible,
        verified: checkProgramFirmwareCompatibility(m110AStatus).verified
    },
    {compatible: true, enforcementEnabled: false, programCompatible: false, verified: true}
);
assert.strictEqual(checkProgramFirmwareCompatibility({
    ...m110AStatus,
    firmwareVersion: 'M1.10B'
}).compatible, true);
assert.strictEqual(checkProgramFirmwareCompatibility({
    ...m110AStatus,
    firmwareVersion: 'M1.10C'
}).compatible, true);
assert.strictEqual(checkProgramFirmwareCompatibility({
    ...m110AStatus,
    firmwareVersion: 'M1.09A',
    protocolMinor: 19
}).compatible, true);
assert.strictEqual(checkProgramFirmwareCompatibility({
    ...m110AStatus,
    firmwareVersion: 'M1.09A',
    protocolMinor: 19
}).programCompatible, false);
const unknownNewFirmware = checkProgramFirmwareCompatibility({
    ...m110AStatus,
    firmwareVersion: 'M1.11A',
    protocolMinor: 21
});
assert.strictEqual(unknownNewFirmware.compatible, true);
assert.strictEqual(unknownNewFirmware.knownFirmware, false);
assert.strictEqual(unknownNewFirmware.programCompatible, false);
assert.strictEqual(unknownNewFirmware.verified, false);
assert.strictEqual(checkProgramFirmwareCompatibility({
    ...m110AStatus,
    protocolMinor: 21
}).compatible, true);
assert.strictEqual(checkProgramFirmwareCompatibility(null).compatible, true);
assert.strictEqual(checkProgramFirmwareCompatibility(null).programCompatible, false);
const m112AStatus = {
    ...supportedStatus,
    capabilities: EST_PROGRAM_REQUIRED_CAPABILITIES,
    firmwareVersion: 'M1.12A',
    protocolMinor: 21
};
const m112ACompatibility = checkProgramFirmwareCompatibility(m112AStatus);
assert.strictEqual(m112ACompatibility.compatible, true);
assert.strictEqual(m112ACompatibility.programCompatible, true);
assert.strictEqual(m112ACompatibility.programProtocolCompatible, true);
assert.strictEqual(m112ACompatibility.missingProgramCapabilities, 0);
assert.strictEqual(m112ACompatibility.requiredProgramCapabilities, EST_PROGRAM_REQUIRED_CAPABILITIES);
assert.strictEqual(programRequiredCapabilitiesForSource('import est_runtime as rt\nvalue = 1\n'), 0);
assert.strictEqual(EST_PROGRAM_RUNTIME_API_MIN_FIRMWARE_VERSION, 'M1.22E');
assert.strictEqual(EST_PROGRAM_DISPLAY_TEXT_API_MIN_FIRMWARE_VERSION, 'M1.22I');
assert.strictEqual(EST_PROGRAM_DUAL_SPEED_API_MIN_FIRMWARE_VERSION, 'M1.22L');
assert.strictEqual(EST_PROGRAM_SENSOR_WAIT_API_MIN_FIRMWARE_VERSION, 'M1.22M');
assert.strictEqual(EST_PROGRAM_LINE_FOLLOW_API_MIN_FIRMWARE_VERSION, 'M1.22V');
assert.strictEqual(EST_PROGRAM_AUDIO_API_MIN_FIRMWARE_VERSION, 'M1.23D');
assert.strictEqual(programMinimumFirmwareVersionForSource('import est_runtime as rt\nvalue = 1\n'), null);
assert.strictEqual(
    programMinimumFirmwareVersionForSource('import est_runtime as rt\nrt.motor_start_speed("A", speed)\n'),
    'M1.22E'
);
assert.strictEqual(
    programMinimumFirmwareVersionForSource('import est_runtime as rt\nrt.motor_start_power("A", power)\n'),
    'M1.22E'
);
assert.strictEqual(
    programMinimumFirmwareVersionForSource('import est\nest.display.text_line(1, "EST")\n'),
    null
);
assert.strictEqual(
    programMinimumFirmwareVersionForSource('import est_runtime as rt\nrt.display_text(1, 2, value)\n'),
    'M1.22I'
);
assert.strictEqual(
    programMinimumFirmwareVersionForSource('import est_runtime as rt\nrt.display_text_line(1, value)\n'),
    'M1.22I'
);
assert.strictEqual(
    programMinimumFirmwareVersionForSource('import est_runtime as rt\nrt.drive_start_dual_speed(0, 50)\n'),
    'M1.22L'
);
assert.strictEqual(
    programMinimumFirmwareVersionForSource('import est_runtime as rt\nrt.drive_dual_speed_for(50, 25, 2, "rotations")\n'),
    'M1.22L'
);
assert.strictEqual(
    programMinimumFirmwareVersionForSource(
        'import est_runtime as rt\nrt.line_follow_init()\n' +
        'rt.line_follow_dual_power_step(a, b, 30, 30, 1, 0.01)\n'
    ),
    'M1.22V'
);
assert.strictEqual(
    programMinimumFirmwareVersionForSource(
        'import est_runtime as rt\nrt.drive_start_dual_power(left, right)\n'
    ),
    'M1.22V'
);
assert.strictEqual(
    programMinimumFirmwareVersionForSource('import est\nest.audio.play("Piano/C4", wait=True)\n'),
    'M1.23D'
);
assert.strictEqual(
    programMinimumFirmwareVersionForSource(
        'import est\nimport est_runtime as rt\nest.audio.play("Piano/C4")\n' +
        'rt.line_follow_dual_power_step(a, b, 30, 30, 1, 0.01)\n'
    ),
    'M1.23D'
);
assert.strictEqual(
    programMinimumFirmwareVersionForSource(
        'import est_runtime as rt\nrt.line_follow_dual_step(a, b, 30, 30, 1, 0.01)\n'
    ),
    'M1.22U'
);
[
    "await rt.wait_brick_button('confirm', 'pressed')",
    "await rt.wait_color(3, 'red')",
    "await rt.wait_touch(1, 'pressed')",
    "await rt.wait_ultrasonic(4, 'less', 15, 'centimeters')",
    "await rt.wait_ir_proximity(4, 'less', 15)",
    "await rt.wait_ir_beacon_button(4, 1, 'active')",
    "await rt.wait_gyro(2, 'greater', 45)"
].forEach(source => {
    assert.strictEqual(programMinimumFirmwareVersionForSource(source), 'M1.22M');
});
assert.strictEqual(
    programMinimumFirmwareVersionForSource(
        'import est_runtime as rt\nrt.motor_start_speed("A", speed)\nrt.display_text_line(1, value)\n'
    ),
    'M1.22I'
);
assert.strictEqual(
    programRequiredCapabilitiesForSource('import est_runtime as rt\nvalue = rt.temperature(port).celsius()\n'),
    CAPABILITY_TEMPERATURE_SENSOR
);
assert.strictEqual(
    programRequiredCapabilitiesForSource(Buffer.from('value = rt.temperature(port).fahrenheit()\n', 'utf8')),
    CAPABILITY_TEMPERATURE_SENSOR
);
assert.strictEqual(
    programRequiredCapabilitiesForSource('import est_runtime as rt\nblocked = rt.motor_stalled("A")\n'),
    CAPABILITY_MOTOR_STALL_DETECTION
);
assert.strictEqual(
    programRequiredCapabilitiesForSource('import est\nest.audio.play("Piano/C4")\n'),
    CAPABILITY_AUDIO_PLAYBACK
);
assert.strictEqual(
    programRequiredCapabilitiesForSource(
        '@rt.on_start\nasync def stack_1():\n  await rt.sleep(1)\nrt.run()\n'
    ),
    CAPABILITY_COOPERATIVE_MULTITASK
);
assert.strictEqual(
    programRequiredCapabilitiesForSource(
        '@rt.on_brick_button("confirm", "pressed")\ndef stack_1():\n  pass\nrt.run()\n'
    ),
    CAPABILITY_RUNTIME_BASIC_EVENT_HATS
);
assert.strictEqual(
    programRequiredCapabilitiesForSource(
        '@rt.on_condition(lambda: ready)\nasync def stack_1():\n  await rt.sleep(1)\nrt.run()\n'
    ),
    (CAPABILITY_RUNTIME_BASIC_EVENT_HATS | CAPABILITY_COOPERATIVE_MULTITASK) >>> 0
);
assert.strictEqual(
    programRequiredCapabilitiesForSource(
        '@rt.on_timer_gt(1)\ndef stack_1():\n  pass\nrt.run()\n'
    ),
    CAPABILITY_RUNTIME_BASIC_EVENT_HATS
);
assert.strictEqual(
    programRequiredCapabilitiesForSource(
        '@rt.on_start\ndef stack_1():\n  rt.stop("this_stack")\nrt.run()\n'
    ),
    CAPABILITY_COOPERATIVE_MULTITASK
);
assert.strictEqual(
    programRequiredCapabilitiesForSource(
        '@rt.on_start\ndef stack_1():\n  pass\n@rt.on_start\ndef stack_2():\n  pass\nrt.run()\n'
    ),
    CAPABILITY_COOPERATIVE_MULTITASK
);
assert.deepStrictEqual(
    programUnsupportedRuntimeFeaturesForSource('import est_runtime as rt\nrt.drive_start_dual_speed(0, 50)\n')
        .map(feature => feature.id),
    []
);
assert.deepStrictEqual(
    programUnsupportedRuntimeFeaturesForSource(
        "import est_runtime as rt\nrt.drive_dual_speed_for(left_speed, right_speed, 3, 'seconds')\n"
    ).map(feature => feature.id),
    []
);
assert.deepStrictEqual(
    programUnsupportedRuntimeFeaturesForSource(
        "import est_runtime as rt\n@rt.on_ir_beacon_button('4', 1, 'active')\ndef stack_1():\n  pass\n"
    ).map(feature => feature.id),
    ['on_ir_beacon_button']
);
assert.deepStrictEqual(
    programUnsupportedRuntimeFeaturesForSource(
        "import est_runtime as rt\nvalue = rt.infrared('4').beacon_heading(1)\n"
    ).map(feature => feature.id),
    ['infrared_beacon_heading']
);
assert.deepStrictEqual(
    programUnsupportedRuntimeFeaturesForSource(
        "import est_runtime as rt\nvalue = rt.ir_beacon_compare('4', 1, 'heading', 'less', 0)\n"
    ).map(feature => feature.id),
    ['ir_beacon_compare']
);
assert.deepStrictEqual(
    programUnsupportedRuntimeFeaturesForSource(
        "import est_runtime as rt\nok = rt.compare(rt.color('3').reflection(), 'changed', 1)\n"
    ).map(feature => feature.id),
    ['compare_changed']
);
assert.deepStrictEqual(
    programUnsupportedRuntimeFeaturesForSource(
        "import est_runtime as rt\nrt.broadcast('message_1', wait=False)\nrt.wait_color('3', 'red')\n"
    ).map(feature => feature.id),
    ['broadcast']
);
assert.deepStrictEqual(
    programUnsupportedRuntimeFeaturesForSource(
        "import est_runtime as rt\nrt.wait_touch(1, 'pressed')\nrt.wait_gyro(2, 'greater', 45)\n"
    ),
    []
);
assert.deepStrictEqual(
    programUnsupportedRuntimeFeaturesForSource(
        "import est_runtime as rt\nrt.drive_start_steer(0)\nrt.wait_until(lambda: ready)\n"
    ),
    []
);
const missingTemperatureCompatibility = checkProgramFirmwareCompatibility(
    m112AStatus,
    CAPABILITY_TEMPERATURE_SENSOR
);
assert.strictEqual(missingTemperatureCompatibility.programCompatible, false);
assert.strictEqual(missingTemperatureCompatibility.programProtocolCompatible, false);
assert.strictEqual(missingTemperatureCompatibility.requiredProgramProtocolMinor, 24);
assert.strictEqual(
    missingTemperatureCompatibility.requiredProgramCapabilities,
    EST_TEMPERATURE_PROGRAM_REQUIRED_CAPABILITIES
);
assert.strictEqual(missingTemperatureCompatibility.missingProgramCapabilities, CAPABILITY_TEMPERATURE_SENSOR);
assert.deepStrictEqual(missingTemperatureCompatibility.missingProgramCapabilityNames, ['runtime-temperature']);
const m114ATemperatureStatus = {
    ...m112AStatus,
    firmwareVersion: 'M1.14A',
    protocolMinor: 24,
    capabilities: EST_TEMPERATURE_PROGRAM_REQUIRED_CAPABILITIES
};
assert.strictEqual(
    checkProgramFirmwareCompatibility(m114ATemperatureStatus, CAPABILITY_TEMPERATURE_SENSOR).programCompatible,
    true
);
const missingMotorStallCompatibility = checkProgramFirmwareCompatibility(
    m112AStatus,
    CAPABILITY_MOTOR_STALL_DETECTION
);
assert.strictEqual(missingMotorStallCompatibility.programCompatible, false);
assert.strictEqual(missingMotorStallCompatibility.programProtocolCompatible, false);
assert.strictEqual(missingMotorStallCompatibility.requiredProgramProtocolMinor, 26);
assert.strictEqual(
    missingMotorStallCompatibility.requiredProgramCapabilities,
    EST_MOTOR_STALL_PROGRAM_REQUIRED_CAPABILITIES
);
assert.strictEqual(
    missingMotorStallCompatibility.missingProgramCapabilities,
    CAPABILITY_MOTOR_STALL_DETECTION
);
assert.deepStrictEqual(
    missingMotorStallCompatibility.missingProgramCapabilityNames,
    ['motor-stall-detection']
);
const m121AMotorStallStatus = {
    ...m112AStatus,
    firmwareVersion: 'M1.21A',
    protocolMinor: 26,
    capabilities: EST_MOTOR_STALL_PROGRAM_REQUIRED_CAPABILITIES
};
assert.strictEqual(
    checkProgramFirmwareCompatibility(m121AMotorStallStatus, CAPABILITY_MOTOR_STALL_DETECTION).programCompatible,
    true
);
const m122DStatus = {
    ...m121AMotorStallStatus,
    firmwareVersion: 'M1.22D'
};
const m122EStatus = {
    ...m121AMotorStallStatus,
    firmwareVersion: 'M1.22E'
};
const m122HStatus = {
    ...m121AMotorStallStatus,
    firmwareVersion: 'M1.22H'
};
const m122IStatus = {
    ...m121AMotorStallStatus,
    firmwareVersion: 'M1.22I'
};
const m122LStatus = {
    ...m121AMotorStallStatus,
    firmwareVersion: 'M1.22L'
};
const m122MStatus = {
    ...m121AMotorStallStatus,
    firmwareVersion: 'M1.22M'
};
const m123DStatus = {
    ...m121AMotorStallStatus,
    firmwareVersion: 'M1.23D',
    capabilities: (m121AMotorStallStatus.capabilities | CAPABILITY_AUDIO_PLAYBACK) >>> 0
};
const m122DNewRuntimeApiCompatibility = checkProgramFirmwareCompatibility(
    m122DStatus,
    0,
    EST_PROGRAM_RUNTIME_API_MIN_FIRMWARE_VERSION
);
assert.strictEqual(m122DNewRuntimeApiCompatibility.programCompatible, false);
assert.strictEqual(m122DNewRuntimeApiCompatibility.programProtocolCompatible, true);
assert.strictEqual(m122DNewRuntimeApiCompatibility.programFirmwareVersionCompatible, false);
assert.strictEqual(m122DNewRuntimeApiCompatibility.missingProgramCapabilities, 0);
assert.strictEqual(
    m122DNewRuntimeApiCompatibility.requiredProgramMinimumFirmwareVersion,
    'M1.22E'
);
assert.match(m122DNewRuntimeApiCompatibility.programMessage, /M1\.22D.*M1\.22E/);
assert.strictEqual(
    checkProgramFirmwareCompatibility(
        m122EStatus,
        0,
        EST_PROGRAM_RUNTIME_API_MIN_FIRMWARE_VERSION
    ).programCompatible,
    true
);
assert.strictEqual(
    checkProgramFirmwareCompatibility(
        m122HStatus,
        0,
        EST_PROGRAM_RUNTIME_API_MIN_FIRMWARE_VERSION
    ).programCompatible,
    true
);
assert.strictEqual(
    checkProgramFirmwareCompatibility(
        m122HStatus,
        0,
        EST_PROGRAM_DISPLAY_TEXT_API_MIN_FIRMWARE_VERSION
    ).programCompatible,
    false
);
assert.strictEqual(
    checkProgramFirmwareCompatibility(
        m122IStatus,
        0,
        EST_PROGRAM_DISPLAY_TEXT_API_MIN_FIRMWARE_VERSION
    ).programCompatible,
    true
);
assert.strictEqual(
    checkProgramFirmwareCompatibility(
        m122LStatus,
        0,
        EST_PROGRAM_SENSOR_WAIT_API_MIN_FIRMWARE_VERSION
    ).programCompatible,
    false
);
assert.strictEqual(
    checkProgramFirmwareCompatibility(
        m122MStatus,
        0,
        EST_PROGRAM_SENSOR_WAIT_API_MIN_FIRMWARE_VERSION
    ).programCompatible,
    true
);
assert.strictEqual(
    checkProgramFirmwareCompatibility(
        m122MStatus,
        CAPABILITY_AUDIO_PLAYBACK,
        EST_PROGRAM_AUDIO_API_MIN_FIRMWARE_VERSION
    ).programCompatible,
    false
);
assert.strictEqual(
    checkProgramFirmwareCompatibility(
        m123DStatus,
        CAPABILITY_AUDIO_PLAYBACK,
        EST_PROGRAM_AUDIO_API_MIN_FIRMWARE_VERSION
    ).programCompatible,
    true
);
assert.strictEqual(checkProgramFirmwareCompatibility(m122DStatus).programCompatible, true);
const missingCooperativeCompatibility = checkProgramFirmwareCompatibility(
    m112AStatus,
    CAPABILITY_COOPERATIVE_MULTITASK
);
assert.strictEqual(missingCooperativeCompatibility.programCompatible, false);
assert.strictEqual(missingCooperativeCompatibility.programProtocolCompatible, false);
assert.strictEqual(missingCooperativeCompatibility.requiredProgramProtocolMinor, 25);
assert.strictEqual(
    missingCooperativeCompatibility.requiredProgramCapabilities,
    EST_COOPERATIVE_PROGRAM_REQUIRED_CAPABILITIES
);
assert.strictEqual(missingCooperativeCompatibility.missingProgramCapabilities, CAPABILITY_COOPERATIVE_MULTITASK);
assert.deepStrictEqual(missingCooperativeCompatibility.missingProgramCapabilityNames, ['cooperative-multitask']);
const m114ACooperativeStatus = {
    ...m112AStatus,
    firmwareVersion: 'M1.14A',
    protocolMinor: 25,
    capabilities: EST_COOPERATIVE_PROGRAM_REQUIRED_CAPABILITIES
};
assert.strictEqual(
    checkProgramFirmwareCompatibility(m114ACooperativeStatus, CAPABILITY_COOPERATIVE_MULTITASK).programCompatible,
    true
);
const missingBasicEventHatsCompatibility = checkProgramFirmwareCompatibility(
    m112AStatus,
    CAPABILITY_RUNTIME_BASIC_EVENT_HATS
);
assert.strictEqual(missingBasicEventHatsCompatibility.programCompatible, false);
assert.strictEqual(missingBasicEventHatsCompatibility.programProtocolCompatible, false);
assert.strictEqual(missingBasicEventHatsCompatibility.requiredProgramProtocolMinor, 25);
assert.strictEqual(
    missingBasicEventHatsCompatibility.requiredProgramCapabilities,
    EST_BASIC_EVENT_HATS_PROGRAM_REQUIRED_CAPABILITIES
);
assert.strictEqual(
    missingBasicEventHatsCompatibility.missingProgramCapabilities,
    CAPABILITY_RUNTIME_BASIC_EVENT_HATS
);
assert.deepStrictEqual(
    missingBasicEventHatsCompatibility.missingProgramCapabilityNames,
    ['runtime-basic-event-hats']
);

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
    Array.from(buildPythonProgramRunFrame(PYTHON_PROGRAM_NO_TIMEOUT_MS)),
    Array.from(buildFrame(COMMAND_PYTHON_PROGRAM, Uint8Array.from([3, 0, 0, 0, 0])))
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
const registeredExtensions = {};
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
let fakeDropdownShowCalls = 0;
const FakeFieldDropdown = function () {};
FakeFieldDropdown.prototype.showEditor_ = function () {
    fakeDropdownShowCalls += 1;
    return 'opened';
};
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
    Extensions: {
        ALL_: registeredExtensions,
        register: (type, extension) => {
            registeredExtensions[type] = extension;
        }
    },
    FieldAngle: FakeFieldAngle,
    FieldDropdown: FakeFieldDropdown,
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
assert.strictEqual(FakeFieldDropdown.prototype.showEditor_.call({
    name: 'IMAGE',
    sourceBlock_: {type: 'display_image'}
}), 'opened');
assert.strictEqual(fakeDropdownShowCalls, 1);
assert.strictEqual(typeof registeredExtensions[EST_IR_FIXED_CHANNEL_EXTENSION], 'function');
const legacyInfraredChannelBlock = {
    type: 'sensor_ir_beacon_heading',
    channel: '4',
    getFieldValue: name => (name === 'CHANNEL' ? legacyInfraredChannelBlock.channel : null),
    setFieldValue: (value, name) => {
        if (name === 'CHANNEL') {
            legacyInfraredChannelBlock.channel = value;
        }
    }
};
registeredExtensions[EST_IR_FIXED_CHANNEL_EXTENSION].call(legacyInfraredChannelBlock);
legacyInfraredChannelBlock.onchange({});
assert.strictEqual(legacyInfraredChannelBlock.channel, FIXED_IR_REMOTE_CHANNEL);
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
    motor: 12,
    movement: 13,
    display: 6,
    sound: 6,
    event: 6,
    control: 9,
    sensing: 35
};
assert.deepStrictEqual(
    Object.fromEntries(Object.entries(CATEGORY_BLOCK_IDS).map(([categoryId, blockIds]) => [
        categoryId,
        blockIds.length
    ])),
    expectedCategoryCounts
);
assert.strictEqual(registeredBlockDefinitions.length, 91);
assert.strictEqual(new Set(ALL_EST_BLOCK_IDS).size, 87);
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
    EST_SENSOR_PORT_PICKER_ID
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
const sensorPortPickerDefinition = registeredBlockDefinitions.find(
    definition => definition.type === EST_SENSOR_PORT_PICKER_ID
);
assert.strictEqual(sensorPortPickerDefinition.output, 'String');
assert.strictEqual(sensorPortPickerDefinition.outputShape, fakeScratchBlocks.OUTPUT_SHAPE_ROUND);
assert.strictEqual(sensorPortPickerDefinition.colour, CATEGORY_COLOURS.sensing.secondary);
assert.strictEqual(sensorPortPickerDefinition.colourSecondary, CATEGORY_COLOURS.sensing.secondary);
assert.strictEqual(sensorPortPickerDefinition.colourTertiary, CATEGORY_COLOURS.sensing.tertiary);
assert.deepStrictEqual(
    sensorPortPickerDefinition.args0[0].options.map(option => option[1]),
    ['1', '2', '3', '4']
);
const definitionArguments = definition => Object.keys(definition)
    .filter(key => /^args\d+$/.test(key))
    .reduce((argumentsList, key) => argumentsList.concat(definition[key]), []);
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
assert.strictEqual(formatSteeringDisplayText(-40), '左:-40');
assert.strictEqual(formatSteeringDisplayText(0), '前:0');
assert.strictEqual(formatSteeringDisplayText(40), '右:40');
assert.strictEqual(formatSteeringDisplayText(-120), '左:-100');
assert.strictEqual(formatSteeringDisplayText(120), '右:100');
assert.strictEqual(typeof registeredFields[EST_STEERING_FIELD_TYPE], 'function');
const steeringField = new registeredFields[EST_STEERING_FIELD_TYPE](0);
assert.strictEqual(steeringField.classValidator('-120'), '-100');
assert.strictEqual(steeringField.classValidator('43.6'), '44');
assert.strictEqual(steeringField.classValidator('150'), '100');
assert.strictEqual(steeringField.classValidator('not-a-number'), null);
steeringField.getText = () => '-40';
assert.strictEqual(steeringField.getDisplayText_(), '左:-40');
const blockDefinitionFor = blockId => registeredBlockDefinitions.find(definition => definition.type === blockId);
const soundOptions = definitionArguments(blockDefinitionFor('sound_play'))
    .find(argument => argument.name === 'SOUND').options;
assert.strictEqual(soundOptions.length, 37);
assert.deepStrictEqual(soundOptions[0], ['钢琴 C4', 'Piano/C4']);
assert.deepStrictEqual(soundOptions[1], ['钢琴 C#4', 'Piano/Cs4']);
assert.deepStrictEqual(soundOptions[soundOptions.length - 1], ['钢琴 C7', 'Piano/C7']);
assert.ok(!soundOptions.some(option => option[1] === 'communication_hello'));
assert.strictEqual(EST_LOCALE_NAMES['pt-br'], 'Português (Brasil)');
assert.strictEqual(normalizeEstLocale('pt_BR'), 'pt-br');
assert.strictEqual(getEstText('menu.hardwareStatus', 'pt-br'), 'Status do hardware');
assert.strictEqual(getEstText('firmware.updateButton'), '固件更新');
assert.strictEqual(getEstText('firmware.upgradeEstOs'), '升级EST OS');
assert.strictEqual(getEstText('firmware.downgradeLegacyEst'), '降级旧EST系统');
assert.strictEqual(getEstText('firmware.updateButton', 'pt-br'), 'Atualizar firmware');
assert.deepStrictEqual(getEstLocaleOptions({
    en: {},
    'zh-cn': {},
    'pt-br': {}
}).find(option => option.value === 'pt-br'), {
    label: 'Português (Brasil)',
    value: 'pt-br'
});
assert.strictEqual(formatSteeringDisplayText(-40, 'pt-br'), 'esq.:-40');
assert.strictEqual(formatSteeringDisplayText(40, 'pt-br'), 'dir.:40');
assert.deepStrictEqual(getEstLocalizedOptions('motorDirection', [
    'clockwise',
    'counterclockwise'
], 'pt-br'), [
    ['horario', 'clockwise'],
    ['anti-horario', 'counterclockwise']
]);
const ptBlockDefinitions = makeEstBlockDefinitions(fakeScratchBlocks, 'pt-br');
const ptBlockDefinitionFor = blockId => ptBlockDefinitions.find(definition => definition.type === blockId);
const ptSoundOptions = definitionArguments(ptBlockDefinitionFor('sound_play'))
    .find(argument => argument.name === 'SOUND').options;
assert.deepStrictEqual(ptSoundOptions[1], ['Piano C#4', 'Piano/Cs4']);
const ptMotorStalledDefinition = ptBlockDefinitionFor('motor_stalled');
assert.strictEqual(ptMotorStalledDefinition.message0, '%1 %2 motor %3 esta travado?');
const ptMotorRunForDirection = definitionArguments(ptBlockDefinitionFor('motor_run_for'))
    .find(argument => argument.name === 'DIRECTION');
assert.deepStrictEqual(ptMotorRunForDirection.options, [
    ['horario', 'clockwise'],
    ['anti-horario', 'counterclockwise']
]);
const zhMotorRunForDirection = definitionArguments(blockDefinitionFor('motor_run_for'))
    .find(argument => argument.name === 'DIRECTION');
assert.deepStrictEqual(zhMotorRunForDirection.options, [
    ['顺时针', 'clockwise'],
    ['逆时针', 'counterclockwise']
]);
const ptTemperatureUnit = definitionArguments(ptBlockDefinitionFor('sensor_temperature'))
    .find(argument => argument.name === 'UNIT');
assert.deepStrictEqual(ptTemperatureUnit.options, [
    ['Celsius', 'celsius'],
    ['Fahrenheit', 'fahrenheit']
]);
const ptToolboxCategories = getEstToolboxCategories('pt-br');
assert.match(ptToolboxCategories, /<category[^>]*name="Sensores"/s);
assert.match(ptToolboxCategories, /<category[^>]*name="Reproduzir"/s);
assert.ok(!ptToolboxCategories.includes('name="传感器"'));
const styleForBlock = blockId => Object.entries(CATEGORY_BLOCK_IDS)
    .find(([, blockIds]) => blockIds.includes(blockId))[0];
registeredBlockDefinitions.slice(EST_SUPPORT_BLOCK_IDS.length).forEach(definition => {
    const style = styleForBlock(definition.type);
    assert.strictEqual(definition.colour, CATEGORY_COLOURS[style].primary);
    assert.strictEqual(definition.colourSecondary, CATEGORY_COLOURS[style].secondary);
    assert.strictEqual(definition.colourTertiary, CATEGORY_COLOURS[style].tertiary);
});
const decodeSvgDataUri = source => decodeURIComponent(source.replace(/^data:image\/svg\+xml;utf8,/, ''));
const iconDividerLength = Number((38 * 0.52 * 1.3).toFixed(2));
const assertLeadingBlockIcon = (definition, expectedName, expectedSource, expectedSize = 38) => {
    const style = styleForBlock(definition.type);
    assert.strictEqual(definition.args0[0].type, 'field_image');
    assert.strictEqual(definition.args0[0].name, expectedName);
    assert.strictEqual(definition.args0[0].width, expectedSize);
    assert.strictEqual(definition.args0[0].height, expectedSize);
    assert.match(definition.args0[0].src, expectedSource);
    assert.strictEqual(definition.args0[1].type, 'field_image');
    assert.strictEqual(definition.args0[1].name, 'EST_ICON_DIVIDER');
    assert.strictEqual(definition.args0[1].width, 10);
    assert.strictEqual(definition.args0[1].height, expectedSize);
    const dividerSvg = decodeSvgDataUri(definition.args0[1].src);
    assert.match(dividerSvg, new RegExp(`stroke="${CATEGORY_COLOURS[style].tertiary}"`));
    const dividerTop = Number(((expectedSize - iconDividerLength) / 2).toFixed(2));
    const dividerBottom = Number((dividerTop + iconDividerLength).toFixed(2));
    assert.match(
        dividerSvg,
        new RegExp(`d="M5 ${dividerTop}V${dividerBottom}"`)
    );
    assert.strictEqual(Number((dividerBottom - dividerTop).toFixed(2)), iconDividerLength);
};
CATEGORY_BLOCK_IDS.motor.forEach(blockId => {
    const definition = blockDefinitionFor(blockId);
    const sourcePattern = definition.output ? /est-motor-icon-centered\.svg$/ : /est-motor-icon\.svg$/;
    assertLeadingBlockIcon(definition, 'EST_MOTOR_ICON', sourcePattern);
});
CATEGORY_BLOCK_IDS.movement.forEach(blockId => {
    assertLeadingBlockIcon(blockDefinitionFor(blockId), 'EST_DRIVE_ICON', /est-drive-icon\.svg$/);
});
CATEGORY_BLOCK_IDS.display.forEach(blockId => {
    assertLeadingBlockIcon(blockDefinitionFor(blockId), 'EST_DISPLAY_ICON', /est-display-icon\.svg$/);
});
CATEGORY_BLOCK_IDS.sound.forEach(blockId => {
    assertLeadingBlockIcon(blockDefinitionFor(blockId), 'EST_MUSIC_ICON', /est-music-icon\.svg$/);
});
[
    'event_program_start',
    'event_brick_button',
    'event_condition',
    'event_timer'
].forEach(blockId => {
    assertLeadingBlockIcon(blockDefinitionFor(blockId), 'EST_EVENT_HAT_ICON', /est-event-hat-icon\.svg$/);
});
[
    ['event_broadcast', 'EST_EVENT_HOST_ICON', /est-event-host-icon\.svg$/],
    ['event_broadcast_wait', 'EST_EVENT_HOST_ICON', /est-event-host-icon\.svg$/]
].forEach(([blockId, iconName, sourcePattern]) => {
    assertLeadingBlockIcon(blockDefinitionFor(blockId), iconName, sourcePattern);
});
const sensorIconSource = (definition, filename) => (
    definition.output ?
        new RegExp(`${filename.replace('.svg', '')}-centered\\.svg$`) :
        new RegExp(`${filename.replace('.', '\\.')}$`)
);
[
    ['sensor_brick_button_value', 'EST_SENSOR_BUTTON_ICON', 'est-sensor-button-icon.svg'],
    ['sensor_brick_button_pressed', 'EST_SENSOR_BUTTON_ICON', 'est-sensor-button-icon.svg'],
    ['sensor_wait_brick_button', 'EST_SENSOR_BUTTON_ICON', 'est-sensor-button-icon.svg'],
    ['sensor_color_calibrate_reflection', 'EST_SENSOR_COLOR_ICON', 'est-sensor-color-icon.svg'],
    ['sensor_color_reset_calibration', 'EST_SENSOR_COLOR_ICON', 'est-sensor-color-icon.svg'],
    ['sensor_color_reflection', 'EST_SENSOR_COLOR_ICON', 'est-sensor-color-icon.svg'],
    ['sensor_color_reflection_compare', 'EST_SENSOR_COLOR_ICON', 'est-sensor-color-icon.svg'],
    ['sensor_color_ambient', 'EST_SENSOR_COLOR_ICON', 'est-sensor-color-icon.svg'],
    ['sensor_color_ambient_compare', 'EST_SENSOR_COLOR_ICON', 'est-sensor-color-icon.svg'],
    ['sensor_color_value', 'EST_SENSOR_COLOR_ICON', 'est-sensor-color-icon.svg'],
    ['sensor_color_is', 'EST_SENSOR_COLOR_ICON', 'est-sensor-color-icon.svg'],
    ['sensor_wait_color', 'EST_SENSOR_COLOR_ICON', 'est-sensor-color-icon.svg'],
    ['sensor_temperature', 'EST_SENSOR_TEMPERATURE_ICON', 'est-sensor-temperature-icon.svg'],
    ['sensor_touch_pressed', 'EST_SENSOR_BUTTON_ICON', 'est-sensor-button-icon.svg'],
    ['sensor_wait_touch', 'EST_SENSOR_BUTTON_ICON', 'est-sensor-button-icon.svg'],
    ['sensor_ultrasonic_distance', 'EST_SENSOR_ULTRASONIC_ICON', 'est-sensor-ultrasonic-icon.svg', 46],
    ['sensor_ultrasonic_compare', 'EST_SENSOR_ULTRASONIC_ICON', 'est-sensor-ultrasonic-icon.svg', 46],
    ['sensor_wait_ultrasonic', 'EST_SENSOR_ULTRASONIC_ICON', 'est-sensor-ultrasonic-icon.svg', 46],
    ['sensor_ir_proximity', 'EST_SENSOR_IR_ICON', 'est-sensor-ir-icon.svg', 46],
    ['sensor_ir_proximity_compare', 'EST_SENSOR_IR_ICON', 'est-sensor-ir-icon.svg', 46],
    ['sensor_wait_ir_proximity', 'EST_SENSOR_IR_ICON', 'est-sensor-ir-icon.svg', 46],
    ['sensor_ir_beacon_heading', 'EST_SENSOR_IR_ICON', 'est-sensor-ir-icon.svg', 46],
    ['sensor_ir_beacon_proximity', 'EST_SENSOR_IR_ICON', 'est-sensor-ir-icon.svg', 46],
    ['sensor_ir_beacon_buttons', 'EST_SENSOR_IR_ICON', 'est-sensor-ir-icon.svg', 46],
    ['sensor_ir_beacon_button_pressed', 'EST_SENSOR_IR_ICON', 'est-sensor-ir-icon.svg', 46],
    ['sensor_wait_ir_beacon_button', 'EST_SENSOR_IR_ICON', 'est-sensor-ir-icon.svg', 46],
    ['sensor_ir_beacon_active', 'EST_SENSOR_IR_ICON', 'est-sensor-ir-icon.svg', 46],
    ['sensor_ir_beacon_active_compare', 'EST_SENSOR_IR_ICON', 'est-sensor-ir-icon.svg', 46],
    ['sensor_gyro_angle', 'EST_SENSOR_GYRO_ICON', 'est-sensor-gyro-icon.svg'],
    ['sensor_gyro_rate', 'EST_SENSOR_GYRO_ICON', 'est-sensor-gyro-icon.svg'],
    ['sensor_gyro_reset', 'EST_SENSOR_GYRO_ICON', 'est-sensor-gyro-icon.svg'],
    ['sensor_gyro_compare', 'EST_SENSOR_GYRO_ICON', 'est-sensor-gyro-icon.svg'],
    ['sensor_wait_gyro', 'EST_SENSOR_GYRO_ICON', 'est-sensor-gyro-icon.svg'],
    ['sensor_timer', 'EST_SENSOR_HOST_ICON', 'est-sensor-host-icon.svg'],
    ['sensor_timer_reset', 'EST_SENSOR_HOST_ICON', 'est-sensor-host-icon.svg']
].forEach(([blockId, iconName, filename, expectedSize]) => {
    const definition = blockDefinitionFor(blockId);
    assertLeadingBlockIcon(definition, iconName, sensorIconSource(definition, filename), expectedSize);
});
Object.entries({
    'est-motor-icon.svg': '#005FA0',
    'est-motor-icon-centered.svg': '#005FA0',
    'est-drive-icon.svg': '#A9007A',
    'est-display-icon.svg': '#4A00D0',
    'est-music-icon.svg': '#763696',
    'est-event-hat-icon.svg': '#B89A00',
    'est-event-host-icon.svg': '#B89A00',
    'est-sensor-host-icon.svg': '#008AA6',
    'est-sensor-host-icon-centered.svg': '#008AA6',
    'est-sensor-button-icon.svg': '#008AA6',
    'est-sensor-button-icon-centered.svg': '#008AA6',
    'est-sensor-color-icon.svg': '#008AA6',
    'est-sensor-color-icon-centered.svg': '#008AA6',
    'est-sensor-temperature-icon.svg': '#008AA6',
    'est-sensor-temperature-icon-centered.svg': '#008AA6',
    'est-sensor-ultrasonic-icon.svg': '#008AA6',
    'est-sensor-ultrasonic-icon-centered.svg': '#008AA6',
    'est-sensor-ir-icon.svg': '#008AA6',
    'est-sensor-ir-icon-centered.svg': '#008AA6',
    'est-sensor-gyro-icon.svg': '#008AA6',
    'est-sensor-gyro-icon-centered.svg': '#008AA6'
}).forEach(([filename, stroke]) => {
    const source = fs.readFileSync(path.join(estBlockAssetsRoot, filename), 'utf8');
    assert.match(source, new RegExp(`stroke="${stroke}"`));
    if (filename === 'est-event-hat-icon.svg') {
        assert.match(source, /transform="translate\(4\.5 0\.6\)"/);
    } else if (filename.includes('-centered')) {
        assert.match(source, /transform="translate\(1\.1 0\)"/);
    } else {
        assert.match(source, /transform="translate\(1\.1 2\.4\)"/);
    }
    if (filename === 'est-event-hat-icon.svg') {
        assert.match(source, /d="M16\.6 11\.34 4\.6 4\.41v13\.86Z"/);
    }
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
assert.strictEqual(motorRunForDefinition.message0, '%1 %2 %3 %4 运行 %5 %6');
assert.strictEqual(motorRunForDefinition.args0.find(argument => argument.name === 'PORT').type, 'input_value');
assert.deepStrictEqual(
    motorRunForDefinition.args0.find(argument => argument.name === 'DIRECTION').options.map(option => option[1]),
    ['clockwise', 'counterclockwise']
);
assert.deepStrictEqual(
    motorRunForDefinition.args0.find(argument => argument.name === 'UNIT').options.map(option => option[1]),
    ['rotations', 'degrees', 'seconds']
);
const motorStalledDefinition = registeredBlockDefinitions.find(
    definition => definition.type === 'motor_stalled'
);
assert.strictEqual(motorStalledDefinition.message0, '%1 %2 马达 %3 是否堵转？');
assert.strictEqual(motorStalledDefinition.output, 'Boolean');
assert.strictEqual(
    motorStalledDefinition.args0.find(argument => argument.name === 'PORT').type,
    'input_value'
);
const driveMoveForDefinition = registeredBlockDefinitions.find(
    definition => definition.type === 'drive_move_for'
);
assert.deepStrictEqual(
    driveMoveForDefinition.args0.find(argument => argument.name === 'DIRECTION').options.map(option => option[1]),
    ['forward', 'backward']
);
assert.deepStrictEqual(
    driveMoveForDefinition.args0.find(argument => argument.name === 'UNIT').options.map(option => option[1]),
    ['rotations', 'degrees', 'seconds']
);
assert.deepStrictEqual(
    Object.fromEntries([
        'drive_steer_for',
        'drive_start_steer',
        'drive_steer_for_speed',
        'drive_start_steer_speed'
    ].map(blockId => [
        blockId,
        registeredBlockDefinitions.find(definition => definition.type === blockId).message0
    ])),
    {
        drive_steer_for: '%1 %2 向 %3 移动 %4 %5',
        drive_start_steer: '%1 %2 开始向 %3 移动',
        drive_steer_for_speed: '%1 %2 以 %3 %% 的速度向 %4 移动 %5 %6',
        drive_start_steer_speed: '%1 %2 以 %3 %% 的速度开始向 %4 移动'
    }
);
[
    'display_image_for',
    'display_image'
].forEach(blockId => {
    const definition = registeredBlockDefinitions.find(item => item.type === blockId);
    const imageDropdown = definition.args0.find(argument => argument.name === 'IMAGE');
    assert.ok(imageDropdown, `${blockId}.IMAGE`);
    assert.strictEqual(imageDropdown.type, 'field_dropdown');
    assert.strictEqual(imageDropdown.options.length, 42);
    assert.strictEqual(new Set(imageDropdown.options.map(option => option[1])).size, 42);
    assert.deepStrictEqual(
        imageDropdown.options,
        DISPLAY_IMAGE_IDS.map(id => [id.replace('/', ' / '), id])
    );
});
const driveSetPairDefinition = registeredBlockDefinitions.find(
    definition => definition.type === 'drive_set_pair'
);
assert.strictEqual(driveSetPairDefinition.args0.find(argument => argument.name === 'LEFT_PORT').type, 'input_value');
assert.strictEqual(driveSetPairDefinition.args0.find(argument => argument.name === 'RIGHT_PORT').type, 'input_value');
const sensorTemperatureDefinition = registeredBlockDefinitions.find(
    definition => definition.type === 'sensor_temperature'
);
assert.strictEqual(sensorTemperatureDefinition.output, 'Number');
const sensorTemperaturePort = sensorTemperatureDefinition.args0.find(argument => argument.name === 'PORT');
const sensorTemperatureUnit = sensorTemperatureDefinition.args0.find(argument => argument.name === 'UNIT');
assert.strictEqual(sensorTemperaturePort.type, 'input_value');
assert.strictEqual(sensorTemperatureUnit.type, 'field_dropdown');
assert.deepStrictEqual(
    sensorTemperatureUnit.options,
    [['摄氏', 'celsius'], ['华氏', 'fahrenheit']]
);
const comparatorDefinitions = registeredBlockDefinitions.flatMap(definition => (
    definitionArguments(definition)
        .filter(argument => argument.name === 'COMPARATOR')
        .map(argument => [definition.type, argument])
));
comparatorDefinitions.forEach(([blockId, argument]) => {
    assert.deepStrictEqual(
        argument.options.map(option => option[1]),
        ['less', 'greater', 'equal'],
        `${blockId}.COMPARATOR`
    );
});
const eventBrickButtonDefinition = registeredBlockDefinitions.find(
    item => item.type === 'event_brick_button'
);
eventBrickButtonDefinition.args0.filter(argument => argument.type !== 'field_image').forEach(argument => {
    assert.strictEqual(argument.type, 'field_dropdown');
});
const eventBrickButtonField = eventBrickButtonDefinition.args0.find(argument => argument.name === 'BUTTON');
assert.deepStrictEqual(eventBrickButtonField.options.map(option => option[1]), [
    'none',
    'back',
    'left',
    'confirm',
    'right',
    'up',
    'down'
]);
assert.ok(!eventBrickButtonField.options.some(option => option[1] === 'center'));
const waitBrickButtonDefinition = registeredBlockDefinitions.find(
    item => item.type === 'sensor_wait_brick_button'
);
assert.deepStrictEqual(
    waitBrickButtonDefinition.args0.find(argument => argument.name === 'BUTTON')
        .options.map(option => option[1]),
    ['left', 'confirm', 'right', 'up', 'down']
);
['event_broadcast', 'event_broadcast_wait'].forEach(blockId => {
    const definition = registeredBlockDefinitions.find(item => item.type === blockId);
    assert.strictEqual(definition.args0.find(argument => argument.name === 'MESSAGE').type, 'field_dropdown');
});
[
    'sensor_ir_beacon_heading',
    'sensor_ir_beacon_proximity',
    'sensor_ir_beacon_buttons',
    'sensor_ir_beacon_button_pressed',
    'sensor_wait_ir_beacon_button',
    'sensor_ir_beacon_active',
    'sensor_ir_beacon_active_compare'
].forEach(blockId => {
    const definition = registeredBlockDefinitions.find(item => item.type === blockId);
    const channel = definitionArguments(definition).find(argument => argument.name === 'CHANNEL');
    assert.ok(channel, `${blockId}.CHANNEL`);
    assert.deepStrictEqual(channel.options, [[FIXED_IR_REMOTE_CHANNEL, FIXED_IR_REMOTE_CHANNEL]]);
    assert.ok(definition.extensions.includes(EST_IR_FIXED_CHANNEL_EXTENSION), `${blockId} migration extension`);
});
const sensorPortDefaults = {
    sensor_color_reflection: '1',
    sensor_color_reflection_compare: '1',
    sensor_color_ambient: '1',
    sensor_color_ambient_compare: '1',
    sensor_color_value: '1',
    sensor_color_is: '1',
    sensor_wait_color: '1',
    sensor_temperature: '1',
    sensor_touch_pressed: '1',
    sensor_wait_touch: '1',
    sensor_ultrasonic_distance: '1',
    sensor_ultrasonic_compare: '1',
    sensor_wait_ultrasonic: '1',
    sensor_ir_proximity: '1',
    sensor_ir_proximity_compare: '1',
    sensor_wait_ir_proximity: '1',
    sensor_ir_beacon_heading: '1',
    sensor_ir_beacon_proximity: '1',
    sensor_ir_beacon_buttons: '1',
    sensor_ir_beacon_button_pressed: '1',
    sensor_wait_ir_beacon_button: '1',
    sensor_ir_beacon_active: '1',
    sensor_ir_beacon_active_compare: '1',
    sensor_gyro_angle: '1',
    sensor_gyro_rate: '1',
    sensor_gyro_reset: '1',
    sensor_gyro_compare: '1',
    sensor_wait_gyro: '1'
};
assert.strictEqual(Object.keys(sensorPortDefaults).length, 28);
Object.keys(sensorPortDefaults).forEach(blockId => {
    const definition = registeredBlockDefinitions.find(item => item.type === blockId);
    const port = definitionArguments(definition).find(argument => argument.name === 'PORT');
    assert.ok(port, `${blockId}.PORT`);
    assert.strictEqual(port.type, 'input_value', `${blockId}.PORT`);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(port, 'check'), false, `${blockId}.PORT`);
});
assert.deepStrictEqual(
    Object.keys(sensorPortDefaults).flatMap(blockId => {
        const definition = registeredBlockDefinitions.find(item => item.type === blockId);
        return definitionArguments(definition)
            .filter(argument => argument.name === 'PORT' && argument.type === 'field_dropdown')
            .map(argument => `${definition.type}.${argument.name}`);
    }),
    []
);
const relaxedNumericInputs = {
    motor_run_for: ['AMOUNT'],
    motor_set_speed: ['SPEED'],
    motor_run_for_speed: ['SPEED', 'AMOUNT'],
    motor_start_speed: ['SPEED'],
    motor_start_power: ['POWER'],
    drive_move_for: ['AMOUNT'],
    drive_steer_for: ['STEERING', 'AMOUNT'],
    drive_start_steer: ['STEERING'],
    drive_set_speed: ['SPEED'],
    drive_steer_for_speed: ['SPEED', 'STEERING', 'AMOUNT'],
    drive_dual_speed_for: ['LEFT_SPEED', 'RIGHT_SPEED', 'AMOUNT'],
    drive_start_steer_speed: ['SPEED', 'STEERING'],
    drive_start_dual_speed: ['LEFT_SPEED', 'RIGHT_SPEED'],
    display_image_for: ['SECONDS'],
    display_text_line: ['LINE'],
    display_text_xy: ['X', 'Y'],
    sound_beep_for: ['NOTE', 'SECONDS'],
    sound_beep: ['NOTE'],
    sound_set_volume: ['VOLUME'],
    event_timer: ['SECONDS'],
    control_wait_seconds: ['SECONDS'],
    control_repeat: ['TIMES'],
    sensor_color_calibrate_reflection: ['VALUE'],
    sensor_color_reflection_compare: ['VALUE'],
    sensor_color_ambient_compare: ['VALUE'],
    sensor_ultrasonic_compare: ['VALUE'],
    sensor_wait_ultrasonic: ['VALUE'],
    sensor_ir_proximity_compare: ['VALUE'],
    sensor_wait_ir_proximity: ['VALUE'],
    sensor_ir_beacon_active_compare: ['VALUE'],
    sensor_gyro_compare: ['VALUE'],
    sensor_wait_gyro: ['VALUE']
};
Object.entries(relaxedNumericInputs).forEach(([blockId, inputNames]) => {
    const definition = registeredBlockDefinitions.find(item => item.type === blockId);
    const args = definitionArguments(definition);
    inputNames.forEach(inputName => {
        const input = args.find(argument => argument.name === inputName);
        assert.ok(input, `${blockId}.${inputName}`);
        assert.strictEqual(input.type, 'input_value', `${blockId}.${inputName}`);
        assert.strictEqual(
            Object.prototype.hasOwnProperty.call(input, 'check'),
            false,
            `${blockId}.${inputName} should accept variables, numbers and expressions`
        );
    });
});
const numberCheckedInputs = registeredBlockDefinitions.flatMap(definition => (
    definitionArguments(definition)
        .filter(argument => argument.type === 'input_value' && argument.check === 'Number')
        .map(argument => `${definition.type}.${argument.name}`)
));
assert.deepStrictEqual(numberCheckedInputs, []);
['event_condition', 'control_wait_until', 'control_repeat_until', 'control_if', 'control_if_else']
    .forEach(blockId => {
        const definition = registeredBlockDefinitions.find(item => item.type === blockId);
        const condition = definitionArguments(definition).find(argument => argument.name === 'CONDITION');
        assert.strictEqual(condition.check, 'Boolean', blockId);
    });
const estToolboxCategories = getEstToolboxCategories();
['电机', '移动', '显示', '播放', '事件', '控制', '传感器']
    .forEach(categoryName => {
        assert.match(estToolboxCategories, new RegExp(`<category[^>]*name="${categoryName}"`, 's'));
    });
assert.ok(!estToolboxCategories.includes('name="声音"'));
assert.match(estToolboxCategories, /<category[^>]*name="%\{BKY_CATEGORY_OPERATORS\}"/s);
assert.strictEqual((estToolboxCategories.match(/<category/g) || []).length, 8);
ALL_EST_BLOCK_IDS.forEach(blockId => {
    assert.ok(estToolboxCategories.includes(`<block type="${blockId}"`));
});
const toolboxBlockXml = blockId => {
    const match = estToolboxCategories.match(new RegExp(`<block type="${blockId}">([\\s\\S]*?)</block>`));
    return match ? match[1] : '';
};
[
    'sensor_ir_beacon_heading',
    'sensor_ir_beacon_proximity',
    'sensor_ir_beacon_buttons',
    'sensor_ir_beacon_button_pressed',
    'sensor_wait_ir_beacon_button',
    'sensor_ir_beacon_active',
    'sensor_ir_beacon_active_compare'
].forEach(blockId => {
    assert.match(toolboxBlockXml(blockId), /<field name="CHANNEL">1<\/field>/, `${blockId}.CHANNEL toolbox`);
});
const steeringShadowInputs = new Set([
    'drive_steer_for.STEERING',
    'drive_start_steer.STEERING',
    'drive_steer_for_speed.STEERING',
    'drive_start_steer_speed.STEERING'
]);
Object.entries(relaxedNumericInputs).forEach(([blockId, inputNames]) => {
    const xml = toolboxBlockXml(blockId);
    assert.ok(xml, blockId);
    inputNames.forEach(inputName => {
        const shadowType = steeringShadowInputs.has(`${blockId}.${inputName}`) ?
            'est_steering_picker' :
            'math_number';
        assert.match(
            xml,
            new RegExp(`<value name="${inputName}">[\\s\\S]*?<shadow type="${shadowType}">`),
            `${blockId}.${inputName}`
        );
    });
});
Object.entries(sensorPortDefaults).forEach(([blockId, defaultPort]) => {
    const xml = toolboxBlockXml(blockId);
    assert.ok(xml, blockId);
    assert.match(
        xml,
        new RegExp(
            `<value name="PORT">[\\s\\S]*?` +
            `<shadow type="est_sensor_port_picker">[\\s\\S]*?` +
            `<field name="PORT">${defaultPort}<\\/field>`
        ),
        `${blockId}.PORT shadow`
    );
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
assert.match(toolboxBlockXml('display_image'), /<field name="IMAGE">Eyes\/Neutral<\/field>/);
assert.match(toolboxBlockXml('display_image_for'), /<field name="IMAGE">Eyes\/Neutral<\/field>/);
assert.match(toolboxBlockXml('sensor_temperature'), /<field name="PORT">1<\/field>/);
assert.match(toolboxBlockXml('motor_stalled'), /<field name="PORT">A<\/field>/);
assert.match(toolboxBlockXml('sensor_temperature'), /<field name="UNIT">celsius<\/field>/);
assert.match(toolboxBlockXml('event_brick_button'), /<field name="BUTTON">confirm<\/field>/);
assert.match(toolboxBlockXml('sensor_brick_button_pressed'), /<field name="BUTTON">confirm<\/field>/);
assert.match(toolboxBlockXml('sensor_wait_brick_button'), /<field name="BUTTON">confirm<\/field>/);
assert.match(toolboxBlockXml('control_stop'), /<field name="STOP_SCOPE">all<\/field>/);
assert.match(estToolboxCategories, /<value name="LEFT_PORT">[\s\S]*?<field name="PORT">B<\/field>/);
assert.match(estToolboxCategories, /<value name="RIGHT_PORT">[\s\S]*?<field name="PORT">C<\/field>/);
assert.ok(!estToolboxCategories.includes('<field name="PORT">2</field>'));
assert.ok(!estToolboxCategories.includes('<field name="PORT">3</field>'));
assert.ok(!estToolboxCategories.includes('<field name="PORT">4</field>'));
assert.match(estToolboxCategories, /<field name="TEXT">EST<\/field>/);
assert.match(
    estToolboxCategories,
    /<block type="drive_steer_for">[\s\S]*?<shadow type="est_steering_picker">/
);
assert.match(
    estToolboxCategories,
    /<block type="drive_start_steer">[\s\S]*?<shadow type="est_steering_picker">/
);
assert.match(
    estToolboxCategories,
    /<block type="drive_steer_for_speed">[\s\S]*?<value name="STEERING">[\s\S]*?<shadow type="est_steering_picker">/
);
assert.match(
    estToolboxCategories,
    /<block type="drive_start_steer_speed">[\s\S]*?<value name="STEERING">[\s\S]*?<shadow type="est_steering_picker">/
);
assert.strictEqual((estToolboxCategories.match(/<shadow type="est_steering_picker">/g) || []).length, 4);
assert.strictEqual((estToolboxCategories.match(/<shadow type="est_motor_port_picker">/g) || []).length, 12);
assert.strictEqual((estToolboxCategories.match(/<shadow type="est_drive_port_picker">/g) || []).length, 2);
assert.strictEqual((estToolboxCategories.match(/<shadow type="est_sensor_port_picker">/g) || []).length, 28);
assert.strictEqual((estToolboxCategories.match(/<shadow type="est_event_/g) || []).length, 0);
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
OPENBLOCK_NATIVE_OPERATOR_IDS.filter(blockId => blockId !== 'operator_random').forEach(blockId => {
    assert.strictEqual(fakePythonGenerator[blockId], nativeOperatorGenerators[blockId], blockId);
});
assert.notStrictEqual(
    fakePythonGenerator.operator_random,
    nativeOperatorGenerators.operator_random,
    'operator_random must use the EST runtime instead of Python random'
);

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
const motorStalledPython = fakePythonGenerator.motor_stalled(makeFakeBlock('motor_stalled', {
    values: {PORT: "'B'"}
}));
const motorStalledDefaultPython = fakePythonGenerator.motor_stalled(makeFakeBlock('motor_stalled'));
const motorStalledVariablePython = fakePythonGenerator.motor_stalled(makeFakeBlock('motor_stalled', {
    values: {PORT: 'port_var'}
}));
assert.strictEqual(
    motorRunPython,
    "rt.motor_run_for('B', 'clockwise', 2, 'rotations')\n"
);
assert.strictEqual(motorStopPython, "rt.motor_stop('B')\n");
assert.deepStrictEqual(motorStalledPython, ['rt.motor_stalled("B")', 2.2]);
assert.deepStrictEqual(motorStalledDefaultPython, ['rt.motor_stalled("A")', 2.2]);
assert.deepStrictEqual(motorStalledVariablePython, ['rt.motor_stalled(port_var)', 2.2]);
const languageInvariantMotorRunBlock = makeFakeBlock('motor_run_for', {
    values: {PORT: "'B'", AMOUNT: '2'},
    fields: {DIRECTION: 'clockwise', UNIT: 'rotations'}
});
setCurrentEstLocale('zh-cn', {silent: true});
const zhMotorRunPython = fakePythonGenerator.motor_run_for(languageInvariantMotorRunBlock);
setCurrentEstLocale('pt-br', {silent: true});
const ptMotorRunPython = fakePythonGenerator.motor_run_for(languageInvariantMotorRunBlock);
setCurrentEstLocale('zh-cn', {silent: true});
assert.strictEqual(ptMotorRunPython, zhMotorRunPython);

programStartBlock.nextCode = `${fakePythonGenerator.INDENT}${motorRunPython}` +
    `${fakePythonGenerator.INDENT}${motorStopPython}`;
assert.strictEqual(stackNameForBlock(programStartBlock, fakePythonGenerator), 'stack_1');
assert.strictEqual(fakePythonGenerator.event_program_start(programStartBlock), null);
assert.strictEqual(fakePythonGenerator.event_timer(timerBlock), null);
assert.strictEqual(fakePythonGenerator.imports_.estRuntime, 'import est_runtime as rt');
assert.strictEqual(fakePythonGenerator.setups_.estRun, 'rt.run()');
assert.strictEqual(
    fakePythonGenerator.libraries_.est_stack_1,
    `@rt.on_start\nasync def stack_1():\n` +
        `  global speed\n` +
        `  await rt.motor_run_for('B', 'clockwise', 2, 'rotations')\n` +
        `  rt.motor_stop('B')\n`
);
assert.strictEqual(
    fakePythonGenerator.libraries_.est_stack_2,
    `@rt.on_timer_gt(10)\ndef stack_2():\n` +
        `  global speed\n` +
        `  pass\n`
);

const multiStartBlockA = makeFakeBlock('event_program_start', {
    id: 'multi-start-a',
    nextBlock: {type: 'control_wait_seconds'}
});
const multiStartBlockB = makeFakeBlock('event_program_start', {
    id: 'multi-start-b',
    nextBlock: {type: 'drive_move_for'}
});
fakePythonGenerator.init({getTopBlocks: () => [multiStartBlockA, multiStartBlockB]});
multiStartBlockA.nextCode =
    `  rt.sleep(1)\n` +
    `  for _ in range(rt.repeat_count(3)):\n` +
    `    rt.yield_once()\n`;
multiStartBlockB.nextCode =
    `  rt.drive_move_for('forward', 1, 'rotations')\n` +
    `  rt.display_image_for('Eyes/Neutral', 2)\n`;
assert.strictEqual(fakePythonGenerator.event_program_start(multiStartBlockA), null);
assert.strictEqual(fakePythonGenerator.event_program_start(multiStartBlockB), null);
assert.strictEqual(
    fakePythonGenerator.libraries_.est_stack_1,
    `@rt.on_start\nasync def stack_1():\n` +
        `  global speed\n` +
        `  await rt.sleep(1)\n` +
        `  for _ in range(rt.repeat_count(3)):\n` +
        `    await rt.yield_once()\n`
);
assert.strictEqual(
    fakePythonGenerator.libraries_.est_stack_2,
    `@rt.on_start\nasync def stack_2():\n` +
        `  global speed\n` +
        `  await rt.drive_move_for('forward', 1, 'rotations')\n` +
        `  await rt.display_image_for('Eyes/Neutral', 2)\n`
);

const singleWaitStartBlock = makeFakeBlock('event_program_start', {
    id: 'single-wait-start',
    nextBlock: {type: 'control_wait_until'},
    nextCode:
        `  rt.sleep(0.25)\n` +
        `  rt.wait_until(lambda: ready)\n`
});
fakePythonGenerator.init({getTopBlocks: () => [singleWaitStartBlock]});
assert.strictEqual(fakePythonGenerator.event_program_start(singleWaitStartBlock), null);
assert.strictEqual(
    fakePythonGenerator.libraries_.est_stack_1,
    `@rt.on_start\nasync def stack_1():\n` +
        `  global speed\n` +
        `  await rt.sleep(0.25)\n` +
        `  await rt.wait_until(lambda: ready)\n`
);

const singleLoopStartBlock = makeFakeBlock('event_program_start', {
    id: 'single-loop-start',
    nextBlock: {type: 'control_forever'},
    nextCode:
        `  while True:\n` +
        `    rt.drive_stop()\n` +
        `    rt.yield_once()\n`
});
fakePythonGenerator.init({getTopBlocks: () => [singleLoopStartBlock]});
assert.strictEqual(fakePythonGenerator.event_program_start(singleLoopStartBlock), null);
assert.strictEqual(
    fakePythonGenerator.libraries_.est_stack_1,
    `@rt.on_start\nasync def stack_1():\n` +
        `  global speed\n` +
        `  while True:\n` +
        `    rt.drive_stop()\n` +
        `    await rt.yield_once()\n`
);

fakePythonGenerator.init({getTopBlocks: () => []});
assert.strictEqual(fakePythonGenerator.drive_set_speed(makeFakeBlock('drive_set_speed', {
    values: {SPEED: '8'}
})), 'rt.drive_set_speed(8)\n');
assert.strictEqual(Object.prototype.hasOwnProperty.call(fakePythonGenerator.libraries_, 'estSpeedHelpers'), false);
assert.strictEqual(fakePythonGenerator.motor_set_speed(makeFakeBlock('motor_set_speed', {
    values: {PORT: "'A'", SPEED: 'speed + 1'}
})), "rt.motor_set_speed('A', speed + 1)\n");
assert.strictEqual(fakePythonGenerator.motor_run_for_speed(makeFakeBlock('motor_run_for_speed', {
    values: {PORT: "'A'", SPEED: 'speed - 1', AMOUNT: '2'},
    fields: {UNIT: 'rotations'}
})), "rt.motor_run_for('A', None, 2, 'rotations', speed=speed - 1)\n");
assert.strictEqual(fakePythonGenerator.motor_start_speed(makeFakeBlock('motor_start_speed', {
    values: {PORT: "'A'", SPEED: 'speed'}
})), "rt.motor_start_speed('A', speed)\n");
assert.strictEqual(fakePythonGenerator.motor_start_power(makeFakeBlock('motor_start_power', {
    values: {PORT: "'A'", POWER: 'power'}
})), "rt.motor_start_power('A', power)\n");
assert.strictEqual(fakePythonGenerator.drive_start_steer_speed(makeFakeBlock('drive_start_steer_speed', {
    values: {STEERING: 'speed + 2', SPEED: 'speed - 3'}
})), 'rt.drive_start_steer(speed + 2, speed=speed - 3)\n');
assert.strictEqual(fakePythonGenerator.drive_dual_speed_for(makeFakeBlock('drive_dual_speed_for', {
    values: {LEFT_SPEED: '30', RIGHT_SPEED: '40', AMOUNT: '2'},
    fields: {UNIT: 'seconds'}
})), "rt.drive_dual_speed_for(30, 40, 2, 'seconds')\n");
assert.strictEqual(fakePythonGenerator.drive_start_dual_speed(makeFakeBlock('drive_start_dual_speed', {
    values: {LEFT_SPEED: '0', RIGHT_SPEED: '50'}
})), 'rt.drive_start_dual_speed(0, 50)\n');
assert.strictEqual(fakePythonGenerator.drive_start_dual_speed(makeFakeBlock('drive_start_dual_speed', {
    values: {LEFT_SPEED: '50', RIGHT_SPEED: '0'}
})), 'rt.drive_start_dual_speed(50, 0)\n');
assert.strictEqual(fakePythonGenerator.drive_start_dual_speed(makeFakeBlock('drive_start_dual_speed', {
    values: {LEFT_SPEED: '0', RIGHT_SPEED: '0'}
})), 'rt.drive_start_dual_speed(0, 0)\n');
assert.strictEqual(Object.prototype.hasOwnProperty.call(fakePythonGenerator.libraries_, 'estSpeedHelpers'), false);
assert.strictEqual(fakePythonGenerator.display_image(makeFakeBlock('display_image', {
    fields: {IMAGE: 'Expressions/Big smile'}
})), "est.display.image('Expressions/Big smile')\nest.display.refresh()\n");
assert.strictEqual(fakePythonGenerator.display_image(makeFakeBlock('display_image')), (
    "est.display.image('Eyes/Neutral')\nest.display.refresh()\n"
));
const timedImageWithSpace = fakePythonGenerator.display_image_for(makeFakeBlock('display_image_for', {
    values: {SECONDS: '2'},
    fields: {IMAGE: 'Expressions/Big smile'}
}));
assert.strictEqual(timedImageWithSpace, "rt.display_image_for('Expressions/Big smile', 2)\n");
assert.doesNotMatch(timedImageWithSpace, /refresh/);
assert.strictEqual(fakePythonGenerator.display_image_for(makeFakeBlock('display_image_for', {
    values: {SECONDS: '2'}
})), "rt.display_image_for('Eyes/Neutral', 2)\n");
assert.strictEqual(fakePythonGenerator.display_text_line(makeFakeBlock('display_text_line', {
    values: {LINE: '2', TEXT: "'EST'"}
})), "rt.display_text_line(2, 'EST')\n");
assert.strictEqual(fakePythonGenerator.display_text_line(makeFakeBlock('display_text_line', {
    values: {LINE: 'line_number', TEXT: 'sensor_value'}
})), 'rt.display_text_line(line_number, sensor_value)\n');
[
    'regular_black',
    'bold_black',
    'large_black',
    'regular_white',
    'bold_white',
    'large_white'
].forEach(font => {
    assert.strictEqual(fakePythonGenerator.display_text_xy(makeFakeBlock('display_text_xy', {
        values: {X: '10', Y: '20', TEXT: "'EST'"},
        fields: {FONT: font}
    })), `rt.display_text(10, 20, 'EST', font='${font}')\n`);
});
assert.strictEqual(fakePythonGenerator.display_text_xy(makeFakeBlock('display_text_xy', {
    values: {X: 'x_value', Y: 'y_value', TEXT: 'sensor_value'},
    fields: {FONT: 'regular_black'}
})), "rt.display_text(x_value, y_value, sensor_value, font='regular_black')\n");
assert.strictEqual(
    fakePythonGenerator.display_clear(makeFakeBlock('display_clear')),
    'est.display.clear()\nest.display.refresh()\n'
);
[
    ['off', 'est.led.OFF'],
    ['red', 'est.led.RED'],
    ['blue', 'est.led.BLUE']
].forEach(([mode, constant]) => {
    assert.strictEqual(fakePythonGenerator.display_status_light(makeFakeBlock('display_status_light', {
        fields: {STATUS_MODE: mode}
    })), `est.led.set(${constant})\n`);
});
[
    ['back', 'est.buttons.BACK'],
    ['left', 'est.buttons.LEFT'],
    ['confirm', 'est.buttons.CONFIRM'],
    ['center', 'est.buttons.CONFIRM'],
    ['right', 'est.buttons.RIGHT'],
    ['up', 'est.buttons.UP'],
    ['down', 'est.buttons.DOWN']
].forEach(([button, constant]) => {
    assert.deepStrictEqual(fakePythonGenerator.sensor_brick_button_pressed(
        makeFakeBlock('sensor_brick_button_pressed', {fields: {BUTTON: button}})
    ), [`est.buttons.pressed(${constant})`, 2.2]);
});
assert.deepStrictEqual(fakePythonGenerator.sensor_brick_button_pressed(
    makeFakeBlock('sensor_brick_button_pressed', {fields: {BUTTON: 'none'}})
), ['est.buttons.value() == est.buttons.NONE', 11]);
assert.strictEqual(fakePythonGenerator.event_brick_button(makeFakeBlock('event_brick_button', {
    id: 'old-center-button-hat',
    fields: {BUTTON: 'center', BUTTON_EVENT: 'pressed'},
    nextBlock: {type: 'drive_stop'},
    nextCode: '  rt.drive_stop()\n'
})), null);
assert.match(fakePythonGenerator.libraries_.est_stack_1, /@rt\.on_brick_button\('confirm', 'pressed'\)/);
assert.strictEqual(fakePythonGenerator.sensor_wait_brick_button(makeFakeBlock('sensor_wait_brick_button', {
    fields: {BUTTON: 'center', BUTTON_EVENT: 'released'}
})), "rt.wait_brick_button('confirm', 'released')\n");
assert.strictEqual(fakePythonGenerator.control_repeat(makeFakeBlock('control_repeat', {
    values: {TIMES: '3'},
    statements: {SUBSTACK: '  rt.drive_stop()\n'}
})), 'for _ in range(rt.repeat_count(3)):\n  rt.drive_stop()\n  rt.yield_once()\n');
assert.strictEqual(fakePythonGenerator.control_stop(makeFakeBlock('control_stop', {
    fields: {STOP_SCOPE: 'this_stack'}
})), "rt.stop('this_stack')\n");
assert.strictEqual(fakePythonGenerator.control_stop_other_stacks(makeFakeBlock('control_stop_other_stacks')),
    'rt.stop_other_stacks()\n');
assert.strictEqual(fakePythonGenerator.control_stop(makeFakeBlock('control_stop', {
    fields: {STOP_SCOPE: 'other_stacks'}
})), 'rt.stop_other_stacks()\n');
assert.strictEqual(fakePythonGenerator.control_stop(makeFakeBlock('control_stop', {
    fields: {STOP_SCOPE: 'exit_program'}
})), "rt.stop('all')\n");
const singleStopStartBlock = makeFakeBlock('event_program_start', {
    id: 'single-stop-start',
    nextBlock: {type: 'control_stop'},
    nextCode: "  rt.stop('this_stack')\n"
});
fakePythonGenerator.init({getTopBlocks: () => [singleStopStartBlock]});
assert.strictEqual(fakePythonGenerator.event_program_start(singleStopStartBlock), null);
assert.strictEqual(
    fakePythonGenerator.libraries_.est_stack_1,
    `@rt.on_start\nasync def stack_1():\n` +
        `  global speed\n` +
        `  rt.stop('this_stack')\n`
);
assert.strictEqual(fakePythonGenerator.sound_beep_for(makeFakeBlock('sound_beep_for', {
    values: {NOTE: '60', SECONDS: '1'}
})), 'est.audio.tone(60, rt.seconds_to_ms(1), wait=True)\n');
const estDefaultProjectData = createEstDefaultProjectData();
assert.strictEqual(estDefaultProjectData.targets.length, 2);
assert.strictEqual(estDefaultProjectData.targets[0].isStage, true);
assert.strictEqual(estDefaultProjectData.targets[1].isStage, false);
assert.deepStrictEqual(estDefaultProjectData.targets[0].blocks, {});
const defaultProgramBlocks = estDefaultProjectData.targets[1].blocks;
assert.deepStrictEqual(Object.keys(defaultProgramBlocks), ['est_default_program_start']);
assert.deepStrictEqual(defaultProgramBlocks.est_default_program_start, {
    opcode: 'event_program_start',
    next: null,
    parent: null,
    inputs: {},
    fields: {},
    shadow: false,
    topLevel: true,
    x: 360,
    y: 160
});
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
        fields: {COMPARATOR: 'less', UNIT: 'centimeters'}
    })
), ["rt.compare(_est_device_ultrasonic_1.distance('centimeters'), 'less', 15)", 2.2]);
assert.strictEqual(
    fakePythonGenerator.libraries_.estDevice_ultrasonic_1,
    '_est_device_ultrasonic_1 = rt.ultrasonic(1)\n' +
    "_est_device_ultrasonic_1.distance('centimeters')\n"
);
assert.deepStrictEqual(fakePythonGenerator.sensor_temperature(
    makeFakeBlock('sensor_temperature', {
        values: {PORT: 'port_var'},
        fields: {UNIT: 'fahrenheit'}
    })
), ['rt.temperature(port_var).fahrenheit()', 2.2]);
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
const localesLoader = require('./est-locales-loader');
const openBlockEditorMessagesSource = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'node_modules',
    'openblock-l10n',
    'locales',
    'editor-msgs.js'
), 'utf8');
const transformedEditorMessages = localesLoader(openBlockEditorMessagesSource);
babel.transformSync(transformedEditorMessages, {
    babelrc: false,
    presets: ['@babel/preset-env']
});
assert.match(transformedEditorMessages, /"gui\.sharedMessages\.loadFromComputerTitle": "从电脑打开"/);
assert.match(transformedEditorMessages, /"pt-br"/);
assert.match(transformedEditorMessages, /"gui\.menuBar\.file": "Arquivo"/);
assert.match(transformedEditorMessages, /"gui\.menuBar\.LanguageSelector": "Idioma"/);
assert.match(transformedEditorMessages, /"gui\.sharedMessages\.loadFromComputerTitle": "Abrir do computador"/);
assert.match(transformedEditorMessages, /messages\[locale\] \|\| messages\.en/);
assert.ok(
    transformedEditorMessages.lastIndexOf('"gui.sharedMessages.loadFromComputerTitle": "从电脑打开"') >
    transformedEditorMessages.indexOf('"gui.sharedMessages.loadFromComputerTitle": "从电脑中上传"')
);
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
assert.ok(!transformedMenuBar.includes('this.handleCheckUpdate'));
assert.match(transformedMenuBar, /<EstStatusPanel \/>\s*<EstHardwareStatusButton \/>/);
assert.match(transformedMenuBar, /import EstCodeDrawerToggle from 'est-code-drawer-toggle';/);
assert.match(transformedMenuBar, /import EstHardwareStatusButton from 'est-hardware-status-button';/);
assert.match(transformedMenuBar, /import EstLanguageMenu from 'est-language-menu';/);
assert.match(transformedMenuBar, /import EstMenuBarLayout from 'est-menu-bar-layout';/);
assert.match(transformedMenuBar, /import estMenuLogo from 'est-menu-logo';/);
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
for (const removedSettingMenuToken of [
    'settingMenuOpen',
    'openSettingMenu',
    'closeSettingMenu',
    'onClickSetting',
    'onRequestCloseSetting',
    'settingIcon',
    'isScratchDesktop',
    'handleCheckUpdate',
    'onClickCheckUpdate',
    'UPDATE_MODAL_STATE',
    'openUpdateModal',
    'checkUpdate',
    'installDriver',
    'clearCache'
]) {
    assert.ok(!transformedFullMenuBar.includes(removedSettingMenuToken));
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
assert.match(transformedFullMenuBar, /<EstStatusPanel \/>\s*<EstHardwareStatusButton \/>/);
assert.match(transformedFullMenuBar, /<EstLanguageMenu[\s\S]*open=\{this\.props\.languageMenuOpen\}/);
assert.match(transformedFullMenuBar, /onMouseUp=\{this\.handleLanguageMouseUp\}/);
assert.ok(!transformedFullMenuBar.includes("import LanguageSelector from '../../containers/language-selector.jsx';"));
assert.match(transformedFullMenuBar, /<EstMenuBarLayout \/>[\s\S]*<div className=\{styles\.mainMenu\}>/);
assert.ok(!transformedFullMenuBar.includes(
    '{this.state.isOverflow ? null :\n                    (<div className={styles.fileMenu}>'
));
assert.match(transformedFullMenuBar, /<div className=\{styles\.fileMenu\}>[\s\S]*<ProjectTitleInput/);
assert.match(
    transformedFullMenuBar,
    /<div className=\{styles\.tailMenu\}>[\s\S]*<EstCodeDrawerToggle \/>[\s\S]*<\/div>/
);
assert.strictEqual((transformedFullMenuBar.match(/<EstCodeDrawerToggle \/>/g) || []).length, 1);
assert.strictEqual((transformedFullMenuBar.match(/<EstHardwareStatusButton \/>/g) || []).length, 1);
assert.ok(!transformedFullMenuBar.includes("import openblockLogo from './openblock-logo.svg';"));
assert.ok(!transformedFullMenuBar.includes("import openblockLogoSmall from './openblock-logo-small.svg';"));
assert.match(transformedFullMenuBar, /alt="EST Studio"/);
assert.match(transformedFullMenuBar, /src=\{estMenuLogo\}/);
assert.match(transformedFullMenuBar, /logo: estMenuLogo/);
assert.match(transformedFullMenuBar, /logoSmall: estMenuLogo/);
const estMenuLogoPath = path.resolve(__dirname, '..', 'src', 'renderer', 'est-menu-logo.png');
assert.ok(fs.existsSync(estMenuLogoPath));
assert.ok(fs.statSync(estMenuLogoPath).size > 10000);
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
assert.match(estCodeDrawerSource, /EST_CODE_DRAWER_TOGGLE_EVENT/);
assert.match(estCodeDrawerSource, /EST_CODE_DRAWER_REQUEST_STATE_EVENT/);
assert.match(estCodeDrawerSource, /publishCodeDrawerState/);
assert.match(estCodeDrawerSource, /resizeBlocklyWorkspace/);
assert.match(estCodeDrawerSource, /EDITOR_CHROME_WIDTH = 6/);
assert.match(estCodeDrawerSource, /getEstText\('codeDrawer\.resize'/);
assert.match(estCodeDrawerSource, /state\.locales\.locale/);
assert.ok(!estCodeDrawerSource.includes('styles.toggleButton'));
assert.ok(!estCodeDrawerSource.includes('styles.toggleButtonCollapsed'));
assert.ok(!estCodeDrawerSource.includes('pythonCodeDrawerOpen'));
assert.match(estCodeDrawerSource, /<CodeEditor/);
assert.ok(!estCodeDrawerSource.includes('HardwareConsole'));
const estCodeDrawerStyles = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'src',
    'renderer',
    'EstCodeDrawer.css'
), 'utf8');
assert.match(estCodeDrawerStyles, /\.drawer[\s\S]*background: #f1f3f5;/);
assert.match(estCodeDrawerStyles, /\.content[\s\S]*padding: 0 2px;/);
const estCodeDrawerToggleSource = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'src',
    'renderer',
    'EstCodeDrawerToggle.jsx'
), 'utf8');
assert.match(estCodeDrawerToggleSource, /EST_CODE_DRAWER_STATE_EVENT/);
assert.match(estCodeDrawerToggleSource, /EST_CODE_DRAWER_REQUEST_STATE_EVENT/);
assert.match(estCodeDrawerToggleSource, /EST_CODE_DRAWER_TOGGLE_EVENT/);
assert.match(estCodeDrawerToggleSource, /aria-expanded=\{isOpen\}/);
assert.match(estCodeDrawerToggleSource, /import codeIcon from '\.\/file-code-fill\.svg';/);
assert.match(estCodeDrawerToggleSource, /className=\{styles\.toggleIcon\}[\s\S]*src=\{codeIcon\}/);
assert.match(estCodeDrawerToggleSource, /getEstText\(isOpen \? 'codeDrawer\.collapse' : 'codeDrawer\.expand'/);
assert.match(estCodeDrawerToggleSource, /state\.locales\.locale/);
const estCodeDrawerToggleStyles = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'src',
    'renderer',
    'EstCodeDrawerToggle.css'
), 'utf8');
assert.match(estCodeDrawerToggleStyles, /\.toggle-button:hover/);
assert.match(estCodeDrawerToggleStyles, /\.toggle-button:active/);
assert.match(estCodeDrawerToggleStyles, /\.toggle-button-open/);
assert.match(estCodeDrawerToggleStyles, /height: \$menu-bar-height;/);
assert.match(estCodeDrawerToggleStyles, /min-width: calc\(24px \+ 1\.5rem\);/);
assert.match(estCodeDrawerToggleStyles, /padding: 0 0\.75rem;/);
assert.match(estCodeDrawerToggleStyles, /border-radius: 0;/);
assert.match(estCodeDrawerToggleStyles, /background-color: \$ui-black-transparent;/);
assert.ok(!estCodeDrawerToggleStyles.includes('rgba(255, 255, 255, 0.18)'));
assert.match(
    estCodeDrawerToggleStyles,
    /\.toggle-button:hover \.toggle-icon,[\s\S]*filter: brightness\(0\) invert\(16%\);/
);
assert.ok(!estCodeDrawerToggleStyles.includes('invert(100%)'));
const estMenuBarLayoutSource = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'src',
    'renderer',
    'EstMenuBarLayout.jsx'
), 'utf8');
assert.match(estMenuBarLayoutSource, /CENTER_MENU_WIDTH_PROPERTY = '--est-centered-file-menu-width'/);
assert.match(estMenuBarLayoutSource, /CENTER_MENU_MAX_WIDTH = 252/);
assert.match(estMenuBarLayoutSource, /getContentBounds/);
assert.match(estMenuBarLayoutSource, /mainBounds\.right/);
assert.match(estMenuBarLayoutSource, /tailBounds\.left/);
assert.match(estMenuBarLayoutSource, /HOME_BUTTON_CLASS = 'est-menu-bar-home-button'/);
assert.match(estMenuBarLayoutSource, /ensureHomeButton/);
assert.match(estMenuBarLayoutSource, /EST_LOCALE_CHANGED_EVENT/);
assert.match(estMenuBarLayoutSource, /getEstText\('menu\.home'/);
assert.match(estMenuBarLayoutSource, /homeButton\.textContent = label/);
assert.match(estMenuBarLayoutSource, /insertBefore\(homeButton, logoItem\.nextSibling\)/);
assert.ok(!estMenuBarLayoutSource.includes('est-menu-bar-hide-centered-file-menu'));
const estLanguageMenuSource = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'src',
    'renderer',
    'EstLanguageMenu.jsx'
), 'utf8');
assert.match(estLanguageMenuSource, /from 'openblock-l10n'/);
assert.match(estLanguageMenuSource, /MenuBarMenu/);
assert.match(estLanguageMenuSource, /getEstLocaleOptions/);
assert.match(estLanguageMenuSource, /setCurrentEstLocale/);
assert.match(estLanguageMenuSource, /locale\.value === 'pt-br'/);
assert.match(estLanguageMenuSource, /selectLocale/);
assert.match(estLanguageMenuSource, /closeLanguageMenu/);
assert.match(estLanguageMenuSource, /currentLocale === locale\.value && styles\.selected/);
const estLanguageMenuStyles = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'src',
    'renderer',
    'EstLanguageMenu.css'
), 'utf8');
assert.match(estLanguageMenuStyles, /\.language-menu\s*\{[\s\S]*background-color: #f8fafc;/);
assert.match(estLanguageMenuStyles, /\.language-menu-item\s*\{[\s\S]*justify-content: space-between;/);
assert.match(estLanguageMenuStyles, /\.language-menu-item\s*\{[\s\S]*text-align: left;/);
assert.match(estLanguageMenuStyles, /\.language-menu-item:hover,[\s\S]*background-color: #e5e7eb;/);
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
assert.ok(!transformedGui.includes('onClickCheckUpdate'));
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
assert.match(estProgramControlsSource, /import \{buildEstProgramRequest\} from '\.\/est-program-name'/);
assert.match(estProgramControlsSource, /state\.scratchGui\.code\.codeEditorValue/);
assert.match(estProgramControlsSource, /projectTitle: state\.scratchGui\.projectTitle/);
assert.match(estProgramControlsSource, /projectTitle: this\.props\.projectTitle/);
assert.match(
    estProgramControlsSource,
    new RegExp(
        'buildEstProgramRequest\\(\\{[\\s\\S]*source: this\\.props\\.codeEditorValue,[\\s\\S]*slot,' +
        '[\\s\\S]*projectTitle: this\\.props\\.projectTitle[\\s\\S]*\\}\\)'
    )
);
assert.match(estProgramControlsSource, /data-action="stop"/);
assert.ok(!estProgramControlsSource.includes('data-action="pause"'));
assert.match(estProgramControlsSource, /PROGRAM_SLOT_CHANGE_EVENT/);
assert.match(estProgramControlsSource, /EST_CONNECTION_STATUS_EVENT/);
assert.match(estProgramControlsSource, /formatProgramOperationError/);
assert.match(estProgramControlsSource, /cannot write to hid device/);
assert.match(estProgramControlsSource, /EST_PROGRAM_ACTIVITY_EVENT/);
assert.match(estProgramControlsSource, /detail: \{isRunning: action === 'run'\}/);
assert.match(estProgramControlsSource, /programActionsAllowed: false/);
assert.match(estProgramControlsSource, /getEstText\('programControls\.downloadStart'/);
assert.match(estProgramControlsSource, /state\.locales\.locale/);
assert.strictEqual(
    (estProgramControlsSource.match(/disabled=\{controlsBusy \|\| !programActionsAllowed\}/g) || []).length,
    2
);
const estStatusPanelSource = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'src',
    'renderer',
    'EstStatusPanel.jsx'
), 'utf8');
assert.match(estStatusPanelSource, /result\.compatible === true/);
assert.match(estStatusPanelSource, /getEstText\('status\.upgradeRequired'/);
assert.match(estStatusPanelSource, /state\.locales\.locale/);
assert.match(estStatusPanelSource, /EST_CONNECTION_STATUS_EVENT/);
assert.match(estStatusPanelSource, /EST_PROGRAM_ACTIVITY_EVENT/);
assert.match(estStatusPanelSource, /RUNNING_REFRESH_INTERVAL_MS = 10000/);
assert.match(estStatusPanelSource, /NORMAL_REFRESH_INTERVAL_MS = 3000/);
assert.match(estStatusPanelSource, /isProgramStatusActive/);
assert.match(estStatusPanelSource, /scheduleRefresh\(this\.programRunning \? RUNNING_REFRESH_INTERVAL_MS : 0\)/);
assert.ok(!estStatusPanelSource.includes('setInterval'));
const estStatusPanelStyles = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'src',
    'renderer',
    'est-status-panel.css'
), 'utf8');
assert.match(estStatusPanelStyles, /\.statusBarItem\s*\{[\s\S]*font-size: 0\.75rem;/);
assert.match(estStatusPanelStyles, /\.statusBarItem\s*\{[\s\S]*font-weight: bold;/);
const estHardwareStatusButtonSource = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'src',
    'renderer',
    'EstHardwareStatusButton.jsx'
), 'utf8');
assert.match(estHardwareStatusButtonSource, /getEstText\('hardware\.title'/);
assert.match(estHardwareStatusButtonSource, /state\.locales\.locale/);
assert.match(estHardwareStatusButtonSource, /className=\{styles\.overlay\}/);
assert.ok(!estHardwareStatusButtonSource.includes('aria-modal'));
assert.match(estHardwareStatusButtonSource, /handleToggle/);
assert.match(estHardwareStatusButtonSource, /const isOpen = !state\.isOpen/);
assert.match(estHardwareStatusButtonSource, /handleClose/);
assert.match(estHardwareStatusButtonSource, /handlePanelDragStart/);
assert.match(estHardwareStatusButtonSource, /handlePanelDragMove/);
assert.match(estHardwareStatusButtonSource, /handlePanelDragEnd/);
assert.match(estHardwareStatusButtonSource, /onMouseDown=\{this\.handlePanelDragStart\}/);
assert.match(estHardwareStatusButtonSource, /style=\{panelStyle\}/);
assert.match(estHardwareStatusButtonSource, /renderPortsOverview/);
assert.match(estHardwareStatusButtonSource, /renderConnectionAndBattery/);
assert.match(
    estHardwareStatusButtonSource,
    /\{this\.renderPortsOverview\(\)\}\s*\{this\.renderConnectionAndBattery\(\)\}/
);
assert.ok(!estHardwareStatusButtonSource.includes('styles.menuIcon'));
assert.ok(!estHardwareStatusButtonSource.includes('<svg'));
assert.match(estHardwareStatusButtonSource, /getEstText\('hardware\.manualRefresh'/);
assert.match(estHardwareStatusButtonSource, /batteryPercentText\(status\)/);
assert.ok(!estHardwareStatusButtonSource.includes('batteryLevel}/4'));
assert.match(estHardwareStatusButtonSource, /getEstText\('firmware\.updateButton'/);
assert.match(estHardwareStatusButtonSource, /FIRMWARE_UPDATE_ACTIONS = \{/);
assert.match(estHardwareStatusButtonSource, /data-firmware-target=\{FIRMWARE_UPDATE_ACTIONS\.upgrade\}/);
assert.match(estHardwareStatusButtonSource, /data-firmware-target=\{FIRMWARE_UPDATE_ACTIONS\.downgrade\}/);
assert.match(estHardwareStatusButtonSource, /ipcRenderer\.invoke\('est-flash-firmware'/);
assert.match(estHardwareStatusButtonSource, /dialog\.showMessageBox\(remote\.getCurrentWindow\(\)/);
assert.match(estHardwareStatusButtonSource, /includeProgramStatus: true/);
assert.match(estHardwareStatusButtonSource, /REFRESH_INTERVAL_MS = 3000/);
assert.match(estHardwareStatusButtonSource, /PANEL_DEFAULT_WIDTH = 600/);
assert.match(estHardwareStatusButtonSource, /PANEL_DEFAULT_HEIGHT = 420/);
assert.match(estHardwareStatusButtonSource, /isProgramRunning\(this\.state\.status\)/);
assert.match(estHardwareStatusButtonSource, /getEstText\('hardware\.runningNotice'/);
assert.match(estHardwareStatusButtonSource, /getEstText\('programControls\.usbDisconnected'/);
assert.match(estHardwareStatusButtonSource, /stripRemoteErrorPrefix/);
for (const hardwareStatusKey of [
    'hardware.connectionStatus',
    'hardware.connectionBattery',
    'hardware.firmwareVersion',
    'hardware.protocolVersion',
    'hardware.battery',
    'hardware.sampleVoltage',
    'hardware.motors',
    'hardware.sensors',
    'hardware.notConnected'
]) {
    assert.ok(estHardwareStatusButtonSource.includes(`'${hardwareStatusKey}'`), hardwareStatusKey);
}
assert.ok(!estHardwareStatusButtonSource.includes('<h3 className={styles.sectionTitle}>能力</h3>'));
assert.ok(!estHardwareStatusButtonSource.includes('<h3 className={styles.sectionTitle}>Python 程序</h3>'));
assert.ok(!estHardwareStatusButtonSource.includes('renderCapabilities'));
assert.ok(!estHardwareStatusButtonSource.includes('renderProgramStatus'));
assert.ok(!estHardwareStatusButtonSource.includes('renderConnectionSummary'));
assert.ok(!estHardwareStatusButtonSource.includes('renderBattery'));
const estHardwareStatusButtonStyles = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'src',
    'renderer',
    'EstHardwareStatusButton.css'
), 'utf8');
assert.match(estHardwareStatusButtonStyles, /\.menu-button:hover/);
assert.match(estHardwareStatusButtonStyles, /background-color: \$ui-black-transparent/);
assert.match(estHardwareStatusButtonStyles, /\.menu-button\s*\{[\s\S]*font-size: 0\.75rem;/);
assert.match(estHardwareStatusButtonStyles, /\.menu-button\s*\{[\s\S]*font-weight: bold;/);
assert.match(estHardwareStatusButtonStyles, /\.menu-button-open\s*\{[\s\S]*color: #1f2937;/);
assert.ok(!estHardwareStatusButtonStyles.includes('color: #ffffff'));
assert.ok(!estHardwareStatusButtonStyles.includes('.menu-icon'));
assert.match(estHardwareStatusButtonStyles, /\.overlay/);
assert.match(estHardwareStatusButtonStyles, /\.overlay\s*\{[\s\S]*pointer-events: none/);
assert.match(estHardwareStatusButtonStyles, /\.panel/);
assert.match(estHardwareStatusButtonStyles, /\.panel\s*\{[\s\S]*position: fixed/);
assert.match(estHardwareStatusButtonStyles, /\.panel\s*\{[\s\S]*pointer-events: auto/);
assert.match(estHardwareStatusButtonStyles, /\.panel\s*\{[\s\S]*width: min\(600px/);
assert.match(estHardwareStatusButtonStyles, /\.panel\s*\{[\s\S]*max-height: min\(520px/);
assert.match(estHardwareStatusButtonStyles, /\.port-list\s*\{[\s\S]*grid-template-columns: repeat\(4/);
assert.match(estHardwareStatusButtonStyles, /\.port-section\s*\{[\s\S]*border-top: 0/);
assert.match(estHardwareStatusButtonStyles, /\.summary-grid\s*\{[\s\S]*grid-template-columns: auto minmax\(0, 1fr\) auto/);
assert.match(estHardwareStatusButtonStyles, /@media \(max-width: 720px\)[\s\S]*\.port-list\s*\{[\s\S]*repeat\(2/);
assert.match(estHardwareStatusButtonStyles, /@media \(max-width: 720px\)[\s\S]*\.summary-grid\s*\{[\s\S]*minmax\(70px/);
assert.match(estHardwareStatusButtonStyles, /\.panel-header\s*\{[\s\S]*cursor: move/);
assert.match(estHardwareStatusButtonStyles, /\.firmware-update-button/);
assert.match(estHardwareStatusButtonStyles, /\.firmware-update-menu/);
assert.match(estHardwareStatusButtonStyles, /\.firmware-update-option\s*\{[\s\S]*text-align: left/);
assert.ok(!estHardwareStatusButtonStyles.includes('border-left: 1px solid'));
const estDeviceServiceSource = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'src',
    'main',
    'est',
    'device-service.js'
), 'utf8');
assert.match(estDeviceServiceSource, /checkProgramFirmwareCompatibility/);
assert.match(estDeviceServiceSource, /capabilityNamesFor/);
assert.match(estDeviceServiceSource, /includeProgramStatus/);
assert.ok(!estDeviceServiceSource.includes('CAPABILITY_FROZEN_EST_RUNTIME'));
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
assert.match(estProgramMainSource, /ipcMain\.handle\('est-flash-firmware'/);
assert.match(estProgramMainSource, /estFirmwareUpdateState/);
assert.match(estProgramMainSource, /flashEstFirmware\(request\)/);
assert.match(estProgramMainSource, /ipcMain\.handle\('est-get-status', \(event, options\)/);
assert.match(estProgramMainSource, /ipcMain\.handle\('est-auto-connect', \(event, options\)/);
const packageJson = require(path.resolve(__dirname, '..', 'package.json'));
assert.match(packageJson.scripts.postinstall, /ensure-electron-native-arch\.js/);
assert.match(packageJson.scripts.start, /launch-openblock\.js/);
assert.match(packageJson.scripts['ensure:native'], /ensure-electron-native-arch\.js/);
assert.match(packageJson.scripts['check:hid'], /check-est-hid\.js/);
const launchOpenblockSource = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'scripts',
    'launch-openblock.js'
), 'utf8');
assert.match(launchOpenblockSource, /ensureElectronNativeArch\(\);[\s\S]*spawn\(/);
const electronBuilderWrapperSource = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'scripts',
    'electron-builder-wrapper.js'
), 'utf8');
assert.match(electronBuilderWrapperSource, /finally\s*\{[\s\S]*ensureElectronNativeArch\(\);[\s\S]*\}/);
const ensureElectronNativeArchSource = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'scripts',
    'ensure-electron-native-arch.js'
), 'utf8');
assert.match(ensureElectronNativeArchSource, /readPeMachine/);
assert.match(ensureElectronNativeArchSource, /HID\.node/);
assert.match(ensureElectronNativeArchSource, /node-hid/);
assert.match(ensureElectronNativeArchSource, /@electron\/rebuild\/lib\/cli\.js/);
const checkEstHidSource = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'scripts',
    'check-est-hid.js'
), 'utf8');
assert.match(checkEstHidSource, /ELECTRON_RUN_AS_NODE/);
assert.match(checkEstHidSource, /HID\.devices\(\)/);
assert.match(checkEstHidSource, /EstDeviceService/);
assert.match(checkEstHidSource, /autoConnect\(\{includeProgramStatus: true\}\)/);
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
const estRendererAppStyles = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'src',
    'renderer',
    'app.css'
), 'utf8');
assert.match(estRendererAppStyles, /\.app :global\(\.injectionDiv\) \{[\s\S]*overflow: hidden !important;/);
assert.match(estRendererAppStyles, /\[class\*="menu-bar_menu-bar_"\][\s\S]*position: relative;/);
assert.match(estRendererAppStyles, /\[class\*="menu-bar_menu-bar_"\][\s\S]*display: grid;/);
assert.match(estRendererAppStyles, /\[class\*="menu-bar_menu-bar_"\][\s\S]*grid-template-columns:/);
assert.match(estRendererAppStyles, /\[class\*="menu-bar_menu-bar_"\][\s\S]*background-color: #f1f3f5;/);
assert.match(estRendererAppStyles, /\[class\*="menu-bar_menu-bar_"\][\s\S]*color: #1f2937;/);
assert.match(estRendererAppStyles, /\[class\*="gui_body-wrapper_"\][\s\S]*background-color: #f1f3f5;/);
assert.match(estRendererAppStyles, /\[class\*="loader_background_"\][\s\S]*background-color: #f1f3f5 !important;/);
assert.match(estRendererAppStyles, /\[class\*="loader_background_"\][\s\S]*color: #111827 !important;/);
assert.match(estRendererAppStyles, /\[class\*="loader_title_"\][\s\S]*color: #111827 !important;/);
assert.match(estRendererAppStyles, /\[class\*="loader_message_"\][\s\S]*color: #111827 !important;/);
assert.match(estRendererAppStyles, /\.app :global\(\.blocklyToolboxDiv\) \{[\s\S]*height: 100% !important;/);
assert.match(estRendererAppStyles, /\[class\*="gui_extension-button-container_"\]\) \{[\s\S]*width: 2\.625rem;/);
assert.match(estRendererAppStyles, /\[class\*="gui_extension-button-container_"\]\) \{[\s\S]*height: 2\.275rem;/);
assert.match(estRendererAppStyles, /\[class\*="gui_extension-button-container_"\]\) \{[\s\S]*right: auto;/);
assert.match(estRendererAppStyles, /\[class\*="gui_extension-button-container_"\]\) \{[\s\S]*border: 0;/);
assert.match(estRendererAppStyles, /\[class\*="gui_extension-button-container_"\]\) \{[\s\S]*border-radius: 8px;/);
assert.match(estRendererAppStyles, /\[class\*="gui_extension-button-container_"\]\) \{[\s\S]*box-shadow: none;/);
assert.match(estRendererAppStyles, /\[class\*="gui_extension-button-container_"\]::before\) \{[\s\S]*display: none;/);
assert.match(estRendererAppStyles, /\[class\*="gui_extension-button_"\]\) \{[\s\S]*justify-content: center;/);
assert.match(
    estRendererAppStyles,
    /\[class\*="modal_modal-content_"\]\[class\*="modal_full-screen_"\]\) \{[\s\S]*background-color: #ffffff;/
);
assert.match(
    estRendererAppStyles,
    /\[class\*="modal_modal-content_"\]\[class\*="modal_full-screen_"\] \[class\*="box_box_"\]\) \{[\s\S]*background-color: #ffffff;/
);
assert.match(
    estRendererAppStyles,
    /\[class\*="modal_full-screen_"\] \[class\*="modal_header_"\]\) \{[\s\S]*background-color: #f1f3f5;[\s\S]*color: #111827;/
);
assert.match(
    estRendererAppStyles,
    /\[class\*="modal_full-screen_"\] \[class\*="modal_back-button_"\] img\) \{[\s\S]*filter: brightness\(0\) invert\(16%\);/
);
assert.match(estRendererAppStyles, /\[class\*="library_filter-bar_"\]\) \{[\s\S]*display: none !important;/);
assert.match(
    estRendererAppStyles,
    /\[class\*="library_library-scroll-grid_"\]\) \{[\s\S]*height: calc\(100% - 3\.125rem\);[\s\S]*background-color: #ffffff;/
);
assert.match(estRendererAppStyles, /\[class\*="menu-bar_file-menu_"\][\s\S]*grid-column: 2;/);
assert.match(estRendererAppStyles, /\[class\*="menu-bar_file-menu_"\][\s\S]*position: relative;/);
assert.match(estRendererAppStyles, /\[class\*="menu-bar_file-menu_"\][\s\S]*z-index: 1;/);
assert.doesNotMatch(estRendererAppStyles, /\[class\*="menu-bar_file-menu_"\][\s\S]*left: 50%;/);
assert.doesNotMatch(estRendererAppStyles, /\[class\*="menu-bar_file-menu_"\][\s\S]*transform: translateX\(-50%\);/);
assert.match(estRendererAppStyles, /--est-centered-file-menu-width/);
assert.match(estRendererAppStyles, /var\(--est-centered-file-menu-width, 252px\)/);
assert.match(estRendererAppStyles, /\[class\*="menu-bar_file-menu_"\][\s\S]*overflow: hidden;/);
assert.match(
    estRendererAppStyles,
    /img:not\(\[class\*="menu-bar_openblock-logo_"\]\)[\s\S]*filter: brightness\(0\) invert\(16%\);/
);
assert.match(
    estRendererAppStyles,
    /\[class\*="menu-bar_menu-bar-item_"\]\[class\*="menu-bar_hoverable_"\]:hover\),[\s\S]*color: #1f2937;/
);
assert.match(
    estRendererAppStyles,
    /\[class\*="menu-bar_active_"\] img:not\(\[class\*="menu-bar_openblock-logo_"\]\)\)[\s\S]*filter: brightness\(0\) invert\(16%\);/
);
assert.ok(estRendererAppStyles.includes('.app :global(.est-menu-bar-home-button)'));
assert.match(estRendererAppStyles, /\.est-menu-bar-home-button\) \{[\s\S]*font-size: 0\.75rem;/);
assert.match(estRendererAppStyles, /\.est-menu-bar-home-button\) \{[\s\S]*font-weight: bold;/);
assert.match(estRendererAppStyles, /\.est-menu-bar-home-button:hover\),[\s\S]*background-color: rgba\(0, 0, 0, 0\.15\);/);
assert.match(estRendererAppStyles, /\.est-menu-bar-home-button:active\) \{[\s\S]*color: #1f2937;/);
assert.match(estRendererAppStyles, /\[class\*="project-title-input_title-field_"\][\s\S]*color: #111827;/);
assert.match(estRendererAppStyles, /project-title-input_title-field_"\]::placeholder\)[\s\S]*color: #4b5563;/);
assert.match(
    estRendererAppStyles,
    /\[class\*="language-selector_language-select_"\] option\) \{[\s\S]*background-color: #f8fafc;[\s\S]*color: #1f2937;/
);
assert.match(
    estRendererAppStyles,
    /\[class\*="language-selector_language-select_"\] option:hover\) \{[\s\S]*background-color: #e5e7eb;/
);
assert.match(estRendererAppStyles, /\[class\*="menu-bar_menu-bar-menu_"\]\[class\*="menu_menu_"\][\s\S]*background-color: #f8fafc !important;/);
assert.match(estRendererAppStyles, /\[class\*="menu-bar_menu-bar-menu_"\]\[class\*="menu_menu_"\][\s\S]*overflow: hidden;/);
assert.match(estRendererAppStyles, /\[class\*="menu-bar_menu-bar-menu_"\] \[class\*="menu_menu-item_"\][\s\S]*justify-content: flex-start;/);
assert.match(estRendererAppStyles, /\[class\*="menu-bar_menu-bar-menu_"\] \[class\*="menu_menu-item_"\][\s\S]*background-color: #f8fafc !important;/);
assert.match(estRendererAppStyles, /\[class\*="menu-bar_menu-bar-menu_"\] \[class\*="menu_menu-item_"\][\s\S]*text-align: left;/);
assert.match(estRendererAppStyles, /\[class\*="menu-bar_menu-bar-menu_"\] \[class\*="menu_menu-item_"\]:hover[\s\S]*background-color: #e5e7eb !important;/);
assert.ok(!estRendererAppStyles.includes('--est-centered-file-menu-max-width'));
assert.ok(!estRendererAppStyles.includes('est-menu-bar-hide-centered-file-menu'));
assert.match(estRendererAppStyles, /\[class\*="gui_tab-list_"\][\s\S]*display: none !important;/);
assert.match(estRendererAppStyles, /\[class\*="gui_tab-list_"\][\s\S]*height: 0 !important;/);
for (const categoryColourRule of [
    ['scratchCategoryId-motor', '#0090F5'],
    ['scratchCategoryId-movement', '#fb59ce'],
    ['scratchCategoryId-display', '#935DF5'],
    ['scratchCategoryId-estSound', '#BF70E7'],
    ['scratchCategoryId-estEvents', '#F5C400'],
    ['scratchCategoryId-estControl', '#FFB515'],
    ['scratchCategoryId-sensors', '#1DCCF0'],
    ['scratchCategoryId-operators', '#40BF4A'],
    ['scratchCategoryId-variables', '#FF8C1A'],
    ['scratchCategoryId-myBlocks', '#FF6680']
]) {
    assert.match(
        estRendererAppStyles,
        new RegExp(`${categoryColourRule[0]}[\\s\\S]*color: ${categoryColourRule[1].replace('#', '#')};`)
    );
}
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
assert.match(electronBuilderSource, /win:\r?\n {2}icon: buildResources\/OpenBlockDesktop\.ico/);
assert.match(electronBuilderSource, /mac:[\s\S]*icon: buildResources\/OpenBlockDesktop\.icns/);
assert.match(electronBuilderSource, /linux:[\s\S]*icon: buildResources\/linux/);
const installerSource = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'buildResources',
    'installer.nsh'
), 'utf8');
assert.match(installerSource, /InstallLocation "C:\\EST Studio"/);
assert.ok(!installerSource.includes('C:\\OpenBlockDesktop'));
assert.match(installerSource, /File "\/oname=ESTStudio-\$\{VERSION\}\.ico" "\$\{BUILD_RESOURCES_DIR\}\\OpenBlockDesktop\.ico"/);
assert.match(installerSource, /File "\/oname=ESTStudioProject-\$\{VERSION\}\.ico" "\$\{BUILD_RESOURCES_DIR\}\\OpenBlockFile\.ico"/);
assert.match(installerSource, /WriteRegStr SHELL_CONTEXT "Software\\Classes\\EST Studio project file\\DefaultIcon" "" "\$R3"/);
assert.match(installerSource, /CreateShortCut "\$newDesktopLink" "\$appExe" "" "\$R2" 0/);
assert.match(installerSource, /CreateShortCut "\$newStartMenuLink" "\$appExe" "" "\$R2" 0/);
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
assert.match(mainProcessSource, /nativeImage/);
assert.match(mainProcessSource, /import appIconIco from '\.\.\/icon\/OpenBlockDesktop\.ico';/);
assert.match(mainProcessSource, /import appIconPng from '\.\.\/icon\/OpenBlockDesktop\.png';/);
assert.match(mainProcessSource, /app\.setAppUserModelId\(estStudioAppId\)/);
assert.match(mainProcessSource, /const resolveBundledAssetPath = assetPath =>/);
assert.match(mainProcessSource, /path\.resolve\(process\.cwd\(\), 'dist', 'main', assetPath\)/);
assert.match(mainProcessSource, /candidates\.find\(candidate => fs\.existsSync\(candidate\)\) \|\| null/);
assert.match(mainProcessSource, /nativeImage\.createFromPath\(iconPath\)/);
assert.match(mainProcessSource, /return undefined/);
assert.match(mainProcessSource, /process\.platform === 'win32' \? appIconIco : appIconPng/);
assert.match(mainProcessSource, /const windowIcon = getWindowIcon\(\)/);
assert.match(mainProcessSource, /icon: windowIcon/);
assert.match(mainProcessSource, /window\.setIcon\(windowIcon\)/);
assert.ok(!mainProcessSource.includes('OpenblockDesktopTelemetry'));
assert.ok(!mainProcessSource.includes("send('setUserId'"));
assert.ok(!mainProcessSource.includes("ipcMain.on('clearCache'"));
assert.ok(!mainProcessSource.includes("ipcMain.on('installDriver'"));
assert.ok(!mainProcessSource.includes("ipcMain.on('reqeustCheckUpdate'"));
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
assert.ok(fs.statSync(path.resolve(__dirname, '..', 'src', 'icon', 'OpenBlockDesktop.png')).size > 100000);
assert.ok(fs.statSync(path.resolve(__dirname, '..', 'src', 'icon', 'OpenBlockDesktop.ico')).size > 100000);
assert.ok(fs.statSync(path.resolve(__dirname, '..', 'buildResources', 'OpenBlockDesktop.ico')).size > 100000);
assert.ok(fs.statSync(path.resolve(__dirname, '..', 'buildResources', 'OpenBlockFile.ico')).size > 50000);
const fileIconPng = fs.readFileSync(path.resolve(__dirname, '..', 'buildResources', 'OpenBlockFile.png'));
assert.deepStrictEqual([...fileIconPng.slice(0, 8)], [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
assert.strictEqual(fileIconPng.toString('ascii', 12, 16), 'IHDR');
assert.strictEqual(fileIconPng[24], 8);
assert.strictEqual(fileIconPng[25], 6);
assert.ok(fs.statSync(path.resolve(__dirname, '..', 'buildResources', 'OpenBlockDesktop.icns')).size > 1000000);
assert.ok(fs.statSync(path.resolve(__dirname, '..', 'buildResources', 'linux', '512x512.png')).size > 100000);
assert.ok(!fs.existsSync(path.resolve(__dirname, '..', 'src', 'icon', 'OpenBlockDesktop.svg')));
assert.ok(!fs.existsSync(path.resolve(__dirname, '..', 'src', 'icon', 'OpenBlockLoading.svg')));
const aboutSource = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'renderer', 'about.jsx'), 'utf8');
const loadingSource = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'renderer', 'loading.jsx'), 'utf8');
const rendererIndexHtml = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');
assert.match(aboutSource, /import logo from '\.\.\/icon\/OpenBlockDesktop\.png';/);
assert.match(loadingSource, /import logo from '\.\.\/icon\/OpenBlockDesktop\.png';/);
assert.match(rendererIndexHtml, /background-color: #f1f3f5;/);
assert.match(rendererIndexHtml, /color: #111827;/);
assert.match(rendererIndexHtml, /EST Studio is loading\.\.\./);
assert.ok(!rendererIndexHtml.includes('OpenBlock is loading'));
assert.ok(!rendererIndexHtml.includes('#4D97FF'));
const iconBuildScript = fs.readFileSync(path.resolve(__dirname, '..', 'buildResources', 'make-icons.sh'), 'utf8');
assert.match(iconBuildScript, /SRC=\.\.\/src\/icon\/OpenBlockDesktop\.png/);
assert.match(iconBuildScript, /WINDOW_ICON_SRC=\.\.\/src\/renderer\/est-menu-logo\.png/);
assert.match(iconBuildScript, /ICO_TITLEBAR_SIZES="16 20 24 30"/);
assert.match(iconBuildScript, /resize_titlebar_icon/);
assert.match(iconBuildScript, /-crop 560x245\+0\+0/);
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
assert.match(sharedWebpackConfig, /EST_LOCALES_LOADER/);
assert.match(sharedWebpackConfig, /openblock-l10n/);
assert.match(sharedWebpackConfig, /editor-msgs\\\.js/);
assert.match(sharedWebpackConfig, /EST_CODE_DRAWER_TOGGLE/);
assert.match(sharedWebpackConfig, /est-code-drawer-toggle\$/);
assert.match(sharedWebpackConfig, /EST_HARDWARE_STATUS_BUTTON/);
assert.match(sharedWebpackConfig, /est-hardware-status-button\$/);
assert.match(sharedWebpackConfig, /EST_LANGUAGE_MENU/);
assert.match(sharedWebpackConfig, /est-language-menu\$/);
assert.match(sharedWebpackConfig, /EST_MENU_BAR_LAYOUT/);
assert.match(sharedWebpackConfig, /est-menu-bar-layout\$/);
assert.match(sharedWebpackConfig, /EST_MENU_LOGO/);
assert.match(sharedWebpackConfig, /est-menu-logo\$/);
assert.match(sharedWebpackConfig, /svg\|png\|ico\|wav\|gif\|jpg\|ttf/);
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
assert.ok(!updaterSource.includes('reqeustCheckUpdate'));
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

assert.strictEqual(CAPABILITY_UNLIMITED_PYTHON_RUN, 1 << 18);
assert.strictEqual(CAPABILITY_DISPLAY_FONT_STYLES, 1 << 19);
assert.strictEqual(CAPABILITY_ZERO_SPEED_MOTOR_CONTROL, 1 << 20);
assert.strictEqual(CAPABILITY_HOLD_POSITION_CONTROL, 1 << 21);
assert.strictEqual(CAPABILITY_TEMPERATURE_SENSOR, 1 << 22);
assert.strictEqual(CAPABILITY_COOPERATIVE_MULTITASK, 1 << 23);
assert.strictEqual(CAPABILITY_RUNTIME_BASIC_EVENT_HATS, 1 << 24);
assert.strictEqual(CAPABILITY_MOTOR_STALL_DETECTION, 1 << 25);
assert.strictEqual(CAPABILITY_AUDIO_PLAYBACK, 1 << 26);
const m114ADeviceStatusPayload = new Uint8Array(72);
m114ADeviceStatusPayload[0] = 1;
m114ADeviceStatusPayload[1] = 25;
m114ADeviceStatusPayload.set(Buffer.from('M1.14A', 'ascii'), 2);
writeUint32LE(
    m114ADeviceStatusPayload,
    16,
    EST_TEMPERATURE_PROGRAM_REQUIRED_CAPABILITIES |
        CAPABILITY_HOLD_POSITION_CONTROL |
        CAPABILITY_COOPERATIVE_MULTITASK |
        CAPABILITY_RUNTIME_BASIC_EVENT_HATS
);
const parsedM114ADeviceStatus = parseDeviceStatusResponse(
    buildDeviceResponse(COMMAND_DEVICE_STATUS, m114ADeviceStatusPayload)
);
assert.strictEqual(parsedM114ADeviceStatus.firmwareVersion, 'M1.14A');
assert.deepStrictEqual(
    [parsedM114ADeviceStatus.protocolMajor, parsedM114ADeviceStatus.protocolMinor],
    [1, 25]
);
assert.strictEqual(
    parsedM114ADeviceStatus.capabilities & EST_TEMPERATURE_PROGRAM_REQUIRED_CAPABILITIES,
    EST_TEMPERATURE_PROGRAM_REQUIRED_CAPABILITIES
);
assert.strictEqual(
    parsedM114ADeviceStatus.capabilities & CAPABILITY_COOPERATIVE_MULTITASK,
    CAPABILITY_COOPERATIVE_MULTITASK
);
assert.strictEqual(
    parsedM114ADeviceStatus.capabilities & CAPABILITY_RUNTIME_BASIC_EVENT_HATS,
    CAPABILITY_RUNTIME_BASIC_EVENT_HATS
);
assert.deepStrictEqual(
    capabilityNamesFor(
        CAPABILITY_FROZEN_EST_RUNTIME |
            CAPABILITY_UNLIMITED_PYTHON_RUN |
            CAPABILITY_DISPLAY_FONT_STYLES |
            CAPABILITY_ZERO_SPEED_MOTOR_CONTROL |
            CAPABILITY_HOLD_POSITION_CONTROL |
            CAPABILITY_TEMPERATURE_SENSOR |
            CAPABILITY_COOPERATIVE_MULTITASK |
            CAPABILITY_RUNTIME_BASIC_EVENT_HATS
    ),
    [
        'frozen-est-runtime',
        'unlimited-python-run',
        'display-font-styles',
        'zero-speed-motor-control',
        'hold-position-control',
        'runtime-temperature',
        'cooperative-multitask',
        'runtime-basic-event-hats'
    ]
);
assert.deepStrictEqual(
    capabilityNamesFor(CAPABILITY_MOTOR_STALL_DETECTION),
    ['motor-stall-detection']
);
assert.deepStrictEqual(
    capabilityNamesFor(CAPABILITY_AUDIO_PLAYBACK),
    ['audio-playback']
);
assert.deepStrictEqual(
    capabilityNamesFor(CAPABILITY_AUDIO_RESOURCE_FLASH),
    ['audio-resource-flash']
);
assert.strictEqual(checkProgramFirmwareCompatibility(parsedM114ADeviceStatus).programCompatible, true);
assert.strictEqual(
    checkProgramFirmwareCompatibility(parsedM114ADeviceStatus, CAPABILITY_TEMPERATURE_SENSOR).programCompatible,
    true
);
assert.strictEqual(
    checkProgramFirmwareCompatibility(parsedM114ADeviceStatus, CAPABILITY_COOPERATIVE_MULTITASK).programCompatible,
    true
);
assert.strictEqual(
    checkProgramFirmwareCompatibility(parsedM114ADeviceStatus, CAPABILITY_RUNTIME_BASIC_EVENT_HATS).programCompatible,
    true
);

class ProgramTestTransport {
    constructor ({
        capabilities = EST_PROGRAM_REQUIRED_CAPABILITIES,
        firmwareVersion = 'M1.12A',
        protocolMinor = 21,
        respondToDeviceStatus = true,
        respondToPythonStatus = true,
        writeError = null,
        readError = null
    } = {}) {
        this.actions = [];
        this.capabilities = capabilities;
        this.closed = false;
        this.closeCount = 0;
        this.firmwareVersion = firmwareVersion;
        this.protocolMinor = protocolMinor;
        this.readError = readError;
        this.respondToDeviceStatus = respondToDeviceStatus;
        this.respondToPythonStatus = respondToPythonStatus;
        this.writeError = writeError;
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
        if (this.writeError) {
            throw this.writeError;
        }
        const command = report[2];
        const action = command === COMMAND_DEVICE_STATUS ? 0 : report[5];
        this.actions.push(`${command}:${action}`);
        if (command === COMMAND_PYTHON_PROGRAM) {
            this.handlePython(report, action);
        } else if (command === COMMAND_PERSISTENT_PROGRAM) {
            this.handlePersistent(report, action);
        } else if (command === COMMAND_DEVICE_STATUS && this.respondToDeviceStatus) {
            this.responses.push(this.buildDeviceStatusResponse());
        }
        return Promise.resolve();
    }

    read () {
        if (this.readError) {
            throw this.readError;
        }
        return Promise.resolve(this.responses.shift() || new Uint8Array());
    }

    close () {
        this.closeCount += 1;
        this.closed = true;
        return Promise.resolve();
    }

    handlePython (report, action) {
        const payloadLength = report[3] | (report[4] << 8);
        if (action === 0 && !this.respondToPythonStatus) {
            return;
        }
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

    buildDeviceStatusResponse () {
        const payload = new Uint8Array(72);
        payload[0] = 1;
        payload[1] = this.protocolMinor;
        payload.set(Buffer.from(this.firmwareVersion, 'ascii').slice(0, 6), 2);
        payload[8] = 4;
        payload[9] = 4;
        writeUint32LE(payload, 16, this.capabilities);
        return buildDeviceResponse(COMMAND_DEVICE_STATUS, payload);
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
        '25:0',
        '36:0',
        '36:1',
        '36:2',
        '36:2',
        '37:1'
    ]);

    const legacyDownloaded = await service.downloadProgram({
        slot: 4,
        source: 'import est_runtime as rt\n'
    });
    assert.strictEqual(legacyDownloaded.slot, 4);
    assert.strictEqual(legacyDownloaded.programName, 'Program 4');
    assert.strictEqual(legacyDownloaded.savedStatus.programName, 'Program 4');
    assert.strictEqual(transport.slots[4].name, 'Program 4');

    const actionsBeforeManualRefresh = transport.actions.length;
    const fullIdleStatus = await service.getStatus({includeProgramStatus: true});
    assert.strictEqual(fullIdleStatus.firmwareVersion, 'M1.12A');
    assert.ok(fullIdleStatus.capabilityNames.includes('frozen-est-runtime'));
    assert.ok(fullIdleStatus.capabilityNames.includes('unlimited-python-run'));
    assert.strictEqual(fullIdleStatus.programStatus.state, 2);
    assert.deepStrictEqual(transport.actions.slice(actionsBeforeManualRefresh), ['25:0', '36:0']);

    const runSource = 'import est\nest._program_result(7)\n';
    const running = await service.runProgram({source: runSource, slot: 5});
    assert.strictEqual(running.slot, 5);
    assert.strictEqual(running.programName, 'Program 5');
    assert.strictEqual(running.savedStatus.programName, 'Program 5');
    assert.strictEqual(running.savedStatus.programSlotId, 5);
    assert.strictEqual(running.run.loadedStatus.programSlotId, 5);
    assert.strictEqual(running.run.runStatus.state, 3);
    assert.strictEqual(running.run.runStatus.timeoutMs, PYTHON_PROGRAM_NO_TIMEOUT_MS);
    assert.strictEqual(transport.python.timeoutMs, PYTHON_PROGRAM_NO_TIMEOUT_MS);
    assert.strictEqual(transport.slots[5].source.toString('utf8'), runSource);
    assert.deepStrictEqual(transport.actions.slice(-6), [
        '36:0',
        '36:1',
        '36:2',
        '37:1',
        '37:2',
        '36:3'
    ]);
    const actionsBeforeRunningPanelRefresh = transport.actions.length;
    const runningPanelConnection = await service.autoConnect({includeProgramStatus: true});
    assert.strictEqual(runningPanelConnection.state, 'connected');
    assert.strictEqual(runningPanelConnection.status.statusPollingDeferred, true);
    assert.strictEqual(runningPanelConnection.status.programStatus.state, 3);
    assert.deepStrictEqual(transport.actions.slice(actionsBeforeRunningPanelRefresh), ['36:0']);

    const temperatureSource = "import est_runtime as rt\nvalue = rt.temperature('3').celsius()\n";
    const temperatureTransport = new ProgramTestTransport({
        capabilities: EST_TEMPERATURE_PROGRAM_REQUIRED_CAPABILITIES,
        firmwareVersion: 'M1.14A',
        protocolMinor: 24
    });
    const temperatureService = new EstDeviceService({
        fragmentWriteDelayMs: 0,
        programStatusPollIntervalMs: 0,
        requestTimeoutMs: 100
    });
    temperatureService.transport = temperatureTransport;
    temperatureService.device = service.device;
    await temperatureService.runProgram({source: temperatureSource, slot: 1});
    assert.strictEqual(temperatureTransport.python.timeoutMs, PYTHON_PROGRAM_NO_TIMEOUT_MS);
    assert.ok(temperatureTransport.actions.includes('36:3'));

    const missingTemperatureTransport = new ProgramTestTransport();
    const missingTemperatureService = new EstDeviceService({
        fragmentWriteDelayMs: 0,
        programStatusPollIntervalMs: 0,
        requestTimeoutMs: 100
    });
    missingTemperatureService.transport = missingTemperatureTransport;
    missingTemperatureService.device = service.device;
    await assert.rejects(
        missingTemperatureService.runProgram({source: temperatureSource, slot: 1}),
        /runtime-temperature/
    );
    assert.ok(!missingTemperatureTransport.actions.includes('36:3'));

    const newRuntimeApiSource = [
        'import est_runtime as rt',
        'speed = 20',
        "rt.motor_start_speed('A', speed)",
        ''
    ].join('\n');
    const m122DTransport = new ProgramTestTransport({
        firmwareVersion: 'M1.22D',
        protocolMinor: 26
    });
    const m122DService = new EstDeviceService({
        fragmentWriteDelayMs: 0,
        programStatusPollIntervalMs: 0,
        requestTimeoutMs: 100
    });
    m122DService.transport = m122DTransport;
    m122DService.device = service.device;
    await assert.rejects(
        m122DService.downloadProgram({source: newRuntimeApiSource, slot: 1}),
        /M1\.22D.*M1\.22E/
    );
    await assert.rejects(
        m122DService.runProgram({source: newRuntimeApiSource, slot: 1}),
        /M1\.22D.*M1\.22E/
    );
    assert.ok(!m122DTransport.actions.includes('36:1'));
    assert.ok(!m122DTransport.actions.includes('36:3'));
    assert.ok(!m122DTransport.actions.includes('37:1'));

    const m122ETransport = new ProgramTestTransport({
        firmwareVersion: 'M1.22E',
        protocolMinor: 26
    });
    const m122EService = new EstDeviceService({
        fragmentWriteDelayMs: 0,
        programStatusPollIntervalMs: 0,
        requestTimeoutMs: 100
    });
    m122EService.transport = m122ETransport;
    m122EService.device = service.device;
    await m122EService.downloadProgram({source: newRuntimeApiSource, slot: 1});
    assert.ok(m122ETransport.actions.includes('36:1'));
    assert.ok(m122ETransport.actions.includes('37:1'));

    const m122HTransport = new ProgramTestTransport({
        firmwareVersion: 'M1.22H',
        protocolMinor: 26
    });
    const m122HService = new EstDeviceService({
        fragmentWriteDelayMs: 0,
        programStatusPollIntervalMs: 0,
        requestTimeoutMs: 100
    });
    m122HService.transport = m122HTransport;
    m122HService.device = service.device;
    await m122HService.runProgram({source: newRuntimeApiSource, slot: 1});
    assert.ok(m122HTransport.actions.includes('36:1'));
    assert.ok(m122HTransport.actions.includes('37:1'));
    assert.ok(m122HTransport.actions.includes('36:3'));

    const displayTextRuntimeApiSource = [
        'import est_runtime as rt',
        'sensor_value = 42',
        "rt.display_text(1, 2, sensor_value, font='regular_black')",
        'rt.display_text_line(1, sensor_value)',
        ''
    ].join('\n');
    const m122HDisplayTextTransport = new ProgramTestTransport({
        firmwareVersion: 'M1.22H',
        protocolMinor: 26
    });
    const m122HDisplayTextService = new EstDeviceService({
        fragmentWriteDelayMs: 0,
        programStatusPollIntervalMs: 0,
        requestTimeoutMs: 100
    });
    m122HDisplayTextService.transport = m122HDisplayTextTransport;
    m122HDisplayTextService.device = service.device;
    await assert.rejects(
        m122HDisplayTextService.downloadProgram({source: displayTextRuntimeApiSource, slot: 1}),
        /M1\.22H.*M1\.22I/
    );
    await assert.rejects(
        m122HDisplayTextService.runProgram({source: displayTextRuntimeApiSource, slot: 1}),
        /M1\.22H.*M1\.22I/
    );
    assert.ok(!m122HDisplayTextTransport.actions.includes('36:1'));
    assert.ok(!m122HDisplayTextTransport.actions.includes('36:3'));
    assert.ok(!m122HDisplayTextTransport.actions.includes('37:1'));

    const m122IDisplayTextTransport = new ProgramTestTransport({
        firmwareVersion: 'M1.22I',
        protocolMinor: 26
    });
    const m122IDisplayTextService = new EstDeviceService({
        fragmentWriteDelayMs: 0,
        programStatusPollIntervalMs: 0,
        requestTimeoutMs: 100
    });
    m122IDisplayTextService.transport = m122IDisplayTextTransport;
    m122IDisplayTextService.device = service.device;
    await m122IDisplayTextService.runProgram({source: displayTextRuntimeApiSource, slot: 1});
    assert.ok(m122IDisplayTextTransport.actions.includes('36:1'));
    assert.ok(m122IDisplayTextTransport.actions.includes('37:1'));
    assert.ok(m122IDisplayTextTransport.actions.includes('36:3'));

    const oldRuntimeApiOnM122DTransport = new ProgramTestTransport({
        firmwareVersion: 'M1.22D',
        protocolMinor: 26
    });
    const oldRuntimeApiOnM122DService = new EstDeviceService({
        fragmentWriteDelayMs: 0,
        programStatusPollIntervalMs: 0,
        requestTimeoutMs: 100
    });
    oldRuntimeApiOnM122DService.transport = oldRuntimeApiOnM122DTransport;
    oldRuntimeApiOnM122DService.device = service.device;
    await oldRuntimeApiOnM122DService.downloadProgram({
        source: "import est_runtime as rt\nrt.motor_start('A', 'clockwise')\n",
        slot: 2
    });
    assert.ok(oldRuntimeApiOnM122DTransport.actions.includes('36:1'));
    assert.ok(oldRuntimeApiOnM122DTransport.actions.includes('37:1'));

    const cooperativeSource = [
        'import est_runtime as rt',
        '',
        '@rt.on_start',
        'async def stack_1():',
        '  await rt.yield_once()',
        '',
        '@rt.on_start',
        'async def stack_2():',
        '  rt.stop_other_stacks()',
        '',
        'rt.run()',
        ''
    ].join('\n');
    const cooperativeTransport = new ProgramTestTransport({
        capabilities: EST_COOPERATIVE_PROGRAM_REQUIRED_CAPABILITIES,
        firmwareVersion: 'M1.14A',
        protocolMinor: 25
    });
    const cooperativeService = new EstDeviceService({
        fragmentWriteDelayMs: 0,
        programStatusPollIntervalMs: 0,
        requestTimeoutMs: 100
    });
    cooperativeService.transport = cooperativeTransport;
    cooperativeService.device = service.device;
    await cooperativeService.runProgram({source: cooperativeSource, slot: 2});
    assert.strictEqual(cooperativeTransport.python.timeoutMs, PYTHON_PROGRAM_NO_TIMEOUT_MS);
    assert.ok(cooperativeTransport.actions.includes('36:3'));

    const missingCooperativeTransport = new ProgramTestTransport();
    const missingCooperativeService = new EstDeviceService({
        fragmentWriteDelayMs: 0,
        programStatusPollIntervalMs: 0,
        requestTimeoutMs: 100
    });
    missingCooperativeService.transport = missingCooperativeTransport;
    missingCooperativeService.device = service.device;
    await assert.rejects(
        missingCooperativeService.runProgram({source: cooperativeSource, slot: 2}),
        /cooperative-multitask/
    );
    assert.ok(!missingCooperativeTransport.actions.includes('36:3'));

    const basicEventHatsSource = [
        'import est_runtime as rt',
        '',
        '@rt.on_brick_button("confirm", "pressed")',
        'def stack_1():',
        '  rt.stop("all")',
        '',
        'rt.run()',
        ''
    ].join('\n');
    const basicEventHatsTransport = new ProgramTestTransport({
        capabilities: EST_BASIC_EVENT_HATS_PROGRAM_REQUIRED_CAPABILITIES |
            CAPABILITY_COOPERATIVE_MULTITASK,
        firmwareVersion: 'M1.14A',
        protocolMinor: 25
    });
    const basicEventHatsService = new EstDeviceService({
        fragmentWriteDelayMs: 0,
        programStatusPollIntervalMs: 0,
        requestTimeoutMs: 100
    });
    basicEventHatsService.transport = basicEventHatsTransport;
    basicEventHatsService.device = service.device;
    await basicEventHatsService.runProgram({source: basicEventHatsSource, slot: 3});
    assert.strictEqual(basicEventHatsTransport.python.timeoutMs, PYTHON_PROGRAM_NO_TIMEOUT_MS);
    assert.ok(basicEventHatsTransport.actions.includes('36:3'));

    const missingBasicEventHatsTransport = new ProgramTestTransport({
        capabilities: EST_PROGRAM_REQUIRED_CAPABILITIES | CAPABILITY_COOPERATIVE_MULTITASK,
        firmwareVersion: 'M1.14A',
        protocolMinor: 25
    });
    const missingBasicEventHatsService = new EstDeviceService({
        fragmentWriteDelayMs: 0,
        programStatusPollIntervalMs: 0,
        requestTimeoutMs: 100
    });
    missingBasicEventHatsService.transport = missingBasicEventHatsTransport;
    missingBasicEventHatsService.device = service.device;
    await assert.rejects(
        missingBasicEventHatsService.runProgram({source: basicEventHatsSource, slot: 3}),
        /runtime-basic-event-hats/
    );
    assert.ok(!missingBasicEventHatsTransport.actions.includes('36:3'));

    const unsupportedRuntimeTransport = new ProgramTestTransport({
        firmwareVersion: 'M1.22H',
        protocolMinor: 26
    });
    const unsupportedRuntimeService = new EstDeviceService({
        fragmentWriteDelayMs: 0,
        programStatusPollIntervalMs: 0,
        requestTimeoutMs: 100
    });
    unsupportedRuntimeService.transport = unsupportedRuntimeTransport;
    unsupportedRuntimeService.device = service.device;
    await assert.rejects(
        unsupportedRuntimeService.downloadProgram({
            source: "import est_runtime as rt\nrt.drive_start_dual_speed(0, 50)\n",
            slot: 1
        }),
        /M1\.22H.*M1\.22L/
    );
    await assert.rejects(
        unsupportedRuntimeService.runProgram({
            source: "import est_runtime as rt\n@rt.on_color('3', 'red')\ndef stack_1():\n  pass\n",
            slot: 1
        }),
        /尚未实现.*颜色传感器事件帽.*on_color/
    );
    assert.deepStrictEqual(unsupportedRuntimeTransport.actions, ['25:0']);

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

    const oldTransport = new ProgramTestTransport({
        capabilities: CAPABILITY_FROZEN_EST_RUNTIME,
        firmwareVersion: 'M1.09A',
        protocolMinor: 19
    });
    const oldDevice = {...service.device, path: 'old-est-device'};
    const oldService = new EstDeviceService({
        requestTimeoutMs: 100,
        transportFactory: {
            listDevices: () => Promise.resolve([oldDevice])
        }
    });
    oldService.transport = oldTransport;
    oldService.device = oldDevice;
    oldService.firmwareVersion = 'M1.09A';
    const oldConnection = await oldService.autoConnect();
    assert.strictEqual(oldConnection.state, 'connected');
    assert.strictEqual(oldConnection.compatible, true);
    assert.strictEqual(oldConnection.status.compatibility.programCompatible, false);
    assert.match(oldConnection.status.compatibility.programMessage, /1\.21/);
    await assert.rejects(
        oldService.runProgram({source: 'import est\n', slot: 0}),
        /当前 EST 固件不支持这个程序.*1\.21.*unlimited-python-run.*display-font-styles.*zero-speed-motor-control/
    );
    assert.ok(!oldTransport.actions.includes('36:3'));

    const unknownDevice = {...service.device, path: 'unknown-new-est'};
    const unknownTransport = new ProgramTestTransport({
        firmwareVersion: 'M1.11A',
        protocolMinor: 21,
        capabilities: 0,
        respondToDeviceStatus: false
    });
    const unknownService = new EstDeviceService({
        requestTimeoutMs: 100,
        transportFactory: {
            listDevices: () => Promise.resolve([unknownDevice])
        }
    });
    unknownService.transport = unknownTransport;
    unknownService.device = unknownDevice;
    unknownService.firmwareVersion = 'M1.11A';
    const unknownConnection = await unknownService.autoConnect();
    assert.strictEqual(unknownConnection.state, 'connected');
    assert.strictEqual(unknownConnection.compatible, true);
    assert.strictEqual(unknownConnection.status, null);
    assert.strictEqual(unknownTransport.closeCount, 0);
    await assert.rejects(
        unknownService.runProgram({source: 'import est\n', slot: 0}),
        /当前 EST 固件不支持这个程序.*无法读取.*frozen-est-runtime.*unlimited-python-run.*display-font-styles.*zero-speed-motor-control/
    );
    assert.strictEqual(unknownTransport.closeCount, 0);
};

const testProgramStatusTimeoutPreservesStopTransport = async () => {
    const transport = new ProgramTestTransport({respondToDeviceStatus: false});
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
        programStatusRequestTimeoutMs: 5,
        requestTimeoutMs: 5,
        transportFactory: {
            listDevices: () => Promise.resolve([device])
        }
    });
    service.transport = transport;
    service.device = device;
    const compatibleProgramStatus = {
        capabilities: EST_PROGRAM_REQUIRED_CAPABILITIES,
        firmwareVersion: 'M1.12A',
        protocolMajor: 1,
        protocolMinor: 21
    };
    service.lastDeviceStatus = {
        ...compatibleProgramStatus,
        compatibility: checkProgramFirmwareCompatibility(compatibleProgramStatus)
    };

    await service.runProgram({source: 'while True:\n    pass\n', slot: 7});
    assert.strictEqual(service.pythonProgramActive, true);

    const actionsAfterRun = transport.actions.length;
    const status = await service.getStatus();
    assert.strictEqual(status.statusPollingDeferred, true);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(status, 'statusPollingError'), false);
    assert.strictEqual(status.programStatus.state, 3);
    assert.deepStrictEqual(transport.actions.slice(actionsAfterRun), ['36:0']);
    assert.strictEqual(transport.closeCount, 0);
    assert.strictEqual(service.transport, transport);

    const actionsBeforeConnectionRefresh = transport.actions.length;
    const connection = await service.autoConnect();
    assert.strictEqual(connection.state, 'connected');
    assert.strictEqual(connection.status.statusPollingDeferred, true);
    assert.strictEqual(connection.status.programStatus.state, 3);
    assert.deepStrictEqual(transport.actions.slice(actionsBeforeConnectionRefresh), ['36:0']);
    assert.strictEqual(transport.closeCount, 0);
    assert.strictEqual(service.transport, transport);

    transport.respondToPythonStatus = false;
    const actionsBeforeProgramStatusTimeout = transport.actions.length;
    const deferredStatus = await service.getStatus();
    assert.strictEqual(deferredStatus.statusPollingDeferred, true);
    assert.match(deferredStatus.statusPollingError, /0x24/);
    assert.deepStrictEqual(transport.actions.slice(actionsBeforeProgramStatusTimeout), ['36:0']);
    assert.strictEqual(transport.closeCount, 0);
    assert.strictEqual(service.transport, transport);

    transport.respondToPythonStatus = true;
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

const testUsbDisconnectClearsStaleTransport = async () => {
    const transport = new ProgramTestTransport({
        writeError: new TypeError('Cannot write to hid device')
    });
    const service = new EstDeviceService({requestTimeoutMs: 50});
    service.transport = transport;
    service.device = {
        maxInputReportSize: 1024,
        path: 'stale-est-device',
        productId: 0x5750,
        product: 'EST HID Device (HS Mode)',
        vendorId: 0x0483
    };
    service.lastDeviceStatus = {
        compatibility: {compatible: true},
        firmwareVersion: 'M1.10C',
        protocolMajor: 1,
        protocolMinor: 20
    };

    await assert.rejects(
        service.downloadProgram({source: 'import est\n', slot: 0}),
        /EST USB 连接已断开/
    );
    assert.strictEqual(transport.closeCount, 1);
    assert.strictEqual(service.transport, null);
    assert.strictEqual(service.device, null);
    assert.strictEqual(service.lastDeviceStatus, null);
    assert.strictEqual(service.pythonProgramActive, false);
    assert.ok(!transport.actions.includes('36:3'));
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
    assert.strictEqual(primitives[EST_SENSOR_PORT_PICKER_ID]({PORT: '4'}), '4');
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
    .then(() => testUsbDisconnectClearsStaleTransport())
    .then(() => testBuiltInMotorBlock())
    .then(() => console.log(
        'EST protocol, queue, 87 EST blocks, and native operator/data/procedure tests passed'
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
