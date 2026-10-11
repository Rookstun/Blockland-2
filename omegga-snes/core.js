// Loads the SnesJs core (angelo-wf/SnesJs, MIT, files in ./snes) into a vm
// context: the files are browser globals in sloppy mode.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadCore(log = () => {}) {
  const hex = (n, w) => '$' + n.toString(16).padStart(w, '0');
  const ctx = vm.createContext({
    console, Math, Uint8Array, Uint16Array, Int8Array, Int16Array, Uint32Array, Int32Array, Float64Array, Array,
    log: (t) => log(String(t)), clearArray: (a) => a.fill(0),
    getByteRep: (v) => hex(v, 2), getWordRep: (v) => hex(v, 4), getLongRep: (v) => hex(v, 6),
  });
  for (const f of ['cart', 'cpu', 'spc', 'dsp', 'apu', 'pipu', 'snes']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, 'snes', f + '.js'), 'utf8'), ctx, { filename: f + '.js' });
  }
  return ctx;
}

/** Guess LoROM/HiROM from which header has a sane checksum pair. */
function isHirom(rom) {
  const off = rom.length % 0x8000 === 512 ? 512 : 0;
  const score = (b) => {
    if (rom.length < off + b + 0x40) return -1;
    const cc = rom[off + b + 0x1c] | (rom[off + b + 0x1d] << 8);
    const cs = rom[off + b + 0x1e] | (rom[off + b + 0x1f] << 8);
    let s = (cc ^ cs) === 0xffff ? 4 : 0;
    const map = rom[off + b + 0x15];
    if ((map & 0xef) === (b === 0x7fc0 ? 0x20 : 0x21)) s += 2;
    for (let i = 0; i < 21; i++) { const c = rom[off + b + i]; if (c >= 0x20 && c < 0x7f) s += 0.1; }
    return s;
  };
  return score(0xffc0) > score(0x7fc0);
}

module.exports = { loadCore, isHirom };
