import path from 'path';

// Retain the existing encrypted API settings when the application brand changes.
export const getEstAiSettingsPath = app => path.join(app.getPath('appData'), 'EST Studio', 'ai', 'settings.bin');

// The injected Electron safeStorage uses the current OS user's credential protection.
export const createEstAiKeyStore = ({safeStorage, fs, getPath, getLegacyPath}) => ({
    read () {
        try {
            let source = getPath();
            if (!fs.existsSync(source)) {
                source = getLegacyPath && getLegacyPath();
                if (!source || !fs.existsSync(source)) return '';
            }
            if (!safeStorage.isEncryptionAvailable()) throw new Error('ENCRYPTION_UNAVAILABLE');
            return safeStorage.decryptString(fs.readFileSync(source));
        } catch (error) {
            throw new Error('无法读取已保存的 AI 配置，请重新输入密钥并保存。');
        }
    },
    write (key) {
        if (!safeStorage.isEncryptionAvailable()) throw new Error('系统密钥加密不可用，无法保存 API 密钥。');
        let temporary = null;
        let stage = 'directory';
        try {
            const destination = getPath();
            fs.mkdirSync(path.dirname(destination), {recursive: true});
            stage = 'encrypt';
            const encrypted = safeStorage.encryptString(key);
            stage = 'write';
            temporary = `${destination}.${process.pid}.${Date.now()}.tmp`;
            fs.writeFileSync(temporary, encrypted, {mode: 0o600, flag: 'wx'});
            fs.renameSync(temporary, destination);
        } catch (error) {
            // If exclusive creation failed, this is not a temporary file we own.
            if (error.code === 'EEXIST') temporary = null;
            if (stage === 'encrypt') throw new Error('系统无法加密 AI 配置，请重启 Studio 后重试。');
            const code = ['EACCES', 'EPERM', 'ENOTDIR', 'EEXIST', 'ENOENT', 'ENOSPC'].includes(error.code) ?
                error.code : 'WRITE_FAILED';
            throw new Error(`无法保存 AI 配置（${code}），请检查 Studio 配置目录的权限或磁盘空间。`);
        } finally {
            if (temporary) {
                try {
                    fs.unlinkSync(temporary);
                } catch (error) {
                    // A successful rename already removed this temporary file.
                }
            }
        }
    }
});
