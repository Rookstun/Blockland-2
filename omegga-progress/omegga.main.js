// progress: keeps players' progress for good (owner 2026-10-11: "make it so
// the progress gets saved permanently").
//
// The game keeps leaderboard values (coins, XP, Level, SwordTier: the
// skeleton_drop chip's economy) only in memory: a restart or a world reload
// wipes them. This plugin reads them for every online player every `interval`
// seconds and keeps them in its store (Omegga's database, on disk). When a
// player joins, or their XP is found lower than saved (XP never goes down, so
// that means the game reset it), the saved values are written back.
//
// Items: the skeleton_drop chip's "[inv]" slot lines are still kept (used by /clear);
// giving them back on join was removed 2026-10-28 (it gave stacks of knives; the weapon bank replaced it).
//
//   !progress        your saved values
//   /eco give|take|set <player|all> <n>   change coins (host + config `allowed`); offline players too
//   /clear <player>   empty their inventory (host + `allowed`): chip invclear/ + saved slots + pending names
//   /eco check [player]  /eco top  /eco pay <player> <n> (anyone, from their own coins)
// Unsafe (plain node) plugin, like tpa and duel.

const KEYS = ['coins', 'XP', 'Level', 'SwordTier', 'up_ammo', 'up_regen', 'up_magnet', 'up_vamp', 'up_hp', // up_* = upgrades/ panel levels
  'dvLv', 'dvXp', 'dvHp', 'dvArea', 'dvUnc', 'dvBoss', 'dvPie', 'dvCig']; // dv* = Daniel vs ISIS RPG savegame (dvi/gen.mjs)
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clean = s => String(s).replace(/[<>"\\;]/g, '');

module.exports = class Progress {
  constructor(omegga, config, store) {
    this.omegga = omegga;
    this.config = config;
    this.store = store;
    this.timer = null;
    this.busy = false;
    this.joined = new Map(); // userId -> join time (ms)
  }

  async init() {
    // unsafe plugins share Omegga's emitter: drop only our own handler from an earlier load (others listen to join too)
    if (this.omegga.__progressJoin) this.omegga.off('join', this.omegga.__progressJoin);
    this.omegga.__progressJoin = p => this.onJoin(p).catch(err => console.error('[progress] join', err));
    this.omegga.on('join', this.omegga.__progressJoin);
    for (const e of ['cmd:progress', 'chatcmd:progress']) {
      this.omegga.removeAllListeners(e);
      this.omegga.on(e, name => this.show(name).catch(err => console.error('[progress]', err)));
    }
    for (const e of ['cmd:eco', 'chatcmd:eco']) {
      this.omegga.removeAllListeners(e);
      this.omegga.on(e, (name, ...args) => this.eco(name, args).catch(err => { console.error('[eco]', err); this.ecoTell(name, 'error: ' + err.message); }));
    }
    for (const e of ['cmd:clear', 'chatcmd:clear']) {
      this.omegga.removeAllListeners(e);
      this.omegga.on(e, (name, ...args) => this.clearInv(name, args).catch(err => { console.error('[clear]', err); this.ecoTell(name, 'error: ' + err.message); }));
    }
    if (this.omegga.__progressLine) this.omegga.off('line', this.omegga.__progressLine);
    this.omegga.__progressLine = line => this.onLine(line);
    this.omegga.on('line', this.omegga.__progressLine);
    // catch up on slot lines logged before this load (the chip only logs changes)
    try {
      const fs = require('fs'), LOG = this.config?.logFile ?? '/tmp/omegga_pty2.log';
      if (fs.existsSync(LOG)) {
        const size = fs.statSync(LOG).size, fd = fs.openSync(LOG, 'r'), n = Math.min(size, 8e6), buf = Buffer.alloc(n);
        fs.readSync(fd, buf, 0, n, size - n); fs.closeSync(fd);
        for (const line of buf.toString('utf8').split('\n')) if (line.includes('[inv]') && !line.includes('WRITE')) this.onLine(line);
      }
    } catch (e) { console.error('[progress] log catch-up', e.message); }
    const every = Math.max(5, this.config?.interval ?? 20) * 1000;
    this.timer = setInterval(() => this.tick().catch(err => console.error('[progress] tick', err)), every);
    return { registeredCommands: ['progress', 'eco', 'clear'] };
  }

  async stop() {
    clearInterval(this.timer);
    await this.tick().catch(() => {});
  }

  /** the player's current values, or null if any read failed */
  async read(player) {
    const out = {};
    for (const k of KEYS) {
      const v = await player.getLeaderboard(k);
      if (v === null || v === undefined || Number.isNaN(+v)) return null;
      out[k] = +v;
    }
    return out;
  }

  restore(player, saved) {
    for (const k of KEYS) if (saved[k]) player.setLeaderboard(k, saved[k]);
    console.log(`[progress] restored ${player.name}: ${JSON.stringify(saved)}`);
  }

  onLine(line) {
    // slots are "Class" (older chips) or "Class=Shop Name" (names have spaces: take the rest of the line)
    const m = /\[inv\] ([0-9a-f-]{36}) (.+?)\s*$/.exec(line);
    if (m) {
      const parts = m[2].split('|').map(x => x.split('='));
      const slots = parts.map(([c]) => (!c || c === 'None' ? null : c.replace(/_C$/, '')));
      const names = parts.map(([c, n], i) => (slots[i] && n ? n : null));
      if (slots.some(Boolean)) this.store.set('inv:' + m[1], { slots, names, at: Date.now() }).catch(() => {});
      return;
    }
  }

  async onJoin(p) {
    await sleep((this.config?.joinDelay ?? 8) * 1000); // let them spawn first
    const player = this.omegga.getPlayer(p.id ?? p.name);
    if (!player) return;
    // item restore removed 2026-10-28 (owner: gave 15 knives, replaced by the weapon bank)
    player.setLeaderboard('InvPend', 0);
    const saved = await this.store.get('p:' + player.id);
    if (!saved) return;
    if (saved.ecoPend) { // /eco changed their coins while they were offline
      player.setLeaderboard('coins', saved.coins);
      await this.store.set('p:' + player.id, { ...saved, ecoPend: false });
      this.omegga.whisper(player.name, `<color="8cf">Your coins were set to ${saved.coins} while you were away.</>`);
    }
    const now = await this.read(player);
    if (!now || now.XP < saved.XP || (now.XP === saved.XP && now.coins === 0 && saved.coins > 0)) {
      this.restore(player, saved);
      this.omegga.whisper(player.name, `<color="8cf">Welcome back! Your progress is restored: level ${saved.Level}, ${saved.XP} XP, ${saved.coins} coins.</>`);
    }
  }

  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      for (const player of this.omegga.getPlayers()) {
        const p = this.omegga.getPlayer(player.id);
        if (!p) continue;
        const now = await this.read(p);
        if (!now) continue;
        const key = 'p:' + p.id, saved = await this.store.get(key);
        // the game reset them (restart, world reload): put the saved values back instead of saving the zeros
        if (saved && now.XP < saved.XP) { this.restore(p, saved); continue; }
        await this.store.set(key, { ...now, name: p.name, at: Date.now() });
      }
    } finally {
      this.busy = false;
    }
  }

  async show(name) {
    const p = this.omegga.getPlayer(name);
    if (!p) return;
    const s = await this.store.get('p:' + p.id);
    this.omegga.whisper(name, s ? `<color="8cf">Saved: level ${s.Level}, ${s.XP} XP, ${s.coins} coins, sword tier ${s.SwordTier}.</>` : '<color="8cf">Nothing saved yet (it saves every few seconds).</>');
  }

  ecoTell(name, msg) {
    this.omegga.whisper(name, `<color="fc6">[eco]</> ${clean(msg).slice(0, 300)}`);
  }

  ecoAllowed(name) {
    const p = this.omegga.getPlayer(name);
    if (p?.isHost?.()) return true;
    return (this.config?.allowed ?? ['abysmal garbage', 'soapstain22', 'renderman']).map(s => String(s).toLowerCase()).includes(String(name).toLowerCase());
  }

  /** exact name, else a unique partial match */
  static pick(list, q) {
    const ex = list.find(x => x.name.toLowerCase() === q);
    if (ex) return ex;
    const part = list.filter(x => x.name.toLowerCase().includes(q));
    return part.length === 1 ? part[0] : null;
  }

  async ecoSaved() {
    const out = [];
    for (const k of await this.store.keys()) if (k.startsWith('p:')) { const v = await this.store.get(k); if (v?.name) out.push({ id: k.slice(2), name: v.name, saved: v }); }
    return out;
  }

  /** online player, else the store entry of an offline one */
  async ecoTarget(q) {
    q = String(q ?? '').trim().toLowerCase();
    if (!q) return null;
    const on = Progress.pick(this.omegga.getPlayers(), q);
    if (on) return { online: this.omegga.getPlayer(on.id), id: on.id, name: on.name };
    const off = Progress.pick(await this.ecoSaved(), q);
    return off ? { online: null, ...off } : null;
  }

  async ecoGet(t) {
    if (t.online) { const v = await t.online.getLeaderboard('coins'); return Number.isNaN(+v) ? 0 : +v; }
    return t.saved?.coins ?? 0;
  }

  async ecoPut(t, coins) {
    coins = Math.max(0, Math.round(coins));
    const key = 'p:' + t.id, saved = (await this.store.get(key)) ?? { coins: 0, XP: 0, Level: 1, SwordTier: 0 };
    if (t.online) {
      t.online.setLeaderboard('coins', coins);
      // save now: the next tick could otherwise read the old value back
      await this.store.set(key, { ...saved, coins, name: t.name, at: Date.now(), ecoPend: false });
    } else await this.store.set(key, { ...saved, coins, ecoPend: true });
    console.log(`[eco] ${t.name} (${t.id}) coins = ${coins}${t.online ? '' : ' (offline, applied on join)'}`);
    return coins;
  }

  // /clear <player>: the invclear chip empties slots 0-9; the saved copy and any pending shop names go too,
  // so neither this plugin nor skeleton_drop gives the items back (the chip's 5 s check sees the empty slots)
  async clearInv(name, args) {
    if (!this.ecoAllowed(name)) return this.ecoTell(name, 'not allowed');
    const q = args.join(' ').trim().toLowerCase();
    if (!q) return this.ecoTell(name, 'usage: /clear <player>');
    const hit = Progress.pick(this.omegga.getPlayers(), q);
    if (!hit) return this.ecoTell(name, `no online player matches "${q}"`);
    const p = this.omegga.getPlayer(hit.id);
    this.omegga.writeln(`br.Chat.Command /invclear ${clean(hit.name)}`);
    await this.store.delete('inv:' + hit.id).catch(() => {});
    for (let i = 0; i < 10; i++) p.setLeaderboard('InvName' + i, 0);
    p.setLeaderboard('InvPend', 0);
    console.log(`[clear] ${name} cleared ${hit.name} (${hit.id})`);
    if (hit.name !== name) this.ecoTell(hit.name, `${name} cleared your inventory.`);
    return this.ecoTell(name, `cleared ${hit.name}'s inventory.`);
  }

  async eco(name, args) {
    const sub = String(args[0] ?? '').toLowerCase(), rest = args.slice(1);
    const amt = rest.length && /^-?\d+$/.test(rest[rest.length - 1]) ? +rest[rest.length - 1] : null;
    const who = (amt === null ? rest : rest.slice(0, -1)).join(' '); // names can have spaces
    const take = ['take', 'remove'].includes(sub);
    if (['give', 'add', 'set'].includes(sub) || take) {
      if (!this.ecoAllowed(name)) return this.ecoTell(name, 'not allowed');
      if (amt === null || !who) return this.ecoTell(name, `usage: /eco ${sub} <player|all> <amount>`);
      const targets = who.toLowerCase() === 'all'
        ? this.omegga.getPlayers().map(p => ({ online: this.omegga.getPlayer(p.id), id: p.id, name: p.name }))
        : [await this.ecoTarget(who)].filter(Boolean);
      if (!targets.length) return this.ecoTell(name, `no player matches "${who}"`);
      const out = [];
      for (const t of targets) {
        const cur = await this.ecoGet(t);
        const v = await this.ecoPut(t, sub === 'set' ? amt : take ? cur - amt : cur + amt);
        out.push(`${t.name} ${cur} to ${v}${t.online ? '' : ' (offline)'}`);
        if (t.online && t.name !== name) this.ecoTell(t.name, sub === 'set' ? `${name} set your coins to ${v}.` : take ? `${name} took ${amt} coins.` : `${name} gave you ${amt} coins.`);
      }
      return this.ecoTell(name, out.join(', '));
    }
    if (sub === 'pay') {
      if (amt === null || amt <= 0 || !who) return this.ecoTell(name, 'usage: /eco pay <player> <amount>');
      const me = this.omegga.getPlayer(name), t = await this.ecoTarget(who);
      if (!me) return;
      if (!t) return this.ecoTell(name, `no player matches "${who}"`);
      if (t.id === me.id) return this.ecoTell(name, 'that is you');
      const mt = { online: me, id: me.id, name: me.name }, mine = await this.ecoGet(mt);
      if (mine < amt) return this.ecoTell(name, `you only have ${mine} coins`);
      await this.ecoPut(mt, mine - amt);
      await this.ecoPut(t, (await this.ecoGet(t)) + amt);
      if (t.online) this.ecoTell(t.name, `${name} paid you ${amt} coins.`);
      return this.ecoTell(name, `paid ${t.name} ${amt} coins (you have ${mine - amt}).`);
    }
    if (['check', 'bal', 'balance'].includes(sub)) {
      const t = await this.ecoTarget(who || name);
      if (!t) return this.ecoTell(name, `no player matches "${who}"`);
      return this.ecoTell(name, `${t.name}: ${await this.ecoGet(t)} coins${t.online ? '' : ' (offline, saved)'}`);
    }
    if (sub === 'top') {
      const rows = (await this.ecoSaved()).map(s => ({ id: s.id, name: s.name, c: s.saved.coins ?? 0 }));
      for (const p of this.omegga.getPlayers()) {
        const c = await this.ecoGet({ online: this.omegga.getPlayer(p.id) }), r = rows.find(x => x.id === p.id);
        if (r) r.c = c; else rows.push({ id: p.id, name: p.name, c });
      }
      rows.sort((a, b) => b.c - a.c);
      return this.ecoTell(name, rows.slice(0, 10).map((r, i) => `${i + 1}. ${r.name} ${r.c}`).join(', '));
    }
    this.ecoTell(name, 'commands: /eco check [player], /eco top, /eco pay <player> <n>; admins: /eco give|take|set <player|all> <n>');
  }
};
