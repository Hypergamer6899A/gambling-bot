// /games/uno/logic.js
import { canPlayCard } from "./validate.js";

export function playCard(state, isPlayer, index) {
  const hand = isPlayer ? state.playerHand : state.botHand;
  const card = hand[index];

  if (!card) return { error: "Invalid card index." };
  if (!canPlayCard(card, state.currentColor, state.currentValue))
    return { error: "You cannot play that card." };

  // Remove from hand and place in discard pile
  hand.splice(index, 1);
  state.discard.push(card);
  state.currentColor = card.color === "Wild" ? state.currentColor : card.color;
  state.currentValue = card.value;

  // Handle special cards
  switch (card.value) {
    case "Skip":
      state.turn = isPlayer ? "player" : "bot"; // skip opponent
      break;

    case "Reverse":
      // Reverse does nothing in 2-player except act as skip
      state.turn = isPlayer ? "player" : "bot";
      break;

    case "Draw2":
      drawCards(state, !isPlayer, 2);
      break;

    case "Draw4":
      drawCards(state, !isPlayer, 4);
      break;

    case "Wild":
      // next message must set color if player
      break;
  }

  // Check victory
  if (hand.length === 0) {
    state.winner = isPlayer ? "player" : "bot";
  }

  // Normal turn swap
  if (!["Skip","Reverse","Draw2","Draw4"].includes(card.value)) {
    state.turn = isPlayer ? "bot" : "player";
  }

  return { ok: true };
}

export function drawCards(state, toOpponent, count) {
  const hand = toOpponent ? state.botHand : state.playerHand;
  for (let i = 0; i < count; i++) {
    if (state.deck.length === 0) reshuffle(state);
    hand.push(state.deck.pop());
  }
}

function reshuffle(state) {
  const top = state.discard.pop();
  state.deck.push(...state.discard);
  state.discard = [top];
}
