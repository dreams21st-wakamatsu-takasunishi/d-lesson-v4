import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve('.');
const targets = ['index.html', 'src'];
const blockedPatterns = [
    { pattern: /\bpassword-modal\b/, label: 'password modal markup' },
    { pattern: /\bshowPasswordModal\b/, label: 'legacy password modal function' },
    { pattern: /\bsubmitPassword\b/, label: 'legacy password submit handler' },
    { pattern: /\bclosePasswordModal\b/, label: 'legacy password close handler' },
    { pattern: /\bhasLegacyAdminPass\b/, label: 'legacy admin password fallback' },
    { pattern: /\bverifyLegacyAdminPass\b/, label: 'legacy admin password verifier' },
    { pattern: /\bVITE_LEGACY_ADMIN_PASS\b/, label: 'legacy admin password env var' },
    { pattern: /\bVITE_ALLOW_LEGACY_ADMIN_PASS\b/, label: 'legacy admin password allow flag' }
];

function collectFiles(path) {
    const fullPath = resolve(root, path);
    const stat = statSync(fullPath);
    if (stat.isFile()) return [fullPath];

    const entries = readdirSync(fullPath, { withFileTypes: true });
    return entries.flatMap(entry => {
        const child = join(fullPath, entry.name);
        if (entry.isDirectory()) return collectFiles(child);
        if (entry.isFile() && /\.(js|html|css)$/.test(entry.name)) return [child];
        return [];
    });
}

const failures = [];

targets.flatMap(collectFiles).forEach(file => {
    const content = readFileSync(file, 'utf8');
    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
        blockedPatterns.forEach(({ pattern, label }) => {
            if (pattern.test(line)) {
                failures.push(`${relative(root, file)}:${index + 1} contains ${label}`);
            }
        });
    });
});

if (failures.length > 0) {
    console.error('Legacy password check failed:');
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exit(1);
}

console.log('Legacy password check passed: no legacy password UI or fallback references found.');
