// node nes/tests/blargg.mjs ROM... : runs blargg-protocol test ROMs ($6000 status, $6001-3 = DE B0 61, text at $6004)
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { NES } from '../src/nes.mjs';

export function runRom(path, maxFrames = 60 * 60) {
  const nes = new NES(new Uint8Array(readFileSync(path))), r = a => nes.cart.ram[a - 0x6000];
  let resetAt = -1;
  for (let f = 0; f < maxFrames; f++) {
    nes.frame();
    const valid = r(0x6001) === 0xde && r(0x6002) === 0xb0 && r(0x6003) === 0x61;
    if (!valid) continue;
    const st = r(0x6000);
    if (st === 0x81 && resetAt < 0) resetAt = f + 6; // test asks for a reset after >= 100 ms
    if (resetAt >= 0 && f === resetAt) { nes.reset(); resetAt = -1; continue; }
    if (st < 0x80) {
      let t = ''; for (let a = 0x6004; a < 0x8000 && r(a); a++) t += String.fromCharCode(r(a));
      return { status: st, text: t.trim(), frames: f };
    }
  }
  return { status: -1, text: 'no result (no $6000 protocol or timeout)', frames: maxFrames };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  let bad = 0;
  for (const p of process.argv.slice(2)) {
    let res; try { res = runRom(p); } catch (e) { res = { status: -2, text: String(e.stack).split('\n').slice(0, 3).join(' | ') }; }
    if (res.status !== 0) bad++;
    console.log(`${res.status === 0 ? 'PASS' : 'FAIL'} ${p.replace(/.*roms\//, '')} [${res.status}] ${res.text.split('\n').slice(-3).join(' / ').slice(0, 200)}`);
  }
  process.exit(bad ? 1 : 0);
}
