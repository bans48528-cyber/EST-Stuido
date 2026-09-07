export const EST_SHOW_HOME_EVENT = 'est-show-home';
export const EST_HOME_NEW_PROJECT_EVENT = 'est-home-new-project';
export const EST_HOME_OPEN_PROJECT_EVENT = 'est-home-open-project';
export const EST_HOME_PROJECT_OPENED_EVENT = 'est-home-project-opened';
export const EST_HOME_PROJECT_FAILED_EVENT = 'est-home-project-failed';
export const EST_HOME_SET_LOCALE_EVENT = 'est-home-set-locale';

export const dispatchEstHomeEvent = (type, detail) => {
    if (typeof window === 'undefined' || typeof CustomEvent === 'undefined') {
        return;
    }
    window.dispatchEvent(new CustomEvent(type, {detail}));
};
