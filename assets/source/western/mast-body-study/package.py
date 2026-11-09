"""CPU-only evidence packaging; completed render frames are the inputs."""
from pathlib import Path
import subprocess,json,hashlib
P=Path(__file__).resolve().parent;Q=P/'qa';frames=sorted((Q/'probe-frames').glob('*.png'));assert len(frames)==37
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
(Q/'frame-hashes.json').write_text(json.dumps({'fps':15,'sampleSeconds':2.4,'frames':[{'frame':int(p.stem),'sha256':sha(p),'bytes':p.stat().st_size} for p in frames]},indent=2)+'\n')
subprocess.run(['ffmpeg','-v','error','-y','-threads','1','-filter_threads','1','-framerate','15','-i',str(Q/'probe-frames/%04d.png'),'-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart','-threads','1',str(Q/'native-probe.mp4')],check=True)
subprocess.run(['ffmpeg','-v','error','-y','-threads','1','-filter_threads','1','-i',str(Q/'native-probe.mp4'),'-vf','scale=192:192,tile=7x6:nb_frames=37:padding=2:margin=2:color=0x202128','-frames:v','1','-q:v','2','-threads','1',str(Q/'every-frame.jpg')],check=True)
print('MAST_NATIVE_PROBE_PACKAGED')
