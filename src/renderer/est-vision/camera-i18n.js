import {getEstText} from '../est-i18n';
import {FACE_ACTIONS, POSE_ACTIONS} from './visual-classes';

// Recognition labels remain unchanged on the wire; only presentation is translated.
export const CAMERA_RESULT_KEYS = {
    未检测: 'camera.absent',
    张开手掌: 'vision.palm',
    握拳: 'vision.fist',
    点赞: 'vision.thumb',
    食指指向: 'vision.point',
    胜利手势: 'vision.victory',
    其他手势: 'vision.other'
};
FACE_ACTIONS.forEach(action => {
    CAMERA_RESULT_KEYS[action.label] = `vision.face.${action.id}`;
});
POSE_ACTIONS.forEach(action => {
    CAMERA_RESULT_KEYS[action.label] = `vision.pose.${action.id}`;
});

export const cameraResultText = (label, locale) =>
    getEstText(CAMERA_RESULT_KEYS[label] || 'camera.unknown', locale);

export const cameraProgressText = (progress, locale) => {
    if (!progress) return getEstText('camera.starting', locale);
    if (!progress.kind) return getEstText('camera.preparing', locale);
    return getEstText(`camera.progress.${progress.stage}`, locale, {
        model: getEstText(`camera.model.${progress.kind}`, locale)
    });
};

export const cameraErrorKey = (error, fallback = 'camera.error.send') => {
    const name = error && error.name;
    const names = {
        NotAllowedError: 'denied',
        PermissionDeniedError: 'denied',
        SecurityError: 'denied',
        NotFoundError: 'missing',
        DevicesNotFoundError: 'missing',
        NotReadableError: 'busy',
        TrackStartError: 'busy',
        OverconstrainedError: 'constraints',
        ConstraintNotSatisfiedError: 'constraints'
    };
    if (names[name]) return `camera.error.${names[name]}`;
    const message = String((error && error.message) || error || '');
    if (/vision-input-multi|一次只能接收一个/.test(message)) return 'camera.status.multi';
    if (/vision-input/.test(message)) return 'camera.status.unsupported';
    if (/下载或升级|firmware update.*progress/i.test(message)) return 'camera.status.paused';
    if (/已被占用/.test(message)) return 'camera.error.occupied';
    if (/已停止|窗口已关闭/.test(message)) return 'camera.error.stopped';
    if (/设备已断开|disconnected|device.*not.*connected/i.test(message)) return 'camera.error.connection';
    if (/模型|wasm|webgl|fetch|abort\(|\bmodel\b/i.test(message)) return 'camera.error.model';
    return fallback;
};
