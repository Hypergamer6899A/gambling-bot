// src/commands/utils/slotsEmbed.js

import { EmbedBuilder } from "discord.js";
import { GAME_COLORS } from "./embedColors.js";

export function slotsEmbed(
  bet,
  slots,
  multiplier,
  outcome,
  earnings
) {
  let color = GAME_COLORS.LOSS;
  if (multiplier < 1) color = GAME_COLORS.LOSS;
  if (multiplier === 1) color = GAME_COLORS.TIE;
  if (multiplier > 1) color = GAME_COLORS.WIN;

  return new EmbedBuilder()
    .setTitle("Slot Machine")
    .setColor(color)
    .setDescription(
      `**Result**\n` +
      `${slots.join(" | ")}\n\n` +
      `**Bet Per Spin:** $${bet}\n` +
      `**Multiplier:** x${multiplier}\n` +
      `**Outcome:** ${outcome}\n\n` +
      `**Total Earnings:** $${earnings}`
    );
}
