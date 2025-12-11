import { createDeck } from "./deck.js";
import { cardToString, canPlayOn } from "./format.js";
import { shuffle } from "./shuffle.js";

export function newGameState(bet) {
  let deck = createDeck();
  const pile = [];
  const playerHand = deck.splice(0, 7);
  const botHand = deck.splice(0, 7);

  // Top card cannot be a Wild
  let top = deck.pop();
  while (top.color === "Wild") {
    deck.unshift(top);
    top = deck.pop();
  }

  pile.push(top);

  return {
    bet,
    deck,
    pile,
    playerHand,
    botHand,
    currentColor: top.color,
    currentValue: top.value,
    turn: "player",
    winner: null
  };
}

export function drawInto(state, hand, count = 1) {
  for (let i = 0; i < count; i++) {
    ensureDeck(state);
    if (state.deck.length === 0) break;
    hand.push(state.deck.pop());
  }
}

export function ensureDeck(state) {
  if (state.deck.length === 0 && state.pile.length > 1) {
    const top = state.pile.pop();
    state.deck = shuffle(state.pile);
    state.pile = [top];
  }
}

export function playCard(state, hand, index, chosenColor = null) {
  const card = hand[index];
  hand.splice(index, 1);
  state.pile.push(card);

  if (card.color === "Wild") {
    state.currentColor = chosenColor;
  } else {
    state.currentColor = card.color;
  }

  state.currentValue = card.value;
  return card;
}

export function isWinning(state) {
  if (state.playerHand.length === 0) return "player";
  if (state.botHand.length === 0) return "bot";
  return null;
}

