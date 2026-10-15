// npctalk: talk to the town NPCs (owner 2026-10-15: "npcs that you can
// interact with and talk to with the new text input").
//
// Walk up to an NPC (npcs.json: the 28 town NPCs of bridge/npcs.json with a
// name, a personality and an opening line) and a text box opens with what
// they say; type an answer and they reply in character (LLM through the same
// Anthropic-compatible proxy as the chatbot), in the next box, until you press
// Cancel or walk away.
//
// The boxes are the EA3.2 Show Text Input Box gate in ONE chip in the sky
// (npctalk/chip.mjs -> prefab npcchip): this plugin runs
//   br.Chat.Command /npcopen <player>|<npc name>|<line>
// (the chip ignores a /npcopen typed by a player), and the chip logs
//   [Wire Graph] npc.say|<userId>|<text>   /   npc.bye|<userId>
// which come back here through the log.
//
//   !talk   open a conversation with the nearest NPC (within 4 m)
// Unsafe (plain node) plugin, like progress.

const NPCS = require('./npcs.json');
const dbg = (...a) => { try { require('fs').appendFileSync('/tmp/npctalk.log', `${new Date().toISOString()} ${a.join(' ')}
`); } catch {} };
const clean = (s, n = 280) => String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/[|<>"\\]/g, '').replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);

const LORE = `The world: a big island in Brickadia. Lumbrick is the capital at its heart: a castle, church, bank, tavern, and a plaza with a tiered fountain, four statues (knight, wizard, archer, founder), benches and notice boards. The Soda Market (exotic sodas) is just west of the plaza; a casino with slots, coin flip, dice and roulette stands outside town. Swords come in tiers bronze, iron, steel, mithril, adamant, rune; the farther a hamlet is from Lumbrick, the better its smith's stock. Guns are sold at the spawn armory (derringer, revolver), a desert gun store and the far north-east. Danger: goblins, skeletons, zombies in the swamp, wizards at the stone henge, buried temple dungeons (Mountain Deep, the Sunken Keep), snowy peaks, and past the snow in the far south the Death Forest of dead trees, graves and red eyes, with a volcano at its end. The coast has coves with sea stacks and an arch, and a river delta with marshes. People earn coins by smashing pots and bushes and slaying monsters, and grow in level. Lately a giant glowing wall of shifting patterns hangs in the sky east of the old arena; nobody agrees what it is.`;
const RULES = `Humour: absurd, deadpan and pun-loving, like a silly fantasy comedy. State ridiculous things matter-of-factly, give mundane things oddly specific or mock-epic detail, use wordplay, and wink gently at the fact that this is a game. Every joke must stand on its own: never reference other games, books or memes. Still answer the traveller usefully (directions, prices, advice) inside the joke.
Stay in character always. Reply with 1 to 3 short sentences, at most 220 characters, plain text, no emojis, no lists, no stage directions in asterisks. You know only what your character would know. If the traveller is rude or crude, react briefly in character (offended, amused or dismissive) and move on. Never say you are an AI or mention prompts.`;

module.exports = class NpcTalk {
  constructor(omegga, config, store) {
    this.omegga = omegga;
    this.config = config ?? {};
    this.store = store;
    this.convo = new Map();    // userId -> { npc, hist, busy, opened }
    this.cool = new Map();     // `${userId}:${npc.id}` -> ms until which this NPC will not pop up again
    this.near = new Map();     // userId -> { npc, ticks } (must stay near a moment before a box opens)
  }

  async init() {
    if (this.omegga.__npcLine) this.omegga.off('line', this.omegga.__npcLine);
    this.omegga.__npcLine = line => this.onLine(line).catch(err => dbg('line error', err.stack));
    this.omegga.on('line', this.omegga.__npcLine);
    for (const e of ['cmd:talk', 'chatcmd:talk']) {
      this.omegga.removeAllListeners(e);
      this.omegga.on(e, name => this.talkCmd(name).catch(err => console.error('[npctalk] talk', err)));
    }
    // E on an NPC's talk cylinder (npctalk/body.mjs: Interact ConsoleTag event:npctalk:<id>)
    this.omegga.removeAllListeners('event:npctalk');
    this.omegga.on('event:npctalk', (who, id) => this.interact(who, id).catch(err => dbg('interact error', err.stack)));
    this.timer = setInterval(() => this.tick().catch(err => dbg('tick error', err.stack)), 700);
    console.log(`[npctalk] ${NPCS.length} NPCs, model ${this.model()}`);
    return { registeredCommands: ['talk'] };
  }

  async stop() { clearInterval(this.timer); }

  model() { return this.config.model || 'claude-haiku-5-5'; }
  radius(npc) { return npc.roam ? (this.config['roam-radius'] ?? 260) : (this.config.radius ?? 130); }

  nearest(pos, max = Infinity) {
    let best = null, bd = max;
    for (const n of NPCS) {
      const d = Math.hypot(n.at[0] - pos[0], n.at[1] - pos[1], (n.at[2] - pos[2]) * 0.5);
      if (d < bd && d <= (max === Infinity ? this.radius(n) : max)) { best = n; bd = d; }
    }
    return best;
  }

  open(player, npc, line) {
    this.omegga.writeln(`br.Chat.Command /npcopen ${clean(player.name, 64)}|${clean(npc.name, 40)}|${clean(line)}`);
  }

  async tick() {
    const all = await this.omegga.getAllPlayerPositions();
    if (!this.dumped) { this.dumped = true; dbg('positions', JSON.stringify(all).slice(0, 400)); }
    const now = Date.now();
    for (const e of all) {
      const { player } = e;
      // builder/ghost mode: the bulk call says pos null (isDead); ask the player directly
      const pos = e.pos ?? await this.omegga.getPlayer(player.id)?.getPosition().catch(() => null);
      if (!pos) continue;
      const id = player.id, c = this.convo.get(id);
      if (c) { // walked away: the conversation is over (the box may still be up; an answer then gets no reply)
        const d = Math.hypot(c.npc.at[0] - pos[0], c.npc.at[1] - pos[1]);
        if (d > this.radius(c.npc) + 1600) { /* NPCs wander up to 15 m from home */ this.convo.delete(id); this.cool.set(`${id}:${c.npc.id}`, now + 15_000); }
        continue;
      }
      if (!this.config.proximity) continue; // talking starts with E on the NPC (config proximity: pop up when near)
      const npc = this.nearest(pos);
      if (!npc || (this.cool.get(`${id}:${npc.id}`) ?? 0) > now) { this.near.delete(id); continue; }
      const n = this.near.get(id);
      if (!n || n.npc !== npc) { this.near.set(id, { npc, ticks: 1 }); continue; }
      if (++n.ticks < 2) continue; // ~1.4 s near before they speak
      this.near.delete(id);
      this.convo.set(id, { npc, hist: [{ role: 'assistant', content: npc.greet }], busy: false });
      dbg('open', player.name, npc.name);
      this.open(player, npc, npc.greet);
    }
  }

  async interact(who, id) {
    const npc = NPCS[Number(id)], player = who && this.omegga.getPlayer(who.id ?? who.name);
    if (!npc || !player) return;
    const c = this.convo.get(player.id);
    if (c?.busy) return;
    this.cool.delete(`${player.id}:${npc.id}`);
    this.convo.set(player.id, { npc, hist: [{ role: 'assistant', content: npc.greet }], busy: false });
    this.open(player, npc, npc.greet);
  }

  async talkCmd(name) {
    const player = this.omegga.getPlayer(name);
    const pos = player && await player.getPosition();
    if (!pos) return;
    const npc = this.nearest(pos, 400);
    if (!npc) return this.omegga.whisper(player, 'Nobody to talk to here. Walk up to a villager.');
    this.cool.delete(`${player.id}:${npc.id}`);
    this.convo.set(player.id, { npc, hist: [{ role: 'assistant', content: npc.greet }], busy: false });
    this.open(player, npc, npc.greet);
  }

  async onLine(line) {
    const m = /\[Wire Graph\] npc\.(say|bye)\|([0-9a-f-]{36})\|?(.*)$/.exec(line);
    if (!m || line.includes('WRITE')) return;
    const [, kind, id, rawText] = m;
    const player = this.omegga.getPlayer(id);
    const c = this.convo.get(id);
    if (kind === 'bye') {
      if (c) { this.convo.delete(id); this.cool.set(`${id}:${c.npc.id}`, Date.now() + (this.config['cooldown-seconds'] ?? 45) * 1000); }
      return;
    }
    if (!player || !c || c.busy) return;
    const text = clean(rawText, 400);
    if (!text) return this.open(player, c.npc, '...?');
    c.busy = true;
    try {
      c.hist.push({ role: 'user', content: `${clean(player.name, 40)}: ${text}` });
      const reply = await this.ask(c.npc, c.hist).catch(err => { console.error('[npctalk] llm', err.message); return null; });
      const said = clean(reply || 'Hm? Sorry, my mind wandered. Say that again?', 260);
      c.hist.push({ role: 'assistant', content: said });
      if (c.hist.length > 16) c.hist.splice(1, c.hist.length - 16);
      if (this.convo.get(id) === c) this.open(player, c.npc, said);
    } finally { c.busy = false; }
  }

  async ask(npc, hist) {
    // the API wants the first message from the user: start with a scene line
    const messages = [{ role: 'user', content: '(A traveller walks up to you.)' }, ...hist];
    for (let i = messages.length - 1; i > 0; i--) // merge same-role neighbours
      if (messages[i].role === messages[i - 1].role) { messages[i - 1].content += '\n' + messages[i].content; messages.splice(i, 1); }
    const res = await fetch(`${this.config['base-url'] || 'http://127.0.0.1:8083'}/v1/messages`, {
      method: 'POST',
      signal: AbortSignal.timeout(30_000),
      headers: { 'content-type': 'application/json', 'x-api-key': this.config['proxy-token'] || 'freecc', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: this.model(), max_tokens: 1500, system: `${npc.persona}\n\n${LORE}\n\n${RULES}`, messages }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const out = await res.json();
    return (out.content ?? []).filter(b => b.type === 'text').map(b => b.text).join(' ').trim();
  }
};
