/** Independent checks of the three dedicated upright GLBs. Run alongside verify-assets.mjs. */
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {AnimationMixer,Box3,LoopOnce,Vector3} from 'three';
globalThis.self=globalThis;
globalThis.createImageBitmap=async()=>({width:256,height:256,close(){}});
const root=new URL('../../',import.meta.url), out=new URL('assets/source/western/upright-v2/',root);
const names=['transform','fight_idle','fight_move','attack','special','guard','hit','defeat','celebrate','jump','land'];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const report={scope:'Geometry-only texture stub; 41 actual skinned-bound evaluations per clip. These checks do not establish visual anatomy, absence of local intersections, or cinematic acceptance.',species:{}};
for(const kind of ['lion','wolf','unicorn']) {
 const bytes=await fs.readFile(new URL(`public/assets/western/${kind}-upright.glb`,root));
 const source=await fs.readFile(new URL(`assets/source/western/${kind}-upright.blend`,root));
 const manifest=JSON.parse(await fs.readFile(new URL(`${kind}-manifest.json`,out),'utf8'));
 assert.equal(hash(bytes),manifest.runtimeSha256);assert.equal(hash(source),manifest.sourceSha256);
 const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
 assert.deepEqual(doc.animations.map(a=>a.name).sort(),[...names].sort());
 assert(doc.skins.length===1 && doc.skins[0].joints.length===25);
 const primitives=doc.meshes.flatMap(m=>m.primitives),triangles=primitives.reduce((n,p)=>n+doc.accessors[p.indices].count/3,0);
 assert(triangles<32000 && primitives.length<=24 && bytes.length<2_000_000,`${kind}: budget`);
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const mixer=new AnimationMixer(gltf.scene),point=name=>gltf.scene.getObjectByName(name).getWorldPosition(new Vector3());
 const getBone=name=>{const b=gltf.scene.getObjectByName(name);assert(b?.isBone,name);return b;};
 for(const [child,parent] of Object.entries({spine:'pelvis',chest:'spine',neck:'chest',head:'neck',jaw:'head',scapula_L:'chest',scapula_R:'chest',front_upper_L:'scapula_L',front_upper_R:'scapula_R',rear_upper_L:'pelvis',rear_upper_R:'pelvis'}))assert.equal(getBone(child).parent.name,parent);
 let weightCount=0;
 gltf.scene.traverse(ob=>{if(ob.isSkinnedMesh){const w=ob.geometry.attributes.skinWeight;for(let i=0;i<w.count;i++){assert(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)<.00005);weightCount++;}}});
 gltf.scene.updateMatrixWorld(true);
 const restLengths={};
 for(const side of ['L','R'])for(const family of ['front','rear'])for(const section of ['upper','lower']){
  const name=`${family}_${section}_${side}`,b=getBone(name),child=b.children.find(c=>c.isBone);assert(child);
  restLengths[name]=point(name).distanceTo(point(child.name));
 }
 const clips={};
 const start=clip=>{mixer.stopAllAction();mixer.setTime(0);const action=mixer.clipAction(clip).reset().setLoop(LoopOnce,1);action.clampWhenFinished=true;action.play();return action;};
 for(const clip of gltf.animations){
  assert(Math.abs(clip.duration-manifest.clips[clip.name])<1/30+.0001,`${kind} ${clip.name}: native duration`);
  start(clip);const bounds=new Box3();let limbLengthError=0,footDrift=0,firstFeet;
  for(let i=0;i<=40;i++){
   mixer.setTime(clip.duration*i/40);
   if(process.argv.includes('--negative-control'))getBone('front_upper_L').scale.y*=3;
   gltf.scene.updateMatrixWorld(true);
   gltf.scene.traverse(ob=>{if(ob.isSkinnedMesh){ob.skeleton.update();ob.computeBoundingBox();bounds.union(ob.boundingBox.clone().applyMatrix4(ob.matrixWorld));}});
   for(const [name,rest] of Object.entries(restLengths)){const b=getBone(name),child=b.children.find(c=>c.isBone);limbLengthError=Math.max(limbLengthError,Math.abs(point(name).distanceTo(point(child.name))-rest));}
   const feet=['rear_paw_L','rear_paw_R'].map(point);
   if(!firstFeet)firstFeet=feet;else feet.forEach((v,j)=>footDrift=Math.max(footDrift,v.distanceTo(firstFeet[j])));
  }
  const size=bounds.getSize(new Vector3());assert([...bounds.min,...bounds.max].every(Number.isFinite));
  assert(size.x<3 && size.y<3.5 && size.z<3 && bounds.min.y>-.12,`${kind} ${clip.name}: geometry bounds ${JSON.stringify({min:bounds.min.toArray(),max:bounds.max.toArray()})}`);
  assert(limbLengthError<.003,`${kind} ${clip.name}: fixed limb length`);
  if(!['fight_move','jump'].includes(clip.name))assert(footDrift<.003,`${kind} ${clip.name}: planted rear paws`);
  clips[clip.name]={duration:clip.duration,min:bounds.min.toArray(),max:bounds.max.toArray(),maximumLimbLengthError:limbLengthError,maximumRearPawPivotDrift:footDrift};
 }
 start(gltf.animations.find(c=>c.name==='fight_move'));
 const sample=(t,bone)=>{mixer.setTime(t);gltf.scene.updateMatrixWorld(true);return point(bone);};
 const a=sample(.04,'rear_paw_L'),b=sample(.14,'rear_paw_L'),velocity=b.clone().sub(a).divideScalar(.1);
 assert(Math.abs(velocity.z+3.6)<.02 && Math.abs(velocity.y)<.01,`${kind}: backward planted shuffle at 3.6 m/s`);
 start(gltf.animations.find(c=>c.name==='celebrate'));
 const cup=sample(.5,'front_paw_L');assert(cup.distanceTo(new Vector3(.37,2.50,.43))<.001,`${kind}: cup handle pivot`);
 const halfway=sample(.175,'front_paw_L');assert(Math.abs(halfway.y-(1.49+2.5)/2)<.012,`${kind}: 0.35 s smoothstep lift`);
 start(gltf.animations.find(c=>c.name==='jump'));const jumpStart=sample(0,'rear_paw_L'),jumpPeak=sample(.4,'rear_paw_L');assert(jumpPeak.y-jumpStart.y>.15,`${kind}: local jump tuck`);
 start(gltf.animations.find(c=>c.name==='attack'));const contact={};for(const time of [.18,.20,.28])contact[time]=sample(time,'front_paw_R').toArray();
 report.species[kind]={sourceSha256:hash(source),runtimeSha256:hash(bytes),bytes:bytes.length,triangles,primitives:primitives.length,bones:25,checkedSkinVertices:weightCount,restLengths,shuffleGroundedVelocity:velocity.toArray(),cupPivot:cup.toArray(),normalStrikePawPositions:contact,clips};
 console.log(`${kind} upright: ${triangles} triangles, ${primitives.length} primitives, ${bytes.length} bytes, 11 clips`);
}
await fs.writeFile(new URL('runtime-inspection.json',out),JSON.stringify(report,null,2)+'\n');
console.log('UPRIGHT_ROSTER_STRUCTURE_OK');
