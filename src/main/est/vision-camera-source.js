// A renderer lease prevents stale callbacks and competing simulator writes.
export class VisionCameraSource {
    constructor (service, simulator) {
        this.service = service;
        this.simulator = simulator;
        this.owner = null;
        this.generation = 0;
        this.timer = null;
    }

    start (owner, options = {}) {
        const state = this.service.getVisionPublisherState();
        if (!state.connected || !state.supported) throw new Error('需要连接支持 vision-input 的协议 1.30 EST');
        if (state.paused) throw new Error('下载或升级期间不能启用摄像头发送');
        if (this.owner !== null) throw new Error('摄像头发送已被占用');
        const targets = Array.isArray(options.targets) ?
            [...new Set(options.targets)] : [];
        if (targets.some(target => !['left', 'right', 'pose', 'face'].includes(target))) {
            throw new Error('视觉目标必须是 left、right、pose 或 face');
        }
        if (targets.length > 1 && !state.multiSupported) {
            throw new Error('多项识别需要支持 vision-input-multi 的协议 1.31 EST 固件');
        }
        this.simulator.stop({clear: false});
        this.owner = owner;
        this.targets = targets;
        this.generation++;
        this.empty = false;
        this.paused = false;
        this.service.clearVision(0);
        this.armTimeout();
        return this.generation;
    }

    armTimeout () {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.stop(), 300);
    }

    frame (owner, token, sample) {
        if (this.owner !== owner || this.generation !== token) throw new Error('摄像头发送已停止，请重新启用');
        const state = this.service.getVisionPublisherState();
        if (!state.connected || !state.supported) {
            this.stop();
            throw new Error('设备已断开或视觉发送已暂停');
        }
        this.armTimeout();
        if (state.paused) {
            // Keep the lease, but discard every paused frame and any pre-download target.
            if (!this.paused) this.service.clearVision(2);
            this.paused = true;
            this.empty = false;
            return state;
        }
        this.paused = false;
        if (sample && sample.targets) {
            const targets = Object.keys(sample.enabled || {}).filter(target => sample.enabled[target]);
            if (state.multiSupported) {
                this.empty = false;
                return this.service.updateVisionFrame(sample);
            }
            if (targets.length !== 1) {
                throw new Error('当前 EST 固件一次只能接收一个视觉目标');
            }
            const target = sample.targets[targets[0]];
            if (target) {
                this.empty = false;
                return this.service.updateVisionSample(target);
            }
            if (!this.empty) {
                this.empty = true;
                return this.service.clearVision(1);
            }
            return this.service.getVisionPublisherState();
        }
        if (sample) {
            this.empty = false;
            return this.service.updateVisionSample(sample);
        }
        if (!this.empty) {
            this.empty = true;
            return this.service.clearVision(1);
        }
        return this.service.getVisionPublisherState();
    }

    stop (owner = this.owner, token = this.generation) {
        if (this.owner === null || owner !== this.owner || token !== this.generation) return;
        clearTimeout(this.timer);
        this.timer = null;
        this.owner = null;
        this.targets = null;
        this.service.clearVision(2);
    }

    requireAvailable () {
        if (this.owner !== null) throw new Error('请先关闭摄像头发送，再使用模拟视觉数据');
    }
}
