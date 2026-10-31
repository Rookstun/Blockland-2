// nes/src/ppu.mjs: dot-stepped 2C02 (341 x 262), loopy scroll registers, shift-register background, sprites rendered per line.
// state (scanline, cycle) = the NEXT dot to process; the CPU calls tick() three times per CPU cycle.
export const PALETTE = new Uint32Array([
  0x666666, 0x002A88, 0x1412A7, 0x3B00A4, 0x5C007E, 0x6E0040, 0x6C0600, 0x561D00, 0x333500, 0x0B4800, 0x005200, 0x004F08, 0x00404D, 0x000000, 0x000000, 0x000000,
  0xADADAD, 0x155FD9, 0x4240FF, 0x7527FE, 0xA01ACC, 0xB71E7B, 0xB53120, 0x994E00, 0x6B6D00, 0x388700, 0x0D9300, 0x008F32, 0x007C8D, 0x000000, 0x000000, 0x000000,
  0xFFFEFF, 0x64B0FF, 0x9290FF, 0xC676FF, 0xF36AFF, 0xFE6ECC, 0xFE8170, 0xEA9E22, 0xBCBE00, 0x88D800, 0x5CE430, 0x45E082, 0x48CDDE, 0x4F4F4F, 0x000000, 0x000000,
  0xFFFEFF, 0xC0DFFF, 0xD3D2FF, 0xE8C8FF, 0xFBC2FF, 0xFEC4EA, 0xFECCC5, 0xF7D8A5, 0xE4E594, 0xCFEF96, 0xBDF4AB, 0xB3F3CC, 0xB5EBF2, 0xB8B8B8, 0x000000, 0x000000,
].map(c => (0xff000000 | (c & 0xff) << 16 | (c >> 8 & 0xff) << 8 | c >> 16) >>> 0)); // ABGR for ImageData

const REV = new Uint8Array(256).map((_, b) => { let r = 0; for (let k = 0; k < 8; k++) r |= (b >> k & 1) << (7 - k); return r; });

export class PPU {
  constructor(nes) {
    this.nes = nes;
    this.fb = new Uint32Array(256 * 240);
    this.vram = new Uint8Array(4096); this.pal = new Uint8Array(32); this.oam = new Uint8Array(256);
    this.spr = new Uint8Array(256); this.sprNext = new Uint8Array(256);
    this.sec = []; // up to 8 sprites picked for the next line: [oamIndex, y, tile, attr, x]
    this.nt = [0, 1, 0, 1];
  }
  power() {
    this.ctrl = this.mask = 0; this.vbl = this.spr0 = this.ovf = false; this.nmiLine = 0;
    this.oamAddr = 0; this.v = this.t = this.fineX = 0; this.w = 0; this.buf = 0; this.latch = 0;
    this.scanline = 0; this.cycle = 0; this.odd = 0; this.frames = 0; this.preventVbl = false;
    this.bgLo = this.bgHi = this.atLo = this.atHi = 0; this.ntByte = this.atByte = this.tileLo = this.tileHi = 0;
    this.dots = 0; this.onFrame = null;
  }
  mirror(map) { this.nt = map; }

  // ---- bus ----
  read(a) {
    a &= 0x3fff;
    if (a < 0x2000) return this.nes.cart.ppuRead(a);
    if (a < 0x3f00) return this.vram[this.nt[a >> 10 & 3] << 10 | (a & 0x3ff)];
    a &= 0x1f; if ((a & 3) === 0) a &= 0x0f;
    return this.pal[a];
  }
  write(a, v) {
    a &= 0x3fff;
    if (a < 0x2000) this.nes.cart.ppuWrite(a, v);
    else if (a < 0x3f00) this.vram[this.nt[a >> 10 & 3] << 10 | (a & 0x3ff)] = v;
    else { a &= 0x1f; if ((a & 3) === 0) a &= 0x0f; this.pal[a] = v & 0x3f; }
  }
  // fetch during rendering: tells the mapper about the address bus (MMC3 counts A12 edges)
  fetch(a) {
    const c = this.nes.cart;
    if (c.watchA12) c.a12(a, this.dots);
    return a < 0x2000 ? c.ppuRead(a) : this.vram[this.nt[a >> 10 & 3] << 10 | (a & 0x3ff)];
  }
  setV(v) { this.v = v; if (this.nes.cart.watchA12) this.nes.cart.a12(v & 0x3fff, this.dots); }

  readReg(r) {
    switch (r) {
      case 2: {
        const val = (this.vbl ? 0x80 : 0) | (this.spr0 ? 0x40 : 0) | (this.ovf ? 0x20 : 0) | (this.latch & 0x1f);
        if (this.scanline === 241 && this.cycle === 1) this.preventVbl = true; // read one dot before the flag: sees 0, suppresses it
        this.vbl = false; this.w = 0; this.updateNmi();
        return this.latch = val;
      }
      case 4: {
        if ((this.mask & 0x18) && (this.scanline < 240 || this.scanline === 261) && this.cycle >= 1 && this.cycle <= 64) return this.latch = 0xff;
        let v = this.oam[this.oamAddr]; if ((this.oamAddr & 3) === 2) v &= 0xe3;
        return this.latch = v;
      }
      case 7: {
        let v;
        const a = this.v & 0x3fff;
        if (a >= 0x3f00) { v = (this.read(a) & 0x3f) | (this.latch & 0xc0); this.buf = this.vram[this.nt[a >> 10 & 3] << 10 | (a & 0x3ff)]; }
        else { v = this.buf; this.buf = this.read(a); }
        this.setV((this.v + ((this.ctrl & 4) ? 32 : 1)) & 0x7fff);
        return this.latch = v;
      }
    }
    return this.latch;
  }
  writeReg(r, v) {
    this.latch = v;
    switch (r) {
      case 0:
        this.ctrl = v; this.t = (this.t & ~0xc00) | (v & 3) << 10; this.updateNmi(); break;
      case 1: this.mask = v; break;
      case 3: this.oamAddr = v; break;
      case 4:
        if ((this.mask & 0x18) && (this.scanline < 240 || this.scanline === 261)) { this.oamAddr = (this.oamAddr + 4) & 255; break; }
        this.oam[this.oamAddr] = v; this.oamAddr = (this.oamAddr + 1) & 255; break;
      case 5:
        if (!this.w) { this.fineX = v & 7; this.t = (this.t & ~0x1f) | v >> 3; }
        else this.t = (this.t & ~0x73e0) | (v & 7) << 12 | (v >> 3) << 5;
        this.w ^= 1; break;
      case 6:
        if (!this.w) this.t = (this.t & 0xff) | (v & 0x3f) << 8;
        else { this.t = (this.t & 0x7f00) | v; this.setV(this.t); }
        this.w ^= 1; break;
      case 7:
        this.write(this.v, v);
        this.setV((this.v + ((this.ctrl & 4) ? 32 : 1)) & 0x7fff); break;
    }
  }
  updateNmi() { this.nmiLine = (this.vbl && (this.ctrl & 0x80)) ? 1 : 0; }

  // ---- rendering ----
  incX() {
    if ((this.v & 0x1f) === 31) this.v = (this.v & ~0x1f) ^ 0x400; else this.v++;
  }
  incY() {
    let v = this.v;
    if ((v & 0x7000) !== 0x7000) v += 0x1000;
    else {
      v &= ~0x7000; let y = (v & 0x3e0) >> 5;
      if (y === 29) { y = 0; v ^= 0x800; } else if (y === 31) y = 0; else y++;
      v = (v & ~0x3e0) | y << 5;
    }
    this.v = v;
  }
  evalSprites(sl) {
    const h = (this.ctrl & 0x20) ? 16 : 8, oam = this.oam, sec = this.sec; sec.length = 0;
    for (let n = 0; n < 64; n++) {
      const y = oam[n * 4], d = sl - y;
      if (d >= 0 && d < h) {
        if (sec.length < 8) sec.push([n, d, oam[n * 4 + 1], oam[n * 4 + 2], oam[n * 4 + 3]]);
        else { this.ovf = true; break; }
      }
    }
  }
  pixel(x, y) {
    const m = this.mask; let bg = 0, bp = 0;
    if ((m & 8) && (x >= 8 || (m & 2))) {
      const b = 0x8000 >> this.fineX;
      bg = (this.bgHi & b ? 2 : 0) | (this.bgLo & b ? 1 : 0);
      bp = (this.atHi & b ? 2 : 0) | (this.atLo & b ? 1 : 0);
    }
    const s = ((m & 0x10) && (x >= 8 || (m & 4))) ? this.spr[x] : 0;
    if (s & 0x20 && bg && x !== 255) this.spr0 = true;
    let c;
    if (s && (!bg || !(s & 0x40))) c = this.pal[0x10 | (s & 15)];
    else if (bg) c = this.pal[bp << 2 | bg];
    else c = this.pal[0];
    this.fb[y * 256 + x] = PALETTE[(m & 1) ? c & 0x30 : c];
  }
  spriteFetch(i, hi) {
    const tall = this.ctrl & 0x20, e = this.sec[i];
    let tile = 0xff, row = 0, attr = 0;
    if (e) { tile = e[2]; row = e[1]; attr = e[3]; if (attr & 0x80) row = (tall ? 15 : 7) - row; }
    let a;
    if (tall) { const tbl = (tile & 1) << 12; tile &= 0xfe; if (row >= 8) { tile++; row -= 8; } a = tbl | tile << 4 | row; }
    else a = ((this.ctrl & 8) ? 0x1000 : 0) | tile << 4 | row;
    const byte = this.fetch(a | (hi ? 8 : 0));
    if (!e) return;
    if (!hi) { e.lo = byte; return; }
    let lo = e.lo, h = byte;
    if (attr & 0x40) { // flip horizontally
      lo = REV[lo]; h = REV[h];
    }
    const flags = 0x80 | (attr & 0x20 ? 0x40 : 0) | (e[0] === 0 ? 0x20 : 0) | (attr & 3) << 2, out = this.sprNext;
    for (let px = 0; px < 8; px++) {
      const x = e[4] + px; if (x > 255) break;
      const c = (lo >> (7 - px) & 1) | (h >> (7 - px) & 1) << 1;
      if (c && !out[x]) out[x] = flags | c;
    }
  }
  tick() {
    const sl = this.scanline, cy = this.cycle, rend = this.mask & 0x18;
    this.dots++;
    if (sl < 240 || sl === 261) {
      const pre = sl === 261;
      if (cy === 0 && !pre) { const t = this.spr; this.spr = this.sprNext; this.sprNext = t; }
      if (cy === 0 && pre) { this.spr.fill(0); }
      if (!pre && cy >= 1 && cy <= 256) {
        if (rend) this.pixel(cy - 1, sl);
        else this.fb[sl * 256 + cy - 1] = PALETTE[this.pal[(this.v & 0x3f00) === 0x3f00 ? this.v & 0x1f : 0] & ((this.mask & 1) ? 0x30 : 0x3f)];
      }
      if (rend) {
        if ((cy >= 2 && cy <= 257) || (cy >= 322 && cy <= 337)) {
          this.bgLo = this.bgLo << 1 & 0xffff; this.bgHi = this.bgHi << 1 & 0xffff;
          this.atLo = this.atLo << 1 & 0xffff; this.atHi = this.atHi << 1 & 0xffff;
        }
        if ((cy >= 1 && cy <= 256) || (cy >= 321 && cy <= 337)) {
          const ph = (cy - 1) & 7;
          if (ph === 0) {
            this.bgLo = (this.bgLo & 0xff00) | this.tileLo; this.bgHi = (this.bgHi & 0xff00) | this.tileHi;
            this.atLo = (this.atLo & 0xff00) | (this.atByte & 1 ? 0xff : 0); this.atHi = (this.atHi & 0xff00) | (this.atByte & 2 ? 0xff : 0);
            this.ntByte = this.fetch(0x2000 | (this.v & 0xfff));
          } else if (ph === 2) {
            const v = this.v;
            let at = this.fetch(0x23c0 | (v & 0xc00) | (v >> 4 & 0x38) | (v >> 2 & 7));
            if (v >> 5 & 2) at >>= 4; if (v & 2) at >>= 2;
            this.atByte = at & 3;
          } else if (ph === 4) {
            this.tileLo = this.fetch(((this.ctrl & 0x10) ? 0x1000 : 0) | this.ntByte << 4 | (this.v >> 12 & 7));
          } else if (ph === 6) {
            this.tileHi = this.fetch(((this.ctrl & 0x10) ? 0x1000 : 0) | this.ntByte << 4 | (this.v >> 12 & 7) | 8);
          } else if (ph === 7) this.incX();
        }
        if (cy === 256) this.incY();
        else if (cy === 257) {
          this.bgLo = (this.bgLo & 0xff00) | this.tileLo; this.bgHi = (this.bgHi & 0xff00) | this.tileHi;
          this.v = (this.v & ~0x41f) | (this.t & 0x41f);
        }
        if (cy === 256 && !pre) this.evalSprites(sl);
        if (cy >= 257 && cy <= 320) {
          this.oamAddr = 0;
          if (cy === 257) this.sprNext.fill(0);
          const ph = (cy - 257) & 7, i = (cy - 257) >> 3;
          if (ph === 4) this.spriteFetch(i, false); else if (ph === 6) this.spriteFetch(i, true);
        }
        if (pre && cy >= 280 && cy <= 304) this.v = (this.v & ~0x7be0) | (this.t & 0x7be0);
      } else if (cy === 257) this.sprNext.fill(0);
      if (pre && cy === 1) { this.vbl = false; this.spr0 = false; this.ovf = false; this.updateNmi(); }
      if (pre && cy === 339 && this.odd && rend) this.cycle = 340; // odd frames skip a dot
    } else if (sl === 241 && cy === 1) {
      if (!this.preventVbl) { this.vbl = true; this.updateNmi(); }
      this.preventVbl = false;
    }
    if (++this.cycle > 340) {
      this.cycle = 0;
      if (++this.scanline > 261) {
        this.scanline = 0; this.odd ^= 1; this.frames++;
        if (this.onFrame) this.onFrame(this.fb);
      }
    }
  }
}
