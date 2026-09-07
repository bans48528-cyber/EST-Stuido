const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const os = require('os');
const path = require('path');
const babel = require('@babel/core');

const root = path.resolve(__dirname, '..');
const serviceRoot = path.join(root, 'src', 'main', 'est');
const originalLoader = Module._extensions['.js'];
Module._extensions['.js'] = (module, filename) => {
    if (!filename.startsWith(serviceRoot)) return originalLoader(module, filename);
    const transformed = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
        babelrc: false,
        plugins: ['@babel/plugin-transform-modules-commonjs']
    });
    module._compile(transformed.code, filename);
};

const {
    EST_BUILD_LIBRARY_MANIFEST_URL,
    EST_BUILD_LIBRARY_REMOTE_SUMMARY,
    EstBuildLibraryCancelledError,
    EstBuildLibraryOperation,
    validateBuildLibraryCatalog,
    validateBuildLibraryManifest
} = require(path.join(serviceRoot, 'build-library-service.js'));

const hash = character => character.repeat(64);
const validManifest = {
    schemaVersion: 1,
    contentVersion: EST_BUILD_LIBRARY_REMOTE_SUMMARY.contentVersion,
    archive: 'est-build-library-v1.0.0.zip',
    archiveBytes: EST_BUILD_LIBRARY_REMOTE_SUMMARY.archiveBytes,
    archiveSha256: EST_BUILD_LIBRARY_REMOTE_SUMMARY.archiveSha256,
    itemCount: EST_BUILD_LIBRARY_REMOTE_SUMMARY.itemCount
};

assert.match(EST_BUILD_LIBRARY_MANIFEST_URL, /^https:\/\/github\.com\//);
assert.deepStrictEqual(validateBuildLibraryManifest(validManifest), validManifest);
assert.throws(() => validateBuildLibraryManifest({...validManifest, archive: '../library.zip'}));
assert.throws(() => validateBuildLibraryManifest({...validManifest, archiveBytes: 0}));
assert.throws(() => validateBuildLibraryManifest({...validManifest, archiveSha256: 'bad'}));
assert.throws(() => validateBuildLibraryManifest({...validManifest, contentVersion: '../1.0.0'}));

const operation = new EstBuildLibraryOperation();
const operationStates = [];
const unsubscribe = operation.subscribe(state => operationStates.push(state));
assert.deepStrictEqual(operation.pause(), {cancelled: false, paused: true});
assert.deepStrictEqual(operation.resume(), {cancelled: false, paused: false});
assert.deepStrictEqual(operation.cancel(), {cancelled: true, paused: false});
assert.throws(() => operation.throwIfCancelled(), EstBuildLibraryCancelledError);
unsubscribe();
assert.deepStrictEqual(operationStates, [
    {cancelled: false, paused: false},
    {cancelled: false, paused: true},
    {cancelled: false, paused: false},
    {cancelled: true, paused: false}
]);

const catalogRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'est-build-library-test-'));
const validItem = {
    id: 'basic-01',
    category: 'basic',
    title: '爬行蜘蛛',
    pages: 11,
    thumbnail: 'thumbnails/basic-01.jpg',
    thumbnailSha256: hash('a'),
    guide: 'guides/basic-01.pdf',
    guideSha256: hash('b')
};
const validCatalog = {
    schemaVersion: 1,
    contentVersion: '1.0.0',
    itemCount: 1,
    items: [validItem]
};

try {
    const catalog = validateBuildLibraryCatalog(validCatalog, catalogRoot);
    assert.strictEqual(catalog.items[0].thumbnailPath, path.join(catalogRoot, 'thumbnails', 'basic-01.jpg'));
    assert.strictEqual(catalog.items[0].guidePath, path.join(catalogRoot, 'guides', 'basic-01.pdf'));
    assert.throws(() => validateBuildLibraryCatalog({
        ...validCatalog,
        items: [{...validItem, thumbnail: '../outside.jpg'}]
    }, catalogRoot));
    assert.throws(() => validateBuildLibraryCatalog({
        ...validCatalog,
        items: [{...validItem, guide: 'guides/basic-01.exe'}]
    }, catalogRoot));
    assert.throws(() => validateBuildLibraryCatalog({
        ...validCatalog,
        items: [{...validItem, category: 'unknown'}]
    }, catalogRoot));
    assert.throws(() => validateBuildLibraryCatalog({
        ...validCatalog,
        itemCount: 2,
        items: [validItem, {...validItem}]
    }, catalogRoot));
} finally {
    fs.rmSync(catalogRoot, {recursive: true, force: true});
}

const mainSource = fs.readFileSync(path.join(root, 'src', 'main', 'index.js'), 'utf8');
assert.match(mainSource, /EST_BUILD_LIBRARY_ALLOWED_HOSTS/);
assert.match(mainSource, /redirect: 'manual'/);
assert.match(mainSource, /request\.followRedirect\(\)/);
assert.match(mainSource, /est-home-build-download-progress/);
assert.match(mainSource, /est-home-pause-build-library-download/);
assert.match(mainSource, /est-home-resume-build-library-download/);
assert.match(mainSource, /est-home-cancel-build-library-download/);
assert.match(mainSource, /getPath\('userData'\).*EST_BUILD_LIBRARY_CACHE_DIRECTORY/s);

console.log('EST build library validation and download integration tests passed');
