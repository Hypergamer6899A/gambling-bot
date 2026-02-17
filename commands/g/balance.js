import { EmbedBuilder } from "discord.js";
import { getUser } from "../services/userCache.js";

export async function balanceCommand(client, message) {
  const user = await getUser(message.author.id);

  return message.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle("Your Balance")
        .setColor("Blurple")
        .setDescription(
          `**Current Wallet**\n` +
          `You currently have **$${user.balance}**.`
        )
    ]
  });
}
