import {getCurrentEstLocale} from '../est-i18n';
import {sparkText} from './messages';

export const SPARK_MOTOR_PORTS = ['E', 'F', 'G', 'H'];
export const SPARK_MOTOR_PAIR_INCOMPLETE = 'SPARK_MOTOR_PAIR_INCOMPLETE';
export const parseSparkMotorPair = value => [...new Set(String(value || '').split('+')
    .filter(port => SPARK_MOTOR_PORTS.includes(port)))].slice(0, 2);
export const selectSparkMotorPort = (value, port) => {
    const selected = parseSparkMotorPair(value);
    if (!SPARK_MOTOR_PORTS.includes(port)) return selected.join('+');
    if (selected.length === 2) return port;
    return (selected.includes(port) ? selected : [...selected, port]).join('+');
};

const registered = new WeakSet();
const element = (tag, style, text) => {
    const node = document.createElement(tag);
    Object.assign(node.style, style);
    if (text) node.textContent = text;
    return node;
};

export const registerSparkCombinedMotorField = ScratchBlocks => {
    if (registered.has(ScratchBlocks) || !ScratchBlocks.Field || typeof document === 'undefined') return;
    const Native = ScratchBlocks.Field.fromJson({type: 'field_dropdown', options: [['E', 'E']]}).constructor;
    const Field = function () {
        Native.call(this, SPARK_MOTOR_PORTS.map(port => [port, port]));
        this.setValue('E+F');
    };
    Field.prototype = Object.create(Native.prototype);
    Field.prototype.constructor = Field;
    Field.fromJson = () => new Field();
    Field.prototype.setValue = function (value) {
        if (value === null || typeof value === 'undefined') return;
        const ports = parseSparkMotorPair(value);
        if (!ports.length) return;
        Native.prototype.setValue.call(this, ports.join('+'));
        if (ports.length === 1) this.setText(`${ports[0]}+?`);
        this.updateEditor_();
    };
    Field.prototype.updateEditor_ = function () {
        if (!this.portEditor_) return;
        const ports = parseSparkMotorPair(this.getValue());
        const t = key => sparkText(key, getCurrentEstLocale());
        const labels = ['左电机', '右电机'];
        this.sideLabels_.forEach((label, index) => {
            label.textContent = `${t(labels[index])}: ${ports[index] || t('待选')}`;
        });
        this.portButtons_.forEach((button, index) => {
            const port = SPARK_MOTOR_PORTS[index];
            const side = ports.indexOf(port);
            button.setAttribute('aria-pressed', String(side !== -1));
            button.title = `${port}: ${t(side === -1 ? '待选' : labels[side])}`;
            button.style.background = side === -1 ? 'transparent' : this.sourceBlock_.getColour();
            button.style.color = '#ffffff';
            button.style.borderColor = side === -1 ? 'rgba(255, 255, 255, 0.55)' : '#ffffff';
        });
    };
    Field.prototype.showEditor_ = function () {
        const dropdown = ScratchBlocks.DropDownDiv;
        dropdown.hideWithoutAnimation();
        dropdown.clearContent();
        const block = this.sourceBlock_;
        const parent = block.isShadow() ? block.getParent() : block;
        const background = parent.getColour();
        const panel = element('div', {width: '248px',
            maxWidth: 'calc(100vw - 48px)',
            padding: '12px',
            boxSizing: 'border-box',
            background,
            color: '#ffffff',
            fontFamily: 'inherit'});
        panel.className = 'spark-combined-motor-selector';
        panel.setAttribute('role', 'group');
        panel.setAttribute('aria-label', sparkText('组合电机', getCurrentEstLocale()));
        const summary = element('div', {display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            marginBottom: '12px',
            fontSize: '13px',
            fontWeight: '600',
            textAlign: 'center'});
        this.sideLabels_ = ['left', 'right'].map(side => {
            const label = element('span', {overflowWrap: 'anywhere'});
            label.dataset.motorSide = side;
            summary.appendChild(label);
            return label;
        });
        panel.appendChild(summary);
        const options = element('div', {display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: '8px'});
        const colour = this.sourceBlock_.getColourTertiary();
        this.portButtons_ = SPARK_MOTOR_PORTS.map(port => {
            const button = element('button', {height: '42px',
                padding: '0',
                borderRadius: '6px',
                border: `1px solid ${colour}`,
                fontSize: '16px',
                fontWeight: 'bold',
                fontFamily: 'inherit',
                cursor: 'pointer'}, port);
            button.type = 'button';
            button.dataset.motorPort = port;
            button.onclick = () => this.setValue(selectSparkMotorPort(this.getValue(), port));
            button.onmouseenter = button.onfocus = () => {
                button.style.background = 'rgba(0, 0, 0, 0.2)';
            };
            button.onmouseleave = button.onblur = () => this.updateEditor_();
            options.appendChild(button);
            return button;
        });
        panel.appendChild(options);
        panel.onkeydown = event => {
            const index = this.portButtons_.indexOf(document.activeElement);
            if (event.key === 'Escape') {
                dropdown.hide();
            } else if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                const next = event.key === 'Home' ? 0 : (event.key === 'End' ? 3 :
                    (index + (event.key === 'ArrowLeft' ? 3 : 1)) % 4);
                this.portButtons_[next].focus();
            } else return;
            event.preventDefault();
            event.stopPropagation();
        };
        panel.onmousedown = panel.ontouchstart = event => event.stopPropagation();
        this.portEditor_ = panel;
        this.updateEditor_();
        dropdown.getContentDiv().appendChild(panel);
        dropdown.setColour(background, colour);
        dropdown.setCategory(parent.getCategory());
        this.dropDownOpen_ = true;
        const bounds = this.fieldGroup_.getBoundingClientRect();
        dropdown.setBoundsElement(block.workspace.getParentSvg().parentNode);
        dropdown.show(this, bounds.left + (bounds.width / 2), bounds.bottom,
            bounds.left + (bounds.width / 2), bounds.top, this.onHide.bind(this));
        this.portButtons_[0].focus();
    };
    Field.prototype.onHide = function () {
        if (this.portEditor_) {
            this.portEditor_.onkeydown = this.portEditor_.onmousedown = this.portEditor_.ontouchstart = null;
            this.portButtons_.forEach(button => {
                button.onclick = button.onmouseenter = button.onmouseleave = button.onfocus = button.onblur = null;
            });
        }
        this.portEditor_ = this.sideLabels_ = this.portButtons_ = null;
        Native.prototype.onHide.call(this);
    };
    Field.prototype.dispose = function () {
        if (this.portEditor_) ScratchBlocks.DropDownDiv.hideWithoutAnimation();
        Native.prototype.dispose.call(this);
    };
    ScratchBlocks.Field.register('field_spark_combined_motor', Field);
    registered.add(ScratchBlocks);
};
