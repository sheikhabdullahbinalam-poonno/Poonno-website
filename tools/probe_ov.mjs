import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true, args: ['--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1000, height: 600 } });
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await p.goto('http://localhost:8080/', { waitUntil: 'load' });
await p.waitForTimeout(900);
await p.evaluate(() => { document.getElementById('enter-btn')?.click(); const l=document.getElementById('loader'); if(l) l.style.display='none'; });
async function chk(t, id) {
  await p.evaluate((t)=>window.__poonno.snapTo(t), t);
  await p.waitForTimeout(2500);
  return await p.evaluate((id)=>{ const e=document.getElementById(id); if(!e) return id+': missing'; const cs=getComputedStyle(e); return {id, t:document.getElementById('hud-t')?.textContent, cls:[...e.classList], disp:cs.display, op:cs.opacity, z:cs.zIndex}; }, id);
}
console.log(JSON.stringify(await chk(0.47,'board-prompt')));
console.log(JSON.stringify(await chk(0.22,'read-guide')));
if(errs.length) console.log('ERR:', errs.slice(0,4).join(' | '));
await b.close();
