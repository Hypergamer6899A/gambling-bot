import { SlashCommandBuilder } from "discord.js";
import { db } from "../firebase.js";
import { updateTopRoles } from "../utils/topRoles.js";

const ALLOWED_CHANNEL_ID = "1434934862430867487";
const GUILD_ID = "1429845180437102645";
const TOP_ROLE_ID = "1434989027555016755";

export const data = new SlashCommandBuilder()
  .setName("roulette")
  .setDescription("Spin the roulette wheel")
  .addStringOption(opt =>
    opt.setName("bet")
      .setDescription("red, black, green, odd, or even")
      .setRequired(true))
  .addIntegerOption(opt =>
    opt.setName("amount")
      .setDescription("Bet amount (must be > 0)")
      .setRequired(true));

export async function execute(interaction) {
  if (interaction.channel.id !== ALLOWED_CHANNEL_ID) {
    return interaction.reply({ content: `You can only use this command in <#${ALLOWED_CHANNEL_ID}>.`, ephemeral: true });
  }

  await interaction.deferReply();

  const bet = interaction.options.getString("bet").toLowerCase();
  const amount = interaction.options.getInteger("amount");
  const validBets = ["red", "black", "green", "odd", "even"];

  if (!validBets.includes(bet)) return interaction.editReply("Invalid bet type.");
  if (amount <= 0) return interaction.editReply("Bet amount must be greater than 0.");

  const id = interaction.user.id;
  const userRef = db.collection("users").doc(id);

  const result = await db.runTransaction(async (t) => {
    const doc = await t.get(userRef);
    let balance = doc.exists ? doc.data().balance : 1000;
    if (amount > balance) throw new Error("Not enough money.");

    const number = Math.floor(Math.random() * 37);
    const color = number === 0 ? "green" : (number % 2 === 0 ? "black" : "red");

    let win = false, multiplier = 0;
    if (bet === "green" && color === "green") { win = true; multiplier = 10; }
    else if (bet === color) { win = true; multiplier = 2; }
    else if (bet === "odd" && number % 2 === 1) { win = true; multiplier = 2; }
    else if (bet === "even" && number % 2 === 0 && number !== 0) { win = true; multiplier = 2; }

    const change = win ? amount * (multiplier - 1) : -amount;
    balance += change;

    t.set(userRef, { balance, username: interaction.user.username });
    return { win, balance, number, color, change, multiplier };
  }).catch(err => ({ error: err.message }));

  if (result.error) return interaction.editReply(result.error);

  const mention = `<@${id}>`;
  const outcome = result.win
    ? `won $${amount * (result.multiplier - 1)} (${result.multiplier}x)!`
    : `lost $${amount}.`;

  await interaction.editReply(`${mention} spun ${result.color} ${result.number}. You ${outcome} Balance: $${result.balance}`);

  // Update top 3 role after spin
  await updateTopRoles(interaction.client, GUILD_ID, TOP_ROLE_ID);
}
