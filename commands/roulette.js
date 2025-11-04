import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { db } from "../firebase.js";

const ALLOWED_CHANNEL_ID = "1434934862430867487";
const MAX_BET = 300;

export const data = new SlashCommandBuilder()
  .setName("roulette")
  .setDescription("Bet on red or black")
  .addStringOption(opt => opt.setName("color").setDescription("red or black").setRequired(true))
  .addIntegerOption(opt => opt.setName("amount").setDescription(`Bet amount (1–${MAX_BET})`).setRequired(true));

export async function execute(interaction) {
  if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: false });

  try {
    if (interaction.channel.id !== ALLOWED_CHANNEL_ID)
      return await interaction.editReply(`You can only use this command in <#${ALLOWED_CHANNEL_ID}>.`);

    const color = interaction.options.getString("color").toLowerCase();
    const bet = interaction.options.getInteger("amount");
    const userRef = db.collection("users").doc(interaction.user.id);
    const userDoc = await userRef.get();
    const balance = userDoc.exists ? userDoc.data().balance : 1000;

    if (!["red","black"].includes(color)) return await interaction.editReply("Color must be red or black.");
    if (bet <= 0 || bet > MAX_BET) return await interaction.editReply(`Bet must be 1–${MAX_BET}.`);
    if (balance < bet) return await interaction.editReply("Not enough money.");

    await userRef.set({ balance: balance - bet, username: interaction.user.username }, { merge: true });

    const outcome = Math.random() < 0.5 ? "red" : "black";
    let winnings = 0;
    let result = "";

    if (color === outcome) { winnings = bet * 2; result = `You won! It was ${outcome}.`; }
    else result = `You lost! It was ${outcome}.`;

    await db.runTransaction(async t => {
      const doc = await t.get(userRef);
      const current = doc.exists ? doc.data().balance : 0;
      t.set(userRef, { balance: current + winnings, username: interaction.user.username }, { merge: true });
    });

    const embed = new EmbedBuilder()
      .setTitle("Roulette")
      .setColor(winnings > 0 ? "#00FF00" : "#FF0000")
      .setDescription(result)
      .setFooter({ text: `Balance: ${balance - bet + winnings}` });

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    await interaction.editReply(`❌ Error: ${err.message}`);
  }
}
