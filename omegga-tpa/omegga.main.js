// tpa: teleport requests, Minecraft style.
//
//   !tpa <player>      ask to teleport to them
//   !tpahere <player>  ask them to teleport to you
//   !tpaccept [player] accept the newest request to you (or that player's)
//   !tpdeny [player]   turn it down
//   !tpcancel          withdraw your own request
//
// Requests expire after `timeout` seconds. The move is done with the game's
// own /TP command (br.Chat.Command /TP "name" x y z 0), to where the other
// player is standing at the moment of acceptance. Unsafe (plain node) plugin,
// like the bridge, chatbot and media plugins.

const sleep = ms => new Promise(r => setTimeout(r, ms));
const clean = s => String(s).replace(/[<>"\\;]/g, '');

module.exports = class Tpa {
  constructor(omegga, config) {
    this.omegga = omegga;
    this.config = config;
    this.requests = []; // { from, to, here, at }
    this.lastUse = new Map(); // name -> ms
  }

  async init() {
    const on = (events, fn) => {
      const handler = (name, ...args) =>
        fn.call(this, name, args.join(' ').trim()).catch(err => {
          console.error('[tpa]', err);
          this.whisper(name, `<color="f55">${clean(String(err.message ?? err).slice(0, 160))}</>`);
        });
      // unsafe plugins share Omegga's emitter: drop handlers from earlier loads
      for (const e of events) {
        this.omegga.removeAllListeners(e);
        this.omegga.on(e, handler);
      }
    };
    on(['cmd:tpa', 'chatcmd:tpa'], (n, a) => this.ask(n, a, false));
    on(['cmd:tpahere', 'chatcmd:tpahere'], (n, a) => this.ask(n, a, true));
    on(['cmd:tpaccept', 'chatcmd:tpaccept', 'cmd:tpyes', 'chatcmd:tpyes'], this.accept);
    on(['cmd:tpdeny', 'chatcmd:tpdeny', 'cmd:tpno', 'chatcmd:tpno'], this.deny);
    on(['cmd:tpcancel', 'chatcmd:tpcancel'], this.cancel);
    return { registeredCommands: ['tpa', 'tpahere', 'tpaccept', 'tpyes', 'tpdeny', 'tpno', 'tpcancel'] };
  }

  async stop() {
    this.requests = [];
  }

  whisper(name, msg) {
    this.omegga.writeln(`br.Chat.Whisper "${clean(name)}" ${msg}`);
  }

  get timeoutMs() {
    return (this.config?.timeout ?? 60) * 1000;
  }

  prune() {
    const now = Date.now();
    this.requests = this.requests.filter(r => now - r.at < this.timeoutMs);
  }

  /** an online player by exact, prefix or substring name (case-insensitive) */
  find(query, self) {
    const q = query.trim().toLowerCase();
    if (!q) throw new Error('say who: !tpa <player>');
    const names = this.omegga.getPlayers().map(p => p.name).filter(n => n !== self);
    const hit = names.find(n => n.toLowerCase() === q) ??
      names.filter(n => n.toLowerCase().startsWith(q)).sort((a, b) => a.length - b.length)[0] ??
      names.filter(n => n.toLowerCase().includes(q)).sort((a, b) => a.length - b.length)[0];
    if (!hit) throw new Error(`no player online matching "${clean(query)}"`);
    return hit;
  }

  async ask(name, args, here) {
    this.prune();
    const cd = (this.config?.cooldown ?? 5) * 1000, last = this.lastUse.get(name) ?? 0;
    if (Date.now() - last < cd) throw new Error(`wait ${Math.ceil((cd - (Date.now() - last)) / 1000)}s before asking again`);
    const to = this.find(args, name);
    this.lastUse.set(name, Date.now());
    // one open request per sender
    this.requests = this.requests.filter(r => r.from !== name);
    this.requests.push({ from: name, to, here, at: Date.now() });
    const secs = Math.round(this.timeoutMs / 1000);
    this.whisper(name, `<color="8cf">Asked <b>${clean(to)}</> ${here ? 'to come to you' : 'if you can teleport to them'}. Expires in ${secs}s. !tpcancel to withdraw.</>`);
    this.whisper(to, `<color="8cf"><b>${clean(name)}</> ${here ? 'wants you to teleport to them' : 'wants to teleport to you'}. <b>!tpaccept</> or <b>!tpdeny</> (${secs}s).</>`);
  }

  pick(name, args) {
    this.prune();
    let mine = this.requests.filter(r => r.to === name);
    if (args.trim()) {
      const q = args.trim().toLowerCase();
      mine = mine.filter(r => r.from.toLowerCase().includes(q));
    }
    if (!mine.length) throw new Error('no teleport request waiting for you');
    return mine.sort((a, b) => b.at - a.at)[0];
  }

  async position(name) {
    // a dead or respawning player can read as (0,0,0): retry a little
    for (let i = 0; i < 4; i++) {
      const p = this.omegga.getPlayer(name);
      const pos = await Promise.race([Promise.resolve(p?.getPosition()).catch(() => null), sleep(3000).then(() => null)]);
      if (pos && pos.some(v => Math.abs(v) > 60)) return pos;
      await sleep(750);
    }
    return null;
  }

  async accept(name, args) {
    const r = this.pick(name, args);
    this.requests = this.requests.filter(x => x !== r);
    const [mover, target] = r.here ? [r.to, r.from] : [r.from, r.to];
    if (!this.omegga.getPlayer(mover) || !this.omegga.getPlayer(target)) throw new Error('they left the server');
    const pos = await this.position(target);
    if (!pos) throw new Error(`couldn't find where ${clean(target)} is (dead?)`);
    const [x, y, z] = pos.map(v => Math.round(v));
    this.omegga.writeln(`br.Chat.Command /TP "${clean(mover)}" ${x} ${y} ${z + 10} 0`);
    this.whisper(mover, `<color="8cf">Teleported to <b>${clean(target)}</>.</>`);
    this.whisper(target, `<color="8cf"><b>${clean(mover)}</> teleported to you.</>`);
  }

  async deny(name, args) {
    const r = this.pick(name, args);
    this.requests = this.requests.filter(x => x !== r);
    this.whisper(name, `<color="8cf">Turned down <b>${clean(r.from)}</>.</>`);
    this.whisper(r.from, `<color="f88"><b>${clean(name)}</> turned down your teleport request.</>`);
  }

  async cancel(name) {
    this.prune();
    const r = this.requests.find(x => x.from === name);
    if (!r) throw new Error('you have no open request');
    this.requests = this.requests.filter(x => x !== r);
    this.whisper(name, '<color="8cf">Request withdrawn.</>');
    this.whisper(r.to, `<color="8cf"><b>${clean(name)}</> withdrew their teleport request.</>`);
  }
};
