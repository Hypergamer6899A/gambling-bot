import { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
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
    activities: [{ name: "!g help | LETS GO GAMBLING", type: 0 }],
    status: "online",
  });
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
    let userDoc = await userRef.get();
    let userData = userDoc.exists ? userDoc.data() : {};
    let balance = userData.balance;
    if (balance === undefined) {
      balance = 1000; // default starting balance
      await userRef.set({ balance, lastClaim: 0 }, { merge: true });
      userDoc = await userRef.get();
      userData = userDoc.data();
    }
    const lastClaim = userData.lastClaim ?? 0;

    console.log(`[DEBUG] ${message.author.username} command: ${command}, balance: ${balance}`);

    // --- !g help ---
    if (command === "help") {
      await message.reply(
        "**Available Commands:**\n" +
        "`!g help` - Show this help menu\n" +
        "`!g balance` - Check your balance\n" +
        "`!g roulette <red|black|odd|even> <amount>` - Bet on roulette\n" +
        "`!g blackjack <amount>` - Play blackjack against the bot\n" +
        "`!g claim` - If broke, claim 100 coins every 24 hours\n" +
        "`!g leaderboard` - Show top 5 richest players (with your rank)"
      );
    }

    // --- !g balance ---
    else if (command === "balance") {
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

      balance -= betAmount; // Deduct bet immediately
      await userRef.set({ balance }, { merge: true });

      // Start simple blackjack game
      const suits = ["♠", "♥", "♦", "♣"];
      const values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
      const deck = [];
      suits.forEach(s => values.forEach(v => deck.push(`${v}${s}`)));
      deck.sort(() => Math.random() - 0.5); // shuffle

      const drawCard = () => deck.pop();
      const calculateHand = (hand) => {
        let sum = 0;
        let aces = 0;
        for (const card of hand) {
          let value = card.slice(0, -1);
          if (["J", "Q", "K"].includes(value)) sum += 10;
          else if (value === "A") { sum += 11; aces++; }
          else sum += parseInt(value);
        }
        while (sum > 21 && aces > 0) { sum -= 10; aces--; }
        return sum;
      };

      const playerHand = [drawCard(), drawCard()];
      const dealerHand = [drawCard(), drawCard()];

      const embed = new EmbedBuilder()
        .setTitle("Blackjack")
        .setDescription(`Your hand: ${playerHand.join(" ")}\nDealer shows: ${dealerHand[0]}\n\nChoose Hit or Stand`)
        .setColor("Blurple");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("hit").setLabel("Hit").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("stand").setLabel("Stand").setStyle(ButtonStyle.Secondary)
      );

      const gameMessage = await message.reply({ embeds: [embed], components: [row] });

      const filter = i => i.user.id === message.author.id;
      const collector = gameMessage.createMessageComponentCollector({ filter, time: 60000 });

      collector.on("collect", async i => {
        if (i.customId === "hit") {
          playerHand.push(drawCard());
          const sum = calculateHand(playerHand);
          if (sum > 21) {
            await i.update({ embeds: [embed.setDescription(`Your hand: ${playerHand.join(" ")}\nYou busted!`)], components: [] });
            collector.stop("bust");
            await message.reply(`${message.author}, you busted! Lost **${betAmount}** coins.`);
          } else {
            await i.update({ embeds: [embed.setDescription(`Your hand: ${playerHand.join(" ")}\nDealer shows: ${dealerHand[0]}`)], components: [row] });
          }
        } else if (i.customId === "stand") {
          let dealerSum = calculateHand(dealerHand);
          while (dealerSum < 17) {
            dealerHand.push(drawCard());
            dealerSum = calculateHand(dealerHand);
          }
          const playerSum = calculateHand(playerHand);
          let resultMsg;
          if (dealerSum > 21 || playerSum > dealerSum) {
            balance += betAmount * 2;
            resultMsg = `You won! Dealer had ${dealerHand.join(" ")}. Won **${betAmount}** coins.`;
          } else if (playerSum < dealerSum) {
            resultMsg = `You lost! Dealer had ${dealerHand.join(" ")}. Lost **${betAmount}** coins.`;
          } else {
            balance += betAmount; // tie, return bet
            resultMsg = `It's a tie! Dealer had ${dealerHand.join(" ")}. Your bet is returned.`;
          }
          await userRef.set({ balance }, { merge: true });
                    await i.update({
            embeds: [embed.setDescription(`Your hand: ${playerHand.join(" ")}\nDealer: ${dealerHand.join(" ")}\n\n${resultMsg}`)],
            components: [],
          });
          collector.stop();
        }
      });

      collector.on("end", (_, reason) => {
        if (reason === "time") {
          message.reply(`${message.author}, blackjack timed out.`);
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

// --- Express Server ---
const app = express();
app.get("/", (req, res) => res.send("Bot is running."));
const serverPort = PORT || 3000;
app.listen(serverPort, () => console.log(`[DEBUG] Listening on port ${serverPort}`));

// --- Login ---
client.login(TOKEN);

