import {app} from 'electron';
import {autoUpdater, CancellationToken} from 'electron-updater';
import log from 'electron-log';
import bytes from 'bytes';
import path from 'path';

import parseReleaseMessage from 'openblock-parse-release-message';
import {UPDATE_TARGET, UPDATE_MODAL_STATE} from 'openblock-gui/src/lib/update-state.js';

class OpenblockDesktopUpdater {
    constructor (webContents) {
        this._webContents = webContents;

        autoUpdater.autoDownload = false;

        const appPath = app.getAppPath();
        if (appPath.search(/main/g) !== -1) {
            autoUpdater.logger = log;
            autoUpdater.logger.transports.file.level = 'info';
            autoUpdater.updateConfigPath = path.join(appPath, '../win-unpacked/resources/app-update.yml');
        }

        this.updaterState = null;
        this.updateTarget = null;
        this.cancellationToken = null;
    }

    removeAllAutoUpdaterListeners () {
        autoUpdater.removeAllListeners('error');
        autoUpdater.removeAllListeners('update-available');
        autoUpdater.removeAllListeners('update-not-available');
    }

    reportUpdateState (state) {
        this._webContents.send('setUpdate', state);
    }

    applicationAvailable (info) {
        this.updateTarget = UPDATE_TARGET.application;

        this.reportUpdateState({
            phase: UPDATE_MODAL_STATE.applicationUpdateAvailable,
            info: {
                version: info.version,
                message: parseReleaseMessage(info.releaseNotes, {html: true})
            }
        });
    }

    checkUpdateAtStartup () {
        // Preserve the previous behavior for regions where automatic application
        // update checks were intentionally skipped. EST Studio no longer falls
        // back to the OpenBlock external-resource updater.
        if ((app.getLocaleCountryCode() === 'CN') || (process.platform === 'darwin')) {
            return;
        }

        autoUpdater.on('error', err => {
            this.removeAllAutoUpdaterListeners();
            console.warn(`Error while checking for application update: ${err}`);
        });
        autoUpdater.once('update-available', applicationUpdateInfo => {
            this.removeAllAutoUpdaterListeners();
            this.applicationAvailable(applicationUpdateInfo);
        });

        autoUpdater.once('update-not-available', () => {
            this.removeAllAutoUpdaterListeners();
            this.updaterState = null;
        });

        this.updaterState = UPDATE_MODAL_STATE.checkingApplication;
        autoUpdater.checkForUpdates();
    }

    reqeustUpdate () {
        if (this.updateTarget === UPDATE_TARGET.application) {
            this.cancellationToken = new CancellationToken();
            autoUpdater.downloadUpdate(this.cancellationToken);
            this.updaterState = UPDATE_MODAL_STATE.applicationDownloading;

            const PROGRESS_BASE_VALUE = 0;
            const PROGRESS_DOWNLOADING_PROGRESS_VALUE = 0.1;
            const PROGRESS_STEP_INTERVAL = 0.5; // 0.5s
            const PROGRESS_STEP_TIMEOUT = 20; // 20s
            const PROGRESS_STEP_VALUE = (PROGRESS_DOWNLOADING_PROGRESS_VALUE - PROGRESS_BASE_VALUE) /
                (PROGRESS_STEP_TIMEOUT / PROGRESS_STEP_INTERVAL);

            let downloadInProgress = false;

            const stepProgressBar = progress => {
                this.startDownloadTimeout = setTimeout(() => {
                    if (!downloadInProgress && progress <= PROGRESS_DOWNLOADING_PROGRESS_VALUE) {
                        this.reportUpdateState({
                            phase: UPDATE_MODAL_STATE.applicationDownloading,
                            info: {
                                progress: progress
                            }
                        });
                        stepProgressBar(progress + PROGRESS_STEP_VALUE);
                    } else {
                        this.startDownloadTimeout = null;
                    }
                }, PROGRESS_STEP_INTERVAL * 1000);
            };

            // After start downloading, it takes a while for download-progress event to trigger,
            // report a progress that grows slowly over time let user know the downloading is started and running.
            this.reportUpdateState({
                phase: UPDATE_MODAL_STATE.applicationDownloading,
                info: {
                    progress: PROGRESS_BASE_VALUE
                }
            });
            stepProgressBar(PROGRESS_BASE_VALUE);

            return new Promise((resolve, reject) => {

                autoUpdater.on('error', err => reject(err));

                autoUpdater.on('download-progress', progressObj => {
                    downloadInProgress = true;
                    this.reportUpdateState({
                        phase: UPDATE_MODAL_STATE.applicationDownloading,
                        info: {
                            progress: ((progressObj.percent * (1 - PROGRESS_DOWNLOADING_PROGRESS_VALUE)) +
                                (PROGRESS_DOWNLOADING_PROGRESS_VALUE * 100)) / 100,
                            state: {
                                speed: `${bytes(progressObj.bytesPerSecond)}/s`,
                                total: bytes(progressObj.total),
                                done: bytes(progressObj.transferred)
                            }
                        }
                    });
                });

                autoUpdater.on('update-downloaded', () => {
                    this.reportUpdateState({phase: UPDATE_MODAL_STATE.applicationDownloadFinish});
                    setTimeout(() => {
                        console.log(`INFO: App will quit and install after 3 seconds`);
                        autoUpdater.quitAndInstall();
                    }, 1000 * 3);
                });
            });

        }
        return Promise.reject(new Error('No EST Studio application update is available.'));
    }

    abortUpdate () {
        if (this.updaterState === UPDATE_MODAL_STATE.checkingApplication) {
            this.removeAllAutoUpdaterListeners();
        } else if (this.updaterState === UPDATE_MODAL_STATE.applicationDownloading) {
            this.removeAllAutoUpdaterListeners();
            this.cancellationToken.cancel();
            if (this.startDownloadTimeout) {
                clearTimeout(this.startDownloadTimeout);
            }
        }

        this.updaterState = null;
    }
}

export default OpenblockDesktopUpdater;
