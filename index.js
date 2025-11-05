import {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
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
  if (!message.content.startsWith("!g ")) return; // Require a space to avoid !gX

  const args = message.content.trim().split(/\s+/);
  const command = args[1]?.toLowerCase();

  let reacted = false;
  if (THINKING_EMOJI) {
    try {
      await message.react(THINKING_EMOJI);
      reacted = true;
    } catch (err) {
      console.log("[DEBUG] Could not react:", err.message);
    }
  }

  try {
    const userRef = db.collection("users").doc(message.author.id);
    let userDoc = await userRef.get();
    let userData = userDoc.exists ? userDoc.data() : {};
    let balance = userData.balance ?? 1000;
    const lastClaim = userData.lastClaim ?? 0;

    console.log(`[DEBUG] Command: ${command}, User: ${message.author.username}, Balance: ${balance}`);

    // --- HELP ---
    if (command === "help") {
      await message.reply(
        "**Available Commands:**\n" +
        "`!g help` - Show this help menu\n" +
        "`!g balance` - Check your balance\n" +
        "`!g roulette <red|black|odd|even> <amount>` - Bet on roulette\n" +
        "`!g blackjack <amount>` - Play blackjack against the bot\n" +
        "`!g claim` - Claim $100 if broke (24h cooldown)\n" +
        "`!g leaderboard` - Show top 5 richest players"
      );
      return;
    }

    // --- BALANCE ---
    if (command === "balance") {
      await message.reply(`${message.author}, your balance is **${balance}**.`);
      return;
    }

    // --- CLAIM ---
    if (command === "claim") {
      if (balance > 0) {
        await message.reply(`${message.author}, you still have money. Claim only when broke.`);
        return;
      }
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      if (now - lastClaim < day) {
        const hoursLeft = Math.ceil((day - (now - lastClaim)) / (1000 * 60 * 60));
        await message.reply(`${message.author}, claim again in **${hoursLeft} hour(s)**.`);
        return;
      }
      balance += 100;
      await userRef.set({ balance, lastClaim: now }, { merge: true });
      await message.reply(`${message.author}, claimed **$100**! New balance: **${balance}**.`);
      return;
    }

    // --- ROULETTE ---
    if (command === "roulette") {
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
      await userRef.set({ balance }, { merge: true });

      await message.reply(`${message.author}, you ${win ? "won" : "lost"}! Ball landed on **${spin} (${color})**. New balance: **${balance}**.`);
      return;
    }

    // --- LEADERBOARD ---
    if (command === "leaderboard") {
      const snapshot = await db.collection("users").orderBy("balance", "desc").get();
      const all = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (all.length === 0) {
        await message.reply("No users in leaderboard.");
        return;
      }

      const top5 = all.slice(0, 5);
      const lines = await Promise.all(top5.map(async (u, i) => {
        const user = await client.users.fetch(u.id).catch(() => null);
        const name = user?.username || "Unknown";
        return `${i + 1}. ${name} - ${u.balance}`;
      }));

      const rank = all.findIndex(u => u.id === message.author.id);
      if (rank >= 5) lines.push(`\nYour Rank: ${rank + 1} - ${all[rank].balance}`);

      await message.reply(`**Top 5 Richest Players:**\n${lines.join("\n")}`);
      return;
    }

    // --- BLACKJACK ---
    if (command === "blackjack") {
      const betAmount = parseInt(args[2]);
      if (isNaN(betAmount) || betAmount <= 0 || betAmount > balance) {
        await message.reply(`${message.author}, invalid bet amount.`);
        return;
      }

      balance -= betAmount;
      await userRef.set({ balance }, { merge: true });

      const suits = ["♠", "♥", "♦", "♣"];
      const values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
      const deck = [];
      suits.forEach(s => values.forEach(v => deck.push(`${v}${s}`)));
      deck.sort(() => Math.random() - 0.5);

      const draw = () => deck.pop();
      const handValue = (hand) => {
        let total = 0, aces = 0;
        for (const card of hand) {
          const val = card.slice(0, -1);
          if (["J", "Q", "K"].includes(val)) total += 10;
          else if (val === "A") { total += 11; aces++; }
          else total += parseInt(val);
        }
        while (total > 21 && aces > 0) { total -= 10; aces--; }
        return total;
      };

      const player = [draw(), draw()];
      const dealer = [draw(), draw()];

      const embed = new EmbedBuilder()
        .setTitle("Blackjack")
        .setDescription(`Your hand: ${player.join(" ")}\nDealer shows: ${dealer[0]}\n\nHit or Stand?`)
        .setColor("Blurple");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("hit").setLabel("Hit").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("stand").setLabel("Stand").setStyle(ButtonStyle.Secondary)
      );

      const msg = await message.reply({ embeds: [embed], components: [row] });
      const collector = msg.createMessageComponentCollector({
        filter: i => i.user.id === message.author.id,
        time: 60000,
      });

      collector.on("collect", async i => {
        if (i.customId === "hit") {
          player.push(draw());
          const val = handValue(player);
          if (val > 21) {
            await i.update({ embeds: [embed.setDescription(`Your hand: ${player.join(" ")}\nYou busted!`)], components: [] });
            await message.reply(`${message.author}, you busted and lost **${betAmount}**!`);
            collector.stop();
          } else {
            await i.update({ embeds: [embed.setDescription(`Your hand: ${player.join(" ")}\nDealer shows: ${dealer[0]}`)], components: [row] });
          }
        } else if (i.customId === "stand") {
          let dealerVal = handValue(dealer);
          while (dealerVal < 17) { dealer.push(draw()); dealerVal = handValue(dealer); }
          const playerVal = handValue(player);
          let result;

          if (dealerVal > 21 || playerVal > dealerVal) {
            balance += betAmount * 2;
            result = `You won! Dealer had ${dealer.join(" ")}. Won **${betAmount}** coins.`;
          } else if (playerVal === dealerVal) {
            balance += betAmount;
            result = `It's a tie! Dealer had ${dealer.join(" ")}. Bet returned.`;
          } else {
            result = `You lost! Dealer had ${dealer.join(" ")}. Lost **${betAmount}** coins.`;
          }

          await userRef.set({ balance }, { merge: true });
          await i.update({ embeds: [embed.setDescription(`Your hand: ${player.join(" ")}\nDealer: ${dealer.join(" ")}\n\n${result}`)], components: [] });
          collector.stop();
        }
      });

      collector.on("end", (_, reason) => {
        if (reason === "time") message.reply(`${message.author}, blackjack timed out.`);
      });
      return;
    }

  } finally {
    if (reacted) {
      try { await message.reactions.removeAll(); } catch {}
    }
  }
});

// --- Express Server ---
const app = express();
app.get("/", (_, res) => res.send("Bot is running."));
const port = PORT || 3000;
app.listen(port, () => console.log(`[DEBUG] Listening on port ${port}`));

// --- Login ---
client.login(TOKEN);
