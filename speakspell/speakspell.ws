// speakspell.ws -- a Speak & Spell on a microchip (owner 2026-10-07: "build me
// a speak and spell using wires"). Build: node build.mjs -> speakspell.brz.
//
// Brickadia has no voices, so the toy "speaks" in chirps: every letter is a
// beep pitched by its letter (A low .. Z high), and the HUD shows what it says.
//   /spell          a new word: it flashes up and is chirped, then spell it
//   /l <letters>    type letters (one or several: /l c  or  /l cat)
//   /erase          rub out the last letter
//   /repeat         hear (and see) the word again
//   /say <text>     "Say It": chirp and show any text
// Two goes per word, like the real one; then it spells the answer for you.
// A right answer pays 5 coins (leaderboard "coins", the shops' money).

var WORDS: string[] = ["CAT", "DOG", "SUN", "TREE", "FISH", "BIRD", "CAKE", "BOAT", "MOON", "STAR",
  "FROG", "GOAT", "SHIP", "KING", "LAMP", "DRUM", "HOUSE", "APPLE", "BRICK", "CLOUD",
  "SWORD", "TRAIN", "PLANT", "GHOST", "PIZZA", "ROBOT", "TIGER", "WATER", "CASTLE", "DRAGON",
  "BANANA", "GARDEN", "ROCKET", "PIRATE", "WIZARD", "SKELETON", "MOUNTAIN", "TREASURE", "VOLCANO", "GOBLIN"]
const BLANKS = "________________"

var word: Map<string, string>
var typed: Map<string, string>
var tries: Map<string, int>

// the speaker: one chirp per letter of spk, every 0.16 s, to spkWho
var spk: string = ""
var spkIdx: int = 0
var spkWho: controller
var speaking: bool = false

on Clock(interval = 0.16, enabled = speaking) {
  if spkIdx >= spk.Length() {
    speaking = false
  } else {
    let c = spk.Substring(spkIdx, 1)
    if c != " " {
      let code = c.ToCharCode().Codepoint
      spkWho.PlayClientAudio($BrickOneShotAudioDescriptor/OBA_Beep_1, pitch = 0.6 + (code - 65) * 0.045)
    }
    spkIdx = spkIdx + 1
  }
}

mod say(who: controller, text: string) {
  spk = text
  spkIdx = 0
  spkWho = who
  speaking = true
}

// the screen: big orange letters on the HUD (ids 53001 word line, 53002 message)
mod screen(who: controller, uid: string) {
  let w = word.get(uid).Value
  let t = typed.get(uid).Value
  who.DisplayText("${t}${BLANKS.Substring(0, w.Length() - t.Length())}", fontSize = 64, typeface = Bold, letterSpacing = 18.0,
    anchorX = 0.5, anchorY = 0.25, pivotX = 0.5, pivotY = 0.5, fontColor = ColorSRGB(255, 140, 30, 255),
    outlineSize = 3, outlineColor = ColorSRGB(40, 10, 0, 255), textId = 53001, lifetime = 120.0)
}

mod message(who: controller, text: string, r: int, g: int, b: int) {
  who.DisplayText(text, fontSize = 34, typeface = Bold, anchorX = 0.5, anchorY = 0.17, pivotX = 0.5, pivotY = 0.5,
    fontColor = ColorSRGB(r, g, b, 255), outlineSize = 2, outlineColor = ColorSRGB(0, 0, 0, 255), textId = 53002, lifetime = 4.0)
}

mod newWord(who: controller) {
  let uid = who.GetUserId()
  let w = WORDS[Random(0, 39)]
  word.set(uid, w)
  typed.set(uid, "")
  tries.set(uid, 0)
  message(who, "SPELL... ${w}", 255, 220, 120)
  screen(who, uid)
  say(who, w)
}

mod check(who: controller, uid: string) {
  let w = word.get(uid).Value
  let t = typed.get(uid).Value
  if t == w {
    message(who, "THAT IS CORRECT!  +5 coins   (/spell for another)", 120, 255, 120)
    who.IncLeaderboard("coins", 5)
    who.PlayClientAudio($BrickOneShotAudioDescriptor/OBA_BR_Checkpoint_Acquire_Click_Cue)
    word.remove(uid)
  } else {
    let n = tries.get(uid).Value + 1
    tries.set(uid, n)
    if n < 2 {
      message(who, "WRONG, TRY AGAIN. SPELL ${w}", 255, 120, 90)
      typed.set(uid, "")
      screen(who, uid)
      say(who, w)
    } else {
      message(who, "THAT IS INCORRECT. THE CORRECT SPELLING OF ${w} IS ${w}   (/spell)", 255, 90, 90)
      typed.set(uid, w)
      screen(who, uid)
      say(who, w)
      word.remove(uid)
    }
  }
}

on ChatCommand("spell", "Speak & Spell: a new word to spell") -> (ctrl, args) {
  newWord(ctrl)
}

on ChatCommand("l", "Speak & Spell: type letters, e.g. /l cat") -> (ctrl, args) {
  let uid = ctrl.GetUserId()
  if !word.has(uid) {
    message(ctrl, "Type /spell to get a word first", 255, 220, 120)
  } else {
    let w = word.get(uid).Value
    let add = args.ToUpper().Replace(" ", "")
    let t = "${typed.get(uid).Value}${add}"
    let keep = t.Substring(0, w.Length())
    typed.set(uid, keep)
    ctrl.PlayClientAudio($BrickOneShotAudioDescriptor/BOSA_Buttons_Button_1_Press)
    say(ctrl, add)
    screen(ctrl, uid)
    if keep.Length() >= w.Length() {
      check(ctrl, uid)
    }
  }
}

on ChatCommand("erase", "Speak & Spell: rub out the last letter") -> (ctrl, args) {
  let uid = ctrl.GetUserId()
  if word.has(uid) {
    let t = typed.get(uid).Value
    if t.Length() > 0 {
      typed.set(uid, t.Substring(0, t.Length() - 1))
      ctrl.PlayClientAudio($BrickOneShotAudioDescriptor/BOSA_Buttons_Button_2_Press)
      screen(ctrl, uid)
    }
  }
}

on ChatCommand("repeat", "Speak & Spell: hear the word again") -> (ctrl, args) {
  let uid = ctrl.GetUserId()
  if word.has(uid) {
    let w = word.get(uid).Value
    message(ctrl, "SPELL... ${w}", 255, 220, 120)
    say(ctrl, w)
  }
}

on ChatCommand("say", "Speak & Spell 'Say It': chirp and show any text") -> (ctrl, args) {
  let text = args.ToUpper().Trim()
  message(ctrl, text, 255, 220, 120)
  say(ctrl, text)
}
