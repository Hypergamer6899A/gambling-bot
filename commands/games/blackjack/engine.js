// src/commands/games/blackjack/engine.js
import { drawCard, handValue } from "./utils.js";

/**
 * Start a new blackjack game
 * @param {number} bet
 * @param {number} streak
 * @returns {object} game state
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
 * @param {object} state - game state
 * @returns {Promise<object>} result
 */
export async function playerHit(state) {
  state.playerHand.push(drawCard());
  state.playerTotal = handValue(state.playerHand);

  // Player busts
  if (state.playerTotal > 21) {
    state.gameOver = true;

    // NO money handling here
    return { result: "bust" };
  }

  return { result: "continue" };
}

/**
 * Dealer draws
 * @param {object} state - game state
 * @returns {Promise<string>} result
 */
export async function dealerDraw(state) {
  const target = state.playerTotal;
  let dealerTotal = handValue(state.dealerHand);

  const SPECIAL_ROLE = process.env.ROLE_ID;
  const hasBoost = state.member?.roles?.cache?.has(SPECIAL_ROLE) || false;
  const BOOST = 0.10;

  const difficulty = Math.min(1 + state.streak * 0.15, 3.5);

  const values = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
  const suits = ["♠","♥","♦","♣"];

  // Weighted dealer draw logic
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
        if (cardVal <= diff) weight = Math.round(3 * difficulty);
        else if (cardVal - diff <= 3) weight = Math.round(2 * difficulty);
      }

      for (let i = 0; i < weight; i++) pool.push(v);
    }

    const v = pool[Math.floor(Math.random() * pool.length)];
    const s = suits[Math.floor(Math.random() * suits.length)];

    return `${v}${s}`;
  };

  // Dealer draws until beating player or busting
  while (dealerTotal <= target && dealerTotal <= 21) {
    let card =
      state.streak === 0
        ? drawCard()
        : weightedPick(target, dealerTotal);

    // Boost effect
    if (hasBoost && Math.random() < BOOST) {
      const alt = drawCard();

      const altTotal = handValue([...state.dealerHand, alt]);
      const cardTotal = handValue([...state.dealerHand, card]);

      if (altTotal < cardTotal || altTotal > 21) {
        card = alt;
      }
    }

    state.dealerHand.push(card);
    dealerTotal = handValue(state.dealerHand);

    // Dealer busts
    if (dealerTotal > 21) {
      state.dealerTotal = dealerTotal;
      return "dealer_bust";
    }
  }

  state.dealerTotal = dealerTotal;

  // Dealer wins
  if (dealerTotal > target) return "dealer_win";

  // Player wins
  if (dealerTotal < target) return "player_win";

  // Tie
  return "tie";
}
