// commands/poker.js
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { db } from "../firebase.js";
import { updateTopRoles } from "../topRoles.js";

const ALLOWED_CHANNEL_ID = "1434934862430867487";

const suits = ["♠", "♥", "♦", "♣"];
const ranks = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];

function createDeck() {
  const deck = [];
  for (const s of suits) for (const r of ranks) deck.push({ rank: r, suit: s });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function rankValue(r) {
  return ranks.indexOf(r);
}

function evaluateHand(hand) {
  const values = hand.map(c => rankValue(c.rank)).sort((a,b)=>a-b);
  const suitsAll = hand.map(c=>c.suit);
  const counts = {};
  for (const v of values) counts[v] = (counts[v]||0)+1;
  const flush = suitsAll.every(s=>s===suitsAll[0]);
  const straight = values.every((v,i)=>i===0 || v===values[i-1]+1);

  if (straight && flush) return 9;
  if (Object.values(counts).includes(4)) return 8;
  if (Object.values(counts).includes(3) && Object.values(counts).includes(2)) return 7;
  if (flush) return 6;
  if (straight) return 5;
  if (Object.values(counts).includes(3)) return 4;
  if (Object.values(counts).filter(v=>v===2).length===2) return 3;
  if (Object.values(counts).includes(2)) return 2;
  return 1;
}

export const data = new SlashCommandBuilder()
  .setName("poker")
  .setDescription("Play a fast round of Video Poker vs the bot")
  .addIntegerOption(opt =>
    opt.setName("amount")
      .setDescription("Bet amount (must be > 0)")
      .setRequired(true));

export async function execute(interaction, client) {
  if (interaction.channel.id !== ALLOWED_CHANNEL_ID)
    return interaction.reply({ content: `Use this in <#${ALLOWED_CHANNEL_ID}> only.`, ephemeral: true });

  await interaction.deferReply();

  const amount = interaction.options.getInteger("amount");
  if (amount <= 0) return interaction.editReply("Bet must be greater than 0.");

  const id = interaction.user.id;
  const userRef = db.collection("users").doc(id);

  const result = await db.runTransaction(async (t) => {
    const doc = await t.get(userRef);
    let balance = doc.exists ? doc.data().balance : 1000;
    if (amount > balance) throw new Error("Not enough money.");

    const deck = createDeck();
    let player = deck.splice(0, 5);
    let bot = deck.splice(0, 5);

    const botEval = evaluateHand(bot);
    if (botEval < 2) {
      bot.sort((a,b)=>rankValue(a.rank)-rankValue(b.rank));
      bot.splice(0,3,...deck.splice(0,3));
    }

    const playerEval = evaluateHand(player);
    if (playerEval <= 2) {
      player.sort((a,b)=>rankValue(a.rank)-rankValue(b.rank));
      player.splice(0,2,...deck.splice(0,2));
    }

    const finalPlayerEval = evaluateHand(player);
    const finalBotEval = evaluateHand(bot);

    let outcome;
    if (finalPlayerEval > finalBotEval) outcome = "win";
    else if (finalPlayerEval < finalBotEval) outcome = "lose";
    else outcome = "tie";

    let change = 0;
    if (outcome === "win") change = amount;
    else if (outcome === "lose") change = -amount;
    balance += change;

    t.set(userRef, { balance, username: interaction.user.username });
    return { outcome, balance, player, bot, change };
  }).catch(err => ({ error: err.message }));

  if (result.error) return interaction.editReply(result.error);

  const handStr = (hand) => hand.map(c => `${c.rank}${c.suit}`).join(" ");
  const colorMap = { win: 0x00ff00, lose: 0xff0000, tie: 0xffff00 };

  const embed = new EmbedBuilder()
    .setTitle("Poker")
    .setColor(colorMap[result.outcome])
    .addFields(
      { name: "Your Hand", value: handStr(result.player), inline: true },
      { name: "Bot's Hand", value: handStr(result.bot), inline: true },
      {
        name: "Result",
        value:
          result.outcome === "win"
            ? `You won **$${Math.abs(result.change)}!**`
            : result.outcome === "lose"
              ? `You lost **$${Math.abs(result.change)}.**`
              : "It's a tie. No change.",
      },
      { name: "Balance", value: `$${result.balance}`, inline: false }
    )
    .setFooter({ text: `Requested by ${interaction.user.username}` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
  await updateTopRoles(client);
}
