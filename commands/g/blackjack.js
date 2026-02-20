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

  if (state.playerTotal === 21) {
    const payout = Math.floor(bet * 2.5);
    user.balance += payout;
    await processGame(payout);

    const netLoss = bet - payout;
    if (netLoss > 0)
      house.jackpotPot += Math.round(netLoss * 0.2);

    await saveUser(message.author.id, user);
    await saveUser(process.env.BOT_ID, house);

    return message.reply({ embeds: [] });
  }

  const gameMessage = await message.reply({ embeds: [], components: [] });
  const collector = gameMessage.createMessageComponentCollector({
    filter: i => i.user.id === message.author.id,
    time: 60000
  });

  collector.on("collect", async interaction => {
    if (interaction.customId === "hit") {
      const res = await playerHit(state);

      if (res.result === "bust") {
        house.jackpotPot += Math.round(bet * 0.2);
        await saveUser(process.env.BOT_ID, house);
        collector.stop();
      }
    }

    if (interaction.customId === "stand") {
      const result = await dealerDraw(state);

      let payout = 0;
      let netLoss = 0;

      if (result === "player_win" || result === "dealer_bust") {
        payout = bet * 2;
        user.balance += payout;
        await processGame(payout);
        netLoss = bet - payout;
      }
      else if (result === "dealer_win") {
        netLoss = bet;
      }
      else {
        payout = bet;
        user.balance += payout;
        await processGame(payout);
      }

      if (netLoss > 0)
        house.jackpotPot += Math.round(netLoss * 0.2);

      await saveUser(message.author.id, user);
      await saveUser(process.env.BOT_ID, house);

      collector.stop();
    }
  });
}
