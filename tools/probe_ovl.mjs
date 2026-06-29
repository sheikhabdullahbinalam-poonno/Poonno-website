import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true, args: ['--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1000, height: 600 } });
await p.goto('http://localhost:8080/', { waitUntil: 'load' });
await p.waitForTimeout(800);
await p.evaluate(() => { document.getElementById('enter-btn')?.click(); const l=document.getElementById('loader'); if(l) l.style.display='none'; });
for (const t of [0.44,0.46,0.48,0.50,0.52,0.54,0.56]) {
  await p.evaluate((t)=>window.__poonno.snapTo(t), t);
  await p.waitForTimeout(900);
  const r = await p.evaluate(()=>{
    const bo=document.getElementById('board-prompt'), so=document.getElementById('station-overlay');
    const op=e=>e?+parseFloat(getComputedStyle(e).opacity).toFixed(2):0;
    return { board:op(bo), station:op(so), stationName: so?.querySelector('.so-name')?.textContent||'' };
  });
  console.log(`t=${t}  board=${r.board}  station=${r.station} ${r.stationName}`);
}
await b.close();
