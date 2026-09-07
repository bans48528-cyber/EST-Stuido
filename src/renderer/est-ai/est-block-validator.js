import {
    EST_AI_BLOCK_SPEC,
    EST_AI_IR_VERSION,
    EST_AI_MAX_BLOCKS,
    EST_AI_MAX_DEPTH,
    EST_AI_MAX_STACKS,
    getEstAiBlockSpec
} from './est-block-spec';

const ROOT_KEYS = new Set(['version', 'mode', 'stacks']);
const STACK_KEYS = new Set(['event', 'body', 'x', 'y']);
const NODE_KEYS = new Set(['type', 'fields', 'inputs', 'body', 'elseBody']);
const CONTINUOUS_MOTION_BLOCKS = new Set([
    'motor_start',
    'motor_start_speed',
    'motor_start_power',
    'drive_start_steer',
    'drive_start_steer_speed',
    'drive_start_dual_speed'
]);
const MOTION_STOP_BLOCKS = new Set(['motor_stop', 'drive_stop']);

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

    const spec = typeof node.type === 'string' ? getEstAiBlockSpec(node.type) : null;
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
        if (!spec.fields[name]) {
            addError(state, 'UNKNOWN_FIELD', `${path}.fields.${name}`, `${node.type} 没有字段 ${name}`);
        }
    });
    const normalizedFields = {};
    Object.keys(spec.fields).forEach(name => {
        const descriptor = spec.fields[name];
        if (!Object.prototype.hasOwnProperty.call(fields, name)) {
            addError(state, 'MISSING_FIELD', `${path}.fields.${name}`, `缺少字段 ${name}`);
            return;
        }
        const value = String(fields[name]);
        if (!descriptor.values.includes(value)) {
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
        if (!spec.inputs[name]) {
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
            normalizedInputs[name] = value;
        } else {
            addError(state, 'INVALID_INPUT', inputPath, `${name} 必须连接 ${descriptor.kind} 积木`);
        }
    });

    const normalized = {type: node.type};
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
        normalized[property] = node[property].map((child, index) => {
            const childPath = `${branchPath}[${index}]`;
            const normalizedChild = normalizeNode(child, 'statement', childPath, depth + 1, state);
            const childSpec = normalizedChild && getEstAiBlockSpec(normalizedChild.type);
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
        const spec = normalized && getEstAiBlockSpec(normalized.type);
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
        if (node.type === 'control_forever' &&
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

export const validateEstBlockIr = ir => {
    const state = {
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
        mode: ir.mode,
        stacks: normalizedStacks
    };
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

export const assertValidEstBlockIr = ir => {
    const result = validateEstBlockIr(ir);
    if (!result.valid) throw new EstBlockIrValidationError(result);
    return result;
};

export {EST_AI_BLOCK_SPEC};
