/* eslint-disable react/jsx-no-bind */
import {dialog} from '@electron/remote';
import {ipcRenderer} from 'electron';
import PropTypes from 'prop-types';
import React from 'react';
import {createPortal} from 'react-dom';
import EstAiMascot from './EstAiMascot.jsx';
import {
    EST_AI_PROVIDERS, defaultEstAiConfig, isLocalEstAiUrl, sameEstAiEndpoint
} from '../common/est-ai-config';

import {compileEstBlockIrToXml} from './est-ai/est-block-compiler';
import {requestEstAiBlockImport} from './est-ai/est-ai-workspace';
import {createEstProgramStackPreviews} from './est-ai/est-program-preview';
import {generateEstAiReply, SAMPLE_IR} from './est-ai/est-ai-chat';
import {createEstAiHardwareContext} from './est-ai/est-ai-hardware-context';
import {
    EST_AI_OPEN_REQUEST_EVENT,
    dispatchEstAiMenuState
} from './est-ai/est-ai-menu-events';
import {EST_LOCALE_CHANGED_EVENT, getCurrentEstLocale} from './est-i18n';
import styles from './EstAiPanel.css';

const COPY = {
    'zh-cn': {
        title: 'AI 编程助手',
        settings: 'API 设置',
        newChat: '新建对话',
        close: '关闭',
        send: '发送',
        cancel: '取消',
        continue: '继续',
        stop: '停止生成',
        placeholder: '我们可以在这里交流',
        welcome: '把你的想法，变成积木。',
        intro: '描述你想让机器人做什么。我们一起完善程序，先预览，再放入工作区。',
        suggestion: '前进一圈，等待一秒，然后停止',
        suggestionPrompt: '使用 B、C 端口的驱动电机，前进一圈，等待一秒，然后停止。',
        thinking: '正在构思程序',
        replying: '正在整理回复',
        previewing: '正在绘制积木',
        card: '生成的积木堆',
        stack: n => `程序堆 ${n}`,
        replace: '替换工作区',
        insert: '插入',
        applied: '已应用到工作区',
        previewFailed: '积木预览未能绘制，请重新生成后再应用。',
        retry: '重试',
        checkSettings: '检查连接设置',
        replaceConfirm: '用这份程序替换当前工作区？可以通过撤销恢复。',
        warnings: '程序有以下提醒',
        apiTitle: '连接你的 AI',
        apiSubtitle: 'API 地址与模型决定实际服务；快捷预设只帮你填写，不限制服务商。',
        provider: '快捷预设（可选）',
        customProvider: '手动配置',
        noPreset: '不使用预设',
        localProvider: 'Ollama · 本机',
        baseUrl: 'API 地址',
        model: '模型 ID',
        modelPlaceholder: '填写服务商提供的模型名称',
        apiHint: '支持 OpenAI Chat Completions 格式；可填写基础地址或完整接口地址。',
        jsonMode: '启用 JSON 模式',
        jsonHint: '仅在服务商和模型支持时开启',
        keyChanged: 'API 地址已更换，请输入对应密钥。旧密钥不会发往新地址。',
        localKey: '本机服务可留空',
        apiLabel: 'API 密钥',
        apiPlaceholder: '在这里输入你的 API 密钥',
        apiSaved: '已保存密钥，输入新密钥可更换',
        apiNote: '配置与密钥加密保存在本机。对话仅发送到你填写的 API 地址，请确认该地址可信。',
        confirm: '确定',
        saving: '正在保存…',
        configured: '已配置',
        unconfigured: '连接 AI 服务',
        developer: '开发调试',
        debugPreview: '预览本地程序',
        debugSample: '载入示例',
        localPreview: '这是一份本地程序预览。',
        requestError: '请求失败，请稍后重试。'
    },
    'en': {
        title: 'AI Coding Assistant',
        settings: 'API settings',
        newChat: 'New conversation',
        close: 'Close',
        send: 'Send',
        cancel: 'Cancel',
        continue: 'Continue',
        stop: 'Stop generating',
        placeholder: 'Let’s build something together',
        welcome: 'Turn your ideas into blocks.',
        intro: 'Describe what your robot should do. Refine the program together, ' +
            'preview it, then add it to your workspace.',
        suggestion: 'Move one rotation, wait a second, then stop',
        suggestionPrompt: 'Using drive motors on ports B and C, move forward one rotation, wait one second, then stop.',
        thinking: 'Thinking through your program',
        replying: 'Preparing your reply',
        previewing: 'Drawing your blocks',
        card: 'Generated blocks',
        stack: n => `Stack ${n}`,
        replace: 'Replace workspace',
        insert: 'Insert',
        applied: 'Applied to workspace',
        previewFailed: 'The block preview could not be rendered. Generate it again before applying.',
        retry: 'Retry',
        checkSettings: 'Check connection settings',
        replaceConfirm: 'Replace the current workspace with this program? You can undo this change.',
        warnings: 'Program notes',
        apiTitle: 'Connect your AI',
        apiSubtitle: 'The API URL and model choose the service. Presets only fill fields and never lock a provider.',
        provider: 'Quick preset (optional)',
        customProvider: 'Manual setup',
        noPreset: 'No preset',
        localProvider: 'Ollama · Local',
        baseUrl: 'API URL',
        model: 'Model ID',
        modelPlaceholder: 'Enter the model ID from your provider',
        apiHint: 'OpenAI Chat Completions format. Accepts a base URL or the full endpoint.',
        jsonMode: 'Enable JSON mode',
        jsonHint: 'Only enable when supported by your model',
        keyChanged: 'The API URL changed. Enter its key; your old key will not be sent to the new endpoint.',
        localKey: 'Optional for a local service',
        apiLabel: 'API key',
        apiPlaceholder: 'Enter your API key here',
        apiSaved: 'Key saved. Enter a new key to replace it.',
        apiNote: 'Settings and keys are encrypted on this device. ' +
            'Chats go only to your API URL; use a trusted endpoint.',
        confirm: 'Confirm',
        saving: 'Saving…',
        configured: 'Configured',
        unconfigured: 'Connect AI service',
        developer: 'Developer tools',
        debugPreview: 'Preview local program',
        debugSample: 'Load example',
        localPreview: 'Here is a local program preview.',
        requestError: 'Request failed. Please try again.'
    }
};

const ICONS = {
    menu: 'M5 7h14M5 12h14M5 17h14',
    newChat: 'M10 5H5v14h14v-5M14 4l6 6M10 14l-1 1 1-5 8-8 4 4-8 8z',
    close: 'M6 6l12 12M18 6L6 18',
    send: 'M12 20V4M6 10l6-6 6 6',
    stop: 'M7 7h10v10H7z',
    spark: 'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z',
    check: 'M5 12l4 4L19 6',
    key: 'M14 7a4 4 0 1 1-1 7l-6 6H3v-4l6-6a4 4 0 0 1 5-3z'
};

const Icon = ({name}) => (
    <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d={ICONS[name]} />
    </svg>
);
Icon.propTypes = {name: PropTypes.string.isRequired};

class EstAiPanel extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            isOpen: false,
            locale: getCurrentEstLocale(),
            messages: [],
            input: '',
            busy: false,
            phase: 'thinking',
            mascotState: 'idle',
            configured: false,
            savedConfig: defaultEstAiConfig(),
            draftConfig: defaultEstAiConfig(),
            hasSavedKey: false,
            settingsOpen: false,
            apiKey: '',
            keyError: '',
            savingKey: false,
            debugSource: JSON.stringify(SAMPLE_IR, null, 2),
            debugError: '',
            position: null
        };
        this.requestId = null;
        this.sequence = 0;
        this.epoch = 0;
        this.mounted = false;
        this.composer = React.createRef();
        this.history = React.createRef();
        this.panel = React.createRef();
        this.settings = React.createRef();
        this.apiInput = React.createRef();
        [
            'handleLocaleChanged', 'handleOpen', 'handleClose', 'handleSettings', 'handleSettingsClose',
            'handleSaveKey', 'handleSend', 'handleCancel', 'handleNewChat', 'handleKeyDown',
            'handleInputKeyDown', 'handleDragStart', 'handleDragMove', 'handleDragEnd',
            'handleResize', 'handleLocalPreview', 'handleProviderChange'
        ].forEach(name => {
            this[name] = this[name].bind(this);
        });
    }

    componentDidMount () {
        this.mounted = true;
        window.addEventListener(EST_LOCALE_CHANGED_EVENT, this.handleLocaleChanged);
        window.addEventListener(EST_AI_OPEN_REQUEST_EVENT, this.handleOpen);
        window.addEventListener('resize', this.handleResize);
        dispatchEstAiMenuState({visible: this.props.visible, open: this.state.isOpen});
        ipcRenderer.invoke('est-ai-status').then(result => {
            if (!this.mounted) return;
            if (result.ok) {
                this.setState({
                    configured: result.data.configured,
                    savedConfig: result.data.config || defaultEstAiConfig(),
                    hasSavedKey: Boolean(result.data.hasKey)
                });
            } else this.setState({keyError: result.error});
        })
            .catch(() => {});
    }

    componentDidUpdate (previousProps, previousState) {
        if (this.history.current && (
            previousState.messages !== this.state.messages ||
            previousState.busy !== this.state.busy ||
            previousState.phase !== this.state.phase ||
            previousState.isOpen !== this.state.isOpen
        )) {
            this.history.current.scrollTop = this.history.current.scrollHeight;
        }
        if (this.composer.current && previousState.input !== this.state.input) {
            this.composer.current.style.height = 'auto';
            this.composer.current.style.height = `${Math.min(this.composer.current.scrollHeight, 112)}px`;
        }
        if (previousProps.visible && !this.props.visible) this.handleDragEnd();
        if ((!previousProps.visible && this.props.visible) ||
            (!previousState.isOpen && this.state.isOpen)) this.handleResize();
        if (previousProps.visible !== this.props.visible || previousState.isOpen !== this.state.isOpen) {
            dispatchEstAiMenuState({visible: this.props.visible, open: this.state.isOpen});
        }
    }

    componentWillUnmount () {
        this.mounted = false;
        clearTimeout(this.mascotTimer);
        this.handleCancel();
        this.handleDragEnd();
        window.removeEventListener(EST_LOCALE_CHANGED_EVENT, this.handleLocaleChanged);
        window.removeEventListener(EST_AI_OPEN_REQUEST_EVENT, this.handleOpen);
        window.removeEventListener('resize', this.handleResize);
        dispatchEstAiMenuState({visible: false, open: false});
    }

    getCopy () {
        return COPY[this.state.locale] || COPY.en;
    }

    setMascotState (mascotState) {
        clearTimeout(this.mascotTimer);
        this.mascotTimer = null;
        if (!this.mounted) return;
        this.setState({mascotState});
        const duration = {success: 1350, error: 1500}[mascotState];
        if (duration) {
            this.mascotTimer = setTimeout(() => {
                this.mascotTimer = null;
                if (this.mounted) this.setState({mascotState: 'idle'});
            }, duration);
        }
    }

    focusComposer () {
        if (this.composer.current) this.composer.current.focus();
    }

    handleLocaleChanged () {
        this.setState({locale: getCurrentEstLocale()});
    }

    handleOpen () {
        if (!this.props.visible) return;
        this.setState({isOpen: true}, () => this.focusComposer());
    }

    handleClose () {
        this.handleDragEnd();
        this.setState({isOpen: false, settingsOpen: false, apiKey: ''});
    }

    handleSettings () {
        this.handleDragEnd();
        this.setState({
            settingsOpen: true, apiKey: '', draftConfig: {...this.state.savedConfig}
        }, () => {
            if (this.apiInput.current) this.apiInput.current.focus();
        });
    }

    handleProviderChange (event) {
        const preset = EST_AI_PROVIDERS.find(provider => provider.id === event.target.value);
        if (!preset) {
            this.setState({draftConfig: {...this.state.draftConfig, provider: ''}, keyError: ''});
            return;
        }
        this.setState({
            draftConfig: {
                provider: preset.id, baseUrl: preset.baseUrl, model: preset.model, jsonMode: preset.jsonMode
            },
            apiKey: '',
            keyError: ''
        });
    }

    handleSettingsClose () {
        if (this.state.savingKey) return;
        this.setState({settingsOpen: false, apiKey: '', keyError: ''}, () => this.focusComposer());
    }

    handleCancel () {
        const id = this.requestId;
        this.requestId = null;
        this.epoch++;
        this.setMascotState('idle');
        if (id) ipcRenderer.invoke('est-ai-cancel', id).catch(() => {});
        if (this.mounted) this.setState({busy: false});
    }

    handleNewChat () {
        this.handleCancel();
        this.setState({messages: [], input: ''}, () => this.focusComposer());
    }

    handleDragStart (event) {
        if (event.button !== 0 || event.target.closest('button') || this.state.settingsOpen) return;
        const rect = this.panel.current.getBoundingClientRect();
        this.drag = {x: event.clientX - rect.left, y: event.clientY - rect.top};
        document.addEventListener('pointermove', this.handleDragMove);
        document.addEventListener('pointerup', this.handleDragEnd);
        document.addEventListener('pointercancel', this.handleDragEnd);
        event.preventDefault();
    }

    clampPosition (left, top) {
        const rect = this.panel.current.getBoundingClientRect();
        const menuBar = document.querySelector('[class*="menu-bar_menu-bar_"]');
        const minimumTop = menuBar ? Math.max(8, menuBar.getBoundingClientRect().bottom + 8) : 8;
        const maximumTop = Math.max(minimumTop, window.innerHeight - rect.height - 8);
        return {
            left: Math.max(8, Math.min(left, window.innerWidth - rect.width - 8)),
            top: Math.max(minimumTop, Math.min(top, maximumTop))
        };
    }

    handleDragMove (event) {
        if (!this.drag || !this.panel.current) return;
        this.setState({position: this.clampPosition(event.clientX - this.drag.x, event.clientY - this.drag.y)});
    }

    handleDragEnd () {
        this.drag = null;
        document.removeEventListener('pointermove', this.handleDragMove);
        document.removeEventListener('pointerup', this.handleDragEnd);
        document.removeEventListener('pointercancel', this.handleDragEnd);
    }

    handleResize () {
        if (this.state.position && this.panel.current) {
            this.setState({position: this.clampPosition(this.state.position.left, this.state.position.top)});
        }
    }

    handleKeyDown (event) {
        // Keep typing, Enter and Backspace away from the underlying Blockly workspace.
        event.stopPropagation();
        if (event.key === 'Escape') {
            event.preventDefault();
            if (this.state.settingsOpen) this.handleSettingsClose();
            else this.handleClose();
        }
        if (event.key === 'Tab' && this.state.settingsOpen && this.settings.current) {
            const candidates = Array.from(this.settings.current.querySelectorAll(
                'button:not([disabled]), input:not([disabled]), select:not([disabled]), summary, textarea'
            )).filter(element => element.getClientRects().length > 0);
            const first = candidates[0];
            const last = candidates[candidates.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
    }

    handleInputKeyDown (event) {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
            event.preventDefault();
            this.handleSend();
        }
    }

    async handleSaveKey (event) {
        event.preventDefault();
        if (this.state.savingKey || this.state.busy) return;
        this.setState({savingKey: true, keyError: ''});
        try {
            const result = await ipcRenderer.invoke('est-ai-save-config', {
                ...this.state.draftConfig, apiKey: this.state.apiKey
            });
            if (!result.ok) throw new Error(result.error);
            if (this.mounted) {
                this.setState({
                    configured: result.data.configured,
                    savingKey: false,
                    apiKey: '',
                    settingsOpen: false,
                    savedConfig: result.data.config,
                    hasSavedKey: result.data.hasKey,
                    keyError: ''
                }, () => this.focusComposer());
            }
        } catch (error) {
            if (this.mounted) {
                this.setState({
                    savingKey: false, keyError: error.message || this.getCopy().requestError
                });
            }
        }
    }

    async handleSend () {
        const text = this.state.input.trim();
        if (!text || this.state.busy || this.requestId) return;
        if (!this.state.configured) {
            this.handleSettings();
            return;
        }
        const id = `chat-${Date.now()}-${++this.sequence}`;
        this.requestId = id;
        const messages = this.state.messages.concat({id: `${id}-user`, role: 'user', text});
        this.setMascotState('thinking');
        this.setState({messages, input: '', busy: true, phase: 'thinking'});
        try {
            let hardwareContext = null;
            try {
                const connection = await ipcRenderer.invoke('est-auto-connect', {includePortInfo: true});
                hardwareContext = createEstAiHardwareContext(connection);
            } catch (error) {
                // AI chat remains available when no EST USB device can be inspected.
            }
            const reply = await generateEstAiReply({
                id,
                messages,
                locale: this.state.locale,
                hardwareContext,
                invoke: (channel, payload) => ipcRenderer.invoke(channel, payload),
                onPhase: phase => {
                    if (!this.mounted || this.requestId !== id) return;
                    this.setMascotState(phase);
                    this.setState({phase});
                },
                isCurrent: () => this.mounted && this.requestId === id
            });
            if (!this.mounted || this.requestId !== id) return;
            const message = {id, role: 'assistant', text: reply.message, ir: reply.ir};
            if (reply.compiled) {
                this.setMascotState('replying');
                this.setState({phase: 'previewing'});
                message.warnings = reply.compiled.warnings;
                try {
                    message.previews = await createEstProgramStackPreviews(reply.compiled.xml);
                    if (!message.previews || !message.previews.length) throw new Error('Empty block preview');
                } catch (error) {
                    message.previewError = true;
                }
            }
            if (!this.mounted || this.requestId !== id) return;
            this.requestId = null;
            this.setState(state => ({messages: state.messages.concat(message), busy: false}));
            this.setMascotState(message.previewError ? 'error' : (reply.compiled ? 'success' : 'idle'));
        } catch (error) {
            if (!this.mounted || this.requestId !== id) return;
            this.requestId = null;
            this.setState(state => ({
                messages: state.messages.concat({
                    id,
                    role: 'assistant',
                    text: error.message || this.getCopy().requestError,
                    error: true,
                    retryText: text,
                    settingsAction: /^(HTTP_(400|401|403|404|503)|REQUEST_TIMEOUT)$/.test(error.code || '')
                }),
                busy: false
            }));
            this.setMascotState('error');
        }
    }

    async handleLocalPreview () {
        if (this.state.busy) return;
        const id = `local-${++this.sequence}`;
        this.requestId = id;
        this.setMascotState('replying');
        this.setState({busy: true, phase: 'previewing', debugError: ''});
        try {
            const compiled = compileEstBlockIrToXml(JSON.parse(this.state.debugSource));
            const previews = await createEstProgramStackPreviews(compiled.xml);
            if (!previews || !previews.length) throw new Error(this.getCopy().previewFailed);
            if (!this.mounted || this.requestId !== id) return;
            this.requestId = null;
            this.setState(state => ({
                messages: state.messages.concat({
                    id,
                    role: 'assistant',
                    text: this.getCopy().localPreview,
                    ir: compiled.normalized,
                    warnings: compiled.warnings,
                    previews,
                    localOnly: true
                }),
                busy: false,
                settingsOpen: false,
                apiKey: ''
            }));
            this.setMascotState('success');
        } catch (error) {
            if (this.mounted && this.requestId === id) {
                this.requestId = null;
                this.setState({busy: false, debugError: error.message});
                this.setMascotState('error');
            }
        }
    }

    async handleApply (message, mode) {
        if (this.state.busy || !message.previews || !message.previews.length) return;
        const copy = this.getCopy();
        const confirm = detail => dialog.showMessageBoxSync({
            type: 'question',
            title: copy.title,
            message: detail,
            buttons: [copy.continue, copy.cancel],
            defaultId: 1,
            cancelId: 1
        }) === 0;
        if (message.warnings && message.warnings.length &&
            !confirm(`${copy.warnings}\n\n${message.warnings.map(item => item.message || item).join('\n')}`)) return;
        if (mode === 'replace' && !confirm(copy.replaceConfirm)) return;
        const epoch = this.epoch;
        this.setMascotState('replying');
        this.setState({busy: true, phase: 'previewing'});
        try {
            await requestEstAiBlockImport(message.ir, {mode});
            if (this.mounted && this.epoch === epoch) {
                this.setState(state => ({
                    messages: state.messages.map(item => (item.id === message.id ? {...item, applied: true} : item)),
                    busy: false
                }));
                this.setMascotState('success');
            }
        } catch (error) {
            if (this.mounted && this.epoch === epoch) {
                this.setState(state => ({
                    messages: state.messages.concat({
                        id: `error-${++this.sequence}`, role: 'assistant', text: error.message, error: true
                    }),
                    busy: false
                }));
                this.setMascotState('error');
            }
        }
    }

    renderMessage (message) {
        const copy = this.getCopy();
        return (
            <article
                key={message.id}
                className={message.role === 'user' ? styles.userMessage : styles.assistantMessage}
            >
                <p className={message.error ? styles.error : styles.messageText}>{message.text}</p>
                {message.retryText && <button
                    type="button"
                    className={styles.textButton}
                    disabled={this.state.busy}
                    onClick={() => this.setState({input: message.retryText}, () => this.focusComposer())}
                >
                    {copy.retry}
                </button>}
                {message.settingsAction && <button
                    type="button"
                    className={styles.textButton}
                    disabled={this.state.busy}
                    onClick={this.handleSettings}
                >
                    {copy.checkSettings}
                </button>}
                {message.previewError && <p className={styles.error}>{copy.previewFailed}</p>}
                {message.previews && message.previews.length > 0 && (
                    <div className={styles.programCard}>
                        <div className={styles.cardHeading}><span />{copy.card}</div>
                        <div className={styles.programImages}>
                            {message.previews.map((preview, index) => (
                                <figure key={index}>
                                    <img
                                        src={preview.image}
                                        alt={copy.stack(index + 1)}
                                    />
                                    {message.previews.length > 1 && <figcaption>{copy.stack(index + 1)}</figcaption>}
                                </figure>
                            ))}
                        </div>
                        <div className={styles.cardActions}>
                            <button
                                type="button"
                                className={styles.applyButton}
                                disabled={this.state.busy}
                                onClick={() => this.handleApply(message, 'replace')}
                            >{copy.replace}</button>
                            <button
                                type="button"
                                className={styles.textButton}
                                disabled={this.state.busy}
                                onClick={() => this.handleApply(message, 'insert')}
                            >{copy.insert}</button>
                        </div>
                        {message.applied && <div className={styles.applied}><Icon name="check" />{copy.applied}</div>}
                    </div>
                )}
            </article>
        );
    }

    renderSettings () {
        const copy = this.getCopy();
        const config = this.state.draftConfig;
        const reuseKey = this.state.hasSavedKey && sameEstAiEndpoint(config, this.state.savedConfig);
        const local = isLocalEstAiUrl(config.baseUrl);
        const canSave = config.baseUrl.trim() && config.model.trim() &&
            (this.state.apiKey.trim() || reuseKey || local);
        return (
            <div className={styles.settingsOverlay}>
                <form
                    ref={this.settings}
                    className={styles.settingsDialog}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="est-ai-settings-title"
                    onSubmit={this.handleSaveKey}
                >
                    <div className={styles.settingsTop}>
                        <span className={styles.keyBadge}><Icon name="key" /></span>
                        <button
                            type="button"
                            className={styles.iconButton}
                            title={copy.close}
                            aria-label={copy.close}
                            onClick={this.handleSettingsClose}
                            disabled={this.state.savingKey}
                        ><Icon name="close" /></button>
                    </div>
                    <h3 id="est-ai-settings-title">{copy.apiTitle}</h3>
                    <p className={styles.settingsSubtitle}>{copy.apiSubtitle}</p>
                    <div className={styles.settingsField}>
                        <label
                            className={styles.keyLabel}
                            htmlFor="est-ai-provider"
                        >{copy.provider}</label>
                        <select
                            id="est-ai-provider"
                            className={styles.keyInput}
                            value={config.provider}
                            disabled={this.state.savingKey}
                            onChange={this.handleProviderChange}
                        >
                            <option value="">{copy.noPreset}</option>
                            {EST_AI_PROVIDERS.map(provider => (
                                <option
                                    key={provider.id}
                                    value={provider.id}
                                >
                                    {provider.id === 'ollama' ? copy.localProvider : provider.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className={styles.settingsField}>
                        <label
                            className={styles.keyLabel}
                            htmlFor="est-ai-url"
                        >{copy.baseUrl}</label>
                        <input
                            id="est-ai-url"
                            className={styles.keyInput}
                            type="url"
                            maxLength={2048}
                            placeholder="https://api.example.com/v1"
                            value={config.baseUrl}
                            disabled={this.state.savingKey}
                            spellCheck={false}
                            onChange={event => this.setState({
                                draftConfig: {...config, provider: '', baseUrl: event.target.value}, apiKey: ''
                            })}
                        />
                        <p className={styles.fieldHint}>{copy.apiHint}</p>
                    </div>
                    <div className={styles.settingsField}>
                        <label
                            className={styles.keyLabel}
                            htmlFor="est-ai-model"
                        >{copy.model}</label>
                        <input
                            id="est-ai-model"
                            className={styles.keyInput}
                            maxLength={200}
                            placeholder={copy.modelPlaceholder}
                            value={config.model}
                            disabled={this.state.savingKey}
                            spellCheck={false}
                            onChange={event => this.setState({draftConfig: {...config, model: event.target.value}})}
                        />
                    </div>
                    <label
                        className={styles.keyLabel}
                        htmlFor="est-ai-key"
                    >{copy.apiLabel}</label>
                    <input
                        id="est-ai-key"
                        ref={this.apiInput}
                        className={styles.keyInput}
                        type="password"
                        autoComplete="off"
                        spellCheck={false}
                        maxLength={2048}
                        value={this.state.apiKey}
                        disabled={this.state.savingKey}
                        placeholder={reuseKey ? copy.apiSaved : (local ? copy.localKey : copy.apiPlaceholder)}
                        onChange={event => this.setState({apiKey: event.target.value})}
                    />
                    {this.state.hasSavedKey && !reuseKey &&
                        <p className={styles.endpointNotice}>{copy.keyChanged}</p>}
                    <label className={styles.jsonOption}>
                        <input
                            type="checkbox"
                            checked={config.jsonMode}
                            disabled={this.state.savingKey}
                            onChange={event => this.setState({
                                draftConfig: {...config, jsonMode: event.target.checked}
                            })}
                        />
                        <span>{copy.jsonMode}<small>{copy.jsonHint}</small></span>
                    </label>
                    <p className={styles.keyNote}>{copy.apiNote}</p>
                    {this.state.keyError && <p
                        role="alert"
                        className={styles.error}
                    >{this.state.keyError}</p>}
                    <button
                        type="submit"
                        className={styles.confirmButton}
                        disabled={this.state.savingKey || this.state.busy || !canSave}
                    >
                        {this.state.savingKey ? copy.saving : copy.confirm}
                    </button>
                    {process.env.NODE_ENV !== 'production' && (
                        <details className={styles.developerTools}>
                            <summary>{copy.developer}</summary>
                            <textarea
                                aria-label="Block IR"
                                value={this.state.debugSource}
                                onChange={event => this.setState({debugSource: event.target.value})}
                            />
                            {this.state.debugError && <p role="alert">{this.state.debugError}</p>}
                            <button
                                type="button"
                                disabled={this.state.busy}
                                onClick={this.handleLocalPreview}
                            >
                                {copy.debugPreview}
                            </button>
                            <button
                                type="button"
                                onClick={() => this.setState({debugSource: JSON.stringify(SAMPLE_IR, null, 2)})}
                            >
                                {copy.debugSample}
                            </button>
                        </details>
                    )}
                </form>
            </div>
        );
    }

    render () {
        if (!this.props.visible) return null;
        const copy = this.getCopy();
        const provider = EST_AI_PROVIDERS.find(item => item.id === this.state.savedConfig.provider);
        const connectionLabel = provider ? provider.label : copy.customProvider;
        if (!this.state.isOpen) return null;
        const position = this.state.position ? {...this.state.position, right: 'auto', bottom: 'auto'} : null;
        return createPortal(
            <section
                ref={this.panel}
                className={styles.panel}
                style={position}
                role="dialog"
                aria-label={copy.title}
                onKeyDown={this.handleKeyDown}
            >
                <header
                    className={styles.header}
                    // React 16 supports pointer events; the project's legacy lint schema does not.
                    onPointerDown={this.handleDragStart} // eslint-disable-line react/no-unknown-property
                >
                    <div className={styles.headerIdentity}>
                        <EstAiMascot
                            className={styles.headerMascot}
                            state={this.state.mascotState}
                            animated={this.props.visible && this.state.isOpen && !this.state.settingsOpen}
                        />
                        <h2>{copy.title}</h2>
                    </div>
                    <div className={styles.headerActions}>
                        <button
                            type="button"
                            className={styles.iconButton}
                            title={copy.settings}
                            aria-label={copy.settings}
                            onClick={this.handleSettings}
                        ><Icon name="menu" /></button>
                        <button
                            type="button"
                            className={styles.iconButton}
                            title={copy.newChat}
                            aria-label={copy.newChat}
                            onClick={this.handleNewChat}
                        ><Icon name="newChat" /></button>
                        <button
                            type="button"
                            className={styles.iconButton}
                            title={copy.close}
                            aria-label={copy.close}
                            onClick={this.handleClose}
                        ><Icon name="close" /></button>
                    </div>
                </header>
                <div
                    ref={this.history}
                    className={styles.conversation}
                    role="log"
                    aria-live="polite"
                    aria-relevant="additions text"
                    aria-busy={this.state.busy}
                >
                    {this.state.messages.length === 0 && (
                        <div className={styles.welcome}>
                            <span className={styles.welcomeIcon}><Icon name="spark" /></span>
                            <h3>{copy.welcome}</h3>
                            <p>{copy.intro}</p>
                            <button
                                type="button"
                                className={styles.suggestion}
                                onClick={() => this.setState(
                                    {input: copy.suggestionPrompt}, () => this.focusComposer()
                                )}
                            >
                                <span>{copy.suggestion}</span><Icon name="send" />
                            </button>
                        </div>
                    )}
                    {this.state.messages.map(message => this.renderMessage(message))}
                    {this.state.busy && <div className={styles.pending}>
                        <span className={styles.pendingDots}><i /><i /><i /></span>{copy[this.state.phase]}
                    </div>}
                </div>
                <div className={styles.composerArea}>
                    <div className={styles.composer}>
                        <textarea
                            ref={this.composer}
                            rows={1}
                            maxLength={4000}
                            value={this.state.input}
                            placeholder={copy.placeholder}
                            aria-label={copy.placeholder}
                            disabled={this.state.settingsOpen}
                            onChange={event => this.setState({input: event.target.value})}
                            onKeyDown={this.handleInputKeyDown}
                        />
                        <button
                            type="button"
                            className={styles.sendButton}
                            disabled={this.state.busy ? !this.requestId : !this.state.input.trim()}
                            title={this.state.busy ? copy.stop : copy.send}
                            aria-label={this.state.busy ? copy.stop : copy.send}
                            onClick={this.state.busy ? this.handleCancel : this.handleSend}
                        >
                            <Icon name={this.state.busy ? 'stop' : 'send'} />
                        </button>
                    </div>
                    <button
                        type="button"
                        className={styles.connectionStatus}
                        onClick={this.handleSettings}
                    >
                        <span className={this.state.configured ? styles.connected : ''} />
                        {this.state.configured ?
                            `${copy.configured} · ${connectionLabel} / ${this.state.savedConfig.model}` :
                            copy.unconfigured}
                    </button>
                </div>
                {this.state.settingsOpen && this.renderSettings()}
            </section>, document.body
        );
    }
}

EstAiPanel.propTypes = {visible: PropTypes.bool};
EstAiPanel.defaultProps = {visible: true};

export {EstAiPanel, SAMPLE_IR};
export default EstAiPanel;
