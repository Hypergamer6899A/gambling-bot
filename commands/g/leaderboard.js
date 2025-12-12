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
      const member = await guild.members.fetch(doc.id);
      display = member.user.tag;
    } catch {
      // User not in guild or unreachable
      display = doc.id;
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
