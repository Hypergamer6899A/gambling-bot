// commands/g/gift.js
import { getUser, saveUser } from "../services/userCache.js";

export async function giftCommand(client, message, args) {
  const target = message.mentions.users.first();
  const amount = parseInt(args[3]);

  if (!target)
    return message.reply("Tag someone to gift money to.");
  if (isNaN(amount) || amount <= 0)
    return message.reply("Enter a valid amount.");
  if (target.id === message.author.id)
    return message.reply("You can't gift money to yourself.");
  if (target.bot)
    return message.reply("You can't gift money to a bot.");

  const sender   = await getUser(message.author.id);
  const receiver = await getUser(target.id);

  if (sender.balance < amount)
    return message.reply("You don't have enough money.");

  sender.balance   -= amount;
  receiver.balance += amount;

  await saveUser(message.author.id, sender);
  await saveUser(target.id, receiver);

  return message.reply(
    `Sent **$${amount}** to ${target}. They now have **$${receiver.balance}**.`,
  );
}
