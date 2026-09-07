import {
    EST_DISPLAY_BITMAP_EMPTY,
    EST_DISPLAY_BITMAP_HEIGHT,
    EST_DISPLAY_BITMAP_WIDTH,
    decodeEstDisplayBitmap,
    drawEstDisplayBitmapCircle,
    drawEstDisplayBitmapRectangle,
    encodeEstDisplayBitmap,
    estDisplayBitmapHasInk,
    getEstDisplayBitmapPixel,
    normalizeEstDisplayBitmap,
    setEstDisplayBitmapPixel
} from './display-bitmap';
import {getCurrentEstLocale, getEstText} from '../est-i18n';

export const EST_DISPLAY_BITMAP_FIELD_TYPE = 'field_est_display_bitmap';

const BITMAP_FIELD_WIDTH = 148;
const BITMAP_FIELD_HEIGHT = 36;
const BITMAP_FIELD_BOX_WIDTH = 146;
const BITMAP_FIELD_LABEL_X = 103;
const SHAPE_TOOLS = new Set([
    'rectangle-outline',
    'rectangle-fill',
    'circle-outline',
    'circle-fill'
]);

const makeButton = (className, text, title) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = text;
    button.title = title;
    button.setAttribute('aria-label', title);
    return button;
};

const makeShapeButton = (tool, title, circle, filled) => {
    const button = makeButton('est-display-drawing-shape', '', title);
    button.setAttribute('data-drawing-tool', tool);
    const icon = document.createElement('span');
    icon.className = `est-display-drawing-shape-icon${circle ? ' is-circle' : ''}${filled ? ' is-filled' : ''}`;
    button.appendChild(icon);
    return button;
};

const drawBitmapToCanvas = (canvas, pixels) => {
    const context = canvas.getContext('2d');
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, EST_DISPLAY_BITMAP_WIDTH, EST_DISPLAY_BITMAP_HEIGHT);
    context.fillStyle = '#20242B';
    for (let y = 0; y < EST_DISPLAY_BITMAP_HEIGHT; y++) {
        for (let x = 0; x < EST_DISPLAY_BITMAP_WIDTH; x++) {
            if (getEstDisplayBitmapPixel(pixels, x, y)) context.fillRect(x, y, 1, 1);
        }
    }
};

const drawTextToBitmap = (pixels, text, point, fontSize) => {
    if (!text) return;
    const textCanvas = document.createElement('canvas');
    textCanvas.width = EST_DISPLAY_BITMAP_WIDTH;
    textCanvas.height = EST_DISPLAY_BITMAP_HEIGHT;
    const context = textCanvas.getContext('2d');
    context.clearRect(0, 0, EST_DISPLAY_BITMAP_WIDTH, EST_DISPLAY_BITMAP_HEIGHT);
    context.fillStyle = '#000000';
    context.font = `${fontSize}px "Microsoft YaHei", "Segoe UI", sans-serif`;
    context.textBaseline = 'top';
    context.fillText(text, point.x, point.y);
    const image = context.getImageData(0, 0, EST_DISPLAY_BITMAP_WIDTH, EST_DISPLAY_BITMAP_HEIGHT).data;
    for (let y = 0; y < EST_DISPLAY_BITMAP_HEIGHT; y++) {
        for (let x = 0; x < EST_DISPLAY_BITMAP_WIDTH; x++) {
            const alphaIndex = (((y * EST_DISPLAY_BITMAP_WIDTH) + x) * 4) + 3;
            if (image[alphaIndex] >= 96) {
                setEstDisplayBitmapPixel(pixels, x, y, true);
            }
        }
    }
};

const bitmapPreviewDataUrl = value => {
    if (typeof document === 'undefined') return '';
    const canvas = document.createElement('canvas');
    canvas.width = EST_DISPLAY_BITMAP_WIDTH;
    canvas.height = EST_DISPLAY_BITMAP_HEIGHT;
    drawBitmapToCanvas(canvas, decodeEstDisplayBitmap(value));
    return canvas.toDataURL('image/png');
};

const addDrawingListeners = (ScratchBlocks, field, root, canvas, pixels) => {
    const listeners = [];
    const listen = (target, type, handler, options) => {
        target.addEventListener(type, handler, options);
        listeners.push(() => target.removeEventListener(type, handler, options));
    };
    let drawing = false;
    let previousPoint = null;
    let brushSize = 3;
    let activeTool = 'brush';
    let shapeOn = true;
    let shapeStart = null;
    let shapeEnd = null;
    let shapeBasePixels = null;
    let textPoint = null;
    let textBasePixels = null;
    const textControls = root.querySelector('.est-display-drawing-text-controls');
    const textInput = root.querySelector('[data-drawing-text]');
    const textSize = root.querySelector('[data-drawing-text-size]');
    const undoButton = root.querySelector('[data-drawing-undo]');
    const redoButton = root.querySelector('[data-drawing-redo]');
    const history = [Uint8Array.from(pixels)];
    let historyIndex = 0;

    const stopPropagation = event => event.stopPropagation();
    listen(root, 'mousedown', stopPropagation);
    listen(root, 'touchstart', stopPropagation, {passive: true});

    const pointFor = event => {
        const bounds = canvas.getBoundingClientRect();
        return {
            x: Math.max(0, Math.min(
                EST_DISPLAY_BITMAP_WIDTH - 1,
                Math.floor((event.clientX - bounds.left) * EST_DISPLAY_BITMAP_WIDTH / bounds.width)
            )),
            y: Math.max(0, Math.min(
                EST_DISPLAY_BITMAP_HEIGHT - 1,
                Math.floor((event.clientY - bounds.top) * EST_DISPLAY_BITMAP_HEIGHT / bounds.height)
            ))
        };
    };

    const paintPoint = point => {
        const radius = Math.floor(brushSize / 2);
        const context = canvas.getContext('2d');
        const drawingOn = activeTool !== 'eraser';
        context.fillStyle = drawingOn ? '#20242B' : '#FFFFFF';
        for (let y = point.y - radius; y <= point.y + radius; y++) {
            for (let x = point.x - radius; x <= point.x + radius; x++) {
                const deltaX = x - point.x;
                const deltaY = y - point.y;
                if ((deltaX * deltaX) + (deltaY * deltaY) > (radius * radius) + radius) continue;
                setEstDisplayBitmapPixel(pixels, x, y, drawingOn);
                context.fillRect(x, y, 1, 1);
            }
        }
    };

    const paintLine = (start, end) => {
        const distance = Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y));
        for (let step = 0; step <= distance; step++) {
            const ratio = distance ? step / distance : 0;
            paintPoint({
                x: Math.round(start.x + ((end.x - start.x) * ratio)),
                y: Math.round(start.y + ((end.y - start.y) * ratio))
            });
        }
    };

    const selectButtons = (selector, activeButton) => {
        root.querySelectorAll(selector).forEach(button => {
            button.classList.toggle('is-active', button === activeButton);
        });
    };

    const resetShapeState = () => {
        shapeStart = null;
        shapeEnd = null;
        shapeBasePixels = null;
    };

    const cancelShapePreview = () => {
        if (shapeBasePixels) {
            pixels.set(shapeBasePixels);
            drawBitmapToCanvas(canvas, pixels);
        }
        resetShapeState();
    };

    const resetTextState = () => {
        textPoint = null;
        textBasePixels = null;
    };

    const cancelTextPreview = () => {
        if (textBasePixels) {
            pixels.set(textBasePixels);
            drawBitmapToCanvas(canvas, pixels);
        }
        resetTextState();
    };

    const updateHistoryButtons = () => {
        undoButton.disabled = historyIndex === 0;
        redoButton.disabled = historyIndex >= history.length - 1;
    };

    const commitHistory = () => {
        const current = history[historyIndex];
        if (pixels.every((value, index) => value === current[index])) return;
        history.splice(historyIndex + 1);
        history.push(Uint8Array.from(pixels));
        if (history.length > 50) history.shift();
        historyIndex = history.length - 1;
        updateHistoryButtons();
    };

    const restoreHistory = nextIndex => {
        cancelShapePreview();
        cancelTextPreview();
        historyIndex = Math.max(0, Math.min(history.length - 1, nextIndex));
        pixels.set(history[historyIndex]);
        drawBitmapToCanvas(canvas, pixels);
        updateHistoryButtons();
    };

    const drawShape = end => {
        if (!shapeStart || !shapeBasePixels) return;
        pixels.set(shapeBasePixels);
        const filled = activeTool.endsWith('-fill');
        if (activeTool.startsWith('rectangle-')) {
            drawEstDisplayBitmapRectangle(pixels, shapeStart, end, filled, brushSize, shapeOn);
        } else {
            drawEstDisplayBitmapCircle(pixels, shapeStart, end, filled, brushSize, shapeOn);
        }
        shapeEnd = end;
        drawBitmapToCanvas(canvas, pixels);
    };

    const drawTextPreview = point => {
        const text = textInput.value;
        if (!text) {
            cancelTextPreview();
            return;
        }
        if (!textBasePixels) textBasePixels = Uint8Array.from(pixels);
        pixels.set(textBasePixels);
        drawTextToBitmap(pixels, text, point, Number(textSize.value));
        textPoint = point;
        drawBitmapToCanvas(canvas, pixels);
    };

    root.querySelectorAll('[data-brush-size]').forEach(button => {
        listen(button, 'click', () => {
            brushSize = Number(button.getAttribute('data-brush-size'));
            selectButtons('[data-brush-size]', button);
            if (shapeEnd) drawShape(shapeEnd);
        });
    });
    root.querySelectorAll('[data-drawing-tool]').forEach(button => {
        listen(button, 'click', () => {
            cancelShapePreview();
            cancelTextPreview();
            activeTool = button.getAttribute('data-drawing-tool');
            selectButtons('[data-drawing-tool]', button);
            textControls.classList.toggle('is-visible', activeTool === 'text');
            if (activeTool === 'text') textInput.focus();
        });
    });
    root.querySelectorAll('[data-drawing-shape-color]').forEach(button => {
        listen(button, 'click', () => {
            cancelShapePreview();
            shapeOn = button.getAttribute('data-drawing-shape-color') === 'black';
            selectButtons('[data-drawing-shape-color]', button);
        });
    });
    listen(undoButton, 'click', () => restoreHistory(historyIndex - 1));
    listen(redoButton, 'click', () => restoreHistory(historyIndex + 1));
    listen(textInput, 'input', () => {
        if (textPoint) drawTextPreview(textPoint);
    });
    listen(textSize, 'change', () => {
        if (textPoint) drawTextPreview(textPoint);
    });
    listen(root.querySelector('[data-drawing-clear]'), 'click', () => {
        cancelShapePreview();
        cancelTextPreview();
        pixels.fill(0);
        drawBitmapToCanvas(canvas, pixels);
        commitHistory();
    });
    listen(root.querySelector('[data-drawing-done]'), 'click', () => {
        cancelShapePreview();
        cancelTextPreview();
        ScratchBlocks.DropDownDiv.hide();
    });

    listen(canvas, 'pointerdown', event => {
        event.preventDefault();
        event.stopPropagation();
        const point = pointFor(event);
        if (activeTool === 'text') {
            if (!textInput.value) {
                textInput.focus();
                return;
            }
            drawTextPreview(point);
            resetTextState();
            commitHistory();
            return;
        }
        if (SHAPE_TOOLS.has(activeTool)) {
            if (shapeStart) {
                drawShape(point);
                resetShapeState();
                commitHistory();
            } else {
                shapeStart = point;
                shapeEnd = point;
                shapeBasePixels = Uint8Array.from(pixels);
                drawShape(point);
            }
            return;
        }
        drawing = true;
        previousPoint = point;
        canvas.setPointerCapture(event.pointerId);
        paintPoint(previousPoint);
    });
    listen(canvas, 'pointermove', event => {
        if (activeTool === 'text' && textInput.value) {
            event.preventDefault();
            drawTextPreview(pointFor(event));
            return;
        }
        if (SHAPE_TOOLS.has(activeTool) && shapeStart) {
            event.preventDefault();
            drawShape(pointFor(event));
            return;
        }
        if (!drawing) return;
        event.preventDefault();
        const point = pointFor(event);
        paintLine(previousPoint, point);
        previousPoint = point;
    });
    const finishDrawing = event => {
        if (!drawing) return;
        event.preventDefault();
        drawing = false;
        previousPoint = null;
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        commitHistory();
    };
    listen(canvas, 'pointerup', finishDrawing);
    listen(canvas, 'pointercancel', event => {
        finishDrawing(event);
        cancelShapePreview();
        cancelTextPreview();
    });
    listen(canvas, 'contextmenu', event => {
        event.preventDefault();
        cancelShapePreview();
        cancelTextPreview();
    });
    listen(window, 'keydown', event => {
        if ((event.ctrlKey || event.metaKey) && event.target !== textInput) {
            const key = event.key.toLowerCase();
            if (key === 'z' || key === 'y') {
                event.preventDefault();
                const redo = key === 'y' || event.shiftKey;
                restoreHistory(historyIndex + (redo ? 1 : -1));
                return;
            }
        }
        if (event.key === 'Escape') {
            cancelShapePreview();
            cancelTextPreview();
        }
    });
    updateHistoryButtons();

    return () => {
        cancelShapePreview();
        cancelTextPreview();
        field.setValue(encodeEstDisplayBitmap(pixels));
        listeners.forEach(remove => remove());
    };
};

const createDrawingEditor = (ScratchBlocks, field) => {
    const locale = getCurrentEstLocale();
    const pixels = decodeEstDisplayBitmap(field.getValue());
    const root = document.createElement('div');
    root.className = 'est-display-drawing-editor';
    const widthForHeight = (window.innerHeight - 285) * EST_DISPLAY_BITMAP_WIDTH /
        EST_DISPLAY_BITMAP_HEIGHT;
    const availableWidth = Math.max(300, Math.min(420, window.innerWidth - 80, widthForHeight));
    root.style.width = `${availableWidth}px`;

    const header = document.createElement('div');
    header.className = 'est-display-drawing-header';
    const title = document.createElement('strong');
    title.textContent = getEstText('drawing.title', locale);
    const dimensions = document.createElement('span');
    dimensions.textContent = `${EST_DISPLAY_BITMAP_WIDTH} x ${EST_DISPLAY_BITMAP_HEIGHT}`;
    const headerActions = document.createElement('div');
    headerActions.className = 'est-display-drawing-header-actions';
    const historyTools = document.createElement('div');
    historyTools.className = 'est-display-drawing-history';
    const undo = makeButton(
        'est-display-drawing-history-button',
        '↶',
        getEstText('drawing.undo', locale)
    );
    undo.setAttribute('data-drawing-undo', 'true');
    const redo = makeButton(
        'est-display-drawing-history-button',
        '↷',
        getEstText('drawing.redo', locale)
    );
    redo.setAttribute('data-drawing-redo', 'true');
    historyTools.appendChild(undo);
    historyTools.appendChild(redo);
    headerActions.appendChild(dimensions);
    headerActions.appendChild(historyTools);
    header.appendChild(title);
    header.appendChild(headerActions);

    const canvas = document.createElement('canvas');
    canvas.className = 'est-display-drawing-canvas';
    canvas.width = EST_DISPLAY_BITMAP_WIDTH;
    canvas.height = EST_DISPLAY_BITMAP_HEIGHT;
    canvas.setAttribute('aria-label', getEstText('drawing.canvas', locale));
    drawBitmapToCanvas(canvas, pixels);

    const toolbar = document.createElement('div');
    toolbar.className = 'est-display-drawing-toolbar';
    const sizes = document.createElement('div');
    sizes.className = 'est-display-drawing-sizes';
    [1, 3, 7].forEach((size, index) => {
        const button = makeButton(
            `est-display-drawing-size${index === 1 ? ' is-active' : ''}`,
            '',
            getEstText('drawing.brushSize', locale, {size})
        );
        button.setAttribute('data-brush-size', size);
        const dot = document.createElement('span');
        dot.style.width = `${Math.max(5, size * 2)}px`;
        dot.style.height = dot.style.width;
        button.appendChild(dot);
        sizes.appendChild(button);
    });

    const shapeTools = document.createElement('div');
    shapeTools.className = 'est-display-drawing-shapes';
    shapeTools.appendChild(makeShapeButton(
        'rectangle-outline',
        getEstText('drawing.rectangleOutline', locale),
        false,
        false
    ));
    shapeTools.appendChild(makeShapeButton(
        'rectangle-fill',
        getEstText('drawing.rectangleFill', locale),
        false,
        true
    ));
    shapeTools.appendChild(makeShapeButton(
        'circle-outline',
        getEstText('drawing.circleOutline', locale),
        true,
        false
    ));
    shapeTools.appendChild(makeShapeButton(
        'circle-fill',
        getEstText('drawing.circleFill', locale),
        true,
        true
    ));
    const textTool = makeButton(
        'est-display-drawing-shape',
        'T',
        getEstText('drawing.text', locale)
    );
    textTool.setAttribute('data-drawing-tool', 'text');
    textTool.classList.add('is-text');
    shapeTools.appendChild(textTool);
    const blackShape = makeButton(
        'est-display-drawing-color is-active',
        '',
        getEstText('drawing.shapeBlack', locale)
    );
    blackShape.setAttribute('data-drawing-shape-color', 'black');
    const blackSwatch = document.createElement('span');
    blackSwatch.className = 'est-display-drawing-color-swatch is-black';
    blackShape.appendChild(blackSwatch);
    const blackLabel = document.createElement('span');
    blackLabel.className = 'est-display-drawing-color-label';
    blackLabel.textContent = getEstText('drawing.shapeDraw', locale);
    blackShape.appendChild(blackLabel);
    const whiteShape = makeButton(
        'est-display-drawing-color',
        '',
        getEstText('drawing.shapeWhite', locale)
    );
    whiteShape.setAttribute('data-drawing-shape-color', 'white');
    const whiteSwatch = document.createElement('span');
    whiteSwatch.className = 'est-display-drawing-color-swatch is-white';
    whiteShape.appendChild(whiteSwatch);
    const whiteLabel = document.createElement('span');
    whiteLabel.className = 'est-display-drawing-color-label';
    whiteLabel.textContent = getEstText('drawing.shapeErase', locale);
    whiteShape.appendChild(whiteLabel);
    shapeTools.appendChild(blackShape);
    shapeTools.appendChild(whiteShape);

    const textControls = document.createElement('div');
    textControls.className = 'est-display-drawing-text-controls';
    const textInput = document.createElement('input');
    textInput.className = 'est-display-drawing-text-input';
    textInput.type = 'text';
    textInput.maxLength = 32;
    textInput.placeholder = getEstText('drawing.textPlaceholder', locale);
    textInput.setAttribute('aria-label', getEstText('drawing.textPlaceholder', locale));
    textInput.setAttribute('data-drawing-text', 'true');
    const textSize = document.createElement('select');
    textSize.className = 'est-display-drawing-text-size';
    textSize.setAttribute('aria-label', getEstText('drawing.textSize', locale));
    textSize.setAttribute('data-drawing-text-size', 'true');
    [12, 18, 26].forEach(size => {
        const option = document.createElement('option');
        option.value = size;
        option.textContent = `${size}px`;
        option.selected = size === 18;
        textSize.appendChild(option);
    });
    textControls.appendChild(textInput);
    textControls.appendChild(textSize);

    const tools = document.createElement('div');
    tools.className = 'est-display-drawing-tools';
    const brush = makeButton(
        'est-display-drawing-tool is-active',
        getEstText('drawing.brush', locale),
        getEstText('drawing.brush', locale)
    );
    brush.setAttribute('data-drawing-tool', 'brush');
    const eraser = makeButton(
        'est-display-drawing-tool',
        getEstText('drawing.eraser', locale),
        getEstText('drawing.eraser', locale)
    );
    eraser.setAttribute('data-drawing-tool', 'eraser');
    const clear = makeButton(
        'est-display-drawing-tool',
        getEstText('drawing.clear', locale),
        getEstText('drawing.clear', locale)
    );
    clear.setAttribute('data-drawing-clear', 'true');
    const done = makeButton(
        'est-display-drawing-done',
        getEstText('drawing.done', locale),
        getEstText('drawing.done', locale)
    );
    done.setAttribute('data-drawing-done', 'true');
    tools.appendChild(brush);
    tools.appendChild(eraser);
    tools.appendChild(clear);
    tools.appendChild(done);

    toolbar.appendChild(sizes);
    toolbar.appendChild(tools);
    root.appendChild(header);
    root.appendChild(canvas);
    root.appendChild(shapeTools);
    root.appendChild(textControls);
    root.appendChild(toolbar);
    return {root, cleanup: addDrawingListeners(ScratchBlocks, field, root, canvas, pixels)};
};

export const registerEstDisplayBitmapField = ScratchBlocks => {
    if (!ScratchBlocks || typeof ScratchBlocks.Field !== 'function' ||
        !ScratchBlocks.DropDownDiv || typeof document === 'undefined') {
        return;
    }

    const EstDisplayBitmapField = function (value) {
        ScratchBlocks.Field.call(this, normalizeEstDisplayBitmap(value || EST_DISPLAY_BITMAP_EMPTY));
        this.size_.width = BITMAP_FIELD_WIDTH;
        this.size_.height = BITMAP_FIELD_HEIGHT;
        this.addArgType('bitmap');
    };
    EstDisplayBitmapField.prototype = Object.create(ScratchBlocks.Field.prototype);
    EstDisplayBitmapField.prototype.constructor = EstDisplayBitmapField;
    EstDisplayBitmapField.fromJson = options => new EstDisplayBitmapField(options.value);
    EstDisplayBitmapField.prototype.CURSOR = 'pointer';

    EstDisplayBitmapField.prototype.classValidator = normalizeEstDisplayBitmap;
    EstDisplayBitmapField.prototype.setValue = function (value) {
        ScratchBlocks.Field.prototype.setValue.call(this, normalizeEstDisplayBitmap(value));
        this.updatePreview_();
    };
    EstDisplayBitmapField.prototype.init = function () {
        if (this.fieldGroup_) return;
        ScratchBlocks.Field.prototype.init.call(this);
        this.previewBox_ = ScratchBlocks.utils.createSvgElement('rect', {
            x: 1,
            y: 1,
            width: BITMAP_FIELD_BOX_WIDTH,
            height: 34,
            rx: 4,
            fill: '#FFFFFF',
            stroke: '#D8DCE7'
        }, this.fieldGroup_);
        this.previewImage_ = ScratchBlocks.utils.createSvgElement('image', {
            x: 4,
            y: 3,
            width: 52,
            height: 30,
            preserveAspectRatio: 'xMidYMid meet'
        }, this.fieldGroup_);
        this.fieldGroup_.insertBefore(this.previewBox_, this.textElement_);
        this.fieldGroup_.insertBefore(this.previewImage_, this.textElement_);
        this.render_();
    };
    EstDisplayBitmapField.prototype.updatePreview_ = function () {
        if (!this.previewImage_) return;
        this.previewImage_.setAttributeNS(
            'http://www.w3.org/1999/xlink',
            'xlink:href',
            bitmapPreviewDataUrl(this.getValue())
        );
    };
    EstDisplayBitmapField.prototype.render_ = function () {
        if (!this.visible_ || !this.textElement_) return;
        const hasInk = estDisplayBitmapHasInk(decodeEstDisplayBitmap(this.getValue()));
        this.textElement_.textContent = getEstText(
            hasInk ? 'drawing.edit' : 'drawing.empty',
            getCurrentEstLocale()
        );
        this.textElement_.setAttribute('x', BITMAP_FIELD_LABEL_X);
        this.textElement_.setAttribute('y', 18);
        this.size_.width = BITMAP_FIELD_WIDTH;
        this.size_.height = BITMAP_FIELD_HEIGHT;
        this.updatePreview_();
    };
    EstDisplayBitmapField.prototype.showEditor_ = function () {
        const DropDownDiv = ScratchBlocks.DropDownDiv;
        DropDownDiv.hideWithoutAnimation();
        DropDownDiv.clearContent();
        const contentDiv = DropDownDiv.getContentDiv();
        const previousMaxHeight = contentDiv.style.maxHeight;
        const previousOverflow = contentDiv.style.overflow;
        contentDiv.style.maxHeight = 'none';
        contentDiv.style.overflow = 'visible';
        const editor = createDrawingEditor(ScratchBlocks, this);
        contentDiv.appendChild(editor.root);
        DropDownDiv.setColour('#F5F6F9', this.sourceBlock_.getColourTertiary());
        DropDownDiv.setCategory(this.sourceBlock_.getCategory());
        DropDownDiv.showPositionedByBlock(this, this.sourceBlock_, () => {
            editor.cleanup();
            contentDiv.style.maxHeight = previousMaxHeight;
            contentDiv.style.overflow = previousOverflow;
        });
    };
    EstDisplayBitmapField.prototype.dispose = function () {
        ScratchBlocks.DropDownDiv.hideIfOwner(this);
        ScratchBlocks.Field.prototype.dispose.call(this);
    };

    ScratchBlocks.Field.register(EST_DISPLAY_BITMAP_FIELD_TYPE, EstDisplayBitmapField);
};

export const makeEstDisplayBitmapField = name => ({
    type: EST_DISPLAY_BITMAP_FIELD_TYPE,
    name,
    value: EST_DISPLAY_BITMAP_EMPTY
});
