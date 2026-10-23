import cameraIcon from './vision-extension-icon.png';
import {getEstText} from '../est-i18n';
import {getHardwareContext} from '../hardware/context';

export const VISION_EXTENSION_ID = 'vision';
export const VISION_BLOCK_IDS = Object.freeze([
    'vision_valid', 'vision_gesture', 'vision_class', 'vision_position',
    'vision_wait_state', 'vision_wait_gesture',
    'vision_face_detected', 'vision_face_action', 'vision_wait_face',
    'vision_pose_detected', 'vision_pose_action', 'vision_wait_pose'
]);

export const loadVisionExtension = runtime => {
    if (!getHardwareContext().profile.extensions.includes(VISION_EXTENSION_ID)) {
        return Promise.reject(new Error(getEstText('hardwareChoice.HARDWARE_EXTENSION')));
    }
    if (runtime.isDeviceExtensionLoaded(VISION_EXTENSION_ID)) return Promise.resolve();
    // Definitions and generators are bundled; only the native project extension state is activated here.
    runtime.addDeviceExtension(VISION_EXTENSION_ID, '<category id="vision"/>', null);
    runtime.emit(runtime.constructor.DEVICE_EXTENSION_ADDED, {});
    runtime.emitProjectChanged();
    return Promise.resolve();
};

export const restoreVisionExtension = project => {
    // Reject before VM clears the workspace, rather than silently dropping old stacks.
    const hasRemovedHat = (project.targets || []).some(target => Object.values(target.blocks || {})
        .some(block => block && /^event_vision_(state|gesture|face|pose)$/.test(block.opcode)));
    if (hasRemovedHat) throw new Error(getEstText('vision.removedEvents'));
    const used = (project.targets || []).some(target => Object.values(target.blocks || {})
        .some(block => block && VISION_BLOCK_IDS.includes(block.opcode)));
    if (!used || (project.deviceExtensions || []).includes(VISION_EXTENSION_ID)) return project;
    return {...project, deviceExtensions: [...(project.deviceExtensions || []), VISION_EXTENSION_ID]};
};

const extensions = [{
    extensionId: VISION_EXTENSION_ID,
    get name () {
        return getEstText('category.vision');
    },
    get description () {
        return getEstText('extension.vision.description');
    },
    iconURL: cameraIcon,
    tags: ['sensor'],
    featured: true
}];

export const getHardwareExtensions = () => extensions.filter(extension =>
    getHardwareContext().profile.extensions.includes(extension.extensionId));

export default extensions;
