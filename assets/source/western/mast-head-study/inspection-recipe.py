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

if __name__=='__main__':globals()[sys.argv[sys.argv.index('--')+1]]()
