import { Client, GatewayIntentBits, Partials } from "discord.js";
import express from "express";
import "dotenv/config";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const {
  TOKEN,
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
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
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
  if (interaction.commandName !== "help") return;

  await interaction.deferReply({ ephemeral: true });
  await interaction.editReply(
    "**Available Commands:**\n" +
      "`/help` - Show this help menu\n" +
      "`!g balance` - Check your balance\n" +
      "`!g roulette <red|black|odd|even> <amount>` - Bet on roulette\n" +
      "`!g claim` - If broke, claim 100 coins every 24 hours\n" +
      "`!g leaderboard` - Show top 5 richest players (with your rank)"
  );
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
  const userData = userDoc.exists ? userDoc.data() : {};
  let balance = userData.balance ?? 1000;
  let lastClaim = userData.lastClaim ?? 0;

  // --- !g balance ---
  if (command === "balance") {
    return message.reply({
      content: `${message.author.username}, your balance is **${balance}**.`,
      allowedMentions: { parse: [] },
    });
  }

  // --- !g claim ---
  if (command === "claim") {
    if (balance > 0) {
      return message.reply({
        content: `${message.author.username}, you still have money. Claim only when broke (0).`,
        allowedMentions: { parse: [] },
      });
    }

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    if (now - lastClaim < dayMs) {
      const hoursLeft = Math.ceil((dayMs - (now - lastClaim)) / (1000 * 60 * 60));
      return message.reply({
        content: `${message.author.username}, you can claim again in **${hoursLeft} hour(s)**.`,
        allowedMentions: { parse: [] },
      });
    }

    balance += 100;
    lastClaim = now;
    await userRef.set({ balance, lastClaim }, { merge: true });

    return message.reply({
      content: `${message.author.username}, you claimed **100**! New balance: **${balance}**.`,
      allowedMentions: { parse: [] },
    });
  }

  // --- !g roulette ---
  if (command === "roulette") {
    const betType = args[2]?.toLowerCase();
    const betAmount = parseInt(args[3]);
    if (!betType || isNaN(betAmount)) {
      return message.reply({
        content: `${message.author.username}, usage: !g roulette <red|black|odd|even> <amount>`,
        allowedMentions: { parse: [] },
      });
    }

    if (betAmount <= 0 || betAmount > balance) {
      return message.reply({
        content: `${message.author.username}, invalid bet amount.`,
        allowedMentions: { parse: [] },
      });
    }

    const outcomes = ["red", "black", "odd", "even"];
    if (!outcomes.includes(betType)) {
      return message.reply({
        content: `${message.author.username}, valid bets: red, black, odd, even.`,
        allowedMentions: { parse: [] },
      });
    }

    const spin = Math.floor(Math.random() * 36) + 1;
    const color = spin === 0 ? "green" : spin % 2 === 0 ? "black" : "red";
    const parity = spin % 2 === 0 ? "even" : "odd";
    const win = betType === color || betType === parity;

    balance += win ? betAmount : -betAmount;

    await userRef.set({ balance, lastClaim }, { merge: true });

    return message.reply({
      content: `${message.author.username}, you ${win ? "won" : "lost"}! Ball: **${spin} (${color})**. New balance: **${balance}**.`,
      allowedMentions: { parse: [] },
    });
  }

  // --- !g leaderboard ---
  if (command === "leaderboard") {
    try {
      const snapshot = await db.collection("users").orderBy("balance", "desc").get();
      if (snapshot.empty) {
        return message.reply({
          content: "No users found in the leaderboard.",
          allowedMentions: { parse: [] },
        });
      }

      const allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const top5 = allUsers.slice(0, 5);

      const lines = await Promise.all(
        top5.map(async (u, i) => {
          const user = await client.users.fetch(u.id).catch(() => null);
          const username = user?.username || "Unknown";
          return `${i + 1}. ${username} - ${u.balance}`;
        })
      );

      const userIndex = allUsers.findIndex(u => u.id === message.author.id);
      if (userIndex >= 5) {
        const userBalance = allUsers[userIndex]?.balance ?? 0;
        lines.push(`\nYour Rank: ${userIndex + 1} - ${userBalance}`);
      }

      return message.reply({
        content: `**Top 5 Richest Players:**\n${lines.join("\n")}`,
        allowedMentions: { parse: [] },
      });
    } catch (err) {
      console.error("Leaderboard error:", err);
      return message.reply({
        content: "Something went wrong fetching the leaderboard.",
        allowedMentions: { parse: [] },
      });
    }
  }
});

// --- Dummy HTTP Server for Render ---
const app = express();
app.get("/", (_, res) => res.send("Bot is running."));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));

// --- Login ---
client.login(TOKEN);
