// Keep only meshes whose name matches a regex; drop the rest; prune orphans.
// Used to pull the real train out of the mislabeled "Station.glb".
//   node tools/extract.mjs "<in.glb>" "<out.glb>" "<keepRegex>"
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';

const [, , inPath, outPath, pattern] = process.argv;
const KEEP = new RegExp(pattern, 'i');

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
});
const doc = await io.read(inPath);
const root = doc.getRoot();

let kept = 0, dropped = 0;
for (const node of root.listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  const name = mesh.getName() || node.getName() || '';
  if (KEEP.test(name)) kept++;
  else { node.setMesh(null); dropped++; }
}
await doc.transform(prune(), dedup());
console.log(`kept ${kept}, dropped ${dropped}`);
await io.write(outPath, doc);
console.log('wrote', outPath);
