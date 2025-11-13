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

// --- Prevent Multiple Bot Instances ---
if (global.__botStarted) {
  console.log("[DEBUG] Duplicate instance detected — exiting.");
  process.exit(0);
}
global.__botStarted = true;

// --- Presence ---
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: "!g help | LETS GO GAMBLING", type: 0 }],
    status: "online",
  });
});

// --- Message Handler (single instance) ---
if (!global.__listenerAdded) {
  const processedMessages = new Set();

  client.on("messageCreate", async (message) => {
    try {
      if (message.author.bot) return;
      // Accept commands in the configured channel only
      if (message.channel.id !== CHANNEL_ID) return;

      // only commands that start with !g or !uno
      if (!message.content.startsWith("!g") && !message.content.startsWith("!uno"))
        return;

      if (processedMessages.has(message.id)) return;
      processedMessages.add(message.id);
      setTimeout(() => processedMessages.delete(message.id), 30000);

      let reacted = false;
      if (THINKING_EMOJI) {
        try {
          await message.react(THINKING_EMOJI);
          reacted = true;
        } catch (e) {
          console.warn("[WARN] Could not react with THINKING_EMOJI:", e?.message ?? e);
        }
      }

      // route commands
      if (message.content.startsWith("!g")) {
        await handleGCommand(message);
      } else if (message.content.startsWith("!uno")) {
        await handleUnoAction(message);
      }

      // remove thinking reaction if we added it
      if (reacted) {
        try {
          await message.reactions.removeAll();
        } catch (e) {
          // ignore
        }
      }
    } catch (err) {
      console.error("[ERROR] in messageCreate:", err);
    }
  });

  global.__listenerAdded = true;
}

// --- Helper utilities ---
function createFullDeck() {
  const colors = ["red", "yellow", "green", "blue"];
  const values = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "skip", "reverse", "+2"];
  let deck = [];
  for (const c of colors) {
    // UNO: one 0, two of others (we'll just add duplicates to approximate)
    deck.push(`${c}-0`);
    for (const v of values.slice(1)) {
      deck.push(`${c}-${v}`, `${c}-${v}`);
    }
  }
  // wilds
  for (let i = 0; i < 4; i++) {
    deck.push("wild");
    deck.push("wild+4");
  }
  // shuffle
  return deck.sort(() => Math.random() - 0.5);
}

function reshuffleFromDiscard(data) {
  // keep the top card
  const top = data.discard.pop();
  data.deck = data.discard.sort(() => Math.random() - 0.5);
  data.discard = [top];
  return data;
}

async function safeSendDM(user, contentOrOptions) {
  try {
    return await user.send(contentOrOptions);
  } catch (e) {
    // user likely has DMs closed; swallow
    return null;
  }
}

function cardMatches(top, card) {
  // top and card are strings like "red-5" or "wild" or "wild+4"
  if (card.startsWith("wild")) return true;
  if (top.startsWith("wild")) {
    // top wild - it should carry a settled color in this implementation as top will be "color-value" after wild was played
    // If top is literally "wild" (shouldn't happen), disallow except wild
    return true;
  }
  const [tC, tV] = top.split("-");
  const [cC, cV] = card.split("-");
  return cC === tC || cV === tV;
}

// --- Command Logic for !g commands (gift, balance, roulette, blackjack, uno start, leaderboard, claim) ---
async function handleGCommand(message) {
  const args = message.content.trim().split(/\s+/);
  const command = args[1]?.toLowerCase();

  const userRef = db.collection("users").doc(message.author.id);
  const userDoc = await userRef.get();
  const userData = userDoc.exists ? userDoc.data() : {};
  let balance = userData.balance ?? 1000;
  let lastClaim = userData.lastClaim ?? 0;

  // Ensure user doc exists
  await userRef.set(
    {
      username: message.author.username,
      balance,
      lastClaim,
    },
    { merge: true }
  );

  if (!userDoc.exists) await userRef.set({ balance, lastClaim });

  // Switch
  switch (command) {
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
          "`!g uno <bet>` - Start single-player UNO vs bot (actions with \`!uno\` commands)"
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
      const top5 = snapshot.docs.slice(0, 5);
      const lines = await Promise.all(
        top5.map(async (d, i) => {
          const u = d.data();
          const user = await client.users.fetch(d.id).catch(() => null);
          return `${i + 1}. ${user?.username || "Unknown"} - $${u.balance}`;
        })
      );
      return message.reply(`**Top 5 Richest Players:**\n${lines.join("\n")}`);
    }

    case "blackjack": {
      const betAmount = parseInt(args[2]);
      if (isNaN(betAmount) || betAmount <= 0 || betAmount > balance)
        return message.reply(`${message.author}, invalid bet amount.`);

      // subtract bet immediately
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
            embed.setColor(0xed4245).setDescription(
              `Your hand: ${player.join(" ")}\nYou busted!\n\n**Lost $${betAmount}. New balance: $${balance}**`
            );
            await userRef.set({ balance }, { merge: true });
            await i.update({ embeds: [embed], components: [] });
            collector.stop();
            return;
          }

          embed.setDescription(`Your hand: ${player.join(" ")}\nDealer shows: ${dealer[0]}`);
          await i.update({ embeds: [embed], components: [row] });
        } else {
          let dSum = calc(dealer);
          while (dSum < 17) {
            dealer.push(draw());
            dSum = calc(dealer);
          }
          const pSum = calc(player);
          let result, color;

          if (dSum > 21 || pSum > dSum) {
            balance += betAmount * 2; // get back original + winnings
            result = `You won! Dealer had ${dealer.join(" ")}.`;
            color = 0x57f287;
          } else if (pSum === dSum) {
            balance += betAmount; // just return bet
            result = `It's a tie! Dealer had ${dealer.join(" ")}.`;
            color = 0xfee75c;
          } else {
            result = `You lost! Dealer had ${dealer.join(" ")}.`;
            color = 0xed4245;
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

    case "gift": {
      const target = message.mentions.users.first();
      const amountArg = args[3];

      if (!target)
        return message.reply(`${message.author}, you need to mention someone to gift money to.`);

      if (target.bot)
        return message.reply(`${message.author}, you can’t gift money to bots.`);

      if (target.id === message.author.id)
        return message.reply(`${message.author}, you can’t gift yourself.`);

      if (!amountArg)
        return message.reply(`${message.author}, usage: \`!g gift @user <amount|all>\``);

      let amount;
      if (amountArg.toLowerCase() === "all") {
        if (balance <= 0)
          return message.reply(`${message.author}, you have no money to gift.`);
        amount = balance;
      } else {
        amount = parseInt(amountArg);
        if (isNaN(amount) || amount <= 0)
          return message.reply(`${message.author}, please enter a valid amount or use \`all\`.`);
        if (amount > balance)
          return message.reply(`${message.author}, you don’t have enough money to gift that amount.`);
      }

      // Check if recipient exists in database
      const targetRef = db.collection("users").doc(target.id);
      const targetDoc = await targetRef.get();

      if (!targetDoc.exists) {
        await targetRef.set({ username: target.username, balance: 1000, lastClaim: 0 });
        console.log(`[INFO] Created new user profile for ${target.username}`);
      }

      const targetData = (await targetRef.get()).data();
      const targetBalance = (targetData.balance ?? 1000) + amount;

      // Update both users
      balance -= amount;
      await userRef.set({ balance }, { merge: true });
      await targetRef.set({ balance: targetBalance, username: target.username }, { merge: true });

      // Confirm: gifter mentioned, recipient name only (no mention)
      return message.reply(
        `${message.author} gifted ${target.username} **$${amount}**.\n` +
          `Your new balance: **$${balance}**.`
      );
    }

    case "uno": {
      // Start single-player UNO vs bot: !g uno <bet>
      const betArg = args[2];
      const bet = parseInt(betArg);
      if (isNaN(bet) || bet <= 0)
        return message.reply(`${message.author}, usage: \`!g uno <bet>\` (bet must be a positive number)`);

      if (bet > balance) return message.reply(`${message.author}, you don't have enough money to bet that amount.`);

      // check existing game
      const unoRef = db.collection("unoGames").doc(message.author.id);
      const unoDoc = await unoRef.get();
      if (unoDoc.exists) {
        const existing = unoDoc.data();
        if (existing.state === "active") return message.reply(`${message.author}, you already have an active UNO game. Use \`!uno end\` to quit.`);
      }

      // subtract bet immediately
      balance -= bet;
      await userRef.set({ balance }, { merge: true });

      // build deck and hands
      let deck = createFullDeck();
      const playerHand = deck.splice(0, 7);
      const botHand = deck.splice(0, 7);
      let discard = [deck.pop()];
      let top = discard[0];
      // ensure top is not a wild+4 at start; if it is, push back and pop another
      while (top.startsWith("wild+4")) {
        deck.unshift(top);
        top = deck.pop();
        discard = [top];
      }

      const embed = new EmbedBuilder()
        .setTitle("UNO vs Bot")
        .setColor(0x00aeff)
        .setDescription(
          `Top card: **${top}**\n\n` +
          `Your hand: ${playerHand.join(", ")}\n` +
          `Bot cards: ${botHand.length}\n` +
          `Turn: **player**\n\n` +
          `Use \`!uno play <card>\` or \`!uno draw\`.`
        );

      const sent = await message.channel.send({ embeds: [embed] });

      const gameData = {
        state: "active",
        deck,
        discard,
        playerHand,
        botHand,
        top,
        turn: "player",
        embedMessageId: sent.id,
        channelId: message.channel.id,
        bet,
        createdAt: Date.now(),
        lastAction: Date.now(),
      };

      await unoRef.set(gameData);

      // DM the player a short confirmation and delete original message
      await safeSendDM(message.author, `UNO started vs bot. You bet $${bet}. Use \`!uno play <card>\` or \`!uno draw\`. Game embed posted in channel.`);
      try { await message.delete(); } catch (e) {}

      return;
    }

    default:
      return message.reply(`${message.author}, invalid command. Use \`!g help\`.`);
  }
}

// --- Handlers for !uno action commands (play, draw, end) ---
async function handleUnoAction(message) {
  const args = message.content.trim().split(/\s+/);
  const action = args[1]?.toLowerCase(); // play, draw, end
  const unoRef = db.collection("unoGames").doc(message.author.id);
  const unoDoc = await unoRef.get();

  if (!unoDoc.exists) {
    // not in game
    return message.reply(`${message.author}, you have no active UNO game. Start one with \`!g uno <bet>\`.`);
  }

  const data = unoDoc.data();

  // Check inactivity timeout (2 minutes)
  const now = Date.now();
  const timeoutMs = 2 * 60 * 1000;
  if (now - (data.lastAction ?? data.createdAt) > timeoutMs) {
    // refund bet
    const userRef = db.collection("users").doc(message.author.id);
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? userDoc.data() : {};
    let balance = userData.balance ?? 1000;
    balance += data.bet;
    await userRef.set({ balance }, { merge: true });
    await unoRef.delete();
    await safeSendDM(message.author, `Your UNO game timed out due to inactivity. Your bet of $${data.bet} has been refunded.`);
    try { await message.delete(); } catch (e) {}
    return;
  }

  // Add loading reaction is already handled globally; remove at function end.
  // Delete player's message after processing per your request
  try { await message.delete(); } catch (e) {}

  // Player turn enforcement
  if (data.turn !== "player") {
    await safeSendDM(message.author, `It's not your turn.`);
    return;
  }

  // Ensure deck isn't empty (reshuffle)
  if (!data.deck || data.deck.length === 0) {
    const resh = reshuffleFromDiscard(data);
    data.deck = resh.deck;
    data.discard = resh.discard;
  }

  // parse action
  if (action === "draw") {
    // draw one
    const drawn = data.deck.pop();
    data.playerHand.push(drawn);
    data.turn = "bot";
    data.lastAction = Date.now();
    await unoRef.set(data);
    await safeSendDM(message.author, `You drew **${drawn}**.`);

    // proceed to bot's turn
    await handleBotTurnForUno(message.author.id);
    return;
  }

  if (action === "play") {
    const cardArg = args[2];
    if (!cardArg) {
      await safeSendDM(message.author, `Usage: \`!uno play <card>\` (e.g. red-5 or wild-red)`); 
      return;
    }
    const card = cardArg.toLowerCase();

    // find exact card in player's hand
    const idx = data.playerHand.findIndex((c) => c.toLowerCase() === card);
    if (idx === -1) {
      await safeSendDM(message.author, `You don't have **${card}** in your hand.`);
      return;
    }

    // check play legality
    const top = data.top;
    const legal = card.startsWith("wild") || cardMatches(top, card);
    if (!legal) {
      await safeSendDM(message.author, `You can't play **${card}** on **${top}**.`);
      return;
    }

    // play the card
    data.playerHand.splice(idx, 1);
    data.discard.push(card);
    data.top = card;
    data.lastAction = Date.now();

    // handle special effects (basic)
    // if +2 -> bot draws 2 during bot turn
    // if skip -> skip bot's turn (i.e., player keeps turn)
    // if reverse -> acts as skip in 1v1 -> player goes again
    // wild & wild+4 -> if syntax wild-color, set top to that color (we'll accept "wild" or "wild-red" -- if no color provided, default to red)
    if (card.startsWith("wild")) {
      // allow wild or wild-red/ wild+4-red form; if user gave wild-color, handle it
      // if card exactly "wild" or "wild+4" we keep it as-is but bot's matching logic accepts wilds
      // no extra color state tracked beyond top string, so to set a color user can play "wild-red"
      // if they played "wild", we won't substitute color and allow bot to match wild or play wild
    }

    // win check
    if (data.playerHand.length === 0) {
      // player wins
      await unoRef.delete();
      // payout: player wins bet -> get back original + winnings (same as blackjack behavior)
      const userRef = db.collection("users").doc(message.author.id);
      const userDoc = await userRef.get();
      const userData = userDoc.exists ? userDoc.data() : {};
      let balance = userData.balance ?? 1000;
      balance += data.bet * 2; // pay out
      await userRef.set({ balance }, { merge: true });

      await safeSendDM(message.author, `You played **${card}** and won! You win $${data.bet}. New balance: $${balance}.`);
      // update embed once more to reflect empty hand
      await updateUnoEmbedForUser(message.author.id);
      return;
    }

    // special immediate effects
    if (card.endsWith("+2")) {
      // bot will draw 2 in bot logic
    }

    if (card.endsWith("skip") || card.endsWith("reverse")) {
      // in 1v1, skip/reverse cause player to have next turn again (i.e., skip bot)
      data.turn = "player";
      await unoRef.set(data);
      await safeSendDM(message.author, `You played **${card}**. Bot skipped. It's your turn again.`);
      await updateUnoEmbedForUser(message.author.id);
      return;
    }

    // otherwise pass to bot
    data.turn = "bot";
    await unoRef.set(data);
    await safeSendDM(message.author, `You played **${card}**.`);
    await updateUnoEmbedForUser(message.author.id);

    await handleBotTurnForUno(message.author.id);
    return;
  }

  if (action === "end" || action === "forfeit") {
    // forfeit: delete game, bet is lost (no refund)
    await unoRef.delete();
    await safeSendDM(message.author, `You ended the UNO game. Your bet of $${data.bet} was lost.`);
    return;
  }

  // unknown action
  await safeSendDM(message.author, `UNO commands: \`!uno play <card>\`, \`!uno draw\`, \`!uno end\`.`);
}

// --- Bot turn logic for UNO (operates by userId to allow embed editing) ---
async function handleBotTurnForUno(userId) {
  const unoRef = db.collection("unoGames").doc(userId);
  const doc = await unoRef.get();
  if (!doc.exists) return;
  const data = doc.data();
  if (data.state !== "active") return;

  // Ensure deck availability
  if (!data.deck || data.deck.length === 0) {
    reshuffleFromDiscard(data);
  }

  // Bot prioritization: prefer skip, +2, then number/color, then wild+4/wild, else draw.
  // Find playable cards
  const top = data.top;
  const botHand = data.botHand;
  // helper for playable
  const playableCards = botHand.filter((c) => {
    if (c.startsWith("wild")) return true;
    return cardMatches(top, c);
  });

  let played = null;
  if (playableCards.length > 0) {
    // prioritize skip and +2
    const priority = playableCards.find((c) => c.endsWith("skip") || c.endsWith("+2"));
    if (priority) played = priority;
    else {
      // pick a playable that reduces hand quickly - prefer numeric?
      const skipOrRev = playableCards.find((c) => c.endsWith("reverse"));
      if (skipOrRev) played = skipOrRev;
      else played = playableCards[Math.floor(Math.random() * playableCards.length)];
    }
  }

  const player = await client.users.fetch(userId).catch(() => null);

  if (played) {
    // play it
    const idx = botHand.indexOf(played);
    botHand.splice(idx, 1);
    data.discard.push(played);
    data.top = played;
    data.lastAction = Date.now();

    // post bot play as DM
    await safeSendDM(player, `🤖 Bot played **${played}**.`);

    // win check
    if (botHand.length === 0) {
      // bot wins, delete game, player loses bet (already deducted)
      await unoRef.delete();
      await safeSendDM(player, `🤖 Bot has no cards left — you lost your bet of $${data.bet}.`);
      await updateUnoEmbedForUser(userId); // attempt to update final embed before deletion
      return;
    }

    // effects
    if (played.endsWith("+2")) {
      // player draws 2
      for (let i = 0; i < 2; i++) {
        if (data.deck.length === 0) { reshuffleFromDiscard(data); }
        const d = data.deck.pop();
        data.playerHand.push(d);
      }
      await safeSendDM(player, `You draw 2 cards due to bot's +2.`);
    }

    if (played.endsWith("skip") || played.endsWith("reverse")) {
      // in 1v1, skip/reverse -> bot essentially skips player? For bot play, skip means player loses a turn.
      // Here: after bot plays skip, bot gets another turn; we'll implement bot continues (simple).
      data.turn = "bot";
      await unoRef.set(data);
      // update embed so user sees new state
      await updateUnoEmbedForUser(userId);
      // Give bot another move (simple)
      // small delay to simulate thinking
      await new Promise((r) => setTimeout(r, 800));
      return handleBotTurnForUno(userId);
    }
  } else {
    // bot draws one
    if (data.deck.length === 0) reshuffleFromDiscard(data);
    const drawn = data.deck.pop();
    botHand.push(drawn);
    data.lastAction = Date.now();
    await safeSendDM(player, `🤖 Bot drew a card.`);
  }

  // switch to player's turn
  data.turn = "player";
  await unoRef.set(data);
  await updateUnoEmbedForUser(userId);
}

// --- Update the persistent embed in channel for a user's UNO game ---
async function updateUnoEmbedForUser(userId) {
  const unoRef = db.collection("unoGames").doc(userId);
  const unoDoc = await unoRef.get();
  if (!unoDoc.exists) return;
  const data = unoDoc.data();

  const channel = await client.channels.fetch(data.channelId).catch(() => null);
  if (!channel) return;
  const embedMessageId = data.embedMessageId;
  if (!embedMessageId) return;

  // Build embed
  const embed = new EmbedBuilder()
    .setTitle("UNO vs Bot")
    .setColor(0x00aeff)
    .setDescription(
      `Top card: **${data.top}**\n\n` +
      `Your hand: ${data.playerHand.join(", ")}\n` +
      `Bot cards: ${data.botHand.length}\n` +
      `Turn: **${data.turn}**\n\n` +
      `Use \`!uno play <card>\` or \`!uno draw\`.`
    )
    .setFooter({ text: `Bet: $${data.bet}` });

  // edit the embed message
  try {
    const msg = await channel.messages.fetch(embedMessageId);
    if (msg) {
      await msg.edit({ embeds: [embed] });
    }
  } catch (e) {
    // message likely deleted; try to resend and save new id
    try {
      const sent = await channel.send({ embeds: [embed] });
      await unoRef.set({ embedMessageId: sent.id }, { merge: true });
    } catch (err) {
      // ignore
    }
  }
}

// --- Express Keepalive ---
const app = express();
app.get("/", (_, res) => res.send("Bot is running."));
app.listen(PORT || 3000, () => console.log(`[DEBUG] Listening on port ${PORT || 3000}`));

// --- Login ---
client.login(TOKEN);
