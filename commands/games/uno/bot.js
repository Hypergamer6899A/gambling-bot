// /games/uno/bot.js
import { canPlayCard } from "./validate.js";

export function botChooseCard(state) {
  const hand = state.botHand;

  // Prefer matching color
  const colorMatch = hand.findIndex(card =>
    canPlayCard(card, state.currentColor, state.currentValue) &&
    card.color === state.currentColor
  );
  if (colorMatch !== -1) return colorMatch;

  // Otherwise any playable card
  const anyPlayable = hand.findIndex(card =>
    canPlayCard(card, state.currentColor, state.currentValue)
  );
  if (anyPlayable !== -1) return anyPlayable;

  // No playable card → draw
  return -1;
}

export function botChooseColor(state) {
  const counts = { Red:0, Green:0, Blue:0, Yellow:0 };
  for (const c of state.botHand) {
    if (counts[c.color] !== undefined) counts[c.color]++;
  }
  return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];
}
