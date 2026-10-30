const makePikaOperatorsCase = hardwareId => {
    const prefix = hardwareId === 'spark-ai' ? 'spark_' : 'new_';
    const op = (name, inputs, fields) => ({type: `${prefix}operator_${name}`,
        inputs,
        ...(fields ? {fields} : {})});
    const math = (name, number) => op('mathop', {NUM: number}, {OPERATOR: name});
    const cases = [
        [op('subtract', {NUM1: 10, NUM2: op('subtract', {NUM1: 3, NUM2: 1})}), 8],
        [op('subtract', {NUM1: op('subtract', {NUM1: 10, NUM2: 3}), NUM2: 1}), 6],
        [op('divide', {NUM1: 10, NUM2: op('divide', {NUM1: 2, NUM2: 5})}), 25],
        [op('multiply', {NUM1: 10, NUM2: op('divide', {NUM1: 2, NUM2: 5})}), 4],
        [op('multiply', {NUM1: op('add', {NUM1: 1, NUM2: 2}), NUM2: 3}), 9],
        [op('add', {NUM1: 1, NUM2: op('multiply', {NUM1: 2, NUM2: 3})}), 7],
        [math('_abs_', -8), 8], [math('down_abs', -2.1), -3], [math('up_abs', -2.1), -2],
        [math('sqrt_abs', 9), 3], [math('sin_abs', 90), 1], [math('cos_abs', 180), -1],
        [math('tan_abs', 45), 1], [math('asin_abs', 0.5), 30], [math('acos_abs', 0.5), 60],
        [math('atan_abs', 1), 45], [math('ln_abs', 100), 2], [math('e_abs', 1), Math.E],
        [math('10_abs', 2), 100],
        [op('add', {NUM1: 1, NUM2: math('acos_abs', 0.5)}), 61],
        [op('round', {NUM: 2.5}), 3], [op('round', {NUM: -2.5}), -2],
        [op('round', {NUM: -0.5}), 0], [op('round', {NUM: 2.49}), 2],
        [op('mod', {NUM1: -5, NUM2: 3}), 1], [op('mod', {NUM1: 5, NUM2: -3}), -1],
        [op('mod', {NUM1: -5, NUM2: -3}), -2], [op('mod', {NUM1: 5.5, NUM2: 2}), 1.5],
        [op('join', {STRING1: 42, STRING2: 'EST'}), '42EST'],
        [op('join', {STRING1: '', STRING2: 'X'}), 'X'],
        [op('letter_of', {LETTER: 2, STRING: 'XYZ'}), 'Y'],
        [op('length', {STRING: 'ABC'}), 3]
    ];
    const booleanCases = [
        [op('contains', {STRING1: 'HELLO', STRING2: 'ELL'}), 1],
        [op('contains', {STRING1: 'HELLO', STRING2: 'XYZ'}), 0],
        [op('and', {OPERAND1: op('gt', {OPERAND1: 10, OPERAND2: 9}),
            OPERAND2: op('not', {OPERAND: op('equals', {OPERAND1: 0, OPERAND2: 1})})}), 1]
    ];
    const append = value => ({type: 'data_addtolist', fields: {LIST: 'observations'}, inputs: {ITEM: value}});
    const set = value => ({type: 'data_setvariableto', fields: {VARIABLE: 'flag'}, inputs: {VALUE: value}});
    return {expected: cases.map(item => item[1]).concat(booleanCases.map(item => item[1])),
        ir: {version: 1,
            mode: 'replace',
            hardwareId,
            variables: [{name: 'observations', type: 'list'}, {name: 'flag', type: ''}],
            stacks: [{event: {type: `${prefix}event_whenflagclicked`},
                body: [
                    {type: 'data_deletealloflist', fields: {LIST: 'observations'}},
                    ...cases.map(item => append(item[0])),
                    ...booleanCases.flatMap(item => [{type: `${prefix}control_if_else`,
                        inputs: {CONDITION: item[0]},
                        body: [set(1)],
                        elseBody: [set(0)]},
                    append({type: 'data_variable', fields: {VARIABLE: 'flag'}})])
                ]}]}};
};

const toSparkProgram = program => {
    const clone = JSON.parse(JSON.stringify(program));
    clone.hardwareId = 'spark-ai';
    const visit = node => {
        if (!node || typeof node !== 'object') return;
        if (typeof node.type === 'string' && node.type.startsWith('new_')) {
            node.type = node.type.replace(/^new_/, 'spark_');
        }
        Object.values(node.inputs || {}).forEach(visit);
        (node.body || []).forEach(visit);
        (node.elseBody || []).forEach(visit);
    };
    clone.stacks.forEach(stack => {
        visit(stack.event); stack.body.forEach(visit);
    });
    return clone;
};
module.exports = {makePikaOperatorsCase, toSparkProgram};
