// Local development diagnostics and explicit draft recovery. Timing reports never record chat text or device commands.
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const WebSocket = require('webpack-dev-server/node_modules/ws');
const root = path.resolve(__dirname, '..');
const version = require('../package.json').version;
const destination = process.argv[2];
assert.ok(destination, 'Supply a fresh output JSON path');
const draftMode = process.argv.includes('--preserve-draft') ? 'preserve' :
    (process.argv.includes('--restore-draft') ? 'restore' : null);
const restartDraftIndex = process.argv.indexOf('--restart-draft');
const restartDraftPath = restartDraftIndex < 0 ? null : path.resolve(process.argv[restartDraftIndex + 1]);
const traceEnabled = process.argv.includes('--trace');
const inputEnvironment = process.argv.includes('--input-environment');
const disableSpelling = process.argv.includes('--disable-spelling');
const nativeProbe = process.argv.includes('--native-probe');
const physicalInput = process.argv.includes('--physical-input');
const armPhysicalInput = process.argv.includes('--arm-physical-input');
const readPhysicalInput = process.argv.includes('--read-physical-input');
const temporaryAccessibilityOff = process.argv.includes('--temporary-accessibility-off');
const idleOnly = process.argv.includes('--idle-only');
const hidCost = process.argv.includes('--hid-cost');
const observeHid = process.argv.includes('--observe-hid');
const workerHidProbe = process.argv.includes('--worker-hid-probe');
const mainProfile = process.argv.includes('--main-profile');
const nativeTrace = process.argv.includes('--native-trace');
const inputCompatibilityStatus = process.argv.includes('--input-compatibility-status');
const saveInputCompatibility = process.argv.includes('--save-input-compatibility');
const draftAction = `(async () => {
    const key = 'est-ai-development-refresh';
    const findPanel = () => {
        for (const element of document.querySelectorAll('body *')) {
            const name = Object.keys(element).find(k => k.startsWith('__reactFiber$') ||
                k.startsWith('__reactInternalInstance$'));
            if (!name) continue;
            let root = element[name]; while (root.return) root = root.return;
            if(root.stateNode&&root.stateNode.current)root=root.stateNode.current;
            const pending = [root], seen = new Set();
            let panel;
            while (pending.length) {
                const fiber = pending.pop(); if (seen.has(fiber)) continue; seen.add(fiber);
                const p = fiber.stateNode;
                if (p && p.composer && p.history && typeof p.handleSend === 'function') panel=p;
                if(p&&p.props&&p.props.vm&&typeof p.props.vm.saveProjectSb3==='function') {
                    window.__estRestartVm=p.props.vm;
                }
                if(p&&typeof p.handleSetTitleFromSave==='function')window.__estRestartTitleOwner=p;
                if(p&&p.props&&typeof p.props.projectTitle==='string')window.__estRestartTitle=p.props.projectTitle;
                if (fiber.child) pending.push(fiber.child); if (fiber.sibling) pending.push(fiber.sibling);
            }
            if(panel)return panel;
            break;
        }
        throw Error('Assistant component unavailable');
    };
    let panel = findPanel();
    if (${JSON.stringify(draftMode)} === 'preserve') {
        const capture = () => {
            if (panel.state.busy || panel.state.settingsOpen) throw Error('Wait until the request/settings are closed');
            sessionStorage.setItem(key, JSON.stringify({hardwareId:panel.hardwareId,
                state:{messages:panel.state.messages, input:panel.state.input,
                    position:panel.state.position, isOpen:panel.state.isOpen}}));
        };
        capture(); window.addEventListener('beforeunload', capture, {once:true});
        return {draftPreserved:true, contentsLogged:false};
    }
    const saved = JSON.parse(sessionStorage.getItem(key));
    if (!saved || saved.hardwareId !== panel.hardwareId) throw Error('No draft for current hardware');
    if(saved.projectBase64) {
        if(!window.__estRestartVm)throw Error('Workspace VM unavailable');
        await window.__estRestartVm.loadProject(Buffer.from(saved.projectBase64,'base64'));
        panel=findPanel();
        if(window.__estRestartTitleOwner&&saved.projectTitle) {
            window.__estRestartTitleOwner.handleSetTitleFromSave(null,{title:saved.projectTitle});
        }
    }
    await new Promise(resolve => panel.setState(saved.state, resolve));
    sessionStorage.removeItem(key); panel.focusComposer();
    delete window.__estRestartVm;delete window.__estRestartTitleOwner;delete window.__estRestartTitle;
    return {draftRestored:true, contentsLogged:false};
})()`;
const rendererSummary = `({
    assistantOpen: !!document.querySelector('[role="dialog"] textarea[maxlength="4000"]'),
    previewImages: document.querySelectorAll('[role="dialog"] article img').length,
    messageCount: document.querySelectorAll('[role="dialog"] article').length,
    isolatedComposerMeasure: !!document.querySelector('[role="dialog"] textarea[aria-hidden="true"]'),
    focusedInput: document.activeElement && document.activeElement.tagName === 'TEXTAREA'
})`;
const expression = `(async () => {
    if (process.cwd().toLowerCase() !== ${JSON.stringify(root.toLowerCase())}) throw Error('Unexpected workspace');
    const {app, BrowserWindow} = process.mainModule.require('electron');
    const title = ${JSON.stringify(`ATC CodeStudio ${version}`)};
    const windows = BrowserWindow.getAllWindows().filter(w => w.getTitle() === title);
    if (windows.length !== 1) throw Error('Expected one current development window');
    const contents = windows[0].webContents, debug = contents.debugger;
    if (${inputCompatibilityStatus} || ${saveInputCompatibility}) {
        const channel=${JSON.stringify(saveInputCompatibility ? 'est-input-compatibility-set' :
        'est-input-compatibility-get')};
        const status=await contents.executeJavaScript(
            'require("electron").ipcRenderer.invoke('+JSON.stringify(channel)+', '+
            JSON.stringify({enabled:true,notify:false})+')');
        if(!status||!status.available)throw Error('Input compatibility settings unavailable');
        return {status,persistRequested:${saveInputCompatibility},
            temporaryArgumentPresent:process.argv.some(a=>/^--(?:est-input-compatibility|disable-renderer-accessibility)(?:=|$)/.test(a)),
            noTextRecorded:true,deviceCommandsSent:0};
    }
    if (${nativeTrace}) {
        const {contentTracing}=process.mainModule.require('electron');
        const tracePath=process.mainModule.require('path').join(app.getPath('temp'),
            'est-native-trace-'+Date.now()+'.json');
        await contentTracing.startRecording({included_categories:['toplevel','ipc','input','base','ui',
            'devtools.timeline','disabled-by-default-toplevel.flow']});
        await new Promise(resolve=>setTimeout(resolve,10000));
        await contentTracing.stopRecording(tracePath);
        const fs=process.mainModule.require('fs');
        const data=JSON.parse(await fs.promises.readFile(tracePath,'utf8'));
        await fs.promises.unlink(tracePath);
        const names=new Map(),processes=new Map();
        for(const e of data.traceEvents||[])if(e.ph==='M') {
            if(e.name==='thread_name')names.set(e.pid+':'+e.tid,e.args.name);
            if(e.name==='process_name')processes.set(e.pid,e.args.name);
        }
        const rows=[];
        for(const e of data.traceEvents||[])if(e.ph==='X'&&e.dur>=20000)rows.push({
            process:processes.get(e.pid)||String(e.pid),thread:names.get(e.pid+':'+e.tid)||String(e.tid),
            name:e.name,category:e.cat,atMs:e.ts/1000,durationMs:e.dur/1000});
        return {nativeTrace:true,intervalMs:10000,rawTraceRemoved:true,
            longTasks:rows.sort((a,b)=>b.durationMs-a.durationMs).slice(0,100),
            noTextRecorded:true,deviceCommandsSent:0};
    }
    if (${mainProfile}) {
        const session=new (process.mainModule.require('inspector').Session)();session.connect();
        const send=(method,params={})=>new Promise((resolve,reject)=>
            session.post(method,params,(error,result)=>error?reject(error):resolve(result)));
        const histogram=process.mainModule.require('perf_hooks').monitorEventLoopDelay({resolution:10});
        const spikes=[];let previous=process.hrtime.bigint();
        const timer=setInterval(()=>{const now=process.hrtime.bigint();
            const elapsedMs=Number(now-previous)/1e6;previous=now;
            if(elapsedMs>50)spikes.push({atMs:Number(now-start)/1e6,elapsedMs});},10);
        const start=process.hrtime.bigint(),cpuBefore=process.cpuUsage();
        try {
            await send('Profiler.enable');await send('Profiler.setSamplingInterval',{interval:10000});
            await send('Profiler.start');histogram.enable();
            await new Promise(resolve=>setTimeout(resolve,10000));
            const {profile}=await send('Profiler.stop');
            const cpu=process.cpuUsage(cpuBefore),nodes=new Map(profile.nodes.map(n=>[n.id,n]));
            const hits=new Map(),parents=new Map();
            for(const n of nodes.values())for(const child of n.children||[])parents.set(child,n.id);
            for(let i=0;i<(profile.samples||[]).length;i++) {
                const id=profile.samples[i],old=hits.get(id)||{count:0,ms:0};
                old.count++;old.ms+=(profile.timeDeltas[i]||0)/1000;hits.set(id,old);
            }
            const frame=id=>{const f=nodes.get(id).callFrame;
                return {function:f.functionName,url:f.url,line:f.lineNumber+1};};
            const hot=[...hits].sort((a,b)=>b[1].ms-a[1].ms).slice(0,25).map(([id,hit])=>{
                const callers=[];let parent=parents.get(id);
                while(parent&&callers.length<6){callers.push(frame(parent));parent=parents.get(parent);}
                return {...frame(id),...hit,callers};});
            return {mainProcess:true,samplingIntervalUs:10000,intervalMs:Number(process.hrtime.bigint()-start)/1e6,
                cpu,spikes,mainLoopP95Ms:histogram.percentile(95)/1e6,mainLoopMaxMs:histogram.max/1e6,
                hot,deviceCommandsSent:0,noTextRecorded:true};
        } finally {clearInterval(timer);histogram.disable();session.disconnect();}
    }
    if (${workerHidProbe}) {
        const samples=[];
        for(let index=0;index<3;index++) {
            const start=process.hrtime.bigint();
            const devices=await contents.executeJavaScript(
                'require("electron").ipcRenderer.invoke("est-list-devices")');
            samples.push({count:devices.length,elapsedMs:Number(process.hrtime.bigint()-start)/1e6,
                estIdsOnly:devices.every(d=>d.vendorId===0x0483&&d.productId===0x5750)});
        }
        return {realProductionIpc:true,channel:'est-list-devices',samples,deviceHandlesOpened:0,deviceCommandsSent:0};
    }
    if (${observeHid}) {
        const hid=process.mainModule.require('node-hid');
        const original=hid.devices,samples=[];
        const histogram=process.mainModule.require('perf_hooks').monitorEventLoopDelay({resolution:10});
        const wrapped=function(...args){const start=process.hrtime.bigint();
            try{return original.apply(this,args);}finally{
                samples.push({argumentCount:args.length,elapsedMs:Number(process.hrtime.bigint()-start)/1e6});
            }};
        hid.devices=wrapped;histogram.enable();
        try {
            await new Promise(resolve=>setTimeout(resolve,10000));
            return {normalBackgroundRequests:true,extraDeviceQueries:0,deviceCommandsSent:0,samples,
                mainLoopP95Ms:histogram.percentile(95)/1e6,mainLoopMaxMs:histogram.max/1e6};
        } finally {
            histogram.disable();if(hid.devices===wrapped)hid.devices=original;
        }
    }
    if (${hidCost}) {
        const hid=process.mainModule.require('node-hid'),samples=[];
        for(const filtered of [false,true,false,true]) {
            const start=process.hrtime.bigint();
            const devices=filtered?hid.devices(0x0483,0x5750):hid.devices();
            samples.push({filtered,count:devices.length,elapsedMs:Number(process.hrtime.bigint()-start)/1e6});
            await new Promise(resolve=>setTimeout(resolve,100));
        }
        return {readOnly:true,operation:'HID enumeration only',deviceCommandsSent:0,samples};
    }
    if (${idleOnly}) {
        const owned=!debug.isAttached(); if(owned)debug.attach('1.3');
        try {
            await debug.sendCommand('Performance.enable');
            const before=await debug.sendCommand('Performance.getMetrics');
            await new Promise(resolve=>setTimeout(resolve,1200));
            const after=await debug.sendCommand('Performance.getMetrics');
            const delta=Object.fromEntries(after.metrics.filter(m=>[
                'LayoutCount','RecalcStyleCount','LayoutDuration','RecalcStyleDuration','ScriptDuration','TaskDuration'
            ].includes(m.name)).map(m=>[m.name,m.value-before.metrics.find(b=>b.name===m.name).value]));
            const mascots=await contents.executeJavaScript(
                'Array.from(document.querySelectorAll("[data-est-mascot]")).map(e=>({' +
                'compact:e.dataset.compact,animated:e.dataset.animated,state:e.dataset.state,' +
                'rootAnimation:getComputedStyle(e).animationName}))');
            return {realDevelopmentWindow:true,intervalMs:1200,delta,mascots,
                cpuProfilerUsed:false,deviceCommandsSent:0,noTextRecorded:true};
        } finally {if(owned&&debug.isAttached())debug.detach();}
    }
    if (${temporaryAccessibilityOff}) {
        const before=app.isAccessibilitySupportEnabled();
        app.setAccessibilitySupportEnabled(false);
        setTimeout(()=>{app.setAccessibilitySupportEnabled(before);},90000);
        return {temporaryTest:true,accessibilityBefore:before,accessibilityNow:app.isAccessibilitySupportEnabled(),
            automaticallyRestoreSeconds:90,windowsSettingsChanged:false};
    }
    if (${armPhysicalInput}) {
        await contents.executeJavaScript('(function(){' +
            'if(window.__estInputSampler)window.__estInputSampler.stop();' +
            'const state={samples:[],started:false,done:false,noTextRecorded:true};' +
            'const events=["keydown","input","compositionstart","compositionupdate","compositionend"];' +
            'let finish;const stop=()=>{events.forEach(t=>document.removeEventListener(t,listen,true));' +
            'clearTimeout(finish);clearTimeout(deadline);state.done=true;};' +
            'const listen=e=>{if(!state.started){state.started=true;finish=setTimeout(stop,22000);}' +
            'if(state.samples.length>=300)return;const at=performance.now(),lag=at-e.timeStamp;' +
            'const s={type:e.type,trusted:e.isTrusted,deliveryMs:lag>=0&&lag<10000?lag:null};' +
            'state.samples.push(s);requestAnimationFrame(()=>s.paintMs=performance.now()-at);};' +
            'const deadline=setTimeout(stop,120000);events.forEach(t=>document.addEventListener(t,listen,true));' +
            'window.__estInputSampler={state,stop};return true;})()');
        return {armed:true,startsOnFirstActualInput:true,maximumWaitSeconds:120,noTextRecorded:true};
    }
    if (${readPhysicalInput}) return contents.executeJavaScript(
        'window.__estInputSampler?window.__estInputSampler.state:{notArmed:true}');
    if (${physicalInput}) {
        const deltas=[]; let last=Date.now(), nativeKeys=0;
        const timer=setInterval(()=>{const now=Date.now();deltas.push(now-last);last=now;},16);
        const keyListener=()=>{nativeKeys++;};
        contents.on('before-input-event',keyListener);
        try {
            const result=await contents.executeJavaScript(
                '(async()=>{const samples=[];const listen=e=>{if(samples.length>=300)return;' +
                'const at=performance.now(),lag=at-e.timeStamp;' +
                'const s={type:e.type,trusted:e.isTrusted,deliveryMs:lag>=0&&lag<10000?lag:null};' +
                'samples.push(s);requestAnimationFrame(()=>s.paintMs=performance.now()-at);};' +
                'const events=["keydown","input","compositionstart","compositionupdate","compositionend"];' +
                'events.forEach(t=>document.addEventListener(t,listen,true));' +
                'await new Promise(r=>setTimeout(r,22000));' +
                'events.forEach(t=>document.removeEventListener(t,listen,true));return {samples};})()');
            return {...result,nativeKeys,mainLoopMaxMs:Math.max(...deltas),durationMs:22000,
                noTextRecorded:true,deviceCommandsSent:0};
        } finally {
            clearInterval(timer);contents.removeListener('before-input-event',keyListener);
        }
    }
    if (${nativeProbe}) {
        const owned = !debug.isAttached(); if (!owned) throw Error('Another debugger owns the window');
        debug.attach('1.3');
        await contents.executeJavaScript(
            'window.__estInputFocus=document.activeElement;' +
            'window.__estInputProbe=document.createElement("textarea");' +
            'Object.assign(window.__estInputProbe.style,{position:"fixed",left:"30px",top:"90px",' +
            'width:"480px",height:"70px",zIndex:99999,background:"white"});' +
            'window.__estInputProbe.setAttribute("aria-label","EST 自动输入诊断");' +
            'document.body.appendChild(window.__estInputProbe);window.__estInputProbe.focus()');
        const results=[];
        const deltas=[]; let last=Date.now();
        const timer=setInterval(()=>{const now=Date.now();deltas.push(now-last);last=now;},16);
        try {
            for (const spellcheck of [true,false]) for (const kind of ['latin','composition']) {
                await contents.executeJavaScript('window.__estInputProbe.value="";' +
                    'window.__estInputProbe.spellcheck='+spellcheck);
                await new Promise(resolve=>setTimeout(resolve,200));
                const samples=[];
                for (let index=0;index<24;index++) {
                    const start=Date.now();
                    if (kind==='latin') {
                        await debug.sendCommand('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',
                            text:'a',unmodifiedText:'a',windowsVirtualKeyCode:65});
                        await debug.sendCommand('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',
                            windowsVirtualKeyCode:65});
                    } else await debug.sendCommand('Input.imeSetComposition',{
                        text:['n','ni','你','你好','你好吗'][index%5], selectionStart:0,selectionEnd:0});
                    samples.push(Date.now()-start);
                    await new Promise(resolve=>setTimeout(resolve,20));
                }
                if(kind==='composition')await debug.sendCommand('Input.insertText',{text:'你好'});
                results.push({kind,spellcheck,p95Ms:[...samples].sort((a,b)=>a-b)[22],maxMs:Math.max(...samples)});
            }
            return {nativeProbe:true,results,mainLoopMaxMs:Math.max(...deltas),deviceCommandsSent:0};
        } finally {
            clearInterval(timer);
            await contents.executeJavaScript('window.__estInputProbe.remove();' +
                'if(window.__estInputFocus&&window.__estInputFocus.isConnected)window.__estInputFocus.focus();' +
                'delete window.__estInputProbe;delete window.__estInputFocus');
            if(debug.isAttached())debug.detach();
        }
    }
    if (${inputEnvironment} || ${disableSpelling}) {
        const preferences = contents.getLastWebPreferences();
        const result = {electron:process.versions.electron, chrome:process.versions.chrome,
            os:process.mainModule.require('os').release(),
            accessibility:app.isAccessibilitySupportEnabled(), spellcheck:preferences.spellcheck,
            spellLanguages:contents.session.getSpellCheckerLanguages(), gpu:app.getGPUFeatureStatus()};
        if (${disableSpelling}) result.spellingDisabledInCurrentDocument = await contents.executeJavaScript(
            'document.documentElement.spellcheck=false;document.body.spellcheck=false;' +
            'document.querySelectorAll("input,textarea,[contenteditable]").forEach(e=>e.spellcheck=false);true');
        return result;
    }
    if (${JSON.stringify(restartDraftPath)} && ${JSON.stringify(draftMode)} === 'restore') {
        const fs = process.mainModule.require('fs'), safe = process.mainModule.require('electron').safeStorage;
        const saved = safe.decryptString(fs.readFileSync(${JSON.stringify(restartDraftPath)}));
        await contents.executeJavaScript('sessionStorage.setItem("est-ai-development-refresh",' +
            JSON.stringify(saved) + ')');
        await contents.executeJavaScript('window.dispatchEvent(new Event("est-home-project-opened"))');
        await new Promise(resolve => setTimeout(resolve, 500));
        const result = await contents.executeJavaScript(${JSON.stringify(draftAction)});
        fs.unlinkSync(${JSON.stringify(restartDraftPath)});
        return {...result, encryptedTemporaryDraftRemoved:true};
    }
    if (${JSON.stringify(restartDraftPath)} && ${JSON.stringify(draftMode)} === 'preserve') {
        const fs = process.mainModule.require('fs'), safe = process.mainModule.require('electron').safeStorage;
        if (!safe.isEncryptionAvailable()) throw Error('Cannot protect the temporary draft');
        await contents.executeJavaScript(${JSON.stringify(draftAction)});
        const saved = await contents.executeJavaScript('(async()=>{' +
            'const s=JSON.parse(sessionStorage.getItem("est-ai-development-refresh"));' +
            'if(!window.__estRestartVm)throw Error("Cannot preserve the current workspace");' +
            'const projectBytes=await(await window.__estRestartVm.saveProjectSb3()).arrayBuffer();' +
            's.projectBase64=Buffer.from(projectBytes).toString("base64");' +
            's.projectTitle=window.__estRestartTitle;return JSON.stringify(s);})()');
        fs.writeFileSync(${JSON.stringify(restartDraftPath)}, safe.encryptString(saved), {flag:'wx'});
        setTimeout(() => app.quit(), 250);
        return {draftPreserved:true, encrypted:true, contentsLogged:false, normalQuitRequested:true, pid:process.pid};
    }
    if (${JSON.stringify(draftMode)}) return contents.executeJavaScript(${JSON.stringify(draftAction)});
    const owned = !debug.isAttached();
    if (owned) debug.attach('1.3');
    app.getAppMetrics();
    const trace = [], names = new Map();
    let complete;
    const listener = (event, method, params) => {
        if (method === 'Tracing.dataCollected') for (const e of params.value) {
            if (e.ph === 'M' && e.name === 'thread_name') names.set(e.tid, e.args.name);
            if (e.ph === 'X' && e.dur > 0) trace.push({name:e.name,tid:e.tid,dur:e.dur});
        }
        if (method === 'Tracing.tracingComplete' && complete) complete();
    };
    try {
        if (${traceEnabled}) {
            if (!owned) throw Error('Another debugger owns the window');
            debug.on('message', listener);
            await debug.sendCommand('Tracing.start', {categories:'toplevel,devtools.timeline,blink,input,cc,v8',
                options:'record-continuously',transferMode:'ReportEvents'});
        }
        const ui = await contents.executeJavaScript(${JSON.stringify(rendererSummary)});
        await debug.sendCommand('Performance.enable');
        await debug.sendCommand('Profiler.enable');
        await debug.sendCommand('Profiler.start');
        const before = await debug.sendCommand('Performance.getMetrics');
        await new Promise(resolve => setTimeout(resolve, ${traceEnabled ? 12000 : 5000}));
        const after = await debug.sendCommand('Performance.getMetrics');
        const {profile} = await debug.sendCommand('Profiler.stop');
        if (${traceEnabled}) {
            const finished = new Promise(resolve => {complete=resolve;});
            await debug.sendCommand('Tracing.end'); await finished;
        }
        const delta = Object.fromEntries(after.metrics.map(m => [m.name, m.value -
            ((before.metrics.find(b => b.name === m.name) || {}).value || 0)]));
        const samples = profile.samples || [], nodes = new Map(profile.nodes.map(n => [n.id, n]));
        const hits = new Map();
        for (const id of samples) hits.set(id, (hits.get(id) || 0) + 1);
        const hot = [...hits].sort((a,b) => b[1]-a[1]).slice(0, 25).map(([id,count]) => {
            const n=nodes.get(id), f=n.callFrame;
            return {function:f.functionName, url:f.url, line:f.lineNumber+1,
                percent:Math.round(count/samples.length*1000)/10};
        });
        const groups = new Map();
        for (const e of trace) {
            const key = e.tid + ':' + e.name;
            const g = groups.get(key) || {thread:names.get(e.tid)||String(e.tid),event:e.name,ms:0,count:0,maxMs:0};
            g.ms+=e.dur/1000; g.count++; g.maxMs=Math.max(g.maxMs,e.dur/1000); groups.set(key,g);
        }
        const traceSummary = [...groups.values()].sort((a,b)=>b.ms-a.ms).slice(0,40);
        return {version:${JSON.stringify(version)}, readOnly:true, deviceCommandsSent:0, ui, delta, hot, traceSummary,
            processMetrics:app.getAppMetrics().map(p => ({type:p.type, cpu:p.cpu, memory:p.memory}))};
    } finally {
        debug.removeListener('message', listener);
        if (owned && debug.isAttached()) debug.detach();
    }
})()`;
const discover = () => new Promise((resolve, reject) => {
    const request = http.get('http://127.0.0.1:5858/json/list', response => {
        let body = '';
        response.on('data', bytes => {
            body += bytes;
        });
        response.on('end', () => {
            try {
                const target = JSON.parse(body).find(item => item.type === 'node');
                assert.ok(target && target.webSocketDebuggerUrl.startsWith('ws://127.0.0.1:5858/'));
                resolve(target.webSocketDebuggerUrl);
            } catch (error) {
                reject(error);
            }
        });
    });
    request.on('error', reject);
    request.setTimeout(3000, () => request.destroy(new Error('Development inspector unavailable')));
});
(async () => {
    const url = await discover();
    const report = await new Promise((resolve, reject) => {
        const socket = new WebSocket(url);
        const timer = setTimeout(() => {
            socket.close(); reject(new Error('Profiling timed out'));
        }, 30000);
        socket.on('error', error => {
            clearTimeout(timer); reject(error);
        });
        socket.on('open', () => socket.send(JSON.stringify({id: 1,
            method: 'Runtime.evaluate',
            params: {expression, awaitPromise: true, returnByValue: true}})));
        socket.on('message', bytes => {
            const message = JSON.parse(String(bytes));
            if (message.id !== 1) return;
            clearTimeout(timer); socket.close();
            if (message.error || message.result.exceptionDetails) {
                reject(new Error(JSON.stringify(message.error || message.result.exceptionDetails))); return;
            }
            resolve(message.result.result.value);
        });
    });
    fs.writeFileSync(path.resolve(destination), JSON.stringify(report, null, 2), {flag: 'wx'});
    console.log(JSON.stringify(report));
})().catch(error => {
    console.error(error.message); process.exitCode = 1;
});
