/* eslint-disable global-require */
// Exercise the compiled renderer with an isolated profile and no hardware connection.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

if (!process.versions.electron) {
    const result = require('child_process').spawnSync(require('electron'), [__filename], {
        windowsHide: true, stdio: 'inherit', env: {...process.env, NODE_OPTIONS: ''}
    });
    process.exitCode = result.status === null ? 1 : result.status;
} else {
    const {app, BrowserWindow, ipcMain} = require('electron');
    const remote = require('@electron/remote/main');
    const output = fs.mkdtempSync(path.join(os.tmpdir(), 'est-locale-test-'));
    app.setPath('userData', path.join(output, 'profile'));
    remote.initialize();
    let cameraOpenRequests = 0;
    let cameraLocale;
    let openedCameraLocale;
    let hardwareRequests = 0;
    let hardwareActive = 0;
    let hardwareMaxActive = 0;
    let hardwareMockEnabled = false;
    let selectedHardware = 'est';
    const hardwareDrafts = new Map();
    for (const [name, handler] of Object.entries({
        'get-initial-project-data': () => null,
        'est-home-get-startup-state': () => ({hasInitialProject: true}),
        'est-home-list-recent-projects': () => [],
        'est-home-get-build-library-state': () => ({}),
        'hardware-state': () => ({hardwareId: selectedHardware, busy: false, running: false}),
        'hardware-select': (event, {hardwareId}) => {
            if (!['est', 'spark-ai', 'new-ai'].includes(hardwareId)) throw new Error('HARDWARE_UNKNOWN');
            selectedHardware = hardwareId;
            return {hardwareId, busy: false};
        },
        'hardware-draft-write': (event, draft) => { hardwareDrafts.set(draft.hardwareId, draft); },
        'hardware-draft-read': (event, hardwareId) => hardwareDrafts.get(hardwareId) || null,
        'est-auto-connect': () => (hardwareMockEnabled ?
            {state: 'connected', compatible: true, status: {programStatus: {state: 0}}} : {state: 'not-found'}),
        'est-vision-window-open': (event, locale) => { cameraOpenRequests++; openedCameraLocale = locale; },
        'est-vision-window-locale': (event, locale) => { cameraLocale = locale; },
        'est-hardware-status': async () => {
            hardwareRequests++;
            hardwareActive++;
            hardwareMaxActive = Math.max(hardwareMaxActive, hardwareActive);
            await new Promise(resolve => setTimeout(resolve, 200));
            hardwareActive--;
            return {state: 'connected', status: {firmwareVersion: 'M1.28H', protocolMajor: 1, protocolMinor: 31,
                batteryPercent: 85, batterySampleMv: 2000, batteryAdcRaw: 3200,
                motors: [{outputState: 0, powerPercent: 0, tachoCount: hardwareRequests}], sensors: [],
                programStatus: {state: 0}}};
        },
        'est-ai-status': () => ({ok: true, data: {configured: false, hasKey: false, config: {}}})
    })) ipcMain.handle(name, handler);
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    const timeout = setTimeout(() => app.exit(1), 90000);
    app.whenReady().then(async () => {
        const window = new BrowserWindow({show: false, width: 1280, height: 860,
            webPreferences: {nodeIntegration: true, contextIsolation: false, backgroundThrottling: false, offscreen: true}});
        remote.enable(window.webContents);
        window.webContents.on('console-message', (event, level, message) => {
            if (level >= 3) console.error('Renderer: ' + message);
        });
        const evaluate = async source => {
            const result = await window.webContents.executeJavaScript(`(async () => {
                try { return {value: await eval(${JSON.stringify(source)})}; }
                catch (error) { return {error: error.stack}; }
            })()`);
            if (result.error) throw new Error(result.error);
            return result.value;
        };
        try {
            await window.loadFile(path.resolve(__dirname, '../dist/renderer/index.html'));
            let ready = false;
            for (let i = 0; i < 150 && !ready; i++) {
                ready = await evaluate(`(() => {
                    window.findLocaleTestBlocks = () => {
                    for (const element of document.querySelectorAll('div')) {
                        let fiber = element[Object.keys(element).find(key => key.startsWith('__reactInternalInstance'))];
                        for (; fiber; fiber = fiber.return) {
                            const instance = fiber.stateNode;
                            if (instance && instance.ScratchBlocks && instance.workspace &&
                                typeof instance.setLocale === 'function' && instance.workspace.getFlyout()) {
                                window.localeTestBlocks = instance;
                                return instance;
                            }
                        }
                    }
                    return null;
                    };
                    return Boolean(window.findLocaleTestBlocks());
                })()`);
                await pause(100);
            }
            assert.ok(ready, 'editor must mount');
            await pause(1000);
            const loadedExtensions = () => evaluate('window.findLocaleTestBlocks().props.vm.runtime.getLoadedDeviceExtension()');
            assert.deepStrictEqual(await loadedExtensions(), [], 'new projects must not load vision');
            assert.strictEqual(await evaluate(`window.findLocaleTestBlocks().workspace.getFlyout().getWorkspace()
                .getAllBlocks().filter(b => /^(vision_|event_vision_)/.test(b.type)).length`), 0);
            await evaluate(`(async () => { window.blankVisionProject = await window.findLocaleTestBlocks().props.vm.saveProjectSb3(); })()`);
            const selectVision = async () => {
                await evaluate(`document.querySelector('button[class*="extension-button"]').click()`);
                await pause(400);
                assert.ok(await evaluate('Boolean(document.querySelector("[class*=library-item-extension]"))'),
                    'native extension library must contain the vision card');
                const icon = await evaluate(`(() => {
                    const img = document.querySelector('[class*="library-item-extension"] img');
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
                    const context = canvas.getContext('2d');
                    context.drawImage(img, 0, 0);
                    const rect = img.getBoundingClientRect();
                    return {source: img.src, loaded: img.complete && img.naturalWidth > 0,
                        width: rect.width, height: rect.height,
                        cornerAlpha: context.getImageData(0, 0, 1, 1).data[3],
                        centerAlpha: context.getImageData(canvas.width >> 1, canvas.height >> 1, 1, 1).data[3]};
                })()`);
                assert.ok(icon.loaded && icon.source.endsWith('.png'), 'generated PNG must render');
                assert.strictEqual(icon.cornerAlpha, 0, 'background must have real alpha transparency');
                assert.ok(icon.centerAlpha > 200, 'camera icon must be visible');
                assert.strictEqual(icon.width, 136);
                assert.strictEqual(icon.height, 136);
                window.webContents.invalidate();
                await pause(150);
                fs.writeFileSync(path.join(output, 'vision-extension-library.png'),
                    (await window.webContents.capturePage()).toPNG());
                await evaluate(`document.querySelector('[class*="library-item-extension"]').click()`);
                await pause(600);
                assert.strictEqual(await evaluate('Boolean(document.querySelector("[class*=library-item-extension]"))'),
                    false, 'native library must close after selection');
                assert.deepStrictEqual(await loadedExtensions(), ['vision']);
                assert.strictEqual(await evaluate(`window.findLocaleTestBlocks().workspace.toolbox_.getSelectedCategoryId()`),
                    'vision', 'native category-selection callback must select vision');
                assert.strictEqual(await evaluate(`window.findLocaleTestBlocks().workspace.getFlyout().getWorkspace()
                    .getAllBlocks().filter(b => /^(vision_|event_vision_)/.test(b.type)).length`), 12);
                assert.strictEqual(await evaluate(`window.findLocaleTestBlocks().workspace.getFlyout().getWorkspace()
                    .getAllBlocks().some(b => b.type.startsWith('event_vision_'))`), false);
            };
            await selectVision();
            await selectVision();
            await evaluate(`(async () => { const vm = window.findLocaleTestBlocks().props.vm;
                const saved = await vm.saveProjectSb3();
                await vm.loadProject(await saved.arrayBuffer()); })()`);
            await pause(700);
            assert.deepStrictEqual(await loadedExtensions(), ['vision'], 'unused selected extension must survive save/reopen');
            assert.ok(await evaluate(`Boolean(document.getElementById('est-vision-open'))`),
                'fresh editor must expose camera entry without first visiting home');
            for (const [width, height] of [[1000, 720], [1280, 860], [1620, 940]]) {
                window.setSize(width, height);
                await pause(350);
                const menu = await evaluate(`(() => {
                    const camera = document.getElementById('est-vision-open');
                    const ai = document.querySelector('.est-menu-bar-ai-button');
                    const code = camera.nextElementSibling;
                    const a = ai.getBoundingClientRect(), c = camera.getBoundingClientRect();
                    const d = code.getBoundingClientRect();
                    return {count: document.querySelectorAll('#est-vision-open').length,
                        inMenu: Boolean(camera.closest('[class*="menu-bar_tail-menu_"]')),
                        dock: Boolean(document.querySelector('[class*="visionDock"]')),
                        icon: camera.querySelector('img').naturalWidth > 0,
                        label: camera.getAttribute('aria-label'), text: camera.textContent.trim(),
                        sameStyle: camera.className === code.className,
                        fits: a.right <= c.left && c.right <= d.left && d.right <= innerWidth,
                        aligned: c.top === d.top && c.height === d.height && c.width === d.width,
                        x: c.x + c.width / 2, y: c.y + c.height / 2};
                })()`);
                assert.strictEqual(menu.count, 1);
                assert.ok(menu.inMenu && !menu.dock && menu.icon && menu.label && menu.sameStyle,
                    JSON.stringify(menu));
                assert.ok(menu.fits && menu.aligned, 'menu geometry at ' + width + ': ' + JSON.stringify(menu));
                assert.strictEqual(menu.text, '');
                window.webContents.sendInputEvent({type: 'mouseMove', x: Math.round(menu.x), y: Math.round(menu.y)});
                await pause(100);
                assert.notStrictEqual(await evaluate(`getComputedStyle(document.getElementById('est-vision-open')).backgroundColor`),
                    'rgba(0, 0, 0, 0)', 'camera hover highlight');
                fs.writeFileSync(path.join(output, 'camera-menu-' + width + '.png'),
                    (await window.webContents.capturePage()).toPNG());
                window.webContents.sendInputEvent({type: 'mouseMove', x: 400, y: 300});
            }
            window.setSize(1280, 860);
            await evaluate(`document.getElementById('est-vision-open').nextElementSibling.click()`);
            await pause(200);
            assert.strictEqual(await evaluate(`document.getElementById('est-vision-open').nextElementSibling
                .getAttribute('aria-expanded')`), 'true', 'adjacent code button still opens drawer');
            await evaluate(`document.getElementById('est-vision-open').nextElementSibling.click()`);
            await evaluate(`window.cameraRequests = 0;
                navigator.mediaDevices.getUserMedia = () => {
                    window.cameraRequests++;
                    return Promise.reject(new Error('Main editor must never start the camera'));
                };
                document.getElementById('est-vision-open').click()`);
            await pause(100);
            assert.strictEqual(cameraOpenRequests, 1, 'camera entry requests an independent window');
            assert.strictEqual(await evaluate(`Boolean(document.querySelector('section[aria-label^="MediaPipe"]'))`),
                false, 'main renderer must not mount camera models or a camera overlay');
            await evaluate(`(() => {
                const {ScratchBlocks: B, workspace: ws} = window.findLocaleTestBlocks();
                const xml = B.Xml.textToDom('<xml><block type="operator_random" id="locale-native" x="350" y="180">' +
                    '<value name="FROM"><shadow type="math_number"><field name="NUM">7</field></shadow></value>' +
                    '<value name="TO"><shadow type="math_number"><field name="NUM">29</field></shadow></value>' +
                    '</block><block type="vision_gesture" id="locale-est" x="350" y="260">' +
                    '<field name="SIDE">left</field><field name="GESTURE">3</field></block>' +
                    '<block type="vision_wait_state" id="locale-vision-state" x="350" y="340">' +
                    '<field name="STATE">valid</field><next>' +
                    '<block type="vision_wait_gesture"><field name="SIDE">left</field>' +
                    '<field name="GESTURE">1</field></block></next></block></xml>');
                B.Xml.domToWorkspace(xml, ws);
                const visualXml = '<xml>' + ['face', 'pose'].map((kind, index) =>
                    '<block type="vision_wait_' + kind + '" id="locale-' + kind + '" x="650" y="' + (180 + index * 100) + '">' +
                    '<field name="ACTION">' + (kind === 'face' ? 'smile' : 'bothUp') + '</field>' +
                    '<next><block type="vision_wait_' + kind + '"><field name="ACTION">' +
                    (kind === 'face' ? 'mouth' : 'standing') + '</field></block></next></block>').join('') + '</xml>';
                B.Xml.domToWorkspace(B.Xml.textToDom(visualXml), ws);
            })()`);
            await pause(250);
            const snapshot = `(() => {
                const {ScratchBlocks: B, workspace: ws} = window.findLocaleTestBlocks();
                return B.Xml.domToText(B.Xml.workspaceToDom(ws));
            })()`;
            const original = await evaluate(snapshot);
            for (const locale of ['zh-cn', 'pt-br', 'en', 'zh-cn', 'pt-br']) {
                await evaluate(`window.estCurrentLocale = ${JSON.stringify(locale)};
                    document.documentElement.lang = ${JSON.stringify(locale)};
                    window.dispatchEvent(new CustomEvent('est-locale-changed',
                        {detail: {locale: ${JSON.stringify(locale)}}}));
                    window.dispatchEvent(new CustomEvent('est-home-set-locale',
                    {detail: {locale: ${JSON.stringify(locale)}}}));`);
                await pause(900);
                const result = await evaluate(`(() => {
                    const b = window.findLocaleTestBlocks();
                    const flyout = b.workspace.getFlyout().getWorkspace();
                    const text = (ws, id) => ws.getBlockById(id).toString();
                    return {locale: b.props.locale,
                        visible: b.props.isVisible,
                        randomMessage: b.ScratchBlocks.Msg.OPERATORS_RANDOM,
                        native: text(b.workspace, 'locale-native'),
                        est: text(b.workspace, 'locale-est'),
                        face: text(b.workspace, 'locale-face'),
                        pose: text(b.workspace, 'locale-pose'),
                        flyoutFace: flyout.getAllBlocks().find(b => b.type === 'vision_face_action').toString(),
                        flyoutPose: flyout.getAllBlocks().find(b => b.type === 'vision_pose_action').toString(),
                        flyoutNative: flyout.getAllBlocks().find(b => b.type === 'operator_random').toString(),
                        flyoutEst: flyout.getAllBlocks().find(b => b.type === 'vision_gesture').toString(),
                        visionWaits: ['vision_wait_state', 'vision_wait_gesture']
                            .map(type => flyout.getAllBlocks().find(b => b.type === type).toString()),
                        categories: Array.from(document.querySelectorAll('.scratchCategoryMenuItemLabel')).map(el => el.textContent)};
                })()`);
                assert.strictEqual(result.locale, locale);
                assert.strictEqual(cameraLocale, locale, 'main editor must propagate locale to camera window');
                await evaluate(`document.getElementById('est-vision-open').click()`);
                await pause(50);
                assert.strictEqual(openedCameraLocale, locale, 'camera opens in the current editor language');
                assert.ok(result.face.includes(locale === 'zh-cn' ? '微笑' : locale === 'pt-br' ? 'sorriso' : 'smile'));
                assert.ok(result.pose.includes(locale === 'zh-cn' ? '举起双手' : locale === 'pt-br' ? 'duas mãos' : 'both hands'));
                assert.ok(result.flyoutFace.includes(locale === 'zh-cn' ? '人脸' : locale === 'pt-br' ? 'facial' : 'face'));
                assert.ok(result.flyoutPose.includes(locale === 'zh-cn' ? '人体' : locale === 'pt-br' ? 'postura' : 'pose'));
                assert.strictEqual(result.visionWaits.length, 2);
                assert.ok(result.visionWaits.every(text => text.includes(locale === 'zh-cn' ? '视觉' :
                    locale === 'pt-br' ? 'vis' : 'vision')), JSON.stringify(result.visionWaits));
                assert.strictEqual(await evaluate("document.getElementById('est-vision-open').getAttribute('aria-label')"),
                    locale === 'zh-cn' ? '查看摄像头' : locale === 'pt-br' ? 'Ver câmera' : 'View camera');
                const expected = require('openblock-l10n/editor/blocks/' + locale + '.json');
                assert.strictEqual(result.randomMessage, expected.OPERATORS_RANDOM);
                for (const key of ['CATEGORY_OPERATORS', 'CATEGORY_VARIABLES', 'CATEGORY_MYBLOCKS']) {
                    assert.ok(result.categories.includes(expected[key]), 'category must follow locale: ' + key);
                }
                const nativeWord = locale === 'zh-cn' ? '随机' : locale === 'pt-br' ? 'aleatório' : 'random';
                const estWord = locale === 'zh-cn' ? '点赞' : locale === 'pt-br' ? 'polegar' : 'thumb';
                for (const key of ['native', 'flyoutNative']) assert.ok(result[key].includes(nativeWord), JSON.stringify(result));
                assert.ok(result.est.includes(estWord), JSON.stringify(result));
                assert.ok(result.flyoutEst.includes(locale === 'zh-cn' ? '手掌' :
                    locale === 'pt-br' ? 'palma' : 'palm'), JSON.stringify(result));
                assert.strictEqual(await evaluate(snapshot), original, 'language switching must preserve project XML');
                console.log(JSON.stringify(result));
            }
            await window.setSize(1000, 720);
            await pause(200);
            const screenshot = path.join(output, 'locale-portuguese.png');
            fs.writeFileSync(screenshot, (await window.webContents.capturePage()).toPNG());
            console.log('Locale UI regression passed. Screenshot: ' + screenshot);
            await evaluate(`(async () => { const vm = window.findLocaleTestBlocks().props.vm;
                window.visionProject = await vm.saveProjectSb3();
                await vm.loadProject(await window.blankVisionProject.arrayBuffer()); })()`);
            await pause(700);
            assert.deepStrictEqual(await loadedExtensions(), [], 'fresh project must not inherit vision');
            await evaluate(`(async () => { await window.findLocaleTestBlocks().props.vm.loadProject(await window.visionProject.arrayBuffer()); })()`);
            await pause(700);
            assert.deepStrictEqual(await loadedExtensions(), ['vision']);
            assert.ok(await evaluate(`Boolean(window.findLocaleTestBlocks().workspace.getBlockById('locale-est'))`));
            await evaluate(`(async () => { const vm = window.findLocaleTestBlocks().props.vm;
                const legacy = JSON.parse(vm.toJSON());
                delete legacy.deviceExtensions;
                await vm.loadProject(JSON.stringify(legacy)); })()`);
            await pause(700);
            assert.deepStrictEqual(await loadedExtensions(), ['vision'], 'older vision blocks restore their category');
            assert.strictEqual(await evaluate('window.cameraRequests'), 0, 'adding/reopening vision never starts camera');
            const beforeRejectedProject = await evaluate(snapshot);
            const rejected = await evaluate(`(async () => {
                const vm = window.findLocaleTestBlocks().props.vm;
                const oldProject = JSON.parse(vm.toJSON());
                oldProject.targets[0].blocks.retiredHat = {opcode: 'event_vision_face', next: null,
                    parent: null, inputs: {}, fields: {ACTION: ['smile', null]}, shadow: false,
                    topLevel: true, x: 50, y: 50};
                try { await vm.loadProject(JSON.stringify(oldProject)); return ''; }
                catch (error) { return error.message; }
            })()`);
            assert.ok(rejected.includes('removidos'), 'old vision hats must be explicitly rejected');
            assert.strictEqual(await evaluate(snapshot), beforeRejectedProject, 'rejection must preserve current workspace');
            console.log('Native vision extension selection, duplicate selection, save/reopen and legacy project tests passed.');
            hardwareMockEnabled = true;
            await evaluate(`(() => {
                for (const element of document.querySelectorAll('button')) {
                    let fiber = element[Object.keys(element).find(key => key.startsWith('__reactInternalInstance'))];
                    for (; fiber; fiber = fiber.return) {
                        const c = fiber.stateNode;
                        if (c && c.refreshStatus && c.renderPortsOverview) { window.hardwarePanel = c; break; }
                    }
                }
                if (!window.hardwarePanel) throw new Error('Hardware panel not found');
                // Offscreen test windows are hidden by design, unlike the visible app.
                Object.defineProperty(document, 'hidden', {configurable: true, value: false});
                window.hardwareTicks = 0;
                window.hardwareTimer = setInterval(() => {
                    hardwareTicks++;
                    const block = window.findLocaleTestBlocks().workspace.getBlockById('locale-est');
                    if (block) block.moveBy(hardwareTicks % 2 ? 1 : -1, 0);
                }, 20);
                hardwarePanel.handleToggle();
            })()`);
            await pause(2400);
            assert.ok(hardwareRequests >= 4, 'idle port values must refresh at the faster cadence');
            assert.equal(hardwareMaxActive, 1, 'no overlapping status requests');
            assert.ok(await evaluate('hardwareTicks >= 20'), 'editor must remain responsive during polling');
            assert.ok(await evaluate('hardwarePanel.state.status.motors[0].tachoCount >= 2'));
            await evaluate('hardwarePanel.handleClose(); clearInterval(hardwareTimer)');
            await pause(300);
            const closedCount = hardwareRequests;
            await pause(950);
            assert.equal(hardwareRequests, closedCount, 'closing panel must stop polling');
            console.log('Hardware panel auto-refresh and editor responsiveness regression passed.');
            const hardwareButton = '#est-hardware-select';
            const chooseHardware = async id => {
                await evaluate(`document.querySelector('${hardwareButton}').click()`);
                await pause(80);
                assert.equal(await evaluate('document.querySelectorAll("input[name=hardware-choice]").length'), 3);
                await evaluate(`document.querySelector('input[name="hardware-choice"][value="${id}"]').click();
                    document.querySelector('[role="dialog"] footer button:last-child').click()`);
                for (let i = 0; i < 80; i++) {
                    if (!await evaluate('Boolean(document.querySelector("input[name=hardware-choice]"))')) break;
                    await pause(100);
                }
                assert.ok(!await evaluate('Boolean(document.querySelector("input[name=hardware-choice]"))'),
                    'hardware switch must finish without an error dialog');
                await pause(450);
                assert.equal(selectedHardware, id);
                assert.equal(await evaluate('JSON.parse(window.findLocaleTestBlocks().props.vm.toJSON()).meta.estStudio.hardwareId'), id);
            };
            await evaluate('window.beforeHardwareSwitch = window.findLocaleTestBlocks().props.vm.toJSON()');
            await chooseHardware('spark-ai');
            const pendingCategories = await evaluate(`Array.from(document.querySelectorAll('.scratchCategoryMenuItemLabel'))
                .map(element => element.textContent.trim())`);
            assert.ok(pendingCategories.includes('Motor'));
            assert.equal(pendingCategories.length, 10, 'Spark has eight fixed and two native dynamic categories');
            assert.ok(!await evaluate('Boolean(document.querySelector("#est-vision-open"))'));
            assert.ok(!/est_runtime|rt\./.test(await evaluate('window.findLocaleTestBlocks().workspaceToCode()')));
            assert.ok(await evaluate('document.querySelector(".est-menu-bar-ai-button").hidden'));
            const sparkCatalog = require('../src/renderer/spark-ai/catalog.json');
            const sparkUi = await evaluate(`(() => {
                const editor = window.findLocaleTestBlocks(), B = editor.ScratchBlocks;
                const rows = ${JSON.stringify(sparkCatalog.blocks)};
                const xml = document.createElement('xml');
                for (const row of rows) {
                    const block = document.createElement('block'); block.setAttribute('type', 'spark_' + row.id);
                    for (const [name, value] of Object.entries(row.fields || {})) {
                        const field = document.createElement('field'); field.setAttribute('name', name);
                        field.textContent = value; block.appendChild(field);
                    }
                    for (const input of row.inputs) {
                        const value = document.createElement('value'); value.setAttribute('name', input.name);
                        const shadow = document.createElement('shadow'); shadow.setAttribute('type', 'spark_' + input.type);
                        for (const [name, value] of Object.entries(input.fields || {})) {
                            const field = document.createElement('field'); field.setAttribute('name', name);
                            field.textContent = value; shadow.appendChild(field);
                        }
                        value.appendChild(shadow); block.appendChild(value);
                    }
                    xml.appendChild(block);
                }
                const test = new B.Workspace();
                window.sparkUiFixtureXml = xml;
                try {
                    B.Xml.domToWorkspace(xml, test);
                    B.SparkPython.init(test);
                    const errors = [];
                    for (const row of rows) {
                        const block = test.getAllBlocks().find(b => b.type === 'spark_' + row.id);
                        try { B.SparkPython[block.type](block); } catch (error) { errors.push(row.id + ': ' + error.message); }
                    }
                    editor.workspace.toolbox_.scrollToCategoryById('spark_matrix');
                    return {fixed: test.getTopBlocks().length, errors,
                        ports: test.getAllBlocks().find(b => b.type === 'spark_motor_box').getFieldValue('MOTOR')};
                } finally { test.dispose(); }
            })()`);
            assert.equal(sparkUi.fixed, 66);
            assert.deepStrictEqual(sparkUi.errors, []);
            assert.equal(sparkUi.ports, 'E');
            await pause(200);
            const shadowContrast = await evaluate(`(() => {
                const blocks = window.findLocaleTestBlocks().workspace.getFlyout().getWorkspace().getAllBlocks();
                return blocks.filter(b => ['spark_matrix_x', 'spark_matrix_y', 'spark_piano'].includes(b.type))
                    .map(block => ({type: block.type, colour: block.getColour(), text: block.toString()}));
            })()`);
            assert.equal(shadowContrast.length, 3);
            assert.ok(shadowContrast.every(block => block.colour.toLowerCase() !== '#ffffff'));
            const matrixUi = await evaluate(`(() => {
                const editor = window.findLocaleTestBlocks();
                const matrix = editor.workspace.getFlyout().getWorkspace().getAllBlocks()
                    .find(b => b.type === 'spark_matrix_lamp').getField('lamp');
                matrix.showEditor_();
                const nodes = matrix.ledButtons_;
                const lastRect = nodes[34].getBoundingClientRect();
                matrix.onMouseDown({clientX: lastRect.x + lastRect.width / 2,
                    clientY: lastRect.y + lastRect.height / 2, button: 0,
                    preventDefault() {}, stopPropagation() {}});
                matrix.onMouseUp();
                const code = editor.ScratchBlocks.SparkPython.spark_matrix_lamp(matrix.sourceBlock_);
                const value = matrix.getValue();
                return {nodes: nodes.length, width: matrix.width_, height: matrix.height_, value, code};
            })()`);
            assert.equal(matrixUi.nodes, 35);
            assert.equal(matrixUi.width, 5); assert.equal(matrixUi.height, 7);
            assert.ok(matrixUi.code.endsWith('0x0F)\n'),
                'bottom-right cell must be bit 4 of row 6: ' + JSON.stringify(matrixUi));
            window.webContents.invalidate(); await pause(100);
            fs.writeFileSync(path.join(output, 'spark-matrix-editor.png'),
                (await window.webContents.capturePage()).toPNG());
            await evaluate('window.findLocaleTestBlocks().ScratchBlocks.DropDownDiv.hideWithoutAnimation()');
            console.log('Spark UI: 66 real block instances and native 5-column, 7-row matrix editor passed.');
            await evaluate(`(() => {
                const editor = window.findLocaleTestBlocks(), B = editor.ScratchBlocks;
                let tail = editor.workspace.getAllBlocks().find(b => b.type === 'spark_event_whenflagclicked');
                for (const type of ['motor_specifiedunit', 'matrix_lamp', 'control_wait', 'motor_stop']) {
                    const xml = Array.from(sparkUiFixtureXml.children).find(node =>
                        node.getAttribute('type') === 'spark_' + type).cloneNode(true);
                    const block = B.Xml.domToBlock(xml, editor.workspace);
                    block.initSvg(); block.render();
                    tail.nextConnection.connect(block.previousConnection); tail = block;
                }
            })()`);
            await pause(400);
            const sparkProgram = await evaluate('window.findLocaleTestBlocks().workspaceToCode()');
            assert.ok(sparkProgram.includes('_motor.run_for_power_seconds(4, 50, 1)'));
            assert.ok(sparkProgram.includes('_matrix.show('));
            assert.ok(sparkProgram.includes('_motor.stop(4)'));
            assert.ok(await evaluate('Boolean(document.querySelector("[class*=EstCodeDrawerToggle_toggle-button]"))'));
            await evaluate('document.querySelector("[class*=EstCodeDrawerToggle_toggle-button]").click()');
            await pause(250);
            window.webContents.invalidate();
            fs.writeFileSync(path.join(output, 'spark-blocks-code-preview.png'),
                (await window.webContents.capturePage()).toPNG());
            await evaluate('window.findLocaleTestBlocks().props.onToggleHardwareCodeLock()');
            await pause(50);
            await evaluate(`window.findLocaleTestBlocks().props.onSetCodeEditorValue('print("spark manual draft")')`);
            await evaluate(`(() => { const vm = window.findLocaleTestBlocks().props.vm;
                const stage = vm.runtime.getTargetForStage();
                stage.createVariable('spark-value', 'Spark value', '');
                stage.variables['spark-value'].value = 123;
                vm.runtime.emitProjectChanged();
                vm.emitWorkspaceUpdate();
            })()`);
            await pause(150);
            const savedSparkProgram = await evaluate('window.findLocaleTestBlocks().workspaceToCode()');
            await evaluate('(async () => { window.savedSparkHardwareProject = await window.findLocaleTestBlocks().props.vm.saveProjectSb3(); })()');
            await chooseHardware('new-ai');
            assert.ok(!await evaluate('Boolean(window.findLocaleTestBlocks().props.vm.runtime.getTargetForStage().variables["spark-value"])'));
            await chooseHardware('spark-ai');
            assert.equal(await evaluate('window.findLocaleTestBlocks().props.vm.runtime.getTargetForStage().variables["spark-value"].value'), 123);
            assert.equal(await evaluate('window.findLocaleTestBlocks().workspaceToCode()'), savedSparkProgram);
            assert.equal(await evaluate('window.findLocaleTestBlocks().props.isCodeEditorLocked'), false);
            assert.equal(await evaluate('window.findLocaleTestBlocks().props.codeEditorValue'), 'print("spark manual draft")');
            await chooseHardware('est');
            assert.ok(await evaluate('Boolean(window.findLocaleTestBlocks().workspace.getBlockById("locale-est"))'),
                'returning to EST must restore its original blocks');
            await evaluate('(async () => { await window.findLocaleTestBlocks().props.vm.loadProject(await savedSparkHardwareProject.arrayBuffer()); })()');
            await pause(500);
            assert.ok((await evaluate(`document.querySelector('${hardwareButton}').textContent`)).includes('Spark AI'));
            assert.equal(await evaluate('window.findLocaleTestBlocks().props.vm.runtime.getTargetForStage().variables["spark-value"].value'), 123);
            const beforeUnknown = await evaluate('window.findLocaleTestBlocks().props.vm.toJSON()');
            const unknownError = await evaluate(`(async () => { const vm = window.findLocaleTestBlocks().props.vm;
                const project = JSON.parse(vm.toJSON()); project.meta.estStudio.hardwareId = 'unknown';
                try { await vm.loadProject(JSON.stringify(project)); return ''; } catch (error) { return error.message; }
            })()`);
            assert.ok(unknownError.includes('HARDWARE_UNKNOWN'));
            assert.equal(await evaluate('window.findLocaleTestBlocks().props.vm.toJSON()'), beforeUnknown);
            await chooseHardware('est');
            await evaluate(`(() => {
                window.legacyHardwareProject = JSON.parse(window.findLocaleTestBlocks().props.vm.toJSON());
                delete legacyHardwareProject.meta.estStudio;
            })()`);
            await chooseHardware('new-ai');
            await evaluate('(async () => { await window.findLocaleTestBlocks().props.vm.loadProject(JSON.stringify(legacyHardwareProject)); })()');
            await pause(500);
            assert.equal(selectedHardware, 'est', 'opening an old EST project restores EST automatically');
            for (const width of [1280, 1000, 800]) {
                window.setSize(width, 760);
                await evaluate(`document.querySelector('${hardwareButton}').click()`);
                await pause(200);
                const bounds = await evaluate(`(() => {
                    const dialog = document.querySelector('input[name="hardware-choice"]').closest('[role="dialog"]');
                    const rect = dialog.getBoundingClientRect();
                    return {left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
                        width: innerWidth, height: innerHeight, overflow: dialog.scrollWidth > dialog.clientWidth};
                })()`);
                assert.ok(bounds.left >= 0 && bounds.right <= bounds.width && bounds.top >= 0 && bounds.bottom <= bounds.height);
                assert.equal(bounds.overflow, false);
                if (width >= 1000) {
                    const titleWidth = await evaluate(`document.querySelector('[class*="project-title-input_title-field_"]')
                        .getBoundingClientRect().width`);
                    assert.ok(titleWidth >= 100, `hardware selector must leave a usable project title field (${width}: ${titleWidth})`);
                }
                window.webContents.invalidate();
                fs.writeFileSync(path.join(output, `hardware-choice-${width}.png`),
                    (await window.webContents.capturePage()).toPNG());
                await evaluate('document.querySelector("[role=dialog] header button").click()');
            }
            console.log('Hardware selector UI passed: three products, isolated drafts, saved project reopen, legacy migration and 1280/1000/800 px layouts. Screenshots: ' + output);
            clearTimeout(timeout);
            app.exit(0);
        } catch (error) {
            console.error(error);
            clearTimeout(timeout);
            app.exit(1);
        }
    });
}
