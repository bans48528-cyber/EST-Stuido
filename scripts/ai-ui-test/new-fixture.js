const {NEW_AI_BLOCK_SPEC} = require('../../src/renderer/new-ai/ai-spec');
const catalog = require('../../src/renderer/new-ai/catalog.json');
const makeProgram = body => ({version: 1,
    hardwareId: 'new-ai',
    mode: 'replace',
    stacks: [{event: {type: 'new_event_whenflagclicked'}, body}]});
const makeNode = type => {
    const spec = NEW_AI_BLOCK_SPEC[type];
    const node = {type};
    if (Object.keys(spec.fields).length) {
        node.fields = Object.fromEntries(Object.entries(spec.fields).map(([name, field]) =>
            [name, field.kind === 'matrix' ? '1'.repeat(63) : field.values[0]]));
    }
    if (Object.keys(spec.inputs).length) {
        node.inputs = Object.fromEntries(Object.entries(spec.inputs).map(([name, input]) => [name,
            input.kind === 'boolean' ? {type: 'new_operator_equals', inputs: {OPERAND1: 1, OPERAND2: 1}} :
                input.values ? input.values[0] : input.kind === 'colour' ? '#00aaff' :
                    input.kind === 'text' ? 'HELLO' : Math.max(1, input.min || 0)]));
    }
    if (spec.branches.SUBSTACK) node.body = [];
    if (spec.branches.SUBSTACK2) node.elseBody = [];
    return node;
};
const makeNewCoverageCases = () => catalog.blocks.map(row => {
    const type = `new_${row.id}`;
    const node = makeNode(type);
    const spec = NEW_AI_BLOCK_SPEC[type];
    let ir;
    if (spec.kind === 'hat') ir = {...makeProgram([]), stacks: [{event: node, body: []}]};
    else if (spec.kind === 'boolean') {
        ir = makeProgram([
            {type: 'new_control_if', inputs: {CONDITION: node}, body: []}
        ]);
    } else if (spec.kind === 'reporter') {
        ir = {...makeProgram([{type: 'data_setvariableto', fields: {VARIABLE: 'value'}, inputs: {VALUE: node}}]),
            variables: [{name: 'value', type: ''}]};
    } else if (type === 'new_control_break') {
        ir = makeProgram([{type: 'new_control_repeat', inputs: {TIMES: 1}, body: [node]}]);
    } else ir = makeProgram([node]);
    return {type, ir};
});
const makeNewNativeProgram = () => ({...makeProgram([]),
    variables: [{name: 'count', type: ''}, {name: 'items', type: 'list'}],
    procedures: [{name: 'record', arguments: [{name: 'value', type: 'number'}], warp: false}],
    stacks: [makeProgram([
        {type: 'data_setvariableto', fields: {VARIABLE: 'count'}, inputs: {VALUE: 0}},
        {type: 'new_control_repeat',
            inputs: {TIMES: 2},
            body: [
                {type: 'data_changevariableby', fields: {VARIABLE: 'count'}, inputs: {VALUE: 1}},
                {type: 'procedures_call',
                    fields: {PROCEDURE: 'record'},
                    inputs: {value: {type: 'data_variable', fields: {VARIABLE: 'count'}}}}
            ]}
    ]).stacks[0], {event: {type: 'procedures_definition', fields: {PROCEDURE: 'record'}},
        body: [
            {type: 'data_addtolist',
                fields: {LIST: 'items'},
                inputs: {ITEM: {type: 'argument_reporter_number', fields: {VALUE: 'value'}}}},
            {type: 'new_matrix_lamp_text',
                inputs: {matrix_text: {type: 'argument_reporter_number', fields: {VALUE: 'value'}}}}
        ]}]});
module.exports = {makeProgram, makeNewCoverageCases, makeNewNativeProgram};
