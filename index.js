import { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
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
  THINKING_EMOJI, // custom emoji ID
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

// --- Utility Functions ---
const drawCard = () => {
  const suits = ["♠️", "♥️", "♣️", "♦️"];
  const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const suit = suits[Math.floor(Math.random() * suits.length)];
  const rank = ranks[Math.floor(Math.random() * ranks.length)];
  return { suit, rank };
};

const handValue = (hand) => {
  let value = 0, aces = 0;
  for (const card of hand) {
    if (["J", "Q", "K"].includes(card.rank)) value += 10;
    else if (card.rank === "A") { value += 11; aces += 1; }
    else value += parseInt(card.rank);
  }
  while (value > 21 && aces > 0) { value -= 10; aces -= 1; }
  return value;
};

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
    try { await message.react(THINKING_EMOJI); reacted = true; } catch {}
  }

  try {
    const userRef = db.collection("users").doc(message.author.id);
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? userDoc.data() : {};
    let balance = userData.balance ?? 1000;
    const lastClaim = userData.lastClaim ?? 0;

    // --- !g help ---
    if (command === "help") {
      await message.reply(
        "**Available Commands:**\n" +
          "`!g help` - Show this help menu\n" +
          "`!g balance` - Check your balance\n" +
          "`!g roulette <red|black|odd|even> <amount>` - Bet on roulette\n" +
          "`!g claim` - If broke, claim 100 coins every 24 hours\n" +
          "`!g leaderboard` - Show top 5 richest players (with your rank)\n" +
          "`!g blackjack <bet>` - Play a game of blackjack with embedded messages"
      );
      return;
    }

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
      const bet = parseInt(args[2]);
      if (isNaN(bet) || bet <= 0 || bet > balance) {
        await message.reply(`${message.author}, invalid bet amount.`);
        return;
      }

      balance -= bet;
      await userRef.set({ balance, lastClaim }, { merge: true });

      let playerHand = [drawCard(), drawCard()];
      const dealerHand = [drawCard(), drawCard()];

      const embed = new EmbedBuilder()
        .setTitle("Blackjack")
        .setDescription(
          `Your hand: ${playerHand.map(c => `${c.rank}${c.suit}`).join(" ")} (Value: ${handValue(playerHand)})\n` +
          `Dealer shows: ${dealerHand[0].rank}${dealerHand[0].suit}`
        )
        .setColor("Random");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("hit").setLabel("Hit").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("stand").setLabel("Stand").setStyle(ButtonStyle.Secondary)
      );

      const blackjackMsg = await message.reply({ embeds: [embed], components: [row] });

      const collector = blackjackMsg.createMessageComponentCollector({
        time: 60000
      });

      collector.on("collect", async (i) => {
        if (i.user.id !== message.author.id) return;
        if (i.customId === "hit") {
          playerHand.push(drawCard());
          const value = handValue(playerHand);
          const newEmbed = EmbedBuilder.from(embed)
            .setDescription(
              `Your hand: ${playerHand.map(c => `${c.rank}${c.suit}`).join(" ")} (Value: ${value})\n` +
              `Dealer shows: ${dealerHand[0].rank}${dealerHand[0].suit}`
            );
          if (value > 21) {
            await i.update({ embeds: [newEmbed], components: [] });
            await message.reply(`${message.author}, you busted! Lost **${bet}**. New balance: **${balance}**.`);
            collector.stop();
          } else {
            await i.update({ embeds: [newEmbed], components: [row] });
          }
        } else if (i.customId === "stand") {
          let dealerValue = handValue(dealerHand);
          while (dealerValue < 17) {
            dealerHand.push(drawCard());
            dealerValue = handValue(dealerHand);
          }

          const playerValue = handValue(playerHand);
          let resultText = "";
          if (dealerValue > 21 || playerValue > dealerValue) {
            balance += bet * 2;
            resultText = `You won! Won **${bet}**. New balance: **${balance}**.`;
          } else if (playerValue === dealerValue) {
            balance += bet;
            resultText = `Push! Your bet is returned. Balance: **${balance}**.`;
          } else {
            resultText = `Dealer wins! Lost **${bet}**. New balance: **${balance}**.`;
          }

          await userRef.set({ balance, lastClaim }, { merge: true });

          const finalEmbed = EmbedBuilder.from(embed)
            .setDescription(
              `Your hand: ${playerHand.map(c => `${c.rank}${c.suit}`).join(" ")} (Value: ${playerValue})\n` +
              `Dealer hand: ${dealerHand.map(c => `${c.rank}${c.suit}`).join(" ")} (Value: ${dealerValue})`
            );

          await i.update({ embeds: [finalEmbed], components: [] });
          await message.reply(`${message.author}, ${resultText}`);
          collector.stop();
        }
      });

      collector.on("end", async () => {
        if (!collector.ended) return;
      });
    }

  } finally {
    if (reacted) {
      try { await message.reactions.removeAll(); } catch {}
    }
  }
});

// --- Express server ---
const app = express();
app.get("/", (req, res) => res.send("Bot is running."));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[DEBUG] Listening on port ${PORT}`));

// --- Login ---
client.login(TOKEN);
