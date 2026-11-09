// Loopback-only comparison. Deterministic UI CPU workload is separate from
// actual-renderer RAF pacing; neither is a physical-phone performance claim.
const {chromium}=require('@playwright/test');
const {build}=require('esbuild');
const fs=require('fs');const assert=require('assert/strict');const crypto=require('crypto');
(async()=>{
 const out='/tmp/animal-perf-evidence';fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const bundle=await build({stdin:{contents:"export * from './src/championship/ui-updates';export * from './src/championship/simulation';",resolveDir:process.cwd()},bundle:true,write:false,format:'iife',globalName:'Bench',platform:'browser'});
 const page=await browser.newPage();await page.addScriptTag({content:bundle.outputFiles[0].text});
 const renderer=fs.readFileSync('src/championship/renderer.ts','utf8');
 const reportBody=renderer.slice(renderer.indexOf('  report(): FrameReport {')+25,renderer.indexOf('  dispose() {'));
 // Preserve the exact report algorithm from the baseline/current renderer.
 const reportSource=reportBody.slice(0,reportBody.lastIndexOf('}')).replace('const percentile = (p: number)', 'const percentile = (p)');
 const micro=await page.evaluate(reportSource=>{
  const report=new Function(reportSource), rows=[];
  for(const phase of ['race','fight']) {
   const frames=[];const m=(phase==='race'?Bench.createMatch:Bench.createDuelMatch)(['lion','wolf'],6827);m.phase=phase;
   for(let tick=0;tick<600;tick++) {const a=Bench.neutralInput(),b=Bench.neutralInput();a.jump=tick%120===0;a.move=phase==='fight'?1:0;a.attack=phase==='fight'&&tick%30===0;Bench.stepMatch(m,[a,b],1/60);frames.push(structuredClone(m));}
   for(const variant of ['before','after']) {
    let reports=0,snapshots=0,elapsed=0,checksum=0;
    // 5 identical ten-second traces amplify short CPU operations for the clock.
    for(let repeat=0;repeat<5;repeat++) {
     const owner={frameTimes:Array.from({length:1800},(_,i)=>16.7+(i%97)),renderer:{info:{render:{calls:200,triangles:300000}},getPixelRatio:()=>1},cache:{size:6},preparing:false};
     const gate=new Bench.UiUpdates();let lastUI=0;const authority=structuredClone(frames[0]);
     const start=performance.now();
     for(let i=0;i<frames.length;i++) {
      Object.assign(authority,frames[i]);const now=i*1000/60;
      if(variant==='before') {if(now-lastUI>50){lastUI=now;const v=structuredClone(authority);checksum+=v.tick;snapshots++;report.call(owner);reports++;}}
      else {if(gate.hudDue(now,authority)){checksum+=Bench.hudSnapshot(authority).tick;snapshots++;}if(gate.reportDue(now,false)){report.call(owner);reports++;}}
     }
     elapsed+=performance.now()-start;
    }
    rows.push({phase,variant,repeats:5,framesPerTrace:600,traceSeconds:10,reportCalls:reports,hudSnapshots:snapshots,totalWorkMs:elapsed,msPerTrace:elapsed/5,checksum});
   }
  }
  return rows;
 },reportSource);
 console.log('MICRO_DONE',JSON.stringify(micro));fs.writeFileSync(`${out}/micro.json`,JSON.stringify(micro,null,2));
 assert(micro.filter(r=>r.variant==='after').every(r=>r.reportCalls===0));await page.close();
 const result={environment:'omarchy /usr/bin/chromium, headless SwiftShader, 844x390 DPR1, fresh context per build, one 5-second race and fight sample per build; same scripted keys; no CPU/network throttling',baseline:'fab1d6c',micro,play:[],errors:[],notes:['Micro workload uses identical deterministic race/fight states and the actual report algorithm, with React scheduling excluded.','Real RAF intervals include WebGL/software rendering, browser/OS work and scheduling; timing changes cannot establish a phone smoothness improvement.','Single before/after run; cold startup excluded by waiting for ready and phase entry.','Other-project vitest processes were concurrently active; CPU wall time and RAF pacing are noisy, not causal performance acceptance.']};
 for(const [variant,port] of [['before',3499],['after',3498]]) {
  const context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:1,acceptDownloads:true});
  const p=await context.newPage();p.on('pageerror',e=>result.errors.push(String(e)));
  console.log('LOADING',variant);await p.goto(`http://localhost:${port}`);await p.waitForFunction(()=>{const b=document.querySelector('.selection-panel > .primary-button');return b&&!b.disabled},null,{timeout:90000});
  for(const phase of ['race','fight']) {
   if(phase==='race'){await p.getByRole('button',{name:/^あそぶ/}).click();await p.getByRole('button',{name:/スタート！/}).click();}
   else {await p.getByRole('button',{name:'どうぶつを えらびなおす'}).click();await p.getByRole('button',{name:/バトルだけ あそぶ/}).click();await p.getByRole('button',{name:/たたかう！/}).click();}
   await p.locator(`[data-phase="${phase}"]`).waitFor({timeout:60000});
   await p.getByRole('button',{name:'うごきの きろく',exact:true}).click();await p.getByRole('button',{name:'きろくを はじめる',exact:true}).click();await p.getByRole('button',{name:'うごきの きろく',exact:true}).click();
   await p.evaluate(phase=>{
    window.probe={times:[],last:0,active:true,cloneCount:0,cloneMs:0};
    const clone=window.probeOriginalClone??window.structuredClone;window.probeOriginalClone=clone;window.structuredClone=function(value,...args){const start=performance.now();const v=clone.call(this,value,...args);if(probe.active&&value?.players&&value?.phase){probe.cloneCount++;probe.cloneMs+=performance.now()-start;}return v};
    const frame=t=>{if(!probe.active)return;if(probe.last)probe.times.push(t-probe.last);probe.last=t;requestAnimationFrame(frame)};requestAnimationFrame(frame);
    const key=phase==='race'?'ArrowUp':'j';window.keyTimer=setInterval(()=>{window.dispatchEvent(new KeyboardEvent('keydown',{key}));window.dispatchEvent(new KeyboardEvent('keyup',{key}));},500);
   },phase);
   await p.waitForTimeout(5000);
   const measured=await p.evaluate(()=>{probe.active=false;clearInterval(keyTimer);const s=[...probe.times].sort((a,b)=>a-b);return {frames:s.length,p50Ms:s[Math.floor(s.length*.5)],p95Ms:s[Math.floor(s.length*.95)],over33:s.filter(n=>n>33.34).length,cloneCount:probe.cloneCount,cloneMs:probe.cloneMs}});
   await p.getByRole('button',{name:'うごきの きろく',exact:true}).click();
   const downloaded=p.waitForEvent('download');await p.getByRole('button',{name:'きろくを ほぞん',exact:true}).click();const download=await downloaded;const file=`${out}/${variant}-${phase}.json`;await download.saveAs(file);
   const telemetry=JSON.parse(fs.readFileSync(file,'utf8'));
   result.play.push({variant,phase,...measured,work:telemetry.work.stages,reportedPhase:telemetry.phase,reportedTick:telemetry.match.tick,frames:telemetry.frames});
   await p.getByRole('button',{name:'うごきの きろく',exact:true}).click();
   console.log('MEASURED',variant,phase,JSON.stringify(measured));
  }
  await context.close();
 }
 assert.equal(result.errors.length,0);assert(result.play.every(r=>r.reportedPhase===r.phase));
 result.sourceHashes=Object.fromEntries(['src/components/Championship.tsx','src/championship/ui-updates.ts','src/championship/renderer.ts'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));
 fs.writeFileSync(`${out}/comparison.json`,JSON.stringify(result,null,2));await browser.close();console.log('UI_WORK_COMPARISON_PASS',JSON.stringify({micro,play:result.play.map(({work,...r})=>r)}));
})().catch(e=>{console.error(e);process.exit(1)});
