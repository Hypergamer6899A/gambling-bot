// commands/g/claim.js
import { getFirestore } from "firebase-admin/firestore";
import { getUser, saveUser } from "../services/userCache.js";

export async function claimCommand(client, message) {
  const db = getFirestore();
  const userId = message.author.id;

  // Get user
  let user = await getUser(userId);
  if (!user) {
    user = { balance: 0, lastClaim: 0 };
  }

  const now = Date.now();
  const twentyFourHours = 24 * 60 * 60 * 1000;

  if (user.balance > 0) {
    return message.reply(`You still have money. Claim is only for players with $0 balance.`);
  }

  if (user.lastClaim && now - user.lastClaim < twentyFourHours) {
    const nextClaim = new Date(user.lastClaim + twentyFourHours);
    return message.reply(`You can claim again at <t:${Math.floor(nextClaim.getTime() / 1000)}:R>`);
  }

  // Give $100
  user.balance += 100;
  user.lastClaim = now;
  await saveUser(userId, user);

  message.reply(`${message.author}, you claimed $100! Your new balance is $${user.balance}.`);
}
