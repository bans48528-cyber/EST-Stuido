import {spawn} from 'child_process';
import fs from 'fs-extra';
import path from 'path';

import {
    compareEstFirmwareVersions,
    parseEstFirmwareVersion
} from './protocol';

export const EST_FIRMWARE_UPDATE_TARGETS = Object.freeze({
    LATEST_OS: 'latest-os',
    LEGACY_EST: 'legacy-est'
});

const OUTPUT_TAIL_LIMIT = 12000;

const uniqueExistingDirectories = directories => {
    const seen = new Set();
    return directories
        .filter(Boolean)
        .map(directory => path.resolve(directory))
        .filter(directory => {
            if (seen.has(directory) || !fs.existsSync(directory)) return false;
            seen.add(directory);
            return true;
        });
};

export const getFirmwareRootCandidates = (projectRoot = process.cwd()) => uniqueExistingDirectories([
    process.env.EST_FIRMWARE_ROOT,
    path.resolve(projectRoot, '..', '..', 'EST重构'),
    path.resolve(projectRoot, '..', 'EST重构'),
    path.resolve(projectRoot, 'EST重构'),
    path.resolve(__dirname, '..', '..', '..', '..', 'EST重构'),
    path.resolve(__dirname, '..', '..', '..', '..', '..', 'EST重构')
]);

const readManifest = manifestPath => {
    const manifest = fs.readJsonSync(manifestPath);
    const version = String(manifest.version || '').trim();
    const packagePath = manifestPath.replace(/\.manifest\.json$/u, '.upgrade.bin');
    if (!version || !parseEstFirmwareVersion(version) || !fs.existsSync(packagePath)) {
        return null;
    }
    return {
        firmwareRoot: null,
        manifestPath,
        packagePath,
        sha256: String(manifest.sha256 || ''),
        targetVersion: version
    };
};

const collectReleaseManifests = firmwareRoot => {
    const releaseRoot = path.join(firmwareRoot, 'firmware', 'releases');
    if (!fs.existsSync(releaseRoot)) return [];
    return fs.readdirSync(releaseRoot, {withFileTypes: true})
        .filter(entry => entry.isDirectory())
        .flatMap(entry => {
            const directory = path.join(releaseRoot, entry.name);
            return fs.readdirSync(directory)
                .filter(name => /^est_minimal_upgrade_app_.*\.manifest\.json$/u.test(name))
                .map(name => path.join(directory, name));
        });
};

const collectBuildManifests = firmwareRoot => {
    const buildRoot = path.join(firmwareRoot, 'firmware', 'minimal_upgrade_app', 'build');
    const manifests = [];
    const visit = directory => {
        if (!fs.existsSync(directory)) return;
        for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
            const entryPath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                if (!['generated', 'obj', 'micropython'].includes(entry.name)) {
                    visit(entryPath);
                }
                continue;
            }
            if (entry.name === 'est_minimal_upgrade_app.manifest.json') {
                manifests.push(entryPath);
            }
        }
    };
    visit(buildRoot);
    return manifests;
};

const compareCandidatePackages = (left, right) => {
    const comparison = compareEstFirmwareVersions(left.targetVersion, right.targetVersion);
    if (comparison !== null && comparison !== 0) return comparison;
    const leftTime = fs.statSync(left.manifestPath).mtimeMs;
    const rightTime = fs.statSync(right.manifestPath).mtimeMs;
    return leftTime - rightTime;
};

export const resolveLatestEstOsPackage = (firmwareRoots = getFirmwareRootCandidates()) => {
    let best = null;
    for (const firmwareRoot of firmwareRoots) {
        const manifests = [
            ...collectReleaseManifests(firmwareRoot),
            ...collectBuildManifests(firmwareRoot)
        ];
        for (const manifestPath of manifests) {
            const candidate = readManifest(manifestPath);
            if (!candidate) continue;
            candidate.firmwareRoot = firmwareRoot;
            if (!best || compareCandidatePackages(candidate, best) > 0) {
                best = candidate;
            }
        }
    }
    if (!best) {
        throw new Error('未找到可用的 EST OS 升级包。请检查 EST_FIRMWARE_ROOT 或固件仓库路径。');
    }
    return best;
};

export const resolveLegacyEstPackage = (firmwareRoots = getFirmwareRootCandidates()) => {
    for (const firmwareRoot of firmwareRoots) {
        const manifestPath = path.join(
            firmwareRoot,
            'firmware',
            'official_est3_app',
            'build',
            'EST_Main_V3_official.manifest.json'
        );
        const packagePath = manifestPath.replace(/\.manifest\.json$/u, '.upgrade.bin');
        if (!fs.existsSync(manifestPath) || !fs.existsSync(packagePath)) continue;
        const manifest = fs.readJsonSync(manifestPath);
        return {
            firmwareRoot,
            manifestPath,
            packagePath,
            sha256: String(manifest.sha256 || ''),
            targetVersion: String(manifest.version || '').trim() || '03.02A'
        };
    }
    throw new Error('未找到旧 EST 系统升级包。请检查 EST_FIRMWARE_ROOT 或固件仓库路径。');
};

export const resolveFirmwareUpdatePackage = (target, options = {}) => {
    const firmwareRoots = options.firmwareRoot ?
        uniqueExistingDirectories([options.firmwareRoot]) :
        getFirmwareRootCandidates(options.projectRoot);
    if (target === EST_FIRMWARE_UPDATE_TARGETS.LATEST_OS) {
        return resolveLatestEstOsPackage(firmwareRoots);
    }
    if (target === EST_FIRMWARE_UPDATE_TARGETS.LEGACY_EST) {
        return resolveLegacyEstPackage(firmwareRoots);
    }
    throw new Error(`未知固件更新目标：${target}`);
};

const appendTail = (existing, chunk) => {
    const next = `${existing}${chunk}`;
    return next.length > OUTPUT_TAIL_LIMIT ? next.slice(next.length - OUTPUT_TAIL_LIMIT) : next;
};

const getPythonCandidates = () => {
    if (process.env.PYTHON) {
        return [{command: process.env.PYTHON, args: []}];
    }
    return process.platform === 'win32' ?
        [
            {command: 'python', args: []},
            {command: 'py', args: ['-3']},
            {command: 'python3', args: []}
        ] :
        [
            {command: 'python3', args: []},
            {command: 'python', args: []}
        ];
};

const firmwareUpdateRequiresForce = target => (
    target === EST_FIRMWARE_UPDATE_TARGETS.LATEST_OS ||
    target === EST_FIRMWARE_UPDATE_TARGETS.LEGACY_EST
);

export const buildFlashCommandArgs = (candidate, packageInfo, target) => {
    const scriptPath = path.join(
        packageInfo.firmwareRoot,
        'tools',
        'est_hid_sender',
        'est_hid_sender.py'
    );
    const args = [
        ...candidate.args,
        scriptPath,
        'flash',
        '--file',
        packageInfo.packagePath,
        '--manifest',
        packageInfo.manifestPath
    ];
    if (firmwareUpdateRequiresForce(target)) {
        args.push('--force');
    }
    return args;
};

const runPythonUpdater = (packageInfo, target) => new Promise((resolve, reject) => {
    const scriptPath = path.join(
        packageInfo.firmwareRoot,
        'tools',
        'est_hid_sender',
        'est_hid_sender.py'
    );
    if (!fs.existsSync(scriptPath)) {
        reject(new Error(`未找到 EST HID 升级工具：${scriptPath}`));
        return;
    }
    const candidates = getPythonCandidates();
    const tryCandidate = index => {
        if (index >= candidates.length) {
            reject(new Error('未找到可用的 Python。请确认 python 或 py -3 可在命令行运行。'));
            return;
        }
        const candidate = candidates[index];
        const args = buildFlashCommandArgs(candidate, packageInfo, target);
        const child = spawn(candidate.command, args, {
            cwd: packageInfo.firmwareRoot,
            env: {
                ...process.env,
                PYTHONIOENCODING: 'utf-8'
            },
            windowsHide: true
        });
        let stdout = '';
        let stderr = '';
        let spawnFailed = false;
        child.stdout.on('data', data => {
            stdout = appendTail(stdout, data.toString('utf8'));
        });
        child.stderr.on('data', data => {
            stderr = appendTail(stderr, data.toString('utf8'));
        });
        child.on('error', error => {
            spawnFailed = true;
            if (error && error.code === 'ENOENT') {
                tryCandidate(index + 1);
                return;
            }
            reject(error);
        });
        child.on('close', code => {
            if (spawnFailed) return;
            if (code === 0) {
                resolve({
                    command: candidate.command,
                    stderr: stderr.trim(),
                    stdout: stdout.trim()
                });
                return;
            }
            const output = (stderr || stdout).trim();
            reject(new Error(output || `固件更新失败，升级工具退出码 ${code}`));
        });
    };
    tryCandidate(0);
});

export const flashEstFirmware = async (request = {}) => {
    const target = request && request.target;
    const packageInfo = resolveFirmwareUpdatePackage(target);
    const toolResult = await runPythonUpdater(packageInfo, target);
    return {
        ...packageInfo,
        ...toolResult,
        target
    };
};
