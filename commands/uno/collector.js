import { loadGame, saveGame, deleteGame } from "../../games/uno/state.js";
import { playHandler } from "./play.js";
import { drawHandler } from "./draw.js";
import { endgameHandler } from "./endgame.js";
import { helpHandler } from "./help.js";
import { unoEmbed } from "../../utils/unoEmbed.js";
import { temp } from "../../utils/tempMessage.js";

export function startUnoCollector(client, channel, userId) {
  const filter = (m) =>
    m.author.id === userId && m.content.toLowerCase().startsWith("!uno");

  const collector = channel.createMessageCollector({ filter, time: 10 * 60 * 1000 });

  collector.on("collect", async (msg) => {
    const parts = msg.content.trim().split(/\s+/);
    const subcmd = parts[1]?.toLowerCase();
    msg.delete().catch(() => {});

    let state = await loadGame(userId);
    if (!state) return;

    if (state.winner) return; // ignore extra messages after win

    switch (subcmd) {
      case "play":
        state = await playHandler(client, msg, state, parts.slice(2));
        break;

      case "draw":
        state = await drawHandler(client, msg, state);
        break;

      case "endgame":
        return endgameHandler(client, msg, state, collector);

      case "help":
        return helpHandler(msg);

      default:
        return temp(channel, "Unknown command. Use `!uno play`, `!uno draw`, `!uno endgame`, or `!uno help`.");
    }

    if (!state) return;

    // win check
    if (state.winner) {
      collector.stop("winner");
      return;
    }

    // update embed
    const gameChannel = await client.channels.fetch(state.channelId);
    const gameMsg = await gameChannel.messages.fetch(state.embedMessageId);
    await gameMsg.edit({ embeds: [unoEmbed(state)] });

    await saveGame(state.userId, state);
  });

  collector.on("end", async (collected, reason) => {
    let state = await loadGame(userId);
    if (!state) return;

    const channel = await client.channels.fetch(state.channelId);

    if (state.winner === "player") {
      const userRef = state.userId;
      const prize = state.bet * 2;

      const user = await getUser(userRef);
      user.balance += prize;
      await saveUser(userRef, user);

      channel.send(`${channel.guild.members.cache.get(userRef)}, you won $${prize}!`).catch(() => {});
    }

    if (state.winner === "bot") {
      channel.send(`${channel.guild.members.cache.get(state.userId)}, bot won — you lost $${state.bet}.`).catch(() => {});
    }

    if (reason !== "winner") {
      channel.send(`${channel.guild.members.cache.get(state.userId)}, UNO ended. You lost $${state.bet}.`).catch(() => {});
    }

    await deleteGame(state.userId);

    setTimeout(() => channel.delete().catch(() => {}), 4000);
  });
}
