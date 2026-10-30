const assert = require('assert');
const fs = require('fs');
const path = require('path');

module.exports = async ({evaluate, pause, window, output}) => {
    const wait = async predicate => {
        for (let count = 0; count < 100; count++) {
            if (await evaluate(predicate)) return;
            await pause(60);
        }
        throw Error(`EST wire view did not settle: ${predicate}`);
    };
    await evaluate('document.querySelector("#est-connection").click()');
    await wait(`document.querySelectorAll('#est-hardware-panel [data-wire][d^="M "]').length===8`);
    const results = [];
    for (const width of [1280, 800, 390]) {
        window.setSize(width, 760);
        await pause(180);
        const result = await evaluate(`(() => {
            const root=document.querySelector('#est-hardware-panel');
            const box=root.getBoundingClientRect();
            return {width:innerWidth, fits:box.left>=0&&box.right<=innerWidth&&box.bottom<=innerHeight,
                labels:[...root.querySelectorAll('[data-port]')].map(p=>p.dataset.port).join(''),
                wires:[...root.querySelectorAll('[data-wire]')].map(p=>({label:p.dataset.wire,d:p.getAttribute('d')}))};
        })()`);
        assert.ok(result.fits);
        assert.equal(result.labels, 'ABCD1234');
        const bends = result.wires.map(wire => Number(wire.d.match(/ V ([\d.]+)/)[1]));
        for (const start of [0, 4]) {
            assert.ok(Math.abs(bends[start] - bends[start + 1]) >= 10, 'inner and outer wire lanes stay apart');
            assert.equal(bends[start], bends[start + 3]);
            assert.equal(bends[start + 1], bends[start + 2]);
        }
        results.push(result);
        if (width !== 800) {
            fs.writeFileSync(path.join(output, `est-wires-${width}.png`),
                (await window.webContents.capturePage()).toPNG());
        }
    }
    await evaluate('document.querySelector("[data-port=A]").click()');
    assert.equal(await evaluate('document.querySelector("[data-wire=A]").dataset.selected'), 'true');
    await evaluate(`document.querySelector('[data-port="1"]').click()`);
    assert.equal(await evaluate(`document.querySelector('[data-wire="1"]').dataset.selected`), 'true');
    fs.writeFileSync(path.join(output, 'est-wires-validation.json'), JSON.stringify({passed: true,
        results,
        realHardwareCommands: 0}, null, 2));
    console.log(`EST wire layout passed: ${output}`);
};
