import {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
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
  PORT,
  RENDER,
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

// --- Render-safe process lock ---
if (RENDER === "true" && global.__botStarted) {
  console.log("[DEBUG] Duplicate Render process detected, exiting...");
  process.exit(0);
}
global.__botStarted = true;

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
    activities: [{ name: "!g help | LETS GO GAMBLING", type: 0 }],
    status: "online",
  });
});

// --- Active game tracker ---
const activeGames = new Set();

// --- Message Handler ---
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.channel.id !== CHANNEL_ID) return;
  if (!message.content.startsWith("!g")) return;

  const args = message.content.trim().split(/\s+/);
  const command = args[1]?.toLowerCase();

  // Optional thinking emoji reaction
  let reacted = false;
  if (THINKING_EMOJI) {
    try {
      await message.react(THINKING_EMOJI);
      reacted = true;
    } catch {}
  }

  try {
    const userRef = db.collection("users").doc(message.author.id);
    let userDoc = await userRef.get();
    let userData = userDoc.exists ? userDoc.data() : {};
    let balance = userData.balance;
    if (balance === undefined) {
      balance = 1000;
      await userRef.set({ balance, lastClaim: 0 }, { merge: true });
      userDoc = await userRef.get();
      userData = userDoc.data();
    }
    const lastClaim = userData.lastClaim ?? 0;

    console.log(`[DEBUG] ${message.author.username} command: ${command}, balance: ${balance}`);

    // --- HELP ---
    if (command === "help") {
      await message.reply(
        "**Available Commands:**\n" +
          "`!g help` - Show this help menu\n" +
          "`!g balance` - Check your balance\n" +
          "`!g roulette <red|black|odd|even> <amount>` - Bet on roulette\n" +
          "`!g blackjack <amount>` - Play blackjack against the bot\n" +
          "`!g claim` - Claim $100 when broke (every 24h)\n" +
          "`!g leaderboard` - Show top 5 richest players (with your rank)"
      );
    }

    // --- BALANCE ---
    else if (command === "balance") {
      await message.reply(`${message.author}, your balance is **$${balance}**.`);
    }

    // --- CLAIM ---
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
          await message.reply(`${message.author}, you claimed **$100**! New balance: **$${balance}**.`);
        }
      }
    }

    // --- ROULETTE ---
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

      const validBets = ["red", "black", "odd", "even"];
      if (!validBets.includes(betType)) {
        await message.reply(`${message.author}, valid bets: red, black, odd, even.`);
        return;
      }

      const spin = Math.floor(Math.random() * 36) + 1;
      const color = spin % 2 === 0 ? "black" : "red";
      const parity = spin % 2 === 0 ? "even" : "odd";
      const win = betType === color || betType === parity;

      if (win) balance += betAmount;
      else balance -= betAmount;

      await userRef.set({ balance, lastClaim }, { merge: true });
      await message.reply(
        `${message.author}, you ${win ? "won" : "lost"}! The ball landed on **${spin} (${color})**. New balance: **$${balance}**.`
      );
    }

    // --- LEADERBOARD ---
    else if (command === "leaderboard") {
      try {
        const snapshot = await db.collection("users").orderBy("balance", "desc").get();
        if (snapshot.empty) return await message.reply("No users found in the leaderboard.");

        const allUsers = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const top5 = allUsers.slice(0, 5);
        const lines = await Promise.all(
          top5.map(async (u, i) => {
            const user = await client.users.fetch(u.id).catch(() => null);
            const name = user?.username || "Unknown";
            return `${i + 1}. ${name} - $${u.balance}`;
          })
        );

        const userIndex = allUsers.findIndex((u) => u.id === message.author.id);
        if (userIndex >= 5) {
          const userBalance = allUsers[userIndex]?.balance ?? 0;
          lines.push(`\nYour Rank: ${userIndex + 1} - $${userBalance}`);
        }

        await message.reply(`**Top 5 Richest Players:**\n${lines.join("\n")}`);
      } catch (err) {
        console.error("Leaderboard error:", err);
        await message.reply("Something went wrong fetching the leaderboard.");
      }
    }

    // --- BLACKJACK ---
    else if (command === "blackjack") {
      if (activeGames.has(message.author.id)) {
        await message.reply(`${message.author}, you're already in a blackjack game!`);
        return;
      }
      activeGames.add(message.author.id);

      const betAmount = parseInt(args[2]);
      if (isNaN(betAmount) || betAmount <= 0 || betAmount > balance) {
        await message.reply(`${message.author}, invalid bet amount.`);
        activeGames.delete(message.author.id);
        return;
      }

      balance -= betAmount;
      await userRef.set({ balance }, { merge: true });

      const suits = ["♠", "♥", "♦", "♣"];
      const values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
      const deck = suits.flatMap((s) => values.map((v) => `${v}${s}`)).sort(() => Math.random() - 0.5);

      const draw = () => deck.pop();
      const calc = (hand) => {
        let sum = 0, aces = 0;
        for (const c of hand) {
          const v = c.slice(0, -1);
          if (["J", "Q", "K"].includes(v)) sum += 10;
          else if (v === "A") { sum += 11; aces++; }
          else sum += parseInt(v);
        }
        while (sum > 21 && aces--) sum -= 10;
        return sum;
      };

      const player = [draw(), draw()];
      const dealer = [draw(), draw()];

      const embed = new EmbedBuilder()
        .setTitle("Blackjack")
        .setColor(0x808080)
        .setDescription(`Your hand: ${player.join(" ")}\nDealer shows: ${dealer[0]}\n\nChoose Hit or Stand`);

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("hit").setLabel("Hit").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("stand").setLabel("Stand").setStyle(ButtonStyle.Secondary)
      );

      const msg = await message.reply({ embeds: [embed], components: [buttons] });
      const collector = msg.createMessageComponentCollector({
        filter: (i) => i.user.id === message.author.id,
        time: 60000,
      });

      collector.on("collect", async (i) => {
        if (i.customId === "hit") {
          player.push(draw());
          const sum = calc(player);
          if (sum > 21) {
            embed.setColor(0xed4245).setDescription(`Your hand: ${player.join(" ")}\nYou busted!`);
            await i.update({ embeds: [embed], components: [] });
            await message.reply(`${message.author}, you busted! Lost **$${betAmount}**.`);
            collector.stop();
            activeGames.delete(message.author.id);
          } else {
            embed.setDescription(`Your hand: ${player.join(" ")}\nDealer shows: ${dealer[0]}`);
            await i.update({ embeds: [embed], components: [buttons] });
          }
        } else {
          let dealerSum = calc(dealer);
          while (dealerSum < 17) dealer.push(draw()), dealerSum = calc(dealer);
          const playerSum = calc(player);

          let color, result;
          if (dealerSum > 21 || playerSum > dealerSum) {
            balance += betAmount * 2;
            result = `You won! Dealer had ${dealer.join(" ")}. Won **$${betAmount}**.`;
            color = 0x57f287;
          } else if (playerSum < dealerSum) {
            result = `You lost! Dealer had ${dealer.join(" ")}. Lost **$${betAmount}**.`;
            color = 0xed4245;
          } else {
            balance += betAmount;
            result = `It's a tie! Dealer had ${dealer.join(" ")}. Bet returned.`;
            color = 0xfee75c;
          }

          await userRef.set({ balance }, { merge: true });
          embed.setColor(color).setDescription(
            `Your hand: ${player.join(" ")}\nDealer: ${dealer.join(" ")}\n\n${result}\n**Balance:** $${balance}`
          );
          await i.update({ embeds: [embed], components: [] });
          collector.stop();
          activeGames.delete(message.author.id);
        }
      });

      collector.on("end", (_, reason) => {
        if (reason === "time") {
          message.reply(`${message.author}, blackjack timed out.`);
          activeGames.delete(message.author.id);
        }
      });
    }
  } finally {
    if (reacted) {
      try {
        await message.reactions.removeAll();
      } catch {}
    }
  }
});

// --- Express Server ---
const app = express();
app.get("/", (req, res) => res.send("Bot is running."));
const port = PORT || 3000;
app.listen(port, () => console.log(`[DEBUG] Listening on port ${port}`));

// --- Login ---
client.login(TOKEN);
