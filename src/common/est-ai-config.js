export const EST_AI_PROVIDERS = [
    {id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: '', jsonMode: false},
    {
        id: 'deepseek',
        label: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-v4-flash',
        jsonMode: true
    },
    {id: 'ollama', label: 'Ollama', baseUrl: 'http://localhost:11434/v1', model: '', jsonMode: false}
];

export const defaultEstAiConfig = () => ({
    provider: '', baseUrl: '', model: '', jsonMode: false
});

export const isLocalEstAiUrl = value => {
    try {
        const {hostname} = new URL(value);
        return hostname === 'localhost' || hostname === '[::1]' || /^127\./.test(hostname);
    } catch (error) {
        return false;
    }
};

export const normalizeEstAiBaseUrl = value => {
    if (typeof value !== 'string' || value.length > 2048) throw new Error('请输入有效的 API 地址。');
    let url;
    try {
        url = new URL(value.trim());
    } catch (error) {
        throw new Error('API 地址应以 https:// 开头；本机服务也可使用 http://localhost。');
    }
    if (url.username || url.password || url.search || url.hash ||
        (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocalEstAiUrl(url.href)))) {
        throw new Error('API 地址必须使用 HTTPS（本机可用 HTTP），不能包含用户名、密码、查询参数或锚点。');
    }
    url.pathname = url.pathname.replace(/\/+$/, '').replace(/\/chat\/completions$/, '');
    return url.href.replace(/\/+$/, '');
};

export const normalizeEstAiConfig = value => {
    const provider = value && value.provider === 'custom' ? '' : value && value.provider;
    if (!value || (provider !== '' && !EST_AI_PROVIDERS.some(item => item.id === provider))) {
        throw new Error('快捷预设无效，请重新选择或使用手动配置。');
    }
    if (typeof value.model !== 'string' || !value.model.trim() ||
        value.model.length > 200 || Array.from(value.model).some(char => char.charCodeAt(0) < 32 ||
            char.charCodeAt(0) === 127)) {
        throw new Error('请输入服务商提供的模型 ID。');
    }
    if (typeof value.jsonMode !== 'boolean') throw new Error('JSON 模式设置无效。');
    return {
        provider,
        baseUrl: normalizeEstAiBaseUrl(value.baseUrl),
        model: value.model.trim(),
        jsonMode: value.jsonMode
    };
};

export const sameEstAiEndpoint = (left, right) => {
    try {
        return normalizeEstAiBaseUrl(left.baseUrl) === normalizeEstAiBaseUrl(right.baseUrl);
    } catch (error) {
        return false;
    }
};
