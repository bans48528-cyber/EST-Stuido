import {buildPersistentProgramStatusFrame, crc32} from './protocol';
import {PERSISTENT_PROGRAM_SLOT_COUNT, PYTHON_PROGRAM_NO_TIMEOUT_MS} from './constants';

export const runSavedVisionTest = async (service, source, authorizedSlot) => {
    if (typeof authorizedSlot !== 'undefined' &&
        (!Number.isInteger(authorizedSlot) || authorizedSlot < 0 || authorizedSlot >= PERSISTENT_PROGRAM_SLOT_COUNT)) {
        throw new Error('无效的授权测试槽位');
    }
    const programName = 'EST Vision USB Test';
    const bytes = Buffer.from(source, 'utf8');
    const checksum = crc32(bytes);
    const slots = [];
    for (let slot = 0; slot < PERSISTENT_PROGRAM_SLOT_COUNT; slot++) {
        const status = await service._persistentProgramActionNow(buildPersistentProgramStatusFrame(slot));
        service._requirePersistentProgramSuccess(status, 'inspect vision test slot');
        if (status.programSlotId !== slot) throw new Error('设备返回的槽位编号不匹配');
        slots.push(status);
    }
    const reusable = slots.find(slot => slot.state === 3 && slot.programName === programName &&
        slot.sourceLength === bytes.length && slot.sourceCrc32 === checksum && (slot.flags & 0x20));
    // READY, writable, not read-only and no saved source. Never erase foreign/occupied data.
    const empty = slots.slice().reverse().find(slot => slot.state === 2 &&
        (slot.flags & 0x10) && !(slot.flags & 0x28) && slot.sourceLength === 0);
    const replacement = typeof authorizedSlot === 'undefined' ? null : slots[authorizedSlot];
    const chosen = reusable || empty || (replacement && (replacement.flags & 0x10) &&
        !(replacement.flags & 0x08) && replacement.state === 3 ? replacement : null);
    if (!chosen) {
        console.info('EST vision slot inspection:', JSON.stringify(slots.map(slot => ({
            slot: slot.programSlotId, state: slot.state, flags: slot.flags,
            sourceLength: slot.sourceLength, name: slot.programName
        }))));
        throw new Error('没有可用空槽，已保留全部现有程序');
    }
    const slot = chosen.programSlotId;
    if (!reusable) await service._saveProgramToSlotNow(source, slot, programName);
    const run = await service._loadAndRunProgramNow(slot, PYTHON_PROGRAM_NO_TIMEOUT_MS);
    return {mode: 'saved', slot, reused: Boolean(reusable), slots, ...run};
};
