// snes: a Super Nintendo in the live world (owner 2026-10-10).
//
// The SnesJs core (snes/, MIT, angelo-wf/SnesJs) runs in a worker thread at
// 60 fps; every few frames the picture comes back downscaled (128x112 by
// default) and is drawn on a wall of glowing micro bricks. Only the 16x16
// tiles that changed are redrawn: each changed tile is one ClearRegion (it
// takes only bricks entirely inside) plus its merged bricks, all in one prefab
// load, so static parts of the screen never flicker.
// Input: a controller pedestal in front of the screen (interact bricks,
// ConsoleTag "snes:<button>", each press holds the button press-ms) or chat
// (/snes a, /snes right 2, /snes hold left). No sound (the game can't stream it).
// Unsafe (plain node) plugin like media/bridge. SRAM is kept in saves/.

const fs = require('fs');
const net = require('net');
const dns = require('dns').promises;
const path = require('path');
const { Worker } = require('worker_threads');
const { pathToFileURL } = require('url');

const OWNER = { id: '5a1e7c0d-3b6f-4e2a-9c84-1f0d2e6b7a93', name: 'Claude SNES' };
const STUD = 10;
const FEET = 25; // a standing player's position is this far above the ground
const TILE = 16; // redraw unit in screen pixels
const SCREEN_RIGHT = { '-x': [0, 1], '+x': [0, -1], '-y': [-1, 0], '+y': [1, 0] };
const NORMAL = { '-x': [-1, 0], '+x': [1, 0], '-y': [0, -1], '+y': [0, 1] };
const BUTTONS = { b: 0, y: 1, select: 2, start: 3, up: 4, down: 5, left: 6, right: 7, a: 8, x: 9, l: 10, r: 11 };
const ALIAS = { sel: 'select', st: 'start', u: 'up', d: 'down', dn: 'down', lt: 'left', rt: 'right', w: 'up', s: 'down' };
// controller pedestal: [button, u (along the screen's right), v (towards the screen), colour]
const PAD = [
  ['up', -60, 20, [60, 60, 60]], ['down', -60, -20, [60, 60, 60]], ['left', -80, 0, [60, 60, 60]], ['right', -40, 0, [60, 60, 60]],
  ['select', -15, 0, [120, 120, 130]], ['start', 15, 0, [120, 120, 130]],
  ['x', 60, 20, [40, 80, 220]], ['b', 60, -20, [230, 190, 30]], ['y', 40, 0, [40, 170, 60]], ['a', 80, 0, [210, 40, 40]],
  ['l', -60, 50, [150, 150, 160]], ['r', 60, 50, [150, 150, 160]],
];
// speaker spots on the pedestal's corners (u, v), outside the buttons
const SPEAKERS = [[-95, -45], [95, -45], [-95, 45], [95, 45], [0, -45], [0, 45]];
const SYNTHS = { sine: 'BA_Synth_Basic_Sine', square: 'BA_Synth_Basic_Square', saw: 'BA_Synth_Basic_Sawtooth', triangle: 'BA_Synth_Basic_Triangle' };
const ROMS = path.join(__dirname, 'roms');
const SAVES = path.join(__dirname, 'saves');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const sanitize = s => String(s).replace(/[<>\\"]/g, '');

function isPrivateAddress(ip) {
  if (net.isIPv6(ip)) {
    const v4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
    if (v4) return isPrivateAddress(v4[1]);
    return /^(::1?$|f[cd]|fe[89ab])/i.test(ip);
  }
  const [a, b] = ip.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b < 128) ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b < 32) || (a === 192 && b === 168) || a >= 224;
}

module.exports = class Snes {
  constructor(omegga, config, store) {
    this.omegga = omegga;
    this.config = config;
    this.store = store;
    this.screen = null;   // { cx, cy, ground, W, H, n, right, px, facing }
    this.pad = null;      // { cx, cy, z, n, right } controller pedestal
    this.shown = null;    // Int32Array of the colours now on the bricks (-1 = blank)
    this.held = new Map(); // button -> release time (Infinity = held by /snes hold)
    this.romName = null;
    this.drawing = false;
    this.pending = null;
    this.recent = []; // tile sets of the last few frame loads
    this.voices = []; // speaker slots: { hz, vol, stale }
  }

  async init() {
    this.brs = await import(pathToFileURL(path.join(__dirname, 'lib/brs.mjs')).href);
    this.prefabDir = path.join(path.dirname(this.omegga.savePath), 'Prefabs');
    fs.mkdirSync(this.prefabDir, { recursive: true });
    fs.mkdirSync(ROMS, { recursive: true });
    fs.mkdirSync(SAVES, { recursive: true });
    for (const f of fs.readdirSync(this.prefabDir)) if (f.startsWith('snes_tmp_')) fs.rmSync(path.join(this.prefabDir, f), { force: true });

    // unsafe plugins share Omegga's emitter: remove only our own handlers from an earlier load
    const old = globalThis.__snesHandlers ?? [];
    for (const [e, h] of old) this.omegga.removeListener(e, h);
    const mine = [];
    const on = (e, h) => { this.omegga.on(e, h); mine.push([e, h]); };
    const cmd = (name, ...args) => this.command(name, args.join(' ').trim().split(/\s+/).filter(Boolean)).catch(err => {
      console.error('[snes]', err);
      this.whisper(name, `<color="f55">${sanitize(String(err.message ?? err).slice(0, 180))}</>`);
    });
    on('cmd:snes', cmd);
    on('chatcmd:snes', cmd);
    on('interact', i => { try { this.onInteract(i); } catch (e) { console.error('[snes]', e); } });
    // prefab loads finish asynchronously: one can land after the next frame's
    // ClearRegion, and then the next load of that tile is rejected (black or
    // stale tiles). The game logs the rejection, so redraw the recent tiles.
    on('line', line => {
      if (!this.screen || !/Brick is overlapping in same grid/.test(line)) return;
      this.healRecent();
      for (const v of this.voices) v.stale = true; // a speaker swap may have been rejected too
    });
    globalThis.__snesHandlers = mine;

    // a screen from before a reload comes back where it was
    const saved = await this.store.get('setup');
    if (saved?.screen) {
      this.screen = saved.screen;
      this.pad = saved.pad;
      this.blank();
    }
    if (saved?.rom) this.boot(saved.rom).catch(e => console.error('[snes] reboot', e));
    this.padTimer = setInterval(() => this.tickPad(), 30);
    this.sramTimer = setInterval(() => this.saveSram().catch(() => {}), 30_000);
    return { registeredCommands: ['snes'] };
  }

  async stop() {
    clearInterval(this.padTimer);
    clearInterval(this.sramTimer);
    await this.saveSram().catch(() => {});
    await this.worker?.terminate();
    this.silence(); // no droning speakers left behind
  }

  whisper(name, msg) { this.omegga.writeln(`br.Chat.Whisper "${name}" ${msg}`); }
  broadcast(msg) { this.omegga.writeln(`br.Chat.Broadcast ${msg}`); }

  // ---------- emulator ----------

  startWorker() {
    this.worker?.terminate();
    const w = new Worker(path.join(__dirname, 'worker.js'));
    w.on('message', m => this.onWorker(m));
    w.on('error', e => { console.error('[snes] worker', e); this.broadcast(`<color="f55">SNES crashed: ${sanitize(e.message).slice(0, 150)}</>`); });
    this.worker = w;
    this.sendView();
    this.sendAudio();
    return w;
  }

  sendAudio() {
    this.worker?.postMessage({ type: 'audio', on: this.config['sound'] ?? true, voices: Math.min(SPEAKERS.length, this.config['voices'] ?? 4), hz: this.config['audio-hz'] ?? 10 });
  }

  // ---------- sound ----------
  // The game can't stream sound: the worker sends the strongest pitches of the
  // SNES output a few times a second and each one plays on a synth speaker
  // brick on the pedestal; a speaker is swapped (clear + load) when its note changes.

  onAudio(peaks) {
    if (!this.pad) return;
    const n = Math.min(SPEAKERS.length, this.config['voices'] ?? 4);
    while (this.voices.length < n) this.voices.push({ hz: 0, vol: 0 });
    const gain = this.config['volume'] ?? 1;
    // keep a speaker on its note when the note is still there: nearest pitch first
    // SNES music peaks at ~0.05 amplitude per note; square root keeps quiet parts audible
    const free = peaks.map(([hz, amp]) => ({ hz, vol: Math.min(1.5, Math.sqrt(amp / 0.05) * gain) }))
    const next = this.voices.map(() => null);
    for (const [i, v] of this.voices.entries()) {
      if (!v.hz || !free.length) continue;
      let best = -1, bd = 1 / 24;
      free.forEach((f, k) => { const d = Math.abs(Math.log2(f.hz / v.hz)); if (d < bd) { bd = d; best = k; } });
      if (best >= 0) next[i] = free.splice(best, 1)[0];
    }
    for (let i = 0; i < next.length && free.length; i++) if (!next[i]) next[i] = free.shift();
    const clears = [], bricks = [];
    const synth = SYNTHS[this.config['synth']] ?? SYNTHS.square;
    for (const [i, v] of this.voices.entries()) {
      const want = next[i];
      const step = q => Math.round(q * 4) / 4; // volume steps, so small wobbles don't swap the speaker
      const same = want && v.hz && Math.abs(Math.log2(want.hz / v.hz)) < 1 / 24 && step(want.vol) === step(v.vol);
      if (!v.stale && (same || (!want && !v.hz))) continue;
      const [x, y] = this.padSpot(...SPEAKERS[i]);
      if (v.hz || v.stale) clears.push([x, y]);
      v.stale = false;
      if (!want || step(want.vol) === 0) { v.hz = 0; v.vol = 0; continue; }
      v.hz = want.hz; v.vol = want.vol;
      // the synth plays 440 Hz at pitch 1; out-of-range notes move by octaves
      let pitch = want.hz / (this.config['synth-base-hz'] ?? 440);
      while (pitch > 8) pitch /= 2;
      while (pitch < 0.0625) pitch *= 2;
      bricks.push({
        asset: 'B_1x1F_Speaker', position: [x, y, this.pad.z + 2], color: [20, 20, 20],
        components: [{ type: 'Component_AudioEmitter', data: {
          bEnabled: true, AudioDescriptor: 0, VolumeMultiplier: step(want.vol), PitchMultiplier: pitch,
          InnerRadius: 100, MaxDistance: 400, bSpatialization: false,
          FocusAzimuth: 360, NonFocusAzimuth: 360, NonFocusVolumeAttenuation: 1,
        } }],
      });
    }
    for (const [x, y] of clears) this.omegga.writeln(`br.World.ClearRegion ${x} ${y} ${this.pad.z + 2} 6 6 3`);
    if (bricks.length) this.loadBricks(bricks, [{ type: 'BrickAudioDescriptor', name: synth }]);
  }

  silence() {
    if (!this.pad) return;
    for (const s of SPEAKERS) {
      const [x, y] = this.padSpot(...s);
      this.omegga.writeln(`br.World.ClearRegion ${x} ${y} ${this.pad.z + 2} 6 6 3`);
    }
    this.voices = [];
  }

  sendView() {
    const W = this.screen?.W ?? this.config['width'] ?? 128;
    this.worker?.postMessage({ type: 'view', W, H: (W * 224) / 256, fps: this.config['fps'] ?? 8 });
  }

  /** Load a ROM file (from roms/) into a fresh emulator. */
  async boot(file) {
    const rom = fs.readFileSync(path.join(ROMS, file));
    const srm = path.join(SAVES, file.replace(/\.[^.]+$/, '') + '.srm');
    const sram = fs.existsSync(srm) ? fs.readFileSync(srm) : null;
    await this.saveSram().catch(() => {});
    const w = this.startWorker();
    const loaded = new Promise((res, rej) => {
      const h = m => {
        if (m.type === 'loaded') { w.off('message', h); res(m); }
        if (m.type === 'error') { w.off('message', h); rej(new Error(m.text)); }
      };
      w.on('message', h);
    });
    const buf = rom.buffer.slice(rom.byteOffset, rom.byteOffset + rom.length);
    w.postMessage({ type: 'rom', rom: buf, sram: sram ? sram.buffer.slice(sram.byteOffset, sram.byteOffset + sram.length) : null }, [buf]);
    const info = await loaded;
    this.romName = file;
    await this.saveSetup();
    return info;
  }

  onWorker(m) {
    if (m.type === 'frame') {
      // newest frame wins; draw when the last one is out
      this.pending = m.rgb;
      if (!this.drawing) this.drawLoop();
    } else if (m.type === 'audio') this.onAudio(m.voices);
    else if (m.type === 'log') console.log('[snes]', m.text);
  }

  async saveSram() {
    if (!this.worker || !this.romName) return;
    const file = path.join(SAVES, this.romName.replace(/\.[^.]+$/, '') + '.srm');
    const data = await new Promise(res => {
      const h = m => { if (m.type === 'sram') { this.worker.off('message', h); res(m.data); } };
      this.worker.on('message', h);
      this.worker.postMessage({ type: 'sram' });
      setTimeout(() => res(null), 2000);
    });
    if (data && data.some(v => v)) fs.writeFileSync(file, data);
  }

  async saveSetup() {
    await this.store.set('setup', { screen: this.screen, pad: this.pad, rom: this.romName });
  }

  // ---------- input ----------

  press(button, ms) {
    const until = ms === Infinity ? Infinity : Date.now() + ms;
    const cur = this.held.get(button) ?? 0;
    this.held.set(button, Math.max(cur, until));
    this.tickPad();
  }

  tickPad() {
    const now = Date.now();
    let state = 0;
    for (const [b, until] of this.held) {
      if (until <= now) this.held.delete(b);
      else state |= 1 << BUTTONS[b];
    }
    if (state !== this.padState) {
      this.padState = state;
      this.worker?.postMessage({ type: 'pad', state });
    }
  }

  onInteract(i) {
    const m = /^snes:(\w+)/.exec(i.message ?? '');
    if (!m || BUTTONS[m[1]] === undefined) return;
    this.press(m[1], this.config['press-ms'] ?? 250);
  }

  // ---------- picture ----------

  async drawLoop() {
    this.drawing = true;
    try {
      while (this.pending && this.screen) {
        const rgb = this.pending;
        this.pending = null;
        const n = this.drawFrame(rgb);
        // don't send bricks faster than the server takes them
        await sleep(Math.max(5, (n / (this.config['bricks-per-second'] ?? 40000)) * 1000));
      }
    } finally {
      this.drawing = false;
    }
  }

  quantized(rgb) {
    const { W, H } = this.screen;
    const q = this.config['color-step'] ?? 8;
    const quant = v => Math.min(255, Math.round(v / q) * q);
    const out = new Int32Array(W * H);
    for (let i = 0; i < W * H; i++) out[i] = (quant(rgb[i * 3]) << 16) | (quant(rgb[i * 3 + 1]) << 8) | quant(rgb[i * 3 + 2]);
    return out;
  }

  /** Redraw the tiles that changed; returns the number of bricks sent. */
  drawFrame(rgb) {
    const s = this.screen;
    const { W, H } = s;
    if (rgb.length !== W * H * 3) return 0; // a frame from before a resize
    const col = this.quantized(rgb);
    const tol = this.config['merge-tolerance'] ?? 16;
    const bricks = [];
    const clears = [];
    for (let ty = 0; ty < H; ty += TILE) for (let tx = 0; tx < W; tx += TILE) {
      const tw = Math.min(TILE, W - tx), th = Math.min(TILE, H - ty);
      let changed = false;
      for (let y = ty; y < ty + th && !changed; y++) for (let x = tx; x < tx + tw; x++) {
        // small drifts below the merge tolerance don't trigger a redraw
        if (!near(col[y * W + x], this.shown[y * W + x], tol >> 1)) { changed = true; break; }
      }
      if (!changed) continue;
      clears.push([tx, ty, tw, th]);
      this.tileBricks(col, tx, ty, tw, th, tol, bricks);
      for (let y = ty; y < ty + th; y++) this.shown.set(col.subarray(y * W + tx, y * W + tx + tw), y * W + tx);
    }
    if (!clears.length) return 0;
    this.recent.push(clears);
    if (this.recent.length > 4) this.recent.shift();
    for (const t of clears) this.clearTile(...t);
    this.loadBricks(bricks);
    return bricks.length + clears.length * 4;
  }

  /** Merged rectangles for one tile (they stay inside it, so its ClearRegion takes them all). */
  tileBricks(color, tx, ty, tw, th, tol, out) {
    const { W, H, n, right, cx, cy, ground, px: P } = this.screen;
    const p = P / 2;
    const glow = this.config['glow-intensity'] ?? 3;
    const used = new Uint8Array(tw * th);
    for (let r = 0; r < th; r++) for (let c = 0; c < tw; c++) {
      if (used[r * tw + c]) continue;
      const seed = color[(ty + r) * W + tx + c];
      const at = (rr, cc) => color[(ty + rr) * W + tx + cc];
      let w = 1;
      while (c + w < tw && !used[r * tw + c + w] && near(at(r, c + w), seed, tol)) w++;
      let h = 1;
      grow: while (r + h < th) {
        for (let k = 0; k < w; k++) if (used[(r + h) * tw + c + k] || !near(at(r + h, c + k), seed, tol)) break grow;
        h++;
      }
      let sr = 0, sg = 0, sb = 0;
      for (let y = 0; y < h; y++) for (let k = 0; k < w; k++) {
        const v = at(r + y, c + k);
        sr += (v >> 16) & 255; sg += (v >> 8) & 255; sb += v & 255;
        used[(r + y) * tw + c + k] = 1;
      }
      const cnt = w * h;
      const along = (tx + c + w / 2 - W / 2) * P;
      const z = ground + (H - (ty + r) - h / 2) * P; // row 0 is the top
      out.push({
        asset: 'PB_DefaultMicroBrick',
        position: [cx + right[0] * along, cy + right[1] * along, z],
        size: n[0] ? [1, w * p, h * p] : [w * p, 1, h * p],
        material: 'BMC_Glow', material_intensity: glow,
        color: [Math.round(sr / cnt), Math.round(sg / cnt), Math.round(sb / cnt)],
      });
    }
  }

  clearTile(tx, ty, tw, th) {
    const { W, H, n, right, cx, cy, ground, px: P } = this.screen;
    const along = (tx + tw / 2 - W / 2) * P;
    const z = ground + (H - ty - th / 2) * P;
    const hw = (tw * P) / 2 + 1, hh = (th * P) / 2 + 1;
    const half = n[0] ? [2, hw, hh] : [hw, 2, hh];
    this.omegga.writeln(`br.World.ClearRegion ${Math.round(cx + right[0] * along)} ${Math.round(cy + right[1] * along)} ${Math.round(z)} ${half.map(Math.ceil).join(' ')}`);
  }

  /** Tiles from the last few loads are redrawn with the next frame. */
  healRecent() {
    const { W } = this.screen;
    for (const set of this.recent) for (const [tx, ty, tw, th] of set) {
      for (let y = ty; y < ty + th; y++) this.shown.fill(-1, y * W + tx, y * W + tx + tw);
    }
    this.recent = [];
  }

  /** Forget what is on screen: the next frame redraws every tile. */
  blank() {
    this.shown = new Int32Array(this.screen.W * this.screen.H).fill(-1);
  }

  clearScreen() {
    const s = this.screen;
    if (!s) return;
    for (let ty = 0; ty < s.H; ty += TILE) for (let tx = 0; tx < s.W; tx += TILE) this.clearTile(tx, ty, Math.min(TILE, s.W - tx), Math.min(TILE, s.H - ty));
  }

  clearPad() {
    const d = this.pad;
    if (!d) return;
    this.silence();
    for (const [, u, v] of PAD) {
      const [x, y] = this.padSpot(u, v);
      this.omegga.writeln(`br.World.ClearRegion ${x} ${y} ${d.z + 6} 11 11 7`);
    }
    const [bx, by] = d.n[0] ? [56, 101] : [101, 56];
    this.omegga.writeln(`br.World.ClearRegion ${d.cx} ${d.cy + 0} ${d.z - 12} ${bx} ${by} 13`);
  }

  padSpot(u, v) {
    const d = this.pad;
    // v runs towards the screen, i.e. against the screen's normal
    return [d.cx + d.right[0] * u - d.n[0] * v, d.cy + d.right[1] * u - d.n[1] * v];
  }

  buildPad() {
    const d = this.pad;
    const bricks = [{
      asset: 'PB_DefaultBrick', position: [d.cx, d.cy + 0, d.z - 12], size: d.n[0] ? [55, 100, 12] : [100, 55, 12],
      color: [35, 35, 40], material: 'BMC_Plastic',
    }];
    for (const [b, u, v, color] of PAD) {
      const [x, y] = this.padSpot(u, v);
      bricks.push({
        asset: 'PB_DefaultBrick', position: [x, y, d.z + 6], size: [10, 10, 6], color, material: 'BMC_Plastic',
        components: [{ type: 'Component_Interact', data: { Message: '', ConsoleTag: `snes:${b}`, bAllowNearbyInteraction: true, bHiddenInteraction: false, PromptCustomLabel: b.toUpperCase() } }],
      });
    }
    this.loadBricks(bricks);
  }

  loadBricks(bricks, externalAssets) {
    if (!bricks.length) return;
    const w = new this.brs.World();
    w.addOwner(OWNER);
    for (const b of bricks) w.addBrick({ asset: 'PB_DefaultBrick', ...b, owner_index: 1 });
    w.makePrefab();
    const ref = `snes_tmp_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const file = path.join(this.prefabDir, ref + '.brz');
    fs.writeFileSync(file, externalAssets ? w.toBrz({ externalAssets }) : w.toBrz());
    this.omegga.writeln(`br.Prefab.Load "${ref}" 0 0 0 1 16`);
    setTimeout(() => fs.rmSync(file, { force: true }), 15_000);
  }

  // ---------- commands ----------

  async playerPos(name) {
    for (let tries = 0; tries < 5; tries++) {
      const pos = await Promise.race([Promise.resolve(this.omegga.getPlayer(name)?.getPosition()).catch(() => null), sleep(3000).then(() => null)]);
      if (pos && pos.some(v => Math.abs(v) > 60)) return pos;
      await sleep(1000);
    }
    throw new Error('could not find where you are standing (are you alive?)');
  }

  async command(name, args) {
    const sub = (args[0] ?? '').toLowerCase();
    const W = msg => this.whisper(name, msg);
    if (!sub || sub === 'help') {
      return W('<color="9cf">/snes load &lt;link to .sfc/.smc | rom name&gt;, /snes here [-x|+x|-y|+y] [64|128|256], /snes a | b | x | y | l | r | start | select | up | down | left | right [seconds], /snes hold &lt;button&gt;, /snes release, /snes sound on|off [sine|square|saw|triangle], /snes reset, /snes pause, /snes roms, /snes off</>');
    }
    if (sub === 'roms') {
      const list = fs.readdirSync(ROMS).filter(f => /\.(sfc|smc)$/i.test(f));
      return W(`<color="9cf">ROMs: ${list.map(sanitize).join(', ') || 'none yet (/snes load <link>)'}</>`);
    }
    if (sub === 'load') {
      if (!args[1]) throw new Error('give a link to a .sfc/.smc file, or a ROM name from /snes roms');
      const file = await this.fetchRom(args.slice(1).join(' '));
      W(`<color="999">Booting ${sanitize(file)}...</>`);
      const info = await this.boot(file);
      this.broadcast(`<color="9cf">${sanitize(name)} put "${sanitize(info.name || file)}" in the SNES (${info.hirom ? 'HiROM' : 'LoROM'}).${this.screen ? '' : ' /snes here to set up a screen.'}</>`);
      return;
    }
    if (sub === 'here' || sub === 'at') {
      // /snes at x y z [facing] [width]: the spot a player would stand on (host/bridge)
      const at = sub === 'at' ? args.slice(1, 4).map(Number) : null;
      if (at && (at.length < 3 || at.some(v => !Number.isFinite(v)))) throw new Error('/snes at x y z [-x|+x|-y|+y] [64|128|256]');
      const rest = at ? args.slice(4) : args.slice(1);
      const facing = rest.find(a => SCREEN_RIGHT[a]) ?? '-x';
      const wArg = Number(rest.find(a => /^\d+$/.test(a)));
      const width = [64, 128, 256].includes(wArg) ? wArg : (this.config['width'] ?? 128);
      const pos = at ? [at[0], at[1], at[2] + FEET] : await this.playerPos(name);
      this.clearScreen();
      this.clearPad();
      const px = this.config['pixel-size'] ?? 2;
      const n = NORMAL[facing], right = SCREEN_RIGHT[facing];
      const snap = v => Math.round(v / STUD) * STUD;
      const dist = Math.max(20, Math.round((width * px * 0.8) / STUD)) * STUD;
      const ground = Math.round((pos[2] - FEET) / 4) * 4;
      this.screen = { cx: snap(pos[0] - n[0] * dist), cy: snap(pos[1] - n[1] * dist), ground: ground + 40, W: width, H: (width * 224) / 256, n, right, px, facing };
      // controller pedestal: a step in front of the player, towards the screen
      this.pad = { cx: snap(pos[0] - n[0] * 80), cy: snap(pos[1] - n[1] * 80), z: ground + 24, n, right };
      this.blank();
      this.buildPad();
      this.sendView();
      await this.saveSetup();
      return W(`<color="9cf">Screen up. Look at a button on the pedestal and press interact, or chat /snes a, /snes right 2.${this.worker ? '' : ' Load a game: /snes load <link>.'}</>`);
    }
    if (sub === 'off') {
      await this.saveSram().catch(() => {});
      await this.worker?.terminate();
      this.worker = null;
      this.clearScreen();
      this.clearPad();
      this.screen = this.pad = null;
      this.romName = null;
      await this.saveSetup();
      return W('<color="9cf">SNES off, screen and controller removed.</>');
    }
    if (!this.worker) throw new Error('no game loaded: /snes load <link>');
    if (sub === 'reset') { this.worker.postMessage({ type: 'reset' }); return; }
    if (sub === 'pause') {
      this.paused = !this.paused;
      this.worker.postMessage({ type: 'pause', value: this.paused });
      if (this.paused) this.silence();
      return W(`<color="9cf">${this.paused ? 'Paused' : 'Running'}.</>`);
    }
    if (sub === 'redraw') { if (this.screen) { this.clearScreen(); this.blank(); } return; }
    if (sub === 'sound') {
      const on = args[1] ? !/^(off|0|no|false)$/i.test(args[1]) : !(this.config['sound'] ?? true);
      this.config['sound'] = on;
      if (args[2] && SYNTHS[args[2]]) this.config['synth'] = args[2];
      if (!on) this.silence();
      this.sendAudio();
      return W(`<color="9cf">Sound ${on ? `on (${this.config['synth'] ?? 'square'})` : 'off'}.</>`);
    }
    if (sub === 'release') { this.held.clear(); this.tickPad(); return; }
    if (sub === 'stats') {
      const st = await new Promise(res => {
        const h = m => { if (m.type === 'stats') { this.worker.off('message', h); res(m.stats); } };
        this.worker.on('message', h);
        this.worker.postMessage({ type: 'stats' });
      });
      return W(`<color="9cf">${st.frames ? (st.ms / st.frames).toFixed(1) : '-'} ms per emulated frame (16.6 = full speed), ${st.done} frames run.</>`);
    }
    if (sub === 'hold') {
      for (const b of args.slice(1).map(canon)) this.press(b, Infinity);
      return;
    }
    // buttons: /snes a, /snes up a 1.5
    const secs = Number(args.find(a => /^\d+(\.\d+)?$/.test(a)));
    const btns = args.filter(a => !/^\d/.test(a)).map(canon);
    for (const b of btns) this.press(b, secs ? Math.min(30, secs) * 1000 : (this.config['press-ms'] ?? 250));
  }

  /** A ROM by name from roms/, or downloaded from a link into roms/. Returns the file name. */
  async fetchRom(arg) {
    const link = arg.replace(/^<link="?([^">]+)"?>.*$/i, '$1').replace(/^<|>$/g, '');
    if (!/^https?:\/\//i.test(link)) {
      const want = link.toLowerCase();
      const list = fs.readdirSync(ROMS).filter(f => /\.(sfc|smc)$/i.test(f));
      const hit = list.find(f => f.toLowerCase() === want) ?? list.find(f => f.toLowerCase().replace(/\.[^.]+$/, '') === want) ?? list.find(f => f.toLowerCase().includes(want));
      if (!hit) throw new Error(`no ROM called ${link} (/snes roms)`);
      return hit;
    }
    const url = new URL(link);
    const addrs = net.isIP(url.hostname) ? [{ address: url.hostname }] : await dns.lookup(url.hostname, { all: true }).catch(() => []);
    if (!addrs.length) throw new Error(`can't find the site ${url.hostname}`);
    if (addrs.some(a => isPrivateAddress(a.address))) throw new Error('that link points at a private network address');
    const res = await fetch(url.href, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`the link answered HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 12 << 20) throw new Error('that file is too big for a SNES ROM');
    if (buf.length % 0x8000 !== 0 && (buf.length - 512) % 0x8000 !== 0) throw new Error('that is not a .sfc/.smc ROM (wrong size; zips are not unpacked)');
    let base = decodeURIComponent(path.basename(url.pathname)).replace(/[^\w .()-]/g, '_').slice(0, 80) || 'rom';
    if (!/\.(sfc|smc)$/i.test(base)) base += '.sfc';
    fs.writeFileSync(path.join(ROMS, base), buf);
    return base;
  }
};

function canon(b) {
  const k = ALIAS[b.toLowerCase()] ?? b.toLowerCase();
  if (BUTTONS[k] === undefined) throw new Error(`no button "${sanitize(b)}" (a b x y l r start select up down left right)`);
  return k;
}

function near(v, s, tol) {
  if (v === s) return true;
  if (v < 0 || s < 0) return false;
  return Math.abs(((v >> 16) & 255) - ((s >> 16) & 255)) <= tol && Math.abs(((v >> 8) & 255) - ((s >> 8) & 255)) <= tol && Math.abs((v & 255) - (s & 255)) <= tol;
}
