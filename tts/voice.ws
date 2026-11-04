// voice.ws -- one spoken line (owner 2026-10-07: "an actual tts system inside brickadia using the tweening of pitched
// 440 hz waves"). tts.ws spawns this prefab at the speaker's head per /tts and sends tts.say; it follows their head while
// talking (speaker range is short: a fixed chip far away was silent), then deletes itself.
//
// Spelling -> phonemes (rules below) -> F1-F3 formant targets, tweened every 26 ms. The sound is additive: 16 sines at
// harmonics of a 110 Hz voice (P1..P16), each as loud as the formant envelope there (V1..V16), + noise (PN/VN) for
// s/sh/f/h and stop bursts. build.mjs adds the speakers (Wirescript has no speaker bricks) and wires them to the outs.

// ------------------------------------------------------------ phonemes --
// 0 pause | vowels 1 IY 2 IH 3 EH 4 AE 5 AA 6 AO 7 UH 8 UW 9 AH 10 ER 11 AX 12 E(ey) 13 O(ow)
// 14 L 15 R 16 W 17 Y | nasals 18 M 19 N 20 NG | stops 21 P 22 B 23 T 24 D 25 K 26 G
// fricatives 27 S 28 Z 29 SH 30 ZH 31 F 32 V 33 TH 34 DH 35 H | 36 burst
var F1: int[] = [500, 270, 390, 530, 660, 730, 570, 440, 300, 640, 490, 500, 480, 500, 360, 420, 300, 280, 280, 280, 280,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
var F2: int[] = [1500, 2290, 1990, 1840, 1720, 1090, 840, 1020, 870, 1190, 1350, 1500, 1900, 900, 1300, 1250, 650, 2200, 1100, 1600, 2000,
  800, 800, 1800, 1800, 2300, 2300, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
var F3: int[] = [2500, 3010, 2550, 2480, 2410, 2440, 2410, 2240, 2240, 2390, 1690, 2500, 2500, 2400, 2700, 1600, 2200, 3000, 2200, 2600, 2600,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
// tone level (x100), noise level (x100), noise pitch (x100), length (20 ms ticks)
var AMP: int[] = [0, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 90, 100, 100, 70, 70, 60, 60, 35, 35, 35,
  0, 12, 0, 12, 0, 12, 0, 25, 0, 25, 0, 20, 0, 15, 0, 10]
var NOI: int[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 45, 30, 40, 28, 15, 10, 12, 8, 12, 35]
var NP: int[] = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100,
  100, 100, 100, 100, 100, 100, 180, 180, 90, 90, 100, 100, 100, 100, 70, 120]
var DUR: int[] = [3, 6, 5, 5, 6, 7, 7, 5, 6, 5, 6, 4, 5, 5, 4, 4, 4, 4, 4, 4, 4,
  3, 3, 3, 3, 3, 3, 5, 5, 5, 5, 5, 4, 5, 4, 3, 1]

// ------------------------------------------------------------- outputs --
var c1: float = 500.0
var c2: float = 1500.0
var c3: float = 2500.0
var lev: float = 0.0
var nlev: float = 0.0
var npit: float = 1.0
var vol: float = 1.0
var f0: float = 110.0
// Additive voice (2026-11-04: 3 bare formant sines were unreadable, whisper heard "beep beep"): 16 sines at harmonics
// h*f0 of a 110 Hz voice, each as loud as the formant envelope (F1-F3 resonances) at that frequency. The synths' pitch
// caps at x4 (1760 Hz) = harmonic 16, so the whole spectrum is scaled by K = 0.72 (envelope read at h*f0/K).
out P1: float = f0 * 1.0 / 440.0
out V1: float = lev * vol * 0.4 * (1.0 / (1.0 + ((f0 * 1.0 / 0.72) - c1) * ((f0 * 1.0 / 0.72) - c1) / 8100.0) + 0.6 / (1.0 + ((f0 * 1.0 / 0.72) - c2) * ((f0 * 1.0 / 0.72) - c2) / 12100.0) + 0.3 / (1.0 + ((f0 * 1.0 / 0.72) - c3) * ((f0 * 1.0 / 0.72) - c3) / 28900.0))
out P2: float = f0 * 2.0 / 440.0
out V2: float = lev * vol * 0.4 * (1.0 / (1.0 + ((f0 * 2.0 / 0.72) - c1) * ((f0 * 2.0 / 0.72) - c1) / 8100.0) + 0.6 / (1.0 + ((f0 * 2.0 / 0.72) - c2) * ((f0 * 2.0 / 0.72) - c2) / 12100.0) + 0.3 / (1.0 + ((f0 * 2.0 / 0.72) - c3) * ((f0 * 2.0 / 0.72) - c3) / 28900.0))
out P3: float = f0 * 3.0 / 440.0
out V3: float = lev * vol * 0.4 * (1.0 / (1.0 + ((f0 * 3.0 / 0.72) - c1) * ((f0 * 3.0 / 0.72) - c1) / 8100.0) + 0.6 / (1.0 + ((f0 * 3.0 / 0.72) - c2) * ((f0 * 3.0 / 0.72) - c2) / 12100.0) + 0.3 / (1.0 + ((f0 * 3.0 / 0.72) - c3) * ((f0 * 3.0 / 0.72) - c3) / 28900.0))
out P4: float = f0 * 4.0 / 440.0
out V4: float = lev * vol * 0.4 * (1.0 / (1.0 + ((f0 * 4.0 / 0.72) - c1) * ((f0 * 4.0 / 0.72) - c1) / 8100.0) + 0.6 / (1.0 + ((f0 * 4.0 / 0.72) - c2) * ((f0 * 4.0 / 0.72) - c2) / 12100.0) + 0.3 / (1.0 + ((f0 * 4.0 / 0.72) - c3) * ((f0 * 4.0 / 0.72) - c3) / 28900.0))
out P5: float = f0 * 5.0 / 440.0
out V5: float = lev * vol * 0.4 * (1.0 / (1.0 + ((f0 * 5.0 / 0.72) - c1) * ((f0 * 5.0 / 0.72) - c1) / 8100.0) + 0.6 / (1.0 + ((f0 * 5.0 / 0.72) - c2) * ((f0 * 5.0 / 0.72) - c2) / 12100.0) + 0.3 / (1.0 + ((f0 * 5.0 / 0.72) - c3) * ((f0 * 5.0 / 0.72) - c3) / 28900.0))
out P6: float = f0 * 6.0 / 440.0
out V6: float = lev * vol * 0.4 * (1.0 / (1.0 + ((f0 * 6.0 / 0.72) - c1) * ((f0 * 6.0 / 0.72) - c1) / 8100.0) + 0.6 / (1.0 + ((f0 * 6.0 / 0.72) - c2) * ((f0 * 6.0 / 0.72) - c2) / 12100.0) + 0.3 / (1.0 + ((f0 * 6.0 / 0.72) - c3) * ((f0 * 6.0 / 0.72) - c3) / 28900.0))
out P7: float = f0 * 7.0 / 440.0
out V7: float = lev * vol * 0.4 * (1.0 / (1.0 + ((f0 * 7.0 / 0.72) - c1) * ((f0 * 7.0 / 0.72) - c1) / 8100.0) + 0.6 / (1.0 + ((f0 * 7.0 / 0.72) - c2) * ((f0 * 7.0 / 0.72) - c2) / 12100.0) + 0.3 / (1.0 + ((f0 * 7.0 / 0.72) - c3) * ((f0 * 7.0 / 0.72) - c3) / 28900.0))
out P8: float = f0 * 8.0 / 440.0
out V8: float = lev * vol * 0.4 * (1.0 / (1.0 + ((f0 * 8.0 / 0.72) - c1) * ((f0 * 8.0 / 0.72) - c1) / 8100.0) + 0.6 / (1.0 + ((f0 * 8.0 / 0.72) - c2) * ((f0 * 8.0 / 0.72) - c2) / 12100.0) + 0.3 / (1.0 + ((f0 * 8.0 / 0.72) - c3) * ((f0 * 8.0 / 0.72) - c3) / 28900.0))
out P9: float = f0 * 9.0 / 440.0
out V9: float = lev * vol * 0.4 * (1.0 / (1.0 + ((f0 * 9.0 / 0.72) - c1) * ((f0 * 9.0 / 0.72) - c1) / 8100.0) + 0.6 / (1.0 + ((f0 * 9.0 / 0.72) - c2) * ((f0 * 9.0 / 0.72) - c2) / 12100.0) + 0.3 / (1.0 + ((f0 * 9.0 / 0.72) - c3) * ((f0 * 9.0 / 0.72) - c3) / 28900.0))
out P10: float = f0 * 10.0 / 440.0
out V10: float = lev * vol * 0.4 * (1.0 / (1.0 + ((f0 * 10.0 / 0.72) - c1) * ((f0 * 10.0 / 0.72) - c1) / 8100.0) + 0.6 / (1.0 + ((f0 * 10.0 / 0.72) - c2) * ((f0 * 10.0 / 0.72) - c2) / 12100.0) + 0.3 / (1.0 + ((f0 * 10.0 / 0.72) - c3) * ((f0 * 10.0 / 0.72) - c3) / 28900.0))
out P11: float = f0 * 11.0 / 440.0
out V11: float = lev * vol * 0.4 * (1.0 / (1.0 + ((f0 * 11.0 / 0.72) - c1) * ((f0 * 11.0 / 0.72) - c1) / 8100.0) + 0.6 / (1.0 + ((f0 * 11.0 / 0.72) - c2) * ((f0 * 11.0 / 0.72) - c2) / 12100.0) + 0.3 / (1.0 + ((f0 * 11.0 / 0.72) - c3) * ((f0 * 11.0 / 0.72) - c3) / 28900.0))
out P12: float = f0 * 12.0 / 440.0
out V12: float = lev * vol * 0.4 * (1.0 / (1.0 + ((f0 * 12.0 / 0.72) - c1) * ((f0 * 12.0 / 0.72) - c1) / 8100.0) + 0.6 / (1.0 + ((f0 * 12.0 / 0.72) - c2) * ((f0 * 12.0 / 0.72) - c2) / 12100.0) + 0.3 / (1.0 + ((f0 * 12.0 / 0.72) - c3) * ((f0 * 12.0 / 0.72) - c3) / 28900.0))
out P13: float = f0 * 13.0 / 440.0
out V13: float = lev * vol * 0.4 * (1.0 / (1.0 + ((f0 * 13.0 / 0.72) - c1) * ((f0 * 13.0 / 0.72) - c1) / 8100.0) + 0.6 / (1.0 + ((f0 * 13.0 / 0.72) - c2) * ((f0 * 13.0 / 0.72) - c2) / 12100.0) + 0.3 / (1.0 + ((f0 * 13.0 / 0.72) - c3) * ((f0 * 13.0 / 0.72) - c3) / 28900.0))
out P14: float = f0 * 14.0 / 440.0
out V14: float = lev * vol * 0.4 * (1.0 / (1.0 + ((f0 * 14.0 / 0.72) - c1) * ((f0 * 14.0 / 0.72) - c1) / 8100.0) + 0.6 / (1.0 + ((f0 * 14.0 / 0.72) - c2) * ((f0 * 14.0 / 0.72) - c2) / 12100.0) + 0.3 / (1.0 + ((f0 * 14.0 / 0.72) - c3) * ((f0 * 14.0 / 0.72) - c3) / 28900.0))
out P15: float = f0 * 15.0 / 440.0
out V15: float = lev * vol * 0.4 * (1.0 / (1.0 + ((f0 * 15.0 / 0.72) - c1) * ((f0 * 15.0 / 0.72) - c1) / 8100.0) + 0.6 / (1.0 + ((f0 * 15.0 / 0.72) - c2) * ((f0 * 15.0 / 0.72) - c2) / 12100.0) + 0.3 / (1.0 + ((f0 * 15.0 / 0.72) - c3) * ((f0 * 15.0 / 0.72) - c3) / 28900.0))
out P16: float = f0 * 16.0 / 440.0
out V16: float = lev * vol * 0.4 * (1.0 / (1.0 + ((f0 * 16.0 / 0.72) - c1) * ((f0 * 16.0 / 0.72) - c1) / 8100.0) + 0.6 / (1.0 + ((f0 * 16.0 / 0.72) - c2) * ((f0 * 16.0 / 0.72) - c2) / 12100.0) + 0.3 / (1.0 + ((f0 * 16.0 / 0.72) - c3) * ((f0 * 16.0 / 0.72) - c3) / 28900.0))
out PN: float = npit
out VN: float = nlev * vol

// ------------------------------------------------------------- reader --
var text: string = ""
var pos: int = 0
var talking: bool = false
var who: controller
var seg: int = 0          // current phoneme
var left: int = 0         // ticks left in it
var q1: int = -1          // queued phonemes (diphthongs, x, stop bursts)
var q2: int = -1
var vowelSeen: bool = false
var t1: float = 500.0
var t2: float = 1500.0
var t3: float = 2500.0

mod isLetter(s: string) -> bool {
  return s.Length() == 1 && "ABCDEFGHIJKLMNOPQRSTUVWXYZ".Contains(s)
}
mod isVowel(s: string) -> bool {
  return s.Length() == 1 && "AEIOU".Contains(s)
}

// spelling -> the next phoneme (and up to two queued after it)
mod parse() -> int {
  let c = text.Substring(pos, 1)
  let n = text.Substring(pos + 1, 1)
  let n2 = text.Substring(pos + 2, 1)
  let n3 = text.Substring(pos + 3, 1)
  let two = "${c}${n}"
  var p: int = 0
  var step: int = 1
  if !isLetter(c) {
    vowelSeen = false
    p = 0
    if c == "," || c == "." || c == "!" || c == "?" { q1 = 0; q2 = 0 }
  } else if two == "TH" { p = 33; step = 2
  } else if two == "SH" { p = 29; step = 2
  } else if two == "CH" { p = 23; q1 = 29; step = 2
  } else if two == "PH" { p = 31; step = 2
  } else if two == "WH" { p = 16; step = 2
  } else if two == "CK" { p = 25; step = 2
  } else if two == "NG" { p = 20; step = 2
  } else if two == "QU" { p = 25; q1 = 16; step = 2
  } else if two == "EE" || two == "EA" { p = 1; step = 2; vowelSeen = true
  } else if two == "OO" { p = 8; step = 2; vowelSeen = true
  } else if two == "OU" && !isLetter(n2) { p = 8; step = 2; vowelSeen = true   // you, thou: OO, not OW
  } else if two == "OU" || two == "OW" { p = 5; q1 = 7; step = 2; vowelSeen = true
  } else if two == "AI" || two == "AY" { p = 12; q1 = 2; step = 2; vowelSeen = true
  } else if two == "OA" { p = 13; q1 = 7; step = 2; vowelSeen = true
  } else if two == "OI" || two == "OY" { p = 6; q1 = 2; step = 2; vowelSeen = true
  } else if two == "AU" || two == "AW" { p = 6; step = 2; vowelSeen = true
  } else if two == "ER" || two == "IR" || two == "UR" { p = 10; step = 2; vowelSeen = true
  } else if two == "AR" { p = 5; q1 = 15; step = 2; vowelSeen = true
  } else if two == "OR" { p = 6; q1 = 15; step = 2; vowelSeen = true
  } else if isVowel(c) {
    // a vowel, consonant, E, end of word: the long vowel (magic E)
    let magic = isLetter(n) && !isVowel(n) && n2 == "E" && !isLetter(n3)
    // a final E after a vowel earlier in the word is silent
    if c == "E" && !isLetter(n) && vowelSeen {
      p = -1
    } else if magic {
      if c == "A" { p = 12; q1 = 2 }
      if c == "E" { p = 1 }
      if c == "I" { p = 4; q1 = 2 }
      if c == "O" { p = 13; q1 = 7 }
      if c == "U" { p = 17; q1 = 8 }
    } else if !isLetter(n) && (c == "E" || c == "O") {
      // he, she, me, go, no: long at the end of a short word
      if c == "E" { p = 1 } else { p = 13; q1 = 7 }
    } else {
      if c == "A" { p = 4 }
      if c == "E" { p = 3 }
      if c == "I" { p = 2 }
      if c == "O" { p = 5 }
      if c == "U" { p = 9 }
    }
    vowelSeen = true
  } else if c == "Y" {
    if isLetter(n) && !vowelSeen { p = 17 } else { p = 1; vowelSeen = true }
  } else if c == "C" {
    if n == "E" || n == "I" || n == "Y" { p = 27 } else { p = 25 }
  } else if c == "G" {
    if n == "E" || n == "I" || n == "Y" { p = 24; q1 = 30 } else { p = 26 }
  } else if c == "X" { p = 25; q1 = 27
  } else if c == "B" { p = 22
  } else if c == "D" { p = 24
  } else if c == "F" { p = 31
  } else if c == "H" { p = 35
  } else if c == "J" { p = 24; q1 = 30
  } else if c == "K" { p = 25
  } else if c == "L" { p = 14
  } else if c == "M" { p = 18
  } else if c == "N" { p = 19
  } else if c == "P" { p = 21
  } else if c == "Q" { p = 25
  } else if c == "R" { p = 15
  } else if c == "S" { p = 27
  } else if c == "T" { p = 23
  } else if c == "V" { p = 32
  } else if c == "W" { p = 16
  } else if c == "Z" { p = 28
  }
  pos = pos + step
  // a stop (21-26) is a closure then a burst; the burst comes first in the queue
  if p >= 21 && p <= 26 {
    if q1 >= 0 { q2 = q1 }
    q1 = 36
  }
  return p
}

// start phoneme p: set the targets the tones glide to
mod begin(p: int) {
  seg = p
  left = DUR[p]
  if p >= 1 && p <= 20 {
    t1 = F1[p] * 1.0
    t2 = F2[p] * 1.0
    t3 = F3[p] * 1.0
  } else if p >= 21 && p <= 26 {
    // stops pull F2 toward their locus and F1 down
    t1 = c1 * 0.6
    t2 = (c2 + F2[p]) * 0.5
  }
}

on Clock(interval = 0.026, enabled = talking) {
  f0 = max(f0 - 0.12, 92.0)
  ReadBrickGrid().SetLocation(who.CharacterOf().GetAim().Origin)
  if left <= 0 {
    if q1 >= 0 {
      let nq = q1
      q1 = q2
      q2 = -1
      begin(nq)
    } else if pos >= text.Length() {
      talking = false
      lev = 0.0
      nlev = 0.0
      ReadBrickGrid().DestroySpawnedPrefab()
    } else {
      let p = parse()
      if p >= 0 { begin(p) } else { left = 0 }
    }
  }
  left = left - 1
  // the tween: formants glide ~35% of the way each tick, levels faster
  c1 = c1 + (t1 - c1) * 0.35
  c2 = c2 + (t2 - c2) * 0.35
  c3 = c3 + (t3 - c3) * 0.35
  lev = lev + (AMP[seg] * 0.01 - lev) * 0.6
  nlev = nlev + (NOI[seg] * 0.01 - nlev) * 0.7
  npit = NP[seg] * 0.01
}

on GlobalCustomEvent("tts.say", isObject = true) -> (c: controller, t: string, v: float) {
  who = c
  vol = v
  text = "${t.ToUpper().Trim()}."
  pos = 0
  left = 0
  q1 = -1
  q2 = -1
  vowelSeen = false
  f0 = 110.0
  talking = true
}
