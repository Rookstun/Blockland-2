// media clock probe (2026-10-13): merged hidden next to each /playvideo chunk's chip, so it
// starts on the same tick; once a second of GAME time it logs "mediaclip <seconds> <x> <y> <z>"
// (PrintToConsole -> [Wire Graph] line -> Omegga event wirecmd:mediaclip). Build: see probe_build.mjs
var n = 0
on Clock(interval = 1.0) {
  n = n + 1
  let p = GetOwnTransform().Location
  PrintToConsole("mediaclip ${n} ${p.X} ${p.Y} ${p.Z}")
}
