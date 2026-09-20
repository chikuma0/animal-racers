import fs from 'node:fs/promises';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const root=new URL('../../../../',import.meta.url),out=new URL('assets/source/western/hero-art-v1/',root),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=async p=>JSON.parse(await fs.readFile(new URL(p,out),'utf8'));const m=await read('final-study-manifest.json'),f=await read('frozen-inputs.json');
assert(m.status.startsWith('FAIL'));assert(m.motion.startsWith('Not rendered.'));assert.equal(m.sourceInspectionComplete,true);const r=await read('runtime-inspection.json');assert.equal(r.failures.length,0);assert.equal(hash(await fs.readFile(new URL('runtime-inspection.json',out))),m.runtimeInspectionSha256);assert.equal(hash(await fs.readFile(new URL('negative-inspection.json',out))),m.negativeInspectionSha256);
for(const [p,h] of Object.entries(f.files))assert.equal(hash(await fs.readFile(new URL(p,root))),h,p);
assert.equal(hash(await fs.readFile(new URL('scripts/assets/experiment_hero.py',root))),m.sourceRecipeSha256);
for(const [form,v] of Object.entries(m.forms)){
 assert.equal(hash(await fs.readFile(new URL(`candidate/lion-${form}.blend`,out))),v.sourceSha256);assert.equal(r.forms[form].sha256,v.runtimeSha256);const source=await read(`${form}-source-inspection.json`);assert.equal(source.sourceSha256,v.sourceSha256);assert.equal(source.scriptSha256,m.sourceRecipeSha256);assert.equal(hash(await fs.readFile(new URL(`${form}-source-inspection.json`,out))),m.sourceInspectionCurrent[form].reportSha256);assert.equal(source.skullConnectedComponents.length,1);assert.deepEqual(source.skullBoundaryLoops,[64,64]);
 const b=await fs.readFile(new URL(`candidate/lion-${form}.glb`,out));assert.equal(hash(b),v.runtimeSha256);assert.equal(b.length,v.bytes);
 const d=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString()),ps=d.meshes.flatMap(m=>m.primitives);assert.equal(ps.length,v.primitives);assert.equal(ps.reduce((n,p)=>n+d.accessors[p.indices].count/3,0),v.triangles);
 assert(v.triangles<=32000&&v.primitives<=24&&v.bytes<2000000);assert.equal(Object.keys(v.matchedViews).length,6);
 for(const i of Object.values(v.matchedViews))assert.equal(hash(await fs.readFile(new URL(i.path,root))),i.sha256);
}
for(const name of ['README.md','RECONSTRUCTION-DIAGNOSIS.md','rejected-helmet-pass/REJECTION.md','rejected-radial-study/REJECTION.md'])assert((await fs.readFile(new URL(name,out),'utf8')).trim().length>100);
console.log('REJECTED_HERO_STUDY_INTEGRITY_OK — sources, exports, paired views and canonical freeze match; visual acceptance FAIL, current source inspection verified.');
