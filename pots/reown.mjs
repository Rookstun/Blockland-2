// Re-owns a prefab: every owner row becomes the server owner (renderman /
// soapstain22, Admin+Owner), so its gates may do admin things (spawn money).
//   node reown.mjs in.brz out.brz
import fs from 'fs';
import * as brs from '../mapgen/lib/brs.mjs';
export const OWNER = { id: '891c4675-d18a-4ce1-a465-f4193ffe8b39', name: 'soapstain22', display: 'renderman' };
const uuid = s => { const h = s.replace(/-/g, ''); return { A: parseInt(h.slice(0, 8), 16), B: parseInt(h.slice(8, 16), 16), C: parseInt(h.slice(16, 24), 16), D: parseInt(h.slice(24, 32), 16) }; };
export function reown(bytes) {
  const r = brs.WorldReader.from(Buffer.from(bytes)), X = r.fs;
  const node = id => { const children = [];
    X.folderNames.forEach((nm, i) => { if (X.folderParentIds[i] === id) children.push([nm, node(i)]); });
    X.fileNames.forEach((nm, i) => { if (X.fileParentIds[i] === id) children.push([nm, { type: 'file', content: X.fileContentIds[i] < 0 ? new Uint8Array(0) : X.readBlob(X.fileContentIds[i]) }]); });
    return { type: 'folder', children }; };
  const tree = node(-1).children;
  const find = p => p.split('/').reduce((t, h, i, a) => { const e = t.find(([nm]) => nm === h)[1]; return i === a.length - 1 ? e : e.children; }, tree);
  const o = r.owners();
  o.UserIds = o.UserIds.map(() => uuid(OWNER.id));
  o.UserNames = o.UserNames.map(() => OWNER.name);
  o.DisplayNames = o.DisplayNames.map(() => OWNER.display);
  find(r.path('Owners.mps')).content = r.schema(r.path('Owners.schema')).encode('BRSavedOwnerTableSoA', o);
  return brs.brdb.writeBrzContainer(tree);
}
if (process.argv[1].endsWith('reown.mjs')) {
  const [src, dst] = process.argv.slice(2);
  fs.writeFileSync(dst, reown(fs.readFileSync(src)));
  console.log(dst, JSON.stringify(brs.WorldReader.from(fs.readFileSync(dst)).owners().DisplayNames));
}
