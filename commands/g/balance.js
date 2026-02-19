import { EmbedBuilder } from "discord.js";
import { getUser } from "../services/userCache.js";
import { getHouse } from "../utils/house.js";
import { UTIL_COLORS } from "../utils/embedColors.js";

export async function balanceCommand(client, message) {
  const user = await getUser(message.author.id);

  // Load Gambler pot
  const house = await getHouse();

  return message.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle("Your Balance")
        .setColor(UTIL_COLORS.BLURPLE)
        .setDescription(
          `**Current Wallet**\n` +
            `You currently have **$${user.balance}**.\n\n` +
            `**Server Jackpot Pot**\n` +
            `**$${house.jackpotPot}**`
        )
    ]
  });
}
