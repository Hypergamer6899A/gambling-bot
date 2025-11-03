import { SlashCommandBuilder } from "discord.js";
import fs from "fs";

export const data = new SlashCommandBuilder()
  .setName("roulette")
  .setDescription("Spin the roulette wheel")
  .addStringOption(opt =>
    opt.setName("bet")
      .setDescription("red, black, odd, or even")
      .setRequired(true))
  .addIntegerOption(opt =>
    opt.setName("amount")
      .setDescription("Bet amount")
      .setRequired(true));

export async function execute(interaction) {
  const bet = interaction.options.getString("bet").toLowerCase();
  const amount = interaction.options.getInteger("amount");
  const validBets = ["red", "black", "odd", "even"];
  if (!validBets.includes(bet)) return interaction.reply("Invalid bet type.");

  const balances = JSON.parse(fs.readFileSync("./data/balances.json"));
  const id = interaction.user.id;
  if (!balances[id]) balances[id] = 1000;
  if (amount > balances[id]) return interaction.reply("Not enough money.");

  const number = Math.floor(Math.random() * 37);
  const color = number === 0 ? "green" : (number % 2 === 0 ? "black" : "red");
  let win = false;
  if (bet === color) win = true;
  if (bet === "odd" && number % 2 === 1) win = true;
  if (bet === "even" && number % 2 === 0 && number !== 0) win = true;

  const result = win ? amount : -amount;
  balances[id] += result;
  fs.writeFileSync("./data/balances.json", JSON.stringify(balances, null, 2));

  await interaction.reply(`${interaction.user.username} spun ${color} ${number}. ${win ? `You won $${amount}!` : `You lost $${amount}.`} Balance: $${balances[id]}`);
}

