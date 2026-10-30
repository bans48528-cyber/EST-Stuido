// Reuse the isolated editor host. Firmware operations here are mock IPC, never real devices.
const fs = require('fs');
const path = require('path');
const Module = require('module');
const {spawnSync} = require('child_process');
const electron = require('electron');
if (process.versions.electron) {
    const original = path.join(__dirname, 'check-est-locale-electron.js');
    const marker = "assert.ok(ready, 'editor must mount');";
    let source = fs.readFileSync(original, 'utf8');
    if (!source.includes(marker)) throw new Error('Missing mock editor host');
    if (process.argv.includes('--dismiss-only')) {
        source = source.replace("let selectedHardware = 'est';", "let selectedHardware = 'spark-ai';");
        source = source.replace('const nativeMessages = [];', 'let finishFirmware;\nconst nativeMessages = [];');
        const delay = 'await new Promise(resolve => setTimeout(resolve, 350));';
        if (!source.includes(delay)) throw new Error('Missing firmware mock delay');
        source = source.replace(delay, 'await new Promise(resolve => {finishFirmware = resolve;});');
    }
    const injected = source.replace(marker, `${marker}
        if (process.argv.includes('--dismiss-only')) {
            const evidence=path.resolve(__dirname,'../tmp/spark-firmware-dismiss');
            fs.mkdirSync(evidence,{recursive:true});
            await require('./spark-firmware-ui/dismiss')({evaluate,pause,window,output:evidence,
                defaultStatus:sparkStatus,requests:()=>sparkRequests,
                setSpark:patch=>{sparkState={...sparkState,...patch};
                    window.webContents.send('spark-state-change',sparkState);},
                finish:()=>finishFirmware()});
            clearTimeout(timeout);app.exit(0);return;
        }
        await require('./spark-firmware-ui/check')({evaluate, pause, window, output,
            defaultStatus: sparkStatus, requests: () => sparkRequests,
            setSpark: patch => {sparkState = {...sparkState, ...patch};
                window.webContents.send('spark-state-change', sparkState);},
            resource: (valid, delay = 0) => {firmwareResourceValid = valid; firmwareInspectDelay = delay;}
        }); clearTimeout(timeout); app.exit(0); return;`);
    const test = new Module(original, module);
    test.filename = original;
    test.paths = Module._nodeModulePaths(__dirname);
    test._compile(injected, original);
} else {
    const result = spawnSync(electron, [__filename, ...process.argv.slice(2)], {
        windowsHide: true, stdio: 'inherit', env: {...process.env, NODE_OPTIONS: ''}
    });
    process.exitCode = result.status === null ? 1 : result.status;
}
