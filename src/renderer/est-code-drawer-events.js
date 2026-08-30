import ScratchBlocks from 'openblock-blocks';

const EST_CODE_DRAWER_REQUEST_STATE_EVENT = 'est-code-drawer-request-state';
const EST_CODE_DRAWER_STATE_EVENT = 'est-code-drawer-state';
const EST_CODE_DRAWER_TOGGLE_EVENT = 'est-code-drawer-toggle';

const createStateEvent = isOpen => new CustomEvent(EST_CODE_DRAWER_STATE_EVENT, {
    detail: {isOpen}
});

const publishCodeDrawerState = isOpen => {
    window.dispatchEvent(createStateEvent(isOpen));
};

const resizeBlocklyWorkspace = () => {
    try {
        const workspace = typeof ScratchBlocks.getMainWorkspace === 'function' ?
            ScratchBlocks.getMainWorkspace() :
            ScratchBlocks.mainWorkspace;
        if (!workspace) {
            return;
        }
        if (typeof ScratchBlocks.svgResize === 'function') {
            ScratchBlocks.svgResize(workspace);
        } else if (typeof workspace.resize === 'function') {
            workspace.resize();
        }
    } catch (e) {
        // Blockly may not be mounted yet when the menu first renders.
    }
};

export {
    EST_CODE_DRAWER_REQUEST_STATE_EVENT,
    EST_CODE_DRAWER_STATE_EVENT,
    EST_CODE_DRAWER_TOGGLE_EVENT,
    publishCodeDrawerState,
    resizeBlocklyWorkspace
};
