import catalog from './catalog.json';
import {sparkText} from './messages';
import {EST_AI_NATIVE_SPECS} from '../est-ai/est-native-spec';

const motors = ['E', 'F', 'G', 'H'];
const notes = ['C', 'C#', 'D', 'E#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'B#', 'B'];
const argumentsFor = definition => Object.keys(definition).filter(key => /^args\d+$/.test(key))
    .flatMap(key => definition[key]);
const categoryFor = category => (
    {events: 'event', combined_motor: 'movement', matrix: 'display'}[category] || category
);

const inputSpec = (row, argument) => {
    const input = row.inputs.find(item => item.name === argument.name);
    if (!input) return {kind: 'boolean'};
    const shadow = catalog.shadows.find(item => item.id === input.type);
    const field = argumentsFor(shadow.definition).find(item => item.name);
    const descriptor = {shadow: {type: `spark_${input.type}`, field: field.name}};
    if (field.type === 'field_combined_motor') {
        return {...descriptor,
            kind: 'enum',
            values: motors.flatMap(left =>
                motors.filter(right => right !== left).map(right => `${left}+${right}`))};
    }
    if (field.type === 'field_motor' || field.type === 'field_handShank' || field.type === 'field_piano' ||
        field.type === 'field_dropdown') {
        let values = field.motorList ? field.motorList.filter(port => port !== 'null') :
            field.handShankValue || (field.type === 'field_piano' ? notes :
                field.options.map(option => String(option[1])));
        if (input.type === 'matrix_x') values = values.slice(0, 7);
        if (input.type === 'matrix_y') values = values.slice(0, 5);
        return {...descriptor, kind: 'enum', values};
    }
    if (field.type === 'field_input') {
        return {...descriptor, kind: /^operator_(gt|lt|equals)$/.test(row.id) ? 'any' : 'text'};
    }
    return {...descriptor,
        kind: 'number',
        ...(typeof field.min === 'undefined' ? {} : {min: Number(field.min)}),
        ...(typeof field.max === 'undefined' ? {} : {max: Number(field.max)}),
        ...(field.precision === 1 ? {integer: true} : {}),
        ...(['COUNT', 'SECONDS', 'DURATION', 'BEATS', 'TIMES'].includes(input.name) ? {min: 0} : {}),
        ...(input.name === 'TIMES' ? {max: 10000} : {})};
};

const specFor = row => {
    const extensions = row.definition.extensions || [];
    const kind = extensions.includes('shape_hat') ? 'hat' :
        extensions.includes('output_boolean') ? 'boolean' :
            extensions.some(extension => /^output_/.test(extension)) ? 'reporter' : 'statement';
    const fields = {};
    const inputs = {};
    const branches = {};
    argumentsFor(row.definition).forEach(argument => {
        if (argument.type === 'field_dropdown') {
            fields[argument.name] = {kind: 'enum', values: argument.options.map(option => String(option[1]))};
        } else if (argument.type === 'field_matrix') {
            fields[argument.name] = {kind: 'matrix', format: '35 binary digits: 7 rows of 5 pixels, 1=on, 0=off'};
        } else if (argument.type === 'input_statement') {
            branches[argument.name] = {kind: 'statement'};
        } else if (argument.type === 'input_value') inputs[argument.name] = inputSpec(row, argument);
    });
    return {type: `spark_${row.id}`,
        category: categoryFor(row.category),
        kind,
        acceptsNext: kind === 'statement' && !['control_break', 'control_stop'].includes(row.id),
        fields,
        inputs,
        branches};
};

// Build the assistant contract from the same fixed catalog as the actual toolbox.
export const SPARK_AI_BLOCK_SPEC = Object.freeze(Object.fromEntries([
    ...catalog.blocks.map(row => [`spark_${row.id}`, Object.freeze(specFor(row))]),
    ...Object.entries(EST_AI_NATIVE_SPECS).filter(([, spec]) => ['variables', 'procedures'].includes(spec.category))
]));

export const getSparkAiBlockDescription = (type, locale) => {
    const row = catalog.blocks.find(item => `spark_${item.id}` === type);
    return row ? sparkText(row.id, locale, row.definition.message0).replace(/%\d+/g, '')
        .trim() : null;
};

export const SPARK_AI_SAMPLE_IR = {
    version: 1,
    hardwareId: 'spark-ai',
    mode: 'insert',
    stacks: [{event: {type: 'spark_event_whenflagclicked'},
        body: [
            {type: 'spark_matrix_lamp_text', inputs: {matrix_text: 'HELLO'}},
            {type: 'spark_control_wait', inputs: {DURATION: 1}},
            {type: 'spark_matrix_lamp_stop'}
        ]}]
};
