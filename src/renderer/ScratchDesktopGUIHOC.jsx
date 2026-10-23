import {ipcRenderer, clipboard} from 'electron';
import {dialog} from '@electron/remote';
import * as remote from '@electron/remote/renderer';
import bindAll from 'lodash.bindall';
import omit from 'lodash.omit';
import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';
import GUIComponent from 'openblock-gui/src/components/gui/gui.jsx';
import {FormattedMessage} from 'react-intl';

import {
    LoadingStates,
    onFetchedProjectData,
    onLoadedProject,
    defaultProjectId,
    requestNewProject,
    requestProjectUpload,
    setProjectId
} from 'openblock-gui/src/reducers/project-state';
import {
    openLoadingProject,
    closeLoadingProject,
    openUpdateModal
} from 'openblock-gui/src/reducers/modals';
import {setUpdate} from 'openblock-gui/src/reducers/update';
import {setProjectChanged, setProjectUnchanged} from 'openblock-gui/src/reducers/project-changed';
import {setProjectTitle} from 'openblock-gui/src/reducers/project-title';
import {selectLocale} from 'openblock-gui/src/reducers/locales';

import MessageBoxType from 'openblock-gui/src/lib/message-box.js';

import showPrivacyPolicy from './showPrivacyPolicy';
import {getEstText} from './est-i18n';
import {HARDWARE_SWITCH_REQUEST_EVENT, switchHardwareWorkspace} from './hardware/project';
import {
    canLoadHomeProject,
    normalizeHomeProjectData
} from './est-home-project';
import {
    EST_HOME_NEW_PROJECT_EVENT,
    EST_HOME_OPEN_PROJECT_EVENT,
    EST_HOME_PROJECT_FAILED_EVENT,
    EST_HOME_PROJECT_OPENED_EVENT,
    EST_HOME_SET_LOCALE_EVENT,
    dispatchEstHomeEvent
} from './est-home-events';

const ignoreStorageInit = () => {};

/**
 * Higher-order component to add desktop logic to the GUI.
 * @param {Component} WrappedComponent - a GUI-like component to wrap.
 * @returns {Component} - a component similar to GUI with desktop-specific logic added.
 */
const ScratchDesktopGUIHOC = function (WrappedComponent) {
    class ScratchDesktopGUIComponent extends React.Component {
        constructor (props) {
            super(props);
            bindAll(this, [
                'handleHomeLocaleChange',
                'handleHomeNewProject',
                'handleHomeOpenProject',
                'handleHomeProjectLoad',
                'prepareHomeProjectLoad',
                'homeProjectCanReplaceCurrent',
                'handleSetTitleFromSave',
                'handleShowMessageBox',
                'handleUpdateProjectTitle'
            ]);
            this.pendingHomeProject = null;
            this.homeProjectLoadInProgress = false;
            this.handleHardwareSwitch = this.handleHardwareSwitch.bind(this);
            this.props.onLoadingStarted();
            ipcRenderer.invoke('get-initial-project-data').then(initialProjectData => {
                const hasInitialProject = initialProjectData && (initialProjectData.length > 0);
                this.props.onHasInitialProject(hasInitialProject, this.props.loadingState);
                if (!hasInitialProject) {
                    this.props.onLoadingCompleted();
                    ipcRenderer.send('loading-completed');
                    return;
                }
                this.props.vm.loadProject(initialProjectData).then(
                    () => {
                        this.props.onLoadingCompleted();
                        ipcRenderer.send('loading-completed');
                        this.props.onLoadedProject(this.props.loadingState, true);
                    },
                    e => {
                        this.props.onLoadingCompleted();
                        ipcRenderer.send('loading-completed');
                        this.props.onLoadedProject(this.props.loadingState, false);
                        dialog.showMessageBox(remote.getCurrentWindow(), {
                            type: 'error',
                            title: 'Failed to load project',
                            message: 'Invalid or corrupt project file.',
                            detail: e.message
                        });

                        // this effectively sets the default project ID
                        // TODO: maybe setting the default project ID should be implicit in `requestNewProject`
                        this.props.onHasInitialProject(false, this.props.loadingState);

                        // restart as if we didn't have an initial project to load
                        this.props.onRequestNewProject();
                    }
                );
            });
            ipcRenderer.send('set-locale', this.props.locale);
        }
        componentDidMount () {
            // replace navigator.clipboard.readText to Electron's clipboard.readText
            navigator.clipboard.readText = () => Promise.resolve(clipboard.readText());

            ipcRenderer.on('setTitleFromSave', this.handleSetTitleFromSave);
            ipcRenderer.on('setUpdate', (event, args) => {
                this.props.onSetUpdate(args);
            });
            ipcRenderer.on('setPlatform', (event, args) => {
                this.platform = args;
            });
            window.addEventListener(EST_HOME_NEW_PROJECT_EVENT, this.handleHomeNewProject);
            window.addEventListener(EST_HOME_OPEN_PROJECT_EVENT, this.handleHomeOpenProject);
            window.addEventListener(EST_HOME_SET_LOCALE_EVENT, this.handleHomeLocaleChange);
            window.addEventListener(HARDWARE_SWITCH_REQUEST_EVENT, this.handleHardwareSwitch);
        }
        componentDidUpdate (prevProps) {
            if (this.pendingHomeProject && this.props.loadingState !== prevProps.loadingState) {
                this.prepareHomeProjectLoad();
            }
        }
        componentWillUnmount () {
            ipcRenderer.removeListener('setTitleFromSave', this.handleSetTitleFromSave);
            window.removeEventListener(EST_HOME_NEW_PROJECT_EVENT, this.handleHomeNewProject);
            window.removeEventListener(EST_HOME_OPEN_PROJECT_EVENT, this.handleHomeOpenProject);
            window.removeEventListener(EST_HOME_SET_LOCALE_EVENT, this.handleHomeLocaleChange);
            window.removeEventListener(HARDWARE_SWITCH_REQUEST_EVENT, this.handleHardwareSwitch);
        }
        async handleHardwareSwitch (event) {
            const detail = event.detail;
            if (!detail) return;
            detail.handled = true;
            if (this.hardwareSwitchInProgress || this.homeProjectLoadInProgress ||
                !canLoadHomeProject(this.props.loadingState)) {
                detail.reject(new Error('HARDWARE_BUSY'));
                return;
            }
            this.hardwareSwitchInProgress = true;
            try {
                await switchHardwareWorkspace({vm: this.props.vm,
                    hardwareId: detail.hardwareId,
                    title: this.props.projectTitle,
                    setTitle: this.props.onSetProjectTitle});
                this.props.onHardwareProjectChanged();
                detail.resolve();
            } catch (error) {
                detail.reject(error);
            } finally {
                this.hardwareSwitchInProgress = false;
            }
        }
        handleHomeNewProject () {
            if (this.hardwareSwitchInProgress) return;
            if (!this.homeProjectCanReplaceCurrent()) return;
            this.props.onRequestNewProject();
            dispatchEstHomeEvent(EST_HOME_PROJECT_OPENED_EVENT);
        }
        handleHomeOpenProject (event) {
            if (this.hardwareSwitchInProgress) return;
            if (!event.detail || !event.detail.data) {
                dispatchEstHomeEvent(EST_HOME_PROJECT_FAILED_EVENT);
                return;
            }
            if (!this.homeProjectCanReplaceCurrent()) return;
            this.pendingHomeProject = Object.assign({}, event.detail, {
                data: normalizeHomeProjectData(event.detail.data)
            });
            this.prepareHomeProjectLoad();
        }
        prepareHomeProjectLoad () {
            if (!this.pendingHomeProject || this.homeProjectLoadInProgress ||
                !canLoadHomeProject(this.props.loadingState)) {
                return;
            }
            this.handleHomeProjectLoad();
        }
        handleHomeProjectLoad () {
            const project = this.pendingHomeProject;
            if (!project) return;
            this.pendingHomeProject = null;
            this.homeProjectLoadInProgress = true;
            this.props.onLoadingStarted();
            this.props.vm.loadProject(project.data)
                .then(() => {
                    this.props.onSetProjectTitle(project.title);
                    this.props.onFinishHomeProject(true);
                    dispatchEstHomeEvent(EST_HOME_PROJECT_OPENED_EVENT, {path: project.path});
                    window.setTimeout(() => {
                        ipcRenderer.invoke('est-home-capture-thumbnail', project.path).catch(() => {});
                    }, 300);
                })
                .catch(error => {
                    this.props.onFinishHomeProject(false);
                    dispatchEstHomeEvent(EST_HOME_PROJECT_FAILED_EVENT, {
                        message: error && error.message
                    });
                })
                .then(() => {
                    this.homeProjectLoadInProgress = false;
                });
        }
        handleHomeLocaleChange (event) {
            if (event.detail && event.detail.locale) {
                this.props.onSelectLocale(event.detail.locale);
            }
        }
        homeProjectCanReplaceCurrent () {
            if (!this.props.projectChanged) return true;
            return this.handleShowMessageBox(
                MessageBoxType.confirm,
                getEstText('home.replaceWarning', this.props.locale)
            );
        }
        handleClickAbout () {
            ipcRenderer.send('open-about-window');
        }
        handleClickLicense () {
            ipcRenderer.send('open-license-window');
        }
        handleClickUpdate () {
            ipcRenderer.send('reqeustUpdate');
        }
        handleAbortUpdate () {
            ipcRenderer.send('abortUpdate');
        }
        handleSetTitleFromSave (event, args) {
            this.handleUpdateProjectTitle(args.title);
        }
        handleUpdateProjectTitle (newTitle) {
            this.setState({projectTitle: newTitle});
        }
        handleShowMessageBox (type, message) {
            /**
             * To avoid the electron bug: the input-box lose focus after call alert or confirm on windows platform.
             * https://github.com/electron/electron/issues/19977
            */
            if (this.platform === 'win32') {
                let options;
                if (type === MessageBoxType.confirm) {
                    options = {
                        type: 'warning',
                        buttons: ['Ok', 'Cancel'],
                        message: message
                    };
                } else if (type === MessageBoxType.alert) {
                    options = {
                        type: 'error',
                        message: message
                    };
                }
                const result = dialog.showMessageBoxSync(remote.getCurrentWindow(), options);
                if (result === 0) {
                    return true;
                }
                return false;
            }
            if (type === 'confirm') {
                return confirm(message); // eslint-disable-line no-alert
            }
            return alert(message); // eslint-disable-line no-alert
        }
        render () {
            const childProps = omit(this.props, Object.keys(ScratchDesktopGUIComponent.propTypes));

            return (<WrappedComponent
                canSave={false}
                isScratchDesktop
                onClickAbout={[
                    {
                        title: (<FormattedMessage
                            defaultMessage="About"
                            description="Menu bar item for about"
                            id="gui.desktopMenuBar.about"
                        />),
                        onClick: () => this.handleClickAbout()
                    },
                    {
                        title: (<FormattedMessage
                            defaultMessage="License"
                            description="Menu bar item for license"
                            id="gui.desktopMenuBar.license"
                        />),
                        onClick: () => this.handleClickLicense()
                    },
                    {
                        title: (<FormattedMessage
                            defaultMessage="Privacy policy"
                            description="Menu bar item for privacy policy"
                            id="gui.menuBar.privacyPolicy"
                        />),
                        onClick: () => showPrivacyPolicy()
                    }
                ]}
                onClickLogo={this.handleClickLogo}
                onClickUpdate={this.handleClickUpdate}
                onAbortUpdate={this.handleAbortUpdate}
                onShowMessageBox={this.handleShowMessageBox}
                onStorageInit={ignoreStorageInit}
                onUpdateProjectTitle={this.handleUpdateProjectTitle}

                // allow passed-in props to override any of the above
                {...childProps}
            />);
        }
    }

    ScratchDesktopGUIComponent.propTypes = {
        loadingState: PropTypes.oneOf(LoadingStates),
        locale: PropTypes.string.isRequired,
        onFinishHomeProject: PropTypes.func,
        onHardwareProjectChanged: PropTypes.func,
        onFetchedInitialProjectData: PropTypes.func,
        onHasInitialProject: PropTypes.func,
        onLoadedProject: PropTypes.func,
        onLoadingCompleted: PropTypes.func,
        onLoadingStarted: PropTypes.func,
        onRequestNewProject: PropTypes.func,
        onSelectLocale: PropTypes.func,
        onSetProjectTitle: PropTypes.func,
        onSetUpdate: PropTypes.func,
        projectChanged: PropTypes.bool,
        projectTitle: PropTypes.string,
        // using PropTypes.instanceOf(VM) here will cause prop type warnings due to VM mismatch
        vm: GUIComponent.WrappedComponent.propTypes.vm
    };
    const mapStateToProps = state => {
        const loadingState = state.scratchGui.projectState.loadingState;
        return {
            loadingState: loadingState,
            locale: state.locales.locale,
            projectChanged: state.scratchGui.projectChanged,
            projectTitle: state.scratchGui.projectTitle,
            vm: state.scratchGui.vm
        };
    };
    const mapDispatchToProps = dispatch => ({
        onHardwareProjectChanged: () => dispatch(setProjectChanged()),
        onLoadingStarted: () => dispatch(openLoadingProject()),
        onLoadingCompleted: () => dispatch(closeLoadingProject()),
        onHasInitialProject: (hasInitialProject, loadingState) => {
            if (hasInitialProject) {
                // emulate sb-file-uploader
                return dispatch(requestProjectUpload(loadingState));
            }

            // `createProject()` might seem more appropriate but it's not a valid state transition here
            // setting the default project ID is a valid transition from NOT_LOADED and acts like "create new"
            return dispatch(setProjectId(defaultProjectId));
        },
        onFetchedInitialProjectData: (projectData, loadingState) =>
            dispatch(onFetchedProjectData(projectData, loadingState)),
        onLoadedProject: (loadingState, loadSuccess) => {
            const canSaveToServer = false;
            return dispatch(onLoadedProject(loadingState, canSaveToServer, loadSuccess));
        },
        onRequestNewProject: () => dispatch(requestNewProject(false)),
        onFinishHomeProject: success => {
            if (success) {
                window.setTimeout(() => dispatch(setProjectUnchanged()));
            }
            dispatch(closeLoadingProject());
        },
        onSelectLocale: locale => dispatch(selectLocale(locale)),
        onSetProjectTitle: title => dispatch(setProjectTitle(title)),
        onSetUpdate: arg => {
            dispatch(setUpdate(arg));
            dispatch(openUpdateModal());
        }
    });

    return connect(mapStateToProps, mapDispatchToProps)(ScratchDesktopGUIComponent);
};

export default ScratchDesktopGUIHOC;
