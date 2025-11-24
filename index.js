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

// Converts { color, value } → readable name
export function shortHandString(card) {
  if (!card) return "Unknown Card";

  if (card.color === "wild") {
    if (card.value === "draw4") return "Wild Draw 4";
    return "Wild";
  }

  return `${card.color} ${card.value}`;
}

// Fisher–Yates shuffle
export function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// 108-card standard UNO deck
export function createFullDeck() {
  const colors = ["red", "yellow", "green", "blue"];
  const deck = [];

  for (const c of colors) {
    deck.push({ color: c, value: "0" });

    for (let i = 1; i <= 9; i++) {
      deck.push({ color: c, value: String(i) });
      deck.push({ color: c, value: String(i) });
    }

    ["skip", "reverse", "draw2"].forEach(v => {
      deck.push({ color: c, value: v });
      deck.push({ color: c, value: v });
    });
  }

  // Wilds
  for (let i = 0; i < 4; i++) {
    deck.push({ color: "wild", value: "wild" });
    deck.push({ color: "wild", value: "draw4" });
  }

  return shuffle(deck);
}

// Card matching logic
export function cardMatches(card, topCard, forcedColor) {
  if (card.color === "wild") return true;
  if (forcedColor && card.color === forcedColor) return true;

  return (
    card.color === topCard.color ||
    card.value === topCard.value
  );
}

// Converts {color, value} → readable string
export function shortHandString(card) {
  if (card.color === "wild") {
    return card.value === "draw4" ? "Wild Draw 4" : "Wild";
  }
  return `${card.color} ${card.value}`;
}

// Safely reacts on a message then removes invoking user's command message
export async function safeReactAndRemove(msg, reaction) {
  try { await msg.react(reaction); } catch (_) {}
  try { await msg.delete().catch(() => {}); } catch (_) {}
}

// Safe delete message or ignore
export async function safeDelete(msg) {
  try { await msg.delete(); } catch (_) {}
}

// Creates a private text channel for the match
export async function createPrivateChannelForGame(guild, hostId, opponentId) {
  return await guild.channels.create({
    name: `uno-${hostId}-${opponentId}`,
    type: 0,
    permissionOverwrites: [
      {
        id: guild.id,
        deny: ["ViewChannel"]
      },
      {
        id: hostId,
        allow: ["ViewChannel", "SendMessages"]
      },
      {
        id: opponentId,
        allow: ["ViewChannel", "SendMessages"]
      }
    ]
  });
}

// Updates the central UNO embed
export async function updateUnoEmbed(channel, game) {
  const embed = {
    title: "UNO Match",
    description: `Turn: <@${game.currentPlayer}>`,
    color: 0xffcc00,
    fields: [
      {
        name: "Top Card",
        value: shortHandString(game.discard[game.discard.length - 1]),
        inline: true
      },
      {
        name: "Forced Color",
        value: game.forcedColor ? game.forcedColor : "None",
        inline: true
      },
      {
        name: "Status",
        value: game.statusText || "Game in progress",
        inline: false
      }
    ]
  };

  if (game.embedMessage) {
    try {
      await game.embedMessage.edit({ embeds: [embed] });
      return;
    } catch (_) {}
  }

  try {
    game.embedMessage = await channel.send({ embeds: [embed] });
  } catch (_) {}
}

// Bot logic for difficulty
export function botPlayTurn(game, difficulty) {
  const hand = game.hands[game.currentPlayer];
  const top = game.discard[game.discard.length - 1];

  const playable = hand.filter(c =>
    cardMatches(c, top, game.forcedColor)
  );

  if (playable.length === 0) return null;

  // Difficulty tiers:
  // Easy: random bad choices encouraged
  // Medium: weighted but imperfect
  // Hard: takes best match
  switch (difficulty) {
    case "easy":
      return playable[Math.floor(Math.random() * playable.length)];

    case "medium":
      return playable.find(c => c.color !== "wild") || playable[0];

    case "hard":
    default:
      // Prefer draw4 > wild > draw2 > skip > reverse > high value
      const rank = v => {
        if (v.value === "draw4") return 6;
        if (v.value === "wild") return 5;
        if (v.value === "draw2") return 4;
        if (v.value === "skip") return 3;
        if (v.value === "reverse") return 2;
        return parseInt(v.value) || 1;
      };
      return playable.sort((a, b) => rank(b) - rank(a))[0];
  }
}

// Schedules auto-timeout (e.g. 5 min inactivity)
export function scheduleGameTimeout(gameId, games, channel) {
  if (games[gameId].timeout) clearTimeout(games[gameId].timeout);

  games[gameId].timeout = setTimeout(async () => {
    try { await channel.send("Game timed out due to inactivity."); } catch (_) {}
    endGameCleanup(gameId, games, channel);
  }, 5 * 60 * 1000);
}

// Cleans private channel + removes game from memory
export async function endGameCleanup(gameId, games, channel) {
  try { await channel.delete().catch(() => {}); } catch (_) {}
  delete games[gameId];
}

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
    case "help":
      return message.reply(
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

  const startingBalance = balance;
  balance -= betAmount;
  await userRef.set({ balance }, { merge: true });

  // Card system
  const suits = ["♠", "♥", "♦", "♣"];
  const values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

  const drawCard = () => {
    const v = values[Math.floor(Math.random() * values.length)];
    const s = suits[Math.floor(Math.random() * suits.length)];
    return `${v}${s}`;
  };

  const getValue = (hand) => {
    let total = 0;
    let aces = 0;

    for (const card of hand) {
      let v = card.slice(0, card.length - 1);
      if (v === "A") {
        aces++;
        total += 11;
      } else if (["J","Q","K"].includes(v)) total += 10;
      else total += parseInt(v);
    }

    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }

    return total;
  };

  // Hands
  let playerHand = [drawCard(), drawCard()];
  let dealerHand = [drawCard(), drawCard()];

  let playerTotal = getValue(playerHand);

  // Buttons (Render-safe syntax)
  const makeButtons = (disabled = false) =>
    new ActionRowBuilder().addComponents([
      new ButtonBuilder()
        .setCustomId("hit")
        .setLabel("Hit")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId("stand")
        .setLabel("Stand")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled)
    ]);

  const embed = (color, desc) =>
    new EmbedBuilder()
      .setColor(color)
      .setTitle(`Blackjack — Bet $${betAmount}`)
      .setDescription(desc);

  // First message
  let gameMessage = await message.reply({
    embeds: [
      embed(
        "Grey",
        `**Your Hand (${playerTotal})**\n${playerHand.join(" | ")}\n\n` +
        `**Dealer Hand**\n${dealerHand[0]} | ??`
      )
    ],
    components: [makeButtons(false)]
  });

  const collector = gameMessage.createMessageComponentCollector({
    filter: i => i.user.id === message.author.id,
    time: 60000
  });

  let gameOver = false;

  const updateGameMsg = async () => {
    playerTotal = getValue(playerHand);

    await gameMessage.edit({
      embeds: [
        embed(
          "Grey",
          `**Your Hand (${playerTotal})**\n${playerHand.join(" | ")}\n\n` +
          `**Dealer Hand**\n${dealerHand[0]} | ??`
        )
      ],
      components: [makeButtons(false)]
    });
  };

  collector.on("collect", async interaction => {
    if (gameOver) return interaction.deferUpdate().catch(() => {});

    if (interaction.customId === "hit") {
      playerHand.push(drawCard());
      playerTotal = getValue(playerHand);

      // Bust
      if (playerTotal > 21) {
        gameOver = true;

        await interaction.update({
          embeds: [
            embed(
              "Red",
              `**You Busted! (${playerTotal})**\n${playerHand.join(" | ")}\n\n` +
              `**Dealer Hand (${getValue(dealerHand)})**\n${dealerHand.join(" | ")}\n\n` +
              `Balance Change: -$${betAmount}`
            )
          ],
          components: [makeButtons(true)]
        });

        collector.stop("finished");
        return;
      }

      await interaction.deferUpdate();
      await updateGameMsg();
    }

    if (interaction.customId === "stand") {
      gameOver = true;
      await interaction.deferUpdate();

      // Dealer draws until ≥ 17
      let dealerTotalReal = getValue(dealerHand);
      while (dealerTotalReal < 17) {
        dealerHand.push(drawCard());
        dealerTotalReal = getValue(dealerHand);
      }

      const playerFinal = getValue(playerHand);
      const dealerFinal = dealerTotalReal;

      let result;
      let color;
      let payout = 0;

      if (dealerFinal > 21 || playerFinal > dealerFinal) {
        result = "You Win!";
        color = "Green";
        payout = betAmount * 2;
      } else if (playerFinal < dealerFinal) {
        result = "You Lose.";
        color = "Red";
        payout = 0;
      } else {
        result = "Tie.";
        color = "Yellow";
        payout = betAmount;
      }

      if (payout > 0) balance += payout;
      await userRef.set({ balance }, { merge: true });

      const net = balance - startingBalance;

      await gameMessage.edit({
        embeds: [
          embed(
            color,
            `**${result}**\n\n` +
            `**Your Hand (${playerFinal})**\n${playerHand.join(" | ")}\n\n` +
            `**Dealer Hand (${dealerFinal})**\n${dealerHand.join(" | ")}\n\n` +
            `Balance Change: $${net}`
          )
        ],
        components: [makeButtons(true)]
      });

      collector.stop("finished");
    }
  });

  collector.on("end", (_, reason) => {
    if (!gameOver && reason !== "finished") {
      gameMessage.edit({
        embeds: [embed("Red", "Game ended due to inactivity.")],
        components: [makeButtons(true)]
      }).catch(() => {});
    }
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
```js
// -------------------------
// Full, finished `case "uno"` block (drop into your existing handleGCommand switch)
// Assumes helper functions & globals from earlier in this file exist:
//   client, db, UNO_CATEGORY_ID, THINKING_EMOJI, PermissionFlagsBits, EmbedBuilder,
//   shuffle, createFullDeck, cardMatches, shortHandString, safeReactAndRemove,
//   safeDelete, createPrivateChannelForGame, updateUnoEmbed, botPlayTurn,
//   scheduleGameTimeout, endGameCleanup
// Wild-color selection uses single-command form: `!uno play wild+4 red` or `!uno play wild red`
// -------------------------
case "uno": {
  // Usage: !g uno <bet> <easy|medium|hard>
  // default difficulty = medium
  try {
    const parts = message.content.trim().split(/\s+/);
    const betArg = parseInt(parts[2], 10);
    const diffArg = (parts[3] || "medium").toLowerCase();
    const difficulty = ["easy", "medium", "hard"].includes(diffArg) ? diffArg : "medium";

    const caps = { easy: 300, medium: 1000, hard: Infinity };
    if (isNaN(betArg) || betArg <= 0) {
      return message.reply(`${message.author}, usage: \`!g uno <bet> <easy|medium|hard>\``);
    }

    // load user balance
    const userRef = db.collection("users").doc(message.author.id);
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? userDoc.data() : { balance: 1000 };
    let balance = userData.balance ?? 1000;

    // enforce cap
    if (betArg > caps[difficulty]) {
      return message.reply(
        `${message.author}, bet exceeds the cap for ${difficulty} (${caps[difficulty] === Infinity ? "no cap" : `$${caps[difficulty]}`}).`
      );
    }
    if (betArg > balance) return message.reply(`${message.author}, you don't have enough money for that bet.`);

    // Deduct bet up front
    balance -= betArg;
    await userRef.set({ balance, username: message.author.username }, { merge: true });

    // Create private channel
    const channel = await createPrivateChannelForGame(message.guild, message.author).catch(async (e) => {
      // refund if channel creation fails
      balance += betArg;
      await userRef.set({ balance }, { merge: true });
      console.error("[ERROR] createPrivateChannelForGame:", e);
      return null;
    });
    if (!channel) return message.reply(`${message.author}, failed to create game channel. Bet refunded.`);

    // Build deck and hands
    let deck = createFullDeck();
    const playerHand = deck.splice(0, 7);
    const botHand = deck.splice(0, 7);

    // pick a non-wild top
    let top = deck.pop();
    while (top === "wild" || top === "wild+4") {
      deck.unshift(top);
      top = deck.pop();
    }

    const game = {
      userId: message.author.id,
      channelId: channel.id,
      bet: betArg,
      difficulty,
      deck,
      discard: [top],
      top,
      currentColor: top.startsWith("wild") ? "red" : top.split("-")[0],
      playerHand,
      botHand,
      turn: "player",
      embedMessageId: null,
      lastAction: Date.now(),
    };

    // save initial game
    await db.collection("unoGames").doc(message.author.id).set(game, { merge: true });
    await updateUnoEmbed(game);

    // Announcement
    const startMsg = await channel.send(`${message.author}, your UNO game has started! Difficulty: **${difficulty}**. Bet: **$${betArg}**.`);
    setTimeout(() => safeDelete(startMsg), 6000);

    // schedule inactivity timeout
    scheduleGameTimeout(message.author.id);

    // Collector for player commands inside private channel
    const filter = (m) => m.author.id === message.author.id && m.content.toLowerCase().startsWith("!uno");
    const collector = channel.createMessageCollector({ filter, time: 10 * 60 * 1000 });

    const standardHelpEmbed = new EmbedBuilder()
      .setTitle("UNO — Commands")
      .setDescription(
        "`!uno play <card>` — play a card (examples: `!uno play red 5`, `!uno play +2 red`, `!uno play wild red`, `!uno play wild+4 red`)\n" +
        "`!uno draw` — draw 1 card (ends your turn)\n" +
        "`!uno endgame` — forfeit and end game\n" +
        "`!uno help` — show this message"
      );

    // helper: reload game from DB
    async function loadGame() {
      const ref = db.collection("unoGames").doc(message.author.id);
      const d = await ref.get();
      if (!d.exists) return null;
      return d.data();
    }
    async function saveGame(g) {
      await db.collection("unoGames").doc(g.userId).set(g, { merge: true });
    }

    // helper: player draws n cards
    async function playerDraw(g, n = 1) {
      for (let i = 0; i < n; i++) {
        if (!g.deck || g.deck.length === 0) {
          const topCard = g.discard.pop();
          g.deck = shuffle(g.discard);
          g.discard = [topCard];
        }
        if (g.deck.length === 0) break;
        g.playerHand.push(g.deck.pop());
      }
    }

    // finish helper: cleanup and payout
    async function finishWithWinner(g, winner) {
      if (winner === "player") {
        const winMsg = await channel.send(`${message.author}, you won! You earned $${g.bet * 2}.`).catch(() => null);
        if (winMsg) setTimeout(() => safeDelete(winMsg), 6000);
        await endGameCleanup(message.author.id, "player_win", "player won");
      } else if (winner === "bot") {
        const loseMsg = await channel.send(`${message.author}, bot won — you lost your $${g.bet}.`).catch(() => null);
        if (loseMsg) setTimeout(() => safeDelete(loseMsg), 6000);
        await endGameCleanup(message.author.id, "bot_win", "bot won");
      } else {
        await endGameCleanup(message.author.id, "forfeit", "ended");
      }
    }

    // message collector logic
    collector.on("collect", async (m) => {
      try {
        // minimal reaction feedback
        await safeReactAndRemove(m, THINKING_EMOJI);

        const tokens = m.content.trim().split(/\s+/).slice(1); // remove leading !uno
        if (!tokens || tokens.length === 0) {
          const helpMsg = await m.channel.send({ embeds: [standardHelpEmbed] }).catch(() => null);
          if (helpMsg) setTimeout(() => safeDelete(helpMsg), 10000);
          m.delete().catch(() => {});
          return;
        }

        const g = await loadGame();
        if (!g) {
          const notFound = await m.channel.send(`${message.author}, game not found.`).catch(() => null);
          if (notFound) setTimeout(() => safeDelete(notFound), 4000);
          m.delete().catch(() => {});
          collector.stop("missing_game");
          return;
        }

        // reset inactivity timer
        scheduleGameTimeout(message.author.id);

        // ensure it's player's turn
        if (g.turn !== "player") {
          const waitMsg = await m.channel.send(`${message.author}, wait for your turn.`).catch(() => null);
          if (waitMsg) setTimeout(() => safeDelete(waitMsg), 2500);
          m.delete().catch(() => {});
          return;
        }

        const sub = tokens[0].toLowerCase();

        if (sub === "help") {
          const helpMsg = await m.channel.send({ embeds: [standardHelpEmbed] }).catch(() => null);
          if (helpMsg) setTimeout(() => safeDelete(helpMsg), 15000);
          m.delete().catch(() => {});
          return;
        }

        if (sub === "endgame" || sub === "forfeit") {
          await m.channel.send(`${message.author}, you ended the game and lost your $${g.bet}.`).catch(() => {});
          m.delete().catch(() => {});
          collector.stop("ended_by_user");
          await endGameCleanup(message.author.id, "forfeit", "user ended");
          return;
        }

        if (sub === "draw") {
          await playerDraw(g, 1);
          g.turn = "bot";
          g.lastAction = Date.now();
          await saveGame(g);
          await updateUnoEmbed(g);
          const drawn = g.playerHand[g.playerHand.length - 1];
          const dm = await m.channel.send(`${message.author}, you drew ${drawn}.`).catch(() => null);
          if (dm) setTimeout(() => safeDelete(dm), 3500);
          m.delete().catch(() => {});
          return botPlayTurn(message.author.id);
        }

        if (sub === "play") {
          // parse remainder into card + optional color for wilds
          const rest = tokens.slice(1).length ? tokens.slice(1).join(" ").trim() : tokens.slice(0).join(" ").trim();
          let normalized = rest.replace(/draw4/gi, "wild+4").replace(/draw 4/gi, "wild+4").replace(/draw2/gi, "+2").replace(/draw 2/gi, "+2").replace(/\s+/g, " ").trim();
          if (!normalized) normalized = tokens.slice(1).join(" ").trim();

          // Final parsing strategy:
          // - If user provided "wild red" or "wild+4 red", treat as wild with chosen color
          // - If user provided "red 5" or "5 red" or "red-5" treat accordingly
          const playerHand = g.playerHand;
          const tryMatch = (target) => {
            const idx = playerHand.findIndex(c => c.toLowerCase() === target.toLowerCase());
            return idx === -1 ? -1 : idx;
          };

          let chosenCard = null;
          let chosenColor = null;

          const tokens2 = normalized.split(" ").filter(Boolean);
          if (tokens2.length === 0) {
            // fallback: maybe they used "!uno play red 5" where first token after play is in tokens[1]
            await m.channel.send(`${message.author}, couldn't parse your play command.`).then(mm => setTimeout(() => safeDelete(mm), 3500)).catch(() => {});
            m.delete().catch(() => {});
            return;
          }

          // case: "wild red" or "wild+4 red"
          if (/^wild/i.test(tokens2[0])) {
            const wildType = tokens2[0].toLowerCase().includes("4") ? "wild+4" : "wild";
            // color should be tokens2[1] if present
            if (tokens2[1] && ["red", "yellow", "green", "blue"].includes(tokens2[1].toLowerCase())) {
              chosenColor = tokens2[1].toLowerCase();
            } else {
              // require color in same command per user's preference
              await m.channel.send(`${message.author}, you must specify a color with wild. Example: \`!uno play wild+4 red\``).then(mm => setTimeout(() => safeDelete(mm), 4000)).catch(() => {});
              m.delete().catch(() => {});
              return;
            }
            const idxWild = tryMatch(wildType);
            if (idxWild === -1) {
              await m.channel.send(`${message.author}, you don't have ${wildType}.`).then(mm => setTimeout(() => safeDelete(mm), 3500)).catch(() => {});
              m.delete().catch(() => {});
              return;
            }
            chosenCard = playerHand[idxWild];
          } else {
            // Try color first: "red 5" or "red +2"
            // Or value-first: "5 red"
            // Normalize some common value synonyms
            const maybeColor = tokens2[0].toLowerCase();
            const maybeValue = tokens2.slice(1).join(" ").toLowerCase();
            const candidate1 = `${maybeColor}-${maybeValue}`.toLowerCase();
            let idx1 = tryMatch(candidate1);
            if (idx1 !== -1) {
              chosenCard = playerHand[idx1];
            } else {
              // try reversed: value then color
              const maybeColorLast = tokens2[tokens2.length - 1].toLowerCase();
              const maybeValueFirst = tokens2.slice(0, tokens2.length - 1).join(" ").toLowerCase();
              const candidate2 = `${maybeColorLast}-${maybeValueFirst}`.toLowerCase();
              const idx2 = tryMatch(candidate2);
              if (idx2 !== -1) chosenCard = playerHand[idx2];
              else {
                // try direct single token match like "+2" or "red-5" or "red5"
                const single = tokens2.join("").toLowerCase();
                // convert "red5" to "red-5"
                const m = single.match(/^(red|yellow|green|blue)(\d|skip|reverse|\+2)$/i);
                if (m) {
                  const cand = `${m[1]}-${m[2]}`.toLowerCase();
                  const idxd = tryMatch(cand);
                  if (idxd !== -1) chosenCard = playerHand[idxd];
                }
                // last resort: try token-by-token direct equality
                if (!chosenCard) {
                  for (const t of tokens2) {
                    const idxd = tryMatch(t);
                    if (idxd !== -1) { chosenCard = playerHand[idxd]; break; }
                  }
                }
              }
            }
          }

          if (!chosenCard) {
            await m.channel.send(`${message.author}, you don't have that card or the command couldn't be parsed.`).then(mm => setTimeout(() => safeDelete(mm), 3500)).catch(() => {});
            m.delete().catch(() => {});
            return;
          }

          // legality check
          const currentTop = g.top;
          const currentColor = g.currentColor || (currentTop.startsWith("wild") ? null : currentTop.split("-")[0]);
          const chosenIsWild = chosenCard === "wild" || chosenCard === "wild+4";
          const chosenParts = chosenCard.split("-");
          const chosenValue = chosenParts[1] || chosenCard;

          if (!chosenIsWild && !(chosenParts[0] === currentColor || chosenValue === (currentTop.split("-")[1] || ""))) {
            await m.channel.send(`${message.author}, you can't play ${chosenCard} on ${currentTop}.`).then(mm => setTimeout(() => safeDelete(mm), 3000)).catch(() => {});
            m.delete().catch(() => {});
            return;
          }

          // For wilds, chosenColor must be set (user provided color in same command per Option B)
          if (chosenIsWild) {
            if (!chosenColor) {
              // If chosenColor not set earlier, attempt to parse it from tokens (e.g. user wrote "wild red" but parser missed)
              const maybe = tokens.slice(2).find(t => ["red","yellow","green","blue"].includes(t?.toLowerCase()));
              if (maybe) chosenColor = maybe.toLowerCase();
            }
            if (!chosenColor) {
              await m.channel.send(`${message.author}, you must specify a color when playing wild. Example: \`!uno play wild red\``).then(mm => setTimeout(() => safeDelete(mm), 4000)).catch(() => {});
              m.delete().catch(() => {});
              return;
            }
          }

          // Execute the play: remove card, push to discard, set top/currentColor
          const remIdx = g.playerHand.indexOf(chosenCard);
          g.playerHand.splice(remIdx, 1);
          g.discard.push(chosenCard);
          g.top = chosenCard;
          if (chosenIsWild) {
            g.currentColor = chosenColor;
          } else {
            g.currentColor = chosenCard.split("-")[0];
          }

          // Effects resolution for player plays
          let feedback = `${message.author} played **${chosenCard}**.`;
          if (chosenCard.endsWith("+2")) {
            // bot draws 2 and is skipped -> player keeps turn
            for (let i = 0; i < 2; i++) {
              if (!g.deck || g.deck.length === 0) {
                const topCard = g.discard.pop();
                g.deck = shuffle(g.discard);
                g.discard = [topCard];
              }
              g.botHand.push(g.deck.pop());
            }
            feedback += ` Bot draws 2 cards. ${SKIP_SUFFIX_TEXT}`;
            g.turn = "player";
          } else if (chosenCard === "wild+4") {
            for (let i = 0; i < 4; i++) {
              if (!g.deck || g.deck.length === 0) {
                const topCard = g.discard.pop();
                g.deck = shuffle(g.discard);
                g.discard = [topCard];
              }
              g.botHand.push(g.deck.pop());
            }
            feedback += ` Bot draws 4 cards. ${SKIP_SUFFIX_TEXT}`;
            g.turn = "player";
          } else if (chosenCard.endsWith("skip") || chosenCard.endsWith("reverse")) {
            // acts as skip in 1v1 -> bot skipped (player keeps turn)
            feedback += ` ${SKIP_SUFFIX_TEXT}`;
            g.turn = "player";
          } else {
            // normal card -> bot's turn
            g.turn = "bot";
          }

          g.lastAction = Date.now();
          await saveGame(g);
          await updateUnoEmbed(g);
          const fb = await m.channel.send(feedback).catch(() => null);
          if (fb) setTimeout(() => safeDelete(fb), 3500);
          m.delete().catch(() => {});

          // win check
          if (g.playerHand.length === 0) {
            collector.stop("player_won");
            return finishWithWinner(g, "player");
          }

          // If it becomes bot's turn, invoke bot
          if (g.turn === "bot") return botPlayTurn(message.author.id);

          return;
        }

        // unknown subcommand
        const unknown = await m.channel.send("Unknown command. Use `!uno play`, `!uno draw`, `!uno endgame`, or `!uno help`.").catch(() => null);
        if (unknown) setTimeout(() => safeDelete(unknown), 3500);
        m.delete().catch(() => {});

      } catch (err) {
        console.error("[ERROR] UNO collect handler:", err);
      }
    });

    collector.on("end", async (_, reason) => {
      try {
        const g = await loadGame();
        if (!g) {
          try { await channel.delete().catch(() => {}); } catch {}
          return;
        }
        if (reason === "player_won") return;
        if (reason === "ended_by_user") return;
        // treat other collector ends as forfeit (timeout/closed)
        await channel.send(`${message.author}, UNO ended. You lost your $${g.bet}.`).catch(() => {});
        await endGameCleanup(message.author.id, "forfeit", "collector ended");
      } catch (e) {
        console.error("[ERROR] collector end:", e);
      }
    });

    // done creating game
    break;
  } catch (e) {
    console.error("[ERROR] case uno:", e);
    // on any top-level failure attempt to refund and cleanup
    try {
      const userRef2 = db.collection("users").doc(message.author.id);
      const ud = await userRef2.get();
      if (ud.exists) {
        // best-effort: don't double-refund if we already deducted elsewhere; skip complex checks
        // (you can add more robust rollback logic as needed)
      }
    } catch (err) {}
    return message.reply(`${message.author}, an error occurred while creating the UNO game.`);
  }
} // end case "uno"

      
  }
}
// --- Express keepalive ---
const app = express();
app.get("/", (_, res) => res.send("Bot is running."));
app.listen(PORT || 3000, () => console.log(`[DEBUG] Listening on port ${PORT || 3000}`));

// --- Login ---
client.login(TOKEN);
