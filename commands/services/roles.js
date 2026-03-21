// commands/services/roles.js
import { getFirestore } from "firebase-admin/firestore";

const db      = getFirestore();
const ROLE_ID  = process.env.ROLE_ID;
const GUILD_ID = process.env.GUILD_ID;

export async function updateTopThreeRole(client) {
  const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
  if (!guild) return;

  const role = guild.roles.cache.get(ROLE_ID);
  if (!role) return;

  // Fetch all members so cache is complete before we iterate
  await guild.members.fetch();

  const snap = await db.collection("users")
    .orderBy("balance", "desc")
    .limit(3)
    .get();

  const topThreeIds = new Set(
    snap.docs.map(doc => doc.id).filter(id => id !== process.env.BOT_ID)
  );

  // Add role to top 3
  for (const id of topThreeIds) {
    const member = guild.members.cache.get(id);
    if (member && !member.roles.cache.has(ROLE_ID)) {
      await member.roles.add(role).catch(() => {});
    }
  }

  // Remove role from everyone else who has it
  guild.members.cache.forEach(member => {
    if (!topThreeIds.has(member.id) && member.roles.cache.has(ROLE_ID)) {
      member.roles.remove(role).catch(() => {});
    }
  });
}
