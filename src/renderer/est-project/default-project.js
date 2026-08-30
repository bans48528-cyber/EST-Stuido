const EMPTY_COSTUME_ASSET_ID = 'b6229967372e473079438136d6e7f144';
const EMPTY_COSTUME_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>';
const DEFAULT_PROGRAM_START_BLOCK_ID = 'est_default_program_start';
const DEFAULT_PROGRAM_START_BLOCK_X = 360;
const DEFAULT_PROGRAM_START_BLOCK_Y = 160;

const createEmptyCostume = () => ({
    assetId: EMPTY_COSTUME_ASSET_ID,
    name: 'EST',
    md5ext: `${EMPTY_COSTUME_ASSET_ID}.svg`,
    dataFormat: 'svg',
    rotationCenterX: 0,
    rotationCenterY: 0
});

const createBaseTarget = ({isStage, name}) => ({
    isStage,
    name,
    variables: {},
    lists: {},
    broadcasts: {},
    blocks: {},
    currentCostume: 0,
    costumes: [createEmptyCostume()],
    sounds: [],
    volume: 100
});

const createDefaultProgramBlocks = () => ({
    [DEFAULT_PROGRAM_START_BLOCK_ID]: {
        opcode: 'event_program_start',
        next: null,
        parent: null,
        inputs: {},
        fields: {},
        shadow: false,
        topLevel: true,
        x: DEFAULT_PROGRAM_START_BLOCK_X,
        y: DEFAULT_PROGRAM_START_BLOCK_Y
    }
});

const createEstDefaultProjectData = () => ({
    targets: [
        createBaseTarget({isStage: true, name: 'Stage'}),
        {
            ...createBaseTarget({isStage: false, name: 'Program'}),
            blocks: createDefaultProgramBlocks(),
            visible: false,
            x: 0,
            y: 0,
            size: 100,
            direction: 90,
            draggable: false,
            rotationStyle: 'all around'
        }
    ],
    meta: {
        semver: '3.0.0',
        vm: '0.1.0',
        agent: 'EST Studio'
    }
});

const createEstDefaultProjectAssets = () => [
    {
        id: 0,
        assetType: 'Project',
        dataFormat: 'JSON',
        data: JSON.stringify(createEstDefaultProjectData())
    },
    {
        id: EMPTY_COSTUME_ASSET_ID,
        assetType: 'ImageVector',
        dataFormat: 'SVG',
        data: Uint8Array.from(EMPTY_COSTUME_SVG, character => character.charCodeAt(0))
    }
];

export {
    createEstDefaultProjectData,
    EMPTY_COSTUME_ASSET_ID
};

export default createEstDefaultProjectAssets;
