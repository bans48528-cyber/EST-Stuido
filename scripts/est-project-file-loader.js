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
    const acceptMarker = "this.inputElement.accept = '.ob,.sb,.sb2,.sb3';";
    const titleCommentMarker = `            // only parse title with valid scratch project extensions
            // (.ob .sb, .sb2, and .sb3)`;
    const titlePatternMarker =
        '            const matches = fileInputFilename.match(/^(.*)\\.((ob)|(sb[23]))?$/);';
    if (!source.includes(acceptMarker) || !source.includes(titleCommentMarker) ||
        !source.includes(titlePatternMarker)) {
        throw new Error('Unable to locate the OpenBlock project upload extension logic.');
    }
    return source
        .replace(acceptMarker, "this.inputElement.accept = '.ests';")
        .replace(titleCommentMarker, '            // Parse EST Studio project titles from .ests filenames.')
        .replace(
            titlePatternMarker,
            '            const matches = fileInputFilename.match(/^(.*)\\.ests$/i);'
        );
};

const transformDefaultTitle = source => {
    const intlImportMarker =
        "import {defineMessages, injectIntl, intlShape} from 'react-intl';";
    const messagesMarker = `const messages = defineMessages({
    defaultProjectTitle: {
        id: 'gui.gui.defaultProjectTitle',
        description: 'Default title for project',
        defaultMessage: 'OpenBlock Project'
    }
});`;
    const defaultTitleMarker =
        '                newTitle = this.props.intl.formatMessage(messages.defaultProjectTitle);';
    if (!source.includes(intlImportMarker) || !source.includes(messagesMarker) ||
        !source.includes(defaultTitleMarker)) {
        throw new Error('Unable to locate the OpenBlock default project title logic.');
    }
    const defaultTitleHelper = "const DEFAULT_PROJECT_TITLE = 'EST Studio Project';";
    return source
        .replace(intlImportMarker, "import {injectIntl, intlShape} from 'react-intl';")
        .replace(messagesMarker, defaultTitleHelper)
        .replace(
            defaultTitleMarker,
            '                newTitle = DEFAULT_PROJECT_TITLE;'
        );
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
