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
  }

  async init() {
    // own handlers only: 'chat'/'join' are shared with other plugins
    const on = (e, fn) => {
      const h = (...a) =>
        Promise.resolve()
          .then(() => fn.apply(this, a))
          .catch(err => console.error('[discord]', e, err?.message ?? err));
      this.omegga.on(e, h);
      this.handlers.push([e, h]);
    };
    on('chat', this.onChat);
    on('join', p => this.config.joins !== false && this.send(null, `**${mdSafe(p.name)}** joined the server`));
    on('leave', p => this.config.joins !== false && this.send(null, `**${mdSafe(p.name)}** left the server`));
    if (!this.config.token || !this.config.channel) note('state', 'no token/channel');
    else {
      note('state', 'connecting');
      this.connect();
    }
    return { registeredCommands: [] };
  }

  async stop() {
    this.stopped = true;
    for (const [e, h] of this.handlers) this.omegga.off(e, h);
    this.handlers = [];
    clearInterval(this.hb);
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

  send(name, content) {
    content = String(content).slice(0, 1900);
    if (!content.trim()) return;
    // one at a time: keeps order, respects rate limits
    this.queue = this.queue
      .then(() => this.post(name, content))
      .catch(err => console.error('[discord] send', err?.message ?? err));
    return this.queue;
  }

  async post(name, content, tries = 0) {
    const hook = this.config.webhook;
    let res;
    if (hook) {
      const username = name ? `${String(name).slice(0, 70)}` : 'Server';
      res = await fetch(hook, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // webhook names may not contain "discord"/"clyde"
        body: JSON.stringify({ content, username: username.replace(/discord|clyde/gi, '_') || 'Player', allowed_mentions: { parse: [] } }),
      });
    } else if (this.config.token && this.config.channel) {
      if (name) content = `**${mdSafe(name)}**: ${content}`;
      res = await fetch(`${API}/channels/${this.config.channel}/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bot ${this.config.token}` },
        body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
      });
    } else return;
    if (res.status === 429 && tries < 5) {
      const j = await res.json().catch(() => ({}));
      await sleep(Math.ceil((j.retry_after ?? 1) * 1000));
      return this.post(name, content, tries + 1);
    }
    if (!res.ok) note('postError', `${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`);
    else note('lastToDiscord', content.slice(0, 80));
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
