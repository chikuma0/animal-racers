"""Dedicated upright Unicorn topology/rig experiment; never replaces production assets.
Blender --background --python scripts/assets/experiment_upright.py -- build
Blender --background --python scripts/assets/experiment_upright.py -- inspect
Blender --background --python scripts/assets/experiment_upright.py -- render [control|experiment]
"""
import bpy,bmesh,math,json,hashlib,shutil,sys
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/source/western/experiments/upright-v1'
OUT.mkdir(parents=True,exist_ok=True)
FPS=30
CLIPS={'fight_idle':2.,'attack':.57,'guard':.6,'defeat':1.3,'celebrate':2.}
def V(p):return Vector((p[0],-p[1],p[2]))
def D(p):return (p.x,-p.y,p.z)
def smooth(t):
 t=max(0.,min(1.,t));return t*t*(3-2*t)
def mix(a,b,t):return tuple(a[i]*(1-t)+b[i]*t for i in range(3))
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()

def skeleton():
 d={'root':((0,0,0),(0,0,.25),None),
 'pelvis':((0,-.04,.95),(0,-.04,1.10),'root'),
 'spine':((0,-.04,1.10),(0,0,1.38),'pelvis'),
 'chest':((0,0,1.38),(0,.055,1.70),'spine'),
 'neck':((0,.055,1.70),(0,.18,1.99),'chest'),
 'head':((0,.18,1.99),(0,.51,2.),'neck'),
 'jaw':((0,.37,1.83),(0,.68,1.81),'head')}
 for side,s in [('L',1),('R',-1)]:
  d.update({f'scapula_{side}':((s*.10,.04,1.68),(s*.39,.02,1.74),'chest'),
   f'front_upper_{side}':((s*.39,.02,1.74),(s*.64,.10,1.34),f'scapula_{side}'),
   f'front_lower_{side}':((s*.64,.10,1.34),(s*.69,.20,.90),f'front_upper_{side}'),
   f'front_paw_{side}':((s*.69,.20,.90),(s*.69,.38,.86),f'front_lower_{side}'),
   f'rear_upper_{side}':((s*.26,-.12,.99),(s*.35,.03,.56),'pelvis'),
   f'rear_lower_{side}':((s*.35,.03,.56),(s*.36,-.12,.18),f'rear_upper_{side}'),
   f'rear_paw_{side}':((s*.36,-.12,.18),(s*.36,.08,.12),f'rear_lower_{side}')})
 for i in range(4):d[f'tail_{i}']=((0,-.36-i*.18,.95-i*.07),(0,-.54-i*.18,.88-i*.07),'pelvis' if i==0 else f'tail_{i-1}')
 return d
REST=skeleton()

def make_rig(old_mats):
 data=bpy.data.armatures.new('Upright articulated hierarchy');rig=bpy.data.objects.new('UprightRig',data);bpy.context.collection.objects.link(rig)
 bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
 for name,(a,b,parent) in REST.items():
  bone=data.edit_bones.new(name);bone.head=V(a);bone.tail=V(b)
  if parent:bone.parent=data.edit_bones[parent]
  if name in old_mats:
   old=old_mats[name];old_axis=old.to_3x3().col[1].normalized();rotation=old_axis.rotation_difference((V(b)-V(a)).normalized())
   bone.align_roll(rotation@old.to_3x3().col[2])
 bpy.ops.object.mode_set(mode='OBJECT');rig.show_in_front=True
 rig['scope']='Dedicated upright topology experiment; not production acceptance'
 rig['source']='Original Animal Racers authored meshes; no external assets'
 return rig

def body_mesh(rig,material):
 verts=[];faces=[];weights=[]
 def vertex(p,w):verts.append(tuple(p));weights.append(w);return len(verts)-1
 def torso_weights(h):
  anchors=[(.98,'pelvis'),(1.24,'spine'),(1.62,'chest'),(1.91,'neck')]
  if h<=anchors[0][0]:return {anchors[0][1]:1.}
  for (a,na),(b,nb) in zip(anchors,anchors[1:]):
   if h<=b:t=smooth((h-a)/(b-a));return {na:1-t,nb:t}
  return {'neck':1.}
 # Authored body cross-sections: pelvis, waist, ribcage, breast and horse neck.
 # Arms branch from holes in the upper ribcage rather than inheriting belly skin.
 rings=[(.98,.365,.235,-.03),(1.08,.35,.25,-.02),(1.19,.29,.225,0),
  (1.32,.31,.25,.02),(1.45,.375,.285,.035),(1.55,.414,.28,.045),
  (1.68,.426,.255,.055),(1.81,.345,.215,.085),(1.89,.26,.18,.13),(1.99,.23,.17,.18)]
 N=24;rows=[]
 for h,rx,rf,f in rings:
  row=[]
  for i in range(N):
   a=i*math.tau/N;x=math.cos(a)*rx;forward=f+math.sin(a)*rf
   # Slightly proud sternum; the dorsal contour stays more restrained.
   forward+=max(0,math.sin(a))**4*.023*math.exp(-((h-1.52)/.3)**2)
   row.append(vertex((x,forward,h),torso_weights(h)))
  rows.append(row)
 for r in range(len(rows)-1):
  for i in range(N):
   # Two 4-column by 2-row shoulder holes, each with a 12-vertex boundary.
   shoulder_face=r in (5,6) and (i in [22,23,0,1,10,11,12,13])
   if not shoulder_face:faces.append((rows[r][i],rows[r][(i+1)%N],rows[r+1][(i+1)%N],rows[r+1][i]))
 faces.append(tuple(rows[-1]))
 def patch(center):
  indices=[center-2,center-1,center,center+1,center+2]
  return [rows[5][i%N] for i in indices]+[rows[6][(center+2)%N]]+[rows[7][i%N] for i in reversed(indices)]+[rows[6][(center-2)%N]]
 def connect(a,b):
  assert len(a)==len(b)
  for i in range(len(a)):j=(i+1)%len(a);faces.append((a[i],a[j],b[j],b[i]))
 def ring(center,tangent,radius,n,w,previous):
  center=Vector(center);tangent=Vector(tangent).normalized();across=tangent.cross(Vector((0,1,0))).normalized();forward=tangent.cross(across).normalized()
  candidates=[center+across*(math.cos(i*math.tau/n)*radius)+forward*(math.sin(i*math.tau/n)*radius) for i in range(n)]
  # Preserve the attachment boundary order without a helical seam or crossed quads.
  orders=[[(start+direction*i)%n for i in range(n)] for direction in [1,-1] for start in range(n)]
  order=min(orders,key=lambda order:sum((Vector(verts[previous[i]])-candidates[j]).length_squared for i,j in enumerate(order)))
  row=[vertex(candidates[j],dict(w)) for j in order];connect(previous,row);return row
 def limb(family,side,boundary):
  upper=f'{family}_upper_{side}';lower=f'{family}_lower_{side}';paw=f'{family}_paw_{side}'
  a,b,_=REST[upper];_,c,_=REST[lower];a,b,c=Vector(a),Vector(b),Vector(c)
  n=len(boundary);previous=boundary;front=family=='front'
  for t in ([.42,.61,.79,.92,1.] if front else [.24,.45,.65,.83,.94,1.]):
   radius=(.155*(1-t)+.122*t) if front else (.205*(1-t)+.132*t)
   lower_mix=smooth((t-.80)/.40)*.5
   w={upper:1-lower_mix,lower:lower_mix}
   if front and t==.42:w={f'scapula_{side}':.25,upper:.75}
   previous=ring(a+(b-a)*t,b-a,radius,n,w,previous)
  for t in [.07,.18,.35,.57,.77,.92,1.]:
   radius=(.122*(1-t)+.093*t) if front else (.132*(1-t)+.098*t)
   upper_mix=.5*(1-smooth(t/.22));paw_mix=smooth((t-.78)/.22)
   w={upper:upper_mix,lower:(1-upper_mix)*(1-paw_mix),paw:(1-upper_mix)*paw_mix}
   previous=ring(b+(c-b)*t,c-b,radius,n,w,previous)
  faces.append(tuple(reversed(previous)))
 limb('front','L',patch(0));limb('front','R',patch(12))
 # A shared crotch seam branches the pelvis into two legs, preserving one manifold.
 midpoint=vertex((0,-.03,.94),{'pelvis':1.})
 right=[rows[0][i%N] for i in range(18,31)]+[midpoint]
 left=[rows[0][i] for i in range(6,19)]+[midpoint]
 limb('rear','L',right);limb('rear','R',left)
 data=bpy.data.meshes.new('Designed upright joint-loop topology');data.from_pydata([V(p) for p in verts],[],faces);data.update()
 ob=bpy.data.objects.new('Upright body • connected joint topology',data);bpy.context.collection.objects.link(ob);data.materials.append(material)
 groups={name:ob.vertex_groups.new(name=name) for name in REST}
 for i,w in enumerate(weights):
  total=sum(w.values())
  for name,value in w.items():
   if value>0:groups[name].add([i],value/total,'REPLACE')
 # Remove only unused patch-interior control vertices; no voxel remesh/decimation.
 bm=bmesh.new();bm.from_mesh(data);bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS');bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free()
 for p in data.polygons:p.use_smooth=True
 color=data.color_attributes.new(name='FurColor',type='FLOAT_COLOR',domain='POINT')
 for v in data.vertices:
  x,f,h=D(v.co);cream=max(0,min(1,(f+.03)/.36))*.07;shade=max(0,min(1,(-f+.06)/.30))*.05
  color.data[v.index].color=(.790+cream-shade,.714+cream-shade,.611+cream-shade,1)
 uv=data.uv_layers.new(name='Upright coat direction')
 for p in data.polygons:
  for loop in p.loop_indices:
   v=data.vertices[data.loops[loop].vertex_index].co;uv.data[loop].uv=(math.atan2(v.y,v.x)/math.tau*2,v.z)
 subdivision=ob.modifiers.new('Editable joint-loop subdivision','SUBSURF');subdivision.levels=1;subdivision.render_levels=1
 # Retain the coarse edit cage as a named data block, and use the identical
 # four-influence derived surface in Blender and glTF (no silent export truncation).
 cage=data.copy();cage.name='Authored upright control loops';cage.use_fake_user=True;rig['control_topology_mesh']=cage.name
 bpy.context.view_layer.objects.active=ob;ob.select_set(True);bpy.ops.object.modifier_apply(modifier=subdivision.name)
 for v in ob.data.vertices:
  current=sorted([(g.group,g.weight) for g in v.groups],key=lambda item:-item[1]);chosen=current[:4];total=sum(w for _,w in chosen)
  for index,_ in current:ob.vertex_groups[index].remove([v.index])
  for index,w in chosen:ob.vertex_groups[index].add([v.index],w/total,'REPLACE')
 arm=ob.modifiers.new('Upright anatomical skin','ARMATURE');arm.object=rig;ob.parent=rig
 return ob

def solve_two(a,target,l1,l2,pole):
 a=Vector(a);target=Vector(target);v=target-a;requested=v.length;d=max(abs(l1-l2)+.0001,min(l1+l2-.0001,requested));direction=v.normalized()
 projected=Vector(pole)-a;perpendicular=projected-direction*projected.dot(direction)
 if perpendicular.length<.001:perpendicular=direction.cross(Vector((1,0,0)))
 perpendicular.normalize();along=(l1*l1-l2*l2+d*d)/(2*d);height=math.sqrt(max(0,l1*l1-along*along))
 return a+direction*along+perpendicular*height,a+direction*d,abs(requested-d)

def pose(clip,t,duration):
 strike=smooth(t/.18)*(1-smooth((t-.28)/.29)) if clip=='attack' else 0.
 crouch=smooth(t/1.3) if clip=='defeat' else 0.
 guard=smooth(t/.16) if clip=='guard' else 0.
 lift=smooth(t/.35) if clip=='celebrate' else 0.
 lean=.23*strike+.28*crouch+.04*guard;drop=.40*crouch
 def trunk(p):
  x,f,h=p;z=h-.95;return Vector((x,f*math.cos(lean)+z*math.sin(lean),.95-drop+z*math.cos(lean)-f*math.sin(lean)))
 d={name:(Vector(a),Vector(b)) for name,(a,b,parent) in REST.items()}
 for name in ['pelvis','spine','chest','neck','head','jaw','scapula_L','scapula_R']:d[name]=tuple(trunk(p) for p in REST[name][:2])
 errors={}
 for side,s in [('L',1),('R',-1)]:
  upper=f'front_upper_{side}';lower=f'front_lower_{side}';paw=f'front_paw_{side}'
  a=trunk(REST[upper][0]);hand=Vector((s*.40,.44,1.49))
  if clip=='attack':hand=Vector((- .35,.44+.52*strike,1.49-.11*strike)) if side=='R' else Vector((.28,.56,1.73))
  elif clip=='guard':hand=Vector(mix(tuple(hand),(s*.24,.56,1.94),guard))
  elif clip=='defeat':hand=Vector(mix(tuple(hand),(s*.43,.50,.44),crouch))
  elif clip=='celebrate':hand=Vector(mix(tuple(hand),(s*.37,.43,2.50),lift))
  l1=(V(REST[upper][1])-V(REST[upper][0])).length;l2=(V(REST[lower][1])-V(REST[lower][0])).length
  pole=Vector((s*1.0,.10,1.25+lift*.8-drop))
  elbow,hand,error=solve_two(a,hand,l1,l2,pole);errors[paw]=error
  d[upper]=(a,elbow);d[lower]=(elbow,hand);d[paw]=(hand,hand+Vector((0,.18,-.04)))
  upper=f'rear_upper_{side}';lower=f'rear_lower_{side}';paw=f'rear_paw_{side}'
  hip=Vector(REST[upper][0]);hip.z-=drop;ankle=Vector(REST[paw][0])
  l1=(V(REST[upper][1])-V(REST[upper][0])).length;l2=(V(REST[lower][1])-V(REST[lower][0])).length
  knee,ankle,error=solve_two(hip,ankle,l1,l2,(s*.38,.65,.54-drop*.3));errors[paw]=error
  d[upper]=(hip,knee);d[lower]=(knee,ankle);d[paw]=(ankle,ankle+Vector((0,.20,-.06)))
 for i in range(4):
  a,b=REST[f'tail_{i}'][:2];delta=Vector((0,0,-drop*(1-i*.16)));d[f'tail_{i}']=(Vector(a)+delta,Vector(b)+delta)
 return d,errors

def set_pose(rig,d):
 desired={}
 for name,(a,b) in d.items():
  rest=rig.data.bones[name].matrix_local;a,b=V(a),V(b);axis=rest.to_3x3().col[1].normalized();rotation=axis.rotation_difference((b-a).normalized())
  m=rotation.to_matrix().to_4x4()@rest;m.translation=a;desired[name]=m
 for name in REST:
  pb=rig.pose.bones[name];parent=pb.parent
  if parent:pb.matrix_basis=pb.bone.matrix_local.inverted()@parent.bone.matrix_local@desired[parent.name].inverted()@desired[name]
  else:pb.matrix_basis=pb.bone.matrix_local.inverted()@desired[name]
 bpy.context.view_layer.update()

def build():
 control=OUT/'control-input.blend'
 if not control.exists():shutil.copy2(ROOT/'assets/source/western/unicorn.blend',control)
 bpy.ops.wm.open_mainfile(filepath=str(control));old=bpy.data.objects['AnimalRig'];old.animation_data.action=bpy.data.actions['fight_idle']
 for track in old.animation_data.nla_tracks:track.mute=True
 original_body=bpy.data.objects['Body • continuous sculpted skin'];original_body.data.shape_keys.animation_data.action=bpy.data.actions['fight_idle_corrective'];bpy.context.scene.frame_set(1)
 old_mats={b.name:b.matrix.copy() for b in old.pose.bones};material=original_body.data.materials[0]
 deps=bpy.context.evaluated_depsgraph_get();parts=[]
 for ob in list(bpy.context.scene.objects):
  if ob.type!='MESH' or ob==original_body:continue
  ob.data=bpy.data.meshes.new_from_object(ob.evaluated_get(deps),preserve_all_data_layers=True,depsgraph=deps);ob.modifiers.clear();ob.parent=None;parts.append(ob)
 bpy.data.objects.remove(original_body,do_unlink=True);bpy.data.objects.remove(old,do_unlink=True)
 for action in list(bpy.data.actions):bpy.data.actions.remove(action)
 bpy.ops.object.select_all(action='DESELECT');rig=make_rig(old_mats)
 for ob in parts:
  transforms={name:rig.data.bones[name].matrix_local@old_mats[name].inverted() for name in old_mats if name in rig.data.bones}
  for v in ob.data.vertices:
   base=v.co.copy();total=0.;new=Vector()
   for g in v.groups:
    name=ob.vertex_groups[g.group].name
    if name in transforms:new+=(transforms[name]@base)*g.weight;total+=g.weight
   if total:v.co=new/total
  arm=ob.modifiers.new('Upright identity attachment','ARMATURE');arm.object=rig;ob.parent=rig
 body=body_mesh(rig,material);bpy.context.scene.render.fps=FPS
 rig.animation_data_create();reach={}
 for name,duration in CLIPS.items():
  action=bpy.data.actions.new(name);rig.animation_data.action=action;maximum=0.
  for f in range(round(duration*FPS)+1):
   d,errors=pose(name,f/FPS,duration);maximum=max(maximum,max(errors.values()));set_pose(rig,d)
   for pb in rig.pose.bones:
    pb.rotation_mode='QUATERNION';pb.keyframe_insert('location',frame=f+1);pb.keyframe_insert('rotation_quaternion',frame=f+1);pb.keyframe_insert('scale',frame=f+1)
  reach[name]=maximum;action.use_fake_user=True;rig.animation_data.action=None;track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,1,action);track.mute=True
 set_pose(rig,{n:(a,b) for n,(a,b,p) in REST.items()});bpy.context.preferences.filepaths.save_version=0
 bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'unicorn-upright.blend'),compress=True)
 # Apply subdivision before runtime batching; source retains editable joint loops.
 bpy.ops.object.select_all(action='DESELECT');meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
 for ob in meshes:
  bpy.context.view_layer.objects.active=ob
  for modifier in list(ob.modifiers):
   if modifier.type=='SUBSURF':bpy.ops.object.modifier_apply(modifier=modifier.name)
  if not ob.data.color_attributes.get('FurColor'):
   colors=ob.data.color_attributes.new(name='FurColor',type='FLOAT_COLOR',domain='POINT')
   for value in colors.data:value.color=(1,1,1,1)
  ob.select_set(True)
 bpy.context.view_layer.objects.active=body;bpy.ops.object.join();body.name='Unicorn upright experimental runtime skin';rig.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(OUT/'unicorn-upright.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,export_materials='EXPORT',export_yup=True,export_apply=False,export_cameras=False,export_lights=False,export_anim_slide_to_zero=True)
 manifest={'scope':'Dedicated upright topology feasibility; not production replacement or cinematic acceptance','controlInputSha256':digest(control),'sourceSha256':digest(OUT/'unicorn-upright.blend'),'runtimeSha256':digest(OUT/'unicorn-upright.glb'),'maximumRequestedHandReachResidualMetres':reach,'clips':CLIPS,'bodyMethod':'Connected ring/branch topology; authored control mesh retained; subdivided once and normalized to four influences identically in Blender and glTF; no voxel remesh','rigMethod':'Articulated parent hierarchy; fixed-length two-link solves; no pose-space smoothing morphs'}
 (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print('UPRIGHT_EXPERIMENT_BUILT')

def inspect():
 bpy.ops.wm.open_mainfile(filepath=str(OUT/'unicorn-upright.blend'));rig=bpy.data.objects['UprightRig'];ob=bpy.data.objects['Upright body • connected joint topology']
 bm=bmesh.new();bm.from_mesh(ob.data);seen=set();components=0
 for vertex in bm.verts:
  if vertex in seen:continue
  components+=1;stack=[vertex];seen.add(vertex)
  while stack:
   current=stack.pop()
   for edge in current.link_edges:
    other=edge.other_vert(current)
    if other not in seen:seen.add(other);stack.append(other)
 cage=bpy.data.meshes[rig['control_topology_mesh']]
 topology={'components':components,'boundaryEdges':sum(e.is_boundary for e in bm.edges),'nonManifoldEdges':sum(not e.is_manifold for e in bm.edges),'surfaceVertices':len(bm.verts),'surfaceFaces':len(bm.faces),'controlVertices':len(cage.vertices),'controlFaces':len(cage.polygons)};bm.free()
 assert components==1 and topology['boundaryEdges']==0 and topology['nonManifoldEdges']==0,topology
 records={};scene=bpy.context.scene
 for name,dur in CLIPS.items():
  rig.animation_data.action=bpy.data.actions[name];bounds=[];scale_error=0.;min_area=1e9
  for frame in range(1,round(dur*FPS)+2):
   scene.frame_set(frame);deps=bpy.context.evaluated_depsgraph_get();evaluated=ob.evaluated_get(deps);points=[v.co for v in evaluated.data.vertices]
   assert all(math.isfinite(c) for p in points for c in p)
   bounds.append(([min(p[i] for p in points) for i in range(3)],[max(p[i] for p in points) for i in range(3)]))
   for bone in rig.pose.bones:scale_error=max(scale_error,max(abs(s-1) for s in bone.matrix.to_scale()))
   for face in evaluated.data.polygons:min_area=min(min_area,face.area)
  assert scale_error<.0002,(name,scale_error)
  records[name]={'bodyMin': [min(b[0][i] for b in bounds) for i in range(3)],'bodyMax':[max(b[1][i] for b in bounds) for i in range(3)],'maximumBoneScaleError':scale_error,'minimumEvaluatedFaceArea':min_area,'sampledFrames':len(bounds)}
 report={'sourceSha256':digest(OUT/'unicorn-upright.blend'),'runtimeSha256':digest(OUT/'unicorn-upright.glb'),'topology':topology,'boneParents':{b.name:b.parent.name if b.parent else None for b in rig.data.bones},'clips':records,'limitations':'Topology/finite values/unit scale do not prove good anatomy, lack of self-intersections, or cinematic quality.'}
 (OUT/'source-inspection.json').write_text(json.dumps(report,indent=2)+'\n');print('UPRIGHT_SOURCE_CHECKS_OK')

def render(which='experiment'):
 # GPU rendering is intentionally a separate explicit command for team coordination.
 control=which=='control';bpy.ops.wm.open_mainfile(filepath=str(OUT/('control-input.blend' if control else 'unicorn-upright.blend')))
 rig=bpy.data.objects['AnimalRig' if control else 'UprightRig'];scene=bpy.context.scene
 for track in rig.animation_data.nla_tracks:track.mute=True
 keys=bpy.data.objects['Body • continuous sculpted skin'].data.shape_keys if control else None
 if keys:
  for track in keys.animation_data.nla_tracks:track.mute=True
 scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True
 prefs=bpy.context.preferences.addons['cycles'].preferences
 try:
  prefs.compute_device_type='METAL';prefs.get_devices()
  for device in prefs.devices:device.use=device.type=='METAL'
  scene.cycles.device='GPU'
 except Exception:pass
 scene.render.resolution_x=700;scene.render.resolution_y=700;scene.render.resolution_percentage=100
 scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.17,.19,.24,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
 scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
 mat=bpy.data.materials.new('Review stage');mat.diffuse_color=(.17,.105,.06,1)
 bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.02));bpy.context.object.data.materials.append(mat)
 for loc,power,color,size in [((-3,-4,6),650,(1,.71,.43),4),((3,-1,4),470,(.5,.68,1),5),((0,4,4),1000,(1,.52,.27),3)]:
  data=bpy.data.lights.new('Review lighting','AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size;lamp=bpy.data.objects.new('Review lighting',data);scene.collection.objects.link(lamp);lamp.location=loc;lamp.rotation_euler=(Vector((0,0,1))-lamp.location).to_track_quat('-Z','Y').to_euler()
 data=bpy.data.cameras.new('Review camera');cam=bpy.data.objects.new('Review camera',data);scene.collection.objects.link(cam);scene.camera=cam;data.type='ORTHO';data.ortho_scale=3.8
 views={'three-quarter':(3.5,-5.2,2.9),'side':(5.5,0,2.3)};out=OUT/'qa'/which;out.mkdir(parents=True,exist_ok=True)
 for label,location in views.items():
  cam.location=location;cam.rotation_euler=(Vector((0,0,1.25))-cam.location).to_track_quat('-Z','Y').to_euler()
  for clip,frame in [('fight_idle',1),('attack',7),('guard',7),('defeat',40),('celebrate',16)]:
   rig.animation_data.action=bpy.data.actions[clip]
   if keys:keys.animation_data.action=bpy.data.actions[clip+'_corrective']
   scene.frame_set(frame);scene.render.filepath=str(out/f'{label}-{clip}.png');bpy.ops.render.render(write_still=True)
  # Short complete transitions, not only favorable extrema. Workbench is deformation-only.
  scene.render.engine='BLENDER_WORKBENCH';scene.render.resolution_x=400;scene.render.resolution_y=400;scene.display.shading.light='STUDIO';scene.display.shading.studio_light='paint.sl';scene.display.shading.color_type='MATERIAL';scene.display.shading.show_shadows=True;scene.display.shading.show_cavity=True
  for clip in ['attack','guard','defeat','celebrate']:
   rig.animation_data.action=bpy.data.actions[clip]
   if keys:keys.animation_data.action=bpy.data.actions[clip+'_corrective']
   end=round(CLIPS[clip]*FPS)+1;folder=out/f'{label}-{clip}';folder.mkdir(exist_ok=True)
   for old in folder.glob('*.png'):old.unlink()
   for frame in sorted(set(list(range(1,end+1,2))+[end])):
    scene.frame_set(frame);scene.render.filepath=str(folder/f'{frame:04}.png');bpy.ops.render.render(write_still=True)
  scene.render.engine='CYCLES';scene.render.resolution_x=700;scene.render.resolution_y=700
 print('UPRIGHT_REVIEW_RENDERED',which)

def compare_geometry():
 # Read both actual skins at matching action times. Edge-length distributions and
 # closed signed volume reveal local stretching/collapse that a bounds test misses.
 # They remain diagnostics, not a proof of pleasing anatomy or no self-intersection.
 records={}
 for variant in ['control','experiment']:
  control=variant=='control';path=OUT/('control-input.blend' if control else 'unicorn-upright.blend');bpy.ops.wm.open_mainfile(filepath=str(path))
  rig=bpy.data.objects['AnimalRig' if control else 'UprightRig'];body=bpy.data.objects['Body • continuous sculpted skin' if control else 'Upright body • connected joint topology']
  keys=body.data.shape_keys if control else None
  def sample(clip,frame):
   rig.animation_data.action=bpy.data.actions[clip]
   if keys:keys.animation_data.action=bpy.data.actions[clip+'_corrective']
   bpy.context.scene.frame_set(frame);deps=bpy.context.evaluated_depsgraph_get();mesh=body.evaluated_get(deps).data
   points=[v.co.copy() for v in mesh.vertices];lengths=[(points[e.vertices[0]]-points[e.vertices[1]]).length for e in mesh.edges]
   mesh.calc_loop_triangles();volume=sum(points[t.vertices[0]].dot(points[t.vertices[1]].cross(points[t.vertices[2]]))/6 for t in mesh.loop_triangles)
   return lengths,volume
  reference,volume=sample('fight_idle',1);result={}
  for clip,frame in [('fight_idle',1),('attack',7),('guard',7),('defeat',40),('celebrate',16)]:
   current,v=sample(clip,frame);assert len(current)==len(reference)
   ratios=sorted(a/b for a,b in zip(current,reference) if b>1e-7)
   result[clip]={'frame':frame,'signedVolumeRatioToFightIdle':v/volume,'edgeLengthRatioP01':ratios[round((len(ratios)-1)*.01)],'edgeLengthRatioP50':ratios[len(ratios)//2],'edgeLengthRatioP99':ratios[round((len(ratios)-1)*.99)],'minimumEdgeLengthRatio':ratios[0],'maximumEdgeLengthRatio':ratios[-1],'fractionEdgesUnder20PercentReferenceLength':sum(x<.2 for x in ratios)/len(ratios),'fractionEdgesOver200PercentReferenceLength':sum(x>2 for x in ratios)/len(ratios)}
  records[variant]={'sourceSha256':digest(path),'bodyReferenceVolume':volume,'referenceEdgeCount':len(reference),'poses':result}
 (OUT/'geometry-comparison.json').write_text(json.dumps({'method':'Actual evaluated body-surface edges and signed volume, relative to each model fight_idle pose; matching action frames. Different topology/proportions limit cross-model interpretation. No visual acceptance implied.','records':records},indent=2)+'\n');print('UPRIGHT_GEOMETRY_COMPARISON_RECORDED')

def package_reviews():
 import subprocess,tempfile
 qa=OUT/'qa';manifest=json.loads((OUT/'manifest.json').read_text());timelines={}
 def ffmpeg(args):subprocess.run(['ffmpeg','-v','error','-y','-filter_threads','1','-filter_complex_threads','1']+args,check=True)
 with tempfile.TemporaryDirectory(prefix='upright-review-') as temporary:
  temp=Path(temporary)
  for view in ['three-quarter','side']:
   files=[];timeline=[];elapsed=0.
   for clip in ['attack','guard','defeat','celebrate']:
    end=round(CLIPS[clip]*FPS)+1;expected=sorted(set(list(range(1,end+1,2))+[end]))
    for variant in ['control','experiment']:
     folder=qa/variant/f'{view}-{clip}';frames=sorted(folder.glob('*.png'));assert [int(p.stem) for p in frames]==expected
    output=temp/f'{view}-{clip}.mp4';files.append(output)
    ffmpeg(['-framerate','15','-pattern_type','glob','-i',str(qa/'control'/f'{view}-{clip}'/'*.png'),'-framerate','15','-pattern_type','glob','-i',str(qa/'experiment'/f'{view}-{clip}'/'*.png'),'-filter_complex','hstack=inputs=2','-threads','1','-c:v','libx264','-crf','20','-pix_fmt','yuv420p',str(output)])
    ffmpeg(['-i',str(output),'-vf',f'scale=400:200,tile=4x{(len(expected)+3)//4}:padding=2:margin=2:color=0x201b1a','-frames:v','1',str(qa/f'{view}-{clip}-cycle-comparison.png')])
    duration=len(expected)/15;timeline.append({'clip':clip,'sourceFrames':expected,'start':elapsed,'end':elapsed+duration});elapsed+=duration
   listing=temp/f'{view}.txt';listing.write_text(''.join("file '"+str(p)+"'\n" for p in files));movie=qa/f'{view}-paired-transitions.mp4'
   ffmpeg(['-f','concat','-safe','0','-i',str(listing),'-c','copy','-movflags','+faststart',str(movie)])
   info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(movie)]));assert abs(float(info['format']['duration'])-elapsed)<.10
   timelines[view]={'movie':movie.name,'duration':float(info['format']['duration']),'clips':timeline}
   for clip in CLIPS:
    ffmpeg(['-i',str(qa/'control'/f'{view}-{clip}.png'),'-i',str(qa/'experiment'/f'{view}-{clip}.png'),'-filter_complex','hstack=inputs=2','-frames:v','1',str(qa/f'{view}-{clip}-comparison.png')])
 (qa/'review-index.json').write_text(json.dumps({'comparisonOrder':'Left: frozen production control. Right: dedicated upright experiment.','sourceHashes':{k:manifest[k] for k in ['controlInputSha256','sourceSha256','runtimeSha256']},'scope':'Paired source rendering, not normal-input gameplay or visual acceptance. Workbench movies inspect deformation; Cycles stills inspect appearance.','sampleRate':15,'views':timelines},indent=2)+'\n')
 # Only transient numbered frames are pruned, after complete-cycle/movie checks.
 for variant in ['control','experiment']:
  for view in ['three-quarter','side']:
   for clip in ['attack','guard','defeat','celebrate']:shutil.rmtree(qa/variant/f'{view}-{clip}')
 print('UPRIGHT_REVIEWS_PACKAGED')

if __name__=='__main__':
 args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['build']
 if args[0]=='build':build()
 elif args[0]=='inspect':inspect()
 elif args[0]=='render':render(args[1] if len(args)>1 else 'experiment')
 elif args[0]=='compare':compare_geometry()
 elif args[0]=='package':package_reviews()
 else:raise ValueError(args)
