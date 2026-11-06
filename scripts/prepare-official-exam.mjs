import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { resolve, join, relative, extname, dirname } from 'node:path';
import { createHash } from 'node:crypto';

const source = resolve(process.argv[2] || '../文章入力スピード認定試験アプリ');
const target = resolve('public/official-exam');
if (source === target || target.startsWith(source + '/')) throw Error('Source and output must be separate.');
const allowed = new Set(['.html', '.js', '.css', '.png', '.jpg', '.gif', '.woff', '.woff2', '.ttf', '.otf']);
const files = [];
function copy(directory) {
    for (const entry of readdirSync(directory)) {
        const file = join(directory, entry);
        if (statSync(file).isDirectory()) { copy(file); continue; }
        if (!allowed.has(extname(file).toLowerCase())) continue;
        const path = relative(source, file);
        const output = join(target, path);
        mkdirSync(dirname(output), { recursive: true });
        const data = readFileSync(file);
        if (extname(file) === '.html') {
            // Only transport adaptation: file: resources become same-origin HTTP resources.
            const bootstrap = `<meta name="referrer" content="no-referrer"><script>if(location.hash.startsWith('#identity=')){history.replaceState(null,'',location.pathname+'?'+decodeURIComponent(location.hash.slice(10)));}(()=>{const add=window.addEventListener,remove=window.removeEventListener,unload=[];window.addEventListener=function(type,listener,options){if(type==='beforeunload')unload.push([listener,options]);return add.call(this,type,listener,options);};window.__dlessonReleaseUnload=()=>{for(const [listener,options] of unload)remove.call(window,'beforeunload',listener,options);unload.length=0;};})();</script>`;
            const html = data.toString('utf8').replaceAll('src="file:./', 'src="./').replace('<head>', '<head>\n' + bootstrap);
            writeFileSync(output, html);
        } else copyFileSync(file, output);
        files.push({ path: path.replaceAll('\\', '/'), sourceSha256: createHash('sha256').update(data).digest('hex') });
    }
}
copy(source);
if (!files.some(file => file.path === 'start.html') || !files.some(file => file.path === 'editor-jp/cert-editor-jp_CR.html')) throw Error('Official source is incomplete.');
writeFileSync(join(target, 'source-manifest.json'), JSON.stringify({ permissionConfirmedOn: '2026-11-05', changes: ['HTML file resource URLs', 'client-only identity fragment conversion', 'parent-authorized unload listener cleanup'], files }, null, 2));
console.log(`Prepared ${files.length} official files. Original source was not modified.`);
