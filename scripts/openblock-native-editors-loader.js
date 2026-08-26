/**
 * Repair OpenBlock's native variable/list and custom-block editors without
 * modifying files under node_modules. The upstream GUI omits modal ids and
 * registers its native toolbox button aliases only on the flyout workspace.
 * @param {string} source - OpenBlock GUI source.
 * @returns {string} transformed source.
 */
module.exports = function (source) {
    const resourcePath = (this.resourcePath || '').replace(/\\/g, '/');

    if (resourcePath.endsWith('/components/prompt/prompt.jsx')) {
        const modalMarker = '    <Modal\n        className={styles.modalContent}';
        const inputMarker = '                    defaultValue={props.defaultValue}';
        const propTypeMarker = '    defaultValue: PropTypes.string,';
        if (!source.includes(modalMarker) ||
            !source.includes(inputMarker) ||
            !source.includes(propTypeMarker)) {
            throw new Error('Unable to locate the OpenBlock variable prompt component markers.');
        }
        return source
            .replace(
                modalMarker,
                '    <Modal\n        id="variablePrompt"\n        className={styles.modalContent}'
            )
            .replace(inputMarker, '                    value={props.value}')
            .replace(propTypeMarker, '    value: PropTypes.string.isRequired,');
    }

    if (resourcePath.endsWith('/containers/prompt.jsx')) {
        const stateMarker = "            inputValue: '',";
        const valueMarker = '                defaultValue={this.props.defaultValue}';
        if (!source.includes(stateMarker) || !source.includes(valueMarker)) {
            throw new Error('Unable to locate the OpenBlock variable prompt container markers.');
        }
        return source
            .replace(stateMarker, "            inputValue: props.defaultValue || '',")
            .replace(valueMarker, '                value={this.state.inputValue}');
    }

    if (resourcePath.endsWith('/components/custom-procedures/custom-procedures.jsx')) {
        const modalMarker = '    <Modal\n        className={styles.modalContent}';
        if (!source.includes(modalMarker)) {
            throw new Error('Unable to locate the OpenBlock custom procedure modal marker.');
        }
        return source.replace(
            modalMarker,
            '    <Modal\n        id="customProcedures"\n        className={styles.modalContent}'
        );
    }

    if (resourcePath.endsWith('/containers/blocks.jsx')) {
        const callbackMarker = [
            "        toolboxWorkspace.registerButtonCallback('MAKE_A_VARIABLE', varListButtonCallback(''));",
            "        toolboxWorkspace.registerButtonCallback('MAKE_A_LIST', varListButtonCallback('list'));",
            "        toolboxWorkspace.registerButtonCallback('MAKE_A_PROCEDURE', procButtonCallback);"
        ].join('\n');
        if (!source.includes(callbackMarker)) {
            throw new Error('Unable to locate the OpenBlock native toolbox callback registrations.');
        }
        return source.replace(callbackMarker, `        // OpenBlock can render native buttons from both
        // dynamic categories (CREATE_*) and static category XML (MAKE_A_*).
        // Register both sets on
        // the main and flyout workspaces so either native path remains usable.
        [this.workspace, toolboxWorkspace].forEach(nativeWorkspace => {
            nativeWorkspace.registerButtonCallback(
                'CREATE_VARIABLE',
                varListButtonCallback('')
            );
            nativeWorkspace.registerButtonCallback('CREATE_LIST', varListButtonCallback('list'));
            nativeWorkspace.registerButtonCallback('CREATE_PROCEDURE', procButtonCallback);
            nativeWorkspace.registerButtonCallback(
                'MAKE_A_VARIABLE',
                varListButtonCallback('')
            );
            nativeWorkspace.registerButtonCallback('MAKE_A_LIST', varListButtonCallback('list'));
            nativeWorkspace.registerButtonCallback('MAKE_A_PROCEDURE', procButtonCallback);
        });`);
    }

    throw new Error(`Unsupported OpenBlock native editor source: ${resourcePath}`);
};
