"""Source inspection and bounded review of dedicated upright roster; never exports models.
Blender --background --python scripts/assets/review_upright.py -- inspect|render|package [all|lion|wolf|unicorn]
Render is deliberately separate for coordinating GPU availability.
"""
import bpy,bmesh,math,json,sys,subprocess,tempfile,shutil,hashlib,struct
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
import build_upright as author
OUT,SOURCE,PUBLIC,FPS=author.OUT,author.SOURCE,author.PUBLIC,author.FPS
QA=OUT/'qa';QA.mkdir(exist_ok=True)
KINDS=['lion','wolf','unicorn'];VIEWS={'three-quarter':(3.5,-5.2,2.9),'side':(5.5,0,2.3)}
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def manifest(kind):return json.loads((OUT/f'{kind}-manifest.json').read_text())
def open_source(kind):
 bpy.ops.wm.open_mainfile(filepath=str(SOURCE/f'{kind}-upright.blend'));rig=bpy.data.objects['UprightRig']
 for track in rig.animation_data.nla_tracks:track.mute=True
 return rig,bpy.data.objects['Upright body • connected joint topology']
def inspect(kind):
 rig,body=open_source(kind);scene=bpy.context.scene;record=manifest(kind)
 assert digest(SOURCE/f'{kind}-upright.blend')==record['sourceSha256']
 bm=bmesh.new();bm.from_mesh(body.data);seen=set();components=0
 for v in bm.verts:
  if v in seen:continue
  components+=1;stack=[v];seen.add(v)
  while stack:
   vertex=stack.pop()
   for e in vertex.link_edges:
    other=e.other_vert(vertex)
    if other not in seen:seen.add(other);stack.append(other)
 cage=bpy.data.meshes[rig['control_topology_mesh']]
 topology={'components':components,'boundaryEdges':sum(e.is_boundary for e in bm.edges),'nonManifoldEdges':sum(not e.is_manifold for e in bm.edges),'surfaceVertices':len(bm.verts),'surfaceFaces':len(bm.faces),'controlVertices':len(cage.vertices),'controlFaces':len(cage.polygons)};bm.free()
 assert components==1 and not topology['boundaryEdges'] and not topology['nonManifoldEdges'],topology
 def evaluated():
  mesh=body.evaluated_get(bpy.context.evaluated_depsgraph_get()).data;points=[v.co.copy() for v in mesh.vertices];mesh.calc_loop_triangles()
  lengths=[(points[e.vertices[0]]-points[e.vertices[1]]).length for e in mesh.edges]
  volume=sum(points[t.vertices[0]].dot(points[t.vertices[1]].cross(points[t.vertices[2]]))/6 for t in mesh.loop_triangles)
  return mesh,points,lengths,volume
 rig.animation_data.action=bpy.data.actions['fight_idle'];scene.frame_set(1);_,_,reference,refvolume=evaluated();clips={}
 for clip,duration in record['clips'].items():
  rig.animation_data.action=bpy.data.actions[clip];end=round(duration*FPS)+1;scale_error=0.;worst_long=0.;worst_compressed=0.;minimum_volume=10.;minimum_area=1e9
  for frame in range(1,end+1):
   scene.frame_set(frame);mesh,points,lengths,volume=evaluated()
   assert all(math.isfinite(c) for p in points for c in p)
   scale_error=max(scale_error,max(abs(s-1) for b in rig.pose.bones for s in b.matrix.to_scale()))
   ratios=[a/b for a,b in zip(lengths,reference) if b>1e-7]
   worst_long=max(worst_long,sum(x>2 for x in ratios)/len(ratios));worst_compressed=max(worst_compressed,sum(x<.2 for x in ratios)/len(ratios));minimum_volume=min(minimum_volume,volume/refvolume)
   minimum_area=min(minimum_area,min(p.area for p in mesh.polygons))
  assert scale_error<.0002,(kind,clip,scale_error)
  clips[clip]={'sampledFrames':end,'maximumBoneScaleError':scale_error,'minimumBodySignedVolumeRatioToIdle':minimum_volume,'maximumFractionEdgesOverTwiceIdleLength':worst_long,'maximumFractionEdgesUnder20PercentIdleLength':worst_compressed,'minimumEvaluatedFaceArea':minimum_area}
 result={'sourceSha256':record['sourceSha256'],'runtimeSha256':record['runtimeSha256'],'topology':topology,'boneParents':{b.name:b.parent.name if b.parent else None for b in rig.data.bones},'clips':clips,'limitations':'Finite geometry, connected topology, unit bone scale and edge/volume diagnostics are structural evidence only. They do not prove anatomy or lack of intersections. Compare cinematic target and actual runtime separately.'}
 (OUT/f'{kind}-source-inspection.json').write_text(json.dumps(result,indent=2)+'\n');print('UPRIGHT_SOURCE_OK',kind,flush=True)

def render(kind,deformation_only=False):
 rig,body=open_source(kind);scene=bpy.context.scene;record=manifest(kind)
 scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.use_denoising=True
 try:
  prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='METAL';prefs.get_devices()
  for device in prefs.devices:device.use=device.type=='METAL'
  scene.cycles.device='GPU'
 except Exception:pass
 scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.17,.19,.24,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
 scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
 mat=bpy.data.materials.new('Review stage');mat.diffuse_color=(.17,.105,.06,1)
 bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.02));bpy.context.object.data.materials.append(mat)
 for loc,power,color,size in [((-3,-4,6),650,(1,.71,.43),4),((3,-1,4),470,(.5,.68,1),5),((0,4,4),1000,(1,.52,.27),3)]:
  data=bpy.data.lights.new('Review lighting','AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size;lamp=bpy.data.objects.new('Review lighting',data);scene.collection.objects.link(lamp);lamp.location=loc;lamp.rotation_euler=(Vector((0,0,1))-lamp.location).to_track_quat('-Z','Y').to_euler()
 data=bpy.data.cameras.new('Review camera');cam=bpy.data.objects.new('Review camera',data);scene.collection.objects.link(cam);scene.camera=cam;data.type='ORTHO';data.ortho_scale=3.8
 folder=QA/kind;folder.mkdir(exist_ok=True)
 for view,loc in VIEWS.items():
  cam.location=loc;cam.rotation_euler=(Vector((0,0,1.25))-cam.location).to_track_quat('-Z','Y').to_euler()
  scene.render.engine='CYCLES';scene.render.resolution_x=512;scene.render.resolution_y=512;scene.render.resolution_percentage=100
  samples={'transform':1,'fight_idle':1,'fight_move':4,'attack':7,'special':{'lion':12,'wolf':15,'unicorn':14}[kind],'guard':7,'defeat':40,'celebrate':16,'jump':13,'land':5}
  if view=='side':samples={k:v for k,v in samples.items() if k in ['attack','special','defeat','celebrate']}
  for clip,frame in samples.items():
   path=folder/f'{view}-{clip}.png'
   if path.exists():
    width=struct.unpack('>I',path.read_bytes()[16:20])[0]
    if not deformation_only or width==640 or (view=='three-quarter' and clip in ['fight_idle','celebrate']):continue
   if deformation_only and view=='three-quarter' and clip in ['fight_idle','celebrate']:continue
   # Two representative material views/species; remaining extreme views are
   # deliberately Workbench deformation evidence, as are the full cycles below.
   scene.render.engine='CYCLES' if view=='three-quarter' and clip in ['fight_idle','celebrate'] else 'BLENDER_WORKBENCH'
   scene.display.shading.light='STUDIO';scene.display.shading.studio_light='paint.sl';scene.display.shading.color_type='MATERIAL';scene.display.shading.show_shadows=False;scene.display.shading.show_cavity=True
   rig.animation_data.action=bpy.data.actions[clip];scene.frame_set(frame);scene.render.filepath=str(folder/f'{view}-{clip}.png');bpy.ops.render.render(write_still=True)
  scene.render.engine='BLENDER_WORKBENCH';scene.render.resolution_x=320;scene.render.resolution_y=320
  scene.display.shading.light='STUDIO';scene.display.shading.studio_light='paint.sl';scene.display.shading.color_type='MATERIAL';scene.display.shading.show_shadows=False;scene.display.shading.show_cavity=True
  for clip,duration in record['clips'].items():
   rig.animation_data.action=bpy.data.actions[clip];end=round(duration*FPS)+1;frames=folder/f'{view}-{clip}';frames.mkdir(exist_ok=True)
   for stale in frames.glob('*.png'):stale.unlink()
   for frame in sorted(set(list(range(1,end+1,2))+[end])):
    scene.frame_set(frame);scene.render.filepath=str(frames/f'{frame:04}.png');bpy.ops.render.render(write_still=True)
 print('UPRIGHT_REVIEW_RENDERED',kind,flush=True)

def package(kind):
 record=manifest(kind);folder=QA/kind;views={}
 def ffmpeg(args):subprocess.run(['ffmpeg','-v','error','-y','-filter_threads','1','-filter_complex_threads','1']+args,check=True)
 with tempfile.TemporaryDirectory(prefix='upright-roster-review-') as td:
  temp=Path(td)
  for view in VIEWS:
   segments=[];rows=[];timeline=[];elapsed=0.;allframes=[]
   for clip,duration in record['clips'].items():
    end=round(duration*FPS)+1;expected=sorted(set(list(range(1,end+1,2))+[end]));frames=sorted((folder/f'{view}-{clip}').glob('*.png'));assert [int(p.stem) for p in frames]==expected,(kind,view,clip)
    for path in frames:
     shutil.copy2(path,temp/f'full-{view}-{len(allframes):04}.png');allframes.append({'clip':clip,'sourceFrame':int(path.stem)})
    segment=temp/f'{view}-{clip}.mp4';segments.append(segment)
    ffmpeg(['-framerate','15','-pattern_type','glob','-i',str(folder/f'{view}-{clip}'/'*.png'),'-threads','1','-c:v','libx264','-crf','20','-pix_fmt','yuv420p',str(segment)])
    row=temp/f'{view}-{clip}.png';rows.append(row)
    selected=[frames[round((len(frames)-1)*i/7)] for i in range(8)]
    for i,path in enumerate(selected):shutil.copy2(path,temp/f'frame-{i:02}.png')
    ffmpeg(['-i',str(temp/'frame-%02d.png'),'-vf','scale=160:160,tile=8x1:padding=2:margin=2:color=0x201b1a','-frames:v','1',str(row)])
    seconds=len(expected)/15;timeline.append({'clip':clip,'sourceFrames':expected,'start':elapsed,'end':elapsed+seconds});elapsed+=seconds
   listing=temp/f'{view}.txt';listing.write_text(''.join("file '"+str(p)+"'\n" for p in segments));movie=folder/f'{view}-all-clips.mp4'
   ffmpeg(['-f','concat','-safe','0','-i',str(listing),'-c','copy','-movflags','+faststart',str(movie)])
   info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(movie)]));assert abs(float(info['format']['duration'])-elapsed)<.1
   args=[]
   for row in rows:args+=['-i',str(row)]
   ffmpeg(args+['-filter_complex',f'vstack=inputs={len(rows)}','-frames:v','1',str(folder/f'{view}-all-clips-sheet.png')])
   pages=[]
   for page in range(math.ceil(len(allframes)/60)):
    start=page*60;end=min(start+60,len(allframes));atlas=folder/f'{view}-full-cycle-page-{page+1}.png'
    ffmpeg(['-start_number',str(start),'-i',str(temp/f'full-{view}-%04d.png'),'-vf',f'scale=160:160,tile=6x10:nb_frames={end-start}:padding=2:margin=2:color=0x201b1a','-frames:v','1',str(atlas)])
    pages.append({'file':atlas.name,'frames':allframes[start:end]})
   views[view]={'movie':movie.name,'duration':float(info['format']['duration']),'clips':timeline,'fullFramePages':pages}
 stills={}
 for path in sorted(folder.glob('*.png')):
  if 'sheet' in path.stem or 'full-cycle-page' in path.stem:continue
  width,height=struct.unpack('>II',path.read_bytes()[16:24]);view='three-quarter' if path.name.startswith('three-quarter-') else 'side';clip=path.stem[len(view)+1:]
  engine='CYCLES' if width==640 or (view=='three-quarter' and clip in ['fight_idle','celebrate']) else 'BLENDER_WORKBENCH'
  stills[path.name]={'engine':engine,'width':width,'height':height,'sha256':digest(path)}
 (folder/'review-index.json').write_text(json.dumps({'species':kind,'sourceSha256':record['sourceSha256'],'runtimeSha256':record['runtimeSha256'],'scope':'Source renders; representative Cycles stills show appearance, remaining extreme stills and complete 15 fps Workbench cycles show deformation. Per-still engine is recorded explicitly. Not gameplay or premium acceptance. Sheets rows follow clip order in this file; each row has eight evenly spaced samples.','stills':stills,'views':views},indent=2)+'\n')
 for view in VIEWS:
  for clip in record['clips']:shutil.rmtree(folder/f'{view}-{clip}')
 print('UPRIGHT_REVIEWS_PACKAGED',kind,flush=True)

if __name__=='__main__':
 args=sys.argv[sys.argv.index('--')+1:];command=args[0];kinds=KINDS if len(args)<2 or args[1]=='all' else [args[1]]
 for kind in kinds:
  if command=='clean':render(kind,True)
  else:{'inspect':inspect,'render':render,'package':package}[command](kind)
