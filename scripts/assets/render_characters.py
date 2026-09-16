"""Render source deformation evidence with actual actions (not posed marketing replacements)."""
import bpy,sys,math,json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['lion'];kind=args[0];motion='motion' in args
clip_arg=next((a.split('=',1)[1] for a in args if a.startswith('--clips=')),None)
clip_filter=set(clip_arg.split(',')) if clip_arg else None
output_arg=next((a.split('=',1)[1] for a in args if a.startswith('--output=')),'assets/source/western/qa')
OUT=ROOT/output_arg;OUT.mkdir(parents=True,exist_ok=True);front_only='--front-only' in args
bpy.ops.wm.open_mainfile(filepath=str(ROOT/f'assets/source/western/{kind}.blend'))
if clip_filter:
 unknown=clip_filter-set(a.name for a in bpy.data.actions)
 if unknown:raise ValueError('Unknown requested review clips: '+str(unknown))
rig=bpy.data.objects['AnimalRig'];scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True
prefs=bpy.context.preferences.addons['cycles'].preferences
try:
 prefs.compute_device_type='METAL';prefs.get_devices()
 for device in prefs.devices:device.use=device.type=='METAL'
 scene.cycles.device='GPU'
except Exception:pass
scene.render.resolution_x=700;scene.render.resolution_y=700;scene.render.resolution_percentage=100
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.17,.19,.24,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
# Neutral dust-colored cyclorama and long evening key show anatomy clearly.
mat=bpy.data.materials.new('QA dust stage');mat.diffuse_color=(.17,.105,.06,1)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.02));bpy.context.object.data.materials.append(mat)
for name,loc,energy,color,size in [('Sunset key',(-3,-4,6),650,(1,.71,.43),4),('Sky fill',(3,-1,4),470,(.5,.68,1),5),('Warm rim',(0,4,4),1000,(1,.52,.27),3)]:
 data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.color=color;data.shape='DISK';data.size=size;ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector((0,0,1))-ob.location).to_track_quat('-Z','Y').to_euler()
data=bpy.data.cameras.new('QA camera');cam=bpy.data.objects.new('QA camera',data);scene.collection.objects.link(cam);scene.camera=cam;data.type='ORTHO';data.ortho_scale=3.8
cam.location=(3.5,-5.2,2.9);cam.rotation_euler=(Vector((0,-.15,1.15))-cam.location).to_track_quat('-Z','Y').to_euler()
for track in rig.animation_data.nla_tracks:track.mute=True
keys=bpy.data.objects['Body • continuous sculpted skin'].data.shape_keys
for track in keys.animation_data.nla_tracks:track.mute=True
poses=[('race_idle',1),('fight_idle',1),('attack',7),('attack',13),('special',{'lion':11,'wolf':14,'unicorn':13}[kind]),('transform',19),('defeat',40),('celebrate',16)]
if motion:
 scene.render.resolution_x=400;scene.render.resolution_y=400;scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.light='STUDIO';scene.display.shading.studio_light='paint.sl';scene.display.shading.color_type='MATERIAL';scene.display.shading.show_shadows=True;scene.display.shading.show_cavity=True;scene.display.shading.cavity_type='BOTH'
 for clip in ['run','transform','fight_move','attack','special','guard','hit','jump','land','stumble','defeat','celebrate']:
  if clip_filter and clip not in clip_filter:continue
  action=bpy.data.actions[clip];rig.animation_data.action=action;keys.animation_data.action=bpy.data.actions[clip+'_corrective']
  frames=int(action.frame_range[1]);folder=OUT/f'{kind}-{clip}';folder.mkdir(exist_ok=True)
  for old in folder.glob('*.png'):old.unlink()
  for f in sorted(set(list(range(1,frames+1,2))+[frames])):
   scene.frame_set(f);scene.render.filepath=str(OUT/f'{kind}-{clip}/{f:04}.png');bpy.ops.render.render(write_still=True)
else:
 for clip,frame in poses:
  if clip_filter and clip not in clip_filter:continue
  rig.animation_data.action=bpy.data.actions[clip];keys.animation_data.action=bpy.data.actions[clip+'_corrective'];scene.frame_set(frame);scene.render.filepath=str(OUT/f'{kind}-{clip}-{frame:02}.png');bpy.ops.render.render(write_still=True)
 if not front_only:
  for label,clip,location in [('race-rear','race_idle',(3.5,5.2,2.9)),('fight-side','fight_idle',(5.5,0,2.3))]:
   if clip_filter and clip not in clip_filter:continue
   cam.location=location;cam.rotation_euler=(Vector((0,0,1.15))-cam.location).to_track_quat('-Z','Y').to_euler();rig.animation_data.action=bpy.data.actions[clip];keys.animation_data.action=bpy.data.actions[clip+'_corrective'];scene.frame_set(1);scene.render.filepath=str(OUT/f'{kind}-{label}.png');bpy.ops.render.render(write_still=True)
print('RENDERED',kind)
