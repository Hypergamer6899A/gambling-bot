import { getFirestore } from "firebase-admin/firestore";

const db = getFirestore();
const ROLE_ID = process.env.ROLE_ID;
const GUILD_ID = process.env.GUILD_ID;

export async function updateTopThreeRole(client) {
  const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
  if (!guild) return;

  const role = guild.roles.cache.get(ROLE_ID);
  if (!role) return;

  const usersSnapshot = await db.collection("users")
    .orderBy("balance", "desc")
    .limit(3)
    .get();

  const topThreeIds = usersSnapshot.docs.map(doc => doc.id);

  for (const id of topThreeIds) {
    try {
      // fetch member directly by ID
      const member = await guild.members.fetch(id).catch(() => null);
      if (member && !member.roles.cache.has(role.id)) {
        await member.roles.add(role).catch(() => {});
      }
    } catch {}
  }

  // Now remove role from anyone who is NOT top three
  guild.members.cache.forEach(member => {
    if (!topThreeIds.includes(member.id) && member.roles.cache.has(role.id)) {
      member.roles.remove(role).catch(() => {});
    }
  });
}
