import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";

import { getUser, saveUser } from "../services/userCache.js";
import { processGame } from "../utils/house.js";

import { newPokerGame, finishGame } from "../games/poker/engine.js";
import { pokerEmbed } from "../utils/pokerEmbed.js";

const activeGames = new Map();

export async function pokerCommand(client, message, args) {
  const bet = parseInt(args[2]);

  if (isNaN(bet) || bet <= 0) {
    return message.reply("Usage: `!g poker <bet>`");
  }

  const user = await getUser(message.author.id);

  if (user.balance < bet) {
    return message.reply("You don't have enough money.");
  }

  // Deduct bet immediately
  user.balance -= bet;
  await saveUser(message.author.id, user);

  // House gains bet immediately
  await processGame(-bet);

  // Start game
  const game = newPokerGame();
  activeGames.set(message.author.id, game);

  // Helper: Build card buttons with highlight
  function buildButtons() {
    return new ActionRowBuilder().addComponents(
      game.playerCards.map((card, i) => {
        const selected = game.chosen.includes(card);

        return new ButtonBuilder()
          .setCustomId(`poker_pick_${i}`)
          .setLabel(card)
          .setStyle(selected ? ButtonStyle.Success : ButtonStyle.Primary);
      })
    );
  }

  // Send initial embed
  const embed = pokerEmbed(
    "Texas Hold’em",
    bet,
    game.board,
    game.playerCards,
    game.chosen,
    "Pick 3 cards to play!"
  );

  const sent = await message.reply({
    embeds: [embed],
    components: [buildButtons()]
  });

  const collector = sent.createMessageComponentCollector({
    time: 60000
  });

  collector.on("collect", async (interaction) => {
    if (interaction.user.id !== message.author.id) {
      return interaction.reply({
        content: "Not your poker table",
        ephemeral: true
      });
    }

    const index = parseInt(interaction.customId.split("_")[2]);
    const picked = game.playerCards[index];

    // ✅ Toggle select/unselect
    if (game.chosen.includes(picked)) {
      // Unselect
      game.chosen = game.chosen.filter((c) => c !== picked);
    } else {
      // Prevent choosing more than 3
      if (game.chosen.length >= 3) {
        return interaction.reply({
          content: "You can only choose 3 cards!",
          ephemeral: true
        });
      }

      // Select
      game.chosen.push(picked);
    }

    // ✅ If exactly 3 chosen → finish game
    if (game.chosen.length === 3) {
      collector.stop();

      const result = finishGame(game);

      let payout = 0;
      let outcomeText = "";

      if (result.winner === "player") {
        payout = bet * 2;
        user.balance += payout;

        await processGame(payout);

        outcomeText =
          `You WIN!\n` +
          `**${result.playerScore.name}** beats **${result.botScore.name}**`;
      }

      else if (result.winner === "bot") {
        outcomeText =
          `Bot wins!\n` +
          `**${result.botScore.name}** beats **${result.playerScore.name}**`;
      }

      else {
        // Tie → refund bet
        payout = bet;
        user.balance += payout;

        await processGame(payout);

        outcomeText =
          `Tie! Bet refunded.\n` +
          `Both had **${result.playerScore.name}**`;
      }

      await saveUser(message.author.id, user);

      const finalEmbed = pokerEmbed(
        "Game Over",
        bet,
        game.board,
        game.playerCards,
        game.chosen,
        `${outcomeText}\n\n**Payout:** $${payout}`
      );

      return interaction.update({
        embeds: [finalEmbed],
        components: []
      });
    }

    // ✅ Otherwise update embed + highlighted buttons
    const updatedEmbed = pokerEmbed(
      "Texas Hold’em",
      bet,
      game.board,
      game.playerCards,
      game.chosen,
      `Pick 3 cards! (${game.chosen.length}/3 selected)`
    );

    await interaction.update({
      embeds: [updatedEmbed],
      components: [buildButtons()]
    });
  });

  collector.on("end", async () => {
    activeGames.delete(message.author.id);
  });
}
