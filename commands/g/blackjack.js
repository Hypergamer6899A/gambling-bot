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

  // ✅ Deduct bet immediately
  user.balance -= bet;
  await saveUser(message.author.id, user);

  // ✅ House gains bet immediately
  await processGame(-bet);

  // Load streak
  const streak = user.blackjackStreak ?? 0;

  // Start game
  const state = newBlackjackGame(bet, streak);

  // ✅ Fix boost support
  state.member = message.member;

  // Ensure hands are arrays
  state.playerHand = Array.isArray(state.playerHand)
    ? state.playerHand
    : [state.playerHand];

  state.dealerHand = Array.isArray(state.dealerHand)
    ? state.dealerHand
    : [state.dealerHand];

  // 🎛 Buttons
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
  // ✅ NATURAL BLACKJACK CHECK (First Deal)
  // ====================================================
  if (state.playerTotal === 21) {
    state.gameOver = true;

    // Blackjack payout = 3:2
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
  // Normal Game Start Message
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
        state.streak
      )
    ],
    components: [buttons()]
  });

  // Collector
  const collector = gameMessage.createMessageComponentCollector({
    filter: i => i.user.id === message.author.id,
    time: 60000
  });

  // ====================================================
  // Gameplay
  // ====================================================
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
              "💥 You Busted!",
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

      // Continue game
      await interaction.update({
        embeds: [
          bjEmbed(
            "Blackjack",
            bet,
            state.playerHand,
            state.dealerHand,
            state.playerTotal,
            null,
            state.streak
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

      // ✅ PLAYER WIN
      if (result === "player_win" || result === "dealer_bust") {
        title = "You Win!";
        color = "Green";

        payout = bet * 2;

        user.balance += payout;
        await processGame(payout);

        state.streak += 1;
      }

      // ❌ DEALER WIN
      else if (result === "dealer_win") {
        title = "You Lose.";
        color = "Red";

        payout = 0;
        state.streak = 0;
      }

      // 🤝 TIE → Refund bet
      else if (result === "tie") {
        title = "Tie!";
        color = "Yellow";

        payout = bet;

        user.balance += payout;
        await processGame(payout);
      }

      // Save streak + user
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
  // Timeout End
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
