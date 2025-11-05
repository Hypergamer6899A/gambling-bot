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
  PROCESS_EMOJI_ID, // your custom animated emoji ID
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
  const userData = userDoc.exists ? userDoc.data() : { balance: 1000, lastClaim: 0 };
  let balance = userData.balance ?? 1000;

  const reactEmoji = message.guild?.emojis.cache.get(PROCESS_EMOJI_ID);

  // Helper: react while thinking
  if (reactEmoji) await message.react(reactEmoji);

  // --- !g balance ---
  if (command === "balance") {
    await message.reply(`${message.author}, your balance is **${balance}**.`);
    if (reactEmoji) await message.reactions.removeAll();
    return;
  }

  // --- !g claim ---
  if (command === "claim") {
    if (balance > 0) {
      await message.reply(`${message.author}, you still have money. You can only claim when broke (0 balance).`);
      if (reactEmoji) await message.reactions.removeAll();
      return;
    }

    const now = Date.now();
    const lastClaim = userData.lastClaim ?? 0;
    const dayMs = 24 * 60 * 60 * 1000;

    if (now - lastClaim < dayMs) {
      const hoursLeft = Math.ceil((dayMs - (now - lastClaim)) / (1000 * 60 * 60));
      await message.reply(`${message.author}, you can claim again in **${hoursLeft} hour(s)**.`);
      if (reactEmoji) await message.reactions.removeAll();
      return;
    }

    balance += 100;
    await userRef.set({ balance, lastClaim: now }, { merge: true });
    await message.reply(`${message.author}, you claimed **$100**! New balance: **${balance}**.`);
    if (reactEmoji) await message.reactions.removeAll();
    return;
  }

  // --- !g roulette ---
  if (command === "roulette") {
    const betType = args[2];
    const betAmount = parseInt(args[3]);
    if (!betType || isNaN(betAmount)) {
      await message.reply(`${message.author}, usage: \`!g roulette <red|black|odd|even> <amount>\``);
      if (reactEmoji) await message.reactions.removeAll();
      return;
    }
    if (betAmount <= 0 || betAmount > balance) {
      await message.reply(`${message.author}, invalid bet amount.`);
      if (reactEmoji) await message.reactions.removeAll();
      return;
    }

    const outcomes = ["red", "black", "odd", "even"];
    if (!outcomes.includes(betType)) {
      await message.reply(`${message.author}, valid bets: red, black, odd, even.`);
      if (reactEmoji) await message.reactions.removeAll();
      return;
    }

    const spin = Math.floor(Math.random() * 36) + 1;
    const color = spin === 0 ? "green" : spin % 2 === 0 ? "black" : "red";
    const parity = spin % 2 === 0 ? "even" : "odd";
    const win = betType === color || betType === parity;

    balance += win ? betAmount : -betAmount;
    await userRef.set({ balance, lastClaim: userData.lastClaim ?? 0 }, { merge: true });

    await message.reply(
      `${message.author}, you ${win ? "won" : "lost"}! The ball landed on **${spin} (${color})**. New balance: **${balance}**.`
    );
    if (reactEmoji) await message.reactions.removeAll();
    return;
  }

  // --- !g leaderboard ---
  if (command === "leaderboard") {
    try {
      const snapshot = await db.collection("users").orderBy("balance", "desc").get();
      if (snapshot.empty) {
        await message.reply({ content: "No users found in the leaderboard.", allowedMentions: { parse: [] } });
        if (reactEmoji) await message.reactions.removeAll();
        return;
      }

      const allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const top5 = allUsers.slice(0, 5);

      const lines = await Promise.all(top5.map(async (u, i) => {
        const user = await client.users.fetch(u.id).catch(() => null);
        const username = user?.username || "Unknown User";
        return `${i + 1}. ${username} - ${u.balance}`;
      }));

      const userIndex = allUsers.findIndex(u => u.id === message.author.id);
      if (userIndex >= 5) {
        const userBalance = allUsers[userIndex]?.balance ?? 0;
        lines.push(`\nYour Rank: ${userIndex + 1} - ${userBalance}`);
      }

      await message.reply({ content: `**Top 5 Richest Players:**\n${lines.join("\n")}`, allowedMentions: { parse: [] } });
      if (reactEmoji) await message.reactions.removeAll();
      return;
    } catch (err) {
      console.error("Leaderboard error:", err);
      await message.reply("Something went wrong fetching the leaderboard.");
      if (reactEmoji) await message.reactions.removeAll();
      return;
    }
  }
});

// --- Dummy HTTP Server for Render ---
const app = express();
app.get("/", (req, res) => res.send("Bot is running."));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));

// --- Login ---
client.login(TOKEN);
