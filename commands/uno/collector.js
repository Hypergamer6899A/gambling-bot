import { processGame } from "../utils/house.js";
import { getUser, saveUser } from "../services/userCache.js";
import { deleteGame, loadGame } from "../games/uno/state.js";
import { processGameCommand } from "../games/uno/engine.js"; // example import

export function startUnoCollector(client, channel, userId) {
  const filter = (m) =>
    m.author.id === userId &&
    m.content.toLowerCase().startsWith("!uno");

  const collector = channel.createMessageCollector({
    filter,
    time: 10 * 60 * 1000,
  });

  collector.on("collect", async (msg) => {
    try {
      // First process the UNO turn
      await processGameCommand(msg);

      // Then delete the message after allowing the game to react
      setTimeout(() => msg.delete().catch(() => {}), 750);
    } catch (err) {
      console.error("UNO command error:", err);
    }
  });

  collector.on("end", async (collected, reason) => {
    const state = await loadGame(userId);
    if (!state) return;

    const channel = await client.channels.fetch(state.channelId);
    const playerId = state.userId;

    // The usual payout/winner logic
    if (state.winner === "player") {
      const user = await getUser(playerId);
      const prize = state.bet * 2;

      user.balance += prize;
      await saveUser(playerId, user);
      await processGame(prize);

      channel
        .send(`${channel.guild.members.cache.get(playerId)}, you won $${prize}!`)
        .catch(() => {});
    } else {
      const msg =
        state.winner === "bot"
          ? `bot won — you lost $${state.bet}.`
          : `UNO ended. You lost $${state.bet}.`;

      channel
        .send(`${channel.guild.members.cache.get(playerId)}, ${msg}`)
        .catch(() => {});
    }

    await deleteGame(playerId);

    setTimeout(() => channel.delete().catch(() => {}), 4000);
  });

  return collector;
}
