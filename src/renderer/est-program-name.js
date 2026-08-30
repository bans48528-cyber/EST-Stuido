export const EST_PROGRAM_NAME_MAX_BYTES = 31;

const encoder = new TextEncoder();

export const utf8ByteLength = value => encoder.encode(String(value)).length;

const fallbackProgramName = slot => `Program ${slot}`;

const truncateUtf8 = (value, maxBytes) => {
    let result = '';
    let totalBytes = 0;
    for (const character of String(value)) {
        const characterBytes = utf8ByteLength(character);
        if (totalBytes + characterBytes > maxBytes) {
            break;
        }
        result += character;
        totalBytes += characterBytes;
    }
    return result;
};

export const normalizeEstProgramName = (projectTitle, slot) => {
    const fallback = fallbackProgramName(slot);
    let name = String(projectTitle || '')
        .replace(/\0/g, '')
        .trim();
    const parts = name.split(/[\\/]+/);
    name = (parts[parts.length - 1] || '')
        .trim()
        .replace(/\.ests$/i, '')
        .trim();
    if (!name) {
        return fallback;
    }
    const truncated = truncateUtf8(name, EST_PROGRAM_NAME_MAX_BYTES);
    return truncated || fallback;
};

export const buildEstProgramRequest = ({source, slot, projectTitle}) => ({
    source,
    slot,
    programName: normalizeEstProgramName(projectTitle, slot)
});
