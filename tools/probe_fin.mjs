import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true, args: ['--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1000, height: 600 } });
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await p.goto('http://localhost:8080/', { waitUntil: 'load' });
await p.waitForTimeout(900);
await p.evaluate(() => { document.getElementById('enter-btn')?.click(); const l=document.getElementById('loader'); if(l) l.style.display='none'; });
await p.evaluate(() => window.__poonno.snapTo(1.0));
await p.waitForTimeout(5000);
const r = await p.evaluate(() => {
  const c=document.getElementById('contact');
  const cs=c?getComputedStyle(c):null;
  // count Points (blossoms) and find any warm/yellow light in scene
  const scene=window.__poonno.scene; let points=0, pointLights=[];
  scene.traverse(o=>{ if(o.isPoints) points++; if(o.isPointLight) pointLights.push({color:o.color.getHexString(),int:+o.intensity.toFixed(2),pos:[Math.round(o.position.x),Math.round(o.position.y),Math.round(o.position.z)]}); });
  const cam=window.__poonno.camera;
  return { contact: c?{ hasShow:c.classList.contains('show'), display:cs.display, opacity:cs.opacity, ariaHidden:c.getAttribute('aria-hidden') }:'none', pointsCount:points, pointLights, camPos:[+cam.position.x.toFixed(1),+cam.position.y.toFixed(1),+cam.position.z.toFixed(1)] };
});
console.log(JSON.stringify(r,null,1));
if(errs.length) console.log('ERR:', errs.slice(0,5).join(' | '));
await b.close();
