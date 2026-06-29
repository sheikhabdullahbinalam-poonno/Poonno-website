// List meshes in a GLB by triangle count (desc), with material name, to reveal
// what each messy Sketchfab export actually contains.
//   node tools/dump.mjs "<file.glb>"
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
});
const doc = await io.read(process.argv[2]);
const root = doc.getRoot();
const rows = [];
for (const node of root.listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  let tris = 0, mats = new Set();
  for (const p of mesh.listPrimitives()) {
    const idx = p.getIndices();
    tris += (idx ? idx.getCount() : (p.getAttribute('POSITION')?.getCount() || 0)) / 3;
    if (p.getMaterial()) mats.add(p.getMaterial().getName());
  }
  rows.push({ name: mesh.getName() || node.getName() || '(unnamed)', tris: Math.round(tris), mats: [...mats].join(',') });
}
rows.sort((a, b) => b.tris - a.tris);
let total = 0;
for (const r of rows) { total += r.tris; console.log(`${String(r.tris).padStart(9)}  ${r.name.slice(0,40).padEnd(42)} ${r.mats.slice(0,38)}`); }
console.log(`--- ${rows.length} meshes, ${total.toLocaleString()} tris total ---`);
