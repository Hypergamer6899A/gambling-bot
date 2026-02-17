import { EmbedBuilder } from "discord.js";

export function rouletteEmbed(result, winning, bet, payout, color) {
  return new EmbedBuilder()
    .setTitle("Roulette Results")
    .setColor(color)
    .setDescription(
      `**Spin Result**\n${result}\n\n` +
      `**Winning Color**\n${winning}\n\n` +
      `**Bet:** $${bet}\n`
    );
}
