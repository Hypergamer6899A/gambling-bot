// index.js - Full replacement
import {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  PermissionFlagsBits,
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
  UNO_CATEGORY_ID,
  PORT,
} = process.env;

// --- Firebase ---
initializeApp({
  credential: cert({
    projectId: FIREBASE_PROJECT_ID,
    clientEmail: FIREBASE_CLIENT_EMAIL,
    privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore();

// --- Discord Client ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// Presence
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: "!g help | LETS GO GAMBLING", type: 0 }],
    status: "online",
  });
});

// Processed message guard
const processedMessages = new Set();

// In-memory timeouts to auto-end games (cleared on end)
const gameTimeouts = new Map();

// --- Utilities ---
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createFullDeck() {
  const colors = ["red", "yellow", "green", "blue"];
  const values = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "skip", "reverse", "+2"];
  const deck = [];
  for (const c of colors) {
    deck.push(`${c}-0`);
    for (const v of values.slice(1)) {
      deck.push(`${c}-${v}`, `${c}-${v}`);
    }
  }
  for (let i = 0; i < 4; i++) {
    deck.push("wild", "wild+4");
  }
  return shuffle(deck);
}

function cardMatches(top, card) {
  if (!top || !card) return false;
  if (card.startsWith("wild")) return true;
  if (top.startsWith("wild")) return true;
  const [tC, tV] = top.split("-");
  const [cC, cV] = card.split("-");
  return cC === tC || cV === tV;
}

function shortHandString(hand) {
  return hand.join(", ");
}

async function safeReactAndRemove(msg, emoji) {
  if (!emoji) return;
  try {
    await msg.react(emoji);
  } catch {}
}

async function safeRemoveReactions(msg) {
  try {
    await msg.reactions.removeAll();
  } catch {}
}

async function safeDelete(msg, delay = 0) {
  try {
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    await msg.delete();
  } catch {}
}

// Create private game channel under UNO_CATEGORY_ID
async function createPrivateChannelForGame(guild, user) {
  const name = `uno-${user.username.toLowerCase().replace(/[^a-z0-9\-]/g, "")}-${user.id.slice(-4)}`;
  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: user.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    },
    {
      id: client.user.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.EmbedLinks],
    },
  ];

  const options = {
    type: 0, // GUILD_TEXT
    parent: UNO_CATEGORY_ID || undefined,
    permissionOverwrites: overwrites,
  };

  const channel = await guild.channels.create({
    name,
    parent: options.parent,
    permissionOverwrites: options.permissionOverwrites,
    reason: `UNO game channel for ${user.tag}`,
  });

  return channel;
}

// Update persistent embed in the game's channel
async function updateUnoEmbed(game) {
  try {
    const channel = await client.channels.fetch(game.channelId);
    if (!channel) return;
    const msg = await channel.messages.fetch(game.embedMessageId).catch(() => null);
    const embed = new EmbedBuilder()
      .setTitle("UNO vs Bot")
      .setColor(0x00aeff)
      .setDescription(
        `Top card: **${game.top}**\n\n` +
          `Your hand: ${shortHandString(game.playerHand)}\n` +
          `Bot cards: ${game.botHand.length}\n` +
          `Turn: **${game.turn}**\n\n` +
          `Use \`!uno play <card>\` or \`!uno draw\`.`
      )
      .setFooter({ text: `Bet: $${game.bet}` });

    if (msg) {
      await msg.edit({ embeds: [embed] });
    } else {
      const sent = await channel.send({ embeds: [embed] });
      game.embedMessageId = sent.id;
      await db.collection("unoGames").doc(game.userId).set(game, { merge: true });
    }
  } catch (e) {
    console.error("[ERROR] updateUnoEmbed:", e);
  }
}

// End game: payout/cleanup, delete channel and firestore doc
async function endGameCleanup(userId, result, reason) {
  // result: "player_win" | "bot_win" | "timeout" | "forfeit"
  const ref = db.collection("unoGames").doc(userId);
  const doc = await ref.get();
  if (!doc.exists) return;
  const game = doc.data();

  // payout only on player_win
  if (result === "player_win") {
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? userDoc.data() : {};
    let balance = userData.balance ?? 1000;
    balance += (game.bet * 2); // return original + winnings
    await userRef.set({ balance }, { merge: true });
  }

  // delete the Firestore doc
  await ref.delete();

  // clear timeout
  const t = gameTimeouts.get(userId);
  if (t) {
    clearTimeout(t);
    gameTimeouts.delete(userId);
  }

  // delete channel
  try {
    const ch = await client.channels.fetch(game.channelId);
    if (ch && ch.deletable) await ch.delete(`UNO finished: ${reason}`);
  } catch (e) {
    // ignore
  }
}

// Bot turn logic
async function botPlayTurn(userId) {
  const ref = db.collection("unoGames").doc(userId);
  const doc = await ref.get();
  if (!doc.exists) return;
  const game = doc.data();

  // ensure deck
  if (!game.deck || game.deck.length === 0) {
    // reshuffle discard except top
    const top = game.discard.pop();
    game.deck = shuffle(game.discard);
    game.discard = [top];
  }

  // find playable
  const top = game.top;
  const playable = game.botHand.filter((c) => cardMatches(top, c) || c.startsWith("wild"));

  const user = await client.users.fetch(userId).catch(() => null);
  const channel = await client.channels.fetch(game.channelId).catch(() => null);

  let botActionText = "";
  if (playable.length > 0) {
    // prioritize skip and +2
    const pri = playable.find((c) => c.endsWith("skip") || c.endsWith("+2"));
    const chosen = pri || playable[Math.floor(Math.random() * playable.length)];
    // play
    const idx = game.botHand.indexOf(chosen);
    game.botHand.splice(idx, 1);
    game.discard.push(chosen);
    game.top = chosen;
    botActionText = `🤖 Bot played **${chosen}**.`;
    // special effects
    if (chosen.endsWith("+2")) {
      for (let i = 0; i < 2; i++) {
        if (!game.deck || game.deck.length === 0) {
          const topCard = game.discard.pop();
          game.deck = shuffle(game.discard);
          game.discard = [topCard];
        }
        game.playerHand.push(game.deck.pop());
      }
      botActionText += ` You draw 2 cards.`;
    }
    if (chosen.endsWith("skip") || chosen.endsWith("reverse")) {
      // in 1v1, bot's skip gives bot another turn; we implement bot taking another turn recursively
      game.turn = "bot";
      await ref.set(game, { merge: true });
      // send bot action message, delete after 3s, update embed, then continue bot turn
      if (channel && channel.send) {
        const m = await channel.send({ content: botActionText });
        setTimeout(() => safeDelete(m), 3000);
      }
      await updateUnoEmbed(game);
      // short delay to simulate thinking
      await new Promise((r) => setTimeout(r, 800));
      return botPlayTurn(userId);
    }
  } else {
    // draw one
    if (!game.deck || game.deck.length === 0) {
      const topCard = game.discard.pop();
      game.deck = shuffle(game.discard);
      game.discard = [topCard];
    }
    const drawn = game.deck.pop();
    game.botHand.push(drawn);
    botActionText = `🤖 Bot drew a card.`;
  }

  game.turn = "player";
  game.lastAction = Date.now();
  await ref.set(game, { merge: true });
  await updateUnoEmbed(game);

  // send bot action message, remove after 3s
  if (channel && channel.send) {
    const botMsg = await channel.send({ content: botActionText });
    setTimeout(() => safeDelete(botMsg), 3000);
  }

  // check bot win
  if (game.botHand.length === 0) {
    // bot won; game over, player loses bet (already deducted)
    if (user) {
      const loseMsg = await client.channels.fetch(game.channelId).then((ch) => ch.send(`${user}, the bot has no cards left — you lost your bet of $${game.bet}.`)).catch(() => null);
      if (loseMsg) setTimeout(() => safeDelete(loseMsg), 5000);
    }
    await endGameCleanup(userId, "bot_win", "bot won");
  }
}

// Timeout handler for inactivity
function scheduleGameTimeout(userId, ms = 2 * 60 * 1000) {
  if (gameTimeouts.get(userId)) clearTimeout(gameTimeouts.get(userId));
  const t = setTimeout(async () => {
    const ref = db.collection("unoGames").doc(userId);
    const doc = await ref.get();
    if (!doc.exists) return;
    const game = doc.data();
    // timeout: no refund per your spec (they lose)
    try {
      const ch = await client.channels.fetch(game.channelId);
      const user = await client.users.fetch(userId);
      if (ch && ch.send) {
        const m = await ch.send(`${user}, your UNO game timed out due to inactivity. Your bet of $${game.bet} was lost.`);
        setTimeout(() => safeDelete(m), 5000);
      }
    } catch {}
    await endGameCleanup(userId, "timeout", "timeout");
  }, ms);
  gameTimeouts.set(userId, t);
}

// --- Message handling ---
client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;
    // Only process commands in the configured channel for !g commands OR in private game channels for !uno actions
    const startsWithG = message.content.startsWith("!g");
    const startsWithUno = message.content.startsWith("!uno");

    if (!startsWithG && !startsWithUno) return;

    // dedupe
    if (processedMessages.has(message.id)) return;
    processedMessages.add(message.id);
    setTimeout(() => processedMessages.delete(message.id), 30000);

    // Add thinking reaction if available
    if (THINKING_EMOJI) {
      try {
        await message.react(THINKING_EMOJI);
      } catch {}
    }

    if (startsWithG) {
      // enforce !g commands only in configured public channel
      if (message.channel.id !== CHANNEL_ID) {
        await safeRemoveReactions(message);
        return;
      }
      await handleGCommand(message);
    } else if (startsWithUno) {
      // UNO action command: ensure it's in a private game channel belonging to the user
      await handleUnoCommand(message);
    }

    // remove reaction we added
    if (THINKING_EMOJI) {
      try {
        await message.reactions.removeAll();
      } catch {}
    }
  } catch (e) {
    console.error("[ERROR] messageCreate:", e);
  }
});

// --- Handler: !g commands (balance, claim, roulette, blackjack, leaderboard, gift, uno start) ---
async function handleGCommand(message) {
  const args = message.content.trim().split(/\s+/);
  const cmd = args[1]?.toLowerCase();

  const userRef = db.collection("users").doc(message.author.id);
  const userDoc = await userRef.get();
  const userData = userDoc.exists ? userDoc.data() : {};
  let balance = userData.balance ?? 1000;
  let lastClaim = userData.lastClaim ?? 0;

  // ensure doc
  await userRef.set({ username: message.author.username, balance, lastClaim }, { merge: true });

  switch (cmd) {
    case "help": {
  const helpMsg = await message.reply(
    "**Available Commands:**\n" +
      "`!g help` - Show this help menu\n" +
      "`!g balance` - Check your balance\n" +
      "`!g roulette <red|black|odd|even> <amount>` - Bet on roulette\n" +
      "`!g blackjack <amount>` - Play blackjack\n" +
      "`!g claim` - Claim $100 when broke (every 24h)\n" +
      "`!g gift @user <amount|all>` - Gift money to another player\n" +
      "`!g leaderboard` - Show top 5 richest players\n" +
      "`!g uno <bet>` - Start single-player UNO vs bot (creates private channel)"
  );

  setTimeout(() => {
    helpMsg.delete().catch(()=>{});
  }, 30000);

  break;
}


    case "balance":
      return message.reply(`${message.author}, your balance is **$${balance}**.`);

    case "claim": {
      if (balance > 0) return message.reply(`${message.author}, you still have money. You can only claim when broke.`);
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
      if (!betType || isNaN(betAmount)) return message.reply(`${message.author}, usage: \`!g roulette <red|black|odd|even> <amount>\``);
      if (betAmount <= 0 || betAmount > balance) return message.reply(`${message.author}, invalid bet amount.`);
      const valid = ["red", "black", "odd", "even"];
      if (!valid.includes(betType)) return message.reply(`${message.author}, valid bets: red, black, odd, even.`);
      const spin = Math.floor(Math.random() * 36) + 1;
      const color = spin % 2 === 0 ? "black" : "red";
      const parity = spin % 2 === 0 ? "even" : "odd";
      const win = betType === color || betType === parity;
      balance += win ? betAmount : -betAmount;
      await userRef.set({ balance }, { merge: true });
      return message.reply(`${message.author}, you ${win ? "won" : "lost"}! The ball landed on **${spin} (${color})**. New balance: **$${balance}**.`);
    }

    case "leaderboard": {
      const snapshot = await db.collection("users").orderBy("balance", "desc").get();
      const top5 = snapshot.docs.slice(0, 5);
      const lines = await Promise.all(top5.map(async (d, i) => {
        const u = d.data();
        const user = await client.users.fetch(d.id).catch(() => null);
        return `${i + 1}. ${user?.username || "Unknown"} - $${u.balance}`;
      }));
      return message.reply(`**Top 5 Richest Players:**\n${lines.join("\n")}`);
    }

    case "blackjack": {
  const betAmount = parseInt(args[2]);
  if (isNaN(betAmount) || betAmount <= 0 || betAmount > balance)
    return message.reply(`${message.author}, invalid bet amount.`);

  balance -= betAmount;
  await userRef.set({ balance }, { merge: true });

  // --- CARD SETUP ---
  const suits = ["♠", "♥", "♦", "♣"];
  const values = [
    "A", "2", "3", "4", "5", "6",
    "7", "8", "9", "10", "J", "Q", "K"
  ];

  const deck = [];
  for (const suit of suits) {
    for (const value of values) {
      deck.push({ value, suit });
    }
  }

  function drawCard() {
    return deck.splice(Math.floor(Math.random() * deck.length), 1)[0];
  }

  function calculate(hand) {
    let total = 0;
    let aces = 0;

    for (const card of hand) {
      if (["J", "Q", "K"].includes(card.value)) total += 10;
      else if (card.value === "A") {
        total += 11;
        aces++;
      } else total += parseInt(card.value);
    }

    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }
    return total;
  }

  // --- 🔥 LOAD / SAVE STREAK ---
  const statsRef = db.collection("users")
    .doc(message.author.id)
    .collection("stats")
    .doc("blackjack");

  const statsSnap = await statsRef.get();
  let streak = statsSnap.exists ? statsSnap.data().streak || 0 : 0;

  async function saveStreak(newStreak) {
    await statsRef.set({ streak: newStreak }, { merge: true });
  }

  // --- CHEATING LOGIC ---
  // cheatingLevel = 0 when streak = 0
  // cheatingLevel = 10 when streak >= 10
  const cheatingLevel = Math.min(streak, 10);
  const dealerBias = cheatingLevel / 10;

  // Dealer sometimes draws better cards than random
  function biasedDrawCard() {
    if (Math.random() > dealerBias) return drawCard(); // fair draw

    const goodCards = deck.filter(c => ["10", "J", "Q", "K", "A"].includes(c.value));
    if (goodCards.length === 0) return drawCard();

    const idx = deck.indexOf(goodCards[Math.floor(Math.random() * goodCards.length)]);
    return deck.splice(idx, 1)[0];
  }

  // --- INITIAL HANDS ---
  const playerHand = [drawCard(), drawCard()];
  const dealerHand = [biasedDrawCard(), biasedDrawCard()];

  let playerTotal = calculate(playerHand);
  let dealerTotal = calculate(dealerHand);

  // EMBED HELPER
  function buildEmbed(showDealerHole = false) {
    return new EmbedBuilder()
      .setColor("Green")
      .setTitle("🎰 Blackjack")
      .addFields(
        {
          name: "Your Hand",
          value: `${playerHand.map(c => `${c.value}${c.suit}`).join(" ")} = **${playerTotal}**`,
          inline: false,
        },
        {
          name: "Dealer Hand",
          value: showDealerHole
            ? `${dealerHand.map(c => `${c.value}${c.suit}`).join(" ")} = **${dealerTotal}**`
            : `${dealerHand[0].value}${dealerHand[0].suit} [Hidden]`,
          inline: false,
        },
        {
          name: "Current Streak",
          value: streak.toString(),
          inline: false,
        }
      );
  }

  // SEND INITIAL EMBED
  const gameMessage = await message.reply({
    embeds: [buildEmbed(false)],
  });

  // --- GAME LOOP ---
  const filter = (m) =>
    m.author.id === message.author.id &&
    ["hit", "stand", "h", "s"].includes(m.content.toLowerCase());

  const collector = message.channel.createMessageCollector({ filter, time: 60000 });

  collector.on("collect", async (msg) => {
    const input = msg.content.toLowerCase();

    if (["hit", "h"].includes(input)) {
      playerHand.push(drawCard());
      playerTotal = calculate(playerHand);

      if (playerTotal > 21) {
        collector.stop("bust");
      } else {
        await gameMessage.edit({ embeds: [buildEmbed(false)] });
      }
    }

    if (["stand", "s"].includes(input)) {
      collector.stop("stand");
    }
  });

  collector.on("end", async (_, reason) => {
    if (reason === "time") {
      return gameMessage.edit("Game timed out.");
    }

    // Dealer draws until >= 17
    while (dealerTotal < 17 && reason !== "bust") {
      dealerHand.push(biasedDrawCard());
      dealerTotal = calculate(dealerHand);
    }

    let result = "";
    let winnings = 0;

    if (reason === "bust") {
      result = "You busted! Dealer wins.";
      streak = 0;
    } else if (dealerTotal > 21) {
      result = "Dealer busts! You win!";
      winnings = betAmount * 2;
      balance += winnings;
      streak++;
    } else if (playerTotal > dealerTotal) {
      result = "You win!";
      winnings = betAmount * 2;
      balance += winnings;
      streak++;
    } else if (playerTotal < dealerTotal) {
      result = "Dealer wins.";
      streak = 0;
    } else {
      result = "It's a tie!";
      balance += betAmount;
    }

    await userRef.set({ balance }, { merge: true });
    await saveStreak(streak);

    await gameMessage.edit({
      embeds: [
        buildEmbed(true).setFooter({
          text: `${result}   |   New Streak: ${streak}`,
        }),
      ],
    });
  });

  break;
}


    case "gift": {
      const target = message.mentions.users.first();
      const amountArg = args[3];
      if (!target) return message.reply(`${message.author}, you need to mention someone to gift money to.`);
      if (target.bot) return message.reply(`${message.author}, you can’t gift money to bots.`);
      if (target.id === message.author.id) return message.reply(`${message.author}, you can’t gift yourself.`);
      if (!amountArg) return message.reply(`${message.author}, usage: \`!g gift @user <amount|all>\``);
      let amount;
      if (amountArg.toLowerCase() === "all") {
        if (balance <= 0) return message.reply(`${message.author}, you have no money to gift.`);
        amount = balance;
      } else {
        amount = parseInt(amountArg);
        if (isNaN(amount) || amount <= 0) return message.reply(`${message.author}, please enter a valid amount or use \`all\`.`);
        if (amount > balance) return message.reply(`${message.author}, you don’t have enough money to gift that amount.`);
      }
      const targetRef = db.collection("users").doc(target.id);
      const targetDoc = await targetRef.get();
      if (!targetDoc.exists) {
        await targetRef.set({ username: target.username, balance: 1000, lastClaim: 0 });
      }
      const targetData = (await targetRef.get()).data();
      const targetBalance = (targetData.balance ?? 1000) + amount;
      balance -= amount;
      await userRef.set({ balance }, { merge: true });
      await targetRef.set({ balance: targetBalance, username: target.username }, { merge: true });
      return message.reply(`${message.author} gifted ${target.username} **$${amount}**.\nYour new balance: **$${balance}**.`);
    }
case "uno": {
  // Usage: !g uno <bet>
  const bet = parseInt(args[2]);
  if (isNaN(bet) || bet <= 0) return message.reply("Please enter a valid bet amount. Usage: `!g uno <bet>`");

  // user balance check & deduction
  const userRef = db.collection("users").doc(message.author.id);
  const userDoc = await userRef.get();
  const userData = userDoc.exists ? userDoc.data() : { balance: 0 };
  const balance = userData.balance ?? 0;
  if (balance < bet) return message.reply("You don't have enough money for that bet.");
  await userRef.set({ balance: balance - bet }, { merge: true });

  // build deck utilities
  const COLORS = ["Red", "Yellow", "Green", "Blue"];
  const VALUES = ["0","1","2","3","4","5","6","7","8","9","Skip","Reverse","Draw 2"];
  function makeDeck() {
    const d = [];
    for (const c of COLORS) {
      d.push({ color: c, value: "0" });
      for (const v of VALUES.slice(1)) {
        d.push({ color: c, value: v }, { color: c, value: v });
      }
    }
    for (let i = 0; i < 4; i++) { d.push({ color: "Wild", value: "Wild" }); d.push({ color: "Wild", value: "Draw 4" }); }
    return d.sort(() => Math.random() - 0.5);
  }
  function cardToString(card) { return card.color === "Wild" ? `${card.value}` : `${card.color} ${card.value}`; }
  function shuffleDeck(arr) { return arr.sort(() => Math.random() - 0.5); }

  // create unique channel per user (suffix by last 4 of id) and remove exact previous
  const safeBase = `uno-${message.author.username.toLowerCase().replace(/[^a-z0-9]/g,"")}`;
  const channelName = `${safeBase}-${message.author.id.slice(-4)}`;
  const prior = message.guild.channels.cache.find(c => c.name === channelName && c.type === 0);
  if (prior) await prior.delete().catch(()=>{});

  const parentCat = message.guild.channels.cache.get(UNO_CATEGORY_ID);
  const gameChannel = await message.guild.channels.create({
    name: channelName,
    type: 0,
    parent: parentCat?.id ?? undefined,
    permissionOverwrites: [
      { id: message.guild.roles.everyone.id, deny: ["ViewChannel"] },
      { id: message.author.id, allow: ["ViewChannel","SendMessages","ReadMessageHistory"] },
      { id: client.user.id, allow: ["ViewChannel","SendMessages","ReadMessageHistory","ManageMessages","EmbedLinks"] }
    ],
    reason: `UNO channel for ${message.author.tag}`
  });

  // initial game state
  let deck = makeDeck();
  let pile = [];
  let playerHand = deck.splice(0,7);
  let botHand = deck.splice(0,7);

  // pick a non-wild top
  let top = deck.pop();
  while (top.value === "Wild" || top.value === "Draw 4") { deck.unshift(top); top = deck.pop(); }
  pile.push(top);
  let currentColor = top.color;
  let currentValue = top.value;

  let playerTurn = true;
  let winner = null;

  // helper: when deck empty, rebuild from pile (keep top)
  function ensureDeck() {
    if (deck.length === 0 && pile.length > 1) {
      const topCard = pile.pop();
      deck = shuffleDeck(pile);
      pile = [topCard];
    }
  }
  function drawInto(hand, n = 1) {
    for (let i = 0; i < n; i++) {
      ensureDeck();
      if (deck.length === 0) break;
      hand.push(deck.pop());
    }
  }
  function canPlayOn(card) {
    if (!card) return false;
    if (card.value === "Wild" || card.value === "Draw 4") return true;
    if (card.color === currentColor) return true;
    if (card.value === currentValue) return true;
    return false;
  }

  // persistent embed
  const makeEmbed = () => new EmbedBuilder()
    .setTitle(`UNO vs Bot — Bet: $${bet}`)
    .setColor(playerTurn ? 0x22cc66 : 0xff8844)
    .setDescription(
      `**Top Card:** ${currentColor} ${currentValue}\n` +
      `**Your Hand:** ${playerHand.map(cardToString).join(", ") || "(empty)"}\n` +
      `**Bot Cards:** ${botHand.length}\n` +
      `**Turn:** ${playerTurn ? "Your move" : "Bot's move"}`
    )
    .setFooter({ text: `Use "!uno help" for a list of commands` });

  const statusMsg = await gameChannel.send({ content: `${message.author}`, embeds: [makeEmbed()] });

  // transient messenger
  async function temp(text, ttl = 3500) {
    try {
      const m = await gameChannel.send(text);
      setTimeout(() => m.delete().catch(()=>{}), ttl);
    } catch {}
  }

  // bot logic (handles immediate repeats when skip/reverse effect gives bot extra turn)
async function botPlayLoop() {

  // HARD STOP: bot already won, do nothing
  if (winner === "bot" || botHand.length === 0) {
    winner = "bot";
    return;
  }

  let extra = true;
  let loopLimit = 6;


  while (extra && loopLimit-- > 0) {
    extra = false;
    await new Promise(r => setTimeout(r, 700));
    ensureDeck();

    const idx = botHand.findIndex(canPlayOn);

    if (idx === -1) {
      drawInto(botHand, 1);
      await temp("🤖 Bot drew a card.");
      playerTurn = true; // player's turn next
      await statusMsg.edit({ embeds: [makeEmbed()] });
      return;
    }

    const played = botHand.splice(idx, 1)[0];
    pile.push(played);

    // choose color for wilds
    if (played.value === "Wild" || played.value === "Draw 4") {
      const counts = { Red:0, Yellow:0, Green:0, Blue:0 };
      for (const c of botHand) if (c.color && counts[c.color] !== undefined) counts[c.color]++;
      currentColor = Object.keys(counts).reduce((a,b) => counts[a] >= counts[b] ? a : b);
    } else {
      currentColor = played.color;
    }
    currentValue = played.value;

    let actionText = `🤖 Bot played **${cardToString(played)}**.`;

    // Effects: bot +2/+4/skip/reverse forces bot to play again
    if (played.value === "Draw 2") {
      drawInto(playerHand, 2);
      actionText += ` You draw 2 cards. Bot plays again.`;
      extra = true;
      playerTurn = false;
    } else if (played.value === "Draw 4") {
      drawInto(playerHand, 4);
      actionText += ` You draw 4 cards. Bot plays again.`;
      extra = true;
      playerTurn = false;
    } else if (played.value === "Skip" || played.value === "Reverse") {
      actionText += ` Your turn is skipped. Bot plays again.`;
      extra = true;
      playerTurn = false;
    } else {
      playerTurn = true;
    }

    await temp(actionText);
    await statusMsg.edit({ embeds: [makeEmbed()] });

    // Win check (stop immediately)
if (botHand.length === 0) {
  winner = "bot";
  await statusMsg.edit({ embeds: [makeEmbed()] }).catch(()=>{});
  return;
}

  }

  if (!playerTurn) playerTurn = true;
  await statusMsg.edit({ embeds: [makeEmbed()] });
}


  // collector inside game channel for player's !uno commands
  const filter = m => m.author.id === message.author.id && m.content.toLowerCase().startsWith("!uno");
  const collector = gameChannel.createMessageCollector({ filter, time: 10 * 60 * 1000 });

  collector.on("collect", async m => {
    // try react but never block
    if (winner) return;
    if (THINKING_EMOJI) m.react(THINKING_EMOJI).catch(()=>{});
    const parts = m.content.trim().split(/\s+/).slice(1).map(p => p.toLowerCase());
    m.delete().catch(()=>{});

    if (!playerTurn) {
      await temp(`${message.author}, wait for your turn.`);
      return;
    }

    const sub = parts[0];
    if (!sub) { await temp("Usage: `!uno play <color> <value>` | `!uno draw` | `!uno endgame`"); return; }

    // HELP
    if (sub === "help") {
      await m.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("UNO — Commands")
            .setDescription(
              "`!uno play <color> <value>` — play a card\n" +
              "`!uno play wild <color>` — play Wild and choose color\n" +
              "`!uno play draw 4 <color>` — play Wild Draw 4 and choose color\n" +
              "`!uno draw` — draw 1 card (ends your turn)\n" +
              "`!uno endgame` — forfeit and end game"
            )
        ]
      }).then(mm => setTimeout(()=>mm.delete().catch(()=>{}), 12000)).catch(()=>{});
      return;
    }

    // ENDGAME
    if (sub === "endgame") {
      winner = "bot";
      await gameChannel.send(`${message.author}, you ended the game and lost your $${bet}.`).catch(()=>{});
      collector.stop("ended");
      return;
    }

    // DRAW
    if (sub === "draw") {
      drawInto(playerHand, 1);
      await temp(`${message.author}, you drew ${cardToString(playerHand[playerHand.length-1])}.`);
      playerTurn = false;
      await statusMsg.edit({ embeds: [makeEmbed()] });
      // bot turn
      if (!winner) return botPlayLoop();
    }

    // PLAY
    if (sub === "play") {
      const rest = parts.slice(1).join(" ").trim();
      if (!rest) { await temp("Usage: `!uno play <color> <value>`"); return; }

      // normalize patterns
      const normalized = rest.replace(/draw4/gi,"draw 4").replace(/draw2/gi,"draw 2").replace(/\s+/g," ").trim();
      let chosenColor = null, chosenValue = null;

      // draw 4 pattern
      const mDraw4 = normalized.match(/^(?:draw 4|draw4)\s*(red|green|blue|yellow)?$/i) || normalized.match(/^(?:draw 4|draw4)\s+(red|green|blue|yellow)$/i);
      if (mDraw4) {
        chosenValue = "Draw 4";
        chosenColor = (mDraw4[1] || "").toLowerCase() || null;
      } else {
        // wild
        const mWild = normalized.match(/^wild\s*(red|green|blue|yellow)?$/i);
        if (mWild) {
          chosenValue = "Wild";
          chosenColor = (mWild[1] || "").toLowerCase() || null;
        } else {
          const parts2 = normalized.split(" ");
          if (["red","green","blue","yellow"].includes(parts2[0])) {
            chosenColor = parts2[0];
            chosenValue = parts2.slice(1).join(" ");
          } else if (["red","green","blue","yellow"].includes(parts2[parts2.length-1])) {
            chosenColor = parts2[parts2.length-1];
            chosenValue = parts2.slice(0, parts2.length-1).join(" ");
          } else {
            chosenValue = normalized;
          }
        }
      }

      if (chosenColor) chosenColor = chosenColor.charAt(0).toUpperCase() + chosenColor.slice(1).toLowerCase();
      if (chosenValue) chosenValue = chosenValue.replace(/\b\w/g, c => c.toUpperCase());

      // Build target search but be flexible for Wild/Draw 4 (those are stored with color === "Wild")
      const target = chosenColor ? `${chosenColor} ${chosenValue}` : `${chosenValue}`;
      // find index:
      let idx = -1;
      if (chosenValue === "Draw 4") {
        // find a Draw 4 in hand regardless of color (Draw 4 stored as {color:"Wild", value:"Draw 4"})
        idx = playerHand.findIndex(c => c.value === "Draw 4");
      } else if (chosenValue === "Wild") {
        idx = playerHand.findIndex(c => c.value === "Wild");
      } else {
        idx = playerHand.findIndex(c => cardToString(c).toLowerCase() === target.toLowerCase());
      }

      // if user typed color+value but the card in hand is stored as Wild (e.g. user typed "draw 4 red" or "wild red"),
      // allow matching the hand's wild/draw4 too (defensive).
      if (idx === -1 && (chosenValue === "Draw 4" || chosenValue === "Wild")) {
        idx = playerHand.findIndex(c => c.value === chosenValue);
      }

      if (idx === -1) { await temp(`${message.author}, you don't have ${target}.`); return; }

      const card = playerHand[idx];
      // legality: Draw 4 / Wild can be played anytime (here we allow Draw 4 always), others must match color or value
      if (!(card.value === "Wild" || card.value === "Draw 4" || card.color === currentColor || card.value === currentValue)) {
        await temp(`${message.author}, you can't play ${cardToString(card)} on ${currentColor} ${currentValue}.`);
        return;
      }

      // if wild/draw4 require a chosen color argument
      if ((card.value === "Wild" || card.value === "Draw 4") && !chosenColor) {
        await temp(`${message.author}, you must specify a color: red, green, blue, yellow. Example: \`!uno play draw 4 red\``);
        return;
      }

      // remove from hand and place on pile
      playerHand.splice(idx,1);
      pile.push(card);
      if (card.value === "Wild" || card.value === "Draw 4") {
        currentColor = chosenColor;
      } else {
        currentColor = card.color;
      }
      currentValue = card.value;
      await temp(`${message.author} played **${cardToString(card)}**.`);

      // effects for player's play
      if (card.value === "Draw 2") {
        drawInto(botHand, 2);
        await temp("Bot draws 2 cards.");
        // per requested behavior: draw cards skip the bot's turn -> player keeps the turn
        playerTurn = true;
      } else if (card.value === "Draw 4") {
        drawInto(botHand, 4);
        await temp("Bot draws 4 cards.");
        playerTurn = true;
      } else if (card.value === "Skip" || card.value === "Reverse") {
        // Reverse acts as skip in 1v1: player keeps turn again
        await temp("Bot's turn skipped.");
        playerTurn = true;
      } else {
        // normal card -> bot's turn
        playerTurn = false;
      }

      // win check
      if (playerHand.length === 0) {
        winner = "player";
        collector.stop("player_won");
        return;
      }

      await statusMsg.edit({ embeds: [makeEmbed()] });

      if (!playerTurn) {
        // bot gets to play
        if (!winner) return botPlayLoop();
      }
      return;
    }

    // unknown sub
    await temp("Unknown command. Use `!uno play`, `!uno draw`, `!uno endgame`, or `!uno help`.");
  });

  collector.on("end", async (_, reason) => {
    try {
      if (winner === "player") {
        // payout: player already had bet deducted; return original + winnings => add bet*2
        const uRef = db.collection("users").doc(message.author.id);
        const uDoc = await uRef.get();
        const prev = uDoc.exists ? uDoc.data().balance ?? 0 : 0;
        await uRef.set({ balance: prev + bet * 2 }, { merge: true });
        await gameChannel.send(`${message.author}, you won! You earned $${bet * 2}!`).catch(()=>{});
      } else if (winner === "bot") {
        await gameChannel.send(`${message.author}, bot won — you lost your $${bet}.`).catch(()=>{});
      } else {
        // timeout or ended by user
        await gameChannel.send(`${message.author}, UNO ended. You lost your $${bet}.`).catch(()=>{});
      }
    } catch (e) {
      console.error("UNO end cleanup error", e);
    } finally {
      setTimeout(() => gameChannel.delete().catch(()=>{}), 4000);
    }
  });

  break;
}
  }
}
// --- Express keepalive ---
const app = express();
app.get("/", (_, res) => res.send("Bot is running."));
app.listen(PORT || 3000, () => console.log(`[DEBUG] Listening on port ${PORT || 3000}`));

// --- Login ---
client.login(TOKEN);
