import https from 'node:https';
import http from 'node:http';

const DEFAULT_PUBLIC_URL = 'https://dreams21st-wakamatsu-takasunishi.github.io/d-lesson-v4/';

const args = process.argv.slice(2);
const argUrl = args.find(arg => arg.startsWith('--url='))?.slice('--url='.length)
    || args.find(arg => !arg.startsWith('--'));
const expectedTable = args.find(arg => arg.startsWith('--expect-table='))?.slice('--expect-table='.length);
const expectedSha = args.find(arg => arg.startsWith('--expect-sha='))?.slice('--expect-sha='.length);
const requireProductionFlags = args.includes('--production');
const retryCount = Number.parseInt(args.find(arg => arg.startsWith('--retries='))?.slice('--retries='.length) || '0', 10);
const retryDelayMs = Number.parseInt(args.find(arg => arg.startsWith('--retry-delay-ms='))?.slice('--retry-delay-ms='.length) || '5000', 10);
const publicUrl = argUrl || process.env.D_LESSON_PUBLIC_URL || DEFAULT_PUBLIC_URL;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function requestText(url, redirectsLeft = 5) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const client = parsedUrl.protocol === 'http:' ? http : https;

        const req = client.get(parsedUrl, response => {
            const statusCode = response.statusCode || 0;
            const location = response.headers.location;

            if (statusCode >= 300 && statusCode < 400 && location) {
                response.resume();
                if (redirectsLeft <= 0) {
                    reject(new Error(`${url} exceeded redirect limit.`));
                    return;
                }
                resolve(requestText(new URL(location, parsedUrl).toString(), redirectsLeft - 1));
                return;
            }

            if (statusCode < 200 || statusCode >= 300) {
                response.resume();
                reject(new Error(`${url} returned HTTP ${statusCode}`));
                return;
            }

            response.setEncoding('utf8');
            let text = '';
            response.on('data', chunk => { text += chunk; });
            response.on('end', () => {
                resolve({
                    url: parsedUrl.toString(),
                    text
                });
            });
        });

        req.setTimeout(20000, () => {
            req.destroy(new Error(`${url} timed out.`));
        });
        req.on('error', reject);
    });
}

function collectAssetUrls(html, baseUrl) {
    const urls = new Set();
    const attrPattern = /\b(?:src|href)="([^"]+)"/g;
    let match;

    while ((match = attrPattern.exec(html)) !== null) {
        const value = match[1];
        if (!/\.(?:js|css|svg)(?:\?|$)/.test(value)) continue;
        urls.add(new URL(value, baseUrl).toString());
    }

    return Array.from(urls).sort();
}

function checkRelativeAssetPaths(html, failures) {
    const absoluteAssetRefs = html.match(/\b(?:src|href)="\/(?:assets|favicon\.svg)[^"]*"/g) || [];
    absoluteAssetRefs.forEach(ref => {
        failures.push(`Asset path must be relative for GitHub Pages subpath deployment: ${ref}`);
    });
}

function checkProductionBundle(combinedJs, failures) {
    if (!combinedJs.includes('-d-lesson-auth-token')) {
        failures.push('Public bundle must use the D Lesson Supabase auth storage key.');
    }

    if (!/\bskipAutoInitialize\s*:\s*(?:true|!0)\b/.test(combinedJs)) {
        failures.push('Public bundle must skip automatic Supabase auth recovery before the app auth gate runs.');
    }

    if (combinedJs.match(/\bALLOW_LEGACY_ADMIN_PASS\s*=\s*true\b/)) {
        failures.push('Public bundle allows legacy admin password.');
    }

    const legacyPass = combinedJs.match(/\bLEGACY_ADMIN_PASS\s*=\s*"([^"]*)"/)?.[1];
    if (legacyPass) {
        failures.push('Public bundle contains VITE_LEGACY_ADMIN_PASS.');
    }
}

async function runCheck() {
    const failures = [];
    const { url: resolvedUrl, text: html } = await requestText(publicUrl);

    checkRelativeAssetPaths(html, failures);

    const assetUrls = collectAssetUrls(html, resolvedUrl);
    if (assetUrls.length === 0) {
        failures.push('No JS/CSS/SVG assets were found in the public HTML.');
    }

    const jsAssetTexts = [];
    for (const assetUrl of assetUrls) {
        try {
            const { text } = await requestText(assetUrl);
            if (text.length === 0) failures.push(`${assetUrl} returned an empty response.`);
            if (/\.js(?:\?|$)/.test(assetUrl)) jsAssetTexts.push({ assetUrl, text });
        } catch (err) {
            failures.push(err.message);
        }
    }

    const combinedJs = jsAssetTexts.map(asset => asset.text).join('\n');
    const targetTable = combinedJs.match(/\bTARGET_TABLE\s*=\s*"([^"]+)"/)?.[1];
    if (expectedTable && targetTable !== expectedTable) {
        failures.push(`Expected public bundle TARGET_TABLE to be "${expectedTable}", but found "${targetTable || 'unknown'}".`);
    }

    const buildCommit = combinedJs.match(/\bBUILD_COMMIT\s*=\s*"([^"]+)"/)?.[1];
    if (expectedSha && buildCommit !== expectedSha) {
        failures.push(`Expected public bundle BUILD_COMMIT to be "${expectedSha}", but found "${buildCommit || 'unknown'}".`);
    }

    if (requireProductionFlags) {
        checkProductionBundle(combinedJs, failures);
    }

    if (failures.length > 0) {
        throw new Error(failures.join('\n'));
    }

    return {
        assetCount: assetUrls.length,
        buildCommit,
        resolvedUrl,
        targetTable
    };
}

async function main() {
    let lastError = null;
    const attempts = Number.isFinite(retryCount) && retryCount > 0 ? retryCount + 1 : 1;
    const delayMs = Number.isFinite(retryDelayMs) && retryDelayMs > 0 ? retryDelayMs : 5000;

    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            const result = await runCheck();
            console.log(`Public URL check passed: ${result.resolvedUrl}`);
            console.log(`Verified assets: ${result.assetCount}`);
            if (result.targetTable) console.log(`Public bundle table: ${result.targetTable}`);
            if (result.buildCommit) console.log(`Public bundle commit: ${result.buildCommit}`);
            return;
        } catch (err) {
            lastError = err;
            if (attempt < attempts) {
                console.warn(`Public URL check attempt ${attempt}/${attempts} failed. Retrying in ${delayMs}ms.`);
                await sleep(delayMs);
            }
        }
    }

    console.error('Public URL check failed:');
    String(lastError?.message || lastError)
        .split('\n')
        .filter(Boolean)
        .forEach(message => console.error(`- ${message}`));
    process.exit(1);
}

main();
