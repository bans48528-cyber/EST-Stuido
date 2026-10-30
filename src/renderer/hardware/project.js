/* eslint-disable require-atomic-updates -- Hardware context serializes project loads before awaiting IPC. */
import {ipcRenderer} from 'electron';
import {dialog, getCurrentWindow} from '@electron/remote';
import {getHardwareProfile, readProjectHardware, serializeHardwareProject} from '../../common/hardware-profiles';
import {getCurrentEstLocale, getEstText} from '../est-i18n';
import {getHardwareContext, setHardwareContext, HARDWARE_DRAFTS_DISCARDED_EVENT} from './context';
import {createEstDefaultProjectData} from '../est-project/default-project';

export {serializeHardwareProject};
export const HARDWARE_SWITCH_REQUEST_EVENT = 'est-hardware-switch-request';
export const HARDWARE_NEW_PROJECT_REQUEST_EVENT = 'est-hardware-new-project-request';
let switchingVM = null;
let restoringVM = null;

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
    // Rollback is part of the existing load transaction, not a second hardware switch.
    if (restoringVM === vm) {
        vm.runtime.estStudioHardwareId = profile.id;
        return deserialize();
    }
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
    let snapshot = null;
    let before = null;
    try {
        const mainState = await ipcRenderer.invoke('hardware-state');
        if (mainState.busy) throw new Error('HARDWARE_BUSY');
        // New-project switches already keep their own rollback snapshot.
        if (!switchingVM && vm.runtime.targets && vm.runtime.targets.length && vm.saveProjectSb3) {
            before = vm.toJSON();
            snapshot = new Uint8Array(await (await vm.saveProjectSb3()).arrayBuffer());
        }
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
            await ipcRenderer.invoke('hardware-select', {hardwareId: previous});
        }
        if (snapshot && vm.toJSON() !== before) {
            try {
                restoringVM = vm;
                await vm.loadProject(snapshot);
            } finally {
                restoringVM = null;
            }
        }
        throw error;
    } finally {
        if (!success) vm.runtime.estStudioHardwareId = previous;
        setHardwareContext(success ? profile.id : previous);
    }
};

export const requestHardwareSwitch = (hardwareId, newProject = false) => new Promise((resolve, reject) => {
    const detail = {hardwareId, newProject, resolve, reject, handled: false};
    window.dispatchEvent(new CustomEvent(HARDWARE_SWITCH_REQUEST_EVENT, {detail}));
    if (!detail.handled) reject(new Error('HARDWARE_BUSY'));
});

export const switchHardwareWorkspace = async ({vm, hardwareId, setTitle, newProject = false}) => {
    const previous = getHardwareContext().profile;
    const target = getHardwareProfile(hardwareId);
    if (hardwareId === previous.id && !newProject) return;
    if (switchingVM || getHardwareContext().busy) throw new Error('HARDWARE_BUSY');
    switchingVM = vm;
    try {
        const mainState = await ipcRenderer.invoke('hardware-state');
        if (mainState.busy) throw new Error('HARDWARE_BUSY');
        const confirmation = newProject ? {response: 0} : await dialog.showMessageBox(getCurrentWindow(), {
            type: 'warning',
            title: getEstText('hardwareChoice.select'),
            message: getEstText('hardwareChoice.discardSwitch', getCurrentEstLocale(), {name: target.name}),
            detail: getEstText('hardwareChoice.discardSwitchDetail'),
            buttons: [getEstText('hardwareChoice.discardAndSwitch'), getEstText('hardwareChoice.cancel')],
            defaultId: 1,
            cancelId: 1
        });
        if (confirmation.response !== 0) throw new Error('HARDWARE_CANCELLED');
        // This snapshot exists only to roll back a failed switch; it is never a device draft.
        const snapshot = new Uint8Array(await (await vm.saveProjectSb3()).arrayBuffer());
        const before = vm.toJSON();
        try {
            vm.estStudioExpectedHardwareId = hardwareId;
            await vm.loadProject(JSON.stringify(createEstDefaultProjectData(hardwareId)));
            await ipcRenderer.invoke('hardware-drafts-clear');
            setTitle(getEstText('hardwareChoice.newTitle', getCurrentEstLocale(), {name: target.name}));
            if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
                window.dispatchEvent(new CustomEvent(HARDWARE_DRAFTS_DISCARDED_EVENT));
            }
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
