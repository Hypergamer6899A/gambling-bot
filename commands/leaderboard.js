import { SlashCommandBuilder } from "discord.js";
import { db } from "../firebase.js";

const ALLOWED_CHANNEL_ID = "1434934862430867487"; // same as index.js

export const data = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("Top 5 richest users");

export async function execute(interaction) {
  // Restrict to channel
  if (interaction.channel.id !== ALLOWED_CHANNEL_ID) {
    return interaction.reply({
      content: `You can only use this command in <#${ALLOWED_CHANNEL_ID}>.`,
      ephemeral: true
    });
  }

  const snapshot = await db.collection("users").orderBy("balance", "desc").limit(5).get();
  if (snapshot.empty) return interaction.reply("No users yet.");

  let reply = "**🏆 Top 5 Richest Players 🏆**\n";
  let i = 1;
  snapshot.forEach(doc => {
    reply += `${i}. <@${doc.id}> — $${doc.data().balance.toLocaleString()}\n`;
    i++;
  });

  await interaction.reply(reply);
}
