// brickdoom/view.mjs: renders bdrow dumps (24 columns of '██' pairs) to a PNG. node brickdoom/view.mjs log out.png [scale]
import fs from 'node:fs';
import { parseRow, png } from '../arcade_LEGACY_BROKEN_DO_NOT_USE/mildorsplume/view.mjs';
import { PAL } from './gen.mjs';
const [file, out, scale] = process.argv.slice(2);
const blocks = [];
for (const line of fs.readFileSync(file, 'utf8').split('\n')) { const m = /bdrow\|(\d+)\|(.*)$/.exec(line); if (m) blocks.push([+m[1], parseRow(m[2].replace(/\r$/, ''), PAL[0])]); }
// keep the last complete dump
const rows = []; for (const [r, cells] of blocks) rows[r] = cells.length === 48 ? cells : cells.concat(Array(48).fill('ff00ff')).slice(0, 48);
fs.writeFileSync(out, png(rows, +(scale ?? 8)));
console.log('wrote', out, rows.filter(Boolean).length, 'rows');
