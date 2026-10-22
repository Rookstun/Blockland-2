// /stream ANY PAGE (2026-10-22, owner: "!stream should get any video from any source as long as it makes it
// to the page"): the last resort after yt-dlp and plain ffmpeg. A headless Chrome opens the page, presses
// play everywhere (iframes too) and
//   1. SNIFFS: every media request the page makes (HLS / DASH manifests, media files, by URL or
//      content-type) is a candidate; the longest one ffprobe can open wins (pre-roll ads are short).
//      The page's referer/origin/cookies/user-agent go along to ffmpeg.
//   2. CAPTURES: nothing sniffable (MSE blobs, segment soup) but a <video> is playing = record that
//      element (captureStream + MediaRecorder, pulled out by polling) into ffmpeg -> a local live HLS
//      playlist the live /stream path records chunks off. DRM (EME) video stays black: not touched.
// The browser can't reach private network addresses (every request is checked) and popups are closed.
// Install (server, plugins/media/browser): npm i puppeteer-core; npx @puppeteer/browsers install chrome-headless-shell@stable --path chrome
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import dns from 'node:dns/promises';
import { spawn, execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36';
const AD_HOST = /(^|\.)(doubleclick\.net|googlesyndication\.com|googleadservices\.com|imasdk\.googleapis\.com|adnxs\.com|adsrvr\.org|popads\.net|popcash\.net|propellerads\.com|exoclick\.com|juicyads\.com|adsterra\.com|taboola\.com|outbrain\.com|moatads\.com|amazon-adsystem\.com)$/i;
const MEDIA_EXT = /\.(m3u8|mpd|mp4|m4v|webm|mkv|mov|flv|ogv)$/i;
const SEGMENT = /\.(ts|m4s|aac|m4a|vtt|key)$|\/seg[-_]?\d|[?&](range|bytes)=/i;
const PLAY_SELECTORS = ['.vjs-big-play-button', '.jw-icon-display', '.jw-display-icon-container', '.plyr__control--overlaid', '.ytp-large-play-button',
  '.fp-play', '.mejs__overlay-button', '.play-button', '.playbutton', '.btn-play', '#play', '.play', '[aria-label*="play" i]', '[title*="play" i]', 'button[class*="play" i]', 'div[class*="play" i]'];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const run = (cmd, args, timeout = 30_000) => new Promise((res, rej) => execFile(cmd, args, { timeout, maxBuffer: 8 << 20 }, (e, out) => (e ? rej(e) : res(String(out)))));

function chromePath() {
  const base = path.join(HERE, 'chrome', 'chrome-headless-shell');
  const vers = fs.existsSync(base) ? fs.readdirSync(base).sort().reverse() : [];
  for (const v of vers) {
    const p = path.join(base, v, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
    if (fs.existsSync(p)) return p;
  }
  throw new Error('no headless Chrome installed (plugins/media/browser/chrome)');
}

function isPrivate(ip) {
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v.startsWith('::ffff:')) return isPrivate(v.slice(7));
    return v === '::' || v === '::1' || /^f[cd]/.test(v) || /^fe[89ab]/.test(v);
  }
  const [a, b] = ip.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b < 128) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b < 32) || (a === 192 && b === 168) || a >= 224;
}
const hostOk = new Map();
async function publicHost(host) {
  host = host.replace(/^\[|\]$/g, '');
  if (!hostOk.has(host)) {
    hostOk.set(host, (async () => {
      if (host === 'localhost' || host.endsWith('.localhost')) return false;
      const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true }).catch(() => []);
      return addrs.length > 0 && !addrs.some(a => isPrivate(a.address));
    })());
    if (hostOk.size > 2000) hostOk.delete(hostOk.keys().next().value);
  }
  return hostOk.get(host);
}

const kindOf = (url, type = '') => {
  let p = '';
  try { p = new URL(url).pathname; } catch { return null; }
  if (/mpegurl/i.test(type) || /\.m3u8$/i.test(p)) return 'hls';
  if (/dash\+xml/i.test(type) || /\.mpd$/i.test(p)) return 'dash';
  if (SEGMENT.test(p) || /mp2t|vtt|text|json|image/i.test(type)) return null;
  if (/^video\//i.test(type) || MEDIA_EXT.test(p)) return 'file';
  return null;
};

/** ffmpeg input options for a sniffed URL (the page's headers). */
const ffInFor = c => {
  const h = Object.entries(c.headers).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}\r\n`).join('');
  return ['-protocol_whitelist', 'http,https,tcp,tls,crypto', '-rw_timeout', '20000000', ...(h ? ['-headers', h] : [])];
};

async function launch() {
  const args = ['--autoplay-policy=no-user-gesture-required', '--disable-features=site-per-process,IsolateOrigins', '--disable-site-isolation-trials',
    '--disable-web-security', '--disable-gpu', '--no-first-run', '--window-size=1280,720', '--disable-dev-shm-usage'];
  const opts = { executablePath: chromePath(), headless: 'shell', defaultViewport: { width: 1280, height: 720 }, protocolTimeout: 30_000 };
  // sandboxed when the system allows it (Ubuntu's AppArmor userns rule usually doesn't)
  try { return await puppeteer.launch({ ...opts, args }); } catch { return puppeteer.launch({ ...opts, args: [...args, '--no-sandbox'] }); }
}

/** Presses play in every frame (videos unmuted, common player buttons clicked). */
async function pokePlay(page, clickPage) {
  for (const f of page.frames()) {
    await f.evaluate(sel => {
      for (const v of document.querySelectorAll('video,audio')) { v.muted = false; v.volume = 1; if (v.paused) v.play().catch(() => { v.muted = true; v.play().catch(() => {}); }); }
      for (const s of sel) for (const el of document.querySelectorAll(s)) {
        const r = el.getBoundingClientRect();
        if (r.width > 8 && r.height > 8 && getComputedStyle(el).visibility !== 'hidden') { try { el.click(); } catch {} break; }
      }
    }, PLAY_SELECTORS).catch(() => {});
  }
  if (clickPage) {
    // the biggest iframe / video on the page is usually the player
    const pt = await page.evaluate(() => {
      let best = null, area = 0;
      for (const el of document.querySelectorAll('video,iframe,object,embed')) {
        const r = el.getBoundingClientRect(), a = r.width * r.height;
        if (a > area) { area = a; best = [r.left + r.width / 2, r.top + r.height / 2]; }
      }
      return best ?? [640, 360];
    }).catch(() => [640, 360]);
    await page.mouse.click(pt[0], pt[1]).catch(() => {});
  }
}

/** The playing <video> in any frame: { frame, w, h } or null. */
async function playingVideo(page) {
  for (const f of page.frames()) {
    const v = await f.evaluate(() => {
      let best = null;
      for (const el of document.querySelectorAll('video')) {
        if (el.readyState >= 2 && !el.paused && el.videoWidth && (!best || el.videoWidth * el.videoHeight > best.w * best.h)) best = { w: el.videoWidth, h: el.videoHeight, t: el.currentTime, d: el.duration };
      }
      return best;
    }).catch(() => null);
    if (v) return { frame: f, ...v };
  }
  return null;
}

async function probe(c) {
  try {
    const j = JSON.parse(await run('ffprobe', ['-v', 'error', ...ffInFor(c), '-show_entries', 'format=duration:stream=codec_type', '-of', 'json', c.url], 20_000));
    if (!j.streams?.some(s => s.codec_type === 'video')) return null;
    return { ...c, duration: Number(j.format?.duration) || Infinity, audio: j.streams.some(s => s.codec_type === 'audio') };
  } catch { return null; }
}

/**
 * The page's video as a /stream source ({ v, a, duration, page, hls, live, close }), or throws.
 * opts: { tmp (dir for capture files), log, waitMs }
 */
export async function browserSource(href, { tmp, log = console.log, waitMs = 25_000, forceCapture = false } = {}) {
  const browser = await launch();
  let closed = false, ff = null, poll = null, page = null;
  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(poll);
    try { ff?.stdin.end(); } catch {}
    setTimeout(() => { try { ff?.kill('SIGKILL'); } catch {} }, 3000);
    browser.close().catch(() => {});
  };
  try {
    // popups (ad tabs) closed at once
    browser.on('targetcreated', async t => { if (t.type() === 'page' && t.opener()) { const p = await t.page().catch(() => null); if (p && p !== page) p.close().catch(() => {}); } });
    page = await browser.newPage();
    await page.setUserAgent(UA);
    await page.evaluateOnNewDocument(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false }); window.open = () => null; });
    const cands = new Map(); // url -> { url, kind, headers }
    const add = (url, kind, frameUrl) => {
      if (!kind || cands.has(url) || !/^https?:/i.test(url)) return;
      let origin = '';
      try { origin = new URL(frameUrl || href).origin; } catch {}
      cands.set(url, { url, kind, headers: { 'User-Agent': UA, Referer: frameUrl || href, Origin: origin } });
      log(`[media] browser: found ${kind} ${url.slice(0, 140)}`);
    };
    await page.setRequestInterception(true);
    page.on('request', async req => {
      try {
        const u = new URL(req.url());
        if (/^(data|blob|about|chrome):$/.test(u.protocol)) return req.continue();
        if (!/^https?:$/.test(u.protocol) || AD_HOST.test(u.hostname) || !(await publicHost(u.hostname))) return req.abort();
        if (['image', 'font'].includes(req.resourceType())) return req.abort(); // speed
        add(req.url(), kindOf(req.url()), req.frame()?.url());
        req.continue();
      } catch { req.continue().catch(() => {}); }
    });
    page.on('response', res => add(res.url(), kindOf(res.url(), res.headers()['content-type']), res.frame()?.url()));
    log(`[media] browser: opening ${href}`);
    await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(e => log(`[media] browser: page load ${e.message.slice(0, 80)}`));
    // poke play until a manifest turns up (files may be ads: keep looking a little longer)
    const t0 = Date.now();
    let firstAt = 0, clicks = 0, video = null;
    while (Date.now() - t0 < waitMs) {
      const click = clicks < 4 && Date.now() - t0 > 2500 * (clicks + 1);
      if (click) clicks++;
      await pokePlay(page, click);
      await sleep(1500);
      if (cands.size && !firstAt) firstAt = Date.now();
      const manifest = [...cands.values()].some(c => c.kind !== 'file');
      if (firstAt && Date.now() - firstAt > (manifest ? 2500 : 6000)) break;
      video = await playingVideo(page);
      if ((forceCapture || !cands.size) && video && Date.now() - t0 > 10_000) break; // blob player: go capture it
    }
    // sniffed: the longest candidate that opens (manifests first)
    if (cands.size && !forceCapture) {
      const cookies = await page.cookies(...new Set([...cands.keys()].slice(0, 20))).catch(() => []);
      const cookie = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      const list = [...cands.values()].map(c => ({ ...c, headers: { ...c.headers, ...(cookie ? { Cookie: cookie } : {}) } }))
        .sort((a, b) => (a.kind === 'file') - (b.kind === 'file')).slice(0, 8);
      const ok = (await Promise.all(list.map(probe))).filter(Boolean).sort((a, b) => b.duration - a.duration);
      if (ok.length) {
        const c = ok[0];
        log(`[media] browser: playing ${c.kind} ${c.url.slice(0, 140)} (${c.duration === Infinity ? 'live' : Math.round(c.duration) + ' s'}, ${ok.length}/${list.length} opened)`);
        close();
        const st = { url: c.url, size: 0, in: ffInFor(c) };
        const live = c.duration === Infinity;
        return { v: st, a: c.audio ? st : null, duration: c.duration, page: href, hls: true, live, close: () => {} };
      }
      log('[media] browser: no sniffed link opened in ffmpeg, trying a capture');
    }
    video ??= await playingVideo(page);
    if (!video) throw new Error('no video played on that page');
    return await capture(page, video, { tmp, log, close, setFf: p => (ff = p), setPoll: p => (poll = p), href });
  } catch (e) {
    close();
    throw e;
  }
}

/** Records the playing <video> into a local live HLS playlist (real time, picture + sound). */
async function capture(page, video, { tmp, log, close, setFf, setPoll, href }) {
  const dir = path.join(tmp, `cap_${Date.now()}_${Math.floor(Math.random() * 1e6)}`);
  fs.mkdirSync(dir, { recursive: true });
  const m3u8 = path.join(dir, 'live.m3u8');
  const ff = spawn('ffmpeg', ['-v', 'error', '-fflags', '+genpts', '-f', 'webm', '-i', 'pipe:0', '-vf', 'scale=320:-2', '-r', '15', '-c:v', 'libx264', '-preset', 'veryfast',
    '-g', '30', '-c:a', 'aac', '-ar', '44100', '-f', 'hls', '-hls_time', '2', '-hls_list_size', '8', '-hls_flags', 'delete_segments+omit_endlist', m3u8], { stdio: ['pipe', 'ignore', 'pipe'] });
  setFf(ff);
  ff.stderr.on('data', d => log(`[media] browser capture ffmpeg: ${String(d).trim().slice(0, 200)}`));
  ff.stdin.on('error', () => {});
  const started = await video.frame.evaluate(() => {
    let best = null;
    for (const el of document.querySelectorAll('video')) if (el.readyState >= 2 && !el.paused && (!best || el.videoWidth > best.videoWidth)) best = el;
    if (!best) return 'gone';
    try {
      const s = best.captureStream ? best.captureStream() : best.mozCaptureStream();
      const type = ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t));
      const rec = new MediaRecorder(s, { mimeType: type, videoBitsPerSecond: 1_500_000 });
      window.__capQ = [];
      rec.ondataavailable = async e => { if (e.data.size) window.__capQ.push(new Uint8Array(await e.data.arrayBuffer())); };
      rec.start(500);
      window.__capRec = rec;
      return 'ok';
    } catch (e) { return String(e.message || e); }
  }).catch(e => String(e.message));
  if (started !== 'ok') throw new Error(`can't record that video (${started})`);
  log(`[media] browser: capturing a ${video.w}x${video.h} <video> on ${href}`);
  // pull the recorder's pieces out (base64 per poll; ~200 KB/s)
  let busy = false, lastData = Date.now();
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      const b64 = await video.frame.evaluate(() => {
        const q = window.__capQ ?? [];
        window.__capQ = [];
        if (!q.length) return '';
        const n = q.reduce((s, a) => s + a.length, 0), all = new Uint8Array(n);
        let o = 0;
        for (const a of q) { all.set(a, o); o += a.length; }
        let s = '';
        for (let i = 0; i < all.length; i += 0x8000) s += String.fromCharCode.apply(null, all.subarray(i, i + 0x8000));
        return btoa(s);
      });
      if (b64) { ff.stdin.write(Buffer.from(b64, 'base64')); lastData = Date.now(); }
      else if (Date.now() - lastData > 20_000) { log('[media] browser capture: the video stopped'); close(); }
      // keep it playing (players pause on blur / ads end)
      if (Date.now() % 5000 < 500) await video.frame.evaluate(() => { for (const v of document.querySelectorAll('video')) if (v.paused && !v.ended) v.play().catch(() => {}); }).catch(() => {});
    } catch (e) { log(`[media] browser capture ended (${String(e.message).slice(0, 80)})`); close(); }
    busy = false;
  }, 500);
  setPoll(timer);
  // first segments
  const t0 = Date.now();
  while (Date.now() - t0 < 20_000) {
    if (fs.existsSync(m3u8) && (fs.readFileSync(m3u8, 'utf8').match(/#EXTINF/g) || []).length >= 2) break;
    if (ff.exitCode !== null) throw new Error('the capture encoder quit');
    await sleep(300);
  }
  if (!fs.existsSync(m3u8)) throw new Error('the capture made no picture');
  const audio = /audio/.test(await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', m3u8]).catch(() => ''));
  const st = { url: m3u8, size: 0, in: ['-protocol_whitelist', 'file,crypto', '-live_start_index', '-2'] };
  return { v: st, a: audio ? st : null, duration: Infinity, page: href, hls: true, live: true, capture: true,
    close: () => { close(); setTimeout(() => fs.rmSync(dir, { recursive: true, force: true }), 5000); } };
}
