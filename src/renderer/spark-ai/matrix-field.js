const registered = new WeakSet();

export const registerSparkMatrixField = ScratchBlocks => {
    if (registered.has(ScratchBlocks) || !ScratchBlocks.Field || typeof document === 'undefined') return;
    const Native = ScratchBlocks.Field.fromJson({type: 'field_matrix', matrix: '', width: 5, height: 7}).constructor;
    const SparkMatrix = function (matrix) {
        // The native constructor sets the value before initializing its dimensions.
        Native.call(this, '', 5, 7);
        this.setValue(matrix || '0'.repeat(35));
    };
    SparkMatrix.prototype = Object.create(Native.prototype);
    SparkMatrix.prototype.constructor = SparkMatrix;
    SparkMatrix.fromJson = options => new SparkMatrix(options.matrix);
    SparkMatrix.prototype.setValue = function (matrix) {
        const value = String(matrix || '').replace(/[^01]/g, '')
            .padEnd(35, '0')
            .slice(0, 35);
        if (this.zeros_) Native.prototype.setValue.call(this, value);
    };
    SparkMatrix.prototype.updateMatrix_ = function () {
        if (this.sourceBlock_) Native.prototype.updateMatrix_.call(this);
    };
    // Firmware stores seven rows of five pixels (x is row, y is column).
    SparkMatrix.prototype.checkForLED_ = function (event) {
        const bounds = this.matrixStage_.getBoundingClientRect();
        if (event.clientY < bounds.top || event.clientY >= bounds.bottom ||
            event.clientX < bounds.left || event.clientX >= bounds.right) return -1;
        const size = Native.MATRIX_NODE_SIZE;
        const pad = Native.MATRIX_NODE_PAD;
        const x = (event.clientX - bounds.left) * ((5 * size) + (6 * pad)) / bounds.width;
        const y = (event.clientY - bounds.top) * ((7 * size) + (8 * pad)) / bounds.height;
        const column = Math.floor((x - (pad / 2)) / (size + pad));
        const row = Math.floor((y - (pad / 2)) / (size + pad));
        return column >= 0 && column < 5 && row >= 0 && row < 7 ? column + (row * 5) : -1;
    };
    ScratchBlocks.Field.register('field_spark_matrix', SparkMatrix);
    registered.add(ScratchBlocks);
};
