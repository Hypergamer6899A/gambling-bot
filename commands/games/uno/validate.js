// /games/uno/validate.js
export function canPlayCard(card, topColor, topValue) {
  if (card.color === "Wild") return true;
  if (card.color === topColor) return true;
  if (card.value === topValue) return true;
  return false;
}
