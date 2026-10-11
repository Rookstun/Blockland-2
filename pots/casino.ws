// The casino's house chip (owner 2026-10-10: "make a casino at spawn with
// building and gambling mechanics along with npcs"). Every machine in the
// casino is a prefab (casinogen.mjs) whose button sends the global custom
// event "casino.play" with its game and the player who pressed it; this one
// chip (in the sky by the others, owned by the server owner so it may move
// money) takes the bet from their "coins", rolls, pays and shows the result.
//
//   1 slots     bet 10   two alike 12, three alike 100, three 7s 500
//   2 coin flip bet 25   heads pays 48
//   3 dice      bet 50   two dice: 9-11 pays 160, double six 300
//   4 roulette  bet 20   on red (18 of 37) pays 40
// Each game keeps a small house edge.

const SYM = ["7", "BAR", "CHERRY", "BELL", "LEMON", "STAR"]

mod say(ctrl: controller, top: string, bottom: string) {
  ctrl.DisplayText("<b>${top}</>", anchorX = 0.5, anchorY = 0.5, pivotX = 0.5, pivotY = 0.5, positionX = 0.0, positionY = -120.0,
    fontSize = 40, justify = Center, outlineSize = 3, lifetime = 4.0, textId = 53100)
  ctrl.DisplayText(bottom, anchorX = 0.5, anchorY = 0.5, pivotX = 0.5, pivotY = 0.5, positionX = 0.0, positionY = -70.0,
    fontSize = 26, justify = Center, outlineSize = 2, lifetime = 4.0, textId = 53101)
}

mod settle(who: character, ctrl: controller, win: int, top: string) {
  if win > 0 {
    ctrl.IncLeaderboard("coins", win)
    say(ctrl, top, "<color=\"f6ce2a\">You win ${win} coins!</>")
    who.PlayAudioAt($BrickOneShotAudioDescriptor/OBA_CashRegister_Ding)
  } else {
    say(ctrl, top, "<color=\"bbbbbb\">No luck. The house thanks you.</>")
    who.PlayAudioAt($BrickOneShotAudioDescriptor/OBA_Beep_1)
  }
}

on GlobalCustomEvent("casino.play") -> (kind: int, who: character) {
  let ctrl = who.ControllerOf()
  var bet = 10
  if kind == 2 {
    bet = 25
  } else if kind == 3 {
    bet = 50
  } else if kind == 4 {
    bet = 20
  }
  let coins = ctrl.GetLeaderboard("coins")
  if coins < bet {
    say(ctrl, "<color=\"ff6060\">Not enough coins</>", "This table needs ${bet} coins. You have ${coins}.")
  } else {
    ctrl.IncLeaderboard("coins", 0 - bet)
    if kind == 1 {
      let a = Random(0, 5)
      let b = Random(0, 5)
      let c = Random(0, 5)
      let reels = "[ ${SYM[a]} | ${SYM[b]} | ${SYM[c]} ]"
      if a == b && b == c {
        if a == 0 {
          settle(who, ctrl, 500, "<color=\"ffd040\">JACKPOT ${reels}</>")
        } else {
          settle(who, ctrl, 100, reels)
        }
      } else if a == b || b == c || a == c {
        settle(who, ctrl, 12, reels)
      } else {
        settle(who, ctrl, 0, reels)
      }
    } else if kind == 2 {
      if Random(0, 1) == 1 {
        settle(who, ctrl, 48, "Heads!")
      } else {
        settle(who, ctrl, 0, "Tails.")
      }
    } else if kind == 3 {
      let d1 = Random(1, 6)
      let d2 = Random(1, 6)
      let sum = d1 + d2
      if sum == 12 {
        settle(who, ctrl, 300, "<color=\"ffd040\">Double six!</>")
      } else if sum >= 9 {
        settle(who, ctrl, 160, "${d1} + ${d2} = ${sum}")
      } else {
        settle(who, ctrl, 0, "${d1} + ${d2} = ${sum}")
      }
    } else {
      let n = Random(0, 36)
      if n == 0 {
        settle(who, ctrl, 0, "<color=\"40c040\">0 green</>")
      } else if n % 2 == 1 {
        settle(who, ctrl, 40, "<color=\"ff4040\">${n} red</>")
      } else {
        settle(who, ctrl, 0, "${n} black")
      }
    }
  }
}
