import { shuffle } from "/../utils/shuffle.js";

const COLORS = ["Red", "Yellow", "Green", "Blue"];
const VALUES = ["0","1","2","3","4","5","6","7","8","9","Skip","Reverse","Draw 2"];

export function createDeck() {
  const deck = [];

  for (const color of COLORS) {
    deck.push({ color, value: "0" });

    for (const v of VALUES.slice(1)) {
      deck.push({ color, value: v }, { color, value: v });
    }
  }

  // Wilds
  for (let i = 0; i < 4; i++) {
    deck.push({ color: "Wild", value: "Wild" });
    deck.push({ color: "Wild", value: "Draw 4" });
  }

  shuffle(deck);
  return deck;
}

