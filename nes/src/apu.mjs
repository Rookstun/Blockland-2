// nes/src/apu.mjs: 2A03 audio: 2 pulse, triangle, noise, DMC, frame counter (NTSC), non-linear mixer -> 44.1 kHz samples.
const LEN = [10, 254, 20, 2, 40, 4, 80, 6, 160, 8, 60, 10, 14, 12, 26, 14, 12, 16, 24, 18, 48, 20, 96, 22, 192, 24, 72, 26, 16, 28, 32, 30];
const DUTY = [[0, 1, 0, 0, 0, 0, 0, 0], [0, 1, 1, 0, 0, 0, 0, 0], [0, 1, 1, 1, 1, 0, 0, 0], [1, 0, 0, 1, 1, 1, 1, 1]];
const NOISE = [4, 8, 16, 32, 64, 96, 128, 160, 202, 254, 380, 508, 762, 1016, 2034, 4068];
const DMCRATE = [428, 380, 340, 320, 286, 254, 226, 214, 190, 160, 142, 128, 106, 84, 72, 54];
const STEPS = [[7457, 14913, 22371, 29828, 29829, 29830], [7457, 14913, 22371, 29829, 37281, 37282]];
const TYPES = [[1, 3, 1, 0, 3, 0], [1, 3, 1, 0, 3, 0]]; // 1 quarter, 3 quarter+half
const PULSE_LUT = Float32Array.from({ length: 31 }, (_, n) => n ? 95.52 / (8128 / n + 100) : 0);
const TND_LUT = Float32Array.from({ length: 203 }, (_, n) => n ? 163.67 / (24329 / n + 100) : 0);

class Env {
  constructor() { this.start = false; this.div = 0; this.decay = 0; this.period = 0; this.loop = false; this.cv = false; }
  clock() {
    if (this.start) { this.start = false; this.decay = 15; this.div = this.period; }
    else if (this.div-- === 0) { this.div = this.period; if (this.decay) this.decay--; else if (this.loop) this.decay = 15; }
  }
  vol() { return this.cv ? this.period : this.decay; }
}

class Pulse {
  constructor(ones) { this.ones = ones; this.env = new Env(); this.en = false; this.len = 0; this.timer = 0; this.period = 0; this.duty = 0; this.pos = 0;
    this.sw = { en: false, div: 0, period: 0, neg: false, shift: 0, reload: false }; }
  target() { const d = this.period >> this.sw.shift; return this.sw.neg ? this.period - d - (this.ones ? 1 : 0) : this.period + d; }
  mute() { return this.period < 8 || this.target() > 0x7ff; }
  halfClock() {
    if (this.len && !this.env.loop) this.len--;
    const s = this.sw;
    if (s.div === 0 && s.en && s.shift && !this.mute()) this.period = this.target();
    if (s.div === 0 || s.reload) { s.div = s.period; s.reload = false; } else s.div--;
  }
  write(r, v) {
    const s = this.sw;
    if (r === 0) { this.duty = v >> 6; this.env.loop = !!(v & 0x20); this.env.cv = !!(v & 0x10); this.env.period = v & 15; }
    else if (r === 1) { s.en = !!(v & 0x80); s.period = v >> 4 & 7; s.neg = !!(v & 8); s.shift = v & 7; s.reload = true; }
    else if (r === 2) this.period = (this.period & 0x700) | v;
    else { this.period = (this.period & 0xff) | (v & 7) << 8; if (this.en) this.len = LEN[v >> 3]; this.pos = 0; this.env.start = true; }
  }
  tick() { if (this.timer-- === 0) { this.timer = this.period; this.pos = (this.pos + 1) & 7; } }
  out() { return (this.len && DUTY[this.duty][this.pos] && !this.mute()) ? this.env.vol() : 0; }
}

export class APU {
  constructor(nes) { this.nes = nes; this.samples = new Float32Array(8192); this.sampleCount = 0; }
  power() {
    this.p1 = new Pulse(true); this.p2 = new Pulse(false);
    this.tri = { en: false, len: 0, halt: false, linear: 0, linReload: 0, linFlag: false, period: 0, timer: 0, seq: 0 };
    this.noi = { en: false, len: 0, env: new Env(), mode: false, period: 4, timer: 0, shift: 1 };
    this.dmc = { irqEn: false, loop: false, rate: 428, timer: 428, level: 0, addr: 0xc000, len: 1, cur: 0xc000, rem: 0, buf: 0, bufEmpty: true, shift: 0, bits: 8, silence: true, irq: false };
    this.frameIrq = false; this.inhibit = false; this.five = 0; this.fc = 0; this.step = 0; this.delay = 0; this.newVal = 0;
    this.acc = 0; this.accN = 0; this.phase = 0; this.hp = 0; this.lastIn = 0;
    this.write(0x4017, 0); // power-on acts like a $4017 write of 0
  }
  irq() { return this.frameIrq || this.dmc.irq; }
  quarter() {
    this.p1.env.clock(); this.p2.env.clock(); this.noi.env.clock();
    const t = this.tri;
    if (t.linFlag) t.linear = t.linReload; else if (t.linear) t.linear--;
    if (!t.halt) t.linFlag = false;
  }
  half() {
    this.p1.halfClock(); this.p2.halfClock();
    if (this.tri.len && !this.tri.halt) this.tri.len--;
    if (this.noi.len && !this.noi.env.loop) this.noi.len--;
  }
  readStatus() {
    const d = this.dmc;
    const v = (this.p1.len ? 1 : 0) | (this.p2.len ? 2 : 0) | (this.tri.len ? 4 : 0) | (this.noi.len ? 8 : 0) | (d.rem ? 16 : 0) |
      (this.frameIrq ? 0x40 : 0) | (d.irq ? 0x80 : 0);
    this.frameIrq = false; return v | (this.nes.cpu.open & 0x20);
  }
  write(a, v) {
    if (a < 0x4004) this.p1.write(a & 3, v);
    else if (a < 0x4008) this.p2.write(a & 3, v);
    else if (a < 0x400c) {
      const t = this.tri, r = a & 3;
      if (r === 0) { t.halt = !!(v & 0x80); t.linReload = v & 0x7f; }
      else if (r === 2) t.period = (t.period & 0x700) | v;
      else if (r === 3) { t.period = (t.period & 0xff) | (v & 7) << 8; if (t.en) t.len = LEN[v >> 3]; t.linFlag = true; }
    } else if (a < 0x4010) {
      const n = this.noi, r = a & 3;
      if (r === 0) { n.env.loop = !!(v & 0x20); n.env.cv = !!(v & 0x10); n.env.period = v & 15; }
      else if (r === 2) { n.mode = !!(v & 0x80); n.period = NOISE[v & 15]; }
      else if (r === 3) { if (n.en) n.len = LEN[v >> 3]; n.env.start = true; }
    } else if (a < 0x4014) {
      const d = this.dmc;
      if (a === 0x4010) { d.irqEn = !!(v & 0x80); d.loop = !!(v & 0x40); d.rate = DMCRATE[v & 15]; if (!d.irqEn) d.irq = false; }
      else if (a === 0x4011) d.level = v & 0x7f;
      else if (a === 0x4012) d.addr = 0xc000 | v << 6;
      else d.len = v << 4 | 1;
    } else if (a === 0x4015) {
      const d = this.dmc;
      this.p1.en = !!(v & 1); this.p2.en = !!(v & 2); this.tri.en = !!(v & 4); this.noi.en = !!(v & 8);
      if (!this.p1.en) this.p1.len = 0; if (!this.p2.en) this.p2.len = 0; if (!this.tri.en) this.tri.len = 0; if (!this.noi.en) this.noi.len = 0;
      d.irq = false;
      if (!(v & 16)) d.rem = 0; else if (!d.rem) { d.cur = d.addr; d.rem = d.len; this.dmcCheck(); }
    } else if (a === 0x4017) {
      this.newVal = v; this.delay = ((this.nes.cpu.cycles & 1) ? 4 : 3);
      if (v & 0x40) this.frameIrq = false;
    }
  }
  dmcCheck() { const d = this.dmc; if (d.bufEmpty && d.rem && this.nes.cpu.dmcReq < 0) this.nes.cpu.dmcReq = d.cur; }
  dmcLoad(b) {
    const d = this.dmc; d.buf = b; d.bufEmpty = false; d.cur = (d.cur + 1) & 0xffff | 0x8000;
    if (--d.rem === 0) { if (d.loop) { d.cur = d.addr; d.rem = d.len; } else if (d.irqEn) d.irq = true; }
  }
  tick() {
    // frame counter
    if (this.delay && --this.delay === 0) {
      this.five = this.newVal >> 7; this.inhibit = !!(this.newVal & 0x40); this.fc = 0; this.step = 0;
      if (this.five) { this.quarter(); this.half(); }
      this.skipFc = true; // the counter reads 0 right after the reset cycle
    }
    if (this.skipFc) this.skipFc = false; else this.fc++;
    if (this.fc === STEPS[this.five][this.step]) {
      const ty = TYPES[this.five][this.step];
      if (ty & 1) this.quarter(); if (ty & 2) this.half();
      if (!this.five && this.step >= 3 && !this.inhibit) this.frameIrq = true;
      if (++this.step === 6) { this.step = 0; this.fc = 0; }
    }
    // channels
    if (this.phase ^= 1) { this.p1.tick(); this.p2.tick(); }
    const t = this.tri;
    if (t.timer-- === 0) { t.timer = t.period; if (t.len && t.linear) t.seq = (t.seq + 1) & 31; }
    const n = this.noi;
    if (n.timer-- === 0) {
      n.timer = n.period - 1;
      const fb = (n.shift & 1) ^ (n.shift >> (n.mode ? 6 : 1) & 1);
      n.shift = n.shift >> 1 | fb << 14;
    }
    const d = this.dmc;
    if (d.timer-- === 0) {
      d.timer = d.rate - 1;
      if (!d.silence) { if (d.shift & 1) { if (d.level <= 125) d.level += 2; } else if (d.level >= 2) d.level -= 2; }
      d.shift >>= 1;
      if (--d.bits === 0) {
        d.bits = 8;
        if (d.bufEmpty) d.silence = true; else { d.silence = false; d.shift = d.buf; d.bufEmpty = true; this.dmcCheck(); }
      }
    }
    // mix
    const tri = t.seq < 16 ? 15 - t.seq : t.seq - 16;
    const nz = (n.shift & 1) || !n.len ? 0 : n.env.vol();
    const s = PULSE_LUT[this.p1.out() + this.p2.out()] + TND_LUT[3 * tri + 2 * nz + d.level];
    this.acc += s; this.accN++;
    this.sampAcc = (this.sampAcc || 0) + 44100;
    if (this.sampAcc >= 1789773) {
      this.sampAcc -= 1789773;
      const x = this.acc / this.accN; this.acc = 0; this.accN = 0;
      this.hp = x - this.lastIn + 0.996 * this.hp; this.lastIn = x; // DC blocker
      if (this.sampleCount < this.samples.length) this.samples[this.sampleCount++] = this.hp;
    }
  }
  take() { const o = this.samples.slice(0, this.sampleCount); this.sampleCount = 0; return o; }
}
