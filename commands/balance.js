import { SlashCommandBuilder } from "discord.js";
import { db } from "../firebase.js";

const ALLOWED_CHANNEL_ID = "1434934862430867487";

export const data = new SlashCommandBuilder()
  .setName("balance")
  .setDescription("Check your balance");

export async function execute(interaction) {
  if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });

  try {
    if (interaction.channel.id !== ALLOWED_CHANNEL_ID) {
      return await interaction.editReply(`You can only use this command in <#${ALLOWED_CHANNEL_ID}>.`);
    }

    const id = interaction.user.id;
    const ref = db.collection("users").doc(id);
    const doc = await ref.get();

    let balance = 1000;
    if (doc.exists) balance = doc.data().balance;
    else await ref.set({ balance, username: interaction.user.username });

    await interaction.editReply(`<@${id}>, you have $${balance.toLocaleString()}.`);
  } catch (err) {
    await interaction.editReply(`❌ Error: ${err.message}`);
  }
}
