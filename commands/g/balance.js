// commands/g/balance.js
import { getUser } from "../services/userCache.js";
import { getHouse } from "../utils/house.js";
import { balanceEmbed } from "../utils/embeds.js";

export async function balanceCommand(client, message) {
  const [user, house] = await Promise.all([
    getUser(message.author.id),
    getHouse(),
  ]);

  return message.reply({ embeds: [balanceEmbed(user.balance, house.jackpotPot)] });
}
