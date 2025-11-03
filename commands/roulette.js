import { SlashCommandBuilder } from "discord.js";
import { db } from "../firebase.js";

const ALLOWED_CHANNEL_ID = "1434934862430867487"; // replace with your channel
const GUILD_ID = "1429845180437102645";             // replace with your server
const ROLE_IDS = {
  first: "1434989027555016755",
  second: "1434989027555016755",
  third: "1434989027555016755"
};
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
  const userRef = db.collection("users").doc(id);

  // --- Transaction for safe balance update ---
  const result = await db.runTransaction(async (t) => {
    const doc = await t.get(userRef);
    let balance = doc.exists ? doc.data().balance : 1000;

    if (amount > balance) throw new Error("Not enough money.");

    const number = Math.floor(Math.random() * 37);
    const color = number === 0 ? "green" : (number % 2 === 0 ? "black" : "red");

    let win = false;
    if (bet === color) win = true;
    if (bet === "odd" && number % 2 === 1) win = true;
    if (bet === "even" && number % 2 === 0 && number !== 0) win = true;

    const change = win ? amount : -amount;
    balance += change;

    t.set(userRef, { balance });
    return { win, balance, number, color, change };
  }).catch(err => {
    return { error: err.message };
  });

  if (result.error) return interaction.reply(result.error);

  await interaction.reply(`${interaction.user.username} spun ${result.color} ${result.number}. ${result.win ? `You won $${amount}!` : `You lost $${amount}.`} Balance: $${result.balance}`);

  // Update top roles
  updateTopRoles(interaction.client);
}
