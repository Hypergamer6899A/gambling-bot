import { SlashCommandBuilder } from "discord.js";
import { db } from "../firebase.js";

export const data = new SlashCommandBuilder()
  .setName("balance")
  .setDescription("Check your balance");

export async function execute(interaction) {
  const id = interaction.user.id;
  const ref = db.collection("users").doc(id);
  const doc = await ref.get();

  let balance = 1000;
  if (doc.exists) balance = doc.data().balance;
  else await ref.set({ balance });

  await interaction.reply(`${interaction.user.username}, you have $${balance.toLocaleString()}.`);
}
