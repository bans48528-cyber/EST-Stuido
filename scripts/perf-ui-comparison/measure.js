const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {performance} = require('perf_hooks');
const p95 = values => [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1];
const findEditor = `window.findComparisonEditor=()=>{
    for(const element of document.querySelectorAll('div')){
        const key=Object.keys(element).find(k=>k.startsWith('__reactInternalInstance$')||k.startsWith('__reactFiber$'));
        if(!key)continue;let root=element[key];while(root.return)root=root.return;
        if(root.stateNode&&root.stateNode.current)root=root.stateNode.current;
        const nodes=[root],seen=new Set();
        while(nodes.length){const n=nodes.pop();if(seen.has(n))continue;seen.add(n);const p=n.stateNode;
            if(p&&p.ScratchBlocks&&p.workspace&&p.workspace.getFlyout())return p;
            if(n.child)nodes.push(n.child);if(n.sibling)nodes.push(n.sibling);}
        break;
    }return null;
};Boolean(findComparisonEditor()&&findComparisonEditor().props.vm.runtime.targets.length)`;

module.exports = async ({window, evaluate, pause, output, label}) => {
    const compositorOnly = process.argv.includes('--perf-compositor');
    for (let index = 0; index < 150; index++) {
        if (await evaluate(findEditor)) break;
        if (index === 149) throw Error('Comparison editor failed to mount');
        await pause(100);
    }
    await evaluate(`window.dispatchEvent(new Event('est-home-project-opened')); undefined`);
    await pause(1200);
    const prepared = await evaluate(`(() => {
        const editor=findComparisonEditor(),ws=editor.workspace,B=editor.ScratchBlocks;
        document.documentElement.lang='zh-cn';
        ws.clear();
        ws.updateToolbox('<xml><category id="operators" name="Comparison" colour="#59c059" secondaryColour="#389438">' +
            '<block type="control_wait"></block></category></xml>');
        window.comparisonBlocks=[];
        for(let i=0;i<100;i++){
            const b=ws.newBlock('control_wait');b.initSvg();b.render();b.moveBy(20+(i%5)*160,40+Math.floor(i/5)*50);
            comparisonBlocks.push(b);
        }
        const n=ws.newBlock('math_number');n.setShadow(true);n.initSvg();n.render();
        comparisonBlocks[0].getInput('DURATION').connection.connect(n.outputConnection);
        window.comparisonNumberBlock=n;
        const input=document.createElement('textarea');input.id='comparison-input';
        Object.assign(input.style,{position:'fixed',top:'95px',right:'25px',width:'260px',height:'60px',zIndex:20000});
        document.body.appendChild(input);
        return {blocks:ws.getAllBlocks().length,rootBlocks:ws.getTopBlocks().length,
            flyoutBlocks:ws.getFlyout().getWorkspace().getAllBlocks().length,
            domNodes:document.querySelectorAll('*').length,locale:editor.props.locale,
            titleField:!!document.querySelector('input[class*="title-field"]')};
    })()`);
    assert.equal(prepared.rootBlocks, 100);
    assert.equal(prepared.blocks, 101);
    if (compositorOnly) {
        await evaluate(`(()=>{const s=document.createElement('style');
        s.textContent='[data-est-mascot] *{animation:none!important;}' +
        '[data-est-mascot]{will-change:transform;animation:comparisonFloat 3.2s ease-in-out infinite!important;}' +
        '@keyframes comparisonFloat{0%,100%{transform:translate3d(0,1px,0)}50%{transform:translate3d(0,-3px,0)}}';
        document.head.appendChild(s);})()`);
    }
    await pause(1200);
    const debug = window.webContents.debugger;
    debug.attach('1.3');
    try {
        await debug.sendCommand('Performance.enable');
        await debug.sendCommand('Emulation.setFocusEmulationEnabled', {enabled: true});
        const metrics = async () => Object.fromEntries((await debug.sendCommand('Performance.getMetrics')).metrics
            .map(item => [item.name, item.value]));
        const difference = (before, after) => Object.fromEntries([
            'LayoutCount', 'RecalcStyleCount', 'LayoutDuration', 'RecalcStyleDuration', 'ScriptDuration', 'TaskDuration'
        ].map(key => [key, after[key] - before[key]]));
        const idleBefore = await metrics(); await pause(1200); const idle = difference(idleBefore, await metrics());
        const idleAblations = [];
        if (label === 'est' && !compositorOnly) {
            for (const [name, css] of [
                ['mascot-static', '[data-est-mascot],[data-est-mascot] *{animation:none!important;}'],
                ['mascot-compositor-float',
                    '[data-est-mascot] *{animation:none!important;}' +
                    '[data-est-mascot]{will-change:transform;' +
                    'animation:comparisonFloat 3.2s ease-in-out infinite!important;}' +
                    '@keyframes comparisonFloat{0%,100%{transform:translate3d(0,1px,0)}' +
                    '50%{transform:translate3d(0,-3px,0)}}']
            ]) {
                await evaluate(`(()=>{const s=document.createElement('style');s.id='comparison-animation';
                    s.textContent=${JSON.stringify(css)};document.head.appendChild(s);})()`);
                await pause(300);
                const before = await metrics(); await pause(1200);
                idleAblations.push({name, metrics: difference(before, await metrics())});
                await evaluate('document.getElementById("comparison-animation").remove(); undefined');
                await pause(200);
            }
        }
        const cases = [];
        for (const kind of ['plain-text', 'project-title', 'block-number']) {
            const available = await evaluate(`(() => {
                const editor=findComparisonEditor(),B=editor.ScratchBlocks;
                B.WidgetDiv.hide(true);
                let input;
                if(${JSON.stringify(kind)}==='plain-text')input=document.getElementById('comparison-input');
                if(${JSON.stringify(kind)}==='project-title'){
                    input=document.querySelector('input[class*="title-field"]');
                }
                if(${JSON.stringify(kind)}==='block-number'){
                    comparisonNumberBlock.getField('NUM').showEditor_();
                    input=document.querySelector('.blocklyHtmlInput');
                }
                if(!input)return false;window.comparisonInput=input;input.focus();input.select();
                window.comparisonInputSamples=[];
                input.addEventListener('input',e=>{const at=performance.now();
                    const s={deliveryMs:at-e.timeStamp};comparisonInputSamples.push(s);
                    requestAnimationFrame(()=>s.paintMs=performance.now()-at);});
                return true;
            })()`);
            if (!available) {
                cases.push({kind, unavailable: true}); continue;
            }
            await pause(150);
            const before = await metrics();
            const times = [];
            for (let index = 0; index < 32; index++) {
                const text = kind === 'block-number' ? String((index % 8) + 1) : 'a';
                if (kind === 'block-number') await evaluate('comparisonInput.select(); undefined');
                const start = performance.now();
                await debug.sendCommand('Input.dispatchKeyEvent', {type: 'keyDown',
                    key: text,
                    text,
                    unmodifiedText: text,
                    windowsVirtualKeyCode: kind === 'block-number' ? 49 : 65});
                await debug.sendCommand('Input.dispatchKeyEvent', {type: 'keyUp',
                    key: text,
                    windowsVirtualKeyCode: kind === 'block-number' ? 49 : 65});
                times.push(performance.now() - start);
                await pause(20);
            }
            await pause(50);
            const events = await evaluate('comparisonInputSamples');
            const paint = events.map(event => event.paintMs).filter(Number.isFinite);
            cases.push({kind,
                keyDispatchP95Ms: p95(times),
                keyDispatchMaxMs: Math.max(...times),
                inputEvents: events.length,
                paintP95Ms: p95(paint),
                paintMaxMs: Math.max(...paint),
                metrics: difference(before, await metrics())});
        }
        await evaluate('findComparisonEditor().ScratchBlocks.WidgetDiv.hide(true);comparisonInput.blur(); undefined');
        const point = await evaluate(`(()=>{const b=comparisonBlocks[1],r=b.getSvgRoot().getBoundingClientRect();
            const p=b.getRelativeToSurfaceXY();
            return {x:r.left+12,y:r.top+22,beforeX:p.x,beforeY:p.y};})()`);
        const beforeDrag = await metrics();
        await evaluate(`(()=>{
            window.comparisonDragSamples=[];
            window.comparisonDragListener=e=>{if(e.buttons!==1)return;const at=performance.now();
                const s={deliveryMs:at-e.timeStamp};comparisonDragSamples.push(s);
                requestAnimationFrame(()=>s.paintMs=performance.now()-at);};
            document.addEventListener('mousemove',comparisonDragListener,true);
        })()`);
        const dragTimes = [];
        await debug.sendCommand('Input.dispatchMouseEvent', {type: 'mouseMoved', x: point.x, y: point.y});
        await debug.sendCommand('Input.dispatchMouseEvent', {type: 'mousePressed',
            x: point.x,
            y: point.y,
            button: 'left',
            buttons: 1,
            clickCount: 1});
        for (let index = 1; index <= 32; index++) {
            const start = performance.now();
            await debug.sendCommand('Input.dispatchMouseEvent', {type: 'mouseMoved',
                x: point.x + (index * 3),
                y: point.y + index,
                button: 'left',
                buttons: 1});
            dragTimes.push(performance.now() - start); await pause(16);
        }
        await debug.sendCommand('Input.dispatchMouseEvent', {type: 'mouseReleased',
            x: point.x + 96,
            y: point.y + 32,
            button: 'left',
            buttons: 0,
            clickCount: 1});
        await pause(300);
        const dragEvents = await evaluate(`(()=>{
            document.removeEventListener('mousemove',comparisonDragListener,true);return comparisonDragSamples;
        })()`);
        const dragPaint = dragEvents.map(event => event.paintMs).filter(Number.isFinite);
        const moved = await evaluate('(()=>{const p=comparisonBlocks[1].getRelativeToSurfaceXY();' +
            'return {x:p.x,y:p.y};})()');
        assert.ok(Math.abs(moved.x - point.beforeX) > 30, 'The actual statement block must move during the drag');
        const report = {label: compositorOnly ? 'est-compositor' : label,
            baseline: 'Unmodified local openblock-gui sources, no EST loaders',
            electron: process.versions.electron,
            chrome: process.versions.chrome,
            size: window.getSize(),
            prepared,
            idle,
            idleAblations,
            cases,
            drag: {dispatchP95Ms: p95(dragTimes),
                dispatchMaxMs: Math.max(...dragTimes),
                moved,
                eventCount: dragEvents.length,
                eventToPaintP95Ms: p95(dragPaint),
                eventToPaintMaxMs: Math.max(...dragPaint),
                metrics: difference(beforeDrag, await metrics())},
            hardwareAccessed: false,
            networkAllowed: false};
        fs.writeFileSync(path.join(output, compositorOnly ? 'performance-compositor.json' : 'performance.json'),
            JSON.stringify(report, null, 2));
        fs.writeFileSync(path.join(output, compositorOnly ? 'comparison-compositor.png' : 'comparison.png'),
            (await window.webContents.capturePage()).toPNG());
        console.log(JSON.stringify(report));
    } finally {
        if (debug.isAttached()) debug.detach();
    }
};
