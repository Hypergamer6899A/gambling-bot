import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { db } from "../firebase.js";

const ALLOWED_CHANNEL_ID = "1434934862430867487";
const MAX_BET = 500;

export const data = new SlashCommandBuilder()
  .setName("blackjack")
  .setDescription("Play a blackjack game")
  .addIntegerOption(opt => opt.setName("amount").setDescription(`Bet amount (1–${MAX_BET})`).setRequired(true));

function drawCard() {
  const values = ["A", "2","3","4","5","6","7","8","9","10","J","Q","K"];
  return values[Math.floor(Math.random() * values.length)];
}

function getHandValue(hand) {
  let sum = 0, aces = 0;
  hand.forEach(c => {
    if (c === "A") { sum += 11; aces++; }
    else if (["J","Q","K"].includes(c)) sum += 10;
    else sum += parseInt(c);
  });
  while (sum > 21 && aces > 0) { sum -= 10; aces--; }
  return sum;
}

export async function execute(interaction) {
  if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: false });

  try {
    if (interaction.channel.id !== ALLOWED_CHANNEL_ID)
      return await interaction.editReply(`You can only use this command in <#${ALLOWED_CHANNEL_ID}>.`);

    const bet = interaction.options.getInteger("amount");
    const userRef = db.collection("users").doc(interaction.user.id);
    const userDoc = await userRef.get();
    const balance = userDoc.exists ? userDoc.data().balance : 1000;

    if (bet <= 0 || bet > MAX_BET) return await interaction.editReply(`Bet must be 1–${MAX_BET}.`);
    if (balance < bet) return await interaction.editReply("Not enough money.");

    await userRef.set({ balance: balance - bet, username: interaction.user.username }, { merge: true });

    const playerHand = [drawCard(), drawCard()];
    const dealerHand = [drawCard(), drawCard()];

    let playerValue = getHandValue(playerHand);
    let dealerValue = getHandValue(dealerHand);

    while (dealerValue < 17) { dealerHand.push(drawCard()); dealerValue = getHandValue(dealerHand); }

    let result = "";
    let winnings = 0;

    if (playerValue > 21) result = "Bust! You lose.";
    else if (dealerValue > 21 || playerValue > dealerValue) { result = "You win!"; winnings = bet*2; }
    else if (playerValue === dealerValue) { result = "Push!"; winnings = bet; }
    else result = "Dealer wins!";

    await db.runTransaction(async t => {
      const doc = await t.get(userRef);
      const current = doc.exists ? doc.data().balance : 0;
      t.set(userRef, { balance: current + winnings, username: interaction.user.username }, { merge: true });
    });

    const embed = new EmbedBuilder()
      .setTitle("Blackjack")
      .setColor(winnings > 0 ? "#00FF00" : "#FF0000")
      .setDescription(
        `Your hand: ${playerHand.join(" ")} (${getHandValue(playerHand)})\n` +
        `Dealer hand: ${dealerHand.join(" ")} (${dealerValue})\n\n` +
        `${result}\nWinnings: $${winnings}`
      )
      .setFooter({ text: `Balance: ${balance - bet + winnings}` });

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    await interaction.editReply(`❌ Error: ${err.message}`);
  }
}
