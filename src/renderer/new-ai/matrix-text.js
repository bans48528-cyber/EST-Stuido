// NEW AI firmware 321: _matrix.show_roll copies into a 32-byte buffer and uses this fixed font.
export const NEW_MATRIX_TEXT_MAX_LENGTH = 31;
export const NEW_MATRIX_TEXT_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789?.+-*/=';

const literalText = value => {
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (value && value.type === 'new_operator_join' && value.inputs) {
        const left = literalText(value.inputs.STRING1);
        const right = literalText(value.inputs.STRING2);
        return left === null || right === null ? null : left + right;
    }
    return null;
};

export const newMatrixTextIssue = value => {
    const text = literalText(value);
    if (text === null) return null;
    if (text.length > NEW_MATRIX_TEXT_MAX_LENGTH) return 'length';
    return [...text].some(character => !NEW_MATRIX_TEXT_CHARACTERS.includes(character)) ? 'characters' : null;
};
