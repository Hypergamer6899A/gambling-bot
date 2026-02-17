// src/commands/utils/pokerEmbed.js

import { EmbedBuilder } from "discord.js";
import { GAME_COLORS } from "./embedColors.js";

export function pokerEmbed(title, bet, board, playerCards, chosen, status, outcome = "TIE") {
  return new EmbedBuilder()
    .setTitle(`${title}`)
    .setColor(GAME_COLORS[outcome])
    .setDescription(
      `**Board Cards**\n${board.join(" | ")}\n\n` +
        `**Your Cards**\n${playerCards.join(" | ")}\n\n` +
        `**Chosen Cards (${chosen.length}/3)**\n` +
        `${chosen.length ? chosen.join(" | ") : "*None yet*"}\n\n` +
        `**Bet:** $${bet}\n\n` +
        `**Status:** ${status}`
    );
}
