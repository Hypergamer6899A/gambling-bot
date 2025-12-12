import { EmbedBuilder } from "discord.js";

export function bjEmbed(title, bet, playerHand, dealerHand, playerTotal, dealerTotal, streak, color = "Grey") {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`${title} — Bet $${bet}`)
    .setDescription(
      `**Your Hand (${playerTotal})**\n${playerHand.join(" | ")}\n\n` +
      `**Dealer Hand (${dealerTotal ?? "??"})**\n` +
      (dealerTotal === null ? `${dealerHand[0]} | ??` : dealerHand.join(" | ")) +
      `\n\nBalance: **$${balance}**\nWin Streak: ${streak}`
    );
}
