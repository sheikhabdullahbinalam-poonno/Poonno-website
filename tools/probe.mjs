// Probe the live train: per-car world position + world bounding box (computed
// with plain matrix math, no THREE on window). node tools/probe.mjs [t]
import { chromium } from 'playwright';
const t = parseFloat(process.argv[2] ?? '0.05');
const b = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:8080/', { waitUntil: 'load' });
await p.waitForTimeout(1000);
await p.evaluate(() => { document.getElementById('enter-btn')?.click(); const l = document.getElementById('loader'); if (l) l.style.display = 'none'; });
await p.waitForTimeout(500);
await p.evaluate((tt) => window.__poonno.snapTo(tt), t);
await p.waitForTimeout(4500);
const info = await p.evaluate(() => {
  const tr = window.__poonno?.train; if (!tr) return { err: 'no train' };
  const apply = (e, x, y, z) => [
    e[0]*x + e[4]*y + e[8]*z + e[12],
    e[1]*x + e[5]*y + e[9]*z + e[13],
    e[2]*x + e[6]*y + e[10]*z + e[14],
  ];
  function worldBox(obj) {
    obj.updateMatrixWorld(true);
    let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9], meshes = 0;
    obj.traverse((o) => {
      if (!o.isMesh) return; meshes++;
      const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
      const bb = g.boundingBox, e = o.matrixWorld.elements;
      for (const X of [bb.min.x, bb.max.x]) for (const Y of [bb.min.y, bb.max.y]) for (const Z of [bb.min.z, bb.max.z]) {
        const w = apply(e, X, Y, Z);
        for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], w[k]); mx[k] = Math.max(mx[k], w[k]); }
      }
    });
    return { meshes, min: mn.map(n => +n.toFixed(2)), max: mx.map(n => +n.toFixed(2)), size: mx.map((v, k) => +(v - mn[k]).toFixed(2)) };
  }
  return tr.cars.map((c, i) => ({ i, pos: [c.position.x, c.position.y, c.position.z].map(n => +n.toFixed(2)), box: worldBox(c) }));
});
console.log(JSON.stringify(info, null, 1));
await b.close();
