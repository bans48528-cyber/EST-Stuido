// The supplied Pika math modules use radians and one-argument log/log10 functions.
export const installPikaOperators = (g, prefix, namespace) => {
    const modulo = `_studio_${namespace}_mod`;
    g.addReservedWords(modulo);
    const value = (block, name) => g.valueToCode(block, name, g.ORDER_NONE) || '0';
    g[`${prefix}operator_mod`] = block => {
        g.customFunctions_[modulo] = `def ${modulo}(left, right):\n` +
            '    result = _math.fmod(left, right)\n' +
            '    if result != 0 and ((result < 0 and right > 0) or (result > 0 and right < 0)):\n' +
            '        result += right\n' +
            '    return result\n';
        return [`${modulo}(${value(block, 'NUM1')}, ${value(block, 'NUM2')})`, g.ORDER_FUNCTION_CALL];
    };
    // Match OpenBlock's Math.round semantics, including negative halves.
    g[`${prefix}operator_round`] = block => [
        `_math.floor((${value(block, 'NUM')}) + 0.5)`, g.ORDER_FUNCTION_CALL
    ];
    g[`${prefix}operator_mathop`] = block => {
        const input = value(block, 'NUM');
        const expression = {
            '_abs_': `_math.fabs(${input})`,
            'down_abs': `_math.floor(${input})`,
            'up_abs': `_math.ceil(${input})`,
            'sqrt_abs': `_math.sqrt(${input})`,
            'sin_abs': `_math.sin((${input}) / 180.0 * _math.pi)`,
            'cos_abs': `_math.cos((${input}) / 180.0 * _math.pi)`,
            'tan_abs': `_math.tan((${input}) / 180.0 * _math.pi)`,
            'asin_abs': `(_math.asin(${input}) / _math.pi * 180.0)`,
            'acos_abs': `(_math.acos(${input}) / _math.pi * 180.0)`,
            'atan_abs': `(_math.atan(${input}) / _math.pi * 180.0)`,
            // The supplied dropdown visibly says "log", meaning base 10.
            'ln_abs': `_math.log10(${input})`,
            'e_abs': `_math.exp(${input})`,
            '10_abs': `_math.pow(10, ${input})`
        }[block.getFieldValue('OPERATOR')];
        if (!expression) throw new Error('Unknown Pika math operation');
        return [expression, g.ORDER_FUNCTION_CALL];
    };
};
