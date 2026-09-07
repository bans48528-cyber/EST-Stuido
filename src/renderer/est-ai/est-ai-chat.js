import {
    EST_AI_BLOCK_SPEC,
    EST_AI_RULE_CATEGORY_IDS,
    getEstAiBlockSpecsForCategories
} from './est-block-spec';
import {compileEstBlockIrToXml} from './est-block-compiler';
import {getEstText} from '../est-i18n';

export const SAMPLE_IR = {
    version: 1,
    mode: 'insert',
    stacks: [{
        event: {type: 'event_program_start'},
        body: [
            {type: 'drive_set_pair', inputs: {LEFT_PORT: 'B', RIGHT_PORT: 'C'}},
            {type: 'drive_move_for', fields: {DIRECTION: 'forward', UNIT: 'rotations'}, inputs: {AMOUNT: 1}},
            {type: 'control_wait_seconds', inputs: {SECONDS: 1}},
            {type: 'drive_stop'}
        ]
    }]
};

const RULE_CATEGORY_PATTERNS = {
    movement: /(前进|后退|倒车|小车|行驶|移动|转向|转弯|巡线|循迹|驱动|左转|右转|move|drive|steer|turn|line.?follow|wheel)/i,
    motor: /(单(?:个|独).*电机|马达|电机.*(?:速度|功率|角度|旋转|制动|刹车|堵转)|[ABCD]\s*(?:端口)?\s*(?:的)?电机|motor|stall)/i,
    display: /(显示|屏幕|图像|图片|文字|文本|清屏|状态灯|灯光|display|screen|image|text|status.?light)/i,
    sound: /(声音|播放|蜂鸣|音量|音符|音乐|sound|beep|volume|note|music)/i,
    control: /(等待|延时|秒|重复|循环|一直|永久|如果|否则|直到|停止|wait|repeat|loop|forever|if|else|until|stop)/i,
    sensing: new RegExp(
        '传感器|按键|按钮|颜色|反射光|环境光|触碰|触摸|超声波|距离|红外|陀螺仪|计时器|' +
        'sensor|button|color|touch|ultrasonic|distance|infrared|gyro|timer', 'i'
    ),
    operators: new RegExp(
        '大于|小于|等于|比较|并且|或者|逻辑|加法|减法|乘法|除法|取余|' +
        '\\b(?:greater|less|equal|compare|and|or|not|add|subtract|multiply|divide|mod)\\b', 'i'
    )
};

const PROGRAM_INTENT_PATTERN = /(程序|积木|编程|生成|创建|搭一个|做一个|机器人|program|blocks?|code|create|build|robot)/i;

const parseJsonContent = content => {
    if (typeof content !== 'string' || content.length > 100000) throw new Error('AI 回复格式不正确。');
    const trimmed = content.trim();
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return JSON.parse(fenced ? fenced[1] : trimmed);
};

const normalizeRuleCategories = categories => {
    if (!Array.isArray(categories) || categories.length > EST_AI_RULE_CATEGORY_IDS.length) {
        throw new Error('规则分类格式不正确。');
    }
    const unique = [];
    categories.forEach(category => {
        if (typeof category !== 'string' || !EST_AI_RULE_CATEGORY_IDS.includes(category)) {
            throw new Error(`未知规则分类：${String(category)}`);
        }
        if (!unique.includes(category)) unique.push(category);
    });
    return unique;
};

export const buildEstAiSystemPrompt = (locale, categories = ['event'], hardwareContext = null) => {
    const selected = normalizeRuleCategories(categories);
    const catalog = getEstAiBlockSpecsForCategories(selected).map(spec => ({
        ...spec,
        description: getEstText(`home.blockGuide.${spec.type}`, locale)
    }));
    const lines = [
        'You are the EST Studio programming assistant. Reply in the user\'s language. Return only JSON.',
        'Response: {"message":"concise explanation or clarification question","ir":null or EST Block IR}.',
        'For questions or missing essential hardware details, return ir:null. Do not invent new blocks or APIs.',
        'For program generation return the complete candidate program, including unchanged stacks for follow-up edits.',
        'IR: {version:1,mode:"insert",stacks:[{event:{type:"event_program_start"},body:[...]}]}.',
        'Node: {type,fields:{dropdownName:value},inputs:{inputName:literalOrNode},body:[...],elseBody:[...]}.',
        'Use exact names and values from the supplied local catalog. It contains all rules selected for this request.',
        'Omit fields, inputs, body, elseBody when the block has none.',
        'SUBSTACK maps to body, SUBSTACK2 maps to elseBody. All declared fields, inputs, branches are required.',
        'A Boolean input must be a Boolean block, never a literal. Enum inputs must be literals.',
        'Only hats start stacks; only statements go in body. Terminal statements must be last.',
        'At most 8 stacks, 256 blocks and depth 24. Drive pair ports must differ. ' +
            'Add stopping logic where appropriate.',
        'Variables, lists, custom procedures and arbitrary Python are not supported in this version.',
        'Programs are proposals for user review; never claim you downloaded, applied or ran them.',
        'For a conversational answer without a program, use ir:null.',
        `Loaded local rule categories: ${JSON.stringify(selected)}.`,
        `Local catalog: ${JSON.stringify(catalog)}`
    ];
    if (hardwareContext) {
        lines.push(
            'The following live USB port snapshot is reference context, not a validation rule. ' +
                'Prefer its detected ports when the user did not specify ports.',
            'USB cannot determine semantic installation roles such as left wheel or right wheel. ' +
                'Use roles stated by the user in the conversation and do not invent them.',
            `Current EST USB port snapshot: ${JSON.stringify(hardwareContext)}`
        );
    }
    return lines.join('\n');
};

export const parseEstAiReply = content => {
    const reply = parseJsonContent(content);
    if (!reply || Array.isArray(reply) || typeof reply.message !== 'string' ||
        !reply.message.trim() || reply.message.length > 8000 || !Object.prototype.hasOwnProperty.call(reply, 'ir')) {
        throw new Error('AI 回复应包含 message 与 ir。');
    }
    const compiled = reply.ir === null ? null : compileEstBlockIrToXml(reply.ir);
    return {message: reply.message.trim(), compiled, ir: compiled ? compiled.normalized : null};
};

const categoriesFromIr = ir => {
    const categories = [];
    const visit = node => {
        if (!node || typeof node !== 'object' || Array.isArray(node)) return;
        const spec = typeof node.type === 'string' ? EST_AI_BLOCK_SPEC[node.type] : null;
        if (spec && !categories.includes(spec.category)) categories.push(spec.category);
        Object.values(node.inputs || {}).forEach(input => visit(input));
        (node.body || []).forEach(visit);
        (node.elseBody || []).forEach(visit);
    };
    if (ir && Array.isArray(ir.stacks)) {
        ir.stacks.forEach(stack => {
            visit(stack.event);
            (stack.body || []).forEach(visit);
        });
    }
    return categories;
};

const latestProgramCategories = messages => {
    for (let index = messages.length - 1; index >= 0; index--) {
        if (messages[index].role === 'assistant' && messages[index].ir) return categoriesFromIr(messages[index].ir);
    }
    return [];
};

export const selectEstAiRuleCategories = messages => {
    const latestUser = messages.slice()
        .reverse()
        .find(message => message.role === 'user' && !message.error);
    const text = latestUser && typeof latestUser.text === 'string' ? latestUser.text : '';
    const previous = latestProgramCategories(messages);
    const matched = Object.keys(RULE_CATEGORY_PATTERNS).filter(
        category => RULE_CATEGORY_PATTERNS[category].test(text)
    );
    if (!previous.length && !matched.length && !PROGRAM_INTENT_PATTERN.test(text)) return [];
    const requested = new Set(['event', ...previous, ...matched]);
    return EST_AI_RULE_CATEGORY_IDS.filter(category => requested.has(category));
};

const invokeCompletion = async ({id, requestMessages, invoke, isCurrent}) => {
    if (!isCurrent()) throw new Error('请求已取消。');
    const result = await invoke('est-ai-generate', {id, messages: requestMessages});
    if (!isCurrent()) throw new Error('请求已取消。');
    if (!result || !result.ok) {
        const requestError = new Error((result && result.error) || 'AI 服务不可用，请重启 Studio。');
        requestError.code = result && result.errorCode;
        throw requestError;
    }
    return result.data.content;
};

export const generateEstAiReply = async ({
    id,
    messages,
    locale,
    invoke,
    hardwareContext = null,
    onPhase = () => {},
    isCurrent = () => true
}) => {
    const history = messages.filter(message => !message.localOnly && !message.error).slice(-12)
        .map(message => ({
            role: message.role,
            content: message.role === 'assistant' ?
                JSON.stringify({message: message.text, ir: message.ir || null}) : message.text
        }));
    const categories = selectEstAiRuleCategories(messages);
    const requestMessages = [{
        role: 'system',
        content: buildEstAiSystemPrompt(locale, categories, hardwareContext)
    }].concat(history);
    for (let attempt = 0; attempt < 3; attempt++) {
        if (!isCurrent()) throw new Error('请求已取消。');
        onPhase('thinking');
        const content = await invokeCompletion({id, requestMessages, invoke, isCurrent});
        onPhase('replying');
        try {
            return {...parseEstAiReply(content), ruleCategories: categories};
        } catch (error) {
            if (attempt === 2) throw new Error(`程序校验未通过，请调整描述后重试。${error.message}`);
            requestMessages.push({role: 'assistant', content: content.slice(0, 60000)});
            requestMessages.push({
                role: 'user',
                content: `Repair your JSON/IR with this validation error: ${error.message}`
            });
        }
    }
    return null;
};
