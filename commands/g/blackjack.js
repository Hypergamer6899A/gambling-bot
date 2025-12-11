import { newBlackjackGame, playerHit, dealerDraw } from "/../games/blackjack/engine.js";
import { bjEmbed } from "/../utils/bjEmbed.js";
import { getUser, saveUser } from "/../services/userCache.js";
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export async function blackjackCommand(client, message, args) {
  const bet = parseInt(args[2]);
  if (isNaN(bet) || bet <= 0)
    return message.reply(`${message.author}, invalid bet amount.`);

  const user = await getUser(message.author.id);
  if (user.balance < bet)
    return message.reply(`You don’t have enough money.`);

  // Deduct initial bet
  user.balance -= bet;
  await saveUser(message.author.id, user);

  // Load streak
  const streak = user.blackjackStreak ?? 0;

  // Create game state
  const state = newBlackjackGame(bet, streak);

  const buttons = () =>
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("hit")
        .setLabel("Hit")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(state.gameOver),
      new ButtonBuilder()
        .setCustomId("stand")
        .setLabel("Stand")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(state.gameOver)
    );

  const gameMessage = await message.reply({
    embeds: [
      bjEmbed("Blackjack", bet, state.playerHand, state.dealerHand, state.playerTotal, null, state.streak)
    ],
    components: [buttons()]
  });

  const collector = gameMessage.createMessageComponentCollector({
    filter: i => i.user.id === message.author.id,
    time: 60000
  });

  collector.on("collect", async (interaction) => {
    const id = interaction.customId;

    if (id === "hit") {
      const res = playerHit(state);

      if (res.result === "bust") {
        state.streak = 0;
        user.blackjackStreak = 0;
        await saveUser(message.author.id, user);

        state.gameOver = true;
        await interaction.update({
          embeds: [
            bjEmbed("You Busted!", bet, state.playerHand, state.dealerHand, state.playerTotal, state.dealerTotal, state.streak, "Red")
          ],
          components: [buttons()]
        });

        collector.stop();
        return;
      }

      return interaction.update({
        embeds: [
          bjEmbed("Blackjack", bet, state.playerHand, state.dealerHand, state.playerTotal, null, state.streak)
        ],
        components: [buttons()]
      });
    }

    if (id === "stand") {
      const result = dealerDraw(state);

      let color = "Yellow";
      let title = "Tie.";
      let payout = 0;

      if (result === "player_win" || result === "dealer_bust") {
        color = "Green";
        title = "You Win!";
        payout = bet * 2;
        state.streak += 1;
      } else if (result === "dealer_win") {
        color = "Red";
        title = "You Lose.";
        state.streak = 0;
      }

      user.balance += payout;
      user.blackjackStreak = state.streak;
      await saveUser(message.author.id, user);

      state.gameOver = true;

      await interaction.update({
        embeds: [
          bjEmbed(title, bet, state.playerHand, state.dealerHand, state.playerTotal, state.dealerTotal, state.streak, color)
        ],
        components: [buttons()]
      });

      collector.stop();
    }
  });

  collector.on("end", () => {
    if (!state.gameOver) {
      gameMessage.edit({
        embeds: [bjEmbed("Game ended due to inactivity.", bet, state.playerHand, state.dealerHand, state.playerTotal, null, state.streak, "Red")],
        components: [buttons()]
      }).catch(() => {});
    }
  });
}

