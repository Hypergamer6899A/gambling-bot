// src/commands/games/poker/utils.js

const suits = ["♠", "♥", "♦", "♣"];
const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

const rankValues = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14
};

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

export function scoreHand(cards) {
  const ranksOnly = cards.map(c => c.slice(0, -1));
  const suitsOnly = cards.map(c => c.slice(-1));

  const values = ranksOnly
    .map(r => rankValues[r])
    .sort((a, b) => b - a);

  const counts = {};
  for (const v of values) counts[v] = (counts[v] || 0) + 1;

  const groups = Object.values(counts).sort((a, b) => b - a);

  const flush = suitsOnly.every(s => s === suitsOnly[0]);

  const uniqueVals = [...new Set(values)];
  let straight = false;

  if (uniqueVals.length >= 5) {
    for (let i = 0; i <= uniqueVals.length - 5; i++) {
      const slice = uniqueVals.slice(i, i + 5);
      if (slice[0] - slice[4] === 4) straight = true;
    }
  }

  if (
    uniqueVals.includes(14) &&
    uniqueVals.includes(5) &&
    uniqueVals.includes(4) &&
    uniqueVals.includes(3) &&
    uniqueVals.includes(2)
  ) {
    straight = true;
  }

  if (straight && flush && values.includes(14)) {
    return { rank: 9, name: "Royal Flush" };
  }

  if (straight && flush) {
    return { rank: 8, name: "Straight Flush" };
  }

  if (groups[0] === 4) {
    return { rank: 7, name: "Four of a Kind" };
  }

  if (groups[0] === 3 && groups[1] === 2) {
    return { rank: 6, name: "Full House" };
  }

  if (flush) {
    return { rank: 5, name: "Flush" };
  }

  if (straight) {
    return { rank: 4, name: "Straight" };
  }

  if (groups[0] === 3) {
    return { rank: 3, name: "Three of a Kind" };
  }

  if (groups[0] === 2 && groups[1] === 2) {
    return { rank: 2, name: "Two Pair" };
  }

  if (groups[0] === 2) {
    return { rank: 1, name: "One Pair" };
  }

  return { rank: 0, name: "High Card" };
}
