// Brickgen front end: schema-driven settings editor (misode style), synced
// JSON, instant terrain preview (worker.mjs / terrain.mjs) and server previews.
import { island, CELL, VZ, TOWN_CELLS } from './terrain.mjs';
import { INSTANT, MARKER, groupOf, validate, pipelineCategories, PHASES, STAGES } from './groups.mjs';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const clone = v => JSON.parse(JSON.stringify(v));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const S = {
  seed: 487675143, scale: 2, params: {}, schema: {}, group: 'pipeline', search: '',
  src: 'instant', layer: { instant: 'terrain', server: 'surface' },
  ovl: { shade: true, spine: true, sites: true, grid: false },
  view: { cx: 0, cy: 0, zoom: 1 }, fitted: false,
  terr: null, server: { sites: null, full: null }, job: null, build: null,
  codeTab: 'group', log: [],
};
const hist = [], fut = [];

// ------------------------------------------------------------------ icons --
const ICON = {
  globe: '<circle cx="8" cy="8" r="6.5"/><path d="M1.5 8h13M8 1.5c2.5 3 2.5 10 0 13M8 1.5c-2.5 3-2.5 10 0 13"/>',
  spline: '<path d="M2 13C5 13 4 3 8 3s3 10 6 10"/><circle cx="2" cy="13" r="1.3"/><circle cx="8" cy="3" r="1.3"/><circle cx="14" cy="13" r="1.3"/>',
  wave: '<path d="M1 10l3-5 3 4 2-2 3 4 3-6"/><path d="M1 14h14"/>',
  slope: '<path d="M1 14h14V4z"/>',
  river: '<path d="M4 1c4 3-3 5 1 8s-2 5 1 6M10 1c4 3-3 5 1 8s-2 5 1 6"/>',
  fan: '<path d="M8 2v6M8 8l-6 6M8 8l6 6M8 8l-2.5 6.5M8 8l2.5 6.5"/>',
  cove: '<path d="M1 6c3 0 3 7 7 7s4-7 7-7"/><path d="M5 3v3M11 2v4"/>',
  drop: '<path d="M8 1.5C5 6 3.5 8 3.5 10.2a4.5 4.5 0 009 0C12.5 8 11 6 8 1.5z"/>',
  sun: '<circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3"/>',
  snow: '<path d="M8 1v14M2 4.5l12 7M2 11.5l12-7"/>',
  fire: '<path d="M8 15c-3 0-5-2-5-5 0-3 3-4 3-8 2 1 3 3 3 5 1-1 1-2 1-3 2 2 3 4 3 6 0 3-2 5-5 5z"/>',
  leaf: '<path d="M2 14C2 6 6 2 14 2c0 8-4 12-12 12zM2 14l7-7"/>',
  axe: '<path d="M3 14L11 6M9 2c3 0 5 2 5 5l-3-1-2-2z"/>',
  skull: '<path d="M8 1.5a5.5 5.5 0 00-3 10.1V14h6v-2.4A5.5 5.5 0 008 1.5z"/><circle cx="6" cy="7" r="1"/><circle cx="10" cy="7" r="1"/>',
  house: '<path d="M2 8l6-6 6 6M4 7v7h8V7"/><path d="M7 14v-4h2v4"/>',
  ruin: '<path d="M2 14h12M3 14V6l2-1v9M7 14V8M11 14V4l2 1v9"/>',
  tent: '<path d="M1 14L8 2l7 12zM8 14V8"/>',
  tower: '<path d="M4 14V5h8v9M3 5V2h2v1h2V2h2v1h2V2h2v3M7 14v-3h2v3"/>',
  ring: '<circle cx="8" cy="8" r="5.5" stroke-dasharray="2 2"/><circle cx="8" cy="8" r="1.5"/>',
  henge: '<path d="M2 14V5M6 14V5M10 14V5M14 14V5M1 5h6M9 5h6"/>',
  temple: '<path d="M1 5l7-3 7 3zM2 14h12M3 6v8M6.3 6v8M9.7 6v8M13 6v8"/>',
  sword: '<path d="M13 1L6 8M4 8l4 4M5 11l-3 3M13 1h2v2L8 10"/>',
  door: '<path d="M3 15V5a5 5 0 0110 0v10zM8 15V8"/>',
  pin: '<path d="M8 15s5-5 5-8.5a5 5 0 00-10 0C3 10 8 15 8 15z"/><circle cx="8" cy="6.5" r="1.7"/>',
  flow: '<rect x="1" y="1.5" width="5" height="3.5" rx="1"/><rect x="10" y="6.25" width="5" height="3.5" rx="1"/><rect x="1" y="11" width="5" height="3.5" rx="1"/><path d="M6 3.25h2v9.5H6M8 8h2"/>',
  cave: '<path d="M1 14c0-7 3-11 7-11s7 4 7 11M5 14c0-3 1.5-5 3-5s3 2 3 5"/>',
  road: '<path d="M5 1L2 15M11 1l3 14M8 2v2M8 7v2M8 12v2"/>',
  flag: '<path d="M3 15V1M3 2h9l-2 3 2 3H3"/>',
  sign: '<path d="M8 15V1M3 3h9l2 2-2 2H3zM13 8H4L2 10l2 2h9z"/>',
  barrel: '<ellipse cx="8" cy="3" rx="5" ry="1.8"/><path d="M3 3v10c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V3M3 8c0 1 2.2 1.8 5 1.8S13 9 13 8"/>',
  dot: '<circle cx="8" cy="8" r="3"/>',
};
const icon = n => `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${ICON[n] || ICON.dot}</svg>`;

// --------------------------------------------------------------- settings --
const has = k => Object.prototype.hasOwnProperty.call(S.params, k);
const get = k => (has(k) ? S.params[k] : S.schema[k]?.def);
const isMod = k => has(k) && !eq(S.params[k], S.schema[k]?.def);
const settingsKey = () => JSON.stringify([S.seed, S.scale, S.params]);
let lastCommit = { label: null, t: 0 };
function commit(label, fn, { render = true } = {}) {
  const snap = { seed: S.seed, scale: S.scale, params: clone(S.params) };
  const now = Date.now();
  if (!(label && label === lastCommit.label && now - lastCommit.t < 900)) { hist.push(snap); if (hist.length > 200) hist.shift(); fut.length = 0; }
  lastCommit = { label, t: now };
  fn();
  // overrides equal to the default are not overrides
  for (const k of Object.keys(S.params)) if (S.schema[k] && eq(S.params[k], S.schema[k].def)) delete S.params[k];
  changed(render);
}
function setParam(k, v, opts) { commit('set:' + k, () => { S.params[k] = v; }, opts); }
function restore(snap) {
  const scaleChanged = snap.scale !== S.scale;
  S.seed = snap.seed; S.scale = snap.scale; S.params = clone(snap.params);
  if (scaleChanged) loadSchema().then(() => changed(true)); else changed(true);
}
function undo() { if (!hist.length) return; fut.push({ seed: S.seed, scale: S.scale, params: clone(S.params) }); restore(hist.pop()); lastCommit = { label: null, t: 0 }; }
function redo() { if (!fut.length) return; hist.push({ seed: S.seed, scale: S.scale, params: clone(S.params) }); restore(fut.pop()); lastCommit = { label: null, t: 0 }; }

let changeT = null;
function changed(renderEditorToo) {
  $('#seed').value = S.seed;
  $('#scale').value = String(S.scale);
  $('#undo').disabled = !hist.length; $('#redo').disabled = !fut.length;
  renderNav();
  if (renderEditorToo) renderEditor(); else refreshRows();
  renderCode();
  markStale();
  requestInstant(drag?.kind === 'handle');
  clearTimeout(changeT);
  changeT = setTimeout(() => { history.replaceState(null, '', '#' + shareHash()); }, 400);
}

// ------------------------------------------------------------------ api io --
async function api(p, body) {
  const r = await fetch(p, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
}
async function loadSchema() { S.schema = await api(`/api/schema?scale=${S.scale}`); }

// -------------------------------------------------------------------- nav --
const PIPE = { id: 'pipeline', title: 'Pipeline', icon: 'flow', blurb: 'The order the world generates in, phase by phase (like the chunk statuses in Minecraft and feature steps). mapgen enforces it: each section calls stage(id) and a stage out of this order throws. Click a setting chip to edit what a stage reads.' };
function groupsList() {
  const cats = pipelineCategories().map(c => ({ ...c, groups: c.groups.filter(g => Object.keys(S.schema).some(k => groupOf(k) === g.id)) }));
  const known = new Set(cats.flatMap(c => c.groups.map(g => g.id)));
  const other = [...new Set(Object.keys(S.schema).map(groupOf))].filter(g => !known.has(g));
  if (other.length) cats.push({ name: 'Other', groups: other.map(id => ({ id, title: id, icon: 'dot', blurb: '' })) });
  return [{ name: 'Worldgen', groups: [PIPE] }, ...cats.filter(c => c.groups.length)];
}
const groupInfo = id => groupsList().flatMap(c => c.groups).find(g => g.id === id) || { id, title: id, icon: 'dot', blurb: '' };
const keysOf = id => Object.keys(S.schema).filter(k => groupOf(k) === id).sort((a, b) => S.schema[a].line - S.schema[b].line);
let errs = [];
function renderNav() {
  errs = validate(get);
  const bad = new Set(errs.flatMap(e => e.keys.map(groupOf)));
  $('#navlist').innerHTML = groupsList().map(c => `<div class="cat">${esc(c.name)}</div>` + c.groups.map(g => {
    const n = keysOf(g.id).filter(isMod).length;
    return `<div class="gi${g.id === S.group && !S.search ? ' on' : ''}" data-g="${g.id}">${icon(g.icon)}<span>${esc(g.title)}</span>${bad.has(g.id) ? '<span class="e" title="Has problems"></span>' : n ? `<span class="n">${n}</span>` : ''}</div>`;
  }).join('')).join('');
  const total = Object.keys(S.params).length;
  $('#modcount').textContent = total ? `${total} changed` : 'All defaults';
}
$('#navlist').addEventListener('click', e => {
  const g = e.target.closest('.gi');
  if (!g) return;
  S.group = g.dataset.g; S.search = ''; $('#search').value = '';
  renderNav(); renderEditor(); renderCode(); drawPreview();
});
$('#search').addEventListener('input', e => { S.search = e.target.value.trim().toLowerCase(); renderNav(); renderEditor(); });

// ----------------------------------------------------------------- editor --
const unitOf = note => (/voxels/.test(note) ? 'vox' : /units/.test(note) ? 'u' : /radians/.test(note) ? 'rad' : /bricks/.test(note) ? 'bricks' : /cells/.test(note) ? 'cells' : /studs?/.test(note) ? 'studs' : '');
const isBool = (k, s) => (s.def === 0 || s.def === 1) && (/\(0 = |0 = |1 = /.test(s.note) || /\.(on|oct|weirs|minecraft)$/.test(k));
const leaf = k => (k.includes('.') ? k.slice(k.indexOf('.') + 1) : k);
function rangeFor(k, s, v) {
  if (/\.t$/.test(k) || /progress|share|chance/.test(s.note) && Math.abs(s.def) <= 1) return [0, 1, 0.005];
  const d = Math.abs(s.def) || 1, int = Number.isInteger(s.def);
  let max = d * 3, min = s.def < 0 ? -d * 3 : 0;
  if (/\.off$/.test(k)) { min = -100; max = 100; }
  max = Math.max(max, Math.abs(v) * 1.25);
  if (v < min) min = v * 1.25;
  const step = int ? (max > 4000 ? 50 : max > 600 ? 5 : 1) : max > 20 ? 0.1 : max > 2 ? 0.01 : 0.001;
  return [min, int ? Math.ceil(max) : +max.toPrecision(3), step];
}
function tip(k) {
  const s = S.schema[k];
  return `${k}\ndefault: ${JSON.stringify(s.def)}${s.expr !== JSON.stringify(s.def) && !/^\[/.test(s.expr) ? `  (${s.expr})` : ''}\nmapgen.mjs:${s.line}  ·  ${INSTANT.test(k) ? 'instant preview' : s.stage + ' stage'}`;
}
function rowHtml(k) {
  const s = S.schema[k], v = get(k), u = unitOf(s.note), xk = /x K/.test(s.note);
  let val;
  if (Array.isArray(s.def)) val = arrayHtml(k, v);
  else if (isBool(k, s)) val = `<button class="toggle${v ? ' on' : ''}" data-k="${k}" data-w="bool"></button><span class="unit">${v ? 'on' : 'off'}</span>`;
  else {
    const [mn, mx, st] = rangeFor(k, s, v);
    val = `<input type="number" data-k="${k}" data-w="num" value="${v}" step="${st}"><input type="range" data-k="${k}" data-w="rng" min="${mn}" max="${mx}" step="${st}" value="${v}">` +
      (u ? `<span class="unit">${u}</span>` : '') + (xk ? '<span class="xk" title="Multiplied by the map scale K">×K</span>' : '');
  }
  const bad = errs.some(e => e.keys.includes(k));
  return `<div class="node${isMod(k) ? ' mod' : ''}${bad ? ' bad' : ''}" data-row="${k}"><div class="lbl" title="${esc(tip(k))}">${esc(leaf(k))}</div><div class="val">${val}</div>` +
    `<div class="acts"><button class="rst" data-rst="${k}" title="Reset to default (${esc(JSON.stringify(s.def))})">↺</button></div></div>` +
    (s.note ? `<div class="note">${esc(s.note)}</div>` : '');
}
function arrayHtml(k, v) {
  if (!Array.isArray(v)) return `<span class="dim">${esc(JSON.stringify(v))}</span>`;
  const pairs = Array.isArray(S.schema[k].def[0]);
  const rows = v.map((e, i) => `<tr><td class="i">${i}</td>` + (pairs ? e.map((c, j) => `<td><input type="number" data-k="${k}" data-w="arr" data-i="${i}" data-j="${j}" value="${c}"></td>`).join('')
    : `<td><input type="number" data-k="${k}" data-w="arr" data-i="${i}" value="${e}"></td>`) + `<td><button data-k="${k}" data-w="del" data-i="${i}" title="Remove">×</button></td></tr>`).join('');
  return `<div style="flex:1"><table class="pts"><tr><th>#</th>${pairs ? '<th>x</th><th>y</th>' : '<th>value</th>'}<th></th></tr>${rows}</table><button class="addrow" data-k="${k}" data-w="add">+ Add</button></div>`;
}
// the island page: spine points with their half-widths in one table (the arrays must stay the same length)
function islandHtml() {
  const tbl = (pk, hk, title, help) => {
    const P = get(pk), Hh = get(hk);
    const mod = isMod(pk) || isMod(hk), bad = errs.some(e => e.keys.includes(pk) || e.keys.includes(hk));
    const n = Math.max(P.length, Hh.length);
    const rows = Array.from({ length: n }, (_, i) => `<tr><td class="i">${i}</td>` +
      `<td><input type="number" data-k="${pk}" data-w="arr" data-i="${i}" data-j="0" value="${P[i]?.[0] ?? ''}"></td>` +
      `<td><input type="number" data-k="${pk}" data-w="arr" data-i="${i}" data-j="1" value="${P[i]?.[1] ?? ''}"></td>` +
      `<td><input type="number" data-k="${hk}" data-w="arr" data-i="${i}" value="${Hh[i] ?? ''}"></td>` +
      `<td><button data-pair="${pk}|${hk}" data-w="pdel" data-i="${i}" title="Remove point">×</button> <button data-pair="${pk}|${hk}" data-w="pins" data-i="${i}" title="Insert a point after this one">+</button></td></tr>`).join('');
    return `<div class="node${mod ? ' mod' : ''}${bad ? ' bad' : ''}" data-row="${pk}"><div class="lbl" title="${esc(tip(pk))}">${esc(title)}</div><div class="val"><div style="flex:1">` +
      `<table class="pts"><tr><th>#</th><th>x</th><th>y</th><th>half-width</th><th></th></tr>${rows}</table></div></div>` +
      `<div class="acts"><button class="rst" data-rst="${pk}|${hk}" title="Reset">↺</button></div></div><div class="note">${esc(help)}</div>`;
  };
  return tbl('island.spine', 'island.half', 'spine', 'Points in cells from the town centre, half-width in cells (both ×K). Drag them on the preview.') +
    tbl('island.tail', 'island.tailHalf', 'tail', 'Offsets in cells from the last spine point, half-widths in cells (both ×K).');
}
// the last mapgen run's stage timings (a server preview header or none)
function stageTimes() {
  const pv = S.server.full || S.server.sites;
  return pv?.stages ? Object.fromEntries(pv.stages.map(s => [s.id, s.ms])) : null;
}
function pipelineHtml() {
  const times = stageTimes(), tmax = times ? Math.max(...Object.values(times)) : 1;
  const hIdx = STAGES.findIndex(s => s.id === 'heightmap'), cIdx = STAGES.findIndex(s => s.id === 'caves');
  let n = 0;
  return PHASES.map(ph => {
    const st = STAGES.filter(s => s.phase === ph.id);
    if (!st.length) return '';
    return `<div class="phase"><div class="phead"><b>${esc(ph.title)}</b><span class="badge mc" title="Minecraft analogue">${esc(ph.mc)}</span></div><p class="pblurb">${esc(ph.blurb)}</p>` +
      st.map(s => {
        const i = STAGES.indexOf(s), num = ++n;
        const pv = i <= hIdx ? ['instant', 'instant'] : i <= cIdx ? ['sites', 'sites'] : ['full', 'full'];
        const ms = times?.[s.id];
        const chips = s.groups.filter(g => keysOf(g).length).map(g => { const m = keysOf(g).filter(isMod).length; return `<button class="chip${m ? ' mod' : ''}" data-g="${g}">${esc(groupInfo(g).title)}${m ? ` · ${m}` : ''}</button>`; }).join('');
        return `<div class="stage" data-st="${s.id}"><span class="sn">${num}</span><div class="sb"><div class="st1"><b>${esc(s.title)}</b><code>${s.id}</code><span class="badge ${pv[0]}" title="Shown by the ${pv[1]} preview">${pv[1]}</span>` +
          (ms !== undefined ? `<span class="tm" title="last run">${ms < 1000 ? ms + ' ms' : (ms / 1000).toFixed(1) + ' s'}</span><span class="tbar"><i style="width:${Math.max(2, ms / tmax * 100)}%"></i></span>` : '') +
          `</div><div class="st2">makes ${esc(s.writes)}<span class="dim"> · ${esc(s.after)}</span></div>${chips ? `<div class="chips">${chips}</div>` : ''}</div></div>`;
      }).join('') + '</div>';
  }).join('');
}
function renderEditor() {
  if (!S.search && S.group === 'pipeline') {
    $('#crumb').textContent = 'Pipeline';
    const times = stageTimes();
    $('#ghead').innerHTML = `<h1>${icon('flow')}Pipeline</h1><p>${esc(PIPE.blurb)}</p><div class="badges"><span class="badge">${PHASES.length} phases</span><span class="badge">${STAGES.length} stages</span>` +
      `<span class="badge">${times ? 'timings from the last Sites/Full preview' : 'run a Sites or Full preview for timings'}</span></div>`;
    $('#errors').innerHTML = '';
    $('#fields').innerHTML = pipelineHtml();
    return;
  }
  if (S.search) {
    const q = S.search, hits = Object.keys(S.schema).filter(k => k.toLowerCase().includes(q) || S.schema[k].note.toLowerCase().includes(q));
    $('#crumb').textContent = 'Search';
    $('#ghead').innerHTML = `<h1>Search</h1><p>${hits.length} settings match “${esc(q)}”.</p>`;
    $('#errors').innerHTML = '';
    const by = {};
    for (const k of hits) (by[groupOf(k)] ??= []).push(k);
    $('#fields').innerHTML = Object.entries(by).map(([g, ks]) => `<div class="sres"><h3 data-g="${g}">${esc(groupInfo(g).title)} ›</h3>${ks.map(rowHtml).join('')}</div>`).join('');
    return;
  }
  const g = groupInfo(S.group), keys = keysOf(S.group);
  $('#crumb').textContent = g.title;
  const stages = [...new Set(keys.map(k => (INSTANT.test(k) ? 'instant' : MARKER.test(k) ? 'instant' : S.schema[k].stage)))];
  const lbl = { instant: 'instant preview', height: 'height stage', sites: 'sites preview', full: 'full preview' };
  $('#ghead').innerHTML = `<h1>${icon(g.icon)}${esc(g.title)}</h1><p>${esc(g.blurb)}</p><div class="badges">${stages.map(s => `<span class="badge ${s === 'height' ? 'instant' : s}">${lbl[s]}</span>`).join('')}` +
    `<span class="badge">${keys.length} settings</span><span class="spacer"></span><button id="resetGroup" class="link"${keys.some(isMod) ? '' : ' disabled'}>Reset page</button></div>`;
  const myErrs = errs.filter(e => e.keys.some(k => groupOf(k) === S.group));
  $('#errors').innerHTML = myErrs.map(e => `<div class="err">⚠ ${esc(e.msg)}</div>`).join('');
  $('#fields').innerHTML = S.group === 'island' ? islandHtml() : keys.map(rowHtml).join('');
}
// update classes/values in place (keeps focus and slider drags alive)
function refreshRows() {
  errs = validate(get);
  for (const row of document.querySelectorAll('#fields .node')) {
    const k = row.dataset.row;
    const pair = k === 'island.spine' ? 'island.half' : k === 'island.tail' ? 'island.tailHalf' : null;
    row.classList.toggle('mod', isMod(k) || (pair && isMod(pair)));
    row.classList.toggle('bad', errs.some(e => e.keys.includes(k)));
  }
  for (const el of document.querySelectorAll('#fields [data-w="num"], #fields [data-w="rng"]')) {
    if (el === document.activeElement) continue;
    const v = get(el.dataset.k);
    if (String(el.value) !== String(v)) el.value = v;
  }
  const myErrs = errs.filter(e => e.keys.some(k => groupOf(k) === S.group));
  if (!S.search) $('#errors').innerHTML = myErrs.map(e => `<div class="err">⚠ ${esc(e.msg)}</div>`).join('');
  const rg = $('#resetGroup');
  if (rg) rg.disabled = !keysOf(S.group).some(isMod);
}
$('#fields').addEventListener('input', e => {
  const el = e.target, k = el.dataset.k, w = el.dataset.w;
  if (!k) return;
  const n = Number(el.value);
  if (el.value === '' || !Number.isFinite(n)) return;
  if (w === 'num' || w === 'rng') {
    const twin = el.parentElement.querySelector(w === 'num' ? '[data-w="rng"]' : '[data-w="num"]');
    if (twin) twin.value = n;
    setParam(k, n, { render: false });
  } else if (w === 'arr') {
    const v = clone(get(k)), i = +el.dataset.i;
    if (el.dataset.j !== undefined) { v[i] = v[i] || [0, 0]; v[i][+el.dataset.j] = n; } else v[i] = n;
    setParam(k, v, { render: false });
  }
});
$('#fields').addEventListener('click', e => {
  const el = e.target.closest('button, h3');
  if (!el) return;
  if (el.classList.contains('chip')) { S.group = el.dataset.g; renderNav(); renderEditor(); renderCode(); drawPreview(); return; }
  if (el.tagName === 'H3') { S.group = el.dataset.g; S.search = ''; $('#search').value = ''; renderNav(); renderEditor(); renderCode(); return; }
  const k = el.dataset.k, w = el.dataset.w;
  if (el.dataset.rst) return commit('reset', () => { for (const kk of el.dataset.rst.split('|')) delete S.params[kk]; });
  if (w === 'bool') return setParam(k, get(k) ? 0 : 1);
  if (w === 'del') return commit(null, () => { const v = clone(get(k)); v.splice(+el.dataset.i, 1); S.params[k] = v; });
  if (w === 'add') return commit(null, () => { const v = clone(get(k)); v.push(clone(v[v.length - 1] ?? (Array.isArray(S.schema[k].def[0]) ? [0, 0] : 0))); S.params[k] = v; });
  if (w === 'pdel' || w === 'pins') {
    const [pk, hk] = el.dataset.pair.split('|'), i = +el.dataset.i;
    return commit(null, () => {
      const P = clone(get(pk)), Hh = clone(get(hk));
      if (w === 'pdel') { if (P.length <= (pk === 'island.spine' ? 2 : 1)) return toast('Keep at least that many points'); P.splice(i, 1); Hh.splice(i, 1); }
      else {
        const a = P[i], b = P[i + 1] ?? [a[0] + (a[0] - (P[i - 1]?.[0] ?? a[0] - 20)), a[1] + (a[1] - (P[i - 1]?.[1] ?? a[1] - 20))];
        P.splice(i + 1, 0, [Math.round((a[0] + b[0]) / 2), Math.round((a[1] + b[1]) / 2)]);
        Hh.splice(i + 1, 0, Math.round(((Hh[i] ?? 50) + (Hh[i + 1] ?? Hh[i] ?? 50)) / 2));
      }
      S.params[pk] = P; S.params[hk] = Hh;
    });
  }
});
document.addEventListener('click', e => {
  if (e.target.id === 'resetGroup') commit('reset', () => { for (const k of keysOf(S.group)) delete S.params[k]; });
});
$('#resetAll').onclick = () => { if (Object.keys(S.params).length && confirm('Reset every setting to its default?')) commit('reset', () => { S.params = {}; }); };

// ------------------------------------------------------------------- code --
function fmt(v, ind = '') {
  if (Array.isArray(v)) {
    if (v.every(e => !Array.isArray(e) && typeof e !== 'object')) return '[' + v.map(e => JSON.stringify(e)).join(', ') + ']';
    const ni = ind + '  ';
    return '[\n' + v.map(e => ni + fmt(e, ni)).join(',\n') + '\n' + ind + ']';
  }
  if (v && typeof v === 'object') {
    const ks = Object.keys(v);
    if (!ks.length) return '{}';
    const ni = ind + '  ';
    return '{\n' + ks.map(k => `${ni}${JSON.stringify(k)}: ${fmt(v[k], ni)}`).join(',\n') + '\n' + ind + '}';
  }
  return JSON.stringify(v);
}
function highlight(s) {
  return s.replace(/("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}[\],])|(^#.*$)|([&<>])/gm, (m, str, colon, num, lit, pun, com, ch) =>
    str ? `<span class="${colon ? 'jk' : 'js'}">${esc(str)}</span>${colon || ''}` : num ? `<span class="jn">${num}</span>` : lit ? `<span class="jl">${lit}</span>` :
    pun ? `<span class="jp">${pun}</span>` : com ? `<span class="jc">${esc(com)}</span>` : esc(ch));
}
function groupObj() {
  const o = {};
  for (const k of keysOf(S.group)) o[leaf(k)] = get(k);
  return o;
}
function codeText() {
  if (S.codeTab === 'group' && S.group === 'pipeline') { const t = stageTimes(); return fmt(PHASES.map(ph => ({ phase: ph.id, mc: ph.mc, stages: STAGES.filter(s => s.phase === ph.id).map(s => t?.[s.id] !== undefined ? `${s.id} (${t[s.id]} ms)` : s.id) }))); }
  if (S.codeTab === 'group') return fmt(groupObj());
  if (S.codeTab === 'params') return fmt(S.params);
  if (S.codeTab === 'cmd') {
    const n = Object.keys(S.params).length;
    return `# save params.json (the params.json tab) in mapgen/, then:\nnode mapgen.mjs --seed ${S.seed} --scale ${S.scale}${n ? ' --params params.json' : ''} --out out_mymap\n\n` +
      `# preview stages without building\nnode mapgen.mjs --seed ${S.seed} --scale ${S.scale}${n ? ' --params params.json' : ''} --preview pv.bin --preview-height\n\n` +
      `# dungeon check before any deploy (must print 0/0)\nnode check-dungeons.mjs --seed ${S.seed}\n\n# ${n} setting${n === 1 ? '' : 's'} changed from the defaults`;
  }
  return S.log.slice(-400).join('\n') || '# no runs yet';
}
let codeEditing = false;
function renderCode() {
  if (codeEditing) return;
  const t = codeText();
  const ta = $('#src');
  ta.readOnly = S.codeTab !== 'group' || S.group === 'pipeline';
  if (ta.value !== t) ta.value = t;
  $('#hl').innerHTML = S.codeTab === 'log' ? esc(t) : highlight(t) + '\n';
  $('#jsonErr').textContent = '';
  if (S.codeTab === 'log') ta.scrollTop = ta.scrollHeight;
  syncScroll();
}
function syncScroll() { $('#hl').scrollTop = $('#src').scrollTop; $('#hl').scrollLeft = $('#src').scrollLeft; }
$('#src').addEventListener('scroll', syncScroll);
$('#src').addEventListener('input', () => {
  const ta = $('#src');
  $('#hl').innerHTML = highlight(ta.value) + '\n';
  syncScroll();
  if (S.codeTab !== 'group') return;
  let o;
  try { o = JSON.parse(ta.value); } catch (e) { $('#jsonErr').textContent = e.message; return; }
  if (!o || typeof o !== 'object' || Array.isArray(o)) { $('#jsonErr').textContent = 'expected an object'; return; }
  const keys = keysOf(S.group), unknown = Object.keys(o).filter(l => !keys.includes(S.group === 'world' ? l : S.group + '.' + l));
  if (unknown.length) { $('#jsonErr').textContent = `unknown setting: ${unknown[0]}`; return; }
  $('#jsonErr').textContent = '';
  codeEditing = true;
  commit('json', () => { for (const k of keys) { const l = leaf(k); if (l in o) S.params[k] = o[l]; else delete S.params[k]; } }, { render: true });
  codeEditing = false;
});
$('#src').addEventListener('blur', () => renderCode());
$('#codeSeg').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  S.codeTab = b.dataset.tab;
  for (const x of $('#codeSeg').children) x.classList.toggle('on', x === b);
  renderCode();
});
$('#copy').onclick = () => { navigator.clipboard.writeText(codeText()); toast('Copied'); };
$('#download').onclick = () => {
  const name = S.codeTab === 'params' ? 'params.json' : S.codeTab === 'group' ? `${S.group}.json` : S.codeTab === 'cmd' ? 'build.sh' : 'mapgen.log';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([codeText() + '\n'], { type: 'text/plain' }));
  a.download = name; a.click();
};

// --------------------------------------------------------- instant preview --
let worker = null, wGen = 0, wBusy = null, wQueue = [];
function newWorker() {
  worker?.terminate();
  worker = new Worker('/worker.mjs', { type: 'module' });
  worker.onmessage = ({ data }) => {
    wBusy = null;
    if (data.gen === wGen) {
      if (data.error) { pvMsg('Preview error: ' + data.error); }
      else {
        const isl = island(S.scale, get);
        S.terr = { ...data, isl };
        baseDirty = true;
        if (!S.fitted) fit();
        drawPreview();
        if (S.src === 'instant') $('#pvstat').textContent = `instant · ${data.w}² samples (every ${data.step} cell${data.step > 1 ? 's' : ''}) · ${data.ms.toFixed(0)} ms`;
        if (!wQueue.length) pvMsg('');
      }
    }
    pump();
  };
}
function vals() {
  const v = {};
  for (const k of Object.keys(S.schema)) v[k] = get(k);
  return v;
}
function pump() {
  if (wBusy || !wQueue.length) return;
  const step = wQueue.shift();
  wBusy = { step };
  worker.postMessage({ gen: wGen, seed: S.seed, scale: S.scale, vals: vals(), step, tail: true });
}
let lastInstant = null;
function requestInstant(fast) {
  if (!Object.keys(S.schema).length) return;
  // only terrain-affecting settings re-run it
  const ik = JSON.stringify([S.seed, S.scale, Object.keys(S.schema).filter(k => INSTANT.test(k)).map(get), fast]);
  if (ik === lastInstant) return;
  lastInstant = ik;
  wGen++;
  const big = Math.max(2, Math.round(3 * S.scale));
  wQueue = fast ? [big * 2] : [big, 2, 1];
  if (wBusy && wBusy.step <= 2) { newWorker(); wBusy = null; }
  if (!fast && S.src === 'instant') pvMsg('Generating terrain…');
  pump();
}

// ---------------------------------------------------------- server preview --
function parsePreview(buf) {
  const dv = new DataView(buf);
  if (String.fromCharCode(...new Uint8Array(buf, 0, 4)) !== 'MGPV') throw new Error('not a preview file');
  const hlen = dv.getUint32(4, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, hlen)));
  const base = 8 + hlen, T = { Int16Array, Uint8Array, Float32Array, Int32Array, Uint16Array };
  const sec = {};
  for (const s of header.sections) sec[s.name] = new T[s.type](buf.slice(base + s.offset, base + s.offset + s.length * T[s.type].BYTES_PER_ELEMENT));
  return { ...header, sec };
}
let pollT = null;
async function runServer(stage) {
  try {
    const { id } = await api('/api/run', { seed: S.seed, scale: S.scale, params: S.params, stage });
    S.job = { id, stage, key: settingsKey(), logLen: 0 };
    S.log.push(`--- ${stage} preview (seed ${S.seed}, scale ${S.scale}, ${Object.keys(S.params).length} changed)`);
    pollServer();
  } catch (e) { pvMsg('Error: ' + e.message); }
}
async function pollServer() {
  clearTimeout(pollT);
  const j = S.job;
  if (!j) return;
  try {
    const st = await api(`/api/status?id=${j.id}&since=${j.logLen}`);
    if (S.job !== j) return;
    j.logLen = st.logLen; S.log.push(...st.log);
    if (S.codeTab === 'log') renderCode();
    if (st.state === 'running') {
      if (S.src === j.stage) pvMsg(`mapgen ${j.stage} preview… ${(st.ms / 1000).toFixed(0)} s  ·  ${esc(st.log.at(-1) || '')}`.slice(0, 160));
      pollT = setTimeout(pollServer, 600); return;
    }
    S.job = null;
    if (st.state !== 'done') { pvMsg(`mapgen ${st.state}: see the Log tab`); S.log.push(`!! ${st.state}`); return; }
    const r = await fetch(`/api/preview?id=${j.id}`);
    const pv = parsePreview(await r.arrayBuffer());
    pv.key = j.key; pv.runMs = st.ms;
    S.server[j.stage] = pv;
    if (S.group === 'pipeline' && !S.search) renderEditor();
    S.log.push(`done in ${(st.ms / 1000).toFixed(1)} s`);
    if (S.src === j.stage) { baseDirty = true; pvMsg(''); drawPreview(); }
    markStale();
  } catch (e) { pvMsg('Error: ' + e.message); }
}
function markStale() {
  const k = settingsKey();
  for (const b of $('#srcSeg').children) {
    const pv = S.server[b.dataset.src];
    b.classList.toggle('stale', !!pv && pv.key !== k);
  }
}
$('#srcSeg').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  S.src = b.dataset.src;
  for (const x of $('#srcSeg').children) x.classList.toggle('on', x === b);
  fillLayers();
  baseDirty = true;
  if (S.src !== 'instant') {
    const pv = S.server[S.src];
    if (!pv || pv.key !== settingsKey()) { if (!S.job || S.job.stage !== S.src || S.job.key !== settingsKey()) runServer(S.src); else pollServer(); }
    if (pv && pv.key !== settingsKey()) toast('Showing the last run: settings changed since (regenerating)');
  } else pvMsg('');
  drawPreview();
});

// ---------------------------------------------------------------- drawing --
const LAYERS = {
  instant: [['terrain', 'Terrain'], ['height', 'Height (grey)'], ['base', 'Noise: lowland fbm'], ['mask', 'Noise: mountain mask'], ['ridge', 'Noise: ridges'], ['coast', 'Coast distance'], ['tail', 'Tail zone']],
  server: [['surface', 'Surface'], ['height', 'Height'], ['bricks', 'Bricks (full)'], ['flags', 'Feature cells']],
};
function fillLayers() {
  const set = S.src === 'instant' ? 'instant' : 'server';
  $('#layer').innerHTML = LAYERS[set].map(([v, t]) => `<option value="${v}"${v === S.layer[set] ? ' selected' : ''}>${t}</option>`).join('');
}
$('#layer').onchange = e => { S.layer[S.src === 'instant' ? 'instant' : 'server'] = e.target.value; baseDirty = true; drawPreview(); };
const OVL = [['shade', 'Shade'], ['spine', 'Spine'], ['sites', 'Sites'], ['grid', 'Grid']];
$('#ovl').innerHTML = OVL.map(([k, t]) => `<label><input type="checkbox" data-o="${k}"${S.ovl[k] ? ' checked' : ''}>${t}</label>`).join('');
$('#ovl').onchange = e => { S.ovl[e.target.dataset.o] = e.target.checked; if (e.target.dataset.o === 'shade') baseDirty = true; drawPreview(); };

function ramp(stops, t) {
  t = Math.max(0, Math.min(1, t));
  for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) {
    const [a, ca] = stops[i - 1], [b, cb] = stops[i], f = (t - a) / (b - a || 1);
    return [ca[0] + (cb[0] - ca[0]) * f, ca[1] + (cb[1] - ca[1]) * f, ca[2] + (cb[2] - ca[2]) * f];
  }
  return stops.at(-1)[1];
}
const VIRIDIS = [[0, [68, 1, 84]], [0.25, [59, 82, 139]], [0.5, [33, 145, 140]], [0.75, [94, 201, 98]], [1, [253, 231, 37]]];
const DIVERGE = [[0, [44, 92, 168]], [0.5, [236, 236, 236]], [1, [196, 60, 50]]];
const LANDS = [[0, [214, 200, 146]], [3, [110, 160, 70]], [25, [84, 140, 58]], [55, [120, 128, 70]], [85, [128, 108, 84]], [115, [122, 118, 112]], [140, [200, 200, 205]], [150, [240, 242, 246]]];
function heightColor(h, sea) {
  if (h <= sea) { const d = Math.min(1, (sea - h) / 14); return [36 + 34 * (1 - d), 86 + 56 * (1 - d), 150 + 46 * (1 - d)]; }
  const t = h - sea;
  for (let i = 1; i < LANDS.length; i++) if (t <= LANDS[i][0]) {
    const [a, ca] = LANDS[i - 1], [b, cb] = LANDS[i], f = (t - a) / (b - a);
    return ca.map((v, k) => v + (cb[k] - v) * f);
  }
  return LANDS.at(-1)[1];
}
const base = document.createElement('canvas');
let baseDirty = true, baseInfo = null;
function buildBase() {
  baseDirty = false;
  baseInfo = null;
  let W, cellsPer, H, sea, colorAt, zScale;
  if (S.src === 'instant') {
    const T = S.terr;
    if (!T) return;
    W = T.w; cellsPer = T.step; H = T.H; sea = T.SEA; zScale = 1;
    const L = S.layer.instant;
    const rng = L === 'base' ? [get('terrain.baseH') - get('terrain.baseAmp'), get('terrain.baseH') + get('terrain.baseAmp')] : null;
    colorAt = L === 'height' ? i => { const g = H[i] <= sea ? 40 + H[i] : 70 + (H[i] - sea) * 1.25; return [g * (H[i] <= sea ? 0.7 : 1), g * (H[i] <= sea ? 0.8 : 1), g]; }
      : L === 'base' ? i => ramp(DIVERGE, (T.base[i] - rng[0]) / (rng[1] - rng[0]))
      : L === 'mask' ? i => ramp(VIRIDIS, T.mask[i])
      : L === 'ridge' ? i => ramp(VIRIDIS, T.ridge[i])
      : L === 'coast' ? i => { const r = T.coast[i], a = get('terrain.oceanStart'), b = get('terrain.oceanEnd'); return r < a ? ramp([[0, [40, 120, 70]], [1, [170, 200, 120]]], r / a) : r < b ? [230, 200, 120] : ramp([[0, [70, 120, 190]], [1, [20, 40, 80]]], (r - b) / 0.6); }
      : L === 'tail' ? i => (T.TU[i] >= 0 ? ramp([[0, [120, 60, 160]], [1, [240, 120, 60]]], T.TU[i]).map(v => H[i] <= sea ? v * 0.45 : v) : heightColor(H[i], sea).map(v => v * 0.5))
      : i => heightColor(H[i], sea);
    baseInfo = { W, cellsPer, legend: L };
  } else {
    const pv = S.server[S.src];
    if (!pv) return;
    const L = S.layer.server;
    if (L === 'bricks' && pv.sec.topRgb) {
      W = pv.raster.W; cellsPer = pv.raster.res / pv.CELL; H = pv.sec.top; sea = pv.waterZ; zScale = 1 / pv.VZ;
      const t = pv.sec.top, c = pv.sec.topRgb;
      colorAt = i => (t[i] === -32768 ? [52, 128, 196] : [c[i * 3], c[i * 3 + 1], c[i * 3 + 2]]);
    } else {
      W = pv.N; cellsPer = 1; H = pv.sec.height; sea = pv.SEA; zScale = 1;
      const rgb = pv.sec.rgb, f = pv.sec.flags;
      colorAt = L === 'height' ? i => heightColor(H[i], sea)
        : L === 'flags' ? i => { const v = f[i]; return v & 1 ? [60, 140, 230] : v & 2 ? [240, 200, 90] : v & 128 ? [200, 170, 120] : v & 4 ? [120, 140, 50] : v & 32 ? [230, 190, 120] : v & 8 ? [200, 60, 60] : v & 16 ? [150, 90, 200] : v & 64 ? [90, 90, 100] : H[i] <= sea ? [26, 50, 80] : [52, 58, 56]; }
        : i => [rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]];
    }
    baseInfo = { W, cellsPer, legend: L === 'bricks' && !pv.sec.topRgb ? 'nobricks' : 'server-' + L };
    $('#pvstat').textContent = `mapgen ${pv.stage} · ${(pv.runMs / 1000).toFixed(1)} s${pv.bricks ? ` · ${pv.bricks.toLocaleString()} bricks` : ''}${pv.key !== settingsKey() ? ' · STALE (settings changed)' : ''}`;
  }
  base.width = W; base.height = W;
  const ctx = base.getContext('2d'), img = ctx.createImageData(W, W), d = img.data;
  const shade = S.ovl.shade && !(S.src === 'instant' && !['terrain', 'height', 'tail'].includes(S.layer.instant)) && S.layer.server !== 'flags';
  const k = shade ? (VZ * zScale) / (cellsPer * CELL) * 1.6 : 0;
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, o = i * 4;
      const c = colorAt(i);
      let s = 1;
      if (shade) {
        const hz = H[i];
        const wet = S.src === 'instant' || S.layer.server !== 'bricks' ? hz <= sea : hz === -32768;
        if (!wet) {
          const a = H[Math.max(0, y - 1) * W + Math.max(0, x - 1)], b = H[Math.min(W - 1, y + 1) * W + Math.min(W - 1, x + 1)];
          s = Math.max(0.5, Math.min(1.45, 1 + (a - b) * k));
        }
      }
      d[o] = c[0] * s; d[o + 1] = c[1] * s; d[o + 2] = c[2] * s; d[o + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  renderLegend();
}
function renderLegend() {
  const L = baseInfo?.legend, lg = $('#legend');
  const bar = (stops, a, b, title) => `<div>${title}</div><div class="bar" style="background:linear-gradient(90deg,${stops.map(([t, c]) => `rgb(${c}) ${t * 100}%`).join(',')})"></div><div class="row"><span>${a}</span><span>${b}</span></div>`;
  const sea = get('sea');
  const html = {
    terrain: bar(LANDS.map(([t, c]) => [t / 150, c]), `sea ${sea}`, `+150 vox`, 'Height over the sea'),
    'server-height': bar(LANDS.map(([t, c]) => [t / 150, c]), `sea`, `+150 vox`, 'Height over the sea'),
    base: bar(DIVERGE, get('terrain.baseH') - get('terrain.baseAmp'), get('terrain.baseH') + get('terrain.baseAmp'), 'baseH + fbm × baseAmp (vox)'),
    mask: bar(VIRIDIS, 0, 1, 'Mountain share (patch ∪ Deep ring ∪ progress)'),
    ridge: bar(VIRIDIS, 0, 1, 'ridged² ^ ridgePow'),
    coast: `<div>Spine distance / half-width</div><div class="row"><span style="color:#8c6">land</span><span style="color:#eb7">falloff ${get('terrain.oceanStart')}–${get('terrain.oceanEnd')}</span><span style="color:#58c">sea</span></div>`,
    tail: bar([[0, [120, 60, 160]], [1, [240, 120, 60]]], 'far end', 'tail tip', 'Tail progress (death forest → volcano)'),
    'server-flags': '<div><span style="color:#3c8ce6">■</span> river <span style="color:#f0c85a">■</span> road <span style="color:#c8aa78">■</span> paving <span style="color:#788c32">■</span> swamp <span style="color:#e6be78">■</span> desert <span style="color:#c83c3c">■</span> trench <span style="color:#965ac8">■</span> tunnel <span style="color:#5a5a64">■</span> keep-out</div>',
    nobricks: '<div>Bricks need the Full preview</div>',
  }[L] || '';
  lg.innerHTML = html; lg.style.display = html ? 'block' : 'none';
}

const cv = $('#cv'), ctx = cv.getContext('2d');
let dpr = 1;
function resize() {
  dpr = window.devicePixelRatio || 1;
  const r = cv.getBoundingClientRect();
  cv.width = Math.max(1, r.width * dpr); cv.height = Math.max(1, r.height * dpr);
  drawPreview();
}
new ResizeObserver(resize).observe($('#canvasWrap'));
const Nnow = () => S.terr?.N || 2 * Math.round(576 * S.scale / 2);
function fit() {
  const N = Nnow(), r = cv.getBoundingClientRect();
  S.view = { cx: N / 2, cy: N / 2, zoom: Math.min(r.width, r.height) / N * 0.98 || 0.5 };
  S.fitted = true;
  drawPreview();
}
$('#fit').onclick = fit;
const toScreen = (x, y) => [((x - S.view.cx) * S.view.zoom) * dpr + cv.width / 2, ((y - S.view.cy) * S.view.zoom) * dpr + cv.height / 2];
const toCell = (sx, sy) => [(sx * dpr - cv.width / 2) / dpr / S.view.zoom + S.view.cx, (sy * dpr - cv.height / 2) / dpr / S.view.zoom + S.view.cy];

let raf = 0;
function drawPreview() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paint(); }); }
function paint() {
  if (baseDirty) buildBase();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0e1013'; ctx.fillRect(0, 0, cv.width, cv.height);
  if (baseInfo) {
    ctx.imageSmoothingEnabled = S.view.zoom * baseInfo.cellsPer < 2;
    const [x0, y0] = toScreen(0, 0), sz = baseInfo.W * baseInfo.cellsPer * S.view.zoom * dpr;
    ctx.drawImage(base, x0, y0, sz, sz);
  }
  if (!S.schema['island.spine']) return;
  const isl = island(S.scale, get);
  if (S.ovl.grid) drawGrid(isl);
  if (S.ovl.sites) drawSites(isl);
  if (S.ovl.spine) drawSpine(isl);
}
function drawGrid(isl) {
  // town-centred game units (the deployed map's frame), every 5000
  const N = isl.N, st = 5000 / CELL;
  ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1; ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.font = `${10 * dpr}px ui-monospace, monospace`;
  for (let g = Math.ceil(-isl.tcx / st) * st; isl.tcx + g <= N; g += st) {
    const [sx] = toScreen(isl.tcx + g, 0);
    ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, cv.height); ctx.stroke(); ctx.fillText(String(g * CELL), sx + 3, 12 * dpr);
  }
  for (let g = Math.ceil(-isl.tcy / st) * st; isl.tcy + g <= N; g += st) {
    const [, sy] = toScreen(0, isl.tcy + g);
    ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(cv.width, sy); ctx.stroke(); ctx.fillText(String(g * CELL), 3, sy - 3);
  }
}
function label(txt, x, y, col = '#fff') {
  const [sx, sy] = toScreen(x, y);
  ctx.font = `600 ${11 * dpr}px Segoe UI, system-ui, sans-serif`;
  const w = ctx.measureText(txt).width;
  ctx.fillStyle = 'rgba(14,16,19,.75)'; ctx.fillRect(sx + 7 * dpr, sy - 8 * dpr, w + 8 * dpr, 16 * dpr);
  ctx.fillStyle = col; ctx.fillText(txt, sx + 11 * dpr, sy + 4 * dpr);
}
function marker(x, y, col, r = 5) {
  const [sx, sy] = toScreen(x, y);
  ctx.beginPath(); ctx.arc(sx, sy, r * dpr, 0, 7); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 1.5 * dpr; ctx.strokeStyle = '#111'; ctx.stroke();
}
function circle(x, y, r, col, dash) {
  const [sx, sy] = toScreen(x, y);
  ctx.beginPath(); ctx.arc(sx, sy, r * S.view.zoom * dpr, 0, 7); ctx.strokeStyle = col; ctx.lineWidth = 1.5 * dpr; ctx.setLineDash(dash ? [5 * dpr, 4 * dpr] : []); ctx.stroke(); ctx.setLineDash([]);
}
function rect(x, y, w, h, col) {
  const [a, b] = toScreen(x, y), [c, d] = toScreen(x + w, y + h);
  ctx.strokeStyle = col; ctx.lineWidth = 1.5 * dpr; ctx.strokeRect(a, b, c - a, d - b);
}
function drawSites(isl) {
  const pv = S.src !== 'instant' ? S.server[S.src] : null;
  const K = S.scale;
  if (pv?.features) {
    const f = pv.features;
    rect(f.town.fx, f.town.fy, f.town.cells, f.town.cells, '#ffd36b'); label('Lumbrick', f.town.fx + f.town.cells, f.town.fy, '#ffd36b');
    for (const d of f.dungeons) { rect(d.fx, d.fy, d.cells, d.cells, '#ff7a7a'); label(d.name, d.fx + d.cells, d.fy, '#ff9a9a'); }
    for (const v of f.villages) { circle(v.x, v.y, 22, v.desert ? '#f0c070' : '#9be37f'); }
    for (const r of f.ruins) circle(r.x, r.y, r.r, '#b9a48a', true);
    for (const c of f.camps) marker(c.x, c.y, '#c4e05a', 4);
    for (const o of f.outposts) marker(o.x, o.y, '#e0a0ff', 4);
    for (const c of f.caves) marker(c.x, c.y, '#999', 3.5);
    if (f.swamp) { circle(f.swamp.x, f.swamp.y, f.swamp.r, '#8fa04a', true); label('Swamp', f.swamp.x, f.swamp.y, '#b9c86a'); }
    if (f.desert) { circle(f.desert.x, f.desert.y, f.desert.r, '#f0c070', true); label('Desert', f.desert.x, f.desert.y, '#f0c070'); }
    if (f.henge) { marker(f.henge.x0 + 8, f.henge.y0 + 8, '#7ab8ff', 5); label('Henge', f.henge.x0 + 8, f.henge.y0 + 8, '#9cc8ff'); }
    for (const sp of f.spawners || []) marker(sp.x, sp.y, '#ff4d4d', 2.2);
    for (const sh of f.shops || []) marker(sh.x, sh.y, '#4dd2ff', 2.6);
    return;
  }
  // instant: the pinned town square and the progress-placed anchors
  const tp = isl.TOWN_PIN;
  rect(tp.fx, tp.fy, TOWN_CELLS, TOWN_CELLS, '#ffd36b'); label('Lumbrick (town)', tp.fx + TOWN_CELLS, tp.fy, '#ffd36b');
  const anchors = [['crypt', 'Hollow Crypt', '#ff9a9a'], ['keep', 'Sunken Keep', '#ff9a9a'], ['deep', 'Mountain Deep', '#ff7070'], ['henge', 'Wizard henge', '#9cc8ff']];
  for (const [g, name, col] of anchors) {
    const [x, y] = isl.spineAt(get(g + '.t'), get(g + '.off') * K);
    const hot = S.group === g;
    marker(x, y, col, hot ? 7 : 5);
    label(name + (g === 'henge' ? ' (search centre)' : ' (anchor)'), x, y, col);
    if (g === 'henge' && hot) circle(x, y, get('henge.search') * K, col, true);
    if (g !== 'henge' && hot) circle(x, y, get('dungeon.maxAway') * K, col, true);
  }
  if (S.group === 'terrain' || S.group === 'deep') {
    const [x, y] = isl.spineAt(get('deep.t'), get('deep.off') * K);
    circle(x, y, get('terrain.deepR') * K, '#ff7070', true); circle(x, y, get('terrain.deepIn') * K, '#ff7070');
  }
}
// spine handles in cells: [kind, index, x, y]
function handles(isl) {
  const out = [];
  const nrm = (A, i) => {
    const a = A[Math.max(0, i - 1)], b = A[Math.min(A.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return [dy / l, -dx / l];
  };
  const P = isl.P, Hs = isl.ISL.half;
  P.forEach((p, i) => {
    out.push(['p', i, p[0], p[1]]);
    const [nx, ny] = nrm(P, i);
    if (Hs[i] !== undefined) out.push(['h', i, p[0] + nx * Hs[i], p[1] + ny * Hs[i], p]);
  });
  const T = isl.T, TH = isl.ISL.tailHalf;
  T.forEach((p, i) => {
    if (!i) return;
    out.push(['t', i - 1, p[0], p[1]]);
    const [nx, ny] = nrm(T, i);
    if (TH[i - 1] !== undefined) out.push(['th', i - 1, p[0] + nx * TH[i - 1], p[1] + ny * TH[i - 1], p]);
  });
  return out;
}
function drawSpine(isl) {
  const sp = isl.spine;
  const line = (pts, col, w, dash) => {
    ctx.beginPath();
    pts.forEach((p, i) => { const [sx, sy] = toScreen(p[0], p[1]); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
    ctx.strokeStyle = col; ctx.lineWidth = w * dpr; ctx.setLineDash(dash ? [6 * dpr, 5 * dpr] : []); ctx.stroke(); ctx.setLineDash([]);
  };
  // half-width envelope (where the coast falloff is centred, before noise)
  const env = (pts, side) => pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return [p[0] + side * dy / l * p[3], p[1] - side * dx / l * p[3]];
  });
  const hot = S.group === 'island';
  for (const s of [1, -1]) { line(env(sp.pts, s), hot ? 'rgba(232,116,59,.55)' : 'rgba(255,255,255,.18)', 1, true); line(env(sp.tail, s), hot ? 'rgba(180,120,255,.5)' : 'rgba(255,255,255,.14)', 1, true); }
  line(sp.pts, hot ? '#e8743b' : 'rgba(232,116,59,.6)', hot ? 2.5 : 1.5);
  line(sp.tail, hot ? '#b478ff' : 'rgba(180,120,255,.55)', hot ? 2.5 : 1.5);
  if (!hot && !drag) return;
  for (const [k, i, x, y, from] of handles(isl)) {
    const [sx, sy] = toScreen(x, y);
    const on = hover?.h && hover.h[0] === k && hover.h[1] === i;
    if (from) { const [fx, fy] = toScreen(from[0], from[1]); ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(sx, sy); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1 * dpr; ctx.stroke(); }
    ctx.fillStyle = k === 'p' || k === 'h' ? '#e8743b' : '#b478ff';
    ctx.strokeStyle = on ? '#fff' : '#111'; ctx.lineWidth = (on ? 2.5 : 1.5) * dpr;
    const r = (on ? 7 : 5.5) * dpr;
    ctx.beginPath();
    if (k === 'p' || k === 't') ctx.arc(sx, sy, r, 0, 7); else ctx.rect(sx - r * 0.8, sy - r * 0.8, r * 1.6, r * 1.6);
    ctx.fill(); ctx.stroke();
    if (k === 'p' || k === 't') { ctx.fillStyle = '#fff'; ctx.font = `600 ${10 * dpr}px Segoe UI, sans-serif`; ctx.fillText((k === 't' ? 't' : '') + i, sx + 8 * dpr, sy - 7 * dpr); }
  }
}

// ---------------------------------------------------------- map interaction --
let drag = null, hover = null;
function hitHandle(mx, my) {
  if (!S.ovl.spine || S.group !== 'island') return null;
  const isl = island(S.scale, get);
  let best = null, bd = 10;
  for (const h of handles(isl)) {
    const [sx, sy] = toScreen(h[2], h[3]);
    const d = Math.hypot(sx / dpr - mx, sy / dpr - my);
    if (d < bd) { bd = d; best = h; }
  }
  return best;
}
const mpos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
cv.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  const [mx, my] = mpos(e), h = hitHandle(mx, my);
  if (h) { drag = { kind: 'handle', h }; commit(null, () => {}, { render: false }); lastCommit = { label: 'drag', t: Date.now() }; }
  else { drag = { kind: 'pan', mx, my, cx: S.view.cx, cy: S.view.cy }; cv.classList.add('drag'); }
});
window.addEventListener('mousemove', e => {
  const [mx, my] = mpos(e);
  if (drag?.kind === 'pan') {
    S.view.cx = drag.cx - (mx - drag.mx) / S.view.zoom; S.view.cy = drag.cy - (my - drag.my) / S.view.zoom;
    drawPreview(); return;
  }
  if (drag?.kind === 'handle') { moveHandle(drag.h, ...toCell(mx, my)); return; }
  if (e.target !== cv) return;
  const h = hitHandle(mx, my);
  if ((h?.[0] + h?.[1]) !== (hover?.h?.[0] + hover?.h?.[1])) drawPreview();
  hover = { h };
  cv.classList.toggle('handle', !!h);
  readout(...toCell(mx, my), h);
});
window.addEventListener('mouseup', () => {
  if (drag?.kind === 'handle') { drag = null; requestInstant(false); renderEditor(); }
  drag = null; cv.classList.remove('drag');
});
function moveHandle(h, x, y) {
  const isl = island(S.scale, get), K = S.scale;
  const [kind, i] = h;
  const keyOf = { p: 'island.spine', h: 'island.half', t: 'island.tail', th: 'island.tailHalf' }[kind];
  const v = clone(get(keyOf));
  if (kind === 'p') v[i] = [Math.round((x - isl.tcx) / K), Math.round((y - isl.tcy) / K)];
  else if (kind === 't') { const E = isl.P.at(-1); v[i] = [Math.round((x - E[0]) / K), Math.round((y - E[1]) / K)]; }
  else { const c = kind === 'h' ? isl.P[i] : isl.T[i + 1]; v[i] = Math.max(1, Math.round(Math.hypot(x - c[0], y - c[1]) / K)); }
  if (eq(v, get(keyOf))) return;
  S.params[keyOf] = v;
  if (eq(v, S.schema[keyOf].def)) delete S.params[keyOf];
  lastCommit = { label: 'drag', t: Date.now() };
  changed(false);
  // keep the dragged handle hot (its index is stable)
  drag.h = handles(island(S.scale, get)).find(q => q[0] === kind && q[1] === i) || drag.h;
  readout(x, y, drag.h);
}
cv.addEventListener('wheel', e => {
  e.preventDefault();
  const [mx, my] = mpos(e), [cx, cy] = toCell(mx, my);
  const z = Math.max(0.05, Math.min(64, S.view.zoom * Math.exp(-e.deltaY * 0.0015)));
  S.view.zoom = z;
  const [nx, ny] = toCell(mx, my);
  S.view.cx += cx - nx; S.view.cy += cy - ny;
  drawPreview();
}, { passive: false });
function heightAt(x, y) {
  if (S.src === 'instant' && S.terr) {
    const T = S.terr, gx = Math.floor(x / T.step), gy = Math.floor(y / T.step);
    if (gx < 0 || gy < 0 || gx >= T.w || gy >= T.w) return null;
    const i = gy * T.w + gx;
    const L = S.layer.instant;
    const lv = { base: T.base[i].toFixed(1) + ' vox', mask: T.mask[i].toFixed(3), ridge: T.ridge[i].toFixed(3), coast: T.coast[i].toFixed(3), tail: T.TU[i] >= 0 ? 'tail ' + T.TU[i].toFixed(2) : '—' }[L];
    return { h: T.H[i], sea: T.SEA, extra: lv ? `${L} ${lv}` : '' };
  }
  const pv = S.server[S.src];
  if (!pv) return null;
  const gx = Math.floor(x), gy = Math.floor(y);
  if (gx < 0 || gy < 0 || gx >= pv.N || gy >= pv.N) return null;
  const f = pv.sec.flags[gy * pv.N + gx];
  const names = [[1, 'river'], [2, 'road'], [4, 'swamp'], [8, 'trench'], [16, 'tunnel'], [32, 'desert'], [64, 'keep-out'], [128, 'paved']].filter(([b]) => f & b).map(([, n]) => n);
  return { h: pv.sec.height[gy * pv.N + gx], sea: pv.SEA, extra: names.join(' ') };
}
function readout(x, y, h) {
  const isl = island(S.scale, get);
  const gx = Math.round((x - isl.tcx) * CELL), gy = Math.round((y - isl.tcy) * CELL);
  const a = heightAt(x, y);
  let s = `cell ${Math.floor(x)},${Math.floor(y)}  ·  game ${gx}, ${gy}`;
  if (a) s += `  ·  h ${a.h} vox (z ${(a.h + 1) * VZ})  ${a.h <= a.sea ? 'under the sea' : '+' + (a.h - a.sea) + ' over sea'}${a.extra ? '  ·  ' + a.extra : ''}`;
  if (h) s = `${{ p: 'spine point', h: 'half-width', t: 'tail point', th: 'tail half-width' }[h[0]]} ${h[1]}  ·  drag to edit  ·  ` + s;
  $('#hover').textContent = s;
  S.hoverCell = [x, y, gx, gy, a?.h];
}
cv.addEventListener('contextmenu', e => {
  e.preventDefault();
  const c = S.hoverCell;
  if (!c) return;
  const z = ((c[4] ?? 60) + 1) * VZ + 120;
  const cmd = `br.Chat.Command /TP "abysmal garbage" ${c[2]} ${c[3]} ${z} 0`;
  navigator.clipboard.writeText(cmd);
  toast('Copied: ' + cmd);
});

// --------------------------------------------------------------- header --
$('#seed').addEventListener('change', e => { const v = Math.trunc(Number(e.target.value)); if (Number.isFinite(v)) commit(null, () => { S.seed = v; }); });
$('#dice').onclick = () => commit(null, () => { S.seed = Math.floor(Math.random() * 2 ** 31); });
$('#scale').addEventListener('change', async e => {
  const v = Number(e.target.value);
  hist.push({ seed: S.seed, scale: S.scale, params: clone(S.params) }); fut.length = 0;
  S.scale = v; S.fitted = false;
  await loadSchema();
  changed(true);
});
$('#undo').onclick = undo; $('#redo').onclick = redo;
window.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey)) return;
  if (e.target.id === 'src' || (e.target.tagName === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox')) return;
  if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
});
async function loadPresets(sel) {
  const names = await api('/api/presets');
  $('#preset').innerHTML = '<option value="">—</option>' + names.map(n => `<option${n === sel ? ' selected' : ''}>${esc(n)}</option>`).join('');
}
$('#preset').addEventListener('change', async e => {
  if (!e.target.value) return;
  const p = await api(`/api/preset?name=${encodeURIComponent(e.target.value)}`);
  await applyState(p, true);
  toast(`Loaded preset ${e.target.value}`);
});
async function applyState(p, undoable) {
  if (undoable) { hist.push({ seed: S.seed, scale: S.scale, params: clone(S.params) }); fut.length = 0; }
  const sc = Number(p.scale) || S.scale;
  const rescale = sc !== S.scale || !Object.keys(S.schema).length;
  S.seed = Number(p.seed ?? S.seed); S.scale = sc; S.params = clone(p.params || {});
  if (p.group) S.group = p.group;
  if (rescale) { await loadSchema(); S.fitted = false; }
  changed(true);
}
$('#savePreset').onclick = async () => {
  const name = await ask('Save preset', 'Letters, digits, - and _. "live" is reserved for the live map.', { input: '' });
  if (!name) return;
  try { const r = await api('/api/preset', { name, seed: S.seed, scale: S.scale, params: S.params }); await loadPresets(r.name); toast(`Saved ${r.name}`); } catch (e) { toast(e.message); }
};
const shareHash = () => 's=' + btoa(unescape(encodeURIComponent(JSON.stringify({ seed: S.seed, scale: S.scale, params: S.params, group: S.group }))));
$('#share').onclick = () => { history.replaceState(null, '', '#' + shareHash()); navigator.clipboard.writeText(location.href); toast('Link copied'); };
$('#import').onclick = async () => {
  const txt = await ask('Import settings', 'Paste a params.json (flat "group.key": value), a preset { seed, scale, params } or a mapgen_settings.json.', { area: '' });
  if (!txt) return;
  try {
    const o = JSON.parse(txt);
    const p = o.params && typeof o.params === 'object' ? o : { seed: S.seed, scale: S.scale, params: o };
    const unknown = Object.keys(p.params).filter(k => !S.schema[k]);
    await applyState(p, true);
    toast(unknown.length ? `Imported; unknown keys kept: ${unknown.join(', ')}` : 'Imported');
  } catch (e) { toast('Not valid JSON: ' + e.message); }
};
$('#build').onclick = async () => {
  const name = await ask('Build the full map', 'Runs mapgen.mjs into mapgen/out_<name> (about a minute). Nothing is deployed.', { input: 'site_' + new Date().toISOString().slice(5, 10).replace('-', '') });
  if (!name) return;
  try {
    const { id } = await api('/api/build', { seed: S.seed, scale: S.scale, params: S.params, name });
    S.log.push(`--- build ${name}`);
    S.codeTab = 'log'; for (const x of $('#codeSeg').children) x.classList.toggle('on', x.dataset.tab === 'log');
    let len = 0;
    const tick = async () => {
      const st = await api(`/api/status?id=${id}&since=${len}`);
      len = st.logLen; S.log.push(...st.log); renderCode();
      $('#build').textContent = st.state === 'running' ? `Building ${(st.ms / 1000).toFixed(0)} s` : 'Build';
      if (st.state === 'running') return setTimeout(tick, 1000);
      toast(st.state === 'done' ? `Built ${st.out}` : `Build ${st.state}: see the Log tab`);
    };
    tick();
  } catch (e) { toast(e.message); }
};

// --------------------------------------------------------------- helpers --
let toastT;
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }
function pvMsg(m) { const el = $('#pvmsg'); el.textContent = m; el.classList.toggle('show', !!m); }
function ask(title, text, { input, area } = {}) {
  const d = $('#dlg');
  $('#dlgTitle').textContent = title; $('#dlgText').textContent = text;
  $('#dlgInput').style.display = input !== undefined ? '' : 'none'; $('#dlgInput').value = input ?? '';
  $('#dlgArea').style.display = area !== undefined ? '' : 'none'; $('#dlgArea').value = area ?? '';
  d.returnValue = '';
  d.showModal();
  (input !== undefined ? $('#dlgInput') : $('#dlgArea')).focus();
  return new Promise(ok => d.addEventListener('close', () => ok(d.returnValue === 'ok' ? (input !== undefined ? $('#dlgInput').value.trim() : $('#dlgArea').value) : null), { once: true }));
}
// splitter between preview and code
$('#splitter').addEventListener('mousedown', e => {
  e.preventDefault();
  const r = $('#right').getBoundingClientRect();
  const mv = ev => { const f = Math.max(0.15, Math.min(0.9, (ev.clientY - r.top) / r.height)); $('#pv').style.flex = `${f} 1 0`; $('#code').style.flex = `${1 - f} 1 0`; };
  const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
  window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
});

// ------------------------------------------------------------------ boot --
(async function boot() {
  newWorker();
  fillLayers();
  let st = null;
  const m = location.hash.match(/s=([^&]+)/);
  if (m) try { st = JSON.parse(decodeURIComponent(escape(atob(m[1])))); } catch {}
  if (!st) st = await api('/api/live');
  await loadPresets(m ? '' : 'live');
  await applyState(st, false);
})();
