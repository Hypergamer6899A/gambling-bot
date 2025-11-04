import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { db } from "../firebase.js";
import { updateTopRoles } from "../topRoles.js";

const ALLOWED_CHANNEL_ID = "1434934862430867487";

export const data = new SlashCommandBuilder()
  .setName("resetbalance")
  .setDescription("Admin: set a user's balance (Manage Guild required)")
  .addUserOption(opt=>opt.setName("user").setDescription("User to set").setRequired(true))
  .addIntegerOption(opt=>opt.setName("amount").setDescription("New balance amount").setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction){
  try{
    if(interaction.channel.id !== ALLOWED_CHANNEL_ID)
      return interaction.reply({ content:`You can only use this command in <#${ALLOWED_CHANNEL_ID}>.`, ephemeral:true });

    if(!interaction.memberPermissions?.has?.(PermissionFlagsBits.ManageGuild))
      return interaction.reply({ content:"You do not have permission to use this command.", ephemeral:true });

    await interaction.deferReply({ ephemeral:true });

    const target = interaction.options.getUser("user");
    const amount = interaction.options.getInteger("amount");
    if(amount<0) return interaction.editReply("Amount cannot be negative.");

    await db.collection("users").doc(target.id).set({balance:amount, username:target.username},{merge:true});
    await interaction.editReply(`Set ${target.username}'s balance to $${amount.toLocaleString()}.`);
    await updateTopRoles(interaction.client);

  } catch(err){
    console.error(err);
    try{
      if(interaction.deferred) await interaction.editReply("Error setting balance.");
      else await interaction.reply({content:"Error setting balance.", ephemeral:true});
    } catch {}
  }
}
