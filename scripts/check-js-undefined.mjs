import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function collectJsFiles(dir) {
    const files = [];

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) files.push(...collectJsFiles(path));
        else if (entry.isFile() && path.endsWith('.js')) files.push(path);
    }

    return files;
}

function getTscCommand() {
    const localTsc = join('node_modules', 'typescript', 'bin', 'tsc');
    if (existsSync(localTsc)) return { command: process.execPath, prefixArgs: [localTsc] };

    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    return { command: npmCommand, prefixArgs: ['exec', '--yes', '--package', 'typescript', '--', 'tsc'] };
}

const files = collectJsFiles('src');
const { command, prefixArgs } = getTscCommand();
const args = [
    ...prefixArgs,
    '--allowJs',
    '--checkJs',
    '--noEmit',
    '--skipLibCheck',
    '--target',
    'ES2022',
    '--module',
    'ESNext',
    '--moduleResolution',
    'Bundler',
    '--lib',
    'DOM,ES2022',
    '--noImplicitAny',
    'false',
    '--strict',
    'false',
    ...files
];

const result = spawnSync(command, args, { encoding: 'utf8' });
const output = `${result.stdout || ''}${result.stderr || ''}`;
const undefinedDiagnostics = output
    .split(/\r?\n/)
    .filter(line => line.includes('TS2304') || line.includes('Cannot find name'));

if (result.error) {
    console.error(`Undefined name check failed to run: ${result.error.message}`);
    process.exit(1);
}

if (undefinedDiagnostics.length > 0) {
    console.error('Undefined name check failed:');
    undefinedDiagnostics.forEach(line => console.error(`- ${line}`));
    process.exit(1);
}

console.log(`Undefined name check passed: ${files.length} source files scanned.`);
