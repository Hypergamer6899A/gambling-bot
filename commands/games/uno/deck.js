// /games/uno/deck.js
const colors = ["Red", "Green", "Blue", "Yellow"];
const values = [
  "0","1","2","3","4","5","6","7","8","9",
  "Skip", "Reverse", "Draw2"
];

export function buildDeck() {
  const deck = [];

  for (const color of colors) {
    for (const value of values) {
      deck.push({ color, value });
      if (value !== "0") deck.push({ color, value });
    }
  }

  // Wilds
  for (let i = 0; i < 4; i++) {
    deck.push({ color: "Wild", value: "Wild" });
    deck.push({ color: "Wild", value: "Draw4" });
  }

  return shuffle(deck);
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i+1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
