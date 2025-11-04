import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { db } from "../firebase.js";

export const data = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("Show the top balances");

export async function execute(interaction) {
  if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: false });

  try {
    const snapshot = await db.collection("users").orderBy("balance", "desc").limit(10).get();
    if (snapshot.empty) return await interaction.editReply("No users found.");

    const leaderboard = snapshot.docs.map((doc, i) => {
      const data = doc.data();
      return `${i + 1}. ${data.username}: $${data.balance.toLocaleString()}`;
    }).join("\n");

    const embed = new EmbedBuilder()
      .setTitle("Leaderboard")
      .setColor("#FFD700")
      .setDescription(leaderboard);

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    await interaction.editReply(`❌ Error: ${err.message}`);
  }
}
