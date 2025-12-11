import { EmbedBuilder } from "discord.js";

export function rouletteEmbed(result, color, winning, bet, payout) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle("Roulette")
    .setDescription(
      `**Result:** ${result}\n` +
      `**Winning Color:** ${winning}\n` +
      `**Bet:** $${bet}\n` +
      `**Payout:** $${payout}`
    );
}
