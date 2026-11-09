"""Package full sampled source cycles into review movies and contact sheets (requires ffmpeg)."""
from pathlib import Path
import subprocess,tempfile,shutil,json,struct,hashlib,sys
ROOT=Path(__file__).resolve().parents[2]
def option(name,default):return next((a.split('=',1)[1] for a in sys.argv[1:] if a.startswith('--'+name+'=')),default)
QA=ROOT/option('qa-dir','assets/source/western/qa')
clips=option('clips','run,transform,fight_move,attack,special,guard,hit,jump,land,stumble,defeat,celebrate').split(',')
selected=any(a.startswith('--clips=') for a in sys.argv[1:])
for species in option('species','lion,wolf,unicorn').split(','):
 movie_name=species+('-selected-cycles.mp4' if selected else '-full-cycles.mp4')
 data=(ROOT/f'public/assets/western/{species}.glb').read_bytes();gltf=json.loads(data[20:20+struct.unpack_from('<I',data,12)[0]])
 durations={a['name']:max(gltf['accessors'][sample['input']]['max'][0] for sample in a['samplers']) for a in gltf['animations']}
 with tempfile.TemporaryDirectory(prefix='animal-motion-') as temp:
  temp=Path(temp);files=[];timeline=[];elapsed=0.
  for clip in clips:
   folder=QA/f'{species}-{clip}';end=round(durations[clip]*30)+1;expected=set(list(range(1,end+1,2))+[end]);frames=[p for p in sorted(folder.glob('*.png')) if int(p.stem) in expected]
   assert len(frames)==len(expected),(species,clip,'incomplete current-cycle render')
   clean=temp/(clip+'-frames');clean.mkdir()
   for frame in frames:shutil.copy2(frame,clean/frame.name)
   if not frames:raise RuntimeError('Missing rendered cycle '+str(folder))
   timeline.append({'clip':clip,'start':elapsed,'end':elapsed+len(frames)/15,'sourceFrames':[int(p.stem) for p in frames]});elapsed+=len(frames)/15
   output=temp/f'{clip}.mp4';files.append(output)
   subprocess.run(['ffmpeg','-v','error','-y','-filter_threads','1','-framerate','15','-pattern_type','glob','-i',str(clean/'*.png'),'-threads','1','-c:v','libx264','-crf','21','-pix_fmt','yuv420p',str(output)],check=True)
   if clip in ['run','transform','attack','special','celebrate']:
    tile='4x'+str((len(frames)+3)//4)
    subprocess.run(['ffmpeg','-v','error','-y','-filter_threads','1','-framerate','15','-pattern_type','glob','-i',str(clean/'*.png'),'-vf',f'scale=200:200,tile={tile}:padding=2:margin=2:color=0x201b1a','-frames:v','1',str(QA/f'{species}-{clip}-contact-sheet.png')],check=True)
  listing=temp/'list.txt';listing.write_text(''.join("file '"+str(p)+"'\n" for p in files))
  subprocess.run(['ffmpeg','-v','error','-y','-filter_threads','1','-f','concat','-safe','0','-i',str(listing),'-c','copy','-movflags','+faststart',str(QA/movie_name)],check=True)
 (QA/f'{species}-motion-index.json').write_text(json.dumps({'runtimeSha256':hashlib.sha256(data).hexdigest(),'sourceSha256':hashlib.sha256((ROOT/f'assets/source/western/{species}.blend').read_bytes()).hexdigest(),'reviewMovie':movie_name,'scope':'Source deformation inspection; studio Workbench shading, not gameplay','sampleRate':15,'timeline':timeline},indent=2)+'\n')
 print('MOTION_PACKAGED',species,flush=True)
