const assert = require('assert');
const fs = require('fs');
const path = require('path');
const checkFirmware = require('../spark-firmware-ui/check');

module.exports = async context => {
    const {evaluate, pause, window, output} = context;
    const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    await evaluate(`window.sparkReleaseErrors = [];
        window.addEventListener('error', event => sparkReleaseErrors.push(event.message));`);
    await evaluate('void Object.defineProperty(document, "hidden", {configurable: true, value: false})');
    await click('#atc-home-hardware');
    await pause(100);
    await click('[data-home-hardware="spark-ai"]');
    await click('button[class*="startButton_"]');
    for (let i = 0; i < 80; i++) {
        if (await evaluate('Boolean(document.querySelector("#spark-connection"))')) break;
        await pause(100);
    }
    assert.ok(await evaluate('Boolean(document.querySelector("#spark-connection"))'));
    await pause(1500);
    console.log('Spark release UI: homepage created the Spark AI workspace.');
    const locales = [];
    for (const locale of ['zh-cn', 'zh-tw', 'en', 'pt-br', 'ru']) {
        await evaluate(`window.dispatchEvent(new CustomEvent('est-home-set-locale',
            {detail:{locale:${JSON.stringify(locale)}}}))`);
        await pause(900);
        const result = await evaluate(`(() => {
            const e = findLocaleTestBlocks(), B = e.ScratchBlocks;
            e.workspace.toolbox_.scrollToCategoryById('spark_sensing');
            // Finish the scroll before the next locale disposes this offscreen flyout.
            const flyout = e.workspace.getFlyout();
            if (flyout.scrollTarget) {
                flyout.scrollbar_.set(flyout.scrollTarget);
                flyout.scrollTarget = null;
            }
            const block = e.workspace.getFlyout().getWorkspace().getAllBlocks()
                .find(b => b.type === 'spark_sensing_infrared_set_color');
            if (!block) throw new Error('Infrared block missing from actual sensing flyout');
            const field = block.getField('STATE');
            const port = block.getInputTargetBlock('PORT');
            return {text: block.toString(),
                options: field.getOptions().map(option => option.slice()),
                ports: port.getField('SENSING_MENU').getOptions().map(option => option[1]),
                colour: port.getColour(),
                rendered: Boolean(block.getSvgRoot()),
                hardware: JSON.parse(e.props.vm.toJSON()).meta.estStudio.hardwareId};
        })()`);
        assert.equal(result.hardware, 'spark-ai');
        assert.equal(result.rendered, true);
        assert.deepStrictEqual(result.ports, ['A', 'B', 'C', 'D']);
        assert.deepStrictEqual(result.options.map(option => option[1]), ['0', '1', '2', '3']);
        assert.equal(result.colour.toLowerCase(), '#00a8c9');
        if (['en', 'pt-br', 'ru'].includes(locale)) {
            assert.ok(!/[\u4e00-\u9fff]/.test(result.text + JSON.stringify(result.options)));
        }
        locales.push({locale, ...result});
        console.log(`Spark release UI: infrared block and menus passed for ${locale}.`);
        await pause(100);
        fs.writeFileSync(path.join(output, `spark-infrared-${locale}.png`),
            (await window.webContents.capturePage()).toPNG());
    }
    const generated = await evaluate(`(() => {
        const e = findLocaleTestBlocks(), B = e.ScratchBlocks, test = new B.Workspace();
        try {
            const source = e.workspace.getFlyout().getWorkspace().getAllBlocks()
                .find(b => b.type === 'spark_sensing_infrared_set_color');
            const xml = document.createElement('xml');
            xml.appendChild(B.Xml.blockToDom(source));
            B.Xml.domToWorkspace(xml, test);
            const block = test.getTopBlocks()[0], port = block.getInputTargetBlock('PORT');
            const codes = [];
            for (const name of ['A', 'B', 'C', 'D']) {
                port.setFieldValue(name, 'SENSING_MENU');
                for (const state of ['0', '1', '2', '3']) {
                    block.setFieldValue(state, 'STATE'); B.SparkPython.init(test);
                    codes.push(B.SparkPython[block.type](block));
                }
            }
            const saved = B.Xml.workspaceToDom(test);
            test.clear(); B.Xml.domToWorkspace(saved, test);
            const restored = test.getTopBlocks()[0];
            return {codes, state: restored.getFieldValue('STATE'),
                port: restored.getInputTargetBlock('PORT').getFieldValue('SENSING_MENU')};
        } finally { test.dispose(); }
    })()`);
    assert.deepStrictEqual(generated.codes, [0, 1, 2, 3].flatMap(port =>
        [0, 1, 2, 3].map(state => `_ir_remote.set_color(${port}, ${state})\n`)));
    assert.equal(generated.state, '3');
    assert.equal(generated.port, 'D');
    await checkFirmware(context);
    assert.deepStrictEqual(await evaluate('sparkReleaseErrors'), [], 'release UI must not raise browser errors');
    fs.writeFileSync(path.join(output, 'spark-release-validation.json'), JSON.stringify({
        passed: true,
        software: 'Spark AI 1.1.10',
        firmware: 111,
        locales,
        generated,
        realHardwareCommands: 0
    }, null, 2));
    console.log(`Spark 1.1.10 UI passed: five locales, real fields, 16 mappings, XML save/reopen. ${output}`);
};
