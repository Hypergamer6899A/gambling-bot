import { SlashCommandBuilder } from "discord.js";
import { db } from "../firebase.js";

const ALLOWED_CHANNEL_ID = "1434934862430867487";

export const data = new SlashCommandBuilder()
  .setName("resetbalance")
  .setDescription("Admin: set a user's balance")
  .addUserOption(option => option.setName("user").setDescription("User").setRequired(true))
  .addIntegerOption(option => option.setName("amount").setDescription("New balance").setRequired(true));

export async function execute(interaction) {
  if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });

  try {
    if (interaction.channel.id !== ALLOWED_CHANNEL_ID) {
      return await interaction.editReply(`You can only use this command in <#${ALLOWED_CHANNEL_ID}>.`);
    }

    const targetUser = interaction.options.getUser("user");
    const amount = interaction.options.getInteger("amount");

    const ref = db.collection("users").doc(targetUser.id);
    await ref.set({ balance: amount, username: targetUser.username }, { merge: true });

    await interaction.editReply(`✅ Set ${targetUser.username}'s balance to $${amount.toLocaleString()}.`);
  } catch (err) {
    await interaction.editReply(`❌ Error: ${err.message}`);
  }
}
