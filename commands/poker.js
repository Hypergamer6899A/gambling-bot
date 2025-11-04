import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

const suits = ['♠', '♥', '♦', '♣'];
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

function cardToString(card) {
  return `${card.value}${card.suit}`;
}

export const data = new SlashCommandBuilder()
  .setName('poker')
  .setDescription('Play a quick video poker round against the bot.')
  .addIntegerOption(opt => opt.setName('bet').setDescription('Amount to bet').setRequired(true));

export async function execute(interaction, client) {
  const bet = interaction.options.getInteger('bet');

  // TODO: integrate your balance system here
  let balance = 1000; // example starting balance
  if (bet > balance) return interaction.reply({ content: `Insufficient balance.`, ephemeral: true });

  const deck = generateDeck();
  let playerHand = drawCards(deck, 5);
  const botHand = drawCards(deck, 5);
  const held = Array(5).fill(false);

  function buildComponents() {
    const cardRow = new ActionRowBuilder().addComponents(
      playerHand.map((c, i) =>
        new ButtonBuilder()
          .setCustomId(`hold_${i}`)
          .setLabel(cardToString(c))
          .setStyle(held[i] ? ButtonStyle.Danger : ButtonStyle.Primary)
      )
    );

    const playRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('play').setLabel('Play').setStyle(ButtonStyle.Success)
    );

    return [cardRow, playRow];
  }

  const embed = new EmbedBuilder()
    .setTitle('Video Poker')
    .setDescription(`Your hand: ${playerHand.map(cardToString).join(' ')}\nBet: ${bet}\nBalance: ${balance}`)
    .setColor('Gold');

  const msg = await interaction.reply({ embeds: [embed], components: buildComponents(), fetchReply: true });

  const collector = msg.createMessageComponentCollector({
    filter: i => i.user.id === interaction.user.id,
    time: 60000
  });

  collector.on('collect', async i => {
    if (i.customId.startsWith('hold_')) {
      const index = parseInt(i.customId.split('_')[1]);
      held[index] = !held[index]; // toggle hold
      await i.update({ embeds: [embed], components: buildComponents() });
    } else if (i.customId === 'play') {
      collector.stop('played');
      for (let j = 0; j < playerHand.length; j++) {
        if (!held[j]) playerHand[j] = drawCards(deck, 1)[0];
      }

      const playerResult = evaluateHand(playerHand);
      const botResult = evaluateHand(botHand);

      // simple result calculation
      let resultText;
      if (values.indexOf(playerResult) > values.indexOf(botResult)) {
        resultText = `You won!`;
        balance += bet;
      } else if (playerResult === botResult) {
        resultText = `Tie!`;
      } else {
        resultText = `You lost!`;
        balance -= bet;
      }

      const finalEmbed = new EmbedBuilder()
        .setTitle('Final Hands')
        .setDescription(
          `Your hand: ${playerHand.map(cardToString).join(' ')} (${playerResult})\n` +
          `Bot hand: ${botHand.map(cardToString).join(' ')} (${botResult})\n` +
          `Bet: ${bet}\n` +
          `New Balance: ${balance}\n` +
          `${resultText}`
        )
        .setColor('Green');

      await i.update({ embeds: [finalEmbed], components: [] });
    }
  });

  collector.on('end', async (_, reason) => {
    if (reason !== 'played') {
      const cancelEmbed = new EmbedBuilder()
        .setTitle('Game Cancelled')
        .setDescription('You did not press Play in time.')
        .setColor('Red');
      await interaction.editReply({ embeds: [cancelEmbed], components: [] });
    }
  });
}
