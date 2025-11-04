import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { db } from "../firebase.js";
import { updateTopRoles } from "../topRoles.js";

const ALLOWED_CHANNEL_ID = "1434934862430867487";
const MAX_BET = 500;

export const data = new SlashCommandBuilder()
  .setName("blackjack")
  .setDescription("Play a game of Blackjack (vs the dealer) with your bet")
  .addIntegerOption(opt =>
    opt.setName("amount")
      .setDescription(`Bet amount (1–${MAX_BET})`)
      .setRequired(true)
  );

export async function execute(interaction) {
  if (interaction.channel.id !== ALLOWED_CHANNEL_ID) {
    return interaction.reply({ content: `You can only use commands in <#${ALLOWED_CHANNEL_ID}>.`, ephemeral: true });
  }

  if (!interaction.deferred && !interaction.replied) await interaction.deferReply();

  const amount = interaction.options.getInteger("amount");
  if (amount <= 0 || amount > MAX_BET) {
    return await interaction.editReply(`Bet must be between 1 and ${MAX_BET}.`);
  }

  const userRef = db.collection("users").doc(interaction.user.id);

  let balance;
  try {
    balance = await db.runTransaction(async t => {
      const doc = await t.get(userRef);
      let current = doc.exists ? doc.data().balance : 1000;
      if (!doc.exists) t.set(userRef, { balance: current, username: interaction.user.username });
      if (amount > current) throw new Error("Not enough money.");
      t.set(userRef, { balance: current - amount, username: interaction.user.username }, { merge: true });
      return current - amount;
    });
  } catch (err) {
    return await interaction.editReply(err.message);
  }

  // --- Deck & hand helpers ---
  const suits = ["♠","♥","♦","♣"];
  const ranks = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
  const createDeck = () => suits.flatMap(s => ranks.map(r => r+s));
  const valueMap = { J:10, Q:10, K:10, A:11 };
  const getValue = c => valueMap[c.slice(0,-1)] ?? parseInt(c.slice(0,-1));
  const handValue = hand => {
    let sum = hand.reduce((acc,c)=>acc+getValue(c),0);
    let aces = hand.filter(c=>c.startsWith("A")).length;
    while(sum>21 && aces>0){ sum-=10; aces--; }
    return sum;
  };

  const deck = createDeck();
  for (let i=deck.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [deck[i],deck[j]]=[deck[j],deck[i]];
  }

  const playerHand = [deck.pop(), deck.pop()];
  const dealerHand = [deck.pop(), deck.pop()];

  const embed = new EmbedBuilder()
    .setTitle("Blackjack")
    .setColor("#00AAFF")
    .setDescription(`Your hand: ${playerHand.join(", ")}\nDealer: ${dealerHand[0]}, *hidden*`)
    .setFooter({ text: `Bet: $${amount}` });

  const hitButton = new ButtonBuilder().setCustomId("hit").setLabel("Hit").setStyle(ButtonStyle.Primary);
  const standButton = new ButtonBuilder().setCustomId("stand").setLabel("Stand").setStyle(ButtonStyle.Secondary);
  const row = new ActionRowBuilder().addComponents(hitButton, standButton);

  const message = await interaction.editReply({ embeds: [embed], components: [row] });

  const filter = i => i.user.id === interaction.user.id && ["hit","stand"].includes(i.customId);
  const collector = message.createMessageComponentCollector({ filter, time: 60000 });

  collector.on("collect", async i => {
    await i.deferUpdate();
    if (i.customId === "hit") {
      playerHand.push(deck.pop());
      const pVal = handValue(playerHand);
      if (pVal > 21) {
        embed.setDescription(`Your hand: ${playerHand.join(", ")} (bust!)\nDealer: ${dealerHand.join(", ")}`);
        embed.setColor("#FF0000");
        await i.editReply({ embeds: [embed], components: [] });
        collector.stop("playerBust");
      } else {
        embed.setDescription(`Your hand: ${playerHand.join(", ")}\nDealer: ${dealerHand[0]}, *hidden*`);
        await i.editReply({ embeds: [embed], components: [row] });
      }
    } else if (i.customId === "stand") {
      collector.stop("playerStand");
    }
  });

  collector.on("end", async (_, reason) => {
    let pVal = handValue(playerHand);
    let dVal = handValue(dealerHand);

    if (reason !== "playerBust") {
      while(dVal<17){
        dealerHand.push(deck.pop());
        dVal = handValue(dealerHand);
      }
    }

    const playerWin = reason==="playerBust"?false:(dVal>21 || pVal>dVal);
    const payout = playerWin ? amount*2 : 0;

    await db.runTransaction(async t=>{
      const doc = await t.get(userRef);
      const current = doc.exists ? doc.data().balance : 0;
      t.set(userRef, { balance: current + payout, username: interaction.user.username }, { merge: true });
      balance = current + payout;
    });

    const resultEmbed = new EmbedBuilder()
      .setTitle("Blackjack Result")
      .setColor(playerWin?"#00FF00":"#FF0000")
      .setDescription(`Your hand (${pVal}): ${playerHand.join(", ")}\nDealer hand (${dVal}): ${dealerHand.join(", ")}`)
      .setFooter({ text: `Bet: $${amount} | Balance: $${balance}` });

    await interaction.editReply({ embeds: [resultEmbed], components: [] });
    await updateTopRoles(interaction.client);
  });
}
