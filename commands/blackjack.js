import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { db } from "../firebase.js";
import { updateTopRoles } from "../topRoles.js";

const ALLOWED_CHANNEL_ID = "1434934862430867487";
const MAX_BET = 500;

export const data = new SlashCommandBuilder()
  .setName("blackjack")
  .setDescription("Play simplified Blackjack with your bet")
  .addIntegerOption(opt => opt.setName("amount").setDescription(`Bet (1–${MAX_BET})`).setRequired(true));

export async function execute(interaction) {
  if (interaction.channel.id !== ALLOWED_CHANNEL_ID)
    return interaction.reply({ content: `You can only use this command in <#${ALLOWED_CHANNEL_ID}>.`, ephemeral: true });

  await interaction.deferReply(); // ✅ defer first

  try {
    const amount = interaction.options.getInteger("amount");
    if (amount <= 0 || amount > MAX_BET)
      return interaction.editReply(`Bet must be between 1 and ${MAX_BET}.`);

    const userId = interaction.user.id;
    const userRef = db.collection("users").doc(userId);

    // transaction to check balance & subtract bet
    const trx = await db.runTransaction(async t => {
      const doc = await t.get(userRef);
      const balance = doc.exists ? doc.data().balance : 1000;
      if (amount > balance) throw new Error("Not enough money.");
      t.set(userRef, { balance: balance - amount, username: interaction.user.username }, { merge: true });
      return balance - amount;
    });

    // simplified deck
    const suits = ["♠", "♥", "♦", "♣"];
    const ranks = ["2","3","4","5","6","7","8","9","10","A"];
    const deck = suits.flatMap(s => ranks.map(r => r + s));
    for (let i = deck.length-1; i>0; i--){
      const j = Math.floor(Math.random()*(i+1));
      [deck[i],deck[j]] = [deck[j],deck[i]];
    }

    const playerHand = [deck.pop(), deck.pop()];
    const dealerHand = [deck.pop(), deck.pop()];

    const getValue = c => c.startsWith("A") ? 11 : parseInt(c);
    const handValue = hand => {
      let sum = hand.reduce((acc, c) => acc + getValue(c), 0);
      let aces = hand.filter(c=>c.startsWith("A")).length;
      while(sum>21 && aces>0){sum-=10; aces--;}
      return sum;
    };

    const embed = new EmbedBuilder()
      .setTitle("Blackjack")
      .setColor("#00AAFF")
      .setDescription(`Your hand: ${playerHand.join(", ")}\nDealer: ${dealerHand[0]}, *hidden*`)
      .setFooter({ text: `Bet: $${amount}` });

    const hitButton = new ButtonBuilder().setCustomId("hit").setLabel("Hit").setStyle(ButtonStyle.Primary);
    const standButton = new ButtonBuilder().setCustomId("stand").setLabel("Stand").setStyle(ButtonStyle.Secondary);
    const row = new ActionRowBuilder().addComponents(hitButton, standButton);

    const message = await interaction.editReply({ embeds: [embed], components: [row] });

    const collector = message.createMessageComponentCollector({
      filter: i => i.user.id === userId && ["hit","stand"].includes(i.customId),
      time: 60000
    });

    collector.on("collect", async i => {
      await i.deferUpdate();
      if(i.customId==="hit"){
        playerHand.push(deck.pop());
        const pVal = handValue(playerHand);
        if(pVal>21){
          embed.setDescription(`Your hand: ${playerHand.join(", ")} (bust!)\nDealer: ${dealerHand.join(", ")}`);
          embed.setColor("#FF0000");
          await i.editReply({ embeds: [embed], components: [] });
          collector.stop("playerBust");
        } else {
          embed.setDescription(`Your hand: ${playerHand.join(", ")}\nDealer: ${dealerHand[0]}, *hidden*`);
          await i.editReply({ embeds: [embed], components: [row] });
        }
      } else if(i.customId==="stand"){
        collector.stop("playerStand");
      }
    });

    collector.on("end", async (_, reason) => {
      const playerVal = handValue(playerHand);
      let dealerVal = handValue(dealerHand);

      if(reason !== "playerBust"){
        while(dealerVal < 17){
          dealerHand.push(deck.pop());
          dealerVal = handValue(dealerHand);
        }
      }

      const playerWin = (reason==="playerBust") ? false : dealerVal>21 || playerVal>dealerVal;

      const payout = playerWin ? amount*2 : 0;

      // update balance after game
      await db.runTransaction(async t=>{
        const doc = await t.get(userRef);
        const current = doc.exists ? doc.data().balance : 0;
        t.set(userRef, { balance: current + payout, username: interaction.user.username }, { merge: true });
      });

      const resultEmbed = new EmbedBuilder()
        .setTitle("Blackjack Result")
        .setColor(playerWin ? "#00FF00" : "#FF0000")
        .setDescription(`Your hand (${playerVal}): ${playerHand.join(", ")}\nDealer hand (${dealerVal}): ${dealerHand.join(", ")}`)
        .setFooter({ text: `Bet: $${amount}` });

      await interaction.editReply({ embeds: [resultEmbed], components: [] });

      // Update top roles
      await updateTopRoles(interaction.client);
    });

  } catch(err) {
    console.error(err);
    try { await interaction.editReply(err.message || "Error in Blackjack."); } catch {}
  }
}
