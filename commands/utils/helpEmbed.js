// src/commands/utils/helpEmbed.js

import { EmbedBuilder } from "discord.js";
import { UTIL_COLORS } from "./embedColors.js";

export function helpEmbed() {
  return new EmbedBuilder()
    .setTitle("Gambler — Command List")
    .setColor(UTIL_COLORS.PURPLE)
    .setDescription(
      `**Economy**\n` +
        `\`!g balance\` — Check your balance\n` +
        `\`!g gift <user> <amount>\` — Gift money\n\n` +
        `**Games**\n` +
        `\`!g slots <amount>\`\n` +
        `\`!g blackjack <amount>\`\n` +
        `\`!g roulette <red|black|odd|even> <amount>\`\n` +
        `\`!g poker <amount>\`\n` +
        `**Misc**\n` +
        `\`!g claim\` — Claim $100 every 24h when broke\n` +
        `\`!g leaderboard\` — Top balances\n` +
        `\`!g help\` — Show this menu`
    );
}
