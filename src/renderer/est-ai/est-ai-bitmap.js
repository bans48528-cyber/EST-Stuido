import {
    EST_DISPLAY_BITMAP_WIDTH, EST_DISPLAY_BITMAP_HEIGHT, EST_DISPLAY_BITMAP_BYTE_LENGTH,
    createEmptyEstDisplayBitmap, encodeEstDisplayBitmap, normalizeEstDisplayBitmap, setEstDisplayBitmapPixel
} from '../est-blocks/display-bitmap';

// A bounded pixel matrix, not executable drawing commands or an external image URL.
export const normalizeEstAiBitmap = value => {
    if (typeof value === 'string') {
        if (value.length <= 3 + (Math.ceil(EST_DISPLAY_BITMAP_BYTE_LENGTH / 3) * 4) &&
            /^v1:(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value) &&
            normalizeEstDisplayBitmap(value) === value) return value;
        throw new Error('BITMAP 编码无效');
    }
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        Object.keys(value).some(key => !['rows', 'x', 'y', 'scale'].includes(key))) {
        throw new Error('BITMAP 必须是 {rows:["010"],x:0,y:0,scale:1} 或 v1 编码');
    }
    const {rows, x = 0, y = 0, scale = 1} = value;
    if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(scale) ||
        x < 0 || y < 0 || scale < 1 || scale > 16 || !Array.isArray(rows) ||
        !rows.length || rows.length > EST_DISPLAY_BITMAP_HEIGHT || typeof rows[0] !== 'string' ||
        !rows[0].length || rows.some(row => typeof row !== 'string' ||
            row.length !== rows[0].length || !/^[01]+$/.test(row)) ||
        x + (rows[0].length * scale) > EST_DISPLAY_BITMAP_WIDTH ||
        y + (rows.length * scale) > EST_DISPLAY_BITMAP_HEIGHT) {
        throw new Error('BITMAP 行必须为等宽 0/1 字符串，缩放后不能超出 180×128 屏幕');
    }
    const pixels = createEmptyEstDisplayBitmap();
    rows.forEach((row, rowIndex) => {
        for (let column = 0; column < row.length; column++) {
            if (row[column] !== '1') continue;
            for (let dy = 0; dy < scale; dy++) {
                for (let dx = 0; dx < scale; dx++) {
                    setEstDisplayBitmapPixel(pixels, x + (column * scale) + dx,
                        y + (rowIndex * scale) + dy, true);
                }
            }
        }
    });
    return encodeEstDisplayBitmap(pixels);
};
