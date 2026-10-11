// duel: one-on-one fights in the sky colosseum (arena/arenagen.mjs).
//
//   !duel <player>   challenge someone          !duel accept / decline
//   !duel watch      teleport to the stands     !duel forfeit
//   !duel stats [p]  wins/losses                !duel top
//
// One duel at a time. Both fighters go to their pads (red -x, blue +x), a
// 3-2-1 countdown, then whoever leaves the pit loses: dying respawns you in
// town, which is out of the pit, and so is jumping into the stands or leaving
// the server. Draw after maxSeconds. Winner goes back to where they were.
// Unsafe (plain node) plugin, like tpa and buildbattle.

const sleep = ms => new Promise(r => setTimeout(r, ms));
const clean = s => String(s).replace(/[<>"\\;]/g, '');

// keep in sync with arena/arenagen.mjs
const CENTER = [-8200, -9400], FLOOR = 8000, PIT = [300, 200];
const PADS = [[CENTER[0] - 240, CENTER[1], FLOOR + 30], [CENTER[0] + 240, CENTER[1], FLOOR + 30]];
const STANDS = [CENTER[0], CENTER[1] + 200 + 20 + 40 * 3 + 20, FLOOR + 60 + 24 * 3 + 30];
const inPit = ([x, y, z]) =>
  Math.abs(x - CENTER[0]) < PIT[0] + 5 && Math.abs(y - CENTER[1]) < PIT[1] + 5 && z > FLOOR - 40 && z < FLOOR + 400;

module.exports = class Duel {
  constructor(omegga, config, store) {
    this.omegga = omegga;
    this.config = config;
    this.store = store;
    this.challenges = []; // { from, to, at }
    this.fight = null; // { names, home, start, done }
  }

  async init() {
    const handler = (name, sub = '', ...rest) =>
      this.route(name, sub.toLowerCase(), rest.join(' ').trim()).catch(err => {
        console.error('[duel]', err);
        this.whisper(name, `<color="f55">${clean(String(err.message ?? err).slice(0, 160))}</>`);
      });
    for (const e of ['cmd:duel', 'chatcmd:duel']) {
      this.omegga.removeAllListeners(e);
      this.omegga.on(e, handler);
    }
    return { registeredCommands: ['duel'] };
  }

  async stop() {
    if (this.fight) this.fight.done = true;
    this.fight = null;
    this.challenges = [];
  }

  whisper(name, msg) { this.omegga.writeln(`br.Chat.Whisper "${clean(name)}" ${msg}`); }
  broadcast(msg) { this.omegga.broadcast(`<color="e8b04a"><b>[Duel Arena]</></> ${msg}`); }
  middle(name, msg) { try { this.omegga.middlePrint(name, msg); } catch { this.whisper(name, msg); } }
  tp(name, [x, y, z]) { this.omegga.writeln(`br.Chat.Command /TP "${clean(name)}" ${Math.round(x)} ${Math.round(y)} ${Math.round(z)} 0`); }
  online(name) { return !!this.omegga.getPlayer(name); }
  get timeoutMs() { return (this.config?.timeout ?? 60) * 1000; }

  async route(name, sub, rest) {
    if (!sub || sub === 'help') return this.whisper(name, '<color="e8b04a">!duel <player> | accept | decline | watch | forfeit | stats [player] | top</>');
    if (sub === 'accept' || sub === 'yes') return this.accept(name, rest);
    if (sub === 'decline' || sub === 'no') return this.decline(name);
    if (sub === 'watch' || sub === 'spectate') return this.watch(name);
    if (sub === 'forfeit' || sub === 'leave') return this.forfeit(name);
    if (sub === 'stats') return this.stats(name, rest);
    if (sub === 'top') return this.top(name);
    return this.challenge(name, [sub, rest].filter(Boolean).join(' '));
  }

  find(query, self) {
    const q = query.trim().toLowerCase();
    const names = this.omegga.getPlayers().map(p => p.name).filter(n => n !== self);
    const hit = names.find(n => n.toLowerCase() === q) ??
      names.filter(n => n.toLowerCase().startsWith(q)).sort((a, b) => a.length - b.length)[0] ??
      names.filter(n => n.toLowerCase().includes(q)).sort((a, b) => a.length - b.length)[0];
    if (!hit) throw new Error(`no player online matching "${clean(query)}"`);
    return hit;
  }

  prune() {
    const now = Date.now();
    this.challenges = this.challenges.filter(c => now - c.at < this.timeoutMs && this.online(c.from) && this.online(c.to));
  }

  async challenge(name, who) {
    this.prune();
    const to = this.find(who, name);
    if (this.fight?.names.includes(to)) throw new Error(`${to} is fighting right now`);
    this.challenges = this.challenges.filter(c => c.from !== name);
    this.challenges.push({ from: name, to, at: Date.now() });
    const secs = Math.round(this.timeoutMs / 1000);
    this.whisper(name, `<color="e8b04a">Challenged <b>${clean(to)}</> to a duel (${secs}s).</>`);
    this.whisper(to, `<color="e8b04a"><b>${clean(name)}</> challenges you to a duel! <b>!duel accept</> or <b>!duel decline</>.</>`);
    this.broadcast(`<b>${clean(name)}</> has challenged <b>${clean(to)}</>!`);
  }

  async decline(name) {
    this.prune();
    const c = this.challenges.filter(c => c.to === name).sort((a, b) => b.at - a.at)[0];
    if (!c) throw new Error('no challenge waiting for you');
    this.challenges = this.challenges.filter(x => x !== c);
    this.whisper(c.from, `<color="f88"><b>${clean(name)}</> declined your duel.</>`);
    this.whisper(name, '<color="e8b04a">Declined.</>');
  }

  async position(name) {
    const p = this.omegga.getPlayer(name);
    if (!p) return null;
    return Promise.race([Promise.resolve(p.getPosition()).catch(() => null), sleep(2500).then(() => null)]);
  }

  async accept(name, rest) {
    this.prune();
    let mine = this.challenges.filter(c => c.to === name);
    if (rest) mine = mine.filter(c => c.from.toLowerCase().includes(rest.toLowerCase()));
    const c = mine.sort((a, b) => b.at - a.at)[0];
    if (!c) throw new Error('no challenge waiting for you');
    if (this.fight) throw new Error(`the arena is busy (${this.fight.names.join(' vs ')}), try again soon`);
    this.challenges = this.challenges.filter(x => x.from !== c.from && x.from !== name && x.to !== name && x.to !== c.from);
    const names = [c.from, name];
    const home = await Promise.all(names.map(n => this.position(n)));
    const f = (this.fight = { names, home, start: 0, done: false });
    this.run(f).catch(err => {
      console.error('[duel] run', err);
      if (this.fight === f) this.fight = null;
    });
  }

  async run(f) {
    const [a, b] = f.names;
    this.broadcast(`<b><color="e04040">${clean(a)}</></> vs <b><color="4070e0">${clean(b)}</></>! <b>!duel watch</> to spectate.`);
    f.names.forEach((n, i) => this.tp(n, PADS[i]));
    for (const p of f.names.map(n => this.omegga.getPlayer(n))) try { p?.heal?.(1000); } catch {}
    await sleep(1500);
    for (const s of ['3', '2', '1']) {
      f.names.forEach(n => this.middle(n, `<size="60"><b>${s}</></>`));
      await sleep(1000);
      if (f.done) return;
    }
    f.names.forEach(n => this.middle(n, '<size="60"><color="ff4040"><b>FIGHT!</></></>'));
    f.start = Date.now();
    const maxMs = (this.config?.maxSeconds ?? 180) * 1000;
    // a fighter is out after two misses in a row (one bad position read is not a loss)
    const misses = [0, 0];
    while (!f.done) {
      await sleep(700);
      const pos = await Promise.all(f.names.map(n => (this.online(n) ? this.position(n) : 'gone')));
      pos.forEach((p, i) => {
        if (p === 'gone') misses[i] = 9;
        else if (p && !inPit(p)) misses[i]++;
        else if (p) misses[i] = 0;
      });
      const out = misses.map(m => m >= 2);
      if (out[0] || out[1]) return this.finish(f, out[0] && out[1] ? null : out[0] ? 1 : 0, 'out');
      if (Date.now() - f.start > maxMs) return this.finish(f, null, 'time');
    }
  }

  async finish(f, winner, why) {
    if (f.done) return;
    f.done = true;
    const secs = Math.round((Date.now() - f.start) / 1000);
    if (winner === null) {
      this.broadcast(why === 'time' ? `Time! <b>${f.names.map(clean).join('</> and <b>')}</> draw.` : 'Both fighters fell: a draw!');
    } else {
      const w = f.names[winner], l = f.names[1 - winner];
      const stats = (await this.store.get('stats')) ?? {};
      (stats[w] ??= { w: 0, l: 0 }).w++;
      (stats[l] ??= { w: 0, l: 0 }).l++;
      await this.store.set('stats', stats);
      this.broadcast(`<size="28"><b>${clean(w)}</> defeats <b>${clean(l)}</>!</> (${secs}s, ${stats[w].w} win${stats[w].w === 1 ? '' : 's'})`);
      this.middle(w, '<size="50"><color="ffd040"><b>VICTORY</></></>');
    }
    await sleep(3000);
    // send whoever is still standing in the pit back home
    for (const [i, n] of f.names.entries()) {
      if (!this.online(n)) continue;
      const p = await this.position(n);
      if (p && inPit(p) && f.home[i]) this.tp(n, [f.home[i][0], f.home[i][1], f.home[i][2] + 10]);
    }
    if (this.fight === f) this.fight = null;
  }

  async forfeit(name) {
    const f = this.fight;
    if (!f?.names.includes(name)) throw new Error("you aren't in a duel");
    if (!f.start) f.start = Date.now();
    this.broadcast(`<b>${clean(name)}</> forfeits.`);
    await this.finish(f, 1 - f.names.indexOf(name), 'forfeit');
  }

  async watch(name) {
    this.tp(name, STANDS);
    this.whisper(name, `<color="e8b04a">Welcome to the stands.${this.fight ? ` Now fighting: <b>${this.fight.names.map(clean).join('</> vs <b>')}</>.` : ' Nobody is fighting: !duel <player>.'}</>`);
  }

  async stats(name, who) {
    const n = who ? this.find(who, null) : name;
    const s = ((await this.store.get('stats')) ?? {})[n] ?? { w: 0, l: 0 };
    this.whisper(name, `<color="e8b04a"><b>${clean(n)}</>: ${s.w} wins, ${s.l} losses.</>`);
  }

  async top(name) {
    const all = Object.entries((await this.store.get('stats')) ?? {}).sort((a, b) => b[1].w - a[1].w || a[1].l - b[1].l).slice(0, 5);
    if (!all.length) return this.whisper(name, '<color="e8b04a">No duels fought yet.</>');
    this.whisper(name, '<color="e8b04a">Top duelists: ' + all.map(([n, s], i) => `${i + 1}. <b>${clean(n)}</> ${s.w}-${s.l}`).join(', ') + '</>');
  }
};
