// src/commands/games/slots/engine.js

import { spinSlots } from "./utils.js";

export function newSlotsGame(bet) {
  return {
    bet,
    active: true,
    lastSpin: null,
    totalProfit: 0
  };
}

export function doSpin(game) {
  const result = spinSlots();

  game.lastSpin = result;

  // Profit = payout - bet
  const profit = (game.bet * result.multiplier) - game.bet;

  game.totalProfit += profit;

  return result;
}

export function finishSlots(game) {
  game.active = false;
  return game.totalProfit;
}
