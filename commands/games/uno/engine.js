// games/uno/engine.js

/**
 * A card: { color: "red", value: "5" }
 * Wilds: { color: "wild", value: "wild" } or "wild+4"
 */

const COLORS = ["red", "yellow", "green", "blue"];
const VALUES = [
  "0","1","2","3","4","5","6","7","8","9",
  "skip","reverse","+2"
];

export function buildDeck() {
  const deck = [];

  // Normal cards
  COLORS.forEach(color => {
    VALUES.forEach(value => {
      deck.push({ color, value });
      if (value !== "0") deck.push({ color, value });
    });
  });

  // Wilds
  for (let i = 0; i < 4; i++) {
    deck.push({ color: "wild", value: "wild" });
    deck.push({ color: "wild", value: "+4" });
  }

  // Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

export function drawCards(deck, n) {
  const cards = [];
  for (let i = 0; i < n; i++) cards.push(deck.pop());
  return cards;
}

export function setupInitial(state) {
  state.playerHand = drawCards(state.deck, 7);
  state.botHand = drawCards(state.deck, 7);

  // Flip starter card
  let starter = state.deck.pop();
  while (starter.color === "wild") {
    state.deck.unshift(starter);
    starter = state.deck.pop();
  }

  state.discard = [starter];
}

export function canPlay(card, top) {
  if (card.color === "wild") return true;
  if (card.color === top.color) return true;
  if (card.value === top.value) return true;
  return false;
}

export function playCard(hand, index, state) {
  const card = hand[index];

  const top = state.discard[state.discard.length - 1];

  if (!canPlay(card, top)) return false;

  // Play it
  hand.splice(index, 1);
  state.discard.push(card);
  state.currentColor = card.color;
  state.currentValue = card.value;

  return true;
}

export function botMove(state) {
  const top = state.discard[state.discard.length - 1];

  const playableIndexes = state.botHand
    .map((card, i) => ({ card, i }))
    .filter(x => canPlay(x.card, top));

  if (playableIndexes.length === 0) {
    state.botHand.push(...drawCards(state.deck, 1));
    return "draw";
  }

  const choice = playableIndexes[Math.floor(Math.random() * playableIndexes.length)];

  playCard(state.botHand, choice.i, state);

  if (state.botHand.length === 0) {
    state.winner = "bot";
  }

  return "played";
}
