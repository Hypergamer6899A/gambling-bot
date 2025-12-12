import { getFirestore } from "firebase-admin/firestore";
import { EmbedBuilder } from "discord.js";

export async function leaderboardCommand(client, message) {
  const db = getFirestore();

  const users = await db.collection("users")
    .orderBy("balance", "desc")
    .limit(10)
    .get();

  const guild = message.guild;

  let text = "";
  let rank = 1;

  for (const doc of users.docs) {
    const data = doc.data();
    let display;

    try {
      // Try to fetch user to confirm they're actually in the guild
      await guild.members.fetch(doc.id);
      display = `<@${doc.id}>`;                    // Mention
    } catch {
      display = `<@${doc.id}>`;                    // Mention anyway (safe fallback)
    }

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
