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
  THINKING_EMOJI, // add your custom emoji ID here
  PORT,
} = process.env;

// --- Firebase Setup ---
console.log("[DEBUG] Initializing Firebase...");
initializeApp({
  credential: cert({
    projectId: FIREBASE_PROJECT_ID,
    clientEmail: FIREBASE_CLIENT_EMAIL,
    privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore();
console.log("[DEBUG] Firestore initialized");

// --- Discord Client Setup ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// --- Presence ---
client.once("ready", () => {
  console.log(`[DEBUG] Logged in as ${client.user.tag}`);
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
const processing = new Set(); // prevent double execution

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.channel.id !== CHANNEL_ID) return;
  if (!message.content.startsWith("!g")) return;
  if (processing.has(message.id)) return;

  processing.add(message.id);
  console.log(`[DEBUG] Received message: ${message.content}`);

  // React with thinking emoji if defined
  let reacted = false;
  if (THINKING_EMOJI) {
    try {
      await message.react(THINKING_EMOJI);
      reacted = true;
    } catch {}
  }

  try {
    const args = message.content.trim().split(/\s+/);
    const command = args[1]?.toLowerCase();

    const userRef = db.collection("users").doc(message.author.id);
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? userDoc.data() : {};
    let balance = userData.balance ?? 1000;
    const lastClaim = userData.lastClaim ?? 0;

    // --- !g balance ---
    if (command === "balance") {
      await message.reply(`${message.author}, your balance is **${balance}**.`);
    }

    // --- !g claim ---
    else if (command === "claim") {
      if (balance > 0) {
        await message.reply(
          `${message.author}, you still have money. You can only claim when broke.`
        );
      } else {
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        if (now - lastClaim < dayMs) {
          const hoursLeft = Math.ceil((dayMs - (now - lastClaim)) / (1000 * 60 * 60));
          await message.reply(
            `${message.author}, you can claim again in **${hoursLeft} hour(s)**.`
          );
        } else {
          balance += 100;
          await userRef.set({ balance, lastClaim: now }, { merge: true });
          await message.reply(
            `${message.author}, you claimed **$100**! New balance: **${balance}**.`
          );
        }
      }
    }

    // --- !g roulette ---
    else if (command === "roulette") {
      const betType = args[2]?.toLowerCase();
      const betAmount = parseInt(args[3]);
      if (!betType || isNaN(betAmount)) {
        await message.reply(
          `${message.author}, usage: \`!g roulette <red|black|odd|even> <amount>\``
        );
        return;
      }
      if (betAmount <= 0 || betAmount > balance) {
        await message.reply(`${message.author}, invalid bet amount.`);
        return;
      }

      const outcomes = ["red", "black", "odd", "even"];
      if (!outcomes.includes(betType)) {
        await message.reply(`${message.author}, valid bets: red, black, odd, even.`);
        return;
      }

      const spin = Math.floor(Math.random() * 36) + 1;
      const color = spin === 0 ? "green" : spin % 2 === 0 ? "black" : "red";
      const parity = spin % 2 === 0 ? "even" : "odd";
      const win = betType === color || betType === parity;

      if (win) balance += betAmount;
      else balance -= betAmount;

      await userRef.set({ balance, lastClaim }, { merge: true });
      await message.reply(
        `${message.author}, you ${win ? "won" : "lost"}! The ball landed on **${spin} (${color})**. New balance: **${balance}**.`
      );
    }

    // --- !g leaderboard ---
    else if (command === "leaderboard") {
      try {
        const snapshot = await db.collection("users").orderBy("balance", "desc").get();
        if (snapshot.empty) {
          await message.reply("No users found in the leaderboard.");
          return;
        }

        const allUsers = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const top5 = allUsers.slice(0, 5);

        const lines = await Promise.all(
          top5.map(async (u, i) => {
            const user = await client.users.fetch(u.id).catch(() => null);
            const username = user?.username || "Unknown User";
            return `${i + 1}. ${username} - ${u.balance}`;
          })
        );

        const userIndex = allUsers.findIndex((u) => u.id === message.author.id);
        if (userIndex >= 5) {
          const userBalance = allUsers[userIndex]?.balance ?? 0;
          lines.push(`\nYour Rank: ${userIndex + 1} - ${userBalance}`);
        }

        await message.reply(`**Top 5 Richest Players:**\n${lines.join("\n")}`);
      } catch (err) {
        console.error("[ERROR] Leaderboard:", err);
        await message.reply("Something went wrong fetching the leaderboard.");
      }
    }
  } catch (err) {
    console.error("[ERROR] Command failed:", err);
  } finally {
    // Remove thinking emoji
    if (reacted) {
      try {
        await message.reactions.removeAll();
      } catch {}
    }
    processing.delete(message.id);
  }
});

// --- Express Server for Render ---
const server = express();
server.get("/", (req, res) => res.send("Bot is running."));
server.listen(PORT || 3000, () =>
  console.log(`[DEBUG] Express server listening on port ${PORT || 3000}`)
);

// --- Login ---
console.log("[DEBUG] Logging in bot...");
client.login(TOKEN).catch((err) => console.error("[ERROR] Login failed:", err));
