// node nes/serve.mjs [port] : static server for nes/web (modules need http, not file://). Open http://localhost:8793/web/
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
const root = import.meta.dirname, T = { '.html': 'text/html', '.mjs': 'text/javascript' };
createServer((q, r) => {
  try { const p = join(root, normalize(q.url.split('?')[0]).replace(/^([/\])+/, '')); r.setHeader('content-type', T[extname(p)] || 'text/plain'); r.end(readFileSync(p)); }
  catch { r.statusCode = 404; r.end('no'); }
}).listen(+process.argv[2] || 8793, () => console.log('http://localhost:' + (+process.argv[2] || 8793) + '/web/index.html'));
