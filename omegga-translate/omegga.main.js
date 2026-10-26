// translate: universal translator for chat.
//
//   /tr <lang> <text>   say <text> in <lang> (broadcast; source language auto-detected)
//   /tr <text>          say it in English
//   /tr                 whisper you the last foreign chat line in your language
//   /tr on [lang]       auto mode: every chat line not in [lang] (default en) is whispered to you translated
//   /tr off             stop auto mode
//   /tr langs           list languages
//
// Real languages go through Google's keyless translate endpoint (~1 s, detects
// the source). Joke languages (pirate, klingon, uwu, ...) go through the FCC
// proxy on :8083 like !ai (slow: 30 s+). Unsafe (plain node) plugin.

const clean = s => String(s).replace(/[<>"\\;]/g, '');
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

// name -> Google code
const LANGS = {
  english: 'en', spanish: 'es', french: 'fr', german: 'de', italian: 'it', portuguese: 'pt', dutch: 'nl',
  russian: 'ru', ukrainian: 'uk', polish: 'pl', czech: 'cs', slovak: 'sk', hungarian: 'hu', romanian: 'ro',
  bulgarian: 'bg', serbian: 'sr', croatian: 'hr', greek: 'el', turkish: 'tr', arabic: 'ar', hebrew: 'iw',
  persian: 'fa', farsi: 'fa', hindi: 'hi', urdu: 'ur', bengali: 'bn', punjabi: 'pa', tamil: 'ta',
  japanese: 'ja', korean: 'ko', chinese: 'zh-CN', mandarin: 'zh-CN', cantonese: 'zh-TW', taiwanese: 'zh-TW',
  vietnamese: 'vi', thai: 'th', indonesian: 'id', malay: 'ms', filipino: 'tl', tagalog: 'tl',
  swedish: 'sv', norwegian: 'no', danish: 'da', finnish: 'fi', icelandic: 'is', estonian: 'et',
  latvian: 'lv', lithuanian: 'lt', irish: 'ga', welsh: 'cy', latin: 'la', esperanto: 'eo', swahili: 'sw',
  afrikaans: 'af', zulu: 'zu', yoruba: 'yo', hawaiian: 'haw', maori: 'mi', catalan: 'ca', basque: 'eu',
  albanian: 'sq', armenian: 'hy', georgian: 'ka', mongolian: 'mn', kazakh: 'kk', nepali: 'ne',
};
const CODES = new Set(Object.values(LANGS).map(c => c.toLowerCase()));
const NAME_OF = Object.fromEntries(Object.entries(LANGS).map(([n, c]) => [c.toLowerCase(), n]));
for (const c of ['zh', 'cn']) NAME_OF[c] = 'chinese';
// joke languages -> style brief for the LLM
const FUN = {
  pirate: 'a salty 1700s pirate',
  klingon: 'Klingon (tlhIngan Hol, romanized)',
  uwu: 'uwu-speak (owo, w for r/l, stutters, *nuzzles*)',
  shakespeare: 'Shakespearean Early Modern English',
  yoda: 'Yoda (object-subject-verb word order)',
  caveman: 'a caveman (short grunted words, no grammar)',
  boomer: 'a confused boomer writing on Facebook (ALL CAPS bits, ellipses...)',
  zoomer: 'zoomer slang (no cap, fr fr, bussin)',
  medieval: 'a pompous medieval herald',
  emoji: 'emoji only',
  morse: 'Morse code (dots and dashes, / between words)',
  leet: '1337 speak',
  corporate: 'soulless corporate email jargon',
  kol: 'Kingdom of Loathing narrator style (dry, absurd, punny)',
  elvish: 'Tolkien Sindarin (romanized)',
  minion: 'Minionese (banana, bello, poopaye)',
  gibberish: 'confident nonsense words',
};

const ALIAS = { jp: 'ja', kr: 'ko', cn: 'zh-CN', zh: 'zh-CN', he: 'iw', ua: 'uk', br: 'pt', se: 'sv', dk: 'da', gr: 'el' };

/** 'Spanish' / 'es' / 'pirate' -> { code, name, fun } or null */
function parseLang(word) {
  const w = String(word ?? '').toLowerCase().replace(/^[@:]|[:,]$/g, '');
  if (!w) return null;
  if (FUN[w]) return { code: w, name: w, fun: FUN[w] };
  if (LANGS[w]) return { code: LANGS[w], name: w };
  const code = ALIAS[w] ?? w;
  if (CODES.has(code.toLowerCase())) {
    const real = Object.values(LANGS).find(c => c.toLowerCase() === code.toLowerCase());
    return { code: real, name: NAME_OF[real.toLowerCase()] ?? real };
  }
  return null;
}

const base = c => String(c).toLowerCase().split('-')[0].replace(/^iw$/, 'he');

module.exports = class Translate {
  constructor(omegga, config, store) {
    this.omegga = omegga;
    this.config = config;
    this.store = store;
    this.handlers = [];
    this.auto = new Map(); // player name -> lang code
    this.last = null; // { name, text }
  }

  async init() {
    for (const [n, c] of Object.entries((await this.store.get('auto')) ?? {})) this.auto.set(n, c);
    const on = (e, fn) => {
      const h = (...a) =>
        Promise.resolve()
          .then(() => fn.apply(this, a))
          .catch(err => {
            console.error('[translate]', e, err?.message ?? err);
            if (e.startsWith('cmd') && a[0]) this.whisper(a[0], `<color="f55">${clean(String(err.message ?? err).slice(0, 160))}</>`);
          });
      this.omegga.on(e, h);
      this.handlers.push([e, h]);
    };
    for (const e of ['cmd:tr', 'chatcmd:tr', 'cmd:translate', 'chatcmd:translate']) on(e, (name, ...args) => this.command(name, args.join(' ').trim()));
    on('chat', this.onChat);
    return { registeredCommands: ['tr', 'translate'] };
  }

  async stop() {
    for (const [e, h] of this.handlers) this.omegga.off(e, h);
    this.handlers = [];
  }

  whisper(name, msg) {
    this.omegga.writeln(`br.Chat.Whisper "${clean(name)}" ${msg}`);
  }

  tag(text) {
    return `<color="7fd4ff">[TR]</> ${text}`;
  }

  async saveAuto() {
    await this.store.set('auto', Object.fromEntries(this.auto));
  }

  async command(name, arg) {
    const words = arg.split(/\s+/).filter(Boolean);
    const sub = (words[0] ?? '').toLowerCase();

    if (!words.length) {
      if (!this.last) return this.whisper(name, this.tag('Nothing has been said yet. The silence translates as "silence".'));
      const lang = parseLang(this.auto.get(name) ?? 'en');
      const r = await this.translate(this.last.text, lang, name);
      return this.whisper(name, this.tag(`<b>${gameSafe(this.last.name)}</> (${r.from}): ${gameSafe(r.text)}`));
    }
    if (sub === 'langs' || sub === 'languages' || sub === 'help') {
      this.whisper(name, this.tag('/tr <lang> <text> | /tr <text> (to English) | /tr (last line, to you) | /tr on [lang] | /tr off'));
      this.whisper(name, this.tag(`Languages: ${Object.keys(LANGS).join(' ')} (or codes: es fr ja ...)`));
      return this.whisper(name, this.tag(`Questionable dialects (slow): ${Object.keys(FUN).join(' ')}`));
    }
    if (sub === 'off') {
      this.auto.delete(name);
      await this.saveAuto();
      return this.whisper(name, this.tag('Auto-translate off. You are once again at the mercy of foreigners.'));
    }
    if (sub === 'on' || sub === 'auto') {
      const lang = words[1] ? parseLang(words[1]) : parseLang('en');
      if (!lang) return this.whisper(name, this.tag(`Unknown language "${gameSafe(words[1])}". /tr langs`));
      if (lang.fun) return this.whisper(name, this.tag('Auto mode only speaks real languages. The pirates unionised.'));
      this.auto.set(name, lang.code);
      await this.saveAuto();
      return this.whisper(name, this.tag(`Auto-translate on: chat not in ${lang.name} will be whispered to you in ${lang.name}. /tr off to stop.`));
    }

    let lang = parseLang(words[0]);
    let text = words.slice(lang ? 1 : 0).join(' ');
    if (!lang) lang = parseLang('en');
    if (!text) return this.whisper(name, this.tag(`Say what in ${lang.name}? /tr ${lang.name} hello`));
    if (text.length > 400) text = text.slice(0, 400);
    if (lang.fun) this.whisper(name, this.tag(`Consulting the ${lang.name} scholars...`));
    const r = await this.translate(text, lang, name);
    this.omegga.broadcast(`<b>${gameSafe(name)}</> <color="7fd4ff">[${gameSafe(lang.name)}]</>: ${gameSafe(r.text)}`);
  }

  async onChat(name, message) {
    const text = unescape(message).trim();
    if (!text || /^[!/]/.test(text)) return;
    this.last = { name, text };
    // one translation per target language, whispered to each subscriber
    const byLang = new Map();
    for (const [who, code] of this.auto) {
      if (who === name) continue;
      if (!this.omegga.getPlayer?.(who)) continue;
      if (!byLang.has(code)) byLang.set(code, []);
      byLang.get(code).push(who);
    }
    await Promise.all(
      [...byLang].map(async ([code, who]) => {
        const r = await this.google(text, code);
        if (base(r.src) === base(code) || r.text.trim().toLowerCase() === text.toLowerCase()) return;
        for (const w of who) this.whisper(w, this.tag(`<b>${gameSafe(name)}</> (${gameSafe(r.from)}): ${gameSafe(r.text)}`));
      })
    );
  }

  async translate(text, lang) {
    if (lang.fun) return { text: await this.llm(text, lang), from: 'auto' };
    return this.google(text, lang.code);
  }

  // two keyless Google endpoints: when one rate-limits (429), try the other
  async google(text, code) {
    const q = `sl=auto&tl=${encodeURIComponent(code)}&q=${encodeURIComponent(text)}`;
    let out, src, err;
    try {
      const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&${q}`, { signal: AbortSignal.timeout(8_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      out = (j?.[0] ?? []).map(s => s?.[0] ?? '').join('');
      src = j?.[2];
    } catch (e) {
      err = e;
      try {
        const res = await fetch(`https://clients5.google.com/translate_a/t?client=dict-chrome-ex&${q}`, { signal: AbortSignal.timeout(8_000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = await res.json();
        [out, src] = Array.isArray(j?.[0]) ? j[0] : [j?.[0], j?.src];
      } catch (e2) {
        throw new Error(`the translator is napping (${err.message}, ${e2.message})`);
      }
    }
    src = src ?? '?';
    return { text: out || text, src, from: NAME_OF[String(src).toLowerCase()] ?? NAME_OF[base(src)] ?? src };
  }

  async llm(text, lang) {
    const baseURL = this.config?.['base-url'] || 'http://127.0.0.1:8083';
    const res = await fetch(`${baseURL}/v1/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': this.config?.['proxy-token'] || 'freecc', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: this.config?.model || 'claude-opus-5',
        max_tokens: 2000,
        system: `You are a translator in a video game chat. Rewrite the user's message as ${lang.fun}. Keep the meaning. Output only the rewritten message on one line, no quotes, no notes.`,
        messages: [{ role: 'user', content: text }],
      }),
      signal: AbortSignal.timeout(120_000),
    });
    const j = await res.json();
    if (!res.ok || j?.type === 'error') throw new Error(`the ${lang.name} scholars are out (${String(j?.error?.message ?? res.status).slice(0, 60)})`);
    const out = (j.content ?? []).filter(b => b.type === 'text').map(b => b.text).join(' ').replace(/\s*\n+\s*/g, ' ').trim();
    if (!out) throw new Error(`the ${lang.name} scholars stared blankly. Try again.`);
    return out.slice(0, 500);
  }
};
