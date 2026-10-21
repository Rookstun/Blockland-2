// WEAPON BANK (2026-10-21, owner: "when a player unlocks a weapon from a shop it should be here for
// them for free ... only things you buy show up here and you can only have 1 copy of a weapon at a time").
// The bank at spawn (weaponbank/gen.mjs: the owner's counter, 3 buttons, plate, 5 display plates)
// prints "[bank] prev|take|next|enter|<uid>|<name>" when pressed / stepped on.
//  - unlocks: every weapon the skeleton_drop chip names in a player's slots ("[inv]" lines: it names
//    an item from a coin drop of its shop price, a slot move, or a restore) is theirs for good
//    (store bank:<uid> = catalog ids). The Derringer is free (no coin drop = never named): holding
//    one unlocks it.
//  - display: the 5 plates show the user's weapons, the selected one in the middle
//    (one ClearRegion over the plates, then Prefab.Load bankd_<id> per plate).
//  - take: refused while they hold that weapon (by name) or got it in the last TAKE_LOCK s; else
//    catalog id -> leaderboard InvName0 + InvPend 1 and GiveItem the plain class: the chip's
//    5 s inventory check names it and swaps in the shop's item (damage, speed, colours).
const CAT = require('./itemcatalog.json');
const BANK = require('./bank.json');
const TAKE_LOCK = 15, PEND_CLEAR = 15;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clean = s => String(s).replace(/[<>"\\;]/g, '');
const RANK = ['Weapon_Knife', 'Weapon_ArmingSword', 'Weapon_Sabre', 'Weapon_Spatha', 'Weapon_Longsword', 'Weapon_Zweihander', 'Weapon_Bow'];
const WEAPON = new Map(); // catalog name -> id (weapons only: no sodas)
CAT.forEach((e, i) => { if (!/^soda_/.test(e.prefab)) WEAPON.set(e.name, i + 1); });
const rank = id => { const e = CAT[id - 1], r = RANK.indexOf(e.item); return [r < 0 ? RANK.length : r, e.price]; };
const byOrder = (a, b) => { const [ra, pa] = rank(a), [rb, pb] = rank(b); return ra - rb || pa - pb || a - b; };
const FREE = CAT.map((e, i) => [e, i + 1]).filter(([e]) => e.item === 'Weapon_Derringer'); // free stand: never named
const [X0, Y0, Z0] = BANK.slots[2];
const CLEAR = `br.World.ClearRegion ${X0} ${Y0} ${Z0} ${Math.abs(BANK.slots[4][0] - BANK.slots[0][0]) / 2 + 11} 11 4`;

class Bank {
  constructor(plugin) {
    this.p = plugin;
    this.omegga = plugin.omegga;
    this.store = plugin.store;
    this.sel = new Map(); // uid -> selected index
    this.gave = new Map(); // "uid:id" -> ms
    this.want = null; // latest display request
    this.drawing = false;
    this.quiet = true; // no whispers while catching up on old lines
  }

  async init() {
    // everything already named in saved inventories counts as bought
    try {
      for (const k of await this.store.keys()) if (k.startsWith('inv:')) {
        const inv = await this.store.get(k);
        if (inv) await this.onInv(k.slice(4), inv.slots ?? [], inv.names ?? []);
      }
    } catch (e) { console.error('[bank] seed', e.message); }
  }

  async list(uid) { return ((await this.store.get('bank:' + uid)) ?? []).slice().sort(byOrder); }

  async onInv(uid, slots, names) {
    const ids = new Set(names.map(n => n && WEAPON.get(n)).filter(Boolean));
    for (const [e, id] of FREE) if (slots.includes(e.item)) ids.add(id);
    if (!ids.size) return;
    const have = (await this.store.get('bank:' + uid)) ?? [];
    const fresh = [...ids].filter(id => !have.includes(id));
    if (!fresh.length) return;
    await this.store.set('bank:' + uid, have.concat(fresh));
    const pl = this.omegga.getPlayer(uid);
    if (!this.quiet && pl) this.omegga.whisper(pl.name, `<color="ffd34d">${fresh.map(id => clean(CAT[id - 1].name)).join(', ')} ${fresh.length > 1 ? 'are' : 'is'} now in your weapon bank at spawn: free whenever you need ${fresh.length > 1 ? 'them' : 'it'}.</>`);
    console.log(`[bank] ${pl?.name ?? uid} unlocked ${fresh.map(id => CAT[id - 1].name).join(', ')}`);
  }

  say(name, msg) {
    try { this.omegga.middlePrint(name, msg); } catch { this.omegga.whisper(name, msg); }
  }

  async onLine(line) {
    const m = /\[bank\] (prev|take|next|enter)\|([0-9a-f-]{36})\|(.*?)\s*$/.exec(line);
    if (!m || line.includes('WRITE')) return;
    const [, act, uid, name] = m;
    const list = await this.list(uid);
    if (!list.length) {
      this.draw([]);
      return this.say(name, '<color="ffd34d">Weapon bank</>: empty. Weapons you buy at the shops show up here, free to take again.');
    }
    let sel = Math.min(this.sel.get(uid) ?? 0, list.length - 1);
    if (act === 'prev') sel = (sel - 1 + list.length) % list.length;
    if (act === 'next') sel = (sel + 1) % list.length;
    this.sel.set(uid, sel);
    this.draw([0, 1, 2, 3, 4].map(k => list[sel - 2 + k] ?? 0));
    const id = list[sel], e = CAT[id - 1];
    if (act !== 'take') return this.say(name, `<color="ffd34d">${clean(e.name)}</> (${sel + 1}/${list.length}) · middle button: take it`);
    await this.take(uid, name, id, e);
  }

  async take(uid, name, id, e) {
    const pl = this.omegga.getPlayer(uid);
    if (!pl) return;
    const inv = await this.store.get('inv:' + uid);
    const at = this.gave.get(uid + ':' + id) ?? 0;
    if ((inv?.names ?? []).includes(e.name) || Date.now() - at < TAKE_LOCK * 1000)
      return this.say(name, `<color="ff8888">You already have a ${clean(e.name)}.</> One at a time.`);
    this.gave.set(uid + ':' + id, Date.now());
    // the chip names the plain item it finds in a slot after this (see progress onJoin)
    pl.setLeaderboard('InvName0', id);
    for (let j = 1; j < 10; j++) pl.setLeaderboard('InvName' + j, 0);
    pl.setLeaderboard('InvPend', 1);
    pl.giveItem(e.item);
    this.say(name, `<color="88ff88">${clean(e.name)}</> taken from your bank.`);
    console.log(`[bank] ${name} took ${e.name}`);
    // not claimed (full inventory?): drop the pending name so a later pickup isn't renamed
    setTimeout(async () => {
      try {
        const p = this.omegga.getPlayer(uid);
        if (p && +(await p.getLeaderboard('InvPend')) > 0 && +(await p.getLeaderboard('InvName0')) === id) {
          p.setLeaderboard('InvName0', 0); p.setLeaderboard('InvPend', 0);
        }
      } catch {}
    }, PEND_CLEAR * 1000);
  }

  /** show 5 catalog ids (0 = empty plate); only the latest request is drawn */
  draw(ids) {
    this.want = ids;
    if (this.drawing) return;
    this.drawing = true;
    (async () => {
      try {
        while (this.want) {
          const ids = this.want; this.want = null;
          if (this.shown && this.shown.join() === ids.join()) continue;
          this.omegga.writeln(CLEAR);
          await sleep(250);
          for (let k = 0; k < 5; k++) if (ids[k]) {
            const [x, y, z] = BANK.slots[k];
            this.omegga.writeln(`br.Prefab.Load "bankd_${ids[k]}" ${x} ${y} ${z} 0 16`);
            await sleep(120);
          }
          this.shown = ids;
        }
      } catch (e) { console.error('[bank] draw', e); }
      this.drawing = false;
    })();
  }
}
module.exports = Bank;
