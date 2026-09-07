import {compileEstBlockIrToXml} from './est-block-compiler';

export const EST_AI_IMPORT_REQUEST_EVENT = 'est-ai-import-request';

export const importEstBlockIrToWorkspace = ({ScratchBlocks, workspace, vm, ir, mode}) => {
    if (!ScratchBlocks || !ScratchBlocks.Xml || !workspace) {
        throw new Error('EST AI 工作区尚未准备好');
    }
    const sourceIr = mode ? {...ir, mode} : ir;
    const compiled = compileEstBlockIrToXml(sourceIr);
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
