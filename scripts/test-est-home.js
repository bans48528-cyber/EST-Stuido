const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const path = require('path');
const babel = require('@babel/core');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const rendererRoot = path.join(root, 'src', 'renderer');
const originalLoader = Module._extensions['.js'];
Module._extensions['.js'] = (module, filename) => {
    if (!filename.startsWith(rendererRoot)) return originalLoader(module, filename);
    const transformed = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
        babelrc: false,
        plugins: ['@babel/plugin-transform-modules-commonjs']
    });
    module._compile(transformed.code, filename);
};

const {
    canLoadHomeProject,
    normalizeHomeProjectData
} = require(path.join(rendererRoot, 'est-home-project.js'));
const {
    EST_HOME_BUILD_CATEGORIES,
    EST_HOME_BUILD_ITEMS
} = require(path.join(rendererRoot, 'est-home-build-library.js'));
const {
    EST_HOME_BLOCK_GUIDE_CATEGORIES,
    EST_HOME_CUSTOM_BLOCK_IDS
} = require(path.join(rendererRoot, 'est-home-block-guide.js'));
const {getEstText} = require(path.join(rendererRoot, 'est-i18n.js'));

const appSource = read('src/renderer/app.jsx');
const homeSource = read('src/renderer/EstHome.jsx');
const homeStyles = read('src/renderer/EstHome.css');
const blockPreviewSource = read('src/renderer/est-home-block-previews.js');
const homeEvents = read('src/renderer/est-home-events.js');
const menuLayout = read('src/renderer/EstMenuBarLayout.jsx');
const desktopHoc = read('src/renderer/ScratchDesktopGUIHOC.jsx');
const mainSource = read('src/main/index.js');
const i18nSource = read('src/renderer/est-i18n.js');
const projectFileLoader = read('scripts/est-project-file-loader.js');

for (const asset of [
    'home-icon-file.png',
    'home-icon-build.png',
    'home-icon-more.png',
    'home-icon-start.png',
    'editor-screenshot.png',
    'home-guide-ai-welcome.png',
    'home-guide-ai-settings.png',
    'home-guide-ai-conversation.png'
]) {
    const assetPath = path.join(root, 'src', 'renderer', 'est-home-assets', asset);
    assert.ok(fs.existsSync(assetPath), `missing home asset: ${asset}`);
    assert.ok(fs.statSync(assetPath).size > 0, `empty home asset: ${asset}`);
}

assert.match(appSource, /homeVisible: true/);
assert.match(appSource, /homeMounted: true/);
assert.match(appSource, /canReturnToEditor: false/);
assert.match(appSource, /onReturnToEditor=\{this\.handleReturnToEditor\}/);
assert.match(appSource, /HOME_TRANSITION_DURATION/);
assert.match(appSource, /styles\.editorShellBehindHome/);
assert.match(appSource, /visible=\{this\.state\.homeVisible\}/);
assert.match(appSource, /est-home-get-startup-state/);
assert.match(homeSource, /home\.nav\.files/);
assert.match(homeSource, /home\.nav\.build/);
assert.match(homeSource, /home\.nav\.more/);
assert.match(homeSource, /home\.recentFiles/);
assert.match(homeSource, /home\.returnToEditor/);
assert.match(homeSource, /this\.props\.canReturnToEditor/);
assert.match(homeSource, /styles\.homeHidden/);
assert.match(homeSource, /onClick=\{this\.props\.onReturnToEditor\}/);
assert.match(homeSource, /renderProgrammingAnimation/);
assert.match(homeSource, /styles\.eventProgramBlock/);
assert.match(homeSource, /styles\.motorProgramBlock/);
assert.match(homeSource, /styles\.displayProgramBlock/);
assert.match(homeSource, /styles\.blockShape/);
assert.match(homeSource, /c 25,-22 71,-22 96,0/);
assert.match(homeSource, /m 0,4 A 4,4 0 0,1 4,0 H 12/);
assert.match(homeSource, /styles\.executionPulse/);
assert.match(homeSource, /renderProgrammingTheme\('arm'/);
assert.match(homeSource, /renderProgrammingTheme\('robot'/);
assert.match(homeSource, /renderProgrammingTheme\('car'/);
assert.match(homeSource, /renderArmVisual/);
assert.match(homeSource, /renderRobotVisual/);
assert.match(homeSource, /renderCarVisual/);
assert.match(homeSource, /styles\.robotStatusLight/);
assert.match(homeSource, /styles\.armLift/);
assert.match(homeSource, /styles\.carWheel/);
assert.match(homeSource, /styles\.robotSmile/);
assert.doesNotMatch(homeSource, /PRODUCT_HEROES|productHero|productIndex|productTimer/);
assert.match(homeSource, /project\.thumbnail \|\| fileIcon/);
assert.doesNotMatch(homeSource, /src=\{editorThumbnail\}/);
assert.match(homeSource, /home\.delete/);
assert.match(homeSource, /home\.rename/);
assert.match(homeSource, /home\.copy/);
assert.match(homeSource, /EST_LOCALE_NAMES/);
assert.match(homeSource, /est-home-get-build-library-state/);
assert.match(homeSource, /est-home-download-build-library/);
assert.match(homeSource, /est-home-build-download-progress/);
assert.match(homeSource, /est-home-pause-build-library-download/);
assert.match(homeSource, /est-home-resume-build-library-download/);
assert.match(homeSource, /est-home-cancel-build-library-download/);
assert.match(homeSource, /buildLibraryInstalled/);
assert.match(homeSource, /est-home-open-build-guide/);
assert.match(homeSource, /const INFO_DIALOGS =/);
assert.match(homeSource, /home\.dialog\.interaction\.connectTitle/);
assert.match(homeSource, /home\.dialog\.hardware\.sensorTitle/);
assert.match(homeSource, /home\.dialog\.hardware\.firmwareTitle/);
assert.match(homeSource, /home\.dialog\.hardware\.firmwareNote/);
assert.match(homeSource, /home\.dialog\.blocks\.lead/);
assert.match(homeSource, /home\.dialog\.ai\.setupTitle/);
assert.match(homeSource, /home\.dialog\.ai\.applyTitle/);
assert.match(homeSource, /home-guide-ai-conversation\.png/);
assert.match(homeSource, /home\.dialog\.software\.fileTitle/);
assert.match(homeSource, /home\.dialog\.about\.supportTitle/);
assert.match(homeSource, /const List = section\.ordered \? 'ol' : 'ul'/);
assert.match(homeSource, /EST_HOME_BLOCK_GUIDE_CATEGORIES\.map/);
assert.match(homeSource, /home\.blockGuide\.\$\{blockId\}/);
assert.match(homeSource, /createEstBlockPreviews/);
assert.match(homeSource, /styles\.blockGuidePreview/);
assert.match(homeSource, /<img/);
assert.match(homeStyles, /transition: transform 420ms/);
assert.match(homeStyles, /\.homeVisible/);
assert.match(homeStyles, /\.homeHidden/);
assert.match(homeStyles, /overflow-y: auto/);
assert.match(homeStyles, /\.guideSections/);
assert.match(homeStyles, /\.guideNote/);
assert.match(homeStyles, /\.guideFigure/);
assert.match(homeStyles, /\.guideBackdrop/);
assert.match(homeStyles, /\.guideScroller/);
assert.match(homeStyles, /\.guideDialog[\s\S]*?overflow: hidden/);
assert.match(homeStyles, /\.blockGuideEntry/);
assert.match(homeStyles, /@keyframes eventBlockCycle/);
assert.match(homeStyles, /@keyframes executionPulseCycle/);
assert.match(homeStyles, /@keyframes themeCycle/);
assert.match(homeStyles, /@keyframes armLiftCycle/);
assert.match(homeStyles, /@keyframes robotWaveCycle/);
assert.match(homeStyles, /@keyframes carWheelCycle/);
assert.match(homeStyles, /animation: themeCycle 24s/);
assert.match(homeStyles, /animation: eventBlockCycle 8s/);
assert.match(homeStyles, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(homeStyles, /\.blockShape path/);
assert.match(homeStyles, /--est-home-block-fill: #f5c400/);
assert.match(homeStyles, /--est-home-block-fill: #0090f5/);
assert.match(homeStyles, /--est-home-block-fill: #935df5/);
assert.doesNotMatch(homeStyles, /\.productTrack|\.productDots|\.activeDot/);
assert.match(blockPreviewSource, /new ScratchBlocks\.WorkspaceSvg/);
assert.match(blockPreviewSource, /ScratchBlocks\.DataCategory/);
assert.match(blockPreviewSource, /computedStyleToInlineStyle/);
assert.match(blockPreviewSource, /inlineSvgImageReferences/);
assert.match(blockPreviewSource, /xlink:href/);
assert.match(blockPreviewSource, /data:image\/svg\+xml/);

assert.deepStrictEqual(EST_HOME_BUILD_CATEGORIES, ['basic', 'pbl']);
assert.strictEqual(EST_HOME_BUILD_ITEMS.length, 8);
assert.strictEqual(EST_HOME_BUILD_ITEMS.filter(item => item.category === 'basic').length, 4);
assert.strictEqual(EST_HOME_BUILD_ITEMS.filter(item => item.category === 'pbl').length, 4);
for (const item of EST_HOME_BUILD_ITEMS) {
    for (const [directory, extension] of [['guides', 'pdf'], ['thumbnails', 'jpg']]) {
        const assetPath = path.join(root, 'resources', 'est-build-library', directory, `${item.id}.${extension}`);
        assert.ok(fs.existsSync(assetPath), `missing build library asset: ${assetPath}`);
        assert.ok(fs.statSync(assetPath).size > 0, `empty build library asset: ${assetPath}`);
    }
}

assert.strictEqual(EST_HOME_CUSTOM_BLOCK_IDS.length, 81);
assert.strictEqual(EST_HOME_BLOCK_GUIDE_CATEGORIES.length, 10);
assert.ok(
    EST_HOME_BLOCK_GUIDE_CATEGORIES.every(category => category.modes && category.modes.length),
    'every block category should explain its modes or parameters'
);
const documentedBlockIds = EST_HOME_BLOCK_GUIDE_CATEGORIES.reduce(
    (ids, category) => ids.concat(category.items),
    []
);
assert.strictEqual(documentedBlockIds.length, 114);
assert.strictEqual(new Set(documentedBlockIds).size, documentedBlockIds.length);
for (const blockId of documentedBlockIds) {
    const messageId = `home.blockGuide.${blockId}`;
    assert.match(getEstText(messageId, 'zh-cn'), /｜/, `missing Chinese block guide: ${blockId}`);
    assert.match(getEstText(messageId, 'en'), /｜/, `missing English block guide: ${blockId}`);
}
const documentedModeIds = EST_HOME_BLOCK_GUIDE_CATEGORIES.reduce(
    (ids, category) => ids.concat(category.modes),
    []
);
for (const modeId of documentedModeIds) {
    assert.match(getEstText(modeId, 'zh-cn'), /｜/, `missing Chinese block mode guide: ${modeId}`);
    assert.match(getEstText(modeId, 'en'), /｜/, `missing English block mode guide: ${modeId}`);
}

assert.match(homeEvents, /EST_SHOW_HOME_EVENT/);
assert.match(menuLayout, /dispatchEstHomeEvent\(EST_SHOW_HOME_EVENT\)/);
assert.match(desktopHoc, /EST_HOME_NEW_PROJECT_EVENT/);
assert.match(desktopHoc, /EST_HOME_OPEN_PROJECT_EVENT/);
assert.match(desktopHoc, /normalizeHomeProjectData\(event\.detail\.data\)/);
assert.match(desktopHoc, /this\.prepareHomeProjectLoad\(\)/);
assert.match(desktopHoc, /this\.props\.vm\.loadProject\(project\.data\)/);
assert.match(desktopHoc, /homeProjectCanReplaceCurrent/);

assert.strictEqual(canLoadHomeProject('NOT_LOADED'), false);
assert.strictEqual(canLoadHomeProject('SHOWING_WITH_ID'), true);
assert.strictEqual(canLoadHomeProject('SHOWING_WITHOUT_ID'), true);
assert.strictEqual(canLoadHomeProject('FETCHING_NEW_DEFAULT'), false);
assert.strictEqual(canLoadHomeProject('LOADING_VM_NEW_DEFAULT'), false);
assert.doesNotMatch(desktopHoc, /onPrepareHomeProject:/);

const fullBytes = new Uint8Array([4, 8, 15, 16, 23, 42]);
const normalizedView = new Uint8Array(normalizeHomeProjectData(fullBytes.subarray(2, 5)));
assert.deepStrictEqual(Array.from(normalizedView), [15, 16, 23]);
const normalizedBufferShape = new Uint8Array(normalizeHomeProjectData({
    type: 'Buffer',
    data: [1, 2, 3]
}));
assert.deepStrictEqual(Array.from(normalizedBufferShape), [1, 2, 3]);

for (const channel of [
    'est-home-get-startup-state',
    'est-home-list-recent-projects',
    'est-home-remember-project',
    'est-home-capture-thumbnail',
    'est-home-open-project',
    'est-home-remove-recent-project',
    'est-home-rename-project',
    'est-home-copy-project',
    'est-home-get-build-thumbnails',
    'est-home-get-build-library-state',
    'est-home-download-build-library',
    'est-home-pause-build-library-download',
    'est-home-resume-build-library-download',
    'est-home-cancel-build-library-download',
    'est-home-open-build-guide'
]) {
    assert.ok(mainSource.includes(`ipcMain.handle('${channel}'`), `missing IPC channel: ${channel}`);
}
assert.match(mainSource, /await rememberRecentProject\(userChosenPath\)/);
assert.match(mainSource, /await captureProjectThumbnail\(webContents, userChosenPath\)/);
assert.match(mainSource, /thumbnail: await readProjectThumbnail\(normalizedPath\)/);
assert.match(mainSource, /await moveProjectThumbnail\(sourcePath, destinationPath\)/);
assert.match(mainSource, /await moveProjectThumbnail\(sourcePath, destinationPath, true\)/);
assert.match(projectFileLoader, /est-home-remember-project/);
assert.match(mainSource, /shell\.openPath\(guidePath\)/);
assert.match(read('electron-builder.yaml'), /from: resources\/est-build-library/);

for (const localeMarker of ['const zhCN =', 'const en =', 'const ptBR =', 'const zhTW =', 'const ru =']) {
    assert.ok(i18nSource.includes(localeMarker), `missing locale: ${localeMarker}`);
}
for (const messageId of [
    'home.startLine1',
    'home.startLine2',
    'home.returnToEditor',
    'home.animation.label',
    'home.animation.eventBlock',
    'home.animation.motorBlock',
    'home.animation.displayBlock',
    'home.animation.arm.title',
    'home.animation.arm.action',
    'home.animation.robot.title',
    'home.animation.robot.action',
    'home.animation.car.title',
    'home.animation.car.action',
    'home.recentFiles',
    'home.build.category.basic',
    'home.build.category.pbl',
    'home.build.guide',
    'home.build.libraryDownload',
    'home.build.libraryReady',
    'home.build.pauseButton',
    'home.build.resumeButton',
    'home.build.cancelButton',
    'home.build.downloadFailed',
    'home.more.interaction',
    'home.more.hardware',
    'home.more.blocks',
    'home.more.ai',
    'home.more.software',
    'home.more.about',
    'home.dialog.interaction.program1',
    'home.dialog.hardware.output1',
    'home.dialog.blocks.category8',
    'home.dialog.ai.setup1',
    'home.dialog.ai.apply5',
    'home.dialog.ai.privacy2',
    'home.dialog.software.file2',
    'home.dialog.about.foundation3'
]) {
    assert.ok(i18nSource.includes(`'${messageId}'`), `missing home message: ${messageId}`);
}
assert.doesNotMatch(i18nSource, /home\.dialog\.(interaction|hardware|blocks|about)\.body/);

assert.doesNotMatch(homeSource, /EstHardwareStatus|EstProgramControls|firmware\.update/);

console.log('EST Studio home page structure and integration tests passed');
