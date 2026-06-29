import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true, args: ['--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1000, height: 600 } });
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await p.goto('http://localhost:8080/', { waitUntil: 'load' });
await p.waitForTimeout(800);
await p.evaluate(() => { document.getElementById('enter-btn')?.click(); const l=document.getElementById('loader'); if(l) l.style.display='none'; });
await p.mouse.move(500, 300); await p.waitForTimeout(150); await p.mouse.move(520, 320); await p.waitForTimeout(300);
const r = await p.evaluate(() => {
  const dot=document.getElementById('cursor-dot'), ring=document.getElementById('cursor');
  const cs=ring?getComputedStyle(ring):null, ds=dot?getComputedStyle(dot):null;
  return {
    hasCursorClass: document.documentElement.classList.contains('has-cursor'),
    dotDisplay: ds && ds.display, dotTransform: dot && dot.style.transform,
    ringBlend: cs && cs.mixBlendMode, ringBorder: cs && cs.borderColor,
    ringBg: cs && cs.backgroundColor, ringShadow: cs && cs.boxShadow,
  };
});
console.log(JSON.stringify(r,null,1));
if(errs.length) console.log('ERR:', errs.slice(0,4).join(' | ')); else console.log('no errors');
await b.close();
