import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true, args: ['--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 800, height: 600 } });
const errs=[]; p.on('console',m=>{ if(m.type()==='error'||m.type()==='warning') errs.push(m.text()); });
await p.goto('http://localhost:8080/', { waitUntil: 'load' });
await p.waitForTimeout(1000);
await p.evaluate(() => { document.getElementById('enter-btn')?.click(); const l=document.getElementById('loader'); if(l) l.style.display='none'; });
await p.evaluate(() => window.__poonno.snapTo(0.0));
await p.waitForTimeout(4000);
const r = await p.evaluate(() => {
  const h=window.__poonno.newspaper.hero; let out=[];
  h.traverse(o=>{ if(o.isMesh){ const m=o.material; out.push({ type:m.type, transparent:m.transparent, opacity:m.opacity, hasMap:!!m.map, mapImg: m.map? (m.map.image? (m.map.image.width+'x'+m.map.image.height):'no-image'):'none', color:m.color&&m.color.getHexString(), visible:o.visible, geoCount:o.geometry.attributes.position.count, alphaTest:m.alphaTest }); } });
  return out;
});
console.log(JSON.stringify(r,null,1));
if(errs.length) console.log('WARN/ERR:', errs.slice(0,6).join(' | '));
await b.close();
