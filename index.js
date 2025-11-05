import { Client, GatewayIntentBits, Partials } from "discord.js";
import express from "express";
import "dotenv/config";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const {
  TOKEN,
  GUILD_ID,
  CHANNEL_ID,
  FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY,
  FIREBASE_PROJECT_ID,
} = process.env;

// --- Firebase Setup ---
initializeApp({
  credential: cert({
    projectId: FIREBASE_PROJECT_ID,
    clientEmail: FIREBASE_CLIENT_EMAIL,
    privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore();

// --- Discord Client Setup ---
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel],
});

// --- Presence ---
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: "/help | LETS GO GAMBLING", type: 0 }],
    status: "online",
  });
});

// --- Slash Command: /help ---
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === "help") {
    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply(
      "**Available Commands:**\n" +
        "`/help` - Show this help menu\n" +
        "`!g balance` - Check your balance\n" +
        "`!g roulette <red|black|odd|even> <amount>` - Bet on roulette\n" +
        "`!g claim` - If broke, claim 100 coins every 24 hours\n" +
        "`!g leaderboard` - Show top 5 richest players (with your rank)"
    );
  }
});

// --- Message Commands ---
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.channel.id !== CHANNEL_ID) return;
  if (!message.content.startsWith("!g")) return;

  const args = message.content.trim().split(/\s+/);
  const command = args[1]?.toLowerCase();
  const userRef = db.collection("users").doc(message.author.id);
  const userDoc = await userRef.get();
  let userData = userDoc.exists ? userDoc.data() : { balance: 1000, lastClaim: 0 };
  let balance = userData.balance;

  // --- !g balance ---
  if (command === "balance") {
    return message.reply(`${message.author}, your balance is **${balance}**.`);
  }

  // --- !g claim ---
  if (command === "claim") {
    if (balance > 0)
      return message.reply(`${message.author}, you still have money. You can only claim when broke (0 balance).`);

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    if (now - (userData.lastClaim || 0) < dayMs) {
      const hoursLeft = Math.ceil((dayMs - (now - userData.lastClaim)) / (1000 * 60 * 60));
      return message.reply(`${message.author}, you can claim again in **${hoursLeft} hour(s)**.`);
    }

    balance += 100;
    await userRef.set({ balance, lastClaim: now }, { merge: true });
    return message.reply(`${message.author}, you claimed **$100**! New balance: **${balance}**.`);
  }

  // --- !g roulette ---
  if (command === "roulette") {
    const betType = args[2];
    const betAmount = parseInt(args[3]);
    if (!betType || isNaN(betAmount))
      return message.reply(`${message.author}, usage: \`!g roulette <red|black|odd|even> <amount>\``);
    if (betAmount <= 0 || betAmount > balance)
      return message.reply(`${message.author}, invalid bet amount.`);

    const outcomes = ["red", "black", "odd", "even"];
    if (!outcomes.includes(betType))
      return message.reply(`${message.author}, valid bets: red, black, odd, even.`);

    const spin = Math.floor(Math.random() * 36) + 1;
    const color = spin === 0 ? "green" : spin % 2 === 0 ? "black" : "red";
    const parity = spin % 2 === 0 ? "even" : "odd";
    const win = betType === color || betType === parity;

    if (win) balance += betAmount;
    else balance -= betAmount;

    await userRef.set({ balance, lastClaim: userData.lastClaim }, { merge: true });
    return message.reply(
      `${message.author}, you ${win ? "won" : "lost"}! The ball landed on **${spin} (${color})**. New balance: **${balance}**.`
    );
  }


// --- Dummy HTTP Server for Render ---
const app = express();
app.get("/", (req, res) => res.send("Bot is running."));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));

// --- Login ---
client.login(TOKEN);
