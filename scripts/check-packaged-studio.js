// Verify a built Windows directory. Compiles fixed fixtures only; never runs user bytecode or opens devices.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {createHash} = require('crypto');
const {spawnSync} = require('child_process');
const asar = require('@electron/asar');
const {readPeArch} = require('./ensure-electron-native-arch');
const sparkFixtures = require('./spark-ai-compiler-fixtures.json');
const newFixtures = require('./new-ai-compiler-fixtures.json');
const compilerFixtures = {'spark-ai': sparkFixtures, 'new-ai': newFixtures};
const root = path.resolve(__dirname, '..');
const built = path.resolve(process.argv[2]);
const destination = path.resolve(process.argv[3]);
const archive = path.join(built, 'resources/app.asar');
const readArchive = filename => asar.extractFile(archive, path.normalize(filename));
const executable = path.join(built, 'EST Studio.exe');
const expectedVersion = require('../package.json').version;
const hash = file => createHash('sha256').update(fs.readFileSync(file))
    .digest('hex');
const files = directory => fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    assert.ok(!entry.isSymbolicLink(), `Unexpected resource link: ${filename}`);
    return entry.isDirectory() ? files(filename) : [filename];
});
const run = (command, args, cwd) => {
    const child = spawnSync(command, args, {cwd,
        windowsHide: true,
        encoding: 'utf8',
        timeout: 30000,
        maxBuffer: 2 * 1024 * 1024,
        env: {...process.env, ELECTRON_RUN_AS_NODE: '1', NODE_OPTIONS: ''}});
    assert.ifError(child.error);
    assert.strictEqual(child.status, 0, `${path.basename(command)} failed: ${child.stderr || child.stdout}`);
    return child.stdout.trim();
};

(async () => {
    assert.strictEqual(readPeArch(executable).arch, 'x64');
    const metadata = JSON.parse(readArchive('package.json').toString('utf8'));
    assert.strictEqual(metadata.version, expectedVersion);
    const archiveFiles = asar.listPackage(archive).map(file => file.replace(/\\/g, '/').replace(/^\//, ''));
    assert.ok(archiveFiles.includes('index.html') && archiveFiles.includes('main.js'));
    const main = readArchive('main.js').toString('utf8');
    assert.ok(main.includes('est-input-compatibility-get'), 'Persistent input workaround missing');
    assert.ok(main.includes('HID device discovery timed out'), 'HID worker discovery missing');
    const renderers = archiveFiles.filter(file => file.endsWith('.js') && file !== 'main.js' &&
        !file.startsWith('node_modules/'));
    assert.ok(renderers.some(file => readArchive(file).includes('new-ai-colour-card-picker')),
        'Colour card fix missing from packaged renderer');
    const wasmCount = archiveFiles.filter(file => file.endsWith('.wasm')).length;
    assert.ok(wasmCount > 0, 'Bundled camera WASM assets missing');
    const resources = {};
    for (const name of ['est-firmware', 'spark-ai', 'new-ai', 'est-build-library']) {
        const source = path.join(root, 'resources', name);
        let count = 0;
        for (const file of files(source)) {
            const relative = path.relative(source, file);
            if (name === 'est-firmware' && /(?:^|[\\/])__pycache__(?:[\\/]|$)|\.pyc$/.test(relative)) continue;
            const target = path.join(built, 'resources', name, relative);
            assert.ok(fs.existsSync(target), `Missing resource: ${name}/${relative}`);
            assert.strictEqual(hash(target), hash(file), `Resource changed: ${name}/${relative}`);
            count++;
        }
        resources[name] = count;
    }
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'est-packed-check-'));
    try {
        const packagedResources = path.join(built, 'resources');
        const nativeFiles = files(path.join(packagedResources, 'app.asar.unpacked'));
        const hid = nativeFiles.find(file => /node-hid[\\/]build[\\/]Release[\\/]HID\.node$/.test(file));
        const serial = nativeFiles.find(file => /bindings-cpp[\\/]prebuilds[\\/]win32-x64[\\/].*\.node$/.test(file));
        assert.ok(hid && serial, 'Required x64 native modules must be unpacked');
        const probe = path.join(temporary, 'native-probe.cjs');
        fs.writeFileSync(probe, `const assert=require('assert');
const {Worker}=require('worker_threads');
require(process.argv[3]);
require(process.argv[2]);
const worker=new Worker("const {parentPort,workerData}=require('worker_threads');"+
    "const devices=require(workerData).devices(0x0483,0x5750);"+
    "parentPort.postMessage({count:devices.length,"+
    "filtered:devices.every(d=>d.vendorId===0x0483&&d.productId===0x5750)});",
    {eval:true,workerData:process.argv[2]});
const timer=setTimeout(()=>{process.exit(2);},10000);
worker.once('error',e=>{console.error(e.message);process.exit(1);});
worker.once('message',async result=>{
    clearTimeout(timer);assert.ok(result.filtered);await worker.terminate();
    console.log(JSON.stringify({electron:process.versions.electron,arch:process.arch,...result,
        serialNativeLoaded:true,deviceHandlesOpened:0,deviceCommandsSent:0}));});
`);
        const native = JSON.parse(run(executable, [probe, hid, serial], temporary));
        const compilation = {};
        for (const name of ['spark-ai', 'new-ai']) {
            const fixture = compilerFixtures[name][0];
            const directory = path.join(temporary, name);
            fs.mkdirSync(directory);
            fs.writeFileSync(path.join(directory, 'program.py'), fixture.source);
            const source = path.join(packagedResources, name);
            if (name === 'spark-ai') {
                run(executable, [path.join(source, 'compiler-worker.cjs'),
                    path.join(source, 'win32-x64/pika_bytecode_gen.node')], directory);
            } else {
                run(path.join(source, 'win32/pika-python.exe'), ['-c', 'program.py', '-o', 'program.py.o'], directory);
            }
            const bytecode = fs.readFileSync(path.join(directory, 'program.py.o'));
            assert.strictEqual(bytecode.toString('hex'), fixture.bytecodeHex, `${name} compiled fixture mismatch`);
            compilation[name] = {passed: true, bytes: bytecode.length, downloadedOrExecuted: false};
        }
        const report = {version: metadata.version,
            arch: 'x64',
            archiveSha256: hash(archive),
            resources,
            cameraWasmFiles: wasmCount,
            colourFixPresent: true,
            inputCompatibilityPresent: true,
            native,
            compilation,
            deviceCommandsSent: 0,
            installerNotExecuted: true};
        await fs.promises.writeFile(destination, JSON.stringify(report, null, 2), {flag: 'wx'});
        console.log(JSON.stringify(report, null, 2));
    } finally {
        assert.strictEqual(path.dirname(path.resolve(temporary)), path.resolve(os.tmpdir()));
        assert.ok(path.basename(temporary).startsWith('est-packed-check-'));
        fs.rmSync(temporary, {recursive: true, force: true});
    }
})().catch(error => {
    console.error(error); process.exitCode = 1;
});
