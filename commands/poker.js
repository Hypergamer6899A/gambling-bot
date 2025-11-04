import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';

// --- Poker deck setup ---
const suits = ['♠️', '♥️', '♦️', '♣️'];
const values = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

function generateDeck() {
  return suits.flatMap(s => values.map(v => ({ suit: s, value: v })));
}

function drawCards(deck, count) {
  const cards = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * deck.length);
    cards.push(deck.splice(idx, 1)[0]);
  }
  return cards;
}

function cardToString(c) {
  return `${c.value}${c.suit}`;
}

// --- Hand evaluation (simplified video poker rules) ---
function evaluateHand(cards) {
  const vals = cards.map(c => c.value);
  const suitsOnly = cards.map(c => c.suit);
  const counts = Object.fromEntries(vals.map(v => [v, vals.filter(x => x===v).length]));
  const isFlush = suitsOnly.every(s => s === suitsOnly[0]);
  const idxMap = Object.fromEntries(values.map((v,i)=>[v,i]));
  const sorted = [...vals].sort((a,b)=>idxMap[a]-idxMap[b]);
  const isStraight = sorted.every((v,i,a)=> i===0 || idxMap[v]===idxMap[a[i-1]]+1);

  const countsArr = Object.values(counts).sort((a,b)=>b-a);

  if (isStraight && isFlush) return 'Straight Flush';
  if (countsArr[0]===4) return 'Four of a Kind';
  if (countsArr[0]===3 && countsArr[1]===2) return 'Full House';
  if (isFlush) return 'Flush';
  if (isStraight) return 'Straight';
  if (countsArr[0]===3) return 'Three of a Kind';
  if (countsArr[0]===2 && countsArr[1]===2) return 'Two Pair';
  if (countsArr[0]===2) return 'One Pair';
  return 'High Card';
}

// --- Command definition ---
export const data = new SlashCommandBuilder()
  .setName('poker')
  .setDescription('Play a quick video poker round against the bot.')
  .addIntegerOption(opt => 
    opt.setName('bet')
       .setDescription('Amount to bet')
       .setRequired(true)
  );

// --- Command execution ---
export async function execute(interaction, clientData) {
  // clientData should contain player balances
  const userId = interaction.user.id;
  const bet = interaction.options.getInteger('bet');

  if (!clientData.balances[userId] || clientData.balances[userId] < bet) {
    return interaction.reply({ content: `Insufficient balance.`, ephemeral: true });
  }

  await interaction.deferReply();

  const deck = generateDeck();
  const playerHand = drawCards(deck, 5);
  const botHand = drawCards(deck, 5);
  const held = [false,false,false,false,false];

  // Function to build button rows
  function buildButtons() {
    const cardButtons = playerHand.map((c,i) => 
      new ButtonBuilder()
        .setCustomId(`hold_${i}`)
        .setLabel(cardToString(c))
        .setStyle(held[i] ? ButtonStyle.Danger : ButtonStyle.Secondary)
    );

    const rows = [];
    rows.push(new ActionRowBuilder().addComponents(cardButtons));
    // Play button row
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('play')
        .setLabel('Play')
        .setStyle(ButtonStyle.Success)
    ));

    return rows;
  }

  const embed = new EmbedBuilder()
    .setTitle('Video Poker')
    .setDescription(`Your hand: ${playerHand.map(cardToString).join(' ')}`)
    .setColor('Gold');

  const message = await interaction.editReply({ embeds: [embed], components: buildButtons() });

  const collector = message.createMessageComponentCollector({
    filter: i => i.user.id === userId,
    time: 60000
  });

  collector.on('collect', async i => {
    if (i.customId.startsWith('hold_')) {
      const idx = parseInt(i.customId.split('_')[1]);
      held[idx] = !held[idx];
      await i.update({ components: buildButtons() });
    } else if (i.customId === 'play') {
      collector.stop('played');
      // Replace unheld cards
      for (let j = 0; j < playerHand.length; j++) {
        if (!held[j]) playerHand[j] = drawCards(deck,1)[0];
      }

      const playerResult = evaluateHand(playerHand);
      const botResult = evaluateHand(botHand);

      // Determine winner (simplified: order in values array)
      function handValue(handName) {
        const ranking = ['High Card','One Pair','Two Pair','Three of a Kind','Straight','Flush','Full House','Four of a Kind','Straight Flush'];
        return ranking.indexOf(handName);
      }

      let outcome;
      if (handValue(playerResult) > handValue(botResult)) {
        outcome = 'You won!';
        clientData.balances[userId] += bet;
      } else if (handValue(playerResult) < handValue(botResult)) {
        outcome = 'You lost!';
        clientData.balances[userId] -= bet;
      } else {
        outcome = 'Tie!';
      }

      const finalEmbed = new EmbedBuilder()
        .setTitle('Final Hands')
        .setDescription(
          `Your hand: ${playerHand.map(cardToString).join(' ')} (${playerResult})\n` +
          `Bot hand: ${botHand.map(cardToString).join(' ')} (${botResult})\n` +
          `Bet: ${bet}\n` +
          `New Balance: ${clientData.balances[userId]}\n` +
          `${outcome}`
        )
        .setColor('Green');

      await i.update({ embeds: [finalEmbed], components: [] });
    }
  });

  collector.on('end', async (_, reason) => {
    if (reason !== 'played') {
      const timeoutEmbed = new EmbedBuilder()
        .setTitle('Video Poker')
        .setDescription('Time expired! Hand cancelled.')
        .setColor('Red');
      await interaction.editReply({ embeds: [timeoutEmbed], components: [] });
    }
  });
}
