// nes/src/nes.mjs: the console: 2 KB RAM, CPU, PPU, APU, cartridge, two controllers.
// buttons[p] bits: A 1, B 2, Select 4, Start 8, Up 16, Down 32, Left 64, Right 128
import { CPU } from './cpu.mjs';
import { PPU } from './ppu.mjs';
import { APU } from './apu.mjs';
import { Cart } from './cart.mjs';

export class NES {
  constructor(rom) {
    this.ram = new Uint8Array(2048);
    this.buttons = [0, 0]; this.shift = [0, 0]; this.strobe = 0;
    this.cpu = new CPU(this); this.ppu = new PPU(this); this.apu = new APU(this);
    this.cart = new Cart(this, rom);
    this.power();
  }
  power() {
    this.ram.fill(0); this.ppu.power(); this.apu.power(); this.cart.power(); this.cpu.power();
  }
  reset() { this.ppu.ctrl = this.ppu.mask = 0; this.cpu.reset(); }
  joyStrobe(v) {
    this.strobe = v & 1;
    if (this.strobe) { this.shift[0] = this.buttons[0]; this.shift[1] = this.buttons[1]; }
  }
  joyRead(p) {
    if (this.strobe) return this.buttons[p] & 1;
    const b = this.shift[p] & 1; this.shift[p] = this.shift[p] >> 1 | 0x80; return b;
  }
  // run until the PPU finishes a frame
  frame() {
    const f = this.ppu.frames;
    while (this.ppu.frames === f) this.cpu.step();
    return this.ppu.fb;
  }
}
