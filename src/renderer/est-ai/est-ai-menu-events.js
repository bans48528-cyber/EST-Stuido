export const EST_AI_OPEN_REQUEST_EVENT = 'est-ai-open-request';
export const EST_AI_MENU_STATE_EVENT = 'est-ai-menu-state';

export const dispatchEstAiOpenRequest = () => {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' &&
        typeof CustomEvent !== 'undefined') {
        window.dispatchEvent(new CustomEvent(EST_AI_OPEN_REQUEST_EVENT));
    }
};

export const dispatchEstAiMenuState = state => {
    if (typeof window === 'undefined') return;
    window.estAiMenuState = {
        visible: Boolean(state.visible),
        open: Boolean(state.open)
    };
    if (typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
        window.dispatchEvent(new CustomEvent(EST_AI_MENU_STATE_EVENT, {
            detail: window.estAiMenuState
        }));
    }
};
