//#region \0rolldown/runtime.js
var e = Object.defineProperty, t = (t, n) => {
	let r = {};
	for (var i in t) e(r, i, {
		get: t[i],
		enumerable: !0
	});
	return n || e(r, Symbol.toStringTag, { value: "Module" }), r;
}, n = /* @__PURE__ */ t({
	DEFAULT_UUID: () => a,
	LATEST_VERSION: () => 14,
	MAGIC: () => r,
	MAX_INT: () => i
}), r = new Uint8Array([
	66,
	82,
	83
]), i = 2147483647, a = "00000000-0000-0000-0000-000000000000";
//#endregion
//#region \0@oxc-project+runtime@0.138.0/helpers/esm/typeof.js
function o(e) {
	"@babel/helpers - typeof";
	return o = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, o(e);
}
//#endregion
//#region \0@oxc-project+runtime@0.138.0/helpers/esm/toPrimitive.js
function s(e, t) {
	if (o(e) != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (o(r) != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
//#endregion
//#region \0@oxc-project+runtime@0.138.0/helpers/esm/toPropertyKey.js
function c(e) {
	var t = s(e, "string");
	return o(t) == "symbol" ? t : t + "";
}
//#endregion
//#region \0@oxc-project+runtime@0.138.0/helpers/esm/defineProperty.js
function l(e, t, n) {
	return (t = c(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
//#endregion
//#region node_modules/pako/dist/pako.mjs
var u = 4, d = 0, f = 1, p = 2;
function m(e) {
	let t = e.length;
	for (; --t >= 0;) e[t] = 0;
}
var h = 0, g = 1, _ = 2, v = 29, y = 256, b = 286, x = 30, S = 19, C = 573, w = 15, T = 16, E = 7, D = 256, O = 16, k = 17, A = 18, j = new Uint8Array([
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	1,
	1,
	1,
	1,
	2,
	2,
	2,
	2,
	3,
	3,
	3,
	3,
	4,
	4,
	4,
	4,
	5,
	5,
	5,
	5,
	0
]), M = new Uint8Array([
	0,
	0,
	0,
	0,
	1,
	1,
	2,
	2,
	3,
	3,
	4,
	4,
	5,
	5,
	6,
	6,
	7,
	7,
	8,
	8,
	9,
	9,
	10,
	10,
	11,
	11,
	12,
	12,
	13,
	13
]), ee = new Uint8Array([
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	2,
	3,
	7
]), te = new Uint8Array([
	16,
	17,
	18,
	0,
	8,
	7,
	9,
	6,
	10,
	5,
	11,
	4,
	12,
	3,
	13,
	2,
	14,
	1,
	15
]), ne = 512, re = Array(288 * 2);
m(re);
var ie = Array(x * 2);
m(ie);
var ae = Array(ne);
m(ae);
var oe = Array(256);
m(oe);
var se = Array(v);
m(se);
var ce = Array(x);
m(ce);
var le = class {
	constructor(e, t, n, r, i) {
		this.static_tree = e, this.extra_bits = t, this.extra_base = n, this.elems = r, this.max_length = i, this.has_stree = e && e.length;
	}
}, ue, de, fe, pe = class {
	constructor(e, t) {
		this.dyn_tree = e, this.max_code = 0, this.stat_desc = t;
	}
}, me = (e) => e < 256 ? ae[e] : ae[256 + (e >>> 7)], he = (e, t) => {
	e.pending_buf[e.pending++] = t & 255, e.pending_buf[e.pending++] = t >>> 8 & 255;
}, N = (e, t, n) => {
	e.bi_valid > T - n ? (e.bi_buf |= t << e.bi_valid & 65535, he(e, e.bi_buf), e.bi_buf = t >> T - e.bi_valid, e.bi_valid += n - T) : (e.bi_buf |= t << e.bi_valid & 65535, e.bi_valid += n);
}, ge = (e, t, n) => {
	N(e, n[t * 2], n[t * 2 + 1]);
}, _e = (e, t) => {
	let n = 0;
	do
		n |= e & 1, e >>>= 1, n <<= 1;
	while (--t > 0);
	return n >>> 1;
}, ve = (e) => {
	e.bi_valid === 16 ? (he(e, e.bi_buf), e.bi_buf = 0, e.bi_valid = 0) : e.bi_valid >= 8 && (e.pending_buf[e.pending++] = e.bi_buf & 255, e.bi_buf >>= 8, e.bi_valid -= 8);
}, ye = (e, t) => {
	let n = t.dyn_tree, r = t.max_code, i = t.stat_desc.static_tree, a = t.stat_desc.has_stree, o = t.stat_desc.extra_bits, s = t.stat_desc.extra_base, c = t.stat_desc.max_length, l, u, d, f, p, m, h = 0;
	for (f = 0; f <= w; f++) e.bl_count[f] = 0;
	for (n[e.heap[e.heap_max] * 2 + 1] = 0, l = e.heap_max + 1; l < C; l++) u = e.heap[l], f = n[n[u * 2 + 1] * 2 + 1] + 1, f > c && (f = c, h++), n[u * 2 + 1] = f, !(u > r) && (e.bl_count[f]++, p = 0, u >= s && (p = o[u - s]), m = n[u * 2], e.opt_len += m * (f + p), a && (e.static_len += m * (i[u * 2 + 1] + p)));
	if (h !== 0) {
		do {
			for (f = c - 1; e.bl_count[f] === 0;) f--;
			e.bl_count[f]--, e.bl_count[f + 1] += 2, e.bl_count[c]--, h -= 2;
		} while (h > 0);
		for (f = c; f !== 0; f--) for (u = e.bl_count[f]; u !== 0;) d = e.heap[--l], !(d > r) && (n[d * 2 + 1] !== f && (e.opt_len += (f - n[d * 2 + 1]) * n[d * 2], n[d * 2 + 1] = f), u--);
	}
}, be = (e, t, n) => {
	let r = Array(16), i = 0, a, o;
	for (a = 1; a <= w; a++) i = i + n[a - 1] << 1, r[a] = i;
	for (o = 0; o <= t; o++) {
		let t = e[o * 2 + 1];
		t !== 0 && (e[o * 2] = _e(r[t]++, t));
	}
}, xe = () => {
	let e, t, n, r, i, a = Array(16);
	for (n = 0, r = 0; r < v - 1; r++) for (se[r] = n, e = 0; e < 1 << j[r]; e++) oe[n++] = r;
	for (oe[n - 1] = r, i = 0, r = 0; r < 16; r++) for (ce[r] = i, e = 0; e < 1 << M[r]; e++) ae[i++] = r;
	for (i >>= 7; r < x; r++) for (ce[r] = i << 7, e = 0; e < 1 << M[r] - 7; e++) ae[256 + i++] = r;
	for (t = 0; t <= w; t++) a[t] = 0;
	for (e = 0; e <= 143;) re[e * 2 + 1] = 8, e++, a[8]++;
	for (; e <= 255;) re[e * 2 + 1] = 9, e++, a[9]++;
	for (; e <= 279;) re[e * 2 + 1] = 7, e++, a[7]++;
	for (; e <= 287;) re[e * 2 + 1] = 8, e++, a[8]++;
	for (be(re, 287, a), e = 0; e < x; e++) ie[e * 2 + 1] = 5, ie[e * 2] = _e(e, 5);
	ue = new le(re, j, 257, b, w), de = new le(ie, M, 0, x, w), fe = new le([], ee, 0, S, E);
}, Se = (e) => {
	let t;
	for (t = 0; t < b; t++) e.dyn_ltree[t * 2] = 0;
	for (t = 0; t < x; t++) e.dyn_dtree[t * 2] = 0;
	for (t = 0; t < S; t++) e.bl_tree[t * 2] = 0;
	e.dyn_ltree[D * 2] = 1, e.opt_len = e.static_len = 0, e.sym_next = e.matches = 0;
}, Ce = (e) => {
	e.bi_valid > 8 ? he(e, e.bi_buf) : e.bi_valid > 0 && (e.pending_buf[e.pending++] = e.bi_buf), e.bi_buf = 0, e.bi_valid = 0;
}, we = (e, t, n, r) => {
	let i = t * 2, a = n * 2;
	return e[i] < e[a] || e[i] === e[a] && r[t] <= r[n];
}, Te = (e, t, n) => {
	let r = e.heap[n], i = n << 1;
	for (; i <= e.heap_len && (i < e.heap_len && we(t, e.heap[i + 1], e.heap[i], e.depth) && i++, !we(t, r, e.heap[i], e.depth));) e.heap[n] = e.heap[i], n = i, i <<= 1;
	e.heap[n] = r;
}, Ee = (e, t, n) => {
	let r, i, a = 0, o, s;
	if (e.sym_next !== 0) do
		r = e.pending_buf[e.sym_buf + a++] & 255, r += (e.pending_buf[e.sym_buf + a++] & 255) << 8, i = e.pending_buf[e.sym_buf + a++], r === 0 ? ge(e, i, t) : (o = oe[i], ge(e, o + y + 1, t), s = j[o], s !== 0 && (i -= se[o], N(e, i, s)), r--, o = me(r), ge(e, o, n), s = M[o], s !== 0 && (r -= ce[o], N(e, r, s)));
	while (a < e.sym_next);
	ge(e, D, t);
}, De = (e, t) => {
	let n = t.dyn_tree, r = t.stat_desc.static_tree, i = t.stat_desc.has_stree, a = t.stat_desc.elems, o, s, c = -1, l;
	for (e.heap_len = 0, e.heap_max = C, o = 0; o < a; o++) n[o * 2] === 0 ? n[o * 2 + 1] = 0 : (e.heap[++e.heap_len] = c = o, e.depth[o] = 0);
	for (; e.heap_len < 2;) l = e.heap[++e.heap_len] = c < 2 ? ++c : 0, n[l * 2] = 1, e.depth[l] = 0, e.opt_len--, i && (e.static_len -= r[l * 2 + 1]);
	for (t.max_code = c, o = e.heap_len >> 1; o >= 1; o--) Te(e, n, o);
	l = a;
	do
		o = e.heap[1], e.heap[1] = e.heap[e.heap_len--], Te(e, n, 1), s = e.heap[1], e.heap[--e.heap_max] = o, e.heap[--e.heap_max] = s, n[l * 2] = n[o * 2] + n[s * 2], e.depth[l] = (e.depth[o] >= e.depth[s] ? e.depth[o] : e.depth[s]) + 1, n[o * 2 + 1] = n[s * 2 + 1] = l, e.heap[1] = l++, Te(e, n, 1);
	while (e.heap_len >= 2);
	e.heap[--e.heap_max] = e.heap[1], ye(e, t), be(n, c, e.bl_count);
}, Oe = (e, t, n) => {
	let r, i = -1, a, o = t[1], s = 0, c = 7, l = 4;
	for (o === 0 && (c = 138, l = 3), t[(n + 1) * 2 + 1] = 65535, r = 0; r <= n; r++) a = o, o = t[(r + 1) * 2 + 1], !(++s < c && a === o) && (s < l ? e.bl_tree[a * 2] += s : a === 0 ? s <= 10 ? e.bl_tree[k * 2]++ : e.bl_tree[A * 2]++ : (a !== i && e.bl_tree[a * 2]++, e.bl_tree[O * 2]++), s = 0, i = a, o === 0 ? (c = 138, l = 3) : a === o ? (c = 6, l = 3) : (c = 7, l = 4));
}, ke = (e, t, n) => {
	let r, i = -1, a, o = t[1], s = 0, c = 7, l = 4;
	for (o === 0 && (c = 138, l = 3), r = 0; r <= n; r++) if (a = o, o = t[(r + 1) * 2 + 1], !(++s < c && a === o)) {
		if (s < l) do
			ge(e, a, e.bl_tree);
		while (--s !== 0);
		else a === 0 ? s <= 10 ? (ge(e, k, e.bl_tree), N(e, s - 3, 3)) : (ge(e, A, e.bl_tree), N(e, s - 11, 7)) : (a !== i && (ge(e, a, e.bl_tree), s--), ge(e, O, e.bl_tree), N(e, s - 3, 2));
		s = 0, i = a, o === 0 ? (c = 138, l = 3) : a === o ? (c = 6, l = 3) : (c = 7, l = 4);
	}
}, Ae = (e) => {
	let t;
	for (Oe(e, e.dyn_ltree, e.l_desc.max_code), Oe(e, e.dyn_dtree, e.d_desc.max_code), De(e, e.bl_desc), t = S - 1; t >= 3 && e.bl_tree[te[t] * 2 + 1] === 0; t--);
	return e.opt_len += 3 * (t + 1) + 5 + 5 + 4, t;
}, je = (e, t, n, r) => {
	let i;
	for (N(e, t - 257, 5), N(e, n - 1, 5), N(e, r - 4, 4), i = 0; i < r; i++) N(e, e.bl_tree[te[i] * 2 + 1], 3);
	ke(e, e.dyn_ltree, t - 1), ke(e, e.dyn_dtree, n - 1);
}, Me = (e) => {
	let t = 4093624447, n;
	for (n = 0; n <= 31; n++, t >>>= 1) if (t & 1 && e.dyn_ltree[n * 2] !== 0) return d;
	if (e.dyn_ltree[18] !== 0 || e.dyn_ltree[20] !== 0 || e.dyn_ltree[26] !== 0) return f;
	for (n = 32; n < y; n++) if (e.dyn_ltree[n * 2] !== 0) return f;
	return d;
}, Ne = !1, Pe = (e) => {
	Ne || (xe(), Ne = !0), e.l_desc = new pe(e.dyn_ltree, ue), e.d_desc = new pe(e.dyn_dtree, de), e.bl_desc = new pe(e.bl_tree, fe), e.bi_buf = 0, e.bi_valid = 0, Se(e);
}, Fe = (e, t, n, r) => {
	N(e, (h << 1) + +!!r, 3), Ce(e), he(e, n), he(e, ~n), n && e.pending_buf.set(e.window.subarray(t, t + n), e.pending), e.pending += n;
}, Ie = (e) => {
	N(e, g << 1, 3), ge(e, D, re), ve(e);
}, Le = (e, t, n, r) => {
	let i, a, o = 0;
	e.level > 0 ? (e.strm.data_type === p && (e.strm.data_type = Me(e)), De(e, e.l_desc), De(e, e.d_desc), o = Ae(e), i = e.opt_len + 3 + 7 >>> 3, a = e.static_len + 3 + 7 >>> 3, a <= i && (i = a)) : i = a = n + 5, n + 4 <= i && t !== -1 ? Fe(e, t, n, r) : e.strategy === u || a === i ? (N(e, (g << 1) + +!!r, 3), Ee(e, re, ie)) : (N(e, (_ << 1) + +!!r, 3), je(e, e.l_desc.max_code + 1, e.d_desc.max_code + 1, o + 1), Ee(e, e.dyn_ltree, e.dyn_dtree)), Se(e), r && Ce(e);
}, Re = (e, t, n) => (e.pending_buf[e.sym_buf + e.sym_next++] = t, e.pending_buf[e.sym_buf + e.sym_next++] = t >> 8, e.pending_buf[e.sym_buf + e.sym_next++] = n, t === 0 ? e.dyn_ltree[n * 2]++ : (e.matches++, t--, e.dyn_ltree[(oe[n] + y + 1) * 2]++, e.dyn_dtree[me(t) * 2]++), e.sym_next === e.sym_end), ze = (e, t, n, r) => {
	let i = e & 65535 | 0, a = e >>> 16 & 65535 | 0, o = 0;
	for (; n !== 0;) {
		o = n > 2e3 ? 2e3 : n, n -= o;
		do
			i = i + t[r++] | 0, a = a + i | 0;
		while (--o);
		i %= 65521, a %= 65521;
	}
	return i | a << 16 | 0;
}, Be = new Uint32Array((() => {
	let e, t = [];
	for (var n = 0; n < 256; n++) {
		e = n;
		for (var r = 0; r < 8; r++) e = e & 1 ? 3988292384 ^ e >>> 1 : e >>> 1;
		t[n] = e;
	}
	return t;
})()), P = (e, t, n, r) => {
	let i = Be, a = r + n;
	e ^= -1;
	for (let n = r; n < a; n++) e = e >>> 8 ^ i[(e ^ t[n]) & 255];
	return e ^ -1;
}, Ve = {
	2: "need dictionary",
	1: "stream end",
	0: "",
	"-1": "file error",
	"-2": "stream error",
	"-3": "data error",
	"-4": "insufficient memory",
	"-5": "buffer error",
	"-6": "incompatible version"
}, He = 9, Ue = 573, F = 3, We = 258, Ge = 262, Ke = 32, qe = 42, Je = 57, Ye = 69, Xe = 73, Ze = 91, Qe = 103, $e = 113, et = 666, I = 1, tt = 2, nt = 3, rt = 4, it = 3, at = (e, t) => (e.msg = Ve[t], t), ot = (e) => e * 2 - (e > 4 ? 9 : 0), st = (e) => {
	let t = e.length;
	for (; --t >= 0;) e[t] = 0;
}, ct = (e) => {
	let t, n, r, i = e.w_size;
	t = e.hash_size, r = t;
	do
		n = e.head[--r], e.head[r] = n >= i ? n - i : 0;
	while (--t);
	t = i, r = t;
	do
		n = e.prev[--r], e.prev[r] = n >= i ? n - i : 0;
	while (--t);
}, lt = (e, t, n) => (t << e.hash_shift ^ n) & e.hash_mask, ut = (e, t) => {
	let n;
	if (e.legacy_hash) n = e.ins_h = lt(e, e.ins_h, e.window[t + F - 1]);
	else {
		let r = e.window, i = r[t] | r[t + 1] << 8 | r[t + 2] << 16 | r[t + 3] << 24;
		n = e.ins_h = Math.imul(i, 66521) + 66521 >>> 16 & e.hash_mask;
	}
	let r = e.prev[t & e.w_mask] = e.head[n];
	return e.head[n] = t, r;
}, dt = (e) => {
	let t = e.state, n = t.pending;
	n > e.avail_out && (n = e.avail_out), n !== 0 && (e.output.set(t.pending_buf.subarray(t.pending_out, t.pending_out + n), e.next_out), e.next_out += n, t.pending_out += n, e.total_out += n, e.avail_out -= n, t.pending -= n, t.pending === 0 && (t.pending_out = 0));
}, ft = (e, t) => {
	Le(e, e.block_start >= 0 ? e.block_start : -1, e.strstart - e.block_start, t), e.block_start = e.strstart, dt(e.strm);
}, L = (e, t) => {
	e.pending_buf[e.pending++] = t;
}, pt = (e, t) => {
	e.pending_buf[e.pending++] = t >>> 8 & 255, e.pending_buf[e.pending++] = t & 255;
}, mt = (e, t, n, r) => {
	let i = e.avail_in;
	return i > r && (i = r), i === 0 ? 0 : (e.avail_in -= i, t.set(e.input.subarray(e.next_in, e.next_in + i), n), e.state.wrap === 1 ? e.adler = ze(e.adler, t, i, n) : e.state.wrap === 2 && (e.adler = P(e.adler, t, i, n)), e.next_in += i, e.total_in += i, i);
}, ht = (e, t) => {
	let n = e.max_chain_length, r = e.strstart, i, a, o = e.prev_length, s = e.nice_match, c = e.strstart > e.w_size - Ge ? e.strstart - (e.w_size - Ge) : 0, l = e.window, u = e.w_mask, d = e.prev, f = e.strstart + We, p = l[r + o - 1], m = l[r + o];
	e.prev_length >= e.good_match && (n >>= 2), s > e.lookahead && (s = e.lookahead);
	do {
		if (i = t, l[i + o] !== m || l[i + o - 1] !== p || l[i] !== l[r] || l[++i] !== l[r + 1]) continue;
		r += 2, i++;
		do		;
while (l[++r] === l[++i] && l[++r] === l[++i] && l[++r] === l[++i] && l[++r] === l[++i] && l[++r] === l[++i] && l[++r] === l[++i] && l[++r] === l[++i] && l[++r] === l[++i] && r < f);
		if (a = We - (f - r), r = f - We, a > o) {
			if (e.match_start = t, o = a, a >= s) break;
			p = l[r + o - 1], m = l[r + o];
		}
	} while ((t = d[t & u]) > c && --n !== 0);
	return o <= e.lookahead ? o : e.lookahead;
}, gt = (e) => {
	let t = e.w_size, n, r, i;
	do {
		if (r = e.window_size - e.lookahead - e.strstart, e.strstart >= t + (t - Ge) && (e.window.set(e.window.subarray(t, t + t - r), 0), e.match_start -= t, e.strstart -= t, e.block_start -= t, e.insert > e.strstart && (e.insert = e.strstart), ct(e), r += t), e.strm.avail_in === 0) break;
		if (n = mt(e.strm, e.window, e.strstart + e.lookahead, r), e.lookahead += n, !e.legacy_hash) {
			if (e.lookahead + e.insert > F) for (i = e.strstart - e.insert; e.insert && (ut(e, i), i++, e.insert--, !(e.lookahead + e.insert <= F)););
		} else if (e.lookahead + e.insert >= F) for (i = e.strstart - e.insert, e.ins_h = e.window[i], e.ins_h = lt(e, e.ins_h, e.window[i + 1]); e.insert && (ut(e, i), i++, e.insert--, !(e.lookahead + e.insert < F)););
	} while (e.lookahead < Ge && e.strm.avail_in !== 0);
}, _t = (e, t) => {
	let n = e.pending_buf_size - 5 > e.w_size ? e.w_size : e.pending_buf_size - 5, r, i, a, o = 0, s = e.strm.avail_in;
	do {
		if (r = 65535, a = e.bi_valid + 42 >> 3, e.strm.avail_out < a || (a = e.strm.avail_out - a, i = e.strstart - e.block_start, r > i + e.strm.avail_in && (r = i + e.strm.avail_in), r > a && (r = a), r < n && (r === 0 && t !== 4 || t === 0 || r !== i + e.strm.avail_in))) break;
		o = +(t === 4 && r === i + e.strm.avail_in), Fe(e, 0, 0, o), e.pending_buf[e.pending - 4] = r, e.pending_buf[e.pending - 3] = r >> 8, e.pending_buf[e.pending - 2] = ~r, e.pending_buf[e.pending - 1] = ~r >> 8, dt(e.strm), i && (i > r && (i = r), e.strm.output.set(e.window.subarray(e.block_start, e.block_start + i), e.strm.next_out), e.strm.next_out += i, e.strm.avail_out -= i, e.strm.total_out += i, e.block_start += i, r -= i), r && (mt(e.strm, e.strm.output, e.strm.next_out, r), e.strm.next_out += r, e.strm.avail_out -= r, e.strm.total_out += r);
	} while (o === 0);
	return s -= e.strm.avail_in, s && (s >= e.w_size ? (e.matches = 2, e.window.set(e.strm.input.subarray(e.strm.next_in - e.w_size, e.strm.next_in), 0), e.strstart = e.w_size, e.insert = e.strstart) : (e.window_size - e.strstart <= s && (e.strstart -= e.w_size, e.window.set(e.window.subarray(e.w_size, e.w_size + e.strstart), 0), e.matches < 2 && e.matches++, e.insert > e.strstart && (e.insert = e.strstart)), e.window.set(e.strm.input.subarray(e.strm.next_in - s, e.strm.next_in), e.strstart), e.strstart += s, e.insert += s > e.w_size - e.insert ? e.w_size - e.insert : s), e.block_start = e.strstart), e.high_water < e.strstart && (e.high_water = e.strstart), o ? rt : t !== 0 && t !== 4 && e.strm.avail_in === 0 && e.strstart === e.block_start ? tt : (a = e.window_size - e.strstart, e.strm.avail_in > a && e.block_start >= e.w_size && (e.block_start -= e.w_size, e.strstart -= e.w_size, e.window.set(e.window.subarray(e.w_size, e.w_size + e.strstart), 0), e.matches < 2 && e.matches++, a += e.w_size, e.insert > e.strstart && (e.insert = e.strstart)), a > e.strm.avail_in && (a = e.strm.avail_in), a && (mt(e.strm, e.window, e.strstart, a), e.strstart += a, e.insert += a > e.w_size - e.insert ? e.w_size - e.insert : a), e.high_water < e.strstart && (e.high_water = e.strstart), a = e.bi_valid + 42 >> 3, a = e.pending_buf_size - a > 65535 ? 65535 : e.pending_buf_size - a, n = a > e.w_size ? e.w_size : a, i = e.strstart - e.block_start, (i >= n || (i || t === 4) && t !== 0 && e.strm.avail_in === 0 && i <= a) && (r = i > a ? a : i, o = +(t === 4 && e.strm.avail_in === 0 && r === i), Fe(e, e.block_start, r, o), e.block_start += r, dt(e.strm)), o ? nt : I);
}, vt = (e, t) => {
	let n, r;
	for (;;) {
		if (e.lookahead < Ge) {
			if (gt(e), e.lookahead < Ge && t === 0) return I;
			if (e.lookahead === 0) break;
		}
		if (n = 0, e.lookahead >= F && (n = ut(e, e.strstart)), n !== 0 && e.strstart - n <= e.w_size - Ge && (e.match_length = ht(e, n)), e.match_length >= F) if (r = Re(e, e.strstart - e.match_start, e.match_length - F), e.lookahead -= e.match_length, e.match_length <= e.max_lazy_match && e.lookahead >= F) {
			e.match_length--;
			do
				e.strstart++, n = ut(e, e.strstart);
			while (--e.match_length !== 0);
			e.strstart++;
		} else e.strstart += e.match_length, e.match_length = 0, e.legacy_hash && (e.ins_h = e.window[e.strstart], e.ins_h = lt(e, e.ins_h, e.window[e.strstart + 1]));
		else r = Re(e, 0, e.window[e.strstart]), e.lookahead--, e.strstart++;
		if (r && (ft(e, !1), e.strm.avail_out === 0)) return I;
	}
	return e.insert = e.strstart < F - 1 ? e.strstart : F - 1, t === 4 ? (ft(e, !0), e.strm.avail_out === 0 ? nt : rt) : e.sym_next && (ft(e, !1), e.strm.avail_out === 0) ? I : tt;
}, yt = (e, t) => {
	let n, r, i;
	for (;;) {
		if (e.lookahead < Ge) {
			if (gt(e), e.lookahead < Ge && t === 0) return I;
			if (e.lookahead === 0) break;
		}
		if (n = 0, e.lookahead >= F && (n = ut(e, e.strstart)), e.prev_length = e.match_length, e.prev_match = e.match_start, e.match_length = F - 1, n !== 0 && e.prev_length < e.max_lazy_match && e.strstart - n <= e.w_size - Ge && (e.match_length = ht(e, n), e.match_length <= 5 && (e.strategy === 1 || e.match_length === F && e.strstart - e.match_start > 4096) && (e.match_length = F - 1)), e.prev_length >= F && e.match_length <= e.prev_length) {
			i = e.strstart + e.lookahead - F, r = Re(e, e.strstart - 1 - e.prev_match, e.prev_length - F), e.lookahead -= e.prev_length - 1, e.prev_length -= 2;
			do
				++e.strstart <= i && (n = ut(e, e.strstart));
			while (--e.prev_length !== 0);
			if (e.match_available = 0, e.match_length = F - 1, e.strstart++, r && (ft(e, !1), e.strm.avail_out === 0)) return I;
		} else if (e.match_available) {
			if (r = Re(e, 0, e.window[e.strstart - 1]), r && ft(e, !1), e.strstart++, e.lookahead--, e.strm.avail_out === 0) return I;
		} else e.match_available = 1, e.strstart++, e.lookahead--;
	}
	return e.match_available && (r = Re(e, 0, e.window[e.strstart - 1]), e.match_available = 0), e.insert = e.strstart < F - 1 ? e.strstart : F - 1, t === 4 ? (ft(e, !0), e.strm.avail_out === 0 ? nt : rt) : e.sym_next && (ft(e, !1), e.strm.avail_out === 0) ? I : tt;
}, bt = (e, t) => {
	let n, r, i, a, o = e.window;
	for (;;) {
		if (e.lookahead <= We) {
			if (gt(e), e.lookahead <= We && t === 0) return I;
			if (e.lookahead === 0) break;
		}
		if (e.match_length = 0, e.lookahead >= F && e.strstart > 0 && (i = e.strstart - 1, r = o[i], r === o[++i] && r === o[++i] && r === o[++i])) {
			a = e.strstart + We;
			do			;
while (r === o[++i] && r === o[++i] && r === o[++i] && r === o[++i] && r === o[++i] && r === o[++i] && r === o[++i] && r === o[++i] && i < a);
			e.match_length = We - (a - i), e.match_length > e.lookahead && (e.match_length = e.lookahead);
		}
		if (e.match_length >= F ? (n = Re(e, 1, e.match_length - F), e.lookahead -= e.match_length, e.strstart += e.match_length, e.match_length = 0) : (n = Re(e, 0, e.window[e.strstart]), e.lookahead--, e.strstart++), n && (ft(e, !1), e.strm.avail_out === 0)) return I;
	}
	return e.insert = 0, t === 4 ? (ft(e, !0), e.strm.avail_out === 0 ? nt : rt) : e.sym_next && (ft(e, !1), e.strm.avail_out === 0) ? I : tt;
}, xt = (e, t) => {
	let n;
	for (;;) {
		if (e.lookahead === 0 && (gt(e), e.lookahead === 0)) {
			if (t === 0) return I;
			break;
		}
		if (e.match_length = 0, n = Re(e, 0, e.window[e.strstart]), e.lookahead--, e.strstart++, n && (ft(e, !1), e.strm.avail_out === 0)) return I;
	}
	return e.insert = 0, t === 4 ? (ft(e, !0), e.strm.avail_out === 0 ? nt : rt) : e.sym_next && (ft(e, !1), e.strm.avail_out === 0) ? I : tt;
}, St = class {
	constructor(e, t, n, r, i) {
		this.good_length = e, this.max_lazy = t, this.nice_length = n, this.max_chain = r, this.func = i;
	}
}, Ct = [
	new St(0, 0, 0, 0, _t),
	new St(4, 4, 8, 4, vt),
	new St(4, 5, 16, 8, vt),
	new St(4, 6, 32, 32, vt),
	new St(4, 4, 16, 16, yt),
	new St(8, 16, 32, 32, yt),
	new St(8, 16, 128, 128, yt),
	new St(8, 32, 128, 256, yt),
	new St(32, 128, 258, 1024, yt),
	new St(32, 258, 258, 4096, yt)
], wt = (e) => {
	e.window_size = 2 * e.w_size, st(e.head), e.max_lazy_match = Ct[e.level].max_lazy, e.good_match = Ct[e.level].good_length, e.nice_match = Ct[e.level].nice_length, e.max_chain_length = Ct[e.level].max_chain, e.strstart = 0, e.block_start = 0, e.lookahead = 0, e.insert = 0, e.match_length = e.prev_length = F - 1, e.match_available = 0, e.ins_h = 0;
}, Tt = class {
	constructor() {
		this.strm = null, this.status = 0, this.pending_buf = null, this.pending_buf_size = 0, this.pending_out = 0, this.pending = 0, this.wrap = 0, this.gzhead = null, this.gzindex = 0, this.method = 8, this.last_flush = -1, this.w_size = 0, this.w_bits = 0, this.w_mask = 0, this.window = null, this.window_size = 0, this.prev = null, this.head = null, this.ins_h = 0, this.legacy_hash = 0, this.hash_size = 0, this.hash_bits = 0, this.hash_mask = 0, this.hash_shift = 0, this.block_start = 0, this.match_length = 0, this.prev_match = 0, this.match_available = 0, this.strstart = 0, this.match_start = 0, this.lookahead = 0, this.prev_length = 0, this.max_chain_length = 0, this.max_lazy_match = 0, this.level = 0, this.strategy = 0, this.good_match = 0, this.nice_match = 0, this.dyn_ltree = new Uint16Array(Ue * 2), this.dyn_dtree = /* @__PURE__ */ new Uint16Array(122), this.bl_tree = /* @__PURE__ */ new Uint16Array(78), st(this.dyn_ltree), st(this.dyn_dtree), st(this.bl_tree), this.l_desc = null, this.d_desc = null, this.bl_desc = null, this.bl_count = /* @__PURE__ */ new Uint16Array(16), this.heap = /* @__PURE__ */ new Uint16Array(573), st(this.heap), this.heap_len = 0, this.heap_max = 0, this.depth = /* @__PURE__ */ new Uint16Array(573), st(this.depth), this.sym_buf = 0, this.lit_bufsize = 0, this.sym_next = 0, this.sym_end = 0, this.opt_len = 0, this.static_len = 0, this.matches = 0, this.insert = 0, this.bi_buf = 0, this.bi_valid = 0;
	}
}, Et = (e) => {
	if (!e) return 1;
	let t = e.state;
	return +(!t || t.strm !== e || t.status !== qe && t.status !== Je && t.status !== Ye && t.status !== Xe && t.status !== Ze && t.status !== Qe && t.status !== $e && t.status !== et);
}, Dt = (e) => {
	if (Et(e)) return at(e, -2);
	e.total_in = e.total_out = 0, e.data_type = 2;
	let t = e.state;
	return t.pending = 0, t.pending_out = 0, t.wrap < 0 && (t.wrap = -t.wrap), t.status = t.wrap === 2 ? Je : t.wrap ? qe : $e, e.adler = t.wrap === 2 ? 0 : 1, t.last_flush = -2, Pe(t), 0;
}, Ot = (e) => {
	let t = Dt(e);
	return t === 0 && wt(e.state), t;
}, kt = (e, t, n, r, i, a, o) => {
	if (!e) return -2;
	let s = 1;
	if (t === -1 && (t = 6), r < 0 ? (s = 0, r = -r) : r > 15 && (s = 2, r -= 16), i < 1 || i > He || n !== 8 || r < 8 || r > 15 || t < 0 || t > 9 || a < 0 || a > 4 || r === 8 && s !== 1) return at(e, -2);
	r === 8 && (r = 9);
	let c = new Tt();
	return e.state = c, c.strm = e, c.status = qe, c.wrap = s, c.gzhead = null, c.w_bits = r, c.w_size = 1 << c.w_bits, c.w_mask = c.w_size - 1, c.legacy_hash = +!!o, c.hash_bits = i + 7, !c.legacy_hash && c.hash_bits < 15 && (c.hash_bits = 15), c.hash_size = 1 << c.hash_bits, c.hash_mask = c.hash_size - 1, c.hash_shift = ~~((c.hash_bits + F - 1) / F), c.window = new Uint8Array(c.w_size * 2), c.head = new Uint16Array(c.hash_size), c.prev = new Uint16Array(c.w_size), c.lit_bufsize = 1 << i + 6, c.pending_buf_size = c.lit_bufsize * 4, c.pending_buf = new Uint8Array(c.pending_buf_size), c.sym_buf = c.lit_bufsize, c.sym_end = (c.lit_bufsize - 1) * 3, c.level = t, c.strategy = a, c.method = n, Ot(e);
}, At = (e, t) => {
	if (Et(e) || t > 5 || t < 0) return e ? at(e, -2) : -2;
	let n = e.state;
	if (!e.output || e.avail_in !== 0 && !e.input || n.status === et && t !== 4) return at(e, e.avail_out === 0 ? -5 : -2);
	let r = n.last_flush;
	if (n.last_flush = t, n.pending !== 0) {
		if (dt(e), e.avail_out === 0) return n.last_flush = -1, 0;
	} else if (e.avail_in === 0 && ot(t) <= ot(r) && t !== 4) return at(e, -5);
	if (n.status === et && e.avail_in !== 0) return at(e, -5);
	if (n.status === qe && n.wrap === 0 && (n.status = $e), n.status === qe) {
		let t = 8 + (n.w_bits - 8 << 4) << 8, r = -1;
		if (r = n.strategy >= 2 || n.level < 2 ? 0 : n.level < 6 ? 1 : n.level === 6 ? 2 : 3, t |= r << 6, n.strstart !== 0 && (t |= Ke), t += 31 - t % 31, pt(n, t), n.strstart !== 0 && (pt(n, e.adler >>> 16), pt(n, e.adler & 65535)), e.adler = 1, n.status = $e, dt(e), n.pending !== 0) return n.last_flush = -1, 0;
	}
	if (n.status === Je) {
		if (e.adler = 0, L(n, 31), L(n, 139), L(n, 8), n.gzhead) L(n, +!!n.gzhead.text + (n.gzhead.hcrc ? 2 : 0) + (n.gzhead.extra ? 4 : 0) + (n.gzhead.name ? 8 : 0) + (n.gzhead.comment ? 16 : 0)), L(n, n.gzhead.time & 255), L(n, n.gzhead.time >> 8 & 255), L(n, n.gzhead.time >> 16 & 255), L(n, n.gzhead.time >> 24 & 255), L(n, n.level === 9 ? 2 : n.strategy >= 2 || n.level < 2 ? 4 : 0), L(n, n.gzhead.os & 255), n.gzhead.extra && n.gzhead.extra.length && (L(n, n.gzhead.extra.length & 255), L(n, n.gzhead.extra.length >> 8 & 255)), n.gzhead.hcrc && (e.adler = P(e.adler, n.pending_buf, n.pending, 0)), n.gzindex = 0, n.status = Ye;
		else if (L(n, 0), L(n, 0), L(n, 0), L(n, 0), L(n, 0), L(n, n.level === 9 ? 2 : n.strategy >= 2 || n.level < 2 ? 4 : 0), L(n, it), n.status = $e, dt(e), n.pending !== 0) return n.last_flush = -1, 0;
	}
	if (n.status === Ye) {
		if (n.gzhead.extra) {
			let t = n.pending, r = (n.gzhead.extra.length & 65535) - n.gzindex;
			for (; n.pending + r > n.pending_buf_size;) {
				let i = n.pending_buf_size - n.pending;
				if (n.pending_buf.set(n.gzhead.extra.subarray(n.gzindex, n.gzindex + i), n.pending), n.pending = n.pending_buf_size, n.gzhead.hcrc && n.pending > t && (e.adler = P(e.adler, n.pending_buf, n.pending - t, t)), n.gzindex += i, dt(e), n.pending !== 0) return n.last_flush = -1, 0;
				t = 0, r -= i;
			}
			let i = new Uint8Array(n.gzhead.extra);
			n.pending_buf.set(i.subarray(n.gzindex, n.gzindex + r), n.pending), n.pending += r, n.gzhead.hcrc && n.pending > t && (e.adler = P(e.adler, n.pending_buf, n.pending - t, t)), n.gzindex = 0;
		}
		n.status = Xe;
	}
	if (n.status === Xe) {
		if (n.gzhead.name) {
			let t = n.pending, r;
			do {
				if (n.pending === n.pending_buf_size) {
					if (n.gzhead.hcrc && n.pending > t && (e.adler = P(e.adler, n.pending_buf, n.pending - t, t)), dt(e), n.pending !== 0) return n.last_flush = -1, 0;
					t = 0;
				}
				r = n.gzindex < n.gzhead.name.length ? n.gzhead.name.charCodeAt(n.gzindex++) & 255 : 0, L(n, r);
			} while (r !== 0);
			n.gzhead.hcrc && n.pending > t && (e.adler = P(e.adler, n.pending_buf, n.pending - t, t)), n.gzindex = 0;
		}
		n.status = Ze;
	}
	if (n.status === Ze) {
		if (n.gzhead.comment) {
			let t = n.pending, r;
			do {
				if (n.pending === n.pending_buf_size) {
					if (n.gzhead.hcrc && n.pending > t && (e.adler = P(e.adler, n.pending_buf, n.pending - t, t)), dt(e), n.pending !== 0) return n.last_flush = -1, 0;
					t = 0;
				}
				r = n.gzindex < n.gzhead.comment.length ? n.gzhead.comment.charCodeAt(n.gzindex++) & 255 : 0, L(n, r);
			} while (r !== 0);
			n.gzhead.hcrc && n.pending > t && (e.adler = P(e.adler, n.pending_buf, n.pending - t, t));
		}
		n.status = Qe;
	}
	if (n.status === Qe) {
		if (n.gzhead.hcrc) {
			if (n.pending + 2 > n.pending_buf_size && (dt(e), n.pending !== 0)) return n.last_flush = -1, 0;
			L(n, e.adler & 255), L(n, e.adler >> 8 & 255), e.adler = 0;
		}
		if (n.status = $e, dt(e), n.pending !== 0) return n.last_flush = -1, 0;
	}
	if (e.avail_in !== 0 || n.lookahead !== 0 || t !== 0 && n.status !== et) {
		let r = n.level === 0 ? _t(n, t) : n.strategy === 2 ? xt(n, t) : n.strategy === 3 ? bt(n, t) : Ct[n.level].func(n, t);
		if ((r === nt || r === rt) && (n.status = et), r === I || r === nt) return e.avail_out === 0 && (n.last_flush = -1), 0;
		if (r === tt && (t === 1 ? Ie(n) : t !== 5 && (Fe(n, 0, 0, !1), t === 3 && (st(n.head), n.lookahead === 0 && (n.strstart = 0, n.block_start = 0, n.insert = 0))), dt(e), e.avail_out === 0)) return n.last_flush = -1, 0;
	}
	return t === 4 ? n.wrap <= 0 ? 1 : (n.wrap === 2 ? (L(n, e.adler & 255), L(n, e.adler >> 8 & 255), L(n, e.adler >> 16 & 255), L(n, e.adler >> 24 & 255), L(n, e.total_in & 255), L(n, e.total_in >> 8 & 255), L(n, e.total_in >> 16 & 255), L(n, e.total_in >> 24 & 255)) : (pt(n, e.adler >>> 16), pt(n, e.adler & 65535)), dt(e), n.wrap > 0 && (n.wrap = -n.wrap), +(n.pending === 0)) : 0;
}, jt = (e) => {
	if (Et(e)) return -2;
	let t = e.state.status;
	return e.state = null, t === $e ? at(e, -3) : 0;
}, Mt = (e, t) => {
	let n = t.length;
	if (Et(e)) return -2;
	let r = e.state, i = r.wrap;
	if (i === 2 || i === 1 && r.status !== qe || r.lookahead) return -2;
	if (i === 1 && (e.adler = ze(e.adler, t, n, 0)), r.wrap = 0, n >= r.w_size) {
		i === 0 && (st(r.head), r.strstart = 0, r.block_start = 0, r.insert = 0);
		let e = new Uint8Array(r.w_size);
		e.set(t.subarray(n - r.w_size, n), 0), t = e, n = r.w_size;
	}
	let a = e.avail_in, o = e.next_in, s = e.input;
	for (e.avail_in = n, e.next_in = 0, e.input = t, gt(r); r.lookahead >= F;) {
		let e = r.strstart, t = r.lookahead - (F - 1);
		do
			ut(r, e), e++;
		while (--t);
		r.strstart = e, r.lookahead = F - 1, gt(r);
	}
	return r.strstart += r.lookahead, r.block_start = r.strstart, r.insert = r.lookahead, r.lookahead = 0, r.match_length = r.prev_length = F - 1, r.match_available = 0, e.next_in = o, e.input = s, e.avail_in = a, r.wrap = i, 0;
}, Nt = 16209, Pt = 16191;
function Ft(e, t) {
	let n, r, i, a, o, s, c, l, u, d, f, p, m, h, g, _, v, y, b, x, S, C, w, T, E = e.state;
	n = e.next_in, w = e.input, r = n + (e.avail_in - 5), i = e.next_out, T = e.output, a = i - (t - e.avail_out), o = i + (e.avail_out - 257), s = E.dmax, c = E.wsize, l = E.whave, u = E.wnext, d = E.window, f = E.hold, p = E.bits, m = E.lencode, h = E.distcode, g = (1 << E.lenbits) - 1, _ = (1 << E.distbits) - 1;
	top: do {
		p < 15 && (f += w[n++] << p, p += 8, f += w[n++] << p, p += 8), v = m[f & g];
		dolen: for (;;) {
			if (y = v >>> 24, f >>>= y, p -= y, y = v >>> 16 & 255, y === 0) T[i++] = v & 65535;
			else if (y & 16) {
				b = v & 65535, y &= 15, y && (p < y && (f += w[n++] << p, p += 8), b += f & (1 << y) - 1, f >>>= y, p -= y), p < 15 && (f += w[n++] << p, p += 8, f += w[n++] << p, p += 8), v = h[f & _];
				dodist: for (;;) {
					if (y = v >>> 24, f >>>= y, p -= y, y = v >>> 16 & 255, y & 16) {
						if (x = v & 65535, y &= 15, p < y && (f += w[n++] << p, p += 8, p < y && (f += w[n++] << p, p += 8)), x += f & (1 << y) - 1, x > s) {
							e.msg = "invalid distance too far back", E.mode = Nt;
							break top;
						}
						if (f >>>= y, p -= y, y = i - a, x > y) {
							if (y = x - y, y > l && E.sane) {
								e.msg = "invalid distance too far back", E.mode = Nt;
								break top;
							}
							if (S = 0, C = d, u === 0) {
								if (S += c - y, y < b) {
									b -= y;
									do
										T[i++] = d[S++];
									while (--y);
									S = i - x, C = T;
								}
							} else if (u < y) {
								if (S += c + u - y, y -= u, y < b) {
									b -= y;
									do
										T[i++] = d[S++];
									while (--y);
									if (S = 0, u < b) {
										y = u, b -= y;
										do
											T[i++] = d[S++];
										while (--y);
										S = i - x, C = T;
									}
								}
							} else if (S += u - y, y < b) {
								b -= y;
								do
									T[i++] = d[S++];
								while (--y);
								S = i - x, C = T;
							}
							for (; b > 2;) T[i++] = C[S++], T[i++] = C[S++], T[i++] = C[S++], b -= 3;
							b && (T[i++] = C[S++], b > 1 && (T[i++] = C[S++]));
						} else {
							S = i - x;
							do
								T[i++] = T[S++], T[i++] = T[S++], T[i++] = T[S++], b -= 3;
							while (b > 2);
							b && (T[i++] = T[S++], b > 1 && (T[i++] = T[S++]));
						}
					} else if (y & 64) {
						e.msg = "invalid distance code", E.mode = Nt;
						break top;
					} else {
						v = h[(v & 65535) + (f & (1 << y) - 1)];
						continue dodist;
					}
					break;
				}
			} else if (!(y & 64)) {
				v = m[(v & 65535) + (f & (1 << y) - 1)];
				continue dolen;
			} else if (y & 32) {
				E.mode = Pt;
				break top;
			} else {
				e.msg = "invalid literal/length code", E.mode = Nt;
				break top;
			}
			break;
		}
	} while (n < r && i < o);
	b = p >> 3, n -= b, p -= b << 3, f &= (1 << p) - 1, e.next_in = n, e.next_out = i, e.avail_in = n < r ? 5 + (r - n) : 5 - (n - r), e.avail_out = i < o ? 257 + (o - i) : 257 - (i - o), E.hold = f, E.bits = p;
}
var It = 15, Lt = 852, Rt = 592, zt = 0, Bt = 1, Vt = 2, Ht = new Uint16Array([
	3,
	4,
	5,
	6,
	7,
	8,
	9,
	10,
	11,
	13,
	15,
	17,
	19,
	23,
	27,
	31,
	35,
	43,
	51,
	59,
	67,
	83,
	99,
	115,
	131,
	163,
	195,
	227,
	258,
	0,
	0
]), Ut = new Uint8Array([
	16,
	16,
	16,
	16,
	16,
	16,
	16,
	16,
	17,
	17,
	17,
	17,
	18,
	18,
	18,
	18,
	19,
	19,
	19,
	19,
	20,
	20,
	20,
	20,
	21,
	21,
	21,
	21,
	16,
	199,
	75
]), Wt = new Uint16Array([
	1,
	2,
	3,
	4,
	5,
	7,
	9,
	13,
	17,
	25,
	33,
	49,
	65,
	97,
	129,
	193,
	257,
	385,
	513,
	769,
	1025,
	1537,
	2049,
	3073,
	4097,
	6145,
	8193,
	12289,
	16385,
	24577,
	0,
	0
]), Gt = new Uint8Array([
	16,
	16,
	16,
	16,
	17,
	17,
	18,
	18,
	19,
	19,
	20,
	20,
	21,
	21,
	22,
	22,
	23,
	23,
	24,
	24,
	25,
	25,
	26,
	26,
	27,
	27,
	28,
	28,
	29,
	29,
	64,
	64
]), Kt = (e, t, n, r, i, a, o, s) => {
	let c = s.bits, l = 0, u = 0, d = 0, f = 0, p = 0, m = 0, h = 0, g = 0, _ = 0, v = 0, y, b, x, S, C, w = null, T, E = /* @__PURE__ */ new Uint16Array(16), D = /* @__PURE__ */ new Uint16Array(16), O = null, k, A, j;
	for (l = 0; l <= It; l++) E[l] = 0;
	for (u = 0; u < r; u++) E[t[n + u]]++;
	for (p = c, f = It; f >= 1 && E[f] === 0; f--);
	if (p > f && (p = f), f === 0) return i[a++] = 20971520, i[a++] = 20971520, s.bits = 1, 0;
	for (d = 1; d < f && E[d] === 0; d++);
	for (p < d && (p = d), g = 1, l = 1; l <= It; l++) if (g <<= 1, g -= E[l], g < 0) return -1;
	if (g > 0 && (e === zt || f !== 1)) return -1;
	for (D[1] = 0, l = 1; l < It; l++) D[l + 1] = D[l] + E[l];
	for (u = 0; u < r; u++) t[n + u] !== 0 && (o[D[t[n + u]]++] = u);
	if (e === zt ? (w = O = o, T = 20) : e === Bt ? (w = Ht, O = Ut, T = 257) : (w = Wt, O = Gt, T = 0), v = 0, u = 0, l = d, C = a, m = p, h = 0, x = -1, _ = 1 << p, S = _ - 1, e === Bt && _ > Lt || e === Vt && _ > Rt) return 1;
	for (;;) {
		k = l - h, o[u] + 1 < T ? (A = 0, j = o[u]) : o[u] >= T ? (A = O[o[u] - T], j = w[o[u] - T]) : (A = 96, j = 0), y = 1 << l - h, b = 1 << m, d = b;
		do
			b -= y, i[C + (v >> h) + b] = k << 24 | A << 16 | j | 0;
		while (b !== 0);
		for (y = 1 << l - 1; v & y;) y >>= 1;
		if (y === 0 ? v = 0 : (v &= y - 1, v += y), u++, --E[l] === 0) {
			if (l === f) break;
			l = t[n + o[u]];
		}
		if (l > p && (v & S) !== x) {
			for (h === 0 && (h = p), C += d, m = l - h, g = 1 << m; m + h < f && (g -= E[m + h], !(g <= 0));) m++, g <<= 1;
			if (_ += 1 << m, e === Bt && _ > Lt || e === Vt && _ > Rt) return 1;
			x = v & S, i[x] = p << 24 | m << 16 | C - a | 0;
		}
	}
	return v !== 0 && (i[C + v] = l - h << 24 | 4194304), s.bits = p, 0;
}, qt = 0, Jt = 1, Yt = 2, Xt = 16180, Zt = 16181, Qt = 16182, $t = 16183, en = 16184, tn = 16185, nn = 16186, rn = 16187, an = 16188, on = 16189, sn = 16190, cn = 16191, ln = 16192, un = 16193, dn = 16194, fn = 16195, pn = 16196, mn = 16197, hn = 16198, gn = 16199, _n = 16200, vn = 16201, yn = 16202, bn = 16203, xn = 16204, Sn = 16205, Cn = 16206, wn = 16207, Tn = 16208, R = 16209, En = 16210, Dn = 16211, On = 852, kn = 592, An = (e) => (e >>> 24 & 255) + (e >>> 8 & 65280) + ((e & 65280) << 8) + ((e & 255) << 24), jn = class {
	constructor() {
		this.strm = null, this.mode = 0, this.last = !1, this.wrap = 0, this.havedict = !1, this.flags = 0, this.dmax = 0, this.check = 0, this.total = 0, this.head = null, this.wbits = 0, this.wsize = 0, this.whave = 0, this.wnext = 0, this.window = null, this.hold = 0, this.bits = 0, this.length = 0, this.offset = 0, this.extra = 0, this.lencode = null, this.distcode = null, this.lenbits = 0, this.distbits = 0, this.ncode = 0, this.nlen = 0, this.ndist = 0, this.have = 0, this.next = null, this.lens = /* @__PURE__ */ new Uint16Array(320), this.work = /* @__PURE__ */ new Uint16Array(288), this.lendyn = null, this.distdyn = null, this.sane = 0, this.back = 0, this.was = 0;
	}
}, Mn = (e) => {
	if (!e) return 1;
	let t = e.state;
	return +(!t || t.strm !== e || t.mode < Xt || t.mode > Dn);
}, Nn = (e) => {
	if (Mn(e)) return -2;
	let t = e.state;
	return e.total_in = e.total_out = t.total = 0, e.msg = "", t.wrap && (e.adler = t.wrap & 1), t.mode = Xt, t.last = 0, t.havedict = 0, t.flags = -1, t.dmax = 32768, t.head = null, t.hold = 0, t.bits = 0, t.lencode = t.lendyn = new Int32Array(On), t.distcode = t.distdyn = new Int32Array(kn), t.sane = 1, t.back = -1, 0;
}, Pn = (e) => {
	if (Mn(e)) return -2;
	let t = e.state;
	return t.wsize = 0, t.whave = 0, t.wnext = 0, Nn(e);
}, Fn = (e, t) => {
	let n;
	if (Mn(e)) return -2;
	let r = e.state;
	return t < 0 ? (n = 0, t = -t) : (n = (t >> 4) + 5, t < 48 && (t &= 15)), t && (t < 8 || t > 15) ? -2 : (r.window !== null && r.wbits !== t && (r.window = null), r.wrap = n, r.wbits = t, Pn(e));
}, In = (e, t) => {
	if (!e) return -2;
	let n = new jn();
	e.state = n, n.strm = e, n.window = null, n.mode = Xt;
	let r = Fn(e, t);
	return r !== 0 && (e.state = null), r;
}, Ln = !0, Rn, zn, Bn = (e) => {
	if (Ln) {
		Rn = /* @__PURE__ */ new Int32Array(512), zn = /* @__PURE__ */ new Int32Array(32);
		let t = 0;
		for (; t < 144;) e.lens[t++] = 8;
		for (; t < 256;) e.lens[t++] = 9;
		for (; t < 280;) e.lens[t++] = 7;
		for (; t < 288;) e.lens[t++] = 8;
		for (Kt(Jt, e.lens, 0, 288, Rn, 0, e.work, { bits: 9 }), t = 0; t < 32;) e.lens[t++] = 5;
		Kt(Yt, e.lens, 0, 32, zn, 0, e.work, { bits: 5 }), Ln = !1;
	}
	e.lencode = Rn, e.lenbits = 9, e.distcode = zn, e.distbits = 5;
}, Vn = (e, t, n, r) => {
	let i, a = e.state;
	return a.window === null && (a.window = new Uint8Array(1 << a.wbits)), a.wsize === 0 && (a.wsize = 1 << a.wbits, a.wnext = 0, a.whave = 0), r >= a.wsize ? (a.window.set(t.subarray(n - a.wsize, n), 0), a.wnext = 0, a.whave = a.wsize) : (i = a.wsize - a.wnext, i > r && (i = r), a.window.set(t.subarray(n - r, n - r + i), a.wnext), r -= i, r ? (a.window.set(t.subarray(n - r, n), 0), a.wnext = r, a.whave = a.wsize) : (a.wnext += i, a.wnext === a.wsize && (a.wnext = 0), a.whave < a.wsize && (a.whave += i))), 0;
}, Hn = (e, t) => {
	let n, r, i, a, o, s, c, l, u, d, f, p, m, h, g = 0, _, v, y, b, x, S, C, w, T = /* @__PURE__ */ new Uint8Array(4), E, D, O = new Uint8Array([
		16,
		17,
		18,
		0,
		8,
		7,
		9,
		6,
		10,
		5,
		11,
		4,
		12,
		3,
		13,
		2,
		14,
		1,
		15
	]);
	if (Mn(e) || !e.output || !e.input && e.avail_in !== 0) return -2;
	n = e.state, n.mode === cn && (n.mode = ln), o = e.next_out, i = e.output, c = e.avail_out, a = e.next_in, r = e.input, s = e.avail_in, l = n.hold, u = n.bits, d = s, f = c, w = 0;
	inf_leave: for (;;) switch (n.mode) {
		case Xt:
			if (n.wrap === 0) {
				n.mode = ln;
				break;
			}
			for (; u < 16;) {
				if (s === 0) break inf_leave;
				s--, l += r[a++] << u, u += 8;
			}
			if (n.wrap & 2 && l === 35615) {
				n.wbits === 0 && (n.wbits = 15), n.check = 0, T[0] = l & 255, T[1] = l >>> 8 & 255, n.check = P(n.check, T, 2, 0), l = 0, u = 0, n.mode = Zt;
				break;
			}
			if (n.head && (n.head.done = !1), !(n.wrap & 1) || (((l & 255) << 8) + (l >> 8)) % 31) {
				e.msg = "incorrect header check", n.mode = R;
				break;
			}
			if ((l & 15) != 8) {
				e.msg = "unknown compression method", n.mode = R;
				break;
			}
			if (l >>>= 4, u -= 4, C = (l & 15) + 8, n.wbits === 0 && (n.wbits = C), C > 15 || C > n.wbits) {
				e.msg = "invalid window size", n.mode = R;
				break;
			}
			n.dmax = 1 << n.wbits, n.flags = 0, e.adler = n.check = 1, n.mode = l & 512 ? on : cn, l = 0, u = 0;
			break;
		case Zt:
			for (; u < 16;) {
				if (s === 0) break inf_leave;
				s--, l += r[a++] << u, u += 8;
			}
			if (n.flags = l, (n.flags & 255) != 8) {
				e.msg = "unknown compression method", n.mode = R;
				break;
			}
			if (n.flags & 57344) {
				e.msg = "unknown header flags set", n.mode = R;
				break;
			}
			n.head && (n.head.text = l >> 8 & 1), n.flags & 512 && n.wrap & 4 && (T[0] = l & 255, T[1] = l >>> 8 & 255, n.check = P(n.check, T, 2, 0)), l = 0, u = 0, n.mode = Qt;
		case Qt:
			for (; u < 32;) {
				if (s === 0) break inf_leave;
				s--, l += r[a++] << u, u += 8;
			}
			n.head && (n.head.time = l), n.flags & 512 && n.wrap & 4 && (T[0] = l & 255, T[1] = l >>> 8 & 255, T[2] = l >>> 16 & 255, T[3] = l >>> 24 & 255, n.check = P(n.check, T, 4, 0)), l = 0, u = 0, n.mode = $t;
		case $t:
			for (; u < 16;) {
				if (s === 0) break inf_leave;
				s--, l += r[a++] << u, u += 8;
			}
			n.head && (n.head.xflags = l & 255, n.head.os = l >> 8), n.flags & 512 && n.wrap & 4 && (T[0] = l & 255, T[1] = l >>> 8 & 255, n.check = P(n.check, T, 2, 0)), l = 0, u = 0, n.mode = en;
		case en:
			if (n.flags & 1024) {
				for (; u < 16;) {
					if (s === 0) break inf_leave;
					s--, l += r[a++] << u, u += 8;
				}
				n.length = l, n.head && (n.head.extra_len = l), n.flags & 512 && n.wrap & 4 && (T[0] = l & 255, T[1] = l >>> 8 & 255, n.check = P(n.check, T, 2, 0)), l = 0, u = 0;
			} else n.head && (n.head.extra = null);
			n.mode = tn;
		case tn:
			if (n.flags & 1024 && (p = n.length, p > s && (p = s), p && (n.head && (C = n.head.extra_len - n.length, n.head.extra || (n.head.extra = new Uint8Array(n.head.extra_len)), n.head.extra.set(r.subarray(a, a + p), C)), n.flags & 512 && n.wrap & 4 && (n.check = P(n.check, r, p, a)), s -= p, a += p, n.length -= p), n.length)) break inf_leave;
			n.length = 0, n.mode = nn;
		case nn:
			if (n.flags & 2048) {
				if (s === 0) break inf_leave;
				p = 0;
				do
					C = r[a + p++], n.head && C && n.length < 65536 && (n.head.name += String.fromCharCode(C));
				while (C && p < s);
				if (n.flags & 512 && n.wrap & 4 && (n.check = P(n.check, r, p, a)), s -= p, a += p, C) break inf_leave;
			} else n.head && (n.head.name = null);
			n.length = 0, n.mode = rn;
		case rn:
			if (n.flags & 4096) {
				if (s === 0) break inf_leave;
				p = 0;
				do
					C = r[a + p++], n.head && C && n.length < 65536 && (n.head.comment += String.fromCharCode(C));
				while (C && p < s);
				if (n.flags & 512 && n.wrap & 4 && (n.check = P(n.check, r, p, a)), s -= p, a += p, C) break inf_leave;
			} else n.head && (n.head.comment = null);
			n.mode = an;
		case an:
			if (n.flags & 512) {
				for (; u < 16;) {
					if (s === 0) break inf_leave;
					s--, l += r[a++] << u, u += 8;
				}
				if (n.wrap & 4 && l !== (n.check & 65535)) {
					e.msg = "header crc mismatch", n.mode = R;
					break;
				}
				l = 0, u = 0;
			}
			n.head && (n.head.hcrc = n.flags >> 9 & 1, n.head.done = !0), e.adler = n.check = 0, n.mode = cn;
			break;
		case on:
			for (; u < 32;) {
				if (s === 0) break inf_leave;
				s--, l += r[a++] << u, u += 8;
			}
			e.adler = n.check = An(l), l = 0, u = 0, n.mode = sn;
		case sn:
			if (n.havedict === 0) return e.next_out = o, e.avail_out = c, e.next_in = a, e.avail_in = s, n.hold = l, n.bits = u, 2;
			e.adler = n.check = 1, n.mode = cn;
		case cn: if (t === 5 || t === 6) break inf_leave;
		case ln:
			if (n.last) {
				l >>>= u & 7, u -= u & 7, n.mode = Cn;
				break;
			}
			for (; u < 3;) {
				if (s === 0) break inf_leave;
				s--, l += r[a++] << u, u += 8;
			}
			switch (n.last = l & 1, l >>>= 1, --u, l & 3) {
				case 0:
					n.mode = un;
					break;
				case 1:
					if (Bn(n), n.mode = gn, t === 6) {
						l >>>= 2, u -= 2;
						break inf_leave;
					}
					break;
				case 2:
					n.mode = pn;
					break;
				case 3: e.msg = "invalid block type", n.mode = R;
			}
			l >>>= 2, u -= 2;
			break;
		case un:
			for (l >>>= u & 7, u -= u & 7; u < 32;) {
				if (s === 0) break inf_leave;
				s--, l += r[a++] << u, u += 8;
			}
			if ((l & 65535) != (l >>> 16 ^ 65535)) {
				e.msg = "invalid stored block lengths", n.mode = R;
				break;
			}
			if (n.length = l & 65535, l = 0, u = 0, n.mode = dn, t === 6) break inf_leave;
		case dn: n.mode = fn;
		case fn:
			if (p = n.length, p) {
				if (p > s && (p = s), p > c && (p = c), p === 0) break inf_leave;
				i.set(r.subarray(a, a + p), o), s -= p, a += p, c -= p, o += p, n.length -= p;
				break;
			}
			n.mode = cn;
			break;
		case pn:
			for (; u < 14;) {
				if (s === 0) break inf_leave;
				s--, l += r[a++] << u, u += 8;
			}
			if (n.nlen = (l & 31) + 257, l >>>= 5, u -= 5, n.ndist = (l & 31) + 1, l >>>= 5, u -= 5, n.ncode = (l & 15) + 4, l >>>= 4, u -= 4, n.nlen > 286 || n.ndist > 30) {
				e.msg = "too many length or distance symbols", n.mode = R;
				break;
			}
			n.have = 0, n.mode = mn;
		case mn:
			for (; n.have < n.ncode;) {
				for (; u < 3;) {
					if (s === 0) break inf_leave;
					s--, l += r[a++] << u, u += 8;
				}
				n.lens[O[n.have++]] = l & 7, l >>>= 3, u -= 3;
			}
			for (; n.have < 19;) n.lens[O[n.have++]] = 0;
			if (n.lencode = n.lendyn, n.lenbits = 7, E = { bits: n.lenbits }, w = Kt(qt, n.lens, 0, 19, n.lencode, 0, n.work, E), n.lenbits = E.bits, w) {
				e.msg = "invalid code lengths set", n.mode = R;
				break;
			}
			n.have = 0, n.mode = hn;
		case hn:
			for (; n.have < n.nlen + n.ndist;) {
				for (; g = n.lencode[l & (1 << n.lenbits) - 1], _ = g >>> 24, v = g >>> 16 & 255, y = g & 65535, !(_ <= u);) {
					if (s === 0) break inf_leave;
					s--, l += r[a++] << u, u += 8;
				}
				if (y < 16) l >>>= _, u -= _, n.lens[n.have++] = y;
				else {
					if (y === 16) {
						for (D = _ + 2; u < D;) {
							if (s === 0) break inf_leave;
							s--, l += r[a++] << u, u += 8;
						}
						if (l >>>= _, u -= _, n.have === 0) {
							e.msg = "invalid bit length repeat", n.mode = R;
							break;
						}
						C = n.lens[n.have - 1], p = 3 + (l & 3), l >>>= 2, u -= 2;
					} else if (y === 17) {
						for (D = _ + 3; u < D;) {
							if (s === 0) break inf_leave;
							s--, l += r[a++] << u, u += 8;
						}
						l >>>= _, u -= _, C = 0, p = 3 + (l & 7), l >>>= 3, u -= 3;
					} else {
						for (D = _ + 7; u < D;) {
							if (s === 0) break inf_leave;
							s--, l += r[a++] << u, u += 8;
						}
						l >>>= _, u -= _, C = 0, p = 11 + (l & 127), l >>>= 7, u -= 7;
					}
					if (n.have + p > n.nlen + n.ndist) {
						e.msg = "invalid bit length repeat", n.mode = R;
						break;
					}
					for (; p--;) n.lens[n.have++] = C;
				}
			}
			if (n.mode === R) break;
			if (n.lens[256] === 0) {
				e.msg = "invalid code -- missing end-of-block", n.mode = R;
				break;
			}
			if (n.lenbits = 9, E = { bits: n.lenbits }, w = Kt(Jt, n.lens, 0, n.nlen, n.lencode, 0, n.work, E), n.lenbits = E.bits, w) {
				e.msg = "invalid literal/lengths set", n.mode = R;
				break;
			}
			if (n.distbits = 6, n.distcode = n.distdyn, E = { bits: n.distbits }, w = Kt(Yt, n.lens, n.nlen, n.ndist, n.distcode, 0, n.work, E), n.distbits = E.bits, w) {
				e.msg = "invalid distances set", n.mode = R;
				break;
			}
			if (n.mode = gn, t === 6) break inf_leave;
		case gn: n.mode = _n;
		case _n:
			if (s >= 6 && c >= 258) {
				e.next_out = o, e.avail_out = c, e.next_in = a, e.avail_in = s, n.hold = l, n.bits = u, Ft(e, f), o = e.next_out, i = e.output, c = e.avail_out, a = e.next_in, r = e.input, s = e.avail_in, l = n.hold, u = n.bits, n.mode === cn && (n.back = -1);
				break;
			}
			for (n.back = 0; g = n.lencode[l & (1 << n.lenbits) - 1], _ = g >>> 24, v = g >>> 16 & 255, y = g & 65535, !(_ <= u);) {
				if (s === 0) break inf_leave;
				s--, l += r[a++] << u, u += 8;
			}
			if (v && !(v & 240)) {
				for (b = _, x = v, S = y; g = n.lencode[S + ((l & (1 << b + x) - 1) >> b)], _ = g >>> 24, v = g >>> 16 & 255, y = g & 65535, !(b + _ <= u);) {
					if (s === 0) break inf_leave;
					s--, l += r[a++] << u, u += 8;
				}
				l >>>= b, u -= b, n.back += b;
			}
			if (l >>>= _, u -= _, n.back += _, n.length = y, v === 0) {
				n.mode = Sn;
				break;
			}
			if (v & 32) {
				n.back = -1, n.mode = cn;
				break;
			}
			if (v & 64) {
				e.msg = "invalid literal/length code", n.mode = R;
				break;
			}
			n.extra = v & 15, n.mode = vn;
		case vn:
			if (n.extra) {
				for (D = n.extra; u < D;) {
					if (s === 0) break inf_leave;
					s--, l += r[a++] << u, u += 8;
				}
				n.length += l & (1 << n.extra) - 1, l >>>= n.extra, u -= n.extra, n.back += n.extra;
			}
			n.was = n.length, n.mode = yn;
		case yn:
			for (; g = n.distcode[l & (1 << n.distbits) - 1], _ = g >>> 24, v = g >>> 16 & 255, y = g & 65535, !(_ <= u);) {
				if (s === 0) break inf_leave;
				s--, l += r[a++] << u, u += 8;
			}
			if (!(v & 240)) {
				for (b = _, x = v, S = y; g = n.distcode[S + ((l & (1 << b + x) - 1) >> b)], _ = g >>> 24, v = g >>> 16 & 255, y = g & 65535, !(b + _ <= u);) {
					if (s === 0) break inf_leave;
					s--, l += r[a++] << u, u += 8;
				}
				l >>>= b, u -= b, n.back += b;
			}
			if (l >>>= _, u -= _, n.back += _, v & 64) {
				e.msg = "invalid distance code", n.mode = R;
				break;
			}
			n.offset = y, n.extra = v & 15, n.mode = bn;
		case bn:
			if (n.extra) {
				for (D = n.extra; u < D;) {
					if (s === 0) break inf_leave;
					s--, l += r[a++] << u, u += 8;
				}
				n.offset += l & (1 << n.extra) - 1, l >>>= n.extra, u -= n.extra, n.back += n.extra;
			}
			if (n.offset > n.dmax) {
				e.msg = "invalid distance too far back", n.mode = R;
				break;
			}
			n.mode = xn;
		case xn:
			if (c === 0) break inf_leave;
			if (p = f - c, n.offset > p) {
				if (p = n.offset - p, p > n.whave && n.sane) {
					e.msg = "invalid distance too far back", n.mode = R;
					break;
				}
				p > n.wnext ? (p -= n.wnext, m = n.wsize - p) : m = n.wnext - p, p > n.length && (p = n.length), h = n.window;
			} else h = i, m = o - n.offset, p = n.length;
			p > c && (p = c), c -= p, n.length -= p;
			do
				i[o++] = h[m++];
			while (--p);
			n.length === 0 && (n.mode = _n);
			break;
		case Sn:
			if (c === 0) break inf_leave;
			i[o++] = n.length, c--, n.mode = _n;
			break;
		case Cn:
			if (n.wrap) {
				for (; u < 32;) {
					if (s === 0) break inf_leave;
					s--, l |= r[a++] << u, u += 8;
				}
				if (f -= c, e.total_out += f, n.total += f, n.wrap & 4 && f && (e.adler = n.check = n.flags ? P(n.check, i, f, o - f) : ze(n.check, i, f, o - f)), f = c, n.wrap & 4 && (n.flags ? l : An(l)) !== n.check) {
					e.msg = "incorrect data check", n.mode = R;
					break;
				}
				l = 0, u = 0;
			}
			n.mode = wn;
		case wn:
			if (n.wrap && n.flags) {
				for (; u < 32;) {
					if (s === 0) break inf_leave;
					s--, l += r[a++] << u, u += 8;
				}
				if (n.wrap & 4 && l !== (n.total & 4294967295)) {
					e.msg = "incorrect length check", n.mode = R;
					break;
				}
				l = 0, u = 0;
			}
			n.mode = Tn;
		case Tn:
			w = 1;
			break inf_leave;
		case R:
			w = -3;
			break inf_leave;
		case En: return -4;
		case Dn:
		default: return -2;
	}
	return e.next_out = o, e.avail_out = c, e.next_in = a, e.avail_in = s, n.hold = l, n.bits = u, (n.wsize || f !== e.avail_out && n.mode < R && (n.mode < Cn || t !== 4)) && Vn(e, e.output, e.next_out, f - e.avail_out) ? (n.mode = En, -4) : (d -= e.avail_in, f -= e.avail_out, e.total_in += d, e.total_out += f, n.total += f, n.wrap & 4 && f && (e.adler = n.check = n.flags ? P(n.check, i, f, e.next_out - f) : ze(n.check, i, f, e.next_out - f)), e.data_type = n.bits + (n.last ? 64 : 0) + (n.mode === cn ? 128 : 0) + (n.mode === gn || n.mode === dn ? 256 : 0), (d === 0 && f === 0 || t === 4) && w === 0 && (w = -5), w);
}, Un = (e) => {
	if (Mn(e)) return -2;
	let t = e.state;
	return t.window && (t.window = null), e.state = null, 0;
}, Wn = (e, t) => {
	let n = t.length, r, i, a;
	return Mn(e) || (r = e.state, r.wrap !== 0 && r.mode !== sn) ? -2 : r.mode === sn && (i = 1, i = ze(i, t, n, 0), i !== r.check) ? -3 : (a = Vn(e, t, n, n), a ? (r.mode = En, -4) : (r.havedict = 1, 0));
}, Gn = class {
	constructor() {
		this.input = null, this.next_in = 0, this.avail_in = 0, this.total_in = 0, this.output = null, this.next_out = 0, this.avail_out = 0, this.total_out = 0, this.msg = "", this.state = null, this.data_type = 2, this.adler = 0;
	}
}, Kn = (e) => {
	let t = new Uint8Array(e.reduce((e, t) => e + t.length, 0)), n = 0;
	for (let r of e) t.set(r, n), n += r.length;
	return t;
}, qn = Object.prototype.toString, Jn = {
	level: -1,
	chunkSize: 16384,
	windowBits: 15,
	memLevel: 8,
	strategy: 0,
	raw: !1,
	gzip: !1,
	legacyHash: !1,
	dictionary: /* @__PURE__ */ new Uint8Array()
}, Yn = class {
	constructor(e = {}) {
		l(this, "options", void 0), l(this, "err", void 0), l(this, "msg", void 0), l(this, "ended", void 0), l(this, "started", void 0), l(this, "chunks", void 0), l(this, "strm", void 0), l(this, "result", void 0), this.options = Object.assign({}, Jn, e);
		let t = this.options;
		t.raw && t.windowBits > 0 ? t.windowBits = -t.windowBits : t.gzip && t.windowBits > 0 && t.windowBits < 16 && (t.windowBits += 16), this.err = 0, this.msg = "", this.ended = !1, this.started = !1, this.chunks = [], this.result = /* @__PURE__ */ new Uint8Array(), this.strm = new Gn(), this.strm.avail_out = 0;
		let n = kt(this.strm, t.level, 8, t.windowBits, t.memLevel, t.strategy, t.legacyHash);
		if (n !== 0) throw Error(Ve[n]);
		qn.call(t.dictionary) === "[object ArrayBuffer]" && (t.dictionary = new Uint8Array(t.dictionary));
		let r = t.dictionary;
		if (r.length) {
			if (t.gzip) throw Error("dictionary is not supported with gzip");
			if (n = Mt(this.strm, r), n !== 0) throw Error(Ve[n]);
		}
	}
	push(e, t = !1) {
		let n = this.strm, r = this.options.chunkSize, i, a;
		if (this.ended) return !1;
		for (a = typeof t == "number" ? t : t === !0 ? 4 : 0, typeof e == "string" ? n.input = new TextEncoder().encode(e) : qn.call(e) === "[object ArrayBuffer]" ? n.input = new Uint8Array(e) : n.input = e, n.next_in = 0, n.avail_in = n.input.length, this.started || (this.started = !0, this.onStart(n));;) {
			if (n.avail_out === 0 && (n.output = new Uint8Array(r), n.next_out = 0, n.avail_out = r), (a === 2 || a === 3) && n.avail_out <= 6) {
				this.onData(n.output.subarray(0, n.next_out)), n.avail_out = 0;
				continue;
			}
			if (i = At(n, a), i === 1) {
				n.next_out > 0 && this.onData(n.output.subarray(0, n.next_out)), i = jt(this.strm);
				break;
			}
			if (n.avail_out === 0) {
				this.onData(n.output);
				continue;
			}
			if (a > 0 && n.next_out > 0) {
				this.onData(n.output.subarray(0, n.next_out)), n.avail_out = 0;
				continue;
			}
			if (n.avail_in === 0) return !0;
		}
		return this.err = i, this.msg = n.msg || Ve[i], this.ended = !0, this.onEnd(i), i === 0;
	}
	onStart(e) {}
	onData(e) {
		this.chunks.push(e);
	}
	onEnd(e) {
		e === 0 && (this.result = Kn(this.chunks)), this.chunks = [];
	}
};
function Xn(e, t = {}) {
	let n = new Yn(t);
	if (n.push(e, !0), n.err) throw Error(n.msg);
	return n.result;
}
var Zn = Object.prototype.toString, Qn = {
	chunkSize: 1024 * 64,
	windowBits: 15,
	raw: !1,
	dictionary: /* @__PURE__ */ new Uint8Array()
}, $n = class {
	constructor(e = {}) {
		l(this, "options", void 0), l(this, "err", void 0), l(this, "msg", void 0), l(this, "ended", void 0), l(this, "started", void 0), l(this, "chunks", void 0), l(this, "strm", void 0), l(this, "result", void 0), this.options = Object.assign({}, Qn, e);
		let t = this.options;
		t.raw && t.windowBits >= 0 && t.windowBits < 16 && (t.windowBits = -t.windowBits, t.windowBits === 0 && (t.windowBits = -15)), t.windowBits >= 0 && t.windowBits < 16 && !e.windowBits && (t.windowBits += 32), t.windowBits > 15 && t.windowBits < 48 && (t.windowBits & 15 || (t.windowBits |= 15)), this.err = 0, this.msg = "", this.ended = !1, this.started = !1, this.chunks = [], this.result = /* @__PURE__ */ new Uint8Array(), this.strm = new Gn(), this.strm.avail_out = 0;
		let n = In(this.strm, t.windowBits);
		if (n !== 0) throw Error(Ve[n]);
		Zn.call(t.dictionary) === "[object ArrayBuffer]" && (t.dictionary = new Uint8Array(t.dictionary));
		let r = t.dictionary;
		if (t.raw && r.length && (n = Wn(this.strm, r), n !== 0)) throw Error(Ve[n]);
	}
	push(e, t = !1) {
		let n = this.strm, r = this.options.chunkSize, i, a, o;
		if (this.ended) return this.err === 0;
		for (a = typeof t == "number" ? t : t === !0 ? 4 : 0, Zn.call(e) === "[object ArrayBuffer]" ? n.input = new Uint8Array(e) : n.input = e, n.next_in = 0, n.avail_in = n.input.length, this.started || (this.started = !0, this.onStart(n));;) {
			if (n.avail_out === 0 && (n.output = new Uint8Array(r), n.next_out = 0, n.avail_out = r), i = Hn(n, a), i === 2) {
				let e = this.options.dictionary;
				e.length && (i = Wn(n, e), i === 0 ? i = Hn(n, a) : i === -3 && (i = 2));
			}
			for (; n.avail_in > 0 && i === 1 && n.state.wrap & 2 && n.state.flags !== 0 && n.input[n.next_in] !== 0;) Pn(n), i = Hn(n, a);
			if (i === -2 || i === -3 || i === 2 || i === -4) break;
			if (o = n.avail_out, n.next_out && (n.avail_out === 0 || i === 1 || a > 0) && (this.onData(n.output.length === n.next_out ? n.output : n.output.subarray(0, n.next_out)), n.avail_out = 0, n.next_out = 0), !((i === 0 || i === -5) && o === 0)) {
				if (i === 1) {
					i = Un(this.strm);
					break;
				}
				if (n.avail_in === 0) {
					if (a === 4) {
						i = Un(this.strm), i === 0 && (i = -5);
						break;
					}
					return !0;
				}
			}
		}
		return this.err = i, this.msg = n.msg || Ve[i], this.ended = !0, this.onEnd(i), i === 0;
	}
	onStart(e) {}
	onData(e) {
		this.chunks.push(e);
	}
	onEnd(e) {
		e === 0 && (this.result = Kn(this.chunks)), this.chunks = [];
	}
};
function er(e, t = {}) {
	let n = new $n(t);
	if (n.push(e, !0), n.err) throw Error(n.msg);
	let r = n.result;
	return t.toText ? new TextDecoder().decode(r) : r;
}
//#endregion
//#region src/uuid.ts
var z = Array.from({ length: 256 }).map((e, t) => (t + 256).toString(16).substr(1));
function tr(e) {
	return (z[e[0]] + z[e[1]] + z[e[2]] + z[e[3]] + "-" + z[e[4]] + z[e[5]] + "-" + z[e[6]] + z[e[7]] + "-" + z[e[8]] + z[e[9]] + "-" + z[e[10]] + z[e[11]] + z[e[12]] + z[e[13]] + z[e[14]] + z[e[15]]).toLowerCase();
}
function nr(e) {
	let t, n = /* @__PURE__ */ new Uint8Array(16);
	return n[0] = (t = parseInt(e.slice(0, 8), 16)) >>> 24, n[1] = t >>> 16 & 255, n[2] = t >>> 8 & 255, n[3] = t & 255, n[4] = (t = parseInt(e.slice(9, 13), 16)) >>> 8, n[5] = t & 255, n[6] = (t = parseInt(e.slice(14, 18), 16)) >>> 8, n[7] = t & 255, n[8] = (t = parseInt(e.slice(19, 23), 16)) >>> 8, n[9] = t & 255, n[10] = (t = parseInt(e.slice(24, 36), 16)) / 1099511627776 & 255, n[11] = t / 4294967296 & 255, n[12] = t >>> 24 & 255, n[13] = t >>> 16 & 255, n[14] = t >>> 8 & 255, n[15] = t & 255, n;
}
//#endregion
//#region src/brs/utils.ts
var rr = /* @__PURE__ */ t({
	BitReader: () => Sr,
	BitWriter: () => Cr,
	bgra: () => B,
	chunk: () => cr,
	concat: () => H,
	isEqual: () => ar,
	read: () => U,
	subarray: () => sr,
	write: () => W
});
function ir(e) {
	return /^[\x00-\x7F]*$/.test(e);
}
var B = ([e, t, n, r]) => [
	n,
	t,
	e,
	r
];
function ar(e, t) {
	return e.length === t.length && e.every((e, n) => t[n] === e);
}
function or(e) {
	return e.brsOffset !== void 0;
}
function sr(e, t, n = !1) {
	if (!(e instanceof Uint8Array)) throw Error(`Invalid data type in bytes reader (${typeof e})`);
	let r;
	or(e) ? r = e : (r = e, r.brsOffset = 0);
	let i = r[n ? "slice" : "subarray"](r.brsOffset, r.brsOffset + t);
	return r.brsOffset += t, i;
}
function cr(e, t) {
	let n = e.length - (or(e) ? e.brsOffset : 0), r = Array(Math.floor(n / t));
	for (let i = 0; i < n / t; i++) r[i] = sr(e, t, !0);
	return r;
}
function V(e, t = !0) {
	let [n, r] = sr(e, 2);
	return t ? r << 8 | n : n << 8 | r;
}
function lr(e, t = !0) {
	let n = [e & 255, e >> 8 & 255];
	return new Uint8Array(t ? n : n.reverse());
}
function ur(e, t = !0) {
	let [n, r, i, a] = sr(e, 4);
	return t ? a << 24 | i << 16 | r << 8 | n : n << 24 | r << 16 | i << 8 | a;
}
function dr(e, t = !0) {
	let n = new Uint8Array([
		e & 255,
		e >> 8 & 255,
		e >> 16 & 255,
		e >> 24 & 255
	]);
	return t ? n : n.reverse();
}
function fr(e) {
	let t = ur(e), n = ur(e);
	if (n < 0 || t < 0 || n >= t) throw Error(`Invalid compressed section size (comp: ${n}, uncomp: ${t})`);
	return n === 0 ? sr(e, t) : er(sr(e, n));
}
function pr(...e) {
	let t = H(...e);
	return H(dr(t.length), dr(0), t);
}
function mr(...e) {
	let t = H(...e), n = Xn(t), r = t.length, i = n.length;
	if (r > 2147483647) throw Error(`uncompressedSize (${r}) out of range`);
	if (i > 2147483647) throw Error(`compressedSize (${i}) out of range`);
	let a = i >= r;
	return H(dr(r), dr(a ? 0 : i), a ? t : n);
}
function hr(e) {
	let t = ur(e), n = t < 0, r = n ? -t * 2 : t;
	if (n) {
		if (r % 2 != 0) throw Error("Invalid UCS-2 data size");
		return String.fromCodePoint(...cr(sr(e, r), 2).map((e) => V(e)));
	} else {
		let t = sr(e, r).subarray(0, -1);
		return String.fromCharCode.apply(null, t);
	}
}
function gr(e) {
	return ir(e) ? H(dr(e.length + 1), new Uint8Array(e.split("").map((e) => e.charCodeAt(0))), new Uint8Array([0])) : H(dr(-e.length), new Uint8Array(e.split("").flatMap((e) => [e.charCodeAt(0) & 255, e.charCodeAt(0) >> 8])));
}
function _r(e) {
	return tr(cr(sr(e, 16), 4).flatMap(([e, t, n, r]) => [
		r,
		n,
		t,
		e
	]));
}
function vr(e) {
	return H(...cr(nr(e), 4).map(([e, t, n, r]) => new Uint8Array([
		r,
		n,
		t,
		e
	])));
}
function yr(e, t) {
	let n = ur(e), r = Array(n);
	for (let i = 0; i < n; i++) r[i] = t(e);
	return r;
}
function br(e, t) {
	let n = ur(e);
	for (let r = 0; r < n; r++) t(e);
}
function xr(e, t) {
	return H(dr(e.length), ...e.map((e) => t(e)));
}
var Sr = class {
	constructor(e) {
		this.pos = 0, this.buffer = e;
	}
	empty() {
		return this.pos >= this.buffer.length * 8;
	}
	bit() {
		let e = (this.buffer[this.pos >> 3] & 1 << (this.pos & 7)) != 0;
		return this.pos++, e;
	}
	align() {
		this.pos = this.pos + 7 & -8;
	}
	int(e) {
		let t = 0, n = 1;
		for (; t + n < e && n !== 0;) this.bit() && (t |= n), n <<= 1;
		return t;
	}
	uint_packed() {
		let e = 0;
		for (let t = 0; t < 5; t++) {
			let n = this.bit(), r = 0;
			for (let e = 0; e < 7; e++) r |= +!!this.bit() << e;
			if (e |= r << 7 * t, !n) break;
		}
		return e;
	}
	int_packed() {
		let e = this.uint_packed();
		return (e >> 1) * (e & 1 ? 1 : -1);
	}
	bits(e) {
		let t = [];
		for (let n = 0; n < e; n++) {
			let e = n & 7;
			t[n >> 3] = t[n >> 3] & ~(1 << e) | +!!this.bit() << e;
		}
		return t;
	}
	bytes(e) {
		return new Uint8Array(this.bytesArr(e));
	}
	bytesArr(e) {
		return this.bits(e * 8);
	}
	array(e) {
		let t = ur(this.bytes(4)), n = Array(t);
		for (let r = 0; r < t; r++) n[r] = e(this);
		return n;
	}
	each(e) {
		let t = ur(this.bytes(4));
		for (let n = 0; n < t; n++) e(this);
	}
	string() {
		let e = this.bytesArr(4), t = ur(new Uint8Array(e));
		return t < 0 && (t = -t * 2), hr(new Uint8Array(e.concat(this.bytesArr(t))));
	}
	float() {
		let e = /* @__PURE__ */ new DataView(/* @__PURE__ */ new ArrayBuffer(4));
		return e.setUint16(2, V(this.bytes(2))), e.setUint16(0, V(this.bytes(2))), e.getFloat32(0);
	}
	integer() {
		let e = /* @__PURE__ */ new DataView(/* @__PURE__ */ new ArrayBuffer(4));
		return e.setUint16(2, V(this.bytes(2))), e.setUint16(0, V(this.bytes(2))), e.getInt32(0);
	}
	int64() {
		let e = /* @__PURE__ */ new DataView(/* @__PURE__ */ new ArrayBuffer(8));
		e.setUint16(6, V(this.bytes(2))), e.setUint16(4, V(this.bytes(2))), e.setUint16(2, V(this.bytes(2))), e.setUint16(0, V(this.bytes(2)));
		let t = e.getBigInt64(0);
		if (t <= 1n << 64n) return Number(t);
		throw Error(`Cannot read 64-bit integer ${t} as a JavaScript number...`);
	}
	double() {
		let e = /* @__PURE__ */ new DataView(/* @__PURE__ */ new ArrayBuffer(8));
		return e.setUint16(6, V(this.bytes(2))), e.setUint16(4, V(this.bytes(2))), e.setUint16(2, V(this.bytes(2))), e.setUint16(0, V(this.bytes(2))), e.getFloat64(0);
	}
	wireGraphVariant() {
		let e = this.bytes(1)[0];
		switch (e) {
			case 0: return { number: this.double() };
			case 1: return { integer: this.int64() };
			case 2: return { bool: this.bytes(1)[0] !== 0 };
			case 3: return { exec: !0 };
			case 4: return { object: !0 };
			default: throw Error(`Unknown wire graph variant type ${e}`);
		}
	}
	unreal(e) {
		switch (e) {
			case "String":
			case "Class":
			case "Object": return this.string();
			case "Boolean": return !!ur(this.bytes(4));
			case "Integer": return this.integer();
			case "Integer64": return this.int64();
			case "Float": return this.float();
			case "Double": return this.double();
			case "Color": return B(this.bytesArr(4));
			case "Byte": return this.bytes(1)[0];
			case "Rotator":
			case "Rotator3d": return [
				this.float(),
				this.float(),
				this.float()
			];
			case "Vector3d": return [
				this.float(),
				this.float(),
				this.float()
			];
			case "IntVector": return [
				this.integer(),
				this.integer(),
				this.integer()
			];
			case "BRInventoryEntryPlan": return this.string();
			case "WireGraphVariant": return this.wireGraphVariant();
			case "WireGraphPrimMathVariant": return this.wireGraphVariant();
		}
		throw Error("Unknown unreal type " + e);
	}
}, Cr = class {
	constructor() {
		this.buffer = [], this.cur = 0, this.bitNum = 0;
	}
	bit(e) {
		this.cur |= +!!e << this.bitNum, this.bitNum++, this.bitNum >= 8 && this.align();
	}
	bits(e, t) {
		for (let n = 0; n < t; n++) this.bit((e[n >> 3] & 1 << (n & 7)) != 0);
	}
	bytes(e) {
		this.bits(e, 8 * e.length);
	}
	align() {
		this.bitNum > 0 && (this.buffer.push(this.cur), this.cur = 0, this.bitNum = 0);
	}
	int(e, t) {
		if (t < 2) throw Error(`Invalid input (BitWriter) -- max (${t}) must be at least 2`);
		if (e >= t) throw Error(`Invalid input (BitWriter) -- value (${e}) is larger than max (${t})`);
		let n = 0, r = 1;
		for (; n + r < t && r !== 0;) this.bit((e & r) !== 0), (e & r) !== 0 && (n |= r), r <<= 1;
	}
	uint_packed(e) {
		do {
			let t = e & 127;
			e >>= 7, this.bit(e !== 0), this.bits([t], 7);
		} while (e !== 0);
	}
	int_packed(e) {
		this.uint_packed(Math.abs(e) << 1 | e >= 0);
	}
	finish() {
		return this.align(), new Uint8Array(this.buffer);
	}
	finishSection() {
		return this.align(), H(dr(this.buffer.length), new Uint8Array(this.buffer));
	}
	string(e) {
		this.bytes(gr(e));
	}
	float(e) {
		let t = /* @__PURE__ */ new Float32Array(1);
		t[0] = e;
		let n = new Int8Array(t.buffer);
		this.bytes([
			n[0],
			n[1],
			n[2],
			n[3]
		]);
	}
	integer(e) {
		let t = /* @__PURE__ */ new Int32Array(1);
		t[0] = e;
		let n = new Int8Array(t.buffer);
		this.bytes([
			n[0],
			n[1],
			n[2],
			n[3]
		]);
	}
	int64(e) {
		let t = /* @__PURE__ */ new DataView(/* @__PURE__ */ new ArrayBuffer(8));
		t.setBigInt64(0, typeof e == "bigint" ? e : BigInt(e), !0), this.bytes(new Uint8Array(t.buffer));
	}
	double(e) {
		let t = /* @__PURE__ */ new Float64Array(1);
		t[0] = e;
		let n = new Int8Array(t.buffer);
		this.bytes([
			n[0],
			n[1],
			n[2],
			n[3],
			n[4],
			n[5],
			n[6],
			n[7]
		]);
	}
	wireGraphVariant(e) {
		if ("number" in e) this.bytes([0]), this.double(e.number);
		else if ("integer" in e) this.bytes([1]), this.int64(e.integer);
		else if ("bool" in e) this.bytes([2, +!!e.bool]);
		else if ("exec" in e) this.bytes([3]);
		else if ("object" in e) this.bytes([4]);
		else throw Error(`Unknown wire graph variant type ${JSON.stringify(e)}`);
	}
	self(e) {
		return e.bind(this)(), this;
	}
	array(e, t) {
		return this.bytes(dr(e.length)), e.forEach(t.bind(this)), this;
	}
	each(e, t) {
		return e.forEach(t.bind(this)), this;
	}
	unreal(e, t) {
		switch (e) {
			case "Class":
				if (typeof t != "string") throw Error(`writing unreal type Class, did not receive string (${t})`);
				this.string(t);
				return;
			case "String":
				if (typeof t != "string") throw Error(`writing unreal type String, did not receive string (${t})`);
				this.string(t);
				return;
			case "Object":
				if (typeof t != "string") throw Error(`writing unreal type Object, did not receive string (${t})`);
				this.string(t);
				return;
			case "Boolean":
				if (typeof t != "boolean") throw Error(`writing unreal type Boolean, did not receive boolean (${t})`);
				this.bytes(dr(+!!t));
				return;
			case "Float":
				if (typeof t != "number") throw Error(`writing unreal type Float, did not receive float (${t})`);
				this.float(t);
				return;
			case "Byte":
				if (typeof t != "number") throw Error(`writing unreal type Byte, did not receive Byte (${t})`);
				this.bytes([t & 255]);
				return;
			case "Color":
				if (!Array.isArray(t) || t.length !== 4) throw Error(`writing unreal type Color, did not receive Array (${t})`);
				this.bytes(B(t));
				return;
			case "Rotator":
			case "Rotator3d":
				if (!Array.isArray(t) || t.length !== 3) throw Error(`writing unreal type Rotator, did not receive Array (${t})`);
				this.float(t[0]), this.float(t[1]), this.float(t[2]);
				return;
			case "Vector3d":
				if (!Array.isArray(t) || t.length !== 3) throw Error(`writing unreal type Vector3d, did not receive Array (${t})`);
				this.float(t[0]), this.float(t[1]), this.float(t[2]);
				return;
			case "IntVector":
				if (!Array.isArray(t) || t.length !== 3) throw Error(`writing unreal type IntVector, did not receive Array (${t})`);
				this.integer(t[0]), this.integer(t[1]), this.integer(t[2]);
				return;
			case "Integer":
				if (typeof t != "number") throw Error(`writing unreal type Integer, did not receive integer (${t})`);
				this.integer(t);
				return;
			case "Integer64":
				if (typeof t != "number") throw Error(`writing unreal type Integer64, did not receive integer (${t})`);
				this.int64(t);
				return;
			case "Double":
				if (typeof t != "number") throw Error(`writing unreal type Double, did not receive double (${t})`);
				this.double(t);
				return;
			case "WireGraphVariant":
				if (typeof t != "object") throw Error(`writing unreal type WireGraphVariant, did not receive object (${t})`);
				this.wireGraphVariant(t);
				return;
			case "WireGraphPrimMathVariant":
				if (typeof t != "object") throw Error(`writing unreal type WireGraphPrimMathVariant, did not receive object (${t})`);
				this.wireGraphVariant(t);
				return;
			case "BRInventoryEntryPlan":
				if (typeof t != "string") throw Error(`writing unreal type BRInventoryEntryPlan, did not receive string (${t})`);
				this.string(t);
				return;
		}
		throw Error("Unknown unreal type " + e);
	}
};
function H(...e) {
	let t = e.reduce((e, t) => e + t.length, 0), n = new Uint8Array(t), r = 0;
	for (let t of e) n.set(t, r), r += t.length;
	return n;
}
var U = {
	bytes: sr,
	u16: V,
	i32: ur,
	compressed: fr,
	string: hr,
	uuid: _r,
	array: yr,
	each: br,
	bits: (e) => new Sr(e)
}, W = {
	u16: lr,
	i32: dr,
	compressed: mr,
	uncompressed: pr,
	string: gr,
	uuid: vr,
	array: xr,
	bits: () => new Cr()
};
//#endregion
//#region src/brs/read.v1.ts
function wr(e, t = {}) {
	let n = U.compressed(e), r = U.compressed(e), i = U.string(n), a = U.string(n), o = U.string(n), s = U.uuid(n), c = U.i32(n), l = U.array(r, U.string), u = U.array(r, U.string), d = U.array(r, (e) => B(Array.from(U.bytes(e, 4)))), f = [], p = Math.max(u.length, 2);
	if (t.bricks) {
		f = Array(c);
		let t = U.compressed(e), n = U.bits(t);
		for (let e = 0; !n.empty() && e < c; e++) {
			n.align();
			let t = n.int(p), r = n.bit() ? [
				n.uint_packed(),
				n.uint_packed(),
				n.uint_packed()
			] : [
				0,
				0,
				0
			], i = [
				n.int_packed(),
				n.int_packed(),
				n.int_packed()
			], a = n.int(24), o = (a >> 2) % 6, s = a & 3, c = n.bit(), l = n.bit(), u = n.bit() ? B(n.bytesArr(4)) : n.int(d.length);
			f[e] = {
				asset_name_index: t,
				size: r,
				collision: c,
				position: i,
				direction: o,
				rotation: s,
				visibility: l,
				color: u
			};
		}
	}
	return {
		version: 1,
		map: i,
		description: o,
		author: {
			id: s,
			name: a
		},
		mods: l,
		brick_assets: u,
		colors: d,
		bricks: f,
		brick_count: c
	};
}
//#endregion
//#region src/brs/read.v10.ts
function Tr(e, t = {}) {
	let n = U.i32(e), r = U.compressed(e), i = U.compressed(e), a = U.string(r), o = U.string(r), s = U.string(r), c = U.uuid(r), l = {
		name: U.string(r),
		id: U.uuid(r)
	}, u = U.bytes(r, 8), d = U.i32(r), f = U.array(i, U.string), p = U.array(i, U.string), m = U.array(i, (e) => B(Array.from(U.bytes(e, 4)))), h = U.array(i, U.string), g = U.array(i, (e) => ({
		id: U.uuid(e),
		name: U.string(e),
		bricks: U.i32(e)
	})), _ = U.array(i, U.string), v = null;
	if (U.bytes(e, 1)[0]) {
		let n = U.i32(e);
		t.preview ? v = U.bytes(e, n) : e.brsOffset += n;
	}
	let y = [], b = {}, x = Math.max(_.length, 2), S = Math.max(h.length, 2), C = Math.max(p.length, 2);
	if (t.bricks) {
		y = Array(d);
		let t = U.compressed(e), n = U.bits(t);
		for (let e = 0; !n.empty() && e < d; e++) {
			n.align();
			let t = n.int(C), r = n.bit() ? [
				n.uint_packed(),
				n.uint_packed(),
				n.uint_packed()
			] : [
				0,
				0,
				0
			], i = [
				n.int_packed(),
				n.int_packed(),
				n.int_packed()
			], a = n.int(24), o = (a >> 2) % 6, s = a & 3, c = {
				player: n.bit(),
				weapon: n.bit(),
				interaction: n.bit(),
				tool: n.bit(),
				physics: !1
			}, l = n.bit(), u = n.int(S), d = n.int(x), f = n.int(11), p = n.bit() ? n.bytesArr(3) : n.int(m.length), h = n.uint_packed();
			y[e] = {
				asset_name_index: t,
				size: r,
				position: i,
				direction: o,
				rotation: s,
				collision: c,
				visibility: l,
				material_index: u,
				physical_index: d,
				material_intensity: f,
				color: p,
				owner_index: h,
				components: {}
			};
		}
		let r = U.compressed(e), i = Math.max(y.length, 2);
		U.each(r, (e) => {
			let t = U.string(e), n = U.bits(U.bytes(e, U.i32(e))), r = U.i32(n.bytes(4)), a = n.array(() => n.int(i)), o = n.array(() => [n.string(), n.string()]);
			for (let e of a) {
				let r = {};
				for (let [e, t] of o) r[e] = n.unreal(t);
				y[e].components[t] = r;
			}
			b[t] = {
				version: r,
				brick_indices: a,
				properties: Object.fromEntries(o)
			};
		});
	}
	return {
		version: 10,
		game_version: n,
		map: a,
		description: s,
		author: {
			id: c,
			name: o
		},
		host: l,
		mods: f,
		brick_assets: p,
		colors: m,
		materials: h,
		brick_owners: g,
		physical_materials: _,
		preview: v,
		bricks: y,
		brick_count: d,
		save_time: u,
		components: b
	};
}
//#endregion
//#region src/brs/read.v14.ts
function Er(e, t = {}) {
	let n = U.i32(e), r = U.compressed(e), i = U.compressed(e), a = U.string(r), o = U.string(r), s = U.string(r), c = U.uuid(r), l = {
		name: U.string(r),
		id: U.uuid(r)
	}, u = U.bytes(r, 8), d = U.i32(r), f = U.array(i, U.string), p = U.array(i, U.string), m = U.array(i, (e) => B(Array.from(U.bytes(e, 4)))), h = U.array(i, U.string), g = U.array(i, (e) => ({
		id: U.uuid(e),
		name: U.string(e),
		display_name: U.string(e),
		bricks: U.i32(e)
	})), _ = U.array(i, U.string), v = null;
	if (U.bytes(e, 1)[0]) {
		let n = U.i32(e);
		t.preview ? v = U.bytes(e, n) : e.brsOffset += n;
	}
	let y = [], b = {}, x = [], S = Math.max(_.length, 2), C = Math.max(h.length, 2), w = Math.max(p.length, 2);
	if (t.bricks) {
		y = Array(d);
		let t = U.compressed(e), n = U.bits(t);
		for (let e = 0; !n.empty() && e < d; e++) {
			n.align();
			let t = n.int(w), r = n.bit() ? [
				n.uint_packed(),
				n.uint_packed(),
				n.uint_packed()
			] : [
				0,
				0,
				0
			], i = [
				n.int_packed(),
				n.int_packed(),
				n.int_packed()
			], a = n.int(24), o = (a >> 2) % 6, s = a & 3, c = {
				player: n.bit(),
				weapon: n.bit(),
				interaction: n.bit(),
				tool: n.bit(),
				physics: n.bit()
			}, l = n.bit(), u = n.int(C), d = n.int(S), f = n.int(11), p = n.bit() ? n.bytesArr(3) : n.int(m.length), h = n.uint_packed();
			y[e] = {
				asset_name_index: t,
				size: r,
				position: i,
				direction: o,
				rotation: s,
				collision: c,
				visibility: l,
				material_index: u,
				physical_index: d,
				material_intensity: f,
				color: p,
				owner_index: h,
				components: {}
			};
		}
		let r = U.compressed(e), i = U.compressed(e), a = Math.max(y.length, 2), o = [];
		U.each(r, (e) => {
			let t = U.string(e), n = U.bits(U.bytes(e, U.i32(e))), r = U.i32(n.bytes(4)), i = n.array(() => n.int(a)), s = n.array(() => [n.string(), n.string()]);
			for (let e of i) {
				let r = {};
				for (let [e, t] of s) r[e] = n.unreal(t);
				y[e].components[t] = r;
			}
			t in b || o.push(t), b[t] = {
				version: r,
				brick_indices: i,
				properties: Object.fromEntries(s)
			};
		});
		let s = Math.max(o.length, 2);
		{
			let e = U.bits(i), t = e.int(4294967295);
			for (let n = 0; n < t; n++) {
				let t = e.int(a), n = e.int(s), r = e.string(), i = e.int(a), c = e.int(s), l = e.string();
				e.bit(), e.align(), x.push({
					source: {
						brick_index: t,
						component: o[n],
						port: r
					},
					target: {
						brick_index: i,
						component: o[c],
						port: l
					}
				});
			}
		}
	}
	return {
		version: 14,
		game_version: n,
		map: a,
		description: s,
		author: {
			id: c,
			name: o
		},
		host: l,
		mods: f,
		brick_assets: p,
		colors: m,
		materials: h,
		brick_owners: g,
		physical_materials: _,
		preview: v,
		bricks: y,
		brick_count: d,
		save_time: u,
		components: b,
		wires: x
	};
}
//#endregion
//#region src/brs/read.v2.ts
function Dr(e, t = {}) {
	let n = U.compressed(e), r = U.compressed(e), i = U.string(n), a = U.string(n), o = U.string(n), s = U.uuid(n), c = U.i32(n), l = U.array(r, U.string), u = U.array(r, U.string), d = U.array(r, (e) => B(Array.from(U.bytes(e, 4)))), f = U.array(r, U.string), p = [], m = Math.max(u.length, 2);
	if (t.bricks) {
		p = Array(c);
		let t = U.compressed(e), n = U.bits(t);
		for (let e = 0; !n.empty() && e < c; e++) {
			n.align();
			let t = n.int(m), r = n.bit() ? [
				n.uint_packed(),
				n.uint_packed(),
				n.uint_packed()
			] : [
				0,
				0,
				0
			], i = [
				n.int_packed(),
				n.int_packed(),
				n.int_packed()
			], a = n.int(24), o = (a >> 2) % 6, s = a & 3, c = n.bit(), l = n.bit(), u = n.bit() ? n.uint_packed() : 1, f = n.bit() ? B(n.bytesArr(4)) : n.int(d.length);
			p[e] = {
				asset_name_index: t,
				size: r,
				position: i,
				direction: o,
				rotation: s,
				collision: c,
				visibility: l,
				material_index: u,
				color: f
			};
		}
	}
	return {
		version: 2,
		map: i,
		description: o,
		author: {
			id: s,
			name: a
		},
		mods: l,
		brick_assets: u,
		colors: d,
		materials: f,
		bricks: p,
		brick_count: c
	};
}
//#endregion
//#region src/brs/read.v3.ts
function Or(e, t = {}) {
	let n = U.compressed(e), r = U.compressed(e), i = U.string(n), a = U.string(n), o = U.string(n), s = U.uuid(n), c = U.i32(n), l = U.array(r, U.string), u = U.array(r, U.string), d = U.array(r, (e) => B(Array.from(U.bytes(e, 4)))), f = U.array(r, U.string), p = U.array(r, (e) => ({
		id: U.uuid(e),
		name: U.string(e)
	})), m = [], h = Math.max(u.length, 2);
	if (t.bricks) {
		m = Array(c);
		let t = U.compressed(e), n = U.bits(t);
		for (let e = 0; !n.empty() && e < c; e++) {
			n.align();
			let t = n.int(h), r = n.bit() ? [
				n.uint_packed(),
				n.uint_packed(),
				n.uint_packed()
			] : [
				0,
				0,
				0
			], i = [
				n.int_packed(),
				n.int_packed(),
				n.int_packed()
			], a = n.int(24), o = (a >> 2) % 6, s = a & 3, c = n.bit(), l = n.bit(), u = n.bit() ? n.uint_packed() : 1, f = n.bit() ? B(n.bytesArr(4)) : n.int(d.length), p = n.uint_packed();
			m[e] = {
				asset_name_index: t,
				size: r,
				position: i,
				direction: o,
				rotation: s,
				collision: c,
				visibility: l,
				material_index: u,
				color: f,
				owner_index: p
			};
		}
	}
	return {
		version: 3,
		map: i,
		description: o,
		author: {
			id: s,
			name: a
		},
		mods: l,
		brick_assets: u,
		colors: d,
		materials: f,
		brick_owners: p,
		bricks: m,
		brick_count: c
	};
}
//#endregion
//#region src/brs/read.v4.ts
function kr(e, t = {}) {
	let n = U.compressed(e), r = U.compressed(e), i = U.string(n), a = U.string(n), o = U.string(n), s = U.uuid(n), c = U.bytes(n, 8), l = U.i32(n), u = U.array(r, U.string), d = U.array(r, U.string), f = U.array(r, (e) => B(Array.from(U.bytes(e, 4)))), p = U.array(r, U.string), m = U.array(r, (e) => ({
		id: U.uuid(e),
		name: U.string(e)
	})), h = [], g = Math.max(d.length, 2);
	if (t.bricks) {
		h = Array(l);
		let t = U.compressed(e), n = U.bits(t);
		for (let e = 0; !n.empty() && e < l; e++) {
			n.align();
			let t = n.int(g), r = n.bit() ? [
				n.uint_packed(),
				n.uint_packed(),
				n.uint_packed()
			] : [
				0,
				0,
				0
			], i = [
				n.int_packed(),
				n.int_packed(),
				n.int_packed()
			], a = n.int(24), o = (a >> 2) % 6, s = a & 3, c = n.bit(), l = n.bit(), u = n.bit() ? n.uint_packed() : 1, d = n.bit() ? B(n.bytesArr(4)) : n.int(f.length), p = n.uint_packed();
			h[e] = {
				asset_name_index: t,
				size: r,
				position: i,
				direction: o,
				rotation: s,
				collision: c,
				visibility: l,
				material_index: u,
				color: d,
				owner_index: p
			};
		}
	}
	return {
		version: 4,
		map: i,
		description: o,
		author: {
			id: s,
			name: a
		},
		mods: u,
		brick_assets: d,
		colors: f,
		materials: p,
		brick_owners: m,
		bricks: h,
		brick_count: l,
		save_time: c
	};
}
//#endregion
//#region src/brs/read.v8.ts
function Ar(e, t = {}) {
	let n = U.i32(e), r = U.compressed(e), i = U.compressed(e), a = U.string(r), o = U.string(r), s = U.string(r), c = U.uuid(r), l = {
		name: U.string(r),
		id: U.uuid(r)
	}, u = U.bytes(r, 8), d = U.i32(r), f = U.array(i, U.string), p = U.array(i, U.string), m = U.array(i, (e) => B(Array.from(U.bytes(e, 4)))), h = U.array(i, U.string), g = U.array(i, (e) => ({
		id: U.uuid(e),
		name: U.string(e),
		bricks: U.i32(e)
	})), _ = null;
	if (U.bytes(e, 1)[0]) {
		let n = U.i32(e);
		t.preview ? _ = U.bytes(e, n) : e.brsOffset += n;
	}
	let v = [], y = {}, b = Math.max(h.length, 2), x = Math.max(p.length, 2);
	if (t.bricks) {
		v = Array(d);
		let t = U.compressed(e), n = U.bits(t);
		for (let e = 0; !n.empty() && e < d; e++) {
			n.align();
			let t = n.int(x), r = n.bit() ? [
				n.uint_packed(),
				n.uint_packed(),
				n.uint_packed()
			] : [
				0,
				0,
				0
			], i = [
				n.int_packed(),
				n.int_packed(),
				n.int_packed()
			], a = n.int(24), o = (a >> 2) % 6, s = a & 3, c = n.bit(), l = n.bit(), u = n.int(b), d = n.bit() ? B(n.bytesArr(4)) : n.int(m.length), f = n.uint_packed();
			v[e] = {
				asset_name_index: t,
				size: r,
				position: i,
				direction: o,
				rotation: s,
				collision: c,
				visibility: l,
				material_index: u,
				color: d,
				owner_index: f,
				components: {}
			};
		}
		let r = U.compressed(e), i = Math.max(v.length, 2);
		U.each(r, (e) => {
			let t = U.string(e), n = U.bits(U.bytes(e, U.i32(e))), r = U.i32(n.bytes(4)), a = n.array(() => n.int(i)), o = n.array(() => [n.string(), n.string()]);
			for (let e of a) {
				let r = {};
				for (let [e, t] of o) r[e] = n.unreal(t);
				v[e].components[t] = r;
			}
			y[t] = {
				version: r,
				brick_indices: a,
				properties: Object.fromEntries(o)
			};
		});
	}
	return {
		version: 8,
		game_version: n,
		map: a,
		description: s,
		author: {
			id: c,
			name: o
		},
		host: l,
		mods: f,
		brick_assets: p,
		colors: m,
		materials: h,
		brick_owners: g,
		preview: _,
		bricks: v,
		brick_count: d,
		save_time: u,
		components: y
	};
}
//#endregion
//#region src/brs/read.v9.ts
function jr(e, t = {}) {
	let n = U.i32(e), r = U.compressed(e), i = U.compressed(e), a = U.string(r), o = U.string(r), s = U.string(r), c = U.uuid(r), l = {
		name: U.string(r),
		id: U.uuid(r)
	}, u = U.bytes(r, 8), d = U.i32(r), f = U.array(i, U.string), p = U.array(i, U.string), m = U.array(i, (e) => B(Array.from(U.bytes(e, 4)))), h = U.array(i, U.string), g = U.array(i, (e) => ({
		id: U.uuid(e),
		name: U.string(e),
		bricks: U.i32(e)
	})), _ = U.array(i, U.string), v = null;
	if (U.bytes(e, 1)[0]) {
		let n = U.i32(e);
		t.preview ? v = U.bytes(e, n) : e.brsOffset += n;
	}
	let y = [], b = {}, x = Math.max(_.length, 2), S = Math.max(h.length, 2), C = Math.max(p.length, 2);
	if (t.bricks) {
		y = Array(d);
		let t = U.compressed(e), n = U.bits(t);
		for (let e = 0; !n.empty() && e < d; e++) {
			n.align();
			let t = n.int(C), r = n.bit() ? [
				n.uint_packed(),
				n.uint_packed(),
				n.uint_packed()
			] : [
				0,
				0,
				0
			], i = [
				n.int_packed(),
				n.int_packed(),
				n.int_packed()
			], a = n.int(24), o = (a >> 2) % 6, s = a & 3, c = n.bit(), l = n.bit(), u = n.int(S), d = n.int(x), f = n.int(11), p = n.bit() ? n.bytesArr(3) : n.int(m.length), h = n.uint_packed();
			y[e] = {
				asset_name_index: t,
				size: r,
				position: i,
				direction: o,
				rotation: s,
				collision: c,
				visibility: l,
				material_index: u,
				physical_index: d,
				material_intensity: f,
				color: p,
				owner_index: h,
				components: {}
			};
		}
		let r = U.compressed(e), i = Math.max(y.length, 2);
		U.each(r, (e) => {
			let t = U.string(e), n = U.bits(U.bytes(e, U.i32(e))), r = U.i32(n.bytes(4)), a = n.array(() => n.int(i)), o = n.array(() => [n.string(), n.string()]);
			for (let e of a) {
				let r = {};
				for (let [e, t] of o) r[e] = n.unreal(t);
				y[e].components[t] = r;
			}
			b[t] = {
				version: r,
				brick_indices: a,
				properties: Object.fromEntries(o)
			};
		});
	}
	return {
		version: 9,
		game_version: n,
		map: a,
		description: s,
		author: {
			id: c,
			name: o
		},
		host: l,
		mods: f,
		brick_assets: p,
		colors: m,
		materials: h,
		brick_owners: g,
		physical_materials: _,
		preview: v,
		bricks: y,
		brick_count: d,
		save_time: u,
		components: b
	};
}
//#endregion
//#region src/brs/read.ts
function Mr(e, t = {}) {
	if (typeof t != "object") throw Error("Invalid options");
	if (typeof t.bricks != "boolean" && (t.bricks = !0), typeof t.preview != "boolean" && (t.preview = !1), e[0] !== r[0] || e[1] !== r[1] || e[2] !== r[2]) throw Error("Invalid starting bytes");
	let n = e;
	n.brsOffset = 3;
	let i = U.u16(n);
	switch (i) {
		case 1: return wr(n, t);
		case 2: return Dr(n, t);
		case 3: return Or(n, t);
		case 4: return kr(n, t);
		case 8: return Ar(n, t);
		case 9: return jr(n, t);
		case 10: return Tr(n, t);
		case 14: return Er(n, t);
		default: throw Error("Unsupported version " + i);
	}
}
//#endregion
//#region src/brs/write.ts
var Nr = new Uint8Array([]), Pr = {
	BCD_SpotLight: {
		version: 1,
		properties: {
			Rotation: "Rotator",
			InnerConeAngle: "Float",
			OuterConeAngle: "Float",
			Brightness: "Float",
			Radius: "Float",
			Color: "Color",
			bUseBrickColor: "Boolean",
			bCastShadows: "Boolean"
		}
	},
	BCD_PointLight: {
		version: 1,
		properties: {
			bMatchBrickShape: "Boolean",
			Brightness: "Float",
			Radius: "Float",
			Color: "Color",
			bUseBrickColor: "Boolean",
			bCastShadows: "Boolean"
		}
	},
	BCD_ItemSpawn: {
		version: 1,
		properties: {
			PickupClass: "Class",
			bPickupEnabled: "Boolean",
			bPickupRespawnOnMinigameReset: "Boolean",
			PickupMinigameResetRespawnDelay: "Float",
			bPickupAutoDisableOnPickup: "Boolean",
			PickupRespawnTime: "Float",
			PickupOffsetDirection: "Byte",
			PickupOffsetDistance: "Float",
			PickupRotation: "Rotator",
			PickupScale: "Float",
			bPickupAnimationEnabled: "Boolean",
			PickupAnimationAxis: "Byte",
			bPickupAnimationAxisLocal: "Boolean",
			PickupSpinSpeed: "Float",
			PickupBobSpeed: "Float",
			PickupBobHeight: "Float",
			PickupAnimationPhase: "Float"
		}
	},
	BCD_Interact: {
		version: 1,
		properties: {
			bPlayInteractSound: "Boolean",
			Message: "String",
			ConsoleTag: "String"
		}
	},
	BCD_AudioEmitter: {
		version: 1,
		properties: {
			AudioDescriptor: "Object",
			VolumeMultiplier: "Float",
			PitchMultiplier: "Float",
			InnerRadius: "Float",
			MaxDistance: "Float",
			bSpatialization: "Boolean"
		}
	},
	Component_Internal_Rerouter: {
		version: 1,
		properties: {}
	},
	BrickComponentType_Internal_ReadBrickGrid: {
		version: 1,
		properties: {}
	},
	BrickComponentType_WireGraphPseudo_BufferSeconds: {
		version: 1,
		properties: {
			SecondsToWait: "Float",
			ZeroSecondsToWait: "Float",
			CurrentTime: "Float",
			Input: "WireGraphVariant",
			Output: "WireGraphVariant",
			Buffered: "WireGraphVariant",
			Queued: "WireGraphVariant",
			bHasQueued: "Boolean"
		}
	},
	BrickComponentType_WireGraphPseudo_BufferTicks: {
		version: 1,
		properties: {
			TicksToWait: "Integer",
			ZeroTicksToWait: "Integer",
			CurrentTicks: "Integer",
			Input: "WireGraphVariant",
			Output: "WireGraphVariant",
			Buffered: "WireGraphVariant",
			Queued: "WireGraphVariant",
			bHasQueued: "Boolean"
		}
	},
	BrickComponentType_WireGraphPseudo_Const: {
		version: 1,
		properties: { Value: "WireGraphVariant" }
	},
	BrickComponentType_WireGraph_Expr_BitwiseAND: {
		version: 1,
		properties: {
			InputA: "Integer64",
			InputB: "Integer64"
		}
	},
	BrickComponentType_WireGraph_Expr_BitwiseNAND: {
		version: 1,
		properties: {
			InputA: "Integer64",
			InputB: "Integer64"
		}
	},
	BrickComponentType_WireGraph_Expr_BitwiseNOR: {
		version: 1,
		properties: {
			InputA: "Integer64",
			InputB: "Integer64"
		}
	},
	BrickComponentType_WireGraph_Expr_BitwiseNOT: {
		version: 1,
		properties: { Input: "Integer64" }
	},
	BrickComponentType_WireGraph_Expr_BitwiseOR: {
		version: 1,
		properties: {
			InputA: "Integer64",
			InputB: "Integer64"
		}
	},
	BrickComponentType_WireGraph_Expr_BitwiseShiftLeft: {
		version: 1,
		properties: {
			InputA: "Integer64",
			InputB: "Integer64"
		}
	},
	BrickComponentType_WireGraph_Expr_BitwiseShiftRight: {
		version: 1,
		properties: {
			InputA: "Integer64",
			InputB: "Integer64"
		}
	},
	BrickComponentType_WireGraph_Expr_BitwiseXOR: {
		version: 1,
		properties: {
			InputA: "Integer64",
			InputB: "Integer64"
		}
	},
	BrickComponentType_WireGraph_Expr_Ceil: {
		version: 1,
		properties: { Input: "Double" }
	},
	BrickComponentType_WireGraph_Expr_CompareEqual: {
		version: 1,
		properties: {
			InputA: "WireGraphVariant",
			InputB: "WireGraphVariant"
		}
	},
	BrickComponentType_WireGraph_Expr_CompareGreater: {
		version: 1,
		properties: {
			InputA: "WireGraphPrimMathVariant",
			InputB: "WireGraphPrimMathVariant"
		}
	},
	BrickComponentType_WireGraph_Expr_CompareGreaterOrEqual: {
		version: 1,
		properties: {
			InputA: "WireGraphPrimMathVariant",
			InputB: "WireGraphPrimMathVariant"
		}
	},
	BrickComponentType_WireGraph_Expr_CompareLess: {
		version: 1,
		properties: {
			InputA: "WireGraphPrimMathVariant",
			InputB: "WireGraphPrimMathVariant"
		}
	},
	BrickComponentType_WireGraph_Expr_CompareLessOrEqual: {
		version: 1,
		properties: {
			InputA: "WireGraphPrimMathVariant",
			InputB: "WireGraphPrimMathVariant"
		}
	},
	BrickComponentType_WireGraph_Expr_CompareNotEqual: {
		version: 1,
		properties: {
			InputA: "WireGraphVariant",
			InputB: "WireGraphVariant"
		}
	},
	BrickComponentType_WireGraph_Expr_Floor: {
		version: 1,
		properties: { Input: "Double" }
	},
	BrickComponentType_WireGraph_Expr_LogicalAND: {
		version: 1,
		properties: {
			bInputA: "Boolean",
			bInputB: "Boolean"
		}
	},
	BrickComponentType_WireGraph_Expr_LogicalNAND: {
		version: 1,
		properties: {
			bInputA: "Boolean",
			bInputB: "Boolean"
		}
	},
	BrickComponentType_WireGraph_Expr_LogicalNOR: {
		version: 1,
		properties: {
			bInputA: "Boolean",
			bInputB: "Boolean"
		}
	},
	BrickComponentType_WireGraph_Expr_LogicalNOT: {
		version: 1,
		properties: { bInput: "Boolean" }
	},
	BrickComponentType_WireGraph_Expr_LogicalOR: {
		version: 1,
		properties: {
			bInputA: "Boolean",
			bInputB: "Boolean"
		}
	},
	BrickComponentType_WireGraph_Expr_LogicalXOR: {
		version: 1,
		properties: {
			bInputA: "Boolean",
			bInputB: "Boolean"
		}
	},
	BrickComponentType_WireGraph_Expr_MathAdd: {
		version: 1,
		properties: {
			InputA: "WireGraphPrimMathVariant",
			InputB: "WireGraphPrimMathVariant"
		}
	},
	BrickComponentType_WireGraph_Expr_MathBlend: {
		version: 1,
		properties: {
			Blend: "Double",
			InputA: "WireGraphPrimMathVariant",
			InputB: "WireGraphPrimMathVariant"
		}
	},
	BrickComponentType_WireGraph_Expr_MathDivide: {
		version: 1,
		properties: {
			InputA: "WireGraphPrimMathVariant",
			InputB: "WireGraphPrimMathVariant"
		}
	},
	BrickComponentType_WireGraph_Expr_MathModulo: {
		version: 1,
		properties: {
			InputA: "WireGraphPrimMathVariant",
			InputB: "WireGraphPrimMathVariant"
		}
	},
	BrickComponentType_WireGraph_Expr_MathModuloFloored: {
		version: 1,
		properties: {
			InputA: "WireGraphPrimMathVariant",
			InputB: "WireGraphPrimMathVariant"
		}
	},
	BrickComponentType_WireGraph_Expr_MathMultiply: {
		version: 1,
		properties: {
			InputA: "WireGraphPrimMathVariant",
			InputB: "WireGraphPrimMathVariant"
		}
	},
	BrickComponentType_WireGraph_Expr_MathSubtract: {
		version: 1,
		properties: {
			InputA: "WireGraphPrimMathVariant",
			InputB: "WireGraphPrimMathVariant"
		}
	},
	BrickComponent_WireGraph_Expr_EdgeDetector: {
		version: 1,
		properties: {
			Input: "Double",
			bPulseOnRisingEdge: "Boolean",
			bPulseOnFallingEdge: "Boolean"
		}
	}
};
function Fr(e, t = {}) {
	if (typeof e != "object") throw Error("Expected save to be an object");
	if (!Array.isArray(e.bricks) || e.bricks.length === 0) throw Error("Expected save to have bricks field");
	if (e.bricks.length > 2147483647) throw Error("Brick count out of range");
	let n = t.compress ? W.compressed : W.uncompressed, i = ([e, t, n, r]) => new Uint8Array([
		n,
		t,
		e,
		r
	]), o = {}, s = Math.max(e.colors?.length ?? 0, 2), c = Math.max(e.brick_assets?.length ?? 0, 2), l = Math.max(e.materials?.length ?? 0, 2), u = Math.max(e.physical_materials?.length ?? 0, 2);
	if (e.preview && !Array.isArray(e.preview)) throw Error("Expected preview to be an array");
	let d = {}, f = 0;
	return H(r, W.u16(14), W.i32(e.game_version ?? 0), n(W.string(e.map ?? "Unknown"), W.string(e.author?.name ?? "Unknown"), W.string(e.description ?? ""), W.uuid(e.author?.id ?? "00000000-0000-0000-0000-000000000000"), H(W.string(e.host?.name ?? "Unknown"), W.uuid(e.host?.id ?? "00000000-0000-0000-0000-000000000000")), new Uint8Array(e.save_time && (Array.isArray(e.save_time) || e.save_time instanceof Uint8Array) && e.save_time.length === 8 ? e.save_time : [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0
	]), W.i32(e.bricks.length)), n(W.array(e.mods ?? [], W.string), W.array(e.brick_assets ?? ["PB_DefaultBrick"], W.string), W.array(e.colors ?? [], i), W.array(e.materials ?? ["BMC_Plastic"], W.string), W.array(e.brick_owners ?? [], ({ id: e = a, name: t = "Unknown", display_name: n = "Unknown", bricks: r = 0 }) => H(W.uuid(e), W.string(t), W.string(n), W.i32(r))), W.array(e.physical_materials ?? ["BPMC_Default"], W.string)), H(new Uint8Array([+!!e.preview]), e.preview ? W.i32(e.preview.length) : Nr, e.preview ?? Nr), n(W.bits().each(e.bricks, function(e, t) {
		if (typeof e != "object") throw Error(`Expected save.bricks[${t}] to be an object`);
		if (!Array.isArray(e.size) || e.size.length !== 3) throw Error(`Expected save.bricks[${t}].size to be an array of length 3`);
		if (!Array.isArray(e.position) || e.position.length !== 3) throw Error(`Expected save.bricks[${t}].position to be an array of length 3`);
		this.align(), this.int(e.asset_name_index ?? 0, c);
		let n = e.size === null || ar(e.size, [
			0,
			0,
			0
		]);
		if (this.bit(!n), n || e.size.map((e) => this.uint_packed(e >= 0 ? e : 1)), e.position.map((e) => this.int_packed(e)), this.int((e.direction ?? 4) << 2 | (e.rotation ?? 0), 24), typeof e.collision == "boolean" ? (this.bit(e.collision), this.bit(e.collision), this.bit(e.collision), this.bit(!0), this.bit(e.collision)) : (this.bit(e.collision?.player ?? !0), this.bit(e.collision?.weapon ?? !0), this.bit(e.collision?.interaction ?? !0), this.bit(e.collision?.tool ?? !0), this.bit(e.collision?.physics ?? !0)), this.bit(e.visibility ?? !0), this.int(e.material_index ?? 0, l), this.int(e.physical_index ?? 0, u), this.int(e.material_intensity ?? 5, 11), typeof e.color == "number") this.bit(!1), this.int(e.color, s);
		else {
			if (this.bit(!0), e.color && (!Array.isArray(e.color) || e.color.length < 3)) throw Error(`Expected save.bricks[${t}].color to be an array of at least length 3`);
			this.bytes(new Uint8Array(e.color?.slice(0, 3) ?? [
				255,
				255,
				255
			]));
		}
		this.uint_packed(e.owner_index >= 0 ? e.owner_index : 0);
		for (let n in e.components ?? {}) o[n] ?? (o[n] = []), o[n].push(t);
	}).finish()), n(W.array(Object.keys(e.components ?? Pr).filter((e) => o[e]), (t) => H(W.string(t), W.bits().self(function() {
		let n = e.components?.[t] ?? Pr[t], r = o[t], i = Object.entries(n.properties);
		t in d || (d[t] = f, f++), this.bytes(W.i32(n.version)), this.array(r, (t) => {
			this.int(t, Math.max(e.bricks.length, 2));
		}), this.array(i, ([e, t]) => {
			this.string(e), this.string(t);
		});
		for (let n of r) for (let [r, a] of i) {
			if (!(r in (e.bricks[n].components?.[t] ?? {}))) throw Error(`Expected save.bricks[${n}].components[${t}] to have property '${r}' of type '${a}'`);
			this.unreal(a, e.bricks[n].components[t][r]);
		}
		this.align();
	}).finishSection()))), n(W.bits().self(function() {
		let t = 4294967295;
		if (!e.wires || !Array.isArray(e.wires) || e.wires.length === 0) {
			this.int(0, t);
			return;
		}
		this.int(e.wires.length, t);
		for (let t of e.wires) {
			if (typeof t != "object") throw Error("Expected save.wires to be an array of objects");
			if (!(t.source && typeof t.source == "object" && typeof t.source.brick_index == "number" && typeof t.source.component == "string" && typeof t.source.port == "string")) throw Error("Expected save.wires[i].source to be an object with brick_index, component, and port properties");
			if (!(t.target && typeof t.target == "object" && typeof t.target.brick_index == "number" && typeof t.target.component == "string" && typeof t.target.port == "string")) throw Error("Expected save.wires[i].target to be an object with brick_index, component, and port properties");
			if (!(t.source.component in d)) throw Error(`Unknown component '${t.source.component}' in wire source`);
			if (!(t.target.component in d)) throw Error(`Unknown component '${t.target.component}' in wire target`);
			this.int(t.source.brick_index, e.bricks.length), this.int(d[t.source.component], f), this.string(t.source.port), this.int(t.target.brick_index, e.bricks.length), this.int(d[t.target.component], f), this.string(t.target.port), this.bit(!1), this.align();
		}
	}).finish()));
}
//#endregion
//#region src/brs/types.ts
var Ir = /* @__PURE__ */ t({
	Direction: () => Lr,
	Rotation: () => Rr
}), Lr = /* @__PURE__ */ function(e) {
	return e[e.XPositive = 0] = "XPositive", e[e.XNegative = 1] = "XNegative", e[e.YPositive = 2] = "YPositive", e[e.YNegative = 3] = "YNegative", e[e.ZPositive = 4] = "ZPositive", e[e.ZNegative = 5] = "ZNegative", e;
}({}), Rr = /* @__PURE__ */ function(e) {
	return e[e.Deg0 = 0] = "Deg0", e[e.Deg90 = 1] = "Deg90", e[e.Deg180 = 2] = "Deg180", e[e.Deg270 = 3] = "Deg270", e;
}({});
//#endregion
//#region node_modules/@noble/hashes/utils.js
function zr(e) {
	return e instanceof Uint8Array || ArrayBuffer.isView(e) && e.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in e && e.BYTES_PER_ELEMENT === 1;
}
function Br(e, t = "") {
	if (typeof e != "number") {
		let n = t && `"${t}" `;
		throw TypeError(`${n}expected number, got ${typeof e}`);
	}
	if (!Number.isSafeInteger(e) || e < 0) {
		let n = t && `"${t}" `;
		throw RangeError(`${n}expected integer >= 0, got ${e}`);
	}
}
function Vr(e, t, n = "") {
	let r = zr(e), i = e?.length, a = t !== void 0;
	if (!r || a && i !== t) {
		let o = n && `"${n}" `, s = a ? ` of length ${t}` : "", c = r ? `length=${i}` : `type=${typeof e}`, l = o + "expected Uint8Array" + s + ", got " + c;
		throw r ? RangeError(l) : TypeError(l);
	}
	return e;
}
function Hr(e) {
	return Uint8Array.from(Vr(e));
}
function Ur(e, t = !0) {
	if (e.destroyed) throw Error("Hash instance has been destroyed");
	if (t && e.finished) throw Error("Hash#digest() has already been called");
}
function Wr(e, t) {
	Vr(e, void 0, "digestInto() output");
	let n = t.outputLen;
	if (e.length < n) throw RangeError("\"digestInto() output\" expected to be of length >=" + n);
}
function Gr(e) {
	return new Uint8Array(e.buffer, e.byteOffset, e.byteLength);
}
function Kr(e) {
	return new Uint32Array(e.buffer, e.byteOffset, Math.floor(e.byteLength / 4));
}
function qr(...e) {
	for (let t = 0; t < e.length; t++) e[t].fill(0);
}
function Jr(e, t) {
	return e << 32 - t | e >>> t;
}
var Yr = new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68;
function Xr(e) {
	return e << 24 & 4278190080 | e << 8 & 16711680 | e >>> 8 & 65280 | e >>> 24 & 255;
}
var Zr = Yr ? (e) => e : (e) => Xr(e) >>> 0;
function Qr(e) {
	for (let t = 0; t < e.length; t++) e[t] = Xr(e[t]);
	return e;
}
var $r = Yr ? (e) => e : Qr, ei = typeof Uint8Array.from([]).toHex == "function" && typeof Uint8Array.fromHex == "function", ti = /* @__PURE__ */ Array.from({ length: 256 }, (e, t) => t.toString(16).padStart(2, "0"));
function ni(e) {
	if (Vr(e), ei) return e.toHex();
	let t = "";
	for (let n = 0; n < e.length; n++) t += ti[e[n]];
	return t;
}
function ri(e, t = {}) {
	let n = (t, n) => e(n).update(t).digest(), r = e(void 0);
	return n.outputLen = r.outputLen, n.blockLen = r.blockLen, n.canXOF = r.canXOF, n.create = (t) => e(t), Object.assign(n, t), Object.freeze(n);
}
//#endregion
//#region node_modules/@noble/hashes/_md.js
var ii = /* @__PURE__ */ Uint32Array.from([
	1779033703,
	3144134277,
	1013904242,
	2773480762,
	1359893119,
	2600822924,
	528734635,
	1541459225
]), ai = /* @__PURE__ */ BigInt(2 ** 32 - 1), oi = /* @__PURE__ */ BigInt(32);
function si(e, t = !1) {
	return t ? {
		h: Number(e & ai),
		l: Number(e >> oi & ai)
	} : {
		h: Number(e >> oi & ai) | 0,
		l: Number(e & ai) | 0
	};
}
//#endregion
//#region node_modules/@noble/hashes/_blake.js
function ci(e, t, n, r, i) {
	return e = e + t + i | 0, r = Jr(r ^ e, 16), n = n + r | 0, t = Jr(t ^ n, 12), {
		a: e,
		b: t,
		c: n,
		d: r
	};
}
function li(e, t, n, r, i) {
	return e = e + t + i | 0, r = Jr(r ^ e, 8), n = n + r | 0, t = Jr(t ^ n, 7), {
		a: e,
		b: t,
		c: n,
		d: r
	};
}
//#endregion
//#region node_modules/@noble/hashes/blake2.js
var ui = class {
	constructor(e, t) {
		l(this, "buffer", void 0), l(this, "buffer32", void 0), l(this, "finished", !1), l(this, "destroyed", !1), l(this, "length", 0), l(this, "pos", 0), l(this, "blockLen", void 0), l(this, "outputLen", void 0), l(this, "canXOF", !1), Br(e), Br(t), this.blockLen = e, this.outputLen = t, this.buffer = new Uint8Array(e), this.buffer32 = Kr(this.buffer);
	}
	update(e) {
		Ur(this), Vr(e);
		let { blockLen: t, buffer: n, buffer32: r } = this, i = e.length, a = e.byteOffset, o = e.buffer;
		for (let s = 0; s < i;) {
			this.pos === t && ($r(r), this.compress(r, 0, !1), $r(r), this.pos = 0);
			let c = Math.min(t - this.pos, i - s), l = a + s;
			if (c === t && !(l % 4) && s + c < i) {
				let e = new Uint32Array(o, l, Math.floor((i - s) / 4));
				$r(e);
				for (let n = 0; s + t < i; n += r.length, s += t) this.length += t, this.compress(e, n, !1);
				$r(e);
				continue;
			}
			n.set(e.subarray(s, s + c), this.pos), this.pos += c, this.length += c, s += c;
		}
		return this;
	}
	digestInto(e) {
		Ur(this), Wr(e, this);
		let { pos: t, buffer32: n } = this;
		if (this.finished = !0, qr(this.buffer.subarray(t)), $r(n), this.compress(n, 0, !0), $r(n), e.byteOffset & 3) throw RangeError("\"digestInto() output\" expected 4-byte aligned byteOffset, got " + e.byteOffset);
		let r = this.get(), i = Kr(e), a = Math.floor(this.outputLen / 4);
		for (let e = 0; e < a; e++) i[e] = Zr(r[e]);
		let o = this.outputLen % 4;
		if (!o) return;
		let s = a * 4, c = r[a];
		for (let t = 0; t < o; t++) e[s + t] = c >>> 8 * t;
	}
	digest() {
		let { buffer: e, outputLen: t } = this;
		this.digestInto(e);
		let n = e.slice(0, t);
		return this.destroy(), n;
	}
	_cloneInto(e) {
		let { buffer: t, length: n, finished: r, destroyed: i, outputLen: a, pos: o } = this;
		return e || (e = new this.constructor({ dkLen: a })), e.set(...this.get()), e.buffer.set(t), e.destroyed = i, e.finished = r, e.length = n, e.pos = o, e.outputLen = a, e;
	}
	clone() {
		return this._cloneInto();
	}
};
function di(e, t, n, r, i, a, o, s, c, l, u, d, f, p, m, h, g, _, v, y) {
	let b = 0;
	for (let x = 0; x < r; x++) ({a: i, b: c, c: f, d: g} = ci(i, c, f, g, n[t + e[b++]])), {a: i, b: c, c: f, d: g} = li(i, c, f, g, n[t + e[b++]]), {a: a, b: l, c: p, d: _} = ci(a, l, p, _, n[t + e[b++]]), {a: a, b: l, c: p, d: _} = li(a, l, p, _, n[t + e[b++]]), {a: o, b: u, c: m, d: v} = ci(o, u, m, v, n[t + e[b++]]), {a: o, b: u, c: m, d: v} = li(o, u, m, v, n[t + e[b++]]), {a: s, b: d, c: h, d: y} = ci(s, d, h, y, n[t + e[b++]]), {a: s, b: d, c: h, d: y} = li(s, d, h, y, n[t + e[b++]]), {a: i, b: l, c: m, d: y} = ci(i, l, m, y, n[t + e[b++]]), {a: i, b: l, c: m, d: y} = li(i, l, m, y, n[t + e[b++]]), {a: a, b: u, c: h, d: g} = ci(a, u, h, g, n[t + e[b++]]), {a: a, b: u, c: h, d: g} = li(a, u, h, g, n[t + e[b++]]), {a: o, b: d, c: f, d: _} = ci(o, d, f, _, n[t + e[b++]]), {a: o, b: d, c: f, d: _} = li(o, d, f, _, n[t + e[b++]]), {a: s, b: c, c: p, d: v} = ci(s, c, p, v, n[t + e[b++]]), {a: s, b: c, c: p, d: v} = li(s, c, p, v, n[t + e[b++]]);
	return {
		v0: i,
		v1: a,
		v2: o,
		v3: s,
		v4: c,
		v5: l,
		v6: u,
		v7: d,
		v8: f,
		v9: p,
		v10: m,
		v11: h,
		v12: g,
		v13: _,
		v14: v,
		v15: y
	};
}
//#endregion
//#region node_modules/@noble/hashes/blake3.js
var fi = {
	CHUNK_START: 1,
	CHUNK_END: 2,
	PARENT: 4,
	ROOT: 8,
	KEYED_HASH: 16,
	DERIVE_KEY_CONTEXT: 32,
	DERIVE_KEY_MATERIAL: 64
}, pi = /* @__PURE__ */ ii.slice(), mi = /* @__PURE__ */ (() => {
	let e = Array.from({ length: 16 }, (e, t) => t), t = (e) => [
		2,
		6,
		3,
		10,
		7,
		0,
		4,
		13,
		1,
		11,
		12,
		5,
		9,
		14,
		15,
		8
	].map((t) => e[t]), n = [];
	for (let r = 0, i = e; r < 7; r++, i = t(i)) n.push(...i);
	return Uint8Array.from(n);
})(), hi = class e extends ui {
	constructor(t = {}, n = 0) {
		super(64, t.dkLen === void 0 ? 32 : t.dkLen), l(this, "canXOF", !0), l(this, "chunkPos", 0), l(this, "chunksDone", 0), l(this, "flags", 0), l(this, "IV", void 0), l(this, "state", void 0), l(this, "stack", []), l(this, "posOut", 0), l(this, "bufferOut32", /* @__PURE__ */ new Uint32Array(16)), l(this, "bufferOut", void 0), l(this, "chunkOut", 0), l(this, "enableXOF", !0);
		let { key: r, context: i } = t, a = i !== void 0;
		if (r !== void 0) {
			if (a) throw Error("Only \"key\" or \"context\" can be specified at same time");
			Vr(r, 32, "key");
			let e = Hr(r);
			this.IV = Kr(e), $r(this.IV), this.flags = n | fi.KEYED_HASH;
		} else if (a) {
			Vr(i, void 0, "context");
			let t = i, r = new e({ dkLen: 32 }, fi.DERIVE_KEY_CONTEXT).update(t).digest();
			this.IV = Kr(r), $r(this.IV), this.flags = n | fi.DERIVE_KEY_MATERIAL;
		} else this.IV = pi.slice(), this.flags = n;
		this.state = this.IV.slice(), this.bufferOut = Gr(this.bufferOut32);
	}
	get() {
		return [];
	}
	set() {}
	b2Compress(e, t, n, r = 0) {
		let { state: i, pos: a } = this, { h: o, l: s } = si(BigInt(e), !0), { v0: c, v1: l, v2: u, v3: d, v4: f, v5: p, v6: m, v7: h, v8: g, v9: _, v10: v, v11: y, v12: b, v13: x, v14: S, v15: C } = di(mi, r, n, 7, i[0], i[1], i[2], i[3], i[4], i[5], i[6], i[7], pi[0], pi[1], pi[2], pi[3], o, s, a, t);
		i[0] = c ^ g, i[1] = l ^ _, i[2] = u ^ v, i[3] = d ^ y, i[4] = f ^ b, i[5] = p ^ x, i[6] = m ^ S, i[7] = h ^ C;
	}
	compress(e, t = 0, n = !1) {
		let r = this.flags;
		if (this.chunkPos || (r |= fi.CHUNK_START), (this.chunkPos === 15 || n) && (r |= fi.CHUNK_END), n || (this.pos = this.blockLen), this.b2Compress(this.chunksDone, r, e, t), this.chunkPos += 1, this.chunkPos === 16 || n) {
			let e = this.state;
			this.state = this.IV.slice();
			for (let t, r = this.chunksDone + 1; (n || !(r & 1)) && (t = this.stack.pop()); r >>= 1) this.buffer32.set(t, 0), this.buffer32.set(e, 8), this.pos = this.blockLen, this.b2Compress(0, this.flags | fi.PARENT, this.buffer32, 0), e = this.state, this.state = this.IV.slice();
			this.chunksDone++, this.chunkPos = 0, this.stack.push(e);
		}
		this.pos = 0;
	}
	_cloneInto(e) {
		e = super._cloneInto(e);
		let { IV: t, flags: n, state: r, chunkPos: i, posOut: a, chunkOut: o, stack: s, chunksDone: c } = this;
		return e.state.set(r.slice()), e.stack = s.map((e) => Uint32Array.from(e)), e.IV.set(t), e.flags = n, e.chunkPos = i, e.chunksDone = c, e.posOut = a, e.chunkOut = o, e.enableXOF = this.enableXOF, e.bufferOut32.set(this.bufferOut32), e;
	}
	destroy() {
		this.destroyed = !0, qr(this.state, this.buffer32, this.IV, this.bufferOut32), qr(...this.stack);
	}
	b2CompressOut() {
		let { state: e, pos: t, flags: n, buffer32: r, bufferOut32: i } = this, { h: a, l: o } = si(BigInt(this.chunkOut++));
		$r(r);
		let { v0: s, v1: c, v2: l, v3: u, v4: d, v5: f, v6: p, v7: m, v8: h, v9: g, v10: _, v11: v, v12: y, v13: b, v14: x, v15: S } = di(mi, 0, r, 7, e[0], e[1], e[2], e[3], e[4], e[5], e[6], e[7], pi[0], pi[1], pi[2], pi[3], o, a, t, n);
		i[0] = s ^ h, i[1] = c ^ g, i[2] = l ^ _, i[3] = u ^ v, i[4] = d ^ y, i[5] = f ^ b, i[6] = p ^ x, i[7] = m ^ S, i[8] = e[0] ^ h, i[9] = e[1] ^ g, i[10] = e[2] ^ _, i[11] = e[3] ^ v, i[12] = e[4] ^ y, i[13] = e[5] ^ b, i[14] = e[6] ^ x, i[15] = e[7] ^ S, $r(r), $r(i), this.posOut = 0;
	}
	finish() {
		if (this.finished) return;
		this.finished = !0, qr(this.buffer.subarray(this.pos));
		let e = this.flags | fi.ROOT;
		this.stack.length ? (e |= fi.PARENT, $r(this.buffer32), this.compress(this.buffer32, 0, !0), $r(this.buffer32), this.chunksDone = 0, this.pos = this.blockLen) : e |= (this.chunkPos ? 0 : fi.CHUNK_START) | fi.CHUNK_END, this.flags = e, this.b2CompressOut();
	}
	writeInto(e) {
		Ur(this, !1), Vr(e), this.finish();
		let { blockLen: t, bufferOut: n } = this;
		for (let r = 0, i = e.length; r < i;) {
			this.posOut >= t && this.b2CompressOut();
			let a = Math.min(t - this.posOut, i - r);
			e.set(n.subarray(this.posOut, this.posOut + a), r), this.posOut += a, r += a;
		}
		return e;
	}
	xofInto(e) {
		if (!this.enableXOF) throw Error("XOF is not possible after digest call");
		return this.writeInto(e);
	}
	xof(e) {
		return Br(e), this.xofInto(new Uint8Array(e));
	}
	digestInto(e) {
		if (Wr(e, this), this.finished) throw Error("digest() was already called");
		this.enableXOF = !1, this.writeInto(e.subarray(0, this.outputLen)), this.destroy();
	}
	digest() {
		let e = new Uint8Array(this.outputLen);
		return this.digestInto(e), e;
	}
}, gi = /* @__PURE__ */ ri((e = {}) => new hi(e)), _i = (e, t) => ((e.Flags[t >> 3] ?? 0) >> (t & 7) & 1) == 1, vi = class {
	constructor() {
		this.bytes = [], this.bits = 0;
	}
	push(e) {
		this.bits >= this.bytes.length * 8 && this.bytes.push(0), e && (this.bytes[this.bits >> 3] |= 1 << (this.bits & 7)), this.bits += 1;
	}
	toValue() {
		return { Flags: this.bytes };
	}
}, yi = ArrayBuffer, G = Uint8Array, bi = Uint16Array, xi = Int16Array, Si = Int32Array, Ci = function(e, t, n) {
	if (G.prototype.slice) return G.prototype.slice.call(e, t, n);
	(t == null || t < 0) && (t = 0), (n == null || n > e.length) && (n = e.length);
	var r = new G(n - t);
	return r.set(e.subarray(t, n)), r;
}, wi = function(e, t, n, r) {
	if (G.prototype.fill) return G.prototype.fill.call(e, t, n, r);
	for ((n == null || n < 0) && (n = 0), (r == null || r > e.length) && (r = e.length); n < r; ++n) e[n] = t;
	return e;
}, Ti = function(e, t, n, r) {
	if (G.prototype.copyWithin) return G.prototype.copyWithin.call(e, t, n, r);
	for ((n == null || n < 0) && (n = 0), (r == null || r > e.length) && (r = e.length); n < r;) e[t++] = e[n++];
}, Ei = [
	"invalid zstd data",
	"window size too large (>2046MB)",
	"invalid block type",
	"FSE accuracy too high",
	"match distance too far back",
	"unexpected EOF"
], K = function(e, t, n) {
	var r = Error(t || Ei[e]);
	if (r.code = e, Error.captureStackTrace && Error.captureStackTrace(r, K), !n) throw r;
	return r;
}, Di = function(e, t, n) {
	for (var r = 0, i = 0; r < n; ++r) i |= e[t++] << (r << 3);
	return i;
}, Oi = function(e, t) {
	return (e[t] | e[t + 1] << 8 | e[t + 2] << 16 | e[t + 3] << 24) >>> 0;
}, ki = function(e, t) {
	var n = e[0] | e[1] << 8 | e[2] << 16;
	if (n == 3126568 && e[3] == 253) {
		var r = e[4], i = r >> 5 & 1, a = r >> 2 & 1, o = r & 3, s = r >> 6;
		r & 8 && K(0);
		var c = 6 - i, l = o == 3 ? 4 : o, u = Di(e, c, l);
		c += l;
		var d = s ? 1 << s : i, f = Di(e, c, d) + (s == 1 && 256), p = f;
		if (!i) {
			var m = 1 << 10 + (e[5] >> 3);
			p = m + (m >> 3) * (e[5] & 7);
		}
		p > 2145386496 && K(1);
		var h = new G((t == 1 ? f || p : t ? 0 : p) + 12);
		return h[0] = 1, h[4] = 4, h[8] = 8, {
			b: c + d,
			y: 0,
			l: 0,
			d: u,
			w: t && t != 1 ? t : h.subarray(12),
			e: p,
			o: new Si(h.buffer, 0, 3),
			u: f,
			c: a,
			m: Math.min(131072, p)
		};
	} else if ((n >> 4 | e[3] << 20) == 25481893) return Oi(e, 4) + 8;
	K(0);
}, Ai = function(e) {
	for (var t = 0; 1 << t <= e; ++t);
	return t - 1;
}, ji = function(e, t, n) {
	var r = (t << 3) + 4, i = (e[t] & 15) + 5;
	i > n && K(3);
	for (var a = 1 << i, o = a, s = -1, c = -1, l = -1, u = a, d = new yi(512 + (a << 2)), f = new xi(d, 0, 256), p = new bi(d, 0, 256), m = new bi(d, 512, a), h = 512 + (a << 1), g = new G(d, h, a), _ = new G(d, h + a); s < 255 && o > 0;) {
		var v = Ai(o + 1), y = r >> 3, b = (1 << v + 1) - 1, x = (e[y] | e[y + 1] << 8 | e[y + 2] << 16) >> (r & 7) & b, S = (1 << v) - 1, C = b - o - 1, w = x & S;
		if (w < C ? (r += v, x = w) : (r += v + 1, x > S && (x -= C)), f[++s] = --x, x == -1 ? (o += x, g[--u] = s) : o -= x, !x) do {
			var T = r >> 3;
			c = (e[T] | e[T + 1] << 8) >> (r & 7) & 3, r += 2, s += c;
		} while (c == 3);
	}
	(s > 255 || o) && K(0);
	for (var E = 0, D = (a >> 1) + (a >> 3) + 3, O = a - 1, k = 0; k <= s; ++k) {
		var A = f[k];
		if (A < 1) {
			p[k] = -A;
			continue;
		}
		for (l = 0; l < A; ++l) {
			g[E] = k;
			do
				E = E + D & O;
			while (E >= u);
		}
	}
	for (E && K(0), l = 0; l < a; ++l) {
		var j = p[g[l]]++;
		m[l] = (j << (_[l] = i - Ai(j))) - a;
	}
	return [r + 7 >> 3, {
		b: i,
		s: g,
		n: _,
		t: m
	}];
}, Mi = function(e, t) {
	var n = 0, r = -1, i = new G(292), a = e[t], o = i.subarray(0, 256), s = i.subarray(256, 268), c = new bi(i.buffer, 268);
	if (a < 128) {
		var l = ji(e, t + 1, 6), u = l[0], d = l[1];
		t += a;
		var f = u << 3, p = e[t];
		p || K(0);
		for (var m = 0, h = 0, g = d.b, _ = g, v = (++t << 3) - 8 + Ai(p); v -= g, !(v < f);) {
			var y = v >> 3;
			if (m += (e[y] | e[y + 1] << 8) >> (v & 7) & (1 << g) - 1, o[++r] = d.s[m], v -= _, v < f) break;
			y = v >> 3, h += (e[y] | e[y + 1] << 8) >> (v & 7) & (1 << _) - 1, o[++r] = d.s[h], g = d.n[m], m = d.t[m], _ = d.n[h], h = d.t[h];
		}
		++r > 255 && K(0);
	} else {
		for (r = a - 127; n < r; n += 2) {
			var b = e[++t];
			o[n] = b >> 4, o[n + 1] = b & 15;
		}
		++t;
	}
	var x = 0;
	for (n = 0; n < r; ++n) {
		var S = o[n];
		S > 11 && K(0), x += S && 1 << S - 1;
	}
	var C = Ai(x) + 1, w = 1 << C, T = w - x;
	for (T & T - 1 && K(0), o[r++] = Ai(T) + 1, n = 0; n < r; ++n) {
		var S = o[n];
		++s[o[n] = S && C + 1 - S];
	}
	var E = new G(w << 1), D = E.subarray(0, w), O = E.subarray(w);
	for (c[C] = 0, n = C; n > 0; --n) {
		var k = c[n];
		wi(O, n, k, c[n - 1] = k + s[n] * (1 << C - n));
	}
	for (c[0] != w && K(0), n = 0; n < r; ++n) {
		var A = o[n];
		if (A) {
			var j = c[A];
			wi(D, n, j, c[A] = j + (1 << C - A));
		}
	}
	return [t, {
		n: O,
		b: C,
		s: D
	}];
}, Ni = (/*#__PURE__*/ ji(/*#__PURE__*/ new G([
	81,
	16,
	99,
	140,
	49,
	198,
	24,
	99,
	12,
	33,
	196,
	24,
	99,
	102,
	102,
	134,
	70,
	146,
	4
]), 0, 6))[1], Pi = (/*#__PURE__*/ ji(/*#__PURE__*/ new G([
	33,
	20,
	196,
	24,
	99,
	140,
	33,
	132,
	16,
	66,
	8,
	33,
	132,
	16,
	66,
	8,
	33,
	68,
	68,
	68,
	68,
	68,
	68,
	68,
	68,
	36,
	9
]), 0, 6))[1], Fi = (/*#__PURE__ */ ji(/*#__PURE__*/ new G([
	32,
	132,
	16,
	66,
	102,
	70,
	68,
	68,
	68,
	68,
	36,
	73,
	2
]), 0, 5))[1], Ii = function(e, t) {
	for (var n = e.length, r = new Si(n), i = 0; i < n; ++i) r[i] = t, t += 1 << e[i];
	return r;
}, Li = /*#__PURE__ */ new G((/*#__PURE__ */ new Si([
	0,
	0,
	0,
	0,
	16843009,
	50528770,
	134678020,
	202050057,
	269422093
])).buffer, 0, 36), Ri = /*#__PURE__ */ Ii(Li, 0), zi = /*#__PURE__ */ new G((/*#__PURE__ */ new Si([
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	16843009,
	50528770,
	117769220,
	185207048,
	252579084,
	16
])).buffer, 0, 53), Bi = /*#__PURE__ */ Ii(zi, 3), Vi = function(e, t, n) {
	var r = e.length, i = t.length, a = e[r - 1], o = (1 << n.b) - 1, s = -n.b;
	a || K(0);
	for (var c = 0, l = n.b, u = (r << 3) - 8 + Ai(a) - l, d = -1; u > s && d < i;) {
		var f = u >> 3, p = (e[f] | e[f + 1] << 8 | e[f + 2] << 16) >> (u & 7);
		c = (c << l | p) & o, t[++d] = n.s[c], u -= l = n.n[c];
	}
	(u != s || d + 1 != i) && K(0);
}, Hi = function(e, t, n) {
	var r = 6, i = t.length + 3 >> 2, a = i << 1, o = i + a;
	Vi(e.subarray(r, r += e[0] | e[1] << 8), t.subarray(0, i), n), Vi(e.subarray(r, r += e[2] | e[3] << 8), t.subarray(i, a), n), Vi(e.subarray(r, r += e[4] | e[5] << 8), t.subarray(a, o), n), Vi(e.subarray(r), t.subarray(o), n);
}, Ui = function(e, t, n) {
	var r, i = t.b, a = e[i], o = a >> 1 & 3;
	t.l = a & 1;
	var s = a >> 3 | e[i + 1] << 5 | e[i + 2] << 13, c = (i += 3) + s;
	if (o == 1) return i >= e.length ? void 0 : (t.b = i + 1, n ? (wi(n, e[i], t.y, t.y += s), n) : wi(new G(s), e[i]));
	if (!(c > e.length)) {
		if (o == 0) return t.b = c, n ? (n.set(e.subarray(i, c), t.y), t.y += s, n) : Ci(e, i, c);
		if (o == 2) {
			var l = e[i], u = l & 3, d = l >> 2 & 3, f = l >> 4, p = 0, m = 0;
			u < 2 ? d & 1 ? f |= e[++i] << 4 | (d & 2 && e[++i] << 12) : f = l >> 3 : (m = d, d < 2 ? (f |= (e[++i] & 63) << 4, p = e[i] >> 6 | e[++i] << 2) : d == 2 ? (f |= e[++i] << 4 | (e[++i] & 3) << 12, p = e[i] >> 2 | e[++i] << 6) : (f |= e[++i] << 4 | (e[++i] & 63) << 12, p = e[i] >> 6 | e[++i] << 2 | e[++i] << 10)), ++i;
			var h = n ? n.subarray(t.y, t.y + t.m) : new G(t.m), g = h.length - f;
			if (u == 0) h.set(e.subarray(i, i += f), g);
			else if (u == 1) wi(h, e[i++], g);
			else {
				var _ = t.h;
				if (u == 2) {
					var v = Mi(e, i);
					p += i - (i = v[0]), t.h = _ = v[1];
				} else _ || K(0);
				(m ? Hi : Vi)(e.subarray(i, i += p), h.subarray(g), _);
			}
			var y = e[i++];
			if (y) {
				y == 255 ? y = (e[i++] | e[i++] << 8) + 32512 : y > 127 && (y = y - 128 << 8 | e[i++]);
				var b = e[i++];
				b & 3 && K(0);
				for (var x = [
					Pi,
					Fi,
					Ni
				], S = 2; S > -1; --S) {
					var C = b >> (S << 1) + 2 & 3;
					if (C == 1) {
						var w = new G([
							0,
							0,
							e[i++]
						]);
						x[S] = {
							s: w.subarray(2, 3),
							n: w.subarray(0, 1),
							t: new bi(w.buffer, 0, 1),
							b: 0
						};
					} else C == 2 ? (r = ji(e, i, 9 - (S & 1)), i = r[0], x[S] = r[1]) : C == 3 && (t.t || K(0), x[S] = t.t[S]);
				}
				var T = t.t = x, E = T[0], D = T[1], O = T[2], k = e[c - 1];
				k || K(0);
				var A = (c << 3) - 8 + Ai(k) - O.b, j = A >> 3, M = 0, ee = (e[j] | e[j + 1] << 8) >> (A & 7) & (1 << O.b) - 1;
				j = (A -= D.b) >> 3;
				var te = (e[j] | e[j + 1] << 8) >> (A & 7) & (1 << D.b) - 1;
				j = (A -= E.b) >> 3;
				var ne = (e[j] | e[j + 1] << 8) >> (A & 7) & (1 << E.b) - 1;
				for (++y; --y;) {
					var re = O.s[ee], ie = O.n[ee], ae = E.s[ne], oe = E.n[ne], se = D.s[te], ce = D.n[te];
					j = (A -= se) >> 3;
					var le = 1 << se, ue = le + ((e[j] | e[j + 1] << 8 | e[j + 2] << 16 | e[j + 3] << 24) >>> (A & 7) & le - 1);
					j = (A -= zi[ae]) >> 3;
					var de = Bi[ae] + ((e[j] | e[j + 1] << 8 | e[j + 2] << 16) >> (A & 7) & (1 << zi[ae]) - 1);
					j = (A -= Li[re]) >> 3;
					var fe = Ri[re] + ((e[j] | e[j + 1] << 8 | e[j + 2] << 16) >> (A & 7) & (1 << Li[re]) - 1);
					if (j = (A -= ie) >> 3, ee = O.t[ee] + ((e[j] | e[j + 1] << 8) >> (A & 7) & (1 << ie) - 1), j = (A -= oe) >> 3, ne = E.t[ne] + ((e[j] | e[j + 1] << 8) >> (A & 7) & (1 << oe) - 1), j = (A -= ce) >> 3, te = D.t[te] + ((e[j] | e[j + 1] << 8) >> (A & 7) & (1 << ce) - 1), ue > 3) t.o[2] = t.o[1], t.o[1] = t.o[0], t.o[0] = ue -= 3;
					else {
						var pe = ue - (fe != 0);
						pe ? (ue = pe == 3 ? t.o[0] - 1 : t.o[pe], pe > 1 && (t.o[2] = t.o[1]), t.o[1] = t.o[0], t.o[0] = ue) : ue = t.o[0];
					}
					for (var S = 0; S < fe; ++S) h[M + S] = h[g + S];
					M += fe, g += fe;
					var me = M - ue;
					if (me < 0) {
						var he = -me, N = t.e + me;
						he > de && (he = de);
						for (var S = 0; S < he; ++S) h[M + S] = t.w[N + S];
						M += he, de -= he, me = 0;
					}
					for (var S = 0; S < de; ++S) h[M + S] = h[me + S];
					M += de;
				}
				if (M != g) for (; g < h.length;) h[M++] = h[g++];
				else M = h.length;
				n ? t.y += M : h = Ci(h, 0, M);
			} else if (n) {
				if (t.y += f, g) for (var S = 0; S < f; ++S) h[S] = h[g + S];
			} else g && (h = Ci(h, g));
			return t.b = c, h;
		}
		K(2);
	}
}, Wi = function(e, t) {
	if (e.length == 1) return e[0];
	for (var n = new G(t), r = 0, i = 0; r < e.length; ++r) {
		var a = e[r];
		n.set(a, i), i += a.length;
	}
	return n;
};
function Gi(e, t) {
	for (var n = [], r = +!t, i = 0, a = 0; e.length;) {
		var o = ki(e, r || t);
		if (typeof o == "object") {
			for (r ? (t = null, o.w.length == o.u && (n.push(t = o.w), a += o.u)) : (n.push(t), o.e = 0); !o.l;) {
				var s = Ui(e, o, t);
				s || K(5), t ? o.e = o.y : (n.push(s), a += s.length, Ti(o.w, 0, s.length), o.w.set(s, o.w.length - s.length));
			}
			i = o.b + o.c * 4;
		} else i = o;
		e = e.subarray(i);
	}
	return Wi(n, a);
}
//#endregion
//#region src/brdb/bytes.ts
var Ki = class {
	constructor(e = 256) {
		this.len = 0, this.buf = new Uint8Array(Math.max(e, 16)), this.view = new DataView(this.buf.buffer);
	}
	ensure(e) {
		if (this.len + e <= this.buf.length) return;
		let t = this.buf.length * 2;
		for (; t < this.len + e;) t *= 2;
		let n = new Uint8Array(t);
		n.set(this.buf.subarray(0, this.len)), this.buf = n, this.view = new DataView(n.buffer);
	}
	get length() {
		return this.len;
	}
	u8(e) {
		this.ensure(1), this.buf[this.len++] = e & 255;
	}
	i8(e) {
		this.ensure(1), this.view.setInt8(this.len, e), this.len += 1;
	}
	bytes(e) {
		let t = e instanceof Uint8Array ? e : Uint8Array.from(e);
		this.ensure(t.length), this.buf.set(t, this.len), this.len += t.length;
	}
	u16be(e) {
		this.ensure(2), this.view.setUint16(this.len, e, !1), this.len += 2;
	}
	u32be(e) {
		this.ensure(4), this.view.setUint32(this.len, e, !1), this.len += 4;
	}
	u64be(e) {
		this.ensure(8), this.view.setBigUint64(this.len, e, !1), this.len += 8;
	}
	i16be(e) {
		this.ensure(2), this.view.setInt16(this.len, e, !1), this.len += 2;
	}
	i32be(e) {
		this.ensure(4), this.view.setInt32(this.len, e, !1), this.len += 4;
	}
	i64be(e) {
		this.ensure(8), this.view.setBigInt64(this.len, e, !1), this.len += 8;
	}
	f32be(e) {
		this.ensure(4), this.view.setFloat32(this.len, e, !1), this.len += 4;
	}
	f64be(e) {
		this.ensure(8), this.view.setFloat64(this.len, e, !1), this.len += 8;
	}
	u16le(e) {
		this.ensure(2), this.view.setUint16(this.len, e, !0), this.len += 2;
	}
	u32le(e) {
		this.ensure(4), this.view.setUint32(this.len, e, !0), this.len += 4;
	}
	u64le(e) {
		this.ensure(8), this.view.setBigUint64(this.len, e, !0), this.len += 8;
	}
	i16le(e) {
		this.ensure(2), this.view.setInt16(this.len, e, !0), this.len += 2;
	}
	i32le(e) {
		this.ensure(4), this.view.setInt32(this.len, e, !0), this.len += 4;
	}
	i64le(e) {
		this.ensure(8), this.view.setBigInt64(this.len, e, !0), this.len += 8;
	}
	f32le(e) {
		this.ensure(4), this.view.setFloat32(this.len, e, !0), this.len += 4;
	}
	f64le(e) {
		this.ensure(8), this.view.setFloat64(this.len, e, !0), this.len += 8;
	}
	toBytes() {
		return this.buf.slice(0, this.len);
	}
}, qi = class {
	constructor(e, t = 0) {
		this.data = e, this.view = new DataView(e.buffer, e.byteOffset, e.byteLength), this.offset = t;
	}
	get remaining() {
		return this.data.length - this.offset;
	}
	need(e) {
		if (this.offset + e > this.data.length) throw RangeError(`brdb: unexpected end of data (need ${e} bytes at offset ${this.offset} of ${this.data.length})`);
	}
	peek() {
		return this.need(1), this.data[this.offset];
	}
	u8() {
		return this.need(1), this.data[this.offset++];
	}
	i8() {
		return this.need(1), this.view.getInt8(this.offset++);
	}
	bytes(e) {
		this.need(e);
		let t = this.data.subarray(this.offset, this.offset + e);
		return this.offset += e, t;
	}
	u16be() {
		this.need(2);
		let e = this.view.getUint16(this.offset, !1);
		return this.offset += 2, e;
	}
	u32be() {
		this.need(4);
		let e = this.view.getUint32(this.offset, !1);
		return this.offset += 4, e;
	}
	u64be() {
		this.need(8);
		let e = this.view.getBigUint64(this.offset, !1);
		return this.offset += 8, e;
	}
	i16be() {
		this.need(2);
		let e = this.view.getInt16(this.offset, !1);
		return this.offset += 2, e;
	}
	i32be() {
		this.need(4);
		let e = this.view.getInt32(this.offset, !1);
		return this.offset += 4, e;
	}
	i64be() {
		this.need(8);
		let e = this.view.getBigInt64(this.offset, !1);
		return this.offset += 8, e;
	}
	f32be() {
		this.need(4);
		let e = this.view.getFloat32(this.offset, !1);
		return this.offset += 4, e;
	}
	f64be() {
		this.need(8);
		let e = this.view.getFloat64(this.offset, !1);
		return this.offset += 8, e;
	}
	u16le() {
		this.need(2);
		let e = this.view.getUint16(this.offset, !0);
		return this.offset += 2, e;
	}
	u32le() {
		this.need(4);
		let e = this.view.getUint32(this.offset, !0);
		return this.offset += 4, e;
	}
	u64le() {
		this.need(8);
		let e = this.view.getBigUint64(this.offset, !0);
		return this.offset += 8, e;
	}
	i16le() {
		this.need(2);
		let e = this.view.getInt16(this.offset, !0);
		return this.offset += 2, e;
	}
	i32le() {
		this.need(4);
		let e = this.view.getInt32(this.offset, !0);
		return this.offset += 4, e;
	}
	i64le() {
		this.need(8);
		let e = this.view.getBigInt64(this.offset, !0);
		return this.offset += 8, e;
	}
	f32le() {
		this.need(4);
		let e = this.view.getFloat32(this.offset, !0);
		return this.offset += 4, e;
	}
	f64le() {
		this.need(8);
		let e = this.view.getFloat64(this.offset, !0);
		return this.offset += 8, e;
	}
}, Ji = new Uint8Array([
	66,
	82,
	90
]);
function Yi(e, t = {}) {
	let n = e.map(([e, t]) => ({
		parentId: -1,
		name: e,
		node: t
	})), r = [], i = [], a = [], o = [], s = [], c = [], l = [], u = [], d = [], f = [], p = /* @__PURE__ */ new Map();
	for (let e = 0; e < n.length; e++) {
		let { parentId: m, name: h, node: g } = n[e];
		if (g.type === "folder") {
			let e = r.length;
			r.push(m), i.push(h);
			for (let [t, r] of g.children) n.push({
				parentId: e,
				name: t,
				node: r
			});
		} else {
			a.push(m), s.push(h);
			let e = g.content, n;
			if (e.length === 0) n = -1;
			else {
				let r = gi(e), i = ni(r), a = p.get(i);
				if (a !== void 0) n = a;
				else {
					n = d.length, p.set(i, n), d.push(r), l.push(e.length);
					let a = t.compress ? t.compress(e) : null;
					a && a.length < e.length ? (c.push(1), u.push(a.length), f.push(a)) : (c.push(0), u.push(e.length), f.push(e));
				}
			}
			o.push(n);
		}
	}
	let m = new TextEncoder(), h = i.map((e) => m.encode(e)), g = s.map((e) => m.encode(e)), _ = (e) => e.reduce((e, t) => e + t.length, 0), v = new Ki(12 + r.length * 4 + i.length * 2 + _(h) + a.length * 4 + o.length * 4 + s.length * 2 + _(g) + c.length + l.length * 4 + u.length * 4 + d.length * 32);
	v.i32le(i.length), v.i32le(s.length), v.i32le(d.length);
	for (let e of r) v.i32le(e);
	for (let e of h) v.u16le(e.length);
	for (let e of h) v.bytes(e);
	for (let e of a) v.i32le(e);
	for (let e of o) v.i32le(e);
	for (let e of g) v.u16le(e.length);
	for (let e of g) v.bytes(e);
	for (let e of c) v.u8(e);
	for (let e of l) v.i32le(e);
	for (let e of u) v.i32le(e);
	for (let e of d) v.bytes(e);
	let y = v.toBytes(), b = new Ki(45 + y.length + f.reduce((e, t) => e + t.length, 0));
	b.bytes(Ji), b.u8(0), b.u8(0), b.i32le(y.length), b.i32le(y.length), b.bytes(gi(y)), b.bytes(y);
	for (let e of f) b.bytes(e);
	return b.toBytes();
}
var Xi = class e {
	constructor(e, t, n, r, i, a, o) {
		this.folderParentIds = e, this.folderNames = t, this.fileParentIds = n, this.fileContentIds = r, this.fileNames = i, this.blobs = a, this.blobData = o, this.folderLut = /* @__PURE__ */ new Map(), this.fileLut = /* @__PURE__ */ new Map(), this.pathCache = null;
		for (let n = 0; n < t.length; n++) this.folderLut.set(`${e[n]} ${t[n]}`, n);
		for (let e = 0; e < i.length; e++) this.fileLut.set(`${n[e]} ${i[e]}`, e);
	}
	static from(t) {
		let n = new qi(t), r = n.bytes(3);
		if (r[0] !== 66 || r[1] !== 82 || r[2] !== 90) throw Error("brdb: invalid .brz magic");
		let i = n.u8();
		if (i !== 0) throw Error(`brdb: unsupported .brz version ${i}`);
		let a = n.u8();
		if (a !== 0 && a !== 1) throw Error(`brdb: invalid index compression method ${a}`);
		let o = n.i32le(), s = n.i32le();
		if (o < 0 || s < 0) throw Error("brdb: negative index size");
		let c = n.bytes(32), l;
		if (a === 0) l = n.bytes(o);
		else if (l = Gi(n.bytes(s), new Uint8Array(o)), l.length !== o) throw Error("brdb: index decompressed to the wrong size");
		if (ni(gi(l)) !== ni(c)) throw Error("brdb: index hash mismatch");
		let u = n.bytes(n.remaining), d = new qi(l), f = d.i32le(), p = d.i32le(), m = d.i32le();
		if (f < 0 || p < 0 || m < 0) throw Error("brdb: negative index count");
		let h = (e, t) => Array.from({ length: e }, t), g = h(f, () => d.i32le()), _ = h(f, () => d.u16le()), v = new TextDecoder("utf-8", { fatal: !0 }), y = _.map((e) => v.decode(d.bytes(e))), b = h(p, () => d.i32le()), x = h(p, () => d.i32le()), S = h(p, () => d.u16le()).map((e) => v.decode(d.bytes(e))), C = h(m, () => d.u8()), w = h(m, () => d.i32le()), T = h(m, () => d.i32le()), E = h(m, () => d.bytes(32).slice());
		if (d.remaining !== 0) throw Error("brdb: trailing bytes in index");
		let D = [], O = 0;
		for (let e = 0; e < m; e++) {
			if (w[e] < 0 || T[e] < 0) throw Error("brdb: negative blob size");
			let t = C[e] === 0 ? w[e] : T[e];
			D.push({
				method: C[e],
				sizeUncompressed: w[e],
				sizeCompressed: T[e],
				hash: E[e],
				start: O,
				end: O + t
			}), O += t;
		}
		return new e(g, y, b, x, S, D, u);
	}
	findFolder(e, t) {
		return this.folderLut.get(`${e} ${t}`) ?? null;
	}
	findFile(e, t) {
		let n = this.fileLut.get(`${e} ${t}`);
		return n === void 0 ? null : { contentId: this.fileContentIds[n] };
	}
	folderIdOf(e) {
		if (e === "") return -1;
		let t = -1;
		for (let n of e.split("/")) {
			let e = this.findFolder(t, n);
			if (e === null) return null;
			t = e;
		}
		return t;
	}
	childFolders(e) {
		let t = this.folderIdOf(e);
		if (t === null) return [];
		let n = [];
		for (let e = 0; e < this.folderNames.length; e++) this.folderParentIds[e] === t && n.push(this.folderNames[e]);
		return n;
	}
	childFiles(e) {
		let t = this.folderIdOf(e);
		if (t === null) return [];
		let n = [];
		for (let e = 0; e < this.fileNames.length; e++) this.fileParentIds[e] === t && n.push(this.fileNames[e]);
		return n;
	}
	blobMethod(e) {
		return this.blob(e).method;
	}
	blob(e) {
		if (e < 0 || e >= this.blobs.length) throw Error(`brdb: blob ${e} not found`);
		return this.blobs[e];
	}
	readBlob(e) {
		let t = this.blob(e), n = this.blobData.subarray(t.start, t.end), r;
		if (t.method === 0) r = n;
		else {
			if (n.length !== t.sizeCompressed) throw Error("brdb: blob compressed size mismatch");
			r = Gi(n, new Uint8Array(t.sizeUncompressed));
		}
		if (r.length !== t.sizeUncompressed) throw Error("brdb: blob uncompressed size mismatch");
		if (ni(gi(r)) !== ni(t.hash)) throw Error("brdb: blob hash mismatch");
		return r;
	}
	readFile(e) {
		if (e.startsWith("/")) throw Error("brdb: absolute paths not allowed");
		let t = e.split("/"), n = -1;
		for (let r = 0; r < t.length - 1; r++) {
			let i = this.findFolder(n, t[r]);
			if (i === null) throw Error(`brdb: folder not found: ${t[r]} in ${e}`);
			n = i;
		}
		let r = this.findFile(n, t[t.length - 1]);
		if (!r) throw Error(`brdb: file not found: ${e}`);
		return r.contentId === -1 ? /* @__PURE__ */ new Uint8Array() : this.readBlob(r.contentId);
	}
	findFileByPath(e) {
		if (e.startsWith("/")) throw Error("brdb: absolute paths not allowed");
		let t = e.lastIndexOf("/"), n = this.folderIdOf(t === -1 ? "" : e.slice(0, t));
		if (n === null) return null;
		let r = this.findFile(n, e.slice(t + 1));
		return r === null ? null : {
			contentId: r.contentId,
			createdAt: 0
		};
	}
	findFileByPathAtRevision(e, t) {
		return this.findFileByPath(e);
	}
	listPaths() {
		if (this.pathCache) return this.pathCache;
		let e = [];
		for (let t = 0; t < this.folderNames.length; t++) {
			let n = this.folderParentIds[t];
			e.push(n === -1 ? this.folderNames[t] : `${e[n]}/${this.folderNames[t]}`);
		}
		return this.pathCache = this.fileNames.map((t, n) => {
			let r = this.fileParentIds[n];
			return r === -1 ? t : `${e[r]}/${t}`;
		}), this.pathCache;
	}
}, Zi = /* @__PURE__ */ new Map([
	["B_1x1F_Octo", [
		5,
		5,
		2
	]],
	["B_1x1F_Round", [
		5,
		5,
		2
	]],
	["B_1x1F_Speaker", [
		5,
		5,
		2
	]],
	["B_1x1_Brick_Side", [
		5,
		5,
		6
	]],
	["B_1x1_Brick_Side_Lip", [
		5,
		5,
		6
	]],
	["B_1x1_Coin", [
		5,
		5,
		1
	]],
	["B_1x1_Coin_Diagonal", [
		5,
		5,
		1
	]],
	["B_1x1_Cone", [
		5,
		5,
		6
	]],
	["B_1x1_Gate_AudioReference", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_BrickAssetReference", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Clock", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_DeltaTime", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_EntityTypeReference", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_ArrayVar_Append", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_ArrayVar_Average", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_ArrayVar_Clear", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_ArrayVar_CopyFrom", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_ArrayVar_Fill", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_ArrayVar_Find", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_ArrayVar_Get", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_ArrayVar_GetLength", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_ArrayVar_Insert", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_ArrayVar_Max", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_ArrayVar_Min", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_ArrayVar_Pop", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_ArrayVar_Push", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_ArrayVar_RemoveAtIndex", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_ArrayVar_Resize", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_ArrayVar_Reverse", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_ArrayVar_SetAtIndex", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_ArrayVar_Shuffle", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_ArrayVar_Slice", [
		6,
		5,
		2
	]],
	["B_1x1_Gate_Exec_ArrayVar_Sort", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_ArrayVar_SortMultiple", [
		10,
		5,
		2
	]],
	["B_1x1_Gate_Exec_ArrayVar_Sum", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_ArrayVar_Swap", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Branch", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Character_AddInventoryBrick", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Character_AddInventoryEntity", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Character_AddInventoryEntry", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Character_AddInventoryItem", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Character_AddInventoryItemAdv", [
		9,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Character_GetAim", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Character_GetAmmo", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Character_GetCurrentInventorySlot", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Character_GetDamage", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Character_GetFromController", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Character_GetInventoryEntry", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Character_GetWeaponChamberAmmo", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Character_GrantAmmo", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Character_IncDamage", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Character_IncWeaponChamberAmmo", [
		6,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Character_SetAmmo", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Character_SetDamage", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Character_SetInventoryBrick", [
		6,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Character_SetInventoryEntity", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Character_SetInventoryEntry", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Character_SetInventoryItem", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Character_SetInventoryItemAdv", [
		10,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Character_SetTempPermission", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Character_SetWeaponChamberAmmo", [
		6,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Character_ShowHint", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_ChatCommand", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Cycle", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Entity_AddLocationRotation", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Entity_AddVelocity", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Entity_DestroySpawned", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Entity_DestroySpawnedPrefab", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Entity_GetAngularVelocity", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Entity_GetLinearVelocity", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Entity_GetLocation", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Entity_GetLocationRotation", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Entity_GetRotation", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Entity_GetSpeed", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Entity_GetTag", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Entity_GetTeam", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Entity_GetVelocity", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Entity_GetVelocityAtPoint", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Entity_IsFrozen", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Entity_PlayAudioAt", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Entity_RelativeTeleport", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Entity_SetAngularVelocity", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Entity_SetFrozen", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Entity_SetGravityDirection", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Entity_SetLinearVelocity", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Entity_SetLocation", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Entity_SetLocationRotation", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Entity_SetRotation", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Entity_SetTag", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Entity_SetTeam", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Entity_SetVelocity", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Entity_Teleport", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Gamemode_BroadcastChatMessage", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Gamemode_BroadcastStatusMessage", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Gamemode_FillArrayFromPlayers", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Gamemode_FillArrayFromTeamMembers", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Gamemode_GetCurrentRound", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Gamemode_GetLeaderboardValue", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Gamemode_GetTeam", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Gamemode_GetTeamByName", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Gamemode_GetTeamLeaderboardValue", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Gamemode_GetTeamName", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Gamemode_IncrementLeaderboardValue", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Gamemode_IncrementTeamLeaderboardValue", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Gamemode_PlayerWins", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Gamemode_SetLeaderboardValue", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Gamemode_SetTeam", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Gamemode_SetTeamLeaderboardValue", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Gamemode_SetTeamPinned", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Gamemode_TeamWins", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_GetInputs", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_GetOwnTransform", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_MapVar_Clear", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_MapVar_CopyFrom", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_MapVar_Get", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_MapVar_GetKeys", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_MapVar_GetLength", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_MapVar_GetValues", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_MapVar_Has", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_MapVar_Remove", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_MapVar_Set", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_PlayClientAudio", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_PlayGlobalAudio", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_PlayerState_DisplayText", [
		7,
		5,
		2
	]],
	["B_1x1_Gate_Exec_PlayerState_ForceRespawn", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_PlayerState_GetDisplayName", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_PlayerState_GetFromEntity", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_PlayerState_GetUserId", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_PlayerState_GetUserName", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_PlayerState_HasPermission", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_PlayerState_HasRole", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_PlayerState_IsTrustedByBrickOwner", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_PlayerState_SetCanRespawn", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_PlayerState_ShowChatMessage", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_PlayerState_ShowMessageBox", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_PlayerState_ShowStatusMessage", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_PrefabSpawner", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_PrintToConsole", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Random", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_SpawnExplosion", [
		7,
		5,
		2
	]],
	["B_1x1_Gate_Exec_SpawnExplosionAt", [
		7,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Sweep", [
		8,
		5,
		2
	]],
	["B_1x1_Gate_Exec_SweepSimple", [
		8,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Toggle", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Union", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Var_Get", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Var_Increment", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Var_Set", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_WholeGridInteracted", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_WholeGridTargeted", [
		6,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Zone_GetEntities", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Exec_Zone_GetPlayers", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_BitwiseAND", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_BitwiseBitCount", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_BitwiseNAND", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_BitwiseNOR", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_BitwiseNOT", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_BitwiseOR", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_BitwiseShiftLeft", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_BitwiseShiftRight", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_BitwiseShiftRightLogical", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_BitwiseXOR", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_Ceil", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_ChangeDetector", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_ChangeDetectorExec", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_ColorBlend", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_ColorConvert", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_ColorToHex", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_CompareEqual", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_CompareGreater", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_CompareGreaterOrEqual", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_CompareLess", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_CompareLessOrEqual", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_CompareNotEqual", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_Convert", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_DirectionToRotation", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_EdgeDetector", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_EdgeDetectorExec", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_EnumToInteger", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_Floor", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_Gamemode_IsBuilderTeam", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_Gamemode_IsUnaffiliatedTeam", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_IntegerToEnum", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_InvertRotation", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_ItemToPickup", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_LogicalAND", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_LogicalNAND", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_LogicalNOR", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_LogicalNOT", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_LogicalOR", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_LogicalXOR", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MakeColor", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MakeColorHex", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MakeColorSRGB", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MakeQuaternion", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MakeRotation", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MakeVector", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MathAbs", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MathAcos", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MathAcosh", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MathAdd", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MathAsin", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MathAsinh", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MathAtan", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MathAtan2", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MathAtanh", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MathBlend", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MathClamp", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MathCos", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MathCosh", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MathDegreesToRadians", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MathDivide", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MathEasing", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MathExp", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MathLn", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MathLogBase", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MathMax", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MathMin", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MathModulo", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MathModuloFloored", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MathMultiply", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MathNegate", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MathPow", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MathRadiansToDegrees", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MathSign", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MathSin", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MathSinh", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MathSqrt", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MathSubtract", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MathTan", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_MathTanh", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_NearlyEqual", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_QuatAngleBetween", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_QuatBetween", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_QuatDotProduct", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_QuatFromAxisAngle", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_QuatSlerp", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_QuatToAxisAngle", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_Remap", [
		6,
		5,
		2
	]],
	["B_1x1_Gate_Expr_RotateVector", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_RotationToDirection", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_Round", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_Select", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_SplitColor", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_SplitColorSRGB", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_SplitQuaternion", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_SplitRotation", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_SplitVector", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_String_CharacterToCodepoint", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_String_CodepointToCharacter", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_String_Concatenate", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_String_Contains", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_String_EndsWith", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_String_Find", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_String_FormatText", [
		9,
		5,
		2
	]],
	["B_1x1_Gate_Expr_String_Length", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_String_ParseInt", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_String_ParseNumber", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_String_Replace", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_String_Split", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_String_StartsWith", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_String_Substring", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_String_ToLower", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_String_ToUpper", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_String_Trim", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_Swap", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_VecCrossProduct", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_VecDistance", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_VecDistanceSquared", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_VecDotProduct", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_VecMagnitude", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_VecMagnitudeSquared", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_VecNormalize", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Expr_VecScale", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Fake_Gamemode_CharacterDamagedEvent", [
		7,
		5,
		2
	]],
	["B_1x1_Gate_Fake_Gamemode_CharacterDiedEvent", [
		6,
		5,
		2
	]],
	["B_1x1_Gate_Fake_Gamemode_CharacterFiredWeaponEvent", [
		7,
		5,
		2
	]],
	["B_1x1_Gate_Fake_Gamemode_CharacterSpawnedEvent", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Fake_Gamemode_ControllerJoinedEvent", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Fake_Gamemode_ControllerJoinedTeamEvent", [
		6,
		5,
		2
	]],
	["B_1x1_Gate_Fake_Gamemode_ControllerLeftEvent", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Fake_Gamemode_ControllerLeftTeamEvent", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Fake_Gamemode_RoundEndEvent", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Fake_Gamemode_RoundStartEvent", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_FindPlayer", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_FontReference", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_FormatDate", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_GetUnixEpoch", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Internal_CharacterZoneEvent_Entered", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Internal_CharacterZoneEvent_Left", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Internal_EntityZoneEvent_Entered", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Internal_EntityZoneEvent_Left", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Internal_ProjectileZoneEvent_Entered", [
		6,
		5,
		2
	]],
	["B_1x1_Gate_Internal_ProjectileZoneEvent_Left", [
		6,
		5,
		2
	]],
	["B_1x1_Gate_Internal_ReadBrickGrid", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Internal_ZoneEvent_BrickChanged", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Internal_ZoneEvent_BrickRemoved", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_ItemReference", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_MicrochipInput", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_MicrochipOutput", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_OneShotAudioReference", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_PickupReference", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_ProjectileReference", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Pseudo_BufferSeconds", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Pseudo_BufferTicks", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Pseudo_CustomEvent", [
		10,
		5,
		2
	]],
	["B_1x1_Gate_Pseudo_CustomEvent_Global", [
		10,
		5,
		2
	]],
	["B_1x1_Gate_Pseudo_Dampen", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Pseudo_QueueSeconds", [
		10,
		5,
		2
	]],
	["B_1x1_Gate_Pseudo_QueueTicks", [
		10,
		5,
		2
	]],
	["B_1x1_Gate_Pseudo_SendCustomEvent", [
		10,
		5,
		2
	]],
	["B_1x1_Gate_Pseudo_SendCustomEvent_Global", [
		10,
		5,
		2
	]],
	["B_1x1_Gate_Pseudo_Timer", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Pseudo_Tween", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_SeatControlSplitter", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_ServerUptime", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Variable", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Variable_Array", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_Variable_Map", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_WeaponResourceReference", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_WeightBrick", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_WheelEngineAudioReference", [
		5,
		5,
		2
	]],
	["B_1x1_Gate_WheelEngineSlim", [
		5,
		5,
		2
	]],
	["B_1x1_Microchip", [
		5,
		5,
		2
	]],
	["B_1x1_Reroute_Node", [
		1,
		1,
		1
	]],
	["B_1x1_Round", [
		5,
		5,
		6
	]],
	["B_1x1_SoundEmitter", [
		5,
		5,
		2
	]],
	["B_1x1f_Inverse_Tile_Corner", [
		5,
		5,
		2
	]],
	["B_1x1f_Tile_Corner", [
		5,
		5,
		2
	]],
	["B_1x2_MetalIngot", [
		10,
		5,
		2
	]],
	["B_1x2_Overhang", [
		6,
		10,
		5
	]],
	["B_1x2f_Plate_Center", [
		10,
		5,
		2
	]],
	["B_1x2f_Plate_Center_Inv", [
		10,
		5,
		2
	]],
	["B_1x4_Brick_Side", [
		20,
		5,
		6
	]],
	["B_1x_Octo", [
		5,
		5,
		5
	]],
	["B_1x_Octo_90Deg", [
		5,
		5,
		5
	]],
	["B_1x_Octo_90Deg_Inv", [
		5,
		5,
		5
	]],
	["B_1x_Octo_T", [
		5,
		5,
		5
	]],
	["B_1x_Octo_T_Inv", [
		5,
		5,
		5
	]],
	["B_2x1_Slipper", [
		10,
		5,
		6
	]],
	["B_2x2F_Octo", [
		10,
		10,
		2
	]],
	["B_2x2F_Octo_Converter", [
		10,
		10,
		2
	]],
	["B_2x2F_Octo_Converter_Inv", [
		10,
		10,
		2
	]],
	["B_2x2F_Round", [
		10,
		10,
		2
	]],
	["B_2x2F_Speaker", [
		10,
		10,
		2
	]],
	["B_2x2F_Target", [
		10,
		10,
		2
	]],
	["B_2x2_Cannon", [
		10,
		10,
		40
	]],
	["B_2x2_Cone", [
		10,
		10,
		12
	]],
	["B_2x2_Corner", [
		10,
		10,
		6
	]],
	["B_2x2_Overhang", [
		6,
		10,
		10
	]],
	["B_2x2_Round", [
		10,
		10,
		6
	]],
	["B_2x2_Slipper", [
		10,
		10,
		6
	]],
	["B_2x2_Thruster", [
		10,
		10,
		8
	]],
	["B_2x2f_Plate_Center", [
		10,
		10,
		2
	]],
	["B_2x2f_Plate_Center_Inv", [
		10,
		10,
		2
	]],
	["B_2x4_Door_Frame", [
		10,
		20,
		36
	]],
	["B_2x_Octo", [
		10,
		10,
		10
	]],
	["B_2x_Octo_90Deg", [
		10,
		10,
		10
	]],
	["B_2x_Octo_90Deg_Inv", [
		10,
		10,
		10
	]],
	["B_2x_Octo_Cone", [
		10,
		10,
		10
	]],
	["B_2x_Octo_T", [
		10,
		10,
		10
	]],
	["B_2x_Octo_T_Inv", [
		10,
		10,
		10
	]],
	["B_4x4_Round", [
		20,
		20,
		6
	]],
	["B_8x8_Lattice_Plate", [
		40,
		40,
		2
	]],
	["B_Bishop", [
		5,
		5,
		10
	]],
	["B_Bone", [
		10,
		10,
		2
	]],
	["B_BoneStraight", [
		10,
		5,
		2
	]],
	["B_Bot_Spawn_Point", [
		20,
		20,
		2
	]],
	["B_Branch", [
		20,
		11,
		2
	]],
	["B_Bush", [
		15,
		15,
		16
	]],
	["B_Button", [
		5,
		5,
		2
	]],
	["B_Button_Pressed", [
		5,
		5,
		2
	]],
	["B_Button_Square", [
		5,
		5,
		2
	]],
	["B_Button_Square_Pressed", [
		5,
		5,
		2
	]],
	["B_Cauldron", [
		10,
		10,
		10
	]],
	["B_Chalice", [
		5,
		5,
		10
	]],
	["B_CheckPoint", [
		20,
		20,
		2
	]],
	["B_Coffin", [
		5,
		20,
		30
	]],
	["B_Coffin_Lid", [
		10,
		20,
		30
	]],
	["B_DestinationPoint", [
		20,
		20,
		2
	]],
	["B_Fern", [
		10,
		10,
		2
	]],
	["B_Flame", [
		5,
		5,
		10
	]],
	["B_Flower", [
		10,
		10,
		2
	]],
	["B_Fork", [
		4,
		10,
		2
	]],
	["B_Frog", [
		10,
		10,
		7
	]],
	["B_Frog_Small", [
		5,
		5,
		4
	]],
	["B_GoalPoint", [
		20,
		20,
		2
	]],
	["B_Gravestone", [
		10,
		20,
		20
	]],
	["B_Gyroscope", [
		5,
		5,
		2
	]],
	["B_Handle", [
		5,
		10,
		6
	]],
	["B_Hedge_1x1", [
		5,
		5,
		6
	]],
	["B_Hedge_1x1_Corner", [
		5,
		5,
		6
	]],
	["B_Hedge_1x2", [
		5,
		10,
		6
	]],
	["B_Hedge_1x4", [
		5,
		20,
		6
	]],
	["B_Inverted_Cone", [
		5,
		5,
		8
	]],
	["B_Jar", [
		9,
		9,
		12
	]],
	["B_Joint_Bearing", [
		5,
		5,
		1
	]],
	["B_Joint_Bearing_Micro", [
		1,
		1,
		1
	]],
	["B_Joint_Motor", [
		5,
		5,
		1
	]],
	["B_Joint_Motor_Micro", [
		1,
		1,
		1
	]],
	["B_Joint_RigidBearing", [
		5,
		5,
		1
	]],
	["B_Joint_RigidBearing_Micro", [
		1,
		1,
		1
	]],
	["B_Joint_Servo", [
		5,
		5,
		1
	]],
	["B_Joint_Servo_Micro", [
		1,
		1,
		1
	]],
	["B_Joint_Socket", [
		5,
		5,
		2
	]],
	["B_Joint_Socket_Micro", [
		1,
		1,
		1
	]],
	["B_Joint_Wheel", [
		5,
		5,
		1
	]],
	["B_Joint_Wheel_Micro", [
		1,
		1,
		1
	]],
	["B_Joint_Wheel_Micro_Suspension", [
		1,
		1,
		1
	]],
	["B_Joint_Wheel_Suspension", [
		5,
		5,
		1
	]],
	["B_King", [
		5,
		5,
		12
	]],
	["B_Knight", [
		5,
		5,
		8
	]],
	["B_Ladder", [
		12,
		15,
		12
	]],
	["B_Leaf_Bush", [
		26,
		26,
		20
	]],
	["B_Lotus_1x1", [
		5,
		5,
		3
	]],
	["B_Lotus_2x2", [
		10,
		10,
		5
	]],
	["B_Pawn", [
		5,
		5,
		6
	]],
	["B_Pine_Tree", [
		20,
		20,
		38
	]],
	["B_Pumpkin", [
		10,
		10,
		7
	]],
	["B_Pumpkin_Carved", [
		10,
		10,
		7
	]],
	["B_Queen", [
		5,
		5,
		12
	]],
	["B_Rat", [
		5,
		15,
		4
	]],
	["B_Rook", [
		5,
		5,
		6
	]],
	["B_Rose", [
		5,
		5,
		4
	]],
	["B_Sausage", [
		10,
		5,
		2
	]],
	["B_Seat", [
		10,
		10,
		11
	]],
	["B_Small_Flower", [
		5,
		5,
		2
	]],
	["B_SpawnPoint", [
		20,
		20,
		2
	]],
	["B_Spawn_Point_Prefab", [
		40,
		40,
		2
	]],
	["B_Spoon", [
		4,
		10,
		2
	]],
	["B_Swirl_Plate", [
		5,
		5,
		4
	]],
	["B_Switch_Flipped", [
		5,
		5,
		3
	]],
	["B_Switch_Test", [
		5,
		5,
		3
	]],
	["B_Tulip", [
		5,
		5,
		6
	]],
	["B_Turkey_Body", [
		15,
		10,
		7
	]],
	["B_Turkey_Leg", [
		10,
		5,
		3
	]],
	["B_Vehicle_Engine", [
		10,
		11,
		10
	]],
	["Brickadia", [
		0,
		0,
		0
	]]
]), Qi = /* @__PURE__ */ "B_1x1_Reroute_Node.B_1x1_Gate_AND.B_1x1_Gate_OR.B_1x1_Gate_XOR.B_1x1_Gate_NAND.B_1x1_Gate_NOR.B_1x1_NOT_Gate.B_1x1_Gate_AND_Bitwise.B_1x1_Gate_OR_Bitwise.B_1x1_Gate_XOR_Bitwise.B_1x1_Gate_NAND_Bitwise.B_1x1_Gate_NOR_Bitwise.B_1x1_Gate_NOT_Bitwise.B_1x1_Gate_ShiftLeft_Bitwise.B_1x1_Gate_ShiftRight_Bitwise.B_1x1_Gate_Add.B_1x1_Gate_Subtract.B_1x1_Gate_Multiply.B_1x1_Gate_ModFloored.B_1x1_Gate_Mod.B_1x1_Gate_Divide.B_1x1_Gate_Equal.B_1x1_Gate_NotEqual.B_1x1_Gate_LessThan.B_1x1_Gate_LessThanEqual.B_1x1_Gate_GreaterThan.B_1x1_Gate_GreaterThanEqual.B_1x1_Gate_Ceiling.B_1x1_Gate_Floor.B_1x1_Gate_Constant.B_1x1_Gate_Blend.B_1x1_Gate_EdgeDetector.B_1x1_Gate_Timer.B_1x1_Gate_Timer_Tick.B_1x1_Microchip.B_1x1_Gate_MicrochipInput.B_1x1_Gate_MicrochipOutput.B_2x2_Overhang.B_1x4_Brick_Side.B_1x2_Overhang.B_1x1_Brick_Side_Lip.B_1x1_Brick_Side.B_Jar.B_Chalice.B_Cauldron.B_Small_Flower.B_Pine_Tree.B_Leaf_Bush.B_Hedge_1x4.B_Hedge_1x2.B_Hedge_1x1_Corner.B_Hedge_1x1.B_Flower.B_Fern.B_Branch.B_2x4_Door_Frame.B_Turkey_Leg.B_Turkey_Body.B_Swirl_Plate.B_Sausage.B_Pumpkin_Carved.B_Pumpkin.B_Ladder.B_Inverted_Cone.B_Handle.B_Gravestone.B_Frog_Small.B_Frog.B_Flame.B_Coffin_Lid.B_Coffin.B_BoneStraight.B_Bone.B_1x1_Coin_Diagonal.B_1x1_Coin.B_Spoon.B_Fork.B_2x2_Corner.B_2x2f_Plate_Center_Inv.B_2x2f_Plate_Center.B_1x2f_Plate_Center_Inv.B_4x4_Round.B_2x2_Round.B_2x2F_Round.B_2x_Octo_T_Inv.B_2x_Octo_T.B_2x2F_Octo_Converter_Inv.B_2x2F_Octo_Converter.B_2x2F_Octo.B_8x8_Lattice_Plate.B_1x2_MetalIngot.B_1x1f_Tile_Corner.B_1x1f_Inverse_Tile_Corner.B_Rook.B_Queen.B_Pawn.B_Knight.B_King.B_Bishop.B_1x2f_Plate_Center.B_2x2_Cone.B_1x1_Round.B_1x1_Cone.B_1x1F_Round.B_2x_Octo_Cone.B_2x_Octo_90Deg_Inv.B_2x_Octo_90Deg.B_2x_Octo.B_1x_Octo_T_Inv.B_1x_Octo_T.B_1x_Octo_90Deg_Inv.B_1x_Octo_90Deg.B_1x_Octo.B_1x1F_Octo.B_2x2_Slipper.B_2x1_Slipper.B_Joint_Wheel_Micro.B_Joint_Wheel.B_Joint_Socket_Micro.B_Joint_Servo_Micro.B_Joint_Servo.B_Joint_Motor_Micro.B_Joint_Motor.B_Joint_Coupler.B_Joint_Bearing_Micro.B_Joint_Bearing.B_1x1_SoundEmitter.B_1x1_Gate_Teleport.B_1x1_Gate_RelativeTeleport.B_1x1_Gate_Exec_PrefabSpawner.B_1x1_EntityGate_SetVelocity.B_1x1_EntityGate_SetLocationAndRotation.B_1x1_EntityGate_SetLocation.B_1x1_EntityGate_ReadBrickGrid.B_1x1_EntityGate_PlayAudioAt.B_1x1_EntityGate_AddVelocity.B_1x1_EntityGate_AddLocationAndRotation.B_1x1_CharacterGate_SetGravityDirection.B_Vehicle_Engine.B_Switch_Test.B_SpawnPoint.B_Seat.B_GoalPoint.B_DestinationPoint.B_CheckPoint.B_Button_Square.B_Button.B_Bot_Spawn_Point.B_2x2F_Target.B_2x2F_Speaker.B_1x1_Gate_WheelEngineSlim.B_1x1F_Speaker.B_1x1_Gate_AudioReference.B_1x1_Gate_BrickAssetReference.B_1x1_Gate_Clock.B_1x1_Gate_DeltaTime.B_1x1_Gate_EntityTypeReference.B_1x1_Gate_Exec_ArrayVar_Append.B_1x1_Gate_Exec_ArrayVar_Average.B_1x1_Gate_Exec_ArrayVar_Clear.B_1x1_Gate_Exec_ArrayVar_CopyFrom.B_1x1_Gate_Exec_ArrayVar_Fill.B_1x1_Gate_Exec_ArrayVar_Find.B_1x1_Gate_Exec_ArrayVar_Get.B_1x1_Gate_Exec_ArrayVar_GetLength.B_1x1_Gate_Exec_ArrayVar_Insert.B_1x1_Gate_Exec_ArrayVar_Max.B_1x1_Gate_Exec_ArrayVar_Min.B_1x1_Gate_Exec_ArrayVar_Pop.B_1x1_Gate_Exec_ArrayVar_Push.B_1x1_Gate_Exec_ArrayVar_RemoveAtIndex.B_1x1_Gate_Exec_ArrayVar_Resize.B_1x1_Gate_Exec_ArrayVar_Reverse.B_1x1_Gate_Exec_ArrayVar_SetAtIndex.B_1x1_Gate_Exec_ArrayVar_Shuffle.B_1x1_Gate_Exec_ArrayVar_Slice.B_1x1_Gate_Exec_ArrayVar_Sort.B_1x1_Gate_Exec_ArrayVar_SortMultiple.B_1x1_Gate_Exec_ArrayVar_Sum.B_1x1_Gate_Exec_ArrayVar_Swap.B_1x1_Gate_Exec_Branch.B_1x1_Gate_Exec_Character_AddInventoryBrick.B_1x1_Gate_Exec_Character_AddInventoryEntity.B_1x1_Gate_Exec_Character_AddInventoryEntry.B_1x1_Gate_Exec_Character_AddInventoryItem.B_1x1_Gate_Exec_Character_AddInventoryItemAdv.B_1x1_Gate_Exec_Character_GetAim.B_1x1_Gate_Exec_Character_GetAmmo.B_1x1_Gate_Exec_Character_GetCurrentInventorySlot.B_1x1_Gate_Exec_Character_GetDamage.B_1x1_Gate_Exec_Character_GetFromController.B_1x1_Gate_Exec_Character_GetInventoryEntry.B_1x1_Gate_Exec_Character_GetWeaponChamberAmmo.B_1x1_Gate_Exec_Character_GrantAmmo.B_1x1_Gate_Exec_Character_IncDamage.B_1x1_Gate_Exec_Character_IncWeaponChamberAmmo.B_1x1_Gate_Exec_Character_SetAmmo.B_1x1_Gate_Exec_Character_SetDamage.B_1x1_Gate_Exec_Character_SetInventoryBrick.B_1x1_Gate_Exec_Character_SetInventoryEntity.B_1x1_Gate_Exec_Character_SetInventoryEntry.B_1x1_Gate_Exec_Character_SetInventoryItem.B_1x1_Gate_Exec_Character_SetInventoryItemAdv.B_1x1_Gate_Exec_Character_SetTempPermission.B_1x1_Gate_Exec_Character_SetWeaponChamberAmmo.B_1x1_Gate_Exec_Character_ShowHint.B_1x1_Gate_Exec_ChatCommand.B_1x1_Gate_Exec_Cycle.B_1x1_Gate_Exec_Entity_AddLocationRotation.B_1x1_Gate_Exec_Entity_AddVelocity.B_1x1_Gate_Exec_Entity_DestroySpawned.B_1x1_Gate_Exec_Entity_DestroySpawnedPrefab.B_1x1_Gate_Exec_Entity_GetAngularVelocity.B_1x1_Gate_Exec_Entity_GetLinearVelocity.B_1x1_Gate_Exec_Entity_GetLocation.B_1x1_Gate_Exec_Entity_GetLocationRotation.B_1x1_Gate_Exec_Entity_GetRotation.B_1x1_Gate_Exec_Entity_GetSpeed.B_1x1_Gate_Exec_Entity_GetTag.B_1x1_Gate_Exec_Entity_GetTeam.B_1x1_Gate_Exec_Entity_GetVelocity.B_1x1_Gate_Exec_Entity_GetVelocityAtPoint.B_1x1_Gate_Exec_Entity_IsFrozen.B_1x1_Gate_Exec_Entity_PlayAudioAt.B_1x1_Gate_Exec_Entity_RelativeTeleport.B_1x1_Gate_Exec_Entity_SetAngularVelocity.B_1x1_Gate_Exec_Entity_SetFrozen.B_1x1_Gate_Exec_Entity_SetGravityDirection.B_1x1_Gate_Exec_Entity_SetLinearVelocity.B_1x1_Gate_Exec_Entity_SetLocation.B_1x1_Gate_Exec_Entity_SetLocationRotation.B_1x1_Gate_Exec_Entity_SetRotation.B_1x1_Gate_Exec_Entity_SetTag.B_1x1_Gate_Exec_Entity_SetTeam.B_1x1_Gate_Exec_Entity_SetVelocity.B_1x1_Gate_Exec_Entity_Teleport.B_1x1_Gate_Exec_Gamemode_BroadcastChatMessage.B_1x1_Gate_Exec_Gamemode_BroadcastStatusMessage.B_1x1_Gate_Exec_Gamemode_FillArrayFromPlayers.B_1x1_Gate_Exec_Gamemode_FillArrayFromTeamMembers.B_1x1_Gate_Exec_Gamemode_GetCurrentRound.B_1x1_Gate_Exec_Gamemode_GetLeaderboardValue.B_1x1_Gate_Exec_Gamemode_GetTeam.B_1x1_Gate_Exec_Gamemode_GetTeamByName.B_1x1_Gate_Exec_Gamemode_GetTeamLeaderboardValue.B_1x1_Gate_Exec_Gamemode_GetTeamName.B_1x1_Gate_Exec_Gamemode_IncrementLeaderboardValue.B_1x1_Gate_Exec_Gamemode_IncrementTeamLeaderboardValue.B_1x1_Gate_Exec_Gamemode_PlayerWins.B_1x1_Gate_Exec_Gamemode_SetLeaderboardValue.B_1x1_Gate_Exec_Gamemode_SetTeam.B_1x1_Gate_Exec_Gamemode_SetTeamLeaderboardValue.B_1x1_Gate_Exec_Gamemode_SetTeamPinned.B_1x1_Gate_Exec_Gamemode_TeamWins.B_1x1_Gate_Exec_GetInputs.B_1x1_Gate_Exec_GetOwnTransform.B_1x1_Gate_Exec_MapVar_Clear.B_1x1_Gate_Exec_MapVar_CopyFrom.B_1x1_Gate_Exec_MapVar_Get.B_1x1_Gate_Exec_MapVar_GetKeys.B_1x1_Gate_Exec_MapVar_GetLength.B_1x1_Gate_Exec_MapVar_GetValues.B_1x1_Gate_Exec_MapVar_Has.B_1x1_Gate_Exec_MapVar_Remove.B_1x1_Gate_Exec_MapVar_Set.B_1x1_Gate_Exec_PlayClientAudio.B_1x1_Gate_Exec_PlayGlobalAudio.B_1x1_Gate_Exec_PlayerState_DisplayText.B_1x1_Gate_Exec_PlayerState_ForceRespawn.B_1x1_Gate_Exec_PlayerState_GetDisplayName.B_1x1_Gate_Exec_PlayerState_GetFromEntity.B_1x1_Gate_Exec_PlayerState_GetUserId.B_1x1_Gate_Exec_PlayerState_GetUserName.B_1x1_Gate_Exec_PlayerState_HasPermission.B_1x1_Gate_Exec_PlayerState_HasRole.B_1x1_Gate_Exec_PlayerState_IsTrustedByBrickOwner.B_1x1_Gate_Exec_PlayerState_SetCanRespawn.B_1x1_Gate_Exec_PlayerState_ShowChatMessage.B_1x1_Gate_Exec_PlayerState_ShowMessageBox.B_1x1_Gate_Exec_PlayerState_ShowStatusMessage.B_1x1_Gate_Exec_PrintToConsole.B_1x1_Gate_Exec_Random.B_1x1_Gate_Exec_SpawnExplosion.B_1x1_Gate_Exec_SpawnExplosionAt.B_1x1_Gate_Exec_Sweep.B_1x1_Gate_Exec_SweepSimple.B_1x1_Gate_Exec_Toggle.B_1x1_Gate_Exec_Union.B_1x1_Gate_Exec_Var_Get.B_1x1_Gate_Exec_Var_Increment.B_1x1_Gate_Exec_Var_Set.B_1x1_Gate_Exec_Zone_GetEntities.B_1x1_Gate_Exec_Zone_GetPlayers.B_1x1_Gate_Expr_BitwiseAND.B_1x1_Gate_Expr_BitwiseBitCount.B_1x1_Gate_Expr_BitwiseNAND.B_1x1_Gate_Expr_BitwiseNOR.B_1x1_Gate_Expr_BitwiseNOT.B_1x1_Gate_Expr_BitwiseOR.B_1x1_Gate_Expr_BitwiseShiftLeft.B_1x1_Gate_Expr_BitwiseShiftRight.B_1x1_Gate_Expr_BitwiseShiftRightLogical.B_1x1_Gate_Expr_BitwiseXOR.B_1x1_Gate_Expr_Ceil.B_1x1_Gate_Expr_ChangeDetector.B_1x1_Gate_Expr_ChangeDetectorExec.B_1x1_Gate_Expr_ColorBlend.B_1x1_Gate_Expr_ColorConvert.B_1x1_Gate_Expr_ColorToHex.B_1x1_Gate_Expr_CompareEqual.B_1x1_Gate_Expr_CompareGreater.B_1x1_Gate_Expr_CompareGreaterOrEqual.B_1x1_Gate_Expr_CompareLess.B_1x1_Gate_Expr_CompareLessOrEqual.B_1x1_Gate_Expr_CompareNotEqual.B_1x1_Gate_Expr_Convert.B_1x1_Gate_Expr_DirectionToRotation.B_1x1_Gate_Expr_EdgeDetector.B_1x1_Gate_Expr_EdgeDetectorExec.B_1x1_Gate_Expr_EnumToInteger.B_1x1_Gate_Expr_Floor.B_1x1_Gate_Expr_Gamemode_IsBuilderTeam.B_1x1_Gate_Expr_Gamemode_IsUnaffiliatedTeam.B_1x1_Gate_Expr_IntegerToEnum.B_1x1_Gate_Expr_InvertRotation.B_1x1_Gate_Expr_ItemToPickup.B_1x1_Gate_Expr_LogicalAND.B_1x1_Gate_Expr_LogicalNAND.B_1x1_Gate_Expr_LogicalNOR.B_1x1_Gate_Expr_LogicalNOT.B_1x1_Gate_Expr_LogicalOR.B_1x1_Gate_Expr_LogicalXOR.B_1x1_Gate_Expr_MakeColor.B_1x1_Gate_Expr_MakeColorHex.B_1x1_Gate_Expr_MakeColorSRGB.B_1x1_Gate_Expr_MakeQuaternion.B_1x1_Gate_Expr_MakeRotation.B_1x1_Gate_Expr_MakeVector.B_1x1_Gate_Expr_MathAbs.B_1x1_Gate_Expr_MathAcos.B_1x1_Gate_Expr_MathAcosh.B_1x1_Gate_Expr_MathAdd.B_1x1_Gate_Expr_MathAsin.B_1x1_Gate_Expr_MathAsinh.B_1x1_Gate_Expr_MathAtan.B_1x1_Gate_Expr_MathAtan2.B_1x1_Gate_Expr_MathAtanh.B_1x1_Gate_Expr_MathBlend.B_1x1_Gate_Expr_MathClamp.B_1x1_Gate_Expr_MathCos.B_1x1_Gate_Expr_MathCosh.B_1x1_Gate_Expr_MathDegreesToRadians.B_1x1_Gate_Expr_MathDivide.B_1x1_Gate_Expr_MathEasing.B_1x1_Gate_Expr_MathExp.B_1x1_Gate_Expr_MathLn.B_1x1_Gate_Expr_MathLogBase.B_1x1_Gate_Expr_MathMax.B_1x1_Gate_Expr_MathMin.B_1x1_Gate_Expr_MathModulo.B_1x1_Gate_Expr_MathModuloFloored.B_1x1_Gate_Expr_MathMultiply.B_1x1_Gate_Expr_MathNegate.B_1x1_Gate_Expr_MathPow.B_1x1_Gate_Expr_MathRadiansToDegrees.B_1x1_Gate_Expr_MathSign.B_1x1_Gate_Expr_MathSin.B_1x1_Gate_Expr_MathSinh.B_1x1_Gate_Expr_MathSqrt.B_1x1_Gate_Expr_MathSubtract.B_1x1_Gate_Expr_MathTan.B_1x1_Gate_Expr_MathTanh.B_1x1_Gate_Expr_NearlyEqual.B_1x1_Gate_Expr_QuatAngleBetween.B_1x1_Gate_Expr_QuatBetween.B_1x1_Gate_Expr_QuatDotProduct.B_1x1_Gate_Expr_QuatFromAxisAngle.B_1x1_Gate_Expr_QuatSlerp.B_1x1_Gate_Expr_QuatToAxisAngle.B_1x1_Gate_Expr_Remap.B_1x1_Gate_Expr_RotateVector.B_1x1_Gate_Expr_RotationToDirection.B_1x1_Gate_Expr_Round.B_1x1_Gate_Expr_Select.B_1x1_Gate_Expr_SplitColor.B_1x1_Gate_Expr_SplitColorSRGB.B_1x1_Gate_Expr_SplitQuaternion.B_1x1_Gate_Expr_SplitRotation.B_1x1_Gate_Expr_SplitVector.B_1x1_Gate_Expr_String_CharacterToCodepoint.B_1x1_Gate_Expr_String_CodepointToCharacter.B_1x1_Gate_Expr_String_Concatenate.B_1x1_Gate_Expr_String_Contains.B_1x1_Gate_Expr_String_EndsWith.B_1x1_Gate_Expr_String_Find.B_1x1_Gate_Expr_String_FormatText.B_1x1_Gate_Expr_String_Length.B_1x1_Gate_Expr_String_ParseInt.B_1x1_Gate_Expr_String_ParseNumber.B_1x1_Gate_Expr_String_Replace.B_1x1_Gate_Expr_String_Split.B_1x1_Gate_Expr_String_StartsWith.B_1x1_Gate_Expr_String_Substring.B_1x1_Gate_Expr_String_ToLower.B_1x1_Gate_Expr_String_ToUpper.B_1x1_Gate_Expr_String_Trim.B_1x1_Gate_Expr_Swap.B_1x1_Gate_Expr_VecCrossProduct.B_1x1_Gate_Expr_VecDistance.B_1x1_Gate_Expr_VecDistanceSquared.B_1x1_Gate_Expr_VecDotProduct.B_1x1_Gate_Expr_VecMagnitude.B_1x1_Gate_Expr_VecMagnitudeSquared.B_1x1_Gate_Expr_VecNormalize.B_1x1_Gate_Expr_VecScale.B_1x1_Gate_Fake_Gamemode_CharacterDamagedEvent.B_1x1_Gate_Fake_Gamemode_CharacterDiedEvent.B_1x1_Gate_Fake_Gamemode_CharacterFiredWeaponEvent.B_1x1_Gate_Fake_Gamemode_CharacterSpawnedEvent.B_1x1_Gate_Fake_Gamemode_ControllerJoinedEvent.B_1x1_Gate_Fake_Gamemode_ControllerJoinedTeamEvent.B_1x1_Gate_Fake_Gamemode_ControllerLeftEvent.B_1x1_Gate_Fake_Gamemode_ControllerLeftTeamEvent.B_1x1_Gate_Fake_Gamemode_RoundEndEvent.B_1x1_Gate_Fake_Gamemode_RoundStartEvent.B_1x1_Gate_FindPlayer.B_1x1_Gate_FontReference.B_1x1_Gate_FormatDate.B_1x1_Gate_GetUnixEpoch.B_1x1_Gate_Internal_CharacterZoneEvent_Entered.B_1x1_Gate_Internal_CharacterZoneEvent_Left.B_1x1_Gate_Internal_EntityZoneEvent_Entered.B_1x1_Gate_Internal_EntityZoneEvent_Left.B_1x1_Gate_Internal_ProjectileZoneEvent_Entered.B_1x1_Gate_Internal_ProjectileZoneEvent_Left.B_1x1_Gate_Internal_ReadBrickGrid.B_1x1_Gate_Internal_ZoneEvent_BrickChanged.B_1x1_Gate_Internal_ZoneEvent_BrickRemoved.B_1x1_Gate_ItemReference.B_1x1_Gate_OneShotAudioReference.B_1x1_Gate_PickupReference.B_1x1_Gate_ProjectileReference.B_1x1_Gate_Pseudo_BufferSeconds.B_1x1_Gate_Pseudo_BufferTicks.B_1x1_Gate_Pseudo_CustomEvent.B_1x1_Gate_Pseudo_CustomEvent_Global.B_1x1_Gate_Pseudo_Dampen.B_1x1_Gate_Pseudo_QueueSeconds.B_1x1_Gate_Pseudo_QueueTicks.B_1x1_Gate_Pseudo_SendCustomEvent.B_1x1_Gate_Pseudo_SendCustomEvent_Global.B_1x1_Gate_Pseudo_Timer.B_1x1_Gate_Pseudo_Tween.B_1x1_Gate_SeatControlSplitter.B_1x1_Gate_ServerUptime.B_1x1_Gate_Variable.B_1x1_Gate_Variable_Array.B_1x1_Gate_Variable_Map.B_1x1_Gate_WeaponResourceReference.B_1x1_Gate_WeightBrick.B_1x1_Gate_WheelEngineAudioReference.B_2x2_Cannon.B_2x2_Thruster.B_Bush.B_Button_Pressed.B_Button_Square_Pressed.B_Gyroscope.B_Joint_RigidBearing.B_Joint_RigidBearing_Micro.B_Joint_Socket.B_Joint_Wheel_Micro_Suspension.B_Joint_Wheel_Suspension.B_Lotus_1x1.B_Lotus_2x2.B_Rat.B_Rose.B_Spawn_Point_Prefab.B_Switch_Flipped.B_Tulip".split("."), $i = /* @__PURE__ */ "PB_DefaultBrick.PB_DefaultStudded.PB_DefaultRampInnerCornerInverted.PB_DefaultRampCrestEnd.PB_DefaultRampCrestCorner.PB_DefaultRampCrest.PB_DefaultRamp.PB_PicketFence.BP_LatticeThin.PB_DefaultWedge.PB_DefaultTile.PB_DefaultSmoothTile.PB_DefaultSideWedge.PB_DefaultRampInverted.PB_DefaultRampInnerCorner.PB_DefaultRampCornerInverted.PB_DefaultRampCorner.PB_DefaultPole.PB_DefaultMicroWedgeTriangleCorner.PB_DefaultMicroWedgeOuterCorner.PB_DefaultMicroWedgeInnerCorner.PB_DefaultMicroWedgeHalfOuterCorner.PB_DefaultMicroWedgeHalfInnerCornerInverted.PB_DefaultMicroWedgeHalfInnerCorner.PB_DefaultMicroWedgeCorner.PB_DefaultMicroWedge.PB_DefaultMicroRamp.PB_DefaultMicroBrick.PB_DefaultArch.BP_SquarePlate.BP_SpikePlate.PB_Spike.PB_SliderJoint.PB_ServoSliderJoint.PB_MotorSliderJoint.BP_RoundPlate.PB_RoundedCap.PB_Baguette.BP_ZoneProjector.PB_AerodynamicSurface.PB_AerodynamicSurfaceVertical.PB_DefaultArchInverted.PB_DefaultMicroRoundCorner.PB_DefaultMicroRoundHalf.PB_DefaultSideWedgeTile.PB_Frog.PB_Rat.PB_RigidSliderJoint".split("."), ea = {
	BP_LatticeThin: "BP_LatticeThin",
	BP_RoundPlate: "BP_RoundPlate",
	BP_SpikePlate: "BP_SpikePlate",
	BP_SquarePlate: "BP_SquarePlate",
	BP_ZoneProjector: "BP_ZoneProjector",
	B_1x1F_Octo: "B_1x1F_Octo",
	B_1x1F_Round: "B_1x1F_Round",
	B_1x1F_Speaker: "B_1x1F_Speaker",
	B_1x1_Brick_Side: "B_1x1_Brick_Side",
	B_1x1_Brick_Side_Lip: "B_1x1_Brick_Side_Lip",
	B_1x1_CharacterGate_SetGravityDirection: "B_1x1_CharacterGate_SetGravityDirection",
	B_1x1_Coin: "B_1x1_Coin",
	B_1x1_Coin_Diagonal: "B_1x1_Coin_Diagonal",
	B_1x1_Cone: "B_1x1_Cone",
	B_1x1_EntityGate_AddLocationAndRotation: "B_1x1_EntityGate_AddLocationAndRotation",
	B_1x1_EntityGate_AddVelocity: "B_1x1_EntityGate_AddVelocity",
	B_1x1_EntityGate_PlayAudioAt: "B_1x1_EntityGate_PlayAudioAt",
	B_1x1_EntityGate_ReadBrickGrid: "B_1x1_EntityGate_ReadBrickGrid",
	B_1x1_EntityGate_SetLocation: "B_1x1_EntityGate_SetLocation",
	B_1x1_EntityGate_SetLocationAndRotation: "B_1x1_EntityGate_SetLocationAndRotation",
	B_1x1_EntityGate_SetVelocity: "B_1x1_EntityGate_SetVelocity",
	B_1x1_Gate_AND: "B_1x1_Gate_AND",
	B_1x1_Gate_AND_Bitwise: "B_1x1_Gate_AND_Bitwise",
	B_1x1_Gate_Add: "B_1x1_Gate_Add",
	B_1x1_Gate_AudioReference: "B_1x1_Gate_AudioReference",
	B_1x1_Gate_Blend: "B_1x1_Gate_Blend",
	B_1x1_Gate_BrickAssetReference: "B_1x1_Gate_BrickAssetReference",
	B_1x1_Gate_Ceiling: "B_1x1_Gate_Ceiling",
	B_1x1_Gate_Clock: "B_1x1_Gate_Clock",
	B_1x1_Gate_Constant: "B_1x1_Gate_Constant",
	B_1x1_Gate_DeltaTime: "B_1x1_Gate_DeltaTime",
	B_1x1_Gate_Divide: "B_1x1_Gate_Divide",
	B_1x1_Gate_EdgeDetector: "B_1x1_Gate_EdgeDetector",
	B_1x1_Gate_EntityTypeReference: "B_1x1_Gate_EntityTypeReference",
	B_1x1_Gate_Equal: "B_1x1_Gate_Equal",
	B_1x1_Gate_Exec_ArrayVar_Append: "B_1x1_Gate_Exec_ArrayVar_Append",
	B_1x1_Gate_Exec_ArrayVar_Average: "B_1x1_Gate_Exec_ArrayVar_Average",
	B_1x1_Gate_Exec_ArrayVar_Clear: "B_1x1_Gate_Exec_ArrayVar_Clear",
	B_1x1_Gate_Exec_ArrayVar_CopyFrom: "B_1x1_Gate_Exec_ArrayVar_CopyFrom",
	B_1x1_Gate_Exec_ArrayVar_Fill: "B_1x1_Gate_Exec_ArrayVar_Fill",
	B_1x1_Gate_Exec_ArrayVar_Find: "B_1x1_Gate_Exec_ArrayVar_Find",
	B_1x1_Gate_Exec_ArrayVar_Get: "B_1x1_Gate_Exec_ArrayVar_Get",
	B_1x1_Gate_Exec_ArrayVar_GetLength: "B_1x1_Gate_Exec_ArrayVar_GetLength",
	B_1x1_Gate_Exec_ArrayVar_Insert: "B_1x1_Gate_Exec_ArrayVar_Insert",
	B_1x1_Gate_Exec_ArrayVar_Max: "B_1x1_Gate_Exec_ArrayVar_Max",
	B_1x1_Gate_Exec_ArrayVar_Min: "B_1x1_Gate_Exec_ArrayVar_Min",
	B_1x1_Gate_Exec_ArrayVar_Pop: "B_1x1_Gate_Exec_ArrayVar_Pop",
	B_1x1_Gate_Exec_ArrayVar_Push: "B_1x1_Gate_Exec_ArrayVar_Push",
	B_1x1_Gate_Exec_ArrayVar_RemoveAtIndex: "B_1x1_Gate_Exec_ArrayVar_RemoveAtIndex",
	B_1x1_Gate_Exec_ArrayVar_Resize: "B_1x1_Gate_Exec_ArrayVar_Resize",
	B_1x1_Gate_Exec_ArrayVar_Reverse: "B_1x1_Gate_Exec_ArrayVar_Reverse",
	B_1x1_Gate_Exec_ArrayVar_SetAtIndex: "B_1x1_Gate_Exec_ArrayVar_SetAtIndex",
	B_1x1_Gate_Exec_ArrayVar_Shuffle: "B_1x1_Gate_Exec_ArrayVar_Shuffle",
	B_1x1_Gate_Exec_ArrayVar_Slice: "B_1x1_Gate_Exec_ArrayVar_Slice",
	B_1x1_Gate_Exec_ArrayVar_Sort: "B_1x1_Gate_Exec_ArrayVar_Sort",
	B_1x1_Gate_Exec_ArrayVar_SortMultiple: "B_1x1_Gate_Exec_ArrayVar_SortMultiple",
	B_1x1_Gate_Exec_ArrayVar_Sum: "B_1x1_Gate_Exec_ArrayVar_Sum",
	B_1x1_Gate_Exec_ArrayVar_Swap: "B_1x1_Gate_Exec_ArrayVar_Swap",
	B_1x1_Gate_Exec_Branch: "B_1x1_Gate_Exec_Branch",
	B_1x1_Gate_Exec_Character_AddInventoryBrick: "B_1x1_Gate_Exec_Character_AddInventoryBrick",
	B_1x1_Gate_Exec_Character_AddInventoryEntity: "B_1x1_Gate_Exec_Character_AddInventoryEntity",
	B_1x1_Gate_Exec_Character_AddInventoryEntry: "B_1x1_Gate_Exec_Character_AddInventoryEntry",
	B_1x1_Gate_Exec_Character_AddInventoryItem: "B_1x1_Gate_Exec_Character_AddInventoryItem",
	B_1x1_Gate_Exec_Character_AddInventoryItemAdv: "B_1x1_Gate_Exec_Character_AddInventoryItemAdv",
	B_1x1_Gate_Exec_Character_GetAim: "B_1x1_Gate_Exec_Character_GetAim",
	B_1x1_Gate_Exec_Character_GetAmmo: "B_1x1_Gate_Exec_Character_GetAmmo",
	B_1x1_Gate_Exec_Character_GetCurrentInventorySlot: "B_1x1_Gate_Exec_Character_GetCurrentInventorySlot",
	B_1x1_Gate_Exec_Character_GetDamage: "B_1x1_Gate_Exec_Character_GetDamage",
	B_1x1_Gate_Exec_Character_GetFromController: "B_1x1_Gate_Exec_Character_GetFromController",
	B_1x1_Gate_Exec_Character_GetInventoryEntry: "B_1x1_Gate_Exec_Character_GetInventoryEntry",
	B_1x1_Gate_Exec_Character_GetWeaponChamberAmmo: "B_1x1_Gate_Exec_Character_GetWeaponChamberAmmo",
	B_1x1_Gate_Exec_Character_GrantAmmo: "B_1x1_Gate_Exec_Character_GrantAmmo",
	B_1x1_Gate_Exec_Character_IncDamage: "B_1x1_Gate_Exec_Character_IncDamage",
	B_1x1_Gate_Exec_Character_IncWeaponChamberAmmo: "B_1x1_Gate_Exec_Character_IncWeaponChamberAmmo",
	B_1x1_Gate_Exec_Character_SetAmmo: "B_1x1_Gate_Exec_Character_SetAmmo",
	B_1x1_Gate_Exec_Character_SetDamage: "B_1x1_Gate_Exec_Character_SetDamage",
	B_1x1_Gate_Exec_Character_SetInventoryBrick: "B_1x1_Gate_Exec_Character_SetInventoryBrick",
	B_1x1_Gate_Exec_Character_SetInventoryEntity: "B_1x1_Gate_Exec_Character_SetInventoryEntity",
	B_1x1_Gate_Exec_Character_SetInventoryEntry: "B_1x1_Gate_Exec_Character_SetInventoryEntry",
	B_1x1_Gate_Exec_Character_SetInventoryItem: "B_1x1_Gate_Exec_Character_SetInventoryItem",
	B_1x1_Gate_Exec_Character_SetInventoryItemAdv: "B_1x1_Gate_Exec_Character_SetInventoryItemAdv",
	B_1x1_Gate_Exec_Character_SetTempPermission: "B_1x1_Gate_Exec_Character_SetTempPermission",
	B_1x1_Gate_Exec_Character_SetWeaponChamberAmmo: "B_1x1_Gate_Exec_Character_SetWeaponChamberAmmo",
	B_1x1_Gate_Exec_Character_ShowHint: "B_1x1_Gate_Exec_Character_ShowHint",
	B_1x1_Gate_Exec_ChatCommand: "B_1x1_Gate_Exec_ChatCommand",
	B_1x1_Gate_Exec_Cycle: "B_1x1_Gate_Exec_Cycle",
	B_1x1_Gate_Exec_Entity_AddLocationRotation: "B_1x1_Gate_Exec_Entity_AddLocationRotation",
	B_1x1_Gate_Exec_Entity_AddVelocity: "B_1x1_Gate_Exec_Entity_AddVelocity",
	B_1x1_Gate_Exec_Entity_DestroySpawned: "B_1x1_Gate_Exec_Entity_DestroySpawned",
	B_1x1_Gate_Exec_Entity_DestroySpawnedPrefab: "B_1x1_Gate_Exec_Entity_DestroySpawnedPrefab",
	B_1x1_Gate_Exec_Entity_GetAngularVelocity: "B_1x1_Gate_Exec_Entity_GetAngularVelocity",
	B_1x1_Gate_Exec_Entity_GetLinearVelocity: "B_1x1_Gate_Exec_Entity_GetLinearVelocity",
	B_1x1_Gate_Exec_Entity_GetLocation: "B_1x1_Gate_Exec_Entity_GetLocation",
	B_1x1_Gate_Exec_Entity_GetLocationRotation: "B_1x1_Gate_Exec_Entity_GetLocationRotation",
	B_1x1_Gate_Exec_Entity_GetRotation: "B_1x1_Gate_Exec_Entity_GetRotation",
	B_1x1_Gate_Exec_Entity_GetSpeed: "B_1x1_Gate_Exec_Entity_GetSpeed",
	B_1x1_Gate_Exec_Entity_GetTag: "B_1x1_Gate_Exec_Entity_GetTag",
	B_1x1_Gate_Exec_Entity_GetTeam: "B_1x1_Gate_Exec_Entity_GetTeam",
	B_1x1_Gate_Exec_Entity_GetVelocity: "B_1x1_Gate_Exec_Entity_GetVelocity",
	B_1x1_Gate_Exec_Entity_GetVelocityAtPoint: "B_1x1_Gate_Exec_Entity_GetVelocityAtPoint",
	B_1x1_Gate_Exec_Entity_IsFrozen: "B_1x1_Gate_Exec_Entity_IsFrozen",
	B_1x1_Gate_Exec_Entity_PlayAudioAt: "B_1x1_Gate_Exec_Entity_PlayAudioAt",
	B_1x1_Gate_Exec_Entity_RelativeTeleport: "B_1x1_Gate_Exec_Entity_RelativeTeleport",
	B_1x1_Gate_Exec_Entity_SetAngularVelocity: "B_1x1_Gate_Exec_Entity_SetAngularVelocity",
	B_1x1_Gate_Exec_Entity_SetFrozen: "B_1x1_Gate_Exec_Entity_SetFrozen",
	B_1x1_Gate_Exec_Entity_SetGravityDirection: "B_1x1_Gate_Exec_Entity_SetGravityDirection",
	B_1x1_Gate_Exec_Entity_SetLinearVelocity: "B_1x1_Gate_Exec_Entity_SetLinearVelocity",
	B_1x1_Gate_Exec_Entity_SetLocation: "B_1x1_Gate_Exec_Entity_SetLocation",
	B_1x1_Gate_Exec_Entity_SetLocationRotation: "B_1x1_Gate_Exec_Entity_SetLocationRotation",
	B_1x1_Gate_Exec_Entity_SetRotation: "B_1x1_Gate_Exec_Entity_SetRotation",
	B_1x1_Gate_Exec_Entity_SetTag: "B_1x1_Gate_Exec_Entity_SetTag",
	B_1x1_Gate_Exec_Entity_SetTeam: "B_1x1_Gate_Exec_Entity_SetTeam",
	B_1x1_Gate_Exec_Entity_SetVelocity: "B_1x1_Gate_Exec_Entity_SetVelocity",
	B_1x1_Gate_Exec_Entity_Teleport: "B_1x1_Gate_Exec_Entity_Teleport",
	B_1x1_Gate_Exec_Gamemode_BroadcastChatMessage: "B_1x1_Gate_Exec_Gamemode_BroadcastChatMessage",
	B_1x1_Gate_Exec_Gamemode_BroadcastStatusMessage: "B_1x1_Gate_Exec_Gamemode_BroadcastStatusMessage",
	B_1x1_Gate_Exec_Gamemode_FillArrayFromPlayers: "B_1x1_Gate_Exec_Gamemode_FillArrayFromPlayers",
	B_1x1_Gate_Exec_Gamemode_FillArrayFromTeamMembers: "B_1x1_Gate_Exec_Gamemode_FillArrayFromTeamMembers",
	B_1x1_Gate_Exec_Gamemode_GetCurrentRound: "B_1x1_Gate_Exec_Gamemode_GetCurrentRound",
	B_1x1_Gate_Exec_Gamemode_GetLeaderboardValue: "B_1x1_Gate_Exec_Gamemode_GetLeaderboardValue",
	B_1x1_Gate_Exec_Gamemode_GetTeam: "B_1x1_Gate_Exec_Gamemode_GetTeam",
	B_1x1_Gate_Exec_Gamemode_GetTeamByName: "B_1x1_Gate_Exec_Gamemode_GetTeamByName",
	B_1x1_Gate_Exec_Gamemode_GetTeamLeaderboardValue: "B_1x1_Gate_Exec_Gamemode_GetTeamLeaderboardValue",
	B_1x1_Gate_Exec_Gamemode_GetTeamName: "B_1x1_Gate_Exec_Gamemode_GetTeamName",
	B_1x1_Gate_Exec_Gamemode_IncrementLeaderboardValue: "B_1x1_Gate_Exec_Gamemode_IncrementLeaderboardValue",
	B_1x1_Gate_Exec_Gamemode_IncrementTeamLeaderboardValue: "B_1x1_Gate_Exec_Gamemode_IncrementTeamLeaderboardValue",
	B_1x1_Gate_Exec_Gamemode_PlayerWins: "B_1x1_Gate_Exec_Gamemode_PlayerWins",
	B_1x1_Gate_Exec_Gamemode_SetLeaderboardValue: "B_1x1_Gate_Exec_Gamemode_SetLeaderboardValue",
	B_1x1_Gate_Exec_Gamemode_SetTeam: "B_1x1_Gate_Exec_Gamemode_SetTeam",
	B_1x1_Gate_Exec_Gamemode_SetTeamLeaderboardValue: "B_1x1_Gate_Exec_Gamemode_SetTeamLeaderboardValue",
	B_1x1_Gate_Exec_Gamemode_SetTeamPinned: "B_1x1_Gate_Exec_Gamemode_SetTeamPinned",
	B_1x1_Gate_Exec_Gamemode_TeamWins: "B_1x1_Gate_Exec_Gamemode_TeamWins",
	B_1x1_Gate_Exec_GetInputs: "B_1x1_Gate_Exec_GetInputs",
	B_1x1_Gate_Exec_GetOwnTransform: "B_1x1_Gate_Exec_GetOwnTransform",
	B_1x1_Gate_Exec_MapVar_Clear: "B_1x1_Gate_Exec_MapVar_Clear",
	B_1x1_Gate_Exec_MapVar_CopyFrom: "B_1x1_Gate_Exec_MapVar_CopyFrom",
	B_1x1_Gate_Exec_MapVar_Get: "B_1x1_Gate_Exec_MapVar_Get",
	B_1x1_Gate_Exec_MapVar_GetKeys: "B_1x1_Gate_Exec_MapVar_GetKeys",
	B_1x1_Gate_Exec_MapVar_GetLength: "B_1x1_Gate_Exec_MapVar_GetLength",
	B_1x1_Gate_Exec_MapVar_GetValues: "B_1x1_Gate_Exec_MapVar_GetValues",
	B_1x1_Gate_Exec_MapVar_Has: "B_1x1_Gate_Exec_MapVar_Has",
	B_1x1_Gate_Exec_MapVar_Remove: "B_1x1_Gate_Exec_MapVar_Remove",
	B_1x1_Gate_Exec_MapVar_Set: "B_1x1_Gate_Exec_MapVar_Set",
	B_1x1_Gate_Exec_PlayClientAudio: "B_1x1_Gate_Exec_PlayClientAudio",
	B_1x1_Gate_Exec_PlayGlobalAudio: "B_1x1_Gate_Exec_PlayGlobalAudio",
	B_1x1_Gate_Exec_PlayerState_DisplayText: "B_1x1_Gate_Exec_PlayerState_DisplayText",
	B_1x1_Gate_Exec_PlayerState_ForceRespawn: "B_1x1_Gate_Exec_PlayerState_ForceRespawn",
	B_1x1_Gate_Exec_PlayerState_GetDisplayName: "B_1x1_Gate_Exec_PlayerState_GetDisplayName",
	B_1x1_Gate_Exec_PlayerState_GetFromEntity: "B_1x1_Gate_Exec_PlayerState_GetFromEntity",
	B_1x1_Gate_Exec_PlayerState_GetUserId: "B_1x1_Gate_Exec_PlayerState_GetUserId",
	B_1x1_Gate_Exec_PlayerState_GetUserName: "B_1x1_Gate_Exec_PlayerState_GetUserName",
	B_1x1_Gate_Exec_PlayerState_HasPermission: "B_1x1_Gate_Exec_PlayerState_HasPermission",
	B_1x1_Gate_Exec_PlayerState_HasRole: "B_1x1_Gate_Exec_PlayerState_HasRole",
	B_1x1_Gate_Exec_PlayerState_IsTrustedByBrickOwner: "B_1x1_Gate_Exec_PlayerState_IsTrustedByBrickOwner",
	B_1x1_Gate_Exec_PlayerState_SetCanRespawn: "B_1x1_Gate_Exec_PlayerState_SetCanRespawn",
	B_1x1_Gate_Exec_PlayerState_ShowChatMessage: "B_1x1_Gate_Exec_PlayerState_ShowChatMessage",
	B_1x1_Gate_Exec_PlayerState_ShowMessageBox: "B_1x1_Gate_Exec_PlayerState_ShowMessageBox",
	B_1x1_Gate_Exec_PlayerState_ShowStatusMessage: "B_1x1_Gate_Exec_PlayerState_ShowStatusMessage",
	B_1x1_Gate_Exec_PrefabSpawner: "B_1x1_Gate_Exec_PrefabSpawner",
	B_1x1_Gate_Exec_PrintToConsole: "B_1x1_Gate_Exec_PrintToConsole",
	B_1x1_Gate_Exec_Random: "B_1x1_Gate_Exec_Random",
	B_1x1_Gate_Exec_SpawnExplosion: "B_1x1_Gate_Exec_SpawnExplosion",
	B_1x1_Gate_Exec_SpawnExplosionAt: "B_1x1_Gate_Exec_SpawnExplosionAt",
	B_1x1_Gate_Exec_Sweep: "B_1x1_Gate_Exec_Sweep",
	B_1x1_Gate_Exec_SweepSimple: "B_1x1_Gate_Exec_SweepSimple",
	B_1x1_Gate_Exec_Toggle: "B_1x1_Gate_Exec_Toggle",
	B_1x1_Gate_Exec_Union: "B_1x1_Gate_Exec_Union",
	B_1x1_Gate_Exec_Var_Get: "B_1x1_Gate_Exec_Var_Get",
	B_1x1_Gate_Exec_Var_Increment: "B_1x1_Gate_Exec_Var_Increment",
	B_1x1_Gate_Exec_Var_Set: "B_1x1_Gate_Exec_Var_Set",
	B_1x1_Gate_Exec_Zone_GetEntities: "B_1x1_Gate_Exec_Zone_GetEntities",
	B_1x1_Gate_Exec_Zone_GetPlayers: "B_1x1_Gate_Exec_Zone_GetPlayers",
	B_1x1_Gate_Expr_BitwiseAND: "B_1x1_Gate_Expr_BitwiseAND",
	B_1x1_Gate_Expr_BitwiseBitCount: "B_1x1_Gate_Expr_BitwiseBitCount",
	B_1x1_Gate_Expr_BitwiseNAND: "B_1x1_Gate_Expr_BitwiseNAND",
	B_1x1_Gate_Expr_BitwiseNOR: "B_1x1_Gate_Expr_BitwiseNOR",
	B_1x1_Gate_Expr_BitwiseNOT: "B_1x1_Gate_Expr_BitwiseNOT",
	B_1x1_Gate_Expr_BitwiseOR: "B_1x1_Gate_Expr_BitwiseOR",
	B_1x1_Gate_Expr_BitwiseShiftLeft: "B_1x1_Gate_Expr_BitwiseShiftLeft",
	B_1x1_Gate_Expr_BitwiseShiftRight: "B_1x1_Gate_Expr_BitwiseShiftRight",
	B_1x1_Gate_Expr_BitwiseShiftRightLogical: "B_1x1_Gate_Expr_BitwiseShiftRightLogical",
	B_1x1_Gate_Expr_BitwiseXOR: "B_1x1_Gate_Expr_BitwiseXOR",
	B_1x1_Gate_Expr_Ceil: "B_1x1_Gate_Expr_Ceil",
	B_1x1_Gate_Expr_ChangeDetector: "B_1x1_Gate_Expr_ChangeDetector",
	B_1x1_Gate_Expr_ChangeDetectorExec: "B_1x1_Gate_Expr_ChangeDetectorExec",
	B_1x1_Gate_Expr_ColorBlend: "B_1x1_Gate_Expr_ColorBlend",
	B_1x1_Gate_Expr_ColorConvert: "B_1x1_Gate_Expr_ColorConvert",
	B_1x1_Gate_Expr_ColorToHex: "B_1x1_Gate_Expr_ColorToHex",
	B_1x1_Gate_Expr_CompareEqual: "B_1x1_Gate_Expr_CompareEqual",
	B_1x1_Gate_Expr_CompareGreater: "B_1x1_Gate_Expr_CompareGreater",
	B_1x1_Gate_Expr_CompareGreaterOrEqual: "B_1x1_Gate_Expr_CompareGreaterOrEqual",
	B_1x1_Gate_Expr_CompareLess: "B_1x1_Gate_Expr_CompareLess",
	B_1x1_Gate_Expr_CompareLessOrEqual: "B_1x1_Gate_Expr_CompareLessOrEqual",
	B_1x1_Gate_Expr_CompareNotEqual: "B_1x1_Gate_Expr_CompareNotEqual",
	B_1x1_Gate_Expr_Convert: "B_1x1_Gate_Expr_Convert",
	B_1x1_Gate_Expr_DirectionToRotation: "B_1x1_Gate_Expr_DirectionToRotation",
	B_1x1_Gate_Expr_EdgeDetector: "B_1x1_Gate_Expr_EdgeDetector",
	B_1x1_Gate_Expr_EdgeDetectorExec: "B_1x1_Gate_Expr_EdgeDetectorExec",
	B_1x1_Gate_Expr_EnumToInteger: "B_1x1_Gate_Expr_EnumToInteger",
	B_1x1_Gate_Expr_Floor: "B_1x1_Gate_Expr_Floor",
	B_1x1_Gate_Expr_Gamemode_IsBuilderTeam: "B_1x1_Gate_Expr_Gamemode_IsBuilderTeam",
	B_1x1_Gate_Expr_Gamemode_IsUnaffiliatedTeam: "B_1x1_Gate_Expr_Gamemode_IsUnaffiliatedTeam",
	B_1x1_Gate_Expr_IntegerToEnum: "B_1x1_Gate_Expr_IntegerToEnum",
	B_1x1_Gate_Expr_InvertRotation: "B_1x1_Gate_Expr_InvertRotation",
	B_1x1_Gate_Expr_ItemToPickup: "B_1x1_Gate_Expr_ItemToPickup",
	B_1x1_Gate_Expr_LogicalAND: "B_1x1_Gate_Expr_LogicalAND",
	B_1x1_Gate_Expr_LogicalNAND: "B_1x1_Gate_Expr_LogicalNAND",
	B_1x1_Gate_Expr_LogicalNOR: "B_1x1_Gate_Expr_LogicalNOR",
	B_1x1_Gate_Expr_LogicalNOT: "B_1x1_Gate_Expr_LogicalNOT",
	B_1x1_Gate_Expr_LogicalOR: "B_1x1_Gate_Expr_LogicalOR",
	B_1x1_Gate_Expr_LogicalXOR: "B_1x1_Gate_Expr_LogicalXOR",
	B_1x1_Gate_Expr_MakeColor: "B_1x1_Gate_Expr_MakeColor",
	B_1x1_Gate_Expr_MakeColorHex: "B_1x1_Gate_Expr_MakeColorHex",
	B_1x1_Gate_Expr_MakeColorSRGB: "B_1x1_Gate_Expr_MakeColorSRGB",
	B_1x1_Gate_Expr_MakeQuaternion: "B_1x1_Gate_Expr_MakeQuaternion",
	B_1x1_Gate_Expr_MakeRotation: "B_1x1_Gate_Expr_MakeRotation",
	B_1x1_Gate_Expr_MakeVector: "B_1x1_Gate_Expr_MakeVector",
	B_1x1_Gate_Expr_MathAbs: "B_1x1_Gate_Expr_MathAbs",
	B_1x1_Gate_Expr_MathAcos: "B_1x1_Gate_Expr_MathAcos",
	B_1x1_Gate_Expr_MathAcosh: "B_1x1_Gate_Expr_MathAcosh",
	B_1x1_Gate_Expr_MathAdd: "B_1x1_Gate_Expr_MathAdd",
	B_1x1_Gate_Expr_MathAsin: "B_1x1_Gate_Expr_MathAsin",
	B_1x1_Gate_Expr_MathAsinh: "B_1x1_Gate_Expr_MathAsinh",
	B_1x1_Gate_Expr_MathAtan: "B_1x1_Gate_Expr_MathAtan",
	B_1x1_Gate_Expr_MathAtan2: "B_1x1_Gate_Expr_MathAtan2",
	B_1x1_Gate_Expr_MathAtanh: "B_1x1_Gate_Expr_MathAtanh",
	B_1x1_Gate_Expr_MathBlend: "B_1x1_Gate_Expr_MathBlend",
	B_1x1_Gate_Expr_MathClamp: "B_1x1_Gate_Expr_MathClamp",
	B_1x1_Gate_Expr_MathCos: "B_1x1_Gate_Expr_MathCos",
	B_1x1_Gate_Expr_MathCosh: "B_1x1_Gate_Expr_MathCosh",
	B_1x1_Gate_Expr_MathDegreesToRadians: "B_1x1_Gate_Expr_MathDegreesToRadians",
	B_1x1_Gate_Expr_MathDivide: "B_1x1_Gate_Expr_MathDivide",
	B_1x1_Gate_Expr_MathEasing: "B_1x1_Gate_Expr_MathEasing",
	B_1x1_Gate_Expr_MathExp: "B_1x1_Gate_Expr_MathExp",
	B_1x1_Gate_Expr_MathLn: "B_1x1_Gate_Expr_MathLn",
	B_1x1_Gate_Expr_MathLogBase: "B_1x1_Gate_Expr_MathLogBase",
	B_1x1_Gate_Expr_MathMax: "B_1x1_Gate_Expr_MathMax",
	B_1x1_Gate_Expr_MathMin: "B_1x1_Gate_Expr_MathMin",
	B_1x1_Gate_Expr_MathModulo: "B_1x1_Gate_Expr_MathModulo",
	B_1x1_Gate_Expr_MathModuloFloored: "B_1x1_Gate_Expr_MathModuloFloored",
	B_1x1_Gate_Expr_MathMultiply: "B_1x1_Gate_Expr_MathMultiply",
	B_1x1_Gate_Expr_MathNegate: "B_1x1_Gate_Expr_MathNegate",
	B_1x1_Gate_Expr_MathPow: "B_1x1_Gate_Expr_MathPow",
	B_1x1_Gate_Expr_MathRadiansToDegrees: "B_1x1_Gate_Expr_MathRadiansToDegrees",
	B_1x1_Gate_Expr_MathSign: "B_1x1_Gate_Expr_MathSign",
	B_1x1_Gate_Expr_MathSin: "B_1x1_Gate_Expr_MathSin",
	B_1x1_Gate_Expr_MathSinh: "B_1x1_Gate_Expr_MathSinh",
	B_1x1_Gate_Expr_MathSqrt: "B_1x1_Gate_Expr_MathSqrt",
	B_1x1_Gate_Expr_MathSubtract: "B_1x1_Gate_Expr_MathSubtract",
	B_1x1_Gate_Expr_MathTan: "B_1x1_Gate_Expr_MathTan",
	B_1x1_Gate_Expr_MathTanh: "B_1x1_Gate_Expr_MathTanh",
	B_1x1_Gate_Expr_NearlyEqual: "B_1x1_Gate_Expr_NearlyEqual",
	B_1x1_Gate_Expr_QuatAngleBetween: "B_1x1_Gate_Expr_QuatAngleBetween",
	B_1x1_Gate_Expr_QuatBetween: "B_1x1_Gate_Expr_QuatBetween",
	B_1x1_Gate_Expr_QuatDotProduct: "B_1x1_Gate_Expr_QuatDotProduct",
	B_1x1_Gate_Expr_QuatFromAxisAngle: "B_1x1_Gate_Expr_QuatFromAxisAngle",
	B_1x1_Gate_Expr_QuatSlerp: "B_1x1_Gate_Expr_QuatSlerp",
	B_1x1_Gate_Expr_QuatToAxisAngle: "B_1x1_Gate_Expr_QuatToAxisAngle",
	B_1x1_Gate_Expr_Remap: "B_1x1_Gate_Expr_Remap",
	B_1x1_Gate_Expr_RotateVector: "B_1x1_Gate_Expr_RotateVector",
	B_1x1_Gate_Expr_RotationToDirection: "B_1x1_Gate_Expr_RotationToDirection",
	B_1x1_Gate_Expr_Round: "B_1x1_Gate_Expr_Round",
	B_1x1_Gate_Expr_Select: "B_1x1_Gate_Expr_Select",
	B_1x1_Gate_Expr_SplitColor: "B_1x1_Gate_Expr_SplitColor",
	B_1x1_Gate_Expr_SplitColorSRGB: "B_1x1_Gate_Expr_SplitColorSRGB",
	B_1x1_Gate_Expr_SplitQuaternion: "B_1x1_Gate_Expr_SplitQuaternion",
	B_1x1_Gate_Expr_SplitRotation: "B_1x1_Gate_Expr_SplitRotation",
	B_1x1_Gate_Expr_SplitVector: "B_1x1_Gate_Expr_SplitVector",
	B_1x1_Gate_Expr_String_CharacterToCodepoint: "B_1x1_Gate_Expr_String_CharacterToCodepoint",
	B_1x1_Gate_Expr_String_CodepointToCharacter: "B_1x1_Gate_Expr_String_CodepointToCharacter",
	B_1x1_Gate_Expr_String_Concatenate: "B_1x1_Gate_Expr_String_Concatenate",
	B_1x1_Gate_Expr_String_Contains: "B_1x1_Gate_Expr_String_Contains",
	B_1x1_Gate_Expr_String_EndsWith: "B_1x1_Gate_Expr_String_EndsWith",
	B_1x1_Gate_Expr_String_Find: "B_1x1_Gate_Expr_String_Find",
	B_1x1_Gate_Expr_String_FormatText: "B_1x1_Gate_Expr_String_FormatText",
	B_1x1_Gate_Expr_String_Length: "B_1x1_Gate_Expr_String_Length",
	B_1x1_Gate_Expr_String_ParseInt: "B_1x1_Gate_Expr_String_ParseInt",
	B_1x1_Gate_Expr_String_ParseNumber: "B_1x1_Gate_Expr_String_ParseNumber",
	B_1x1_Gate_Expr_String_Replace: "B_1x1_Gate_Expr_String_Replace",
	B_1x1_Gate_Expr_String_Split: "B_1x1_Gate_Expr_String_Split",
	B_1x1_Gate_Expr_String_StartsWith: "B_1x1_Gate_Expr_String_StartsWith",
	B_1x1_Gate_Expr_String_Substring: "B_1x1_Gate_Expr_String_Substring",
	B_1x1_Gate_Expr_String_ToLower: "B_1x1_Gate_Expr_String_ToLower",
	B_1x1_Gate_Expr_String_ToUpper: "B_1x1_Gate_Expr_String_ToUpper",
	B_1x1_Gate_Expr_String_Trim: "B_1x1_Gate_Expr_String_Trim",
	B_1x1_Gate_Expr_Swap: "B_1x1_Gate_Expr_Swap",
	B_1x1_Gate_Expr_VecCrossProduct: "B_1x1_Gate_Expr_VecCrossProduct",
	B_1x1_Gate_Expr_VecDistance: "B_1x1_Gate_Expr_VecDistance",
	B_1x1_Gate_Expr_VecDistanceSquared: "B_1x1_Gate_Expr_VecDistanceSquared",
	B_1x1_Gate_Expr_VecDotProduct: "B_1x1_Gate_Expr_VecDotProduct",
	B_1x1_Gate_Expr_VecMagnitude: "B_1x1_Gate_Expr_VecMagnitude",
	B_1x1_Gate_Expr_VecMagnitudeSquared: "B_1x1_Gate_Expr_VecMagnitudeSquared",
	B_1x1_Gate_Expr_VecNormalize: "B_1x1_Gate_Expr_VecNormalize",
	B_1x1_Gate_Expr_VecScale: "B_1x1_Gate_Expr_VecScale",
	B_1x1_Gate_Fake_Gamemode_CharacterDamagedEvent: "B_1x1_Gate_Fake_Gamemode_CharacterDamagedEvent",
	B_1x1_Gate_Fake_Gamemode_CharacterDiedEvent: "B_1x1_Gate_Fake_Gamemode_CharacterDiedEvent",
	B_1x1_Gate_Fake_Gamemode_CharacterFiredWeaponEvent: "B_1x1_Gate_Fake_Gamemode_CharacterFiredWeaponEvent",
	B_1x1_Gate_Fake_Gamemode_CharacterSpawnedEvent: "B_1x1_Gate_Fake_Gamemode_CharacterSpawnedEvent",
	B_1x1_Gate_Fake_Gamemode_ControllerJoinedEvent: "B_1x1_Gate_Fake_Gamemode_ControllerJoinedEvent",
	B_1x1_Gate_Fake_Gamemode_ControllerJoinedTeamEvent: "B_1x1_Gate_Fake_Gamemode_ControllerJoinedTeamEvent",
	B_1x1_Gate_Fake_Gamemode_ControllerLeftEvent: "B_1x1_Gate_Fake_Gamemode_ControllerLeftEvent",
	B_1x1_Gate_Fake_Gamemode_ControllerLeftTeamEvent: "B_1x1_Gate_Fake_Gamemode_ControllerLeftTeamEvent",
	B_1x1_Gate_Fake_Gamemode_RoundEndEvent: "B_1x1_Gate_Fake_Gamemode_RoundEndEvent",
	B_1x1_Gate_Fake_Gamemode_RoundStartEvent: "B_1x1_Gate_Fake_Gamemode_RoundStartEvent",
	B_1x1_Gate_FindPlayer: "B_1x1_Gate_FindPlayer",
	B_1x1_Gate_Floor: "B_1x1_Gate_Floor",
	B_1x1_Gate_FontReference: "B_1x1_Gate_FontReference",
	B_1x1_Gate_FormatDate: "B_1x1_Gate_FormatDate",
	B_1x1_Gate_GetUnixEpoch: "B_1x1_Gate_GetUnixEpoch",
	B_1x1_Gate_GreaterThan: "B_1x1_Gate_GreaterThan",
	B_1x1_Gate_GreaterThanEqual: "B_1x1_Gate_GreaterThanEqual",
	B_1x1_Gate_Internal_CharacterZoneEvent_Entered: "B_1x1_Gate_Internal_CharacterZoneEvent_Entered",
	B_1x1_Gate_Internal_CharacterZoneEvent_Left: "B_1x1_Gate_Internal_CharacterZoneEvent_Left",
	B_1x1_Gate_Internal_EntityZoneEvent_Entered: "B_1x1_Gate_Internal_EntityZoneEvent_Entered",
	B_1x1_Gate_Internal_EntityZoneEvent_Left: "B_1x1_Gate_Internal_EntityZoneEvent_Left",
	B_1x1_Gate_Internal_ProjectileZoneEvent_Entered: "B_1x1_Gate_Internal_ProjectileZoneEvent_Entered",
	B_1x1_Gate_Internal_ProjectileZoneEvent_Left: "B_1x1_Gate_Internal_ProjectileZoneEvent_Left",
	B_1x1_Gate_Internal_ReadBrickGrid: "B_1x1_Gate_Internal_ReadBrickGrid",
	B_1x1_Gate_Internal_ZoneEvent_BrickChanged: "B_1x1_Gate_Internal_ZoneEvent_BrickChanged",
	B_1x1_Gate_Internal_ZoneEvent_BrickRemoved: "B_1x1_Gate_Internal_ZoneEvent_BrickRemoved",
	B_1x1_Gate_ItemReference: "B_1x1_Gate_ItemReference",
	B_1x1_Gate_LessThan: "B_1x1_Gate_LessThan",
	B_1x1_Gate_LessThanEqual: "B_1x1_Gate_LessThanEqual",
	B_1x1_Gate_MicrochipInput: "B_1x1_Gate_MicrochipInput",
	B_1x1_Gate_MicrochipOutput: "B_1x1_Gate_MicrochipOutput",
	B_1x1_Gate_Mod: "B_1x1_Gate_Mod",
	B_1x1_Gate_ModFloored: "B_1x1_Gate_ModFloored",
	B_1x1_Gate_Multiply: "B_1x1_Gate_Multiply",
	B_1x1_Gate_NAND: "B_1x1_Gate_NAND",
	B_1x1_Gate_NAND_Bitwise: "B_1x1_Gate_NAND_Bitwise",
	B_1x1_Gate_NOR: "B_1x1_Gate_NOR",
	B_1x1_Gate_NOR_Bitwise: "B_1x1_Gate_NOR_Bitwise",
	B_1x1_Gate_NOT_Bitwise: "B_1x1_Gate_NOT_Bitwise",
	B_1x1_Gate_NotEqual: "B_1x1_Gate_NotEqual",
	B_1x1_Gate_OR: "B_1x1_Gate_OR",
	B_1x1_Gate_OR_Bitwise: "B_1x1_Gate_OR_Bitwise",
	B_1x1_Gate_OneShotAudioReference: "B_1x1_Gate_OneShotAudioReference",
	B_1x1_Gate_PickupReference: "B_1x1_Gate_PickupReference",
	B_1x1_Gate_ProjectileReference: "B_1x1_Gate_ProjectileReference",
	B_1x1_Gate_Pseudo_BufferSeconds: "B_1x1_Gate_Pseudo_BufferSeconds",
	B_1x1_Gate_Pseudo_BufferTicks: "B_1x1_Gate_Pseudo_BufferTicks",
	B_1x1_Gate_Pseudo_CustomEvent: "B_1x1_Gate_Pseudo_CustomEvent",
	B_1x1_Gate_Pseudo_CustomEvent_Global: "B_1x1_Gate_Pseudo_CustomEvent_Global",
	B_1x1_Gate_Pseudo_Dampen: "B_1x1_Gate_Pseudo_Dampen",
	B_1x1_Gate_Pseudo_QueueSeconds: "B_1x1_Gate_Pseudo_QueueSeconds",
	B_1x1_Gate_Pseudo_QueueTicks: "B_1x1_Gate_Pseudo_QueueTicks",
	B_1x1_Gate_Pseudo_SendCustomEvent: "B_1x1_Gate_Pseudo_SendCustomEvent",
	B_1x1_Gate_Pseudo_SendCustomEvent_Global: "B_1x1_Gate_Pseudo_SendCustomEvent_Global",
	B_1x1_Gate_Pseudo_Timer: "B_1x1_Gate_Pseudo_Timer",
	B_1x1_Gate_Pseudo_Tween: "B_1x1_Gate_Pseudo_Tween",
	B_1x1_Gate_RelativeTeleport: "B_1x1_Gate_RelativeTeleport",
	B_1x1_Gate_SeatControlSplitter: "B_1x1_Gate_SeatControlSplitter",
	B_1x1_Gate_ServerUptime: "B_1x1_Gate_ServerUptime",
	B_1x1_Gate_ShiftLeft_Bitwise: "B_1x1_Gate_ShiftLeft_Bitwise",
	B_1x1_Gate_ShiftRight_Bitwise: "B_1x1_Gate_ShiftRight_Bitwise",
	B_1x1_Gate_Subtract: "B_1x1_Gate_Subtract",
	B_1x1_Gate_Teleport: "B_1x1_Gate_Teleport",
	B_1x1_Gate_Timer: "B_1x1_Gate_Timer",
	B_1x1_Gate_Timer_Tick: "B_1x1_Gate_Timer_Tick",
	B_1x1_Gate_Variable: "B_1x1_Gate_Variable",
	B_1x1_Gate_Variable_Array: "B_1x1_Gate_Variable_Array",
	B_1x1_Gate_Variable_Map: "B_1x1_Gate_Variable_Map",
	B_1x1_Gate_WeaponResourceReference: "B_1x1_Gate_WeaponResourceReference",
	B_1x1_Gate_WeightBrick: "B_1x1_Gate_WeightBrick",
	B_1x1_Gate_WheelEngineAudioReference: "B_1x1_Gate_WheelEngineAudioReference",
	B_1x1_Gate_WheelEngineSlim: "B_1x1_Gate_WheelEngineSlim",
	B_1x1_Gate_XOR: "B_1x1_Gate_XOR",
	B_1x1_Gate_XOR_Bitwise: "B_1x1_Gate_XOR_Bitwise",
	B_1x1_Microchip: "B_1x1_Microchip",
	B_1x1_NOT_Gate: "B_1x1_NOT_Gate",
	B_1x1_Reroute_Node: "B_1x1_Reroute_Node",
	B_1x1_Round: "B_1x1_Round",
	B_1x1_SoundEmitter: "B_1x1_SoundEmitter",
	B_1x1f_Inverse_Tile_Corner: "B_1x1f_Inverse_Tile_Corner",
	B_1x1f_Tile_Corner: "B_1x1f_Tile_Corner",
	B_1x2_MetalIngot: "B_1x2_MetalIngot",
	B_1x2_Overhang: "B_1x2_Overhang",
	B_1x2f_Plate_Center: "B_1x2f_Plate_Center",
	B_1x2f_Plate_Center_Inv: "B_1x2f_Plate_Center_Inv",
	B_1x4_Brick_Side: "B_1x4_Brick_Side",
	B_1x_Octo: "B_1x_Octo",
	B_1x_Octo_90Deg: "B_1x_Octo_90Deg",
	B_1x_Octo_90Deg_Inv: "B_1x_Octo_90Deg_Inv",
	B_1x_Octo_T: "B_1x_Octo_T",
	B_1x_Octo_T_Inv: "B_1x_Octo_T_Inv",
	B_2x1_Slipper: "B_2x1_Slipper",
	B_2x2F_Octo: "B_2x2F_Octo",
	B_2x2F_Octo_Converter: "B_2x2F_Octo_Converter",
	B_2x2F_Octo_Converter_Inv: "B_2x2F_Octo_Converter_Inv",
	B_2x2F_Round: "B_2x2F_Round",
	B_2x2F_Speaker: "B_2x2F_Speaker",
	B_2x2F_Target: "B_2x2F_Target",
	B_2x2_Cannon: "B_2x2_Cannon",
	B_2x2_Cone: "B_2x2_Cone",
	B_2x2_Corner: "B_2x2_Corner",
	B_2x2_Overhang: "B_2x2_Overhang",
	B_2x2_Round: "B_2x2_Round",
	B_2x2_Slipper: "B_2x2_Slipper",
	B_2x2_Thruster: "B_2x2_Thruster",
	B_2x2f_Plate_Center: "B_2x2f_Plate_Center",
	B_2x2f_Plate_Center_Inv: "B_2x2f_Plate_Center_Inv",
	B_2x4_Door_Frame: "B_2x4_Door_Frame",
	B_2x_Octo: "B_2x_Octo",
	B_2x_Octo_90Deg: "B_2x_Octo_90Deg",
	B_2x_Octo_90Deg_Inv: "B_2x_Octo_90Deg_Inv",
	B_2x_Octo_Cone: "B_2x_Octo_Cone",
	B_2x_Octo_T: "B_2x_Octo_T",
	B_2x_Octo_T_Inv: "B_2x_Octo_T_Inv",
	B_4x4_Round: "B_4x4_Round",
	B_8x8_Lattice_Plate: "B_8x8_Lattice_Plate",
	B_Bishop: "B_Bishop",
	B_Bone: "B_Bone",
	B_BoneStraight: "B_BoneStraight",
	B_Bot_Spawn_Point: "B_Bot_Spawn_Point",
	B_Branch: "B_Branch",
	B_Bush: "B_Bush",
	B_Button: "B_Button",
	B_Button_Pressed: "B_Button_Pressed",
	B_Button_Square: "B_Button_Square",
	B_Button_Square_Pressed: "B_Button_Square_Pressed",
	B_Cauldron: "B_Cauldron",
	B_Chalice: "B_Chalice",
	B_CheckPoint: "B_CheckPoint",
	B_Coffin: "B_Coffin",
	B_Coffin_Lid: "B_Coffin_Lid",
	B_DestinationPoint: "B_DestinationPoint",
	B_Fern: "B_Fern",
	B_Flame: "B_Flame",
	B_Flower: "B_Flower",
	B_Fork: "B_Fork",
	B_Frog: "B_Frog",
	B_Frog_Small: "B_Frog_Small",
	B_GoalPoint: "B_GoalPoint",
	B_Gravestone: "B_Gravestone",
	B_Gyroscope: "B_Gyroscope",
	B_Handle: "B_Handle",
	B_Hedge_1x1: "B_Hedge_1x1",
	B_Hedge_1x1_Corner: "B_Hedge_1x1_Corner",
	B_Hedge_1x2: "B_Hedge_1x2",
	B_Hedge_1x4: "B_Hedge_1x4",
	B_Inverted_Cone: "B_Inverted_Cone",
	B_Jar: "B_Jar",
	B_Joint_Bearing: "B_Joint_Bearing",
	B_Joint_Bearing_Micro: "B_Joint_Bearing_Micro",
	B_Joint_Coupler: "B_Joint_Coupler",
	B_Joint_Motor: "B_Joint_Motor",
	B_Joint_Motor_Micro: "B_Joint_Motor_Micro",
	B_Joint_RigidBearing: "B_Joint_RigidBearing",
	B_Joint_RigidBearing_Micro: "B_Joint_RigidBearing_Micro",
	B_Joint_Servo: "B_Joint_Servo",
	B_Joint_Servo_Micro: "B_Joint_Servo_Micro",
	B_Joint_Socket: "B_Joint_Socket",
	B_Joint_Socket_Micro: "B_Joint_Socket_Micro",
	B_Joint_Wheel: "B_Joint_Wheel",
	B_Joint_Wheel_Micro: "B_Joint_Wheel_Micro",
	B_Joint_Wheel_Micro_Suspension: "B_Joint_Wheel_Micro_Suspension",
	B_Joint_Wheel_Suspension: "B_Joint_Wheel_Suspension",
	B_King: "B_King",
	B_Knight: "B_Knight",
	B_Ladder: "B_Ladder",
	B_Leaf_Bush: "B_Leaf_Bush",
	B_Lotus_1x1: "B_Lotus_1x1",
	B_Lotus_2x2: "B_Lotus_2x2",
	B_Pawn: "B_Pawn",
	B_Pine_Tree: "B_Pine_Tree",
	B_Pumpkin: "B_Pumpkin",
	B_Pumpkin_Carved: "B_Pumpkin_Carved",
	B_Queen: "B_Queen",
	B_Rat: "B_Rat",
	B_Rook: "B_Rook",
	B_Rose: "B_Rose",
	B_Sausage: "B_Sausage",
	B_Seat: "B_Seat",
	B_Small_Flower: "B_Small_Flower",
	B_SpawnPoint: "B_SpawnPoint",
	B_Spawn_Point_Prefab: "B_Spawn_Point_Prefab",
	B_Spoon: "B_Spoon",
	B_Swirl_Plate: "B_Swirl_Plate",
	B_Switch_Flipped: "B_Switch_Flipped",
	B_Switch_Test: "B_Switch_Test",
	B_Tulip: "B_Tulip",
	B_Turkey_Body: "B_Turkey_Body",
	B_Turkey_Leg: "B_Turkey_Leg",
	B_Vehicle_Engine: "B_Vehicle_Engine",
	PB_AerodynamicSurface: "PB_AerodynamicSurface",
	PB_AerodynamicSurfaceVertical: "PB_AerodynamicSurfaceVertical",
	PB_Baguette: "PB_Baguette",
	PB_DefaultArch: "PB_DefaultArch",
	PB_DefaultArchInverted: "PB_DefaultArchInverted",
	PB_DefaultBrick: "PB_DefaultBrick",
	PB_DefaultMicroBrick: "PB_DefaultMicroBrick",
	PB_DefaultMicroRamp: "PB_DefaultMicroRamp",
	PB_DefaultMicroRoundCorner: "PB_DefaultMicroRoundCorner",
	PB_DefaultMicroRoundHalf: "PB_DefaultMicroRoundHalf",
	PB_DefaultMicroWedge: "PB_DefaultMicroWedge",
	PB_DefaultMicroWedgeCorner: "PB_DefaultMicroWedgeCorner",
	PB_DefaultMicroWedgeHalfInnerCorner: "PB_DefaultMicroWedgeHalfInnerCorner",
	PB_DefaultMicroWedgeHalfInnerCornerInverted: "PB_DefaultMicroWedgeHalfInnerCornerInverted",
	PB_DefaultMicroWedgeHalfOuterCorner: "PB_DefaultMicroWedgeHalfOuterCorner",
	PB_DefaultMicroWedgeInnerCorner: "PB_DefaultMicroWedgeInnerCorner",
	PB_DefaultMicroWedgeOuterCorner: "PB_DefaultMicroWedgeOuterCorner",
	PB_DefaultMicroWedgeTriangleCorner: "PB_DefaultMicroWedgeTriangleCorner",
	PB_DefaultPole: "PB_DefaultPole",
	PB_DefaultRamp: "PB_DefaultRamp",
	PB_DefaultRampCorner: "PB_DefaultRampCorner",
	PB_DefaultRampCornerInverted: "PB_DefaultRampCornerInverted",
	PB_DefaultRampCrest: "PB_DefaultRampCrest",
	PB_DefaultRampCrestCorner: "PB_DefaultRampCrestCorner",
	PB_DefaultRampCrestEnd: "PB_DefaultRampCrestEnd",
	PB_DefaultRampInnerCorner: "PB_DefaultRampInnerCorner",
	PB_DefaultRampInnerCornerInverted: "PB_DefaultRampInnerCornerInverted",
	PB_DefaultRampInverted: "PB_DefaultRampInverted",
	PB_DefaultSideWedge: "PB_DefaultSideWedge",
	PB_DefaultSideWedgeTile: "PB_DefaultSideWedgeTile",
	PB_DefaultSmoothTile: "PB_DefaultSmoothTile",
	PB_DefaultStudded: "PB_DefaultStudded",
	PB_DefaultTile: "PB_DefaultTile",
	PB_DefaultWedge: "PB_DefaultWedge",
	PB_Frog: "PB_Frog",
	PB_MotorSliderJoint: "PB_MotorSliderJoint",
	PB_PicketFence: "PB_PicketFence",
	PB_Rat: "PB_Rat",
	PB_RigidSliderJoint: "PB_RigidSliderJoint",
	PB_RoundedCap: "PB_RoundedCap",
	PB_ServoSliderJoint: "PB_ServoSliderJoint",
	PB_SliderJoint: "PB_SliderJoint",
	PB_Spike: "PB_Spike"
}, ta = new Set(Qi), na = new Set($i);
function ra(e) {
	return na.has(e) ? !0 : ta.has(e) ? !1 : e.startsWith("PB_") || e.startsWith("BP_");
}
//#endregion
//#region src/brdb/componentDb.ts
var ia = /* @__PURE__ */ new Map([
	["BrickComponentType_AerodynamicSurface", "BrickComponentData_AerodynamicSurface_Directional"],
	["BrickComponentType_Clock", "BrickComponentData_Clock"],
	["BrickComponentType_ExplosionSpawner", "BrickComponentData_ExplosionSpawner"],
	["BrickComponentType_Internal_AerodynamicSurface", "BrickComponentData_AerodynamicSurface"],
	["BrickComponentType_Internal_AerodynamicSurfaceVertical", "BrickComponentData_AerodynamicSurface"],
	["BrickComponentType_Internal_CharacterZoneEvent_Entered", "BrickComponentData_Internal_CharacterZoneEvent"],
	["BrickComponentType_Internal_CharacterZoneEvent_Left", "BrickComponentData_Internal_CharacterZoneEvent"],
	["BrickComponentType_Internal_EntityZoneEvent_Entered", "BrickComponentData_Internal_EntityZoneEvent"],
	["BrickComponentType_Internal_EntityZoneEvent_Left", "BrickComponentData_Internal_EntityZoneEvent"],
	["BrickComponentType_Internal_MicrochipInput", "BrickComponentData_Internal_MicrochipInput"],
	["BrickComponentType_Internal_MicrochipOutput", "BrickComponentData_Internal_MicrochipOutput"],
	["BrickComponentType_Internal_ProjectileZoneEvent_Entered", "BrickComponentData_Internal_ProjectileZoneEvent"],
	["BrickComponentType_Internal_ProjectileZoneEvent_Left", "BrickComponentData_Internal_ProjectileZoneEvent"],
	["BrickComponentType_Internal_ReadBrickGrid", "BrickComponentData_Internal_ReadBrickGrid"],
	["BrickComponentType_Internal_TeleportDestination", "BrickComponentData_TeleportDestination"],
	["BrickComponentType_Internal_ZoneEvent_BrickChanged", "BrickComponentData_Internal_ZoneEvent"],
	["BrickComponentType_Internal_ZoneEvent_BrickRemoved", "BrickComponentData_Internal_ZoneEvent"],
	["BrickComponentType_PrefabSpawn", "BrickComponentData_PrefabSpawn"],
	["BrickComponentType_WireGraphPseudo_ArrayVar", "BrickComponentData_WireGraphPseudo_ArrayVar"],
	["BrickComponentType_WireGraphPseudo_BufferSeconds", "BrickComponentData_WireGraphPseudo_BufferSeconds"],
	["BrickComponentType_WireGraphPseudo_BufferTicks", "BrickComponentData_WireGraphPseudo_BufferTicks"],
	["BrickComponentType_WireGraphPseudo_CustomEvent", "BrickComponentData_WireGraphPseudo_CustomEvent"],
	["BrickComponentType_WireGraphPseudo_CustomEvent_Global", "BrickComponentData_WireGraphPseudo_CustomEvent"],
	["BrickComponentType_WireGraphPseudo_Dampen", "BrickComponentData_WireGraphPseudo_Dampen"],
	["BrickComponentType_WireGraphPseudo_MapVar", "BrickComponentData_WireGraphPseudo_MapVar"],
	["BrickComponentType_WireGraphPseudo_QueueSeconds", "BrickComponentData_WireGraphPseudo_QueueSeconds"],
	["BrickComponentType_WireGraphPseudo_QueueTicks", "BrickComponentData_WireGraphPseudo_QueueTicks"],
	["BrickComponentType_WireGraphPseudo_SendCustomEvent", "BrickComponentData_WireGraphPseudo_SendCustomEvent"],
	["BrickComponentType_WireGraphPseudo_SendCustomEvent_Global", "BrickComponentData_WireGraphPseudo_SendCustomEvent"],
	["BrickComponentType_WireGraphPseudo_Timer", "BrickComponentData_WireGraphPseudo_Timer"],
	["BrickComponentType_WireGraphPseudo_Tween", "BrickComponentData_WireGraphPseudo_Tween"],
	["BrickComponentType_WireGraphPseudo_Var", "BrickComponentData_WireGraphPseudo_Var"],
	["BrickComponentType_WireGraph_AudioReference", "BrickComponentData_WireGraph_AudioReference"],
	["BrickComponentType_WireGraph_BrickAssetReference", "BrickComponentData_WireGraph_BrickAssetReference"],
	["BrickComponentType_WireGraph_DeltaTime", "BrickComponentData_WireGraph_DeltaTime"],
	["BrickComponentType_WireGraph_EntityTypeReference", "BrickComponentData_WireGraph_EntityTypeReference"],
	["BrickComponentType_WireGraph_Exec_ArrayVar_Append", "BrickComponentData_WireGraph_Exec_ArrayVar_DualRef"],
	["BrickComponentType_WireGraph_Exec_ArrayVar_Average", "BrickComponentData_WireGraph_Exec_ArrayVar_Average"],
	["BrickComponentType_WireGraph_Exec_ArrayVar_Clear", "BrickComponentData_WireGraph_Exec_ArrayVar_Base"],
	["BrickComponentType_WireGraph_Exec_ArrayVar_CopyFrom", "BrickComponentData_WireGraph_Exec_ArrayVar_DualRef"],
	["BrickComponentType_WireGraph_Exec_ArrayVar_Fill", "BrickComponentData_WireGraph_Exec_ArrayVar_Push"],
	["BrickComponentType_WireGraph_Exec_ArrayVar_Find", "BrickComponentData_WireGraph_Exec_ArrayVar_Find"],
	["BrickComponentType_WireGraph_Exec_ArrayVar_Get", "BrickComponentData_WireGraph_Exec_ArrayVar_Get"],
	["BrickComponentType_WireGraph_Exec_ArrayVar_GetLength", "BrickComponentData_WireGraph_Exec_ArrayVar_GetLength"],
	["BrickComponentType_WireGraph_Exec_ArrayVar_Insert", "BrickComponentData_WireGraph_Exec_ArrayVar_Insert"],
	["BrickComponentType_WireGraph_Exec_ArrayVar_Max", "BrickComponentData_WireGraph_Exec_ArrayVar_MinMax"],
	["BrickComponentType_WireGraph_Exec_ArrayVar_Min", "BrickComponentData_WireGraph_Exec_ArrayVar_MinMax"],
	["BrickComponentType_WireGraph_Exec_ArrayVar_Pop", "BrickComponentData_WireGraph_Exec_ArrayVar_Pop"],
	["BrickComponentType_WireGraph_Exec_ArrayVar_Push", "BrickComponentData_WireGraph_Exec_ArrayVar_Push"],
	["BrickComponentType_WireGraph_Exec_ArrayVar_RemoveAtIndex", "BrickComponentData_WireGraph_Exec_ArrayVar_RemoveAtIndex"],
	["BrickComponentType_WireGraph_Exec_ArrayVar_Resize", "BrickComponentData_WireGraph_Exec_ArrayVar_Resize"],
	["BrickComponentType_WireGraph_Exec_ArrayVar_Reverse", "BrickComponentData_WireGraph_Exec_ArrayVar_Base"],
	["BrickComponentType_WireGraph_Exec_ArrayVar_SetAtIndex", "BrickComponentData_WireGraph_Exec_ArrayVar_ElementOp"],
	["BrickComponentType_WireGraph_Exec_ArrayVar_Shuffle", "BrickComponentData_WireGraph_Exec_ArrayVar_Base"],
	["BrickComponentType_WireGraph_Exec_ArrayVar_Slice", "BrickComponentData_WireGraph_Exec_ArrayVar_Slice"],
	["BrickComponentType_WireGraph_Exec_ArrayVar_Sort", "BrickComponentData_WireGraph_Exec_ArrayVar_Sort"],
	["BrickComponentType_WireGraph_Exec_ArrayVar_SortMultiple", "BrickComponentData_WireGraph_Exec_ArrayVar_SortMultiple"],
	["BrickComponentType_WireGraph_Exec_ArrayVar_Sum", "BrickComponentData_WireGraph_Exec_ArrayVar_Sum"],
	["BrickComponentType_WireGraph_Exec_ArrayVar_Swap", "BrickComponentData_WireGraph_Exec_ArrayVar_Swap"],
	["BrickComponentType_WireGraph_Exec_Branch", "BrickComponentData_WireGraph_ExecBranch"],
	["BrickComponentType_WireGraph_Exec_Character_AddInventoryBrick", "BrickComponentData_WireGraph_Exec_Character_AddInventoryBrick"],
	["BrickComponentType_WireGraph_Exec_Character_AddInventoryEntity", "BrickComponentData_WireGraph_Exec_Character_AddInventoryEntity"],
	["BrickComponentType_WireGraph_Exec_Character_AddInventoryEntry", "BrickComponentData_WireGraph_Exec_Character_AddInventoryEntry"],
	["BrickComponentType_WireGraph_Exec_Character_AddInventoryItem", "BrickComponentData_WireGraph_Exec_Character_AddInventoryItem"],
	["BrickComponentType_WireGraph_Exec_Character_AddInventoryItemAdv", "BrickComponentData_WireGraph_Exec_Character_AddInventoryItemAdv"],
	["BrickComponentType_WireGraph_Exec_Character_GetAim", "BrickComponentData_WireGraph_Exec_Character_GetAim"],
	["BrickComponentType_WireGraph_Exec_Character_GetAmmo", "BrickComponentData_WireGraph_Exec_Character_GetAmmo"],
	["BrickComponentType_WireGraph_Exec_Character_GetCurrentInventorySlot", "BrickComponentData_WireGraph_Exec_Character_GetCurrentInventorySlot"],
	["BrickComponentType_WireGraph_Exec_Character_GetDamage", "BrickComponentData_WireGraph_Exec_Character_GetDamage"],
	["BrickComponentType_WireGraph_Exec_Character_GetFromController", "BrickComponentData_WireGraph_Exec_Character_GetFromController"],
	["BrickComponentType_WireGraph_Exec_Character_GetInventoryEntry", "BrickComponentData_WireGraph_Exec_Character_GetInventoryEntry"],
	["BrickComponentType_WireGraph_Exec_Character_GetWeaponChamberAmmo", "BrickComponentData_WireGraph_Exec_Character_GetWeaponChamberAmmo"],
	["BrickComponentType_WireGraph_Exec_Character_GrantAmmo", "BrickComponentData_WireGraph_Exec_Character_GrantAmmo"],
	["BrickComponentType_WireGraph_Exec_Character_IncDamage", "BrickComponentData_WireGraph_Exec_Character_IncDamage"],
	["BrickComponentType_WireGraph_Exec_Character_IncWeaponChamberAmmo", "BrickComponentData_WireGraph_Exec_Character_IncWeaponChamberAmmo"],
	["BrickComponentType_WireGraph_Exec_Character_SetAmmo", "BrickComponentData_WireGraph_Exec_Character_SetAmmo"],
	["BrickComponentType_WireGraph_Exec_Character_SetDamage", "BrickComponentData_WireGraph_Exec_Character_SetDamage"],
	["BrickComponentType_WireGraph_Exec_Character_SetInventoryBrick", "BrickComponentData_WireGraph_Exec_Character_SetInventoryBrick"],
	["BrickComponentType_WireGraph_Exec_Character_SetInventoryEntity", "BrickComponentData_WireGraph_Exec_Character_SetInventoryEntity"],
	["BrickComponentType_WireGraph_Exec_Character_SetInventoryEntry", "BrickComponentData_WireGraph_Exec_Character_SetInventoryEntry"],
	["BrickComponentType_WireGraph_Exec_Character_SetInventoryItem", "BrickComponentData_WireGraph_Exec_Character_SetInventoryItem"],
	["BrickComponentType_WireGraph_Exec_Character_SetInventoryItemAdv", "BrickComponentData_WireGraph_Exec_Character_SetInventoryItemAdv"],
	["BrickComponentType_WireGraph_Exec_Character_SetTempPermission", "BrickComponentData_WireGraph_Exec_Character_SetTempPermission"],
	["BrickComponentType_WireGraph_Exec_Character_SetWeaponChamberAmmo", "BrickComponentData_WireGraph_Exec_Character_SetWeaponChamberAmmo"],
	["BrickComponentType_WireGraph_Exec_Character_ShowHint", "BrickComponentData_WireGraph_Exec_Character_ShowHint"],
	["BrickComponentType_WireGraph_Exec_ChatCommand", "BrickComponentData_WireGraph_Exec_ChatCommand"],
	["BrickComponentType_WireGraph_Exec_Cycle", "BrickComponentData_WireGraph_Exec_Cycle"],
	["BrickComponentType_WireGraph_Exec_Entity_AddLocationRotation", "BrickComponentData_WireGraph_Exec_Entity_AddLocationRotation"],
	["BrickComponentType_WireGraph_Exec_Entity_AddVelocity", "BrickComponentData_WireGraph_Exec_Entity_AddVelocity"],
	["BrickComponentType_WireGraph_Exec_Entity_DestroySpawned", "BrickComponentData_WireGraph_Exec_Entity_DestroySpawned"],
	["BrickComponentType_WireGraph_Exec_Entity_DestroySpawnedPrefab", "BrickComponentData_WireGraph_Exec_Entity_DestroySpawnedPrefab"],
	["BrickComponentType_WireGraph_Exec_Entity_GetAngularVelocity", "BrickComponentData_WireGraph_Exec_Entity_GetAngularVelocity"],
	["BrickComponentType_WireGraph_Exec_Entity_GetLinearVelocity", "BrickComponentData_WireGraph_Exec_Entity_GetLinearVelocity"],
	["BrickComponentType_WireGraph_Exec_Entity_GetLocation", "BrickComponentData_WireGraph_Exec_Entity_GetLocation"],
	["BrickComponentType_WireGraph_Exec_Entity_GetLocationRotation", "BrickComponentData_WireGraph_Exec_Entity_GetLocationRotation"],
	["BrickComponentType_WireGraph_Exec_Entity_GetRotation", "BrickComponentData_WireGraph_Exec_Entity_GetRotation"],
	["BrickComponentType_WireGraph_Exec_Entity_GetSpeed", "BrickComponentData_WireGraph_Exec_Entity_GetSpeed"],
	["BrickComponentType_WireGraph_Exec_Entity_GetTag", "BrickComponentData_WireGraph_Exec_Entity_GetTag"],
	["BrickComponentType_WireGraph_Exec_Entity_GetTeam", "BrickComponentData_WireGraph_Exec_Entity_GetTeam"],
	["BrickComponentType_WireGraph_Exec_Entity_GetVelocity", "BrickComponentData_WireGraph_Exec_Entity_GetVelocity"],
	["BrickComponentType_WireGraph_Exec_Entity_GetVelocityAtPoint", "BrickComponentData_WireGraph_Exec_Entity_GetVelocityAtPoint"],
	["BrickComponentType_WireGraph_Exec_Entity_IsFrozen", "BrickComponentData_WireGraph_Exec_Entity_IsFrozen"],
	["BrickComponentType_WireGraph_Exec_Entity_RelativeTeleport", "BrickComponentData_WireGraph_Exec_Entity_RelativeTeleport"],
	["BrickComponentType_WireGraph_Exec_Entity_SetAngularVelocity", "BrickComponentData_WireGraph_Exec_Entity_SetAngularVelocity"],
	["BrickComponentType_WireGraph_Exec_Entity_SetFrozen", "BrickComponentData_WireGraph_Exec_Entity_SetFrozen"],
	["BrickComponentType_WireGraph_Exec_Entity_SetGravityDirection", "BrickComponentData_WireGraph_Exec_Entity_SetGravityDirection"],
	["BrickComponentType_WireGraph_Exec_Entity_SetLinearVelocity", "BrickComponentData_WireGraph_Exec_Entity_SetLinearVelocity"],
	["BrickComponentType_WireGraph_Exec_Entity_SetLocation", "BrickComponentData_WireGraph_Exec_Entity_SetLocation"],
	["BrickComponentType_WireGraph_Exec_Entity_SetLocationRotation", "BrickComponentData_WireGraph_Exec_Entity_SetLocationRotation"],
	["BrickComponentType_WireGraph_Exec_Entity_SetRotation", "BrickComponentData_WireGraph_Exec_Entity_SetRotation"],
	["BrickComponentType_WireGraph_Exec_Entity_SetTag", "BrickComponentData_WireGraph_Exec_Entity_SetTag"],
	["BrickComponentType_WireGraph_Exec_Entity_SetTeam", "BrickComponentData_WireGraph_Exec_Entity_SetTeam"],
	["BrickComponentType_WireGraph_Exec_Entity_SetVelocity", "BrickComponentData_WireGraph_Exec_Entity_SetVelocity"],
	["BrickComponentType_WireGraph_Exec_Entity_Teleport", "BrickComponentData_WireGraph_Exec_Entity_Teleport"],
	["BrickComponentType_WireGraph_Exec_Gamemode_BroadcastChatMessage", "BrickComponentData_WireGraph_Exec_Gamemode_BroadcastChatMessage"],
	["BrickComponentType_WireGraph_Exec_Gamemode_BroadcastStatusMessage", "BrickComponentData_WireGraph_Exec_Gamemode_BroadcastStatusMessage"],
	["BrickComponentType_WireGraph_Exec_Gamemode_FillArrayFromPlayers", "BrickComponentData_WireGraph_Exec_Gamemode_FillArrayFromPlayers"],
	["BrickComponentType_WireGraph_Exec_Gamemode_FillArrayFromTeamMembers", "BrickComponentData_WireGraph_Exec_Gamemode_FillArrayFromTeamMembers"],
	["BrickComponentType_WireGraph_Exec_Gamemode_GetCurrentRound", "BrickComponentData_WireGraph_Exec_Gamemode_GetCurrentRound"],
	["BrickComponentType_WireGraph_Exec_Gamemode_GetLeaderboardValue", "BrickComponentData_WireGraph_Exec_Gamemode_GetLeaderboardValue"],
	["BrickComponentType_WireGraph_Exec_Gamemode_GetTeam", "BrickComponentData_WireGraph_Exec_Gamemode_GetTeam"],
	["BrickComponentType_WireGraph_Exec_Gamemode_GetTeamByName", "BrickComponentData_WireGraph_Exec_Gamemode_GetTeamByName"],
	["BrickComponentType_WireGraph_Exec_Gamemode_GetTeamLeaderboardValue", "BrickComponentData_WireGraph_Exec_Gamemode_GetTeamLeaderboardValue"],
	["BrickComponentType_WireGraph_Exec_Gamemode_GetTeamName", "BrickComponentData_WireGraph_Exec_Gamemode_GetTeamName"],
	["BrickComponentType_WireGraph_Exec_Gamemode_IncrementLeaderboardValue", "BrickComponentData_WireGraph_Exec_Gamemode_LeaderboardValue"],
	["BrickComponentType_WireGraph_Exec_Gamemode_IncrementTeamLeaderboardValue", "BrickComponentData_WireGraph_Exec_Gamemode_TeamLeaderboardValue"],
	["BrickComponentType_WireGraph_Exec_Gamemode_PlayerWins", "BrickComponentData_WireGraph_Exec_Gamemode_PlayerWins"],
	["BrickComponentType_WireGraph_Exec_Gamemode_SetLeaderboardValue", "BrickComponentData_WireGraph_Exec_Gamemode_LeaderboardValue"],
	["BrickComponentType_WireGraph_Exec_Gamemode_SetTeam", "BrickComponentData_WireGraph_Exec_Gamemode_SetTeam"],
	["BrickComponentType_WireGraph_Exec_Gamemode_SetTeamLeaderboardValue", "BrickComponentData_WireGraph_Exec_Gamemode_TeamLeaderboardValue"],
	["BrickComponentType_WireGraph_Exec_Gamemode_SetTeamPinned", "BrickComponentData_WireGraph_Exec_Gamemode_SetTeamPinned"],
	["BrickComponentType_WireGraph_Exec_Gamemode_TeamWins", "BrickComponentData_WireGraph_Exec_Gamemode_TeamWins"],
	["BrickComponentType_WireGraph_Exec_GetInputs", "BrickComponentData_WireGraph_Exec_GetInputs"],
	["BrickComponentType_WireGraph_Exec_GetOwnTransform", "BrickComponentData_WireGraph_Exec_GetOwnTransform"],
	["BrickComponentType_WireGraph_Exec_MapVar_Clear", "BrickComponentData_WireGraph_Exec_MapVar_Base"],
	["BrickComponentType_WireGraph_Exec_MapVar_CopyFrom", "BrickComponentData_WireGraph_Exec_MapVar_CopyFrom"],
	["BrickComponentType_WireGraph_Exec_MapVar_Get", "BrickComponentData_WireGraph_Exec_MapVar_Get"],
	["BrickComponentType_WireGraph_Exec_MapVar_GetKeys", "BrickComponentData_WireGraph_Exec_MapVar_ArrayDest"],
	["BrickComponentType_WireGraph_Exec_MapVar_GetLength", "BrickComponentData_WireGraph_Exec_MapVar_GetLength"],
	["BrickComponentType_WireGraph_Exec_MapVar_GetValues", "BrickComponentData_WireGraph_Exec_MapVar_ArrayDest"],
	["BrickComponentType_WireGraph_Exec_MapVar_Has", "BrickComponentData_WireGraph_Exec_MapVar_KeyOp"],
	["BrickComponentType_WireGraph_Exec_MapVar_Remove", "BrickComponentData_WireGraph_Exec_MapVar_KeyOp"],
	["BrickComponentType_WireGraph_Exec_MapVar_Set", "BrickComponentData_WireGraph_Exec_MapVar_Set"],
	["BrickComponentType_WireGraph_Exec_PlayClientAudio", "BrickComponentData_WireGraph_Exec_PlayClientAudio"],
	["BrickComponentType_WireGraph_Exec_PlayGlobalAudio", "BrickComponentData_WireGraph_Exec_PlayGlobalAudio"],
	["BrickComponentType_WireGraph_Exec_PlayerState_DisplayText", "BrickComponentData_WireGraph_Exec_PlayerState_DisplayText"],
	["BrickComponentType_WireGraph_Exec_PlayerState_ForceRespawn", "BrickComponentData_WireGraph_Exec_PlayerState_ForceRespawn"],
	["BrickComponentType_WireGraph_Exec_PlayerState_GetDisplayName", "BrickComponentData_WireGraph_Exec_PlayerState_GetDisplayName"],
	["BrickComponentType_WireGraph_Exec_PlayerState_GetFromEntity", "BrickComponentData_WireGraph_Exec_PlayerState_GetFromEntity"],
	["BrickComponentType_WireGraph_Exec_PlayerState_GetUserId", "BrickComponentData_WireGraph_Exec_PlayerState_GetUserId"],
	["BrickComponentType_WireGraph_Exec_PlayerState_GetUserName", "BrickComponentData_WireGraph_Exec_PlayerState_GetUserName"],
	["BrickComponentType_WireGraph_Exec_PlayerState_HasPermission", "BrickComponentData_WireGraph_Exec_PlayerState_HasPermission"],
	["BrickComponentType_WireGraph_Exec_PlayerState_HasRole", "BrickComponentData_WireGraph_Exec_PlayerState_HasRole"],
	["BrickComponentType_WireGraph_Exec_PlayerState_IsTrustedByBrickOwner", "BrickComponentData_WireGraph_Exec_PlayerState_IsTrustedByBrickOwner"],
	["BrickComponentType_WireGraph_Exec_PlayerState_SetCanRespawn", "BrickComponentData_WireGraph_Exec_PlayerState_SetCanRespawn"],
	["BrickComponentType_WireGraph_Exec_PlayerState_ShowChatMessage", "BrickComponentData_WireGraph_Exec_PlayerState_ShowChatMessage"],
	["BrickComponentType_WireGraph_Exec_PlayerState_ShowMessageBox", "BrickComponentData_WireGraph_Exec_PlayerState_ShowMessageBox"],
	["BrickComponentType_WireGraph_Exec_PlayerState_ShowStatusMessage", "BrickComponentData_WireGraph_Exec_PlayerState_ShowStatusMessage"],
	["BrickComponentType_WireGraph_Exec_PrefabSpawner", "BrickComponentData_WireGraph_Exec_PrefabSpawner"],
	["BrickComponentType_WireGraph_Exec_PrintToConsole", "BrickComponentData_WireGraph_Exec_PrintToConsole"],
	["BrickComponentType_WireGraph_Exec_Random", "BrickComponentData_WireGraph_Exec_Random"],
	["BrickComponentType_WireGraph_Exec_SpawnExplosion", "BrickComponentData_WireGraph_Exec_SpawnExplosion"],
	["BrickComponentType_WireGraph_Exec_SpawnExplosionAt", "BrickComponentData_WireGraph_Exec_SpawnExplosionAt"],
	["BrickComponentType_WireGraph_Exec_Sweep", "BrickComponentData_WireGraph_Exec_Sweep"],
	["BrickComponentType_WireGraph_Exec_SweepSimple", "BrickComponentData_WireGraph_Exec_SweepSimple"],
	["BrickComponentType_WireGraph_Exec_Toggle", "BrickComponentData_WireGraph_Exec_Toggle"],
	["BrickComponentType_WireGraph_Exec_Union", "BrickComponentData_WireGraph_ExecUnion"],
	["BrickComponentType_WireGraph_Exec_Var_Get", "BrickComponentData_WireGraph_Exec_Var_Get"],
	["BrickComponentType_WireGraph_Exec_Var_Increment", "BrickComponentData_WireGraph_Exec_Var_EditOrGet"],
	["BrickComponentType_WireGraph_Exec_Var_Set", "BrickComponentData_WireGraph_Exec_Var_EditOrGet"],
	["BrickComponentType_WireGraph_Exec_WholeGridInteracted", "BrickComponentData_WireGraph_Exec_WholeGridInteracted"],
	["BrickComponentType_WireGraph_Exec_WholeGridTargeted", "BrickComponentData_WireGraph_Exec_WholeGridTargeted"],
	["BrickComponentType_WireGraph_Exec_Zone_GetEntities", "BrickComponentData_WireGraph_Exec_Zone_GetEntities"],
	["BrickComponentType_WireGraph_Exec_Zone_GetPlayers", "BrickComponentData_WireGraph_Exec_Zone_GetPlayers"],
	["BrickComponentType_WireGraph_Expr_BitwiseAND", "BrickComponentData_WireGraph_Expr_IntInt_Int"],
	["BrickComponentType_WireGraph_Expr_BitwiseBitCount", "BrickComponentData_WireGraph_Expr_Int_Int"],
	["BrickComponentType_WireGraph_Expr_BitwiseNAND", "BrickComponentData_WireGraph_Expr_IntInt_Int"],
	["BrickComponentType_WireGraph_Expr_BitwiseNOR", "BrickComponentData_WireGraph_Expr_IntInt_Int"],
	["BrickComponentType_WireGraph_Expr_BitwiseNOT", "BrickComponentData_WireGraph_Expr_Int_Int"],
	["BrickComponentType_WireGraph_Expr_BitwiseOR", "BrickComponentData_WireGraph_Expr_IntInt_Int"],
	["BrickComponentType_WireGraph_Expr_BitwiseShiftLeft", "BrickComponentData_WireGraph_Expr_IntInt_Int"],
	["BrickComponentType_WireGraph_Expr_BitwiseShiftRight", "BrickComponentData_WireGraph_Expr_IntInt_Int"],
	["BrickComponentType_WireGraph_Expr_BitwiseShiftRightLogical", "BrickComponentData_WireGraph_Expr_IntInt_Int"],
	["BrickComponentType_WireGraph_Expr_BitwiseXOR", "BrickComponentData_WireGraph_Expr_IntInt_Int"],
	["BrickComponentType_WireGraph_Expr_Ceil", "BrickComponentData_WireGraph_Expr_Float_Float"],
	["BrickComponentType_WireGraph_Expr_ChangeDetector", "BrickComponentData_WireGraph_Expr_ChangeDetector"],
	["BrickComponentType_WireGraph_Expr_ChangeDetectorExec", "BrickComponentData_WireGraph_Expr_ChangeDetectorExec"],
	["BrickComponentType_WireGraph_Expr_ColorBlend", "BrickComponentData_WireGraph_Expr_ColorBlend"],
	["BrickComponentType_WireGraph_Expr_ColorConvert", "BrickComponentData_WireGraph_Expr_ColorConvert"],
	["BrickComponentType_WireGraph_Expr_ColorToHex", "BrickComponentData_WireGraph_Expr_ColorToHex"],
	["BrickComponentType_WireGraph_Expr_CompareEqual", "BrickComponentData_WireGraph_Expr_Compare"],
	["BrickComponentType_WireGraph_Expr_CompareGreater", "BrickComponentData_WireGraph_Expr_MathCompare"],
	["BrickComponentType_WireGraph_Expr_CompareGreaterOrEqual", "BrickComponentData_WireGraph_Expr_MathCompare"],
	["BrickComponentType_WireGraph_Expr_CompareLess", "BrickComponentData_WireGraph_Expr_MathCompare"],
	["BrickComponentType_WireGraph_Expr_CompareLessOrEqual", "BrickComponentData_WireGraph_Expr_MathCompare"],
	["BrickComponentType_WireGraph_Expr_CompareNotEqual", "BrickComponentData_WireGraph_Expr_Compare"],
	["BrickComponentType_WireGraph_Expr_Convert", "BrickComponentData_WireGraph_Expr_Convert"],
	["BrickComponentType_WireGraph_Expr_DirectionToRotation", "BrickComponentData_WireGraph_Expr_DirectionToRotation"],
	["BrickComponentType_WireGraph_Expr_EdgeDetector", "BrickComponentData_WireGraph_Expr_EdgeDetector"],
	["BrickComponentType_WireGraph_Expr_EdgeDetectorExec", "BrickComponentData_WireGraph_Expr_EdgeDetectorExec"],
	["BrickComponentType_WireGraph_Expr_EnumToInteger", "BrickComponentData_WireGraph_Expr_EnumToInteger"],
	["BrickComponentType_WireGraph_Expr_Floor", "BrickComponentData_WireGraph_Expr_Float_Float"],
	["BrickComponentType_WireGraph_Expr_Gamemode_IsBuilderTeam", "BrickComponentData_WireGraph_Expr_Gamemode_TeamPredicate"],
	["BrickComponentType_WireGraph_Expr_Gamemode_IsUnaffiliatedTeam", "BrickComponentData_WireGraph_Expr_Gamemode_TeamPredicate"],
	["BrickComponentType_WireGraph_Expr_IntegerToEnum", "BrickComponentData_WireGraph_Expr_IntegerToEnum"],
	["BrickComponentType_WireGraph_Expr_InvertRotation", "BrickComponentData_WireGraph_Expr_InvertRotation"],
	["BrickComponentType_WireGraph_Expr_ItemToPickup", "BrickComponentData_WireGraph_Expr_ItemToPickup"],
	["BrickComponentType_WireGraph_Expr_LogicalAND", "BrickComponentData_WireGraph_Expr_BoolBool_Bool"],
	["BrickComponentType_WireGraph_Expr_LogicalNAND", "BrickComponentData_WireGraph_Expr_BoolBool_Bool"],
	["BrickComponentType_WireGraph_Expr_LogicalNOR", "BrickComponentData_WireGraph_Expr_BoolBool_Bool"],
	["BrickComponentType_WireGraph_Expr_LogicalNOT", "BrickComponentData_WireGraph_Expr_Bool_Bool"],
	["BrickComponentType_WireGraph_Expr_LogicalOR", "BrickComponentData_WireGraph_Expr_BoolBool_Bool"],
	["BrickComponentType_WireGraph_Expr_LogicalXOR", "BrickComponentData_WireGraph_Expr_BoolBool_Bool"],
	["BrickComponentType_WireGraph_Expr_MakeColor", "BrickComponentData_WireGraph_Expr_MakeColor"],
	["BrickComponentType_WireGraph_Expr_MakeColorHex", "BrickComponentData_WireGraph_Expr_MakeColorHex"],
	["BrickComponentType_WireGraph_Expr_MakeColorSRGB", "BrickComponentData_WireGraph_Expr_MakeColorSRGB"],
	["BrickComponentType_WireGraph_Expr_MakeQuaternion", "BrickComponentData_WireGraph_Expr_MakeQuaternion"],
	["BrickComponentType_WireGraph_Expr_MakeRotation", "BrickComponentData_WireGraph_Expr_MakeRotation"],
	["BrickComponentType_WireGraph_Expr_MakeVector", "BrickComponentData_WireGraph_Expr_MakeVector"],
	["BrickComponentType_WireGraph_Expr_MathAbs", "BrickComponentData_WireGraph_Expr_PrimMathVariant_PrimMathVariant"],
	["BrickComponentType_WireGraph_Expr_MathAcos", "BrickComponentData_WireGraph_Expr_Float_Float"],
	["BrickComponentType_WireGraph_Expr_MathAcosh", "BrickComponentData_WireGraph_Expr_Float_Float"],
	["BrickComponentType_WireGraph_Expr_MathAdd", "BrickComponentData_WireGraph_Expr_PrimMathVariantPrimMathVariant_PrimMathVariant"],
	["BrickComponentType_WireGraph_Expr_MathAsin", "BrickComponentData_WireGraph_Expr_Float_Float"],
	["BrickComponentType_WireGraph_Expr_MathAsinh", "BrickComponentData_WireGraph_Expr_Float_Float"],
	["BrickComponentType_WireGraph_Expr_MathAtan", "BrickComponentData_WireGraph_Expr_Float_Float"],
	["BrickComponentType_WireGraph_Expr_MathAtan2", "BrickComponentData_WireGraph_Expr_MathAtan2"],
	["BrickComponentType_WireGraph_Expr_MathAtanh", "BrickComponentData_WireGraph_Expr_Float_Float"],
	["BrickComponentType_WireGraph_Expr_MathBlend", "BrickComponentData_WireGraph_Expr_MathBlend"],
	["BrickComponentType_WireGraph_Expr_MathClamp", "BrickComponentData_WireGraph_Expr_MathClamp"],
	["BrickComponentType_WireGraph_Expr_MathCos", "BrickComponentData_WireGraph_Expr_Float_Float"],
	["BrickComponentType_WireGraph_Expr_MathCosh", "BrickComponentData_WireGraph_Expr_Float_Float"],
	["BrickComponentType_WireGraph_Expr_MathDegreesToRadians", "BrickComponentData_WireGraph_Expr_Float_Float"],
	["BrickComponentType_WireGraph_Expr_MathDivide", "BrickComponentData_WireGraph_Expr_PrimMathVariantPrimMathVariant_PrimMathVariant"],
	["BrickComponentType_WireGraph_Expr_MathEasing", "BrickComponentData_WireGraph_Expr_MathEasing"],
	["BrickComponentType_WireGraph_Expr_MathExp", "BrickComponentData_WireGraph_Expr_Float_Float"],
	["BrickComponentType_WireGraph_Expr_MathLn", "BrickComponentData_WireGraph_Expr_Float_Float"],
	["BrickComponentType_WireGraph_Expr_MathLogBase", "BrickComponentData_WireGraph_Expr_MathLogBase"],
	["BrickComponentType_WireGraph_Expr_MathMax", "BrickComponentData_WireGraph_Expr_PrimMathVariantPrimMathVariant_PrimMathVariant"],
	["BrickComponentType_WireGraph_Expr_MathMin", "BrickComponentData_WireGraph_Expr_PrimMathVariantPrimMathVariant_PrimMathVariant"],
	["BrickComponentType_WireGraph_Expr_MathModulo", "BrickComponentData_WireGraph_Expr_PrimMathVariantPrimMathVariant_PrimMathVariant"],
	["BrickComponentType_WireGraph_Expr_MathModuloFloored", "BrickComponentData_WireGraph_Expr_PrimMathVariantPrimMathVariant_PrimMathVariant"],
	["BrickComponentType_WireGraph_Expr_MathMultiply", "BrickComponentData_WireGraph_Expr_PrimMathVariantPrimMathVariant_PrimMathVariant"],
	["BrickComponentType_WireGraph_Expr_MathNegate", "BrickComponentData_WireGraph_Expr_Variant_Variant"],
	["BrickComponentType_WireGraph_Expr_MathPow", "BrickComponentData_WireGraph_Expr_MathPow"],
	["BrickComponentType_WireGraph_Expr_MathRadiansToDegrees", "BrickComponentData_WireGraph_Expr_Float_Float"],
	["BrickComponentType_WireGraph_Expr_MathSign", "BrickComponentData_WireGraph_Expr_PrimMathVariant_PrimMathVariant"],
	["BrickComponentType_WireGraph_Expr_MathSin", "BrickComponentData_WireGraph_Expr_Float_Float"],
	["BrickComponentType_WireGraph_Expr_MathSinh", "BrickComponentData_WireGraph_Expr_Float_Float"],
	["BrickComponentType_WireGraph_Expr_MathSqrt", "BrickComponentData_WireGraph_Expr_Float_Float"],
	["BrickComponentType_WireGraph_Expr_MathSubtract", "BrickComponentData_WireGraph_Expr_PrimMathVariantPrimMathVariant_PrimMathVariant"],
	["BrickComponentType_WireGraph_Expr_MathTan", "BrickComponentData_WireGraph_Expr_Float_Float"],
	["BrickComponentType_WireGraph_Expr_MathTanh", "BrickComponentData_WireGraph_Expr_Float_Float"],
	["BrickComponentType_WireGraph_Expr_NearlyEqual", "BrickComponentData_WireGraph_Expr_NearlyEqual"],
	["BrickComponentType_WireGraph_Expr_QuatAngleBetween", "BrickComponentData_WireGraph_Expr_QuatAngleBetween"],
	["BrickComponentType_WireGraph_Expr_QuatBetween", "BrickComponentData_WireGraph_Expr_QuatBetween"],
	["BrickComponentType_WireGraph_Expr_QuatDotProduct", "BrickComponentData_WireGraph_Expr_QuatDotProduct"],
	["BrickComponentType_WireGraph_Expr_QuatFromAxisAngle", "BrickComponentData_WireGraph_Expr_QuatFromAxisAngle"],
	["BrickComponentType_WireGraph_Expr_QuatSlerp", "BrickComponentData_WireGraph_Expr_QuatSlerp"],
	["BrickComponentType_WireGraph_Expr_QuatToAxisAngle", "BrickComponentData_WireGraph_Expr_QuatToAxisAngle"],
	["BrickComponentType_WireGraph_Expr_Remap", "BrickComponentData_WireGraph_Expr_Remap"],
	["BrickComponentType_WireGraph_Expr_RotateVector", "BrickComponentData_WireGraph_Expr_RotateVector"],
	["BrickComponentType_WireGraph_Expr_RotationToDirection", "BrickComponentData_WireGraph_Expr_RotationToDirection"],
	["BrickComponentType_WireGraph_Expr_Round", "BrickComponentData_WireGraph_Expr_Float_Float"],
	["BrickComponentType_WireGraph_Expr_Select", "BrickComponentData_WireGraph_Expr_Select"],
	["BrickComponentType_WireGraph_Expr_SplitColor", "BrickComponentData_WireGraph_Expr_SplitColor"],
	["BrickComponentType_WireGraph_Expr_SplitColorSRGB", "BrickComponentData_WireGraph_Expr_SplitColorSRGB"],
	["BrickComponentType_WireGraph_Expr_SplitQuaternion", "BrickComponentData_WireGraph_Expr_SplitQuaternion"],
	["BrickComponentType_WireGraph_Expr_SplitRotation", "BrickComponentData_WireGraph_Expr_SplitRotation"],
	["BrickComponentType_WireGraph_Expr_SplitVector", "BrickComponentData_WireGraph_Expr_SplitVector"],
	["BrickComponentType_WireGraph_Expr_String_CharacterToCodepoint", "BrickComponentData_WireGraph_Expr_String_CharacterToCodepoint"],
	["BrickComponentType_WireGraph_Expr_String_CodepointToCharacter", "BrickComponentData_WireGraph_Expr_String_CodepointToCharacter"],
	["BrickComponentType_WireGraph_Expr_String_Concatenate", "BrickComponentData_WireGraph_Expr_String_Concatenate"],
	["BrickComponentType_WireGraph_Expr_String_Contains", "BrickComponentData_WireGraph_Expr_String_Contains"],
	["BrickComponentType_WireGraph_Expr_String_EndsWith", "BrickComponentData_WireGraph_Expr_String_EndsWith"],
	["BrickComponentType_WireGraph_Expr_String_Find", "BrickComponentData_WireGraph_Expr_String_Find"],
	["BrickComponentType_WireGraph_Expr_String_FormatText", "BrickComponentData_WireGraph_Expr_String_FormatText"],
	["BrickComponentType_WireGraph_Expr_String_Length", "BrickComponentData_WireGraph_Expr_String_Length"],
	["BrickComponentType_WireGraph_Expr_String_ParseInt", "BrickComponentData_WireGraph_Expr_String_ParseInt"],
	["BrickComponentType_WireGraph_Expr_String_ParseNumber", "BrickComponentData_WireGraph_Expr_String_ParseNumber"],
	["BrickComponentType_WireGraph_Expr_String_Replace", "BrickComponentData_WireGraph_Expr_String_Replace"],
	["BrickComponentType_WireGraph_Expr_String_Split", "BrickComponentData_WireGraph_Expr_String_Split"],
	["BrickComponentType_WireGraph_Expr_String_StartsWith", "BrickComponentData_WireGraph_Expr_String_StartsWith"],
	["BrickComponentType_WireGraph_Expr_String_Substring", "BrickComponentData_WireGraph_Expr_String_Substring"],
	["BrickComponentType_WireGraph_Expr_String_ToLower", "BrickComponentData_WireGraph_Expr_String_ToLower"],
	["BrickComponentType_WireGraph_Expr_String_ToUpper", "BrickComponentData_WireGraph_Expr_String_ToUpper"],
	["BrickComponentType_WireGraph_Expr_String_Trim", "BrickComponentData_WireGraph_Expr_String_Trim"],
	["BrickComponentType_WireGraph_Expr_Swap", "BrickComponentData_WireGraph_Expr_Swap"],
	["BrickComponentType_WireGraph_Expr_VecCrossProduct", "BrickComponentData_WireGraph_Expr_VecVec_Vec"],
	["BrickComponentType_WireGraph_Expr_VecDistance", "BrickComponentData_WireGraph_Expr_VecVec_Float"],
	["BrickComponentType_WireGraph_Expr_VecDistanceSquared", "BrickComponentData_WireGraph_Expr_VecVec_Float"],
	["BrickComponentType_WireGraph_Expr_VecDotProduct", "BrickComponentData_WireGraph_Expr_VecVec_Float"],
	["BrickComponentType_WireGraph_Expr_VecMagnitude", "BrickComponentData_WireGraph_Expr_Vec_Float"],
	["BrickComponentType_WireGraph_Expr_VecMagnitudeSquared", "BrickComponentData_WireGraph_Expr_Vec_Float"],
	["BrickComponentType_WireGraph_Expr_VecNormalize", "BrickComponentData_WireGraph_Expr_Vec_Vec"],
	["BrickComponentType_WireGraph_Expr_VecScale", "BrickComponentData_WireGraph_Expr_VecFloat_Vec"],
	["BrickComponentType_WireGraph_Fake_Gamemode_CharacterDamagedEvent", "BrickComponentData_WireGraph_Fake_CharacterDamageEvent"],
	["BrickComponentType_WireGraph_Fake_Gamemode_CharacterDiedEvent", "BrickComponentData_WireGraph_Fake_CharacterDeathEvent"],
	["BrickComponentType_WireGraph_Fake_Gamemode_CharacterFiredWeaponEvent", "BrickComponentData_WireGraph_Fake_CharacterFiredWeaponEvent"],
	["BrickComponentType_WireGraph_Fake_Gamemode_CharacterSpawnedEvent", "BrickComponentData_WireGraph_Fake_CharacterEvent"],
	["BrickComponentType_WireGraph_Fake_Gamemode_ControllerJoinedEvent", "BrickComponentData_WireGraph_Fake_ControllerEvent"],
	["BrickComponentType_WireGraph_Fake_Gamemode_ControllerJoinedTeamEvent", "BrickComponentData_WireGraph_Fake_ControllerTeamEvent"],
	["BrickComponentType_WireGraph_Fake_Gamemode_ControllerLeftEvent", "BrickComponentData_WireGraph_Fake_ControllerEvent"],
	["BrickComponentType_WireGraph_Fake_Gamemode_ControllerLeftTeamEvent", "BrickComponentData_WireGraph_Fake_ControllerTeamEvent"],
	["BrickComponentType_WireGraph_Fake_Gamemode_RoundEndEvent", "BrickComponentData_WireGraph_Fake_RoundEvent"],
	["BrickComponentType_WireGraph_Fake_Gamemode_RoundStartEvent", "BrickComponentData_WireGraph_Fake_RoundEvent"],
	["BrickComponentType_WireGraph_FindPlayer", "BrickComponentData_WireGraph_FindPlayer"],
	["BrickComponentType_WireGraph_FontReference", "BrickComponentData_WireGraph_FontReference"],
	["BrickComponentType_WireGraph_FormatDate", "BrickComponentData_WireGraph_FormatDate"],
	["BrickComponentType_WireGraph_GetUnixEpoch", "BrickComponentData_WireGraph_GetUnixEpoch"],
	["BrickComponentType_WireGraph_ItemReference", "BrickComponentData_WireGraph_ItemReference"],
	["BrickComponentType_WireGraph_OneShotAudioReference", "BrickComponentData_WireGraph_OneShotAudioReference"],
	["BrickComponentType_WireGraph_ParticleReference", "BrickComponentData_WireGraph_ParticleReference"],
	["BrickComponentType_WireGraph_PickupReference", "BrickComponentData_WireGraph_PickupReference"],
	["BrickComponentType_WireGraph_ProjectileReference", "BrickComponentData_WireGraph_ProjectileReference"],
	["BrickComponentType_WireGraph_ServerUptime", "BrickComponentData_WireGraph_ServerUptime"],
	["BrickComponentType_WireGraph_WeaponResourceReference", "BrickComponentData_WireGraph_WeaponResourceReference"],
	["BrickComponentType_WireGraph_WheelEngineAudioReference", "BrickComponentData_WireGraph_WheelEngineAudioReference"],
	["Component_AudioEmitter", "BrickComponentData_AudioEmitter"],
	["Component_BotSpawn", "BrickComponentData_BotSpawn"],
	["Component_BrickPropertyChanger", "BrickComponentData_BrickPropertyChanger"],
	["Component_Button", "BrickComponentData_Button"],
	["Component_CheckPoint", "BrickComponentData_CheckPoint"],
	["Component_Damage", "BrickComponentData_Damage"],
	["Component_Interact", "BrickComponentData_Interact"],
	["Component_Internal_AnimatedButton", "BrickComponentData_Button"],
	["Component_Internal_AnimatedPressurePlate", "BrickComponentData_Touch"],
	["Component_Internal_AnimatedSwitch", "BrickComponentData_Switch"],
	["Component_Internal_AttachedZone", "BrickComponentData_Internal_AttachedZone"],
	["Component_Internal_Bearing", "BrickComponentData_Bearing"],
	["Component_Internal_Gyroscope", "BrickComponentData_Gyroscope"],
	["Component_Internal_InputSplitter", "BrickComponentData_Internal_InputSplitter_V2"],
	["Component_Internal_Joint_Wheel", "BrickComponentData_Joint_Wheel"],
	["Component_Internal_Joint_Wheel_Suspension", "BrickComponentData_Joint_Wheel_Suspension"],
	["Component_Internal_Microchip", "BrickComponentData_Internal_Microchip"],
	["Component_Internal_Motor", "BrickComponentData_Motor"],
	["Component_Internal_MotorSlider", "BrickComponentData_MotorSlider"],
	["Component_Internal_ProjectileSpawner_Cannon", "BrickComponentData_ProjectileSpawner"],
	["Component_Internal_Rerouter", "BrickComponentData_Rerouter"],
	["Component_Internal_RigidBearing", "BrickComponentData_RigidBearing"],
	["Component_Internal_RigidSlider", "BrickComponentData_RigidSlider"],
	["Component_Internal_Seat", "BrickComponentData_Seat_V2"],
	["Component_Internal_Servo", "BrickComponentData_Servo"],
	["Component_Internal_ServoSlider", "BrickComponentData_ServoSlider"],
	["Component_Internal_Slider", "BrickComponentData_Slider"],
	["Component_Internal_Thruster", "BrickComponentData_Thruster"],
	["Component_Internal_WeightBrick", "BrickComponentData_WeightBrick"],
	["Component_Internal_WheelEngine", "BrickComponentData_WheelEngine_V2"],
	["Component_ItemSpawn", "BrickComponentData_ItemSpawn"],
	["Component_OneShotAudioEmitter", "BrickComponentData_OneShotAudioEmitter"],
	["Component_PointLight", "BrickComponentData_PointLight"],
	["Component_ProjectileSpawner", "BrickComponentData_ProjectileSpawner"],
	["Component_SpawnPoint", "BrickComponentData_SpawnPoint"],
	["Component_SpotLight", "BrickComponentData_SpotLight"],
	["Component_Switch", "BrickComponentData_Switch"],
	["Component_Target", "BrickComponentData_Target"],
	["Component_TextDisplay", "BrickComponentData_TextDisplay"],
	["Component_Touch", "BrickComponentData_Touch"],
	["Component_WireGraph_PlayAudioAt", "BrickComponentData_WireGraph_Exec_Entity_PlayAudioAt"]
]), aa = new Map(Object.entries({
	BrickComponentData_AerodynamicSurface: {
		bEnabled: !0,
		bDiscoverable: !0,
		Role: 0,
		LiftCoefficient: 3,
		LiftMultiplier: 1,
		ForceApplication: 0,
		DragCoefficient: .05,
		StallAngle: 18,
		MaxDeflection: 15,
		Deflection: 0
	},
	BrickComponentData_AerodynamicSurface_Directional: {
		AerodynamicDirection: 0,
		bEnabled: !0,
		bDiscoverable: !0,
		Role: 0,
		LiftCoefficient: 3,
		LiftMultiplier: 1,
		ForceApplication: 0,
		DragCoefficient: .05,
		StallAngle: 18,
		MaxDeflection: 15,
		Deflection: 0
	},
	BrickComponentData_AudioEmitter: {
		bEnabled: !0,
		VolumeMultiplier: 1,
		PitchMultiplier: 1,
		InnerRadius: 15,
		MaxDistance: 400,
		bSpatialization: !0,
		FocusAzimuth: 360,
		NonFocusAzimuth: 360,
		NonFocusVolumeAttenuation: 1
	},
	BrickComponentData_Bearing: {
		bLimitAngle: !1,
		LimitAngle: 0,
		CurrentAngle: 0,
		bAnglesArePercentages: !1,
		bReversed: !1,
		Damping: 1
	},
	BrickComponentData_BotSpawn: {
		RespawnTime: 2,
		CorpseTimeout: 5,
		GunSkill: .4,
		Agression: .7,
		ReactionTime: .4,
		MovementRandomness: 50,
		RunSpeed: 1,
		HealthMultiplier: 1,
		Jumpyness: .7,
		MovementAmount: .2,
		AttackMovementAmount: .7,
		AggroRange: 1e3,
		AttackDamageMultiplier: 1,
		bCanJump: !0,
		bBackVision: !1,
		bVisionRaycasting: !0,
		bCanTargetPlayers: !0,
		bCanTargetBots: !0,
		bActiveBot: !0,
		bSpawnEnable: !0,
		bDeleteBot: !1,
		MoveTarget: {
			X: 0,
			Y: 0,
			Z: 0
		},
		BotName: "",
		bColorsAreLinear: !0,
		TeamCollisionChannel: 0,
		bTeamCollision: !0,
		bTeamCollision1: !0,
		bTeamCollision2: !0,
		bTeamCollision3: !0
	},
	BrickComponentData_BrickPropertyChanger: {
		bVisibility: !0,
		bCollisionEnabled: !0,
		bCollisionEnabled_Player: !0,
		bCollisionEnabled_Player1: !0,
		bCollisionEnabled_Player2: !0,
		bCollisionEnabled_Player3: !0,
		bCollisionEnabled_Weapon: !0,
		bCollisionEnabled_Interaction: !0,
		bCollisionEnabled_Physics: !0,
		Color: {
			B: 200,
			G: 200,
			R: 200,
			A: 255
		},
		MaterialAlpha: 255,
		Material: 0
	},
	BrickComponentData_Button: {
		bAllowNearbyInteraction: !0,
		bHiddenInteraction: !1,
		PromptCustomLabel: ""
	},
	BrickComponentData_CheckPoint: { bRotatePlayerGravityOnSpawn: !0 },
	BrickComponentData_Clock: {
		bEnabled: !0,
		bPulseOn: !1,
		OnTimeSeconds: 1,
		OffTimeSeconds: 1,
		IntervalSeconds: 1
	},
	BrickComponentData_Damage: {
		Damage: 100,
		RepeatDelay: 0,
		Message: "",
		ConsoleTag: ""
	},
	BrickComponentData_ExplosionSpawner: {
		SpawnOffset: {
			X: 0,
			Y: 0,
			Z: 0
		},
		ScaleMultiplier: 1,
		DamageMultiplier: 1
	},
	BrickComponentData_Gyroscope: {
		bEnabled: !0,
		bDiscoverable: !0,
		Strength: 25,
		Damping: 1,
		MaxForce: 0,
		TargetAxis: {
			X: 0,
			Y: 0,
			Z: 1
		}
	},
	BrickComponentData_Interact: {
		Message: "",
		ConsoleTag: "",
		bAllowNearbyInteraction: !0,
		bHiddenInteraction: !1,
		PromptCustomLabel: ""
	},
	BrickComponentData_Internal_AttachedZone: {
		ZoneStartDistance: 0,
		ZoneEndDistance: 60,
		bIsBuildingZone: !1,
		bIsLooseZone: !1,
		bIsShareZone: !1,
		bWater: !1,
		WaterScattering: {
			X: 7e-6,
			Y: 18e-6,
			Z: 31e-6
		},
		WaterAbsorption: {
			X: .0065,
			Y: 708e-6,
			Z: 196e-6
		},
		WaterFogIntensity: 2e-4,
		WaterFogScatteringColor: {
			R: .5,
			G: 1,
			B: .75,
			A: 1
		},
		WaterFogAmbientColor: {
			R: .1,
			G: .409524,
			B: .75,
			A: 1
		},
		WaterFogScatteringScale: 3,
		WaterFogAmbientScale: .25,
		bDetectPlayers: !0,
		bDetectPlayers1: !0,
		bDetectPlayers2: !0,
		bDetectPlayers3: !0,
		bDetectEntities: !1,
		bDetectProjectiles: !1,
		TagFilter: "",
		ZoneWindForce: 0
	},
	BrickComponentData_Internal_CharacterZoneEvent: {
		TagFilter: "",
		bCollisionEnabled_Player: !0,
		bCollisionEnabled_Player1: !0,
		bCollisionEnabled_Player2: !0,
		bCollisionEnabled_Player3: !0
	},
	BrickComponentData_Internal_EntityZoneEvent: { TagFilter: "" },
	BrickComponentData_Internal_MicrochipInput: { PortLabel: "Input" },
	BrickComponentData_Internal_MicrochipOutput: { PortLabel: "Output" },
	BrickComponentData_ItemSpawn: {
		bPickupEnabled: !0,
		bPickupRespawnOnMinigameReset: !0,
		PickupMinigameResetRespawnDelay: 0,
		bPickupAutoDisableOnPickup: !0,
		PickupRespawnTime: 5,
		bRenderTranslucentWhenDisabled: !0,
		DamageMultiplier: 1,
		WeaponSpeedMultiplier: 1,
		ItemNameOverride: "",
		WeaponAmmoOverride: { bOverrideStartingAmmo: !1 },
		PickupOffsetDirection: 0,
		PickupOffsetDistance: 5,
		PickupRotation: {
			Pitch: 0,
			Yaw: 0,
			Roll: 0
		},
		PickupScale: 1,
		bOverridePickupColors: !1,
		bPickupAnimationEnabled: !0,
		PickupAnimationAxis: 0,
		bPickupAnimationAxisLocal: !1,
		PickupSpinSpeed: .2,
		PickupBobSpeed: .1,
		PickupBobHeight: 4,
		PickupAnimationPhase: .991699
	},
	BrickComponentData_Joint_Wheel: {
		bDiscoverable: !0,
		bEnabled: !0,
		DriveSpeed: 100,
		DrivePower: 20,
		bSteerEnabled: !0,
		Steer: 0,
		SteerLimitDegree: 90,
		SteerPower: 1e3,
		bSuspensionEnabled: !0,
		SuspensionStiffness: 500,
		SuspensionDamping: 50,
		JointDistance: 10,
		bDriveWhenNotAttachedToEngine: !1,
		bCanBrake: !0,
		bAllowEngineSteerCorrect: !0,
		bReversed: !1,
		Damping: 1
	},
	BrickComponentData_Joint_Wheel_Suspension: {
		bDiscoverable: !0,
		bWheelVisible: !0,
		bEnabled: !0,
		DriveSpeed: 100,
		DrivePower: 20,
		bSteerEnabled: !0,
		Steer: 0,
		SteerLimitDegree: 90,
		SteerPower: 1e3,
		bSuspensionEnabled: !0,
		SuspensionStiffness: 500,
		SuspensionDamping: 50,
		SuspensionOffset: 0,
		SuspensionLength: 10,
		JointDistance: 10,
		bDriveWhenNotAttachedToEngine: !1,
		bCanBrake: !0,
		bAllowEngineSteerCorrect: !0,
		bReversed: !1,
		Damping: 1
	},
	BrickComponentData_Motor: {
		bEnabled: !0,
		Speed: 60,
		Power: 10,
		bLimitAngle: !1,
		LimitAngle: 0,
		CurrentAngle: 0,
		bAnglesArePercentages: !1,
		bReversed: !1,
		Damping: 1
	},
	BrickComponentData_MotorSlider: {
		bEnabled: !0,
		Speed: 60,
		Power: 10,
		bPositionsArePercentages: !1,
		bReversed: !1,
		Damping: 1
	},
	BrickComponentData_OneShotAudioEmitter: {
		VolumeMultiplier: 1,
		PitchMultiplier: 1,
		InnerRadius: 15,
		MaxDistance: 400,
		bSpatialization: !0,
		bEnableRepeat: !1,
		RepeatTime: 1,
		RepeatVariance: 0,
		RepeatCount: 1
	},
	BrickComponentData_PointLight: {
		bMatchBrickShape: !0,
		bEnabled: !0,
		Brightness: 20,
		Radius: 150,
		Color: {
			B: 255,
			G: 255,
			R: 255,
			A: 255
		},
		bUseBrickColor: !0,
		bCastShadows: !1,
		RayTracingVisibility: 0
	},
	BrickComponentData_PrefabSpawn: {
		Prefab: "",
		SpawnOffset: {
			X: 0,
			Y: 0,
			Z: 20
		},
		SpawnOffsetRotation: {
			Pitch: 0,
			Yaw: 0,
			Roll: 0
		},
		SpawnVelocity: {
			X: 0,
			Y: 0,
			Z: 0
		},
		bSpawnEnable: !0,
		RespawnTime: 5
	},
	BrickComponentData_ProjectileSpawner: {
		Direction: 0,
		SpawnLocation: 0,
		SpawnMargin: 5,
		SpawnOffsetBias: 0,
		bEnabled: !1,
		NumberOfShots: 1,
		SpreadConeAngle: 0,
		bSpreadBiasedTowardsCenter: !1,
		FireRate: 0,
		bEnforceFireRate: !1,
		DamageMultiplier: 1,
		SpeedMultiplier: 1,
		ScaleMultiplier: 1
	},
	BrickComponentData_RigidBearing: {
		TargetAngle: 0,
		bAnglesArePercentages: !1,
		bReversed: !1,
		CurrentAngle: 0,
		InterpMode: 0,
		SmoothTime: .25,
		TopSpeed: 0
	},
	BrickComponentData_RigidSlider: {
		TargetPosition: 0,
		bPositionsArePercentages: !1,
		bReversed: !1,
		CurrentPosition: 0,
		InterpMode: 0,
		SmoothTime: .25,
		TopSpeed: 0
	},
	BrickComponentData_Seat_V2: {
		bIsOccupied: !1,
		ExitOffset: {
			X: 0,
			Y: 0,
			Z: 0
		},
		bRollCameraInThirdPerson: !1,
		CameraOrigin: 0,
		CameraOriginOffset: {
			X: 0,
			Y: 0,
			Z: 0
		},
		bScaleCameraOriginOffsetWithZoom: !1,
		ThirdPersonStartingZoom: 150,
		ThirdPersonCameraRotation: {
			Pitch: 0,
			Yaw: 0,
			Roll: 0
		},
		SeatMode: 0,
		bStickyPlaneThrottle: !1,
		bFlyingGroundControls: !1,
		AirStrafeControl: 0,
		FlightInvertXOverride: 0,
		FlightInvertYOverride: 0,
		bAllowHeldItems: !0,
		bAllowNearbyInteraction: !0,
		bHiddenInteraction: !1,
		PromptCustomLabel: ""
	},
	BrickComponentData_Servo: {
		bEnabled: !0,
		TargetAngle: 0,
		Power: 100,
		ActiveDamping: 30,
		ForceLimit: 0,
		bLimitAngle: !1,
		LimitAngle: 0,
		CurrentAngle: 0,
		bAnglesArePercentages: !1,
		bReversed: !1,
		Damping: 1
	},
	BrickComponentData_ServoSlider: {
		bEnabled: !0,
		TargetPosition: 0,
		Power: 100,
		TopSpeed: 0,
		Exponent: 2,
		bPositionsArePercentages: !1,
		bReversed: !1,
		Damping: 1
	},
	BrickComponentData_Slider: {
		bPositionsArePercentages: !1,
		bReversed: !1,
		Damping: 1
	},
	BrickComponentData_SpawnPoint: {
		bRotatePlayerGravityOnSpawn: !0,
		bEnable: !0
	},
	BrickComponentData_SpotLight: {
		Rotation: {
			Pitch: 270,
			Yaw: 0,
			Roll: 0
		},
		InnerConeAngle: 30,
		OuterConeAngle: 60,
		bEnabled: !0,
		Brightness: 20,
		Radius: 150,
		Color: {
			B: 255,
			G: 255,
			R: 255,
			A: 255
		},
		bUseBrickColor: !0,
		bCastShadows: !1,
		RayTracingVisibility: 0
	},
	BrickComponentData_Switch: {
		bEnabled: !1,
		bAllowNearbyInteraction: !0,
		bHiddenInteraction: !1,
		PromptCustomLabel: ""
	},
	BrickComponentData_Target: { OnTime: .5 },
	BrickComponentData_TextDisplay: {
		Text: "Hello World",
		Rotation: 0,
		Skew: 0,
		Kerning: 0,
		LineHeight: 10,
		WidthScale: 1,
		LineOffset: 0,
		Anchor: {
			X: .5,
			Y: .5
		},
		Offset: {
			X: 0,
			Y: 0,
			Z: 0
		},
		Color: {
			B: 255,
			G: 255,
			R: 255,
			A: 255
		},
		MaterialSlider: 10,
		ShadingWidth: 2,
		OutlineColor: {
			B: 0,
			G: 0,
			R: 0,
			A: 255
		},
		OutlineWidth: 2,
		ScuffWidth: 0,
		GraffitiDepthLimit: 5,
		GraffitiAngleLimit: 45,
		GraffitiLayer: 0,
		bEnabled: !0,
		Face: 0,
		bAlignToWedge: !1,
		bOverrideColor: !0,
		Typeface: 0,
		Billboard: 0,
		Material: 0,
		Shading: 0,
		bFlipShading: !1,
		Outline: 0,
		bSharpCorners: !0,
		bSharpOutlines: !0,
		bOverrideOutlineColor: !0,
		bForeground: !1
	},
	BrickComponentData_Thruster: {
		bEnabled: !0,
		bDiscoverable: !0,
		Force: 1e4,
		ForceApplication: 0,
		Throttle: 0,
		Pitch: 0,
		Yaw: 0,
		bSpawnLight: !0
	},
	BrickComponentData_Touch: {
		bCollisionEnabled_Player: !0,
		bCollisionEnabled_Player1: !0,
		bCollisionEnabled_Player2: !0,
		bCollisionEnabled_Player3: !0
	},
	BrickComponentData_WeightBrick: {
		Mass: 1,
		MassSize: {
			X: 10,
			Y: 10,
			Z: 4
		},
		MassOffset: {
			X: 0,
			Y: 0,
			Z: 0
		}
	},
	BrickComponentData_WheelEngine_V2: {
		bEnabled: !0,
		bDisableInWorldControlDiagnostics: !1,
		bEnableManualControl: !1,
		ManualControlMode: 0,
		ManualInput_Drive: 0,
		ManualInput_Steer: 0,
		ManualInput_Pitch: 0,
		ManualInput_Roll: 0,
		bManualInput_Brake: !1,
		bAutodiscoverWheels: !0,
		bAutodiscoverThrusters: !0,
		bAutodiscoverGyroscopes: !0,
		bAutodiscoverAerodynamicSurfaces: !0,
		CustomMass: 100,
		MassDistribution: 0,
		CustomMassVerticalOffset: 0,
		DriveInterpSpeed: 1,
		DriveSpeed: 500,
		FlightTopSpeed: 5e3,
		FlightHandling: 0,
		bEnableAirBraking: !0,
		bEnableMassBalancing: !1,
		LiftMultiplier: 6,
		bEnableGlideTrim: !0,
		GlideTrimStrength: .15,
		GlideTrimTargetSpeedMultiplier: 1.15,
		bEnableAerodynamicRateDamping: !1,
		PhysicalRollDampingResponseTime: .6,
		PhysicalPitchDampingResponseTime: .8,
		PhysicalYawDampingResponseTime: 1.2,
		ThrustMultiplier: 3,
		KeyboardSteeringRollMix: 1,
		KeyboardSteeringYawMix: 0,
		HorizontalSteeringRollMix: 0,
		HorizontalSteeringYawMix: 1,
		ArcadeRollRate: 120,
		ArcadePitchRate: 75,
		ArcadeYawRate: 45,
		ArcadeResponseTime: .25,
		ArcadeAirGripResponseTime: .65,
		ArcadeMaxLateralAccelerationGs: 1.5,
		ArcadeAeroAuthorityFadeStartSpeed: 1200,
		ArcadeAeroAuthorityFadeEndSpeed: 2500,
		MigrationVersion: 3,
		DriveAcceleratingPowerMultiplier: .5,
		DriveBrakingPowerMultiplier: 10,
		DriveDampingMultiplier: 1,
		SteerPowerMultiplier: 100,
		WheelFrictionMultiplier: .8,
		SteerInterpSpeed: 10,
		SteerLimitSpeedFalloff: 1,
		SteerLimitDegree: 32,
		CenterOfSteering: 0,
		bTankSteering: !1,
		TankSteerSpeedMultiplier: 1,
		bAutoRight: !0,
		WaterDriveForce: 200,
		WaterSteeringForce: 100
	},
	BrickComponentData_WireGraphPseudo_BufferSeconds: {
		SecondsToWait: 1,
		ZeroSecondsToWait: -1,
		CurrentTime: 0,
		bHasQueued: !1,
		bIsOffTimer: !1
	},
	BrickComponentData_WireGraphPseudo_BufferTicks: {
		TicksToWait: 0,
		ZeroTicksToWait: -1,
		CurrentTicks: 0,
		bHasQueued: !1,
		bIsOffTimer: !1
	},
	BrickComponentData_WireGraphPseudo_CustomEvent: {
		EventName: "",
		bIsObjectEvent: !1
	},
	BrickComponentData_WireGraphPseudo_Dampen: {
		SmoothTime: .3,
		Velocity: {
			X: 0,
			Y: 0,
			Z: 0,
			W: 0
		}
	},
	BrickComponentData_WireGraphPseudo_QueueSeconds: { SecondsToWait: 1 },
	BrickComponentData_WireGraphPseudo_QueueTicks: { TicksToWait: 1 },
	BrickComponentData_WireGraphPseudo_SendCustomEvent: { EventName: "" },
	BrickComponentData_WireGraphPseudo_Timer: {
		Limit: 1,
		Time: 0,
		bRunning: !1
	},
	BrickComponentData_WireGraphPseudo_Tween: {
		Duration: 1,
		Elapsed: 0,
		bRunning: !1,
		Function: 0,
		Direction: 0
	},
	BrickComponentData_WireGraph_ExecBranch: { bCond: !1 },
	BrickComponentData_WireGraph_Exec_ArrayVar_Average: { bIsEmpty: !1 },
	BrickComponentData_WireGraph_Exec_ArrayVar_ElementOp: { Index: 0 },
	BrickComponentData_WireGraph_Exec_ArrayVar_Find: {
		Index: 0,
		bFound: !1
	},
	BrickComponentData_WireGraph_Exec_ArrayVar_Get: {
		bOutOfBounds: !1,
		Index: 0
	},
	BrickComponentData_WireGraph_Exec_ArrayVar_GetLength: { Length: 0 },
	BrickComponentData_WireGraph_Exec_ArrayVar_Insert: {
		bOutOfBounds: !1,
		Index: 0
	},
	BrickComponentData_WireGraph_Exec_ArrayVar_MinMax: { bIsEmpty: !1 },
	BrickComponentData_WireGraph_Exec_ArrayVar_Pop: { bIsEmpty: !1 },
	BrickComponentData_WireGraph_Exec_ArrayVar_RemoveAtIndex: {
		Index: 0,
		bOutOfBounds: !1
	},
	BrickComponentData_WireGraph_Exec_ArrayVar_Resize: { Size: 0 },
	BrickComponentData_WireGraph_Exec_ArrayVar_Slice: {
		Start: 0,
		Count: 0,
		bOutOfBounds: !1
	},
	BrickComponentData_WireGraph_Exec_ArrayVar_Sort: { bDescending: !1 },
	BrickComponentData_WireGraph_Exec_ArrayVar_SortMultiple: {
		bDescending: !1,
		bSuccess: !1
	},
	BrickComponentData_WireGraph_Exec_ArrayVar_Swap: {
		IndexA: 0,
		IndexB: 0,
		bOutOfBounds: !1
	},
	BrickComponentData_WireGraph_Exec_Character_AddInventoryBrick: { ProceduralSize: {
		X: 5,
		Y: 5,
		Z: 6
	} },
	BrickComponentData_WireGraph_Exec_Character_AddInventoryItemAdv: {
		DamageMultiplier: 1,
		WeaponSpeedMultiplier: 1,
		ItemScale: 1,
		ItemNameOverride: "",
		WeaponAmmoOverride: { bOverrideStartingAmmo: !1 },
		bOverrideColors: !1
	},
	BrickComponentData_WireGraph_Exec_Character_GetAim: { bLocalAim: !1 },
	BrickComponentData_WireGraph_Exec_Character_GetInventoryEntry: { Slot: 0 },
	BrickComponentData_WireGraph_Exec_Character_GetWeaponChamberAmmo: { Slot: 0 },
	BrickComponentData_WireGraph_Exec_Character_GrantAmmo: { Amount: 1 },
	BrickComponentData_WireGraph_Exec_Character_IncDamage: { Amount: 0 },
	BrickComponentData_WireGraph_Exec_Character_IncWeaponChamberAmmo: {
		Slot: 0,
		Amount: 1
	},
	BrickComponentData_WireGraph_Exec_Character_SetAmmo: { Amount: 0 },
	BrickComponentData_WireGraph_Exec_Character_SetDamage: { Damage: 0 },
	BrickComponentData_WireGraph_Exec_Character_SetInventoryBrick: {
		Slot: 0,
		ProceduralSize: {
			X: 5,
			Y: 5,
			Z: 6
		}
	},
	BrickComponentData_WireGraph_Exec_Character_SetInventoryEntity: { Slot: 0 },
	BrickComponentData_WireGraph_Exec_Character_SetInventoryEntry: {
		Slot: 0,
		EntryPlan: {
			Type: 0,
			BrickTypeIfBrick: { ProceduralSize: {
				X: 5,
				Y: 5,
				Z: 6
			} }
		}
	},
	BrickComponentData_WireGraph_Exec_Character_SetInventoryItem: { Slot: 0 },
	BrickComponentData_WireGraph_Exec_Character_SetInventoryItemAdv: {
		Slot: 0,
		DamageMultiplier: 1,
		WeaponSpeedMultiplier: 1,
		ItemScale: 1,
		ItemNameOverride: "",
		WeaponAmmoOverride: { bOverrideStartingAmmo: !1 },
		bOverrideColors: !1
	},
	BrickComponentData_WireGraph_Exec_Character_SetTempPermission: {
		PermissionTagStr: "BR.Permission.Building",
		bPermissionEnable: !1
	},
	BrickComponentData_WireGraph_Exec_Character_SetWeaponChamberAmmo: {
		Slot: 0,
		Amount: 0
	},
	BrickComponentData_WireGraph_Exec_Character_ShowHint: {
		HintTitle: "",
		HintText: ""
	},
	BrickComponentData_WireGraph_Exec_ChatCommand: {
		CommandName: "",
		HelpText: ""
	},
	BrickComponentData_WireGraph_Exec_Cycle: {
		Count: 3,
		Value: 0
	},
	BrickComponentData_WireGraph_Exec_Entity_AddLocationRotation: {
		Vector: {
			X: 0,
			Y: 0,
			Z: 0
		},
		Rotation: {
			Pitch: 0,
			Yaw: 0,
			Roll: 0
		}
	},
	BrickComponentData_WireGraph_Exec_Entity_AddVelocity: {
		Vector: {
			X: 0,
			Y: 0,
			Z: 0
		},
		Rotation: {
			X: 0,
			Y: 0,
			Z: 0
		}
	},
	BrickComponentData_WireGraph_Exec_Entity_GetAngularVelocity: { AngularVelocity: {
		X: 0,
		Y: 0,
		Z: 0
	} },
	BrickComponentData_WireGraph_Exec_Entity_GetLinearVelocity: { LinearVelocity: {
		X: 0,
		Y: 0,
		Z: 0
	} },
	BrickComponentData_WireGraph_Exec_Entity_GetLocation: { Vector: {
		X: 0,
		Y: 0,
		Z: 0
	} },
	BrickComponentData_WireGraph_Exec_Entity_GetLocationRotation: {
		Vector: {
			X: 0,
			Y: 0,
			Z: 0
		},
		Rotation: {
			Pitch: 0,
			Yaw: 0,
			Roll: 0
		}
	},
	BrickComponentData_WireGraph_Exec_Entity_GetRotation: { Rotation: {
		Pitch: 0,
		Yaw: 0,
		Roll: 0
	} },
	BrickComponentData_WireGraph_Exec_Entity_GetTag: { Tag: "" },
	BrickComponentData_WireGraph_Exec_Entity_GetVelocity: {
		Vector: {
			X: 0,
			Y: 0,
			Z: 0
		},
		Rotation: {
			X: 0,
			Y: 0,
			Z: 0
		}
	},
	BrickComponentData_WireGraph_Exec_Entity_GetVelocityAtPoint: {
		Point: {
			X: 0,
			Y: 0,
			Z: 0
		},
		LinearVelocity: {
			X: 0,
			Y: 0,
			Z: 0
		}
	},
	BrickComponentData_WireGraph_Exec_Entity_PlayAudioAt: {
		VolumeMultiplier: 1,
		PitchMultiplier: 1,
		InnerRadius: 0,
		MaxDistance: 1e4,
		bSpatialization: !0
	},
	BrickComponentData_WireGraph_Exec_Entity_SetAngularVelocity: { AngularVelocity: {
		X: 0,
		Y: 0,
		Z: 0
	} },
	BrickComponentData_WireGraph_Exec_Entity_SetFrozen: { bFrozen: !1 },
	BrickComponentData_WireGraph_Exec_Entity_SetGravityDirection: { Rotation: {
		Pitch: 0,
		Yaw: 0,
		Roll: 0
	} },
	BrickComponentData_WireGraph_Exec_Entity_SetLinearVelocity: { LinearVelocity: {
		X: 0,
		Y: 0,
		Z: 0
	} },
	BrickComponentData_WireGraph_Exec_Entity_SetLocation: { Vector: {
		X: 0,
		Y: 0,
		Z: 0
	} },
	BrickComponentData_WireGraph_Exec_Entity_SetLocationRotation: {
		Vector: {
			X: 0,
			Y: 0,
			Z: 0
		},
		Rotation: {
			Pitch: 0,
			Yaw: 0,
			Roll: 0
		}
	},
	BrickComponentData_WireGraph_Exec_Entity_SetRotation: { Rotation: {
		Pitch: 0,
		Yaw: 0,
		Roll: 0
	} },
	BrickComponentData_WireGraph_Exec_Entity_SetTag: { Tag: "" },
	BrickComponentData_WireGraph_Exec_Entity_SetVelocity: {
		Vector: {
			X: 0,
			Y: 0,
			Z: 0
		},
		Rotation: {
			X: 0,
			Y: 0,
			Z: 0
		}
	},
	BrickComponentData_WireGraph_Exec_Gamemode_BroadcastChatMessage: { Message: "" },
	BrickComponentData_WireGraph_Exec_Gamemode_BroadcastStatusMessage: {
		Message: "",
		bFlashIfUnchanged: !0
	},
	BrickComponentData_WireGraph_Exec_Gamemode_FillArrayFromPlayers: { bIncludeBuilderMode: !1 },
	BrickComponentData_WireGraph_Exec_Gamemode_GetLeaderboardValue: { Key: "Score" },
	BrickComponentData_WireGraph_Exec_Gamemode_GetTeamByName: { TeamName: "" },
	BrickComponentData_WireGraph_Exec_Gamemode_GetTeamLeaderboardValue: { Key: "Score" },
	BrickComponentData_WireGraph_Exec_Gamemode_LeaderboardValue: {
		Key: "Score",
		Value: 0
	},
	BrickComponentData_WireGraph_Exec_Gamemode_PlayerWins: { bTeamWinsInstead: !1 },
	BrickComponentData_WireGraph_Exec_Gamemode_SetTeam: { bPinPlayerToTeam: !1 },
	BrickComponentData_WireGraph_Exec_Gamemode_SetTeamPinned: { bPinned: !0 },
	BrickComponentData_WireGraph_Exec_Gamemode_TeamLeaderboardValue: {
		Key: "Score",
		Value: 0
	},
	BrickComponentData_WireGraph_Exec_MapVar_Get: { bFound: !1 },
	BrickComponentData_WireGraph_Exec_MapVar_GetLength: { Length: 0 },
	BrickComponentData_WireGraph_Exec_MapVar_KeyOp: { bFound: !1 },
	BrickComponentData_WireGraph_Exec_PlayClientAudio: {
		VolumeMultiplier: 1,
		PitchMultiplier: 1
	},
	BrickComponentData_WireGraph_Exec_PlayGlobalAudio: {
		VolumeMultiplier: 1,
		PitchMultiplier: 1
	},
	BrickComponentData_WireGraph_Exec_PlayerState_DisplayText: {
		Text: "",
		Typeface: 0,
		Anchor: {
			X: .5,
			Y: .5
		},
		Position: {
			X: 0,
			Y: 0
		},
		Angle: 0,
		ZOrder: 0,
		Scale: {
			X: 1,
			Y: 1
		},
		Pivot: {
			X: -1,
			Y: .5
		},
		FontSize: 16,
		FontColor: {
			R: 1,
			G: 1,
			B: 1,
			A: 1
		},
		LetterSpacing: 0,
		Skew: 0,
		LineHeight: 1,
		OutlineSize: 2,
		OutlineColor: {
			R: .009134059,
			G: .00699541,
			B: .01850022,
			A: 1
		},
		bMiteredOutline: !1,
		WrapWidth: 0,
		ShadowOffset: {
			X: 0,
			Y: 0
		},
		ShadowColor: {
			R: 0,
			G: 0,
			B: 0,
			A: 0
		},
		Justification: 0,
		Transition: 0,
		Easing: 0,
		Lifetime: 5,
		TextId: 0
	},
	BrickComponentData_WireGraph_Exec_PlayerState_HasPermission: { PermissionName: "BR.Permission.AlwaysSave" },
	BrickComponentData_WireGraph_Exec_PlayerState_HasRole: { RoleName: "" },
	BrickComponentData_WireGraph_Exec_PlayerState_SetCanRespawn: { bCanRespawn: !0 },
	BrickComponentData_WireGraph_Exec_PlayerState_ShowChatMessage: { Message: "" },
	BrickComponentData_WireGraph_Exec_PlayerState_ShowMessageBox: {
		Title: "",
		Message: ""
	},
	BrickComponentData_WireGraph_Exec_PlayerState_ShowStatusMessage: { Message: "" },
	BrickComponentData_WireGraph_Exec_PrefabSpawner: {
		Prefab: "",
		SpawnOffset: {
			X: 0,
			Y: 0,
			Z: 20
		},
		SpawnOffsetRotation: {
			Pitch: 0,
			Yaw: 0,
			Roll: 0
		},
		SpawnVelocity: {
			X: 0,
			Y: 0,
			Z: 0
		},
		Lifetime: 5,
		Limit: 5
	},
	BrickComponentData_WireGraph_Exec_PrintToConsole: { Text: "" },
	BrickComponentData_WireGraph_Exec_SpawnExplosion: {
		SpawnOffset: {
			X: 0,
			Y: 0,
			Z: 0
		},
		ScaleMultiplier: 1,
		DamageMultiplier: 1
	},
	BrickComponentData_WireGraph_Exec_SpawnExplosionAt: {
		WorldPosition: {
			X: 0,
			Y: 0,
			Z: 0
		},
		ScaleMultiplier: 1,
		DamageMultiplier: 1
	},
	BrickComponentData_WireGraph_Exec_Sweep: {
		Origin: {
			X: 0,
			Y: 0,
			Z: 0
		},
		Direction: {
			X: 1,
			Y: 0,
			Z: 0
		},
		Distance: 100,
		Radius: 0,
		CollisionChannel: 0,
		bDetectBricks: !0,
		bDetectPlayers1: !0,
		bDetectPlayers2: !0,
		bDetectPlayers3: !0,
		bDetectPlayers4: !0,
		bOnlyHitPlayerBodyParts: !1,
		bDetectPhysics: !0,
		bDetectMap: !0,
		bRelative: !1,
		bIgnoreOwningGrid: !0,
		HitLocation: {
			X: 0,
			Y: 0,
			Z: 0
		},
		HitNormal: {
			X: 0,
			Y: 0,
			Z: 1
		},
		HitDistance: 0
	},
	BrickComponentData_WireGraph_Exec_SweepSimple: {
		Direction: 0,
		Distance: 100,
		Radius: 0,
		CollisionChannel: 0,
		SpreadConeAngle: 0,
		bSpreadBiasedTowardsCenter: !1,
		bDetectBricks: !0,
		bDetectPlayers1: !0,
		bDetectPlayers2: !0,
		bDetectPlayers3: !0,
		bDetectPlayers4: !0,
		bOnlyHitPlayerBodyParts: !1,
		bDetectPhysics: !0,
		bDetectMap: !0,
		HitLocation: {
			X: 0,
			Y: 0,
			Z: 0
		},
		HitNormal: {
			X: 0,
			Y: 0,
			Z: 1
		},
		HitDistance: 0
	},
	BrickComponentData_WireGraph_Exec_Toggle: { Value: !1 },
	BrickComponentData_WireGraph_Exec_WholeGridInteracted: {
		bAllowNearbyInteraction: !0,
		bHiddenInteraction: !1,
		PromptCustomLabel: ""
	},
	BrickComponentData_WireGraph_Exec_Zone_GetEntities: { TagFilter: "" },
	BrickComponentData_WireGraph_Exec_Zone_GetPlayers: { TagFilter: "" },
	BrickComponentData_WireGraph_Expr_BoolBool_Bool: {
		bInputA: !1,
		bInputB: !1
	},
	BrickComponentData_WireGraph_Expr_Bool_Bool: { bInput: !1 },
	BrickComponentData_WireGraph_Expr_ChangeDetector: { bPulseOnChange: !1 },
	BrickComponentData_WireGraph_Expr_ColorBlend: {
		ColorA: {
			R: 0,
			G: 0,
			B: 0,
			A: 1
		},
		ColorB: {
			R: 1,
			G: 1,
			B: 1,
			A: 1
		},
		Alpha: .5,
		BlendSpace: 0,
		bClampAlpha: !0
	},
	BrickComponentData_WireGraph_Expr_ColorConvert: {
		Input: {
			R: 1,
			G: 1,
			B: 1,
			A: 1
		},
		FromSpace: 0,
		ToSpace: 0
	},
	BrickComponentData_WireGraph_Expr_ColorToHex: { Input: {
		R: 1,
		G: 1,
		B: 1,
		A: 1
	} },
	BrickComponentData_WireGraph_Expr_DirectionToRotation: { Direction: {
		X: 1,
		Y: 0,
		Z: 0
	} },
	BrickComponentData_WireGraph_Expr_EdgeDetector: {
		Input: 0,
		bPulseOnRisingEdge: !1,
		bPulseOnFallingEdge: !1
	},
	BrickComponentData_WireGraph_Expr_EdgeDetectorExec: { Input: 0 },
	BrickComponentData_WireGraph_Expr_Float_Float: { Input: 0 },
	BrickComponentData_WireGraph_Expr_IntInt_Int: {
		InputA: 0,
		InputB: 0
	},
	BrickComponentData_WireGraph_Expr_Int_Int: { Input: 0 },
	BrickComponentData_WireGraph_Expr_IntegerToEnum: {
		Input: 0,
		bWrap: !1
	},
	BrickComponentData_WireGraph_Expr_InvertRotation: { Input: {
		X: 0,
		Y: 0,
		Z: 0,
		W: 1
	} },
	BrickComponentData_WireGraph_Expr_MakeColor: {
		R: 1,
		G: 1,
		B: 1,
		A: 1
	},
	BrickComponentData_WireGraph_Expr_MakeColorHex: { Hex: "" },
	BrickComponentData_WireGraph_Expr_MakeColorSRGB: {
		R: 255,
		G: 255,
		B: 255,
		A: 255
	},
	BrickComponentData_WireGraph_Expr_MakeQuaternion: {
		X: 0,
		Y: 0,
		Z: 0,
		W: 1
	},
	BrickComponentData_WireGraph_Expr_MakeRotation: {
		Pitch: 0,
		Yaw: 0,
		Roll: 0
	},
	BrickComponentData_WireGraph_Expr_MakeVector: {
		X: 0,
		Y: 0,
		Z: 0
	},
	BrickComponentData_WireGraph_Expr_MathAtan2: {
		Y: 0,
		X: 0
	},
	BrickComponentData_WireGraph_Expr_MathBlend: {
		Blend: 0,
		bClampAlpha: !0
	},
	BrickComponentData_WireGraph_Expr_MathEasing: {
		Blend: 0,
		Function: 0,
		Direction: 0
	},
	BrickComponentData_WireGraph_Expr_MathLogBase: {
		Input: 0,
		Base: 10
	},
	BrickComponentData_WireGraph_Expr_MathPow: {
		Input: 0,
		Exponent: 2
	},
	BrickComponentData_WireGraph_Expr_NearlyEqual: { Tolerance: 9999999747378752e-20 },
	BrickComponentData_WireGraph_Expr_QuatAngleBetween: {
		InputA: {
			X: 0,
			Y: 0,
			Z: 0,
			W: 1
		},
		InputB: {
			X: 0,
			Y: 0,
			Z: 0,
			W: 1
		}
	},
	BrickComponentData_WireGraph_Expr_QuatBetween: {
		From: {
			X: 1,
			Y: 0,
			Z: 0
		},
		To: {
			X: 1,
			Y: 0,
			Z: 0
		}
	},
	BrickComponentData_WireGraph_Expr_QuatDotProduct: {
		InputA: {
			X: 0,
			Y: 0,
			Z: 0,
			W: 1
		},
		InputB: {
			X: 0,
			Y: 0,
			Z: 0,
			W: 1
		}
	},
	BrickComponentData_WireGraph_Expr_QuatFromAxisAngle: {
		Axis: {
			X: 0,
			Y: 0,
			Z: 1
		},
		Angle: 0
	},
	BrickComponentData_WireGraph_Expr_QuatSlerp: {
		InputA: {
			X: 0,
			Y: 0,
			Z: 0,
			W: 1
		},
		InputB: {
			X: 0,
			Y: 0,
			Z: 0,
			W: 1
		},
		Alpha: 0,
		bShortestPath: !0,
		bClampAlpha: !0
	},
	BrickComponentData_WireGraph_Expr_QuatToAxisAngle: { Input: {
		X: 0,
		Y: 0,
		Z: 0,
		W: 1
	} },
	BrickComponentData_WireGraph_Expr_Remap: {
		Value: 0,
		InputMin: 0,
		InputMax: 1,
		OutputMin: 0,
		OutputMax: 1,
		Function: 0,
		Direction: 0
	},
	BrickComponentData_WireGraph_Expr_RotateVector: {
		Rotation: {
			X: 0,
			Y: 0,
			Z: 0,
			W: 1
		},
		Vector: {
			X: 0,
			Y: 0,
			Z: 0
		}
	},
	BrickComponentData_WireGraph_Expr_RotationToDirection: { Rotation: {
		X: 0,
		Y: 0,
		Z: 0,
		W: 1
	} },
	BrickComponentData_WireGraph_Expr_Select: { bSelectB: !1 },
	BrickComponentData_WireGraph_Expr_SplitColor: { Input: {
		R: 1,
		G: 1,
		B: 1,
		A: 1
	} },
	BrickComponentData_WireGraph_Expr_SplitColorSRGB: { Input: {
		R: 1,
		G: 1,
		B: 1,
		A: 1
	} },
	BrickComponentData_WireGraph_Expr_SplitQuaternion: { Input: {
		X: 0,
		Y: 0,
		Z: 0,
		W: 1
	} },
	BrickComponentData_WireGraph_Expr_SplitRotation: { Input: {
		Pitch: 0,
		Yaw: 0,
		Roll: 0
	} },
	BrickComponentData_WireGraph_Expr_SplitVector: { Input: {
		X: 0,
		Y: 0,
		Z: 0
	} },
	BrickComponentData_WireGraph_Expr_String_CharacterToCodepoint: { Character: "" },
	BrickComponentData_WireGraph_Expr_String_CodepointToCharacter: { Codepoint: 0 },
	BrickComponentData_WireGraph_Expr_String_Concatenate: {
		InputA: "",
		InputB: "",
		Separator: ""
	},
	BrickComponentData_WireGraph_Expr_String_Contains: {
		Input: "",
		Search: "",
		bCaseSensitive: !0
	},
	BrickComponentData_WireGraph_Expr_String_EndsWith: {
		Input: "",
		Suffix: "",
		bCaseSensitive: !0
	},
	BrickComponentData_WireGraph_Expr_String_Find: {
		Input: "",
		Search: "",
		bCaseSensitive: !0,
		Start: 0
	},
	BrickComponentData_WireGraph_Expr_String_FormatText: { FormatString: "" },
	BrickComponentData_WireGraph_Expr_String_Length: { Input: "" },
	BrickComponentData_WireGraph_Expr_String_ParseInt: { Input: "" },
	BrickComponentData_WireGraph_Expr_String_ParseNumber: { Input: "" },
	BrickComponentData_WireGraph_Expr_String_Replace: {
		Input: "",
		Search: "",
		Replacement: "",
		bCaseSensitive: !0,
		Start: 0,
		MaxReplacements: -1
	},
	BrickComponentData_WireGraph_Expr_String_Split: {
		Input: "",
		Delimiter: "",
		bCaseSensitive: !0,
		Occurrence: 1
	},
	BrickComponentData_WireGraph_Expr_String_StartsWith: {
		Input: "",
		Prefix: "",
		bCaseSensitive: !0
	},
	BrickComponentData_WireGraph_Expr_String_Substring: {
		Input: "",
		Start: 0,
		Length: 0
	},
	BrickComponentData_WireGraph_Expr_String_ToLower: { Input: "" },
	BrickComponentData_WireGraph_Expr_String_ToUpper: { Input: "" },
	BrickComponentData_WireGraph_Expr_String_Trim: { Input: "" },
	BrickComponentData_WireGraph_Expr_Swap: { bSwap: !1 },
	BrickComponentData_WireGraph_Expr_VecFloat_Vec: {
		Input: {
			X: 0,
			Y: 0,
			Z: 0
		},
		Scalar: 0
	},
	BrickComponentData_WireGraph_Expr_VecVec_Float: {
		InputA: {
			X: 0,
			Y: 0,
			Z: 0
		},
		InputB: {
			X: 0,
			Y: 0,
			Z: 0
		}
	},
	BrickComponentData_WireGraph_Expr_VecVec_Vec: {
		InputA: {
			X: 0,
			Y: 0,
			Z: 0
		},
		InputB: {
			X: 0,
			Y: 0,
			Z: 0
		}
	},
	BrickComponentData_WireGraph_Expr_Vec_Float: { Input: {
		X: 0,
		Y: 0,
		Z: 0
	} },
	BrickComponentData_WireGraph_Expr_Vec_Vec: { Input: {
		X: 0,
		Y: 0,
		Z: 0
	} },
	BrickComponentData_WireGraph_Fake_RoundEvent: { RoundNumber: 0 },
	BrickComponentData_WireGraph_FindPlayer: { Query: "" },
	BrickComponentData_WireGraph_FormatDate: {
		UnixEpoch: 0,
		Format: "%Y-%m-%d %H:%M:%S",
		bUseUTC: !1
	}
})), oa = /* @__PURE__ */ "A,ActiveDamping,AdditionalIgnoredEntities,AerodynamicDirection,AggroRange,Agression,AirStrafeControl,Alpha,Amount,Anchor,Anchor.X,Anchor.Y,Angle,AngularVelocity,AngularVelocity.X,AngularVelocity.Y,AngularVelocity.Z,ArcadeAeroAuthorityFadeEndSpeed,ArcadeAeroAuthorityFadeStartSpeed,ArcadeAirGripResponseTime,ArcadeMaxLateralAccelerationGs,ArcadePitchRate,ArcadeResponseTime,ArcadeRollRate,ArcadeYawRate,Arguments,ArrayVarRef,ArrayVarRef2,ArrayVarRef3,ArrayVarRef4,ArrayVarRef5,ArrayVarRef6,ArrayVarRef7,ArrayVarRef8,Arrived,AttackDamageMultiplier,AttackMovementAmount,Attacker,AttackerWeapon,AttackerWeaponName,AudioDescriptor,Axis,Axis.X,Axis.Y,Axis.Z,B,Base,BeginTouchSound,Billboard,Blend,BotName,BotWeapon,BrickAsset,BrickGrid,Brightness,CameraOrigin,CameraOriginOffset,CameraOriginOffset.X,CameraOriginOffset.Y,CameraOriginOffset.Z,CenterOfSteering,Character,CharacterThatJustHit,Codepoint,CollisionChannel,Color,Color.A,Color.B,Color.G,Color.R,ColorA,ColorB,ConsoleTag,Control_DriveAndSteer,CorpseTimeout,Count,CurrentAngle,CurrentPosition,CustomMass,CustomMassVerticalOffset,Damage,DamageLimit,DamageMultiplier,Damping,DataIn1,DataIn2,DataIn3,DataIn4,DataIn5,DataIn6,DataIn7,DataIn8,DataOut1,DataOut2,DataOut3,DataOut4,DataOut5,DataOut6,DataOut7,DataOut8,Deflection,Delimiter,DeltaTime,Destination,DestroyAll,Direction,Direction.X,Direction.Y,Direction.Z,DisplayName,Distance,DistanceToTarget,DragCoefficient,DriveAcceleratingPowerMultiplier,DriveBrakingPowerMultiplier,DriveDampingMultiplier,DriveInterpSpeed,DrivePower,DriveSpeed,Duration,EndTouchSound,Entity,EntityType,Exec,ExecA,ExecB,ExecDown,ExecIn,ExecOut,ExecOutA,ExecOutB,ExecOutDown,ExitOffset,ExitOffset.X,ExitOffset.Y,ExitOffset.Z,Expired,Explode,Exponent,Face,FireRate,FireSound,FlightHandling,FlightInvertXOverride,FlightInvertYOverride,FlightTopSpeed,FocusAzimuth,FocusCharacter,Font,FontColor,Force,ForceApplication,ForceLimit,Format,FormatString,From,From.X,From.Y,From.Z,Function,G,GlideTrimStrength,GlideTrimTargetSpeedMultiplier,GraffitiAngleLimit,GraffitiDepthLimit,GraffitiLayer,GunSkill,HealthMultiplier,Hex,Hit,HitColor,HitDistance,HitEntity,HitLocation,HitNormal,HorizontalSteeringRollMix,HorizontalSteeringYawMix,IgnoreEntity,Index,IndexA,IndexB,InnerConeAngle,InnerRadius,Input,Input.Pitch,Input.Roll,Input.W,Input.X,Input.Y,Input.Yaw,Input.Z,InputA,InputA.W,InputA.X,InputA.Y,InputA.Z,InputB,InputB.W,InputB.X,InputB.Y,InputB.Z,InputC,InputD,InputE,InputF,InputForward,InputG,InputMax,InputMin,InputMouseWheel,InputPitch,InputRight,InputRoll,InputUp,InputYaw,Instigator,InteractSound,InterpMode,IntervalSeconds,Item,ItemNameOverride,ItemScale,ItemType,JointDistance,Jumpyness,Kerning,Key,KeyboardSteeringRollMix,KeyboardSteeringYawMix,Killer,KillerWeapon,KillerWeaponName,Left,Length,LetterSpacing,Lifetime,LiftCoefficient,LiftMultiplier,Limit,LimitAngle,LineHeight,LineOffset,LinearVelocity,LinearVelocity.X,LinearVelocity.Y,LinearVelocity.Z,Location,ManualControlMode,ManualInput_Drive,ManualInput_Pitch,ManualInput_Roll,ManualInput_Steer,MapVarRef,Mass,MassDistribution,MassOffset,MassOffset.X,MassOffset.Y,MassOffset.Z,MassSize,MassSize.X,MassSize.Y,MassSize.Z,Material,MaterialAlpha,MaterialSlider,Max,MaxDeflection,MaxDistance,MaxForce,MaxReplacements,Message,Min,Miss,MoveTarget,MoveTarget.X,MoveTarget.Y,MoveTarget.Z,MovementAmount,MovementGoalDummy,MovementRandomness,Name,NonFocusAzimuth,NonFocusVolumeAttenuation,NumberOfShots,OccupantCount,Occurrence,Offset,Offset.X,Offset.Y,Offset.Z,OnChanged,OnFallingEdge,OnFired,OnRisingEdge,OnTime,Origin,Origin.X,Origin.Y,Origin.Z,OuterConeAngle,Outline,OutlineColor,OutlineColor.A,OutlineColor.B,OutlineColor.G,OutlineColor.R,OutlineSize,OutlineWidth,Output,OutputB,OutputMax,OutputMin,Pause,PhysicalPitchDampingResponseTime,PhysicalRollDampingResponseTime,PhysicalYawDampingResponseTime,PickupAnimationAxis,PickupAnimationPhase,PickupBobHeight,PickupBobSpeed,PickupClass,PickupMeshColors,PickupMinigameResetRespawnDelay,PickupOffsetDirection,PickupOffsetDistance,PickupRespawnTime,PickupRotation,PickupRotation.Pitch,PickupRotation.Roll,PickupRotation.Yaw,PickupScale,PickupSpinSpeed,Pitch,PitchMultiplier,Pivot,Pivot.X,Pivot.Y,Play,Player,PlayerState,Point,Point.X,Point.Y,Point.Z,Position,Position.X,Position.Y,Power,Prefix,PressCount,PressSound,ProceduralSize,ProceduralSize.X,ProceduralSize.Y,ProceduralSize.Z,Projectile,ProjectileClass,ProjectileOverride,ProjectileType,PromptCustomLabel,Pulse,Query,R,RER_Input,RER_Output,Radius,RayTracingVisibility,ReactionTime,ReleaseSound,RepeatCount,RepeatDelay,RepeatTime,RepeatVariance,Replacement,Resource,RespawnTime,Restart,Resume,Right,Role,Roll,Rotation,Rotation.Pitch,Rotation.Roll,Rotation.W,Rotation.X,Rotation.Y,Rotation.Yaw,Rotation.Z,RoundNumber,RunSpeed,Scalar,Scale,Scale.X,Scale.Y,ScaleMultiplier,ScuffWidth,Search,SeatMode,SecondsToWait,Separator,Shading,ShadingWidth,ShadowColor,ShadowOffset,ShadowOffset.X,ShadowOffset.Y,SittingCharacter,Size,Skew,Skin,Skin.Parts,Slot,SmoothTime,Source,SourceRef,SpawnLocation,SpawnMargin,SpawnOffset,SpawnOffset.X,SpawnOffset.Y,SpawnOffset.Z,SpawnOffsetBias,SpawnOffsetRotation,SpawnOffsetRotation.Pitch,SpawnOffsetRotation.Roll,SpawnOffsetRotation.Yaw,SpawnVelocity,SpawnVelocity.X,SpawnVelocity.Y,SpawnVelocity.Z,SpawnedCharacter,SpawnedEntity,Speed,SpeedMultiplier,SpreadConeAngle,StallAngle,Start,Steer,SteerInterpSpeed,SteerLimitDegree,SteerLimitSpeedFalloff,SteerPower,SteerPowerMultiplier,Stop,Strength,Suffix,SuspensionDamping,SuspensionLength,SuspensionOffset,SuspensionStiffness,Tag,TagFilter,TankSteerSpeedMultiplier,Target,TargetAngle,TargetAxis,TargetAxis.X,TargetAxis.Y,TargetAxis.Z,TargetEntity,TargetPosition,Targeted,Team,TeamCollisionChannel,TeamName,Text,TextId,TextIdOut,ThirdPersonCameraRotation,ThirdPersonCameraRotation.Pitch,ThirdPersonCameraRotation.Roll,ThirdPersonCameraRotation.Yaw,ThirdPersonStartingZoom,ThisDestination,Throttle,ThrustMultiplier,TicksToWait,Time,Title,To,To.X,To.Y,To.Z,Tolerance,TopSpeed,TouchCount,Transition,Typeface,UnixEpoch,Uptime,UserId,UserName,Value,VarRef,Vector,Vector.X,Vector.Y,Vector.Z,VolumeMultiplier,W,WaterAbsorption,WaterAbsorption.X,WaterAbsorption.Y,WaterAbsorption.Z,WaterDriveForce,WaterFogAmbientColor,WaterFogAmbientColor.A,WaterFogAmbientColor.B,WaterFogAmbientColor.G,WaterFogAmbientColor.R,WaterFogAmbientScale,WaterFogIntensity,WaterFogScatteringColor,WaterFogScatteringColor.A,WaterFogScatteringColor.B,WaterFogScatteringColor.G,WaterFogScatteringColor.R,WaterFogScatteringScale,WaterScattering,WaterScattering.X,WaterScattering.Y,WaterScattering.Z,WaterSteeringForce,Weapon,WeaponName,WeaponNameThatJustHit,WeaponSpeedMultiplier,WeaponThatJustHit,WheelFrictionMultiplier,WidthScale,WorldPosition,WorldPosition.X,WorldPosition.Y,WorldPosition.Z,WrapWidth,X,Y,Yaw,Z,ZOrder,ZeroSecondsToWait,ZeroTicksToWait,Zone,ZoneEndDistance,ZoneRef,ZoneStartDistance,ZoneWindForce,bActiveBot,bAlignToWedge,bAllowEngineSteerCorrect,bAllowHeldItems,bAllowNearbyInteraction,bAnglesArePercentages,bAutoRight,bAutodiscoverAerodynamicSurfaces,bAutodiscoverGyroscopes,bAutodiscoverThrusters,bAutodiscoverWheels,bBackVision,bCanBrake,bCanJump,bCanRespawn,bCanTargetBots,bCanTargetPlayers,bCaseSensitive,bCastShadows,bCollisionEnabled,bCollisionEnabled_Interaction,bCollisionEnabled_Physics,bCollisionEnabled_Player,bCollisionEnabled_Player1,bCollisionEnabled_Player2,bCollisionEnabled_Player3,bCollisionEnabled_Weapon,bCond,bDeleteBot,bDescending,bDetectBricks,bDetectEntities,bDetectMap,bDetectPhysics,bDetectPlayers,bDetectPlayers1,bDetectPlayers2,bDetectPlayers3,bDetectPlayers4,bDetectProjectiles,bDisableInWorldControlDiagnostics,bDiscoverable,bDriveWhenNotAttachedToEngine,bEnable,bEnableAerodynamicRateDamping,bEnableAirBraking,bEnableGlideTrim,bEnableManualControl,bEnableRepeat,bEnabled,bEnforceFireRate,bFlashIfUnchanged,bFlipShading,bFlyingGroundControls,bForeground,bFound,bFrozen,bHasPermission,bHasRole,bHeld,bHiddenInteraction,bIgnoreOwningGrid,bIncludeBuilderMode,bInput,bInputA,bInputB,bIsBuildingZone,bIsEmpty,bIsLooseZone,bIsOccupied,bIsShareZone,bIsTrusted,bJustHit,bLimitAngle,bManualInput_Brake,bMatchBrickShape,bMiteredOutline,bOccupied,bOutOfBounds,bOutput,bOverrideColor,bOverrideOutlineColor,bOverridePickupColors,bPermissionEnable,bPickupAnimationAxisLocal,bPickupAnimationEnabled,bPickupAutoDisableOnPickup,bPickupEnabled,bPickupRespawnOnMinigameReset,bPinPlayerToTeam,bPinned,bPositionsArePercentages,bPressedC,bPressedE,bPressedLeftMouse,bPressedQ,bPressedRightMouse,bPulseOnChange,bPulseOnFallingEdge,bPulseOnRisingEdge,bRelative,bRenderTranslucentWhenDisabled,bResult,bReversed,bRollCameraInThirdPerson,bRotatePlayerGravityOnSpawn,bScaleCameraOriginOffsetWithZoom,bSelectB,bSharpCorners,bSharpOutlines,bShowPickupEnabled,bSpatialization,bSpawnEnable,bSpawnLight,bSpreadBiasedTowardsCenter,bStalling,bSteerEnabled,bStickyPlaneThrottle,bStopped,bSuccess,bSuspensionEnabled,bSwap,bTankSteering,bTeamCollision,bTeamCollision1,bTeamCollision2,bTeamCollision3,bTeamWinsInstead,bTouching,bUseBrickColor,bUseUTC,bVisibility,bVisionRaycasting,bWater,bWelded,bWheelVisible,bWrap".split(","), sa = /* @__PURE__ */ new Map([["Entity_DynamicBrickGrid", "BrickGridDynamicActor"], ["Entity_MicrochipDynamicBrickGrid", "BP_MicrochipBrickGridDynamicActor_C"]]), ca = new Map(Object.entries({
	BrickComponentType_AerodynamicSurface: {
		bricks: [],
		inputs: [
			"AerodynamicDirection",
			"Control_DriveAndSteer",
			"Deflection",
			"DragCoefficient",
			"ForceApplication",
			"LiftCoefficient",
			"LiftMultiplier",
			"MaxDeflection",
			"Role",
			"StallAngle",
			"bDiscoverable",
			"bEnabled"
		],
		outputs: []
	},
	BrickComponentType_Clock: {
		bricks: ["B_1x1_Gate_Clock"],
		inputs: ["IntervalSeconds", "bEnabled"],
		outputs: ["Pulse"]
	},
	BrickComponentType_ExplosionSpawner: {
		bricks: [],
		inputs: [
			"DamageMultiplier",
			"Explode",
			"Instigator",
			"ProjectileType",
			"ScaleMultiplier",
			"SpawnOffset",
			"SpawnOffset.X",
			"SpawnOffset.Y",
			"SpawnOffset.Z"
		],
		outputs: []
	},
	BrickComponentType_Internal_AerodynamicSurface: {
		bricks: ["PB_AerodynamicSurface"],
		inputs: [
			"Control_DriveAndSteer",
			"Deflection",
			"DragCoefficient",
			"ForceApplication",
			"LiftCoefficient",
			"LiftMultiplier",
			"MaxDeflection",
			"Role",
			"StallAngle",
			"bDiscoverable",
			"bEnabled"
		],
		outputs: []
	},
	BrickComponentType_Internal_AerodynamicSurfaceVertical: {
		bricks: ["PB_AerodynamicSurfaceVertical"],
		inputs: [
			"Control_DriveAndSteer",
			"Deflection",
			"DragCoefficient",
			"ForceApplication",
			"LiftCoefficient",
			"LiftMultiplier",
			"MaxDeflection",
			"Role",
			"StallAngle",
			"bDiscoverable",
			"bEnabled"
		],
		outputs: []
	},
	BrickComponentType_Internal_CharacterZoneEvent_Entered: {
		bricks: ["B_1x1_Gate_Internal_CharacterZoneEvent_Entered"],
		inputs: [
			"TagFilter",
			"Zone",
			"bCollisionEnabled_Player",
			"bCollisionEnabled_Player1",
			"bCollisionEnabled_Player2",
			"bCollisionEnabled_Player3"
		],
		outputs: ["Character", "Exec"]
	},
	BrickComponentType_Internal_CharacterZoneEvent_Left: {
		bricks: ["B_1x1_Gate_Internal_CharacterZoneEvent_Left"],
		inputs: [
			"TagFilter",
			"Zone",
			"bCollisionEnabled_Player",
			"bCollisionEnabled_Player1",
			"bCollisionEnabled_Player2",
			"bCollisionEnabled_Player3"
		],
		outputs: ["Character", "Exec"]
	},
	BrickComponentType_Internal_EntityZoneEvent_Entered: {
		bricks: ["B_1x1_Gate_Internal_EntityZoneEvent_Entered"],
		inputs: ["TagFilter", "Zone"],
		outputs: ["Entity", "Exec"]
	},
	BrickComponentType_Internal_EntityZoneEvent_Left: {
		bricks: ["B_1x1_Gate_Internal_EntityZoneEvent_Left"],
		inputs: ["TagFilter", "Zone"],
		outputs: ["Entity", "Exec"]
	},
	BrickComponentType_Internal_MicrochipInput: {
		bricks: ["B_1x1_Gate_MicrochipInput"],
		inputs: ["RER_Input"],
		outputs: ["RER_Output"]
	},
	BrickComponentType_Internal_MicrochipOutput: {
		bricks: ["B_1x1_Gate_MicrochipOutput"],
		inputs: ["RER_Input"],
		outputs: ["RER_Output"]
	},
	BrickComponentType_Internal_ProjectileZoneEvent_Entered: {
		bricks: ["B_1x1_Gate_Internal_ProjectileZoneEvent_Entered"],
		inputs: ["Zone"],
		outputs: [
			"Character",
			"Exec",
			"Projectile",
			"Weapon",
			"WeaponName"
		]
	},
	BrickComponentType_Internal_ProjectileZoneEvent_Left: {
		bricks: ["B_1x1_Gate_Internal_ProjectileZoneEvent_Left"],
		inputs: ["Zone"],
		outputs: [
			"Character",
			"Exec",
			"Projectile",
			"Weapon",
			"WeaponName"
		]
	},
	BrickComponentType_Internal_ReadBrickGrid: {
		bricks: ["B_1x1_Gate_Internal_ReadBrickGrid"],
		inputs: [],
		outputs: ["BrickGrid"]
	},
	BrickComponentType_Internal_TeleportDestination: {
		bricks: ["B_DestinationPoint"],
		inputs: [],
		outputs: ["ThisDestination"]
	},
	BrickComponentType_Internal_ZoneEvent_BrickChanged: {
		bricks: ["B_1x1_Gate_Internal_ZoneEvent_BrickChanged"],
		inputs: ["Zone"],
		outputs: ["Exec"]
	},
	BrickComponentType_Internal_ZoneEvent_BrickRemoved: {
		bricks: ["B_1x1_Gate_Internal_ZoneEvent_BrickRemoved"],
		inputs: ["Zone"],
		outputs: ["Exec"]
	},
	BrickComponentType_PrefabSpawn: {
		bricks: ["B_Spawn_Point_Prefab"],
		inputs: [
			"RespawnTime",
			"SpawnOffset",
			"SpawnOffset.X",
			"SpawnOffset.Y",
			"SpawnOffset.Z",
			"SpawnOffsetRotation",
			"SpawnOffsetRotation.Pitch",
			"SpawnOffsetRotation.Roll",
			"SpawnOffsetRotation.Yaw",
			"SpawnVelocity",
			"SpawnVelocity.X",
			"SpawnVelocity.Y",
			"SpawnVelocity.Z",
			"bSpawnEnable"
		],
		outputs: ["SpawnedEntity"]
	},
	BrickComponentType_WireGraph_AudioReference: {
		bricks: ["B_1x1_Gate_AudioReference"],
		inputs: [],
		outputs: ["Value"]
	},
	BrickComponentType_WireGraph_BrickAssetReference: {
		bricks: ["B_1x1_Gate_BrickAssetReference"],
		inputs: [],
		outputs: ["Value"]
	},
	BrickComponentType_WireGraph_DeltaTime: {
		bricks: ["B_1x1_Gate_DeltaTime"],
		inputs: [],
		outputs: ["DeltaTime"]
	},
	BrickComponentType_WireGraph_EntityTypeReference: {
		bricks: ["B_1x1_Gate_EntityTypeReference"],
		inputs: [],
		outputs: ["Value"]
	},
	BrickComponentType_WireGraph_Exec_ArrayVar_Append: {
		bricks: ["B_1x1_Gate_Exec_ArrayVar_Append"],
		inputs: [
			"ArrayVarRef",
			"Exec",
			"SourceRef"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_ArrayVar_Average: {
		bricks: ["B_1x1_Gate_Exec_ArrayVar_Average"],
		inputs: ["ArrayVarRef", "Exec"],
		outputs: [
			"ExecOut",
			"Value",
			"bIsEmpty"
		]
	},
	BrickComponentType_WireGraph_Exec_ArrayVar_Clear: {
		bricks: ["B_1x1_Gate_Exec_ArrayVar_Clear"],
		inputs: ["ArrayVarRef", "Exec"],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_ArrayVar_CopyFrom: {
		bricks: ["B_1x1_Gate_Exec_ArrayVar_CopyFrom"],
		inputs: [
			"ArrayVarRef",
			"Exec",
			"SourceRef"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_ArrayVar_Fill: {
		bricks: ["B_1x1_Gate_Exec_ArrayVar_Fill"],
		inputs: [
			"ArrayVarRef",
			"Exec",
			"Value"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_ArrayVar_Find: {
		bricks: ["B_1x1_Gate_Exec_ArrayVar_Find"],
		inputs: [
			"ArrayVarRef",
			"Exec",
			"Value"
		],
		outputs: [
			"ExecOut",
			"Index",
			"bFound"
		]
	},
	BrickComponentType_WireGraph_Exec_ArrayVar_Get: {
		bricks: ["B_1x1_Gate_Exec_ArrayVar_Get"],
		inputs: [
			"ArrayVarRef",
			"Exec",
			"Index"
		],
		outputs: [
			"ExecOut",
			"Value",
			"bOutOfBounds"
		]
	},
	BrickComponentType_WireGraph_Exec_ArrayVar_GetLength: {
		bricks: ["B_1x1_Gate_Exec_ArrayVar_GetLength"],
		inputs: ["ArrayVarRef", "Exec"],
		outputs: ["ExecOut", "Length"]
	},
	BrickComponentType_WireGraph_Exec_ArrayVar_Insert: {
		bricks: ["B_1x1_Gate_Exec_ArrayVar_Insert"],
		inputs: [
			"ArrayVarRef",
			"Exec",
			"Index",
			"Value"
		],
		outputs: ["ExecOut", "bOutOfBounds"]
	},
	BrickComponentType_WireGraph_Exec_ArrayVar_Max: {
		bricks: ["B_1x1_Gate_Exec_ArrayVar_Max"],
		inputs: ["ArrayVarRef", "Exec"],
		outputs: [
			"ExecOut",
			"Value",
			"bIsEmpty"
		]
	},
	BrickComponentType_WireGraph_Exec_ArrayVar_Min: {
		bricks: ["B_1x1_Gate_Exec_ArrayVar_Min"],
		inputs: ["ArrayVarRef", "Exec"],
		outputs: [
			"ExecOut",
			"Value",
			"bIsEmpty"
		]
	},
	BrickComponentType_WireGraph_Exec_ArrayVar_Pop: {
		bricks: ["B_1x1_Gate_Exec_ArrayVar_Pop"],
		inputs: ["ArrayVarRef", "Exec"],
		outputs: [
			"ExecOut",
			"Value",
			"bIsEmpty"
		]
	},
	BrickComponentType_WireGraph_Exec_ArrayVar_Push: {
		bricks: ["B_1x1_Gate_Exec_ArrayVar_Push"],
		inputs: [
			"ArrayVarRef",
			"Exec",
			"Value"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_ArrayVar_RemoveAtIndex: {
		bricks: ["B_1x1_Gate_Exec_ArrayVar_RemoveAtIndex"],
		inputs: [
			"ArrayVarRef",
			"Exec",
			"Index"
		],
		outputs: ["ExecOut", "bOutOfBounds"]
	},
	BrickComponentType_WireGraph_Exec_ArrayVar_Resize: {
		bricks: ["B_1x1_Gate_Exec_ArrayVar_Resize"],
		inputs: [
			"ArrayVarRef",
			"Exec",
			"Size",
			"Value"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_ArrayVar_Reverse: {
		bricks: ["B_1x1_Gate_Exec_ArrayVar_Reverse"],
		inputs: ["ArrayVarRef", "Exec"],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_ArrayVar_SetAtIndex: {
		bricks: ["B_1x1_Gate_Exec_ArrayVar_SetAtIndex"],
		inputs: [
			"ArrayVarRef",
			"Exec",
			"Index",
			"Value"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_ArrayVar_Shuffle: {
		bricks: ["B_1x1_Gate_Exec_ArrayVar_Shuffle"],
		inputs: ["ArrayVarRef", "Exec"],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_ArrayVar_Slice: {
		bricks: ["B_1x1_Gate_Exec_ArrayVar_Slice"],
		inputs: [
			"ArrayVarRef",
			"Count",
			"Exec",
			"SourceRef",
			"Start"
		],
		outputs: ["ExecOut", "bOutOfBounds"]
	},
	BrickComponentType_WireGraph_Exec_ArrayVar_Sort: {
		bricks: ["B_1x1_Gate_Exec_ArrayVar_Sort"],
		inputs: [
			"ArrayVarRef",
			"Exec",
			"bDescending"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_ArrayVar_SortMultiple: {
		bricks: ["B_1x1_Gate_Exec_ArrayVar_SortMultiple"],
		inputs: [
			"ArrayVarRef",
			"ArrayVarRef2",
			"ArrayVarRef3",
			"ArrayVarRef4",
			"ArrayVarRef5",
			"ArrayVarRef6",
			"ArrayVarRef7",
			"ArrayVarRef8",
			"Exec",
			"bDescending"
		],
		outputs: ["ExecOut", "bSuccess"]
	},
	BrickComponentType_WireGraph_Exec_ArrayVar_Sum: {
		bricks: ["B_1x1_Gate_Exec_ArrayVar_Sum"],
		inputs: ["ArrayVarRef", "Exec"],
		outputs: ["ExecOut", "Value"]
	},
	BrickComponentType_WireGraph_Exec_ArrayVar_Swap: {
		bricks: ["B_1x1_Gate_Exec_ArrayVar_Swap"],
		inputs: [
			"ArrayVarRef",
			"Exec",
			"IndexA",
			"IndexB"
		],
		outputs: ["ExecOut", "bOutOfBounds"]
	},
	BrickComponentType_WireGraph_Exec_Branch: {
		bricks: ["B_1x1_Gate_Exec_Branch"],
		inputs: ["Exec", "bCond"],
		outputs: ["ExecOutA", "ExecOutB"]
	},
	BrickComponentType_WireGraph_Exec_Character_AddInventoryBrick: {
		bricks: ["B_1x1_Gate_Exec_Character_AddInventoryBrick"],
		inputs: [
			"BrickAsset",
			"Character",
			"Exec",
			"ProceduralSize",
			"ProceduralSize.X",
			"ProceduralSize.Y",
			"ProceduralSize.Z"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Character_AddInventoryEntity: {
		bricks: ["B_1x1_Gate_Exec_Character_AddInventoryEntity"],
		inputs: [
			"Character",
			"EntityType",
			"Exec"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Character_AddInventoryEntry: {
		bricks: ["B_1x1_Gate_Exec_Character_AddInventoryEntry"],
		inputs: ["Character", "Exec"],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Character_AddInventoryItem: {
		bricks: ["B_1x1_Gate_Exec_Character_AddInventoryItem"],
		inputs: [
			"Character",
			"Exec",
			"Item"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Character_AddInventoryItemAdv: {
		bricks: ["B_1x1_Gate_Exec_Character_AddInventoryItemAdv"],
		inputs: [
			"Character",
			"DamageMultiplier",
			"Exec",
			"ItemNameOverride",
			"ItemScale",
			"ItemType",
			"ProjectileOverride",
			"WeaponSpeedMultiplier"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Character_GetAim: {
		bricks: ["B_1x1_Gate_Exec_Character_GetAim"],
		inputs: ["Character", "Exec"],
		outputs: [
			"Direction",
			"ExecOut",
			"Origin"
		]
	},
	BrickComponentType_WireGraph_Exec_Character_GetAmmo: {
		bricks: ["B_1x1_Gate_Exec_Character_GetAmmo"],
		inputs: [
			"Character",
			"Exec",
			"Resource"
		],
		outputs: ["Amount", "ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Character_GetCurrentInventorySlot: {
		bricks: ["B_1x1_Gate_Exec_Character_GetCurrentInventorySlot"],
		inputs: ["Character", "Exec"],
		outputs: ["ExecOut", "Slot"]
	},
	BrickComponentType_WireGraph_Exec_Character_GetDamage: {
		bricks: ["B_1x1_Gate_Exec_Character_GetDamage"],
		inputs: ["Character", "Exec"],
		outputs: [
			"Damage",
			"DamageLimit",
			"ExecOut"
		]
	},
	BrickComponentType_WireGraph_Exec_Character_GetFromController: {
		bricks: ["B_1x1_Gate_Exec_Character_GetFromController"],
		inputs: ["Exec", "PlayerState"],
		outputs: ["Character", "ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Character_GetInventoryEntry: {
		bricks: ["B_1x1_Gate_Exec_Character_GetInventoryEntry"],
		inputs: [
			"Character",
			"Exec",
			"Slot"
		],
		outputs: [
			"BrickAsset",
			"EntityType",
			"ExecOut",
			"Item"
		]
	},
	BrickComponentType_WireGraph_Exec_Character_GetWeaponChamberAmmo: {
		bricks: ["B_1x1_Gate_Exec_Character_GetWeaponChamberAmmo"],
		inputs: [
			"Character",
			"Exec",
			"Resource",
			"Slot"
		],
		outputs: ["Amount", "ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Character_GrantAmmo: {
		bricks: ["B_1x1_Gate_Exec_Character_GrantAmmo"],
		inputs: [
			"Amount",
			"Character",
			"Exec",
			"Resource"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Character_IncDamage: {
		bricks: ["B_1x1_Gate_Exec_Character_IncDamage"],
		inputs: [
			"Amount",
			"Character",
			"Exec"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Character_IncWeaponChamberAmmo: {
		bricks: ["B_1x1_Gate_Exec_Character_IncWeaponChamberAmmo"],
		inputs: [
			"Amount",
			"Character",
			"Exec",
			"Resource",
			"Slot"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Character_SetAmmo: {
		bricks: ["B_1x1_Gate_Exec_Character_SetAmmo"],
		inputs: [
			"Amount",
			"Character",
			"Exec",
			"Resource"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Character_SetDamage: {
		bricks: ["B_1x1_Gate_Exec_Character_SetDamage"],
		inputs: [
			"Character",
			"Damage",
			"Exec"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Character_SetInventoryBrick: {
		bricks: ["B_1x1_Gate_Exec_Character_SetInventoryBrick"],
		inputs: [
			"BrickAsset",
			"Character",
			"Exec",
			"ProceduralSize",
			"ProceduralSize.X",
			"ProceduralSize.Y",
			"ProceduralSize.Z",
			"Slot"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Character_SetInventoryEntity: {
		bricks: ["B_1x1_Gate_Exec_Character_SetInventoryEntity"],
		inputs: [
			"Character",
			"EntityType",
			"Exec",
			"Slot"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Character_SetInventoryEntry: {
		bricks: ["B_1x1_Gate_Exec_Character_SetInventoryEntry"],
		inputs: [
			"Character",
			"Exec",
			"Slot"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Character_SetInventoryItem: {
		bricks: ["B_1x1_Gate_Exec_Character_SetInventoryItem"],
		inputs: [
			"Character",
			"Exec",
			"Item",
			"Slot"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Character_SetInventoryItemAdv: {
		bricks: ["B_1x1_Gate_Exec_Character_SetInventoryItemAdv"],
		inputs: [
			"Character",
			"DamageMultiplier",
			"Exec",
			"ItemNameOverride",
			"ItemScale",
			"ItemType",
			"ProjectileOverride",
			"Slot",
			"WeaponSpeedMultiplier"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Character_SetTempPermission: {
		bricks: ["B_1x1_Gate_Exec_Character_SetTempPermission"],
		inputs: [
			"Character",
			"Exec",
			"bPermissionEnable"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Character_SetWeaponChamberAmmo: {
		bricks: ["B_1x1_Gate_Exec_Character_SetWeaponChamberAmmo"],
		inputs: [
			"Amount",
			"Character",
			"Exec",
			"Resource",
			"Slot"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Character_ShowHint: {
		bricks: ["B_1x1_Gate_Exec_Character_ShowHint"],
		inputs: ["Character", "Exec"],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_ChatCommand: {
		bricks: ["B_1x1_Gate_Exec_ChatCommand"],
		inputs: [],
		outputs: [
			"Arguments",
			"ExecOut",
			"PlayerState"
		]
	},
	BrickComponentType_WireGraph_Exec_Cycle: {
		bricks: ["B_1x1_Gate_Exec_Cycle"],
		inputs: [
			"Count",
			"Exec",
			"ExecDown"
		],
		outputs: [
			"ExecOut",
			"ExecOutDown",
			"Output"
		]
	},
	BrickComponentType_WireGraph_Exec_Entity_AddLocationRotation: {
		bricks: ["B_1x1_Gate_Exec_Entity_AddLocationRotation"],
		inputs: [
			"Entity",
			"Exec",
			"Rotation",
			"Rotation.Pitch",
			"Rotation.Roll",
			"Rotation.Yaw",
			"Vector",
			"Vector.X",
			"Vector.Y",
			"Vector.Z"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Entity_AddVelocity: {
		bricks: ["B_1x1_Gate_Exec_Entity_AddVelocity"],
		inputs: [
			"Entity",
			"Exec",
			"Rotation",
			"Rotation.X",
			"Rotation.Y",
			"Rotation.Z",
			"Vector",
			"Vector.X",
			"Vector.Y",
			"Vector.Z"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Entity_DestroySpawned: {
		bricks: ["B_1x1_Gate_Exec_Entity_DestroySpawned"],
		inputs: ["Entity", "Exec"],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Entity_DestroySpawnedPrefab: {
		bricks: ["B_1x1_Gate_Exec_Entity_DestroySpawnedPrefab"],
		inputs: ["Entity", "Exec"],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Entity_GetAngularVelocity: {
		bricks: ["B_1x1_Gate_Exec_Entity_GetAngularVelocity"],
		inputs: ["Entity", "Exec"],
		outputs: ["AngularVelocity", "ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Entity_GetLinearVelocity: {
		bricks: ["B_1x1_Gate_Exec_Entity_GetLinearVelocity"],
		inputs: ["Entity", "Exec"],
		outputs: ["ExecOut", "LinearVelocity"]
	},
	BrickComponentType_WireGraph_Exec_Entity_GetLocation: {
		bricks: ["B_1x1_Gate_Exec_Entity_GetLocation"],
		inputs: ["Entity", "Exec"],
		outputs: ["ExecOut", "Vector"]
	},
	BrickComponentType_WireGraph_Exec_Entity_GetLocationRotation: {
		bricks: ["B_1x1_Gate_Exec_Entity_GetLocationRotation"],
		inputs: ["Entity", "Exec"],
		outputs: [
			"ExecOut",
			"Rotation",
			"Vector"
		]
	},
	BrickComponentType_WireGraph_Exec_Entity_GetRotation: {
		bricks: ["B_1x1_Gate_Exec_Entity_GetRotation"],
		inputs: ["Entity", "Exec"],
		outputs: ["ExecOut", "Rotation"]
	},
	BrickComponentType_WireGraph_Exec_Entity_GetSpeed: {
		bricks: ["B_1x1_Gate_Exec_Entity_GetSpeed"],
		inputs: ["Entity", "Exec"],
		outputs: ["ExecOut", "Speed"]
	},
	BrickComponentType_WireGraph_Exec_Entity_GetTag: {
		bricks: ["B_1x1_Gate_Exec_Entity_GetTag"],
		inputs: ["Entity", "Exec"],
		outputs: ["ExecOut", "Tag"]
	},
	BrickComponentType_WireGraph_Exec_Entity_GetTeam: {
		bricks: ["B_1x1_Gate_Exec_Entity_GetTeam"],
		inputs: ["Entity", "Exec"],
		outputs: ["ExecOut", "Team"]
	},
	BrickComponentType_WireGraph_Exec_Entity_GetVelocity: {
		bricks: ["B_1x1_Gate_Exec_Entity_GetVelocity"],
		inputs: ["Entity", "Exec"],
		outputs: [
			"ExecOut",
			"Rotation",
			"Vector"
		]
	},
	BrickComponentType_WireGraph_Exec_Entity_GetVelocityAtPoint: {
		bricks: ["B_1x1_Gate_Exec_Entity_GetVelocityAtPoint"],
		inputs: [
			"Entity",
			"Exec",
			"Point",
			"Point.X",
			"Point.Y",
			"Point.Z"
		],
		outputs: ["ExecOut", "LinearVelocity"]
	},
	BrickComponentType_WireGraph_Exec_Entity_IsFrozen: {
		bricks: ["B_1x1_Gate_Exec_Entity_IsFrozen"],
		inputs: ["Entity", "Exec"],
		outputs: ["ExecOut", "bFrozen"]
	},
	BrickComponentType_WireGraph_Exec_Entity_RelativeTeleport: {
		bricks: ["B_1x1_Gate_Exec_Entity_RelativeTeleport"],
		inputs: [
			"Destination",
			"Entity",
			"Exec",
			"Source"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Entity_SetAngularVelocity: {
		bricks: ["B_1x1_Gate_Exec_Entity_SetAngularVelocity"],
		inputs: [
			"AngularVelocity",
			"AngularVelocity.X",
			"AngularVelocity.Y",
			"AngularVelocity.Z",
			"Entity",
			"Exec"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Entity_SetFrozen: {
		bricks: ["B_1x1_Gate_Exec_Entity_SetFrozen"],
		inputs: [
			"Entity",
			"Exec",
			"bFrozen"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Entity_SetGravityDirection: {
		bricks: ["B_1x1_Gate_Exec_Entity_SetGravityDirection"],
		inputs: [
			"Entity",
			"Exec",
			"Rotation",
			"Rotation.Pitch",
			"Rotation.Roll",
			"Rotation.Yaw"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Entity_SetLinearVelocity: {
		bricks: ["B_1x1_Gate_Exec_Entity_SetLinearVelocity"],
		inputs: [
			"Entity",
			"Exec",
			"LinearVelocity",
			"LinearVelocity.X",
			"LinearVelocity.Y",
			"LinearVelocity.Z"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Entity_SetLocation: {
		bricks: ["B_1x1_Gate_Exec_Entity_SetLocation"],
		inputs: [
			"Entity",
			"Exec",
			"Vector",
			"Vector.X",
			"Vector.Y",
			"Vector.Z"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Entity_SetLocationRotation: {
		bricks: ["B_1x1_Gate_Exec_Entity_SetLocationRotation"],
		inputs: [
			"Entity",
			"Exec",
			"Rotation",
			"Rotation.Pitch",
			"Rotation.Roll",
			"Rotation.Yaw",
			"Vector",
			"Vector.X",
			"Vector.Y",
			"Vector.Z"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Entity_SetRotation: {
		bricks: ["B_1x1_Gate_Exec_Entity_SetRotation"],
		inputs: [
			"Entity",
			"Exec",
			"Rotation",
			"Rotation.Pitch",
			"Rotation.Roll",
			"Rotation.Yaw"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Entity_SetTag: {
		bricks: ["B_1x1_Gate_Exec_Entity_SetTag"],
		inputs: [
			"Entity",
			"Exec",
			"Tag"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Entity_SetTeam: {
		bricks: ["B_1x1_Gate_Exec_Entity_SetTeam"],
		inputs: [
			"Entity",
			"Exec",
			"Team"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Entity_SetVelocity: {
		bricks: ["B_1x1_Gate_Exec_Entity_SetVelocity"],
		inputs: [
			"Entity",
			"Exec",
			"Rotation",
			"Rotation.X",
			"Rotation.Y",
			"Rotation.Z",
			"Vector",
			"Vector.X",
			"Vector.Y",
			"Vector.Z"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Entity_Teleport: {
		bricks: ["B_1x1_Gate_Exec_Entity_Teleport"],
		inputs: [
			"Destination",
			"Entity",
			"Exec"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Gamemode_BroadcastChatMessage: {
		bricks: ["B_1x1_Gate_Exec_Gamemode_BroadcastChatMessage"],
		inputs: ["Exec", "Message"],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Gamemode_BroadcastStatusMessage: {
		bricks: ["B_1x1_Gate_Exec_Gamemode_BroadcastStatusMessage"],
		inputs: [
			"Exec",
			"Message",
			"bFlashIfUnchanged"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Gamemode_FillArrayFromPlayers: {
		bricks: ["B_1x1_Gate_Exec_Gamemode_FillArrayFromPlayers"],
		inputs: [
			"ArrayVarRef",
			"Exec",
			"bIncludeBuilderMode"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Gamemode_FillArrayFromTeamMembers: {
		bricks: ["B_1x1_Gate_Exec_Gamemode_FillArrayFromTeamMembers"],
		inputs: [
			"ArrayVarRef",
			"Exec",
			"Team"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Gamemode_GetCurrentRound: {
		bricks: ["B_1x1_Gate_Exec_Gamemode_GetCurrentRound"],
		inputs: ["Exec"],
		outputs: ["ExecOut", "RoundNumber"]
	},
	BrickComponentType_WireGraph_Exec_Gamemode_GetLeaderboardValue: {
		bricks: ["B_1x1_Gate_Exec_Gamemode_GetLeaderboardValue"],
		inputs: [
			"Exec",
			"Key",
			"PlayerState"
		],
		outputs: ["ExecOut", "Value"]
	},
	BrickComponentType_WireGraph_Exec_Gamemode_GetTeam: {
		bricks: ["B_1x1_Gate_Exec_Gamemode_GetTeam"],
		inputs: ["Character", "Exec"],
		outputs: ["ExecOut", "Team"]
	},
	BrickComponentType_WireGraph_Exec_Gamemode_GetTeamByName: {
		bricks: ["B_1x1_Gate_Exec_Gamemode_GetTeamByName"],
		inputs: ["Exec", "TeamName"],
		outputs: ["ExecOut", "Team"]
	},
	BrickComponentType_WireGraph_Exec_Gamemode_GetTeamLeaderboardValue: {
		bricks: ["B_1x1_Gate_Exec_Gamemode_GetTeamLeaderboardValue"],
		inputs: [
			"Exec",
			"Key",
			"Team"
		],
		outputs: ["ExecOut", "Value"]
	},
	BrickComponentType_WireGraph_Exec_Gamemode_GetTeamName: {
		bricks: ["B_1x1_Gate_Exec_Gamemode_GetTeamName"],
		inputs: ["Exec", "Team"],
		outputs: ["ExecOut", "Name"]
	},
	BrickComponentType_WireGraph_Exec_Gamemode_IncrementLeaderboardValue: {
		bricks: ["B_1x1_Gate_Exec_Gamemode_IncrementLeaderboardValue"],
		inputs: [
			"Exec",
			"Key",
			"PlayerState",
			"Value"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Gamemode_IncrementTeamLeaderboardValue: {
		bricks: ["B_1x1_Gate_Exec_Gamemode_IncrementTeamLeaderboardValue"],
		inputs: [
			"Exec",
			"Key",
			"Team",
			"Value"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Gamemode_PlayerWins: {
		bricks: ["B_1x1_Gate_Exec_Gamemode_PlayerWins"],
		inputs: [
			"Exec",
			"Player",
			"bTeamWinsInstead"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Gamemode_SetLeaderboardValue: {
		bricks: ["B_1x1_Gate_Exec_Gamemode_SetLeaderboardValue"],
		inputs: [
			"Exec",
			"Key",
			"PlayerState",
			"Value"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Gamemode_SetTeam: {
		bricks: ["B_1x1_Gate_Exec_Gamemode_SetTeam"],
		inputs: [
			"Exec",
			"PlayerState",
			"Team",
			"bPinPlayerToTeam"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Gamemode_SetTeamLeaderboardValue: {
		bricks: ["B_1x1_Gate_Exec_Gamemode_SetTeamLeaderboardValue"],
		inputs: [
			"Exec",
			"Key",
			"Team",
			"Value"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Gamemode_SetTeamPinned: {
		bricks: ["B_1x1_Gate_Exec_Gamemode_SetTeamPinned"],
		inputs: [
			"Exec",
			"PlayerState",
			"bPinned"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Gamemode_TeamWins: {
		bricks: ["B_1x1_Gate_Exec_Gamemode_TeamWins"],
		inputs: ["Exec", "Team"],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_GetInputs: {
		bricks: ["B_1x1_Gate_Exec_GetInputs"],
		inputs: ["Exec", "Player"],
		outputs: [
			"ExecOut",
			"InputForward",
			"InputMouseWheel",
			"InputPitch",
			"InputRight",
			"InputRoll",
			"InputUp",
			"InputYaw",
			"bPressedC",
			"bPressedE",
			"bPressedLeftMouse",
			"bPressedQ",
			"bPressedRightMouse"
		]
	},
	BrickComponentType_WireGraph_Exec_GetOwnTransform: {
		bricks: ["B_1x1_Gate_Exec_GetOwnTransform"],
		inputs: ["Exec"],
		outputs: [
			"ExecOut",
			"Location",
			"Rotation"
		]
	},
	BrickComponentType_WireGraph_Exec_MapVar_Clear: {
		bricks: ["B_1x1_Gate_Exec_MapVar_Clear"],
		inputs: ["Exec", "MapVarRef"],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_MapVar_CopyFrom: {
		bricks: ["B_1x1_Gate_Exec_MapVar_CopyFrom"],
		inputs: [
			"Exec",
			"MapVarRef",
			"SourceRef"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_MapVar_Get: {
		bricks: ["B_1x1_Gate_Exec_MapVar_Get"],
		inputs: [
			"Exec",
			"Key",
			"MapVarRef"
		],
		outputs: [
			"ExecOut",
			"Value",
			"bFound"
		]
	},
	BrickComponentType_WireGraph_Exec_MapVar_GetKeys: {
		bricks: ["B_1x1_Gate_Exec_MapVar_GetKeys"],
		inputs: [
			"ArrayVarRef",
			"Exec",
			"MapVarRef"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_MapVar_GetLength: {
		bricks: ["B_1x1_Gate_Exec_MapVar_GetLength"],
		inputs: ["Exec", "MapVarRef"],
		outputs: ["ExecOut", "Length"]
	},
	BrickComponentType_WireGraph_Exec_MapVar_GetValues: {
		bricks: ["B_1x1_Gate_Exec_MapVar_GetValues"],
		inputs: [
			"ArrayVarRef",
			"Exec",
			"MapVarRef"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_MapVar_Has: {
		bricks: ["B_1x1_Gate_Exec_MapVar_Has"],
		inputs: [
			"Exec",
			"Key",
			"MapVarRef"
		],
		outputs: ["ExecOut", "bFound"]
	},
	BrickComponentType_WireGraph_Exec_MapVar_Remove: {
		bricks: ["B_1x1_Gate_Exec_MapVar_Remove"],
		inputs: [
			"Exec",
			"Key",
			"MapVarRef"
		],
		outputs: ["ExecOut", "bFound"]
	},
	BrickComponentType_WireGraph_Exec_MapVar_Set: {
		bricks: ["B_1x1_Gate_Exec_MapVar_Set"],
		inputs: [
			"Exec",
			"Key",
			"MapVarRef",
			"Value"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_PlayClientAudio: {
		bricks: ["B_1x1_Gate_Exec_PlayClientAudio"],
		inputs: [
			"Exec",
			"PitchMultiplier",
			"Player",
			"VolumeMultiplier"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_PlayerState_DisplayText: {
		bricks: ["B_1x1_Gate_Exec_PlayerState_DisplayText"],
		inputs: /* @__PURE__ */ "Anchor,Anchor.X,Anchor.Y,Angle,Exec,FontColor,LetterSpacing,Lifetime,LineHeight,OutlineColor,OutlineSize,Pivot,Pivot.X,Pivot.Y,PlayerState,Position,Position.X,Position.Y,Scale,Scale.X,Scale.Y,ShadowColor,ShadowOffset,ShadowOffset.X,ShadowOffset.Y,Skew,Text,TextId,Transition,WrapWidth,ZOrder,bMiteredOutline".split(","),
		outputs: ["ExecOut", "TextIdOut"]
	},
	BrickComponentType_WireGraph_Exec_PlayerState_ForceRespawn: {
		bricks: ["B_1x1_Gate_Exec_PlayerState_ForceRespawn"],
		inputs: ["Exec", "PlayerState"],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_PlayerState_GetDisplayName: {
		bricks: ["B_1x1_Gate_Exec_PlayerState_GetDisplayName"],
		inputs: ["Exec", "PlayerState"],
		outputs: ["DisplayName", "ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_PlayerState_GetFromEntity: {
		bricks: ["B_1x1_Gate_Exec_PlayerState_GetFromEntity"],
		inputs: ["Entity", "Exec"],
		outputs: ["ExecOut", "PlayerState"]
	},
	BrickComponentType_WireGraph_Exec_PlayerState_GetUserId: {
		bricks: ["B_1x1_Gate_Exec_PlayerState_GetUserId"],
		inputs: ["Exec", "PlayerState"],
		outputs: ["ExecOut", "UserId"]
	},
	BrickComponentType_WireGraph_Exec_PlayerState_GetUserName: {
		bricks: ["B_1x1_Gate_Exec_PlayerState_GetUserName"],
		inputs: ["Exec", "PlayerState"],
		outputs: ["ExecOut", "UserName"]
	},
	BrickComponentType_WireGraph_Exec_PlayerState_HasPermission: {
		bricks: ["B_1x1_Gate_Exec_PlayerState_HasPermission"],
		inputs: ["Exec", "PlayerState"],
		outputs: ["ExecOut", "bHasPermission"]
	},
	BrickComponentType_WireGraph_Exec_PlayerState_HasRole: {
		bricks: ["B_1x1_Gate_Exec_PlayerState_HasRole"],
		inputs: ["Exec", "PlayerState"],
		outputs: ["ExecOut", "bHasRole"]
	},
	BrickComponentType_WireGraph_Exec_PlayerState_IsTrustedByBrickOwner: {
		bricks: ["B_1x1_Gate_Exec_PlayerState_IsTrustedByBrickOwner"],
		inputs: ["Exec", "PlayerState"],
		outputs: ["ExecOut", "bIsTrusted"]
	},
	BrickComponentType_WireGraph_Exec_PlayerState_SetCanRespawn: {
		bricks: ["B_1x1_Gate_Exec_PlayerState_SetCanRespawn"],
		inputs: [
			"Exec",
			"PlayerState",
			"bCanRespawn"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_PlayerState_ShowChatMessage: {
		bricks: ["B_1x1_Gate_Exec_PlayerState_ShowChatMessage"],
		inputs: [
			"Exec",
			"Message",
			"PlayerState"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_PlayerState_ShowMessageBox: {
		bricks: ["B_1x1_Gate_Exec_PlayerState_ShowMessageBox"],
		inputs: [
			"Exec",
			"Message",
			"PlayerState",
			"Title"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_PlayerState_ShowStatusMessage: {
		bricks: ["B_1x1_Gate_Exec_PlayerState_ShowStatusMessage"],
		inputs: [
			"Exec",
			"Message",
			"PlayerState"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_PlayGlobalAudio: {
		bricks: ["B_1x1_Gate_Exec_PlayGlobalAudio"],
		inputs: [
			"Exec",
			"PitchMultiplier",
			"VolumeMultiplier"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_PrefabSpawner: {
		bricks: ["B_1x1_Gate_Exec_PrefabSpawner"],
		inputs: [
			"DestroyAll",
			"Exec",
			"Lifetime",
			"Limit",
			"SpawnOffset",
			"SpawnOffset.X",
			"SpawnOffset.Y",
			"SpawnOffset.Z",
			"SpawnOffsetRotation",
			"SpawnOffsetRotation.Pitch",
			"SpawnOffsetRotation.Roll",
			"SpawnOffsetRotation.Yaw",
			"SpawnVelocity",
			"SpawnVelocity.X",
			"SpawnVelocity.Y",
			"SpawnVelocity.Z"
		],
		outputs: ["Entity", "ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_PrintToConsole: {
		bricks: ["B_1x1_Gate_Exec_PrintToConsole"],
		inputs: ["Exec", "Text"],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Random: {
		bricks: ["B_1x1_Gate_Exec_Random"],
		inputs: [
			"Exec",
			"Max",
			"Min"
		],
		outputs: ["ExecOut", "Output"]
	},
	BrickComponentType_WireGraph_Exec_SpawnExplosion: {
		bricks: ["B_1x1_Gate_Exec_SpawnExplosion"],
		inputs: [
			"DamageMultiplier",
			"Exec",
			"Instigator",
			"ProjectileType",
			"ScaleMultiplier",
			"SpawnOffset",
			"SpawnOffset.X",
			"SpawnOffset.Y",
			"SpawnOffset.Z"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_SpawnExplosionAt: {
		bricks: ["B_1x1_Gate_Exec_SpawnExplosionAt"],
		inputs: [
			"DamageMultiplier",
			"Exec",
			"Instigator",
			"ProjectileType",
			"ScaleMultiplier",
			"WorldPosition",
			"WorldPosition.X",
			"WorldPosition.Y",
			"WorldPosition.Z"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Sweep: {
		bricks: ["B_1x1_Gate_Exec_Sweep"],
		inputs: [
			"AdditionalIgnoredEntities",
			"CollisionChannel",
			"Direction",
			"Direction.X",
			"Direction.Y",
			"Direction.Z",
			"Distance",
			"Exec",
			"IgnoreEntity",
			"Origin",
			"Origin.X",
			"Origin.Y",
			"Origin.Z",
			"Radius",
			"bDetectBricks",
			"bDetectMap",
			"bDetectPhysics",
			"bDetectPlayers1",
			"bDetectPlayers2",
			"bDetectPlayers3",
			"bDetectPlayers4",
			"bIgnoreOwningGrid",
			"bRelative"
		],
		outputs: [
			"ExecOut",
			"Hit",
			"HitColor",
			"HitDistance",
			"HitEntity",
			"HitLocation",
			"HitNormal",
			"Miss"
		]
	},
	BrickComponentType_WireGraph_Exec_SweepSimple: {
		bricks: ["B_1x1_Gate_Exec_SweepSimple"],
		inputs: [
			"CollisionChannel",
			"Distance",
			"Exec",
			"Radius",
			"SpreadConeAngle"
		],
		outputs: [
			"ExecOut",
			"Hit",
			"HitColor",
			"HitDistance",
			"HitEntity",
			"HitLocation",
			"HitNormal",
			"Miss"
		]
	},
	BrickComponentType_WireGraph_Exec_Toggle: {
		bricks: ["B_1x1_Gate_Exec_Toggle"],
		inputs: ["Exec"],
		outputs: ["ExecOut", "Output"]
	},
	BrickComponentType_WireGraph_Exec_Union: {
		bricks: ["B_1x1_Gate_Exec_Union"],
		inputs: ["ExecA", "ExecB"],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Var_Get: {
		bricks: ["B_1x1_Gate_Exec_Var_Get"],
		inputs: ["Exec", "VarRef"],
		outputs: ["ExecOut", "Value"]
	},
	BrickComponentType_WireGraph_Exec_Var_Increment: {
		bricks: ["B_1x1_Gate_Exec_Var_Increment"],
		inputs: [
			"Exec",
			"Value",
			"VarRef"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Var_Set: {
		bricks: ["B_1x1_Gate_Exec_Var_Set"],
		inputs: [
			"Exec",
			"Value",
			"VarRef"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_WholeGridInteracted: {
		bricks: [],
		inputs: [],
		outputs: ["Character", "bHeld"]
	},
	BrickComponentType_WireGraph_Exec_WholeGridTargeted: {
		bricks: [],
		inputs: [],
		outputs: [
			"CharacterThatJustHit",
			"Damage",
			"Targeted",
			"WeaponNameThatJustHit",
			"WeaponThatJustHit"
		]
	},
	BrickComponentType_WireGraph_Exec_Zone_GetEntities: {
		bricks: ["B_1x1_Gate_Exec_Zone_GetEntities"],
		inputs: [
			"ArrayVarRef",
			"Exec",
			"TagFilter",
			"Zone"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Exec_Zone_GetPlayers: {
		bricks: ["B_1x1_Gate_Exec_Zone_GetPlayers"],
		inputs: [
			"ArrayVarRef",
			"Exec",
			"TagFilter",
			"Zone"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraph_Expr_BitwiseAND: {
		bricks: ["B_1x1_Gate_Expr_BitwiseAND"],
		inputs: ["InputA", "InputB"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_BitwiseBitCount: {
		bricks: ["B_1x1_Gate_Expr_BitwiseBitCount"],
		inputs: ["Input"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_BitwiseNAND: {
		bricks: ["B_1x1_Gate_Expr_BitwiseNAND"],
		inputs: ["InputA", "InputB"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_BitwiseNOR: {
		bricks: ["B_1x1_Gate_Expr_BitwiseNOR"],
		inputs: ["InputA", "InputB"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_BitwiseNOT: {
		bricks: ["B_1x1_Gate_Expr_BitwiseNOT"],
		inputs: ["Input"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_BitwiseOR: {
		bricks: ["B_1x1_Gate_Expr_BitwiseOR"],
		inputs: ["InputA", "InputB"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_BitwiseShiftLeft: {
		bricks: ["B_1x1_Gate_Expr_BitwiseShiftLeft"],
		inputs: ["InputA", "InputB"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_BitwiseShiftRight: {
		bricks: ["B_1x1_Gate_Expr_BitwiseShiftRight"],
		inputs: ["InputA", "InputB"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_BitwiseShiftRightLogical: {
		bricks: ["B_1x1_Gate_Expr_BitwiseShiftRightLogical"],
		inputs: ["InputA", "InputB"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_BitwiseXOR: {
		bricks: ["B_1x1_Gate_Expr_BitwiseXOR"],
		inputs: ["InputA", "InputB"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_Ceil: {
		bricks: ["B_1x1_Gate_Expr_Ceil"],
		inputs: ["Input"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_ChangeDetector: {
		bricks: ["B_1x1_Gate_Expr_ChangeDetector"],
		inputs: ["Input"],
		outputs: ["bPulseOnChange"]
	},
	BrickComponentType_WireGraph_Expr_ChangeDetectorExec: {
		bricks: ["B_1x1_Gate_Expr_ChangeDetectorExec"],
		inputs: ["Input"],
		outputs: ["OnChanged"]
	},
	BrickComponentType_WireGraph_Expr_ColorBlend: {
		bricks: ["B_1x1_Gate_Expr_ColorBlend"],
		inputs: [
			"Alpha",
			"ColorA",
			"ColorB"
		],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_ColorConvert: {
		bricks: ["B_1x1_Gate_Expr_ColorConvert"],
		inputs: ["Input"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_ColorToHex: {
		bricks: ["B_1x1_Gate_Expr_ColorToHex"],
		inputs: ["Input"],
		outputs: ["Hex"]
	},
	BrickComponentType_WireGraph_Expr_CompareEqual: {
		bricks: ["B_1x1_Gate_Expr_CompareEqual"],
		inputs: ["InputA", "InputB"],
		outputs: ["bOutput"]
	},
	BrickComponentType_WireGraph_Expr_CompareGreater: {
		bricks: ["B_1x1_Gate_Expr_CompareGreater"],
		inputs: ["InputA", "InputB"],
		outputs: ["bOutput"]
	},
	BrickComponentType_WireGraph_Expr_CompareGreaterOrEqual: {
		bricks: ["B_1x1_Gate_Expr_CompareGreaterOrEqual"],
		inputs: ["InputA", "InputB"],
		outputs: ["bOutput"]
	},
	BrickComponentType_WireGraph_Expr_CompareLess: {
		bricks: ["B_1x1_Gate_Expr_CompareLess"],
		inputs: ["InputA", "InputB"],
		outputs: ["bOutput"]
	},
	BrickComponentType_WireGraph_Expr_CompareLessOrEqual: {
		bricks: ["B_1x1_Gate_Expr_CompareLessOrEqual"],
		inputs: ["InputA", "InputB"],
		outputs: ["bOutput"]
	},
	BrickComponentType_WireGraph_Expr_CompareNotEqual: {
		bricks: ["B_1x1_Gate_Expr_CompareNotEqual"],
		inputs: ["InputA", "InputB"],
		outputs: ["bOutput"]
	},
	BrickComponentType_WireGraph_Expr_Convert: {
		bricks: ["B_1x1_Gate_Expr_Convert"],
		inputs: ["Input"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_DirectionToRotation: {
		bricks: ["B_1x1_Gate_Expr_DirectionToRotation"],
		inputs: [
			"Direction",
			"Direction.X",
			"Direction.Y",
			"Direction.Z"
		],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_EdgeDetector: {
		bricks: ["B_1x1_Gate_Expr_EdgeDetector"],
		inputs: ["Input"],
		outputs: ["bPulseOnFallingEdge", "bPulseOnRisingEdge"]
	},
	BrickComponentType_WireGraph_Expr_EdgeDetectorExec: {
		bricks: ["B_1x1_Gate_Expr_EdgeDetectorExec"],
		inputs: ["Input"],
		outputs: ["OnFallingEdge", "OnRisingEdge"]
	},
	BrickComponentType_WireGraph_Expr_EnumToInteger: {
		bricks: ["B_1x1_Gate_Expr_EnumToInteger"],
		inputs: ["Input"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_Floor: {
		bricks: ["B_1x1_Gate_Expr_Floor"],
		inputs: ["Input"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_Gamemode_IsBuilderTeam: {
		bricks: ["B_1x1_Gate_Expr_Gamemode_IsBuilderTeam"],
		inputs: ["Team"],
		outputs: ["bResult"]
	},
	BrickComponentType_WireGraph_Expr_Gamemode_IsUnaffiliatedTeam: {
		bricks: ["B_1x1_Gate_Expr_Gamemode_IsUnaffiliatedTeam"],
		inputs: ["Team"],
		outputs: ["bResult"]
	},
	BrickComponentType_WireGraph_Expr_IntegerToEnum: {
		bricks: ["B_1x1_Gate_Expr_IntegerToEnum"],
		inputs: ["Input", "bWrap"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_InvertRotation: {
		bricks: ["B_1x1_Gate_Expr_InvertRotation"],
		inputs: [
			"Input",
			"Input.W",
			"Input.X",
			"Input.Y",
			"Input.Z"
		],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_ItemToPickup: {
		bricks: ["B_1x1_Gate_Expr_ItemToPickup"],
		inputs: ["Input"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_LogicalAND: {
		bricks: ["B_1x1_Gate_Expr_LogicalAND"],
		inputs: ["bInputA", "bInputB"],
		outputs: ["bOutput"]
	},
	BrickComponentType_WireGraph_Expr_LogicalNAND: {
		bricks: ["B_1x1_Gate_Expr_LogicalNAND"],
		inputs: ["bInputA", "bInputB"],
		outputs: ["bOutput"]
	},
	BrickComponentType_WireGraph_Expr_LogicalNOR: {
		bricks: ["B_1x1_Gate_Expr_LogicalNOR"],
		inputs: ["bInputA", "bInputB"],
		outputs: ["bOutput"]
	},
	BrickComponentType_WireGraph_Expr_LogicalNOT: {
		bricks: ["B_1x1_Gate_Expr_LogicalNOT"],
		inputs: ["bInput"],
		outputs: ["bOutput"]
	},
	BrickComponentType_WireGraph_Expr_LogicalOR: {
		bricks: ["B_1x1_Gate_Expr_LogicalOR"],
		inputs: ["bInputA", "bInputB"],
		outputs: ["bOutput"]
	},
	BrickComponentType_WireGraph_Expr_LogicalXOR: {
		bricks: ["B_1x1_Gate_Expr_LogicalXOR"],
		inputs: ["bInputA", "bInputB"],
		outputs: ["bOutput"]
	},
	BrickComponentType_WireGraph_Expr_MakeColor: {
		bricks: ["B_1x1_Gate_Expr_MakeColor"],
		inputs: [
			"A",
			"B",
			"G",
			"R"
		],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_MakeColorHex: {
		bricks: ["B_1x1_Gate_Expr_MakeColorHex"],
		inputs: ["Hex"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_MakeColorSRGB: {
		bricks: ["B_1x1_Gate_Expr_MakeColorSRGB"],
		inputs: [
			"A",
			"B",
			"G",
			"R"
		],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_MakeQuaternion: {
		bricks: ["B_1x1_Gate_Expr_MakeQuaternion"],
		inputs: [
			"W",
			"X",
			"Y",
			"Z"
		],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_MakeRotation: {
		bricks: ["B_1x1_Gate_Expr_MakeRotation"],
		inputs: [
			"Pitch",
			"Roll",
			"Yaw"
		],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_MakeVector: {
		bricks: ["B_1x1_Gate_Expr_MakeVector"],
		inputs: [
			"X",
			"Y",
			"Z"
		],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_MathAbs: {
		bricks: ["B_1x1_Gate_Expr_MathAbs"],
		inputs: ["Input"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_MathAcos: {
		bricks: ["B_1x1_Gate_Expr_MathAcos"],
		inputs: ["Input"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_MathAcosh: {
		bricks: ["B_1x1_Gate_Expr_MathAcosh"],
		inputs: ["Input"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_MathAdd: {
		bricks: ["B_1x1_Gate_Expr_MathAdd"],
		inputs: ["InputA", "InputB"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_MathAsin: {
		bricks: ["B_1x1_Gate_Expr_MathAsin"],
		inputs: ["Input"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_MathAsinh: {
		bricks: ["B_1x1_Gate_Expr_MathAsinh"],
		inputs: ["Input"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_MathAtan: {
		bricks: ["B_1x1_Gate_Expr_MathAtan"],
		inputs: ["Input"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_MathAtan2: {
		bricks: ["B_1x1_Gate_Expr_MathAtan2"],
		inputs: ["X", "Y"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_MathAtanh: {
		bricks: ["B_1x1_Gate_Expr_MathAtanh"],
		inputs: ["Input"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_MathBlend: {
		bricks: ["B_1x1_Gate_Expr_MathBlend"],
		inputs: [
			"Blend",
			"InputA",
			"InputB"
		],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_MathClamp: {
		bricks: ["B_1x1_Gate_Expr_MathClamp"],
		inputs: [
			"Input",
			"Max",
			"Min"
		],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_MathCos: {
		bricks: ["B_1x1_Gate_Expr_MathCos"],
		inputs: ["Input"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_MathCosh: {
		bricks: ["B_1x1_Gate_Expr_MathCosh"],
		inputs: ["Input"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_MathDegreesToRadians: {
		bricks: ["B_1x1_Gate_Expr_MathDegreesToRadians"],
		inputs: ["Input"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_MathDivide: {
		bricks: ["B_1x1_Gate_Expr_MathDivide"],
		inputs: ["InputA", "InputB"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_MathEasing: {
		bricks: ["B_1x1_Gate_Expr_MathEasing"],
		inputs: [
			"Blend",
			"InputA",
			"InputB"
		],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_MathExp: {
		bricks: ["B_1x1_Gate_Expr_MathExp"],
		inputs: ["Input"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_MathLn: {
		bricks: ["B_1x1_Gate_Expr_MathLn"],
		inputs: ["Input"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_MathLogBase: {
		bricks: ["B_1x1_Gate_Expr_MathLogBase"],
		inputs: ["Base", "Input"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_MathMax: {
		bricks: ["B_1x1_Gate_Expr_MathMax"],
		inputs: ["InputA", "InputB"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_MathMin: {
		bricks: ["B_1x1_Gate_Expr_MathMin"],
		inputs: ["InputA", "InputB"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_MathModulo: {
		bricks: ["B_1x1_Gate_Expr_MathModulo"],
		inputs: ["InputA", "InputB"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_MathModuloFloored: {
		bricks: ["B_1x1_Gate_Expr_MathModuloFloored"],
		inputs: ["InputA", "InputB"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_MathMultiply: {
		bricks: ["B_1x1_Gate_Expr_MathMultiply"],
		inputs: ["InputA", "InputB"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_MathNegate: {
		bricks: ["B_1x1_Gate_Expr_MathNegate"],
		inputs: ["Input"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_MathPow: {
		bricks: ["B_1x1_Gate_Expr_MathPow"],
		inputs: ["Exponent", "Input"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_MathRadiansToDegrees: {
		bricks: ["B_1x1_Gate_Expr_MathRadiansToDegrees"],
		inputs: ["Input"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_MathSign: {
		bricks: ["B_1x1_Gate_Expr_MathSign"],
		inputs: ["Input"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_MathSin: {
		bricks: ["B_1x1_Gate_Expr_MathSin"],
		inputs: ["Input"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_MathSinh: {
		bricks: ["B_1x1_Gate_Expr_MathSinh"],
		inputs: ["Input"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_MathSqrt: {
		bricks: ["B_1x1_Gate_Expr_MathSqrt"],
		inputs: ["Input"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_MathSubtract: {
		bricks: ["B_1x1_Gate_Expr_MathSubtract"],
		inputs: ["InputA", "InputB"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_MathTan: {
		bricks: ["B_1x1_Gate_Expr_MathTan"],
		inputs: ["Input"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_MathTanh: {
		bricks: ["B_1x1_Gate_Expr_MathTanh"],
		inputs: ["Input"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_NearlyEqual: {
		bricks: ["B_1x1_Gate_Expr_NearlyEqual"],
		inputs: [
			"InputA",
			"InputB",
			"Tolerance"
		],
		outputs: ["bOutput"]
	},
	BrickComponentType_WireGraph_Expr_QuatAngleBetween: {
		bricks: ["B_1x1_Gate_Expr_QuatAngleBetween"],
		inputs: [
			"InputA",
			"InputA.W",
			"InputA.X",
			"InputA.Y",
			"InputA.Z",
			"InputB",
			"InputB.W",
			"InputB.X",
			"InputB.Y",
			"InputB.Z"
		],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_QuatBetween: {
		bricks: ["B_1x1_Gate_Expr_QuatBetween"],
		inputs: [
			"From",
			"From.X",
			"From.Y",
			"From.Z",
			"To",
			"To.X",
			"To.Y",
			"To.Z"
		],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_QuatDotProduct: {
		bricks: ["B_1x1_Gate_Expr_QuatDotProduct"],
		inputs: [
			"InputA",
			"InputA.W",
			"InputA.X",
			"InputA.Y",
			"InputA.Z",
			"InputB",
			"InputB.W",
			"InputB.X",
			"InputB.Y",
			"InputB.Z"
		],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_QuatFromAxisAngle: {
		bricks: ["B_1x1_Gate_Expr_QuatFromAxisAngle"],
		inputs: [
			"Angle",
			"Axis",
			"Axis.X",
			"Axis.Y",
			"Axis.Z"
		],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_QuatSlerp: {
		bricks: ["B_1x1_Gate_Expr_QuatSlerp"],
		inputs: [
			"Alpha",
			"InputA",
			"InputA.W",
			"InputA.X",
			"InputA.Y",
			"InputA.Z",
			"InputB",
			"InputB.W",
			"InputB.X",
			"InputB.Y",
			"InputB.Z"
		],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_QuatToAxisAngle: {
		bricks: ["B_1x1_Gate_Expr_QuatToAxisAngle"],
		inputs: [
			"Input",
			"Input.W",
			"Input.X",
			"Input.Y",
			"Input.Z"
		],
		outputs: ["Angle", "Axis"]
	},
	BrickComponentType_WireGraph_Expr_Remap: {
		bricks: ["B_1x1_Gate_Expr_Remap"],
		inputs: [
			"InputMax",
			"InputMin",
			"OutputMax",
			"OutputMin",
			"Value"
		],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_RotateVector: {
		bricks: ["B_1x1_Gate_Expr_RotateVector"],
		inputs: [
			"Rotation",
			"Rotation.W",
			"Rotation.X",
			"Rotation.Y",
			"Rotation.Z",
			"Vector",
			"Vector.X",
			"Vector.Y",
			"Vector.Z"
		],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_RotationToDirection: {
		bricks: ["B_1x1_Gate_Expr_RotationToDirection"],
		inputs: [
			"Rotation",
			"Rotation.W",
			"Rotation.X",
			"Rotation.Y",
			"Rotation.Z"
		],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_Round: {
		bricks: ["B_1x1_Gate_Expr_Round"],
		inputs: ["Input"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_Select: {
		bricks: ["B_1x1_Gate_Expr_Select"],
		inputs: [
			"InputA",
			"InputB",
			"bSelectB"
		],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_SplitColor: {
		bricks: ["B_1x1_Gate_Expr_SplitColor"],
		inputs: ["Input"],
		outputs: [
			"A",
			"B",
			"G",
			"R"
		]
	},
	BrickComponentType_WireGraph_Expr_SplitColorSRGB: {
		bricks: ["B_1x1_Gate_Expr_SplitColorSRGB"],
		inputs: ["Input"],
		outputs: [
			"A",
			"B",
			"G",
			"R"
		]
	},
	BrickComponentType_WireGraph_Expr_SplitQuaternion: {
		bricks: ["B_1x1_Gate_Expr_SplitQuaternion"],
		inputs: [
			"Input",
			"Input.W",
			"Input.X",
			"Input.Y",
			"Input.Z"
		],
		outputs: [
			"W",
			"X",
			"Y",
			"Z"
		]
	},
	BrickComponentType_WireGraph_Expr_SplitRotation: {
		bricks: ["B_1x1_Gate_Expr_SplitRotation"],
		inputs: [
			"Input",
			"Input.Pitch",
			"Input.Roll",
			"Input.Yaw"
		],
		outputs: [
			"Pitch",
			"Roll",
			"Yaw"
		]
	},
	BrickComponentType_WireGraph_Expr_SplitVector: {
		bricks: ["B_1x1_Gate_Expr_SplitVector"],
		inputs: [
			"Input",
			"Input.X",
			"Input.Y",
			"Input.Z"
		],
		outputs: [
			"X",
			"Y",
			"Z"
		]
	},
	BrickComponentType_WireGraph_Expr_String_CharacterToCodepoint: {
		bricks: ["B_1x1_Gate_Expr_String_CharacterToCodepoint"],
		inputs: ["Character"],
		outputs: ["Codepoint", "bSuccess"]
	},
	BrickComponentType_WireGraph_Expr_String_CodepointToCharacter: {
		bricks: ["B_1x1_Gate_Expr_String_CodepointToCharacter"],
		inputs: ["Codepoint"],
		outputs: ["Character", "bSuccess"]
	},
	BrickComponentType_WireGraph_Expr_String_Concatenate: {
		bricks: ["B_1x1_Gate_Expr_String_Concatenate"],
		inputs: [
			"InputA",
			"InputB",
			"Separator"
		],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_String_Contains: {
		bricks: ["B_1x1_Gate_Expr_String_Contains"],
		inputs: [
			"Input",
			"Search",
			"bCaseSensitive"
		],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_String_EndsWith: {
		bricks: ["B_1x1_Gate_Expr_String_EndsWith"],
		inputs: [
			"Input",
			"Suffix",
			"bCaseSensitive"
		],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_String_Find: {
		bricks: ["B_1x1_Gate_Expr_String_Find"],
		inputs: [
			"Input",
			"Search",
			"Start",
			"bCaseSensitive"
		],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_String_FormatText: {
		bricks: ["B_1x1_Gate_Expr_String_FormatText"],
		inputs: [
			"FormatString",
			"InputA",
			"InputB",
			"InputC",
			"InputD",
			"InputE",
			"InputF",
			"InputG"
		],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_String_Length: {
		bricks: ["B_1x1_Gate_Expr_String_Length"],
		inputs: ["Input"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_String_ParseInt: {
		bricks: ["B_1x1_Gate_Expr_String_ParseInt"],
		inputs: ["Input"],
		outputs: ["Value", "bSuccess"]
	},
	BrickComponentType_WireGraph_Expr_String_ParseNumber: {
		bricks: ["B_1x1_Gate_Expr_String_ParseNumber"],
		inputs: ["Input"],
		outputs: ["Value", "bSuccess"]
	},
	BrickComponentType_WireGraph_Expr_String_Replace: {
		bricks: ["B_1x1_Gate_Expr_String_Replace"],
		inputs: [
			"Input",
			"MaxReplacements",
			"Replacement",
			"Search",
			"Start",
			"bCaseSensitive"
		],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_String_Split: {
		bricks: ["B_1x1_Gate_Expr_String_Split"],
		inputs: [
			"Delimiter",
			"Input",
			"Occurrence",
			"bCaseSensitive"
		],
		outputs: [
			"Left",
			"Right",
			"bFound"
		]
	},
	BrickComponentType_WireGraph_Expr_String_StartsWith: {
		bricks: ["B_1x1_Gate_Expr_String_StartsWith"],
		inputs: [
			"Input",
			"Prefix",
			"bCaseSensitive"
		],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_String_Substring: {
		bricks: ["B_1x1_Gate_Expr_String_Substring"],
		inputs: [
			"Input",
			"Length",
			"Start"
		],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_String_ToLower: {
		bricks: ["B_1x1_Gate_Expr_String_ToLower"],
		inputs: ["Input"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_String_ToUpper: {
		bricks: ["B_1x1_Gate_Expr_String_ToUpper"],
		inputs: ["Input"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_String_Trim: {
		bricks: ["B_1x1_Gate_Expr_String_Trim"],
		inputs: ["Input"],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_Swap: {
		bricks: ["B_1x1_Gate_Expr_Swap"],
		inputs: [
			"InputA",
			"InputB",
			"bSwap"
		],
		outputs: ["Output", "OutputB"]
	},
	BrickComponentType_WireGraph_Expr_VecCrossProduct: {
		bricks: ["B_1x1_Gate_Expr_VecCrossProduct"],
		inputs: [
			"InputA",
			"InputA.X",
			"InputA.Y",
			"InputA.Z",
			"InputB",
			"InputB.X",
			"InputB.Y",
			"InputB.Z"
		],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_VecDistance: {
		bricks: ["B_1x1_Gate_Expr_VecDistance"],
		inputs: [
			"InputA",
			"InputA.X",
			"InputA.Y",
			"InputA.Z",
			"InputB",
			"InputB.X",
			"InputB.Y",
			"InputB.Z"
		],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_VecDistanceSquared: {
		bricks: ["B_1x1_Gate_Expr_VecDistanceSquared"],
		inputs: [
			"InputA",
			"InputA.X",
			"InputA.Y",
			"InputA.Z",
			"InputB",
			"InputB.X",
			"InputB.Y",
			"InputB.Z"
		],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_VecDotProduct: {
		bricks: ["B_1x1_Gate_Expr_VecDotProduct"],
		inputs: [
			"InputA",
			"InputA.X",
			"InputA.Y",
			"InputA.Z",
			"InputB",
			"InputB.X",
			"InputB.Y",
			"InputB.Z"
		],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_VecMagnitude: {
		bricks: ["B_1x1_Gate_Expr_VecMagnitude"],
		inputs: [
			"Input",
			"Input.X",
			"Input.Y",
			"Input.Z"
		],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_VecMagnitudeSquared: {
		bricks: ["B_1x1_Gate_Expr_VecMagnitudeSquared"],
		inputs: [
			"Input",
			"Input.X",
			"Input.Y",
			"Input.Z"
		],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_VecNormalize: {
		bricks: ["B_1x1_Gate_Expr_VecNormalize"],
		inputs: [
			"Input",
			"Input.X",
			"Input.Y",
			"Input.Z"
		],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Expr_VecScale: {
		bricks: ["B_1x1_Gate_Expr_VecScale"],
		inputs: [
			"Input",
			"Input.X",
			"Input.Y",
			"Input.Z",
			"Scalar"
		],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraph_Fake_Gamemode_CharacterDamagedEvent: {
		bricks: ["B_1x1_Gate_Fake_Gamemode_CharacterDamagedEvent"],
		inputs: [],
		outputs: [
			"Attacker",
			"AttackerWeapon",
			"AttackerWeaponName",
			"Character",
			"Damage",
			"ExecOut"
		]
	},
	BrickComponentType_WireGraph_Fake_Gamemode_CharacterDiedEvent: {
		bricks: ["B_1x1_Gate_Fake_Gamemode_CharacterDiedEvent"],
		inputs: [],
		outputs: [
			"Character",
			"ExecOut",
			"Killer",
			"KillerWeapon",
			"KillerWeaponName"
		]
	},
	BrickComponentType_WireGraph_Fake_Gamemode_CharacterFiredWeaponEvent: {
		bricks: ["B_1x1_Gate_Fake_Gamemode_CharacterFiredWeaponEvent"],
		inputs: [],
		outputs: [
			"Character",
			"Direction",
			"ExecOut",
			"Start",
			"Weapon",
			"WeaponName"
		]
	},
	BrickComponentType_WireGraph_Fake_Gamemode_CharacterSpawnedEvent: {
		bricks: ["B_1x1_Gate_Fake_Gamemode_CharacterSpawnedEvent"],
		inputs: [],
		outputs: ["Character", "ExecOut"]
	},
	BrickComponentType_WireGraph_Fake_Gamemode_ControllerJoinedEvent: {
		bricks: ["B_1x1_Gate_Fake_Gamemode_ControllerJoinedEvent"],
		inputs: [],
		outputs: [
			"ExecOut",
			"PlayerState",
			"UserId",
			"UserName"
		]
	},
	BrickComponentType_WireGraph_Fake_Gamemode_ControllerJoinedTeamEvent: {
		bricks: ["B_1x1_Gate_Fake_Gamemode_ControllerJoinedTeamEvent"],
		inputs: [],
		outputs: [
			"ExecOut",
			"PlayerState",
			"Team",
			"UserId",
			"UserName"
		]
	},
	BrickComponentType_WireGraph_Fake_Gamemode_ControllerLeftEvent: {
		bricks: ["B_1x1_Gate_Fake_Gamemode_ControllerLeftEvent"],
		inputs: [],
		outputs: [
			"ExecOut",
			"PlayerState",
			"UserId",
			"UserName"
		]
	},
	BrickComponentType_WireGraph_Fake_Gamemode_ControllerLeftTeamEvent: {
		bricks: ["B_1x1_Gate_Fake_Gamemode_ControllerLeftTeamEvent"],
		inputs: [],
		outputs: [
			"ExecOut",
			"PlayerState",
			"Team",
			"UserId",
			"UserName"
		]
	},
	BrickComponentType_WireGraph_Fake_Gamemode_RoundEndEvent: {
		bricks: ["B_1x1_Gate_Fake_Gamemode_RoundEndEvent"],
		inputs: [],
		outputs: ["ExecOut", "RoundNumber"]
	},
	BrickComponentType_WireGraph_Fake_Gamemode_RoundStartEvent: {
		bricks: ["B_1x1_Gate_Fake_Gamemode_RoundStartEvent"],
		inputs: [],
		outputs: ["ExecOut", "RoundNumber"]
	},
	BrickComponentType_WireGraph_FindPlayer: {
		bricks: ["B_1x1_Gate_FindPlayer"],
		inputs: ["Exec", "Query"],
		outputs: ["ExecOut", "Player"]
	},
	BrickComponentType_WireGraph_FontReference: {
		bricks: ["B_1x1_Gate_FontReference"],
		inputs: [],
		outputs: ["Value"]
	},
	BrickComponentType_WireGraph_FormatDate: {
		bricks: ["B_1x1_Gate_FormatDate"],
		inputs: [
			"Format",
			"UnixEpoch",
			"bUseUTC"
		],
		outputs: ["Output", "bSuccess"]
	},
	BrickComponentType_WireGraph_GetUnixEpoch: {
		bricks: ["B_1x1_Gate_GetUnixEpoch"],
		inputs: [],
		outputs: ["UnixEpoch"]
	},
	BrickComponentType_WireGraph_ItemReference: {
		bricks: ["B_1x1_Gate_ItemReference"],
		inputs: [],
		outputs: ["Value"]
	},
	BrickComponentType_WireGraph_OneShotAudioReference: {
		bricks: ["B_1x1_Gate_OneShotAudioReference"],
		inputs: [],
		outputs: ["Value"]
	},
	BrickComponentType_WireGraph_ParticleReference: {
		bricks: [],
		inputs: [],
		outputs: ["Value"]
	},
	BrickComponentType_WireGraph_PickupReference: {
		bricks: ["B_1x1_Gate_PickupReference"],
		inputs: [],
		outputs: ["Value"]
	},
	BrickComponentType_WireGraph_ProjectileReference: {
		bricks: ["B_1x1_Gate_ProjectileReference"],
		inputs: [],
		outputs: ["Value"]
	},
	BrickComponentType_WireGraph_ServerUptime: {
		bricks: ["B_1x1_Gate_ServerUptime"],
		inputs: [],
		outputs: ["Uptime"]
	},
	BrickComponentType_WireGraph_WeaponResourceReference: {
		bricks: ["B_1x1_Gate_WeaponResourceReference"],
		inputs: [],
		outputs: ["Value"]
	},
	BrickComponentType_WireGraph_WheelEngineAudioReference: {
		bricks: ["B_1x1_Gate_WheelEngineAudioReference"],
		inputs: [],
		outputs: ["Value"]
	},
	BrickComponentType_WireGraphPseudo_ArrayVar: {
		bricks: ["B_1x1_Gate_Variable_Array"],
		inputs: [],
		outputs: ["ArrayVarRef"]
	},
	BrickComponentType_WireGraphPseudo_BufferSeconds: {
		bricks: ["B_1x1_Gate_Pseudo_BufferSeconds"],
		inputs: [
			"Input",
			"SecondsToWait",
			"ZeroSecondsToWait"
		],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraphPseudo_BufferTicks: {
		bricks: ["B_1x1_Gate_Pseudo_BufferTicks"],
		inputs: [
			"Input",
			"TicksToWait",
			"ZeroTicksToWait"
		],
		outputs: ["Output"]
	},
	BrickComponentType_WireGraphPseudo_CustomEvent: {
		bricks: ["B_1x1_Gate_Pseudo_CustomEvent"],
		inputs: [],
		outputs: [
			"DataOut1",
			"DataOut2",
			"DataOut3",
			"DataOut4",
			"DataOut5",
			"DataOut6",
			"DataOut7",
			"DataOut8",
			"ExecOut"
		]
	},
	BrickComponentType_WireGraphPseudo_CustomEvent_Global: {
		bricks: ["B_1x1_Gate_Pseudo_CustomEvent_Global"],
		inputs: [],
		outputs: [
			"DataOut1",
			"DataOut2",
			"DataOut3",
			"DataOut4",
			"DataOut5",
			"DataOut6",
			"DataOut7",
			"DataOut8",
			"ExecOut"
		]
	},
	BrickComponentType_WireGraphPseudo_Dampen: {
		bricks: ["B_1x1_Gate_Pseudo_Dampen"],
		inputs: ["SmoothTime", "Target"],
		outputs: ["Value"]
	},
	BrickComponentType_WireGraphPseudo_MapVar: {
		bricks: ["B_1x1_Gate_Variable_Map"],
		inputs: [],
		outputs: ["MapVarRef"]
	},
	BrickComponentType_WireGraphPseudo_QueueSeconds: {
		bricks: ["B_1x1_Gate_Pseudo_QueueSeconds"],
		inputs: [
			"DataIn1",
			"DataIn2",
			"DataIn3",
			"DataIn4",
			"DataIn5",
			"DataIn6",
			"DataIn7",
			"DataIn8",
			"ExecIn",
			"SecondsToWait"
		],
		outputs: [
			"DataOut1",
			"DataOut2",
			"DataOut3",
			"DataOut4",
			"DataOut5",
			"DataOut6",
			"DataOut7",
			"DataOut8",
			"ExecOut"
		]
	},
	BrickComponentType_WireGraphPseudo_QueueTicks: {
		bricks: ["B_1x1_Gate_Pseudo_QueueTicks"],
		inputs: [
			"DataIn1",
			"DataIn2",
			"DataIn3",
			"DataIn4",
			"DataIn5",
			"DataIn6",
			"DataIn7",
			"DataIn8",
			"ExecIn",
			"TicksToWait"
		],
		outputs: [
			"DataOut1",
			"DataOut2",
			"DataOut3",
			"DataOut4",
			"DataOut5",
			"DataOut6",
			"DataOut7",
			"DataOut8",
			"ExecOut"
		]
	},
	BrickComponentType_WireGraphPseudo_SendCustomEvent: {
		bricks: ["B_1x1_Gate_Pseudo_SendCustomEvent"],
		inputs: [
			"DataIn1",
			"DataIn2",
			"DataIn3",
			"DataIn4",
			"DataIn5",
			"DataIn6",
			"DataIn7",
			"DataIn8",
			"ExecIn",
			"Target"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraphPseudo_SendCustomEvent_Global: {
		bricks: ["B_1x1_Gate_Pseudo_SendCustomEvent_Global"],
		inputs: [
			"DataIn1",
			"DataIn2",
			"DataIn3",
			"DataIn4",
			"DataIn5",
			"DataIn6",
			"DataIn7",
			"DataIn8",
			"ExecIn",
			"Target"
		],
		outputs: ["ExecOut"]
	},
	BrickComponentType_WireGraphPseudo_Timer: {
		bricks: ["B_1x1_Gate_Pseudo_Timer"],
		inputs: [
			"Limit",
			"Pause",
			"Restart",
			"Resume"
		],
		outputs: ["Expired", "Time"]
	},
	BrickComponentType_WireGraphPseudo_Tween: {
		bricks: ["B_1x1_Gate_Pseudo_Tween"],
		inputs: [
			"Direction",
			"Duration",
			"Function",
			"Target"
		],
		outputs: ["Arrived", "Value"]
	},
	BrickComponentType_WireGraphPseudo_Var: {
		bricks: ["B_1x1_Gate_Variable"],
		inputs: [],
		outputs: ["Value", "VarRef"]
	},
	Component_AudioEmitter: {
		bricks: ["B_1x1F_Speaker", "B_2x2F_Speaker"],
		inputs: [
			"AudioDescriptor",
			"FocusAzimuth",
			"InnerRadius",
			"MaxDistance",
			"NonFocusAzimuth",
			"NonFocusVolumeAttenuation",
			"PitchMultiplier",
			"VolumeMultiplier",
			"bEnabled",
			"bSpatialization"
		],
		outputs: []
	},
	Component_BotSpawn: {
		bricks: ["B_Bot_Spawn_Point"],
		inputs: /* @__PURE__ */ "AggroRange,Agression,AttackDamageMultiplier,AttackMovementAmount,BotName,BotWeapon,CorpseTimeout,GunSkill,HealthMultiplier,Jumpyness,MoveTarget,MoveTarget.X,MoveTarget.Y,MoveTarget.Z,MovementAmount,MovementGoalDummy,MovementRandomness,ReactionTime,RespawnTime,RunSpeed,Skin,Skin.Parts,TeamCollisionChannel,bActiveBot,bBackVision,bCanJump,bCanTargetBots,bCanTargetPlayers,bDeleteBot,bSpawnEnable,bTeamCollision,bTeamCollision1,bTeamCollision2,bTeamCollision3,bVisionRaycasting".split(","),
		outputs: [
			"DistanceToTarget",
			"FocusCharacter",
			"SpawnedCharacter"
		]
	},
	Component_BrickPropertyChanger: {
		bricks: [],
		inputs: [
			"Color",
			"Color.A",
			"Color.B",
			"Color.G",
			"Color.R",
			"Material",
			"MaterialAlpha",
			"bCollisionEnabled",
			"bCollisionEnabled_Interaction",
			"bCollisionEnabled_Physics",
			"bCollisionEnabled_Player",
			"bCollisionEnabled_Player1",
			"bCollisionEnabled_Player2",
			"bCollisionEnabled_Player3",
			"bCollisionEnabled_Weapon",
			"bVisibility"
		],
		outputs: []
	},
	Component_Button: {
		bricks: [],
		inputs: [
			"PressSound",
			"PromptCustomLabel",
			"ReleaseSound",
			"bAllowNearbyInteraction",
			"bHiddenInteraction"
		],
		outputs: [
			"Character",
			"PressCount",
			"bHeld"
		]
	},
	Component_CheckPoint: {
		bricks: ["B_CheckPoint"],
		inputs: ["bRotatePlayerGravityOnSpawn"],
		outputs: []
	},
	Component_Damage: {
		bricks: ["PB_Spike"],
		inputs: [
			"ConsoleTag",
			"Damage",
			"Message",
			"RepeatDelay"
		],
		outputs: []
	},
	Component_GoalPoint: {
		bricks: ["B_GoalPoint"],
		inputs: [],
		outputs: []
	},
	Component_Interact: {
		bricks: [],
		inputs: [
			"ConsoleTag",
			"InteractSound",
			"Message",
			"PromptCustomLabel",
			"bAllowNearbyInteraction",
			"bHiddenInteraction"
		],
		outputs: []
	},
	Component_Internal_AnimatedButton: {
		bricks: [
			"B_Button",
			"B_Button_Pressed",
			"B_Button_Square",
			"B_Button_Square_Pressed"
		],
		inputs: [
			"PressSound",
			"PromptCustomLabel",
			"ReleaseSound",
			"bAllowNearbyInteraction",
			"bHiddenInteraction"
		],
		outputs: [
			"Character",
			"PressCount",
			"bHeld"
		]
	},
	Component_Internal_AnimatedPressurePlate: {
		bricks: [],
		inputs: [
			"BeginTouchSound",
			"EndTouchSound",
			"bCollisionEnabled_Player",
			"bCollisionEnabled_Player1",
			"bCollisionEnabled_Player2",
			"bCollisionEnabled_Player3"
		],
		outputs: [
			"Character",
			"TouchCount",
			"bTouching"
		]
	},
	Component_Internal_AnimatedSwitch: {
		bricks: ["B_Switch_Flipped", "B_Switch_Test"],
		inputs: [
			"InteractSound",
			"PromptCustomLabel",
			"bAllowNearbyInteraction",
			"bHiddenInteraction"
		],
		outputs: ["Character", "bEnabled"]
	},
	Component_Internal_AttachedZone: {
		bricks: ["BP_ZoneProjector"],
		inputs: /* @__PURE__ */ "TagFilter,WaterAbsorption,WaterAbsorption.X,WaterAbsorption.Y,WaterAbsorption.Z,WaterFogAmbientColor,WaterFogAmbientColor.A,WaterFogAmbientColor.B,WaterFogAmbientColor.G,WaterFogAmbientColor.R,WaterFogAmbientScale,WaterFogIntensity,WaterFogScatteringColor,WaterFogScatteringColor.A,WaterFogScatteringColor.B,WaterFogScatteringColor.G,WaterFogScatteringColor.R,WaterFogScatteringScale,WaterScattering,WaterScattering.X,WaterScattering.Y,WaterScattering.Z,ZoneEndDistance,ZoneStartDistance,ZoneWindForce,bDetectEntities,bDetectPlayers,bDetectPlayers1,bDetectPlayers2,bDetectPlayers3,bDetectProjectiles,bIsBuildingZone,bIsLooseZone,bIsShareZone,bWater".split(","),
		outputs: [
			"OccupantCount",
			"ZoneRef",
			"bOccupied"
		]
	},
	Component_Internal_Bearing: {
		bricks: ["B_Joint_Bearing", "B_Joint_Bearing_Micro"],
		inputs: [
			"Damping",
			"LimitAngle",
			"bAnglesArePercentages",
			"bLimitAngle"
		],
		outputs: ["CurrentAngle"]
	},
	Component_Internal_Gyroscope: {
		bricks: ["B_Gyroscope"],
		inputs: [
			"Control_DriveAndSteer",
			"Damping",
			"MaxForce",
			"Strength",
			"TargetAxis",
			"TargetAxis.X",
			"TargetAxis.Y",
			"TargetAxis.Z",
			"bDiscoverable",
			"bEnabled"
		],
		outputs: []
	},
	Component_Internal_InputSplitter: {
		bricks: ["B_1x1_Gate_SeatControlSplitter"],
		inputs: ["Character"],
		outputs: [
			"InputForward",
			"InputMouseWheel",
			"InputPitch",
			"InputRight",
			"InputRoll",
			"InputUp",
			"InputYaw",
			"bPressedC",
			"bPressedE",
			"bPressedLeftMouse",
			"bPressedQ",
			"bPressedRightMouse"
		]
	},
	Component_Internal_Joint_Wheel: {
		bricks: ["B_Joint_Wheel", "B_Joint_Wheel_Micro"],
		inputs: [
			"Control_DriveAndSteer",
			"Damping",
			"DrivePower",
			"DriveSpeed",
			"JointDistance",
			"Steer",
			"SteerLimitDegree",
			"SteerPower",
			"SuspensionDamping",
			"SuspensionStiffness",
			"bAllowEngineSteerCorrect",
			"bCanBrake",
			"bDiscoverable",
			"bDriveWhenNotAttachedToEngine",
			"bEnabled",
			"bReversed",
			"bSteerEnabled",
			"bSuspensionEnabled"
		],
		outputs: []
	},
	Component_Internal_Joint_Wheel_Suspension: {
		bricks: ["B_Joint_Wheel_Micro_Suspension", "B_Joint_Wheel_Suspension"],
		inputs: [
			"Control_DriveAndSteer",
			"Damping",
			"DrivePower",
			"DriveSpeed",
			"JointDistance",
			"Steer",
			"SteerLimitDegree",
			"SteerPower",
			"SuspensionDamping",
			"SuspensionLength",
			"SuspensionOffset",
			"SuspensionStiffness",
			"bAllowEngineSteerCorrect",
			"bCanBrake",
			"bDiscoverable",
			"bDriveWhenNotAttachedToEngine",
			"bEnabled",
			"bReversed",
			"bSteerEnabled",
			"bSuspensionEnabled",
			"bWheelVisible"
		],
		outputs: []
	},
	Component_Internal_Microchip: {
		bricks: ["B_1x1_Microchip"],
		inputs: [],
		outputs: []
	},
	Component_Internal_Motor: {
		bricks: ["B_Joint_Motor", "B_Joint_Motor_Micro"],
		inputs: [
			"Damping",
			"LimitAngle",
			"Power",
			"Speed",
			"bAnglesArePercentages",
			"bEnabled",
			"bLimitAngle"
		],
		outputs: ["CurrentAngle"]
	},
	Component_Internal_MotorSlider: {
		bricks: ["PB_MotorSliderJoint"],
		inputs: [
			"Damping",
			"Power",
			"Speed",
			"bEnabled",
			"bPositionsArePercentages"
		],
		outputs: ["CurrentPosition"]
	},
	Component_Internal_ProjectileSpawner_Cannon: {
		bricks: ["B_2x2_Cannon"],
		inputs: [
			"DamageMultiplier",
			"Direction",
			"FireRate",
			"FireSound",
			"Instigator",
			"NumberOfShots",
			"ProjectileClass",
			"ScaleMultiplier",
			"SpawnLocation",
			"SpawnMargin",
			"SpawnOffsetBias",
			"SpeedMultiplier",
			"SpreadConeAngle",
			"TargetEntity",
			"bEnabled",
			"bEnforceFireRate",
			"bSpreadBiasedTowardsCenter"
		],
		outputs: ["OnFired"]
	},
	Component_Internal_Rerouter: {
		bricks: ["B_1x1_Reroute_Node"],
		inputs: ["RER_Input"],
		outputs: ["RER_Output"]
	},
	Component_Internal_RigidBearing: {
		bricks: ["B_Joint_RigidBearing", "B_Joint_RigidBearing_Micro"],
		inputs: [
			"InterpMode",
			"SmoothTime",
			"TargetAngle",
			"TopSpeed",
			"bAnglesArePercentages"
		],
		outputs: [
			"CurrentAngle",
			"bStopped",
			"bWelded"
		]
	},
	Component_Internal_RigidSlider: {
		bricks: ["PB_RigidSliderJoint"],
		inputs: [
			"InterpMode",
			"SmoothTime",
			"TargetPosition",
			"TopSpeed",
			"bPositionsArePercentages"
		],
		outputs: [
			"CurrentPosition",
			"bStopped",
			"bWelded"
		]
	},
	Component_Internal_Seat: {
		bricks: ["B_Seat"],
		inputs: /* @__PURE__ */ "AirStrafeControl,CameraOrigin,CameraOriginOffset,CameraOriginOffset.X,CameraOriginOffset.Y,CameraOriginOffset.Z,ExitOffset,ExitOffset.X,ExitOffset.Y,ExitOffset.Z,FlightInvertXOverride,FlightInvertYOverride,PromptCustomLabel,SeatMode,ThirdPersonCameraRotation,ThirdPersonCameraRotation.Pitch,ThirdPersonCameraRotation.Roll,ThirdPersonCameraRotation.Yaw,ThirdPersonStartingZoom,bAllowHeldItems,bAllowNearbyInteraction,bFlyingGroundControls,bHiddenInteraction,bRollCameraInThirdPerson,bScaleCameraOriginOffsetWithZoom,bStickyPlaneThrottle".split(","),
		outputs: ["SittingCharacter", "bIsOccupied"]
	},
	Component_Internal_Servo: {
		bricks: ["B_Joint_Servo", "B_Joint_Servo_Micro"],
		inputs: [
			"ActiveDamping",
			"Damping",
			"ForceLimit",
			"LimitAngle",
			"Power",
			"TargetAngle",
			"bAnglesArePercentages",
			"bEnabled",
			"bLimitAngle"
		],
		outputs: ["CurrentAngle", "bStopped"]
	},
	Component_Internal_ServoSlider: {
		bricks: ["PB_ServoSliderJoint"],
		inputs: [
			"Damping",
			"Exponent",
			"Power",
			"TargetPosition",
			"TopSpeed",
			"bEnabled",
			"bPositionsArePercentages"
		],
		outputs: ["CurrentPosition", "bStopped"]
	},
	Component_Internal_Slider: {
		bricks: ["PB_SliderJoint"],
		inputs: ["Damping", "bPositionsArePercentages"],
		outputs: ["CurrentPosition"]
	},
	Component_Internal_Socket: {
		bricks: ["B_Joint_Socket", "B_Joint_Socket_Micro"],
		inputs: [],
		outputs: []
	},
	Component_Internal_Thruster: {
		bricks: ["B_2x2_Thruster"],
		inputs: [
			"Control_DriveAndSteer",
			"Force",
			"ForceApplication",
			"Pitch",
			"Throttle",
			"Yaw",
			"bDiscoverable",
			"bEnabled",
			"bSpawnLight"
		],
		outputs: []
	},
	Component_Internal_WeightBrick: {
		bricks: ["B_1x1_Gate_WeightBrick"],
		inputs: [
			"Mass",
			"MassOffset",
			"MassOffset.X",
			"MassOffset.Y",
			"MassOffset.Z",
			"MassSize",
			"MassSize.X",
			"MassSize.Y",
			"MassSize.Z"
		],
		outputs: []
	},
	Component_Internal_WheelEngine: {
		bricks: ["B_1x1_Gate_WheelEngineSlim", "B_Vehicle_Engine"],
		inputs: /* @__PURE__ */ "ArcadeAeroAuthorityFadeEndSpeed.ArcadeAeroAuthorityFadeStartSpeed.ArcadeAirGripResponseTime.ArcadeMaxLateralAccelerationGs.ArcadePitchRate.ArcadeResponseTime.ArcadeRollRate.ArcadeYawRate.AudioDescriptor.CenterOfSteering.Character.CustomMass.CustomMassVerticalOffset.DriveAcceleratingPowerMultiplier.DriveBrakingPowerMultiplier.DriveDampingMultiplier.DriveInterpSpeed.DriveSpeed.FlightHandling.FlightTopSpeed.GlideTrimStrength.GlideTrimTargetSpeedMultiplier.HorizontalSteeringRollMix.HorizontalSteeringYawMix.KeyboardSteeringRollMix.KeyboardSteeringYawMix.LiftMultiplier.ManualControlMode.ManualInput_Drive.ManualInput_Pitch.ManualInput_Roll.ManualInput_Steer.MassDistribution.PhysicalPitchDampingResponseTime.PhysicalRollDampingResponseTime.PhysicalYawDampingResponseTime.SteerInterpSpeed.SteerLimitDegree.SteerLimitSpeedFalloff.SteerPowerMultiplier.TankSteerSpeedMultiplier.ThrustMultiplier.WaterDriveForce.WaterSteeringForce.WheelFrictionMultiplier.bAutoRight.bAutodiscoverAerodynamicSurfaces.bAutodiscoverGyroscopes.bAutodiscoverThrusters.bAutodiscoverWheels.bDisableInWorldControlDiagnostics.bEnableAerodynamicRateDamping.bEnableAirBraking.bEnableGlideTrim.bEnableManualControl.bEnabled.bManualInput_Brake.bTankSteering".split("."),
		outputs: [
			"Control_DriveAndSteer",
			"Speed",
			"bStalling"
		]
	},
	Component_ItemSpawn: {
		bricks: [],
		inputs: /* @__PURE__ */ "DamageMultiplier,ItemNameOverride,PickupAnimationAxis,PickupAnimationPhase,PickupBobHeight,PickupBobSpeed,PickupClass,PickupMeshColors,PickupMinigameResetRespawnDelay,PickupOffsetDirection,PickupOffsetDistance,PickupRespawnTime,PickupRotation,PickupRotation.Pitch,PickupRotation.Roll,PickupRotation.Yaw,PickupScale,PickupSpinSpeed,ProjectileOverride,WeaponSpeedMultiplier,bOverridePickupColors,bPickupAnimationAxisLocal,bPickupAnimationEnabled,bPickupAutoDisableOnPickup,bPickupEnabled,bPickupRespawnOnMinigameReset,bRenderTranslucentWhenDisabled".split(","),
		outputs: ["bShowPickupEnabled"]
	},
	Component_OneShotAudioEmitter: {
		bricks: ["B_1x1_SoundEmitter"],
		inputs: [
			"AudioDescriptor",
			"InnerRadius",
			"MaxDistance",
			"PitchMultiplier",
			"Play",
			"RepeatCount",
			"RepeatTime",
			"RepeatVariance",
			"Stop",
			"VolumeMultiplier",
			"bEnableRepeat",
			"bSpatialization"
		],
		outputs: []
	},
	Component_PointLight: {
		bricks: [],
		inputs: [
			"Brightness",
			"Color",
			"Color.A",
			"Color.B",
			"Color.G",
			"Color.R",
			"Radius",
			"RayTracingVisibility",
			"bCastShadows",
			"bEnabled",
			"bMatchBrickShape",
			"bUseBrickColor"
		],
		outputs: []
	},
	Component_ProjectileSpawner: {
		bricks: [],
		inputs: [
			"DamageMultiplier",
			"Direction",
			"FireRate",
			"FireSound",
			"Instigator",
			"NumberOfShots",
			"ProjectileClass",
			"ScaleMultiplier",
			"SpawnLocation",
			"SpawnMargin",
			"SpawnOffsetBias",
			"SpeedMultiplier",
			"SpreadConeAngle",
			"TargetEntity",
			"bEnabled",
			"bEnforceFireRate",
			"bSpreadBiasedTowardsCenter"
		],
		outputs: ["OnFired"]
	},
	Component_SpawnPoint: {
		bricks: ["B_SpawnPoint"],
		inputs: ["bEnable", "bRotatePlayerGravityOnSpawn"],
		outputs: []
	},
	Component_SpotLight: {
		bricks: [],
		inputs: [
			"Brightness",
			"Color",
			"Color.A",
			"Color.B",
			"Color.G",
			"Color.R",
			"InnerConeAngle",
			"OuterConeAngle",
			"Radius",
			"RayTracingVisibility",
			"Rotation",
			"Rotation.Pitch",
			"Rotation.Roll",
			"Rotation.Yaw",
			"bCastShadows",
			"bEnabled",
			"bUseBrickColor"
		],
		outputs: []
	},
	Component_Switch: {
		bricks: [],
		inputs: [
			"InteractSound",
			"PromptCustomLabel",
			"bAllowNearbyInteraction",
			"bHiddenInteraction"
		],
		outputs: ["Character", "bEnabled"]
	},
	Component_Target: {
		bricks: ["B_2x2F_Target"],
		inputs: ["OnTime"],
		outputs: [
			"CharacterThatJustHit",
			"Damage",
			"WeaponNameThatJustHit",
			"WeaponThatJustHit",
			"bJustHit"
		]
	},
	Component_TextDisplay: {
		bricks: [],
		inputs: /* @__PURE__ */ "Anchor,Anchor.X,Anchor.Y,Billboard,Color,Color.A,Color.B,Color.G,Color.R,Face,Font,GraffitiAngleLimit,GraffitiDepthLimit,GraffitiLayer,Kerning,LineHeight,LineOffset,Material,MaterialSlider,Offset,Offset.X,Offset.Y,Offset.Z,Outline,OutlineColor,OutlineColor.A,OutlineColor.B,OutlineColor.G,OutlineColor.R,OutlineWidth,Rotation,ScuffWidth,Shading,ShadingWidth,Skew,Text,Typeface,WidthScale,bAlignToWedge,bEnabled,bFlipShading,bForeground,bOverrideColor,bOverrideOutlineColor,bSharpCorners,bSharpOutlines".split(","),
		outputs: []
	},
	Component_Touch: {
		bricks: [],
		inputs: [
			"BeginTouchSound",
			"EndTouchSound",
			"bCollisionEnabled_Player",
			"bCollisionEnabled_Player1",
			"bCollisionEnabled_Player2",
			"bCollisionEnabled_Player3"
		],
		outputs: [
			"Character",
			"TouchCount",
			"bTouching"
		]
	},
	Component_WireGraph_PlayAudioAt: {
		bricks: ["B_1x1_Gate_Exec_Entity_PlayAudioAt"],
		inputs: [
			"Entity",
			"Exec",
			"InnerRadius",
			"MaxDistance",
			"PitchMultiplier",
			"VolumeMultiplier",
			"bSpatialization"
		],
		outputs: ["ExecOut"]
	}
})), la = {
	AerodynamicSurface: {
		NAME: "BrickComponentType_AerodynamicSurface",
		BRICKS: [],
		PORTS: {
			AerodynamicDirection: "AerodynamicDirection",
			Control_DriveAndSteer: "Control_DriveAndSteer",
			Deflection: "Deflection",
			DragCoefficient: "DragCoefficient",
			ForceApplication: "ForceApplication",
			LiftCoefficient: "LiftCoefficient",
			LiftMultiplier: "LiftMultiplier",
			MaxDeflection: "MaxDeflection",
			Role: "Role",
			StallAngle: "StallAngle",
			bDiscoverable: "bDiscoverable",
			bEnabled: "bEnabled"
		}
	},
	Clock: {
		NAME: "BrickComponentType_Clock",
		BRICK: "B_1x1_Gate_Clock",
		BRICKS: ["B_1x1_Gate_Clock"],
		PORTS: {
			IntervalSeconds: "IntervalSeconds",
			bEnabled: "bEnabled",
			Pulse: "Pulse"
		}
	},
	ExplosionSpawner: {
		NAME: "BrickComponentType_ExplosionSpawner",
		BRICKS: [],
		PORTS: {
			DamageMultiplier: "DamageMultiplier",
			Explode: "Explode",
			Instigator: "Instigator",
			ProjectileType: "ProjectileType",
			ScaleMultiplier: "ScaleMultiplier",
			SpawnOffset: "SpawnOffset",
			SpawnOffset_X: "SpawnOffset.X",
			SpawnOffset_Y: "SpawnOffset.Y",
			SpawnOffset_Z: "SpawnOffset.Z"
		}
	},
	Internal_AerodynamicSurface: {
		NAME: "BrickComponentType_Internal_AerodynamicSurface",
		BRICK: "PB_AerodynamicSurface",
		BRICKS: ["PB_AerodynamicSurface"],
		PORTS: {
			Control_DriveAndSteer: "Control_DriveAndSteer",
			Deflection: "Deflection",
			DragCoefficient: "DragCoefficient",
			ForceApplication: "ForceApplication",
			LiftCoefficient: "LiftCoefficient",
			LiftMultiplier: "LiftMultiplier",
			MaxDeflection: "MaxDeflection",
			Role: "Role",
			StallAngle: "StallAngle",
			bDiscoverable: "bDiscoverable",
			bEnabled: "bEnabled"
		}
	},
	AerodynamicSurfaceVertical: {
		NAME: "BrickComponentType_Internal_AerodynamicSurfaceVertical",
		BRICK: "PB_AerodynamicSurfaceVertical",
		BRICKS: ["PB_AerodynamicSurfaceVertical"],
		PORTS: {
			Control_DriveAndSteer: "Control_DriveAndSteer",
			Deflection: "Deflection",
			DragCoefficient: "DragCoefficient",
			ForceApplication: "ForceApplication",
			LiftCoefficient: "LiftCoefficient",
			LiftMultiplier: "LiftMultiplier",
			MaxDeflection: "MaxDeflection",
			Role: "Role",
			StallAngle: "StallAngle",
			bDiscoverable: "bDiscoverable",
			bEnabled: "bEnabled"
		}
	},
	CharacterZoneEvent_Entered: {
		NAME: "BrickComponentType_Internal_CharacterZoneEvent_Entered",
		BRICK: "B_1x1_Gate_Internal_CharacterZoneEvent_Entered",
		BRICKS: ["B_1x1_Gate_Internal_CharacterZoneEvent_Entered"],
		PORTS: {
			TagFilter: "TagFilter",
			Zone: "Zone",
			bCollisionEnabled_Player: "bCollisionEnabled_Player",
			bCollisionEnabled_Player1: "bCollisionEnabled_Player1",
			bCollisionEnabled_Player2: "bCollisionEnabled_Player2",
			bCollisionEnabled_Player3: "bCollisionEnabled_Player3",
			Character: "Character",
			Exec: "Exec"
		}
	},
	CharacterZoneEvent_Left: {
		NAME: "BrickComponentType_Internal_CharacterZoneEvent_Left",
		BRICK: "B_1x1_Gate_Internal_CharacterZoneEvent_Left",
		BRICKS: ["B_1x1_Gate_Internal_CharacterZoneEvent_Left"],
		PORTS: {
			TagFilter: "TagFilter",
			Zone: "Zone",
			bCollisionEnabled_Player: "bCollisionEnabled_Player",
			bCollisionEnabled_Player1: "bCollisionEnabled_Player1",
			bCollisionEnabled_Player2: "bCollisionEnabled_Player2",
			bCollisionEnabled_Player3: "bCollisionEnabled_Player3",
			Character: "Character",
			Exec: "Exec"
		}
	},
	EntityZoneEvent_Entered: {
		NAME: "BrickComponentType_Internal_EntityZoneEvent_Entered",
		BRICK: "B_1x1_Gate_Internal_EntityZoneEvent_Entered",
		BRICKS: ["B_1x1_Gate_Internal_EntityZoneEvent_Entered"],
		PORTS: {
			TagFilter: "TagFilter",
			Zone: "Zone",
			Entity: "Entity",
			Exec: "Exec"
		}
	},
	EntityZoneEvent_Left: {
		NAME: "BrickComponentType_Internal_EntityZoneEvent_Left",
		BRICK: "B_1x1_Gate_Internal_EntityZoneEvent_Left",
		BRICKS: ["B_1x1_Gate_Internal_EntityZoneEvent_Left"],
		PORTS: {
			TagFilter: "TagFilter",
			Zone: "Zone",
			Entity: "Entity",
			Exec: "Exec"
		}
	},
	MicrochipInput: {
		NAME: "BrickComponentType_Internal_MicrochipInput",
		BRICK: "B_1x1_Gate_MicrochipInput",
		BRICKS: ["B_1x1_Gate_MicrochipInput"],
		PORTS: {
			RER_Input: "RER_Input",
			RER_Output: "RER_Output"
		}
	},
	MicrochipOutput: {
		NAME: "BrickComponentType_Internal_MicrochipOutput",
		BRICK: "B_1x1_Gate_MicrochipOutput",
		BRICKS: ["B_1x1_Gate_MicrochipOutput"],
		PORTS: {
			RER_Input: "RER_Input",
			RER_Output: "RER_Output"
		}
	},
	ProjectileZoneEvent_Entered: {
		NAME: "BrickComponentType_Internal_ProjectileZoneEvent_Entered",
		BRICK: "B_1x1_Gate_Internal_ProjectileZoneEvent_Entered",
		BRICKS: ["B_1x1_Gate_Internal_ProjectileZoneEvent_Entered"],
		PORTS: {
			Zone: "Zone",
			Character: "Character",
			Exec: "Exec",
			Projectile: "Projectile",
			Weapon: "Weapon",
			WeaponName: "WeaponName"
		}
	},
	ProjectileZoneEvent_Left: {
		NAME: "BrickComponentType_Internal_ProjectileZoneEvent_Left",
		BRICK: "B_1x1_Gate_Internal_ProjectileZoneEvent_Left",
		BRICKS: ["B_1x1_Gate_Internal_ProjectileZoneEvent_Left"],
		PORTS: {
			Zone: "Zone",
			Character: "Character",
			Exec: "Exec",
			Projectile: "Projectile",
			Weapon: "Weapon",
			WeaponName: "WeaponName"
		}
	},
	ReadBrickGrid: {
		NAME: "BrickComponentType_Internal_ReadBrickGrid",
		BRICK: "B_1x1_Gate_Internal_ReadBrickGrid",
		BRICKS: ["B_1x1_Gate_Internal_ReadBrickGrid"],
		PORTS: { BrickGrid: "BrickGrid" }
	},
	TeleportDestination: {
		NAME: "BrickComponentType_Internal_TeleportDestination",
		BRICK: "B_DestinationPoint",
		BRICKS: ["B_DestinationPoint"],
		PORTS: { ThisDestination: "ThisDestination" }
	},
	ZoneEvent_BrickChanged: {
		NAME: "BrickComponentType_Internal_ZoneEvent_BrickChanged",
		BRICK: "B_1x1_Gate_Internal_ZoneEvent_BrickChanged",
		BRICKS: ["B_1x1_Gate_Internal_ZoneEvent_BrickChanged"],
		PORTS: {
			Zone: "Zone",
			Exec: "Exec"
		}
	},
	ZoneEvent_BrickRemoved: {
		NAME: "BrickComponentType_Internal_ZoneEvent_BrickRemoved",
		BRICK: "B_1x1_Gate_Internal_ZoneEvent_BrickRemoved",
		BRICKS: ["B_1x1_Gate_Internal_ZoneEvent_BrickRemoved"],
		PORTS: {
			Zone: "Zone",
			Exec: "Exec"
		}
	},
	PrefabSpawn: {
		NAME: "BrickComponentType_PrefabSpawn",
		BRICK: "B_Spawn_Point_Prefab",
		BRICKS: ["B_Spawn_Point_Prefab"],
		PORTS: {
			RespawnTime: "RespawnTime",
			SpawnOffset: "SpawnOffset",
			SpawnOffset_X: "SpawnOffset.X",
			SpawnOffset_Y: "SpawnOffset.Y",
			SpawnOffset_Z: "SpawnOffset.Z",
			SpawnOffsetRotation: "SpawnOffsetRotation",
			SpawnOffsetRotation_Pitch: "SpawnOffsetRotation.Pitch",
			SpawnOffsetRotation_Roll: "SpawnOffsetRotation.Roll",
			SpawnOffsetRotation_Yaw: "SpawnOffsetRotation.Yaw",
			SpawnVelocity: "SpawnVelocity",
			SpawnVelocity_X: "SpawnVelocity.X",
			SpawnVelocity_Y: "SpawnVelocity.Y",
			SpawnVelocity_Z: "SpawnVelocity.Z",
			bSpawnEnable: "bSpawnEnable",
			SpawnedEntity: "SpawnedEntity"
		}
	},
	AudioReference: {
		NAME: "BrickComponentType_WireGraph_AudioReference",
		BRICK: "B_1x1_Gate_AudioReference",
		BRICKS: ["B_1x1_Gate_AudioReference"],
		PORTS: { Value: "Value" }
	},
	BrickAssetReference: {
		NAME: "BrickComponentType_WireGraph_BrickAssetReference",
		BRICK: "B_1x1_Gate_BrickAssetReference",
		BRICKS: ["B_1x1_Gate_BrickAssetReference"],
		PORTS: { Value: "Value" }
	},
	DeltaTime: {
		NAME: "BrickComponentType_WireGraph_DeltaTime",
		BRICK: "B_1x1_Gate_DeltaTime",
		BRICKS: ["B_1x1_Gate_DeltaTime"],
		PORTS: { DeltaTime: "DeltaTime" }
	},
	EntityTypeReference: {
		NAME: "BrickComponentType_WireGraph_EntityTypeReference",
		BRICK: "B_1x1_Gate_EntityTypeReference",
		BRICKS: ["B_1x1_Gate_EntityTypeReference"],
		PORTS: { Value: "Value" }
	},
	Exec_ArrayVar_Append: {
		NAME: "BrickComponentType_WireGraph_Exec_ArrayVar_Append",
		BRICK: "B_1x1_Gate_Exec_ArrayVar_Append",
		BRICKS: ["B_1x1_Gate_Exec_ArrayVar_Append"],
		PORTS: {
			ArrayVarRef: "ArrayVarRef",
			Exec: "Exec",
			SourceRef: "SourceRef",
			ExecOut: "ExecOut"
		}
	},
	Exec_ArrayVar_Average: {
		NAME: "BrickComponentType_WireGraph_Exec_ArrayVar_Average",
		BRICK: "B_1x1_Gate_Exec_ArrayVar_Average",
		BRICKS: ["B_1x1_Gate_Exec_ArrayVar_Average"],
		PORTS: {
			ArrayVarRef: "ArrayVarRef",
			Exec: "Exec",
			ExecOut: "ExecOut",
			Value: "Value",
			bIsEmpty: "bIsEmpty"
		}
	},
	Exec_ArrayVar_Clear: {
		NAME: "BrickComponentType_WireGraph_Exec_ArrayVar_Clear",
		BRICK: "B_1x1_Gate_Exec_ArrayVar_Clear",
		BRICKS: ["B_1x1_Gate_Exec_ArrayVar_Clear"],
		PORTS: {
			ArrayVarRef: "ArrayVarRef",
			Exec: "Exec",
			ExecOut: "ExecOut"
		}
	},
	Exec_ArrayVar_CopyFrom: {
		NAME: "BrickComponentType_WireGraph_Exec_ArrayVar_CopyFrom",
		BRICK: "B_1x1_Gate_Exec_ArrayVar_CopyFrom",
		BRICKS: ["B_1x1_Gate_Exec_ArrayVar_CopyFrom"],
		PORTS: {
			ArrayVarRef: "ArrayVarRef",
			Exec: "Exec",
			SourceRef: "SourceRef",
			ExecOut: "ExecOut"
		}
	},
	Exec_ArrayVar_Fill: {
		NAME: "BrickComponentType_WireGraph_Exec_ArrayVar_Fill",
		BRICK: "B_1x1_Gate_Exec_ArrayVar_Fill",
		BRICKS: ["B_1x1_Gate_Exec_ArrayVar_Fill"],
		PORTS: {
			ArrayVarRef: "ArrayVarRef",
			Exec: "Exec",
			Value: "Value",
			ExecOut: "ExecOut"
		}
	},
	Exec_ArrayVar_Find: {
		NAME: "BrickComponentType_WireGraph_Exec_ArrayVar_Find",
		BRICK: "B_1x1_Gate_Exec_ArrayVar_Find",
		BRICKS: ["B_1x1_Gate_Exec_ArrayVar_Find"],
		PORTS: {
			ArrayVarRef: "ArrayVarRef",
			Exec: "Exec",
			Value: "Value",
			ExecOut: "ExecOut",
			Index: "Index",
			bFound: "bFound"
		}
	},
	Exec_ArrayVar_Get: {
		NAME: "BrickComponentType_WireGraph_Exec_ArrayVar_Get",
		BRICK: "B_1x1_Gate_Exec_ArrayVar_Get",
		BRICKS: ["B_1x1_Gate_Exec_ArrayVar_Get"],
		PORTS: {
			ArrayVarRef: "ArrayVarRef",
			Exec: "Exec",
			Index: "Index",
			ExecOut: "ExecOut",
			Value: "Value",
			bOutOfBounds: "bOutOfBounds"
		}
	},
	Exec_ArrayVar_GetLength: {
		NAME: "BrickComponentType_WireGraph_Exec_ArrayVar_GetLength",
		BRICK: "B_1x1_Gate_Exec_ArrayVar_GetLength",
		BRICKS: ["B_1x1_Gate_Exec_ArrayVar_GetLength"],
		PORTS: {
			ArrayVarRef: "ArrayVarRef",
			Exec: "Exec",
			ExecOut: "ExecOut",
			Length: "Length"
		}
	},
	Exec_ArrayVar_Insert: {
		NAME: "BrickComponentType_WireGraph_Exec_ArrayVar_Insert",
		BRICK: "B_1x1_Gate_Exec_ArrayVar_Insert",
		BRICKS: ["B_1x1_Gate_Exec_ArrayVar_Insert"],
		PORTS: {
			ArrayVarRef: "ArrayVarRef",
			Exec: "Exec",
			Index: "Index",
			Value: "Value",
			ExecOut: "ExecOut",
			bOutOfBounds: "bOutOfBounds"
		}
	},
	Exec_ArrayVar_Max: {
		NAME: "BrickComponentType_WireGraph_Exec_ArrayVar_Max",
		BRICK: "B_1x1_Gate_Exec_ArrayVar_Max",
		BRICKS: ["B_1x1_Gate_Exec_ArrayVar_Max"],
		PORTS: {
			ArrayVarRef: "ArrayVarRef",
			Exec: "Exec",
			ExecOut: "ExecOut",
			Value: "Value",
			bIsEmpty: "bIsEmpty"
		}
	},
	Exec_ArrayVar_Min: {
		NAME: "BrickComponentType_WireGraph_Exec_ArrayVar_Min",
		BRICK: "B_1x1_Gate_Exec_ArrayVar_Min",
		BRICKS: ["B_1x1_Gate_Exec_ArrayVar_Min"],
		PORTS: {
			ArrayVarRef: "ArrayVarRef",
			Exec: "Exec",
			ExecOut: "ExecOut",
			Value: "Value",
			bIsEmpty: "bIsEmpty"
		}
	},
	Exec_ArrayVar_Pop: {
		NAME: "BrickComponentType_WireGraph_Exec_ArrayVar_Pop",
		BRICK: "B_1x1_Gate_Exec_ArrayVar_Pop",
		BRICKS: ["B_1x1_Gate_Exec_ArrayVar_Pop"],
		PORTS: {
			ArrayVarRef: "ArrayVarRef",
			Exec: "Exec",
			ExecOut: "ExecOut",
			Value: "Value",
			bIsEmpty: "bIsEmpty"
		}
	},
	Exec_ArrayVar_Push: {
		NAME: "BrickComponentType_WireGraph_Exec_ArrayVar_Push",
		BRICK: "B_1x1_Gate_Exec_ArrayVar_Push",
		BRICKS: ["B_1x1_Gate_Exec_ArrayVar_Push"],
		PORTS: {
			ArrayVarRef: "ArrayVarRef",
			Exec: "Exec",
			Value: "Value",
			ExecOut: "ExecOut"
		}
	},
	Exec_ArrayVar_RemoveAtIndex: {
		NAME: "BrickComponentType_WireGraph_Exec_ArrayVar_RemoveAtIndex",
		BRICK: "B_1x1_Gate_Exec_ArrayVar_RemoveAtIndex",
		BRICKS: ["B_1x1_Gate_Exec_ArrayVar_RemoveAtIndex"],
		PORTS: {
			ArrayVarRef: "ArrayVarRef",
			Exec: "Exec",
			Index: "Index",
			ExecOut: "ExecOut",
			bOutOfBounds: "bOutOfBounds"
		}
	},
	Exec_ArrayVar_Resize: {
		NAME: "BrickComponentType_WireGraph_Exec_ArrayVar_Resize",
		BRICK: "B_1x1_Gate_Exec_ArrayVar_Resize",
		BRICKS: ["B_1x1_Gate_Exec_ArrayVar_Resize"],
		PORTS: {
			ArrayVarRef: "ArrayVarRef",
			Exec: "Exec",
			Size: "Size",
			Value: "Value",
			ExecOut: "ExecOut"
		}
	},
	Exec_ArrayVar_Reverse: {
		NAME: "BrickComponentType_WireGraph_Exec_ArrayVar_Reverse",
		BRICK: "B_1x1_Gate_Exec_ArrayVar_Reverse",
		BRICKS: ["B_1x1_Gate_Exec_ArrayVar_Reverse"],
		PORTS: {
			ArrayVarRef: "ArrayVarRef",
			Exec: "Exec",
			ExecOut: "ExecOut"
		}
	},
	Exec_ArrayVar_SetAtIndex: {
		NAME: "BrickComponentType_WireGraph_Exec_ArrayVar_SetAtIndex",
		BRICK: "B_1x1_Gate_Exec_ArrayVar_SetAtIndex",
		BRICKS: ["B_1x1_Gate_Exec_ArrayVar_SetAtIndex"],
		PORTS: {
			ArrayVarRef: "ArrayVarRef",
			Exec: "Exec",
			Index: "Index",
			Value: "Value",
			ExecOut: "ExecOut"
		}
	},
	Exec_ArrayVar_Shuffle: {
		NAME: "BrickComponentType_WireGraph_Exec_ArrayVar_Shuffle",
		BRICK: "B_1x1_Gate_Exec_ArrayVar_Shuffle",
		BRICKS: ["B_1x1_Gate_Exec_ArrayVar_Shuffle"],
		PORTS: {
			ArrayVarRef: "ArrayVarRef",
			Exec: "Exec",
			ExecOut: "ExecOut"
		}
	},
	Exec_ArrayVar_Slice: {
		NAME: "BrickComponentType_WireGraph_Exec_ArrayVar_Slice",
		BRICK: "B_1x1_Gate_Exec_ArrayVar_Slice",
		BRICKS: ["B_1x1_Gate_Exec_ArrayVar_Slice"],
		PORTS: {
			ArrayVarRef: "ArrayVarRef",
			Count: "Count",
			Exec: "Exec",
			SourceRef: "SourceRef",
			Start: "Start",
			ExecOut: "ExecOut",
			bOutOfBounds: "bOutOfBounds"
		}
	},
	Exec_ArrayVar_Sort: {
		NAME: "BrickComponentType_WireGraph_Exec_ArrayVar_Sort",
		BRICK: "B_1x1_Gate_Exec_ArrayVar_Sort",
		BRICKS: ["B_1x1_Gate_Exec_ArrayVar_Sort"],
		PORTS: {
			ArrayVarRef: "ArrayVarRef",
			Exec: "Exec",
			bDescending: "bDescending",
			ExecOut: "ExecOut"
		}
	},
	Exec_ArrayVar_SortMultiple: {
		NAME: "BrickComponentType_WireGraph_Exec_ArrayVar_SortMultiple",
		BRICK: "B_1x1_Gate_Exec_ArrayVar_SortMultiple",
		BRICKS: ["B_1x1_Gate_Exec_ArrayVar_SortMultiple"],
		PORTS: {
			ArrayVarRef: "ArrayVarRef",
			ArrayVarRef2: "ArrayVarRef2",
			ArrayVarRef3: "ArrayVarRef3",
			ArrayVarRef4: "ArrayVarRef4",
			ArrayVarRef5: "ArrayVarRef5",
			ArrayVarRef6: "ArrayVarRef6",
			ArrayVarRef7: "ArrayVarRef7",
			ArrayVarRef8: "ArrayVarRef8",
			Exec: "Exec",
			bDescending: "bDescending",
			ExecOut: "ExecOut",
			bSuccess: "bSuccess"
		}
	},
	Exec_ArrayVar_Sum: {
		NAME: "BrickComponentType_WireGraph_Exec_ArrayVar_Sum",
		BRICK: "B_1x1_Gate_Exec_ArrayVar_Sum",
		BRICKS: ["B_1x1_Gate_Exec_ArrayVar_Sum"],
		PORTS: {
			ArrayVarRef: "ArrayVarRef",
			Exec: "Exec",
			ExecOut: "ExecOut",
			Value: "Value"
		}
	},
	Exec_ArrayVar_Swap: {
		NAME: "BrickComponentType_WireGraph_Exec_ArrayVar_Swap",
		BRICK: "B_1x1_Gate_Exec_ArrayVar_Swap",
		BRICKS: ["B_1x1_Gate_Exec_ArrayVar_Swap"],
		PORTS: {
			ArrayVarRef: "ArrayVarRef",
			Exec: "Exec",
			IndexA: "IndexA",
			IndexB: "IndexB",
			ExecOut: "ExecOut",
			bOutOfBounds: "bOutOfBounds"
		}
	},
	Exec_Branch: {
		NAME: "BrickComponentType_WireGraph_Exec_Branch",
		BRICK: "B_1x1_Gate_Exec_Branch",
		BRICKS: ["B_1x1_Gate_Exec_Branch"],
		PORTS: {
			Exec: "Exec",
			bCond: "bCond",
			ExecOutA: "ExecOutA",
			ExecOutB: "ExecOutB"
		}
	},
	Exec_Character_AddInventoryBrick: {
		NAME: "BrickComponentType_WireGraph_Exec_Character_AddInventoryBrick",
		BRICK: "B_1x1_Gate_Exec_Character_AddInventoryBrick",
		BRICKS: ["B_1x1_Gate_Exec_Character_AddInventoryBrick"],
		PORTS: {
			BrickAsset: "BrickAsset",
			Character: "Character",
			Exec: "Exec",
			ProceduralSize: "ProceduralSize",
			ProceduralSize_X: "ProceduralSize.X",
			ProceduralSize_Y: "ProceduralSize.Y",
			ProceduralSize_Z: "ProceduralSize.Z",
			ExecOut: "ExecOut"
		}
	},
	Exec_Character_AddInventoryEntity: {
		NAME: "BrickComponentType_WireGraph_Exec_Character_AddInventoryEntity",
		BRICK: "B_1x1_Gate_Exec_Character_AddInventoryEntity",
		BRICKS: ["B_1x1_Gate_Exec_Character_AddInventoryEntity"],
		PORTS: {
			Character: "Character",
			EntityType: "EntityType",
			Exec: "Exec",
			ExecOut: "ExecOut"
		}
	},
	Exec_Character_AddInventoryEntry: {
		NAME: "BrickComponentType_WireGraph_Exec_Character_AddInventoryEntry",
		BRICK: "B_1x1_Gate_Exec_Character_AddInventoryEntry",
		BRICKS: ["B_1x1_Gate_Exec_Character_AddInventoryEntry"],
		PORTS: {
			Character: "Character",
			Exec: "Exec",
			ExecOut: "ExecOut"
		}
	},
	Exec_Character_AddInventoryItem: {
		NAME: "BrickComponentType_WireGraph_Exec_Character_AddInventoryItem",
		BRICK: "B_1x1_Gate_Exec_Character_AddInventoryItem",
		BRICKS: ["B_1x1_Gate_Exec_Character_AddInventoryItem"],
		PORTS: {
			Character: "Character",
			Exec: "Exec",
			Item: "Item",
			ExecOut: "ExecOut"
		}
	},
	Exec_Character_AddInventoryItemAdv: {
		NAME: "BrickComponentType_WireGraph_Exec_Character_AddInventoryItemAdv",
		BRICK: "B_1x1_Gate_Exec_Character_AddInventoryItemAdv",
		BRICKS: ["B_1x1_Gate_Exec_Character_AddInventoryItemAdv"],
		PORTS: {
			Character: "Character",
			DamageMultiplier: "DamageMultiplier",
			Exec: "Exec",
			ItemNameOverride: "ItemNameOverride",
			ItemScale: "ItemScale",
			ItemType: "ItemType",
			ProjectileOverride: "ProjectileOverride",
			WeaponSpeedMultiplier: "WeaponSpeedMultiplier",
			ExecOut: "ExecOut"
		}
	},
	Exec_Character_GetAim: {
		NAME: "BrickComponentType_WireGraph_Exec_Character_GetAim",
		BRICK: "B_1x1_Gate_Exec_Character_GetAim",
		BRICKS: ["B_1x1_Gate_Exec_Character_GetAim"],
		PORTS: {
			Character: "Character",
			Exec: "Exec",
			Direction: "Direction",
			ExecOut: "ExecOut",
			Origin: "Origin"
		}
	},
	Exec_Character_GetAmmo: {
		NAME: "BrickComponentType_WireGraph_Exec_Character_GetAmmo",
		BRICK: "B_1x1_Gate_Exec_Character_GetAmmo",
		BRICKS: ["B_1x1_Gate_Exec_Character_GetAmmo"],
		PORTS: {
			Character: "Character",
			Exec: "Exec",
			Resource: "Resource",
			Amount: "Amount",
			ExecOut: "ExecOut"
		}
	},
	Exec_Character_GetCurrentInventorySlot: {
		NAME: "BrickComponentType_WireGraph_Exec_Character_GetCurrentInventorySlot",
		BRICK: "B_1x1_Gate_Exec_Character_GetCurrentInventorySlot",
		BRICKS: ["B_1x1_Gate_Exec_Character_GetCurrentInventorySlot"],
		PORTS: {
			Character: "Character",
			Exec: "Exec",
			ExecOut: "ExecOut",
			Slot: "Slot"
		}
	},
	Exec_Character_GetDamage: {
		NAME: "BrickComponentType_WireGraph_Exec_Character_GetDamage",
		BRICK: "B_1x1_Gate_Exec_Character_GetDamage",
		BRICKS: ["B_1x1_Gate_Exec_Character_GetDamage"],
		PORTS: {
			Character: "Character",
			Exec: "Exec",
			Damage: "Damage",
			DamageLimit: "DamageLimit",
			ExecOut: "ExecOut"
		}
	},
	Exec_Character_GetFromController: {
		NAME: "BrickComponentType_WireGraph_Exec_Character_GetFromController",
		BRICK: "B_1x1_Gate_Exec_Character_GetFromController",
		BRICKS: ["B_1x1_Gate_Exec_Character_GetFromController"],
		PORTS: {
			Exec: "Exec",
			PlayerState: "PlayerState",
			Character: "Character",
			ExecOut: "ExecOut"
		}
	},
	Exec_Character_GetInventoryEntry: {
		NAME: "BrickComponentType_WireGraph_Exec_Character_GetInventoryEntry",
		BRICK: "B_1x1_Gate_Exec_Character_GetInventoryEntry",
		BRICKS: ["B_1x1_Gate_Exec_Character_GetInventoryEntry"],
		PORTS: {
			Character: "Character",
			Exec: "Exec",
			Slot: "Slot",
			BrickAsset: "BrickAsset",
			EntityType: "EntityType",
			ExecOut: "ExecOut",
			Item: "Item"
		}
	},
	Exec_Character_GetWeaponChamberAmmo: {
		NAME: "BrickComponentType_WireGraph_Exec_Character_GetWeaponChamberAmmo",
		BRICK: "B_1x1_Gate_Exec_Character_GetWeaponChamberAmmo",
		BRICKS: ["B_1x1_Gate_Exec_Character_GetWeaponChamberAmmo"],
		PORTS: {
			Character: "Character",
			Exec: "Exec",
			Resource: "Resource",
			Slot: "Slot",
			Amount: "Amount",
			ExecOut: "ExecOut"
		}
	},
	Exec_Character_GrantAmmo: {
		NAME: "BrickComponentType_WireGraph_Exec_Character_GrantAmmo",
		BRICK: "B_1x1_Gate_Exec_Character_GrantAmmo",
		BRICKS: ["B_1x1_Gate_Exec_Character_GrantAmmo"],
		PORTS: {
			Amount: "Amount",
			Character: "Character",
			Exec: "Exec",
			Resource: "Resource",
			ExecOut: "ExecOut"
		}
	},
	Exec_Character_IncDamage: {
		NAME: "BrickComponentType_WireGraph_Exec_Character_IncDamage",
		BRICK: "B_1x1_Gate_Exec_Character_IncDamage",
		BRICKS: ["B_1x1_Gate_Exec_Character_IncDamage"],
		PORTS: {
			Amount: "Amount",
			Character: "Character",
			Exec: "Exec",
			ExecOut: "ExecOut"
		}
	},
	Exec_Character_IncWeaponChamberAmmo: {
		NAME: "BrickComponentType_WireGraph_Exec_Character_IncWeaponChamberAmmo",
		BRICK: "B_1x1_Gate_Exec_Character_IncWeaponChamberAmmo",
		BRICKS: ["B_1x1_Gate_Exec_Character_IncWeaponChamberAmmo"],
		PORTS: {
			Amount: "Amount",
			Character: "Character",
			Exec: "Exec",
			Resource: "Resource",
			Slot: "Slot",
			ExecOut: "ExecOut"
		}
	},
	Exec_Character_SetAmmo: {
		NAME: "BrickComponentType_WireGraph_Exec_Character_SetAmmo",
		BRICK: "B_1x1_Gate_Exec_Character_SetAmmo",
		BRICKS: ["B_1x1_Gate_Exec_Character_SetAmmo"],
		PORTS: {
			Amount: "Amount",
			Character: "Character",
			Exec: "Exec",
			Resource: "Resource",
			ExecOut: "ExecOut"
		}
	},
	Exec_Character_SetDamage: {
		NAME: "BrickComponentType_WireGraph_Exec_Character_SetDamage",
		BRICK: "B_1x1_Gate_Exec_Character_SetDamage",
		BRICKS: ["B_1x1_Gate_Exec_Character_SetDamage"],
		PORTS: {
			Character: "Character",
			Damage: "Damage",
			Exec: "Exec",
			ExecOut: "ExecOut"
		}
	},
	Exec_Character_SetInventoryBrick: {
		NAME: "BrickComponentType_WireGraph_Exec_Character_SetInventoryBrick",
		BRICK: "B_1x1_Gate_Exec_Character_SetInventoryBrick",
		BRICKS: ["B_1x1_Gate_Exec_Character_SetInventoryBrick"],
		PORTS: {
			BrickAsset: "BrickAsset",
			Character: "Character",
			Exec: "Exec",
			ProceduralSize: "ProceduralSize",
			ProceduralSize_X: "ProceduralSize.X",
			ProceduralSize_Y: "ProceduralSize.Y",
			ProceduralSize_Z: "ProceduralSize.Z",
			Slot: "Slot",
			ExecOut: "ExecOut"
		}
	},
	Exec_Character_SetInventoryEntity: {
		NAME: "BrickComponentType_WireGraph_Exec_Character_SetInventoryEntity",
		BRICK: "B_1x1_Gate_Exec_Character_SetInventoryEntity",
		BRICKS: ["B_1x1_Gate_Exec_Character_SetInventoryEntity"],
		PORTS: {
			Character: "Character",
			EntityType: "EntityType",
			Exec: "Exec",
			Slot: "Slot",
			ExecOut: "ExecOut"
		}
	},
	Exec_Character_SetInventoryEntry: {
		NAME: "BrickComponentType_WireGraph_Exec_Character_SetInventoryEntry",
		BRICK: "B_1x1_Gate_Exec_Character_SetInventoryEntry",
		BRICKS: ["B_1x1_Gate_Exec_Character_SetInventoryEntry"],
		PORTS: {
			Character: "Character",
			Exec: "Exec",
			Slot: "Slot",
			ExecOut: "ExecOut"
		}
	},
	Exec_Character_SetInventoryItem: {
		NAME: "BrickComponentType_WireGraph_Exec_Character_SetInventoryItem",
		BRICK: "B_1x1_Gate_Exec_Character_SetInventoryItem",
		BRICKS: ["B_1x1_Gate_Exec_Character_SetInventoryItem"],
		PORTS: {
			Character: "Character",
			Exec: "Exec",
			Item: "Item",
			Slot: "Slot",
			ExecOut: "ExecOut"
		}
	},
	Exec_Character_SetInventoryItemAdv: {
		NAME: "BrickComponentType_WireGraph_Exec_Character_SetInventoryItemAdv",
		BRICK: "B_1x1_Gate_Exec_Character_SetInventoryItemAdv",
		BRICKS: ["B_1x1_Gate_Exec_Character_SetInventoryItemAdv"],
		PORTS: {
			Character: "Character",
			DamageMultiplier: "DamageMultiplier",
			Exec: "Exec",
			ItemNameOverride: "ItemNameOverride",
			ItemScale: "ItemScale",
			ItemType: "ItemType",
			ProjectileOverride: "ProjectileOverride",
			Slot: "Slot",
			WeaponSpeedMultiplier: "WeaponSpeedMultiplier",
			ExecOut: "ExecOut"
		}
	},
	Exec_Character_SetTempPermission: {
		NAME: "BrickComponentType_WireGraph_Exec_Character_SetTempPermission",
		BRICK: "B_1x1_Gate_Exec_Character_SetTempPermission",
		BRICKS: ["B_1x1_Gate_Exec_Character_SetTempPermission"],
		PORTS: {
			Character: "Character",
			Exec: "Exec",
			bPermissionEnable: "bPermissionEnable",
			ExecOut: "ExecOut"
		}
	},
	Exec_Character_SetWeaponChamberAmmo: {
		NAME: "BrickComponentType_WireGraph_Exec_Character_SetWeaponChamberAmmo",
		BRICK: "B_1x1_Gate_Exec_Character_SetWeaponChamberAmmo",
		BRICKS: ["B_1x1_Gate_Exec_Character_SetWeaponChamberAmmo"],
		PORTS: {
			Amount: "Amount",
			Character: "Character",
			Exec: "Exec",
			Resource: "Resource",
			Slot: "Slot",
			ExecOut: "ExecOut"
		}
	},
	Exec_Character_ShowHint: {
		NAME: "BrickComponentType_WireGraph_Exec_Character_ShowHint",
		BRICK: "B_1x1_Gate_Exec_Character_ShowHint",
		BRICKS: ["B_1x1_Gate_Exec_Character_ShowHint"],
		PORTS: {
			Character: "Character",
			Exec: "Exec",
			ExecOut: "ExecOut"
		}
	},
	Exec_ChatCommand: {
		NAME: "BrickComponentType_WireGraph_Exec_ChatCommand",
		BRICK: "B_1x1_Gate_Exec_ChatCommand",
		BRICKS: ["B_1x1_Gate_Exec_ChatCommand"],
		PORTS: {
			Arguments: "Arguments",
			ExecOut: "ExecOut",
			PlayerState: "PlayerState"
		}
	},
	Exec_Cycle: {
		NAME: "BrickComponentType_WireGraph_Exec_Cycle",
		BRICK: "B_1x1_Gate_Exec_Cycle",
		BRICKS: ["B_1x1_Gate_Exec_Cycle"],
		PORTS: {
			Count: "Count",
			Exec: "Exec",
			ExecDown: "ExecDown",
			ExecOut: "ExecOut",
			ExecOutDown: "ExecOutDown",
			Output: "Output"
		}
	},
	Exec_Entity_AddLocationRotation: {
		NAME: "BrickComponentType_WireGraph_Exec_Entity_AddLocationRotation",
		BRICK: "B_1x1_Gate_Exec_Entity_AddLocationRotation",
		BRICKS: ["B_1x1_Gate_Exec_Entity_AddLocationRotation"],
		PORTS: {
			Entity: "Entity",
			Exec: "Exec",
			Rotation: "Rotation",
			Rotation_Pitch: "Rotation.Pitch",
			Rotation_Roll: "Rotation.Roll",
			Rotation_Yaw: "Rotation.Yaw",
			Vector: "Vector",
			Vector_X: "Vector.X",
			Vector_Y: "Vector.Y",
			Vector_Z: "Vector.Z",
			ExecOut: "ExecOut"
		}
	},
	Exec_Entity_AddVelocity: {
		NAME: "BrickComponentType_WireGraph_Exec_Entity_AddVelocity",
		BRICK: "B_1x1_Gate_Exec_Entity_AddVelocity",
		BRICKS: ["B_1x1_Gate_Exec_Entity_AddVelocity"],
		PORTS: {
			Entity: "Entity",
			Exec: "Exec",
			Rotation: "Rotation",
			Rotation_X: "Rotation.X",
			Rotation_Y: "Rotation.Y",
			Rotation_Z: "Rotation.Z",
			Vector: "Vector",
			Vector_X: "Vector.X",
			Vector_Y: "Vector.Y",
			Vector_Z: "Vector.Z",
			ExecOut: "ExecOut"
		}
	},
	Exec_Entity_DestroySpawned: {
		NAME: "BrickComponentType_WireGraph_Exec_Entity_DestroySpawned",
		BRICK: "B_1x1_Gate_Exec_Entity_DestroySpawned",
		BRICKS: ["B_1x1_Gate_Exec_Entity_DestroySpawned"],
		PORTS: {
			Entity: "Entity",
			Exec: "Exec",
			ExecOut: "ExecOut"
		}
	},
	Exec_Entity_DestroySpawnedPrefab: {
		NAME: "BrickComponentType_WireGraph_Exec_Entity_DestroySpawnedPrefab",
		BRICK: "B_1x1_Gate_Exec_Entity_DestroySpawnedPrefab",
		BRICKS: ["B_1x1_Gate_Exec_Entity_DestroySpawnedPrefab"],
		PORTS: {
			Entity: "Entity",
			Exec: "Exec",
			ExecOut: "ExecOut"
		}
	},
	Exec_Entity_GetAngularVelocity: {
		NAME: "BrickComponentType_WireGraph_Exec_Entity_GetAngularVelocity",
		BRICK: "B_1x1_Gate_Exec_Entity_GetAngularVelocity",
		BRICKS: ["B_1x1_Gate_Exec_Entity_GetAngularVelocity"],
		PORTS: {
			Entity: "Entity",
			Exec: "Exec",
			AngularVelocity: "AngularVelocity",
			ExecOut: "ExecOut"
		}
	},
	Exec_Entity_GetLinearVelocity: {
		NAME: "BrickComponentType_WireGraph_Exec_Entity_GetLinearVelocity",
		BRICK: "B_1x1_Gate_Exec_Entity_GetLinearVelocity",
		BRICKS: ["B_1x1_Gate_Exec_Entity_GetLinearVelocity"],
		PORTS: {
			Entity: "Entity",
			Exec: "Exec",
			ExecOut: "ExecOut",
			LinearVelocity: "LinearVelocity"
		}
	},
	Exec_Entity_GetLocation: {
		NAME: "BrickComponentType_WireGraph_Exec_Entity_GetLocation",
		BRICK: "B_1x1_Gate_Exec_Entity_GetLocation",
		BRICKS: ["B_1x1_Gate_Exec_Entity_GetLocation"],
		PORTS: {
			Entity: "Entity",
			Exec: "Exec",
			ExecOut: "ExecOut",
			Vector: "Vector"
		}
	},
	Exec_Entity_GetLocationRotation: {
		NAME: "BrickComponentType_WireGraph_Exec_Entity_GetLocationRotation",
		BRICK: "B_1x1_Gate_Exec_Entity_GetLocationRotation",
		BRICKS: ["B_1x1_Gate_Exec_Entity_GetLocationRotation"],
		PORTS: {
			Entity: "Entity",
			Exec: "Exec",
			ExecOut: "ExecOut",
			Rotation: "Rotation",
			Vector: "Vector"
		}
	},
	Exec_Entity_GetRotation: {
		NAME: "BrickComponentType_WireGraph_Exec_Entity_GetRotation",
		BRICK: "B_1x1_Gate_Exec_Entity_GetRotation",
		BRICKS: ["B_1x1_Gate_Exec_Entity_GetRotation"],
		PORTS: {
			Entity: "Entity",
			Exec: "Exec",
			ExecOut: "ExecOut",
			Rotation: "Rotation"
		}
	},
	Exec_Entity_GetSpeed: {
		NAME: "BrickComponentType_WireGraph_Exec_Entity_GetSpeed",
		BRICK: "B_1x1_Gate_Exec_Entity_GetSpeed",
		BRICKS: ["B_1x1_Gate_Exec_Entity_GetSpeed"],
		PORTS: {
			Entity: "Entity",
			Exec: "Exec",
			ExecOut: "ExecOut",
			Speed: "Speed"
		}
	},
	Exec_Entity_GetTag: {
		NAME: "BrickComponentType_WireGraph_Exec_Entity_GetTag",
		BRICK: "B_1x1_Gate_Exec_Entity_GetTag",
		BRICKS: ["B_1x1_Gate_Exec_Entity_GetTag"],
		PORTS: {
			Entity: "Entity",
			Exec: "Exec",
			ExecOut: "ExecOut",
			Tag: "Tag"
		}
	},
	Exec_Entity_GetTeam: {
		NAME: "BrickComponentType_WireGraph_Exec_Entity_GetTeam",
		BRICK: "B_1x1_Gate_Exec_Entity_GetTeam",
		BRICKS: ["B_1x1_Gate_Exec_Entity_GetTeam"],
		PORTS: {
			Entity: "Entity",
			Exec: "Exec",
			ExecOut: "ExecOut",
			Team: "Team"
		}
	},
	Exec_Entity_GetVelocity: {
		NAME: "BrickComponentType_WireGraph_Exec_Entity_GetVelocity",
		BRICK: "B_1x1_Gate_Exec_Entity_GetVelocity",
		BRICKS: ["B_1x1_Gate_Exec_Entity_GetVelocity"],
		PORTS: {
			Entity: "Entity",
			Exec: "Exec",
			ExecOut: "ExecOut",
			Rotation: "Rotation",
			Vector: "Vector"
		}
	},
	Exec_Entity_GetVelocityAtPoint: {
		NAME: "BrickComponentType_WireGraph_Exec_Entity_GetVelocityAtPoint",
		BRICK: "B_1x1_Gate_Exec_Entity_GetVelocityAtPoint",
		BRICKS: ["B_1x1_Gate_Exec_Entity_GetVelocityAtPoint"],
		PORTS: {
			Entity: "Entity",
			Exec: "Exec",
			Point: "Point",
			Point_X: "Point.X",
			Point_Y: "Point.Y",
			Point_Z: "Point.Z",
			ExecOut: "ExecOut",
			LinearVelocity: "LinearVelocity"
		}
	},
	Exec_Entity_IsFrozen: {
		NAME: "BrickComponentType_WireGraph_Exec_Entity_IsFrozen",
		BRICK: "B_1x1_Gate_Exec_Entity_IsFrozen",
		BRICKS: ["B_1x1_Gate_Exec_Entity_IsFrozen"],
		PORTS: {
			Entity: "Entity",
			Exec: "Exec",
			ExecOut: "ExecOut",
			bFrozen: "bFrozen"
		}
	},
	Exec_Entity_RelativeTeleport: {
		NAME: "BrickComponentType_WireGraph_Exec_Entity_RelativeTeleport",
		BRICK: "B_1x1_Gate_Exec_Entity_RelativeTeleport",
		BRICKS: ["B_1x1_Gate_Exec_Entity_RelativeTeleport"],
		PORTS: {
			Destination: "Destination",
			Entity: "Entity",
			Exec: "Exec",
			Source: "Source",
			ExecOut: "ExecOut"
		}
	},
	Exec_Entity_SetAngularVelocity: {
		NAME: "BrickComponentType_WireGraph_Exec_Entity_SetAngularVelocity",
		BRICK: "B_1x1_Gate_Exec_Entity_SetAngularVelocity",
		BRICKS: ["B_1x1_Gate_Exec_Entity_SetAngularVelocity"],
		PORTS: {
			AngularVelocity: "AngularVelocity",
			AngularVelocity_X: "AngularVelocity.X",
			AngularVelocity_Y: "AngularVelocity.Y",
			AngularVelocity_Z: "AngularVelocity.Z",
			Entity: "Entity",
			Exec: "Exec",
			ExecOut: "ExecOut"
		}
	},
	Exec_Entity_SetFrozen: {
		NAME: "BrickComponentType_WireGraph_Exec_Entity_SetFrozen",
		BRICK: "B_1x1_Gate_Exec_Entity_SetFrozen",
		BRICKS: ["B_1x1_Gate_Exec_Entity_SetFrozen"],
		PORTS: {
			Entity: "Entity",
			Exec: "Exec",
			bFrozen: "bFrozen",
			ExecOut: "ExecOut"
		}
	},
	Exec_Entity_SetGravityDirection: {
		NAME: "BrickComponentType_WireGraph_Exec_Entity_SetGravityDirection",
		BRICK: "B_1x1_Gate_Exec_Entity_SetGravityDirection",
		BRICKS: ["B_1x1_Gate_Exec_Entity_SetGravityDirection"],
		PORTS: {
			Entity: "Entity",
			Exec: "Exec",
			Rotation: "Rotation",
			Rotation_Pitch: "Rotation.Pitch",
			Rotation_Roll: "Rotation.Roll",
			Rotation_Yaw: "Rotation.Yaw",
			ExecOut: "ExecOut"
		}
	},
	Exec_Entity_SetLinearVelocity: {
		NAME: "BrickComponentType_WireGraph_Exec_Entity_SetLinearVelocity",
		BRICK: "B_1x1_Gate_Exec_Entity_SetLinearVelocity",
		BRICKS: ["B_1x1_Gate_Exec_Entity_SetLinearVelocity"],
		PORTS: {
			Entity: "Entity",
			Exec: "Exec",
			LinearVelocity: "LinearVelocity",
			LinearVelocity_X: "LinearVelocity.X",
			LinearVelocity_Y: "LinearVelocity.Y",
			LinearVelocity_Z: "LinearVelocity.Z",
			ExecOut: "ExecOut"
		}
	},
	Exec_Entity_SetLocation: {
		NAME: "BrickComponentType_WireGraph_Exec_Entity_SetLocation",
		BRICK: "B_1x1_Gate_Exec_Entity_SetLocation",
		BRICKS: ["B_1x1_Gate_Exec_Entity_SetLocation"],
		PORTS: {
			Entity: "Entity",
			Exec: "Exec",
			Vector: "Vector",
			Vector_X: "Vector.X",
			Vector_Y: "Vector.Y",
			Vector_Z: "Vector.Z",
			ExecOut: "ExecOut"
		}
	},
	Exec_Entity_SetLocationRotation: {
		NAME: "BrickComponentType_WireGraph_Exec_Entity_SetLocationRotation",
		BRICK: "B_1x1_Gate_Exec_Entity_SetLocationRotation",
		BRICKS: ["B_1x1_Gate_Exec_Entity_SetLocationRotation"],
		PORTS: {
			Entity: "Entity",
			Exec: "Exec",
			Rotation: "Rotation",
			Rotation_Pitch: "Rotation.Pitch",
			Rotation_Roll: "Rotation.Roll",
			Rotation_Yaw: "Rotation.Yaw",
			Vector: "Vector",
			Vector_X: "Vector.X",
			Vector_Y: "Vector.Y",
			Vector_Z: "Vector.Z",
			ExecOut: "ExecOut"
		}
	},
	Exec_Entity_SetRotation: {
		NAME: "BrickComponentType_WireGraph_Exec_Entity_SetRotation",
		BRICK: "B_1x1_Gate_Exec_Entity_SetRotation",
		BRICKS: ["B_1x1_Gate_Exec_Entity_SetRotation"],
		PORTS: {
			Entity: "Entity",
			Exec: "Exec",
			Rotation: "Rotation",
			Rotation_Pitch: "Rotation.Pitch",
			Rotation_Roll: "Rotation.Roll",
			Rotation_Yaw: "Rotation.Yaw",
			ExecOut: "ExecOut"
		}
	},
	Exec_Entity_SetTag: {
		NAME: "BrickComponentType_WireGraph_Exec_Entity_SetTag",
		BRICK: "B_1x1_Gate_Exec_Entity_SetTag",
		BRICKS: ["B_1x1_Gate_Exec_Entity_SetTag"],
		PORTS: {
			Entity: "Entity",
			Exec: "Exec",
			Tag: "Tag",
			ExecOut: "ExecOut"
		}
	},
	Exec_Entity_SetTeam: {
		NAME: "BrickComponentType_WireGraph_Exec_Entity_SetTeam",
		BRICK: "B_1x1_Gate_Exec_Entity_SetTeam",
		BRICKS: ["B_1x1_Gate_Exec_Entity_SetTeam"],
		PORTS: {
			Entity: "Entity",
			Exec: "Exec",
			Team: "Team",
			ExecOut: "ExecOut"
		}
	},
	Exec_Entity_SetVelocity: {
		NAME: "BrickComponentType_WireGraph_Exec_Entity_SetVelocity",
		BRICK: "B_1x1_Gate_Exec_Entity_SetVelocity",
		BRICKS: ["B_1x1_Gate_Exec_Entity_SetVelocity"],
		PORTS: {
			Entity: "Entity",
			Exec: "Exec",
			Rotation: "Rotation",
			Rotation_X: "Rotation.X",
			Rotation_Y: "Rotation.Y",
			Rotation_Z: "Rotation.Z",
			Vector: "Vector",
			Vector_X: "Vector.X",
			Vector_Y: "Vector.Y",
			Vector_Z: "Vector.Z",
			ExecOut: "ExecOut"
		}
	},
	Exec_Entity_Teleport: {
		NAME: "BrickComponentType_WireGraph_Exec_Entity_Teleport",
		BRICK: "B_1x1_Gate_Exec_Entity_Teleport",
		BRICKS: ["B_1x1_Gate_Exec_Entity_Teleport"],
		PORTS: {
			Destination: "Destination",
			Entity: "Entity",
			Exec: "Exec",
			ExecOut: "ExecOut"
		}
	},
	Exec_Gamemode_BroadcastChatMessage: {
		NAME: "BrickComponentType_WireGraph_Exec_Gamemode_BroadcastChatMessage",
		BRICK: "B_1x1_Gate_Exec_Gamemode_BroadcastChatMessage",
		BRICKS: ["B_1x1_Gate_Exec_Gamemode_BroadcastChatMessage"],
		PORTS: {
			Exec: "Exec",
			Message: "Message",
			ExecOut: "ExecOut"
		}
	},
	Exec_Gamemode_BroadcastStatusMessage: {
		NAME: "BrickComponentType_WireGraph_Exec_Gamemode_BroadcastStatusMessage",
		BRICK: "B_1x1_Gate_Exec_Gamemode_BroadcastStatusMessage",
		BRICKS: ["B_1x1_Gate_Exec_Gamemode_BroadcastStatusMessage"],
		PORTS: {
			Exec: "Exec",
			Message: "Message",
			bFlashIfUnchanged: "bFlashIfUnchanged",
			ExecOut: "ExecOut"
		}
	},
	Exec_Gamemode_FillArrayFromPlayers: {
		NAME: "BrickComponentType_WireGraph_Exec_Gamemode_FillArrayFromPlayers",
		BRICK: "B_1x1_Gate_Exec_Gamemode_FillArrayFromPlayers",
		BRICKS: ["B_1x1_Gate_Exec_Gamemode_FillArrayFromPlayers"],
		PORTS: {
			ArrayVarRef: "ArrayVarRef",
			Exec: "Exec",
			bIncludeBuilderMode: "bIncludeBuilderMode",
			ExecOut: "ExecOut"
		}
	},
	Exec_Gamemode_FillArrayFromTeamMembers: {
		NAME: "BrickComponentType_WireGraph_Exec_Gamemode_FillArrayFromTeamMembers",
		BRICK: "B_1x1_Gate_Exec_Gamemode_FillArrayFromTeamMembers",
		BRICKS: ["B_1x1_Gate_Exec_Gamemode_FillArrayFromTeamMembers"],
		PORTS: {
			ArrayVarRef: "ArrayVarRef",
			Exec: "Exec",
			Team: "Team",
			ExecOut: "ExecOut"
		}
	},
	Exec_Gamemode_GetCurrentRound: {
		NAME: "BrickComponentType_WireGraph_Exec_Gamemode_GetCurrentRound",
		BRICK: "B_1x1_Gate_Exec_Gamemode_GetCurrentRound",
		BRICKS: ["B_1x1_Gate_Exec_Gamemode_GetCurrentRound"],
		PORTS: {
			Exec: "Exec",
			ExecOut: "ExecOut",
			RoundNumber: "RoundNumber"
		}
	},
	Exec_Gamemode_GetLeaderboardValue: {
		NAME: "BrickComponentType_WireGraph_Exec_Gamemode_GetLeaderboardValue",
		BRICK: "B_1x1_Gate_Exec_Gamemode_GetLeaderboardValue",
		BRICKS: ["B_1x1_Gate_Exec_Gamemode_GetLeaderboardValue"],
		PORTS: {
			Exec: "Exec",
			Key: "Key",
			PlayerState: "PlayerState",
			ExecOut: "ExecOut",
			Value: "Value"
		}
	},
	Exec_Gamemode_GetTeam: {
		NAME: "BrickComponentType_WireGraph_Exec_Gamemode_GetTeam",
		BRICK: "B_1x1_Gate_Exec_Gamemode_GetTeam",
		BRICKS: ["B_1x1_Gate_Exec_Gamemode_GetTeam"],
		PORTS: {
			Character: "Character",
			Exec: "Exec",
			ExecOut: "ExecOut",
			Team: "Team"
		}
	},
	Exec_Gamemode_GetTeamByName: {
		NAME: "BrickComponentType_WireGraph_Exec_Gamemode_GetTeamByName",
		BRICK: "B_1x1_Gate_Exec_Gamemode_GetTeamByName",
		BRICKS: ["B_1x1_Gate_Exec_Gamemode_GetTeamByName"],
		PORTS: {
			Exec: "Exec",
			TeamName: "TeamName",
			ExecOut: "ExecOut",
			Team: "Team"
		}
	},
	Exec_Gamemode_GetTeamLeaderboardValue: {
		NAME: "BrickComponentType_WireGraph_Exec_Gamemode_GetTeamLeaderboardValue",
		BRICK: "B_1x1_Gate_Exec_Gamemode_GetTeamLeaderboardValue",
		BRICKS: ["B_1x1_Gate_Exec_Gamemode_GetTeamLeaderboardValue"],
		PORTS: {
			Exec: "Exec",
			Key: "Key",
			Team: "Team",
			ExecOut: "ExecOut",
			Value: "Value"
		}
	},
	Exec_Gamemode_GetTeamName: {
		NAME: "BrickComponentType_WireGraph_Exec_Gamemode_GetTeamName",
		BRICK: "B_1x1_Gate_Exec_Gamemode_GetTeamName",
		BRICKS: ["B_1x1_Gate_Exec_Gamemode_GetTeamName"],
		PORTS: {
			Exec: "Exec",
			Team: "Team",
			ExecOut: "ExecOut",
			Name: "Name"
		}
	},
	Exec_Gamemode_IncrementLeaderboardValue: {
		NAME: "BrickComponentType_WireGraph_Exec_Gamemode_IncrementLeaderboardValue",
		BRICK: "B_1x1_Gate_Exec_Gamemode_IncrementLeaderboardValue",
		BRICKS: ["B_1x1_Gate_Exec_Gamemode_IncrementLeaderboardValue"],
		PORTS: {
			Exec: "Exec",
			Key: "Key",
			PlayerState: "PlayerState",
			Value: "Value",
			ExecOut: "ExecOut"
		}
	},
	Exec_Gamemode_IncrementTeamLeaderboardValue: {
		NAME: "BrickComponentType_WireGraph_Exec_Gamemode_IncrementTeamLeaderboardValue",
		BRICK: "B_1x1_Gate_Exec_Gamemode_IncrementTeamLeaderboardValue",
		BRICKS: ["B_1x1_Gate_Exec_Gamemode_IncrementTeamLeaderboardValue"],
		PORTS: {
			Exec: "Exec",
			Key: "Key",
			Team: "Team",
			Value: "Value",
			ExecOut: "ExecOut"
		}
	},
	Exec_Gamemode_PlayerWins: {
		NAME: "BrickComponentType_WireGraph_Exec_Gamemode_PlayerWins",
		BRICK: "B_1x1_Gate_Exec_Gamemode_PlayerWins",
		BRICKS: ["B_1x1_Gate_Exec_Gamemode_PlayerWins"],
		PORTS: {
			Exec: "Exec",
			Player: "Player",
			bTeamWinsInstead: "bTeamWinsInstead",
			ExecOut: "ExecOut"
		}
	},
	Exec_Gamemode_SetLeaderboardValue: {
		NAME: "BrickComponentType_WireGraph_Exec_Gamemode_SetLeaderboardValue",
		BRICK: "B_1x1_Gate_Exec_Gamemode_SetLeaderboardValue",
		BRICKS: ["B_1x1_Gate_Exec_Gamemode_SetLeaderboardValue"],
		PORTS: {
			Exec: "Exec",
			Key: "Key",
			PlayerState: "PlayerState",
			Value: "Value",
			ExecOut: "ExecOut"
		}
	},
	Exec_Gamemode_SetTeam: {
		NAME: "BrickComponentType_WireGraph_Exec_Gamemode_SetTeam",
		BRICK: "B_1x1_Gate_Exec_Gamemode_SetTeam",
		BRICKS: ["B_1x1_Gate_Exec_Gamemode_SetTeam"],
		PORTS: {
			Exec: "Exec",
			PlayerState: "PlayerState",
			Team: "Team",
			bPinPlayerToTeam: "bPinPlayerToTeam",
			ExecOut: "ExecOut"
		}
	},
	Exec_Gamemode_SetTeamLeaderboardValue: {
		NAME: "BrickComponentType_WireGraph_Exec_Gamemode_SetTeamLeaderboardValue",
		BRICK: "B_1x1_Gate_Exec_Gamemode_SetTeamLeaderboardValue",
		BRICKS: ["B_1x1_Gate_Exec_Gamemode_SetTeamLeaderboardValue"],
		PORTS: {
			Exec: "Exec",
			Key: "Key",
			Team: "Team",
			Value: "Value",
			ExecOut: "ExecOut"
		}
	},
	Exec_Gamemode_SetTeamPinned: {
		NAME: "BrickComponentType_WireGraph_Exec_Gamemode_SetTeamPinned",
		BRICK: "B_1x1_Gate_Exec_Gamemode_SetTeamPinned",
		BRICKS: ["B_1x1_Gate_Exec_Gamemode_SetTeamPinned"],
		PORTS: {
			Exec: "Exec",
			PlayerState: "PlayerState",
			bPinned: "bPinned",
			ExecOut: "ExecOut"
		}
	},
	Exec_Gamemode_TeamWins: {
		NAME: "BrickComponentType_WireGraph_Exec_Gamemode_TeamWins",
		BRICK: "B_1x1_Gate_Exec_Gamemode_TeamWins",
		BRICKS: ["B_1x1_Gate_Exec_Gamemode_TeamWins"],
		PORTS: {
			Exec: "Exec",
			Team: "Team",
			ExecOut: "ExecOut"
		}
	},
	Exec_GetInputs: {
		NAME: "BrickComponentType_WireGraph_Exec_GetInputs",
		BRICK: "B_1x1_Gate_Exec_GetInputs",
		BRICKS: ["B_1x1_Gate_Exec_GetInputs"],
		PORTS: {
			Exec: "Exec",
			Player: "Player",
			ExecOut: "ExecOut",
			InputForward: "InputForward",
			InputMouseWheel: "InputMouseWheel",
			InputPitch: "InputPitch",
			InputRight: "InputRight",
			InputRoll: "InputRoll",
			InputUp: "InputUp",
			InputYaw: "InputYaw",
			bPressedC: "bPressedC",
			bPressedE: "bPressedE",
			bPressedLeftMouse: "bPressedLeftMouse",
			bPressedQ: "bPressedQ",
			bPressedRightMouse: "bPressedRightMouse"
		}
	},
	Exec_GetOwnTransform: {
		NAME: "BrickComponentType_WireGraph_Exec_GetOwnTransform",
		BRICK: "B_1x1_Gate_Exec_GetOwnTransform",
		BRICKS: ["B_1x1_Gate_Exec_GetOwnTransform"],
		PORTS: {
			Exec: "Exec",
			ExecOut: "ExecOut",
			Location: "Location",
			Rotation: "Rotation"
		}
	},
	Exec_MapVar_Clear: {
		NAME: "BrickComponentType_WireGraph_Exec_MapVar_Clear",
		BRICK: "B_1x1_Gate_Exec_MapVar_Clear",
		BRICKS: ["B_1x1_Gate_Exec_MapVar_Clear"],
		PORTS: {
			Exec: "Exec",
			MapVarRef: "MapVarRef",
			ExecOut: "ExecOut"
		}
	},
	Exec_MapVar_CopyFrom: {
		NAME: "BrickComponentType_WireGraph_Exec_MapVar_CopyFrom",
		BRICK: "B_1x1_Gate_Exec_MapVar_CopyFrom",
		BRICKS: ["B_1x1_Gate_Exec_MapVar_CopyFrom"],
		PORTS: {
			Exec: "Exec",
			MapVarRef: "MapVarRef",
			SourceRef: "SourceRef",
			ExecOut: "ExecOut"
		}
	},
	Exec_MapVar_Get: {
		NAME: "BrickComponentType_WireGraph_Exec_MapVar_Get",
		BRICK: "B_1x1_Gate_Exec_MapVar_Get",
		BRICKS: ["B_1x1_Gate_Exec_MapVar_Get"],
		PORTS: {
			Exec: "Exec",
			Key: "Key",
			MapVarRef: "MapVarRef",
			ExecOut: "ExecOut",
			Value: "Value",
			bFound: "bFound"
		}
	},
	Exec_MapVar_GetKeys: {
		NAME: "BrickComponentType_WireGraph_Exec_MapVar_GetKeys",
		BRICK: "B_1x1_Gate_Exec_MapVar_GetKeys",
		BRICKS: ["B_1x1_Gate_Exec_MapVar_GetKeys"],
		PORTS: {
			ArrayVarRef: "ArrayVarRef",
			Exec: "Exec",
			MapVarRef: "MapVarRef",
			ExecOut: "ExecOut"
		}
	},
	Exec_MapVar_GetLength: {
		NAME: "BrickComponentType_WireGraph_Exec_MapVar_GetLength",
		BRICK: "B_1x1_Gate_Exec_MapVar_GetLength",
		BRICKS: ["B_1x1_Gate_Exec_MapVar_GetLength"],
		PORTS: {
			Exec: "Exec",
			MapVarRef: "MapVarRef",
			ExecOut: "ExecOut",
			Length: "Length"
		}
	},
	Exec_MapVar_GetValues: {
		NAME: "BrickComponentType_WireGraph_Exec_MapVar_GetValues",
		BRICK: "B_1x1_Gate_Exec_MapVar_GetValues",
		BRICKS: ["B_1x1_Gate_Exec_MapVar_GetValues"],
		PORTS: {
			ArrayVarRef: "ArrayVarRef",
			Exec: "Exec",
			MapVarRef: "MapVarRef",
			ExecOut: "ExecOut"
		}
	},
	Exec_MapVar_Has: {
		NAME: "BrickComponentType_WireGraph_Exec_MapVar_Has",
		BRICK: "B_1x1_Gate_Exec_MapVar_Has",
		BRICKS: ["B_1x1_Gate_Exec_MapVar_Has"],
		PORTS: {
			Exec: "Exec",
			Key: "Key",
			MapVarRef: "MapVarRef",
			ExecOut: "ExecOut",
			bFound: "bFound"
		}
	},
	Exec_MapVar_Remove: {
		NAME: "BrickComponentType_WireGraph_Exec_MapVar_Remove",
		BRICK: "B_1x1_Gate_Exec_MapVar_Remove",
		BRICKS: ["B_1x1_Gate_Exec_MapVar_Remove"],
		PORTS: {
			Exec: "Exec",
			Key: "Key",
			MapVarRef: "MapVarRef",
			ExecOut: "ExecOut",
			bFound: "bFound"
		}
	},
	Exec_MapVar_Set: {
		NAME: "BrickComponentType_WireGraph_Exec_MapVar_Set",
		BRICK: "B_1x1_Gate_Exec_MapVar_Set",
		BRICKS: ["B_1x1_Gate_Exec_MapVar_Set"],
		PORTS: {
			Exec: "Exec",
			Key: "Key",
			MapVarRef: "MapVarRef",
			Value: "Value",
			ExecOut: "ExecOut"
		}
	},
	Exec_PlayClientAudio: {
		NAME: "BrickComponentType_WireGraph_Exec_PlayClientAudio",
		BRICK: "B_1x1_Gate_Exec_PlayClientAudio",
		BRICKS: ["B_1x1_Gate_Exec_PlayClientAudio"],
		PORTS: {
			Exec: "Exec",
			PitchMultiplier: "PitchMultiplier",
			Player: "Player",
			VolumeMultiplier: "VolumeMultiplier",
			ExecOut: "ExecOut"
		}
	},
	Exec_PlayerState_DisplayText: {
		NAME: "BrickComponentType_WireGraph_Exec_PlayerState_DisplayText",
		BRICK: "B_1x1_Gate_Exec_PlayerState_DisplayText",
		BRICKS: ["B_1x1_Gate_Exec_PlayerState_DisplayText"],
		PORTS: {
			Anchor: "Anchor",
			Anchor_X: "Anchor.X",
			Anchor_Y: "Anchor.Y",
			Angle: "Angle",
			Exec: "Exec",
			FontColor: "FontColor",
			LetterSpacing: "LetterSpacing",
			Lifetime: "Lifetime",
			LineHeight: "LineHeight",
			OutlineColor: "OutlineColor",
			OutlineSize: "OutlineSize",
			Pivot: "Pivot",
			Pivot_X: "Pivot.X",
			Pivot_Y: "Pivot.Y",
			PlayerState: "PlayerState",
			Position: "Position",
			Position_X: "Position.X",
			Position_Y: "Position.Y",
			Scale: "Scale",
			Scale_X: "Scale.X",
			Scale_Y: "Scale.Y",
			ShadowColor: "ShadowColor",
			ShadowOffset: "ShadowOffset",
			ShadowOffset_X: "ShadowOffset.X",
			ShadowOffset_Y: "ShadowOffset.Y",
			Skew: "Skew",
			Text: "Text",
			TextId: "TextId",
			Transition: "Transition",
			WrapWidth: "WrapWidth",
			ZOrder: "ZOrder",
			bMiteredOutline: "bMiteredOutline",
			ExecOut: "ExecOut",
			TextIdOut: "TextIdOut"
		}
	},
	Exec_PlayerState_ForceRespawn: {
		NAME: "BrickComponentType_WireGraph_Exec_PlayerState_ForceRespawn",
		BRICK: "B_1x1_Gate_Exec_PlayerState_ForceRespawn",
		BRICKS: ["B_1x1_Gate_Exec_PlayerState_ForceRespawn"],
		PORTS: {
			Exec: "Exec",
			PlayerState: "PlayerState",
			ExecOut: "ExecOut"
		}
	},
	Exec_PlayerState_GetDisplayName: {
		NAME: "BrickComponentType_WireGraph_Exec_PlayerState_GetDisplayName",
		BRICK: "B_1x1_Gate_Exec_PlayerState_GetDisplayName",
		BRICKS: ["B_1x1_Gate_Exec_PlayerState_GetDisplayName"],
		PORTS: {
			Exec: "Exec",
			PlayerState: "PlayerState",
			DisplayName: "DisplayName",
			ExecOut: "ExecOut"
		}
	},
	Exec_PlayerState_GetFromEntity: {
		NAME: "BrickComponentType_WireGraph_Exec_PlayerState_GetFromEntity",
		BRICK: "B_1x1_Gate_Exec_PlayerState_GetFromEntity",
		BRICKS: ["B_1x1_Gate_Exec_PlayerState_GetFromEntity"],
		PORTS: {
			Entity: "Entity",
			Exec: "Exec",
			ExecOut: "ExecOut",
			PlayerState: "PlayerState"
		}
	},
	Exec_PlayerState_GetUserId: {
		NAME: "BrickComponentType_WireGraph_Exec_PlayerState_GetUserId",
		BRICK: "B_1x1_Gate_Exec_PlayerState_GetUserId",
		BRICKS: ["B_1x1_Gate_Exec_PlayerState_GetUserId"],
		PORTS: {
			Exec: "Exec",
			PlayerState: "PlayerState",
			ExecOut: "ExecOut",
			UserId: "UserId"
		}
	},
	Exec_PlayerState_GetUserName: {
		NAME: "BrickComponentType_WireGraph_Exec_PlayerState_GetUserName",
		BRICK: "B_1x1_Gate_Exec_PlayerState_GetUserName",
		BRICKS: ["B_1x1_Gate_Exec_PlayerState_GetUserName"],
		PORTS: {
			Exec: "Exec",
			PlayerState: "PlayerState",
			ExecOut: "ExecOut",
			UserName: "UserName"
		}
	},
	Exec_PlayerState_HasPermission: {
		NAME: "BrickComponentType_WireGraph_Exec_PlayerState_HasPermission",
		BRICK: "B_1x1_Gate_Exec_PlayerState_HasPermission",
		BRICKS: ["B_1x1_Gate_Exec_PlayerState_HasPermission"],
		PORTS: {
			Exec: "Exec",
			PlayerState: "PlayerState",
			ExecOut: "ExecOut",
			bHasPermission: "bHasPermission"
		}
	},
	Exec_PlayerState_HasRole: {
		NAME: "BrickComponentType_WireGraph_Exec_PlayerState_HasRole",
		BRICK: "B_1x1_Gate_Exec_PlayerState_HasRole",
		BRICKS: ["B_1x1_Gate_Exec_PlayerState_HasRole"],
		PORTS: {
			Exec: "Exec",
			PlayerState: "PlayerState",
			ExecOut: "ExecOut",
			bHasRole: "bHasRole"
		}
	},
	Exec_PlayerState_IsTrustedByBrickOwner: {
		NAME: "BrickComponentType_WireGraph_Exec_PlayerState_IsTrustedByBrickOwner",
		BRICK: "B_1x1_Gate_Exec_PlayerState_IsTrustedByBrickOwner",
		BRICKS: ["B_1x1_Gate_Exec_PlayerState_IsTrustedByBrickOwner"],
		PORTS: {
			Exec: "Exec",
			PlayerState: "PlayerState",
			ExecOut: "ExecOut",
			bIsTrusted: "bIsTrusted"
		}
	},
	Exec_PlayerState_SetCanRespawn: {
		NAME: "BrickComponentType_WireGraph_Exec_PlayerState_SetCanRespawn",
		BRICK: "B_1x1_Gate_Exec_PlayerState_SetCanRespawn",
		BRICKS: ["B_1x1_Gate_Exec_PlayerState_SetCanRespawn"],
		PORTS: {
			Exec: "Exec",
			PlayerState: "PlayerState",
			bCanRespawn: "bCanRespawn",
			ExecOut: "ExecOut"
		}
	},
	Exec_PlayerState_ShowChatMessage: {
		NAME: "BrickComponentType_WireGraph_Exec_PlayerState_ShowChatMessage",
		BRICK: "B_1x1_Gate_Exec_PlayerState_ShowChatMessage",
		BRICKS: ["B_1x1_Gate_Exec_PlayerState_ShowChatMessage"],
		PORTS: {
			Exec: "Exec",
			Message: "Message",
			PlayerState: "PlayerState",
			ExecOut: "ExecOut"
		}
	},
	Exec_PlayerState_ShowMessageBox: {
		NAME: "BrickComponentType_WireGraph_Exec_PlayerState_ShowMessageBox",
		BRICK: "B_1x1_Gate_Exec_PlayerState_ShowMessageBox",
		BRICKS: ["B_1x1_Gate_Exec_PlayerState_ShowMessageBox"],
		PORTS: {
			Exec: "Exec",
			Message: "Message",
			PlayerState: "PlayerState",
			Title: "Title",
			ExecOut: "ExecOut"
		}
	},
	Exec_PlayerState_ShowStatusMessage: {
		NAME: "BrickComponentType_WireGraph_Exec_PlayerState_ShowStatusMessage",
		BRICK: "B_1x1_Gate_Exec_PlayerState_ShowStatusMessage",
		BRICKS: ["B_1x1_Gate_Exec_PlayerState_ShowStatusMessage"],
		PORTS: {
			Exec: "Exec",
			Message: "Message",
			PlayerState: "PlayerState",
			ExecOut: "ExecOut"
		}
	},
	Exec_PlayGlobalAudio: {
		NAME: "BrickComponentType_WireGraph_Exec_PlayGlobalAudio",
		BRICK: "B_1x1_Gate_Exec_PlayGlobalAudio",
		BRICKS: ["B_1x1_Gate_Exec_PlayGlobalAudio"],
		PORTS: {
			Exec: "Exec",
			PitchMultiplier: "PitchMultiplier",
			VolumeMultiplier: "VolumeMultiplier",
			ExecOut: "ExecOut"
		}
	},
	Exec_PrefabSpawner: {
		NAME: "BrickComponentType_WireGraph_Exec_PrefabSpawner",
		BRICK: "B_1x1_Gate_Exec_PrefabSpawner",
		BRICKS: ["B_1x1_Gate_Exec_PrefabSpawner"],
		PORTS: {
			DestroyAll: "DestroyAll",
			Exec: "Exec",
			Lifetime: "Lifetime",
			Limit: "Limit",
			SpawnOffset: "SpawnOffset",
			SpawnOffset_X: "SpawnOffset.X",
			SpawnOffset_Y: "SpawnOffset.Y",
			SpawnOffset_Z: "SpawnOffset.Z",
			SpawnOffsetRotation: "SpawnOffsetRotation",
			SpawnOffsetRotation_Pitch: "SpawnOffsetRotation.Pitch",
			SpawnOffsetRotation_Roll: "SpawnOffsetRotation.Roll",
			SpawnOffsetRotation_Yaw: "SpawnOffsetRotation.Yaw",
			SpawnVelocity: "SpawnVelocity",
			SpawnVelocity_X: "SpawnVelocity.X",
			SpawnVelocity_Y: "SpawnVelocity.Y",
			SpawnVelocity_Z: "SpawnVelocity.Z",
			Entity: "Entity",
			ExecOut: "ExecOut"
		}
	},
	Exec_PrintToConsole: {
		NAME: "BrickComponentType_WireGraph_Exec_PrintToConsole",
		BRICK: "B_1x1_Gate_Exec_PrintToConsole",
		BRICKS: ["B_1x1_Gate_Exec_PrintToConsole"],
		PORTS: {
			Exec: "Exec",
			Text: "Text",
			ExecOut: "ExecOut"
		}
	},
	Exec_Random: {
		NAME: "BrickComponentType_WireGraph_Exec_Random",
		BRICK: "B_1x1_Gate_Exec_Random",
		BRICKS: ["B_1x1_Gate_Exec_Random"],
		PORTS: {
			Exec: "Exec",
			Max: "Max",
			Min: "Min",
			ExecOut: "ExecOut",
			Output: "Output"
		}
	},
	Exec_SpawnExplosion: {
		NAME: "BrickComponentType_WireGraph_Exec_SpawnExplosion",
		BRICK: "B_1x1_Gate_Exec_SpawnExplosion",
		BRICKS: ["B_1x1_Gate_Exec_SpawnExplosion"],
		PORTS: {
			DamageMultiplier: "DamageMultiplier",
			Exec: "Exec",
			Instigator: "Instigator",
			ProjectileType: "ProjectileType",
			ScaleMultiplier: "ScaleMultiplier",
			SpawnOffset: "SpawnOffset",
			SpawnOffset_X: "SpawnOffset.X",
			SpawnOffset_Y: "SpawnOffset.Y",
			SpawnOffset_Z: "SpawnOffset.Z",
			ExecOut: "ExecOut"
		}
	},
	Exec_SpawnExplosionAt: {
		NAME: "BrickComponentType_WireGraph_Exec_SpawnExplosionAt",
		BRICK: "B_1x1_Gate_Exec_SpawnExplosionAt",
		BRICKS: ["B_1x1_Gate_Exec_SpawnExplosionAt"],
		PORTS: {
			DamageMultiplier: "DamageMultiplier",
			Exec: "Exec",
			Instigator: "Instigator",
			ProjectileType: "ProjectileType",
			ScaleMultiplier: "ScaleMultiplier",
			WorldPosition: "WorldPosition",
			WorldPosition_X: "WorldPosition.X",
			WorldPosition_Y: "WorldPosition.Y",
			WorldPosition_Z: "WorldPosition.Z",
			ExecOut: "ExecOut"
		}
	},
	Exec_Sweep: {
		NAME: "BrickComponentType_WireGraph_Exec_Sweep",
		BRICK: "B_1x1_Gate_Exec_Sweep",
		BRICKS: ["B_1x1_Gate_Exec_Sweep"],
		PORTS: {
			AdditionalIgnoredEntities: "AdditionalIgnoredEntities",
			CollisionChannel: "CollisionChannel",
			Direction: "Direction",
			Direction_X: "Direction.X",
			Direction_Y: "Direction.Y",
			Direction_Z: "Direction.Z",
			Distance: "Distance",
			Exec: "Exec",
			IgnoreEntity: "IgnoreEntity",
			Origin: "Origin",
			Origin_X: "Origin.X",
			Origin_Y: "Origin.Y",
			Origin_Z: "Origin.Z",
			Radius: "Radius",
			bDetectBricks: "bDetectBricks",
			bDetectMap: "bDetectMap",
			bDetectPhysics: "bDetectPhysics",
			bDetectPlayers1: "bDetectPlayers1",
			bDetectPlayers2: "bDetectPlayers2",
			bDetectPlayers3: "bDetectPlayers3",
			bDetectPlayers4: "bDetectPlayers4",
			bIgnoreOwningGrid: "bIgnoreOwningGrid",
			bRelative: "bRelative",
			ExecOut: "ExecOut",
			Hit: "Hit",
			HitColor: "HitColor",
			HitDistance: "HitDistance",
			HitEntity: "HitEntity",
			HitLocation: "HitLocation",
			HitNormal: "HitNormal",
			Miss: "Miss"
		}
	},
	Exec_SweepSimple: {
		NAME: "BrickComponentType_WireGraph_Exec_SweepSimple",
		BRICK: "B_1x1_Gate_Exec_SweepSimple",
		BRICKS: ["B_1x1_Gate_Exec_SweepSimple"],
		PORTS: {
			CollisionChannel: "CollisionChannel",
			Distance: "Distance",
			Exec: "Exec",
			Radius: "Radius",
			SpreadConeAngle: "SpreadConeAngle",
			ExecOut: "ExecOut",
			Hit: "Hit",
			HitColor: "HitColor",
			HitDistance: "HitDistance",
			HitEntity: "HitEntity",
			HitLocation: "HitLocation",
			HitNormal: "HitNormal",
			Miss: "Miss"
		}
	},
	Exec_Toggle: {
		NAME: "BrickComponentType_WireGraph_Exec_Toggle",
		BRICK: "B_1x1_Gate_Exec_Toggle",
		BRICKS: ["B_1x1_Gate_Exec_Toggle"],
		PORTS: {
			Exec: "Exec",
			ExecOut: "ExecOut",
			Output: "Output"
		}
	},
	Exec_Union: {
		NAME: "BrickComponentType_WireGraph_Exec_Union",
		BRICK: "B_1x1_Gate_Exec_Union",
		BRICKS: ["B_1x1_Gate_Exec_Union"],
		PORTS: {
			ExecA: "ExecA",
			ExecB: "ExecB",
			ExecOut: "ExecOut"
		}
	},
	Exec_Var_Get: {
		NAME: "BrickComponentType_WireGraph_Exec_Var_Get",
		BRICK: "B_1x1_Gate_Exec_Var_Get",
		BRICKS: ["B_1x1_Gate_Exec_Var_Get"],
		PORTS: {
			Exec: "Exec",
			VarRef: "VarRef",
			ExecOut: "ExecOut",
			Value: "Value"
		}
	},
	Exec_Var_Increment: {
		NAME: "BrickComponentType_WireGraph_Exec_Var_Increment",
		BRICK: "B_1x1_Gate_Exec_Var_Increment",
		BRICKS: ["B_1x1_Gate_Exec_Var_Increment"],
		PORTS: {
			Exec: "Exec",
			Value: "Value",
			VarRef: "VarRef",
			ExecOut: "ExecOut"
		}
	},
	Exec_Var_Set: {
		NAME: "BrickComponentType_WireGraph_Exec_Var_Set",
		BRICK: "B_1x1_Gate_Exec_Var_Set",
		BRICKS: ["B_1x1_Gate_Exec_Var_Set"],
		PORTS: {
			Exec: "Exec",
			Value: "Value",
			VarRef: "VarRef",
			ExecOut: "ExecOut"
		}
	},
	Exec_WholeGridInteracted: {
		NAME: "BrickComponentType_WireGraph_Exec_WholeGridInteracted",
		BRICKS: [],
		PORTS: {
			Character: "Character",
			bHeld: "bHeld"
		}
	},
	Exec_WholeGridTargeted: {
		NAME: "BrickComponentType_WireGraph_Exec_WholeGridTargeted",
		BRICKS: [],
		PORTS: {
			CharacterThatJustHit: "CharacterThatJustHit",
			Damage: "Damage",
			Targeted: "Targeted",
			WeaponNameThatJustHit: "WeaponNameThatJustHit",
			WeaponThatJustHit: "WeaponThatJustHit"
		}
	},
	Exec_Zone_GetEntities: {
		NAME: "BrickComponentType_WireGraph_Exec_Zone_GetEntities",
		BRICK: "B_1x1_Gate_Exec_Zone_GetEntities",
		BRICKS: ["B_1x1_Gate_Exec_Zone_GetEntities"],
		PORTS: {
			ArrayVarRef: "ArrayVarRef",
			Exec: "Exec",
			TagFilter: "TagFilter",
			Zone: "Zone",
			ExecOut: "ExecOut"
		}
	},
	Exec_Zone_GetPlayers: {
		NAME: "BrickComponentType_WireGraph_Exec_Zone_GetPlayers",
		BRICK: "B_1x1_Gate_Exec_Zone_GetPlayers",
		BRICKS: ["B_1x1_Gate_Exec_Zone_GetPlayers"],
		PORTS: {
			ArrayVarRef: "ArrayVarRef",
			Exec: "Exec",
			TagFilter: "TagFilter",
			Zone: "Zone",
			ExecOut: "ExecOut"
		}
	},
	Expr_BitwiseAND: {
		NAME: "BrickComponentType_WireGraph_Expr_BitwiseAND",
		BRICK: "B_1x1_Gate_Expr_BitwiseAND",
		BRICKS: ["B_1x1_Gate_Expr_BitwiseAND"],
		PORTS: {
			InputA: "InputA",
			InputB: "InputB",
			Output: "Output"
		}
	},
	Expr_BitwiseBitCount: {
		NAME: "BrickComponentType_WireGraph_Expr_BitwiseBitCount",
		BRICK: "B_1x1_Gate_Expr_BitwiseBitCount",
		BRICKS: ["B_1x1_Gate_Expr_BitwiseBitCount"],
		PORTS: {
			Input: "Input",
			Output: "Output"
		}
	},
	Expr_BitwiseNAND: {
		NAME: "BrickComponentType_WireGraph_Expr_BitwiseNAND",
		BRICK: "B_1x1_Gate_Expr_BitwiseNAND",
		BRICKS: ["B_1x1_Gate_Expr_BitwiseNAND"],
		PORTS: {
			InputA: "InputA",
			InputB: "InputB",
			Output: "Output"
		}
	},
	Expr_BitwiseNOR: {
		NAME: "BrickComponentType_WireGraph_Expr_BitwiseNOR",
		BRICK: "B_1x1_Gate_Expr_BitwiseNOR",
		BRICKS: ["B_1x1_Gate_Expr_BitwiseNOR"],
		PORTS: {
			InputA: "InputA",
			InputB: "InputB",
			Output: "Output"
		}
	},
	Expr_BitwiseNOT: {
		NAME: "BrickComponentType_WireGraph_Expr_BitwiseNOT",
		BRICK: "B_1x1_Gate_Expr_BitwiseNOT",
		BRICKS: ["B_1x1_Gate_Expr_BitwiseNOT"],
		PORTS: {
			Input: "Input",
			Output: "Output"
		}
	},
	Expr_BitwiseOR: {
		NAME: "BrickComponentType_WireGraph_Expr_BitwiseOR",
		BRICK: "B_1x1_Gate_Expr_BitwiseOR",
		BRICKS: ["B_1x1_Gate_Expr_BitwiseOR"],
		PORTS: {
			InputA: "InputA",
			InputB: "InputB",
			Output: "Output"
		}
	},
	Expr_BitwiseShiftLeft: {
		NAME: "BrickComponentType_WireGraph_Expr_BitwiseShiftLeft",
		BRICK: "B_1x1_Gate_Expr_BitwiseShiftLeft",
		BRICKS: ["B_1x1_Gate_Expr_BitwiseShiftLeft"],
		PORTS: {
			InputA: "InputA",
			InputB: "InputB",
			Output: "Output"
		}
	},
	Expr_BitwiseShiftRight: {
		NAME: "BrickComponentType_WireGraph_Expr_BitwiseShiftRight",
		BRICK: "B_1x1_Gate_Expr_BitwiseShiftRight",
		BRICKS: ["B_1x1_Gate_Expr_BitwiseShiftRight"],
		PORTS: {
			InputA: "InputA",
			InputB: "InputB",
			Output: "Output"
		}
	},
	Expr_BitwiseShiftRightLogical: {
		NAME: "BrickComponentType_WireGraph_Expr_BitwiseShiftRightLogical",
		BRICK: "B_1x1_Gate_Expr_BitwiseShiftRightLogical",
		BRICKS: ["B_1x1_Gate_Expr_BitwiseShiftRightLogical"],
		PORTS: {
			InputA: "InputA",
			InputB: "InputB",
			Output: "Output"
		}
	},
	Expr_BitwiseXOR: {
		NAME: "BrickComponentType_WireGraph_Expr_BitwiseXOR",
		BRICK: "B_1x1_Gate_Expr_BitwiseXOR",
		BRICKS: ["B_1x1_Gate_Expr_BitwiseXOR"],
		PORTS: {
			InputA: "InputA",
			InputB: "InputB",
			Output: "Output"
		}
	},
	Expr_Ceil: {
		NAME: "BrickComponentType_WireGraph_Expr_Ceil",
		BRICK: "B_1x1_Gate_Expr_Ceil",
		BRICKS: ["B_1x1_Gate_Expr_Ceil"],
		PORTS: {
			Input: "Input",
			Output: "Output"
		}
	},
	Expr_ChangeDetector: {
		NAME: "BrickComponentType_WireGraph_Expr_ChangeDetector",
		BRICK: "B_1x1_Gate_Expr_ChangeDetector",
		BRICKS: ["B_1x1_Gate_Expr_ChangeDetector"],
		PORTS: {
			Input: "Input",
			bPulseOnChange: "bPulseOnChange"
		}
	},
	Expr_ChangeDetectorExec: {
		NAME: "BrickComponentType_WireGraph_Expr_ChangeDetectorExec",
		BRICK: "B_1x1_Gate_Expr_ChangeDetectorExec",
		BRICKS: ["B_1x1_Gate_Expr_ChangeDetectorExec"],
		PORTS: {
			Input: "Input",
			OnChanged: "OnChanged"
		}
	},
	Expr_ColorBlend: {
		NAME: "BrickComponentType_WireGraph_Expr_ColorBlend",
		BRICK: "B_1x1_Gate_Expr_ColorBlend",
		BRICKS: ["B_1x1_Gate_Expr_ColorBlend"],
		PORTS: {
			Alpha: "Alpha",
			ColorA: "ColorA",
			ColorB: "ColorB",
			Output: "Output"
		}
	},
	Expr_ColorConvert: {
		NAME: "BrickComponentType_WireGraph_Expr_ColorConvert",
		BRICK: "B_1x1_Gate_Expr_ColorConvert",
		BRICKS: ["B_1x1_Gate_Expr_ColorConvert"],
		PORTS: {
			Input: "Input",
			Output: "Output"
		}
	},
	Expr_ColorToHex: {
		NAME: "BrickComponentType_WireGraph_Expr_ColorToHex",
		BRICK: "B_1x1_Gate_Expr_ColorToHex",
		BRICKS: ["B_1x1_Gate_Expr_ColorToHex"],
		PORTS: {
			Input: "Input",
			Hex: "Hex"
		}
	},
	Expr_CompareEqual: {
		NAME: "BrickComponentType_WireGraph_Expr_CompareEqual",
		BRICK: "B_1x1_Gate_Expr_CompareEqual",
		BRICKS: ["B_1x1_Gate_Expr_CompareEqual"],
		PORTS: {
			InputA: "InputA",
			InputB: "InputB",
			bOutput: "bOutput"
		}
	},
	Expr_CompareGreater: {
		NAME: "BrickComponentType_WireGraph_Expr_CompareGreater",
		BRICK: "B_1x1_Gate_Expr_CompareGreater",
		BRICKS: ["B_1x1_Gate_Expr_CompareGreater"],
		PORTS: {
			InputA: "InputA",
			InputB: "InputB",
			bOutput: "bOutput"
		}
	},
	Expr_CompareGreaterOrEqual: {
		NAME: "BrickComponentType_WireGraph_Expr_CompareGreaterOrEqual",
		BRICK: "B_1x1_Gate_Expr_CompareGreaterOrEqual",
		BRICKS: ["B_1x1_Gate_Expr_CompareGreaterOrEqual"],
		PORTS: {
			InputA: "InputA",
			InputB: "InputB",
			bOutput: "bOutput"
		}
	},
	Expr_CompareLess: {
		NAME: "BrickComponentType_WireGraph_Expr_CompareLess",
		BRICK: "B_1x1_Gate_Expr_CompareLess",
		BRICKS: ["B_1x1_Gate_Expr_CompareLess"],
		PORTS: {
			InputA: "InputA",
			InputB: "InputB",
			bOutput: "bOutput"
		}
	},
	Expr_CompareLessOrEqual: {
		NAME: "BrickComponentType_WireGraph_Expr_CompareLessOrEqual",
		BRICK: "B_1x1_Gate_Expr_CompareLessOrEqual",
		BRICKS: ["B_1x1_Gate_Expr_CompareLessOrEqual"],
		PORTS: {
			InputA: "InputA",
			InputB: "InputB",
			bOutput: "bOutput"
		}
	},
	Expr_CompareNotEqual: {
		NAME: "BrickComponentType_WireGraph_Expr_CompareNotEqual",
		BRICK: "B_1x1_Gate_Expr_CompareNotEqual",
		BRICKS: ["B_1x1_Gate_Expr_CompareNotEqual"],
		PORTS: {
			InputA: "InputA",
			InputB: "InputB",
			bOutput: "bOutput"
		}
	},
	Expr_Convert: {
		NAME: "BrickComponentType_WireGraph_Expr_Convert",
		BRICK: "B_1x1_Gate_Expr_Convert",
		BRICKS: ["B_1x1_Gate_Expr_Convert"],
		PORTS: {
			Input: "Input",
			Output: "Output"
		}
	},
	Expr_DirectionToRotation: {
		NAME: "BrickComponentType_WireGraph_Expr_DirectionToRotation",
		BRICK: "B_1x1_Gate_Expr_DirectionToRotation",
		BRICKS: ["B_1x1_Gate_Expr_DirectionToRotation"],
		PORTS: {
			Direction: "Direction",
			Direction_X: "Direction.X",
			Direction_Y: "Direction.Y",
			Direction_Z: "Direction.Z",
			Output: "Output"
		}
	},
	Expr_EdgeDetector: {
		NAME: "BrickComponentType_WireGraph_Expr_EdgeDetector",
		BRICK: "B_1x1_Gate_Expr_EdgeDetector",
		BRICKS: ["B_1x1_Gate_Expr_EdgeDetector"],
		PORTS: {
			Input: "Input",
			bPulseOnFallingEdge: "bPulseOnFallingEdge",
			bPulseOnRisingEdge: "bPulseOnRisingEdge"
		}
	},
	Expr_EdgeDetectorExec: {
		NAME: "BrickComponentType_WireGraph_Expr_EdgeDetectorExec",
		BRICK: "B_1x1_Gate_Expr_EdgeDetectorExec",
		BRICKS: ["B_1x1_Gate_Expr_EdgeDetectorExec"],
		PORTS: {
			Input: "Input",
			OnFallingEdge: "OnFallingEdge",
			OnRisingEdge: "OnRisingEdge"
		}
	},
	Expr_EnumToInteger: {
		NAME: "BrickComponentType_WireGraph_Expr_EnumToInteger",
		BRICK: "B_1x1_Gate_Expr_EnumToInteger",
		BRICKS: ["B_1x1_Gate_Expr_EnumToInteger"],
		PORTS: {
			Input: "Input",
			Output: "Output"
		}
	},
	Expr_Floor: {
		NAME: "BrickComponentType_WireGraph_Expr_Floor",
		BRICK: "B_1x1_Gate_Expr_Floor",
		BRICKS: ["B_1x1_Gate_Expr_Floor"],
		PORTS: {
			Input: "Input",
			Output: "Output"
		}
	},
	Expr_Gamemode_IsBuilderTeam: {
		NAME: "BrickComponentType_WireGraph_Expr_Gamemode_IsBuilderTeam",
		BRICK: "B_1x1_Gate_Expr_Gamemode_IsBuilderTeam",
		BRICKS: ["B_1x1_Gate_Expr_Gamemode_IsBuilderTeam"],
		PORTS: {
			Team: "Team",
			bResult: "bResult"
		}
	},
	Expr_Gamemode_IsUnaffiliatedTeam: {
		NAME: "BrickComponentType_WireGraph_Expr_Gamemode_IsUnaffiliatedTeam",
		BRICK: "B_1x1_Gate_Expr_Gamemode_IsUnaffiliatedTeam",
		BRICKS: ["B_1x1_Gate_Expr_Gamemode_IsUnaffiliatedTeam"],
		PORTS: {
			Team: "Team",
			bResult: "bResult"
		}
	},
	Expr_IntegerToEnum: {
		NAME: "BrickComponentType_WireGraph_Expr_IntegerToEnum",
		BRICK: "B_1x1_Gate_Expr_IntegerToEnum",
		BRICKS: ["B_1x1_Gate_Expr_IntegerToEnum"],
		PORTS: {
			Input: "Input",
			bWrap: "bWrap",
			Output: "Output"
		}
	},
	Expr_InvertRotation: {
		NAME: "BrickComponentType_WireGraph_Expr_InvertRotation",
		BRICK: "B_1x1_Gate_Expr_InvertRotation",
		BRICKS: ["B_1x1_Gate_Expr_InvertRotation"],
		PORTS: {
			Input: "Input",
			Input_W: "Input.W",
			Input_X: "Input.X",
			Input_Y: "Input.Y",
			Input_Z: "Input.Z",
			Output: "Output"
		}
	},
	Expr_ItemToPickup: {
		NAME: "BrickComponentType_WireGraph_Expr_ItemToPickup",
		BRICK: "B_1x1_Gate_Expr_ItemToPickup",
		BRICKS: ["B_1x1_Gate_Expr_ItemToPickup"],
		PORTS: {
			Input: "Input",
			Output: "Output"
		}
	},
	Expr_LogicalAND: {
		NAME: "BrickComponentType_WireGraph_Expr_LogicalAND",
		BRICK: "B_1x1_Gate_Expr_LogicalAND",
		BRICKS: ["B_1x1_Gate_Expr_LogicalAND"],
		PORTS: {
			bInputA: "bInputA",
			bInputB: "bInputB",
			bOutput: "bOutput"
		}
	},
	Expr_LogicalNAND: {
		NAME: "BrickComponentType_WireGraph_Expr_LogicalNAND",
		BRICK: "B_1x1_Gate_Expr_LogicalNAND",
		BRICKS: ["B_1x1_Gate_Expr_LogicalNAND"],
		PORTS: {
			bInputA: "bInputA",
			bInputB: "bInputB",
			bOutput: "bOutput"
		}
	},
	Expr_LogicalNOR: {
		NAME: "BrickComponentType_WireGraph_Expr_LogicalNOR",
		BRICK: "B_1x1_Gate_Expr_LogicalNOR",
		BRICKS: ["B_1x1_Gate_Expr_LogicalNOR"],
		PORTS: {
			bInputA: "bInputA",
			bInputB: "bInputB",
			bOutput: "bOutput"
		}
	},
	Expr_LogicalNOT: {
		NAME: "BrickComponentType_WireGraph_Expr_LogicalNOT",
		BRICK: "B_1x1_Gate_Expr_LogicalNOT",
		BRICKS: ["B_1x1_Gate_Expr_LogicalNOT"],
		PORTS: {
			bInput: "bInput",
			bOutput: "bOutput"
		}
	},
	Expr_LogicalOR: {
		NAME: "BrickComponentType_WireGraph_Expr_LogicalOR",
		BRICK: "B_1x1_Gate_Expr_LogicalOR",
		BRICKS: ["B_1x1_Gate_Expr_LogicalOR"],
		PORTS: {
			bInputA: "bInputA",
			bInputB: "bInputB",
			bOutput: "bOutput"
		}
	},
	Expr_LogicalXOR: {
		NAME: "BrickComponentType_WireGraph_Expr_LogicalXOR",
		BRICK: "B_1x1_Gate_Expr_LogicalXOR",
		BRICKS: ["B_1x1_Gate_Expr_LogicalXOR"],
		PORTS: {
			bInputA: "bInputA",
			bInputB: "bInputB",
			bOutput: "bOutput"
		}
	},
	Expr_MakeColor: {
		NAME: "BrickComponentType_WireGraph_Expr_MakeColor",
		BRICK: "B_1x1_Gate_Expr_MakeColor",
		BRICKS: ["B_1x1_Gate_Expr_MakeColor"],
		PORTS: {
			A: "A",
			B: "B",
			G: "G",
			R: "R",
			Output: "Output"
		}
	},
	Expr_MakeColorHex: {
		NAME: "BrickComponentType_WireGraph_Expr_MakeColorHex",
		BRICK: "B_1x1_Gate_Expr_MakeColorHex",
		BRICKS: ["B_1x1_Gate_Expr_MakeColorHex"],
		PORTS: {
			Hex: "Hex",
			Output: "Output"
		}
	},
	Expr_MakeColorSRGB: {
		NAME: "BrickComponentType_WireGraph_Expr_MakeColorSRGB",
		BRICK: "B_1x1_Gate_Expr_MakeColorSRGB",
		BRICKS: ["B_1x1_Gate_Expr_MakeColorSRGB"],
		PORTS: {
			A: "A",
			B: "B",
			G: "G",
			R: "R",
			Output: "Output"
		}
	},
	Expr_MakeQuaternion: {
		NAME: "BrickComponentType_WireGraph_Expr_MakeQuaternion",
		BRICK: "B_1x1_Gate_Expr_MakeQuaternion",
		BRICKS: ["B_1x1_Gate_Expr_MakeQuaternion"],
		PORTS: {
			W: "W",
			X: "X",
			Y: "Y",
			Z: "Z",
			Output: "Output"
		}
	},
	Expr_MakeRotation: {
		NAME: "BrickComponentType_WireGraph_Expr_MakeRotation",
		BRICK: "B_1x1_Gate_Expr_MakeRotation",
		BRICKS: ["B_1x1_Gate_Expr_MakeRotation"],
		PORTS: {
			Pitch: "Pitch",
			Roll: "Roll",
			Yaw: "Yaw",
			Output: "Output"
		}
	},
	Expr_MakeVector: {
		NAME: "BrickComponentType_WireGraph_Expr_MakeVector",
		BRICK: "B_1x1_Gate_Expr_MakeVector",
		BRICKS: ["B_1x1_Gate_Expr_MakeVector"],
		PORTS: {
			X: "X",
			Y: "Y",
			Z: "Z",
			Output: "Output"
		}
	},
	Expr_MathAbs: {
		NAME: "BrickComponentType_WireGraph_Expr_MathAbs",
		BRICK: "B_1x1_Gate_Expr_MathAbs",
		BRICKS: ["B_1x1_Gate_Expr_MathAbs"],
		PORTS: {
			Input: "Input",
			Output: "Output"
		}
	},
	Expr_MathAcos: {
		NAME: "BrickComponentType_WireGraph_Expr_MathAcos",
		BRICK: "B_1x1_Gate_Expr_MathAcos",
		BRICKS: ["B_1x1_Gate_Expr_MathAcos"],
		PORTS: {
			Input: "Input",
			Output: "Output"
		}
	},
	Expr_MathAcosh: {
		NAME: "BrickComponentType_WireGraph_Expr_MathAcosh",
		BRICK: "B_1x1_Gate_Expr_MathAcosh",
		BRICKS: ["B_1x1_Gate_Expr_MathAcosh"],
		PORTS: {
			Input: "Input",
			Output: "Output"
		}
	},
	Expr_MathAdd: {
		NAME: "BrickComponentType_WireGraph_Expr_MathAdd",
		BRICK: "B_1x1_Gate_Expr_MathAdd",
		BRICKS: ["B_1x1_Gate_Expr_MathAdd"],
		PORTS: {
			InputA: "InputA",
			InputB: "InputB",
			Output: "Output"
		}
	},
	Expr_MathAsin: {
		NAME: "BrickComponentType_WireGraph_Expr_MathAsin",
		BRICK: "B_1x1_Gate_Expr_MathAsin",
		BRICKS: ["B_1x1_Gate_Expr_MathAsin"],
		PORTS: {
			Input: "Input",
			Output: "Output"
		}
	},
	Expr_MathAsinh: {
		NAME: "BrickComponentType_WireGraph_Expr_MathAsinh",
		BRICK: "B_1x1_Gate_Expr_MathAsinh",
		BRICKS: ["B_1x1_Gate_Expr_MathAsinh"],
		PORTS: {
			Input: "Input",
			Output: "Output"
		}
	},
	Expr_MathAtan: {
		NAME: "BrickComponentType_WireGraph_Expr_MathAtan",
		BRICK: "B_1x1_Gate_Expr_MathAtan",
		BRICKS: ["B_1x1_Gate_Expr_MathAtan"],
		PORTS: {
			Input: "Input",
			Output: "Output"
		}
	},
	Expr_MathAtan2: {
		NAME: "BrickComponentType_WireGraph_Expr_MathAtan2",
		BRICK: "B_1x1_Gate_Expr_MathAtan2",
		BRICKS: ["B_1x1_Gate_Expr_MathAtan2"],
		PORTS: {
			X: "X",
			Y: "Y",
			Output: "Output"
		}
	},
	Expr_MathAtanh: {
		NAME: "BrickComponentType_WireGraph_Expr_MathAtanh",
		BRICK: "B_1x1_Gate_Expr_MathAtanh",
		BRICKS: ["B_1x1_Gate_Expr_MathAtanh"],
		PORTS: {
			Input: "Input",
			Output: "Output"
		}
	},
	Expr_MathBlend: {
		NAME: "BrickComponentType_WireGraph_Expr_MathBlend",
		BRICK: "B_1x1_Gate_Expr_MathBlend",
		BRICKS: ["B_1x1_Gate_Expr_MathBlend"],
		PORTS: {
			Blend: "Blend",
			InputA: "InputA",
			InputB: "InputB",
			Output: "Output"
		}
	},
	Expr_MathClamp: {
		NAME: "BrickComponentType_WireGraph_Expr_MathClamp",
		BRICK: "B_1x1_Gate_Expr_MathClamp",
		BRICKS: ["B_1x1_Gate_Expr_MathClamp"],
		PORTS: {
			Input: "Input",
			Max: "Max",
			Min: "Min",
			Output: "Output"
		}
	},
	Expr_MathCos: {
		NAME: "BrickComponentType_WireGraph_Expr_MathCos",
		BRICK: "B_1x1_Gate_Expr_MathCos",
		BRICKS: ["B_1x1_Gate_Expr_MathCos"],
		PORTS: {
			Input: "Input",
			Output: "Output"
		}
	},
	Expr_MathCosh: {
		NAME: "BrickComponentType_WireGraph_Expr_MathCosh",
		BRICK: "B_1x1_Gate_Expr_MathCosh",
		BRICKS: ["B_1x1_Gate_Expr_MathCosh"],
		PORTS: {
			Input: "Input",
			Output: "Output"
		}
	},
	Expr_MathDegreesToRadians: {
		NAME: "BrickComponentType_WireGraph_Expr_MathDegreesToRadians",
		BRICK: "B_1x1_Gate_Expr_MathDegreesToRadians",
		BRICKS: ["B_1x1_Gate_Expr_MathDegreesToRadians"],
		PORTS: {
			Input: "Input",
			Output: "Output"
		}
	},
	Expr_MathDivide: {
		NAME: "BrickComponentType_WireGraph_Expr_MathDivide",
		BRICK: "B_1x1_Gate_Expr_MathDivide",
		BRICKS: ["B_1x1_Gate_Expr_MathDivide"],
		PORTS: {
			InputA: "InputA",
			InputB: "InputB",
			Output: "Output"
		}
	},
	Expr_MathEasing: {
		NAME: "BrickComponentType_WireGraph_Expr_MathEasing",
		BRICK: "B_1x1_Gate_Expr_MathEasing",
		BRICKS: ["B_1x1_Gate_Expr_MathEasing"],
		PORTS: {
			Blend: "Blend",
			InputA: "InputA",
			InputB: "InputB",
			Output: "Output"
		}
	},
	Expr_MathExp: {
		NAME: "BrickComponentType_WireGraph_Expr_MathExp",
		BRICK: "B_1x1_Gate_Expr_MathExp",
		BRICKS: ["B_1x1_Gate_Expr_MathExp"],
		PORTS: {
			Input: "Input",
			Output: "Output"
		}
	},
	Expr_MathLn: {
		NAME: "BrickComponentType_WireGraph_Expr_MathLn",
		BRICK: "B_1x1_Gate_Expr_MathLn",
		BRICKS: ["B_1x1_Gate_Expr_MathLn"],
		PORTS: {
			Input: "Input",
			Output: "Output"
		}
	},
	Expr_MathLogBase: {
		NAME: "BrickComponentType_WireGraph_Expr_MathLogBase",
		BRICK: "B_1x1_Gate_Expr_MathLogBase",
		BRICKS: ["B_1x1_Gate_Expr_MathLogBase"],
		PORTS: {
			Base: "Base",
			Input: "Input",
			Output: "Output"
		}
	},
	Expr_MathMax: {
		NAME: "BrickComponentType_WireGraph_Expr_MathMax",
		BRICK: "B_1x1_Gate_Expr_MathMax",
		BRICKS: ["B_1x1_Gate_Expr_MathMax"],
		PORTS: {
			InputA: "InputA",
			InputB: "InputB",
			Output: "Output"
		}
	},
	Expr_MathMin: {
		NAME: "BrickComponentType_WireGraph_Expr_MathMin",
		BRICK: "B_1x1_Gate_Expr_MathMin",
		BRICKS: ["B_1x1_Gate_Expr_MathMin"],
		PORTS: {
			InputA: "InputA",
			InputB: "InputB",
			Output: "Output"
		}
	},
	Expr_MathModulo: {
		NAME: "BrickComponentType_WireGraph_Expr_MathModulo",
		BRICK: "B_1x1_Gate_Expr_MathModulo",
		BRICKS: ["B_1x1_Gate_Expr_MathModulo"],
		PORTS: {
			InputA: "InputA",
			InputB: "InputB",
			Output: "Output"
		}
	},
	Expr_MathModuloFloored: {
		NAME: "BrickComponentType_WireGraph_Expr_MathModuloFloored",
		BRICK: "B_1x1_Gate_Expr_MathModuloFloored",
		BRICKS: ["B_1x1_Gate_Expr_MathModuloFloored"],
		PORTS: {
			InputA: "InputA",
			InputB: "InputB",
			Output: "Output"
		}
	},
	Expr_MathMultiply: {
		NAME: "BrickComponentType_WireGraph_Expr_MathMultiply",
		BRICK: "B_1x1_Gate_Expr_MathMultiply",
		BRICKS: ["B_1x1_Gate_Expr_MathMultiply"],
		PORTS: {
			InputA: "InputA",
			InputB: "InputB",
			Output: "Output"
		}
	},
	Expr_MathNegate: {
		NAME: "BrickComponentType_WireGraph_Expr_MathNegate",
		BRICK: "B_1x1_Gate_Expr_MathNegate",
		BRICKS: ["B_1x1_Gate_Expr_MathNegate"],
		PORTS: {
			Input: "Input",
			Output: "Output"
		}
	},
	Expr_MathPow: {
		NAME: "BrickComponentType_WireGraph_Expr_MathPow",
		BRICK: "B_1x1_Gate_Expr_MathPow",
		BRICKS: ["B_1x1_Gate_Expr_MathPow"],
		PORTS: {
			Exponent: "Exponent",
			Input: "Input",
			Output: "Output"
		}
	},
	Expr_MathRadiansToDegrees: {
		NAME: "BrickComponentType_WireGraph_Expr_MathRadiansToDegrees",
		BRICK: "B_1x1_Gate_Expr_MathRadiansToDegrees",
		BRICKS: ["B_1x1_Gate_Expr_MathRadiansToDegrees"],
		PORTS: {
			Input: "Input",
			Output: "Output"
		}
	},
	Expr_MathSign: {
		NAME: "BrickComponentType_WireGraph_Expr_MathSign",
		BRICK: "B_1x1_Gate_Expr_MathSign",
		BRICKS: ["B_1x1_Gate_Expr_MathSign"],
		PORTS: {
			Input: "Input",
			Output: "Output"
		}
	},
	Expr_MathSin: {
		NAME: "BrickComponentType_WireGraph_Expr_MathSin",
		BRICK: "B_1x1_Gate_Expr_MathSin",
		BRICKS: ["B_1x1_Gate_Expr_MathSin"],
		PORTS: {
			Input: "Input",
			Output: "Output"
		}
	},
	Expr_MathSinh: {
		NAME: "BrickComponentType_WireGraph_Expr_MathSinh",
		BRICK: "B_1x1_Gate_Expr_MathSinh",
		BRICKS: ["B_1x1_Gate_Expr_MathSinh"],
		PORTS: {
			Input: "Input",
			Output: "Output"
		}
	},
	Expr_MathSqrt: {
		NAME: "BrickComponentType_WireGraph_Expr_MathSqrt",
		BRICK: "B_1x1_Gate_Expr_MathSqrt",
		BRICKS: ["B_1x1_Gate_Expr_MathSqrt"],
		PORTS: {
			Input: "Input",
			Output: "Output"
		}
	},
	Expr_MathSubtract: {
		NAME: "BrickComponentType_WireGraph_Expr_MathSubtract",
		BRICK: "B_1x1_Gate_Expr_MathSubtract",
		BRICKS: ["B_1x1_Gate_Expr_MathSubtract"],
		PORTS: {
			InputA: "InputA",
			InputB: "InputB",
			Output: "Output"
		}
	},
	Expr_MathTan: {
		NAME: "BrickComponentType_WireGraph_Expr_MathTan",
		BRICK: "B_1x1_Gate_Expr_MathTan",
		BRICKS: ["B_1x1_Gate_Expr_MathTan"],
		PORTS: {
			Input: "Input",
			Output: "Output"
		}
	},
	Expr_MathTanh: {
		NAME: "BrickComponentType_WireGraph_Expr_MathTanh",
		BRICK: "B_1x1_Gate_Expr_MathTanh",
		BRICKS: ["B_1x1_Gate_Expr_MathTanh"],
		PORTS: {
			Input: "Input",
			Output: "Output"
		}
	},
	Expr_NearlyEqual: {
		NAME: "BrickComponentType_WireGraph_Expr_NearlyEqual",
		BRICK: "B_1x1_Gate_Expr_NearlyEqual",
		BRICKS: ["B_1x1_Gate_Expr_NearlyEqual"],
		PORTS: {
			InputA: "InputA",
			InputB: "InputB",
			Tolerance: "Tolerance",
			bOutput: "bOutput"
		}
	},
	Expr_QuatAngleBetween: {
		NAME: "BrickComponentType_WireGraph_Expr_QuatAngleBetween",
		BRICK: "B_1x1_Gate_Expr_QuatAngleBetween",
		BRICKS: ["B_1x1_Gate_Expr_QuatAngleBetween"],
		PORTS: {
			InputA: "InputA",
			InputA_W: "InputA.W",
			InputA_X: "InputA.X",
			InputA_Y: "InputA.Y",
			InputA_Z: "InputA.Z",
			InputB: "InputB",
			InputB_W: "InputB.W",
			InputB_X: "InputB.X",
			InputB_Y: "InputB.Y",
			InputB_Z: "InputB.Z",
			Output: "Output"
		}
	},
	Expr_QuatBetween: {
		NAME: "BrickComponentType_WireGraph_Expr_QuatBetween",
		BRICK: "B_1x1_Gate_Expr_QuatBetween",
		BRICKS: ["B_1x1_Gate_Expr_QuatBetween"],
		PORTS: {
			From: "From",
			From_X: "From.X",
			From_Y: "From.Y",
			From_Z: "From.Z",
			To: "To",
			To_X: "To.X",
			To_Y: "To.Y",
			To_Z: "To.Z",
			Output: "Output"
		}
	},
	Expr_QuatDotProduct: {
		NAME: "BrickComponentType_WireGraph_Expr_QuatDotProduct",
		BRICK: "B_1x1_Gate_Expr_QuatDotProduct",
		BRICKS: ["B_1x1_Gate_Expr_QuatDotProduct"],
		PORTS: {
			InputA: "InputA",
			InputA_W: "InputA.W",
			InputA_X: "InputA.X",
			InputA_Y: "InputA.Y",
			InputA_Z: "InputA.Z",
			InputB: "InputB",
			InputB_W: "InputB.W",
			InputB_X: "InputB.X",
			InputB_Y: "InputB.Y",
			InputB_Z: "InputB.Z",
			Output: "Output"
		}
	},
	Expr_QuatFromAxisAngle: {
		NAME: "BrickComponentType_WireGraph_Expr_QuatFromAxisAngle",
		BRICK: "B_1x1_Gate_Expr_QuatFromAxisAngle",
		BRICKS: ["B_1x1_Gate_Expr_QuatFromAxisAngle"],
		PORTS: {
			Angle: "Angle",
			Axis: "Axis",
			Axis_X: "Axis.X",
			Axis_Y: "Axis.Y",
			Axis_Z: "Axis.Z",
			Output: "Output"
		}
	},
	Expr_QuatSlerp: {
		NAME: "BrickComponentType_WireGraph_Expr_QuatSlerp",
		BRICK: "B_1x1_Gate_Expr_QuatSlerp",
		BRICKS: ["B_1x1_Gate_Expr_QuatSlerp"],
		PORTS: {
			Alpha: "Alpha",
			InputA: "InputA",
			InputA_W: "InputA.W",
			InputA_X: "InputA.X",
			InputA_Y: "InputA.Y",
			InputA_Z: "InputA.Z",
			InputB: "InputB",
			InputB_W: "InputB.W",
			InputB_X: "InputB.X",
			InputB_Y: "InputB.Y",
			InputB_Z: "InputB.Z",
			Output: "Output"
		}
	},
	Expr_QuatToAxisAngle: {
		NAME: "BrickComponentType_WireGraph_Expr_QuatToAxisAngle",
		BRICK: "B_1x1_Gate_Expr_QuatToAxisAngle",
		BRICKS: ["B_1x1_Gate_Expr_QuatToAxisAngle"],
		PORTS: {
			Input: "Input",
			Input_W: "Input.W",
			Input_X: "Input.X",
			Input_Y: "Input.Y",
			Input_Z: "Input.Z",
			Angle: "Angle",
			Axis: "Axis"
		}
	},
	Expr_Remap: {
		NAME: "BrickComponentType_WireGraph_Expr_Remap",
		BRICK: "B_1x1_Gate_Expr_Remap",
		BRICKS: ["B_1x1_Gate_Expr_Remap"],
		PORTS: {
			InputMax: "InputMax",
			InputMin: "InputMin",
			OutputMax: "OutputMax",
			OutputMin: "OutputMin",
			Value: "Value",
			Output: "Output"
		}
	},
	Expr_RotateVector: {
		NAME: "BrickComponentType_WireGraph_Expr_RotateVector",
		BRICK: "B_1x1_Gate_Expr_RotateVector",
		BRICKS: ["B_1x1_Gate_Expr_RotateVector"],
		PORTS: {
			Rotation: "Rotation",
			Rotation_W: "Rotation.W",
			Rotation_X: "Rotation.X",
			Rotation_Y: "Rotation.Y",
			Rotation_Z: "Rotation.Z",
			Vector: "Vector",
			Vector_X: "Vector.X",
			Vector_Y: "Vector.Y",
			Vector_Z: "Vector.Z",
			Output: "Output"
		}
	},
	Expr_RotationToDirection: {
		NAME: "BrickComponentType_WireGraph_Expr_RotationToDirection",
		BRICK: "B_1x1_Gate_Expr_RotationToDirection",
		BRICKS: ["B_1x1_Gate_Expr_RotationToDirection"],
		PORTS: {
			Rotation: "Rotation",
			Rotation_W: "Rotation.W",
			Rotation_X: "Rotation.X",
			Rotation_Y: "Rotation.Y",
			Rotation_Z: "Rotation.Z",
			Output: "Output"
		}
	},
	Expr_Round: {
		NAME: "BrickComponentType_WireGraph_Expr_Round",
		BRICK: "B_1x1_Gate_Expr_Round",
		BRICKS: ["B_1x1_Gate_Expr_Round"],
		PORTS: {
			Input: "Input",
			Output: "Output"
		}
	},
	Expr_Select: {
		NAME: "BrickComponentType_WireGraph_Expr_Select",
		BRICK: "B_1x1_Gate_Expr_Select",
		BRICKS: ["B_1x1_Gate_Expr_Select"],
		PORTS: {
			InputA: "InputA",
			InputB: "InputB",
			bSelectB: "bSelectB",
			Output: "Output"
		}
	},
	Expr_SplitColor: {
		NAME: "BrickComponentType_WireGraph_Expr_SplitColor",
		BRICK: "B_1x1_Gate_Expr_SplitColor",
		BRICKS: ["B_1x1_Gate_Expr_SplitColor"],
		PORTS: {
			Input: "Input",
			A: "A",
			B: "B",
			G: "G",
			R: "R"
		}
	},
	Expr_SplitColorSRGB: {
		NAME: "BrickComponentType_WireGraph_Expr_SplitColorSRGB",
		BRICK: "B_1x1_Gate_Expr_SplitColorSRGB",
		BRICKS: ["B_1x1_Gate_Expr_SplitColorSRGB"],
		PORTS: {
			Input: "Input",
			A: "A",
			B: "B",
			G: "G",
			R: "R"
		}
	},
	Expr_SplitQuaternion: {
		NAME: "BrickComponentType_WireGraph_Expr_SplitQuaternion",
		BRICK: "B_1x1_Gate_Expr_SplitQuaternion",
		BRICKS: ["B_1x1_Gate_Expr_SplitQuaternion"],
		PORTS: {
			Input: "Input",
			Input_W: "Input.W",
			Input_X: "Input.X",
			Input_Y: "Input.Y",
			Input_Z: "Input.Z",
			W: "W",
			X: "X",
			Y: "Y",
			Z: "Z"
		}
	},
	Expr_SplitRotation: {
		NAME: "BrickComponentType_WireGraph_Expr_SplitRotation",
		BRICK: "B_1x1_Gate_Expr_SplitRotation",
		BRICKS: ["B_1x1_Gate_Expr_SplitRotation"],
		PORTS: {
			Input: "Input",
			Input_Pitch: "Input.Pitch",
			Input_Roll: "Input.Roll",
			Input_Yaw: "Input.Yaw",
			Pitch: "Pitch",
			Roll: "Roll",
			Yaw: "Yaw"
		}
	},
	Expr_SplitVector: {
		NAME: "BrickComponentType_WireGraph_Expr_SplitVector",
		BRICK: "B_1x1_Gate_Expr_SplitVector",
		BRICKS: ["B_1x1_Gate_Expr_SplitVector"],
		PORTS: {
			Input: "Input",
			Input_X: "Input.X",
			Input_Y: "Input.Y",
			Input_Z: "Input.Z",
			X: "X",
			Y: "Y",
			Z: "Z"
		}
	},
	Expr_String_CharacterToCodepoint: {
		NAME: "BrickComponentType_WireGraph_Expr_String_CharacterToCodepoint",
		BRICK: "B_1x1_Gate_Expr_String_CharacterToCodepoint",
		BRICKS: ["B_1x1_Gate_Expr_String_CharacterToCodepoint"],
		PORTS: {
			Character: "Character",
			Codepoint: "Codepoint",
			bSuccess: "bSuccess"
		}
	},
	Expr_String_CodepointToCharacter: {
		NAME: "BrickComponentType_WireGraph_Expr_String_CodepointToCharacter",
		BRICK: "B_1x1_Gate_Expr_String_CodepointToCharacter",
		BRICKS: ["B_1x1_Gate_Expr_String_CodepointToCharacter"],
		PORTS: {
			Codepoint: "Codepoint",
			Character: "Character",
			bSuccess: "bSuccess"
		}
	},
	Expr_String_Concatenate: {
		NAME: "BrickComponentType_WireGraph_Expr_String_Concatenate",
		BRICK: "B_1x1_Gate_Expr_String_Concatenate",
		BRICKS: ["B_1x1_Gate_Expr_String_Concatenate"],
		PORTS: {
			InputA: "InputA",
			InputB: "InputB",
			Separator: "Separator",
			Output: "Output"
		}
	},
	Expr_String_Contains: {
		NAME: "BrickComponentType_WireGraph_Expr_String_Contains",
		BRICK: "B_1x1_Gate_Expr_String_Contains",
		BRICKS: ["B_1x1_Gate_Expr_String_Contains"],
		PORTS: {
			Input: "Input",
			Search: "Search",
			bCaseSensitive: "bCaseSensitive",
			Output: "Output"
		}
	},
	Expr_String_EndsWith: {
		NAME: "BrickComponentType_WireGraph_Expr_String_EndsWith",
		BRICK: "B_1x1_Gate_Expr_String_EndsWith",
		BRICKS: ["B_1x1_Gate_Expr_String_EndsWith"],
		PORTS: {
			Input: "Input",
			Suffix: "Suffix",
			bCaseSensitive: "bCaseSensitive",
			Output: "Output"
		}
	},
	Expr_String_Find: {
		NAME: "BrickComponentType_WireGraph_Expr_String_Find",
		BRICK: "B_1x1_Gate_Expr_String_Find",
		BRICKS: ["B_1x1_Gate_Expr_String_Find"],
		PORTS: {
			Input: "Input",
			Search: "Search",
			Start: "Start",
			bCaseSensitive: "bCaseSensitive",
			Output: "Output"
		}
	},
	Expr_String_FormatText: {
		NAME: "BrickComponentType_WireGraph_Expr_String_FormatText",
		BRICK: "B_1x1_Gate_Expr_String_FormatText",
		BRICKS: ["B_1x1_Gate_Expr_String_FormatText"],
		PORTS: {
			FormatString: "FormatString",
			InputA: "InputA",
			InputB: "InputB",
			InputC: "InputC",
			InputD: "InputD",
			InputE: "InputE",
			InputF: "InputF",
			InputG: "InputG",
			Output: "Output"
		}
	},
	Expr_String_Length: {
		NAME: "BrickComponentType_WireGraph_Expr_String_Length",
		BRICK: "B_1x1_Gate_Expr_String_Length",
		BRICKS: ["B_1x1_Gate_Expr_String_Length"],
		PORTS: {
			Input: "Input",
			Output: "Output"
		}
	},
	Expr_String_ParseInt: {
		NAME: "BrickComponentType_WireGraph_Expr_String_ParseInt",
		BRICK: "B_1x1_Gate_Expr_String_ParseInt",
		BRICKS: ["B_1x1_Gate_Expr_String_ParseInt"],
		PORTS: {
			Input: "Input",
			Value: "Value",
			bSuccess: "bSuccess"
		}
	},
	Expr_String_ParseNumber: {
		NAME: "BrickComponentType_WireGraph_Expr_String_ParseNumber",
		BRICK: "B_1x1_Gate_Expr_String_ParseNumber",
		BRICKS: ["B_1x1_Gate_Expr_String_ParseNumber"],
		PORTS: {
			Input: "Input",
			Value: "Value",
			bSuccess: "bSuccess"
		}
	},
	Expr_String_Replace: {
		NAME: "BrickComponentType_WireGraph_Expr_String_Replace",
		BRICK: "B_1x1_Gate_Expr_String_Replace",
		BRICKS: ["B_1x1_Gate_Expr_String_Replace"],
		PORTS: {
			Input: "Input",
			MaxReplacements: "MaxReplacements",
			Replacement: "Replacement",
			Search: "Search",
			Start: "Start",
			bCaseSensitive: "bCaseSensitive",
			Output: "Output"
		}
	},
	Expr_String_Split: {
		NAME: "BrickComponentType_WireGraph_Expr_String_Split",
		BRICK: "B_1x1_Gate_Expr_String_Split",
		BRICKS: ["B_1x1_Gate_Expr_String_Split"],
		PORTS: {
			Delimiter: "Delimiter",
			Input: "Input",
			Occurrence: "Occurrence",
			bCaseSensitive: "bCaseSensitive",
			Left: "Left",
			Right: "Right",
			bFound: "bFound"
		}
	},
	Expr_String_StartsWith: {
		NAME: "BrickComponentType_WireGraph_Expr_String_StartsWith",
		BRICK: "B_1x1_Gate_Expr_String_StartsWith",
		BRICKS: ["B_1x1_Gate_Expr_String_StartsWith"],
		PORTS: {
			Input: "Input",
			Prefix: "Prefix",
			bCaseSensitive: "bCaseSensitive",
			Output: "Output"
		}
	},
	Expr_String_Substring: {
		NAME: "BrickComponentType_WireGraph_Expr_String_Substring",
		BRICK: "B_1x1_Gate_Expr_String_Substring",
		BRICKS: ["B_1x1_Gate_Expr_String_Substring"],
		PORTS: {
			Input: "Input",
			Length: "Length",
			Start: "Start",
			Output: "Output"
		}
	},
	Expr_String_ToLower: {
		NAME: "BrickComponentType_WireGraph_Expr_String_ToLower",
		BRICK: "B_1x1_Gate_Expr_String_ToLower",
		BRICKS: ["B_1x1_Gate_Expr_String_ToLower"],
		PORTS: {
			Input: "Input",
			Output: "Output"
		}
	},
	Expr_String_ToUpper: {
		NAME: "BrickComponentType_WireGraph_Expr_String_ToUpper",
		BRICK: "B_1x1_Gate_Expr_String_ToUpper",
		BRICKS: ["B_1x1_Gate_Expr_String_ToUpper"],
		PORTS: {
			Input: "Input",
			Output: "Output"
		}
	},
	Expr_String_Trim: {
		NAME: "BrickComponentType_WireGraph_Expr_String_Trim",
		BRICK: "B_1x1_Gate_Expr_String_Trim",
		BRICKS: ["B_1x1_Gate_Expr_String_Trim"],
		PORTS: {
			Input: "Input",
			Output: "Output"
		}
	},
	Expr_Swap: {
		NAME: "BrickComponentType_WireGraph_Expr_Swap",
		BRICK: "B_1x1_Gate_Expr_Swap",
		BRICKS: ["B_1x1_Gate_Expr_Swap"],
		PORTS: {
			InputA: "InputA",
			InputB: "InputB",
			bSwap: "bSwap",
			Output: "Output",
			OutputB: "OutputB"
		}
	},
	Expr_VecCrossProduct: {
		NAME: "BrickComponentType_WireGraph_Expr_VecCrossProduct",
		BRICK: "B_1x1_Gate_Expr_VecCrossProduct",
		BRICKS: ["B_1x1_Gate_Expr_VecCrossProduct"],
		PORTS: {
			InputA: "InputA",
			InputA_X: "InputA.X",
			InputA_Y: "InputA.Y",
			InputA_Z: "InputA.Z",
			InputB: "InputB",
			InputB_X: "InputB.X",
			InputB_Y: "InputB.Y",
			InputB_Z: "InputB.Z",
			Output: "Output"
		}
	},
	Expr_VecDistance: {
		NAME: "BrickComponentType_WireGraph_Expr_VecDistance",
		BRICK: "B_1x1_Gate_Expr_VecDistance",
		BRICKS: ["B_1x1_Gate_Expr_VecDistance"],
		PORTS: {
			InputA: "InputA",
			InputA_X: "InputA.X",
			InputA_Y: "InputA.Y",
			InputA_Z: "InputA.Z",
			InputB: "InputB",
			InputB_X: "InputB.X",
			InputB_Y: "InputB.Y",
			InputB_Z: "InputB.Z",
			Output: "Output"
		}
	},
	Expr_VecDistanceSquared: {
		NAME: "BrickComponentType_WireGraph_Expr_VecDistanceSquared",
		BRICK: "B_1x1_Gate_Expr_VecDistanceSquared",
		BRICKS: ["B_1x1_Gate_Expr_VecDistanceSquared"],
		PORTS: {
			InputA: "InputA",
			InputA_X: "InputA.X",
			InputA_Y: "InputA.Y",
			InputA_Z: "InputA.Z",
			InputB: "InputB",
			InputB_X: "InputB.X",
			InputB_Y: "InputB.Y",
			InputB_Z: "InputB.Z",
			Output: "Output"
		}
	},
	Expr_VecDotProduct: {
		NAME: "BrickComponentType_WireGraph_Expr_VecDotProduct",
		BRICK: "B_1x1_Gate_Expr_VecDotProduct",
		BRICKS: ["B_1x1_Gate_Expr_VecDotProduct"],
		PORTS: {
			InputA: "InputA",
			InputA_X: "InputA.X",
			InputA_Y: "InputA.Y",
			InputA_Z: "InputA.Z",
			InputB: "InputB",
			InputB_X: "InputB.X",
			InputB_Y: "InputB.Y",
			InputB_Z: "InputB.Z",
			Output: "Output"
		}
	},
	Expr_VecMagnitude: {
		NAME: "BrickComponentType_WireGraph_Expr_VecMagnitude",
		BRICK: "B_1x1_Gate_Expr_VecMagnitude",
		BRICKS: ["B_1x1_Gate_Expr_VecMagnitude"],
		PORTS: {
			Input: "Input",
			Input_X: "Input.X",
			Input_Y: "Input.Y",
			Input_Z: "Input.Z",
			Output: "Output"
		}
	},
	Expr_VecMagnitudeSquared: {
		NAME: "BrickComponentType_WireGraph_Expr_VecMagnitudeSquared",
		BRICK: "B_1x1_Gate_Expr_VecMagnitudeSquared",
		BRICKS: ["B_1x1_Gate_Expr_VecMagnitudeSquared"],
		PORTS: {
			Input: "Input",
			Input_X: "Input.X",
			Input_Y: "Input.Y",
			Input_Z: "Input.Z",
			Output: "Output"
		}
	},
	Expr_VecNormalize: {
		NAME: "BrickComponentType_WireGraph_Expr_VecNormalize",
		BRICK: "B_1x1_Gate_Expr_VecNormalize",
		BRICKS: ["B_1x1_Gate_Expr_VecNormalize"],
		PORTS: {
			Input: "Input",
			Input_X: "Input.X",
			Input_Y: "Input.Y",
			Input_Z: "Input.Z",
			Output: "Output"
		}
	},
	Expr_VecScale: {
		NAME: "BrickComponentType_WireGraph_Expr_VecScale",
		BRICK: "B_1x1_Gate_Expr_VecScale",
		BRICKS: ["B_1x1_Gate_Expr_VecScale"],
		PORTS: {
			Input: "Input",
			Input_X: "Input.X",
			Input_Y: "Input.Y",
			Input_Z: "Input.Z",
			Scalar: "Scalar",
			Output: "Output"
		}
	},
	Fake_Gamemode_CharacterDamagedEvent: {
		NAME: "BrickComponentType_WireGraph_Fake_Gamemode_CharacterDamagedEvent",
		BRICK: "B_1x1_Gate_Fake_Gamemode_CharacterDamagedEvent",
		BRICKS: ["B_1x1_Gate_Fake_Gamemode_CharacterDamagedEvent"],
		PORTS: {
			Attacker: "Attacker",
			AttackerWeapon: "AttackerWeapon",
			AttackerWeaponName: "AttackerWeaponName",
			Character: "Character",
			Damage: "Damage",
			ExecOut: "ExecOut"
		}
	},
	Fake_Gamemode_CharacterDiedEvent: {
		NAME: "BrickComponentType_WireGraph_Fake_Gamemode_CharacterDiedEvent",
		BRICK: "B_1x1_Gate_Fake_Gamemode_CharacterDiedEvent",
		BRICKS: ["B_1x1_Gate_Fake_Gamemode_CharacterDiedEvent"],
		PORTS: {
			Character: "Character",
			ExecOut: "ExecOut",
			Killer: "Killer",
			KillerWeapon: "KillerWeapon",
			KillerWeaponName: "KillerWeaponName"
		}
	},
	Fake_Gamemode_CharacterFiredWeaponEvent: {
		NAME: "BrickComponentType_WireGraph_Fake_Gamemode_CharacterFiredWeaponEvent",
		BRICK: "B_1x1_Gate_Fake_Gamemode_CharacterFiredWeaponEvent",
		BRICKS: ["B_1x1_Gate_Fake_Gamemode_CharacterFiredWeaponEvent"],
		PORTS: {
			Character: "Character",
			Direction: "Direction",
			ExecOut: "ExecOut",
			Start: "Start",
			Weapon: "Weapon",
			WeaponName: "WeaponName"
		}
	},
	Fake_Gamemode_CharacterSpawnedEvent: {
		NAME: "BrickComponentType_WireGraph_Fake_Gamemode_CharacterSpawnedEvent",
		BRICK: "B_1x1_Gate_Fake_Gamemode_CharacterSpawnedEvent",
		BRICKS: ["B_1x1_Gate_Fake_Gamemode_CharacterSpawnedEvent"],
		PORTS: {
			Character: "Character",
			ExecOut: "ExecOut"
		}
	},
	Fake_Gamemode_ControllerJoinedEvent: {
		NAME: "BrickComponentType_WireGraph_Fake_Gamemode_ControllerJoinedEvent",
		BRICK: "B_1x1_Gate_Fake_Gamemode_ControllerJoinedEvent",
		BRICKS: ["B_1x1_Gate_Fake_Gamemode_ControllerJoinedEvent"],
		PORTS: {
			ExecOut: "ExecOut",
			PlayerState: "PlayerState",
			UserId: "UserId",
			UserName: "UserName"
		}
	},
	Fake_Gamemode_ControllerJoinedTeamEvent: {
		NAME: "BrickComponentType_WireGraph_Fake_Gamemode_ControllerJoinedTeamEvent",
		BRICK: "B_1x1_Gate_Fake_Gamemode_ControllerJoinedTeamEvent",
		BRICKS: ["B_1x1_Gate_Fake_Gamemode_ControllerJoinedTeamEvent"],
		PORTS: {
			ExecOut: "ExecOut",
			PlayerState: "PlayerState",
			Team: "Team",
			UserId: "UserId",
			UserName: "UserName"
		}
	},
	Fake_Gamemode_ControllerLeftEvent: {
		NAME: "BrickComponentType_WireGraph_Fake_Gamemode_ControllerLeftEvent",
		BRICK: "B_1x1_Gate_Fake_Gamemode_ControllerLeftEvent",
		BRICKS: ["B_1x1_Gate_Fake_Gamemode_ControllerLeftEvent"],
		PORTS: {
			ExecOut: "ExecOut",
			PlayerState: "PlayerState",
			UserId: "UserId",
			UserName: "UserName"
		}
	},
	Fake_Gamemode_ControllerLeftTeamEvent: {
		NAME: "BrickComponentType_WireGraph_Fake_Gamemode_ControllerLeftTeamEvent",
		BRICK: "B_1x1_Gate_Fake_Gamemode_ControllerLeftTeamEvent",
		BRICKS: ["B_1x1_Gate_Fake_Gamemode_ControllerLeftTeamEvent"],
		PORTS: {
			ExecOut: "ExecOut",
			PlayerState: "PlayerState",
			Team: "Team",
			UserId: "UserId",
			UserName: "UserName"
		}
	},
	Fake_Gamemode_RoundEndEvent: {
		NAME: "BrickComponentType_WireGraph_Fake_Gamemode_RoundEndEvent",
		BRICK: "B_1x1_Gate_Fake_Gamemode_RoundEndEvent",
		BRICKS: ["B_1x1_Gate_Fake_Gamemode_RoundEndEvent"],
		PORTS: {
			ExecOut: "ExecOut",
			RoundNumber: "RoundNumber"
		}
	},
	Fake_Gamemode_RoundStartEvent: {
		NAME: "BrickComponentType_WireGraph_Fake_Gamemode_RoundStartEvent",
		BRICK: "B_1x1_Gate_Fake_Gamemode_RoundStartEvent",
		BRICKS: ["B_1x1_Gate_Fake_Gamemode_RoundStartEvent"],
		PORTS: {
			ExecOut: "ExecOut",
			RoundNumber: "RoundNumber"
		}
	},
	FindPlayer: {
		NAME: "BrickComponentType_WireGraph_FindPlayer",
		BRICK: "B_1x1_Gate_FindPlayer",
		BRICKS: ["B_1x1_Gate_FindPlayer"],
		PORTS: {
			Exec: "Exec",
			Query: "Query",
			ExecOut: "ExecOut",
			Player: "Player"
		}
	},
	FontReference: {
		NAME: "BrickComponentType_WireGraph_FontReference",
		BRICK: "B_1x1_Gate_FontReference",
		BRICKS: ["B_1x1_Gate_FontReference"],
		PORTS: { Value: "Value" }
	},
	FormatDate: {
		NAME: "BrickComponentType_WireGraph_FormatDate",
		BRICK: "B_1x1_Gate_FormatDate",
		BRICKS: ["B_1x1_Gate_FormatDate"],
		PORTS: {
			Format: "Format",
			UnixEpoch: "UnixEpoch",
			bUseUTC: "bUseUTC",
			Output: "Output",
			bSuccess: "bSuccess"
		}
	},
	GetUnixEpoch: {
		NAME: "BrickComponentType_WireGraph_GetUnixEpoch",
		BRICK: "B_1x1_Gate_GetUnixEpoch",
		BRICKS: ["B_1x1_Gate_GetUnixEpoch"],
		PORTS: { UnixEpoch: "UnixEpoch" }
	},
	ItemReference: {
		NAME: "BrickComponentType_WireGraph_ItemReference",
		BRICK: "B_1x1_Gate_ItemReference",
		BRICKS: ["B_1x1_Gate_ItemReference"],
		PORTS: { Value: "Value" }
	},
	OneShotAudioReference: {
		NAME: "BrickComponentType_WireGraph_OneShotAudioReference",
		BRICK: "B_1x1_Gate_OneShotAudioReference",
		BRICKS: ["B_1x1_Gate_OneShotAudioReference"],
		PORTS: { Value: "Value" }
	},
	ParticleReference: {
		NAME: "BrickComponentType_WireGraph_ParticleReference",
		BRICKS: [],
		PORTS: { Value: "Value" }
	},
	PickupReference: {
		NAME: "BrickComponentType_WireGraph_PickupReference",
		BRICK: "B_1x1_Gate_PickupReference",
		BRICKS: ["B_1x1_Gate_PickupReference"],
		PORTS: { Value: "Value" }
	},
	ProjectileReference: {
		NAME: "BrickComponentType_WireGraph_ProjectileReference",
		BRICK: "B_1x1_Gate_ProjectileReference",
		BRICKS: ["B_1x1_Gate_ProjectileReference"],
		PORTS: { Value: "Value" }
	},
	ServerUptime: {
		NAME: "BrickComponentType_WireGraph_ServerUptime",
		BRICK: "B_1x1_Gate_ServerUptime",
		BRICKS: ["B_1x1_Gate_ServerUptime"],
		PORTS: { Uptime: "Uptime" }
	},
	WeaponResourceReference: {
		NAME: "BrickComponentType_WireGraph_WeaponResourceReference",
		BRICK: "B_1x1_Gate_WeaponResourceReference",
		BRICKS: ["B_1x1_Gate_WeaponResourceReference"],
		PORTS: { Value: "Value" }
	},
	WheelEngineAudioReference: {
		NAME: "BrickComponentType_WireGraph_WheelEngineAudioReference",
		BRICK: "B_1x1_Gate_WheelEngineAudioReference",
		BRICKS: ["B_1x1_Gate_WheelEngineAudioReference"],
		PORTS: { Value: "Value" }
	},
	ArrayVar: {
		NAME: "BrickComponentType_WireGraphPseudo_ArrayVar",
		BRICK: "B_1x1_Gate_Variable_Array",
		BRICKS: ["B_1x1_Gate_Variable_Array"],
		PORTS: { ArrayVarRef: "ArrayVarRef" }
	},
	BufferSeconds: {
		NAME: "BrickComponentType_WireGraphPseudo_BufferSeconds",
		BRICK: "B_1x1_Gate_Pseudo_BufferSeconds",
		BRICKS: ["B_1x1_Gate_Pseudo_BufferSeconds"],
		PORTS: {
			Input: "Input",
			SecondsToWait: "SecondsToWait",
			ZeroSecondsToWait: "ZeroSecondsToWait",
			Output: "Output"
		}
	},
	BufferTicks: {
		NAME: "BrickComponentType_WireGraphPseudo_BufferTicks",
		BRICK: "B_1x1_Gate_Pseudo_BufferTicks",
		BRICKS: ["B_1x1_Gate_Pseudo_BufferTicks"],
		PORTS: {
			Input: "Input",
			TicksToWait: "TicksToWait",
			ZeroTicksToWait: "ZeroTicksToWait",
			Output: "Output"
		}
	},
	CustomEvent: {
		NAME: "BrickComponentType_WireGraphPseudo_CustomEvent",
		BRICK: "B_1x1_Gate_Pseudo_CustomEvent",
		BRICKS: ["B_1x1_Gate_Pseudo_CustomEvent"],
		PORTS: {
			DataOut1: "DataOut1",
			DataOut2: "DataOut2",
			DataOut3: "DataOut3",
			DataOut4: "DataOut4",
			DataOut5: "DataOut5",
			DataOut6: "DataOut6",
			DataOut7: "DataOut7",
			DataOut8: "DataOut8",
			ExecOut: "ExecOut"
		}
	},
	CustomEvent_Global: {
		NAME: "BrickComponentType_WireGraphPseudo_CustomEvent_Global",
		BRICK: "B_1x1_Gate_Pseudo_CustomEvent_Global",
		BRICKS: ["B_1x1_Gate_Pseudo_CustomEvent_Global"],
		PORTS: {
			DataOut1: "DataOut1",
			DataOut2: "DataOut2",
			DataOut3: "DataOut3",
			DataOut4: "DataOut4",
			DataOut5: "DataOut5",
			DataOut6: "DataOut6",
			DataOut7: "DataOut7",
			DataOut8: "DataOut8",
			ExecOut: "ExecOut"
		}
	},
	Dampen: {
		NAME: "BrickComponentType_WireGraphPseudo_Dampen",
		BRICK: "B_1x1_Gate_Pseudo_Dampen",
		BRICKS: ["B_1x1_Gate_Pseudo_Dampen"],
		PORTS: {
			SmoothTime: "SmoothTime",
			Target: "Target",
			Value: "Value"
		}
	},
	MapVar: {
		NAME: "BrickComponentType_WireGraphPseudo_MapVar",
		BRICK: "B_1x1_Gate_Variable_Map",
		BRICKS: ["B_1x1_Gate_Variable_Map"],
		PORTS: { MapVarRef: "MapVarRef" }
	},
	QueueSeconds: {
		NAME: "BrickComponentType_WireGraphPseudo_QueueSeconds",
		BRICK: "B_1x1_Gate_Pseudo_QueueSeconds",
		BRICKS: ["B_1x1_Gate_Pseudo_QueueSeconds"],
		PORTS: {
			DataIn1: "DataIn1",
			DataIn2: "DataIn2",
			DataIn3: "DataIn3",
			DataIn4: "DataIn4",
			DataIn5: "DataIn5",
			DataIn6: "DataIn6",
			DataIn7: "DataIn7",
			DataIn8: "DataIn8",
			ExecIn: "ExecIn",
			SecondsToWait: "SecondsToWait",
			DataOut1: "DataOut1",
			DataOut2: "DataOut2",
			DataOut3: "DataOut3",
			DataOut4: "DataOut4",
			DataOut5: "DataOut5",
			DataOut6: "DataOut6",
			DataOut7: "DataOut7",
			DataOut8: "DataOut8",
			ExecOut: "ExecOut"
		}
	},
	QueueTicks: {
		NAME: "BrickComponentType_WireGraphPseudo_QueueTicks",
		BRICK: "B_1x1_Gate_Pseudo_QueueTicks",
		BRICKS: ["B_1x1_Gate_Pseudo_QueueTicks"],
		PORTS: {
			DataIn1: "DataIn1",
			DataIn2: "DataIn2",
			DataIn3: "DataIn3",
			DataIn4: "DataIn4",
			DataIn5: "DataIn5",
			DataIn6: "DataIn6",
			DataIn7: "DataIn7",
			DataIn8: "DataIn8",
			ExecIn: "ExecIn",
			TicksToWait: "TicksToWait",
			DataOut1: "DataOut1",
			DataOut2: "DataOut2",
			DataOut3: "DataOut3",
			DataOut4: "DataOut4",
			DataOut5: "DataOut5",
			DataOut6: "DataOut6",
			DataOut7: "DataOut7",
			DataOut8: "DataOut8",
			ExecOut: "ExecOut"
		}
	},
	SendCustomEvent: {
		NAME: "BrickComponentType_WireGraphPseudo_SendCustomEvent",
		BRICK: "B_1x1_Gate_Pseudo_SendCustomEvent",
		BRICKS: ["B_1x1_Gate_Pseudo_SendCustomEvent"],
		PORTS: {
			DataIn1: "DataIn1",
			DataIn2: "DataIn2",
			DataIn3: "DataIn3",
			DataIn4: "DataIn4",
			DataIn5: "DataIn5",
			DataIn6: "DataIn6",
			DataIn7: "DataIn7",
			DataIn8: "DataIn8",
			ExecIn: "ExecIn",
			Target: "Target",
			ExecOut: "ExecOut"
		}
	},
	SendCustomEvent_Global: {
		NAME: "BrickComponentType_WireGraphPseudo_SendCustomEvent_Global",
		BRICK: "B_1x1_Gate_Pseudo_SendCustomEvent_Global",
		BRICKS: ["B_1x1_Gate_Pseudo_SendCustomEvent_Global"],
		PORTS: {
			DataIn1: "DataIn1",
			DataIn2: "DataIn2",
			DataIn3: "DataIn3",
			DataIn4: "DataIn4",
			DataIn5: "DataIn5",
			DataIn6: "DataIn6",
			DataIn7: "DataIn7",
			DataIn8: "DataIn8",
			ExecIn: "ExecIn",
			Target: "Target",
			ExecOut: "ExecOut"
		}
	},
	Timer: {
		NAME: "BrickComponentType_WireGraphPseudo_Timer",
		BRICK: "B_1x1_Gate_Pseudo_Timer",
		BRICKS: ["B_1x1_Gate_Pseudo_Timer"],
		PORTS: {
			Limit: "Limit",
			Pause: "Pause",
			Restart: "Restart",
			Resume: "Resume",
			Expired: "Expired",
			Time: "Time"
		}
	},
	Tween: {
		NAME: "BrickComponentType_WireGraphPseudo_Tween",
		BRICK: "B_1x1_Gate_Pseudo_Tween",
		BRICKS: ["B_1x1_Gate_Pseudo_Tween"],
		PORTS: {
			Direction: "Direction",
			Duration: "Duration",
			Function: "Function",
			Target: "Target",
			Arrived: "Arrived",
			Value: "Value"
		}
	},
	Var: {
		NAME: "BrickComponentType_WireGraphPseudo_Var",
		BRICK: "B_1x1_Gate_Variable",
		BRICKS: ["B_1x1_Gate_Variable"],
		PORTS: {
			Value: "Value",
			VarRef: "VarRef"
		}
	},
	AudioEmitter: {
		NAME: "Component_AudioEmitter",
		BRICK: "B_1x1F_Speaker",
		BRICKS: ["B_1x1F_Speaker", "B_2x2F_Speaker"],
		PORTS: {
			AudioDescriptor: "AudioDescriptor",
			FocusAzimuth: "FocusAzimuth",
			InnerRadius: "InnerRadius",
			MaxDistance: "MaxDistance",
			NonFocusAzimuth: "NonFocusAzimuth",
			NonFocusVolumeAttenuation: "NonFocusVolumeAttenuation",
			PitchMultiplier: "PitchMultiplier",
			VolumeMultiplier: "VolumeMultiplier",
			bEnabled: "bEnabled",
			bSpatialization: "bSpatialization"
		}
	},
	BotSpawn: {
		NAME: "Component_BotSpawn",
		BRICK: "B_Bot_Spawn_Point",
		BRICKS: ["B_Bot_Spawn_Point"],
		PORTS: {
			AggroRange: "AggroRange",
			Agression: "Agression",
			AttackDamageMultiplier: "AttackDamageMultiplier",
			AttackMovementAmount: "AttackMovementAmount",
			BotName: "BotName",
			BotWeapon: "BotWeapon",
			CorpseTimeout: "CorpseTimeout",
			GunSkill: "GunSkill",
			HealthMultiplier: "HealthMultiplier",
			Jumpyness: "Jumpyness",
			MoveTarget: "MoveTarget",
			MoveTarget_X: "MoveTarget.X",
			MoveTarget_Y: "MoveTarget.Y",
			MoveTarget_Z: "MoveTarget.Z",
			MovementAmount: "MovementAmount",
			MovementGoalDummy: "MovementGoalDummy",
			MovementRandomness: "MovementRandomness",
			ReactionTime: "ReactionTime",
			RespawnTime: "RespawnTime",
			RunSpeed: "RunSpeed",
			Skin: "Skin",
			Skin_Parts: "Skin.Parts",
			TeamCollisionChannel: "TeamCollisionChannel",
			bActiveBot: "bActiveBot",
			bBackVision: "bBackVision",
			bCanJump: "bCanJump",
			bCanTargetBots: "bCanTargetBots",
			bCanTargetPlayers: "bCanTargetPlayers",
			bDeleteBot: "bDeleteBot",
			bSpawnEnable: "bSpawnEnable",
			bTeamCollision: "bTeamCollision",
			bTeamCollision1: "bTeamCollision1",
			bTeamCollision2: "bTeamCollision2",
			bTeamCollision3: "bTeamCollision3",
			bVisionRaycasting: "bVisionRaycasting",
			DistanceToTarget: "DistanceToTarget",
			FocusCharacter: "FocusCharacter",
			SpawnedCharacter: "SpawnedCharacter"
		}
	},
	BrickPropertyChanger: {
		NAME: "Component_BrickPropertyChanger",
		BRICKS: [],
		PORTS: {
			Color: "Color",
			Color_A: "Color.A",
			Color_B: "Color.B",
			Color_G: "Color.G",
			Color_R: "Color.R",
			Material: "Material",
			MaterialAlpha: "MaterialAlpha",
			bCollisionEnabled: "bCollisionEnabled",
			bCollisionEnabled_Interaction: "bCollisionEnabled_Interaction",
			bCollisionEnabled_Physics: "bCollisionEnabled_Physics",
			bCollisionEnabled_Player: "bCollisionEnabled_Player",
			bCollisionEnabled_Player1: "bCollisionEnabled_Player1",
			bCollisionEnabled_Player2: "bCollisionEnabled_Player2",
			bCollisionEnabled_Player3: "bCollisionEnabled_Player3",
			bCollisionEnabled_Weapon: "bCollisionEnabled_Weapon",
			bVisibility: "bVisibility"
		}
	},
	Button: {
		NAME: "Component_Button",
		BRICKS: [],
		PORTS: {
			PressSound: "PressSound",
			PromptCustomLabel: "PromptCustomLabel",
			ReleaseSound: "ReleaseSound",
			bAllowNearbyInteraction: "bAllowNearbyInteraction",
			bHiddenInteraction: "bHiddenInteraction",
			Character: "Character",
			PressCount: "PressCount",
			bHeld: "bHeld"
		}
	},
	CheckPoint: {
		NAME: "Component_CheckPoint",
		BRICK: "B_CheckPoint",
		BRICKS: ["B_CheckPoint"],
		PORTS: { bRotatePlayerGravityOnSpawn: "bRotatePlayerGravityOnSpawn" }
	},
	Damage: {
		NAME: "Component_Damage",
		BRICK: "PB_Spike",
		BRICKS: ["PB_Spike"],
		PORTS: {
			ConsoleTag: "ConsoleTag",
			Damage: "Damage",
			Message: "Message",
			RepeatDelay: "RepeatDelay"
		}
	},
	GoalPoint: {
		NAME: "Component_GoalPoint",
		BRICK: "B_GoalPoint",
		BRICKS: ["B_GoalPoint"],
		PORTS: {}
	},
	Interact: {
		NAME: "Component_Interact",
		BRICKS: [],
		PORTS: {
			ConsoleTag: "ConsoleTag",
			InteractSound: "InteractSound",
			Message: "Message",
			PromptCustomLabel: "PromptCustomLabel",
			bAllowNearbyInteraction: "bAllowNearbyInteraction",
			bHiddenInteraction: "bHiddenInteraction"
		}
	},
	AnimatedButton: {
		NAME: "Component_Internal_AnimatedButton",
		BRICK: "B_Button",
		BRICKS: [
			"B_Button",
			"B_Button_Pressed",
			"B_Button_Square",
			"B_Button_Square_Pressed"
		],
		PORTS: {
			PressSound: "PressSound",
			PromptCustomLabel: "PromptCustomLabel",
			ReleaseSound: "ReleaseSound",
			bAllowNearbyInteraction: "bAllowNearbyInteraction",
			bHiddenInteraction: "bHiddenInteraction",
			Character: "Character",
			PressCount: "PressCount",
			bHeld: "bHeld"
		}
	},
	AnimatedPressurePlate: {
		NAME: "Component_Internal_AnimatedPressurePlate",
		BRICKS: [],
		PORTS: {
			BeginTouchSound: "BeginTouchSound",
			EndTouchSound: "EndTouchSound",
			bCollisionEnabled_Player: "bCollisionEnabled_Player",
			bCollisionEnabled_Player1: "bCollisionEnabled_Player1",
			bCollisionEnabled_Player2: "bCollisionEnabled_Player2",
			bCollisionEnabled_Player3: "bCollisionEnabled_Player3",
			Character: "Character",
			TouchCount: "TouchCount",
			bTouching: "bTouching"
		}
	},
	AnimatedSwitch: {
		NAME: "Component_Internal_AnimatedSwitch",
		BRICK: "B_Switch_Flipped",
		BRICKS: ["B_Switch_Flipped", "B_Switch_Test"],
		PORTS: {
			InteractSound: "InteractSound",
			PromptCustomLabel: "PromptCustomLabel",
			bAllowNearbyInteraction: "bAllowNearbyInteraction",
			bHiddenInteraction: "bHiddenInteraction",
			Character: "Character",
			bEnabled: "bEnabled"
		}
	},
	AttachedZone: {
		NAME: "Component_Internal_AttachedZone",
		BRICK: "BP_ZoneProjector",
		BRICKS: ["BP_ZoneProjector"],
		PORTS: {
			TagFilter: "TagFilter",
			WaterAbsorption: "WaterAbsorption",
			WaterAbsorption_X: "WaterAbsorption.X",
			WaterAbsorption_Y: "WaterAbsorption.Y",
			WaterAbsorption_Z: "WaterAbsorption.Z",
			WaterFogAmbientColor: "WaterFogAmbientColor",
			WaterFogAmbientColor_A: "WaterFogAmbientColor.A",
			WaterFogAmbientColor_B: "WaterFogAmbientColor.B",
			WaterFogAmbientColor_G: "WaterFogAmbientColor.G",
			WaterFogAmbientColor_R: "WaterFogAmbientColor.R",
			WaterFogAmbientScale: "WaterFogAmbientScale",
			WaterFogIntensity: "WaterFogIntensity",
			WaterFogScatteringColor: "WaterFogScatteringColor",
			WaterFogScatteringColor_A: "WaterFogScatteringColor.A",
			WaterFogScatteringColor_B: "WaterFogScatteringColor.B",
			WaterFogScatteringColor_G: "WaterFogScatteringColor.G",
			WaterFogScatteringColor_R: "WaterFogScatteringColor.R",
			WaterFogScatteringScale: "WaterFogScatteringScale",
			WaterScattering: "WaterScattering",
			WaterScattering_X: "WaterScattering.X",
			WaterScattering_Y: "WaterScattering.Y",
			WaterScattering_Z: "WaterScattering.Z",
			ZoneEndDistance: "ZoneEndDistance",
			ZoneStartDistance: "ZoneStartDistance",
			ZoneWindForce: "ZoneWindForce",
			bDetectEntities: "bDetectEntities",
			bDetectPlayers: "bDetectPlayers",
			bDetectPlayers1: "bDetectPlayers1",
			bDetectPlayers2: "bDetectPlayers2",
			bDetectPlayers3: "bDetectPlayers3",
			bDetectProjectiles: "bDetectProjectiles",
			bIsBuildingZone: "bIsBuildingZone",
			bIsLooseZone: "bIsLooseZone",
			bIsShareZone: "bIsShareZone",
			bWater: "bWater",
			OccupantCount: "OccupantCount",
			ZoneRef: "ZoneRef",
			bOccupied: "bOccupied"
		}
	},
	Bearing: {
		NAME: "Component_Internal_Bearing",
		BRICK: "B_Joint_Bearing",
		BRICKS: ["B_Joint_Bearing", "B_Joint_Bearing_Micro"],
		PORTS: {
			Damping: "Damping",
			LimitAngle: "LimitAngle",
			bAnglesArePercentages: "bAnglesArePercentages",
			bLimitAngle: "bLimitAngle",
			CurrentAngle: "CurrentAngle"
		}
	},
	Gyroscope: {
		NAME: "Component_Internal_Gyroscope",
		BRICK: "B_Gyroscope",
		BRICKS: ["B_Gyroscope"],
		PORTS: {
			Control_DriveAndSteer: "Control_DriveAndSteer",
			Damping: "Damping",
			MaxForce: "MaxForce",
			Strength: "Strength",
			TargetAxis: "TargetAxis",
			TargetAxis_X: "TargetAxis.X",
			TargetAxis_Y: "TargetAxis.Y",
			TargetAxis_Z: "TargetAxis.Z",
			bDiscoverable: "bDiscoverable",
			bEnabled: "bEnabled"
		}
	},
	InputSplitter: {
		NAME: "Component_Internal_InputSplitter",
		BRICK: "B_1x1_Gate_SeatControlSplitter",
		BRICKS: ["B_1x1_Gate_SeatControlSplitter"],
		PORTS: {
			Character: "Character",
			InputForward: "InputForward",
			InputMouseWheel: "InputMouseWheel",
			InputPitch: "InputPitch",
			InputRight: "InputRight",
			InputRoll: "InputRoll",
			InputUp: "InputUp",
			InputYaw: "InputYaw",
			bPressedC: "bPressedC",
			bPressedE: "bPressedE",
			bPressedLeftMouse: "bPressedLeftMouse",
			bPressedQ: "bPressedQ",
			bPressedRightMouse: "bPressedRightMouse"
		}
	},
	Joint_Wheel: {
		NAME: "Component_Internal_Joint_Wheel",
		BRICK: "B_Joint_Wheel",
		BRICKS: ["B_Joint_Wheel", "B_Joint_Wheel_Micro"],
		PORTS: {
			Control_DriveAndSteer: "Control_DriveAndSteer",
			Damping: "Damping",
			DrivePower: "DrivePower",
			DriveSpeed: "DriveSpeed",
			JointDistance: "JointDistance",
			Steer: "Steer",
			SteerLimitDegree: "SteerLimitDegree",
			SteerPower: "SteerPower",
			SuspensionDamping: "SuspensionDamping",
			SuspensionStiffness: "SuspensionStiffness",
			bAllowEngineSteerCorrect: "bAllowEngineSteerCorrect",
			bCanBrake: "bCanBrake",
			bDiscoverable: "bDiscoverable",
			bDriveWhenNotAttachedToEngine: "bDriveWhenNotAttachedToEngine",
			bEnabled: "bEnabled",
			bReversed: "bReversed",
			bSteerEnabled: "bSteerEnabled",
			bSuspensionEnabled: "bSuspensionEnabled"
		}
	},
	Joint_Wheel_Suspension: {
		NAME: "Component_Internal_Joint_Wheel_Suspension",
		BRICK: "B_Joint_Wheel_Micro_Suspension",
		BRICKS: ["B_Joint_Wheel_Micro_Suspension", "B_Joint_Wheel_Suspension"],
		PORTS: {
			Control_DriveAndSteer: "Control_DriveAndSteer",
			Damping: "Damping",
			DrivePower: "DrivePower",
			DriveSpeed: "DriveSpeed",
			JointDistance: "JointDistance",
			Steer: "Steer",
			SteerLimitDegree: "SteerLimitDegree",
			SteerPower: "SteerPower",
			SuspensionDamping: "SuspensionDamping",
			SuspensionLength: "SuspensionLength",
			SuspensionOffset: "SuspensionOffset",
			SuspensionStiffness: "SuspensionStiffness",
			bAllowEngineSteerCorrect: "bAllowEngineSteerCorrect",
			bCanBrake: "bCanBrake",
			bDiscoverable: "bDiscoverable",
			bDriveWhenNotAttachedToEngine: "bDriveWhenNotAttachedToEngine",
			bEnabled: "bEnabled",
			bReversed: "bReversed",
			bSteerEnabled: "bSteerEnabled",
			bSuspensionEnabled: "bSuspensionEnabled",
			bWheelVisible: "bWheelVisible"
		}
	},
	Microchip: {
		NAME: "Component_Internal_Microchip",
		BRICK: "B_1x1_Microchip",
		BRICKS: ["B_1x1_Microchip"],
		PORTS: {}
	},
	Motor: {
		NAME: "Component_Internal_Motor",
		BRICK: "B_Joint_Motor",
		BRICKS: ["B_Joint_Motor", "B_Joint_Motor_Micro"],
		PORTS: {
			Damping: "Damping",
			LimitAngle: "LimitAngle",
			Power: "Power",
			Speed: "Speed",
			bAnglesArePercentages: "bAnglesArePercentages",
			bEnabled: "bEnabled",
			bLimitAngle: "bLimitAngle",
			CurrentAngle: "CurrentAngle"
		}
	},
	MotorSlider: {
		NAME: "Component_Internal_MotorSlider",
		BRICK: "PB_MotorSliderJoint",
		BRICKS: ["PB_MotorSliderJoint"],
		PORTS: {
			Damping: "Damping",
			Power: "Power",
			Speed: "Speed",
			bEnabled: "bEnabled",
			bPositionsArePercentages: "bPositionsArePercentages",
			CurrentPosition: "CurrentPosition"
		}
	},
	ProjectileSpawner_Cannon: {
		NAME: "Component_Internal_ProjectileSpawner_Cannon",
		BRICK: "B_2x2_Cannon",
		BRICKS: ["B_2x2_Cannon"],
		PORTS: {
			DamageMultiplier: "DamageMultiplier",
			Direction: "Direction",
			FireRate: "FireRate",
			FireSound: "FireSound",
			Instigator: "Instigator",
			NumberOfShots: "NumberOfShots",
			ProjectileClass: "ProjectileClass",
			ScaleMultiplier: "ScaleMultiplier",
			SpawnLocation: "SpawnLocation",
			SpawnMargin: "SpawnMargin",
			SpawnOffsetBias: "SpawnOffsetBias",
			SpeedMultiplier: "SpeedMultiplier",
			SpreadConeAngle: "SpreadConeAngle",
			TargetEntity: "TargetEntity",
			bEnabled: "bEnabled",
			bEnforceFireRate: "bEnforceFireRate",
			bSpreadBiasedTowardsCenter: "bSpreadBiasedTowardsCenter",
			OnFired: "OnFired"
		}
	},
	Rerouter: {
		NAME: "Component_Internal_Rerouter",
		BRICK: "B_1x1_Reroute_Node",
		BRICKS: ["B_1x1_Reroute_Node"],
		PORTS: {
			RER_Input: "RER_Input",
			RER_Output: "RER_Output"
		}
	},
	RigidBearing: {
		NAME: "Component_Internal_RigidBearing",
		BRICK: "B_Joint_RigidBearing",
		BRICKS: ["B_Joint_RigidBearing", "B_Joint_RigidBearing_Micro"],
		PORTS: {
			InterpMode: "InterpMode",
			SmoothTime: "SmoothTime",
			TargetAngle: "TargetAngle",
			TopSpeed: "TopSpeed",
			bAnglesArePercentages: "bAnglesArePercentages",
			CurrentAngle: "CurrentAngle",
			bStopped: "bStopped",
			bWelded: "bWelded"
		}
	},
	RigidSlider: {
		NAME: "Component_Internal_RigidSlider",
		BRICK: "PB_RigidSliderJoint",
		BRICKS: ["PB_RigidSliderJoint"],
		PORTS: {
			InterpMode: "InterpMode",
			SmoothTime: "SmoothTime",
			TargetPosition: "TargetPosition",
			TopSpeed: "TopSpeed",
			bPositionsArePercentages: "bPositionsArePercentages",
			CurrentPosition: "CurrentPosition",
			bStopped: "bStopped",
			bWelded: "bWelded"
		}
	},
	Seat: {
		NAME: "Component_Internal_Seat",
		BRICK: "B_Seat",
		BRICKS: ["B_Seat"],
		PORTS: {
			AirStrafeControl: "AirStrafeControl",
			CameraOrigin: "CameraOrigin",
			CameraOriginOffset: "CameraOriginOffset",
			CameraOriginOffset_X: "CameraOriginOffset.X",
			CameraOriginOffset_Y: "CameraOriginOffset.Y",
			CameraOriginOffset_Z: "CameraOriginOffset.Z",
			ExitOffset: "ExitOffset",
			ExitOffset_X: "ExitOffset.X",
			ExitOffset_Y: "ExitOffset.Y",
			ExitOffset_Z: "ExitOffset.Z",
			FlightInvertXOverride: "FlightInvertXOverride",
			FlightInvertYOverride: "FlightInvertYOverride",
			PromptCustomLabel: "PromptCustomLabel",
			SeatMode: "SeatMode",
			ThirdPersonCameraRotation: "ThirdPersonCameraRotation",
			ThirdPersonCameraRotation_Pitch: "ThirdPersonCameraRotation.Pitch",
			ThirdPersonCameraRotation_Roll: "ThirdPersonCameraRotation.Roll",
			ThirdPersonCameraRotation_Yaw: "ThirdPersonCameraRotation.Yaw",
			ThirdPersonStartingZoom: "ThirdPersonStartingZoom",
			bAllowHeldItems: "bAllowHeldItems",
			bAllowNearbyInteraction: "bAllowNearbyInteraction",
			bFlyingGroundControls: "bFlyingGroundControls",
			bHiddenInteraction: "bHiddenInteraction",
			bRollCameraInThirdPerson: "bRollCameraInThirdPerson",
			bScaleCameraOriginOffsetWithZoom: "bScaleCameraOriginOffsetWithZoom",
			bStickyPlaneThrottle: "bStickyPlaneThrottle",
			SittingCharacter: "SittingCharacter",
			bIsOccupied: "bIsOccupied"
		}
	},
	Servo: {
		NAME: "Component_Internal_Servo",
		BRICK: "B_Joint_Servo",
		BRICKS: ["B_Joint_Servo", "B_Joint_Servo_Micro"],
		PORTS: {
			ActiveDamping: "ActiveDamping",
			Damping: "Damping",
			ForceLimit: "ForceLimit",
			LimitAngle: "LimitAngle",
			Power: "Power",
			TargetAngle: "TargetAngle",
			bAnglesArePercentages: "bAnglesArePercentages",
			bEnabled: "bEnabled",
			bLimitAngle: "bLimitAngle",
			CurrentAngle: "CurrentAngle",
			bStopped: "bStopped"
		}
	},
	ServoSlider: {
		NAME: "Component_Internal_ServoSlider",
		BRICK: "PB_ServoSliderJoint",
		BRICKS: ["PB_ServoSliderJoint"],
		PORTS: {
			Damping: "Damping",
			Exponent: "Exponent",
			Power: "Power",
			TargetPosition: "TargetPosition",
			TopSpeed: "TopSpeed",
			bEnabled: "bEnabled",
			bPositionsArePercentages: "bPositionsArePercentages",
			CurrentPosition: "CurrentPosition",
			bStopped: "bStopped"
		}
	},
	Slider: {
		NAME: "Component_Internal_Slider",
		BRICK: "PB_SliderJoint",
		BRICKS: ["PB_SliderJoint"],
		PORTS: {
			Damping: "Damping",
			bPositionsArePercentages: "bPositionsArePercentages",
			CurrentPosition: "CurrentPosition"
		}
	},
	Socket: {
		NAME: "Component_Internal_Socket",
		BRICK: "B_Joint_Socket",
		BRICKS: ["B_Joint_Socket", "B_Joint_Socket_Micro"],
		PORTS: {}
	},
	Thruster: {
		NAME: "Component_Internal_Thruster",
		BRICK: "B_2x2_Thruster",
		BRICKS: ["B_2x2_Thruster"],
		PORTS: {
			Control_DriveAndSteer: "Control_DriveAndSteer",
			Force: "Force",
			ForceApplication: "ForceApplication",
			Pitch: "Pitch",
			Throttle: "Throttle",
			Yaw: "Yaw",
			bDiscoverable: "bDiscoverable",
			bEnabled: "bEnabled",
			bSpawnLight: "bSpawnLight"
		}
	},
	WeightBrick: {
		NAME: "Component_Internal_WeightBrick",
		BRICK: "B_1x1_Gate_WeightBrick",
		BRICKS: ["B_1x1_Gate_WeightBrick"],
		PORTS: {
			Mass: "Mass",
			MassOffset: "MassOffset",
			MassOffset_X: "MassOffset.X",
			MassOffset_Y: "MassOffset.Y",
			MassOffset_Z: "MassOffset.Z",
			MassSize: "MassSize",
			MassSize_X: "MassSize.X",
			MassSize_Y: "MassSize.Y",
			MassSize_Z: "MassSize.Z"
		}
	},
	WheelEngine: {
		NAME: "Component_Internal_WheelEngine",
		BRICK: "B_1x1_Gate_WheelEngineSlim",
		BRICKS: ["B_1x1_Gate_WheelEngineSlim", "B_Vehicle_Engine"],
		PORTS: {
			ArcadeAeroAuthorityFadeEndSpeed: "ArcadeAeroAuthorityFadeEndSpeed",
			ArcadeAeroAuthorityFadeStartSpeed: "ArcadeAeroAuthorityFadeStartSpeed",
			ArcadeAirGripResponseTime: "ArcadeAirGripResponseTime",
			ArcadeMaxLateralAccelerationGs: "ArcadeMaxLateralAccelerationGs",
			ArcadePitchRate: "ArcadePitchRate",
			ArcadeResponseTime: "ArcadeResponseTime",
			ArcadeRollRate: "ArcadeRollRate",
			ArcadeYawRate: "ArcadeYawRate",
			AudioDescriptor: "AudioDescriptor",
			CenterOfSteering: "CenterOfSteering",
			Character: "Character",
			CustomMass: "CustomMass",
			CustomMassVerticalOffset: "CustomMassVerticalOffset",
			DriveAcceleratingPowerMultiplier: "DriveAcceleratingPowerMultiplier",
			DriveBrakingPowerMultiplier: "DriveBrakingPowerMultiplier",
			DriveDampingMultiplier: "DriveDampingMultiplier",
			DriveInterpSpeed: "DriveInterpSpeed",
			DriveSpeed: "DriveSpeed",
			FlightHandling: "FlightHandling",
			FlightTopSpeed: "FlightTopSpeed",
			GlideTrimStrength: "GlideTrimStrength",
			GlideTrimTargetSpeedMultiplier: "GlideTrimTargetSpeedMultiplier",
			HorizontalSteeringRollMix: "HorizontalSteeringRollMix",
			HorizontalSteeringYawMix: "HorizontalSteeringYawMix",
			KeyboardSteeringRollMix: "KeyboardSteeringRollMix",
			KeyboardSteeringYawMix: "KeyboardSteeringYawMix",
			LiftMultiplier: "LiftMultiplier",
			ManualControlMode: "ManualControlMode",
			ManualInput_Drive: "ManualInput_Drive",
			ManualInput_Pitch: "ManualInput_Pitch",
			ManualInput_Roll: "ManualInput_Roll",
			ManualInput_Steer: "ManualInput_Steer",
			MassDistribution: "MassDistribution",
			PhysicalPitchDampingResponseTime: "PhysicalPitchDampingResponseTime",
			PhysicalRollDampingResponseTime: "PhysicalRollDampingResponseTime",
			PhysicalYawDampingResponseTime: "PhysicalYawDampingResponseTime",
			SteerInterpSpeed: "SteerInterpSpeed",
			SteerLimitDegree: "SteerLimitDegree",
			SteerLimitSpeedFalloff: "SteerLimitSpeedFalloff",
			SteerPowerMultiplier: "SteerPowerMultiplier",
			TankSteerSpeedMultiplier: "TankSteerSpeedMultiplier",
			ThrustMultiplier: "ThrustMultiplier",
			WaterDriveForce: "WaterDriveForce",
			WaterSteeringForce: "WaterSteeringForce",
			WheelFrictionMultiplier: "WheelFrictionMultiplier",
			bAutoRight: "bAutoRight",
			bAutodiscoverAerodynamicSurfaces: "bAutodiscoverAerodynamicSurfaces",
			bAutodiscoverGyroscopes: "bAutodiscoverGyroscopes",
			bAutodiscoverThrusters: "bAutodiscoverThrusters",
			bAutodiscoverWheels: "bAutodiscoverWheels",
			bDisableInWorldControlDiagnostics: "bDisableInWorldControlDiagnostics",
			bEnableAerodynamicRateDamping: "bEnableAerodynamicRateDamping",
			bEnableAirBraking: "bEnableAirBraking",
			bEnableGlideTrim: "bEnableGlideTrim",
			bEnableManualControl: "bEnableManualControl",
			bEnabled: "bEnabled",
			bManualInput_Brake: "bManualInput_Brake",
			bTankSteering: "bTankSteering",
			Control_DriveAndSteer: "Control_DriveAndSteer",
			Speed: "Speed",
			bStalling: "bStalling"
		}
	},
	ItemSpawn: {
		NAME: "Component_ItemSpawn",
		BRICKS: [],
		PORTS: {
			DamageMultiplier: "DamageMultiplier",
			ItemNameOverride: "ItemNameOverride",
			PickupAnimationAxis: "PickupAnimationAxis",
			PickupAnimationPhase: "PickupAnimationPhase",
			PickupBobHeight: "PickupBobHeight",
			PickupBobSpeed: "PickupBobSpeed",
			PickupClass: "PickupClass",
			PickupMeshColors: "PickupMeshColors",
			PickupMinigameResetRespawnDelay: "PickupMinigameResetRespawnDelay",
			PickupOffsetDirection: "PickupOffsetDirection",
			PickupOffsetDistance: "PickupOffsetDistance",
			PickupRespawnTime: "PickupRespawnTime",
			PickupRotation: "PickupRotation",
			PickupRotation_Pitch: "PickupRotation.Pitch",
			PickupRotation_Roll: "PickupRotation.Roll",
			PickupRotation_Yaw: "PickupRotation.Yaw",
			PickupScale: "PickupScale",
			PickupSpinSpeed: "PickupSpinSpeed",
			ProjectileOverride: "ProjectileOverride",
			WeaponSpeedMultiplier: "WeaponSpeedMultiplier",
			bOverridePickupColors: "bOverridePickupColors",
			bPickupAnimationAxisLocal: "bPickupAnimationAxisLocal",
			bPickupAnimationEnabled: "bPickupAnimationEnabled",
			bPickupAutoDisableOnPickup: "bPickupAutoDisableOnPickup",
			bPickupEnabled: "bPickupEnabled",
			bPickupRespawnOnMinigameReset: "bPickupRespawnOnMinigameReset",
			bRenderTranslucentWhenDisabled: "bRenderTranslucentWhenDisabled",
			bShowPickupEnabled: "bShowPickupEnabled"
		}
	},
	OneShotAudioEmitter: {
		NAME: "Component_OneShotAudioEmitter",
		BRICK: "B_1x1_SoundEmitter",
		BRICKS: ["B_1x1_SoundEmitter"],
		PORTS: {
			AudioDescriptor: "AudioDescriptor",
			InnerRadius: "InnerRadius",
			MaxDistance: "MaxDistance",
			PitchMultiplier: "PitchMultiplier",
			Play: "Play",
			RepeatCount: "RepeatCount",
			RepeatTime: "RepeatTime",
			RepeatVariance: "RepeatVariance",
			Stop: "Stop",
			VolumeMultiplier: "VolumeMultiplier",
			bEnableRepeat: "bEnableRepeat",
			bSpatialization: "bSpatialization"
		}
	},
	PointLight: {
		NAME: "Component_PointLight",
		BRICKS: [],
		PORTS: {
			Brightness: "Brightness",
			Color: "Color",
			Color_A: "Color.A",
			Color_B: "Color.B",
			Color_G: "Color.G",
			Color_R: "Color.R",
			Radius: "Radius",
			RayTracingVisibility: "RayTracingVisibility",
			bCastShadows: "bCastShadows",
			bEnabled: "bEnabled",
			bMatchBrickShape: "bMatchBrickShape",
			bUseBrickColor: "bUseBrickColor"
		}
	},
	ProjectileSpawner: {
		NAME: "Component_ProjectileSpawner",
		BRICKS: [],
		PORTS: {
			DamageMultiplier: "DamageMultiplier",
			Direction: "Direction",
			FireRate: "FireRate",
			FireSound: "FireSound",
			Instigator: "Instigator",
			NumberOfShots: "NumberOfShots",
			ProjectileClass: "ProjectileClass",
			ScaleMultiplier: "ScaleMultiplier",
			SpawnLocation: "SpawnLocation",
			SpawnMargin: "SpawnMargin",
			SpawnOffsetBias: "SpawnOffsetBias",
			SpeedMultiplier: "SpeedMultiplier",
			SpreadConeAngle: "SpreadConeAngle",
			TargetEntity: "TargetEntity",
			bEnabled: "bEnabled",
			bEnforceFireRate: "bEnforceFireRate",
			bSpreadBiasedTowardsCenter: "bSpreadBiasedTowardsCenter",
			OnFired: "OnFired"
		}
	},
	SpawnPoint: {
		NAME: "Component_SpawnPoint",
		BRICK: "B_SpawnPoint",
		BRICKS: ["B_SpawnPoint"],
		PORTS: {
			bEnable: "bEnable",
			bRotatePlayerGravityOnSpawn: "bRotatePlayerGravityOnSpawn"
		}
	},
	SpotLight: {
		NAME: "Component_SpotLight",
		BRICKS: [],
		PORTS: {
			Brightness: "Brightness",
			Color: "Color",
			Color_A: "Color.A",
			Color_B: "Color.B",
			Color_G: "Color.G",
			Color_R: "Color.R",
			InnerConeAngle: "InnerConeAngle",
			OuterConeAngle: "OuterConeAngle",
			Radius: "Radius",
			RayTracingVisibility: "RayTracingVisibility",
			Rotation: "Rotation",
			Rotation_Pitch: "Rotation.Pitch",
			Rotation_Roll: "Rotation.Roll",
			Rotation_Yaw: "Rotation.Yaw",
			bCastShadows: "bCastShadows",
			bEnabled: "bEnabled",
			bUseBrickColor: "bUseBrickColor"
		}
	},
	Switch: {
		NAME: "Component_Switch",
		BRICKS: [],
		PORTS: {
			InteractSound: "InteractSound",
			PromptCustomLabel: "PromptCustomLabel",
			bAllowNearbyInteraction: "bAllowNearbyInteraction",
			bHiddenInteraction: "bHiddenInteraction",
			Character: "Character",
			bEnabled: "bEnabled"
		}
	},
	Target: {
		NAME: "Component_Target",
		BRICK: "B_2x2F_Target",
		BRICKS: ["B_2x2F_Target"],
		PORTS: {
			OnTime: "OnTime",
			CharacterThatJustHit: "CharacterThatJustHit",
			Damage: "Damage",
			WeaponNameThatJustHit: "WeaponNameThatJustHit",
			WeaponThatJustHit: "WeaponThatJustHit",
			bJustHit: "bJustHit"
		}
	},
	TextDisplay: {
		NAME: "Component_TextDisplay",
		BRICKS: [],
		PORTS: {
			Anchor: "Anchor",
			Anchor_X: "Anchor.X",
			Anchor_Y: "Anchor.Y",
			Billboard: "Billboard",
			Color: "Color",
			Color_A: "Color.A",
			Color_B: "Color.B",
			Color_G: "Color.G",
			Color_R: "Color.R",
			Face: "Face",
			Font: "Font",
			GraffitiAngleLimit: "GraffitiAngleLimit",
			GraffitiDepthLimit: "GraffitiDepthLimit",
			GraffitiLayer: "GraffitiLayer",
			Kerning: "Kerning",
			LineHeight: "LineHeight",
			LineOffset: "LineOffset",
			Material: "Material",
			MaterialSlider: "MaterialSlider",
			Offset: "Offset",
			Offset_X: "Offset.X",
			Offset_Y: "Offset.Y",
			Offset_Z: "Offset.Z",
			Outline: "Outline",
			OutlineColor: "OutlineColor",
			OutlineColor_A: "OutlineColor.A",
			OutlineColor_B: "OutlineColor.B",
			OutlineColor_G: "OutlineColor.G",
			OutlineColor_R: "OutlineColor.R",
			OutlineWidth: "OutlineWidth",
			Rotation: "Rotation",
			ScuffWidth: "ScuffWidth",
			Shading: "Shading",
			ShadingWidth: "ShadingWidth",
			Skew: "Skew",
			Text: "Text",
			Typeface: "Typeface",
			WidthScale: "WidthScale",
			bAlignToWedge: "bAlignToWedge",
			bEnabled: "bEnabled",
			bFlipShading: "bFlipShading",
			bForeground: "bForeground",
			bOverrideColor: "bOverrideColor",
			bOverrideOutlineColor: "bOverrideOutlineColor",
			bSharpCorners: "bSharpCorners",
			bSharpOutlines: "bSharpOutlines"
		}
	},
	Touch: {
		NAME: "Component_Touch",
		BRICKS: [],
		PORTS: {
			BeginTouchSound: "BeginTouchSound",
			EndTouchSound: "EndTouchSound",
			bCollisionEnabled_Player: "bCollisionEnabled_Player",
			bCollisionEnabled_Player1: "bCollisionEnabled_Player1",
			bCollisionEnabled_Player2: "bCollisionEnabled_Player2",
			bCollisionEnabled_Player3: "bCollisionEnabled_Player3",
			Character: "Character",
			TouchCount: "TouchCount",
			bTouching: "bTouching"
		}
	},
	PlayAudioAt: {
		NAME: "Component_WireGraph_PlayAudioAt",
		BRICK: "B_1x1_Gate_Exec_Entity_PlayAudioAt",
		BRICKS: ["B_1x1_Gate_Exec_Entity_PlayAudioAt"],
		PORTS: {
			Entity: "Entity",
			Exec: "Exec",
			InnerRadius: "InnerRadius",
			MaxDistance: "MaxDistance",
			PitchMultiplier: "PitchMultiplier",
			VolumeMultiplier: "VolumeMultiplier",
			bSpatialization: "bSpatialization",
			ExecOut: "ExecOut"
		}
	}
}, ua = !0, da = () => ua, fa = {
	A: 4294967295,
	B: 4294967295,
	C: 4294967295,
	D: 4294967295
};
function pa(e) {
	let t = nr(e), n = new DataView(t.buffer, t.byteOffset, 16);
	return {
		A: n.getUint32(0, !1),
		B: n.getUint32(4, !1),
		C: n.getUint32(8, !1),
		D: n.getUint32(12, !1)
	};
}
function ma(e) {
	let t = /* @__PURE__ */ new Uint8Array(16), n = new DataView(t.buffer);
	return n.setUint32(0, e.A, !1), n.setUint32(4, e.B, !1), n.setUint32(8, e.C, !1), n.setUint32(12, e.D, !1), tr(Array.from(t));
}
//#endregion
//#region src/brdb/pending.ts
var ha = (e) => ({
	type: "folder",
	children: e
}), q = (e) => ({
	type: "file",
	content: e
}), ga = /* @__PURE__ */ t({
	mpArrayHeader: () => ka,
	mpBinHeader: () => Oa,
	mpBool: () => wa,
	mpF32: () => Ea,
	mpF64: () => Da,
	mpInt: () => Y,
	mpMapHeader: () => Aa,
	mpNil: () => Ca,
	mpStr: () => X,
	mpU8: () => Ta,
	mpUint: () => J,
	rdArrayLen: () => Ha,
	rdBinLen: () => Va,
	rdBool: () => za,
	rdF32: () => La,
	rdF64: () => Ra,
	rdInt: () => Fa,
	rdMapLen: () => Ua,
	rdNil: () => Wa,
	rdStr: () => Ba,
	rdUint: () => Ia
}), _a = new TextEncoder(), va = new TextDecoder("utf-8", { fatal: !0 }), ya = (e, t) => {
	if (!Number.isSafeInteger(e)) throw RangeError(`brdb: ${t} ${e} is not a safe integer`);
}, ba = -(2n ** 63n), xa = 2n ** 63n - 1n, Sa = 2n ** 64n - 1n, Ca = (e) => e.u8(192), wa = (e, t) => e.u8(t ? 195 : 194);
function Ta(e, t) {
	if (t < 0 || t > 255 || !Number.isInteger(t)) throw RangeError(`brdb: u8 value out of range: ${t}`);
	t <= 127 || t >= 224 || e.u8(208), e.u8(t);
}
function J(e, t) {
	if (typeof t == "bigint") {
		if (t < 0n) throw RangeError(`brdb: uint value negative: ${t}`);
		if (t > Sa) throw RangeError(`brdb: u64 value out of range: ${t}`);
		if (t > BigInt(2 ** 53 - 1)) {
			e.u8(207), e.u64be(t);
			return;
		}
		t = Number(t);
	}
	if (ya(t, "uint"), t < 0) throw RangeError(`brdb: uint value negative: ${t}`);
	t <= 127 ? e.u8(t) : t <= 255 ? (e.u8(204), e.u8(t)) : t <= 65535 ? (e.u8(205), e.u16be(t)) : t <= 4294967295 ? (e.u8(206), e.u32be(t)) : (e.u8(207), e.u64be(BigInt(t)));
}
function Y(e, t) {
	if (typeof t == "bigint") {
		if (t < ba || t > xa) throw RangeError(`brdb: i64 value out of range: ${t}`);
		if (t > BigInt(2 ** 53 - 1) || t < BigInt(-(2 ** 53 - 1))) {
			e.u8(211), e.i64be(t);
			return;
		}
		t = Number(t);
	}
	ya(t, "int"), t >= 0 ? t < 128 ? e.u8(t) : t <= 32767 ? (e.u8(209), e.i16be(t)) : t <= 2147483647 ? (e.u8(210), e.i32be(t)) : (e.u8(211), e.i64be(BigInt(t))) : t > -32 ? e.u8(256 + t) : t >= -128 ? (e.u8(208), e.i8(t)) : t >= -32768 ? (e.u8(209), e.i16be(t)) : t >= -2147483648 ? (e.u8(210), e.i32be(t)) : (e.u8(211), e.i64be(BigInt(t)));
}
function Ea(e, t) {
	t === Math.round(t) && t < 65535 && t > -32768 ? Y(e, t === 0 ? 0 : t) : (e.u8(202), e.f32be(t));
}
function Da(e, t) {
	t === Math.round(t) && t < 4294967295 && t > -2147483648 ? Y(e, t === 0 ? 0 : t) : (e.u8(203), e.f64be(t));
}
function X(e, t) {
	let n = _a.encode(t), r = n.length;
	r < 32 ? e.u8(160 | r) : r < 256 ? (e.u8(217), e.u8(r)) : r <= 65535 ? (e.u8(218), e.u16be(r)) : (e.u8(219), e.u32be(r)), e.bytes(n);
}
function Oa(e, t) {
	t < 256 ? (e.u8(196), e.u8(t)) : t <= 65535 ? (e.u8(197), e.u16be(t)) : (e.u8(198), e.u32be(t));
}
function ka(e, t) {
	t < 16 ? e.u8(144 | t) : t <= 65535 ? (e.u8(220), e.u16be(t)) : (e.u8(221), e.u32be(t));
}
function Aa(e, t) {
	t < 16 ? e.u8(128 | t) : t <= 65535 ? (e.u8(222), e.u16be(t)) : (e.u8(223), e.u32be(t));
}
var ja = (e, t) => {
	if (e > BigInt(2 ** 53 - 1) || e < BigInt(-(2 ** 53 - 1))) {
		if (t) return e;
		throw RangeError(`brdb: 64-bit value ${e} exceeds JS safe integer range`);
	}
	return Number(e);
}, Ma = (e, t) => {
	throw TypeError(`brdb: unexpected marker 0x${e.toString(16)} for ${t}`);
}, Na = (e) => (e & 128) == 0, Pa = (e) => (e & 224) == 224;
function Fa(e, t) {
	let n = e.u8();
	if (Na(n)) return n;
	if (Pa(n)) return n - 256;
	switch (n) {
		case 204: return e.u8();
		case 205: return e.u16be();
		case 206: return e.u32be();
		case 207: return ja(e.u64be(), t);
		case 208: return e.i8();
		case 209: return e.i16be();
		case 210: return e.i32be();
		case 211: return ja(e.i64be(), t);
		default: return Ma(n, "integer");
	}
}
function Ia(e, t) {
	let n = e.u8();
	if (Na(n) || Pa(n)) return n;
	switch (n) {
		case 204:
		case 208: return e.u8();
		case 205: return e.u16be();
		case 206: return e.u32be();
		case 207: return ja(e.u64be(), t);
		default: return Ma(n, "uint");
	}
}
function La(e) {
	let t = e.u8();
	if (Na(t)) return t;
	if (Pa(t)) return t - 256;
	switch (t) {
		case 204: return e.u8();
		case 205: return e.u16be();
		case 208: return e.i8();
		case 209: return e.i16be();
		case 202: return e.f32be();
		default: return Ma(t, "float32");
	}
}
function Ra(e) {
	let t = e.u8();
	if (Na(t)) return t;
	if (Pa(t)) return t - 256;
	switch (t) {
		case 204: return e.u8();
		case 205: return e.u16be();
		case 206: return e.u32be();
		case 208: return e.i8();
		case 209: return e.i16be();
		case 210: return e.i32be();
		case 202: return e.f32be();
		case 203: return e.f64be();
		default: return Ma(t, "float64");
	}
}
function za(e) {
	let t = e.u8();
	return t === 195 ? !0 : t === 194 ? !1 : Ma(t, "bool");
}
function Ba(e) {
	let t = e.u8(), n;
	if ((t & 224) == 160) n = t & 31;
	else if (t === 217) n = e.u8();
	else if (t === 218) n = e.u16be();
	else if (t === 219) n = e.u32be();
	else return Ma(t, "str");
	return va.decode(e.bytes(n));
}
function Va(e) {
	let t = e.u8();
	return t === 196 ? e.u8() : t === 197 ? e.u16be() : t === 198 ? e.u32be() : Ma(t, "bin");
}
function Ha(e) {
	let t = e.u8();
	return (t & 240) == 144 ? t & 15 : t === 220 ? e.u16be() : t === 221 ? e.u32be() : Ma(t, "array");
}
function Ua(e) {
	let t = e.u8();
	return (t & 240) == 128 ? t & 15 : t === 222 ? e.u16be() : t === 223 ? e.u32be() : Ma(t, "map");
}
function Wa(e) {
	let t = e.u8();
	t !== 192 && Ma(t, "nil");
}
//#endregion
//#region src/brdb/schemaText.ts
var Ga = (e) => e.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ").replace(/#[^\n]*/g, " "), Ka = String.raw`[A-Za-z_]\w*(?:::\w+)*`;
function qa(e) {
	let t = e.replace(/_/g, "");
	return t.startsWith("0b") ? parseInt(t.slice(2), 2) : t.startsWith("0x") ? parseInt(t.slice(2), 16) : parseInt(t, 10);
}
function Ja(e) {
	let t = Ga(e), n = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Map(), a = /\b(enum|variant|struct)\s+([A-Za-z0-9_]+)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g, o = new RegExp(String.raw`^(${Ka})\s*=\s*(-?\d+(?:_\d+)*|0b[01]+(?:_[01]+)*|0x[0-9a-fA-F]+(?:_[0-9a-fA-F]+)*)$`), s = new RegExp(String.raw`^${Ka}$`), c = new RegExp(String.raw`^(\w+)\s*:\s*(\w+)\s*(\[\s*(flat)?\s*\])?$`), l = new RegExp(String.raw`^(\w+)\s*:\s*\{\s*(\w+)\s*:\s*(\w+)\s*\}$`), u = 0, d;
	for (; d = a.exec(t);) {
		if (t.slice(u, d.index).trim() !== "") throw Error(`brdb: unexpected schema text before ${d[2]}`);
		u = a.lastIndex;
		let [, e, f, p] = d, m = p.split(",").map((e) => e.trim()).filter((e) => e !== "");
		if (e === "enum") {
			let e = /* @__PURE__ */ new Map();
			for (let t of m) {
				let n = o.exec(t);
				if (!n) throw Error(`brdb: cannot parse enum entry '${t}' in ${f}`);
				e.set(n[1], qa(n[2]));
			}
			n.set(f, e);
		} else if (e === "variant") {
			let e = [];
			for (let t of m) {
				if (!s.test(t)) throw Error(`brdb: cannot parse variant member '${t}' in ${f}`);
				e.push(t);
			}
			r.set(f, e);
		} else {
			let e = /* @__PURE__ */ new Map();
			for (let t of m) {
				let n = l.exec(t);
				if (n) {
					e.set(n[1], {
						kind: "map",
						key: n[2],
						value: n[3]
					});
					continue;
				}
				let r = c.exec(t);
				if (!r) throw Error(`brdb: cannot parse struct property '${t}' in ${f}`);
				let [, i, a, o, s] = r;
				e.set(i, o ? {
					kind: s ? "flatarray" : "array",
					type: a
				} : {
					kind: "type",
					type: a
				});
			}
			i.set(f, e);
		}
	}
	if (t.slice(u).trim() !== "") throw Error("brdb: trailing unparsed schema text");
	return {
		enums: n,
		variants: r,
		structs: i
	};
}
//#endregion
//#region src/brdb/schemas.ts
var Ya = {
	BRSavedGlobalDataSoA: {
		enums: {},
		variants: {},
		structs: {
			BRSavedPrimaryAssetId: {
				PrimaryAssetType: "str",
				PrimaryAssetName: "str"
			},
			BRSavedGlobalDataSoA: {
				EntityTypeNames: ["str"],
				EntityDataClassNames: ["str"],
				BasicBrickAssetNames: ["str"],
				ProceduralBrickAssetNames: ["str"],
				MaterialAssetNames: ["str"],
				ComponentTypeNames: ["str"],
				ComponentDataStructNames: ["str"],
				ComponentWirePortNames: ["str"],
				ExternalAssetReferences: ["BRSavedPrimaryAssetId"],
				GlobalGridEntityTypeIndex: "i32"
			}
		}
	},
	BRSavedOwnerTableSoA: {
		enums: {},
		variants: {},
		structs: {
			BRGuid: {
				A: "u32",
				B: "u32",
				C: "u32",
				D: "u32"
			},
			BRSavedOwnerTableSoA: {
				UserIds: ["BRGuid", null],
				UserNames: ["str"],
				DisplayNames: ["str"],
				EntityCounts: ["u32"],
				BrickCounts: ["u32"],
				ComponentCounts: ["u32"],
				WireCounts: ["u32"]
			}
		}
	},
	BRSavedBrickChunkIndexSoA: {
		enums: {},
		variants: {},
		structs: {
			BRSavedChunk3DIndex: {
				X: "i16",
				Y: "i16",
				Z: "i16"
			},
			IntVector: {
				X: "i32",
				Y: "i32",
				Z: "i32"
			},
			BRSavedBrickChunkIndexSoA: {
				Chunk3DIndices: ["BRSavedChunk3DIndex"],
				ChunkOffsets: ["IntVector"],
				ChunkSizes: ["i32"],
				NumBricks: ["u32"],
				NumComponents: ["u32"],
				NumWires: ["u32"]
			}
		}
	},
	BRSavedBrickChunkSoA: {
		enums: {},
		variants: {},
		structs: {
			BRSavedBitFlags: { Flags: ["u8", null] },
			BRSavedBrickColor: {
				R: "u8",
				G: "u8",
				B: "u8",
				A: "u8"
			},
			BRSavedBrickSize: {
				X: "u16",
				Y: "u16",
				Z: "u16"
			},
			BRSavedBrickSizeCounter: {
				AssetIndex: "u32",
				NumSizes: "u32"
			},
			BRSavedRelativeBrickPosition: {
				X: "i16",
				Y: "i16",
				Z: "i16"
			},
			BRSavedBrickChunkSoA: {
				ProceduralBrickStartingIndex: "u32",
				BrickSizeCounters: ["BRSavedBrickSizeCounter"],
				BrickSizes: ["BRSavedBrickSize"],
				BrickTypeIndices: ["u32"],
				OwnerIndices: ["u32"],
				OriginalOwnerIndices: ["u32"],
				RelativePositions: ["BRSavedRelativeBrickPosition", null],
				Orientations: ["u8", null],
				CollisionFlags_Player: "BRSavedBitFlags",
				CollisionFlags_Player1: "BRSavedBitFlags",
				CollisionFlags_Player2: "BRSavedBitFlags",
				CollisionFlags_Player3: "BRSavedBitFlags",
				CollisionFlags_Weapon: "BRSavedBitFlags",
				CollisionFlags_Interaction: "BRSavedBitFlags",
				CollisionFlags_Physics: "BRSavedBitFlags",
				VisibilityFlags: "BRSavedBitFlags",
				MaterialIndices: ["u8", null],
				ColorsAndAlphas: ["BRSavedBrickColor", null],
				bColorsAreLinear: "bool"
			}
		}
	},
	BRSavedWireChunkSoA: {
		enums: {},
		variants: {},
		structs: {
			BRSavedBitFlags: { Flags: ["u8", null] },
			BRSavedChunk3DIndex: {
				X: "i16",
				Y: "i16",
				Z: "i16"
			},
			BRSavedLocalWirePortSource: {
				BrickIndexInChunk: "u32",
				ComponentTypeIndex: "u16",
				PortIndex: "u16"
			},
			BRSavedWirePortTarget: {
				BrickIndexInChunk: "u32",
				ComponentTypeIndex: "u16",
				PortIndex: "u16"
			},
			BRSavedRemoteWirePortSource: {
				GridPersistentIndex: "u32",
				ChunkIndex: "BRSavedChunk3DIndex",
				BrickIndexInChunk: "u32",
				ComponentTypeIndex: "u16",
				PortIndex: "u16"
			},
			BRSavedWireChunkSoA: {
				RemoteWireSources: ["BRSavedRemoteWirePortSource"],
				LocalWireSources: ["BRSavedLocalWirePortSource"],
				RemoteWireTargets: ["BRSavedWirePortTarget"],
				LocalWireTargets: ["BRSavedWirePortTarget"],
				PendingPropagationFlags: "BRSavedBitFlags"
			}
		}
	},
	BRSavedComponentChunkSoA: {
		enums: {},
		variants: {},
		structs: {
			BRSavedBrickComponentTypeCounter: {
				TypeIndex: "u32",
				NumInstances: "u32"
			},
			Quat4f: {
				X: "f32",
				Y: "f32",
				Z: "f32",
				W: "f32"
			},
			Vector3f: {
				X: "f32",
				Y: "f32",
				Z: "f32"
			},
			BRSavedComponentChunkSoA: {
				ComponentTypeCounters: ["BRSavedBrickComponentTypeCounter"],
				ComponentBrickIndices: ["u32"],
				JointBrickIndices: ["u32"],
				JointEntityReferences: ["u32"],
				JointInitialRelativeOffsets: ["Vector3f", null],
				JointInitialRelativeRotations: ["Quat4f", null],
				MicrochipBrickIndices: ["u32"],
				MicrochipBrickGridReferences: ["u32"]
			}
		}
	},
	BRSavedComponentChunkSoA_max: {
		enums: {
			EBRColorSpace: {
				"EBRColorSpace::Linear": 0,
				"EBRColorSpace::Srgb": 1,
				"EBRColorSpace::Oklab": 2,
				"EBRColorSpace::Hsv": 3,
				"EBRColorSpace::EBRColorSpace_MAX": 4
			},
			EBRDisplayTextEasing: {
				"EBRDisplayTextEasing::Linear": 0,
				"EBRDisplayTextEasing::EaseIn": 1,
				"EBRDisplayTextEasing::EaseOut": 2,
				"EBRDisplayTextEasing::EaseInOut": 3,
				"EBRDisplayTextEasing::EBRDisplayTextEasing_MAX": 4
			},
			EBRDisplayTextJustification: {
				"EBRDisplayTextJustification::Left": 0,
				"EBRDisplayTextJustification::Center": 1,
				"EBRDisplayTextJustification::Right": 2,
				"EBRDisplayTextJustification::EBRDisplayTextJustification_MAX": 3
			},
			EBREasingDirection: {
				"EBREasingDirection::In": 0,
				"EBREasingDirection::Out": 1,
				"EBREasingDirection::InOut": 2,
				"EBREasingDirection::EBREasingDirection_MAX": 3
			},
			EBREasingFunction: {
				"EBREasingFunction::Linear": 0,
				"EBREasingFunction::Sine": 1,
				"EBREasingFunction::Quad": 2,
				"EBREasingFunction::Cubic": 3,
				"EBREasingFunction::Quart": 4,
				"EBREasingFunction::Quint": 5,
				"EBREasingFunction::Expo": 6,
				"EBREasingFunction::Circ": 7,
				"EBREasingFunction::Back": 8,
				"EBREasingFunction::Elastic": 9,
				"EBREasingFunction::Bounce": 10,
				"EBREasingFunction::EBREasingFunction_MAX": 11
			},
			EBrickAerodynamicForceApplication: {
				"EBrickAerodynamicForceApplication::Stabilized": 0,
				"EBrickAerodynamicForceApplication::AtSurface": 1,
				"EBrickAerodynamicForceApplication::LongitudinallyStabilized": 2,
				"EBrickAerodynamicForceApplication::EBrickAerodynamicForceApplication_MAX": 3
			},
			EBrickAerodynamicSurfaceRole: {
				"EBrickAerodynamicSurfaceRole::Auto": 0,
				"EBrickAerodynamicSurfaceRole::Fixed": 1,
				"EBrickAerodynamicSurfaceRole::Pitch": 2,
				"EBrickAerodynamicSurfaceRole::Roll": 3,
				"EBrickAerodynamicSurfaceRole::Yaw": 4,
				"EBrickAerodynamicSurfaceRole::EBrickAerodynamicSurfaceRole_MAX": 5
			},
			EBrickAxis: {
				"EBrickAxis::X": 0,
				"EBrickAxis::Y": 1,
				"EBrickAxis::Z": 2,
				"EBrickAxis::MAX": 3
			},
			EBrickDirection: {
				"EBrickDirection::X_Positive": 0,
				"EBrickDirection::X_Negative": 1,
				"EBrickDirection::Y_Positive": 2,
				"EBrickDirection::Y_Negative": 3,
				"EBrickDirection::Z_Positive": 4,
				"EBrickDirection::Z_Negative": 5,
				"EBrickDirection::MAX": 6
			},
			EBrickLightRayTracingVisibility: {
				"EBrickLightRayTracingVisibility::Both": 0,
				"EBrickLightRayTracingVisibility::HWRTOnly": 1,
				"EBrickLightRayTracingVisibility::NonHWRTOnly": 2,
				"EBrickLightRayTracingVisibility::EBrickLightRayTracingVisibility_MAX": 3
			},
			EBrickMaterial: {
				"EBrickMaterial::Plastic": 0,
				"EBrickMaterial::Glass": 1,
				"EBrickMaterial::TranslucentPlastic": 2,
				"EBrickMaterial::Glow": 3,
				"EBrickMaterial::Metal": 4,
				"EBrickMaterial::Hologram": 5,
				"EBrickMaterial::EBrickMaterial_MAX": 6
			},
			EBrickRigidJointInterpMode: {
				"EBrickRigidJointInterpMode::Snap": 0,
				"EBrickRigidJointInterpMode::Linear": 1,
				"EBrickRigidJointInterpMode::Smooth": 2,
				"EBrickRigidJointInterpMode::EBrickRigidJointInterpMode_MAX": 3
			},
			EBrickSeatAirStrafeControl: {
				"EBrickSeatAirStrafeControl::Roll": 0,
				"EBrickSeatAirStrafeControl::Yaw": 1,
				"EBrickSeatAirStrafeControl::EBrickSeatAirStrafeControl_MAX": 2
			},
			EBrickSeatCameraOrigin: {
				"EBrickSeatCameraOrigin::Seat": 0,
				"EBrickSeatCameraOrigin::GridCenter": 1,
				"EBrickSeatCameraOrigin::EBrickSeatCameraOrigin_MAX": 2
			},
			EBrickSeatFlightInvertOverride: {
				"EBrickSeatFlightInvertOverride::UsePlayerSetting": 0,
				"EBrickSeatFlightInvertOverride::NotInverted": 1,
				"EBrickSeatFlightInvertOverride::Inverted": 2,
				"EBrickSeatFlightInvertOverride::EBrickSeatFlightInvertOverride_MAX": 3
			},
			EBrickSeatMode: {
				"EBrickSeatMode::Auto": 0,
				"EBrickSeatMode::Ground": 1,
				"EBrickSeatMode::GroundUnlocked": 2,
				"EBrickSeatMode::Air": 3,
				"EBrickSeatMode::EBrickSeatMode_MAX": 4
			},
			EBrickThrusterForceApplication: {
				"EBrickThrusterForceApplication::CenterOfMass": 0,
				"EBrickThrusterForceApplication::AtThruster": 1,
				"EBrickThrusterForceApplication::EBrickThrusterForceApplication_MAX": 2
			},
			EBrickVehicleFlightHandling: {
				"EBrickVehicleFlightHandling::Physical": 0,
				"EBrickVehicleFlightHandling::Arcade": 1,
				"EBrickVehicleFlightHandling::EBrickVehicleFlightHandling_MAX": 2
			},
			EBrickVehicleMassDistribution: {
				"EBrickVehicleMassDistribution::Compact": 0,
				"EBrickVehicleMassDistribution::VehicleBounds": 1,
				"EBrickVehicleMassDistribution::EBrickVehicleMassDistribution_MAX": 2
			},
			EBRInventoryEntryPlanType: {
				"EBRInventoryEntryPlanType::Nothing": 0,
				"EBRInventoryEntryPlanType::Brick": 1,
				"EBRInventoryEntryPlanType::Entity": 2,
				"EBRInventoryEntryPlanType::Item": 3,
				"EBRInventoryEntryPlanType::EBRInventoryEntryPlanType_MAX": 4
			},
			EBRPawnCollisionChannel: {
				"EBRPawnCollisionChannel::Channel1": 0,
				"EBRPawnCollisionChannel::Channel2": 1,
				"EBRPawnCollisionChannel::Channel3": 2,
				"EBRPawnCollisionChannel::Channel4": 3,
				"EBRPawnCollisionChannel::EBRPawnCollisionChannel_MAX": 4
			},
			EBRSweepCollisionChannel: {
				"EBRSweepCollisionChannel::Physics": 0,
				"EBRSweepCollisionChannel::Weapon": 1,
				"EBRSweepCollisionChannel::Interaction": 2,
				"EBRSweepCollisionChannel::Tool": 3,
				"EBRSweepCollisionChannel::Player1": 4,
				"EBRSweepCollisionChannel::Player2": 5,
				"EBRSweepCollisionChannel::Player3": 6,
				"EBRSweepCollisionChannel::Player4": 7,
				"EBRSweepCollisionChannel::NoAdditionalRestriction": 8,
				"EBRSweepCollisionChannel::EBRSweepCollisionChannel_MAX": 9
			},
			EBRTextFacing: {
				"EBRTextFacing::None": 0,
				"EBRTextFacing::Full": 1,
				"EBRTextFacing::InPlane": 2,
				"EBRTextFacing::EBRTextFacing_MAX": 3
			},
			EBRTextMaterial: {
				"EBRTextMaterial::Unlit": 0,
				"EBRTextMaterial::Graffiti": 1,
				"EBRTextMaterial::Plastic": 2,
				"EBRTextMaterial::Metallic": 3,
				"EBRTextMaterial::Glow": 4,
				"EBRTextMaterial::TranslucentPlastic": 5,
				"EBRTextMaterial::Glass": 6,
				"EBRTextMaterial::EBRTextMaterial_MAX": 7
			},
			EBRTextOutline: {
				"EBRTextOutline::None": 0,
				"EBRTextOutline::Inlined": 1,
				"EBRTextOutline::Outlined": 2,
				"EBRTextOutline::HollowInlined": 3,
				"EBRTextOutline::HollowOutlined": 4,
				"EBRTextOutline::EBRTextOutline_MAX": 5
			},
			EBRTextShading: {
				"EBRTextShading::None": 0,
				"EBRTextShading::Chamfer": 1,
				"EBRTextShading::Fillet": 2,
				"EBRTextShading::DoubleChamfer": 3,
				"EBRTextShading::DoubleFillet": 4,
				"EBRTextShading::Rounded": 5,
				"EBRTextShading::EBRTextShading_MAX": 6
			},
			EBRTextTypeface: {
				"EBRTextTypeface::Regular": 0,
				"EBRTextTypeface::Bold": 1,
				"EBRTextTypeface::Italic": 2,
				"EBRTextTypeface::BoldItalic": 3,
				"EBRTextTypeface::EBRTextTypeface_MAX": 4
			},
			EProjectileSpawnLocation: {
				"EProjectileSpawnLocation::FaceCenter": 0,
				"EProjectileSpawnLocation::RandomPointInFace": 1,
				"EProjectileSpawnLocation::EProjectileSpawnLocation_MAX": 2
			}
		},
		variants: {
			BRInventoryEntryVariant: [
				"BRInventoryEntryNothing",
				"BRInventoryEntryBrick",
				"BRInventoryEntryEntity",
				"BRInventoryEntryItem"
			],
			WireGraphArrayVariant: [
				"WireGraphDoubleArray",
				"WireGraphInt64Array",
				"WireGraphBoolArray",
				"WireGraphObjectArray",
				"WireGraphVectorArray",
				"WireGraphRotatorArray",
				"WireGraphQuatArray",
				"WireGraphStringArray",
				"WireGraphLinearColorArray",
				"WireGraphEnumArrayWrapper"
			],
			WireGraphEnumArrayVariant: /* @__PURE__ */ "WireGraphEnumArray_EBrickDirection.WireGraphEnumArray_EBrickAxis.WireGraphEnumArray_EBRPawnCollisionChannel.WireGraphEnumArray_EBRTextShading.WireGraphEnumArray_EBRTextOutline.WireGraphEnumArray_EBRTextMaterial.WireGraphEnumArray_EBRTextTypeface.WireGraphEnumArray_EBRTextFacing.WireGraphEnumArray_EBREasingFunction.WireGraphEnumArray_EBREasingDirection.WireGraphEnumArray_EBRColorSpace.WireGraphEnumArray_EProjectileSpawnLocation.WireGraphEnumArray_EBrickRigidJointInterpMode.WireGraphEnumArray_EBRDisplayTextJustification.WireGraphEnumArray_EBRDisplayTextEasing.WireGraphEnumArray_EBrickMaterial.WireGraphEnumArray_EBrickLightRayTracingVisibility.WireGraphEnumArray_EBrickSeatMode.WireGraphEnumArray_EBrickSeatCameraOrigin.WireGraphEnumArray_EBrickSeatFlightInvertOverride.WireGraphEnumArray_EBrickSeatAirStrafeControl.WireGraphEnumArray_EBrickAerodynamicSurfaceRole.WireGraphEnumArray_EBrickAerodynamicForceApplication.WireGraphEnumArray_EBrickThrusterForceApplication.WireGraphEnumArray_EBrickVehicleFlightHandling.WireGraphEnumArray_EBrickVehicleMassDistribution.WireGraphEnumArray_EBRSweepCollisionChannel".split("."),
			WireGraphEnumMapVariant_FWeakObjectPtr: /* @__PURE__ */ "WireGraphMap_FWeakObjectPtr_EBrickDirection.WireGraphMap_FWeakObjectPtr_EBrickAxis.WireGraphMap_FWeakObjectPtr_EBRPawnCollisionChannel.WireGraphMap_FWeakObjectPtr_EBRTextShading.WireGraphMap_FWeakObjectPtr_EBRTextOutline.WireGraphMap_FWeakObjectPtr_EBRTextMaterial.WireGraphMap_FWeakObjectPtr_EBRTextTypeface.WireGraphMap_FWeakObjectPtr_EBRTextFacing.WireGraphMap_FWeakObjectPtr_EBREasingFunction.WireGraphMap_FWeakObjectPtr_EBREasingDirection.WireGraphMap_FWeakObjectPtr_EBRColorSpace.WireGraphMap_FWeakObjectPtr_EProjectileSpawnLocation.WireGraphMap_FWeakObjectPtr_EBrickRigidJointInterpMode.WireGraphMap_FWeakObjectPtr_EBRDisplayTextJustification.WireGraphMap_FWeakObjectPtr_EBRDisplayTextEasing.WireGraphMap_FWeakObjectPtr_EBrickMaterial.WireGraphMap_FWeakObjectPtr_EBrickLightRayTracingVisibility.WireGraphMap_FWeakObjectPtr_EBrickSeatMode.WireGraphMap_FWeakObjectPtr_EBrickSeatCameraOrigin.WireGraphMap_FWeakObjectPtr_EBrickSeatFlightInvertOverride.WireGraphMap_FWeakObjectPtr_EBrickSeatAirStrafeControl.WireGraphMap_FWeakObjectPtr_EBrickAerodynamicSurfaceRole.WireGraphMap_FWeakObjectPtr_EBrickAerodynamicForceApplication.WireGraphMap_FWeakObjectPtr_EBrickThrusterForceApplication.WireGraphMap_FWeakObjectPtr_EBrickVehicleFlightHandling.WireGraphMap_FWeakObjectPtr_EBrickVehicleMassDistribution.WireGraphMap_FWeakObjectPtr_EBRSweepCollisionChannel".split("."),
			WireGraphEnumMapVariant_FWireGraphString: /* @__PURE__ */ "WireGraphMap_FWireGraphString_EBrickDirection.WireGraphMap_FWireGraphString_EBrickAxis.WireGraphMap_FWireGraphString_EBRPawnCollisionChannel.WireGraphMap_FWireGraphString_EBRTextShading.WireGraphMap_FWireGraphString_EBRTextOutline.WireGraphMap_FWireGraphString_EBRTextMaterial.WireGraphMap_FWireGraphString_EBRTextTypeface.WireGraphMap_FWireGraphString_EBRTextFacing.WireGraphMap_FWireGraphString_EBREasingFunction.WireGraphMap_FWireGraphString_EBREasingDirection.WireGraphMap_FWireGraphString_EBRColorSpace.WireGraphMap_FWireGraphString_EProjectileSpawnLocation.WireGraphMap_FWireGraphString_EBrickRigidJointInterpMode.WireGraphMap_FWireGraphString_EBRDisplayTextJustification.WireGraphMap_FWireGraphString_EBRDisplayTextEasing.WireGraphMap_FWireGraphString_EBrickMaterial.WireGraphMap_FWireGraphString_EBrickLightRayTracingVisibility.WireGraphMap_FWireGraphString_EBrickSeatMode.WireGraphMap_FWireGraphString_EBrickSeatCameraOrigin.WireGraphMap_FWireGraphString_EBrickSeatFlightInvertOverride.WireGraphMap_FWireGraphString_EBrickSeatAirStrafeControl.WireGraphMap_FWireGraphString_EBrickAerodynamicSurfaceRole.WireGraphMap_FWireGraphString_EBrickAerodynamicForceApplication.WireGraphMap_FWireGraphString_EBrickThrusterForceApplication.WireGraphMap_FWireGraphString_EBrickVehicleFlightHandling.WireGraphMap_FWireGraphString_EBrickVehicleMassDistribution.WireGraphMap_FWireGraphString_EBRSweepCollisionChannel".split("."),
			WireGraphEnumMapVariant_int64: /* @__PURE__ */ "WireGraphMap_int64_EBrickDirection.WireGraphMap_int64_EBrickAxis.WireGraphMap_int64_EBRPawnCollisionChannel.WireGraphMap_int64_EBRTextShading.WireGraphMap_int64_EBRTextOutline.WireGraphMap_int64_EBRTextMaterial.WireGraphMap_int64_EBRTextTypeface.WireGraphMap_int64_EBRTextFacing.WireGraphMap_int64_EBREasingFunction.WireGraphMap_int64_EBREasingDirection.WireGraphMap_int64_EBRColorSpace.WireGraphMap_int64_EProjectileSpawnLocation.WireGraphMap_int64_EBrickRigidJointInterpMode.WireGraphMap_int64_EBRDisplayTextJustification.WireGraphMap_int64_EBRDisplayTextEasing.WireGraphMap_int64_EBrickMaterial.WireGraphMap_int64_EBrickLightRayTracingVisibility.WireGraphMap_int64_EBrickSeatMode.WireGraphMap_int64_EBrickSeatCameraOrigin.WireGraphMap_int64_EBrickSeatFlightInvertOverride.WireGraphMap_int64_EBrickSeatAirStrafeControl.WireGraphMap_int64_EBrickAerodynamicSurfaceRole.WireGraphMap_int64_EBrickAerodynamicForceApplication.WireGraphMap_int64_EBrickThrusterForceApplication.WireGraphMap_int64_EBrickVehicleFlightHandling.WireGraphMap_int64_EBrickVehicleMassDistribution.WireGraphMap_int64_EBRSweepCollisionChannel".split("."),
			WireGraphEnumVariant: /* @__PURE__ */ "EBrickDirection.EBrickAxis.EBrickMaterial.EBRPawnCollisionChannel.EBRTextShading.EBRTextOutline.EBRTextMaterial.EBRTextTypeface.EBRTextFacing.EBREasingFunction.EBREasingDirection.EBRColorSpace.EProjectileSpawnLocation.EBrickRigidJointInterpMode.EBRDisplayTextJustification.EBRDisplayTextEasing.EBrickLightRayTracingVisibility.EBrickSeatMode.EBrickSeatCameraOrigin.EBrickSeatFlightInvertOverride.EBrickSeatAirStrafeControl.EBrickAerodynamicSurfaceRole.EBrickAerodynamicForceApplication.EBrickThrusterForceApplication.EBrickVehicleFlightHandling.EBrickVehicleMassDistribution.EBRSweepCollisionChannel".split("."),
			WireGraphMapVariant: [
				"WireGraphMapKeyWrapper_int64",
				"WireGraphMapKeyWrapper_FWireGraphString",
				"WireGraphMapKeyWrapper_FWeakObjectPtr"
			],
			WireGraphMapVariant_FWeakObjectPtr: [
				"WireGraphMap_FWeakObjectPtr_double",
				"WireGraphMap_FWeakObjectPtr_int64",
				"WireGraphMap_FWeakObjectPtr_bool",
				"WireGraphMap_FWeakObjectPtr_FWeakObjectPtr",
				"WireGraphMap_FWeakObjectPtr_FVector",
				"WireGraphMap_FWeakObjectPtr_FRotator",
				"WireGraphMap_FWeakObjectPtr_FQuat",
				"WireGraphMap_FWeakObjectPtr_FWireGraphString",
				"WireGraphMap_FWeakObjectPtr_FLinearColor",
				"WireGraphEnumMapWrapper_FWeakObjectPtr"
			],
			WireGraphMapVariant_FWireGraphString: [
				"WireGraphMap_FWireGraphString_double",
				"WireGraphMap_FWireGraphString_int64",
				"WireGraphMap_FWireGraphString_bool",
				"WireGraphMap_FWireGraphString_FWeakObjectPtr",
				"WireGraphMap_FWireGraphString_FVector",
				"WireGraphMap_FWireGraphString_FRotator",
				"WireGraphMap_FWireGraphString_FQuat",
				"WireGraphMap_FWireGraphString_FWireGraphString",
				"WireGraphMap_FWireGraphString_FLinearColor",
				"WireGraphEnumMapWrapper_FWireGraphString"
			],
			WireGraphMapVariant_int64: [
				"WireGraphMap_int64_double",
				"WireGraphMap_int64_int64",
				"WireGraphMap_int64_bool",
				"WireGraphMap_int64_FWeakObjectPtr",
				"WireGraphMap_int64_FVector",
				"WireGraphMap_int64_FRotator",
				"WireGraphMap_int64_FQuat",
				"WireGraphMap_int64_FWireGraphString",
				"WireGraphMap_int64_FLinearColor",
				"WireGraphEnumMapWrapper_int64"
			],
			WireGraphPrimMathVariant: [
				"f64",
				"i64",
				"Vector",
				"Rotator",
				"Quat",
				"LinearColor"
			],
			WireGraphVariant: [
				"f64",
				"i64",
				"bool",
				"weak_object",
				"WireGraphExec",
				"Vector",
				"Rotator",
				"Quat",
				"str",
				"LinearColor",
				"WireGraphEnumWrapper"
			]
		},
		structs: {
			BrickComponentData_AudioEmitter: {
				bEnabled: "bool",
				AudioDescriptor: "object",
				VolumeMultiplier: "f32",
				PitchMultiplier: "f32",
				InnerRadius: "f32",
				MaxDistance: "f32",
				bSpatialization: "bool",
				FocusAzimuth: "f32",
				NonFocusAzimuth: "f32",
				NonFocusVolumeAttenuation: "f32"
			},
			BrickComponentData_Bearing: {
				bLimitAngle: "bool",
				LimitAngle: "f32",
				CurrentAngle: "f32",
				bAnglesArePercentages: "bool",
				bReversed: "bool",
				Damping: "f32"
			},
			BrickComponentData_Button: {
				PressSound: "object",
				ReleaseSound: "object",
				bAllowNearbyInteraction: "bool",
				bHiddenInteraction: "bool",
				PromptCustomLabel: "str"
			},
			BrickComponentData_CheckPoint: { bRotatePlayerGravityOnSpawn: "bool" },
			BrickComponentData_Clock: {
				bEnabled: "bool",
				bPulseOn: "bool",
				OnTimeSeconds: "f64",
				OffTimeSeconds: "f64",
				IntervalSeconds: "f64"
			},
			BrickComponentData_Damage: {
				Damage: "f32",
				RepeatDelay: "f32",
				Message: "str",
				ConsoleTag: "str"
			},
			BrickComponentData_Interact: {
				InteractSound: "object",
				Message: "str",
				ConsoleTag: "str",
				bAllowNearbyInteraction: "bool",
				bHiddenInteraction: "bool",
				PromptCustomLabel: "str"
			},
			BrickComponentData_Internal_CharacterZoneEvent: {
				TagFilter: "str",
				bCollisionEnabled_Player: "bool",
				bCollisionEnabled_Player1: "bool",
				bCollisionEnabled_Player2: "bool",
				bCollisionEnabled_Player3: "bool"
			},
			BrickComponentData_Internal_EntityZoneEvent: { TagFilter: "str" },
			BrickComponentData_Internal_InputSplitter_V2: {},
			BrickComponentData_Internal_Microchip: {},
			BrickComponentData_Internal_MicrochipInput: { PortLabel: "str" },
			BrickComponentData_Internal_MicrochipOutput: { PortLabel: "str" },
			BrickComponentData_Internal_ProjectileZoneEvent: {},
			BrickComponentData_Internal_ReadBrickGrid: {},
			BrickComponentData_Internal_ZoneEvent: {},
			BrickComponentData_Motor: {
				bEnabled: "bool",
				Speed: "f32",
				Power: "f32",
				bLimitAngle: "bool",
				LimitAngle: "f32",
				CurrentAngle: "f32",
				bAnglesArePercentages: "bool",
				bReversed: "bool",
				Damping: "f32"
			},
			BrickComponentData_MotorSlider: {
				bEnabled: "bool",
				Speed: "f32",
				Power: "f32",
				bPositionsArePercentages: "bool",
				bReversed: "bool",
				Damping: "f32"
			},
			BrickComponentData_OneShotAudioEmitter: {
				AudioDescriptor: "object",
				VolumeMultiplier: "f32",
				PitchMultiplier: "f32",
				InnerRadius: "f32",
				MaxDistance: "f32",
				bSpatialization: "bool",
				bEnableRepeat: "bool",
				RepeatTime: "f32",
				RepeatVariance: "f32",
				RepeatCount: "i32"
			},
			BrickComponentData_ProjectileSpawner: {
				ProjectileClass: "class",
				FireSound: "object",
				Direction: "EBrickDirection",
				SpawnLocation: "EProjectileSpawnLocation",
				SpawnMargin: "f32",
				SpawnOffsetBias: "f32",
				bEnabled: "bool",
				NumberOfShots: "i32",
				SpreadConeAngle: "f32",
				bSpreadBiasedTowardsCenter: "bool",
				FireRate: "f32",
				bEnforceFireRate: "bool",
				DamageMultiplier: "f32",
				SpeedMultiplier: "f32",
				ScaleMultiplier: "f32"
			},
			BrickComponentData_Rerouter: {},
			BrickComponentData_RigidBearing: {
				TargetAngle: "f32",
				bAnglesArePercentages: "bool",
				bReversed: "bool",
				CurrentAngle: "f32",
				InterpMode: "EBrickRigidJointInterpMode",
				SmoothTime: "f32",
				TopSpeed: "f32"
			},
			BrickComponentData_RigidSlider: {
				TargetPosition: "f32",
				bPositionsArePercentages: "bool",
				bReversed: "bool",
				CurrentPosition: "f32",
				InterpMode: "EBrickRigidJointInterpMode",
				SmoothTime: "f32",
				TopSpeed: "f32"
			},
			BrickComponentData_Servo: {
				bEnabled: "bool",
				TargetAngle: "f32",
				Power: "f32",
				ActiveDamping: "f32",
				ForceLimit: "f32",
				bLimitAngle: "bool",
				LimitAngle: "f32",
				CurrentAngle: "f32",
				bAnglesArePercentages: "bool",
				bReversed: "bool",
				Damping: "f32"
			},
			BrickComponentData_ServoSlider: {
				bEnabled: "bool",
				TargetPosition: "f32",
				Power: "f32",
				TopSpeed: "f32",
				Exponent: "f32",
				bPositionsArePercentages: "bool",
				bReversed: "bool",
				Damping: "f32"
			},
			BrickComponentData_Slider: {
				bPositionsArePercentages: "bool",
				bReversed: "bool",
				Damping: "f32"
			},
			BrickComponentData_SpawnPoint: {
				bRotatePlayerGravityOnSpawn: "bool",
				bEnable: "bool"
			},
			BrickComponentData_Switch: {
				bEnabled: "bool",
				InteractSound: "object",
				bAllowNearbyInteraction: "bool",
				bHiddenInteraction: "bool",
				PromptCustomLabel: "str"
			},
			BrickComponentData_Target: { OnTime: "f32" },
			BrickComponentData_TeleportDestination: {},
			BrickComponentData_Touch: {
				BeginTouchSound: "object",
				EndTouchSound: "object",
				bCollisionEnabled_Player: "bool",
				bCollisionEnabled_Player1: "bool",
				bCollisionEnabled_Player2: "bool",
				bCollisionEnabled_Player3: "bool"
			},
			BrickComponentData_WireGraph_AudioReference: { Asset: "object" },
			BrickComponentData_WireGraph_BrickAssetReference: { Asset: "object" },
			BrickComponentData_WireGraph_DeltaTime: {},
			BrickComponentData_WireGraph_EntityTypeReference: { Asset: "class" },
			BrickComponentData_WireGraph_Exec_ArrayVar_Average: {
				Value: "WireGraphVariant",
				bIsEmpty: "bool"
			},
			BrickComponentData_WireGraph_Exec_ArrayVar_Base: {},
			BrickComponentData_WireGraph_Exec_ArrayVar_DualRef: {},
			BrickComponentData_WireGraph_Exec_ArrayVar_ElementOp: {
				Index: "i64",
				Value: "WireGraphVariant"
			},
			BrickComponentData_WireGraph_Exec_ArrayVar_Find: {
				Index: "i64",
				bFound: "bool",
				Value: "WireGraphVariant"
			},
			BrickComponentData_WireGraph_Exec_ArrayVar_Get: {
				bOutOfBounds: "bool",
				Index: "i64",
				Value: "WireGraphVariant"
			},
			BrickComponentData_WireGraph_Exec_ArrayVar_GetLength: { Length: "i64" },
			BrickComponentData_WireGraph_Exec_ArrayVar_Insert: {
				bOutOfBounds: "bool",
				Index: "i64",
				Value: "WireGraphVariant"
			},
			BrickComponentData_WireGraph_Exec_ArrayVar_MinMax: {
				Value: "WireGraphVariant",
				bIsEmpty: "bool"
			},
			BrickComponentData_WireGraph_Exec_ArrayVar_Pop: {
				bIsEmpty: "bool",
				Value: "WireGraphVariant"
			},
			BrickComponentData_WireGraph_Exec_ArrayVar_Push: { Value: "WireGraphVariant" },
			BrickComponentData_WireGraph_Exec_ArrayVar_RemoveAtIndex: {
				Index: "i64",
				bOutOfBounds: "bool"
			},
			BrickComponentData_WireGraph_Exec_ArrayVar_Resize: {
				Size: "i64",
				Value: "WireGraphVariant"
			},
			BrickComponentData_WireGraph_Exec_ArrayVar_Slice: {
				Start: "i64",
				Count: "i64",
				bOutOfBounds: "bool"
			},
			BrickComponentData_WireGraph_Exec_ArrayVar_Sort: { bDescending: "bool" },
			BrickComponentData_WireGraph_Exec_ArrayVar_SortMultiple: {
				bDescending: "bool",
				bSuccess: "bool"
			},
			BrickComponentData_WireGraph_Exec_ArrayVar_Sum: { Value: "WireGraphVariant" },
			BrickComponentData_WireGraph_Exec_ArrayVar_Swap: {
				IndexA: "i64",
				IndexB: "i64",
				bOutOfBounds: "bool"
			},
			BrickComponentData_WireGraph_Exec_Character_AddInventoryEntity: { EntityType: "class" },
			BrickComponentData_WireGraph_Exec_Character_AddInventoryItem: { Item: "class" },
			BrickComponentData_WireGraph_Exec_Character_GetAim: { bLocalAim: "bool" },
			BrickComponentData_WireGraph_Exec_Character_GetAmmo: { Resource: "object" },
			BrickComponentData_WireGraph_Exec_Character_GetCurrentInventorySlot: {},
			BrickComponentData_WireGraph_Exec_Character_GetDamage: {},
			BrickComponentData_WireGraph_Exec_Character_GetFromController: {},
			BrickComponentData_WireGraph_Exec_Character_GetInventoryEntry: { Slot: "i64" },
			BrickComponentData_WireGraph_Exec_Character_GetWeaponChamberAmmo: {
				Slot: "i64",
				Resource: "object"
			},
			BrickComponentData_WireGraph_Exec_Character_GrantAmmo: {
				Resource: "object",
				Amount: "i64"
			},
			BrickComponentData_WireGraph_Exec_Character_IncDamage: { Amount: "f64" },
			BrickComponentData_WireGraph_Exec_Character_IncWeaponChamberAmmo: {
				Slot: "i64",
				Resource: "object",
				Amount: "i64"
			},
			BrickComponentData_WireGraph_Exec_Character_SetAmmo: {
				Resource: "object",
				Amount: "i64"
			},
			BrickComponentData_WireGraph_Exec_Character_SetDamage: { Damage: "f64" },
			BrickComponentData_WireGraph_Exec_Character_SetInventoryEntity: {
				Slot: "i64",
				EntityType: "class"
			},
			BrickComponentData_WireGraph_Exec_Character_SetInventoryItem: {
				Slot: "i64",
				Item: "class"
			},
			BrickComponentData_WireGraph_Exec_Character_SetTempPermission: {
				PermissionTagStr: "str",
				bPermissionEnable: "bool"
			},
			BrickComponentData_WireGraph_Exec_Character_SetWeaponChamberAmmo: {
				Slot: "i64",
				Resource: "object",
				Amount: "i64"
			},
			BrickComponentData_WireGraph_Exec_Character_ShowHint: {
				HintTitle: "str",
				HintText: "str"
			},
			BrickComponentData_WireGraph_Exec_ChatCommand: {
				CommandName: "str",
				HelpText: "str"
			},
			BrickComponentData_WireGraph_Exec_Cycle: {
				Count: "i64",
				Value: "i64"
			},
			BrickComponentData_WireGraph_Exec_Entity_DestroySpawned: {},
			BrickComponentData_WireGraph_Exec_Entity_DestroySpawnedPrefab: {},
			BrickComponentData_WireGraph_Exec_Entity_GetSpeed: {},
			BrickComponentData_WireGraph_Exec_Entity_GetTag: { Tag: "str" },
			BrickComponentData_WireGraph_Exec_Entity_GetTeam: {},
			BrickComponentData_WireGraph_Exec_Entity_IsFrozen: {},
			BrickComponentData_WireGraph_Exec_Entity_PlayAudioAt: {
				AudioDescriptor: "object",
				VolumeMultiplier: "f64",
				PitchMultiplier: "f64",
				InnerRadius: "f64",
				MaxDistance: "f64",
				bSpatialization: "bool"
			},
			BrickComponentData_WireGraph_Exec_Entity_SetFrozen: { bFrozen: "bool" },
			BrickComponentData_WireGraph_Exec_Entity_SetTag: { Tag: "str" },
			BrickComponentData_WireGraph_Exec_Entity_SetTeam: {},
			BrickComponentData_WireGraph_Exec_Gamemode_BroadcastChatMessage: { Message: "str" },
			BrickComponentData_WireGraph_Exec_Gamemode_BroadcastStatusMessage: {
				Message: "str",
				bFlashIfUnchanged: "bool"
			},
			BrickComponentData_WireGraph_Exec_Gamemode_FillArrayFromPlayers: { bIncludeBuilderMode: "bool" },
			BrickComponentData_WireGraph_Exec_Gamemode_FillArrayFromTeamMembers: {},
			BrickComponentData_WireGraph_Exec_Gamemode_GetCurrentRound: {},
			BrickComponentData_WireGraph_Exec_Gamemode_GetLeaderboardValue: { Key: "str" },
			BrickComponentData_WireGraph_Exec_Gamemode_GetTeam: {},
			BrickComponentData_WireGraph_Exec_Gamemode_GetTeamByName: { TeamName: "str" },
			BrickComponentData_WireGraph_Exec_Gamemode_GetTeamLeaderboardValue: { Key: "str" },
			BrickComponentData_WireGraph_Exec_Gamemode_GetTeamName: {},
			BrickComponentData_WireGraph_Exec_Gamemode_LeaderboardValue: {
				Key: "str",
				Value: "i64"
			},
			BrickComponentData_WireGraph_Exec_Gamemode_PlayerWins: { bTeamWinsInstead: "bool" },
			BrickComponentData_WireGraph_Exec_Gamemode_SetTeam: { bPinPlayerToTeam: "bool" },
			BrickComponentData_WireGraph_Exec_Gamemode_SetTeamPinned: { bPinned: "bool" },
			BrickComponentData_WireGraph_Exec_Gamemode_TeamLeaderboardValue: {
				Key: "str",
				Value: "i64"
			},
			BrickComponentData_WireGraph_Exec_Gamemode_TeamWins: {},
			BrickComponentData_WireGraph_Exec_GetInputs: {},
			BrickComponentData_WireGraph_Exec_GetOwnTransform: {},
			BrickComponentData_WireGraph_Exec_MapVar_ArrayDest: {},
			BrickComponentData_WireGraph_Exec_MapVar_Base: {},
			BrickComponentData_WireGraph_Exec_MapVar_CopyFrom: {},
			BrickComponentData_WireGraph_Exec_MapVar_Get: {
				bFound: "bool",
				Key: "WireGraphVariant",
				Value: "WireGraphVariant"
			},
			BrickComponentData_WireGraph_Exec_MapVar_GetLength: { Length: "i64" },
			BrickComponentData_WireGraph_Exec_MapVar_KeyOp: {
				Key: "WireGraphVariant",
				bFound: "bool"
			},
			BrickComponentData_WireGraph_Exec_MapVar_Set: {
				Key: "WireGraphVariant",
				Value: "WireGraphVariant"
			},
			BrickComponentData_WireGraph_Exec_PlayClientAudio: {
				AudioDescriptor: "object",
				VolumeMultiplier: "f64",
				PitchMultiplier: "f64"
			},
			BrickComponentData_WireGraph_Exec_PlayerState_ForceRespawn: {},
			BrickComponentData_WireGraph_Exec_PlayerState_GetDisplayName: {},
			BrickComponentData_WireGraph_Exec_PlayerState_GetFromEntity: {},
			BrickComponentData_WireGraph_Exec_PlayerState_GetUserId: {},
			BrickComponentData_WireGraph_Exec_PlayerState_GetUserName: {},
			BrickComponentData_WireGraph_Exec_PlayerState_HasPermission: { PermissionName: "str" },
			BrickComponentData_WireGraph_Exec_PlayerState_HasRole: { RoleName: "str" },
			BrickComponentData_WireGraph_Exec_PlayerState_IsTrustedByBrickOwner: {},
			BrickComponentData_WireGraph_Exec_PlayerState_SetCanRespawn: { bCanRespawn: "bool" },
			BrickComponentData_WireGraph_Exec_PlayerState_ShowChatMessage: { Message: "str" },
			BrickComponentData_WireGraph_Exec_PlayerState_ShowMessageBox: {
				Title: "str",
				Message: "str"
			},
			BrickComponentData_WireGraph_Exec_PlayerState_ShowStatusMessage: { Message: "str" },
			BrickComponentData_WireGraph_Exec_PlayGlobalAudio: {
				AudioDescriptor: "object",
				VolumeMultiplier: "f64",
				PitchMultiplier: "f64"
			},
			BrickComponentData_WireGraph_Exec_PrintToConsole: { Text: "str" },
			BrickComponentData_WireGraph_Exec_Random: {
				Min: "WireGraphPrimMathVariant",
				Max: "WireGraphPrimMathVariant"
			},
			BrickComponentData_WireGraph_Exec_Toggle: { Value: "bool" },
			BrickComponentData_WireGraph_Exec_Var_EditOrGet: { Value: "WireGraphVariant" },
			BrickComponentData_WireGraph_Exec_Var_Get: { Value: "WireGraphVariant" },
			BrickComponentData_WireGraph_Exec_WholeGridInteracted: {
				bAllowNearbyInteraction: "bool",
				bHiddenInteraction: "bool",
				PromptCustomLabel: "str"
			},
			BrickComponentData_WireGraph_Exec_WholeGridTargeted: {},
			BrickComponentData_WireGraph_Exec_Zone_GetEntities: { TagFilter: "str" },
			BrickComponentData_WireGraph_Exec_Zone_GetPlayers: { TagFilter: "str" },
			BrickComponentData_WireGraph_ExecBranch: { bCond: "bool" },
			BrickComponentData_WireGraph_ExecUnion: {},
			BrickComponentData_WireGraph_Expr_Bool_Bool: { bInput: "bool" },
			BrickComponentData_WireGraph_Expr_BoolBool_Bool: {
				bInputA: "bool",
				bInputB: "bool"
			},
			BrickComponentData_WireGraph_Expr_ChangeDetector: {
				Input: "WireGraphVariant",
				bPulseOnChange: "bool"
			},
			BrickComponentData_WireGraph_Expr_ChangeDetectorExec: { Input: "WireGraphVariant" },
			BrickComponentData_WireGraph_Expr_Compare: {
				InputA: "WireGraphVariant",
				InputB: "WireGraphVariant"
			},
			BrickComponentData_WireGraph_Expr_Convert: {
				Input: "WireGraphVariant",
				Output: "WireGraphVariant",
				TargetType: "WireGraphVariant"
			},
			BrickComponentData_WireGraph_Expr_EdgeDetector: {
				Input: "f64",
				bPulseOnRisingEdge: "bool",
				bPulseOnFallingEdge: "bool"
			},
			BrickComponentData_WireGraph_Expr_EdgeDetectorExec: { Input: "f64" },
			BrickComponentData_WireGraph_Expr_EnumToInteger: {
				Input: "WireGraphVariant",
				Output: "WireGraphVariant"
			},
			BrickComponentData_WireGraph_Expr_Float_Float: { Input: "f64" },
			BrickComponentData_WireGraph_Expr_Gamemode_TeamPredicate: {},
			BrickComponentData_WireGraph_Expr_Int_Int: { Input: "i64" },
			BrickComponentData_WireGraph_Expr_IntegerToEnum: {
				Input: "i64",
				bWrap: "bool",
				TargetType: "WireGraphEnumVariant",
				Output: "WireGraphVariant"
			},
			BrickComponentData_WireGraph_Expr_IntInt_Int: {
				InputA: "i64",
				InputB: "i64"
			},
			BrickComponentData_WireGraph_Expr_ItemToPickup: {},
			BrickComponentData_WireGraph_Expr_MakeColor: {
				R: "f64",
				G: "f64",
				B: "f64",
				A: "f64"
			},
			BrickComponentData_WireGraph_Expr_MakeColorHex: { Hex: "str" },
			BrickComponentData_WireGraph_Expr_MakeColorSRGB: {
				R: "i64",
				G: "i64",
				B: "i64",
				A: "i64"
			},
			BrickComponentData_WireGraph_Expr_MakeQuaternion: {
				X: "f64",
				Y: "f64",
				Z: "f64",
				W: "f64"
			},
			BrickComponentData_WireGraph_Expr_MakeRotation: {
				Pitch: "f64",
				Yaw: "f64",
				Roll: "f64"
			},
			BrickComponentData_WireGraph_Expr_MakeVector: {
				X: "f64",
				Y: "f64",
				Z: "f64"
			},
			BrickComponentData_WireGraph_Expr_MathAtan2: {
				Y: "f64",
				X: "f64"
			},
			BrickComponentData_WireGraph_Expr_MathBlend: {
				Blend: "f64",
				bClampAlpha: "bool",
				InputA: "WireGraphPrimMathVariant",
				InputB: "WireGraphPrimMathVariant"
			},
			BrickComponentData_WireGraph_Expr_MathClamp: {
				Min: "WireGraphPrimMathVariant",
				Max: "WireGraphPrimMathVariant",
				Input: "WireGraphPrimMathVariant"
			},
			BrickComponentData_WireGraph_Expr_MathCompare: {
				InputA: "WireGraphPrimMathVariant",
				InputB: "WireGraphPrimMathVariant"
			},
			BrickComponentData_WireGraph_Expr_MathEasing: {
				Blend: "f64",
				Function: "EBREasingFunction",
				Direction: "EBREasingDirection",
				InputA: "WireGraphPrimMathVariant",
				InputB: "WireGraphPrimMathVariant"
			},
			BrickComponentData_WireGraph_Expr_MathLogBase: {
				Input: "f64",
				Base: "f64"
			},
			BrickComponentData_WireGraph_Expr_MathPow: {
				Input: "f64",
				Exponent: "f64"
			},
			BrickComponentData_WireGraph_Expr_NearlyEqual: {
				InputA: "WireGraphPrimMathVariant",
				InputB: "WireGraphPrimMathVariant",
				Tolerance: "f64"
			},
			BrickComponentData_WireGraph_Expr_PrimMathVariant_PrimMathVariant: { Input: "WireGraphPrimMathVariant" },
			BrickComponentData_WireGraph_Expr_PrimMathVariantPrimMathVariant_PrimMathVariant: {
				InputA: "WireGraphPrimMathVariant",
				InputB: "WireGraphPrimMathVariant"
			},
			BrickComponentData_WireGraph_Expr_Remap: {
				Value: "f64",
				InputMin: "f64",
				InputMax: "f64",
				OutputMin: "f64",
				OutputMax: "f64",
				Function: "EBREasingFunction",
				Direction: "EBREasingDirection"
			},
			BrickComponentData_WireGraph_Expr_Select: {
				bSelectB: "bool",
				InputA: "WireGraphVariant",
				InputB: "WireGraphVariant"
			},
			BrickComponentData_WireGraph_Expr_String_CharacterToCodepoint: { Character: "str" },
			BrickComponentData_WireGraph_Expr_String_CodepointToCharacter: { Codepoint: "i64" },
			BrickComponentData_WireGraph_Expr_String_Concatenate: {
				InputA: "str",
				InputB: "str",
				Separator: "str"
			},
			BrickComponentData_WireGraph_Expr_String_Contains: {
				Input: "str",
				Search: "str",
				bCaseSensitive: "bool"
			},
			BrickComponentData_WireGraph_Expr_String_EndsWith: {
				Input: "str",
				Suffix: "str",
				bCaseSensitive: "bool"
			},
			BrickComponentData_WireGraph_Expr_String_Find: {
				Input: "str",
				Search: "str",
				bCaseSensitive: "bool",
				Start: "i64"
			},
			BrickComponentData_WireGraph_Expr_String_FormatText: {
				FormatString: "str",
				InputA: "WireGraphVariant",
				InputB: "WireGraphVariant",
				InputC: "WireGraphVariant",
				InputD: "WireGraphVariant",
				InputE: "WireGraphVariant",
				InputF: "WireGraphVariant",
				InputG: "WireGraphVariant"
			},
			BrickComponentData_WireGraph_Expr_String_Length: { Input: "str" },
			BrickComponentData_WireGraph_Expr_String_ParseInt: { Input: "str" },
			BrickComponentData_WireGraph_Expr_String_ParseNumber: { Input: "str" },
			BrickComponentData_WireGraph_Expr_String_Replace: {
				Input: "str",
				Search: "str",
				Replacement: "str",
				bCaseSensitive: "bool",
				Start: "i64",
				MaxReplacements: "i64"
			},
			BrickComponentData_WireGraph_Expr_String_Split: {
				Input: "str",
				Delimiter: "str",
				bCaseSensitive: "bool",
				Occurrence: "i64"
			},
			BrickComponentData_WireGraph_Expr_String_StartsWith: {
				Input: "str",
				Prefix: "str",
				bCaseSensitive: "bool"
			},
			BrickComponentData_WireGraph_Expr_String_Substring: {
				Input: "str",
				Start: "i64",
				Length: "i64"
			},
			BrickComponentData_WireGraph_Expr_String_ToLower: { Input: "str" },
			BrickComponentData_WireGraph_Expr_String_ToUpper: { Input: "str" },
			BrickComponentData_WireGraph_Expr_String_Trim: { Input: "str" },
			BrickComponentData_WireGraph_Expr_Swap: {
				bSwap: "bool",
				InputA: "WireGraphVariant",
				InputB: "WireGraphVariant"
			},
			BrickComponentData_WireGraph_Expr_Variant_Variant: { Input: "WireGraphVariant" },
			BrickComponentData_WireGraph_Fake_CharacterDamageEvent: {},
			BrickComponentData_WireGraph_Fake_CharacterDeathEvent: {},
			BrickComponentData_WireGraph_Fake_CharacterEvent: {},
			BrickComponentData_WireGraph_Fake_CharacterFiredWeaponEvent: {},
			BrickComponentData_WireGraph_Fake_ControllerEvent: {},
			BrickComponentData_WireGraph_Fake_ControllerTeamEvent: {},
			BrickComponentData_WireGraph_Fake_RoundEvent: { RoundNumber: "i32" },
			BrickComponentData_WireGraph_FindPlayer: { Query: "str" },
			BrickComponentData_WireGraph_FontReference: { Asset: "object" },
			BrickComponentData_WireGraph_FormatDate: {
				UnixEpoch: "i64",
				Format: "str",
				bUseUTC: "bool"
			},
			BrickComponentData_WireGraph_GetUnixEpoch: {},
			BrickComponentData_WireGraph_ItemReference: { Asset: "class" },
			BrickComponentData_WireGraph_OneShotAudioReference: { Asset: "object" },
			BrickComponentData_WireGraph_ParticleReference: { Asset: "object" },
			BrickComponentData_WireGraph_PickupReference: { Asset: "class" },
			BrickComponentData_WireGraph_ProjectileReference: { Asset: "class" },
			BrickComponentData_WireGraph_ServerUptime: {},
			BrickComponentData_WireGraph_WeaponResourceReference: { Asset: "object" },
			BrickComponentData_WireGraph_WheelEngineAudioReference: { Asset: "object" },
			BrickComponentData_WireGraphPseudo_ArrayVar: { Value: "WireGraphArrayVariant" },
			BrickComponentData_WireGraphPseudo_BufferSeconds: {
				SecondsToWait: "f32",
				ZeroSecondsToWait: "f32",
				CurrentTime: "f32",
				Input: "WireGraphVariant",
				Output: "WireGraphVariant",
				Buffered: "WireGraphVariant",
				bHasQueued: "bool",
				bIsOffTimer: "bool"
			},
			BrickComponentData_WireGraphPseudo_BufferTicks: {
				TicksToWait: "i32",
				ZeroTicksToWait: "i32",
				CurrentTicks: "i32",
				Input: "WireGraphVariant",
				Output: "WireGraphVariant",
				Buffered: "WireGraphVariant",
				bHasQueued: "bool",
				bIsOffTimer: "bool"
			},
			BrickComponentData_WireGraphPseudo_CustomEvent: {
				EventName: "str",
				bIsObjectEvent: "bool",
				DataOut1: "WireGraphVariant",
				DataOut2: "WireGraphVariant",
				DataOut3: "WireGraphVariant",
				DataOut4: "WireGraphVariant",
				DataOut5: "WireGraphVariant",
				DataOut6: "WireGraphVariant",
				DataOut7: "WireGraphVariant",
				DataOut8: "WireGraphVariant"
			},
			BrickComponentData_WireGraphPseudo_MapVar: { Value: "WireGraphMapVariant" },
			BrickComponentData_WireGraphPseudo_SendCustomEvent: {
				EventName: "str",
				DataIn1: "WireGraphVariant",
				DataIn2: "WireGraphVariant",
				DataIn3: "WireGraphVariant",
				DataIn4: "WireGraphVariant",
				DataIn5: "WireGraphVariant",
				DataIn6: "WireGraphVariant",
				DataIn7: "WireGraphVariant",
				DataIn8: "WireGraphVariant"
			},
			BrickComponentData_WireGraphPseudo_Timer: {
				Limit: "f64",
				Time: "f64",
				bRunning: "bool"
			},
			BrickComponentData_WireGraphPseudo_Tween: {
				Target: "WireGraphVariant",
				Value: "WireGraphVariant",
				StartValue: "WireGraphVariant",
				Duration: "f64",
				Elapsed: "f64",
				bRunning: "bool",
				Function: "EBREasingFunction",
				Direction: "EBREasingDirection"
			},
			BrickComponentData_WireGraphPseudo_Var: { Value: "WireGraphVariant" },
			BrickComponentWireControl_DriveAndSteer: {},
			BrickComponentWirePortControl_TeleportDestination: {},
			BRInventoryEntryConfig: { Item: "BRInventoryEntryVariant" },
			BRInventoryEntryEntity: { EntityType: "class" },
			BRInventoryEntryNothing: {},
			BRInventoryEntryWeaponResourceAmounts: {
				Loaded: "i32",
				Reserve: "i32"
			},
			BRQueueSecondsEntry: {
				Data: ["WireGraphVariant"],
				RemainingTime: "f32"
			},
			BRQueueTicksEntry: {
				Data: ["WireGraphVariant"],
				RemainingTicks: "i32"
			},
			BRSavedBrickComponentTypeCounter: {
				TypeIndex: "u32",
				NumInstances: "u32"
			},
			Color: {
				B: "u8",
				G: "u8",
				R: "u8",
				A: "u8"
			},
			IntVector: {
				X: "i32",
				Y: "i32",
				Z: "i32"
			},
			LinearColor: {
				R: "f32",
				G: "f32",
				B: "f32",
				A: "f32"
			},
			Quat: {
				X: "f64",
				Y: "f64",
				Z: "f64",
				W: "f64"
			},
			Quat4f: {
				X: "f32",
				Y: "f32",
				Z: "f32",
				W: "f32"
			},
			Rotator: {
				Pitch: "f64",
				Yaw: "f64",
				Roll: "f64"
			},
			Rotator3f: {
				Pitch: "f32",
				Yaw: "f32",
				Roll: "f32"
			},
			Vector: {
				X: "f64",
				Y: "f64",
				Z: "f64"
			},
			Vector2D: {
				X: "f64",
				Y: "f64"
			},
			Vector2f: {
				X: "f32",
				Y: "f32"
			},
			Vector3f: {
				X: "f32",
				Y: "f32",
				Z: "f32"
			},
			Vector4: {
				X: "f64",
				Y: "f64",
				Z: "f64",
				W: "f64"
			},
			WireGraphBoolArray: { Values: ["bool"] },
			WireGraphDoubleArray: { Values: ["f64"] },
			WireGraphEnumArray_EBRColorSpace: { Values: ["EBRColorSpace"] },
			WireGraphEnumArray_EBRDisplayTextEasing: { Values: ["EBRDisplayTextEasing"] },
			WireGraphEnumArray_EBRDisplayTextJustification: { Values: ["EBRDisplayTextJustification"] },
			WireGraphEnumArray_EBREasingDirection: { Values: ["EBREasingDirection"] },
			WireGraphEnumArray_EBREasingFunction: { Values: ["EBREasingFunction"] },
			WireGraphEnumArray_EBrickAerodynamicForceApplication: { Values: ["EBrickAerodynamicForceApplication"] },
			WireGraphEnumArray_EBrickAerodynamicSurfaceRole: { Values: ["EBrickAerodynamicSurfaceRole"] },
			WireGraphEnumArray_EBrickAxis: { Values: ["EBrickAxis"] },
			WireGraphEnumArray_EBrickDirection: { Values: ["EBrickDirection"] },
			WireGraphEnumArray_EBrickLightRayTracingVisibility: { Values: ["EBrickLightRayTracingVisibility"] },
			WireGraphEnumArray_EBrickMaterial: { Values: ["EBrickMaterial"] },
			WireGraphEnumArray_EBrickRigidJointInterpMode: { Values: ["EBrickRigidJointInterpMode"] },
			WireGraphEnumArray_EBrickSeatAirStrafeControl: { Values: ["EBrickSeatAirStrafeControl"] },
			WireGraphEnumArray_EBrickSeatCameraOrigin: { Values: ["EBrickSeatCameraOrigin"] },
			WireGraphEnumArray_EBrickSeatFlightInvertOverride: { Values: ["EBrickSeatFlightInvertOverride"] },
			WireGraphEnumArray_EBrickSeatMode: { Values: ["EBrickSeatMode"] },
			WireGraphEnumArray_EBrickThrusterForceApplication: { Values: ["EBrickThrusterForceApplication"] },
			WireGraphEnumArray_EBrickVehicleFlightHandling: { Values: ["EBrickVehicleFlightHandling"] },
			WireGraphEnumArray_EBrickVehicleMassDistribution: { Values: ["EBrickVehicleMassDistribution"] },
			WireGraphEnumArray_EBRPawnCollisionChannel: { Values: ["EBRPawnCollisionChannel"] },
			WireGraphEnumArray_EBRSweepCollisionChannel: { Values: ["EBRSweepCollisionChannel"] },
			WireGraphEnumArray_EBRTextFacing: { Values: ["EBRTextFacing"] },
			WireGraphEnumArray_EBRTextMaterial: { Values: ["EBRTextMaterial"] },
			WireGraphEnumArray_EBRTextOutline: { Values: ["EBRTextOutline"] },
			WireGraphEnumArray_EBRTextShading: { Values: ["EBRTextShading"] },
			WireGraphEnumArray_EBRTextTypeface: { Values: ["EBRTextTypeface"] },
			WireGraphEnumArray_EProjectileSpawnLocation: { Values: ["EProjectileSpawnLocation"] },
			WireGraphEnumArrayWrapper: { Enum: "WireGraphEnumArrayVariant" },
			WireGraphEnumMapWrapper_FWeakObjectPtr: { Enum: "WireGraphEnumMapVariant_FWeakObjectPtr" },
			WireGraphEnumMapWrapper_FWireGraphString: { Enum: "WireGraphEnumMapVariant_FWireGraphString" },
			WireGraphEnumMapWrapper_int64: { Enum: "WireGraphEnumMapVariant_int64" },
			WireGraphEnumWrapper: { Enum: "WireGraphEnumVariant" },
			WireGraphExec: {},
			WireGraphInt64Array: { Values: ["i64"] },
			WireGraphMap_FWeakObjectPtr_bool: {},
			WireGraphMap_FWeakObjectPtr_double: {},
			WireGraphMap_FWeakObjectPtr_EBRColorSpace: {},
			WireGraphMap_FWeakObjectPtr_EBRDisplayTextEasing: {},
			WireGraphMap_FWeakObjectPtr_EBRDisplayTextJustification: {},
			WireGraphMap_FWeakObjectPtr_EBREasingDirection: {},
			WireGraphMap_FWeakObjectPtr_EBREasingFunction: {},
			WireGraphMap_FWeakObjectPtr_EBrickAerodynamicForceApplication: {},
			WireGraphMap_FWeakObjectPtr_EBrickAerodynamicSurfaceRole: {},
			WireGraphMap_FWeakObjectPtr_EBrickAxis: {},
			WireGraphMap_FWeakObjectPtr_EBrickDirection: {},
			WireGraphMap_FWeakObjectPtr_EBrickLightRayTracingVisibility: {},
			WireGraphMap_FWeakObjectPtr_EBrickMaterial: {},
			WireGraphMap_FWeakObjectPtr_EBrickRigidJointInterpMode: {},
			WireGraphMap_FWeakObjectPtr_EBrickSeatAirStrafeControl: {},
			WireGraphMap_FWeakObjectPtr_EBrickSeatCameraOrigin: {},
			WireGraphMap_FWeakObjectPtr_EBrickSeatFlightInvertOverride: {},
			WireGraphMap_FWeakObjectPtr_EBrickSeatMode: {},
			WireGraphMap_FWeakObjectPtr_EBrickThrusterForceApplication: {},
			WireGraphMap_FWeakObjectPtr_EBrickVehicleFlightHandling: {},
			WireGraphMap_FWeakObjectPtr_EBrickVehicleMassDistribution: {},
			WireGraphMap_FWeakObjectPtr_EBRPawnCollisionChannel: {},
			WireGraphMap_FWeakObjectPtr_EBRSweepCollisionChannel: {},
			WireGraphMap_FWeakObjectPtr_EBRTextFacing: {},
			WireGraphMap_FWeakObjectPtr_EBRTextMaterial: {},
			WireGraphMap_FWeakObjectPtr_EBRTextOutline: {},
			WireGraphMap_FWeakObjectPtr_EBRTextShading: {},
			WireGraphMap_FWeakObjectPtr_EBRTextTypeface: {},
			WireGraphMap_FWeakObjectPtr_EProjectileSpawnLocation: {},
			WireGraphMap_FWeakObjectPtr_FWeakObjectPtr: {},
			WireGraphMap_FWeakObjectPtr_FWireGraphString: {},
			WireGraphMap_FWeakObjectPtr_int64: {},
			WireGraphMap_FWireGraphString_bool: { Values: { str: "bool" } },
			WireGraphMap_FWireGraphString_double: { Values: { str: "f64" } },
			WireGraphMap_FWireGraphString_EBRColorSpace: { Values: { str: "EBRColorSpace" } },
			WireGraphMap_FWireGraphString_EBRDisplayTextEasing: { Values: { str: "EBRDisplayTextEasing" } },
			WireGraphMap_FWireGraphString_EBRDisplayTextJustification: { Values: { str: "EBRDisplayTextJustification" } },
			WireGraphMap_FWireGraphString_EBREasingDirection: { Values: { str: "EBREasingDirection" } },
			WireGraphMap_FWireGraphString_EBREasingFunction: { Values: { str: "EBREasingFunction" } },
			WireGraphMap_FWireGraphString_EBrickAerodynamicForceApplication: { Values: { str: "EBrickAerodynamicForceApplication" } },
			WireGraphMap_FWireGraphString_EBrickAerodynamicSurfaceRole: { Values: { str: "EBrickAerodynamicSurfaceRole" } },
			WireGraphMap_FWireGraphString_EBrickAxis: { Values: { str: "EBrickAxis" } },
			WireGraphMap_FWireGraphString_EBrickDirection: { Values: { str: "EBrickDirection" } },
			WireGraphMap_FWireGraphString_EBrickLightRayTracingVisibility: { Values: { str: "EBrickLightRayTracingVisibility" } },
			WireGraphMap_FWireGraphString_EBrickMaterial: { Values: { str: "EBrickMaterial" } },
			WireGraphMap_FWireGraphString_EBrickRigidJointInterpMode: { Values: { str: "EBrickRigidJointInterpMode" } },
			WireGraphMap_FWireGraphString_EBrickSeatAirStrafeControl: { Values: { str: "EBrickSeatAirStrafeControl" } },
			WireGraphMap_FWireGraphString_EBrickSeatCameraOrigin: { Values: { str: "EBrickSeatCameraOrigin" } },
			WireGraphMap_FWireGraphString_EBrickSeatFlightInvertOverride: { Values: { str: "EBrickSeatFlightInvertOverride" } },
			WireGraphMap_FWireGraphString_EBrickSeatMode: { Values: { str: "EBrickSeatMode" } },
			WireGraphMap_FWireGraphString_EBrickThrusterForceApplication: { Values: { str: "EBrickThrusterForceApplication" } },
			WireGraphMap_FWireGraphString_EBrickVehicleFlightHandling: { Values: { str: "EBrickVehicleFlightHandling" } },
			WireGraphMap_FWireGraphString_EBrickVehicleMassDistribution: { Values: { str: "EBrickVehicleMassDistribution" } },
			WireGraphMap_FWireGraphString_EBRPawnCollisionChannel: { Values: { str: "EBRPawnCollisionChannel" } },
			WireGraphMap_FWireGraphString_EBRSweepCollisionChannel: { Values: { str: "EBRSweepCollisionChannel" } },
			WireGraphMap_FWireGraphString_EBRTextFacing: { Values: { str: "EBRTextFacing" } },
			WireGraphMap_FWireGraphString_EBRTextMaterial: { Values: { str: "EBRTextMaterial" } },
			WireGraphMap_FWireGraphString_EBRTextOutline: { Values: { str: "EBRTextOutline" } },
			WireGraphMap_FWireGraphString_EBRTextShading: { Values: { str: "EBRTextShading" } },
			WireGraphMap_FWireGraphString_EBRTextTypeface: { Values: { str: "EBRTextTypeface" } },
			WireGraphMap_FWireGraphString_EProjectileSpawnLocation: { Values: { str: "EProjectileSpawnLocation" } },
			WireGraphMap_FWireGraphString_FWeakObjectPtr: { Values: { str: "weak_object" } },
			WireGraphMap_FWireGraphString_FWireGraphString: { Values: { str: "str" } },
			WireGraphMap_FWireGraphString_int64: { Values: { str: "i64" } },
			WireGraphMap_int64_bool: { Values: { i64: "bool" } },
			WireGraphMap_int64_double: { Values: { i64: "f64" } },
			WireGraphMap_int64_EBRColorSpace: { Values: { i64: "EBRColorSpace" } },
			WireGraphMap_int64_EBRDisplayTextEasing: { Values: { i64: "EBRDisplayTextEasing" } },
			WireGraphMap_int64_EBRDisplayTextJustification: { Values: { i64: "EBRDisplayTextJustification" } },
			WireGraphMap_int64_EBREasingDirection: { Values: { i64: "EBREasingDirection" } },
			WireGraphMap_int64_EBREasingFunction: { Values: { i64: "EBREasingFunction" } },
			WireGraphMap_int64_EBrickAerodynamicForceApplication: { Values: { i64: "EBrickAerodynamicForceApplication" } },
			WireGraphMap_int64_EBrickAerodynamicSurfaceRole: { Values: { i64: "EBrickAerodynamicSurfaceRole" } },
			WireGraphMap_int64_EBrickAxis: { Values: { i64: "EBrickAxis" } },
			WireGraphMap_int64_EBrickDirection: { Values: { i64: "EBrickDirection" } },
			WireGraphMap_int64_EBrickLightRayTracingVisibility: { Values: { i64: "EBrickLightRayTracingVisibility" } },
			WireGraphMap_int64_EBrickMaterial: { Values: { i64: "EBrickMaterial" } },
			WireGraphMap_int64_EBrickRigidJointInterpMode: { Values: { i64: "EBrickRigidJointInterpMode" } },
			WireGraphMap_int64_EBrickSeatAirStrafeControl: { Values: { i64: "EBrickSeatAirStrafeControl" } },
			WireGraphMap_int64_EBrickSeatCameraOrigin: { Values: { i64: "EBrickSeatCameraOrigin" } },
			WireGraphMap_int64_EBrickSeatFlightInvertOverride: { Values: { i64: "EBrickSeatFlightInvertOverride" } },
			WireGraphMap_int64_EBrickSeatMode: { Values: { i64: "EBrickSeatMode" } },
			WireGraphMap_int64_EBrickThrusterForceApplication: { Values: { i64: "EBrickThrusterForceApplication" } },
			WireGraphMap_int64_EBrickVehicleFlightHandling: { Values: { i64: "EBrickVehicleFlightHandling" } },
			WireGraphMap_int64_EBrickVehicleMassDistribution: { Values: { i64: "EBrickVehicleMassDistribution" } },
			WireGraphMap_int64_EBRPawnCollisionChannel: { Values: { i64: "EBRPawnCollisionChannel" } },
			WireGraphMap_int64_EBRSweepCollisionChannel: { Values: { i64: "EBRSweepCollisionChannel" } },
			WireGraphMap_int64_EBRTextFacing: { Values: { i64: "EBRTextFacing" } },
			WireGraphMap_int64_EBRTextMaterial: { Values: { i64: "EBRTextMaterial" } },
			WireGraphMap_int64_EBRTextOutline: { Values: { i64: "EBRTextOutline" } },
			WireGraphMap_int64_EBRTextShading: { Values: { i64: "EBRTextShading" } },
			WireGraphMap_int64_EBRTextTypeface: { Values: { i64: "EBRTextTypeface" } },
			WireGraphMap_int64_EProjectileSpawnLocation: { Values: { i64: "EProjectileSpawnLocation" } },
			WireGraphMap_int64_FWeakObjectPtr: { Values: { i64: "weak_object" } },
			WireGraphMap_int64_FWireGraphString: { Values: { i64: "str" } },
			WireGraphMap_int64_int64: { Values: { i64: "i64" } },
			WireGraphMapKeyWrapper_FWeakObjectPtr: { Map: "WireGraphMapVariant_FWeakObjectPtr" },
			WireGraphMapKeyWrapper_FWireGraphString: { Map: "WireGraphMapVariant_FWireGraphString" },
			WireGraphMapKeyWrapper_int64: { Map: "WireGraphMapVariant_int64" },
			WireGraphObjectArray: { Values: ["weak_object"] },
			WireGraphStringArray: { Values: ["str"] },
			BrickComponentData_AerodynamicSurface: {
				bEnabled: "bool",
				bDiscoverable: "bool",
				Control_DriveAndSteer: "BrickComponentWireControl_DriveAndSteer",
				Role: "EBrickAerodynamicSurfaceRole",
				LiftCoefficient: "f32",
				LiftMultiplier: "f32",
				ForceApplication: "EBrickAerodynamicForceApplication",
				DragCoefficient: "f32",
				StallAngle: "f32",
				MaxDeflection: "f32",
				Deflection: "f32"
			},
			BrickComponentData_AerodynamicSurface_Directional: {
				AerodynamicDirection: "EBrickDirection",
				bEnabled: "bool",
				bDiscoverable: "bool",
				Control_DriveAndSteer: "BrickComponentWireControl_DriveAndSteer",
				Role: "EBrickAerodynamicSurfaceRole",
				LiftCoefficient: "f32",
				LiftMultiplier: "f32",
				ForceApplication: "EBrickAerodynamicForceApplication",
				DragCoefficient: "f32",
				StallAngle: "f32",
				MaxDeflection: "f32",
				Deflection: "f32"
			},
			BrickComponentData_BrickPropertyChanger: {
				bVisibility: "bool",
				bCollisionEnabled: "bool",
				bCollisionEnabled_Player: "bool",
				bCollisionEnabled_Player1: "bool",
				bCollisionEnabled_Player2: "bool",
				bCollisionEnabled_Player3: "bool",
				bCollisionEnabled_Weapon: "bool",
				bCollisionEnabled_Interaction: "bool",
				bCollisionEnabled_Physics: "bool",
				Color: "Color",
				MaterialAlpha: "u8",
				Material: "EBrickMaterial"
			},
			BrickComponentData_ExplosionSpawner: {
				ProjectileType: "class",
				SpawnOffset: "Vector",
				ScaleMultiplier: "f64",
				DamageMultiplier: "f64"
			},
			BrickComponentData_Gyroscope: {
				bEnabled: "bool",
				bDiscoverable: "bool",
				Strength: "f32",
				Damping: "f32",
				MaxForce: "f32",
				TargetAxis: "Vector",
				Control_DriveAndSteer: "BrickComponentWireControl_DriveAndSteer"
			},
			BrickComponentData_Internal_AttachedZone: {
				ZoneStartDistance: "i32",
				ZoneEndDistance: "i32",
				bIsBuildingZone: "bool",
				bIsLooseZone: "bool",
				bIsShareZone: "bool",
				bWater: "bool",
				WaterScattering: "Vector",
				WaterAbsorption: "Vector",
				WaterFogIntensity: "f32",
				WaterFogScatteringColor: "LinearColor",
				WaterFogAmbientColor: "LinearColor",
				WaterFogScatteringScale: "f32",
				WaterFogAmbientScale: "f32",
				bDetectPlayers: "bool",
				bDetectPlayers1: "bool",
				bDetectPlayers2: "bool",
				bDetectPlayers3: "bool",
				bDetectEntities: "bool",
				bDetectProjectiles: "bool",
				TagFilter: "str",
				ZoneWindForce: "f64"
			},
			BrickComponentData_Joint_Wheel: {
				Control_DriveAndSteer: "BrickComponentWireControl_DriveAndSteer",
				bDiscoverable: "bool",
				bEnabled: "bool",
				DriveSpeed: "f32",
				DrivePower: "f32",
				bSteerEnabled: "bool",
				Steer: "f32",
				SteerLimitDegree: "f32",
				SteerPower: "f32",
				bSuspensionEnabled: "bool",
				SuspensionStiffness: "f32",
				SuspensionDamping: "f32",
				JointDistance: "i32",
				bDriveWhenNotAttachedToEngine: "bool",
				bCanBrake: "bool",
				bAllowEngineSteerCorrect: "bool",
				bReversed: "bool",
				Damping: "f32"
			},
			BrickComponentData_Joint_Wheel_Suspension: {
				Control_DriveAndSteer: "BrickComponentWireControl_DriveAndSteer",
				bDiscoverable: "bool",
				bWheelVisible: "bool",
				bEnabled: "bool",
				DriveSpeed: "f32",
				DrivePower: "f32",
				bSteerEnabled: "bool",
				Steer: "f32",
				SteerLimitDegree: "f32",
				SteerPower: "f32",
				bSuspensionEnabled: "bool",
				SuspensionStiffness: "f32",
				SuspensionDamping: "f32",
				SuspensionOffset: "f32",
				SuspensionLength: "f32",
				JointDistance: "i32",
				bDriveWhenNotAttachedToEngine: "bool",
				bCanBrake: "bool",
				bAllowEngineSteerCorrect: "bool",
				bReversed: "bool",
				Damping: "f32"
			},
			BrickComponentData_PointLight: {
				bMatchBrickShape: "bool",
				bEnabled: "bool",
				Brightness: "f32",
				Radius: "f32",
				Color: "Color",
				bUseBrickColor: "bool",
				bCastShadows: "bool",
				RayTracingVisibility: "EBrickLightRayTracingVisibility"
			},
			BrickComponentData_PrefabSpawn: {
				Prefab: "bundle_path_ref",
				SpawnOffset: "Vector",
				SpawnOffsetRotation: "Rotator",
				SpawnVelocity: "Vector",
				bSpawnEnable: "bool",
				RespawnTime: "f64",
				SpawnedEntityIds: ["u32"]
			},
			BrickComponentData_Seat_V2: {
				bIsOccupied: "bool",
				ExitOffset: "IntVector",
				bRollCameraInThirdPerson: "bool",
				CameraOrigin: "EBrickSeatCameraOrigin",
				CameraOriginOffset: "Vector",
				bScaleCameraOriginOffsetWithZoom: "bool",
				ThirdPersonStartingZoom: "f32",
				ThirdPersonCameraRotation: "Rotator",
				SeatMode: "EBrickSeatMode",
				bStickyPlaneThrottle: "bool",
				bFlyingGroundControls: "bool",
				AirStrafeControl: "EBrickSeatAirStrafeControl",
				FlightInvertXOverride: "EBrickSeatFlightInvertOverride",
				FlightInvertYOverride: "EBrickSeatFlightInvertOverride",
				bAllowHeldItems: "bool",
				bAllowNearbyInteraction: "bool",
				bHiddenInteraction: "bool",
				PromptCustomLabel: "str"
			},
			BrickComponentData_SpotLight: {
				Rotation: "Rotator3f",
				InnerConeAngle: "f32",
				OuterConeAngle: "f32",
				bEnabled: "bool",
				Brightness: "f32",
				Radius: "f32",
				Color: "Color",
				bUseBrickColor: "bool",
				bCastShadows: "bool",
				RayTracingVisibility: "EBrickLightRayTracingVisibility"
			},
			BrickComponentData_TextDisplay: {
				Text: "str",
				Font: "object",
				Rotation: "f32",
				Skew: "f32",
				Kerning: "f32",
				LineHeight: "f32",
				WidthScale: "f32",
				LineOffset: "f32",
				Anchor: "Vector2f",
				Offset: "Vector3f",
				Color: "Color",
				MaterialSlider: "i32",
				ShadingWidth: "f32",
				OutlineColor: "Color",
				OutlineWidth: "f32",
				ScuffWidth: "f32",
				GraffitiDepthLimit: "f32",
				GraffitiAngleLimit: "f32",
				GraffitiLayer: "i32",
				bEnabled: "bool",
				Face: "EBrickDirection",
				bAlignToWedge: "bool",
				bOverrideColor: "bool",
				Typeface: "EBRTextTypeface",
				Billboard: "EBRTextFacing",
				Material: "EBRTextMaterial",
				Shading: "EBRTextShading",
				bFlipShading: "bool",
				Outline: "EBRTextOutline",
				bSharpCorners: "bool",
				bSharpOutlines: "bool",
				bOverrideOutlineColor: "bool",
				bForeground: "bool"
			},
			BrickComponentData_Thruster: {
				bEnabled: "bool",
				bDiscoverable: "bool",
				Force: "f32",
				ForceApplication: "EBrickThrusterForceApplication",
				Throttle: "f32",
				Control_DriveAndSteer: "BrickComponentWireControl_DriveAndSteer",
				Pitch: "f32",
				Yaw: "f32",
				bSpawnLight: "bool"
			},
			BrickComponentData_WeightBrick: {
				Mass: "f32",
				MassSize: "IntVector",
				MassOffset: "IntVector"
			},
			BrickComponentData_WheelEngine_V2: {
				bEnabled: "bool",
				bDisableInWorldControlDiagnostics: "bool",
				bEnableManualControl: "bool",
				ManualControlMode: "EBrickSeatMode",
				ManualInput_Drive: "f32",
				ManualInput_Steer: "f32",
				ManualInput_Pitch: "f32",
				ManualInput_Roll: "f32",
				bManualInput_Brake: "bool",
				Control_DriveAndSteer: "BrickComponentWireControl_DriveAndSteer",
				bAutodiscoverWheels: "bool",
				bAutodiscoverThrusters: "bool",
				bAutodiscoverGyroscopes: "bool",
				bAutodiscoverAerodynamicSurfaces: "bool",
				CustomMass: "f32",
				MassDistribution: "EBrickVehicleMassDistribution",
				CustomMassVerticalOffset: "f32",
				DriveInterpSpeed: "f32",
				DriveSpeed: "f32",
				FlightTopSpeed: "f32",
				FlightHandling: "EBrickVehicleFlightHandling",
				bEnableAirBraking: "bool",
				bEnableMassBalancing: "bool",
				LiftMultiplier: "f32",
				bEnableGlideTrim: "bool",
				GlideTrimStrength: "f32",
				GlideTrimTargetSpeedMultiplier: "f32",
				bEnableAerodynamicRateDamping: "bool",
				PhysicalRollDampingResponseTime: "f32",
				PhysicalPitchDampingResponseTime: "f32",
				PhysicalYawDampingResponseTime: "f32",
				ThrustMultiplier: "f32",
				KeyboardSteeringRollMix: "f32",
				KeyboardSteeringYawMix: "f32",
				HorizontalSteeringRollMix: "f32",
				HorizontalSteeringYawMix: "f32",
				ArcadeRollRate: "f32",
				ArcadePitchRate: "f32",
				ArcadeYawRate: "f32",
				ArcadeResponseTime: "f32",
				ArcadeAirGripResponseTime: "f32",
				ArcadeMaxLateralAccelerationGs: "f32",
				ArcadeAeroAuthorityFadeStartSpeed: "f32",
				ArcadeAeroAuthorityFadeEndSpeed: "f32",
				MigrationVersion: "u8",
				DriveAcceleratingPowerMultiplier: "f32",
				DriveBrakingPowerMultiplier: "f32",
				DriveDampingMultiplier: "f32",
				SteerPowerMultiplier: "f32",
				WheelFrictionMultiplier: "f32",
				SteerInterpSpeed: "f32",
				SteerLimitSpeedFalloff: "f32",
				SteerLimitDegree: "f32",
				CenterOfSteering: "f32",
				bTankSteering: "bool",
				TankSteerSpeedMultiplier: "f32",
				bAutoRight: "bool",
				WaterDriveForce: "f32",
				WaterSteeringForce: "f32",
				AudioDescriptor: "object"
			},
			BrickComponentData_WireGraph_Exec_Character_AddInventoryBrick: {
				BrickAsset: "object",
				ProceduralSize: "Vector"
			},
			BrickComponentData_WireGraph_Exec_Character_AddInventoryEntry: { Entry: "BRInventoryEntryConfig" },
			BrickComponentData_WireGraph_Exec_Character_SetInventoryBrick: {
				Slot: "i64",
				BrickAsset: "object",
				ProceduralSize: "Vector"
			},
			BrickComponentData_WireGraph_Exec_Entity_AddLocationRotation: {
				Vector: "Vector",
				Rotation: "Rotator"
			},
			BrickComponentData_WireGraph_Exec_Entity_AddVelocity: {
				Vector: "Vector",
				Rotation: "Vector"
			},
			BrickComponentData_WireGraph_Exec_Entity_GetAngularVelocity: { AngularVelocity: "Vector" },
			BrickComponentData_WireGraph_Exec_Entity_GetLinearVelocity: { LinearVelocity: "Vector" },
			BrickComponentData_WireGraph_Exec_Entity_GetLocation: { Vector: "Vector" },
			BrickComponentData_WireGraph_Exec_Entity_GetLocationRotation: {
				Vector: "Vector",
				Rotation: "Rotator"
			},
			BrickComponentData_WireGraph_Exec_Entity_GetRotation: { Rotation: "Rotator" },
			BrickComponentData_WireGraph_Exec_Entity_GetVelocity: {
				Vector: "Vector",
				Rotation: "Vector"
			},
			BrickComponentData_WireGraph_Exec_Entity_GetVelocityAtPoint: {
				Point: "Vector",
				LinearVelocity: "Vector"
			},
			BrickComponentData_WireGraph_Exec_Entity_RelativeTeleport: {
				Source: "BrickComponentWirePortControl_TeleportDestination",
				Destination: "BrickComponentWirePortControl_TeleportDestination"
			},
			BrickComponentData_WireGraph_Exec_Entity_SetAngularVelocity: { AngularVelocity: "Vector" },
			BrickComponentData_WireGraph_Exec_Entity_SetGravityDirection: { Rotation: "Rotator" },
			BrickComponentData_WireGraph_Exec_Entity_SetLinearVelocity: { LinearVelocity: "Vector" },
			BrickComponentData_WireGraph_Exec_Entity_SetLocation: { Vector: "Vector" },
			BrickComponentData_WireGraph_Exec_Entity_SetLocationRotation: {
				Vector: "Vector",
				Rotation: "Rotator"
			},
			BrickComponentData_WireGraph_Exec_Entity_SetRotation: { Rotation: "Rotator" },
			BrickComponentData_WireGraph_Exec_Entity_SetVelocity: {
				Vector: "Vector",
				Rotation: "Vector"
			},
			BrickComponentData_WireGraph_Exec_Entity_Teleport: { Destination: "BrickComponentWirePortControl_TeleportDestination" },
			BrickComponentData_WireGraph_Exec_PlayerState_DisplayText: {
				Text: "str",
				Font: "object",
				Typeface: "EBRTextTypeface",
				Anchor: "Vector2D",
				Position: "Vector2D",
				Angle: "f64",
				ZOrder: "i64",
				Scale: "Vector2D",
				Pivot: "Vector2D",
				FontSize: "i32",
				FontColor: "LinearColor",
				LetterSpacing: "f64",
				Skew: "f64",
				LineHeight: "f64",
				OutlineSize: "i64",
				OutlineColor: "LinearColor",
				bMiteredOutline: "bool",
				WrapWidth: "f64",
				ShadowOffset: "Vector2D",
				ShadowColor: "LinearColor",
				Justification: "EBRDisplayTextJustification",
				Transition: "f64",
				Easing: "EBRDisplayTextEasing",
				Lifetime: "f64",
				TextId: "i64"
			},
			BrickComponentData_WireGraph_Exec_PrefabSpawner: {
				Prefab: "bundle_path_ref",
				SpawnOffset: "Vector",
				SpawnOffsetRotation: "Rotator",
				SpawnVelocity: "Vector",
				Lifetime: "f64",
				Limit: "i64",
				SpawnedEntityIds: ["u32"],
				SpawnedInstanceIds: ["u32"]
			},
			BrickComponentData_WireGraph_Exec_SpawnExplosion: {
				ProjectileType: "class",
				SpawnOffset: "Vector",
				ScaleMultiplier: "f64",
				DamageMultiplier: "f64"
			},
			BrickComponentData_WireGraph_Exec_SpawnExplosionAt: {
				ProjectileType: "class",
				WorldPosition: "Vector",
				ScaleMultiplier: "f64",
				DamageMultiplier: "f64"
			},
			BrickComponentData_WireGraph_Exec_Sweep: {
				Origin: "Vector",
				Direction: "Vector",
				Distance: "f64",
				Radius: "f64",
				CollisionChannel: "EBRSweepCollisionChannel",
				bDetectBricks: "bool",
				bDetectPlayers1: "bool",
				bDetectPlayers2: "bool",
				bDetectPlayers3: "bool",
				bDetectPlayers4: "bool",
				bOnlyHitPlayerBodyParts: "bool",
				bDetectPhysics: "bool",
				bDetectMap: "bool",
				bRelative: "bool",
				bIgnoreOwningGrid: "bool",
				HitLocation: "Vector",
				HitNormal: "Vector",
				HitDistance: "f64"
			},
			BrickComponentData_WireGraph_Exec_SweepSimple: {
				Direction: "EBrickDirection",
				Distance: "f64",
				Radius: "f64",
				CollisionChannel: "EBRSweepCollisionChannel",
				SpreadConeAngle: "f64",
				bSpreadBiasedTowardsCenter: "bool",
				bDetectBricks: "bool",
				bDetectPlayers1: "bool",
				bDetectPlayers2: "bool",
				bDetectPlayers3: "bool",
				bDetectPlayers4: "bool",
				bOnlyHitPlayerBodyParts: "bool",
				bDetectPhysics: "bool",
				bDetectMap: "bool",
				HitLocation: "Vector",
				HitNormal: "Vector",
				HitDistance: "f64"
			},
			BrickComponentData_WireGraph_Expr_ColorBlend: {
				ColorA: "LinearColor",
				ColorB: "LinearColor",
				Alpha: "f64",
				BlendSpace: "EBRColorSpace",
				bClampAlpha: "bool"
			},
			BrickComponentData_WireGraph_Expr_ColorConvert: {
				Input: "LinearColor",
				FromSpace: "EBRColorSpace",
				ToSpace: "EBRColorSpace"
			},
			BrickComponentData_WireGraph_Expr_ColorToHex: { Input: "LinearColor" },
			BrickComponentData_WireGraph_Expr_DirectionToRotation: { Direction: "Vector" },
			BrickComponentData_WireGraph_Expr_InvertRotation: { Input: "Quat" },
			BrickComponentData_WireGraph_Expr_QuatAngleBetween: {
				InputA: "Quat",
				InputB: "Quat"
			},
			BrickComponentData_WireGraph_Expr_QuatBetween: {
				From: "Vector",
				To: "Vector"
			},
			BrickComponentData_WireGraph_Expr_QuatDotProduct: {
				InputA: "Quat",
				InputB: "Quat"
			},
			BrickComponentData_WireGraph_Expr_QuatFromAxisAngle: {
				Axis: "Vector",
				Angle: "f64"
			},
			BrickComponentData_WireGraph_Expr_QuatSlerp: {
				InputA: "Quat",
				InputB: "Quat",
				Alpha: "f64",
				bShortestPath: "bool",
				bClampAlpha: "bool"
			},
			BrickComponentData_WireGraph_Expr_QuatToAxisAngle: { Input: "Quat" },
			BrickComponentData_WireGraph_Expr_RotateVector: {
				Rotation: "Quat",
				Vector: "Vector"
			},
			BrickComponentData_WireGraph_Expr_RotationToDirection: { Rotation: "Quat" },
			BrickComponentData_WireGraph_Expr_SplitColor: { Input: "LinearColor" },
			BrickComponentData_WireGraph_Expr_SplitColorSRGB: { Input: "LinearColor" },
			BrickComponentData_WireGraph_Expr_SplitQuaternion: { Input: "Quat" },
			BrickComponentData_WireGraph_Expr_SplitRotation: { Input: "Rotator" },
			BrickComponentData_WireGraph_Expr_SplitVector: { Input: "Vector" },
			BrickComponentData_WireGraph_Expr_Vec_Float: { Input: "Vector" },
			BrickComponentData_WireGraph_Expr_Vec_Vec: { Input: "Vector" },
			BrickComponentData_WireGraph_Expr_VecFloat_Vec: {
				Input: "Vector",
				Scalar: "f64"
			},
			BrickComponentData_WireGraph_Expr_VecVec_Float: {
				InputA: "Vector",
				InputB: "Vector"
			},
			BrickComponentData_WireGraph_Expr_VecVec_Vec: {
				InputA: "Vector",
				InputB: "Vector"
			},
			BrickComponentData_WireGraphPseudo_Dampen: {
				Target: "WireGraphVariant",
				Value: "WireGraphVariant",
				SmoothTime: "f64",
				Velocity: "Vector4"
			},
			BrickComponentData_WireGraphPseudo_QueueSeconds: {
				SecondsToWait: "f32",
				Entries: ["BRQueueSecondsEntry"],
				DataIn1: "WireGraphVariant",
				DataIn2: "WireGraphVariant",
				DataIn3: "WireGraphVariant",
				DataIn4: "WireGraphVariant",
				DataIn5: "WireGraphVariant",
				DataIn6: "WireGraphVariant",
				DataIn7: "WireGraphVariant",
				DataIn8: "WireGraphVariant",
				DataOut1: "WireGraphVariant",
				DataOut2: "WireGraphVariant",
				DataOut3: "WireGraphVariant",
				DataOut4: "WireGraphVariant",
				DataOut5: "WireGraphVariant",
				DataOut6: "WireGraphVariant",
				DataOut7: "WireGraphVariant",
				DataOut8: "WireGraphVariant"
			},
			BrickComponentData_WireGraphPseudo_QueueTicks: {
				TicksToWait: "i32",
				Entries: ["BRQueueTicksEntry"],
				DataIn1: "WireGraphVariant",
				DataIn2: "WireGraphVariant",
				DataIn3: "WireGraphVariant",
				DataIn4: "WireGraphVariant",
				DataIn5: "WireGraphVariant",
				DataIn6: "WireGraphVariant",
				DataIn7: "WireGraphVariant",
				DataIn8: "WireGraphVariant",
				DataOut1: "WireGraphVariant",
				DataOut2: "WireGraphVariant",
				DataOut3: "WireGraphVariant",
				DataOut4: "WireGraphVariant",
				DataOut5: "WireGraphVariant",
				DataOut6: "WireGraphVariant",
				DataOut7: "WireGraphVariant",
				DataOut8: "WireGraphVariant"
			},
			BrickTypeNetWrapper: {
				BrickAsset: "object",
				ProceduralSize: "IntVector"
			},
			BRInventoryEntryWeaponAmmoOverride: {
				bOverrideStartingAmmo: "bool",
				Resources: ["BRInventoryEntryWeaponResourceAmounts"]
			},
			BRPlayerPartCustomizationV3: {
				PartDescriptor: "object",
				DecalDescriptor: "object",
				SocketName: "str",
				Colors: ["Color"]
			},
			BRSavedComponentChunkSoA: {
				ComponentTypeCounters: ["BRSavedBrickComponentTypeCounter"],
				ComponentBrickIndices: ["u32"],
				JointBrickIndices: ["u32"],
				JointEntityReferences: ["u32"],
				JointInitialRelativeOffsets: ["Vector3f", null],
				JointInitialRelativeRotations: ["Quat4f", null],
				MicrochipBrickIndices: ["u32"],
				MicrochipBrickGridReferences: ["u32"]
			},
			WireGraphLinearColorArray: { Values: ["LinearColor"] },
			WireGraphMap_FWeakObjectPtr_FLinearColor: {},
			WireGraphMap_FWeakObjectPtr_FQuat: {},
			WireGraphMap_FWeakObjectPtr_FRotator: {},
			WireGraphMap_FWeakObjectPtr_FVector: {},
			WireGraphMap_FWireGraphString_FLinearColor: { Values: { str: "LinearColor" } },
			WireGraphMap_FWireGraphString_FQuat: { Values: { str: "Quat" } },
			WireGraphMap_FWireGraphString_FRotator: { Values: { str: "Rotator" } },
			WireGraphMap_FWireGraphString_FVector: { Values: { str: "Vector" } },
			WireGraphMap_int64_FLinearColor: { Values: { i64: "LinearColor" } },
			WireGraphMap_int64_FQuat: { Values: { i64: "Quat" } },
			WireGraphMap_int64_FRotator: { Values: { i64: "Rotator" } },
			WireGraphMap_int64_FVector: { Values: { i64: "Vector" } },
			WireGraphQuatArray: { Values: ["Quat"] },
			WireGraphRotatorArray: { Values: ["Rotator"] },
			WireGraphVectorArray: { Values: ["Vector"] },
			BrickComponentData_ItemSpawn: {
				PickupClass: "class",
				bPickupEnabled: "bool",
				bPickupRespawnOnMinigameReset: "bool",
				PickupMinigameResetRespawnDelay: "f32",
				bPickupAutoDisableOnPickup: "bool",
				PickupRespawnTime: "f32",
				bRenderTranslucentWhenDisabled: "bool",
				DamageMultiplier: "f32",
				WeaponSpeedMultiplier: "f32",
				ItemNameOverride: "str",
				ProjectileOverride: "class",
				WeaponAmmoOverride: "BRInventoryEntryWeaponAmmoOverride",
				PickupOffsetDirection: "EBrickDirection",
				PickupOffsetDistance: "f32",
				PickupRotation: "Rotator3f",
				PickupScale: "f32",
				bOverridePickupColors: "bool",
				PickupMeshColors: ["Color"],
				bPickupAnimationEnabled: "bool",
				PickupAnimationAxis: "EBrickAxis",
				bPickupAnimationAxisLocal: "bool",
				PickupSpinSpeed: "f32",
				PickupBobSpeed: "f32",
				PickupBobHeight: "f32",
				PickupAnimationPhase: "f32"
			},
			BrickComponentData_WireGraph_Exec_Character_AddInventoryItemAdv: {
				ItemType: "class",
				DamageMultiplier: "f64",
				WeaponSpeedMultiplier: "f64",
				ItemScale: "f64",
				ItemNameOverride: "str",
				ProjectileOverride: "class",
				WeaponAmmoOverride: "BRInventoryEntryWeaponAmmoOverride",
				bOverrideColors: "bool",
				MeshColors: ["Color"]
			},
			BrickComponentData_WireGraph_Exec_Character_SetInventoryItemAdv: {
				Slot: "i64",
				ItemType: "class",
				DamageMultiplier: "f64",
				WeaponSpeedMultiplier: "f64",
				ItemScale: "f64",
				ItemNameOverride: "str",
				ProjectileOverride: "class",
				WeaponAmmoOverride: "BRInventoryEntryWeaponAmmoOverride",
				bOverrideColors: "bool",
				MeshColors: ["Color"]
			},
			BRInventoryEntryBrick: { BrickType: "BrickTypeNetWrapper" },
			BRInventoryEntryItem: {
				ItemType: "class",
				bOverrideColors: "bool",
				MeshColors: ["Color"],
				DamageMultiplier: "f32",
				WeaponSpeedMultiplier: "f32",
				ItemScale: "f32",
				ItemNameOverride: "str",
				ProjectileOverride: "class",
				WeaponAmmoOverride: "BRInventoryEntryWeaponAmmoOverride"
			},
			BRInventoryEntryPlan: {
				Type: "EBRInventoryEntryPlanType",
				BrickTypeIfBrick: "BrickTypeNetWrapper",
				EntityTypeIfEntity: "class",
				ItemTypeIfItem: "class"
			},
			BRPlayerAvatarCustomizationV3: { Parts: ["BRPlayerPartCustomizationV3"] },
			BrickComponentData_BotSpawn: {
				RespawnTime: "f32",
				CorpseTimeout: "f32",
				GunSkill: "f32",
				Agression: "f32",
				ReactionTime: "f32",
				MovementRandomness: "f32",
				RunSpeed: "f32",
				HealthMultiplier: "f32",
				Jumpyness: "f32",
				MovementAmount: "f32",
				AttackMovementAmount: "f32",
				AggroRange: "f32",
				AttackDamageMultiplier: "f32",
				bCanJump: "bool",
				bBackVision: "bool",
				bVisionRaycasting: "bool",
				bCanTargetPlayers: "bool",
				bCanTargetBots: "bool",
				bActiveBot: "bool",
				bSpawnEnable: "bool",
				bDeleteBot: "bool",
				MoveTarget: "Vector",
				MovementGoalDummy: "BrickComponentWirePortControl_TeleportDestination",
				BotName: "str",
				Skin: "BRPlayerAvatarCustomizationV3",
				bColorsAreLinear: "bool",
				TeamCollisionChannel: "EBRPawnCollisionChannel",
				bTeamCollision: "bool",
				bTeamCollision1: "bool",
				bTeamCollision2: "bool",
				bTeamCollision3: "bool",
				BotWeapon: "class"
			},
			BrickComponentData_WireGraph_Exec_Character_SetInventoryEntry: {
				Slot: "i64",
				Entry: "BRInventoryEntryConfig",
				EntryPlan: "BRInventoryEntryPlan"
			}
		}
	},
	BRSavedEntityChunkIndexSoA: {
		enums: {},
		variants: {},
		structs: {
			BRSavedChunk3DIndex: {
				X: "i16",
				Y: "i16",
				Z: "i16"
			},
			BRSavedEntityChunkIndexSoA: {
				NextPersistentIndex: "u32",
				Chunk3DIndices: ["BRSavedChunk3DIndex"],
				NumEntities: ["u32"]
			}
		}
	},
	BRSavedEntityChunkSoA: {
		enums: {},
		variants: {},
		structs: {
			BrickGridDynamicActor: {
				BouyancyScale: "f32",
				MassScale: "f32",
				bEnableGravity: "bool",
				bUseNewMassCalculation: "bool",
				bReceivesDecals: "bool",
				EntityTag: "str"
			},
			BRSavedBitFlags: { Flags: ["u8", null] },
			BRSavedBrickColor: {
				R: "u8",
				G: "u8",
				B: "u8",
				A: "u8"
			},
			BRSavedEntityTypeCounter: {
				TypeIndex: "u32",
				NumEntities: "u32"
			},
			IntVector: {
				X: "i32",
				Y: "i32",
				Z: "i32"
			},
			Quat4f: {
				X: "f32",
				Y: "f32",
				Z: "f32",
				W: "f32"
			},
			Vector3f: {
				X: "f32",
				Y: "f32",
				Z: "f32"
			},
			BP_MicrochipBrickGridDynamicActor_C: {
				bCollapsed: "bool",
				PlaneCenter: "IntVector",
				PlaneExtent: "IntVector"
			},
			BRSavedEntityColors: {
				Color0: "BRSavedBrickColor",
				Color1: "BRSavedBrickColor",
				Color2: "BRSavedBrickColor",
				Color3: "BRSavedBrickColor",
				Color4: "BRSavedBrickColor",
				Color5: "BRSavedBrickColor",
				Color6: "BRSavedBrickColor",
				Color7: "BRSavedBrickColor"
			},
			BRSavedEntityChunkSoA: {
				TypeCounters: ["BRSavedEntityTypeCounter"],
				PersistentIndices: ["u32"],
				OwnerIndices: ["u32"],
				OriginalOwnerIndices: ["u32"],
				Locations: ["Vector3f", null],
				Rotations: ["Quat4f", null],
				WeldParentFlags: "BRSavedBitFlags",
				PhysicsLockedFlags: "BRSavedBitFlags",
				PhysicsSleepingFlags: "BRSavedBitFlags",
				WeldParentIndices: ["u32"],
				LinearVelocities: ["Vector3f", null],
				AngularVelocities: ["Vector3f", null],
				ColorsAndAlphas: ["BRSavedEntityColors", null],
				RemainingLifeSpans: ["f32", null],
				bColorsAreLinear: "bool"
			}
		}
	}
}, Xa;
function Za(e, t) {
	if (typeof e == "string") return {
		kind: "type",
		type: e
	};
	if (Array.isArray(e)) {
		if (e.length === 1) return {
			kind: "array",
			type: e[0]
		};
		if (e.length === 2 && e[1] === null) return {
			kind: "flatarray",
			type: e[0]
		};
		throw Error(`brdb: invalid schema prop source at ${t}`);
	}
	let n = Object.entries(e);
	if (n.length === 1) return {
		kind: "map",
		key: n[0][0],
		value: n[0][1]
	};
	throw Error(`brdb: invalid schema prop source at ${t}`);
}
var Qa = (e) => typeof e == "object" && e && !Array.isArray(e) && typeof e.$bigint == "string" ? e : null, $a = (e) => typeof e == "bigint" ? { $bigint: e.toString() } : e;
function eo(e, t) {
	if (typeof e == "number" || typeof e == "bigint") return e;
	let n = Qa(e);
	if (n) try {
		return BigInt(n.$bigint);
	} catch {
		throw RangeError(`brdb: invalid $bigint payload '${n.$bigint}' for ${t}`);
	}
	throw Error(`brdb: expected an integer value for ${t}`);
}
var to = [
	"f64",
	"i64",
	"bool",
	"weak_object",
	"WireGraphExec"
], no = ["f64", "i64"];
function ro(e, t) {
	if (typeof e == "object" && e && !Array.isArray(e) && typeof e.$variant == "string") return e;
	throw Error(`brdb: variant ${t} requires a { $variant, value } wrapper`);
}
var io = {
	u8: 1,
	i8: 1,
	u16: 2,
	i16: 2,
	u32: 4,
	i32: 4,
	f32: 4,
	u64: 8,
	i64: 8,
	f64: 8
};
function ao(e) {
	let t = e.peek();
	if ((t & 224) == 160 || t === 217 || t === 218) return {
		kind: "type",
		type: Ba(e)
	};
	if ((t & 240) == 144) {
		let t = Ha(e);
		if (t === 1) return {
			kind: "array",
			type: Ba(e)
		};
		if (t === 2) {
			let t = Ba(e);
			return Wa(e), {
				kind: "flatarray",
				type: t
			};
		}
		throw Error(`brdb: unsupported property array length ${t}`);
	}
	if ((t & 240) == 128) {
		let t = Ua(e);
		if (t !== 1) throw Error(`brdb: unsupported property map length ${t}`);
		return {
			kind: "map",
			key: Ba(e),
			value: Ba(e)
		};
	}
	throw Error(`brdb: unsupported property marker 0x${t.toString(16)}`);
}
var oo = class e {
	constructor(e, t, n) {
		this.enums = e, this.variants = t, this.structs = n;
	}
	static fromText(t) {
		let { enums: n, variants: r, structs: i } = Ja(t);
		return new e(n, r, i);
	}
	static fromData(t) {
		let n = new Map(Object.entries(t.enums).map(([e, t]) => [e, new Map(Object.entries(t))])), r = new Map(Object.entries(t.variants).map(([e, t]) => [e, [...t]])), i = new Map(Object.entries(t.structs).map(([e, t]) => [e, new Map(Object.entries(t).map(([t, n]) => [t, Za(n, `${e}.${t}`)]))]));
		return new e(n, r, i);
	}
	static fromBinary(t) {
		let n = new qi(t), r = Ha(n);
		if (r !== 2 && r !== 3) throw Error(`brdb: invalid schema header length ${r}`);
		let i = /* @__PURE__ */ new Map();
		for (let e = 0, t = Ua(n); e < t; e++) {
			let e = Ba(n), t = /* @__PURE__ */ new Map();
			for (let e = 0, r = Ua(n); e < r; e++) t.set(Ba(n), Fa(n));
			i.set(e, t);
		}
		let a = /* @__PURE__ */ new Map();
		if (r === 3) for (let e = 0, t = Ua(n); e < t; e++) {
			let e = Ba(n), t = [];
			for (let e = 0, r = Ha(n); e < r; e++) t.push(Ba(n));
			a.set(e, t);
		}
		let o = /* @__PURE__ */ new Map();
		for (let e = 0, t = Ua(n); e < t; e++) {
			let e = Ba(n), t = /* @__PURE__ */ new Map();
			for (let e = 0, r = Ua(n); e < r; e++) t.set(Ba(n), ao(n));
			o.set(e, t);
		}
		if (n.remaining !== 0) throw Error(`brdb: ${n.remaining} trailing bytes after schema`);
		return new e(i, a, o);
	}
	extractStructsTransitive(e) {
		let t = /* @__PURE__ */ new Map(), n = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Set(), a = [...e];
		for (let e = a.pop(); e !== void 0; e = a.pop()) {
			if (i.has(e)) continue;
			i.add(e);
			let o = this.variants.get(e);
			if (o) {
				a.push(...o), n.set(e, [...o]);
				continue;
			}
			let s = this.enums.get(e);
			if (s) {
				t.set(e, new Map(s));
				continue;
			}
			let c = this.structs.get(e);
			if (c) {
				let t = /* @__PURE__ */ new Map();
				for (let [e, n] of c) n.kind === "map" ? a.push(n.key, n.value) : a.push(n.type), t.set(e, { ...n });
				r.set(e, t);
			}
		}
		return {
			enums: t,
			variants: n,
			structs: r
		};
	}
	merge(e) {
		for (let [t, n] of e.enums) this.enums.set(t, n);
		for (let [t, n] of e.variants) this.variants.set(t, n);
		for (let [t, n] of e.structs) this.structs.set(t, n);
	}
	zeroValue(e) {
		switch (e) {
			case "u8":
			case "u16":
			case "u32":
			case "u64":
			case "i8":
			case "i16":
			case "i32":
			case "i64":
			case "f32":
			case "f64": return 0;
			case "bool": return !1;
			case "str":
			case "bundle_path_ref": return "";
			case "class":
			case "object":
			case "weak_object": return null;
			case "wire_graph_variant":
			case "wire_graph_prim_math_variant": return {
				$variant: "f64",
				value: 0
			};
		}
		let t = this.variants.get(e);
		if (t) {
			let n = t[0];
			if (n === void 0) throw Error(`brdb: empty variant ${e}`);
			return {
				$variant: n,
				value: this.zeroValue(n)
			};
		}
		if (this.enums.has(e)) return 0;
		let n = this.structs.get(e);
		if (n) {
			let e = {};
			for (let [t, r] of n) e[t] = r.kind === "type" ? this.zeroValue(r.type) : r.kind === "map" ? { $map: [] } : [];
			return e;
		}
		throw Error(`brdb: unknown type ${e}`);
	}
	fillStruct(e, t, n) {
		let r = this.structs.get(e);
		if (!r) throw Error(`brdb: unknown struct ${e}`);
		for (let n of Object.keys(t)) if (!r.has(n)) throw Error(`brdb: ${e} has no field '${n}'`);
		let i = {};
		for (let [e, a] of r) {
			let r = t[e] === void 0 ? n?.[e] : t[e];
			i[e] = r === void 0 ? a.kind === "type" ? this.zeroValue(a.type) : a.kind === "map" ? { $map: [] } : [] : r;
		}
		return i;
	}
	topoStructOrder() {
		let e = /* @__PURE__ */ new Set(), t = [], n = (r) => {
			if (e.has(r)) return;
			e.add(r);
			let i = this.structs.get(r);
			if (i) for (let e of i.values()) {
				let t = e.kind === "map" ? [e.key, e.value] : [e.type];
				for (let e of t) this.structs.has(e) && n(e);
			}
			t.push(r);
		};
		for (let e of this.structs.keys()) n(e);
		return t;
	}
	toBinary() {
		let e = new Ki();
		ka(e, 3), Aa(e, this.enums.size);
		for (let [t, n] of this.enums) {
			X(e, t), Aa(e, n.size);
			for (let [t, r] of n) X(e, t), Y(e, r);
		}
		Aa(e, this.variants.size);
		for (let [t, n] of this.variants) {
			X(e, t), ka(e, n.length);
			for (let t of n) X(e, t);
		}
		let t = this.topoStructOrder();
		Aa(e, t.length);
		for (let n of t) {
			let t = this.structs.get(n);
			X(e, n), Aa(e, t.size);
			for (let [n, r] of t) switch (X(e, n), r.kind) {
				case "type":
					X(e, r.type);
					break;
				case "array":
					ka(e, 1), X(e, r.type);
					break;
				case "flatarray":
					ka(e, 2), X(e, r.type), Ca(e);
					break;
				case "map":
					Aa(e, 1), X(e, r.key), X(e, r.value);
					break;
			}
		}
		return e.toBytes();
	}
	flatTypeSize(e) {
		let t = io[e];
		if (t) return t;
		let n = this.structs.get(e);
		if (!n) return 0;
		let r = 0;
		for (let e of n.values()) r += e.kind === "type" ? this.flatTypeSize(e.type) : 0;
		return r;
	}
	writeValue(e, t, n) {
		switch (t) {
			case "u8": return Ta(e, n);
			case "u16":
			case "u32":
			case "u64": return J(e, eo(n, t));
			case "i8":
			case "i16":
			case "i32":
			case "i64": return Y(e, eo(n, t));
			case "f32": return Ea(e, n);
			case "f64": return Da(e, n);
			case "str":
			case "bundle_path_ref": return X(e, n);
			case "bool": return wa(e, n);
			case "class":
			case "object":
			case "weak_object": return n === null ? Y(e, -1) : J(e, n);
			case "wire_graph_variant":
			case "wire_graph_prim_math_variant": return this.writeLegacyWireVariant(e, t, n);
		}
		let r = this.variants.get(t);
		if (r) {
			let i = ro(n, t), a = r.indexOf(i.$variant);
			if (a === -1) throw Error(`brdb: '${i.$variant}' is not a member of variant ${t}`);
			return J(e, a), this.writeVariantPayload(e, i.$variant, i.value);
		}
		let i = this.enums.get(t);
		if (i) {
			let r = n;
			if (r < 0 || r >= i.size) throw RangeError(`brdb: enum ${t} ordinal ${r} out of bounds`);
			return J(e, r);
		}
		let a = this.structs.get(t);
		if (a) {
			let r = n;
			for (let [n, i] of a) {
				if (!(n in r)) throw Error(`brdb: missing struct field ${t}.${n}`);
				this.writeProperty(e, i, r[n], `${t}.${n}`);
			}
			return;
		}
		throw Error(`brdb: unknown type ${t}`);
	}
	writeVariantPayload(e, t, n) {
		if (t === "weak_object") return Y(e, n === null ? -1 : n);
		this.writeValue(e, t, n);
	}
	writeLegacyWireVariant(e, t, n) {
		let r = t === "wire_graph_variant" ? to : no, i = ro(n, t), a = r.indexOf(i.$variant);
		if (a === -1) throw Error(`brdb: '${i.$variant}' is not a member of ${t}`);
		switch (J(e, a), i.$variant) {
			case "f64": return Da(e, i.value);
			case "i64": return Y(e, eo(i.value, t));
			case "bool": return wa(e, i.value);
			case "weak_object": return Y(e, i.value === null ? -1 : i.value);
			case "WireGraphExec": return;
		}
	}
	writeProperty(e, t, n, r) {
		switch (t.kind) {
			case "type": return this.writeValue(e, t.type, n);
			case "array": {
				let r = n;
				ka(e, r.length);
				for (let n of r) this.writeValue(e, t.type, n);
				return;
			}
			case "flatarray": {
				let i = n, a = this.flatTypeSize(t.type);
				if (a === 0) throw Error(`brdb: invalid flat type ${t.type} at ${r}`);
				Oa(e, i.length * a);
				for (let n of i) this.writeFlat(e, t.type, n, r);
				return;
			}
			case "map": {
				let i = n?.$map;
				if (!Array.isArray(i)) throw Error(`brdb: expected a { $map } value at ${r}`);
				Aa(e, i.length);
				for (let n of i) {
					let [r, i] = n;
					this.writeValue(e, t.key, r), this.writeValue(e, t.value, i);
				}
				return;
			}
		}
	}
	writeFlat(e, t, n, r) {
		switch (t) {
			case "u8": return e.u8(n);
			case "i8": return e.i8(n);
			case "u16": return e.u16le(n);
			case "i16": return e.i16le(n);
			case "u32": return e.u32le(n);
			case "i32": return e.i32le(n);
			case "f32": return e.f32le(n);
			case "f64": return e.f64le(n);
			case "u64": return e.u64le(BigInt(eo(n, r)));
			case "i64": return e.i64le(BigInt(eo(n, r)));
		}
		let i = this.structs.get(t);
		if (!i) throw Error(`brdb: invalid flat type ${t} at ${r}`);
		let a = n;
		for (let [n, o] of i) {
			if (o.kind !== "type") throw Error(`brdb: flat struct ${t} has non-flat field ${n}`);
			if (!(n in a)) throw Error(`brdb: missing struct field ${t}.${n}`);
			this.writeFlat(e, o.type, a[n], `${r}.${n}`);
		}
	}
	readValue(t, n, r = 0) {
		if (r > e.MAX_DECODE_DEPTH) throw Error("brdb: schema recursion too deep");
		switch (n) {
			case "u8":
			case "u16":
			case "u32": return Ia(t);
			case "u64": return $a(Ia(t, !0));
			case "i8":
			case "i16":
			case "i32": return Fa(t);
			case "i64": return $a(Fa(t, !0));
			case "f32": return La(t);
			case "f64": return Ra(t);
			case "str":
			case "bundle_path_ref": return Ba(t);
			case "bool": return za(t);
			case "class":
			case "object":
			case "weak_object": {
				let e = Fa(t);
				return e < 0 ? null : e;
			}
			case "wire_graph_variant":
			case "wire_graph_prim_math_variant": return this.readLegacyWireVariant(t, n);
		}
		let i = this.variants.get(n);
		if (i) {
			let e = Ia(t), a = i[e];
			if (a === void 0) throw Error(`brdb: unknown tag ${e} for variant ${n}`);
			return {
				$variant: a,
				value: this.readValue(t, a, r + 1)
			};
		}
		let a = this.enums.get(n);
		if (a) {
			let e = Ia(t);
			if (e >= a.size) throw RangeError(`brdb: enum ${n} ordinal ${e} out of bounds`);
			return e;
		}
		let o = this.structs.get(n);
		if (o) {
			let e = {};
			for (let [i, a] of o) e[i] = this.readProperty(t, a, `${n}.${i}`, r + 1);
			return e;
		}
		throw Error(`brdb: unknown type ${n}`);
	}
	readLegacyWireVariant(e, t) {
		let n = t === "wire_graph_variant" ? to : no, r = Ia(e), i = n[r];
		switch (i) {
			case "f64": return {
				$variant: i,
				value: Ra(e)
			};
			case "i64": return {
				$variant: i,
				value: $a(Fa(e, !0))
			};
			case "bool": return {
				$variant: i,
				value: za(e)
			};
			case "weak_object": {
				let t = Fa(e);
				return {
					$variant: i,
					value: t < 0 ? null : t
				};
			}
			case "WireGraphExec": return {
				$variant: i,
				value: null
			};
			default: throw Error(`brdb: unknown tag ${r} for ${t}`);
		}
	}
	readProperty(e, t, n, r = 0) {
		switch (t.kind) {
			case "type": return this.readValue(e, t.type, r);
			case "array": {
				let n = Ha(e), i = [];
				for (let a = 0; a < n; a++) i.push(this.readValue(e, t.type, r));
				return i;
			}
			case "flatarray": {
				let r = Va(e), i = this.flatTypeSize(t.type);
				if (i === 0) throw Error(`brdb: invalid flat type ${t.type} at ${n}`);
				if (r % i !== 0) throw Error(`brdb: flat data length ${r} not divisible by ${i} (${n})`);
				let a = [];
				for (let o = 0; o < r / i; o++) a.push(this.readFlat(e, t.type, n));
				return a;
			}
			case "map": {
				let n = Ua(e), i = [];
				for (let a = 0; a < n; a++) {
					let n = this.readValue(e, t.key, r + 1), a = this.readValue(e, t.value, r + 1);
					i.push([n, a]);
				}
				return { $map: i };
			}
		}
	}
	readFlat(e, t, n) {
		switch (t) {
			case "u8": return e.u8();
			case "i8": return e.i8();
			case "u16": return e.u16le();
			case "i16": return e.i16le();
			case "u32": return e.u32le();
			case "i32": return e.i32le();
			case "f32": return e.f32le();
			case "f64": return e.f64le();
			case "u64":
			case "i64": {
				let n = t === "u64" ? e.u64le() : e.i64le();
				return n > BigInt(2 ** 53 - 1) || n < BigInt(-(2 ** 53 - 1)) ? { $bigint: n.toString() } : Number(n);
			}
		}
		let r = this.structs.get(t);
		if (!r) throw Error(`brdb: invalid flat type ${t} at ${n}`);
		let i = {};
		for (let [a, o] of r) {
			if (o.kind !== "type") throw Error(`brdb: flat struct ${t} has non-flat field ${a}`);
			i[a] = this.readFlat(e, o.type, `${n}.${a}`);
		}
		return i;
	}
	encode(e, t) {
		let n = new Ki();
		return this.writeValue(n, e, t), n.toBytes();
	}
	decode(e, t) {
		let n = new qi(e), r = this.readValue(n, t);
		if (n.remaining !== 0) throw Error(`brdb: ${n.remaining} trailing bytes after ${t}`);
		return r;
	}
};
Xa = oo, Xa.MAX_DECODE_DEPTH = 64;
function so(e, t, n) {
	let r = e.structs.get(t);
	if (!r || r.size !== n.length) return !1;
	let i = 0;
	for (let [e, t] of r) {
		let [r, a] = n[i++];
		if (e !== r || t.kind !== a.kind) return !1;
		if (t.kind === "map") {
			if (a.kind !== "map" || t.key !== a.key || t.value !== a.value) return !1;
		} else if (a.kind === "map" || t.type !== a.type) return !1;
	}
	return !0;
}
var co = /* @__PURE__ */ new Map();
function lo(e) {
	let t = co.get(e);
	return t || (t = oo.fromData(Ya[e]), co.set(e, t)), t;
}
//#endregion
//#region src/brdb/soaWriters.ts
var Z = (e) => ({
	kind: "type",
	type: e
}), uo = (e) => ({
	kind: "array",
	type: e
}), fo = (e) => ({
	kind: "flatarray",
	type: e
}), po = [["Flags", fo("u8")]];
function mo(e) {
	return so(e, "BRSavedBrickChunkSoA", [
		["ProceduralBrickStartingIndex", Z("u32")],
		["BrickSizeCounters", uo("BRSavedBrickSizeCounter")],
		["BrickSizes", uo("BRSavedBrickSize")],
		["BrickTypeIndices", uo("u32")],
		["OwnerIndices", uo("u32")],
		["OriginalOwnerIndices", uo("u32")],
		["RelativePositions", fo("BRSavedRelativeBrickPosition")],
		["Orientations", fo("u8")],
		["CollisionFlags_Player", Z("BRSavedBitFlags")],
		["CollisionFlags_Player1", Z("BRSavedBitFlags")],
		["CollisionFlags_Player2", Z("BRSavedBitFlags")],
		["CollisionFlags_Player3", Z("BRSavedBitFlags")],
		["CollisionFlags_Weapon", Z("BRSavedBitFlags")],
		["CollisionFlags_Interaction", Z("BRSavedBitFlags")],
		["CollisionFlags_Physics", Z("BRSavedBitFlags")],
		["VisibilityFlags", Z("BRSavedBitFlags")],
		["MaterialIndices", fo("u8")],
		["ColorsAndAlphas", fo("BRSavedBrickColor")],
		["bColorsAreLinear", Z("bool")]
	]) && so(e, "BRSavedBrickSizeCounter", [["AssetIndex", Z("u32")], ["NumSizes", Z("u32")]]) && so(e, "BRSavedBrickSize", [
		["X", Z("u16")],
		["Y", Z("u16")],
		["Z", Z("u16")]
	]) && so(e, "BRSavedRelativeBrickPosition", [
		["X", Z("i16")],
		["Y", Z("i16")],
		["Z", Z("i16")]
	]) && so(e, "BRSavedBrickColor", [
		["R", Z("u8")],
		["G", Z("u8")],
		["B", Z("u8")],
		["A", Z("u8")]
	]) && so(e, "BRSavedBitFlags", po);
}
function ho(e) {
	let t = [
		["BrickIndexInChunk", Z("u32")],
		["ComponentTypeIndex", Z("u16")],
		["PortIndex", Z("u16")]
	];
	return so(e, "BRSavedWireChunkSoA", [
		["RemoteWireSources", uo("BRSavedRemoteWirePortSource")],
		["LocalWireSources", uo("BRSavedLocalWirePortSource")],
		["RemoteWireTargets", uo("BRSavedWirePortTarget")],
		["LocalWireTargets", uo("BRSavedWirePortTarget")],
		["PendingPropagationFlags", Z("BRSavedBitFlags")]
	]) && so(e, "BRSavedRemoteWirePortSource", [
		["GridPersistentIndex", Z("u32")],
		["ChunkIndex", Z("BRSavedChunk3DIndex")],
		["BrickIndexInChunk", Z("u32")],
		["ComponentTypeIndex", Z("u16")],
		["PortIndex", Z("u16")]
	]) && so(e, "BRSavedLocalWirePortSource", t) && so(e, "BRSavedWirePortTarget", t) && so(e, "BRSavedChunk3DIndex", [
		["X", Z("i16")],
		["Y", Z("i16")],
		["Z", Z("i16")]
	]) && so(e, "BRSavedBitFlags", po);
}
function go(e, t) {
	Oa(e, t.length);
	for (let n = 0; n < t.length; n++) e.u8(t[n]);
}
function _o(e, t, n) {
	J(e, n), ka(e, t.sizeCounters.length);
	for (let n = 0; n < t.sizeCounters.length; n++) {
		let r = t.sizeCounters[n];
		J(e, r.AssetIndex), J(e, r.NumSizes);
	}
	ka(e, t.sizes.length);
	for (let n = 0; n < t.sizes.length; n++) {
		let r = t.sizes[n];
		J(e, r.X), J(e, r.Y), J(e, r.Z);
	}
	for (let n of [
		t.typeIndices,
		t.ownerIndices,
		t.originalOwnerIndices
	]) {
		ka(e, n.length);
		for (let t = 0; t < n.length; t++) J(e, n[t]);
	}
	Oa(e, t.relPositions.length * 6);
	for (let n = 0; n < t.relPositions.length; n++) {
		let r = t.relPositions[n];
		e.i16le(r.X), e.i16le(r.Y), e.i16le(r.Z);
	}
	Oa(e, t.orientations.length);
	for (let n = 0; n < t.orientations.length; n++) e.u8(t.orientations[n]);
	for (let n of t.bitColumns) go(e, n);
	Oa(e, t.materialIndices.length);
	for (let n = 0; n < t.materialIndices.length; n++) e.u8(t.materialIndices[n]);
	Oa(e, t.colors.length * 4);
	for (let n = 0; n < t.colors.length; n++) {
		let r = t.colors[n];
		e.u8(r.R), e.u8(r.G), e.u8(r.B), e.u8(r.A);
	}
	wa(e, !1);
}
function vo(e, t) {
	ka(e, t.length);
	for (let n = 0; n < t.length; n++) {
		let r = t[n];
		J(e, r.BrickIndexInChunk), J(e, r.ComponentTypeIndex), J(e, r.PortIndex);
	}
}
function yo(e, t) {
	ka(e, t.remoteSources.length);
	for (let n = 0; n < t.remoteSources.length; n++) {
		let r = t.remoteSources[n];
		J(e, r.GridPersistentIndex), Y(e, r.ChunkIndex.X), Y(e, r.ChunkIndex.Y), Y(e, r.ChunkIndex.Z), J(e, r.BrickIndexInChunk), J(e, r.ComponentTypeIndex), J(e, r.PortIndex);
	}
	vo(e, t.localSources), vo(e, t.remoteTargets), vo(e, t.localTargets), go(e, []);
}
//#endregion
//#region src/brdb/writePlan.ts
var bo = 0, xo = 1, So = 2, Co = 3, wo = 4, To = 5, Eo = 6, Do = 7, Oo = 8, ko = 9, Ao = 10, jo = 11, Mo = 12, No = 13, Po = 0, Fo = 1, Io = 2, Lo = 3, Ro = 0, zo = 1, Bo = 2, Vo = 3, Ho = 4, Uo = 5, Wo = 6, Go = 7, Ko = 8, qo = 9, Jo = 10, Yo = 11, Q = class {
	constructor(e, t, n = null, r = null, i = 0) {
		this.k = e, this.ty = t, this.struct = n, this.variant = r, this.enumSize = i;
	}
}, Xo = class {
	constructor(e, t) {
		this.name = e, this.op = t;
	}
}, Zo = class {
	constructor(e, t, n, r) {
		this.k = e, this.ty = t, this.props = n, this.usesCtx = r;
	}
}, Qo = class {
	constructor(e, t, n, r, i, a, o, s) {
		this.name = e, this.ctx = t, this.kind = n, this.desc = r, this.op = i, this.valueOp = a, this.flat = o, this.flatSize = s, this.defaultBytes = null;
	}
}, $o = class {
	constructor(e) {
		this.name = e, this.fields = [], this.names = /* @__PURE__ */ new Set(), this.allDefaultBytes = null, this.defaultsReady = !1;
	}
}, es = class {
	constructor(e, t, n) {
		this.name = e, this.tags = t, this.ops = n;
	}
}, ts = class {
	constructor(e, t) {
		this.schema = e, this.defaultsFor = t, this.structPlans = /* @__PURE__ */ new Map(), this.variantPlans = /* @__PURE__ */ new Map(), this.ops = /* @__PURE__ */ new Map(), this.flatOps = /* @__PURE__ */ new Map(), this.building = /* @__PURE__ */ new Set(), this.lastName = null, this.lastOp = null;
	}
	write(e, t, n) {
		t !== this.lastName && (this.lastOp = this.resolveOp(t), this.lastName = t), this.writeOp(e, this.lastOp, n);
	}
	encode(e, t, n) {
		let r = new Ki(n);
		return this.write(r, e, t), r.toBytes();
	}
	writePartialStruct(e, t, n) {
		let r = this.structPlan(t);
		if (!r) throw Error(`brdb: unknown struct ${t}`);
		r.defaultsReady || this.buildDefaults(r);
		let i = Object.keys(n);
		for (let e = 0; e < i.length; e++) if (!r.names.has(i[e])) throw Error(`brdb: ${t} has no field '${i[e]}'`);
		if (i.length === 0 && r.allDefaultBytes) {
			e.bytes(r.allDefaultBytes);
			return;
		}
		let a = r.fields;
		for (let t = 0; t < a.length; t++) {
			let i = a[t], o = n[i.name];
			o === void 0 ? i.defaultBytes === null ? this.writeField(e, i, this.defaultValue(r, i)) : e.bytes(i.defaultBytes) : this.writeField(e, i, o);
		}
	}
	resolveOp(e) {
		let t = this.ops.get(e);
		if (t) return t;
		let n = this.buildOp(e);
		return this.ops.set(e, n), n;
	}
	buildOp(e) {
		switch (e) {
			case "bool": return new Q(bo, e);
			case "u8": return new Q(xo, e);
			case "u16":
			case "u32":
			case "u64": return new Q(So, e);
			case "i8":
			case "i16":
			case "i32":
			case "i64": return new Q(Co, e);
			case "f32": return new Q(wo, e);
			case "f64": return new Q(To, e);
			case "str":
			case "bundle_path_ref": return new Q(Eo, e);
			case "class":
			case "object":
			case "weak_object": return new Q(Do, e);
			case "wire_graph_variant":
			case "wire_graph_prim_math_variant": return new Q(No, e);
		}
		if (this.schema.variants.has(e)) return new Q(jo, e);
		let t = this.schema.enums.get(e);
		if (t) return new Q(ko, e, null, null, t.size);
		if (this.schema.structs.has(e)) {
			if (this.building.has(e)) return new Q(Mo, e);
			let t = this.structPlan(e);
			return t ? new Q(Ao, e, t) : new Q(No, e);
		}
		return new Q(No, e);
	}
	structPlan(e) {
		let t = this.structPlans.get(e);
		if (t !== void 0) return t;
		let n = this.schema.structs.get(e);
		if (!n) return this.structPlans.set(e, null), null;
		if (this.building.has(e)) return null;
		this.building.add(e);
		let r = new $o(e);
		for (let [t, i] of n) r.names.add(t), r.fields.push(this.fieldPlan(e, t, i));
		return this.building.delete(e), this.structPlans.set(e, r), r;
	}
	fieldPlan(e, t, n) {
		let r = `${e}.${t}`;
		switch (n.kind) {
			case "type": return new Qo(t, r, Po, n, this.resolveOp(n.type), null, null, 0);
			case "array": return new Qo(t, r, Fo, n, this.resolveOp(n.type), null, null, 0);
			case "flatarray": return new Qo(t, r, Io, n, this.resolveOp(n.type), null, this.resolveFlatOp(n.type), this.schema.flatTypeSize(n.type));
			case "map": return new Qo(t, r, Lo, n, this.resolveOp(n.key), this.resolveOp(n.value), null, 0);
		}
	}
	resolveFlatOp(e) {
		let t = this.flatOps.get(e);
		if (t) return t;
		let n = this.buildFlatOp(e);
		return this.flatOps.set(e, n), n;
	}
	buildFlatOp(e) {
		switch (e) {
			case "u8": return new Zo(Ro, e, null, !1);
			case "i8": return new Zo(zo, e, null, !1);
			case "u16": return new Zo(Bo, e, null, !1);
			case "i16": return new Zo(Vo, e, null, !1);
			case "u32": return new Zo(Ho, e, null, !1);
			case "i32": return new Zo(Uo, e, null, !1);
			case "f32": return new Zo(Wo, e, null, !1);
			case "f64": return new Zo(Go, e, null, !1);
			case "u64": return new Zo(Ko, e, null, !0);
			case "i64": return new Zo(qo, e, null, !0);
		}
		let t = this.schema.structs.get(e);
		if (!t) return new Zo(Yo, e, null, !0);
		let n = [], r = !1;
		for (let [i, a] of t) {
			if (a.kind !== "type") return new Zo(Yo, e, null, !0);
			let t = this.resolveFlatOp(a.type);
			r = r || t.usesCtx, n.push(new Xo(i, t));
		}
		return new Zo(Jo, e, n, r);
	}
	defaultValue(e, t) {
		let n = this.defaultsFor?.(e.name)?.[t.name];
		return n === void 0 ? t.kind === Po ? this.schema.zeroValue(t.desc.type) : t.kind === Lo ? { $map: [] } : [] : n;
	}
	buildDefaults(e) {
		e.defaultsReady = !0;
		let t = 0;
		for (let n of e.fields) try {
			let r = new Ki(64);
			this.writeField(r, n, this.defaultValue(e, n)), n.defaultBytes = r.toBytes(), t += n.defaultBytes.length;
		} catch {
			n.defaultBytes = null;
			return;
		}
		let n = new Uint8Array(t), r = 0;
		for (let t of e.fields) n.set(t.defaultBytes, r), r += t.defaultBytes.length;
		e.allDefaultBytes = n;
	}
	variantPlan(e) {
		let t = this.variantPlans.get(e);
		if (t) return t;
		let n = this.schema.variants.get(e) ?? [], r = /* @__PURE__ */ new Map(), i = [];
		for (let e = 0; e < n.length; e++) {
			let t = n[e];
			r.has(t) || r.set(t, e), i.push(t === "weak_object" ? new Q(Oo, t) : this.resolveOp(t));
		}
		let a = new es(e, r, i);
		return this.variantPlans.set(e, a), a;
	}
	writeOp(e, t, n) {
		switch (t.k) {
			case bo: return wa(e, n);
			case xo: return Ta(e, n);
			case So: return J(e, eo(n, t.ty));
			case Co: return Y(e, eo(n, t.ty));
			case wo: return Ea(e, n);
			case To: return Da(e, n);
			case Eo: return X(e, n);
			case Do: return n === null ? Y(e, -1) : J(e, n);
			case Oo: return Y(e, n === null ? -1 : n);
			case ko: {
				let r = n;
				if (r < 0 || r >= t.enumSize) throw RangeError(`brdb: enum ${t.ty} ordinal ${r} out of bounds`);
				return J(e, r);
			}
			case Ao: return this.writeStruct(e, t.struct, n);
			case Mo: {
				let r = t.struct ?? (t.struct = this.structPlan(t.ty));
				return r ? this.writeStruct(e, r, n) : this.schema.writeValue(e, t.ty, n);
			}
			case jo: {
				let r = t.variant ?? (t.variant = this.variantPlan(t.ty)), i = ro(n, t.ty), a = r.tags.get(i.$variant);
				if (a === void 0) throw Error(`brdb: '${i.$variant}' is not a member of variant ${t.ty}`);
				return J(e, a), this.writeOp(e, r.ops[a], i.value);
			}
			default: return this.schema.writeValue(e, t.ty, n);
		}
	}
	writeStruct(e, t, n) {
		let r = n, i = t.fields;
		for (let t = 0; t < i.length; t++) {
			let n = i[t];
			if (!(n.name in r)) throw Error(`brdb: missing struct field ${n.ctx}`);
			this.writeField(e, n, r[n.name]);
		}
	}
	writeField(e, t, n) {
		switch (t.kind) {
			case Po: return this.writeOp(e, t.op, n);
			case Fo: {
				let r = n;
				ka(e, r.length);
				for (let n = 0; n < r.length; n++) this.writeOp(e, t.op, r[n]);
				return;
			}
			case Io: {
				let r = n, i = t.desc.type;
				if (t.flatSize === 0) throw Error(`brdb: invalid flat type ${i} at ${t.ctx}`);
				Oa(e, r.length * t.flatSize);
				for (let n = 0; n < r.length; n++) this.writeFlatOp(e, t.flat, r[n], t.ctx);
				return;
			}
			case Lo: {
				let r = n?.$map;
				if (!Array.isArray(r)) throw Error(`brdb: expected a { $map } value at ${t.ctx}`);
				Aa(e, r.length);
				for (let n = 0; n < r.length; n++) {
					let i = r[n];
					this.writeOp(e, t.op, i[0]), this.writeOp(e, t.valueOp, i[1]);
				}
				return;
			}
		}
	}
	writeFlatOp(e, t, n, r) {
		switch (t.k) {
			case Ro: return e.u8(n);
			case zo: return e.i8(n);
			case Bo: return e.u16le(n);
			case Vo: return e.i16le(n);
			case Ho: return e.u32le(n);
			case Uo: return e.i32le(n);
			case Wo: return e.f32le(n);
			case Go: return e.f64le(n);
			case Ko: return e.u64le(BigInt(eo(n, r)));
			case qo: return e.i64le(BigInt(eo(n, r)));
			case Jo: {
				let i = n, a = t.props;
				for (let n = 0; n < a.length; n++) {
					let o = a[n];
					if (!(o.name in i)) throw Error(`brdb: missing struct field ${t.ty}.${o.name}`);
					this.writeFlatOp(e, o.op, i[o.name], o.op.usesCtx ? `${r}.${o.name}` : r);
				}
				return;
			}
			default: return this.schema.writeFlat(e, t.ty, n, r);
		}
	}
}, ns = 2048, rs = 1024, is = (e, t) => Math.floor(e / t), as = (e, t) => (e % t + t) % t;
function os(e) {
	return {
		chunk: e.map((e) => is(e, ns)),
		rel: e.map((e) => as(e, ns) - rs)
	};
}
function ss(e) {
	let t = e.brick_assets ?? ["PB_DefaultBrick"], n = e.materials ?? ["BMC_Plastic"], r = e.brick_owners?.length ?? 0;
	return e.bricks.map((i, a) => {
		let o = `bricks[${a}]`, s = (Array.isArray(i.components) ? i.components : []).map((e, t) => {
			if (!ia.has(e.type)) throw Error(`brdb: ${o}.components[${t}]: unknown component type '${e.type}'`);
			return e;
		}), c = t[i.asset_name_index ?? 0];
		if (c === void 0) throw Error(`brdb: ${o}: asset_name_index ${i.asset_name_index} out of range`);
		let l = n[i.material_index ?? 0];
		if (l === void 0) throw Error(`brdb: ${o}: material_index ${i.material_index} out of range`);
		let u = i.position.map((e) => {
			if (!Number.isSafeInteger(e)) throw Error(`brdb: ${o}: position must be integers, got ${i.position}`);
			if (!(e >= -32768 * 2048 && e <= 32768 * 2048 - 1)) throw Error(`brdb: ${o}: position ${e} outside the i16 chunk range`);
			return e;
		}), d = ra(c);
		if (i.size === void 0 && d) throw Error(`brdb: ${o}: procedural asset ${c} requires a size`);
		let f = (i.size ?? [
			0,
			0,
			0
		]).map((e) => {
			if (!Number.isInteger(e) || e < 0 || e > 65535) throw Error(`brdb: ${o}: size components must be u16, got ${i.size}`);
			return e;
		}), p;
		if (typeof i.collision == "boolean") {
			let e = i.collision;
			p = {
				player: e,
				weapon: e,
				interaction: e,
				physics: e
			};
		} else p = {
			player: i.collision?.player ?? !0,
			weapon: i.collision?.weapon ?? !0,
			interaction: i.collision?.interaction ?? !0,
			physics: i.collision?.physics ?? !0
		};
		let m, h = i.color;
		if (typeof h == "number") {
			let t = e.colors?.[h];
			if (!t) throw Error(`brdb: ${o}: color palette index ${h} out of range`);
			m = [
				t[0],
				t[1],
				t[2]
			];
		} else if (Array.isArray(h)) {
			if (h.length < 3) throw Error(`brdb: ${o}: color array must have at least 3 components`);
			m = [
				h[0],
				h[1],
				h[2]
			];
		} else m = [
			255,
			255,
			255
		];
		m = m.map((e, t) => {
			if (!Number.isInteger(e) || e < 0 || e > 255) throw Error(`brdb: ${o}: resolved color component ${t} must be u8, got ${e}`);
			return e;
		});
		let g = i.material_intensity ?? 5;
		if (!Number.isInteger(g) || g < 0 || g > 255) throw Error(`brdb: ${o}: material_intensity must be u8, got ${g}`);
		let _ = i.owner_index ?? 0;
		if (!Number.isInteger(_) || _ < 0 || _ > r) throw Error(`brdb: ${o}: owner_index ${_} out of range (0..${r})`);
		return {
			assetName: c,
			procedural: d,
			size: f,
			position: u,
			direction: i.direction ?? 4,
			rotation: i.rotation ?? 0,
			collision: p,
			visible: i.visibility ?? !0,
			materialName: l,
			intensity: g,
			color: m,
			ownerIndex: _,
			components: s
		};
	});
}
var cs = class {
	constructor() {
		this.map = /* @__PURE__ */ new Map();
	}
	add(e) {
		let t = this.map.get(e);
		return t === void 0 && (t = this.map.size, this.map.set(e, t)), t;
	}
	indexOf(e) {
		let t = this.map.get(e);
		if (t === void 0) throw Error(`brdb: registry miss for ${e}`);
		return t;
	}
	has(e) {
		return this.map.has(e);
	}
	get names() {
		return [...this.map.keys()];
	}
	get size() {
		return this.map.size;
	}
}, ls = class {
	constructor() {
		this.sizeCounters = [], this.sizes = [], this.typeIndices = [], this.ownerIndices = [], this.originalOwnerIndices = [], this.relPositions = [], this.orientations = [], this.colPlayer = new vi(), this.colPlayer1 = new vi(), this.colPlayer2 = new vi(), this.colPlayer3 = new vi(), this.colWeapon = new vi(), this.colInteraction = new vi(), this.colPhysics = new vi(), this.visibility = new vi(), this.materialIndices = [], this.colors = [], this.sizeIndexMap = /* @__PURE__ */ new Map(), this.numBrickSizes = 0, this.numBricks = 0;
	}
	addBrick(e, t, n, r) {
		let i;
		if (!e.procedural) i = n.basic.indexOf(e.assetName);
		else {
			let t = n.procedural.indexOf(e.assetName), a = `${t}:${e.size[0]},${e.size[1]},${e.size[2]}`, o = this.sizeIndexMap.get(a);
			if (o === void 0) {
				o = this.numBrickSizes + r;
				let n = this.sizeCounters[this.sizeCounters.length - 1];
				n && n.AssetIndex === t ? n.NumSizes += 1 : this.sizeCounters.push({
					AssetIndex: t,
					NumSizes: 1
				}), this.sizes.push({
					X: e.size[0],
					Y: e.size[1],
					Z: e.size[2]
				}), this.sizeIndexMap.set(a, o), this.numBrickSizes += 1;
			}
			i = o;
		}
		this.typeIndices.push(i), this.ownerIndices.push(e.ownerIndex), this.originalOwnerIndices.push(e.ownerIndex), this.relPositions.push({
			X: t[0],
			Y: t[1],
			Z: t[2]
		}), this.orientations.push((e.direction & 7) << 2 | e.rotation & 3), this.colPlayer.push(e.collision.player), this.colPlayer1.push(e.collision.player), this.colPlayer2.push(e.collision.player), this.colPlayer3.push(e.collision.player), this.colWeapon.push(e.collision.weapon), this.colInteraction.push(e.collision.interaction), this.colPhysics.push(e.collision.physics), this.visibility.push(e.visible), this.materialIndices.push(n.materials.indexOf(e.materialName)), this.colors.push({
			R: e.color[0],
			G: e.color[1],
			B: e.color[2],
			A: e.intensity
		}), this.numBricks += 1;
	}
	get bitColumns() {
		return [
			this.colPlayer.bytes,
			this.colPlayer1.bytes,
			this.colPlayer2.bytes,
			this.colPlayer3.bytes,
			this.colWeapon.bytes,
			this.colInteraction.bytes,
			this.colPhysics.bytes,
			this.visibility.bytes
		];
	}
	toBytes(e, t, n) {
		if (!n) return e.encode("BRSavedBrickChunkSoA", this.toValue(t));
		let r = new Ki(32 * this.numBricks + 256);
		return _o(r, this, t), r.toBytes();
	}
	toValue(e) {
		return {
			ProceduralBrickStartingIndex: e,
			BrickSizeCounters: this.sizeCounters,
			BrickSizes: this.sizes,
			BrickTypeIndices: this.typeIndices,
			OwnerIndices: this.ownerIndices,
			OriginalOwnerIndices: this.originalOwnerIndices,
			RelativePositions: this.relPositions,
			Orientations: this.orientations,
			CollisionFlags_Player: this.colPlayer.toValue(),
			CollisionFlags_Player1: this.colPlayer1.toValue(),
			CollisionFlags_Player2: this.colPlayer2.toValue(),
			CollisionFlags_Player3: this.colPlayer3.toValue(),
			CollisionFlags_Weapon: this.colWeapon.toValue(),
			CollisionFlags_Interaction: this.colInteraction.toValue(),
			CollisionFlags_Physics: this.colPhysics.toValue(),
			VisibilityFlags: this.visibility.toValue(),
			MaterialIndices: this.materialIndices,
			ColorsAndAlphas: this.colors,
			bColorsAreLinear: !1
		};
	}
}, us = class {
	constructor() {
		this.instances = [], this.microchipBrickIndices = [], this.microchipGridReferences = [];
	}
	get numComponents() {
		return this.instances.length;
	}
	add(e, t, n, r) {
		this.instances.push({
			typeIndex: e,
			brickIndex: t,
			structName: n,
			data: r
		});
	}
	addMicrochipLink(e, t) {
		this.microchipBrickIndices.push(e), this.microchipGridReferences.push(t);
	}
	runsOf(e) {
		let t = [];
		for (let n of e) {
			let e = t[t.length - 1];
			e && e.TypeIndex === n.typeIndex ? e.NumInstances += 1 : t.push({
				TypeIndex: n.typeIndex,
				NumInstances: 1
			});
		}
		return t;
	}
	grouped() {
		let e = this.instances, t = this.runsOf(e), n = 0, r = !0;
		for (let e of t) {
			if (!Number.isInteger(e.TypeIndex) || e.TypeIndex < 0) {
				r = !1;
				break;
			}
			e.TypeIndex >= n && (n = e.TypeIndex + 1);
		}
		let i = t.length;
		if (r) {
			let e = new Uint8Array(n);
			i = 0;
			for (let n of t) e[n.TypeIndex] || (e[n.TypeIndex] = 1, i += 1);
		}
		if (i === t.length) return {
			counters: t,
			instances: e
		};
		let a;
		if (r) {
			let t = new Uint32Array(n + 1);
			for (let n of e) t[n.typeIndex + 1] += 1;
			for (let e = 1; e < t.length; e++) t[e] += t[e - 1];
			a = Array(e.length);
			for (let n of e) a[t[n.typeIndex]++] = n;
		} else a = [...e].sort((e, t) => e.typeIndex - t.typeIndex);
		return {
			counters: this.runsOf(a),
			instances: a
		};
	}
	toBytes(e, t) {
		let { counters: n, instances: r } = this.grouped(), i = {
			ComponentTypeCounters: n,
			ComponentBrickIndices: r.map((e) => e.brickIndex),
			JointBrickIndices: [],
			JointEntityReferences: [],
			JointInitialRelativeOffsets: [],
			JointInitialRelativeRotations: [],
			MicrochipBrickIndices: this.microchipBrickIndices,
			MicrochipBrickGridReferences: this.microchipGridReferences
		}, a = new Ki(256 + 16 * r.length);
		if (da()) {
			t.write(a, "BRSavedComponentChunkSoA", i);
			for (let e of r) e.structName !== "None" && t.writePartialStruct(a, e.structName, e.data);
		} else {
			e.writeValue(a, "BRSavedComponentChunkSoA", i);
			for (let t of r) t.structName !== "None" && e.writeValue(a, t.structName, e.fillStruct(t.structName, t.data, aa.get(t.structName)));
		}
		return a.toBytes();
	}
};
function ds(e) {
	let t = [{
		guid: fa,
		name: "PUBLIC",
		display: "PUBLIC"
	}];
	for (let n of e ?? []) t.push({
		guid: pa(n.id ?? "00000000-0000-0000-0000-000000000000"),
		name: n.name ?? "Unknown",
		display: n.display_name ?? n.name ?? "Unknown"
	});
	return t;
}
function fs(e, t = {}) {
	let n = ss(e), r = (e.wires ?? []).filter((e) => "component_type" in e.source);
	return ps({
		description: e.description,
		author: e.author?.name ? {
			id: e.author.id,
			name: e.author.name
		} : void 0,
		prefabs: [],
		ownerRows: ds(e.brick_owners),
		grids: [n],
		gridIds: [1],
		entities: [],
		wires: r.map((e) => ({
			source: {
				gridSlot: 0,
				brickIndex: e.source.brick_index,
				componentType: e.source.component_type,
				port: e.source.port
			},
			target: {
				gridSlot: 0,
				brickIndex: e.target.brick_index,
				componentType: e.target.component_type,
				port: e.target.port
			}
		})),
		microchipLinks: [],
		prefab: t.prefab ?? null
	}, t);
}
function ps(e, t = {}) {
	let n = e.grids.flat(), r = new cs(), i = new cs(), o = new cs();
	for (let e of n) r.add(e.materialName), (e.procedural ? o : i).add(e.assetName);
	if (r.size > 256) throw Error(`brdb: too many distinct materials (${r.size}); MaterialIndices is u8 (max 256)`);
	let s = {
		materials: r,
		basic: i,
		procedural: o
	}, c = i.size, l = new cs(), u = [];
	for (let e of n) for (let t of e.components) {
		let e = l.size;
		l.add(t.type) === e && u.push(ia.get(t.type));
	}
	let d = new cs();
	e.wires.forEach((t, n) => {
		for (let [r, i] of [["source", t.source], ["target", t.target]]) {
			let t = e.grids[i.gridSlot]?.length ?? 0;
			if (!Number.isInteger(i.brickIndex) || i.brickIndex < 0 || i.brickIndex >= t) throw Error(`brdb: wires[${n}].${r}: brick_index ${i.brickIndex} out of range`);
			if (!l.has(i.componentType)) throw Error(`brdb: wires[${n}].${r}: component type '${i.componentType}' is not used by any brick`);
			d.add(i.port);
		}
	});
	let f = new cs(), p = [];
	for (let t of e.entities) {
		let e = f.size;
		f.add(t.type) === e && p.push(t.className);
	}
	let m = oo.fromData(Ya.BRSavedComponentChunkSoA);
	if (l.size > 0) {
		let e = [];
		for (let t of u) t !== "None" && !e.includes(t) && e.push(t);
		m.merge(lo("BRSavedComponentChunkSoA_max").extractStructsTransitive(e));
	}
	let h = e.ownerRows, g = h.map(() => 0), _ = h.map(() => 0), v = h.map(() => 0);
	for (let t of e.entities) v[t.ownerIndex] += 1;
	let y = e.grids.map((e) => {
		let t = {
			chunkOrder: [],
			chunks: /* @__PURE__ */ new Map(),
			componentChunks: /* @__PURE__ */ new Map(),
			brickLocations: [],
			wireChunks: /* @__PURE__ */ new Map(),
			chunkWireCounts: /* @__PURE__ */ new Map()
		};
		for (let n of e) {
			let { chunk: e, rel: r } = os(n.position), i = e.join("_"), a = t.chunks.get(i);
			a || (a = {
				index: e,
				builder: new ls()
			}, t.chunks.set(i, a), t.chunkOrder.push(i));
			let o = a.builder.numBricks;
			if (a.builder.addBrick(n, r, s, c), t.brickLocations.push({
				key: i,
				chunk: e,
				localIndex: o
			}), g[n.ownerIndex] += 1, n.components.length > 0) {
				_[n.ownerIndex] += n.components.length;
				let e = t.componentChunks.get(i);
				e || t.componentChunks.set(i, e = new us());
				for (let t of n.components) {
					let n = l.indexOf(t.type);
					e.add(n, o, u[n], t.data ?? {});
				}
			}
		}
		return t;
	});
	for (let t of e.microchipLinks) {
		let e = y[t.gridSlot], n = e?.brickLocations[t.brickIndex];
		if (!n) throw Error(`brdb: microchip link brick index ${t.brickIndex} out of range`);
		let r = e.componentChunks.get(n.key);
		r || e.componentChunks.set(n.key, r = new us()), r.addMicrochipLink(n.localIndex, t.gridReference);
	}
	for (let t of e.wires) {
		let n = y[t.source.gridSlot].brickLocations[t.source.brickIndex], r = y[t.target.gridSlot], i = r.brickLocations[t.target.brickIndex], a = {
			BrickIndexInChunk: i.localIndex,
			ComponentTypeIndex: l.indexOf(t.target.componentType),
			PortIndex: d.indexOf(t.target.port)
		}, o = r.wireChunks.get(i.key);
		o || r.wireChunks.set(i.key, o = {
			remoteSources: [],
			localSources: [],
			remoteTargets: [],
			localTargets: []
		}), r.chunkWireCounts.set(i.key, (r.chunkWireCounts.get(i.key) ?? 0) + 1), t.source.gridSlot === t.target.gridSlot && n.key === i.key ? (o.localSources.push({
			BrickIndexInChunk: n.localIndex,
			ComponentTypeIndex: l.indexOf(t.source.componentType),
			PortIndex: d.indexOf(t.source.port)
		}), o.localTargets.push(a)) : (o.remoteSources.push({
			GridPersistentIndex: e.gridIds[t.source.gridSlot],
			ChunkIndex: {
				X: n.chunk[0],
				Y: n.chunk[1],
				Z: n.chunk[2]
			},
			BrickIndexInChunk: n.localIndex,
			ComponentTypeIndex: l.indexOf(t.source.componentType),
			PortIndex: d.indexOf(t.source.port)
		}), o.remoteTargets.push(a));
	}
	let b = lo("BRSavedGlobalDataSoA"), x = lo("BRSavedOwnerTableSoA"), S = lo("BRSavedBrickChunkIndexSoA"), C = lo("BRSavedBrickChunkSoA"), w = lo("BRSavedWireChunkSoA"), T = lo("BRSavedEntityChunkIndexSoA"), E = lo("BRSavedEntityChunkSoA"), D = new ts(m, (e) => aa.get(e)), O = new ts(E), k = da(), A = k && mo(C), j = k && ho(w), M = (e) => {
		if (!j) return w.encode("BRSavedWireChunkSoA", {
			RemoteWireSources: e.remoteSources,
			LocalWireSources: e.localSources,
			RemoteWireTargets: e.remoteTargets,
			LocalWireTargets: e.localTargets,
			PendingPropagationFlags: { Flags: [] }
		});
		let t = new Ki(32 * e.remoteSources.length + 16 * e.localSources.length + 64);
		return yo(t, e), t.toBytes();
	}, ee = b.encode("BRSavedGlobalDataSoA", {
		EntityTypeNames: f.names,
		EntityDataClassNames: p,
		BasicBrickAssetNames: i.names,
		ProceduralBrickAssetNames: o.names,
		MaterialAssetNames: r.names,
		ComponentTypeNames: l.names,
		ComponentDataStructNames: u,
		ComponentWirePortNames: d.names,
		ExternalAssetReferences: (t.externalAssets ?? []).map((e) => ({
			PrimaryAssetType: e.type,
			PrimaryAssetName: e.name
		})),
		GlobalGridEntityTypeIndex: -1
	}), te = x.encode("BRSavedOwnerTableSoA", {
		UserIds: h.map((e) => ({
			A: e.guid.A,
			B: e.guid.B,
			C: e.guid.C,
			D: e.guid.D
		})),
		UserNames: h.map((e) => e.name),
		DisplayNames: h.map((e) => e.display),
		EntityCounts: v,
		BrickCounts: g,
		ComponentCounts: _,
		WireCounts: h.map(() => 0)
	}), ne = e.entities.length, re = T.encode("BRSavedEntityChunkIndexSoA", {
		NextPersistentIndex: 2 + ne,
		Chunk3DIndices: ne ? [{
			X: 0,
			Y: 0,
			Z: 0
		}] : [],
		NumEntities: ne ? [ne] : []
	}), ie = null;
	if (ne > 0) {
		let t = [], n = new vi(), r = new vi();
		for (let i of e.entities) {
			let e = f.indexOf(i.type), a = t[t.length - 1];
			a && a.TypeIndex === e ? a.NumEntities += 1 : t.push({
				TypeIndex: e,
				NumEntities: 1
			}), n.push(i.frozen), r.push(i.sleeping);
		}
		let i = new Ki(256 + 96 * ne), a = {
			TypeCounters: t,
			PersistentIndices: e.entities.map((e, t) => 2 + t),
			OwnerIndices: e.entities.map((e) => e.ownerIndex),
			OriginalOwnerIndices: e.entities.map((e) => e.ownerIndex),
			Locations: e.entities.map((e) => e.location),
			Rotations: e.entities.map((e) => e.rotation),
			WeldParentFlags: { Flags: [] },
			PhysicsLockedFlags: n.toValue(),
			PhysicsSleepingFlags: r.toValue(),
			WeldParentIndices: [],
			LinearVelocities: e.entities.map((e) => e.velocity),
			AngularVelocities: e.entities.map((e) => e.angularVelocity),
			ColorsAndAlphas: e.entities.map((e) => Object.fromEntries(e.colors.map((e, t) => [`Color${t}`, e]))),
			RemainingLifeSpans: e.entities.map(() => 0),
			bColorsAreLinear: !1
		};
		k ? O.write(i, "BRSavedEntityChunkSoA", a) : E.writeValue(i, "BRSavedEntityChunkSoA", a), e.entities.forEach((e, t) => {
			if (e.className !== "None") try {
				k ? O.writePartialStruct(i, e.className, e.data) : E.writeValue(i, e.className, E.fillStruct(e.className, e.data));
			} catch (n) {
				throw Error(`brdb: entities[${t}] (${e.type}) data: ${n.message}`);
			}
		}), ie = i.toBytes();
	}
	let ae = new TextEncoder(), oe = {
		type: e.prefab ? "Prefab" : "World",
		iD: a,
		name: "",
		version: "",
		tags: [],
		authors: e.author ? [{
			iD: e.author.id ?? "00000000-0000-0000-0000-000000000000",
			name: e.author.name
		}] : [],
		createdAt: "0001.01.01-00.00.00",
		updatedAt: "0001.01.01-00.00.00",
		description: e.description ?? "A Generated World",
		dependencies: [],
		gameVersion: "CL0",
		...t.bundle
	}, se = (e, t) => {
		let n = t ? 0 : rs, r = [["ChunkIndex.mps", q(S.encode("BRSavedBrickChunkIndexSoA", {
			Chunk3DIndices: e.chunkOrder.map((t) => {
				let [n, r, i] = e.chunks.get(t).index;
				return {
					X: n,
					Y: r,
					Z: i
				};
			}),
			ChunkOffsets: e.chunkOrder.map(() => ({
				X: n,
				Y: n,
				Z: n
			})),
			ChunkSizes: e.chunkOrder.map(() => ns),
			NumBricks: e.chunkOrder.map((t) => e.chunks.get(t).builder.numBricks),
			NumComponents: e.chunkOrder.map((t) => e.componentChunks.get(t)?.numComponents ?? 0),
			NumWires: e.chunkOrder.map((t) => e.chunkWireCounts.get(t) ?? 0)
		}))]];
		return e.chunkOrder.length > 0 && r.push(["Chunks", ha(e.chunkOrder.map((t) => [`${t}.mps`, q(e.chunks.get(t).builder.toBytes(C, c, A))]))]), e.componentChunks.size > 0 && r.push(["Components", ha(e.chunkOrder.filter((t) => e.componentChunks.has(t)).map((t) => [`${t}.mps`, q(e.componentChunks.get(t).toBytes(m, D))]))]), e.wireChunks.size > 0 && r.push(["Wires", ha(e.chunkOrder.filter((t) => e.wireChunks.has(t)).map((t) => {
			let n = e.wireChunks.get(t);
			return [`${t}.mps`, q(M(n))];
		}))]), r;
	}, ce = [["Bundle.json", q(ae.encode(JSON.stringify(oe)))]];
	e.prefab && ce.push(["Prefab.json", q(ae.encode(vs(e.prefab)))]), t.screenshot && ce.push(["Screenshot.jpg", q(t.screenshot)]), t.thumbnail && ce.push(["Thumbnail.png", q(t.thumbnail)]), e.prefab || ce.push(["World.json", q(ae.encode(JSON.stringify({ environment: t.environment ?? "Plate" })))]);
	let le = [
		["ChunkIndex.schema", q(T.toBinary())],
		["ChunkIndex.mps", q(re)],
		["ChunksShared.schema", q(E.toBinary())]
	];
	ie && le.push(["Chunks", ha([["0_0_0.mps", q(ie)]])]);
	let ue = [["Meta", ha(ce)], ["World", ha([["0", ha([
		["GlobalData.schema", q(b.toBinary())],
		["GlobalData.mps", q(ee)],
		["Owners.schema", q(x.toBinary())],
		["Owners.mps", q(te)],
		["Bricks", ha([
			["ChunkIndexShared.schema", q(S.toBinary())],
			["ChunksShared.schema", q(C.toBinary())],
			["WiresShared.schema", q(w.toBinary())],
			["ComponentsShared.schema", q(m.toBinary())],
			["Grids", ha(y.map((t, n) => [String(e.gridIds[n]), ha(se(t, e.gridIds[n] === 1))]))]
		])],
		["Entities", ha(le)]
	])]])]];
	if (e.prefabs.length > 0) for (let [t, n] of e.prefabs) {
		let e = t.split("/"), r = ue;
		for (let t = 0; t < e.length - 1; t++) {
			let n = r.find(([n, r]) => n === e[t] && r.type === "folder");
			n || (n = [e[t], ha([])], r.push(n)), r = n[1].children;
		}
		r.push([e[e.length - 1], q(n)]);
	}
	return ue;
}
function ms(e, t, n) {
	let r = e.type ?? "Entity_DynamicBrickGrid", i = sa.get(r);
	if (i === void 0) throw Error(`brdb: entities[${t}]: unknown entity type '${r}'`);
	let a = e.owner_index ?? 0;
	if (!Number.isInteger(a) || a < 0 || a > n) throw Error(`brdb: entities[${t}]: owner_index ${a} out of range (0..${n})`);
	let o = [...e.colors ?? []];
	if (o.length > 8) throw Error(`brdb: entities[${t}]: at most 8 colors, got ${o.length}`);
	for (; o.length < 8;) o.push({
		R: 255,
		G: 255,
		B: 255,
		A: 255
	});
	return {
		type: r,
		className: i,
		location: e.location ?? {
			X: 0,
			Y: 0,
			Z: 0
		},
		rotation: e.rotation ?? {
			X: 0,
			Y: 0,
			Z: 0,
			W: 1
		},
		ownerIndex: a,
		frozen: e.frozen ?? !1,
		sleeping: e.sleeping ?? !1,
		velocity: e.linear_velocity ?? {
			X: 0,
			Y: 0,
			Z: 0
		},
		angularVelocity: e.angular_velocity ?? {
			X: 0,
			Y: 0,
			Z: 0
		},
		colors: o,
		data: e.data ?? {}
	};
}
var hs = "@@f64:", gs = class {
	constructor(e) {
		this.value = e;
	}
	toJSON() {
		return `${hs}${this.value}`;
	}
}, _s = (e, t, n) => ({
	x: new gs(e),
	y: new gs(t),
	z: new gs(n)
});
function vs(e) {
	return JSON.stringify(e).replace(RegExp(`"${hs}(-?[\\d.eE+-]+)"`, "g"), (e, t) => Number.isInteger(Number(t)) ? `${t}.0` : t);
}
function ys(e, t) {
	let n = [
		0,
		0,
		0
	], r = [
		0,
		0,
		0
	];
	e.forEach((e, t) => {
		let i = e.procedural ? e.size : e.assetName === "B_1x1_Microchip" ? [
			5,
			5,
			2
		] : Zi.get(e.assetName) ?? [
			5,
			5,
			6
		];
		for (let a = 0; a < 3; a++) {
			let o = e.position[a] - i[a], s = e.position[a] + i[a];
			(t === 0 || o < n[a]) && (n[a] = o), (t === 0 || s > r[a]) && (r[a] = s);
		}
	});
	let i = {
		center: _s((n[0] + r[0]) / 2, (n[1] + r[1]) / 2, (n[2] + r[2]) / 2),
		halfExtent: _s((r[0] - n[0]) / 2, (r[1] - n[1]) / 2, (r[2] - n[2]) / 2)
	};
	return {
		pivots: {
			bottomStudsPivot: i,
			studsExpandedPivot: i,
			topStudsPivot: i,
			boundsPivot: i,
			bottomStudsDirection: "Z_Negative",
			topStudsDirection: "Z_Positive",
			bBottomStudsValid: !0,
			bTopStudsValid: !0
		},
		addedGlobalGridOffset: t.addedGlobalGridOffset ?? {
			x: 0,
			y: 0,
			z: 0
		},
		bIsPhysicsGrid: t.isPhysicsGrid ?? !1,
		bFreezePhysicsGrid: t.freezePhysicsGrid ?? !1,
		bFreezeGlobalGrid: t.freezeGlobalGrid ?? !1,
		bIsMicrochipPrefab: t.isMicrochipPrefab ?? !1
	};
}
var bs = class {
	constructor() {
		this.gridBrickInputs = [[]], this.gridEntityOrders = [], this.entityInputs = [], this.wireList = [], this.chipLinks = [], this.ownerList = [], this.prefabOptions = null, this.prefabList = [];
	}
	addOwner(e) {
		return this.ownerList.push(e), this.ownerList.length;
	}
	addBrick(e, t) {
		let n = t?.grid ?? 0, r = this.gridBrickInputs[n];
		if (!r) throw Error(`brdb: unknown grid handle (slot ${n})`);
		return r.push(e), {
			grid: n,
			index: r.length - 1
		};
	}
	addBricks(e, t) {
		return [...e].map((e) => this.addBrick(e, t));
	}
	addEntity(e = {}) {
		return this.entityInputs.push(e), { entityOrder: this.entityInputs.length - 1 };
	}
	addBrickGrid(e = {}) {
		let t = this.addEntity({
			type: "Entity_DynamicBrickGrid",
			...e
		});
		return this.gridBrickInputs.push([]), this.gridEntityOrders.push(t.entityOrder), {
			grid: this.gridBrickInputs.length - 1,
			entityOrder: t.entityOrder
		};
	}
	addWire(e, t) {
		this.wireList.push({
			source: e,
			target: t
		});
	}
	registerMicrochipLink(e, t) {
		this.chipLinks.push({
			brick: e,
			grid: t
		});
	}
	addMicrochip(e) {
		let t = this.addBrick({
			asset: "B_1x1_Microchip",
			position: e.position,
			color: e.color,
			owner_index: e.owner_index,
			components: [{ type: "Component_Internal_Microchip" }]
		}), n = this.addBrickGrid({
			type: "Entity_MicrochipDynamicBrickGrid",
			location: e.entityLocation ?? {
				X: 0,
				Y: 0,
				Z: 40
			},
			data: {
				bCollapsed: e.collapsed ?? !0,
				PlaneCenter: {
					X: 0,
					Y: 0,
					Z: 0
				},
				PlaneExtent: e.planeExtent ?? {
					X: 14,
					Y: 14,
					Z: 2
				}
			}
		});
		return this.registerMicrochipLink(t, n), {
			brick: t,
			grid: n
		};
	}
	makePrefab(e = {}) {
		this.prefabOptions = e;
	}
	addPrefab(e) {
		let t = `Prefabs/Uploads/${ni(gi(e)).toUpperCase()}.brz`;
		return this.prefabList.some(([e]) => e === t) || this.prefabList.push([t, e]), t;
	}
	toPendingFs(e = {}) {
		let t = new cs(), n = new cs();
		for (let e of this.gridBrickInputs) for (let r of e) t.add(r.asset ?? "PB_DefaultBrick"), n.add(r.material ?? "BMC_Plastic");
		let r = this.gridBrickInputs.map((e, r) => ss({
			brick_assets: t.names,
			materials: n.names,
			brick_owners: this.ownerList,
			bricks: e.map((e) => ({
				...e,
				asset_name_index: t.indexOf(e.asset ?? "PB_DefaultBrick"),
				material_index: n.indexOf(e.material ?? "BMC_Plastic"),
				size: e.size ?? (e.asset === void 0 ? [
					5,
					5,
					6
				] : void 0),
				position: r === 0 ? e.position : e.position.map((e) => e - rs),
				color: e.color ?? [
					255,
					255,
					255
				]
			}))
		})), i = this.entityInputs.map((e, t) => ms(e, t, this.ownerList.length)), a = [1, ...this.gridEntityOrders.map((e) => 2 + e)];
		return ps({
			ownerRows: ds(this.ownerList),
			grids: r,
			gridIds: a,
			entities: i,
			wires: this.wireList.map((e) => ({
				source: {
					gridSlot: e.source.brick.grid,
					brickIndex: e.source.brick.index,
					componentType: e.source.component_type,
					port: e.source.port
				},
				target: {
					gridSlot: e.target.brick.grid,
					brickIndex: e.target.brick.index,
					componentType: e.target.component_type,
					port: e.target.port
				}
			})),
			microchipLinks: this.chipLinks.map((e) => ({
				gridSlot: e.brick.grid,
				brickIndex: e.brick.index,
				gridReference: 2 + e.grid.entityOrder
			})),
			prefab: this.prefabOptions ? ys(r[0], this.prefabOptions) : e.prefab ?? null,
			prefabs: this.prefabList
		}, e);
	}
	toBrz(e = {}) {
		return Yi(this.toPendingFs(e), { compress: e.compress });
	}
};
function xs(e, t = {}) {
	let n = { compress: t.compress };
	return Yi(fs(e, t), n);
}
function Ss(e) {
	let t = e <= 15 ? 15 : 255;
	return Math.trunc((e / 255) ** (1 / 2.2) * t);
}
function Cs(e) {
	return {
		...e,
		R: Ss(e.R),
		G: Ss(e.G),
		B: Ss(e.B)
	};
}
function ws(e) {
	let t = {};
	for (let [n, r] of Object.entries(e)) t[n] = Cs(r);
	return t;
}
function Ts(e, t, n) {
	let r = 0;
	for (let t of e.BrickSizeCounters) r += t.NumSizes;
	if (r < 0 || r > e.BrickSizes.length) throw Error("brdb: brick size counters exceed size table");
	let i = [];
	for (let t of e.BrickSizeCounters) for (let e = 0; e < t.NumSizes; e++) i.push(t.AssetIndex);
	let a = e.ProceduralBrickStartingIndex, o = e.bColorsAreLinear ?? !0, s = [];
	for (let r = 0; r < e.BrickTypeIndices.length; r++) {
		let c = e.BrickTypeIndices[r], l, u;
		if (c < a) l = c, u = [
			0,
			0,
			0
		];
		else {
			let t = c - a, r = e.BrickSizes[t];
			if (r === void 0 || i[t] === void 0) throw Error(`brdb: invalid procedural size slot ${t}`);
			l = n + i[t], u = [
				r.X,
				r.Y,
				r.Z
			];
		}
		let d = e.RelativePositions[r], f = e.Orientations[r], p = e.ColorsAndAlphas[r], m = o ? Cs(p) : p;
		s.push({
			asset_name_index: l,
			size: u,
			position: [
				t.x * ns + rs + d.X,
				t.y * ns + rs + d.Y,
				t.z * ns + rs + d.Z
			],
			direction: f >> 2 & 7,
			rotation: f & 3,
			collision: {
				player: _i(e.CollisionFlags_Player, r),
				weapon: _i(e.CollisionFlags_Weapon, r),
				interaction: _i(e.CollisionFlags_Interaction, r),
				tool: !0,
				physics: _i(e.CollisionFlags_Physics, r)
			},
			visibility: _i(e.VisibilityFlags, r),
			material_index: e.MaterialIndices[r],
			material_intensity: m.A,
			color: [
				m.R,
				m.G,
				m.B
			],
			owner_index: e.OwnerIndices[r]
		});
	}
	return s;
}
var Es = class e {
	constructor(e, t = 0) {
		this.fs = e, this.worldId = t, this.schemas = /* @__PURE__ */ new Map(), this.values = /* @__PURE__ */ new Map();
	}
	static from(t) {
		return new e(Xi.from(t));
	}
	path(e) {
		return `World/${this.worldId}/${e}`;
	}
	schema(e) {
		let t = this.fs.findFileByPath(e);
		if (!t) throw Error(`brdb: file not found: ${e}`);
		return this.schemaAt(e, t.createdAt);
	}
	schemaAt(e, t) {
		let n = `${e}@${t}`, r = this.schemas.get(n);
		if (!r) {
			let i = this.fs.findFileByPathAtRevision(e, t);
			if (!i) throw Error(`brdb: file not found: ${e} at ${t}`);
			r = oo.fromBinary(this.fs.readBlob(i.contentId)), this.schemas.set(n, r);
		}
		return r;
	}
	decode(e, t, n) {
		let r = this.fs.findFileByPath(e);
		if (!r) throw Error(`brdb: file not found: ${e}`);
		return this.schemaAt(t, r.createdAt).decode(this.fs.readBlob(r.contentId), n);
	}
	cached(e, t) {
		return this.values.has(e) || this.values.set(e, t()), this.values.get(e);
	}
	bundle() {
		return this.cached("Meta/Bundle.json", () => JSON.parse(new TextDecoder().decode(this.fs.readFile("Meta/Bundle.json"))));
	}
	environment() {
		return this.cached("Meta/World.json", () => JSON.parse(new TextDecoder().decode(this.fs.readFile("Meta/World.json"))));
	}
	prefabJson() {
		return this.cached("Meta/Prefab.json", () => this.fs.findFileByPath("Meta/Prefab.json") ? JSON.parse(new TextDecoder().decode(this.fs.readFile("Meta/Prefab.json"))) : null);
	}
	thumbnail() {
		return this.fs.findFileByPath("Meta/Thumbnail.png") ? this.fs.readFile("Meta/Thumbnail.png") : null;
	}
	screenshot() {
		return this.fs.findFileByPath("Meta/Screenshot.jpg") ? this.fs.readFile("Meta/Screenshot.jpg") : null;
	}
	prefabPaths() {
		let e = [], t = (n) => {
			for (let t of this.fs.childFiles(n)) e.push(`${n}/${t}`);
			for (let e of this.fs.childFolders(n)) t(`${n}/${e}`);
		};
		return this.fs.childFolders("").includes("Prefabs") && t("Prefabs"), e;
	}
	readPrefab(e) {
		return this.fs.readFile(e);
	}
	prefabReader(t) {
		return e.from(this.readPrefab(t));
	}
	globalData() {
		return this.cached(this.path("GlobalData.mps"), () => this.decode(this.path("GlobalData.mps"), this.path("GlobalData.schema"), "BRSavedGlobalDataSoA"));
	}
	owners() {
		return this.cached(this.path("Owners.mps"), () => this.decode(this.path("Owners.mps"), this.path("Owners.schema"), "BRSavedOwnerTableSoA"));
	}
	brickAssets() {
		let e = this.globalData();
		return [...e.BasicBrickAssetNames, ...e.ProceduralBrickAssetNames];
	}
	materials() {
		return this.globalData().MaterialAssetNames;
	}
	externalAssets() {
		return this.globalData().ExternalAssetReferences.map((e) => ({
			type: e.PrimaryAssetType,
			name: e.PrimaryAssetName
		}));
	}
	brickOwners() {
		let e = this.owners(), t = [];
		for (let n = 1; n < e.UserNames.length; n++) t.push({
			id: ma(e.UserIds[n]),
			name: e.UserNames[n],
			display_name: e.DisplayNames[n],
			bricks: e.BrickCounts[n]
		});
		return t;
	}
	gridIds() {
		return this.fs.childFolders(this.path("Bricks/Grids")).map(Number).sort((e, t) => e - t);
	}
	brickChunkIndex(e = 1) {
		let t = this.decode(this.path(`Bricks/Grids/${e}/ChunkIndex.mps`), this.path("Bricks/ChunkIndexShared.schema"), "BRSavedBrickChunkIndexSoA");
		return t.Chunk3DIndices.map((e, n) => {
			let r = t.ChunkOffsets?.[n];
			return {
				index: {
					x: e.X,
					y: e.Y,
					z: e.Z
				},
				offset: r ? {
					x: r.X,
					y: r.Y,
					z: r.Z
				} : {
					x: rs,
					y: rs,
					z: rs
				},
				size: t.ChunkSizes?.[n] ?? 2048,
				numBricks: t.NumBricks[n],
				numComponents: t.NumComponents[n],
				numWires: t.NumWires[n]
			};
		});
	}
	brickChunkSoa(e, t) {
		return this.decode(this.path(`Bricks/Grids/${e}/Chunks/${t.x}_${t.y}_${t.z}.mps`), this.path("Bricks/ChunksShared.schema"), "BRSavedBrickChunkSoA");
	}
	*bricks(e = 1) {
		let t = this.globalData().BasicBrickAssetNames.length;
		for (let n of this.brickChunkIndex(e)) yield* Ts(this.brickChunkSoa(e, n.index), n.index, t);
	}
	entityChunkIndex() {
		let e = this.decode(this.path("Entities/ChunkIndex.mps"), this.path("Entities/ChunkIndex.schema"), "BRSavedEntityChunkIndexSoA");
		return {
			nextPersistentIndex: e.NextPersistentIndex,
			chunks: e.Chunk3DIndices.map((t, n) => ({
				index: {
					x: t.X,
					y: t.Y,
					z: t.Z
				},
				numEntities: e.NumEntities[n]
			}))
		};
	}
	componentChunk(e, t) {
		let n = this.path(`Bricks/Grids/${e}/Components/${t.x}_${t.y}_${t.z}.mps`), r = this.fs.findFileByPath(n);
		if (!r) throw Error(`brdb: file not found: ${n}`);
		let i = this.fs.readBlob(r.contentId), a = this.schemaAt(this.path("Bricks/ComponentsShared.schema"), r.createdAt), o = this.globalData(), s = new qi(i), c = a.readValue(s, "BRSavedComponentChunkSoA"), l = 0;
		for (let e of c.ComponentTypeCounters) l += e.NumInstances;
		let u = c.ComponentBrickIndices;
		if (l !== u.length && !(u.length > l && u.length % l === 0 && u.every((e, t) => e === u[t % l]))) throw Error("brdb: component counters do not match brick index count");
		let d = [], f = 0;
		for (let e of c.ComponentTypeCounters) {
			let t = o.ComponentTypeNames[e.TypeIndex] ?? "<invalid>", n = o.ComponentDataStructNames[e.TypeIndex], r = n && n !== "None" ? n : null;
			for (let n = 0; n < e.NumInstances; n++) d.push({
				typeName: t,
				structName: r,
				brickIndex: c.ComponentBrickIndices[f],
				data: r ? a.readValue(s, r) : null
			}), f += 1;
		}
		if (s.remaining !== 0) throw Error(`brdb: ${s.remaining} trailing bytes after component chunk`);
		return {
			soa: c,
			components: d
		};
	}
	wireChunk(e, t) {
		let n = this.decode(this.path(`Bricks/Grids/${e}/Wires/${t.x}_${t.y}_${t.z}.mps`), this.path("Bricks/WiresShared.schema"), "BRSavedWireChunkSoA"), r = this.globalData(), i = (e) => ({
			brickIndex: e.BrickIndexInChunk,
			componentType: r.ComponentTypeNames[e.ComponentTypeIndex] ?? "<invalid>",
			port: r.ComponentWirePortNames[e.PortIndex] ?? "<invalid>"
		});
		return {
			local: n.LocalWireSources.map((e, t) => ({
				source: i(e),
				target: i(n.LocalWireTargets[t])
			})),
			remote: n.RemoteWireSources.map((e, t) => ({
				source: {
					...i(e),
					gridId: e.GridPersistentIndex,
					chunk: {
						x: e.ChunkIndex.X,
						y: e.ChunkIndex.Y,
						z: e.ChunkIndex.Z
					}
				},
				target: i(n.RemoteWireTargets[t])
			}))
		};
	}
	entityChunk(e) {
		let t = this.path(`Entities/Chunks/${e.x}_${e.y}_${e.z}.mps`), n = this.fs.findFileByPath(t);
		if (!n) throw Error(`brdb: file not found: ${t}`);
		let r = this.fs.readBlob(n.contentId), i = this.schemaAt(this.path("Entities/ChunksShared.schema"), n.createdAt), a = this.globalData(), o = new qi(r), s = i.readValue(o, "BRSavedEntityChunkSoA"), c = 0;
		for (let e of s.TypeCounters) c += e.NumEntities;
		if (c !== s.PersistentIndices.length) throw Error("brdb: entity counters do not match persistent index count");
		let l = a.EntityDataClassNames ?? a.EntityTypeNames.map((e) => sa.get(e) ?? "Unknown"), u = s.bColorsAreLinear ?? !0, d = [], f = 0;
		for (let e of s.TypeCounters) {
			let t = a.EntityTypeNames[e.TypeIndex] ?? "<invalid>", n = l[e.TypeIndex], r = n && n !== "None" ? n : null;
			for (let n = 0; n < e.NumEntities; n++) {
				let e = s.ColorsAndAlphas[f];
				d.push({
					typeName: t,
					className: r,
					persistentIndex: s.PersistentIndices[f],
					ownerIndex: s.OwnerIndices[f],
					originalOwnerIndex: s.OriginalOwnerIndices?.[f] ?? s.OwnerIndices[f],
					location: s.Locations[f],
					rotation: s.Rotations[f],
					frozen: _i(s.PhysicsLockedFlags, f),
					sleeping: _i(s.PhysicsSleepingFlags, f),
					linearVelocity: s.LinearVelocities[f],
					angularVelocity: s.AngularVelocities[f],
					colors: u ? ws(e) : e,
					remainingLifeSpan: s.RemainingLifeSpans?.[f] ?? 0,
					data: r ? i.readValue(o, r) : null
				}), f += 1;
			}
		}
		if (o.remaining !== 0) throw Error(`brdb: ${o.remaining} trailing bytes after entity chunk`);
		return d;
	}
	*entities() {
		for (let e of this.entityChunkIndex().chunks) yield* this.entityChunk(e.index);
	}
}, Ds, $ = "\n				", Os = "\n			", ks = `CREATE TABLE blobs (${$}blob_id INTEGER PRIMARY KEY,${$}compression INTEGER,${$}size_uncompressed INTEGER,${$}size_compressed INTEGER,${$}delta_base_id INTEGER REFERENCES blobs(blob_id),${$}hash BLOB,${$}content BLOB${Os});\nCREATE TABLE revisions (${$}revision_id INTEGER PRIMARY KEY,${$}description TEXT,${$}created_at INTEGER${Os});\nCREATE TABLE folders (${$}folder_id INTEGER PRIMARY KEY,${$}parent_id INTEGER REFERENCES folders(folder_id),${$}name TEXT,${$}created_at INTEGER,${$}deleted_at INTEGER${Os});\nCREATE TABLE files (${$}file_id INTEGER PRIMARY KEY,${$}parent_id INTEGER REFERENCES folders(folder_id),${$}name TEXT,${$}content_id INTEGER REFERENCES blobs(blob_id),${$}created_at INTEGER,${$}deleted_at INTEGER${Os});\nCREATE INDEX blobs_size_hash ON blobs(size_uncompressed, hash);
CREATE INDEX folders_parent_name_deleted ON folders(parent_id, name, deleted_at);
CREATE INDEX files_parent_name_deleted ON files(parent_id, name, deleted_at);`, As = [
	"blobs",
	"revisions",
	"folders",
	"files"
], js = () => Math.floor(Date.now() / 1e3), Ms = (e) => typeof Buffer > "u" ? e : Buffer.from(e.buffer, e.byteOffset, e.byteLength), Ns = (e) => {
	try {
		return typeof process < "u" ? process?.getBuiltinModule?.(e) ?? null : null;
	} catch {
		return null;
	}
}, Ps = null, Fs = (e) => (Ps ?? (Ps = Function("specifier", "return import(specifier)")), Ps(e));
async function Is() {
	try {
		let e = await (Rs.engineLoader ?? (() => Fs("better-sqlite3")))();
		return e.default ?? e;
	} catch {
		throw Error("brdb: the Brdb openers require better-sqlite3 (npm install better-sqlite3), or wrap your own handle with new Brdb(db)");
	}
}
function Ls() {
	let e = Ns("node:zlib");
	if (typeof e?.zstdCompressSync != "function") return null;
	let t = e.constants.ZSTD_c_compressionLevel;
	return (n) => new Uint8Array(e.zstdCompressSync(n, { params: { [t]: 14 } }));
}
var Rs = class e {
	constructor(e) {
		this.db = e, this.defaultCompress = null;
		for (let e of As) if (!this.db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name = ?").get(e)) throw Error(`brdb: missing required table '${e}'`);
	}
	static init(t, n = js()) {
		t.exec(ks);
		let r = new e(t);
		return r.createRevision("Initial Revision", n), r;
	}
	static async wrap(t, n) {
		try {
			let r = n ? e.init(t) : new e(t);
			return r.defaultCompress = Ls(), r;
		} catch (e) {
			throw t.close(), e;
		}
	}
	static async open(t) {
		return e.wrap(new (await (Is()))(t, { fileMustExist: !0 }), !1);
	}
	static async openReadonly(t) {
		return e.wrap(new (await (Is()))(t, {
			readonly: !0,
			fileMustExist: !0
		}), !1);
	}
	static async create(t) {
		return e.wrap(new (await (Is()))(t), !0);
	}
	static async openOrCreate(t) {
		let n = Ns("node:fs");
		if (!n) throw Error("brdb: openOrCreate requires node 22.3 or newer; call open or create explicitly");
		return n.existsSync(t) ? e.open(t) : e.create(t);
	}
	static async memory() {
		return e.wrap(new (await (Is()))(":memory:"), !0);
	}
	static async fromBytes(t) {
		return e.wrap(new (await (Is()))(Buffer.from(t)), !1);
	}
	toBytes() {
		let e = this.db.serialize;
		if (typeof e != "function") throw Error("brdb: toBytes requires a better-sqlite3 database handle");
		return new Uint8Array(e.call(this.db));
	}
	save(e, t, n = {}) {
		this.writePending(e, t instanceof bs ? t.toPendingFs(n) : fs(t, n), n);
	}
	worldReader() {
		return new Es(this);
	}
	sqliteSchema() {
		return this.db.prepare("SELECT sql FROM sqlite_schema").all().map((e) => e.sql).join("\n");
	}
	createRevision(e, t = js()) {
		return Number(this.db.prepare("INSERT INTO revisions (description, created_at) VALUES (?, ?);").run(e, t).lastInsertRowid);
	}
	revisions() {
		return this.db.prepare("SELECT revision_id, description, created_at FROM revisions ORDER BY revision_id;").all().map((e) => ({
			revisionId: Number(e.revision_id),
			description: String(e.description),
			createdAt: Number(e.created_at)
		}));
	}
	insertFolder(e, t, n) {
		return Number(this.db.prepare("INSERT INTO folders (name, parent_id, created_at) VALUES (?, ?, ?);").run(e, t, n).lastInsertRowid);
	}
	insertFile(e, t, n, r) {
		return Number(this.db.prepare("INSERT INTO files (name, parent_id, content_id, created_at) VALUES (?, ?, ?, ?);").run(e, t, n, r).lastInsertRowid);
	}
	insertBlob(e, t, n) {
		let r = this.findBlobByHash(e.length, t);
		if (r) return r.blobId;
		let i = e.length, a = i, o = 0, s = e, c = n ? n(e) : null;
		return c && c.length < i && (a = c.length, o = 1, s = c), Number(this.db.prepare("INSERT INTO blobs (compression, size_uncompressed, size_compressed, delta_base_id, hash, content) VALUES (?, ?, ?, ?, ?, ?);").run(o, i, a, null, Ms(t), Ms(s)).lastInsertRowid);
	}
	findBlobByHash(e, t) {
		let n = this.db.prepare("SELECT blob_id, compression, size_uncompressed, size_compressed, delta_base_id, hash, content FROM blobs WHERE hash = ? AND size_uncompressed = ? LIMIT 1;").get(Ms(t), e);
		return n ? zs(n) : null;
	}
	findBlob(e) {
		let t = this.db.prepare("SELECT blob_id, compression, size_uncompressed, size_compressed, delta_base_id, hash, content FROM blobs WHERE blob_id = ?;").get(e);
		if (!t) throw Error(`brdb: blob ${e} not found`);
		return zs(t);
	}
	deleteFile(e, t) {
		this.db.prepare("UPDATE files SET deleted_at = ? WHERE file_id = ?;").run(t, e);
	}
	deleteFolder(e, t) {
		this.db.prepare("UPDATE folders SET deleted_at = ? WHERE folder_id = ?;").run(t, e);
	}
	findFolder(e, t) {
		let n = this.db.prepare(`SELECT folder_id FROM folders WHERE parent_id ${e === null ? "IS NULL" : "= ?"} AND name = ? AND deleted_at IS NULL;`).get(...e === null ? [t] : [e, t]);
		return n ? Number(n.folder_id) : null;
	}
	findFolderAtRevision(e, t, n) {
		let r = this.db.prepare(`SELECT folder_id FROM folders WHERE parent_id ${e === null ? "IS NULL" : "= ?"} AND name = ? AND created_at <= ? AND (deleted_at IS NULL OR deleted_at > ?) ORDER BY created_at ASC LIMIT 1;`).get(...e === null ? [
			t,
			n,
			n
		] : [
			e,
			t,
			n,
			n
		]);
		return r ? Number(r.folder_id) : null;
	}
	findFile(e, t) {
		let n = this.db.prepare(`SELECT content_id, created_at FROM files WHERE parent_id ${e === null ? "IS NULL" : "= ?"} AND name = ? AND deleted_at IS NULL;`).get(...e === null ? [t] : [e, t]);
		return n ? Bs(n) : null;
	}
	findFileAtRevision(e, t, n) {
		let r = this.db.prepare(`SELECT content_id, created_at FROM files WHERE parent_id ${e === null ? "IS NULL" : "= ?"} AND name = ? AND created_at <= ? AND (deleted_at IS NULL OR deleted_at > ?) ORDER BY created_at ASC LIMIT 1;`).get(...e === null ? [
			t,
			n,
			n
		] : [
			e,
			t,
			n,
			n
		]);
		return r ? Bs(r) : null;
	}
	close() {
		this.db.close();
	}
	writePending(e, t, n = {}) {
		let r = n.createdAt ?? js(), i = n.compress === void 0 ? this.defaultCompress : n.compress;
		this.db.exec("BEGIN");
		try {
			this.createRevision(e, r), this.mergeFolder(null, t, r, i), this.db.exec("COMMIT");
		} catch (e) {
			try {
				this.db.exec("ROLLBACK");
			} catch {}
			throw e;
		}
	}
	currentFolders(e) {
		let t = this.db.prepare(`SELECT folder_id, name FROM folders WHERE parent_id ${e === null ? "IS NULL" : "= ?"} AND deleted_at IS NULL ORDER BY name;`);
		return (e === null ? t.all() : t.all(e)).map((e) => ({
			folderId: Number(e.folder_id),
			name: String(e.name)
		}));
	}
	currentFiles(e) {
		let t = this.db.prepare(`SELECT file_id, name, content_id FROM files WHERE parent_id ${e === null ? "IS NULL" : "= ?"} AND deleted_at IS NULL ORDER BY name;`);
		return (e === null ? t.all() : t.all(e)).map((e) => ({
			fileId: Number(e.file_id),
			name: String(e.name),
			contentId: e.content_id === null ? null : Number(e.content_id)
		}));
	}
	mergeFolder(e, t, n, r) {
		let i = new Map(this.currentFolders(e).map((e) => [e.name, e.folderId])), a = new Map(this.currentFiles(e).map((e) => [e.name, e])), o = /* @__PURE__ */ new Set();
		for (let [s, c] of t) {
			if (o.has(s)) throw Error(`brdb: duplicate name '${s}' in pending tree`);
			if (o.add(s), c.type === "folder") {
				if (a.has(s)) throw Error(`brdb: pending folder '${s}' collides with an existing file`);
				let t = i.get(s);
				t === void 0 ? this.insertPending(s, e, c, n, r) : this.mergeFolder(t, c.children, n, r);
			} else {
				if (i.has(s)) throw Error(`brdb: pending file '${s}' collides with an existing folder`);
				let t = a.get(s);
				if (t === void 0) {
					this.insertPending(s, e, c, n, r);
					continue;
				}
				let o = gi(c.content), l = this.findBlobByHash(c.content.length, o);
				if (l && t.contentId === l.blobId) continue;
				this.deleteFile(t.fileId, n);
				let u = this.insertBlob(c.content, o, r);
				this.insertFile(s, e, u, n);
			}
		}
		for (let [e, t] of i) o.has(e) || this.deleteFolderRecursive(t, n);
		for (let [e, t] of a) o.has(e) || this.deleteFile(t.fileId, n);
	}
	insertPending(e, t, n, r, i) {
		if (n.type === "folder") {
			let a = this.insertFolder(e, t, r), o = /* @__PURE__ */ new Set();
			for (let [e, t] of n.children) {
				if (o.has(e)) throw Error(`brdb: duplicate name '${e}' in pending tree`);
				o.add(e), this.insertPending(e, a, t, r, i);
			}
		} else {
			let a = this.insertBlob(n.content, gi(n.content), i);
			this.insertFile(e, t, a, r);
		}
	}
	deleteFolderRecursive(e, t) {
		this.deleteFolder(e, t);
		for (let n of this.currentFolders(e)) this.deleteFolderRecursive(n.folderId, t);
		for (let n of this.currentFiles(e)) this.deleteFile(n.fileId, t);
	}
	folderIdOf(e, t) {
		if (e === "") return null;
		let n = null;
		for (let r of e.split("/")) {
			let e = t === void 0 ? this.findFolder(n, r) : this.findFolderAtRevision(n, r, t) ?? this.findFolder(n, r);
			if (e === null) return null;
			n = e;
		}
		return n;
	}
	findFileByPath(e) {
		if (e.startsWith("/")) throw Error("brdb: absolute paths not allowed");
		let t = e.lastIndexOf("/"), n = t === -1 ? "" : e.slice(0, t), r = this.folderIdOf(n);
		return n !== "" && r === null ? null : this.findFile(r, e.slice(t + 1));
	}
	findFileByPathAtRevision(e, t) {
		if (e.startsWith("/")) throw Error("brdb: absolute paths not allowed");
		let n = e.lastIndexOf("/"), r = n === -1 ? "" : e.slice(0, n), i = this.folderIdOf(r, t);
		return r !== "" && i === null ? null : this.findFileAtRevision(i, e.slice(n + 1), t);
	}
	childFolders(e) {
		let t = this.folderIdOf(e);
		return e !== "" && t === null ? [] : this.currentFolders(t).map((e) => e.name);
	}
	childFiles(e) {
		let t = this.folderIdOf(e);
		return e !== "" && t === null ? [] : this.currentFiles(t).map((e) => e.name);
	}
	readBlob(e) {
		if (e === -1) return /* @__PURE__ */ new Uint8Array();
		let t = this.findBlob(e);
		if (t.deltaBaseId !== null) throw Error("brdb: delta blobs are not supported");
		let n = t.content;
		if (t.compression === 1) n = Gi(n, new Uint8Array(t.sizeUncompressed));
		else if (t.compression !== 0) throw Error(`brdb: unknown blob compression ${t.compression}`);
		if (n.length !== t.sizeUncompressed) throw Error("brdb: blob uncompressed size mismatch");
		return n;
	}
	readFile(e) {
		let t = this.findFileByPath(e);
		if (!t) throw Error(`brdb: file not found: ${e}`);
		return this.readBlob(t.contentId);
	}
	toPending() {
		let e = (t) => {
			let n = [];
			for (let r of this.currentFolders(t)) n.push([r.name, {
				type: "folder",
				children: e(r.folderId)
			}]);
			for (let e of this.currentFiles(t)) n.push([e.name, {
				type: "file",
				content: this.readBlob(e.contentId ?? -1)
			}]);
			return n;
		};
		return e(null);
	}
};
Ds = Rs, Ds.engineLoader = null;
var zs = (e) => ({
	blobId: Number(e.blob_id),
	compression: Number(e.compression),
	sizeUncompressed: Number(e.size_uncompressed),
	sizeCompressed: Number(e.size_compressed),
	deltaBaseId: e.delta_base_id === null ? null : Number(e.delta_base_id),
	hash: new Uint8Array(e.hash),
	content: new Uint8Array(e.content)
}), Bs = (e) => ({
	contentId: e.content_id === null ? -1 : Number(e.content_id),
	createdAt: Number(e.created_at)
}), Vs = /* @__PURE__ */ t({
	BASIC_BRICK_ASSETS: () => Qi,
	BRDB_SQLITE_SCHEMA: () => ks,
	BRICK_ASSETS: () => ea,
	BitFlags: () => vi,
	Brdb: () => Rs,
	BrdbSchema: () => oo,
	BrzReader: () => Xi,
	ByteReader: () => qi,
	ByteWriter: () => Ki,
	CHUNK_HALF: () => rs,
	CHUNK_SIZE: () => ns,
	COMPONENTS: () => la,
	COMPONENT_STRUCT_DEFAULTS: () => aa,
	COMPONENT_TYPE_STRUCTS: () => ia,
	COMPONENT_WIRE_PORTS: () => ca,
	ENTITY_TYPE_STRUCTS: () => sa,
	MAIN_GRID: () => 1,
	PROCEDURAL_BRICK_ASSETS: () => $i,
	PUBLIC_GUID: () => fa,
	WIRE_PORT_NAMES: () => oa,
	World: () => bs,
	WorldReader: () => Es,
	bit: () => _i,
	embeddedSchema: () => lo,
	file: () => q,
	folder: () => ha,
	guidToUuid: () => ma,
	isProceduralAsset: () => ra,
	msgpack: () => ga,
	saveToPendingFs: () => fs,
	toRelative: () => os,
	uuidToGuid: () => pa,
	writeBrzContainer: () => Yi,
	writeBrzLegacy: () => xs
}), Hs = {
	read: Mr,
	write: Fr,
	utils: rr,
	constants: n,
	types: Ir,
	brdb: Vs
};
typeof window < "u" && (window.BRS = Hs);
//#endregion
export { Rs as Brdb, Lr as Direction, Rr as Rotation, bs as World, Es as WorldReader, Vs as brdb, n as constants, Hs as default, Mr as read, Ir as types, rr as utils, Fr as write, xs as writeBrzLegacy };

//# sourceMappingURL=dist.mjs.map