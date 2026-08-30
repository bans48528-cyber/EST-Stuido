import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';

import Box from 'openblock-gui/src/components/box/box.jsx';
import CodeEditor from 'openblock-gui/src/containers/code-editor.jsx';

import {
    EST_CODE_DRAWER_REQUEST_STATE_EVENT,
    EST_CODE_DRAWER_TOGGLE_EVENT,
    publishCodeDrawerState,
    resizeBlocklyWorkspace
} from './est-code-drawer-events';
import {getEstText} from './est-i18n';
import styles from './EstCodeDrawer.css';

import lockIcon from 'openblock-gui/src/components/hardware/icon--lock.svg';
import unlockIcon from 'openblock-gui/src/components/hardware/icon--unlock.svg';

const COLLAPSED_WIDTH = 0;
const DEFAULT_WIDTH = 480;
const MIN_WIDTH = 320;
const MIN_WORKSPACE_WIDTH = 600;
const MAX_WIDTH = 900;
const EDITOR_CHROME_WIDTH = 6;
const WIDTH_STORAGE_KEY = 'estStudio.pythonCodeDrawerWidth';

const clampDrawerWidth = width => {
    const availableWidth = Math.max(MIN_WIDTH, window.innerWidth - MIN_WORKSPACE_WIDTH);
    return Math.min(Math.max(width, MIN_WIDTH), Math.min(MAX_WIDTH, availableWidth));
};

const readStoredWidth = () => {
    try {
        const storedWidth = Number(window.localStorage.getItem(WIDTH_STORAGE_KEY));
        return clampDrawerWidth(Number.isFinite(storedWidth) && storedWidth > 0 ? storedWidth : DEFAULT_WIDTH);
    } catch (e) {
        return clampDrawerWidth(DEFAULT_WIDTH);
    }
};

class EstCodeDrawer extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            drawerWidth: readStoredWidth(),
            isOpen: false,
            isResizing: false
        };
        this.handleResizeMove = this.handleResizeMove.bind(this);
        this.handleResizeEnd = this.handleResizeEnd.bind(this);
        this.handleResizeStart = this.handleResizeStart.bind(this);
        this.handleResetWidth = this.handleResetWidth.bind(this);
        this.handleToggle = this.handleToggle.bind(this);
        this.handleWindowResize = this.handleWindowResize.bind(this);
        this.publishDrawerState = this.publishDrawerState.bind(this);
        this.scheduleLayoutRefresh = this.scheduleLayoutRefresh.bind(this);
    }

    componentDidMount () {
        window.addEventListener('resize', this.handleWindowResize);
        window.addEventListener(EST_CODE_DRAWER_TOGGLE_EVENT, this.handleToggle);
        window.addEventListener(EST_CODE_DRAWER_REQUEST_STATE_EVENT, this.publishDrawerState);
        this.publishDrawerState();
        this.scheduleLayoutRefresh();
    }

    componentWillUnmount () {
        window.removeEventListener('resize', this.handleWindowResize);
        window.removeEventListener(EST_CODE_DRAWER_TOGGLE_EVENT, this.handleToggle);
        window.removeEventListener(EST_CODE_DRAWER_REQUEST_STATE_EVENT, this.publishDrawerState);
        if (this.layoutFrame) {
            window.cancelAnimationFrame(this.layoutFrame);
        }
        this.removeResizeListeners();
        this.restoreDocumentInteraction();
    }

    storePreference (key, value) {
        try {
            window.localStorage.setItem(key, String(value));
        } catch (e) {
            // Preferences are optional when storage is unavailable.
        }
    }

    handleToggle () {
        this.setState(
            state => ({isOpen: !state.isOpen}),
            () => {
                this.publishDrawerState();
                this.scheduleLayoutRefresh();
            }
        );
    }

    handleResizeStart (event) {
        if (!this.state.isOpen) {
            return;
        }
        event.preventDefault();
        this.resizeStartX = event.clientX;
        this.resizeStartWidth = this.state.drawerWidth;
        this.pendingDrawerWidth = this.state.drawerWidth;
        document.addEventListener('mousemove', this.handleResizeMove);
        document.addEventListener('mouseup', this.handleResizeEnd);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        this.setState({isResizing: true});
    }

    handleResizeMove (event) {
        const nextWidth = clampDrawerWidth(
            this.resizeStartWidth + (this.resizeStartX - event.clientX)
        );
        this.pendingDrawerWidth = nextWidth;
        this.setState({drawerWidth: nextWidth}, this.scheduleLayoutRefresh);
    }

    handleResizeEnd () {
        this.removeResizeListeners();
        this.restoreDocumentInteraction();
        const drawerWidth = this.pendingDrawerWidth || this.state.drawerWidth;
        this.storePreference(WIDTH_STORAGE_KEY, drawerWidth);
        this.setState({isResizing: false}, this.scheduleLayoutRefresh);
    }

    handleResetWidth () {
        const drawerWidth = clampDrawerWidth(DEFAULT_WIDTH);
        this.pendingDrawerWidth = drawerWidth;
        this.storePreference(WIDTH_STORAGE_KEY, drawerWidth);
        this.setState({drawerWidth}, this.scheduleLayoutRefresh);
    }

    handleWindowResize () {
        this.setState(state => {
            const drawerWidth = clampDrawerWidth(state.drawerWidth);
            if (drawerWidth !== state.drawerWidth) {
                this.storePreference(WIDTH_STORAGE_KEY, drawerWidth);
                return {drawerWidth};
            }
            return null;
        });
    }

    removeResizeListeners () {
        document.removeEventListener('mousemove', this.handleResizeMove);
        document.removeEventListener('mouseup', this.handleResizeEnd);
    }

    restoreDocumentInteraction () {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }

    publishDrawerState () {
        publishCodeDrawerState(this.state.isOpen);
    }

    scheduleLayoutRefresh () {
        if (this.layoutFrame) {
            window.cancelAnimationFrame(this.layoutFrame);
        }
        this.layoutFrame = window.requestAnimationFrame(() => {
            this.layoutFrame = null;
            window.dispatchEvent(new Event('resize'));
            resizeBlocklyWorkspace();
            window.requestAnimationFrame(resizeBlocklyWorkspace);
        });
    }

    render () {
        const {
            codeEditorLanguage,
            codeEditorOptions,
            codeEditorTheme,
            codeEditorValue,
            isCodeEditorLocked,
            locale,
            onCodeEditorWillMount,
            onCodeEditorDidMount,
            onCodeEditorChange,
            onClickCodeEditorLock
        } = this.props;
        const {drawerWidth, isOpen, isResizing} = this.state;
        const visibleWidth = isOpen ? drawerWidth : COLLAPSED_WIDTH;
        const editorWidth = Math.max(1, drawerWidth - EDITOR_CHROME_WIDTH);
        const resizeLabel = getEstText('codeDrawer.resize', locale);

        return (
            <Box
                className={classNames(
                    styles.drawer,
                    isOpen ? styles.open : styles.collapsed,
                    isResizing && styles.resizing
                )}
                style={{
                    flexBasis: visibleWidth,
                    width: visibleWidth
                }}
            >
                <div
                    aria-label={resizeLabel}
                    aria-orientation="vertical"
                    className={styles.resizeHandle}
                    role="separator"
                    title={resizeLabel}
                    onDoubleClick={this.handleResetWidth}
                    onMouseDown={this.handleResizeStart}
                />
                <Box
                    aria-hidden={!isOpen}
                    className={styles.content}
                >
                    <Box className={styles.codeEditorWrapper}>
                        <button
                            className={classNames(styles.button, styles.lockButton)}
                            onClick={onClickCodeEditorLock}
                        >
                            <img
                                alt="Lock"
                                className={styles.lockIcon}
                                src={isCodeEditorLocked ? lockIcon : unlockIcon}
                            />
                        </button>
                        <CodeEditor
                            width={editorWidth}
                            value={codeEditorValue}
                            language={codeEditorLanguage}
                            editorWillMount={onCodeEditorWillMount}
                            editorDidMount={onCodeEditorDidMount}
                            onChange={onCodeEditorChange}
                            theme={codeEditorTheme}
                            options={codeEditorOptions}
                        />
                    </Box>
                </Box>
            </Box>
        );
    }
}

EstCodeDrawer.propTypes = {
    codeEditorLanguage: PropTypes.string,
    codeEditorOptions: PropTypes.shape({
        highlightActiveIndentGuide: PropTypes.bool,
        cursorSmoothCaretAnimation: PropTypes.bool,
        readOnly: PropTypes.bool,
        contextmenu: PropTypes.bool,
        minimap: PropTypes.shape({
            enabled: PropTypes.bool
        })
    }),
    codeEditorTheme: PropTypes.string,
    codeEditorValue: PropTypes.string,
    isCodeEditorLocked: PropTypes.bool,
    locale: PropTypes.string,
    onCodeEditorWillMount: PropTypes.func,
    onCodeEditorDidMount: PropTypes.func,
    onCodeEditorChange: PropTypes.func,
    onClickCodeEditorLock: PropTypes.func
};

const mapStateToProps = state => ({
    locale: state.locales.locale
});

export {
    EstCodeDrawer
};

export default connect(mapStateToProps)(EstCodeDrawer);
