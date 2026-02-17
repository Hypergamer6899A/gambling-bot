import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

import { newPokerGame, finishGame } from "../games/poker/engine.js";
import { pokerEmbed } from "../utils/pokerEmbed.js";

const activeGames = new Map();

export async function pokerCommand(client, message, args) {
  const bet = parseInt(args[2]);

  if (!bet || bet <= 0) {
    return message.reply("Usage: `!g poker <bet>`");
  }

  const game = newPokerGame();
  activeGames.set(message.author.id, game);

  const buttons = new ActionRowBuilder().addComponents(
    game.playerCards.map((card, i) =>
      new ButtonBuilder()
        .setCustomId(`poker_pick_${i}`)
        .setLabel(card)
        .setStyle(ButtonStyle.Primary)
    )
  );

  const embed = pokerEmbed(
    "Texas Hold’em Lite 🃏",
    bet,
    game.board,
    game.playerCards,
    game.chosen,
    "Pick 3 cards to play!"
  );

  const sent = await message.reply({ embeds: [embed], components: [buttons] });

  const collector = sent.createMessageComponentCollector({
    time: 60000
  });

  collector.on("collect", async (interaction) => {
    if (interaction.user.id !== message.author.id) {
      return interaction.reply({
        content: "Not your poker game 😏",
        ephemeral: true
      });
    }

    const index = parseInt(interaction.customId.split("_")[2]);
    const picked = game.playerCards[index];

    if (game.chosen.includes(picked)) {
      return interaction.reply({
        content: "Already chosen!",
        ephemeral: true
      });
    }

    game.chosen.push(picked);

    if (game.chosen.length === 3) {
      collector.stop();
      const result = finishGame(game);

      let outcome =
        result.winner === "player"
          ? "🎉 You WIN!"
          : result.winner === "bot"
          ? "💀 Bot wins!"
          : "🤝 Tie!";

      const finalEmbed = pokerEmbed(
        "Game Over 🃏",
        bet,
        game.board,
        game.playerCards,
        game.chosen,
        `${outcome}\nYou: ${result.playerScore.name}\nBot: ${result.botScore.name}`
      );

      return interaction.update({
        embeds: [finalEmbed],
        components: []
      });
    }

    const updatedEmbed = pokerEmbed(
      "Texas Hold’em Lite 🃏",
      bet,
      game.board,
      game.playerCards,
      game.chosen,
      "Pick 3 cards!"
    );

    await interaction.update({ embeds: [updatedEmbed] });
  });
}
