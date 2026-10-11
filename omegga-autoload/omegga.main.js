// autoload: Omegga's daily auto-restart (2026-10-11 02:00) saved the world
// and came back with NO world loaded: an empty Plate until someone loaded it
// by hand. This plugin loads `world` again when the server says it started
// without one ("No pending world bundle found"), or when an autosave fails
// because nothing is loaded ("World has not been saved"; 10 min cooldown).
// It also sets CVARS on init and after each world load: the dedicated server's
// melee hit validation rejected nearly every melee hit (attacker "units from
// hit", victim "desync" with no pose history: bots), which a client-hosted
// world never does (owner 2026-10-11: melee only broken on the server).
// Unsafe (plain node) plugin, like progress.

const sleep = ms => new Promise(r => setTimeout(r, ms));
const COOLDOWN = 10 * 60 * 1000;
const CVARS = ['br.Weapons.EnableHitValidation 0'];

module.exports = class Autoload {
  constructor(omegga, config, store) {
    this.omegga = omegga;
    this.config = config;
    this.last = 0;
  }

  async init() {
    // unsafe plugins share Omegga's emitter: drop our handler from an earlier load
    if (this.omegga.__autoloadLine) this.omegga.off('line', this.omegga.__autoloadLine);
    this.omegga.__autoloadLine = line => {
      if (line.includes('World successfully loaded') || line.includes('No pending world bundle found'))
        setTimeout(() => this.cvars(), 3000);
      if (line.includes('No pending world bundle found') || line.includes('World has not been saved'))
        this.load(line).catch(err => console.error('[autoload]', err));
    };
    this.omegga.on('line', this.omegga.__autoloadLine);
    this.cvars();
    return { registeredCommands: [] };
  }

  async load(why) {
    if (Date.now() - this.last < COOLDOWN) return;
    this.last = Date.now();
    const world = String(this.config.world || '').replace(/"/g, '');
    if (!world) return;
    await sleep((this.config.delay ?? 10) * 1000);
    console.log(`[autoload] no world loaded (${why.slice(-80).trim()}), loading "${world}"`);
    this.omegga.writeln(`br.World.Load "${world}"`);
  }

  cvars() {
    for (const c of CVARS) this.omegga.writeln(c);
  }

  async stop() {
    if (this.omegga.__autoloadLine) this.omegga.off('line', this.omegga.__autoloadLine);
    this.omegga.__autoloadLine = null;
  }
};
