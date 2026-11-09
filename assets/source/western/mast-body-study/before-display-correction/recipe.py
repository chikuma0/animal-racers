"""Isolated native Mast body feasibility. Disable autoexec; two CPU threads only.
This never writes canonical assets or the completed Mast head study.
"""
import bpy,math,json,hashlib,sys
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/source/western/mast-body-study'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def frozen():
 p=json.loads((OUT/'provenance.json').read_text())
 for n,h in p['inputs'].items():assert sha(OUT/n)==h,n
 for key in ['canonicalFreeze','completedHeadStudyFreeze']:
  for n,h in p[key].items():assert sha(ROOT/n)==h,n
def safe_load(p):
 bpy.context.preferences.filepaths.use_scripts_auto_execute=False
 bpy.ops.wm.open_mainfile(filepath=str(p),load_ui=False,use_scripts=False)
 drivers=[]
 for prop in bpy.data.bl_rna.properties:
  value=getattr(bpy.data,prop.identifier,None)
  if not hasattr(value,'__iter__') or isinstance(value,str):continue
  try:blocks=list(value)
  except:continue
  for block in blocks:
   ad=getattr(block,'animation_data',None)
   for d in ad.drivers if ad else []:drivers.append({'block':block.name,'path':d.data_path});d.mute=True
   nt=getattr(block,'node_tree',None)
   if nt and nt.animation_data:
    for d in nt.animation_data.drivers:drivers.append({'block':nt.name,'path':d.data_path});d.mute=True
 return drivers
def bounds(points):
 ps=list(points);return {'min':[min(p[i] for p in ps) for i in range(3)],'max':[max(p[i] for p in ps) for i in range(3)]}
def components(me):
 adj=[set() for _ in me.vertices]
 for e in me.edges:a,b=e.vertices;adj[a].add(b);adj[b].add(a)
 todo=set(range(len(adj)));parts=[]
 while todo:
  part={todo.pop()};stack=list(part)
  while stack:
   a=stack.pop()
   for b in adj[a]&todo:todo.remove(b);part.add(b);stack.append(b)
  parts.append(part)
 return sorted(parts,key=len,reverse=True)
def topology(me):
 me.calc_loop_triangles();uses={}
 for p in me.polygons:
  for a,b in p.edge_keys:
   k=tuple(sorted((a,b)));uses[k]=uses.get(k,0)+1
 return {'vertices':len(me.vertices),'polygons':len(me.polygons),'triangles':len(me.loop_triangles),'components':[len(p) for p in components(me)],'boundaryEdges':sum(x==1 for x in uses.values()),'nonmanifoldEdgesOverTwoFaces':sum(x>2 for x in uses.values())}
def evaluated(ob):
 bpy.context.view_layer.update();ev=ob.evaluated_get(bpy.context.evaluated_depsgraph_get());me=ev.to_mesh();r=topology(me);r['bounds']=bounds(ev.matrix_world@v.co for v in me.vertices);ev.to_mesh_clear();return r
def signature(ob):
 d={'vertices':[tuple(v.co) for v in ob.data.vertices],'faces':[tuple(p.vertices) for p in ob.data.polygons],'weights':[[(ob.vertex_groups[g.group].name,g.weight) for g in v.groups] for v in ob.data.vertices]}
 return hashlib.sha256(json.dumps(d,sort_keys=True).encode()).hexdigest()
def inspect():
 frozen();drivers=safe_load(OUT/'inputs/Mast.blend');rig=bpy.data.objects['ArmatureMast'];body=bpy.data.objects['Mast2024-11'];mane=bpy.data.objects['Mast.Juba'];skin=components(body.data)[0]
 r={'sourceSha256':sha(OUT/'inputs/Mast.blend'),'recipeSha256':sha(Path(__file__)),'autoExecutionDisabled':not bpy.context.preferences.filepaths.use_scripts_auto_execute,'driversMuted':drivers,'textBlocks':[{'name':t.name,'sha256':hashlib.sha256(t.as_string().encode()).hexdigest()} for t in bpy.data.texts],'libraries':[l.filepath for l in bpy.data.libraries],'actions':[a.name for a in bpy.data.actions],'boneCount':len(rig.data.bones),'bones':[],'meshes':[],'continuousSkin':{'vertices':len(skin),'regions':{}},'bodyGeometryWeightsSha256':signature(body)}
 for b in rig.data.bones:
  r['bones'].append({'name':b.name,'parent':b.parent.name if b.parent else None,'head':list(rig.matrix_world@b.head_local),'tail':list(rig.matrix_world@b.tail_local),'matrixLocal':[list(row) for row in b.matrix_local],'deform':b.use_deform,'constraints':[{'type':c.type,'target':getattr(getattr(c,'target',None),'name',None),'subtarget':getattr(c,'subtarget',None),'chainCount':getattr(c,'chain_count',None)} for c in rig.pose.bones[b.name].constraints]})
 for region,names in {'head':['Head'],'neck':['Spine05','Throat'],'chest':['Spine03','Spine04'],'hip':['Root','Spine01','Leg01.L','Leg01.R'],'leftHand':['Pulso.L']+[n for n in rig.data.bones.keys() if n.startswith('Phinger') and n.endswith('.L')],'leftFoot':['Foot.L','Finger.L','FingerA.L']}.items():
  indices=[v.index for v in body.data.vertices if sum(g.weight for g in v.groups if body.vertex_groups[g.group].name in names)>.5]
  r['continuousSkin']['regions'][region]={'weightedVertexCount':len(indices),'inLargestComponent':sum(i in skin for i in indices),'bounds':bounds(body.matrix_world@body.data.vertices[i].co for i in indices) if indices else None}
 for ob in [body,mane]:
  item={'name':ob.name,**topology(ob.data),'signature':signature(ob),'modifiers':[{'type':m.type,'name':m.name,'showViewport':m.show_viewport,'showRender':m.show_render,'vertexGroup':getattr(m,'vertex_group',None),'invertVertexGroup':getattr(m,'invert_vertex_group',None)} for m in ob.modifiers],'levels':{},'materials':[m.name for m in ob.data.materials],'weightInfluences':{}}
  counts=[];sums=[]
  for v in ob.data.vertices:
   w=[g.weight for g in v.groups if ob.vertex_groups[g.group].name in rig.data.bones and g.weight>1e-7];counts.append(len(w));sums.append(sum(w))
  item['weightInfluences']={'max':max(counts),'histogram':{str(n):counts.count(n) for n in sorted(set(counts))},'maxWeightSumError':max(abs(s-1) for s in sums)}
  for level in [0,1]:
   for m in ob.modifiers:
    if m.type=='SUBSURF':m.levels=level;m.render_levels=level
   item['levels'][str(level)]=evaluated(ob)
  r['meshes'].append(item)
 (OUT/'inspection.json').write_text(json.dumps(r,indent=2)+'\n');(OUT/'inspection-recipe.py').write_bytes(Path(__file__).read_bytes());frozen();print('MAST_NATIVE_BODY_INSPECTED',flush=True)
def linear(h):
 def f(s):x=int(s,16)/255;return x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4
 return Vector(tuple(f(h[i:i+2]) for i in (0,2,4)))
def palette(body):
 me=body.data;gold=linear('B58C53');cream=linear('D8BE93');dark=linear('32261C');eye=linear('A18544');ivory=linear('DED0AF')
 color=me.color_attributes.new(name='Native study display',type='FLOAT_COLOR',domain='POINT')
 for v in me.vertices:
  p=body.matrix_world@v.co;w={body.vertex_groups[g.group].name:g.weight for g in v.groups};c=gold.copy()
  if p.y<-.05 and .80<p.z<1.40:c=gold.lerp(cream,.38)
  if p.y<-.066 and 1.54<p.z<1.632:c=gold.lerp(cream,.72)
  if p.y<-.124 and 1.580<p.z<1.623:c=dark.copy()
  if sum(w.get(n,0) for n in ['Head.Gengiva','Jaw.Gengiva'])>.5:c=linear('58382D')
  if w.get('zzzTeefUpper',0)+w.get('zzzTeefBottom',0)>.5:c=ivory.copy()
  if any(n.startswith('Tongue') and a>.2 for n,a in w.items()):c=linear('965A4D')
  if w.get('Olho.L',0)+w.get('Olho.R',0)>.5:
   rad=math.hypot(abs(p.x)-.03154446,p.z-1.640621);c=ivory.copy()
   if p.y<-.063 and rad<.014:c=eye.copy()
   if p.y<-.063 and rad<.0065:c=dark.copy()
  color.data[v.index].color=(*c,1)
 mat=bpy.data.materials.new('Neutral gold anatomy display');mat.diffuse_color=(*gold,1);mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.82;attr=mat.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name=color.name;mat.node_tree.links.new(attr.outputs['Color'],bs.inputs['Base Color']);me.materials.clear();me.materials.append(mat);me.color_attributes.active_color_index=list(me.color_attributes).index(color)
def setup():
 scene=bpy.context.scene
 for ob in list(bpy.data.objects):
  if ob.type in ['CAMERA','LIGHT'] or ob.name=='Plane.008':bpy.data.objects.remove(ob,do_unlink=True)
 scene.render.engine='BLENDER_WORKBENCH';scene.render.threads_mode='FIXED';scene.render.threads=2;scene.render.resolution_x=512;scene.render.resolution_y=512;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.fps=15;scene.render.film_transparent=False
 scene.display.shading.light='STUDIO';scene.display.shading.studiolight_rotate_z=.5;scene.display.shading.color_type='VERTEX';scene.display.shading.show_shadows=True;scene.display.shading.show_cavity=True;scene.display.shading.cavity_type='BOTH';scene.display.shading.curvature_ridge_factor=1.15;scene.display.shading.curvature_valley_factor=.8;scene.display.shading.show_specular_highlight=False;scene.display.shading.background_type='WORLD';scene.world.color=(.06,.07,.085);scene.view_settings.view_transform='Standard'
 data=bpy.data.cameras.new('Full native body review');cam=bpy.data.objects.new(data.name,data);scene.collection.objects.link(cam);scene.camera=cam;data.type='ORTHO';data.ortho_scale=2.35
 return scene,cam
def camera(cam,view):
 target=Vector((0,0,1.02));offset={'front':(0,-5,.0),'side':(5,0,0),'three-quarter':(3,-5,.8)}[view];cam.location=target+Vector(offset);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
def build():
 frozen();drivers=safe_load(OUT/'inputs/Mast.blend');body=bpy.data.objects['Mast2024-11'];rig=bpy.data.objects['ArmatureMast'];mane=bpy.data.objects['Mast.Juba'];before=signature(body)
 for t in list(bpy.data.texts):bpy.data.texts.remove(t)
 for ob in bpy.data.objects:ob.hide_render=ob not in [body,rig]
 mane.hide_viewport=True;mane.hide_render=True
 palette(body)
 for p in body.data.polygons:p.use_smooth=True
 for m in body.modifiers:
  if m.type=='SUBSURF':m.levels=1;m.render_levels=1
 scene,cam=setup();camera(cam,'three-quarter');bpy.context.view_layer.update();assert before==signature(body)
 report={'sourceSha256':sha(OUT/'inputs/Mast.blend'),'recipeSha256':sha(Path(__file__)),'bodyGeometryWeightsBefore':before,'bodyGeometryWeightsAfter':signature(body),'bodyDisplayCost':evaluated(body),'selectedSubdivision':1,'maneHiddenAndRejected':True,'nativeRigConstraintsRetained':True,'boneCount':len(rig.data.bones),'embeddedTextsRemoved':True,'driversMuted':drivers,'suppliedActions':[],'displayOnlyPalette':'Neutral gold vertex colors; no final fur or PBR acceptance'}
 bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'native-body-study.blend'),compress=True);report['editableSha256']=sha(OUT/'native-body-study.blend');(OUT/'display.json').write_text(json.dumps(report,indent=2)+'\n');frozen();print('MAST_NATIVE_BODY_BUILT',flush=True)
def views():
 frozen();safe_load(OUT/'native-body-study.blend');scene=bpy.context.scene;cam=scene.camera
 for view in ['front','side','three-quarter']:
  camera(cam,view);scene.render.filepath=str(OUT/'qa'/f'body-{view}.png');bpy.ops.render.render(write_still=True)
 frozen();print('MAST_NATIVE_FULL_VIEWS_DONE',flush=True)
def set_control(rig,name,target):
 pb=rig.pose.bones[name];m=pb.matrix.copy();m.translation=Vector(target);pb.matrix=m;bpy.context.view_layer.update()
def pose(rig,t):
 rig.animation_data_clear()
 for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
 bpy.context.view_layer.update()
 # Actual native IK controllers and native copy/track constraints remain active.
 # Three non-overlapping pulses return to rest: overhead shoulders, left strike, crouch.
 def pulse(a,b):return math.sin(math.pi*(t-a)/(b-a))**2 if a<t<b else 0.
 shoulder=pulse(0,.8);strike=pulse(.8,1.6);crouch=pulse(1.6,2.4)
 root=rig.pose.bones['Root'];root.location=root.bone.matrix_local.to_3x3().inverted()@Vector((0,0,-.20*crouch));bpy.context.view_layer.update()
 for side,sign in [('L',1),('R',-1)]:
  n='Pulso.'+side+'.001';start=rig.data.bones[n].head_local.copy();target=start.lerp(Vector((sign*.25,-.03,1.89)),shoulder)
  if side=='L':target=target.lerp(Vector((.25,-.47,1.34)),strike)
  target+=Vector((0,-.10*crouch,-.16*crouch));set_control(rig,n,target)
 # Retain native foot targets; native two-bone IK bends the knees during Root descent.
 head=rig.pose.bones['Head'];head.rotation_mode='XYZ';head.rotation_euler[2]=.10*strike;head.rotation_euler[0]=.12*crouch
 bpy.context.view_layer.update();return {'shoulder':shoulder,'strike':strike,'crouch':crouch}
def geometry(body):
 bpy.context.view_layer.update();ev=body.evaluated_get(bpy.context.evaluated_depsgraph_get());me=ev.to_mesh();verts=[ev.matrix_world@v.co for v in me.vertices];edges=[tuple(e.vertices) for e in me.edges];ev.to_mesh_clear();return verts,edges
def probe():
 frozen();safe_load(OUT/'native-body-study.blend');scene=bpy.context.scene;rig=bpy.data.objects['ArmatureMast'];body=bpy.data.objects['Mast2024-11'];camera(scene.camera,'three-quarter');scene.camera.data.ortho_scale=2.45;scene.render.resolution_x=384;scene.render.resolution_y=384;folder=OUT/'qa/probe-frames';folder.mkdir(exist_ok=True)
 pose(rig,0);rest,edges=geometry(body);lengths=[(rest[a]-rest[b]).length for a,b in edges];records=[];controls=['Root','Pulso.L.001','Pulso.R.001','Head']
 for i in range(37):
  t=i/15;mix=pose(rig,t);v,_=geometry(body);assert len(v)==len(rest);assert all(math.isfinite(x) for p in v for x in p);ratios=sorted((v[a]-v[b]).length/l for (a,b),l in zip(edges,lengths) if l>1e-7)
  records.append({'frame':i,'time':t,'pulses':mix,'bounds':bounds(v),'edgeRatioMax':ratios[-1],'edgeRatioP99':ratios[int(.99*(len(ratios)-1))],'edgesOver2x':sum(x>2 for x in ratios),'bones':{n:{'head':list(rig.matrix_world@rig.pose.bones[n].head),'tail':list(rig.matrix_world@rig.pose.bones[n].tail)} for n in ['Root','Head','Spine05','Braço01.L','Braço02.L','Pulso.L','Foot.L','Foot.R']}})
  scene.render.filepath=str(folder/f'{i:04d}.png');bpy.ops.render.render(write_still=True)
 # Retain an actual authored probe action on native controllers, without imported animation claims.
 action=bpy.data.actions.new('Native shoulder strike crouch probe')
 for i in range(73):
  pose(rig,i/30);rig.animation_data_create();rig.animation_data.action=action
  for name in controls:
   b=rig.pose.bones[name];b.keyframe_insert('location',frame=i+1);b.keyframe_insert('rotation_quaternion',frame=i+1);b.keyframe_insert('rotation_euler',frame=i+1)
 for fc in action.fcurves:
  for k in fc.keyframe_points:k.interpolation='LINEAR'
 scene.render.fps=30;scene.frame_start=1;scene.frame_end=73;scene.frame_set(1);bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'native-body-study.blend'),compress=True)
 report=json.loads((OUT/'display.json').read_text());assert signature(body)==report['bodyGeometryWeightsBefore'];report['editableSha256']=sha(OUT/'native-body-study.blend');report['bodyGeometryWeightsAfter']=signature(body);report['probe']={'authoredForStudy':True,'isGameRetarget':False,'nativeControls':controls,'nativeConstraintsRetained':True,'samples':records};(OUT/'display.json').write_text(json.dumps(report,indent=2)+'\n');frozen();print('MAST_NATIVE_FULL_PROBE_DONE',flush=True)
if __name__=='__main__':globals()[sys.argv[sys.argv.index('--')+1]]()
