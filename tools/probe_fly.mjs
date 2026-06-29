import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true, args: ['--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 800, height: 600 } });
await p.goto('http://localhost:8080/', { waitUntil: 'load' });
await p.waitForTimeout(900);
await p.evaluate(() => { document.getElementById('enter-btn')?.click(); const l=document.getElementById('loader'); if(l) l.style.display='none'; });
await p.evaluate(() => window.__poonno.snapTo(0.135));
await p.waitForTimeout(2500);
const r = await p.evaluate(() => {
  const c=window.__poonno.camera, h=window.__poonno.newspaper.hero;
  const V=c.position.constructor;
  const wp=new V(); h.getWorldPosition(wp);
  const fwd=new V(0,0,-1).applyQuaternion(c.quaternion);
  const to=new V().subVectors(wp,c.position);
  return { cam:[+c.position.x.toFixed(2),+c.position.y.toFixed(2),+c.position.z.toFixed(2)], hero:[+wp.x.toFixed(2),+wp.y.toFixed(2),+wp.z.toFixed(2)], scale:+h.scale.x.toFixed(2), dist:+to.length().toFixed(2), dotFwd:+fwd.dot(to.clone().normalize()).toFixed(2), visible:h.visible };
});
console.log(JSON.stringify(r));
await b.close();
