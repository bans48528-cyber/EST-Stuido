import {recognizeHandGesture, recognizePose, recognizeFaceActions} from './holistic-recognition';

const absent = () => ({label: '未检测', detected: false, landmarks: null});

export const separateHands = (result = {}, inputMirrored = false) => {
    const hands = {left: absent(), right: absent()};
    (result.multiHandLandmarks || []).forEach((landmarks, index) => {
        const classification = (result.multiHandedness || [])[index];
        if (!classification || landmarks.length < 21 || classification.score < 0.5) return;
        const modelLeft = classification.label === 'Left';
        if (classification.label !== 'Left' && classification.label !== 'Right') return;
        // MediaPipe Hands labels assume mirrored input; camera pixels are not CSS-mirrored.
        const side = (inputMirrored ? modelLeft : !modelLeft) ? 'left' : 'right';
        if (hands[side].detected && hands[side].handednessScore >= classification.score) return;
        hands[side] = {
            label: recognizeHandGesture(landmarks).label,
            detected: true,
            landmarks,
            handednessScore: classification.score
        };
    });
    return hands;
};

export const summarizeIndependentResults = result => ({
    hands: separateHands(result.hands),
    pose: recognizePose(result.pose.poseLandmarks),
    face: result.face.multiFaceLandmarks && result.face.multiFaceLandmarks[0] ?
        recognizeFaceActions(result.face.multiFaceLandmarks[0]) : ['未检测']
});

export const createHandStabilizer = () => {
    const histories = {left: [], right: []};
    return {
        push (hands) {
            const output = {};
            ['left', 'right'].forEach(side => {
                const hand = hands[side];
                if (!hand.detected) {
                    histories[side] = [];
                    output[side] = absent();
                    return;
                }
                const history = histories[side] = histories[side].concat(hand.label).slice(-5);
                const votes = new Map();
                history.forEach(label => votes.set(label, (votes.get(label) || 0) + 1));
                const label = Array.from(votes.keys()).reduce((best, candidate) => (
                    votes.get(candidate) > votes.get(best) ? candidate : best
                ), hand.label);
                output[side] = Object.assign({}, hand, {label});
            });
            return output;
        },
        reset () {
            histories.left = [];
            histories.right = [];
        }
    };
};
