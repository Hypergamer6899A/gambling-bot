import { EmbedBuilder } from "discord.js";

export function rouletteEmbed(result, choice, resultColor, bet, payout, win) {
  return new EmbedBuilder()
    .setTitle("Roulette Results")
    .setColor(resultColor === "Red" ? 0xff0000 :
              resultColor === "Black" ? 0x000000 :
              0x00ff00)
    .setDescription(
      `**Spin Result:** ${result} (${resultColor})\n\n` +
      `**You Bet On:** ${choice.toUpperCase()}\n\n` +
      `**Bet Amount:** $${bet}\n` +
      `**Outcome:** ${win ? "WIN" : "LOSS"}\n` +
      `**Payout:** $${payout}`
    );
}
