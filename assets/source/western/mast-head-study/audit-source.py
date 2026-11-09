"""Read final editable study sources with automatic execution disabled; no rendering."""
import bpy,runpy,json,hashlib
from pathlib import Path
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[3]
ns=runpy.run_path(str(ROOT/'scripts/assets/study_mast_head.py'),run_name='mast_source_audit')
sha=ns['sha'];safe=ns['safe_load'];result={'authoringRecipeSha256':sha(ROOT/'scripts/assets/study_mast_head.py'),'forms':[]}
def actions():
 value={a.name:[(f.data_path,f.array_index,[(tuple(k.co),k.interpolation) for k in f.keyframe_points]) for f in a.fcurves] for a in bpy.data.actions if a.name!='Mast head probe'}
 return hashlib.sha256(json.dumps(value,sort_keys=True).encode()).hexdigest()
for form in ['race','upright']:
 safe(OUT/'candidate'/f'lion-{form}.blend');game=ns['set_game_idle'](form);face=bpy.data.objects['Mast isolated facial rig'];body=bpy.data.objects['Body • continuous sculpted skin' if form=='race' else 'Upright body • connected joint topology'];report=json.loads((OUT/f'{form}-fit.json').read_text());assert ns['body_signature'](body)==report['bodySignatureBefore'];assert actions()==report['actionSignatureBefore'];assert len(bpy.data.texts)==0;assert len(bpy.data.libraries)==0
 item={'form':form,'sourceSha256':sha(OUT/'candidate'/f'lion-{form}.blend'),'bodyGeometryWeightsMorphsSha256':ns['body_signature'](body),'originalActionsSha256':actions(),'sourceProbeAction':{'name':'Mast head probe','range':list(bpy.data.actions['Mast head probe'].frame_range),'curves':len(bpy.data.actions['Mast head probe'].fcurves)},'facialBones':len(face.data.bones),'gameBones':len(game.data.bones),'meshes':[],'embeddedTexts':0,'linkedLibraries':0,'faceConstraints':sum(len(b.constraints) for b in face.pose.bones)}
 for ob in [bpy.data.objects['Mast authored head and oral anatomy'],bpy.data.objects['Mast oral and eye details']]:
  counts=[];sums=[]
  for v in ob.data.vertices:
   w=[g.weight for g in v.groups if ob.vertex_groups[g.group].name in face.data.bones and g.weight>1e-7];counts.append(len(w));sums.append(sum(w))
  assert min(counts)>0;assert max(abs(s-1) for s in sums)<1e-5
  item['meshes'].append({'name':ob.name,**ns['topology'](ob.data),'maxInfluences':max(counts),'influenceHistogram':{str(n):counts.count(n) for n in sorted(set(counts))},'weightSumErrorMax':max(abs(s-1) for s in sums),'materialSlots':len(ob.data.materials)})
 result['forms'].append(item)
ns['frozen']();(OUT/'final-source-audit.json').write_text(json.dumps(result,indent=2)+'\n');print('MAST_FINAL_EDITABLE_SOURCE_AUDIT_OK',flush=True)
