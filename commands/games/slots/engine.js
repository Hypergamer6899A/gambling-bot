import { spinSlots } from "./utils.js";

export function newSlotsGame(bet) {
  return {
    bet,
    locked: false,
    lastSpin: null,

    totalSpent: 0,
    totalReturned: 0
  };
}

export function doSpin(game, boosted = false) {
  let result = spinSlots();

  // Boost reroll (only improves multiplier, not jackpot)
  if (boosted && !result.jackpot) {
    const reroll = spinSlots();

    if (
      !reroll.jackpot &&
      reroll.multiplier > result.multiplier &&
      Math.random() < 0.12
    ) {
      result = reroll;
    }
  }

  game.lastSpin = result;
  return result;
}

export function applySpinResult(game, multiplier, jackpotPayout = 0) {
  game.totalSpent += game.bet;

  const payout = jackpotPayout > 0
    ? jackpotPayout
    : Math.round(game.bet * multiplier);

  game.totalReturned += payout;

  return payout;
}

export function getTotalEarnings(game) {
  return game.totalReturned - game.totalSpent;
}
