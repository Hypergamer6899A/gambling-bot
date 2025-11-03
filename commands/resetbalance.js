import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { db } from "../firebase.js";
import { updateTopRoles } from "../topRoles.js";

const ALLOWED_CHANNEL_ID = "1434934862430867487";

export const data = new SlashCommandBuilder()
  .setName("resetbalance")
  .setDescription("Admin: set a user's balance (Manage Guild required)")
  .addUserOption(opt => opt.setName("user").setDescription("User to set").setRequired(true))
  .addIntegerOption(opt => opt.setName("amount").setDescription("New balance amount").setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild); // only admins/mods

export async function execute(interaction) {
  if (interaction.channel.id !== ALLOWED_CHANNEL_ID) {
    return interaction.reply({ content: `You can only use this command in <#${ALLOWED_CHANNEL_ID}>.`, ephemeral: true });
  }

  // permission guard just in case
  if (!interaction.memberPermissions?.has?.(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  const targetUser = interaction.options.getUser("user");
  const amount = interaction.options.getInteger("amount");

  if (amount < 0) return interaction.editReply("Amount cannot be negative.");

  const ref = db.collection("users").doc(targetUser.id);
  await ref.set({ balance: amount, username: targetUser.username }, { merge: true });

  await interaction.editReply(`Set ${targetUser.username}'s balance to $${amount.toLocaleString()}.`);

  // update top roles since an admin changed balances
  await updateTopRoles(interaction.client);
}
