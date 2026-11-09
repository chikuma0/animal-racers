"""Read-only assessment of a copied CC0 Wolf. Always launch --disable-autoexec.
No source save, runtime export, embedded script or game retargeting.
"""
import bpy, bmesh, math, json, hashlib, sys, struct
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'assets/source/western/licensed-wolf-review';SOURCE=OUT/'source/dog2.blend'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def freeze():
 p=json.loads((OUT/'provenance.json').read_text())
 for name,h in p['sourceFiles'].items():assert sha(OUT/name)==h,name
 for name,h in p['canonicalFreeze'].items():assert sha(ROOT/name)==h,name

def load():
 freeze();bpy.context.preferences.filepaths.use_scripts_auto_execute=False
 bpy.ops.wm.open_mainfile(filepath=str(SOURCE),load_ui=False,use_scripts=False)
 drivers=[]
 for collection in [bpy.data.objects,bpy.data.meshes,bpy.data.armatures,bpy.data.materials,bpy.data.scenes,bpy.data.worlds,bpy.data.shape_keys]:
  for block in collection:
   ad=getattr(block,'animation_data',None)
   for driver in ad.drivers if ad else []:drivers.append({'block':block.name,'path':driver.data_path,'type':driver.driver.type});driver.mute=True
 for material in bpy.data.materials:
  nt=material.node_tree
  if nt and nt.animation_data:
   for driver in nt.animation_data.drivers:drivers.append({'block':nt.name,'path':driver.data_path,'type':driver.driver.type});driver.mute=True
 return drivers

def bounds(points):
 pts=list(points);return {'min':[min(p[k] for p in pts) for k in range(3)],'max':[max(p[k] for p in pts) for k in range(3)]}
def inspect():
 drivers=load();report={'sourceSha256':sha(SOURCE),'recipeSha256':sha(Path(__file__)),'blenderVersion':bpy.app.version_string,'autoExecutionDisabled':not bpy.context.preferences.filepaths.use_scripts_auto_execute,'driversMuted':drivers,'embeddedTextNames':[t.name for t in bpy.data.texts],'linkedLibraries':[l.filepath for l in bpy.data.libraries],'actions':[{'name':a.name,'range':list(a.frame_range),'curves':len(a.fcurves)} for a in bpy.data.actions],'meshes':[],'armatures':[],'materials':[],'textures':[]}
 for ob in [o for o in bpy.context.scene.objects if o.type=='MESH']:
  me=ob.data;me.calc_loop_triangles();adj={v.index:set() for v in me.vertices};uses={}
  for poly in me.polygons:
   for a,b in poly.edge_keys:adj[a].add(b);adj[b].add(a);edge=tuple(sorted((a,b)));uses[edge]=uses.get(edge,0)+1
  components=[];todo=set(adj)
  while todo:
   stack=[todo.pop()];count=0
   while stack:
    a=stack.pop();count+=1
    for b in adj[a]&todo:todo.remove(b);stack.append(b)
   components.append(count)
  weights=[];influences=[];perbone={};unweighted=[]
  for v in me.vertices:
   groups=[g for g in v.groups if g.weight>1e-6];weights.append(sum(g.weight for g in groups));influences.append(len(groups))
   if not groups:unweighted.append(v.index)
   for g in groups:perbone.setdefault(ob.vertex_groups[g.group].name,[]).append([v.index,g.weight])
  dg=bpy.context.evaluated_depsgraph_get();ev=ob.evaluated_get(dg);em=ev.to_mesh();em.calc_loop_triangles();eb=bounds(ev.matrix_world@v.co for v in em.vertices);etr=len(em.loop_triangles);ev.to_mesh_clear()
  report['meshes'].append({'name':ob.name,'vertices':len(me.vertices),'polygons':len(me.polygons),'triangles':len(me.loop_triangles),'evaluatedTriangles':etr,'components':sorted(components,reverse=True),'boundaryEdges':sum(n==1 for n in uses.values()),'nonmanifoldEdgesOverTwoFaces':sum(n>2 for n in uses.values()),'zeroAreaFaces':sum(p.area<1e-12 for p in me.polygons),'uvLayers':[{'name':u.name,'loops':len(u.data)} for u in me.uv_layers],'materials':[m.name if m else None for m in me.materials],'materialPolygonCounts':{str(i):sum(p.material_index==i for p in me.polygons) for i in range(len(me.materials))},'shapeKeys':[k.name for k in me.shape_keys.key_blocks] if me.shape_keys else [],'modifiers':[{'name':m.name,'type':m.type,'viewport':m.show_viewport,'render':m.show_render,'levels':getattr(m,'levels',None),'renderLevels':getattr(m,'render_levels',None),'object':getattr(getattr(m,'object',None),'name',None)} for m in ob.modifiers],'worldBounds':bounds(ob.matrix_world@v.co for v in me.vertices),'evaluatedWorldBounds':eb,'matrixWorld':[list(row) for row in ob.matrix_world],'weightSumMin':min(weights),'weightSumMax':max(weights),'maxWeightSumError':max(abs(w-1) for w in weights),'unweightedVertices':unweighted,'maxInfluences':max(influences),'verticesOver4Influences':sum(n>4 for n in influences),'influenceHistogram':{str(n):influences.count(n) for n in sorted(set(influences))},'weightedBoneVertexCounts':{n:len(v) for n,v in perbone.items()}})
 for ob in [o for o in bpy.context.scene.objects if o.type=='ARMATURE']:
  report['armatures'].append({'name':ob.name,'boneCount':len(ob.data.bones),'deformBoneCount':sum(b.use_deform for b in ob.data.bones),'bones':[{'name':b.name,'parent':b.parent.name if b.parent else None,'deform':b.use_deform,'connected':b.use_connect,'head':list(b.head_local),'tail':list(b.tail_local),'worldHead':list(ob.matrix_world@b.head_local),'worldTail':list(ob.matrix_world@b.tail_local),'length':b.length,'constraints':[{'name':c.name,'type':c.type,'influence':c.influence,'subtarget':getattr(c,'subtarget',None)} for c in ob.pose.bones[b.name].constraints]} for b in ob.data.bones]})
 for m in bpy.data.materials:
  nt=m.node_tree;report['materials'].append({'name':m.name,'useNodes':m.use_nodes,'diffuseColor':list(m.diffuse_color),'nodes':[{'name':n.name,'type':n.type,'image':n.image.filepath if n.type=='TEX_IMAGE' and n.image else None} for n in nt.nodes] if nt else [],'links':[{'from':l.from_node.name+':'+l.from_socket.name,'to':l.to_node.name+':'+l.to_socket.name} for l in nt.links] if nt else []})
 for p in sorted((OUT/'source').glob('*.png')):
  data=p.read_bytes();w,h=struct.unpack_from('>II',data,16);report['textures'].append({'file':p.name,'sha256':sha(p),'bytes':len(data),'width':w,'height':h,'rgba8BaseBytes':w*h*4,'rgba8FullMipBytesEstimate':math.ceil(w*h*4*4/3)})
 report['budget']={'sourceTriangles':sum(m['triangles'] for m in report['meshes']),'evaluatedTriangles':sum(m['evaluatedTriangles'] for m in report['meshes']),'materialSlots':sum(len(m['materials']) for m in report['meshes']),'sourceTextureBytes':sum(i['bytes'] for i in report['textures']),'rgba8TextureMipBytesEstimate':sum(i['rgba8FullMipBytesEstimate'] for i in report['textures']),'sourceBlendBytes':SOURCE.stat().st_size,'caveat':'No runtime GLB was exported; file size, texture decode, draw calls and sustained iPhone performance are not measured. Source rig exceeds current 25-bone dedicated rig but is not inherently a phone rejection.'}
 (OUT/'inspection.json').write_text(json.dumps(report,indent=2)+'\n');freeze();print('LICENSED_WOLF_SOURCE_INSPECTED',json.dumps({'meshes':[(m['name'],m['vertices'],m['triangles']) for m in report['meshes']],'rigs':[(r['name'],r['boneCount']) for r in report['armatures']],'actions':len(report['actions']),'textures':report['textures']}),flush=True)

if __name__=='__main__':globals()[sys.argv[sys.argv.index('--')+1]]()
