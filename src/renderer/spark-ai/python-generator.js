// Spark AI API mappings originate in the supplied 1.1.9 extraction.
// Traversal, precedence and value/statement connections use Blockly.Generator.
import installSourceGenerators from './source-generators';
import {installEstPythonNameSanitizer} from '../est-blocks/python-names';
import catalog from './catalog.json';

const HAT = 'spark_event_whenflagclicked';
const ROOTS = new Set([HAT, 'procedures_definition']);
const TYPES = {MOTOR: '_motor',
    MATRIX: '_matrix',
    SOUND: '_beep',
    TOUCH: '_touch',
    COLOR: '_color',
    ULTRASIONIC: '_ultrasion',
    KEY: '_key',
    TIMER: '_os',
    MATH: '_math'};
const KEYWORDS = 'False,None,True,and,as,assert,async,await,break,class,continue,def,del,elif,else,' +
    'except,finally,for,from,global,if,import,in,is,lambda,nonlocal,not,or,pass,raise,return,try,while,with,yield,' +
    '_motor,_matrix,_beep,_touch,_color,_ultrasion,_key,_os,_math,_random,PikaStdData,str,int,len,range';

export const registerSparkPythonGenerator = ScratchBlocks => {
    if (ScratchBlocks.SparkPython) return;
    const Generator = ScratchBlocks.Generator || ScratchBlocks.Python.constructor;
    const g = new Generator('SparkPython');
    ScratchBlocks.SparkPython = g;
    Object.keys(ScratchBlocks.Python).filter(key => key.startsWith('ORDER_'))
        .forEach(key => {
            g[key] = ScratchBlocks.Python[key];
        });
    g.INDENT = '    ';
    g.addReservedWords(KEYWORDS);
    g.quote_ = value => `'${String(value).replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n')
        .replace(/\t/g, '\\t')}'`;
    Object.keys(TYPES).forEach(type => {
        g[`${type}_TYPE`] = type;
    });
    g.handleResult = (code, type) => `${TYPES[type]}.${code}`;
    g.combined_letter_to_number = code => String(code).replace(/['"]/g, '')
        .split('+')
        .map(port => (/^[A-H]$/.test(port.trim()) ? 'ABCDEFGH'.indexOf(port.trim()) : port.trim()))
        .join(',');
    g.sensing_port_to_number = code => {
        const match = /^(['"])([A-H])\1$|^([A-H])$/.exec(String(code).trim());
        return match ? 'ABCDEFGH'.indexOf(match[2] || match[3]) : String(code);
    };
    g.stringToHex = matrix => (String(matrix).match(/.{5}/g) || []).map(row =>
        `0x${parseInt(row.split('').reverse()
            .join(''), 2).toString(16)
            .toUpperCase()
            .padStart(2, '0')}`);

    // A local Blockly facade isolates source functions from EST's Python globals.
    const Blockly = Object.create(ScratchBlocks);
    Blockly.Python = g;
    installSourceGenerators(Blockly);
    // Blockly treats numeric 0 as an empty value unless literal code is a string.
    catalog.shadows.forEach(row => {
        const id = `spark_${row.id}`;
        const original = g[id];
        g[id] = block => {
            const [code, order] = original(block);
            return [String(code), order];
        };
    });
    const variableType = ScratchBlocks.Variables.NAME_TYPE;
    const variableName = (block, field) => g.variableDB_.getName(block.getFieldValue(field), variableType);
    const procName = code => g.variableDB_.getName(code.replace(/ /g, '_').replace(/%([nsb])/g,
        (match, type) => type.toUpperCase()), ScratchBlocks.Procedures.NAME_TYPE);

    g.init = workspace => {
        installEstPythonNameSanitizer(ScratchBlocks, g);
        g.variableDB_.reset();
        g.variableDB_.setVariableMap(workspace.getVariableMap());
        g.variables_ = Object.create(null);
        g.customFunctions_ = Object.create(null);
        g.customFunctionsArgName_ = Object.create(null);
        g.imports_ = Object.create(null);
        workspace.getAllVariables().forEach(variable => {
            const name = g.variableDB_.getName(variable.getId(), variableType);
            if (variable.type === 'list') g.imports_.lists = 'import PikaStdData';
            g.variables_[variable.getId()] = `${name} = ${variable.type === 'list' ? 'PikaStdData.List()' : '0'}`;
        });
    };
    g.finish = code => [Object.values(g.imports_).join('\n'), Object.values(g.variables_).join('\n'),
        Object.values(g.customFunctions_).join('\n'), code].filter(Boolean).join('\n\n');
    g.scrubNakedValue = () => '';
    g.check_ = block => !block.getRootBlock().disabled;
    g.scrub_ = (block, code) => {
        if (block.outputConnection) return code;
        if (!ROOTS.has(block.getRootBlock().type)) return '';
        const comment = block.getCommentText();
        const next = block.nextConnection && block.nextConnection.targetBlock();
        return (comment ? `${g.prefixLines(comment, '# ')}\n` : '') + code + g.blockToCode(next);
    };
    g[HAT] = () => '';
    const value = (block, name, fallback = '0') => g.valueToCode(block, name, g.ORDER_NONE) || fallback;
    const body = (block, name = 'SUBSTACK') => g.statementToCode(block, name) || `${g.INDENT}pass\n`;
    const sleep = `${g.INDENT}_os.sleep_s(0.001)\n`;
    g.spark_control_wait_until = block => `while not (${value(block, 'CONDITION', 'False')}):\n${sleep}`;
    g.spark_control_repeat = block => {
        const count = g.variableDB_.getDistinctName('count', 'generated_function');
        return `for ${count} in range(int(${value(block, 'TIMES')})):\n${body(block)}${sleep}`;
    };
    g.spark_control_forever = block => `while True:\n${body(block)}${sleep}`;
    g.spark_control_repeat_until = block =>
        `while not (${value(block, 'CONDITION', 'False')}):\n${body(block)}${sleep}`;
    g.spark_control_if = block => `if ${value(block, 'CONDITION', 'False')}:\n${body(block)}`;
    g.spark_control_if_else = block => `${g.spark_control_if(block)}else:\n${body(block, 'SUBSTACK2')}`;
    g.spark_control_break = block => {
        let parent = block.getSurroundParent();
        while (parent && !['spark_control_repeat', 'spark_control_forever', 'spark_control_repeat_until']
            .includes(parent.type)) parent = parent.getSurroundParent();
        return parent ? 'break\n' : '';
    };
    g.spark_operator_not = block => [`not (${value(block, 'OPERAND', 'False')})`, g.ORDER_LOGICAL_NOT];
    ['add', 'subtract', 'multiply', 'divide'].forEach((operation, index) => {
        g[`spark_operator_${operation}`] = block => {
            const order = index < 2 ? g.ORDER_ADDITIVE : g.ORDER_MULTIPLICATIVE;
            const operand = name => g.valueToCode(block, name, order) || '0';
            return [`${operand('NUM1')} ${['+', '-', '*', '/'][index]} ${operand('NUM2')}`, order];
        };
    });
    g.spark_sound_PlayMusic = block => {
        const note = value(block, 'NOTE', 'C').replace(/^['"]|['"]$/g, '')
            .toLowerCase();
        return `_beep.play_muic(${g.quote_(note)}, ${value(block, 'BEATS')})\n`;
    };
    // Native editors create these shared shadow/reporter types in variable and procedure inputs.
    ['math_number', 'math_positive_number', 'math_whole_number', 'math_integer', 'text'].forEach(id => {
        g[id] = g[`spark_${id}`];
    });
    g.data_listcontents = block => [variableName(block, 'LIST'), g.ORDER_ATOMIC];
    g.procedures_definition = block => {
        const prototype = block.getInputTargetBlock('custom_block');
        if (!prototype) return '';
        const previousArgs = g.customFunctionsArgName_;
        g.customFunctionsArgName_ = Object.create(null);
        const args = (prototype.displayNames_ || []).map(name => {
            const safe = g.variableDB_.getDistinctName(name, 'argument');
            g.customFunctionsArgName_[name] = safe;
            return safe;
        });
        const functionName = procName(prototype.getProcCode());
        const next = block.nextConnection && block.nextConnection.targetBlock();
        const globals = Object.values(g.variables_).map(line => line.split(' = ')[0]);
        const declarations = globals.length ? `${g.INDENT}global ${globals.join(', ')}\n` : '';
        const statements = next ? g.blockToCode(next) : '';
        g.customFunctions_[functionName] = `def ${functionName}(${args.join(', ')}):\n${declarations}${
            statements ? g.prefixLines(statements, g.INDENT) : `${g.INDENT}pass\n`}`;
        g.customFunctionsArgName_ = previousArgs;
        return null;
    };
    g.procedures_call = block => {
        const args = block.inputList.filter(input => input.type === ScratchBlocks.INPUT_VALUE)
            .map(input => value(block, input.name, 'False'));
        return `${procName(block.getProcCode())}(${args.join(', ')})\n`;
    };
    ['boolean', 'number', 'string', 'string_number'].forEach(type => {
        g[`argument_reporter_${type}`] = block => [
            g.customFunctionsArgName_[block.getFieldValue('VALUE')] || '0', g.ORDER_ATOMIC
        ];
    });
    // Removed argument shadows must still produce valid calls with their documented default values.
    const originalValueToCode = g.valueToCode;
    const defaults = new Map(catalog.blocks.map(block => [`spark_${block.id}`, block.inputs]));
    g.valueToCode = function (block, name, order) {
        const code = originalValueToCode.call(this, block, name, order);
        if (code) return code;
        const input = (defaults.get(block.type) || []).find(item => item.name === name);
        if (!input) return '';
        const shadow = {getFieldValue: field => input.fields[field] || (field === 'NUM' ? '0' : '')};
        return String(g[`spark_${input.type}`](shadow)[0]);
    };
};
