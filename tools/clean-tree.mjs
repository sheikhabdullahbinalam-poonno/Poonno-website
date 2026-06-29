// Strip stray (accidentally-merged) train geometry out of a Sketchfab tree GLB,
// keeping only the actual tree meshes, then prune orphans. Output is an
// intermediate GLB to be run through `gltf-transform optimize` afterwards.
//
//   node tools/clean-tree.mjs "<input.glb>" "<output.glb>"
//
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup } from '@gltf-transform/functions';

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) { console.error('usage: clean-tree.mjs in out'); process.exit(1); }

// A mesh is "train" if its name matches the locomotive's naming scheme.
const TRAIN_RE = /^(Body_Train|pCube|pCylinder|polySurface|Sakura_Bark001_2K)/i;
// Keep tree meshes: Object_*, Leaves, Sakura_Sakura (foliage), Bark/Trunk, etc.
const isTrain = (name = '') => TRAIN_RE.test(name);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(inPath);
const root = doc.getRoot();

let kept = 0, dropped = 0, keptTris = 0, dropTris = 0;
const triCount = (mesh) => mesh.listPrimitives().reduce((n, p) => {
  const idx = p.getIndices();
  return n + (idx ? idx.getCount() : (p.getAttribute('POSITION')?.getCount() || 0)) / 3;
}, 0);

// Disconnect nodes whose mesh is train geometry.
for (const node of root.listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  const name = mesh.getName() || node.getName() || '';
  const tris = triCount(mesh);
  if (isTrain(name)) { node.setMesh(null); dropped++; dropTris += tris; }
  else { kept++; keptTris += tris; }
}

await doc.transform(prune(), dedup());

console.log(`kept ${kept} meshes (${Math.round(keptTris).toLocaleString()} tris), ` +
            `dropped ${dropped} train meshes (${Math.round(dropTris).toLocaleString()} tris)`);
await io.write(outPath, doc);
console.log('wrote', outPath);
