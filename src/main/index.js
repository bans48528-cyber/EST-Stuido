import {BrowserWindow, Menu, app, dialog, ipcMain, nativeImage, net, safeStorage, shell, systemPreferences} from 'electron';
import * as remote from '@electron/remote/main';
import fs from 'fs-extra';
import path from 'path';
import {createHash} from 'crypto';
import {URL} from 'url';
import {promisify} from 'util';

import argv from './argv';
import {InputCompatibility} from './input-compatibility';
import inputCompatibilityMessages from '../common/input-compatibility-messages.json';
import {getFilterForExtension} from './FileFilters';
import Updater from './OpenblockDesktopUpdater';
import MacOSMenu from './MacOSMenu';
import log from '../common/log.js';
import appIconIco from '../icon/OpenBlockDesktop.ico';
import appIconPng from '../icon/OpenBlockDesktop.png';
import {productName, version} from '../../package.json';
import {EstDeviceService} from './est/device-service';
import {registerEstAiIpc} from './est/ai-service';
import {createEstAiKeyStore, getEstAiSettingsPath} from './est/ai-key-store';
import {
    EST_BUILD_LIBRARY_REMOTE_SUMMARY,
    EstBuildLibraryCancelledError,
    EstBuildLibraryOperation,
    EstBuildLibraryService
} from './est/build-library-service';
import {flashEstFirmware} from './est/firmware-update-service';
import {createNodeHidEstTransportFactory} from './est/transports/node-hid';
import {EstVisionSimulator} from './est/vision-simulator';
import {VisionCameraSource} from './est/vision-camera-source';
import {VisionWindowManager} from './est/vision-window';
import {HardwareSession} from './hardware/session';
import {HardwareDraftStore} from './hardware/drafts';
import {HardwareSelectionPreferences} from './hardware/selection-preferences';
import {readProjectFileHardware} from './hardware/project-info';
import {HomeRecentProjects} from './home/recent-projects';
import {getHomeContent, requireHomeBuildLibrary} from '../common/home-content';
import {SparkDeviceService} from './spark-ai/device-service';
import {SparkBleBridge} from './spark-ai/ble-bridge';
import {SparkConnectionPreferences} from './spark-ai/connection-preferences';
import {SparkFirmwareUpdateService} from './spark-ai/firmware-update-service';
import {NewAiDeviceService} from './new-ai/device-service';
import {NewAiBleBridge} from './new-ai/ble-bridge';
import {NewAiConnectionPreferences} from './new-ai/connection-preferences';
import {NewAiFirmwareUpdateService} from './new-ai/firmware-update-service';
import {NewAiPeripheralUpdateService} from './new-ai/peripheral-update-service';

import formatMessage from 'format-message';
import openBlockDesktopLocales from 'openblock-l10n/locales/desktop-msgs';
import estDesktopMessageOverrides from './est-desktop-message-overrides.json';

app.setName(productName);

// Keep existing connection preferences and the Windows input compatibility fix after the rename.
const inputCompatibility = new InputCompatibility({
    filename: path.join(app.getPath('appData'), 'EST Studio', 'input-compatibility.json'),
    commandLine: app.commandLine
});

const estDeviceService = new EstDeviceService({
    transportFactory: createNodeHidEstTransportFactory()
});
const estVisionSimulator = new EstVisionSimulator(estDeviceService);
const sparkBleBridge = new SparkBleBridge({allowed: () => !hardwareSession.switching &&
    hardwareSession.hardwareId === 'spark-ai' && sparkDeviceService.connectionMode === 'ble'});
const sparkDeviceService = new SparkDeviceService({
    createBleTransport: id => sparkBleBridge.createTransport(id),
    reconnectBleDevice: identity => sparkBleBridge.reconnectDevice(identity),
    getBleIdentity: id => sparkBleBridge.getIdentity(id),
    isBleReady: () => sparkBleBridge.ready,
    preferences: new SparkConnectionPreferences(path.join(app.getPath('appData'), 'EST Studio',
        'hardware', 'spark-connection.json'))
});
const sparkFirmwareUpdateService = new SparkFirmwareUpdateService({device: sparkDeviceService});
const newAiBleBridge = new NewAiBleBridge({allowed: () => false});
const newAiDeviceService = new NewAiDeviceService({
    createBleTransport: id => newAiBleBridge.createTransport(id),
    reconnectBleDevice: identity => newAiBleBridge.reconnectDevice(identity),
    getBleIdentity: id => newAiBleBridge.getIdentity(id),
    isBleReady: () => newAiBleBridge.ready,
    preferences: new NewAiConnectionPreferences(path.join(app.getPath('appData'), 'EST Studio',
        'hardware', 'new-connection.json'))
});
const newAiFirmwareUpdateService = new NewAiFirmwareUpdateService({device: newAiDeviceService});
const newAiPeripheralUpdateService = new NewAiPeripheralUpdateService({device: newAiDeviceService});
sparkDeviceService.on('cancel-ble-scan', () => sparkBleBridge.cancelScan());
newAiDeviceService.on('cancel-ble-scan', () => newAiBleBridge.cancelScan());
const estVisionCamera = new VisionCameraSource(estDeviceService, estVisionSimulator);
const estStudioAppId = 'com.atc.codestudio';
const estFirmwareUpdateState = {
    inProgress: false
};
const hardwareSession = new HardwareSession({
    service: estDeviceService,
    preferences: new HardwareSelectionPreferences(path.join(app.getPath('appData'), 'EST Studio',
        'hardware', 'selection.json')),
    adapters: {'spark-usb': sparkDeviceService, 'new-usb': newAiDeviceService},
    stopSources: () => {
        estVisionCamera.stop();
        estVisionSimulator.stop({clear: false});
        estVisionWindow.close(); // eslint-disable-line no-use-before-define
    },
    isFirmwareBusy: () => estFirmwareUpdateState.inProgress || sparkFirmwareUpdateService.busy ||
        newAiFirmwareUpdateService.busy || newAiPeripheralUpdateService.busy
});
let hardwareDrafts;
// The bridge only becomes available after both the service and hardware session exist.
newAiBleBridge.allowed = () => !hardwareSession.switching && hardwareSession.hardwareId === 'new-ai' &&
    newAiDeviceService.connectionMode === 'ble';
const getHardwareDrafts = () => {
    if (!hardwareDrafts) hardwareDrafts = new HardwareDraftStore(path.join(app.getPath('userData'), 'hardware-drafts'));
    return hardwareDrafts;
};
const EST_RECENT_PROJECTS_FILE = 'est-recent-projects.json';
const homeHardwarePreferences = new HardwareSelectionPreferences(
    path.join(app.getPath('appData'), 'EST Studio', 'hardware', 'selection.json'), 'homeHardwareId');
const EST_PROJECT_THUMBNAILS_DIRECTORY = 'est-home-thumbnails';
const EST_PROJECT_THUMBNAIL_WIDTH = 480;
const EST_BUILD_LIBRARY_CACHE_DIRECTORY = 'est-build-library';
const EST_HOME_BUILD_ITEM_IDS = getHomeContent('est').bundledBuildIds;
const EST_BUILD_LIBRARY_ALLOWED_HOSTS = [
    'github.com'
];
const EST_BUILD_LIBRARY_ALLOWED_HOST_SUFFIXES = [
    '.githubusercontent.com'
];
const EST_BUILD_LIBRARY_MAX_REDIRECTS = 8;
let estBuildLibraryService = null;
let estBuildLibraryInstallPromise = null;
let estBuildLibraryInstallHardwareId = null;
let estBuildLibraryInstallOperation = null;
let estBuildLibraryLastProgress = null;
let estBuildLibraryProgressPublisher = null;

const estDesktopLocales = Object.keys(estDesktopMessageOverrides).reduce((messages, locale) => {
    const baseMessages = messages[locale] || messages.en || {};
    messages[locale] = Object.assign({}, baseMessages, estDesktopMessageOverrides[locale]);
    return messages;
}, Object.assign({}, openBlockDesktopLocales));

formatMessage.setup({translations: estDesktopLocales});

// suppress deprecation warning; this will be the default in Electron 9
app.allowRendererProcessReuse = true;

if (process.platform === 'win32') {
    app.setAppUserModelId(estStudioAppId);
}

// allow connect to localhost
app.commandLine.appendSwitch('allow-insecure-localhost', 'true');

// enable gpu and ignore gpu blacklist
app.commandLine.hasSwitch('enable-gpu');
app.commandLine.hasSwitch('ignore-gpu-blacklist');

const defaultSize = {width: 1620, height: 900};

const isDevelopment = process.env.NODE_ENV !== 'production';

const getRecentProjectsPath = () => path.join(app.getPath('userData'), EST_RECENT_PROJECTS_FILE);

const normalizeProjectPath = projectPath => path.resolve(String(projectPath || ''));

const projectPathKey = projectPath => {
    const normalized = normalizeProjectPath(projectPath);
    return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
};

const getProjectThumbnailPath = projectPath => {
    const thumbnailKey = createHash('sha256')
        .update(projectPathKey(projectPath))
        .digest('hex');
    return path.join(
        app.getPath('userData'),
        EST_PROJECT_THUMBNAILS_DIRECTORY,
        `${thumbnailKey}.png`
    );
};

const readProjectThumbnail = async projectPath => {
    try {
        const thumbnail = await fs.readFile(getProjectThumbnailPath(projectPath));
        return `data:image/png;base64,${thumbnail.toString('base64')}`;
    } catch (error) {
        return null;
    }
};

const moveProjectThumbnail = async (sourcePath, destinationPath, copy = false) => {
    try {
        const sourceThumbnailPath = getProjectThumbnailPath(sourcePath);
        if (!await fs.pathExists(sourceThumbnailPath)) return;
        const destinationThumbnailPath = getProjectThumbnailPath(destinationPath);
        if (copy) {
            await fs.copy(sourceThumbnailPath, destinationThumbnailPath, {overwrite: true});
            return;
        }
        await fs.move(sourceThumbnailPath, destinationThumbnailPath, {overwrite: true});
    } catch (error) {
        log.warn(`Unable to transfer EST project thumbnail: ${error.message}`);
    }
};

const captureProjectThumbnail = async (webContents, projectPath) => {
    try {
        const normalizedPath = normalizeProjectPath(projectPath);
        if (!webContents || webContents.isDestroyed() ||
            path.extname(normalizedPath).toLowerCase() !== '.atc' ||
            !await fs.pathExists(normalizedPath)) {
            return null;
        }

        await new Promise(resolve => setTimeout(resolve, 240));
        const captureBounds = await webContents.executeJavaScript(`(() => {
            const menuBar = document.querySelector('[class*="menu-bar_menu-bar_"]');
            const top = menuBar ? Math.ceil(menuBar.getBoundingClientRect().bottom) : 0;
            return {
                x: 0,
                y: Math.max(0, top),
                width: Math.max(1, Math.floor(window.innerWidth)),
                height: Math.max(1, Math.floor(window.innerHeight - top))
            };
        })()`, true);
        const screenshot = await webContents.capturePage(captureBounds);
        if (screenshot.isEmpty()) return null;
        const thumbnail = screenshot.resize({
            width: EST_PROJECT_THUMBNAIL_WIDTH,
            quality: 'good'
        });
        await fs.outputFile(getProjectThumbnailPath(normalizedPath), thumbnail.toPNG());
        return readProjectThumbnail(normalizedPath);
    } catch (error) {
        log.warn(`Unable to capture EST project thumbnail: ${error.message}`);
        return null;
    }
};

const readRecentProjectPaths = async () => {
    try {
        const stored = await fs.readJson(getRecentProjectsPath());
        return Array.isArray(stored) ? stored.filter(value => typeof value === 'string') : [];
    } catch (error) {
        return [];
    }
};

const writeRecentProjectPaths = paths => fs.outputJson(getRecentProjectsPath(), paths, {spaces: 2});

const getRecentProjectInfo = async projectPath => {
    const normalizedPath = normalizeProjectPath(projectPath);
    if (path.extname(normalizedPath).toLowerCase() !== '.atc') return null;
    try {
        const stats = await fs.stat(normalizedPath);
        if (!stats.isFile()) return null;
        const hardware = await readProjectFileHardware(normalizedPath);
        return {
            hardwareId: hardware ? hardware.id : null,
            hardwareName: hardware ? hardware.name : null,
            modifiedAt: stats.mtime.toISOString(),
            name: path.basename(normalizedPath, path.extname(normalizedPath)),
            path: normalizedPath,
            thumbnail: await readProjectThumbnail(normalizedPath)
        };
    } catch (error) {
        return null;
    }
};

const recentProjects = new HomeRecentProjects({
    readPaths: readRecentProjectPaths,
    writePaths: writeRecentProjectPaths,
    readInfo: getRecentProjectInfo,
    pathKey: projectPathKey
});

const rememberRecentProject = async projectPath => {
    const project = await recentProjects.remember(projectPath);
    if (project && app.isReady()) app.addRecentDocument(project.path);
    return project;
};
const listRecentProjects = () => recentProjects.list();
const removeRecentProject = async (projectPath, removeThumbnail = true) => {
    await recentProjects.remove(projectPath);
    if (removeThumbnail) await fs.remove(getProjectThumbnailPath(projectPath));
};

const validateProjectName = value => {
    const projectName = String(value || '')
        .trim()
        .replace(/\.atc$/i, '');
    if (!projectName || /[\\/:*?"<>|\0]/.test(projectName) || /[. ]$/.test(projectName)) {
        throw new Error('请输入有效的文件名。');
    }
    return projectName;
};

const openProjectForHome = async projectPath => {
    const project = await getRecentProjectInfo(projectPath);
    if (!project) throw new Error('项目文件不存在或无法读取。');
    const data = await fs.readFile(project.path);
    await rememberRecentProject(project.path);
    return {
        data,
        path: project.path,
        title: project.name
    };
};

const renameHomeProject = async request => {
    const sourcePath = normalizeProjectPath(request && request.path);
    const projectName = validateProjectName(request && request.name);
    const destinationPath = path.join(path.dirname(sourcePath), `${projectName}.atc`);
    if (projectPathKey(sourcePath) !== projectPathKey(destinationPath) && await fs.pathExists(destinationPath)) {
        throw new Error('同名项目已存在。');
    }
    if (sourcePath !== destinationPath) {
        await fs.move(sourcePath, destinationPath);
        await moveProjectThumbnail(sourcePath, destinationPath);
    }
    await removeRecentProject(sourcePath, false);
    return rememberRecentProject(destinationPath);
};

const copyHomeProject = async projectPath => {
    const sourcePath = normalizeProjectPath(projectPath);
    const sourceInfo = await getRecentProjectInfo(sourcePath);
    if (!sourceInfo) throw new Error('项目文件不存在或无法读取。');
    const directory = path.dirname(sourcePath);
    let suffix = ' - 副本';
    let destinationPath = path.join(directory, `${sourceInfo.name}${suffix}.atc`);
    let copyIndex = 2;
    while (await fs.pathExists(destinationPath)) {
        suffix = ` - 副本 ${copyIndex}`;
        destinationPath = path.join(directory, `${sourceInfo.name}${suffix}.atc`);
        copyIndex += 1;
    }
    await fs.copy(sourcePath, destinationPath, {overwrite: false});
    await moveProjectThumbnail(sourcePath, destinationPath, true);
    return rememberRecentProject(destinationPath);
};

const resolveBundledAssetPath = assetPath => {
    if (typeof assetPath !== 'string' || !assetPath || assetPath.startsWith('data:')) {
        return assetPath;
    }
    if (path.isAbsolute(assetPath)) {
        return fs.existsSync(assetPath) ? assetPath : null;
    }

    const candidates = [
        path.resolve(__dirname, assetPath),
        path.resolve(process.cwd(), assetPath),
        path.resolve(process.cwd(), 'dist', 'main', assetPath)
    ];
    if (typeof app.getAppPath === 'function') {
        const appPath = app.getAppPath();
        candidates.push(
            path.resolve(appPath, assetPath),
            path.resolve(appPath, 'dist', 'main', assetPath)
        );
    }
    if (process.resourcesPath) {
        candidates.push(
            path.resolve(process.resourcesPath, 'app.asar', assetPath),
            path.resolve(process.resourcesPath, 'app.asar', 'dist', 'main', assetPath),
            path.resolve(process.resourcesPath, 'app', assetPath),
            path.resolve(process.resourcesPath, 'app', 'dist', 'main', assetPath)
        );
    }
    return candidates.find(candidate => fs.existsSync(candidate)) || null;
};

const resolveHomeBuildAssetPath = (directory, itemId, extension) => {
    if (!EST_HOME_BUILD_ITEM_IDS.includes(itemId)) return null;
    const assetSegments = [directory, `${itemId}.${extension}`];
    const developmentPath = resolveBundledAssetPath(path.join(
        'resources',
        'est-build-library',
        ...assetSegments
    ));
    if (developmentPath) return developmentPath;
    if (!process.resourcesPath) return null;
    const packagedPath = path.resolve(process.resourcesPath, 'est-build-library', ...assetSegments);
    return fs.existsSync(packagedPath) ? packagedPath : null;
};

const getHomeBuildThumbnails = async request => {
    if (!getHomeContent(request && request.hardwareId).downloadableBuildLibrary) return {};
    const thumbnails = {};
    await Promise.all(EST_HOME_BUILD_ITEM_IDS.map(async itemId => {
        const thumbnailPath = resolveHomeBuildAssetPath('thumbnails', itemId, 'jpg');
        if (!thumbnailPath) return;
        const thumbnail = await fs.readFile(thumbnailPath);
        thumbnails[itemId] = `data:image/jpeg;base64,${thumbnail.toString('base64')}`;
    }));
    return thumbnails;
};

const isTrustedBuildLibraryUrl = sourceUrl => {
    try {
        const parsedUrl = new URL(sourceUrl);
        const hostname = parsedUrl.hostname.toLowerCase();
        return parsedUrl.protocol === 'https:' && (
            EST_BUILD_LIBRARY_ALLOWED_HOSTS.includes(hostname) ||
            EST_BUILD_LIBRARY_ALLOWED_HOST_SUFFIXES.some(suffix => hostname.endsWith(suffix))
        );
    } catch (error) {
        return false;
    }
};

const getResponseHeader = (headers, name) => {
    const header = headers[name.toLowerCase()];
    return Array.isArray(header) ? header[0] : header;
};

const downloadHomeBuildFile = async (sourceUrl, destinationPath, options = {}) => {
    if (!isTrustedBuildLibraryUrl(sourceUrl)) {
        throw new Error('Build library download URL is not trusted.');
    }
    await fs.ensureDir(path.dirname(destinationPath));
    await fs.remove(destinationPath);

    return new Promise((resolve, reject) => {
        let receivedBytes = 0;
        let redirectCount = 0;
        let responseStream = null;
        let outputStream = null;
        let request = null;
        let settled = false;
        let unsubscribeOperation = null;

        const finishWithError = error => {
            if (settled) return;
            settled = true;
            if (unsubscribeOperation) unsubscribeOperation();
            if (responseStream && typeof responseStream.destroy === 'function') responseStream.destroy();
            if (request && typeof request.abort === 'function') request.abort();
            const removePartialFile = () => fs.remove(destinationPath)
                .catch(() => {})
                .then(() => reject(error));
            if (outputStream) {
                outputStream.once('close', removePartialFile);
                outputStream.destroy();
            } else {
                removePartialFile();
            }
        };

        if (options.operation) {
            unsubscribeOperation = options.operation.subscribe(state => {
                if (state.cancelled) {
                    finishWithError(new EstBuildLibraryCancelledError());
                } else if (responseStream) {
                    if (state.paused) responseStream.pause();
                    else responseStream.resume();
                }
            });
        }
        if (settled) return;

        request = net.request({
            method: 'GET',
            redirect: 'manual',
            url: sourceUrl
        });

        request.on('redirect', (statusCode, method, redirectUrl) => {
            redirectCount += 1;
            if (redirectCount > EST_BUILD_LIBRARY_MAX_REDIRECTS || !isTrustedBuildLibraryUrl(redirectUrl)) {
                finishWithError(new Error('Build library download redirect is not trusted.'));
                return;
            }
            request.followRedirect();
        });

        request.on('response', response => {
            responseStream = response;
            if (options.operation && options.operation.snapshot().paused) response.pause();
            if (response.statusCode < 200 || response.statusCode >= 300) {
                finishWithError(new Error(`Build library download failed with HTTP ${response.statusCode}.`));
                return;
            }

            const contentLengthHeader = getResponseHeader(response.headers, 'content-length');
            const contentLength = Number(contentLengthHeader);
            if (Number.isFinite(contentLength)) {
                if (options.maximumBytes && contentLength > options.maximumBytes) {
                    finishWithError(new Error('Build library download is too large.'));
                    return;
                }
                if (options.expectedBytes && contentLength !== options.expectedBytes) {
                    finishWithError(new Error('Build library download size does not match its manifest.'));
                    return;
                }
            }

            outputStream = fs.createWriteStream(destinationPath, {flags: 'wx'});
            outputStream.on('error', finishWithError);
            outputStream.on('finish', () => {
                if (settled) return;
                if (options.expectedBytes && receivedBytes !== options.expectedBytes) {
                    finishWithError(new Error('Build library download was incomplete.'));
                    return;
                }
                settled = true;
                if (unsubscribeOperation) unsubscribeOperation();
                resolve({receivedBytes});
            });

            response.on('data', chunk => {
                if (settled) return;
                receivedBytes += chunk.length;
                if (options.maximumBytes && receivedBytes > options.maximumBytes) {
                    finishWithError(new Error('Build library download is too large.'));
                    return;
                }
                if (!outputStream.write(chunk)) {
                    response.pause();
                    outputStream.once('drain', () => {
                        if (!options.operation || !options.operation.snapshot().paused) response.resume();
                    });
                }
                if (typeof options.onProgress === 'function') {
                    const totalBytes = options.expectedBytes || (Number.isFinite(contentLength) ? contentLength : null);
                    options.onProgress({
                        percent: totalBytes ? Math.min(100, Math.round(receivedBytes * 100 / totalBytes)) : 0,
                        receivedBytes,
                        totalBytes
                    });
                }
            });
            response.on('aborted', () => finishWithError(new Error('Build library download was interrupted.')));
            response.on('error', finishWithError);
            response.on('end', () => {
                if (!settled && outputStream) outputStream.end();
            });
        });
        request.on('error', finishWithError);
        request.end();
    });
};

const getEstBuildLibraryService = () => {
    if (!estBuildLibraryService) {
        estBuildLibraryService = new EstBuildLibraryService({
            cacheRoot: path.join(app.getPath('userData'), EST_BUILD_LIBRARY_CACHE_DIRECTORY),
            downloadFile: downloadHomeBuildFile
        });
    }
    return estBuildLibraryService;
};

const readBuildLibraryThumbnails = async items => {
    const thumbnails = {};
    await Promise.all(items.map(async item => {
        const thumbnail = await fs.readFile(item.thumbnailPath);
        thumbnails[item.id] = `data:image/jpeg;base64,${thumbnail.toString('base64')}`;
    }));
    return thumbnails;
};

const serializeInstalledBuildLibrary = async installed => ({
    hardwareId: 'est',
    archiveBytes: EST_BUILD_LIBRARY_REMOTE_SUMMARY.archiveBytes,
    contentVersion: installed.contentVersion,
    installed: true,
    itemCount: installed.catalog.itemCount,
    items: installed.catalog.items.map(item => ({
        category: item.category,
        id: item.id,
        pages: item.pages,
        title: item.title
    })),
    thumbnails: await readBuildLibraryThumbnails(installed.catalog.items),
    totalItemCount: EST_BUILD_LIBRARY_REMOTE_SUMMARY.itemCount
});

const getHomeBuildLibraryState = async request => {
    const hardwareId = request && request.hardwareId;
    if (!getHomeContent(hardwareId).downloadableBuildLibrary) {
        return {hardwareId, installed: false, items: [], thumbnails: {}, totalItemCount: 0, downloadActive: false};
    }
    const installed = await getEstBuildLibraryService().getInstalledLibrary();
    const download = {
        hardwareId,
        downloadActive: Boolean(estBuildLibraryInstallPromise && estBuildLibraryInstallHardwareId === hardwareId),
        downloadProgress: estBuildLibraryInstallHardwareId === hardwareId ? estBuildLibraryLastProgress : null
    };
    if (installed) return {...await serializeInstalledBuildLibrary(installed), ...download};
    return {
        ...download,
        archiveBytes: EST_BUILD_LIBRARY_REMOTE_SUMMARY.archiveBytes,
        contentVersion: null,
        installed: false,
        itemCount: EST_HOME_BUILD_ITEM_IDS.length,
        items: null,
        thumbnails: await getHomeBuildThumbnails(request),
        totalItemCount: EST_BUILD_LIBRARY_REMOTE_SUMMARY.itemCount
    };
};

const openHomeBuildGuide = async request => {
    requireHomeBuildLibrary(request);
    const itemId = request && request.itemId;
    if (typeof itemId !== 'string') throw new Error('HOME_BUILD_UNAVAILABLE');
    const installed = await getEstBuildLibraryService().getInstalledLibrary();
    const installedItem = installed && installed.catalog.items.find(item => item.id === itemId);
    const guidePath = installedItem ?
        installedItem.guidePath :
        resolveHomeBuildAssetPath('guides', itemId, 'pdf');
    if (!guidePath) throw new Error('Build guide is unavailable.');
    const openError = await shell.openPath(guidePath);
    if (openError) throw new Error(openError);
    return true;
};

const createWindowIcon = assetPath => {
    const iconPath = resolveBundledAssetPath(assetPath);
    if (typeof iconPath !== 'string') {
        return undefined;
    }
    const icon = iconPath.startsWith('data:') ?
        nativeImage.createFromDataURL(iconPath) :
        nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
        log.warn(`Unable to load ATC CodeStudio window icon from ${iconPath}`);
        return undefined;
    }
    return icon;
};

const getWindowIcon = () => createWindowIcon(process.platform === 'win32' ? appIconIco : appIconPng);

const devToolKey = ((process.platform === 'darwin') ?
    { // macOS: command+option+i
        alt: true, // option
        control: false,
        meta: true, // command
        shift: false,
        code: 'KeyI'
    } : { // Windows: control+shift+i
        alt: false,
        control: true,
        meta: false, // Windows key
        shift: true,
        code: 'KeyI'
    }
);

// global window references prevent them from being garbage-collected
const _windows = {};

ipcMain.handle('est-input-compatibility-get', event => {
    if (!_windows.main || event.sender !== _windows.main.webContents) throw new Error('Invalid settings window');
    return inputCompatibility.getStatus();
});
ipcMain.handle('est-input-compatibility-set', async (event, request) => {
    if (!_windows.main || event.sender !== _windows.main.webContents) throw new Error('Invalid settings window');
    const status = await inputCompatibility.setEnabled(request && request.enabled);
    if (request.notify === true) {
        const copy = inputCompatibilityMessages[request.locale] || inputCompatibilityMessages.en;
        await dialog.showMessageBox(_windows.main, {
            type: 'info',
            title: copy.label,
            message: copy.saved,
            detail: copy.hint,
            buttons: [copy.ok]
        });
    }
    return status;
});

const displayPermissionDeniedWarning = (browserWindow, permissionType) => {
    if (permissionType === 'camera' && estVisionWindow.owns(browserWindow.webContents)) {
        dialog.showMessageBox(browserWindow, {
            type: 'warning',
            title: estVisionWindow.text('camera.permission.title'),
            message: estVisionWindow.text('camera.error.denied'),
            buttons: [estVisionWindow.text('camera.permission.ok')]
        });
        return;
    }
    let title;
    let message;
    switch (permissionType) {
    case 'camera':
        title = formatMessage({
            id: 'index.cameraPermissionDeniedTitle',
            default: 'Camera Permission Denied',
            description: 'prompt for camera permission denied'
        });
        message = formatMessage({
            id: 'index.cameraPermissionDeniedMessage',
            default: 'Permission to use the camera has been denied. ' +
                'ATC CodeStudio will not be able to take a photo or use video sensing blocks.',
            description: 'message for camera permission denied'
        });
        break;
    case 'microphone':
        title = formatMessage({
            id: 'index.microphonePermissionDeniedTitle',
            default: 'Microphone Permission Denied',
            description: 'prompt for microphone permission denied'
        });
        message = formatMessage({
            id: 'index.microphonePermissionDeniedMessage',
            default: 'Permission to use the microphone has been denied. ' +
                    'ATC CodeStudio will not be able to record sounds or detect loudness.',
            description: 'message for microphone permission denied'
        });
        break;
    default: // shouldn't ever happen...
        title = formatMessage({
            id: 'index.permissionDeniedTitle',
            default: 'Permission Denied',
            description: 'prompt for permission denied'
        });
        message = formatMessage({
            id: 'index.permissionDeniedMessage',
            default: 'A permission has been denied.',
            description: 'message for permission denied'
        });
    }

    let instructions;
    switch (process.platform) {
    case 'darwin':
        instructions = formatMessage({
            id: 'index.darwinPermissionDeniedInstructions',
            default: 'To change ATC CodeStudio permissions, please check "Security & Privacy" in System Preferences.',
            description: 'prompt for fix darwin permission denied instructions'
        });
        break;
    default:
        instructions = formatMessage({
            id: 'index.permissionDeniedInstructions',
            default: 'To change ATC CodeStudio permissions, please check your system settings and restart ATC CodeStudio.',
            description: 'prompt for fix permission denied instructions'
        });
        break;
    }
    message = `${message}\n\n${instructions}`;

    dialog.showMessageBox(browserWindow, {type: 'warning', title, message});
};

/**
 * Build an absolute URL from a relative one, optionally adding search query parameters.
 * The base of the URL will depend on whether or not the application is running in development mode.
 * @param {string} url - the relative URL, like 'index.html'
 * @param {*} search - the optional "search" parameters (the part of the URL after '?'), like "route=about"
 * @returns {string} - an absolute URL as a string
 */
const makeFullUrl = (url, search = null) => {
    const baseUrl = (isDevelopment ?
        `http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}/` :
        `file://${__dirname}/`
    );
    const fullUrl = new URL(url, baseUrl);
    if (search) {
        fullUrl.search = search; // automatically percent-encodes anything that needs it
    }
    return fullUrl.toString();
};

/**
 * Prompt in a platform-specific way for permission to access the microphone or camera, if Electron supports doing so.
 * Any application-level checks, such as whether or not a particular frame or document should be allowed to ask,
 * should be done before calling this function.
 * This function may return a Promise!
 *
 * @param {string} mediaType - one of Electron's media types, like 'microphone' or 'camera'
 * @returns {boolean|Promise.<boolean>} - true if permission granted, false otherwise.
 */
const askForMediaAccess = mediaType => {
    if (systemPreferences.askForMediaAccess) {
        // Electron currently only implements this on macOS
        // This returns a Promise
        return systemPreferences.askForMediaAccess(mediaType);
    }
    // For other platforms we can't reasonably do anything other than assume we have access.
    return true;
};

const handlePermissionRequest = async (webContents, permission, callback, details) => {
    if ((!_windows.main || webContents !== _windows.main.webContents) && !estVisionWindow.owns(webContents)) {
        return callback(false);
    }
    if (!details.isMainFrame) {
        // deny: request came from a subframe of the main window, not the main frame
        return callback(false);
    }
    if (permission !== 'media') {
        // deny: request is for some other kind of access like notifications or pointerLock
        return callback(false);
    }
    const requiredBase = makeFullUrl('');
    if (details.requestingUrl.indexOf(requiredBase) !== 0) {
        // deny: request came from a URL outside of our "sandbox"
        return callback(false);
    }
    let askForMicrophone = false;
    let askForCamera = false;
    for (const mediaType of details.mediaTypes) {
        switch (mediaType) {
        case 'audio':
            askForMicrophone = true;
            break;
        case 'video':
            askForCamera = true;
            break;
        default:
            // deny: unhandled media type
            return callback(false);
        }
    }
    const parentWindow = BrowserWindow.fromWebContents(webContents);
    if (estVisionWindow.owns(webContents) && askForMicrophone) return callback(false);
    if (askForMicrophone) {
        const microphoneResult = await askForMediaAccess('microphone');
        if (!microphoneResult) {
            displayPermissionDeniedWarning(parentWindow, 'microphone');
            return callback(false);
        }
    }
    if (askForCamera) {
        const cameraResult = await askForMediaAccess('camera');
        if (!cameraResult) {
            displayPermissionDeniedWarning(parentWindow, 'camera');
            return callback(false);
        }
    }
    return callback(true);
};

const createWindow = ({search = null, url = 'index.html', ...browserWindowOptions}) => {
    const windowIcon = getWindowIcon();
    const window = new BrowserWindow({
        icon: windowIcon,
        useContentSize: true,
        show: false,
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true
        },
        ...browserWindowOptions
    });
    if (windowIcon && typeof window.setIcon === 'function') {
        window.setIcon(windowIcon);
    }
    const webContents = window.webContents;
    // Keep each native window's application/version or About title when the shared HTML loads.
    webContents.on('page-title-updated', event => event.preventDefault());
    window.on('close', event => {
        if (sparkFirmwareUpdateService.busy || newAiFirmwareUpdateService.busy ||
            newAiPeripheralUpdateService.busy) event.preventDefault();
    });

    // Keep renderer failures visible in the development terminal. This is
    // intentionally limited to diagnostics and does not alter the UI.
    webContents.on('console-message', (event, level, message, line, sourceId) => {
        if (level >= 2 && !message.includes('Electron Security Warning')) {
            console.error(`[renderer:${level}] ${message} (${sourceId}:${line})`);
        }
    });
    webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        console.error('RENDERER_DID_FAIL_LOAD', {
            errorCode,
            errorDescription,
            validatedURL,
            isMainFrame
        });
    });
    webContents.on('render-process-gone', (event, details) => {
        console.error('RENDERER_PROCESS_GONE', details);
    });

    webContents.session.setPermissionRequestHandler(handlePermissionRequest);

    webContents.on('before-input-event', (event, input) => {
        if (input.code === devToolKey.code &&
            input.alt === devToolKey.alt &&
            input.control === devToolKey.control &&
            input.meta === devToolKey.meta &&
            input.shift === devToolKey.shift &&
            input.type === 'keyDown' &&
            !input.isAutoRepeat &&
            !input.isComposing) {
            event.preventDefault();
            webContents.openDevTools({mode: 'detach', activate: true});
        }
    });

    webContents.on('new-window', (event, newWindowUrl) => {
        shell.openExternal(newWindowUrl);
        event.preventDefault();
    });

    const fullUrl = makeFullUrl(url, search);
    window.loadURL(fullUrl);
    window.once('ready-to-show', () => {
        webContents.send('ready-to-show');
    });

    return window;
};

const estVisionWindow = new VisionWindowManager({
    createWindow,
    stopSource: owner => estVisionCamera.stop(owner)
});

const createAboutWindow = () => {
    const window = createWindow({
        width: 400,
        height: 400,
        parent: _windows.main,
        search: 'route=about',
        title: `About ${productName}`
    });
    return window;
};

const createLicenseWindow = () => {
    const window = createWindow({
        width: _windows.main.width * 0.8,
        height: _windows.main.height * 0.8,
        parent: _windows.main,
        search: 'route=license',
        title: `${productName} License`
    });
    return window;
};

const createPrivacyWindow = () => {
    const window = createWindow({
        width: _windows.main.width * 0.8,
        height: _windows.main.height * 0.8,
        parent: _windows.main,
        search: 'route=privacy',
        title: `${productName} Privacy Policy`
    });
    return window;
};

const createLoadingWindow = () => {
    const window = createWindow({
        width: 800,
        height: 150,
        frame: false,
        resizable: false,
        transparent: true,
        hasShadow: false,
        search: 'route=loading',
        title: `Loading ${productName} ${version}`
    });

    window.once('ready-to-show', () => {
        window.show();
    });

    return window;
};

const getIsProjectSave = downloadItem => {
    switch (downloadItem.getMimeType()) {
    case 'application/x.atc.project':
        return path.extname(downloadItem.getFilename()).toLowerCase() === '.atc';
    }
    return false;
};

const createMainWindow = () => {
    const window = createWindow({
        width: defaultSize.width,
        height: defaultSize.height,
        title: `${productName} ${version}` // something like "Scratch 3.14"
    });
    const webContents = window.webContents;
    sparkBleBridge.attach(webContents);
    newAiBleBridge.attach(webContents);

    const update = new Updater(webContents);
    remote.initialize();
    remote.enable(webContents);

    webContents.session.on('will-download', (willDownloadEvent, downloadItem) => {
        const isProjectSave = getIsProjectSave(downloadItem);
        const itemPath = downloadItem.getFilename();
        const baseName = path.basename(itemPath);
        const extName = path.extname(baseName);
        const options = {
            defaultPath: baseName
        };
        if (extName) {
            const extNameNoDot = extName.replace(/^\./, '');
            options.filters = [getFilterForExtension(extNameNoDot)];
        }
        const selectedPath = dialog.showSaveDialogSync(window, options);
        const userChosenPath = selectedPath && isProjectSave && path.extname(selectedPath).toLowerCase() !== '.atc' ?
            `${selectedPath}.atc` : selectedPath;
        // this will be falsy if the user canceled the save
        if (userChosenPath) {
            const userBaseName = path.basename(userChosenPath);
            const tempPath = path.join(app.getPath('temp'), userBaseName);

            // WARNING: `setSavePath` on this item is only valid during the `will-download` event. Calling the async
            // version of `showSaveDialog` means the event will finish before we get here, so `setSavePath` will be
            // ignored. For that reason we need to call `showSaveDialogSync` above.
            downloadItem.setSavePath(tempPath);

            downloadItem.on('done', async (doneEvent, doneState) => {
                try {
                    if (doneState !== 'completed') {
                        // The download was canceled or interrupted. Delete the temporary file.
                        throw new Error(`save ${doneState}`); // "save cancelled" or "save interrupted"
                    }
                    await fs.move(tempPath, userChosenPath, {overwrite: true});
                    if (isProjectSave) {
                        const newProjectTitle = path.basename(userChosenPath, path.extname(userChosenPath));
                        webContents.send('setTitleFromSave', {title: newProjectTitle});
                        await rememberRecentProject(userChosenPath);
                        await captureProjectThumbnail(webContents, userChosenPath);
                    }
                } catch (e) {
                    // don't clean up until after the message box to allow troubleshooting / recovery
                    await dialog.showMessageBox(window, {
                        type: 'error',
                        title: formatMessage({
                            id: 'index.saveFailedTitle',
                            default: 'Failed to save project',
                            description: 'Title for save failed'
                        }),
                        message: `${formatMessage({
                            id: 'index.saveFailed',
                            default: 'Save failed:',
                            description: 'prompt for save failed'
                        })}\n${userChosenPath}`,
                        detail: e.message
                    });
                    fs.exists(tempPath).then(exists => {
                        if (exists) {
                            fs.unlink(tempPath);
                        }
                    });
                }
            });
        } else {
            downloadItem.cancel();
        }
    });

    webContents.on('will-prevent-unload', ev => {
        const choice = dialog.showMessageBoxSync(window, {
            title: productName,
            type: 'question',
            message: formatMessage({
                id: 'index.questionLeave',
                default: 'Leave ATC CodeStudio?',
                description: 'prompt for leaving ATC CodeStudio'
            }),
            detail: formatMessage({
                id: 'index.questionLeaveDetail',
                default: 'Any unsaved changes will be lost.',
                description: 'detail prompt for leaving ATC CodeStudio'
            }),
            buttons: [
                formatMessage({
                    id: 'index.stay',
                    default: 'Stay',
                    description: 'Label for stay'
                }), formatMessage({
                    id: 'index.leave',
                    default: 'Leave',
                    description: 'Label for leave'
                })
            ],
            cancelId: 0, // closing the dialog means "stay"
            defaultId: 0 // pressing enter or space without explicitly selecting something means "stay"
        });
        const shouldQuit = (choice === 1);
        if (shouldQuit) {
            ev.preventDefault();
        }
    });

    ipcMain.on('loading-completed', () => {
        webContents.send('setPlatform', process.platform);

        update.checkUpdateAtStartup();
    });

    ipcMain.on('reqeustUpdate', () => {
        update.reqeustUpdate()
            .then(() => {
                setTimeout(() => {
                    console.log(`INFO: App will restart after 3 seconds`);
                    app.relaunch();
                    app.exit();
                }, 1000 * 3);
            })
            .catch(err => {
                console.error(`ERR!: update failed: ${err}`);
            });
    });

    ipcMain.on('abortUpdate', () => {
        update.abortUpdate();
    });

    return window;
};

if (process.platform === 'darwin') {
    const osxMenu = Menu.buildFromTemplate(MacOSMenu(app));
    Menu.setApplicationMenu(osxMenu);
} else {
    // disable menu for other platforms
    Menu.setApplicationMenu(null);
}

// quit application when all windows are closed
let isQuitting = false;

app.on('window-all-closed', () => {
    app.quit();
});

app.on('before-quit', event => {
    if (sparkFirmwareUpdateService.busy || newAiFirmwareUpdateService.busy || newAiPeripheralUpdateService.busy) {
        event.preventDefault(); return;
    }
    if (isQuitting) {
        return;
    }
    event.preventDefault();
    isQuitting = true;
    estVisionWindow.close();
    estVisionSimulator.stop({clear: false});
    Promise.all([estDeviceService.shutdown(), sparkDeviceService.shutdown(), newAiDeviceService.shutdown()])
        .catch(error => console.error('EST shutdown failed', error))
        .finally(() => app.quit());
});

app.on('activate', () => {
    if (_windows.main === null) {
        createMainWindow();
    }
});

// work around https://github.com/MarshallOfSound/electron-devtools-installer/issues/122
// which seems to be a result of https://github.com/electron/electron/issues/19468
if (process.platform === 'win32') {
    const appUserDataPath = app.getPath('userData');
    const devToolsExtensionsPath = path.join(appUserDataPath, 'DevTools Extensions');
    try {
        fs.unlinkSync(devToolsExtensionsPath);
    } catch (_) {
        // don't complain if the file doesn't exist
    }
}

// create main BrowserWindow when electron is ready
app.on('ready', () => {
    if (isDevelopment) {
        import('electron-devtools-installer').then(importedModule => {
            const {default: installExtension, ...devToolsExtensions} = importedModule;
            const extensionsToInstall = [
                devToolsExtensions.REACT_DEVELOPER_TOOLS,
                devToolsExtensions.REDUX_DEVTOOLS
            ];
            for (const extension of extensionsToInstall) {
                // WARNING: depending on a lot of things including the version of Electron `installExtension` might
                // return a promise that never resolves, especially if the extension is already installed.
                installExtension(extension).then(
                    extensionName => log(`Installed dev extension: ${extensionName}`),
                    errorMessage => log.error(`Error installing dev extension: ${errorMessage}`)
                );
            }
        });
    }

    // create a loading windows let user know the app is starting
    _windows.loading = createLoadingWindow();
    _windows.loading.once('show', () => {
        _windows.main = createMainWindow();
        _windows.main.on('closed', () => {
            estVisionWindow.close();
            delete _windows.main;
        });

        _windows.about = createAboutWindow();
        _windows.about.on('close', event => {
            event.preventDefault();
            _windows.about.hide();
        });
        _windows.license = createLicenseWindow();
        _windows.license.on('close', event => {
            event.preventDefault();
            _windows.license.hide();
        });
        _windows.privacy = createPrivacyWindow();
        _windows.privacy.on('close', event => {
            event.preventDefault();
            _windows.privacy.hide();
        });

        // after finsh load progress show main window and close loading window
        _windows.main.show();
        _windows.loading.close();
        delete _windows.loading;
    });
});

ipcMain.on('open-about-window', () => {
    _windows.about.show();
});

ipcMain.on('open-license-window', () => {
    _windows.license.show();
});

ipcMain.on('open-privacy-policy-window', () => {
    _windows.privacy.show();
});

ipcMain.on('set-locale', (event, arg) => {
    formatMessage.setup({locale: arg});
});

registerEstAiIpc({
    ipcMain,
    isAllowedSender: event => Boolean(_windows.main && event.sender === _windows.main.webContents),
    keyStore: createEstAiKeyStore({
        safeStorage,
        fs,
        getPath: () => getEstAiSettingsPath(app),
        getLegacyPath: () => path.join(app.getPath('userData'), 'est-ai-key.bin')
    })
});

ipcMain.handle('est-home-set-hardware', (event, request) => {
    getHomeContent(request && request.hardwareId);
    homeHardwarePreferences.write(request.hardwareId);
    return request.hardwareId;
});
ipcMain.handle('est-home-get-startup-state', () => ({
    homeHardwareId: homeHardwarePreferences.read(),
    hasInitialProject: argv._.length > 0,
    projectPath: argv._.length > 0 ? argv._[argv._.length - 1] : null
}));
ipcMain.handle('est-home-list-recent-projects', () => listRecentProjects());
ipcMain.handle('est-home-remember-project', async (event, projectPath) => {
    const project = await rememberRecentProject(projectPath);
    if (project) {
        await captureProjectThumbnail(event.sender, project.path);
    }
    return project;
});
ipcMain.handle('est-home-capture-thumbnail', (event, projectPath) => (
    captureProjectThumbnail(event.sender, projectPath)
));
ipcMain.handle('est-home-choose-project', async event => {
    const result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
        properties: ['openFile'], filters: [getFilterForExtension('atc')]
    });
    if (result.canceled || !result.filePaths.length) return null;
    return openProjectForHome(result.filePaths[0]);
});
ipcMain.handle('est-home-open-project', (event, projectPath) => openProjectForHome(projectPath));
ipcMain.handle('est-home-remove-recent-project', (event, projectPath) => removeRecentProject(projectPath));
ipcMain.handle('est-home-rename-project', (event, request) => renameHomeProject(request));
ipcMain.handle('est-home-copy-project', (event, projectPath) => copyHomeProject(projectPath));
ipcMain.handle('est-home-get-build-thumbnails', (event, request) => getHomeBuildThumbnails(request));
ipcMain.handle('est-home-get-build-library-state', (event, request) => getHomeBuildLibraryState(request));
ipcMain.handle('est-home-download-build-library', (event, request) => {
    const hardwareId = requireHomeBuildLibrary(request);
    if (!estBuildLibraryInstallPromise) {
        estBuildLibraryInstallHardwareId = hardwareId;
        let lastPhase = '';
        let lastPercent = -1;
        let lastPaused = false;
        let lastCancelled = false;
        let lastSentAt = 0;
        estBuildLibraryInstallOperation = new EstBuildLibraryOperation();
        const sendProgress = progress => {
            const now = Date.now();
            const operationState = estBuildLibraryInstallOperation.snapshot();
            const nextProgress = {
                ...progress,
                hardwareId,
                cancelled: operationState.cancelled,
                paused: operationState.paused
            };
            const stateChanged = nextProgress.paused !== lastPaused || nextProgress.cancelled !== lastCancelled;
            const phaseChanged = nextProgress.phase !== lastPhase;
            const finished = nextProgress.percent === 100;
            if (!phaseChanged && !stateChanged && !finished &&
                nextProgress.percent === lastPercent && now - lastSentAt < 180) return;
            if (!phaseChanged && !stateChanged && !finished && now - lastSentAt < 180) return;
            lastPhase = nextProgress.phase;
            lastPercent = nextProgress.percent;
            lastPaused = nextProgress.paused;
            lastCancelled = nextProgress.cancelled;
            lastSentAt = now;
            estBuildLibraryLastProgress = nextProgress;
            if (!event.sender.isDestroyed()) {
                event.sender.send('est-home-build-download-progress', nextProgress);
            }
        };
        estBuildLibraryProgressPublisher = sendProgress;
        estBuildLibraryInstallPromise = getEstBuildLibraryService().install(
            sendProgress,
            estBuildLibraryInstallOperation
        )
            .then(serializeInstalledBuildLibrary)
            .catch(error => {
                if (error instanceof EstBuildLibraryCancelledError) return {hardwareId, cancelled: true};
                throw error;
            })
            .finally(() => {
                estBuildLibraryInstallPromise = null;
                estBuildLibraryInstallHardwareId = null;
                estBuildLibraryInstallOperation = null;
                estBuildLibraryLastProgress = null;
                estBuildLibraryProgressPublisher = null;
            });
    }
    return estBuildLibraryInstallPromise;
});
ipcMain.handle('est-home-pause-build-library-download', (event, request) => {
    requireHomeBuildLibrary(request);
    if (!estBuildLibraryInstallOperation) return {active: false, paused: false};
    const state = estBuildLibraryInstallOperation.pause();
    if (estBuildLibraryProgressPublisher && estBuildLibraryLastProgress) {
        estBuildLibraryProgressPublisher(estBuildLibraryLastProgress);
    }
    return {active: true, ...state};
});
ipcMain.handle('est-home-resume-build-library-download', (event, request) => {
    requireHomeBuildLibrary(request);
    if (!estBuildLibraryInstallOperation) return {active: false, paused: false};
    const state = estBuildLibraryInstallOperation.resume();
    if (estBuildLibraryProgressPublisher && estBuildLibraryLastProgress) {
        estBuildLibraryProgressPublisher(estBuildLibraryLastProgress);
    }
    return {active: true, ...state};
});
ipcMain.handle('est-home-cancel-build-library-download', (event, request) => {
    requireHomeBuildLibrary(request);
    if (!estBuildLibraryInstallOperation) return {active: false, cancelled: false};
    const state = estBuildLibraryInstallOperation.cancel();
    if (estBuildLibraryProgressPublisher && estBuildLibraryLastProgress) {
        estBuildLibraryProgressPublisher(estBuildLibraryLastProgress);
    }
    return {active: true, ...state};
});
ipcMain.handle('est-home-open-build-guide', (event, request) => openHomeBuildGuide(request));

const firmwareUpdateConnectionState = () => ({
    state: 'firmware-updating',
    compatible: false,
    message: 'EST firmware update is in progress',
    status: null
});

const requireNoFirmwareUpdate = () => {
    if (estFirmwareUpdateState.inProgress) {
        throw new Error('EST firmware update is in progress');
    }
};

const requireMainHardwareWindow = event => {
    if (!_windows.main || event.sender !== _windows.main.webContents) throw new Error('HARDWARE_BUSY');
};
ipcMain.handle('hardware-state', event => {
    requireMainHardwareWindow(event);
    return hardwareSession.getState();
});
ipcMain.handle('hardware-select', (event, request) => {
    requireMainHardwareWindow(event);
    return hardwareSession.select(request);
});
ipcMain.handle('hardware-draft-write', (event, request) => {
    requireMainHardwareWindow(event);
    return getHardwareDrafts().write(request);
});
ipcMain.handle('hardware-draft-read', (event, hardwareId) => {
    requireMainHardwareWindow(event);
    return getHardwareDrafts().read(hardwareId);
});
ipcMain.handle('hardware-drafts-clear', event => {
    requireMainHardwareWindow(event);
    return getHardwareDrafts().clear();
});
const hardwareUnavailableState = () => ({state: 'hardware-unavailable', compatible: false, status: null});
const canUseEstAdapter = () => !hardwareSession.switching && hardwareSession.hardwareId === 'est';

newAiDeviceService.on('state', state => {
    if (!_windows.main || _windows.main.isDestroyed() || hardwareSession.switching ||
        hardwareSession.hardwareId !== 'new-ai') return;
    _windows.main.webContents.send('new-ai-state-change', state);
});
const newAiOperation = (event, action) => {
    requireMainHardwareWindow(event);
    return hardwareSession.operation(action, 'new-usb');
};
ipcMain.handle('new-ai-state', event => {
    requireMainHardwareWindow(event);
    hardwareSession.requireAdapter('new-usb');
    return newAiDeviceService.getState();
});
ipcMain.handle('new-ai-list-devices', event => {
    requireMainHardwareWindow(event);
    return hardwareSession.background(() => newAiDeviceService.listDevices(), 'new-usb');
});
ipcMain.handle('new-ai-connect', (event, request) =>
    newAiOperation(event, () => newAiDeviceService.connect(request)));
ipcMain.handle('new-ai-connection-mode', (event, mode) =>
    newAiOperation(event, () => newAiDeviceService.setConnectionMode(mode)));
ipcMain.handle('new-ai-ble-scan', event => newAiOperation(event, () => {
    if (newAiDeviceService.busy || newAiDeviceService.connected) throw new Error('NEW_BUSY');
    newAiBleBridge.beginScan();
}));
ipcMain.handle('new-ai-ble-select', (event, id) => newAiOperation(event, () => newAiBleBridge.select(id)));
ipcMain.handle('new-ai-ble-bind', (event, id) => newAiOperation(event, () => newAiBleBridge.bindDevice(id)));
ipcMain.handle('new-ai-ble-cancel-scan', event => {
    requireMainHardwareWindow(event);
    if (!newAiDeviceService.bleReconnecting) newAiBleBridge.cancelScan();
});
ipcMain.handle('new-ai-ble-forget', event => newAiOperation(event, () => newAiDeviceService.forgetBleDevice()));
ipcMain.on('new-ai-ble-ready', event => {
    if (_windows.main && event.sender === _windows.main.webContents) {
        newAiBleBridge.ready = true;
        newAiDeviceService.scheduleDiscovery(0);
    }
});
ipcMain.on('new-ai-ble-reply', (event, message) => {
    if (_windows.main && event.sender === _windows.main.webContents) newAiBleBridge.reply(message);
});
ipcMain.on('new-ai-ble-data', (event, message) => {
    if (_windows.main && event.sender === _windows.main.webContents) newAiBleBridge.receive(message);
});
ipcMain.handle('new-ai-disconnect', (event, request) => newAiOperation(event, () => {
    if (newAiDeviceService.pythonProgramActive && !(request && request.confirmRunning === true)) {
        throw new Error('NEW_DISCONNECT_CONFIRM');
    }
    return newAiDeviceService.disconnect();
}));
ipcMain.handle('new-ai-set-auto-connect', (event, enabled) =>
    newAiOperation(event, () => newAiDeviceService.setAutoConnect(enabled)));
ipcMain.handle('new-ai-compile-program', (event, request) =>
    newAiOperation(event, () => newAiDeviceService.compileProgram(request)));
ipcMain.handle('new-ai-download-program', (event, request) =>
    newAiOperation(event, () => newAiDeviceService.downloadProgram(request)));
ipcMain.handle('new-ai-run-program', (event, request) =>
    newAiOperation(event, () => newAiDeviceService.runProgram(request)));
ipcMain.handle('new-ai-stop-program', event => newAiOperation(event, () => newAiDeviceService.stopCurrentProgram()));
ipcMain.handle('new-ai-firmware-inspect', event => newAiOperation(event, () => newAiFirmwareUpdateService.inspect()));
ipcMain.handle('new-ai-firmware-update', (event, request) =>
    newAiOperation(event, () => newAiFirmwareUpdateService.start(request)));
ipcMain.handle('new-ai-peripheral-update', (event, request) =>
    newAiOperation(event, () => newAiPeripheralUpdateService.start(request)));
ipcMain.handle('new-ai-cancel', event => {
    requireMainHardwareWindow(event);
    hardwareSession.requireAdapter('new-usb');
    newAiDeviceService.cancel();
});

sparkDeviceService.on('state', state => {
    if (!_windows.main || _windows.main.isDestroyed() || hardwareSession.switching ||
        hardwareSession.hardwareId !== 'spark-ai') return;
    _windows.main.webContents.send('spark-state-change', state);
});
const sparkOperation = (event, action) => {
    requireMainHardwareWindow(event);
    return hardwareSession.operation(action, 'spark-usb');
};
ipcMain.handle('spark-state', event => {
    requireMainHardwareWindow(event);
    hardwareSession.requireAdapter('spark-usb');
    return sparkDeviceService.getState();
});
ipcMain.handle('spark-list-devices', event => {
    requireMainHardwareWindow(event);
    return hardwareSession.background(() => sparkDeviceService.listDevices(), 'spark-usb');
});
ipcMain.handle('spark-firmware-inspect', event => sparkOperation(event,
    () => sparkFirmwareUpdateService.inspect(sparkDeviceService.getState())));
ipcMain.handle('spark-firmware-update', (event, request) => sparkOperation(event,
    () => sparkFirmwareUpdateService.start(request)));
ipcMain.handle('spark-connect', (event, request) => sparkOperation(event, () => sparkDeviceService.connect(request)));
ipcMain.handle('spark-connection-mode', (event, mode) => sparkOperation(event,
    () => sparkDeviceService.setConnectionMode(mode)));
ipcMain.handle('spark-ble-scan', event => sparkOperation(event, () => {
    if (sparkDeviceService.busy || sparkDeviceService.connected) throw new Error('SPARK_BUSY');
    sparkBleBridge.beginScan();
}));
ipcMain.handle('spark-ble-select', (event, id) => sparkOperation(event, () => sparkBleBridge.select(id)));
ipcMain.handle('spark-ble-bind', (event, id) => sparkOperation(event, () => sparkBleBridge.bindDevice(id)));
ipcMain.handle('spark-ble-cancel-scan', event => {
    requireMainHardwareWindow(event);
    if (!sparkDeviceService.bleReconnecting) sparkBleBridge.cancelScan();
});
ipcMain.handle('spark-ble-forget', event => sparkOperation(event, () => sparkDeviceService.forgetBleDevice()));
ipcMain.on('spark-ble-ready', event => {
    if (_windows.main && event.sender === _windows.main.webContents) {
        sparkBleBridge.ready = true;
        sparkDeviceService.scheduleDiscovery(0);
    }
});
ipcMain.on('spark-ble-reply', (event, message) => {
    if (_windows.main && event.sender === _windows.main.webContents) sparkBleBridge.reply(message);
});
ipcMain.on('spark-ble-data', (event, message) => {
    if (_windows.main && event.sender === _windows.main.webContents) sparkBleBridge.receive(message);
});
ipcMain.handle('spark-set-auto-connect', (event, enabled) => sparkOperation(event,
    () => sparkDeviceService.setAutoConnect(enabled)));
ipcMain.handle('spark-disconnect', (event, request) => sparkOperation(event, () => {
    if (sparkDeviceService.pythonProgramActive && !(request && request.confirmRunning === true)) {
        throw new Error('SPARK_DISCONNECT_CONFIRM');
    }
    return sparkDeviceService.disconnect();
}));
ipcMain.handle('spark-download-program', (event, request) => sparkOperation(event,
    () => sparkDeviceService.downloadProgram({...request, run: false})));
ipcMain.handle('spark-run-program', (event, request) => sparkOperation(event,
    () => sparkDeviceService.downloadProgram({...request, run: true})));
ipcMain.handle('spark-stop-program', event => sparkOperation(event, () => sparkDeviceService.stopCurrentProgram()));
ipcMain.handle('spark-set-monitoring', (event, enabled) => sparkOperation(event,
    () => sparkDeviceService.setMonitoring(enabled)));
ipcMain.handle('spark-cancel', event => {
    requireMainHardwareWindow(event);
    hardwareSession.requireAdapter('spark-usb');
    sparkDeviceService.cancel();
});
ipcMain.handle('spark-clear-logs', event => {
    requireMainHardwareWindow(event);
    hardwareSession.requireAdapter('spark-usb');
    sparkDeviceService.clearLogs();
});

ipcMain.handle('est-list-devices', () => (
    estFirmwareUpdateState.inProgress || !canUseEstAdapter() ? [] :
        hardwareSession.background(() => estDeviceService.listDevices())
));
ipcMain.handle('est-connect', (event, device) => {
    hardwareSession.requireAdapter();
    requireNoFirmwareUpdate();
    return hardwareSession.operation(() => estDeviceService.connect(device));
});
ipcMain.handle('est-disconnect', () => {
    hardwareSession.requireAdapter();
    return hardwareSession.operation(() => estDeviceService.disconnect());
});
ipcMain.handle('est-get-status', (event, options) => (
    canUseEstAdapter() ? (
        estFirmwareUpdateState.inProgress ? firmwareUpdateConnectionState() :
            hardwareSession.background(() => estDeviceService.getStatus(options))) : hardwareUnavailableState()
));
ipcMain.handle('est-hardware-status', () => (
    canUseEstAdapter() ? (
        estFirmwareUpdateState.inProgress ? {state: 'busy'} :
            hardwareSession.background(() => estDeviceService.getHardwareStatus())) : hardwareUnavailableState()
));
ipcMain.handle('est-auto-connect', (event, options) => (
    canUseEstAdapter() ? (
        estFirmwareUpdateState.inProgress ? firmwareUpdateConnectionState() :
            hardwareSession.background(() => estDeviceService.autoConnect(options))) : hardwareUnavailableState()
));
ipcMain.handle('est-download-program', (event, request) => {
    requireNoFirmwareUpdate();
    return hardwareSession.operation(() => estDeviceService.downloadProgram(request));
});
ipcMain.handle('est-run-program', (event, request) => {
    requireNoFirmwareUpdate();
    return hardwareSession.operation(() => estDeviceService.runProgram(request));
});
ipcMain.handle('est-stop-program', () => {
    requireNoFirmwareUpdate();
    return hardwareSession.operation(() => estDeviceService.stopCurrentProgram());
});
ipcMain.handle('est-vision-status', () => {
    hardwareSession.requireAdapter();
    requireNoFirmwareUpdate();
    return estDeviceService.getVisionStatus();
});
ipcMain.handle('est-vision-update', (event, sample) => {
    hardwareSession.requireAdapter();
    requireNoFirmwareUpdate();
    estVisionCamera.requireAvailable();
    return estDeviceService.updateVisionSample(sample);
});
ipcMain.handle('est-vision-clear', (event, reason) => {
    hardwareSession.requireAdapter();
    requireNoFirmwareUpdate();
    estVisionCamera.requireAvailable();
    return estDeviceService.clearVision(reason);
});
ipcMain.handle('est-vision-simulator-start', (event, options) => {
    hardwareSession.requireAdapter();
    requireNoFirmwareUpdate();
    estVisionCamera.requireAvailable();
    return estVisionSimulator.start(options);
});
ipcMain.handle('est-vision-window-open', (event, locale) => {
    if (!_windows.main || event.sender !== _windows.main.webContents) throw new Error('无效的摄像头窗口请求');
    estVisionWindow.open(locale);
});
ipcMain.handle('est-vision-window-locale', (event, locale) => {
    if (_windows.main && event.sender === _windows.main.webContents) estVisionWindow.setLocale(locale);
});
ipcMain.on('est-vision-window-ready', event => {
    if (estVisionWindow.owns(event.sender)) estVisionWindow.setLocale();
});
ipcMain.handle('est-vision-window-close', event => {
    if (estVisionWindow.owns(event.sender)) estVisionWindow.close();
});
ipcMain.handle('est-vision-camera-state', () => (canUseEstAdapter() ? estDeviceService.getVisionPublisherState() :
    {connected: false, supported: false, multiSupported: false, paused: true}));
ipcMain.handle('est-vision-camera-start', (event, options) => {
    hardwareSession.requireAdapter();
    if (!estVisionWindow.owns(event.sender) &&
        (!_windows.main || event.sender !== _windows.main.webContents)) throw new Error('摄像头窗口已关闭');
    requireNoFirmwareUpdate();
    return estVisionCamera.start(event.sender.id, options);
});
ipcMain.handle('est-vision-camera-frame', (event, token, sample) => {
    hardwareSession.requireAdapter();
    requireNoFirmwareUpdate();
    return estVisionCamera.frame(event.sender.id, token, sample);
});
ipcMain.handle('est-vision-camera-stop', (event, token) => estVisionCamera.stop(event.sender.id, token));
ipcMain.handle('est-vision-simulator-stop', () => {
    estVisionCamera.requireAvailable();
    return estVisionSimulator.stop();
});
ipcMain.handle('est-vision-simulator-no-target', () => {
    hardwareSession.requireAdapter();
    estVisionCamera.requireAvailable();
    return estVisionSimulator.noTarget();
});
ipcMain.handle('est-vision-simulator-status', () => estVisionSimulator.getState());
ipcMain.handle('est-flash-firmware', async (event, request) => {
    hardwareSession.requireAdapter();
    if (estFirmwareUpdateState.inProgress) {
        throw new Error('EST firmware update is already in progress');
    }
    estFirmwareUpdateState.inProgress = true;
    estVisionSimulator.stop({clear: false});
    estDeviceService.suspendVision();
    try {
        await estDeviceService.disconnect();
        return await flashEstFirmware(request, progress => {
            if (!event.sender.isDestroyed()) {
                event.sender.send('est-firmware-update-progress', progress);
            }
        });
    } finally {
        estFirmwareUpdateState.inProgress = false;
        estDeviceService.resumeVision();
    }
});


// start loading initial project data before the GUI needs it so the load seems faster
const initialProjectDataPromise = (async () => {
    if (argv._.length === 0) {
        // no command line argument means no initial project data
        return;
    }
    if (argv._.length > 1) {
        log.warn(`Expected 1 command line argument but received ${argv._.length}.`);
    }
    const projectPath = argv._[argv._.length - 1];
    try {
        if (path.extname(projectPath).toLowerCase() !== '.atc') {
            throw new Error(formatMessage({
                id: 'index.atcProjectOnly',
                default: 'Please choose an ATC CodeStudio (.atc) project.'
            }));
        }
        const projectData = await promisify(fs.readFile)(projectPath, null);
        await rememberRecentProject(projectPath);
        return projectData;
    } catch (e) {
        await app.whenReady();
        dialog.showMessageBox(_windows.main, {
            type: 'error',
            title: 'Failed to load project',
            message: `${formatMessage({
                id: 'index.failedLoadProject',
                default: 'Could not load project from file:',
                description: 'prompt for failed to load project'
            })}\n${projectPath}`,
            detail: e.message
        });
    }
    // load failed: initial project data undefined
})(); // IIFE

ipcMain.handle('get-initial-project-data', () => initialProjectDataPromise);
