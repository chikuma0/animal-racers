/** Resolve explicit canonical repair provenance without rewriting historical manifests. */
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
export async function canonicalRoster(root){
 const bytes=p=>fs.readFile(new URL(p,root)),read=async p=>JSON.parse(await bytes(p)),sha=async p=>digest(await bytes(p));
 const release=await read('public/assets/western/roster-v2.json');
 assert.equal(release.recipeSha256,await sha(release.recipe));assert.equal(Object.keys(release.files).length,12);
 const original='assets/source/western/revision2/',repair=original+'tail-repair/';
 let candidate=original+'candidate/';
 if(release.repair){
  assert.equal(release.version,'revision2-tail-repair-1');candidate=repair+'candidate/';
  for(const ref of [release.repair.previousReceipt,release.repair.manifest,release.repair.review])assert.equal(await sha(ref.path),ref.sha256);
  assert.equal(release.repair.recipeSha256,await sha(release.repair.recipe));
  const previous=await read(release.repair.previousReceipt.path),manifest=await read(release.repair.manifest.path),promotion=await read(release.promotionReceipt);
  assert.deepEqual(promotion.release,release);assert.equal(promotion.releaseSha256,await sha('public/assets/western/roster-v2.json'));
  assert.equal(manifest.recipeSha256,release.repair.recipeSha256);
  for(const [p,h] of Object.entries(previous.files)){const name=p.split('/').at(-1);assert.equal(await sha(original+'candidate/'+name),h);assert.equal(await sha(repair+'inputs/'+name),h);}
  for(const [key,row] of Object.entries(manifest.records)){const name=key.replace('-race','');assert.equal(release.files[`public/assets/western/${name}.glb`],row.runtimeSha256);assert.equal(release.files[`assets/source/western/${name}.blend`],row.sourceSha256);}
 }
 for(const [p,h] of Object.entries(release.files)){assert.equal(await sha(p),h,`Canonical ${p}`);assert.equal(await sha(candidate+p.split('/').at(-1)),h,`Approved source ${p}`);}
 return release;
}
export async function canonicalManifest(root,kind,form,original){
 const release=await canonicalRoster(root);if(!release.repair)return original;
 const name=kind+(form==='upright'?'-upright':'');
 return {...original,runtimeSha256:release.files[`public/assets/western/${name}.glb`],sourceSha256:release.files[`assets/source/western/${name}.blend`],tailRepaired:true,clips:{...original.clips,...(form==='upright'?{evade:original.evadeDuration}:{})}};
}
