"""Inspect actual retained anatomy meshes and editable rig/source data, without mutation."""
import bpy,bmesh,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];records=[]
for species in ['lion','wolf','unicorn']:
 path=ROOT/f'assets/source/western/{species}.blend';bpy.ops.wm.open_mainfile(filepath=str(path));rig=bpy.data.objects['AnimalRig'];entry={'species':species,'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'runtimeSha256':hashlib.sha256((ROOT/f'public/assets/western/{species}.glb').read_bytes()).hexdigest(),'bones':len(rig.data.bones),'rigTracks':[t.name for t in rig.animation_data.nla_tracks],'anatomy':[]}
 for name in ['Body • continuous sculpted skin','Head • species sculpt']:
  ob=bpy.data.objects[name];bm=bmesh.new();bm.from_mesh(ob.data);bm.verts.ensure_lookup_table();seen=set();components=0
  for start in bm.verts:
   if start.index in seen:continue
   components+=1;stack=[start];seen.add(start.index)
   while stack:
    current=stack.pop()
    for edge in current.link_edges:
     neighbor=edge.other_vert(current)
     if neighbor.index not in seen:seen.add(neighbor.index);stack.append(neighbor)
  boundary=sum(e.is_boundary for e in bm.edges);nonmanifold=sum(not e.is_manifold for e in bm.edges)
  result={'mesh':name,'vertices':len(bm.verts),'faces':len(bm.faces),'connectedComponents':components,'boundaryEdges':boundary,'nonManifoldEdges':nonmanifold,'volume':bm.calc_volume(signed=True)};entry['anatomy'].append(result)
  assert components==1 and boundary==0 and nonmanifold==0,(species,result);bm.free()
 body=bpy.data.objects['Body • continuous sculpted skin'];assert body.data.shape_keys and 'Upright anatomical correction' in body.data.shape_keys.key_blocks
 assert 'Raised arms anatomical correction' in body.data.shape_keys.key_blocks
 entry['correctiveShapes']=[k.name for k in body.data.shape_keys.key_blocks if k.name!='Basis']
 entry['correctiveTracks']=[t.name for t in body.data.shape_keys.animation_data.nla_tracks];entry['packedImages']=[i.name for i in bpy.data.images if i.packed_file]
 assert entry['packedImages'] and len(entry['rigTracks'])==14 and len(entry['correctiveTracks'])==14
 entry['visualRepairStructure']={}
 if species=='lion':
  cap=bpy.data.objects.get('Closed sculpted rear mane cap');assert cap is not None
  bm=bmesh.new();bm.from_mesh(cap.data);boundary=sum(e.is_boundary for e in bm.edges);nonmanifold=sum(not e.is_manifold for e in bm.edges)
  assert boundary==0 and nonmanifold==0
  entry['visualRepairStructure']={'rearManeCapVertices':len(bm.verts),'rearManeCapBoundaryEdges':boundary,'rearManeCapNonManifoldEdges':nonmanifold,'rearLockCount':sum(o.name.startswith('Layered rear mane lock') for o in bpy.data.objects)};bm.free()
 elif species=='wolf':
  bridges=[o for o in bpy.data.objects if o.name.startswith(('Connected inner mouth sleeve','Connected outer cheek'))];assert len(bridges)==3
  for ob in bridges:
   assert {'head','jaw'}.issubset(set(g.name for g in ob.vertex_groups))
   for vertex in ob.data.vertices:assert abs(sum(g.weight for g in vertex.groups)-1.)<1e-5
  entry['visualRepairStructure']={'gradedHeadJawBridges':len(bridges),'bridgeVertices':sum(len(o.data.vertices) for o in bridges),'hasUpperPalate':bpy.data.objects.get('Upper palate') is not None,'hasMandibleFloor':bpy.data.objects.get('Mandible floor') is not None}
 records.append(entry)
(ROOT/'assets/source/western/qa/source-inspection.json').write_text(json.dumps(records,indent=2)+'\n')
print('EDITABLE_SOURCE_OK')
