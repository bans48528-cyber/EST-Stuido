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
        const variableOptionsMarker =
            '                showVariableOptions={this.props.showVariableOptions}';
        const scopeMarker = `            scope: this.state.globalSelected ? 'global' : 'local',
            isCloud: this.state.cloudSelected`;
        if (!source.includes(stateMarker) ||
            !source.includes(valueMarker) ||
            !source.includes(variableOptionsMarker) ||
            !source.includes(scopeMarker)) {
            throw new Error('Unable to locate the OpenBlock variable prompt container markers.');
        }
        return source
            .replace(stateMarker, "            inputValue: props.defaultValue || '',")
            .replace(valueMarker, '                value={this.state.inputValue}')
            .replace(variableOptionsMarker, '                showVariableOptions={false}')
            .replace(scopeMarker, `            scope: 'global',
            isCloud: false`);
    }

    if (resourcePath.endsWith('/components/custom-procedures/custom-procedures.jsx')) {
        const modalMarker = '    <Modal\n        className={styles.modalContent}';
        const textInputOptionMarker = `                <div
                    className={styles.optionCard}
                    role="button"
                    tabIndex="0"
                    onClick={props.onAddText}
                >`;
        const booleanInputOptionMarker = `                <div
                    className={styles.optionCard}
                    role="button"
                    tabIndex="0"
                    onClick={props.onAddBoolean}
                >`;
        const textInputOptionStart = source.indexOf(textInputOptionMarker);
        const booleanInputOptionStart = source.indexOf(
            booleanInputOptionMarker,
            textInputOptionStart
        );
        if (!source.includes(modalMarker) ||
            textInputOptionStart < 0 ||
            booleanInputOptionStart < 0) {
            throw new Error('Unable to locate the OpenBlock custom procedure modal marker.');
        }
        const withoutTextInputOption = source.slice(0, textInputOptionStart) +
            source.slice(booleanInputOptionStart);
        const warpOptionMarker = '            <div className={styles.checkboxRow}>';
        const buttonRowMarker = '            <Box className={styles.buttonRow}>';
        const warpOptionStart = withoutTextInputOption.indexOf(warpOptionMarker);
        const buttonRowStart = withoutTextInputOption.indexOf(buttonRowMarker, warpOptionStart);
        if (warpOptionStart < 0 || buttonRowStart < 0) {
            throw new Error('Unable to locate the OpenBlock custom procedure warp option.');
        }
        const withoutWarpOption = withoutTextInputOption.slice(0, warpOptionStart) +
            withoutTextInputOption.slice(buttonRowStart);
        return withoutWarpOption.replace(
            modalMarker,
            '    <Modal\n        id="customProcedures"\n        className={styles.modalContent}'
        );
    }

    if (resourcePath.endsWith('/containers/blocks.jsx')) {
        const deviceLibraryImport = `import DeviceLibrary from './device-library.jsx';\n`;
        const modalReducersImport =
            `import {closeExtensionLibrary, openSoundRecorder, openConnectionModal, closeDeviceLibrary} ` +
            `from '../reducers/modals';`;
        const deviceLibraryRender = `                {deviceLibraryVisible ? (
                    <DeviceLibrary
                        vm={vm}
                        onDeviceSelected={this.handleDeviceSelected}
                        onRequestClose={onRequestCloseDeviceLibrary}
                    />
                ) : null}
`;
        const closeDeviceLibraryDispatch = `    onRequestCloseDeviceLibrary: () => {
        dispatch(closeDeviceLibrary());
    },
`;
        const messageBoxRenderPropsMarker = `            onSetBaudrate,
            toolboxXML,`;
        const refreshMethodMarker = `    handleOpenSoundRecorder () {
        this.props.onOpenSoundRecorder();
    }

`;
        const promptCallbackMarker = `    handlePromptCallback (input, variableOptions) {
        this.state.prompt.callback(
            input,
            this.props.vm.runtime.getAllVarNamesOfType(this.state.prompt.varType),
            variableOptions);
        this.handlePromptClose();
    }
`;
        const customProceduresCloseMarker = `    handleCustomProceduresClose (data) {
        this.props.onRequestCloseCustomProcedures(data);
        const ws = this.workspace;
        ws.refreshToolboxSelection_();
        ws.toolbox_.scrollToCategoryById('myBlocks');
    }
`;
        const callbackMarker = [
            "        toolboxWorkspace.registerButtonCallback('MAKE_A_VARIABLE', varListButtonCallback(''));",
            "        toolboxWorkspace.registerButtonCallback('MAKE_A_LIST', varListButtonCallback('list'));",
            "        toolboxWorkspace.registerButtonCallback('MAKE_A_PROCEDURE', procButtonCallback);"
        ].join('\n');
        if (!source.includes(refreshMethodMarker) ||
            !source.includes(promptCallbackMarker) ||
            !source.includes(customProceduresCloseMarker) ||
            !source.includes(callbackMarker) ||
            !source.includes(deviceLibraryImport) ||
            !source.includes(modalReducersImport) ||
            !source.includes(deviceLibraryRender) ||
            !source.includes(closeDeviceLibraryDispatch) ||
            !source.includes(messageBoxRenderPropsMarker)) {
            throw new Error('Unable to locate the OpenBlock native toolbox callback registrations.');
        }
        return source
            .replace(deviceLibraryImport, '')
            .replace(
                modalReducersImport,
                `import {closeExtensionLibrary, openSoundRecorder, openConnectionModal} ` +
                    `from '../reducers/modals';`
            )
            .replace('            deviceLibraryVisible,\n', '')
            .replace('            onRequestCloseDeviceLibrary,\n', '')
            .replace(deviceLibraryRender, '')
            .replace('    deviceLibraryVisible: PropTypes.bool,\n', '')
            .replace('    onRequestCloseDeviceLibrary: PropTypes.func,\n', '')
            .replace('    deviceLibraryVisible: state.scratchGui.modals.deviceLibrary,\n', '')
            .replace(closeDeviceLibraryDispatch, '')
            .replace(messageBoxRenderPropsMarker, `            onSetBaudrate,
            onShowMessageBox,
            toolboxXML,`)
            .replace(refreshMethodMarker, `${refreshMethodMarker}    refreshNativeToolboxCategory (categoryId) {
        this.withToolboxUpdates(() => {
            if (!this.workspace || !this.workspace.toolbox_) return;
            this.workspace.toolboxRefreshEnabled_ = true;
            this.workspace.refreshToolboxSelection_();
            this.workspace.toolbox_.scrollToCategoryById(categoryId);
        });
    }

`)
            .replace(promptCallbackMarker, `    handlePromptCallback (input, variableOptions) {
        this.state.prompt.callback(
            input,
            this.props.vm.runtime.getAllVarNamesOfType(this.state.prompt.varType),
            variableOptions);
        this.handlePromptClose();
        this.refreshNativeToolboxCategory('variables');
    }
`)
            .replace(customProceduresCloseMarker, `    handleCustomProceduresClose (data) {
        this.props.onRequestCloseCustomProcedures(data);
        this.refreshNativeToolboxCategory('myBlocks');
    }
`)
            .replace(callbackMarker, `        // OpenBlock can render native buttons from both
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
