// Revision-linked gameplay build fingerprint; excludes private environment values.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const destination = process.argv[2];
if (!destination) throw new Error('Usage: node scripts/qa/fingerprint.mjs <new-output.json>');
const root = process.cwd();
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function walk(directory) {
  const paths = [];
  for (const entry of await readdir(resolve(root, directory), { withFileTypes: true })) {
    const name = directory + '/' + entry.name;
    if (entry.isDirectory()) paths.push(...await walk(name));
    else if (entry.isFile()) paths.push(name);
  }
  return paths;
}
const names = ['package.json', 'package-lock.json', 'next.config.mjs', ...await walk('src'), ...await walk('public/assets/western'), ...await walk('public/assets/environment')].sort();
const files = {};
for (const name of names) files[name.split(sep).join('/')] = hash(await readFile(resolve(root, name)));
const manifest = {
  baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceFingerprint: hash(JSON.stringify(files)),
  fingerprintMethod: 'SHA256 of JSON.stringify(sorted path-to-hash object)',
  reportRevisionLabel: 'local-working-tree',
  files,
};
await writeFile(resolve(root, destination), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
console.log(`${relative(root, resolve(root, destination))}: ${manifest.sourceFingerprint}`);
