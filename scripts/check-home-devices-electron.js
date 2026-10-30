// Run the compiled app in the existing isolated Electron test host, without real devices.
const fs = require('fs');
const path = require('path');
const Module = require('module');
const {spawnSync} = require('child_process');
const electron = require('electron');
if (process.versions.electron) {
    const filename = path.join(__dirname, 'check-est-locale-electron.js');
    let source = fs.readFileSync(filename, 'utf8');
    const marker = "assert.ok(ready, 'editor must mount');";
    if (!source.includes(marker)) throw Error('Missing isolated editor host');
    source = source.replace("let selectedHardware = 'est';", "let selectedHardware = 'est'; let homeBusy = false; const homeSelections = [];")
        .replace("'hardware-state': () => ({hardwareId: selectedHardware, busy: false, running: false})",
            "'hardware-state': () => ({hardwareId: selectedHardware, busy: homeBusy, running: false})")
        .replace('selectedHardware = hardwareId;', 'selectedHardware = hardwareId; homeSelections.push(hardwareId);')
        .replace(marker, `${marker}
        await require('./home-devices-ui')({evaluate, pause, window, output, ipcMain,
            setBusy: value => {homeBusy=value;}, selections: homeSelections,
            setStartup: value => {startupProjectData=value;},
            dialogs: nativeMessages, unhandledRejections});
        clearTimeout(timeout); app.exit(0); return;`);
    const test = new Module(filename, module);
    test.filename = filename;
    test.paths = Module._nodeModulePaths(__dirname);
    test._compile(source, filename);
} else {
    const result = spawnSync(electron, [__filename], {
        windowsHide: true, stdio: 'inherit', env: {...process.env, NODE_OPTIONS: ''}
    });
    process.exitCode = result.status === null ? 1 : result.status;
}
