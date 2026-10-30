import cameraMessages from '../../common/est-camera-messages.json';

export class VisionWindowManager {
    constructor ({createWindow, stopSource}) {
        this.createWindow = createWindow;
        this.stopSource = stopSource;
        this.window = null;
        this.locale = 'zh-cn';
    }

    owns (sender) {
        return Boolean(this.window && !this.window.isDestroyed() && this.window.webContents === sender);
    }

    text (key) {
        return cameraMessages[this.locale][key];
    }

    setLocale (locale = this.locale) {
        const normalized = String(locale).toLowerCase()
            .replace(/_/g, '-');
        this.locale = Object.prototype.hasOwnProperty.call(cameraMessages, normalized) ? normalized : 'zh-cn';
        if (this.window && !this.window.isDestroyed()) {
            this.window.setTitle(`ATC CodeStudio - ${this.text('camera.title')}`);
            this.window.webContents.send('est-vision-locale', this.locale);
        }
    }

    open (locale = this.locale) {
        this.setLocale(locale);
        if (this.window && !this.window.isDestroyed()) {
            if (this.window.isMinimized()) this.window.restore();
            this.window.show();
            this.window.focus();
            return;
        }
        const window = this.createWindow({
            search: `route=vision&locale=${this.locale}`,
            title: `ATC CodeStudio - ${this.text('camera.title')}`,
            width: 500,
            height: 660,
            minWidth: 380,
            minHeight: 480,
            backgroundColor: '#f4f7fa',
            webPreferences: {nodeIntegration: true, contextIsolation: false, backgroundThrottling: false}
        });
        this.window = window;
        window.on('page-title-updated', event => event.preventDefault());
        const owner = window.webContents.id;
        const release = () => this.stopSource(owner);
        window.once('ready-to-show', () => {
            if (!window.isDestroyed()) window.show();
        });
        // Native close, renderer crash and reload all invalidate the publisher lease.
        window.on('close', release);
        window.webContents.on('render-process-gone', release);
        window.webContents.on('did-start-loading', release);
        window.once('closed', () => {
            release();
            if (this.window === window) this.window = null;
        });
    }

    close () {
        if (!this.window || this.window.isDestroyed()) return;
        this.stopSource(this.window.webContents.id);
        this.window.destroy();
    }
}
