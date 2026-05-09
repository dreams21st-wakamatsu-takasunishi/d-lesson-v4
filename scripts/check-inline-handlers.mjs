import { readFileSync } from 'node:fs';

const eventAttrs = ['onclick', 'onchange', 'oninput', 'onkeydown', 'onsubmit'];
const ignoredNames = new Set(['if', 'for', 'while', 'switch', 'function', 'return']);

function read(path) {
    return readFileSync(path, 'utf8');
}

function collectInlineHandlerCalls(html) {
    const names = new Set();

    eventAttrs.forEach(attr => {
        const attrPattern = new RegExp(`${attr}="([^"]*)"`, 'g');
        let attrMatch;

        while ((attrMatch = attrPattern.exec(html)) !== null) {
            const code = attrMatch[1];
            const callPattern = /([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
            let callMatch;

            while ((callMatch = callPattern.exec(code)) !== null) {
                const name = callMatch[1];
                const before = code[callMatch.index - 1] || '';
                if (before === '.' || ignoredNames.has(name)) continue;
                names.add(name);
            }
        }
    });

    return names;
}

function collectMainGlobals(source) {
    const names = new Set();
    const match = source.match(/const globalFunctions = \[([\s\S]*?)\];/);
    if (!match) return names;

    const identifiers = match[1].match(/\b[A-Za-z_$][A-Za-z0-9_$]*\b/g) || [];
    identifiers.forEach(name => names.add(name));
    return names;
}

function collectAdminExports(source) {
    const names = new Set();
    const exportPattern = /export\s+(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
    const namedExportPattern = /export\s*\{([\s\S]*?)\}\s*;/g;
    let match;

    while ((match = exportPattern.exec(source)) !== null) {
        names.add(match[1]);
    }

    while ((match = namedExportPattern.exec(source)) !== null) {
        match[1].split(',').forEach(part => {
            const item = part.trim();
            if (!item) return;
            const aliasMatch = item.match(/\bas\s+([A-Za-z_$][A-Za-z0-9_$]*)$/);
            if (aliasMatch) {
                names.add(aliasMatch[1]);
                return;
            }
            const nameMatch = item.match(/^([A-Za-z_$][A-Za-z0-9_$]*)$/);
            if (nameMatch) names.add(nameMatch[1]);
        });
    }

    return names;
}

function main() {
    const html = read('index.html');
    const globalFunctionsSource = read('src/app/global-functions.js');
    const adminSource = read('src/ui/admin.js');

    const calledNames = collectInlineHandlerCalls(html);
    const registeredNames = new Set([
        ...collectMainGlobals(globalFunctionsSource),
        ...collectAdminExports(adminSource)
    ]);

    const missing = Array.from(calledNames)
        .filter(name => !registeredNames.has(name))
        .sort();

    if (missing.length > 0) {
        console.error('Inline handler check failed. Missing global handlers:');
        missing.forEach(name => console.error(`- ${name}`));
        process.exit(1);
    }

    console.log(`Inline handler check passed: ${calledNames.size} handlers verified.`);
}

main();
