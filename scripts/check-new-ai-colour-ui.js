// Real Blockly interaction in the isolated Electron harness; no device or network access.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const colours = ['#ff000c', '#ffe360', '#0090f5', '#00cb54', '#914800', '#ad0000', '#000000', '#ffffff'];

module.exports = async ({evaluate, pause, window, output, chooseHardware}) => {
    await chooseHardware('new-ai');
    await evaluate(`(() => {
        const {workspace:ws,ScratchBlocks:B}=findLocaleTestBlocks();
        ws.clear();
        B.Xml.domToWorkspace(B.Xml.textToDom('<xml><block type="new_sensing_color_judgment" ' +
            'id="colour-condition" x="400" y="180"><value name="PORT">' +
            '<shadow type="new_sensing_menu"><field name="SENSING_MENU">A</field></shadow></value>' +
            '<value name="COLOR"><shadow type="new_colour_card" id="colour-swatch">' +
            '<field name="COLOUR">#ff000c</field></shadow></value></block></xml>'),ws);
    })()`);
    await pause(200);
    const click = async point => {
        window.webContents.sendInputEvent({type: 'mouseMove', x: Math.round(point.x), y: Math.round(point.y)});
        window.webContents.sendInputEvent({type: 'mouseDown',
            button: 'left',
            clickCount: 1,
            x: Math.round(point.x),
            y: Math.round(point.y)});
        window.webContents.sendInputEvent({type: 'mouseUp',
            button: 'left',
            clickCount: 1,
            x: Math.round(point.x),
            y: Math.round(point.y)});
        await pause(75);
    };
    const open = async () => {
        await click(await evaluate(`(() => {
            const field=findLocaleTestBlocks().workspace.getBlockById('colour-swatch').getField('COLOUR');
            const box=field.getClickTarget_().getBoundingClientRect();
            return {x:box.left+box.width/2,y:box.top+box.height/2};
        })()`));
    };
    const state = () => evaluate(`(() => {
        const {workspace:ws,ScratchBlocks:B}=findLocaleTestBlocks();
        const field=ws.getBlockById('colour-swatch').getField('COLOUR');
        const panel=document.querySelector('.new-ai-colour-card-picker');
        B.NewPython.init(ws);
        return {value:field.getValue(),code:B.NewPython.new_sensing_color_judgment(
            ws.getBlockById('colour-condition'))[0],
            colours:panel?Array.from(panel.querySelectorAll('[data-new-colour]')).map(b=>b.dataset.newColour):[],
            selected:panel?Array.from(panel.querySelectorAll('[aria-selected="true"]')).map(b=>b.dataset.newColour):[]};
    })()`);
    await evaluate('findLocaleTestBlocks().workspace.clearUndo()');
    await open();
    const initial = await state();
    fs.writeFileSync(path.join(output, 'new-ai-colour-picker.png'), (await window.webContents.capturePage()).toPNG());
    assert.deepStrictEqual(initial.colours, colours, 'Clicking the swatch must open the original eight-colour card');
    assert.deepStrictEqual(initial.selected, [colours[0]]);
    for (let index = 0; index < colours.length; index++) {
        const point = await evaluate(`(() => {
            const b=document.querySelector('[data-new-colour="${colours[index]}"]');
            const box=b.getBoundingClientRect();return {x:box.left+box.width/2,y:box.top+box.height/2};
        })()`);
        await click(point);
        const result = await state();
        assert.equal(result.value, colours[index]);
        assert.deepStrictEqual(result.selected, [colours[index]]);
        assert.ok(result.code.includes(`cmp_color(0, ${index + 1})`), JSON.stringify(result));
    }
    const vertical = await evaluate(`(() => {
        const boxes=Array.from(document.querySelectorAll('[data-new-colour]')).map(b=>b.getBoundingClientRect());
        const center=boxes[0].left+boxes[0].width/2;
        return boxes.every((b,i)=>Math.abs(b.left+b.width/2-center)<0.1&&(!i||b.top>boxes[i-1].top));
    })()`);
    assert.equal(vertical, true, 'The original picker uses a vertical card');
    const drag = await evaluate(`(() => {
        const rail=document.querySelector('.new-ai-colour-card-rail').getBoundingClientRect();
        return {x:rail.left+rail.width/2,top:rail.top+2,bottom:rail.bottom-2,
            green:rail.top+rail.height*3.5/8};
    })()`);
    window.webContents.sendInputEvent({type: 'mouseMove', x: Math.round(drag.x), y: Math.round(drag.top)});
    window.webContents.sendInputEvent({type: 'mouseDown',
        button: 'left',
        clickCount: 1,
        x: Math.round(drag.x),
        y: Math.round(drag.top)});
    window.webContents.sendInputEvent({type: 'mouseMove', x: Math.round(drag.x), y: Math.round(drag.bottom)});
    window.webContents.sendInputEvent({type: 'mouseMove', x: Math.round(drag.x), y: Math.round(drag.green)});
    window.webContents.sendInputEvent({type: 'mouseUp',
        button: 'left',
        clickCount: 1,
        x: Math.round(drag.x),
        y: Math.round(drag.green)});
    await pause(80);
    assert.equal((await state()).value, colours[3], 'Dragging the card must select the colour under the pointer');
    await evaluate(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown',
        {key:'ArrowDown',bubbles:true,cancelable:true}))`);
    assert.equal((await state()).value, colours[4]);
    await click({x: 950, y: 600});
    assert.equal(await evaluate('Boolean(document.querySelector(".new-ai-colour-card-picker"))'), false);
    await pause(150);
    await evaluate('findLocaleTestBlocks().workspace.undo(false)');
    assert.equal((await state()).value, colours[0], 'One undo restores the colour before opening the picker');
    await evaluate('findLocaleTestBlocks().workspace.undo(true)');
    assert.equal((await state()).value, colours[4]);
    const savedColour = () => evaluate(`(() => {
        const project=JSON.parse(findLocaleTestBlocks().props.vm.toJSON());
        const target=project.targets.find(t=>t.blocks&&t.blocks['colour-swatch']);
        return target&&target.blocks['colour-swatch'].fields.COLOUR[0];
    })()`);
    // Blockly events reach the VM asynchronously. Wait for the real saved model,
    // rather than racing the redo notification with a synthetic immediate Save.
    for (let attempt = 0; attempt < 40; attempt++) {
        if (await savedColour() === colours[4]) break;
        await pause(25);
    }
    assert.equal(await savedColour(), colours[4], 'The VM receives the redone colour before saving');
    await evaluate(`(async () => {
        const vm=findLocaleTestBlocks().props.vm;
        const archive=await vm.saveProjectSb3();await vm.loadProject(await archive.arrayBuffer());
    })()`);
    await pause(500);
    assert.equal((await state()).value, colours[4], 'The chosen colour survives a project save/reopen');
    await open();
    assert.deepStrictEqual((await state()).selected, [colours[4]], 'Reopening highlights the saved colour');
    fs.writeFileSync(path.join(output, 'new-ai-colour-selected.png'), (await window.webContents.capturePage()).toPNG());
    await click({x: 950, y: 600});
    const result = {passed: true,
        originalVerticalCard: true,
        eightColourCodes: true,
        realPointerClick: true,
        realPointerDrag: true,
        keyboard: true,
        undoRedo: true,
        projectSaveReopen: true,
        deviceCommandsSent: 0};
    fs.writeFileSync(path.join(output, 'new-ai-colour-result.json'), JSON.stringify(result, null, 2));
    console.log(`NEW AI colour selector passed: ${output}`);
};
