const scriptLoads = new Map();
const loadScript = url => {
    if (!scriptLoads.has(url)) {
        scriptLoads.set(url, new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = resolve;
            script.onerror = () => {
                scriptLoads.delete(url);
                script.remove();
                reject(new Error(`无法加载视觉模型脚本: ${url}`));
            };
            document.head.appendChild(script);
        }));
    }
    return scriptLoads.get(url);
};

export const VISION_MODELS = [
    {kind: 'hands', constructorName: 'Hands', options: {
        maxNumHands: 2, modelComplexity: 1, selfieMode: false,
        minDetectionConfidence: 0.5, minTrackingConfidence: 0.5
    }},
    {kind: 'pose', constructorName: 'Pose', options: {
        modelComplexity: 0, smoothLandmarks: true, enableSegmentation: false,
        minDetectionConfidence: 0.5, minTrackingConfidence: 0.5
    }},
    {kind: 'face_mesh', constructorName: 'FaceMesh', options: {
        maxNumFaces: 1, refineLandmarks: false,
        minDetectionConfidence: 0.5, minTrackingConfidence: 0.5
    }}
];

export class IndependentVision {
    constructor ({baseUrl = new URL('static/', document.baseURI).href, createModel, onProgress = () => {}} = {}) {
        this.baseUrl = baseUrl;
        this.createModel = createModel;
        this.onProgress = onProgress;
        this.initialized = new Set();
        this.models = {};
        this.closed = false;
        this.busy = false;
        this.connections = {};
    }

    initialize (enabled = {}) {
        const needed = VISION_MODELS.filter(spec => enabled[spec.kind === 'face_mesh' ? 'face' : spec.kind] !== false);
        if (needed.every(spec => this.initialized.has(spec.kind))) return Promise.resolve();
        this.ready = Promise.resolve(this.ready).catch(() => {}).then(() => this.initializeModels(needed));
        return this.ready;
    }

    async initializeModels (needed) {
        try {
            const warmup = document.createElement('canvas');
            warmup.width = 640;
            warmup.height = 480;
            // Initialize sequentially to avoid competing shader compilations at startup.
            for (const spec of needed) {
                if (this.closed) return;
                if (this.initialized.has(spec.kind)) continue;
                this.onProgress({kind: spec.kind, stage: 'load'});
                // Paint the progress state before script evaluation and shader compilation.
                await new Promise(resolve => setTimeout(resolve, 32));
                const base = new URL(`mediapipe-${spec.kind}/`, this.baseUrl).href;
                if (!this.createModel) await loadScript(new URL(`${spec.kind}.js`, base).href);
                if (this.closed) return;
                const model = this.createModel ? this.createModel(spec) :
                    new window[spec.constructorName]({locateFile: file => new URL(file, base).href});
                this.models[spec.kind] = model;
                model.setOptions(spec.options);
                model.onResults(() => {});
                this.onProgress({kind: spec.kind, stage: 'initialize'});
                await new Promise(resolve => setTimeout(resolve, 32));
                await model.initialize();
                if (this.closed) return;
                this.onProgress({kind: spec.kind, stage: 'warmup'});
                await new Promise(resolve => setTimeout(resolve, 32));
                await model.send({image: warmup});
                this.initialized.add(spec.kind);
            }
            this.connections = {
                hands: window.HAND_CONNECTIONS || [],
                pose: window.POSE_CONNECTIONS || [],
                face: window.FACEMESH_CONTOURS || []
            };
        } catch (error) {
            await this.releaseModels();
            throw error;
        }
    }

    async process (image, enabled = {}) {
        if (this.closed) return null;
        if (this.busy) return null;
        this.busy = true;
        this.pending = (async () => {
            await this.initialize(enabled);
            if (this.closed) return null;
            const result = {hands: {}, pose: {}, face: {}, timings: {}};
            const work = [['hands', 'hands'], ['pose', 'pose'], ['face_mesh', 'face']].map(async ([kind, key]) => {
                if (enabled[key] === false) return;
                const model = this.models[kind];
                const started = performance.now();
                model.onResults(value => { result[key] = value; });
                await model.send({image});
                result.timings[key] = performance.now() - started;
            });
            const completed = await Promise.allSettled(work);
            const failure = completed.find(item => item.status === 'rejected');
            if (failure) throw failure.reason;
            return this.closed ? null : result;
        })();
        try {
            return await this.pending;
        } finally {
            this.busy = false;
        }
    }

    async releaseModels () {
        const models = Object.values(this.models);
        this.models = {};
        this.initialized.clear();
        await Promise.allSettled(models.map(model => model.close()));
    }

    async close () {
        this.closed = true;
        await Promise.allSettled([this.ready, this.pending]);
        await this.releaseModels();
    }
}
