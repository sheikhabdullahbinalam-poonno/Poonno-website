import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true, args: ['--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
async function check(w,h){
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto('http://localhost:8080/', { waitUntil: 'load' });
  await p.waitForTimeout(800);
  await p.evaluate(() => { document.getElementById('enter-btn')?.click(); const l=document.getElementById('loader'); if(l) l.style.display='none'; });
  await p.evaluate(() => window.__poonno.snapTo(0.2));
  await p.waitForTimeout(1500);
  const r = await p.evaluate(() => {
    const c=document.querySelector('#news-page-1 .np-cols');
    if(!c) return 'no cols';
    return { clientW:c.clientWidth, scrollW:c.scrollWidth, clientH:c.clientHeight, scrollH:c.scrollHeight, overflowX: c.scrollWidth-c.clientWidth };
  });
  await p.close();
  return r;
}
console.log('1440x820:', JSON.stringify(await check(1440,820)));
console.log('1280x720:', JSON.stringify(await check(1280,720)));
console.log('820x1000:', JSON.stringify(await check(820,1000)));
await b.close();
