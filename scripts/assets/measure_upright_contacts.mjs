/** Read-only exported vertex extents for stance separation/contact integration. */
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {AnimationMixer,LoopOnce,Box3,Vector3} from 'three';
globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:256,height:256,close(){}});
const root=new URL('../../',import.meta.url),report={method:'Actual glTF skinned vertices. Region membership is at least 50% summed normalized influence from named bones; head includes jaw and head accessories. Local +Z forward. These are axis-aligned region extents, not collision-volume intersection tests.',species:{}};
for(const kind of ['lion','wolf','unicorn']){
 const bytes=await fs.readFile(new URL(`public/assets/western/${kind}-upright.glb`,root));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');const mixer=new AnimationMixer(gltf.scene),samples={};
 const regions={head:['head','jaw'],rightForelimb:['front_upper_R','front_lower_R','front_paw_R'],rightPaw:['front_paw_R'],leftPaw:['front_paw_L']};
 for(const [label,clip,time] of [['idle','fight_idle',0],['contactStart','attack',.18],['contactPeak','attack',.20],['contactEnd','attack',.28]]){
  mixer.stopAllAction();mixer.setTime(0);const action=mixer.clipAction(gltf.animations.find(c=>c.name===clip)).reset().setLoop(LoopOnce,1);action.clampWhenFinished=true;action.play();mixer.setTime(time);gltf.scene.updateMatrixWorld(true);
  const bounds=Object.fromEntries(Object.keys(regions).map(name=>[name,new Box3()])),counts=Object.fromEntries(Object.keys(regions).map(name=>[name,0]));
  gltf.scene.traverse(mesh=>{
   if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();const indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight,p=new Vector3();
   for(let i=0;i<indices.count;i++){
    const names=[indices.getX(i),indices.getY(i),indices.getZ(i),indices.getW(i)].map(j=>mesh.skeleton.bones[j].name),w=[weights.getX(i),weights.getY(i),weights.getZ(i),weights.getW(i)];
    mesh.getVertexPosition(i,p).applyMatrix4(mesh.matrixWorld);
    for(const [region,bones] of Object.entries(regions))if(names.reduce((sum,name,j)=>sum+(bones.includes(name)?w[j]:0),0)>=.5){bounds[region].expandByPoint(p);counts[region]++;}
   }
  });
  const pivots=Object.fromEntries(['front_paw_L','front_paw_R','head','jaw'].map(name=>[name,gltf.scene.getObjectByName(name).getWorldPosition(new Vector3()).toArray()]));
  samples[label]={clip,time,regions:Object.fromEntries(Object.entries(bounds).map(([name,b])=>[name,{min:b.min.toArray(),max:b.max.toArray(),vertices:counts[name]}])),pivots};
 }
 report.species[kind]={runtimeSha256:crypto.createHash('sha256').update(bytes).digest('hex'),samples};
 console.log(`${kind}: idle head +Z=${samples.idle.regions.head.max[2].toFixed(3)} m; contact head=${samples.contactPeak.regions.head.max[2].toFixed(3)} m; right paw reach=${samples.contactPeak.regions.rightPaw.max[2].toFixed(3)} m, paw pivot=${samples.contactPeak.pivots.front_paw_R.map(v=>v.toFixed(3)).join(',')}`);
}
await fs.writeFile(new URL('assets/source/western/upright-v1/contact-bounds.json',root),JSON.stringify(report,null,2)+'\n');
console.log('UPRIGHT_CONTACT_BOUNDS_RECORDED');
