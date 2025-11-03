import { SlashCommandBuilder } from "discord.js";
import { db } from "../firebase.js";

const ALLOWED_CHANNEL_ID = "1434934862430867487";

export const data = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("Top 5 richest users");

export async function execute(interaction) {
  if (interaction.channel.id !== ALLOWED_CHANNEL_ID) {
    return interaction.reply({
      content: `You can only use this command in <#${ALLOWED_CHANNEL_ID}>.`,
      ephemeral: true
    });
  }

  await interaction.deferReply();

  const snapshot = await db.collection("users").orderBy("balance", "desc").limit(5).get();
  if (snapshot.empty) return interaction.editReply("No users yet.");

  let reply = "**🏆 Top 5 Richest Players 🏆**\n";
  let i = 1;

  for (const doc of snapshot.docs) {
    let username = doc.data().username || doc.id;

    try {
      const member = await interaction.guild.members.fetch(doc.id);
      username = member.user.username; // Use Discord username if available
    } catch {
      // fallback to stored username in DB or raw ID
    }

    reply += `${i}. ${username} — $${doc.data().balance.toLocaleString()}\n`;
    i++;
  }

  await interaction.editReply(reply);
}
