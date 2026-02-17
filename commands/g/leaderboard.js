import { getFirestore } from "firebase-admin/firestore";
import { EmbedBuilder } from "discord.js";

export async function leaderboardCommand(client, message) {
  const db = getFirestore();

  // Fetch ALL users sorted by balance
  const snap = await db.collection("users")
    .orderBy("balance", "desc")
    .get();

  if (snap.empty) {
    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor("Blue")
          .setTitle("Leaderboard")
          .setDescription("No users found.")
      ]
    });
  }

  // Convert into array
  const allUsers = snap.docs.map(doc => ({
    id: doc.id,
    balance: doc.data().balance
  }));

  // Top 5
  const top5 = allUsers.slice(0, 5);

  let desc =
    `**Top 5 Richest Gamblers**\n\n` +
    top5
      .map(
        (u, i) =>
          `**#${i + 1}** <@${u.id}> — **$${u.balance}**`
      )
      .join("\n");

  // Find current user rank
  const userIndex = allUsers.findIndex(u => u.id === message.author.id);

  // If user is NOT in top 5, show their placement below
  if (userIndex >= 5) {
    const user = allUsers[userIndex];

    desc +=
      `\n\n⋯⋯⋯⋯⋯⋯⋯⋯⋯\n\n` +
      `**#${userIndex + 1}** <@${user.id}> — **$${user.balance}**`;
  }

  return message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor("Blue") // Utility color
        .setTitle("Leaderboard")
        .setDescription(desc)
    ]
  });
}
