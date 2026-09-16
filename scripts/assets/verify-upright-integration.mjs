/** Canonical Cycle6 identity + immutable historical controls, source QA and reconstruction. */
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url),base=new URL('assets/source/western/contact-v2/',root),out=new URL('assets/source/western/upright-v2/',root),v2b=new URL('v2b/',base);
const read=async url=>JSON.parse(await fs.readFile(url,'utf8')),hash=async url=>crypto.createHash('sha256').update(await fs.readFile(url)).digest('hex');
const integration=await read(new URL('integration-manifest.json',out)),history=await read(new URL('history-resolution.json',out)),frozen=await read(new URL('frozen-cycle5.json',base));
const expectedAliases={'scripts/assets/build_upright.py':'assets/source/western/contact-v2/inputs/build_upright.py'};
for(const kind of ['lion','wolf','unicorn'])for(const [path,ext] of [[`assets/source/western/${kind}-upright.blend`,'blend'],[`public/assets/western/${kind}-upright.glb`,'glb']])expectedAliases[path]=`assets/source/western/contact-v2/control/${kind}-upright.${ext}`;
assert.deepEqual(history.aliases,expectedAliases);assert.equal(history.cycle5Commit,'f5cd5e683a848a40b45ab522c11099bd1fc38cb5');
for(const [path,expected] of Object.entries(frozen.files))assert.equal(await hash(new URL(expectedAliases[path]??path,root)),expected,`Cycle5/race ${path}`);
const diagnostic=await read(new URL('diagnostic-v2-snapshot.json',base));for(const [path,expected] of Object.entries(diagnostic.files))assert.equal(await hash(new URL(path,base)),expected,`Rejected v2 ${path}`);
const archived=await read(new URL('pre-promotion-files.json',out));for(const item of Object.values(archived))assert.equal(await hash(new URL(item.preserved,root)),item.sha256);
const evidence=await read(new URL('evidence.json',v2b));for(const [path,expected] of Object.entries(evidence.files))assert.equal(await hash(new URL(path,v2b)),expected,`Reviewed v2b ${path}`);
for(const [path,expected] of Object.entries(evidence.recipes))assert.equal(await hash(new URL(archived[path]?.preserved??path,root)),expected,`Reviewed recipe ${path}`);
const reproduction=await read(new URL('reproduction.json',out));for(const [path,expected] of Object.entries(reproduction.recipes))assert.equal(await hash(new URL(path,root)),expected,`Current reconstruction recipe ${path}`);
assert.equal(Object.keys(integration.canonicalFiles).length,6);
for(const [path,item] of Object.entries(integration.canonicalFiles)){assert.equal(await hash(new URL(path,root)),item.sha256,path);assert.equal(await hash(new URL(item.reviewed,root)),item.sha256,item.reviewed);}
const runtime=await read(new URL('runtime-inspection.json',out));
for(const kind of ['lion','wolf','unicorn']){
 const current=await read(new URL(`${kind}-manifest.json`,out)),reviewed=await read(new URL(`${kind}-manifest.json`,v2b)),source=await read(new URL(`${kind}-source-inspection.json`,out)),contact=await read(new URL(`${kind}-contact-source-inspection.json`,out)),repro=reproduction.species[kind];
 for(const key of ['sourceSha256','runtimeSha256']){assert.equal(current[key],reviewed[key]);assert.equal(runtime.species[kind][key],current[key]);assert.equal(source[key],current[key]);assert.equal(contact[key],current[key]);}
 assert.deepEqual(current.clips,reviewed.clips);assert.equal(source.topology.components,1);assert.equal(source.topology.nonManifoldEdges,0);assert.equal(Object.keys(source.clips).length,11);
 assert.equal(repro.canonicalSourceSha256,current.sourceSha256);assert.equal(repro.reviewedSourceSha256,reviewed.sourceSha256);assert.equal(repro.runtimeSha256,current.runtimeSha256);assert(repro.runtimeByteIdentical&&repro.sourceSemanticallyIdentical&&repro.sourceSemanticSha256);
}
console.log(`Six canonical upright files equal reviewed v2b; ${Object.keys(frozen.files).length} Cycle5/race/history files retained through explicit aliases; rejected v2 and 91 reviewed v2b artifacts intact.`);
console.log('Canonical source inspection, fresh reconstruction and approved QA hashes agree. Cinematic A2 remains open.');
console.log('UPRIGHT_CANONICAL_INTEGRITY_OK');
