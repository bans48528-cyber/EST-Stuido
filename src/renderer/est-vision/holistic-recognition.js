const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const angle = (a, b, c) => {
    const ab = {x: a.x - b.x, y: a.y - b.y};
    const cb = {x: c.x - b.x, y: c.y - b.y};
    const denominator = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);
    if (!denominator) return 180;
    return Math.acos(Math.max(-1, Math.min(1, ((ab.x * cb.x) + (ab.y * cb.y)) / denominator))) *
        (180 / Math.PI);
};

const fingerExtended = (landmarks, tip, pip) => (
    distance(landmarks[tip], landmarks[0]) > distance(landmarks[pip], landmarks[0]) * 1.12
);

export const recognizeHandGesture = landmarks => {
    if (!landmarks || landmarks.length < 21) return {label: '未检测', confidence: 0};
    const extended = [
        fingerExtended(landmarks, 8, 6),
        fingerExtended(landmarks, 12, 10),
        fingerExtended(landmarks, 16, 14),
        fingerExtended(landmarks, 20, 18)
    ];
    const extendedCount = extended.filter(Boolean).length;
    const thumbRaised = landmarks[4].y < landmarks[3].y && landmarks[4].y < landmarks[2].y;
    if (extendedCount === 0 && thumbRaised) return {label: '点赞', confidence: 0.82};
    if (extendedCount === 0 && landmarks[4].y > landmarks[3].y) return {label: '握拳', confidence: 0.78};
    if (extendedCount === 4) return {label: '张开手掌', confidence: 0.88};
    if (extended[0] && !extended[1] && !extended[2] && !extended[3]) {
        return {label: '食指指向', confidence: 0.8};
    }
    if (extended[0] && extended[1] && !extended[2] && !extended[3]) {
        return {label: '胜利手势', confidence: 0.84};
    }
    return {label: '其他手势', confidence: 0.55};
};

export const recognizePose = landmarks => {
    if (!landmarks || landmarks.length < 33) return {label: '未检测', confidence: 0};
    const visible = indices => indices.every(index => landmarks[index].visibility > 0.45);
    if (!visible([11, 12, 23, 24])) return {label: '未检测', confidence: 0};
    const leftWristUp = landmarks[15].visibility > 0.45 && landmarks[15].y < landmarks[11].y;
    const rightWristUp = landmarks[16].visibility > 0.45 && landmarks[16].y < landmarks[12].y;
    const kneeAngle = Math.min(
        angle(landmarks[23], landmarks[25], landmarks[27]),
        angle(landmarks[24], landmarks[26], landmarks[28])
    );
    const shoulderX = (landmarks[11].x + landmarks[12].x) / 2;
    const hipX = (landmarks[23].x + landmarks[24].x) / 2;
    if (leftWristUp && rightWristUp) return {label: '举起双手', confidence: 0.9};
    if (leftWristUp) return {label: '举起左手', confidence: 0.84};
    if (rightWristUp) return {label: '举起右手', confidence: 0.84};
    const legsVisible = visible([25, 26, 27, 28]);
    if (legsVisible && kneeAngle < 125) return {label: '下蹲', confidence: 0.76};
    if (shoulderX - hipX > 0.07) return {label: '身体右倾', confidence: 0.72};
    if (hipX - shoulderX > 0.07) return {label: '身体左倾', confidence: 0.72};
    return legsVisible ? {label: '站立', confidence: 0.75} : {label: '未检测', confidence: 0};
};

export const recognizeFaceActions = landmarks => {
    if (!landmarks || landmarks.length < 468) return [];
    const faceWidth = Math.max(0.001, distance(landmarks[234], landmarks[454]));
    const leftEye = distance(landmarks[159], landmarks[145]) /
        Math.max(0.001, distance(landmarks[33], landmarks[133]));
    const rightEye = distance(landmarks[386], landmarks[374]) /
        Math.max(0.001, distance(landmarks[362], landmarks[263]));
    const mouthOpen = distance(landmarks[13], landmarks[14]) / faceWidth;
    const mouthWidth = distance(landmarks[61], landmarks[291]) / faceWidth;
    const actions = [];
    if ((leftEye + rightEye) / 2 < 0.16) actions.push('眨眼');
    if (mouthOpen > 0.055) actions.push('张嘴');
    if (mouthWidth > 0.38 && mouthOpen < 0.09) actions.push('微笑');
    return actions.length ? actions : ['自然'];
};

export const summarizeHolisticResults = results => {
    const hands = [results.leftHandLandmarks, results.rightHandLandmarks]
        .filter(Boolean)
        .map(recognizeHandGesture);
    return {
        face: results.faceLandmarks && results.faceLandmarks.length >= 468 ?
            recognizeFaceActions(results.faceLandmarks) : ['未检测'],
        gesture: hands.length ? hands[0] : {label: '未检测', confidence: 0},
        pose: recognizePose(results.poseLandmarks)
    };
};

const mostFrequent = values => {
    const counts = values.reduce((result, value) => {
        result[value] = (result[value] || 0) + 1;
        return result;
    }, {});
    return Object.keys(counts).reduce((best, value) => (
        !best || counts[value] > counts[best] ? value : best
    ), null);
};

export const createHolisticResultStabilizer = (windowSize = 5, minimumVotes = 3) => {
    let history = [];
    const stable = {
        face: ['未检测'],
        gesture: {label: '未检测', confidence: 0},
        pose: {label: '未检测', confidence: 0}
    };

    const stabilizeLabel = key => {
        const label = mostFrequent(history.map(item => item[key].label));
        const matches = history.filter(item => item[key].label === label);
        if (matches.length < Math.min(minimumVotes, history.length)) return stable[key];
        return {
            label,
            confidence: matches.reduce((sum, item) => sum + item[key].confidence, 0) / matches.length
        };
    };

    return {
        push (result) {
            history = history.concat(result).slice(-windowSize);
            stable.gesture = stabilizeLabel('gesture');
            stable.pose = stabilizeLabel('pose');
            const faceActions = ['眨眼', '张嘴', '微笑'].filter(action => (
                history.filter(item => item.face.includes(action)).length >= Math.min(minimumVotes, history.length)
            ));
            stable.face = faceActions.length ? faceActions : [
                history.every(item => item.face.includes('未检测')) ? '未检测' : '自然'
            ];
            return {
                face: stable.face.slice(),
                gesture: Object.assign({}, stable.gesture),
                pose: Object.assign({}, stable.pose)
            };
        },
        reset () {
            history = [];
            stable.face = ['未检测'];
            stable.gesture = {label: '未检测', confidence: 0};
            stable.pose = {label: '未检测', confidence: 0};
        }
    };
};
