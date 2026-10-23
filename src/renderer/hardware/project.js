/* eslint-disable require-atomic-updates -- Hardware context serializes project loads before awaiting IPC. */
import {ipcRenderer} from 'electron';
import {dialog, getCurrentWindow} from '@electron/remote';
import {readProjectHardware, serializeHardwareProject} from '../../common/hardware-profiles';
import {getCurrentEstLocale, getEstText} from '../est-i18n';
import {getHardwareContext, setHardwareContext} from './context';
import {createEstDefaultProjectData} from '../est-project/default-project';

export {serializeHardwareProject};
export const HARDWARE_SWITCH_REQUEST_EVENT = 'est-hardware-switch-request';
let switchingVM = null;

export const hardwareErrorText = error => {
    const code = /HARDWARE_[A-Z_]+/.exec(String((error && error.message) || error));
    return getEstText(code ? `hardwareChoice.${code[0]}` : 'hardwareChoice.failed');
};

const selectMainHardware = async hardwareId => {
    try {
        return await ipcRenderer.invoke('hardware-select', {hardwareId});
    } catch (error) {
        if (!String(error.message).includes('HARDWARE_RUNNING')) throw error;
        const result = await dialog.showMessageBox(getCurrentWindow(), {
            type: 'warning',
            message: getEstText('hardwareChoice.stopConfirm'),
            buttons: [getEstText('hardwareChoice.confirm'), getEstText('hardwareChoice.cancel')],
            defaultId: 1,
            cancelId: 1
        });
        if (result.response !== 0) throw new Error('HARDWARE_CANCELLED');
        return ipcRenderer.invoke('hardware-select', {hardwareId, confirmStop: true});
    }
};

// Every import path (File, recent files, command line and drafts) passes here,
// before the VM clears its current workspace.
export const loadHardwareProject = async (vm, project, deserialize) => {
    const profile = readProjectHardware(project);
    if (switchingVM && (switchingVM !== vm || vm.estStudioExpectedHardwareId !== profile.id)) {
        throw new Error('HARDWARE_BUSY');
    }
    if (vm.estStudioExpectedHardwareId && vm.estStudioExpectedHardwareId !== profile.id) {
        throw new Error('HARDWARE_DRAFT_INVALID');
    }
    if ((project.deviceExtensions || []).some(id => !profile.extensions.includes(id)) ||
        (Array.isArray(project.extensions) && project.extensions.length > 0)) {
        throw new Error('HARDWARE_EXTENSION');
    }
    if (getHardwareContext().busy) throw new Error('HARDWARE_BUSY');
    const previous = getHardwareContext().profile.id;
    setHardwareContext(previous, true);
    let selected = false;
    let success = false;
    try {
        await selectMainHardware(profile.id);
        selected = true;
        setHardwareContext(profile.id, true);
        vm.runtime.estStudioHardwareId = profile.id;
        const result = await deserialize();
        vm.runtime.estStudioHardwareId = profile.id;
        success = true;
        return result;
    } catch (error) {
        if (selected && profile.id !== previous) {
            await ipcRenderer.invoke('hardware-select', {hardwareId: previous}).catch(() => {});
        }
        throw error;
    } finally {
        if (!success) vm.runtime.estStudioHardwareId = previous;
        setHardwareContext(success ? profile.id : previous);
    }
};

export const requestHardwareSwitch = hardwareId => new Promise((resolve, reject) => {
    const detail = {hardwareId, resolve, reject, handled: false};
    window.dispatchEvent(new CustomEvent(HARDWARE_SWITCH_REQUEST_EVENT, {detail}));
    if (!detail.handled) reject(new Error('HARDWARE_BUSY'));
});

export const switchHardwareWorkspace = async ({vm, hardwareId, title, setTitle}) => {
    const previous = getHardwareContext().profile;
    if (hardwareId === previous.id) return;
    if (switchingVM || getHardwareContext().busy) throw new Error('HARDWARE_BUSY');
    switchingVM = vm;
    try {
        const draft = await ipcRenderer.invoke('hardware-draft-read', hardwareId);
        const snapshot = new Uint8Array(await (await vm.saveProjectSb3()).arrayBuffer());
        const before = vm.toJSON();
        await ipcRenderer.invoke('hardware-draft-write', {hardwareId: previous.id, title, data: snapshot});
        try {
            vm.estStudioExpectedHardwareId = hardwareId;
            await vm.loadProject(draft ? draft.data : JSON.stringify(createEstDefaultProjectData(hardwareId)));
            setTitle(draft ? draft.title : getEstText('hardwareChoice.newTitle', getCurrentEstLocale(),
                {name: getHardwareContext().profile.name}));
        } catch (error) {
            if (vm.toJSON() !== before) {
                try {
                    vm.estStudioExpectedHardwareId = previous.id;
                    await vm.loadProject(snapshot);
                } catch (restoreError) {
                    throw new Error(getEstText('hardwareChoice.restoreFailed'));
                }
            }
            throw error;
        }
    } finally {
        delete vm.estStudioExpectedHardwareId;
        switchingVM = null;
    }
};
