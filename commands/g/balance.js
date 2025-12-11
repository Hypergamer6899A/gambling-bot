import { getUser } from "../services/userCache.js";
import { EmbedBuilder } from "discord.js";

export async function balanceCommand(client, message) {
  const user = await getUser(message.author.id);

  return message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor("Blurple")
        .setTitle("Your Balance")
        .setDescription(`You currently have **$${user.balance}**.`)
    ]
  });
}

