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
if __name__=='__main__':globals()[sys.argv[sys.argv.index('--')+1]]()
