// Shared by the IR, chat and real Electron tests. No API or hardware is used.
const makeCoverageIr = () => ({
    version: 1,
    mode: 'insert',
    variables: [{name: '计数', type: ''}, {name: '记录', type: 'list'}],
    procedures: [{name: '显示记录',
        arguments: [
            {name: '序号', type: 'number'}, {name: '前缀', type: 'text'}, {name: '可见', type: 'boolean'}
        ],
        warp: false}],
    stacks: [{event: {type: 'event_program_start'},
        body: [
            {type: 'data_setvariableto',
                fields: {VARIABLE: '计数'},
                inputs: {
                    VALUE: {type: 'operator_random', inputs: {FROM: 1, TO: 10}}
                }},
            {type: 'data_changevariableby', fields: {VARIABLE: '计数'}, inputs: {VALUE: 1}},
            {type: 'data_addtolist',
                fields: {LIST: '记录'},
                inputs: {
                    ITEM: {type: 'data_variable', fields: {VARIABLE: '计数'}}
                }},
            {type: 'procedures_call',
                fields: {PROCEDURE: '显示记录'},
                inputs: {
                    序号: 1, 前缀: '结果：', 可见: {type: 'operator_contains', inputs: {STRING1: 'EST', STRING2: 'E'}}
                }},
            {type: 'display_draw',
                fields: {BITMAP: {
                    rows: ['01100110', '11111111', '11111111', '01111110', '00111100', '00011000'],
                    x: 58,
                    y: 40,
                    scale: 8
                }}}
        ]}, {event: {type: 'procedures_definition', fields: {PROCEDURE: '显示记录'}},
        body: [
            {type: 'control_if',
                inputs: {CONDITION: {type: 'argument_reporter_boolean', fields: {VALUE: '可见'}}},
                body: [
                    {type: 'display_text_line',
                        inputs: {LINE: 1,
                            TEXT: {
                                type: 'operator_join',
                                inputs: {
                                    STRING1: {type: 'argument_reporter_string', fields: {VALUE: '前缀'}},
                                    STRING2: {type: 'data_itemoflist',
                                        fields: {LIST: '记录'},
                                        inputs: {
                                            INDEX: {type: 'argument_reporter_number', fields: {VALUE: '序号'}}
                                        }}
                                }
                            }}}
                ]}
        ]}]
});

module.exports = {makeCoverageIr};
