// Native Chromium touch events + the actual production binding. Dropping one up
// explicitly injects the missed-notification condition; this is not an iPhone reproduction.
const { chromium } = require('@playwright/test');
const ts = require('typescript');
const fs = require('fs');
const assert = require('assert/strict');
const compiled = ts.transpileModule(fs.readFileSync('src/championship/result-interaction.ts','utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const report={condition:'Chromium native touch, one pointerup deliberately withheld from gate; not a physical-iPhone reproduction',cases:[]};
 for(const legacy of [true,false]){
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await page.setContent('<meta name="viewport" content="width=device-width"><button id="fight" style="width:180px;height:100px;touch-action:none">fight</button><button id="again" style="width:180px;height:100px;touch-action:none">again</button>');
  await page.addScriptTag({content:`var exports={};${compiled}`});
  await page.evaluate(legacy=>{
   window.now=0;performance.now=()=>window.now;window.actions=0;window.events=[];window.dropUp=true;
   window.addEventListener('pointerup',e=>{if(window.dropUp){window.dropUp=false;e.stopImmediatePropagation();}},true);
   window.gate=new exports.ResultInteraction();exports.bindResultInteraction(gate,window,document);
   // Recreate the old binding by suppressing registration of the two new handlers.
   window.legacy=legacy;
   for(const type of ['gotpointercapture','lostpointercapture'])window.addEventListener(type,e=>events.push(type),true);
   document.querySelector('#fight').onpointerdown=e=>e.currentTarget.setPointerCapture(e.pointerId);
   const again=document.querySelector('#again');
   again.onpointerdown=e=>gate.start(`p${e.pointerId}`,'again');
   again.onpointerup=e=>{if(gate.finish(`p${e.pointerId}`,'again',true))actions++;};
  },legacy);
  // For the negative control use the original binding source (without recovery events).
  if(legacy){await page.reload();await page.setContent('<meta name="viewport" content="width=device-width"><button id="fight" style="width:180px;height:100px;touch-action:none">fight</button><button id="again" style="width:180px;height:100px;touch-action:none">again</button>');
   await page.addScriptTag({content:`var exports={};${compiled.replace('win.addEventListener("lostpointercapture", cancel, true);','').replace('doc.addEventListener("visibilitychange", clear);','')}`});
   await page.evaluate(()=>{window.now=0;performance.now=()=>now;window.actions=0;window.events=[];window.dropUp=true;window.addEventListener('pointerup',e=>{if(dropUp){dropUp=false;e.stopImmediatePropagation()}},true);window.gate=new exports.ResultInteraction();exports.bindResultInteraction(gate,window,document);for(const t of ['gotpointercapture','lostpointercapture'])window.addEventListener(t,()=>events.push(t),true);document.querySelector('#fight').onpointerdown=e=>e.currentTarget.setPointerCapture(e.pointerId);document.querySelector('#again').onpointerdown=e=>gate.start(`p${e.pointerId}`,'again');document.querySelector('#again').onpointerup=e=>{if(gate.finish(`p${e.pointerId}`,'again',true))actions++}});
  }
  const c=await page.context().newCDPSession(page);
  await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:90,y:50}]});
  await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:91,y:50}]});
  await page.evaluate(()=>{now=100;gate.enter(now)});
  await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const recovered=await page.evaluate(()=>{now=5000;return {ready:gate.ready(now),actions,events}});
  assert(recovered.events.includes('lostpointercapture'),'native capture loss must occur');
  assert.equal(recovered.ready,!legacy);assert.equal(recovered.actions,0);
  if(!legacy){
   await page.touchscreen.tap(270,50);assert.equal(await page.evaluate(()=>actions),1);
   await page.evaluate(()=>{gate.enter(6000);now=10100;window.dispatchEvent(new KeyboardEvent('keydown',{key:'j'}));document.dispatchEvent(new Event('visibilitychange'));now=10699;});
   assert.equal(await page.evaluate(()=>gate.ready(now)),false);
   await page.evaluate(()=>{now=10700});await page.touchscreen.tap(270,50);assert.equal(await page.evaluate(()=>actions),2);
  }
  report.cases.push({legacy,...recovered});await page.close();
 }
 const stylePage=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 await stylePage.setContent('<meta name="viewport" content="width=device-width"><main class="championship"><p id="label">けっか はっぴょう！</p><div class="result-actions"><button>もういちど</button></div><input aria-label="しょうたいコード"><button class="invite-code">ABC123</button><div class="touch-controls"><button>たたく</button></div></main>');
 await stylePage.addStyleTag({content:fs.readFileSync('src/app/globals.css','utf8')});
 const styles=await stylePage.evaluate(()=>Object.fromEntries(['.championship','#label','.result-actions button','input','.invite-code','.touch-controls button'].map(selector=>{const s=getComputedStyle(document.querySelector(selector));return [selector,{selection:s.userSelect,touch:s.touchAction}]})));
 assert.equal(styles['#label'].selection,'none');
 assert.equal(styles['.championship'].touch,'manipulation');
 assert.equal(styles['.result-actions button'].touch,'none');
 assert.equal(styles['.touch-controls button'].touch,'none');
 assert.equal(styles.input.selection,'text'); assert.equal(styles['.invite-code'].selection,'text');
 await stylePage.locator('#label').dblclick(); assert.equal(await stylePage.evaluate(()=>String(getSelection())), '');
 await stylePage.getByRole('textbox').fill('ABC123');
 await stylePage.getByRole('textbox').evaluate(el=>{el.focus();el.select()});
 assert.equal(await stylePage.getByRole('textbox').evaluate(el=>el.selectionEnd-el.selectionStart),6);
 await stylePage.evaluate(()=>{window.copyClicked=false;document.querySelector('.invite-code').onclick=()=>{window.copyClicked=true}});
 await stylePage.locator('.invite-code').tap(); assert.equal(await stylePage.evaluate(()=>copyClicked),true);
 report.styles=styles;report.editAndCopy='PASS: invitation input remains editable/selectable; copy button receives tap';
 // Render the actual result section JSX without playing a full match.
 const source=fs.readFileSync('src/components/Championship.tsx','utf8');
 const sectionStart=source.indexOf('<section className="results-panel"');
 const jsx=source.slice(sectionStart,source.indexOf('</section>',sectionStart)+10);
 const sectionJs=ts.transpileModule(`const result=(${jsx});`,{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2020}}).outputText;
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const env={resultsPanel:null,view:{format:'championship',result:{winner:0,race:[100,80],fight:[100,80],total:[200,160]},players:[{character:'lion',hp:100,finishTime:30},{character:'wolf',hp:0,finishTime:32}]},mode:'solo',cpuDifficulty:'easy',CPU_DIFFICULTY_SETTINGS:{easy:{label:'かんたん'}},localSlot:0,ROSTER:{lion:{name:'らいおん'},wolf:{name:'おおかみ'}},formatTime:n=>`${n}s`,resultStatus:'ceremony',resultSeconds:4,resultReady:false,rematchWaiting:false,resultAction:()=>({}),rematch:()=>{},leave:()=>{},connected:{current:true}};
 const render=new Function('React','env',`with(env){${sectionJs};return result;}`);
 report.resultLayouts=[];
 for(const [width,height] of [[844,390],[390,844]]) {
  await stylePage.setViewportSize({width,height});
  for(const phase of ['ceremony','ready']) {
   env.resultStatus=phase;env.resultReady=phase==='ready';
   await stylePage.setContent('<meta name="viewport" content="width=device-width"><main class="championship">'+renderToStaticMarkup(render(React,env))+'</main>');
   await stylePage.addStyleTag({content:fs.readFileSync('src/app/globals.css','utf8')+' .result-actions { animation: none; }'});
   const box=await stylePage.locator('.result-actions > .primary-button').boundingBox();
   assert(box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height,JSON.stringify({width,height,phase,box}));
   const panel=await stylePage.locator('.results-panel').boundingBox();
   const secondary=await stylePage.locator('.result-actions > .secondary-button').boundingBox();
   assert(panel.y>=0&&panel.y+panel.height<=height,JSON.stringify({width,height,phase,panel}));
   assert(secondary.y>=0&&secondary.y+secondary.height<=height,JSON.stringify({width,height,phase,secondary}));
   report.resultLayouts.push({width,height,phase,box,panel,secondary});
  }
 }
 await stylePage.close();
 await browser.close();fs.writeFileSync('/tmp/result-interruption-report.json',JSON.stringify(report,null,2));console.log('RESULT_INTERRUPTION_PASS',JSON.stringify(report));
})().catch(e=>{console.error(e);process.exit(1)});
