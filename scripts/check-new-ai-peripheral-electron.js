// Run the real renderer against mock IPC, never the product main process or real devices.
const fs = require('fs');
const path = require('path');
const Module = require('module');
const {spawnSync} = require('child_process');
const electron = require('electron');
if (process.versions.electron) {
    const original = path.join(__dirname, 'check-est-locale-electron.js');
    let source = fs.readFileSync(original, 'utf8');
    source = source.replace("let selectedHardware = 'est';", "let selectedHardware = 'new-ai';\nlet finishPeripheral;");
    const handler = `
        'new-ai-peripheral-update': async (event, request) => {
            assert.equal(selectedHardware, 'new-ai');
            assert.equal(request.confirmed, true);
            newAiRequests.push({action:'peripheral', ...request});
            setNewAiState({busy:true, peripheralUpdate:{active:true, phase:'updating',
                targets:request.targets, completed:0}});
            const failure = await new Promise(resolve => {finishPeripheral = resolve;});
            if (failure) {
                const status = JSON.parse(JSON.stringify(newAiState.status));
                status.ports[0].values.version = request.targets[0].target;
                setNewAiState({busy:false, status, peripheralUpdate:{active:false, phase:'error',
                    error:'NEW_PERIPHERAL_UNCONFIRMED'}});
                throw new Error('NEW_PERIPHERAL_UNCONFIRMED');
            }
            const status = JSON.parse(JSON.stringify(newAiState.status));
            status.ports.forEach(port=>{
                const target = request.targets.find(item=>item.port===port.port);
                if(target) port.values.version = target.target;
            });
            setNewAiState({busy:false, status, peripheralUpdate:{active:false, phase:'complete',
                completed:request.targets.length, targets:request.targets}});
            return {versionMatched:true};
        },
    `;
    const insertion = "        'new-ai-firmware-inspect':";
    if (!source.includes(insertion)) throw Error('Missing mock IPC anchor');
    source = source.replace(insertion, handler + insertion);
    // Expose only the existing isolated mock state emitter to the inserted handler.
    source = source.replace('let finishPeripheral;', `let finishPeripheral;
    const setNewAiState = patch => {newAiState = {...newAiState, ...patch};
        if (testWindow) testWindow.webContents.send('new-ai-state-change', newAiState);};
    let testWindow;`);
    source = source.replace('remote.enable(window.webContents);',
        'testWindow = window; remote.enable(window.webContents);');
    const marker = "assert.ok(ready, 'editor must mount');";
    if (!source.includes(marker)) throw Error('Missing isolated renderer anchor');
    source = source.replace(marker, `${marker}
        await require('./new-ai-peripheral-ui')({evaluate,pause,window,output,
            defaultStatus:newAiStatus,setDevice:patch=>setNewAiTestState(patch),
            requests:()=>newAiRequests,finish:failure=>finishPeripheral(failure)});
        clearTimeout(timeout);app.exit(0);return;`);
    const test = new Module(original, module);
    test.filename = original; test.paths = Module._nodeModulePaths(__dirname);
    test._compile(source, original);
} else {
    const result = spawnSync(electron, [__filename], {
        windowsHide: true, stdio: 'inherit', env: {...process.env, NODE_OPTIONS: ''}
    });
    process.exitCode = result.status === null ? 1 : result.status;
}
