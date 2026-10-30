/* eslint-disable max-len */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

module.exports = async ({evaluate, pause, output}) => {
    const wait = async predicate => {
        for (let attempt = 0; attempt < 120; attempt++) {
            if (await evaluate(predicate)) return;
            await pause(80);
        }
        throw Error(`ATC UI did not settle: ${predicate}`);
    };
    assert.equal(await evaluate('document.title'), 'ATC CodeStudio');
    await evaluate(`window.findAtcComponent = method => {
        for (const element of document.querySelectorAll('div')) {
            let fiber=element[Object.keys(element).find(key=>key.startsWith('__reactInternalInstance'))];
            for(;fiber;fiber=fiber.return) if(fiber.stateNode && typeof fiber.stateNode[method]==='function') return fiber.stateNode;
        }
        throw Error('Missing component: '+method);
    };
    const stage=window.findLocaleTestBlocks().props.vm.runtime.getTargetForStage();
    stage.createVariable('atc-roundtrip','ATC roundtrip',''); stage.variables['atc-roundtrip'].value=1028;
    window.findAtcComponent('getProjectTitleFromFilename').props.onSetProjectTitle('ATC测试程序');
    window.atcOriginalUrl=URL.createObjectURL;
    URL.createObjectURL=blob=>{window.atcSavedBlob=blob; return atcOriginalUrl.call(URL,blob);};
    window.atcOriginalAnchor=HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click=function(){window.atcSavedName=this.download;}; void 0;`);
    await pause(150);
    await evaluate(`window.findAtcComponent('downloadProject').downloadProject()`);
    await wait('Boolean(window.atcSavedBlob && window.atcSavedName)');
    assert.equal(await evaluate('atcSavedName'), 'ATC测试程序.atc');
    assert.equal(await evaluate('atcSavedBlob.type'), 'application/x.atc.project');
    const bytes = await evaluate('(async()=>Array.from(new Uint8Array(await atcSavedBlob.arrayBuffer())))()');
    assert.equal(Buffer.from(bytes).readUInt16LE(0), 0x4b50, 'project remains a valid ZIP archive');
    fs.writeFileSync(path.join(output, 'ATC测试程序.atc'), Buffer.from(bytes));
    await evaluate(`URL.createObjectURL=atcOriginalUrl; HTMLAnchorElement.prototype.click=atcOriginalAnchor;
        window.findLocaleTestBlocks().props.vm.runtime.getTargetForStage().variables['atc-roundtrip'].value=-1;
        window.atcOriginalInput=HTMLInputElement.prototype.click;
        HTMLInputElement.prototype.click=function(){if(this.type!=='file') return atcOriginalInput.call(this);};
        window.findAtcComponent('getProjectTitleFromFilename').createFileObjects();
        HTMLInputElement.prototype.click=atcOriginalInput; void 0;`);
    assert.equal(await evaluate("window.findAtcComponent('getProjectTitleFromFilename').inputElement.accept"), '.atc');
    await evaluate(`window.atcDialogs=[];
        window.atcUpload=window.findAtcComponent('getProjectTitleFromFilename');
        atcUpload.props={...atcUpload.props,onShowMessageBox:(type,message)=>{atcDialogs.push({type,message});return true;}};
        atcUpload.handleChange({target:{files:[new File([atcSavedBlob],'重新打开.ATC')]}})`);
    await wait('window.findLocaleTestBlocks().props.vm.runtime.getTargetForStage().variables["atc-roundtrip"].value===1028');
    await wait("!window.findAtcComponent('getProjectTitleFromFilename').fileReader");
    assert.equal(await evaluate("window.findAtcComponent('downloadProject').props.projectFilename"), '重新打开.atc');
    const before = await evaluate('atcDialogs.length');
    await evaluate(`window.atcUpload=window.findAtcComponent('getProjectTitleFromFilename');
        atcUpload.props={...atcUpload.props,onShowMessageBox:(type,message)=>{atcDialogs.push({type,message});return true;}};
        atcUpload.handleChange({target:{files:[new File([atcSavedBlob],'旧工程.ests')]}})`);
    assert.equal(await evaluate('atcDialogs.length'), before + 1);
    assert.ok(await evaluate('atcDialogs[atcDialogs.length-1].message.includes(".atc")'));
    assert.equal(await evaluate('window.findLocaleTestBlocks().props.vm.runtime.getTargetForStage().variables["atc-roundtrip"].value'), 1028,
        'rejected legacy files must not replace the current program');
    fs.writeFileSync(path.join(output, 'atc-validation.json'), JSON.stringify({passed: true,
        savedFilename: 'ATC测试程序.atc',
        reopened: true,
        uppercaseExtension: true,
        legacyRejected: true,
        realHardwareCommands: 0}, null, 2));
    console.log(`ATC compiled UI passed: ${output}`);
};
