// pots: smashable pots (owner 2026-10-06: "make a pot you can smash").
//
// A pot is the `pot` prefab (bridge/tools/potgen.mjs): a terracotta B_Jar with
// an interact prompt "Smash" whose ConsoleTag is "event:pot". When a player
// interacts, Omegga logs it with the brick's position; this plugin then
//   - clears the jar (a ClearRegion just round it),
//   - drops the broken bits (`pot_shards` prefab) and sometimes a coin
//     (coin1 / coin10 / coin25 prefabs, which pay into the "coins" leaderboard),
//   - clears the bits after `shardSeconds` (exact boxes, nothing else is touched),
//   - puts the pot back after `respawnSeconds`.
// Broken pots waiting to come back are kept in the store, so a reload or a
// restart still brings them back. Pots are placed by mapgen (pots.json) or by
// hand: br.Prefab.Load "pot" x y <ground + 12> 0 16.

const POT_HALF = [9, 9, 12]; // B_Jar
// the shard bricks of pot_shards, relative to its centre: x, y, half x, half y, half z (potgen.mjs SHARDS)
const SHARDS = [[16, 2, 4, 4, 2], [-14, 8, 4, 2, 2], [4, -16, 2, 4, 2], [-8, -14, 4, 4, 2], [12, 16, 2, 2, 2], [-18, -4, 2, 4, 2]];

module.exports = class Pots {
  constructor(omegga, config, store) {
    this.omegga = omegga;
    this.config = config;
    this.store = store;
    this.broken = new Map(); // "x,y,z" -> respawn time (ms)
    this.timers = [];
  }

  async init() {
    // unsafe plugins share Omegga's emitter: drop handlers from earlier loads
    this.omegga.removeAllListeners('interact');
    this.omegga.on('interact', i => this.onInteract(i).catch(err => console.error('[pots]', err)));
    // !pot: the host drops a pot at their feet (for placing pots by hand)
    for (const e of ['chatcmd:pot', 'cmd:pot']) {
      this.omegga.removeAllListeners(e);
      this.omegga.on(e, name => this.place(name).catch(err => console.error('[pots]', err)));
    }
    // pots broken before a reload come back on time
    const saved = (await this.store.get('broken')) ?? [];
    for (const [key, at] of saved) this.schedule(key, Math.max(1000, at - Date.now()));
    return { registeredCommands: [] };
  }

  async stop() {
    for (const t of this.timers) clearTimeout(t);
    await this.save();
  }

  async save() {
    await this.store.set('broken', [...this.broken.entries()]);
  }

  cmd(line) {
    this.omegga.writeln(line);
  }

  async place(name) {
    const p = this.omegga.getPlayer(name);
    if (!p || !(p.isHost?.() || (this.config['placers'] ?? '').split(',').map(v => v.trim().toLowerCase()).includes(name.toLowerCase()))) return;
    const pos = await p.getPosition();
    if (!pos) return;
    // the player's position is the middle of the body: feet about FEET below it
    const [x, y] = pos.map(v => Math.round(v / 10) * 10), feet = Math.round(pos[2]) - (this.config['feetOffset'] ?? 36);
    this.cmd(`br.Prefab.Load "pot" ${x} ${y} ${feet + POT_HALF[2]} 0 16`);
    this.omegga.whisper(name, `<color="9cf">pot at ${x} ${y} ${feet + POT_HALF[2]}: walk off it, look at it, press the interact key to smash it</>`);
  }

  async onInteract(i) {
    if (!/^event:pot\b/.test(i.message ?? '')) return;
    const [x, y, z] = i.position, key = `${x},${y},${z}`;
    if (this.broken.has(key)) return;
    const ground = z - POT_HALF[2];
    // smash: the jar goes, the bits land round where it stood
    this.cmd(`br.World.ClearRegion ${x} ${y} ${z} ${POT_HALF[0] + 1} ${POT_HALF[1] + 1} ${POT_HALF[2] + 1}`);
    this.cmd(`br.Prefab.Load "pot_shards" ${x} ${y} ${ground + 2} 0 16`);
    // loot: mostly a copper coin, now and then silver or gold, sometimes nothing
    const r = Math.random(), c = this.config;
    const coin = r < c['chanceGold'] / 100 ? 'coin25' : r < (c['chanceGold'] + c['chanceSilver']) / 100 ? 'coin10' : r < (c['chanceGold'] + c['chanceSilver'] + c['chanceCopper']) / 100 ? 'coin1' : null;
    if (coin) this.cmd(`br.Prefab.Load "${coin}" ${x} ${y} ${z + 6} 0 16`);
    console.log(`[pots] ${i.player.name} smashed the pot at ${key}${coin ? `: ${coin}` : ''}`);
    // the bits go after a while, the pot comes back later
    this.timers.push(setTimeout(() => this.clearShards(x, y, ground), (c['shardSeconds'] ?? 8) * 1000));
    this.schedule(key, (c['respawnSeconds'] ?? 90) * 1000);
  }

  clearShards(x, y, ground) {
    for (const [sx, sy, hx, hy, hz] of SHARDS) this.cmd(`br.World.ClearRegion ${x + sx} ${y + sy} ${ground + hz} ${hx + 1} ${hy + 1} ${hz + 1}`);
  }

  schedule(key, ms) {
    this.broken.set(key, Date.now() + ms);
    this.save().catch(() => {});
    this.timers.push(setTimeout(() => {
      const [x, y, z] = key.split(',').map(Number);
      this.clearShards(x, y, z - POT_HALF[2]); // in case the bits outlived a reload
      this.cmd(`br.Prefab.Load "pot" ${x} ${y} ${z} 0 16`);
      this.broken.delete(key);
      this.save().catch(() => {});
    }, ms));
  }
};
