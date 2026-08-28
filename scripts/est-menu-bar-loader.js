/**
 * Keep only the EST connection status in the hardware area. EST Studio uses a
 * upload mode, so hardware selection and mode switching are hidden.
 * Keeping this as a build-time transform avoids editing the installed dependency.
 * @param {string} source - OpenBlock menu-bar component source.
 * @returns {string} transformed component source.
 */
module.exports = function (source) {
    const deviceSelectionPattern = new RegExp([
        ' {20}<Divider className=\\{classNames\\(styles\\.divider\\)\\} \\/>\\r?\\n',
        ' {20}<div\\r?\\n',
        ' {24}className=\\{classNames\\(styles\\.menuBarItem, styles\\.hoverable\\)\\}\\r?\\n',
        ' {24}onMouseUp=\\{this\\.handleSelectDeviceMouseUp\\}\\r?\\n',
        ' {20}>[\\s\\S]*?\\r?\\n',
        ' {20}<\\/div>\\r?\\n'
    ].join(''));
    const connectionButtonPattern = new RegExp([
        ' {20}<div\\r?\\n',
        ' {24}className=\\{classNames\\(styles\\.menuBarItem, styles\\.hoverable\\)\\}\\r?\\n',
        ' {24}onMouseUp=\\{this\\.handleConnectionMouseUp\\}\\r?\\n',
        ' {20}>[\\s\\S]*?\\r?\\n',
        ' {20}<\\/div>(?=\\r?\\n {20}\\{\\/\\* <div)'
    ].join(''));
    const programModePattern = new RegExp([
        ' {20}<Divider className=\\{classNames\\(styles\\.divider\\)\\} \\/>\\r?\\n',
        ' {20}<div className=\\{classNames\\(styles\\.menuBarItem, styles\\.programModeGroup\\)\\}>',
        '[\\s\\S]*?\\r?\\n',
        ' {20}<\\/div>\\r?\\n'
    ].join(''));
    const editMenuPattern = new RegExp([
        ' {20}<div\\r?\\n',
        ' {24}className=\\{classNames\\(styles\\.menuBarItem,\\r?\\n',
        ' {28}this\\.props\\.isRealtimeMode \\? styles\\.hoverable : styles\\.disabled,',
        '[\\s\\S]*?\\r?\\n',
        ' {20}<\\/div>\\r?\\n',
        '(?= {20}<Divider className=\\{classNames\\(styles\\.divider\\)\\} \\/>)'
    ].join(''));
    const openBlockUtilityItemsPattern = new RegExp([
        ' {20}<div\\r?\\n',
        ' {24}aria-label=\\{this\\.props\\.intl\\.formatMessage\\(ariaMessages\\.wiki\\)\\}',
        '[\\s\\S]*?',
        ' {20}<\\/div>\\r?\\n',
        '(?= {20}<Divider className=\\{classNames\\(styles\\.divider\\)\\} \\/>\\r?\\n',
        ' {20}<div className=\\{classNames\\(styles\\.menuBarItem, styles\\.programModeGroup\\)\\}>)'
    ].join(''));
    const clearCacheMenuItemPattern = new RegExp([
        ' {36}<MenuItem\\r?\\n',
        ' {40}isRtl=\\{this\\.props\\.isRtl\\}\\r?\\n',
        ' {40}onClick=\\{this\\.handleClearCache\\}\\r?\\n',
        '[\\s\\S]*?\\r?\\n',
        ' {36}<\\/MenuItem>\\r?\\n'
    ].join(''));
    const installDriverMenuSectionPattern = new RegExp([
        ' {32}<MenuSection>\\r?\\n',
        ' {36}<MenuItem\\r?\\n',
        ' {40}isRtl=\\{this\\.props\\.isRtl\\}\\r?\\n',
        ' {40}onClick=\\{this\\.props\\.onClickInstallDriver\\}\\r?\\n',
        '[\\s\\S]*?\\r?\\n',
        ' {32}<\\/MenuSection>\\r?\\n'
    ].join(''));
    const communityImport =
        "import CommunityButton from './community-button.jsx'; // eslint-disable-line no-unused-vars\n";
    const communityHandlerPattern = new RegExp([
        ' {4}handleClickOpenCommunity \\(\\) \\{\\r?\\n',
        " {8}window\\.open\\('https://community\\.openblock\\.cc'\\);\\r?\\n",
        ' {4}\\}\\r?\\n'
    ].join(''));
    const aboutTitlePropType = '                title: PropTypes.string, // text for the menu item';

    if (!deviceSelectionPattern.test(source)) {
        throw new Error('Unable to locate the OpenBlock hardware selection menu item.');
    }

    if (!connectionButtonPattern.test(source)) {
        throw new Error('Unable to locate the OpenBlock connection menu item for EST replacement.');
    }

    if (!programModePattern.test(source)) {
        throw new Error('Unable to locate the OpenBlock program mode switch.');
    }

    if (!editMenuPattern.test(source)) {
        throw new Error('Unable to locate the disabled OpenBlock edit menu.');
    }

    if (!openBlockUtilityItemsPattern.test(source)) {
        throw new Error('Unable to locate the OpenBlock wiki, tutorials, screenshot and firmware items.');
    }

    if (!clearCacheMenuItemPattern.test(source)) {
        throw new Error('Unable to locate the OpenBlock clear-cache menu item.');
    }

    if (!installDriverMenuSectionPattern.test(source)) {
        throw new Error('Unable to locate the OpenBlock driver installation menu item.');
    }

    if (!source.includes(communityImport) || !communityHandlerPattern.test(source)) {
        throw new Error('Unable to locate the unused OpenBlock community code.');
    }

    if (!source.includes(aboutTitlePropType)) {
        throw new Error('Unable to locate the OpenBlock about-menu title prop type.');
    }

    let transformedSource = source
        .replace(deviceSelectionPattern, '')
        .replace(connectionButtonPattern, '                    <EstStatusPanel />')
        .replace(editMenuPattern, '')
        .replace(openBlockUtilityItemsPattern, '')
        .replace(clearCacheMenuItemPattern, '')
        .replace(installDriverMenuSectionPattern, '')
        .replace(communityImport, '')
        .replace(communityHandlerPattern, [
            '    handleClickOpenCommunity () {',
            '        // Community navigation is not part of EST Studio.',
            '    }',
            ''
        ].join('\n'))
        .replace(programModePattern, '')
        .replace(aboutTitlePropType, '                title: PropTypes.node, // rendered menu label')
        .replace("import Switch from 'react-switch';\n\n", '')
        .replace("import deviceIcon from './icon--device.svg';\n", '');

    // The compact test fixture above exercises structural menu replacements.
    // Full OpenBlock source also contains unreachable account/server features.
    if (transformedSource.includes(
        "import ShareButton from './share-button.jsx'; // eslint-disable-line no-unused-vars"
    )) {
        const unusedImportSuffix = ' // eslint-disable-line no-unused-vars\n';
        const onlineOnlyImports = [
            `import ShareButton from './share-button.jsx';${unusedImportSuffix}`,
            `import SaveStatus from './save-status.jsx';${unusedImportSuffix}`,
            `import ProjectWatcher from '../../containers/project-watcher.jsx';${unusedImportSuffix}`,
            "import AuthorInfo from './author-info.jsx';\n",
            `import AccountNav from '../../containers/account-nav.jsx';${unusedImportSuffix}`,
            `import LoginDropdown from './login-dropdown.jsx';${unusedImportSuffix}`,
            "import DeletionRestorer from '../../containers/deletion-restorer.jsx';\n",
            "import TurboMode from '../../containers/turbo-mode.jsx';\n",
            "import collectMetadata from '../../lib/collect-metadata';\n",
            "import remixIcon from './icon--remix.svg';\n",
            "import editIcon from './icon--edit.svg';\n"
        ];
        const projectStateImports = `import {
    autoUpdateProject,
    getIsUpdating,
    getIsShowingProject,
    manualUpdateProject,
    requestNewProject,
    remixProject,
    saveProjectAsCopy
} from '../../reducers/project-state';`;
        const menusImports = `import {
    openAboutMenu,
    closeAboutMenu,
    aboutMenuOpen,
    openAccountMenu,
    closeAccountMenu,
    accountMenuOpen,
    openFileMenu,
    closeFileMenu,
    fileMenuOpen,
    openEditMenu,
    closeEditMenu,
    editMenuOpen,
    openSettingMenu,
    closeSettingMenu,
    settingMenuOpen,
    openLanguageMenu,
    closeLanguageMenu,
    languageMenuOpen,
    openLoginMenu,
    closeLoginMenu,
    loginMenuOpen
} from '../../reducers/menus';`;
        const localMenusImports = `import {
    openAboutMenu,
    closeAboutMenu,
    aboutMenuOpen,
    openFileMenu,
    closeFileMenu,
    fileMenuOpen,
    openSettingMenu,
    closeSettingMenu,
    settingMenuOpen,
    openLanguageMenu,
    closeLanguageMenu,
    languageMenuOpen
} from '../../reducers/menus';`;
        const titleArea = `                        {this.props.canEditTitle ? (
                            <div className={classNames(styles.menuBarItem, styles.growable)}>
                                <MenuBarItemTooltip
                                    enable
                                    id="title-field"
                                >
                                    <ProjectTitleInput
                                        className={classNames(styles.titleFieldGrowable)}
                                    />
                                </MenuBarItemTooltip>
                            </div>
                        ) : ((this.props.authorUsername && this.props.authorUsername !== this.props.username) ? (
                            <AuthorInfo
                                className={styles.authorInfo}
                                imageUrl={this.props.authorThumbnailUrl}
                                projectTitle={this.props.projectTitle}
                                userId={this.props.authorId}
                                username={this.props.authorUsername}
                            />
                        ) : null)}`;
        const titleIndent = ' '.repeat(24);
        const localTitleArea = `${titleIndent}<div className={classNames(styles.menuBarItem, styles.growable)}>
                            <MenuBarItemTooltip
                                enable
                                id="title-field"
                            >
                                <ProjectTitleInput
                                    className={classNames(styles.titleFieldGrowable)}
                                />
                            </MenuBarItemTooltip>
                        </div>`;
        const onlineProjectMenuMarker = [
            '                                {(this.props.canSave || ',
            'this.props.canCreateCopy || this.props.canRemix) && ('
        ].join('');
        const telemetryMarker = [
            '                const metadata = collectMetadata(',
            'this.props.vm, this.props.projectTitle, this.props.locale);'
        ].join('');
        const requiredOnlineFragments = [
            ...onlineOnlyImports,
            projectStateImports,
            menusImports,
            titleArea,
            "import {setPlayer} from '../../reducers/mode';\n",
            "            'handleClickShare',\n",
            '    handleClickRemix () {',
            '    handleKeyPress (event) {',
            '        const saveNowMessage = (',
            '        const remixButton = (',
            onlineProjectMenuMarker,
            telemetryMarker
        ];
        if (!requiredOnlineFragments.every(fragment => transformedSource.includes(fragment))) {
            throw new Error('Unable to locate the OpenBlock account, sharing and telemetry code.');
        }

        for (const importLine of onlineOnlyImports) {
            transformedSource = transformedSource.replace(importLine, '');
        }
        transformedSource = transformedSource
            .replace(projectStateImports, "import {requestNewProject} from '../../reducers/project-state';")
            .replace(menusImports, localMenusImports)
            .replace("import {setPlayer} from '../../reducers/mode';\n", '')
            .replace(titleArea, localTitleArea)
            .replace(/ {12}'handleClickRemix',\r?\n/, '')
            .replace(/ {12}'handleClickSave',\r?\n/, '')
            .replace(/ {12}'handleClickSaveAsCopy',\r?\n/, '')
            .replace(/ {12}'handleClickSeeCommunity',\r?\n/, '')
            .replace(/ {12}'handleClickShare',\r?\n/, '')
            .replace(/ {12}'handleKeyPress',\r?\n/, '')
            .replace(/ {12}'handleRestoreOption',\r?\n/, '')
            .replace(/ {12}'restoreOptionMessage',\r?\n/, '')
            .replace(/ {8}document\.addEventListener\('keydown', this\.handleKeyPress\);\r?\n/, '')
            .replace(/ {8}document\.removeEventListener\('keydown', this\.handleKeyPress\);\r?\n/, '')
            .replace(new RegExp([
                ' {4}handleClickRemix \\(\\) \\{[\\s\\S]*?',
                ' {4}\\}\\r?\\n',
                '(?= {4}handleRestoreOption)'
            ].join('')), '')
            .replace(new RegExp([
                ' {4}handleRestoreOption \\(restoreFun\\) \\{[\\s\\S]*?',
                ' {4}\\}\\r?\\n',
                '(?= {4}handleKeyPress)'
            ].join('')), '')
            .replace(new RegExp([
                ' {4}handleKeyPress \\(event\\) \\{[\\s\\S]*?',
                ' {4}\\}\\r?\\n',
                '(?= {4}getSaveToComputerHandler)'
            ].join('')), '')
            .replace(new RegExp([
                ' {4}getSaveToComputerHandler \\(downloadProjectCallback\\) \\{[\\s\\S]*?',
                ' {4}\\}\\r?\\n',
                '(?= {4}handleLanguageMouseUp)'
            ].join('')), [
                '    getSaveToComputerHandler (downloadProjectCallback) {',
                '        return () => {',
                '            this.props.onRequestCloseFile();',
                '            downloadProjectCallback();',
                '        };',
                '    }',
                ''
            ].join('\n'))
            .replace(new RegExp([
                ' {4}restoreOptionMessage \\(deletedItem\\) \\{[\\s\\S]*?',
                ' {4}\\}\\r?\\n',
                '(?= {4}handleConnectionMouseUp)'
            ].join('')), '')
            .replace(new RegExp([
                ' {8}const saveNowMessage = \\(\\r?\\n[\\s\\S]*?',
                '(?= {8}const newProjectMessage)'
            ].join('')), '')
            .replace(new RegExp([
                ' {8}\\/\\/ eslint-disable-next-line no-unused-vars\\r?\\n',
                ' {8}const remixButton = \\(\\r?\\n[\\s\\S]*?',
                ' {8}\\);\\r?\\n'
            ].join('')), '')
            .replace(new RegExp([
                '\\r?\\n {32}\\{\\(this\\.props\\.canSave \\|\\| this\\.props\\.canCreateCopy \\|\\| ',
                'this\\.props\\.canRemix\\) && \\(\\r?\\n[\\s\\S]*?',
                '\\r?\\n {32}\\)\\}\\r?\\n'
            ].join('')), '\n')
            .replace('    onShare: () => {}\n', '')
            .replace('    const loadingState = state.scratchGui.projectState.loadingState;\n', '')
            .replace('    const user = state.session && state.session.session && state.session.session.user;\n', '')
            .replace('        accountMenuOpen: accountMenuOpen(state),\n', '')
            .replace('        editMenuOpen: editMenuOpen(state),\n', '')
            .replace('        isUpdating: getIsUpdating(loadingState),\n', '')
            .replace('        isShowingProject: getIsShowingProject(loadingState),\n', '')
            .replace('        loginMenuOpen: loginMenuOpen(state),\n', '')
            .replace("        sessionExists: state.session && typeof state.session.session !== 'undefined',\n", '')
            .replace('        username: user ? user.username : null,\n', '')
            .replace(new RegExp([
                ' {8}userOwnsProject: ownProps\\.authorUsername && user &&\\r?\\n',
                ' {12}\\(ownProps\\.authorUsername === user\\.username\\),\\r?\\n'
            ].join('')), '')
            .replace('const mapStateToProps = (state, ownProps) => {', 'const mapStateToProps = state => {')
            .replace('    autoUpdateProject: PropTypes.func,\n', '')
            .replace('    onProjectTelemetryEvent: PropTypes.func,\n', '')
            .replace('    autoUpdateProject: () => dispatch(autoUpdateProject()),\n', '')
            .replace('    onOpenTipLibrary: () => dispatch(openTipsLibrary()),\n', '')
            .replace('    onClickAccount: () => dispatch(openAccountMenu()),\n', '')
            .replace('    onRequestCloseAccount: () => dispatch(closeAccountMenu()),\n', '')
            .replace('    onClickEdit: () => dispatch(openEditMenu()),\n', '')
            .replace('    onRequestCloseEdit: () => dispatch(closeEditMenu()),\n', '')
            .replace('    onClickLogin: () => dispatch(openLoginMenu()),\n', '')
            .replace('    onRequestCloseLogin: () => dispatch(closeLoginMenu()),\n', '')
            .replace('    onClickRemix: () => dispatch(remixProject()),\n', '')
            .replace('    onClickSave: () => dispatch(manualUpdateProject()),\n', '')
            .replace('    onClickSaveAsCopy: () => dispatch(saveProjectAsCopy()),\n', '')
            .replace('    onSeeCommunity: () => dispatch(setPlayer(true)),\n', '');

        const obsoleteHardwareModalImports = `import {
    openTipsLibrary,
    openUploadProgress,
    openUpdateModal,
    openConnectionModal,
    openDeviceLibrary
} from '../../reducers/modals';`;
        const obsoleteHardwareDispatchStart = / {4}onSetUploadMode: \(\) => \{[\s\S]*?/;
        const obsoleteHardwareDispatchEnd =
            / {4}onDeviceIsEmpty: \(\) => showAlertWithTimeout\(dispatch, 'selectADeviceFirst'\)\r?\n/;
        const obsoleteHardwareDispatchPattern = new RegExp(
            obsoleteHardwareDispatchStart.source + obsoleteHardwareDispatchEnd.source
        );
        const obsoleteHardwareMethodsPattern =
            / {4}handleClickOpenCommunity \(\) \{[\s\S]*?(?= {4}handleCheckUpdate)/;
        const clearCacheMethodPattern = / {4}handleClearCache \(\) \{[\s\S]*?(?= {4}buildAboutMenu)/;
        const obsoleteConnectionImport = [
            'import {setRealtimeConnection, clearConnectionModalPeripheralName} ',
            "from '../../reducers/connection-modal';\n"
        ].join('');
        const obsoleteHardwareFragments = [
            obsoleteHardwareModalImports,
            "import {setStageSize} from '../../reducers/stage-size';\n",
            "import {setUploadMode, setRealtimeMode} from '../../reducers/program-mode';\n",
            obsoleteConnectionImport,
            "import {STAGE_SIZE_MODES} from '../../lib/layout-constants';\n",
            "import unconnectedIcon from './icon--unconnected.svg';\n",
            "import connectedIcon from './icon--connected.svg';\n",
            "import screenshotIcon from './icon--screenshot.svg';\n",
            "import uploadFirmwareIcon from './icon--upload-firmware.svg';\n",
            "import saveSvgAsPng from 'openblock-save-svg-as-png';\n",
            "import {showAlertWithTimeout} from '../../reducers/alerts';\n",
            "        this.props.vm.on('PERIPHERAL_DISCONNECTED', this.props.onDisconnect);\n",
            "        this.props.vm.on('PROGRAM_MODE_UPDATE', this.handleProgramModeUpdate);\n",
            "        this.props.vm.removeListener('PERIPHERAL_DISCONNECTED', this.props.onDisconnect);\n",
            "        this.props.vm.removeListener('PROGRAM_MODE_UPDATE', this.handleProgramModeUpdate);\n",
            '    handleConnectionMouseUp () {',
            '    handleUploadFirmware () {',
            '    handleScreenshot () {',
            '    onSetUploadMode: () => {',
            "    onDeviceIsEmpty: () => showAlertWithTimeout(dispatch, 'selectADeviceFirst')"
        ];
        if (!obsoleteHardwareFragments.every(fragment => transformedSource.includes(fragment)) ||
            !obsoleteHardwareDispatchPattern.test(transformedSource) ||
            !obsoleteHardwareMethodsPattern.test(transformedSource) ||
            !clearCacheMethodPattern.test(transformedSource)) {
            throw new Error('Unable to locate the obsolete OpenBlock hardware menu logic.');
        }

        transformedSource = transformedSource
            .replace(obsoleteHardwareModalImports, "import {openUpdateModal} from '../../reducers/modals';")
            .replace("import VM from 'openblock-vm';\n\n", '')
            .replace("import {setStageSize} from '../../reducers/stage-size';\n", '')
            .replace("import {setUploadMode, setRealtimeMode} from '../../reducers/program-mode';\n", '')
            .replace(obsoleteConnectionImport, '')
            .replace("import {STAGE_SIZE_MODES} from '../../lib/layout-constants';\n", '')
            .replace("import helpIcon from '../../lib/assets/icon--tutorials.svg';\n", '')
            .replace("import wikiIcon from './icon--wiki.svg';\n", '')
            .replace("import unconnectedIcon from './icon--unconnected.svg';\n", '')
            .replace("import connectedIcon from './icon--connected.svg';\n", '')
            .replace("import screenshotIcon from './icon--screenshot.svg';\n", '')
            .replace("import uploadFirmwareIcon from './icon--upload-firmware.svg';\n", '')
            .replace("import saveSvgAsPng from 'openblock-save-svg-as-png';\n", '')
            .replace("import {showAlertWithTimeout} from '../../reducers/alerts';\n", '')
            .replace(/ {12}'handleClickOpenCommunity',\r?\n/, '')
            .replace(/ {12}'handleClickOpenWiki',\r?\n/, '')
            .replace(/ {12}'handleConnectionMouseUp',\r?\n/, '')
            .replace(/ {12}'handleUploadFirmware',\r?\n/, '')
            .replace(/ {12}'handleSelectDeviceMouseUp',\r?\n/, '')
            .replace(/ {12}'handleProgramModeSwitchOnChange',\r?\n/, '')
            .replace(/ {12}'handleProgramModeUpdate',\r?\n/, '')
            .replace(/ {12}'handleScreenshot',\r?\n/, '')
            .replace(/ {12}'handleClearCache'\r?\n/, '')
            .replace("        this.props.vm.on('PERIPHERAL_DISCONNECTED', this.props.onDisconnect);\n", '')
            .replace("        this.props.vm.on('PROGRAM_MODE_UPDATE', this.handleProgramModeUpdate);\n", '')
            .replace("        this.props.vm.removeListener('PERIPHERAL_DISCONNECTED', this.props.onDisconnect);\n", '')
            .replace("        this.props.vm.removeListener('PROGRAM_MODE_UPDATE', this.handleProgramModeUpdate);\n", '')
            .replace(obsoleteHardwareMethodsPattern, '')
            .replace(clearCacheMethodPattern, '')
            .replace('    confirmClearCache: PropTypes.func,\n', '')
            .replace('    isRealtimeMode: PropTypes.bool.isRequired,\n', '')
            .replace('    isSupportSwitchMode: PropTypes.bool,\n', '')
            .replace('    onClickClearCache: PropTypes.func,\n', '')
            .replace('    onClickInstallDriver: PropTypes.func,\n', '')
            .replace('    onNoPeripheralIsConnected: PropTypes.func.isRequired,\n', '')
            .replace('    onOpenTipLibrary: PropTypes.func,\n', '')
            .replace('    realtimeConnection: PropTypes.bool.isRequired,\n', '')
            .replace('    showComingSoon: PropTypes.bool,\n', '')
            .replace('    stageSizeMode: PropTypes.oneOf(Object.keys(STAGE_SIZE_MODES)),\n', '')
            .replace('    vm: PropTypes.instanceOf(VM).isRequired,\n', '')
            .replace('    onSetUploadMode: PropTypes.func,\n', '')
            .replace('    onSetRealtimeConnection: PropTypes.func.isRequired,\n', '')
            .replace('    onSetRealtimeMode: PropTypes.func,\n', '')
            .replace('    onOpenConnectionModal: PropTypes.func,\n', '')
            .replace('    onOpenUploadProgress: PropTypes.func,\n', '')
            .replace('    peripheralName: PropTypes.string,\n', '')
            .replace('    onDisconnect: PropTypes.func.isRequired,\n', '')
            .replace('    onWorkspaceIsEmpty: PropTypes.func.isRequired,\n', '')
            .replace('    onWorkspaceIsNotEmpty: PropTypes.func.isRequired,\n', '')
            .replace('    onOpenDeviceLibrary: PropTypes.func,\n', '')
            .replace('    onSetStageLarge: PropTypes.func.isRequired,\n', '')
            .replace('    deviceId: PropTypes.string,\n', '')
            .replace('    deviceName: PropTypes.string,\n', '')
            .replace('    onDeviceIsEmpty: PropTypes.func\n', '')
            .replace('        isRealtimeMode: state.scratchGui.programMode.isRealtimeMode,\n', '')
            .replace('        isSupportSwitchMode: state.scratchGui.programMode.isSupportSwitchMode,\n', '')
            .replace('        realtimeConnection: state.scratchGui.connectionModal.realtimeConnection,\n', '')
            .replace('        stageSizeMode: state.scratchGui.stageSize.stageSize,\n', '')
            .replace('        vm: state.scratchGui.vm,\n', '')
            .replace('        peripheralName: state.scratchGui.connectionModal.peripheralName,\n', '')
            .replace('        deviceId: state.scratchGui.device.deviceId,\n', '')
            .replace('        deviceName: state.scratchGui.device.deviceName\n', '')
            .replace(obsoleteHardwareDispatchPattern, [
                '    onSetUpdate: message => {',
                '        dispatch(setUpdate(message));',
                '        dispatch(openUpdateModal());',
                '    }',
                ''
            ].join('\n'));

        const obsoleteMenuPropTypes = [
            'accountMenuOpen: PropTypes.bool',
            'authorId: PropTypes.oneOfType([PropTypes.string, PropTypes.bool])',
            'authorThumbnailUrl: PropTypes.string',
            'authorUsername: PropTypes.oneOfType([PropTypes.string, PropTypes.bool])',
            'canCreateCopy: PropTypes.bool',
            'canEditTitle: PropTypes.bool',
            'canRemix: PropTypes.bool',
            'canShare: PropTypes.bool',
            'editMenuOpen: PropTypes.bool',
            'enableCommunity: PropTypes.bool',
            'isUpdating: PropTypes.bool',
            'isShared: PropTypes.bool',
            'isShowingProject: PropTypes.bool',
            'loginMenuOpen: PropTypes.bool',
            'onClickAccount: PropTypes.func',
            'onClickEdit: PropTypes.func',
            'onClickLogin: PropTypes.func',
            'onClickRemix: PropTypes.func',
            'onClickSave: PropTypes.func',
            'onClickSaveAsCopy: PropTypes.func',
            'onLogOut: PropTypes.func',
            'onOpenRegistration: PropTypes.func',
            'onRequestCloseAccount: PropTypes.func',
            'onRequestCloseEdit: PropTypes.func',
            'onRequestCloseLogin: PropTypes.func',
            'onSeeCommunity: PropTypes.func',
            'onShare: PropTypes.func',
            'onToggleLoginOpen: PropTypes.func',
            'projectTitle: PropTypes.string',
            'renderLogin: PropTypes.func',
            'sessionExists: PropTypes.bool',
            'shouldSaveBeforeTransition: PropTypes.func',
            'userOwnsProject: PropTypes.bool',
            'username: PropTypes.string'
        ];
        for (const propType of obsoleteMenuPropTypes) {
            const propTypeLine = `    ${propType},\n`;
            if (!transformedSource.includes(propTypeLine)) {
                throw new Error(`Unable to locate obsolete OpenBlock menu prop type: ${propType}.`);
            }
            transformedSource = transformedSource.replace(propTypeLine, '');
        }
    }

    return `import EstStatusPanel from 'est-status-panel';\n${transformedSource}`;
};
