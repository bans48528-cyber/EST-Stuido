import {getCurrentEstLocale} from '../est-i18n';
import {sparkText} from './messages';

export const SPARK_GAMEPAD_KEYS = ['up', 'down', 'left', 'right', 'Y', 'A', 'B', 'X', 'L1', 'R1'];
const arrows = {up: '\u2191', down: '\u2193', left: '\u2190', right: '\u2192'};
const numbers = {Y: '1', X: '2', A: '3', B: '4'};
export const sparkGamepadLabel = value => arrows[value] || numbers[value] || value;
const labels = {up: '方向上', down: '方向下', left: '方向左', right: '方向右'};
// Coordinates use the supplied 3300 x 2550 render, with its vertical margins clipped in CSS.
export const SPARK_GAMEPAD_HOTSPOTS = [
    {value: 'up', x: 820, y: 1120, width: 185, height: 180},
    {value: 'down', x: 820, y: 1450, width: 185, height: 180},
    {value: 'left', x: 650, y: 1295, width: 185, height: 180},
    {value: 'right', x: 995, y: 1295, width: 185, height: 180},
    {value: 'Y', x: 2480, y: 1085, width: 220, height: 220},
    {value: 'A', x: 2480, y: 1515, width: 220, height: 220},
    {value: 'B', x: 2210, y: 1295, width: 220, height: 220},
    {value: 'X', x: 2765, y: 1295, width: 220, height: 220},
    {value: 'L1', x: 840, y: 660, width: 620, height: 100},
    {value: 'R1', x: 2460, y: 660, width: 620, height: 100}
];
const RATIO = 2.2;
const IMAGE_OFFSET = ((2550 / 3300) - (1 / RATIO)) / 2;
const registered = new WeakSet();
const create = (tag, style) => {
    const node = document.createElement(tag);
    Object.assign(node.style, style);
    return node;
};
export const gamepadFocusTarget = (value, direction) => {
    const origin = SPARK_GAMEPAD_HOTSPOTS.find(key => key.value === value);
    if (!origin) return 'up';
    const horizontal = direction === 'ArrowLeft' || direction === 'ArrowRight';
    const forward = direction === 'ArrowRight' || direction === 'ArrowDown';
    const axis = horizontal ? 'x' : 'y';
    const other = horizontal ? 'y' : 'x';
    const closest = SPARK_GAMEPAD_HOTSPOTS
        .filter(key => (forward ? key[axis] > origin[axis] : key[axis] < origin[axis]))
        .sort((a, b) => (Math.abs(a[axis] - origin[axis]) + (3 * Math.abs(a[other] - origin[other]))) -
            (Math.abs(b[axis] - origin[axis]) + (3 * Math.abs(b[other] - origin[other]))))[0];
    return closest ? closest.value : value;
};

export const registerSparkGamepadField = ScratchBlocks => {
    if (registered.has(ScratchBlocks) || !ScratchBlocks.Field || typeof document === 'undefined') return;
    const Native = ScratchBlocks.Field.fromJson({type: 'field_dropdown', options: [['up', 'up']]}).constructor;
    const Field = function () {
        Native.call(this, SPARK_GAMEPAD_KEYS.map(value => [sparkGamepadLabel(value), value]));
    };
    Field.prototype = Object.create(Native.prototype);
    Field.prototype.constructor = Field;
    Field.fromJson = () => new Field();
    Field.prototype.setValue = function (value) {
        if (!SPARK_GAMEPAD_KEYS.includes(value)) return;
        Native.prototype.setValue.call(this, value);
        this.updateController_();
    };
    Field.prototype.updateController_ = function () {
        if (!this.controllerEditor_) return;
        const value = this.getValue();
        const t = key => sparkText(key, getCurrentEstLocale());
        this.controllerCaption_.textContent =
            `${t('手柄按键')}: ${labels[value] ? t(labels[value]) : sparkGamepadLabel(value)}`;
        this.controllerButtons_.forEach(button => {
            const selected = button.dataset.gamepadKey === value;
            button.setAttribute('aria-pressed', String(selected));
            button.style.background = selected ? 'rgba(29, 204, 240, 0.45)' : 'transparent';
            button.style.boxShadow = selected ? '0 0 0 2px #ffffff, 0 0 0 4px #00a8c9' : 'none';
        });
    };
    Field.prototype.showEditor_ = function () {
        const dropdown = ScratchBlocks.DropDownDiv;
        dropdown.hideWithoutAnimation();
        dropdown.clearContent();
        const block = this.sourceBlock_;
        const parent = block.isShadow() ? block.getParent() : block;
        const target = block.workspace.targetWorkspace || block.workspace;
        const workspace = target.getParentSvg().parentNode;
        const width = Math.max(240, Math.min(520, workspace.getBoundingClientRect().width - 32, innerWidth - 48));
        const panel = create('div', {width: `${width}px`,
            padding: '10px',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
            color: '#ffffff',
            userSelect: 'none'});
        panel.className = 'spark-gamepad-selector';
        panel.setAttribute('role', 'group');
        const title = sparkText('手柄按键', getCurrentEstLocale());
        panel.setAttribute('aria-label', title);
        this.controllerCaption_ = create('div', {fontSize: '13px', fontWeight: '600', marginBottom: '8px'});
        this.controllerCaption_.setAttribute('aria-live', 'polite');
        panel.appendChild(this.controllerCaption_);
        const stage = create('div', {position: 'relative',
            width: '100%',
            aspectRatio: String(RATIO),
            overflow: 'hidden',
            background: '#2a2a3e',
            borderRadius: '6px'});
        stage.className = 'spark-gamepad-stage';
        const image = create('img', {position: 'absolute',
            top: '50%',
            left: '0',
            width: '100%',
            height: 'auto',
            transform: 'translateY(-50%)',
            pointerEvents: 'none'});
        // eslint-disable-next-line global-require
        const asset = require('./gamepad-render.png');
        image.src = typeof asset === 'string' ? asset : asset.default;
        image.alt = title;
        image.draggable = false;
        stage.appendChild(image);
        this.controllerButtons_ = SPARK_GAMEPAD_HOTSPOTS.map(key => {
            const shoulder = key.value === 'L1' || key.value === 'R1';
            const button = create('button', {position: 'absolute',
                left: `${key.x / 33}%`,
                top: `${((key.y / 3300) - IMAGE_OFFSET) * RATIO * 100}%`,
                width: `${key.width / 33}%`,
                height: `${(key.height / 3300) * RATIO * 100}%`,
                minWidth: '22px',
                minHeight: '22px',
                transform: 'translate(-50%, -50%)',
                boxSizing: 'border-box',
                padding: '0',
                border: '0',
                borderRadius: shoulder ? '5px' : (arrows[key.value] ? '3px' : '50%'),
                color: shoulder ? '#30353b' : '#ffffff',
                fontFamily: 'inherit',
                fontSize: shoulder ? '12px' : '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                textShadow: shoulder ? 'none' : '0 1px 2px #222222'});
            button.type = 'button';
            button.dataset.gamepadKey = key.value;
            button.textContent = sparkGamepadLabel(key.value);
            button.title = labels[key.value] ?
                sparkText(labels[key.value], getCurrentEstLocale()) : sparkGamepadLabel(key.value);
            button.setAttribute('aria-label', button.title);
            button.onclick = () => {
                this.setValue(key.value);
                dropdown.hide();
            };
            button.onmouseenter = button.onfocus = () => {
                button.style.background = 'rgba(29, 204, 240, 0.35)';
                button.style.outline = '2px solid #ffffff';
                button.style.outlineOffset = '2px';
            };
            button.onmouseleave = button.onblur = () => {
                button.style.outline = '';
                this.updateController_();
            };
            stage.appendChild(button);
            return button;
        });
        panel.appendChild(stage);
        panel.onmousedown = panel.ontouchstart = event => event.stopPropagation();
        panel.onkeydown = event => {
            if (event.key === 'Escape') dropdown.hide();
            else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
                const active = document.activeElement;
                const value = (active && active.dataset.gamepadKey) || this.getValue();
                this.controllerButtons_.find(button => button.dataset.gamepadKey ===
                    gamepadFocusTarget(value, event.key)).focus();
            } else return;
            event.preventDefault();
            event.stopPropagation();
        };
        this.controllerEditor_ = panel;
        this.updateController_();
        dropdown.getContentDiv().appendChild(panel);
        dropdown.setColour(parent.getColour(), block.getColourTertiary());
        dropdown.setCategory(parent.getCategory());
        dropdown.setBoundsElement(workspace);
        this.dropDownOpen_ = true;
        const bounds = this.fieldGroup_.getBoundingClientRect();
        dropdown.show(this, bounds.left + (bounds.width / 2), bounds.bottom,
            bounds.left + (bounds.width / 2), bounds.top, this.onHide.bind(this));
        this.controllerButtons_.find(button => button.dataset.gamepadKey === this.getValue()).focus();
    };
    Field.prototype.onHide = function () {
        if (this.controllerEditor_) {
            this.controllerEditor_.onkeydown = this.controllerEditor_.onmousedown =
                this.controllerEditor_.ontouchstart = null;
            this.controllerButtons_.forEach(button => {
                button.onclick = button.onmouseenter = button.onmouseleave = button.onfocus = button.onblur = null;
            });
        }
        this.controllerEditor_ = this.controllerButtons_ = this.controllerCaption_ = null;
        Native.prototype.onHide.call(this);
    };
    Field.prototype.dispose = function () {
        if (this.controllerEditor_) ScratchBlocks.DropDownDiv.hideWithoutAnimation();
        Native.prototype.dispose.call(this);
    };
    ScratchBlocks.Field.register('field_spark_gamepad', Field);
    registered.add(ScratchBlocks);
};
