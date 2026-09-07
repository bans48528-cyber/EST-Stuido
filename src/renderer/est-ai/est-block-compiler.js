import {getEstAiBlockSpec} from './est-block-spec';
import {assertValidEstBlockIr} from './est-block-validator';

const escapeXml = value => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const branchPropertyFor = branchName => (branchName === 'SUBSTACK2' ? 'elseBody' : 'body');

const literalShadowFor = (value, descriptor) => {
    let shadow = descriptor.shadow;
    if (!shadow && descriptor.kind === 'any') {
        shadow = typeof value === 'number' ?
            {type: 'math_number', field: 'NUM'} :
            {type: 'text', field: 'TEXT'};
    }
    if (!shadow) {
        throw new Error(`输入 ${descriptor.kind} 没有可用的字面量积木`);
    }
    return `<shadow type="${escapeXml(shadow.type)}"><field name="${escapeXml(shadow.field)}">` +
        `${escapeXml(value)}</field></shadow>`;
};

const compileNodeWithChain = (node, remainingNodes, topLevelPosition) => {
    const spec = getEstAiBlockSpec(node.type);
    const position = topLevelPosition ?
        ` x="${escapeXml(topLevelPosition.x)}" y="${escapeXml(topLevelPosition.y)}"` : '';
    const parts = [`<block type="${escapeXml(node.type)}"${position}>`];
    Object.keys(spec.fields).forEach(name => {
        parts.push(`<field name="${escapeXml(name)}">${escapeXml(node.fields[name])}</field>`);
    });
    Object.keys(spec.inputs).forEach(name => {
        const descriptor = spec.inputs[name];
        const value = node.inputs[name];
        const childXml = value !== null && typeof value === 'object' ?
            compileNodeWithChain(value, [], null) : literalShadowFor(value, descriptor);
        parts.push(`<value name="${escapeXml(name)}">${childXml}</value>`);
    });
    Object.keys(spec.branches).forEach(branchName => {
        const branch = node[branchPropertyFor(branchName)] || [];
        if (branch.length) {
            parts.push(`<statement name="${escapeXml(branchName)}">` +
                `${compileNodeWithChain(branch[0], branch.slice(1), null)}</statement>`);
        }
    });
    if (remainingNodes.length) {
        parts.push(`<next>${compileNodeWithChain(remainingNodes[0], remainingNodes.slice(1), null)}</next>`);
    }
    parts.push('</block>');
    return parts.join('');
};

export const compileEstBlockIrToXml = (ir, options = {}) => {
    const validation = assertValidEstBlockIr(ir);
    const startX = Number.isFinite(options.startX) ? options.startX : 360;
    const startY = Number.isFinite(options.startY) ? options.startY : 160;
    const stackGap = Number.isFinite(options.stackGap) ? options.stackGap : 260;
    const stacksXml = validation.normalized.stacks.map((stack, index) => {
        const eventWithBody = stack.body.length ? [stack.event].concat(stack.body) : [stack.event];
        return compileNodeWithChain(eventWithBody[0], eventWithBody.slice(1), {
            x: Number.isFinite(stack.x) ? stack.x : startX + (index * stackGap),
            y: Number.isFinite(stack.y) ? stack.y : startY
        });
    }).join('');
    return {
        xml: `<xml xmlns="https://developers.google.com/blockly/xml">${stacksXml}</xml>`,
        mode: validation.normalized.mode,
        blockCount: validation.blockCount,
        warnings: validation.warnings,
        normalized: validation.normalized
    };
};
