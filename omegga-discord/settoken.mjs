// Server side: reads the bot token from stdin, writes the discord plugin config
// (keeps the channel), reloads the plugin. Used by settoken.ps1 on the PC.
import { execFileSync } from 'node:child_process';
let token = '';
for await (const c of process.stdin) token += c;
token = token.trim();
if (!token) throw new Error('no token');
const cfg = { token, channel: '1562884729882288158', webhook: '', joins: true, 'skip-commands': false };
const node = process.execPath;
const dir = `${process.env.HOME}/omegga-server`;
execFileSync(node, ['bridge/tools/rpc.mjs', 'plugin.config', 'discord', JSON.stringify(cfg)], { cwd: dir, stdio: 'ignore' });
execFileSync(node, ['bridge/tools/reload.mjs', 'discord'], { cwd: dir, stdio: 'ignore' });
console.log('token set, discord plugin reloaded');
