import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true, args: ['--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 800, height: 600 } });
await p.goto('http://localhost:8080/', { waitUntil: 'load' });
await p.waitForTimeout(1000);
await p.evaluate(() => { document.getElementById('enter-btn')?.click(); const l=document.getElementById('loader'); if(l) l.style.display='none'; });
await p.evaluate(() => window.__poonno.snapTo(0.13));
await p.waitForTimeout(4000);
const r = await p.evaluate(() => {
  const c=window.__poonno.camera, h=window.__poonno.newspaper.hero;
  const V=h.position.constructor;
  const toCam=new V().subVectors(c.position,h.position).normalize();
  const ny=new V(0,1,0).applyQuaternion(h.quaternion);
  const nz=new V(0,0,1).applyQuaternion(h.quaternion);
  const nx=new V(1,0,0).applyQuaternion(h.quaternion);
  return { dot_localY:+ny.dot(toCam).toFixed(2), dot_localZ:+nz.dot(toCam).toFixed(2), dot_localX:+nx.dot(toCam).toFixed(2) };
});
console.log('face dots (which local axis points at camera?):', JSON.stringify(r));
await b.close();
