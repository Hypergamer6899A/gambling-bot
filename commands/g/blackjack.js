// commands/g/blackjack.js
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

import { newBlackjackGame, playerHit, dealerDraw } from "../games/blackjack/engine.js";
import { bjEmbed } from "../utils/embeds.js";
import { getUser, saveUser } from "../services/userCache.js";
import { processGame, getHouse } from "../utils/house.js";

export async function blackjackCommand(client, message, args) {
  const bet = parseInt(args[2]);

  if (isNaN(bet) || bet <= 0)
    return message.reply("Invalid bet amount.");

  const user = await getUser(message.author.id);
  if (user.balance < bet)
    return message.reply("You don't have enough money.");

  // Deduct bet and fetch house upfront
  user.balance -= bet;
  await saveUser(message.author.id, user);
  await processGame(-bet);

  const house = await getHouse();
  const state = newBlackjackGame(bet, user.blackjackStreak ?? 0);
  state.member = message.member;

  // ── Natural blackjack ─────────────────────────────────────────────────────
  if (state.playerTotal === 21) {
    const payout  = Math.floor(bet * 2.5);
    const netLoss = bet - payout;

    user.balance += payout;
    await processGame(payout);

    if (netLoss > 0) house.jackpotPot += Math.round(netLoss * 0.2);

    state.streak        += 1;
    user.blackjackStreak = state.streak;

    await saveUser(message.author.id, user);
    await saveUser(process.env.BOT_ID, house);

    return message.reply({
      embeds: [bjEmbed("Blackjack! (3:2)", bet, state.playerHand, state.dealerHand, state.playerTotal, state.dealerTotal, state.streak, "WIN")],
    });
  }

  // ── Build buttons ─────────────────────────────────────────────────────────
  const buildRow = () =>
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("hit").setLabel("Hit").setStyle(ButtonStyle.Secondary).setDisabled(state.gameOver),
      new ButtonBuilder().setCustomId("stand").setLabel("Stand").setStyle(ButtonStyle.Primary).setDisabled(state.gameOver),
    );

  // ── Initial message ───────────────────────────────────────────────────────
  const gameMessage = await message.reply({
    embeds:     [bjEmbed("Your Turn", bet, state.playerHand, state.dealerHand, state.playerTotal, null, state.streak, "PLAYING")],
    components: [buildRow()],
  });

  const collector = gameMessage.createMessageComponentCollector({
    filter: i => i.user.id === message.author.id,
    time:   60_000,
  });

  collector.on("collect", async interaction => {

    // ── Hit ───────────────────────────────────────────────────────────────
    if (interaction.customId === "hit") {
      const res = playerHit(state);

      if (res.result === "bust") {
        state.gameOver       = true;
        state.streak         = 0;
        user.blackjackStreak = 0;
        house.jackpotPot    += Math.round(bet * 0.2);

        await saveUser(message.author.id, user);
        await saveUser(process.env.BOT_ID, house);

        await interaction.update({
          embeds:     [bjEmbed("Bust!", bet, state.playerHand, state.dealerHand, state.playerTotal, state.dealerTotal, state.streak, "LOSS")],
          components: [buildRow()],
        });

        return collector.stop();
      }

      return interaction.update({
        embeds:     [bjEmbed("Your Turn", bet, state.playerHand, state.dealerHand, state.playerTotal, null, state.streak, "PLAYING")],
        components: [buildRow()],
      });
    }

    // ── Stand ─────────────────────────────────────────────────────────────
    if (interaction.customId === "stand") {
      // Defer immediately — saveUser + processGame calls can exceed the 3s token window
      await interaction.deferUpdate();

      const result = dealerDraw(state);

      let payout  = 0;
      let netLoss = 0;
      let title   = "Tie";
      let outcome = "TIE";

      if (result === "player_win" || result === "dealer_bust") {
        payout        = bet * 2;
        netLoss       = bet - payout;
        title         = "You Win!";
        outcome       = "WIN";
        state.streak += 1;
        user.balance += payout;
        await processGame(payout);
      } else if (result === "dealer_win") {
        netLoss      = bet;
        title        = "You Lose";
        outcome      = "LOSS";
        state.streak = 0;
      } else {
        // Tie — return bet
        payout       = bet;
        user.balance += payout;
        await processGame(payout);
      }

      if (netLoss > 0) house.jackpotPot += Math.round(netLoss * 0.2);

      state.gameOver       = true;
      user.blackjackStreak = state.streak;

      await saveUser(message.author.id, user);
      await saveUser(process.env.BOT_ID, house);

      // editReply instead of update — required after deferUpdate
      await interaction.editReply({
        embeds:     [bjEmbed(title, bet, state.playerHand, state.dealerHand, state.playerTotal, state.dealerTotal, state.streak, outcome)],
        components: [buildRow()],
      });

      collector.stop();
    }
  });
}
