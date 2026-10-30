// The supplied Spark firmware supports pop/insert/set/len, but not the original generated list APIs.
const helpers = {
    item: name => `def ${name}(items, index):\n` +
        '    index = int(index) - 1\n' +
        '    if index < 0 or index >= len(items):\n' +
        "        return ''\n" +
        '    return items[index]\n',
    insert: name => `def ${name}(items, index, value):\n` +
        '    index = int(index) - 1\n' +
        '    if index >= 0 and index <= len(items):\n' +
        '        items.insert(index, value)\n',
    replace: name => `def ${name}(items, index, value):\n` +
        '    index = int(index) - 1\n' +
        '    if index >= 0 and index < len(items):\n' +
        '        items.set(index, value)\n',
    delete: name => `def ${name}(items, index):\n` +
        '    index = int(index) - 1\n' +
        '    if index >= 0 and index < len(items):\n' +
        '        items.pop(index)\n',
    clear: name => `def ${name}(items):\n` +
        '    while len(items) > 0:\n' +
        '        items.pop()\n',
    find: name => `def ${name}(items, value):\n` +
        '    index = 0\n' +
        '    while index < len(items):\n' +
        '        if items[index] == value:\n' +
        '            return index + 1\n' +
        '        index += 1\n' +
        '    return 0\n'
};

export const installSparkListGenerator = (g, ScratchBlocks) => {
    const names = Object.fromEntries(Object.keys(helpers).map(key => [key, `_studio_spark_list_${key}`]));
    g.addReservedWords(Object.values(names).join(','));
    const name = block => g.variableDB_.getName(block.getFieldValue('LIST'), ScratchBlocks.Variables.NAME_TYPE);
    const input = (block, key) => {
        const code = g.valueToCode(block, key, g.ORDER_NONE) || '0';
        const quoted = key === 'ITEM' && /^(['"])([\s\S]*)\1$/.exec(code);
        return quoted && quoted[2].trim() && Number.isFinite(Number(quoted[2])) ? String(Number(quoted[2])) : code;
    };
    const call = (operation, block, keys) => {
        g.customFunctions_[names[operation]] = helpers[operation](names[operation]);
        return `${names[operation]}(${[name(block), ...keys.map(key => input(block, key))].join(', ')})`;
    };
    g.data_itemoflist = block => [call('item', block, ['INDEX']), g.ORDER_FUNCTION_CALL];
    g.data_insertatlist = block => `${call('insert', block, ['INDEX', 'ITEM'])}\n`;
    g.data_replaceitemoflist = block => `${call('replace', block, ['INDEX', 'ITEM'])}\n`;
    g.data_deleteoflist = block => `${call('delete', block, ['INDEX'])}\n`;
    g.data_deletealloflist = block => `${call('clear', block, [])}\n`;
    g.data_itemnumoflist = block => [call('find', block, ['ITEM']), g.ORDER_FUNCTION_CALL];
    g.data_listcontainsitem = block => [`(${call('find', block, ['ITEM'])} > 0)`, g.ORDER_RELATIONAL];
    g.data_lengthoflist = block => [`len(${name(block)})`, g.ORDER_FUNCTION_CALL];
};
