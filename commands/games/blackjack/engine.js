//commands/games/blackjack/engine.js
import { drawCard, handValue } from "./utils.js";

/**
 * Start a new blackjack game
 */
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
    gameOver: false
  };
}

/**
 * Player hits
 */
export async function playerHit(state) {
  state.playerHand.push(drawCard());
  state.playerTotal = handValue(state.playerHand);

  if (state.playerTotal > 21) {
    state.gameOver = true;
    return { result: "bust" };
  }

  return { result: "continue" };
}

/**
 * Dealer draws (Fixed + Balanced)
 */
export async function dealerDraw(state) {
  const target = state.playerTotal;
  let dealerTotal = handValue(state.dealerHand);

  // =========================
  // Boost Role Support
  // =========================
  const SPECIAL_ROLE = process.env.ROLE_ID;
  const hasBoost =
    state.member?.roles?.cache?.has(SPECIAL_ROLE) || false;

  // Boost = dealer stands early sometimes
  const BOOST = 0.15;

  // Difficulty scales gently
  const difficulty = Math.min(1 + state.streak * 0.05, 1.5);

  const values = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
  const suits = ["♠","♥","♦","♣"];

  /**
   * Slight weighted pick
   * Dealer is smarter, not psychic
   */
  const weightedPick = (target, current) => {
    const pool = [];

    for (const v of values) {
      let cardVal =
        v === "A"
          ? 11
          : ["J", "Q", "K"].includes(v)
          ? 10
          : parseInt(v);

      const diff = target - current;

      let weight = 1;

      if (state.streak > 0) {
        if (cardVal <= diff) weight = 2;
        else if (cardVal - diff <= 2) weight = 1;
      }

      for (let i = 0; i < weight; i++) pool.push(v);
    }

    const val = pool[Math.floor(Math.random() * pool.length)];
    const suit = suits[Math.floor(Math.random() * suits.length)];

    return `${val}${suit}`;
  };

  // =========================
  // Dealer Draw Loop
  // =========================
  while (dealerTotal < target && dealerTotal < 21) {

    // Boost = dealer may stand early
    if (hasBoost && Math.random() < BOOST) {
      break;
    }

    // Dealer draws
    const card =
      state.streak === 0
        ? drawCard()
        : weightedPick(target, dealerTotal);

    state.dealerHand.push(card);
    dealerTotal = handValue(state.dealerHand);

    // Dealer bust
    if (dealerTotal > 21) {
      state.dealerTotal = dealerTotal;
      return "dealer_bust";
    }
  }

  state.dealerTotal = dealerTotal;

  // =========================
  // Final Outcome
  // =========================
  if (dealerTotal > target) return "dealer_win";
  if (dealerTotal < target) return "player_win";

  return "tie";
}
