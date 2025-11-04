// commands/poker.js
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";
import { db } from "../firebase.js";

const SUITS = ["S", "H", "D", "C"];
const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];

// Payout multipliers when the player wins (multiplier * bet is paid)
const PAYOUTS = {
  "Straight Flush": 50,
  "Four of a Kind": 25,
  "Full House": 9,
  "Flush": 6,
  "Straight": 4,
  "Three of a Kind": 3,
  "Two Pair": 2,
  "One Pair": 1,
  "High Card": 0
};

function makeDeck() {
  const deck = [];
  for (const s of SUITS) for (const r of RANKS) deck.push({ r, s });
  // shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function cardToString(c) {
  return `${c.r}${c.s}`;
}

// hand evaluation returns { rank: number, name: string, key: Array<number> }
// rank: higher is stronger (1..9). key is tiebreaker list (higher better).
function evaluateHand(hand) {
  // Convert ranks to indices
  const vals = hand.map(c => RANKS.indexOf(c.r));
  const suits = hand.map(c => c.s);
  const counts = {};
  for (const v of vals) counts[v] = (counts[v] || 0) + 1;
  const countsArr = Object.entries(counts).map(([v, cnt]) => ({ v: Number(v), cnt }));
  countsArr.sort((a,b) => b.cnt - a.cnt || b.v - a.v);

  const isFlush = new Set(suits).size === 1;

  // handle A-2-3-4-5 straight by mapping Ace low when needed
  const uniqueVals = Array.from(new Set(vals)).sort((a,b)=>a-b);
  let isStraight = false;
  let topStraightVal = null;
  if (uniqueVals.length === 5) {
    const normalStraight = uniqueVals[4] - uniqueVals[0] === 4;
    // check wheel straight (A low): e.g. values indices [0,1,2,3,12] => treat as straight top=3 (5)
    const wheel = JSON.stringify(uniqueVals) === JSON.stringify([0,1,2,3,12]);
    if (normalStraight) {
      isStraight = true;
      topStraightVal = uniqueVals[4];
    } else if (wheel) {
      isStraight = true;
      topStraightVal = 3; // treat as 5-high straight
    }
  }

  // Determine rank and tiebreaker key
  // rank: 9 Straight Flush, 8 Four, 7 Full House, 6 Flush, 5 Straight, 4 Three, 3 Two Pair, 2 One Pair, 1 High Card
  // key: array of values to compare descending
  let rank = 1, name = "High Card", key = [];

  const cnts = countsArr.map(x=>x.cnt);
  if (isStraight && isFlush) {
    rank = 9; name = "Straight Flush"; key = [topStraightVal];
  } else if (cnts[0] === 4) {
    rank = 8; name = "Four of a Kind"; key = [countsArr[0].v, countsArr[1].v];
  } else if (cnts[0] === 3 && cnts[1] === 2) {
    rank = 7; name = "Full House"; key = [countsArr[0].v, countsArr[1].v];
  } else if (isFlush) {
    rank = 6; name = "Flush"; key = vals.slice().sort((a,b)=>b-a);
  } else if (isStraight) {
    rank = 5; name = "Straight"; key = [topStraightVal];
  } else if (cnts[0] === 3) {
    rank = 4; name = "Three of a Kind"; {
      const kickers = countsArr.slice(1).map(x=>x.v).sort((a,b)=>b-a);
      key = [countsArr[0].v, ...kickers];
    }
  } else if (cnts[0] === 2 && cnts[1] === 2) {
    rank = 3; name = "Two Pair"; {
      const pairVals = countsArr.filter(x=>x.cnt===2).map(x=>x.v).sort((a,b)=>b-a);
      const kicker = countsArr.find(x=>x.cnt===1).v;
      key = [...pairVals, kicker];
    }
  } else if (cnts[0] === 2) {
    rank = 2; name = "One Pair"; {
      const pairVal = countsArr[0].v;
      const kickers = countsArr.slice(1).map(x=>x.v).sort((a,b)=>b-a);
      key = [pairVal, ...kickers];
    }
  } else {
    rank = 1; name = "High Card"; key = vals.slice().sort((a,b)=>b-a);
  }

  return { rank, name, key };
}

// compare two evaluated hands: returns 1 if A wins, -1 if B wins, 0 if tie
function compareEvaluated(a, b) {
  if (a.rank > b.rank) return 1;
  if (a.rank < b.rank) return -1;
  for (let i = 0; i < Math.max(a.key.length, b.key.length); i++) {
    const av = a.key[i] ?? -1;
    const bv = b.key[i] ?? -1;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

export const data = new SlashCommandBuilder()
  .setName("poker")
  .setDescription("Play a single-round video poker game against the bot")
  .addIntegerOption(opt => opt
    .setName("bet")
    .setDescription("Bet amount (integer > 0)")
    .setRequired(true)
    .setMinValue(1)
  );

export async function execute(interaction) {
  // Immediate checks and Firestore read/write inside transaction where relevant.
  const userId = interaction.user.id;
  const bet = interaction.options.getInteger("bet");
  if (!Number.isInteger(bet) || bet <= 0) {
    return interaction.reply({ content: "Invalid bet.", ephemeral: true });
  }

  // fetch balance
  const userRef = db.collection("users").doc(userId);
  let userDoc;
  try {
    userDoc = await userRef.get();
  } catch (err) {
    console.error("Firestore read error:", err);
    return interaction.reply({ content: "Database error.", ephemeral: true });
  }
  let balance = userDoc.exists ? (userDoc.data().balance ?? 1000) : 1000;
  if (balance < bet) {
    return interaction.reply({ content: `Insufficient balance. Your balance: ${balance}`, ephemeral: true });
  }

  // Reserve funds immediately (prevent double-play)
  try {
    await userRef.set({ balance: balance - bet, username: interaction.user.username }, { merge: true });
  } catch (err) {
    console.error("Firestore write error:", err);
    return interaction.reply({ content: "Database error.", ephemeral: true });
  }

  // Defer to allow time to respond
  await interaction.deferReply({ ephemeral: false });

  // Setup deck and initial player hand
  const deck = makeDeck();
  const playerHand = deck.splice(0, 5);
  let held = [false, false, false, false, false];

  // Build UI: 5 card buttons in row 1, Play button in row 2
  const cardButtons = () => {
    const bs = [];
    for (let i = 0; i < 5; i++) {
      bs.push(
        new ButtonBuilder()
          .setCustomId(`hold_${i}`)
          .setLabel(cardToString(playerHand[i]))
          .setStyle(held[i] ? ButtonStyle.Danger : ButtonStyle.Primary)
      );
    }
    return new ActionRowBuilder().addComponents(bs);
  };
  const playRow = () => new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("play").setLabel("Play").setStyle(ButtonStyle.Success)
  );

  const startEmbed = new EmbedBuilder()
    .setTitle("Video Poker")
    .setDescription(`Bet: ${bet}\n\nYour hand:\n${playerHand.map(cardToString).join(" ")}`)
    .setColor(0x1f8b4c);

  const msg = await interaction.editReply({
    embeds: [startEmbed],
    components: [cardButtons(), playRow()]
  });

  // Collector
  const collector = msg.createMessageComponentCollector({ time: 30000 });

  collector.on("collect", async comp => {
    if (comp.user.id !== userId) return comp.reply({ content: "Not your game.", ephemeral: true });

    if (comp.customId.startsWith("hold_")) {
      const idx = Number(comp.customId.split("_")[1]);
      held[idx] = !held[idx]; // toggle
      // update UI
      try {
        await comp.update({ components: [cardButtons(), playRow()] });
      } catch (err) {
        console.error("update error:", err);
      }
      return;
    }

    if (comp.customId === "play") {
      // stop collector and process round
      collector.stop("played");
      await comp.deferUpdate(); // acknowledge button click
      // replace unheld cards
      for (let i = 0; i < 5; i++) {
        if (!held[i]) playerHand[i] = deck.splice(0,1)[0];
      }
      // bot hand
      const botHand = deck.splice(0,5);

      const evalPlayer = evaluateHand(playerHand);
      const evalBot = evaluateHand(botHand);
      const cmp = compareEvaluated(evalPlayer, evalBot);

      // compute payout and new balance
      let payout = 0;
      if (cmp === 1) {
        const mult = PAYOUTS[evalPlayer.name] ?? 0;
        payout = bet * mult;
        balance = (balance - 0) + payout; // we already deducted bet earlier; pay full payout
      } else if (cmp === 0) {
        // tie => refund bet
        balance = balance + bet;
      } else {
        // loss => bet already deducted
        // balance unchanged
      }

      // persist new balance
      try {
        await userRef.set({ balance, username: interaction.user.username }, { merge: true });
      } catch (err) {
        console.error("Firestore write error:", err);
      }

      const resultText = cmp === 1 ? `You win (${evalPlayer.name})` : cmp === 0 ? "Tie" : `Bot wins (${evalBot.name})`;

      const endEmbed = new EmbedBuilder()
        .setTitle("Video Poker — Result")
        .setDescription(
          `Your hand: ${playerHand.map(cardToString).join(" ")} — ${evalPlayer.name}\n` +
          `Bot hand:  ${botHand.map(cardToString).join(" ")} — ${evalBot.name}\n\n` +
          `Result: ${resultText}\n` +
          `Bet: ${bet}\n` +
          `New balance: ${balance}`
        )
        .setColor(cmp === 1 ? 0x1f8b4c : cmp === 0 ? 0x9e9e00 : 0xc0392b);

      await interaction.editReply({ embeds: [endEmbed], components: [] });
      return;
    }
  });

  collector.on("end", async (_, reason) => {
    if (reason !== "played") {
      // timeout: refund bet
      try {
        await userRef.set({ balance: balance + bet, username: interaction.user.username }, { merge: true });
      } catch (err) { console.error("refund error:", err); }
      try {
        await interaction.editReply({ content: "Timed out. Bet refunded.", embeds: [], components: [] });
      } catch (_) {}
    }
  });
}
