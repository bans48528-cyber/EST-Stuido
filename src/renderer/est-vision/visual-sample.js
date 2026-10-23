import {mapGestureSample} from './gesture-sample';
import {FACE_ACTIONS, FACE_CLASS_BASE, POSE_ACTIONS} from './visual-classes';

export const mapVisualSample = (result, landmarks, target, capturedAt, now) => {
    if (target === 'left' || target === 'right') {
        return mapGestureSample(result.hands, target, capturedAt, now);
    }
    if (target !== 'face' && target !== 'pose') throw new Error('Invalid vision target');
    if (!Number.isFinite(capturedAt) || !Number.isFinite(now) || now < capturedAt || now - capturedAt > 200) {
        return null;
    }
    const points = landmarks[target];
    if (!points || points.length < (target === 'face' ? 468 : 33) ||
        !points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))) return null;
    let classId;
    let boxPoints = points;
    if (target === 'face') {
        if (!result.face || !result.face.length ||
            result.face.some(label => !FACE_ACTIONS.some(action => action.label === label))) return null;
        const mask = FACE_ACTIONS.reduce((bits, action) =>
            result.face.includes(action.label) ? bits | action.mask : bits, 0);
        classId = FACE_CLASS_BASE + mask;
    } else {
        const action = POSE_ACTIONS.find(item => result.pose && item.label === result.pose.label);
        if (!action || ![11, 12, 23, 24].every(index => points[index].visibility > 0.45)) return null;
        classId = action.classId;
        boxPoints = points.filter(point => point.visibility > 0.45);
    }
    const clamp = value => Math.max(0, Math.min(1, value));
    const xs = boxPoints.map(point => 1 - point.x);
    const ys = boxPoints.map(point => point.y);
    const minX = clamp(Math.min(...xs)), maxX = clamp(Math.max(...xs));
    const minY = clamp(Math.min(...ys)), maxY = clamp(Math.max(...ys));
    const width = Math.round((maxX - minX) * 10000), height = Math.round((maxY - minY) * 10000);
    if (!width || !height) return null;
    return {sensorId: 0, ttlMs: 500, classId, confidencePermille: 0,
        centerX: Math.round((minX + maxX) * 5000), centerY: Math.round((minY + maxY) * 5000), width, height};
};

export const mapVisualFrame = (result, landmarks, enabled, capturedAt, now) => {
    const targets = {};
    for (const target of ['left', 'right', 'pose', 'face']) {
        if (!enabled[target]) continue;
        targets[target] = mapVisualSample(result, landmarks, target, capturedAt, now);
    }
    return {
        ttlMs: 500,
        enabled: {
            left: Boolean(enabled.left),
            right: Boolean(enabled.right),
            pose: Boolean(enabled.pose),
            face: Boolean(enabled.face)
        },
        targets
    };
};
