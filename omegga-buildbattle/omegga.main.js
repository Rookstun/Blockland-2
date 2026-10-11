// buildbattle: Minecraft-style build battles (owner 2026-10-07).
//
//   !bb join / !bb leave   sign up (or drop out) while the lobby is open
//   !bb start [minutes]    start with everyone signed up (1+ players)
//   !bb stop               end the game now (whoever started it, or the host)
//   !bb theme              repeat the theme
//   !vote 1-5              score the plot you are looking at (not your own)
//   !bb builds [page]      the collection: every build ever made, newest first
//   !bb load <n>           (host) put collected build n down next to you
//
// A game: every player gets a plot (a grass floor with a stone kerb) in a row
// of plots high above spawn, a random theme and `buildMinutes` to build. Anyone
// who wanders off their plot (or falls) is put back on it. Then everyone is
// taken round the plots, `voteSeconds` each, and votes; the best total wins.
// Every plot is saved (br.Prefab.SaveRegion -> Prefabs/bb_<date>_<theme>_<name>.brz)
// into the collection (store 'builds') before the arena is cleared. Afterwards players go back to where they were and the arena is cleared
// (small ClearRegion boxes first, then the whole plot: a box holding ~1,800+
// bricks silently clears nothing). Unsafe (plain node) plugin, like the others.

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const clean = s => String(s).replace(/[<>"\\;]/g, '');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const OWNER = { id: 'b0b0b0b0-bbbb-4bbb-8bbb-000000000bb1', name: 'Build Battle' };
const ARENA = [0, 6000, 12000]; // centre of the plot row (sky above the island, under nothing)
const PLOT = 200;               // half size of a plot floor (40 x 40 studs)
const GAP = 160;                // between plots
const KERB = 10;                // kerb half width
const HEIGHT = 480;             // build space above the floor
const THEMES = [
  'castle', 'pirate ship', 'treehouse', 'dragon', 'robot', 'volcano', 'lighthouse', 'spaceship', 'haunted house', 'giant food',
  'underwater', 'train', 'windmill', 'mushroom house', 'statue', 'car', 'jungle temple', 'snowman', 'rocket', 'zoo animal',
  'fountain', 'bridge', 'airplane', 'monster', 'skyscraper', 'farm', 'campfire', 'wizard tower', 'boat', 'giant shoe',
  'cake', 'tank', 'garden', 'dinosaur', 'house of the future', 'medieval market', 'roller coaster', 'cactus', 'arcade machine', 'portal',
];

module.exports = class BuildBattle {
  constructor(omegga, config, store) {
    this.omegga = omegga;
    this.config = config;
    this.store = store;
    this.game = null;   // the running game, see start()
    this.lobby = new Set();
    this.timers = [];
  }

  get buildMinutes() { return Number(this.config?.buildMinutes ?? 5); }
  get voteSeconds() { return Number(this.config?.voteSeconds ?? 20); }

  async init() {
    this.brs = await import(pathToFileURL(path.join(__dirname, '..', 'bridge', 'lib', 'brs.mjs')).href);
    this.prefabDir = path.join(path.dirname(this.omegga.savePath), 'Prefabs');
    const on = (events, fn) => {
      const handler = (name, ...args) =>
        fn.call(this, name, args.map(String)).catch(err => {
          console.error('[buildbattle]', err);
          this.whisper(name, `<color="f55">${clean(String(err.message ?? err).slice(0, 160))}</>`);
        });
      for (const e of events) {
        this.omegga.removeAllListeners(e); // unsafe plugins share Omegga's emitter
        this.omegga.on(e, handler);
      }
    };
    on(['cmd:bb', 'chatcmd:bb'], this.command);
    on(['cmd:vote', 'chatcmd:vote'], (n, a) => this.vote(n, a[0]));
    // a game cut short by a reload/restart: clear what it left
    const left = await this.store.get('arena');
    if (left) await this.clearArena(left).catch(() => {});
    await this.store.delete('arena');
    return { registeredCommands: ['bb', 'vote'] };
  }

  async stop() {
    for (const t of this.timers) clearTimeout(t), clearInterval(t);
    this.timers = [];
    if (this.game) await this.clearArena(this.game.plots.length).catch(() => {});
    this.game = null;
  }

  // ------------------------------------------------------------- chat --
  broadcast(msg) { this.omegga.broadcast(`<color="ffcc33"><b>[Build Battle]</></> ${msg}`); }
  whisper(name, msg) { this.omegga.writeln(`br.Chat.Whisper "${clean(name)}" ${msg}`); }
  tp(name, [x, y, z]) { this.omegga.writeln(`br.Chat.Command /TP "${clean(name)}" ${Math.round(x)} ${Math.round(y)} ${Math.round(z)} 0`); }
  isHost(name) { const p = this.omegga.getPlayer(name); return !!p && (p.isHost?.() || this.omegga.host?.name === name); }

  async command(name, [sub = '', arg]) {
    sub = sub.toLowerCase();
    if (sub === 'join') return this.join(name);
    if (sub === 'leave') return this.leave(name);
    if (sub === 'start') return this.start(name, arg);
    if (sub === 'stop') return this.stopGame(name);
    if (sub === 'builds') return this.listBuilds(name, arg);
    if (sub === 'load') return this.loadBuild(name, arg);
    if (sub === 'theme') return this.whisper(name, this.game ? `Theme: <b>${this.game.theme}</>` : 'No game running.');
    this.whisper(name, '<b>Build Battle:</> !bb join, !bb leave, !bb start [minutes], !bb stop, !bb theme, !vote 1-5, !bb builds, !bb load N');
  }

  async join(name) {
    if (this.game) throw new Error('a game is running, wait for the next one');
    this.lobby.add(name);
    this.broadcast(`${clean(name)} joined (${this.lobby.size} signed up). <b>!bb join</> to play, <b>!bb start</> to begin.`);
  }

  async leave(name) {
    if (this.lobby.delete(name)) this.broadcast(`${clean(name)} left the lobby (${this.lobby.size} signed up).`);
    if (this.game) {
      const p = this.game.plots.find(q => q.name === name);
      if (p) { p.left = true; this.whisper(name, 'You left the game.'); this.tp(name, p.back); }
    }
  }

  // ------------------------------------------------------------- arena --
  plotCentre(i, n) { return [ARENA[0] + (i - (n - 1) / 2) * (2 * PLOT + GAP), ARENA[1], ARENA[2]]; }

  loadBricks(bricks) {
    const w = new this.brs.World();
    w.addOwner(OWNER);
    for (const b of bricks) w.addBrick({ asset: 'PB_DefaultBrick', ...b, owner_index: 1 });
    w.makePrefab();
    const ref = `bb_tmp_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const file = path.join(this.prefabDir, ref + '.brz');
    fs.writeFileSync(file, w.toBrz());
    this.omegga.writeln(`br.Prefab.Load "${ref}" 0 0 0 1 16`);
    setTimeout(() => fs.rmSync(file, { force: true }), 15_000);
  }

  buildArena(n) {
    const bricks = [];
    for (let i = 0; i < n; i++) {
      const [x, y, z] = this.plotCentre(i, n);
      // floor: a grass plate on a stone slab, then a kerb round it (the plot's edge)
      bricks.push({ position: [x, y, z - 8], size: [PLOT + 2 * KERB, PLOT + 2 * KERB, 6], color: [96, 94, 92] });
      bricks.push({ asset: 'PB_DefaultTile', position: [x, y, z - 1], size: [PLOT, PLOT, 1], color: [84, 140, 58] });
      for (const [dx, dy, hx, hy] of [[0, PLOT + KERB, PLOT + 2 * KERB, KERB], [0, -PLOT - KERB, PLOT + 2 * KERB, KERB], [PLOT + KERB, 0, KERB, PLOT], [-PLOT - KERB, 0, KERB, PLOT]])
        bricks.push({ asset: 'PB_DefaultMicroBrick', position: [x + dx, y + dy, z + 4], size: [hx, hy, 6], color: [150, 146, 134] });
    }
    this.loadBricks(bricks);
  }

  async clearArena(n) {
    // small boxes first (a box holding ~1,800+ bricks silently clears nothing),
    // then each whole plot for anything that straddled them, then the floors
    const S = 4, cell = (2 * PLOT) / S, LAYER = 120;
    for (let i = 0; i < n; i++) {
      const [x, y, z] = this.plotCentre(i, n);
      for (let a = 0; a < S; a++) for (let b = 0; b < S; b++) for (let zz = 0; zz < HEIGHT; zz += LAYER)
        this.omegga.writeln(`br.World.ClearRegion ${x - PLOT + (a + 0.5) * cell} ${y - PLOT + (b + 0.5) * cell} ${z + zz + LAYER / 2} ${cell / 2 + 1} ${cell / 2 + 1} ${LAYER / 2 + 1}`);
    }
    await sleep(Math.min(20000, n * S * S * (HEIGHT / LAYER) * 12 + 2000));
    for (let i = 0; i < n; i++) {
      const [x, y, z] = this.plotCentre(i, n);
      this.omegga.writeln(`br.World.ClearRegion ${x} ${y} ${z + HEIGHT / 2} ${PLOT + 2 * KERB + 40} ${PLOT + 2 * KERB + 40} ${HEIGHT / 2 + 40}`);
    }
    await sleep(1500);
    for (let i = 0; i < n; i++) {
      const [x, y, z] = this.plotCentre(i, n);
      this.omegga.writeln(`br.World.ClearRegion ${x} ${y} ${z - 4} ${PLOT + 2 * KERB + 1} ${PLOT + 2 * KERB + 1} 12`);
    }
  }

  // -------------------------------------------------------- collection --
  /** save every plot of game g as a prefab and add it to the collection */
  async collect(g, scores = new Map()) {
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'x';
    const builds = (await this.store.get('builds')) ?? [];
    const best = Math.max(0, ...scores.values());
    for (const p of g.plots) {
      const [x, y, z] = p.centre;
      const file = `bb_${day}_${slug(g.theme)}_${slug(p.name)}_${Date.now() % 100000}`;
      // the floor and everything built above it
      this.omegga.writeln(`br.Prefab.SaveRegion "${file}" ${x} ${y} ${z + HEIGHT / 2 - 14} ${PLOT + 2 * KERB} ${PLOT + 2 * KERB} ${HEIGHT / 2 + 14} 0`);
      const score = scores.get(p.name) ?? null;
      builds.push({ file, player: p.name, theme: g.theme, score, won: score !== null && score === best && best > 0, at: Date.now() });
      await sleep(400);
    }
    await this.store.set('builds', builds);
    this.broadcast(`${g.plots.length} build${g.plots.length > 1 ? 's' : ''} added to the collection (${builds.length} in all). <b>!bb builds</> to see them.`);
  }

  async listBuilds(name, pageArg) {
    const builds = ((await this.store.get('builds')) ?? []).map((b, i) => ({ ...b, n: i + 1 })).reverse();
    if (!builds.length) return this.whisper(name, 'No builds collected yet: play a round with <b>!bb start</>.');
    const page = Math.max(1, Number(pageArg) || 1), per = 8, pages = Math.ceil(builds.length / per);
    this.whisper(name, `<b>Collected builds</> (${builds.length}), page ${Math.min(page, pages)}/${pages}:`);
    for (const b of builds.slice((page - 1) * per, page * per))
      this.whisper(name, `#${b.n} <b>${clean(b.theme)}</> by ${clean(b.player)}${b.score !== null ? `, ${b.score} pts` : ''}${b.won ? ' <color="ffcc33">(winner)</>' : ''} - ${new Date(b.at).toISOString().slice(0, 10)}`);
  }

  async loadBuild(name, nArg) {
    if (!this.isHost(name)) throw new Error('only the host can place collected builds');
    const builds = (await this.store.get('builds')) ?? [];
    const b = builds[Math.round(Number(nArg)) - 1];
    if (!b) throw new Error(`no build #${nArg}, see !bb builds`);
    const me = (await this.omegga.getAllPlayerPositions()).find(p => p.player.name === name);
    if (!me?.pos) throw new Error("can't find where you are");
    const [x, y, z] = me.pos;
    // next to you (a plot's width off), standing on your floor level
    this.omegga.writeln(`br.Prefab.Load "${b.file}" ${Math.round(x + 2 * PLOT + 60)} ${Math.round(y)} ${Math.round(z - 26 + HEIGHT / 2)} 0 16`);
    this.whisper(name, `Placed #${nArg}: ${clean(b.theme)} by ${clean(b.player)}.`);
  }

  // -------------------------------------------------------------- game --
  async start(name, minutesArg) {
    if (this.game) throw new Error('a game is already running');
    if (!this.lobby.has(name)) this.lobby.add(name);
    const players = [...this.lobby].filter(n => this.omegga.getPlayer(n));
    if (!players.length) throw new Error('nobody signed up');
    const minutes = Math.max(1, Math.min(30, Number(minutesArg) || this.buildMinutes));
    const positions = new Map((await this.omegga.getAllPlayerPositions()).map(p => [p.player.name, p.pos]));
    const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
    const plots = players.map((p, i) => ({ name: p, i, centre: this.plotCentre(i, players.length), back: positions.get(p) ?? [0, 0, 700], votes: new Map(), left: false }));
    this.game = { starter: name, theme, plots, phase: 'build', ends: Date.now() + minutes * 60000, current: -1 };
    this.lobby.clear();
    await this.store.set('arena', plots.length);
    this.buildArena(plots.length);
    await sleep(2500);
    for (const p of plots) this.tp(p.name, [p.centre[0], p.centre[1], p.centre[2] + 40]);
    this.broadcast(`<b>${plots.length} builder${plots.length > 1 ? 's' : ''}, ${minutes} min.</> Theme: <size="28"><color="ffffff"><b>${theme}</></></>. Build on your own plot!`);
    // reminders, and keep builders on their plots
    for (const left of [60, 30, 10]) if (minutes * 60 > left) this.timers.push(setTimeout(() => this.game?.phase === 'build' && this.broadcast(`<b>${left} s</> left to build!`), minutes * 60000 - left * 1000));
    this.timers.push(setTimeout(() => this.voting().catch(e => console.error('[buildbattle]', e)), minutes * 60000));
    this.timers.push(setInterval(() => this.keepOnPlots().catch(() => {}), 3000));
  }

  async keepOnPlots() {
    const g = this.game;
    if (!g || g.phase !== 'build') return;
    for (const { player, pos } of await this.omegga.getAllPlayerPositions()) {
      const p = g.plots.find(q => q.name === player.name && !q.left);
      if (!p || !pos) continue;
      const [x, y, z] = p.centre, out = Math.abs(pos[0] - x) > PLOT + 60 || Math.abs(pos[1] - y) > PLOT + 60 || pos[2] < z - 60 || pos[2] > z + HEIGHT + 200;
      if (out) { this.tp(player.name, [x, y, z + 40]); this.whisper(player.name, 'Stay on your plot!'); }
    }
  }

  async voting() {
    const g = this.game;
    if (!g) return;
    g.phase = 'vote';
    const active = g.plots.filter(p => !p.left);
    this.broadcast(`<b>Time's up!</> Now we visit every build. Score each one with <b>!vote 1-5</>.`);
    await sleep(2000);
    for (const p of active) {
      if (this.game !== g) return;
      g.current = p.i;
      const [x, y, z] = p.centre;
      for (const q of active) this.tp(q.name, [x + (q.i - active.length / 2) * 30, y - PLOT - 60, z + 60]);
      this.broadcast(`Plot ${active.indexOf(p) + 1}/${active.length}: <b>${clean(p.name)}</b>'s "${g.theme}". <b>!vote 1-5</> (${this.voteSeconds} s)`);
      await sleep(this.voteSeconds * 1000);
    }
    await this.finish();
  }

  async vote(name, arg) {
    const g = this.game;
    if (!g || g.phase !== 'vote' || g.current < 0) throw new Error('no vote right now');
    const p = g.plots[g.current];
    if (p.name === name) throw new Error("you can't vote on your own build");
    const n = Math.round(Number(arg));
    if (!(n >= 1 && n <= 5)) throw new Error('vote 1 to 5, e.g. !vote 4');
    p.votes.set(name, n);
    this.whisper(name, `You gave ${clean(p.name)}'s build <b>${n}</>/5.`);
  }

  async finish() {
    const g = this.game;
    if (!g) return;
    g.phase = 'done';
    for (const t of this.timers) clearTimeout(t), clearInterval(t);
    this.timers = [];
    const scored = g.plots.filter(p => !p.left).map(p => ({ p, total: [...p.votes.values()].reduce((a, b) => a + b, 0), n: p.votes.size }))
      .sort((a, b) => b.total - a.total);
    if (scored.length) {
      const best = scored[0].total, winners = scored.filter(s => s.total === best).map(s => clean(s.p.name));
      this.broadcast(`<size="30"><b>${winners.join(' & ')}</> win${winners.length > 1 ? '' : 's'}!</> (${best} points) ` +
        scored.map(s => `${clean(s.p.name)} ${s.total}`).join(', '));
    }
    await this.collect(g, new Map(scored.map(s => [s.p.name, s.total])));
    this.broadcast('The arena is cleared in 20 s: grab a last look!');
    await sleep(20000);
    for (const p of g.plots) if (this.omegga.getPlayer(p.name)) this.tp(p.name, p.back);
    await sleep(1500);
    await this.clearArena(g.plots.length);
    await this.store.delete('arena');
    this.game = null;
  }

  async stopGame(name) {
    if (!this.game) throw new Error('no game running');
    if (name !== this.game.starter && !this.isHost(name)) throw new Error('only whoever started it (or the host) can stop it');
    this.broadcast(`Game stopped by ${clean(name)}.`);
    const g = this.game;
    g.phase = 'done';
    await this.collect(g);
    for (const t of this.timers) clearTimeout(t), clearInterval(t);
    this.timers = [];
    for (const p of g.plots) if (this.omegga.getPlayer(p.name)) this.tp(p.name, p.back);
    await sleep(1500);
    await this.clearArena(g.plots.length);
    await this.store.delete('arena');
    this.game = null;
  }
};
