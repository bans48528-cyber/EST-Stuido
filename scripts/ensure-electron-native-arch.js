#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const electronPath = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
const hidNodePath = path.join(projectRoot, 'node_modules', 'node-hid', 'build', 'Release', 'HID.node');

const PE_ARCHES = new Map([
    [0x014c, 'ia32'],
    [0x8664, 'x64'],
    [0xaa64, 'arm64']
]);

const readPeMachine = filePath => {
    const bytes = fs.readFileSync(filePath);
    if (bytes.length < 0x40 || bytes.toString('ascii', 0, 2) !== 'MZ') {
        throw new Error(`${filePath} is not a PE executable`);
    }
    const peOffset = bytes.readUInt32LE(0x3c);
    if (peOffset + 6 > bytes.length || bytes.toString('ascii', peOffset, peOffset + 4) !== 'PE\0\0') {
        throw new Error(`${filePath} does not contain a valid PE header`);
    }
    return bytes.readUInt16LE(peOffset + 4);
};

const peMachineToArch = machine => PE_ARCHES.get(machine) || null;

const readPeArch = filePath => {
    const machine = readPeMachine(filePath);
    const arch = peMachineToArch(machine);
    if (!arch) {
        throw new Error(`${filePath} has unsupported PE machine 0x${machine.toString(16)}`);
    }
    return {arch, machine};
};

const readElectronVersion = () => {
    const electronPackage = require(path.join(projectRoot, 'node_modules', 'electron', 'package.json'));
    return electronPackage.version;
};

const rebuildNodeHid = arch => {
    const cliPath = require.resolve('@electron/rebuild/lib/cli.js');
    const result = spawnSync(process.execPath, [
        cliPath,
        '--version',
        readElectronVersion(),
        '--arch',
        arch,
        '--module-dir',
        projectRoot,
        '--only',
        'node-hid',
        '--force'
    ], {
        cwd: projectRoot,
        env: process.env,
        stdio: 'inherit',
        windowsHide: true
    });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(`electron-rebuild for node-hid ${arch} failed with status ${result.status}`);
    }
};

const ensureElectronNativeArch = () => {
    if (process.platform !== 'win32') {
        return {checked: false, reason: 'non-win32'};
    }

    const electron = readPeArch(electronPath);
    let hid = fs.existsSync(hidNodePath) ? readPeArch(hidNodePath) : null;
    if (hid && hid.arch === electron.arch) {
        console.log(`node-hid native module already matches Electron ${electron.arch}.`);
        return {checked: true, electronArch: electron.arch, hidArch: hid.arch, rebuilt: false};
    }

    const previousArch = hid ? hid.arch : 'missing';
    console.log(`Rebuilding node-hid for Electron ${electron.arch}; current HID.node is ${previousArch}.`);
    rebuildNodeHid(electron.arch);
    hid = readPeArch(hidNodePath);
    if (hid.arch !== electron.arch) {
        throw new Error(`node-hid rebuilt as ${hid.arch}, expected ${electron.arch}`);
    }
    console.log(`node-hid native module now matches Electron ${electron.arch}.`);
    return {checked: true, electronArch: electron.arch, hidArch: hid.arch, rebuilt: true};
};

if (require.main === module) {
    try {
        ensureElectronNativeArch();
    } catch (error) {
        console.error(error && error.stack ? error.stack : error);
        process.exit(1);
    }
}

module.exports = {
    ensureElectronNativeArch,
    peMachineToArch,
    readPeArch,
    readPeMachine
};
