/** Read-only geometry/evidence oracle for isolated tail candidates. No art acceptance. */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {AnimationMixer,LoopOnce,Vector3} from 'three';
globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:256,height:256,close(){}});
const root=new URL('../../',import.meta.url),out=new URL('assets/source/western/revision2/tail-repair/',root);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),read=async u=>JSON.parse(await fs.readFile(u,'utf8'));
const freeze=await read(new URL('freeze.json',out));
for(const [path,h] of Object.entries(freeze.files))assert.equal(hash(await fs.readFile(new URL(path,root))),h,`Frozen canonical ${path}`);
if(process.argv.includes('--freeze')){console.log('TAIL_INPUTS_FROZEN');process.exit(0);}
const source=await read(new URL('source-verification.json',out));assert.deepEqual(source.issues,[]);
const manifest=await read(new URL('manifest.json',out));
const recipe=hash(await fs.readFile(new URL('scripts/assets/repair_tails.py',root)));assert.equal(source.recipeSha256,recipe);
if(!process.argv.includes('--geometry-only')){
 const reproduction=await read(new URL('reproduction.json',out));assert.equal(reproduction.recipeSha256,recipe);assert.equal(Object.keys(reproduction.records).length,6);
 for(const [key,row] of Object.entries(reproduction.records)){assert(row.runtimeByteIdentical&&row.sourceSemanticallyIdentical);assert.equal(row.runtimeSha256,manifest.records[key].runtimeSha256);}
}
const output={recipeSha256:recipe,records:{}};
async function inspect(kind,form,negative=false){
 const key=kind+'-'+form,base=kind+(form==='upright'?'-upright':''),bytes=await fs.readFile(new URL('candidate/'+base+'.glb',out));
 assert.equal(hash(bytes),manifest.records[key].runtimeSha256);assert.equal(source.records[key].runtimeSha256,hash(bytes));assert.equal(hash(await fs.readFile(new URL('candidate/'+base+'.blend',out))),source.records[key].sourceSha256);
 assert.deepEqual(source.records[key].topology,{components:1,boundaryEdges:0,nonManifoldEdges:0});assert(source.records[key].originalBodyAndShaftComponents>=2);assert(source.records[key].missingBridgeNegative.boundaryEdges>0);
 const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12))),triangles=doc.meshes.flatMap(m=>m.primitives).reduce((s,p)=>s+doc.accessors[p.indices].count/3,0),primitives=doc.meshes.flatMap(m=>m.primitives).length;
 assert(triangles<32000&&primitives<=8&&bytes.length<2000000,`${key} budget ${triangles}/${primitives}/${bytes.length}`);
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const mixer=new AnimationMixer(gltf.scene),meshes=[];gltf.scene.updateMatrixWorld(true);
 gltf.scene.traverse(o=>{if(!o.isSkinnedMesh)return;const pos=o.geometry.attributes.position,w=o.geometry.attributes.skinWeight,j=o.geometry.attributes.skinIndex,edges=new Map();
  const tail=i=>[0,1,2,3].some(c=>w.getComponent(i,c)>1e-7&&o.skeleton.bones[j.getComponent(i,c)].name.startsWith('tail_'));
  for(let i=0;i<pos.count;i++)assert(Math.abs([0,1,2,3].reduce((s,c)=>s+w.getComponent(i,c),0)-1)<.0001);
  const idx=o.geometry.index;
  for(let i=0;i<idx.count;i+=3){const v=[idx.getX(i),idx.getX(i+1),idx.getX(i+2)];for(let c=0;c<3;c++){const a=v[c],b=v[(c+1)%3];if(!tail(a)&&!tail(b))continue;const id=[a,b].sort((a,b)=>a-b).join('/');const d=new Vector3().fromBufferAttribute(pos,a).distanceTo(new Vector3().fromBufferAttribute(pos,b));if(d>1e-5)edges.set(id,{a,b,length:d});}}
  meshes.push({ob:o,edges:[...edges.values()]});});
 const clips={};
 for(const clip of gltf.animations){
  mixer.stopAllAction();mixer.setTime(0);const a=mixer.clipAction(clip).reset().setLoop(LoopOnce,1);a.clampWhenFinished=true;a.play();let maxTailEdgeStretch=0;
  for(let i=0;i<=40;i++){
   mixer.setTime(clip.duration*i/40);
   if(negative)gltf.scene.getObjectByName('tail_0').position.z+=1;
   gltf.scene.updateMatrixWorld(true);
   for(const {ob,edges} of meshes){ob.skeleton.update();for(const e of edges){const p=ob.getVertexPosition(e.a,new Vector3()),q=ob.getVertexPosition(e.b,new Vector3());maxTailEdgeStretch=Math.max(maxTailEdgeStretch,p.distanceTo(q)/e.length);}}
  }
  assert(maxTailEdgeStretch<3.5,`${key}/${clip.name}: evaluated tail edge stretch ${maxTailEdgeStretch}`);clips[clip.name]={duration:clip.duration,maxTailEdgeStretch};
 }
 if(form==='upright'){
  const clip=gltf.animations.find(c=>c.name==='evade');mixer.stopAllAction();mixer.setTime(0);const action=mixer.clipAction(clip).reset().setLoop(LoopOnce,1);action.clampWhenFinished=true;action.play();const heights=[];
  for(const t of [0,clip.duration/2,clip.duration]){mixer.setTime(t);gltf.scene.updateMatrixWorld(true);heights.push(gltf.scene.getObjectByName('rear_paw_L').getWorldPosition(new Vector3()).y);}
  assert(heights[1]-heights[0]>.25&&Math.abs(heights[2]-heights[0])<.004,`${kind}: actual exported evade must lift and land`);clips.evade.pawPivotHeights=heights;
 }
 assert.deepEqual(Object.keys(clips).sort(),Object.keys(source.records[key].clips).sort());
 return {runtimeSha256:hash(bytes),sourceSha256:source.records[key].sourceSha256,triangles,primitives,bytes:bytes.length,clips};
}
for(const kind of ['lion','wolf','unicorn'])for(const form of ['race','upright'])output.records[kind+'-'+form]=await inspect(kind,form);
if(process.argv.includes('--negative-control')){let rejected=false;try{await inspect('lion','upright',true);}catch(error){assert.match(String(error.message),/evaluated tail edge stretch/,'Negative control must fail for actual distorted-tail geometry');rejected=true;output.distortedTailNegative={rejected:true,message:String(error.message)};}assert(rejected,'Distorted actual GLB tail must fail');}
if(process.argv.includes('--evidence')){
 const evidence=await read(new URL('motion-evidence.json',out)),samples=await read(new URL('motion-samples.json',out));assert.equal(evidence.recipeSha256,recipe);
 const framing=await read(new URL('qa-framing.json',out));assert.equal(framing.scriptSha256,hash(await fs.readFile(new URL('review_frames.py',out))));assert.equal(framing.geometryChanged,false);for(const [path,h] of Object.entries(framing.candidateUnchanged))assert.equal(hash(await fs.readFile(new URL('candidate/'+path,out))),h);
 const previews=await read(new URL('preview.json',out));assert.equal(previews.length,18);
 for(const row of previews){assert.equal(hash(await fs.readFile(new URL(row.path,root))),row.sha256);const [kind,form,name]=row.path.split('/qa/')[1].split('/'),base=kind+(form==='upright'?'-upright':'');assert.equal(hash(await fs.readFile(new URL(`${name.startsWith('candidate')?'candidate':'inputs'}/${base}.blend`,out))),row.sourceSha256);}
 assert.equal(samples.length,54,'All three race and six upright affected complete cycles for each species/control');
 for(const [path,h] of Object.entries(evidence.files))assert.equal(hash(await fs.readFile(new URL(path,root))),h);
 for(const row of samples){const base=row.species+(row.form==='upright'?'-upright':'');assert.equal(hash(await fs.readFile(new URL(`${row.variant}/${base}.blend`,out))),row.sourceSha256);}
 for(const row of samples.filter(r=>r.variant==='candidate')){
  const movie=new URL(`qa/${row.species}/${row.form}/${row.clip}-matched.mp4`,out);const result=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=width,height,nb_read_frames,r_frame_rate','-of','json',fileURLToPath(movie)],{encoding:'utf8'}));const s=result.streams[0];assert.equal(s.width,768);assert.equal(s.height,384);assert.equal(Number(s.nb_read_frames),row.frames);assert.equal(s.r_frame_rate,'15/1');
  const decode=spawnSync('ffmpeg',['-hide_banner','-v','warning','-xerror','-i',fileURLToPath(movie),'-f','null','-'],{encoding:'utf8',timeout:30000});assert.equal(decode.status,0,`Complete decode ${row.species}/${row.form}/${row.clip}: ${decode.stderr}`);assert.equal(decode.stderr.trim(),'','Decode must produce no warnings or errors');
 }
}
await fs.writeFile(new URL('runtime-verification.json',out),JSON.stringify(output,null,2)+'\n');
console.log(process.argv.includes('--evidence')&&process.argv.includes('--negative-control')?'TAIL_REPAIR_EVIDENCE_AND_NEGATIVE_OK':'TAIL_REPAIR_GEOMETRY_OK');
