// Separate loopback-only inspection server. No production route or control hook.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
const root = process.cwd(), publicRoot = resolve(root, 'public');
const candidate = process.argv[2] ? resolve(root, process.argv[2]) : null;
if (candidate && !candidate.startsWith(resolve(root, 'assets/source/western') + sep)) throw new Error('Candidate must be a local western source directory');
const bundled = await build({ entryPoints: [resolve(root, 'scripts/qa/contact-preview.ts')], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2020', logLevel: 'warning' });
const bundle = bundled.outputFiles[0].contents;
const files = ['src/championship/renderer.ts', 'src/championship/simulation.ts', 'src/championship/course.ts', 'src/championship/rivalry-effects.ts', 'src/championship/environment.ts', 'src/championship/framing.ts', 'scripts/qa/contact-preview.ts'];
const hashes = {};
const assetFiles = {};
for (const file of files) hashes[file] = createHash('sha256').update(await readFile(resolve(root, file))).digest('hex');
for (const animal of ['lion', 'wolf', 'unicorn']) for (const suffix of ['', '-upright']) {
  let file = resolve(publicRoot, `assets/western/${animal}${suffix}.glb`);
  if (candidate) {
    const proposed = resolve(candidate, `${animal}${suffix}.glb`);
    try { await access(proposed); file = proposed; }
    catch (error) { if (error.code !== 'ENOENT' || suffix) throw error; }
  }
  assetFiles[`${animal}${suffix}`] = file;
  hashes[file.slice(root.length + 1)] = createHash('sha256').update(await readFile(file)).digest('hex');
}
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Animal Racers — local contact inspection</title><style>*{box-sizing:border-box}html,body{margin:0;background:#17120f;color:#f9e4bf;font:13px system-ui}canvas{display:block;width:100vw;height:72vh}form{padding:12px;display:flex;gap:9px;align-items:end;flex-wrap:wrap}strong,output{width:100%}label{display:grid;gap:3px}select,input,button{font:inherit;padding:6px;background:#30231c;color:#fff0d0;border:1px solid #795d3a;border-radius:4px}input{width:100px}button{cursor:pointer}</style></head><body><script type="module" src="/bundle.js"></script></body></html>`;
createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost:3015');
    if (req.method === 'POST' && url.pathname === '/capture') {
      if (req.headers.origin !== 'http://localhost:3015') { res.writeHead(403); res.end(); return; }
      const settings = JSON.parse(url.searchParams.get('settings') ?? '{}');
      let size = 0; const chunks = [];
      for await (const chunk of req) { size += chunk.length; if (size > 8 * 1024 * 1024) throw new Error('Image too large'); chunks.push(chunk); }
      const bytes = Buffer.concat(chunks);
      if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('PNG required');
      const directory = resolve(root, 'docs/production/evidence/contact-inspection');
      await mkdir(directory, { recursive: true });
      const name = `contact-${Date.now()}`;
      await writeFile(resolve(directory, name + '.png'), bytes, { flag: 'wx' });
      await writeFile(resolve(directory, name + '.json'), JSON.stringify({ kind: 'local-pose-inspection-not-gameplay', settings, hashes, pngSha256: createHash('sha256').update(bytes).digest('hex') }, null, 2) + '\n', { flag: 'wx' });
      res.writeHead(201); res.end(name); return;
    }
    if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
    if (url.pathname === '/') { res.setHeader('Content-Type', 'text/html'); res.end(html); return; }
    if (url.pathname === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle); return; }
    if (url.pathname.startsWith('/assets/')) {
      let file = resolve(publicRoot, '.' + decodeURIComponent(url.pathname));
      if (!file.startsWith(publicRoot + sep)) throw new Error('Invalid path');
      const animal = /^\/assets\/western\/((?:lion|wolf|unicorn)(?:-upright)?)\.glb$/.exec(url.pathname)?.[1];
      if (animal) file = assetFiles[animal];
      res.setHeader('Content-Type', file.endsWith('.glb') ? 'model/gltf-binary' : 'image/webp');
      res.end(await readFile(file)); return;
    }
    res.writeHead(404); res.end();
  } catch { res.writeHead(400); res.end('Invalid local inspection request'); }
}).listen(3015, '127.0.0.1', () => console.log('Local contact inspection http://localhost:3015; candidate=' + (candidate ?? 'canonical')));
