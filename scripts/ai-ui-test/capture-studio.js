/* eslint-disable global-require, no-underscore-dangle, no-negated-condition */
// Capture the compiled, unmodified Studio renderer in an isolated hidden Electron window.
// Hardware and model replies are fixtures; no user projects, settings, or API accounts are accessed.
const fs = require('fs');
const os = require('os');
const path = require('path');

if (!process.versions.electron) {
    const {spawnSync} = require('child_process');
    const result = spawnSync(require('electron'), [__filename], {
        windowsHide: true, stdio: 'inherit', env: {...process.env, NODE_OPTIONS: ''}
    });
    process.exitCode = result.status === null ? 1 : result.status;
} else {
    const {app, BrowserWindow, ipcMain} = require('electron');
    const remote = require('@electron/remote/main');
    const assert = require('assert');
    const output = fs.mkdtempSync(path.join(os.tmpdir(), 'est-studio-mascot-'));
    app.setPath('userData', path.join(output, 'profile'));
    remote.initialize();
    let window;
    let completeReply;
    const coverage = process.env.EST_AI_CAPTURE_COVERAGE === '1';
    const ir = coverage ? require('./coverage-fixture').makeCoverageIr() : {version: 1,
        mode: 'insert',
        stacks: [{event: {type: 'event_program_start'},
            body: [
                {type: 'drive_set_pair', inputs: {LEFT_PORT: 'B', RIGHT_PORT: 'C'}},
                {type: 'drive_move_for', fields: {DIRECTION: 'forward', UNIT: 'rotations'}, inputs: {AMOUNT: 1}},
                {type: 'control_wait_seconds', inputs: {SECONDS: 1}},
                {type: 'drive_stop'}
            ]}]};
    const handlers = {
        'get-initial-project-data': () => null,
        'est-home-get-startup-state': () => ({hasInitialProject: true}),
        'est-home-list-recent-projects': () => [],
        'est-home-get-build-library-state': () => ({}),
        'est-auto-connect': () => ({state: 'not-found'}),
        'est-ai-status': () => ({ok: true,
            data: {configured: true,
                hasKey: false,
                config: {
                    provider: '', baseUrl: 'http://localhost:11434/v1', model: 'studio-demo', jsonMode: false
                }}}),
        'est-ai-generate': () => new Promise(resolve => {
            completeReply = () => resolve({ok: true,
                data: {content: JSON.stringify({
                    message: coverage ? '已搭好计数、列表、带参数的自定义积木，以及爱心绘图。确认后可放入工作区。' :
                        '已经搭好了：B、C 电机前进一圈，等待一秒，然后停止。可以先查看积木，再放入工作区。',
                    ir
                })}});
        }),
        'est-ai-cancel': () => ({ok: true})
    };
    Object.entries(handlers).forEach(([channel, handler]) => ipcMain.handle(channel, handler));
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    const evaluate = source => window.webContents.executeJavaScript(source);
    const until = async source => {
        for (let i = 0; i < 180; i++) {
            if (await evaluate(source)) return;
            await pause(100);
        }
        throw new Error(`Studio condition timed out: ${source}`);
    };
    const capture = async (name, rectangle) => {
        await pause(250);
        await window.webContents.capturePage();
        const page = await window.webContents.capturePage(rectangle);
        const target = path.join(output, `${name}.png`);
        fs.writeFileSync(target, page.toPNG());
        console.log(`Studio screenshot: ${target}`);
    };
    const timeout = setTimeout(() => app.exit(1), 90000);
    app.whenReady().then(async () => {
        window = new BrowserWindow({show: false,
            width: 1280,
            height: 860,
            useContentSize: true,
            webPreferences: {nodeIntegration: true, contextIsolation: false, backgroundThrottling: false}});
        remote.enable(window.webContents);
        window.webContents.on('console-message', (event, level, message) => {
            if (level >= 3) console.log(`Studio renderer: ${message}`);
        });
        try {
            await window.loadFile(path.resolve(__dirname, '../../dist/renderer/index.html'));
            await until('Boolean(document.querySelector(".est-menu-bar-ai-button:not([hidden])"))');
            await evaluate("window.dispatchEvent(new CustomEvent('est-home-set-locale', " +
                "{detail: {locale: 'zh-cn'}}));");
            await pause(700);
            await evaluate(`window.estCurrentLocale = 'zh-cn';
                document.documentElement.lang = 'zh-cn';
                window.dispatchEvent(new CustomEvent('est-locale-changed', {detail: {locale: 'zh-cn'}}));`);
            const buttonRectangle = await evaluate(`(() => {
                const rect = document.querySelector('.est-menu-bar-ai-button').getBoundingClientRect();
                return {x: Math.floor(rect.x) - 10, y: 0, width: Math.ceil(rect.width) + 20, height: 58};
            })()`);
            await capture('studio-menu-button', buttonRectangle);
            await evaluate('document.querySelector(".est-menu-bar-ai-button").click()');
            await until('Boolean(document.querySelector("[role=dialog] [data-est-mascot]"))');
            await evaluate('window.dispatchEvent(new Event("focus"))');
            const initialLayout = await evaluate(`(() => {
                const button = document.querySelector('.est-menu-bar-ai-button');
                const menu = button.closest('[class*="menu-bar_menu-bar_"]');
                return {count: document.querySelectorAll('.est-menu-bar-ai-button').length,
                    width: button.getBoundingClientRect().width,
                    height: menu.getBoundingClientRect().height,
                    labelFont: getComputedStyle(button.querySelector('.est-menu-bar-ai-button-label')).font,
                    labelColor: getComputedStyle(button.querySelector('.est-menu-bar-ai-button-label')).color};
            })()`);
            assert.strictEqual(initialLayout.count, 1);
            assert.ok(initialLayout.width >= 150 && initialLayout.width <= 166);
            await capture('studio-wide-idle');
            const requestText = coverage ? '生成随机计数存入列表，用带参数的自定义积木显示，再画爱心。' :
                '使用 B、C 端口的驱动电机，前进一圈，等待一秒，然后停止。';
            // Use the real input and send action, with the model response held by the IPC fixture.
            await evaluate(`(() => {
                const input = document.querySelector('[role=dialog] textarea');
                Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input,
                    ${JSON.stringify(requestText)});
                input.dispatchEvent(new Event('input', {bubbles: true}));
            })()`);
            await evaluate('document.querySelector("button[aria-label=发送]").click()');
            await until('Boolean(document.querySelector("[role=dialog] [data-state=thinking]"))');
            await capture('studio-thinking');
            assert.ok(completeReply);
            completeReply();
            await until('Boolean(document.querySelector("[role=dialog] figure img"))');
            await until('Boolean(document.querySelector("[role=dialog] [data-state=idle]"))');
            await capture('studio-wide');
            window.setContentSize(800, 720);
            await pause(700);
            const narrowLayout = await evaluate(`(() => {
                const button = document.querySelector('.est-menu-bar-ai-button');
                const menu = button.closest('[class*="menu-bar_menu-bar_"]');
                const main = menu.querySelector('[class*="menu-bar_main-menu_"]');
                return {label: getComputedStyle(button.querySelector('.est-menu-bar-ai-button-label')).display,
                    count: document.querySelectorAll('.est-menu-bar-ai-button').length,
                    width: button.getBoundingClientRect().width, height: menu.getBoundingClientRect().height,
                    noOverlap: main.getBoundingClientRect().right <= button.getBoundingClientRect().left,
                    noOverflow: document.documentElement.scrollWidth <= innerWidth};
            })()`);
            assert.strictEqual(narrowLayout.label, 'none');
            assert.strictEqual(narrowLayout.count, 1);
            assert.ok(Math.abs(narrowLayout.height - initialLayout.height) < 0.01,
                'Menu height must stay unchanged (allow subpixel rounding)');
            assert.ok(narrowLayout.width <= 42 && narrowLayout.noOverlap && narrowLayout.noOverflow,
                JSON.stringify(narrowLayout));
            await capture('studio-narrow');
            await evaluate('document.querySelector("button[aria-label=关闭]").click()');
            await capture('studio-narrow-closed');
            console.log('Compiled Studio wide/narrow layout passed', JSON.stringify({initialLayout, narrowLayout}));
            clearTimeout(timeout);
            app.exit(0);
        } catch (error) {
            console.error(error);
            await capture('studio-failure');
            clearTimeout(timeout);
            app.exit(1);
        }
    });
}
