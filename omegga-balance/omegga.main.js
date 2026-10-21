// balance: /reload runs bridge/balance/balance.mjs apply, which makes the game match balance.json
// (enemy health/damage/speed/weapon, shop weapon damage/speed/type) and re-places what changed.
// Progress lines ('# ...') are whispered to whoever typed it. Unsafe (plain node) plugin.
const { spawn } = require('child_process');
const path = require('path');
const DIR = path.join(process.env.HOME, 'omegga-server/bridge/balance');

module.exports = class Balance {
  constructor(omegga, config) { this.omegga = omegga; this.config = config; this.busy = null; }

  async init() {
    this.omegga.on('cmd:reload', (name, ...args) => this.reload(name, args).catch(e => this.tell(name, 'reload failed: ' + e.message)));
    this.omegga.on('cmd:fix', (name, ...args) => this.fix(name, args).catch(e => this.tell(name, 'fix failed: ' + e.message)));
    return { registeredCommands: ['reload', 'fix'] };
  }

  tell(name, msg) {
    const safe = String(msg).replace(/[<>"\\]/g, '').slice(0, 300);
    try { this.omegga.whisper(name, `<color="ffcc66">[balance]</> ${safe}`); } catch { }
    console.log('[balance]', name, msg);
  }

  allowed(name) {
    const p = this.omegga.getPlayer(name);
    if (p?.isHost?.()) return true;
    const list = (this.config.allowed ?? []).map(s => String(s).toLowerCase());
    return list.includes(String(name).toLowerCase());
  }

  async reload(name, args) {
    const dry = args[0] === 'dry';
    await this.run(name, 'balance.mjs', ['apply', ...(dry ? ['dry'] : [])], dry ? 'checking balance.json...' : 'applying balance.json (takes a minute or two)...');
  }

  // /fix [npcs|shops] [dry]: fix.mjs reloads the quest NPC bodies + talk rods, re-places shopkeepers and every shop stand
  async fix(name, args) {
    const a = args.map(s => String(s).toLowerCase());
    const mode = a.find(s => ['npcs', 'npc', 'shops', 'shop'].includes(s)) ?? 'all', dry = a.includes('dry');
    await this.run(name, 'fix.mjs', [mode, ...(dry ? ['dry'] : [])], dry ? 'checking what /fix would do...' : `fixing ${mode === 'all' ? 'npcs and shops' : mode} (a minute or two)...`);
  }

  async run(name, script, argv, hello) {
    if (!this.allowed(name)) return this.tell(name, 'not allowed');
    if (this.busy) return this.tell(name, `already running (started by ${this.busy})`);
    this.busy = name;
    this.tell(name, hello);
    const child = spawn(process.execPath, [path.join(DIR, script), ...argv], { cwd: DIR });
    let buf = '';
    const onData = d => {
      buf += d; let i;
      while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (l.startsWith('# ')) this.tell(name, l.slice(2)); else if (l.trim()) console.log('[balance]', l); }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', d => console.error('[balance]', String(d).trim()));
    await new Promise(res => child.on('close', code => { if (code) this.tell(name, `stopped with an error (code ${code}), see the server log`); res(); }));
    this.busy = null;
  }

  async stop() { }
};
