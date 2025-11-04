import { SlashCommandBuilder } from "discord.js";
import { db } from "../firebase.js";

export const data = new SlashCommandBuilder()
  .setName("resetbalance")
  .setDescription("Reset a user's balance (admin only)")
  .addUserOption(option => option.setName("user").setDescription("User to reset").setRequired(true));

export async function execute(interaction) {
  const user = interaction.options.getUser("user");

  // Defer safely
  if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });

  try {
    const ref = db.collection("users").doc(user.id);
    await ref.set({ balance: 1000, username: user.username }, { merge: true });

    await interaction.editReply(`✅ Reset balance of <@${user.id}> to $1,000.`);
  } catch (err) {
    await interaction.editReply(`❌ Error: ${err.message}`);
  }
}
