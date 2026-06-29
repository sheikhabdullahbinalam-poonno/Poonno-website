// Headless visual verification: load the running site, optionally snap to a
// scroll position t (0..1) via window.__poonno, and save a screenshot.
//   node tools/shot.mjs <t> <outfile.png> [width] [height] [waitMs]
// Requires the Bash server running on :8080.
import { chromium } from 'playwright';

const t = parseFloat(process.argv[2] ?? '0');
const out = process.argv[3] ?? `/tmp/shot_${t}.png`;
const W = parseInt(process.argv[4] ?? '1280', 10);
const H = parseInt(process.argv[5] ?? '720', 10);
const waitMs = parseInt(process.argv[6] ?? '2500', 10);

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto('http://localhost:8080/', { waitUntil: 'load', timeout: 30000 });
// Dismiss the loader/Enter gate so the scene is visible, then snap to t.
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const enter = document.getElementById('enter-btn'); if (enter) enter.click();
  const ld = document.getElementById('loader'); if (ld) ld.style.display = 'none';
});
await page.waitForTimeout(400);
await page.evaluate((tt) => { window.__poonno && window.__poonno.snapTo && window.__poonno.snapTo(tt); }, t);
// Optional camera freeze: SHOT_FREEZE="px,py,pz,lx,ly,lz"
if (process.env.SHOT_FREEZE) {
  const f = process.env.SHOT_FREEZE.split(',').map(Number);
  await page.evaluate((f) => window.__poonno?.freeze?.(...f), f);
}
// Optional arbitrary JS to run in-page before the shot.
if (process.env.SHOT_EVAL) await page.evaluate(process.env.SHOT_EVAL);
await page.waitForTimeout(waitMs);

// Report WebGL capability + renderer string.
const gl = await page.evaluate(() => {
  const c = document.createElement('canvas');
  const g = c.getContext('webgl2') || c.getContext('webgl');
  if (!g) return 'NO WEBGL';
  const dbg = g.getExtension('WEBGL_debug_renderer_info');
  return dbg ? g.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'webgl ok (renderer masked)';
});
await page.screenshot({ path: out });
await browser.close();
console.log(`t=${t} → ${out}  | WebGL: ${gl}`);
if (errors.length) console.log('CONSOLE ERRORS:\n' + errors.slice(0, 12).join('\n'));
