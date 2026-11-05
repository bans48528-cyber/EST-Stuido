import catalog from './catalog.json';
import {sparkText} from './messages';
import {getCurrentEstLocale, getEstText} from '../est-i18n';
import {registerSparkMatrixField} from './matrix-field';
import {registerSparkCombinedMotorField} from './combined-motor-field';
import {registerSparkGamepadField} from './gamepad-field';

export const sparkBlockId = id => `spark_${id}`;
const categoryStyles = {
    motor: ['#0090F5', '#0078CC', '#005FA0', 'category.motor'],
    combined_motor: ['#fb59ce', '#d8009b', '#a9007a', 'category.movement'],
    matrix: ['#935DF5', '#691FF0', '#4A00D0', 'category.matrix'],
    sound: ['#BF70E7', '#A239D8', '#763696', 'category.sound'],
    events: ['#F5C400', '#D9B100', '#B89A00', 'category.event'],
    control: ['#FFB515', '#E39B00', '#C18401', 'category.control'],
    sensing: ['#1DCCF0', '#00A8C9', '#008AA6', 'category.sensing'],
    operators: ['#59C059', '#46A646', '#389438', 'home.blockGuide.category.operators']
};
const pickerCategories = {
    motor_box: 'motor',
    combined_motor_box: 'combined_motor',
    touching_menu: 'sensing',
    sensing_menu: 'sensing',
    handShank_menu: 'sensing'
};
const nativeMessages = {
    control_wait: 'CONTROL_WAIT',
    control_wait_until: 'CONTROL_WAITUNTIL',
    control_repeat: 'CONTROL_REPEAT',
    control_forever: 'CONTROL_FOREVER',
    control_if: 'CONTROL_IF',
    control_if_else: 'CONTROL_IF',
    control_repeat_until: 'CONTROL_REPEATUNTIL',
    operator_letter_of: 'OPERATORS_LETTEROF',
    operator_mathop: 'OPERATORS_MATHOP'
};
const nativeKey = id => nativeMessages[id] || (id.startsWith('operator_') ?
    id.replace('operator_', 'OPERATORS_').toUpperCase() : null);
const mapField = (arg, locale, shadowId) => {
    if (arg.type === 'field_matrix') return {...arg, type: 'field_spark_matrix'};
    if (arg.type === 'field_image') return {...arg, alt: sparkText(arg.alt, locale)};
    if (arg.type === 'field_slider') return {...arg, type: 'field_number'};
    if (arg.type === 'field_motor') {
        return {type: 'field_dropdown',
            name: arg.name,
            options: arg.motorList.filter(port => port !== 'null').map(port => [port, port])};
    }
    if (arg.type === 'field_combined_motor') {
        return {...arg, type: 'field_spark_combined_motor'};
    }
    if (arg.type === 'field_handShank') {
        return {...arg, type: 'field_spark_gamepad'};
    }
    if (arg.type === 'field_piano') {
        return {type: 'field_dropdown',
            name: arg.name,
            options: ['C', 'C#', 'D', 'E#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'B#', 'B'].map(note => [note, note])};
    }
    if (arg.type === 'field_dropdown') {
        let options = arg.options;
        if (shadowId === 'matrix_x') options = options.slice(0, 7);
        if (shadowId === 'matrix_y') options = options.slice(0, 5);
        return {...arg,
            options: options.map(([label, value]) => [
                typeof label === 'string' ? sparkText(label, locale) : {...label, alt: sparkText(label.alt, locale)},
                value
            ])};
    }
    return arg;
};

export const defineSparkBlocksWithLocale = (ScratchBlocks, locale = getCurrentEstLocale()) => {
    registerSparkMatrixField(ScratchBlocks);
    registerSparkCombinedMotorField(ScratchBlocks);
    registerSparkGamepadField(ScratchBlocks);
    const dictionary = ScratchBlocks.ScratchMsgs.locales[locale] || ScratchBlocks.ScratchMsgs.locales.en;
    [...catalog.blocks, ...catalog.shadows].forEach(row => {
        const definition = JSON.parse(JSON.stringify(row.definition));
        const pickerStyle = categoryStyles[pickerCategories[row.id]];
        // Match EST pickers: secondary fill and tertiary outline.
        const style = pickerStyle ? [pickerStyle[1], pickerStyle[1], pickerStyle[2]] :
            categoryStyles[row.category] || (row.id === 'piano' ? categoryStyles.sound : [
                definition.colour || '#FFFFFF',
                definition.colourSecondary || '#FFFFFF',
                definition.colourTertiary || '#D9D9D9'
            ]);
        delete definition.type;
        delete definition.id;
        definition.category = sparkBlockId(row.category || 'input');
        definition.colour = style[0];
        definition.colourSecondary = style[1];
        definition.colourTertiary = style[2];
        definition.extensions = (definition.extensions || []).filter(extension => !extension.startsWith('colours_'));
        const key = nativeKey(row.id);
        definition.message0 = (key && dictionary[key]) || sparkText(row.id, locale, definition.message0);
        if (row.id === 'control_if_else') definition.message2 = dictionary.CONTROL_ELSE;
        if (row.id === 'sound_PlayMusic' && locale === 'zh-cn') definition.message0 = '%1 %2 演奏音符 %3 %4 秒';
        if (row.id === 'sensing_timer' && locale === 'zh-cn') definition.message0 = '计时器（毫秒）';
        Object.keys(definition).filter(name => /^args\d+$/.test(name))
            .forEach(name => {
                definition[name] = definition[name].map(arg => mapField(arg, locale, row.id));
            });
        ScratchBlocks.Blocks[sparkBlockId(row.id)] = {init () {
            this.jsonInit(definition);
        }};
    });
};

const escapeXml = value => String(value).replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
const fieldsXml = fields => Object.entries(fields || {}).map(([name, value]) =>
    `<field name="${escapeXml(name)}">${escapeXml(value)}</field>`)
    .join('');
export const sparkBlockXml = row => `<block type="${sparkBlockId(row.id)}">${fieldsXml(row.fields)}${
    row.inputs.map(input => `<value name="${escapeXml(input.name)}"><shadow type="${sparkBlockId(input.type)}">` +
        `${fieldsXml(input.fields)}</shadow></value>`).join('')}</block>`;

export const getSparkToolboxCategories = (locale = getCurrentEstLocale()) =>
    Object.entries(categoryStyles).map(([id, style]) => {
        const name = id === 'matrix' ? sparkText('category.matrix', locale, '矩阵灯') : getEstText(style[3], locale);
        return `${`<category name="${escapeXml(name)}" id="${sparkBlockId(id)}" colour="${style[0]}" ` +
            `secondaryColour="${style[1]}" tertiaryColour="${style[2]}">`}${
            catalog.blocks.filter(row => row.category === id).map(sparkBlockXml)
                .join('\n')}</category>`;
    })
        .join('\n');
