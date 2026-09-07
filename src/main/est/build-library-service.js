import {createHash, randomBytes} from 'crypto';
import extractZip from 'extract-zip';
import fs from 'fs-extra';
import path from 'path';
import {URL} from 'url';

export const EST_BUILD_LIBRARY_MANIFEST_URL =
    'https://github.com/bans48528-cyber/EST-Stuido/releases/download/' +
    'est-build-library-v1.0.0/est-build-library-v1.0.0.manifest.json';

export const EST_BUILD_LIBRARY_REMOTE_SUMMARY = {
    archiveBytes: 45761001,
    archiveSha256: '04b15f159656b96090afdfa3227b10712f6d92eafd7f9499674c2481e544076f',
    contentVersion: '1.0.0',
    itemCount: 42
};

const MAX_MANIFEST_BYTES = 1024 * 1024;
const MAX_ARCHIVE_BYTES = 250 * 1024 * 1024;
const INSTALL_STATE_FILE = 'installed.json';

export class EstBuildLibraryCancelledError extends Error {
    constructor () {
        super('Build library download was cancelled.');
        this.code = 'EST_BUILD_LIBRARY_CANCELLED';
    }
}

export class EstBuildLibraryOperation {
    constructor () {
        this.cancelled = false;
        this.paused = false;
        this.listeners = new Set();
    }

    snapshot () {
        return {
            cancelled: this.cancelled,
            paused: this.paused
        };
    }

    notify () {
        const state = this.snapshot();
        for (const listener of this.listeners) listener(state);
    }

    pause () {
        if (this.cancelled || this.paused) return this.snapshot();
        this.paused = true;
        this.notify();
        return this.snapshot();
    }

    resume () {
        if (this.cancelled || !this.paused) return this.snapshot();
        this.paused = false;
        this.notify();
        return this.snapshot();
    }

    cancel () {
        if (this.cancelled) return this.snapshot();
        this.cancelled = true;
        this.paused = false;
        this.notify();
        return this.snapshot();
    }

    subscribe (listener) {
        this.listeners.add(listener);
        listener(this.snapshot());
        return () => this.listeners.delete(listener);
    }

    throwIfCancelled () {
        if (this.cancelled) throw new EstBuildLibraryCancelledError();
    }
}

const isPlainObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const ensureString = (value, name, maximumLength) => {
    if (typeof value !== 'string' || !value || value.length > maximumLength || value.includes('\0')) {
        throw new Error(`Invalid build library ${name}.`);
    }
    return value;
};

const ensureSha256 = (value, name) => {
    if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) {
        throw new Error(`Invalid build library ${name}.`);
    }
    return value.toLowerCase();
};

const ensureContentVersion = value => {
    const contentVersion = ensureString(value, 'content version', 32);
    if (!/^\d+\.\d+\.\d+$/.test(contentVersion)) {
        throw new Error('Invalid build library content version.');
    }
    return contentVersion;
};

const resolveCatalogFile = (rootDirectory, relativePath, expectedDirectory, expectedExtension) => {
    const normalized = ensureString(relativePath, 'asset path', 160).replace(/\\/g, '/');
    const segments = normalized.split('/');
    if (segments.length !== 2 || segments[0] !== expectedDirectory ||
        segments.some(segment => !segment || segment === '.' || segment === '..')) {
        throw new Error('Invalid build library asset path.');
    }
    if (path.posix.extname(normalized).toLowerCase() !== expectedExtension) {
        throw new Error('Invalid build library asset type.');
    }
    const resolvedRoot = path.resolve(rootDirectory);
    const resolvedPath = path.resolve(resolvedRoot, ...segments);
    if (!resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)) {
        throw new Error('Build library asset escaped its cache directory.');
    }
    return resolvedPath;
};

export const validateBuildLibraryManifest = manifest => {
    if (!isPlainObject(manifest) || manifest.schemaVersion !== 1) {
        throw new Error('Unsupported build library manifest.');
    }
    const contentVersion = ensureContentVersion(manifest.contentVersion);
    const archive = ensureString(manifest.archive, 'archive name', 100);
    if (path.basename(archive) !== archive || path.extname(archive).toLowerCase() !== '.zip') {
        throw new Error('Invalid build library archive name.');
    }
    if (!Number.isSafeInteger(manifest.archiveBytes) || manifest.archiveBytes <= 0 ||
        manifest.archiveBytes > MAX_ARCHIVE_BYTES) {
        throw new Error('Invalid build library archive size.');
    }
    if (!Number.isSafeInteger(manifest.itemCount) || manifest.itemCount < 1 || manifest.itemCount > 200) {
        throw new Error('Invalid build library item count.');
    }
    return {
        ...manifest,
        archive,
        archiveSha256: ensureSha256(manifest.archiveSha256, 'archive hash'),
        contentVersion
    };
};

export const validateBuildLibraryCatalog = (catalog, rootDirectory) => {
    if (!isPlainObject(catalog) || catalog.schemaVersion !== 1 || !Array.isArray(catalog.items)) {
        throw new Error('Unsupported build library catalog.');
    }
    if (catalog.itemCount !== catalog.items.length || catalog.items.length < 1 || catalog.items.length > 200) {
        throw new Error('Invalid build library catalog size.');
    }
    const itemIds = new Set();
    const items = catalog.items.map(item => {
        if (!isPlainObject(item)) throw new Error('Invalid build library item.');
        const id = ensureString(item.id, 'item ID', 64);
        if (!/^[a-z0-9-]+$/.test(id) || itemIds.has(id)) {
            throw new Error('Invalid or duplicate build library item ID.');
        }
        itemIds.add(id);
        if (item.category !== 'basic' && item.category !== 'pbl') {
            throw new Error('Invalid build library category.');
        }
        const thumbnailPath = resolveCatalogFile(rootDirectory, item.thumbnail, 'thumbnails', '.jpg');
        const guidePath = resolveCatalogFile(rootDirectory, item.guide, 'guides', '.pdf');
        return {
            ...item,
            guidePath,
            guideSha256: ensureSha256(item.guideSha256, 'guide hash'),
            id,
            thumbnailPath,
            thumbnailSha256: ensureSha256(item.thumbnailSha256, 'thumbnail hash'),
            title: ensureString(item.title, 'item title', 100)
        };
    });
    return {
        ...catalog,
        contentVersion: ensureContentVersion(catalog.contentVersion),
        items
    };
};

const sha256File = filePath => new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
});

const extractArchive = (archivePath, destinationPath) => new Promise((resolve, reject) => {
    extractZip(archivePath, {dir: destinationPath}, error => (error ? reject(error) : resolve()));
});

const verifyCatalogAssets = async catalog => {
    await Promise.all(catalog.items.map(async item => {
        const [thumbnailExists, guideExists] = await Promise.all([
            fs.pathExists(item.thumbnailPath),
            fs.pathExists(item.guidePath)
        ]);
        if (!thumbnailExists || !guideExists) throw new Error('Build library is missing an asset.');
        const [thumbnailHash, guideHash] = await Promise.all([
            sha256File(item.thumbnailPath),
            sha256File(item.guidePath)
        ]);
        if (thumbnailHash !== item.thumbnailSha256 || guideHash !== item.guideSha256) {
            throw new Error('Build library asset verification failed.');
        }
    }));
};

export class EstBuildLibraryService {
    constructor ({cacheRoot, downloadFile, manifestUrl = EST_BUILD_LIBRARY_MANIFEST_URL}) {
        this.cacheRoot = path.resolve(cacheRoot);
        this.downloadFile = downloadFile;
        this.manifestUrl = manifestUrl;
    }

    async getInstalledLibrary () {
        try {
            const installState = await fs.readJson(path.join(this.cacheRoot, INSTALL_STATE_FILE));
            const contentVersion = ensureContentVersion(installState.contentVersion);
            const libraryRoot = path.resolve(this.cacheRoot, contentVersion);
            if (!libraryRoot.startsWith(`${this.cacheRoot}${path.sep}`)) return null;
            const catalog = validateBuildLibraryCatalog(
                await fs.readJson(path.join(libraryRoot, 'catalog.json')),
                libraryRoot
            );
            for (const item of catalog.items) {
                if (!await fs.pathExists(item.thumbnailPath) || !await fs.pathExists(item.guidePath)) return null;
            }
            return {catalog, contentVersion, libraryRoot};
        } catch (error) {
            return null;
        }
    }

    async install (onProgress = () => {}, operation = new EstBuildLibraryOperation()) {
        await fs.ensureDir(this.cacheRoot);
        const operationId = `${Date.now()}-${randomBytes(4).toString('hex')}`;
        const manifestPath = path.join(this.cacheRoot, `.manifest-${operationId}.json`);
        const archivePath = path.join(this.cacheRoot, `.archive-${operationId}.zip`);
        const stagingPath = path.join(this.cacheRoot, `.staging-${operationId}`);
        try {
            operation.throwIfCancelled();
            onProgress({phase: 'checking', percent: 0});
            await this.downloadFile(this.manifestUrl, manifestPath, {
                maximumBytes: MAX_MANIFEST_BYTES,
                operation
            });
            operation.throwIfCancelled();
            const manifest = validateBuildLibraryManifest(await fs.readJson(manifestPath));
            if (manifest.contentVersion !== EST_BUILD_LIBRARY_REMOTE_SUMMARY.contentVersion ||
                manifest.archiveBytes !== EST_BUILD_LIBRARY_REMOTE_SUMMARY.archiveBytes ||
                manifest.archiveSha256 !== EST_BUILD_LIBRARY_REMOTE_SUMMARY.archiveSha256 ||
                manifest.itemCount !== EST_BUILD_LIBRARY_REMOTE_SUMMARY.itemCount) {
                throw new Error('Build library manifest does not match this EST Studio release.');
            }
            const existing = await this.getInstalledLibrary();
            if (existing && existing.contentVersion === manifest.contentVersion) {
                onProgress({phase: 'complete', percent: 100});
                return existing;
            }

            const archiveUrl = new URL(manifest.archive, this.manifestUrl).toString();
            await this.downloadFile(archiveUrl, archivePath, {
                expectedBytes: manifest.archiveBytes,
                maximumBytes: MAX_ARCHIVE_BYTES,
                onProgress: progress => onProgress({phase: 'downloading', ...progress}),
                operation
            });
            operation.throwIfCancelled();
            const archiveStats = await fs.stat(archivePath);
            if (archiveStats.size !== manifest.archiveBytes ||
                await sha256File(archivePath) !== manifest.archiveSha256) {
                throw new Error('Build library archive verification failed.');
            }

            onProgress({phase: 'extracting', percent: 100});
            await fs.ensureDir(stagingPath);
            await extractArchive(archivePath, stagingPath);
            operation.throwIfCancelled();
            const catalog = validateBuildLibraryCatalog(
                await fs.readJson(path.join(stagingPath, 'catalog.json')),
                stagingPath
            );
            if (catalog.contentVersion !== manifest.contentVersion || catalog.itemCount !== manifest.itemCount) {
                throw new Error('Build library catalog does not match its manifest.');
            }

            onProgress({phase: 'verifying', percent: 100});
            await verifyCatalogAssets(catalog);
            operation.throwIfCancelled();
            const destinationPath = path.resolve(this.cacheRoot, manifest.contentVersion);
            if (!destinationPath.startsWith(`${this.cacheRoot}${path.sep}`)) {
                throw new Error('Invalid build library destination.');
            }
            await fs.remove(destinationPath);
            await fs.move(stagingPath, destinationPath);
            await fs.outputJson(path.join(this.cacheRoot, INSTALL_STATE_FILE), {
                contentVersion: manifest.contentVersion,
                installedAt: new Date().toISOString()
            }, {spaces: 2});
            onProgress({phase: 'complete', percent: 100});
            const installed = await this.getInstalledLibrary();
            if (!installed) throw new Error('Build library installation could not be opened.');
            return installed;
        } finally {
            await Promise.all([
                fs.remove(manifestPath),
                fs.remove(archivePath),
                fs.remove(stagingPath)
            ]);
        }
    }
}
