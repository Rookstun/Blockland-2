// REAL ESTATE (owner 2026-10-19: "real estate system in which areas are able to be bought and sold
// and allows the player to enter buildmode while in the area. use a zone projector and make it 3
// studs underground. players can build on it.").
// Lots = plots.json (realestate/plots.mjs): raised pads with a hidden BP_ZoneProjector 3 studs under
// the surface projecting a BUILD ZONE (bIsBuildingZone) up 1200 units. Players without
// BR.Permission.Building.BuildOutsideBuildZones can only build inside build zones; who may build in
// which lot is this plugin's job: once a second it checks every player's position and, on a lot they
// own or are trusted on, keeps BR.Permission.Building switched on for their character through the
// plotperm chip (br.Chat.Command /plotperm <name>|1, re-sent every few seconds: a respawn is a new
// character), and switches it off once when they step off.
// Money = the "coins" leaderboard (same as the quests plugin). State in the plugin store: lot:<id>.
//   /plot                  info for the lot you stand on (or the list)
//   /plot list             every lot, owner / price
//   /plot buy              buy the lot you stand on (from the town or from a player selling it)
//   /plot sell <coins>     put your lot up for sale to players (your builds go with it)
//   /plot unlist           take it off the market
//   /plot abandon          give it back to the town for half its town price; your builds on it are cleared
//   /plot trust <player> | untrust <player>   let someone else build on your lot
//   admin: /plot give <lot> <player>, /plot reset <lot>, /plot price <lot> <coins>
// FOR SALE signs (realestate/salesign.mjs, the owner's own sign): E on it -> ConsoleTag event:plot:<id>
// -> "click to buy? /confirm" -> /confirm within CONFIRM_MS buys that lot (no need to stand on it).
const fs = require('fs');
const path = require('path');

const C = (hex, s) => `<color="${hex}">${s}</>`;
const PLOTS = JSON.parse(fs.readFileSync(path.join(__dirname, 'plots.json'), 'utf8'));
const BY_ID = new Map(PLOTS.map(p => [p.id, p]));
const RESEND_MS = 4000;
const CONFIRM_MS = 10_000;

module.exports = class RealEstate {
  constructor(omegga, config, store) {
    this.omegga = omegga; this.config = config ?? {}; this.store = store;
    this.where = new Map();   // player id -> lot id they stand on (or 0)
    this.granted = new Map(); // player id -> { name, lot, at } while we hold their build permission on
    this.offers = new Map();  // player id -> { lot, until } after clicking a FOR SALE sign
  }

  async init() {
    const on = (e, fn) => { this.omegga.removeAllListeners(e); this.omegga.on(e, (...a) => fn(...a).catch(err => console.error('[realestate]', e, err))); };
    for (const e of ['cmd:plot', 'chatcmd:plot', 'cmd:lot', 'chatcmd:lot']) on(e, (name, ...a) => this.cmd(name, a));
    for (const e of ['cmd:confirm', 'chatcmd:confirm']) on(e, name => this.confirm(name));
    on('event:plot', (who, id) => this.clickSign(who, id));
    on('join', p => this.onJoin(p));
    on('leave', async p => { this.where.delete(p.id); this.granted.delete(p.id); this.offers.delete(p.id); });
    this.ticker = setInterval(() => this.tick().catch(err => console.error('[realestate] tick', err)), 1000);
    console.log(`[realestate] ${PLOTS.length} lots`);
    return { registeredCommands: ['plot', 'lot', 'confirm'] };
  }
  async stop() {
    clearInterval(this.ticker);
    for (const g of this.granted.values()) this.perm(g.name, 0);
  }

  lot = async id => (await this.store.get('lot:' + id)) ?? { owner: null, ownerName: null, sale: null, trust: [] };
  putLot = (id, s) => this.store.set('lot:' + id, s);
  price = async p => (await this.store.get('price:' + p.id)) ?? p.price;
  perm(name, on) { this.omegga.writeln(`br.Chat.Command /plotperm ${name}|${on ? 1 : 0}`); }
  run(line) { this.omegga.writeln(line); }

  lotAt([x, y, z]) {
    for (const p of PLOTS) {
      const zn = p.zone;
      if (x >= zn.x0 && x <= zn.x1 && y >= zn.y0 && y <= zn.y1 && z >= p.surface - 40 && z <= zn.z1) return p;
    }
    return null;
  }
  canBuild = (s, pid) => s.owner === pid || (s.trust ?? []).some(t => t.id === pid);

  async tick() {
    const now = Date.now();
    const seen = new Set();
    for (const { player, pos } of await this.omegga.getAllPlayerPositions()) {
      if (!player || !pos) continue;
      seen.add(player.id);
      const p = this.lotAt(pos), was = this.where.get(player.id) ?? 0;
      const s = p ? await this.lot(p.id) : null;
      const ok = !!(p && this.canBuild(s, player.id));
      if ((p?.id ?? 0) !== was) {
        this.where.set(player.id, p?.id ?? 0);
        if (p) this.omegga.middlePrint(player.name, await this.banner(p, s, player.id));
      }
      const g = this.granted.get(player.id);
      if (ok && (!g || g.lot !== p.id || now - g.at >= RESEND_MS)) {
        this.perm(player.name, 1);
        this.granted.set(player.id, { name: player.name, lot: p.id, at: now });
      } else if (!ok && g) {
        this.perm(player.name, 0);
        this.granted.delete(player.id);
      }
    }
    for (const id of [...this.granted.keys()]) if (!seen.has(id)) this.granted.delete(id);
  }

  async banner(p, s, pid) {
    const size = `${p.studs}x${p.studs} studs`;
    if (!s.owner) return `${C('ffd34d', `<b>${p.name}</>`)} ${C('8cf', `${size} · FOR SALE ${await this.price(p)} coins · /plot buy`)}`;
    if (s.owner === pid) return `${C('8f8', `<b>${p.name}</> · your lot`)} ${C('8cf', '· build mode is yours here')}`;
    const sale = s.sale ? C('ffd34d', ` · for sale ${s.sale} coins · /plot buy`) : '';
    const trusted = this.canBuild(s, pid) ? C('8f8', ' · you may build here') : '';
    return `${C('ffd34d', `<b>${p.name}</>`)} ${C('8cf', `owned by ${s.ownerName}`)}${sale}${trusted}`;
  }

  async coins(pl) { return +(await pl.getLeaderboard('coins')) || 0; }
  async pay(pl, delta) { const c = await this.coins(pl); pl.setLeaderboard('coins', Math.max(0, c + delta)); }
  async isAdmin(pl) {
    try { if (pl.isHost?.()) return true; const r = await pl.getRoles?.(); return (r ?? []).includes('Admin'); } catch { return false; }
  }

  /** clear everything built on a lot: small boxes first (ClearRegion skips boxes holding ~1,800+
   * bricks and only takes bricks ENTIRELY inside), then halves, then the whole zone */
  clearLot(p) {
    const z = p.zone, zc = (p.surface + z.z1) / 2, hz = (z.z1 - p.surface) / 2;
    for (const n of [4, 2, 1]) {
      const hw = (z.x1 - z.x0) / 2 / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++)
        this.run(`br.World.ClearRegion ${Math.round(z.x0 + hw * (2 * i + 1))} ${Math.round(z.y0 + hw * (2 * j + 1))} ${Math.round(zc)} ${Math.ceil(hw)} ${Math.ceil(hw)} ${Math.ceil(hz)}`);
    }
  }

  async onJoin(player) {
    const pend = await this.store.get('pay:' + player.id);
    if (!pend) return;
    setTimeout(async () => {
      const pl = this.omegga.getPlayer(player.id);
      if (!pl) return;
      await this.store.delete('pay:' + player.id);
      await this.pay(pl, pend.coins);
      this.omegga.whisper(pl, C('8f8', `While you were away your lot sold: +${pend.coins} coins.`));
    }, 30_000); // after the progress plugin restores coins
  }

  async cmd(name, args) {
    const pl = this.omegga.getPlayer(name);
    if (!pl) return;
    const [sub = '', ...rest] = args.join(' ').trim().split(/\s+/);
    const say = (s, hex = '8cf') => this.omegga.whisper(pl, C(hex, s));
    const pos = await pl.getPosition().catch(() => null);
    const here = pos ? this.lotAt(pos) : null;
    const target = async () => {
      const n = +rest[0];
      if (n && BY_ID.has(n)) return BY_ID.get(n);
      return here;
    };

    switch (sub.toLowerCase()) {
      case '':
      case 'info': {
        if (!here) return this.list(pl);
        return say(await this.banner(here, await this.lot(here.id), pl.id), 'fff');
      }
      case 'list': return this.list(pl);
      case 'buy': {
        if (!here) return say('Stand on a lot to buy it, or click its FOR SALE sign. /plot list shows them all.');
        return this.buyLot(pl, here);
      }
      case 'sell': {
        if (!here) return say('Stand on your lot to sell it.');
        const s = await this.lot(here.id);
        if (s.owner !== pl.id) return say('That is not your lot.');
        const ask = Math.floor(+rest[0]);
        if (!(ask > 0)) return say('/plot sell <coins> puts it on the market. /plot abandon gives it back to the town.');
        s.sale = ask; await this.putLot(here.id, s);
        return say(`${here.name} is for sale at ${ask} coins. Your builds go with it. /plot unlist to keep it.`, '8f8');
      }
      case 'unlist': {
        if (!here) return say('Stand on your lot.');
        const s = await this.lot(here.id);
        if (s.owner !== pl.id) return say('That is not your lot.');
        s.sale = null; await this.putLot(here.id, s);
        return say(`${here.name} is off the market.`, '8f8');
      }
      case 'abandon': {
        if (!here) return say('Stand on your lot.');
        const s = await this.lot(here.id);
        if (s.owner !== pl.id) return say('That is not your lot.');
        if (rest[0] !== 'yes') return say(`This clears everything built on ${here.name} and refunds ${Math.floor((await this.price(here)) / 2)} coins. Type /plot abandon yes`, 'f88');
        const refund = Math.floor((await this.price(here)) / 2);
        await this.putLot(here.id, { owner: null, ownerName: null, sale: null, trust: [] });
        this.clearLot(here);
        await this.pay(pl, refund);
        console.log(`[realestate] ${pl.name} abandoned lot ${here.id}`);
        return say(`${here.name} is back on the market. +${refund} coins.`, '8f8');
      }
      case 'trust':
      case 'untrust': {
        if (!here) return say('Stand on your lot.');
        const s = await this.lot(here.id);
        if (s.owner !== pl.id) return say('That is not your lot.');
        const who = this.omegga.getPlayer(rest.join(' '));
        if (!who) return say('No such player online.');
        s.trust = (s.trust ?? []).filter(t => t.id !== who.id);
        if (sub.toLowerCase() === 'trust') s.trust.push({ id: who.id, name: who.name });
        await this.putLot(here.id, s);
        return say(sub.toLowerCase() === 'trust' ? `${who.name} may build on ${here.name}.` : `${who.name} may no longer build on ${here.name}.`, '8f8');
      }
      case 'give':
      case 'reset':
      case 'price': {
        if (!(await this.isAdmin(pl))) return say('Admins only.');
        const p = await target();
        if (!p) return say('Which lot? /plot list');
        if (sub === 'give') {
          const who = this.omegga.getPlayer(rest.slice(1).join(' '));
          if (!who) return say('No such player online.');
          await this.putLot(p.id, { owner: who.id, ownerName: who.name, sale: null, trust: [], since: Date.now(), paid: 0 });
          return say(`${p.name} now belongs to ${who.name}.`, '8f8');
        }
        if (sub === 'reset') {
          await this.putLot(p.id, { owner: null, ownerName: null, sale: null, trust: [] });
          this.clearLot(p);
          return say(`${p.name} cleared and back on the market.`, '8f8');
        }
        const c = Math.floor(+rest[1]);
        if (!(c >= 0)) return say('/plot price <lot> <coins>');
        await this.store.set('price:' + p.id, c);
        return say(`${p.name} now costs ${c} coins.`, '8f8');
      }
      default:
        return say('/plot [list|buy|sell <coins>|unlist|abandon|trust <player>|untrust <player>]');
    }
  }

  /** E on a FOR SALE sign */
  async clickSign(who, id) {
    const p = BY_ID.get(+id), pl = p && who && this.omegga.getPlayer(who.id ?? who.name);
    if (!pl) return;
    const s = await this.lot(p.id);
    const say = s2 => { this.omegga.middlePrint(pl.name, s2); this.omegga.whisper(pl, s2); };
    if (s.owner === pl.id) return say(C('8f8', `<b>${p.name}</> is yours.`) + (s.sale ? C('8cf', ` For sale at ${s.sale} coins (/plot unlist).`) : ''));
    if (s.owner && !s.sale) return say(`${C('ffd34d', `<b>${p.name}</>`)} ${C('8cf', `belongs to ${s.ownerName} and is not for sale.`)}`);
    const cost = s.owner ? s.sale : await this.price(p);
    this.offers.set(pl.id, { lot: p.id, until: Date.now() + CONFIRM_MS });
    say(`${C('ffd34d', `<b>${p.name}</> � ${p.studs}x${p.studs} studs � ${cost} coins`)}${s.owner ? C('8cf', ` from ${s.ownerName}`) : ''} ${C('fff', `Click to buy? Type <b>/confirm</> within ${CONFIRM_MS / 1000} seconds.`)}`);
  }

  async confirm(name) {
    const pl = this.omegga.getPlayer(name);
    if (!pl) return;
    const o = this.offers.get(pl.id);
    this.offers.delete(pl.id);
    if (!o || Date.now() > o.until) return this.omegga.whisper(pl, C('f88', o ? 'Too slow: the offer ran out. Click the sign again.' : 'Nothing to confirm. Click a FOR SALE sign first.'));
    return this.buyLot(pl, BY_ID.get(o.lot));
  }

  async buyLot(pl, here) {
    const say = (s, hex = '8cf') => this.omegga.whisper(pl, C(hex, s));
    const s = await this.lot(here.id);
    if (s.owner === pl.id) return say('You already own this lot.');
    const mine = (await Promise.all(PLOTS.map(async p => (await this.lot(p.id)).owner === pl.id))).filter(Boolean).length;
    if (mine >= (this.config['max-lots'] ?? 2)) return say(`You own ${mine} lots already (limit ${this.config['max-lots'] ?? 2}).`);
    const cost = s.owner ? s.sale : await this.price(here);
    if (s.owner && !s.sale) return say(`${here.name} belongs to ${s.ownerName} and is not for sale.`);
    const have = await this.coins(pl);
    if (have < cost) return say(`${here.name} costs ${cost} coins. You have ${have}.`);
    await this.pay(pl, -cost);
    if (s.owner) {
      const seller = this.omegga.getPlayer(s.owner);
      if (seller) { await this.pay(seller, cost); this.omegga.whisper(seller, C('8f8', `${pl.name} bought ${here.name}: +${cost} coins.`)); }
      else { const pend = (await this.store.get('pay:' + s.owner)) ?? { coins: 0 }; pend.coins += cost; await this.store.set('pay:' + s.owner, pend); }
    }
    const prev = s.ownerName;
    await this.putLot(here.id, { owner: pl.id, ownerName: pl.name, sale: null, trust: [], since: Date.now(), paid: cost });
    console.log(`[realestate] ${pl.name} bought lot ${here.id} for ${cost}${prev ? ` from ${prev}` : ''}`);
    return say(`${here.name} is yours for ${cost} coins. Stand on it and open build mode.${prev ? ` (${prev}'s builds came with it.)` : ''}`, '8f8');
  }

  async list(pl) {
    for (const p of PLOTS) {
      const s = await this.lot(p.id);
      const st = !s.owner ? C('ffd34d', `for sale ${await this.price(p)} coins`) : s.sale ? C('ffd34d', `${s.ownerName}, selling for ${s.sale}`) : C('8cf', s.ownerName);
      this.omegga.whisper(pl, `${C('fff', `<b>${p.name}</>`)} ${C('8cf', `${p.studs}x${p.studs} at ${Math.round(p.x)}, ${Math.round(p.y)} ·`)} ${st}`);
    }
  }
};
