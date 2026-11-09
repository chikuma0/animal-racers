/** Local renderer pose inspection only. This is never normal-gameplay evidence. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {chromium} from '@playwright/test';
const directory=resolve('docs/production/evidence/revision2-tail-runtime',new Date().toISOString().replace(/[:.]/g,'-'));
await mkdir(directory,{recursive:true});
const handoff=JSON.parse(await readFile('assets/source/western/revision2/tail-repair/handoff.json','utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
for(const [key,row] of Object.entries(handoff.records)) {
 const [kind,form]=key.split('-'); const base=kind+(form==='upright'?'-upright':'');
 assert.equal(hash(await readFile(`assets/source/western/revision2/tail-repair/candidate/${base}.glb`)),row.runtimeSha256);
}
const browser=await chromium.launch({channel:'chrome',headless:false});
const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
const errors=[],records=[];page.on('pageerror',e=>errors.push(String(e)));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function pose(species,action,time,counter=false,stage='fight') {
 await page.locator('#left').selectOption(species);await page.locator('#right').selectOption({lion:'wolf',wolf:'unicorn',unicorn:'lion'}[species]);
 await page.locator('#stage').selectOption(stage);await page.locator('#action').selectOption(action);await page.locator('#rival').selectOption('fight_idle');
 await page.locator('#counter').setChecked(counter);await page.locator('#displace').check();await page.locator('#gap').fill('1.85');await page.locator('#elapsed').fill(String(time));
 await page.locator('#apply').click();await wait(400);
}
async function still(name){
 await page.locator('#save').click();await page.waitForFunction(()=>document.querySelector('#status').value.startsWith('Saved '));
 const nameOnDisk=(await page.locator('#status').textContent()).replace('Saved ','').trim();
 const receipt=JSON.parse(await readFile('docs/production/evidence/contact-inspection/'+nameOnDisk+'.json','utf8'));
 await page.screenshot({path:resolve(directory,name+'.png')});records.push({kind:'pose-still',name,receipt:'docs/production/evidence/contact-inspection/'+nameOnDisk+'.json',settings:receipt.settings,hashes:receipt.hashes});
}
async function cycle(name,duration){
 // MediaRecorder observes the public canvas only; it does not inspect game state.
 await page.evaluate(()=>{const canvas=document.querySelector('canvas'),stream=canvas.captureStream(30),chunks=[];const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:2500000});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};globalThis.poseCapture={stream,chunks,recorder};recorder.start();});
 await page.locator('#play').click();await wait(duration*1000+200);
 const url=await page.evaluate(()=>new Promise(resolve=>{const {stream,chunks,recorder}=globalThis.poseCapture;recorder.onstop=()=>{stream.getTracks().forEach(t=>t.stop());const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(new Blob(chunks,{type:'video/webm'}));delete globalThis.poseCapture;};recorder.stop();}));
 const bytes=Buffer.from(url.split(',')[1],'base64');await writeFile(resolve(directory,name+'.webm'),bytes,{flag:'wx'});records.push({kind:'pose-cycle',file:name+'.webm',sha256:hash(bytes),requestedSeconds:duration});
}
try {
 await page.goto('http://localhost:3015');await page.waitForFunction(()=>document.querySelector('#status').value.startsWith('Ready'),{timeout:30000});
 for(const kind of ['lion','wolf','unicorn']) {
  const wind={lion:.68,wolf:.55,unicorn:.60}[kind],active={lion:.14,wolf:.12,unicorn:.14}[kind],recovery={lion:.82,wolf:.82,unicorn:.76}[kind],evade={lion:.40,wolf:.38,unicorn:.42}[kind];
  await pose(kind,'attack',0);await cycle(kind+'-strike',wind+active+recovery);await pose(kind,'attack',wind+.03);await still(kind+'-strike-active');
  await pose(kind,'attack',0,true);await cycle(kind+'-counter',.24+active+recovery);await pose(kind,'attack',.27,true);await still(kind+'-counter-active');
  await pose(kind,'evade',0);await cycle(kind+'-evade',evade);await pose(kind,'evade',evade/2);await still(kind+'-evade-mid');await pose(kind,'evade',evade);await still(kind+'-evade-land');
  await pose(kind,'hit',.2);await still(kind+'-hit');await pose(kind,'run',.25,false,'race');await still(kind+'-run');
  assert.deepEqual(errors,[]);console.log('Captured runtime poses/cycles '+kind);
 }
} finally {
 await writeFile(resolve(directory,'manifest.json'),JSON.stringify({classification:'Local actual-renderer pose/cycle inspection. UI pose settings and public-canvas MediaRecorder only; no simulation stepping, collision or normal-gameplay claim.',records,errors,handoff,toolSha256:hash(await readFile(new URL(import.meta.url)))},null,2)+'\n');
 await browser.close();console.log(directory);
}
assert.deepEqual(errors,[]);console.log('RUNTIME POSE CYCLES CAPTURED');
