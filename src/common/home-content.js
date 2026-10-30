// Homepage resources only. This configuration never selects or connects hardware.
const guideIds = ['hardware', 'interaction', 'sensors', 'blocks', 'ai', 'firmware'];
export const HOME_CONTENT = Object.freeze({
    'est': Object.freeze({
        guides: [...guideIds, 'vision'],
        buildCategories: ['basic', 'pbl'],
        bundledBuildIds: ['basic-01', 'basic-02', 'basic-04', 'basic-13', 'pbl-01', 'pbl-04', 'pbl-07', 'pbl-14'],
        downloadableBuildLibrary: true
    }),
    'spark-ai': Object.freeze({guides: guideIds, buildCategories: [], bundledBuildIds: []}),
    'new-ai': Object.freeze({guides: guideIds, buildCategories: [], bundledBuildIds: []})
});

export const getHomeContent = hardwareId => {
    if (!Object.prototype.hasOwnProperty.call(HOME_CONTENT, hardwareId)) throw new Error('HOME_HARDWARE_UNKNOWN');
    return HOME_CONTENT[hardwareId];
};

export const requireHomeBuildLibrary = request => {
    const hardwareId = request && request.hardwareId;
    if (!getHomeContent(hardwareId).downloadableBuildLibrary) throw new Error('HOME_BUILD_UNAVAILABLE');
    return hardwareId;
};
