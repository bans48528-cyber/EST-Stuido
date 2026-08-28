/**
 * Remove Scratch's server-side project saver, cloud connection manager and
 * state mappings for GUI surfaces already removed from EST Studio. The local
 * file workflow, extension library, VM and single code tab remain intact.
 * @param {string} source - OpenBlock GUI container source.
 * @returns {string} GUI container without unused online HOCs.
 */
module.exports = function (source) {
    const normalizedSource = source.replace(/\r\n/g, '\n');
    const editorTabImports = `import {
    activateTab,
    BLOCKS_TAB_INDEX,
    COSTUMES_TAB_INDEX,
    SOUNDS_TAB_INDEX
} from '../reducers/editor-tab';`;
    const localEditorTabImports = `import {
    activateTab,
    BLOCKS_TAB_INDEX
} from '../reducers/editor-tab';`;
    const modalImports = `import {
    closeCostumeLibrary,
    closeBackdropLibrary,
    closeTelemetryModal,
    openExtensionLibrary
} from '../reducers/modals';`;
    const localModalImports = "import {openExtensionLibrary} from '../reducers/modals';";
    const targetStageMapping = `        targetIsStage: (
            state.scratchGui.targets.stage &&
            state.scratchGui.targets.stage.id === state.scratchGui.targets.editingTarget
        ),
`;
    const requiredFragments = [
        "import ProjectSaverHOC from '../lib/project-saver-hoc.jsx';\n",
        "import QueryParserHOC from '../lib/query-parser-hoc.jsx';\n",
        "import cloudManagerHOC from '../lib/cloud-manager-hoc.jsx';\n",
        '    ProjectSaverHOC,\n',
        '    QueryParserHOC,\n',
        '    cloudManagerHOC\n',
        editorTabImports,
        modalImports,
        targetStageMapping,
        '        backdropLibraryVisible: state.scratchGui.modals.backdropLibrary,\n',
        '        cardsVisible: state.scratchGui.cards.visible,\n',
        '        connectionModalVisible: state.scratchGui.modals.connectionModal,\n',
        '        costumeLibraryVisible: state.scratchGui.modals.costumeLibrary,\n',
        '        costumesTabVisible: state.scratchGui.editorTab.activeTabIndex === COSTUMES_TAB_INDEX,\n',
        '        isPlayerOnly: state.scratchGui.mode.isPlayerOnly,\n',
        '        soundsTabVisible: state.scratchGui.editorTab.activeTabIndex === SOUNDS_TAB_INDEX,\n',
        '        telemetryModalVisible: state.scratchGui.modals.telemetryModal,\n',
        '        tipsLibraryVisible: state.scratchGui.modals.tipsLibrary,\n',
        '    onActivateCostumesTab: () => dispatch(activateTab(COSTUMES_TAB_INDEX)),\n',
        '    onActivateSoundsTab: () => dispatch(activateTab(SOUNDS_TAB_INDEX)),\n',
        '    onRequestCloseBackdropLibrary: () => dispatch(closeBackdropLibrary()),\n',
        '    onRequestCloseCostumeLibrary: () => dispatch(closeCostumeLibrary()),\n',
        '    onRequestCloseTelemetryModal: () => dispatch(closeTelemetryModal())\n'
    ];

    if (!requiredFragments.every(fragment => normalizedSource.includes(fragment))) {
        throw new Error('Unable to locate the OpenBlock online or obsolete GUI container code.');
    }

    return normalizedSource
        .replace("import ProjectSaverHOC from '../lib/project-saver-hoc.jsx';\n", '')
        .replace("import QueryParserHOC from '../lib/query-parser-hoc.jsx';\n", '')
        .replace("import cloudManagerHOC from '../lib/cloud-manager-hoc.jsx';\n", '')
        .replace('    ProjectSaverHOC,\n', '')
        .replace('    QueryParserHOC,\n', '')
        .replace(',\n    cloudManagerHOC\n', '\n')
        .replace(editorTabImports, localEditorTabImports)
        .replace(modalImports, localModalImports)
        .replace('    telemetryModalVisible: PropTypes.bool,\n', '')
        .replace('        backdropLibraryVisible: state.scratchGui.modals.backdropLibrary,\n', '')
        .replace('        cardsVisible: state.scratchGui.cards.visible,\n', '')
        .replace('        connectionModalVisible: state.scratchGui.modals.connectionModal,\n', '')
        .replace('        costumeLibraryVisible: state.scratchGui.modals.costumeLibrary,\n', '')
        .replace(
            '        costumesTabVisible: state.scratchGui.editorTab.activeTabIndex === COSTUMES_TAB_INDEX,\n',
            ''
        )
        .replace('        isPlayerOnly: state.scratchGui.mode.isPlayerOnly,\n', '')
        .replace(
            '        soundsTabVisible: state.scratchGui.editorTab.activeTabIndex === SOUNDS_TAB_INDEX,\n',
            ''
        )
        .replace(targetStageMapping, '')
        .replace('        telemetryModalVisible: state.scratchGui.modals.telemetryModal,\n', '')
        .replace('        tipsLibraryVisible: state.scratchGui.modals.tipsLibrary,\n', '')
        .replace('    onActivateCostumesTab: () => dispatch(activateTab(COSTUMES_TAB_INDEX)),\n', '')
        .replace('    onActivateSoundsTab: () => dispatch(activateTab(SOUNDS_TAB_INDEX)),\n', '')
        .replace('    onRequestCloseBackdropLibrary: () => dispatch(closeBackdropLibrary()),\n', '')
        .replace('    onRequestCloseCostumeLibrary: () => dispatch(closeCostumeLibrary()),\n', '')
        .replace('    onRequestCloseTelemetryModal: () => dispatch(closeTelemetryModal())\n', '');
};
