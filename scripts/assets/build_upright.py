"""Canonical Cycle6 upright recipe; original Cycle5 recipe is preserved in contact-v2/inputs.
Blender --background --python scripts/assets/build_upright.py -- build [all|lion|wolf|unicorn]
Blender --background --python scripts/assets/build_upright.py -- reproduce
No rendering. Reproduce writes temporary fresh outputs and a current verification receipt.
"""
import bpy,json,hashlib,sys,tempfile,shutil
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import experiment_contact as recipe
ROOT=Path(__file__).resolve().parents[2];SOURCE=ROOT/'assets/source/western';PUBLIC=ROOT/'public/assets/western';OUT=SOURCE/'upright-v2';FPS=30
KINDS=['lion','wolf','unicorn'];REVIEWED=SOURCE/'contact-v2/v2b';OUT.mkdir(exist_ok=True)
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def semantic(path):
 bpy.ops.wm.open_mainfile(filepath=str(path))
 meshes={}
 for ob in sorted(bpy.context.scene.objects,key=lambda o:o.name):
  if ob.type!='MESH':continue
  meshes[ob.name]={'vertices':[tuple(v.co) for v in ob.data.vertices],'faces':[tuple(p.vertices) for p in ob.data.polygons],'weights':[sorted((ob.vertex_groups[g.group].name,g.weight) for g in v.groups) for v in ob.data.vertices],'materials':[m.name for m in ob.data.materials],'uv':{layer.name:[tuple(v.uv) for v in layer.data] for layer in ob.data.uv_layers},'colors':{layer.name:[tuple(v.color) for v in layer.data] for layer in ob.data.color_attributes},'modifiers':[(m.name,m.type,m.object.name if m.type=='ARMATURE' and m.object else None) for m in ob.modifiers]}
 rig=bpy.data.objects['UprightRig'];cage=bpy.data.meshes[rig['control_topology_mesh']]
 result={'meshes':meshes,'bones':{b.name:{'parent':b.parent.name if b.parent else None,'head':tuple(b.head_local),'tail':tuple(b.tail_local),'matrix':[tuple(row) for row in b.matrix_local]} for b in rig.data.bones},'actions':{a.name:[(f.data_path,f.array_index,[(tuple(k.co),k.interpolation) for k in f.keyframe_points]) for f in a.fcurves] for a in bpy.data.actions},'controlCage':{'vertices':[tuple(v.co) for v in cage.vertices],'faces':[tuple(p.vertices) for p in cage.polygons]}}
 return hashlib.sha256(json.dumps(result,sort_keys=True).encode()).hexdigest()
def build(kind,source=SOURCE,public=PUBLIC,out=OUT):
 ns=recipe.authoring();ns['ATTACHMENT_CONTROLS']=recipe.attachment_controls(kind);ns['repair_attachments']=recipe.repair_attachments
 for folder in [source,public,out/'inputs']:folder.mkdir(parents=True,exist_ok=True)
 control=out/'inputs'/f'{kind}.blend'
 if not control.exists():shutil.copy2(recipe.BASE/'inputs'/f'{kind}.blend',control)
 ns.update(SOURCE=source,PUBLIC=public,OUT=out);ns['build'](kind)
 path=out/f'{kind}-manifest.json';record=json.loads(path.read_text());approved=json.loads((REVIEWED/f'{kind}-manifest.json').read_text())
 if source.resolve()==SOURCE.resolve() and public.resolve()==PUBLIC.resolve():
  # Blender saves embed volatile serialization state. Validate a real fresh
  # reconstruction first, then retain the reviewed binary source as canonical.
  # A changed recipe cannot silently become production via this normalization.
  assert record['runtimeSha256']==approved['runtimeSha256'],(kind,'Unreviewed runtime reconstruction')
  assert semantic(source/f'{kind}-upright.blend')==semantic(REVIEWED/'candidate'/f'{kind}-upright.blend'),(kind,'Unreviewed editable source reconstruction')
  shutil.copy2(REVIEWED/'candidate'/f'{kind}-upright.blend',source/f'{kind}-upright.blend');record['sourceSha256']=approved['sourceSha256']
 record.update({'status':'Canonical Cycle6 upright contact anatomy; cinematic A2 open','approvedSourceSha256':approved['sourceSha256'],'approvedRuntimeSha256':approved['runtimeSha256'],'recipe':approved['recipe'],'headSetbackMetres':.30,'normalStrikeLeanRadians':.10,'qaDirectory':'assets/source/western/contact-v2/v2b/qa/'+kind})
 path.write_text(json.dumps(record,indent=2)+'\n');recipe.frozen();return record

def reproduce():
 results={};recipe.frozen()
 with tempfile.TemporaryDirectory(prefix='upright-canonical-repro-') as folder:
  temp=Path(folder)
  for kind in KINDS:
   record=build(kind,temp/'sources',temp/'runtime',temp/'manifests');approved=json.loads((REVIEWED/f'{kind}-manifest.json').read_text())
   assert record['runtimeSha256']==approved['runtimeSha256'],(kind,'Runtime is not byte identical',record['runtimeSha256'],approved['runtimeSha256'])
   expected=semantic(REVIEWED/'candidate'/f'{kind}-upright.blend');actual=semantic(temp/'sources'/f'{kind}-upright.blend');canonical=semantic(SOURCE/f'{kind}-upright.blend')
   assert actual==expected==canonical,(kind,'Editable source changed',actual,expected,canonical)
   results[kind]={'reviewedSourceSha256':approved['sourceSha256'],'canonicalSourceSha256':digest(SOURCE/f'{kind}-upright.blend'),'reconstructedSourceSha256':record['sourceSha256'],'runtimeSha256':record['runtimeSha256'],'sourceSemanticSha256':actual,'runtimeByteIdentical':True,'sourceSemanticallyIdentical':True}
 recipe.frozen();scripts=['build_upright.py','experiment_contact.py','experiment_upright.py']
 result={'scope':'Independent fresh construction from frozen race inputs. Runtime exact bytes; editable source meshes/topology/weights/UV/colors/material slots/control cage/rest rig/actions exact semantic comparison. Blender binary serialization itself is not required to be deterministic. No render or production mutation.','recipes':{str(Path('scripts/assets')/name):digest(ROOT/'scripts/assets'/name) for name in scripts},'species':results}
 (OUT/'reproduction.json').write_text(json.dumps(result,indent=2)+'\n');print('UPRIGHT_CANONICAL_REPRODUCED',flush=True)
if __name__=='__main__':
 args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['build','all']
 if args[0]=='reproduce':reproduce()
 elif args[0]=='build':
  for kind in KINDS if len(args)<2 or args[1]=='all' else [args[1]]:build(kind)
 else:raise ValueError(args)
