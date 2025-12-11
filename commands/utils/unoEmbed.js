import { EmbedBuilder } from "discord.js";
import { cardToString } from "../games/uno/format.js";

export function unoEmbed(state) {
  return new EmbedBuilder()
    .setTitle(`UNO vs Bot — Bet: $${state.bet}`)
    .setColor(state.turn === "player" ? 0x22cc66 : 0xff8844)
    .setDescription(
      `**Top Card:** ${state.currentColor} ${state.currentValue}\n` +
      `**Your Hand:** ${state.playerHand.map(cardToString).join(", ") || "(empty)"}\n` +
      `**Bot Cards:** ${state.botHand.length}\n` +
      `**Turn:** ${state.turn === "player" ? "Your move" : "Bot's move"}`
    );
}
