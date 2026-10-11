// Levels: turns the "XP" leaderboard value into levels.
//
// XP itself is given in-game: the skeleton_drop Wirescript chip spawns a blue
// XP orb on whoever kills a skeleton, and the orb adds to the killer's "XP"
// leaderboard value. This plugin polls every online player's XP, works out
// their level, keeps a "Level" leaderboard value in step, announces level-ups,
// and saves XP in the plugin store so it survives restarts (if the game's
// leaderboard comes back lower than what we saved, it is set back).
//
//   level = floor(sqrt(XP / XP_SCALE)) + 1   (25: L2 at 25 XP, L5 at 400, L10 at 2025)
//
// Commands: !level (yours), !levels (top 5).

const XP_KEY = 'XP';
const LEVEL_KEY = 'Level';

module.exports = class Plugin {
  constructor(omegga, config, store) {
    this.omegga = omegga;
    this.config = config;
    this.store = store;
    this.waiting = new Map(); // player id -> resolve(xp)
  }

  scale() { return this.config['xp-scale'] ?? 25; }
  levelOf(xp) { return Math.floor(Math.sqrt(Math.max(0, xp) / this.scale())) + 1; }
  xpFor(level) { return this.scale() * (level - 1) ** 2; }

  async init() {
    // "<uuid> leaderboard value XP = 40"
    this.onLine = line => {
      const m = /([0-9a-f-]{36}) leaderboard value (\w+) = (-?\d+)/.exec(line);
      if (!m || m[2] !== XP_KEY) return;
      const r = this.waiting.get(m[1]);
      if (r) { this.waiting.delete(m[1]); r(Number(m[3])); }
    };
    this.omegga.on('line', this.onLine);
    this.cmdLevel = name => this.levelCommand(name).catch(e => console.error('[levels]', e));
    this.cmdTop = name => this.topCommand(name).catch(e => console.error('[levels]', e));
    for (const e of ['chatcmd:level', 'cmd:level']) { this.omegga.removeAllListeners(e); this.omegga.on(e, this.cmdLevel); }
    for (const e of ['chatcmd:levels', 'cmd:levels']) { this.omegga.removeAllListeners(e); this.omegga.on(e, this.cmdTop); }
    this.timer = setInterval(() => this.poll().catch(e => console.error('[levels] poll', e)), (this.config['poll-seconds'] ?? 4) * 1000);
    return { registeredCommands: ['level', 'levels'] };
  }

  async stop() {
    clearInterval(this.timer);
    this.omegga.off('line', this.onLine);
    for (const e of ['chatcmd:level', 'cmd:level']) this.omegga.off(e, this.cmdLevel);
    for (const e of ['chatcmd:levels', 'cmd:levels']) this.omegga.off(e, this.cmdTop);
  }

  /** The player's XP from the leaderboard (null if the game didn't answer). */
  readXp(p) {
    return new Promise(resolve => {
      const t = setTimeout(() => { this.waiting.delete(p.id); resolve(null); }, 2000);
      this.waiting.set(p.id, xp => { clearTimeout(t); resolve(xp); });
      this.omegga.writeln(`br.Server.Players.PrintLeaderboardValue "${p.name}" ${XP_KEY}`);
    });
  }

  set(p, key, value) {
    this.omegga.writeln(`br.Server.Players.SetLeaderboardValue "${p.name}" ${key} ${Math.round(value)}`);
  }

  async poll() {
    if (this.polling) return;
    this.polling = true;
    try {
      for (const p of this.omegga.getPlayers()) {
        const key = `p:${p.id}`;
        const saved = (await this.store.get(key)) ?? { xp: 0, level: 1, name: p.name };
        let xp = await this.readXp(p);
        if (xp === null) xp = 0; // no XP value yet
        if (xp < saved.xp) {
          // leaderboard was reset (restart): put the saved XP back
          this.set(p, XP_KEY, saved.xp);
          xp = saved.xp;
        }
        const level = this.levelOf(xp);
        if (level !== saved.level || !saved.synced) this.set(p, LEVEL_KEY, level);
        if (level > saved.level) this.levelUp(p, level);
        if (xp !== saved.xp || level !== saved.level || !saved.synced || saved.name !== p.name)
          await this.store.set(key, { xp, level, name: p.name, synced: true });
      }
    } finally {
      this.polling = false;
    }
  }

  levelUp(p, level) {
    const name = String(p.name).replace(/[<>"\\]/g, '');
    this.omegga.writeln(`br.Chat.Broadcast <size="32"><color="46aaff"><b>${name} reached level ${level}!</></></>`);
    this.omegga.writeln(`br.Chat.Whisper "${p.name}" <color="46aaff">Level ${level}. Next level at ${this.xpFor(level + 1)} XP.</>`);
    console.log(`[levels] ${p.name} -> level ${level}`);
  }

  async levelCommand(name) {
    const p = this.omegga.getPlayer(name);
    if (!p) return;
    const s = (await this.store.get(`p:${p.id}`)) ?? { xp: 0, level: 1 };
    const next = this.xpFor(s.level + 1);
    this.omegga.writeln(`br.Chat.Whisper "${p.name}" <color="46aaff"><b>Level ${s.level}</></> - ${s.xp} XP, ${next - s.xp} more for level ${s.level + 1}. Kill skeletons for XP (tougher ones give more).`);
  }

  async topCommand(name) {
    const keys = (await this.store.keys()).filter(k => k.startsWith('p:'));
    const all = [];
    for (const k of keys) all.push(await this.store.get(k));
    all.sort((a, b) => b.xp - a.xp);
    const p = this.omegga.getPlayer(name);
    if (!p) return;
    this.omegga.writeln(`br.Chat.Whisper "${p.name}" <color="46aaff"><b>Top levels</></>`);
    all.slice(0, 5).forEach((s, i) => this.omegga.writeln(`br.Chat.Whisper "${p.name}" ${i + 1}. ${String(s.name).replace(/[<>"\\]/g, '')} - level ${s.level} (${s.xp} XP)`));
  }
};
