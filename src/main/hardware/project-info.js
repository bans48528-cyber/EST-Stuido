import yauzl from 'yauzl';
import {readProjectHardware} from '../../common/hardware-profiles';

// Read only project.json; thumbnails and other project assets need not be inflated.
export const readProjectFileHardware = projectPath => new Promise(resolve => {
    yauzl.open(projectPath, {lazyEntries: true}, (error, archive) => {
        if (error) {
            resolve(null);
            return;
        }
        const finish = hardware => {
            archive.close();
            resolve(hardware);
        };
        archive.once('error', () => finish(null));
        archive.once('end', () => finish(null));
        archive.on('entry', entry => {
            if (entry.fileName !== 'project.json') {
                archive.readEntry();
                return;
            }
            archive.openReadStream(entry, (streamError, stream) => {
                if (streamError) {
                    finish(null);
                    return;
                }
                const chunks = [];
                stream.on('data', chunk => chunks.push(chunk));
                stream.once('error', () => finish(null));
                stream.once('end', () => {
                    try {
                        finish(readProjectHardware(JSON.parse(Buffer.concat(chunks).toString('utf8'))));
                    } catch (parseError) {
                        finish(null);
                    }
                });
            });
        });
        archive.readEntry();
    });
});
