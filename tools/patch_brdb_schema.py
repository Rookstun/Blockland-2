# EA3.2 (CL16230) .brdb schemas: header is a msgpack map of named sections
# ({"enums"?, "variants"?, "structs"}) instead of [enums, variants?, structs].
# Patches minified brs.mjs bundles in place (idempotent).
import re, sys
OLD = re.compile(r'let n = new (\w+)\(t\), r = (\w+)\(n\);\n(\t+)if \(r !== 2 && r !== 3\) throw Error\(`brdb: invalid schema header length \$\{r\}`\);')
for path in sys.argv[1:]:
    s = open(path, encoding='utf-8').read()
    if 'EA3.2 named schema sections' in s: print(path, 'already'); continue
    m = OLD.search(s)
    if not m: print(path, 'NO MATCH'); continue
    rd, arr, ind = m.group(1), m.group(2), m.group(3)
    # pull the other helper names from the old-format body that follows
    body = s[m.end():m.end()+1200]
    mapl = re.search(r't = (\w+)\(n\); e < t', body).group(1)
    st = re.search(r'let e = (\w+)\(n\), t = ', body).group(1)
    it = re.search(r't\.set\(\w+\(n\), (\w+)\(n\)\)', body).group(1)
    pd = re.search(r't\.set\(\w+\(n\), (\w+)\(n\)\);\n\t+o\.set', body).group(1)
    new = (f'let n = new {rd}(t), r = (n.peek() & 240) == 128 ? -1 : {arr}(n);\n'
      f'{ind}if (r === -1) {{ /* EA3.2 named schema sections */\n'
      f'{ind}\tlet i = new Map(), a = new Map(), o = new Map();\n'
      f'{ind}\tfor (let k = 0, K = {mapl}(n); k < K; k++) {{\n'
      f'{ind}\t\tlet s = {st}(n);\n'
      f'{ind}\t\tif (s === "enums") for (let e = 0, t = {mapl}(n); e < t; e++) {{ let e = {st}(n), t = new Map(); for (let e = 0, r = {mapl}(n); e < r; e++) t.set({st}(n), {it}(n)); i.set(e, t); }}\n'
      f'{ind}\t\telse if (s === "variants") for (let e = 0, t = {mapl}(n); e < t; e++) {{ let e = {st}(n), t = []; for (let e = 0, r = {arr}(n); e < r; e++) t.push({st}(n)); a.set(e, t); }}\n'
      f'{ind}\t\telse if (s === "structs") for (let e = 0, t = {mapl}(n); e < t; e++) {{ let e = {st}(n), t = new Map(); for (let e = 0, r = {mapl}(n); e < r; e++) t.set({st}(n), {pd}(n)); o.set(e, t); }}\n'
      f'{ind}\t\telse if (s === "types") for (let e = 0, t = {arr}(n); e < t; e++) {st}(n);\n'
      f'{ind}\t\telse throw Error(`brdb: unknown schema section ${{s}}`);\n'
      f'{ind}\t}}\n'
      f'{ind}\tif (n.remaining !== 0) throw Error(`brdb: ${{n.remaining}} trailing bytes after schema`);\n'
      f'{ind}\treturn new e(i, a, o);\n'
      f'{ind}}}\n'
      f'{ind}if (r !== 2 && r !== 3) throw Error(`brdb: invalid schema header length ${{r}}`);')
    s = s[:m.start()] + new + s[m.end():]
    open(path, 'w', encoding='utf-8', newline='').write(s)
    print(path, 'patched', rd, arr, mapl, st, it, pd)
