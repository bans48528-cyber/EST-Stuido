/* eslint-disable react/jsx-no-bind */
import PropTypes from 'prop-types';
import React from 'react';
import {ipcRenderer} from 'electron';
import {mapVisualFrame} from './est-vision/visual-sample';
import {EST_LOCALE_CHANGED_EVENT, getCurrentEstLocale, getEstText, setCurrentEstLocale} from './est-i18n';
import {cameraErrorKey, cameraProgressText, cameraResultText} from './est-vision/camera-i18n';

import {IndependentVision} from './est-vision/independent-vision';
import {createHandStabilizer, summarizeIndependentResults} from './est-vision/hand-results';
import styles from './EstVisionLab.css';

const PROCESS_INTERVAL_MS = 1000 / 30;
const EMPTY_RESULT = {
    face: ['未检测'],
    hands: {left: {label: '未检测'}, right: {label: '未检测'}},
    pose: {label: '未检测', confidence: 0}
};

const drawConnections = (context, landmarks, connections, color, width) => {
    if (!landmarks) return;
    context.strokeStyle = color;
    context.lineWidth = width;
    context.beginPath();
    connections.forEach(connection => {
        const start = landmarks[connection[0]];
        const end = landmarks[connection[1]];
        if (!start || !end) return;
        context.moveTo(start.x * context.canvas.width, start.y * context.canvas.height);
        context.lineTo(end.x * context.canvas.width, end.y * context.canvas.height);
    });
    context.stroke();
};

const drawLandmarks = (context, landmarks, color, radius = 2) => {
    if (!landmarks) return;
    context.fillStyle = color;
    landmarks.forEach(point => {
        context.beginPath();
        context.arc(point.x * context.canvas.width, point.y * context.canvas.height, radius, 0, Math.PI * 2);
        context.fill();
    });
};

class EstVisionLab extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            locale: getCurrentEstLocale(),
            cameras: [],
            cameraId: '',
            error: '',
            loading: false,
            modelLoading: false,
            modelProgress: '',
            result: EMPTY_RESULT,
            running: false,
            sending: false,
            sendPending: false,
            publisher: '',
            enabled: {left: true, right: true, pose: true, face: true},
            stats: {fps: 0, cameraFps: 0, inferenceMs: 0, load: 0, frames: 0}
        };
        this.handStabilizer = createHandStabilizer();
        this.session = 0;
        this.videoFrameCallback = null;
        this.captureFrames = 0;
        this.handleDeviceChange = this.handleDeviceChange.bind(this);
        this.handleClose = this.handleClose.bind(this);
        this.handleBeforeUnload = () => {
            this.unmounting = true; this.stopCamera();
        };
        this.handleLocale = () => this.setState({locale: getCurrentEstLocale()});
        this.handleWindowLocale = (event, locale) => setCurrentEstLocale(locale);
    }

    componentDidMount () {
        window.addEventListener(EST_LOCALE_CHANGED_EVENT, this.handleLocale);
        ipcRenderer.on('est-vision-locale', this.handleWindowLocale);
        ipcRenderer.send('est-vision-window-ready');
        this.loadCameras();
        window.addEventListener('beforeunload', this.handleBeforeUnload);
        if (navigator.mediaDevices) {
            navigator.mediaDevices.addEventListener('devicechange', this.handleDeviceChange);
        }
    }

    componentDidUpdate (previousProps, previousState) {
        if (previousProps.visible !== this.props.visible && this.stream) {
            if (this.videoFrameCallback !== null && this.video.cancelVideoFrameCallback) {
                this.video.cancelVideoFrameCallback(this.videoFrameCallback);
            }
            cancelAnimationFrame(this.animationFrame);
            this.videoFrameCallback = null;
            this.scheduleFrame();
        }
        if (previousState.running !== this.state.running && this.props.onActivityChange) {
            this.props.onActivityChange(this.state.running);
        }
    }

    componentWillUnmount () {
        this.unmounting = true;
        window.removeEventListener(EST_LOCALE_CHANGED_EVENT, this.handleLocale);
        ipcRenderer.removeListener('est-vision-locale', this.handleWindowLocale);
        window.removeEventListener('beforeunload', this.handleBeforeUnload);
        this.stopCamera();
        if (navigator.mediaDevices) {
            navigator.mediaDevices.removeEventListener('devicechange', this.handleDeviceChange);
        }
        if (this.vision) this.vision.close().catch(() => {});
    }

    handleClose () {
        this.stopCamera();
        this.props.onClose();
    }

    toggleRecognition (kind, checked) {
        if (this.state.running || this.state.loading) return;
        this.handStabilizer.reset();
        this.setState(state => ({
            enabled: {...state.enabled, [kind]: checked},
            result: {...state.result,
                ...(kind === 'left' || kind === 'right' ? {
                    hands: {...state.result.hands, [kind]: EMPTY_RESULT.hands[kind]}
                } : {[kind]: EMPTY_RESULT[kind]})}
        }));
        if (this.canvas) this.canvas.getContext('2d').clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    handleDeviceChange () {
        this.loadCameras();
        if (this.stream && !this.stream.getVideoTracks().some(track => track.readyState === 'live')) {
            this.stopCamera();
            this.setState({error: 'camera.error.disconnected'});
        }
    }

    async loadCameras () {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            if (this.unmounting) return;
            const cameras = devices.filter(device => device.kind === 'videoinput');
            this.setState(state => ({
                cameras,
                cameraId: cameras.some(camera => camera.deviceId === state.cameraId) ?
                    state.cameraId : (cameras[0] && cameras[0].deviceId) || ''
            }));
        } catch (error) {
            if (!this.unmounting) this.setState({error: cameraErrorKey(error, 'camera.error.devices')});
        }
    }

    async prepareModel () {
        this.setState({modelLoading: true, modelProgress: {}});
        if (!this.vision) {
            this.vision = new IndependentVision({onProgress: ({kind, stage}) => {
                if (this.unmounting) return;
                this.setState({modelProgress: {kind, stage}});
            }});
        }
        try {
            const {enabled} = this.state;
            await this.vision.initialize({
                hands: enabled.left || enabled.right, pose: enabled.pose, face: enabled.face
            });
        } finally {
            if (!this.unmounting) this.setState({modelLoading: false, modelProgress: ''});
        }
    }

    async startCamera () {
        if (this.unmounting || this.state.running || this.state.loading) return;
        const session = ++this.session;
        let failureKey = 'camera.error.model';
        this.setState({error: '', loading: true});
        try {
            await Promise.resolve(this.pendingInference).catch(() => {});
            if (this.unmounting || session !== this.session) return;
            await this.prepareModel();
            if (this.unmounting || session !== this.session) return;
            failureKey = 'camera.error.open';
            const videoConstraints = {
                width: {ideal: 640},
                height: {ideal: 480},
                frameRate: {ideal: 30}
            };
            if (this.state.cameraId) videoConstraints.deviceId = {exact: this.state.cameraId};
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: videoConstraints
            });
            if (this.unmounting || session !== this.session) {
                stream.getTracks().forEach(track => track.stop());
                return;
            }
            this.stream = stream;
            stream.getVideoTracks().forEach(track => {
                track.onended = () => {
                    if (this.unmounting || session !== this.session) return;
                    this.stopCamera();
                    this.setState({error: 'camera.error.disconnected'});
                    this.loadCameras();
                };
            });
            this.video.srcObject = stream;
            await this.video.play();
            if (this.unmounting || session !== this.session) return;
            this.metricStartedAt = performance.now();
            this.metricFrames = 0;
            this.captureFrames = 0;
            this.lastCapturedTime = null;
            this.metricInferenceMs = 0;
            this.handStabilizer.reset();
            this.lastProcessAt = null;
            this.setState({loading: false,
                running: true,
                stats: {fps: 0, cameraFps: 0, inferenceMs: 0, load: 0, frames: 0}});
            await this.loadCameras();
            if (session === this.session) {
                this.lastConnectAttempt = null;
                this.scheduleFrame();
                this.updateAutomaticSending(performance.now());
            }
        } catch (error) {
            if (this.unmounting || session !== this.session) return;
            this.stopCamera();
            this.setState({
                error: cameraErrorKey(error, failureKey),
                loading: false,
                running: false
            });
        }
    }

    stopCamera () {
        this.stopSending();
        this.session++;
        if (this.video && this.video.cancelVideoFrameCallback && this.videoFrameCallback !== null) {
            this.video.cancelVideoFrameCallback(this.videoFrameCallback);
        }
        this.videoFrameCallback = null;
        cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
        if (this.stream) this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
        this.handStabilizer.reset();
        if (this.video) this.video.srcObject = null;
        if (this.canvas) this.canvas.getContext('2d').clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (!this.unmounting) this.setState({result: EMPTY_RESULT, running: false, loading: false});
    }

    scheduleFrame () {
        if (this.unmounting || !this.stream) return;
        if (this.props.visible !== false && this.video.requestVideoFrameCallback) {
            this.videoFrameCallback = this.video.requestVideoFrameCallback(timestamp => {
                this.scheduleFrame();
                this.captureFrames++;
                this.processFrame(timestamp);
            });
            return;
        }
        this.animationFrame = requestAnimationFrame(timestamp => {
            this.scheduleFrame();
            if (this.video && this.video.currentTime !== this.lastCapturedTime) {
                this.lastCapturedTime = this.video.currentTime;
                this.captureFrames++;
                this.processFrame(timestamp);
            }
        });
    }

    stopSending () {
        this.sendGeneration = (this.sendGeneration || 0) + 1;
        const token = this.sendToken;
        this.sendToken = null;
        if (token) ipcRenderer.invoke('est-vision-camera-stop', token).catch(() => {});
        if (!this.unmounting) this.setState({sending: false, sendPending: false, publisher: ''});
    }

    setPublisher (publisher) {
        if (!this.unmounting && this.state.publisher !== publisher) this.setState({publisher});
    }

    async updateAutomaticSending (now) {
        if (this.unmounting || !this.state.running || this.sendToken || this.connecting) return;
        const targets = Object.keys(this.state.enabled).filter(kind => this.state.enabled[kind]);
        if (this.lastConnectAttempt !== null && now - this.lastConnectAttempt < 1000) return;
        this.lastConnectAttempt = now;
        this.connecting = true;
        const session = this.session;
        try {
            const state = await ipcRenderer.invoke('est-vision-camera-state');
            if (this.unmounting || !this.stream || session !== this.session) return;
            if (!state.connected) this.setPublisher('camera.status.disconnected');
            else if (!state.supported) this.setPublisher('camera.status.unsupported');
            else if (targets.length > 1 && !state.multiSupported) {
                this.setPublisher('camera.status.multi');
            } else if (state.paused) this.setPublisher('camera.status.paused');
            else await this.startSending(targets);
        } catch (error) {
            if (!this.unmounting && session === this.session) this.setPublisher(cameraErrorKey(error));
        } finally {
            this.connecting = false;
        }
    }

    async startSending (targets = Object.keys(this.state.enabled).filter(kind => this.state.enabled[kind])) {
        const generation = this.sendGeneration = (this.sendGeneration || 0) + 1;
        this.setState({sendPending: true});
        try {
            const token = await ipcRenderer.invoke('est-vision-camera-start', {targets});
            if (this.unmounting || generation !== this.sendGeneration || !this.stream) {
                await ipcRenderer.invoke('est-vision-camera-stop', token);
                return;
            }
            this.sendToken = token;
            this.lastSendAt = 0;
            this.setState({sending: true, sendPending: false});
        } catch (error) {
            if (!this.unmounting && generation === this.sendGeneration) {
                this.setState({sendPending: false, publisher: cameraErrorKey(error)});
            }
        }
    }

    async publishVision (result, landmarks, now) {
        if (!this.sendToken || this.sendBusy || now - this.lastSendAt < 100) return;
        const token = this.sendToken;
        const sample = mapVisualFrame(
            result,
            landmarks,
            this.state.enabled,
            this.inferenceStartedAt,
            now
        );
        const validTargetCount = Object.values(sample.targets).filter(Boolean).length;
        this.lastSendAt = now;
        this.sendBusy = true;
        try {
            const status = await ipcRenderer.invoke('est-vision-camera-frame', token, sample);
            if (!this.unmounting && token === this.sendToken) {
                this.setPublisher(status.lastError ? cameraErrorKey(status.lastError) :
                    status.paused ? 'camera.status.paused' :
                        status.programRunning ?
                            (validTargetCount ? 'camera.status.sending' : 'camera.status.empty') :
                            'camera.status.waiting');
            }
        } catch (error) {
            if (!this.unmounting && token === this.sendToken) {
                this.stopSending();
                this.setPublisher(cameraErrorKey(error));
            }
        } finally {
            this.sendBusy = false;
        }
    }

    async processFrame (timestamp) {
        const session = this.session;
        if (!this.stream || !this.video || !this.state.running) return;
        if (!this.processing && this.video.readyState >= 2 &&
            (this.video.requestVideoFrameCallback || !this.lastProcessAt ||
                timestamp - this.lastProcessAt >= PROCESS_INTERVAL_MS - 0.5)) {
            this.processing = true;
            this.lastProcessAt = timestamp;
            this.inferenceStartedAt = performance.now();
            this.inferenceSession = session;
            try {
                // Freeze one camera frame so all three models inspect the same pixels.
                if (!this.inputImage) this.inputImage = document.createElement('canvas');
                if (this.inputImage.width !== this.video.videoWidth ||
                    this.inputImage.height !== this.video.videoHeight) {
                    this.inputImage.width = this.video.videoWidth;
                    this.inputImage.height = this.video.videoHeight;
                }
                this.inputImage.getContext('2d').drawImage(this.video, 0, 0);
                const {enabled} = this.state;
                this.pendingInference = this.vision.process(this.inputImage, {
                    hands: enabled.left || enabled.right, pose: enabled.pose, face: enabled.face
                });
                const results = await this.pendingInference;
                if (results && session === this.session) this.handleResults(results);
            } catch (error) {
                if (!this.unmounting && session === this.session) {
                    this.stopCamera();
                    this.setState({error: cameraErrorKey(error, 'camera.error.inference')});
                }
            } finally {
                this.processing = false;
            }
        }
    }

    handleResults (results) {
        if (this.unmounting || !this.stream || !this.video || !this.canvas ||
            this.inferenceSession !== this.session) return;
        const width = this.video.videoWidth || 640;
        const height = this.video.videoHeight || 480;
        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
        }
        const context = this.canvas.getContext('2d');
        const {enabled} = this.state;
        const summary = summarizeIndependentResults({...results,
            pose: enabled.pose ? results.pose : {},
            face: enabled.face ? results.face : {}});
        for (const side of ['left', 'right']) {
            if (!enabled[side]) summary.hands[side] = {label: '未检测', detected: false, landmarks: null};
        }
        const {connections} = this.vision;
        const poseLandmarks = enabled.pose ? results.pose.poseLandmarks : null;
        const faceLandmarks = enabled.face ? (results.face.multiFaceLandmarks || [])[0] : null;
        context.clearRect(0, 0, width, height);
        context.save();
        context.translate(width, 0);
        context.scale(-1, 1);
        if (this.props.visible !== false) {
            drawConnections(context, poseLandmarks, connections.pose, '#38d890', 3);
            drawLandmarks(context, poseLandmarks, '#ffffff', 2.2);
            drawConnections(context, summary.hands.left.landmarks, connections.hands, '#ffd258', 3);
            drawConnections(context, summary.hands.right.landmarks, connections.hands, '#ff8a72', 3);
            drawLandmarks(context, summary.hands.left.landmarks, '#fff4c7', 2.4);
            drawLandmarks(context, summary.hands.right.landmarks, '#ffe0da', 2.4);
            drawConnections(context, faceLandmarks, connections.face, '#62c7ff', 1.5);
        }
        context.restore();

        this.metricFrames++;
        const now = performance.now();
        const inferenceMs = now - this.inferenceStartedAt;
        this.metricInferenceMs += inferenceMs;
        this.latestResult = Object.assign({}, summary, {hands: this.handStabilizer.push(summary.hands)});
        this.publishVision(this.latestResult, {face: faceLandmarks, pose: poseLandmarks}, now);
        this.updateAutomaticSending(now);
        const disappeared = ['left', 'right'].some(side => (
            this.state.result.hands[side].detected && !summary.hands[side].detected
        ));
        const elapsed = now - this.metricStartedAt;
        if (elapsed >= 500) {
            this.setState({
                result: this.latestResult,
                stats: {
                    fps: Math.round((this.metricFrames * 10000) / elapsed) / 10,
                    cameraFps: Math.round((this.captureFrames * 10000) / elapsed) / 10,
                    inferenceMs: Math.round((this.metricInferenceMs / this.metricFrames) * 10) / 10,
                    load: Math.min(100, Math.round((this.metricInferenceMs / elapsed) * 100)),
                    frames: this.state.stats.frames + this.metricFrames
                }
            });
            this.metricFrames = 0;
            this.captureFrames = 0;
            this.metricInferenceMs = 0;
            this.metricStartedAt = now;
        } else if (disappeared) {
            this.setState({result: this.latestResult});
        }
    }

    renderResult (label, value, confidence) {
        return (
            <div className={styles.resultRow}>
                <span>{label}</span>
                <strong>{value}</strong>
                {confidence ? <small>{Math.round(confidence * 100)}%</small> : null}
            </div>
        );
    }

    render () {
        const {result, stats, enabled, locale} = this.state;
        const t = (key, values) => getEstText(key, locale, values);
        const progress = cameraProgressText(this.state.modelProgress, locale);
        const resultText = label => cameraResultText(label, locale);
        return (
            <section
                className={styles.lab}
                ref={node => {
                    this.panel = node;
                }}
                style={this.props.visible === false ? {display: 'none'} : null}
                aria-label={t('camera.panel')}
                onKeyDown={event => {
                    event.stopPropagation();
                    if (event.key === 'Escape') {
                        event.preventDefault();
                        this.handleClose();
                    }
                }}
            >
                <header className={styles.header}>
                    <h1>{t('camera.title')}</h1>
                    <button
                        className={styles.closeButton}
                        type="button"
                        onClick={this.handleClose}
                        title={t('camera.close')}
                        aria-label={t('camera.close')}
                    >×</button>
                </header>
                <div className={styles.body}>
                    <div className={styles.toolbar}>
                        <select
                            id="est-vision-camera"
                            aria-label={t('camera.device')}
                            disabled={this.state.running || this.state.loading}
                            value={this.state.cameraId}
                            onChange={event => this.setState({cameraId: event.target.value})}
                        >
                            {this.state.cameras.length ? this.state.cameras.map((camera, index) => (
                                <option
                                    key={camera.deviceId}
                                    value={camera.deviceId}
                                >
                                    {camera.label || t('camera.number', {number: index + 1})}
                                </option>
                            )) : <option value="">{t('camera.default')}</option>}
                        </select>
                        <button
                            className={this.state.running ? styles.stopButton : styles.startButton}
                            type="button"
                            disabled={this.state.loading || !Object.values(enabled).some(Boolean)}
                            onClick={() => (this.state.running ? this.stopCamera() : this.startCamera())}
                        >
                            {t(this.state.loading ? (this.state.modelLoading ? 'camera.loading' : 'camera.starting') :
                                (this.state.running ? 'camera.stop' : 'camera.start'))}
                        </button>
                    </div>
                    {this.state.loading && <div
                        className={styles.loadingStatus}
                        role="status"
                        aria-live="polite"
                    >
                        <span
                            className={styles.spinner}
                            aria-hidden="true"
                        />
                        <div><strong>{progress}</strong>
                            <span>{t('camera.wait')}</span></div>
                    </div>}
                    <div className={styles.workspace}>
                        <div className={styles.preview}>
                            <video
                                muted
                                playsInline
                                ref={node => {
                                    this.video = node;
                                }}
                            />
                            <canvas
                                ref={node => {
                                    this.canvas = node;
                                }}
                            />
                            {this.state.running ? null : (
                                <div className={styles.cameraIdle}>
                                    {this.state.loading ? progress : t('camera.idle')}
                                </div>
                            )}
                        </div>
                        <div className={styles.recognition}>
                            {['left', 'right', 'pose', 'face'].map(kind => (
                                <label
                                    className={styles.recognitionToggle}
                                    key={kind}
                                >
                                    <span>{t(`vision.${kind}`)}</span>
                                    <input
                                        type="checkbox"
                                        role="switch"
                                        data-target={kind}
                                        aria-label={t('camera.recognize', {target: t(`vision.${kind}`)})}
                                        checked={enabled[kind]}
                                        disabled={this.state.loading || this.state.running}
                                        onChange={event => this.toggleRecognition(kind, event.target.checked)}
                                    />
                                </label>
                            ))}
                        </div>
                    </div>
                    <aside className={styles.results}>
                        <h2>{t('camera.data')}</h2>
                        <div className={styles.resultGrid}>
                            {this.renderResult(t('vision.left'),
                                enabled.left ? resultText(result.hands.left.label) : t('camera.off'))}
                            {this.renderResult(t('vision.right'),
                                enabled.right ? resultText(result.hands.right.label) : t('camera.off'))}
                            {this.renderResult(t('vision.pose'),
                                enabled.pose ? resultText(result.pose.label) : t('camera.off'))}
                            {this.renderResult(t('vision.face'),
                                enabled.face ?
                                    result.face.map(resultText).join(t('camera.separator')) : t('camera.off'))}
                        </div>
                        <div className={styles.metrics}>
                            <span><b>{stats.fps}</b> {t('camera.fps')}</span>
                            <span><b>{stats.cameraFps}</b> {t('camera.captureFps')}</span>
                            <span><b>{stats.inferenceMs}</b> {t('camera.latency')}</span>
                        </div>
                    </aside>
                    {this.state.publisher && <p
                        className={styles.publisher}
                        role="status"
                    >{t(this.state.publisher)}</p>}
                    {this.state.error ? (
                        <div
                            className={styles.error}
                            role="alert"
                        >{t(this.state.error)}</div>
                    ) : null}
                </div>
            </section>
        );
    }
}

EstVisionLab.propTypes = {onClose: PropTypes.func.isRequired,
    visible: PropTypes.bool,
    onActivityChange: PropTypes.func};

export default EstVisionLab;
