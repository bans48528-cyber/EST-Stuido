#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {spawn} = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const distDirectory = path.join(projectRoot, 'dist');
const logFile = path.join(distDirectory, 'openblock-dev.log');
const pidFile = path.join(distDirectory, 'openblock-dev.pid');

const getRunningPid = () => {
    try {
        const pid = Number.parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
        if (!Number.isInteger(pid) || pid <= 0) return null;
        process.kill(pid, 0);
        return pid;
    } catch (error) {
        return null;
    }
};

const runningPid = getRunningPid();
if (runningPid) {
    console.log(`EST Studio is already running (PID ${runningPid}).`);
    process.exit(0);
}

fs.mkdirSync(distDirectory, {recursive: true});
try {
    fs.unlinkSync(pidFile);
} catch (error) {
    if (error.code !== 'ENOENT') throw error;
}

const logDescriptor = fs.openSync(logFile, 'w');
const child = spawn(process.execPath, [path.join(__dirname, 'start-openblock.js')], {
    cwd: projectRoot,
    detached: true,
    env: {
        ...process.env,
        OPENBLOCK_PID_FILE: pidFile
    },
    stdio: ['ignore', logDescriptor, logDescriptor],
    windowsHide: true
});

child.once('error', error => {
    fs.closeSync(logDescriptor);
    console.error('Failed to launch EST Studio:', error);
    process.exitCode = 1;
});

child.once('spawn', () => {
    fs.writeFileSync(pidFile, `${child.pid}\n`, 'utf8');
    fs.closeSync(logDescriptor);
    child.unref();
    console.log(`EST Studio started in background (PID ${child.pid}).`);
    console.log(`Development log: ${logFile}`);
});
