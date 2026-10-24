import {getEstAiNodeSpec} from './est-block-spec';
import {assertValidEstBlockIr} from './est-block-validator';
import {getEstAiProcedureCode} from './est-native-spec';

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

const procedureMutation = (procedure, argumentIds, definition) => {
    const attributes = {proccode: getEstAiProcedureCode(procedure),
        argumentids: JSON.stringify(argumentIds),
        warp: JSON.stringify(procedure.warp),
        generateshadows: 'false'};
    if (definition) {
        attributes.argumentnames = JSON.stringify(procedure.arguments.map(argument => argument.name));
        attributes.argumentdefaults = JSON.stringify(procedure.arguments.map(argument =>
            ({number: 1, text: '', boolean: false}[argument.type])));
    }
    return `<mutation ${Object.entries(attributes).map(([key, value]) => `${key}="${escapeXml(value)}"`)
        .join(' ')}></mutation>`;
};

const compileNodeWithChain = (node, remainingNodes, topLevelPosition, context) => {
    const spec = getEstAiNodeSpec(node, context.procedures, context.hardwareId);
    const position = topLevelPosition ?
        ` x="${escapeXml(topLevelPosition.x)}" y="${escapeXml(topLevelPosition.y)}"` : '';
    const parts = [`<block type="${escapeXml(node.type)}"${position}>`];
    const procedure = node.fields && context.procedures.find(item => item.name === node.fields.PROCEDURE);
    const argumentIds = procedure ? procedure.arguments.map((argument, index) =>
        `${context.namespace}-p${context.procedures.indexOf(procedure)}-a${index}`) : [];
    if (node.type === 'procedures_call') parts.push(procedureMutation(procedure, argumentIds, false));
    if (node.type === 'procedures_definition') {
        parts.push('<statement name="custom_block"><shadow type="procedures_prototype">',
            procedureMutation(procedure, argumentIds, true), '</shadow></statement>');
    }
    Object.keys(spec.fields).forEach(name => {
        const descriptor = spec.fields[name];
        if (descriptor.kind === 'procedure') return;
        const variableIndex = descriptor.kind === 'variable' ? context.variables.findIndex(variable =>
            variable.name === node.fields[name] && variable.type === descriptor.variableType) : -1;
        const identity = variableIndex < 0 ? '' :
            ` id="${escapeXml(context.namespace)}-v${variableIndex}" variabletype="${descriptor.variableType}"`;
        parts.push(`<field name="${escapeXml(name)}"${identity}>${escapeXml(node.fields[name])}</field>`);
    });
    Object.keys(spec.inputs).forEach(name => {
        const descriptor = spec.inputs[name];
        const value = node.inputs[name];
        // Keep a dormant literal behind reporters so unplugging restores an editable input.
        // Boolean sockets intentionally have no literal shadow.
        const fallback = !value || typeof value !== 'object' || descriptor.kind === 'boolean' ? '' :
            literalShadowFor(descriptor.kind === 'number' ? 0 : '', descriptor);
        const childXml = value !== null && typeof value === 'object' ?
            fallback + compileNodeWithChain(value, [], null, context) : literalShadowFor(value, descriptor);
        const inputName = node.type === 'procedures_call' ?
            argumentIds[procedure.arguments.findIndex(argument => argument.name === name)] : name;
        parts.push(`<value name="${escapeXml(inputName)}">${childXml}</value>`);
    });
    Object.keys(spec.branches).forEach(branchName => {
        const branch = node[branchPropertyFor(branchName)] || [];
        if (branch.length) {
            parts.push(`<statement name="${escapeXml(branchName)}">` +
                `${compileNodeWithChain(branch[0], branch.slice(1), null, context)}</statement>`);
        }
    });
    if (remainingNodes.length) {
        parts.push(`<next>${compileNodeWithChain(remainingNodes[0], remainingNodes.slice(1), null, context)}</next>`);
    }
    parts.push('</block>');
    return parts.join('');
};

export const compileEstBlockIrToXml = (ir, options = {}) => {
    const hardwareId = options.hardwareId || 'est';
    const validation = assertValidEstBlockIr(ir, {hardwareId});
    const startX = Number.isFinite(options.startX) ? options.startX : 360;
    const startY = Number.isFinite(options.startY) ? options.startY : 160;
    const stackGap = Number.isFinite(options.stackGap) ? options.stackGap : 260;
    const context = {hardwareId,
        variables: validation.normalized.variables || [],
        procedures: validation.normalized.procedures || [],
        namespace: options.namespace || 'est-ai'};
    const variablesXml = context.variables.length ? `<variables>${context.variables.map((variable, index) =>
        `<variable type="${variable.type}" id="${escapeXml(context.namespace)}-v${index}">` +
        `${escapeXml(variable.name)}</variable>`).join('')}</variables>` : '';
    const stacksXml = validation.normalized.stacks.map((stack, index) => {
        const eventWithBody = stack.body.length ? [stack.event].concat(stack.body) : [stack.event];
        return compileNodeWithChain(eventWithBody[0], eventWithBody.slice(1), {
            x: Number.isFinite(stack.x) ? stack.x : startX + (index * stackGap),
            y: Number.isFinite(stack.y) ? stack.y : startY
        }, context);
    }).join('');
    return {
        xml: `<xml xmlns="https://developers.google.com/blockly/xml">${variablesXml}${stacksXml}</xml>`,
        mode: validation.normalized.mode,
        blockCount: validation.blockCount,
        warnings: validation.warnings,
        normalized: validation.normalized
    };
};
