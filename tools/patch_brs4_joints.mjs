// patch_brs4_joints.mjs: lets the brs-js 4 writer save JOINT links (a servo / hinge brick holding a moving brick
// grid), which it otherwise writes empty, so the grid loads loose and falls (2026-10-26, Tavistock garage door).
// After it: world.registerJoint(brickHandle, gridHandle, offset {X,Y,Z}, rotation {X,Y,Z,W}); the entity reference
// is the grid's persistent index (2 + entity order), as the game saves it. Idempotent; patch_brs4.mjs runs it.
//   node tools/patch_brs4_joints.mjs [tools/brs4/dist.mjs]
import fs from 'node:fs';
const file = process.argv[1]?.endsWith('patch_brs4_joints.mjs') && process.argv[2] ? process.argv[2] : new URL('./brs4/dist.mjs', import.meta.url);
let s = fs.readFileSync(file, 'utf8');
if (s.includes('__brs4_joints')) console.log('joints already patched');
else {
  const rep = (a, b) => { if (!s.includes(a)) throw new Error('anchor not found: ' + a.slice(0, 60)); s = s.replace(a, b); };
  // component chunk: collect joints
  rep('this.instances = [], this.microchipBrickIndices = [], this.microchipGridReferences = [];',
    'this.instances = [], this.microchipBrickIndices = [], this.microchipGridReferences = [], this.joints = []; /* __brs4_joints */');
  rep('\taddMicrochipLink(e, t) {', '\taddJoint(e, t, n, r) {\n\t\tthis.joints.push([e, t, n, r]);\n\t}\n\taddMicrochipLink(e, t) {');
  rep('\t\t\tJointBrickIndices: [],\n\t\t\tJointEntityReferences: [],\n\t\t\tJointInitialRelativeOffsets: [],\n\t\t\tJointInitialRelativeRotations: [],',
    '\t\t\tJointBrickIndices: this.joints.map((e) => e[0]),\n\t\t\tJointEntityReferences: this.joints.map((e) => e[1]),\n\t\t\tJointInitialRelativeOffsets: this.joints.map((e) => e[2]),\n\t\t\tJointInitialRelativeRotations: this.joints.map((e) => e[3]),');
  // encoder: apply joint links like microchip links
  rep('\tfor (let t of e.microchipLinks) {',
    '\tfor (let t of e.jointLinks ?? []) {\n\t\tlet e = x[t.gridSlot], n = e?.brickLocations[t.brickIndex];\n\t\tif (!n) throw Error(`brdb: joint brick index ${t.brickIndex} out of range`);\n\t\tlet r = e.componentChunks.get(n.key);\n\t\tr || e.componentChunks.set(n.key, r = new js()), r.addJoint(n.localIndex, t.gridReference, t.offset, t.rotation);\n\t}\n\tfor (let t of e.microchipLinks) {');
  // World: registerJoint + pass the links to the encoder
  rep('this.wireList = [], this.chipLinks = [],', 'this.wireList = [], this.chipLinks = [], this.jointList = [],');
  rep('\tregisterMicrochipLink(e, t) {', '\tregisterJoint(e, t, n, r) {\n\t\tthis.jointList.push({ brick: e, grid: t, offset: n, rotation: r });\n\t}\n\tregisterMicrochipLink(e, t) {');
  rep('\t\t\tmicrochipLinks: this.chipLinks.map((e) => ({',
    '\t\t\tjointLinks: this.jointList.map((e) => ({\n\t\t\t\tgridSlot: e.brick.grid,\n\t\t\t\tbrickIndex: e.brick.index,\n\t\t\t\tgridReference: 2 + e.grid.entityOrder,\n\t\t\t\toffset: e.offset,\n\t\t\t\trotation: e.rotation\n\t\t\t})),\n\t\t\tmicrochipLinks: this.chipLinks.map((e) => ({');
  fs.writeFileSync(file, s);
  console.log('joints patched', String(file));
}
