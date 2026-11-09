const {chromium}=require('@playwright/test');const fs=require('fs');
(async()=>{
 const rows=[]; const output='/tmp/animal-racers-kids-evidence';fs.mkdirSync(output,{recursive:true});
 for(const variant of ['baseline','kids']) {
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu-shader-disk-cache']});
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  await page.addInitScript(()=>{
   new MutationObserver(()=>{const button=document.querySelector('.selection-panel > .primary-button');if(button&&!button.disabled&&!document.documentElement.dataset.qaReady)document.documentElement.dataset.qaReady=String(performance.now());}).observe(document,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});
  });
  await page.goto(`https://omarchy.tail04cbd3.ts.net:${variant==='kids'?4495:4496}`);
  await page.waitForFunction(()=>document.documentElement.dataset.qaReady,null,{timeout:120000});
  const row=await page.evaluate(()=>({readyMs:Number(document.documentElement.dataset.qaReady),marks:performance.getEntriesByType('mark').filter(x=>x.name.startsWith('animal-')).map(x=>({name:x.name,ms:x.startTime}))}));
  rows.push({variant,...row});fs.writeFileSync(`${output}/loading-report.json`,JSON.stringify({environment:'omarchy Linux, Chromium headless, SwiftShader software GPU, 1280x720; fresh browser process and profile for EACH variant; disk shader cache disabled; no network or CPU throttling; each fetched through its tailnet HTTPS URL; one sample per variant',rows},null,2));console.log(variant,row);
  await browser.close();
 }
})().catch(e=>{console.error(e);process.exit(1)});
