const saveFilters = {
    JPEG: {
        name: 'JPEG Image',
        extensions: ['jpg', 'jpeg']
    },
    MP3: {
        name: 'MP3 Sound',
        extensions: ['mp3']
    },
    PNG: {
        name: 'PNG Image',
        extensions: ['png']
    },
    ATC: {
        name: 'ATC CodeStudio Project',
        extensions: ['atc']
    },
    Sprite2: {
        name: 'Scratch 2 Sprite',
        extensions: ['sprite2']
    },
    Sprite3: {
        name: 'Scratch 3 Sprite',
        extensions: ['sprite3']
    },
    SVG: {
        name: 'SVG Image',
        extensions: ['svg']
    },
    WAV: {
        name: 'WAV Sound',
        extensions: ['wav']
    }
};

const loadFilters = {
    ...saveFilters,
    AllBitmaps: {
        name: 'All Bitmaps',
        extensions: [
            ...saveFilters.JPEG.extensions,
            ...saveFilters.PNG.extensions
        ]
    },
    AllImages: {
        name: 'All Images',
        extensions: [
            ...saveFilters.JPEG.extensions,
            ...saveFilters.PNG.extensions,
            ...saveFilters.SVG.extensions
        ]
    },
    AllProjects: {
        name: 'ATC CodeStudio Projects',
        extensions: [
            ...saveFilters.ATC.extensions
        ]
    },
    AllSounds: {
        name: 'All Sounds',
        extensions: [
            ...saveFilters.MP3.extensions,
            ...saveFilters.WAV.extensions
        ]
    },
    AllSprites: {
        name: 'All Sprites',
        extensions: [
            ...saveFilters.Sprite3.extensions,
            ...saveFilters.Sprite2.extensions
        ]
    }
};

const filtersByExtension = Object.values(saveFilters).reduce((result, filter) => {
    for (const extension of filter.extensions) {
        result[extension] = filter;
    }
    return result;
}, {});

const getFilterForExtension = extNameNoDot =>
    filtersByExtension[extNameNoDot] || {
        name: `${extNameNoDot.toUpperCase()} Files`,
        extensions: [extNameNoDot]
    };

export {
    saveFilters,
    loadFilters,
    getFilterForExtension
};
