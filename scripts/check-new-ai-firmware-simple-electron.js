// Isolated mock-IPC editor. Never loads the product main process or real hardware.
const fs = require('fs');
const path = require('path');
const Module = require('module');
const {spawnSync} = require('child_process');
const electron = require('electron');
if (process.versions.electron) {
    const original = path.join(__dirname, 'check-est-locale-electron.js');
    let source = fs.readFileSync(original, 'utf8');
    source = source.replace("let selectedHardware = 'est';", "let selectedHardware = 'new-ai';\nlet finishUpdate;");
    const legacyCheck = 'if (newAiState.status && newAiState.status.legacyProtocol) ' +
        'assert.equal(request.confirmedLegacyIdle, true);';
    source = source.replace(legacyCheck,
        "assert.equal('confirmedLegacyIdle' in request, false);");
    const marker = "assert.ok(ready, 'editor must mount');";
    if (!source.includes(marker)) throw Error('Missing isolated editor host');
    const delay = 'await new Promise(resolve => setTimeout(resolve, 300));';
    // Replace only the firmware handler's delay, leaving all unrelated mock operations untouched.
    const start = source.indexOf("'new-ai-firmware-update':");
    const position = source.indexOf(delay, start);
    if (position < 0) throw Error('Missing firmware mock delay');
    source = `${source.slice(0, position)}await new Promise(resolve => {finishUpdate = resolve;});${
        source.slice(position + delay.length)}`;
    source = source.replace(marker, `${marker}
        await require('./new-ai-firmware-simple-ui')({evaluate,pause,window,output,
            defaultStatus:newAiStatus,setDevice:patch=>setNewAiTestState(patch),
            requests:()=>newAiRequests,finish:()=>finishUpdate()});
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
