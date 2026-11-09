/** Integrity of the immutable baseline, editable recipe, and complete motion receipts.
 * Actual GLB deformation is evaluated separately by verify-assets/verify-upright.
 * This receipt oracle does not certify cinematic appearance or phone performance.
 */
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {canonicalRoster} from './roster-provenance.mjs';
const root=new URL('../../',import.meta.url),out=new URL('assets/source/western/revision2/',root);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=async u=>JSON.parse(await fs.readFile(u,'utf8'));
const recipe=hash(await fs.readFile(new URL('scripts/assets/rebuild_roster_v2.py',root)));
const baseline=await read(new URL('baseline.json',out));assert.equal(baseline.commit,'f600be2');assert.equal(Object.keys(baseline.files).length,12);
for(const [path,expected] of Object.entries(baseline.files))assert.equal(hash(await fs.readFile(new URL('inputs/'+path.split('/').at(-1),out))),expected,`Frozen f600be2 input: ${path}`);
const reproduction=await read(new URL('reproduction.json',out));assert.equal(reproduction.recipeSha256,recipe);assert.equal(Object.keys(reproduction.records).length,6);
let clips=0,frames=0;
for(const kind of ['lion','wolf','unicorn'])for(const form of ['race','upright']){
 const key=kind+'-'+form,filename=kind+(form==='upright'?'-upright':'');
 const manifest=await read(new URL(key+'-manifest.json',out));
 if(process.argv.includes('--negative-control')&&key==='lion-race')manifest.runtimeSha256='0'.repeat(64);
 assert.equal(manifest.recipeSha256,recipe);assert.equal(hash(await fs.readFile(new URL(`candidate/${filename}.blend`,out))),manifest.sourceSha256);assert.equal(hash(await fs.readFile(new URL(`candidate/${filename}.glb`,out))),manifest.runtimeSha256);
 assert.equal(reproduction.records[key].runtimeSha256,manifest.runtimeSha256);assert.equal(reproduction.records[key].runtimeByteIdentical,true);assert.equal(reproduction.records[key].sourceSemanticallyIdentical,true);
 const source=await read(new URL(key+'-source-inspection.json',out));assert.equal(source.recipeSha256,recipe);assert.equal(source.sourceSha256,manifest.sourceSha256);assert.equal(source.runtimeSha256,manifest.runtimeSha256);
 assert.equal(source.continuousBodyTopology.components.length,1);assert.equal(source.continuousBodyTopology.boundaryEdges,0);assert.equal(source.continuousBodyTopology.nonManifoldEdges,0);
 assert.deepEqual(Object.keys(source.clips).sort(),Object.keys(manifest.clips).sort());
 for(const [name,clip] of Object.entries(source.clips)){assert(clip.frames>=Math.floor(clip.duration*30)+1,`${key}/${name}: full-frame source coverage`);assert(clip.torsoBounds_XForwardUp.min.every(Number.isFinite));}
 if(process.argv.includes('--source-only'))continue;
 const samples=await read(new URL(key+'-motion-samples.json',out)),evidence=await read(new URL(key+'-evidence.json',out));
 assert.equal(evidence.recipeSha256,recipe);assert.equal(evidence.sourceSha256,manifest.sourceSha256);assert.equal(evidence.runtimeSha256,manifest.runtimeSha256);
 assert.equal(samples.length,Object.keys(manifest.clips).length*2);
 for(const [path,expected] of Object.entries(evidence.files))assert.equal(hash(await fs.readFile(new URL(path,root))),expected,`Evidence changed: ${path}`);
 for(const [name,duration] of Object.entries(manifest.clips)){
  const pair=samples.filter(r=>r.clip===name);assert.equal(pair.length,2);
  const candidate=pair.find(r=>r.variant==='candidate'),control=pair.find(r=>r.variant==='control');assert(candidate&&control);assert.equal(candidate.frames,Math.ceil(duration*15)+1);assert.equal(control.frames,candidate.frames);assert.equal(candidate.sourceSha256,manifest.sourceSha256);
  assert.equal(control.sourceSha256,baseline.files[`assets/source/western/${filename}.blend`]);
  assert.equal(candidate.actualClip,name);assert.equal(control.actualClip,name==='evade'?'hit':name);
  const movie=new URL(`qa/${kind}/${form}/${name}-matched.mp4`,out);
  const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=width,height,nb_read_frames,r_frame_rate','-of','json',fileURLToPath(movie)],{encoding:'utf8',timeout:10000}));
  const stream=probe.streams[0];assert.equal(stream.width,768);assert.equal(stream.height,384);assert.equal(Number(stream.nb_read_frames),candidate.frames);assert.equal(stream.r_frame_rate,'15/1');clips++;frames+=candidate.frames;
 }
}
if(process.argv.includes('--canonical')){
 const release=await canonicalRoster(root);assert.equal(release.recipeSha256,recipe);
 console.log('REVISION2_CANONICAL_ROSTER_OK');
}else if(process.argv.includes('--source-only'))console.log('REVISION2_EDITABLE_REPRODUCED');
else console.log(`REVISION2_REVIEW_EVIDENCE_OK ${clips} complete matched cycles, ${frames} paired frames; cinematic review remains manual`);
