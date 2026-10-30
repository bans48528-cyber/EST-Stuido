export const DEFAULT_HARDWARE_ID = 'est';
export const HARDWARE_PROJECT_VERSION = 1;

// A pending product has no inherited ports, blocks, compiler or wire protocol.
export const HARDWARE_PROFILES = Object.freeze([
    Object.freeze({
        id: 'est',
        name: 'EST',
        status: 'ready',
        adapter: 'est-hid',
        compiler: 'est-python',
        extensions: Object.freeze(['vision']),
        motorPorts: Object.freeze(['A', 'B', 'C', 'D']),
        sensorPorts: Object.freeze(['1', '2', '3', '4']),
        programSlots: 8,
        screen: Object.freeze({width: 180, height: 128, format: 'mono'})
    }),
    Object.freeze({
        id: 'spark-ai',
        name: 'Spark AI',
        status: 'ready',
        adapter: 'spark-usb',
        compiler: 'spark-python',
        extensions: Object.freeze([]),
        motorPorts: Object.freeze(['E', 'F', 'G', 'H']),
        sensorPorts: Object.freeze(['A', 'B', 'C', 'D']),
        programSlots: 10,
        screen: null
    }),
    Object.freeze({
        id: 'new-ai',
        name: 'New AI',
        status: 'program-ready',
        adapter: 'new-usb',
        compiler: 'new-python',
        extensions: Object.freeze([]),
        motorPorts: Object.freeze(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']),
        sensorPorts: Object.freeze(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']),
        programSlots: 20,
        screen: Object.freeze({width: 7, height: 9, format: 'rgb'})
    })
]);

export const getHardwareProfile = id => {
    const profile = HARDWARE_PROFILES.find(item => item.id === id);
    if (!profile) throw new Error('HARDWARE_UNKNOWN');
    return profile;
};

export const readProjectHardware = project => {
    const deviceId = typeof project.device === 'string' ? project.device : project.device && project.device.deviceId;
    if (deviceId) throw new Error('HARDWARE_UNKNOWN');
    const hardware = project.meta && project.meta.estStudio;
    if (hardware) {
        if (hardware.version !== HARDWARE_PROJECT_VERSION) throw new Error('HARDWARE_PROJECT_VERSION');
        return getHardwareProfile(hardware.hardwareId);
    }
    // Older ATC CodeStudio files have no target metadata. Do not reinterpret files
    // declaring a foreign OpenBlock board as EST projects.
    return getHardwareProfile(DEFAULT_HARDWARE_ID);
};

export const serializeHardwareProject = (project, runtime) => ({
    ...project,
    meta: {...project.meta,
        estStudio: {
            version: HARDWARE_PROJECT_VERSION,
            hardwareId: getHardwareProfile(runtime.estStudioHardwareId || DEFAULT_HARDWARE_ID).id
        }}
});
