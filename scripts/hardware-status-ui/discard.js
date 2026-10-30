/* eslint-disable max-len */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

module.exports = async ({evaluate, pause, output, respond, dialogs, seedDrafts, draftCount}) => {
    const wait = async predicate => {
        for (let count = 0; count < 100; count++) {
            if (await evaluate(predicate)) return;
            await pause(60);
        }
        throw Error(`Discard UI did not settle: ${predicate}`);
    };
    const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    const openChoice = async id => {
        await click('#est-hardware-select');
        await click(`input[name="hardware-choice"][value="${id}"]`);
    };
    const confirmChoice = () => click('[aria-labelledby="hardware-choice-title"] footer button:last-child');
    const current = () => evaluate('JSON.parse(window.findLocaleTestBlocks().props.vm.toJSON()).meta.estStudio.hardwareId');
    await evaluate("window.dispatchEvent(new CustomEvent('est-home-set-locale',{detail:{locale:'zh-cn'}}))");
    await pause(450);
    await evaluate(`(async () => {
        const editor=window.findLocaleTestBlocks(), vm=editor.props.vm, stage=vm.runtime.getTargetForStage();
        stage.createVariable('discard-marker','discard marker','');
        stage.variables['discard-marker'].value=913;
        vm.runtime.emitProjectChanged(); vm.emitWorkspaceUpdate();
        window.savedDiscardProject=await vm.saveProjectSb3();
        if(editor.props.isCodeEditorLocked) editor.props.onToggleHardwareCodeLock();
        editor.props.onSetCodeEditorValue('print("old_manual_discard_marker")');
    })()`);
    await pause(100);
    seedDrafts();
    await openChoice('spark-ai');
    respond(1);
    const beforeCancel = dialogs().length;
    await confirmChoice();
    await wait('!document.querySelector("[aria-labelledby=hardware-choice-title] footer button:last-child").disabled');
    assert.equal(await current(), 'est');
    assert.equal(draftCount(), 3);
    assert.equal(await evaluate('window.findLocaleTestBlocks().props.vm.runtime.getTargetForStage().variables["discard-marker"].value'), 913);
    assert.ok(await evaluate('window.findLocaleTestBlocks().props.codeEditorValue.includes("old_manual_discard_marker")'));
    assert.equal(dialogs().length, beforeCancel + 1);
    const confirmation = dialogs().slice(-1)[0];
    assert.ok(confirmation.message.includes('Spark AI'));
    assert.ok(confirmation.detail.includes('已保存的工程文件不会被删除'));
    assert.equal(confirmation.buttons[0], '丢弃并切换');
    assert.equal(confirmation.defaultId, 1);
    assert.equal(confirmation.cancelId, 1);
    respond(0);
    await confirmChoice();
    await wait('!document.querySelector("input[name=hardware-choice]")');
    assert.equal(await current(), 'spark-ai');
    assert.equal(draftCount(), 0);
    await wait('window.findLocaleTestBlocks().props.isCodeEditorLocked');
    assert.ok(!await evaluate('Boolean(window.findLocaleTestBlocks().props.vm.runtime.getTargetForStage().variables["discard-marker"])'));
    assert.ok(!await evaluate('window.findLocaleTestBlocks().props.codeEditorValue.includes("old_manual_discard_marker")'));
    for (const id of ['new-ai', 'est', 'spark-ai']) {
        await openChoice(id);
        respond(0);
        await confirmChoice();
        await wait('!document.querySelector("input[name=hardware-choice]")');
        assert.equal(await current(), id);
        assert.equal(await evaluate('window.findLocaleTestBlocks().workspace.getAllBlocks(false).filter(b=>!b.isShadow()).length'), 1,
            'a switched device contains only its default start block');
        assert.ok(!await evaluate('Boolean(window.findLocaleTestBlocks().props.vm.runtime.getTargetForStage().variables["discard-marker"])'));
    }
    const beforeSame = dialogs().length;
    await openChoice('spark-ai');
    await confirmChoice();
    await wait('!document.querySelector("input[name=hardware-choice]")');
    assert.equal(dialogs().length, beforeSame, 'selecting the current device does not ask to discard');
    await evaluate('(async () => {await window.findLocaleTestBlocks().props.vm.loadProject(await savedDiscardProject.arrayBuffer());})()');
    assert.equal(await current(), 'est');
    assert.equal(await evaluate('window.findLocaleTestBlocks().props.vm.runtime.getTargetForStage().variables["discard-marker"].value'), 913,
        'saved projects remain intact and can be explicitly reopened');
    fs.writeFileSync(path.join(output, 'hardware-discard-validation.json'), JSON.stringify({passed: true,
        cases: ['cancel retains blocks, variables, handwritten Python and disk drafts',
            'confirm clears all device drafts and resets handwritten Python',
            'switching back never restores the old program', 'all three products start blank',
            'current device is a no-op', 'saved project can still be reopened'],
        confirmation,
        realHardwareCommands: 0}, null, 2));
    console.log(`Hardware draft discard UI passed: ${output}`);
};
