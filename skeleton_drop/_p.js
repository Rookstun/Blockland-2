const fs = require('fs');
let s = fs.readFileSync(__dirname + '/gen.js', 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 50)); s = s.replace(a, b); };
rep(`// XP must be one of ORBS (= coingen.mjs XP_ORBS): a blue orb spawned on the
// killer adds it to their "XP" leaderboard value; the levels plugin does the rest.`,
`// XP goes straight onto the killer's "XP" leaderboard value; their "Level" is
// floor(sqrt(XP / XP_SCALE)) + 1 (L2 at 25 XP, L5 at 400, L10 at 2025).`);
rep(`const ORBS = [5, 8, 12, 18, 25, 35, 50];`, `const XP_SCALE = 25;`);
rep(`const orbs = ORBS.map((n, i) => \`    \${i ? '} else if' : 'if'} xp == \${n} {
      SpawnPrefab(prefab = $./xp\${n}.brz, offset = kat, lifetime = 0.0, limit = 200)
\`).join('') + '    }\n';
`, `const xpBlock = \`    // XP and level for the killer
    let kc = killer.ControllerOf()
    kc.IncLeaderboard("XP", xp)
    let total = kc.GetLeaderboard("XP")
    let lvl = floor(sqrt(total / \${XP_SCALE}.0)) + 1
    kc.ShowStatusMessage("+\\${xp} XP")
    if lvl > kc.GetLeaderboard("Level") {
      kc.SetLeaderboard("Level", lvl)
      kc.ShowStatusMessage("LEVEL UP! You are level \\${lvl}")
      kc.ShowChatMessage("<color=\\\\"46aaff\\\\"><b>Level up!</> You reached level \\${lvl}. /level shows your progress.</>")
    }
\`;
`);
rep(`// (+25) "coins" by its odds; a blue orb on the killer adds its XP to "XP":`, `// (+25) "coins" by its odds; the killer gets the XP on the leaderboard:`);
rep("${Array.from({ length: MAX }, (_, i) => slot(i + 1)).join('')}    // XP orb right on the killer, so they pick it up at once\n    let kat = killer.GetLocation() - GetOwnTransform().Location\n${orbs}    emit Died",
    "${Array.from({ length: MAX }, (_, i) => slot(i + 1)).join('')}${xpBlock}    emit Died");
rep("    emit Died\n  }\n}\n`;", `    emit Died
  }
}

on ChatCommand("level", "Your level and XP") -> (ctrl, args) {
  let total = ctrl.GetLeaderboard("XP")
  let lvl = floor(sqrt(total / \${XP_SCALE}.0)) + 1
  let next = \${XP_SCALE} * lvl * lvl
  ctrl.ShowChatMessage("<color=\\\\"46aaff\\\\"><b>Level \\${lvl}</></> - \\${total} XP. Level \\${lvl + 1} at \\${next} XP. Kill skeletons for XP (tougher ones give more).")
}
\`;`);
fs.writeFileSync(__dirname + '/gen.js', s);
let b = fs.readFileSync(__dirname + '/build.mjs', 'utf8');
b = b.replace("for (const c of ['coin1', 'coin10', 'coin25', ...[5, 8, 12, 18, 25, 35, 50].map(n => `xp${n}`)])", "for (const c of ['coin1', 'coin10', 'coin25'])");
fs.writeFileSync(__dirname + '/build.mjs', b);
