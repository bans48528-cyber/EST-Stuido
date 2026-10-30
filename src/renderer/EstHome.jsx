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
    EST_HOME_BUILD_ITEMS
} from './est-home-build-library';
import {createHardwareBlockPreviews} from './est-home-block-previews';
import getProductBlockGuideCategories from './est-home-product-block-guide';
import HostMenuGuide from './est-home-host-menu-guide.jsx';
import {getHomeContent} from '../common/home-content';
import {getHardwareProfile} from '../common/hardware-profiles';
import {EST_PRODUCTS, INFO_ITEMS, PRODUCT_GUIDE_ITEMS, getProductGuide} from './est-home-content';

import buildIcon from './est-home-assets/home-icon-build.png';
import fileIcon from './est-home-assets/home-icon-file.png';
import projectFileIcon from '../icon/ATCProject.png';
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

const FILE_ACCENTS = ['blue', 'green', 'orange', 'cyan'];

class EstHome extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            activeView: 'files',
            hardwarePickerOpen: false,
            blockPreviewLocale: null,
            blockPreviewHardwareId: null,
            blockPreviews: {},
            blockPreviewsLoading: false,
            buildCategory: 'basic',
            buildDownloadActive: false,
            buildDownloadCancelling: false,
            buildDownloadPaused: false,
            buildDownloadProgress: null,
            buildItems: props.homeHardwareId === 'est' ? EST_HOME_BUILD_ITEMS : [],
            buildLibraryInstalled: false,
            buildThumbnails: {},
            buildTotalItems: 42,
            dialogId: null,
            locale: getCurrentEstLocale(),
            menuPath: null,
            notice: '',
            recentFiles: [],
            renameTarget: null,
            renameValue: '',
            showUnknownFiles: false
        };
        this.hardwarePickerRef = React.createRef();
        this.handleHardwarePickerOutside = this.handleHardwarePickerOutside.bind(this);
        this.handleLocaleChanged = this.handleLocaleChanged.bind(this);
        this.handleBuildDownloadProgress = this.handleBuildDownloadProgress.bind(this);
        this.handleProjectFailed = this.handleProjectFailed.bind(this);
        this.handleWindowKeyDown = this.handleWindowKeyDown.bind(this);
    }

    componentDidMount () {
        window.addEventListener(EST_LOCALE_CHANGED_EVENT, this.handleLocaleChanged);
        window.addEventListener(EST_HOME_PROJECT_FAILED_EVENT, this.handleProjectFailed);
        window.addEventListener('keydown', this.handleWindowKeyDown);
        window.addEventListener('mousedown', this.handleHardwarePickerOutside);
        ipcRenderer.on('est-home-build-download-progress', this.handleBuildDownloadProgress);
        this.loadRecentFiles();
        this.loadBuildLibrary();
    }

    componentDidUpdate (previous) {
        if (previous.homeHardwareId === this.props.homeHardwareId) return;
        this.blockPreviewRequest = (this.blockPreviewRequest || 0) + 1;
        window.clearTimeout(this.noticeTimer);
        // eslint-disable-next-line react/no-did-update-set-state -- Clear details when the controlled device changes.
        this.setState({dialogId: null,
            hardwarePickerOpen: false,
            menuPath: null,
            renameTarget: null,
            notice: '',
            showUnknownFiles: false,
            buildCategory: 'basic',
            buildItems: [],
            buildThumbnails: {},
            buildLibraryInstalled: false,
            buildDownloadActive: false,
            buildDownloadPaused: false,
            buildDownloadCancelling: false,
            buildDownloadProgress: null,
            blockPreviews: {},
            blockPreviewHardwareId: null});
        this.loadRecentFiles();
        this.loadBuildLibrary();
    }

    componentWillUnmount () {
        this.unmounted = true;
        this.recentRequest = (this.recentRequest || 0) + 1;
        this.libraryRequest = (this.libraryRequest || 0) + 1;
        this.blockPreviewRequest = (this.blockPreviewRequest || 0) + 1;
        window.removeEventListener(EST_LOCALE_CHANGED_EVENT, this.handleLocaleChanged);
        window.removeEventListener(EST_HOME_PROJECT_FAILED_EVENT, this.handleProjectFailed);
        window.removeEventListener('keydown', this.handleWindowKeyDown);
        window.removeEventListener('mousedown', this.handleHardwarePickerOutside);
        ipcRenderer.removeListener('est-home-build-download-progress', this.handleBuildDownloadProgress);
        window.clearTimeout(this.noticeTimer);
    }

    text (id, values) {
        return getEstText(id, this.state.locale, values);
    }

    handleLocaleChanged (event) {
        const locale = event.detail && event.detail.locale ? event.detail.locale : getCurrentEstLocale();
        this.setState({
            blockPreviewHardwareId: null,
            blockPreviewLocale: null,
            blockPreviews: {},
            locale
        }, () => {
            if (this.state.dialogId === 'blocks') this.loadBlockPreviews(this.props.homeHardwareId);
        });
    }

    handleProjectFailed (event) {
        const message = event.detail && event.detail.message;
        this.showNotice(message || this.text('home.openFailed'));
    }

    handleBuildDownloadProgress (event, progress) {
        if (!progress || progress.hardwareId !== this.props.homeHardwareId || this.unmounted) return;
        this.setState({
            buildDownloadActive: progress && progress.phase !== 'complete',
            buildDownloadCancelling: Boolean(progress && progress.cancelled),
            buildDownloadPaused: Boolean(progress && progress.paused),
            buildDownloadProgress: progress || null
        });
        if (progress.phase === 'complete') this.loadBuildLibrary();
    }

    handleWindowKeyDown (event) {
        if (event.key === 'Escape') {
            this.closeHardwarePicker(this.state.hardwarePickerOpen);
            this.setState({dialogId: null, menuPath: null, renameTarget: null});
        }
    }

    closeHardwarePicker (restoreFocus = false) {
        this.setState({hardwarePickerOpen: false}, () => {
            const root = this.hardwarePickerRef.current;
            if (restoreFocus && root) root.querySelector('#atc-home-hardware').focus();
        });
    }

    handleHardwarePickerOutside (event) {
        const root = this.hardwarePickerRef.current;
        if (this.state.hardwarePickerOpen && root && !root.contains(event.target)) this.closeHardwarePicker();
    }

    openHardwarePicker () {
        if (!this.props.homeSelectionReady) return;
        this.setState({hardwarePickerOpen: true}, () => {
            const root = this.hardwarePickerRef.current;
            if (root) root.querySelector('[role="option"][aria-selected="true"]').focus();
        });
    }

    handleHardwarePickerKeyDown (event) {
        const key = event.key;
        if (key === 'Escape' && this.state.hardwarePickerOpen) {
            event.preventDefault();
            event.stopPropagation();
            this.closeHardwarePicker(true);
            return;
        }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) return;
        event.preventDefault();
        event.stopPropagation();
        const wasOpen = this.state.hardwarePickerOpen;
        this.setState({hardwarePickerOpen: true}, () => {
            const root = this.hardwarePickerRef.current;
            if (!root) return;
            const options = Array.from(root.querySelectorAll('[role="option"]'));
            const current = options.indexOf(document.activeElement);
            const selected = options.findIndex(option => option.getAttribute('aria-selected') === 'true');
            let next = wasOpen ? (current + (key === 'ArrowUp' ? -1 : 1) + options.length) % options.length : selected;
            if (key === 'Home') next = 0;
            if (key === 'End') next = options.length - 1;
            options[next].focus();
        });
    }

    renderHardwarePicker () {
        const selected = EST_PRODUCTS.find(product => product.id === this.props.homeHardwareId);
        const open = this.state.hardwarePickerOpen;
        return (
            <div
                className={styles.hardwareSelector}
                ref={this.hardwarePickerRef}
                onKeyDown={event => this.handleHardwarePickerKeyDown(event)}
                onBlur={event => {
                    if (!event.currentTarget.contains(event.relatedTarget)) this.closeHardwarePicker();
                }}
            >
                <button
                    id="atc-home-hardware"
                    className={styles.hardwarePickerTrigger}
                    type="button"
                    aria-label={`${this.text('home.selectHardware')}: ${this.text(selected.name)}`}
                    aria-haspopup="listbox"
                    aria-controls="atc-home-hardware-options"
                    aria-expanded={open}
                    disabled={!this.props.homeSelectionReady}
                    onClick={() => (open ? this.closeHardwarePicker(true) : this.openHardwarePicker())}
                >
                    <img
                        className={styles.hardwarePickerImage}
                        alt=""
                        src={selected.image}
                        draggable={false}
                    />
                    <span className={styles.hardwarePickerCaption}>
                        <strong>{this.text(selected.name)}</strong>
                        <svg
                            viewBox="0 0 16 16"
                            aria-hidden="true"
                        ><path d="m4 6 4 4 4-4" /></svg>
                    </span>
                </button>
                {open ? <section className={styles.hardwarePickerMenu}>
                    <h2>{this.text('home.selectHardware')}</h2>
                    <div
                        id="atc-home-hardware-options"
                        role="listbox"
                        aria-label={this.text('home.selectHardware')}
                    >
                        {EST_PRODUCTS.map(product => {
                            const active = product.id === this.props.homeHardwareId;
                            return (<button
                                key={product.id}
                                type="button"
                                role="option"
                                tabIndex={-1}
                                data-home-hardware={product.id}
                                aria-selected={active}
                                className={styles.hardwarePickerOption}
                                onClick={() => {
                                    this.props.onHomeHardwareChange(product.id);
                                    this.closeHardwarePicker(true);
                                }}
                            >
                                <img
                                    alt=""
                                    src={product.image}
                                    draggable={false}
                                />
                                <strong>{this.text(product.name)}</strong>
                                {active ? <svg
                                    viewBox="0 0 20 20"
                                    aria-hidden="true"
                                ><path d="m4 10 4 4 8-8" /></svg> : null}
                            </button>);
                        })}
                    </div>
                </section> : null}
            </div>
        );
    }

    async loadRecentFiles () {
        const request = this.recentRequest = (this.recentRequest || 0) + 1;
        const hardwareId = this.props.homeHardwareId;
        try {
            // Keep the complete index. Filtering never writes to the stored recent list.
            const recentFiles = await ipcRenderer.invoke('est-home-list-recent-projects');
            if (this.unmounted || request !== this.recentRequest || hardwareId !== this.props.homeHardwareId) return;
            this.setState({recentFiles: Array.isArray(recentFiles) ? recentFiles : []});
        } catch (error) {
            if (!this.unmounted && request === this.recentRequest) this.setState({recentFiles: []});
        }
    }

    async loadBuildLibrary () {
        const request = this.libraryRequest = (this.libraryRequest || 0) + 1;
        const hardwareId = this.props.homeHardwareId;
        try {
            const library = await ipcRenderer.invoke('est-home-get-build-library-state', {hardwareId});
            if (this.unmounted || request !== this.libraryRequest || hardwareId !== this.props.homeHardwareId ||
                library.hardwareId !== hardwareId) return;
            this.setState({
                buildItems: Array.isArray(library.items) ? library.items :
                    (hardwareId === 'est' ? EST_HOME_BUILD_ITEMS : []),
                buildLibraryInstalled: Boolean(library.installed),
                buildThumbnails: library.thumbnails || {},
                buildTotalItems: library.totalItemCount || 0,
                buildDownloadActive: Boolean(library.downloadActive),
                buildDownloadProgress: library.downloadProgress,
                buildDownloadPaused: Boolean(library.downloadProgress && library.downloadProgress.paused),
                buildDownloadCancelling: Boolean(library.downloadProgress && library.downloadProgress.cancelled)
            });
        } catch (error) {
            if (this.unmounted || request !== this.libraryRequest || hardwareId !== this.props.homeHardwareId) return;
            this.setState({buildItems: hardwareId === 'est' ? EST_HOME_BUILD_ITEMS : [],
                buildLibraryInstalled: false,
                buildThumbnails: {}});
        }
    }

    loadBlockPreviews (hardwareId = this.props.homeHardwareId) {
        const locale = this.state.locale;
        if (this.state.blockPreviewHardwareId === hardwareId && this.state.blockPreviewLocale === locale &&
            Object.keys(this.state.blockPreviews).length) return;
        const requestId = (this.blockPreviewRequest || 0) + 1;
        this.blockPreviewRequest = requestId;
        this.setState({
            blockPreviewHardwareId: hardwareId,
            blockPreviewLocale: locale,
            blockPreviews: {},
            blockPreviewsLoading: true
        });
        createHardwareBlockPreviews(hardwareId, locale, previewBatch => {
            if (this.blockPreviewRequest !== requestId || this.state.locale !== locale ||
                this.state.blockPreviewHardwareId !== hardwareId) return;
            this.setState(state => ({
                blockPreviews: Object.assign({}, state.blockPreviews, previewBatch)
            }));
        }).then(blockPreviews => {
            if (this.blockPreviewRequest !== requestId || this.state.locale !== locale ||
                this.state.blockPreviewHardwareId !== hardwareId) return;
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
            if (dialogId === 'blocks') this.loadBlockPreviews(this.props.homeHardwareId);
        });
    }

    async downloadBuildLibrary () {
        const hardwareId = this.props.homeHardwareId;
        if (!getHomeContent(hardwareId).downloadableBuildLibrary || this.state.buildDownloadActive) return;
        const scope = this.libraryRequest;
        const current = () => !this.unmounted && this.props.homeHardwareId === hardwareId &&
            scope === this.libraryRequest;
        this.setState({buildDownloadActive: true,
            buildDownloadCancelling: false,
            buildDownloadPaused: false,
            buildDownloadProgress: {hardwareId, phase: 'checking', percent: 0}});
        try {
            const library = await ipcRenderer.invoke('est-home-download-build-library', {hardwareId});
            if (!current()) return;
            this.showNotice(this.text(library.cancelled ?
                'home.build.downloadCancelled' : 'home.build.downloadComplete'));
        } catch (error) {
            if (current()) this.showNotice(this.text('home.build.downloadFailed'));
        } finally {
            if (!this.unmounted && this.props.homeHardwareId === hardwareId) this.loadBuildLibrary();
        }
    }

    async toggleBuildLibraryDownloadPause () {
        if (!this.state.buildDownloadActive || this.state.buildDownloadCancelling) return;
        const hardwareId = this.props.homeHardwareId;
        const channel = this.state.buildDownloadPaused ?
            'est-home-resume-build-library-download' : 'est-home-pause-build-library-download';
        try {
            const state = await ipcRenderer.invoke(channel, {hardwareId});
            if (!this.unmounted && hardwareId === this.props.homeHardwareId && state && state.active) {
                this.setState({buildDownloadPaused: Boolean(state.paused)});
            }
        } catch (error) {
            if (hardwareId === this.props.homeHardwareId) this.showNotice(this.text('home.build.downloadFailed'));
        }
    }

    async cancelBuildLibraryDownload () {
        if (!this.state.buildDownloadActive || this.state.buildDownloadCancelling) return;
        const hardwareId = this.props.homeHardwareId;
        this.setState({buildDownloadCancelling: true, buildDownloadPaused: false});
        try {
            await ipcRenderer.invoke('est-home-cancel-build-library-download', {hardwareId});
            if (!this.unmounted && hardwareId === this.props.homeHardwareId) this.loadBuildLibrary();
        } catch (error) {
            if (hardwareId === this.props.homeHardwareId) this.showNotice(this.text('home.build.downloadFailed'));
        }
    }

    async openBuildGuide (item) {
        const hardwareId = this.props.homeHardwareId;
        try {
            await ipcRenderer.invoke('est-home-open-build-guide', {hardwareId, itemId: item.id});
        } catch (error) {
            if (hardwareId === this.props.homeHardwareId) this.showNotice(this.text('home.build.openFailed'));
        }
    }

    showNotice (notice) {
        if (this.unmounted) return;
        window.clearTimeout(this.noticeTimer);
        this.setState({notice});
        this.noticeTimer = window.setTimeout(() => this.setState({notice: ''}), 2400);
    }

    startNewProject () {
        if (this.projectOpenPending) return;
        dispatchEstHomeEvent(EST_HOME_NEW_PROJECT_EVENT, {hardwareId: this.props.homeHardwareId});
    }

    async openRecentProject (projectPath) {
        if (this.projectOpenPending) return;
        this.projectOpenPending = true;
        this.setState({menuPath: null});
        try {
            const project = projectPath ? await ipcRenderer.invoke('est-home-open-project', projectPath) :
                await ipcRenderer.invoke('est-home-choose-project');
            if (project) {
                dispatchEstHomeEvent(EST_HOME_OPEN_PROJECT_EVENT, project);
            }
        } catch (error) {
            this.showNotice(this.text('home.openFailed'));
            this.loadRecentFiles();
        } finally {
            this.projectOpenPending = false;
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
                            src={project.thumbnail || projectFileIcon}
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
                <span
                    className={styles.fileHardware}
                    data-hardware-id={project.hardwareId || 'unknown'}
                >
                    {project.hardwareName || this.text('home.unknownHardware')}
                </span>
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
        const unknownFiles = this.state.recentFiles.filter(project => !project.hardwareId);
        const recentFiles = this.state.showUnknownFiles ? unknownFiles :
            this.state.recentFiles.filter(project => project.hardwareId === this.props.homeHardwareId);
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
                                        {this.text('home.returnToHardwareProject', {
                                            name: getHardwareProfile(this.props.projectHardwareId).name
                                        })}
                                    </span>
                                </button>
                            ) : null}
                        </div>
                    </div>
                    {this.renderProgrammingAnimation()}
                </div>
                <div className={styles.fileListHeader}>
                    <h2 className={styles.sectionTitle}>{this.text(this.state.showUnknownFiles ?
                        'home.unknownFiles' : 'home.recentFiles')}</h2>
                    <button
                        type="button"
                        onClick={() => this.openRecentProject()}
                    >{this.text('home.openFile')}</button>
                    {unknownFiles.length ? <button
                        type="button"
                        aria-pressed={this.state.showUnknownFiles}
                        onClick={() => this.setState({showUnknownFiles: !this.state.showUnknownFiles, menuPath: null})}
                    >
                        {this.text(this.state.showUnknownFiles ? 'home.deviceFiles' : 'home.unknownFiles',
                            {count: unknownFiles.length})}
                    </button> : null}
                </div>
                {this.state.showUnknownFiles ? <p>{this.text('home.unknownFilesHint')}</p> : null}
                {recentFiles.length ? (
                    <div
                        className={styles.fileGrid}
                        aria-label={this.text('home.recentFiles')}
                    >
                        {recentFiles.map((project, index) => this.renderFileCard(project, index))}
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
        const content = getHomeContent(this.props.homeHardwareId);
        if (!content.buildCategories.length) {
            return (
                <section className={styles.viewPanel}>
                    <h1>{this.text('home.build.title')}</h1>
                    <div className={styles.emptyRecent}><strong>{this.text('home.build.none')}</strong>
                        <span>{this.text('home.build.noneHint', {
                            name: getHardwareProfile(this.props.homeHardwareId).name
                        })}</span>
                    </div>
                </section>
            );
        }
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
                        {content.buildCategories.map(category => (
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
        const activeProduct = EST_PRODUCTS.find(product => product.id === this.props.homeHardwareId);
        const entries = getHomeContent(this.props.homeHardwareId).guides.map(id =>
            PRODUCT_GUIDE_ITEMS.find(item => item.id === id) || INFO_ITEMS.find(item => item.id === id));
        return (
            <section
                className={styles.viewPanel}
                aria-label={this.text('home.nav.more')}
            >
                <div className={styles.morePage}>
                    <header className={styles.moreHeader}>
                        <h1>{this.text('home.more.title')}</h1>
                        <p>{this.text(activeProduct.summary)}</p>
                    </header>
                    <section
                        className={styles.moreGuides}
                        id="est-home-product-guides"
                        aria-labelledby="est-home-product-guides-title"
                    >
                        <h2
                            className={styles.moreSectionTitle}
                            id="est-home-product-guides-title"
                            aria-live="polite"
                        >
                            {activeProduct ? this.text('home.more.productGuides', {
                                product: this.text(activeProduct.name)
                            }) : this.text('home.more.selectPrompt')}
                        </h2>
                        {activeProduct ? entries.map(item => (
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
                        )) : null}
                    </section>
                    <section
                        className={styles.moreCommon}
                        aria-labelledby="est-home-common-title"
                    >
                        <h2
                            className={styles.moreSectionTitle}
                            id="est-home-common-title"
                        >{this.text('home.more.common')}</h2>
                        {this.renderCommonInfoLink('software')}
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
                        {this.renderCommonInfoLink('about')}
                    </section>
                </div>
            </section>
        );
    }

    renderCommonInfoLink (id) {
        const item = INFO_ITEMS.find(info => info.id === id);
        return (
            <button
                className={styles.moreLink}
                type="button"
                onClick={() => this.openInfoDialog(item.id)}
            >
                <span>{this.text(item.title)}</span>
                <small>{this.text(item.subtitle)}</small>
                <b aria-hidden="true">›</b>
            </button>
        );
    }

    renderGuideSections (sections, className = styles.guideSections) {
        return (
            <div className={className}>
                {sections.map(section => {
                    const List = section.ordered ? 'ol' : 'ul';
                    return (
                        <section
                            className={styles.guideSection}
                            key={section.title}
                        >
                            <h3>{this.text(section.title)}</h3>
                            {section.menuProduct ? (
                                <HostMenuGuide
                                    locale={this.state.locale}
                                    productId={section.menuProduct}
                                />
                            ) : null}
                            {section.image ? (
                                <figure className={styles.guideFigure}>
                                    <img
                                        alt={this.text(section.imageAlt)}
                                        src={(section.localizedImages &&
                                            section.localizedImages[this.state.locale]) ||
                                            section.image}
                                    />
                                    {section.caption ? (
                                        <figcaption>{this.text(section.caption)}</figcaption>
                                    ) : null}
                                </figure>
                            ) : null}
                            <List
                                className={section.ordered ? styles.guideSteps : styles.guideList}
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
        );
    }

    renderEstProductGuide () {
        const product = EST_PRODUCTS.find(item => item.id === this.props.homeHardwareId);
        return (<article className={styles.productDetailPanel}>
            <div className={styles.productDetailHero}>
                <figure className={styles.productDetailVisual}><img
                    alt={this.text(product.imageAlt)}
                    src={product.image}
                /></figure>
                <div className={styles.productDetailCopy}>
                    <h3>{this.text(product.name)}</h3><p>{this.text(product.intro)}</p>
                </div>
            </div>
            {this.renderGuideSections(product.sections, styles.productDetailSections)}
        </article>);
    }

    renderDialog () {
        const {dialogId, renameTarget} = this.state;
        const dialogProductId = getHomeContent(this.props.homeHardwareId).guides.includes(dialogId) ?
            this.props.homeHardwareId : null;
        if (!dialogId && !renameTarget) return null;
        const isRename = Boolean(renameTarget);
        const product = EST_PRODUCTS.find(item => item.id === dialogProductId);
        const guideItem = PRODUCT_GUIDE_ITEMS.find(item => item.id === dialogId);
        const title = isRename ? this.text('home.rename') : product && guideItem ?
            `${this.text(product.name)} · ${this.text(guideItem.title)}` : this.text(`home.dialog.${dialogId}.title`);
        const guide = isRename ? null : getProductGuide(dialogProductId, dialogId);
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
                                {dialogId === 'hardware' && product ? (
                                    <figure className={styles.hardwareGuideVisual}>
                                        <img
                                            alt={this.text(product.imageAlt)}
                                            src={product.image}
                                        />
                                        <figcaption>
                                            <strong>{this.text(product.name)}</strong>
                                            <span>{this.text('home.dialog.est.prototype.imageNote')}</span>
                                        </figcaption>
                                    </figure>
                                ) : null}
                                {dialogId === 'ai' && dialogProductId === 'est' ? (
                                    <button
                                        className={styles.guideAction}
                                        type="button"
                                        onClick={() => this.openInfoDialog('vision', 'est')}
                                    >{this.text('home.more.vision')}</button>
                                ) : null}
                                {guide.action === 'vision' ? (
                                    <button
                                        className={styles.guideAction}
                                        type="button"
                                        onClick={() => this.setState(
                                            {dialogId: null},
                                            () => this.props.onOpenVision()
                                        )}
                                    >
                                        {this.text(guide.actionLabel)}
                                    </button>
                                ) : null}
                                {dialogId === 'blocks' ? (
                                    <div className={styles.blockGuide}>
                                        {getProductBlockGuideCategories(
                                            dialogProductId || 'est',
                                            this.state.locale
                                        ).map(category => (
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
                                                    {category.items.map(item => {
                                                        const blockId = typeof item === 'string' ? item : item.id;
                                                        const entry = typeof item === 'string' ?
                                                            this.text(`home.blockGuide.${blockId}`).split('｜') :
                                                            [item.name, item.description];
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
                                ) : dialogId === 'est' ? (
                                    this.renderEstProductGuide()
                                ) : (
                                    this.renderGuideSections(guide.sections)
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
                    {this.renderHardwarePicker()}
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
    homeHardwareId: PropTypes.oneOf(['est', 'spark-ai', 'new-ai']).isRequired,
    projectHardwareId: PropTypes.oneOf(['est', 'spark-ai', 'new-ai']).isRequired,
    homeSelectionReady: PropTypes.bool,
    onHomeHardwareChange: PropTypes.func.isRequired,
    onOpenVision: PropTypes.func.isRequired,
    canReturnToEditor: PropTypes.bool,
    onReturnToEditor: PropTypes.func,
    visible: PropTypes.bool
};

export {EstHome};
export default EstHome;
