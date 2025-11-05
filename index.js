import { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from "discord.js";
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
  THINKING_EMOJI,
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
        "`!g leaderboard` - Show top 5 richest players (with your rank)\n" +
        "`!g blackjack <bet>` - Play a game of blackjack with embedded messages"
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

  // React with thinking emoji if defined
  let reacted = false;
  if (THINKING_EMOJI) {
    try {
      await message.react(THINKING_EMOJI);
      reacted = true;
    } catch {}
  }

  try {
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
        await message.reply(`${message.author}, you still have money. You can only claim when broke.`);
      } else {
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        if (now - lastClaim < dayMs) {
          const hoursLeft = Math.ceil((dayMs - (now - lastClaim)) / (1000 * 60 * 60));
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
      const betType = args[2]?.toLowerCase();
      const betAmount = parseInt(args[3]);
      if (!betType || isNaN(betAmount)) {
        await message.reply(`${message.author}, usage: \`!g roulette <red|black|odd|even> <amount>\``);
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

        const allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const top5 = allUsers.slice(0, 5);

        const lines = await Promise.all(
          top5.map(async (u, i) => {
            const user = await client.users.fetch(u.id).catch(() => null);
            const username = user?.username || "Unknown User";
            return `${i + 1}. ${username} - ${u.balance}`;
          })
        );

        const userIndex = allUsers.findIndex(u => u.id === message.author.id);
        if (userIndex >= 5) {
          const userBalance = allUsers[userIndex]?.balance ?? 0;
          lines.push(`\nYour Rank: ${userIndex + 1} - ${userBalance}`);
        }

        await message.reply(`**Top 5 Richest Players:**\n${lines.join("\n")}`);
      } catch (err) {
        console.error("Leaderboard error:", err);
        await message.reply("Something went wrong fetching the leaderboard.");
      }
    }

    // --- !g blackjack ---
    else if (command === "blackjack") {
      const betAmount = parseInt(args[2]);
      if (isNaN(betAmount) || betAmount <= 0 || betAmount > balance) {
        await message.reply(`${message.author}, invalid bet amount.`);
        return;
      }

      const suits = ["♠", "♥", "♦", "♣"];
      const values = [
        { name: "A", val: 11 }, { name: "2", val: 2 }, { name: "3", val: 3 }, { name: "4", val: 4 },
        { name: "5", val: 5 }, { name: "6", val: 6 }, { name: "7", val: 7 }, { name: "8", val: 8 },
        { name: "9", val: 9 }, { name: "10", val: 10 }, { name: "J", val: 10 }, { name: "Q", val: 10 }, { name: "K", val: 10 }
      ];

      const drawCard = () => {
        const v = values[Math.floor(Math.random() * values.length)];
        const s = suits[Math.floor(Math.random() * suits.length)];
        return { ...v, suit: s };
      };

      const calcTotal = (cards) => {
        let total = cards.reduce((a, c) => a + c.val, 0);
        let aces = cards.filter(c => c.name === "A").length;
        while (total > 21 && aces > 0) {
          total -= 10;
          aces--;
        }
        return total;
      };

      const userCards = [drawCard(), drawCard()];
      const botCards = [drawCard(), drawCard()];

      const embed = new EmbedBuilder()
        .setTitle("Blackjack")
        .setDescription(`Your cards: ${userCards.map(c => `${c.name}${c.suit}`).join(", ")} (Total: ${calcTotal(userCards)})\nBot's cards: ${botCards[0].name}${botCards[0].suit}, ❓`)
        .setColor("Purple");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("hit").setLabel("Hit").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("stand").setLabel("Stand").setStyle(ButtonStyle.Secondary)
      );

      const msg = await message.reply({ embeds: [embed], components: [row] });

      const collector = msg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000,
      });

      let ended = false;

      collector.on("collect", async (i) => {
        if (i.user.id !== message.author.id) return;
        if (ended) return;

        if (i.customId === "hit") {
          userCards.push(drawCard());
          const total = calcTotal(userCards);
          embed.setDescription(`Your cards: ${userCards.map(c => `${c.name}${c.suit}`).join(", ")} (Total: ${total})\nBot's cards: ${botCards[0].name}${botCards[0].suit}, ❓`);
          await i.update({ embeds: [embed] });

          if (total > 21) {
            balance -= betAmount;
            await userRef.set({ balance, lastClaim }, { merge: true });
            embed.setDescription(`Your cards: ${userCards.map(c => `${c.name}${c.suit}`).join(", ")} (Total: ${total})\nBot's cards: ${botCards[0].name}${botCards[0].suit}, ❓\n\nYou busted! You lost **${betAmount}**. New balance: **${balance}**.`);
            await i.update({ embeds: [embed], components: [] });
            ended = true;
          }
        } else if (i.customId === "stand") {
          let botTotal = calcTotal(botCards);
          while (botTotal < 17) {
            botCards.push(drawCard());
            botTotal = calcTotal(botCards);
          }
          const userTotal = calcTotal(userCards);
          let resultText;
          if (botTotal > 21 || userTotal > botTotal) {
            balance += betAmount;
            resultText = `You won **${betAmount}**! New balance: **${balance}**.`;
          } else if (userTotal < botTotal) {
            balance -= betAmount;
            resultText = `You lost **${betAmount}**. New balance: **${balance}**.`;
          } else {
            resultText = `It's a tie! Your balance remains **${balance}**.`;
          }
          await userRef.set({ balance, lastClaim }, { merge: true });
          embed.setDescription(`Your cards: ${userCards.map(c => `${c.name}${c.suit}`).join(", ")} (Total: ${userTotal})\nBot's cards: ${botCards.map(c => `${c.name}${c.suit}`).join(", ")} (Total: ${botTotal})\n\n${resultText}`);
          await i.update({ embeds: [embed], components: [] });
          ended = true;
        }
      });

      collector.on("end", async () => {
        if (!ended) {
          embed.setDescription(`Game timed out. Your balance remains **${balance}**.`);
          await msg.edit({ embeds: [embed], components: [] });
        }
      });
    }

  } finally {
    // Remove thinking emoji
    if (reacted) {
      try {
        await message.reactions.removeAll();
      } catch {}
    }
  }
});

// --- Express server for Render ---
const app = express();
app.get("/", (req, res) => res.send("Bot is running."));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[DEBUG] Listening on port ${PORT}`));

// --- Login ---
client.login(TOKEN);
