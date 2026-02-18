import {
  newBlackjackGame,
  playerHit,
  dealerDraw
} from "../games/blackjack/engine.js";

import { bjEmbed } from "../utils/bjEmbed.js";
import { getUser, saveUser } from "../services/userCache.js";

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";

import { processGame } from "../utils/house.js";

export async function blackjackCommand(client, message, args) {
  const bet = parseInt(args[2]);

  if (isNaN(bet) || bet <= 0)
    return message.reply("Invalid bet amount.");

  const user = await getUser(message.author.id);

  if (user.balance < bet)
    return message.reply("You don’t have enough money.");

  user.balance -= bet;
  await saveUser(message.author.id, user);

  await processGame(-bet);

  const streak = user.blackjackStreak ?? 0;

  const state = newBlackjackGame(bet, streak);
  state.member = message.member;

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

  // ====================================================
  // NATURAL BLACKJACK
  // ====================================================
  if (state.playerTotal === 21) {
    state.gameOver = true;

    const payout = Math.floor(bet * 2.5);

    user.balance += payout;
    await processGame(payout);

    state.streak += 1;
    user.blackjackStreak = state.streak;

    await saveUser(message.author.id, user);

    return message.reply({
      embeds: [
        bjEmbed(
          "Blackjack! (3:2 payout)",
          bet,
          state.playerHand,
          state.dealerHand,
          state.playerTotal,
          state.dealerTotal,
          state.streak,
          "Green"
        )
      ]
    });
  }

  // ====================================================
  // Game Start
  // ====================================================
  const gameMessage = await message.reply({
    embeds: [
      bjEmbed(
        "Blackjack",
        bet,
        state.playerHand,
        state.dealerHand,
        state.playerTotal,
        null,
        state.streak,
        "Blurple"   // ✅ FIXED
      )
    ],
    components: [buttons()]
  });

  const collector = gameMessage.createMessageComponentCollector({
    filter: i => i.user.id === message.author.id,
    time: 60000
  });

  collector.on("collect", async interaction => {
    const id = interaction.customId;

    // =========================
    // HIT
    // =========================
    if (id === "hit") {
      const res = await playerHit(state);

      if (res.result === "bust") {
        state.gameOver = true;
        state.streak = 0;
        user.blackjackStreak = 0;

        await saveUser(message.author.id, user);

        await interaction.update({
          embeds: [
            bjEmbed(
              "You Busted!",
              bet,
              state.playerHand,
              state.dealerHand,
              state.playerTotal,
              state.dealerTotal,
              state.streak,
              "Red"
            )
          ],
          components: [buttons()]
        });

        collector.stop();
        return;
      }

      await interaction.update({
        embeds: [
          bjEmbed(
            "Blackjack",
            bet,
            state.playerHand,
            state.dealerHand,
            state.playerTotal,
            null,
            state.streak,
            "Blurple"   // ✅ FIXED
          )
        ],
        components: [buttons()]
      });
    }

    // =========================
    // STAND
    // =========================
    if (id === "stand") {
      const result = await dealerDraw(state);

      let title = "Tie!";
      let color = "Yellow";
      let payout = 0;

      if (result === "player_win" || result === "dealer_bust") {
        title = "You Win!";
        color = "Green";

        payout = bet * 2;

        user.balance += payout;
        await processGame(payout);

        state.streak += 1;
      }

      else if (result === "dealer_win") {
        title = "You Lose.";
        color = "Red";

        payout = 0;
        state.streak = 0;
      }

      else if (result === "tie") {
        title = "Tie!";
        color = "Yellow";

        payout = bet;

        user.balance += payout;
        await processGame(payout);
      }

      user.blackjackStreak = state.streak;
      await saveUser(message.author.id, user);

      state.gameOver = true;

      await interaction.update({
        embeds: [
          bjEmbed(
            title,
            bet,
            state.playerHand,
            state.dealerHand,
            state.playerTotal,
            state.dealerTotal,
            state.streak,
            color
          )
        ],
        components: [buttons()]
      });

      collector.stop();
    }
  });

  // ====================================================
  // Timeout
  // ====================================================
  collector.on("end", () => {
    if (!state.gameOver) {
      gameMessage.edit({
        embeds: [
          bjEmbed(
            "Game ended due to inactivity.",
            bet,
            state.playerHand,
            state.dealerHand,
            state.playerTotal,
            null,
            state.streak,
            "Red"
          )
        ],
        components: []
      }).catch(() => {});
    }
  });
}
