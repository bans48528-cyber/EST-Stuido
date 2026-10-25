import {getCurrentEstLocale} from '../est-i18n';

const registered = new WeakSet();
export const NEW_COLOUR_CARDS = [
    '#ff000c', '#ffe360', '#0090f5', '#00cb54', '#914800', '#ad0000', '#000000', '#ffffff'
];
const colourLabels = {
    'zh-cn': ['颜色', '红色', '黄色', '蓝色', '绿色', '棕色', '深红色', '黑色', '白色'],
    'zh-tw': ['顏色', '紅色', '黃色', '藍色', '綠色', '棕色', '深紅色', '黑色', '白色'],
    'en': ['Color', 'Red', 'Yellow', 'Blue', 'Green', 'Brown', 'Dark red', 'Black', 'White'],
    'pt-br': ['Cor', 'Vermelho', 'Amarelo', 'Azul', 'Verde', 'Marrom', 'Vermelho escuro', 'Preto', 'Branco'],
    'ru': ['Цвет', 'Красный', 'Жёлтый', 'Синий', 'Зелёный', 'Коричневый', 'Тёмно-красный', 'Чёрный', 'Белый']
};

export const registerNewFields = ScratchBlocks => {
    if (registered.has(ScratchBlocks) || !ScratchBlocks.Field || typeof document === 'undefined') return;
    const NativeMatrix = ScratchBlocks.Field.fromJson({
        type: 'field_matrix', matrix: '', width: 7, height: 9
    }).constructor;
    const Matrix = function (value) {
        NativeMatrix.call(this, '', 7, 9);
        this.setValue(value || '0'.repeat(63));
    };
    Matrix.prototype = Object.create(NativeMatrix.prototype);
    Matrix.prototype.constructor = Matrix;
    Matrix.fromJson = options => new Matrix(options.matrix);
    Matrix.prototype.setValue = function (value) {
        if (this.zeros_) {
            NativeMatrix.prototype.setValue.call(this,
                String(value || '').replace(/[^01]/g, '')
                    .padEnd(63, '0')
                    .slice(0, 63));
        }
    };
    Matrix.prototype.updateMatrix_ = function () {
        if (this.sourceBlock_) NativeMatrix.prototype.updateMatrix_.call(this);
    };
    Matrix.prototype.checkForLED_ = function (event) {
        const bounds = this.matrixStage_.getBoundingClientRect();
        const size = NativeMatrix.MATRIX_NODE_SIZE; const pad = NativeMatrix.MATRIX_NODE_PAD;
        const x = (event.clientX - bounds.left) * ((7 * size) + (8 * pad)) / bounds.width;
        const y = (event.clientY - bounds.top) * ((9 * size) + (10 * pad)) / bounds.height;
        const column = Math.floor((x - (pad / 2)) / (size + pad));
        const row = Math.floor((y - (pad / 2)) / (size + pad));
        return column >= 0 && column < 7 && row >= 0 && row < 9 ? column + (row * 7) : -1;
    };
    ScratchBlocks.Field.register('field_new_matrix', Matrix);
    const NativeColour = ScratchBlocks.Field.fromJson({type: 'field_colour', colour: NEW_COLOUR_CARDS[0]}).constructor;
    const Card = function (value) {
        NativeColour.call(this, value || NEW_COLOUR_CARDS[0]);
    };
    Card.prototype = Object.create(NativeColour.prototype);
    Card.prototype.constructor = Card;
    Card.fromJson = options => new Card(options.colour);
    Card.prototype.setValue = function (value) {
        if (this.colourPanel_ && ScratchBlocks.Events.isEnabled() && !ScratchBlocks.Events.getGroup()) {
            ScratchBlocks.Events.setGroup(this.colourGroup_ || true);
            this.colourGroup_ = ScratchBlocks.Events.getGroup();
        }
        NativeColour.prototype.setValue.call(this, value);
        this.updateCard_();
    };
    Card.prototype.updateCard_ = function () {
        (this.colourButtons_ || []).forEach(button => {
            const selected = button.dataset.newColour === this.getValue();
            button.setAttribute('aria-selected', String(selected));
            button.style.transform = selected ? 'scaleX(1.25)' : '';
            button.style.outline = selected ? '2px solid #ffffff' : 'none';
            button.style.boxShadow = selected ? '0 3px 6px rgba(0,0,0,.25)' : 'none';
            button.style.zIndex = selected ? '1' : '0';
        });
    };
    Card.prototype.showEditor_ = function () {
        const dropdown = ScratchBlocks.DropDownDiv;
        dropdown.hideWithoutAnimation();
        dropdown.clearContent();
        const block = this.sourceBlock_;
        const parent = block.getParent() || block;
        const labels = colourLabels[getCurrentEstLocale()] || colourLabels.en;
        const panel = document.createElement('div');
        panel.className = 'new-ai-colour-card-picker';
        Object.assign(panel.style, {padding: '12px 16px', userSelect: 'none', touchAction: 'none'});
        panel.setAttribute('role', 'listbox');
        panel.setAttribute('aria-label', labels[0]);
        const rail = document.createElement('div');
        rail.className = 'new-ai-colour-card-rail';
        Object.assign(rail.style, {display: 'flex', flexDirection: 'column', width: '40px', height: '170px'});
        this.colourButtons_ = NEW_COLOUR_CARDS.map((colour, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.newColour = colour;
            button.setAttribute('role', 'option');
            button.setAttribute('aria-label', labels[index + 1]);
            button.title = labels[index + 1];
            Object.assign(button.style, {backgroundColor: colour,
                flex: '1 1 0',
                width: '40px',
                minHeight: '0',
                margin: '0',
                padding: '0',
                border: 'none',
                cursor: 'pointer',
                borderRadius: index === 0 ? '4px 4px 0 0' : (index === 7 ? '0 0 4px 4px' : '4px')});
            button.onclick = event => {
                event.stopPropagation();
                this.setValue(colour);
            };
            rail.appendChild(button);
            return button;
        });
        const selectAt = event => {
            const bounds = rail.getBoundingClientRect();
            const index = Math.max(0, Math.min(7, Math.floor((event.clientY - bounds.top) * 8 / bounds.height)));
            this.setValue(NEW_COLOUR_CARDS[index]);
            this.colourButtons_[index].focus({preventScroll: true});
        };
        rail.onpointerdown = event => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            this.colourPointer_ = event.pointerId;
            rail.setPointerCapture(event.pointerId);
            selectAt(event);
        };
        rail.onpointermove = event => {
            if (this.colourPointer_ !== event.pointerId) return;
            event.preventDefault();
            event.stopPropagation();
            selectAt(event);
        };
        rail.onpointerup = rail.onpointercancel = event => {
            if (this.colourPointer_ !== event.pointerId) return;
            this.colourPointer_ = null;
            if (rail.hasPointerCapture(event.pointerId)) rail.releasePointerCapture(event.pointerId);
            event.stopPropagation();
        };
        panel.appendChild(rail);
        panel.onmousedown = panel.ontouchstart = event => event.stopPropagation();
        panel.onkeydown = event => {
            if (event.key === 'Escape') dropdown.hideWithoutAnimation();
            else if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
                const current = this.colourButtons_.indexOf(document.activeElement);
                const index = event.key === 'Home' ? 0 : (event.key === 'End' ? 7 :
                    (current + (event.key === 'ArrowUp' ? 7 : 1)) % 8);
                this.setValue(NEW_COLOUR_CARDS[index]);
                this.colourButtons_[index].focus();
            } else return;
            event.preventDefault();
            event.stopPropagation();
        };
        this.colourPanel_ = panel;
        this.colourRail_ = rail;
        if (!ScratchBlocks.Events.getGroup()) {
            ScratchBlocks.Events.setGroup(true);
            this.colourGroup_ = ScratchBlocks.Events.getGroup();
        }
        this.updateCard_();
        dropdown.getContentDiv().appendChild(panel);
        dropdown.setColour(parent.getColour(), parent.getColourTertiary());
        dropdown.setCategory(parent.getCategory());
        dropdown.setBoundsElement(block.workspace.getParentSvg().parentNode);
        const bounds = this.getClickTarget_().getBoundingClientRect();
        dropdown.show(this, bounds.left + (bounds.width / 2), bounds.bottom,
            bounds.left + (bounds.width / 2), bounds.top, this.hideCard_.bind(this));
        this.colourButtons_[Math.max(0, NEW_COLOUR_CARDS.indexOf(this.getValue()))].focus({preventScroll: true});
    };
    Card.prototype.hideCard_ = function () {
        if (this.colourPanel_) {
            this.colourPanel_.onkeydown = this.colourPanel_.onmousedown = this.colourPanel_.ontouchstart = null;
            this.colourRail_.onpointerdown = this.colourRail_.onpointermove =
                this.colourRail_.onpointerup = this.colourRail_.onpointercancel = null;
            this.colourButtons_.forEach(button => {
                button.onclick = null;
            });
        }
        this.colourPanel_ = this.colourRail_ = this.colourButtons_ = this.colourPointer_ = null;
        if (this.colourGroup_ && ScratchBlocks.Events.getGroup() === this.colourGroup_) {
            ScratchBlocks.Events.setGroup(false);
        }
        this.colourGroup_ = null;
    };
    Card.prototype.dispose = function () {
        if (this.colourPanel_) ScratchBlocks.DropDownDiv.hideWithoutAnimation();
        NativeColour.prototype.dispose.call(this);
    };
    ScratchBlocks.Field.register('field_new_colour_card', Card);
    registered.add(ScratchBlocks);
};
