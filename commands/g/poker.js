// src/commands/g/poker.js

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

  if (isNaN(bet) || bet <= 0) {
    return message.reply("Usage: `!g poker <bet>`");
  }

  const user = await getUser(message.author.id);

  if (user.balance < bet) {
    return message.reply("You don't have enough money.");
  }

  // remove bet immediately
  user.balance -= bet;
  await saveUser(message.author.id, user);

  // house collects bet
  await processGame(-bet);

  // boost role check
  const SPECIAL_ROLE = process.env.ROLE_ID;
  const hasBoost = message.member.roles.cache.has(SPECIAL_ROLE);

  // start new game
  const game = newPokerGame();
  activeGames.set(message.author.id, game);

  // build card buttons
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

  // starting embed
  const embed = pokerEmbed(
    "5 Card Draw",
    bet,
    game.board,
    game.playerCards,
    game.chosen,
    "Pick 3 cards to play."
  );

  const sent = await message.reply({
    embeds: [embed],
    components: [buildButtons()]
  });

  const collector = sent.createMessageComponentCollector({
    time: 60000
  });

  collector.on("collect", async interaction => {
    // stop other players from clicking
    if (interaction.user.id !== message.author.id) {
      return interaction.reply({
        content: "This is not your poker game.",
        ephemeral: true
      });
    }

    const index = parseInt(interaction.customId.split("_")[2]);
    const picked = game.playerCards[index];

    // toggle selection
    if (game.chosen.includes(picked)) {
      game.chosen = game.chosen.filter(c => c !== picked);
    } else {
      if (game.chosen.length >= 3) {
        return interaction.reply({
          content: "You can only choose 3 cards.",
          ephemeral: true
        });
      }
      game.chosen.push(picked);
    }

    // finish once 3 are chosen
    if (game.chosen.length === 3) {
      collector.stop();

      const result = finishGame(game, hasBoost);

      let payout = 0;
      let outcomeText = "";
      let outcomeLabel = "";
      let embedColor = "";

      // WIN
      if (result.winner === "player") {
        payout = bet * 2;
        user.balance += payout;
        await processGame(payout);

        outcomeLabel = "WIN";
        embedColor = "GAME_COLORS.WIN";

        outcomeText = `${result.playerScore.name} beats ${result.botScore.name}`;
      }

      // LOSS
      else if (result.winner === "bot") {
        outcomeLabel = "LOSS";
        embedColor = "GAME_COLORS.LOSS";

        outcomeText = `${result.botScore.name} beats ${result.playerScore.name}`;
      }

      // TIE
      else {
        payout = bet;
        user.balance += payout;
        await processGame(payout);

        outcomeLabel = "TIE";
        embedColor = "GAME_COLORS.TIE";

        outcomeText = `Both had ${result.playerScore.name}`;
      }

      // save balance changes
      await saveUser(message.author.id, user);

      // dealer reveal (only the 3 chosen cards)
      const dealerPlayed = result.botFinal.slice(0, 3);

      // final embed
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

      return interaction.update({
        embeds: [finalEmbed],
        components: []
      });
    }

    // update embed while picking
    const updatedEmbed = pokerEmbed(
      "5 Card Draw",
      bet,
      game.board,
      game.playerCards,
      game.chosen,
      `Pick 3 cards (${game.chosen.length}/3 selected).`
    );

    await interaction.update({
      embeds: [updatedEmbed],
      components: [buildButtons()]
    });
  });

  collector.on("end", () => {
    activeGames.delete(message.author.id);
  });
}
