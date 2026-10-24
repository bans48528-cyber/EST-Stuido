import {compileEstBlockIrToXml} from './est-block-compiler';
import {getEstAiProcedureCode} from './est-native-spec';
import {getHardwareContext, isAiHardwareActive} from '../hardware/context';
import {getEstText} from '../est-i18n';

let importSequence = 0;
const suffixedName = (name, suffix) => {
    const ending = ` (${suffix})`;
    return name.slice(0, 64 - ending.length).trimEnd() + ending;
};

// An insertion owns its symbols; never silently bind to or overwrite the user's existing ones.
const avoidNameCollisions = (ir, workspace) => {
    const result = JSON.parse(JSON.stringify(ir));
    const variables = typeof workspace.getAllVariables === 'function' ? workspace.getAllVariables() : [];
    const variableNames = new Set(variables.map(variable => variable.name.toLowerCase()));
    const variableRenames = new Map();
    (result.variables || []).forEach(variable => {
        const original = variable.name;
        let suffix = 2;
        while (variableNames.has(variable.name.toLowerCase())) variable.name = suffixedName(original, suffix++);
        variableNames.add(variable.name.toLowerCase());
        variableRenames.set(original, variable.name);
    });
    const blocks = typeof workspace.getAllBlocks === 'function' ? workspace.getAllBlocks(false) : [];
    const procedureCodes = new Set(blocks.filter(block => block.type === 'procedures_prototype')
        .map(block => block.getProcCode().toLowerCase()));
    const procedureRenames = new Map();
    (result.procedures || []).forEach(procedure => {
        const original = procedure.name;
        let suffix = 2;
        while (procedureCodes.has(getEstAiProcedureCode(procedure).toLowerCase())) {
            procedure.name = suffixedName(original, suffix++);
        }
        procedureCodes.add(getEstAiProcedureCode(procedure).toLowerCase());
        procedureRenames.set(original, procedure.name);
    });
    const visit = node => {
        if (!node || typeof node !== 'object') return;
        if (node.fields) {
            for (const key of ['VARIABLE', 'LIST']) {
                if (variableRenames.has(node.fields[key])) node.fields[key] = variableRenames.get(node.fields[key]);
            }
            if (procedureRenames.has(node.fields.PROCEDURE)) {
                node.fields.PROCEDURE = procedureRenames.get(node.fields.PROCEDURE);
            }
        }
        Object.values(node.inputs || {}).forEach(visit);
        (node.body || []).forEach(visit);
        (node.elseBody || []).forEach(visit);
    };
    result.stacks.forEach(stack => {
        visit(stack.event);
        stack.body.forEach(visit);
    });
    return result;
};

export const EST_AI_IMPORT_REQUEST_EVENT = 'est-ai-import-request';

export const importEstBlockIrToWorkspace = ({ScratchBlocks, workspace, vm, ir, mode}) => {
    const hardwareId = getHardwareContext().profile.id;
    if (!isAiHardwareActive() || (ir.hardwareId || 'est') !== hardwareId ||
        (vm && vm.runtime && vm.runtime.estStudioHardwareId && vm.runtime.estStudioHardwareId !== hardwareId)) {
        throw new Error(getEstText('hardwareChoice.HARDWARE_NOT_READY'));
    }
    if (!ScratchBlocks || !ScratchBlocks.Xml || !workspace) {
        throw new Error('EST AI 工作区尚未准备好');
    }
    const sourceIr = mode ? {...ir, mode} : ir;
    const validated = compileEstBlockIrToXml(sourceIr, {hardwareId});
    const compiled = compileEstBlockIrToXml(validated.mode === 'insert' ?
        avoidNameCollisions(validated.normalized, workspace) : validated.normalized,
    {hardwareId, namespace: `est-ai-${Date.now()}-${++importSequence}`});
    const dom = ScratchBlocks.Xml.textToDom(compiled.xml);
    const Events = ScratchBlocks.Events;
    const existingGroup = Events && typeof Events.getGroup === 'function' ? Events.getGroup() : null;
    if (Events && !existingGroup) Events.setGroup(true);
    let blockIds;
    try {
        if (compiled.mode === 'replace') {
            workspace.clear();
            blockIds = ScratchBlocks.Xml.domToWorkspace(dom, workspace);
        } else if (typeof ScratchBlocks.Xml.appendDomToWorkspace === 'function') {
            blockIds = ScratchBlocks.Xml.appendDomToWorkspace(dom, workspace);
        } else {
            blockIds = ScratchBlocks.Xml.domToWorkspace(dom, workspace);
        }
    } finally {
        if (Events && !existingGroup) Events.setGroup(false);
    }
    if (vm && vm.runtime && typeof vm.runtime.requestCodeUpdate === 'function') {
        vm.runtime.requestCodeUpdate();
    }
    return {
        ...compiled,
        blockIds: blockIds || []
    };
};

export const requestEstAiBlockImport = (ir, options = {}) => new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof CustomEvent === 'undefined') {
        reject(new Error('EST AI 导入只能在 Studio 编辑器中执行'));
        return;
    }
    const detail = {
        handled: false,
        ir,
        mode: options.mode,
        resolve,
        reject
    };
    window.dispatchEvent(new CustomEvent(EST_AI_IMPORT_REQUEST_EVENT, {detail}));
    if (!detail.handled) reject(new Error('EST AI 工作区尚未准备好'));
});
