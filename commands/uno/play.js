import { canPlayOn, cardToString } from "../../games/uno/format.js";
import { playCard, drawInto, isWinning } from "../../games/uno/engine.js";
import { botTurn } from "../../games/uno/botAI.js";
import { temp } from "../../utils/tempMessage.js";
import { saveGame } from "../../games/uno/state.js";

export async function playHandler(client, msg, state, args) {
  const channel = msg.channel;
  const player = msg.author;

  if (state.turn !== "player") {
    await temp(channel, `${player}, it's not your turn.`);
    return state;
  }

  // Parse card name like “red 7”, “wild red”, “draw 4 green”
  const input = args.join(" ").toLowerCase();

  // Very permissive parsing
  let chosenColor = null;
  let chosenValue = null;

  const colors = ["red", "yellow", "green", "blue"];

  // Check for draw 4
  if (input.includes("draw 4")) {
    chosenValue = "Draw 4";
    for (const c of colors) if (input.includes(c)) chosenColor = c;
  }
  // Wild
  else if (input.startsWith("wild")) {
    chosenValue = "Wild";
    for (const c of colors) if (input.includes(c)) chosenColor = c;
  }
  else {
    const words = input.split(" ");
    if (colors.includes(words[0])) {
      chosenColor = words[0];
      chosenValue = words.slice(1).join(" ");
    } else if (colors.includes(words.at(-1))) {
      chosenColor = words.at(-1);
      chosenValue = words.slice(0, -1).join(" ");
    } else {
      chosenValue = input;
    }
  }

  // Capitalize
  if (chosenColor)
    chosenColor = chosenColor.charAt(0).toUpperCase() + chosenColor.slice(1);
  if (chosenValue)
    chosenValue = chosenValue.replace(/\b\w/g, c => c.toUpperCase());

  // Find card in hand
  let handIndex = -1;

  if (chosenValue === "Draw 4") {
    handIndex = state.playerHand.findIndex(c => c.value === "Draw 4");
  } else if (chosenValue === "Wild") {
    handIndex = state.playerHand.findIndex(c => c.value === "Wild");
  } else {
    const target = chosenColor ? `${chosenColor} ${chosenValue}` : chosenValue;
    handIndex = state.playerHand.findIndex(c =>
      cardToString(c).toLowerCase() === target.toLowerCase()
    );
  }

  if (handIndex === -1) {
    await temp(channel, `${player}, you don't have that card.`);
    return state;
  }

  const card = state.playerHand[handIndex];

  // Check legality
  if (!canPlayOn(card, state.currentColor, state.currentValue)) {
    if (card.color !== "Wild" && card.value !== "Draw 4") {
      await temp(channel, `${player}, you cannot play ${cardToString(card)} here.`);
      return state;
    }
  }

  // Must choose color for wild/draw4
  if ((card.value === "Wild" || card.value === "Draw 4") && !chosenColor) {
    await temp(channel, `${player}, you must specify a color.`);
    return state;
  }

  // Play card
  playCard(state, state.playerHand, handIndex, chosenColor);

  await temp(channel, `${player} played **${cardToString(card)}**.`);

  // Card effects
  if (card.value === "Draw 2") {
    drawInto(state, state.botHand, 2);
    await temp(channel, "Bot draws 2 cards.");
    state.turn = "player";
  }
  else if (card.value === "Draw 4") {
    drawInto(state, state.botHand, 4);
    await temp(channel, "Bot draws 4 cards.");
    state.turn = "player";
  }
  else if (card.value === "Skip" || card.value === "Reverse") {
    await temp(channel, "Bot's turn skipped.");
    state.turn = "player";
  }
  else {
    state.turn = "bot";
  }

  // Win?
  const win = isWinning(state);
  if (win) {
    state.winner = win;
    return state;
  }

  // Bot turn?
  if (state.turn === "bot") {
    const { actions, winner } = botTurn(state);
    for (const a of actions) temp(channel, a);
    if (winner) state.winner = winner;
  }

  return state;
}

