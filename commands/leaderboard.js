import { SlashCommandBuilder } from "discord.js";
import fs from "fs";

export const data = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("Top 5 richest users");

export async function execute(interaction) {
  const balances = JSON.parse(fs.readFileSync("./data/balances.json"));
  const sorted = Object.entries(balances)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  let reply = "**🏆 Top 5 Richest Players 🏆**\n";
  sorted.forEach(([id, bal], i) => reply += `${i + 1}. <@${id}> — $${bal.toLocaleString()}\n`);
  await interaction.reply(reply);
}
