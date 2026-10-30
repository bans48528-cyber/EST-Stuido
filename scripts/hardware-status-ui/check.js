const assert = require('assert');
const fs = require('fs');
const path = require('path');

module.exports = async ({evaluate, pause, window, output, setNew, setSpark, newStatus,
    enableEst, requests, captureEnabled = true}) => {
    const wait = async predicate => {
        for (let count = 0; count < 100; count++) {
            if (await evaluate(predicate)) return;
            await pause(80);
        }
        throw new Error(`UI did not settle: ${predicate}`);
    };
    const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    const select = async hardware => {
        await click('#est-hardware-select');
        await click(`input[name="hardware-choice"][value="${hardware}"]`);
        await click('[aria-labelledby="hardware-choice-title"] footer button:last-child');
        await wait(`!document.querySelector('[aria-labelledby="hardware-choice-title"]')`);
        await pause(250);
    };
    const more = async action => {
        await click('[data-action="more"]');
        await click(`[role="menu"] [data-action="${action}"]`);
        await pause(100);
    };
    const snapshot = () => evaluate(`(() => {
        const root=document.querySelector('[id$="-hardware-panel"]');
        const box=root.getBoundingClientRect();
        return {width:box.width, fits:box.left>=0&&box.right<=innerWidth&&box.top>=0&&box.bottom<=innerHeight,
            modal:root.getAttribute('aria-modal'), text:root.textContent,
            ports:[...root.querySelectorAll('[data-port]')].map(p=>({label:p.dataset.port, text:p.textContent})),
            wires:[...root.querySelectorAll('[data-wire]')].map(p=>({label:p.dataset.wire, d:p.getAttribute('d'),
                attached:p.dataset.attached,stroke:getComputedStyle(p).stroke,width:getComputedStyle(p).strokeWidth}))};
    })()`);
    const capture = async name => {
        if (!captureEnabled) return;
        await evaluate(`Promise.all([...document.querySelectorAll('[id$="-hardware-panel"] img')].map(i=>i.decode()))`);
        await pause(500);
        window.webContents.invalidate();
        await pause(150);
        fs.writeFileSync(path.join(output, name), (await window.webContents.capturePage()).toPNG());
    };
    const cases = [];
    await select('new-ai');
    const listeners = await evaluate(`require('electron').ipcRenderer.listenerCount('new-ai-state-change')`);
    await click('#new-ai-connection');
    await wait(`document.querySelectorAll('#new-ai-hardware-panel [data-wire]').length===8`);
    assert.equal(await evaluate(`require('electron').ipcRenderer.listenerCount('new-ai-state-change')`), listeners);
    assert.ok((await snapshot()).wires.every(wire => wire.attached === 'false'));
    await click('[data-action="connection-summary"]');
    assert.ok(await evaluate(`Boolean(document.querySelector('#new-ai-mode-usb'))`));
    await click('[data-action="back"]');
    const status = {...newStatus,
        ports: [
            {label: 'A', port: 0, type: 'big_motor', values: {angle: 0, speed: 0, circly: 0}},
            {label: 'B', port: 1, type: 'color', values: {r: 255, g: 0, b: 0, lux: 62}},
            {label: 'C', port: 2, type: 'ultrasion', values: {cm: 42}},
            ...'DEFGH'.split('').map((label, i) => ({label, port: i + 3, type: 'none', values: {}}))
        ]};
    setNew({connected: true, busy: false, stale: false, status, state: 'connected'});
    await wait(`document.querySelector('[data-wire="A"]').dataset.attached==='true'`);
    await pause(150);
    const connected = await snapshot();
    assert.equal(connected.width, 400);
    assert.equal(connected.modal, null);
    assert.equal(connected.wires.filter(wire => wire.stroke === 'rgb(22, 135, 224)').length, 3);
    assert.ok(connected.wires.every(wire => wire.d.startsWith('M ')));
    await click('[data-port="B"]');
    assert.ok(await evaluate(`Boolean(document.querySelector('[data-port-detail="B"] [data-field="r"]'))`));
    await click('[data-port="B"]');
    assert.equal(await evaluate(`Boolean(document.querySelector('[data-port-detail]'))`), false);
    await click('[data-port="H"]');
    const emptySelected = (await snapshot()).wires.find(wire => wire.label === 'H');
    assert.equal(emptySelected.stroke, 'rgb(219, 227, 232)');
    assert.equal(emptySelected.width, '1.9px');
    await capture('new-ai-desktop.png');
    cases.push('new-ai: eight real port slots, three confirmed blue wires, empty selection stays gray, details toggle');

    await click('[data-action="more"]');
    assert.equal(await evaluate(`Boolean(document.querySelector('[role="menu"] [data-action="pause"]'))`), false);
    await click('[data-action="more"]');
    const updated = {...status,
        ports: status.ports.map(port => (port.label === 'C' ?
            {...port, values: {cm: 99.5}} : port))};
    setNew({status: updated});
    await pause(150);
    await wait(`document.querySelector('[data-port="C"]').textContent.includes('99.5')`);
    for (const patch of [{stale: true}, {stale: false, busy: true}, {connected: false, busy: false}]) {
        setNew(patch);
        await pause(120);
        assert.ok((await snapshot()).wires.every(wire => wire.attached === 'false'));
    }
    setNew({connected: true, stale: false, busy: false});
    await pause(120);
    await more('info');
    await wait(`Boolean(document.querySelector('#new-ai-telemetry'))`);
    await evaluate(`document.querySelector('[id$="-hardware-panel"] [class*="_content_"]').scrollTop=200`);
    assert.ok(await evaluate(`(() => {const r=document.querySelector('[data-action="close"]').getBoundingClientRect();
        return r.top>=0&&r.bottom<=innerHeight;})()`), 'close stays accessible while information scrolls');
    await evaluate(`document.querySelector('[id$="-hardware-panel"] [class*="_content_"]').scrollTop=0`);
    await capture('new-ai-info.png');
    await click('[data-action="back"]');
    await click('[data-action="connection-summary"]');
    await click('#new-ai-mode-ble');
    await wait(`Boolean(document.querySelector('#new-ai-ble-search'))`);
    await capture('new-ai-connection.png');
    await click('[data-action="back"]');
    cases.push('readings stay active; stale, transfer-busy and disconnected states clear live values; ' +
        'connection and firmware/info reachable');

    setNew({connected: true, stale: false, busy: false, connectionMode: 'usb', status: updated});
    await pause(100);
    for (const width of [800, 390]) {
        window.setSize(width, 760);
        await pause(250);
        const layout = await snapshot();
        assert.ok(layout.fits, `panel must fit ${width}px`);
        assert.ok(layout.wires.every(wire => wire.d.startsWith('M ')));
        assert.ok(await evaluate(`(() => {
            const reading=document.querySelector('[data-port="C"] > span:last-child');
            return reading.scrollWidth<=reading.clientWidth;
        })()`), 'a decimal distance and its cm unit must be fully visible');
        await capture(`new-ai-${width}.png`);
    }
    await more('disconnect');
    await pause(150);
    assert.ok((await snapshot()).wires.every(wire => wire.attached === 'false'));
    await click('[data-action="close"]');
    assert.equal(await evaluate(`require('electron').ipcRenderer.listenerCount('new-ai-state-change')`), listeners);
    assert.equal(await evaluate(`Boolean(document.querySelector('#new-ai-hardware-panel'))`), false);
    window.setSize(1280, 760);
    await select('spark-ai');
    setSpark({connected: true,
        compatible: true,
        busy: false,
        stale: false,
        state: 'connected',
        status: {version: 110,
            battery: 85,
            running: false,
            flash: {free: '512KB', total: '1024KB'},
            ports: [
                {port: 0, type: 'color', values: {lux: 62, state: 1}},
                {port: 1, type: 'ultrasion', values: {cm: 42}},
                {port: 2, type: 'touch', values: {state: 0}}
            ]}});
    await click('#spark-connection');
    await wait(`document.querySelectorAll('#spark-hardware-panel [data-wire]').length===8`);
    await click('[data-port="E"]');
    const spark = await snapshot();
    assert.ok(spark.wires.slice(4).every(wire => wire.attached === 'false'));
    assert.ok(spark.text.includes('无实时回传'));
    assert.ok(await evaluate(`document.querySelector('#spark-hardware-panel img').src.endsWith('.svg')`));
    await capture('spark-desktop.png');
    await more('info');
    assert.equal(await evaluate(`document.querySelectorAll('#spark-hardware-panel input[type="checkbox"], #spark-hardware-panel [class*=SparkRuntime_port_]').length`), 0,
        'Spark info contains no monitoring switch or duplicate port readings');
    await click('[data-action="more"]');
    assert.equal(await evaluate(`Boolean(document.querySelector('[role="menu"] [data-action="pause"]'))`), false,
        'Spark monitoring cannot be paused from the inspector menu');
    await click('[role="menu"] [data-action="info"]');
    await capture('spark-info.png');
    await click('[data-action="back"]');
    await more('connection');
    assert.ok(await evaluate(`Boolean(document.querySelector('#spark-mode-usb'))`));
    await more('disconnect');
    await pause(150);
    assert.ok((await snapshot()).wires.every(wire => wire.attached === 'false'));
    await click('[data-action="close"]');
    cases.push('spark: A–D monitored; E–H unknown, no invented motor attachment; supplied SVG; ' +
        'existing connection and firmware/logs retained');

    enableEst();
    await select('est');
    await evaluate(`document.querySelector('button[title="硬件状态"]').click()`);
    await wait(`document.querySelectorAll('#est-hardware-panel [data-port]').length===8`);
    assert.equal((await snapshot()).ports.map(port => port.label).join(''), 'ABCD1234');
    assert.ok(await evaluate(`(() => {
        const panel=document.querySelector('#est-hardware-panel');
        const hub=panel.querySelector('img').parentElement.getBoundingClientRect();
        return [...panel.querySelectorAll('[data-port]')].every(port => {
            const r=port.getBoundingClientRect();
            return /[ABCD]/.test(port.dataset.port) ? r.bottom < hub.top : r.top > hub.bottom;
        });
    })()`), 'EST motors sit above the controller; sensor ports sit below');
    await click('[data-port="A"]');
    assert.ok(await evaluate(`document.querySelector('[data-port-detail]').dataset.portDetail==='A'`));
    await click('[data-port="1"]');
    assert.ok(await evaluate(`document.querySelector('[data-port-detail]').dataset.portDetail==='1'`));
    await click('[data-port="1"]');
    await more('info');
    assert.ok((await snapshot()).text.includes('固件'));
    await click('[data-action="back"]');
    await capture('est-desktop.png');
    for (const width of [800, 390]) {
        window.setSize(width, 760);
        await pause(120);
        const overview = await snapshot();
        assert.ok(overview.fits);
        assert.equal(overview.ports.map(port => port.label).join(''), 'ABCD1234');
        assert.ok(overview.wires.every(wire => wire.d.includes(' V ') && wire.d.includes(' H ')));
        if (width === 390) await capture('est-vertical-390.png');
    }
    window.setSize(1280, 760);
    await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
    assert.equal(await evaluate(`Boolean(document.querySelector('#est-hardware-panel'))`), false);
    cases.push('est: native 1–4/A–D mapping, existing firmware actions retained; ' +
        'Escape and close work without blocking the editor');
    const operations = requests();
    assert.ok([...operations.newAi, ...operations.spark].every(item =>
        !['download', 'run', 'stop', 'firmware-update'].includes(item.action)));
    fs.writeFileSync(path.join(output, 'hardware-status-validation.json'), JSON.stringify({passed: true,
        cases,
        captures: captureEnabled,
        widths: [1280, 800, 390],
        realHardwareCommands: 0,
        firmwareModified: false}, null, 2));
    console.log(`Hardware status UI passed. ${output}`);
};
