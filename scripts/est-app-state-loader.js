/**
 * Remove Scratch Paint state initialization from the desktop application.
 * EST Studio has no costume editor, while project costume data continues to be
 * handled by the VM and storage layers independently of Scratch Paint Redux.
 * @param {string} source - OpenBlock app-state HOC source.
 * @returns {string} app-state HOC without Scratch Paint and player-mode setup.
 */
module.exports = function (source) {
    const guiStateSetup = `                const {
                    guiInitialState,
                    guiMiddleware,
                    initFullScreen,
                    initPlayer,
                    initTelemetryModal
                } = guiRedux;
                const {ScratchPaintReducer} = require('scratch-paint');

                let initializedGui = guiInitialState;
                if (props.isFullScreen || props.isPlayerOnly) {
                    if (props.isFullScreen) {
                        initializedGui = initFullScreen(initializedGui);
                    }
                    if (props.isPlayerOnly) {
                        initializedGui = initPlayer(initializedGui);
                    }
                } else if (props.showTelemetryModal) {
                    initializedGui = initTelemetryModal(initializedGui);
                }
                reducers = {
                    locales: localesReducer,
                    scratchGui: guiReducer,
                    scratchPaint: ScratchPaintReducer
                };
                initialState = {
                    locales: initializedLocales,
                    scratchGui: initializedGui
                };`;
    const localGuiStateSetup = `                const {guiInitialState, guiMiddleware} = guiRedux;
                reducers = {
                    locales: localesReducer,
                    scratchGui: guiReducer
                };
                initialState = {
                    locales: initializedLocales,
                    scratchGui: guiInitialState
                };`;
    const modeUpdateMethod = `        componentDidUpdate (prevProps) {
            if (localesOnly) return;
            if (prevProps.isPlayerOnly !== this.props.isPlayerOnly) {
                this.store.dispatch(setPlayer(this.props.isPlayerOnly));
            }
            if (prevProps.isFullScreen !== this.props.isFullScreen) {
                this.store.dispatch(setFullScreen(this.props.isFullScreen));
            }
        }
`;
    const requiredFragments = [
        "import {setPlayer, setFullScreen} from '../reducers/mode.js';\n",
        guiStateSetup,
        modeUpdateMethod
    ];
    const normalizedSource = source.replace(/\r\n/g, '\n');
    if (!requiredFragments.every(fragment => normalizedSource.includes(fragment))) {
        throw new Error('Unable to locate the OpenBlock Scratch Paint state initialization.');
    }

    return normalizedSource
        .replace("import {setPlayer, setFullScreen} from '../reducers/mode.js';\n", '')
        .replace(guiStateSetup, localGuiStateSetup)
        .replace(modeUpdateMethod, '');
};
