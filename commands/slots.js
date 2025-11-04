import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { db } from "../firebase.js";
import { updateTopRoles } from "../topRoles.js";

const ALLOWED_CHANNEL_ID = "1434934862430867487";
const MAX_BET = 300;

// ---- EDIT THIS SECTION ONLY ----
const symbols = [
  { emoji: "<:waxedlightlyweatheredcutcopperst:1429946087921287168>", multiplier: 5 },
  { emoji: "<:testblock:1429946118229196810>", multiplier: 3 },
  { emoji: "<:scaryhorrormonster:1429946136784932864>", multiplier: 4 },
  { emoji: "<:sus:1429945939006853170>", multiplier: 6 },
  { emoji: "<:Warden:1429946036809371769>", multiplier: 2 },
  { emoji: "<:deaththreat:1435328355657449709>", multiplier: 10 }
];
// --------------------------------

export const data = new SlashCommandBuilder()
  .setName("slots")
  .setDescription("Spin the slot machine!")
  .addIntegerOption(opt =>
    opt.setName("amount")
      .setDescription(`Bet amount (1–${MAX_BET})`)
      .setRequired(true)
  );

export async function execute(interaction) {
  if (interaction.channel.id !== ALLOWED_CHANNEL_ID) {
    return interaction.reply({
      content: `You can only use this command in <#${ALLOWED_CHANNEL_ID}>.`,
      ephemeral: true
    });
  }

  await interaction.deferReply();

  const amount = interaction.options.getInteger("amount");
  if (amount <= 0 || amount > MAX_BET)
    return interaction.editReply(`Bet must be between 1 and ${MAX_BET}.`);

  const userRef = db.collection("users").doc(interaction.user.id);
  const userDoc = await userRef.get();
  const balance = userDoc.exists ? userDoc.data().balance : 1000;

  if (balance < amount)
    return interaction.editReply("Not enough money.");

  // Deduct bet immediately
  await userRef.set(
    { balance: balance - amount, username: interaction.user.username },
    { merge: true }
  );

  // Spin slots
  const spin = () => symbols[Math.floor(Math.random() * symbols.length)];
  const row = [spin(), spin(), spin()];

  // Check if all emojis match
  const win = row.every(s => s.emoji === row[0].emoji);

  // Calculate winnings based on symbol multiplier
  const winnings = win ? amount * row[0].multiplier : 0;
  const color = win ? "#00FF00" : "#FF0000";

  // Update balance with winnings
  let newBalance = balance - amount + winnings;
  await db.runTransaction(async (t) => {
    const doc = await t.get(userRef);
    const current = doc.exists ? doc.data().balance : 0;
    t.set(userRef, { balance: current + winnings, username: interaction.user.username }, { merge: true });
    newBalance = current + winnings;
  });

  const embed = new EmbedBuilder()
    .setTitle("🎰 Slot Machine 🎰")
    .setColor(color)
    .setDescription(`${row.map(r => r.emoji).join(" | ")}\n\n${win ? `You won $${winnings}!` : `You lost $${amount}.`}`)
    .setFooter({ text: `Current Balance: $${newBalance}` });

  await interaction.editReply({ embeds: [embed] });
  await updateTopRoles(interaction.client);
}
