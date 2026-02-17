// src/commands/games/poker/utils.js

const suits = ["♠", "♥", "♦", "♣"];
const ranks = [
  "2", "3", "4", "5", "6", "7", "8", "9", "10",
  "J", "Q", "K", "A"
];

export function makeDeck() {
  const deck = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push(`${rank}${suit}`);
    }
  }
  return deck;
}

export function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

export function draw(deck, n = 1) {
  return deck.splice(0, n);
}

/**
 * VERY simplified hand scoring:
 * Only checks high card + pairs + triples.
 * (We can expand later into full poker rankings.)
 */
export function scoreHand(cards) {
  const counts = {};

  for (const c of cards) {
    const rank = c.slice(0, -1);
    counts[rank] = (counts[rank] || 0) + 1;
  }

  const values = Object.values(counts).sort((a, b) => b - a);

  if (values[0] === 3) return { rank: 3, name: "Three of a Kind" };
  if (values[0] === 2 && values[1] === 2) return { rank: 2, name: "Two Pair" };
  if (values[0] === 2) return { rank: 1, name: "One Pair" };

  return { rank: 0, name: "High Card" };
}
