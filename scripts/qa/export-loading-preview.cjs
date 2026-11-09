// Export the exact existing menu renderer's temporary early preview, without UI.
const {chromium}=require('@playwright/test'); const fs=require('fs');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 await page.goto('https://omarchy.tail04cbd3.ts.net:4495');
 await page.locator('.loading-preview').waitFor({timeout:120000});
 const background=await page.locator('.loading-preview').evaluate(el=>el.style.backgroundImage);
 const encoded=background.match(/data:image\/webp;base64,([^"')]+)/)?.[1]; if(!encoded)throw new Error('No real rendered preview');
 fs.mkdirSync('public/assets/previews',{recursive:true});fs.writeFileSync('public/assets/previews/lion-menu.webp',Buffer.from(encoded,'base64'));
 console.log('EXPORTED exact 1280x720 existing Lion menu image');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
