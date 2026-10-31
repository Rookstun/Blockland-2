import { runRom } from './blargg.mjs';
for (const p of process.argv.slice(2)) console.log(p, JSON.stringify(runRom(p)));
