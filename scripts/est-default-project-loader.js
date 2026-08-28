/**
 * Replace OpenBlock's media-heavy Scratch starter project with EST Studio's
 * block-only project. The stage and program targets remain because the VM uses
 * them for global variables and the editable block workspace.
 * @param {string} source - OpenBlock default-project module source.
 * @returns {string} redirect to the EST-owned default project.
 */
module.exports = function (source) {
    const requiredMarkers = [
        "import projectData from './project-data';",
        "import popWav from '!arraybuffer-loader!./83a9787d4cb6f3b7632b4ddfebf74367.wav';",
        "import backdrop from '!raw-loader!./cd21514d0531fdffb22204e0ec5ed84a.svg';",
        'export default defaultProject;'
    ];

    if (!requiredMarkers.every(marker => source.includes(marker))) {
        throw new Error('Unable to locate the OpenBlock media-backed default project.');
    }

    return "export {default} from 'est-default-project';\n";
};
