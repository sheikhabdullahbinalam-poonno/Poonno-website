// Keep only meshes whose world centroid is within a horizontal radius of an
// anchor mesh (matched by name regex). Used to isolate one tree from a GLB that
// scatters several. node tools/extract-near.mjs <in> <out> <anchorRegex> <radius>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';

const [, , inPath, outPath, anchorPat, radiusStr] = process.argv;
const ANCHOR = new RegExp(anchorPat, 'i');
const R = parseFloat(radiusStr || '16');

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
});
const doc = await io.read(inPath);
const root = doc.getRoot();

// World-space centroid of a node's mesh (mean of primitive position-accessor mins/maxes).
function centroid(node) {
  const mesh = node.getMesh(); if (!mesh) return null;
  const wm = node.getWorldMatrix();
  let cx = 0, cy = 0, cz = 0, n = 0;
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION'); if (!pos) continue;
    const min = pos.getMin([]), max = pos.getMax([]);
    const lx = (min[0] + max[0]) / 2, ly = (min[1] + max[1]) / 2, lz = (min[2] + max[2]) / 2;
    // apply world matrix (column-major)
    const e = wm;
    cx += e[0]*lx + e[4]*ly + e[8]*lz + e[12];
    cy += e[1]*lx + e[5]*ly + e[9]*lz + e[13];
    cz += e[2]*lx + e[6]*ly + e[10]*lz + e[14];
    n++;
  }
  return n ? [cx/n, cy/n, cz/n] : null;
}

const nodes = root.listNodes().filter(nd => nd.getMesh());
let anchor = null;
for (const nd of nodes) {
  const name = nd.getMesh().getName() || nd.getName() || '';
  if (ANCHOR.test(name)) { anchor = centroid(nd); break; }
}
if (!anchor) { console.error('anchor not found'); process.exit(1); }

let kept = 0, dropped = 0;
for (const nd of nodes) {
  const c = centroid(nd);
  const d = c ? Math.hypot(c[0] - anchor[0], c[2] - anchor[2]) : 1e9;
  if (d <= R) kept++;
  else { nd.setMesh(null); dropped++; }
}
await doc.transform(prune(), dedup());
console.log(`anchor @ ${anchor.map(v => v.toFixed(1))}, kept ${kept}, dropped ${dropped}`);
await io.write(outPath, doc);
