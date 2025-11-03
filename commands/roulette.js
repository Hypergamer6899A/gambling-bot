import { SlashCommandBuilder } from "discord.js";
import { db } from "../firebase.js";

// ----- Config -----
const ALLOWED_CHANNEL_ID = "YOUR_CHANNEL_ID"; // same as in index.js
const GUILD_ID = "YOUR_GUILD_ID";
const ROLE_IDS = {
  first: "ROLE_ID_1",
  second: "ROLE_ID_2",
  third: "ROLE_ID_3"
};

// ----- Top Roles Update -----
async function updateTopRoles(client) {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const members = await guild.members.fetch();

    const snapshot = await db.collection("users").orderBy("balance", "desc").limit(3).get();
    const topUsers = snapshot.docs.map(doc => doc.id);

    for (const member of members.values()) {
      await member.roles.remove([ROLE_IDS.first, ROLE_IDS.second, ROLE_IDS.third]).catch(() => {});
    }

    if (topUsers[0]) (await guild.members.fetch(topUsers[0])).roles.add(ROLE_IDS.first).catch(() => {});
    if (topUsers[1]) (await guild.members.fetch(topUsers[1])).roles.add(ROLE_IDS.second).catch(() => {});
    if (topUsers[2]) (await guild.members.fetch(topUsers[2])).roles.add(ROLE_IDS.third).catch(() => {});

  } catch (err) {
    console.error("Error updating top roles:", err);
  }
}

// ----- Command -----
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
  // Restrict to channel
  if (interaction.channel.id !== ALLOWED_CHANNEL_ID) {
    return interaction.reply({
      content: `You can only use this command in <#${ALLOWED_CHANNEL_ID}>.`,
      ephemeral: true
    });
  }

  const bet = interaction.options.getString("bet").toLowerCase();
  const amount = interaction.options.getInteger("amount");
  const validBets = ["red", "black", "odd", "even"];
  if (!validBets.includes(bet)) return interaction.reply("Invalid bet type.");

  const id = interaction.user.id;
  const ref = db.collection("users").doc(id);
  const doc = await ref.get();
  let balance = doc.exists ? doc.data().balance : 1000;

  if (amount > balance) return interaction.reply("Not enough money.");

  const number = Math.floor(Math.random() * 37);
  const color = number === 0 ? "green" : (number % 2 === 0 ? "black" : "red");

  let win = false;
  if (bet === color) win = true;
  if (bet === "odd" && number % 2 === 1) win = true;
  if (bet === "even" && number % 2 === 0 && number !== 0) win = true;

  const result = win ? amount : -amount;
  balance += result;
  await ref.set({ balance });

  await interaction.reply(`${interaction.user.username} spun ${color} ${number}. ${win ? `You won $${amount}!` : `You lost $${amount}.`} Balance: $${balance}`);

  // Update top roles after each spin
  updateTopRoles(interaction.client);
}
