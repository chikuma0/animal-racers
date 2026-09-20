/** Structural + independently evaluated deformation contract for authored character GLBs. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AnimationMixer, Box3, Vector3, LoopOnce } from 'three';
// ImageBitmap is a geometry-check-only stub. Actual maps are inspected in Blender/browser renders.
globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:256,height:256,close(){}});
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const candidate=process.argv.includes('--candidate');
const revision2=candidate || await fs.stat(path.join(root,'public/assets/western/roster-v2.json')).then(()=>true,()=>false);
const clips=['race_idle','run','jump','land','stumble','transform','fight_idle','fight_move','attack','special','guard','hit','defeat','celebrate'];
if(revision2)clips.push('evade');
const results=[];
for(const species of ['lion','wolf','unicorn']) {
 const file=path.join(root,candidate?'assets/source/western/revision2/candidate':'public/assets/western',species+'.glb');
 const bytes=await fs.readFile(file);
 if(revision2){const manifest=JSON.parse(await fs.readFile(path.join(root,'assets/source/western/revision2',`${species}-race-manifest.json`),'utf8'));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),manifest.runtimeSha256);}
 assert(bytes.readUInt32LE(0)===0x46546c67 && bytes.readUInt32LE(4)===2,'GLB 2 header');
 const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
 if(process.argv.includes('--negative-control'))json.animations=json.animations.filter(a=>a.name!=='attack');
 assert(bytes.length<2_000_000,`${species}: 2 MB maximum`);
 assert(json.meshes.length===1,`${species}: one batched skinned mesh`);
 assert(json.skins.length===1 && json.skins[0].joints.length>=20,`${species}: real anatomical rig`);
 assert((json.images?.length??0)<=2,`${species}: bounded material texture count`);
 for(const image of json.images??[])assert(image.bufferView!==undefined && !image.uri,`${species}: embedded original textures only`);
 let triangles=0,primitives=0;
 for(const mesh of json.meshes)for(const primitive of mesh.primitives){
  primitives++;assert(primitive.attributes.JOINTS_0!==undefined && primitive.attributes.WEIGHTS_0!==undefined,'Every primitive is skinned');
  triangles+=json.accessors[primitive.indices].count/3;
 }
 assert(triangles>5000 && triangles<=32000,`${species}: authored mesh budget`);
 assert(primitives<=24,`${species}: material/draw-call budget`);
 assert.deepEqual(json.animations.map(a=>a.name).sort(),[...clips].sort(),`${species}: exact required clips`);
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const mixer=new AnimationMixer(gltf.scene);const motions={};let restBounds;
 gltf.scene.updateMatrixWorld(true);
 gltf.scene.traverse(ob=>{if(ob.isSkinnedMesh){const w=ob.geometry.attributes.skinWeight;for(let i=0;i<w.count;i++){const sum=w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i);assert(Math.abs(sum-1)<.015,`${species}: normalized weights ${sum}`);}}});
 for(const clip of gltf.animations){
  assert(clip.duration>=.25 && clip.duration<=2.1,`${species}/${clip.name}: bounded duration`);
  const action=mixer.clipAction(clip);action.reset().setLoop(LoopOnce,1).play();action.clampWhenFinished=true;
  const bounds=new Box3();let first=null,moved=0;const sampleCounts=25;
  for(let i=0;i<sampleCounts;i++){
   mixer.setTime(clip.duration*i/(sampleCounts-1));gltf.scene.updateMatrixWorld(true);
   gltf.scene.traverse(ob=>{if(ob.isSkinnedMesh){ob.skeleton.update();ob.computeBoundingBox();bounds.union(ob.boundingBox.clone().applyMatrix4(ob.matrixWorld));}});
   const poses=[];gltf.scene.traverse(ob=>{if(ob.isBone)poses.push(...ob.matrixWorld.elements);});
   if(!first)first=poses;else moved=Math.max(moved,Math.sqrt(poses.reduce((s,v,j)=>s+(v-first[j])**2,0)));
  }
  const size=bounds.getSize(new Vector3());assert([...bounds.min,...bounds.max].every(Number.isFinite),'finite motion bounds');
  assert(size.x<4 && size.y<4 && size.z<5,`${species}/${clip.name}: no exploding deformation`);
  assert(bounds.min.y>-.20,`${species}/${clip.name}: ground penetration ${bounds.min.y}`);
  assert(moved>.001,`${species}/${clip.name}: actual animation, not an empty named clip`);
  motions[clip.name]={duration:+clip.duration.toFixed(3),bounds:{min:bounds.min.toArray().map(x=>+x.toFixed(3)),max:bounds.max.toArray().map(x=>+x.toFixed(3))},boneMovement:+moved.toFixed(3)};
  if(clip.name==='race_idle')restBounds=motions[clip.name].bounds;
  action.stop();mixer.setTime(0);
 }
 const run=mixer.clipAction(gltf.animations.find(c=>c.name==='run'));run.reset().play();const planted=[];
 for(const t of [.285,.36]){mixer.setTime(t);gltf.scene.updateMatrixWorld(true);planted.push(gltf.scene.getObjectByName('front_paw_L').getWorldPosition(new Vector3()));}
 const stanceVelocity=planted[1].clone().sub(planted[0]).divideScalar(.075);
 assert(Math.abs(stanceVelocity.z+8)<.01 && Math.abs(stanceVelocity.y)<.005,`${species}: native 8 m/s backward ground contact`);run.stop();
 const shuffle=mixer.clipAction(gltf.animations.find(c=>c.name==='fight_move'));shuffle.reset().play();const steps=[];
 for(const t of [.04,.14]){mixer.setTime(t);gltf.scene.updateMatrixWorld(true);steps.push(gltf.scene.getObjectByName('rear_paw_L').getWorldPosition(new Vector3()));}
 const fightStanceVelocity=steps[1].clone().sub(steps[0]).divideScalar(.1);
 assert(Math.abs(fightStanceVelocity.z+3.6)<.01 && Math.abs(fightStanceVelocity.y)<.005,`${species}: native3.6m/s backward fight contact`);shuffle.stop();
 const strike=mixer.clipAction(gltf.animations.find(c=>c.name==='attack'));strike.reset().play();mixer.setTime(.2);gltf.scene.updateMatrixWorld(true);
 const contactPivot=gltf.scene.getObjectByName('front_paw_R').getWorldPosition(new Vector3()).toArray().map(x=>+x.toFixed(3));strike.stop();
 const raised=mixer.clipAction(gltf.animations.find(c=>c.name==='celebrate'));raised.reset().play();mixer.setTime(.5);gltf.scene.updateMatrixWorld(true);
 const raisedPawPivot=gltf.scene.getObjectByName('front_paw_L').getWorldPosition(new Vector3()).toArray().map(x=>+x.toFixed(3));
 assert(Math.abs(raisedPawPivot[1]-2.5)<.001,`${species}: raised cup handle pivot at 2.50 m`);raised.stop();
 results.push({species,raisedPawPivot,fightStanceVelocity:fightStanceVelocity.toArray().map(x=>+x.toFixed(6)),stanceVelocity:stanceVelocity.toArray().map(x=>+x.toFixed(6)),contactPivot,bytes:bytes.length,triangles,primitives,bones:json.skins[0].joints.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),restBounds,motions});
}
await fs.writeFile(path.join(root,revision2?'assets/source/western/revision2/race-runtime-inspection.json':'assets/source/western/qa/structure-report.json'),JSON.stringify({generated:new Date().toISOString(),tool:'Three.js GLTFLoader + skinned vertices; 25 evaluations per clip',results},null,2)+'\n');
console.log(results.map(r=>`${r.species}: ${r.triangles} triangles, ${r.primitives} primitives, ${r.bytes} bytes, ${clips.length} animated clips`).join('\n'));
console.log('ASSET_STRUCTURE_OK');
