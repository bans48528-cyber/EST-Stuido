import catalog from './catalog.json';
import {NEW_COLOUR_CARDS} from './fields';
import firmwareRelease from '../../main/new-ai/firmware-release.json';
import {EST_AI_NATIVE_SPECS} from '../est-ai/est-native-spec';

const ports = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const notes = ['C', 'C#', 'D', 'E#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'B#', 'B'];
const argumentsFor = definition => Object.keys(definition).filter(key => /^args\d+$/.test(key))
    .flatMap(key => definition[key]);
const categoryFor = category => ({events: 'event',
    combined_motor: 'movement',
    matrix: 'display',
    cameraRecognition: 'vision',
    grayv2: 'sensing'}[category] || category);
// The original sound generator strips digits. Only offer names that survive it unchanged.
const soundNames = firmwareRelease.files.map(file => /^music\/(.+)\.wav$/.exec(file.path))
    .filter(match => match && !/\d/.test(match[1]))
    .map(match => match[1]);

const inputSpec = (row, argument) => {
    const input = row.inputs.find(item => item.name === argument.name);
    if (!input) return {kind: 'boolean'};
    const shadow = catalog.shadows.find(item => item.id === input.type);
    const field = argumentsFor(shadow.definition).find(item => item.name);
    const descriptor = {shadow: {type: `new_${input.type}`, field: field.name}};
    if (field.type === 'field_combined_motor') {
        return {...descriptor,
            kind: 'enum',
            values: ports.flatMap(left =>
                ports.filter(right => right !== left).map(right => `${left}+${right}`))};
    }
    if (input.type === 'sound_sounds_menu') return {...descriptor, kind: 'enum', values: soundNames};
    if (field.type === 'field_colour_card') return {...descriptor, kind: 'enum', values: NEW_COLOUR_CARDS};
    if (field.type === 'field_colour_slider') return {...descriptor, kind: 'colour', format: '#RRGGBB'};
    if (field.type === 'field_motor' || field.type === 'field_piano' || field.type === 'field_dropdown') {
        return {...descriptor,
            kind: 'enum',
            values: field.motorList ?
                field.motorList.filter(port => port !== 'null') : field.type === 'field_piano' ? notes :
                    field.options.map(option => String(option[1]))};
    }
    if (field.type === 'field_input') {
        return {...descriptor, kind: /^operator_(gt|lt|equals)$/.test(row.id) ? 'any' : 'text'};
    }
    return {...descriptor,
        kind: 'number',
        ...(typeof field.min === 'undefined' ? {} : {min: Number(field.min)}),
        ...(typeof field.max === 'undefined' ? {} : {max: Number(field.max)}),
        ...(field.precision === 1 ? {integer: true} : {}),
        ...(['COUNT', 'distance', 'DURATION', 'BEATS', 'TIMES'].includes(input.name) ? {min: 0} : {}),
        ...(input.name === 'TIMES' ? {max: 10000} : {}),
        ...(['PORT_ONE', 'PORT_TWO'].includes(input.name) ? {min: 0, max: 7, integer: true} : {})};
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
            fields[argument.name] = {kind: 'enum',
                values: row.id === 'control_stop' ?
                    ['single', 'all', 'other', 'exit'] : argument.options.map(option => String(option[1]))};
        } else if (argument.type === 'field_matrix') {
            fields[argument.name] = {kind: 'matrix',
                length: 63,
                format: '63 binary digits, row-major: 9 rows of 7 columns; 1=on, 0=off; COLOR is #RRGGBB'};
        } else if (argument.type === 'input_statement') branches[argument.name] = {kind: 'statement'};
        else if (argument.type === 'input_value') inputs[argument.name] = inputSpec(row, argument);
    });
    return {type: `new_${row.id}`,
        category: categoryFor(row.category),
        kind,
        acceptsNext: kind === 'statement' && !['control_break', 'control_stop'].includes(row.id),
        fields,
        inputs,
        branches};
};

export const NEW_AI_BLOCK_SPEC = Object.freeze(Object.fromEntries([
    ...catalog.blocks.map(row => [`new_${row.id}`, Object.freeze(specFor(row))]),
    ...Object.entries(EST_AI_NATIVE_SPECS).filter(([, spec]) => ['variables', 'procedures'].includes(spec.category))
]));
export const getNewAiBlockDescription = type => {
    const row = catalog.blocks.find(item => `new_${item.id}` === type);
    return row ? row.definition.message0.replace(/%\d+/g, '').trim() : null;
};
export const NEW_AI_SAMPLE_IR = {version: 1,
    hardwareId: 'new-ai',
    mode: 'insert',
    stacks: [{event: {type: 'new_event_whenflagclicked'},
        body: [
            {type: 'new_matrix_lamp_text', inputs: {matrix_text: 'HELLO'}},
            {type: 'new_control_wait', inputs: {DURATION: 1}},
            {type: 'new_matrix_lamp_stop'}
        ]}]};
