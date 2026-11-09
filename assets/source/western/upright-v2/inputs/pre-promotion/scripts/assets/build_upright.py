"""Separate upright roster production from the proven joint-loop experiment.
Original racing sources/exports and the experiment snapshot are never overwritten.
Blender --background --python scripts/assets/build_upright.py -- build [all|lion|wolf|unicorn]
"""
import bpy,bmesh,math,json,hashlib,shutil,sys,struct
from pathlib import Path
from mathutils import Vector,Matrix
sys.path.insert(0,str(Path(__file__).resolve().parent))
import experiment_upright as exp
ROOT=Path(__file__).resolve().parents[2];SOURCE=ROOT/'assets/source/western';OUT=SOURCE/'upright-v1';PUBLIC=ROOT/'public/assets/western'
OUT.mkdir(exist_ok=True);(OUT/'inputs').mkdir(exist_ok=True)
V,D,smooth,mix,solve_two,set_pose=exp.V,exp.D,exp.smooth,exp.mix,exp.solve_two,exp.set_pose
REST=exp.skeleton();FPS=30
CLIPS={'transform':1.2,'fight_idle':2.,'fight_move':.4,'attack':.57,'special':1.,'guard':.6,'hit':.4,'defeat':1.3,'celebrate':2.,'jump':.8,'land':.3}
PALETTE={'lion':{'coat':'D89C46','cream':'F4DB9A','shadow':'9A592B'},'wolf':{'coat':'728DAD','cream':'C0DAE2','shadow':'34435F'},'unicorn':{'coat':'E6DCCD','cream':'FFF0D3','shadow':'A7A6C3'}}
def rgb(value):
 def linear(x):return x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4
 return tuple(linear(int(value[i:i+2],16)/255) for i in (0,2,4))
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()

def body_mesh(rig,material,kind):
 verts=[];faces=[];weights=[]
 width,depth,arm_mass,leg_mass={"lion":(1.14,1.12,1.24,1.10),"wolf":(.92,.92,.94,.98),"unicorn":(1.,1.,1.,1.)}[kind]
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
  factor=smooth((1.98-h)/.35);rx*=1+(width-1)*factor;rf*=1+(depth-1)*factor
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
  center=Vector(center);tangent=Vector(tangent).normalized();across=tangent.cross(Vector((0,1,0)))
  if across.length<.001:across=tangent.cross(Vector((0,0,1)))
  across.normalize();forward=tangent.cross(across).normalized();rx,ry=radius if isinstance(radius,tuple) else (radius,radius)
  candidates=[center+across*(math.cos(i*math.tau/n)*rx)+forward*(math.sin(i*math.tau/n)*ry) for i in range(n)]
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
   radius*=arm_mass if front else leg_mass
   lower_mix=smooth((t-.80)/.40)*.5
   w={upper:1-lower_mix,lower:lower_mix}
   if front and t==.42:w={f'scapula_{side}':.25,upper:.75}
   previous=ring(a+(b-a)*t,b-a,radius,n,w,previous)
  for t in [.07,.18,.35,.57,.77,.92,1.]:
   radius=(.122*(1-t)+.093*t) if front else (.132*(1-t)+.098*t)
   radius*=arm_mass if front else leg_mass
   upper_mix=.5*(1-smooth(t/.22));paw_mix=smooth((t-.78)/.22)
   w={upper:upper_mix,lower:(1-upper_mix)*(1-paw_mix),paw:(1-upper_mix)*paw_mix}
   previous=ring(b+(c-b)*t,c-b,radius,n,w,previous)
  if kind!='unicorn':
   # Connected padded palm/sole belongs to the same limb topology; retained toes
   # and claws attach to it, rather than floating beyond an empty wrist cap.
   scale=1. if kind=='lion' else .94
   for f,h,rx,rz in [(-.025,-.03,.108,.075),(.05,-.055,.181,.105),(.15,-.065,.182,.083),(.245,-.065,.065,.025)]:
    previous=ring(c+Vector((0,f,h)),(0,1,0),(rx*scale,rz*scale),n,{paw:1.},previous)
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
 colors={key:Vector(rgb(value)) for key,value in PALETTE[kind].items()}
 for v in data.vertices:
  x,f,h=D(v.co);base=colors['coat'].copy()
  bib=max(0,min(1,(f-.04)/.30))*smooth((h-1.06)/.2)*(1-smooth((h-1.72)/.28))
  base=base.lerp(colors['cream'],bib*.65)
  if kind=='wolf':base=base.lerp(colors['shadow'],max(0,min(1,(-f+.015)/.25))*.55)
  base*=1+.012*math.sin(h*64+x*28+f*23)
  color.data[v.index].color=(*base,1)
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

def pack_vertex_colors(path):
 # Core glTF normalized RGBA16 plus normalized four-weight skinning. Quantized
 # weights sum exactly to 65535; maximum per-weight error is below 2/65535.
 # No geometry/normal/texture reduction or runtime codec is needed.
 import struct
 data=path.read_bytes();json_length=struct.unpack_from('<I',data,12)[0]
 doc=json.loads(data[20:20+json_length]);bin_offset=20+json_length+8
 binary=data[bin_offset:];replacements={};seen=set()
 for primitive in doc['meshes'][0]['primitives']:
  index=primitive['attributes'].get('COLOR_0')
  if index is None or index in seen:continue
  seen.add(index);access=doc['accessors'][index];view_index=access['bufferView'];view=doc['bufferViews'][view_index]
  assert access['componentType']==5126 and access['type']=='VEC3'
  assert not view.get('byteStride') and not access.get('byteOffset') and not access.get('sparse')
  assert sum(a.get('bufferView')==view_index for a in doc['accessors'])==1
  values=struct.unpack_from('<'+'f'*(access['count']*3),binary,view.get('byteOffset',0));packed=[]
  for i in range(0,len(values),3):
   for v in values[i:i+3]:
    assert -.000001<=v<=1.000001
    q=round(max(0,min(1,v))*65535);assert abs(q/65535-v)<.000008;packed.append(q)
   packed.append(65535)
  replacements[view_index]=struct.pack('<'+'H'*len(packed),*packed)
  access['componentType']=5123;access['type']='VEC4';access['normalized']=True
  access.pop('min',None);access.pop('max',None)
 for primitive in doc['meshes'][0]['primitives']:
  index=primitive['attributes'].get('WEIGHTS_0')
  if index is None or index in seen:continue
  seen.add(index);access=doc['accessors'][index];view_index=access['bufferView'];view=doc['bufferViews'][view_index]
  assert access['componentType']==5126 and access['type']=='VEC4'
  assert not view.get('byteStride') and not access.get('byteOffset')
  assert sum(a.get('bufferView')==view_index for a in doc['accessors'])==1
  values=struct.unpack_from('<'+'f'*(access['count']*4),binary,view.get('byteOffset',0));packed=[]
  for i in range(0,len(values),4):
   weights=values[i:i+4];total=sum(weights);assert abs(total-1)<.0001
   quantized=[round(v/total*65535) for v in weights]
   largest=max(range(4),key=lambda j:weights[j]);quantized[largest]+=65535-sum(quantized)
   assert all(0<=q<=65535 and abs(q/65535-v)<2/65535 for q,v in zip(quantized,weights))
   packed.extend(quantized)
  replacements[view_index]=struct.pack('<'+'H'*len(packed),*packed)
  access['componentType']=5123;access['normalized']=True
  access.pop('min',None);access.pop('max',None)
 output=bytearray()
 for index,view in enumerate(doc['bufferViews']):
  while len(output)%4:output.append(0)
  block=replacements.get(index,binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']])
  view['byteOffset']=len(output);view['byteLength']=len(block);output.extend(block)
 doc['buffers'][0]['byteLength']=len(output)
 while len(output)%4:output.append(0)
 encoded=json.dumps(doc,separators=(',',':')).encode()
 while len(encoded)%4:encoded+=b' '
 path.write_bytes(struct.pack('<III',0x46546c67,2,12+8+len(encoded)+8+len(output))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(output),0x004e4942)+output)

def pose(kind,clip,t,duration):
 wind=smooth(t/.10)*(1-smooth((t-.10)/.08)) if clip=='attack' else 0.
 strike=smooth((t-.10)/.08)*(1-smooth((t-.28)/.29)) if clip=='attack' else 0.
 crouch=smooth(t/1.3) if clip=='defeat' else (.65*(1-smooth(t/1.2)) if clip=='transform' else 0.)
 guard=smooth(t/.16) if clip=='guard' else 0.
 lift=smooth(t/.35) if clip=='celebrate' else 0.
 special=0.
 if clip=='special':
  windup,active,recovery={'lion':(.32,.14,.48),'wolf':(.43,.16,.55),'unicorn':(.40,.12,.43)}[kind]
  special=smooth(t/windup)*(1-smooth((t-windup-active)/recovery))
 recoil=math.sin(t/duration*math.pi) if clip=='hit' else 0.
 tuck=math.sin(t/duration*math.pi)**2 if clip=='jump' else 0.
 landing=math.sin(t/duration*math.pi) if clip=='land' else 0.
 breath=math.sin(t*math.tau/2)*.006 if clip=='fight_idle' else 0.
 lean=.23*strike-.055*wind+.28*crouch+.04*guard-.17*recoil
 if clip=='special':lean+=special*({'lion':.15,'wolf':-.055,'unicorn':.015}[kind])
 drop=.40*crouch+.06*(clip=='fight_move')+.035*recoil+.07*tuck+.12*landing-breath
 def trunk(p):
  x,f,h=p;z=h-.95;return Vector((x,f*math.cos(lean)+z*math.sin(lean),.95-drop+z*math.cos(lean)-f*math.sin(lean)))
 d={name:(Vector(a),Vector(b)) for name,(a,b,parent) in REST.items()}
 for name in ['pelvis','spine','chest','neck','head','jaw','scapula_L','scapula_R']:d[name]=tuple(trunk(p) for p in REST[name][:2])
 errors={}
 for side,s in [('L',1),('R',-1)]:
  upper=f'front_upper_{side}';lower=f'front_lower_{side}';paw=f'front_paw_{side}'
  a=trunk(REST[upper][0]);hand=Vector((s*.40,.44,1.49+breath))
  if clip=='attack':
   endx=-.23 if kind=='lion' else -.35;endf=1.01 if kind=='wolf' else .96;endh=1.38 if kind=='unicorn' else 1.55
   hand=Vector((-.40*(1-strike)+endx*strike,.44-.12*wind+(endf-.44)*strike,1.49+(endh-1.49)*strike)) if side=='R' else Vector((.28,.56,1.73))
  elif clip=='guard':hand=Vector(mix(tuple(hand),(s*.24,.56,1.94),guard))
  elif clip in ['defeat','transform']:hand=Vector(mix(tuple(hand),(s*.43,.50,.44),crouch))
  elif clip=='celebrate':hand=Vector(mix(tuple(hand),(s*.37,.43,2.50),lift))
  elif clip=='hit':hand+=Vector((0,-.04*recoil,-.08*recoil))
  elif clip=='jump':hand+=Vector((-s*.05*tuck,.07*tuck,.10*tuck))
  elif clip=='land':hand.z-=.10*landing
  elif clip=='fight_move':hand.y+=s*.025*math.sin(t/duration*math.tau)
  elif clip=='special':
   target={'lion':(s*.35,.90,1.55),'wolf':(s*.52,.26,1.24),'unicorn':(s*.21,.56,1.84)}[kind]
   hand=Vector(mix(tuple(hand),target,special))
  l1=(V(REST[upper][1])-V(REST[upper][0])).length;l2=(V(REST[lower][1])-V(REST[lower][0])).length
  pole=Vector((s*1.0,.10,1.25+lift*.8-drop))
  elbow,hand,error=solve_two(a,hand,l1,l2,pole);errors[paw]=error
  d[upper]=(a,elbow);d[lower]=(elbow,hand);d[paw]=(hand,hand+Vector((0,.18,-.04)))
  upper=f'rear_upper_{side}';lower=f'rear_lower_{side}';paw=f'rear_paw_{side}'
  hip=Vector(REST[upper][0]);hip.z-=drop;ankle=Vector(REST[paw][0])
  if clip=='fight_move':
   phase=(t/duration+(0 if side=='L' else .5))%1
   if phase<.5:stride=.36-.72*(phase/.5);foot_lift=0.
   else:recovery=(phase-.5)*2;stride=-.36+.72*smooth(recovery);foot_lift=math.sin(recovery*math.pi)*.10
   ankle.y+=stride;ankle.z+=foot_lift
  elif clip=='jump':ankle.y+=.10*tuck;ankle.z+=.18*tuck
  l1=(V(REST[upper][1])-V(REST[upper][0])).length;l2=(V(REST[lower][1])-V(REST[lower][0])).length
  knee,ankle,error=solve_two(hip,ankle,l1,l2,(s*.38,.65,.54-drop*.3));errors[paw]=error
  d[upper]=(hip,knee);d[lower]=(knee,ankle);d[paw]=(ankle,ankle+Vector((0,.20,-.06)))
 # A true connected tail chain keeps each segment length; no free-floating links.
 current=Vector(REST['tail_0'][0])+Vector((0,0,-drop))
 for i in range(4):
  a,b,_=REST[f'tail_{i}'];delta=Vector(b)-Vector(a);angle=math.sin(t*3+i*.45)*.10
  # Lift the articulated tail as the pelvis crouches so long Unicorn ribbons
  # retain floor clearance; rotate each segment, never shorten or translate it.
  curl=crouch*.75;delta=Vector((delta.x,delta.y*math.cos(curl)+delta.z*math.sin(curl),-delta.y*math.sin(curl)+delta.z*math.cos(curl)))
  delta=Vector((delta.y*math.sin(angle),delta.y*math.cos(angle),delta.z));end=current+delta
  d[f'tail_{i}']=(current,end);current=end
 # Jaw/head movement is articulated around the current head pivot.
 pitch=-.40*special if kind=='wolf' and clip=='special' else 0.
 if pitch:
  anchor=d['head'][0]
  def head_turn(point):
   v=point-anchor;return anchor+Vector((v.x,v.y*math.cos(pitch)+v.z*math.sin(pitch),v.z*math.cos(pitch)-v.y*math.sin(pitch)))
  d['head']=(anchor,head_turn(d['head'][1]));d['jaw']=tuple(head_turn(p) for p in d['jaw'])
 opening=(.10*special if kind=='wolf' and clip=='special' else (.055*max(special,strike) if kind=='lion' else 0.))
 if opening:
  ja,jb=d['jaw'];delta=jb-ja;angle=-opening/.31
  d['jaw']=(ja,ja+Vector((delta.x,delta.y*math.cos(angle)-delta.z*math.sin(angle),delta.z*math.cos(angle)+delta.y*math.sin(angle))))
 return d,errors

def build(kind):
 CLIPS['special']={'lion':.94,'wolf':1.14,'unicorn':.95}[kind]
 control=OUT/'inputs'/f'{kind}.blend'
 if not control.exists():shutil.copy2(SOURCE/f'{kind}.blend',control)
 bpy.ops.wm.open_mainfile(filepath=str(control));old=bpy.data.objects['AnimalRig'];old.animation_data.action=bpy.data.actions['fight_idle']
 for track in old.animation_data.nla_tracks:track.mute=True
 original_body=bpy.data.objects['Body • continuous sculpted skin'];original_body.data.shape_keys.animation_data.action=bpy.data.actions['fight_idle_corrective'];bpy.context.scene.frame_set(1)
 old_mats={b.name:b.matrix.copy() for b in old.pose.bones};material=original_body.data.materials[0];deps=bpy.context.evaluated_depsgraph_get();parts=[]
 for ob in list(bpy.context.scene.objects):
  if ob.type!='MESH' or ob==original_body:continue
  ob.data=bpy.data.meshes.new_from_object(ob.evaluated_get(deps),preserve_all_data_layers=True,depsgraph=deps);ob.modifiers.clear();ob.parent=None;parts.append(ob)
 bpy.data.objects.remove(original_body,do_unlink=True);bpy.data.objects.remove(old,do_unlink=True)
 for action in list(bpy.data.actions):bpy.data.actions.remove(action)
 bpy.ops.object.select_all(action='DESELECT');exp.REST=REST;rig=exp.make_rig(old_mats);rig.name='UprightRig'
 for ob in parts:
  transforms={name:rig.data.bones[name].matrix_local@old_mats[name].inverted() for name in old_mats if name in rig.data.bones}
  for v in ob.data.vertices:
   base=v.co.copy();total=0.;new=Vector()
   for g in v.groups:
    name=ob.vertex_groups[g.group].name
    if name in transforms:new+=(transforms[name]@base)*g.weight;total+=g.weight
   if total:v.co=new/total
  arm=ob.modifiers.new('Upright species attachment','ARMATURE');arm.object=rig;ob.parent=rig
 body=body_mesh(rig,material,kind);bpy.context.scene.render.fps=FPS
 rig['character']=kind;rig['form']='upright';rig['forward']='Blender -Y, glTF +Z';rig['nominalFightMoveSpeed']=3.6;rig['cupPivotHeight']=2.50;rig['cupLiftDuration']=.35;rig['transformDuration']=1.2;rig['quality_status']='Dedicated upright integration candidate; cinematic acceptance open'
 rig.animation_data_create();reach={}
 for name,duration in CLIPS.items():
  action=bpy.data.actions.new(name);rig.animation_data.action=action;maximum=0.
  for f in range(round(duration*FPS)+1):
   d,errors=pose(kind,name,f/FPS,duration);maximum=max(maximum,max(errors.values()));set_pose(rig,d)
   for pb in rig.pose.bones:
    pb.rotation_mode='QUATERNION';pb.keyframe_insert('location',frame=f+1);pb.keyframe_insert('rotation_quaternion',frame=f+1);pb.keyframe_insert('scale',frame=f+1)
  reach[name]=maximum;action.use_fake_user=True;rig.animation_data.action=None;track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,1,action);track.mute=True
 set_pose(rig,{n:(a,b) for n,(a,b,p) in REST.items()});bpy.context.preferences.filepaths.save_version=0
 source=SOURCE/f'{kind}-upright.blend';runtime=PUBLIC/f'{kind}-upright.glb';bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True)
 bpy.ops.object.select_all(action='DESELECT');meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
 for ob in meshes:
  bpy.context.view_layer.objects.active=ob
  if not ob.data.color_attributes.get('FurColor'):
   colors=ob.data.color_attributes.new(name='FurColor',type='FLOAT_COLOR',domain='POINT')
   for value in colors.data:value.color=(1,1,1,1)
  ob.select_set(True)
 bpy.context.view_layer.objects.active=body;bpy.ops.object.join();body.name=kind+' • upright runtime skin';rig.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(runtime),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,export_materials='EXPORT',export_yup=True,export_apply=False,export_cameras=False,export_lights=False,export_anim_slide_to_zero=True)
 pack_vertex_colors(runtime)
 (OUT/f'{kind}-manifest.json').write_text(json.dumps({'species':kind,'status':'Upright integration candidate; cinematic acceptance open','controlInputSha256':digest(control),'sourceSha256':digest(source),'runtimeSha256':digest(runtime),'bytes':runtime.stat().st_size,'clips':CLIPS.copy(),'maximumRequestedTargetReachResidualMetres':reach,'method':'Dedicated connected upright joint-loop surface, intentional species mass and coat palette, articulated fixed-length limb hierarchy; no quadruped skin-stretch morphs.'},indent=2)+'\n')
 print('UPRIGHT_EXPORTED',kind,runtime.stat().st_size,flush=True)

if __name__=='__main__':
 args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['build','all'];command=args[0];species=args[1] if len(args)>1 else 'all'
 if command=='build':
  for kind in (PALETTE if species=='all' else [species]):build(kind)
 else:raise ValueError(args)
