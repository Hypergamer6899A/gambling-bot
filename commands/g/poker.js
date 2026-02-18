import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";

import { getUser, saveUser } from "../services/userCache.js";
import { processGame } from "../utils/house.js";
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

  // Function to build buttons
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
        .setCustomId("poker_forfeit")
        .setLabel("Forfeit")
        .setStyle(ButtonStyle.Danger)
    );

    return [cardRow, forfeitRow];
  }

  // Create initial embed
  const embed = pokerEmbed(
    "5 Card Draw",
    bet,
    game.board,
    game.playerCards,
    game.chosen,
    "Pick 3 cards to play or Forfeit."
  );

  // Send initial message
  const sent = await message.reply({ embeds: [embed], components: buildButtons() });

  const collector = sent.createMessageComponentCollector({ time: 60000 });

  collector.on("collect", async interaction => {
    if (interaction.user.id !== message.author.id) {
      return interaction.reply({ content: "This is not your poker game.", ephemeral: true });
    }

    // Handle Forfeit
    if (interaction.customId === "poker_forfeit") {
      user.balance += bet; // refund
      await saveUser(message.author.id, user);
      await processGame(bet); // remove bet from house

      const finalEmbed = pokerEmbed(
        "Game Over",
        bet,
        game.board,
        game.playerCards,
        game.chosen,
        "You forfeited and got your bet back.",
        GAME_COLORS.INFO
      );

      activeGames.delete(message.author.id);
      return interaction.update({ embeds: [finalEmbed], components: [] });
    }

    // Handle card selection
    const index = parseInt(interaction.customId.split("_")[2]);
    const picked = game.playerCards[index];

    if (game.chosen.includes(picked)) {
      game.chosen = game.chosen.filter(c => c !== picked);
    } else {
      if (game.chosen.length >= 3) {
        return interaction.reply({ content: "You can only choose 3 cards.", ephemeral: true });
      }
      game.chosen.push(picked);
    }

    // If 3 cards chosen, finish game
    if (game.chosen.length === 3) {
      collector.stop();

      const result = finishGame(game, hasBoost);

      let payout = 0;
      let outcomeText = "";
      let outcomeLabel = "";
      let embedColor = "";

      if (result.winner === "player") {
        payout = bet * 2;
        user.balance += payout;
        await processGame(payout);
        outcomeLabel = "WIN";
        embedColor = GAME_COLORS.WIN;
        outcomeText = `${result.playerScore.name} beats ${result.botScore.name}`;
      } else if (result.winner === "bot") {
        outcomeLabel = "LOSS";
        embedColor = GAME_COLORS.LOSS;
        outcomeText = `${result.botScore.name} beats ${result.playerScore.name}`;
      } else {
        payout = bet;
        user.balance += payout;
        await processGame(payout);
        outcomeLabel = "TIE";
        embedColor = GAME_COLORS.TIE;
        outcomeText = `Both had ${result.playerScore.name}`;
      }

      await saveUser(message.author.id, user);

      const dealerPlayed = result.botFinal.slice(0, 3);

      const finalEmbed = pokerEmbed(
        "Game Over",
        bet,
        game.board,
        game.playerCards,
        game.chosen,
        `${outcomeText}\nPayout: $${payout}`,
        embedColor,
        dealerPlayed,
        outcomeLabel
      );

      return interaction.update({ embeds: [finalEmbed], components: [] });
    }

    // Update embed with current choices
    const updatedEmbed = pokerEmbed(
      "5 Card Draw",
      bet,
      game.board,
      game.playerCards,
      game.chosen,
      `Pick 3 cards (${game.chosen.length}/3 selected) or Forfeit.`
    );

    await interaction.update({ embeds: [updatedEmbed], components: buildButtons() });
  });

  collector.on("end", () => activeGames.delete(message.author.id));
}
