/* eslint-disable no-underscore-dangle, require-await, require-atomic-updates */
const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const path = require('path');
const babel = require('@babel/core');
const https = require('https');
const http = require('http');
const {EventEmitter} = require('events');

const root = path.resolve(__dirname, '..');
const originalLoad = Module._load;
const originalJs = Module._extensions['.js'];
const originalJsx = Module._extensions['.jsx'];
const originalSvg = Module._extensions['.svg'];
Module._extensions['.png'] = (module, filename) => { module.exports = filename; };
const originalCss = Module._extensions['.css'];
const invocations = [];
let invoke = async () => ({ok: true, data: {configured: false}});
let preview = async () => [{image: 'data:image/svg+xml,test', width: 200, height: 200}];
let imports = 0;
let confirmation = 1;

Module._load = function (name, parent, isMain) {
    if (name === 'electron') {
        return {ipcRenderer: {invoke: (...args) => {
            invocations.push(args);
            return invoke(...args);
        }}};
    }
    if (name === '@electron/remote') return {dialog: {showMessageBoxSync: () => confirmation}};
    if (name === './est-ai/est-program-preview') {
        return {createEstProgramStackPreviews: (...args) => preview(...args)};
    }
    if (name === './est-ai/est-ai-workspace') {
        return {requestEstAiBlockImport: async ir => {
            assert.ok(ir && ir.stacks.length);
            imports++;
        }};
    }
    return originalLoad.call(this, name, parent, isMain);
};
const transform = (module, filename) => {
    if (!filename.startsWith(path.join(root, 'src'))) return originalJs(module, filename);
    const result = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
        babelrc: false,
        presets: ['@babel/preset-react'],
        plugins: ['@babel/plugin-transform-modules-commonjs']
    });
    module._compile(result.code, filename);
};
Module._extensions['.js'] = transform;
Module._extensions['.jsx'] = transform;
Module._extensions['.svg'] = (module, filename) => {
    module.exports = filename;
};
Module._extensions['.css'] = module => {
    module.exports = {};
};

const {
    SAMPLE_IR,
    parseEstAiReply,
    selectEstAiRuleCategories,
    generateEstAiReply,
    buildEstAiSystemPrompt
} =
    require('../src/renderer/est-ai/est-ai-chat');
const {createEstAiHardwareContext} = require('../src/renderer/est-ai/est-ai-hardware-context');
const {createEstAiService, registerEstAiIpc, requestEstAiCompletion, parseEstAiCompletionResponse} =
    require('../src/main/est/ai-service');
const {createEstAiKeyStore} = require('../src/main/est/ai-key-store');
const {normalizeEstAiConfig, normalizeEstAiBaseUrl, defaultEstAiConfig} = require('../src/common/est-ai-config');
const deepseekConfig = {
    provider: 'deepseek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-flash', jsonMode: true
};
const customConfig = {
    provider: '', baseUrl: 'https://example.com/v1', model: 'my-model', jsonMode: false
};
const {EstAiPanel} = require('../src/renderer/EstAiPanel.jsx');
const validContent = JSON.stringify({message: '已生成程序。', ir: SAMPLE_IR});
const {makeCoverageIr} = require('./ai-ui-test/coverage-fixture');
const {EST_AI_RULE_CATEGORY_IDS} = require('../src/renderer/est-ai/est-block-spec');
const deferred = () => {
    let resolve;
    const promise = new Promise(done => {
        resolve = done;
    });
    return {promise, resolve};
};

const run = async () => {
    const originalRequest = https.request;
    const originalHttpRequest = http.request;
    const originalTimeout = global.setTimeout;
    let responseStatus = 200;
    let responseBody = JSON.stringify({
        choices: [{finish_reason: 'stop', message: {content: validContent}}]
    });
    let keepPending = false;
    let sentBody = null;
    let destroyed = false;
    let expectedUrl = 'https://api.deepseek.com/chat/completions';
    let expectedKey = 'Bearer test-key-not-real';
    let requestedUrls = [];
    https.request = (url, options, onResponse) => {
        assert.ok(Array.isArray(expectedUrl) ? expectedUrl.includes(url) : url === expectedUrl, url);
        requestedUrls.push(url);
        assert.strictEqual(options.method, 'POST');
        assert.strictEqual(options.headers.Authorization || '', expectedKey);
        const request = new EventEmitter();
        request.destroy = () => {
            destroyed = true;
        };
        options.signal.addEventListener('abort', () => request.emit('error', new Error('abort')));
        request.end = body => {
            sentBody = JSON.parse(body);
            if (keepPending) return;
            setImmediate(() => {
                const response = new EventEmitter();
                response.statusCode = typeof responseStatus === 'function' ? responseStatus(url) : responseStatus;
                response.destroy = () => {
                    destroyed = true;
                };
                onResponse(response);
                response.emit('data', Buffer.from(typeof responseBody === 'function' ? responseBody(url) : responseBody));
                response.emit('end');
            });
        };
        return request;
    };
    http.request = https.request;
    const transportInput = {
        apiKey: 'test-key-not-real',
        config: deepseekConfig,
        messages: [{role: 'user', content: 'test'}],
        signal: new AbortController().signal
    };
    try {
        assert.strictEqual(await requestEstAiCompletion(transportInput), validContent);
        assert.deepStrictEqual(sentBody.response_format, {type: 'json_object'});
        assert.deepStrictEqual(sentBody.thinking, {type: 'disabled'});
        expectedUrl = 'https://example.com/v1/chat/completions';
        await requestEstAiCompletion({...transportInput, config: customConfig});
        assert.strictEqual(sentBody.model, 'my-model');
        assert.deepStrictEqual(Object.keys(sentBody).sort(), ['messages', 'model', 'stream']);
        const rootUrl = 'https://example.com/chat/completions';
        const versionedUrl = 'https://example.com/v1/chat/completions';
        const rootRequest = {...transportInput, config: {...customConfig, baseUrl: 'https://example.com'}};
        expectedUrl = [rootUrl, versionedUrl];
        requestedUrls = [];
        responseBody = url => url === rootUrl ? '<!doctype html><html>Private gateway page</html>' :
            JSON.stringify({choices: [{finish_reason: 'stop', message: {content: validContent}}]});
        assert.strictEqual(await requestEstAiCompletion(rootRequest), validContent);
        assert.deepStrictEqual(requestedUrls, [rootUrl, versionedUrl], 'HTML fallback stays on the configured origin');
        requestedUrls = [];
        responseStatus = url => url === rootUrl ? 200 : 401;
        await assert.rejects(requestEstAiCompletion(rootRequest), error => error.code === 'HTTP_401');
        assert.deepStrictEqual(requestedUrls, [rootUrl, versionedUrl], 'Invalid credentials do not cause more retries');
        responseStatus = 200;
        expectedUrl = 'https://example.com/custom/chat/completions';
        responseBody = '<html>Private page</html>';
        requestedUrls = [];
        await assert.rejects(requestEstAiCompletion({...rootRequest,
            config: {...customConfig, baseUrl: 'https://example.com/custom'}}), error => error.code === 'AI_HTML_RESPONSE');
        assert.strictEqual(requestedUrls.length, 1, 'Explicit configured paths are never guessed or replaced');
        responseBody = JSON.stringify({choices: [{finish_reason: 'stop', message: {content: validContent}}]});
        expectedUrl = 'http://127.0.0.1:11434/v1/chat/completions';
        expectedKey = '';
        await requestEstAiCompletion({...transportInput,
            apiKey: '',
            config: {
                ...customConfig, baseUrl: 'http://127.0.0.1:11434/v1'
            }});
        expectedUrl = 'https://api.deepseek.com/chat/completions';
        expectedKey = 'Bearer test-key-not-real';
        for (const [status, expected] of [
            [401, /密钥.*API 地址/], [402, /余额/], [429, /频繁/], [503, /模型 ID/], [302, /不可用/]
        ]) {
            responseStatus = status;
            responseBody = 'Secret provider response must not escape';
            await assert.rejects(requestEstAiCompletion(transportInput), error => {
                assert.match(error.message, expected);
                assert.strictEqual(error.code, `HTTP_${status}`);
                return true;
            });
        }
        responseStatus = 200;
        responseBody = JSON.stringify({choices: [{finish_reason: 'length', message: {content: validContent}}]});
        await assert.rejects(requestEstAiCompletion(transportInput), error => error.code === 'AI_OUTPUT_LIMIT');
        for (const finishReason of [null, undefined, 'stop']) {
            responseBody = JSON.stringify({choices: [{finish_reason: finishReason, message: {content: validContent}}]});
            assert.strictEqual(await requestEstAiCompletion(transportInput), validContent);
        }
        for (const [reason, message, expectedCode] of [
            ['length', {content: validContent}, 'AI_OUTPUT_LIMIT'],
            ['content_filter', {content: validContent}, 'AI_REFUSED'],
            ['stop', {content: validContent, refusal: 'Private refusal detail'}, 'AI_REFUSED'],
            ['tool_calls', {content: validContent}, 'AI_UNEXPECTED_TOOLS'],
            ['stop', {content: validContent, tool_calls: [{id: 'private-tool'}]}, 'AI_UNEXPECTED_TOOLS'],
            ['stop', {content: null, reasoning_content: 'Private reasoning'}, 'AI_EMPTY_RESPONSE'],
            ['stop', {content: ''}, 'AI_EMPTY_RESPONSE'],
            ['stop', {content: '   '}, 'AI_EMPTY_RESPONSE'],
            [null, {content: '{"message":"incomplete"'}, 'AI_INCOMPLETE_RESPONSE'],
            ['unknown', {content: validContent}, 'AI_INCOMPLETE_RESPONSE']
        ]) {
            responseBody = JSON.stringify({choices: [{finish_reason: reason, message}]});
            await assert.rejects(requestEstAiCompletion(transportInput), error => {
                assert.strictEqual(error.code, expectedCode);
                assert.doesNotMatch(error.message, /Private|private-tool/);
                return true;
            });
        }
        for (const source of ['not JSON', '{}', '{"error":{"message":"Private upstream details"}}']) {
            assert.throws(() => parseEstAiCompletionResponse(source), error => {
                assert.strictEqual(error.code, 'AI_RESPONSE_FORMAT');
                assert.doesNotMatch(error.message, /Private/);
                return true;
            });
        }
        responseBody = 'x'.repeat((1024 * 1024) + 1);
        await assert.rejects(requestEstAiCompletion(transportInput), /过长/);
        assert.ok(destroyed);
        keepPending = true;
        const controller = new AbortController();
        const cancelled = requestEstAiCompletion({...transportInput, signal: controller.signal});
        controller.abort();
        await assert.rejects(cancelled, /取消/);
        global.setTimeout = (callback, milliseconds) => {
            assert.strictEqual(milliseconds, 480000);
            return originalTimeout(callback, 1);
        };
        await assert.rejects(requestEstAiCompletion(transportInput), error => {
            assert.match(error.message, /8 分钟/);
            assert.strictEqual(error.code, 'REQUEST_TIMEOUT');
            return true;
        });
    } finally {
        https.request = originalRequest;
        http.request = originalHttpRequest;
        global.setTimeout = originalTimeout;
    }
    assert.strictEqual(normalizeEstAiBaseUrl(' https://example.com/v1/chat/completions/ '),
        'https://example.com/v1');
    assert.strictEqual(normalizeEstAiBaseUrl('http://localhost:11434/v1/'), 'http://localhost:11434/v1');
    for (const url of ['http://example.com/v1', 'file:///key', 'https://user:pass@example.com',
        'https://example.com?api_key=secret', 'https://example.com/#fragment']) {
        assert.throws(() => normalizeEstAiBaseUrl(url));
    }
    assert.throws(() => normalizeEstAiConfig({...customConfig, model: ''}), /模型/);
    const partialPrompt = buildEstAiSystemPrompt('zh-cn', ['event', 'movement', 'control']);
    assert.ok(Buffer.byteLength(partialPrompt) < 50000);
    assert.match(partialPrompt, /drive_move_for/);
    assert.match(partialPrompt, /control_wait_seconds/);
    assert.doesNotMatch(partialPrompt, /display_image_for/);
    assert.doesNotMatch(partialPrompt, /sensor_touch_pressed/);
    assert.doesNotMatch(partialPrompt, /IR.variables|IR.procedures|BITMAP accepts/);
    const completeCategories = selectEstAiRuleCategories([{role: 'user',
        text: '生成随机变量存入列表，用带参数的自定义积木显示，再画爱心'}]);
    for (const category of ['variables', 'procedures', 'operators', 'control', 'display']) {
        assert.ok(completeCategories.includes(category), `Missing selected category: ${category}`);
    }
    const fullPrompt = buildEstAiSystemPrompt('zh-cn', completeCategories);
    assert.match(fullPrompt, /IR.variables/);
    assert.match(fullPrompt, /IR.procedures/);
    assert.match(fullPrompt, /display_draw.fields.BITMAP/);
    assert.doesNotMatch(fullPrompt, /custom procedures.*not supported/);
    assert.ok(Buffer.byteLength(fullPrompt) < 100000);
    const allRules = buildEstAiSystemPrompt('zh-cn', EST_AI_RULE_CATEGORY_IDS);
    assert.ok(allRules.length < 100000 && Buffer.byteLength(allRules) < 200000,
        'Full catalog must fit within the service limits');
    for (const [text, category] of [['随机数', 'operators'], ['取整', 'operators'], ['画爱心', 'display'],
        ['create a list', 'variables'], ['custom block with arguments', 'procedures']]) {
        assert.ok(selectEstAiRuleCategories([{role: 'user', text}]).includes(category));
    }
    const fullReply = parseEstAiReply(JSON.stringify({message: '完成', ir: makeCoverageIr()}));
    assert.strictEqual(fullReply.ir.variables.length, 2);
    assert.strictEqual(fullReply.ir.procedures.length, 1);
    const followUp = selectEstAiRuleCategories([
        {role: 'assistant', text: '完成', ir: fullReply.ir}, {role: 'user', text: '把次数改为 5'}
    ]);
    assert.ok(['variables', 'procedures', 'display', 'operators'].every(category => followUp.includes(category)));
    const hardwareContext = createEstAiHardwareContext({
        state: 'connected',
        status: {
            motorTypes: {motors: [
                {motorType: 0}, {motorType: 4}, {motorType: 5}, {motorType: 0xff}
            ]},
            sensors: [
                {sensorType: 0x10, state: 2},
                {sensorType: 0x1e, state: 2},
                {sensorType: 0, state: 0},
                {sensorType: 0x20, state: 1}
            ]
        }
    });
    assert.deepStrictEqual(hardwareContext.motorPorts.map(port => port.type), [
        'none', 'large-motor', 'medium-motor', 'unknown'
    ]);
    assert.deepStrictEqual(hardwareContext.sensorPorts.map(port => port.type), [
        'EST/EV3-touch', 'EST/EV3-ultrasonic', 'none', 'EST/EV3-gyro'
    ]);
    const hardwarePrompt = buildEstAiSystemPrompt('zh-cn', ['event', 'movement'], hardwareContext);
    assert.match(hardwarePrompt, /EST USB live snapshot/);
    assert.match(hardwarePrompt, /"port":"B","type":"large-motor"/);
    assert.match(hardwarePrompt, /reference context, not a validation rule/);
    assert.strictEqual(createEstAiHardwareContext({state: 'not-found'}), null);
    assert.deepStrictEqual(selectEstAiRuleCategories([
        {role: 'user', text: '用 B、C 端口前进一圈，等待一秒，然后停止'}
    ]), ['event', 'movement', 'control']);
    assert.deepStrictEqual(selectEstAiRuleCategories([
        {role: 'user', text: '如果超声波距离小于 10 厘米就停止小车'}
    ]), ['event', 'movement', 'control', 'sensing', 'operators']);
    assert.deepStrictEqual(selectEstAiRuleCategories([{role: 'user', text: '你好'}]), []);
    assert.deepStrictEqual(normalizeEstAiConfig({...customConfig, provider: 'custom'}), customConfig,
        'Legacy custom provider must migrate to optional manual setup');
    assert.match(parseEstAiReply(validContent).compiled.xml, /drive_move_for/);
    const commaReply = validContent.replace(/\]\}/g, ',]}');
    assert.deepStrictEqual(parseEstAiReply(commaReply).ir, parseEstAiReply(validContent).ir);
    const punctuationMessage = '保留 ,] 和 ,} 以及 "引号" 与 \\ 路径';
    assert.strictEqual(parseEstAiReply(`${JSON.stringify({message: punctuationMessage, ir: null}).slice(0, -1)},}`)
        .message, punctuationMessage, 'Normalization must not alter string contents');
    assert.throws(() => parseEstAiReply('{"message":"bad","ir":]}'), error => error.code === 'AI_JSON_SYNTAX');
    assert.throws(() => parseEstAiReply('{"message":"bad","ir":undefined}'));
    let syntaxAttempts = 0;
    const recovered = await generateEstAiReply({
        id: 'syntax-repair',
        messages: [{role: 'user', text: '前进一圈'}],
        locale: 'zh-cn',
        invoke: async (channel, request) => {
            syntaxAttempts++;
            if (syntaxAttempts > 1) {
                assert.strictEqual(request.messages.length, 4, 'Only the latest invalid response is retained');
                assert.match(request.messages[3].content, /complete corrected JSON/);
            }
            return {ok: true, data: {content: syntaxAttempts < 3 ? '{"message":"bad","ir":]}' : validContent}};
        }
    });
    assert.ok(recovered.compiled);
    assert.strictEqual(syntaxAttempts, 3);
    await assert.rejects(generateEstAiReply({
        id: 'syntax-exhausted',
        messages: [{role: 'user', text: '前进一圈'}],
        locale: 'zh-cn',
        invoke: async () => ({ok: true, data: {content: '{"message":"bad","ir":]}'}})
    }), /模型连续返回了无效 JSON/);
    assert.strictEqual(parseEstAiReply('{"message":"需要什么端口？","ir":null}').compiled, null);
    for (const content of [
        'not JSON', '{"message":"empty"}', '{"message":"","ir":null}',
        JSON.stringify({message: 'Bad block',
            ir: {
                ...SAMPLE_IR, stacks: [{event: {type: 'eval'}, body: []}]
            }}),
        JSON.stringify({message: 'Unsafe property',
            ir: {
                ...SAMPLE_IR, stacks: [{event: {type: '__proto__'}, body: []}]
            }})
    ]) assert.throws(() => parseEstAiReply(content));

    // Regression: a clarification with ir:null must not drop the original task's rules.
    const followerMessages = [{role: 'user', text: '我要一个C电机监控B电机位置角度，并实时跟随的程序'}];
    const followerCategories = ['event', 'motor', 'control', 'operators'];
    assert.deepStrictEqual(selectEstAiRuleCategories(followerMessages), followerCategories);
    const clarification = await generateEstAiReply({
        id: 'follower-clarification',
        locale: 'zh-cn',
        messages: followerMessages,
        invoke: async () => ({ok: true,
            data: {content: JSON.stringify({
                message: 'B 和 C 是否各接一台独立电机，同向还是反向？', ir: null
            })}})
    });
    followerMessages.push({role: 'assistant', text: clarification.message, ir: clarification.ir});
    followerMessages.push({role: 'user', text: 'B 和 C 各接一台独立电机 同向跟踪'});
    assert.deepStrictEqual(selectEstAiRuleCategories(followerMessages), followerCategories);
    await generateEstAiReply({
        id: 'follower-confirmed',
        locale: 'zh-cn',
        messages: followerMessages,
        invoke: async (channel, request) => {
            const prompt = request.messages[0].content;
            assert.match(prompt, /motor_degrees/);
            assert.match(prompt, /control_forever/);
            assert.match(prompt, /operator_subtract/);
            assert.doesNotMatch(prompt, /sensor_touch_pressed/);
            assert.strictEqual(request.messages[1].content, followerMessages[0].text);
            assert.strictEqual(request.messages[3].content, followerMessages[2].text);
            return {ok: true, data: {content: JSON.stringify({message: '已确认端口和方向。', ir: null})}};
        }
    });
    assert.deepStrictEqual(selectEstAiRuleCategories(followerMessages.concat(
        {role: 'assistant', text: '确认使用当前位置？', ir: null}, {role: 'user', text: '是的'}
    )), followerCategories);
    assert.deepStrictEqual(selectEstAiRuleCategories([
        {role: 'user', text: '电机角度实时跟随', localOnly: true},
        {role: 'assistant', text: '失败', ir: SAMPLE_IR, error: true},
        {role: 'user', text: '你好'}
    ]), []);
    assert.deepStrictEqual(selectEstAiRuleCategories([]), []);
    assert.deepStrictEqual(selectEstAiRuleCategories(followerMessages.concat(
        Array.from({length: 12}, () => ({role: 'user', text: '你好'}))
    )), []);

    let attempts = 0;
    const reply = await generateEstAiReply({
        id: 'repair',
        locale: 'zh-cn',
        messages: [
            {role: 'assistant', text: 'local debug', localOnly: true},
            {role: 'assistant', text: 'previous failure', error: true},
            {role: 'user', text: '前进，等待一秒'}
        ],
        invoke: async (channel, request) => {
            assert.strictEqual(channel, 'est-ai-generate');
            assert.strictEqual(request.messages[0].role, 'system');
            assert.ok(!JSON.stringify(request.messages).includes('local debug'));
            assert.ok(!JSON.stringify(request.messages).includes('previous failure'));
            attempts++;
            assert.match(request.messages[0].content, /drive_move_for/);
            assert.doesNotMatch(request.messages[0].content, /sensor_touch_pressed/);
            if (attempts === 1) return {ok: true, data: {content: 'bad JSON'}};
            assert.match(request.messages[request.messages.length - 1].content, /Repair/);
            return {ok: true, data: {content: validContent}};
        }
    });
    assert.strictEqual(attempts, 2);
    assert.deepStrictEqual(reply.ruleCategories, ['event', 'movement', 'control']);
    assert.ok(reply.ir.stacks.length);
    attempts = 0;
    await assert.rejects(generateEstAiReply({
        id: 'bad',
        messages: [{role: 'user', text: 'test'}],
        locale: 'en',
        invoke: async () => {
            attempts++;
            return {ok: true, data: {content: '{}'}};
        }
    }), /校验未通过/);
    assert.strictEqual(attempts, 3);
    await assert.rejects(generateEstAiReply({
        id: 'cancelled',
        messages: [],
        isCurrent: () => false,
        invoke: () => {
            throw new Error('Must not request');
        }
    }), /取消/);

    let key = '';
    let pending;
    let signal;
    const keyStore = {read: () => key,
        write: value => {
            key = value;
        }};
    const service = createEstAiService({keyStore,
        transport: request => {
            assert.strictEqual(request.apiKey, 'test-key-not-real');
            signal = request.signal;
            pending = deferred();
            return pending.promise;
        }});
    const request = {id: 'first',
        messages: [
            {role: 'system', content: 'JSON'}, {role: 'user', content: 'test'}
        ]};
    assert.deepStrictEqual(service.status(), {configured: false, hasKey: false, config: defaultEstAiConfig()});
    await assert.rejects(service.generate(request), /密钥/);
    assert.throws(() => service.saveConfig({...customConfig, apiKey: 'bad\nkey'}), /有效/);
    const savedStatus = service.saveConfig({...deepseekConfig, apiKey: 'test-key-not-real'});
    assert.deepStrictEqual(savedStatus, {configured: true, hasKey: true, config: deepseekConfig});
    assert.ok(!JSON.stringify(service.status()).includes('test-key-not-real'));
    assert.throws(() => service.saveConfig({...customConfig, apiKey: ''}), /不会沿用/);
    assert.deepStrictEqual(service.status(), savedStatus, 'A rejected endpoint change must preserve saved settings');
    service.saveConfig({...deepseekConfig, model: 'another-model', apiKey: ''});
    assert.strictEqual(JSON.parse(key).apiKey, 'test-key-not-real', 'Model-only edit may retain the bound key');
    service.saveConfig({...deepseekConfig, apiKey: ''});
    await assert.rejects(service.generate({...request, messages: [{role: 'tool'}]}), /对话/);
    await assert.rejects(service.generate({...request,
        messages: [
            {role: 'user', content: 'x'}, {role: 'system', content: 'x'}
        ]}), /格式/);
    const first = service.generate(request);
    await assert.rejects(service.generate({...request, id: 'duplicate'}), /处理中/);
    service.cancel('other');
    assert.strictEqual(signal.aborted, false);
    const firstPending = pending;
    service.cancel('first');
    assert.strictEqual(signal.aborted, true);
    const second = service.generate({...request, id: 'second'});
    firstPending.resolve(validContent);
    await assert.rejects(first, /取消/);
    pending.resolve(validContent);
    assert.deepStrictEqual(await second, {content: validContent});

    const handlers = {};
    registerEstAiIpc({
        ipcMain: {handle: (channel, handler) => {
            handlers[channel] = handler;
        }},
        isAllowedSender: event => event.allowed,
        keyStore
    });
    assert.strictEqual((await handlers['est-ai-status']({allowed: false})).ok, false);
    assert.strictEqual((await handlers['est-ai-status']({allowed: true})).data.configured, true);

    const disk = {};
    let encryptionAvailable = true;
    const store = createEstAiKeyStore({
        getPath: () => 'test-key.bin',
        safeStorage: {
            isEncryptionAvailable: () => encryptionAvailable,
            encryptString: value => Buffer.from(`encrypted:${value}`),
            decryptString: value => value.toString().replace('encrypted:', '')
        },
        fs: {
            mkdirSync () {},
            unlinkSync: name => {
                delete disk[name];
            },
            existsSync: name => Boolean(disk[name]),
            readFileSync: name => disk[name],
            writeFileSync: (name, value) => {
                disk[name] = value;
            },
            renameSync: (source, destination) => {
                disk[destination] = disk[source]; delete disk[source];
            }
        }
    });
    assert.strictEqual(store.read(), '');
    store.write('test-key-not-real');
    assert.ok(Buffer.isBuffer(disk['test-key.bin']));
    assert.strictEqual(store.read(), 'test-key-not-real');
    encryptionAvailable = false;
    assert.throws(() => store.write('must-not-write'), /加密/);
    assert.throws(() => store.read(), /读取/);

    global.window = {estCurrentLocale: 'zh-cn', addEventListener () {}, removeEventListener () {}};
    global.document = {removeEventListener () {}};
    const panel = new EstAiPanel({visible: true});
    const mascotStates = [];
    panel.setState = (update, callback) => {
        const change = typeof update === 'function' ? update(panel.state) : update;
        if (change.mascotState) mascotStates.push(change.mascotState);
        Object.assign(panel.state, change);
        if (callback) callback();
    };
    panel.mounted = true;
    panel.state.input = '请让机器人前进';
    await panel.handleSend();
    assert.strictEqual(panel.state.settingsOpen, true);
    assert.strictEqual(panel.state.input, '请让机器人前进');
    assert.strictEqual(panel.state.messages.length, 0);
    panel.state.apiKey = 'test-key-not-real';
    panel.state.draftConfig = {...customConfig};
    invoke = async (channel, configRequest) => {
        assert.strictEqual(channel, 'est-ai-save-config');
        assert.deepStrictEqual(configRequest, {...customConfig, apiKey: 'test-key-not-real'});
        return {ok: true, data: {configured: true, config: customConfig, hasKey: true}};
    };
    await panel.handleSaveKey({preventDefault () {}});
    assert.strictEqual(panel.state.apiKey, '');
    assert.strictEqual(panel.state.settingsOpen, false);
    assert.strictEqual(panel.state.configured, true);
    invoke = async () => ({ok: true, data: {content: validContent}});
    const invocationsBeforeGeneration = invocations.length;
    await panel.handleSend();
    assert.deepStrictEqual(invocations.slice(invocationsBeforeGeneration).map(args => args[0]), [
        'est-auto-connect', 'est-ai-generate'
    ]);
    assert.deepStrictEqual(invocations[invocationsBeforeGeneration][1], {includePortInfo: true});
    assert.strictEqual(panel.state.messages.length, 2);
    assert.deepStrictEqual(mascotStates.filter((state, index) => mascotStates[index - 1] !== state),
        ['thinking', 'replying', 'success']);
    await new Promise(resolve => setTimeout(resolve, 1400));
    assert.strictEqual(panel.state.mascotState, 'idle', 'Success returns to idle after one animation');
    const program = panel.state.messages[1];
    assert.ok(program.previews[0].image);
    assert.ok(program.ir.stacks.length);
    assert.strictEqual(imports, 0, 'Generating must never mutate the workspace');
    await panel.handleApply(program, 'replace');
    assert.strictEqual(imports, 0, 'Cancel must preserve the workspace');
    confirmation = 0;
    await panel.handleApply(program, 'replace');
    assert.strictEqual(imports, 1);
    assert.ok(panel.state.messages[1].applied);
    assert.strictEqual(panel.state.mascotState, 'success', 'Applying the program celebrates completion');
    let prevented = false;
    panel.handleInputKeyDown({
        key: 'Enter',
        shiftKey: false,
        keyCode: 229,
        nativeEvent: {isComposing: true},
        preventDefault: () => {
            prevented = true;
        }
    });
    assert.strictEqual(prevented, false, 'IME confirmation is not send');

    const late = deferred();
    preview = () => late.promise;
    panel.state.input = '调整程序';
    const oldSend = panel.handleSend();
    for (let attempt = 0; attempt < 5 && panel.state.phase !== 'previewing'; attempt++) {
        await new Promise(resolve => setImmediate(resolve));
    }
    assert.strictEqual(panel.state.phase, 'previewing', JSON.stringify({
        busy: panel.state.busy,
        requestId: panel.requestId,
        messages: panel.state.messages.map(message => ({text: message.text, error: message.error}))
    }));
    panel.handleNewChat();
    late.resolve([{image: 'data:image/svg+xml,old'}]);
    await oldSend;
    assert.strictEqual(panel.state.messages.length, 0, 'Stale previews must not enter the new conversation');
    assert.strictEqual(panel.state.busy, false);
    assert.strictEqual(panel.state.mascotState, 'idle', 'Cancelled/stale previews cannot trigger success');
    preview = async () => [{image: 'data:image/svg+xml,test'}];
    await panel.handleLocalPreview();
    assert.ok(panel.state.messages[0].ir.stacks.length);
    assert.ok(panel.state.messages[0].localOnly);
    for (const failure of ['api', 'json', 'preview']) {
        panel.handleNewChat();
        panel.state.input = '前进';
        invoke = async channel => {
            if (channel === 'est-auto-connect') return {state: 'not-found'};
            if (failure === 'api') return {ok: false, error: 'Test API failure', errorCode: 'HTTP_503'};
            return {ok: true, data: {content: failure === 'json' ? '{}' : validContent}};
        };
        preview = async () => {
            throw new Error('Test preview failure');
        };
        await panel.handleSend();
        assert.strictEqual(panel.state.mascotState, 'error', `${failure} failure changes the whole mascot state`);
    }
    await new Promise(resolve => setTimeout(resolve, 1550));
    assert.strictEqual(panel.state.mascotState, 'idle', 'Error expression returns to idle');
    // New work cancels the previous transient state's timer.
    panel.setMascotState('success');
    panel.setMascotState('thinking');
    assert.strictEqual(panel.mascotTimer, null);
    panel.handleNewChat();
    preview = async () => [{image: 'data:image/svg+xml,test'}];
    await panel.handleLocalPreview();
    panel.handleClose();
    assert.strictEqual(panel.state.isOpen, false);
    assert.strictEqual(panel.state.messages.length, 1, 'Closing must retain the conversation');
    panel.componentWillUnmount();
    console.log('EST AI chat tests passed: validation, repair, cancellation, key storage, IPC and panel actions');
};

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
})
    .finally(() => {
        Module._load = originalLoad;
        Module._extensions['.js'] = originalJs;
        Module._extensions['.jsx'] = originalJsx;
        Module._extensions['.svg'] = originalSvg;
        Module._extensions['.css'] = originalCss;
    });
