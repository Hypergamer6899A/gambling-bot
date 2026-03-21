// commands/games/blackjack/engine.js
import { drawCard, handValue } from "./utils.js";

// ─── New game ─────────────────────────────────────────────────────────────────

export function newBlackjackGame(bet, streak = 0) {
  const playerHand = [drawCard(), drawCard()];
  const dealerHand = [drawCard(), drawCard()];

  return {
    bet,
    streak,
    playerHand,
    dealerHand,
    playerTotal: handValue(playerHand),
    dealerTotal: handValue(dealerHand),
    gameOver: false,
  };
}

// ─── Player hit ───────────────────────────────────────────────────────────────

export function playerHit(state) {
  state.playerHand.push(drawCard());
  state.playerTotal = handValue(state.playerHand);

  if (state.playerTotal > 21) {
    state.gameOver = true;
    return { result: "bust" };
  }

  return { result: "continue" };
}

// ─── Dealer draw ──────────────────────────────────────────────────────────────

export function dealerDraw(state) {
  const SPECIAL_ROLE = process.env.ROLE_ID;
  const hasBoost     = state.member?.roles?.cache?.has(SPECIAL_ROLE) ?? false;

  // Dealer difficulty scales gently with player streak (capped at 1.5x)
  const difficulty   = Math.min(1 + state.streak * 0.05, 1.5);
  const BOOST_CHANCE = 0.15; // chance dealer stands early when player has boost

  const suits  = ["♠", "♥", "♦", "♣"];
  const values = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];

  /**
   * Weighted card pick — dealer is slightly smarter on a streak,
   * preferring cards that get it closer to the player's total.
   */
  function weightedPick(target, current) {
    const pool = [];
    for (const v of values) {
      const cardVal = v === "A" ? 11 : ["J","Q","K"].includes(v) ? 10 : parseInt(v, 10);
      const diff    = target - current;
      // On a streak: prefer cards that close the gap, otherwise weight is 1
      const weight  = state.streak > 0 && cardVal <= diff ? 2 : 1;
      for (let i = 0; i < weight; i++) pool.push(v);
    }
    const v = pool[Math.floor(Math.random() * pool.length)];
    const s = suits[Math.floor(Math.random() * suits.length)];
    return `${v}${s}`;
  }

  let dealerTotal = handValue(state.dealerHand);
  const target    = state.playerTotal;

  while (dealerTotal < target && dealerTotal <= 21) {
    // Boost: dealer may stand early in player's favor
    if (hasBoost && Math.random() < BOOST_CHANCE) break;

    const card = state.streak === 0
      ? drawCard()
      : weightedPick(target, dealerTotal);

    state.dealerHand.push(card);
    dealerTotal = handValue(state.dealerHand);

    if (dealerTotal > 21) {
      state.dealerTotal = dealerTotal;
      return "dealer_bust";
    }
  }

  state.dealerTotal = dealerTotal;

  if (dealerTotal > target)  return "dealer_win";
  if (dealerTotal < target)  return "player_win";
  return "tie";
}
