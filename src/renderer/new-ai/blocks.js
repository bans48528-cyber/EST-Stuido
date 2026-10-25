import catalog from './catalog.json';
import {registerNewFields} from './fields';
import {newBlockText} from './messages';
import {registerSparkCombinedMotorField} from '../spark-ai/combined-motor-field';
import {getCurrentEstLocale, getEstText, normalizeEstLocale} from '../est-i18n';

export const NEW_PORTS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const styles = {
    motor: ['#0090F5', '#0078CC', '#005FA0', 'category.motor'],
    combined_motor: ['#fb59ce', '#d8009b', '#a9007a', 'category.movement'],
    matrix: ['#935DF5', '#691FF0', '#4A00D0', 'category.matrix'],
    sound: ['#BF70E7', '#A239D8', '#763696', 'category.sound'],
    events: ['#F5C400', '#D9B100', '#B89A00', 'category.event'],
    control: ['#FFB515', '#E39B00', '#C18401', 'category.control'],
    sensing: ['#1DCCF0', '#00A8C9', '#008AA6', 'category.sensing'],
    cameraRecognition: ['#2BAD8A', '#21886D', '#17634F', 'camera'],
    grayv2: ['#ED5283', '#CF2D60', '#A01D46', 'grayv2'],
    operators: ['#59C059', '#46A646', '#389438', 'home.blockGuide.category.operators']
};
const pickerCategory = {motor_box: 'motor',
    combined_motor_box: 'combined_motor',
    sensing_menu: 'sensing',
    cameraRecognition_menu: 'cameraRecognition',
    grayv2_menu: 'grayv2'};
const escapeXml = value => String(value).replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
const fieldsXml = fields => Object.entries(fields || {}).map(([name, value]) =>
    `<field name="${escapeXml(name)}">${escapeXml(value)}</field>`)
    .join('');

const nativeMessages = {
    control_wait: 'CONTROL_WAIT',
    control_wait_until: 'CONTROL_WAITUNTIL',
    control_repeat: 'CONTROL_REPEAT',
    control_forever: 'CONTROL_FOREVER',
    control_if: 'CONTROL_IF',
    control_if_else: 'CONTROL_IF',
    control_repeat_until: 'CONTROL_REPEATUNTIL',
    operator_letter_of: 'OPERATORS_LETTEROF'
};
const nativeKey = id => nativeMessages[id] || (id.startsWith('operator_') ?
    id.replace('operator_', 'OPERATORS_').toUpperCase() : null);
const mapArgument = (argument, locale) => {
    if (argument.type === 'field_matrix') return {...argument, type: 'field_new_matrix'};
    if (argument.type === 'field_colour_card') return {...argument, type: 'field_new_colour_card'};
    if (argument.type === 'field_slider') return {...argument, type: 'field_number'};
    if (argument.type === 'field_motor') {
        return {type: 'field_dropdown',
            name: argument.name,
            options: argument.motorList.filter(port => port !== 'null').map(port => [port, port])};
    }
    if (argument.type === 'field_combined_motor') return {...argument, type: 'field_new_combined_motor'};
    if (argument.type === 'field_piano') {
        return {type: 'field_dropdown',
            name: argument.name,
            options: ['C', 'C#', 'D', 'E#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'B#', 'B'].map(note => [note, note])};
    }
    if (argument.type === 'field_dropdown' && argument.name === 'SOUND_MENU' && !Array.isArray(argument.options)) {
        return {type: 'field_input', name: argument.name, text: ''};
    }
    if (argument.type === 'field_dropdown' && Array.isArray(argument.options)) {
        return {...argument,
            options: argument.options.map(([label, value]) => [typeof label === 'string' ?
                newBlockText(label, locale) : {...label, alt: newBlockText(label.alt, locale)}, value])};
    }
    if (argument.type === 'field_image' && argument.alt === 'flag') {
        return {...argument, alt: newBlockText('flag', locale, '绿旗')};
    }
    return argument;
};

export const defineNewBlocksWithLocale = (ScratchBlocks, locale = getCurrentEstLocale()) => {
    locale = normalizeEstLocale(locale);
    registerNewFields(ScratchBlocks);
    registerSparkCombinedMotorField(ScratchBlocks, {ports: NEW_PORTS, type: 'field_new_combined_motor'});
    const dictionary = ScratchBlocks.ScratchMsgs.locales[locale] || ScratchBlocks.ScratchMsgs.locales.en;
    [...catalog.blocks, ...catalog.shadows].forEach(row => {
        const definition = JSON.parse(JSON.stringify(row.definition));
        const picker = styles[pickerCategory[row.id]];
        const fallback = [definition.colour || '#FFFFFF', definition.colourSecondary || '#FFFFFF',
            definition.colourTertiary || '#D9D9D9'];
        const style = picker ? [picker[1], picker[1], picker[2]] : styles[row.category] || fallback;
        delete definition.type;
        delete definition.id;
        definition.category = `new_${row.category || 'input'}`;
        [definition.colour, definition.colourSecondary, definition.colourTertiary] = style;
        definition.extensions = (definition.extensions || []).filter(extension => !extension.startsWith('colours_'));
        Object.keys(definition).filter(key => /^args\d+$/.test(key))
            .forEach(key => {
                definition[key] = definition[key].map(argument => mapArgument(argument, locale));
            });
        const key = nativeKey(row.id);
        definition.message0 = (key && dictionary[key]) || newBlockText(row.id, locale, definition.message0);
        if (row.id === 'control_if_else') definition.message2 = dictionary.CONTROL_ELSE;
        if (row.id === 'control_stop') {
            definition.args0[0].options = [['此脚本', 'single'], ['全部脚本', 'all'], ['其他脚本', 'other'],
                ['停止并退出', 'exit']].map(([label, value]) => [newBlockText(label, locale), value]);
            definition.extensions.push('shape_end');
        }
        ScratchBlocks.Blocks[`new_${row.id}`] = {init () {
            this.jsonInit(definition);
            if (row.id !== 'control_stop') return;
            const field = this.getField('STOP_OPTION');
            const setValue = field.setValue;
            field.setValue = option => {
                if (!['single', 'all', 'other', 'exit'].includes(option)) return;
                const group = ScratchBlocks.Events.getGroup();
                if (!group) ScratchBlocks.Events.setGroup(true);
                const before = ScratchBlocks.Xml.domToText(this.mutationToDom());
                if (option !== 'other' && this.nextConnection && this.nextConnection.isConnected()) {
                    this.nextConnection.targetBlock().unplug();
                }
                this.setNextStatement(option === 'other');
                const after = ScratchBlocks.Xml.domToText(this.mutationToDom());
                if (before !== after) {
                    const event = new ScratchBlocks.Events.BlockChange(this, 'mutation', null, before, after);
                    ScratchBlocks.Events.fire(event);
                }
                setValue.call(field, option);
                if (!group) ScratchBlocks.Events.setGroup(false);
            };
        },
        ...(row.id === 'control_stop' ? {mutationToDom () {
            const mutation = document.createElement('mutation');
            mutation.setAttribute('hasnext', String(Boolean(this.nextConnection)));
            return mutation;
        },
        domToMutation (mutation) {
            this.setNextStatement(mutation.getAttribute('hasnext') === 'true');
        }} : {})};
    });
};

export const newBlockXml = row => `<block type="new_${escapeXml(row.id)}">${fieldsXml(
    row.id === 'control_stop' ? {...row.fields, STOP_OPTION: 'single'} : row.fields)}${row.inputs.map(input =>
    `<value name="${escapeXml(input.name)}"><shadow type="new_${escapeXml(input.type)}">${fieldsXml(input.fields)}` +
        '</shadow></value>').join('')}</block>`;

export const getNewToolboxCategories = (locale = getCurrentEstLocale()) => Object.entries(styles).map(([id, style]) => {
    const special = {matrix: ['category.matrix', '矩阵灯'],
        cameraRecognition: ['category.camera', '摄像头识别'],
        grayv2: ['category.grayv2', '巡线卡 V2']}[id];
    const name = special ? newBlockText(special[0], normalizeEstLocale(locale), special[1]) :
        getEstText(style[3], locale);
    return `${`<category name="${escapeXml(name)}" id="new_${id}" colour="${style[0]}" ` +
        `secondaryColour="${style[1]}" tertiaryColour="${style[2]}">`}${
        catalog.blocks.filter(row => row.category === id).map(newBlockXml)
            .join('\n')}</category>`;
})
    .join('\n');
