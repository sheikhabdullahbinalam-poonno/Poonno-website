import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true, args: ['--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 800, height: 600 } });
await p.goto('http://localhost:8080/', { waitUntil: 'load' });
await p.waitForTimeout(1000);
await p.evaluate(() => { document.getElementById('enter-btn')?.click(); const l=document.getElementById('loader'); if(l) l.style.display='none'; });
await p.waitForTimeout(5500);
const info = await p.evaluate(() => {
  const scene = window.__poonno?.scene; if(!scene) return {err:'no scene'};
  let forest=null;
  scene.traverse(o=>{ if(o.isInstancedMesh && o.count>500 && !forest) forest=o; });
  if(!forest) return {err:'no forest mesh >500'};
  const ia=forest.instanceMatrix.array; const near=[];
  for(let i=0;i<forest.count;i++){ const x=ia[i*16+12], z=ia[i*16+14]; if(z<-160&&z>-200) near.push([+x.toFixed(1),+z.toFixed(1)]); }
  near.sort((a,b)=>Math.abs(a[0])-Math.abs(b[0]));
  return { forestCount: forest.count, treesNearZ180: near.length, closestX: near.slice(0,10) };
});
console.log(JSON.stringify(info));
await b.close();
