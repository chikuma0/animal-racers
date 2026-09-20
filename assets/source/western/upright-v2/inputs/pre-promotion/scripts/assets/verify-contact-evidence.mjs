/** Read-only integrity/coverage check for the isolated Cycle6 v2b handoff. */
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../../',import.meta.url),base=new URL('assets/source/western/contact-v2/',root),out=new URL('v2b/',base);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
for(const [manifest,where] of [['frozen-cycle5.json',root],['diagnostic-v2-snapshot.json',base]]){
 const record=await read(new URL(manifest,base));for(const [path,expected] of Object.entries(record.files))assert.equal(hash(await fs.readFile(new URL(path,where))),expected,path);
}
const bounds=await read(new URL('contact-comparison.json',out)),runtime=await read(new URL('runtime-inspection.json',out));
let frames=0,pages=0;
for(const kind of ['lion','wolf','unicorn']){
 const m=await read(new URL(`${kind}-manifest.json`,out)),s=await read(new URL(`${kind}-source-inspection.json`,out)),qa=new URL(`qa/${kind}/`,out),q=await read(new URL('review-index.json',qa));
 for(const [field,ext] of [['sourceSha256','blend'],['runtimeSha256','glb']]){
  assert.equal(hash(await fs.readFile(new URL(`candidate/${kind}-upright.${ext}`,out))),m[field]);for(const r of [s,runtime.species[kind],q.hashes])assert.equal(r[field],m[field]);
 }
 assert.equal(bounds.species[kind].candidate.sha256,m.runtimeSha256);assert(s.unchangedV2ConnectedBody&&s.unchangedV2ActionsSha256);assert.equal(s.bodyTopology.components,1);assert.equal(s.bodyTopology.nonManifoldEdges,0);
 assert.equal(Object.keys(s.clips).length,11);assert(Object.keys(s.faceIdentity).length>5);assert(Object.keys(s.attachments).length>=4);
 for(const [view,record] of Object.entries(q.views)){
  const expectedClips=['attack','guard','defeat','celebrate',...(kind==='wolf'?['special']:[])];assert.deepEqual(record.clips.map(c=>c.clip),expectedClips);
  let frameCount=0;
  for(const clip of record.clips){
   const end=Math.round(m.clips[clip.clip]*30)+1,expected=[...new Set([...Array.from({length:Math.ceil(end/2)},(_,i)=>1+i*2),end])].sort((a,b)=>a-b);
   assert.deepEqual(clip.sourceFrames,expected);frameCount+=expected.length;await fs.access(new URL(`${view}-${clip.clip}-full-cycle.png`,qa));pages++;
  }
  const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=nb_frames,width,height,r_frame_rate','-of','json',fileURLToPath(new URL(record.movie,qa))],{encoding:'utf8'}));
  assert.equal(Number(probe.streams[0].nb_frames),frameCount);assert.equal(probe.streams[0].width,640);assert.equal(probe.streams[0].height,320);assert.equal(probe.streams[0].r_frame_rate,'15/1');frames+=frameCount;
  for(const clip of ['fight_idle','attack','guard','celebrate','defeat','special'])await fs.access(new URL(`${view}-${clip}-comparison.png`,qa));
 }
}
assert.equal(frames,468);assert.equal(pages,26);
console.log(`Frozen production and rejected diagnostic intact; 3 source/runtime pairs; 6 movies, ${pages} full-cycle pages, ${frames} paired frames.`);
console.log('CONTACT_EVIDENCE_INTEGRITY_OK');
