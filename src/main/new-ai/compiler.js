import {spawn} from 'child_process';
import {createHash} from 'crypto';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import {NewAiError, validateNewAiBytecode} from './protocol';

export const NEW_COMPILER_SHA256 = '2f3f8a1eb2461ffc60fb3a1cba6fefd5c688626fa58b057e9ed6a734e70b4e59';
export const getNewAiResourceRoot = () => [
    typeof process.resourcesPath === 'string' ? path.join(process.resourcesPath, 'new-ai') : '',
    path.resolve(__dirname, '../../resources/new-ai'),
    path.resolve(__dirname, '../../../resources/new-ai')
].find(root => root && fs.existsSync(path.join(root, 'compiler-manifest.json')));

export class NewAiCompiler {
    constructor ({root = getNewAiResourceRoot(), tempRoot = os.tmpdir(), timeoutMs = 20000,
        spawnProcess = spawn} = {}) {
        this.root = root;
        this.tempRoot = tempRoot;
        this.timeoutMs = timeoutMs;
        this.spawnProcess = spawnProcess;
    }
    get supported () {
        return process.platform === 'win32' && process.arch === 'x64' && Boolean(this.root);
    }
    async compile (source, {signal} = {}) {
        if (typeof source !== 'string' || !source.trim() || source.includes('\0') ||
            Buffer.byteLength(source, 'utf8') > 262144) throw new NewAiError('NEW_SOURCE_INVALID');
        if (!this.supported) throw new NewAiError('NEW_COMPILER_UNSUPPORTED');
        if (signal && signal.aborted) throw new NewAiError('NEW_CANCELLED');
        const executable = path.join(this.root, 'win32/pika-python.exe');
        try {
            const manifest = await fs.readJson(path.join(this.root, 'compiler-manifest.json'));
            const binary = await fs.readFile(executable);
            if (manifest.version !== '1.13.4' || manifest.sha256 !== NEW_COMPILER_SHA256 ||
                manifest.bytes !== binary.length || createHash('sha256').update(binary)
                .digest('hex') !==
                    NEW_COMPILER_SHA256) throw new Error('Invalid compiler');
        } catch (error) {
            throw new NewAiError('NEW_COMPILER_INVALID');
        }
        let directory;
        try {
            await fs.ensureDir(this.tempRoot);
            directory = await fs.mkdtemp(path.join(this.tempRoot, 'est-new-ai-'));
            await fs.writeFile(path.join(directory, 'program.py'), `${source.replace(/\r\n?/g, '\n')}\n`, 'utf8');
            await this.run(executable, directory, signal);
            if (signal && signal.aborted) throw new NewAiError('NEW_CANCELLED');
            const bytes = await fs.readFile(path.join(directory, 'program.py.o'));
            validateNewAiBytecode(bytes);
            return bytes;
        } catch (error) {
            if (error instanceof NewAiError) throw error;
            throw new NewAiError('NEW_COMPILE_FAILED');
        } finally {
            if (directory) {
                const relative = path.relative(path.resolve(this.tempRoot), path.resolve(directory));
                if (!path.isAbsolute(relative) && /^est-new-ai-[^\\/]+$/.test(relative)) await fs.remove(directory);
            }
        }
    }
    run (executable, directory, signal) {
        return new Promise((resolve, reject) => {
            if (signal && signal.aborted) {
                reject(new NewAiError('NEW_CANCELLED')); return;
            }
            const child = this.spawnProcess(executable, ['-c', 'program.py', '-o', 'program.py.o'], {
                cwd: directory, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
            });
            let failure;
            const abort = () => {
                failure = new NewAiError('NEW_CANCELLED'); child.kill();
            };
            const timer = setTimeout(() => {
                failure = new NewAiError('NEW_COMPILE_TIMEOUT'); child.kill();
            }, this.timeoutMs);
            // Drain bounded diagnostics without exposing source or allowing pipe backpressure to hang the worker.
            child.stdout.on('data', () => {});
            child.stderr.on('data', () => {});
            child.on('error', () => {
                failure = new NewAiError('NEW_COMPILER_INVALID');
            });
            if (signal) {
                signal.addEventListener('abort', abort, {once: true});
                if (signal.aborted) abort();
            }
            child.on('close', code => {
                clearTimeout(timer);
                if (signal) signal.removeEventListener('abort', abort);
                if (failure) reject(failure);
                else if ((code | 0) === -14) reject(new NewAiError('NEW_COMPILE_SYNTAX'));
                else if (code === 0) resolve();
                else reject(new NewAiError('NEW_COMPILE_FAILED'));
            });
        });
    }
}
