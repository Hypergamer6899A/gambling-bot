import { unoEmbed } from "./unoEmbed.js";
import { drawCard } from "./deck.js";
import { temp } from "../../utils/tempMessage.js";

const ROLE_ID = process.env.ROLE_ID;

export async function playerPlayCard(state, card, message) {
  if (state.ended) return;

  const idx = state.playerHand.findIndex(c =>
    c.color === card.color && c.value === card.value
  );
  if (idx === -1) return temp(state.channel, "You don't have that card.");

  if (!isPlayable(card, state)) {
    return temp(state.channel, "You can't play that card.");
  }

  // Play it
  state.playerHand.splice(idx, 1);
  state.currentColor = card.color;
  state.currentValue = card.value;

  handleSpecialCard(state, card, "player");

  // Win check
  if (state.playerHand.length === 0) {
    endGame(state, "player");
    return;
  }

  // Bot turn
  state.turn = "bot";
  await updateEmbed(state);
  await botTurn(state);
}

export async function playerDraw(state) {
  if (state.ended) return;

  const drawn = drawCard(state.deck);
  state.playerHand.push(drawn);

  state.turn = "bot";
  await updateEmbed(state);
  await botTurn(state);
}

async function botTurn(state) {
  if (state.ended) return;

  const bot = state.botHand;

  // Difficulty modifier: if player has ROLE_ID, bot is easier
  const playerHasRole =
    state.guild?.members?.cache
      ?.get(state.player.id)
      ?.roles.cache.has(ROLE_ID);

  const playable = bot.filter(c => isPlayable(c, state));

  let chosen = null;

  if (playable.length === 0) {
    // Bot draws
    const card = drawCard(state.deck);
    bot.push(card);
    await temp(state.channel, "Bot draws a card.");
    state.turn = "player";
    await updateEmbed(state);
    return;
  }

  if (playerHasRole) {
    // Easier bot: chooses random playable card
    chosen = playable[Math.floor(Math.random() * playable.length)];
  } else {
    // Normal bot: prefers action cards
    chosen =
      playable.find(c => ["+4", "+2", "skip", "reverse"].includes(c.value))
      || playable[0];
  }

  // Play the chosen card
  const i = bot.findIndex(c => c === chosen);
  bot.splice(i, 1);

  state.currentColor = chosen.color;
  state.currentValue = chosen.value;

  await temp(state.channel, `Bot plays **${chosen.color} ${chosen.value}**.`);

  handleSpecialCard(state, chosen, "bot");

  // Win check
  if (bot.length === 0) {
    endGame(state, "bot");
    return;
  }

  state.turn = "player";
  await updateEmbed(state);
}

function isPlayable(card, state) {
  return (
    card.color === state.currentColor ||
    card.value === state.currentValue ||
    card.color === "wild"
  );
}

function handleSpecialCard(state, card, who) {
  if (card.value === "+2") {
    state.stacking += 2;
  }

  if (card.value === "+4") {
    state.stacking += 4;
    // Force choose color (random for bot, left unchanged for player)
    state.currentColor =
      ["red", "yellow", "green", "blue"][Math.floor(Math.random() * 4)];
  }

  if (card.value === "skip" || card.value === "reverse") {
    // Skip the opponent
    if (who === "player") state.turn = "player";
    else state.turn = "bot";
  }

  // Apply stacking penalties
  if (state.stacking > 0 && state.turn !== who) {
    const target = who === "player" ? state.botHand : state.playerHand;
    for (let i = 0; i < state.stacking; i++) {
      target.push(drawCard(state.deck));
    }
    state.stacking = 0;
  }
}

async function updateEmbed(state) {
  await state.channel.send({ embeds: [unoEmbed(state)] });
}

async function endGame(state, winner) {
  state.ended = true;

  if (winner === "player") {
    temp(state.channel, `You win! You earned $${state.bet}.`);
  } else {
    temp(state.channel, `Bot wins. You lost $${state.bet}.`);
  }

  setTimeout(() => {
    state.channel.delete().catch(()=>{});
  }, 4000);
}
