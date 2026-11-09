"""Isolated Mast head study. Launch Blender --disable-autoexec, two CPU threads.
Never writes canonical assets. Untrusted embedded texts/drivers are never executed.
"""
import bpy,bmesh,math,json,hashlib,sys
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'assets/source/western/mast-head-study'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def frozen():
 r=json.loads((OUT/'provenance.json').read_text())
 for n,h in r['sourceFiles'].items():assert sha(OUT/n)==h,n
 for n,h in r['canonicalFreeze'].items():assert sha(ROOT/n)==h,n

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
   for d in ad.drivers if ad else []:drivers.append({'block':block.name,'path':d.data_path,'type':d.driver.type});d.mute=True
   nt=getattr(block,'node_tree',None)
   if nt and nt.animation_data:
    for d in nt.animation_data.drivers:drivers.append({'block':nt.name,'path':d.data_path,'type':d.driver.type});d.mute=True
 return drivers

def bounds(points):
 ps=list(points);return {'min':[min(p[i] for p in ps) for i in range(3)],'max':[max(p[i] for p in ps) for i in range(3)]}
def topology(me):
 me.calc_loop_triangles();uses={};adj=[set() for _ in me.vertices]
 for f in me.polygons:
  for a,b in f.edge_keys:
   k=tuple(sorted((a,b)));uses[k]=uses.get(k,0)+1;adj[a].add(b);adj[b].add(a)
 todo=set(range(len(adj)));components=[]
 while todo:
  stack=[todo.pop()];count=0
  while stack:
   a=stack.pop();count+=1
   for b in adj[a]&todo:todo.remove(b);stack.append(b)
  components.append(count)
 return {'vertices':len(me.vertices),'polygons':len(me.polygons),'triangles':len(me.loop_triangles),'components':sorted(components,reverse=True),'boundaryEdges':sum(n==1 for n in uses.values()),'nonmanifoldEdgesOverTwoFaces':sum(n>2 for n in uses.values())}
def evaluated(ob):
 bpy.context.view_layer.update();ev=ob.evaluated_get(bpy.context.evaluated_depsgraph_get());me=ev.to_mesh();r=topology(me);r['bounds']=bounds(ev.matrix_world@v.co for v in me.vertices);ev.to_mesh_clear();return r

def inspect():
 frozen();drivers=safe_load(OUT/'inputs/Mast.blend');rig=bpy.data.objects['ArmatureMast'];head=rig.data.bones['Head'];desc={'Head'}|{b.name for b in head.children_recursive}
 r={'sourceSha256':sha(OUT/'inputs/Mast.blend'),'recipeSha256':sha(Path(__file__)),'autoExecutionDisabled':not bpy.context.preferences.filepaths.use_scripts_auto_execute,'driversMuted':drivers,'textBlocks':[{'name':t.name,'sha256':hashlib.sha256(t.as_string().encode()).hexdigest()} for t in bpy.data.texts],'libraries':[l.filepath for l in bpy.data.libraries],'actions':[a.name for a in bpy.data.actions],'images':[{'name':i.name,'size':list(i.size),'path':i.filepath} for i in bpy.data.images],'bones':[],'meshes':[],'materials':[]}
 for b in rig.data.bones:
  if b.name in desc or b.name.startswith('Spine'):
   r['bones'].append({'name':b.name,'parent':b.parent.name if b.parent else None,'head':list(rig.matrix_world@b.head_local),'tail':list(rig.matrix_world@b.tail_local),'deform':b.use_deform,'constraints':[{'type':c.type,'target':getattr(getattr(c,'target',None),'name',None),'subtarget':getattr(c,'subtarget',None)} for c in rig.pose.bones[b.name].constraints]})
 for ob in [bpy.data.objects['Mast2024-11'],bpy.data.objects['Mast.Juba']]:
  me=ob.data;mr={'name':ob.name,**topology(me),'bounds':bounds(ob.matrix_world@v.co for v in me.vertices),'colorAttributes':[{'name':c.name,'domain':c.domain,'type':c.data_type,'count':len(c.data)} for c in me.color_attributes],'uvLayers':[u.name for u in me.uv_layers],'weightCounts':{},'headCandidateBounds':None,'levels':{},'modifiers':[{'name':m.name,'type':m.type,'show':m.show_viewport,'group':getattr(m,'vertex_group',None),'invert':getattr(m,'invert_vertex_group',None)} for m in ob.modifiers]}
  candidate=[]
  for v in me.vertices:
   weights={ob.vertex_groups[g.group].name:g.weight for g in v.groups if g.weight>1e-6}
   for n,w in weights.items():mr['weightCounts'][n]=mr['weightCounts'].get(n,0)+1
   if sum(w for n,w in weights.items() if n in desc)>.5:candidate.append(ob.matrix_world@v.co)
  if candidate:mr['headCandidateBounds']=bounds(candidate);mr['headCandidateVertices']=len(candidate)
  for level in [0,1]:
   for m in ob.modifiers:
    if m.type=='SUBSURF':m.levels=level;m.render_levels=level
   mr['levels'][str(level)]=evaluated(ob)
  r['meshes'].append(mr)
 for m in bpy.data.materials:
  r['materials'].append({'name':m.name,'nodes':[{'type':n.type,'name':n.name,'attribute':getattr(n,'attribute_name',None),'layer':getattr(n,'layer_name',None)} for n in m.node_tree.nodes] if m.node_tree else [],'links':[{'from':l.from_node.name+':'+l.from_socket.name,'to':l.to_node.name+':'+l.to_socket.name} for l in m.node_tree.links] if m.node_tree else []})
 (OUT/'inspection.json').write_text(json.dumps(r,indent=2)+'\n');frozen();print('MAST_SOURCE_INSPECTED',flush=True)

def scene_setup():
 scene=bpy.context.scene
 for ob in list(scene.objects):
  if ob.type in ['CAMERA','LIGHT']:bpy.data.objects.remove(ob,do_unlink=True)
 scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=8;scene.cycles.use_denoising=True;scene.render.threads_mode='FIXED';scene.render.threads=2;scene.render.resolution_x=512;scene.render.resolution_y=512;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
 scene.render.film_transparent=False;scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.15,.17,.20,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
 scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
 for loc,power,color,size in [((-3,-4,5),650,(1,.82,.62),4),((3,-2,3),500,(.65,.78,1),4),((1,3,4),700,(1,.6,.32),3)]:
  d=bpy.data.lights.new('Study area','AREA');d.energy=power;d.color=color;d.shape='DISK';d.size=size;o=bpy.data.objects.new('Study area',d);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,1.5))-o.location).to_track_quat('-Z','Y').to_euler()
 d=bpy.data.cameras.new('Study camera');cam=bpy.data.objects.new('Study camera',d);scene.collection.objects.link(cam);scene.camera=cam;d.type='ORTHO';return scene,cam

def source_views():
 frozen();safe_load(OUT/'inputs/Mast.blend')
 for ob in bpy.context.scene.objects:
  if ob.type=='MESH' and ob.name not in ['Mast2024-11','Mast.Juba']:ob.hide_render=True
  for m in ob.modifiers:
   if m.type=='SUBSURF':m.levels=1;m.render_levels=1
 scene,cam=scene_setup();cam.data.ortho_scale=.66;target=Vector((0,.015,1.535))
 for name,offset in [('source-front',(0,-4,.2)),('source-three-quarter',(3,-4,1))]:
  cam.location=target+Vector(offset);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(OUT/'qa'/f'{name}.png');bpy.ops.render.render(write_still=True)
 frozen();print('MAST_SOURCE_VIEWS_DONE',flush=True)

def extract():
 frozen();safe_load(OUT/'inputs/Mast.blend');rig=bpy.data.objects['ArmatureMast'];head=bpy.data.objects['Mast2024-11'];mane=bpy.data.objects['Mast.Juba'];desc={'Head'}|{b.name for b in rig.data.bones['Head'].children_recursive}
 # Preserve original control cage, corner attributes and edit history in untouched input.
 # The study cut follows a neck plane below the facial controls, not a generated skull.
 head.matrix_world=head.matrix_world.copy();bm=bmesh.new();bm.from_mesh(head.data);wm=head.matrix_world;inv=wm.inverted();plane=inv@Vector((0,0,1.50));normal=wm.to_3x3().transposed()@Vector((0,0,1))
 bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-6,plane_co=plane,plane_no=normal,clear_inner=True,clear_outer=False)
 ring=[e for e in bm.edges if e.is_boundary and all(abs((wm@v.co).z-1.50)<1e-4 for v in e.verts)]
 if ring:bmesh.ops.holes_fill(bm,edges=ring,sides=0)
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(head.data);bm.free();head.name='Mast authored head and oral anatomy'
 # Remove unweighted helper masks from deformation; reduce only mane-chain groups.
 keep={n for n in desc if not n.startswith('Juba') and n!='Eye.Follow'}
 remap={}
 for b in rig.data.bones:
  n=b.name
  if n not in keep:
   parent=b
   while parent and parent.name not in keep:parent=parent.parent
   remap[n]=parent.name if parent else 'Head'
 for ob in [head,mane]:
  old=[{ob.vertex_groups[g.group].name:g.weight for g in v.groups if g.weight>1e-6 and ob.vertex_groups[g.group].name in rig.data.bones} for v in ob.data.vertices]
  # Keep authored non-bone masks for material classification and mane thickness.
  for g in list(ob.vertex_groups):
   if g.name in rig.data.bones:ob.vertex_groups.remove(g)
  groups={n:ob.vertex_groups.new(name=n) for n in keep}
  for i,w in enumerate(old):
   reduced={}
   for n,value in w.items():n=remap.get(n,n);reduced[n]=reduced.get(n,0)+value
   total=sum(reduced.values())
   if not total:reduced={'Head':1};total=1
   for n,value in reduced.items():groups[n].add([i],value/total,'REPLACE')
  for m in list(ob.modifiers):
   if m.type=='MASK':ob.modifiers.remove(m);continue
   if m.type=='SUBSURF':m.levels=1 if ob==head else 0;m.render_levels=m.levels
  for poly in ob.data.polygons:poly.use_smooth=True
 bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
 for bone in list(rig.data.edit_bones):
  if bone.name not in keep:rig.data.edit_bones.remove(bone)
 rig.data.edit_bones['Head'].parent=None;bpy.ops.object.mode_set(mode='OBJECT')
 for b in rig.pose.bones:
  for c in list(b.constraints):b.constraints.remove(c)
  b.matrix_basis=Matrix.Identity(4)
 for ob in list(bpy.data.objects):
  if ob not in [rig,head,mane]:bpy.data.objects.remove(ob,do_unlink=True)
 for text in list(bpy.data.texts):bpy.data.texts.remove(text)
 r={'sourceSha256':sha(OUT/'inputs/Mast.blend'),'neckCutWorldZ':1.50,'neckCutEdges':len(ring),'retainedBones':list(keep),'collapsedManeAncestorWeights':True,'embeddedTextRemoved':True,'meshes':[]}
 for ob in [head,mane]:
  item={'name':ob.name,'cage':topology(ob.data),'evaluated':evaluated(ob),'colorRanges':{},'levels':{}}
  sub=next(m for m in ob.modifiers if m.type=='SUBSURF')
  for level in [0,1]:sub.levels=level;sub.render_levels=level;item['levels'][str(level)]=evaluated(ob)
  sub.levels=1 if ob==head else 0;sub.render_levels=sub.levels
  for a in ob.data.color_attributes:
   if a.data:item['colorRanges'][a.name]=[min(x.color[0] for x in a.data),max(x.color[0] for x in a.data)]
  r['meshes'].append(item)
 # Source facial masks remain; imported layered shader remains for the first art decision.
 bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'extracted-head.blend'),compress=True);r['recipeSha256']=sha(Path(__file__));r['extractedSha256']=sha(OUT/'extracted-head.blend');(OUT/'extraction.json').write_text(json.dumps(r,indent=2)+'\n');frozen();print('MAST_HEAD_EXTRACTED',flush=True)

def action_signature():
 v={a.name:[(f.data_path,f.array_index,[(tuple(k.co),k.interpolation) for k in f.keyframe_points]) for f in a.fcurves] for a in bpy.data.actions}
 return hashlib.sha256(json.dumps(v,sort_keys=True).encode()).hexdigest()
def body_signature(ob):
 v={'v':[tuple(v.co) for v in ob.data.vertices],'p':[tuple(p.vertices) for p in ob.data.polygons],'w':[[(ob.vertex_groups[g.group].name,g.weight) for g in v.groups] for v in ob.data.vertices],'keys':{k.name:[tuple(v.co) for v in k.data] for k in ob.data.shape_keys.key_blocks} if ob.data.shape_keys else {}}
 return hashlib.sha256(json.dumps(v,sort_keys=True).encode()).hexdigest()
def set_game_idle(form):
 rig=bpy.data.objects['AnimalRig' if form=='race' else 'UprightRig'];clip='race_idle' if form=='race' else 'fight_idle'
 for tr in rig.animation_data.nla_tracks:tr.mute=True
 rig.animation_data.action=bpy.data.actions[clip]
 if form=='race':
  keys=bpy.data.objects['Body • continuous sculpted skin'].data.shape_keys
  for tr in keys.animation_data.nla_tracks:tr.mute=True
  keys.animation_data.action=bpy.data.actions[clip+'_corrective']
 bpy.context.scene.frame_set(1);return rig

def linear_hex(h):
 def f(x):x=int(x,16)/255;return x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4
 return Vector(tuple(f(h[i:i+2]) for i in (0,2,4)))
def palette(ob):
 me=ob.data;gold=linear_hex('B9843D');cream=linear_hex('E3C793');dark=linear_hex('261A13');gum=linear_hex('58382D');eye=linear_hex('BB8F3D');ivory=linear_hex('DED0AF');russet=linear_hex('755026')
 color=me.color_attributes.get('FurColor') or me.color_attributes.new(name='FurColor',type='FLOAT_COLOR',domain='POINT')
 for v in me.vertices:
  p=v.co;w={ob.vertex_groups[g.group].name:g.weight for g in v.groups};c=gold.copy()
  if p.y<-.066 and p.z<1.632:c=gold.lerp(cream,min(1,max(0,(1.639-p.z)/.036))*min(1,max(0,(-p.y-.055)/.04)))
  if p.y<-.124 and 1.580<p.z<1.623:c=dark.copy()
  if sum(w.get(n,0) for n in ['Head.Gengiva','Jaw.Gengiva'])>.5:c=gum.copy()
  if w.get('zzzTeefUpper',0)+w.get('zzzTeefBottom',0)>.5:c=ivory.copy()
  if any(n.startswith('Tongue') and a>.2 for n,a in w.items()):c=linear_hex('965A4D')
  if abs(p.x)>.075 and p.z>1.671 and p.y<.048:c=gold.lerp(russet,.7)
  if any(n.startswith('Eyebrow') and a>.25 for n,a in w.items()):c=gold.lerp(russet,.3)
  if w.get('Olho.L',0)+w.get('Olho.R',0)>.5:
   rad=math.hypot(abs(p.x)-.03154446,p.z-1.640621);c=ivory.copy()
   if p.y<-.063 and rad<.014:c=eye.copy()
   if p.y<-.063 and rad<.0065:c=dark.copy()
  color.data[v.index].color=(*c,1)
 mat=bpy.data.materials.new('Mast study warm Lion palette');mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.82;bs.inputs['Specular IOR Level'].default_value=.24;attr=mat.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name='FurColor';mat.node_tree.links.new(attr.outputs['Color'],bs.inputs['Base Color']);mat.diffuse_color=(*gold,1);me.materials.clear();me.materials.append(mat)
 me.color_attributes.active_color_index=list(me.color_attributes).index(color)

def facial_correction(ob):
 # Sculpt existing native-space vertices; no added face primitives or mane strips.
 for v in ob.data.vertices:
  p=v.co;w={ob.vertex_groups[g.group].name:g.weight for g in v.groups}
  cheek=math.exp(-((p.z-1.600)/.030)**2)*max(0,min(1,(-p.y-.055)/.045));p.x*=1+.23*cheek
  ear=sum(a for n,a in w.items() if n.startswith('Ear'))
  if ear>.05:
   a=min(1,ear);p.z+=(1.670+(p.z-1.670)*.78-p.z)*a;center=.086 if p.x>=0 else -.086;p.x+=(center+(p.x-center)*1.04-p.x)*a
  brow=sum(a for n,a in w.items() if n.startswith('Eyebrow'))
  if brow>.1:p.z+=.004*brow*((abs(p.x)-.031)/.035)
 ob.data.update()

def split_skin(head):
 adj=[set() for _ in head.data.vertices]
 for edge in head.data.edges:a,b=edge.vertices;adj[a].add(b);adj[b].add(a)
 todo=set(range(len(adj)));parts=[]
 while todo:
  part={todo.pop()};stack=list(part)
  while stack:
   a=stack.pop()
   for b in adj[a]&todo:todo.remove(b);part.add(b);stack.append(b)
  parts.append(part)
 skin=max(parts,key=len);detail=head.copy();detail.data=head.data.copy();detail.name='Mast oral and eye details';bpy.context.collection.objects.link(detail)
 for ob,retain in [(head,skin),(detail,set(range(len(adj)))-skin)]:
  bm=bmesh.new();bm.from_mesh(ob.data);bm.verts.ensure_lookup_table();bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.index not in retain],context='VERTS');bm.to_mesh(ob.data);bm.free()
 return detail

def fit_neck(meshes,face,game,fit,form):
 # Keep a neck ring embedded at the existing neck/head midpoint; blend the
 # inherited connected neck rows into the raised face, not a detached neck tube.
 delta=Vector((0,-.06,.22)) if form=='upright' else Vector()
 skin=next(o for o in meshes if o.name.startswith('Mast authored'));inv=fit.inverted();group=skin.vertex_groups['Study neck attachment'].index;cap=[v.co.copy() for v in skin.data.vertices if any(g.group==group and g.weight>.9 for g in v.groups)];center=sum(cap,Vector())/len(cap)
 target=(game.data.bones['neck'].head_local+game.data.bones['head'].head_local)/2
 face.data.transform(Matrix.Translation(delta));bone_names=set(face.data.bones.keys());bpy.context.view_layer.objects.active=face;bpy.ops.object.mode_set(mode='EDIT');anchor=face.data.edit_bones.new('StudyNeckAnchor');anchor.head=target;anchor.tail=target+Vector((0,0,.10));bpy.ops.object.mode_set(mode='OBJECT')
 for ob in meshes:
  anchor_group=ob.vertex_groups.new(name='StudyNeckAnchor')
  for v in ob.data.vertices:
   old=v.co.copy();native=inv@old;w={ob.vertex_groups[g.group].name:g.weight for g in v.groups};jaw=sum(a for n,a in w.items() if n.startswith('Jaw'))
   factor=max(0,min(1,(native.z-1.50)/.06));factor=factor*factor*(3-2*factor);back=max(0,min(1,(native.y+.055)/.03));amount=(1-factor)*back*(1-min(1,jaw*2)) if ob==skin else 0
   mapped=target+Vector(((old.x-center.x)*.55,(old.y-center.y)*.55,old.z-center.z));v.co=(old+delta)*(1-amount)+mapped*amount
   if amount>1e-6:
    for name,value in w.items():
     if name in bone_names:ob.vertex_groups[name].add([v.index],value*(1-amount),'REPLACE')
    anchor_group.add([v.index],amount,'REPLACE')
  ob.data.update()
 return {'uprightHeadOffset':list(delta),'capTarget':list(target),'capRadialScale':.55,'neckBlendNativeHeight':.06,'anchorBone':'StudyNeckAnchor','topologyAdded':False}

def build():
 frozen();(OUT/'candidate').mkdir(exist_ok=True)
 safe_load(OUT/'inputs/lion-race.blend');race_head=bpy.data.objects['AnimalRig'].data.bones['head'].matrix_local.copy()
 for form in ['race','upright']:
  safe_load(OUT/'inputs'/f'lion-{form}.blend');game=bpy.data.objects['AnimalRig' if form=='race' else 'UprightRig'];body=bpy.data.objects['Body • continuous sculpted skin' if form=='race' else 'Upright body • connected joint topology'];before_body=body_signature(body);before_actions=action_signature();removed=[]
  for ob in list(bpy.context.scene.objects):
   if ob.type!='MESH':continue
   names={ob.vertex_groups[g.group].name for v in ob.data.vertices for g in v.groups if g.weight>.00001}
   if names and names.issubset({'head','jaw'}) and 'mane' not in ob.name.lower():removed.append(ob.name);bpy.data.objects.remove(ob,do_unlink=True)
  with bpy.data.libraries.load(str(OUT/'extracted-head.blend'),link=False) as (source,target):target.objects=[n for n in source.objects if n in ['ArmatureMast','Mast authored head and oral anatomy']]
  imported=target.objects
  for ob in imported:bpy.context.collection.objects.link(ob)
  face=next(o for o in imported if o.type=='ARMATURE');meshes=[o for o in imported if o.type=='MESH'];old={o.name:o.matrix_world.copy() for o in imported}
  # Normalize imported object transforms before the one uniform anatomical fit.
  for ob in imported:ob.parent=None;ob.data.transform(old[ob.name]);ob.matrix_world=Matrix.Identity(4)
  study_head=next(o for o in meshes if o.name.startswith('Mast authored'));facial_correction(study_head);detail=split_skin(study_head);meshes.append(detail);imported.append(detail)
  for ob in meshes:
   neck=ob.vertex_groups.new(name='Study neck attachment')
   indices=[v.index for v in ob.data.vertices if abs(v.co.z-1.50)<1e-4]
   if indices:neck.add(indices,1,'REPLACE')
  source_pivot=Vector((0,.06509210914373398,1.5388814210891724))
  base=Matrix.Translation(Vector((0,-.75,1.28)))@Matrix.Scale(2.85,4)@Matrix.Translation(-source_pivot)
  fit=game.data.bones['head'].matrix_local@race_head.inverted()@base
  for ob in meshes:
   palette(ob)
   for m in ob.modifiers:
    if m.type=='SUBSURF':m.levels=1 if ob==study_head else 0;m.render_levels=m.levels
  for ob in imported:ob.data.transform(fit)
  neck_fit=fit_neck(meshes,face,game,fit,form)
  face.name='Mast isolated facial rig';game.data.pose_position='REST';bpy.context.view_layer.update()
  face.parent=game;face.parent_type='BONE';face.parent_bone='head';face.matrix_parent_inverse=(game.matrix_world@game.data.bones['head'].matrix_local@Matrix.Translation((0,game.data.bones['head'].length,0))).inverted();face.matrix_basis=Matrix.Identity(4)
  for ob in meshes:ob.parent=face;ob.matrix_parent_inverse=Matrix.Identity(4);ob.matrix_basis=Matrix.Identity(4)
  bpy.context.view_layer.update();assert max(abs(face.matrix_world[i][j]-(1 if i==j else 0)) for i in range(4) for j in range(4))<1e-4,tuple(face.matrix_world)
  game.data.pose_position='POSE';set_game_idle(form)
  assert body_signature(body)==before_body and action_signature()==before_actions
  record={'form':form,'neckFit':neck_fit,'inputSha256':sha(OUT/'inputs'/f'lion-{form}.blend'),'bodySignatureBefore':before_body,'bodySignatureAfter':body_signature(body),'actionSignatureBefore':before_actions,'actionSignatureAfter':action_signature(),'removedHeadObjects':removed,'fitMatrix':[list(row) for row in fit],'facialBones':len(face.data.bones),'extractedHeadVertices':sum(len(o.data.vertices) for o in meshes),'evaluatedMeshCosts':{o.name:evaluated(o) for o in bpy.context.scene.objects if o.type=='MESH'}}
  record['completeAnimalCosts']={}
  study_head=next(o for o in meshes if o.name.startswith('Mast authored'));sub=next(m for m in study_head.modifiers if m.type=='SUBSURF')
  for level in [0,1]:
   sub.levels=level;sub.render_levels=level;measure=[evaluated(o) for o in bpy.context.scene.objects if o.type=='MESH'];record['completeAnimalCosts'][str(level)]={'triangles':sum(m['triangles'] for m in measure),'vertices':sum(m['vertices'] for m in measure),'meshObjects':len(measure),'materialPrimitivesUpperBound':sum(len(set(p.material_index for p in o.data.polygons)) for o in bpy.context.scene.objects if o.type=='MESH')}
  sub.levels=1;sub.render_levels=1
  record['contactHeadForwardSamples']=[]
  game.animation_data.action=bpy.data.actions['attack']
  for time in [.18+.10*i/40 for i in range(41)]:
   frame=1+time*30;bpy.context.scene.frame_set(int(frame),subframe=frame%1);point,_=probe_geometry(meshes);record['contactHeadForwardSamples'].append({'time':time,'forwardMax':max(-p.y for p in point),'bounds':bounds(point)})
  set_game_idle(form)
  record['selectedHeadSubdivision']=1;record['subdivisionScope']='Connected skin only; separate source eyes/teeth/oral details remain level 0';record['visualCorrection']=2;record['palette']='Authored gold/cream anatomy regions, dark nose/oral tissue, amber eyes';record['maneDecision']='Reject imported rolled curtain mane; retain unchanged canonical ruff as provisional control.';record['recipeSha256']=sha(Path(__file__))
  bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'candidate'/f'lion-{form}.blend'),compress=True);record['sourceSha256']=sha(OUT/'candidate'/f'lion-{form}.blend');(OUT/f'{form}-fit.json').write_text(json.dumps(record,indent=2)+'\n')
 frozen();print('MAST_BOTH_FORMS_FITTED',flush=True)

def prepare():
 extract();build()

def vertex_review_colors():
 for ob in bpy.context.scene.objects:
  if ob.type!='MESH':continue
  me=ob.data;a=me.color_attributes.get('FurColor')
  if not a:
   a=me.color_attributes.new(name='FurColor',type='FLOAT_COLOR',domain='CORNER')
   for p in me.polygons:
    mat=me.materials[p.material_index] if me.materials else None;c=mat.diffuse_color if mat else (.5,.5,.5,1)
    for i in p.loop_indices:a.data[i].color=c
  me.color_attributes.active_color_index=list(me.color_attributes).index(a)

def study_view(form,variant):
 safe_load(OUT/('candidate' if variant=='candidate' else 'inputs')/f'lion-{form}.blend');game=set_game_idle(form);scene,cam=scene_setup();scene.render.engine='BLENDER_WORKBENCH';vertex_review_colors();sh=scene.display.shading;sh.color_type='VERTEX';sh.light='STUDIO';sh.show_cavity=True;sh.cavity_type='BOTH';sh.show_shadows=True;sh.background_type='WORLD';scene.world.color=(.10,.115,.14)
 return game,scene,cam

def matched_views():
 frozen()
 for form in ['race','upright']:
  for variant in ['control','candidate']:
   game,scene,cam=study_view(form,variant);anchor=game.pose.bones['head'].head.copy()+Vector((0,-.10,.10))
   for view,off in [('front',(0,-5,.2)),('side',(5,0,.1)),('three-quarter',(3,-5,1.3)),('body',(3,-5,1.7))]:
    target=anchor if view!='body' else Vector((0,0,1.25 if form=='upright' else .98));cam.data.ortho_scale=1.65 if view!='body' else 3.7;cam.location=target+Vector(off);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(OUT/'qa'/f'{form}-{variant}-{view}.png');bpy.ops.render.render(write_still=True)
 frozen();print('MAST_MATCHED_VIEWS_DONE',flush=True)

def probe_pose(face,t):
 for b in face.pose.bones:b.matrix_basis=Matrix.Identity(4)
 a=math.sin(math.pi*t);b=face.pose.bones['Jaw'];b.rotation_mode='XYZ';b.rotation_euler.x=.30*max(0,a)
 face.pose.bones['Head'].rotation_mode='XYZ';face.pose.bones['Head'].rotation_euler.x=.08*a;face.pose.bones['Head'].rotation_euler.z=.10*math.sin(math.pi*t*2)
 for side in ['L','R']:
  face.pose.bones['Eyebrow.'+side].location.y=.020*a
  face.pose.bones['EyebrowFront.'+side].location.y=-.008*a
  face.pose.bones['EyelidUpper.'+side].rotation_mode='XYZ';face.pose.bones['EyelidUpper.'+side].rotation_euler.x=-.26*max(0,-a)
  face.pose.bones['EyelidBottom.'+side].rotation_mode='XYZ';face.pose.bones['EyelidBottom.'+side].rotation_euler.x=.10*max(0,-a)
 bpy.context.view_layer.update()
def probe_vertices(ob):
 bpy.context.view_layer.update();ev=ob.evaluated_get(bpy.context.evaluated_depsgraph_get());me=ev.to_mesh();v=[ev.matrix_world@p.co for p in me.vertices];ev.to_mesh_clear();return v

def probe_geometry(meshes):
 bpy.context.view_layer.update();v=[];edges=[]
 for ob in meshes:
  ev=ob.evaluated_get(bpy.context.evaluated_depsgraph_get());me=ev.to_mesh();offset=len(v);v.extend(ev.matrix_world@p.co for p in me.vertices);edges.extend((a+offset,b+offset) for a,b in (e.vertices for e in me.edges));ev.to_mesh_clear()
 return v,edges

def attachment_measure(head,body):
 from mathutils.bvhtree import BVHTree
 dg=bpy.context.evaluated_depsgraph_get();ev=body.evaluated_get(dg);me=ev.to_mesh();tree=BVHTree.FromPolygons([ev.matrix_world@v.co for v in me.vertices],[tuple(p.vertices) for p in me.polygons]);ev.to_mesh_clear();ev=head.evaluated_get(dg);me=ev.to_mesh();group=head.vertex_groups['Study neck attachment'].index;values=[]
 for v in me.vertices:
  if any(g.group==group and g.weight>.95 for g in v.groups):
   point=ev.matrix_world@v.co;hit=tree.find_nearest(point)
   if hit[0] is not None:values.append((point-hit[0]).dot(hit[1]))
 ev.to_mesh_clear();assert values;return {'samples':len(values),'signedNearestSurfaceMin':min(values),'signedNearestSurfaceMax':max(values),'meaning':'Nearest-normal sign is a local diagnostic, not a watertight collision proof; positive may expose a junction gap.'}

def motion():
 frozen()
 for form in ['race','upright']:
  game,scene,cam=study_view(form,'candidate');face=bpy.data.objects['Mast isolated facial rig'];head=bpy.data.objects['Mast authored head and oral anatomy'];details=bpy.data.objects['Mast oral and eye details'];body=bpy.data.objects['Body • continuous sculpted skin' if form=='race' else 'Upright body • connected joint topology'];folder=OUT/'qa'/f'{form}-probe-frames';folder.mkdir(exist_ok=True);scene.render.resolution_x=384;scene.render.resolution_y=384;scene.render.fps=30
  anchor=game.pose.bones['head'].head.copy()+Vector((0,-.10,.08));cam.data.ortho_scale=1.8;cam.location=anchor+Vector((3,-5,.8));cam.rotation_euler=(anchor-cam.location).to_track_quat('-Z','Y').to_euler()
  probe_pose(face,0);rest,edges=probe_geometry([head,details]);lengths=[(rest[a]-rest[b]).length for a,b in edges];record=[]
  for i in range(31):
   t=i/15;probe_pose(face,t);v,_=probe_geometry([head,details]);assert len(v)==len(rest);ratios=sorted((v[a]-v[b]).length/l for (a,b),l in zip(edges,lengths) if l>1e-7);assert all(math.isfinite(c) for p in v for c in p)
   record.append({'frame':i,'time':t,'bounds':bounds(v),'edgeRatioMin':ratios[0],'edgeRatioMax':ratios[-1],'edgeRatioP99':ratios[int(.99*(len(ratios)-1))],'edgesOver2x':sum(x>2 for x in ratios),'neckAttachment':attachment_measure(head,body)})
   scene.render.filepath=str(folder/f'{i:04d}.png');bpy.ops.render.render(write_still=True)
  # Save the real authored study action into the editable derivative only.
  face.animation_data_create();face.animation_data.action=bpy.data.actions.new('Mast head probe')
  for i in range(61):
   t=i/30;probe_pose(face,t)
   for n in ['Head','Jaw','Eyebrow.L','Eyebrow.R','EyebrowFront.L','EyebrowFront.R','EyelidUpper.L','EyelidUpper.R','EyelidBottom.L','EyelidBottom.R']:
    b=face.pose.bones[n];b.keyframe_insert('location',frame=i+1);b.keyframe_insert('rotation_euler',frame=i+1)
  for fc in face.animation_data.action.fcurves:
   for k in fc.keyframe_points:k.interpolation='LINEAR'
  scene.frame_start=1;scene.frame_end=61;scene.frame_set(1);bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'candidate'/f'lion-{form}.blend'),compress=True)
  fit=json.loads((OUT/f'{form}-fit.json').read_text());fit['probeSamples']=record;fit['sourceSha256']=sha(OUT/'candidate'/f'lion-{form}.blend');fit['probeIsGameAnimation']=False;(OUT/f'{form}-fit.json').write_text(json.dumps(fit,indent=2)+'\n')
 frozen();print('MAST_COMPLETE_FACIAL_PROBES_DONE',flush=True)

def diagnose():
 report={}
 for form in ['race','upright']:
  safe_load(OUT/'candidate'/f'lion-{form}.blend');game=set_game_idle(form);face=bpy.data.objects['Mast isolated facial rig'];face.animation_data.action=None;probe_pose(face,0);head=bpy.data.objects['Mast authored head and oral anatomy'];body=bpy.data.objects['Body • continuous sculpted skin' if form=='race' else 'Upright body • connected joint topology'];index=head.vertex_groups['Study neck attachment'].index
  cap=[head.matrix_world@v.co for v in head.data.vertices if any(g.group==index and g.weight>.9 for g in v.groups)]
  report[form]={'headBone':list(game.matrix_world@game.pose.bones['head'].head),'neckBone':list(game.matrix_world@game.pose.bones['neck'].head) if 'neck' in game.pose.bones else None,'capBounds':bounds(cap),'capMean':list(sum(cap,Vector())/len(cap)),'faceJawPivot':list(face.matrix_world@face.pose.bones['Jaw'].head),'bodyBounds':evaluated(body)['bounds']}
 (OUT/'attachment-diagnosis.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report),flush=True)

if __name__=='__main__':globals()[sys.argv[sys.argv.index('--')+1]]()
