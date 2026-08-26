#!/usr/bin/env node

const {spawnSync} = require('child_process');

const electronWebpackCli = require.resolve('electron-webpack/out/cli.js');
const nodeMajorVersion = Number.parseInt(process.versions.node.split('.')[0], 10);
const legacyProviderOption = '--openssl-legacy-provider';
const inheritedNodeOptions = process.env.NODE_OPTIONS || '';
const nodeOptions = nodeMajorVersion >= 17 && !inheritedNodeOptions.includes(legacyProviderOption) ?
    `${inheritedNodeOptions} ${legacyProviderOption}`.trim() :
    inheritedNodeOptions;

const result = spawnSync(process.execPath, [
    electronWebpackCli,
    '--bail',
    '--env.minify=false',
    '--no-progress',
    '--display=errors-only'
], {
    env: {
        ...process.env,
        NODE_OPTIONS: nodeOptions
    },
    stdio: 'inherit',
    windowsHide: true
});

if (result.error) {
    throw result.error;
}

process.exitCode = result.status === null ? 1 : result.status;
