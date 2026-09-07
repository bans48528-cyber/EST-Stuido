export const EST_DISPLAY_BITMAP_WIDTH = 180;
export const EST_DISPLAY_BITMAP_HEIGHT = 128;
export const EST_DISPLAY_BITMAP_STRIDE = Math.ceil(EST_DISPLAY_BITMAP_WIDTH / 8);
export const EST_DISPLAY_BITMAP_BYTE_LENGTH = EST_DISPLAY_BITMAP_STRIDE * EST_DISPLAY_BITMAP_HEIGHT;
export const EST_DISPLAY_BITMAP_EMPTY = 'v1:';
const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const bytesToBase64 = bytes => {
    let encoded = '';
    for (let index = 0; index < bytes.length; index += 3) {
        const first = bytes[index];
        const second = index + 1 < bytes.length ? bytes[index + 1] : 0;
        const third = index + 2 < bytes.length ? bytes[index + 2] : 0;
        const value = (first << 16) | (second << 8) | third;
        encoded += BASE64_ALPHABET[(value >> 18) & 0x3f];
        encoded += BASE64_ALPHABET[(value >> 12) & 0x3f];
        encoded += index + 1 < bytes.length ? BASE64_ALPHABET[(value >> 6) & 0x3f] : '=';
        encoded += index + 2 < bytes.length ? BASE64_ALPHABET[value & 0x3f] : '=';
    }
    return encoded;
};

const base64ToBytes = value => {
    const encoded = String(value || '');
    if (!encoded) return new Uint8Array(0);
    if (encoded.length % 4 !== 0) return new Uint8Array(0);
    const decoded = [];
    for (let index = 0; index < encoded.length; index += 4) {
        const first = BASE64_ALPHABET.indexOf(encoded[index]);
        const second = BASE64_ALPHABET.indexOf(encoded[index + 1]);
        const third = encoded[index + 2] === '=' ? 0 : BASE64_ALPHABET.indexOf(encoded[index + 2]);
        const fourth = encoded[index + 3] === '=' ? 0 : BASE64_ALPHABET.indexOf(encoded[index + 3]);
        if (first < 0 || second < 0 || third < 0 || fourth < 0) return new Uint8Array(0);
        const packed = (first << 18) | (second << 12) | (third << 6) | fourth;
        decoded.push((packed >> 16) & 0xff);
        if (encoded[index + 2] !== '=') decoded.push((packed >> 8) & 0xff);
        if (encoded[index + 3] !== '=') decoded.push(packed & 0xff);
        if (decoded.length >= EST_DISPLAY_BITMAP_BYTE_LENGTH) break;
    }
    return Uint8Array.from(decoded.slice(0, EST_DISPLAY_BITMAP_BYTE_LENGTH));
};

export const createEmptyEstDisplayBitmap = () => new Uint8Array(EST_DISPLAY_BITMAP_BYTE_LENGTH);

export const decodeEstDisplayBitmap = value => {
    const pixels = createEmptyEstDisplayBitmap();
    const serialized = String(value || '');
    if (!serialized.startsWith('v1:')) return pixels;
    pixels.set(base64ToBytes(serialized.slice(3)));
    return pixels;
};

export const encodeEstDisplayBitmap = pixels => {
    const bytes = Uint8Array.from(pixels || []).slice(0, EST_DISPLAY_BITMAP_BYTE_LENGTH);
    let usedLength = bytes.length;
    while (usedLength > 0 && bytes[usedLength - 1] === 0) usedLength--;
    return usedLength ? `v1:${bytesToBase64(bytes.slice(0, usedLength))}` : EST_DISPLAY_BITMAP_EMPTY;
};

export const normalizeEstDisplayBitmap = value => encodeEstDisplayBitmap(decodeEstDisplayBitmap(value));

export const getEstDisplayBitmapPixel = (pixels, x, y) => {
    if (x < 0 || y < 0 || x >= EST_DISPLAY_BITMAP_WIDTH || y >= EST_DISPLAY_BITMAP_HEIGHT) return false;
    const byteIndex = (y * EST_DISPLAY_BITMAP_STRIDE) + Math.floor(x / 8);
    return Boolean(pixels[byteIndex] & (0x80 >> (x % 8)));
};

export const setEstDisplayBitmapPixel = (pixels, x, y, on) => {
    if (x < 0 || y < 0 || x >= EST_DISPLAY_BITMAP_WIDTH || y >= EST_DISPLAY_BITMAP_HEIGHT) return;
    const byteIndex = (y * EST_DISPLAY_BITMAP_STRIDE) + Math.floor(x / 8);
    const mask = 0x80 >> (x % 8);
    pixels[byteIndex] = on ? pixels[byteIndex] | mask : pixels[byteIndex] & ~mask;
};

export const drawEstDisplayBitmapRectangle = (pixels, start, end, filled, strokeWidth = 1, on = true) => {
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    const thickness = Math.max(1, Math.round(strokeWidth));
    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            const onBorder = x - minX < thickness || maxX - x < thickness ||
                y - minY < thickness || maxY - y < thickness;
            if (filled || onBorder) setEstDisplayBitmapPixel(pixels, x, y, on);
        }
    }
};

export const drawEstDisplayBitmapCircle = (pixels, center, edge, filled, strokeWidth = 1, on = true) => {
    const radius = Math.hypot(edge.x - center.x, edge.y - center.y);
    if (radius < 0.5) {
        setEstDisplayBitmapPixel(pixels, center.x, center.y, on);
        return;
    }
    const outerRadius = radius + 0.35;
    const innerRadius = Math.max(0, radius - Math.max(1, Math.round(strokeWidth)) + 0.35);
    const extent = Math.ceil(outerRadius);
    for (let y = center.y - extent; y <= center.y + extent; y++) {
        for (let x = center.x - extent; x <= center.x + extent; x++) {
            const distance = Math.hypot(x - center.x, y - center.y);
            if (distance > outerRadius || (!filled && innerRadius > 0 && distance < innerRadius)) continue;
            setEstDisplayBitmapPixel(pixels, x, y, on);
        }
    }
};

export const estDisplayBitmapHasInk = pixels => pixels.some(byte => byte !== 0);

export const cropEstDisplayBitmap = pixels => {
    let minX = EST_DISPLAY_BITMAP_WIDTH;
    let minY = EST_DISPLAY_BITMAP_HEIGHT;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < EST_DISPLAY_BITMAP_HEIGHT; y++) {
        for (let x = 0; x < EST_DISPLAY_BITMAP_WIDTH; x++) {
            if (!getEstDisplayBitmapPixel(pixels, x, y)) continue;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        }
    }
    if (maxX < 0) return null;

    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    const stride = Math.ceil(width / 8);
    const data = new Uint8Array(stride * height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (!getEstDisplayBitmapPixel(pixels, minX + x, minY + y)) continue;
            data[(y * stride) + Math.floor(x / 8)] |= 0x80 >> (x % 8);
        }
    }
    return {x: minX, y: minY, width, height, data};
};

export const estDisplayBitmapBytesLiteral = bytes => (
    `bytes.fromhex('${Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')}')`
);
