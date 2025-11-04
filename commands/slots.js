import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { db } from "../firebase.js";

const ALLOWED_CHANNEL_ID = "1434934862430867487";
const MAX_BET = 300;
const symbols = [
  { emoji: "<:waxedlightlyweatheredcutcopperst:1429946087921287168>", multiplier3: 5, multiplier2: 2 },
  { emoji: "<:testblock:1429946118229196810>", multiplier3: 3 },
  { emoji: "<:scaryhorrormonster:1429946136784932864>", multiplier3: 4, multiplier2: 1.5 },
  { emoji: "<:sus:1429945939006853170>", multiplier3: 6 },
  { emoji: "<:Warden:1429946036809371769>", multiplier3: 2, multiplier2: 1 },
  { emoji: "<:deaththreat:1435328355657449709>", multiplier3: 10 }
];

export const data = new SlashCommandBuilder()
  .setName("slots")
  .setDescription("Spin the slot machine!")
  .addIntegerOption(opt => opt.setName("amount").setDescription(`Bet amount (1–${MAX_BET})`).setRequired(true));

export async function execute(interaction) {
  if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: false });

  try {
    if (interaction.channel.id !== ALLOWED_CHANNEL_ID)
      return await interaction.editReply(`You can only use this command in <#${ALLOWED_CHANNEL_ID}>.`);

    const amount = interaction.options.getInteger("amount");
    const userRef = db.collection("users").doc(interaction.user.id);
    const userDoc = await userRef.get();
    const balance = userDoc.exists ? userDoc.data().balance : 1000;

    if (amount <= 0 || amount > MAX_BET) return await interaction.editReply(`Bet must be 1–${MAX_BET}.`);
    if (balance < amount) return await interaction.editReply("Not enough money.");

    await userRef.set({ balance: balance - amount, username: interaction.user.username }, { merge: true });

    const spin = () => symbols[Math.floor(Math.random() * symbols.length)];
    const row = [spin(), spin(), spin()];

    let winnings = 0, winType = "";
    if (row.every(s => s.emoji === row[0].emoji)) { winnings = amount * row[0].multiplier3; winType = "3 of a kind!"; }
    else if ((row[0].emoji === row[1].emoji && row[0].multiplier2) || (row[1].emoji === row[2].emoji && row[1].multiplier2) || (row[0].emoji === row[2].emoji && row[0].multiplier2)) {
      const s = row[0].emoji === row[1].emoji ? row[0] : row[1].emoji === row[2].emoji ? row[1] : row[0];
      winnings = amount * (s.multiplier2 || 1); winType = "2 of a kind!";
    }

    await db.runTransaction(async t => {
      const doc = await t.get(userRef);
      const current = doc.exists ? doc.data().balance : 0;
      t.set(userRef, { balance: current + winnings, username: interaction.user.username }, { merge: true });
    });

    const embed = new EmbedBuilder()
      .setTitle("Slot Machine")
      .setColor(winnings > 0 ? "#00FF00" : "#FF0000")
      .setDescription(`${row.map(r => r.emoji).join(" | ")}\n\n${winnings > 0 ? `You won $${winnings} (${winType})!` : `You lost $${amount}.`}`)
      .setFooter({ text: `Current Balance: ${balance - amount + winnings}` });

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    await interaction.editReply(`❌ Error: ${err.message}`);
  }
}
