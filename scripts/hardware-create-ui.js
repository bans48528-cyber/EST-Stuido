/* eslint-disable max-len */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

module.exports = async ({evaluate, pause, window, output}) => {
    const wait = async predicate => {
        for (let attempt = 0; attempt < 120; attempt++) {
            if (await evaluate(predicate)) return;
            await pause(80);
        }
        throw Error(`New project UI did not settle: ${predicate}`);
    };
    await evaluate(`window.findCreateComponent=method=>{
        for(const element of document.querySelectorAll('div')) {
            let fiber=element[Object.keys(element).find(key=>key.startsWith('__reactInternalInstance'))];
            for(;fiber;fiber=fiber.return) if(fiber.stateNode&&typeof fiber.stateNode[method]==='function') return fiber.stateNode;
        } throw Error('Missing '+method);
    };
    window.allowNewProject=true; window.replacePrompts=0; window.savedDeviceProjects={};
    findCreateComponent('homeProjectCanReplaceCurrent').handleShowMessageBox=()=>{replacePrompts++;return allowNewProject;};
    window.createMeta=()=>JSON.parse(findLocaleTestBlocks().props.vm.toJSON()).meta.estStudio.hardwareId;
    window.createMarker=()=>findLocaleTestBlocks().props.vm.runtime.getTargetForStage().variables['create-marker'];
    window.dispatchEvent(new CustomEvent('est-show-home'));`);
    await pause(500);
    await evaluate("findCreateComponent('startNewProject').startNewProject()");
    await wait('Boolean(document.querySelector("[aria-labelledby=hardware-choice-title]"))');
    assert.ok((await evaluate('document.querySelector("#hardware-choice-title").textContent')).includes('新建程序'));
    assert.equal(await evaluate('Boolean(document.querySelector("#est-hardware-select"))'), false);
    await evaluate(`Promise.all([...document.querySelectorAll('[aria-labelledby=hardware-choice-title] img')].map(img=>img.decode()))`);
    await pause(400);
    assert.equal(await evaluate(`(()=>{const input=document.querySelector('input[name=hardware-choice]');
        const r=input.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===input;})()`), true,
    'device choice must be visible and clickable above the home page');
    fs.writeFileSync(path.join(output, 'new-project-device-choice.png'), (await window.webContents.capturePage()).toPNG());
    await evaluate('document.querySelector("[aria-labelledby=hardware-choice-title] header button").click()');
    assert.equal(await evaluate('createMeta()'), 'est');
    for (const id of ['spark-ai', 'new-ai', 'est']) {
        await evaluate("findCreateComponent('handleClickNew').handleClickNew()");
        await wait('Boolean(document.querySelector("input[name=hardware-choice]"))');
        await evaluate(`document.querySelector('input[value="${id}"][name=hardware-choice]').click();
            document.querySelector('[aria-labelledby=hardware-choice-title] footer button:last-child').click();`);
        await wait(`!document.querySelector('input[name=hardware-choice]') && createMeta()==='${id}'`);
        await pause(450);
        assert.equal(await evaluate('Boolean(document.querySelector("#est-hardware-select"))'), false);
        assert.equal(await evaluate('document.querySelector("#est-hardware-current").tagName'), 'SPAN');
        assert.equal(await evaluate('findLocaleTestBlocks().workspace.getAllBlocks(false).filter(b=>!b.isShadow()).length'), 1);
        await evaluate(`(async()=>{const vm=findLocaleTestBlocks().props.vm,stage=vm.runtime.getTargetForStage();
            stage.createVariable('create-marker','marker','');stage.variables['create-marker'].value=123;
            vm.runtime.emitProjectChanged(); savedDeviceProjects['${id}']=await vm.saveProjectSb3();})()`);
    }
    // Cancelling the unsaved-program prompt leaves both the device and program intact.
    await evaluate("window.allowNewProject=false;findCreateComponent('handleClickNew').handleClickNew()");
    await wait('Boolean(document.querySelector("input[name=hardware-choice]"))');
    await evaluate(`document.querySelector('input[value="spark-ai"][name=hardware-choice]').click();
        document.querySelector('[aria-labelledby=hardware-choice-title] footer button:last-child').click();`);
    await wait('!document.querySelector("[aria-labelledby=hardware-choice-title] footer button:last-child").disabled');
    assert.equal(await evaluate('createMeta()'), 'est');
    assert.equal(await evaluate('createMarker().value'), 123);
    await evaluate('document.querySelector("[aria-labelledby=hardware-choice-title] header button").click()');
    // Recreating the same device must also create a blank workspace.
    await evaluate("window.allowNewProject=true;findCreateComponent('handleClickNew').handleClickNew()");
    await wait('Boolean(document.querySelector("input[name=hardware-choice]"))');
    await evaluate(`document.querySelector('input[value="est"][name=hardware-choice]').click();
        document.querySelector('[aria-labelledby=hardware-choice-title] footer button:last-child').click();`);
    await wait('!document.querySelector("input[name=hardware-choice]")');
    assert.equal(await evaluate('Boolean(createMarker())'), false);
    for (const id of ['new-ai', 'spark-ai', 'est']) {
        await evaluate(`(async()=>{await findLocaleTestBlocks().props.vm.loadProject(await savedDeviceProjects['${id}'].arrayBuffer());})()`);
        assert.equal(await evaluate('createMeta()'), id, 'saved file selects its own device');
        assert.equal(await evaluate('createMarker().value'), 123, 'program content survives save/reopen');
        assert.equal(await evaluate('Boolean(document.querySelector("input[name=hardware-choice]"))'), false);
        const prefix = id === 'est' ? '' : (id === 'new-ai' ? 'new_' : 'spark_');
        await wait(`(()=>{const blocks=findLocaleTestBlocks().workspace.getFlyout().getWorkspace().getAllBlocks();
            return blocks.length>0 && ${prefix ? `blocks.some(b=>b.type.startsWith('${prefix}'))` :
        '!blocks.some(b=>/^(spark_|new_)/.test(b.type))'};})()`);
    }
    await pause(400);
    fs.writeFileSync(path.join(output, 'new-project-editor.png'), (await window.webContents.capturePage()).toPNG());
    fs.writeFileSync(path.join(output, 'new-project-validation.json'), JSON.stringify({passed: true,
        cases: ['home and File/New choose device', 'cancel preserves program', 'same-device new is blank',
            'all three devices create correct blocks', 'editor has no device switch', 'file restores device and content'],
        hardwareCommands: 0}, null, 2));
    console.log(`New-project device selection and saved hardware tags passed: ${output}`);
};
