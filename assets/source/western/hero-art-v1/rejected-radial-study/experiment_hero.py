"""Isolated Lion hero-art candidate; never writes canonical assets or old QA.
Blender --background --python scripts/assets/experiment_hero.py -- build|inspect|preview|motion|package [all|race|upright]
"""
import bpy,bmesh,math,json,hashlib,sys,shutil,subprocess,tempfile
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'assets/source/western/hero-art-v1';FPS=30
V=lambda p:Vector((p[0],-p[1],p[2]))
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def frozen():
 for p,h in json.loads((OUT/'frozen-inputs.json').read_text())['files'].items():assert digest(ROOT/p)==h,('Frozen input changed',p)
def smooth(x):x=max(0,min(1,x));return x*x*(3-2*x)
def mix(a,b,t):return a*(1-t)+b*t
def rgb(h):
 def linear(v):return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
 return Vector(tuple(linear(int(h[i:i+2],16)/255) for i in (0,2,4)))
GOLD=rgb('BE8238');CREAM=rgb('E2C893');RUSSET=rgb('873D1D');SHADOW=rgb('4B261B');COPPER=rgb('C46624')
def material(name,rough=.8):
 m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(.45,.22,.06,1);bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=rough;bs.inputs['Specular IOR Level'].default_value=.25
 attr=m.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name='FurColor';m.node_tree.links.new(attr.outputs['Color'],bs.inputs['Base Color'])
 image=bpy.data.images.get('Authored short-fur normal')
 if image and rough>.6:
  texture=m.node_tree.nodes.new('ShaderNodeTexImage');texture.image=image;normal=m.node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.28;m.node_tree.links.new(texture.outputs['Color'],normal.inputs['Color']);m.node_tree.links.new(normal.outputs['Normal'],bs.inputs['Normal'])
 return m

def actions_signature():
 value={a.name:[(f.data_path,f.array_index,[(tuple(k.co),k.interpolation) for k in f.keyframe_points]) for f in a.fcurves] for a in bpy.data.actions}
 return hashlib.sha256(json.dumps(value,sort_keys=True).encode()).hexdigest()
def body_signature(ob):
 value={'v':[tuple(v.co) for v in ob.data.vertices],'p':[tuple(p.vertices) for p in ob.data.polygons],'w':[[(ob.vertex_groups[g.group].name,g.weight) for g in v.groups] for v in ob.data.vertices],'keys':{key.name:[tuple(v.co) for v in key.data] for key in ob.data.shape_keys.key_blocks} if ob.data.shape_keys else {}}
 return hashlib.sha256(json.dumps(value,sort_keys=True).encode()).hexdigest()

class Sculpt:
 def __init__(self,rig,maps):self.rig=rig;self.maps=maps;self.fur=material('Hero region-painted fur',.87);self.eye=material('Hero restrained wet eye',.24);self.dark=bpy.data.materials['Warm near black'];self.parts=[]
 def mesh(self,name,points,faces,color=GOLD,bone='head',weights=None,mat=None,subdivide=False):
  # Original head-relative design coordinates; exact rest transfer coordinates both forms.
  weights=weights or [{bone:1.} for _ in points]
  vertices=[]
  for p,w in zip(points,weights):
   base=V((p[0],.75+p[1],1.43+p[2]));vertices.append(tuple(sum((self.maps[n]@base*weight for n,weight in w.items()),Vector())))
  data=bpy.data.meshes.new(name);data.from_pydata(vertices,[],faces);data.update();ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob);data.materials.append(mat or self.fur)
  groups={n:ob.vertex_groups.new(name=n) for n in {n for w in weights for n in w}}
  for i,w in enumerate(weights):
   for n,value in w.items():
    if value>0:groups[n].add([i],value,'REPLACE')
  # Merge only coincident seam vertices; a hand-built eye aperture is intentional.
  bm=bmesh.new();bm.from_mesh(data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free()
  for p in data.polygons:p.use_smooth=True
  colors=data.color_attributes.new(name='FurColor',type='FLOAT_COLOR',domain='POINT');inv=self.maps['head'].inverted()
  for vertex in data.vertices:
   old=inv@vertex.co;design=(old.x,-old.y-.75,old.z-1.43);c=color(design) if callable(color) else color;colors.data[vertex.index].color=(*c,1)
  uv=data.uv_layers.new(name='Hero flowing fur')
  for loop in data.loops:
   p=inv@data.vertices[loop.vertex_index].co;uv.data[loop.index].uv=(p.x*1.5,p.z*1.5)
  if subdivide:
   cage=data.copy();cage.name='Hero facial edit cage';cage.use_fake_user=True
   sub=ob.modifiers.new('Facial plane subdivision','SUBSURF');sub.levels=1;bpy.context.view_layer.objects.active=ob;ob.select_set(True);bpy.ops.object.modifier_apply(modifier=sub.name);ob.select_set(False)
  arm=ob.modifiers.new('Existing facial performance','ARMATURE');arm.object=self.rig;ob.parent=self.rig;self.parts.append(ob);return ob
 def curve(self,name,controls,width,color,bone='head',sides=6,steps=10,flat=.5):
  p=[Vector(x) for x in controls];verts=[];faces=[]
  for j in range(steps+1):
   t=j/steps;q=p[0]*(1-t)**3+p[1]*3*t*(1-t)**2+p[2]*3*t*t*(1-t)+p[3]*t**3
   tangent=((p[1]-p[0])*3*(1-t)**2+(p[2]-p[1])*6*t*(1-t)+(p[3]-p[2])*3*t*t).normalized();across=tangent.cross(Vector((0,1,0)))
   if across.length<.05:across=tangent.cross(Vector((1,0,0)))
   across.normalize();normal=tangent.cross(across).normalized();r=width*(.19+.93*math.sin(math.pi*min(1,t*1.05))**.57)*(1-t)**.60+.0007
   for i in range(sides):
    a=i*math.tau/sides;flute=1+.12*math.cos(a*3+t*1.7);v=q+across*(r*math.cos(a))+normal*(r*flat*math.sin(a)*flute);verts.append(tuple(v))
  for j in range(steps):
   for i in range(sides):a=j*sides+i;b=j*sides+(i+1)%sides;faces.append((a,b,b+sides,a+sides))
  faces.extend([tuple(reversed(range(sides))),tuple(steps*sides+i for i in range(sides))]);return self.mesh(name,verts,faces,color,bone)

def width(h):
 # Tapered chin, proud cheekbone, restrained temporal width and domed forehead.
 return .24+.07*math.exp(-((h-.045)/.16)**2)-.07*smooth((h-.24)/.13)
def face_forward(x,h):
 # A nasal bridge and broad planar whisker field, not separately attached cheek spheres.
 muzzle=.405*math.exp(-((h+.105)/.20)**2);forehead=.155*math.exp(-((h-.235)/.21)**2)
 taper=1-.40*(abs(x)/max(.15,width(h)))**1.5
 f=.02+(muzzle+forehead)*taper
 f+=.050*math.exp(-(x/.10)**2-((h-.04)/.25)**2)
 f+=.022*math.exp(-((abs(x)-.16)/.08)**2-((h+.065)/.095)**2)
 f+=.026*math.exp(-((abs(x)-.18)/.115)**2-((h-(.178+.18*abs(x)))/.034)**2)
 return f
def face_color(p):
 x,f,h=p;cream=math.exp(-((h+.125)/.105)**4)*smooth((f-.18)/.22);c=GOLD.lerp(CREAM,cream*.91)
 orbital=math.exp(-((abs(x)-.202)/.095)**2-((h-.155)/.078)**2);c=c.lerp(SHADOW,orbital*.22)
 return c*(.97+.03*math.sin(h*62+x*53))
def head_surface(s):
 N=32;verts=[];faces=[]
 for sign in [-1,1]:
  rings=[]
  for r,t in enumerate([0,.022,.065,.16,.32,.53,.77,1.]):
   row=[]
   for i in range(N):
    a=i*math.tau/N;ca,sa=math.cos(a),math.sin(a);x=.20+.085*ca;h=.142+.019*ca+(.034 if sa>=0 else .028)*sa
    dx,dh=x-.20,h-.142;tx=(width(.142)-.20)/dx if dx>0 else (-.20/dx if dx<0 else 1e8);th=(.37-.142)/dh if dh>0 else ((-.19-.142)/dh if dh<0 else 1e8);limit=min(tx,th)
    bx=.20+dx*limit;bh=.142+dh*limit
    if tx<th:bx=width(bh) if dx>0 else 0.
    x=mix(x,bx,t);h=mix(h,bh,t);f=face_forward(x,h)
    if r==0:f-=.010
    elif r==1:f+=.006
    elif r==2:f+=.012
    row.append(len(verts));verts.append((sign*x,f,h))
   rings.append(row)
  for a,b in zip(rings,rings[1:]):
   for i in range(N):j=(i+1)%N;faces.append((a[i],a[j],b[j],b[i]))
  # Connected temple/back shell from the outer face boundary; mirror seam welds.
  back=[]
  for index in rings[-1]:
   x,f,h=verts[index];back.append(len(verts));verts.append((x,-.20-.035*math.cos((h-.1)*5),h))
  for i in range(N):
   j=(i+1)%N
   if abs(verts[rings[-1][i]][0])+abs(verts[rings[-1][j]][0])>1e-5:faces.append((rings[-1][i],rings[-1][j],back[j],back[i]))
  faces.append(tuple(reversed(back)))
 s.mesh('Hero continuous skull cheeks and muzzle',verts,faces,face_color,subdivide=True)
 # Dark wet nose: softly rounded triangular section, retaining a flattened feline bridge.
 pts=[(-.105,.448,-.015),(-.065,.507,-.072),(0,.531,-.096),(.065,.507,-.072),(.105,.448,-.015),(.075,.478,.012),(0,.501,.016),(-.075,.478,.012),(0,.539,-.024),(0,.451,-.050)]
 faces=[(i,(i+1)%8,8) for i in range(8)]
 base=[]
 for x,f,h in pts[:8]:base.append(len(pts));pts.append((x,face_forward(x,h)-.012,h))
 for i in range(8):j=(i+1)%8;faces.append((i,base[i],base[j],j))
 faces.append(tuple(reversed(base)))
 s.mesh('Hero feline nose plane',pts,faces,mat=s.dark)
 # Tight lip/philtrum curves and whisker pore marks are accents on continuous form.
 for sign in [-1,1]:
  controls=[(0,face_forward(0,-.10)+.004,-.10),(sign*.015,face_forward(.015,-.18)+.007,-.18),(sign*.125,face_forward(.125,-.186)+.007,-.186),(sign*.205,face_forward(.205,-.14)+.006,-.14)]
  # Mouth edge is the actual muzzle/jaw opening; no separate floating lip strand.
  for row in range(3):
   for col in range(3):
    x=sign*(.067+col*.033);h=-.087-row*.031+col*.009;f=face_forward(x,h)+.003
    pts=[(x,f+.003,h)]+[(x+math.cos(a*math.tau/7)*.0043,f,h+math.sin(a*math.tau/7)*.0037) for a in range(7)]
    s.mesh('Hero whisker pore',pts,[(0,i+1,(i+1)%7+1) for i in range(7)],SHADOW)
 # Articulated flattened mandible, plus head/jaw blended inner oral wall.
 pts=[];faces=[];sections=[(-.04,.15,-.17,.080),(.10,.18,-.193,.083),(.265,.182,-.211,.044),(.365,.131,-.206,.033),(.412,.035,-.195,.020)]
 for f,w,h,r in sections:
  for i in range(16):a=i*math.tau/16;pts.append((w*math.cos(a),f,h+r*math.sin(a)))
 for row in range(len(sections)-1):
  for i in range(16):a=row*16+i;b=row*16+(i+1)%16;faces.append((a,b,b+16,a+16))
 faces.extend([tuple(reversed(range(16))),tuple(64+i for i in range(16))]);s.mesh('Hero shaped mandible',pts,faces,CREAM,bone='jaw')
 pts=[];faces=[];weights=[]
 for row in range(4):
  t=row/3
  for i in range(25):
   a=math.pi*.18+i/24*math.pi*1.64;x=.167*math.sin(a);f=.24+.17*math.cos(a);h=mix(-.176,-.20,t);pts.append((x,f,h));weights.append({'head':1-t,'jaw':t})
 for row in range(3):
  for i in range(24):a=row*25+i;faces.append((a,a+1,a+26,a+25))
 s.mesh('Hero connected oral sleeve',pts,faces,SHADOW,weights=weights)

def eyes_and_ears(s):
 for sign in [-1,1]:
  # Shallow eye surface sits below the orbital rim; no stack of protruding spheres.
  pts=[];faces=[]
  for row in range(5):
   r=row/4
   for i in range(32):
    a=i*math.tau/32;x=.20+.085*math.cos(a)*r;h=.142+.019*math.cos(a)*r+(.034 if math.sin(a)>=0 else .028)*math.sin(a)*r
    f=face_forward(x,h)-.016+.003*(1-r*r);pts.append((sign*x,f,h))
  for row in range(4):
   for i in range(32):a=row*32+i;b=row*32+(i+1)%32;faces.append((a,b,b+32,a+32))
  s.mesh('Hero recessed almond eye '+str(sign),pts,faces,rgb('C2A773'),mat=s.eye)
  for name,rx,rz,color,depth,dx,dh in [('amber iris',.037,.035,rgb('BD7D24'),.0015,0,0),('vertical pupil',.008,.022,rgb('14130F'),.003,0,0),('small catchlight',.004,.006,rgb('F9E9BE'),.004,-.009,.009)]:
   pts=[(sign*(.195+dx),face_forward(.195+dx,.14+dh)-.012+depth,.14+dh)]
   for i in range(24):
    a=i*math.tau/24;x=.195+dx+rx*math.cos(a);h=.14+dh+rz*math.sin(a);pts.append((sign*x,face_forward(x,h)-.013+depth,h))
   s.mesh('Hero '+name+' '+str(sign),pts,[(0,i+1,(i+1)%24+1) for i in range(24)],color,mat=s.eye)
  # Weighted brow planes sweep into the temple, with inward lowering for resolve.
  c=[(sign*.101,face_forward(.101,.19)+.012,.184),(sign*.156,face_forward(.156,.208)+.016,.21),(sign*.245,face_forward(.245,.225)+.012,.255),(sign*.314,.09,.24)]
  s.curve('Hero sculpted supraorbital brow '+str(sign),c,.023,GOLD.lerp(SHADOW,.18),steps=13,flat=.56)
  # Cupped D-shaped ear lobes, attached into the temple mane, not round buttons.
  pts=[];faces=[]
  center=Vector((sign*.325,.115,.39))
  for row in range(4):
   r=[1.,.77,.38,0.][row]
   for i in range(24):
    a=i*math.tau/24;x=sign*(.11*math.cos(a)*r);h=.12*math.sin(a)*r;f=(-.01 if row==0 else -.045*(1-r))+.015*math.cos(a)
    pts.append(tuple(center+Vector((x,f,h))))
  for row in range(3):
   for i in range(24):a=row*24+i;b=row*24+(i+1)%24;faces.append((a,b,b+24,a+24))
  s.mesh('Hero cupped leonine ear '+str(sign),pts,faces,lambda p:GOLD.lerp(SHADOW,.65*max(0,1-abs(p[0]-sign*.325)/.11)))

def mane(s):
 # A connected radial cheek/jaw ruff, open around the face and closed behind.
 # The radial layout replaces the rejected full-height hair cap/curtain approach.
 # Local design angles: zero above the skull, pi below the jaw.
 def point(a,t):
  flow=a+.14*math.sin(math.pi*t)+.035*math.sin(a*3)*t
  ca,sa=math.cos(flow),math.sin(flow)
  innerx=.242*math.sin(a);innerh=.060+.315*math.cos(a);innerf=.105+.155*max(0,-math.cos(a))
  radius=.565+.036*math.sin(flow*3+.6)+.018*math.cos(flow*11)
  outerx=sa*radius;outerh=ca*(.545 if ca>0 else .735)+.012*math.sin(flow*9)
  outerf=-.285+.04*ca
  x=mix(innerx,outerx,t);h=mix(innerh,outerh,t);f=mix(innerf,outerf,t)+.13*math.sin(math.pi*t)
  flute=.021*math.cos(a*23+.7*math.sin(a*4)+t*1.2)*math.sin(math.pi*min(t,1))
  f+=flute;return Vector((x,f,h))
 cols=92;rows=13;pts=[];faces=[]
 for row in range(rows):
  t=row/(rows-1)
  for j in range(cols):pts.append(tuple(point(j*math.tau/cols,t)))
 for row in range(rows-1):
  for j in range(cols):a=row*cols+j;b=row*cols+(j+1)%cols;faces.append((a,b,b+cols,a+cols))
 # Back shell joins both outer and inner rims. No bare cap can be exposed behind
 # loosely attached strands, and the low front opening preserves round ears.
 backstart=len(pts)
 for row in range(rows):
  t=row/(rows-1)
  for j in range(cols):
   a=j*math.tau/cols;p=point(a,t);p.y-=.11+.16*math.sin(math.pi*t);pts.append(tuple(p))
 for row in range(rows-1):
  for j in range(cols):a=backstart+row*cols+j;b=backstart+row*cols+(j+1)%cols;faces.append((a,a+cols,b+cols,b))
 for start in [0,(rows-1)*cols]:
  for j in range(cols):a=start+j;b=start+(j+1)%cols;faces.append((a,b,backstart+b,backstart+a))
 def furcolor(p):
  x,f,h=p;a=math.atan2(x,h-.04);rad=min(1,max(0,(math.hypot(x,h-.04)-.25)/.36));crest=(1+math.cos(a*23+.7*math.sin(a*4)))/2
  inner=SHADOW.lerp(RUSSET,.70);return inner.lerp(COPPER,.10+.29*rad+.07*crest)
 s.mesh('Hero connected radial cheek and jaw ruff',pts,faces,furcolor)
 # Swept, overlapping irregular tips emerge from the dark ruff; no forehead bangs.
 for j in range(27):
  a=j*math.tau/27+.025*math.sin(j*2.4);start=.30+.09*math.sin(j*1.7);length=.93+.06*math.cos(j*2.1)
  p0=point(a,start);p1=point(a+.045,.59);p2=point(a+.09,.83);p3=point(a+.16,length)
  p0.y+=.012;p1.y+=.045;p2.y+=.04;p3.y+=.018
  color=RUSSET.lerp(COPPER,.26+.17*(j%4==0))
  s.curve('Hero swept radial ruff tip',[tuple(p0),tuple(p1),tuple(p2),tuple(p3)],.038+.010*math.sin(j*2),color,steps=12,sides=6,flat=.55)
 # Short crest sweeps back from forehead and leaves both ears visible.
 for j in range(5):
  x=(j-2)*.072;c=[(x,.075,.31),(x+.03,.07,.43),(x+.04,-.07,.55),(x+.015,-.205,.535+.015*math.sin(j*2))]
  s.curve('Hero short swept crown',c,.047,RUSSET.lerp(COPPER,.45+.09*(j%2)),steps=12,sides=6,flat=.6)

def source_path(form):return ROOT/'assets/source/western'/('lion.blend' if form=='race' else 'lion-upright.blend')
def build(form):
 frozen();(OUT/'candidate').mkdir(exist_ok=True);(OUT/'inputs').mkdir(exist_ok=True)
 for f in ['race','upright']:
  target=OUT/'inputs'/f'lion-{f}.blend'
  if not target.exists():shutil.copy2(source_path(f),target)
 bpy.ops.wm.open_mainfile(filepath=str(OUT/'inputs/lion-race.blend'));reference={n:bpy.data.objects['AnimalRig'].data.bones[n].matrix_local.copy() for n in ['head','jaw']}
 bpy.ops.wm.open_mainfile(filepath=str(OUT/'inputs'/f'lion-{form}.blend'));rig=bpy.data.objects['AnimalRig' if form=='race' else 'UprightRig'];body=bpy.data.objects['Body • continuous sculpted skin' if form=='race' else 'Upright body • connected joint topology'];before_actions=actions_signature();before_body=body_signature(body)
 removed=[]
 for ob in list(bpy.context.scene.objects):
  if ob.type!='MESH':continue
  names={ob.vertex_groups[g.group].name for v in ob.data.vertices for g in v.groups if g.weight>.00001}
  if names and names.issubset({'head','jaw'}):removed.append(ob.name);data=ob.data;bpy.data.objects.remove(ob,do_unlink=True);bpy.data.meshes.remove(data)
 maps={n:rig.data.bones[n].matrix_local@reference[n].inverted() for n in reference};sculpt=Sculpt(rig,maps);head_surface(sculpt);eyes_and_ears(sculpt);mane(sculpt)
 assert actions_signature()==before_actions and body_signature(body)==before_body
 bpy.context.preferences.filepaths.save_version=0;source=OUT/'candidate'/f'lion-{form}.blend';runtime=OUT/'candidate'/f'lion-{form}.glb';bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True)
 bpy.ops.object.select_all(action='DESELECT')
 for ob in [o for o in bpy.context.scene.objects if o.type=='MESH']:
  if not ob.data.color_attributes.get('FurColor'):
   color=ob.data.color_attributes.new(name='FurColor',type='FLOAT_COLOR',domain='POINT')
   for item in color.data:item.color=(1,1,1,1)
  ob.select_set(True)
 bpy.context.view_layer.objects.active=body;bpy.ops.object.join();body.name='lion • hero experiment '+form;rig.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(runtime),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,export_materials='EXPORT',export_yup=True,export_apply=False,export_cameras=False,export_lights=False,export_anim_slide_to_zero=True)
 # Reuse only the immutable color/weight packing algorithm, without invoking a generator.
 ns={'__name__':'hero_packer','__file__':str(ROOT/'scripts/assets/build_upright.py')};exec(compile((ROOT/'assets/source/western/contact-v2/inputs/build_upright.py').read_text(),'frozen-packer','exec'),ns);ns['pack_vertex_colors'](runtime)
 record={'form':form,'inputSha256':digest(OUT/'inputs'/f'lion-{form}.blend'),'sourceSha256':digest(source),'runtimeSha256':digest(runtime),'bytes':runtime.stat().st_size,'unchangedActionsSha256':before_actions,'unchangedBodySha256':before_body,'removedHeadObjects':removed,'status':'Isolated Lion hero-art candidate; no production or cinematic acceptance'};(OUT/f'{form}-manifest.json').write_text(json.dumps(record,indent=2)+'\n');frozen();print('HERO_EXPORTED',form,flush=True)

def pose_source(form,variant,clip=None,frame=1):
 path=OUT/('candidate' if variant=='candidate' else 'inputs')/f'lion-{form}.blend';bpy.ops.wm.open_mainfile(filepath=str(path));rig=bpy.data.objects['AnimalRig' if form=='race' else 'UprightRig'];clip=clip or ('race_idle' if form=='race' else 'fight_idle')
 for track in rig.animation_data.nla_tracks:track.mute=True
 rig.animation_data.action=bpy.data.actions[clip]
 if form=='race':
  keys=bpy.data.objects['Body • continuous sculpted skin'].data.shape_keys
  for track in keys.animation_data.nla_tracks:track.mute=True
  keys.animation_data.action=bpy.data.actions[clip+'_corrective']
 bpy.context.scene.frame_set(frame);return rig
def setup_scene(rig,form):
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True;scene.render.resolution_x=640;scene.render.resolution_y=640;scene.render.resolution_percentage=100
 try:
  prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='METAL';prefs.get_devices()
  for d in prefs.devices:d.use=d.type=='METAL'
  scene.cycles.device='GPU'
 except Exception:pass
 scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.18,.16,.13,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.42
 scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
 for location,power,color,size in [((-3,-4,5),600,(1,.79,.52),4),((3,-2,4),400,(.56,.71,1),4),((1,3,4),850,(1,.51,.24),3)]:
  data=bpy.data.lights.new('Hero matched lighting','AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size;lamp=bpy.data.objects.new('Hero matched lighting',data);scene.collection.objects.link(lamp);lamp.location=location;lamp.rotation_euler=(Vector((0,0,1.3))-lamp.location).to_track_quat('-Z','Y').to_euler()
 data=bpy.data.cameras.new('Hero matched review');camera=bpy.data.objects.new('Hero matched review',data);scene.collection.objects.link(camera);scene.camera=camera;data.type='ORTHO';return scene,camera
def preview(form):
 frozen();folder=OUT/'qa'/form;folder.mkdir(parents=True,exist_ok=True)
 for variant in ['candidate'] if '--candidate-only' in sys.argv else ['control','candidate']:
  rig=pose_source(form,variant);scene,camera=setup_scene(rig,form);anchor=rig.pose.bones['head'].head.copy()+Vector((0,-.10,.08))
  for view,offset in [('front',(0,-5,.12)),('side',(5,0,.12)),('three-quarter',(3.5,-5,.6)),('body',(3.5,-5,1.))]:
   target=anchor if view!='body' else Vector((0,0,1.35 if form=='upright' else .95));camera.data.ortho_scale=1.65 if view!='body' else (3.5 if form=='upright' else 3.65);camera.location=target+Vector(offset);camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(folder/f'{variant}-{view}.png');bpy.ops.render.render(write_still=True)
  print('HERO_PREVIEW',form,variant,flush=True)
 frozen()

def inspect(form):
 frozen();path=OUT/'candidate'/f'lion-{form}.blend'
 bpy.ops.wm.open_mainfile(filepath=str(OUT/'inputs'/f'lion-{form}.blend'))
 bodyname='Body • continuous sculpted skin' if form=='race' else 'Upright body • connected joint topology'
 control={'actions':actions_signature(),'body':body_signature(bpy.data.objects[bodyname])}
 bpy.ops.wm.open_mainfile(filepath=str(path));assert actions_signature()==control['actions'];assert body_signature(bpy.data.objects[bodyname])==control['body']
 head=bpy.data.objects['Hero continuous skull cheeks and muzzle'];mesh=head.data
 adjacency={i:set() for i in range(len(mesh.vertices))};edgeuses={}
 for poly in mesh.polygons:
  assert poly.area>1e-12,('zero area skull polygon',poly.index)
  for a,b in poly.edge_keys:adjacency[a].add(b);adjacency[b].add(a);edgeuses[tuple(sorted((a,b)))]=edgeuses.get(tuple(sorted((a,b))),0)+1
 components=[];unseen=set(adjacency)
 while unseen:
  stack=[unseen.pop()];count=0
  while stack:
   a=stack.pop();count+=1
   for b in adjacency[a]&unseen:unseen.remove(b);stack.append(b)
  components.append(count)
 assert len(components)==1,components
 assert all(n<=2 for n in edgeuses.values()),'nonmanifold skull edge'
 boundary=[e for e,n in edgeuses.items() if n==1];boundarygraph={}
 for a,b in boundary:boundarygraph.setdefault(a,set()).add(b);boundarygraph.setdefault(b,set()).add(a)
 assert all(len(v)==2 for v in boundarygraph.values()),'incomplete eye boundary'
 unseen=set(boundarygraph);holes=[]
 while unseen:
  stack=[unseen.pop()];n=0
  while stack:
   a=stack.pop();n+=1
   for b in boundarygraph[a]&unseen:unseen.remove(b);stack.append(b)
  holes.append(n)
 assert len(holes)==2,('Only two eye apertures expected',holes)
 rig=bpy.data.objects['AnimalRig' if form=='race' else 'UprightRig'];hero=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.startswith('Hero ')]
 assert all(all(math.isfinite(n) for n in v.co) for o in hero for v in o.data.vertices)
 for ob in hero:
  for v in ob.data.vertices:assert abs(sum(g.weight for g in v.groups)-1)<1e-5,(ob.name,v.index)
 record={'form':form,'sourceSha256':digest(path),'scriptSha256':digest(Path(__file__)),'unchanged':control,'skullConnectedComponents':components,'skullBoundaryLoops':holes,'heroMeshCount':len(hero),'heroSourceVertices':sum(len(o.data.vertices) for o in hero),'heroSourcePolygons':sum(len(o.data.polygons) for o in hero),'rigBones':len(rig.data.bones),'caveat':'Topological skull continuity does not certify fur style, mouth fit, or cinematic quality.'}
 (OUT/f'{form}-source-inspection.json').write_text(json.dumps(record,indent=2)+'\n');print('HERO_SOURCE_OK',form,flush=True);frozen()

MOTION={'race':['run','jump','stumble'],'upright':['attack','special','guard','hit','defeat','celebrate']}
def motion(form):
 frozen();folder=OUT/'qa'/form/'motion';folder.mkdir(parents=True,exist_ok=True);records=[]
 for variant in ['control','candidate']:
  for clip in MOTION[form]:
   rig=pose_source(form,variant,clip);scene,camera=setup_scene(rig,form);scene.render.engine='BLENDER_WORKBENCH';scene.render.resolution_x=384;scene.render.resolution_y=384
   shading=scene.display.shading;shading.light='STUDIO';shading.studiolight_rotate_z=.35;shading.color_type='VERTEX';shading.show_cavity=True;shading.cavity_type='BOTH';shading.curvature_ridge_factor=1.1;shading.curvature_valley_factor=.7;shading.show_shadows=True;shading.background_type='WORLD';scene.world.color=(.12,.105,.085)
   # Workbench ignores shader graphs. Populate only missing in-memory vertex colors
   # from control material colors; this never writes the source or exports.
   for ob in [o for o in scene.objects if o.type=='MESH']:
    attr=ob.data.color_attributes.get('FurColor')
    if not attr:
     attr=ob.data.color_attributes.new(name='FurColor',type='FLOAT_COLOR',domain='CORNER')
     for poly in ob.data.polygons:
      c=ob.data.materials[poly.material_index].diffuse_color if ob.data.materials else (.5,.3,.1,1)
      for loop in poly.loop_indices:attr.data[loop].color=c
    ob.data.color_attributes.active_color=attr
   duration=(bpy.data.actions[clip].frame_range[1]-1)/FPS;n=math.ceil(duration*15)+1;times=[min(duration,i/15) for i in range(n)]
   for view,offset in [('side',(5,0,.12)),('three-quarter',(3.5,-5,.5))]:
    destination=folder/variant/f'{view}-{clip}';destination.mkdir(parents=True,exist_ok=True)
    for i,t in enumerate(times):
     frame=1+t*FPS;scene.frame_set(int(frame),subframe=frame%1);target=rig.pose.bones['head'].head.copy()+Vector((0,-.1,.02));camera.data.ortho_scale=1.9;camera.location=target+Vector(offset);camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(destination/f'{i:04d}.png');bpy.ops.render.render(write_still=True)
    records.append({'variant':variant,'view':view,'clip':clip,'times':times,'frames':n,'engine':'Workbench vertex color','imageSize':[384,384],'sourceSha256':digest(OUT/('candidate' if variant=='candidate' else 'inputs')/f'lion-{form}.blend')});print('HERO_MOTION',form,variant,view,clip,n,flush=True)
 (OUT/f'{form}-motion-samples.json').write_text(json.dumps(records,indent=2)+'\n');frozen()

def package(form):
 folder=OUT/'qa'/form;records=json.loads((OUT/f'{form}-motion-samples.json').read_text());evidence=[]
 def ff(args):subprocess.run(['ffmpeg','-v','error','-y','-filter_threads','1','-filter_complex_threads','1']+args,check=True)
 for view in ['front','side','three-quarter','body']:
  target=folder/f'{view}-comparison.png';ff(['-i',str(folder/f'control-{view}.png'),'-i',str(folder/f'candidate-{view}.png'),'-filter_complex','hstack=inputs=2','-frames:v','1',str(target)]);evidence.append(target)
 for view in ['side','three-quarter']:
  movies=[]
  for clip in MOTION[form]:
   control=folder/'motion/control'/f'{view}-{clip}';candidate=folder/'motion/candidate'/f'{view}-{clip}';movie=folder/f'{view}-{clip}.mp4';sample=next(x for x in records if x['variant']=='candidate' and x['view']==view and x['clip']==clip)
   assert len(list(control.glob('*.png')))==sample['frames']==len(list(candidate.glob('*.png')))
   ff(['-framerate','15','-i',str(control/'%04d.png'),'-framerate','15','-i',str(candidate/'%04d.png'),'-filter_complex','hstack=inputs=2','-threads','1','-c:v','libx264','-crf','19','-pix_fmt','yuv420p',str(movie)])
   sheet=folder/f'{view}-{clip}-every-frame.jpg';ff(['-i',str(movie),'-vf',f"scale=384:192,tile=4x{math.ceil(sample['frames']/4)}:nb_frames={sample['frames']}:padding=2:margin=2:color=0x201b1a",'-frames:v','1','-q:v','2',str(sheet)]);movies.append(movie);evidence.extend([movie,sheet])
  listing=folder/f'{view}-clips.txt';listing.write_text(''.join("file '"+m.name+"'\n" for m in movies));combined=folder/f'{view}-affected-cycles.mp4';ff(['-f','concat','-safe','0','-i',str(listing),'-c','copy','-movflags','+faststart',str(combined)]);evidence.append(combined)
 for p in evidence:assert p.exists() and p.stat().st_size>0
 (OUT/f'{form}-evidence.json').write_text(json.dumps({'recipeSha256':digest(Path(__file__)),'sourceSha256':digest(OUT/'candidate'/f'lion-{form}.blend'),'runtimeSha256':digest(OUT/'candidate'/f'lion-{form}.glb'),'files':{str(p.relative_to(ROOT)):digest(p) for p in evidence}},indent=2)+'\n');print('HERO_PACKAGE_OK',form,flush=True)

if __name__=='__main__':
 args=sys.argv[sys.argv.index('--')+1:];command=args[0];forms=['race','upright'] if len(args)<2 or args[1]=='all' else [args[1]]
 for form in forms:globals()[command](form)
