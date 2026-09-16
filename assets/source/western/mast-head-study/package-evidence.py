"""CPU-only packaging of completed review frames; never renders or edits source meshes."""
import subprocess,json,hashlib
from pathlib import Path
OUT=Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for form in ['race','upright']:
 frames=OUT/'qa'/f'{form}-probe-frames';sources=sorted(frames.glob('*.png'));assert len(sources)==31
 movie=OUT/'qa'/f'{form}-probe.mp4'
 subprocess.run(['ffmpeg','-v','error','-y','-filter_threads','1','-framerate','15','-i',str(frames/'%04d.png'),'-threads','1','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(movie)],check=True)
 subprocess.run(['ffmpeg','-v','error','-y','-threads','1','-filter_threads','1','-i',str(movie),'-vf','scale=192:192,tile=6x6:nb_frames=31:padding=2:margin=2:color=0x202128','-frames:v','1','-q:v','2','-threads','1',str(OUT/'qa'/f'{form}-every-frame.jpg')],check=True)
 manifest={'frameRate':15,'sampleTimelineSeconds':2,'frames':[{'frame':int(p.stem),'sha256':sha(p),'bytes':p.stat().st_size} for p in sources]};(OUT/'qa'/f'{form}-frame-hashes.json').write_text(json.dumps(manifest,indent=2)+'\n')
ordered=[OUT/'qa'/f'{form}-{variant}-{view}.png' for form in ['race','upright'] for variant in ['control','candidate'] for view in ['front','side','three-quarter','body']]
seq=OUT/'qa/matched-inputs.txt';seq.write_text(''.join("file '"+str(f)+"'\n" for f in ordered))
subprocess.run(['ffmpeg','-v','error','-y','-threads','1','-filter_threads','1','-f','concat','-safe','0','-i',str(seq),'-vf','scale=256:256,tile=4x4:nb_frames=16:padding=2:margin=2:color=0x202128','-frames:v','1','-q:v','2','-threads','1',str(OUT/'qa/matched-complete.jpg')],check=True);seq.unlink()
print('MAST_CPU_EVIDENCE_PACKAGED')
