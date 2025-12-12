import { getFirestore } from "firebase-admin/firestore";
import { EmbedBuilder } from "discord.js";

export async function leaderboardCommand(client, message) {
  const db = getFirestore();

  const users = await db.collection("users")
    .orderBy("balance", "desc")
    .limit(5)
    .get();

  let text = "";
  let rank = 1;

  for (const doc of users.docs) {
    const data = doc.data();
    const display = `<@${doc.id}>`; // Trust the mention. Believe in the tag.

    text += `**${rank}.** ${display} — $${data.balance}\n`;
    rank++;
  }

  return message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor("Green")
        .setTitle("Leaderboard — Top Balances")
        .setDescription(text || "No users found.")
    ]
  });
}
