import { processGame } from "../../utils/house.js";

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

    await processGame(prize); // house loses

    channel.send(`${channel.guild.members.cache.get(userRef)}, you won $${prize}!`).catch(() => {});
  }

  if (state.winner === "bot") {
    await processGame(-state.bet); // house gains
    channel.send(`${channel.guild.members.cache.get(state.userId)}, bot won — you lost $${state.bet}.`).catch(() => {});
  }

  if (reason !== "winner") {
    await processGame(-state.bet); // house gains on timeout
    channel.send(`${channel.guild.members.cache.get(state.userId)}, UNO ended. You lost $${state.bet}.`).catch(() => {});
  }

  await deleteGame(state.userId);
  setTimeout(() => channel.delete().catch(() => {}), 4000);
});
