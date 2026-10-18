// Media: /playvideo and /playaudio in the live world.
//
// Brickadia can't stream custom sound or pictures, so:
//   /playvideo <link>  downloads the video (yt-dlp), scales it down with
//       ffmpeg and plays it on a wall of bricks in front of the player.
//       Each frame clears the screen and loads in the same place (config
//       layers 1, the default); layers 2 alternates two layers 2 units apart
//       (no flicker, but the picture steps back and forth).
//   /playaudio <sound>  puts a speaker brick (Component_AudioEmitter) with
//       one of the game's built-in sounds/music above the player.
//   /playaudio <link>   builds a self-playing speaker device with
//       heightmap2brz (bin/heightmap): a microchip drives synth speakers that
//       track the song's pitches, so the game plays it with nothing streamed.
//       'midi' transcribes with Spotify's basic-pitch first (tomidi.py, venv).
//
// Bricks are written as temporary .brz prefabs (brs-js) and loaded with
// absolute coordinates, so br.World.ClearRegion removes them exactly.
// Unsafe (plain node) plugin, like the bridge and chatbot plugins.

const fs = require('fs');
const net = require('net');
const dns = require('dns').promises;
const path = require('path');
const { execFile, spawn } = require('child_process');
const { pathToFileURL } = require('url');

const SOUNDS = require('./sounds.json');
const TTS = require('./tts.js');
const AT = require('./autotune.js');
const AF = require('./audiofix.js');
const YTDLP = path.join(__dirname, 'bin', 'yt-dlp');
const PYTHON = path.join(__dirname, 'venv', 'bin', 'python');
const HEIGHTMAP = path.join(__dirname, 'bin', 'heightmap');
const TMP = path.join(__dirname, 'tmp');
const CACHE = path.join(TMP, 'cache');
// OFF 2026-10-11: merged soundtracks sounded far worse in game (loopback score 1.08/1.09 merged vs 1.42
// as separate chips, 1.45 for the same device alone; owner: "it sucks ingame"). Separate chips keep
// their own clocks and buttons. Likely cause: the video clock drives the audio chip once merged.
const MERGE_AUDIO = false;
// clock probe merged into every /playvideo chunk (probe.ws): reports the chunk's game time
const PROBE_FILE = path.join(__dirname, 'probe.brz');
const CACHE_MAX = 4; // owner 2026-10-11: keep the last 4 downloads
const OWNER = { id: '3f9b2d71-6c4e-4a8b-9e15-7d20c1a4b5e7', name: 'Claude Media' };

// Brickadia units: 1 stud = 10 wide, 1 brick = 12 tall.
const STUD = 10;
const FEET = 25; // a standing player's position is this far above the ground
// Which way "right" runs along a screen, by the side it faces (from chatbot).
const SCREEN_RIGHT = { '-x': [0, 1], '+x': [0, -1], '-y': [-1, 0], '+y': [1, 0] };
const NORMAL = { '-x': [-1, 0], '+x': [1, 0], '-y': [0, -1], '+y': [0, 1] };
// heightmap2brz lays its video screen flat (x = column, y = row, rows going
// down the picture). Prefab.Load orientation that stands it up with the
// columns along the screen's right and the rows going down, by right vector,
// and where a file point lands relative to the load spot (measured 2026-10-11).
const CHIP_ORIENT = {
  '0,-1': [1, ([x, y, z]) => [z, -x, -y]],
  '0,1': [5, ([x, y, z]) => [-z, x, -y]],
  '1,0': [9, ([x, y, z]) => [x, z, -y]],
  '-1,0': [13, ([x, y, z]) => [-x, -z, -y]],
};
// 4-segment pixels (the owner's trick, 2026-10-04): four
// PB_DefaultMicroWedgeHalfInnerCornerInverted at one spot each show one
// triangle of a micro cell's face. On a screen facing -x (seen looking +x):
// top 3/1, right (+y) 4/2, bottom 4/0, left (-y) 5/0 (direction/rotation).
// Other facings turn that set about +z (orient.mjs ORIENT table).
const ORIENT = [
  ([x, y, z]) => [z, -y, x], ([x, y, z]) => [z, -x, -y], ([x, y, z]) => [z, y, -x], ([x, y, z]) => [z, x, y],
  ([x, y, z]) => [-z, y, x], ([x, y, z]) => [-z, x, -y], ([x, y, z]) => [-z, -y, -x], ([x, y, z]) => [-z, -x, y],
  ([x, y, z]) => [y, z, x], ([x, y, z]) => [x, z, -y], ([x, y, z]) => [-y, z, -x], ([x, y, z]) => [-x, z, y],
  ([x, y, z]) => [-y, -z, x], ([x, y, z]) => [-x, -z, -y], ([x, y, z]) => [y, -z, -x], ([x, y, z]) => [x, -z, y],
  ([x, y, z]) => [x, y, z], ([x, y, z]) => [-y, x, z], ([x, y, z]) => [-x, -y, z], ([x, y, z]) => [y, -x, z],
  ([x, y, z]) => [-x, y, -z], ([x, y, z]) => [y, x, -z], ([x, y, z]) => [x, -y, -z], ([x, y, z]) => [-y, -x, -z],
];
const turnCode = (code, r) => {
  const R = ([x, y, z]) => { for (let i = 0; i < r; i++) [x, y] = [-y, x]; return [x + 0, y + 0, z]; };
  const want = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(v => R(ORIENT[code](v)).join());
  return ORIENT.findIndex(f => [[1, 0, 0], [0, 1, 0], [0, 0, 1]].every((v, i) => f(v).map(q => q + 0).join() === want[i]));
};
const SEG_BASE = [3 * 4 + 1, 4 * 4 + 2, 4 * 4 + 0, 5 * 4 + 0]; // top, right, bottom, left
const SEG_TURN = { '-x': 0, '-y': 1, '+x': 2, '+y': 3 };
// 2-segment cells (also the owner's): a PB_DefaultMicroRamp and an upside-down
// one at the same spot split the face on a diagonal. On a -x screen:
// '/' = lower-right 4/3 + upper-left 5/1, '' = lower-left 4/1 + upper-right 5/3
const DIAG_BASE = { fwd: [4 * 4 + 3, 5 * 4 + 1], back: [4 * 4 + 1, 5 * 4 + 3] };
const DIAGS = Object.fromEntries(Object.entries(SEG_TURN).map(([f, r]) => [f, Object.fromEntries(Object.entries(DIAG_BASE).map(([d, cs]) => [d, cs.map(c => { const t = turnCode(c, r); return { direction: t >> 2, rotation: t & 3 }; })]))]));
const SEGS = Object.fromEntries(Object.entries(SEG_TURN).map(([f, r]) => [f, SEG_BASE.map(c => { const t = turnCode(c, r); return { direction: t >> 2, rotation: t & 3 }; })]));
// /playaudio presets (2026-10-04): sines + noise resynthesis tuned per material
//   speech: pitch-per-speaker sine bank, 24 steps/octave, fast release, no noise
//   music:  transcribe to MIDI, a wave per instrument
//   drums / mix: 32 tracking sine voices plus 2 pink/white noise bands for hats, snares, breath
// layered (default): the track split by frequency, one device per range, each
// with the wave that suits it -- bass triangle voices, mids sine voices, highs a
// noise bank (pink/white) -- loaded side by side so they start together
// gains tuned 2026-10-05 by loopback-recording the game and comparing octave levels with the source (score 0.61 -> 0.74: bass gain 0.5, mids 32 voices + 15 ms voice release, highs all bands)
const LAYERS = [
  {'name': 'bass', 'filter': 'lowpass=f=250', 'synth': 'triangle', 'mode': 'voice', 'flags': ['--max-voices', '8', '--gain', '0.8']},
  {'name': 'mids', 'filter': 'highpass=f=250,lowpass=f=2000', 'synth': 'sine', 'mode': 'bank', 'flags': ['--subdiv', '12', '--max-voices', '0', '--release', '60', '--attack', '5', '--gain', '1.0']},
  {'name': 'treble', 'filter': 'highpass=f=2000,lowpass=f=6000', 'synth': 'sine', 'mode': 'voice', 'flags': ['--max-voices', '12', '--voice-release', '15', '--pitch-snap', '50', '--gain', '0.55']},
];
// retuned 2026-10-11 (loopback, mel band-envelope + spectral-shape score vs a speech clip):
// explicit --leveling 0 + release 60 / attack 5 lifted 1.27 -> 1.52; gain 3 keeps the old loudness
// Loading words (owner 2026-10-16: "make all loading... text say felching... scromiting... munting... gooning... and other ones")
const LOADING = ['Felching', 'Scromiting', 'Munting', 'Gooning', 'Schlorping', 'Flonking', 'Gronking', 'Boofing', 'Scrungling', 'Blorbing',
  'Squonking', 'Crunkling', 'Jorking', 'Yeeting', 'Smooshing', 'Honking', 'Slurping', 'Bonking', 'Noodling', 'Goblining',
  'Discombobulating', 'Frobnicating', 'Bamboozling', 'Hornswoggling', 'Lollygagging', 'Skedaddling', 'Kerfuffling', 'Gallumphing',
  'Flibbertigibbeting', 'Shenaniganing', 'Spelunking', 'Schmoozing', 'Dilly-dallying', 'Wrangling', 'Brapping', 'Snorkeling'];
const loading = () => LOADING[Math.floor(Math.random() * LOADING.length)];

const SPEECH_FLAGS = ['--max-voices', '32', '--voice-release', '15', '--attack', '5', '--release', '60', '--leveling', '0', '--gain', '3'];
// auto-tuning: cleanup chains + voice-mode flag sets live in audiofix.js
// (voice only: the simulator ranked voice configs like the in-game
// recordings, Spearman 0.91 over 22 configs on ONE clip, but rated bank/noise
// devices far above how they actually sounded in game).
const PRESETS = {
  // pick the best candidate per soundtrack (owner 2026-10-11: "automatically tunes audio")
  auto: { auto: true },
  // heightmap2brz defaults: only the mode, no synth/voice/fps flags (/playvideo's default)
  default: { mode: 'bank', flags: [], raw: true },
  layered: { layered: true },
  // one device (sine voices tracking the strongest pitches), one speaker set instead of three
  single: { mode: 'voice', flags: ['--max-voices', '32', '--voice-release', '15'] },
  // speech tuned 2026-10-06 by loopback against a TTS clip (formant + band-envelope score):
  // voice 32/15 ms 0.76, bank 24 0.54, bank 12 0.58, voice 40 ms 0.74, bank all-bands 0.24
  speech: { mode: 'voice', flags: SPEECH_FLAGS },
  // speech + white noise for the highs the sine voices can't make (s, f, hats):
  // a bank device fed only >4 kHz, 2 tonal bands (silent there) + 2 noise bands.
  // The default for /playvideo, /search and /playaudio links.
  hiss: { layers: [
    { name: 'voice', synth: 'sine', mode: 'voice', flags: SPEECH_FLAGS },
    { name: 'hiss', filter: 'highpass=f=4000', mode: 'bank', flags: ['--bands', '4', '--noise-bands', '2', '--max-voices', '0', '--attack', '5', '--release', '60', '--leveling', '0', '--gain', '1'] },
  ] },
  music: { mode: 'midi', flags: [] },
  // noise bands and --release only work in bank mode (voice mode ignores both)
  drums: { mode: 'bank', flags: ['--subdiv', '12', '--noise-bands', '2', '--release', '90', '--attack', '3', '--max-voices', '0'] },
  mix: { mode: 'bank', flags: ['--subdiv', '12', '--noise-bands', '2', '--release', '120', '--max-voices', '24'] },
};
const SYNTHS = {
  sine: 'BA_Synth_Basic_Sine',
  square: 'BA_Synth_Basic_Square',
  saw: 'BA_Synth_Basic_Sawtooth',
  triangle: 'BA_Synth_Basic_Triangle',
};

const sanitize = str =>
  String(str)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '&scl;')
    .replace(/>/g, '&gt;')
    .replace(/_/g, '&und;')
    .replace(/</g, '&lt;')
    .replace(/"/g, "'");

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Raw rgb24 frames from a running ffmpeg, decoded as they are needed: at most
 * `ahead` frames are held (stdout pauses past that), so an hour of video
 * never sits in memory.
 */
class FrameStream {
  constructor(proc, frameBytes, ahead) {
    Object.assign(this, { proc, frameBytes, ahead, base: 0, frames: [], parts: [], partLen: 0, ended: false, waiters: [], err: '' });
    proc.stderr.on('data', d => (this.err = (this.err + d).slice(-500)));
    proc.stdout.on('data', chunk => {
      for (let off = 0; off < chunk.length; ) {
        const take = Math.min(frameBytes - this.partLen, chunk.length - off);
        this.parts.push(chunk.subarray(off, off + take));
        this.partLen += take;
        off += take;
        if (this.partLen === frameBytes) {
          this.frames.push(Buffer.concat(this.parts));
          this.parts = [];
          this.partLen = 0;
        }
      }
      if (this.frames.length >= ahead) proc.stdout.pause();
      this.wake();
    });
    proc.on('close', () => ((this.ended = true), this.wake()));
    proc.on('error', e => ((this.err = e.message), (this.ended = true), this.wake()));
  }

  wake() {
    const w = this.waiters;
    this.waiters = [];
    w.forEach(f => f());
  }

  /** Frame i (frames before it are dropped), or null once the video is over. */
  async get(i) {
    for (;;) {
      const drop = Math.min(Math.max(0, i - this.base), this.frames.length);
      this.frames.splice(0, drop);
      this.base += drop;
      if (this.frames.length < this.ahead && !this.ended) this.proc.stdout.resume();
      if (this.frames.length && this.base >= i) return this.frames[0];
      if (this.ended) return null;
      await new Promise(r => this.waiters.push(r));
    }
  }

  kill() {
    this.proc.kill('SIGKILL');
  }
}

/** Run a program, resolve with stdout (a Buffer), reject with the last line of stderr. */
const run = (cmd, args, timeout = 120_000, maxBuffer = 64 << 20) =>
  new Promise((resolve, reject) =>
    execFile(cmd, args, { timeout, maxBuffer, encoding: 'buffer' }, (err, stdout, stderr) => {
      if (!err) return resolve(stdout);
      const why = String(stderr || '').trim().split('\n').pop() || err.message;
      reject(new Error(`${path.basename(cmd)} failed: ${why}`));
    })
  );

/** Loopback, LAN and link-local addresses, so links can't reach the server's network. */
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

const looksLikeLink = s => /^<?https?:\/\//i.test(s) || /^<link=/i.test(s);

/** Short display name for a sound asset. */
const soundLabel = s => s.replace(/^BA_(MUS_Component_|MUS_|AMB_Component_|AMB_)?/, '');

module.exports = class Media {
  constructor(omegga, config, store) {
    this.omegga = omegga;
    this.config = config;
    this.store = store;
    // one session map for the whole Omegga process: a reload creates a new
    // instance while the old one's videos keep running (2026-10-11: screens
    // kept reappearing every 60 s after /stop, from instances replaced by a
    // reload). init() stops whatever an earlier instance left playing.
    this.sessions = new Map(); // `${kind}:${player}` -> session
  }

  async init() {
    this.brs = await import(pathToFileURL(path.join(__dirname, 'lib/brs.mjs')).href);
    this.autostart = await import(pathToFileURL(path.join(__dirname, 'autostart.mjs')).href);
    // !tv: wire TV (tv.mjs) writes EA3.2 loop chips with brs-js 4 (lib/brs4.mjs = tools/brs4/dist.mjs)
    try {
      this.brs4 = await import(pathToFileURL(path.join(__dirname, 'lib/brs4.mjs')).href);
      // ?v=mtime: Omegga reloads keep the process, and its ESM cache would keep an old tv.mjs
      this.tv = await import(pathToFileURL(path.join(__dirname, 'tv.mjs')).href + '?v=' + fs.statSync(path.join(__dirname, 'tv.mjs')).mtimeMs);
      this.og = await import(pathToFileURL(path.join(__dirname, 'ogrid.mjs')).href + '?v=' + fs.statSync(path.join(__dirname, 'ogrid.mjs')).mtimeMs);
    } catch (e) { console.error('[media] !tv disabled', e); }
    for (const old of global.__mediaSessions?.values() ?? []) {
      try { old.stop?.(); old.clear?.(); } catch {}
    }
    global.__mediaSessions = this.sessions;
    // a reload forgets the old instance's screens but their bricks stay, and the next video at
    // that spot was refused as overlapping (2026-10-12: 2774 pixels): wipe the media owner's bricks
    this.omegga.writeln(`br.Bricks.Clear ${OWNER.id} 1`);
    this.prefabDir = path.join(path.dirname(this.omegga.savePath), 'Prefabs');
    fs.mkdirSync(this.prefabDir, { recursive: true });
    // never wipe tmp on load: a reload left the previous instance's videos
    // playing from files there (2026-10-11: soundtracks/chunks failed with
    // "No such file"). Only leftovers older than 6 hours go.
    fs.mkdirSync(CACHE, { recursive: true });
    const old = Date.now() - 6 * 3600_000;
    for (const dir of [TMP, CACHE]) {
      for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        try { if (fs.statSync(p).isFile() && fs.statSync(p).mtimeMs < old) fs.rmSync(p, { force: true }); } catch {}
      }
    }
    this.cache = new Map(); // key -> { file, uses }
    // Prefabs left over from a crash or reload
    for (const f of fs.readdirSync(this.prefabDir)) if (f.startsWith('media_tmp_')) fs.rmSync(path.join(this.prefabDir, f), { force: true });

    const on = (events, fn) => {
      const handler = (name, ...args) =>
        fn.call(this, name, args.join(' ').trim().split(/\s+/).filter(Boolean)).catch(err => {
          console.error('[media]', err);
          this.whisper(name, `<color="f55">${sanitize(String(err.message ?? err).slice(0, 180))}</>`);
        });
      // Unsafe plugins share Omegga's event emitter: drop handlers from earlier loads.
      for (const e of events) {
        this.omegga.removeAllListeners(e);
        this.omegga.on(e, handler);
      }
    };
    // (owner 2026-10-13: "videos switching too early") each chunk's probe logs its game time;
    // the chunk scheduler follows that instead of the wall clock (game time falls behind
    // while the server is busy, e.g. building the next chunk)
    this.probe = fs.existsSync(PROBE_FILE) ? fs.readFileSync(PROBE_FILE) : null;
    this.omegga.removeAllListeners('wirecmd:mediaclip');
    this.omegga.on('wirecmd:mediaclip', (n, ...xyz) => {
      const sec = Number(n), at = xyz.map(v => Number(String(v).replace(/,/g, '')));
      if (!Number.isFinite(sec) || at.length < 3 || at.some(v => !Number.isFinite(v))) return;
      for (const s of this.sessions.values()) s.probe?.(sec, at);
    });
    on(['cmd:playvideo', 'chatcmd:playvideo'], this.videoCommand);
    on(['cmd:search', 'chatcmd:search'], this.searchCommand);
    on(['cmd:playaudio', 'chatcmd:playaudio'], this.audioCommand);
    // /tts moved into a Wirescript chip (tts/tts.ws); the server-side ttsCommand stays for reference.
    // The chip only hears the slash command, so point "!tts" users at it
    on(['chatcmd:tts', 'chatcmd:ttsvol'], async name => this.whisper(name, '<color="9cf">Use /tts with a slash: /tts hello there</>'));
    on(['cmd:stop', 'chatcmd:stop', 'cmd:stopmedia', 'chatcmd:stopmedia'], this.stopCommand);
    on(['cmd:tv', 'chatcmd:tv'], this.tvCommand);
    on(['cmd:textvideo', 'chatcmd:textvideo'], (name, args) => this.tvCommand(name, args, 'text'));
    on(['cmd:ogrid', 'chatcmd:ogrid'], this.oGridCommand);
    return { registeredCommands: ['playvideo', 'search', 'playaudio', 'stop', 'stopmedia', 'tv', 'textvideo', 'ogrid'] };
  }

  async stop() {
    // don't leave frozen frames or droning speakers behind on reload
    for (const s of this.sessions.values()) {
      s.stop?.();
      s.clear?.();
    }
    this.sessions.clear();
  }

  whisper(name, msg) {
    this.omegga.writeln(`br.Chat.Whisper "${name}" ${msg}`);
  }

  broadcast(msg) {
    this.omegga.writeln(`br.Chat.Broadcast ${msg}`);
  }

  async playerSpot(name) {
    // a dead or respawning player can read as (0,0,0): retry a few times
    for (let tries = 0; tries < 5; tries++) {
      const p = this.omegga.getPlayer(name);
      const pos = await Promise.race([Promise.resolve(p?.getPosition()).catch(() => null), sleep(3000).then(() => null)]);
      if (pos && pos.some(v => Math.abs(v) > 60)) return pos;
      await sleep(1000);
    }
    throw new Error('could not find where you are standing (are you alive?)');
  }

  // ---------- prefab plumbing ----------

  /** Load a .brz buffer at its own coordinates. */
  loadBrz(buf) {
    const ref = `media_tmp_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const file = path.join(this.prefabDir, ref + '.brz');
    fs.writeFileSync(file, buf);
    this.omegga.writeln(`br.Prefab.Load "${ref}" 0 0 0 1 16`);
    setTimeout(() => fs.rmSync(file, { force: true }), 15_000);
  }

  /**
   * Plain bricks: [{ position, size, color, asset?, material? }]
   * Written with the brdb World writer: only its prefab metadata lets
   * Prefab.Load put bricks back at their own coordinates (legacy .brz can't).
   */
  loadBricks(bricks) {
    const w = new this.brs.World();
    w.addOwner(OWNER);
    for (const b of bricks) w.addBrick({ asset: 'PB_DefaultBrick', ...b, owner_index: 1 });
    w.makePrefab();
    this.loadBrz(w.toBrz());
  }

  /** One speaker brick playing a built-in sound. */
  loadSpeaker(pos, sound, { volume = 1, pitch = 1, range = 1500, spatial = true } = {}) {
    const w = new this.brs.World();
    w.addOwner(OWNER);
    w.addBrick({
      asset: 'B_1x1F_Speaker',
      position: pos,
      color: [20, 20, 20],
      owner_index: 1,
      components: [{
        type: 'Component_AudioEmitter',
        data: {
          bEnabled: true, AudioDescriptor: 0, VolumeMultiplier: volume, PitchMultiplier: pitch,
          InnerRadius: Math.min(100, range / 4), MaxDistance: range, bSpatialization: spatial,
          FocusAzimuth: 360, NonFocusAzimuth: 360, NonFocusVolumeAttenuation: 1,
        },
      }],
    });
    w.makePrefab();
    this.loadBrz(w.toBrz({ externalAssets: [{ type: 'BrickAudioDescriptor', name: sound }] }));
  }

  clearBox(center, half) {
    this.omegga.writeln(`br.World.ClearRegion ${center.map(Math.round).join(' ')} ${half.map(v => Math.ceil(v) + 1).join(' ')}`);
  }

  // ---------- downloads ----------

  async checkLink(link) {
    let url;
    try {
      url = new URL(String(link).replace(/^<link="?([^">]+)"?>.*$/i, '$1').replace(/^<|>$/g, ''));
    } catch {
      throw new Error('that is not a valid link');
    }
    if (!/^https?:$/.test(url.protocol)) throw new Error('only http and https links work');
    // YouTube Music links: yt-dlp rejects music.youtube.com, the same video is on www
    if (url.hostname === 'music.youtube.com') url.hostname = 'www.youtube.com';
    const host = url.hostname.replace(/^\[|\]$/g, '');
    const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true }).catch(() => []);
    if (!addrs.length) throw new Error(`can't find the site ${host}`);
    if (addrs.some(a => isPrivateAddress(a.address))) throw new Error('that link points at a private network address');
    return url.href;
  }

  /** Download with yt-dlp (works for YouTube and most sites, and plain file links). */
  /**
   * Cached download: the same link (and kind) within the last CACHE_MAX
   * downloads reuses the file. Hand it back with release() when done.
   */
  async download(link, kind, withAudio = false, maxMin = this.config['max-minutes'] ?? 10) {
    const key = `${kind}|${withAudio}|${maxMin}|${link}`;
    let hit = this.cache.get(key);
    if (hit && fs.existsSync(hit.file)) {
      this.cache.delete(key);
      this.cache.set(key, hit); // most recent last
    } else {
      const tmp = await this.fetchMedia(link, kind, withAudio, maxMin);
      const file = path.join(CACHE, path.basename(tmp));
      fs.renameSync(tmp, file);
      hit = { file, uses: 0 };
      this.cache.set(key, hit);
      // evict the oldest ones not playing right now
      for (const [k, v] of this.cache) {
        if (this.cache.size <= CACHE_MAX) break;
        if (v.uses || v === hit) continue;
        fs.rmSync(v.file, { force: true });
        this.cache.delete(k);
      }
    }
    hit.uses++;
    return hit.file;
  }

  /** Done with a download(): cached files stay, anything else is deleted. */
  release(file) {
    for (const v of this.cache.values()) if (v.file === file) return void (v.uses = Math.max(0, v.uses - 1));
    fs.rmSync(file, { force: true });
  }

  /**
   * Download routes in order (2026-10-11: YouTube bot-checked the server's IP,
   * v4 and v6; the owner chose free GitHub proxy lists). Config `proxy` forces
   * one. Otherwise direct, unless direct was bot-checked in the last 30 min;
   * then up to 6 free proxies that answered YouTube's generate_204 in the last
   * test (lists in config proxy-lists, re-tested every 20 min), the last one
   * that worked first. Downloads keep TLS checks on, so a proxy can't read or
   * change what it carries, only fail.
   */
  async proxyRoutes() {
    if (this.config['proxy']) return [String(this.config['proxy'])];
    const direct = !this.directBlockedUntil || Date.now() > this.directBlockedUntil;
    if (direct) return ['', ...(await this.testedProxies()).slice(0, 6)];
    const pool = await this.testedProxies();
    return [...new Set([this.proxyGood, ...pool].filter(Boolean))].slice(0, 6);
  }

  async testedProxies() {
    if (this.proxyPool?.length >= 3 && Date.now() - this.proxyTested < 20 * 60_000) return this.proxyPool;
    if (this.proxyTesting) return this.proxyTesting;
    this.proxyTesting = (async () => {
      const lists = this.config['proxy-lists'] || 'https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/http/data.txt https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt';
      const all = [];
      for (const url of String(lists).split(/\s+/).filter(Boolean)) {
        try {
          const text = await (await fetch(url, { signal: AbortSignal.timeout(20_000) })).text();
          for (const line of text.split(/\r?\n/)) {
            const t = line.trim();
            if (/^(socks5|http):\/\/[\d.]+:\d+$/.test(t)) all.push(t);
            else if (/^[\d.]+:\d+$/.test(t)) all.push((/socks5/i.test(url) ? 'socks5://' : 'http://') + t);
          }
        } catch (e) { console.error('[media] proxy list', url, e.message); }
      }
      for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
      // about 3% of a free list reaches YouTube: test 400, 60 at a time
      const cand = all.slice(0, 400), alive = [];
      let next = 0;
      await Promise.all(Array.from({ length: 60 }, async () => {
        while (next < cand.length) {
          const p = cand[next++];
          try {
            const out = await run('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', '--max-time', '6', '-x', p, 'https://www.youtube.com/generate_204'], 10_000);
            if (String(out).trim() === '204') alive.push(p);
          } catch {}
        }
      }));
      console.log(`[media] proxies: ${alive.length} of ${cand.length} tested reach YouTube`);
      this.proxyPool = alive;
      this.proxyTested = Date.now();
      return alive;
    })().finally(() => { this.proxyTesting = null; });
    return this.proxyTesting;
  }

  async fetchMedia(link, kind, withAudio = false, maxMin = this.config['max-minutes'] ?? 10) {
    if (!fs.existsSync(YTDLP)) throw new Error('yt-dlp is missing from the plugin (bin/yt-dlp)');
    // !search: a YouTube search (yt-dlp takes the first hit that fits the length limit)
    const search = /^ytsearch\d*:/.test(link);
    const href = search ? link : await this.checkLink(link);
    const id = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    if (!search && /\.midi?$/i.test(new URL(href).pathname)) {
      // MIDI files aren't media to yt-dlp; fetch them directly
      const res = await fetch(href, { signal: AbortSignal.timeout(30_000), redirect: 'error' });
      if (!res.ok) throw new Error(`the link answered HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 5 << 20) throw new Error('that MIDI file is too big');
      const out = path.join(TMP, `${id}.mid`);
      fs.writeFileSync(out, buf);
      return out;
    }
    // YouTube 403s some stream types at random; HLS (m3u8) ones are the most
    // reliable, so try those first and fall back to anything else.
    const formats = kind === 'audio'
      ? ['ba[protocol^=m3u8]/ba', 'ba*/b', 'w']
      : withAudio
        // 360p is plenty for a screen at most 160 pixels wide, and keeps hour-long downloads small
        ? ['bv*[height<=360][protocol^=m3u8]+ba[protocol^=m3u8]/bv*[height<=360]+ba/b[height<=480]', 'bv*+ba/b', 'w']
        : ['bv*[height<=360][protocol^=m3u8]/bv*[height<=360]/b[height<=480]', 'bv*/b', 'wv*/w'];
    let lastErr;
    const saved = () => fs.readdirSync(TMP).some(f => f.startsWith(id + '.') && !/\.part$|\.f\d+\./.test(f));
    // routes: direct, or (once YouTube bot-checks the server) free proxies (see proxyRoutes)
    for (const route of await this.proxyRoutes()) {
      let blocked = false;
      for (const fmt of formats) {
        for (const f of fs.readdirSync(TMP)) if (f.startsWith(id + '.')) fs.rmSync(path.join(TMP, f), { force: true });
        try {
          await run(YTDLP, [
            // YouTube needs a JS runtime for its download challenges; use this node
            '--js-runtimes', `node:${process.execPath}`,
            ...(route ? ['--proxy', route, '--socket-timeout', '20'] : []),
            '--no-playlist', '--no-progress', '--quiet', '--no-warnings',
            '--retries', '3', '--fragment-retries', '5',
            '--max-filesize', kind === 'video' ? '4G' : '300M',
            '--match-filter', `duration <=? ${maxMin * 60}`,
            ...(search ? ['--max-downloads', '1'] : []),
            '-f', fmt, '-o', path.join(TMP, `${id}.%(ext)s`), href,
          ], kind === 'video' ? 3_600_000 : 300_000);
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
          // a search exits non-zero at --max-downloads 1, with the video already saved
          if (search && saved()) break;
          // bot check, or a dead/slow proxy: next route
          if (/confirm you.re not a bot|Sign in to confirm|page needs to be reloaded|No video formats found/i.test(e.message) ||
            (route && /proxy|timed out|Connection|Unable to download|Errno|SSL|tunnel/i.test(e.message))) { blocked = true; break; }
          if (!/403|Forbidden|format is not available|fragment/i.test(e.message)) break;
          console.log(`[media] ${fmt} failed (${e.message}), trying another format`);
        }
      }
      if (!blocked) {
        if (route) this.proxyGood = route; // stick with a proxy that works
        break;
      }
      if (!route) this.directBlockedUntil = Date.now() + 30 * 60_000; // YouTube wants a sign-in: proxies for 30 min
      else {
        this.proxyPool = (this.proxyPool ?? []).filter(p => p !== route);
        if (this.proxyGood === route) this.proxyGood = null;
      }
      console.log(`[media] download route ${route || 'direct'} failed (${String(lastErr?.message).slice(0, 120)}), trying the next`);
    }
    const file = fs.readdirSync(TMP).find(f => f.startsWith(id + '.') && !/\.part$|\.f\d+\./.test(f));
    // --max-downloads exits non-zero once it has its one video
    if (lastErr && !(search && file)) throw lastErr;
    if (!file) throw new Error(`nothing downloaded (longer than ${maxMin} minutes, or no ${kind} found)`);
    return path.join(TMP, file);
  }

  // ---------- /playvideo ----------

  async videoCommand(name, args) {
    const key = `video:${name}`;
    if (!args.length) {
      return this.whisper(name, 'Usage: /playvideo link [width] [fps=N] [-x|+x|-y|+y] [mute] [speech|music|drums|mix|layered] [stream = old brick screen]   /stop');
    }
    if (args[0] === 'stop') return this.stopSession(name, key) || this.whisper(name, 'No video playing.');
    if (!looksLikeLink(args[0])) return this.whisper(name, 'Give a video link, e.g. /playvideo https://youtu.be/... 48');
    this.stopSession(name, key);
    // default: heightmap2brz wire-prop screen (glowing pixels) + speech-mode
    // soundtrack device; "stream" brings back the frame-by-frame brick screen
    if (!args.slice(1).includes('stream')) return this.chipVideo(name, key, args);

    // explicit frame rate: fps=24, 24fps or "fps 24" (beats the 2nd bare number)
    let fpsArg;
    const rest = [];
    for (let i = 1; i < args.length; i++) {
      const m = /^(?:fps[=:](\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)fps)$/i.exec(args[i]);
      if (m) fpsArg = Number(m[1] ?? m[2]);
      else if (/^fps$/i.test(args[i]) && /^\d+(\.\d+)?$/.test(args[i + 1] ?? '')) fpsArg = Number(args[++i]);
      else rest.push(args[i]);
    }
    const nums = rest.filter(a => /^\d+(\.\d+)?$/.test(a)).map(Number);
    const width = Math.max(8, Math.min(this.config['max-width'] ?? 160, Math.round(nums[0] ?? this.config['width'] ?? 80)));
    const fps = Math.max(1, Math.min(30, fpsArg ?? nums[1] ?? (this.config['fps'] ?? 6)));
    // plain square micro brick pixels by default (owner, 2026-10-08); "smooth"
    // brings back the wedge/ramp sub-pixel segments
    const plain = !rest.some(a => /^(smooth|segments?|wedges?)$/i.test(a));
    const facing = rest.find(a => SCREEN_RIGHT[a]) ?? '-x';
    const material = rest.includes('plastic') ? 'BMC_Plastic' : 'BMC_Glow';
    // micro brick pixels: whole units, even so a pixel has an integer half-extent
    const px = Math.max(2, Math.round((this.config['pixel-size'] ?? 8) / 2) * 2);
    const withSound = !rest.includes('mute'); // music plays as MIDI unless muted

    const session = { stopped: false, kind: 'video' };
    session.stop = () => (session.stopped = true);
    this.sessions.set(key, session);

    let file, frames;
    try {
      const pos = await this.playerSpot(name);
      this.whisper(name, `<color="999">${loading()}...</>`);
      // long videos: frames stream from ffmpeg while they play and the
      // soundtrack is built in chunks, so length only costs download time
      const maxMin = this.config['video-max-minutes'] ?? 240;
      file = await this.download(args[0], 'video', withSound, maxMin);
      if (session.stopped) return;
      this.whisper(name, `<color="999">${loading()}...</>`);
      const probe = JSON.parse(String(await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', file])));
      const vs = probe.streams?.[0];
      if (!vs?.width) throw new Error('that link has no video');
      const seconds = Math.min(Number(probe.format?.duration) || maxMin * 60, maxMin * 60);
      // square micro brick pixels; at 1 micro brick (2 units) each cell is a
      // 4-segment pixel, so decode at double resolution
      const height = Math.max(4, Math.round((width * vs.height) / vs.width));
      const seg = !plain && px === 2 &&(this.config['segments'] ?? true);
      const sub = seg ? 2 : 1;
      const frameBytes = width * height * 3 * sub * sub;
      frames = new FrameStream(spawn('ffmpeg', [
        '-v', 'error', '-i', file, '-t', String(maxMin * 60),
        '-vf', `fps=${fps},scale=${width * sub}:${height * sub}:flags=lanczos`,
        '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-',
      ], { stdio: ['ignore', 'pipe', 'pipe'] }), frameBytes, Math.ceil(fps * 10));
      if (!(await frames.get(0))) throw new Error(`could not decode any frames${frames.err ? `: ${frames.err.trim().split('\n').pop()}` : ''}`);
      if (session.stopped) return;

      // Screen: bottom on the ground, centered on the player, `dist` in front.
      const dist = Math.max(20, Math.round((width * px * 0.6) / STUD)) * STUD;
      const n = NORMAL[facing], right = SCREEN_RIGHT[facing];
      const snap = v => Math.round(v / STUD) * STUD;
      // the screen faces `facing`, so it stands on the opposite side of the player
      const cx = snap(pos[0] - n[0] * dist), cy = snap(pos[1] - n[1] * dist);
      const ground = Math.round((pos[2] - FEET) / 4) * 4;
      const screen = { cx, cy, ground, width, height, facing, n, right, material, px, seg, glow: this.config['glow-intensity'] ?? 3 };
      session.screen = screen;
      session.clear = () => [0, 1].forEach(l => this.clearLayer(screen, l));
      session.clear();

      // build the soundtrack device first so the music starts with the first frame
      // no preset word: heightmap2brz's own defaults (bank mode, no tuning flags)
      const vp = PRESETS[rest.find(a => PRESETS[a]) ?? this.config['video-audio']] ?? PRESETS.default;
      // in chunks of audio-chunk-minutes: a whole long soundtrack would be one
      // huge chip and take ages to build. Each chunk is built while the one
      // before it plays and replaces it on time.
      const chunkSec = Math.max(60, (this.config['audio-chunk-minutes'] ?? 5) * 60);
      const chunks = seconds > chunkSec + 30 ? Math.ceil(seconds / chunkSec) : 1;
      const buildChunk = async k => {
        if (chunks === 1) return this.buildAudioSet(file, vp);
        const part = file.replace(/\.[^.]+$/, '') + `.chunk${k}.wav`;
        await run('ffmpeg', ['-v', 'error', '-y', '-ss', String(k * chunkSec), '-t', String(chunkSec), '-i', file, '-vn', '-ac', '1', '-ar', '44100', part], 300_000);
        try { return await this.buildAudioSet(part, vp); }
        finally { fs.rmSync(part, { force: true }); }
      };
      const soundtrack = k => buildChunk(k).catch(e => (console.error(`[media] soundtrack chunk ${k}`, e), null));
      const first = withSound ? await soundtrack(0) : null;
      if (session.stopped) return;
      // The game caps speaker range at 40 studs, so the chip goes halfway between
      // the viewer and the screen, at head height: audible from both.
      const mid = [Math.round((pos[0] + cx) / 2 / STUD) * STUD, Math.round((pos[1] + cy) / 2 / STUD) * STUD, Math.round((pos[2] + 30) / 2) * 2];
      let clearAudio = () => {};
      const loadSet = devices => {
        clearAudio();
        const clears = devices.map((d, k) => this.loadDevice(d, session, [mid[0] + n[0] * k * this.deviceStep(devices), mid[1] + n[1] * k * this.deviceStep(devices), mid[2]]));
        clearAudio = () => clears.forEach(c => c());
      };
      const mins = Math.floor(seconds / 60), secs = Math.round(seconds % 60);
      this.broadcast(`<color="9cf">${sanitize(name)} is playing a video (${width}x${height}, ${mins}:${String(secs).padStart(2, '0')} at ${fps} fps${plain ? '' : ', smooth'}). /stop to end.</>`);
      this.whisper(name, `<color="999">The screen is ${dist / STUD} studs to your ${facing === '-x' ? '+x' : facing === '+x' ? '-x' : facing === '-y' ? '+y' : '-y'} side. Pick the side with -x, +x, -y or +y.</>`);
      const start = Date.now();
      if (first) loadSet(first);
      if (withSound && chunks > 1) (async () => {
        // build chunk k while chunk k-1 plays, load it when its time comes
        for (let k = 1; k < chunks && !session.stopped; k++) {
          const set = await soundtrack(k);
          const wait = start + k * chunkSec * 1000 - Date.now();
          if (wait > 0) await sleep(wait);
          if (session.stopped) break;
          if (set) loadSet(set);
          else clearAudio();
        }
      })().catch(e => console.error('[media] soundtrack', e));
      await this.playFrames(session, frames, fps, start);
    } finally {
      session.stopped = true; // ends the soundtrack loop when the video simply finished
      frames?.kill();
      // a soundtrack chunk may still be reading the file; it is gone in a minute either way
      if (file) setTimeout(() => this.release(file), 60_000);
      if (this.sessions.get(key) === session) this.sessions.delete(key);
    }
  }

  /** Bricks for one frame on one layer, merging same-coloured rectangles. */
  frameBricks(screen, raw, offset, layer) {
    const { width: W, height: H, n, right, cx, cy, ground, material, px: P, glow } = screen;
    const p = P / 2;
    const q = this.config['color-step'] ?? 8;
    const quant = v => Math.min(255, Math.round(v / q) * q);
    const color = new Int32Array(W * H);
    const bricks = [];
    const depth = layer * 2;
    const glowI = material === 'BMC_Glow' ? glow : 5;
    const rgb = col => [(col >> 16) & 255, (col >> 8) & 255, col & 255];
    if (screen.seg) {
      // 4-segment cells: top/right/bottom/left from the 2x2 source pixels;
      // a cell with one colour throughout joins the merged rectangles below
      const W2 = W * 2;
      const px2 = (x, y, k) => raw[offset + (y * W2 + x) * 3 + k];
      const mix = (a, b) => (quant((px2(...a, 0) + px2(...b, 0)) / 2) << 16) | (quant((px2(...a, 1) + px2(...b, 1)) / 2) << 8) | quant((px2(...a, 2) + px2(...b, 2)) / 2);
      const segs = SEGS[screen.facing];
      const segT = this.config['segment-threshold'] ?? 64; // max channel spread (0-255) before a cell splits
      const seg2T = this.config['diagonal-threshold'] ?? 72; // worst pixel error a 2-ramp diagonal may leave
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
        const tl = [2 * c, 2 * r], tr = [2 * c + 1, 2 * r], bl = [2 * c, 2 * r + 1], br = [2 * c + 1, 2 * r + 1];
        const four = [mix(tl, tr), mix(tr, br), mix(bl, br), mix(tl, bl)]; // top, right, bottom, left
        // split only where the triangles really differ (edges, fine detail);
        // otherwise one brick in the cell's average colour, which can merge
        const ch = k => four.map(v => (v >> (16 - 8 * k)) & 255);
        const spread = Math.max(...[0, 1, 2].map(k => Math.max(...ch(k)) - Math.min(...ch(k))));
        if (spread < segT) {
          const avg = k => quant((px2(...tl, k) + px2(...tr, k) + px2(...bl, k) + px2(...br, k)) / 4);
          color[r * W + c] = (avg(0) << 16) | (avg(1) << 8) | avg(2);
          continue;
        }
        color[r * W + c] = -1;
        const along = (c + 0.5 - W / 2) * P, z = ground + (H - r - 0.5) * P;
        const x = cx + right[0] * along + n[0] * depth, y = cy + right[1] * along + n[1] * depth;
        // a single diagonal split (2 ramps) when it fits the 2x2 block well enough
        const pix = q2 => [0, 1, 2].map(k => px2(...q2, k));
        const P4 = [pix(tl), pix(tr), pix(bl), pix(br)];
        const avg = (...ps) => [0, 1, 2].map(k => quant(ps.reduce((a, p) => a + p[k], 0) / ps.length));
        const dist = (a, b) => Math.max(...[0, 1, 2].map(k => Math.abs(a[k] - b[k])));
        const [TL, TR, BL, BR] = P4;
        const cand = [
          ['fwd', avg(BR, BR, TR, BL), avg(TL, TL, TR, BL), [BR], [TL]],   // [lower-right, upper-left]
          ['back', avg(BL, BL, TL, BR), avg(TR, TR, TL, BR), [BL], [TR]], // [lower-left, upper-right]
        ].map(([d, a, b, ia, ib]) => {
          const err = Math.max(dist(ia[0], a), dist(ib[0], b), ...(d === 'fwd' ? [TR, BL] : [TL, BR]).map(p => Math.min(dist(p, a), dist(p, b))));
          return { d, a, b, err };
        }).sort((u, v) => u.err - v.err)[0];
        if (cand.err < seg2T) {
          const pieces = DIAGS[screen.facing][cand.d];
          [cand.a, cand.b].forEach((col, k) => bricks.push({
            asset: 'PB_DefaultMicroRamp', position: [x, y, z], size: [1, 1, 1], ...pieces[k],
            material, material_intensity: glowI, color: col,
          }));
          continue;
        }
        four.forEach((col, k) => bricks.push({
          asset: 'PB_DefaultMicroWedgeHalfInnerCornerInverted', position: [x, y, z], size: [1, 1, 1], ...segs[k],
          material, material_intensity: glowI, color: rgb(col),
        }));
      }
    } else for (let i = 0; i < W * H; i++) {
      const o = offset + i * 3;
      color[i] = (quant(raw[o]) << 16) | (quant(raw[o + 1]) << 8) | quant(raw[o + 2]);
    }
    const used = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) if (color[i] === -1) used[i] = 1;
    // lossy merge: neighbours within merge-tolerance (max channel difference
    // from the rectangle's first pixel) join it, so far fewer bricks per frame
    // (owner 2026-10-08: the game lagged at ~2,500 bricks a frame)
    const tol = this.config['merge-tolerance'] ?? 24;
    const near = (v, s) => v === s || (tol > 0 && v >= 0 && Math.abs(((v >> 16) & 255) - ((s >> 16) & 255)) <= tol && Math.abs(((v >> 8) & 255) - ((s >> 8) & 255)) <= tol && Math.abs((v & 255) - (s & 255)) <= tol);
    // layer 0 is the back, layer 1 sits one micro brick (2 units) closer to the viewer
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        const i = r * W + c;
        if (used[i]) continue;
        const seed = color[i];
        let w = 1;
        while (c + w < W && !used[i + w] && near(color[i + w], seed)) w++;
        let h = 1;
        grow: while (r + h < H) {
          for (let k = 0; k < w; k++) {
            const j = (r + h) * W + c + k;
            if (used[j] || !near(color[j], seed)) break grow;
          }
          h++;
        }
        // the rectangle's average colour (pixels within merge-tolerance of the seed)
        let sr = 0, sg = 0, sb = 0;
        for (let y = 0; y < h; y++) for (let k = 0; k < w; k++) {
          const v = color[(r + y) * W + c + k];
          sr += (v >> 16) & 255; sg += (v >> 8) & 255; sb += v & 255;
        }
        const cnt = w * h;
        const col = (quant(sr / cnt) << 16) | (quant(sg / cnt) << 8) | quant(sb / cnt);
        for (let y = 0; y < h; y++) used.fill(1, (r + y) * W + c, (r + y) * W + c + w);
        // centre of the rectangle along the screen, in units from screen centre
        const along = (c + w / 2 - W / 2) * P;
        const z = ground + (H - r - h / 2) * P; // row 0 is the top
        const x = cx + right[0] * along + n[0] * depth;
        const y = cy + right[1] * along + n[1] * depth;
        const size = n[0] ? [1, w * p, h * p] : [w * p, 1, h * p];
        bricks.push({
          asset: 'PB_DefaultMicroBrick', position: [x, y, z], size, material,
          material_intensity: material === 'BMC_Glow' ? glow : 5,
          color: [(col >> 16) & 255, (col >> 8) & 255, col & 255],
        });
      }
    }
    return bricks;
  }

  clearLayer(screen, layer) {
    const { width: W, height: H, n, cx, cy, ground, px: P } = screen;
    const center = [cx + n[0] * layer * 2, cy + n[1] * layer * 2, ground + (H * P) / 2];
    // ClearRegion only takes bricks entirely inside, so the other layer is safe
    const half = n[0] ? [1, (W * P) / 2, (H * P) / 2] : [(W * P) / 2, 1, (H * P) / 2];
    this.clearBox(center, half);
  }

  async playFrames(session, frames, fps, start = Date.now()) {
    const budget = this.config['bricks-per-second'] ?? 40000;
    let layer = 0, shown = -1;
    while (!session.stopped) {
      // which frame should be up now; skip ahead if we fell behind
      const due = Math.floor(((Date.now() - start) / 1000) * fps);
      if (due === shown) {
        await sleep(Math.max(5, start + ((shown + 1) * 1000) / fps - Date.now()));
        continue;
      }
      // waits while ffmpeg is still decoding it; null after the last frame
      const frame = await frames.get(due);
      if (!frame || session.stopped) break;
      // one layer (default since 2026-10-07, owner: the screen must not jump
      // between two depths): clear it, then load the frame in the same place;
      // both are console commands, so they run in that order. layers: 2 = the
      // old flicker-free mode, alternating two layers 2 units apart.
      const two = Number(this.config.layers ?? 1) === 2;
      const bricks = this.frameBricks(session.screen, frame, 0, two ? layer : 0);
      if (two) {
        this.loadBricks(bricks);
        this.clearLayer(session.screen, 1 - layer);
        layer = 1 - layer;
      } else {
        this.clearLayer(session.screen, 0);
        this.loadBricks(bricks);
      }
      shown = due;
      // don't send bricks faster than the server takes them
      await sleep(Math.max((bricks.length / budget) * 1000, 5));
    }
    await sleep(1500);
    if (!this.config['keep-last-frame'] || session.stopped) session.clear?.();
  }

  // ---------- /playaudio ----------

  /**
   * /tts <text>: sine-wave speech (tts.js). espeak-ng phonemes -> formant
   * targets -> three tweened sine tones -> heightmap2brz voice mode, so the
   * in-game chip retunes 440 Hz sine speakers to follow the formants.
   */
  async ttsCommand(name, args) {
    const text = args.join(' ').replace(/[^\w\s.,!?'-]/g, '').trim().slice(0, 200);
    if (!text) return this.whisper(name, 'Usage: /tts <text>   (says it with sine-wave speech above you)');
    const key = `audio:${name}`;
    this.stopSession(name, key);
    const session = { stopped: false, kind: 'audio' };
    session.stop = () => (session.stopped = true);
    this.sessions.set(key, session);
    const file = path.join(this.prefabDir, `tts_${Date.now()}_${Math.floor(Math.random() * 1e6)}.wav`);
    try {
      const said = await TTS.speak(text, file);
      if (session.stopped) return;
      const devices = [await this.buildAudioDevice(file, { mode: 'voice', synth: 'sine', flags: ['--max-voices', String(this.config['tts-voices'] ?? 4)] })];
      if (session.stopped) return;
      const spot = await this.speakerSpot(name);
      devices.forEach(d => this.loadDevice(d, session, spot));
      this.broadcast(`<color="9cf">${sanitize(name)} says: "${sanitize(text)}"</>`);
      console.log('[media] tts', JSON.stringify(text), '->', said.phonemes);
      await new Promise(resolve => {
        const t = setTimeout(resolve, (said.seconds + 3) * 1000);
        session.stop = () => { session.stopped = true; clearTimeout(t); resolve(); };
      });
      if (!session.stopped) session.clear?.();
    } finally {
      fs.rmSync(file, { force: true });
      if (this.sessions.get(key) === session) this.sessions.delete(key);
    }
  }

  /**
   * /playvideo default: heightmap2brz builds the video as a wire prop (a
   * microchip driving glowing micro brick pixels from frame arrays) and the
   * soundtrack as a speech-mode speaker device; both self-play once loaded.
   * Built and swapped in video-chunk-seconds pieces, the next one built
   * while the current one plays, so a long video never makes one huge chip.
   */
  /** !search <words>: plays the first YouTube result on the wire-prop screen. */
  async searchCommand(name, args) {
    const term = args.join(' ').trim();
    if (!term) return this.whisper(name, 'Usage: /search <words>   /stop');
    const key = `video:${name}`;
    this.stopSession(name, key);
    this.whisper(name, `<color="999">${loading()} "${sanitize(term)}"...</>`);
    return this.chipVideo(name, key, [`ytsearch10:${term}`]);
  }

  async chipVideo(name, key, args) {
    const rest = args.slice(1);
    const fpsM = rest.map(a => /^(?:fps[=:](\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)fps)$/i.exec(a)).find(Boolean);
    const nums = rest.filter(a => /^\d+(\.\d+)?$/.test(a)).map(Number);
    const width = Math.max(8, Math.min(this.config['max-width'] ?? 160, Math.round(nums[0] ?? this.config['width'] ?? 80)));
    const fps = Math.max(1, Math.min(30, Number(fpsM?.[1] ?? fpsM?.[2] ?? nums[1] ?? this.config['fps'] ?? 10)));
    const facing = rest.find(a => SCREEN_RIGHT[a]) ?? '-x';
    const withSound = !rest.includes('mute');
    // default = speech (owner's in-game A/B 2026-10-11 on a rock song: preferred it
    // over auto, which the simulator and loopback score both ranked higher)
    const preset = { ...PRESETS[rest.find(a => PRESETS[a]) ?? 'speech'], tuneKey: args[0] };
    const ext = Math.max(1, Math.round((this.config['pixel-size'] ?? 2) / 2));

    // nothing else playing: clear any leftover screens and speakers first (they block the new ones)
    if (!this.sessions.size) this.omegga.writeln(`br.Bricks.Clear ${OWNER.id} 1`);
    const session = { stopped: false, kind: 'video' };
    session.stop = () => (session.stopped = true);
    this.sessions.set(key, session);
    let file;
    try {
      const pos = await this.playerSpot(name);
      this.whisper(name, `<color="999">${loading()}...</>`);
      const maxMin = this.config['video-max-minutes'] ?? 240;
      file = await this.download(args[0], 'video', withSound, maxMin);
      if (session.stopped) return;
      const probe = JSON.parse(String(await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', file])));
      const vs = probe.streams?.[0];
      if (!vs?.width) throw new Error('that link has no video');
      // start=SECONDS / len=SECONDS play only part of the video
      const opt = k => Number(rest.map(a => /^([a-z]+)[=:](\d+(?:\.\d+)?)$/i.exec(a)).find(m => m?.[1].toLowerCase() === k)?.[2] ?? NaN);
      const total = Number(probe.format?.duration) || maxMin * 60;
      const startAt = Math.max(0, Math.min(total - 1, opt('start') || 0));
      const seconds = Math.min(total - startAt, maxMin * 60, opt('len') || Infinity);
      const height = Math.max(4, Math.round((width * vs.height) / vs.width));
      const chunkSec = Math.max(10, this.config['video-chunk-seconds'] ?? 60);
      const chunks = Math.max(1, Math.ceil(seconds / chunkSec));

      const n = NORMAL[facing], right = SCREEN_RIGHT[facing];
      const [orient, T] = CHIP_ORIENT[right.join()];
      // close in front of the player (owner 2026-10-11: was 20+ studs)
      const dist = Math.max(10, Math.round((width * ext * 2 * 0.4) / STUD)) * STUD;
      const snap = v => Math.round(v / STUD) * STUD;
      const cx = snap(pos[0] - n[0] * dist), cy = snap(pos[1] - n[1] * dist);
      const ground = Math.round((pos[2] - FEET) / 4) * 4;
      // soundtrack chips 4 studs behind the screen's bottom middle (clear of the odd pieces 2 studs back) (speaker range is 40 studs)
      // clear of the ground: at ground + 2 the chips dipped 1 unit into the terrain and the
      // game refused them as overlapping (2026-10-11: videos had no sound)
      const mid = [cx - n[0] * 4 * STUD, cy - n[1] * 4 * STUD, ground + 24];

      const build = async k => {
        const t0 = startAt + k * chunkSec, dur = Math.min(chunkSec, seconds - k * chunkSec);
        const base = file.replace(/\.[^.]+$/, '') + `.c${k}`;
        await run(HEIGHTMAP, [file, '--anim-mode', 'brick', '--glow', '--width', String(width), '--fps', String(fps),
          '--pixel-extent', String(ext), '--start', String(t0), '--duration', String(dur), '--no-loop', '--backend', 'ffmpeg',
          '--no-download', '-o', base + '.brz'], 900_000);
        const buf = this.chipAbove(fs.readFileSync(base + '.brz'));
        fs.rmSync(base + '.brz', { force: true });
        const video = { buf, ...this.deviceBox(this.brs.WorldReader.from(buf)) };
        let audio = null;
        if (withSound) {
          await run('ffmpeg', ['-v', 'error', '-y', '-ss', String(t0), '-t', String(dur), '-i', file, '-vn', '-ac', '1', '-ar', '44100', base + '.wav'], 300_000);
          try { audio = await this.buildAudioSet(base + '.wav', preset); }
          catch (e) { console.error(`[media] soundtrack chunk ${k}`, e); }
          finally { fs.rmSync(base + '.wav', { force: true }); }
        }
        return { video, audio };
      };
      const tryBuild = k => build(k).catch(e => (console.error(`[media] video chunk ${k}`, e), null));

      this.whisper(name, `<color="999">${loading()}...</>`);
      const first = await build(0);
      if (session.stopped) return;
      // seamless piece swaps (owner 2026-10-11: the screen popped in and out every
      // minute): odd pieces load 2 studs behind the screen plane (each part's clear
      // box is ~14 units thick, so less would let one piece's clear eat the other)
      // with their sound chips 3 studs to the side, so the next piece goes in
      // before the old one is cleared (same spot would overlap and be refused)
      // (owner 2026-10-12: "trying to reload the next clip of the video will overlap the audio or
      // video chip", "the chips are placed very randomly and should be close to each other and the
      // screen but do not overlap them") two slots that never touch, measured from the real boxes:
      // even clips in slot A, odd clips in slot B. Behind the screen plane (-n): video A, video B
      // (its whole depth plus a stud further back: chip and all), then the sound chips in a tidy
      // row along the screen's width, row A then row B, a stud apart. The next clip goes into the
      // other slot before the old one is cleared, and no clear box reaches into the playing slot.
      const along = (v, d) => v[0] * d[0] + v[1] * d[1] + v[2] * d[2];
      const depthOf = dev => { // [front, back] of a device along -n, relative to its pixel plane
        const p = T([(dev.pixLo[0] + dev.pixHi[0]) / 2, dev.pixHi[1], (dev.pixLo[2] + dev.pixHi[2]) / 2]);
        const ds = [0, 1, 2, 3, 4, 5, 6, 7].map(c => along(T([0, 1, 2].map(i => ((c >> i) & 1 ? dev.hi : dev.lo)[i])).map((v, i) => v - p[i]), [-n[0], -n[1], 0]));
        return [Math.min(0, ...ds), Math.max(0, ...ds)];
      };
      const [vFront, vBack] = depthOf(first.video);
      const slotB = Math.ceil((vBack - vFront + STUD) / 2) * 2;          // video slot B, this far behind A
      const audioBase = slotB + vBack + STUD;                             // the first sound row starts here
      const audioSpots = (audio, k) => {
        if (!audio?.length) return [];
        const ws = audio.map(d => Math.abs(along([d.hi[0] - d.lo[0], d.hi[1] - d.lo[1], 0], right.concat(0))) || STUD);
        const deep = Math.max(...audio.map(d => Math.abs(along([d.hi[0] - d.lo[0], d.hi[1] - d.lo[1], 0], n.concat(0)))));
        const rowAt = audioBase + (k % 2) * (deep + STUD) + deep / 2;     // row A, or row B behind it
        const total = ws.reduce((a, w) => a + w, 0) + STUD * (ws.length - 1);
        let lat = -total / 2;
        return audio.map((d, j) => {
          const c = lat + ws[j] / 2; lat += ws[j] + STUD;
          const centre = [cx - n[0] * rowAt + right[0] * c, cy - n[1] * rowAt + right[1] * c];
          // Prefab.Load puts file coordinates + at: centre the device's own box on the spot
          return [centre[0] - (d.lo[0] + d.hi[0]) / 2, centre[1] - (d.lo[1] + d.hi[1]) / 2, mid[2]].map(v => Math.round(v / 2) * 2);
        });
      };
      const loadSet = (set, k = 0) => {
        const back = (k % 2) * slotB;
        const { video, audio } = set;
        // bottom row of pixels centred on (cx, cy), standing on the ground
        const p = T([(video.pixLo[0] + video.pixHi[0]) / 2, video.pixHi[1], (video.pixLo[2] + video.pixHi[2]) / 2]);
        const at = [cx - n[0] * back - p[0], cy - n[1] * back - p[1], ground - p[2]].map(v => Math.round(v / 2) * 2);
        clips[k] = { cmdAt: Date.now(), loc: null, sec: 0, secAt: 0, clear: null };
        const spots = audioSpots(audio, k);
        // the soundtrack chips ride in the same prefab (one set of buttons
        // drives all clocks): their spot in the video file's coordinates
        const inv = v => [0, 1, 2].map(i => { const e = [0, 0, 0]; e[i] = 1; const t = T(e); return t[0] * v[0] + t[1] * v[1] + t[2] * v[2]; });
        const parts = [{ buf: video.buf }];
        (audio ?? []).forEach((d, j) => parts.push({ buf: d.buf, offset: inv(spots[j].map((v, i) => v - at[i])).map(v => Math.round(v / 10) * 10) }));
        let merged;
        try {
          if (!MERGE_AUDIO) throw null;
          merged = this.mergeDevices(parts);
        } catch (e) {
          // fall back to separate chips (each with its own buttons)
          if (e) console.error('[media] merge', e);
          const clears = [this.loadDevice({ ...video, buf: this.autoStart(video.buf) }, session, at, orient, T)];
          (audio ?? []).forEach((d, j) => clears.push(this.loadDevice(d, session, spots[j])));
          clips[k].clear = () => clears.forEach(c => c());
          return;
        }
        clips[k].clear = this.loadDevice({ buf: this.autoStart(merged.buf), boxes: merged.boxes }, session, at, orient, T);
      };
      // chunk clocks from the probes: the newest chunk without a location takes the
      // first fresh probe (seconds <= 5) from a spot no other chunk has
      const clips = [];
      session.probe = (sec, loc) => {
        const same = c => c.loc && Math.hypot(c.loc[0] - loc[0], c.loc[1] - loc[1], c.loc[2] - loc[2]) < 30;
        let c = clips.find(c => c && same(c));
        if (!c && sec <= 5) {
          for (let i = clips.length - 1; i >= 0; i--) if (clips[i] && !clips[i].loc && Date.now() - clips[i].cmdAt < 120_000) { c = clips[i]; c.loc = loc; c.lag = (Date.now() - c.cmdAt) / 1000 - sec; break; }
        }
        if (c && sec >= c.sec) { c.sec = sec; c.secAt = Date.now(); }
      };
      // a chunk's game time now: its last probe second plus the time since; no probe
      // yet (or a dead one) -> the wall clock since its load, as before
      const gameTime = k => {
        const c = clips[k];
        if (!c) return 0;
        if (c.loc && Date.now() - c.secAt < 8000) return c.sec + (Date.now() - c.secAt) / 1000;
        if (c.loc) return c.sec + (Date.now() - c.secAt) / 1000;
        return (Date.now() - c.cmdAt) / 1000 - (Date.now() - c.cmdAt < 20_000 ? 5 : 0);
      };
      const lead = () => { const l = clips.filter(c => c?.lag != null).map(c => c.lag); return l.length ? Math.max(0, Math.min(8, l[l.length - 1])) : 2; };
      const mins = Math.floor(seconds / 60), secs = Math.round(seconds % 60);
      this.broadcast(`<color="9cf">${sanitize(name)} is playing a video (${width}x${height}, ${mins}:${String(secs).padStart(2, '0')} at ${fps} fps). /stop to end.</>`);
      this.whisper(name, `<color="999">The screen is ${dist / STUD} studs to your ${facing === '-x' ? '+x' : facing === '+x' ? '-x' : facing === '-y' ? '+y' : '-y'} side. Pick the side with -x, +x, -y or +y.</>`);
      // (owner 2026-10-12: "loading new videos in segments but the timing is wrong") each piece
      // goes in when the one before it has actually played its length, timed from when that one
      // was loaded: a fixed schedule (start + k * chunkSec) cut a late piece short and kept every
      // later piece off. A piece that is still building when its turn comes loads the moment it
      // is ready, and the schedule carries on from there.
      const durOf = k => Math.min(chunkSec, seconds - k * chunkSec);
      // (owner 2026-10-13: "videos switching too early") the schedule runs on each chunk's
      // GAME time (its probe), not the wall clock: the next piece loads when this one has
      // played its length less the measured load lag, and a finished piece is cleared once
      // the next one is running (or 6 s after it ended)
      const waitFor = async ok => { while (!session.stopped && !ok()) await sleep(200); };
      const retire = async (k, next) => {
        await waitFor(() => gameTime(k) >= durOf(k) + 0.2);
        const ended = Date.now();
        await waitFor(() => (clips[next]?.sec ?? 0) >= 1 || Date.now() - ended > 6000);
        clips[k]?.clear?.();
      };
      loadSet(first, 0);
      for (let k = 1; k < chunks && !session.stopped; k++) {
        const set = await tryBuild(k);
        await waitFor(() => gameTime(k - 1) >= durOf(k - 1) - lead());
        if (session.stopped) break;
        if (set) loadSet(set, k);
        else clips[k] = { cmdAt: Date.now(), loc: null, sec: 0, secAt: 0, clear: null };
        retire(k - 1, k);
        console.log(`[media] chunk ${k} loaded at chunk ${k - 1} game time ${gameTime(k - 1).toFixed(1)}/${durOf(k - 1)} (lead ${lead().toFixed(1)}, probe ${clips[k - 1]?.loc ? 'yes' : 'no'})`);
      }
      await waitFor(() => gameTime(chunks - 1) >= durOf(chunks - 1) + 1);
      if (!session.stopped && !this.config['keep-last-frame']) session.clear?.();
    } finally {
      session.stopped = true;
      if (file) setTimeout(() => this.release(file), 60_000);
      if (this.sessions.get(key) === session) this.sessions.delete(key);
    }
  }

  // ---------- !tv ----------

  /**
   * !tv <link | search words> [width] [fps=N] [-x|+x|-y|+y] [mute] [start=S] [len=S]
   * A CRT television in front of the player (tv.mjs): the picture is played by
   * a For Loop chip that recolours the screen bricks from packed colour changes,
   * the clock/title/channel are text displays. Built in chunks (tv-chunk-seconds);
   * each chunk replaces only the screen + chip, the cabinet stays.
   */
  async tvCommand(name, args, mode = 'tv') {
    // /textvideo = the same player with the picture as coloured text on one text display
    const text = mode === 'text', cmdName = text ? '/textvideo' : '!tv';
    const key = `tv:${name}`;
    if (!this.tv || !this.brs4) return this.whisper(name, '<color="f55">The TV is not installed (lib/brs4.mjs missing).</>');
    if (!args.length) return this.whisper(name, `Usage: ${cmdName} <link or search words> [width] [fps=N] [-x|+x|-y|+y] [mute] [mono] [start=S] [len=S]   ${cmdName} stop`);
    if (args[0] === 'stop' || args[0] === 'off') return this.stopSession(name, key) || this.whisper(name, 'Your TV is off already.');
    const opts = [], words = [];
    for (const a of args) (/^([+-][xy]|mute|mono|\d+(\.\d+)?|(fps|start|len)[=:]\d+(\.\d+)?|\d+fps)$/i.test(a) && !looksLikeLink(a) ? opts : words).push(a);
    if (!words.length) return this.whisper(name, 'Give a link or something to search for.');
    const link = looksLikeLink(words[0]) ? words[0] : `ytsearch10:${words.join(' ')}`;
    const opt = k => Number(opts.map(a => /^([a-z]+)[=:](\d+(?:\.\d+)?)$/i.exec(a)).find(m => m?.[1].toLowerCase() === k)?.[2] ?? NaN);
    const nums = opts.filter(a => /^\d+(\.\d+)?$/.test(a)).map(Number);
    const width = text
      ? Math.max(16, Math.min(this.config['textvideo-max-cols'] ?? 120, Math.round(nums[0] ?? this.config['textvideo-cols'] ?? 64)))
      : Math.max(16, Math.min(this.config['tv-max-width'] ?? 96, Math.round(nums[0] ?? this.config['tv-width'] ?? 48)));
    const fpsM = opts.map(a => /^(\d+)fps$/i.exec(a)).find(Boolean);
    const fps = Math.max(1, Math.min(20, Number(opt('fps') || fpsM?.[1] || (text ? this.config['textvideo-fps'] : this.config['tv-fps']) || (text ? 6 : 8))));
    const facing = opts.find(a => SCREEN_RIGHT[a]) ?? '-x';
    const withSound = !opts.includes('mute');
    const chunkSec = Math.max(10, this.config['tv-chunk-seconds'] ?? 30);
    const perTick = Math.max(50, this.config['tv-changes-per-tick'] ?? 400);
    const P = 8; // pixel size (units)

    this.stopSession(name, key);
    const crypto = require('crypto');
    const owner = this.tv.ownerFor(crypto.createHash('sha1').update(name).digest('hex').slice(0, 12));
    const session = { stopped: false, kind: 'TV' };
    session.stop = () => (session.stopped = true);
    const audioClears = [];
    session.clear = () => {
      this.omegga.writeln(`br.Bricks.Clear ${owner.id} 1`);
      audioClears.splice(0).forEach(c => c());
    };
    this.sessions.set(key, session);
    let file;
    try {
      const pos = await this.playerSpot(name);
      this.whisper(name, link.startsWith('ytsearch') ? `<color="999">${loading()} "${sanitize(words.join(' '))}"...</>` : `<color="999">${loading()}...</>`);
      const maxMin = this.config['video-max-minutes'] ?? 240;
      file = await this.download(link, 'video', withSound, maxMin);
      if (session.stopped) return;
      const probe = JSON.parse(String(await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration:format_tags=title', '-of', 'json', file])));
      const vs = probe.streams?.[0];
      if (!vs?.width) throw new Error('that link has no picture');
      const total = Number(probe.format?.duration) || maxMin * 60;
      const startAt = Math.max(0, Math.min(total - 1, opt('start') || 0));
      const seconds = Math.min(total - startAt, maxMin * 60, opt('len') || Infinity);
      // text: a glyph is about half as wide as a line is tall, so half the rows
      const charW = this.config['textvideo-char-width'] ?? 0.55;
      const height = text
        ? Math.max(6, Math.min(width, Math.round((width * vs.height * charW) / vs.width)))
        : Math.max(8, Math.min(Math.round(width * 1.2), Math.round((width * vs.height) / vs.width)));
      const title = String(probe.format?.tags?.title || (link.startsWith('ytsearch') ? words.join(' ') : 'TONIGHT: A MYSTERY')).replace(/[<>\\]/g, '').toUpperCase();
      const chunks = Math.max(1, Math.ceil(seconds / chunkSec));
      const channel = 2 + (crypto.createHash('sha1').update(link).digest()[0] % 12);

      // placement: the TV stands `dist` from the player, screen facing `facing` (towards them)
      const L = text ? this.tv.textLayout(width, height, { lh: this.config['textvideo-line-height'] ?? 6, charW }) : this.tv.layout(width, height, P);
      const n = NORMAL[facing];
      const orient = 16 + { '-y': 0, '+x': 1, '+y': 2, '-x': 3 }[facing], T = ORIENT[orient];
      const dist = Math.max(10, Math.round(((text ? L.TW : L.SW) * 0.9) / STUD)) * STUD;
      const snap = v => Math.round(v / STUD) * STUD;
      const at = [snap(pos[0] - n[0] * dist), snap(pos[1] - n[1] * dist), Math.round((pos[2] - FEET) / 4) * 4 + 2];
      const world = p => T(p).map((v, i) => v + at[i]);
      const clearScreen = () => {
        for (const [c, h] of text ? this.tv.textBoxes(L) : this.tv.screenBoxes(L)) this.clearBox(world(c), T(h).map(Math.abs));
      };
      const load = buf => {
        const ref = `media_tmp_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
        const f = path.join(this.prefabDir, ref + '.brz');
        fs.writeFileSync(f, buf);
        this.omegga.writeln(`br.Prefab.Load "${ref}" ${at.join(' ')} 0 ${orient}`);
        setTimeout(() => fs.rmSync(f, { force: true }), 15_000);
      };

      const build = async k => {
        const t0 = startAt + k * chunkSec, dur = Math.min(chunkSec, seconds - k * chunkSec);
        const raw = await run('ffmpeg', ['-v', 'error', '-ss', String(t0), '-t', String(dur), '-i', file,
          '-vf', `fps=${fps},scale=${width}:${height}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], 300_000, 1 << 30);
        const fb = width * height * 3, frames = [];
        for (let o = 0; o + fb <= raw.length; o += fb) frames.push(raw.subarray(o, o + fb));
        if (!frames.length) throw new Error('no frames decoded');
        let screen, changes;
        if (text) {
          const strs = this.tv.asciiFrames(frames, width, height, { color: !opts.includes('mono'), max: this.config['textvideo-max-chars'] ?? 12000 });
          screen = this.tv.buildTextScreen(this.brs4, L, strs, { fps, tOff: t0 - startAt, total: seconds, title, owner });
          changes = strs.reduce((a, x) => a + x.length, 0);
        } else {
          const enc = this.tv.encodeFrames(frames, width, height, { cap: Math.floor((perTick * 20 / fps) * 0.8) });
          screen = this.tv.screenPrefab(this.brs4, L, enc, { fps, tOff: t0 - startAt, total: seconds, title, channel, chunk: perTick, owner });
          changes = enc.data.length;
        }
        let audio = null;
        if (withSound) {
          const wav = file.replace(/\.[^.]+$/, '') + `.tv${k}.wav`;
          try {
            await run('ffmpeg', ['-v', 'error', '-y', '-ss', String(t0), '-t', String(dur), '-i', file, '-vn', '-ac', '1', '-ar', '44100', wav], 300_000);
            audio = (await this.buildAudioSet(wav, { ...PRESETS.speech }))[0];
          } catch (e) { console.error(`[media] tv soundtrack ${k}`, e); }
          finally { fs.rmSync(wav, { force: true }); }
        }
        return { screen, audio, dur, changes };
      };
      // soundtrack chips sit under the cabinet between the legs, chunks alternate sides
      const loadAudio = (d, k) => {
        if (!d) return null;
        const c = text ? world([(k % 2 ? 1 : -1) * 60, L.depth + 60, 28]) : world([(k % 2 ? 1 : -1) * Math.round(L.cw / 3 / 10) * 10, L.depth / 2, 28]);
        const spot = [0, 1, 2].map(i => Math.round((c[i] - (d.lo[i] + d.hi[i]) / 2) / 2) * 2);
        const clr = this.loadDevice(d, {}, spot);
        audioClears.push(clr);
        return clr;
      };

      this.whisper(name, `<color="999">${loading()}...</>`);
      const first = await build(0);
      if (session.stopped) return;
      this.omegga.writeln(`br.Bricks.Clear ${owner.id} 1`);
      if (!text) load(this.tv.buildBody(this.brs4, L, { owner }));
      load(first.screen);
      let prevAudio = loadAudio(first.audio, 0);
      const mins = Math.floor(seconds / 60), secs = Math.round(seconds % 60);
      this.whisper(name, `<color="9cf">Now showing on channel ${channel}: ${sanitize(title.slice(0, 60))} (${width}x${height}, ${mins}:${String(secs).padStart(2, '0')}, ${fps} fps). ${cmdName} stop switches it off.</>`);
      console.log(`[media] ${mode} ${name}: ${width}x${height} ${fps} fps, ${chunks} chunk(s), chunk 0 ${first.changes} changes, at ${at.join(',')} orient ${orient}`);
      let start = Date.now(), durPrev = first.dur;
      for (let k = 1; k < chunks && !session.stopped; k++) {
        const set = await build(k).catch(e => (console.error(`[media] tv chunk ${k}`, e), null));
        const due = start + durPrev * 1000;
        while (!session.stopped && Date.now() < due) await sleep(Math.min(200, due - Date.now()));
        if (session.stopped) break;
        start = Date.now();
        if (!set) { durPrev = chunkSec; continue; }
        durPrev = set.dur;
        clearScreen();
        load(set.screen);
        const old = prevAudio;
        prevAudio = loadAudio(set.audio, k);
        if (old) setTimeout(old, 1500);
      }
      const end = start + durPrev * 1000 + 1500;
      while (!session.stopped && Date.now() < end) await sleep(200);
      if (!session.stopped && !this.config['keep-last-frame']) session.clear();
    } finally {
      session.stopped = true;
      if (file) setTimeout(() => this.release(file), 60_000);
      if (this.sessions.get(key) === session) this.sessions.delete(key);
    }
  }

  /**
   * /ogrid: the video as a SQUARE n x n grid of coloured O's on one text
   * display, STREAMED: one receiver prefab per viewer (ogrid.mjs
   * buildReceiver: screen + Custom Global Event gate + For Loop decoders)
   * stays put; per chunk a CARTRIDGE prefab (frames as run tokens in an
   * ArrayVar, own stopwatch) sends each frame to it as a global event, and the
   * chip rebuilds the coloured text. Sound = a speech device per chunk, cut
   * from the same seconds and loaded on the same tick as its cartridge.
   * (2026-10-17: was ~24 x 500-char `br.Chat.Command` lines a second: 3
   * server crashes. Now 2 console lines a chunk.)
   */
  async oGridCommand(name, args) {
    const key = `ogrid:${name}`;
    if (!this.og || !this.brs4) return this.whisper(name, '<color="f55">/ogrid is not installed (lib/brs4.mjs missing).</>');
    if (this.config['ogrid-enabled'] === false) return this.whisper(name, '<color="f55">/ogrid is switched off for now.</>');
    if (!args.length) return this.whisper(name, 'Usage: /ogrid <link or search words> [size 32] [fps=N] [-x|+x|-y|+y] [mute] [letters] [start=S] [len=S]   /ogrid stop');
    if (args[0] === 'stop' || args[0] === 'off') {
      const hadOne = this.stopSession(name, key);
      // also the screen left standing after a finished video
      for (const id of this.ogOwners?.get(name) ?? []) this.omegga.writeln(`br.Bricks.Clear ${id} 1`);
      this.ogOwners?.delete(name);
      return hadOne || this.whisper(name, 'Screen removed.');
    }
    const opts = [], words = [];
    for (const a of args) (/^([+-][xy]|mute|letters|\d+|(fps|start|len)[=:]\d+(\.\d+)?)$/i.test(a) && !looksLikeLink(a) ? opts : words).push(a);
    if (!words.length) return this.whisper(name, 'Give a link or something to search for.');
    const link = looksLikeLink(words[0]) ? words[0] : `ytsearch10:${words.join(' ')}`;
    const opt = k => Number(opts.map(a => /^([a-z]+)[=:](\d+(?:\.\d+)?)$/i.exec(a)).find(m => m?.[1].toLowerCase() === k)?.[2] ?? NaN);
    // cell glyph: a full block (default) or, with `letters`, the letter O
    const glyph = opts.includes('letters') ? 'O' : this.config['ogrid-glyph'] || this.og.GLYPH;
    const n = Math.max(8, Math.min(this.config['ogrid-max-size'] ?? 96, Number(opts.find(a => /^\d+$/.test(a)) ?? this.config['ogrid-size'] ?? 64)));
    const fps = Math.max(1, Math.min(15, opt('fps') || this.config['ogrid-fps'] || 2));
    const facing = opts.find(a => SCREEN_RIGHT[a]) ?? '-x';
    const withSound = !opts.includes('mute');
    const chunkSec = Math.max(5, this.config['ogrid-chunk-seconds'] ?? 20);
    const strips = n % 4 === 0 && n >= 32 ? 4 : 1; // stacked text displays: one string caps at 32768 chars
    // runs a frame: what the strips can hold, and what the decoders get through in a frame's time
    // (4 loops share the owner's 10 ms wire budget a tick; 1416 runs at 2 fps ran live)
    const maxRuns = this.config['ogrid-max-runs'] ?? Math.min(this.og.stripRunCap(n, strips) * strips, Math.floor((this.config['ogrid-runs-per-sec'] ?? 6000) / fps));
    const crypto = require('crypto');
    const hash = crypto.createHash('sha1').update('ogrid:' + name).digest('hex');
    // a NEW owner every run: a late Bricks.Clear from a stopped run (restart within a few s) cut 90 bricks out of the next screen
    const owner = this.og.ownerFor(hash.slice(0, 6) + crypto.randomBytes(3).toString('hex'));
    this.ogOwners ??= new Map();
    const olds = this.ogOwners.get(name) ?? [];
    this.ogOwners.set(name, [owner.id]);
    const event = `og.${hash.slice(0, 6)}.${crypto.randomBytes(3).toString('hex')}`; // new name a session: an old cartridge never feeds a new screen
    const L = this.og.oLayout(n, { lh: this.config['ogrid-line-height'] ?? 1.6, charW: this.config['ogrid-char-width'] ?? 0.95, textScale: this.config['ogrid-text-scale'] ?? 1.6875 });

    this.stopSession(name, key);
    const session = { stopped: false, kind: 'O grid' };
    session.stop = () => (session.stopped = true);
    const audioClears = [];
    session.clear = () => { this.omegga.writeln(`br.Bricks.Clear ${owner.id} 1`); audioClears.splice(0).forEach(c => c()); };
    this.sessions.set(key, session);
    let file;
    try {
      const pos = await this.playerSpot(name);
      this.whisper(name, `<color="999">${loading()}...</>`);
      const maxMin = this.config['video-max-minutes'] ?? 240;
      file = await this.download(link, 'video', withSound, maxMin);
      if (session.stopped) return;
      const probe = JSON.parse(String(await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width:format=duration', '-of', 'json', file])));
      if (!probe.streams?.[0]?.width) throw new Error('that link has no picture');
      const total = Number(probe.format?.duration) || maxMin * 60;
      const startAt = Math.max(0, Math.min(total - 1, opt('start') || 0));
      const seconds = Math.min(total - startAt, maxMin * 60, opt('len') || Infinity);
      const chunks = Math.max(1, Math.ceil(seconds / chunkSec));

      // the screen stands in front of the player, facing them
      const nv = NORMAL[facing];
      const orient = 16 + { '-y': 0, '+x': 1, '+y': 2, '-x': 3 }[facing], T = ORIENT[orient];
      const dist = Math.max(10, Math.round((L.side * 0.9) / STUD)) * STUD;
      const snap = v => Math.round(v / STUD) * STUD;
      const at = [snap(pos[0] - nv[0] * dist), snap(pos[1] - nv[1] * dist), Math.round((pos[2] - FEET) / 4) * 4 + 2];
      const world = p => T(p).map((v, i) => v + at[i]);
      const build = async k => {
        const t0 = startAt + k * chunkSec, dur = Math.min(chunkSec, seconds - k * chunkSec);
        const raw = await run('ffmpeg', ['-v', 'error', '-ss', String(t0), '-t', String(dur), '-i', file,
          '-vf', `fps=${fps},crop='min(iw,ih)':'min(iw,ih)',scale=${n}:${n}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], 300_000, 1 << 30);
        const fb = n * n * 3, frames = [];
        for (let o = 0; o + fb <= raw.length; o += fb) frames.push(this.og.encodeFrame(raw.subarray(o, o + fb), n, { maxRuns, strips }));
        if (!frames.length) throw new Error('no frames decoded');
        let audio = null;
        if (withSound) {
          const wav = file.replace(/\.[^.]+$/, '') + `.og${k}.wav`;
          try {
            await run('ffmpeg', ['-v', 'error', '-y', '-ss', String(t0), '-t', String(dur), '-i', file, '-vn', '-ac', '1', '-ar', '44100', wav], 300_000);
            audio = await this.buildAudioDevice(wav, { mode: 'voice', flags: [...SPEECH_FLAGS, '--no-control-buttons'] });
          } catch (e) { console.error(`[media] ogrid soundtrack ${k}`, e); }
          finally { fs.rmSync(wav, { force: true }); }
        }
        return { frames, audio, dur };
      };
      // the soundtrack chip stands beside the screen (in speaker range of whoever watches it), chunks alternate sides so a swap never clears the playing one
      const loadAudio = (d, k) => {
        if (!d) return null;
        const c = world([(k % 2 ? 1 : -1) * (L.side / 2 + 60), 0, 28]);
        const spot = [0, 1, 2].map(i => Math.round((c[i] - (d.lo[i] + d.hi[i]) / 2) / 2) * 2);
        const clr = this.loadDevice(d, {}, spot);
        audioClears.push(clr);
        return clr;
      };

      let next = build(0);
      const first = await next;
      if (session.stopped) return;
      // the receiver: loaded once, then only cartridges; earlier runs' screens go first
      for (const id of olds) this.omegga.writeln(`br.Bricks.Clear ${id} 1`);
      for (const [c, h] of this.og.receiverBoxes(L)) this.clearBox(world(c), T(h).map(Math.abs));
      const loadAt = buf => {
        const ref = `media_tmp_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
        fs.writeFileSync(path.join(this.prefabDir, ref + '.brz'), buf);
        this.omegga.writeln(`br.Prefab.Load "${ref}" ${at.join(' ')} 0 ${orient}`);
        setTimeout(() => fs.rmSync(path.join(this.prefabDir, ref + '.brz'), { force: true }), 15_000);
      };
      loadAt(this.og.buildReceiver(this.brs4, L, { event, owner, glyph, strips }));
      await sleep(1500);
      this.whisper(name, `<color="9cf">Showing ${n}x${n} ${glyph === 'O' ? "O's" : 'blocks'} at ${fps} fps (${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}). /ogrid stop ends it.</>`);
      let sent = 0, prevAudio = null, set = first;
      for (let k = 0; k < chunks && !session.stopped; k++) {
        if (k > 0) set = await next.catch(e => (console.error(`[media] ogrid chunk ${k}`, e), null));
        if (k + 1 < chunks) next = build(k + 1); // decode the next chunk while this one plays
        if (!set) { await sleep(chunkSec * 1000); continue; }
        // cartridges alternate between two slots: this slot held chunk k-2 (long done)
        const slot = k % 2, [c, h] = this.og.cartridgeBox(L, slot);
        this.clearBox(world(c), T(h).map(Math.abs));
        loadAt(this.og.buildCartridge(this.brs4, L, set.frames, { event, fps, dur: set.dur, slot, owner }));
        const old = prevAudio;
        prevAudio = loadAudio(set.audio, k);
        if (old) setTimeout(old, 1500);
        sent += set.frames.length;
        const end = Date.now() / 1000 + set.dur;
        while (!session.stopped && Date.now() / 1000 < end) await sleep(50);
      }
      console.log(`[media] ogrid ${name}: ${n}x${n} ${fps} fps, ${sent} frames in ${chunks} cartridge(s), at ${at.join(',')} orient ${orient}`);
      await sleep(1500);
      // the screen stays up after the video (players tune its text settings); the next /ogrid or /ogrid stop clears it
      if (!session.stopped) audioClears.splice(0).forEach(c => c());
    } finally {
      session.stopped = true;
      if (file) setTimeout(() => this.release(file), 60_000);
      if (this.sessions.get(key) === session) this.sessions.delete(key);
    }
  }

  async audioCommand(name, args) {
    const key = `audio:${name}`;
    if (!args.length) {
      return this.whisper(name, 'Usage: /playaudio <link> [layered|speech|music|drums|mix] [voice|bank|midi] [sine|square|saw|triangle] | <sound name>   /playaudio list [word]   /stop');
    }
    if (args[0] === 'stop') return this.stopSession(name, key) || this.whisper(name, 'No audio playing.');
    if (args[0] === 'list') {
      const word = args.slice(1).join('_').toLowerCase();
      const hits = SOUNDS.filter(s => s.toLowerCase().includes(word)).map(soundLabel);
      if (!hits.length) return this.whisper(name, 'No sounds match that.');
      for (let i = 0; i < hits.length && i < 120; i += 12) this.whisper(name, `<color="9cf">${sanitize(hits.slice(i, i + 12).join(', '))}</>`);
      if (hits.length > 120) this.whisper(name, `...and ${hits.length - 120} more, add a word: /playaudio list music`);
      return;
    }
    this.stopSession(name, key);
    const session = { stopped: false, kind: 'audio' };
    session.stop = () => (session.stopped = true);
    this.sessions.set(key, session);

    if (looksLikeLink(args[0])) {
      let file;
      try {
        this.whisper(name, `<color="999">${loading()}...</>`);
        file = await this.download(args[0], 'audio');
        if (session.stopped) return;
        const preset = PRESETS[args.find(a => PRESETS[a]) ?? (args.some(a => ['voice', 'bank', 'midi'].includes(a)) ? null : 'speech')];
        const opts = { synth: args.find(a => SYNTHS[a]), mode: args.find(a => ['voice', 'bank', 'midi'].includes(a)) ?? preset?.mode, flags: preset?.flags ?? [], layered: preset?.layered, layers: preset?.layers, auto: preset?.auto && !args.some(a => SYNTHS[a] || ['voice', 'bank', 'midi'].includes(a)), tuneKey: args[0] };
        this.whisper(name, `<color="999">${loading()}...</>`);
        const devices = await this.buildAudioSet(file, opts);
        const device = devices[0];
        if (session.stopped) return;
        const spot = await this.speakerSpot(name);
        devices.forEach((d, k) => this.loadDevice(d, session, [spot[0] + k * this.deviceStep(devices), spot[1], spot[2]]));
        const secs = Math.round(device.seconds);
        this.broadcast(`<color="9cf">${sanitize(name)} is playing a song (${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}, ${{ voice: 'pitch switching', bank: 'pitch per speaker', midi: 'MIDI' }[device.mode]}, ${devices.length > 1 ? `${devices.length} layers, ` : ''}${devices.reduce((a, d) => a + d.speakers, 0)} speakers). /stop to end.</>`);
        // the device plays on its own; remove it once the song is over
        await new Promise(resolve => {
          const t = setTimeout(resolve, (device.seconds + 3) * 1000);
          session.stop = () => { session.stopped = true; clearTimeout(t); resolve(); };
        });
        if (!session.stopped) session.clear();
      } finally {
        if (file) this.release(file);
        if (this.sessions.get(key) === session) this.sessions.delete(key);
      }
      return;
    }

    // built-in sound: best match by words
    const words = args.map(a => a.toLowerCase().replace(/[^a-z0-9]/g, '')).filter(Boolean);
    const flat = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const exact = SOUNDS.find(s => flat(s) === words.join('') || flat(soundLabel(s)) === words.join(''));
    const matches = exact ? [exact] : SOUNDS.filter(s => words.every(w => flat(s).includes(w)));
    if (!matches.length) {
      this.sessions.delete(key);
      return this.whisper(name, 'No built-in sound matches that. /playaudio list music  shows some; links are converted to MIDI.');
    }
    const sound = matches.sort((a, b) => a.length - b.length)[0];
    let pos;
    try {
      pos = await this.playerSpot(name);
    } catch (e) {
      this.sessions.delete(key);
      throw e;
    }
    const spot = [Math.round(pos[0] / STUD) * STUD + 5, Math.round(pos[1] / STUD) * STUD + 5, Math.round((pos[2] + 40) / 2) * 2];
    session.clear = () => this.clearBox(spot, [5, 5, 4]);
    session.clear();
    this.loadSpeaker(spot, sound, { volume: 1, range: this.config['audio-range'] ?? 400 });
    this.whisper(name, `<color="9cf">Playing ${sanitize(soundLabel(sound))} from a speaker above you.${matches.length > 1 ? ` (${matches.length} matches, be more exact for another)` : ''} /stop to end.</>`);
  }

  /** Audio (or .mid) -> MIDI notes [[start, end, pitch, velocity]] via basic-pitch (tomidi.py). */
  async transcribe(file) {
    if (!fs.existsSync(PYTHON)) throw new Error('basic-pitch is not installed (plugins/media/venv)');
    const maxMin = this.config['max-minutes'] ?? 10;
    let src = file;
    if (!/\.midi?$/i.test(file)) {
      // trim to the length limit and hand basic-pitch a plain wav
      src = file + '.wav';
      await run('ffmpeg', ['-v', 'error', '-y', '-i', file, '-t', String(maxMin * 60), '-vn', '-ac', '1', '-ar', '22050', src], 300_000);
    }
    try {
      // audio also saves its transcription as <name>.out.mid; a .mid input needs no copy
      const midOut = /\.midi?$/i.test(file) ? [] : [file.replace(/\.[^.]+$/, '') + '.out.mid'];
      const out = await run(PYTHON, [path.join(__dirname, 'tomidi.py'), src, ...midOut], 900_000);
      return JSON.parse(String(out)).notes.filter(n => n[0] < maxMin * 60);
    } finally {
      if (src !== file) fs.rmSync(src, { force: true });
    }
  }

  /**
   * Build a self-playing speaker device with heightmap2brz: a microchip plays
   * the song on a cluster of synth speakers inside the game, so nothing is
   * streamed while it plays.
   *   voice: speakers track the strongest pitches every frame (default, best for music)
   *   bank:  one speaker per semitone, only volumes change (better for speech)
   *   midi:  basic-pitch transcribes to MIDI first, played as notes per instrument
   * .mid files always use the MIDI path.
   */
  /** One device, or (layered) one per frequency range; always an array. */
  async buildAudioSet(file, opts = {}) {
    if (opts.auto) {
      // a tuning failure must never cost the video its sound: fall back to the base settings
      const t = await this.autoTune(file, opts.tuneKey).catch(e => {
        console.error('[media] autotune failed, using base settings', e);
        return { flags: AF.FLAGSETS[0], filter: AF.FIXES.plain };
      });
      return [await this.buildAudioDevice(file, { mode: 'voice', flags: t.flags, filter: t.filter })];
    }
    if (!opts.layered && !opts.layers) return [await this.buildAudioDevice(file, opts)];
    const out = [];
    for (const L of opts.layers ?? LAYERS) {
      const part = file.replace(/\.[^.]+$/, '') + `.${L.name}.wav`;
      await run('ffmpeg', ['-v', 'error', '-y', '-i', file, '-vn', '-ac', '1', '-ar', '44100', ...(L.filter ? ['-af', L.filter] : []), part], 300_000);
      try { out.push(await this.buildAudioDevice(part, { synth: L.synth, mode: L.mode, flags: L.flags })); }
      finally { fs.rmSync(part, { force: true }); }
    }
    return out;
  }

  /**
   * Flags for the candidate whose re-synthesis sounds most like `file` (a 15 s
   * excerpt from the middle; see autotune.js). Cached per tuneKey so a long
   * video's later pieces reuse the first piece's choice.
   */
  async autoTune(file, tuneKey) {
    this.tuneCache ??= new Map();
    if (tuneKey && this.tuneCache.has(tuneKey)) return this.tuneCache.get(tuneKey);
    // choices survive reloads: the store keeps them per link
    const storeKey = tuneKey && 'tune:' + require('crypto').createHash('sha1').update(tuneKey).digest('hex').slice(0, 16);
    const stored = storeKey && await this.store.get(storeKey).catch(() => null);
    if (stored?.flags) {
      this.tuneCache.set(tuneKey, stored);
      return stored;
    }
    const t0 = Date.now();
    const base = file.replace(/\.[^.]+$/, '') + `.tune`;
    const dur = Number(String(await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file])).trim()) || 15;
    const start = Math.max(0, dur / 2 - 7.5), len = Math.min(15, dur);
    await run('ffmpeg', ['-v', 'error', '-y', '-ss', String(start), '-t', String(len), '-i', file, '-vn', '-ac', '1', '-ar', '44100', base + '.wav'], 120_000);
    const raw = await run('ffmpeg', ['-v', 'error', '-i', base + '.wav', '-ac', '1', '-ar', String(AT.SR), '-f', 'f32le', '-'], 60_000, 1 << 28);
    const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw, 'binary');
    const src = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length - (buf.length % 4)));
    let best, n = 0;
    try {
      // candidates in parallel, each from its own copy (devices are written next to their input)
      best = await AF.tune({
        src, brs: this.brs, log: m => console.error('[media] autotune', m),
        build: async (filter, flags) => {
          const wav = `${base}${n++}.wav`;
          fs.copyFileSync(base + '.wav', wav);
          try { return (await this.buildAudioDevice(wav, { mode: 'voice', flags, filter })).buf; }
          finally { fs.rmSync(wav, { force: true }); }
        },
      });
    } finally {
      fs.rmSync(base + '.wav', { force: true });
    }
    console.log(`[media] autotune ${path.basename(file)}: fix ${JSON.stringify(best.scores.fix)} flags ${best.scores.flags.join(' ')} -> ${best.fix} #${best.flagIndex} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    const choice = { fix: best.fix, filter: best.filter, flags: best.flags };
    if (tuneKey) {
      this.tuneCache.set(tuneKey, choice);
      while (this.tuneCache.size > 20) this.tuneCache.delete(this.tuneCache.keys().next().value);
      await this.store.set(storeKey, { ...choice, at: Date.now() }).catch(() => {});
    }
    return choice;
  }

  async buildAudioDevice(file, { synth, mode, flags = [], raw, filter } = {}) {
    if (!fs.existsSync(HEIGHTMAP)) throw new Error('heightmap2brz is missing from the plugin (bin/heightmap)');
    const maxMin = this.config['max-minutes'] ?? 10;
    const out = file.replace(/\.[^.]+$/, '') + '.device.brz';
    // MIDI picks a wave per instrument (bass sawtooth, lead square, piano
    // sine, ...); only force one there when the player asked for it
    const midiish = /\.midi?$/i.test(file) || mode === 'midi';
    const wave = synth ?? (midiish || raw ? null : this.config['synth'] ?? 'sine');
    const common = [
      ...(wave ? ['--synth', wave === 'saw' ? 'sawtooth' : wave] : []), '--no-loop',
      // the speakers live inside the microchip's grid: the device is one chip
      '--speakers-in-chip',
      '--inner-radius', '100', '--max-distance', String(this.config['audio-range'] ?? 400), '-o', out,
    ];
    let seconds;
    if (/\.midi?$/i.test(file) || mode === 'midi') {
      mode = 'midi';
      let mid = file;
      if (!/\.midi?$/i.test(file)) {
        // tomidi.py writes the transcription next to the source as .out.mid
        await this.transcribe(file);
        mid = file.replace(/\.[^.]+$/, '') + '.out.mid';
      }
      const notes = await this.transcribe(mid);
      if (!notes.length) throw new Error('no notes found');
      seconds = Math.max(...notes.map(n => n[1]));
      try {
        await run(HEIGHTMAP, [mid, '--midi', '--polyphony-cap', String(this.config['voices'] ?? 32), ...common], 300_000);
      } finally {
        if (mid !== file) fs.rmSync(mid, { force: true });
      }
    } else {
      mode = mode === 'bank' ? 'bank' : 'voice';
      // trim to the length limit; heightmap reads the wav directly
      const wav = file + '.wav';
      // filter = the per-video cleanup chain autoTune picked (audiofix.js)
      await run('ffmpeg', ['-v', 'error', '-y', '-i', file, '-t', String(maxMin * 60), '-vn', '-ac', '1', '-ar', '44100', ...(filter ? ['-af', filter] : []), wav], 300_000);
      try {
        seconds = Number(String(await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav])).trim()) || 60;
        // a preset's own --max-voices replaces the default (heightmap rejects a repeated flag)
        const extra = raw ? flags : [...(mode === 'voice' && !flags.includes('--max-voices') ? ['--max-voices', String(this.config['voices'] ?? 32)] : []), '--audio-fps', String(this.config['audio-fps'] ?? 60), ...flags];
        await run(HEIGHTMAP, [wav, '--audio-mode', mode, ...extra, ...common], 300_000);
      } finally {
        fs.rmSync(wav, { force: true });
      }
    }
    const buf = this.autoStart(fs.readFileSync(out));
    fs.rmSync(out, { force: true });
    // the bricks' own box, so /stop can clear exactly the device
    const reader = this.brs.WorldReader.from(buf);
    const assets = reader.brickAssets();
    let speakers = 0;
    // speakers sit on the chip's inner grid (2); the box only needs the main grid (1)
    for (let g = 2; g < 8; g++) {
      try {
        for (const b of reader.bricks(g)) if (/Speaker/.test(assets[b.asset_name_index])) speakers++;
      } catch {
        break;
      }
    }
    return { buf, ...this.deviceBox(reader), seconds, mode, speakers };
  }

  /** Main-grid box of a device (lo/hi), and of its micro brick pixels (pixLo/pixHi). */
  deviceBox(reader) {
    const assets = reader.brickAssets();
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    const pixLo = [Infinity, Infinity, Infinity], pixHi = [-Infinity, -Infinity, -Infinity];
    for (const b of reader.bricks(1)) {
      const half = b.size.some(v => v) ? b.size : [5, 5, 6];
      const pix = assets[b.asset_name_index] === 'PB_DefaultMicroBrick';
      for (let i = 0; i < 3; i++) {
        lo[i] = Math.min(lo[i], b.position[i] - half[i]);
        hi[i] = Math.max(hi[i], b.position[i] + half[i]);
        if (pix) {
          pixLo[i] = Math.min(pixLo[i], b.position[i] - half[i]);
          pixHi[i] = Math.max(pixHi[i], b.position[i] + half[i]);
        }
      }
    }
    return { lo, hi, pixLo, pixHi };
  }

  /**
   * (owner 2026-10-12: "make !playvideo's chip invisible and above it entirely")
   * The video device's microchip brick (and its gate grid) moved to a stud above
   * the picture's top row (file -y = up once stood), centred, hidden and with
   * no collision. deviceBox of the result includes it, so clears still take it.
   */
  chipAbove(buf) {
    const r = this.brs.WorldReader.from(buf), assets = r.brickAssets();
    let chip = null;
    const others = [];
    for (const b of r.bricks(1)) {
      if (assets[b.asset_name_index] === 'B_1x1_Microchip') { chip = b; continue; }
      const half = b.size.some(v => v) ? b.size : [5, 5, 6];
      others.push([b.position.map((v, i) => v - half[i]), b.position.map((v, i) => v + half[i])]);
    }
    const box = this.deviceBox(r);
    if (!chip || !Number.isFinite(box.pixLo[1])) return buf;
    // centred a stud above the picture's top row (file -y is up once stood), clear of the buttons
    const target = [Math.floor((box.pixLo[0] + box.pixHi[0]) / 20) * 10 + 5, Math.floor(box.pixLo[1] / 10) * 10 - 15, chip.position[2]];
    const hit = t => others.some(([lo, hi]) => lo[0] < t[0] + 5 && t[0] - 5 < hi[0] && lo[1] < t[1] + 5 && t[1] - 5 < hi[1] && lo[2] < t[2] + 6 && t[2] - 6 < hi[2]);
    while (hit(target)) target[1] -= 10;
    const parts = [{ buf, chipDelta: target.map((v, i) => v - chip.position[i]) }];
    if (this.probe) {
      // the clock probe, hidden 2 studs beside the chip (same load, same tick)
      const pr = this.brs.WorldReader.from(this.probe), pa = pr.brickAssets();
      const pc = [...pr.bricks(1)].find(b => pa[b.asset_name_index] === 'B_1x1_Microchip');
      if (pc) {
        const pt = [target[0] + 20, target[1], target[2]];
        while (hit(pt)) pt[0] += 10;
        parts.push({ buf: this.probe, offset: pt.map((v, i) => v - pc.position[i]), chipDelta: [0, 0, 0] });
      }
    }
    try { return this.mergeDevices(parts).buf; }
    catch (e) { console.error('[media] probe merge', e); return this.mergeDevices(parts.slice(0, 1)).buf; }
  }

  /**
   * One prefab out of several heightmap2brz devices: `parts` = [{ buf, offset }]
   * (main-grid offset in the first part's coordinates). Every brick, component,
   * wire (local and remote) and microchip grid entity is copied through the
   * brs World writer. Only the first part keeps its Pause/Restart/Resume
   * buttons; the others' buttons are dropped and the first part's buttons
   * are wired to their clocks instead, so one set of buttons drives all.
   * Returns { buf, boxes } with each part's main-grid box (for ClearRegion).
   */
  mergeDevices(parts) {
    const { World, WorldReader } = this.brs;
    const w = new World();
    const owner = w.addOwner(OWNER);
    const ext = [], extIndex = a => {
      let i = ext.findIndex(x => x.type === a.type && x.name === a.name);
      if (i < 0) i = ext.push(a) - 1;
      return i;
    };
    const buttons = new Map(); // label -> handle of the first part's button
    const boxes = [];
    const key = c => `${c.x}_${c.y}_${c.z}`;
    parts.forEach(({ buf, offset = [0, 0, 0], chipDelta = null }, partNo) => {
      const r = WorldReader.from(buf);
      const assets = r.brickAssets(), mats = r.materials(), extA = r.externalAssets();
      const remap = i => (typeof i === 'number' && extA[i] ? extIndex(extA[i]) : i);
      // grids: 1 = main, others = brick grid entities by persistent index
      const grids = new Map([[1, { grid: 0 }]]);
      for (const e of r.entities()) {
        if (!/BrickGrid/.test(e.typeName)) continue;
        const loc = e.location;
        grids.set(e.persistentIndex, w.addBrickGrid({
          type: e.typeName, owner_index: owner, rotation: e.rotation, frozen: e.frozen, sleeping: e.sleeping, data: e.data,
          location: { X: loc.X + offset[0] + (chipDelta && /Microchip/.test(e.typeName) ? chipDelta[0] : 0), Y: loc.Y + offset[1] + (chipDelta && /Microchip/.test(e.typeName) ? chipDelta[1] : 0), Z: loc.Z + offset[2] + (chipDelta && /Microchip/.test(e.typeName) ? chipDelta[2] : 0) },
        }));
      }
      const handles = new Map(); // `${grid}:${chunk}` -> [handle per brick in chunk]
      const dropped = new Map(); // `${grid}:${chunk}:${i}` -> button label
      const chips = [];
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (const [g, gh] of grids) {
        const it = r.bricks(g);
        for (const c of r.brickChunkIndex(g)) {
          const comps = new Map();
          if (c.numComponents) {
            for (const x of r.componentChunk(g, c.index).components) {
              const data = x.data && { ...x.data };
              if (x.typeName === 'Component_TextDisplay' && data) data.Font = remap(data.Font);
              if (x.typeName === 'Component_AudioEmitter' && data) data.AudioDescriptor = remap(data.AudioDescriptor);
              (comps.get(x.brickIndex) ?? comps.set(x.brickIndex, []).get(x.brickIndex)).push({ type: x.typeName, data });
            }
          }
          const list = [];
          handles.set(`${g}:${key(c.index)}`, list);
          for (let i = 0; i < c.numBricks; i++) {
            const b = it.next().value;
            const cs = comps.get(i) ?? [];
            const button = cs.find(x => x.type === 'Component_Internal_AnimatedButton');
            if (button && partNo > 0) {
              dropped.set(`${g}:${key(c.index)}:${i}`, button.data?.PromptCustomLabel);
              list.push(null);
              continue;
            }
            const asset = assets[b.asset_name_index];
            // chipDelta: the chip brick moves (with its grid entity, above) and is hidden, no collision
            const moveChip = chipDelta && g === 1 && asset === 'B_1x1_Microchip';
            const position = g === 1 ? b.position.map((v, k) => v + offset[k] + (moveChip ? chipDelta[k] : 0)) : b.position.map(v => v + 1024);
            const h = w.addBrick({
              asset, size: b.size.some(v => v) ? b.size : undefined, position, direction: b.direction, rotation: b.rotation,
              color: b.color, material: mats[b.material_index], material_intensity: b.material_intensity,
              collision: moveChip ? { player: false, weapon: false, interaction: false, tool: true, physics: false } : b.collision,
              visibility: moveChip ? false : b.visibility, owner_index: owner, components: cs,
            }, { grid: gh.grid });
            list.push(h);
            if (button && partNo === 0) buttons.set(button.data?.PromptCustomLabel, h);
            if (asset === 'B_1x1_Microchip') chips.push(h);
            if (g === 1) {
              const half = b.size.some(v => v) ? b.size : [5, 5, 6];
              for (let k = 0; k < 3; k++) {
                lo[k] = Math.min(lo[k], position[k] - half[k]);
                hi[k] = Math.max(hi[k], position[k] + half[k]);
              }
            }
          }
        }
      }
      // heightmap devices have one chip and one chip grid each
      const chipGrids = [...grids.values()].filter(h => h.grid);
      if (chips.length !== chipGrids.length) throw new Error(`device has ${chips.length} chips and ${chipGrids.length} grids`);
      chips.forEach((h, i) => w.registerMicrochipLink(h, chipGrids[i]));
      for (const g of grids.keys()) {
        for (const c of r.brickChunkIndex(g)) {
          if (!c.numWires) continue;
          let wc;
          try { wc = r.wireChunk(g, c.index); } catch { continue; }
          const here = handles.get(`${g}:${key(c.index)}`);
          const port = (h, x) => ({ brick: h, component_type: x.componentType, port: x.port });
          for (const x of wc.local) {
            if (here[x.source.brickIndex] && here[x.target.brickIndex]) w.addWire(port(here[x.source.brickIndex], x.source), port(here[x.target.brickIndex], x.target));
          }
          for (const x of wc.remote) {
            const at = `${x.source.gridId}:${key(x.source.chunk)}`;
            let src = handles.get(at)?.[x.source.brickIndex];
            // a dropped button: the first part's button with the same label drives it
            if (!src) src = buttons.get(dropped.get(`${at}:${x.source.brickIndex}`));
            if (src && here[x.target.brickIndex]) w.addWire(port(src, x.source), port(here[x.target.brickIndex], x.target));
          }
        }
      }
      boxes.push([lo, hi]);
    });
    w.makePrefab({});
    return { buf: Buffer.from(w.toBrz({ externalAssets: ext })), boxes };
  }

  /** Start the device's timer on load (autostart.mjs; also used by tools/ogrid.mjs). */
  autoStart(buf) {
    return this.autostart.autoStart(this.brs, buf);
  }

  /** Where a speaker device goes: just above the player's head. */
  async speakerSpot(name, pos) {
    pos ??= await this.playerSpot(name);
    return [Math.round(pos[0] / STUD) * STUD, Math.round(pos[1] / STUD) * STUD, Math.round((pos[2] + 50) / 2) * 2];
  }

  /** Load a device at `at` (Prefab.Load puts file coordinates + at, exactly) and hook it into session.clear. */
  /**
   * Spacing between side-by-side devices (layered audio): the widest device's
   * footprint plus a gap. They were 20 apart while ~35 wide, so each device's
   * pre-load ClearRegion ate the overlapping half of the one before it (2026-10-06:
   * no bass, a stuck mids note, only the last layer whole).
   */
  deviceStep(devices) {
    const w = Math.max(...devices.map(d => Math.max(d.hi[0] - d.lo[0], d.hi[1] - d.lo[1])));
    return Math.ceil((w + 10) / 10) * 10;
  }

  loadDevice(device, session, at, orient = 16, T = p => p) {
    // each part's box after the load's orientation (a merged device has
    // several far apart; one box over all would clear the ground between)
    const regions = (device.boxes ?? [[device.lo, device.hi]]).map(([blo, bhi]) => {
      const pts = [0, 1, 2, 3, 4, 5, 6, 7].map(c => T([0, 1, 2].map(i => ((c >> i) & 1 ? bhi : blo)[i])));
      const lo = [0, 1, 2].map(i => Math.min(...pts.map(p => p[i])));
      const hi = [0, 1, 2].map(i => Math.max(...pts.map(p => p[i])));
      return [[0, 1, 2].map(i => at[i] + (lo[i] + hi[i]) / 2), [0, 1, 2].map(i => (hi[i] - lo[i]) / 2)];
    });
    const prevClear = session.clear;
    // clearing the chip brick removes its inner grid entity with it
    const clear = () => regions.forEach(([center, half]) => this.clearBox(center, half));
    session.clear = () => { prevClear?.(); clear(); };
    clear();
    const ref = `media_tmp_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const file = path.join(this.prefabDir, ref + '.brz');
    fs.writeFileSync(file, device.buf);
    this.omegga.writeln(`br.Prefab.Load "${ref}" ${at.join(' ')} 0 ${orient}`);
    setTimeout(() => fs.rmSync(file, { force: true }), 15_000);
    return clear;
  }

  // ---------- stopping ----------

  /** Stop one session; true when something was playing. */
  stopSession(name, key) {
    const s = this.sessions.get(key);
    if (!s) return false;
    s.stop();
    s.clear?.();
    setTimeout(() => s.clear?.(), 1500); // catch a frame that was mid-load
    this.sessions.delete(key);
    this.whisper(name, `<color="999">Stopped ${s.kind}.</>`);
    return true;
  }

  async stopCommand(name, args) {
    if (args[0] === 'all') {
      if (!this.omegga.getPlayer(name)?.isHost()) return this.whisper(name, 'Only the host can stop everyone\'s media.');
      for (const [key, s] of this.sessions) {
        s.stop();
        s.clear?.();
      }
      this.sessions.clear();
      this.omegga.writeln(`br.Bricks.Clear ${OWNER.id} 1`);
      return this.broadcast('<color="999">All videos and audio stopped.</>');
    }
    const a = this.stopSession(name, `video:${name}`);
    const b = this.stopSession(name, `audio:${name}`);
    const c = this.stopSession(name, `tv:${name}`);
    if (a || b || c) return;
    if (!this.sessions.size) {
      // nothing playing anywhere: clear leftovers (frames/speakers from a reload or crash)
      this.omegga.writeln(`br.Bricks.Clear ${OWNER.id} 1`);
      return this.whisper(name, '<color="999">Nothing was playing; cleared any leftover screens and speakers.</>');
    }
    this.whisper(name, 'Nothing of yours is playing.');
  }
};
