// nes/src/cart.mjs: iNES / NES 2.0 loader + mappers 0 NROM, 1 MMC1, 2 UxROM, 3 CNROM, 4 MMC3, 7 AxROM, 66 GxROM.
export class Cart {
  constructor(nes, rom) {
    this.nes = nes; this.irq = false; this.watchA12 = false;
    if (rom[0] !== 0x4e || rom[1] !== 0x45 || rom[2] !== 0x53 || rom[3] !== 0x1a) throw Error('not an iNES file');
    const f6 = rom[6], f7 = rom[7], v2 = (f7 & 0x0c) === 8;
    this.mapperId = (f7 & 0xf0) | f6 >> 4 | (v2 ? (rom[8] & 15) << 8 : 0);
    let prgSize = rom[4] * 0x4000, chrSize = rom[5] * 0x2000;
    if (v2) { prgSize = (rom[4] | (rom[9] & 15) << 8) * 0x4000; chrSize = (rom[5] | (rom[9] >> 4) << 8) * 0x2000; }
    let o = 16 + ((f6 & 4) ? 512 : 0);
    this.prg = rom.slice(o, o + prgSize); o += prgSize;
    this.chrRam = chrSize === 0;
    this.chr = this.chrRam ? new Uint8Array(v2 && rom[11] & 15 ? 64 << (rom[11] & 15) : 0x2000) : rom.slice(o, o + chrSize);
    this.ram = new Uint8Array(0x2000);
    this.fourScreen = !!(f6 & 8);
    this.hMirror = !(f6 & 1);
    const M = { 0: NROM, 1: MMC1, 2: UxROM, 3: CNROM, 4: MMC3, 7: AxROM, 66: GxROM }[this.mapperId];
    if (!M) throw Error('unsupported mapper ' + this.mapperId);
    this.m = new M(this);
    // optional hooks straight on the cart
    if (this.m.cpuTick) this.cpuTick = () => this.m.cpuTick();
    if (this.m.a12) { this.watchA12 = true; this.a12 = (a, d) => this.m.a12(a, d); }
  }
  power() {
    this.irq = false;
    this.nes.ppu.mirror(this.fourScreen ? [0, 1, 2, 3] : this.hMirror ? [0, 0, 1, 1] : [0, 1, 0, 1]);
    this.m.power();
  }
  cpuRead(a) {
    if (a >= 0x8000) return this.m.prgRead(a);
    if (a >= 0x6000) return this.ram[a & 0x1fff];
    return -1;
  }
  cpuWrite(a, v) {
    if (a >= 0x8000) this.m.prgWrite(a, v);
    else if (a >= 0x6000) this.ram[a & 0x1fff] = v;
  }
  ppuRead(a) { return this.chr[this.m.chrAddr(a)]; }
  ppuWrite(a, v) { if (this.chrRam) this.chr[this.m.chrAddr(a)] = v; }
}

const mod = (a, n) => ((a % n) + n) % n;
class Base {
  constructor(c) { this.c = c; this.nprg16 = Math.max(1, c.prg.length >> 14); this.nprg8 = c.prg.length >> 13; this.nchr1 = Math.max(1, c.chr.length >> 10); }
  power() { }
  prgRead(a) { return this.c.prg[this.prgAddr(a)]; }
  chrAddr(a) { return a; }
}
class NROM extends Base {
  prgAddr(a) { return (a - 0x8000) % this.c.prg.length; }
  prgWrite() { }
}
class UxROM extends Base {
  power() { this.bank = 0; }
  prgAddr(a) { return a < 0xc000 ? mod(this.bank, this.nprg16) << 14 | (a & 0x3fff) : (this.nprg16 - 1) << 14 | (a & 0x3fff); }
  prgWrite(a, v) { this.bank = v; }
}
class CNROM extends NROM {
  power() { this.bank = 0; }
  chrAddr(a) { return mod(this.bank, this.nchr1 >> 3 || 1) << 13 | a; }
  prgWrite(a, v) { this.bank = v; }
}
class GxROM extends Base {
  power() { this.pb = 0; this.cb = 0; }
  prgAddr(a) { return mod(this.pb, this.c.prg.length >> 15 || 1) << 15 | (a & 0x7fff); }
  chrAddr(a) { return mod(this.cb, this.nchr1 >> 3 || 1) << 13 | a; }
  prgWrite(a, v) { this.pb = v >> 4 & 3; this.cb = v & 3; }
}
class AxROM extends Base {
  power() { this.bank = 0; this.c.nes.ppu.mirror([0, 0, 0, 0]); }
  prgAddr(a) { return mod(this.bank, this.c.prg.length >> 15 || 1) << 15 | (a & 0x7fff); }
  prgWrite(a, v) { this.bank = v & 7; const m = v & 16 ? 1 : 0; this.c.nes.ppu.mirror([m, m, m, m]); }
}
class MMC1 extends Base {
  power() { this.sr = 0x10; this.ctl = 0x0c; this.chr0 = 0; this.chr1 = 0; this.prgB = 0; this.last = -9; this.mirrorSet(); }
  mirrorSet() { this.c.nes.ppu.mirror([[0, 0, 0, 0], [1, 1, 1, 1], [0, 1, 0, 1], [0, 0, 1, 1]][this.ctl & 3]); }
  prgAddr(a) {
    const mode = this.ctl >> 2 & 3, b = this.prgB & 15;
    let bank;
    if (mode < 2) bank = (b & ~1) + (a >> 14 & 1);
    else if (mode === 2) bank = a < 0xc000 ? 0 : b;
    else bank = a < 0xc000 ? b : this.nprg16 - 1;
    return mod(bank, this.nprg16) << 14 | (a & 0x3fff);
  }
  chrAddr(a) {
    if (this.ctl & 0x10) return mod(a < 0x1000 ? this.chr0 : this.chr1, this.nchr1 >> 2 || 1) << 12 | (a & 0xfff);
    return mod(this.chr0 >> 1, this.nchr1 >> 3 || 1) << 13 | a;
  }
  prgWrite(a, v) {
    const now = this.c.nes.cpu.cycles;
    if (now - this.last < 2) { this.last = now; return; } // consecutive-cycle writes (RMW) are ignored
    this.last = now;
    if (v & 0x80) { this.sr = 0x10; this.ctl |= 0x0c; this.mirrorSet(); return; }
    const done = this.sr & 1;
    this.sr = this.sr >> 1 | (v & 1) << 4;
    if (!done) return;
    const r = this.sr; this.sr = 0x10;
    switch (a >> 13 & 3) {
      case 0: this.ctl = r; this.mirrorSet(); break;
      case 1: this.chr0 = r; break;
      case 2: this.chr1 = r; break;
      case 3: this.prgB = r; break;
    }
  }
}
class MMC3 extends Base {
  power() {
    this.regs = [0, 2, 4, 5, 6, 7, 0, 1]; this.sel = 0; this.latch = 0; this.counter = 0; this.reload = false; this.irqOn = false;
    this.a12hi = false; this.lowSince = 0; this.c.irq = false;
  }
  prgAddr(a) {
    const swap = this.sel & 0x40, r6 = this.regs[6] & 0x3f, r7 = this.regs[7] & 0x3f;
    let b;
    switch (a >> 13 & 3) {
      case 0: b = swap ? this.nprg8 - 2 : r6; break;
      case 1: b = r7; break;
      case 2: b = swap ? r6 : this.nprg8 - 2; break;
      default: b = this.nprg8 - 1;
    }
    return mod(b, this.nprg8) << 13 | (a & 0x1fff);
  }
  chrAddr(a) {
    const r = this.regs; let b = (a >> 10) & 7;
    if (this.sel & 0x80) b ^= 4;
    let bank;
    if (b < 4) bank = (b & 2 ? r[1] : r[0]) & ~1 | (b & 1); else bank = r[b - 2];
    return mod(bank, this.nchr1) << 10 | (a & 0x3ff);
  }
  prgWrite(a, v) {
    const odd = a & 1;
    switch (a >> 13 & 3) {
      case 0: if (!odd) this.sel = v; else this.regs[this.sel & 7] = v; break;
      case 1: if (!odd && !this.c.fourScreen) this.c.nes.ppu.mirror(v & 1 ? [0, 0, 1, 1] : [0, 1, 0, 1]); break;
      case 2: if (!odd) this.latch = v; else { this.reload = true; this.counter = 0; } break;
      case 3: if (!odd) { this.irqOn = false; this.c.irq = false; } else this.irqOn = true; break;
    }
  }
  a12(addr, dots) {
    const hi = (addr & 0x1000) !== 0;
    if (hi && !this.a12hi && dots - this.lowSince >= 10) this.clock();
    if (!hi && this.a12hi) this.lowSince = dots;
    this.a12hi = hi;
  }
  clock() {
    if (this.counter === 0 || this.reload) this.counter = this.latch; else this.counter--;
    this.reload = false;
    if (this.counter === 0 && this.irqOn) this.c.irq = true;
  }
}
