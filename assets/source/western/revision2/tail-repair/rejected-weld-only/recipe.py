"""Isolated tail attachment correction. Canonical Revision2 files are read-only.
Use Blender 4.5.9 --background --factory-startup --disable-autoexec -t 2.
"""
import bpy,bmesh,math,json,hashlib,sys,shutil,tempfile,subprocess
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/source/western/revision2/tail-repair'
sys.path.insert(0,str(Path(__file__).resolve().parent))
import rebuild_roster_v2 as prior
FPS=30
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def filename(kind,form,ext):return prior.filename(kind,form,ext)
def frozen():
 for path,sha in json.loads((OUT/'freeze.json').read_text())['files'].items():assert digest(ROOT/path)==sha,('canonical changed',path)
def load(kind,form,variant='inputs'):
 bpy.ops.wm.open_mainfile(filepath=str(OUT/variant/filename(kind,form,'blend')))
 rig=bpy.data.objects[prior.rig_name(form)];rig.animation_data.action=None
 for tr in rig.animation_data.nla_tracks:tr.mute=True
 for pb in rig.pose.bones:pb.matrix_basis=Matrix.Identity(4)
 body=bpy.data.objects[prior.body_name(form)]
 if body.data.shape_keys:
  body.data.shape_keys.animation_data.action=None
  for tr in body.data.shape_keys.animation_data.nla_tracks:tr.mute=True
  for k in body.data.shape_keys.key_blocks:k.value=0.
 bpy.context.view_layer.update();return rig,body
def tail_objects():
 return [ob for ob in bpy.context.scene.objects if ob.type=='MESH' and ('tail' in ob.name.lower() or any(ob.vertex_groups[g.group].name.startswith('tail_') and g.weight>1e-6 for v in ob.data.vertices for g in v.groups))]
def diagnose():
 frozen();records={}
 for kind in ['lion','wolf','unicorn']:
  for form in ['race','upright']:
   rig,body=load(kind,form);parts=[]
   for ob in tail_objects():
    pts=[ob.matrix_world@v.co for v in ob.data.vertices];parts.append({'name':ob.name,'vertices':len(pts),'bounds':{'min':[min(p[i] for p in pts) for i in range(3)],'max':[max(p[i] for p in pts) for i in range(3)]},'weights':{g.name:sum(any(w.group==g.index and w.weight>1e-5 for w in v.groups) for v in ob.data.vertices) for g in ob.vertex_groups},'modifiers':[(m.type,m.object.name if m.type=='ARMATURE' and m.object else None) for m in ob.modifiers]})
   records[kind+'-'+form]={'sourceSha256':digest(OUT/'inputs'/filename(kind,form,'blend')),'bones':{b.name:{'head':tuple(b.head_local),'tail':tuple(b.tail_local),'parent':b.parent.name if b.parent else None} for b in rig.data.bones if b.name.startswith('tail_') or b.name=='pelvis'},'parts':parts}
 (OUT/'diagnosis.json').write_text(json.dumps(records,indent=2)+'\n');frozen();print('TAIL_SOURCE_DIAGNOSED',flush=True)
def welded_tail(kind,form,rig,body):
 old=body.data;points=[v.co.copy() for v in old.vertices];old_count=len(points)
 weights=[{body.vertex_groups[g.group].name:g.weight for g in v.groups} for v in old.vertices]
 colors=[tuple(c.color) for c in old.color_attributes['FurColor'].data]
 polygons=[tuple(p.vertices) for p in old.polygons]
 tree=BVHTree.FromPolygons(points,polygons)
 z=.97 if form=='upright' else 1.06
 hit,normal,index,distance=tree.ray_cast(Vector((0,3,z)),Vector((0,-1,0)))
 assert hit is not None
 radius=.115 if kind=='lion' else .135
 chosen=set()
 for p in old.polygons:
  center=sum((points[i] for i in p.vertices),Vector())/len(p.vertices)
  if (center.x**2+(center.z-z)**2)<radius**2 and abs(center.y-hit.y)<.085 and p.normal.y>.25:chosen.add(p.index)
 chosen.add(index)
 # Keep only the patch connected to the hit triangle. No hidden opposite surface.
 edge_faces={}
 for p in old.polygons:
  for a,b in zip(p.vertices,list(p.vertices[1:])+[p.vertices[0]]):edge_faces.setdefault(tuple(sorted((a,b))),[]).append(p.index)
 adjacent={i:set() for i in chosen}
 for faces in edge_faces.values():
  for a in faces:
   for b in faces:
    if a in chosen and b in chosen:adjacent[a].add(b)
 patch={index};pending=[index]
 while pending:
  for n in adjacent[pending.pop()]-patch:patch.add(n);pending.append(n)
 edges=[e for e,f in edge_faces.items() if sum(i in patch for i in f)==1]
 neighbors={}
 for a,b in edges:neighbors.setdefault(a,[]).append(b);neighbors.setdefault(b,[]).append(a)
 assert all(len(v)==2 for v in neighbors.values()),('non-simple rump boundary',kind,form)
 boundary=[min(neighbors)]
 while True:
  nxt=next(n for n in neighbors[boundary[-1]] if len(boundary)<2 or n!=boundary[-2])
  if nxt==boundary[0]:break
  boundary.append(nxt)
 assert len(boundary)==len(neighbors) and len(boundary)>=6
 faces=[p for i,p in enumerate(polygons) if i not in patch]
 face_mats=[p.material_index for p in old.polygons if p.index not in patch]
 uvs=old.uv_layers.active
 uvfaces=[[tuple(uvs.data[l].uv) for l in p.loop_indices] for p in old.polygons if p.index not in patch]
 center=sum((points[i] for i in boundary),Vector())/len(boundary)
 N=len(boundary);angles=[math.atan2(points[i].z-center.z,points[i].x-center.x) for i in boundary]
 bones=[rig.data.bones[f'tail_{i}'] for i in range(4)]
 axis=[center]+[b.head_local.copy() for b in bones]+[bones[-1].tail_local.copy()]
 end=bones[-1].tail_local.copy();end+=(bones[-1].tail_local-bones[-1].head_local).normalized()*(.16 if kind=='lion' else .23)
 axis.append(end)
 lens=[(b-a).length for a,b in zip(axis,axis[1:])];total=sum(lens)
 def curve(u):
  distance=u*total
  for j,length in enumerate(lens):
   if distance<=length or j==len(lens)-1:return axis[j].lerp(axis[j+1],max(0,min(1,distance/length))),j,max(0,min(1,distance/length))
   distance-=length
 def weight(j,t,root):
  if j==0:
   q={n:v*(1-prior.smooth(t)) for n,v in root.items()};q['tail_0']=q.get('tail_0',0)+prior.smooth(t);return {n:v for n,v in q.items() if v>1e-7}
  a=min(3,j-1);b=min(3,j);return {f'tail_{a}':1.} if a==b else {f'tail_{a}':1-t,f'tail_{b}':t}
 palette={k:prior.rgb(v) for k,v in prior.PALETTES[kind].items()}
 rainbow=[prior.rgb(c) for c in ['BB838F','CAA274','D2BF82','8FA793','8FACC3','A496BE','C5A2BF']]
 rootcolors=[Vector(colors[i][:3]) for i in boundary];rings=[boundary];segments=32
 for row in range(1,segments+1):
  u=row/segments;p,j,t=curve(u);tangent=(curve(min(1,u+.005))[0]-curve(max(0,u-.005))[0]).normalized();x=Vector((1,0,0));up=tangent.cross(x).normalized()
  if up.z<0:up=-up
  base_radius=.061 if kind=='lion' else (.105+.070*math.sin(math.pi*u)**1.5 if kind=='wolf' else .10+.045*math.sin(math.pi*u))
  radius=base_radius*(1-prior.smooth((u-.72)/.28))+.003
  ring=[]
  for col,a in enumerate(angles):
   start=points[boundary[col]]-center;rounded=x*math.cos(a)+up*math.sin(a)
   vec=start.lerp(rounded*radius,prior.smooth(u/.19));ripple=1+(0 if kind=='lion' else .055*math.sin(a*5+u*7))*prior.smooth(u/.18)
   q=p+vec*ripple;ring.append(len(points));points.append(q);weights.append(weight(j,t,weights[boundary[col]]))
   c=palette['coat'] if kind=='lion' else palette['mane'].lerp(palette['tip'],.38+.22*math.sin(a)) if kind=='wolf' else rainbow[col*7//N%7]
   c=rootcolors[col].lerp(c,prior.smooth(u/.23));colors.append((*c,1))
  rings.append(ring)
  for col in range(N):
   a=rings[-2][col];b=rings[-2][(col+1)%N];c=ring[(col+1)%N];d=ring[col];faces.append((a,b,c,d));face_mats.append(0);uvfaces.append([(col/N,(row-1)/segments),((col+1)/N,(row-1)/segments),((col+1)/N,row/segments),(col/N,row/segments)])
 faces.append(tuple(reversed(rings[-1])));face_mats.append(0);uvfaces.append([(i/N,1) for i in range(N)])
 keys=old.shape_keys;shape_data={k.name:[v.co.copy() for v in k.data] for k in keys.key_blocks} if keys else {}
 tracks=[(tr.name,[(st.name,st.action) for st in tr.strips]) for tr in keys.animation_data.nla_tracks] if keys and keys.animation_data else []
 data=bpy.data.meshes.new('Tail repair • welded rump and complete tail');data.from_pydata(points,[],faces);data.update()
 original=data.attributes.new('TailOriginalVertex',type='INT',domain='POINT');rings_attr=data.attributes.new('TailLongitudinalRing',type='INT',domain='POINT');construction=data.attributes.new('TailConstructionVertex',type='INT',domain='POINT')
 for i in range(len(points)):original.data[i].value=i if i<old_count else -1;rings_attr.data[i].value=-1;construction.data[i].value=i
 for row,ring in enumerate(rings):
  for i in ring:rings_attr.data[i].value=row
 for m in old.materials:data.materials.append(m)
 body.data=data
 attr=data.color_attributes.new(name='FurColor',type='FLOAT_COLOR',domain='POINT')
 for v,c in zip(attr.data,colors):v.color=c
 uv=data.uv_layers.new(name='Directional coat UV')
 for p,mi,coords in zip(data.polygons,face_mats,uvfaces):
  p.material_index=mi;p.use_smooth=True
  for l,c in zip(p.loop_indices,coords):uv.data[l].uv=c
 body.vertex_groups.clear();groups={n:body.vertex_groups.new(name=n) for n in {n for w in weights for n in w}}
 for i,w in enumerate(weights):
  for n,v in w.items():
   if v>0:groups[n].add([i],v,'REPLACE')
 # Recalculate orientation without welding or modifying preserved coordinates.
 bm=bmesh.new();bm.from_mesh(data);loose=[v for v in bm.verts if not v.link_faces];bmesh.ops.delete(bm,geom=loose,context='VERTS');bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free()
 # Re-create corrective data only after vertex reindexing. Copying keys before
 # removing the isolated patch interior would silently shift their indices.
 for name,coords in shape_data.items():
  key=body.shape_key_add(name=name)
  for v in data.vertices:
   source_i=data.attributes['TailConstructionVertex'].data[v.index].value
   if source_i<old_count:key.data[v.index].co=coords[source_i]
   else:
    row=(source_i-old_count)//N+1;col=(source_i-old_count)%N;key.data[v.index].co=points[source_i]+(coords[boundary[col]]-points[boundary[col]])*(1-prior.smooth(row/segments/.22))
 if tracks:
  ad=data.shape_keys.animation_data_create()
  for name,strips in tracks:
   tr=ad.nla_tracks.new();tr.name=name;tr.mute=True
   for st,action in strips:tr.strips.new(st,1,action)
 boundary=[v.index for v in data.vertices if data.attributes['TailLongitudinalRing'].data[v.index].value==0]
 body['tailRepairRootIndices']=boundary;body['tailRepairRingSize']=N;body['tailRepairOriginalVertices']=old_count;body['tailRepairSegments']=segments
 return {'boundary':boundary,'ringSize':N,'segments':segments,'removedRumpFaces':sorted(patch),'originalVertices':old_count,'addedVertices':len(points)-old_count,'restRootCenter':tuple(center)}

def evade_hop(kind,form,rig):
 if form!='upright':return
 old=bpy.data.actions['evade'];duration=prior.TIMING[kind][3];samples=[]
 for tr in rig.animation_data.nla_tracks:tr.mute=True
 rig.animation_data.action=old
 # Capture the original expressive upper-body motion, then lift and re-solve
 # the legs. No other action or timing is touched.
 for frame in range(round(duration*FPS)+1):
  bpy.context.scene.frame_set(frame+1);samples.append({b.name:(prior.D(b.head),prior.D(b.tail)) for b in rig.pose.bones})
 rig.animation_data.action=None
 for tr in list(rig.animation_data.nla_tracks):
  if tr.name=='evade':rig.animation_data.nla_tracks.remove(tr)
 bpy.data.actions.remove(old);action=bpy.data.actions.new('evade');rig.animation_data.action=action
 prior.rigmath.REST={b.name:(prior.D(b.head_local),prior.D(b.tail_local),b.parent.name if b.parent else None) for b in rig.data.bones}
 for frame,d in enumerate(samples):
  u=frame/(len(samples)-1);flight=max(0,math.sin(math.pi*u))**.70
  lift=.20*flight
  for name in d:d[name]=tuple(p+Vector((0,0,lift)) for p in d[name])
  for side,sign in [('L',1),('R',-1)]:
   upper,lower,paw=[f'rear_{part}_{side}' for part in ['upper','lower','paw']];hip=d[upper][0];ankle=d[paw][0]+Vector((0,-.025*flight,.11*flight));l1=(rig.data.bones[upper].tail_local-rig.data.bones[upper].head_local).length;l2=(rig.data.bones[lower].tail_local-rig.data.bones[lower].head_local).length
   knee,ankle,error=prior.rigmath.solve_two(hip,ankle,l1,l2,(sign*.43,.65,.5));direction=d[paw][1]-d[paw][0];d[upper]=(hip,knee);d[lower]=(knee,ankle);d[paw]=(ankle,ankle+direction)
  prior.rigmath.set_pose(rig,d)
  for pb in rig.pose.bones:pb.rotation_mode='QUATERNION';pb.keyframe_insert('location',frame=frame+1);pb.keyframe_insert('rotation_quaternion',frame=frame+1);pb.keyframe_insert('scale',frame=frame+1)
 action.use_fake_user=True;rig.animation_data.action=None;tr=rig.animation_data.nla_tracks.new();tr.name='evade';tr.mute=True;tr.strips.new('evade',1,action)
 for pb in rig.pose.bones:pb.matrix_basis=Matrix.Identity(4)

def export(kind,form,body,rig):
 source=OUT/'candidate'/filename(kind,form,'blend');runtime=OUT/'candidate'/filename(kind,form,'glb');bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True)
 bpy.ops.object.select_all(action='DESELECT')
 for ob in [o for o in bpy.context.scene.objects if o.type=='MESH']:
  if not ob.data.color_attributes.get('FurColor'):
   attr=ob.data.color_attributes.new(name='FurColor',type='FLOAT_COLOR',domain='POINT')
   for c in attr.data:c.color=(1,1,1,1)
  ob.select_set(True)
 bpy.context.view_layer.objects.active=body;bpy.ops.object.join();body.name=kind+' • attached tail '+form;rig.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(runtime),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,export_materials='EXPORT',export_yup=True,export_apply=False,export_cameras=False,export_lights=False,export_anim_slide_to_zero=True)
 ns={'__name__':'tail_packer','__file__':str(ROOT/'scripts/assets/build_upright.py')};exec(compile((ROOT/'assets/source/western/contact-v2/inputs/build_upright.py').read_text(),'packer','exec'),ns);ns['pack_vertex_colors'](runtime)
 return {'sourceSha256':digest(source),'runtimeSha256':digest(runtime)}
def build():
 frozen();records={}
 for kind in ['lion','wolf','unicorn']:
  for form in ['race','upright']:
   rig,body=load(kind,form)
   removed=[]
   for ob in tail_objects():
    if ob==body or ob.name!='Articulated tail':continue
    removed.append(ob.name);bpy.data.objects.remove(ob,do_unlink=True)
   info=welded_tail(kind,form,rig,body);evade_hop(kind,form,rig);info.update(export(kind,form,body,rig));info['removed']=removed;records[kind+'-'+form]=info;print('TAIL_CANDIDATE_EXPORTED',kind,form,flush=True)
 (OUT/'manifest.json').write_text(json.dumps({'recipeSha256':digest(Path(__file__)),'records':records},indent=2)+'\n');frozen()
def topology(data):
 bm=bmesh.new();bm.from_mesh(data);components=0;remaining=set(bm.verts)
 while remaining:
  components+=1;todo=[remaining.pop()]
  while todo:
   for e in todo.pop().link_edges:
    for v in e.verts:
     if v in remaining:remaining.remove(v);todo.append(v)
 result={'components':components,'boundaryEdges':sum(e.is_boundary for e in bm.edges),'nonManifoldEdges':sum(not e.is_manifold for e in bm.edges)};bm.free();return result
def mesh_semantic(ob):
 return {'vertices':[tuple(v.co) for v in ob.data.vertices],'faces':[tuple(p.vertices) for p in ob.data.polygons],'weights':[[sorted((ob.vertex_groups[g.group].name,round(g.weight,7)) for g in v.groups)] for v in ob.data.vertices],'materials':[m.name for m in ob.data.materials]}
def action_semantics():
 return {a.name:[(f.data_path,f.array_index,[(tuple(k.co),k.interpolation) for k in f.keyframe_points]) for f in a.fcurves] for a in bpy.data.actions}
def pose_action(rig,body,clip,t):
 rig.animation_data.action=bpy.data.actions[clip]
 if body.data.shape_keys:body.data.shape_keys.animation_data.action=bpy.data.actions.get(clip+'_corrective')
 f=1+t*FPS;bpy.context.scene.frame_set(int(f),subframe=f%1);bpy.context.view_layer.update()
def verify():
 frozen();records={};issues=[];manifest=json.loads((OUT/'manifest.json').read_text())
 for kind in ['lion','wolf','unicorn']:
  for form in ['race','upright']:
   key=kind+'-'+form;rig,body=load(kind,form);old_actions=action_semantics();old_meshes={o.name:mesh_semantic(o) for o in bpy.context.scene.objects if o.type=='MESH' and o!=body and o.name!='Articulated tail'};old_body=mesh_semantic(body);old_shapes={k.name:[tuple(v.co) for v in k.data] for k in body.data.shape_keys.key_blocks} if body.data.shape_keys else {}
   original_tail=bpy.data.objects['Articulated tail'];original_components=topology(body.data)['components']+topology(original_tail.data)['components'];assert original_components>=2
   old_gaps={}
   for clip in (['race_idle','run','jump','land','stumble'] if form=='race' else ['fight_idle','attack','hit','evade']):
    duration=(bpy.data.actions[clip].frame_range[1]-1)/FPS;worst=0
    for t in [0,duration*.25,duration*.5,duration*.75,duration]:
     pose_action(rig,body,clip,t);dg=bpy.context.evaluated_depsgraph_get();b=body.evaluated_get(dg);tm=original_tail.evaluated_get(dg);tree=BVHTree.FromPolygons([v.co for v in b.data.vertices],[p.vertices for p in b.data.polygons]);gap=min(tree.find_nearest(v.co)[3] for v in list(tm.data.vertices)[:8]);worst=max(worst,gap)
    old_gaps[clip]=worst
   rig,body=load(kind,form,'candidate');new_actions=action_semantics()
   for name,action in old_actions.items():
    if form=='upright' and name=='evade':assert new_actions[name]!=action
    else:assert new_actions[name]==action,(key,'unexpected action edit',name)
   assert {o.name:mesh_semantic(o) for o in bpy.context.scene.objects if o.type=='MESH' and o!=body}==old_meshes,(key,'unrelated mesh changed')
   original=body.data.attributes['TailOriginalVertex'];ringattr=body.data.attributes['TailLongitudinalRing'];rings={i:[v.index for v in body.data.vertices if ringattr.data[v.index].value==i] for i in range(33)}
   assert all(len(v)==body['tailRepairRingSize'] for v in rings.values())
   for v in body.data.vertices:
    orig=original.data[v.index].value
    if orig<0:continue
    assert tuple(v.co)==old_body['vertices'][orig],(key,'old body vertex changed',orig)
    assert [sorted((body.vertex_groups[g.group].name,round(g.weight,7)) for g in v.groups)]==old_body['weights'][orig],(key,'old body skin weights changed',orig)
    for name,coords in old_shapes.items():assert tuple(body.data.shape_keys.key_blocks[name].data[v.index].co)==coords[orig]
   topo=topology(body.data);assert topo=={'components':1,'boundaryEdges':0,'nonManifoldEdges':0},(key,topo)
   # Actual disconnected original is the negative attachment control; additionally
   # remove one bridging polygon from the candidate in memory and require failure.
   corrupted=body.data.copy();bm=bmesh.new();bm.from_mesh(corrupted);victim=next(f for f in bm.faces if any(v.index in rings[0] for v in f.verts) and any(v.index in rings[1] for v in f.verts));bmesh.ops.delete(bm,geom=[victim],context='FACES_ONLY');bm.to_mesh(corrupted);bm.free();bad=topology(corrupted);assert bad['boundaryEdges']>0;bpy.data.meshes.remove(corrupted)
   rest_edges={e.index:(body.data.vertices[e.vertices[0]].co-body.data.vertices[e.vertices[1]].co).length for e in body.data.edges if any(ringattr.data[i].value>=0 for i in e.vertices)}
   clips={}
   for name,action in new_actions.items():
    if name.endswith('_corrective'):continue
    duration=(bpy.data.actions[name].frame_range[1]-1)/FPS;count=round(duration*FPS)+1;maxstretch=0;worst=None;minradius=1e6;feet=[];lowest=1e6
    for f in range(count):
     t=min(duration,f/FPS);pose_action(rig,body,name,t);dg=bpy.context.evaluated_depsgraph_get();evaluated=body.evaluated_get(dg);vs=evaluated.data.vertices
     assert all(math.isfinite(c) for v in vs for c in v.co),(key,name,'nonfinite')
     for eid,rest in rest_edges.items():
      a,b=body.data.edges[eid].vertices;stretch=(vs[a].co-vs[b].co).length/max(1e-6,rest)
      if stretch>maxstretch:maxstretch=stretch;worst={'frame':f,'rings':[ringattr.data[i].value for i in [a,b]],'restLength':rest,'posedLength':(vs[a].co-vs[b].co).length}
     for row,indices in rings.items():
      center=sum((vs[i].co for i in indices),Vector())/len(indices);minradius=min(minradius,max((vs[i].co-center).length for i in indices))
     if form=='upright' and name=='evade':feet.append(min(rig.pose.bones[n].head.z for n in ['rear_paw_L','rear_paw_R']))
     lowest=min(lowest,min(v.co.z for v in vs))
    if maxstretch>=3.5:issues.append((key,name,'tail mesh stretched',maxstretch,worst))
    assert minradius>.001,(key,name,'tail section collapsed',minradius)
    if feet:assert max(feet)-min(feet)>.25 and abs(feet[0]-feet[-1])<.004,(key,'hop clearance/landing',feet)
    clips[name]={'frames':count,'duration':duration,'maxTailEdgeStretch':maxstretch,'minimumTailSectionRadius':minradius,'minimumBodyHeight':lowest,'evadePawHeights':feet or None}
   records[key]={'sourceSha256':digest(OUT/'candidate'/filename(kind,form,'blend')),'runtimeSha256':digest(OUT/'candidate'/filename(kind,form,'glb')),'topology':topo,'originalBodyAndShaftComponents':original_components,'originalRootGapWorstMetres':old_gaps,'missingBridgeNegative':bad,'preservedUnrelatedMeshes':len(old_meshes),'clips':clips}
   print('TAIL_SOURCE_GEOMETRY_OK',key,flush=True)
 (OUT/'source-verification.json').write_text(json.dumps({'recipeSha256':digest(Path(__file__)),'records':records,'issues':issues},indent=2)+'\n');frozen();assert not issues,issues
def prepare_render(kind,form,variant,clip,t,world_move=False,size=384,crop=False):
 rig,body=load(kind,form,variant);pose_action(rig,body,clip,t)
 scene,cam=prior.setup(form,size);scene.render.threads_mode='FIXED';scene.render.threads=2
 shift=prior.TIMING[kind][3] and {'lion':2.8,'wolf':3.6,'unicorn':2.2}[kind]*t if world_move else 0
 rig.location.y=shift
 target=Vector((0,.18+(.55 if world_move else 0),1.22 if form=='upright' else 1.0));cam.data.ortho_scale=4.1 if world_move else 3.5
 if crop:target=Vector((0,.43 if form=='upright' else 1.04,.95 if form=='upright' else 1.16));cam.data.ortho_scale=1.7
 cam.location=target+Vector((6,0,0));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
 # Stationary grid gives world displacement a visible reference for evade.
 if world_move:
  bpy.ops.mesh.primitive_plane_add(size=15,location=(0,0,-.02));floor=bpy.context.object;floor.name='QA stationary ground';floor.color=(.12,.13,.15,1)
  mat=bpy.data.materials.new('QA ground');mat.diffuse_color=(.14,.16,.18,1);floor.data.materials.append(mat)
  for y in [-2,-1,0,1,2,3]:
   bpy.ops.mesh.primitive_cube_add(size=1,location=(0,y,-.012));line=bpy.context.object;line.scale=(1.5,.018,.006);line.name='QA metre line';m=bpy.data.materials.get('QA metre') or bpy.data.materials.new('QA metre');m.diffuse_color=(.48,.47,.44,1);line.data.materials.append(m)
 return scene
def preview():
 frozen();records=[]
 for kind in ['lion','wolf','unicorn']:
  for form in ['race','upright']:
   folder=OUT/'qa'/kind/form;folder.mkdir(parents=True,exist_ok=True)
   for variant in ['inputs','candidate']:
    clip='hit' if form=='upright' else 'run';t=.20
    for crop in ([False,True] if form=='upright' else [False]):
     scene=prepare_render(kind,form,variant,clip,t,size=512,crop=crop);p=folder/f'{variant}-{"root" if crop else "side"}.png';scene.render.filepath=str(p);bpy.ops.render.render(write_still=True);records.append({'path':str(p.relative_to(ROOT)),'sha256':digest(p),'sourceSha256':digest(OUT/variant/filename(kind,form,'blend')),'clip':clip,'time':t})
 (OUT/'preview.json').write_text(json.dumps(records,indent=2)+'\n');frozen();print('TAIL_SIDE_PREVIEW_DONE',flush=True)
def motion():
 frozen();records=[]
 for kind in ['lion','wolf','unicorn']:
  for form in ['race','upright']:
   clips=['run','jump','stumble'] if form=='race' else ['attack','hit','evade','celebrate','defeat']
   for clip in clips:
    rig,body=load(kind,form,'candidate');duration=(bpy.data.actions[clip].frame_range[1]-1)/FPS;n=math.ceil(duration*15)+1
    for variant in ['inputs','candidate']:
     scene=prepare_render(kind,form,variant,clip,0,world_move=clip=='evade');rig=bpy.data.objects[prior.rig_name(form)];body=bpy.data.objects[prior.body_name(form)];folder=OUT/'qa'/kind/form/'frames'/clip/variant;folder.mkdir(parents=True,exist_ok=True)
     for f in range(n):
      t=min(duration,f/15);pose_action(rig,body,clip,t)
      if clip=='evade':rig.location.y={'lion':2.8,'wolf':3.6,'unicorn':2.2}[kind]*t
      scene.render.filepath=str(folder/f'{f:04d}.png');bpy.ops.render.render(write_still=True)
     records.append({'species':kind,'form':form,'clip':clip,'variant':variant,'duration':duration,'frames':n,'fps':15,'worldDisplacementMetres':{'lion':2.8,'wolf':3.6,'unicorn':2.2}[kind]*duration if clip=='evade' else 0,'sourceSha256':digest(OUT/variant/filename(kind,form,'blend'))});print('TAIL_CYCLE_RENDERED',kind,form,clip,variant,flush=True)
 (OUT/'motion-samples.json').write_text(json.dumps(records,indent=2)+'\n');frozen()
def package():
 records=json.loads((OUT/'motion-samples.json').read_text());files={}
 for row in [r for r in records if r['variant']=='candidate']:
  kind,form,clip=row['species'],row['form'],row['clip'];folder=OUT/'qa'/kind/form
  movie=folder/f'{clip}-matched.mp4';sheet=folder/f'{clip}-all-frames.jpg'
  subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-framerate','15','-i',str(folder/'frames'/clip/'inputs'/'%04d.png'),'-framerate','15','-i',str(folder/'frames'/clip/'candidate'/'%04d.png'),'-filter_complex','[0:v][1:v]hstack=inputs=2[v]','-map','[v]','-c:v','libx264','-threads','2','-pix_fmt','yuv420p','-crf','22',str(movie)],check=True)
  subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(movie),'-vf',f'scale=384:192,tile=4x{math.ceil(row["frames"]/4)}:padding=3:margin=3','-frames:v','1','-q:v','2',str(sheet)],check=True)
  for p in [movie,sheet]:files[str(p.relative_to(ROOT))]=digest(p)
 (OUT/'motion-evidence.json').write_text(json.dumps({'recipeSha256':digest(Path(__file__)),'files':files,'scope':'Entire side-on clips, baseline left/candidate right. Evade includes authoritative backward world displacement and stationary metre grid.'},indent=2)+'\n');print('TAIL_MOTION_PACKAGED',flush=True)
if __name__=='__main__':globals()[sys.argv[sys.argv.index('--')+1]]()
