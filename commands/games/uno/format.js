export function cardToString(card) {
  if (card.color === "Wild") return card.value;
  return `${card.color} ${card.value}`;
}

export function canPlayOn(card, currentColor, currentValue) {
  if (!card) return false;
  if (card.color === "Wild") return true;
  if (card.value === "Draw 4") return true; 
  return card.color === currentColor || card.value === currentValue;
}
