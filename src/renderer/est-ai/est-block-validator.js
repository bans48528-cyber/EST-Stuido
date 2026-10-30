import {
    EST_AI_BLOCK_SPEC,
    EST_AI_IR_VERSION,
    EST_AI_MAX_BLOCKS,
    EST_AI_MAX_DEPTH,
    EST_AI_MAX_STACKS,
    getEstAiNodeSpec
} from './est-block-spec';
import {normalizeEstAiBitmap} from './est-ai-bitmap';
import {newMatrixTextIssue} from '../new-ai/matrix-text';

const ROOT_KEYS = new Set(['version', 'hardwareId', 'mode', 'stacks', 'variables', 'procedures']);
const STACK_KEYS = new Set(['event', 'body', 'x', 'y']);
const NODE_KEYS = new Set(['type', 'fields', 'inputs', 'body', 'elseBody']);
const CONTINUOUS_MOTION_BLOCKS = new Set([
    'motor_start',
    'motor_start_speed',
    'motor_start_power',
    'drive_start_steer',
    'drive_start_steer_speed',
    'drive_start_dual_speed',
    'spark_motor_startWithPower',
    'spark_combined_mov_dir_power',
    'spark_combined_motor_startWithPower',
    'new_motor_starting', 'new_motor_startWithPower', 'new_combined_motor_startWithPower',
    'new_combined_linepatrol', 'new_combined_linepatrol_ltr'
]);
const MOTION_STOP_BLOCKS = new Set(['motor_stop', 'drive_stop', 'spark_motor_stop', 'spark_combined_motor_stop',
    'spark_control_stop', 'new_motor_stop', 'new_combined_motor_stop', 'new_control_stop']);

const isPlainObject = value => (
    value !== null && typeof value === 'object' && !Array.isArray(value)
);

const addError = (state, code, path, message) => {
    state.errors.push({code, path, message});
};

const addUnknownKeys = (state, value, allowedKeys, path) => {
    Object.keys(value).forEach(key => {
        if (!allowedKeys.has(key)) {
            addError(state, 'UNKNOWN_PROPERTY', `${path}.${key}`, `不支持属性 ${key}`);
        }
    });
};

const validName = value => typeof value === 'string' && value.trim() === value &&
    value.length > 0 && value.length <= 64 && !/[\x00-\x1f\x7f]/.test(value) && // eslint-disable-line no-control-regex
    !['__proto__', 'constructor', 'prototype'].includes(value.toLowerCase());

const normalizeDeclarations = (state, items, kind) => {
    if (typeof items === 'undefined') return [];
    if (!Array.isArray(items) || items.length > 64) {
        addError(state, 'INVALID_DECLARATIONS', `$.${kind}`, `${kind} 必须是最多 64 项的数组`);
        return [];
    }
    const names = new Set();
    return items.slice(0, 64).map((item, index) => {
        const path = `$.${kind}[${index}]`;
        if (!isPlainObject(item) || !validName(item.name)) {
            addError(state, 'INVALID_NAME', path, '名称须为 1～64 个字符，不能含控制字符或保留名称');
            return null;
        }
        addUnknownKeys(state, item, new Set(kind === 'variables' ? ['name', 'type'] :
            ['name', 'arguments', 'warp']), path);
        if (names.has(item.name.toLowerCase())) addError(state, 'DUPLICATE_NAME', path, '声明名称不能重复');
        names.add(item.name.toLowerCase());
        if (kind === 'variables') {
            if (!['', 'list'].includes(item.type)) addError(state, 'INVALID_VARIABLE_TYPE', path, 'type 必须为 "" 或 list');
            return {name: item.name, type: item.type};
        }
        if (/[\\%]/.test(item.name)) addError(state, 'INVALID_NAME', path, '自定义积木名称不能包含 % 或反斜杠');
        if (typeof item.warp !== 'undefined' && typeof item.warp !== 'boolean') {
            addError(state, 'INVALID_WARP', path, 'warp 必须为布尔值');
        }
        if (!Array.isArray(item.arguments) || item.arguments.length > 16) {
            addError(state, 'INVALID_ARGUMENTS', path, 'arguments 必须是最多 16 项的数组');
        }
        const argumentNames = new Set();
        const args = (Array.isArray(item.arguments) ? item.arguments.slice(0, 16) : []).map((arg, argIndex) => {
            const argPath = `${path}.arguments[${argIndex}]`;
            if (!isPlainObject(arg) || !validName(arg.name) || !['number', 'text', 'boolean'].includes(arg.type)) {
                addError(state, 'INVALID_ARGUMENT', argPath, '参数需要 name 和 number/text/boolean 类型');
                return null;
            }
            addUnknownKeys(state, arg, new Set(['name', 'type']), argPath);
            if (argumentNames.has(arg.name.toLowerCase())) {
                addError(state, 'DUPLICATE_ARGUMENT', argPath, '参数名称不能重复');
            }
            argumentNames.add(arg.name.toLowerCase());
            return {name: arg.name, type: arg.type};
        }).filter(Boolean);
        return {name: item.name, arguments: args, warp: item.warp || false};
    })
        .filter(Boolean);
};

const validateFiniteNumber = (state, value, descriptor, path) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        addError(state, 'INVALID_NUMBER', path, '必须是有限数值或数值积木');
        return false;
    }
    if (descriptor.integer && !Number.isInteger(value)) {
        addError(state, 'INVALID_INTEGER', path, '必须是整数');
    }
    if (typeof descriptor.min === 'number' && value < descriptor.min) {
        addError(state, 'NUMBER_TOO_SMALL', path, `不能小于 ${descriptor.min}`);
    }
    if (typeof descriptor.max === 'number' && value > descriptor.max) {
        addError(state, 'NUMBER_TOO_LARGE', path, `不能大于 ${descriptor.max}`);
    }
    return true;
};

const validateCoordinates = (state, value, path) => {
    if (typeof value === 'undefined') return;
    if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 100000) {
        addError(state, 'INVALID_COORDINATE', path, '工作区坐标必须是 -100000 到 100000 之间的有限数值');
    }
};

const kindsAreCompatible = (expectedKind, actualKind) => {
    if (expectedKind === 'any') return actualKind === 'reporter' || actualKind === 'boolean';
    if (expectedKind === 'boolean') return actualKind === 'boolean';
    if (expectedKind === 'number' || expectedKind === 'text') return actualKind === 'reporter';
    return false;
};

const branchPropertyFor = branchName => (branchName === 'SUBSTACK2' ? 'elseBody' : 'body');

const normalizeNode = (node, expectedKind, path, depth, state) => {
    if (!isPlainObject(node)) {
        addError(state, 'INVALID_BLOCK', path, '积木必须是对象');
        return null;
    }
    if (state.visiting.has(node)) {
        addError(state, 'CYCLIC_IR', path, '积木结构不能循环引用');
        return null;
    }
    if (state.seen.has(node)) {
        addError(state, 'REUSED_BLOCK', path, '同一个积木对象不能在多个位置重复使用');
        return null;
    }
    if (depth > EST_AI_MAX_DEPTH) {
        addError(state, 'MAX_DEPTH_EXCEEDED', path, `积木嵌套不能超过 ${EST_AI_MAX_DEPTH} 层`);
        return null;
    }
    state.blockCount += 1;
    if (state.blockCount > EST_AI_MAX_BLOCKS) {
        addError(state, 'MAX_BLOCKS_EXCEEDED', path, `积木总数不能超过 ${EST_AI_MAX_BLOCKS}`);
        return null;
    }

    state.visiting.add(node);
    state.seen.add(node);
    addUnknownKeys(state, node, NODE_KEYS, path);

    const spec = typeof node.type === 'string' ? getEstAiNodeSpec(node, state.procedures, state.hardwareId) : null;
    if (!spec) {
        addError(state, 'UNKNOWN_BLOCK', `${path}.type`, `不支持积木 ${String(node.type)}`);
        state.visiting.delete(node);
        return null;
    }
    if (expectedKind === 'hat' && spec.kind !== 'hat') {
        addError(state, 'EXPECTED_HAT', path, `${node.type} 不能作为事件积木`);
    } else if (expectedKind === 'statement' && spec.kind !== 'statement') {
        addError(state, 'EXPECTED_STATEMENT', path, `${node.type} 不能放在程序堆中`);
    } else if (!['hat', 'statement'].includes(expectedKind) && !kindsAreCompatible(expectedKind, spec.kind)) {
        addError(state, 'INCOMPATIBLE_INPUT', path, `${node.type} 不能用于 ${expectedKind} 输入`);
    }

    const fields = isPlainObject(node.fields) ? node.fields : {};
    if (typeof node.fields !== 'undefined' && !isPlainObject(node.fields)) {
        addError(state, 'INVALID_FIELDS', `${path}.fields`, 'fields 必须是对象');
    }
    Object.keys(fields).forEach(name => {
        if (!Object.prototype.hasOwnProperty.call(spec.fields, name)) {
            addError(state, 'UNKNOWN_FIELD', `${path}.fields.${name}`, `${node.type} 没有字段 ${name}`);
        }
    });
    const normalizedFields = {};
    Object.keys(spec.fields).forEach(name => {
        const descriptor = spec.fields[name];
        if (!Object.prototype.hasOwnProperty.call(fields, name)) {
            if (typeof descriptor.default !== 'undefined') {
                normalizedFields[name] = descriptor.default;
                return;
            }
            addError(state, 'MISSING_FIELD', `${path}.fields.${name}`, `缺少字段 ${name}`);
            return;
        }
        if (descriptor.kind === 'bitmap') {
            try {
                normalizedFields[name] = normalizeEstAiBitmap(fields[name]);
            } catch (error) {
                addError(state, 'INVALID_BITMAP', `${path}.fields.${name}`, error.message);
            }
            return;
        }
        if (descriptor.kind === 'matrix') {
            const length = descriptor.length || 35;
            if (typeof fields[name] !== 'string' || fields[name].length !== length || !/^[01]+$/.test(fields[name])) {
                addError(state, 'INVALID_MATRIX', `${path}.fields.${name}`, `矩阵图案必须是 ${length} 位 0/1 字符串`);
            }
            normalizedFields[name] = fields[name];
            return;
        }
        if (!['string', 'number'].includes(typeof fields[name])) {
            addError(state, 'INVALID_FIELD_VALUE', `${path}.fields.${name}`, '字段必须是字符串或数值');
            return;
        }
        const value = String(fields[name]);
        if (descriptor.kind === 'variable') {
            if (typeof fields[name] !== 'string' || !state.variables.some(variable =>
                variable.name === value && variable.type === descriptor.variableType)) {
                addError(state, 'UNKNOWN_VARIABLE', `${path}.fields.${name}`, `未声明的变量/列表：${value}`);
            }
        } else if (descriptor.kind === 'procedure') {
            if (typeof fields[name] !== 'string' || !state.procedures.some(procedure => procedure.name === value)) {
                addError(state, 'UNKNOWN_PROCEDURE', `${path}.fields.${name}`, `未声明的自定义积木：${value}`);
            }
        } else if (descriptor.kind === 'argument') {
            if (typeof fields[name] !== 'string' || !state.procedure || !state.procedure.arguments.some(argument =>
                argument.name === value && argument.type === descriptor.argumentType)) {
                addError(state, 'INVALID_ARGUMENT_SCOPE', `${path}.fields.${name}`, '参数必须属于当前定义且类型匹配');
            }
        } else if (!descriptor.values.includes(value)) {
            addError(
                state,
                'INVALID_FIELD_VALUE',
                `${path}.fields.${name}`,
                `${name} 必须是 ${descriptor.values.join('、')} 之一`
            );
        }
        normalizedFields[name] = value;
    });

    const inputs = isPlainObject(node.inputs) ? node.inputs : {};
    if (typeof node.inputs !== 'undefined' && !isPlainObject(node.inputs)) {
        addError(state, 'INVALID_INPUTS', `${path}.inputs`, 'inputs 必须是对象');
    }
    Object.keys(inputs).forEach(name => {
        if (!Object.prototype.hasOwnProperty.call(spec.inputs, name)) {
            addError(state, 'UNKNOWN_INPUT', `${path}.inputs.${name}`, `${node.type} 没有输入 ${name}`);
        }
    });
    const normalizedInputs = {};
    Object.keys(spec.inputs).forEach(name => {
        const descriptor = spec.inputs[name];
        const inputPath = `${path}.inputs.${name}`;
        if (!Object.prototype.hasOwnProperty.call(inputs, name)) {
            addError(state, 'MISSING_INPUT', inputPath, `缺少输入 ${name}`);
            return;
        }
        const value = inputs[name];
        if (isPlainObject(value)) {
            normalizedInputs[name] = normalizeNode(value, descriptor.kind, inputPath, depth + 1, state);
            return;
        }
        if (descriptor.kind === 'number') {
            validateFiniteNumber(state, value, descriptor, inputPath);
            normalizedInputs[name] = value;
        } else if (descriptor.kind === 'text') {
            if (!['string', 'number'].includes(typeof value) || String(value).length > 1024) {
                addError(state, 'INVALID_TEXT', inputPath, '文本必须是长度不超过 1024 的字符串或数值');
            }
            normalizedInputs[name] = value;
        } else if (descriptor.kind === 'colour') {
            if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) {
                addError(state, 'INVALID_COLOUR', inputPath, '颜色必须是 #RRGGBB 格式');
            }
            normalizedInputs[name] = value;
        } else if (descriptor.kind === 'enum') {
            const enumValue = String(value);
            if (!descriptor.values.includes(enumValue)) {
                addError(
                    state,
                    'INVALID_ENUM_INPUT',
                    inputPath,
                    `${name} 必须是 ${descriptor.values.join('、')} 之一`
                );
            }
            normalizedInputs[name] = enumValue;
        } else if (descriptor.kind === 'any' && ['string', 'number'].includes(typeof value)) {
            if (typeof value === 'number' && !Number.isFinite(value)) {
                addError(state, 'INVALID_LITERAL', inputPath, '字面量必须是有限数值或字符串');
            }
            if (typeof value === 'string' && value.length > 1024) {
                addError(state, 'INVALID_TEXT', inputPath, '文本长度不能超过 1024');
            }
            normalizedInputs[name] = value;
        } else {
            addError(state, 'INVALID_INPUT', inputPath, `${name} 必须连接 ${descriptor.kind} 积木`);
        }
    });

    if (node.type === 'new_matrix_lamp_text') {
        const issue = newMatrixTextIssue(normalizedInputs.matrix_text);
        if (issue) {
            addError(state, 'INVALID_MATRIX_TEXT', `${path}.inputs.matrix_text`, issue === 'length' ?
                'NEW AI 点阵每次滚动显示最多 31 个字符，请拆成多次显示。' :
                'NEW AI 点阵仅支持大写英文、数字和 ?. + - * / =，请把中文标题改成英文，使用 = 代替冒号。');
        }
    }
    const normalized = {type: node.type};
    if (['spark_control_break', 'new_control_break'].includes(node.type) && !state.loopDepth) {
        addError(state, 'BREAK_OUTSIDE_LOOP', path, '退出循环积木必须位于循环内部');
    }
    if (Object.keys(spec.fields).length) normalized.fields = normalizedFields;
    if (Object.keys(spec.inputs).length) normalized.inputs = normalizedInputs;
    Object.keys(spec.branches).forEach(branchName => {
        const property = branchPropertyFor(branchName);
        const branchPath = `${path}.${property}`;
        if (!Array.isArray(node[property])) {
            addError(state, 'MISSING_BRANCH', branchPath, `${property} 必须是积木数组`);
            normalized[property] = [];
            return;
        }
        const loop = ['spark_control_repeat', 'spark_control_forever', 'spark_control_repeat_until',
            'new_control_repeat', 'new_control_forever', 'new_control_repeat_until']
            .includes(node.type);
        if (loop) state.loopDepth++;
        normalized[property] = node[property].map((child, index) => {
            const childPath = `${branchPath}[${index}]`;
            const normalizedChild = normalizeNode(child, 'statement', childPath, depth + 1, state);
            const childSpec = normalizedChild && getEstAiNodeSpec(normalizedChild, state.procedures, state.hardwareId);
            if (childSpec && index < node[property].length - 1 && !childSpec.acceptsNext) {
                addError(
                    state,
                    'TERMINAL_BLOCK_HAS_NEXT',
                    childPath,
                    `${normalizedChild.type} 必须是当前程序堆的最后一个积木`
                );
            }
            return normalizedChild;
        }).filter(Boolean);
        if (loop) state.loopDepth--;
    });
    if (!spec.branches.SUBSTACK && typeof node.body !== 'undefined') {
        addError(state, 'UNEXPECTED_BRANCH', `${path}.body`, `${node.type} 不接受 body`);
    }
    if (!spec.branches.SUBSTACK2 && typeof node.elseBody !== 'undefined') {
        addError(state, 'UNEXPECTED_BRANCH', `${path}.elseBody`, `${node.type} 不接受 elseBody`);
    }

    if (node.type === 'drive_set_pair' && normalizedInputs.LEFT_PORT === normalizedInputs.RIGHT_PORT) {
        addError(state, 'DUPLICATE_DRIVE_PORT', `${path}.inputs`, '左右驱动电机必须使用不同端口');
    }

    state.visiting.delete(node);
    return normalized;
};

const normalizeStatementSequence = (nodes, path, depth, state) => (
    nodes.map((node, index) => {
        const nodePath = `${path}[${index}]`;
        const normalized = normalizeNode(node, 'statement', nodePath, depth, state);
        const spec = normalized && getEstAiNodeSpec(normalized, state.procedures, state.hardwareId);
        if (spec && index < nodes.length - 1 && !spec.acceptsNext) {
            addError(
                state,
                'TERMINAL_BLOCK_HAS_NEXT',
                nodePath,
                `${normalized.type} 必须是当前程序堆的最后一个积木`
            );
        }
        return normalized;
    }).filter(Boolean)
);

const containsBlock = (nodes, predicate) => nodes.some(node => (
    predicate(node) ||
    containsBlock(node.body || [], predicate) ||
    containsBlock(node.elseBody || [], predicate)
));

const collectSafetyWarnings = (nodes, path, warnings) => {
    nodes.forEach((node, index) => {
        const nodePath = `${path}[${index}]`;
        if (['control_forever', 'spark_control_forever', 'new_control_forever'].includes(node.type) &&
            containsBlock(node.body || [], child => CONTINUOUS_MOTION_BLOCKS.has(child.type)) &&
            !containsBlock(node.body || [], child => MOTION_STOP_BLOCKS.has(child.type))) {
            warnings.push({
                code: 'CONTINUOUS_MOTION_IN_FOREVER',
                path: nodePath,
                message: '永久循环中存在持续驱动，但没有停止电机积木；应用前请确认符合预期'
            });
        }
        collectSafetyWarnings(node.body || [], `${nodePath}.body`, warnings);
        collectSafetyWarnings(node.elseBody || [], `${nodePath}.elseBody`, warnings);
    });
};

export const validateEstBlockIr = (ir, {hardwareId = 'est'} = {}) => {
    const state = {
        hardwareId,
        loopDepth: 0,
        blockCount: 0,
        errors: [],
        seen: new WeakSet(),
        visiting: new WeakSet()
    };
    if (!isPlainObject(ir)) {
        return {
            valid: false,
            errors: [{code: 'INVALID_ROOT', path: '$', message: 'IR 根节点必须是对象'}],
            warnings: [],
            normalized: null
        };
    }
    addUnknownKeys(state, ir, ROOT_KEYS, '$');
    if ((hardwareId !== 'est' || typeof ir.hardwareId !== 'undefined') && ir.hardwareId !== hardwareId) {
        addError(state, 'HARDWARE_MISMATCH', '$.hardwareId', '程序硬件与当前硬件不一致');
    }
    state.variables = normalizeDeclarations(state, ir.variables, 'variables');
    state.procedures = normalizeDeclarations(state, ir.procedures, 'procedures');
    if (ir.version !== EST_AI_IR_VERSION) {
        addError(state, 'UNSUPPORTED_VERSION', '$.version', `version 必须是 ${EST_AI_IR_VERSION}`);
    }
    if (!['insert', 'replace'].includes(ir.mode)) {
        addError(state, 'INVALID_MODE', '$.mode', 'mode 必须是 insert 或 replace');
    }
    if (!Array.isArray(ir.stacks) || ir.stacks.length < 1 || ir.stacks.length > EST_AI_MAX_STACKS) {
        addError(state, 'INVALID_STACKS', '$.stacks', `stacks 数量必须是 1 到 ${EST_AI_MAX_STACKS}`);
    }

    const normalizedStacks = Array.isArray(ir.stacks) ? ir.stacks.map((stack, index) => {
        const path = `$.stacks[${index}]`;
        if (!isPlainObject(stack)) {
            addError(state, 'INVALID_STACK', path, '程序堆必须是对象');
            return null;
        }
        addUnknownKeys(state, stack, STACK_KEYS, path);
        validateCoordinates(state, stack.x, `${path}.x`);
        validateCoordinates(state, stack.y, `${path}.y`);
        state.procedure = stack.event && stack.event.type === 'procedures_definition' ?
            state.procedures.find(procedure =>
                procedure.name === (stack.event.fields && stack.event.fields.PROCEDURE)) :
            null;
        const event = normalizeNode(stack.event, 'hat', `${path}.event`, 1, state);
        if (!Array.isArray(stack.body)) {
            addError(state, 'INVALID_BODY', `${path}.body`, 'body 必须是积木数组');
        }
        const body = Array.isArray(stack.body) ?
            normalizeStatementSequence(stack.body, `${path}.body`, 1, state) : [];
        return {
            event,
            body,
            ...(typeof stack.x === 'number' ? {x: stack.x} : {}),
            ...(typeof stack.y === 'number' ? {y: stack.y} : {})
        };
    }).filter(Boolean) : [];

    const normalized = {
        version: EST_AI_IR_VERSION,
        ...(hardwareId === 'est' && typeof ir.hardwareId === 'undefined' ? {} : {hardwareId}),
        mode: ir.mode,
        stacks: normalizedStacks,
        ...(typeof ir.variables === 'undefined' ? {} : {variables: state.variables}),
        ...(typeof ir.procedures === 'undefined' ? {} : {procedures: state.procedures})
    };
    state.procedures.forEach(procedure => {
        const definitions = normalizedStacks.filter(stack => stack.event &&
            stack.event.type === 'procedures_definition' && stack.event.fields.PROCEDURE === procedure.name);
        if (definitions.length !== 1) {
            addError(state, 'INVALID_PROCEDURE_DEFINITION', '$.stacks',
                `自定义积木 ${procedure.name} 必须恰好有一个 procedures_definition 程序堆`);
        }
    });
    const warnings = [];
    normalizedStacks.forEach((stack, index) => {
        collectSafetyWarnings(stack.body, `$.stacks[${index}].body`, warnings);
    });
    return {
        valid: state.errors.length === 0,
        errors: state.errors,
        warnings,
        normalized,
        blockCount: state.blockCount
    };
};

export class EstBlockIrValidationError extends Error {
    constructor (result) {
        const firstError = result.errors[0];
        super(firstError ? `${firstError.path}: ${firstError.message}` : 'EST Block IR 校验失败');
        this.name = 'EstBlockIrValidationError';
        this.code = firstError ? firstError.code : 'INVALID_IR';
        this.errors = result.errors;
        this.warnings = result.warnings;
    }
}

export const assertValidEstBlockIr = (ir, options) => {
    const result = validateEstBlockIr(ir, options);
    if (!result.valid) throw new EstBlockIrValidationError(result);
    return result;
};

export {EST_AI_BLOCK_SPEC};
