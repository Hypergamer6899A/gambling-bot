import { getFirestore } from "firebase-admin/firestore";
import { EmbedBuilder } from "discord.js";

export async function leaderboardCommand(client, message) {
  const db = getFirestore();

  const users = await db.collection("users")
    .orderBy("balance", "desc")
    .limit(10)
    .get();

  let text = "";
  let rank = 1;

  users.forEach(doc => {
    const data = doc.data();
    const userTag = message.guild.members.cache.get(doc.id);
    const display = userTag ? userTag.user.tag : doc.id;

    text += `**${rank}.** ${display} — $${data.balance}\n`;
    rank++;
  });

  return message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor("Green")
        .setTitle("Leaderboard — Top Balances")
        .setDescription(text || "No users found.")
    ]
  });
}
