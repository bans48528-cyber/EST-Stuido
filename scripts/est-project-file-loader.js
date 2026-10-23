const path = require('path');

const transformDownloader = source => {
    const filenameExpression = ['$', '{filenameTitle.substring(0, 100)}'].join('');
    const filenameMarker = `return \`${filenameExpression}.ob\`;`;
    const fallbackMarker = '        filenameTitle = defaultTitle;';
    if (!source.includes(filenameMarker) || !source.includes(fallbackMarker)) {
        throw new Error('Unable to locate the OpenBlock project download filename logic.');
    }
    return source
        .replace(filenameMarker, `return \`${filenameExpression}.ests\`;`)
        .replace(fallbackMarker, "        filenameTitle = defaultTitle || 'EST Studio Project';");
};

const transformUploader = source => {
    const importMarker = "import bindAll from 'lodash.bindall';";
    const acceptMarker = "this.inputElement.accept = '.ob,.sb,.sb2,.sb3';";
    const titleCommentMarker = `            // only parse title with valid scratch project extensions
            // (.ob .sb, .sb2, and .sb3)`;
    const titlePatternMarker =
        '            const matches = fileInputFilename.match(/^(.*)\\.((ob)|(sb[23]))?$/);';
    const titleUpdateMarker = '                            this.props.onSetProjectTitle(uploadedProjectTitle);';
    if (!source.includes(importMarker) || !source.includes(acceptMarker) || !source.includes(titleCommentMarker) ||
        !source.includes(titleUpdateMarker) ||
        !source.includes(titlePatternMarker)) {
        throw new Error('Unable to locate the OpenBlock project upload extension logic.');
    }
    return source
        .replace(importMarker, `import {ipcRenderer} from 'electron';\n${importMarker}`)
        .replace(acceptMarker, "this.inputElement.accept = '.ests';")
        .replace(titleCommentMarker, '            // Parse EST Studio project titles from .ests filenames.')
        .replace(
            titlePatternMarker,
            '            const matches = fileInputFilename.match(/^(.*)\\.ests$/i);'
        )
        .replace(
            titleUpdateMarker,
            `${titleUpdateMarker}\n` +
            '                            if (this.fileToUpload && this.fileToUpload.path) {\n' +
            "                                ipcRenderer.invoke('est-home-remember-project', " +
            'this.fileToUpload.path);\n' +
            '                            }'
        );
};

const transformDefaultTitle = source => {
    const messagesMarker = `const messages = defineMessages({
    defaultProjectTitle: {
        id: 'gui.gui.defaultProjectTitle',
        description: 'Default title for project',
        defaultMessage: 'OpenBlock Project'
    }
});`;
    if (!source.includes(messagesMarker)) {
        throw new Error('Unable to locate the OpenBlock default project title logic.');
    }
    return source
        .replace(messagesMarker, messagesMarker.replace('OpenBlock Project', 'EST Studio Project'));
};

module.exports = function (source) {
    const resourcePath = path.normalize(this.resourcePath || '');
    if (resourcePath.endsWith(path.normalize('containers/sb3-downloader.jsx'))) {
        return transformDownloader(source);
    }
    if (resourcePath.endsWith(path.normalize('lib/sb-file-uploader-hoc.jsx'))) {
        return transformUploader(source);
    }
    if (resourcePath.endsWith(path.normalize('lib/titled-hoc.jsx'))) {
        return transformDefaultTitle(source);
    }
    throw new Error(`Unsupported EST project file source: ${resourcePath}`);
};
