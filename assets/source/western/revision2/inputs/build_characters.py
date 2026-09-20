"""Animal Racers: original authored continuous-mesh character production.
Run: Blender 4.5 LTS --background --python scripts/assets/build_characters.py -- [lion|wolf|unicorn|all]
All coordinates in design space are X/right, F/forward, H/up (metres).
The final glTF uses +Y/up, +Z/forward. No purchased or external asset inputs.
"""
import bpy, bmesh, math, os, sys, json, hashlib
from pathlib import Path
from mathutils import Vector, Matrix
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/assets/western'; SOURCE=ROOT/'assets/source/western'
for p in [OUT,SOURCE,SOURCE/'qa']:p.mkdir(parents=True,exist_ok=True)
FPS=30
CLIPS={'race_idle':2.,'run':.5,'jump':.8,'land':.3,'stumble':.65,'transform':1.2,'fight_idle':2.,'fight_move':.4,'attack':.57,'special':1.,'guard':.6,'hit':.4,'defeat':1.3,'celebrate':2.}
DEFS={
'lion':{'coat':'D89C46','shadow':'9A592B','cream':'F4DB9A','mane':'633221','accent':'EE7033','eye':'ECB949','size':1.,'rough':.93},
'wolf':{'coat':'728DAD','shadow':'34435F','cream':'C0DAE2','mane':'475C7E','accent':'65DDE7','eye':'82F0ED','size':1.,'rough':.92},
'unicorn':{'coat':'E6DCCD','shadow':'A7A6C3','cream':'FFF0D3','mane':'8464A0','accent':'EFBD64','eye':'827AD8','size':1.,'rough':.85}}
RAINBOW=['DD6C7A','E6A35A','E3CC76','78BDA5','6DA5C1','8685C5','AA79AE']

def V(p):return Vector((p[0],-p[1],p[2]))
def rgb(h):
 def lin(v):return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
 return tuple(lin(int(h[i:i+2],16)/255) for i in (0,2,4))
def mat(name,color,rough=.7,metal=0.,emission=0.):
 m=bpy.data.materials.new(name);m.diffuse_color=(*rgb(color),1);m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*rgb(color),1);bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal
 if rough>.6:bs.inputs['Specular IOR Level'].default_value=.23
 if emission:bs.inputs['Emission Color'].default_value=(*rgb(color),1);bs.inputs['Emission Strength'].default_value=emission
 return m

def mesh(name,verts,faces,material,bone=None):
 me=bpy.data.meshes.new(name);me.from_pydata([V(v) for v in verts],[],faces);me.update();bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free();ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob);me.materials.append(material)
 for p in me.polygons:p.use_smooth=True
 if bone:bind(ob,bone)
 return ob

def bind(ob,bone):
 group=ob.vertex_groups.new(name=bone);group.add(list(range(len(ob.data.vertices))),1.,'REPLACE');mod=ob.modifiers.new('Anatomical skin','ARMATURE');mod.object=rig;ob.parent=rig
 return ob

def bind_jaw_bridge(ob,jaw_weights):
 # Continuous head/jaw transition for the oral lining and external cheek skin.
 # This geometry stretches across the opening instead of leaving a floating mandible.
 assert len(jaw_weights)==len(ob.data.vertices)
 head_group=ob.vertex_groups.new(name='head');jaw_group=ob.vertex_groups.new(name='jaw')
 for i,w in enumerate(jaw_weights):
  if w<1.:head_group.add([i],1.-w,'REPLACE')
  if w>0.:jaw_group.add([i],w,'REPLACE')
 mod=ob.modifiers.new('Connected cheek deformation','ARMATURE');mod.object=rig;ob.parent=rig
 return ob

def wolf_mouth(m):
 # An open-front oral sleeve, with a palate and a mandible floor. The back/side
 # wall is a connected strip with three graded skin rows, not a dark solid plug.
 segments=16;verts=[];faces=[];weights=[]
 for row in range(4):
  w=row/3
  for i in range(segments):
   theta=math.pi/4+i/(segments-1)*math.pi*1.5
   x=.164*math.sin(theta);f=1.247+.223*math.cos(theta);h=1.276*(1-w)+1.247*w
   verts.append((x,f,h));weights.append(w)
 for row in range(3):
  for i in range(segments-1):
   a=row*segments+i;faces.append((a,a+1,a+1+segments,a+segments))
 bind_jaw_bridge(mesh('Connected inner mouth sleeve',verts,faces,m['dark']),weights)
 for name,h,bone in [('Upper palate',1.274,'head'),('Mandible floor',1.251,'jaw')]:
  ring=[(.157*math.sin(i*math.tau/24),1.248+.216*math.cos(i*math.tau/24),h) for i in range(24)]
  mesh(name,ring,[tuple(range(24))],m['dark'],bone)
 # Outer cheeks close the visible side gap while the front of the mouth stays open.
 for sign in [-1,1]:
  verts=[];faces=[];weights=[]
  for row in range(4):
   w=row/3
   for j in range(5):
    u=j/4;f=1.025+.145*u;x=sign*(.137+.035*math.sin(u*math.pi*.76))
    upper=1.278+.028*math.sin(u*math.pi);lower=1.233-.008*u
    verts.append((x,f,upper*(1-w)+lower*w));weights.append(w)
  for row in range(3):
   for j in range(4):
    a=row*5+j;faces.append((a,a+1,a+6,a+5))
  bind_jaw_bridge(mesh('Connected outer cheek',verts,faces,m['coat']),weights)
 # A restrained tongue establishes cavity depth without a human-like mouth shape.
 ellipsoid('Howl tongue',(0,1.30,1.259),(.059,.107,.011),m['leather'],'jaw',16,8)

def lion_mane_cap(m):
 # The former perimeter-only mane exposed the neck from the racing camera.
 # Closed lofted backing stays inside the existing mane height/width envelope.
 rings=[(.94,.13,.095),(1.08,.25,.17),(1.30,.38,.225),(1.53,.43,.245),(1.74,.405,.22),(1.92,.30,.17),(2.015,.11,.075)]
 sides=24;verts=[];faces=[]
 for h,rx,rf in rings:
  for i in range(sides):
   a=i*math.tau/sides;ripple=1+.018*math.cos(a*5+h*3)
   verts.append((math.sin(a)*rx*ripple,.435+math.cos(a)*rf,h))
 for row in range(len(rings)-1):
  for i in range(sides):
   a=row*sides+i;b=row*sides+(i+1)%sides;faces.append((a,b,b+sides,a+sides))
 faces.append(tuple(reversed(range(sides))));faces.append(tuple((len(rings)-1)*sides+i for i in range(sides)))
 mesh('Closed sculpted rear mane cap',verts,faces,m['mane'],'head')
 for row,(h,rx,rf,columns) in enumerate([(1.87,.32,.18,5),(1.67,.42,.23,5),(1.45,.42,.24,5),(1.23,.34,.21,5),(1.075,.24,.16,3)]):
  for j in range(columns):
   x=(j-(columns-1)/2)*(rx*1.55/max(columns-1,1));f=.435-rf*math.sqrt(max(.15,1-(x/rx)**2));sway=.022*math.sin(j*1.7+row)
   points=[(x,f+.025,h+.085),(x+sway,f-.035,h-.015),(x+sway*1.3,f-.065,h-.135),(x+sway,f-.075,h-.215)]
   strand('Layered rear mane lock',points,[(.071,.053),(.09,.065),(.061,.038),(.003,.002)],m['shadow'] if (j+row)%5==0 else m['mane'],'head')

def ellipsoid(name,center,radii,material,bone=None,seg=20,rings=12):
 # Deliberately warped contour (flattened sole, cheek planes), not retained primitive geometry.
 verts=[];faces=[]
 for j in range(rings+1):
  a=math.pi*j/rings
  for i in range(seg):
   t=2*math.pi*i/seg;verts.append((center[0]+radii[0]*math.sin(a)*math.cos(t),center[1]+radii[1]*math.sin(a)*math.sin(t),center[2]+radii[2]*math.cos(a)))
 for j in range(rings):
  for i in range(seg):a=j*seg+i;b=j*seg+(i+1)%seg;faces.append((a,b,b+seg,a+seg))
 return mesh(name,verts,faces,material,bone)

def strand(name,points,widths,material,bone=None,sides=8):
 # Sculpted tapered curved locks, fur and curves; elliptical swept cross-sections.
 verts=[];faces=[]
 for j,p in enumerate(points):
  p=Vector(p);t=(Vector(points[min(j+1,len(points)-1)])-Vector(points[max(0,j-1)])).normalized();a=t.cross(Vector((0,1,0)))
  if a.length<.1:a=t.cross(Vector((1,0,0)))
  a.normalize();b=t.cross(a).normalized();w=widths[j];w=(w,w) if isinstance(w,(int,float)) else w
  for i in range(sides):
   ang=i*2*math.pi/sides;q=p+a*(w[0]*math.cos(ang))+b*(w[1]*math.sin(ang));verts.append(tuple(q))
 for j in range(len(points)-1):
  for i in range(sides):a=j*sides+i;b=j*sides+(i+1)%sides;faces.append((a,b,b+sides,a+sides))
 faces.append(tuple(reversed(range(sides))));faces.append(tuple((len(points)-1)*sides+i for i in range(sides)))
 return mesh(name,verts,faces,material,bone)

def fused(name,parts,materials,weights=True,voxel=.055):
 bpy.ops.object.select_all(action='DESELECT')
 for ob in parts:ob.select_set(True)
 bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();ob=parts[0];ob.name=name
 mod=ob.modifiers.new('Sculpt volume union','REMESH');mod.mode='VOXEL';mod.voxel_size=voxel;mod.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=mod.name)
 mod=ob.modifiers.new('Sculpt surface relax','SMOOTH');mod.factor=1.2;mod.iterations=5;bpy.ops.object.modifier_apply(modifier=mod.name)
 mod=ob.modifiers.new('Mobile retopology','DECIMATE');mod.ratio=.55;bpy.ops.object.modifier_apply(modifier=mod.name)
 for p in ob.data.polygons:p.use_smooth=True
 if weights:skin_nearest(ob)
 return ob

def pointseg(p,a,b):
 ab=b-a;u=max(0.,min(1.,(p-a).dot(ab)/max(ab.length_squared,.00001)));return (p-(a+ab*u)).length

def skin_nearest(ob):
 names=list(rest);groups={n:ob.vertex_groups.new(name=n) for n in names}
 def smooth(a,b,v):
  t=max(0.,min(1.,(v-a)/(b-a)));return t*t*(3-2*t)
 for v in ob.data.vertices:
  p=v.co;x,f,h=p.x,-p.y,p.z
  # Torso never inherits an opposing limb: explicit anatomical regions are stable in both stances.
  body_names=['spine','chest','neck'];bw={n:math.exp(-pointseg(p,V(rest[n][0]),V(rest[n][1]))**2/.075) for n in body_names};total=sum(bw.values());bw={n:w/total for n,w in bw.items()}
  side='L' if x>=0 else 'R';fam='front' if f>.03 else 'rear';limb_names=[f'{fam}_{section}_{side}' for section in ['upper','lower','paw']]
  lw={n:math.exp(-pointseg(p,V(rest[n][0]),V(rest[n][1]))**2/.018) for n in limb_names};total=sum(lw.values());lw={n:w/total for n,w in lw.items()}
  blend=smooth(.10,.27,abs(x))*(1-smooth(.66,1.11,h))
  # Belly/flank vertices do not follow the lifted forearm into a long armpit web.
  if fam=='front':blend*=smooth(.05,.28,f)
  if h<.5:blend=1.
  weights={n:w*(1-blend) for n,w in bw.items()};weights.update({n:w*blend for n,w in lw.items()});weights=sorted(weights.items(),key=lambda v:-v[1])[:4];total=sum(w for n,w in weights)
  for n,w in weights:
   if w/total>.001:groups[n].add([v.index],w/total,'REPLACE')
 mod=ob.modifiers.new('Anatomical skin','ARMATURE');mod.object=rig;ob.parent=rig


def rest_skeleton():
 d={'root':((0,0,0),(0,0,.3)),'spine':((0,-.53,.88),(0,-.02,1.05)),'chest':((0,-.02,1.05),(0,.47,1.12)),'neck':((0,.47,1.12),(0,.75,1.43)),'head':((0,.75,1.43),(0,1.08,1.44)),'jaw':((0,.94,1.27),(0,1.25,1.25))}
 for s,side in [(1,'L'),(-1,'R')]:
  d.update({f'front_upper_{side}':((s*.29,.45,1.02),(s*.33,.35,.55)),f'front_lower_{side}':((s*.33,.35,.55),(s*.33,.5,.19)),f'front_paw_{side}':((s*.33,.5,.19),(s*.33,.7,.12)),f'rear_upper_{side}':((s*.27,-.56,.93),(s*.34,-.3,.54)),f'rear_lower_{side}':((s*.34,-.3,.54),(s*.34,-.65,.18)),f'rear_paw_{side}':((s*.34,-.65,.18),(s*.34,-.45,.12))})
 for i in range(4):d[f'tail_{i}']=((0,-.75-i*.21,.96+i*.08),(0,-.96-i*.21,1.04+i*.08))
 return d

def create_rig():
 global rig,rest
 rest=rest_skeleton();data=bpy.data.armatures.new('Dual stance anatomical skeleton');rig=bpy.data.objects.new('AnimalRig',data);bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
 for n,(a,b) in rest.items():
  bone=data.edit_bones.new(n);bone.head=V(a);bone.tail=V(b)
  if n!='root':bone.parent=data.edit_bones['root']
 bpy.ops.object.mode_set(mode='OBJECT');rig.show_in_front=True
 return rig

def body(kind,m):
 # Underlying volumes are unified into ONE sculpted, smooth deforming surface.
 p=[]
 for name,c,r in [('ribcage',(0,.14,1.02),(.37,.61,.39)),('waist',(0,-.29,.93),(.27,.43,.28)),('pelvis',(0,-.56,.94),(.34,.34,.33)),('breast',(0,.5,.94),(.29,.29,.38)),('neck',(0,.61,1.21),(.29,.28,.38))]:p.append(ellipsoid(name,c,r,m['coat']))
 for sign,side in [(1,'L'),(-1,'R')]:
  for fam in ['front','rear']:
   for section,radius in [('upper',.19 if fam=='front' else .24),('lower',.115)]:
    a,b=rest[f'{fam}_{section}_{side}'];pts=[a,tuple((a[i]+b[i])*.5 for i in range(3)),b];p.append(strand('sculpt limb',pts,[radius,radius*.9,radius*.62],m['coat'],sides=12))
   a,b=rest[f'{fam}_paw_{side}'];c=(a[0],a[1]+.06,.14);p.append(ellipsoid('sculpt paw',c,(.195,.255,.145),m['coat']))
 ob=fused('Body • continuous sculpted skin',p,m,weights=False)
 # Sculpt the same closed surface into a load-bearing forequarter. This preserves
 # topology and contact pads, while adding depth in profile as well as chest width.
 # Species keep different masses: lion's heavy shoulders, wolf's lean wedge,
 # unicorn's deeper equine barrel. No extra disconnected shoulder objects.
 depth,width,deltoid={'lion':(.34,.24,.26),'wolf':(.22,.13,.17),'unicorn':(.32,.16,.20)}[kind]
 def smooth(a,b,v):
  u=max(0,min(1,(v-a)/(b-a)));return u*u*(3-2*u)
 for v in ob.data.vertices:
  p0=v.co.copy();x,f,h=p0.x,-p0.y,p0.z
  cage=smooth(.53,.82,h)*math.exp(-((f-.23)/.64)**4)
  v.co.x=x*(1+width*cage)
  v.co.z=h+(h-.97)*depth*cage
  # A smooth scapular flare grows from the ribcage into the upper forelimb.
  shoulder=math.exp(-((f-.34)/.29)**2-((h-1.04)/.29)**2)*smooth(.14,.32,abs(x))
  v.co.x+=math.copysign(.055 if kind=='lion' else .032,x)*shoulder
  arm=smooth(.48,.66,h)*(1-smooth(.92,1.13,h))*smooth(.13,.26,abs(x))*smooth(.03,.24,f)
  a,b=[V(q) for q in rest['front_upper_L' if x>=0 else 'front_upper_R']]
  axis=b-a;u=max(0,min(1,(p0-a).dot(axis)/axis.length_squared));radial=p0-(a+axis*u)
  v.co+=radial*(deltoid*arm)
 ob.data.update();skin_nearest(ob)
 # Painted regional vertex color follows the actual continuous skin; no harsh polygon patches.
 skinmat=mat('Matte region-painted fur','FFFFFF',.94 if kind!='unicorn' else .86)
 col=ob.data.color_attributes.new(name='FurColor',type='FLOAT_COLOR',domain='POINT')
 colors={k:Vector(rgb(DEFS[kind][k])) for k in ['coat','cream','shadow']}
 def fade(a,b,v):
  t=max(0,min(1,(v-a)/(b-a)));return t*t*(3-2*t)
 for v in ob.data.vertices:
  x,f,h=v.co.x,-v.co.y,v.co.z;base=colors['coat'].copy()
  chest=(1-fade(.10,.32,abs(x)))*fade(.20,.56,f)*(1-fade(1.08,1.28,h))*fade(.52,.80,h)
  base=base.lerp(colors['cream'],chest*.85)
  if kind=='wolf':base=base.lerp(colors['shadow'],fade(1.03,1.28,h)*(1-fade(.35,.75,f))*.9)
  if kind=='lion':base=base.lerp(colors['shadow'],(1-fade(.23,.45,h))*.18)
  noise=(math.sin(x*78+f*16+h*6)*math.sin(h*62+f*22)*.025+math.sin(f*12+h*17+x*9)*.035)
  base*=1+noise;col.data[v.index].color=(*base,1)
 ob.data.materials.clear();ob.data.materials.append(skinmat)
 for face in ob.data.polygons:face.material_index=0
 node=skinmat.node_tree.nodes.new('ShaderNodeVertexColor');node.layer_name='FurColor';skinmat.node_tree.links.new(node.outputs['Color'],skinmat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
 # Toes/hoof split and short claws intentionally distinct for each species.
 for sign,side in [(1,'L'),(-1,'R')]:
  for fam in ['front','rear']:
   a,b=rest[f'{fam}_paw_{side}'];bn=f'{fam}_paw_{side}'
   if kind=='unicorn':
    # rounded squared bell hoof, flattened sole, inset front groove.
    rings=[(.035,.18,.21),(.07,.18,.22),(.19,.155,.16),(.25,.105,.11)];vs=[];fs=[]
    for h,rx,rf in rings:
     for j in range(12):t=j*math.tau/12;vs.append((a[0]+rx*math.copysign(abs(math.cos(t))**.7,math.cos(t)),a[1]+.045+rf*math.copysign(abs(math.sin(t))**.7,math.sin(t)),h))
    for k in range(3):
     for j in range(12):q=k*12+j;r=k*12+(j+1)%12;fs.append((q,r,r+12,q+12))
    fs.extend([tuple(reversed(range(12))),tuple(range(36,48))]);mesh('Bronzed hoof',vs,fs,m['hoof'],bn)
    strand('Hoof cleft',[(a[0],a[1]+.26,.04),(a[0],a[1]+.25,.13),(a[0],a[1]+.205,.19)],[.013,.014,.006],m['dark'],bn)
   else:
    for j in range(3):
     x=a[0]+(j-1)*.095;ellipsoid('Paw toe',(x,a[1]+.195,.105),(.071,.115,.075),m['coat'],bn,12,8)
     strand('Ivory claw',[(x,a[1]+.245,.10),(x,a[1]+.30,.08),(x,a[1]+.32,.055)],[.022,.017,0],m['ivory'],bn,sides=6)
 return ob

def head(kind,m):
 p=[ellipsoid('Skull',(0,.82,1.48),(.34,.32,.33),m['coat'])]
 if kind=='lion':
  for s in [-1,1]:p.append(ellipsoid('Cheek',(s*.19,1.005,1.38),(.23,.24,.205),m['coat']))
  p.append(ellipsoid('Brow mass',(0,.96,1.59),(.3,.22,.18),m['coat']))
 elif kind=='wolf':
  p.append(ellipsoid('Tapered snout',(0,1.105,1.405),(.22,.39,.175),m['coat']));p.append(ellipsoid('Forehead',(0,.94,1.6),(.28,.25,.19),m['coat']))
 else:
  p.append(ellipsoid('Equine long face',(0,1.06,1.45),(.235,.4,.24),m['coat']));p.append(ellipsoid('Broad horse muzzle',(0,1.34,1.31),(.24,.22,.18),m['coat']))
 ob=fused('Head • species sculpt',p,m,False,voxel=.032);bind(ob,'head')
 # sculpted facial planes, muzzle pad and jaw are unified individually, preserving expression.
 if kind=='lion':
  for s in [-1,1]:ellipsoid('Cream muzzle pad',(s*.115,1.236,1.345),(.14,.11,.11),m['cream'],'head')
  nosef=1.32;noseh=1.42;nosex=.12
 elif kind=='wolf':
  ellipsoid('Frost muzzle',(0,1.31,1.345),(.185,.2,.12),m['cream'],'head');nosef=1.48;noseh=1.40;nosex=.105
 else:
  ellipsoid('Velvet muzzle',(0,1.47,1.295),(.225,.11,.14),m['shadow'],'head');nosef=1.55;noseh=1.35;nosex=.05
 if kind!='unicorn':
  verts=[(-nosex,nosef-.06,noseh+.03),(nosex,nosef-.06,noseh+.03),(0,nosef+.025,noseh-.065),(0,nosef+.06,noseh+.015),(0,nosef-.09,noseh-.04)];mesh('Heart shaped nose',verts,[(0,1,3),(1,2,3),(2,0,3),(0,4,1),(0,2,4),(1,4,2)],m['dark'],'head')
 else:
  for s in [-1,1]:ellipsoid('Nostril',(s*.155,1.544,1.32),(.035,.015,.05),m['dark'],'head',16,10)
 # Wide-set almond eyes sit in sculpted lids, with forward glints and expressive angled brows.
 eyef=1.07 if kind=='lion' else 1.00;eyex=.235 if kind!='unicorn' else .21;eyeh=1.59
 for s in [-1,1]:
  ellipsoid('Eye socket',(s*eyex,eyef,eyeh),(.130,.068,.078),m['shadow'],'head')
  ellipsoid('Ivory eye',(s*eyex,eyef+.043,eyeh),(.110,.043,.056),m['white'],'head')
  ellipsoid('Iris',(s*eyex,eyef+.087,eyeh),(.049,.013,.050),m['eye'],'head',20,12)
  ellipsoid('Pupil',(s*eyex,eyef+.097,eyeh),(.025,.008,.038),m['dark'],'head',16,10)
  ellipsoid('Eye glint',(s*eyex-.015,eyef+.103,eyeh+.023),(.016,.007,.018),m['white'],'head',12,8)
  strand('Expressive brow',[(s*(eyex-.1),eyef+.075,eyeh+.079),(s*eyex,eyef+.055,eyeh+.12),(s*(eyex+.115),eyef+.012,eyeh+.11)],[.031,.042,.012],m['mane'],'head')
  mf=1.235 if kind=='lion' else (1.42 if kind=='wolf' else 1.46);mh=1.255
  strand('Smiling mouth',[(s*.015,mf+.027,mh),(s*.12,mf+.003,mh-.013),(s*.19,mf-.08,mh+.025)],[.012,.012,.004],m['dark'],'head',6)
  if kind!='unicorn':
   for i in range(3):ellipsoid('Whisker pore',(s*(.12+.034*(i%2)),1.318-(i//2)*.02,1.34+i*.018),(.007,.007,.007),m['shadow'],'head',8,4)
 # An articulated lower jaw gives attacks/howl an actual facial performance.
 jf=1.23 if kind=='lion' else (1.28 if kind=='wolf' else 1.35)
 ellipsoid('Lower jaw',(0,jf,1.235),(.18,.19 if kind=='lion' else .25,.063),m['cream'],'jaw',20,10)
 if kind!='unicorn':
  if kind=='wolf':wolf_mouth(m)
  else:ellipsoid('Mouth cavity',(0,jf+.035,1.27),(.16,.17,.055),m['dark'],'head',18,10)
  for sign in [-1,1]:strand('Lower canine',[(sign*.128,jf+.10,1.25),(sign*.13,jf+.106,1.30),(sign*.128,jf+.11,1.33)],[.018,.013,0],m['ivory'],'jaw',7)
 # Shape-specific ears are custom closed surfaces with inset colored inner surfaces.
 for s in [-1,1]:
  if kind=='lion':
   ellipsoid('Rounded lion ear',(s*.295,.74,1.77),(.135,.08,.15),m['coat'],'head',18,12);ellipsoid('Inner lion ear',(s*.305,.805,1.785),(.075,.022,.092),m['mane'],'head',16,10)
  else:
   base=(s*.25,.72,1.68);tip=(s*.35,.64,2.02 if kind=='wolf' else 1.97)
   verts=[(base[0]-s*.10,base[1],base[2]),(base[0]+s*.12,base[1]-.02,base[2]-.035),tip,(base[0],base[1]-.12,base[2]+.075),(base[0],base[1]+.055,base[2]+.085)]
   mesh('Pointed species ear',verts,[(0,1,4),(0,4,2),(4,1,2),(0,2,3),(1,3,2),(0,3,1)],m['coat'],'head')
   mesh('Inner ear',[(base[0]-s*.055,base[1]+.015,base[2]+.045),(base[0]+s*.069,base[1],base[2]+.035),(tip[0],tip[1]+.015,tip[2]-.055),(base[0],base[1]+.06,base[2]+.09)],[(0,1,3),(0,3,2),(1,2,3)],m['mane'],'head')


def fur(kind,m):
 if kind=='lion':
  lion_mane_cap(m)
  # Layered swept teardrop locks form a distinctive leonine mane silhouette.
  for layer in range(3):
   for i in range(17):
    a=math.tau*(i+layer*.32)/17;rad=.33+layer*.055;cx=math.sin(a);cz=math.cos(a);h=1.46
    points=[(cx*rad,.73-layer*.10,h+cz*rad),(cx*(rad+.09),.65-layer*.095,h+cz*(rad+.10)),(cx*(rad+.16),.57-layer*.11,h+cz*(rad+.16)-.05),(cx*(rad+.17),.47-layer*.10,h+cz*(rad+.19)-.14)]
    strand('Sculpted mane lock',points,[(.09,.105),(.115,.09),(.068,.057),(.004,.003)],m['accent'] if layer==2 and i%4==0 else m['mane'],'head')
 elif kind=='wolf':
  for s in [-1,1]:
   for i in range(4):
    strand('Swept cheek ruff',[(s*.23,.70-i*.07,1.48-i*.03),(s*.37,.67-i*.08,1.44-i*.04),(s*(.48-i*.012),.5-i*.08,1.38-i*.05)],[.1,.085,0],m['cream'] if i%2 else m['mane'],'head')
  for i in range(6):strand('Ice swept crest',[(0,.63-i*.15,1.40-i*.05),(0,.52-i*.15,1.63-i*.05),(0,.32-i*.15,1.45-i*.05)],[(.10,.09),(.09,.06),0],m['accent'] if i%3==0 else m['mane'],'neck' if i<2 else 'chest')
 else:
  for i in range(7):
   color=m[f'rainbow_{i}'];x=(i-3)*.055
   strand('Rainbow swept forelock',[(x,.88,1.77),(x-.045,1.0,1.85),(x-.085,1.13,1.71),(x-.09,1.08,1.62)],[(.045,.07),(.06,.06),(.048,.04),0],color,'head')
   strand('Ribbon mane',[(x,.67,1.77),(x,.34,1.59),(x,.12,1.34),(x,-.1,1.16)],[(.048,.09),(.063,.1),(.06,.08),.005],color,'neck')
  # Horn follows an actual tapered spiral, no 2D decal.
  points=[(0,.985,1.75),(0,.99,1.94),(0,1.005,2.13),(0,1.035,2.32)];strand('Golden unicorn horn',points,[.096,.07,.043,0],m['gold'],'head',12)
  pts=[];ws=[]
  for j in range(65):
   u=j/64;r=.087*(1-u);a=u*math.tau*4;pts.append((math.cos(a)*r,.99+u*.04+math.sin(a)*r,1.77+u*.51));ws.append(.013*(1-u)+.003)
  strand('Horn spiral ridge',pts,ws,m['ivory'],'head',6)
 # Anatomical fur groups break up smooth limb tubes without hiding paws or joint bends.
 if kind!='unicorn':
  for sign,side in [(1,'L'),(-1,'R')]:
   for fam in ['front','rear']:
    shoulder=rest[f'{fam}_upper_{side}'][0]
    for j in range(3):
     x=shoulder[0]+sign*(.08+j*.017);f=shoulder[1]-.04-j*.055;h=shoulder[2]-.04-j*.06
     strand('Layered shoulder fur',[(x,f,h),(x+sign*.075,f-.055,h-.065),(x+sign*.04,f-.12,h-.18)],[(.064,.053),(.064,.041),0],m['coat'] if kind=='lion' else m['shadow'],f'{fam}_upper_{side}')
    ankle=rest[f'{fam}_lower_{side}'][1]
    for j in [-1,0,1]:
     x=ankle[0]+j*.09;f=ankle[1]-.055
     strand('Wrist fur',[(x,f,.37),(x+sign*.023,f-.04,.25),(x+sign*.016,f-.1,.20)],[.045,.039,0],m['coat'],f'{fam}_lower_{side}')
 else:
  for sign,side in [(1,'L'),(-1,'R')]:
   for fam in ['front','rear']:
    ankle=rest[f'{fam}_lower_{side}'][1]
    for j in range(5):
     a=j*math.tau/5;strand('Fetlock feather',[(ankle[0]+math.cos(a)*.105,ankle[1]+.03+math.sin(a)*.10,.34),(ankle[0]+math.cos(a)*.14,ankle[1]+.04+math.sin(a)*.145,.25),(ankle[0]+math.cos(a)*.145,ankle[1]+.04+math.sin(a)*.15,.18)],[.041,.052,0],m['coat'],f'{fam}_lower_{side}')
 # Tail is a continuous deforming tapered sweep with sequential bones.
 points=[];widths=[]
 for i in range(17):
  u=i/16;points.append((.04*math.sin(u*3),-.75-u*.88,.95+u*.32));widths.append(.075 if kind=='lion' else .12*(1-u)+.03)
 ob=strand('Articulated tail',points,widths,m['coat'] if kind=='lion' else m['mane'])
 for i,v in enumerate(ob.data.vertices):
  u=(i//8)/16*4;a=min(3,int(u));b=min(3,a+1);blend=u-int(u)
  for k,w in [(a,1-blend),(b,blend)]:
   name=f'tail_{k}';g=ob.vertex_groups.get(name) or ob.vertex_groups.new(name=name);g.add([i],w if a!=b else 1.,'ADD')
 mod=ob.modifiers.new('Tail skeleton','ARMATURE');mod.object=rig;ob.parent=rig
 if kind=='lion':
  for i in range(7):
   a=i*math.tau/7;strand('Flame tail tuft',[(math.cos(a)*.04,-1.49,1.25),(math.cos(a)*.10,-1.70,1.31),(math.cos(a)*.045,-1.92,1.42)], [.055,.09,0],m['accent'] if i%3==0 else m['mane'],'tail_3')
 elif kind=='unicorn':
  for i in range(7):
   x=(i-3)*.045;strand('Rainbow tail ribbon',[(x,-1.23,1.2),(x-.05,-1.48,1.25),(x-.03,-1.76,1.13),(x,-1.9,.96)],[.05,.065,.05,0],m[f'rainbow_{i}'],'tail_3')


def costume(kind,m):
 # Small western neckerchief and stamped crest; preserves the animal silhouette.
 strand('Leather neckerchief roll',[(-.29,.68,1.22),(-.19,.85,1.17),(0,.9,1.15),(.19,.85,1.17),(.29,.68,1.22)],[.065,.07,.07,.07,.065],m['leather'],'neck',8)
 verts=[(-.20,.85,1.19),(.2,.85,1.19),(.04,.93,.86),(-.035,.96,.88),(0,.99,1.13)];mesh('Neckerchief folded point',verts,[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],m['leather'],'neck')
 ellipsoid('Brass crest clasp',(0,.987,1.1),(.071,.024,.07),m['gold'],'neck',16,10)
 # Raised distinctive sigil: flame / water chevron / protective diamond.
 coords={'lion':[(-.025,1.015,1.085),(0,1.016,1.145),(.025,1.015,1.085),(0,1.016,1.10)],'wolf':[(-.035,1.015,1.12),(0,1.016,1.077),(.035,1.015,1.12)],'unicorn':[(0,1.015,1.145),(-.031,1.015,1.10),(0,1.015,1.064),(.031,1.015,1.10),(0,1.015,1.145)]}[kind]
 strand('Raised elemental crest',coords,[.008]*len(coords),m['dark'],'neck',5)


def lerp(a,b,t):return tuple(a[i]*(1-t)+b[i]*t for i in range(3))
def ease(t):return max(0,min(1,t))**2*(3-2*max(0,min(1,t)))
def targets(kind,clip,t,duration):
 d={n:(tuple(a),tuple(b)) for n,(a,b) in rest.items()};upright=clip not in ['race_idle','run','jump','land','stumble']
 u=ease(t/duration) if clip=='transform' else (1. if upright else 0.)
 if u:
  f={'spine':((0,-.13,.95),(0,-.02,1.35)),'chest':((0,-.02,1.35),(0,.055,1.70)),'neck':((0,.055,1.70),(0,.18,1.99)),'head':((0,.18,1.99),(0,.51,2.0)),'jaw':((0,.37,1.83),(0,.68,1.81))}
  for s,side in [(1,'L'),(-1,'R')]:
   f.update({f'front_upper_{side}':((s*.31,.05,1.68),(s*.45,.19,1.29)),f'front_lower_{side}':((s*.45,.19,1.29),(s*.40,.44,1.49)),f'front_paw_{side}':((s*.40,.44,1.49),(s*.40,.60,1.52)),f'rear_upper_{side}':((s*.26,-.12,.99),(s*.35,.03,.56)),f'rear_lower_{side}':((s*.35,.03,.56),(s*.36,-.12,.18)),f'rear_paw_{side}':((s*.36,-.12,.18),(s*.36,.08,.12))})
  for i in range(4):f[f'tail_{i}']=((0,-.36-i*.18,.95-i*.07),(0,-.54-i*.18,.88-i*.07))
  for n,(a,b) in f.items():d[n]=(lerp(d[n][0],a,u),lerp(d[n][1],b,u))
 def shift(n,dx=0,df=0,dh=0):
  a,b=d[n];d[n]=(tuple((a[0]+dx,a[1]+df,a[2]+dh)),tuple((b[0]+dx,b[1]+df,b[2]+dh)))
 def allshift(dh=0,df=0):
  for n in d:
   if n!='root':shift(n,df=df,dh=dh)
 def limb(fam,side,ankle,knee=None):
  upper=f'{fam}_upper_{side}';lower=f'{fam}_lower_{side}';paw=f'{fam}_paw_{side}';hip=d[upper][0];oldk=d[upper][1];olda=d[lower][1];toe=d[paw][1]
  if knee is None:knee=(oldk[0],oldk[1]+(ankle[1]-olda[1])*.45,oldk[2]+(ankle[2]-olda[2])*.55)
  d[upper]=(hip,knee);d[lower]=(knee,ankle);d[paw]=(ankle,tuple(toe[i]+ankle[i]-olda[i] for i in range(3)))
 cycle=t/duration*math.tau
 if clip in ['race_idle','fight_idle','guard']:
  breath=math.sin(cycle)*.015
  for n in ['spine','chest','neck','head']:shift(n,dh=breath)
  if clip=='guard':
   for s,side in [(1,'L'),(-1,'R')]:limb('front',side,(s*.24,.63,1.94),(s*.40,.32,1.58))
 elif clip=='run':
  # 8 m/s gallop: 0.50 s cycle, 0.125 s planted backward travel of exactly 1.0 m.
  # Hind pair contacts then fore pair; remaining 75% is airborne recovery.
  bounce=math.sin(cycle*2-.7)*.045-.035;allshift(dh=bounce)
  for fam,offset in [('front',.48),('rear',0.)]:
   for side,stagger in [('L',0.),('R',.08)]:
    phase=(t/duration+offset+stagger)%1.;a=rest[f'{fam}_lower_{side}'][1]
    if phase<.25:stride=.5-phase*4.;lift=0.
    else:
     recovery=(phase-.25)/.75;stride=-.5+ease(recovery);lift=math.sin(recovery*math.pi)*.36
    knee0=rest[f'{fam}_upper_{side}'][1];knee=(knee0[0],knee0[1]+stride*.44,knee0[2]+lift*.50+bounce)
    limb(fam,side,(a[0],a[1]+stride,a[2]+lift),knee)
  shift('head',dh=-bounce*.4)
 elif clip in ['jump','land','stumble']:
  p=t/duration
  amount=math.sin(p*math.pi) if clip=='jump' else (math.sin(p*math.pi)*-.14 if clip=='land' else math.sin(p*math.pi)*-.19)
  if clip=='jump':
   for fam in ['front','rear']:
    for side in ['L','R']:
     a=d[f'{fam}_lower_{side}'][1];limb(fam,side,(a[0],a[1]-.12*amount,a[2]+.35*amount))
   shift('head',dh=.09*amount)
  else:
   for n in ['spine','chest','neck','head']:shift(n,dh=amount)
   if clip=='stumble':shift('head',df=-.17*math.sin(p*math.pi))
 elif clip=='fight_move':
  # Native 3.6 m/s shuffle: 0.40 s cycle, alternating 50% planted .72 m travel.
  for side,offset in [('L',0.),('R',.5)]:
   phase=(t/duration+offset)%1.;a=d[f'rear_lower_{side}'][1]
   if phase<.5:stride=.36-phase*1.44;lift=0.
   else:
    recovery=(phase-.5)*2;stride=-.36+.72*ease(recovery);lift=math.sin(recovery*math.pi)*.10
   knee0=d[f'rear_upper_{side}'][1];knee=(knee0[0],knee0[1]+stride*.45,knee0[2]+lift*.5)
   limb('rear',side,(a[0],a[1]+stride,a[2]+lift),knee)
  for n in ['spine','chest','neck','head']:shift(n,dh=abs(math.sin(cycle))*.012)
 elif clip=='attack':
  # Timing contract: anticipation 0-.18 s, contact .18-.28 s, recovery to .57 s.
  wind=ease(t/.12)*(1-ease((t-.12)/.06));strike=ease((t-.12)/.06)*(1-ease((t-.28)/.29))
  travel=.57 if kind=='wolf' else .52;h=1.55 if kind!='unicorn' else 1.38
  limb('front','R',(-.23 if kind=='lion' else -.35,.44-.18*wind+travel*strike,h+.02*wind),(-.47,.18+.34*strike,1.34+.10*strike))
  for n in ['chest','neck','head']:shift(n,df=-.07*wind+.10*strike)
  limb('front','L',(.28,.56,1.73))
 elif clip=='special':
  windup,active,recovery={'lion':(.32,.14,.48),'wolf':(.43,.16,.55),'unicorn':(.40,.12,.43)}[kind]
  a=ease(t/windup)*(1-ease((t-windup-active)/recovery))
  if kind=='lion':
   for side,s in [('L',1),('R',-1)]:limb('front',side,(s*.35,.45+.45*a,1.55),(s*.47,.22+.3*a,1.3))
   for n in ['chest','neck','head']:shift(n,df=.13*a,dh=-.06*a)
  elif kind=='wolf':
   shift('head',df=-.14*a,dh=.12*a)
   ha,hb=d['head'];d['head']=(ha,(hb[0],hb[1]-.07*a,hb[2]+.16*a))
   for side,s in [('L',1),('R',-1)]:limb('front',side,(s*(.4+.12*a),.44-.18*a,1.49-.25*a))
  else:
   for side,s in [('L',1),('R',-1)]:limb('front',side,(s*(.4-.19*a),.44+.12*a,1.49+.35*a))
 elif clip=='hit':
  a=math.sin(t/duration*math.pi)
  for n in ['chest','neck','head']:shift(n,df=-.20*a,dh=-.055*a)
 elif clip=='defeat':
  a=ease(t/duration)
  for n in ['spine','chest','neck','head']:shift(n,df=.16*a,dh=-.62*a)
  for side,s in [('L',1),('R',-1)]:
   limb('front',side,(s*.45,.51,.36+.9*(1-a)),(s*.42,.24,.77+.4*(1-a)))
   limb('rear',side,(s*.38,-.12,.18),(s*.43,.34,.25+.31*(1-a)))
 elif clip=='celebrate':
  a=ease(min(t/.35,1));sway=math.sin(cycle*2)
  for side,s in [('L',1),('R',-1)]:limb('front',side,(s*.37,.43,1.49+a*1.01),(s*(.58-.08*a),.19-.04*a,1.29+a*.81))
  for n in ['spine','chest','neck','head']:shift(n,dx=sway*.025,dh=abs(sway)*.025)
 for i in range(4):shift(f'tail_{i}',dx=math.sin(cycle+i*.38)*.04*(i+1))
 # Jaw follows the head's world orientation; the howl opens at the active window.
 ha,hb=d['head'];ra,rb=rest['head'];rotation=(Vector(rb)-Vector(ra)).normalized().rotation_difference((Vector(hb)-Vector(ha)).normalized())
 ja,jb=rest['jaw'];jaw_a=Vector(ha)+rotation@(Vector(ja)-Vector(ra));jaw_b=Vector(ha)+rotation@(Vector(jb)-Vector(ra))
 opening=0.
 if clip=='special' and kind=='wolf':opening=.10*ease(t/.43)*(1-ease((t-.59)/.55))
 elif clip=='attack' and kind=='lion':opening=.055*ease(t/.18)*(1-ease((t-.28)/.29))
 jaw_b.z-=opening;d['jaw']=(tuple(jaw_a),tuple(jaw_b))
 return d


def set_targets(d):
 for n,(a,b) in d.items():
  pb=rig.pose.bones[n];ra,rb=rest[n];base=V(rb)-V(ra);delta=V(b)-V(a);rot=base.normalized().rotation_difference(delta.normalized());M=rot.to_matrix().to_4x4() @ rig.data.bones[n].matrix_local.copy();M @= Matrix.Diagonal((1,delta.length/base.length,1,1));M.translation=V(a);pb.matrix=M
 bpy.context.view_layer.update()

def refine_dual_stance_skin(kind):
 # Corrective sculpt pass: inspect the upright deformation, relax joint valleys in posed
 # space, then invert the exact linear skin matrix to preserve the single editable rig.
 ob=bpy.data.objects['Body • continuous sculpted skin'];set_targets(targets(kind,'fight_idle',0,2))
 deps=bpy.context.evaluated_depsgraph_get();evaluated=ob.evaluated_get(deps);pts=[v.co.copy() for v in evaluated.data.vertices]
 neighbors=[set() for _ in pts]
 for edge in ob.data.edges:
  a,b=edge.vertices;neighbors[a].add(b);neighbors[b].add(a)
 original=[p.copy() for p in pts]
 masks=[]
 for v in ob.data.vertices:
  h=v.co.z;mask=max(0,min(1,(h-.40)/.28));masks.append(mask)
 for iteration in range(35):
  for strength in [.55,-.54]:
   result=[]
   for i,p in enumerate(pts):
    average=sum((pts[j] for j in neighbors[i]),Vector())/len(neighbors[i]);result.append(p+(average-p)*strength*masks[i])
   pts=result
 bone_mats={b.name:b.matrix @ rig.data.bones[b.name].matrix_local.inverted() for b in rig.pose.bones}
 ob.shape_key_add(name='Basis');correction=ob.shape_key_add(name='Upright anatomical correction')
 for i,v in enumerate(ob.data.vertices):
  delta=pts[i]-original[i]
  if delta.length>.25:delta.normalize();delta*=.25
  M=Matrix(((0,0,0,0),)*4)
  for group in v.groups:
   name=ob.vertex_groups[group.group].name
   if name in bone_mats:M+=bone_mats[name]*group.weight
  try:correction.data[i].co=M.inverted() @ (original[i]+delta)
  except ValueError:pass
 ob.data.update();set_targets(rest)


def refine_raised_arms(kind):
 # High cup lift has a different shoulder fold from the fighting stance. Retain
 # a second additive correction, blended only over the existing .35 s lift.
 ob=bpy.data.objects['Body • continuous sculpted skin'];keys=ob.data.shape_keys
 keys.key_blocks['Upright anatomical correction'].value=1.
 set_targets(targets(kind,'celebrate',.5,2.));deps=bpy.context.evaluated_depsgraph_get()
 original=[v.co.copy() for v in ob.evaluated_get(deps).data.vertices];pts=[p.copy() for p in original]
 neighbors=[set() for _ in pts]
 for edge in ob.data.edges:
  a,b=edge.vertices;neighbors[a].add(b);neighbors[b].add(a)
 def smooth(a,b,v):
  t=max(0,min(1,(v-a)/(b-a)));return t*t*(3-2*t)
 masks=[smooth(.42,.75,v.co.z)*smooth(.03,.26,-v.co.y) for v in ob.data.vertices]
 for iteration in range(80):
  for strength in [.58,-.53]:
   pts=[p+(sum((pts[j] for j in neighbors[i]),Vector())/len(neighbors[i])-p)*strength*masks[i] for i,p in enumerate(pts)]
 bone_mats={b.name:b.matrix @ rig.data.bones[b.name].matrix_local.inverted() for b in rig.pose.bones}
 correction=ob.shape_key_add(name='Raised arms anatomical correction')
 for i,v in enumerate(ob.data.vertices):
  delta=pts[i]-original[i]
  if delta.length>.45:delta.normalize();delta*=.45
  M=Matrix(((0,0,0,0),)*4)
  for group in v.groups:
   name=ob.vertex_groups[group.group].name
   if name in bone_mats:M+=bone_mats[name]*group.weight
  try:
   local_delta=M.to_3x3().inverted()@delta
   # A blended skin matrix can be ill-conditioned at near-full extension.
   # Bound the source-space offset as well as its final posed displacement.
   if local_delta.length>.35:local_delta.normalize();local_delta*=.35
   correction.data[i].co=v.co+local_delta
  except ValueError:pass
 keys.key_blocks['Upright anatomical correction'].value=0.;correction.value=0.
 ob.data.update();set_targets(rest)


def animate(kind):
 rig.animation_data_create()
 for name,dur in CLIPS.items():
  action=bpy.data.actions.new(name);rig.animation_data.action=action
  frames=max(2,round(dur*FPS))+1
  for i in range(frames):
   frame=i+1;set_targets(targets(kind,name,i/FPS,dur))
   for pb in rig.pose.bones:
    pb.rotation_mode='QUATERNION';pb.keyframe_insert('location',frame=frame);pb.keyframe_insert('rotation_quaternion',frame=frame);pb.keyframe_insert('scale',frame=frame)
  action.use_fake_user=True;action['intent']=name;action['duration_seconds']=dur
  rig.animation_data.action=None
  track=rig.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,1,action);track.mute=True
 # Matched NLA track names merge the corrective sculpt with each skeletal clip in glTF.
 keys=bpy.data.objects['Body • continuous sculpted skin'].data.shape_keys;keys.animation_data_create()
 for name,dur in CLIPS.items():
  action=bpy.data.actions.new(name+'_corrective');keys.animation_data.action=action
  for f in range(round(dur*FPS)+1):
   value=ease(f/FPS/dur) if name=='transform' else (0. if name in ['race_idle','run','jump','land','stumble'] else 1.)
   keys.key_blocks['Upright anatomical correction'].value=value;keys.key_blocks['Upright anatomical correction'].keyframe_insert('value',frame=f+1)
   keys.key_blocks['Raised arms anatomical correction'].value=ease((f/FPS)/.35) if name=='celebrate' else 0.
   keys.key_blocks['Raised arms anatomical correction'].keyframe_insert('value',frame=f+1)
  keys.animation_data.action=None;action.use_fake_user=True;track=keys.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,1,action);track.mute=True
 keys.key_blocks['Upright anatomical correction'].value=0.;keys.key_blocks['Raised arms anatomical correction'].value=0.
 # Keep neutral quadruped as GLB default pose, clips are explicit tracks.
 set_targets(rest);rig.animation_data.action=None


def fur_microstructure(materials):
 # Original deterministic short-fur tangent normal texture, packed in the editable source.
 # The fibre heights are technical surface data, generated here from seeded strokes.
 import numpy as np
 N=256;rng=np.random.default_rng(73145);height=np.zeros((N,N),dtype=np.float32)
 for k in range(1800):
  x,y=rng.integers(0,N,2);length=int(rng.integers(8,31));amp=rng.uniform(.25,1.);bend=rng.uniform(-3,3)
  for j in range(length):
   cx=x+int(bend*math.sin(j/length*math.pi));cy=(y+j)%N;v=math.sin(j/length*math.pi)*amp
   for dx,factor in [(-1,.3),(0,1),(1,.3)]:height[cy,(cx+dx)%N]+=v*factor
 dx=(np.roll(height,-1,1)-np.roll(height,1,1))*.35;dy=(np.roll(height,-1,0)-np.roll(height,1,0))*.35
 normal=np.stack([-dx,-dy,np.ones_like(dx)],axis=-1);normal/=np.linalg.norm(normal,axis=-1,keepdims=True);rgba=np.ones((N,N,4),dtype=np.float32);rgba[:,:,:3]=normal*.5+.5
 image=bpy.data.images.get('Authored short-fur normal') or bpy.data.images.new('Authored short-fur normal',N,N,alpha=True)
 image.colorspace_settings.name='Non-Color';image.pixels.foreach_set(rgba.reshape(-1));image.filepath_raw=str(SOURCE/'short-fur-normal.png');image.file_format='PNG';image.save();image.pack()
 for material in materials:
  if material.name.split('.')[0] not in ['coat','cream','mane','shadow','Matte region-painted fur']:continue
  nodes=material.node_tree.nodes;texture=nodes.new('ShaderNodeTexImage');texture.image=image;texture.extension='REPEAT';normalnode=nodes.new('ShaderNodeNormalMap');normalnode.inputs['Strength'].default_value=.22
  material.node_tree.links.new(texture.outputs['Color'],normalnode.inputs['Color']);material.node_tree.links.new(normalnode.outputs['Normal'],nodes.get('Principled BSDF').inputs['Normal'])
 for ob in bpy.context.scene.objects:
  if ob.type!='MESH':continue
  uv=ob.data.uv_layers.new(name='Authored fur projection')
  for poly in ob.data.polygons:
   axis=max(range(3),key=lambda i:abs(poly.normal[i]))
   for loop in poly.loop_indices:
    p=ob.data.vertices[ob.data.loops[loop].vertex_index].co
    uv.data[loop].uv=((p.y,p.z) if axis==0 else ((p.x,p.z) if axis==1 else (p.x,p.y)))


def pack_vertex_colors(path):
 # Core glTF normalized RGBA16 keeps linear vertex color error below 1/65535.
 # This saves space for the second anatomical corrective without reducing meshes,
 # skinning precision, textures, normals, or requiring a runtime codec/extension.
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


def make(kind):
 global rig
 CLIPS['special']={'lion':.94,'wolf':1.14,'unicorn':.95}[kind]
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 for action in list(bpy.data.actions):bpy.data.actions.remove(action)
 d=DEFS[kind];m={k:mat(k,v,d['rough']) for k,v in d.items() if isinstance(v,str)}
 m.update({'dark':mat('Warm near black','211D26',.45),'white':mat('Eye ivory','FFF6E0',.27),'ivory':mat('Ivory','E9DDB9',.5),'gold':mat('Aged championship brass','CEA454',.35,.68),'leather':mat('Weathered oxblood leather','854D43',.85),'hoof':mat('Bronzed horn hoof','665A64',.42,.15)})
 for i,h in enumerate(RAINBOW):m[f'rainbow_{i}']=mat('Rainbow '+str(i),h,.55)
 create_rig();body(kind,m);head(kind,m);fur(kind,m);costume(kind,m);refine_dual_stance_skin(kind);refine_raised_arms(kind);fur_microstructure(list(bpy.data.materials));animate(kind)
 rig['character']=kind;rig['author']='Original Animal Racers commissioned artwork';rig['forward']='Blender -Y, glTF +Z';rig['units']='metres';rig['nominalRunSpeed']=8.;rig['nominalFightMoveSpeed']=3.6;rig['runStanceDuration']=.125;rig['runStanceTravel']=1.;rig['quality_status']='production study; cinematic owner acceptance pending'
 scene=bpy.context.scene;scene.render.fps=FPS
 bpy.ops.object.select_all(action='SELECT');bpy.context.view_layer.objects.active=rig
 bpy.context.preferences.filepaths.save_version=0
 bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/f'{kind}.blend'),compress=True)
 # Runtime batching: preserve editable named source objects above; combine for one skinned mesh.
 bpy.ops.object.select_all(action='DESELECT');parts=[o for o in bpy.context.scene.objects if o.type=='MESH']
 for ob in parts:
  ob.select_set(True)
  if not ob.data.color_attributes.get('FurColor'):
   colors=ob.data.color_attributes.new(name='FurColor',type='FLOAT_COLOR',domain='POINT')
   for item in colors.data:item.color=(1,1,1,1)
 bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();parts[0].name=kind+' • runtime skin';rig.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(OUT/f'{kind}.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,export_materials='EXPORT',export_yup=True,export_apply=False,export_cameras=False,export_lights=False,export_anim_slide_to_zero=True)
 pack_vertex_colors(OUT/f'{kind}.glb')
 print('ASSET_EXPORTED',kind,flush=True)

if __name__=='__main__':
 args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['all'];species=args[0] if args else 'all'
 for kind in (DEFS if species=='all' else [species]):make(kind)
