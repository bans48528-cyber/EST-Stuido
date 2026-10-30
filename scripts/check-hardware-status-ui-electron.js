// Reuse the editor's isolated mock-IPC host; never load the production main process.
const fs = require('fs');
const path = require('path');
const Module = require('module');
const {spawnSync} = require('child_process');
const electron = require('electron');
if (process.versions.electron) {
    const original = path.join(__dirname, 'check-est-locale-electron.js');
    const marker = "assert.ok(ready, 'editor must mount');";
    const source = fs.readFileSync(original, 'utf8');
    if (!source.includes(marker)) throw new Error('Missing mock editor host');
    const injected = source.replace(marker, `${marker}
        if (process.argv.includes('--discard-only')) {
            await require('./hardware-status-ui/discard')({evaluate,pause,window,output,
                respond: response => nativeMessageResponses.push(response),
                dialogs: () => nativeMessages,
                seedDrafts: () => {for (const id of ['est','spark-ai','new-ai'])
                    hardwareDrafts.set(id,{title:'old '+id,data:Buffer.from('old draft')});},
                draftCount: () => hardwareDrafts.size});
            clearTimeout(timeout); app.exit(0); return;
        }
        if (process.argv.includes('--est-wires-only')) {
            hardwareMockEnabled = true;
            await require('./hardware-status-ui/est-wires')({evaluate,pause,window,output});
            clearTimeout(timeout); app.exit(0); return;
        }
        await require('./hardware-status-ui/check')({evaluate, pause, window, output,
            captureEnabled: !process.argv.includes('--no-capture'),
            newStatus: newAiStatus,
            setNew: patch => setNewAiTestState(patch),
            setSpark: patch => {sparkState = {...sparkState, ...patch};
                window.webContents.send('spark-state-change', sparkState);},
            enableEst: () => {hardwareMockEnabled = true;},
            requests: () => ({newAi: newAiRequests, spark: sparkRequests})
        });
        await require('./hardware-status-ui/connections')({evaluate, pause, window, output,
            captureEnabled: !process.argv.includes('--no-capture'),
            setNew: patch => setNewAiTestState(patch),
            setSpark: patch => {sparkState = {...sparkState, ...patch};
                window.webContents.send('spark-state-change', sparkState);},
            bleScan: (id, state) => window.webContents.send(id+'-ble-scan-state', state),
            requests: () => ({newAi: newAiRequests, spark: sparkRequests, est: estConnectionRequests})
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
