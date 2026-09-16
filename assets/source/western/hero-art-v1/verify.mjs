/** Independent exported geometry/bone-animation comparison for isolated Lion art. */
import fs from 'node:fs/promises';import crypto from 'node:crypto';import assert from 'node:assert/strict';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';import {AnimationMixer,LoopOnce,Box3,Vector3} from 'three';
globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:256,height:256,close(){}});
const root=new URL('../../../../',import.meta.url),out=new URL('assets/source/western/hero-art-v1/',root),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const frozen=JSON.parse(await fs.readFile(new URL('frozen-inputs.json',out),'utf8'));for(const [p,h]of Object.entries(frozen.files))assert.equal(hash(await fs.readFile(new URL(p,root))),h,p);
async function load(url){const bytes=await fs.readFile(url),doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());const g=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');return{bytes,doc,g,mixer:new AnimationMixer(g.scene)};}
function pose(o,clip,time){o.mixer.stopAllAction();o.mixer.setTime(0);const a=o.mixer.clipAction(o.g.animations.find(a=>a.name===clip)).reset().setLoop(LoopOnce,1);a.clampWhenFinished=true;a.play();o.mixer.setTime(time);o.g.scene.updateMatrixWorld(true);o.g.scene.traverse(m=>{if(m.isSkinnedMesh)m.skeleton.update();});}
function bones(o){const b={};o.g.scene.traverse(ob=>{if(ob.isBone)b[ob.name]=ob.matrixWorld.elements;});return b;}
function headBound(o){const box=new Box3(),p=new Vector3();o.g.scene.traverse(m=>{if(!m.isSkinnedMesh)return;const si=m.geometry.attributes.skinIndex,sw=m.geometry.attributes.skinWeight;for(let i=0;i<si.count;i++){const inds=[si.getX(i),si.getY(i),si.getZ(i),si.getW(i)],w=[sw.getX(i),sw.getY(i),sw.getZ(i),sw.getW(i)];if(inds.reduce((s,n,j)=>s+(['head','jaw'].includes(m.skeleton.bones[n].name)?w[j]:0),0)>=.5){m.getVertexPosition(i,p).applyMatrix4(m.matrixWorld);box.expandByPoint(p);}}});return {min:box.min.toArray(),max:box.max.toArray()};}
const negative=process.argv.includes('--negative');
function morphs(o){const arrays=[];o.g.scene.traverse(m=>{if(m.isSkinnedMesh&&m.morphTargetInfluences?.length)arrays.push(m.morphTargetInfluences);});return arrays[0]??[];}
const report={scope:'41 actual exported-skinned bound evaluations per clip; comparison of all existing bone animation matrices against canonical control. Texture decoding stub; visual approval separate.',forms:{}};let failures=[];
for(const form of ['race','upright']){
 const original=await load(new URL(`public/assets/western/lion${form==='upright'?'-upright':''}.glb`,root)),candidate=await load(new URL(`candidate/lion-${form}.glb`,out));
 if(negative&&form==='upright'){let changed=false;candidate.g.scene.traverse(m=>{if(changed||!m.isSkinnedMesh)return;const si=m.geometry.attributes.skinIndex,sw=m.geometry.attributes.skinWeight,p=m.geometry.attributes.position;for(let i=0;i<si.count&&!changed;i++)if(m.skeleton.bones[si.getX(i)].name==='head'&&sw.getX(i)>.99){p.setZ(i,p.getZ(i)+2);changed=true;}});assert(changed,'negative must modify an actual head vertex');}
 const d=candidate.doc,prims=d.meshes.flatMap(m=>m.primitives),triangles=prims.reduce((n,p)=>n+d.accessors[p.indices].count/3,0);
 if(triangles>32000||prims.length>24||candidate.bytes.length>2_000_000)failures.push(`${form} budget ${triangles} triangles/${prims.length} primitives/${candidate.bytes.length} bytes`);
 assert.deepEqual(candidate.g.animations.map(c=>c.name).sort(),original.g.animations.map(c=>c.name).sort());assert.equal(d.skins.length,1);
 let weightError=0;candidate.g.scene.traverse(m=>{if(m.isSkinnedMesh){const w=m.geometry.attributes.skinWeight;for(let i=0;i<w.count;i++)weightError=Math.max(weightError,Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1));}});assert(weightError<.00005);
 const clips={};let maxBoneError=0,maxMorphError=0;
 for(const clip of candidate.g.animations){
  const control=original.g.animations.find(c=>c.name===clip.name);assert(Math.abs(clip.duration-control.duration)<1e-6);const b=new Box3();
  for(let i=0;i<=40;i++){
   const t=clip.duration*i/40;pose(original,clip.name,t);pose(candidate,clip.name,t);const ox=morphs(original),cx=morphs(candidate);assert.equal(cx.length,ox.length);for(let j=0;j<ox.length;j++)maxMorphError=Math.max(maxMorphError,Math.abs(ox[j]-cx[j]));const x=bones(original),y=bones(candidate);assert.deepEqual(Object.keys(y).sort(),Object.keys(x).sort());
   for(const name of Object.keys(x))for(let j=0;j<16;j++)maxBoneError=Math.max(maxBoneError,Math.abs(x[name][j]-y[name][j]));
   candidate.g.scene.traverse(m=>{if(m.isSkinnedMesh){m.computeBoundingBox();b.union(m.boundingBox.clone().applyMatrix4(m.matrixWorld));}});
  }
  assert([...b.min,...b.max].every(Number.isFinite));if(b.min.y<-.20||b.max.y>4||b.max.z-b.min.z>5)failures.push(`${form} ${clip.name} bounds ${JSON.stringify(b)}`);clips[clip.name]={duration:clip.duration,min:b.min.toArray(),max:b.max.toArray()};
 }
 assert(maxMorphError<1e-6,`${form} body corrective changed`);
 assert(maxBoneError<1e-5,`${form} bone animation changed ${maxBoneError}`);
 const sweep=[];for(let i=0;i<=12;i++){const t=.18+i*.1/12;pose(candidate,'attack',t);sweep.push({time:t,...headBound(candidate)});}
 const headMaximum=Math.max(...sweep.map(s=>s.max[2]));if(form==='upright'&&headMaximum>.68)failures.push(`upright active contact head ${headMaximum}`);
 report.forms[form]={sha256:hash(candidate.bytes),bytes:candidate.bytes.length,triangles,primitives:prims.length,bones:d.skins[0].joints.length,maximumWeightError:weightError,maximumBoneMatrixError:maxBoneError,maximumMorphWeightError:maxMorphError,maximumActiveContactHeadForward:headMaximum,contactSweep:sweep,clips};
 console.log(`${form}: ${triangles} triangles, ${prims.length} primitives, ${candidate.bytes.length} bytes, active head ${headMaximum.toFixed(4)}, bone error ${maxBoneError}`);
}
report.failures=failures;await fs.writeFile(new URL(negative?'negative-inspection.json':'runtime-inspection.json',out),JSON.stringify(report,null,2)+'\n');if(negative){assert(failures.some(f=>f.startsWith('upright active contact head')));console.log('HERO_NEGATIVE_REJECTED');}else{assert.equal(failures.length,0,failures.join('; '));console.log('HERO_EXPORTED_CONTRACT_OK');}
