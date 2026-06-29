import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true, args: ['--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:8080/', { waitUntil: 'load' });
await p.waitForTimeout(900);
await p.evaluate(() => { document.getElementById('enter-btn')?.click(); const l=document.getElementById('loader'); if(l) l.style.display='none'; });
await p.evaluate(() => window.__poonno.snapTo(0.19));
await p.waitForTimeout(2500);
const r = await p.evaluate(() => {
  const o=document.getElementById('news-overlay');
  const w=o&&o.querySelector('.news-wrap');
  const pg=o&&o.querySelector('#news-page-1');
  const cs=el=>el?getComputedStyle(el):null;
  const rect=el=>{const r=el.getBoundingClientRect();return [Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)];};
  return {
    overlay: o? { display:cs(o).display, opacity:cs(o).opacity, filter:cs(o).filter, zIndex:cs(o).zIndex, childCount:o.children.length }: 'no overlay',
    wrap: w? { rect:rect(w), transform:cs(w).transform.slice(0,40) }: 'no wrap',
    page1: pg? { rect:rect(pg), opacity:cs(pg).opacity, mask:cs(pg).webkitMaskImage.slice(0,30), bg:cs(pg).backgroundColor, display:cs(pg).display }: 'no page1',
    img: (()=>{const im=o&&o.querySelector('img');return im?{complete:im.complete,nw:im.naturalWidth,src:im.getAttribute('src')}:'no img';})(),
  };
});
console.log(JSON.stringify(r,null,1));
await b.close();
