import {spawnSync} from 'child_process';
import fs from 'fs-extra';
import path from 'path';

const SYNTAX_CHECK_SCRIPT = [
    'import sys',
    'source = sys.stdin.buffer.read().decode("utf-8")',
    'try:',
    '    compile(source, "<est-program>", "exec")',
    'except SyntaxError as exc:',
    '    column = exc.offset or 0',
    '    print(f"{exc.msg} (line {exc.lineno}, column {column})", file=sys.stderr)',
    '    raise SystemExit(2)'
].join('\n');

const pythonCandidates = () => {
    const candidates = [];
    if (process.env.EST_PYTHON) {
        candidates.push({command: process.env.EST_PYTHON, args: []});
    }
    candidates.push({command: 'python', args: []});
    if (process.platform === 'win32') {
        candidates.push({command: 'py', args: ['-3']});
    }
    return candidates;
};

const mpyCrossCandidates = () => {
    const executableName = process.platform === 'win32' ? 'mpy-cross.exe' : 'mpy-cross';
    return [
        process.env.EST_MPY_CROSS,
        typeof process.resourcesPath === 'string' ?
            path.join(process.resourcesPath, 'est-firmware', 'tools', 'mpy-cross', executableName) : null,
        path.resolve(process.cwd(), 'resources', 'est-firmware', 'tools', 'mpy-cross', executableName),
        path.resolve(__dirname, '..', '..', '..', 'resources', 'est-firmware', 'tools', 'mpy-cross', executableName)
    ].filter(Boolean);
};

const findMpyCross = () => mpyCrossCandidates().find(candidate => fs.existsSync(candidate));

const validateWithMpyCross = (executable, sourceBuffer) => {
    const result = spawnSync(
        executable,
        ['-'],
        {
            input: sourceBuffer,
            maxBuffer: 2 * 1024 * 1024,
            timeout: 10000,
            windowsHide: true
        }
    );
    if (result.error) {
        return false;
    }
    if (result.status === 0) {
        return true;
    }
    const detail = Buffer.concat([
        Buffer.from(result.stderr || []),
        Buffer.from(result.stdout || [])
    ]).toString('utf8')
        .trim();
    if (/MemoryError/u.test(detail)) {
        throw new RangeError(`MicroPython 编译内存不足：${detail}`);
    }
    const lineMatch = detail.match(/line (\d+)/u);
    const lastLine = detail.split(/\r?\n/u)
        .filter(Boolean)
        .pop() || 'invalid Python source';
    const message = lastLine.replace(/^SyntaxError:\s*/u, '');
    const location = lineMatch ? ` (line ${lineMatch[1]})` : '';
    throw new SyntaxError(`MicroPython syntax error: ${message}${location}`);
};

export const validateMicroPythonSourceSyntax = source => {
    const sourceBuffer = typeof source === 'string' ? Buffer.from(source, 'utf8') : Buffer.from(source);
    const mpyCross = findMpyCross();
    if (mpyCross && validateWithMpyCross(mpyCross, sourceBuffer)) {
        return true;
    }
    const sourceText = sourceBuffer.toString('utf8');
    let lastFailure = null;
    for (const candidate of pythonCandidates()) {
        const result = spawnSync(candidate.command, [...candidate.args, '-c', SYNTAX_CHECK_SCRIPT], {
            input: Buffer.from(sourceText, 'utf8'),
            encoding: 'utf8',
            maxBuffer: 1024 * 1024,
            timeout: 10000,
            windowsHide: true
        });
        if (result.error && result.error.code === 'ENOENT') {
            continue;
        }
        if (result.status === 0) {
            return true;
        }
        if (result.status === 2) {
            const detail = String(result.stderr || '').trim();
            throw new SyntaxError(`MicroPython syntax error: ${detail || 'invalid Python source'}`);
        }
        lastFailure = result.error || new Error(String(result.stderr || result.stdout || '').trim());
    }
    const detail = lastFailure && lastFailure.message ? `: ${lastFailure.message}` : '';
    throw new Error(`Unable to run Python syntax check${detail}`);
};
