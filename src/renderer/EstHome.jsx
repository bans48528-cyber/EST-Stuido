/* eslint-disable react/jsx-no-bind */
import {ipcRenderer} from 'electron';
import PropTypes from 'prop-types';
import React from 'react';

import {version} from '../../package.json';
import {
    EST_LOCALE_CHANGED_EVENT,
    EST_LOCALE_NAMES,
    getCurrentEstLocale,
    getEstText,
    setCurrentEstLocale
} from './est-i18n';
import {
    EST_HOME_NEW_PROJECT_EVENT,
    EST_HOME_OPEN_PROJECT_EVENT,
    EST_HOME_PROJECT_FAILED_EVENT,
    EST_HOME_SET_LOCALE_EVENT,
    dispatchEstHomeEvent
} from './est-home-events';
import {
    EST_HOME_BUILD_CATEGORIES,
    EST_HOME_BUILD_ITEMS
} from './est-home-build-library';
import EST_HOME_BLOCK_GUIDE_CATEGORIES from './est-home-block-guide';
import createEstBlockPreviews from './est-home-block-previews';

import aiConversationGuide from './est-home-assets/home-guide-ai-conversation.png';
import aiSettingsGuide from './est-home-assets/home-guide-ai-settings.png';
import aiWelcomeGuide from './est-home-assets/home-guide-ai-welcome.png';
import buildIcon from './est-home-assets/home-icon-build.png';
import fileIcon from './est-home-assets/home-icon-file.png';
import moreIcon from './est-home-assets/home-icon-more.png';
import startIcon from './est-home-assets/home-icon-start.png';
import styles from './EstHome.css';

const NAV_ITEMS = [
    {id: 'files', icon: fileIcon, label: 'home.nav.files', labelColor: '#1d8ff5'},
    {id: 'build', icon: buildIcon, label: 'home.nav.build', labelColor: '#26aa63'},
    {id: 'more', icon: moreIcon, label: 'home.nav.more', labelColor: '#f06d55'}
];

const EVENT_BLOCK_PATH = [
    'm 0,0 c 25,-22 71,-22 96,0 H 172',
    'a 4,4 0 0,1 4,4 v 40',
    'a 4,4 0 0,1 -4,4 H 48',
    'c -2,0 -3,1 -4,2 l -4,4',
    'c -1,1 -2,2 -4,2 h -12',
    'c -2,0 -3,-1 -4,-2 l -4,-4',
    'c -1,-1 -2,-2 -4,-2 H 4',
    'a 4,4 0 0,1 -4,-4 z'
].join(' ');

const STACK_BLOCK_PATH = [
    'm 0,4 A 4,4 0 0,1 4,0 H 12',
    'c 2,0 3,1 4,2 l 4,4',
    'c 1,1 2,2 4,2 h 12',
    'c 2,0 3,-1 4,-2 l 4,-4',
    'c 1,-1 2,-2 4,-2 H 172',
    'a 4,4 0 0,1 4,4 v 40',
    'a 4,4 0 0,1 -4,4 H 48',
    'c -2,0 -3,1 -4,2 l -4,4',
    'c -1,1 -2,2 -4,2 h -12',
    'c -2,0 -3,-1 -4,-2 l -4,-4',
    'c -1,-1 -2,-2 -4,-2 H 4',
    'a 4,4 0 0,1 -4,-4 z'
].join(' ');

const INFO_ITEMS = [
    {id: 'interaction', title: 'home.more.interaction', subtitle: 'home.more.interactionSummary'},
    {id: 'hardware', title: 'home.more.hardware', subtitle: 'home.more.hardwareSummary'},
    {id: 'blocks', title: 'home.more.blocks', subtitle: 'home.more.blocksSummary'},
    {id: 'ai', title: 'home.more.ai', subtitle: 'home.more.aiSummary'},
    {id: 'software', title: 'home.more.software', subtitle: 'home.more.softwareSummary'},
    {id: 'about', title: 'home.more.about', subtitle: 'home.more.aboutSummary'}
];

const INFO_DIALOGS = {
    interaction: {
        lead: 'home.dialog.interaction.lead',
        sections: [
            {
                title: 'home.dialog.interaction.connectTitle',
                ordered: true,
                items: [
                    'home.dialog.interaction.connect1',
                    'home.dialog.interaction.connect2',
                    'home.dialog.interaction.connect3',
                    'home.dialog.interaction.connect4'
                ]
            },
            {
                title: 'home.dialog.interaction.programTitle',
                items: [
                    'home.dialog.interaction.program1',
                    'home.dialog.interaction.program2',
                    'home.dialog.interaction.program3',
                    'home.dialog.interaction.program4'
                ]
            },
            {
                title: 'home.dialog.interaction.feedbackTitle',
                items: [
                    'home.dialog.interaction.feedback1',
                    'home.dialog.interaction.feedback2',
                    'home.dialog.interaction.feedback3'
                ],
                note: 'home.dialog.interaction.feedbackNote'
            },
            {
                title: 'home.dialog.interaction.troubleshootTitle',
                items: [
                    'home.dialog.interaction.troubleshoot1',
                    'home.dialog.interaction.troubleshoot2',
                    'home.dialog.interaction.troubleshoot3'
                ]
            }
        ]
    },
    hardware: {
        lead: 'home.dialog.hardware.lead',
        sections: [
            {
                title: 'home.dialog.hardware.controllerTitle',
                items: [
                    'home.dialog.hardware.controller1',
                    'home.dialog.hardware.controller2',
                    'home.dialog.hardware.controller3'
                ]
            },
            {
                title: 'home.dialog.hardware.outputTitle',
                items: [
                    'home.dialog.hardware.output1',
                    'home.dialog.hardware.output2',
                    'home.dialog.hardware.output3'
                ]
            },
            {
                title: 'home.dialog.hardware.sensorTitle',
                items: [
                    'home.dialog.hardware.sensor1',
                    'home.dialog.hardware.sensor2',
                    'home.dialog.hardware.sensor3',
                    'home.dialog.hardware.sensor4'
                ]
            },
            {
                title: 'home.dialog.hardware.firmwareTitle',
                ordered: true,
                items: [
                    'home.dialog.hardware.firmware1',
                    'home.dialog.hardware.firmware2',
                    'home.dialog.hardware.firmware3',
                    'home.dialog.hardware.firmware4',
                    'home.dialog.hardware.firmware5',
                    'home.dialog.hardware.firmware6',
                    'home.dialog.hardware.firmware7'
                ],
                note: 'home.dialog.hardware.firmwareNote'
            },
            {
                title: 'home.dialog.hardware.careTitle',
                items: [
                    'home.dialog.hardware.care1',
                    'home.dialog.hardware.care2',
                    'home.dialog.hardware.care3'
                ],
                note: 'home.dialog.hardware.careNote'
            }
        ]
    },
    blocks: {
        lead: 'home.dialog.blocks.lead'
    },
    ai: {
        lead: 'home.dialog.ai.lead',
        sections: [
            {
                title: 'home.dialog.ai.openTitle',
                image: aiWelcomeGuide,
                imageAlt: 'home.dialog.ai.openImageAlt',
                caption: 'home.dialog.ai.openImageCaption',
                items: [
                    'home.dialog.ai.open1',
                    'home.dialog.ai.open2',
                    'home.dialog.ai.open3'
                ]
            },
            {
                title: 'home.dialog.ai.setupTitle',
                image: aiSettingsGuide,
                imageAlt: 'home.dialog.ai.setupImageAlt',
                caption: 'home.dialog.ai.setupImageCaption',
                ordered: true,
                items: [
                    'home.dialog.ai.setup1',
                    'home.dialog.ai.setup2',
                    'home.dialog.ai.setup3',
                    'home.dialog.ai.setup4',
                    'home.dialog.ai.setup5'
                ],
                note: 'home.dialog.ai.setupNote'
            },
            {
                title: 'home.dialog.ai.promptTitle',
                items: [
                    'home.dialog.ai.prompt1',
                    'home.dialog.ai.prompt2',
                    'home.dialog.ai.prompt3',
                    'home.dialog.ai.prompt4'
                ]
            },
            {
                title: 'home.dialog.ai.applyTitle',
                image: aiConversationGuide,
                imageAlt: 'home.dialog.ai.applyImageAlt',
                caption: 'home.dialog.ai.applyImageCaption',
                ordered: true,
                items: [
                    'home.dialog.ai.apply1',
                    'home.dialog.ai.apply2',
                    'home.dialog.ai.apply3',
                    'home.dialog.ai.apply4',
                    'home.dialog.ai.apply5'
                ],
                note: 'home.dialog.ai.applyNote'
            },
            {
                title: 'home.dialog.ai.scopeTitle',
                items: [
                    'home.dialog.ai.scope1',
                    'home.dialog.ai.scope2',
                    'home.dialog.ai.scope3',
                    'home.dialog.ai.scope4'
                ]
            },
            {
                title: 'home.dialog.ai.privacyTitle',
                items: [
                    'home.dialog.ai.privacy1',
                    'home.dialog.ai.privacy2',
                    'home.dialog.ai.privacy3'
                ],
                note: 'home.dialog.ai.privacyNote'
            },
            {
                title: 'home.dialog.ai.troubleshootTitle',
                items: [
                    'home.dialog.ai.troubleshoot1',
                    'home.dialog.ai.troubleshoot2',
                    'home.dialog.ai.troubleshoot3',
                    'home.dialog.ai.troubleshoot4'
                ]
            }
        ]
    },
    software: {
        lead: 'home.dialog.software.lead',
        sections: [
            {
                title: 'home.dialog.software.fileTitle',
                items: [
                    'home.dialog.software.file1',
                    'home.dialog.software.file2',
                    'home.dialog.software.file3'
                ]
            },
            {
                title: 'home.dialog.software.workspaceTitle',
                items: [
                    'home.dialog.software.workspace1',
                    'home.dialog.software.workspace2',
                    'home.dialog.software.workspace3'
                ]
            },
            {
                title: 'home.dialog.software.updateTitle',
                items: [
                    'home.dialog.software.update1',
                    'home.dialog.software.update2',
                    'home.dialog.software.update3'
                ],
                note: 'home.dialog.software.updateNote'
            }
        ]
    },
    about: {
        lead: 'home.dialog.about.lead',
        sections: [
            {
                title: 'home.dialog.about.purposeTitle',
                items: [
                    'home.dialog.about.purpose1',
                    'home.dialog.about.purpose2',
                    'home.dialog.about.purpose3'
                ]
            },
            {
                title: 'home.dialog.about.foundationTitle',
                items: [
                    'home.dialog.about.foundation2',
                    'home.dialog.about.foundation3'
                ]
            },
            {
                title: 'home.dialog.about.supportTitle',
                items: [
                    'home.dialog.about.support1',
                    'home.dialog.about.support2',
                    'home.dialog.about.support3'
                ],
                note: 'home.dialog.about.supportNote'
            }
        ]
    }
};

const FILE_ACCENTS = ['blue', 'green', 'orange', 'cyan'];

class EstHome extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            activeView: 'files',
            blockPreviewLocale: null,
            blockPreviews: {},
            blockPreviewsLoading: false,
            buildCategory: 'basic',
            buildDownloadActive: false,
            buildDownloadCancelling: false,
            buildDownloadPaused: false,
            buildDownloadProgress: null,
            buildItems: EST_HOME_BUILD_ITEMS,
            buildLibraryInstalled: false,
            buildThumbnails: {},
            buildTotalItems: 42,
            dialogId: null,
            locale: getCurrentEstLocale(),
            menuPath: null,
            notice: '',
            recentFiles: [],
            renameTarget: null,
            renameValue: ''
        };
        this.handleLocaleChanged = this.handleLocaleChanged.bind(this);
        this.handleBuildDownloadProgress = this.handleBuildDownloadProgress.bind(this);
        this.handleProjectFailed = this.handleProjectFailed.bind(this);
        this.handleWindowKeyDown = this.handleWindowKeyDown.bind(this);
    }

    componentDidMount () {
        window.addEventListener(EST_LOCALE_CHANGED_EVENT, this.handleLocaleChanged);
        window.addEventListener(EST_HOME_PROJECT_FAILED_EVENT, this.handleProjectFailed);
        window.addEventListener('keydown', this.handleWindowKeyDown);
        ipcRenderer.on('est-home-build-download-progress', this.handleBuildDownloadProgress);
        this.loadRecentFiles();
        this.loadBuildLibrary();
    }

    componentWillUnmount () {
        this.blockPreviewRequest = (this.blockPreviewRequest || 0) + 1;
        window.removeEventListener(EST_LOCALE_CHANGED_EVENT, this.handleLocaleChanged);
        window.removeEventListener(EST_HOME_PROJECT_FAILED_EVENT, this.handleProjectFailed);
        window.removeEventListener('keydown', this.handleWindowKeyDown);
        ipcRenderer.removeListener('est-home-build-download-progress', this.handleBuildDownloadProgress);
        window.clearTimeout(this.noticeTimer);
    }

    text (id, values) {
        return getEstText(id, this.state.locale, values);
    }

    handleLocaleChanged (event) {
        const locale = event.detail && event.detail.locale ? event.detail.locale : getCurrentEstLocale();
        this.setState({
            blockPreviewLocale: null,
            blockPreviews: {},
            locale
        }, () => {
            if (this.state.dialogId === 'blocks') this.loadBlockPreviews();
        });
    }

    handleProjectFailed (event) {
        const message = event.detail && event.detail.message;
        this.showNotice(message || this.text('home.openFailed'));
    }

    handleBuildDownloadProgress (event, progress) {
        this.setState({
            buildDownloadActive: progress && progress.phase !== 'complete',
            buildDownloadCancelling: Boolean(progress && progress.cancelled),
            buildDownloadPaused: Boolean(progress && progress.paused),
            buildDownloadProgress: progress || null
        });
    }

    handleWindowKeyDown (event) {
        if (event.key === 'Escape') {
            this.setState({dialogId: null, menuPath: null, renameTarget: null});
        }
    }

    async loadRecentFiles () {
        try {
            const recentFiles = await ipcRenderer.invoke('est-home-list-recent-projects');
            this.setState({recentFiles: Array.isArray(recentFiles) ? recentFiles : []});
        } catch (error) {
            this.setState({recentFiles: []});
        }
    }

    async loadBuildLibrary () {
        try {
            const library = await ipcRenderer.invoke('est-home-get-build-library-state');
            this.setState({
                buildItems: Array.isArray(library.items) ? library.items : EST_HOME_BUILD_ITEMS,
                buildLibraryInstalled: Boolean(library.installed),
                buildThumbnails: library.thumbnails || {},
                buildTotalItems: library.totalItemCount || 42
            });
        } catch (error) {
            this.setState({
                buildItems: EST_HOME_BUILD_ITEMS,
                buildLibraryInstalled: false,
                buildThumbnails: {}
            });
        }
    }

    loadBlockPreviews () {
        const locale = this.state.locale;
        if (this.state.blockPreviewLocale === locale && Object.keys(this.state.blockPreviews).length) return;
        const requestId = (this.blockPreviewRequest || 0) + 1;
        this.blockPreviewRequest = requestId;
        this.setState({
            blockPreviewLocale: locale,
            blockPreviews: {},
            blockPreviewsLoading: true
        });
        createEstBlockPreviews(locale, previewBatch => {
            if (this.blockPreviewRequest !== requestId || this.state.locale !== locale) return;
            this.setState(state => ({
                blockPreviews: Object.assign({}, state.blockPreviews, previewBatch)
            }));
        }).then(blockPreviews => {
            if (this.blockPreviewRequest !== requestId || this.state.locale !== locale) return;
            this.setState({
                blockPreviews,
                blockPreviewsLoading: false
            });
        })
            .catch(() => {
                if (this.blockPreviewRequest !== requestId) return;
                this.setState({blockPreviewsLoading: false});
            });
    }

    openInfoDialog (dialogId) {
        this.setState({dialogId}, () => {
            if (dialogId === 'blocks') this.loadBlockPreviews();
        });
    }

    async downloadBuildLibrary () {
        if (this.state.buildDownloadActive) return;
        this.buildDownloadWasCancelled = false;
        this.setState({
            buildDownloadActive: true,
            buildDownloadCancelling: false,
            buildDownloadPaused: false,
            buildDownloadProgress: {phase: 'checking', percent: 0}
        });
        try {
            const library = await ipcRenderer.invoke('est-home-download-build-library');
            if (library && library.cancelled) {
                this.setState({
                    buildDownloadActive: false,
                    buildDownloadCancelling: false,
                    buildDownloadPaused: false,
                    buildDownloadProgress: null
                });
                this.showNotice(this.text('home.build.downloadCancelled'));
                return;
            }
            this.setState({
                buildDownloadActive: false,
                buildDownloadCancelling: false,
                buildDownloadPaused: false,
                buildDownloadProgress: {phase: 'complete', percent: 100},
                buildItems: Array.isArray(library.items) ? library.items : EST_HOME_BUILD_ITEMS,
                buildLibraryInstalled: Boolean(library.installed),
                buildThumbnails: library.thumbnails || {},
                buildTotalItems: library.totalItemCount || 42
            });
            this.showNotice(this.text('home.build.downloadComplete'));
        } catch (error) {
            this.setState({
                buildDownloadActive: false,
                buildDownloadCancelling: false,
                buildDownloadPaused: false,
                buildDownloadProgress: null
            });
            this.showNotice(this.text(this.buildDownloadWasCancelled ?
                'home.build.downloadCancelled' :
                'home.build.downloadFailed'));
        } finally {
            this.buildDownloadWasCancelled = false;
        }
    }

    async toggleBuildLibraryDownloadPause () {
        if (!this.state.buildDownloadActive || this.state.buildDownloadCancelling) return;
        const channel = this.state.buildDownloadPaused ?
            'est-home-resume-build-library-download' :
            'est-home-pause-build-library-download';
        const state = await ipcRenderer.invoke(channel);
        if (state && state.active) this.setState({buildDownloadPaused: Boolean(state.paused)});
    }

    async cancelBuildLibraryDownload () {
        if (!this.state.buildDownloadActive || this.state.buildDownloadCancelling) return;
        this.buildDownloadWasCancelled = true;
        this.setState({buildDownloadCancelling: true, buildDownloadPaused: false});
        const state = await ipcRenderer.invoke('est-home-cancel-build-library-download');
        if (!state || !state.active) {
            this.buildDownloadWasCancelled = false;
            this.setState({buildDownloadActive: false, buildDownloadCancelling: false});
        }
    }

    async openBuildGuide (item) {
        try {
            await ipcRenderer.invoke('est-home-open-build-guide', item.id);
        } catch (error) {
            this.showNotice(this.text('home.build.openFailed'));
        }
    }

    showNotice (notice) {
        window.clearTimeout(this.noticeTimer);
        this.setState({notice});
        this.noticeTimer = window.setTimeout(() => this.setState({notice: ''}), 2400);
    }

    startNewProject () {
        dispatchEstHomeEvent(EST_HOME_NEW_PROJECT_EVENT);
    }

    async openRecentProject (projectPath) {
        this.setState({menuPath: null});
        try {
            const project = await ipcRenderer.invoke('est-home-open-project', projectPath);
            if (project) {
                dispatchEstHomeEvent(EST_HOME_OPEN_PROJECT_EVENT, project);
            }
        } catch (error) {
            this.showNotice(this.text('home.openFailed'));
            this.loadRecentFiles();
        }
    }

    async removeRecentProject (projectPath) {
        await ipcRenderer.invoke('est-home-remove-recent-project', projectPath);
        this.setState({menuPath: null});
        this.loadRecentFiles();
    }

    beginRename (project) {
        this.setState({
            menuPath: null,
            renameTarget: project,
            renameValue: project.name
        });
    }

    async confirmRename () {
        const {renameTarget, renameValue} = this.state;
        if (!renameTarget) return;
        try {
            await ipcRenderer.invoke('est-home-rename-project', {
                path: renameTarget.path,
                name: renameValue
            });
            this.setState({renameTarget: null, renameValue: ''});
            this.loadRecentFiles();
        } catch (error) {
            this.showNotice(error && error.message ? error.message : this.text('home.renameFailed'));
        }
    }

    async copyProject (projectPath) {
        this.setState({menuPath: null});
        try {
            await ipcRenderer.invoke('est-home-copy-project', projectPath);
            this.showNotice(this.text('home.copyDone'));
            this.loadRecentFiles();
        } catch (error) {
            this.showNotice(this.text('home.copyFailed'));
        }
    }

    changeLocale (event) {
        const locale = setCurrentEstLocale(event.target.value);
        ipcRenderer.send('set-locale', locale);
        dispatchEstHomeEvent(EST_HOME_SET_LOCALE_EVENT, {locale});
        this.setState({locale});
    }

    formatModifiedTime (value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleString(this.state.locale, {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    renderFileCard (project, index) {
        const menuOpen = this.state.menuPath === project.path;
        const accentClass = styles[`fileAccent${FILE_ACCENTS[index % FILE_ACCENTS.length]}`];
        return (
            <article
                className={styles.fileCard}
                key={project.path}
            >
                <div className={styles.fileThumbnailWrap}>
                    <button
                        className={`${styles.fileThumbnail} ${accentClass}`}
                        type="button"
                        aria-label={`${this.text('home.open')} ${project.name}`}
                        onClick={() => this.openRecentProject(project.path)}
                    >
                        <img
                            alt=""
                            className={project.thumbnail ? styles.fileScreenshot : styles.filePlaceholderIcon}
                            src={project.thumbnail || fileIcon}
                        />
                    </button>
                    <button
                        className={styles.fileMenuButton}
                        type="button"
                        aria-label={`${project.name} ${this.text('home.fileActions')}`}
                        aria-expanded={menuOpen}
                        onClick={event => {
                            event.stopPropagation();
                            this.setState({menuPath: menuOpen ? null : project.path});
                        }}
                    >
                        <span />
                        <span />
                        <span />
                    </button>
                    {menuOpen ? (
                        <div
                            className={styles.fileMenu}
                            role="menu"
                        >
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => this.removeRecentProject(project.path)}
                            >
                                {this.text('home.delete')}
                            </button>
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => this.beginRename(project)}
                            >
                                {this.text('home.rename')}
                            </button>
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => this.copyProject(project.path)}
                            >
                                {this.text('home.copy')}
                            </button>
                        </div>
                    ) : null}
                </div>
                <strong title={project.name}>{project.name}</strong>
                <small>{this.formatModifiedTime(project.modifiedAt)}</small>
            </article>
        );
    }

    renderProgramStack (theme) {
        const textPrefix = `home.animation.${theme}`;
        return (
            <div className={styles.programStack}>
                <div className={`${styles.programBlock} ${styles.eventProgramBlock}`}>
                    <svg
                        className={styles.blockShape}
                        viewBox="0 -18 176 74"
                        preserveAspectRatio="none"
                    >
                        <path d={EVENT_BLOCK_PATH} />
                    </svg>
                    <span className={`${styles.blockSymbol} ${styles.eventBlockSymbol}`} />
                    <span className={styles.programBlockText}>{this.text(`${textPrefix}.event`)}</span>
                </div>
                <div className={`${styles.programBlock} ${styles.motorProgramBlock}`}>
                    <svg
                        className={styles.blockShape}
                        viewBox="0 0 176 56"
                        preserveAspectRatio="none"
                    >
                        <path d={STACK_BLOCK_PATH} />
                    </svg>
                    <span className={`${styles.blockSymbol} ${styles.motorBlockSymbol}`}>
                        <span />
                    </span>
                    <span className={styles.programBlockText}>{this.text(`${textPrefix}.action`)}</span>
                </div>
                <div className={`${styles.programBlock} ${styles.displayProgramBlock}`}>
                    <svg
                        className={styles.blockShape}
                        viewBox="0 0 176 56"
                        preserveAspectRatio="none"
                    >
                        <path d={STACK_BLOCK_PATH} />
                    </svg>
                    <span className={`${styles.blockSymbol} ${styles.displayBlockSymbol}`}>
                        <span />
                        <span />
                    </span>
                    <span className={styles.programBlockText}>{this.text(`${textPrefix}.result`)}</span>
                </div>
                <span className={styles.executionPulse} />
            </div>
        );
    }

    renderArmVisual () {
        return (
            <div className={styles.themeVisual}>
                <span className={`${styles.themePlate} ${styles.themePlateBack}`} />
                <span className={`${styles.themePlate} ${styles.themePlateFront}`} />
                <svg
                    className={styles.themeMachine}
                    viewBox="0 0 190 150"
                >
                    <defs>
                        <linearGradient
                            id="est-home-arm-shell"
                            x1="0"
                            y1="0"
                            x2="1"
                            y2="1"
                        >
                            <stop
                                offset="0"
                                stopColor="#ffffff"
                            />
                            <stop
                                offset="1"
                                stopColor="#ffe9df"
                            />
                        </linearGradient>
                    </defs>
                    <ellipse
                        className={styles.machineGround}
                        cx="96"
                        cy="134"
                        rx="62"
                        ry="6"
                    />
                    <rect
                        x="45"
                        y="111"
                        width="99"
                        height="20"
                        rx="10"
                        fill="url(#est-home-arm-shell)"
                    />
                    <rect
                        x="57"
                        y="116"
                        width="75"
                        height="8"
                        rx="4"
                        fill="#ff8a61"
                        opacity="0.78"
                    />
                    <circle
                        cx="72"
                        cy="103"
                        r="17"
                        fill="url(#est-home-arm-shell)"
                    />
                    <circle
                        cx="72"
                        cy="103"
                        r="7"
                        fill="#ff8a61"
                    />
                    <g className={styles.armLift}>
                        <path
                            d="M72 101 L96 67"
                            stroke="#fff9f4"
                            strokeWidth="18"
                            strokeLinecap="round"
                        />
                        <path
                            d="M72 101 L96 67"
                            stroke="#ffc0a8"
                            strokeWidth="6"
                            strokeLinecap="round"
                        />
                        <circle
                            cx="96"
                            cy="67"
                            r="13"
                            fill="url(#est-home-arm-shell)"
                        />
                        <circle
                            cx="96"
                            cy="67"
                            r="5"
                            fill="#ff8a61"
                        />
                        <g className={styles.armForearm}>
                            <path
                                d="M97 65 L132 51"
                                stroke="#fff9f4"
                                strokeWidth="16"
                                strokeLinecap="round"
                            />
                            <path
                                d="M97 65 L132 51"
                                stroke="#ffc0a8"
                                strokeWidth="5"
                                strokeLinecap="round"
                            />
                            <circle
                                cx="132"
                                cy="51"
                                r="10"
                                fill="url(#est-home-arm-shell)"
                            />
                            <g className={styles.armClaw}>
                                <path
                                    className={styles.armClawTop}
                                    d="M139 46 L154 39 L158 44 L146 52"
                                    fill="none"
                                    stroke="#fff9f4"
                                    strokeWidth="7"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                                <path
                                    className={styles.armClawBottom}
                                    d="M139 56 L154 63 L158 58 L146 50"
                                    fill="none"
                                    stroke="#fff9f4"
                                    strokeWidth="7"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </g>
                        </g>
                    </g>
                    <circle
                        className={styles.armStatusLight}
                        cx="135"
                        cy="119"
                        r="5"
                    />
                </svg>
                <span className={styles.themeName}>{this.text('home.animation.arm.title')}</span>
            </div>
        );
    }

    renderRobotVisual () {
        return (
            <div className={styles.themeVisual}>
                <span className={`${styles.themePlate} ${styles.themePlateBack}`} />
                <span className={`${styles.themePlate} ${styles.themePlateFront}`} />
                <svg
                    className={styles.themeMachine}
                    viewBox="0 0 190 150"
                >
                    <defs>
                        <linearGradient
                            id="est-home-robot-shell"
                            x1="0"
                            y1="0"
                            x2="1"
                            y2="1"
                        >
                            <stop
                                offset="0"
                                stopColor="#ffffff"
                            />
                            <stop
                                offset="1"
                                stopColor="#ddfff2"
                            />
                        </linearGradient>
                    </defs>
                    <ellipse
                        className={styles.machineGround}
                        cx="96"
                        cy="136"
                        rx="58"
                        ry="6"
                    />
                    <path
                        d="M95 28 V17"
                        stroke="#eafff7"
                        strokeWidth="6"
                        strokeLinecap="round"
                    />
                    <circle
                        cx="95"
                        cy="13"
                        r="7"
                        fill="#70efba"
                    />
                    <rect
                        x="53"
                        y="27"
                        width="84"
                        height="49"
                        rx="16"
                        fill="url(#est-home-robot-shell)"
                    />
                    <rect
                        x="65"
                        y="39"
                        width="60"
                        height="25"
                        rx="9"
                        fill="#c9f8e6"
                    />
                    <circle
                        cx="82"
                        cy="50"
                        r="4"
                        fill="#1f6c59"
                    />
                    <circle
                        cx="108"
                        cy="50"
                        r="4"
                        fill="#1f6c59"
                    />
                    <path
                        className={styles.robotSmile}
                        d="M87 57 Q95 65 103 57"
                        fill="none"
                        stroke="#1f6c59"
                        strokeWidth="3"
                        strokeLinecap="round"
                    />
                    <path
                        className={styles.robotNeutralMouth}
                        d="M88 59 H102"
                        fill="none"
                        stroke="#1f6c59"
                        strokeWidth="3"
                        strokeLinecap="round"
                    />
                    <rect
                        x="66"
                        y="78"
                        width="58"
                        height="45"
                        rx="14"
                        fill="url(#est-home-robot-shell)"
                    />
                    <circle
                        className={styles.robotStatusLight}
                        cx="95"
                        cy="92"
                        r="6"
                    />
                    <circle
                        cx="84"
                        cy="108"
                        r="4"
                        fill="#70efba"
                    />
                    <circle
                        cx="106"
                        cy="108"
                        r="4"
                        fill="#70efba"
                    />
                    <g className={styles.robotWaveArm}>
                        <path
                            d="M69 85 L45 70"
                            stroke="#f6fffb"
                            strokeWidth="12"
                            strokeLinecap="round"
                        />
                        <circle
                            cx="40"
                            cy="66"
                            r="8"
                            fill="#e8fff6"
                        />
                    </g>
                    <path
                        d="M122 85 L143 101"
                        stroke="#f6fffb"
                        strokeWidth="12"
                        strokeLinecap="round"
                    />
                    <circle
                        cx="147"
                        cy="105"
                        r="8"
                        fill="#e8fff6"
                    />
                    <path
                        d="M81 122 V134"
                        stroke="#f6fffb"
                        strokeWidth="12"
                        strokeLinecap="round"
                    />
                    <path
                        d="M109 122 V134"
                        stroke="#f6fffb"
                        strokeWidth="12"
                        strokeLinecap="round"
                    />
                </svg>
                <span className={styles.themeName}>{this.text('home.animation.robot.title')}</span>
            </div>
        );
    }

    renderCarVisual () {
        return (
            <div className={styles.themeVisual}>
                <span className={`${styles.themePlate} ${styles.themePlateBack}`} />
                <span className={`${styles.themePlate} ${styles.themePlateFront}`} />
                <svg
                    className={styles.themeMachine}
                    viewBox="0 0 190 150"
                >
                    <defs>
                        <linearGradient
                            id="est-home-car-shell"
                            x1="0"
                            y1="0"
                            x2="1"
                            y2="1"
                        >
                            <stop
                                offset="0"
                                stopColor="#ffffff"
                            />
                            <stop
                                offset="1"
                                stopColor="#bcdcff"
                            />
                        </linearGradient>
                        <linearGradient
                            id="est-home-car-glass"
                            x1="0"
                            y1="0"
                            x2="1"
                            y2="1"
                        >
                            <stop
                                offset="0"
                                stopColor="#1d5a8a"
                            />
                            <stop
                                offset="1"
                                stopColor="#51dcf5"
                            />
                        </linearGradient>
                    </defs>
                    <ellipse
                        className={styles.machineGround}
                        cx="96"
                        cy="128"
                        rx="69"
                        ry="6"
                    />
                    <g className={styles.carMotion}>
                        <path
                            d="M28 91 L42 73 L72 65 L88 43 H128 L151 65 L169 80 L164 103 H29 Z"
                            fill="url(#est-home-car-shell)"
                        />
                        <path
                            d="M91 49 H124 L142 65 H77 Z"
                            fill="url(#est-home-car-glass)"
                        />
                        <path
                            d="M84 43 L76 61 H67 L73 45 Z"
                            fill="#4dbff7"
                            opacity="0.84"
                        />
                        <path
                            d="M42 76 H147 L160 84 L155 99 H35 Z"
                            fill="#2c5d8e"
                        />
                        <path
                            d="M49 82 H137"
                            fill="none"
                            stroke="#72e8ff"
                            strokeWidth="5"
                            strokeLinecap="round"
                        />
                        <path
                            d="M151 72 L166 80 L162 87 H150 Z"
                            fill="#d9f8ff"
                            stroke="#7dcff7"
                            strokeWidth="2"
                        />
                        <circle
                            cx="109"
                            cy="57"
                            r="3"
                            fill="#d9fbff"
                        />
                        <circle
                            cx="119"
                            cy="57"
                            r="3"
                            fill="#d9fbff"
                        />
                        <circle
                            className={styles.carStatusLight}
                            cx="156"
                            cy="82"
                            r="6"
                        />
                        <g className={`${styles.carWheel} ${styles.carWheelLeft}`}>
                            <circle
                                cx="56"
                                cy="106"
                                r="20"
                                fill="#18344e"
                            />
                            <circle
                                cx="56"
                                cy="106"
                                r="13"
                                fill="#57c9ff"
                            />
                            <circle
                                cx="56"
                                cy="106"
                                r="8"
                                fill="#e8f8ff"
                            />
                            <path
                                d="M56 98 V114 M48 106 H64"
                                stroke="#2b75a8"
                                strokeWidth="3"
                            />
                        </g>
                        <g className={`${styles.carWheel} ${styles.carWheelRight}`}>
                            <circle
                                cx="140"
                                cy="106"
                                r="20"
                                fill="#18344e"
                            />
                            <circle
                                cx="140"
                                cy="106"
                                r="13"
                                fill="#57c9ff"
                            />
                            <circle
                                cx="140"
                                cy="106"
                                r="8"
                                fill="#e8f8ff"
                            />
                            <path
                                d="M140 98 V114 M132 106 H148"
                                stroke="#2b75a8"
                                strokeWidth="3"
                            />
                        </g>
                    </g>
                </svg>
                <span className={styles.themeName}>{this.text('home.animation.car.title')}</span>
            </div>
        );
    }

    renderProgrammingTheme (theme, visual) {
        return (
            <div className={`${styles.animationTheme} ${styles[`${theme}Theme`]}`}>
                <div className={styles.programFlow}>{this.renderProgramStack(theme)}</div>
                <div className={styles.robotStage}>{visual}</div>
            </div>
        );
    }

    renderProgrammingAnimation () {
        return (
            <div
                className={styles.productWindow}
                role="img"
                aria-label={this.text('home.animation.label')}
            >
                <div
                    className={styles.programScene}
                    aria-hidden="true"
                >
                    {this.renderProgrammingTheme('arm', this.renderArmVisual())}
                    {this.renderProgrammingTheme('robot', this.renderRobotVisual())}
                    {this.renderProgrammingTheme('car', this.renderCarVisual())}
                </div>
            </div>
        );
    }

    renderFiles () {
        return (
            <section
                className={styles.viewPanel}
                aria-labelledby="est-home-files-title"
            >
                <div className={styles.startCard}>
                    <div className={styles.startCopy}>
                        <h1 id="est-home-files-title">
                            <span className={styles.startTitleLead}>{this.text('home.startLine1')}</span>
                            <span className={styles.startTitleMain}>{this.text('home.startLine2')}</span>
                        </h1>
                        <div className={styles.startActions}>
                            <button
                                className={styles.startButton}
                                type="button"
                                onClick={() => this.startNewProject()}
                            >
                                <img
                                    className={styles.startButtonIcon}
                                    alt=""
                                    src={startIcon}
                                />
                                <span className={styles.startButtonText}>{this.text('home.start')}</span>
                            </button>
                            {this.props.canReturnToEditor ? (
                                <button
                                    className={`${styles.startButton} ${styles.returnEditorButton}`}
                                    type="button"
                                    onClick={this.props.onReturnToEditor}
                                >
                                    <img
                                        className={styles.startButtonIcon}
                                        alt=""
                                        src={fileIcon}
                                    />
                                    <span className={styles.startButtonText}>
                                        {this.text('home.returnToEditor')}
                                    </span>
                                </button>
                            ) : null}
                        </div>
                    </div>
                    {this.renderProgrammingAnimation()}
                </div>
                <h2 className={styles.sectionTitle}>{this.text('home.recentFiles')}</h2>
                {this.state.recentFiles.length ? (
                    <div
                        className={styles.fileGrid}
                        aria-label={this.text('home.recentFiles')}
                    >
                        {this.state.recentFiles.map((project, index) => this.renderFileCard(project, index))}
                    </div>
                ) : (
                    <div className={styles.emptyRecent}>
                        <strong>{this.text('home.noRecentFiles')}</strong>
                        <span>{this.text('home.noRecentFilesHint')}</span>
                    </div>
                )}
            </section>
        );
    }

    renderBuild () {
        const buildItems = this.state.buildItems.filter(item => item.category === this.state.buildCategory);
        const progress = this.state.buildDownloadProgress;
        const addedItemCount = Math.max(0, this.state.buildTotalItems - EST_HOME_BUILD_ITEMS.length);
        const buildLibraryClassName = `${styles.buildLibraryBar} ${
            this.state.buildLibraryInstalled ? styles.buildLibraryReady : ''
        }`;
        const downloadCanPause = this.state.buildDownloadActive && progress &&
            progress.phase === 'downloading' && !this.state.buildDownloadCancelling;
        let downloadButtonText = this.text('home.build.downloadButton');
        if (this.state.buildDownloadActive) {
            if (this.state.buildDownloadCancelling) {
                downloadButtonText = this.text('home.build.downloadCancelling');
            } else if (this.state.buildDownloadPaused) {
                downloadButtonText = this.text('home.build.downloadPaused', {
                    percent: progress ? progress.percent || 0 : 0
                });
            } else {
                downloadButtonText = this.text(
                    `home.build.downloadPhase.${progress ? progress.phase : 'checking'}`,
                    {percent: progress ? progress.percent || 0 : 0}
                );
            }
        }
        return (
            <section
                className={`${styles.viewPanel} ${styles.buildPage}`}
                aria-label={this.text('home.nav.build')}
            >
                <header className={styles.buildHeader}>
                    <div>
                        <h1>{this.text('home.build.title')}</h1>
                        <p>{this.text('home.build.subtitle')}</p>
                    </div>
                    <div
                        className={styles.buildCategoryTabs}
                        role="tablist"
                        aria-label={this.text('home.build.categories')}
                    >
                        {EST_HOME_BUILD_CATEGORIES.map(category => (
                            <button
                                className={category === this.state.buildCategory ? styles.activeBuildCategory : ''}
                                type="button"
                                role="tab"
                                aria-selected={category === this.state.buildCategory}
                                key={category}
                                onClick={() => this.setState({buildCategory: category})}
                            >
                                {this.text(`home.build.category.${category}`)}
                            </button>
                        ))}
                    </div>
                </header>
                <div className={buildLibraryClassName}>
                    <div className={styles.buildLibraryCopy}>
                        <strong>{this.text(this.state.buildLibraryInstalled ?
                            'home.build.libraryReady' :
                            'home.build.libraryDownload')}</strong>
                        <small>{this.state.buildLibraryInstalled ?
                            this.text('home.build.libraryReadyHint', {count: this.state.buildTotalItems}) :
                            this.text('home.build.libraryDownloadHint', {count: addedItemCount})}</small>
                        {this.state.buildDownloadActive && progress ? (
                            <span className={styles.buildDownloadTrack}>
                                <span style={{width: `${Math.max(2, progress.percent || 0)}%`}} />
                            </span>
                        ) : null}
                    </div>
                    {this.state.buildLibraryInstalled ? null : (
                        <span className={styles.buildDownloadActions}>
                            <button
                                className={styles.buildDownloadButton}
                                type="button"
                                disabled={this.state.buildDownloadActive}
                                onClick={() => this.downloadBuildLibrary()}
                            >
                                {downloadButtonText}
                            </button>
                            {this.state.buildDownloadActive ? (
                                <button
                                    className={styles.buildDownloadControl}
                                    type="button"
                                    disabled={!downloadCanPause}
                                    onClick={() => this.toggleBuildLibraryDownloadPause()}
                                >
                                    {this.text(this.state.buildDownloadPaused ?
                                        'home.build.resumeButton' :
                                        'home.build.pauseButton')}
                                </button>
                            ) : null}
                            {this.state.buildDownloadActive ? (
                                <button
                                    className={styles.buildDownloadControl}
                                    type="button"
                                    disabled={this.state.buildDownloadCancelling}
                                    onClick={() => this.cancelBuildLibraryDownload()}
                                >
                                    {this.text('home.build.cancelButton')}
                                </button>
                            ) : null}
                        </span>
                    )}
                </div>
                <div className={styles.buildGrid}>
                    {buildItems.map(item => (
                        <button
                            className={styles.buildTile}
                            type="button"
                            key={item.id}
                            onClick={() => this.openBuildGuide(item)}
                        >
                            <span className={styles.buildImage}><img
                                alt=""
                                src={this.state.buildThumbnails[item.id] || buildIcon}
                            /></span>
                            <span className={styles.buildTileCopy}>
                                <strong>
                                    {item.title.indexOf('home.') === 0 ? this.text(item.title) : item.title}
                                </strong>
                                <small>{this.text('home.build.guide')}</small>
                            </span>
                            <span
                                className={styles.buildOpenIcon}
                                aria-hidden="true"
                            >›</span>
                        </button>
                    ))}
                </div>
            </section>
        );
    }

    renderMore () {
        return (
            <section
                className={styles.viewPanel}
                aria-label={this.text('home.nav.more')}
            >
                <div className={styles.morePage}>
                    <header className={styles.moreHeader}>
                        <h1>{this.text('home.more.title')}</h1>
                        <p>{this.text('home.more.intro')}</p>
                    </header>
                    <div className={styles.settingRow}>
                        <label htmlFor="est-home-language">{this.text('home.language')}</label>
                        <select
                            id="est-home-language"
                            value={this.state.locale}
                            onChange={event => this.changeLocale(event)}
                        >
                            {Object.keys(EST_LOCALE_NAMES).map(locale => (
                                <option
                                    key={locale}
                                    value={locale}
                                >{EST_LOCALE_NAMES[locale]}</option>
                            ))}
                        </select>
                    </div>
                    {INFO_ITEMS.map(item => (
                        <button
                            className={styles.moreLink}
                            type="button"
                            key={item.id}
                            onClick={() => this.openInfoDialog(item.id)}
                        >
                            <span>{this.text(item.title)}</span>
                            <small>{this.text(item.subtitle)}</small>
                            <b aria-hidden="true">›</b>
                        </button>
                    ))}
                </div>
            </section>
        );
    }

    renderDialog () {
        const {dialogId, renameTarget} = this.state;
        if (!dialogId && !renameTarget) return null;
        const isRename = Boolean(renameTarget);
        const title = isRename ? this.text('home.rename') : this.text(`home.dialog.${dialogId}.title`);
        const guide = isRename ? null : INFO_DIALOGS[dialogId];
        return (
            <div
                className={`${styles.dialogBackdrop} ${isRename ? '' : styles.guideBackdrop}`}
                role="presentation"
                onMouseDown={event => {
                    if (event.target === event.currentTarget) {
                        this.setState({dialogId: null, renameTarget: null});
                    }
                }}
            >
                <section
                    className={`${styles.dialog} ${isRename ? '' : styles.guideDialog}`}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="est-home-dialog-title"
                >
                    <button
                        className={styles.dialogClose}
                        type="button"
                        aria-label={this.text('home.close')}
                        onClick={() => this.setState({dialogId: null, renameTarget: null})}
                    >
                        ×
                    </button>
                    <div className={isRename ? '' : styles.guideScroller}>
                        <h2 id="est-home-dialog-title">{title}</h2>
                        {isRename ? (
                            <React.Fragment>
                                <label
                                    className={styles.renameLabel}
                                    htmlFor="est-home-rename-input"
                                >
                                    {this.text('home.fileName')}
                                </label>
                                <input
                                    autoFocus
                                    id="est-home-rename-input"
                                    maxLength="100"
                                    value={this.state.renameValue}
                                    onChange={event => this.setState({renameValue: event.target.value})}
                                    onKeyDown={event => {
                                        if (event.key === 'Enter') this.confirmRename();
                                    }}
                                />
                                <div className={styles.dialogActions}>
                                    <button
                                        type="button"
                                        onClick={() => this.setState({renameTarget: null})}
                                    >
                                        {this.text('home.cancel')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => this.confirmRename()}
                                    >
                                        {this.text('home.confirm')}
                                    </button>
                                </div>
                            </React.Fragment>
                        ) : guide ? (
                            <div className={styles.guideContent}>
                                <p className={styles.guideLead}>{this.text(guide.lead, {version})}</p>
                                {dialogId === 'blocks' ? (
                                    <div className={styles.blockGuide}>
                                        {EST_HOME_BLOCK_GUIDE_CATEGORIES.map(category => (
                                            <section
                                                className={styles.blockGuideCategory}
                                                key={category.id}
                                            >
                                                <h3>{this.text(category.title)}</h3>
                                                {category.modes && category.modes.length ? (
                                                    <div className={styles.blockGuideModes}>
                                                        <h4>{this.text('home.blockGuide.modesTitle')}</h4>
                                                        <ul>
                                                            {category.modes.map(modeId => {
                                                                const mode = this.text(modeId).split('｜');
                                                                const modeName = mode.shift();
                                                                return (
                                                                    <li key={modeId}>
                                                                        <strong>{modeName}</strong>
                                                                        <span>{mode.join('｜')}</span>
                                                                    </li>
                                                                );
                                                            })}
                                                        </ul>
                                                    </div>
                                                ) : null}
                                                <div className={styles.blockGuideEntries}>
                                                    {category.items.map(blockId => {
                                                        const entry = this.text(`home.blockGuide.${blockId}`)
                                                            .split('｜');
                                                        const blockName = entry.shift();
                                                        const blockPreview = this.state.blockPreviews[blockId];
                                                        return (
                                                            <article
                                                                className={styles.blockGuideEntry}
                                                                key={blockId}
                                                            >
                                                                <div className={styles.blockGuidePreview}>
                                                                    {blockPreview ? (
                                                                        <img
                                                                            alt={blockName}
                                                                            src={blockPreview}
                                                                        />
                                                                    ) : (
                                                                        <span
                                                                            aria-label={this.text(
                                                                                this.state.blockPreviewsLoading ?
                                                                                    'home.blockGuide.previewLoading' :
                                                                                    'home.blockGuide.previewUnavailable'
                                                                            )}
                                                                            role="img"
                                                                        />
                                                                    )}
                                                                </div>
                                                                <div className={styles.blockGuideCopy}>
                                                                    <h4>{blockName}</h4>
                                                                    <p>{entry.join('｜')}</p>
                                                                </div>
                                                            </article>
                                                        );
                                                    })}
                                                </div>
                                            </section>
                                        ))}
                                    </div>
                                ) : (
                                    <div className={styles.guideSections}>
                                        {guide.sections.map(section => {
                                            const List = section.ordered ? 'ol' : 'ul';
                                            return (
                                                <section
                                                    className={styles.guideSection}
                                                    key={section.title}
                                                >
                                                    <h3>{this.text(section.title)}</h3>
                                                    {section.image ? (
                                                        <figure className={styles.guideFigure}>
                                                            <img
                                                                alt={this.text(section.imageAlt)}
                                                                src={section.image}
                                                            />
                                                            {section.caption ? (
                                                                <figcaption>{this.text(section.caption)}</figcaption>
                                                            ) : null}
                                                        </figure>
                                                    ) : null}
                                                    <List
                                                        className={
                                                            section.ordered ? styles.guideSteps : styles.guideList
                                                        }
                                                    >
                                                        {section.items.map(item => (
                                                            <li key={item}>{this.text(item, {version})}</li>
                                                        ))}
                                                    </List>
                                                    {section.note ? (
                                                        <p className={styles.guideNote}>
                                                            {this.text(section.note, {version})}
                                                        </p>
                                                    ) : null}
                                                </section>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </div>
                </section>
            </div>
        );
    }

    render () {
        const activeIndex = NAV_ITEMS.findIndex(item => item.id === this.state.activeView);
        const visibilityClass = this.props.visible === false ? styles.homeHidden : styles.homeVisible;
        return (
            <div
                className={`${styles.home} ${visibilityClass}`}
                aria-hidden={this.props.visible === false}
                onClick={() => this.state.menuPath && this.setState({menuPath: null})}
            >
                <aside
                    className={styles.sideNav}
                    aria-label={this.text('home.navigation')}
                    style={{'--est-home-nav-index': activeIndex}}
                >
                    <span
                        className={styles.navIndicator}
                        aria-hidden="true"
                    />
                    {NAV_ITEMS.map(item => (
                        <button
                            className={`${styles.navEntry} ${
                                item.id === this.state.activeView ? styles.activeNav : ''
                            }`}
                            type="button"
                            aria-pressed={item.id === this.state.activeView}
                            key={item.id}
                            style={{'--est-home-nav-label': item.labelColor}}
                            onClick={() => this.setState({activeView: item.id, menuPath: null})}
                        >
                            <img
                                alt=""
                                src={item.icon}
                            />
                            <span>{this.text(item.label)}</span>
                        </button>
                    ))}
                </aside>
                <main className={styles.contentStage}>
                    {this.state.activeView === 'files' ? this.renderFiles() : null}
                    {this.state.activeView === 'build' ? this.renderBuild() : null}
                    {this.state.activeView === 'more' ? this.renderMore() : null}
                </main>
                {this.renderDialog()}
                <div
                    className={`${styles.notice} ${this.state.notice ? styles.noticeVisible : ''}`}
                    role="status"
                >
                    {this.state.notice}
                </div>
            </div>
        );
    }
}

EstHome.propTypes = {
    canReturnToEditor: PropTypes.bool,
    onReturnToEditor: PropTypes.func,
    visible: PropTypes.bool
};

export default EstHome;
