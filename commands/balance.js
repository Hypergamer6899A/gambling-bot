import { SlashCommandBuilder } from "discord.js";
import fs from "fs";

export const data = new SlashCommandBuilder()
  .setName("balance")
  .setDescription("Check your balance");

export async function execute(interaction) {
  const filePath = "./data/balances.json";
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, "{}");
  const balances = JSON.parse(fs.readFileSync(filePath));
  const id = interaction.user.id;

  if (!balances[id]) balances[id] = 1000;
  fs.writeFileSync(filePath, JSON.stringify(balances, null, 2));

  await interaction.reply(`${interaction.user.username}, you have $${balances[id].toLocaleString()}.`);
}
