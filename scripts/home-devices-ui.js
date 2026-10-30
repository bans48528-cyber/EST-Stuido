/* eslint-disable max-len */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

module.exports = async ({evaluate, pause, window, output, ipcMain, setBusy, selections, setStartup, unhandledRejections}) => {
    console.log('Home UI profile: '+output);
    const wait = async predicate => {
        for (let attempt = 0; attempt < 160; attempt++) {
            try { if (await evaluate(predicate)) return; } catch (error) { /* Wait for the fresh renderer to mount. */ }
            await pause(60);
        }
        throw Error('Homepage UI did not settle: '+predicate);
    };
    let preference = 'est';
    let startup = false;
    let chooseResult = null;
    const openedProjects = new Map();
    let task = null;
    let installed = false;
    let installs = 0;
    let resolveDownload;
    const rows = ['est', 'spark-ai', 'new-ai', null].map(id => ({hardwareId: id,
        hardwareName: id, path: `/mock/${id || 'unknown'}.atc`, name: `file-only-${id || 'unknown'}`, modifiedAt: new Date().toISOString()}));
    const handlers = {
        'est-home-set-hardware': (event, request) => {preference=request.hardwareId; return preference;},
        'est-home-get-startup-state': () => ({homeHardwareId: preference, hasInitialProject: startup}),
        'est-home-list-recent-projects': async () => rows.slice(),
        'est-home-open-project': (event, filename) => openedProjects.get(filename) || {path: filename, title: 'Broken', data: Buffer.from('invalid project')},
        'est-home-choose-project': () => chooseResult,
        'est-home-remember-project': () => true,
        'est-home-capture-thumbnail': () => null,
        'est-home-get-build-library-state': async (event, {hardwareId}) => {
            await pause(hardwareId === 'est' ? 200 : 15);
            return {hardwareId, installed: hardwareId === 'est' && installed,
                items: hardwareId === 'est' ? [{id: 'basic-01', category: 'basic', title: 'EST-only-guide'}] : [],
                thumbnails: {}, totalItemCount: hardwareId === 'est' ? 42 : 0,
                downloadActive: hardwareId === 'est' && Boolean(task), downloadProgress: hardwareId === 'est' ? task : null};
        },
        'est-home-download-build-library': async (event, {hardwareId}) => {
            assert.equal(hardwareId, 'est'); installs++; task={hardwareId, phase: 'downloading', percent: 37};
            event.sender.send('est-home-build-download-progress', task);
            await new Promise(resolve => {resolveDownload=resolve;});
            installed=true; task=null;
            event.sender.send('est-home-build-download-progress', {hardwareId, phase: 'complete', percent: 100});
            return {hardwareId, installed: true};
        }
    };
    for (const [channel, handler] of Object.entries(handlers)) {
        ipcMain.removeHandler(channel); ipcMain.handle(channel, handler);
    }
    const installFinders = async () => evaluate(`window.findHomeTestComponent = (method, matches = () => true) => {
        for (const element of document.querySelectorAll('div')) {
            let fiber=element[Object.keys(element).find(key=>key.startsWith('__reactInternalInstance'))];
            for(;fiber;fiber=fiber.return) if(fiber.stateNode && typeof fiber.stateNode[method]==='function' && matches(fiber.stateNode)) return fiber.stateNode;
        }
        throw Error('Missing component: '+method);
    };
    window.findLocaleTestBlocks=()=>findHomeTestComponent('setLocale', instance=>Boolean(instance.ScratchBlocks && instance.workspace));
    window.homeTestApp=()=>findHomeTestComponent('handleHomeHardwareChange');
    window.homeTestPage=()=>findHomeTestComponent('loadRecentFiles');
    window.homeTestGui=()=>findHomeTestComponent('homeProjectCanReplaceCurrent');
    window.homeTestVm=()=>findHomeTestComponent('homeProjectCanReplaceCurrent').props.vm;
    window.homeTestAllowReplace=true;
    homeTestGui().handleShowMessageBox=()=>window.homeTestAllowReplace;
    void 0;`);
    await installFinders();
    const showHome = async () => {
        await evaluate("window.dispatchEvent(new CustomEvent('est-show-home'))");
        await wait('Boolean(document.querySelector("#atc-home-hardware"))');
        await evaluate("homeTestPage().setState({activeView:'files'})");
        await pause(100);
    };
    const choose = async id => {
        await evaluate(`(() => {document.querySelector('#atc-home-hardware').click();
            document.querySelector('[data-home-hardware="'+${JSON.stringify(id)}+'"]').click();})()`);
        await wait(`homeTestApp().state.homeHardwareId===${JSON.stringify(id)}`);
    };
    const metadata = () => evaluate(`({hardwareId:homeTestVm().runtime.estStudioHardwareId,
        meta:JSON.parse(homeTestVm().toJSON()).meta.estStudio.hardwareId,
        blocks:findLocaleTestBlocks().workspace.getAllBlocks().filter(b=>!b.isShadow()).map(b=>b.type)})`);
    await showHome();
    assert.equal(await evaluate("document.querySelector('#atc-home-hardware').tagName"), 'BUTTON');
    await pause(250);
    fs.writeFileSync(path.join(output,'home-picker-closed.png'),(await window.webContents.capturePage()).toPNG());
    await evaluate("document.querySelector('#atc-home-hardware').click()");
    await wait("document.querySelectorAll('#atc-home-hardware-options [role=option]').length===3");
    await wait("Array.from(document.querySelectorAll('#atc-home-hardware-options img')).every(img=>img.complete && img.naturalWidth>0)");
    await evaluate("Promise.all(Array.from(document.querySelectorAll('#atc-home-hardware-options img')).map(img=>img.decode()))");
    window.webContents.invalidate();
    await pause(650);
    fs.writeFileSync(path.join(output,'home-picker-detail.png'),(await window.webContents.capturePage({x:0,y:0,width:450,height:320})).toPNG());
    assert.equal(await evaluate("document.activeElement.getAttribute('aria-selected')"),'true');
    for (const width of [1280,800]) {
        window.setSize(width,860); await pause(200);
        const bounds=await evaluate(`(() => {
            const menu=document.querySelector('#atc-home-hardware-options').parentElement.getBoundingClientRect();
            return {left:menu.left,right:menu.right,bottom:menu.bottom,width:innerWidth,height:innerHeight};
        })()`);
        assert.ok(bounds.left>=0 && bounds.right<=bounds.width && bounds.bottom<=bounds.height,
            'picker must stay inside the window: '+JSON.stringify(bounds));
        fs.writeFileSync(path.join(output,'home-picker-open-'+width+'.png'),(await window.webContents.capturePage()).toPNG());
    }
    window.setSize(1280,860);
    await evaluate("document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}))");
    assert.equal(await evaluate("document.activeElement.dataset.homeHardware"),'new-ai');
    await evaluate("document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
    await wait("document.querySelector('#atc-home-hardware').getAttribute('aria-expanded')==='false'");
    assert.equal(await evaluate('document.activeElement.id'),'atc-home-hardware');
    await evaluate("document.querySelector('#atc-home-hardware').click(); document.querySelector('main').dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));");
    await wait("!document.querySelector('#atc-home-hardware-options')");
    await evaluate(`homeTestVm().runtime.getTargetForStage().createVariable('home-unsaved','home-unsaved','');
        homeTestVm().runtime.getTargetForStage().variables['home-unsaved'].value=1030; void 0;`);
    await pause(100);
    const beforeBrowse = await evaluate('homeTestVm().toJSON()');
    const beforeSelections = selections.length;
    setBusy(true);
    for (const id of ['spark-ai','new-ai','est','new-ai']) await choose(id);
    await pause(350);
    assert.equal(await evaluate('homeTestVm().toJSON()'), beforeBrowse);
    assert.equal(selections.length, beforeSelections, 'browsing never calls hardware-select, even while busy');
    assert.equal(preference,'new-ai');
    assert.equal(await evaluate('homeTestPage().state.buildItems.length'),0,'old EST response cannot cover NEW AI');
    setBusy(false);
    console.log('Compiled UI: rapid browsing leaves the unsaved VM and runtime selection unchanged.');

    for (const id of ['est','spark-ai','new-ai']) {
        await choose(id); await pause(260);
        const names = await evaluate(`Array.from(document.querySelectorAll('[class*="fileCard"]')).map(el=>el.textContent)`);
        assert.equal(names.length,1); assert.ok(names[0].includes('file-only-'+id));
        fs.writeFileSync(path.join(output,'home-files-'+id+'.png'),(await window.webContents.capturePage()).toPNG());
        await evaluate("homeTestPage().setState({activeView:'more'})");
        await pause(450);
        assert.equal(await evaluate(`document.querySelectorAll('[class*="moreProducts"]').length`),0);
        fs.writeFileSync(path.join(output,'home-guides-'+id+'.png'),(await window.webContents.capturePage()).toPNG());
        await evaluate("homeTestPage().openInfoDialog('hardware')");
        await pause(100);
        assert.ok(await evaluate(`document.querySelector('[role=dialog] h2').textContent.includes(${JSON.stringify(id==='est'?'EST':id==='spark-ai'?'Spark AI':'NEW AI')})`));
        await choose(id==='est'?'spark-ai':'est');
        await wait('homeTestPage().state.dialogId===null');
        await choose(id);
        await evaluate("homeTestPage().setState({activeView:'build'})"); await pause(260);
        if (id!=='est') assert.ok(await evaluate("document.body.textContent.includes('暂无搭建图')"));
        fs.writeFileSync(path.join(output,'home-'+id+'.png'),(await window.webContents.capturePage()).toPNG());
        await evaluate("homeTestPage().setState({activeView:'files'})");
    }
    await choose('est');
    await evaluate("homeTestPage().setState({activeView:'build'}); homeTestPage().downloadBuildLibrary(); void 0;");
    await wait('homeTestPage().state.buildDownloadActive');
    await choose('spark-ai'); await pause(250);
    assert.equal(await evaluate('homeTestPage().state.buildDownloadActive'),false);
    window.webContents.send('est-home-build-download-progress',{hardwareId:'est',phase:'downloading',percent:65});
    await pause(80); assert.equal(await evaluate('homeTestPage().state.buildDownloadActive'),false);
    await choose('est'); await pause(260);
    assert.equal(await evaluate('homeTestPage().state.buildDownloadProgress.percent'),37);
    assert.equal(installs,1,'switching back attaches to the existing task');
    await choose('new-ai'); resolveDownload(); await pause(250);
    assert.equal(await evaluate('homeTestPage().state.buildDownloadActive'),false);
    await choose('est'); await pause(260);
    assert.equal(await evaluate('homeTestPage().state.buildLibraryInstalled'),true);
    assert.equal(installs,1);
    console.log('Compiled UI: fixed-owner build download survives switching without duplicate tasks or leaked progress.');

    await choose('spark-ai');
    await evaluate('homeTestPage().startNewProject()');
    await wait("homeTestVm().runtime.estStudioHardwareId==='spark-ai' && !homeTestApp().state.homeVisible");
    assert.deepEqual((await metadata()).blocks,['spark_event_whenflagclicked']);
    assert.equal((await metadata()).meta,'spark-ai');
    await evaluate("homeTestVm().runtime.getTargetForStage().createVariable('discard-me','discard-me',''); void 0;");
    await showHome(); await choose('new-ai');
    assert.ok(await evaluate("document.body.textContent.includes('返回 Spark AI 工程')"));
    await evaluate('homeTestApp().handleReturnToEditor()');
    await wait('!homeTestApp().state.homeMounted');
    await evaluate("findHomeTestComponent('handleClickNew').handleClickNew()");
    await wait("homeTestVm().runtime.estStudioHardwareId==='spark-ai' && !homeTestVm().runtime.getTargetForStage().variables['discard-me']");
    assert.deepEqual((await metadata()).blocks,['spark_event_whenflagclicked']);
    console.log('Compiled UI: home creates Spark directly; File → New clears the current device without another chooser.');

    await evaluate("homeTestVm().runtime.getTargetForStage().createVariable('preserve-me','preserve-me',''); void 0;");
    await pause(80);
    const original = await evaluate('homeTestVm().toJSON()');
    await showHome(); await choose('new-ai');
    await evaluate('homeTestAllowReplace=false; homeTestPage().startNewProject()'); await pause(150);
    assert.equal(await evaluate('homeTestVm().toJSON()'), original);
    assert.equal(await evaluate('homeTestApp().state.projectHardwareId'),'spark-ai');
    const selectionBeforeBusy=selections.length;
    setBusy(true); await evaluate('homeTestAllowReplace=true; homeTestPage().startNewProject()'); await pause(180);
    assert.equal(selections.length, selectionBeforeBusy); assert.equal(await evaluate('homeTestVm().toJSON()'),original);
    setBusy(false);
    await evaluate(`window.homeTestDeserialize=homeTestVm().deserializeHardwareProject;
        window.homeTestFailNext=true;
        homeTestVm().deserializeHardwareProject=function(...args){
            return homeTestDeserialize.apply(this,args).then(value=>{
                if(homeTestFailNext){homeTestFailNext=false;throw Error('Injected deserialize failure');} return value;
            });
        };
        homeTestPage().startNewProject(); void 0;`);
    await wait("!homeTestGui().hardwareSwitchInProgress && !homeTestFailNext");
    assert.equal(await evaluate('homeTestVm().toJSON()'),original,'failed new restores full project');
    assert.equal((await metadata()).hardwareId,'spark-ai'); assert.equal((await metadata()).meta,'spark-ai');
    await evaluate('homeTestVm().deserializeHardwareProject=homeTestDeserialize; homeTestPage().startNewProject()');
    await wait("homeTestVm().runtime.estStudioHardwareId==='new-ai' && !homeTestApp().state.homeVisible");
    await evaluate(`homeTestVm().runtime.getTargetForStage().createVariable('file-marker','file-marker','');
        homeTestVm().runtime.getTargetForStage().variables['file-marker'].value=321; void 0;`);
    const data = Buffer.from(await evaluate('(async()=>Array.from(new Uint8Array(await (await homeTestVm().saveProjectSb3()).arrayBuffer())))()'));
    const newFile={path:'/mock/new-ai.atc',title:'NEW AI file',data};
    openedProjects.set(newFile.path,newFile);
    await showHome(); await choose('est');
    await evaluate(`homeTestPage().openRecentProject('/mock/new-ai.atc')`);
    await wait("!homeTestApp().state.homeVisible && homeTestApp().state.homeHardwareId==='new-ai'");
    assert.equal(await evaluate("homeTestVm().runtime.getTargetForStage().variables['file-marker'].value"),321);
    await showHome(); await choose('spark-ai');
    const originalOpen=await evaluate('homeTestVm().toJSON()');
    chooseResult=null; await evaluate('homeTestPage().openRecentProject()');
    assert.equal(await evaluate('homeTestApp().state.homeHardwareId'),'spark-ai');
    await evaluate("homeTestPage().openRecentProject('/mock/broken.atc')");
    await wait('!homeTestGui().homeProjectLoadInProgress');
    assert.equal(await evaluate('homeTestVm().toJSON()'),originalOpen);
    assert.equal(await evaluate('homeTestApp().state.homeHardwareId'),'spark-ai');
    chooseResult=newFile; await evaluate('homeTestPage().openRecentProject()');
    await wait("!homeTestApp().state.homeVisible && homeTestApp().state.homeHardwareId==='new-ai'");
    await showHome(); await choose('spark-ai'); await evaluate('homeTestPage().startNewProject()');
    await wait("homeTestVm().runtime.estStudioHardwareId==='spark-ai' && !homeTestApp().state.homeVisible");
    await showHome(); await choose('est');
    const beforePartialOpen=await evaluate('homeTestVm().toJSON()');
    await evaluate(`homeTestFailNext=true;
        homeTestDeserialize=homeTestVm().deserializeHardwareProject;
        homeTestVm().deserializeHardwareProject=function(...args){return homeTestDeserialize.apply(this,args).then(value=>{
            if(homeTestFailNext){homeTestFailNext=false;throw Error('Injected file load failure');} return value;
        });};
        homeTestPage().openRecentProject('/mock/new-ai.atc'); void 0;`);
    await wait('!homeTestGui().homeProjectLoadInProgress && !homeTestFailNext');
    assert.equal(await evaluate('homeTestVm().toJSON()'),beforePartialOpen,'partial file deserialize failure restores the old VM');
    assert.equal((await metadata()).meta,'spark-ai');
    assert.equal(await evaluate('homeTestApp().state.homeHardwareId'),'est');
    await evaluate('homeTestVm().deserializeHardwareProject=homeTestDeserialize; homeTestApp().handleReturnToEditor()');
    await wait('!homeTestApp().state.homeMounted');
    await evaluate(`window.homeTestNativeInput=HTMLInputElement.prototype.click;
        HTMLInputElement.prototype.click=function(){if(this.type!=='file') return homeTestNativeInput.call(this);};
        window.homeTestUploader=findHomeTestComponent('getProjectTitleFromFilename');
        homeTestUploader.createFileObjects(); HTMLInputElement.prototype.click=homeTestNativeInput;
        homeTestUploader.props={...homeTestUploader.props,onShowMessageBox:()=>true};
        homeTestUploader.handleChange({target:{files:[new File([Uint8Array.from(${JSON.stringify(Array.from(data))})],'NEW-AI-menu.atc')]}}); void 0;`);
    await wait("homeTestApp().state.homeHardwareId==='new-ai' && homeTestApp().state.projectHardwareId==='new-ai'");
    assert.equal(await evaluate("homeTestVm().runtime.getTargetForStage().variables['file-marker'].value"),321);
    console.log('Compiled UI: cancel/busy/new failure/open failure preserve the project; file metadata overrides home browsing.');

    // A cold renderer recreates the homepage, with its separate preference still held by the main process.
    await showHome(); await choose('spark-ai');
    await evaluate('window.onbeforeunload=null; void 0;');
    await window.reload(); await pause(900);
    await wait('Boolean(document.querySelector("#atc-home-hardware"))');
    await installFinders();
    await wait("homeTestApp().state.homeSelectionReady && homeTestApp().state.homeHardwareId==='spark-ai'");
    assert.equal((await metadata()).hardwareId,'new-ai','restoring browsing preference does not select runtime hardware');
    preference='est'; startup=true; setStartup(Uint8Array.from(data));
    await evaluate('window.onbeforeunload=null; void 0;');
    await window.reload(); await pause(900);
    await installFinders();
    await wait("homeTestApp().state.homeHardwareId==='new-ai' && !homeTestApp().state.homeVisible");
    assert.equal(await evaluate("homeTestVm().runtime.getTargetForStage().variables['file-marker'].value"),321);
    assert.equal(preference,'new-ai');
    assert.deepEqual(unhandledRejections,[]);
    fs.writeFileSync(path.join(output,'home-device-validation.json'),JSON.stringify({passed:true,
        browsingIsolated:true, perDeviceFiles:true, buildDownloadIsolated:true, newProjectAndCancel:true,
        failureRollback:true, startupFilePriority:true, realHardwareCommands:0},null,2));
    console.log('Homepage compiled UI passed. Screenshots and evidence: '+output);
};
