/**
 * Replace OpenBlock's fixed-width hardware workspace with the EST Python code
 * drawer. The surrounding OpenBlock container still owns code generation,
 * locking and upload state; only the presentation component is replaced.
 * @param {string} source - OpenBlock hardware workspace component source.
 * @returns {string} transformed component source.
 */
module.exports = function (source) {
    const componentMarker = 'const HardwareComponent = props => {';
    if (!source.includes(componentMarker)) {
        throw new Error('Unable to locate the OpenBlock hardware workspace component.');
    }

    return "export {default} from 'est-code-drawer';\n";
};
