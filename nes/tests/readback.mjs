// node nes/tests/readback.mjs saved.brz : print the picture the cabinet's strip text displays hold (block colours -> NES hex rows)
import fs from 'node:fs';
const m = await import(new URL('../../tools/brs4/dist.mjs', import.meta.url));
const r = m.WorldReader.from(fs.readFileSync(process.argv[2]));
const texts = [];
for (const c of r.components(1)) { const t = c.data?.Text ?? c.Text; if (typeof t === 'string' && t.includes('█')) texts.push(t); }
console.log('strips with blocks', texts.length);
for (const t of texts.slice(0, 2)) console.log(t.slice(0, 400).replace(/\n/g, '\n'));
