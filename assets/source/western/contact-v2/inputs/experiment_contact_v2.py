"""Cycle6 isolated head/neck contact experiment; production inputs are immutable.
Blender --background --python scripts/assets/experiment_contact.py -- build|inspect [all|lion|wolf|unicorn]
"""
import bpy,sys,json,hashlib,math,bmesh,subprocess,tempfile,shutil
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'assets/source/western/contact-v2'
HEAD_SETBACK=.30;CONTACT_LEAN=.10
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def frozen():
 data=json.loads((OUT/'frozen-cycle5.json').read_text())
 for path,expected in data['files'].items():assert digest(ROOT/path)==expected,('Production/Cycle5 changed',path)
 return data
def authoring():
 frozen();source=(OUT/'inputs/build_upright.py').read_text()
 assert source.count(' N=24;rows=[]')==1 and source.count('lean=.23*strike')==1
 # Modify only the torso/neck cross-section centers, preserving shared topology,
 # shoulder/limb masses and all facial/accessory geometry produced by Cycle5.
 source=source.replace(' N=24;rows=[]',' rings=[(h,rx,rf,f-HEAD_SETBACK*smooth((h-1.68)/.31)) for h,rx,rf,f in rings]\n N=24;rows=[]')
 source=source.replace('lean=.23*strike','lean=CONTACT_LEAN*strike')
 ns={'__name__':'isolated_contact_author','__file__':str(ROOT/'scripts/assets/build_upright.py'),'HEAD_SETBACK':HEAD_SETBACK,'CONTACT_LEAN':CONTACT_LEAN}
 exec(compile(source,str(OUT/'inputs/build_upright.py'),'exec'),ns)
 rest=ns['REST']
 for name in ['head','jaw']:
  a,b,parent=rest[name];rest[name]=((a[0],a[1]-HEAD_SETBACK,a[2]),(b[0],b[1]-HEAD_SETBACK,b[2]),parent)
 a,b,parent=rest['neck'];rest['neck']=(a,(b[0],b[1]-HEAD_SETBACK,b[2]),parent)
 ns['SOURCE']=OUT/'candidate';ns['PUBLIC']=OUT/'candidate';ns['OUT']=OUT
 return ns
def build(kind):
 ns=authoring();ns['build'](kind)
 path=OUT/f'{kind}-manifest.json';m=json.loads(path.read_text());m.update({'status':'Isolated Cycle6 candidate; no production replacement or premium acceptance','controlSourceSha256':digest(OUT/'control'/f'{kind}-upright.blend'),'controlRuntimeSha256':digest(OUT/'control'/f'{kind}-upright.glb'),'headSetbackMetres':HEAD_SETBACK,'normalStrikeLeanRadians':CONTACT_LEAN,'recipe':'Frozen Cycle5 generator with connected neck ring centers shifted by .30*smoothstep((height-1.68)/.31), rigid head/jaw rest translation -.30 forward, neck tail moved to head attachment, normal-strike lean .23→.10. Face geometry and scale unchanged.'});path.write_text(json.dumps(m,indent=2)+'\n');frozen()

def inspect(kind):
 frozen();control=OUT/'control'/f'{kind}-upright.blend';candidate=OUT/'candidate'/f'{kind}-upright.blend'
 bpy.ops.wm.open_mainfile(filepath=str(control));old={}
 for ob in bpy.context.scene.objects:
  if ob.type!='MESH':continue
  names={ob.vertex_groups[g.group].name for v in ob.data.vertices for g in v.groups if g.weight>.00001}
  if names and names.issubset({'head','jaw'}):old[ob.name]=[v.co.copy() for v in ob.data.vertices]
 bpy.ops.wm.open_mainfile(filepath=str(candidate));rig=bpy.data.objects['UprightRig'];body=bpy.data.objects['Upright body • connected joint topology'];scene=bpy.context.scene
 for track in rig.animation_data.nla_tracks:track.mute=True
 identity={};shift=Vector((0,HEAD_SETBACK,0)) # Blender forward is -Y.
 for name,points in old.items():
  ob=bpy.data.objects[name];assert len(points)==len(ob.data.vertices)
  error=max((v.co-(before+shift)).length for v,before in zip(ob.data.vertices,points));assert error<.00001,(kind,name,error)
  identity[name]={'vertices':len(points),'maximumDeviationFromRigidTranslationMetres':error}
 assert len(identity)>5,('Missing face identity coverage',kind)
 bm=bmesh.new();bm.from_mesh(body.data);seen=set();components=0
 for v in bm.verts:
  if v in seen:continue
  components+=1;stack=[v];seen.add(v)
  while stack:
   current=stack.pop()
   for edge in current.link_edges:
    other=edge.other_vert(current)
    if other not in seen:seen.add(other);stack.append(other)
 topology={'components':components,'boundaryEdges':sum(e.is_boundary for e in bm.edges),'nonManifoldEdges':sum(not e.is_manifold for e in bm.edges),'vertices':len(bm.verts),'faces':len(bm.faces)};bm.free();assert components==1 and topology['boundaryEdges']==0 and topology['nonManifoldEdges']==0
 record=json.loads((OUT/f'{kind}-manifest.json').read_text());clips={}
 for clip,duration in record['clips'].items():
  rig.animation_data.action=bpy.data.actions[clip];maximum=0.;finite=True;end=round(duration*30)+1
  for frame in range(1,end+1):
   scene.frame_set(frame);evaluated=body.evaluated_get(bpy.context.evaluated_depsgraph_get())
   finite=finite and all(math.isfinite(c) for v in evaluated.data.vertices for c in v.co)
   maximum=max(maximum,max(abs(value-1) for bone in rig.pose.bones for value in bone.matrix.to_scale()))
  assert finite and maximum<.0002,(kind,clip,maximum);clips[clip]={'frames':end,'maximumBoneScaleError':maximum,'finiteBodyVertices':finite}
 report={'sourceSha256':digest(candidate),'runtimeSha256':digest(OUT/'candidate'/f'{kind}-upright.glb'),'faceIdentity':identity,'bodyTopology':topology,'headNeckRestEndpoints':{n:{'head':list(rig.data.bones[n].head_local),'tail':list(rig.data.bones[n].tail_local)} for n in ['neck','head','jaw']},'clips':clips,'limits':'Exact rigid translation is verified for every mesh wholly weighted to head/jaw, including head, eyes, brows, mouth and facial attachments. Neck-weighted mane geometry may rotate to follow the new neck; attachment quality needs the matched visual review. Topology/unit scales do not prove lack of intersection.'}
 (OUT/f'{kind}-source-inspection.json').write_text(json.dumps(report,indent=2)+'\n');frozen();print('CONTACT_SOURCE_OK',kind,flush=True)

def render(kind):
 frozen();qa=OUT/'qa';qa.mkdir(exist_ok=True)
 for variant in ['control','candidate']:
  bpy.ops.wm.open_mainfile(filepath=str(OUT/variant/f'{kind}-upright.blend'));rig=bpy.data.objects['UprightRig'];scene=bpy.context.scene
  for track in rig.animation_data.nla_tracks:track.mute=True
  scene.render.engine='BLENDER_WORKBENCH';scene.render.resolution_percentage=100
  scene.display.shading.light='STUDIO';scene.display.shading.studio_light='paint.sl';scene.display.shading.color_type='MATERIAL';scene.display.shading.show_shadows=False;scene.display.shading.show_cavity=True
  scene.display.shading.background_type='WORLD';scene.world.color=(.09,.07,.055)
  data=bpy.data.cameras.new('Matched review');camera=bpy.data.objects.new('Matched review',data);scene.collection.objects.link(camera);scene.camera=camera;data.type='ORTHO';data.ortho_scale=3.8
  folder=qa/kind/variant;folder.mkdir(parents=True,exist_ok=True)
  clips=json.loads((OUT/f'{kind}-manifest.json').read_text())['clips']
  for view,location in {'front':(0,-6,2.5),'side':(6,0,2.4)}.items():
   camera.location=location;camera.rotation_euler=(Vector((0,0,1.3))-camera.location).to_track_quat('-Z','Y').to_euler()
   scene.render.resolution_x=480;scene.render.resolution_y=480
   for clip,frame in [('fight_idle',1),('attack',7),('guard',7),('celebrate',16),('defeat',40),('special',{'lion':12,'wolf':15,'unicorn':14}[kind])]:
    rig.animation_data.action=bpy.data.actions[clip];scene.frame_set(frame);scene.render.filepath=str(folder/f'{view}-{clip}.png');bpy.ops.render.render(write_still=True)
   scene.render.resolution_x=320;scene.render.resolution_y=320
   for clip in ['attack','guard','defeat','celebrate']+(['special'] if kind=='wolf' else []):
    frames=folder/f'{view}-{clip}';frames.mkdir(exist_ok=True)
    for old in frames.glob('*.png'):old.unlink()
    rig.animation_data.action=bpy.data.actions[clip];end=round(clips[clip]*30)+1
    for frame in sorted(set(list(range(1,end+1,2))+[end])):
     scene.frame_set(frame);scene.render.filepath=str(frames/f'{frame:04}.png');bpy.ops.render.render(write_still=True)
  print('CONTACT_MATCHED_RENDERED',kind,variant,flush=True)
 frozen()

def package(kind):
 frozen();qa=OUT/'qa'/kind;manifest=json.loads((OUT/f'{kind}-manifest.json').read_text());views={}
 def ffmpeg(args):subprocess.run(['ffmpeg','-v','error','-y','-filter_threads','1','-filter_complex_threads','1']+args,check=True)
 with tempfile.TemporaryDirectory(prefix='contact-review-') as td:
  temp=Path(td)
  for view in ['front','side']:
   for clip in ['fight_idle','attack','guard','celebrate','defeat','special']:
    ffmpeg(['-i',str(qa/'control'/f'{view}-{clip}.png'),'-i',str(qa/'candidate'/f'{view}-{clip}.png'),'-filter_complex','hstack=inputs=2','-frames:v','1',str(qa/f'{view}-{clip}-comparison.png')])
   files=[];timeline=[];elapsed=0.
   for clip in ['attack','guard','defeat','celebrate']+(['special'] if kind=='wolf' else []):
    end=round(manifest['clips'][clip]*30)+1;expected=sorted(set(list(range(1,end+1,2))+[end]))
    for variant in ['control','candidate']:assert [int(p.stem) for p in sorted((qa/variant/f'{view}-{clip}').glob('*.png'))]==expected
    movie=temp/f'{view}-{clip}.mp4';files.append(movie)
    ffmpeg(['-framerate','15','-pattern_type','glob','-i',str(qa/'control'/f'{view}-{clip}'/'*.png'),'-framerate','15','-pattern_type','glob','-i',str(qa/'candidate'/f'{view}-{clip}'/'*.png'),'-filter_complex','hstack=inputs=2','-threads','1','-c:v','libx264','-crf','20','-pix_fmt','yuv420p',str(movie)])
    ffmpeg(['-i',str(movie),'-vf',f'scale=320:160,tile=5x{math.ceil(len(expected)/5)}:nb_frames={len(expected)}:padding=2:margin=2:color=0x201b1a','-frames:v','1',str(qa/f'{view}-{clip}-full-cycle.png')])
    duration=len(expected)/15;timeline.append({'clip':clip,'sourceFrames':expected,'start':elapsed,'end':elapsed+duration});elapsed+=duration
   listing=temp/f'{view}.txt';listing.write_text(''.join("file '"+str(p)+"'\n" for p in files));output=qa/f'{view}-paired-cycles.mp4'
   ffmpeg(['-f','concat','-safe','0','-i',str(listing),'-c','copy','-movflags','+faststart',str(output)])
   probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(output)]));assert abs(float(probe['format']['duration'])-elapsed)<.10
   views[view]={'movie':output.name,'duration':float(probe['format']['duration']),'clips':timeline}
 hashes={key:manifest[key] for key in ['sourceSha256','runtimeSha256','controlSourceSha256','controlRuntimeSha256']}
 (qa/'review-index.json').write_text(json.dumps({'species':kind,'order':'Left Cycle5 control; right isolated Cycle6 candidate.','render':'Matched Workbench shape/deformation review, material swatches only. No Cycles or runtime acceptance claim.','hashes':hashes,'views':views},indent=2)+'\n')
 for variant in ['control','candidate']:
  for view in ['front','side']:
   for clip in ['attack','guard','defeat','celebrate']+(['special'] if kind=='wolf' else []):shutil.rmtree(qa/variant/f'{view}-{clip}')
 frozen();print('CONTACT_REVIEW_PACKAGED',kind,flush=True)

if __name__=='__main__':
 args=sys.argv[sys.argv.index('--')+1:];kind=args[1] if len(args)>1 else 'all'
 for species in (['lion','wolf','unicorn'] if kind=='all' else [kind]):{'build':build,'inspect':inspect,'render':render,'package':package}[args[0]](species)
