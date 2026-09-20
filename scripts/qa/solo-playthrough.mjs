/** Ordinary-input solo integration; never reads or changes private game state. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
const [url, manifestPath, revision, selectedPairs] = process.argv.slice(2);
assert.ok(url && manifestPath && revision, 'Usage: node scripts/qa/solo-playthrough.mjs URL MANIFEST REVISION [lion:wolf,...]');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function verifySource() { for (const [path, sha] of Object.entries(manifest.files)) assert.equal(hash(await readFile(path)), sha, `Source drift: ${path}`); }
await verifySource();
const buildId = await readFile('.next/BUILD_ID', 'utf8');
const animals = ['lion', 'wolf', 'unicorn'];
const names = { lion: /Fire\s*Lion/i, wolf: /Water\s*Wolf/i, unicorn: /Rainbow\s*Unicorn/i };
const pairs = selectedPairs ? selectedPairs.split(',').map(pair => pair.split(':')) : animals.flatMap(a => animals.map(b => [a, b]));
assert.ok(pairs.every(p => p.length === 2 && p.every(a => animals.includes(a))));
const directory = resolve('docs/production/evidence/revision2-solo', new Date().toISOString().replace(/[:.]/g, '-'));
await mkdir(directory, { recursive: true });
await writeFile(resolve(directory, 'manifest.json'), JSON.stringify(manifest, null, 2));
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const context = await browser.newContext({ viewport: { width: 1100, height: 740 }, deviceScaleFactor: 1, acceptDownloads: true });
const page = await context.newPage(), errors = [], rows = [], served = {};
const pending = new Set();
page.on('pageerror', error => errors.push(String(error)));
page.on('response', response => {
 const path = new URL(response.url()).pathname;
 if (!response.ok() || !(path.startsWith('/_next/static/') || path.startsWith('/assets/'))) return;
 const task = (async () => {
  const local = path.startsWith('/_next/static/') ? '.next/static/' + path.slice('/_next/static/'.length) : 'public' + path;
  const actual = hash(await response.body()); assert.equal(actual, hash(await readFile(local)), 'Served build mismatch: ' + path); served[path] = actual;
 })().catch(error => errors.push(String(error)));
 pending.add(task); task.finally(() => pending.delete(task));
});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const phase = () => page.locator('main.championship').getAttribute('data-phase');
async function panel(open) { if (await page.locator('.performance-panel').isVisible() !== open) await page.getByRole('button', { name: 'Performance report', exact: true }).click(); }
async function hold(key, ms) { await page.keyboard.down(key); try { await delay(ms); } finally { await page.keyboard.up(key); } }
async function download(button, path) { const waiting = page.waitForEvent('download', { timeout: 20000 }); await button.click(); const item = await waiting; await item.saveAs(path); assert.equal(await item.failure(), null); }
let failure = null;
try {
 await page.goto(url);
 await page.getByRole('button', { name: 'RIDE AGAINST CPU' }).waitFor({ state: 'visible' });
 for (const [animal, rival] of pairs) {
  const prefix = animal + '-' + rival, events = [], started = Date.now();
  console.log('Starting solo ' + prefix);
  await page.locator('.roster-card').filter({ hasText: names[animal] }).click();
  await page.getByRole('button', { name: 'RIDE AGAINST CPU' }).click();
  await page.getByLabel('Your CPU rival').selectOption(rival);
  await panel(true); await page.getByRole('button', { name: 'Start fresh measurement' }).click(); await page.getByRole('button', { name: 'Record game canvas' }).click(); await panel(false);
  await page.getByRole('button', { name: 'LET’S RIDE' }).click();
  const acted = new Set(); let cueWasVisible = false, attempts = 0;
  while (Date.now() - started < 180000) {
   assert.equal(errors.length, 0, errors.join('\n'));
   const current = await phase();
   if (current === 'results') break;
   if (current === 'race') {
    const progress = parseInt(await page.locator('.race-distance > span').innerText({timeout:150}).catch(()=>''), 10);
    for (const [at, action] of [[16,'leap'],[30,'leap'],[44,'left'],[61,'leap'],[73,'right'],[88,'leap']]) {
     if (progress < at || acted.has(at)) continue;
     acted.add(at); events.push({ atMs: Date.now()-started, phase: current, progress, action });
     if (action === 'leap') await page.keyboard.press('Space', { delay: 60 });
     else await hold(action === 'left' ? 'ArrowLeft' : 'ArrowRight', action === 'left' ? 800 : 1200);
    }
   }
   if (current === 'fight') {
    const cue = await page.locator('.duel-cue').textContent({ timeout: 100 }).catch(() => '');
    const winding = cue === 'WATCH THE WIND-UP';
    if (winding && !cueWasVisible) {
     attempts++; const seen = Date.now();
     await delay({ lion:450, wolf:360, unicorn:400 }[rival]);
     await page.keyboard.press('Space', { delay:60 });
     await delay({ lion:360, wolf:340, unicorn:380 }[animal]);
     await hold('ArrowRight', { lion:320, wolf:350, unicorn:300 }[animal]);
     await page.keyboard.press('j', { delay:60 });
     events.push({ atMs: Date.now()-started, phase:current, attempt:attempts, observedAtMs:seen-started, health:await page.locator('.health-block small').allTextContents() });
     if (attempts <= 2) await page.screenshot({ path:resolve(directory, `${prefix}-reply-${attempts}.png`) });
    }
    cueWasVisible = winding;
   }
   await delay(65);
  }
  assert.equal(await phase(), 'results', 'Complete solo championship');
  await delay(4500); // Let the score reveal and cup lift finish before capturing.
  await page.screenshot({ path:resolve(directory, prefix+'-results.png') });
  await panel(true);
  const reportPath = resolve(directory, prefix+'-report.json');
  await download(page.getByRole('button', { name:'Download measurements', exact:true }), reportPath);
  await panel(false);
  await download(page.locator('.recording-indicator'), resolve(directory, prefix+'-recording.webm'));
  const report = JSON.parse(await readFile(reportPath, 'utf8'));
  assert.equal(report.revision, revision); assert.equal(report.mode, 'solo'); assert.equal(report.phase, 'results');
  assert.deepEqual(report.match.players.map(p=>p.character), [animal,rival]);
  assert.ok(report.match.players.every(p=>p.raceStatus==='finished'), 'No race nonfinishers');
  const count = type => report.playTrace.events.filter(e=>e.slot===0&&e.type===type).length;
  assert.ok(count('jump')>=2 && count('evade')>=2 && count('evade-success')>=1 && count('counter')>=1, 'Real leaps and successful evasion/reply required');
  assert.ok(report.match.players[1].hp<100, 'Reply must cause actual damage');
  rows.push({ pair:[animal,rival], result:report.match.result, health:report.match.players.map(p=>p.hp), events, actionCounts:Object.fromEntries(['jump','obstacle','draft-start','draft-ready','pass','evade','evade-success','counter','hit'].map(type=>[type,count(type)])) });
  await writeFile(resolve(directory,prefix+'-inputs.json'),JSON.stringify(events,null,2));
  console.log('Verified solo '+prefix+' '+JSON.stringify(rows.at(-1).health));
  await page.getByRole('button',{ name:'Back to the trail',exact:true }).click();
  await verifySource(); assert.equal(await readFile('.next/BUILD_ID','utf8'),buildId,'Build changed during play');
 }
} catch(error) {
 failure=String(error); await page.screenshot({path:resolve(directory,'failure.png')}).catch(()=>{});
 await panel(true).catch(()=>{});
 await download(page.getByRole('button',{name:'Download measurements',exact:true}),resolve(directory,'failure-report.json')).catch(()=>{});
 await panel(false).catch(()=>{});
 if(await page.locator('.recording-indicator').isVisible()) await download(page.locator('.recording-indicator'),resolve(directory,'failure-recording.webm')).catch(()=>{});
 throw error;
}
finally {
 await Promise.allSettled([...pending]);
 await writeFile(resolve(directory,'solo-matrix.json'),JSON.stringify({ classification:'NORMAL-CONTROL DESKTOP SOLO PLAY. Scripted ordinary keys and visible UI only; recorded under shared-machine load. Not physical touch, controlled performance or human enjoyment acceptance.',url,sourceFingerprint:manifest.sourceFingerprint,revision,buildId:buildId.trim(),requestedPairs:pairs,results:rows,errors,failure,served },null,2));
 await browser.close(); console.log('Solo evidence: '+directory);
}
assert.equal(rows.length,pairs.length); assert.equal(errors.length,0);
console.log('NORMAL-CONTROL SOLO PLAY VERIFIED');
