import { SlashCommandBuilder } from "discord.js";
import { db } from "../firebase.js";

const ALLOWED_CHANNEL_ID = "1434934862430867487";

export const data = new SlashCommandBuilder()
  .setName("balance")
  .setDescription("Check your balance");

export async function execute(interaction) {
  if (interaction.channel.id !== ALLOWED_CHANNEL_ID)
    return interaction.reply({ content: `You can only use this command in <#${ALLOWED_CHANNEL_ID}>.`, ephemeral: true });

  const id = interaction.user.id;
  const ref = db.collection("users").doc(id);
  const doc = await ref.get();

  let balance = 1000;
  if (doc.exists) balance = doc.data().balance;
  else await ref.set({ balance });

  await interaction.reply(`<@${id}>, you have $${balance.toLocaleString()}.`);
}
