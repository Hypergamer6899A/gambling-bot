// src/commands/utils/bjEmbed.js

import { EmbedBuilder } from "discord.js";
import { GAME_COLORS } from "./embedColors.js";

export function bjEmbed(
  title,
  bet,
  playerHand,
  dealerHand,
  playerTotal,
  dealerTotal,
  streak,
  outcome = "TIE" // WIN | LOSS | TIE
) {
  playerHand = Array.isArray(playerHand) ? playerHand : [playerHand];
  dealerHand = Array.isArray(dealerHand) ? dealerHand : [dealerHand];

  return new EmbedBuilder()
    .setTitle(`${title}`)
    .setColor(GAME_COLORS[outcome])
    .setDescription(
      `**Your Hand (${playerTotal})**\n` +
        `${playerHand.join(" | ")}\n\n` +
        `**Dealer Hand (${dealerTotal === null ? "?" : dealerTotal})**\n` +
        `${
          dealerTotal === null
            ? `${dealerHand[0]} | ??`
            : dealerHand.join(" | ")
        }\n\n` +
        `**Bet:** $${bet}\n` +
        `**Streak:** ${streak}`
    );
}
