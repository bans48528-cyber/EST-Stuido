import {spawn} from 'child_process';
import {createHash} from 'crypto';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import {SparkError, validateSparkBytecode} from './protocol';

export const getSparkResourceRoot = () => {
    const roots = [typeof process.resourcesPath === 'string' ? path.join(process.resourcesPath, 'spark-ai') : null,
        path.resolve(process.cwd(), 'resources/spark-ai'), path.resolve(__dirname, '../../resources/spark-ai')];
    return roots.find(root => root && fs.existsSync(path.join(root, 'compiler-manifest.json')));
};

export class SparkCompiler {
    constructor ({root = getSparkResourceRoot(), executable = process.execPath,
        tempRoot = os.tmpdir(), timeoutMs = 20000} = {}) {
        this.root = root;
        this.executable = executable;
        this.tempRoot = tempRoot;
        this.timeoutMs = timeoutMs;
    }
    async compile (source, {signal} = {}) {
        if (typeof source !== 'string' || !source.trim() || source.includes('\0') ||
            Buffer.byteLength(source, 'utf8') > 262144) throw new SparkError('SPARK_SOURCE_INVALID');
        if (!this.root || process.platform !== 'win32' || process.arch !== 'x64') {
            throw new SparkError('SPARK_COMPILER_UNSUPPORTED');
        }
        if (signal && signal.aborted) throw new SparkError('SPARK_CANCELLED');
        const addon = path.join(this.root, 'win32-x64/pika_bytecode_gen.node');
        let manifest;
        let binary;
        try {
            manifest = await fs.readJson(path.join(this.root, 'compiler-manifest.json'));
            binary = await fs.readFile(addon);
        } catch (error) {
            throw new SparkError('SPARK_COMPILER_INVALID', error.message);
        }
        if (manifest.version !== '1.13.4' || binary.length !== manifest.bytes ||
            createHash('sha256').update(binary)
                .digest('hex') !== manifest.sha256) {
            throw new SparkError('SPARK_COMPILER_INVALID');
        }
        let directory;
        try {
            await fs.ensureDir(this.tempRoot);
            directory = await fs.mkdtemp(path.join(this.tempRoot, 'est-spark-'));
        } catch (error) {
            throw new SparkError('SPARK_COMPILE_FAILED', error.message);
        }
        try {
            await fs.writeFile(path.join(directory, 'program.py'), `${source.replace(/\r\n?/g, '\n')}\n`, 'utf8');
            await this.runWorker(directory, addon, signal);
            if (signal && signal.aborted) throw new SparkError('SPARK_CANCELLED');
            const bytes = await fs.readFile(path.join(directory, 'program.py.o'));
            validateSparkBytecode(bytes);
            return bytes;
        } catch (error) {
            if (error instanceof SparkError) throw error;
            throw new SparkError('SPARK_COMPILE_FAILED', error.message);
        } finally {
            // Only remove the unique directory this invocation created.
            const relative = path.relative(path.resolve(this.tempRoot), path.resolve(directory));
            if (!relative.startsWith('..') && !path.isAbsolute(relative) && /^est-spark-[^\\/]+$/.test(relative)) {
                await fs.remove(directory);
            }
        }
    }
    runWorker (directory, addon, signal) {
        return new Promise((resolve, reject) => {
            if (signal && signal.aborted) {
                reject(new SparkError('SPARK_CANCELLED')); return;
            }
            const child = spawn(this.executable, [path.join(this.root, 'compiler-worker.cjs'), addon], {
                cwd: directory,
                windowsHide: true,
                env: {...process.env, ELECTRON_RUN_AS_NODE: '1', NODE_OPTIONS: ''},
                stdio: ['ignore', 'pipe', 'pipe', 'ipc']
            });
            let response;
            let diagnostics = '';
            let failure;
            const abort = () => {
                failure = new SparkError('SPARK_CANCELLED'); child.kill();
            };
            const timeout = setTimeout(() => {
                failure = new SparkError('SPARK_COMPILE_TIMEOUT'); child.kill();
            }, this.timeoutMs);
            const output = bytes => {
                diagnostics = (diagnostics + bytes.toString('utf8')).slice(-4096);
            };
            child.stdout.on('data', output);
            child.stderr.on('data', output);
            child.on('message', message => {
                response = message;
            });
            child.on('error', error => {
                failure = new SparkError('SPARK_COMPILER_INVALID', error.message);
            });
            if (signal) {
                signal.addEventListener('abort', abort, {once: true});
                if (signal.aborted) abort();
            }
            child.on('close', code => {
                clearTimeout(timeout);
                if (signal) signal.removeEventListener('abort', abort);
                if (failure) {
                    reject(failure); return;
                }
                if (response && response.status === -14) {
                    reject(new SparkError('SPARK_COMPILE_SYNTAX', diagnostics)); return;
                }
                if (code !== 0 || !response || response.status !== 0) {
                    reject(new SparkError('SPARK_COMPILE_FAILED',
                        (response && response.error) || `${response && response.status}: ${diagnostics}`)); return;
                }
                resolve();
            });
        });
    }
}
