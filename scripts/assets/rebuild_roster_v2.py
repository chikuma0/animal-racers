"""Revision2 authored roster, from immutable f600be2 anatomical/animation controls.
Blender --background --factory-startup --disable-autoexec -t 2 --python this.py -- build lion all
Commands: build SPECIES FORM, preview SPECIES FORM, motion SPECIES FORM, inspect SPECIES FORM.
FORM is race|upright|all. Only revision2/candidate and revision2/qa are written by this recipe.
"""
import bpy,bmesh,math,json,hashlib,sys,subprocess,shutil,tempfile
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'assets/source/western/revision2';FPS=30
sys.path.insert(0,str(Path(__file__).resolve().parent))
import experiment_upright as rigmath
V=lambda p:Vector((p[0],-p[1],p[2]))
D=lambda p:Vector((p.x,-p.y,p.z))
def smooth(t):t=max(0.,min(1.,t));return t*t*(3-2*t)
def mix(a,b,t):return a*(1-t)+b*t
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def rgb(h):
 def linear(v):return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
 return Vector(tuple(linear(int(h[i:i+2],16)/255) for i in (0,2,4)))
PALETTES={
 'lion':dict(coat='C2924D',cream='E4D1A7',shadow='74451F',mane='75351F',tip='BD652A',eye='C79B45'),
 'wolf':dict(coat='6D8291',cream='D1D6CF',shadow='344450',mane='485D6D',tip='91A6AB',eye='76B9C5'),
 'unicorn':dict(coat='D7CEBA',cream='EFE6D2',shadow='7D7F8E',mane='9381A1',tip='C5A1B7',eye='7D749E')}
TIMING={'lion':(.68,.14,.82,.40),'wolf':(.55,.12,.82,.38),'unicorn':(.60,.14,.76,.42)}
def filename(kind,form,ext):return f'{kind}{"-upright" if form=="upright" else ""}.{ext}'
def body_name(form):return 'Body • continuous sculpted skin' if form=='race' else 'Upright body • connected joint topology'
def rig_name(form):return 'AnimalRig' if form=='race' else 'UprightRig'
def frozen():
 for rel,h in json.loads((OUT/'baseline.json').read_text())['files'].items():assert digest(OUT/'inputs'/Path(rel).name)==h,rel
def material(name,rough):
 m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(.35,.22,.11,1)
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=rough;bs.inputs['Specular IOR Level'].default_value=.23
 attr=m.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name='FurColor';m.node_tree.links.new(attr.outputs['Color'],bs.inputs['Base Color'])
 image=bpy.data.images.get('Authored short-fur normal')
 if image and rough>.6:
  tx=m.node_tree.nodes.new('ShaderNodeTexImage');tx.image=image;normal=m.node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.19;m.node_tree.links.new(tx.outputs['Color'],normal.inputs['Color']);m.node_tree.links.new(normal.outputs['Normal'],bs.inputs['Normal'])
 return m

class Surface:
 def __init__(self,kind,form,rig,reference):
  self.kind,self.form,self.rig=kind,form,rig;self.colors={k:rgb(v) for k,v in PALETTES[kind].items()}
  self.maps={n:rig.data.bones[n].matrix_local@reference[n].inverted() for n in reference if n in rig.data.bones}
  self.fur=material('Revision2 region-painted short fur',.88);self.eye=material('Revision2 restrained cornea',.28);self.parts=[]
 def mesh(self,name,points,faces,color=None,bone='head',weights=None,subdivide=False,eye=False,absolute=False,world=False):
  weights=weights or [{bone:1.} for _ in points];vertices=[]
  for p,w in zip(points,weights):
   q=V(p if (absolute or world) else (p[0],.75+p[1],1.43+p[2]));vertices.append(tuple(q if world else sum((self.maps[n]@q*v for n,v in w.items()),Vector())))
  data=bpy.data.meshes.new(name);data.from_pydata(vertices,[],faces);data.update();ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob);data.materials.append(self.eye if eye else self.fur)
  groups={n:ob.vertex_groups.new(name=n) for n in {n for w in weights for n in w}}
  for i,w in enumerate(weights):
   for n,v in w.items():
    if v>1e-8:groups[n].add([i],v,'REPLACE')
  colors=data.color_attributes.new(name='FurColor',type='FLOAT_COLOR',domain='POINT')
  for i,p in enumerate(points):
   c=color(p) if callable(color) else (color or self.colors['coat']);colors.data[i].color=(*c,1)
  uv=data.uv_layers.new(name='Directional coat UV')
  for l in data.loops:p=points[l.vertex_index];uv.data[l.index].uv=(p[0]*1.3+p[1]*.4,p[2]*1.8)
  bm=bmesh.new();bm.from_mesh(data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free()
  for poly in data.polygons:poly.use_smooth=True
  if subdivide:
   cage=data.copy();cage.name=name+' editable control cage';cage.use_fake_user=True;ob['edit_cage']=cage.name
   sub=ob.modifiers.new('Authored surface subdivision','SUBSURF');sub.levels=1;bpy.context.view_layer.objects.active=ob;ob.select_set(True);bpy.ops.object.modifier_apply(modifier=sub.name);ob.select_set(False)
  arm=ob.modifiers.new('Revision2 anatomical skin','ARMATURE');arm.object=self.rig;ob.parent=self.rig;self.parts.append(ob);return ob
 def lock(self,name,controls,width,depth,color=None,normal=(0,1,0),bone='head',blend_neck=False,absolute=False,steps=11):
  # A closed flattened, ridged leaf of fur, deliberately unlike round tube locks.
  controls=[Vector(p) for p in controls];normal=Vector(normal).normalized();verts=[];faces=[];weights=[];n=8
  for j in range(steps+1):
   t=j/steps;u=1-t;p=controls[0]*u**3+controls[1]*3*t*u*u+controls[2]*3*t*t*u+controls[3]*t**3
   tangent=((controls[1]-controls[0])*3*u*u+(controls[2]-controls[1])*6*t*u+(controls[3]-controls[2])*3*t*t).normalized();across=tangent.cross(normal).normalized();out=across.cross(tangent).normalized()
   w=width*(.60+.55*math.sin(t*math.pi))*(1-t)**.80+.0007;th=depth*(.5+.6*math.sin(t*math.pi))*(1-t)**.9+.0005
   for i in range(n):
    a=i*math.tau/n;corrugation=1+.16*math.cos(a*3+t*3);q=p+across*(math.cos(a)*w)+out*(math.sin(a)*th*corrugation);verts.append(tuple(q))
    follow=smooth(max((-q.z-.16)/.44,(-q.y-.20)/.44))*.75 if blend_neck else 0.;weights.append({'head':1-follow,'neck':follow} if blend_neck else {bone:1.})
  for j in range(steps):
   for i in range(n):a=j*n+i;b=j*n+(i+1)%n;faces.append((a,b,b+n,a+n))
  faces.extend([tuple(reversed(range(n))),tuple(steps*n+i for i in range(n))]);return self.mesh(name,verts,faces,color,weights=weights,absolute=absolute)

def face_functions(kind):
 if kind=='lion':cx,ez,erx,erz=.195,.142,.073,.028;bottom,top=-.19,.37
 elif kind=='wolf':cx,ez,erx,erz=.181,.164,.066,.026;bottom,top=-.19,.34
 else:cx,ez,erx,erz=.179,.19,.065,.030;bottom,top=-.36,.40
 def width(h):
  if kind=='lion':return .253+.079*math.exp(-((h-.03)/.17)**2)-.064*smooth((h-.25)/.13)
  if kind=='wolf':return .213+.060*math.exp(-((h-.09)/.14)**2)-.052*smooth((h-.23)/.14)
  return .184+.056*math.exp(-((h-.19)/.15)**2)-.028*smooth((-h-.17)/.18)
 def forward(x,h):
  ratio=min(1.,abs(x)/width(h));side=1-.47*ratio**1.45
  if kind=='lion':
   f=.020+(.390*math.exp(-((h+.092)/.17)**2)+.170*math.exp(-((h-.245)/.19)**2))*side
   f+=.070*math.exp(-(x/.095)**2-((h-.02)/.22)**2)+.037*math.exp(-((abs(x)-.16)/.073)**2-((h+.078)/.083)**2)
  elif kind=='wolf':
   f=.016+(.555*math.exp(-((h+.083)/.145)**2)+.143*math.exp(-((h-.245)/.17)**2))*side
   f+=.050*math.exp(-(x/.076)**2-((h-.028)/.2)**2)
  else:
   f=.035+(.510*math.exp(-((h+.225)/.225)**2)+.195*math.exp(-((h-.25)/.24)**2))*side
   f+=.054*math.exp(-(x/.085)**2-((h-.005)/.30)**2)
  f+=.021*math.exp(-((abs(x)-cx)/.10)**2-((h-(ez+.05+.12*abs(x)))/.030)**2)
  return f
 return cx,ez,erx,erz,bottom,top,width,forward

def face(s):
 kind=s.kind;cx,ez,rx,rz,bottom,top,width,forward=face_functions(kind);C=s.colors;N=32;verts=[];faces=[]
 def color(p):
  x,f,h=p
  if kind=='unicorn':
   c=C['coat'].lerp(C['shadow'],.60*smooth((-h-.17)/.20));c=c.lerp(C['cream'],.17*math.exp(-(x/.085)**2))
  else:
   cream=math.exp(-((h+.115)/(.103 if kind=='lion' else .145))**4)*smooth((f-.16)/.24);c=C['coat'].lerp(C['cream'],cream*.92)
   if kind=='wolf':c=c.lerp(C['shadow'],.43*smooth((h-.16)/.20))
  orbital=math.exp(-((abs(x)-cx)/.086)**2-((h-ez)/.059)**2);return c.lerp(C['shadow'],orbital*.32)
 for sign in [-1,1]:
  rings=[]
  for r,t in enumerate([0,.028,.090,.22,.42,.68,1.]):
   row=[]
   for i in range(N):
    a=i*math.tau/N;ca,sa=math.cos(a),math.sin(a);x=cx+rx*ca;h=ez+.016*ca+rz*sa;dx,dh=x-cx,h-ez
    tx=(width(ez)-cx)/dx if dx>0 else (-cx/dx if dx<0 else 1e8);th=(top-ez)/dh if dh>0 else ((bottom-ez)/dh if dh<0 else 1e8);lim=min(tx,th)
    bx=cx+dx*lim;bh=ez+dh*lim
    if tx<th:bx=width(bh) if dx>0 else 0.
    x=mix(x,bx,t);h=mix(h,bh,t);f=forward(x,h)+[-.008,.010,.012,0,0,0,0][r];row.append(len(verts));verts.append((sign*x,f,h))
   rings.append(row)
  for a,b in zip(rings,rings[1:]):
   for i in range(N):j=(i+1)%N;faces.append((a[i],a[j],b[j],b[i]))
  back=[]
  for index in rings[-1]:x,f,h=verts[index];back.append(len(verts));verts.append((x,-.165-.035*math.cos((h-.1)*5),h))
  for i in range(N):
   j=(i+1)%N
   if abs(verts[rings[-1][i]][0])+abs(verts[rings[-1][j]][0])>1e-5:faces.append((rings[-1][i],rings[-1][j],back[j],back[i]))
  faces.append(tuple(reversed(back)))
 skin=s.mesh('R2 connected orbital skull and species muzzle',verts,faces,color,subdivide=True)
 bpy.context.view_layer.update()
 def actual_forward(x,h):
  # Sample the authored, subdivided surface. Nasal attachments follow actual
  # editable geometry, not an analytic profile subsequently changed by subdivision.
  origin=s.maps['head']@V((x,2.75,1.43+h));direction=s.maps['head'].to_3x3()@V((0,-1,0));hit,point,normal,index=skin.ray_cast(origin,direction)
  return -(s.maps['head'].inverted()@point).y-.75 if hit else forward(x,h)
 # Eye aperture is physically recessed; two skin loops form the lid/tear rim.
 for sign in [-1,1]:
  pts=[];polys=[]
  for r in [0,.25,.55,.8,1.]:
   for i in range(32):
    a=i*math.tau/32;x=cx+rx*math.cos(a)*r;h=ez+.016*math.cos(a)*r+rz*math.sin(a)*r;pts.append((sign*x,forward(x,h)-.016+.003*(1-r*r),h))
  for row in range(4):
   for i in range(32):a=row*32+i;b=row*32+(i+1)%32;polys.append((a,b,b+32,a+32))
  s.mesh('R2 inset almond sclera',pts,polys,rgb('706C56'),eye=True)
  for name,ax,az,c,dep,offx,offz in [('iris',.030,.024,C['eye'],.004,0,-.002),('pupil',.009,.018,rgb('171A19'),.006,0,-.002),('catchlight',.0035,.004,rgb('F5E8CD'),.007,-.008,.005)]:
   x0=cx-.006+offx;z0=ez+offz;pts=[(sign*x0,forward(x0,z0)-.010+dep,z0)]
   for i in range(20):a=i*math.tau/20;x=x0+ax*math.cos(a);h=z0+az*math.sin(a);pts.append((sign*x,forward(x,h)-.010+dep,h))
   s.mesh('R2 '+name,pts,[(0,i+1,(i+1)%20+1) for i in range(20)],c,eye=True)
  lid=[];lidfaces=[]
  for row in range(2):
   for j in range(17):
    a=j*math.pi/16;x=cx+rx*math.cos(a);h=ez+.016*math.cos(a)+rz*math.sin(a)-row*.008*math.sin(a);lid.append((sign*x,forward(x,h)-.006,h))
  for j in range(16):lidfaces.append((j,j+1,j+18,j+17))
  s.mesh('R2 shaded upper eyelid margin',lid,lidfaces,C['shadow'].lerp(rgb('22211D'),.5))
  controls=[(sign*(cx-rx-.005),forward(cx-rx,ez+.035),ez+.030),(sign*(cx-.02),forward(cx-.02,ez+.06)+.006,ez+.062),(sign*(cx+.07),forward(cx+.07,ez+.105),ez+.105),(sign*(cx+.115),.065,ez+.09)]
  s.lock('R2 integrated brow ridge',controls,.015,.008,C['coat'].lerp(C['shadow'],.12),steps=10)
 # Species-specific nose is a tapered low convex surface integrated with bridge.
 if kind!='unicorn':
  nf=.447 if kind=='lion' else .578;nh=-.051;nx=.089 if kind=='lion' else .075
  pts=[(-nx,nf-.035,nh+.042),(-nx*.69,nf+.012,nh-.022),(0,nf+.028,nh-.051),(nx*.69,nf+.012,nh-.022),(nx,nf-.035,nh+.042),(nx*.52,nf-.008,nh+.063),(0,nf+.006,nh+.057),(-nx*.52,nf-.008,nh+.063),(0,nf+.031,nh+.012)]
  nasal_front=max(actual_forward(x,h) for x,f,h in pts)+.013
  pts=[(x,nasal_front+(.016 if i==8 else .001),h) for i,(x,f,h) in enumerate(pts)];polys=[(i,(i+1)%8,8) for i in range(8)]
  # Nose skirt closes onto the actual nasal surface instead of a floating decal.
  for x,f,h in list(pts[:8]):pts.append((x,actual_forward(x,h)-.010,h))
  for i in range(8):j=(i+1)%8;polys.append((i,j,9+j,9+i))
  s.mesh('R2 broad wet nose',pts,polys,rgb('282522'),eye=True)
  for sign in [-1,1]:
   for row in range(3):
    for col in range(3):
     x=sign*(.065+col*.030);h=-.066-row*.025+col*.009;f=forward(x,h)+.004;p=[(x,f,h)]+[(x+.0035*math.cos(a*math.tau/6),f+.001,h+.003*math.sin(a*math.tau/6)) for a in range(6)];s.mesh('R2 whisker follicle',p,[(0,i+1,(i+1)%6+1) for i in range(6)],rgb('5B4934'))
 else:
  for sign in [-1,1]:
   x0=sign*.115;h0=-.252;pts=[(x0,actual_forward(x0,h0)+.004,h0)]+[(x0+.018*math.cos(i*math.tau/16),actual_forward(x0+.018*math.cos(i*math.tau/16),h0+.033*math.sin(i*math.tau/16))+.004,h0+.033*math.sin(i*math.tau/16)) for i in range(16)]
   s.mesh('R2 equine nostril',pts,[(0,i+1,(i+1)%16+1) for i in range(16)],rgb('454447'))
 # Broad lower jaw closes against real lip edge; dark oral wall spans head/jaw.
 jawtip=min(actual_forward(0,bottom+.015)-.06,.35 if kind=='lion' else .50)
 sections=[(-.08,.163,bottom+.046,.084),(.055,.197,bottom+.002,.075),(.18,.18,bottom-.006,.053),(jawtip-.030,.12,bottom+.012,.036),(jawtip,.024,bottom+.025,.022)]
 if kind=='unicorn':sections=[(f,w*.87,h,rz) for f,w,h,rz in sections]
 if kind=='wolf':sections=[(f-.015,w*.85,h+.027,rz*.85) for f,w,h,rz in sections]
 pts=[];polys=[]
 for f,w,h,rr in sections:
  for i in range(16):a=i*math.tau/16;pts.append((w*math.cos(a),f,h+rr*math.sin(a)))
 for row in range(4):
  for i in range(16):a=row*16+i;b=row*16+(i+1)%16;polys.append((a,b,b+16,a+16))
 polys.extend([tuple(reversed(range(16))),tuple(64+i for i in range(16))]);s.mesh('R2 anatomical mandible',pts,polys,C['cream'] if kind!='unicorn' else C['shadow'],bone='jaw')
 pts=[];polys=[];weights=[]
 for row in range(4):
  t=row/3
  for i in range(25):a=math.pi*.20+i/24*math.pi*1.60;pts.append((.159*math.sin(a),.24+(.16 if kind=='lion' else .27)*math.cos(a),bottom+.021-.018*t));weights.append({'head':1-t,'jaw':t})
 for row in range(3):
  for i in range(24):a=row*25+i;polys.append((a,a+1,a+26,a+25))
 s.mesh('R2 articulated oral lining',pts,polys,rgb('352725'),weights=weights)
 if kind=='unicorn':
  # A horse has a closed, long upper/lower muzzle silhouette; the feline-style
  # free mandible produced the reviewed duck-bill defect. Keep the continuous
  # skull/muzzle and mark its tight lip directly on that evaluated surface.
  for name in ['R2 anatomical mandible','R2 articulated oral lining']:
   ob=bpy.data.objects.get(name)
   if ob:bpy.data.objects.remove(ob,do_unlink=True)
  pts=[];faces=[]
  for row in range(2):
   for i in range(21):
    x=(i/20*2-1)*.126;h=-.305+.024*(abs(x)/.126)**2-row*.006;pts.append((x,actual_forward(x,h)+.004,h))
  for i in range(20):faces.append((i,i+1,i+22,i+21))
  s.mesh('R2 equine closed lip seam',pts,faces,rgb('69686A'))
 ears(s)

def ears(s):
 C=s.colors
 for sign in [-1,1]:
  pts=[];faces=[];N=24
  for row,r in enumerate([1.,.8,.47,0.]):
   for i in range(N):
    a=i*math.tau/N
    if s.kind=='lion':x=sign*(.300+.099*math.cos(a)*r);h=.365+.116*math.sin(a)*r;f=.016-.047*(1-r)+.012*math.cos(a)
    elif s.kind=='wolf':
     # A pointed triangular canine pinna with a broad rooted base; the previous
     # elliptic upper arc read as a rabbit ear in the full-body review.
     anchors=[(-.09,0),(-.080,.083),(-.043,.18),(.005,.29),(.043,.20),(.083,.085),(.095,.002),(.048,-.063),(-.028,-.068)]
     pos=i/N*len(anchors);j=int(pos);u=pos-j;bx=mix(anchors[j][0],anchors[(j+1)%len(anchors)][0],u);bh=mix(anchors[j][1],anchors[(j+1)%len(anchors)][1],u)
     x=sign*(.240+bx*r);h=.315+bh*r;f=.01-.055*(1-r)+.012*bx/.09
    else:
     x=sign*((.245 if s.kind=='wolf' else .194)+(.092 if s.kind=='wolf' else .074)*math.cos(a)*r);h=.39+(.23 if s.kind=='wolf' else .20)*math.sin(a)*r;f=-.02-.047*(1-r)+.012*math.cos(a)
     if math.sin(a)<0:h=.39+math.sin(a)*r*.09
     x+=sign*.035*max(0,math.sin(a))*r
    pts.append((x,f,h))
  for row in range(3):
   for i in range(N):a=row*N+i;b=row*N+(i+1)%N;faces.append((a,b,b+N,a+N))
  s.mesh('R2 cupped species ear',pts,faces,lambda p:C['coat'].lerp(C['shadow'],.60*max(0,1-abs(abs(p[0])-(.30 if s.kind=='lion' else .245 if s.kind=='wolf' else .194))/.09)))

def lion_mane(s):
 C=s.colors;dark=rgb('542B1E');base=C['mane'];copper=C['tip'];verts=[];faces=[]
 # Scalp is a longitudinal open-face hood following occiput -> nape, NOT an annulus.
 N=32;rows=10;weights=[]
 for j in range(rows):
  t=j/(rows-1);f=.035-.63*t;rx=.31+.20*math.sin(math.pi*t)**.8-.15*t**4;rz=.34+.07*math.sin(math.pi*t)-.16*t**3;center=.02-.25*t
  for i in range(N):
   a=-math.pi*.52+i/(N-1)*math.pi*2.04
   x=rx*math.sin(a);h=center+rz*math.cos(a);verts.append((x,f,h));follow=smooth(t)*.85;weights.append({'head':1-follow,'neck':follow})
 for j in range(rows-1):
  for i in range(N-1):a=j*N+i;faces.append((a,a+1,a+N+1,a+N))
 faces.extend([tuple(reversed(range(N))),tuple((rows-1)*N+i for i in range(N))]);s.mesh('R2 connected occipital mane volume',verts,faces,lambda p:dark.lerp(base,.43+.22*max(0,p[2])),weights=weights)
 # Deliberately irregular primary clumps: flattened cross sections, split flow,
 # broad roots into the hood and slender curved tips. Round ears remain exposed.
 crown=[(-.24,.11,.255),(-.14,.14,.306),(-.025,.145,.34),(.08,.12,.323),(.188,.10,.286)]
 for i,(x,f,h) in enumerate(crown):
  s.lock('R2 swept crown primary',[(x,f,h),(x-.035,.035,h+.105),(x+.055,-.24,h+.14),(x+.075,-.40,h+.045)],.086,.023,lambda p:base.lerp(copper,.30+.15*smooth((p[2]-.26)/.2)),normal=(0,0,1),steps=14)
 for sign in [-1,1]:
  specs=[(.24,.055,.19,.44,-.12,.012,.080),(.275,.085,.10,.475,-.10,-.17,.092),(.27,.16,-.01,.405,.035,-.355,.092),(.235,.205,-.10,.285,.14,-.45,.086),(.16,.22,-.16,.115,.13,-.51,.070),(.31,-.12,.18,.49,-.40,-.01,.110),(.38,-.24,.035,.47,-.45,-.18,.109),(.36,-.29,-.15,.41,-.42,-.32,.105)]
  for i,(x,f,h,tx,tf,th,w) in enumerate(specs):
   p=[(sign*x,f,h),(sign*(x+.09),f+.025,h-.035),(sign*(tx+.07),tf+.13,th+.11),(sign*tx,tf,th)]
   s.lock('R2 flowing cheek and nape primary',p,w,.022,lambda p:base.lerp(copper,.20+.23*smooth((p[1]+.28)/.5)),normal=(sign*.65,.70,.08),blend_neck=i>=3,steps=13)
   # A fine offset overlaid blade creates a divided taper rather than a sphere/sausage.
   q=[(p[0][0]+sign*.015,p[0][1]+.012,p[0][2]+.010),(p[1][0]+sign*.02,p[1][1]+.02,p[1][2]+.015),(p[2][0]-sign*.014,p[2][1]+.025,p[2][2]+.010),(p[3][0]-sign*.025,p[3][1]-.015,p[3][2]-.032)]
   if i in [0,2,5]:
    q[2]=tuple(Vector(q[1]).lerp(Vector(q[2]),.70));q[3]=tuple(Vector(q[1]).lerp(Vector(q[3]),.66))
    s.lock('R2 secondary fur blade',q,w*.36,.012,base.lerp(copper,.32+.06*(i%2)),normal=(sign*.65,.70,.08),blend_neck=i>=3,steps=10)
  # Back flow is read during the race, with asymmetric tapered edges.
  for j in range(5):
   x=sign*(.075+j*.065);f=-.23-j*.032;h=.35-j*.045
   s.lock('R2 dorsal swept layer',[(x,f,h),(x+sign*.04,f-.12,h+.035),(x+sign*.075,f-.26,h-.08),(x+sign*.025,f-.34,h-.20)],.081,.024,base.lerp(copper,.15+.04*j),normal=(sign*.25,-.5,.7),blend_neck=True,steps=12)
  for j in range(2):
   x=sign*(.065+j*.078)
   s.lock('R2 continuous chest ruff flow',[(x,.17,-.12),(x+sign*.025,.20,-.25),(x+sign*.038,.14,-.38),(x-sign*.028,.07,-.51+j*.065)],.075,.027,base.lerp(copper,.26+j*.09),normal=(0,1,0),blend_neck=True,steps=13)
 # Purpose-designed continuous bib links cheek ruff to breast in each stance.
 # It is a shared grid surface with irregular pointed lower contour, not a torus
 # or a collar assembled from balls. Its bind positions are authored per form.
 pts=[];polys=[];weights=[];cols=24;rows=8
 for back in [False,True]:
  for j in range(rows):
   t=j/(rows-1)
   for i in range(cols+1):
    u=i/cols*2-1;x=u*(.285+.038*math.sin(t*math.pi)-.07*t)
    if s.form=='upright':
     top=1.81+.10*abs(u);bottom=1.34+.15*abs(u)+.025*math.cos(u*math.pi*7);h=mix(top,bottom,t);f=mix(.17,.41,t)+.035*(1-u*u)
    else:
     top=1.285+.14*abs(u);bottom=.62+.13*abs(u)+.025*math.cos(u*math.pi*7);h=mix(top,bottom,t);f=mix(.84,.60,t)+.075*(1-u*u)
    f+=.008*math.cos(u*math.pi*7+t*2)*math.sin(math.pi*t)
    if back:f-=.055
    pts.append((x,f,h));follow=smooth(t);weights.append({'neck':1-follow,'chest':follow})
 span=(cols+1)*rows
 for back in [0,1]:
  for j in range(rows-1):
   for i in range(cols):a=back*span+j*(cols+1)+i;polys.append((a,a+1,a+cols+2,a+cols+1) if not back else (a,a+cols+1,a+cols+2,a+1))
 boundary=list(range(cols+1))+[j*(cols+1)+cols for j in range(1,rows)]+list(reversed(range((rows-1)*(cols+1),(rows-1)*(cols+1)+cols)))+[j*(cols+1) for j in reversed(range(1,rows-1))]
 for i,a in enumerate(boundary):b=boundary[(i+1)%len(boundary)];polys.append((a,b,b+span,a+span))
 s.mesh('R2 connected breast ruff',pts,polys,lambda p:base.lerp(copper,.22+.15*math.cos(p[0]*13)**2),weights=weights,world=True)

def species_fur(s):
 if s.kind=='lion':lion_mane(s);return
 C=s.colors
 if s.kind=='wolf':
  for sign in [-1,1]:
   # A continuous cheek/neck field with short irregular silhouette teeth replaces
   # the rejected stack of identical horizontal white feathers.
   pts=[];faces=[];weights=[];cols=8;rows=15
   for back in [False,True]:
    for j in range(rows):
     t=j/(rows-1)
     for i in range(cols):
      u=i/(cols-1);x=mix(.211+.016*math.sin(t*math.pi),.270+.060*math.sin(t*math.pi)-.012*t,u);f=mix(.025+.050*t,-.125-.035*t,u)+.026*math.sin(u*math.pi);h=mix(.19-.39*t,.17-.40*t-.022*math.cos(5*math.pi*t),u)
      if back:f-=.033
      pts.append((sign*x,f,h));follow=smooth((-h-.10)/.22)*.55;weights.append({'head':1-follow,'neck':follow})
   span=cols*rows
   for back in [0,1]:
    for j in range(rows-1):
     for i in range(cols-1):a=back*span+j*cols+i;faces.append((a,a+1,a+cols+1,a+cols) if not back else (a,a+cols,a+cols+1,a+1))
   edge=list(range(cols))+[j*cols+cols-1 for j in range(1,rows)]+list(reversed(range((rows-1)*cols,(rows-1)*cols+cols-1)))+[j*cols for j in reversed(range(1,rows-1))]
   for i,a in enumerate(edge):b=edge[(i+1)%len(edge)];faces.append((a,b,b+span,a+span))
   s.mesh('R2 connected canine cheek coat',pts,faces,lambda p:C['coat'].lerp(C['cream'],.72*(1-smooth((p[2]-.025)/.17))),weights=weights)
   for j,(x,f,h,tx,tf,th,w) in enumerate([(.26,-.02,.11,.315,-.15,-.035,.040),(.285,-.025,-.005,.324,-.17,-.13,.046),(.255,.010,-.12,.280,-.16,-.275,.042)]):
    s.lock('R2 short irregular cheek tuft',[(sign*x,f,h),(sign*(x+.025),f-.018,h-.016),(sign*(tx+.012),tf+.055,th+.045),(sign*tx,tf,th)],w,.016,lambda p:C['coat'].lerp(C['cream'],.15+.45*smooth((-p[1]-.03)/.16)),normal=(sign*.75,.5,0),blend_neck=j==2,steps=9)
   for j,(h,f,drop,w) in enumerate([(.23,-.15,.13,.059),(.035,-.18,.17,.065),(-.14,-.15,.19,.058)]):
    s.lock('R2 short wolf nape flow',[(sign*.17,f,h),(sign*.235,f-.09,h-.012),(sign*.27,f-.17,h-drop*.6),(sign*.205,f-.26,h-drop)],w,.023,C['mane'].lerp(C['tip'],j*.07),normal=(sign*.7,0,.5),blend_neck=True,steps=10)
 else:
  colors=[rgb(c) for c in ['BB838F','CAA274','D2BF82','8FA793','8FACC3','A496BE','C5A2BF']]
  for j in range(12):
   h=.39-j*.052;x=.035+math.sin(j*.8)*.055;f=-.11-j*.013
   s.lock('R2 layered rainbow mane',[(x,f,h),(x+.21,f-.05,h+.02),(x+.29,f-.28,h-.15),(x+.14,f-.37,h-.39)],.069,.016,colors[j%7],normal=(1,0,.2),blend_neck=j>5,steps=15)
  for j in range(3):s.lock('R2 swept forelock',[(-.03+j*.042,.01,.35),(.03+j*.04,.12,.42),(.16+j*.03,.10,.35),(.21+j*.02,.08,.25)],.041,.011,colors[(j+2)%7],steps=12)
  # Continuous spiraled tapered horn with subtle helical relief, no stacked cones.
  pts=[];faces=[];N=12;rows=18
  for j in range(rows):
   t=j/(rows-1);r=.061*(1-t)**.85+.001
   for i in range(N):a=i*math.tau/N;rr=r*(1+.11*math.sin(a-t*math.tau*4));pts.append((rr*math.cos(a),.11+.11*t+rr*math.sin(a),.35+.46*t))
  for j in range(rows-1):
   for i in range(N):a=j*N+i;b=j*N+(i+1)%N;faces.append((a,b,b+N,a+N))
  faces.extend([tuple(reversed(range(N))),tuple((rows-1)*N+i for i in range(N))]);s.mesh('R2 spiral ivory horn',pts,faces,rgb('D5B770'))

def reshape_body(s,body):
 C=s.colors;form=s.form;kind=s.kind;body.data.materials.clear();body.data.materials.append(s.fur)
 attr=body.data.color_attributes.get('FurColor')
 if not attr:attr=body.data.color_attributes.new(name='FurColor',type='FLOAT_COLOR',domain='POINT')
 def delta(p):
  x,f,h=D(p);q=Vector((x,f,h))
  if form=='upright':
   chest=math.exp(-((h-1.54)/.23)**2)*math.exp(-(x/.50)**4)
   q.x*=1+({'lion':.10,'wolf':-.025,'unicorn':.045}[kind])*chest
   q.y+=({'lion':.033,'wolf':.005,'unicorn':.032}[kind])*chest*smooth((f+.06)/.22)
   waist=math.exp(-((h-1.20)/.14)**2)*math.exp(-(x/.4)**4);q.x*=1-.08*waist
  else:
   fore=math.exp(-((f-.39)/.35)**2)*smooth((h-.47)/.5);q.x*=1+({'lion':.12,'wolf':.01,'unicorn':.06}[kind])*fore
   q.z+=({'lion':.04,'wolf':.025,'unicorn':.038}[kind])*fore
  return V(q)-p
 offsets=[delta(v.co) for v in body.data.vertices]
 if body.data.shape_keys:
  for key in body.data.shape_keys.key_blocks:
   for v,d in zip(key.data,offsets):v.co+=d
 else:
  for v,d in zip(body.data.vertices,offsets):v.co+=d
 for v in body.data.vertices:
  x,f,h=D(v.co);cream=smooth((f+.08)/.48)*math.exp(-((h-1.49)/.50)**2) if form=='upright' else smooth((1.03-h)/.46)*math.exp(-((f-.05)/.95)**2)
  c=C['coat'].lerp(C['cream'],cream*.36)
  if kind=='wolf':c=c.lerp(C['shadow'],.30*(smooth((-f+.10)/.45) if form=='upright' else smooth((h-.87)/.45)))
  if kind=='unicorn':c=c.lerp(C['shadow'],.29*(1-smooth((h-.17)/.26)))
  attr.data[v.index].color=(*c*(.986+.014*math.sin(h*57+f*21+x*43)),1)
 body['revision2_edit']='Species ribcage/scapula mass, tapered waist, region coat; continuous connected source and validated joint weights preserved.'

def fit_costume(s):
 if s.form=='race':
  for name in ['Leather neckerchief roll','Neckerchief folded point','Brass crest clasp','Raised elemental crest']:
   ob=bpy.data.objects.get(name)
   if not ob:continue
   if name=='Leather neckerchief roll':
    pts=[];faces=[];N=32;radial=Vector((0,.31,-.28)).normalized()
    for i in range(N):
     a=i*math.tau/N;c=Vector((.32*math.sin(a),.59,1.17))+radial*(.33*math.cos(a));normal=Vector((math.sin(a),radial.y*math.cos(a),radial.z*math.cos(a)))
     for j in range(6):b=j*math.tau/6;pts.append(V(c+normal*(.020*math.cos(b))+Vector((0,.022*math.sin(b),.022*math.sin(b)))))
    for i in range(N):
     for j in range(6):faces.append((i*6+j,i*6+(j+1)%6,((i+1)%N)*6+(j+1)%6,((i+1)%N)*6+j))
    old=list(ob.data.materials);data=bpy.data.meshes.new('R2 fitted quadruped neck band');data.from_pydata(pts,[],faces);data.update();ob.data=data
    for m in old:data.materials.append(m)
    for p in data.polygons:p.use_smooth=True
   elif name=='Neckerchief folded point':
    old=list(ob.data.materials);data=bpy.data.meshes.new('R2 fitted quadruped scarf');data.from_pydata([V(p) for p in [(-.14,.873,.94),(.14,.873,.94),(.11,.880,.79),(0,.82,.65),(-.12,.877,.80)]],[],[(0,1,2,3,4)]);data.update();ob.data=data
    for m in old:data.materials.append(m)
   else:
    center=sum((v.co for v in ob.data.vertices),Vector())/len(ob.data.vertices);target=V((0,.946+(.035 if name=='Raised elemental crest' else 0),.91));shift=target-center
    for v in ob.data.vertices:v.co+=shift
   ob.vertex_groups.clear();g=ob.vertex_groups.new(name='chest');g.add(list(range(len(ob.data.vertices))),1.,'REPLACE')
  return
 for name in ['Leather neckerchief roll','Neckerchief folded point','Brass crest clasp','Raised elemental crest']:
  ob=bpy.data.objects.get(name)
  if not ob:continue
  if name=='Leather neckerchief roll':
   pts=[];faces=[];N=32
   for i in range(N):
    a=i*math.tau/N;c=Vector((.40*math.sin(a),.045+.355*math.cos(a),1.73-.16*math.cos(a)));normal=Vector((math.sin(a),math.cos(a),0))
    for j in range(6):b=j*math.tau/6;pts.append(V(c+normal*(.019*math.cos(b))+Vector((0,0,.024*math.sin(b)))))
   for i in range(N):
    for j in range(6):faces.append((i*6+j,i*6+(j+1)%6,((i+1)%N)*6+(j+1)%6,((i+1)%N)*6+j))
   old=list(ob.data.materials);data=bpy.data.meshes.new('R2 fitted leather V collar');data.from_pydata(pts,[],faces);data.update();ob.data=data
   for m in old:data.materials.append(m)
   for p in data.polygons:p.use_smooth=True
  elif name=='Neckerchief folded point':
   old=list(ob.data.materials);data=bpy.data.meshes.new('R2 fitted western scarf');data.from_pydata([V(p) for p in [(-.145,.391,1.49),(.145,.391,1.49),(.11,.358,1.35),(0,.321,1.25),(-.12,.355,1.35)]],[],[(0,1,2,3,4)]);data.update();ob.data=data
   for m in old:data.materials.append(m)
  else:
   center=sum((v.co for v in ob.data.vertices),Vector())/len(ob.data.vertices);target=V((0,.440+(0.035 if name=='Raised elemental crest' else 0),1.49));shift=target-center
   for v in ob.data.vertices:v.co+=shift
  ob.vertex_groups.clear();g=ob.vertex_groups.new(name='chest');g.add(list(range(len(ob.data.vertices))),1.,'REPLACE')

def tail_finish(s):
 if s.kind=='lion':
  for i in range(7):
   a=i*math.tau/7;x=math.cos(a);h=math.sin(a)
   s.lock('R2 tapered flame tail fur',[(x*.035,-1.48,1.25+h*.035),(x*.092,-1.64,1.31+h*.072),(x*.070,-1.84,1.42+h*.025),(x*.032,-1.97,1.38+h*.010)],.044,.018,s.colors['mane'].lerp(s.colors['tip'],.3+.08*(i%3)),normal=(x,0,h),bone='tail_3',absolute=True,steps=10)
 elif s.kind=='unicorn':
  colors=[rgb(c) for c in ['BB838F','CAA274','D2BF82','8FA793','8FACC3','A496BE','C5A2BF']]
  for i in range(9):
   x=(i-4)*.032
   s.lock('R2 flowing rainbow tail',[(x,-1.25,1.18),(x-.06,-1.47,1.32),(x+.10,-1.77,.95),(x-.02,-1.96,1.01+.035*math.sin(i))],.045,.018,colors[i%7],normal=(1,0,.5),bone='tail_3',absolute=True,steps=15)
 else:
  for sign in [-1,1]:
   for i in range(5):
    f=-.93-i*.13;h=1.00+i*.05
    s.lock('R2 flowing brush tail fur',[(sign*.045,f,h),(sign*.11,f-.06,h+.018),(sign*.13,f-.19,h+.032),(sign*.06,f-.31,h+.055)],.045,.016,s.colors['mane'].lerp(s.colors['tip'],i*.07),normal=(sign*.7,0,.5),bone=f'tail_{min(3,i)}',absolute=True,steps=9)

def animations(s):
 rig=s.rig;wind,active,recovery,evade=TIMING[s.kind]
 if s.form=='race':
  # Legacy fallback attack follows the new timing. Upright form carries authored
  # committed body coil. Matching body corrective tracks retain quad fallback.
  for oldname,newname,duration in [('attack','attack',wind+active+recovery),('hit','evade',evade)]:
   for suffix in ['', '_corrective']:
    old=bpy.data.actions.get(oldname+suffix)
    if not old:continue
    action=old if newname==oldname else old.copy();action.name=newname+suffix;start,end=action.frame_range;factor=duration*FPS/max(1,end-start)
    for fc in action.fcurves:
     for k in fc.keyframe_points:k.co.x=1+(k.co.x-start)*factor;k.handle_left.x=k.co.x;k.handle_right.x=k.co.x
    data=rig.animation_data if not suffix else bpy.data.objects[body_name('race')].data.shape_keys.animation_data
    if newname!=oldname:track=data.nla_tracks.new();track.name=newname;track.strips.new(newname,1,action);track.mute=True
    else:
     for track in data.nla_tracks:
      if track.name==oldname:
       for st in list(track.strips):track.strips.remove(st)
       track.strips.new(oldname,1,action)
    action.use_fake_user=True
  return
 rest={b.name:(D(b.head_local),D(b.tail_local),b.parent.name if b.parent else None) for b in rig.data.bones}
 # Reuse the proven connected fixed-length solve and baseline neutral pose only.
 ns={'__name__':'revision2_legacy_pose','__file__':str(ROOT/'scripts/assets/build_upright.py')}
 exec(compile((ROOT/'assets/source/western/contact-v2/inputs/build_upright.py').read_text(),'baseline-pose','exec'),ns);ns['REST']=rest
 for clip,duration in [('attack',wind+active+recovery),('evade',evade),('fight_idle',2.),('fight_move',.4)]:
  for track in list(rig.animation_data.nla_tracks):
   if track.name==clip:rig.animation_data.nla_tracks.remove(track)
  old=bpy.data.actions.get(clip)
  if old:bpy.data.actions.remove(old)
  action=bpy.data.actions.new(clip);rig.animation_data.action=action
  for frame in range(round(duration*FPS)+1):
   t=min(duration,frame/FPS);d,_=ns['pose'](s.kind,clip if clip in ['fight_idle','fight_move'] else 'fight_idle',t, duration)
   anticipation=smooth(t/(wind*.62))*(1-smooth((t-wind*.83)/(wind*.17))) if clip=='attack' else 0.
   extension=smooth((t-wind+.070)/.045)*(1-smooth((t-wind-active)/(recovery*.55))) if clip=='attack' else 0.
   duck=math.sin(math.pi*min(1,t/duration))**2 if clip=='evade' else .15*anticipation
   lean=-.13*anticipation+.085*extension if clip=='attack' else -.17*duck
   drop=.065*anticipation+.015*extension if clip=='attack' else .20*duck
   if clip=='fight_move':drop=.06
   if clip=='fight_idle':drop=-math.sin(t*math.tau/2)*.006
   twist=({'lion':-.23,'wolf':-.13,'unicorn':-.08}[s.kind])*anticipation+({'lion':.12,'wolf':.04,'unicorn':.02}[s.kind])*extension
   def trunk(p):
    x,f,h=p;z=h-.95;ff=f*math.cos(lean)+z*math.sin(lean);hh=.95-drop+z*math.cos(lean)-f*math.sin(lean);w=smooth((h-.95)/.75);a=twist*w;return Vector((x*math.cos(a)-ff*math.sin(a),x*math.sin(a)+ff*math.cos(a),hh))
   for name in ['pelvis','spine','chest','neck','head','jaw','scapula_L','scapula_R']:d[name]=tuple(trunk(p) for p in rest[name][:2])
   for side,sign in [('L',1),('R',-1)]:
    upper,lower,paw=[f'front_{part}_{side}' for part in ['upper','lower','paw']];a=trunk(rest[upper][0]);hand=Vector((sign*.36,.43,1.64-drop))
    if clip=='attack':
     if side=='R':
      pull={'lion':(-.57,.11,1.75),'wolf':(-.39,.13,1.58),'unicorn':(-.32,.27,1.85)}[s.kind]
      target={'lion':(-.21,.985,1.52),'wolf':(-.34,1.03,1.46),'unicorn':(-.27,.97,1.51)}[s.kind]
      hand=hand.lerp(Vector(pull),anticipation);hand=hand.lerp(Vector(target),extension)
     else:hand=Vector((.28,.53,1.77+.04*anticipation))
    elif clip=='evade':hand=hand.lerp(Vector((sign*.23,.33,1.68-drop)),duck)
    l1=(rest[upper][1]-rest[upper][0]).length;l2=(rest[lower][1]-rest[lower][0]).length;pole=(sign*(1.+.12*anticipation),-.02,1.30-drop)
    elbow,hand,error=rigmath.solve_two(a,hand,l1,l2,pole);d[upper]=(a,elbow);d[lower]=(elbow,hand)
    paw_direction=Vector((0,.065,.173)).lerp(Vector((0,.18,-.04)),extension if side=='R' else 0)
    paw_direction.normalize();paw_direction*=Vector((0,.18,-.04)).length;d[paw]=(hand,hand+paw_direction)
    if clip=='fight_move':continue
    upper,lower,paw=[f'rear_{part}_{side}' for part in ['upper','lower','paw']];hip=Vector(rest[upper][0]);hip.z-=drop;ankle=Vector(rest[paw][0]);l1=(rest[upper][1]-rest[upper][0]).length;l2=(rest[lower][1]-rest[lower][0]).length
    knee,ankle,error=rigmath.solve_two(hip,ankle,l1,l2,(sign*.43,.65,.5-drop*.3));d[upper]=(hip,knee);d[lower]=(knee,ankle);d[paw]=(ankle,ankle+Vector((0,.20,-.06)))
   current=Vector(rest['tail_0'][0])+Vector((0,0,-drop))
   for i in range(4):
    delta=rest[f'tail_{i}'][1]-rest[f'tail_{i}'][0];delta=Vector((delta.x,delta.y*math.cos(duck*.3)+delta.z*math.sin(duck*.3),-delta.y*math.sin(duck*.3)+delta.z*math.cos(duck*.3)));d[f'tail_{i}']=(current,current+delta);current+=delta
   rigmath.set_pose(rig,d)
   for pb in rig.pose.bones:pb.rotation_mode='QUATERNION';pb.keyframe_insert('location',frame=frame+1);pb.keyframe_insert('rotation_quaternion',frame=frame+1);pb.keyframe_insert('scale',frame=frame+1)
  action.use_fake_user=True;rig.animation_data.action=None;track=rig.animation_data.nla_tracks.new();track.name=clip;track.strips.new(clip,1,action);track.mute=True
 rigmath.set_pose(rig,{n:(a,b) for n,(a,b,p) in rest.items()})

def build(kind,form):
 frozen();bpy.ops.wm.open_mainfile(filepath=str(OUT/'inputs'/f'{kind}.blend'));reference={b.name:b.matrix_local.copy() for b in bpy.data.objects['AnimalRig'].data.bones}
 bpy.ops.wm.open_mainfile(filepath=str(OUT/'inputs'/filename(kind,form,'blend')));rig=bpy.data.objects[rig_name(form)];body=bpy.data.objects[body_name(form)]
 rig.animation_data.action=None
 for track in rig.animation_data.nla_tracks:track.mute=True
 if body.data.shape_keys:
  body.data.shape_keys.animation_data.action=None
  for track in body.data.shape_keys.animation_data.nla_tracks:track.mute=True
  for key in body.data.shape_keys.key_blocks:key.value=0.
 for pb in rig.pose.bones:pb.matrix_basis=Matrix.Identity(4)
 removed=[]
 for ob in list(bpy.context.scene.objects):
  if ob.type!='MESH' or ob==body:continue
  names={ob.vertex_groups[g.group].name for v in ob.data.vertices for g in v.groups if g.weight>.00001}
  if (names and names.issubset({'head','jaw'})) or ob.name.startswith(('Layered shoulder fur','Wrist fur','Ribbon mane','Ice swept crest','Flame tail tuft','Rainbow tail ribbon')):
   removed.append(ob.name);bpy.data.objects.remove(ob,do_unlink=True)
 s=Surface(kind,form,rig,reference);reshape_body(s,body);face(s);species_fur(s);tail_finish(s)
 # Recess the fitted collar onto the breast so the broader jaw never wears it as
 # a cheek patch; gold crest remains the common western roster identifier.
 fit_costume(s)
 animations(s);rig['revision2']='Authored species surface replacement; cinematic gate pending actual runtime review';rig['attackWindup']=TIMING[kind][0];rig['attackActive']=TIMING[kind][1];rig['evadeDuration']=TIMING[kind][3];rig['nominalFightMoveSpeed']=3.6
 bpy.context.scene.render.fps=FPS;bpy.context.preferences.filepaths.save_version=0
 source=OUT/'candidate'/filename(kind,form,'blend');runtime=OUT/'candidate'/filename(kind,form,'glb');bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True)
 bpy.ops.object.select_all(action='DESELECT')
 for ob in [o for o in bpy.context.scene.objects if o.type=='MESH']:
  if not ob.data.color_attributes.get('FurColor'):
   attr=ob.data.color_attributes.new(name='FurColor',type='FLOAT_COLOR',domain='POINT')
   for c in attr.data:c.color=(1,1,1,1)
  ob.select_set(True)
 bpy.context.view_layer.objects.active=body;bpy.ops.object.join();body.name=kind+' • revision2 '+form;rig.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(runtime),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,export_materials='EXPORT',export_yup=True,export_apply=False,export_cameras=False,export_lights=False,export_anim_slide_to_zero=True)
 ns={'__name__':'revision2_packer','__file__':str(ROOT/'scripts/assets/build_upright.py')};exec(compile((ROOT/'assets/source/western/contact-v2/inputs/build_upright.py').read_text(),'packer','exec'),ns);ns['pack_vertex_colors'](runtime)
 clips={a.name:(a.frame_range[1]-a.frame_range[0])/FPS for a in bpy.data.actions if not a.name.endswith('_corrective')}
 record={'species':kind,'form':form,'recipeSha256':digest(Path(__file__)),'baselineCommit':'f600be2','inputSha256':digest(OUT/'inputs'/filename(kind,form,'blend')),'sourceSha256':digest(source),'runtimeSha256':digest(runtime),'bytes':runtime.stat().st_size,'clips':clips,'attackTiming':TIMING[kind][:3],'evadeDuration':TIMING[kind][3],'nominalFightMoveSpeed':3.6,'removedPrimitiveAttachments':removed,'status':'Revision2 actual replacement candidate; manual cinematic gate pending'}
 (OUT/f'{kind}-{form}-manifest.json').write_text(json.dumps(record,indent=2)+'\n');print('REVISION2_EXPORTED',kind,form,runtime.stat().st_size,flush=True)

def pose(kind,form,variant,clip=None,t=0):
 path=OUT/('candidate' if variant=='candidate' else 'inputs')/filename(kind,form,'blend');bpy.ops.wm.open_mainfile(filepath=str(path));rig=bpy.data.objects[rig_name(form)];clip=clip or ('race_idle' if form=='race' else 'fight_idle')
 for tr in rig.animation_data.nla_tracks:tr.mute=True
 rig.animation_data.action=bpy.data.actions[clip]
 body=bpy.data.objects[body_name(form)]
 if body.data.shape_keys:
  keys=body.data.shape_keys
  for tr in keys.animation_data.nla_tracks:tr.mute=True
  keys.animation_data.action=bpy.data.actions.get(clip+'_corrective')
 frame=1+t*FPS;bpy.context.scene.frame_set(int(frame),subframe=frame%1);return rig
def setup(form,size=512):
 scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.render.resolution_x=size;scene.render.resolution_y=size;scene.render.resolution_percentage=100
 sh=scene.display.shading;sh.light='STUDIO';sh.studiolight_rotate_z=.35;sh.color_type='VERTEX';sh.show_cavity=True;sh.cavity_type='BOTH';sh.curvature_ridge_factor=1.1;sh.curvature_valley_factor=.7;sh.show_shadows=True;sh.background_type='WORLD';scene.world.color=(.105,.087,.066);scene.view_settings.view_transform='Standard'
 for ob in [o for o in scene.objects if o.type=='MESH']:
  attr=ob.data.color_attributes.get('FurColor')
  if not attr:
   attr=ob.data.color_attributes.new(name='Display region',type='FLOAT_COLOR',domain='CORNER')
   for poly in ob.data.polygons:
    c=ob.data.materials[poly.material_index].diffuse_color if ob.data.materials else (.5,.3,.1,1)
    for l in poly.loop_indices:attr.data[l].color=c
  ob.data.color_attributes.active_color=attr
 data=bpy.data.cameras.new('Revision2 matched full silhouette');cam=bpy.data.objects.new('Revision2 matched full silhouette',data);scene.collection.objects.link(cam);scene.camera=cam;data.type='ORTHO';data.ortho_scale=3.4 if form=='upright' else 3.5
 return scene,cam
def view(cam,form,name,face=False):
 target=Vector((0,-.13,1.30 if form=='upright' else .94));offset={'front':(0,-6,.25),'side':(6,0,.3),'three-quarter':(3.5,-6,.65)}[name]
 if face:target=Vector((0,.03,2.06)) if form=='upright' else Vector((0,-.8,1.48));cam.data.ortho_scale=1.65
 cam.location=target+Vector(offset);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
def preview(kind,form):
 folder=OUT/'qa'/kind/form;folder.mkdir(parents=True,exist_ok=True)
 for variant in (['candidate'] if '--candidate-only' in sys.argv else ['control','candidate']):
  pose(kind,form,variant);scene,cam=setup(form)
  for name in ['front','side','three-quarter']:
   view(cam,form,name);scene.render.filepath=str(folder/f'{variant}-{name}.png');bpy.ops.render.render(write_still=True)
  view(cam,form,'three-quarter',True);scene.render.filepath=str(folder/f'{variant}-face.png');bpy.ops.render.render(write_still=True)
  print('REVISION2_PREVIEW',kind,form,variant,flush=True)

def materialproof(kind,form):
 folder=OUT/'qa'/kind/form;folder.mkdir(parents=True,exist_ok=True)
 for variant in ['control','candidate']:
  pose(kind,form,variant);scene,cam=setup(form);view(cam,form,'three-quarter');scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=20;scene.cycles.use_denoising=True;scene.render.threads_mode='FIXED';scene.render.threads=2
  scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.16,.18,.21,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
  scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
  for loc,power,c,size in [((-3,-4,5),700,(1,.85,.65),4),((3,-2,4),480,(.60,.75,1),4),((1,3,4),850,(1,.61,.33),3)]:
   data=bpy.data.lights.new('Matched softbox','AREA');data.energy=power;data.color=c;data.shape='DISK';data.size=size;ob=bpy.data.objects.new('Matched softbox',data);scene.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector((0,0,1.3))-ob.location).to_track_quat('-Z','Y').to_euler()
  scene.render.filepath=str(folder/f'{variant}-material.png');bpy.ops.render.render(write_still=True);print('REVISION2_MATERIAL_PROOF',kind,form,variant,flush=True)

def inspect(kind,form):
 frozen();source=OUT/'candidate'/filename(kind,form,'blend');pose(kind,form,'candidate');rig=bpy.data.objects[rig_name(form)];body=bpy.data.objects[body_name(form)]
 bm=bmesh.new();bm.from_mesh(body.data);unseen=set(bm.verts);components=[]
 while unseen:
  todo=[unseen.pop()];n=0
  while todo:
   v=todo.pop();n+=1
   for e in v.link_edges:
    other=e.other_vert(v)
    if other in unseen:unseen.remove(other);todo.append(other)
  components.append(n)
 topology={'components':components,'boundaryEdges':sum(e.is_boundary for e in bm.edges),'nonManifoldEdges':sum(not e.is_manifold for e in bm.edges),'vertices':len(bm.verts)};bm.free();assert len(components)==1 and topology['boundaryEdges']==0 and topology['nonManifoldEdges']==0,topology
 torso_indices=[v.index for v in body.data.vertices if sum(g.weight for g in v.groups if body.vertex_groups[g.group].name in ['pelvis','spine','chest','neck'])>.75]
 faceparts=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.startswith(('R2 connected orbital','R2 anatomical mandible','R2 broad wet nose','R2 equine nostril'))]
 def bounds(points):return {'min':[min(p[i] for p in points) for i in range(3)],'max':[max(p[i] for p in points) for i in range(3)]}
 records={};clips=[t.name for t in rig.animation_data.nla_tracks]
 for clip in clips:
  rig.animation_data.action=bpy.data.actions[clip]
  if body.data.shape_keys:body.data.shape_keys.animation_data.action=bpy.data.actions.get(clip+'_corrective')
  duration=(bpy.data.actions[clip].frame_range[1]-1)/FPS;head=[];torso=[];paw=[];scaleerr=0.
  # Source samples cover every actual animation frame, with exact strike boundaries.
  times=sorted(set([min(duration,i/FPS) for i in range(math.ceil(duration*FPS)+1)]+([TIMING[kind][0],TIMING[kind][0]+TIMING[kind][1]/2,TIMING[kind][0]+TIMING[kind][1]] if clip=='attack' else [])))
  active=[]
  for t in times:
   f=1+t*FPS;bpy.context.scene.frame_set(int(f),subframe=f%1);deps=bpy.context.evaluated_depsgraph_get();ev=body.evaluated_get(deps)
   assert all(math.isfinite(c) for v in ev.data.vertices for c in v.co),(clip,t)
   current=[D(v.co) for ob in faceparts for v in ob.evaluated_get(deps).data.vertices];head.extend(current);torso.extend(D(ev.data.vertices[i].co) for i in torso_indices);paw.append(D(rig.pose.bones['front_paw_R'].head));scaleerr=max(scaleerr,max(abs(x-1) for pb in rig.pose.bones for x in pb.matrix.to_scale()))
   if clip=='attack' and TIMING[kind][0]-.0001<=t<=sum(TIMING[kind][:2])+.0001:active.extend(current)
  if form=='upright':assert scaleerr<.0003,(clip,scaleerr)
  records[clip]={'duration':duration,'frames':len(times),'headJawBounds_XForwardUp':bounds(head),'torsoBounds_XForwardUp':bounds(torso),'rightForepawPivotBounds_XForwardUp':bounds(paw),'maximumBoneScaleError':scaleerr}
  if active:records[clip]['activeHeadJawBounds_XForwardUp']=bounds(active)
 report={'species':kind,'form':form,'sourceSha256':digest(source),'runtimeSha256':digest(OUT/'candidate'/filename(kind,form,'glb')),'recipeSha256':digest(Path(__file__)),'continuousBodyTopology':topology,'clips':records,'limitations':'Bone scale/topological continuity/finite geometry are structural checks, not proof of local clearance or cinematic style. Face is an editable separate skinned surface attached over the continuous body neck.'}
 (OUT/f'{kind}-{form}-source-inspection.json').write_text(json.dumps(report,indent=2)+'\n');print('REVISION2_SOURCE_OK',kind,form,flush=True)

def motion(kind,form):
 folder=OUT/'qa'/kind/form/'motion';folder.mkdir(parents=True,exist_ok=True);manifest=json.loads((OUT/f'{kind}-{form}-manifest.json').read_text());records=[]
 for clip,duration in manifest['clips'].items():
  n=math.ceil(duration*15)+1
  for variant in ['control','candidate']:
   actual='hit' if variant=='control' and clip=='evade' else clip
   pose(kind,form,variant,actual);scene,cam=setup(form,384);view(cam,form,'three-quarter');native=(bpy.data.actions[actual].frame_range[1]-1)/FPS
   destination=folder/variant/clip;destination.mkdir(parents=True,exist_ok=True)
   for old in destination.glob('*.png'):old.unlink()
   for i in range(n):
    t=min(duration,i/15);sample=t/duration*native;f=1+sample*FPS;scene.frame_set(int(f),subframe=f%1);scene.render.filepath=str(destination/f'{i:04d}.png');bpy.ops.render.render(write_still=True)
   records.append({'clip':clip,'variant':variant,'actualClip':actual,'nativeDuration':native,'displayDuration':duration,'frames':n,'fps':15,'sampleScope':'complete clip endpoints included; control uniformly time-normalized for geometric comparison','sourceSha256':digest(OUT/('candidate' if variant=='candidate' else 'inputs')/filename(kind,form,'blend'))})
  print('REVISION2_MOTION',kind,form,clip,n,flush=True)
 (OUT/f'{kind}-{form}-motion-samples.json').write_text(json.dumps(records,indent=2)+'\n')

def package(kind,form):
 folder=OUT/'qa'/kind/form;records=json.loads((OUT/f'{kind}-{form}-motion-samples.json').read_text());clips=[r for r in records if r['variant']=='candidate'];movies=[];evidence=[]
 def ff(args):subprocess.run(['ffmpeg','-v','error','-y','-filter_threads','1','-filter_complex_threads','1']+args,check=True)
 for row in clips:
  clip=row['clip'];control=folder/'motion/control'/clip;candidate=folder/'motion/candidate'/clip
  assert len(list(control.glob('*.png')))==row['frames']==len(list(candidate.glob('*.png')))
  movie=folder/f'{clip}-matched.mp4';sheet=folder/f'{clip}-all-frames.jpg'
  # The bundled FFmpeg has no drawtext filter. The labeled review index and
  # movie filenames identify each native clip without modifying captured frames.
  ff(['-framerate','15','-i',str(control/'%04d.png'),'-framerate','15','-i',str(candidate/'%04d.png'),'-filter_complex','hstack=inputs=2','-threads','1','-c:v','libx264','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',str(movie)])
  ff(['-i',str(movie),'-vf',f"scale=384:192,tile=4x{math.ceil(row['frames']/4)}:nb_frames={row['frames']}:padding=2:margin=2:color=0x25262a",'-frames:v','1','-q:v','3',str(sheet)])
  movies.append(movie);evidence.extend([movie,sheet])
 listing=folder/'all-clips.txt';listing.write_text(''.join("file '"+p.name+"'\n" for p in movies));combined=folder/'complete-matched-cycles.mp4';ff(['-f','concat','-safe','0','-i',str(listing),'-c','copy','-movflags','+faststart',str(combined)]);evidence.append(combined)
 review=folder/'index.html';review.write_text('<!doctype html><meta charset="utf-8"><title>'+kind+' '+form+' complete motion review</title><style>body{margin:28px auto;max-width:1000px;background:#202128;color:#eee;font:16px system-ui}video,img{width:100%;height:auto}section{margin:30px 0}a{color:#e9bc85}</style><h1>'+kind+' / '+form+'</h1><p>Left: immutable f600be2 control. Right: Revision2 candidate. Full endpoints at 15fps. Control clips are uniformly normalized to the candidate duration for geometry comparison; original timings remain in the sample record. The new evade uses baseline hit as an explicitly different control because f600be2 had no evade. These renders do not certify cinematic acceptance.</p><p><a href="complete-matched-cycles.mp4">Complete ordered cycles</a></p>'+''.join('<section><h2>'+p.stem.replace('-matched','')+'</h2><video controls preload="none" src="'+p.name+'"></video><a href="'+p.stem.replace('-matched','')+'-all-frames.jpg">Every sampled frame</a></section>' for p in movies));evidence.append(review)
 for name in ['front','side','three-quarter','face','material']:
  a,b=folder/f'control-{name}.png',folder/f'candidate-{name}.png'
  if a.exists() and b.exists():
   target=folder/f'{name}-comparison.png';ff(['-i',str(a),'-i',str(b),'-filter_complex','hstack=inputs=2','-frames:v','1',str(target)]);evidence.append(target)
 record={'recipeSha256':digest(Path(__file__)),'sourceSha256':digest(OUT/'candidate'/filename(kind,form,'blend')),'runtimeSha256':digest(OUT/'candidate'/filename(kind,form,'glb')),'files':{str(p.relative_to(ROOT)):digest(p) for p in evidence},'baselineEvadeNote':'f600be2 has no evade; the baseline hit pose is shown explicitly as a geometric control, not evidence of a prior evade animation.'}
 (OUT/f'{kind}-{form}-evidence.json').write_text(json.dumps(record,indent=2)+'\n');print('REVISION2_PACKAGE_OK',kind,form,flush=True)

def semantic(path):
 bpy.ops.wm.open_mainfile(filepath=str(path));rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');value={'meshes':{},'bones':{},'actions':{}}
 for ob in sorted(bpy.context.scene.objects,key=lambda o:o.name):
  if ob.type!='MESH':continue
  value['meshes'][ob.name]={'vertices':[tuple(v.co) for v in ob.data.vertices],'faces':[tuple(p.vertices) for p in ob.data.polygons],'weights':[sorted((ob.vertex_groups[g.group].name,g.weight) for g in v.groups) for v in ob.data.vertices],'materials':[m.name for m in ob.data.materials],'colors':{a.name:[tuple(v.color) for v in a.data] for a in ob.data.color_attributes},'uv':{a.name:[tuple(v.uv) for v in a.data] for a in ob.data.uv_layers},'morphs':{a.name:[tuple(v.co) for v in a.data] for a in ob.data.shape_keys.key_blocks} if ob.data.shape_keys else {}}
 value['bones']={b.name:{'parent':b.parent.name if b.parent else None,'head':tuple(b.head_local),'tail':tuple(b.tail_local),'matrix':[tuple(row) for row in b.matrix_local]} for b in rig.data.bones}
 value['actions']={a.name:[(f.data_path,f.array_index,[(tuple(k.co),k.interpolation) for k in f.keyframe_points]) for f in a.fcurves] for a in bpy.data.actions}
 return hashlib.sha256(json.dumps(value,sort_keys=True).encode()).hexdigest()

def reproduce():
 global OUT
 original=OUT;records={};frozen()
 with tempfile.TemporaryDirectory(prefix='animal-roster-v2-reproduce-') as folder:
  temporary=Path(folder);(temporary/'inputs').symlink_to(original/'inputs',target_is_directory=True);shutil.copy2(original/'baseline.json',temporary/'baseline.json');(temporary/'candidate').mkdir()
  for kind in ['lion','wolf','unicorn']:
   for form in ['race','upright']:
    OUT=temporary;build(kind,form);OUT=original
    name=filename(kind,form,'glb');expected=digest(original/'candidate'/name);actual=digest(temporary/'candidate'/name);assert actual==expected,(kind,form,'runtime reproduction changed',actual,expected)
    name=filename(kind,form,'blend');expected_source=semantic(original/'candidate'/name);actual_source=semantic(temporary/'candidate'/name);assert actual_source==expected_source,(kind,form,'editable source reconstruction changed')
    records[kind+'-'+form]={'runtimeSha256':actual,'sourceSemanticSha256':actual_source,'runtimeByteIdentical':True,'sourceSemanticallyIdentical':True}
 OUT=original;frozen()
 # Review/packaging-only recipe changes are recognized only after a real fresh
 # reconstruction proves the same runtime bytes and editable semantics.
 for key in records:
  path=OUT/(key+'-manifest.json');manifest=json.loads(path.read_text())
  if manifest['recipeSha256']!=digest(Path(__file__)):
   manifest['previousRecipeSha256']=manifest['recipeSha256'];manifest['recipeSha256']=digest(Path(__file__));manifest['recipeRefreshReason']='Fresh isolated reconstruction proved identical GLB bytes and editable source semantics after review-tool changes.';path.write_text(json.dumps(manifest,indent=2)+'\n')
 (OUT/'reproduction.json').write_text(json.dumps({'recipeSha256':digest(Path(__file__)),'baselineCommit':'f600be2','records':records,'scope':'Fresh isolated six-file recipe execution; byte-identical GLB and exact source mesh/topology/weights/colors/UV/morphs/rig/actions semantic comparison. Volatile Blender serialization metadata is not treated as deterministic.'},indent=2)+'\n');print('REVISION2_REPRODUCED',flush=True)

def promote():
 # Explicit local integration only; no web publication. Parent reviews actual
 # runtime style before invoking this, and production checks are repeated after.
 frozen();release={'version':'revision2','baselineCommit':'f600be2','recipe':'scripts/assets/rebuild_roster_v2.py','recipeSha256':digest(Path(__file__)),'quality':'Materially improved roster; full cinematic and owner acceptance remain open','files':{}}
 for kind in ['lion','wolf','unicorn']:
  for form in ['race','upright']:
   record=json.loads((OUT/f'{kind}-{form}-manifest.json').read_text());assert record['recipeSha256']==digest(Path(__file__))
   for ext,key,folder in [('blend','sourceSha256','assets/source/western'),('glb','runtimeSha256','public/assets/western')]:
    name=filename(kind,form,ext);source=OUT/'candidate'/name;assert digest(source)==record[key];target=ROOT/folder/name;shutil.copy2(source,target);release['files'][str(target.relative_to(ROOT))]=digest(target)
 (ROOT/'public/assets/western/roster-v2.json').write_text(json.dumps(release,indent=2)+'\n');(OUT/'canonical-integration.json').write_text(json.dumps(release,indent=2)+'\n');print('REVISION2_CANONICAL_INTEGRATED',flush=True)

def main():
 args=sys.argv[sys.argv.index('--')+1:];command=args[0];kinds=['lion','wolf','unicorn'] if len(args)<2 or args[1]=='all' else [args[1]];forms=['race','upright'] if len(args)<3 or args[2]=='all' else [args[2]]
 if command in ['reproduce','promote']:globals()[command]();return
 for kind in kinds:
  for form in forms:globals()[command](kind,form)
if __name__=='__main__':main()
