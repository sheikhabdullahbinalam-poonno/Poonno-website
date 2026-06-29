import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true, args: ['--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 800, height: 600 } });
await p.goto('http://localhost:8080/', { waitUntil: 'load' });
await p.waitForTimeout(1000);
await p.evaluate(() => { document.getElementById('enter-btn')?.click(); const l=document.getElementById('loader'); if(l) l.style.display='none'; });
await p.evaluate(() => window.__poonno.snapTo(0.68));
await p.waitForTimeout(4500);
const r = await p.evaluate(() => {
  const tr = window.__poonno.train;
  return tr.cars.slice(0,3).map((c,i)=>({i, pos:[+c.position.x.toFixed(1),+c.position.y.toFixed(1),+c.position.z.toFixed(1)], ry:+c.rotation.y.toFixed(2)}));
});
console.log(JSON.stringify(r));
await b.close();
