// Native OpenBlock opcodes: keep input names aligned with its existing editors/generators.
const number = {kind: 'number', shadow: {type: 'math_number', field: 'NUM'}};
const text = {kind: 'text', shadow: {type: 'text', field: 'TEXT'}};
const any = {kind: 'any'};
const boolean = {kind: 'boolean'};
const spec = (type, category, kind, inputs = {}, fields = {}) => ({
    type, category, kind, acceptsNext: kind === 'statement', fields, inputs, branches: {}
});
const operator = (type, inputs, fields = {}, kind = 'reporter') =>
    spec(type, 'operators', kind, inputs, fields);
const variable = {VARIABLE: {kind: 'variable', variableType: ''}};
const list = {LIST: {kind: 'variable', variableType: 'list'}};
const data = (type, inputs, fields, kind = 'statement') => spec(type, 'variables', kind, inputs, fields);

export const EST_AI_NATIVE_SPECS = {
    operator_random: operator('operator_random', {FROM: number, TO: number}),
    operator_join: operator('operator_join', {STRING1: text, STRING2: text}),
    operator_letter_of: operator('operator_letter_of', {LETTER: number, STRING: text}),
    operator_length: operator('operator_length', {STRING: text}),
    operator_contains: operator('operator_contains', {STRING1: text, STRING2: text}, {}, 'boolean'),
    operator_round: operator('operator_round', {NUM: number}),
    operator_mathop: operator('operator_mathop', {NUM: number}, {OPERATOR: {kind: 'enum',
        values: ['abs', 'floor', 'ceiling', 'sqrt', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
            'ln', 'log', 'e ^', '10 ^']}}),
    data_variable: data('data_variable', {}, variable, 'reporter'),
    data_setvariableto: data('data_setvariableto', {VALUE: any}, variable),
    data_changevariableby: data('data_changevariableby', {VALUE: number}, variable),
    data_listcontents: data('data_listcontents', {}, list, 'reporter'),
    data_addtolist: data('data_addtolist', {ITEM: any}, list),
    data_deleteoflist: data('data_deleteoflist', {INDEX: number}, list),
    data_deletealloflist: data('data_deletealloflist', {}, list),
    data_insertatlist: data('data_insertatlist', {INDEX: number, ITEM: any}, list),
    data_replaceitemoflist: data('data_replaceitemoflist', {INDEX: number, ITEM: any}, list),
    data_itemoflist: data('data_itemoflist', {INDEX: number}, list, 'reporter'),
    data_itemnumoflist: data('data_itemnumoflist', {ITEM: any}, list, 'reporter'),
    data_lengthoflist: data('data_lengthoflist', {}, list, 'reporter'),
    data_listcontainsitem: data('data_listcontainsitem', {ITEM: any}, list, 'boolean'),
    procedures_definition: spec('procedures_definition', 'procedures', 'hat', {},
        {PROCEDURE: {kind: 'procedure'}}),
    procedures_call: {...spec('procedures_call', 'procedures', 'statement', {},
        {PROCEDURE: {kind: 'procedure'}}),
    dynamicInputs: 'Declared procedure argument names'},
    argument_reporter_number: spec('argument_reporter_number', 'procedures', 'reporter', {},
        {VALUE: {kind: 'argument', argumentType: 'number'}}),
    argument_reporter_string: spec('argument_reporter_string', 'procedures', 'reporter', {},
        {VALUE: {kind: 'argument', argumentType: 'text'}}),
    argument_reporter_boolean: spec('argument_reporter_boolean', 'procedures', 'boolean', {},
        {VALUE: {kind: 'argument', argumentType: 'boolean'}})
};

export const getEstAiProcedureInputs = procedure => Object.fromEntries(
    procedure.arguments.map(argument => [argument.name, {number, text, boolean}[argument.type]])
);

export const getEstAiProcedureCode = procedure => [procedure.name,
    ...procedure.arguments.map(argument => ({number: '%n', text: '%s', boolean: '%b'}[argument.type]))
].join(' ');
