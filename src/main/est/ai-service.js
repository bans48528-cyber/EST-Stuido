import https from 'https';
import http from 'http';
import {
    EST_AI_PROVIDERS, defaultEstAiConfig, isLocalEstAiUrl, normalizeEstAiConfig, sameEstAiEndpoint
} from '../../common/est-ai-config';

const MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_REQUEST_BYTES = 240000;
const REQUEST_TIMEOUT = 8 * 60 * 1000;

const responseError = (code, message) => Object.assign(new Error(message), {code});

export const parseEstAiCompletionResponse = source => {
    if (/^\s*</.test(source)) {
        throw responseError('AI_HTML_RESPONSE', 'API 地址返回了网页而不是 AI 回复，请检查基础地址是否需要 /v1。');
    }
    let result;
    try {
        result = JSON.parse(source);
    } catch (error) {
        throw responseError('AI_RESPONSE_FORMAT', 'AI 服务未返回有效的 JSON 响应，请检查 API 地址与接口兼容性。');
    }
    const choice = result && Array.isArray(result.choices) && result.choices[0];
    if (!choice || !choice.message || typeof choice.message !== 'object') {
        throw responseError('AI_RESPONSE_FORMAT', 'AI 服务返回的格式不符合 Chat Completions 接口，请检查 API 地址。');
    }
    const message = choice.message;
    if (choice.finish_reason === 'content_filter' || message.refusal) {
        throw responseError('AI_REFUSED', 'AI 服务拒绝了这次请求，未生成程序。请调整需求后重试。');
    }
    if (choice.finish_reason === 'length') {
        throw responseError('AI_OUTPUT_LIMIT', 'AI 回复达到服务的输出上限，被截断，未导入程序。请提高服务的输出额度后重试。');
    }
    if (['tool_calls', 'function_call'].includes(choice.finish_reason) ||
        (Array.isArray(message.tool_calls) && message.tool_calls.length) || message.function_call) {
        throw responseError('AI_UNEXPECTED_TOOLS', 'AI 服务返回了工具调用而非积木程序，请检查模型与接口模式。');
    }
    if (typeof message.content !== 'string' || !message.content.trim()) {
        throw responseError('AI_EMPTY_RESPONSE', 'AI 服务没有返回最终答案，未生成程序。请检查模型的思考模式或输出额度后重试。');
    }
    if (choice.finish_reason !== 'stop') {
        if (choice.finish_reason !== null && typeof choice.finish_reason !== 'undefined') {
            throw responseError('AI_INCOMPLETE_RESPONSE', 'AI 服务没有正常结束回复，未导入程序。请重试或检查接口兼容性。');
        }
        // Some compatible gateways omit the end marker. Accept only a whole JSON
        // candidate; the renderer still validates its schema and hardware catalog.
        const content = message.content.trim();
        const fenced = content.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
        try {
            const candidate = JSON.parse(fenced ? fenced[1] : content);
            if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
                throw new Error('Invalid JSON');
            }
        } catch (error) {
            throw responseError('AI_INCOMPLETE_RESPONSE', 'AI 服务缺少结束标记且正文不完整，未导入程序。请重试。');
        }
    }
    return message.content;
};

// Only the main process supplies a saved, validated endpoint. Never follow redirects with credentials.
const requestCompletionAtEndpoint = ({apiKey, config, messages, signal}, versioned = false) =>
    new Promise((resolve, reject) => {
        const normalized = normalizeEstAiConfig(config);
        const endpoint = new URL(`${normalized.baseUrl}/chat/completions`);
        if (versioned) endpoint.pathname = '/v1/chat/completions';
        const payload = {model: normalized.model, messages, stream: false};
        if (normalized.jsonMode) payload.response_format = {type: 'json_object'};
        if (endpoint.hostname === 'api.deepseek.com') payload.thinking = {type: 'disabled'};
        const body = JSON.stringify(payload);
        let settled = false;
        let timer = null;
        let request = null;
        const finish = (error, value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (error) reject(error);
            else resolve(value);
        };
        const httpError = (status, message) => {
            const error = new Error(message);
            error.code = `HTTP_${status}`;
            return error;
        };
        timer = setTimeout(() => {
            const error = new Error('请求超时：AI 服务在 8 分钟内没有返回完整回复。请重试或检查模型与 API 地址。');
            error.code = 'REQUEST_TIMEOUT';
            finish(error);
            request.destroy();
        }, REQUEST_TIMEOUT);
        const transport = endpoint.protocol === 'https:' ? https : http;
        request = transport.request(endpoint.href, {
            method: 'POST',
            signal,
            headers: {
                ...(apiKey ? {Authorization: `Bearer ${apiKey}`} : {}),
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        }, response => {
            if (response.statusCode !== 200) {
                const errors = {
                    401: 'API 密钥无效，或密钥不属于当前 API 地址。请检查连接设置。',
                    400: '接口不接受当前请求，请检查模型 ID，或关闭 JSON 模式后重试。',
                    402: 'AI 服务账户余额不足。',
                    403: 'AI 服务拒绝访问，请检查密钥权限。',
                    404: 'API 地址或模型不存在，请检查配置。',
                    429: '请求过于频繁，请稍后重试。',
                    500: 'AI 服务内部出错（500），请稍后重试。',
                    502: 'AI 网关无法连接上游服务（502），请稍后重试或检查服务商状态。',
                    503: 'AI 服务当前没有可用通道（503）。请检查模型 ID；若配置无误，请稍后重试。',
                    504: 'AI 网关等待上游超时（504），请稍后重试。'
                };
                finish(httpError(
                    response.statusCode,
                    errors[response.statusCode] || `AI 服务暂时不可用（${response.statusCode}）。`
                ));
                response.destroy();
                return;
            }
            const chunks = [];
            let size = 0;
            response.on('data', chunk => {
                size += chunk.length;
                if (size > MAX_RESPONSE_BYTES) {
                    finish(new Error('AI 回复过长，请缩小程序范围后重试。'));
                    response.destroy();
                    return;
                }
                chunks.push(chunk);
            });
            response.on('error', () => finish(new Error('AI 连接中断，请重试。')));
            response.on('aborted', () => finish(new Error('AI 连接中断，请重试。')));
            response.on('end', () => {
                try {
                    finish(null, parseEstAiCompletionResponse(Buffer.concat(chunks).toString('utf8')));
                } catch (error) {
                    finish(error);
                }
            });
        });
        request.on('error', () => finish(new Error(signal.aborted ? '请求已取消。' : '无法连接 AI 服务，请检查网络。')));
        request.end(body);
    });

export const requestEstAiCompletion = async request => {
    try {
        return await requestCompletionAtEndpoint(request);
    } catch (error) {
        const base = new URL(normalizeEstAiConfig(request.config).baseUrl);
        if (error.code !== 'AI_HTML_RESPONSE' || base.pathname !== '/' || request.signal.aborted) throw error;
        // A bare gateway origin may serve its website at /chat/completions.
        // Retry only /v1 on that exact origin, never a redirect or another host.
        return requestCompletionAtEndpoint(request, true);
    }
};

const readSavedConfig = keyStore => {
    const saved = keyStore.read();
    if (!saved) return null;
    // Read a previously saved DeepSeek-only key without changing or deleting its file.
    if (!saved.startsWith('{')) {
        const preset = EST_AI_PROVIDERS.find(provider => provider.id === 'deepseek');
        return {...preset, provider: preset.id, apiKey: saved};
    }
    let parsed;
    try {
        parsed = JSON.parse(saved);
    } catch (error) {
        throw new Error('已保存的 AI 配置损坏，请重新输入密钥并保存。');
    }
    if (parsed.version !== 2 || typeof parsed.apiKey !== 'string') throw new Error('AI 配置格式不正确。');
    return {...normalizeEstAiConfig(parsed), apiKey: parsed.apiKey};
};

export const createEstAiService = ({keyStore, transport = requestEstAiCompletion}) => {
    let active = null;
    const status = () => {
        const saved = readSavedConfig(keyStore);
        if (!saved) return {configured: false, hasKey: false, config: defaultEstAiConfig()};
        const config = normalizeEstAiConfig(saved);
        return {
            configured: Boolean(saved.apiKey) || isLocalEstAiUrl(config.baseUrl),
            hasKey: Boolean(saved.apiKey),
            config
        };
    };
    const saveConfig = value => {
        if (active) throw new Error('请先停止当前生成，再保存 API 配置。');
        const config = normalizeEstAiConfig(value);
        if (typeof value.apiKey !== 'string' || value.apiKey.length > 2048 ||
            (value.apiKey.trim() && !/^[\x21-\x7e]+$/.test(value.apiKey.trim()))) {
            throw new Error('请输入有效的 API 密钥。');
        }
        let previous = null;
        try {
            previous = readSavedConfig(keyStore);
        } catch (error) {
            // A fresh explicit key can repair an unreadable saved configuration.
        }
        const canReuse = previous && sameEstAiEndpoint(config, previous);
        const apiKey = value.apiKey.trim() || (canReuse ? previous.apiKey : '');
        if (!apiKey && !isLocalEstAiUrl(config.baseUrl)) {
            throw new Error('请填写此 API 地址的密钥；更换地址后不会沿用旧密钥。');
        }
        keyStore.write(JSON.stringify({version: 2, ...config, apiKey}));
        return status();
    };
    const cancel = requestId => {
        if (active && active.id === requestId) {
            active.controller.abort();
            active = null;
        }
    };
    const generate = async request => {
        if (active) throw new Error('上一条消息仍在处理中。');
        if (!request || typeof request.id !== 'string' || request.id.length > 100 ||
            !Array.isArray(request.messages) || request.messages.length < 2 || request.messages.length > 20 ||
            Buffer.byteLength(JSON.stringify(request)) > MAX_REQUEST_BYTES) {
            throw new Error('对话过长，请新建对话后重试。');
        }
        const messages = request.messages.map((message, index) => {
            if (!message || !['user', 'assistant', 'system'].includes(message.role) ||
                (message.role === 'system' && index !== 0) ||
                typeof message.content !== 'string' || message.content.length > 100000) {
                throw new Error('对话消息格式不正确。');
            }
            return {role: message.role, content: message.content};
        });
        const saved = readSavedConfig(keyStore);
        if (!saved || (!saved.apiKey && !isLocalEstAiUrl(saved.baseUrl))) {
            throw new Error('请先配置 API 地址、模型和密钥。');
        }
        const config = normalizeEstAiConfig(saved);
        const operation = {id: request.id, controller: new AbortController()};
        active = operation;
        try {
            const content = await transport({
                apiKey: saved.apiKey, config, messages, signal: operation.controller.signal
            });
            if (operation.controller.signal.aborted) throw new Error('请求已取消。');
            return {content};
        } finally {
            if (active === operation) active = null;
        }
    };
    return {status, saveConfig, generate, cancel};
};

export const registerEstAiIpc = ({ipcMain, isAllowedSender, keyStore, transport}) => {
    const service = createEstAiService({keyStore, transport});
    const handlers = {
        'est-ai-status': () => service.status(),
        'est-ai-save-config': config => service.saveConfig(config),
        'est-ai-generate': request => service.generate(request),
        'est-ai-cancel': id => service.cancel(id)
    };
    Object.keys(handlers).forEach(channel => {
        ipcMain.handle(channel, async (event, value) => {
            if (!isAllowedSender(event)) return {ok: false, error: 'AI 请求来源无效。'};
            try {
                return {ok: true, data: await handlers[channel](value)};
            } catch (error) {
                // Never send request headers or provider response bodies back to the renderer.
                return {ok: false, error: error.message, errorCode: error.code || 'AI_ERROR'};
            }
        });
    });
};
