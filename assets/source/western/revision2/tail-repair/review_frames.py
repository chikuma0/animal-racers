"""QA-only framing correction; reviewed Blender/GLB bytes are never written."""
import sys,json,math,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[5]
sys.path.insert(0,str(ROOT/'scripts/assets'))
import bpy
import repair_tails as r
OUT=r.OUT
def stage(kind,form,variant,clip,time,size=384,crop=False):
 scene=r.prepare_render(kind,form,variant,clip,time,world_move=clip=='evade',size=size,crop=crop)
 if form=='race':scene.camera.data.ortho_scale=3.9
 if clip=='evade':
  for y in [-2,-1,0,1,2,3]:
   bpy.ops.mesh.primitive_cube_add(size=1,location=(-.40,y,.065));ob=bpy.context.object;ob.name='QA stationary metre tick';ob.scale=(.025,.025,.13)
   attr=ob.data.color_attributes.new(name='QA reference',type='FLOAT_COLOR',domain='POINT')
   for c in attr.data:c.color=(.38,.41,.43,1)
   ob.data.color_attributes.active_color=attr
  bpy.ops.mesh.primitive_cube_add(size=1,location=(-.40,.5,0));ob=bpy.context.object;ob.name='QA ground reference';ob.scale=(.025,5.2,.016)
  attr=ob.data.color_attributes.new(name='QA reference',type='FLOAT_COLOR',domain='POINT')
  for c in attr.data:c.color=(.28,.31,.33,1)
  ob.data.color_attributes.active_color=attr
 return scene
r.frozen();before={p.name:r.digest(p) for p in (OUT/'candidate').iterdir() if p.is_file()};previews=json.loads((OUT/'preview.json').read_text());samples=json.loads((OUT/'motion-samples.json').read_text())
for row in previews:
 if '/lion/race/' not in row['path']:continue
 variant='candidate' if '/candidate-' in row['path'] else 'inputs';scene=stage('lion','race',variant,'run',.20,size=512);path=ROOT/row['path'];scene.render.filepath=str(path);bpy.ops.render.render(write_still=True);row['sha256']=r.digest(path);row['qaFraming']='Tail tip margin; orthographic scale3.9m'
(OUT/'preview.json').write_text(json.dumps(previews,indent=2)+'\n')
for row in samples:
 if not ((row['species']=='lion' and row['form']=='race') or row['clip']=='evade'):continue
 kind,form,variant,clip=row['species'],row['form'],row['variant'],row['clip'];scene=stage(kind,form,variant,clip,0);rig=bpy.data.objects[r.prior.rig_name(form)];body=bpy.data.objects[r.prior.body_name(form)];folder=OUT/'qa'/kind/form/'frames'/clip/variant
 for frame in range(row['frames']):
  time=min(row['duration'],frame/15);r.pose_action(rig,body,clip,time)
  if clip=='evade':rig.location.y={'lion':2.8,'wolf':3.6,'unicorn':2.2}[kind]*time
  scene.render.filepath=str(folder/f'{frame:04d}.png');bpy.ops.render.render(write_still=True)
 row['qaFraming']='Full tail-tip margin' if form=='race' else 'Stationary metre ticks visible at ground level'
(OUT/'motion-samples.json').write_text(json.dumps(samples,indent=2)+'\n');r.package();after={p.name:r.digest(p) for p in (OUT/'candidate').iterdir() if p.is_file()};assert before==after;r.frozen()
(OUT/'qa-framing.json').write_text(json.dumps({'scriptSha256':r.digest(Path(__file__)),'candidateUnchanged':before,'changes':['Lion race orthographic scale3.9m retains full tail tip at all phases','Evade stationary ground ticks made readable in exact side view'],'geometryChanged':False},indent=2)+'\n');print('TAIL_QA_FRAMING_CORRECTED',flush=True)
