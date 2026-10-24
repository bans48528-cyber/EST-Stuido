import {
    getEstAiBlockCatalog,
    EST_AI_RULE_CATEGORY_IDS,
    getEstAiBlockSpecsForCategories
} from './est-block-spec';
import {compileEstBlockIrToXml} from './est-block-compiler';
import {getEstText} from '../est-i18n';
import {getHardwareProfile} from '../../common/hardware-profiles';
import {SPARK_AI_SAMPLE_IR, getSparkAiBlockDescription} from '../spark-ai/ai-spec';

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

export const getAiSampleIr = (hardwareId = 'est') => (hardwareId === 'spark-ai' ? SPARK_AI_SAMPLE_IR : SAMPLE_IR);

const RULE_CATEGORY_PATTERNS = {
    movement: /(前进|后退|倒车|小车|行驶|移动|转向|转弯|巡线|循迹|驱动|左转|右转|move|drive|steer|turn|line.?follow|wheel)/i,
    motor: /(单(?:个|独).*电机|马达|电机.*(?:速度|功率|角度|旋转|制动|刹车|堵转)|[A-H]\s*(?:端口)?\s*(?:的)?电机|motor|stall)/i,
    display: new RegExp('显示|屏幕|图像|图片|绘图|画|像素|文字|文本|清屏|状态灯|灯光|矩阵|点阵|' +
        'display|screen|image|draw|bitmap|pixel|text|matrix|matriz|status.?light', 'i'),
    sound: /(声音|播放|蜂鸣|音量|音符|音乐|sound|beep|volume|note|music)/i,
    control: /(等待|延时|秒|重复|循环|一直|永久|如果|否则|直到|停止|wait|repeat|loop|forever|if|else|until|stop)/i,
    sensing: new RegExp(
        '传感器|按键|按钮|颜色|反射光|环境光|触碰|触摸|超声波|距离|红外|陀螺仪|计时器|' +
        '手柄|sensor|button|controller|gamepad|color|touch|ultrasonic|distance|infrared|gyro|timer', 'i'
    ),
    operators: new RegExp(
        '大于|小于|等于|比较|并且|或者|逻辑|加法|减法|乘法|除法|取余|随机|拼接|字符|长度|包含|四舍五入|取整|绝对值|平方根|三角|对数|' +
        '\\b(?:greater|less|equal|compare|and|or|not|add|subtract|multiply|divide|mod|' +
        'random|join|letter|length|contains|round|sqrt|sin|cos|tan|abs|floor|log)\\b', 'i'
    ),
    variables: /(变量|计数|计分|得分|列表|数组|清单|第.+项|variable|counter|score|list|array)/i,
    procedures: /(自定义积木|函数|子程序|参数|封装|调用|custom.?block|procedure|function|parameter|argument|call)/i
};

const PROGRAM_INTENT_PATTERN = /(程序|积木|编程|生成|创建|搭一个|做一个|机器人|program|blocks?|code|create|build|robot)/i;
const MOTOR_FEEDBACK_PATTERN = /(跟随|跟踪|同步|闭环|实时|follow|track|synchron|feedback|\bPID\b)/i;

// Use the same bounded, eligible conversation for rule selection and API history.
// A clarification answer often contains only ports or "yes", not task keywords.
const requestHistory = messages => messages.filter(message => !message.localOnly && !message.error).slice(-12);

// Remove only trailing commas outside strings. Never guess missing brackets or values.
const withoutTrailingCommas = source => {
    let quoted = false;
    let escaped = false;
    let result = '';
    for (let index = 0; index < source.length; index++) {
        const char = source[index];
        if (quoted) {
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === '"') quoted = false;
        } else if (char === '"') quoted = true;
        else if (char === ',') {
            let next = index + 1;
            while (/\s/.test(source[next] || '') && next < source.length) next++;
            if (source[next] === ']' || source[next] === '}') continue;
        }
        result += char;
    }
    return result;
};

const parseJsonContent = content => {
    if (typeof content !== 'string' || content.length > 100000) throw new Error('AI 回复格式不正确。');
    const trimmed = content.trim();
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    const source = fenced ? fenced[1] : trimmed;
    try {
        return JSON.parse(source);
    } catch (originalError) {
        try {
            return JSON.parse(withoutTrailingCommas(source));
        } catch (error) {
            const failure = new Error(originalError.message);
            failure.code = 'AI_JSON_SYNTAX';
            throw failure;
        }
    }
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

export const buildEstAiSystemPrompt = (locale, categories = ['event'], hardwareContext = null, hardwareId = 'est') => {
    const selected = normalizeRuleCategories(categories);
    const profile = getHardwareProfile(hardwareId);
    const catalog = getEstAiBlockSpecsForCategories(selected, hardwareId).map(spec => ({
        ...spec,
        description: (hardwareId === 'spark-ai' && getSparkAiBlockDescription(spec.type, locale)) ||
            getEstText(`home.blockGuide.${spec.type}`, locale)
    }));
    const start = hardwareId === 'spark-ai' ? 'spark_event_whenflagclicked' : 'event_program_start';
    const lines = [
        'You are the EST Studio programming assistant. Reply in the user\'s language. Return only JSON.',
        'Response: {"message":"concise explanation or clarification question","ir":null or EST Block IR}.',
        'For questions or missing essential hardware details, return ir:null. Do not invent new blocks or APIs.',
        'For program generation return the complete candidate program, including unchanged stacks for follow-up edits.',
        'Valid response structure example (replace the empty body with task blocks): ' +
            '{"message":"Program proposal","ir":{"version":1,"mode":"insert",' +
            `"hardwareId":"${hardwareId}","stacks":[{"event":{"type":"${start}"},"body":[]}]}}`,
        `Target hardware: ${profile.name} (${hardwareId}). IR.hardwareId must be "${hardwareId}". ` +
            `Motor ports: ${profile.motorPorts.join(',')}; sensor ports: ${profile.sensorPorts.join(',')}. ` +
            'Never use blocks, APIs or ports from another hardware model.',
        'Node keys: type, fields, inputs, body, elseBody. Inputs may contain literals or nested block objects.',
        'Use strict JSON: double-quoted keys and strings, balanced object/array brackets, no comments, ' +
            'trailing commas, ellipses or JavaScript expressions. Arithmetic must use operator blocks.',
        'Use exact names and values from the supplied local catalog. It contains all rules selected for this request.',
        'Studio supplies built-in rules automatically; do not ask the user to upload or load this catalog.',
        'Combine the original task with subsequent clarifications; do not ask again for already confirmed details.',
        'Omit fields, inputs, body, elseBody when the block has none.',
        'SUBSTACK maps to body, SUBSTACK2 maps to elseBody. All declared fields, inputs, branches are required.',
        'A Boolean input must be a Boolean block, never a literal. Enum inputs must be literals.',
        'Only hats start stacks; only statements go in body. Terminal statements must be last.',
        'At most 8 stacks, 256 blocks and depth 24. Drive pair ports must differ. ' +
            'Add stopping logic where appropriate.',
        'Arbitrary Python, XML, JavaScript, external image URLs and raw Blockly mutations are not accepted.',
        'Programs are proposals for user review; never claim you downloaded, applied or ran them.',
        'For a conversational answer without a program, use ir:null.',
        `Loaded local rule categories: ${JSON.stringify(selected)}.`,
        `Local catalog: ${JSON.stringify(catalog)}`
    ];
    if (selected.includes('variables')) {
        lines.push(
            'IR.variables: [{name:"count",type:""},{name:"items",type:"list"}]. Up to 64 unique symbols.',
            'VARIABLE/LIST fields use declared names, not IDs. Initialize with set/add blocks in a start stack.',
            'Names: unique ignoring case, 1-64 characters, no controls or __proto__/constructor/prototype.',
            'List INDEX is numeric, 1-based. Insert creates independent symbols and renames workspace collisions.'
        );
    }
    if (selected.includes('procedures')) {
        lines.push(
            'Optional IR.procedures: [{name:"move",arguments:[{name:"distance",type:"number"}],warp:false}].',
            'Argument types: number/text/boolean; up to 16 unique names. Procedure names forbid % and backslash.',
            'Each declaration needs one stack: event:{type:"procedures_definition",fields:{PROCEDURE:"move"}}.',
            'Call: {type:"procedures_call",fields:{PROCEDURE:"move"},inputs:{distance:1}}.',
            'Call input keys match declared argument names exactly; all required, including zero/empty text.',
            'Inside its definition use argument_reporter_number/string/boolean with fields:{VALUE:"argument name"}.',
            'Arguments are scoped to their definition. Keep declarations and definition stacks on follow-up edits.'
        );
    }
    if (hardwareId === 'spark-ai') {
        lines.push(
            'Spark AI uses only spark_* toolbox blocks plus the supplied native data/procedure blocks, not EST blocks.',
            'Motor pair input PORT is an ordered string such as E+F: first=left motor, second=right; distinct E/F/G/H.',
            'Do not invent left/right installation roles. Ask if drive motor ports or roles have not been confirmed.',
            'Matrix is 5 columns by 7 rows, NOT an EST screen. lamp is exactly 35 binary digits, row-major.',
            'For a single matrix pixel, x is the row (0..6), y is the column (0..4).',
            'Hand controller face buttons: top 1=Y, right 2=X, bottom 3=A, left 4=B. ' +
                'Use the internal Y/X/A/B values in IR, and 1/2/3/4 in user-facing explanations.',
            'Timer is milliseconds; wait/motor duration/note BEATS use seconds. ' +
                'Line-patrol PORT_ONE/PORT_TWO use numeric sensor indices A=0,B=1,C=2,D=3.',
            'spark_control_break is valid only inside a repeat/forever/repeat-until loop.'
        );
    } else if (selected.includes('display')) {
        lines.push(
            'display_draw.fields.BITMAP accepts {rows:["010","111"],x:0,y:0,scale:1} or canonical v1: bitmap encoding.',
            'Rows: equal-width 0/1 strings (white/black). Integer x/y origin, scale=1..16; must fit in 180x128.'
        );
    }
    if (hardwareContext) {
        lines.push(
            'The following live port snapshot is reference context, not a validation rule. ' +
                'Prefer its detected ports when the user did not specify ports.',
            'USB cannot determine semantic installation roles such as left wheel or right wheel. ' +
                'Use roles stated by the user in the conversation and do not invent them.',
            `Current ${profile.name} port snapshot: ${JSON.stringify(hardwareContext)}`
        );
    }
    return lines.join('\n');
};

export const parseEstAiReply = (content, hardwareId = 'est') => {
    const reply = parseJsonContent(content);
    if (!reply || Array.isArray(reply) || typeof reply.message !== 'string' ||
        !reply.message.trim() || reply.message.length > 8000 || !Object.prototype.hasOwnProperty.call(reply, 'ir')) {
        throw new Error('AI 回复应包含 message 与 ir。');
    }
    const compiled = reply.ir === null ? null : compileEstBlockIrToXml(reply.ir, {hardwareId});
    return {message: reply.message.trim(), compiled, ir: compiled ? compiled.normalized : null};
};

const categoriesFromIr = (ir, hardwareId) => {
    const catalog = getEstAiBlockCatalog(hardwareId);
    const categories = [];
    const visit = node => {
        if (!node || typeof node !== 'object' || Array.isArray(node)) return;
        const spec = typeof node.type === 'string' ? catalog[node.type] : null;
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
    for (const category of ['variables', 'procedures']) {
        if (ir && ir[category] && ir[category].length && !categories.includes(category)) categories.push(category);
    }
    return categories;
};

const latestProgramCategories = (messages, hardwareId) => {
    for (let index = messages.length - 1; index >= 0; index--) {
        if (messages[index].role === 'assistant' && messages[index].ir) {
            return categoriesFromIr(messages[index].ir, hardwareId);
        }
    }
    return [];
};

export const selectEstAiRuleCategories = (messages, hardwareId = 'est') => {
    const history = requestHistory(messages);
    const text = history.filter(message => message.role === 'user' && typeof message.text === 'string')
        .map(message => message.text)
        .join('\n');
    const previous = latestProgramCategories(history, hardwareId);
    const matched = Object.keys(RULE_CATEGORY_PATTERNS).filter(
        category => RULE_CATEGORY_PATTERNS[category].test(text)
    );
    if (hardwareId === 'spark-ai') {
        const localized = {
            movement: /avanç|avanc|mover|andar|virar|движ|впер|назад|повор/i,
            motor: /motor|мотор|двигател/i,
            display: /mostrar|limpar|matriz|экран|матриц|показ/i,
            sound: /tocar|música|musica|nota|звук|музык/i,
            control: /esperar|segundo|repetir|sempre|parar|ждать|секунд|повтор|цикл|останов/i,
            sensing: /botão|botao|controle|датчик|кноп|геймпад/i
        };
        Object.keys(localized).forEach(category => {
            if (localized[category].test(text) && !matched.includes(category)) matched.push(category);
        });
    }
    if (!previous.length && !matched.length && !PROGRAM_INTENT_PATTERN.test(text)) return [];
    const requested = new Set(['event', ...previous, ...matched]);
    if (requested.has('motor') && MOTOR_FEEDBACK_PATTERN.test(text)) {
        requested.add('control');
        requested.add('operators');
    }
    if (requested.has('variables') || requested.has('procedures')) {
        requested.add('control');
        requested.add('operators');
    }
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
    hardwareId = 'est',
    onPhase = () => {},
    isCurrent = () => true
}) => {
    const history = requestHistory(messages)
        .map(message => ({
            role: message.role,
            content: message.role === 'assistant' ?
                JSON.stringify({message: message.text, ir: message.ir || null}) : message.text
        }));
    const categories = selectEstAiRuleCategories(messages, hardwareId);
    const initialMessages = [{
        role: 'system',
        content: buildEstAiSystemPrompt(locale, categories, hardwareContext, hardwareId)
    }].concat(history);
    let requestMessages = initialMessages;
    for (let attempt = 0; attempt < 3; attempt++) {
        if (!isCurrent()) throw new Error('请求已取消。');
        onPhase('thinking');
        const content = await invokeCompletion({id, requestMessages, invoke, isCurrent});
        onPhase('replying');
        try {
            return {...parseEstAiReply(content, hardwareId), ruleCategories: categories};
        } catch (error) {
            if (attempt === 2) {
                if (error.code === 'AI_JSON_SYNTAX') {
                    throw new Error('模型连续返回了无效 JSON，自动修复未成功。请重试；' +
                        '若接口支持，可在连接设置中开启 JSON 模式。无需修改你的程序需求。');
                }
                throw new Error(`程序校验未通过，自动修复未成功。${error.message}`);
            }
            // Keep the original task, but only the latest failed candidate, not every malformed response.
            requestMessages = initialMessages.concat({role: 'assistant', content: content.slice(0, 60000)}, {
                role: 'user',
                content: `Repair your JSON/IR with this validation error: ${error.message}\n` +
                    'Return the complete corrected JSON object with message and ir, not a patch or explanation. ' +
                    'Keep the confirmed task and ports. Rebuild nested objects/arrays with matching brackets. ' +
                    'Use double quotes, no comments or trailing commas. Do not put arithmetic expressions in JSON; ' +
                    'use catalog operator blocks. The entire response must parse with JSON.parse.'
            });
        }
    }
    return null;
};
