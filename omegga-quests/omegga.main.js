// quests (owner 2026-10-18: "add npcs and quests ... click on the invisible circle that's
// tracking the person and it will give you a dialogue and yes and no or yes and cancel").
//
// Quest NPCs = npcs.json (bodies from npctalk/body.mjs with TAG=quest: a bot + an invisible
// talk rod that follows it; E on the rod -> ConsoleTag event:quest:<id> -> here).
// Dialog boxes and UI sounds are the quest chip (npctalk/questchip.mjs, prefab questchip):
//   br.Chat.Command /qbox <player>|y|o|m|<title>|<message>   -> log quest.yes|<uid> / quest.no|<uid>
//   br.Chat.Command /qsfx <player>|1 accepted 2 done 3 delivered
// Quest list on the right of the screen: questhud chip (/questhud <player>|<text>).
// Kills: NPC bodies log quest.died|<npc id>|<killer uid>; skeletons come from the
// skeleton_drop chip's "[xp debug] C killer=<name> lim=<max health>".
// Fizzwick's side quest gives +1 Regen (leaderboard value "Regen", read by the regen chip:
// npctalk/regenchip.mjs; overheal bleeds off with a tick).
// Main quest = story.js (The Vice Grips of Truth); step types are documented there.
//
//   !quest        your quests     !quest drop <n>   give one up (not the main quest)
// Unsafe (plain node) plugin, like progress.

const NPCS = require('./npcs.json');
const { MAIN, IDLE: STORY_IDLE, GRIPS } = require('./story.js');
const BY = Object.fromEntries(NPCS.map(n => [n.key, n]));
// things you press E on that are not people (ConsoleTag event:quest:<key>): the pedestal in the Temple of the Stash
const THINGS = { stash: { key: 'stash', name: 'THE STASH' } };
Object.assign(BY, THINGS);
const clean = (s, n = 300) => String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/[|<>"'`\\]/g, '').replace(/[^\x20-\x7e]/g, '').trim().slice(0, n);
const C = (hex, s) => `<color="${hex}">${s}</>`;
const SKELETON = new Set([50, 75, 125, 200, 250, 350, 500]); // skeleton_drop ENEMY max healths
const REGEN_MAX = 5;
const pick = a => a[Math.floor(Math.random() * a.length)];

const SIDE = [
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
const QUESTS = [...MAIN, ...SIDE];
const Q = Object.fromEntries(QUESTS.map(q => [q.id, q]));
const IDLE = {
  kevin: ['have u seen Gary. hes so cool. i bet he has a jetski', 'i would go myself but the end of the map is far and i am wearing sandals'],
  dustin: ['so bored. i have counted every brick in this plaza. there are several', 'daniel is over there. just being daniel. ugh'],
  daniel: ['hey guys what are we doing', 'hey whats up. why are you looking at me like that', 'i love standing here. this is my spot'],
  fizz: ['Soda! Carbonated hope in a can!', 'Every flavour is my favourite flavour. Except Swamp. Swamp is a dare.'],
  gary: ['who sent you', 'i live at the end of the map because the rent is free and the trees cant judge me'],
  ...STORY_IDLE,
};
const stepTo = (q, st) => st?.to ?? (st?.do === 'back' ? q.giver : null);
const named = key => BY[key]?.name ?? key;

module.exports = class Quests {
  constructor(omegga, config, store) { this.omegga = omegga; this.config = config ?? {}; this.store = store; this.pending = new Map(); this.busy = new Set(); }

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
    this.ticker = setInterval(() => this.tick().catch(err => console.error('[quests] tick', err)), 1000);
    console.log(`[quests] ${NPCS.length} NPCs, ${QUESTS.length} quests (${MAIN.length} main chapters)`);
    return { registeredCommands: ['quest', 'quests'] };
  }
  async stop() { clearInterval(this.timer); clearInterval(this.ticker); if (this.omegga.__questsLine) this.omegga.off('line', this.omegga.__questsLine); }

  get = async id => { const s = (await this.store.get('qs:' + id)) ?? {}; s.active ??= {}; s.done ??= {}; s.regen ??= 0; s.grips ??= 0; return s; };
  put = (id, s) => this.store.set('qs:' + id, s);
  run(line) { this.omegga.writeln(line); }
  box(p, kind, title, msg, then, no) {
    this.pending.set(p.id, { then, no, at: Date.now() });
    this.run(`br.Chat.Command /qbox ${clean(p.name, 64)}|${kind}|${clean(title, 60)}|${clean(msg)}`);
  }
  /** message boxes one after another (OK walks on), then `then` */
  boxes(p, title, lines, then) {
    const [first, ...rest] = lines ?? [];
    if (first == null) return then?.();
    this.box(p, 'm', title, first, () => this.boxes(p, title, rest, then));
  }
  sfx(p, n) { this.run(`br.Chat.Command /qsfx ${clean(p.name, 64)}|${n}`); }
  titleOf(q) { return q.main ? `Chapter ${q.main}: ${q.title}` : q.title; }

  stepText(q, a) {
    const st = q.steps[a.step];
    if (!st) return '';
    switch (st.do) {
      case 'say': return `Tell ${named(st.to)}: ${st.line}`;
      case 'talk': case 'ask': return `Talk to ${named(st.to)}`;
      case 'kill': return st.who === 'skeleton' ? `Skeletons ${a.count ?? 0}/${st.n}` : `Kill ${named(st.who)}`;
      case 'reach': return st.hint;
      case 'escape': return `RUN from ${named(st.from)}! ${Math.max(0, Math.ceil(st.secs - (Date.now() - (a.t0 ?? Date.now())) / 1000))} s`;
      default: return st.line ? `Tell ${named(q.giver)}: ${st.line}` : `Back to ${named(q.giver)}`;
    }
  }
  hud(p, s) {
    const rows = Object.entries(s.active).sort(([a], [b]) => (Q[b].main ? 1 : 0) - (Q[a].main ? 1 : 0))
      .map(([id, a]) => `${Q[id].main ? '{h}' : '{y}'}${this.titleOf(Q[id])}{/}~{d}  ${this.stepText(Q[id], a)}{/}`);
    const grips = s.grips || s.done.m1 || s.active.m1 ? `~{w}Vice Grips of Truth: ${s.grips}/8{/}` : '';
    const text = `{h}{b}Quests{/b}{/}~${rows.length ? rows.join('~') : '{d}none{/}'}${grips}${s.regen ? `~{g}Regen +${s.regen}{/}` : ''}`;
    this.run(`br.Chat.Command /questhud ${clean(p.name, 64)}|${text.replace(/["'\\|]/g, '')}`);
  }

  /** the current step of quest `qid` is done: hand over its grip, move on, finish the quest at the end */
  async advance(p, qid) {
    const s = await this.get(p.id), a = s.active[qid], q = Q[qid];
    if (!a) return;
    const st = q.steps[a.step];
    if (st?.grip) {
      s.grips = Math.max(s.grips, st.grip);
      this.sfx(p, 2);
      this.omegga.whisper(p, C('ffd34d', `<b>Vice Grip of Truth ${st.grip}/8: the Grip of ${GRIPS[st.grip - 1]}</>`));
    }
    a.step++; a.count = 0;
    const next = q.steps[a.step];
    if (next?.do === 'escape') a.t0 = Date.now();
    await this.put(p.id, s);
    this.hud(p, s);
    if (!next) return this.finish(p, q);
  }

  async accept(p, q) {
    const s = await this.get(p.id);
    if (s.active[q.id]) return;
    s.active[q.id] = { step: 0, count: 0 };
    await this.put(p.id, s);
    this.sfx(p, 1); this.hud(p, s);
    this.omegga.whisper(p, `${C('8f8', `<b>${q.main ? 'Main quest' : 'Quest accepted'}: ${this.titleOf(q)}</>`)} ${C('8cf', this.stepText(q, s.active[q.id]))}`);
  }

  async interact(who, id) {
    const npc = THINGS[id] ?? NPCS[Number(id)], p = who && this.omegga.getPlayer(who.id ?? who.name);
    if (!npc || !p) return;
    const s = await this.get(p.id);
    // 1. an active step that happens at this NPC (main quest first)
    const act = Object.entries(s.active).sort(([x], [y]) => (Q[y].main ? 1 : 0) - (Q[x].main ? 1 : 0));
    for (const [qid, a] of act) {
      const q = Q[qid], st = q.steps[a.step];
      if (stepTo(q, st) !== npc.key) continue;
      const at = a.step;
      const still = async () => (await this.get(p.id)).active[qid]?.step === at; // a double click can't skip steps
      switch (st.do) {
        case 'talk': return this.boxes(p, npc.name, st.lines, async () => { if (await still()) await this.advance(p, qid); });
        case 'ask': return this.box(p, 'y', npc.name, st.msg, () => this.boxes(p, npc.name, st.yes, async () => { if (await still()) await this.advance(p, qid); }),
          () => st.no && this.box(p, 'm', npc.name, st.no));
        case 'say': return this.box(p, 'o', npc.name, `${named(q.giver)} says: ${st.line}`, async () => {
          if (!(await still())) return;
          this.sfx(p, 3); await this.advance(p, qid);
          this.box(p, 'm', npc.name, `${st.reply}  (Take that back to ${named(q.giver)}.)`);
        });
        case 'back': {
          const prev = q.steps[a.step - 1];
          return this.box(p, 'o', npc.name, st.line ? `${named(prev?.to) ?? 'They'} says: ${st.line}` : `${q.title}: done. ${npc.name} is waiting.`, async () => { if (await still()) await this.advance(p, qid); });
        }
      }
    }
    // 2. a quest of this NPC still running elsewhere
    for (const [qid, a] of act) {
      const q = Q[qid];
      if (q.giver === npc.key && !q.main) return this.box(p, 'm', npc.name, `${pick(IDLE[npc.key])}  (${q.title}: ${this.stepText(q, a)})`);
    }
    // 3. offer
    const now = Date.now();
    const q = QUESTS.find(q => q.giver === npc.key && !q.auto && !s.active[q.id] && (!q.after || s.done[q.after]) &&
      (!s.done[q.id] || (q.repeat && now - s.done[q.id] > q.repeat * 60e3)) && !(q.regen && s.regen >= REGEN_MAX));
    if (q) {
      const reward = [q.coins && `${q.coins} coins`, q.xp && `${q.xp} XP`, q.regen && `+${q.regen} Regen`].filter(Boolean).join(', ');
      return this.box(p, 'y', `${npc.name}: ${this.titleOf(q)}`, q.main ? q.ask : `${q.ask}  (${reward})`, async () => {
        await this.accept(p, q);
        const st = q.steps[0];
        if (stepTo(q, st) === npc.key) await this.interact(who, id); // the first scene happens right here
      }, () => q.no && this.box(p, 'm', npc.name, q.no));
    }
    // 4. small talk (Randal: always about to say it, until the grips)
    const key = npc.key === 'randal' && s.done.m9 ? 'randalReformed' : npc.key;
    return this.box(p, 'm', npc.name, pick(IDLE[key] ?? ['...']));
  }

  async finish(p, q) {
    const s = await this.get(p.id);
    if (!s.active[q.id]) return;
    delete s.active[q.id];
    s.done[q.id] = Date.now();
    if (q.regen) s.regen = Math.min(REGEN_MAX, s.regen + q.regen);
    const next = QUESTS.find(n => n.auto && n.after === q.id && !s.done[n.id]);
    if (next) { s.active[next.id] = { step: 0, count: 0 }; if (next.steps[0].do === 'escape') s.active[next.id].t0 = Date.now(); }
    await this.put(p.id, s);
    if (q.coins) p.setLeaderboard('coins', (+(await p.getLeaderboard('coins')) || 0) + q.coins);
    if (q.xp) p.setLeaderboard('XP', (+(await p.getLeaderboard('XP')) || 0) + q.xp);
    if (q.regen) p.setLeaderboard('Regen', s.regen);
    this.sfx(p, 2); this.hud(p, s);
    const reward = [q.coins && `+${q.coins} coins`, q.xp && `+${q.xp} XP`, q.regen && `Regen ${s.regen}`].filter(Boolean).join(', ');
    const doneBox = q.main ? `${this.titleOf(q)} complete. (${reward})` : `${q.done}  (${reward})`;
    this.box(p, 'm', q.main ? 'The Vice Grips of Truth' : `${named(q.giver)}: ${q.title} complete`, doneBox, () => {
      if (next) { this.sfx(p, 1); this.boxes(p, this.titleOf(next), next.intro); }
    });
  }

  async addKill(p, match) {
    const s = await this.get(p.id);
    const done = [];
    let changed = false;
    for (const [qid, a] of Object.entries(s.active)) {
      const st = Q[qid].steps[a.step];
      if (st?.do !== 'kill' || !match(st)) continue;
      a.count = (a.count ?? 0) + 1; changed = true;
      if (a.count >= st.n) done.push(qid);
    }
    if (!changed) return;
    await this.put(p.id, s); this.hud(p, s);
    for (const qid of done) {
      const q = Q[qid];
      await this.advance(p, qid);
      const now = q.steps[(await this.get(p.id)).active[qid]?.step];
      this.omegga.whisper(p, C('8f8', `${this.titleOf(q)}: done! ${now ? this.stepText(q, (await this.get(p.id)).active[qid]) : ''}`));
    }
  }

  /** every second: reach / escape steps */
  async tick() {
    const players = this.omegga.getPlayers();
    if (!players.length) return;
    let pos = null;
    for (const pl of players) {
      if (this.busy.has(pl.id)) continue;
      const s = await this.get(pl.id);
      const live = Object.entries(s.active).filter(([qid, a]) => !a.waiting && ['reach', 'escape'].includes(Q[qid].steps[a.step]?.do));
      if (!live.length) continue;
      pos ??= new Map((await this.omegga.getAllPlayerPositions()).map(e => [e.player.id, e.pos]));
      const at = pos.get(pl.id), p = this.omegga.getPlayer(pl.id);
      if (!at || !p) continue;
      this.busy.add(pl.id);
      try {
        for (const [qid, a] of live) {
          const q = Q[qid], st = q.steps[a.step], step = a.step;
          const go = async lines => { // arrived / escaped: park the step until the boxes are read
            a.waiting = true; await this.put(pl.id, s);
            this.sfx(p, 3);
            this.boxes(p, this.titleOf(q), lines, async () => {
              const s2 = await this.get(p.id);
              if (s2.active[qid]?.step !== step) return;
              delete s2.active[qid].waiting; await this.put(p.id, s2);
              await this.advance(p, qid);
            });
          };
          if (st.do === 'reach') {
            if (Math.hypot(at[0] - st.at[0], at[1] - st.at[1]) <= st.r && (st.zMin == null || at[2] >= st.zMin) && (st.zMax == null || at[2] <= st.zMax)) await go(st.lines);
          } else {
            const from = BY[st.from].at;
            if (Math.hypot(at[0] - from[0], at[1] - from[1]) >= st.dist) await go(st.ok);
            else if (Date.now() - (a.t0 ?? Date.now()) > st.secs * 1000) {
              a.step = st.retry; delete a.t0;
              await this.put(pl.id, s); this.hud(p, s);
              this.boxes(p, named(st.from), st.fail);
            } else this.hud(p, s);
          }
        }
      } finally { this.busy.delete(pl.id); }
    }
  }

  async onLine(line) {
    let m = /\[Wire Graph\] quest\.(yes|no)\|([0-9a-f-]{36})/.exec(line);
    if (m) {
      const pend = this.pending.get(m[2]);
      this.pending.delete(m[2]);
      if (!pend || Date.now() - pend.at > 600e3) return;
      if (m[1] === 'yes') await pend.then?.(); else await pend.no?.();
      return;
    }
    m = /\[Wire Graph\] quest\.died\|(\d+)\|([0-9a-f-]{36})/.exec(line);
    if (m) {
      const npc = NPCS[+m[1]], p = this.omegga.getPlayer(m[2]);
      if (npc && p) await this.addKill(p, st => st.who === npc.key);
      return;
    }
    m = /\[xp debug\] C killer=(.+?) lim=(\d+)/.exec(line);
    if (m && SKELETON.has(+m[2])) {
      const p = this.omegga.getPlayer(m[1].trim());
      if (p) await this.addKill(p, st => st.who === 'skeleton');
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
      if (Q[qid].main) return this.omegga.whisper(p, C('8cf', 'You cannot drop the main quest. Randal is still mid-sentence.'));
      delete s.active[qid]; await this.put(p.id, s); this.hud(p, s);
      return this.omegga.whisper(p, C('8cf', `Dropped ${Q[qid].title}.`));
    }
    this.hud(p, s);
    if (!ids.length) return this.omegga.whisper(p, C('8cf', 'No quests. Racist Randal on the plaza is about to say something. Someone should stop him (walk up and press E).'));
    ids.forEach((qid, i) => this.omegga.whisper(p, `${C('8f8', `${i + 1}. <b>${this.titleOf(Q[qid])}</>`)} ${C('8cf', this.stepText(Q[qid], s.active[qid]))}`));
    this.omegga.whisper(p, C('ffd34d', `Vice Grips of Truth: ${s.grips}/8`));
  }
};
