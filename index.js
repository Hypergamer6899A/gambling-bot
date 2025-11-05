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
  THINKING_EMOJI, // e.g., "<a:thinking:123456789012345678>"
} = process.env;

// --- Firebase Setup ---
initializeApp({
  credential: cert({
    projectId: FIREBASE_PROJECT_ID,
    clientEmail: FIREBASE_CLIENT_EMAIL,
    privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore({ ignoreUndefinedProperties: true });

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
        "`!g claim` - Claim 100 coins when broke\n" +
        "`!g leaderboard` - Show top 5 richest players"
    );
  }
});

// --- Message Commands ---
client.on("messageCreate", async (message) => {
  // Prevent bot messages from triggering commands
  if (message.author.bot || message.author.id === client.user.id) return;
  if (!message.content.startsWith("!g")) return;
  if (message.channel.id !== CHANNEL_ID) return;

  const args = message.content.trim().split(/\s+/);
  const command = args[1]?.toLowerCase();

  // Show thinking emoji
  let thinkingMsg;
  if (THINKING_EMOJI) {
    try {
      thinkingMsg = await message.react(THINKING_EMOJI);
    } catch {}
  }

  try {
    const userRef = db.collection("users").doc(message.author.id);
    const userDoc = await userRef.get();
    let userData = userDoc.exists ? userDoc.data() : { balance: 1000, lastClaim: 0 };
    let balance = userData.balance ?? 1000;

    // --- !g balance ---
    if (command === "balance") {
      await message.reply(`${message.author}, your balance is **${balance}**.`);
    }

    // --- !g claim ---
    else if (command === "claim") {
      if (balance > 0) {
        await message.reply(`${message.author}, you still have money. You can only claim when broke (0 balance).`);
      } else {
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        if (now - (userData.lastClaim ?? 0) < dayMs) {
          const hoursLeft = Math.ceil((dayMs - (now - (userData.lastClaim ?? 0))) / (1000 * 60 * 60));
          await message.reply(`${message.author}, you can claim again in **${hoursLeft} hour(s)**.`);
        } else {
          balance += 100;
          await userRef.set({ balance, lastClaim: now }, { merge: true });
          await message.reply(`${message.author}, you claimed **$100**! New balance: **${balance}**.`);
        }
      }
    }

    // --- !g roulette ---
    else if (command === "roulette") {
      const betType = args[2];
      const betAmount = parseInt(args[3]);
      if (!betType || isNaN(betAmount)) {
        await message.reply(`${message.author}, usage: \`!g roulette <red|black|odd|even> <amount>\``);
      } else if (betAmount <= 0 || betAmount > balance) {
        await message.reply(`${message.author}, invalid bet amount.`);
      } else {
        const outcomes = ["red", "black", "odd", "even"];
        if (!outcomes.includes(betType)) {
          await message.reply(`${message.author}, valid bets: red, black, odd, even.`);
        } else {
          const spin = Math.floor(Math.random() * 36) + 1;
          const color = spin === 0 ? "green" : spin % 2 === 0 ? "black" : "red";
          const parity = spin % 2 === 0 ? "even" : "odd";
          const win = betType === color || betType === parity;

          if (win) balance += betAmount;
          else balance -= betAmount;

          await userRef.set({ balance, lastClaim: userData.lastClaim ?? 0 }, { merge: true });
          await message.reply(
            `${message.author}, you ${win ? "won" : "lost"}! The ball landed on **${spin} (${color})**. New balance: **${balance}**.`
          );
        }
      }
    }

    // --- !g leaderboard ---
    else if (command === "leaderboard") {
      try {
        const snapshot = await db.collection("users").orderBy("balance", "desc").get();
        if (snapshot.empty) {
          await message.reply("No users found in the leaderboard.");
        } else {
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
        }
      } catch (err) {
        console.error("Leaderboard error:", err);
        await message.reply("Something went wrong fetching the leaderboard.");
      }
    }
  } finally {
    // Remove thinking emoji
    if (THINKING_EMOJI && message.reactions.cache.has(THINKING_EMOJI)) {
      try {
        await message.reactions.resolve(THINKING_EMOJI)?.remove();
      } catch {}
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
