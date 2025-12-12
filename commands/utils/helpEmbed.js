import { EmbedBuilder } from "discord.js";

export function helpEmbed() {
  return new EmbedBuilder()
    .setColor("Gold")
    .setTitle("Gambler — Command List")
    .setDescription(
      "**Economy**\n" +
      "`!g balance` — Check your balance\n" +
      "`!g gift <user> <amount>` — Gift money\n\n" +
      "**Games**\n" +
      "`!g blackjack <amount>`\n" +
      "`!g roulette <red|black|odd|even> <amount>`\n" +
      "`!g uno <amount>`\n\n" +
      "**Misc**\n" +
      "`!g claim` - Claim $100 every 24 hour when broke\n" +
      "`!g leaderboard` — Top balances\n" +
      "`!g help` — Show this menu"
    );
}
