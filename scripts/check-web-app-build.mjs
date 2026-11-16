import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('https://example.invalid/d-lesson-v4/');
const html = readFileSync('dist/index.html', 'utf8');
const manifestHref = html.match(/<link rel="manifest" href="([^"]+)">/)?.[1];
const manifestUrl = new URL(manifestHref, root);
assert.equal(manifestUrl.href, new URL('manifest.webmanifest', root).href);

const manifest = JSON.parse(readFileSync('dist/manifest.webmanifest', 'utf8'));
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.name, 'Dレッスン');
assert.equal(manifest.short_name, manifest.name);
for (const key of ['start_url', 'scope']) {
    assert.ok(manifest[key], `manifest ${key} is required`);
    assert.equal(new URL(manifest[key], manifestUrl).href, root.href, `manifest ${key} stays under the Pages path`);
}
// With no explicit ID, the resolved start URL is the app identity.
assert.equal(manifest.id, undefined);

for (const size of [192, 512]) {
    const icon = manifest.icons.find(entry => entry.sizes === `${size}x${size}`);
    assert.ok(icon);
    assert.equal(icon.type, 'image/png');
    const iconUrl = new URL(icon.src, manifestUrl);
    assert.ok(iconUrl.href.startsWith(root.href));
    const data = readFileSync('dist/' + iconUrl.pathname.slice(root.pathname.length));
    assert.equal(data.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(data.readUInt32BE(16), size);
    assert.equal(data.readUInt32BE(20), size);
}

const appleIcon = html.match(/<link rel="apple-touch-icon" href="([^"]+)">/)?.[1];
assert.equal(new URL(appleIcon, root).href, new URL('app-icons/icon-192.png', root).href);
console.log('Web app build check passed: Pages paths, standalone launch and both PNG icons.');
