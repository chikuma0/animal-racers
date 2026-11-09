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

def render():
 from mathutils import Quaternion
 load();assert len(bpy.data.actions)==0;rig=bpy.data.objects['Armature'];mesh=bpy.data.objects['dog2'];scene=bpy.context.scene;qa=OUT/'qa';qa.mkdir(exist_ok=True);frames=qa/'probe-frames';frames.mkdir(exist_ok=True)
 # Deliberately restored review shader; the imported legacy material has no nodes.
 m=mesh.data.materials[0];m.use_nodes=True;nt=m.node_tree;nt.nodes.clear();bs=nt.nodes.new('ShaderNodeBsdfPrincipled');output=nt.nodes.new('ShaderNodeOutputMaterial');nt.links.new(bs.outputs['BSDF'],output.inputs['Surface']);bindings=[]
 for filename,socket in [('dog2Color.png','Base Color'),('dog2Roughness.png','Roughness'),('dog2specular.png','Specular IOR Level'),('dog2Normal.png',None)]:
  image=bpy.data.images.load(str(OUT/'source'/filename),check_existing=False);image.colorspace_settings.name='sRGB' if socket=='Base Color' else 'Non-Color';tex=nt.nodes.new('ShaderNodeTexImage');tex.image=image;bindings.append({'file':filename,'socket':socket or 'tangent normal','size':list(image.size),'channels':image.channels})
  if socket:nt.links.new(tex.outputs['Color'],bs.inputs[socket])
  else:
   normal=nt.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=1.;nt.links.new(tex.outputs['Color'],normal.inputs['Color']);nt.links.new(normal.outputs['Normal'],bs.inputs['Normal'])
  if socket=='Base Color':nt.nodes.active=tex;nt.links.new(tex.outputs['Alpha'],bs.inputs['Alpha'])
 # Existing source cameras/lights are not part of this matched setup.
 for ob in list(scene.objects):
  if ob.type in ['CAMERA','LIGHT']:bpy.data.objects.remove(ob,do_unlink=True)
 scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.13,.15,.18,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35
 for location,power,color,size in [((-4,-5,7),950,(1,.86,.68),5),((4,-2,5),650,(.64,.76,1),5),((1,5,6),1100,(1,.65,.38),4)]:
  d=bpy.data.lights.new('Research area light','AREA');d.energy=power;d.color=color;d.shape='DISK';d.size=size;ob=bpy.data.objects.new('Research area light',d);scene.collection.objects.link(ob);ob.location=location;ob.rotation_euler=(Vector((0,0,1.6))-ob.location).to_track_quat('-Z','Y').to_euler()
 d=bpy.data.cameras.new('Matched research camera');camera=bpy.data.objects.new('Matched research camera',d);scene.collection.objects.link(camera);scene.camera=camera;d.type='ORTHO'
 def camera_at(view):
  target=Vector((0,.7,1.6));offset={'front':(0,-10,.3),'side':(10,0,.3),'three-quarter':(7,-9,2.5)}[view];camera.location=target+Vector(offset);camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();d.ortho_scale=3.9 if view=='front' else 6.5
 scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.use_denoising=True;scene.render.resolution_x=512;scene.render.resolution_y=512;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
 scene.cycles.device='CPU';scene.render.threads_mode='FIXED';scene.render.threads=2
 for view in ['front','side','three-quarter']:
  if '--resume' in sys.argv and (qa/f'rest-{view}.png').exists():continue
  camera_at(view);scene.render.filepath=str(qa/f'rest-{view}.png');bpy.ops.render.render(write_still=True);print('WOLF_STILL_COMPLETE',view,flush=True)
 # No keyframes/actions are authored or saved. Three FK stress phases return to
 # rest between peaks, testing existing skinning rather than a gait/retarget.
 phases=[{'name':'jaw-neck','rotations':[('b_Jaw','X',.48),('b_Neck','X',-.20),('b_Head','X',-.10)]},{'name':'fore-hind-flex','rotations':[('b_LeftUpperArm','X',-.62),('b_LeftForeArm','X',.9),('b_LeftHand01','X',-.30),('b_RightLeg01','X',.42),('b_RightLeg02','X',-.65),('b_RightFoot01','X',.3)]},{'name':'shoulder-spine-stress','rotations':[('b_Spine01','X',-.16),('b_Spine02','X',-.18),('b_Spine03','X',-.16),('b_LeftUpperArm','Y',-.95),('b_RightUpperArm','Y',.95),('b_LeftForeArm','X',.65),('b_RightForeArm','X',.65),('b_Neck','X',.12)]}]
 for phase in phases:
  for bone,axis,angle in phase['rotations']:assert bone in rig.pose.bones
 base={b.name:b.matrix_basis.copy() for b in rig.pose.bones};edges=[tuple(e.vertices) for e in mesh.data.edges]
 def vertices():
  bpy.context.view_layer.update();ev=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());me=ev.to_mesh();v=[ev.matrix_world@p.co for p in me.vertices];ev.to_mesh_clear();return v
 rest=vertices();lengths=[(rest[a]-rest[b]).length for a,b in edges];measure=[];camera_at('three-quarter');scene.render.engine='BLENDER_WORKBENCH';scene.render.resolution_x=384;scene.render.resolution_y=384;sh=scene.display.shading;sh.color_type='TEXTURE';sh.light='STUDIO';sh.show_shadows=True;sh.show_cavity=True;sh.cavity_type='BOTH';sh.background_type='WORLD';scene.world.color=(.13,.15,.18)
 for frame in range(37):
  t=frame/15;index=min(2,int(t/.8));local=(t-index*.8)/.8;amount=math.sin(math.pi*min(1,local));phase=phases[index]
  for b in rig.pose.bones:b.matrix_basis=base[b.name]
  for name,axis,angle in phase['rotations']:
   bone=rig.pose.bones[name];worldaxis=Vector((1,0,0) if axis=='X' else (0,1,0));localaxis=(rig.matrix_world.to_3x3()@bone.bone.matrix_local.to_3x3()).inverted()@worldaxis;bone.rotation_mode='QUATERNION';bone.rotation_quaternion=Quaternion(localaxis.normalized(),angle*amount)
  v=vertices();ratios=sorted((v[a]-v[b]).length/l for (a,b),l in zip(edges,lengths) if l>1e-8);assert all(math.isfinite(n) for p in v for n in p)
  measure.append({'frame':frame,'time':t,'phase':phase['name'],'fraction':amount,'bounds':bounds(v),'edgeStretchMin':ratios[0],'edgeStretchMax':ratios[-1],'edgeStretchP99':ratios[int(.99*(len(ratios)-1))],'edgesBeyond2x':sum(x>2 for x in ratios)})
  scene.render.filepath=str(frames/f'{frame:04d}.png');bpy.ops.render.render(write_still=True)
 record={'sourceSha256':sha(SOURCE),'recipeSha256':sha(Path(__file__)),'suppliedActions':0,'probeIsAuthoredGameAnimation':False,'sourceUnmodified':True,'materialRestoration':bindings,'views':['front','side','three-quarter'],'stillResolution':[512,512],'probeResolution':[384,384],'probeFPS':15,'probeDurationSeconds':2.4,'frames':37,'phases':phases,'samples':measure,'limitations':'Direct FK stress test only; feet are not planted, no upright fit, no retarget, no gameplay contact or physical phone performance certification. Workbench motion shows supplied color map, not final PBR normal/roughness response.'}
 (OUT/'probe-report.json').write_text(json.dumps(record,indent=2)+'\n');freeze();print('LICENSED_WOLF_BOUNDED_RENDER_DONE',flush=True)

if __name__=='__main__':globals()[sys.argv[sys.argv.index('--')+1]]()
