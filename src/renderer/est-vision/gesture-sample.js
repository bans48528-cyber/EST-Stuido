const labels = ['张开手掌', '握拳', '点赞', '食指指向', '胜利手势', '其他手势'];

export const mapGestureSample = (hands, side, capturedAt, now) => {
    if (!['left', 'right'].includes(side)) throw new Error('Invalid hand selection');
    if (!Number.isFinite(capturedAt) || !Number.isFinite(now) || now < capturedAt || now - capturedAt > 200) {
        return null;
    }
    const hand = hands[side];
    if (!hand || !hand.detected || !hand.landmarks || hand.landmarks.length !== 21) return null;
    if (!hand.landmarks.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))) return null;
    const clamp = value => Math.max(0, Math.min(1, value));
    const xs = hand.landmarks.map(point => 1 - point.x);
    const ys = hand.landmarks.map(point => point.y);
    const minX = clamp(Math.min(...xs)), maxX = clamp(Math.max(...xs));
    const minY = clamp(Math.min(...ys)), maxY = clamp(Math.max(...ys));
    const width = Math.round((maxX - minX) * 10000);
    const height = Math.round((maxY - minY) * 10000);
    if (!width || !height) return null;
    const index = labels.indexOf(hand.label);
    return {
        sensorId: 0, ttlMs: 500,
        classId: (side === 'left' ? 1100 : 1200) + (index < 0 ? 6 : index + 1),
        confidencePermille: 0,
        centerX: Math.round((minX + maxX) * 5000),
        centerY: Math.round((minY + maxY) * 5000), width, height
    };
};
