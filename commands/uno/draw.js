import { drawInto } from "../games/uno/engine.js";
import { botTurn } from "../games/uno/botAI.js";
import { temp } from "../utils/tempMessage.js";

export async function drawHandler(client, msg, state) {
  const channel = msg.channel;

  if (state.turn !== "player") {
    await temp(channel, `Wait for your turn.`);
    return state;
  }

  drawInto(state, state.playerHand, 1);
  const card = state.playerHand[state.playerHand.length - 1];
  await temp(channel, `You drew **${card.value === "Wild" ? card.value : card.color + " " + card.value}**.`);

  state.turn = "bot";

  const { actions, winner } = botTurn(state);
  actions.forEach(a => temp(channel, a));
  if (winner) state.winner = winner;

  return state;
}

