// node --test tools/chat/chat.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
process.argv[2] = 'test'; // load chat.mjs without running a command
const { colour, tag, compact, safe } = await import('./chat.mjs');

test('usage colours by how full the limit is', () => {
  assert.equal(colour(10), '55dd55');
  assert.equal(colour(50), 'eedd33');
  assert.equal(colour(75), 'ff9933');
  assert.equal(colour(90), 'ff4444');
});
test('tag shows both limits, marks stale usage with ~', () => {
  const now = Date.now();
  assert.equal(tag({ h5: 38, wk: 62, at: now }, now), '[claude <color="55dd55">5h 38%</> <color="eedd33">wk 62%</>]');
  assert.match(tag({ h5: 38, wk: 62, at: now - 3600e3 }, now), /5h ~38%/);
});
test('compact keeps players and Discord, drops Claude and the !ai bot', () => {
  assert.equal(compact('x LogChat: [SenderId: 1-2] Kraken: claude hi'), 'Kraken: claude hi');
  assert.equal(compact('x LogChat: [Discord] pizza: hey claude'), '[Discord] pizza: hey claude');
  assert.equal(compact('x LogChat: [claude 5h 1%] me'), null);
  assert.equal(compact('x LogChat: [AI][#9]: claude are you there'), null);
});
test('chat text is escaped for the game', () => {
  assert.equal(safe('a <b> "c"'), 'a &lt;b&gt; \\"c\\"');
});
