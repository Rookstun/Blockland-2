// quests (owner 2026-10-18: "add npcs and quests ... click on the invisible circle that's
// tracking the person and it will give you a dialogue and yes and no or yes and cancel").
//
// Quest NPCs = npcs.json (bodies from npctalk/body.mjs with TAG=quest: a bot + an invisible
// talk rod that follows it; E on the rod -> ConsoleTag event:quest:<id> -> here).
// Dialog boxes and UI sounds are the quest chip (npctalk/questchip.mjs, prefab questchip):
//   br.Chat.Command /qbox <player>|y|o|m|<title>|<message>   -> log quest.yes|<uid> / quest.no|<uid>
//   br.Chat.Command /qsfx <player>|1 accepted 2 done 3 delivered
// Quest list on the right of the screen: questhud chip (/questhud <player>|<text>).
// Kills: Daniel's body logs quest.died|<npc id>|<killer uid>; skeletons come from the
// skeleton_drop chip's "[xp debug] C killer=<name> lim=<max health>".
// Fizzwick's quest gives +1 Regen (leaderboard value "Regen", read by the regen chip:
// npctalk/regenchip.mjs; overheal bleeds off with a tick).
//
//   !quest        your quests     !quest drop <n>   give one up
// Unsafe (plain node) plugin, like progress.

const NPCS = require('./npcs.json');
const BY = Object.fromEntries(NPCS.map(n => [n.key, n]));
const clean = (s, n = 300) => String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/[|<>"\\]/g, '').replace(/[^\x20-\x7e]/g, '').trim().slice(0, n);
const C = (hex, s) => `<color="${hex}">${s}</>`;
const SKELETON = new Set([50, 75, 125, 200, 250, 350, 500]); // skeleton_drop ENEMY max healths
const REGEN_MAX = 5;
const pick = a => a[Math.floor(Math.random() * a.length)];

// steps: { do: 'say', to, line, reply } walk to `to`, OK the box, they answer `reply`
//        { do: 'kill', who: npc key | 'skeleton', n }
//        { do: 'back', line? } return to the giver (line = what you tell them)
const QUESTS = [
  { id: 'sup', giver: 'kevin', title: 'Sup', ask: 'yo can u tell Gary I said sup. he lives at the very end of the map, past the snow, in the creepy forest. hes my best friend. we have never met',
    steps: [{ do: 'say', to: 'gary', line: 'sup', reply: 'wyd' }, { do: 'back', line: 'wyd' }],
    done: 'wyd?? WYD??? ok ok ok act natural', coins: 50, xp: 40 },
  { id: 'chillin', giver: 'kevin', after: 'sup', title: 'Chillin', ask: 'ok tell him chillin. dont say anything else. dont make it weird',
    steps: [{ do: 'say', to: 'gary', line: 'chillin', reply: 'nice' }, { do: 'back', line: 'nice' }],
    done: 'he said nice. we are basically married now', coins: 75, xp: 60 },
  { id: 'bet', giver: 'kevin', after: 'chillin', title: 'Bet', ask: 'last one. tell him bet. that is the whole message. it says everything',
    steps: [{ do: 'say', to: 'gary', line: 'bet', reply: 'bet' }, { do: 'back', line: 'bet' }],
    done: 'bet. this is the greatest friendship in recorded history. here, have my lunch money', coins: 150, xp: 120 },
  { id: 'daniel', giver: 'dustin', title: 'Kill Daniel', ask: 'im bored lets kill daniel', repeat: 10,
    steps: [{ do: 'kill', who: 'daniel', n: 1 }, { do: 'back' }],
    done: 'lol. ok that was fun for about four seconds. he comes back in like two minutes if you wanna do it again', coins: 100, xp: 80 },
  { id: 'calcium', giver: 'fizz', title: 'Calcium Fizz', ask: 'I am inventing a soda that is good for your bones. It needs bones. Put down 5 skeletons and the first sip of the future is yours.', repeat: 10,
    steps: [{ do: 'kill', who: 'skeleton', n: 5 }, { do: 'back' }],
    done: 'Bone dry and fizzing! Drink up: +1 Regen. Your wounds now close by themselves. Do not drink past full, you will tick like a kettle until it wears off.', regen: 1, coins: 0, xp: 100 },
];
const Q = Object.fromEntries(QUESTS.map(q => [q.id, q]));
const IDLE = {
  kevin: ['have u seen Gary. hes so cool. i bet he has a jetski', 'i would go myself but the end of the map is far and i am wearing sandals'],
  dustin: ['so bored. i have counted every brick in this plaza. there are several', 'daniel is over there. just being daniel. ugh'],
  daniel: ['hey guys what are we doing', 'hey whats up. why are you looking at me like that', 'i love standing here. this is my spot'],
  fizz: ['Soda! Carbonated hope in a can!', 'Every flavour is my favourite flavour. Except Swamp. Swamp is a dare.'],
  gary: ['who sent you', 'i live at the end of the map because the rent is free and the trees cant judge me'],
};

module.exports = class Quests {
  constructor(omegga, config, store) { this.omegga = omegga; this.config = config ?? {}; this.store = store; this.pending = new Map(); }

  async init() {
    const on = (e, fn) => { this.omegga.removeAllListeners(e); this.omegga.on(e, (...a) => fn(...a).catch(err => console.error('[quests]', e, err))); };
    for (const e of ['cmd:quest', 'chatcmd:quest', 'cmd:quests', 'chatcmd:quests']) on(e, (name, ...a) => this.cmd(name, a.join(' ').trim().toLowerCase()));
    on('event:quest', (who, id) => this.interact(who, id));
    on('join', p => this.onJoin(p));
    if (this.omegga.__questsLine) this.omegga.off('line', this.omegga.__questsLine);
    this.omegga.__questsLine = line => this.onLine(line).catch(err => console.error('[quests] line', err));
    this.omegga.on('line', this.omegga.__questsLine);
    // Regen lives on a leaderboard value the game forgets on a reset: keep it set
    this.timer = setInterval(() => this.syncRegen().catch(() => {}), 30_000);
    console.log(`[quests] ${NPCS.length} NPCs, ${QUESTS.length} quests`);
    return { registeredCommands: ['quest', 'quests'] };
  }
  async stop() { clearInterval(this.timer); if (this.omegga.__questsLine) this.omegga.off('line', this.omegga.__questsLine); }

  get = async id => { const s = (await this.store.get('qs:' + id)) ?? {}; s.active ??= {}; s.done ??= {}; s.regen ??= 0; return s; };
  put = (id, s) => this.store.set('qs:' + id, s);
  run(line) { this.omegga.writeln(line); }
  box(p, kind, title, msg, then) {
    this.pending.set(p.id, { then, at: Date.now() });
    this.run(`br.Chat.Command /qbox ${clean(p.name, 64)}|${kind}|${clean(title, 60)}|${clean(msg)}`);
  }
  sfx(p, n) { this.run(`br.Chat.Command /qsfx ${clean(p.name, 64)}|${n}`); }

  stepText(q, a) {
    const st = q.steps[a.step];
    if (!st) return '';
    if (st.do === 'say') return `Tell ${BY[st.to].name}: ${st.line}`;
    if (st.do === 'kill') return st.who === 'skeleton' ? `Skeletons ${a.count ?? 0}/${st.n}` : `Kill ${BY[st.who].name}`;
    return st.line ? `Tell ${BY[q.giver].name}: ${st.line}` : `Back to ${BY[q.giver].name}`;
  }
  hud(p, s) {
    const rows = Object.entries(s.active).map(([id, a]) => `{y}${Q[id].title}{/}~{d}  ${this.stepText(Q[id], a)}{/}`);
    const text = `{h}{b}Quests{/b}{/}~${rows.length ? rows.join('~') : '{d}none{/}'}${s.regen ? `~{g}Regen +${s.regen}{/}` : ''}`;
    this.run(`br.Chat.Command /questhud ${clean(p.name, 64)}|${text.replace(/["\\]/g, '')}`);
  }

  async interact(who, id) {
    const npc = NPCS[Number(id)], p = who && this.omegga.getPlayer(who.id ?? who.name);
    if (!npc || !p) return;
    const s = await this.get(p.id);
    // 1. a message for this NPC
    for (const [qid, a] of Object.entries(s.active)) {
      const q = Q[qid], st = q.steps[a.step];
      if (st?.do === 'say' && st.to === npc.key)
        return this.box(p, 'o', npc.name, `${BY[q.giver].name} says: ${st.line}`, async () => {
          const s2 = await this.get(p.id), a2 = s2.active[qid];
          if (!a2 || a2.step !== a.step) return;
          a2.step++; await this.put(p.id, s2); this.sfx(p, 3); this.hud(p, s2);
          this.box(p, 'm', npc.name, `${st.reply}  (Take that back to ${BY[q.giver].name}.)`);
        });
    }
    // 2. hand in
    for (const [qid, a] of Object.entries(s.active)) {
      const q = Q[qid], st = q.steps[a.step];
      if (q.giver === npc.key && st?.do === 'back')
        return this.box(p, 'o', npc.name, st.line ? `${BY[st.to ?? q.steps[a.step - 1]?.to]?.name ?? 'They'} says: ${st.line}` : `${q.title}: done. ${npc.name} is waiting.`, () => this.finish(p, q));
      if (q.giver === npc.key) return this.box(p, 'm', npc.name, `${pick(IDLE[npc.key])}  (${q.title}: ${this.stepText(q, a)})`);
    }
    // 3. offer
    const now = Date.now();
    const q = QUESTS.find(q => q.giver === npc.key && !s.active[q.id] && (!q.after || s.done[q.after]) &&
      (!s.done[q.id] || (q.repeat && now - s.done[q.id] > q.repeat * 60e3)) && !(q.regen && s.regen >= REGEN_MAX));
    if (!q) return this.box(p, 'm', npc.name, pick(IDLE[npc.key] ?? ['...']));
    this.box(p, 'y', `${npc.name}: ${q.title}`, `${q.ask}  (${[q.coins && `${q.coins} coins`, q.xp && `${q.xp} XP`, q.regen && `+${q.regen} Regen`].filter(Boolean).join(', ')})`, async () => {
      const s2 = await this.get(p.id);
      if (s2.active[q.id]) return;
      s2.active[q.id] = { step: 0, count: 0 };
      await this.put(p.id, s2);
      this.sfx(p, 1); this.hud(p, s2);
      this.omegga.whisper(p, `${C('8f8', `<b>Quest accepted: ${q.title}</>`)} ${C('8cf', this.stepText(q, s2.active[q.id]))}`);
    });
  }

  async finish(p, q) {
    const s = await this.get(p.id);
    if (!s.active[q.id]) return;
    delete s.active[q.id];
    s.done[q.id] = Date.now();
    if (q.regen) s.regen = Math.min(REGEN_MAX, s.regen + q.regen);
    await this.put(p.id, s);
    if (q.coins) p.setLeaderboard('coins', (+(await p.getLeaderboard('coins')) || 0) + q.coins);
    if (q.xp) p.setLeaderboard('XP', (+(await p.getLeaderboard('XP')) || 0) + q.xp);
    if (q.regen) p.setLeaderboard('Regen', s.regen);
    this.sfx(p, 2); this.hud(p, s);
    this.box(p, 'm', `${BY[q.giver].name}: ${q.title} complete`, `${q.done}  (${[q.coins && `+${q.coins} coins`, q.xp && `+${q.xp} XP`, q.regen && `Regen ${s.regen}`].filter(Boolean).join(', ')})`);
  }

  async advanceKill(p, match) {
    const s = await this.get(p.id);
    let changed = false;
    for (const [qid, a] of Object.entries(s.active)) {
      const st = Q[qid].steps[a.step];
      if (st?.do !== 'kill' || !match(st)) continue;
      a.count = (a.count ?? 0) + 1;
      if (a.count >= st.n) { a.step++; a.count = 0; this.omegga.whisper(p, C('8f8', `${Q[qid].title}: done! Back to ${BY[Q[qid].giver].name}.`)); }
      changed = true;
    }
    if (changed) { await this.put(p.id, s); this.hud(p, s); }
  }

  async onLine(line) {
    let m = /\[Wire Graph\] quest\.(yes|no)\|([0-9a-f-]{36})/.exec(line);
    if (m) {
      const pend = this.pending.get(m[2]);
      this.pending.delete(m[2]);
      if (m[1] === 'yes' && pend?.then && Date.now() - pend.at < 300e3) await pend.then();
      return;
    }
    m = /\[Wire Graph\] quest\.died\|(\d+)\|([0-9a-f-]{36})/.exec(line);
    if (m) {
      const npc = NPCS[+m[1]], p = this.omegga.getPlayer(m[2]);
      if (npc && p) await this.advanceKill(p, st => st.who === npc.key);
      return;
    }
    m = /\[xp debug\] C killer=(.+?) lim=(\d+)/.exec(line);
    if (m && SKELETON.has(+m[2])) {
      const p = this.omegga.getPlayer(m[1].trim());
      if (p) await this.advanceKill(p, st => st.who === 'skeleton');
    }
  }

  async onJoin(player) {
    const p = this.omegga.getPlayer(player.id ?? player.name);
    if (!p) return;
    setTimeout(async () => { const s = await this.get(p.id); if (s.regen) p.setLeaderboard('Regen', s.regen); this.hud(p, s); }, 8000);
  }

  async syncRegen() {
    for (const p of this.omegga.getPlayers()) {
      const pl = this.omegga.getPlayer(p.id), s = await this.get(p.id);
      if (pl && s.regen && +(await pl.getLeaderboard('Regen')) !== s.regen) pl.setLeaderboard('Regen', s.regen);
    }
  }

  async cmd(name, arg) {
    const p = this.omegga.getPlayer(name);
    if (!p) return;
    const s = await this.get(p.id);
    const ids = Object.keys(s.active);
    const dm = /^drop\s*(\d*)$/.exec(arg);
    if (dm) {
      const qid = ids[(+dm[1] || 1) - 1];
      if (!qid) return this.omegga.whisper(p, C('8cf', 'No such quest. !quest lists yours.'));
      delete s.active[qid]; await this.put(p.id, s); this.hud(p, s);
      return this.omegga.whisper(p, C('8cf', `Dropped ${Q[qid].title}.`));
    }
    this.hud(p, s);
    if (!ids.length) return this.omegga.whisper(p, C('8cf', 'No quests. Talk to Kevin, Dustin or Fizzwick (walk up and press E on them).'));
    ids.forEach((qid, i) => this.omegga.whisper(p, `${C('8f8', `${i + 1}. <b>${Q[qid].title}</>`)} ${C('8cf', this.stepText(Q[qid], s.active[qid]))}`));
  }
};
