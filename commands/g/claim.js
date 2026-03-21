// commands/g/claim.js
import { getUser, saveUser } from "../services/userCache.js";

const COOLDOWN_MS = 24 * 60 * 60 * 1000;

export async function claimCommand(client, message) {
  const user = await getUser(message.author.id);
  const now  = Date.now();

  if (user.balance > 0)
    return message.reply("You still have money. Claim is only for broke people.");

  if (user.lastClaim && now - user.lastClaim < COOLDOWN_MS) {
    const next = Math.floor((user.lastClaim + COOLDOWN_MS) / 1000);
    return message.reply(`You can claim again <t:${next}:R>.`);
  }

  user.balance  += 100;
  user.lastClaim = now;
  await saveUser(message.author.id, user);

  return message.reply(`${message.author}, you claimed **$100**! Now go gamble!`);
}
