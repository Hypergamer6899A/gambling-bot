import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

const suits = ["♠️", "♥️", "♦️", "♣️"];
const values = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

function generateDeck() {
  return suits.flatMap((suit) => values.map((value) => ({ value, suit })));
}

function drawCards(deck, count) {
  const cards = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * deck.length);
    cards.push(deck.splice(idx, 1)[0]);
  }
  return cards;
}

function evaluateHand(cards) {
  const valuesOnly = cards.map((c) => c.value);
  const suitsOnly = cards.map((c) => c.suit);
  const counts = Object.fromEntries(
    valuesOnly.map((v) => [v, valuesOnly.filter((x) => x === v).length])
  );
  const isFlush = suitsOnly.every((s) => s === suitsOnly[0]);

  const order = values.map((v, i) => [v, i]);
  const indexMap = Object.fromEntries(order);
  const sortedVals = [...valuesOnly].sort((a, b) => indexMap[a] - indexMap[b]);
  const straight = sortedVals.every(
    (v, i, arr) => i === 0 || indexMap[v] === indexMap[arr[i - 1]] + 1
  );

  const countsArr = Object.values(counts).sort((a, b) => b - a);
  if (straight && isFlush) return "Straight Flush";
  if (countsArr[0] === 4) return "Four of a Kind";
  if (countsArr[0] === 3 && countsArr[1] === 2) return "Full House";
  if (isFlush) return "Flush";
  if (straight) return "Straight";
  if (countsArr[0] === 3) return "Three of a Kind";
  if (countsArr[0] === 2 && countsArr[1] === 2) return "Two Pair";
  if (countsArr[0] === 2) return "One Pair";
  return "High Card";
}

export const data = new SlashCommandBuilder()
  .setName("poker")
  .setDescription("Play a quick video poker round against the bot.")
  .addIntegerOption((option) =>
    option
      .setName("bet")
      .setDescription("How much you want to bet")
      .setMinValue(1)
      .setRequired(true)
  );

export async function execute(interaction) {
  const bet = interaction.options.getInteger("bet");
  const deck = generateDeck();
  let hand = drawCards(deck, 5);

  const embed = new EmbedBuilder()
    .setTitle("Poker")
    .setDescription(`**Bet:** ${bet}\n\nYour hand:\n${hand
      .map((c, i) => `**[${i + 1}]** ${c.value}${c.suit}`)
      .join(" ")}`)
    .setColor("Gold")
    .setFooter({ text: "Click the buttons to hold cards. Ends in 15s." });

  const buttons = hand.map((_, i) =>
    new ButtonBuilder()
      .setCustomId(`hold_${i}`)
      .setLabel(`Hold ${i + 1}`)
      .setStyle(ButtonStyle.Secondary)
  );

  const row = new ActionRowBuilder().addComponents(buttons);
  const message = await interaction.reply({
    embeds: [embed],
    components: [row],
    fetchReply: true,
  });

  const held = new Set();
  const collector = message.createMessageComponentCollector({
    time: 15000,
    filter: (i) => i.user.id === interaction.user.id,
  });

  collector.on("collect", async (i) => {
    const index = parseInt(i.customId.split("_")[1]);
    if (held.has(index)) held.delete(index);
    else held.add(index);

    // Update button style to show which ones are held
    const updatedButtons = hand.map((_, j) =>
      new ButtonBuilder()
        .setCustomId(`hold_${j}`)
        .setLabel(`Hold ${j + 1}`)
        .setStyle(held.has(j) ? ButtonStyle.Success : ButtonStyle.Secondary)
    );

    await i.update({ components: [new ActionRowBuilder().addComponents(updatedButtons)] });
  });

  collector.on("end", async () => {
    for (let i = 0; i < hand.length; i++) {
      if (!held.has(i)) hand[i] = drawCards(deck, 1)[0];
    }

    const result = evaluateHand(hand);
    const winnings = {
      "Straight Flush": bet * 10,
      "Four of a Kind": bet * 6,
      "Full House": bet * 4,
      Flush: bet * 3,
      Straight: bet * 2,
      "Three of a Kind": bet * 1.5,
      "Two Pair": bet,
      "One Pair": bet * 0.5,
      "High Card": 0,
    }[result] ?? 0;

    const endEmbed = new EmbedBuilder()
      .setTitle("Final Hand")
      .setDescription(
        `**${result}**\n${hand.map((c) => `${c.value}${c.suit}`).join(" ")}\n\n**You ${
          winnings > 0 ? `won ${winnings}` : "lost"
        }!**`
      )
      .setColor(winnings > 0 ? "Green" : "Red");

    await interaction.editReply({ embeds: [endEmbed], components: [] });
  });
}
