/** Independent experimental GLB geometry checks; no rendering or production mutation. */
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {AnimationMixer,Box3,LoopOnce,Vector3} from 'three';
globalThis.self=globalThis;
globalThis.createImageBitmap=async()=>({width:256,height:256,close(){}});
const base=new URL('./',import.meta.url);
const bytes=await fs.readFile(new URL('unicorn-upright.glb',base));
const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
assert.deepEqual(doc.animations.map(a=>a.name).sort(),['fight_idle','attack','guard','defeat','celebrate'].sort());
assert(doc.skins.length===1 && doc.skins[0].joints.length>=24);
const triangles=doc.meshes.flatMap(m=>m.primitives).reduce((sum,p)=>sum+doc.accessors[p.indices].count/3,0);
const primitives=doc.meshes.flatMap(m=>m.primitives).length;
assert(triangles<32000 && primitives<=24 && bytes.length<2_000_000);
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const mixer=new AnimationMixer(gltf.scene);
let weights=0;
gltf.scene.traverse(ob=>{if(ob.isSkinnedMesh){const w=ob.geometry.attributes.skinWeight;for(let i=0;i<w.count;i++){assert(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)<.001);weights++;}}});
const restLengths={};
gltf.scene.updateMatrixWorld(true);
for(const name of ['front_upper_L','front_lower_L','rear_upper_L','rear_lower_L']) {
 const bone=gltf.scene.getObjectByName(name);const child=bone.children.find(c=>c.isBone);
 assert(child);restLengths[name]=bone.getWorldPosition(new Vector3()).distanceTo(child.getWorldPosition(new Vector3()));
}
const clips={};
for(const clip of gltf.animations){
 const action=mixer.clipAction(clip);action.reset().setLoop(LoopOnce,1).play();action.clampWhenFinished=true;
 const bounds=new Box3();let limbLengthError=0,footDrift=0;let firstFeet=null;
 for(let i=0;i<=40;i++){
  mixer.setTime(clip.duration*i/40);
  if(process.argv.includes('--negative-control'))gltf.scene.getObjectByName('front_upper_L').scale.y*=3;
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(ob=>{if(ob.isSkinnedMesh){ob.skeleton.update();ob.computeBoundingBox();bounds.union(ob.boundingBox.clone().applyMatrix4(ob.matrixWorld));}});
  for(const [name,rest] of Object.entries(restLengths)){const b=gltf.scene.getObjectByName(name),child=b.children.find(c=>c.isBone);limbLengthError=Math.max(limbLengthError,Math.abs(b.getWorldPosition(new Vector3()).distanceTo(child.getWorldPosition(new Vector3()))-rest));}
  const feet=['rear_paw_L','rear_paw_R'].map(name=>gltf.scene.getObjectByName(name).getWorldPosition(new Vector3()));
  if(!firstFeet)firstFeet=feet;else feet.forEach((v,j)=>footDrift=Math.max(footDrift,v.distanceTo(firstFeet[j])));
 }
 const size=bounds.getSize(new Vector3());assert([...bounds.min,...bounds.max].every(Number.isFinite));
 assert(size.x<3 && size.y<3.5 && size.z<3 && bounds.min.y>-.12,`${clip.name}: finite bounded geometry, limited floor penetration`);
 assert(limbLengthError<.003 && footDrift<.003,`${clip.name}: fixed limb length and planted rear hooves`);
 clips[clip.name]={duration:clip.duration,min:bounds.min.toArray(),max:bounds.max.toArray(),maximumLimbLengthError:limbLengthError,maximumRearPawPivotDrift:footDrift};
 action.stop();mixer.setTime(0);
}
const lift=mixer.clipAction(gltf.animations.find(c=>c.name==='celebrate'));lift.reset().play();mixer.setTime(.5);gltf.scene.updateMatrixWorld(true);
const cup=gltf.scene.getObjectByName('front_paw_L').getWorldPosition(new Vector3()).toArray();assert(Math.abs(cup[1]-2.5)<.001);lift.stop();
const report={sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,triangles,primitives,bones:doc.skins[0].joints.length,checkedSkinVertices:weights,restLengths,cupPivot:cup,clips,limits:'Geometry-only texture stub; 41 actual skinned-bound evaluations per clip. These checks do not establish visual anatomy or absence of local self-intersection.'};
await fs.writeFile(new URL('runtime-inspection.json',base),JSON.stringify(report,null,2)+'\n');
console.log(`Experimental GLB: ${triangles} triangles, ${primitives} primitives, ${bytes.length} bytes`);
console.log('UPRIGHT_RUNTIME_CHECKS_OK');
