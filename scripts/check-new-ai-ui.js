// Used by the isolated compiled-renderer harness; never connects to real hardware.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');
const catalog = require('../src/renderer/new-ai/catalog.json');
const checkTelemetryUi = require('./check-new-ai-telemetry-ui');
const checkBlockLocales = require('./check-new-ai-locales');
const checkBleUi = require('./check-new-ai-ble-ui');

module.exports = async ({evaluate, pause, window, output, chooseHardware, newAiRequests, setNewAiTestState}) => {
    await chooseHardware('new-ai');
    await evaluate(`window.dispatchEvent(new CustomEvent('est-home-set-locale', {detail:{locale:'zh-cn'}}))`);
    await pause(500);
    const inventory = await evaluate(`(() => {
        const editor = findLocaleTestBlocks(), B = editor.ScratchBlocks;
        const rows = ${JSON.stringify(catalog.blocks)};
        const xml = document.createElement('xml');
        for (const row of rows) {
            const block = document.createElement('block'); block.setAttribute('type', 'new_' + row.id);
            const fields = row.id === 'control_stop' ? {...row.fields, STOP_OPTION:'single'} : row.fields;
            for (const [name, value] of Object.entries(fields || {})) {
                const field = document.createElement('field'); field.setAttribute('name', name);
                field.textContent = value; block.appendChild(field);
            }
            for (const input of row.inputs) {
                const value = document.createElement('value'); value.setAttribute('name', input.name);
                const shadow = document.createElement('shadow'); shadow.setAttribute('type', 'new_' + input.type);
                for (const [name, value] of Object.entries(input.fields || {})) {
                    const field = document.createElement('field'); field.setAttribute('name', name);
                    field.textContent = value; shadow.appendChild(field);
                }
                value.appendChild(shadow); block.appendChild(value);
            }
            xml.appendChild(block);
        }
        window.newUiFixtureXml = xml;
        const test = new B.Workspace();
        try {
            B.Xml.domToWorkspace(xml, test);
            B.NewPython.init(test);
            const errors = [];
            for (const row of rows) {
                const block = test.getAllBlocks().find(b => b.type === 'new_' + row.id);
                try { B.NewPython[block.type](block); } catch(error) { errors.push(row.id + ': ' + error.message); }
            }
            return {fixed:test.getTopBlocks().length, errors,
                categories:Array.from(document.querySelectorAll('.scratchCategoryMenuItemLabel'))
                    .map(element => element.textContent.trim()),
                types:editor.workspace.getAllBlocks().map(block => block.type),
                codeButton:Boolean(document.querySelector('[class*=EstCodeDrawerToggle_toggle-button]')),
                controls:Boolean(document.querySelector('#spark-program-controls')),
                camera:Boolean(document.querySelector('#est-vision-open')),
                assistant:!document.querySelector('.est-menu-bar-ai-button').hidden};
        } finally {test.dispose();}
    })()`);
    assert.equal(inventory.fixed, 107);
    assert.deepStrictEqual(inventory.errors, []);
    assert.equal(inventory.categories.length, 12);
    assert.ok(inventory.categories.includes('摄像头识别') && inventory.categories.includes('巡线卡 V2'));
    assert.deepStrictEqual(inventory.types, ['new_event_whenflagclicked']);
    assert.equal(inventory.codeButton, true);
    assert.equal(inventory.controls, false);
    assert.equal(inventory.camera, false);
    assert.equal(inventory.assistant, true);
    await checkBlockLocales({evaluate, pause, window, output});
    assert.ok(await evaluate('Boolean(document.querySelector("#new-ai-program-controls"))'));
    assert.ok(await evaluate('document.querySelector("#new-ai-program-controls [data-action=download]").disabled'));
    await evaluate('document.querySelector("#new-ai-program-controls [data-action=compile]").click()');
    await pause(180);
    assert.equal(newAiRequests.at(-1).action, 'compile', 'offline compile is available before connection');
    const operationText = 'document.querySelector("#new-ai-program-controls [role=status]").textContent';
    assert.ok((await evaluate(operationText)).includes('编译检查通过'));
    await evaluate('document.querySelector("#new-ai-connection").click()');
    await pause(150);
    await evaluate('document.querySelector("#new-ai-hardware-panel [data-action=connect]").click()');
    await pause(40);
    assert.ok(await evaluate('document.querySelector("#new-ai-connection").textContent.includes("正在确认")'));
    await pause(350);
    assert.deepStrictEqual(newAiRequests.at(-1), {action: 'connect', path: 'COM_NEW'});
    const connection = await evaluate(`(() => {
        const panel = document.querySelector('#new-ai-hardware-panel');
        return {version:panel.querySelector('dl').textContent.includes('321'),
            ports:Array.from(panel.querySelectorAll('[class*=SparkRuntime_port_] strong')).map(e=>e.textContent),
            disconnect:!panel.querySelector('[data-action=disconnect]').disabled};
    })()`);
    assert.deepStrictEqual(connection, {version: true, ports: 'ABCDEFGH'.split(''), disconnect: true});
    setNewAiTestState({memoryError: 'NEW_CONNECTION_MEMORY_FAILED'});
    await pause(80);
    assert.ok(await evaluate('document.querySelector("#new-ai-connection-memory").textContent.includes("未能保存")'));
    setNewAiTestState({memoryError: null}); await pause(80);
    assert.ok(await evaluate('document.querySelector("#new-ai-connection-memory").textContent.includes("保存在本机")'));
    await evaluate(`(() => {
        document.querySelector('#new-ai-program-controls [aria-expanded]').click();
    })()`);
    assert.equal(await evaluate('document.querySelectorAll("#new-ai-program-controls [data-slot]").length'), 20);
    await evaluate(`document.querySelector('#new-ai-program-controls [data-slot="19"]').click()`);
    await evaluate('document.querySelector("#new-ai-hardware-panel header button").click()');
    await evaluate('document.querySelector("#new-ai-program-controls [data-action=download]").click()');
    await pause(100);
    assert.ok(await evaluate('Boolean(document.querySelector("#new-ai-program-controls progress"))'));
    assert.ok(await evaluate('document.querySelector("#new-ai-program-controls [data-action=compile]").disabled'));
    await pause(350);
    assert.equal(newAiRequests.at(-1).action, 'download');
    assert.equal(newAiRequests.at(-1).slot, 19);
    assert.equal(newAiRequests.at(-1).source, await evaluate('findLocaleTestBlocks().workspaceToCode()'));
    assert.ok((await evaluate(operationText)).includes('确认保存'));
    window.webContents.invalidate();
    fs.writeFileSync(path.join(output, 'new-ai-download.png'), (await window.webContents.capturePage()).toPNG());
    await evaluate('document.querySelector("#new-ai-program-controls [data-action=run]").click()');
    await pause(100);
    assert.equal(newAiRequests.at(-1).action, 'run');
    assert.equal(newAiRequests.at(-1).slot, 19);
    assert.equal(newAiRequests.at(-1).source, await evaluate('findLocaleTestBlocks().workspaceToCode()'));
    assert.ok(await evaluate('document.querySelector("#new-ai-program-controls [data-action=stop]").disabled'));
    await pause(450);
    assert.ok((await evaluate(operationText)).includes('已观察到程序运行'));
    for (const action of ['download', 'run']) {
        assert.ok(await evaluate(
            `document.querySelector('#new-ai-program-controls [data-action=${action}]').disabled`));
    }
    assert.ok(await evaluate('!document.querySelector("#new-ai-program-controls [data-action=stop]").disabled'));
    window.webContents.invalidate();
    fs.writeFileSync(path.join(output, 'new-ai-running.png'), (await window.webContents.capturePage()).toPNG());
    await evaluate('document.querySelector("#new-ai-program-controls [data-action=stop]").click()');
    await pause(40);
    assert.ok((await evaluate(operationText)).includes('正在确认主机停止'));
    await pause(180);
    assert.deepStrictEqual(newAiRequests.at(-1), {action: 'stop'});
    assert.ok((await evaluate(operationText)).includes('已确认主机程序停止'));
    assert.ok(await evaluate('!document.querySelector("#new-ai-program-controls [data-action=run]").disabled'));
    await evaluate('document.querySelector("#new-ai-connection").click()');
    await pause(120);
    await evaluate('document.querySelector("#new-ai-firmware-toggle").click()');
    await pause(120);
    assert.equal(await evaluate('document.querySelectorAll("#new-ai-firmware-panel tbody tr").length'), 109);
    assert.ok(await evaluate('document.querySelector("#new-ai-firmware-start").disabled'));
    setNewAiTestState({status: {version: 214,
        legacyProtocol: true,
        running: null,
        battery: null,
        ports: Array.from({length: 8}, (_, port) => ({port, label: 'ABCDEFGH'[port], type: 'unknown'}))},
    result: null,
    downloadSupported: false,
    programSupported: false});
    await pause(100);
    assert.ok(await evaluate('document.querySelector("#new-ai-hardware-panel").textContent.includes("运行状态未知")'));
    assert.ok(await evaluate('document.querySelector("#new-ai-program-controls [data-action=run]").disabled'));
    await evaluate('document.querySelector("#new-ai-firmware-confirm").click()');
    assert.ok(await evaluate('document.querySelector("#new-ai-firmware-start").disabled'), 'legacy needs idle consent');
    await evaluate('document.querySelector("#new-ai-firmware-legacy-idle").click()');
    assert.ok(await evaluate('!document.querySelector("#new-ai-firmware-start").disabled'));
    window.webContents.invalidate();
    fs.writeFileSync(path.join(output, 'new-ai-firmware-legacy.png'), (await window.webContents.capturePage()).toPNG());
    await evaluate('document.querySelector("#new-ai-firmware-start").click()');
    await pause(130);
    assert.equal(newAiRequests.at(-1).action, 'firmware');
    assert.equal(newAiRequests.at(-1).confirmedErase, true);
    assert.equal(newAiRequests.at(-1).confirmedLegacyIdle, true);
    assert.ok(await evaluate('document.querySelector("#new-ai-program-controls [data-action=compile]").disabled'));
    assert.ok(await evaluate('!document.querySelector("#new-ai-program-controls [data-action=cancel]")'));
    await evaluate('document.querySelector("#new-ai-hardware-panel header button").click()');
    await evaluate('document.querySelector("#new-ai-connection").click()');
    await pause(80);
    assert.ok(await evaluate('Boolean(document.querySelector("#new-ai-firmware-panel progress"))'));
    await pause(250);
    assert.ok(await evaluate('document.querySelector("#new-ai-firmware-panel").textContent.includes("升级完成")'));
    assert.ok(await evaluate('!document.querySelector("#new-ai-firmware-confirm").checked'));
    assert.ok(await evaluate('!document.querySelector("#new-ai-program-controls [data-action=run]").disabled'));
    await checkTelemetryUi({evaluate, pause, window, output, setNewAiTestState});
    for (const [locale, title, runLabel, stopLabel] of [
        ['zh-cn', 'NEW AI 连接与状态', '下载并运行', '停止程序'],
        ['en', 'NEW AI connection and status', 'Download and run', 'Stop program'],
        ['pt-br', 'Conexão e status do NEW AI', 'Transferir e executar', 'Parar programa'],
        ['zh-tw', 'NEW AI 連線與狀態', '下載並執行', '停止程式'],
        ['ru', 'Подключение и состояние NEW AI', 'Загрузить и запустить', 'Остановить программу']]) {
        await evaluate(`window.dispatchEvent(new CustomEvent('est-home-set-locale',
            {detail:{locale:${JSON.stringify(locale)}}}))`);
        await pause(250);
        await evaluate(`(() => {
            if (!document.querySelector('#new-ai-hardware-panel')) document.querySelector('#new-ai-connection').click();
        })()`);
        await pause(120);
        assert.equal(await evaluate('document.querySelector("#new-ai-panel-title").textContent'), title);
        assert.equal(await evaluate('localStorage.getItem("estStudio.newAiProgramSlot")'), '19');
        assert.equal(await evaluate(
            'document.querySelector("#new-ai-program-controls [data-action=run]").title'), runLabel);
        assert.equal(await evaluate(
            'document.querySelector("#new-ai-program-controls [data-action=stop]").title'), stopLabel);
        await evaluate(`(() => {
            if (!document.querySelector('#new-ai-firmware-panel')) {
                document.querySelector('#new-ai-firmware-toggle').click();
            }
        })()`);
        await pause(80);
        assert.equal(await evaluate('document.querySelectorAll("#new-ai-firmware-panel tbody tr").length'), 109);
        const firmwareLabels = {'zh-cn': '固件更新',
            'en': 'Firmware update',
            'pt-br': 'Atualização de firmware',
            'zh-tw': '韌體更新',
            'ru': 'Обновление прошивки'};
        assert.equal(await evaluate('document.querySelector("#new-ai-firmware-toggle").textContent'),
            firmwareLabels[locale]);
        const microphoneLabels = {'zh-cn': '麦克风电压',
            'en': 'Microphone voltage',
            'pt-br': 'Tensão do microfone',
            'zh-tw': '麥克風電壓',
            'ru': 'Напряжение микрофона'};
        assert.equal(await evaluate(
            'document.querySelector("#new-ai-telemetry [data-metric=microphone] dt").textContent'),
        microphoneLabels[locale]);
    }
    await evaluate(`window.dispatchEvent(new CustomEvent('est-home-set-locale', {detail:{locale:'zh-cn'}}))`);
    await pause(250);
    await evaluate(`(() => {
        if (!document.querySelector('#new-ai-hardware-panel')) document.querySelector('#new-ai-connection').click();
    })()`);
    await pause(120);
    await evaluate(`(() => {
        if (!document.querySelector('#new-ai-firmware-panel')) {
            document.querySelector('#new-ai-firmware-toggle').click();
        }
    })()`);
    await pause(80);
    for (const width of [800, 1280]) {
        window.setSize(width, 860);
        await pause(150);
        const fits = await evaluate(`(() => {
            const panel = document.querySelector('#new-ai-hardware-panel'), box = panel.getBoundingClientRect();
            return box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight &&
                panel.scrollWidth <= panel.clientWidth;
        })()`);
        assert.ok(fits, `NEW AI connection panel fits at ${width}`);
        const controlsFit = await evaluate(`(() => {
            const controls = document.querySelector('#new-ai-program-controls');
            const box = controls.getBoundingClientRect();
            return {left:box.left, right:box.right, bottom:box.bottom, width:box.width,
                viewport:innerWidth, height:innerHeight, scroll:controls.scrollWidth, client:controls.clientWidth,
                children:Array.from(controls.children).map(e => {
                    const b = e.getBoundingClientRect(); return {left:b.left, right:b.right, width:b.width};
                })};
        })()`);
        window.webContents.invalidate();
        fs.writeFileSync(path.join(output, `new-ai-controls-${width}.png`),
            (await window.webContents.capturePage()).toPNG());
        assert.ok(controlsFit.left >= 0 && controlsFit.right <= controlsFit.viewport &&
            controlsFit.bottom <= controlsFit.height &&
            // The shared controls have a decorative ::before halo outside their client box.
            // Check the actual visible groups and message rather than that decoration's scrollWidth.
            controlsFit.children.every(child => child.left >= 0 && child.right <= controlsFit.viewport),
        `NEW AI program controls fit at ${width}: ${JSON.stringify(controlsFit)}`);
    }
    window.webContents.invalidate();
    fs.writeFileSync(path.join(output, 'new-ai-connection.png'), (await window.webContents.capturePage()).toPNG());
    await evaluate('document.querySelector("#new-ai-hardware-panel [data-action=disconnect]").click()');
    await pause(120);
    assert.equal(newAiRequests.at(-1).action, 'disconnect');
    assert.equal(await evaluate('document.querySelector("#new-ai-hardware-panel input").checked'), false);
    await evaluate(`(() => {
        if (!document.querySelector('#new-ai-firmware-panel')) {
            document.querySelector('#new-ai-firmware-toggle').click();
        }
    })()`);
    await pause(80);
    await evaluate('document.querySelector("#new-ai-firmware-recovery").click()');
    await evaluate('document.querySelector("#new-ai-firmware-confirm").click()');
    assert.ok(await evaluate('document.querySelector("#new-ai-firmware-start").disabled'),
        'recovery needs product confirmation');
    await evaluate('document.querySelector("#new-ai-firmware-confirm-device").click()');
    assert.ok(await evaluate('!document.querySelector("#new-ai-firmware-start").disabled'));
    await evaluate('document.querySelector("#new-ai-firmware-recovery").click()');
    await evaluate('document.querySelector("#new-ai-hardware-panel input").click()');
    await pause(100);
    assert.deepStrictEqual(newAiRequests.at(-1), {action: 'automatic', enabled: true});
    await evaluate('document.querySelector("#new-ai-hardware-panel header button").click()');
    console.log('NEW AI connection/program UI passed: USB routing, version/8 ports, compile, download/run/stop, ' +
        'busy states, legacy firmware/erase/recovery confirmations, progress/reopen, ' +
        'automatic reconnect checkbox, 5 locales and 800/1280 layouts.');
    await checkBleUi({evaluate, pause, window, output, newAiRequests, setNewAiTestState});
    // Display representative blocks and test actual SVG fields, not a mock generator.
    await evaluate(`(() => {
        const editor = findLocaleTestBlocks(), B = editor.ScratchBlocks;
        editor.workspace.clear();
        const wanted = ['new_event_whenflagclicked','new_combined_motor_starting','new_matrix_lamp',
            'new_cameraRecognition_cam_dis_id', 'new_control_stop'];
        const xml = newUiFixtureXml.cloneNode(true);
        for (const block of Array.from(xml.children)) {
            if (!wanted.includes(block.getAttribute('type'))) block.remove();
        }
        B.Xml.domToWorkspace(xml, editor.workspace);
        editor.workspace.getTopBlocks(false).forEach((block,index) => block.moveBy(70, 40 + index * 100));
        window.newMatrixField = editor.workspace.getAllBlocks()
            .find(block => block.type === 'new_matrix_lamp').getField('lamp');
        newMatrixField.setValue('0'.repeat(63));
        newMatrixField.showEditor_();
    })()`);
    const matrix = await evaluate(`(() => {
        const field = newMatrixField, nodes = field.ledButtons_;
        for (const index of [0,62]) {
            const bounds = nodes[index].getBoundingClientRect();
            field.onMouseDown({clientX:bounds.x+bounds.width/2, clientY:bounds.y+bounds.height/2,
                button:0, preventDefault(){}, stopPropagation(){}});
            field.onMouseUp();
        }
        return {count:nodes.length, width:field.width_, height:field.height_, value:field.getValue()};
    })()`);
    assert.equal(matrix.count, 63);
    assert.equal(matrix.width, 7);
    assert.equal(matrix.height, 9);
    assert.equal(matrix.value, `1${'0'.repeat(61)}1`);
    window.webContents.invalidate();
    await pause(100);
    fs.writeFileSync(path.join(output, 'new-ai-matrix.png'), (await window.webContents.capturePage()).toPNG());
    await evaluate(`(() => {
        const editor = findLocaleTestBlocks(); editor.ScratchBlocks.DropDownDiv.hideWithoutAnimation();
        window.newPairField = editor.workspace.getAllBlocks()
            .find(block => block.type === 'new_combined_motor_box').getField('MOTOR');
        newPairField.showEditor_();
    })()`);
    const pair = await evaluate(`(() => {
        const panel = document.querySelector('.new-combined-motor-selector');
        const options = Array.from(panel.querySelectorAll('[data-motor-port]')).map(b => b.dataset.motorPort);
        newPairField.setValue('A+B'); panel.querySelector('[data-motor-port=H]').click();
        const first = newPairField.getValue(); panel.querySelector('[data-motor-port=C]').click();
        return {options, first, pair:newPairField.getValue()};
    })()`);
    assert.deepStrictEqual(pair, {options: 'ABCDEFGH'.split(''), first: 'H', pair: 'H+C'});
    window.webContents.invalidate();
    await pause(100);
    fs.writeFileSync(path.join(output, 'new-ai-paired-motors.png'), (await window.webContents.capturePage()).toPNG());
    const program = await evaluate(`(() => {
        const editor = findLocaleTestBlocks(), B = editor.ScratchBlocks;
        B.DropDownDiv.hideWithoutAnimation();
        const stop = editor.workspace.getAllBlocks().find(block => block.type === 'new_control_stop');
        stop.setFieldValue('other','STOP_OPTION');
        const dynamicShape = Boolean(stop.nextConnection);
        const saved = B.Xml.workspaceToDom(editor.workspace);
        const test = new B.Workspace();
        let roundTrip;
        try {
            B.Xml.domToWorkspace(saved, test);
            roundTrip = {matrix:test.getAllBlocks().find(b => b.type === 'new_matrix_lamp').getFieldValue('lamp'),
                pair:test.getAllBlocks().find(b => b.type === 'new_combined_motor_box').getFieldValue('MOTOR'),
                next:Boolean(test.getAllBlocks().find(b => b.type === 'new_control_stop').nextConnection)};
        } finally {test.dispose();}
        const tail = editor.workspace.newBlock('new_sensing_reset_timer');
        tail.initSvg(); tail.render();
        stop.nextConnection.connect(tail.previousConnection);
        stop.setFieldValue('single','STOP_OPTION');
        const tailPreserved = tail.getParent() === null;
        tail.dispose();
        const closedShape = !stop.nextConnection;
        const hat = editor.workspace.getAllBlocks().find(b => b.type === 'new_event_whenflagclicked');
        const matrix = editor.workspace.getAllBlocks().find(b => b.type === 'new_matrix_lamp');
        const pair = editor.workspace.getAllBlocks().find(b => b.type === 'new_combined_motor_starting');
        hat.nextConnection.connect(pair.previousConnection);
        pair.nextConnection.connect(matrix.previousConnection);
        return {dynamicShape, closedShape, tailPreserved, roundTrip, source:editor.workspaceToCode()};
    })()`);
    assert.equal(program.dynamicShape, true);
    assert.equal(program.closedShape, true);
    assert.equal(program.tailPreserved, true);
    assert.deepStrictEqual(program.roundTrip, {matrix: matrix.value, pair: 'H+C', next: true});
    assert.ok(program.source.includes('_thread.start_new_thread'));
    assert.ok(program.source.includes('_matrix') && !program.source.includes('est_runtime'));
    const native = await evaluate(`(() => {
        const editor = findLocaleTestBlocks(), B = editor.ScratchBlocks, test = editor.workspace;
        const saved = B.Xml.workspaceToDom(test);
        const mutation = '<mutation proccode="check %s %b" argumentids="[&quot;amount&quot;,&quot;flag&quot;]"' +
            ' argumentnames="[&quot;amount&quot;,&quot;flag&quot;]"' +
            ' argumentdefaults="[&quot;&quot;,false]" warp="false"></mutation>';
        const xml = '<xml><variables><variable type="" id="v">速度</variable>' +
            '<variable type="list" id="l">数据</variable>' +
            '</variables><block type="procedures_definition"><statement name="custom_block">' +
            '<shadow type="procedures_prototype">' + mutation + '</shadow></statement>' +
            '<next><block type="data_setvariableto"><field name="VARIABLE" id="v">速度</field>' +
            '<value name="VALUE"><block type="argument_reporter_string_number"><field name="VALUE">amount</field>' +
            '</block></value></block></next></block>' +
            '<block type="new_event_whenflagclicked"><next><block type="procedures_call">' + mutation +
            '<value name="amount"><shadow type="text"><field name="TEXT">hello</field></shadow></value>' +
            '<next><block type="new_control_repeat"><value name="TIMES"><shadow type="new_math_whole_number">' +
            '<field name="NUM">2</field></shadow></value><statement name="SUBSTACK"><block type="data_addtolist">' +
            '<field name="LIST" id="l" variabletype="list">数据</field><value name="ITEM">' +
            '<shadow type="text"><field name="TEXT">item</field></shadow></value>' +
            '</block></statement></block></next></block></next></block></xml>';
        B.Events.disable();
        try {
            test.clear();
            B.Xml.domToWorkspace(B.Xml.textToDom(xml), test);
            return B.NewPython.workspaceToCode(test);
        } finally {
            test.clear();
            B.Xml.domToWorkspace(saved, test);
            B.Events.enable();
        }
    })()`);
    assert.ok(native.includes('PikaStdData.List()') && native.includes('.append('));
    assert.ok(/def check_s_b\(/i.test(native), native);
    assert.ok(!/\bfalse\b|undefined|NaN/.test(native), native);
    const syntax = spawnSync('python', [path.join(__dirname, 'check-python-syntax.py')], {
        input: JSON.stringify({cases: [{name: 'new-ai-editor', source: program.source},
            {name: 'new-ai-native-data-procedure', source: native}]}),
        encoding: 'utf8',
        windowsHide: true,
        timeout: 20000,
        env: {...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1'}
    });
    assert.equal(syntax.status, 0, syntax.stdout + syntax.stderr);
    await chooseHardware('spark-ai');
    await chooseHardware('new-ai');
    assert.equal(await evaluate('findLocaleTestBlocks().workspaceToCode()'), program.source);
    await evaluate(`window.dispatchEvent(new CustomEvent('est-home-set-locale', {detail:{locale:'pt-br'}}))`);
    await pause(300);
    const summary = 'NEW AI editor passed: 107 blocks, 12 categories, 7x9 matrix, A-H paired selector, ' +
        'stop mutation, project round-trip, isolated drafts and actual generated Python syntax.';
    console.log(`${summary} Screenshots: ${output}`);
};
