import {getHardwareContext, HARDWARE_CHANGED_EVENT, HARDWARE_DRAFTS_DISCARDED_EVENT} from './context';

// Switching targets must not reuse EST's manually edited Python in another compiler.
export const attachHardwareCodeDrafts = editor => {
    const drafts = new Map();
    let id = getHardwareContext().profile.id;
    let loading = false;
    const changed = () => {
        const context = getHardwareContext();
        if (context.busy) {
            if (!loading) {
                drafts.set(id, {locked: editor.props.isCodeEditorLocked,
                    code: editor.props.codeEditorValue});
            }
            loading = true;
            return;
        }
        if (!loading && context.profile.id === id) return;
        loading = false;
        id = context.profile.id;
        const draft = drafts.get(id) || {locked: true};
        if (editor.props.isCodeEditorLocked !== draft.locked) editor.props.onToggleHardwareCodeLock();
        editor.props.onSetCodeEditorValue(draft.locked ? editor.workspaceToCode() : draft.code);
    };
    const discarded = () => {
        drafts.clear();
        id = getHardwareContext().profile.id;
        loading = false;
        if (!editor.props.isCodeEditorLocked) editor.props.onToggleHardwareCodeLock();
        editor.props.onSetCodeEditorValue(editor.workspaceToCode());
    };
    window.addEventListener(HARDWARE_CHANGED_EVENT, changed);
    window.addEventListener(HARDWARE_DRAFTS_DISCARDED_EVENT, discarded);
    return () => {
        window.removeEventListener(HARDWARE_CHANGED_EVENT, changed);
        window.removeEventListener(HARDWARE_DRAFTS_DISCARDED_EVENT, discarded);
    };
};
