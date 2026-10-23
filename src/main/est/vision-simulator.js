import {
    VISION_SENSOR_CLEAR_REASON_NO_TARGET,
    VISION_SENSOR_DEFAULT_TTL_MS,
    VISION_SENSOR_SEND_INTERVAL_MS
} from './constants';

export class EstVisionSimulator {
    constructor (deviceService) {
        this.deviceService = deviceService;
        this.timer = null;
        this.frame = 0;
        this.options = null;
    }

    start (options = {}) {
        this.stop({clear: false});
        this.options = {
            classId: Number.isInteger(options.classId) ? options.classId : 0,
            confidencePermille: Number.isInteger(options.confidencePermille) ?
                options.confidencePermille : 920,
            ttlMs: Number.isInteger(options.ttlMs) ? options.ttlMs : VISION_SENSOR_DEFAULT_TTL_MS,
            intervalMs: Math.max(
                VISION_SENSOR_SEND_INTERVAL_MS,
                Number(options.intervalMs) || VISION_SENSOR_SEND_INTERVAL_MS
            )
        };
        this.frame = 0;
        this._tick();
        this.timer = setInterval(() => this._tick(), this.options.intervalMs);
        return this.getState();
    }

    noTarget () {
        this.stop({clear: false});
        this.deviceService.clearVision(VISION_SENSOR_CLEAR_REASON_NO_TARGET);
        return this.getState();
    }

    stop ({clear = true} = {}) {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        if (clear) {
            this.deviceService.clearVision(VISION_SENSOR_CLEAR_REASON_NO_TARGET);
        }
        return this.getState();
    }

    getState () {
        return {
            active: Boolean(this.timer),
            generatedFrames: this.frame,
            options: this.options,
            publisher: this.deviceService.getVisionPublisherState()
        };
    }

    _tick () {
        const phase = this.frame % 120;
        const centerX = phase < 60 ? 2000 + (phase * 100) : 8000 - ((phase - 60) * 100);
        this.deviceService.updateVisionSample({
            classId: this.options.classId,
            confidencePermille: this.options.confidencePermille,
            ttlMs: this.options.ttlMs,
            centerX,
            centerY: 5000,
            width: 2600,
            height: 4200
        });
        this.frame++;
    }
}
