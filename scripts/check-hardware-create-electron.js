// Exercise the compiled application with mock hardware and an isolated profile.
const fs = require('fs');
const path = require('path');
const Module = require('module');
const {spawnSync} = require('child_process');
const electron = require('electron');
if (process.versions.electron) {
    const original = path.join(__dirname, 'check-est-locale-electron.js');
    const marker = "assert.ok(ready, 'editor must mount');";
    let source = fs.readFileSync(original, 'utf8');
    if (!source.includes(marker)) throw Error('Missing isolated editor host');
    source = source.replace(marker, `${marker}
        dialog.showMessageBoxSync = (parent, options) => {nativeMessages.push(options); return 0;};
        await require('./hardware-create-ui')({evaluate,pause,window,output,dialogs:()=>nativeMessages});
        clearTimeout(timeout); app.exit(0); return;`);
    const test = new Module(original, module);
    test.filename = original;
    test.paths = Module._nodeModulePaths(__dirname);
    test._compile(source, original);
} else {
    const result = spawnSync(electron, [__filename], {
        windowsHide: true, stdio: 'inherit', env: {...process.env, NODE_OPTIONS: ''}
    });
    process.exitCode = result.status === null ? 1 : result.status;
}
