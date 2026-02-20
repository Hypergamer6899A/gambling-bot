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

import { processGame, getHouse } from "../utils/house.js";

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

  const house = await getHouse();

  const state = newBlackjackGame(bet, user.blackjackStreak ?? 0);
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

  // ========================================
  // NATURAL BLACKJACK
  // ========================================
  if (state.playerTotal === 21) {
    const payout = Math.floor(bet * 2.5);

    user.balance += payout;
    await processGame(payout);

    const netLoss = bet - payout;
    if (netLoss > 0)
      house.jackpotPot += Math.round(netLoss * 0.2);

    state.gameOver = true;
    state.streak += 1;
    user.blackjackStreak = state.streak;

    await saveUser(message.author.id, user);
    await saveUser(process.env.BOT_ID, house);

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
          "WIN"
        )
      ]
    });
  }

  // ========================================
  // START GAME
  // ========================================
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
        "PLAYING"
      )
    ],
    components: [buttons()]
  });

  const collector = gameMessage.createMessageComponentCollector({
    filter: i => i.user.id === message.author.id,
    time: 60000
  });

  collector.on("collect", async interaction => {
    if (interaction.customId === "hit") {
      const res = await playerHit(state);

      if (res.result === "bust") {
        state.gameOver = true;
        state.streak = 0;
        user.blackjackStreak = 0;

        house.jackpotPot += Math.round(bet * 0.2);

        await saveUser(message.author.id, user);
        await saveUser(process.env.BOT_ID, house);

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
              "LOSS"
            )
          ],
          components: [buttons()]
        });

        return collector.stop();
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
            "PLAYING"
          )
        ],
        components: [buttons()]
      });
    }

    if (interaction.customId === "stand") {
      const result = await dealerDraw(state);

      let payout = 0;
      let netLoss = 0;
      let title = "Tie!";
      let outcome = "TIE";

      if (result === "player_win" || result === "dealer_bust") {
        payout = bet * 2;
        user.balance += payout;
        await processGame(payout);

        state.streak += 1;
        title = "You Win!";
        outcome = "WIN";

        netLoss = bet - payout;
      }
      else if (result === "dealer_win") {
        state.streak = 0;
        title = "You Lose.";
        outcome = "LOSS";

        netLoss = bet;
      }
      else {
        payout = bet;
        user.balance += payout;
        await processGame(payout);
      }

      if (netLoss > 0)
        house.jackpotPot += Math.round(netLoss * 0.2);

      user.blackjackStreak = state.streak;

      await saveUser(message.author.id, user);
      await saveUser(process.env.BOT_ID, house);

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
            outcome
          )
        ],
        components: [buttons()]
      });

      collector.stop();
    }
  });
}
