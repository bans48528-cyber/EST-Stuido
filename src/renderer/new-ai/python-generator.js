import installNewSourceGenerators from './source-generators';
import catalog from './catalog.json';
import {installEstPythonNameSanitizer} from '../est-blocks/python-names';
import {installPikaOperators} from '../est-blocks/pika-operators';
import {parseSparkMotorPair} from '../spark-ai/combined-motor-field';

export const NEW_MOTOR_PAIR_INCOMPLETE = 'NEW_MOTOR_PAIR_INCOMPLETE';
const PORTS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const LIST_HELPERS = {
    item: 'def _studio_new_list_item(items, index):\n' +
        '    index = int(index) - 1\n' +
        '    if index < 0 or index >= len(items):\n' +
        "        return ''\n" +
        '    return items[index]\n',
    insert: 'def _studio_new_list_insert(items, index, value):\n' +
        '    index = int(index) - 1\n' +
        '    if index >= 0 and index <= len(items):\n' +
        '        items.insert(index, value)\n',
    replace: 'def _studio_new_list_replace(items, index, value):\n' +
        '    index = int(index) - 1\n' +
        '    if index >= 0 and index < len(items):\n' +
        '        items.set(index, value)\n',
    delete: 'def _studio_new_list_delete(items, index):\n' +
        '    index = int(index) - 1\n' +
        '    if index >= 0 and index < len(items):\n' +
        '        items.remove_index(index)\n'
};

export const registerNewPythonGenerator = ScratchBlocks => {
    if (ScratchBlocks.NewPython) return;
    const Generator = ScratchBlocks.Generator || ScratchBlocks.Python.constructor;
    const g = new Generator('NewPython');
    ScratchBlocks.NewPython = g;
    const Blockly = Object.create(ScratchBlocks);
    Blockly.Python = g;
    installNewSourceGenerators(Blockly);
    installPikaOperators(g, 'new_', 'new');
    g.ORDER_UNARY_PREFIX = g.ORDER_UNARY_POSTFIX = g.ORDER_UNARY_SIGN;
    g.addReservedWords(['_motor,_matrix,_music,_mem,_color,_ultrasion,_touch,_key,_gray,_os,_message,_nfc',
        '_camer,_grayv2,_thread,_math,_random,PikaStdData',
        ...Object.keys(LIST_HELPERS).map(operation => `_studio_new_list_${operation}`)].join(','));
    const init = g.init;
    g.init = workspace => {
        installEstPythonNameSanitizer(ScratchBlocks, g);
        init(workspace);
        g.soundslist = [];
        g.oldColor = null;
    };
    g.quote_ = value => `'${String(value).replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n')
        .replace(/\t/g, '\\t')}'`;
    catalog.shadows.forEach(row => {
        const key = `new_${row.id}`; const original = g[key];
        g[key] = block => {
            const [code, order] = original(block);
            return [String(code), order];
        };
    });
    ['math_number', 'math_positive_number', 'math_whole_number', 'math_integer', 'text'].forEach(id => {
        g[id] = g[`new_${id}`];
    });
    g.data_listcontents = block => [
        g.variableDB_.getName(block.getFieldValue('LIST'), ScratchBlocks.Variables.NAME_TYPE), g.ORDER_ATOMIC
    ];
    const listName = block => g.variableDB_.getName(block.getFieldValue('LIST'), ScratchBlocks.Variables.NAME_TYPE);
    const listInput = (block, name) => {
        const code = g.valueToCode(block, name, g.ORDER_NONE) || '0';
        // Preserve the original generator's numeric text-item coercion without emitting Infinity/NaN names.
        const quoted = name === 'ITEM' && /^(['"])([\s\S]*)\1$/.exec(code);
        return quoted && quoted[2].trim() && Number.isFinite(Number(quoted[2])) ? String(Number(quoted[2])) : code;
    };
    const listCall = (operation, block, withValue = false) => {
        const name = `_studio_new_list_${operation}`;
        g.customFunctions_[name] = LIST_HELPERS[operation];
        return `${name}(${listName(block)}, ${listInput(block, 'INDEX')}` +
            `${withValue ? `, ${listInput(block, 'ITEM')}` : ''})`;
    };
    // Blockly uses 1-based item numbers; the NEW AI Pika List implementation is 0-based.
    // Helpers evaluate dynamic indices once and keep invalid item numbers from terminating a task.
    g.data_itemoflist = block => [listCall('item', block), g.ORDER_ATOMIC];
    g.data_insertatlist = block => `${listCall('insert', block, true)}\n`;
    g.data_replaceitemoflist = block => `${listCall('replace', block, true)}\n`;
    g.data_deleteoflist = block => `${listCall('delete', block)}\n`;
    g.data_itemnumoflist = block => [
        `(${listName(block)}.dataToindex(${listInput(block, 'ITEM')}) + 1)`, g.ORDER_ATOMIC
    ];
    g.data_lengthoflist = block => [`len(${listName(block)})`, g.ORDER_ATOMIC];
    g.data_listcontainsitem = block => [
        `${listName(block)}.if_data(${listInput(block, 'ITEM')})`, g.ORDER_ATOMIC
    ];
    g.new_operator_not = block => [
        `not (${g.valueToCode(block, 'OPERAND', g.ORDER_NONE) || 'False'})`, g.ORDER_LOGICAL_NOT
    ];
    g.new_control_break = block => {
        let parent = block.getSurroundParent();
        while (parent && !['new_control_repeat', 'new_control_forever', 'new_control_repeat_until']
            .includes(parent.type)) parent = parent.getSurroundParent();
        return parent ? 'break\n' : '';
    };
    ['add', 'subtract', 'multiply', 'divide'].forEach((operation, index) => {
        g[`new_operator_${operation}`] = block => {
            const order = index < 2 ? g.ORDER_ADDITIVE : g.ORDER_MULTIPLICATIVE;
            const operand = name => g.valueToCode(block, name, order) || '0';
            return [`${operand('NUM1')} ${['+', '-', '*', '/'][index]} ${operand('NUM2')}`, order];
        };
    });
    const pair = g.new_combined_motor_starting;
    g.new_combined_motor_starting = block => {
        const value = g.valueToCode(block, 'PORT', g.ORDER_NONE).replace(/['"]/g, '');
        const ports = parseSparkMotorPair(value, PORTS);
        if (ports.length !== 2 || ports.join('+') !== value) return `# ${NEW_MOTOR_PAIR_INCOMPLETE}\n`;
        return pair(block);
    };
    // Native editor arguments use shared opcodes; keep their traversal on this generator.
    g.argument_reporter_string_number = g.argument_reporter_string;
    g.procedures_call = block => {
        const procedure = block.getProcCode().replace(/ /g, '_')
            .replace(/%n/g, 'N')
            .replace(/%s/g, 'S')
            .replace(/%b/g, 'B');
        const name = g.variableDB_.getName(procedure, ScratchBlocks.Procedures.NAME_TYPE);
        const argumentsCode = block.inputList.filter(input => input.type === ScratchBlocks.INPUT_VALUE)
            .map(input => g.valueToCode(block, input.name, g.ORDER_NONE) || 'False');
        return `${name}(${argumentsCode.join(', ')})\n`;
    };
    const defaults = new Map(catalog.blocks.map(row => [`new_${row.id}`, row.inputs]));
    const valueToCode = g.valueToCode;
    g.valueToCode = function (block, name, order) {
        const code = valueToCode.call(this, block, name, order);
        if (code) return code;
        const input = (defaults.get(block.type) || []).find(item => item.name === name);
        if (!input) return '';
        return String(g[`new_${input.type}`]({getFieldValue: field => input.fields[field] || ''})[0]);
    };
};
