import React from 'react';
import {compose} from 'redux';
import {ipcRenderer} from 'electron';
import GUI from 'openblock-gui/src/containers/gui.jsx';

import AppStateHOC from 'openblock-gui/src/lib/app-state-hoc.jsx';

import EstAiPanel from './EstAiPanel.jsx';
import EstHome from './EstHome.jsx';
import {EST_VISION_OPEN_EVENT} from './est-vision/menu-events';
import {EST_LOCALE_CHANGED_EVENT, getCurrentEstLocale, getEstText} from './est-i18n';
import ScratchDesktopGUIHOC from './ScratchDesktopGUIHOC.jsx';
import {
    EST_HOME_PROJECT_OPENED_EVENT,
    EST_SHOW_HOME_EVENT
} from './est-home-events';
import styles from './app.css';
import HardwareGate from './hardware/HardwareGate.jsx';

const appTarget = document.getElementById('app');
appTarget.className = styles.app || 'app';

const HOME_TRANSITION_DURATION = 340;

GUI.setAppElement(appTarget);


// note that redux's 'compose' function is just being used as a general utility to make
// the hierarchy of HOC constructor calls clearer here; it has nothing to do with redux's
// ability to compose reducers.
const WrappedGui = compose(
    AppStateHOC,
    ScratchDesktopGUIHOC
)(GUI);

class EstDesktopApp extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            canReturnToEditor: false,
            homeMounted: true,
            homeVisible: true
        };
        this.handleEnterEditor = this.handleEnterEditor.bind(this);
        this.handleReturnToEditor = this.handleReturnToEditor.bind(this);
        this.handleShowHome = this.handleShowHome.bind(this);
        this.handleOpenVision = () => ipcRenderer.invoke('est-vision-window-open', getCurrentEstLocale())
            .catch(() => window.alert(getEstText('camera.error.window')));
        this.handleVisionLocale = () => ipcRenderer.invoke('est-vision-window-locale', getCurrentEstLocale())
            .catch(() => {});
    }

    componentDidMount () {
        window.addEventListener(EST_VISION_OPEN_EVENT, this.handleOpenVision);
        window.addEventListener(EST_LOCALE_CHANGED_EVENT, this.handleVisionLocale);
        window.addEventListener(EST_SHOW_HOME_EVENT, this.handleShowHome);
        window.addEventListener(EST_HOME_PROJECT_OPENED_EVENT, this.handleEnterEditor);
        ipcRenderer.invoke('est-home-get-startup-state')
            .then(state => {
                if (state && state.hasInitialProject) {
                    this.hideHome(false, () => {
                        if (state.projectPath) {
                            window.setTimeout(() => {
                                ipcRenderer.invoke('est-home-capture-thumbnail', state.projectPath).catch(() => {});
                            }, 300);
                        }
                    });
                }
            })
            .catch(() => {});
    }

    componentWillUnmount () {
        window.removeEventListener(EST_VISION_OPEN_EVENT, this.handleOpenVision);
        window.removeEventListener(EST_LOCALE_CHANGED_EVENT, this.handleVisionLocale);
        window.clearTimeout(this.homeTransitionTimer);
        window.cancelAnimationFrame(this.homeEnterFrame);
        window.removeEventListener(EST_SHOW_HOME_EVENT, this.handleShowHome);
        window.removeEventListener(EST_HOME_PROJECT_OPENED_EVENT, this.handleEnterEditor);
    }

    handleEnterEditor () {
        this.hideHome(true);
    }

    handleReturnToEditor () {
        this.hideHome(true);
    }

    handleShowHome () {
        window.clearTimeout(this.homeTransitionTimer);
        window.cancelAnimationFrame(this.homeEnterFrame);

        if (this.state.homeMounted) {
            this.setState({canReturnToEditor: true, homeVisible: true});
            return;
        }

        this.setState({
            canReturnToEditor: true,
            homeMounted: true,
            homeVisible: false
        }, () => {
            this.homeEnterFrame = window.requestAnimationFrame(() => {
                this.homeEnterFrame = window.requestAnimationFrame(() => {
                    this.homeEnterFrame = null;
                    this.setState({homeVisible: true});
                });
            });
        });
    }

    hideHome (canReturnToEditor, callback) {
        window.clearTimeout(this.homeTransitionTimer);
        window.cancelAnimationFrame(this.homeEnterFrame);
        this.homeEnterFrame = null;
        this.setState(state => ({
            canReturnToEditor: canReturnToEditor || state.canReturnToEditor,
            homeVisible: false
        }), () => {
            if (callback) callback();
            this.homeTransitionTimer = window.setTimeout(() => {
                this.homeTransitionTimer = null;
                if (!this.state.homeVisible) this.setState({homeMounted: false});
            }, HOME_TRANSITION_DURATION);
        });
    }

    render () {
        const editorClassName = [
            styles.editorShell,
            this.state.homeVisible ? styles.editorShellBehindHome : styles.editorShellActive
        ].join(' ');
        return (
            <React.Fragment>
                <div
                    className={editorClassName}
                    aria-hidden={this.state.homeVisible}
                >
                    <WrappedGui />
                    <HardwareGate feature="ai"><EstAiPanel visible={!this.state.homeMounted} /></HardwareGate>
                </div>
                {this.state.homeMounted ? (
                    <EstHome
                        canReturnToEditor={this.state.canReturnToEditor}
                        visible={this.state.homeVisible}
                        onOpenVision={this.handleOpenVision}
                        onReturnToEditor={this.handleReturnToEditor}
                    />
                ) : null}
            </React.Fragment>
        );
    }
}

export default <EstDesktopApp />;
