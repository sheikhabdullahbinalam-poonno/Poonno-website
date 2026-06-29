// Screenshot the standalone model viewer (tools/view.html).
//   node tools/vshot.mjs "<modelPath>" <out.png> [yaw] [pitch]
import { chromium } from 'playwright';
const [, , model, out = '/tmp/v.png', yaw = '0.7', pitch = '0.5'] = process.argv;
const b = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1100, height: 720 } });
const errs = [];
p.on('pageerror', e => errs.push(e.message));
const url = `http://localhost:8080/tools/view.html?m=${encodeURIComponent(model)}&yaw=${yaw}&pitch=${pitch}`;
await p.goto(url, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ready === true, { timeout: 25000 }).catch(() => {});
await p.waitForTimeout(1500);
const info = await p.evaluate(() => document.getElementById('info').textContent);
await p.screenshot({ path: out });
await b.close();
console.log(info);
if (errs.length) console.log('ERR:', errs.join(' | '));
