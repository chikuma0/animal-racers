import fs from 'node:fs/promises';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {AnimationMixer,LoopOnce,Vector3,Box3} from 'three';
globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:256,height:256,close(){}});
const rows=[];
for(const kind of ['lion','wolf','unicorn'])for(const form of ['race','upright']){
 const name=kind+(form==='upright'?'-upright':''),bytes=await fs.readFile(`public/assets/western/${name}.glb`),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const mixer=new AnimationMixer(gltf.scene);
 for(const clip of gltf.animations){
  mixer.stopAllAction();mixer.setTime(0);const action=mixer.clipAction(clip).reset().setLoop(LoopOnce,1);action.clampWhenFinished=true;action.play();let lowest={y:0,time:0};
  for(let i=0;i<=40;i++){const time=clip.duration*i/40;mixer.setTime(time);gltf.scene.updateMatrixWorld(true);gltf.scene.traverse(ob=>{if(ob.isSkinnedMesh){ob.skeleton.update();ob.computeBoundingBox();const y=ob.boundingBox.clone().applyMatrix4(ob.matrixWorld).min.y;if(y<lowest.y)lowest={y,time};}});}
  if(lowest.y<-.12){action.reset().setLoop(LoopOnce,1).play();mixer.setTime(0);mixer.setTime(lowest.time);gltf.scene.updateMatrixWorld(true);const points=[];let nonTailMin=Infinity,tailMin=Infinity;
   gltf.scene.traverse(ob=>{if(!ob.isSkinnedMesh)return;ob.skeleton.update();const w=ob.geometry.attributes.skinWeight,j=ob.geometry.attributes.skinIndex;
    for(let v=0;v<w.count;v++){const p=ob.getVertexPosition(v,new Vector3()).applyMatrix4(ob.matrixWorld),weights=[0,1,2,3].filter(c=>w.getComponent(v,c)>1e-7).map(c=>[ob.skeleton.bones[j.getComponent(v,c)].name,w.getComponent(v,c)]),tail=weights.some(([b])=>b.startsWith('tail_'));
     if(tail)tailMin=Math.min(tailMin,p.y);else nonTailMin=Math.min(nonTailMin,p.y);if(p.y<-.12)points.push({y:p.y,weights});
    }});points.sort((a,b)=>a.y-b.y);rows.push({kind,form,clip:clip.name,...lowest,nonTailMin,tailMin,belowThreshold:points.length,lowestVertices:points.slice(0,3)});
  }
 }
}
await fs.writeFile('assets/source/western/revision2/tail-integration/floor-diagnostic.json',JSON.stringify(rows,null,2)+'\n');console.log(JSON.stringify(rows));
