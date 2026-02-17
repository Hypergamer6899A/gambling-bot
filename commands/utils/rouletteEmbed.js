// src/commands/utils/rouletteEmbed.js

import { EmbedBuilder } from "discord.js";
import { GAME_COLORS } from "./embedColors.js";

export function rouletteEmbed(result, choice, bet, payout, win) {
  return new EmbedBuilder()
    .setTitle("Roulette Results")
    .setColor(win ? GAME_COLORS.WIN : GAME_COLORS.LOSS)
    .setDescription(
      `**Spin Result:** ${result}\n\n` +
        `**You Bet On:** ${choice.toUpperCase()}\n\n` +
        `**Bet Amount:** $${bet}\n` +
        `**Outcome:** ${win ? "WIN" : "LOSS"}\n` +
        `**Payout:** $${payout}`
    );
}
