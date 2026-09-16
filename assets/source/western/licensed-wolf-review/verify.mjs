import fs from 'node:fs/promises';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
const root=new URL('../../../../',import.meta.url),out=new URL('assets/source/western/licensed-wolf-review/',root),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=async p=>JSON.parse(await fs.readFile(new URL(p,out),'utf8')),p=await read('provenance.json'),mode=process.argv[2];
for(const [f,h] of Object.entries(p.sourceFiles))assert.equal(sha(await fs.readFile(new URL(f,out))),h,f);
for(const [f,h] of Object.entries(p.canonicalFreeze))assert.equal(sha(await fs.readFile(new URL(f,root))),h,f);
assert.equal(p.licenseAsListed,'CC0');assert.equal(p.author,'NewDLC');assert.equal(p.primaryUrl,'https://opengameart.org/content/3d-wolf');assert.equal(p.downloadUrl,'https://opengameart.org/sites/default/files/3dwolf_blend.zip');
const html=await fs.readFile(new URL('source-page.html',out));assert.equal(sha(html),p.primaryPageHtmlSha256);assert(html.toString().includes('CC0')&&html.toString().includes('NewDLC'));
assert.equal(Object.keys(p.canonicalFreeze).length,12);
execFileSync('python3',['-c',`import zipfile,pathlib,json,sys
p=pathlib.Path(sys.argv[1]);r=json.loads((p/'provenance.json').read_text())
with zipfile.ZipFile(p/'3dwolf_blend.zip') as z:
 assert z.testzip() is None
 assert set(z.namelist())==set(r['sourceArchiveMembers'].values())
 for local,member in r['sourceArchiveMembers'].items():
  assert not pathlib.PurePosixPath(member).is_absolute() and '..' not in pathlib.PurePosixPath(member).parts
  assert (p/'source'/local).read_bytes()==z.read(member)
`,out.pathname],{encoding:'utf8'});
const modified=Buffer.from(await fs.readFile(new URL('source/dog2.blend',out)));modified[0]^=1;assert.notEqual(sha(modified),p.sourceFiles['source/dog2.blend'],'Hash corruption negative must reject');
if(mode==='provenance'){console.log('LICENSED_WOLF_PROVENANCE_OK — publisher CC0 declaration, source/canonical hashes, corruption negative.');}
else if(mode==='structure'){
 const r=await read('inspection.json');assert.equal(r.sourceSha256,p.sourceFiles['source/dog2.blend']);const recipe=await fs.readFile(new URL('inspection-recipe.py',out));assert.equal(r.recipeSha256,sha(recipe));assert(r.autoExecutionDisabled);assert.equal(r.embeddedTextNames.length,0);assert.equal(r.driversMuted.length,0);assert.equal(r.linkedLibraries.length,0);
 assert(r.meshes.length>0&&r.armatures.length>0);assert.equal(r.budget.sourceTriangles,r.meshes.reduce((n,m)=>n+m.triangles,0));assert.equal(r.budget.materialSlots,r.meshes.reduce((n,m)=>n+m.materials.length,0));assert.equal(r.actions.length,0);
 for(const m of r.meshes){assert.equal(m.components.reduce((a,b)=>a+b,0),m.vertices);assert(m.uvLayers.length>0);assert(Number.isFinite(m.maxWeightSumError));assert.equal(m.unweightedVertices.length,0);assert.equal(m.verticesOver4Influences,0);}
 for(const t of r.textures){const b=await fs.readFile(new URL('source/'+t.file,out));assert.equal(sha(b),t.sha256);assert.equal(b.readUInt32BE(16),t.width);assert.equal(b.readUInt32BE(20),t.height);assert.equal(b.length,t.bytes);}
 console.log('LICENSED_WOLF_STRUCTURE_RECORDED — topology, rig, weights, maps, no source actions; no phone performance certification.');
}else if(mode==='evidence'){
 const e=await read('evidence.json'),r=await read('probe-report.json');assert.equal(r.sourceSha256,p.sourceFiles['source/dog2.blend']);assert.equal(r.recipeSha256,sha(await fs.readFile(new URL('scripts/assets/review_licensed_wolf.py',root))));assert.equal(r.probeIsAuthoredGameAnimation,false);assert.equal(r.suppliedActions,0);assert.equal(r.frames,r.samples.length);assert.equal(r.frames,37);assert.equal(r.probeDurationSeconds,2.4);assert.equal(e.sourceSha256,r.sourceSha256);
 const inspected=await read('inspection.json'),names=new Set(inspected.armatures.flatMap(a=>a.bones.map(b=>b.name)));for(const phase of r.phases)for(const [bone]of phase.rotations)assert(names.has(bone));
 for(const [i,s]of r.samples.entries()){assert.equal(s.frame,i);assert.equal(s.time,i/15);assert(s.bounds.min.every(Number.isFinite)&&s.bounds.max.every(Number.isFinite));for(const k of ['edgeStretchMin','edgeStretchMax','edgeStretchP99'])assert(Number.isFinite(s[k])&&s[k]>0);assert(s.edgeStretchMax>=s.edgeStretchP99);assert.equal(r.phases.some(p=>p.name===s.phase),true);}
 for(const axis of [0,1,2])for(const side of ['min','max'])assert(Math.abs(r.samples[0].bounds[side][axis]-r.samples[36].bounds[side][axis])<1e-5,'probe returns to rest');
 const frames=await read('qa/source-frame-hashes.json');assert.equal(frames.sourceSha256,r.sourceSha256);assert.equal(frames.frames.length,37);for(const [i,f]of frames.frames.entries()){assert.equal(f.frame,i);assert(/^[a-f0-9]{64}$/.test(f.sha256));assert(f.bytes>0);}
 for(const n of [0,6,18,30,36])assert.equal(sha(await fs.readFile(new URL('qa/probe-keyframes/'+String(n).padStart(4,'0')+'.png',out))),frames.frames[n].sha256);
 assert.equal(e.recipeSha256,r.recipeSha256);assert.equal(e.decision,'REWORK_ONLY_REFERENCE_REJECT_DIRECT_ADOPTION');assert.equal(e.renderCompletion.initialMetalExit,143);assert.equal(e.renderCompletion.resumedCpuWorkbenchExit,0);
 for(const [path,h]of Object.entries(e.files))assert.equal(sha(await fs.readFile(new URL(path,out))),h,path);
 const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=nb_read_frames,width,height,duration','-of','json',new URL('qa/deliberate-fk-probe.mp4',out).pathname],{encoding:'utf8'})).streams[0];assert.equal(Number(probe.nb_read_frames),37);assert(Number(probe.duration)>=2&&Number(probe.duration)<=3);assert.equal(probe.width,384);assert.equal(probe.height,384);
 for(const view of r.views){const b=await fs.readFile(new URL('qa/rest-'+view+'.png',out));assert.equal(b.readUInt32BE(16),512);assert.equal(b.readUInt32BE(20),512);}
 console.log('LICENSED_WOLF_EVIDENCE_OK — three rest views, all 37 deliberate FK samples, 2–3 s video, complete-frame sheet and immutable source.');
}else throw Error('Use provenance, structure or evidence');
