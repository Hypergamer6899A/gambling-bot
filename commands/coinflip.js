import { SlashCommandBuilder } from "discord.js";
import { db } from "../firebase.js";
import { updateTopRoles } from "../topRoles.js";

const ALLOWED_CHANNEL_ID = "1434934862430867487";

export const data = new SlashCommandBuilder()
  .setName("coinflip")
  .setDescription("50/50 coin flip game")
  .addStringOption(opt =>
    opt.setName("choice")
      .setDescription("heads or tails")
      .setRequired(true))
  .addIntegerOption(opt =>
    opt.setName("amount")
      .setDescription("Bet amount (max $100)")
      .setRequired(true));

export async function execute(interaction) {
  if (interaction.channel.id !== ALLOWED_CHANNEL_ID) {
    return interaction.reply({
      content: `You can only use this command in <#${ALLOWED_CHANNEL_ID}>.`,
      ephemeral: true
    });
  }

  await interaction.deferReply();

  const choice = interaction.options.getString("choice").toLowerCase();
  const amount = interaction.options.getInteger("amount");

  if (!["heads", "tails"].includes(choice)) {
    return interaction.editReply("Invalid choice. Pick heads or tails.");
  }

  if (amount <= 0 || amount > 100) {
    return interaction.editReply("Bet amount must be between 1 and 100.");
  }

  const id = interaction.user.id;
  const userRef = db.collection("users").doc(id);

  const result = await db.runTransaction(async (t) => {
    const doc = await t.get(userRef);
    let balance = doc.exists ? doc.data().balance : 1000;
    if (amount > balance) throw new Error("Not enough money.");

    const flip = Math.random() < 0.5 ? "heads" : "tails";
    const win = choice === flip;
    balance += win ? amount : -amount;

    t.set(userRef, { balance, username: interaction.user.username });
    return { win, flip, balance };
  }).catch(err => ({ error: err.message }));

  if (result.error) return interaction.editReply(result.error);

  const mention = `<@${interaction.user.id}>`;
const outcome = result.win ? `won $${amount}!` : `lost $${amount}.`;
await interaction.editReply(`${mention} flipped ${result.flip} and ${outcome} Balance: $${result.balance}`);

  await updateTopRoles(interaction.client);
}
