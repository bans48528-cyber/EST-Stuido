import computedStyleToInlineStyle from 'computed-style-to-inline-style';
import ScratchBlocks from 'openblock-blocks';

import EST_HOME_BLOCK_GUIDE_CATEGORIES from './est-home-block-guide';
import {getEstToolboxCategories} from './est-blocks/toolbox';

const SVG_NS = 'http://www.w3.org/2000/svg';
const BLOCK_PREVIEW_BATCH_SIZE = 6;
const BLOCK_PREVIEW_PADDING = 10;
const BLOCK_PREVIEW_HAT_PADDING = 16;
const XLINK_NS = 'http://www.w3.org/1999/xlink';

const previewCache = {};
const previewRequests = {};
const imageDataUriCache = {};

const allGuideBlockIds = () => EST_HOME_BLOCK_GUIDE_CATEGORIES.reduce(
    (blockIds, category) => blockIds.concat(category.items),
    []
);

const makeWorkspaceMetrics = () => ({
    absoluteLeft: 0,
    absoluteTop: 0,
    contentHeight: 1200,
    contentLeft: 0,
    contentTop: 0,
    contentWidth: 2400,
    flyoutHeight: 0,
    flyoutWidth: 0,
    toolboxPosition: ScratchBlocks.TOOLBOX_AT_LEFT,
    viewHeight: 1200,
    viewLeft: 0,
    viewTop: 0,
    viewWidth: 2400
});

const createPreviewWorkspace = () => {
    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    Object.assign(host.style, {
        height: '1200px',
        left: '-10000px',
        overflow: 'hidden',
        pointerEvents: 'none',
        position: 'fixed',
        top: '0',
        visibility: 'hidden',
        width: '2400px'
    });

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('height', '1200');
    svg.setAttribute('width', '2400');
    host.appendChild(svg);
    document.body.appendChild(host);

    const options = new ScratchBlocks.Options({
        comments: false,
        disable: false,
        readOnly: true,
        scrollbars: false,
        sounds: false,
        trashcan: false,
        zoom: {startScale: 1}
    });
    options.getMetrics = makeWorkspaceMetrics;
    options.setMetrics = () => {};

    const workspace = new ScratchBlocks.WorkspaceSvg(options);
    workspace.scale = 1;
    svg.appendChild(workspace.createDom());
    workspace.translate(0, 0);
    // WorkspaceSvg.dispose expects the parent SVG to have been cached by the
    // normal injection path. This workspace is assembled directly so it cannot
    // replace ScratchBlocks.mainWorkspace.
    workspace.getParentSvg();
    workspace.setResizesEnabled(false);
    // XML import calls resizeContents after each block. The preview workspace has
    // fixed metrics and does not need to update scrollbars or screen transforms.
    workspace.resizeContents = () => {};

    return {host, workspace};
};

const createToolboxBlockMap = locale => {
    const toolboxDocument = new DOMParser().parseFromString(
        `<xml>${getEstToolboxCategories(locale, true)}</xml>`,
        'text/xml'
    );
    return Array.from(toolboxDocument.getElementsByTagName('block')).reduce((blockMap, blockNode) => {
        const blockId = blockNode.getAttribute('type');
        if (!blockMap[blockId]) blockMap[blockId] = blockNode;
        return blockMap;
    }, {});
};

const addDataBlocks = (workspace, blockMap, locale) => {
    const isChinese = String(locale).toLowerCase()
        .indexOf('zh') === 0;
    workspace.createVariable(isChinese ? '变量' : 'variable', '', 'est-home-preview-variable');
    workspace.createVariable(
        isChinese ? '列表' : 'list',
        ScratchBlocks.LIST_VARIABLE_TYPE,
        'est-home-preview-list'
    );
    ScratchBlocks.DataCategory(workspace).forEach(blockNode => {
        if (blockNode.nodeName.toLowerCase() !== 'block') return;
        const blockId = blockNode.getAttribute('type');
        if (!blockMap[blockId]) blockMap[blockId] = blockNode;
    });
};

const addProcedureBlocks = (blockMap, locale) => {
    const procedureName = String(locale).toLowerCase()
        .indexOf('zh') === 0 ? '我的积木' : 'my block';
    const mutation = [
        `proccode="${procedureName}"`,
        'argumentids="[]"',
        'argumentnames="[]"',
        'argumentdefaults="[]"',
        'warp="false"'
    ].join(' ');
    const procedureDocument = ScratchBlocks.Xml.textToDom(`<xml>
        <block type="procedures_definition">
            <statement name="custom_block">
                <shadow type="procedures_prototype"><mutation ${mutation}/></shadow>
            </statement>
        </block>
        <block type="procedures_call">
            <mutation proccode="${procedureName}" argumentids="[]" warp="false"/>
        </block>
    </xml>`);
    Array.from(procedureDocument.children).forEach(blockNode => {
        blockMap[blockNode.getAttribute('type')] = blockNode;
    });
};

const blobAsDataUri = blob => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result));
    reader.addEventListener('error', reject);
    reader.readAsDataURL(blob);
});

const mimeTypeForPath = pathname => {
    const extension = String(pathname).toLowerCase()
        .split('.')
        .pop();
    return {
        gif: 'image/gif',
        jpeg: 'image/jpeg',
        jpg: 'image/jpeg',
        png: 'image/png',
        svg: 'image/svg+xml'
    }[extension] || 'application/octet-stream';
};

const fileUrlAsDataUri = resourceUrl => {
    const fileSystem = window.require('fs');
    const filePath = decodeURIComponent(resourceUrl.pathname)
        .replace(/^\/([a-zA-Z]:)/, '$1');
    const contents = fileSystem.readFileSync(filePath);
    return `data:${mimeTypeForPath(filePath)};base64,${contents.toString('base64')}`;
};

const imageResourceAsDataUri = href => {
    if (href.indexOf('data:') === 0) return Promise.resolve(href);
    const absoluteUrl = new URL(href, document.baseURI);
    const cacheKey = absoluteUrl.href;
    if (!imageDataUriCache[cacheKey]) {
        if (absoluteUrl.protocol === 'file:' && typeof window.require === 'function') {
            imageDataUriCache[cacheKey] = Promise.resolve(fileUrlAsDataUri(absoluteUrl));
        } else {
            imageDataUriCache[cacheKey] = fetch(cacheKey)
                .then(response => {
                    if (!response.ok) throw new Error(`Unable to load block image: ${cacheKey}`);
                    return response.blob();
                })
                .then(blobAsDataUri);
        }
    }
    return imageDataUriCache[cacheKey];
};

const inlineSvgImageReferences = svg => Promise.all(
    Array.from(svg.getElementsByTagName('image')).map(image => {
        const href = image.getAttributeNS(XLINK_NS, 'href') || image.getAttribute('href');
        if (!href || href.indexOf('data:') === 0) return Promise.resolve();
        return imageResourceAsDataUri(href).then(dataUri => {
            image.setAttributeNS(XLINK_NS, 'xlink:href', dataUri);
            image.setAttribute('href', dataUri);
        })
            .catch(() => {});
    })
);

const cloneBlockAsDataUri = async block => {
    const blockSvg = block.getSvgRoot().cloneNode(true);
    blockSvg.innerHTML = blockSvg.innerHTML.replace(/&nbsp;/g, ' ');

    const svg = document.createElementNS(SVG_NS, 'svg');
    const previewHost = document.createElement('div');
    const blockSize = block.getHeightWidth();
    const topPadding = BLOCK_PREVIEW_PADDING + (
        blockSvg.getAttribute('data-shapes') === 'hat' ? BLOCK_PREVIEW_HAT_PADDING : 0
    );
    const width = Math.ceil(blockSize.width + (2 * BLOCK_PREVIEW_PADDING));
    const height = Math.ceil(blockSize.height + topPadding + BLOCK_PREVIEW_PADDING);

    blockSvg.setAttribute('transform', `translate(${BLOCK_PREVIEW_PADDING} ${topPadding})`);
    svg.setAttribute('height', height);
    svg.setAttribute('preserveAspectRatio', 'xMinYMid meet');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', width);
    svg.appendChild(blockSvg);

    Object.assign(previewHost.style, {
        left: '-10000px',
        pointerEvents: 'none',
        position: 'fixed',
        top: '0'
    });
    previewHost.appendChild(svg);
    document.body.appendChild(previewHost);

    computedStyleToInlineStyle(svg, {
        recursive: true,
        properties: ['fill', 'font-family', 'font-size', 'font-weight', 'stroke', 'stroke-width']
    });
    await inlineSvgImageReferences(svg);

    const svgString = (new XMLSerializer()).serializeToString(svg);
    previewHost.parentNode.removeChild(previewHost);
    return `data:image/svg+xml;utf-8,${encodeURIComponent(svgString)}`;
};

const renderBlockPreview = async (workspace, blockNode) => {
    let block;
    try {
        block = ScratchBlocks.Xml.domToBlock(blockNode.cloneNode(true), workspace);
        return await cloneBlockAsDataUri(block);
    } finally {
        if (block && block.workspace) block.dispose(false);
    }
};

const generatePreviews = (locale, onProgress) => new Promise(resolve => {
    const blockIds = allGuideBlockIds();
    const previews = {};
    const previewWorkspace = createPreviewWorkspace();
    const blockMap = createToolboxBlockMap(locale);
    addDataBlocks(previewWorkspace.workspace, blockMap, locale);
    addProcedureBlocks(blockMap, locale);
    let index = 0;

    const finish = () => {
        previewWorkspace.workspace.dispose();
        if (previewWorkspace.host.parentNode) {
            previewWorkspace.host.parentNode.removeChild(previewWorkspace.host);
        }
        previewCache[locale] = previews;
        resolve(previews);
    };

    const renderBatch = async () => {
        const batch = {};
        const end = Math.min(index + BLOCK_PREVIEW_BATCH_SIZE, blockIds.length);
        for (; index < end; index++) {
            const blockId = blockIds[index];
            if (!blockMap[blockId]) continue;
            try {
                const preview = await renderBlockPreview(previewWorkspace.workspace, blockMap[blockId]);
                previews[blockId] = preview;
                batch[blockId] = preview;
            } catch (error) {
                // One unsupported preview must not prevent the remaining reference
                // images from being generated.
            }
        }
        if (onProgress && Object.keys(batch).length) onProgress(batch);
        if (index < blockIds.length) {
            window.setTimeout(() => renderBatch(), 0);
        } else {
            finish();
        }
    };

    window.setTimeout(() => renderBatch(), 0);
});

export const createEstBlockPreviews = (locale, onProgress) => {
    if (previewCache[locale]) {
        if (onProgress) onProgress(previewCache[locale]);
        return Promise.resolve(previewCache[locale]);
    }
    if (!previewRequests[locale]) {
        previewRequests[locale] = generatePreviews(locale, onProgress).then(previews => {
            delete previewRequests[locale];
            return previews;
        });
    }
    return previewRequests[locale];
};

export default createEstBlockPreviews;
