const {makeProgram} = require('./new-fixture');
const variable = name => ({type: 'data_variable', fields: {VARIABLE: name}});
const argument = name => ({type: 'argument_reporter_number', fields: {VALUE: name}});
const operator = (name, inputs) => ({type: `new_operator_${name}`, inputs});
const set = (name, value) => ({type: 'data_setvariableto', fields: {VARIABLE: name}, inputs: {VALUE: value}});
const change = (name, value) => ({type: 'data_changevariableby', fields: {VARIABLE: name}, inputs: {VALUE: value}});
const list = (name, type, inputs = {}) => ({type: `data_${type}`, fields: {LIST: name}, inputs});
const show = (title, value) => ({type: 'procedures_call',
    fields: {PROCEDURE: 'display_info'},
    inputs: {title, value}});
const numericVariables = names => names.map(name => ({name, type: ''}));

const makeNewStatisticsProgram = () => ({...makeProgram([]),
    variables: [...numericVariables(['seq', 'current', 'total_score', 'maximum', 'average',
        'qualified', 'special', 'countdown']), {name: 'raw', type: 'list'}, {name: 'results', type: 'list'}],
    procedures: [{name: 'display_info',
        arguments: [{name: 'title', type: 'text'}, {name: 'value', type: 'number'}],
        warp: false},
    {name: 'process_data',
        arguments: [{name: 'raw_value', type: 'number'}, {name: 'position', type: 'number'}],
        warp: false}],
    stacks: [makeProgram([
        list('raw', 'deletealloflist'), list('results', 'deletealloflist'),
        ...['current', 'total_score', 'maximum', 'average', 'qualified', 'special', 'countdown']
            .map(name => set(name, 0)), set('seq', 1),
        ...[3, 8, 5, 12, 7, 4].map(value => list('raw', 'addtolist', {ITEM: value})),
        {type: 'new_control_repeat',
            inputs: {TIMES: list('raw', 'lengthoflist')},
            body: [
                {type: 'procedures_call',
                    fields: {PROCEDURE: 'process_data'},
                    inputs: {
                        raw_value: list('raw', 'itemoflist', {INDEX: variable('seq')}), position: variable('seq')
                    }}, change('seq', 1)
            ]},
        set('average', operator('divide', {NUM1: variable('total_score'), NUM2: list('raw', 'lengthoflist')})),
        set('countdown', 3),
        {type: 'new_control_repeat_until',
            inputs: {CONDITION: operator('equals', {
                OPERAND1: variable('countdown'), OPERAND2: 0
            })},
            body: [show('COUNT', variable('countdown')), change('countdown', -1)]},
        {type: 'new_control_forever',
            body: [show('SUM', variable('total_score')),
                show('AVG', variable('average')), show('MAX', variable('maximum')),
                show('QUALIFIED', variable('qualified')), show('SPECIAL', variable('special'))]}
    ]).stacks[0],
    {event: {type: 'procedures_definition', fields: {PROCEDURE: 'display_info'}},
        body: [
            {type: 'new_matrix_lamp_text',
                inputs: {matrix_text: operator('join', {
                    STRING1: operator('join', {STRING1: {type: 'argument_reporter_string', fields: {VALUE: 'title'}},
                        STRING2: '='}),
                    STRING2: argument('value')
                })}}, {type: 'new_control_wait', inputs: {DURATION: 0.5}}
        ]},
    {event: {type: 'procedures_definition', fields: {PROCEDURE: 'process_data'}},
        body: [
            set('current', operator('add', {
                NUM1: operator('multiply', {NUM1: argument('raw_value'), NUM2: 2}), NUM2: argument('position')
            })), list('results', 'addtolist', {ITEM: variable('current')}), change('total_score', variable('current')),
            {type: 'new_control_if',
                inputs: {CONDITION: operator('gt', {
                    OPERAND1: variable('current'), OPERAND2: variable('maximum')
                })},
                body: [set('maximum', variable('current'))]},
            {type: 'new_control_if_else',
                inputs: {CONDITION: operator('and', {
                    OPERAND1: operator('gt', {OPERAND1: variable('current'), OPERAND2: 10}),
                    OPERAND2: operator('lt', {OPERAND1: variable('current'), OPERAND2: 25})
                })},
                body: [change('qualified', 1), show('PASS', variable('current'))],
                elseBody: [show('OUT', variable('current'))]},
            {type: 'new_control_if',
                inputs: {CONDITION: operator('or', {
                    OPERAND1: operator('equals', {
                        OPERAND1: operator('mod', {NUM1: variable('current'), NUM2: 3}), OPERAND2: 0
                    }),
                    OPERAND2: operator('equals', {OPERAND1: variable('current'), OPERAND2: 28})
                })},
                body: [change('special', 1)]}
        ]}]
});

const makeNewListBoundariesProgram = () => ({...makeProgram([]),
    variables: [{name: 'items', type: 'list'}, {name: 'observations', type: 'list'},
        ...numericVariables(['seen'])],
    stacks: [makeProgram([
        ...[10, 20, 30].map(value => list('items', 'addtolist', {ITEM: value})),
        ...[1, 3, 0, 4].map(index => list('observations', 'addtolist', {
            ITEM: list('items', 'itemoflist', {INDEX: index})
        })),
        list('items', 'insertatlist', {INDEX: 1, ITEM: 5}),
        list('items', 'insertatlist', {INDEX: operator('add', {
            NUM1: list('items', 'lengthoflist'), NUM2: 1
        }),
        ITEM: 40}),
        list('items', 'replaceitemoflist', {INDEX: 2, ITEM: 15}),
        list('observations', 'addtolist', {ITEM: list('items', 'itemoflist', {INDEX: 2})}),
        list('items', 'deleteoflist', {INDEX: 3}),
        list('observations', 'addtolist', {ITEM: list('items', 'itemoflist', {INDEX: 3})}),
        ...[0, 100].flatMap(index => [list('items', 'deleteoflist', {INDEX: index}),
            list('items', 'replaceitemoflist', {INDEX: index, ITEM: 999}),
            list('items', 'insertatlist', {INDEX: index, ITEM: 999})]),
        ...[5, 30, 999].map(value => list('observations', 'addtolist', {
            ITEM: list('items', 'itemnumoflist', {ITEM: value})
        })), list('observations', 'addtolist', {ITEM: list('items', 'lengthoflist')}),
        ...[30, 999].flatMap(value => [{type: 'new_control_if_else',
            inputs: {CONDITION: list('items', 'listcontainsitem', {ITEM: value})},
            body: [set('seen', 1)],
            elseBody: [set('seen', 0)]},
        list('observations', 'addtolist', {ITEM: variable('seen')})]),
        list('items', 'deletealloflist')
    ]).stacks[0]]
});

module.exports = {makeNewStatisticsProgram, makeNewListBoundariesProgram};
