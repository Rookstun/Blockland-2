// nes/src/cpu.mjs: cycle-stepped 6502 (Mesen's design: every bus access advances PPU/APU, interrupts polled per cycle).
// All 256 opcodes incl. unofficial ones. Reference emulator picked: Mesen (cycle accurate, passes the blargg suites).
const TABLE = [
  'BRK i,ORA ix,KIL,SLO ix,NOP z,ORA z,ASL z,SLO z,PHP i,ORA m,ASL a,ANC m,NOP ab,ORA ab,ASL ab,SLO ab',
  'BPL r,ORA iy,KIL,SLO iy,NOP zx,ORA zx,ASL zx,SLO zx,CLC i,ORA aby,NOP i,SLO aby,NOP abx,ORA abx,ASL abx,SLO abx',
  'JSR ab,AND ix,KIL,RLA ix,BIT z,AND z,ROL z,RLA z,PLP i,AND m,ROL a,ANC m,BIT ab,AND ab,ROL ab,RLA ab',
  'BMI r,AND iy,KIL,RLA iy,NOP zx,AND zx,ROL zx,RLA zx,SEC i,AND aby,NOP i,RLA aby,NOP abx,AND abx,ROL abx,RLA abx',
  'RTI i,EOR ix,KIL,SRE ix,NOP z,EOR z,LSR z,SRE z,PHA i,EOR m,LSR a,ALR m,JMP ab,EOR ab,LSR ab,SRE ab',
  'BVC r,EOR iy,KIL,SRE iy,NOP zx,EOR zx,LSR zx,SRE zx,CLI i,EOR aby,NOP i,SRE aby,NOP abx,EOR abx,LSR abx,SRE abx',
  'RTS i,ADC ix,KIL,RRA ix,NOP z,ADC z,ROR z,RRA z,PLA i,ADC m,ROR a,ARR m,JMP in,ADC ab,ROR ab,RRA ab',
  'BVS r,ADC iy,KIL,RRA iy,NOP zx,ADC zx,ROR zx,RRA zx,SEI i,ADC aby,NOP i,RRA aby,NOP abx,ADC abx,ROR abx,RRA abx',
  'NOP m,STA ix,NOP m,SAX ix,STY z,STA z,STX z,SAX z,DEY i,NOP m,TXA i,XAA m,STY ab,STA ab,STX ab,SAX ab',
  'BCC r,STA iy,KIL,SHA iy,STY zx,STA zx,STX zy,SAX zy,TYA i,STA aby,TXS i,TAS aby,SHY abx,STA abx,SHX aby,SHA aby',
  'LDY m,LDA ix,LDX m,LAX ix,LDY z,LDA z,LDX z,LAX z,TAY i,LDA m,TAX i,LXA m,LDY ab,LDA ab,LDX ab,LAX ab',
  'BCS r,LDA iy,KIL,LAX iy,LDY zx,LDA zx,LDX zy,LAX zy,CLV i,LDA aby,TSX i,LAS aby,LDY abx,LDA abx,LDX aby,LAX aby',
  'CPY m,CMP ix,NOP m,DCP ix,CPY z,CMP z,DEC z,DCP z,INY i,CMP m,DEX i,AXS m,CPY ab,CMP ab,DEC ab,DCP ab',
  'BNE r,CMP iy,KIL,DCP iy,NOP zx,CMP zx,DEC zx,DCP zx,CLD i,CMP aby,NOP i,DCP aby,NOP abx,CMP abx,DEC abx,DCP abx',
  'CPX m,SBC ix,NOP m,ISC ix,CPX z,SBC z,INC z,ISC z,INX i,SBC m,NOP i,SBC m,CPX ab,SBC ab,INC ab,ISC ab',
  'BEQ r,SBC iy,KIL,ISC iy,NOP zx,SBC zx,INC zx,ISC zx,SED i,SBC aby,NOP i,ISC aby,NOP abx,SBC abx,INC abx,ISC abx',
];
const NAME = [], MODE = [], ALWAYS = []; // ALWAYS: store / read-modify-write, indexed modes always take the dummy read
const STORE = new Set(['STA', 'STX', 'STY', 'SAX', 'SHA', 'SHX', 'SHY', 'TAS']);
const RMW = new Set(['ASL', 'LSR', 'ROL', 'ROR', 'INC', 'DEC', 'SLO', 'SRE', 'RLA', 'RRA', 'DCP', 'ISC']);
TABLE.join(',').split(',').forEach((e, i) => {
  const [n, m] = e.split(' ');
  NAME[i] = n; MODE[i] = m || 'i'; ALWAYS[i] = STORE.has(n) || (RMW.has(n) && MODE[i] !== 'a');
});

export class CPU {
  constructor(nes) { this.nes = nes; this.PRE = CPU.PRE ?? 2; }

  power() {
    this.a = this.x = this.y = 0; this.sp = 0xfd;
    this.c = this.z = this.v = this.n = this.d = 0; this.i = 1;
    this.cycles = 0; this.open = 0;
    this.needNmi = this.prevNeedNmi = this.nmiPrev = this.runIrq = this.prevRunIrq = 0;
    this.dmaPage = -1; this.dmcReq = -1; this.inDma = false;
    this.startup();
  }
  reset() { this.sp = (this.sp - 3) & 255; this.i = 1; this.dmaPage = -1; this.startup(); }
  startup() {
    for (let k = 0; k < 6; k++) this.idle();
    const lo = this.rd(0xfffc), hi = this.rd(0xfffd);
    this.pc = lo | hi << 8;
  }

  // ---- bus ----
  bread(a) {
    const n = this.nes; let v;
    if (a < 0x2000) v = n.ram[a & 0x7ff];
    else if (a < 0x4000) v = n.ppu.readReg(a & 7);
    else if (a < 0x4020) {
      if (a === 0x4015) return n.apu.readStatus();
      else if (a === 0x4016 || a === 0x4017) v = (this.open & 0xe0) | n.joyRead(a & 1);
      else v = this.open;
    } else { v = n.cart.cpuRead(a); if (v < 0) v = this.open; }
    return this.open = v;
  }
  bwrite(a, v) {
    const n = this.nes; this.open = v;
    if (a < 0x2000) n.ram[a & 0x7ff] = v;
    else if (a < 0x4000) n.ppu.writeReg(a & 7, v);
    else if (a < 0x4020) {
      if (a === 0x4014) this.dmaPage = v;
      else if (a === 0x4016) n.joyStrobe(v);
      else n.apu.write(a, v);
    } else n.cart.cpuWrite(a, v);
  }
  // one CPU cycle = PRE ppu dots, bus access, the rest of the 3 dots
  startCycle() { const p = this.nes.ppu; for (let k = 0; k < this.PRE; k++) p.tick(); }
  endCycle() {
    const n = this.nes, p = n.ppu;
    for (let k = this.PRE; k < 3; k++) p.tick();
    n.apu.tick(); this.cycles++;
    if (n.cart.cpuTick) n.cart.cpuTick();
    this.prevNeedNmi = this.needNmi;
    const nl = p.nmiLine; if (!this.nmiPrev && nl) this.needNmi = 1; this.nmiPrev = nl;
    this.prevRunIrq = this.runIrq;
    this.runIrq = (n.apu.irq() || n.cart.irq) && !this.i ? 1 : 0;
  }
  idle() { this.startCycle(); this.endCycle(); }
  rd(a) {
    if (this.dmcReq >= 0 && !this.inDma) this.dmcDma(a);
    this.startCycle(); const v = this.bread(a); this.endCycle(); return v;
  }
  wr(a, v) {
    this.startCycle(); this.bwrite(a, v); this.endCycle();
    if (this.dmaPage >= 0) this.oamDma();
  }
  dmcDma(a) { // halt (repeats the CPU's read), dummy, alignment, fetch = 4 cycles
    const req = this.dmcReq; this.dmcReq = -1; this.inDma = true;
    this.startCycle(); this.bread(a); this.endCycle();
    this.idle(); if (this.cycles & 1) this.idle();
    this.startCycle(); const v = this.bread(req); this.endCycle();
    this.nes.apu.dmcLoad(v); this.inDma = false;
  }
  oamDma() {
    const page = this.dmaPage << 8; this.dmaPage = -1; this.inDma = true;
    this.idle(); if (this.cycles & 1) this.idle();
    for (let k = 0; k < 256; k++) { const v = this.rd(page | k); this.wr(0x2004, v); }
    this.inDma = false;
  }
  push(v) { this.wr(0x100 | this.sp, v); this.sp = (this.sp - 1) & 255; }
  pop() { this.sp = (this.sp + 1) & 255; return this.rd(0x100 | this.sp); }
  getP() { return this.c | this.z << 1 | this.i << 2 | this.d << 3 | 0x20 | this.v << 6 | this.n << 7; }
  setP(p) { this.c = p & 1; this.z = p >> 1 & 1; this.i = p >> 2 & 1; this.d = p >> 3 & 1; this.v = p >> 6 & 1; this.n = p >> 7 & 1; }
  zn(v) { this.z = v === 0 ? 1 : 0; this.n = v >> 7 & 1; return v; }

  step() {
    const op = this.rd(this.pc); this.pc = (this.pc + 1) & 0xffff;
    this.exec(op);
    if (this.prevRunIrq || this.prevNeedNmi) this.interrupt(false);
  }
  interrupt(brk) {
    if (!brk) { this.rd(this.pc); this.rd(this.pc); }
    this.push(this.pc >> 8); this.push(this.pc & 255);
    this.push(this.getP() | (brk ? 0x10 : 0));
    this.i = 1;
    let vec = 0xfffe;
    if (this.needNmi) { this.needNmi = 0; vec = 0xfffa; } // an NMI arriving during BRK/IRQ hijacks the vector
    const lo = this.rd(vec), hi = this.rd(vec + 1); this.pc = lo | hi << 8;
  }

  // ---- addressing ----
  addr(mode, always) {
    let a, lo, hi, b;
    switch (mode) {
      case 'm': a = this.pc; this.pc = (a + 1) & 0xffff; return a;
      case 'z': a = this.rd(this.pc); this.pc = (this.pc + 1) & 0xffff; return a;
      case 'zx': case 'zy':
        b = this.rd(this.pc); this.pc = (this.pc + 1) & 0xffff; this.rd(b);
        return (b + (mode === 'zx' ? this.x : this.y)) & 255;
      case 'ab':
        lo = this.rd(this.pc); hi = this.rd((this.pc + 1) & 0xffff); this.pc = (this.pc + 2) & 0xffff;
        return lo | hi << 8;
      case 'abx': case 'aby': {
        lo = this.rd(this.pc); hi = this.rd((this.pc + 1) & 0xffff); this.pc = (this.pc + 2) & 0xffff;
        const base = lo | hi << 8; a = (base + (mode === 'abx' ? this.x : this.y)) & 0xffff;
        this.baseHi = hi; this.crossed = (base & 0xff00) !== (a & 0xff00);
        if (always || this.crossed) this.rd((base & 0xff00) | (a & 255));
        return a;
      }
      case 'ix': {
        b = this.rd(this.pc); this.pc = (this.pc + 1) & 0xffff; this.rd(b);
        b = (b + this.x) & 255; lo = this.rd(b); hi = this.rd((b + 1) & 255); return lo | hi << 8;
      }
      case 'iy': {
        b = this.rd(this.pc); this.pc = (this.pc + 1) & 0xffff;
        lo = this.rd(b); hi = this.rd((b + 1) & 255);
        const base = lo | hi << 8; a = (base + this.y) & 0xffff;
        this.baseHi = hi; this.crossed = (base & 0xff00) !== (a & 0xff00);
        if (always || this.crossed) this.rd((base & 0xff00) | (a & 255));
        return a;
      }
    }
    throw Error('mode ' + mode);
  }

  adc(v) {
    const s = this.a + v + this.c;
    this.v = (~(this.a ^ v) & (this.a ^ s) & 0x80) ? 1 : 0;
    this.c = s > 255 ? 1 : 0; this.a = this.zn(s & 255);
  }
  cmp(r, v) { this.c = r >= v ? 1 : 0; this.zn((r - v) & 255); }
  asl(v) { this.c = v >> 7; return this.zn((v << 1) & 255); }
  lsr(v) { this.c = v & 1; return this.zn(v >> 1); }
  rol(v) { const c = this.c; this.c = v >> 7; return this.zn(((v << 1) | c) & 255); }
  ror(v) { const c = this.c; this.c = v & 1; return this.zn((v >> 1) | c << 7); }
  branch(cond) {
    const off = this.rd(this.pc); this.pc = (this.pc + 1) & 0xffff;
    if (!cond) return;
    if (this.runIrq && !this.prevRunIrq) this.runIrq = 0; // a taken branch ignores an IRQ raised in its last cycle
    this.rd(this.pc);
    const t = (this.pc + (off << 24 >> 24)) & 0xffff;
    if ((t & 0xff00) !== (this.pc & 0xff00)) this.rd((this.pc & 0xff00) | (t & 255));
    this.pc = t;
  }

  exec(op) {
    const name = NAME[op], mode = MODE[op];
    switch (name) {
      case 'BPL': return this.branch(!this.n);
      case 'BMI': return this.branch(this.n);
      case 'BVC': return this.branch(!this.v);
      case 'BVS': return this.branch(this.v);
      case 'BCC': return this.branch(!this.c);
      case 'BCS': return this.branch(this.c);
      case 'BNE': return this.branch(!this.z);
      case 'BEQ': return this.branch(this.z);
      case 'BRK': this.rd(this.pc); this.pc = (this.pc + 1) & 0xffff; return this.interrupt(true);
      case 'JSR': {
        const lo = this.rd(this.pc); this.pc = (this.pc + 1) & 0xffff;
        this.rd(0x100 | this.sp);
        this.push(this.pc >> 8); this.push(this.pc & 255);
        this.pc = lo | this.rd(this.pc) << 8; return;
      }
      case 'RTS': {
        this.rd(this.pc); this.rd(0x100 | this.sp);
        const lo = this.pop(), hi = this.pop(); this.pc = lo | hi << 8;
        this.rd(this.pc); this.pc = (this.pc + 1) & 0xffff; return;
      }
      case 'RTI': {
        this.rd(this.pc); this.rd(0x100 | this.sp);
        this.setP(this.pop()); const lo = this.pop(), hi = this.pop(); this.pc = lo | hi << 8; return;
      }
      case 'PHA': this.rd(this.pc); return this.push(this.a);
      case 'PHP': this.rd(this.pc); return this.push(this.getP() | 0x10);
      case 'PLA': this.rd(this.pc); this.rd(0x100 | this.sp); this.a = this.zn(this.pop()); return;
      case 'PLP': this.rd(this.pc); this.rd(0x100 | this.sp); this.setP(this.pop()); return;
      case 'JMP': {
        if (mode === 'ab') { const lo = this.rd(this.pc), hi = this.rd((this.pc + 1) & 0xffff); this.pc = lo | hi << 8; return; }
        const pl = this.rd(this.pc), ph = this.rd((this.pc + 1) & 0xffff), p = pl | ph << 8;
        const lo = this.rd(p), hi = this.rd((p & 0xff00) | ((p + 1) & 255)); this.pc = lo | hi << 8; return;
      }
      case 'KIL': throw Error('KIL (jam) at ' + ((this.pc - 1) & 0xffff).toString(16));
    }
    if (mode === 'i' || mode === 'a') { // implied / accumulator: one dummy read of the next byte
      this.rd(this.pc);
      switch (name) {
        case 'NOP': return;
        case 'ASL': this.a = this.asl(this.a); return;
        case 'LSR': this.a = this.lsr(this.a); return;
        case 'ROL': this.a = this.rol(this.a); return;
        case 'ROR': this.a = this.ror(this.a); return;
        case 'INX': this.x = this.zn((this.x + 1) & 255); return;
        case 'INY': this.y = this.zn((this.y + 1) & 255); return;
        case 'DEX': this.x = this.zn((this.x - 1) & 255); return;
        case 'DEY': this.y = this.zn((this.y - 1) & 255); return;
        case 'TAX': this.x = this.zn(this.a); return;
        case 'TAY': this.y = this.zn(this.a); return;
        case 'TXA': this.a = this.zn(this.x); return;
        case 'TYA': this.a = this.zn(this.y); return;
        case 'TSX': this.x = this.zn(this.sp); return;
        case 'TXS': this.sp = this.x; return;
        case 'CLC': this.c = 0; return;
        case 'SEC': this.c = 1; return;
        case 'CLI': this.i = 0; return;
        case 'SEI': this.i = 1; return;
        case 'CLV': this.v = 0; return;
        case 'CLD': this.d = 0; return;
        case 'SED': this.d = 1; return;
      }
      throw Error('implied ' + name);
    }
    const ad = this.addr(mode, ALWAYS[op]);
    // read-modify-write: read, write the old value back, write the result
    const rmw = f => { const v = this.rd(ad); this.wr(ad, v); const r = f(v); this.wr(ad, r); return r; };
    switch (name) {
      case 'LDA': this.a = this.zn(this.rd(ad)); return;
      case 'LDX': this.x = this.zn(this.rd(ad)); return;
      case 'LDY': this.y = this.zn(this.rd(ad)); return;
      case 'LAX': this.a = this.x = this.zn(this.rd(ad)); return;
      case 'LXA': this.a = this.x = this.zn(this.rd(ad)); return;
      case 'STA': this.wr(ad, this.a); return;
      case 'STX': this.wr(ad, this.x); return;
      case 'STY': this.wr(ad, this.y); return;
      case 'SAX': this.wr(ad, this.a & this.x); return;
      case 'AND': this.a = this.zn(this.a & this.rd(ad)); return;
      case 'ORA': this.a = this.zn(this.a | this.rd(ad)); return;
      case 'EOR': this.a = this.zn(this.a ^ this.rd(ad)); return;
      case 'ADC': this.adc(this.rd(ad)); return;
      case 'SBC': this.adc(this.rd(ad) ^ 255); return;
      case 'CMP': this.cmp(this.a, this.rd(ad)); return;
      case 'CPX': this.cmp(this.x, this.rd(ad)); return;
      case 'CPY': this.cmp(this.y, this.rd(ad)); return;
      case 'BIT': { const v = this.rd(ad); this.z = (this.a & v) === 0 ? 1 : 0; this.v = v >> 6 & 1; this.n = v >> 7; return; }
      case 'NOP': this.rd(ad); return;
      case 'ASL': rmw(v => this.asl(v)); return;
      case 'LSR': rmw(v => this.lsr(v)); return;
      case 'ROL': rmw(v => this.rol(v)); return;
      case 'ROR': rmw(v => this.ror(v)); return;
      case 'INC': rmw(v => this.zn((v + 1) & 255)); return;
      case 'DEC': rmw(v => this.zn((v - 1) & 255)); return;
      case 'SLO': { const r = rmw(v => this.asl(v)); this.a = this.zn(this.a | r); return; }
      case 'RLA': { const r = rmw(v => this.rol(v)); this.a = this.zn(this.a & r); return; }
      case 'SRE': { const r = rmw(v => this.lsr(v)); this.a = this.zn(this.a ^ r); return; }
      case 'RRA': { const r = rmw(v => this.ror(v)); this.adc(r); return; }
      case 'DCP': { const r = rmw(v => (v - 1) & 255); this.cmp(this.a, r); return; }
      case 'ISC': { const r = rmw(v => (v + 1) & 255); this.adc(r ^ 255); return; }
      case 'ANC': this.a = this.zn(this.a & this.rd(ad)); this.c = this.n; return;
      case 'ALR': this.a = this.a & this.rd(ad); this.a = this.lsr(this.a); return;
      case 'ARR': {
        this.a = this.a & this.rd(ad); this.a = (this.a >> 1) | this.c << 7; this.zn(this.a);
        this.c = this.a >> 6 & 1; this.v = (this.a >> 6 & 1) ^ (this.a >> 5 & 1); return;
      }
      case 'AXS': { const v = this.rd(ad), t = this.a & this.x; this.c = t >= v ? 1 : 0; this.x = this.zn((t - v) & 255); return; }
      case 'XAA': this.a = this.zn(this.x & this.rd(ad)); return;
      case 'LAS': this.a = this.x = this.sp = this.zn(this.rd(ad) & this.sp); return;
      case 'SHY': case 'SHX': case 'SHA': case 'TAS': {
        let val;
        if (name === 'SHY') val = this.y; else if (name === 'SHX') val = this.x; else val = this.a & this.x;
        if (name === 'TAS') this.sp = val;
        val &= (this.baseHi + 1) & 255;
        this.wr(this.crossed ? (val << 8) | (ad & 255) : ad, val); return;
      }
    }
    throw Error('op ' + name);
  }
}
