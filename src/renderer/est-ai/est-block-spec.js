import {
    ALL_EST_BLOCK_IDS,
    EST_DRIVE_PORT_PICKER_ID,
    EST_MOTOR_PORT_PICKER_ID,
    EST_SENSOR_PORT_PICKER_ID,
    EST_STEERING_PICKER_ID,
    makeEstBlockDefinitions
} from '../est-blocks/definitions';
import {EST_PIANO_MIN_MIDI_NOTE, EST_PIANO_MAX_MIDI_NOTE} from '../est-blocks/piano-resources';
import {EST_AI_NATIVE_SPECS, getEstAiProcedureInputs} from './est-native-spec';
import {SPARK_AI_BLOCK_SPEC} from '../spark-ai/ai-spec';
import {NEW_AI_BLOCK_SPEC} from '../new-ai/ai-spec';

export const EST_AI_IR_VERSION = 1;
export const EST_AI_MAX_STACKS = 8;
export const EST_AI_MAX_BLOCKS = 256;
export const EST_AI_MAX_DEPTH = 24;

const BLOCK_SHAPES = {
    OUTPUT_SHAPE_ROUND: 1,
    OUTPUT_SHAPE_HEXAGONAL: 2
};

const numberRangeFor = inputName => {
    const ranges = {
        LEFT_BASE_POWER: {min: -100, max: 100},
        LEFT_SPEED: {min: -100, max: 100},
        LINE: {min: 1, max: 8, integer: true},
        NOTE: {min: EST_PIANO_MIN_MIDI_NOTE, max: EST_PIANO_MAX_MIDI_NOTE, integer: true},
        POWER: {min: -100, max: 100},
        RIGHT_BASE_POWER: {min: -100, max: 100},
        RIGHT_SPEED: {min: -100, max: 100},
        SECONDS: {min: 0},
        SPEED: {min: -100, max: 100},
        STEERING: {min: -100, max: 100},
        TIMES: {min: 0, max: 10000, integer: true},
        VOLUME: {min: 0, max: 100}
    };
    return ranges[inputName] || {};
};

const inputDescriptorFor = (blockType, argument) => {
    if (argument.type === 'input_statement') {
        return {kind: 'statement'};
    }
    if (argument.name === 'CONDITION') {
        return {kind: 'boolean'};
    }
    if (argument.name === 'TEXT') {
        return {kind: 'text', shadow: {type: 'text', field: 'TEXT'}};
    }
    if (argument.name === 'PORT' || argument.name === 'LEFT_PORT' || argument.name === 'RIGHT_PORT') {
        if (blockType.startsWith('sensor_')) {
            return {
                kind: 'enum',
                values: ['1', '2', '3', '4'],
                shadow: {type: EST_SENSOR_PORT_PICKER_ID, field: 'PORT'}
            };
        }
        const isDrivePort = blockType === 'drive_set_pair';
        return {
            kind: 'enum',
            values: ['A', 'B', 'C', 'D'],
            shadow: {
                type: isDrivePort ? EST_DRIVE_PORT_PICKER_ID : EST_MOTOR_PORT_PICKER_ID,
                field: 'PORT'
            }
        };
    }
    if (argument.name === 'STEERING') {
        return {
            kind: 'number',
            ...numberRangeFor(argument.name),
            shadow: {type: EST_STEERING_PICKER_ID, field: 'NUM'}
        };
    }
    if (argument.name === 'NOTE') {
        return {
            kind: 'number',
            ...numberRangeFor(argument.name),
            shadow: {type: 'note', field: 'NOTE'}
        };
    }
    return {
        kind: 'number',
        ...numberRangeFor(argument.name),
        shadow: {type: 'math_number', field: 'NUM'}
    };
};

const blockKindFor = definition => {
    if ((definition.extensions || []).includes('shape_hat')) return 'hat';
    if (definition.output === 'Boolean') return 'boolean';
    if (Object.prototype.hasOwnProperty.call(definition, 'output')) return 'reporter';
    return 'statement';
};

const argumentListsFor = definition => Object.keys(definition)
    .filter(key => /^args\d+$/.test(key))
    .sort()
    .map(key => definition[key] || []);

const normalizeCategory = category => ({events: 'event', sounds: 'sound'}[category] || category);

const specFromDefinition = definition => {
    const fields = {};
    const inputs = {};
    const branches = {};
    argumentListsFor(definition).forEach(argumentsList => {
        argumentsList.forEach(argument => {
            if (argument.type === 'field_dropdown') {
                fields[argument.name] = {
                    kind: 'enum',
                    values: argument.options.map(option => String(option[1]))
                };
            } else if (definition.type === 'display_draw' && argument.name === 'BITMAP') {
                fields.BITMAP = {kind: 'bitmap',
                    default: 'v1:',
                    format: '{rows:["010","111"],x:0,y:0,scale:1}; 0=white,1=black; canvas=180x128'};
            } else if (argument.type === 'input_statement') {
                branches[argument.name] = inputDescriptorFor(definition.type, argument);
            } else if (argument.type === 'input_value') {
                inputs[argument.name] = inputDescriptorFor(definition.type, argument);
            }
        });
    });
    return {
        type: definition.type,
        category: normalizeCategory(definition.category),
        kind: blockKindFor(definition),
        acceptsNext: Object.prototype.hasOwnProperty.call(definition, 'nextStatement'),
        fields,
        inputs,
        branches
    };
};

const nativeOperatorSpecs = {
    operator_add: {
        type: 'operator_add',
        category: 'operators',
        kind: 'reporter',
        acceptsNext: false,
        fields: {},
        inputs: {
            NUM1: {kind: 'number', shadow: {type: 'math_number', field: 'NUM'}},
            NUM2: {kind: 'number', shadow: {type: 'math_number', field: 'NUM'}}
        },
        branches: {}
    },
    operator_subtract: {
        type: 'operator_subtract',
        category: 'operators',
        kind: 'reporter',
        acceptsNext: false,
        fields: {},
        inputs: {
            NUM1: {kind: 'number', shadow: {type: 'math_number', field: 'NUM'}},
            NUM2: {kind: 'number', shadow: {type: 'math_number', field: 'NUM'}}
        },
        branches: {}
    },
    operator_multiply: {
        type: 'operator_multiply',
        category: 'operators',
        kind: 'reporter',
        acceptsNext: false,
        fields: {},
        inputs: {
            NUM1: {kind: 'number', shadow: {type: 'math_number', field: 'NUM'}},
            NUM2: {kind: 'number', shadow: {type: 'math_number', field: 'NUM'}}
        },
        branches: {}
    },
    operator_divide: {
        type: 'operator_divide',
        category: 'operators',
        kind: 'reporter',
        acceptsNext: false,
        fields: {},
        inputs: {
            NUM1: {kind: 'number', shadow: {type: 'math_number', field: 'NUM'}},
            NUM2: {kind: 'number', shadow: {type: 'math_number', field: 'NUM'}}
        },
        branches: {}
    },
    operator_mod: {
        type: 'operator_mod',
        category: 'operators',
        kind: 'reporter',
        acceptsNext: false,
        fields: {},
        inputs: {
            NUM1: {kind: 'number', shadow: {type: 'math_number', field: 'NUM'}},
            NUM2: {kind: 'number', shadow: {type: 'math_number', field: 'NUM'}}
        },
        branches: {}
    },
    operator_gt: {
        type: 'operator_gt',
        category: 'operators',
        kind: 'boolean',
        acceptsNext: false,
        fields: {},
        inputs: {OPERAND1: {kind: 'any'}, OPERAND2: {kind: 'any'}},
        branches: {}
    },
    operator_lt: {
        type: 'operator_lt',
        category: 'operators',
        kind: 'boolean',
        acceptsNext: false,
        fields: {},
        inputs: {OPERAND1: {kind: 'any'}, OPERAND2: {kind: 'any'}},
        branches: {}
    },
    operator_equals: {
        type: 'operator_equals',
        category: 'operators',
        kind: 'boolean',
        acceptsNext: false,
        fields: {},
        inputs: {OPERAND1: {kind: 'any'}, OPERAND2: {kind: 'any'}},
        branches: {}
    },
    operator_and: {
        type: 'operator_and',
        category: 'operators',
        kind: 'boolean',
        acceptsNext: false,
        fields: {},
        inputs: {OPERAND1: {kind: 'boolean'}, OPERAND2: {kind: 'boolean'}},
        branches: {}
    },
    operator_or: {
        type: 'operator_or',
        category: 'operators',
        kind: 'boolean',
        acceptsNext: false,
        fields: {},
        inputs: {OPERAND1: {kind: 'boolean'}, OPERAND2: {kind: 'boolean'}},
        branches: {}
    },
    operator_not: {
        type: 'operator_not',
        category: 'operators',
        kind: 'boolean',
        acceptsNext: false,
        fields: {},
        inputs: {OPERAND: {kind: 'boolean'}},
        branches: {}
    }
};

const estDefinitions = makeEstBlockDefinitions(BLOCK_SHAPES)
    .filter(definition => ALL_EST_BLOCK_IDS.includes(definition.type));

export const EST_AI_BLOCK_SPEC = Object.freeze(estDefinitions.reduce((spec, definition) => {
    spec[definition.type] = Object.freeze(specFromDefinition(definition));
    return spec;
}, {...nativeOperatorSpecs, ...EST_AI_NATIVE_SPECS}));

export const EST_AI_ALLOWED_BLOCK_IDS = Object.freeze(Object.keys(EST_AI_BLOCK_SPEC));

const categoryOrder = ['event', 'movement', 'motor', 'display', 'sound', 'control', 'sensing', 'vision',
    'operators', 'variables', 'procedures'];

export const EST_AI_RULE_CATEGORIES = Object.freeze(categoryOrder.reduce((categories, category) => {
    categories[category] = Object.freeze(EST_AI_ALLOWED_BLOCK_IDS.filter(
        blockType => EST_AI_BLOCK_SPEC[blockType].category === category
    ));
    return categories;
}, {}));

export const EST_AI_RULE_CATEGORY_IDS = Object.freeze(Object.keys(EST_AI_RULE_CATEGORIES));

export const getEstAiBlockCatalog = (hardwareId = 'est') => {
    if (hardwareId === 'est') return EST_AI_BLOCK_SPEC;
    if (hardwareId === 'spark-ai') return SPARK_AI_BLOCK_SPEC;
    if (hardwareId === 'new-ai') return NEW_AI_BLOCK_SPEC;
    throw new Error('HARDWARE_NOT_READY');
};

export const getEstAiBlockSpecsForCategories = (categories, hardwareId = 'est') => {
    const requested = new Set(categories);
    return Object.values(getEstAiBlockCatalog(hardwareId)).filter(spec => requested.has(spec.category));
};

export const getEstAiBlockSpec = (type, hardwareId = 'est') => {
    const catalog = getEstAiBlockCatalog(hardwareId);
    return Object.prototype.hasOwnProperty.call(catalog, type) ? catalog[type] : null;
};

export const getEstAiNodeSpec = (node, procedures = [], hardwareId = 'est') => {
    const base = getEstAiBlockSpec(node.type, hardwareId);
    if (!base) return null;
    if (node.type === 'new_control_stop') {
        return {...base, acceptsNext: Boolean(node.fields && node.fields.STOP_OPTION === 'other')};
    }
    if (node.type !== 'procedures_call') return base;
    const procedure = procedures.find(item => item.name === (node.fields && node.fields.PROCEDURE));
    return procedure ? {...base, inputs: getEstAiProcedureInputs(procedure)} : base;
};
