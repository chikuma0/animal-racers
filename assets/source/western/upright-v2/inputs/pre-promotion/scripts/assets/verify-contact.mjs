/** Actual exported Cycle5/Cycle6 region bounds. No production assets are written. */
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {AnimationMixer,LoopOnce,Box3,Vector3} from 'three';
globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:256,height:256,close(){}});
const root=new URL('../../',import.meta.url),base=new URL('assets/source/western/contact-v2/',root),out=new URL('v2b/',base),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const frozen=JSON.parse(await fs.readFile(new URL('frozen-cycle5.json',base),'utf8'));
for(const [path,expected] of Object.entries(frozen.files))assert.equal(hash(await fs.readFile(new URL(path,root))),expected,path);
const report={method:'Actual skinned glTF vertices in metres, +Z forward. Regions use ≥50% summed influence from named bones. Head includes jaw and head accessories; forward-extreme material/XYZ are recorded. These are region bounds, not collision/intersection tests. Native 30 fps export is interpolated during the 120 Hz contact-window sweep.',species:{}};
const failures=[];
for(const kind of ['lion','wolf','unicorn']){
 const record={};
 for(const variant of ['control','candidate']){
  const bytes=await fs.readFile(new URL(`${variant}/${kind}-upright.glb`,variant==='control'?base:out));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');const mixer=new AnimationMixer(gltf.scene);
  const regions={head:['head','jaw'],chest:['spine','chest'],rightForelimb:['front_upper_R','front_lower_R','front_paw_R'],rightPaw:['front_paw_R'],leftPaw:['front_paw_L']};
  const memberships=[];gltf.scene.traverse(mesh=>{
   if(!mesh.isSkinnedMesh)return;
   const indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight,selected={};
   for(const name of Object.keys(regions))selected[name]=[];
   for(let i=0;i<indices.count;i++){
    const names=[indices.getX(i),indices.getY(i),indices.getZ(i),indices.getW(i)].map(j=>mesh.skeleton.bones[j].name),w=[weights.getX(i),weights.getY(i),weights.getZ(i),weights.getW(i)];
    for(const [region,bones] of Object.entries(regions))if(names.reduce((sum,name,j)=>sum+(bones.includes(name)?w[j]:0),0)>=.5)selected[region].push(i);
   }
   memberships.push({mesh,selected});
  });
  const sample=(clip,time)=>{
   mixer.stopAllAction();mixer.setTime(0);const action=mixer.clipAction(gltf.animations.find(c=>c.name===clip)).reset().setLoop(LoopOnce,1);action.clampWhenFinished=true;action.play();mixer.setTime(time);gltf.scene.updateMatrixWorld(true);
   const bounds=Object.fromEntries(Object.keys(regions).map(name=>[name,new Box3()])),extremes={};
   for(const {mesh,selected} of memberships){
    mesh.skeleton.update();const point=new Vector3();
    for(const [name,vertices] of Object.entries(selected))for(const i of vertices){mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);bounds[name].expandByPoint(point);if(!extremes[name]||point.z>extremes[name].position[2])extremes[name]={position:point.toArray(),material:mesh.material.name,vertex:i};}
   }
   return {clip,time,regions:Object.fromEntries(Object.entries(bounds).map(([name,b])=>[name,{min:b.min.toArray(),max:b.max.toArray(),forwardExtreme:extremes[name]}])),pivots:Object.fromEntries(['front_paw_L','front_paw_R','head','jaw'].map(name=>[name,gltf.scene.getObjectByName(name).getWorldPosition(new Vector3()).toArray()]))};
  };
  const states={};
  for(const [label,clip,time] of [['idle','fight_idle',0],['contactStart','attack',.18],['contactPeak','attack',.20],['contactEnd','attack',.28],['guard','guard',.4],['hit','hit',.20],['special','special',{lion:.36,wolf:.47,unicorn:.44}[kind]],['cup','celebrate',.5]])states[label]=sample(clip,time);
  const sweep=[];
  for(let i=0;i<=12;i++){const time=.18+i*.1/12,s=sample('attack',time);sweep.push({time,headForward:s.regions.head.max[2],pawForward:s.regions.rightPaw.max[2],chestForward:s.regions.chest.max[2]});}
  const maximumHead=Math.max(...sweep.map(s=>s.headForward)),minimumPaw=Math.min(...sweep.map(s=>s.pawForward));
  record[variant]={sha256:hash(bytes),states,contactSweep:sweep,maximumContactHeadForward:maximumHead,minimumContactPawForward:minimumPaw};
  if(variant==='candidate'){
   if(maximumHead>.82)failures.push(`${kind}: maximum head forward ${maximumHead}`);
   const peakPaw=states.contactPeak.regions.rightPaw.max[2];
   if(peakPaw<1.24 || peakPaw>1.35)failures.push(`${kind}: retained full-contact paw reach ${peakPaw}`);
   const maximumReachLoss=Math.max(...sweep.map((s,i)=>record.control.contactSweep[i].pawForward-s.pawForward));
   if(maximumReachLoss>.001)failures.push(`${kind}: active-window reach shortened vs frozen control by ${maximumReachLoss}`);
   record[variant].maximumActiveWindowReachLossVersusControl=maximumReachLoss;
  }
 }
 report.species[kind]=record;
 const r=record.candidate.states,fmt=n=>n.toFixed(3);
 console.log(`${kind}: idle head/chest/paw ${fmt(r.idle.regions.head.max[2])}/${fmt(r.idle.regions.chest.max[2])}/${fmt(r.idle.regions.rightPaw.max[2])}; contact ${fmt(record.candidate.maximumContactHeadForward)}/${fmt(r.contactPeak.regions.chest.max[2])}/${fmt(r.contactPeak.regions.rightPaw.max[2])}; guard ${fmt(r.guard.regions.head.max[2])}/${fmt(r.guard.regions.chest.max[2])}/${fmt(r.guard.regions.rightPaw.max[2])}`);
}
await fs.writeFile(new URL('contact-comparison.json',out),JSON.stringify(report,null,2)+'\n');
assert.equal(failures.length,0,failures.join('; '));
console.log('CONTACT_VARIANT_BOUNDS_OK');
