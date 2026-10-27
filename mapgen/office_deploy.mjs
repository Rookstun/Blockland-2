// Server-side deploy of Brickwell Tower (mapgen/office.mjs output): ONE job = clear the tower's own owner, then ONE
// bricks op with every brick of DIR/add.json (owner rule: never queue bricks). Rebuild = run it again.
//   scp out_office/add.json + this file to the server, then: node office_deploy.mjs DIR
import fs from 'fs';
import path from 'path';
const root = path.join(process.env.HOME, 'omegga-server/bridge'), dir = path.resolve(process.argv[2] || '.');
const OWNER = { id: 'c1770000-0000-4b0b-9a11-0000000ff1ce', name: 'Brickwell Tower' };
const { bricks, externalAssets } = JSON.parse(fs.readFileSync(path.join(dir, 'add.json'), 'utf8'));
const id = Date.now() + '_office.json';
fs.writeFileSync(path.join(root, 'inbox', id + '.tmp'), JSON.stringify({ ops: [
  { op: 'cmd', line: `br.Bricks.Clear ${OWNER.id} 1`, captureMs: 0 },
  { op: 'bricks', at: [0, 0, 0], owner: OWNER, captureMs: 0, externalAssets, bricks },
] }));
fs.renameSync(path.join(root, 'inbox', id + '.tmp'), path.join(root, 'inbox', id));
console.log('sent', bricks.length, 'bricks in one op:', id);
