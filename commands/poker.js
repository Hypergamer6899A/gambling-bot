import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';

const suits = ['♠', '♥', '♦', '♣'];
const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// In-memory user balances (replace with database in production)
const clientData = {
  balances: {}
};

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

  const indexMap = Object.fromEntries(values.map((v, i) => [v, i]));
  const sortedVals = [...valuesOnly].sort((a, b) => indexMap[a] - indexMap[b]);
  const straight = sortedVals.every((v, i, arr) => i === 0 || indexMap[v] === indexMap[arr[i - 1]] + 1);

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

function handPayout(hand) {
  const ranks = {
    'High Card': 0,
    'One Pair': 1,
    'Two Pair': 2,
    'Three of a Kind': 3,
    'Straight': 5,
    'Flush': 6,
    'Full House': 9,
    'Four of a Kind': 25,
    'Straight Flush': 50,
  };
  return ranks[hand] || 0;
}

export const data = new SlashCommandBuilder()
  .setName('poker')
  .setDescription('Play a quick video poker round.')
  .addIntegerOption(option =>
    option.setName('bet')
      .setDescription('Amount to bet')
      .setRequired(true)
  );

export async function execute(interaction) {
  const userId = interaction.user.id;
  const bet = interaction.options.getInteger('bet');

  // Initialize user balance if needed
  if (!clientData.balances[userId]) clientData.balances[userId] = 1000;

  if (bet > clientData.balances[userId]) {
    return interaction.reply({ content: 'Insufficient balance.', ephemeral: true });
  }

  clientData.balances[userId] -= bet;

  const deck = generateDeck();
  let hand = drawCards(deck, 5);
  const held = new Set();

  const getButtons = () => {
    const cardButtons = hand.map((_, i) =>
      new ButtonBuilder()
        .setCustomId(`hold_${i}`)
        .setLabel(`Hold ${i + 1}`)
        .setStyle(held.has(i) ? ButtonStyle.Danger : ButtonStyle.Secondary)
    );

    const playButton = new ButtonBuilder()
      .setCustomId('play')
      .setLabel('Play')
      .setStyle(ButtonStyle.Success);

    const rows = [];
    rows.push(new ActionRowBuilder().addComponents(cardButtons));
    rows.push(new ActionRowBuilder().addComponents(playButton));
    return rows;
  };

  const embed = new EmbedBuilder()
    .setTitle('Video Poker')
    .setDescription(`Your hand: ${hand.map(c => `${c.value}${c.suit}`).join(' ')}\nYour balance: ${clientData.balances[userId]}\nBet: ${bet}`)
    .setColor('Gold');

  const message = await interaction.reply({
    embeds: [embed],
    components: getButtons(),
    fetchReply: true
  });

  const collector = message.createMessageComponentCollector({
    filter: i => i.user.id === userId,
    time: 30000
  });

  collector.on('collect', async i => {
    if (i.customId.startsWith('hold_')) {
      const idx = parseInt(i.customId.split('_')[1]);
      if (held.has(idx)) held.delete(idx);
      else held.add(idx);
      await i.update({ embeds: [embed.setDescription(`Your hand: ${hand.map(c => `${c.value}${c.suit}`).join(' ')}\nYour balance: ${clientData.balances[userId]}\nBet: ${bet}`)], components: getButtons() });
    } else if (i.customId === 'play') {
      collector.stop();
      // Draw new cards for unheld
      for (let j = 0; j < hand.length; j++) {
        if (!held.has(j)) hand[j] = drawCards(deck, 1)[0];
      }
      const result = evaluateHand(hand);
      const payout = handPayout(result) * bet;
      clientData.balances[userId] += payout;

      const endEmbed = new EmbedBuilder()
        .setTitle('Final Hand')
        .setDescription(`Your hand: ${hand.map(c => `${c.value}${c.suit}`).join(' ')}\nResult: ${result}\nYou ${payout > 0 ? 'won' : 'lost'} ${payout} credits\nNew balance: ${clientData.balances[userId]}`)
        .setColor('Green');

      await i.update({ embeds: [endEmbed], components: [] });
    }
  });

  collector.on('end', async collected => {
    if (!collected.size) {
      const timeoutEmbed = new EmbedBuilder()
        .setTitle('Final Hand')
        .setDescription(`Your hand: ${hand.map(c => `${c.value}${c.suit}`).join(' ')}\nNo action taken.\nYour balance: ${clientData.balances[userId]}`)
        .setColor('Red');
      await interaction.editReply({ embeds: [timeoutEmbed], components: [] });
    }
  });
}
