import { getGame, updateGame, deleteGame } from "../games/uno/state.js";
import { unoEmbed } from "../utils/unoEmbed.js";
import { temp } from "../utils/tempMessage.js";

export function startUnoCollector(client, channel, userId) {
  const filter = m =>
    m.author.id === userId &&
    m.content.toLowerCase().startsWith("!uno");

  const collector = channel.createMessageCollector({
    filter,
    time: 10 * 60 * 1000
  });

  collector.on("collect", async msg => {
    const move = msg.content.toLowerCase(); 

    const state = getGame(userId);
    if (!state) return;

    // Process the move (play card, draw, skip, etc.)
    const result = await processMove(state, move);

    // Save changes
    updateGame(userId, state);

    // Update embed
    await channel.send({ embeds: [unoEmbed(state)] });

    // Now safely delete the player's message
    setTimeout(() => msg.delete().catch(() => {}), 3000);

    // Check for game end
    if (state.winner) collector.stop("finished");
  });

  collector.on("end", async (_, reason) => {
    const state = getGame(userId);
    if (!state) return;

    if (state.winner === "player") {
      await payoutUser(state.userId, state.bet);
      temp(channel, `You won $${state.bet * 2}!`);
    } else {
      temp(channel, `You lost $${state.bet}.`);
    }

    deleteGame(userId);
    setTimeout(() => channel.delete().catch(() => {}), 4000);
  });
}
