// joinloc: "<name> has joined from <city, country>: <ping>ms (<comment>)" when someone connects.
// The address comes from Server.Status (omegga.getServerStatus), the place from a local DB-IP IPv4 table
// (omegga-joinloc/mkgeo.mjs builds geo.json + geo.bin); IPs are never sent anywhere and never printed.
// Unsafe (plain node) plugin, like duel and tpa.
const fs = require('fs');
const path = require('path');

const clean = s => String(s).replace(/[<>"\;]/g, '');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const COMMENTS = [[10, 'WOW!!'], [30, 'WOW'], [60, 'nice'], [100, 'fine'], [150, 'meh'], [250, 'UH OH'], [Infinity, 'OH NO']];
const comment = ms => COMMENTS.find(([max]) => ms <= max)[1];
const ip4 = s => s.split('.').reduce((a, b) => a * 256 + +b, 0);
const privateIp = ip => /^(10\.|127\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);

module.exports = class JoinLoc {
  constructor(omegga, config) {
    this.omegga = omegga;
    this.config = config;
    this.geo = null;
  }

  load() {
    const dir = this.config?.geoDir ?? '/home/max/geo';
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(dir, 'geo.json'), 'utf8'));
      const buf = fs.readFileSync(path.join(dir, 'geo.bin'));
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
      const n = meta.n;
      this.geo = { n, locs: meta.locs, starts: new Uint32Array(ab, 0, n), ends: new Uint32Array(ab, n * 4, n), idx: new Uint32Array(ab, n * 8, n) };
    } catch (e) { console.error('[joinloc] no geo table:', e.message); }
  }

  place(address) {
    const ip = String(address).replace(/:\d+$/, '');
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return 'somewhere unknown';
    if (privateIp(ip)) return 'the local network';
    const g = this.geo;
    if (!g) return 'somewhere unknown';
    const v = ip4(ip);
    let lo = 0, hi = g.n - 1, best = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (g.starts[mid] <= v) { best = mid; lo = mid + 1; } else hi = mid - 1; }
    return best >= 0 && v <= g.ends[best] ? g.locs[g.idx[best]] : 'somewhere unknown';
  }

  async init() {
    this.load();
    this.onJoin = async player => {
      try {
        await sleep(this.config?.delayMs ?? 3000);          // the status table lists a player a moment after they connect
        const st = await this.omegga.getServerStatus();
        const p = st.players.find(x => x.id === player.id) ?? st.players.find(x => x.name === player.name);
        const ms = Math.max(0, Math.round(p?.ping ?? 0));
        const where = p ? this.place(p.address) : 'somewhere unknown';
        this.omegga.broadcast(`<color="ffd040"><b>${clean(player.name)}</> has joined from ${clean(where)}: ${ms}ms (${comment(ms)})</>`);
      } catch (e) { console.error('[joinloc]', e.message); }
    };
    this.omegga.on('join', this.onJoin);
    return { registeredCommands: [] };
  }

  async stop() { this.omegga.removeListener('join', this.onJoin); this.geo = null; }
};
