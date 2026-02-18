// src/commands/utils/pokerEmbed.js

import { EmbedBuilder } from "discord.js";
import { GAME_COLORS } from "./embedColors.js";

export function pokerEmbed(
  title,
  bet,
  board,
  playerCards,
  chosen,
  status,
  color = GAME_COLORS.INFO,
  dealerCards = null,
  outcome = null
) {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setDescription(
      `Board Cards\n${board.join(" | ")}\n\n` +
        `Your Cards\n${playerCards.join(" | ")}\n\n` +
        `Chosen Cards (${chosen.length}/3)\n${
          chosen.length ? chosen.join(" | ") : "None"
        }\n\n` +
        (dealerCards
          ? `Dealer Played\n${dealerCards.join(" | ")}\n\n`
          : "") +
        `Bet: $${bet}\n\n` +
        (outcome ? `Outcome: **${outcome}**\n\n` : "") +
        `Status: ${status}`
    );
}
