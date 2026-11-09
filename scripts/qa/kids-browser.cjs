const { chromium } = require('@playwright/test');
const fs = require('fs');
const assert = require('assert/strict');
(async()=>{
 const output='/tmp/animal-racers-kids-evidence'; fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const report={environment:'omarchy Chromium headless SwiftShader software renderer; fresh browser context each run; LAN localhost origin; no CPU/network throttling',loads:[],layouts:[],errors:[]};
 for(const variant of ['kids']) {
  const context=await browser.newContext({viewport:{width:1280,height:720}});const page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(String(e)));
  const start=Date.now(); console.log('LOADING',variant); await page.goto(`https://omarchy.tail04cbd3.ts.net:${variant==='kids'?4495:4496}`);
  await page.getByRole('button',{name:variant==='kids'?/^あそぶ/:/^RIDE AGAINST CPU/}).waitFor({timeout:120000});
  await page.waitForFunction(()=>{const b=document.querySelector('.selection-panel > .primary-button');return b&&!b.disabled},{timeout:120000});
  console.log('READY',variant,Date.now()-start); report.loads.push({variant,readyWallMs:Date.now()-start,marks:await page.evaluate(()=>performance.getEntriesByType('mark').map(m=>({name:m.name,time:m.startTime}))),gpu:await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2');const ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);})});
  if(variant==='kids') {
   await page.screenshot({path:`${output}/selection.png`});
   await page.getByRole('button',{name:/^あそぶ/}).click();
   for(const [width,height] of [[1280,720],[844,390],[667,375],[390,844]]) {
    await page.setViewportSize({width,height});await page.waitForTimeout(250);
    const layout=await page.locator('.kids-intro > .primary-button').evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,viewWidth:innerWidth,viewHeight:innerHeight,visibleAtCenter:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===el||el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};});
    await page.screenshot({path:`${output}/intro-${width}x${height}.png`});
    assert(layout.y>=0&&layout.y+layout.height<=height&&layout.visibleAtCenter,JSON.stringify(layout)); report.layouts.push(layout);
    await page.screenshot({path:`${output}/intro-${width}x${height}.png`});
   }
   await page.setViewportSize({width:844,height:390});
   await page.getByRole('button',{name:'スタート！',exact:false}).click();
   await page.locator('[data-phase="countdown"]').waitFor(); await page.screenshot({path:`${output}/race-countdown.png`});
   console.log('RACE STARTED');
   await page.getByRole('button',{name:'どうぶつを えらびなおす'}).click();
   await page.getByRole('button',{name:/バトルだけ あそぶ/}).click();
   await page.getByRole('button',{name:/たたかう！/}).click();
   await page.locator('[data-phase="fight"]').waitFor({timeout:120000}); console.log('FIGHT STARTED'); await page.screenshot({path:`${output}/fight-start.png`});fs.writeFileSync(`${output}/browser-report.json`,JSON.stringify(report,null,2));
   assert.equal(await page.locator('.touch-controls button').count(),3);
   // Real visible control inputs through a complete duel, including sustained
   // rapid tapping through the transition. Keep tapping the former strike point.
   const r=await page.getByRole('button',{name:'たたく',exact:true}).boundingBox();const x=r.x+r.width/2,y=r.y+r.height/2;
   const end=Date.now()+240000;
   while(!(await page.locator('[data-phase="results"]').count())&&Date.now()<end){await page.mouse.click(x,y);await page.waitForTimeout(120);}
   await page.locator('[data-phase="results"]').waitFor();console.log('RESULTS');
   for(let i=0;i<45;i++){await page.mouse.click(x,y);await page.waitForTimeout(120);}
   assert.equal(await page.locator('[data-phase="results"]').count(),1);
   await page.screenshot({path:`${output}/results-after-tapping.png`});
   await page.waitForTimeout(800);
   await page.getByRole('button',{name:'もういちど',exact:false}).click();
   await page.locator('[data-phase="transition"]').waitFor({timeout:10000});
   report.rematch='PASS: rapid tapping beyond 4 seconds preserves results; a quiet pause + deliberate button click starts a fresh practice transition';
  }
  await context.close();
 }
 fs.writeFileSync(`${output}/browser-report.json`,JSON.stringify(report,null,2));await browser.close(); console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
