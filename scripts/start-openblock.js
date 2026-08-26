#!/usr/bin/env node

const fs = require('fs');
const {spawn} = require('child_process');

const pidFile = process.env.OPENBLOCK_PID_FILE;

const removePidFile = () => {
    if (!pidFile) return;

    try {
        const recordedPid = fs.readFileSync(pidFile, 'utf8').trim();
        if (recordedPid === `${process.pid}`) {
            fs.unlinkSync(pidFile);
        }
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error('Failed to remove EST Studio PID file:', error);
        }
    }
};

const electronWebpackCli = require.resolve('electron-webpack/out/cli.js');
const dnsResultOrderOption = '--dns-result-order=ipv4first';
const inheritedNodeOptions = process.env.NODE_OPTIONS || '';
const nodeOptions = inheritedNodeOptions.includes(dnsResultOrderOption) ?
    inheritedNodeOptions :
    `${inheritedNodeOptions} ${dnsResultOrderOption}`.trim();
const child = spawn(process.execPath, [
    electronWebpackCli,
    'dev',
    '--bail',
    '--env.minify=false',
    '--no-progress'
], {
    env: {
        ...process.env,
        FORCE_COLOR: '0',
        NO_COLOR: '1',
        NODE_OPTIONS: nodeOptions
    },
    stdio: ['inherit', 'pipe', 'pipe'],
    windowsHide: true
});

const importantPatterns = [
    /compiled successfully|compiling\.\.\.|project is running/i,
    /debugger listening|openblock link server|openblock resource server|renderer_/i,
    /\berror\b|\bwarning\b|failed|cannot apply update/i,
    /application will be restarted/i
];

const createOutputFilter = output => {
    let buffer = '';
    let inElectronSection = false;
    let contextLines = 0;

    const writeLine = line => {
        const plainLine = line;
        const trimmedLine = plainLine.trim();

        if (trimmedLine.startsWith('┏ Electron')) {
            inElectronSection = true;
            return;
        }
        if (trimmedLine.startsWith('┗')) {
            inElectronSection = false;
            return;
        }
        if (inElectronSection) {
            const isKnownDevelopmentNoise = /Electron Security Warning|Error installing dev extension/i.test(plainLine);
            if (trimmedLine && !isKnownDevelopmentNoise) {
                output.write(`${plainLine}\n`);
            }
            return;
        }
        if (importantPatterns.some(pattern => pattern.test(plainLine))) {
            output.write(`${plainLine}\n`);
            contextLines = 8;
            return;
        }
        if (contextLines > 0 && trimmedLine) {
            output.write(`${plainLine}\n`);
            contextLines--;
        }
    };

    return chunk => {
        buffer += chunk.toString();
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop();
        lines.forEach(writeLine);
    };
};

child.stdout.on('data', createOutputFilter(process.stdout));
child.stderr.on('data', createOutputFilter(process.stderr));

child.on('error', error => {
    console.error('Failed to start OpenBlock:', error);
    process.exitCode = 1;
});

child.on('close', code => {
    removePidFile();
    process.exitCode = code === null ? 1 : code;
});

process.once('exit', removePidFile);

const forwardSignal = signal => {
    if (!child.killed) {
        child.kill(signal);
    }
};

process.once('SIGINT', () => forwardSignal('SIGINT'));
process.once('SIGTERM', () => forwardSignal('SIGTERM'));
