import { getFirestore } from "firebase-admin/firestore";
import { EmbedBuilder } from "discord.js";
import { UTIL_COLORS } from "../utils/embedColors.js";

export async function leaderboardCommand(client, message) {
  const db = getFirestore();

  const snap = await db.collection("users")
    .orderBy("balance", "desc")
    .get();

  if (snap.empty) {
    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(UTIL_COLORS.BLUE)
          .setTitle("Leaderboard")
          .setDescription("No users found.")
      ]
    });
  }

  const allUsers = snap.docs.map(doc => ({
    id: doc.id,
    balance: doc.data().balance
  }));

  const top5 = allUsers.slice(0, 5);

  let desc =
    `**Top 5 Richest Gamblers**\n\n` +
    top5
      .map((u, i) => `**#${i + 1}** <@${u.id}> — **$${u.balance}**`)
      .join("\n");

  const userIndex = allUsers.findIndex(u => u.id === message.author.id);

  if (userIndex >= 5) {
    const user = allUsers[userIndex];

    desc +=
      `\n\n━━━━━━━━━━━━━━\n\n` +
      `**#${userIndex + 1}** <@${user.id}> — **$${user.balance}**`;
  }

  return message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(UTIL_COLORS.BLUE)
        .setTitle("Leaderboard")
        .setDescription(desc)
    ]
  });
}
