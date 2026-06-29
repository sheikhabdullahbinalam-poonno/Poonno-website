import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true, args: ['--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1000, height: 600 } });
await p.goto('http://localhost:8080/', { waitUntil: 'load' });
await p.waitForTimeout(900);
await p.evaluate(() => { document.getElementById('enter-btn')?.click(); const l=document.getElementById('loader'); if(l) l.style.display='none'; });
await p.evaluate(() => window.__poonno.snapTo(1.0));
await p.waitForTimeout(3000);
const r = await p.evaluate(() => {
  const c=document.getElementById('contact');
  // which rules set opacity?
  const rules=[];
  for (const sheet of document.styleSheets) { try { for (const rule of sheet.cssRules) { if (rule.selectorText && /#contact(\.show)?$/.test(rule.selectorText) && rule.style.opacity!=='') rules.push(rule.selectorText+' => opacity:'+rule.style.opacity); } } catch(e){} }
  return { tNow: window.__poonno && 'see hud', inlineOpacity: c.style.opacity, classes:[...c.classList], computed: getComputedStyle(c).opacity, rules, hudT: document.getElementById('hud-t')?.textContent };
});
console.log(JSON.stringify(r,null,1));
await b.close();
