// tts.ws -- /tts <text>: spawns a voice (voice.ws + 16 harmonic sine speakers + noise) at your head and tells it what to
// say; it follows you while talking, then vanishes. /ttsvol <0-3> sets loudness for later lines.

@invisible

var vol: float = 1.0

on ChatCommand("tts", "Say something out loud") -> (ctrl, args) {
  let aim = ctrl.CharacterOf().GetAim()
  let e = SpawnPrefab(prefab = $./voice.brz, lifetime = 0.0, limit = 8)
  e.SetLocation(aim.Origin)
  e.SetFrozen(true)
  SendGlobalCustomEvent("tts.say", ctrl, args, vol, target = e)
  PrintToConsole("ttsdbg|cmd|" .. args)
}

on ChatCommand("ttsvol", "TTS loudness 0-3") -> (ctrl, args) {
  vol = clamp(args.ParseNumber(), 0.0, 3.0)
  ctrl.ShowStatusMessage(Fmt("TTS loudness {A:.1}. Your neighbours have been notified, emotionally.", vol))
}
