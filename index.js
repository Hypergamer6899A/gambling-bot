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
} = process.env;

// --- Firebase ---
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

// --- Discord Client ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// --- Prevent Multiple Instances ---
if (global.__botStarted) {
  console.log("[DEBUG] Duplicate instance detected — exiting.");
  process.exit(0);
}
global.__botStarted = true;

// --- Clean previous handlers (Render reload fix) ---
client.removeAllListeners("messageCreate");

// --- Track Processed Messages ---
const processedMessages = new Set();

// --- Presence ---
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: "!g help | LETS GO GAMBLING", type: 0 }],
    status: "online",
  });
});

// --- Message Handler ---
client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;
    if (message.channel.id !== CHANNEL_ID) return;
    if (!message.content.startsWith("!g")) return;

    if (processedMessages.has(message.id)) {
      console.log(`[DEBUG] Ignored duplicate message ID ${message.id}`);
      return;
    }
    processedMessages.add(message.id);
    setTimeout(() => processedMessages.delete(message.id), 30000);

    const args = message.content.trim().split(/\s+/);
    const command = args[1]?.toLowerCase();

    let reacted = false;
    if (THINKING_EMOJI) {
      try {
        await message.react(THINKING_EMOJI);
        reacted = true;
      } catch (err) {
        console.log("[DEBUG] Failed to react:", err.message);
      }
    }

    await handleCommand(command, args, message, db, client);

    if (reacted) await message.reactions.removeAll();
  } catch (err) {
    console.error("[ERROR] in messageCreate:", err);
  }
});

// --- Command Logic ---
async function handleCommand(command, args, message, db, client) {
  const userRef = db.collection("users").doc(message.author.id);
  let userDoc = await userRef.get();
  let userData = userDoc.exists ? userDoc.data() : {};
  let balance = userData.balance ?? 1000;
  let lastClaim = userData.lastClaim ?? 0;

  if (!userDoc.exists) await userRef.set({ balance, lastClaim });

  console.log(`[DEBUG] ${message.author.username} command: ${command}, balance: ${balance}`);

  switch (command) {
    case "help":
      return message.reply(
        "**Available Commands:**\n" +
          "`!g help` - Show this help menu\n" +
          "`!g balance` - Check your balance\n" +
          "`!g roulette <red|black|odd|even> <amount>` - Bet on roulette\n" +
          "`!g blackjack <amount>` - Play blackjack\n" +
          "`!g claim` - Claim $100 when broke (every 24h)\n" +
          "`!g leaderboard` - Show top 5 richest players"
      );

    case "balance":
      return message.reply(`${message.author}, your balance is **$${balance}**.`);

    case "claim": {
      if (balance > 0)
        return message.reply(`${message.author}, you still have money. You can only claim when broke.`);

      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      if (now - lastClaim < dayMs) {
        const hoursLeft = Math.ceil((dayMs - (now - lastClaim)) / (1000 * 60 * 60));
        return message.reply(`${message.author}, you can claim again in **${hoursLeft} hour(s)**.`);
      }

      balance += 100;
      await userRef.set({ balance, lastClaim: now }, { merge: true });
      return message.reply(`${message.author}, you claimed **$100**! New balance: **$${balance}**.`);
    }

    case "roulette": {
      const betType = args[2]?.toLowerCase();
      const betAmount = parseInt(args[3]);
      if (!betType || isNaN(betAmount))
        return message.reply(`${message.author}, usage: \`!g roulette <red|black|odd|even> <amount>\``);

      if (betAmount <= 0 || betAmount > balance)
        return message.reply(`${message.author}, invalid bet amount.`);

      const valid = ["red", "black", "odd", "even"];
      if (!valid.includes(betType))
        return message.reply(`${message.author}, valid bets: red, black, odd, even.`);

      const spin = Math.floor(Math.random() * 36) + 1;
      const color = spin % 2 === 0 ? "black" : "red";
      const parity = spin % 2 === 0 ? "even" : "odd";
      const win = betType === color || betType === parity;

      balance += win ? betAmount : -betAmount;
      await userRef.set({ balance, lastClaim }, { merge: true });

      return message.reply(
        `${message.author}, you ${win ? "won" : "lost"}! The ball landed on **${spin} (${color})**. New balance: **$${balance}**.`
      );
    }

    case "leaderboard": {
      const snapshot = await db.collection("users").orderBy("balance", "desc").get();
      const allUsers = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      const top5 = allUsers.slice(0, 5);

      const lines = await Promise.all(
        top5.map(async (u, i) => {
          const user = await client.users.fetch(u.id).catch(() => null);
          return `${i + 1}. ${user?.username || "Unknown"} - $${u.balance}`;
        })
      );

      return message.reply(`**Top 5 Richest Players:**\n${lines.join("\n")}`);
    }

    case "blackjack": {
      const betAmount = parseInt(args[2]);
      if (isNaN(betAmount) || betAmount <= 0 || betAmount > balance)
        return message.reply(`${message.author}, invalid bet amount.`);

      balance -= betAmount;
      await userRef.set({ balance }, { merge: true });

      const suits = ["♠", "♥", "♦", "♣"];
      const values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
      const deck = suits.flatMap((s) => values.map((v) => `${v}${s}`)).sort(() => Math.random() - 0.5);
      const draw = () => deck.pop();

      const calc = (hand) => {
        let sum = 0,
          aces = 0;
        for (const c of hand) {
          const v = c.slice(0, -1);
          if (["J", "Q", "K"].includes(v)) sum += 10;
          else if (v === "A") {
            sum += 11;
            aces++;
          } else sum += parseInt(v);
        }
        while (sum > 21 && aces--) sum -= 10;
        return sum;
      };

      const player = [draw(), draw()];
      const dealer = [draw(), draw()];
      const embed = new EmbedBuilder()
        .setTitle("Blackjack")
        .setColor(0x808080)
        .setDescription(`Your hand: ${player.join(" ")}\nDealer shows: ${dealer[0]}\n\nHit or Stand?`);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("hit").setLabel("Hit").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("stand").setLabel("Stand").setStyle(ButtonStyle.Secondary)
      );

      const msg = await message.reply({ embeds: [embed], components: [row] });
      const filter = (i) => i.user.id === message.author.id;
      const collector = msg.createMessageComponentCollector({ filter, time: 60000 });

      collector.on("collect", async (i) => {
        if (i.customId === "hit") {
          player.push(draw());
          const sum = calc(player);
          if (sum > 21) {
            embed.setColor(0xed4245).setDescription(`Your hand: ${player.join(" ")}\nYou busted!`);
            await i.update({ embeds: [embed], components: [] });
            await message.reply(`${message.author}, you busted! Lost **$${betAmount}**.`);
            collector.stop();
          } else {
            embed.setDescription(`Your hand: ${player.join(" ")}\nDealer shows: ${dealer[0]}`);
            await i.update({ embeds: [embed], components: [row] });
          }
        } else {
          let dSum = calc(dealer);
          while (dSum < 17) {
            dealer.push(draw());
            dSum = calc(dealer);
          }
          const pSum = calc(player);
          let result, color;

          if (dSum > 21 || pSum > dSum) {
            balance += betAmount * 2;
            result = `You won! Dealer had ${dealer.join(" ")}.`;
            color = 0x57f287;
          } else if (pSum < dSum) {
            result = `You lost! Dealer had ${dealer.join(" ")}.`;
            color = 0xed4245;
          } else {
            balance += betAmount;
            result = `It's a tie! Dealer had ${dealer.join(" ")}.`;
            color = 0xfee75c;
          }

          await userRef.set({ balance }, { merge: true });
          embed.setColor(color).setDescription(
            `Your hand: ${player.join(" ")}\nDealer: ${dealer.join(
              " "
            )}\n\n${result}\n**Balance:** $${balance}`
          );
          await i.update({ embeds: [embed], components: [] });
          collector.stop();
        }
      });

      collector.on("end", (_, reason) => {
        if (reason === "time") message.reply(`${message.author}, blackjack timed out.`);
      });
      return;
    }

    default:
      return message.reply(`${message.author}, invalid command. Use \`!g help\`.`);
  }
}

// --- Express Keepalive ---
const app = express();
app.get("/", (req, res) => res.send("Bot is running."));
app.listen(PORT || 3000, () => console.log(`[DEBUG] Listening on port ${PORT || 3000}`));

// --- Login ---
client.login(TOKEN);
