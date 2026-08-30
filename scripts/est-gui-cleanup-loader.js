/**
 * Strip Scratch-style UI surfaces that are unreachable in EST Studio's single
 * upload mode. Core blocks, alerts, generated code, upload progress and update
 * UI remain intact. Keeping this transform in the application repository avoids
 * editing the installed openblock-gui package directly.
 * @param {string} source - OpenBlock GUI component source.
 * @returns {string} transformed component source.
 */
module.exports = function (source) {
    const removeRequired = (input, pattern, label) => {
        if (!pattern.test(input)) {
            throw new Error(`Unable to locate the OpenBlock ${label}.`);
        }
        return input.replace(pattern, '');
    };

    const obsoleteImports = [
        "import Renderer from 'scratch-render';",
        "import CostumeTab from '../../containers/costume-tab.jsx';",
        "import TargetPane from '../../containers/target-pane.jsx';",
        "import SoundTab from '../../containers/sound-tab.jsx';",
        "import StageWrapper from '../../containers/stage-wrapper.jsx';",
        "import CostumeLibrary from '../../containers/costume-library.jsx';",
        "import BackdropLibrary from '../../containers/backdrop-library.jsx';",
        "import HardwareHeader from '../../containers/hardware-header.jsx';",
        '// eslint-disable-next-line no-unused-vars\n' +
            "import Backpack from '../../containers/backpack.jsx';",
        "import WebGlModal from '../../containers/webgl-modal.jsx';",
        "import TipsLibrary from '../../containers/tips-library.jsx';",
        "import Cards from '../../containers/cards.jsx';",
        "import ConnectionModal from '../../containers/connection-modal.jsx';",
        "import TelemetryModal from '../telemetry-modal/telemetry-modal.jsx';",
        "import costumesIcon from './icon--costumes.svg';",
        "import soundsIcon from './icon--sounds.svg';"
    ];

    let transformedSource = source;
    for (const importLine of obsoleteImports) {
        const escapedImport = importLine
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\\\n/g, '\\r?\\n');
        const pattern = new RegExp(`${escapedImport}\\r?\\n`);
        transformedSource = removeRequired(transformedSource, pattern, `GUI import: ${importLine}`);
    }

    transformedSource = removeRequired(transformedSource, new RegExp([
        '// Cache this value to only retrieve it once the first time\\.\\r?\\n',
        "// Assume that it doesn't change for a session\\.\\r?\\n",
        'let isRendererSupported = null;\\r?\\n\\r?\\n'
    ].join('')), 'stage renderer capability cache');

    transformedSource = removeRequired(transformedSource, new RegExp([
        ' {4}if \\(isRendererSupported === null\\) \\{\\r?\\n',
        ' {8}isRendererSupported = Renderer\\.isSupported\\(\\);\\r?\\n',
        ' {4}\\}\\r?\\n\\r?\\n'
    ].join('')), 'stage renderer capability check');

    transformedSource = transformedSource.replace(new RegExp([
        ' {8}return isPlayerOnly \\? \\(\\r?\\n',
        ' {12}<StageWrapper[\\s\\S]*?\\r?\\n',
        ' {8}\\) : \\(\\r?\\n',
        '(?= {12}<Box)'
    ].join('')), '        return (\n');

    if (transformedSource.includes('return isPlayerOnly ? (')) {
        throw new Error('Unable to remove the OpenBlock player-only stage.');
    }

    const obsoleteRenderPatterns = [
        {
            label: 'telemetry modal',
            pattern: / {16}\{telemetryModalVisible \? \([\s\S]*? {16}\) : null\}\r?\n/
        },
        {
            label: 'WebGL stage warning',
            pattern: new RegExp([
                ' {16}\\{isRendererSupported \\? null : \\(\\r?\\n',
                ' {20}<WebGlModal isRtl=\\{isRtl\\} \\/>\\r?\\n',
                ' {16}\\)\\}\\r?\\n'
            ].join(''))
        },
        {
            label: 'tutorial library',
            pattern: / {16}\{tipsLibraryVisible \? \([\s\S]*? {16}\) : null\}\r?\n/
        },
        {
            label: 'tutorial cards',
            pattern: / {16}\{cardsVisible \? \([\s\S]*? {16}\) : null\}\r?\n/
        },
        {
            label: 'generic connection modal',
            pattern: / {16}\{connectionModalVisible \? \([\s\S]*? {16}\) : null\}\r?\n/
        },
        {
            label: 'costume library',
            pattern: / {16}\{costumeLibraryVisible \? \([\s\S]*? {16}\) : null\}\r?\n/
        },
        {
            label: 'backdrop library',
            pattern: / {16}\{backdropLibraryVisible \? \([\s\S]*? {16}\) : null\}\r?\n/
        },
        {
            label: 'costume and sound tabs',
            pattern: new RegExp([
                ' {36}<Tab\\r?\\n',
                ' {40}className=\\{classNames\\(tabClassNames\\.tab,\\r?\\n',
                ' {44}isRealtimeMode \\? styles\\.hideCustomAndSoundTab',
                '[\\s\\S]*?\\r?\\n',
                ' {36}<\\/Tab>\\r?\\n',
                '(?= {32}<\\/TabList>)'
            ].join(''))
        },
        {
            label: 'costume and sound panels',
            pattern: new RegExp([
                ' {32}<TabPanel className=\\{tabClassNames\\.tabPanel\\}>\\r?\\n',
                ' {36}\\{costumesTabVisible',
                '[\\s\\S]*?\\r?\\n',
                ' {32}<\\/TabPanel>\\r?\\n',
                '(?= {28}<\\/Tabs>)'
            ].join(''))
        },
        {
            label: 'backpack placeholder',
            pattern: / {28}\{\/\*[\s\S]*?backpackVisible[\s\S]*? {32}\*\/\}\r?\n/
        },
        {
            label: 'stage and target pane',
            pattern: new RegExp([
                ' {24}<Box\\r?\\n',
                ' {28}className=\\{classNames\\(styles\\.stageAndTargetWrapper, styles\\[stageSize\\],',
                '[\\s\\S]*?\\r?\\n',
                ' {24}<\\/Box>\\r?\\n',
                '(?= {24}\\{\\(\\(isRealtimeMode === false\\))'
            ].join(''))
        },
        {
            label: 'legacy hardware upload header',
            pattern: new RegExp([
                ' {20}\\{\\(isRealtimeMode === false\\) \\? \\(\\r?\\n',
                ' {24}<HardwareHeader\\r?\\n',
                ' {28}vm=\\{vm\\}\\r?\\n',
                ' {28}stageSize=\\{stageSize\\}\\r?\\n',
                ' {24}\\/>\\) : null\\r?\\n',
                ' {20}\\}\\r?\\n'
            ].join(''))
        }
    ];

    for (const {pattern, label} of obsoleteRenderPatterns) {
        transformedSource = removeRequired(transformedSource, pattern, label);
    }

    transformedSource = removeRequired(
        transformedSource,
        / {20}onProjectTelemetryEvent=\{onProjectTelemetryEvent\}\r?\n/,
        'menu telemetry callback'
    );
    transformedSource = removeRequired(
        transformedSource,
        / {8}onClickCheckUpdate,\r?\n/,
        'GUI check-update menu callback'
    );

    const obsoleteMenuProps = [
        'accountNavOpen',
        'authorId',
        'authorThumbnailUrl',
        'authorUsername',
        'canCreateCopy',
        'canEditTitle',
        'canRemix',
        'canShare',
        'enableCommunity',
        'isShared',
        'renderLogin',
        'showComingSoon',
        'onClickAccountNav',
        'onClickCheckUpdate',
        'onCloseAccountNav',
        'onLogOut',
        'onOpenRegistration',
        'onSeeCommunity',
        'onShare',
        'onToggleLoginOpen',
        'onClickClearCache',
        'onClickInstallDriver'
    ];
    for (const propName of obsoleteMenuProps) {
        transformedSource = removeRequired(
            transformedSource,
            new RegExp(` {20}${propName}=\\{${propName}\\}\\r?\\n`),
            `obsolete menu property: ${propName}`
        );
    }

    const obsoletePropTypes = [
        'backdropLibraryVisible: PropTypes.bool',
        'backpackHost: PropTypes.string',
        'backpackVisible: PropTypes.bool',
        'cardsVisible: PropTypes.bool',
        'costumeLibraryVisible: PropTypes.bool',
        'costumesTabVisible: PropTypes.bool',
        'isPlayerOnly: PropTypes.bool',
        'onClickCheckUpdate: PropTypes.func',
        'onActivateCostumesTab: PropTypes.func',
        'onActivateSoundsTab: PropTypes.func',
        'onRequestCloseBackdropLibrary: PropTypes.func',
        'onRequestCloseCostumeLibrary: PropTypes.func',
        'onRequestCloseTelemetryModal: PropTypes.func',
        'onShowPrivacyPolicy: PropTypes.func',
        'onTelemetryModalCancel: PropTypes.func',
        'onTelemetryModalOptIn: PropTypes.func',
        'onTelemetryModalOptOut: PropTypes.func',
        'soundsTabVisible: PropTypes.bool',
        'targetIsStage: PropTypes.bool',
        'telemetryModalVisible: PropTypes.bool',
        'tipsLibraryVisible: PropTypes.bool'
    ];
    for (const propType of obsoletePropTypes) {
        const escapedPropType = propType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        transformedSource = removeRequired(
            transformedSource,
            new RegExp(` {4}${escapedPropType},\\r?\\n`),
            `obsolete GUI prop type: ${propType}`
        );
    }

    const obsoleteMenuPropTypes = [
        'accountNavOpen: PropTypes.bool',
        'authorId: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]), // can be false',
        'authorThumbnailUrl: PropTypes.string',
        'authorUsername: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]), // can be false',
        'canCreateCopy: PropTypes.bool',
        'canEditTitle: PropTypes.bool',
        'canRemix: PropTypes.bool',
        'canShare: PropTypes.bool',
        'enableCommunity: PropTypes.bool',
        'isShared: PropTypes.bool',
        'onClickAccountNav: PropTypes.func',
        'onClickClearCache: PropTypes.func',
        'onClickInstallDriver: PropTypes.func',
        'onCloseAccountNav: PropTypes.func',
        'onLogOut: PropTypes.func',
        'onOpenRegistration: PropTypes.func',
        'onSeeCommunity: PropTypes.func',
        'onShare: PropTypes.func',
        'onToggleLoginOpen: PropTypes.func',
        'renderLogin: PropTypes.func',
        'showComingSoon: PropTypes.bool'
    ];
    for (const propType of obsoleteMenuPropTypes) {
        const escapedPropType = propType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const lineSuffix = propType.includes('//') ? '' : ',';
        transformedSource = removeRequired(
            transformedSource,
            new RegExp(` {4}${escapedPropType}${lineSuffix}\\r?\\n`),
            `obsolete GUI menu prop type: ${propType}`
        );
    }

    transformedSource = removeRequired(
        transformedSource,
        / {4}backpackHost: null,\r?\n {4}backpackVisible: false,\r?\n/,
        'backpack defaults'
    );

    const programControlsMarker = new RegExp([
        ' {36}<\\/Box>\\r?\\n',
        ' {36}<Box className=\\{styles\\.extensionButtonContainer\\}>'
    ].join(''));
    if (!programControlsMarker.test(transformedSource)) {
        throw new Error('Unable to locate the EST blocks workspace controls insertion point.');
    }
    transformedSource = transformedSource.replace(programControlsMarker, [
        '                                    </Box>\n',
        '                                    <EstProgramControls />\n',
        '                                    <Box className={styles.extensionButtonContainer}>'
    ].join(''));

    const obsoleteMenuDefaults = [
        'canCreateCopy: false',
        'canEditTitle: false',
        'canRemix: false',
        'canShare: false',
        'enableCommunity: false',
        'isShared: false',
        'showComingSoon: false'
    ];
    for (const defaultValue of obsoleteMenuDefaults) {
        transformedSource = removeRequired(
            transformedSource,
            new RegExp(` {4}${defaultValue},\\r?\\n`),
            `obsolete GUI menu default: ${defaultValue}`
        );
    }

    return `import EstProgramControls from 'est-program-controls';\n${transformedSource}`;
};
