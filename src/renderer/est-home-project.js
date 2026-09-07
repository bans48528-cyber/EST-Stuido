const HOME_PROJECT_LOAD_READY_STATES = new Set([
    'SHOWING_WITH_ID',
    'SHOWING_WITHOUT_ID'
]);

export const canLoadHomeProject = loadingState => (
    HOME_PROJECT_LOAD_READY_STATES.has(loadingState)
);

export const normalizeHomeProjectData = data => {
    if (data instanceof ArrayBuffer) return data;

    if (ArrayBuffer.isView(data)) {
        return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    }

    if (data && data.type === 'Buffer' && Array.isArray(data.data)) {
        return Uint8Array.from(data.data).buffer;
    }

    return data;
};
