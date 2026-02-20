import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";

import { getUser, saveUser } from "../services/userCache.js";
import { processGame, getHouse } from "../utils/house.js";
import { GAME_COLORS } from "../utils/embedColors.js";
import { newPokerGame, finishGame } from "../games/poker/engine.js";
import { pokerEmbed } from "../utils/pokerEmbed.js";

const activeGames = new Map();

export async function pokerCommand(client, message, args) {
  const bet = parseInt(args[2]);
  if (isNaN(bet) || bet <= 0) return message.reply("Usage: `!g poker <bet>`");

  const user = await getUser(message.author.id);
  if (user.balance < bet) return message.reply("You don't have enough money.");

  user.balance -= bet;
  await saveUser(message.author.id, user);
  await processGame(-bet);

  const SPECIAL_ROLE = process.env.ROLE_ID;
  const hasBoost = message.member.roles.cache.has(SPECIAL_ROLE);

  const game = newPokerGame();
  activeGames.set(message.author.id, game);

  function buildButtons() {
    const cardRow = new ActionRowBuilder();
    game.playerCards.forEach((card, i) => {
      cardRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`poker_pick_${i}`)
          .setLabel(card)
          .setStyle(game.chosen.includes(card) ? ButtonStyle.Success : ButtonStyle.Primary)
      );
    });

    const forfeitRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("Fold")
        .setLabel("Fold")
        .setStyle(ButtonStyle.Danger)
    );

    return [cardRow, forfeitRow];
  }

  const embed = pokerEmbed(
    "Quick Draw Poker",
    bet,
    game.board,
    game.playerCards,
    game.chosen,
    "Pick 3 cards to play or Fold."
  );

  const sent = await message.reply({ embeds: [embed], components: buildButtons() });
  const collector = sent.createMessageComponentCollector({ time: 60000 });

  collector.on("collect", async interaction => {
    if (interaction.user.id !== message.author.id)
      return interaction.reply({ content: "This is not your poker game.", ephemeral: true });

    const house = await getHouse();

    if (interaction.customId === "Fold") {
      const refund = Math.floor(bet / 2);
      user.balance += refund;
      await processGame(refund);

      const netLoss = bet - refund;
      if (netLoss > 0)
        house.jackpotPot += Math.round(netLoss * 0.2);

      await saveUser(message.author.id, user);
      await saveUser(process.env.BOT_ID, house);

      activeGames.delete(message.author.id);
      return interaction.update({ components: [] });
    }

    const index = parseInt(interaction.customId.split("_")[2]);
    const picked = game.playerCards[index];

    if (game.chosen.includes(picked)) {
      game.chosen = game.chosen.filter(c => c !== picked);
    } else {
      if (game.chosen.length >= 3)
        return interaction.reply({ content: "You can only choose 3 cards.", ephemeral: true });
      game.chosen.push(picked);
    }

    if (game.chosen.length === 3) {
      collector.stop();
      const result = finishGame(game, hasBoost);

      let payout = 0;
      let netLoss = 0;

      if (result.winner === "player") {
        payout = bet * 2;
        user.balance += payout;
        await processGame(payout);
        netLoss = bet - payout;
      }
      else if (result.winner === "bot") {
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

      return interaction.update({ components: [] });
    }

    await interaction.update({ embeds: [embed], components: buildButtons() });
  });

  collector.on("end", () => activeGames.delete(message.author.id));
}
