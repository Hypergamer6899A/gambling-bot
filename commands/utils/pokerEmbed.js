// src/commands/utils/pokerEmbed.js

import { EmbedBuilder } from "discord.js";
import { GAME_COLORS } from "./embedColors.js";

export function pokerEmbed(title, bet, board, playerCards, chosen, status) {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(GAME_COLORS.WIN) // Poker embed defaults to green
    .setDescription(
      `Board Cards\n${board.join(" | ")}\n\n` +
        `Your Cards\n${playerCards.join(" | ")}\n\n` +
        `Chosen Cards (${chosen.length}/3)\n${
          chosen.length ? chosen.join(" | ") : "None"
        }\n\n` +
        `Bet: $${bet}\n\n` +
        `Status: ${status}`
    );
}
