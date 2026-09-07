import computedStyleToInlineStyle from 'computed-style-to-inline-style';
import ScratchBlocks from 'openblock-blocks';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
const PREVIEW_WIDTH = 2400;
const PREVIEW_HEIGHT = 2400;
const PREVIEW_PADDING = 18;

const makeWorkspaceMetrics = () => ({
    absoluteLeft: 0,
    absoluteTop: 0,
    contentHeight: PREVIEW_HEIGHT,
    contentLeft: 0,
    contentTop: 0,
    contentWidth: PREVIEW_WIDTH,
    flyoutHeight: 0,
    flyoutWidth: 0,
    toolboxPosition: ScratchBlocks.TOOLBOX_AT_LEFT,
    viewHeight: PREVIEW_HEIGHT,
    viewLeft: 0,
    viewTop: 0,
    viewWidth: PREVIEW_WIDTH
});

const createPreviewWorkspace = () => {
    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    Object.assign(host.style, {
        height: `${PREVIEW_HEIGHT}px`,
        left: '-10000px',
        overflow: 'hidden',
        pointerEvents: 'none',
        position: 'fixed',
        top: '0',
        visibility: 'hidden',
        width: `${PREVIEW_WIDTH}px`
    });
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('height', PREVIEW_HEIGHT);
    svg.setAttribute('width', PREVIEW_WIDTH);
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
    workspace.getParentSvg();
    workspace.setResizesEnabled(false);
    workspace.resizeContents = () => {};
    return {host, workspace};
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
    if (absoluteUrl.protocol === 'file:' && typeof window.require === 'function') {
        return Promise.resolve(fileUrlAsDataUri(absoluteUrl));
    }
    return fetch(absoluteUrl.href)
        .then(response => {
            if (!response.ok) throw new Error(`Unable to load block image: ${absoluteUrl.href}`);
            return response.blob();
        })
        .then(blobAsDataUri);
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

const workspaceAsDataUri = async workspace => {
    const bounds = workspace.getBlocksBoundingBox();
    const width = Math.max(1, Math.ceil(bounds.width + (2 * PREVIEW_PADDING)));
    const height = Math.max(1, Math.ceil(bounds.height + (2 * PREVIEW_PADDING)));
    const svg = document.createElementNS(SVG_NS, 'svg');
    const canvas = workspace.getCanvas().cloneNode(true);
    canvas.setAttribute(
        'transform',
        `translate(${PREVIEW_PADDING - bounds.x} ${PREVIEW_PADDING - bounds.y})`
    );
    svg.setAttribute('height', height);
    svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', width);
    svg.appendChild(canvas);

    const previewHost = document.createElement('div');
    Object.assign(previewHost.style, {
        left: '-10000px',
        pointerEvents: 'none',
        position: 'fixed',
        top: '0'
    });
    previewHost.appendChild(svg);
    document.body.appendChild(previewHost);
    try {
        computedStyleToInlineStyle(svg, {
            recursive: true,
            properties: ['fill', 'font-family', 'font-size', 'font-weight', 'stroke', 'stroke-width']
        });
        await inlineSvgImageReferences(svg);
        const svgString = (new XMLSerializer()).serializeToString(svg);
        return {
            height,
            image: `data:image/svg+xml;utf-8,${encodeURIComponent(svgString)}`,
            width
        };
    } finally {
        if (previewHost.parentNode) previewHost.parentNode.removeChild(previewHost);
    }
};

export const createEstProgramStackPreviews = async xml => {
    const documentNode = ScratchBlocks.Xml.textToDom(xml);
    const stackNodes = Array.from(documentNode.children)
        .filter(node => node.nodeName.toLowerCase() === 'block');
    const previewWorkspace = createPreviewWorkspace();
    try {
        const previews = [];
        for (let index = 0; index < stackNodes.length; index++) {
            let block;
            try {
                block = ScratchBlocks.Xml.domToBlock(stackNodes[index].cloneNode(true), previewWorkspace.workspace);
                previews.push(await workspaceAsDataUri(previewWorkspace.workspace));
            } finally {
                if (block && block.workspace) block.dispose(false);
            }
        }
        return previews;
    } finally {
        previewWorkspace.workspace.dispose();
        if (previewWorkspace.host.parentNode) {
            previewWorkspace.host.parentNode.removeChild(previewWorkspace.host);
        }
    }
};

export default createEstProgramStackPreviews;
