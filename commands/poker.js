import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { db } from "../firebase.js";

export default {
  name: "poker",
  description: "Play a quick round of video poker.",
  async execute(interaction) {
    const userId = interaction.user.id;
    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      await userRef.set({ balance: 100 });
      return interaction.reply("Account created. You start with $100. Run the command again.");
    }

    const userData = userSnap.data();
    let balance = userData.balance || 100;
    const bet = 10;
    if (balance < bet) return interaction.reply("Not enough balance to play.");

    const suits = ["♠", "♥", "♦", "♣"];
    const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

    const drawCard = () => ({
      rank: ranks[Math.floor(Math.random() * ranks.length)],
      suit: suits[Math.floor(Math.random() * suits.length)],
    });

    let playerHand = Array.from({ length: 5 }, drawCard);
    let held = [false, false, false, false, false];

    const cardToString = (c) => `${c.rank}${c.suit}`;
    const getHandString = (hand) => hand.map(cardToString).join("  ");

    const createButtons = () => {
      const rows = [];
      const cardRow = new ActionRowBuilder();
      for (let i = 0; i < 5; i++) {
        cardRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`hold_${i}`)
            .setLabel(cardToString(playerHand[i]))
            .setStyle(held[i] ? ButtonStyle.Danger : ButtonStyle.Primary)
        );
      }
      rows.push(cardRow);

      const playRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("play").setLabel("Play").setStyle(ButtonStyle.Success)
      );
      rows.push(playRow);
      return rows;
    };

    const embed = new EmbedBuilder()
      .setTitle("Poker")
      .setDescription(`Your hand:\n${getHandString(playerHand)}\n\nSelect cards to hold, then press **Play**.`)
      .setColor("Blue");

    const gameMessage = await interaction.reply({
      embeds: [embed],
      components: createButtons(),
      fetchReply: true,
    });

    const collector = gameMessage.createMessageComponentCollector({
      time: 60000,
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== userId) return i.reply({ content: "Not your game.", ephemeral: true });

      if (i.customId.startsWith("hold_")) {
        const index = parseInt(i.customId.split("_")[1]);
        held[index] = !held[index];
        await i.update({
          embeds: [
            new EmbedBuilder()
              .setTitle("Poker")
              .setDescription(
                `Your hand:\n${getHandString(playerHand)}\n\n${
                  held.filter(Boolean).length > 0
                    ? "Held: " + held.map((h, j) => (h ? j + 1 : null)).filter(Boolean).join(", ")
                    : "No cards held."
                }`
              )
              .setColor("Blue"),
          ],
          components: createButtons(),
        });
      }

      if (i.customId === "play") {
        // Replace unheld cards
        for (let j = 0; j < 5; j++) if (!held[j]) playerHand[j] = drawCard();
        const botHand = Array.from({ length: 5 }, drawCard);

        const rankValue = (r) => ranks.indexOf(r);
        const score = (hand) => hand.reduce((a, c) => a + rankValue(c.rank), 0);
        const playerScore = score(playerHand);
        const botScore = score(botHand);
        const result = playerScore > botScore ? "You win!" : playerScore < botScore ? "Bot wins!" : "Draw!";

        if (playerScore > botScore) balance += bet;
        else if (playerScore < botScore) balance -= bet;

        await userRef.update({ balance });

        await i.update({
          embeds: [
            new EmbedBuilder()
              .setTitle("Poker Results")
              .setDescription(
                `**Your final hand:** ${getHandString(playerHand)}\n**Bot's hand:** ${getHandString(botHand)}\n\n**Result:** ${result}\n**Bet:** $${bet}\n**New Balance:** $${balance}`
              )
              .setColor(result === "You win!" ? "Green" : result === "Draw!" ? "Yellow" : "Red"),
          ],
          components: [],
        });

        collector.stop();
      }
    });

    collector.on("end", async () => {
      try {
        await gameMessage.edit({ components: [] });
      } catch {}
    });
  },
};
