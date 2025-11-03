import { SlashCommandBuilder } from "discord.js";
import { db } from "../firebase.js";

export const data = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("Top 5 richest users");

export async function execute(interaction) {
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
