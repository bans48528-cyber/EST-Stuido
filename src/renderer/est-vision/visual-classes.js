// Studio-owned labels carried by the existing schema-1 class_id field.
export const FACE_CLASS_BASE = 2100;
export const FACE_ACTIONS = Object.freeze([
    {id: 'natural', label: '自然', mask: 0},
    {id: 'smile', label: '微笑', mask: 1},
    {id: 'blink', label: '眨眼', mask: 2},
    {id: 'mouth', label: '张嘴', mask: 4}
]);
export const POSE_ACTIONS = Object.freeze([
    {id: 'standing', label: '站立', classId: 3101},
    {id: 'leftUp', label: '举起左手', classId: 3102},
    {id: 'rightUp', label: '举起右手', classId: 3103},
    {id: 'bothUp', label: '举起双手', classId: 3104},
    {id: 'squat', label: '下蹲', classId: 3105},
    {id: 'leanLeft', label: '身体左倾', classId: 3106},
    {id: 'leanRight', label: '身体右倾', classId: 3107}
]);

export const visualClassPredicate = (kind, action) => {
    const classes = kind === 'face' ? FACE_ACTIONS : kind === 'pose' ? POSE_ACTIONS : null;
    if (!classes) throw new Error('Invalid vision target kind');
    const selected = typeof action === 'undefined' ? null : classes.find(item => item.id === action);
    if (typeof action !== 'undefined' && !selected) throw new Error('Invalid vision action');
    const range = kind === 'face' ? `${FACE_CLASS_BASE} <= s[1] <= ${FACE_CLASS_BASE + 7}` :
        `${POSE_ACTIONS[0].classId} <= s[1] <= ${POSE_ACTIONS[POSE_ACTIONS.length - 1].classId}`;
    let match = range;
    if (selected) {
        match = kind === 'pose' ? `s[1] == ${selected.classId}` : selected.mask === 0 ?
            `s[1] == ${FACE_CLASS_BASE}` :
            `${range} and bool((s[1] - ${FACE_CLASS_BASE}) & ${selected.mask})`;
    }
    return `(lambda s: bool(s[0]) and ${match})(rt.vision_snapshot('${kind}'))`;
};
