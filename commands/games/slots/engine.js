// src/commands/games/slots/engine.js

import { spinSlots } from "./utils.js";

export function newSlotsGame(bet) {
  return {
    bet,
    active: true,

    lastSpin: null,

    // Anti-spam lock
    locked: false,

    // Tracking
    totalSpent: 0,
    totalReturned: 0
  };
}

export function doSpin(game, boosted = false) {
  let result = spinSlots();

  // Boost role luck: reroll if better
  if (boosted) {
    const reroll = spinSlots();

    if (reroll.multiplier > result.multiplier && Math.random() < 0.12) {
      result = reroll;
    }
  }

  game.lastSpin = result;

  return result;
}

export function applySpinResult(game, multiplier) {
  // Player always pays bet
  game.totalSpent += game.bet;

  // Player receives payout if any
  const payout = game.bet * multiplier;
  game.totalReturned += payout;
}

export function getTotalEarnings(game) {
  return game.totalReturned - game.totalSpent;
}

export function finishSlots(game) {
  game.active = false;
  return getTotalEarnings(game);
}
