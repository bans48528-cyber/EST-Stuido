import {
    getEstAiBlockCatalog,
    EST_AI_RULE_CATEGORY_IDS
} from './est-block-spec';
import {compileEstBlockIrToXml} from './est-block-compiler';
import {getEstText} from '../est-i18n';
import {getHardwareProfile} from '../../common/hardware-profiles';
import {SPARK_AI_SAMPLE_IR, getSparkAiBlockDescription} from '../spark-ai/ai-spec';
import {NEW_AI_SAMPLE_IR, getNewAiBlockDescription} from '../new-ai/ai-spec';
import {NEW_MATRIX_TEXT_CHARACTERS, NEW_MATRIX_TEXT_MAX_LENGTH} from '../new-ai/matrix-text';

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

export const getAiSampleIr = (hardwareId = 'est') =>
    ({'spark-ai': SPARK_AI_SAMPLE_IR, 'new-ai': NEW_AI_SAMPLE_IR}[hardwareId] || SAMPLE_IR);

// Keep eligible conversation history bounded; capabilities do not depend on its wording.
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

// Conversation hints never restrict access to the current hardware's programming blocks.
export const selectEstAiRuleCategories = (messages, hardwareId = 'est') => {
    const available = new Set(Object.values(getEstAiBlockCatalog(hardwareId)).map(spec => spec.category));
    return EST_AI_RULE_CATEGORY_IDS.filter(category => available.has(category));
};

export const buildEstAiSystemPrompt = (locale, categories = null, hardwareContext = null, hardwareId = 'est') => {
    // Retain the category argument for existing callers, but never use it as a capability filter.
    if (categories !== null) normalizeRuleCategories(categories);
    const selected = selectEstAiRuleCategories([], hardwareId);
    const profile = getHardwareProfile(hardwareId);
    const catalog = Object.values(getEstAiBlockCatalog(hardwareId)).map(spec => ({
        ...spec,
        description: (hardwareId === 'spark-ai' && getSparkAiBlockDescription(spec.type, locale)) ||
            (hardwareId === 'new-ai' && getNewAiBlockDescription(spec.type)) ||
            getEstText(`home.blockGuide.${spec.type}`, locale)
    }));
    const start = getAiSampleIr(hardwareId).stacks[0].event.type;
    const lines = [
        'You are the ATC CodeStudio programming assistant. Reply in the user\'s language. Return only JSON.',
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
        'The supplied local catalog is the complete programming capability of this hardware. ' +
            'All its blocks are enabled.',
        'Use loops, conditions, arithmetic, logic, text, variables, lists and custom procedures whenever needed. ' +
            'These capabilities require no extra permission, keyword or rule-loading step.',
        'Use this catalog as the current capability source even if an older conversation claimed otherwise.',
        'Use exact block names, input names and values from the complete local catalog.',
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
        `Available local rule categories (all enabled): ${JSON.stringify(selected)}.`,
        `Local catalog: ${JSON.stringify(catalog)}`
    ];
    if (selected.includes('variables')) {
        lines.push(
            'IR.variables: [{name:"count",type:""},{name:"items",type:"list"}]. Up to 64 unique symbols.',
            'VARIABLE/LIST fields use declared names, not IDs. Initialize with set/add blocks in a start stack.',
            'Names: unique ignoring case, 1-64 characters, no controls or __proto__/constructor/prototype.',
            'List INDEX is numeric, 1-based. Insert creates independent symbols and renames workspace collisions.',
            'Keep list item numbers 1-based in IR. The code generator handles the runtime conversion; ' +
                'do not subtract 1 in the blocks.'
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
    if (hardwareId === 'spark-ai' || hardwareId === 'new-ai') {
        lines.push('Trigonometric inputs and inverse-trigonometric results use degrees. ' +
            'The legacy mathop field ln_abs is labelled log in the toolbox and means base-10 logarithm. ' +
            'For natural logarithms, compose log(x)/log(e) using the available math blocks. ' +
            'Use data_lengthoflist for list item counts; the text-length block is not a list-count block.');
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
    } else if (hardwareId === 'new-ai') {
        lines.push(
            'NEW AI uses only new_* toolbox blocks plus supplied native data/procedure blocks. ' +
                'Do not use EST or Spark blocks/APIs.',
            'A descriptor.shadow is UI metadata, never an IR node. The compiler creates literal shadows. ' +
                'Use raw literals in inputs; do not emit new_text, new_math_* or picker nodes. ' +
                'Examples: {"type":"new_matrix_lamp_text","inputs":{"matrix_text":"HELLO"}} and ' +
                '{"type":"new_control_wait","inputs":{"DURATION":1}}. ' +
                'Nested input blocks must themselves be listed as catalog block types.',
            'All eight A-H ports are shared motor/sensor ports, not Spark separate E-H motors and A-D sensors.',
            'Motor pair PORT is ordered, such as A+D: first=left motor, second=right; ports must differ. ' +
                'Ask for installation roles when unknown. Never assign a detected sensor port as a motor.',
            'RGB matrix: 7 columns by 9 rows. lamp is exactly 63 binary digits, row-major, with COLOR=#RRGGBB.',
            'Single pixel x is row 0..8, y is column 0..6; brightness is 0..100. Not an EST 180x128 screen.',
            `Scrolling text supports only ${NEW_MATRIX_TEXT_CHARACTERS}; ` +
                `keep every final displayed string within ${NEW_MATRIX_TEXT_MAX_LENGTH} characters.`,
            'Use uppercase English display labels such as SUM, AVG, MAX, PASS, OUT, COUNT, QUALIFIED and SPECIAL, ' +
                'with = as the separator. Translate Chinese display labels and replace unsupported punctuation. ' +
                'This applies to text passed through variables, joins and procedure arguments too. ' +
                'Keep explanations in the user language. Repair old incompatible display labels on follow-up edits.',
            'new_control_break is valid only inside a loop. new_control_stop may have a following block only ' +
                'with STOP_OPTION="other"; single/all/exit are terminal.',
            'Movement is configured with new_combined_motor_starting (ordered pair), direction and speed. ' +
                'new_combined_motor_startWithPower consumes POWER_ONE/POWER_TWO; preserve that order.',
            'Line-patrol PORT_ONE/PORT_TWO are numeric indices A=0 through H=7, not letters. ' +
                'Gray V2 CHANNEL dropdowns use 0..6 for channels 1..7.',
            'Camera recognition blocks refer to the physical NEW AI camera on an A-H port, not the PC webcam. ' +
                'PC webcam vision input is not supported on this target.',
            'Use only catalog sound names (without .wav), colour-card values, modes and note names. ' +
                'Wait DURATION and note BEATS use seconds. Broadcast MSG1..MSG32 use values 0..31.'
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
