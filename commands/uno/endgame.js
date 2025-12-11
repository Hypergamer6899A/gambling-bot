import { deleteGame } from "../../games/uno/state.js";

export async function endgameHandler(client, msg, state, collector) {
  const channel = msg.channel;

  state.winner = "bot";
  collector.stop("ended");

  channel.send(`${msg.author}, you ended the game and lost your $${state.bet}.`).catch(()=>{});

  return;
}

