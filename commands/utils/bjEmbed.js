export function bjEmbed(
  title,
  bet,
  playerHand,
  dealerHand,
  playerTotal,
  dealerTotal,
  streak,
  color = "Yellow"
) {
  // ensure hands are arrays
  playerHand = Array.isArray(playerHand) ? playerHand : [playerHand];
  dealerHand = Array.isArray(dealerHand) ? dealerHand : [dealerHand];

  return new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setDescription(
      `**Your Hand (${playerTotal})**\n${playerHand.join(" | ")}\n\n` +
      `**Dealer Hand (${dealerTotal === null ? "?" : dealerTotal})**\n` +
      `${dealerTotal === null ? `${dealerHand[0]} | ??` : dealerHand.join(" | ")}` +
      `\n\n**Bet:** $${bet}  **Streak:** ${streak}`
    );
}
