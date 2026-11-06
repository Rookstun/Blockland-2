// discord: two-way chat relay between the game and one Discord channel.
//
// Discord -> game: bot gateway (Node 22 global WebSocket, intents GUILD_MESSAGES
// + MESSAGE_CONTENT); every message in `channel` not sent by a bot/webhook goes
// out as br.Chat.Broadcast "[Discord] name: text".
// Game -> Discord: chat (+ joins/leaves) through the webhook (player name as the
// sender) if set, else the bot posts "**name**: text". Mentions never ping.

const API = 'https://discord.com/api/v10';
const fs = require('fs');
const STATUS = require('path').join(__dirname, 'status.json');
// plugin console output doesn't reach the game log: keep a status file to read over ssh
const status = {};
const note = (k, v) => {
  status[k] = v;
  status.at = new Date().toISOString();
  try {
    fs.writeFileSync(STATUS, JSON.stringify(status, null, 1));
  } catch {}
};
// MessageFlags.SUPPRESS_NOTIFICATIONS (@silent): no push/desktop notifications
const SILENT = 1 << 12;
const sleep = ms => new Promise(r => setTimeout(r, ms));
// game rich text (same as chatbot sanitize)
const gameSafe = s =>
  String(s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '&scl;')
    .replace(/>/g, '&gt;')
    .replace(/_/g, '&und;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '\\"');
// game chat arrives escaped
const unescape = s =>
  String(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&scl;/g, ';')
    .replace(/&und;/g, '_')
    .replace(/&amp;/g, '&');
// Discord markdown: keep game text literal
const mdSafe = s => String(s).replace(/([\\*_~`|>#[\]()-])/g, '\\$1');

module.exports = class Discord {
  constructor(omegga, config, store) {
    this.omegga = omegga;
    this.config = config;
    this.store = store;
    this.ws = null;
    this.stopped = false;
    this.seq = null;
    this.hb = null;
    this.handlers = [];
    this.botId = null;
    this.queue = Promise.resolve();
    this.threads = new Map(); // !ai ticket -> Promise<thread id | null>
  }

  async init() {
    // own handlers only: 'chat'/'join' are shared with other plugins
    const on = (e, fn) => {
      const h = (...a) =>
        Promise.resolve()
          .then(() => fn.apply(this, a))
          .catch(err => (note('handlerError', `${e}: ${err?.message ?? err}`), console.error('[discord]', e, err?.message ?? err)));
      this.omegga.on(e, h);
      this.handlers.push([e, h]);
    };
    on('chat', this.onChat);
    // broadcasts (!ai, [claude], plugins) never fire 'chat': pick them out of the log; skip player chat and our own [Discord] echo
    on('line', l => {
      const m = /LogChat: (?!\[SenderId:|\[Discord\])(.+)$/.exec(l);
      if (!m) return;
      const t = unescape(m[1]).trim();
      const tag = /^\[([^\]]+)\](?:\[[^\]]*\])*:?\s*(.*)$/.exec(t);
      if (tag && /^still .*\.\.\. \d+s$/.test(tag[2])) return; // !ai "still thinking... 15s" heartbeat
      // !ai ticket start: post it, then open a thread on it for that ticket's progress + thinking
      const start = /^\[AI\] Ticket #(\d+) \((.+?)\) - working on it now/.exec(t);
      if (start) {
        const msg = this.send(tag[1], mdSafe(tag[2]));
        this.threads.set(start[1], msg.then(m => m?.id && this.makeThread(m.id, `#${start[1]} ${start[2]}`)));
        if (this.threads.size > 50) this.threads.delete(this.threads.keys().next().value);
        return msg;
      }
      const sub = /^\[AI\]\[#(\d+)\]/.exec(t);
      // progress lines ("Built 46 bricks", "done in") go in the thread; replies ("[AI][#n]: text") stay in the channel
      if (sub && this.threads.has(sub[1]) && !/^\[AI\]\[#\d+\]:/.test(t)) return this.send(tag[1], mdSafe(tag[2]), this.threads.get(sub[1]));
      return tag ? this.send(tag[1], mdSafe(tag[2])) : this.send(null, mdSafe(t));
    });
    this.tailThinking();
    for (const e of ['chatcmd:discord', 'chatcmd:Discord', 'cmd:discord']) on(e, name => this.omegga.whisper(name, '<color="9cf">Discord: <link="https://discord.gg/Eu4qtXcGnR">https://discord.gg/Eu4qtXcGnR</></>'));
    on('join', p => {
      note('lastJoin', `${p?.name} ${new Date().toISOString()}`);
      if (this.config.joins !== false) return this.send(null, `**${mdSafe(p?.name ?? p?.displayName)}** joined the server`);
    });
    on('leave', p => this.config.joins !== false && this.send(null, `**${mdSafe(p.name)}** left the server`));
    if (!this.config.token || !this.config.channel) note('state', 'no token/channel');
    else {
      note('state', 'connecting');
      this.connect();
    }
    return { registeredCommands: ['discord'] };
  }

  async stop() {
    this.stopped = true;
    for (const [e, h] of this.handlers) this.omegga.off(e, h);
    this.handlers = [];
    clearInterval(this.hb);
    clearInterval(this.tail);
    try {
      this.ws?.close(1000);
    } catch {}
  }

  // ---------- game -> discord ----------
  onChat(name, message) {
    const text = unescape(message);
    if (this.config['skip-commands'] && /^[!/]/.test(text)) return;
    return this.send(name, mdSafe(text));
  }

  // thread: optional Promise<thread id>; a null thread drops the message (never spill into the channel)
  send(name, content, thread) {
    content = String(content).slice(0, 1900);
    if (!content.trim()) return Promise.resolve();
    // one at a time: keeps order, respects rate limits
    this.queue = this.queue
      .then(async () => {
        const tid = thread && (await thread);
        if (thread && !tid) return;
        return this.post(name, content, tid);
      })
      .catch(err => console.error('[discord] send', err?.message ?? err));
    return this.queue;
  }

  async makeThread(msgId, name) {
    if (!this.config.token || !this.config.channel) return null;
    const res = await fetch(`${API}/channels/${this.config.channel}/messages/${msgId}/threads`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bot ${this.config.token}` },
      body: JSON.stringify({ name: name.slice(0, 100), auto_archive_duration: 60 }),
    });
    if (!res.ok) return note('threadError', `${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`), null;
    return (await res.json()).id;
  }

  // chatbot logs every thought as "<iso> think  #<ticket> <name>: <text>" (newlines as " | "): post them in the ticket's thread
  tailThinking() {
    const file = require('path').join(__dirname, '..', 'chatbot', 'logs', 'chatbot.log');
    let pos = null;
    let rest = '';
    this.tail = setInterval(() => {
      let size;
      try {
        size = fs.statSync(file).size;
      } catch {
        return;
      }
      if (pos === null || size < pos) pos = pos === null ? size : 0; // start at the end; rotated -> from the top
      if (size === pos) return;
      const fd = fs.openSync(file, 'r');
      const buf = Buffer.alloc(Math.min(size - pos, 1 << 20));
      fs.readSync(fd, buf, 0, buf.length, pos);
      fs.closeSync(fd);
      pos += buf.length;
      const lines = (rest + buf.toString('utf8')).split('\n');
      rest = lines.pop();
      for (const l of lines) {
        const m = /^\S+ think\s+#(\d+) [^:]*: (.*)$/.exec(l);
        if (!m || !this.threads.has(m[1])) continue;
        const text = m[2].replace(/ \| /g, '\n');
        // 1900-char pieces, at most 4 per thought
        for (let i = 0; i < Math.min(text.length, 4 * 1900); i += 1900) this.send('AI thinking', mdSafe(text.slice(i, i + 1900)), this.threads.get(m[1]));
      }
    }, 1000);
  }

  async post(name, content, thread, tries = 0) {
    const hook = this.config.webhook;
    let res;
    if (hook) {
      const username = name ? `${String(name).slice(0, 70)}` : 'Server';
      res = await fetch(`${hook}${hook.includes('?') ? '&' : '?'}wait=true${thread ? `&thread_id=${thread}` : ''}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // webhook names may not contain "discord"/"clyde"
        body: JSON.stringify({ content, username: username.replace(/discord|clyde/gi, '_') || 'Player', allowed_mentions: { parse: [] }, flags: SILENT }),
      });
    } else if (this.config.token && this.config.channel) {
      if (name) content = `**${mdSafe(name)}**: ${content}`;
      res = await fetch(`${API}/channels/${thread || this.config.channel}/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bot ${this.config.token}` },
        body: JSON.stringify({ content, allowed_mentions: { parse: [] }, flags: SILENT }),
      });
    } else return;
    if (res.status === 429 && tries < 5) {
      const j = await res.json().catch(() => ({}));
      await sleep(Math.ceil((j.retry_after ?? 1) * 1000));
      return this.post(name, content, thread, tries + 1);
    }
    if (!res.ok) return note('postError', `${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`);
    note('lastToDiscord', content.slice(0, 80));
    return res.json().catch(() => null);
  }

  // ---------- discord -> game ----------
  connect() {
    if (this.stopped) return;
    const ws = new WebSocket('wss://gateway.discord.gg/?v=10&encoding=json');
    this.ws = ws;
    ws.onmessage = ev => {
      let p;
      try {
        p = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (p.s != null) this.seq = p.s;
      if (p.op === 10) {
        clearInterval(this.hb);
        const beat = () => ws.readyState === 1 && ws.send(JSON.stringify({ op: 1, d: this.seq }));
        this.hb = setInterval(beat, p.d.heartbeat_interval);
        ws.send(
          JSON.stringify({
            op: 2,
            d: {
              token: this.config.token,
              intents: (1 << 9) | (1 << 15), // GUILD_MESSAGES | MESSAGE_CONTENT
              properties: { os: 'linux', browser: 'omegga-discord', device: 'omegga-discord' },
            },
          })
        );
      } else if (p.op === 1) ws.send(JSON.stringify({ op: 1, d: this.seq }));
      else if (p.op === 7 || p.op === 9) ws.close(4900);
      else if (p.op === 0 && p.t === 'READY') {
        this.botId = p.d.user.id;
        note('state', `connected as ${p.d.user.username}`);
        note('guilds', p.d.guilds?.length ?? 0);
      } else if (p.op === 0 && p.t === 'GUILD_CREATE') note('guild', p.d.name);
      else if (p.op === 0 && p.t === 'MESSAGE_CREATE') this.onDiscord(p.d);
    };
    ws.onclose = ev => {
      clearInterval(this.hb);
      if (this.stopped || this.ws !== ws) return;
      note('closed', ev.code);
      if (ev.code === 4004) return note('state', 'bad bot token');
      if (ev.code === 4014)
        return note('state', 'MESSAGE CONTENT INTENT is off');
      console.warn(`[discord] gateway closed ${ev.code}, reconnecting in 5 s`);
      setTimeout(() => this.connect(), 5000);
    };
    ws.onerror = () => {};
  }

  onDiscord(m) {
    if (m.channel_id !== String(this.config.channel)) return;
    if (m.author?.bot || m.webhook_id || m.author?.id === this.botId) return;
    const name = m.member?.nick || m.author?.global_name || m.author?.username || '?';
    let text = String(m.content ?? '');
    for (const u of m.mentions ?? []) {
      const n = u.member?.nick || u.global_name || u.username;
      text = text.replace(new RegExp(`<@!?${u.id}>`, 'g'), `@${n}`);
    }
    text = text
      .replace(/<a?(:\w+:)\d+>/g, '$1')
      .replace(/<#\d+>/g, '#channel')
      .replace(/<@&\d+>/g, '@role')
      .replace(/\s*\n\s*/g, ' ')
      .trim();
    const extra = (m.attachments ?? []).map(a => `[${a.content_type?.split('/')[0] || 'file'}]`);
    if (m.sticker_items?.length) extra.push('[sticker]');
    text = [text, ...extra].filter(Boolean).join(' ');
    if (!text) return;
    const ref = m.referenced_message?.author;
    if (ref) text = `(to ${ref.global_name || ref.username}) ${text}`;
    text = text.slice(0, 400);
    note('lastFromDiscord', `${name}: ${text.slice(0, 80)}`);
    this.omegga.writeln(`br.Chat.Broadcast <color="7289da"><b>[Discord]</> ${gameSafe(name)}</>: ${gameSafe(text)}`);
  }
};
