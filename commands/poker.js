import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import express from 'express';

const suits = ['♠️', '♥️', '♦️', '♣️'];
const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function generateDeck() {
  return suits.flatMap(suit => values.map(value => ({ value, suit })));
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
  const valuesOnly = cards.map(c => c.value);
  const suitsOnly = cards.map(c => c.suit);
  const counts = Object.fromEntries(valuesOnly.map(v => [v, valuesOnly.filter(x => x === v).length]));
  const isFlush = suitsOnly.every(s => s === suitsOnly[0]);

  const order = values.map((v, i) => [v, i]);
  const indexMap = Object.fromEntries(order);
  const sortedVals = [...valuesOnly].sort((a, b) => indexMap[a] - indexMap[b]);
  const straight =
    sortedVals.every((v, i, arr) => i === 0 || indexMap[v] === indexMap[arr[i - 1]] + 1);

  const countsArr = Object.values(counts).sort((a, b) => b - a);
  if (straight && isFlush) return 'Straight Flush';
  if (countsArr[0] === 4) return 'Four of a Kind';
  if (countsArr[0] === 3 && countsArr[1] === 2) return 'Full House';
  if (isFlush) return 'Flush';
  if (straight) return 'Straight';
  if (countsArr[0] === 3) return 'Three of a Kind';
  if (countsArr[0] === 2 && countsArr[1] === 2) return 'Two Pair';
  if (countsArr[0] === 2) return 'One Pair';
  return 'High Card';
}

export const data = new SlashCommandBuilder()
  .setName('poker')
  .setDescription('Play a quick video poker round against the bot.');

export async function execute(interaction) {
  const deck = generateDeck();
  let hand = drawCards(deck, 5);

  const embed = new EmbedBuilder()
    .setTitle('🎰 Video Poker')
    .setDescription(`Your hand: ${hand.map(c => `${c.value}${c.suit}`).join(' ')}`)
    .setColor('Gold');

  // Create up to 5 buttons (one per card)
  const buttons = hand.map((_, i) =>
    new ButtonBuilder().setCustomId(`hold_${i}`).setLabel(`Hold ${i + 1}`).setStyle(ButtonStyle.Secondary)
  );

  // Split into action rows of 5
  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
  }

  const message = await interaction.reply({
    embeds: [embed],
    components: rows,
    fetchReply: true
  });

  const collector = message.createMessageComponentCollector({
    time: 15000,
    filter: i => i.user.id === interaction.user.id
  });

  const held = new Set();
  collector.on('collect', async i => {
    const index = parseInt(i.customId.split('_')[1]);
    if (held.has(index)) held.delete(index);
    else held.add(index);
    await i.deferUpdate();
  });

  collector.on('end', async () => {
    for (let i = 0; i < hand.length; i++) {
      if (!held.has(i)) hand[i] = drawCards(deck, 1)[0];
    }

    const result = evaluateHand(hand);
    const endEmbed = new EmbedBuilder()
      .setTitle('🎴 Final Hand')
      .setDescription(`**${result}**\n${hand.map(c => `${c.value}${c.suit}`).join(' ')}`)
      .setColor('Green');

    await interaction.editReply({ embeds: [endEmbed], components: [] });
  });
}
