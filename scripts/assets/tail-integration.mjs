/** Exact-byte promotion and isolated replay of the frozen tail-repair recipe. */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const rel='assets/source/western/revision2/',study=rel+'tail-repair/',integration=rel+'tail-integration/';
const at=p=>path.join(root,p),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const bytes=p=>fs.readFile(at(p)),read=async p=>JSON.parse(await bytes(p));
const sha=async p=>hash(await bytes(p)),write=async(p,v)=>fs.writeFile(at(p),JSON.stringify(v,null,2)+'\n');
const preserved=await read(integration+'preserved.json');
async function history(){for(const [p,h] of Object.entries(preserved.files))assert.equal(await sha(p),h,`Preserved historical/unrelated file: ${p}`);}
async function verifiedRelease(){
 await history();const release=await read('public/assets/western/roster-v2.json'),receipt=await read(integration+'promotion.json');
 assert.deepEqual(receipt.release,release);assert.equal(receipt.releaseSha256,await sha('public/assets/western/roster-v2.json'));
 assert.equal(receipt.preservedManifestSha256,await sha(integration+'preserved.json'));
 assert.equal(release.version,'revision2-tail-repair-1');assert.equal(Object.keys(release.files).length,12);
 for(const [p,h] of Object.entries(release.files)){assert.equal(await sha(p),h,`Canonical ${p}`);assert.equal(await sha(study+'candidate/'+path.basename(p)),h,`Approved candidate ${p}`);}
 for(const ref of [release.repair.previousReceipt,release.repair.manifest,release.repair.review])assert.equal(await sha(ref.path),ref.sha256);
 assert.equal(await sha(release.repair.recipe),release.repair.recipeSha256);
 const previous=await read(release.repair.previousReceipt.path),manifest=await read(release.repair.manifest.path),freeze=await read(study+'freeze.json');
 for(const [p,h] of Object.entries(previous.files)){assert.equal(await sha(study+'inputs/'+path.basename(p)),h);assert.equal(freeze.files[p],h);}
 for(const [key,row] of Object.entries(manifest.records)){
  const name=key.replace('-race','');assert.equal(release.files[`public/assets/western/${name}.glb`],row.runtimeSha256);assert.equal(release.files[`assets/source/western/${name}.blend`],row.sourceSha256);
 }
 return release;
}
async function promote(){
 await history();assert(!(await fs.stat(at(integration+'promotion.json')).then(()=>true,()=>false)),'Promotion already recorded');
 const initial=await read(rel+'canonical-integration.json'),manifest=await read(study+'manifest.json');
 for(const [p,h] of Object.entries(initial.files))assert.equal(await sha(p),h,`Expected original canonical ${p}`);
 const ref=async p=>({path:p,sha256:await sha(p)});
 const release={...initial,version:'revision2-tail-repair-1',quality:'Bounded tail attachment and evade repair approved; integrated gameplay, cinematic and owner acceptance remain separate',repair:{recipe:'scripts/assets/repair_tails.py',recipeSha256:await sha('scripts/assets/repair_tails.py'),inputCommit:'54ecd6e',previousReceipt:await ref(rel+'canonical-integration.json'),manifest:await ref(study+'manifest.json'),review:await ref('docs/production/evidence/revision2-tail-runtime/2026-09-20T03-50-31-404Z/parent-review.json')},promotionReceipt:integration+'promotion.json',files:{}};
 assert.equal(release.repair.recipeSha256,manifest.recipeSha256);
 for(const [key,row] of Object.entries(manifest.records)){
  const name=key.replace('-race','');
  for(const [ext,folder,field] of [['glb','public/assets/western','runtimeSha256'],['blend','assets/source/western','sourceSha256']]){
   const from=study+`candidate/${name}.${ext}`,to=`${folder}/${name}.${ext}`;assert.equal(await sha(from),row[field]);await fs.copyFile(at(from),at(to));release.files[to]=await sha(to);
  }
 }
 await write('public/assets/western/roster-v2.json',release);
 await write(integration+'promotion.json',{release,releaseSha256:await sha('public/assets/western/roster-v2.json'),preservedManifestSha256:await sha(integration+'preserved.json')});
 await verifiedRelease();console.log('TAIL_CANONICAL_PROMOTED');
}
async function reproduce(){
 const release=await verifiedRelease(),scratch=await fs.mkdtemp(path.join(os.tmpdir(),'animal-tail-history-'));
 const steps=[];
 try{
  await fs.cp(at(study),path.join(scratch,study),{recursive:true});
  const freeze=await read(study+'freeze.json');
  for(const [p,h] of Object.entries(freeze.files)){
   let content;
   const original=path.join(study,'inputs',path.basename(p));
   if(p.endsWith('.blend')||p.endsWith('.glb'))content=await bytes(original);
   else if(p==='public/assets/western/roster-v2.json')content=await bytes(rel+'canonical-integration.json');
   else {content=await bytes(p);if(hash(content)!==h)content=execFileSync('git',['show',`54ecd6e:${p}`],{cwd:root,maxBuffer:32*1024*1024});}
   assert.equal(hash(content),h,`Original frozen scratch input ${p}`);await fs.mkdir(path.dirname(path.join(scratch,p)),{recursive:true});await fs.writeFile(path.join(scratch,p),content);
  }
  for(const p of ['scripts/assets/repair_tails.py','scripts/assets/rebuild_roster_v2.py','scripts/assets/experiment_upright.py','scripts/assets/verify-tail-repair.mjs','assets/source/western/contact-v2/inputs/build_upright.py']){
   await fs.mkdir(path.dirname(path.join(scratch,p)),{recursive:true});await fs.copyFile(at(p),path.join(scratch,p));
  }
  await fs.symlink(at('node_modules'),path.join(scratch,'node_modules'),'dir');
  const blender=process.env.ANIMAL_RACERS_BLENDER??'/Users/chikumatsuboi/Applications/Blender-4.5.9.app/Contents/MacOS/Blender';
  const commands=[['freeze',process.execPath,['scripts/assets/verify-tail-repair.mjs','--freeze']],...['reproduce','verify'].map(mode=>[mode,blender,['--background','--factory-startup','--disable-autoexec','--python-exit-code','1','-t','2','--python','scripts/assets/repair_tails.py','--',mode]]),['evidence',process.execPath,['scripts/assets/verify-tail-repair.mjs','--evidence','--negative-control']]];
  const expected={freeze:'TAIL_INPUTS_FROZEN',reproduce:'TAIL_REPAIR_REPRODUCED',verify:'TAIL_SOURCE_GEOMETRY_OK',evidence:'TAIL_REPAIR_EVIDENCE_AND_NEGATIVE_OK'};
  for(const [name,command,args] of commands){
   const result=spawnSync(command,args,{cwd:scratch,encoding:'utf8',timeout:600000,maxBuffer:32*1024*1024}),output=(result.stdout??'')+(result.stderr??'');
   await fs.writeFile(at(integration+`historical-${name}.log`),output);assert.equal(result.status,0,`${name}: ${output.slice(-3000)}`);assert(output.includes(expected[name]),`${name}: missing success token`);
   steps.push({name,exit:result.status,outputSha256:hash(output),successToken:expected[name]});console.log(`Historical ${name}: passed`);
  }
  for(const name of ['reproduction.json','source-verification.json','runtime-verification.json'])await fs.copyFile(path.join(scratch,study,name),at(integration+'historical-'+name));
  const reproduction=await read(integration+'historical-reproduction.json');
  for(const [key,row] of Object.entries(reproduction.records)){assert(row.runtimeByteIdentical&&row.sourceSemanticallyIdentical);assert.equal(row.runtimeSha256,release.files[`public/assets/western/${key.replace('-race','')}.glb`]);}
  await write(integration+'reproduction.json',{wrapperSha256:await sha('scripts/assets/tail-integration.mjs'),recipeSha256:release.repair.recipeSha256,releaseSha256:await sha('public/assets/western/roster-v2.json'),scope:'Unchanged historical recipe and oracles in an isolated scratch root populated with verified original bytes; production is never rewritten',steps,records:reproduction.records});
 }finally{await fs.rm(scratch,{recursive:true,force:true});}
 await verifiedRelease();console.log('TAIL_CANONICAL_REPRODUCED');
}
const command=process.argv[2];
if(command==='promote')await promote();
else if(command==='verify'){await verifiedRelease();console.log('TAIL_CANONICAL_PROVENANCE_OK');}
else if(command==='reproduce')await reproduce();
else throw Error('Use promote, verify or reproduce');
