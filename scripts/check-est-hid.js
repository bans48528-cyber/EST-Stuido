#!/usr/bin/env node

const path = require('path');
const {spawnSync} = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const electronPath = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');

const registerEstBabelLoader = () => {
    const fs = require('fs');
    const Module = require('module');
    const babel = require('@babel/core');
    const estRoots = [
        path.join(projectRoot, 'src', 'main', 'est')
    ];
    const originalLoader = Module._extensions['.js'];
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
};

const printJson = (label, value) => {
    console.log(`${label}: ${JSON.stringify(value, null, 2)}`);
};

const runChild = async () => {
    const {ensureElectronNativeArch} = require('./ensure-electron-native-arch');
    ensureElectronNativeArch();

    const HID = require('node-hid');
    const devices = HID.devices();
    const estDevices = devices.filter(device => device.vendorId === 0x0483 && device.productId === 0x5750);
    printJson('HID.devices', {
        electron: process.versions.electron,
        arch: process.arch,
        count: devices.length,
        est: estDevices.map(device => ({
            path: device.path,
            product: device.product,
            manufacturer: device.manufacturer,
            usagePage: device.usagePage,
            usage: device.usage,
            interface: device.interface
        }))
    });

    registerEstBabelLoader();
    const {EstDeviceService} = require(path.join(projectRoot, 'src', 'main', 'est', 'device-service.js'));
    const {
        createNodeHidEstTransportFactory
    } = require(path.join(projectRoot, 'src', 'main', 'est', 'transports', 'node-hid.js'));
    const service = new EstDeviceService({
        requestTimeoutMs: 1200,
        programStatusRequestTimeoutMs: 500,
        transportFactory: createNodeHidEstTransportFactory()
    });
    const connection = await service.autoConnect({includeProgramStatus: true});
    printJson('EstDeviceService.autoConnect', {
        state: connection.state,
        firmwareVersion: connection.firmwareVersion,
        compatible: connection.compatible,
        message: connection.message,
        protocolMajor: connection.status && connection.status.protocolMajor,
        protocolMinor: connection.status && connection.status.protocolMinor,
        capabilityNames: connection.status && connection.status.capabilityNames,
        programState: connection.status && connection.status.programStatus &&
            connection.status.programStatus.state,
        programError: connection.status && connection.status.programStatus &&
            connection.status.programStatus.error
    });
    await service.disconnect();
};

if (process.env.EST_HID_CHECK_CHILD === '1') {
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
            EST_HID_CHECK_CHILD: '1'
        },
        stdio: 'inherit',
        windowsHide: true
    });
    if (result.error) {
        throw result.error;
    }
    process.exit(result.status === null ? 1 : result.status);
}
